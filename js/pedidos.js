// pedidos.js — Encargos de clientes: qué pidió, cuánto dejó de adelanto y en
// qué etapa va (se pide al proveedor, llegó, se avisó al cliente, se entregó).

const ESTADOS_PEDIDO = [
  'Solicitado',
  'Pedido al proveedor',
  'Llegó',
  'Cliente avisado',
  'Entregado',
  'Cancelado',
];

// Estados en los que el pedido sigue "vivo" (falta entregarlo).
const ESTADOS_ACTIVOS = ['Solicitado', 'Pedido al proveedor', 'Llegó', 'Cliente avisado'];

function esPedidoActivo(pedido) {
  return ESTADOS_ACTIVOS.includes(pedido.estado);
}

async function guardarPedido(datos) {
  const cantidad = Math.max(1, parseInt(datos.cantidad, 10) || 1);
  const pedido = {
    catalogoId: datos.catalogoId || null,
    nombreProducto: datos.nombreProducto.trim(),
    proveedorId: datos.proveedorId || null,
    clienteId: datos.clienteId,
    nombreCliente: datos.nombreCliente || '',
    celularCliente: datos.celularCliente || '',
    cantidad,
    precioUnitario: parseFloat(datos.precioUnitario) || 0,
    costoUnitario: parseFloat(datos.costoUnitario) || 0,
    adelanto: parseFloat(datos.adelanto) || 0,
    fechaEstimada: datos.fechaEstimada || '',
    estado: datos.estado || 'Solicitado',
    notas: (datos.notas || '').trim(),
    ventaId: datos.ventaId || null,
    entregadoEl: datos.entregadoEl || null,
    creadoEl: datos.creadoEl || new Date().toISOString(),
  };
  // Devuelve el pedido ya normalizado (números como números, con su id).
  if (datos.id) {
    pedido.id = datos.id;
    await DB.actualizar(DB.STORES.pedidos, pedido);
    return pedido;
  }
  pedido.id = await DB.agregar(DB.STORES.pedidos, pedido);
  return pedido;
}

async function listarPedidos() {
  const pedidos = await DB.obtenerTodos(DB.STORES.pedidos);
  pedidos.sort((a, b) => new Date(b.creadoEl) - new Date(a.creadoEl));
  return pedidos;
}

async function eliminarPedido(id) {
  return DB.eliminar(DB.STORES.pedidos, id);
}

function totalPedido(p) {
  return (p.precioUnitario || 0) * (p.cantidad || 0);
}

function saldoPedido(p) {
  return Math.max(0, totalPedido(p) - (p.adelanto || 0));
}

// Entrega el pedido: registra la venta (con su ganancia) y lo marca entregado.
async function entregarPedido(pedido) {
  const ventaId = await Ventas.registrarVentaDePedido(pedido);
  await DB.actualizarCampos(DB.STORES.pedidos, pedido.id, {
    estado: 'Entregado',
    ventaId,
    entregadoEl: new Date().toISOString(),
  });
  return ventaId;
}

window.Pedidos = {
  ESTADOS_PEDIDO,
  ESTADOS_ACTIVOS,
  esPedidoActivo,
  guardarPedido,
  listarPedidos,
  eliminarPedido,
  totalPedido,
  saldoPedido,
  entregarPedido,
};
