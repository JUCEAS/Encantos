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

// ---------- Facturas (varios productos + transporte) ----------

// Reparte el transporte entre los productos SEGÚN SU VALOR: si una planta es
// el 60% del valor de la factura, le toca el 60% del transporte. Si todo vino
// a costo 0, se reparte por unidades. El resultado es el costo final por
// unidad, que es el que entra al costo promedio y a la ganancia.
function repartirTransporte(lineas, transporte) {
  const t = Math.max(0, Number(transporte) || 0);
  const valor = lineas.reduce((s, l) => s + l.cantidad * l.costoUnitario, 0);
  const unidades = lineas.reduce((s, l) => s + l.cantidad, 0);
  return lineas.map((l) => {
    const subtotal = l.cantidad * l.costoUnitario;
    const parte = t > 0 ? (valor > 0 ? (t * subtotal) / valor : (t * l.cantidad) / (unidades || 1)) : 0;
    return {
      ...l,
      subtotal: redondear(subtotal),
      transporte: redondear(parte),
      costoFinalUnit: redondear(l.costoUnitario + (l.cantidad ? parte / l.cantidad : 0)),
    };
  });
}

// Una compra vieja (un solo producto) se ve como una factura de una línea.
function lineasDe(c) {
  if (Array.isArray(c.lineas)) return c.lineas;
  return [{
    productoId: c.productoId, nombreProducto: c.nombreProducto, cantidad: Number(c.cantidad) || 0,
    costoUnitario: Number(c.costoUnitario) || 0, transporte: 0, costoFinalUnit: Number(c.costoUnitario) || 0,
    subtotal: Number(c.total) || 0, stockAnterior: c.stockAnterior, costoAnterior: c.costoAnterior,
  }];
}
function unidadesDe(c) { return lineasDe(c).reduce((s, l) => s + (Number(l.cantidad) || 0), 0); }

const MAX_LINEAS = 200;

// datos = { proveedorId, fecha, numeroFactura, nota, transporte,
//           lineas: [{ productoId | null, nombre, cantidad, costoUnitario, nuevo: { categoria, precio } }] }
// Valida los datos del formulario y arma la factura (sin guardarla)
async function prepararFactura(datos) {
  const filas = datos.lineas || [];
  if (!filas.length) throw new Error('Agrega al menos un producto a la factura.');
  if (filas.length > MAX_LINEAS) throw new Error(`Una factura puede tener hasta ${MAX_LINEAS} productos. Divídela en dos.`);
  const transporte = Number(String(datos.transporte ?? '').trim() || 0);
  if (!Number.isFinite(transporte) || transporte < 0) throw new Error('El costo de transporte no es válido.');

  const productos = await DB.obtenerTodos(DB.STORES.productos);
  const porId = new Map(productos.map((p) => [p.id, p]));
  const vistos = new Map();
  const lineas = filas.map((f, i) => {
    const n = i + 1;
    const nombre = String(f.nombre || '').trim();
    const producto = f.productoId ? porId.get(f.productoId) : null;
    if (f.productoId && !producto) throw new Error(`Fila ${n}: ese producto ya no existe en el inventario.`);
    if (!producto && !nombre) throw new Error(`Fila ${n}: escribe el nombre de la planta o producto.`);
    const cantidad = Number(String(f.cantidad ?? '').trim());
    if (!Number.isInteger(cantidad) || cantidad < 1) throw new Error(`Fila ${n}: la cantidad debe ser un número entero, mayor o igual a 1.`);
    const costoTxt = String(f.costoUnitario ?? '').trim();
    const costoUnitario = Number(costoTxt);
    if (costoTxt === '' || !Number.isFinite(costoUnitario) || costoUnitario < 0) throw new Error(`Fila ${n}: escribe el costo por unidad (puede ser 0).`);
    const clave = producto ? 'id:' + producto.id : 'nuevo:' + nombre.toLowerCase();
    if (vistos.has(clave)) throw new Error(`"${producto ? producto.nombre : nombre}" está repetido en las filas ${vistos.get(clave)} y ${n}. Suma las cantidades en una sola fila.`);
    vistos.set(clave, n);
    let nuevoProducto = null;
    if (!producto) {
      const categoria = f.nuevo && f.nuevo.categoria;
      if (!categoria || !Inventario.CATEGORIAS.includes(categoria)) throw new Error(`Fila ${n}: "${nombre}" es nuevo. Elige su categoría.`);
      const precio = Number(String((f.nuevo && f.nuevo.precio) ?? '').trim() || 0);
      if (!Number.isFinite(precio) || precio < 0) throw new Error(`Fila ${n}: el precio de venta no es válido.`);
      nuevoProducto = {
        nombre, categoria, descripcion: '', nombreCientifico: '', tipoSol: '', riego: '', ubicacion: '',
        dificultad: '', mascotas: '', tamanoMaceta: '', tamanoAdulto: '', etiquetas: [], publicarCatalogo: false,
        origen: datos.proveedorId ? 'Compra a proveedor' : '', proveedorId: datos.proveedorId || null,
        precio: redondear(precio), foto: null, embedding: null, creadoEl: new Date().toISOString(),
      };
    }
    return {
      productoId: producto ? producto.id : null,
      nombreProducto: producto ? producto.nombre : nombre,
      cantidad,
      costoUnitario: redondear(costoUnitario),
      nuevoProducto,
    };
  });

  let proveedor = null;
  if (datos.proveedorId) proveedor = await DB.obtener(DB.STORES.proveedores, datos.proveedorId);
  const hoy = new Date().toISOString().slice(0, 10);
  const dia = /^\d{4}-\d{2}-\d{2}$/.test(datos.fecha || '') ? datos.fecha : hoy;

  const conTransporte = repartirTransporte(lineas, transporte);
  const totalProductos = redondear(conTransporte.reduce((s, l) => s + l.subtotal, 0));
  const factura = {
    tipo: 'factura',
    proveedorId: proveedor ? proveedor.id : null,
    nombreProveedor: proveedor ? proveedor.nombre : '',
    numeroFactura: String(datos.numeroFactura || '').trim().slice(0, 40),
    nota: String(datos.nota || '').trim().slice(0, 200),
    fecha: new Date(dia + 'T12:00:00').toISOString(),
    transporte: redondear(transporte),
    totalProductos,
    total: redondear(totalProductos + transporte),
    unidades: conTransporte.reduce((s, l) => s + l.cantidad, 0),
    lineas: conTransporte,
    registradaEl: new Date().toISOString(),
    registradaPor: usuarioActual(),
  };

  return factura;
}

