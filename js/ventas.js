// ventas.js — Registro de ventas con cálculo automático de ganancia

// datos = { productoId, clienteId (o null para "cliente general"), cantidad, precioVenta }
async function registrarVenta(datos) {
  const producto = await DB.obtener(DB.STORES.productos, datos.productoId);
  if (!producto) throw new Error('Producto no encontrado');

  const stock = Number(producto.stock) || 0;
  if (stock <= 0) {
    throw new Error(`No se puede vender "${producto.nombre}": no hay existencias (stock 0).`);
  }

  const cantidadTexto = String(datos.cantidad ?? '').trim();
  const cantidad = Number(cantidadTexto);
  if (!Number.isInteger(cantidad) || cantidad < 1) {
    throw new Error('La cantidad debe ser un número entero, mayor o igual a 1.');
  }
  if (cantidad > stock) {
    throw new Error(`No hay suficientes existencias de "${producto.nombre}". Pediste ${cantidad} y solo hay ${stock}.`);
  }

  const precioVenta = parseFloat(datos.precioVenta);
  const precioUnitario = isNaN(precioVenta) ? producto.precio : precioVenta;
  const costoUnitario = producto.costo || 0;
  const total = precioUnitario * cantidad;
  const gananciaTotal = (precioUnitario - costoUnitario) * cantidad;

  const venta = {
    productoId: producto.id,
    nombreProducto: producto.nombre,
    clienteId: datos.clienteId || null,
    cantidad,
    precioUnitario,
    costoUnitario,
    total,
    ganancia: gananciaTotal,
    fecha: new Date().toISOString(),
  };

  // Con internet: venta atómica contra el stock real de la nube.
  if (navigator.onLine) {
    try {
      await DB.venderEnTransaccion(producto.id, cantidad, venta);
      Catalogo.actualizarDisponibilidad(producto.id).catch((e) => console.warn('Catálogo no sincronizado', e));
      return venta;
    } catch (err) {
      if (err.code === 'sin-stock') {
        throw new Error(err.stock <= 0
          ? `"${producto.nombre}" se acaba de agotar: otra persona vendió la última unidad.`
          : `Otra persona acaba de vender "${producto.nombre}". Ahora solo quedan ${err.stock}.`);
      }
      if (err.code === 'no-existe') throw new Error('Este producto ya no existe en el inventario.');
      if (!DB.esErrorDeConexion(err)) throw new Error(DB.mensajeDeError(err));
      // Si falló por la conexión, se registra como venta sin internet (abajo).
      console.warn('Venta atómica no disponible, se guarda sin conexión', err);
    }
  }

  // Sin internet: se guarda en el teléfono y se sincroniza al volver la señal.
  await DB.agregar(DB.STORES.ventas, venta);
  await Inventario.ajustarStock(producto.id, -cantidad);

  return venta;
}

// Las ventas anuladas se conservan (para saber qué pasó), pero no cuentan en
// totales, ganancias ni reportes. Solo la lista de Ventas las muestra.
async function listarVentas({ desde = null, hasta = null, incluirAnuladas = false } = {}) {
  let ventas = await DB.obtenerTodos(DB.STORES.ventas);
  if (!incluirAnuladas) ventas = ventas.filter((v) => !v.anulada);
  // Los campos "desde"/"hasta" vienen de un selector de fecha (solo día, sin hora),
  // y hay que interpretarlos como el inicio y el final de ESE día en la hora local
  // del teléfono. Si se comparan tal cual (sin hora), JavaScript los toma como
  // medianoche en UTC, y como Honduras está varias horas detrás de UTC, las ventas
  // registradas en la tarde/noche quedaban excluidas del reporte de "hoy".
  if (desde) ventas = ventas.filter((v) => new Date(v.fecha) >= new Date(desde + 'T00:00:00'));
  if (hasta) ventas = ventas.filter((v) => new Date(v.fecha) <= new Date(hasta + 'T23:59:59.999'));
  ventas.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  return ventas;
}

// Anula una venta: la marca como anulada (no se borra) y devuelve el stock.
async function anularVenta(id) {
  const usuario = (window.firebase && firebase.auth && firebase.auth().currentUser) || null;
  const datos = {
    anuladaEl: new Date().toISOString(),
    anuladaPor: (usuario && usuario.email) || '',
  };

  if (navigator.onLine) {
    try {
      const r = await DB.anularVentaEnTransaccion(id, datos);
      if (r.productoExiste) Catalogo.actualizarDisponibilidad(r.productoId).catch((e) => console.warn('Catálogo no sincronizado', e));
      return r;
    } catch (err) {
      if (err.code === 'ya-anulada') throw new Error('Esta venta ya estaba anulada (quizás desde el otro celular).');
      if (err.code === 'no-existe') throw new Error('Esta venta ya no existe.');
      if (!DB.esErrorDeConexion(err)) throw new Error(DB.mensajeDeError(err));
      console.warn('Anulación atómica no disponible, se guarda sin conexión', err);
    }
  }

  // Sin internet: se guarda en el teléfono y se sincroniza al volver la señal.
  const venta = await DB.obtener(DB.STORES.ventas, id);
  if (!venta) throw new Error('Esta venta ya no existe.');
  if (venta.anulada) throw new Error('Esta venta ya estaba anulada.');
  const producto = venta.productoId ? await DB.obtener(DB.STORES.productos, venta.productoId) : null;
  // Sin internet, Firestore guarda los cambios en el teléfono pero la promesa
  // no termina hasta que vuelve la señal: no se espera para no trabar la pantalla.
  DB.actualizar(DB.STORES.ventas, { ...venta, anulada: true, ...datos }).catch((e) => console.warn(e));
  if (producto) Inventario.ajustarStock(venta.productoId, Number(venta.cantidad) || 0).catch((e) => console.warn(e));
  return { productoId: venta.productoId || null, productoExiste: !!producto };
}

async function resumen({ desde = null, hasta = null } = {}) {
  const ventas = await listarVentas({ desde, hasta });
  const totalVendido = ventas.reduce((sum, v) => sum + v.total, 0);
  const totalGanancia = ventas.reduce((sum, v) => sum + v.ganancia, 0);

  const porProducto = {};
  ventas.forEach((v) => {
    if (!porProducto[v.nombreProducto]) {
      porProducto[v.nombreProducto] = { cantidad: 0, total: 0, ganancia: 0 };
    }
    porProducto[v.nombreProducto].cantidad += v.cantidad;
    porProducto[v.nombreProducto].total += v.total;
    porProducto[v.nombreProducto].ganancia += v.ganancia;
  });

  const masVendidos = Object.entries(porProducto)
    .map(([nombre, datos]) => ({ nombre, ...datos }))
    .sort((a, b) => b.cantidad - a.cantidad);

  return { ventas, totalVendido, totalGanancia, masVendidos };
}

window.Ventas = {
  registrarVenta,
  listarVentas,
  anularVenta,
  resumen,
};
