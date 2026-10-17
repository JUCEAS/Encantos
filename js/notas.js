// notas.js — Notas compartidas entre las dos personas del vivero.
// Cada nota tiene texto, fecha y hora, una marca de "importante" y se puede
// editar, cerrar (queda en el historial) o eliminar. No envía avisos.

async function guardarNota(datos) {
  const nota = {
    texto: (datos.texto || '').trim(),
    importante: !!datos.importante,
    cerrada: !!datos.cerrada,
    cerradaEl: datos.cerrada ? (datos.cerradaEl || new Date().toISOString()) : null,
    // Al editar se conserva la fecha y hora originales de la nota.
    creadoEl: datos.creadoEl || new Date().toISOString(),
  };
  if (datos.id) {
    nota.id = datos.id;
    await DB.actualizar(DB.STORES.notas, nota);
    return nota;
  }
  nota.id = await DB.agregar(DB.STORES.notas, nota);
  return nota;
}

// Pendientes primero (importantes arriba, luego las más recientes); cerradas al final.
async function listarNotas() {
  const notas = await DB.obtenerTodos(DB.STORES.notas);
  notas.sort((a, b) => {
    if (!!a.cerrada !== !!b.cerrada) return a.cerrada ? 1 : -1;
    if (!a.cerrada && !!a.importante !== !!b.importante) return a.importante ? -1 : 1;
    return new Date(b.creadoEl) - new Date(a.creadoEl);
  });
  return notas;
}

async function cambiarEstadoNota(id, cerrada) {
  return DB.actualizarCampos(DB.STORES.notas, id, {
    cerrada: !!cerrada,
    cerradaEl: cerrada ? new Date().toISOString() : null,
  });
}

async function eliminarNota(id) {
  return DB.eliminar(DB.STORES.notas, id);
}

window.Notas = { guardarNota, listarNotas, cambiarEstadoNota, eliminarNota };
