// app-etiquetas.js — Etiquetas QR (imprimir) y escaneo en la app de dueños.

const copiasEtiquetas = {}; // id de producto → número de etiquetas
let productosEtiquetas = [];

async function refrescarEtiquetas() {
  const sel = document.getElementById('campoTamanoEtiqueta');
  if (!sel.options.length) {
    sel.innerHTML = Object.entries(Escaner.TAMANOS_ETIQUETA).map(([id, t]) => `<option value="${id}">${t.texto}</option>`).join('');
    try { sel.value = localStorage.getItem('encantos-tamano-etiqueta') || 'normal'; } catch (e) { sel.value = 'normal'; }
  }
  productosEtiquetas = await Inventario.listarProductos();
  pintarListaEtiquetas();
}

function pintarListaEtiquetas() {
  const q = document.getElementById('buscarEtiquetas').value.trim().toLowerCase();
  const lista = productosEtiquetas
    .filter((p) => !q || (p.nombre || '').toLowerCase().includes(q) || (p.categoria || '').toLowerCase().includes(q))
    .sort((a, b) => ((copiasEtiquetas[b.id] > 0) - (copiasEtiquetas[a.id] > 0)) || (a.nombre || '').localeCompare(b.nombre || ''));
  const caja = document.getElementById('listaEtiquetas');
  if (!lista.length) {
    caja.innerHTML = '<div class="vacio">No hay productos con esa búsqueda.</div>';
  } else {
    caja.innerHTML = lista.map((p) => {
      const n = copiasEtiquetas[p.id] || 0;
      return `<div class="card fila-etiqueta ${n ? 'elegida' : ''}">
        <div class="info">
          <h3>${escaparHtml(p.nombre)}</h3>
          <p>Existencias: ${Number(p.stock) || 0} · ${formatoL(p.precio)}</p>
        </div>
        <div class="cant">
          <button type="button" data-menos="${escaparHtml(p.id)}" aria-label="Menos">−</button>
          <span>${n}</span>
          <button type="button" data-mas="${escaparHtml(p.id)}" aria-label="Más">+</button>
        </div>
      </div>`;
    }).join('');
    caja.querySelectorAll('[data-mas]').forEach((b) => b.addEventListener('click', () => {
      copiasEtiquetas[b.dataset.mas] = (copiasEtiquetas[b.dataset.mas] || 0) + 1; pintarListaEtiquetas();
    }));
    caja.querySelectorAll('[data-menos]').forEach((b) => b.addEventListener('click', () => {
      copiasEtiquetas[b.dataset.menos] = Math.max(0, (copiasEtiquetas[b.dataset.menos] || 0) - 1); pintarListaEtiquetas();
    }));
  }
  const total = Object.values(copiasEtiquetas).reduce((s, n) => s + n, 0);
  const t = Escaner.TAMANOS_ETIQUETA[document.getElementById('campoTamanoEtiqueta').value] || Escaner.TAMANOS_ETIQUETA.normal;
  const hojas = Math.ceil(total / (t.cols * t.filas));
  document.getElementById('resumenEtiquetas').textContent = total
    ? `${total} etiqueta${total === 1 ? '' : 's'} · ${hojas} hoja${hojas === 1 ? '' : 's'} tamaño carta`
    : 'Usa + para elegir cuántas etiquetas de cada producto.';
}

document.getElementById('buscarEtiquetas').addEventListener('input', pintarListaEtiquetas);
document.getElementById('campoTamanoEtiqueta').addEventListener('change', (e) => {
  try { localStorage.setItem('encantos-tamano-etiqueta', e.target.value); } catch (err) { /* sin almacenamiento */ }
  pintarListaEtiquetas();
});
document.getElementById('btnEtiquetasExistencias').addEventListener('click', () => {
  productosEtiquetas.forEach((p) => { const s = Number(p.stock) || 0; if (s > 0) copiasEtiquetas[p.id] = s; });
  pintarListaEtiquetas();
});
document.getElementById('btnEtiquetasNinguna').addEventListener('click', () => {
  Object.keys(copiasEtiquetas).forEach((k) => delete copiasEtiquetas[k]);
  pintarListaEtiquetas();
});

async function datosPDFEtiquetas() {
  const lista = productosEtiquetas
    .filter((p) => copiasEtiquetas[p.id] > 0)
    .map((p) => ({ producto: p, copias: copiasEtiquetas[p.id] }));
  let nombreNegocio = '';
  try { nombreNegocio = ((await Negocio.obtenerNegocio()) || {}).nombreNegocio || ''; } catch (e) { /* sin datos */ }
  return {
    lista,
    tamano: document.getElementById('campoTamanoEtiqueta').value,
    mostrarPrecio: document.getElementById('campoEtiquetaPrecio').checked,
    nombreNegocio: nombreNegocio || 'Encantos',
  };
}

document.getElementById('btnPdfEtiquetas').addEventListener('click', async () => {
  try { await descargarPDF(Escaner.construirPDFEtiquetas, await datosPDFEtiquetas()); } catch (err) { alert(err.message || 'No se pudo generar el PDF.'); }
});
document.getElementById('btnCompartirEtiquetas').addEventListener('click', async () => {
  try { await compartirPDF(Escaner.construirPDFEtiquetas, await datosPDFEtiquetas()); } catch (err) { if (err && err.name !== 'AbortError') alert(err.message || 'No se pudo compartir el PDF.'); }
});

// Desde las opciones de un producto: abre Etiquetas con ese producto elegido
function etiquetasDeProducto(producto) {
  copiasEtiquetas[producto.id] = Math.max(1, Number(producto.stock) || 0);
  cambiarVista('etiquetas');
}

// ---------- Escanear en el inventario: abre las opciones del producto ----------
document.getElementById('btnEscanearQR').addEventListener('click', async () => {
  const productos = await Inventario.listarProductos();
  Escaner.abrir({
    titulo: 'Escanear producto',
    alLeer: (codigo) => {
      const p = Escaner.productoDeCodigo(codigo, productos);
      if (!p) return { ok: false, mensaje: '❓ Esta etiqueta no es de ningún producto del inventario.' };
      setTimeout(() => mostrarOpcionesProducto(p.id), 300);
      return { ok: true, mensaje: '✅ ' + p.nombre };
    },
  });
});

// ---------- Leer el código de fábrica al editar un producto ----------
document.getElementById('btnLeerCodigoBarras').addEventListener('click', () => {
  Escaner.abrir({
    titulo: 'Leer código de fábrica',
    alLeer: (codigo) => {
      if (codigo.startsWith(Escaner.PREFIJO_QR)) return { ok: false, mensaje: '⚠️ Esa es una etiqueta QR de la app; aquí va el código que trae el producto de fábrica.' };
      document.getElementById('campoCodigoBarras').value = codigo;
      return { ok: true, mensaje: '✅ ' + codigo };
    },
  });
});
