// inventario.js — Alta, edición y listado de productos (plantas e insumos)

// Categorías de Encantos. "id" se usa en los enlaces del catálogo público
// (por ejemplo catalogo.html?cat=suculentas), así que no debe cambiarse.
const CATEGORIAS_INFO = [
  // Plantas
  { id: 'interior',     nombre: 'Interior / follaje',                   emoji: '🪴', grupo: 'planta' },
  { id: 'flor',         nombre: 'Con flor / de temporada',              emoji: '🌸', grupo: 'planta' },
  { id: 'cactus',       nombre: 'Cactus',                               emoji: '🌵', grupo: 'planta' },
  { id: 'suculentas',   nombre: 'Suculentas',                           emoji: '🪷', grupo: 'planta' },
  { id: 'orquideas',    nombre: 'Orquídeas',                            emoji: '🌺', grupo: 'planta' },
  { id: 'bromelias',    nombre: 'Bromelias',                            emoji: '🍍', grupo: 'planta' },
  { id: 'helechos',     nombre: 'Helechos',                             emoji: '🌿', grupo: 'planta' },
  { id: 'arbustos',     nombre: 'Arbustos ornamentales',                emoji: '🌳', grupo: 'planta' },
  { id: 'palmas',       nombre: 'Palmas',                               emoji: '🌴', grupo: 'planta' },
  { id: 'arboles',      nombre: 'Árboles ornamentales y frutales',      emoji: '🌲', grupo: 'planta' },
  { id: 'enredaderas',  nombre: 'Enredaderas, trepadoras y colgantes',  emoji: '🍃', grupo: 'planta' },
  { id: 'cubresuelos',  nombre: 'Cubresuelos y grama',                  emoji: '🌱', grupo: 'planta' },
  { id: 'aromaticas',   nombre: 'Aromáticas, medicinales y comestibles', emoji: '🌿', grupo: 'planta' },
  { id: 'acuaticas',    nombre: 'Acuáticas',                            emoji: '💧', grupo: 'planta' },
  { id: 'bonsai',       nombre: 'Bonsái',                               emoji: '🎍', grupo: 'planta' },
  // Complementos / insumos de vivero
  { id: 'piedra-pomez', nombre: 'Piedra pómez',                         emoji: '🪨', grupo: 'insumo' },
  { id: 'abono',        nombre: 'Abono',                                emoji: '🧪', grupo: 'insumo' },
  { id: 'tierra',       nombre: 'Tierra',                               emoji: '🟫', grupo: 'insumo' },
  { id: 'macetas',      nombre: 'Maceta',                               emoji: '🏺', grupo: 'insumo' },
  { id: 'otros',        nombre: 'Otro insumo',                          emoji: '🧰', grupo: 'insumo' },
];
const CATEGORIAS = CATEGORIAS_INFO.map((c) => c.nombre);

// Nombres usados antes de la Fase 2 -> nombre nuevo. Los productos viejos se
// muestran con el nombre nuevo sin tener que editarlos uno por uno.
const CATEGORIAS_ANTERIORES = {
  'Suculenta': 'Suculentas',
  'Planta de hoja ancha / follaje': 'Interior / follaje',
  'Planta de flor': 'Con flor / de temporada',
  'Palma': 'Palmas',
  'Trepadora / enredadera': 'Enredaderas, trepadoras y colgantes',
  'Helecho': 'Helechos',
  'Arbusto ornamental': 'Arbustos ornamentales',
  'Árbol ornamental': 'Árboles ornamentales y frutales',
  'Planta aromática / herbácea': 'Aromáticas, medicinales y comestibles',
  'Planta acuática': 'Acuáticas',
};

function normalizarCategoria(nombre) {
  return CATEGORIAS_ANTERIORES[nombre] || nombre || 'Otro insumo';
}

function infoCategoria(nombre) {
  const n = normalizarCategoria(nombre);
  return CATEGORIAS_INFO.find((c) => c.nombre === n) ||
    { id: 'otros', nombre: n, emoji: '🌿', grupo: 'planta' };
}

const UBICACIONES = ['Interior', 'Exterior', 'Interior y exterior'];
const DIFICULTADES = ['Fácil', 'Media', 'Requiere experiencia'];
const MASCOTAS = ['Segura para mascotas', 'Tóxica para mascotas'];
const ETIQUETAS = ['Para principiantes', 'Poca luz', 'Ideal para regalo', 'Oferta'];

const TIPOS_SOL = ['Sol completo', 'Medio sol', 'Sombra'];

