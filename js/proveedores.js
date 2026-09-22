// proveedores.js — Registro de proveedores (para saber de dónde viene cada planta comprada)

async function guardarProveedor(datos) {
  const proveedor = {
    nombre: datos.nombre.trim(),
    empresa: (datos.empresa || '').trim(),
    telefono: (datos.telefono || '').trim(),
    direccion: (datos.direccion || '').trim(),
    // Al editar, se conserva la fecha original de registro (igual que con clientes).
    creadoEl: datos.creadoEl || new Date().toISOString(),
  };
  if (datos.id) {
    proveedor.id = datos.id;
    return DB.actualizar(DB.STORES.proveedores, proveedor);
  }
  return DB.agregar(DB.STORES.proveedores, proveedor);
}

async function listarProveedores() {
  const proveedores = await DB.obtenerTodos(DB.STORES.proveedores);
  proveedores.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
  return proveedores;
}

async function buscarProveedores(texto) {
  const proveedores = await listarProveedores();
  const q = texto.trim().toLowerCase();
  if (!q) return proveedores;
  return proveedores.filter(
    (p) =>
      (p.nombre || '').toLowerCase().includes(q) ||
      (p.empresa || '').toLowerCase().includes(q) ||
      (p.telefono || '').includes(q)
  );
}

async function eliminarProveedor(id) {
  return DB.eliminar(DB.STORES.proveedores, id);
}

window.Proveedores = {
  guardarProveedor,
  listarProveedores,
  buscarProveedores,
  eliminarProveedor,
};
