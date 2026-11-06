// escaner.js — Lee códigos QR (y códigos de barras de fábrica cuando el teléfono
// lo permite) con la cámara. Lo usan la app de dueños y la de la vendedora.
//
// Cada producto tiene su QR: "ENC:<id del producto>". Todas las plantas del
// mismo producto llevan la misma etiqueta. Los productos que ya traen código de
// fábrica (abonos, bolsas de piedra pómez...) pueden guardar ese código en su
// ficha y se encuentran igual.

const PREFIJO_QR = 'ENC:';
const URL_JSQR = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
const URL_QRGEN = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js';
const FORMATOS = ['qr_code', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39'];

const scriptsCargados = {};
function cargarScript(url) {
  if (!scriptsCargados[url]) {
    scriptsCargados[url] = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = url;
      s.onload = resolve;
      s.onerror = () => { delete scriptsCargados[url]; reject(new Error('No se pudo cargar el lector. Revisa tu conexión la primera vez.')); };
      document.head.appendChild(s);
    });
  }
  return scriptsCargados[url];
}

function codigoDeProducto(producto) { return PREFIJO_QR + producto.id; }

function limpiarCodigo(c) { return String(c || '').trim(); }

// Busca el producto que corresponde a un código leído
function productoDeCodigo(codigo, productos) {
  const c = limpiarCodigo(codigo);
  if (!c) return null;
  const id = c.startsWith(PREFIJO_QR) ? c.slice(PREFIJO_QR.length) : null;
  if (id) return productos.find((p) => p.id === id) || null;
  return productos.find((p) => p.codigoBarras && limpiarCodigo(p.codigoBarras) === c) || null;
}

async function crearDetector() {
  if ('BarcodeDetector' in window) {
    try {
      const soportados = await window.BarcodeDetector.getSupportedFormats();
      const formatos = FORMATOS.filter((f) => soportados.includes(f));
      if (formatos.includes('qr_code')) {
        const det = new window.BarcodeDetector({ formats: formatos });
        return async (video) => {
          const r = await det.detect(video);
          return r.length ? r[0].rawValue : null;
        };
      }
    } catch (e) { /* se usa el lector de respaldo */ }
  }
  // Respaldo (iPhone y teléfonos sin lector propio): solo QR
  await cargarScript(URL_JSQR);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  return async (video) => {
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return null;
    const escala = Math.min(1, 640 / Math.max(w, h));
    canvas.width = Math.round(w * escala);
    canvas.height = Math.round(h * escala);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const r = window.jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
    return r ? r.data : null;
  };
}

function sonidoLectura() {
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.frequency.value = 1400;
    g.gain.value = 0.08;
    o.connect(g); g.connect(ac.destination);
    o.start(); o.stop(ac.currentTime + 0.09);
    setTimeout(() => ac.close(), 300);
  } catch (e) { /* sin sonido */ }
  if (navigator.vibrate) navigator.vibrate(60);
}

// Abre la cámara a pantalla completa.
// opciones = { titulo, continuo (seguir leyendo después de cada código),
//              alLeer(codigo) → { ok: bool, mensaje } }
async function abrir({ titulo = 'Escanear', continuo = false, alLeer }) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert('Este teléfono o navegador no permite usar la cámara aquí. Abre la app en Chrome.');
    return;
  }
  const capa = document.createElement('div');
  capa.className = 'escaner-capa';
  capa.innerHTML = `
    <div class="escaner-cabeza"><b>${titulo}</b><button type="button" class="escaner-cerrar">${continuo ? 'Listo' : 'Cerrar'}</button></div>
    <div class="escaner-video"><video playsinline muted></video><div class="escaner-marco"></div></div>
    <div class="escaner-mensaje">Apunta a la etiqueta QR…</div>`;
  document.body.appendChild(capa);
  const video = capa.querySelector('video');
  const mensaje = capa.querySelector('.escaner-mensaje');
  let activo = true;
  let flujo = null;
  let ultimo = '';
  let ultimoEn = 0;

  const cerrar = () => {
    activo = false;
    if (flujo) flujo.getTracks().forEach((t) => t.stop());
    capa.remove();
  };
  capa.querySelector('.escaner-cerrar').addEventListener('click', cerrar);

  try {
    flujo = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false });
    if (!activo) { flujo.getTracks().forEach((t) => t.stop()); return; }
    video.srcObject = flujo;
    await video.play();
  } catch (err) {
    mensaje.textContent = err && err.name === 'NotAllowedError'
      ? '⚠️ No diste permiso para usar la cámara. Actívalo en los permisos del navegador para esta página.'
      : '⚠️ No se pudo abrir la cámara.';
    mensaje.classList.add('error');
    return;
  }

  let detectar;
  try {
    detectar = await crearDetector();
  } catch (err) {
    mensaje.textContent = '⚠️ ' + err.message;
    mensaje.classList.add('error');
    return;
  }

  const ciclo = async () => {
    if (!activo) return;
    let codigo = null;
    try { if (video.readyState >= 2) codigo = await detectar(video); } catch (e) { /* cuadro ilegible */ }
    if (codigo && activo) {
      const ahora = Date.now();
      // Evita contar dos veces la misma etiqueta mientras sigue frente a la cámara
      if (codigo !== ultimo || ahora - ultimoEn > 2500) {
        ultimo = codigo;
        ultimoEn = ahora;
        const r = (alLeer && alLeer(codigo)) || { ok: true, mensaje: '' };
        if (r.ok) sonidoLectura();
        mensaje.textContent = r.mensaje || codigo;
        mensaje.classList.toggle('error', !r.ok);
        if (r.ok && !continuo) { setTimeout(cerrar, 250); return; }
      } else {
        ultimoEn = ahora;
      }
    }
    setTimeout(ciclo, 150);
  };
  ciclo();
}

