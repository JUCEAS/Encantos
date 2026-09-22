// busqueda-visual.js — Búsqueda de productos tomando/eligiendo una foto
//
// Genera una "huella visual" de cada foto usando un histograma de color por
// cuadrícula (un mapa de colores promedio en distintas zonas de la imagen).
// Todo corre en el propio teléfono con <canvas>, sin descargar ningún modelo
// de internet, así que funciona sin conexión desde el primer uso.

const TAMANO_CUADRICULA = 8; // 8x8 zonas = 64 puntos, cada uno con color promedio (R,G,B)

// Recibe un elemento <img> ya cargado y devuelve un vector de números
// (huella visual) que describe cómo se distribuyen los colores en la foto.
async function generarEmbedding(imgElement) {
  const canvas = document.createElement('canvas');
  canvas.width = TAMANO_CUADRICULA;
  canvas.height = TAMANO_CUADRICULA;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  // Reducir la imagen a una cuadrícula pequeña: cada píxel resultante ya
  // es el promedio de una zona de la foto original (el navegador lo hace
  // al escalar con drawImage).
  ctx.drawImage(imgElement, 0, 0, TAMANO_CUADRICULA, TAMANO_CUADRICULA);
  const { data } = ctx.getImageData(0, 0, TAMANO_CUADRICULA, TAMANO_CUADRICULA);

  const vector = [];
  for (let i = 0; i < data.length; i += 4) {
    vector.push(data[i] / 255, data[i + 1] / 255, data[i + 2] / 255);
  }
  return vector; // 64 zonas x 3 canales = 192 números
}

function similitudCoseno(a, b) {
  let punto = 0, normaA = 0, normaB = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    punto += a[i] * b[i];
    normaA += a[i] * a[i];
    normaB += b[i] * b[i];
  }
  if (normaA === 0 || normaB === 0) return 0;
  return punto / (Math.sqrt(normaA) * Math.sqrt(normaB));
}

// Recibe un dataURL de la foto tomada, y la lista de productos con embedding guardado
async function buscarPorFoto(dataUrlFotoBusqueda, productos, topN = 5) {
  const img = new Image();
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = dataUrlFotoBusqueda;
  });

  const embeddingBusqueda = await generarEmbedding(img);

  const candidatos = productos
    .filter((p) => Array.isArray(p.embedding) && p.embedding.length > 0)
    .map((p) => ({
      producto: p,
      similitud: similitudCoseno(embeddingBusqueda, p.embedding),
    }));

  candidatos.sort((a, b) => b.similitud - a.similitud);
  return candidatos.slice(0, topN);
}

window.BusquedaVisual = {
  generarEmbedding,
  buscarPorFoto,
};
