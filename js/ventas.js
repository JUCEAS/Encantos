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
  if (!incluirAnuladas) ventas = ventas.filter((v) => !v.anulada && !v.corregida);
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

// Motivos para anular una venta. "regresa" es lo que se sugiere por defecto
// para "¿La planta regresa al inventario?" (se puede cambiar al anular).
const MOTIVOS_ANULAR = [
  { id: 'devolucion', texto: '🔄 El cliente devolvió la planta', regresa: true },
  { id: 'cambio', texto: '🔁 El cliente la cambió por otra planta', regresa: true },
  { id: 'danada', texto: '🥀 Planta dañada, enferma o con plaga (garantía)', regresa: false },
  { id: 'murio', texto: '🍂 La planta se secó o murió después de la venta', regresa: false },
  { id: 'cancelo', texto: '❌ El cliente canceló o no llegó a recogerla', regresa: true },
  { id: 'entrega', texto: '🚚 No se pudo entregar (dañada o perdida en el envío)', regresa: false },
  { id: 'pago', texto: '💵 El pago no se completó', regresa: true },
  { id: 'error', texto: '✍️ Error al registrar o venta duplicada', regresa: true },
  { id: 'otro', texto: '📝 Otro motivo', regresa: true },
];

function usuarioVentas() {
  const u = (window.firebase && firebase.auth && firebase.auth().currentUser) || null;
  return (u && u.email) || '';
}

// Anula una venta: la marca como anulada (no se borra), guarda el motivo y,
// si la planta regresa al inventario, devuelve el stock.
// opciones = { motivo: id de MOTIVOS_ANULAR, nota, regresaInventario }
async function anularVenta(id, opciones = {}) {
  const motivo = MOTIVOS_ANULAR.find((m) => m.id === opciones.motivo);
  if (!motivo) throw new Error('Elige el motivo de la anulación.');
  const nota = String(opciones.nota || '').trim().slice(0, 300);
  if (motivo.id === 'otro' && !nota) throw new Error('Escribe en la nota cuál fue el motivo.');
  const datos = {
    anuladaEl: new Date().toISOString(),
    anuladaPor: usuarioVentas(),
    motivoAnulacion: motivo.texto,
    notaAnulacion: nota,
    regresoInventario: opciones.regresaInventario !== false,
  };

  if (navigator.onLine) {
    try {
      const r = await DB.anularVentaEnTransaccion(id, datos);
      if (r.productoExiste) Catalogo.actualizarDisponibilidad(r.productoId).catch((e) => console.warn('Catálogo no sincronizado', e));
      return { ...r, regresoInventario: datos.regresoInventario };
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
  if (venta.corregida) throw new Error('Esta venta ya fue corregida. Anula la versión nueva.');
  const producto = venta.productoId ? await DB.obtener(DB.STORES.productos, venta.productoId) : null;
  // Sin internet, Firestore guarda los cambios en el teléfono pero la promesa
  // no termina hasta que vuelve la señal: no se espera para no trabar la pantalla.
  DB.actualizar(DB.STORES.ventas, { ...venta, anulada: true, ...datos }).catch((e) => console.warn(e));
  if (producto && datos.regresoInventario) Inventario.ajustarStock(venta.productoId, Number(venta.cantidad) || 0).catch((e) => console.warn(e));
  return { productoId: venta.productoId || null, productoExiste: !!producto, regresoInventario: datos.regresoInventario };
}

// Corrige una venta: cantidad, precio por unidad y cliente.
async function corregirVenta(id, datos) {
  const cantidad = Number(String(datos.cantidad ?? '').trim());
  if (!Number.isInteger(cantidad) || cantidad < 1) throw new Error('La cantidad debe ser un número entero, mayor o igual a 1.');
  const precioTxt = String(datos.precioVenta ?? '').trim();
  const precio = Number(precioTxt);
  if (precioTxt === '' || !Number.isFinite(precio) || precio < 0) throw new Error('Escribe el precio de venta por unidad.');
  const cambios = { cantidad, precioUnitario: Math.round(precio * 100) / 100, clienteId: datos.clienteId || null };
  const datosCorreccion = { corregidaEl: new Date().toISOString(), corregidaPor: usuarioVentas() };
  const traducir = (err) => {
    if (err.code === 'ya-anulada') return new Error('Esta venta fue anulada; ya no se puede corregir.');
    if (err.code === 'ya-corregida') return new Error('Esta venta ya fue corregida (quizás desde el otro celular). Corrige la versión nueva.');
    if (err.code === 'no-existe') return new Error('Esta venta ya no existe.');
    if (err.code === 'sin-stock') return new Error(`No hay existencias suficientes para subir la cantidad. Solo quedan ${err.stock} en inventario.`);
    if (err.code === 'producto-no-existe') return new Error('El producto ya no existe en el inventario: solo se puede corregir el precio o el cliente, no la cantidad.');
    return new Error(DB.mensajeDeError(err));
  };
  let r;
  try {
    r = await DB.corregirVentaEnTransaccion(id, cambios, datosCorreccion, navigator.onLine);
  } catch (err) {
    if (!navigator.onLine || !DB.esErrorDeConexion(err) || ['ya-anulada', 'ya-corregida', 'no-existe', 'sin-stock', 'producto-no-existe'].includes(err.code)) throw traducir(err);
    try { r = await DB.corregirVentaEnTransaccion(id, cambios, datosCorreccion, false); } catch (e2) { throw traducir(e2); }
  }
  if (r.productoExiste) Catalogo.actualizarDisponibilidad(r.productoId).catch((e) => console.warn(e));
  return r;
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
  corregirVenta,
  MOTIVOS_ANULAR,
  resumen,
};
