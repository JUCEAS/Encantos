// compras.js — Compras de mercadería (plantas e insumos para vender).
//
// Cada compra suma existencias al producto y actualiza su costo con el
// COSTO PROMEDIO: si había 5 a L.50 y se compran 5 a L.70, el costo queda en
// L.60. Así la ganancia de cada venta refleja lo que realmente se pagó.

function redondear(n) { return Math.round((Number(n) || 0) * 100) / 100; }

// Costo promedio después de comprar. Un stock negativo (venta sin internet de
// más) se toma como 0 para no distorsionar el promedio.
function costoPromedio(stockActual, costoActual, cantidad, costoUnitario) {
  const stock = Math.max(0, Number(stockActual) || 0);
  const costo = Number(costoActual) || 0;
  if (stock + cantidad <= 0) return redondear(costoUnitario);
  // Si el producto no tenía costo registrado, se usa el de esta compra.
  if (stock > 0 && costo <= 0) return redondear(costoUnitario);
  return redondear((stock * costo + cantidad * costoUnitario) / (stock + cantidad));
}

// Costo al anular una compra: se quita esa compra del promedio.
function costoSinCompra(stockActual, costoActual, cantidad, costoUnitario, costoAnterior) {
  const stockRestante = (Number(stockActual) || 0) - cantidad;
  if (stockRestante <= 0) return redondear(costoAnterior);
  const costo = (Number(stockActual) * Number(costoActual) - cantidad * costoUnitario) / stockRestante;
  return costo > 0 ? redondear(costo) : redondear(costoAnterior);
}

function usuarioActual() {
  const u = (window.firebase && firebase.auth && firebase.auth().currentUser) || null;
  return (u && u.email) || '';
}

// datos = { productoId, proveedorId, cantidad, costoUnitario, fecha (AAAA-MM-DD), nota }
async function registrarCompra(datos) {
  const producto = await DB.obtener(DB.STORES.productos, datos.productoId);
  if (!producto) throw new Error('Elige el producto que compraste.');

  const cantidad = Number(String(datos.cantidad ?? '').trim());
  if (!Number.isInteger(cantidad) || cantidad < 1) throw new Error('La cantidad debe ser un número entero, mayor o igual a 1.');
  const costoUnitario = Number(String(datos.costoUnitario ?? '').trim());
  if (!Number.isFinite(costoUnitario) || costoUnitario < 0) throw new Error('Escribe el costo por unidad (puede ser 0).');

  let proveedor = null;
  if (datos.proveedorId) proveedor = await DB.obtener(DB.STORES.proveedores, datos.proveedorId);

  // La fecha elegida, a mediodía en hora local (para que no cambie de día)
  const hoy = new Date().toISOString().slice(0, 10);
  const dia = /^\d{4}-\d{2}-\d{2}$/.test(datos.fecha || '') ? datos.fecha : hoy;
  const fecha = new Date(dia + 'T12:00:00').toISOString();

  const compra = {
    productoId: producto.id,
    nombreProducto: producto.nombre,
    proveedorId: proveedor ? proveedor.id : null,
    nombreProveedor: proveedor ? proveedor.nombre : '',
    cantidad,
    costoUnitario: redondear(costoUnitario),
    total: redondear(cantidad * costoUnitario),
    nota: String(datos.nota || '').trim().slice(0, 200),
    fecha,
    registradaEl: new Date().toISOString(),
    registradaPor: usuarioActual(),
  };

  if (navigator.onLine) {
    try {
      const r = await DB.comprarEnTransaccion(producto.id, compra, costoPromedio);
      Catalogo.actualizarDisponibilidad(producto.id).catch((e) => console.warn('Catálogo no sincronizado', e));
      return { ...compra, ...r };
    } catch (err) {
      if (err.code === 'no-existe') throw new Error('Este producto ya no existe en el inventario.');
      if (!DB.esErrorDeConexion(err)) throw new Error(DB.mensajeDeError(err));
      console.warn('Compra atómica no disponible, se guarda sin conexión', err);
    }
  }

  // Sin internet: se guarda en el teléfono y se sincroniza al volver la señal.
  const nuevoCosto = costoPromedio(producto.stock, producto.costo, cantidad, compra.costoUnitario);
  const registro = { ...compra, stockAnterior: Number(producto.stock) || 0, costoAnterior: Number(producto.costo) || 0, costoNuevo: nuevoCosto };
  DB.agregar(DB.STORES.compras, registro).catch((e) => console.warn(e));
  const { id, ...resto } = producto;
  DB.actualizar(DB.STORES.productos, { id, ...resto, stock: (Number(producto.stock) || 0) + cantidad, costo: nuevoCosto }).catch((e) => console.warn(e));
  return registro;
}

