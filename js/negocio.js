// negocio.js — Datos públicos del negocio que muestra el catálogo:
// WhatsApp para recibir pedidos y datos de la cuenta para el adelanto.
// Los escribe el personal desde la app; nunca los inventa el programa.

async function obtenerNegocio() {
  const datos = await DB.obtenerDocumento(DB.COLECCION_CONFIG, DB.DOC_NEGOCIO);
  return datos || {};
}

async function guardarNegocio(datos) {
  await DB.guardarDocumento(DB.COLECCION_CONFIG, DB.DOC_NEGOCIO, {
    nombreNegocio: (datos.nombreNegocio || '').trim(),
    whatsapp: (datos.whatsapp || '').trim(),
    banco: (datos.banco || '').trim(),
    tipoCuenta: (datos.tipoCuenta || '').trim(),
    numeroCuenta: (datos.numeroCuenta || '').trim(),
    titularCuenta: (datos.titularCuenta || '').trim(),
    mensajeAdelanto: (datos.mensajeAdelanto || '').trim(),
    mostrarCuenta: datos.mostrarCuenta !== false,
    actualizadoEl: new Date().toISOString(),
  });
}

window.Negocio = { obtenerNegocio, guardarNegocio };
