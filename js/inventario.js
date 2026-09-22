// inventario.js — Alta, edición y listado de productos (plantas e insumos)

const CATEGORIAS = [
  // Plantas, por tipo
  'Cactus',
  'Suculenta',
  'Planta de hoja ancha / follaje',
  'Planta de flor',
  'Palma',
  'Trepadora / enredadera',
  'Helecho',
  'Arbusto ornamental',
  'Árbol ornamental',
  'Planta aromática / herbácea',
  'Planta acuática',
  'Bonsái',
  // Insumos de vivero
  'Piedra pómez',
  'Abono',
  'Tierra',
  'Maceta',
  'Otro insumo',
];

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
    tipoSol: datos.tipoSol || '',
    riego: datos.riego || '',
    origen: datos.origen || '',
    proveedorId: datos.origen === 'Compra a proveedor' ? (datos.proveedorId || null) : null,
    costo: parseFloat(datos.costo) || 0,
    precio: parseFloat(datos.precio) || 0,
    stock: parseInt(datos.stock, 10) || 0,
    foto: datos.foto || null,
    embedding: datos.embedding || null, // huella visual para búsqueda por foto
    creadoEl: new Date().toISOString(),
  };

  if (datos.id) {
    producto.id = datos.id;
    return DB.actualizar(DB.STORES.productos, producto);
  }
  return DB.agregar(DB.STORES.productos, producto);
}

async function listarProductos(filtroCategoria = null) {
  const productos = await DB.obtenerTodos(DB.STORES.productos);
  productos.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
  if (filtroCategoria) {
    return productos.filter((p) => p.categoria === filtroCategoria);
  }
  return productos;
}

async function buscarPorTexto(texto) {
  const productos = await DB.obtenerTodos(DB.STORES.productos);
  const q = texto.trim().toLowerCase();
  if (!q) return productos;
  return productos.filter(
    (p) =>
      (p.nombre || '').toLowerCase().includes(q) ||
      (p.descripcion || '').toLowerCase().includes(q) ||
      (p.categoria || '').toLowerCase().includes(q)
  );
}

async function eliminarProducto(id) {
  return DB.eliminar(DB.STORES.productos, id);
}

async function ajustarStock(id, cambio) {
  // Incremento atómico: seguro aunque los dos celulares vendan al mismo tiempo.
  return DB.incrementarCampo(DB.STORES.productos, id, 'stock', cambio);
}

window.Inventario = {
  CATEGORIAS,
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
