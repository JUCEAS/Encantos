// gastos.js — Gastos del negocio (lo que se paga para operar y NO se vuelve
// inventario): luz, agua, bolsas, transporte de entregas, pago a vendedoras...
//
// OJO: las COMPRAS de mercadería no son gastos. Se vuelven inventario y su
// costo se descuenta solo cuando la planta se vende ("costo de lo vendido").
// El transporte de una compra ya va incluido en el costo de esa compra.

const CATEGORIAS_GASTO = [
  { id: 'empaque', texto: 'Bolsas, macetas de entrega y empaque', emoji: '🛍️' },
  { id: 'transporte', texto: 'Transporte y entregas (no de compras)', emoji: '🚚' },
  { id: 'salarios', texto: 'Pago a vendedoras y ayudantes', emoji: '👩‍🌾' },
  { id: 'alquiler', texto: 'Alquiler del local o terreno', emoji: '🏠' },
  { id: 'luz', texto: 'Luz', emoji: '💡' },
  { id: 'agua', texto: 'Agua', emoji: '🚰' },
  { id: 'telefono', texto: 'Teléfono e internet', emoji: '📱' },
  { id: 'publicidad', texto: 'Publicidad y redes sociales', emoji: '📣' },
  { id: 'mantenimiento', texto: 'Mantenimiento, herramientas y riego', emoji: '🧰' },
  { id: 'comisiones', texto: 'Comisiones bancarias y de cobro', emoji: '🏦' },
  { id: 'impuestos', texto: 'Impuestos, permisos y trámites', emoji: '🧾' },
  { id: 'otros', texto: 'Otros gastos', emoji: '📝' },
];

const MOTIVOS_ANULAR_GASTO = [
  { id: 'error', texto: '✍️ Error al registrar o gasto duplicado' },
  { id: 'devuelto', texto: '💵 Nos devolvieron el dinero' },
  { id: 'otro', texto: '📝 Otro motivo' },
];

function categoriaGasto(id) {
  return CATEGORIAS_GASTO.find((c) => c.id === id) || CATEGORIAS_GASTO[CATEGORIAS_GASTO.length - 1];
}

function hoyLocal() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// datos = { fecha (AAAA-MM-DD), categoria, descripcion, monto }
async function registrarGasto(datos) {
  const montoTxt = String(datos.monto ?? '').trim();
  const monto = Number(montoTxt);
  if (montoTxt === '' || !Number.isFinite(monto) || monto <= 0) throw new Error('Escribe cuánto se pagó (mayor que cero).');
  const fecha = String(datos.fecha || '').trim() || hoyLocal();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new Error('La fecha no es válida.');
  if (fecha > hoyLocal()) throw new Error('La fecha no puede ser en el futuro.');
  const categoria = categoriaGasto(datos.categoria).id;
  const descripcion = String(datos.descripcion || '').trim().slice(0, 200);
  if (categoria === 'otros' && !descripcion) throw new Error('Escribe en qué se gastó.');
  return DB.agregar(DB.STORES.gastos, {
    // Se guarda al mediodía para que la fecha no cambie por la zona horaria
    fecha: new Date(fecha + 'T12:00:00').toISOString(),
    categoria,
    descripcion,
    monto: Math.round(monto * 100) / 100,
    registradoPor: DB.correoActual(),
    registradoEl: new Date().toISOString(),
  });
}

async function anularGasto(id, opciones = {}) {
  const motivo = MOTIVOS_ANULAR_GASTO.find((m) => m.id === opciones.motivo);
  if (!motivo) throw new Error('Elige el motivo de la anulación.');
  const nota = String(opciones.nota || '').trim().slice(0, 300);
  if (motivo.id === 'otro' && !nota) throw new Error('Escribe en la nota cuál fue el motivo.');
  const gasto = await DB.obtener(DB.STORES.gastos, id);
  if (!gasto) throw new Error('Este gasto ya no existe.');
  if (gasto.anulado) throw new Error('Este gasto ya estaba anulado.');
  // Sin internet la promesa no termina hasta que vuelve la señal: no se espera
  const p = DB.actualizarCampos(DB.STORES.gastos, id, {
    anulado: true,
    anuladoEl: new Date().toISOString(),
    anuladoPor: DB.correoActual(),
    motivoAnulacion: motivo.texto,
    notaAnulacion: nota,
  });
  if (navigator.onLine) await p; else p.catch((e) => console.warn(e));
}

async function listarGastos({ desde = null, hasta = null, incluirAnulados = false } = {}) {
  let gastos = await DB.obtenerTodos(DB.STORES.gastos);
  if (!incluirAnulados) gastos = gastos.filter((g) => !g.anulado);
  if (desde) gastos = gastos.filter((g) => new Date(g.fecha) >= new Date(desde + 'T00:00:00'));
  if (hasta) gastos = gastos.filter((g) => new Date(g.fecha) <= new Date(hasta + 'T23:59:59.999'));
  gastos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha) || new Date(b.registradoEl) - new Date(a.registradoEl));
  return gastos;
}

window.Gastos = {
  CATEGORIAS_GASTO,
  MOTIVOS_ANULAR_GASTO,
  categoriaGasto,
  registrarGasto,
  anularGasto,
  listarGastos,
  hoyLocal,
};