async function registrarFactura(datos) {
  const factura = await prepararFactura(datos);
  let resultado;
  try {
    resultado = await DB.guardarFacturaCompra(factura, costoPromedio, navigator.onLine);
  } catch (err) {
    if (err.code === 'no-existe') throw new Error(`"${err.nombre}" ya no existe en el inventario. Revisa esa fila.`);
    if (!navigator.onLine || !DB.esErrorDeConexion(err)) throw new Error(DB.mensajeDeError(err));
    console.warn('Factura sin conexión: se guarda en el teléfono', err);
    resultado = await DB.guardarFacturaCompra(factura, costoPromedio, false);
  }
  resultado.lineas.forEach((l) => {
    if (!l.creadoEnFactura) Catalogo.actualizarDisponibilidad(l.productoId).catch((e) => console.warn('Catálogo no sincronizado', e));
  });
  return resultado;
}

// Corrige una compra ya guardada: deshace la original y guarda la corregida.
async function corregirFactura(idOriginal, datos) {
  const factura = await prepararFactura(datos);
  const fn = {
    costoPromedio,
    costoSinCompra,
    normalizar: lineasDe,
    datosCorreccion: { corregidaEl: new Date().toISOString(), corregidaPor: usuarioActual() },
  };
  const traducir = (err) => {
    if (err.code === 'ya-anulada') return new Error('Esta compra fue anulada; ya no se puede corregir.');
    if (err.code === 'ya-corregida') return new Error('Esta compra ya fue corregida (quizás desde el otro celular). Corrige la versión nueva.');
    if (err.code === 'no-existe') return new Error(err.nombre ? `"${err.nombre}" ya no existe en el inventario. Revisa esa fila.` : 'Esta compra ya no existe.');
    if (err.code === 'stock-insuficiente') return new Error(`No se puede guardar la corrección: el stock quedaría en negativo porque ya se vendieron unidades:\n• ${err.detalle.join('\n• ')}\nRevisa esas cantidades.`);
    return new Error(DB.mensajeDeError(err));
  };
  let r;
  try {
    r = await DB.corregirFacturaCompra(idOriginal, factura, fn, navigator.onLine);
  } catch (err) {
    if (!navigator.onLine || !DB.esErrorDeConexion(err) || ['ya-anulada', 'ya-corregida', 'no-existe', 'stock-insuficiente'].includes(err.code)) throw traducir(err);
    try { r = await DB.corregirFacturaCompra(idOriginal, factura, fn, false); } catch (e2) { throw traducir(e2); }
  }
  r.productosAfectados.forEach((pid) => Catalogo.actualizarDisponibilidad(pid).catch((e) => console.warn(e)));
  return r;
}

async function anularFactura(id) {
  const datos = { anuladaEl: new Date().toISOString(), anuladaPor: usuarioActual() };
  const traducir = (err) => {
    if (err.code === 'ya-anulada') return new Error('Esta compra ya estaba anulada (quizás desde el otro celular).');
    if (err.code === 'no-existe') return new Error('Esta compra ya no existe.');
    if (err.code === 'stock-insuficiente') return new Error(`No se puede anular: ya se vendieron unidades de esta factura:\n• ${err.detalle.join('\n• ')}\nSi hubo un error, corrige el stock editando esos productos.`);
    return new Error(DB.mensajeDeError(err));
  };
  let r;
  try {
    r = await DB.anularFacturaCompra(id, datos, costoSinCompra, navigator.onLine);
  } catch (err) {
    if (!navigator.onLine || !DB.esErrorDeConexion(err) || ['ya-anulada', 'no-existe', 'stock-insuficiente'].includes(err.code)) throw traducir(err);
    try { r = await DB.anularFacturaCompra(id, datos, costoSinCompra, false); } catch (e2) { throw traducir(e2); }
  }
  r.productosAfectados.forEach((pid) => Catalogo.actualizarDisponibilidad(pid).catch((e) => console.warn(e)));
  return r;
}

async function listarCompras({ desde = null, hasta = null, incluirAnuladas = false } = {}) {
  let compras = await DB.obtenerTodos(DB.STORES.compras);
  // Anuladas y corregidas se conservan como historial, pero no cuentan
  if (!incluirAnuladas) compras = compras.filter((c) => !c.anulada && !c.corregida);
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
  MAX_LINEAS,
  registrarFactura,
  corregirFactura,
  anularFactura,
  repartirTransporte,
  lineasDe,
  unidadesDe,
  registrarCompra,
  listarCompras,
  anularCompra,
  totalComprado,
  costoPromedio,
  costoSinCompra,
};