const ORIGENES = ['Reproducción propia', 'Compra a proveedor'];

const TIPOS_RIEGO = [
  'Diario / abundante',
  '2 a 3 veces por semana',
  'Una vez por semana',
  'Cada 15 días',
  'Una vez al mes',
];

// Comprime la imagen antes de guardarla, para no llenar el almacenamiento del teléfono
function comprimirImagen(dataUrl, maxAncho = 800, calidad = 0.75) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const escala = Math.min(1, maxAncho / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = img.width * escala;
      canvas.height = img.height * escala;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', calidad));
    };
    img.src = dataUrl;
  });
}

async function guardarProducto(datos) {
  const producto = {
    nombre: datos.nombre.trim(),
    categoria: datos.categoria,
    descripcion: datos.descripcion.trim(),
    nombreCientifico: (datos.nombreCientifico || '').trim(),
    tipoSol: datos.tipoSol || '',
    riego: datos.riego || '',
    ubicacion: datos.ubicacion || '',
    dificultad: datos.dificultad || '',
    mascotas: datos.mascotas || '',
    tamanoMaceta: (datos.tamanoMaceta || '').trim(),
    tamanoAdulto: (datos.tamanoAdulto || '').trim(),
    etiquetas: Array.isArray(datos.etiquetas) ? datos.etiquetas : [],
    publicarCatalogo: !!datos.publicarCatalogo,
    origen: datos.origen || '',
    proveedorId: datos.origen === 'Compra a proveedor' ? (datos.proveedorId || null) : null,
    costo: parseFloat(datos.costo) || 0,
    precio: parseFloat(datos.precio) || 0,
    stock: parseInt(datos.stock, 10) || 0,
    foto: datos.foto || null,
    embedding: datos.embedding || null, // huella visual para búsqueda por foto
    // Al editar, se conserva la fecha original en que se agregó el producto
    // (mismo criterio que clientes y proveedores).
    creadoEl: datos.creadoEl || new Date().toISOString(),
  };

  if (datos.id) {
    producto.id = datos.id;
    await DB.actualizar(DB.STORES.productos, producto);
  } else {
    producto.id = await DB.agregar(DB.STORES.productos, producto);
  }
  // Publica, actualiza o retira la ficha del catálogo público
  Catalogo.sincronizarProducto(producto).catch((e) => console.warn('Catálogo no sincronizado', e));
  return producto.id;
}

function conCategoriaNormalizada(p) {
  return { ...p, categoria: normalizarCategoria(p.categoria) };
}

async function listarProductos(filtroCategoria = null) {
  const productos = (await DB.obtenerTodos(DB.STORES.productos)).map(conCategoriaNormalizada);
  productos.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
  if (filtroCategoria) {
    return productos.filter((p) => p.categoria === filtroCategoria);
  }
  return productos;
}

async function buscarPorTexto(texto) {
  const productos = (await DB.obtenerTodos(DB.STORES.productos)).map(conCategoriaNormalizada);
  const q = texto.trim().toLowerCase();
  if (!q) return productos;
  return productos.filter(
    (p) =>
      (p.nombre || '').toLowerCase().includes(q) ||
      (p.descripcion || '').toLowerCase().includes(q) ||
      (p.nombreCientifico || '').toLowerCase().includes(q) ||
      (p.categoria || '').toLowerCase().includes(q)
  );
}

async function eliminarProducto(id) {
  await DB.eliminar(DB.STORES.productos, id);
  Catalogo.retirarProducto(id).catch((e) => console.warn('Catálogo no sincronizado', e));
}

async function ajustarStock(id, cambio) {
  // Incremento atómico: seguro aunque los dos celulares vendan al mismo tiempo.
  await DB.incrementarCampo(DB.STORES.productos, id, 'stock', cambio);
  // Actualiza "Disponible / Últimas unidades / Agotada" en el catálogo
  Catalogo.actualizarDisponibilidad(id).catch((e) => console.warn('Catálogo no sincronizado', e));
}

window.Inventario = {
  CATEGORIAS,
  CATEGORIAS_INFO,
  UBICACIONES,
  DIFICULTADES,
  MASCOTAS,
  ETIQUETAS,
  infoCategoria,
  TIPOS_SOL,
  TIPOS_RIEGO,
  ORIGENES,
  comprimirImagen,
  guardarProducto,
  listarProductos,
  buscarPorTexto,
  eliminarProducto,
  ajustarStock,
};