// ---------- Etiquetas para imprimir (PDF tamaño carta) ----------
const TAMANOS_ETIQUETA = {
  normal: { texto: 'Normal (21 por hoja, 6.5 × 3.6 cm)', cols: 3, filas: 7, ancho: 65, alto: 36 },
  chica: { texto: 'Chica (40 por hoja, 4.8 × 2.5 cm)', cols: 4, filas: 10, ancho: 48, alto: 25 },
  grande: { texto: 'Grande (10 por hoja, 9.5 × 5 cm)', cols: 2, filas: 5, ancho: 95, alto: 50 },
};

function matrizQR(texto) {
  const qr = window.qrcode(0, 'M');
  qr.addData(texto);
  qr.make();
  return qr;
}

function dibujarQR(doc, texto, x, y, lado) {
  const qr = matrizQR(texto);
  const n = qr.getModuleCount();
  const m = lado / n;
  doc.setFillColor(0, 0, 0);
  for (let f = 0; f < n; f++) {
    for (let c = 0; c < n; c++) {
      if (qr.isDark(f, c)) {
        // Se unen los cuadros seguidos de la misma fila para un PDF más liviano
        let largo = 1;
        while (c + largo < n && qr.isDark(f, c + largo)) largo++;
        doc.rect(x + c * m, y + f * m, largo * m + 0.01, m + 0.01, 'F');
        c += largo - 1;
      }
    }
  }
}

// lista = [{ producto, copias }]
async function construirPDFEtiquetas({ lista, tamano = 'normal', mostrarPrecio = true, nombreNegocio = '' }) {
  await cargarScript(URL_QRGEN);
  if (!window.jspdf) throw new Error('No se pudo cargar el generador de PDF.');
  const t = TAMANOS_ETIQUETA[tamano] || TAMANOS_ETIQUETA.normal;
  const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'letter' });
  const anchoHoja = 215.9;
  const altoHoja = 279.4;
  const margenX = (anchoHoja - t.cols * t.ancho) / 2;
  const margenY = (altoHoja - t.filas * t.alto) / 2;
  const etiquetas = [];
  lista.forEach(({ producto, copias }) => { for (let i = 0; i < copias; i++) etiquetas.push(producto); });
  if (!etiquetas.length) throw new Error('Elige al menos un producto.');

  const porHoja = t.cols * t.filas;
  etiquetas.forEach((p, i) => {
    if (i > 0 && i % porHoja === 0) doc.addPage();
    const pos = i % porHoja;
    const x = margenX + (pos % t.cols) * t.ancho;
    const y = margenY + Math.floor(pos / t.cols) * t.alto;
    // Línea de corte
    doc.setDrawColor(190, 190, 190);
    doc.setLineDashPattern([1, 1], 0);
    doc.setLineWidth(0.2);
    doc.rect(x, y, t.ancho, t.alto);
    doc.setLineDashPattern([], 0);

    const pad = 2;
    const lado = t.alto - pad * 2;
    dibujarQR(doc, codigoDeProducto(p), x + pad, y + pad, lado);

    const tx = x + pad * 2 + lado;
    const anchoTexto = t.ancho - (tx - x) - pad;
    const base = tamano === 'grande' ? 12 : tamano === 'chica' ? 7 : 9;
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(base);
    const lineas = doc.splitTextToSize(p.nombre || '', anchoTexto).slice(0, tamano === 'chica' ? 2 : 3);
    let ty = y + pad + base * 0.4;
    lineas.forEach((l) => { doc.text(l, tx, ty); ty += base * 0.42; });
    if (mostrarPrecio && Number(p.precio) > 0) {
      doc.setFontSize(base + 3);
      doc.text('L. ' + Number(p.precio).toLocaleString('es-HN', { minimumFractionDigits: 0, maximumFractionDigits: 2 }), tx, y + t.alto - pad - (nombreNegocio ? base * 0.45 : 0.5));
    }
    if (nombreNegocio) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(Math.max(5, base - 3));
      doc.setTextColor(110, 110, 110);
      doc.text(nombreNegocio, tx, y + t.alto - pad);
    }
  });
  const fecha = new Date().toISOString().slice(0, 10);
  return { doc, nombreArchivo: `Etiquetas_QR_${fecha}.pdf` };
}

window.Escaner = {
  PREFIJO_QR,
  URL_JSQR,
  URL_QRGEN,
  TAMANOS_ETIQUETA,
  abrir,
  codigoDeProducto,
  productoDeCodigo,
  construirPDFEtiquetas,
};