async function listarCompras({ desde = null, hasta = null, incluirAnuladas = false } = {}) {
  let compras = await DB.obtenerTodos(DB.STORES.compras);
  if (!incluirAnuladas) compras = compras.filter((c) => !c.anulada);
  if (desde) compras = compras.filter((c) => new Date(c.fecha) >= new Date(desde + 'T00:00:00'));
  if (hasta) compras = compras.filter((c) => new Date(c.fecha) <= new Date(hasta + 'T23:59:59.999'));
  compras.sort((a, b) => new Date(b.fecha) - new Date(a.fecha) || new Date(b.registradaEl) - new Date(a.registradaEl));
  return compras;
}

// Anula una compra: la marca como anulada (no se borra), quita las unidades
// del stock y saca esa compra del costo promedio.
async function anularCompra(id) {
  const datos = { anuladaEl: new Date().toISOString(), anuladaPor: usuarioActual() };
  if (navigator.onLine) {
    try {
      const r = await DB.anularCompraEnTransaccion(id, datos, costoSinCompra);
      if (r.productoExiste) Catalogo.actualizarDisponibilidad(r.productoId).catch((e) => console.warn('Catálogo no sincronizado', e));
      return r;
    } catch (err) {
      if (err.code === 'ya-anulada') throw new Error('Esta compra ya estaba anulada (quizás desde el otro celular).');
      if (err.code === 'no-existe') throw new Error('Esta compra ya no existe.');
      if (err.code === 'stock-insuficiente') throw new Error(`No se puede anular: ya se vendieron unidades de esta compra (quedan ${err.stock} en stock). Si hubo un error, corrige el stock editando el producto.`);
      if (!DB.esErrorDeConexion(err)) throw new Error(DB.mensajeDeError(err));
      console.warn('Anulación atómica no disponible, se guarda sin conexión', err);
    }
  }
  const compra = await DB.obtener(DB.STORES.compras, id);
  if (!compra) throw new Error('Esta compra ya no existe.');
  if (compra.anulada) throw new Error('Esta compra ya estaba anulada.');
  const producto = compra.productoId ? await DB.obtener(DB.STORES.productos, compra.productoId) : null;
  if (producto && (Number(producto.stock) || 0) < compra.cantidad) {
    throw new Error(`No se puede anular: ya se vendieron unidades de esta compra (quedan ${Number(producto.stock) || 0} en stock). Si hubo un error, corrige el stock editando el producto.`);
  }
  DB.actualizar(DB.STORES.compras, { ...compra, anulada: true, ...datos }).catch((e) => console.warn(e));
  if (producto) {
    const costo = costoSinCompra(producto.stock, producto.costo, compra.cantidad, compra.costoUnitario, compra.costoAnterior);
    const { id: pid, ...resto } = producto;
    DB.actualizar(DB.STORES.productos, { id: pid, ...resto, stock: (Number(producto.stock) || 0) - compra.cantidad, costo }).catch((e) => console.warn(e));
  }
  return { productoId: compra.productoId || null, productoExiste: !!producto };
}

async function totalComprado({ desde = null, hasta = null } = {}) {
  const compras = await listarCompras({ desde, hasta });
  return { compras, total: compras.reduce((s, c) => s + (Number(c.total) || 0), 0) };
}

window.Compras = {
  registrarCompra,
  listarCompras,
  anularCompra,
  totalComprado,
  costoPromedio,
  costoSinCompra,
};
