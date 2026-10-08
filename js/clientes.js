// clientes.js — Registro de clientes e historial de compras

const TIPOS_CLIENTE = [
  { id: 'normal', texto: 'Normal', emoji: '' },
  { id: 'coleccionista', texto: 'Coleccionista', emoji: '💎' },
  { id: 'mayorista', texto: 'Mayorista (vivero, paisajista, revendedor)', emoji: '🏪' },
];

// Rasgos que buscan los coleccionistas, además de las categorías de plantas
const INTERESES_EXTRA = ['Variegadas', 'Raras / de colección', 'Ejemplares grandes', 'Híbridos'];

function tipoDe(c) { return TIPOS_CLIENTE.find((t) => t.id === (c && c.tipo)) || TIPOS_CLIENTE[0]; }

function normalizarTexto(t) {
  return String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

// ¿Qué clientes están interesados en estas plantas?
// productos = [{ nombre, categoria }]. Devuelve [{ cliente, motivos, plantas }]
function interesadosEn(productos, clientes) {
  const resultado = [];
  // Cualquier cliente con plantas buscadas o categorías marcadas
  clientes.filter((c) => (c.deseos || []).length || (c.intereses || []).length).forEach((c) => {
    const motivos = new Set();
    const plantas = new Set();
    const deseos = (c.deseos || []).map((d) => ({ d, n: normalizarTexto(d) })).filter((x) => x.n.length >= 3);
    const intereses = new Set((c.intereses || []).map(normalizarTexto));
    productos.forEach((p) => {
      const nombre = normalizarTexto(p.nombre);
      deseos.forEach(({ d, n }) => {
        if (nombre.includes(n) || n.includes(nombre)) { motivos.add(`busca "${d}"`); plantas.add(p.nombre); }
      });
      const cat = Inventario.infoCategoria(p.categoria).nombre;
      if (intereses.has(normalizarTexto(cat))) { motivos.add(`le interesa ${cat}`); plantas.add(p.nombre); }
    });
    if (plantas.size) resultado.push({ cliente: c, motivos: [...motivos], plantas: [...plantas] });
  });
  // Primero los que buscan la planta exacta
  return resultado.sort((a, b) => (b.motivos.some((m) => m.startsWith('busca')) ? 1 : 0) - (a.motivos.some((m) => m.startsWith('busca')) ? 1 : 0));
}

async function guardarCliente(datos) {
  const cliente = {
    nombre: datos.nombre.trim(),
    celular: (datos.celular || '').trim(),
    notas: (datos.notas || '').trim(),
    // Tipo de cliente: normal, coleccionista o mayorista
    tipo: TIPOS_CLIENTE.some((t) => t.id === datos.tipo) ? datos.tipo : 'normal',
    // Lo que colecciona (categorías o rasgos) y las plantas que anda buscando
    intereses: Array.isArray(datos.intereses) ? datos.intereses.slice(0, 40) : [],
    deseos: (Array.isArray(datos.deseos) ? datos.deseos : String(datos.deseos || '').split(/[\n,;]+/))
      .map((d) => d.trim()).filter(Boolean).slice(0, 50),
    // Al editar, se conserva la fecha original de registro del cliente
    // (no se debe "reiniciar" cada vez que se corrige un dato).
    creadoEl: datos.creadoEl || new Date().toISOString(),
  };
  if (datos.id) {
    // Se conservan los demás datos guardados (por ejemplo, el último catálogo enviado)
    const previo = (await DB.obtener(DB.STORES.clientes, datos.id)) || {};
    const { id: _id, ...resto } = previo;
    return DB.actualizar(DB.STORES.clientes, { ...resto, ...cliente, id: datos.id });
  }
  return DB.agregar(DB.STORES.clientes, cliente);
}

// Número para WhatsApp: solo dígitos y con código de Honduras (504) si hace falta.
// Devuelve '' si no parece un número válido.
function numeroWhatsApp(celular) {
  let n = String(celular || '').replace(/\D/g, '');
  if (n.startsWith('00')) n = n.slice(2);
  if (n.length === 8) n = '504' + n;
  return n.length >= 10 && n.length <= 15 ? n : '';
}

// Guarda en la ficha del cliente qué catálogos se le enviaron y cuándo
async function registrarEnvioCatalogo(id, catalogos) {
  const previo = await DB.obtener(DB.STORES.clientes, id);
  if (!previo) return;
  const u = (window.firebase && firebase.auth && firebase.auth().currentUser) || null;
  const { id: _id, ...resto } = previo;
  return DB.actualizar(DB.STORES.clientes, {
    ...resto,
    id,
    ultimoCatalogo: { fecha: new Date().toISOString(), catalogos, por: (u && u.email) || '' },
  });
}

async function actualizarCelular(id, celular) {
  const previo = await DB.obtener(DB.STORES.clientes, id);
  if (!previo) return;
  const { id: _id, ...resto } = previo;
  return DB.actualizar(DB.STORES.clientes, { ...resto, id, celular: String(celular || '').trim() });
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
    .filter((v) => v.clienteId === clienteId && !v.anulada && !v.corregida)
    .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
    .map((v) => ({
      ...v,
      nombreProducto: mapaProductos.get(v.productoId)?.nombre || '(producto eliminado)',
    }));
}

window.Clientes = {
  TIPOS_CLIENTE,
  INTERESES_EXTRA,
  tipoDe,
  interesadosEn,
  numeroWhatsApp,
  registrarEnvioCatalogo,
  actualizarCelular,
  guardarCliente,
  listarClientes,
  buscarClientes,
  eliminarCliente,
  historialDeCliente,
};
