// catalogo.js — Mantiene la colección pública "catalogo_publico" al día.
//
// Solo se copian los datos que un cliente puede ver: foto, nombre, precio,
// luz, riego, descripción, etc. NUNCA se copian el costo, la ganancia, el
// proveedor, el stock exacto ni datos de clientes.

const UMBRAL_ULTIMAS_UNIDADES = 2;

// Documento especial dentro de catalogo_publico con los datos del negocio que
// ve el cliente (número de WhatsApp, mensaje de bienvenida, ubicación).
// Los ids que empiezan con "_" no son plantas.
const CONFIG_ID = '_config';

async function obtenerConfig() {
  return (await DB.obtener(DB.STORES.catalogo, CONFIG_ID)) || {};
}

async function guardarConfig(datos) {
  return DB.actualizar(DB.STORES.catalogo, {
    id: CONFIG_ID,
    tipo: 'config',
    negocio: (datos.negocio || 'Encantos').trim(),
    whatsapp: (datos.whatsapp || '').replace(/[^0-9]/g, ''),
    bienvenida: (datos.bienvenida || '').trim(),
    ubicacion: (datos.ubicacion || '').trim(),
    vendedores: (datos.vendedores || []).map((v) => ({
      id: v.id,
      nombre: (v.nombre || '').trim(),
      whatsapp: (v.whatsapp || '').replace(/[^0-9]/g, ''),
      correo: (v.correo || '').trim().toLowerCase(),
    })).filter((v) => v.id && v.nombre),
    actualizadoEl: new Date().toISOString(),
  });
}

function disponibilidadDe(stock) {
  const n = Number(stock) || 0;
  if (n <= 0) return 'agotado';
  if (n <= UMBRAL_ULTIMAS_UNIDADES) return 'ultimas';
  return 'disponible';
}

// Construye la ficha pública de un producto, o null si no debe publicarse.
function fichaPublica(p) {
  if (!p || !p.publicarCatalogo) return null;
  const cat = Inventario.infoCategoria(p.categoria);
  return {
    nombre: p.nombre || '',
    nombreCientifico: p.nombreCientifico || '',
    categoria: cat.nombre,
    categoriaId: cat.id,
    grupo: cat.grupo,
    descripcion: p.descripcion || '',
    tipoSol: p.tipoSol || '',
    riego: p.riego || '',
    ubicacion: p.ubicacion || '',
    dificultad: p.dificultad || '',
    mascotas: p.mascotas || '',
    tamanoMaceta: p.tamanoMaceta || '',
    tamanoAdulto: p.tamanoAdulto || '',
    etiquetas: Array.isArray(p.etiquetas) ? p.etiquetas : [],
    precio: Number(p.precio) || 0,
    foto: p.foto || null,
    disponibilidad: disponibilidadDe(p.stock),
  };
}

function mismaFicha(a, b) {
  if (!a || !b) return false;
  const { actualizadoEl: _x, id: _i, ...ra } = a;
  const { actualizadoEl: _y, id: _j, ...rb } = b;
  return JSON.stringify(ra, Object.keys(ra).sort()) === JSON.stringify(rb, Object.keys(rb).sort());
}

async function sincronizarProducto(producto) {
  const ficha = fichaPublica(producto);
  if (!ficha) return retirarProducto(producto.id);
  return DB.actualizar(DB.STORES.catalogo, {
    id: producto.id,
    ...ficha,
    actualizadoEl: new Date().toISOString(),
  });
}

async function retirarProducto(id) {
  if (!id) return;
  const existente = await DB.obtener(DB.STORES.catalogo, id);
  if (existente) await DB.eliminar(DB.STORES.catalogo, id);
}

async function actualizarDisponibilidad(id) {
  const producto = await DB.obtener(DB.STORES.productos, id);
  if (producto) return sincronizarProducto(producto);
  return retirarProducto(id);
}

// Revisión completa: publica lo que falta, corrige lo que cambió y retira lo
// que ya no debe estar. Se ejecuta al abrir la app y después de importar un
// respaldo, así el catálogo nunca queda desactualizado.
async function sincronizarTodo() {
  const [productos, publicados] = await Promise.all([
    DB.obtenerTodos(DB.STORES.productos),
    DB.obtenerTodos(DB.STORES.catalogo),
  ]);
  const mapaPublicados = new Map(publicados.filter((d) => !String(d.id).startsWith('_')).map((d) => [d.id, d]));
  const tareas = [];
  let cambios = 0;

  productos.forEach((p) => {
    const ficha = fichaPublica(p);
    const actual = mapaPublicados.get(p.id);
    mapaPublicados.delete(p.id);
    if (ficha && !mismaFicha(ficha, actual)) {
      cambios++;
      tareas.push(DB.actualizar(DB.STORES.catalogo, { id: p.id, ...ficha, actualizadoEl: new Date().toISOString() }));
    } else if (!ficha && actual) {
      cambios++;
      tareas.push(DB.eliminar(DB.STORES.catalogo, p.id));
    }
  });
  // Fichas cuyo producto ya no existe
  mapaPublicados.forEach((_d, id) => {
    cambios++;
    tareas.push(DB.eliminar(DB.STORES.catalogo, id));
  });

  await Promise.all(tareas);
  return cambios;
}

// Identificador corto para el enlace (#v=saira). Solo letras y números.
function idVendedor(nombre, existentes = []) {
  const base = (nombre || 'vendedora').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 16) || 'vendedora';
  let id = base, n = 2;
  while (existentes.includes(id)) id = base + n++;
  return id;
}

window.Catalogo = {
  idVendedor,
  CONFIG_ID,
  obtenerConfig,
  guardarConfig,
  fichaPublica,
  disponibilidadDe,
  sincronizarProducto,
  retirarProducto,
  actualizarDisponibilidad,
  sincronizarTodo,
};
