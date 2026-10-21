// encargos.js — Catálogo de encargos: plantas que NO están en stock pero que
// los clientes pueden pedir para que las traigamos. Lo que se guarda aquí es
// lo que verá el público en catalogo.html, así que nunca incluye costos.

async function guardarItemCatalogo(datos) {
  const item = {
    nombre: datos.nombre.trim(),
    categoria: datos.categoria || '',
    descripcion: (datos.descripcion || '').trim(),
    tipoSol: datos.tipoSol || '',
    riego: datos.riego || '',
    precio: parseFloat(datos.precio) || 0,
    tiempoEntrega: (datos.tiempoEntrega || '').trim(),
    proveedorId: datos.proveedorId || null,
    visible: datos.visible !== false,
    foto: datos.foto || null,
    // Al editar se conserva la fecha original de alta.
    creadoEl: datos.creadoEl || new Date().toISOString(),
  };
  if (datos.id) {
    item.id = datos.id;
    return DB.actualizar(DB.STORES.encargos, item);
  }
  return DB.agregar(DB.STORES.encargos, item);
}

async function listarCatalogo() {
  const items = await DB.obtenerTodos(DB.STORES.encargos);
  items.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
  return items;
}

async function buscarEnCatalogo(texto) {
  const items = await listarCatalogo();
  const q = texto.trim().toLowerCase();
  if (!q) return items;
  return items.filter(
    (i) =>
      (i.nombre || '').toLowerCase().includes(q) ||
      (i.descripcion || '').toLowerCase().includes(q) ||
      (i.categoria || '').toLowerCase().includes(q)
  );
}

async function eliminarItemCatalogo(id) {
  return DB.eliminar(DB.STORES.encargos, id);
}

window.Encargos = {
  guardarItemCatalogo,
  listarCatalogo,
  buscarEnCatalogo,
  eliminarItemCatalogo,
};
