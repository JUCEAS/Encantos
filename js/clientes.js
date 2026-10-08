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

// ---------- Ubicación: departamentos y municipios de Honduras (298) ----------
const DEPARTAMENTOS_HN = {
  'Atlántida': ['Arizona', 'El Porvenir', 'Esparta', 'Jutiapa', 'La Ceiba', 'La Masica', 'San Francisco', 'Tela'],
  'Choluteca': ['Apacilagua', 'Choluteca', 'Concepción de María', 'Duyure', 'El Corpus', 'El Triunfo', 'Marcovia', 'Morolica', 'Namasigüe', 'Orocuina', 'Pespire', 'San Antonio de Flores', 'San Isidro', 'San José', 'San Marcos de Colón', 'Santa Ana de Yusguare'],
  'Colón': ['Balfate', 'Bonito Oriental', 'Iriona', 'Limón', 'Sabá', 'Santa Fe', 'Santa Rosa de Aguán', 'Sonaguera', 'Tocoa', 'Trujillo'],
  'Comayagua': ['Ajuterique', 'Comayagua', 'El Rosario', 'Esquías', 'Humuya', 'La Libertad', 'La Trinidad', 'Lamaní', 'Las Lajas', 'Lejamaní', 'Meámbar', 'Minas de Oro', 'Ojos de Agua', 'San Jerónimo', 'San José de Comayagua', 'San José del Potrero', 'San Luis', 'San Sebastián', 'Siguatepeque', 'Taulabé', 'Villa de San Antonio'],
  'Copán': ['Cabañas', 'Concepción', 'Copán Ruinas', 'Corquín', 'Cucuyagua', 'Dolores', 'Dulce Nombre', 'El Paraíso', 'Florida', 'La Jigua', 'La Unión', 'Nueva Arcadia', 'San Agustín', 'San Antonio', 'San Jerónimo', 'San José', 'San Juan de Opoa', 'San Nicolás', 'San Pedro', 'Santa Rita', 'Santa Rosa de Copán', 'Trinidad de Copán', 'Veracruz'],
  'Cortés': ['Choloma', 'La Lima', 'Omoa', 'Pimienta', 'Potrerillos', 'Puerto Cortés', 'San Antonio de Cortés', 'San Francisco de Yojoa', 'San Manuel', 'San Pedro Sula', 'Santa Cruz de Yojoa', 'Villanueva'],
  'El Paraíso': ['Alauca', 'Danlí', 'El Paraíso', 'Güinope', 'Jacaleapa', 'Liure', 'Morocelí', 'Oropolí', 'Potrerillos', 'San Antonio de Flores', 'San Lucas', 'San Matías', 'Soledad', 'Teupasenti', 'Texiguat', 'Trojes', 'Vado Ancho', 'Yauyupe', 'Yuscarán'],
  'Francisco Morazán': ['Alubarén', 'Cedros', 'Curarén', 'Distrito Central (Tegucigalpa)', 'El Porvenir', 'Guaimaca', 'La Libertad', 'La Venta', 'Lepaterique', 'Maraita', 'Marale', 'Nueva Armenia', 'Ojojona', 'Orica', 'Reitoca', 'Sabanagrande', 'San Antonio de Oriente', 'San Buenaventura', 'San Ignacio', 'San Juan de Flores', 'San Miguelito', 'Santa Ana', 'Santa Lucía', 'Talanga', 'Tatumbla', 'Valle de Ángeles', 'Vallecillo', 'Villa de San Francisco'],
  'Gracias a Dios': ['Ahuas', 'Brus Laguna', 'Juan Francisco Bulnes', 'Puerto Lempira', 'Ramón Villeda Morales', 'Wampusirpi'],
  'Intibucá': ['Camasca', 'Colomoncagua', 'Concepción', 'Dolores', 'Intibucá', 'Jesús de Otoro', 'La Esperanza', 'Magdalena', 'Masaguara', 'San Antonio', 'San Francisco de Opalaca', 'San Isidro', 'San Juan', 'San Marcos de la Sierra', 'San Miguel Guancapla', 'Santa Lucía', 'Yamaranguila'],
  'Islas de la Bahía': ['Guanaja', 'José Santos Guardiola', 'Roatán', 'Utila'],
  'La Paz': ['Aguanqueterique', 'Cabañas', 'Cane', 'Chinacla', 'Guajiquiro', 'La Paz', 'Lauterique', 'Marcala', 'Mercedes de Oriente', 'Opatoro', 'San Antonio del Norte', 'San José', 'San Juan', 'San Pedro de Tutule', 'Santa Ana', 'Santa Elena', 'Santa María', 'Santiago de Puringla', 'Yarula'],
  'Lempira': ['Belén', 'Candelaria', 'Cololaca', 'Erandique', 'Gracias', 'Gualcince', 'Guarita', 'La Campa', 'La Iguala', 'La Unión', 'La Virtud', 'Las Flores', 'Lepaera', 'Mapulaca', 'Piraera', 'San Andrés', 'San Francisco', 'San Juan Guarita', 'San Manuel Colohete', 'San Marcos de Caiquín', 'San Rafael', 'San Sebastián', 'Santa Cruz', 'Talgua', 'Tambla', 'Tomalá', 'Valladolid', 'Virginia'],
  'Ocotepeque': ['Belén Gualcho', 'Concepción', 'Dolores Merendón', 'Fraternidad', 'La Encarnación', 'La Labor', 'Lucerna', 'Mercedes', 'Ocotepeque', 'San Fernando', 'San Francisco del Valle', 'San Jorge', 'San Marcos', 'Santa Fe', 'Sensenti', 'Sinuapa'],
  'Olancho': ['Campamento', 'Catacamas', 'Concordia', 'Dulce Nombre de Culmí', 'El Rosario', 'Esquipulas del Norte', 'Gualaco', 'Guarizama', 'Guata', 'Guayape', 'Jano', 'Juticalpa', 'La Unión', 'Mangulile', 'Manto', 'Patuca', 'Salamá', 'San Esteban', 'San Francisco de Becerra', 'San Francisco de la Paz', 'Santa María del Real', 'Silca', 'Yocón'],
  'Santa Bárbara': ['Arada', 'Atima', 'Azacualpa', 'Ceguaca', 'Chinda', 'Concepción del Norte', 'Concepción del Sur', 'El Níspero', 'Gualala', 'Ilama', 'Las Vegas', 'Macuelizo', 'Naranjito', 'Nueva Frontera', 'Nuevo Celilac', 'Petoa', 'Protección', 'Quimistán', 'San Francisco de Ojuera', 'San José de Colinas', 'San Luis', 'San Marcos', 'San Nicolás', 'San Pedro Zacapa', 'San Vicente Centenario', 'Santa Bárbara', 'Santa Rita', 'Trinidad'],
  'Valle': ['Alianza', 'Amapala', 'Aramecina', 'Caridad', 'Goascorán', 'Langue', 'Nacaome', 'San Francisco de Coray', 'San Lorenzo'],
  'Yoro': ['Arenal', 'El Negrito', 'El Progreso', 'Jocón', 'Morazán', 'Olanchito', 'Santa Rita', 'Sulaco', 'Victoria', 'Yorito', 'Yoro'],
};

