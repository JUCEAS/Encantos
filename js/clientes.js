// clientes.js — Registro de clientes e historial de compras

async function guardarCliente(datos) {
  const cliente = {
    nombre: datos.nombre.trim(),
    celular: (datos.celular || '').trim(),
    notas: (datos.notas || '').trim(),
    creadoEl: new Date().toISOString(),
  };
  if (datos.id) {
    cliente.id = datos.id;
    return DB.actualizar(DB.STORES.clientes, cliente);
  }
  return DB.agregar(DB.STORES.clientes, cliente);
}

async function listarClientes() {
  const clientes = await DB.obtenerTodos(DB.STORES.clientes);
  clientes.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
  return clientes;
}

async function buscarClientes(texto) {
  const clientes = await listarClientes();
  const q = texto.trim().toLowerCase();
  if (!q) return clientes;
  return clientes.filter(
    (c) => (c.nombre || '').toLowerCase().includes(q) || (c.celular || '').includes(q)
  );
}

async function eliminarCliente(id) {
  return DB.eliminar(DB.STORES.clientes, id);
}

async function historialDeCliente(clienteId) {
  const ventas = await DB.obtenerTodos(DB.STORES.ventas);
  const productos = await DB.obtenerTodos(DB.STORES.productos);
  const mapaProductos = new Map(productos.map((p) => [p.id, p]));

  return ventas
    .filter((v) => v.clienteId === clienteId)
    .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
    .map((v) => ({
      ...v,
      nombreProducto: mapaProductos.get(v.productoId)?.nombre || '(producto eliminado)',
    }));
}

window.Clientes = {
  guardarCliente,
  listarClientes,
  buscarClientes,
  eliminarCliente,
  historialDeCliente,
};