function municipiosDe(departamento) { return DEPARTAMENTOS_HN[departamento] || []; }

// "Colonia El Centro, Juticalpa (Olancho)" — o '' si no tiene ubicación
function ubicacionTexto(c) {
  if (!c || !c.municipio) return c && c.localidad ? c.localidad : '';
  return `${c.localidad ? c.localidad + ', ' : ''}${c.municipio}${c.departamento ? ` (${c.departamento})` : ''}`;
}

// Clave para agrupar por municipio (el mismo nombre existe en varios departamentos)
function claveLugar(c) { return c && c.municipio ? `${c.municipio} (${c.departamento || ''})` : ''; }

// Resumen por municipio: clientes, ventas, total vendido y la planta más vendida.
async function resumenPorMunicipio({ desde = null, hasta = null } = {}) {
  const [clientes, ventas] = await Promise.all([listarClientes(), Ventas.listarVentas({ desde, hasta })]);
  const porId = new Map(clientes.map((c) => [c.id, c]));
  const grupos = new Map();
  const grupo = (clave, nombre) => {
    if (!grupos.has(clave)) grupos.set(clave, { clave, nombre, clientes: 0, ventas: 0, total: 0, plantas: {} });
    return grupos.get(clave);
  };
  clientes.forEach((c) => { grupo(claveLugar(c) || '~sin', claveLugar(c) || 'Sin ubicación registrada').clientes++; });
  ventas.forEach((v) => {
    const c = v.clienteId ? porId.get(v.clienteId) : null;
    const g = c ? grupo(claveLugar(c) || '~sin', claveLugar(c) || 'Sin ubicación registrada') : grupo('~general', 'Venta sin cliente registrado');
    g.ventas++;
    g.total += Number(v.total) || 0;
    const n = v.nombreProducto || 'Otro';
    g.plantas[n] = (g.plantas[n] || 0) + (Number(v.cantidad) || 0);
  });
  return [...grupos.values()].map((g) => {
    const top = Object.entries(g.plantas).sort((a, b) => b[1] - a[1])[0];
    return { ...g, plantaTop: top ? top[0] : '', plantaTopCant: top ? top[1] : 0 };
  }).sort((a, b) => (a.clave.startsWith('~') - b.clave.startsWith('~')) || (b.total - a.total) || (b.clientes - a.clientes));
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
    // De dónde es el cliente (departamento y municipio de la lista oficial)
    departamento: DEPARTAMENTOS_HN[datos.departamento] ? datos.departamento : '',
    municipio: DEPARTAMENTOS_HN[datos.departamento] && DEPARTAMENTOS_HN[datos.departamento].includes(datos.municipio) ? datos.municipio : '',
    localidad: String(datos.localidad || '').trim().replace(/\s+/g, ' ').slice(0, 80),
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
  DEPARTAMENTOS_HN,
  municipiosDe,
  ubicacionTexto,
  claveLugar,
  resumenPorMunicipio,
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
