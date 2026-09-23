// catalogo-publico.js — Página que ven los clientes (catalogo.html).
// Solo LEE la colección "catalogo_publico"; las reglas de Firestore no permiten
// que un visitante escriba ni vea inventario, costos, ventas o clientes.

firebase.initializeApp({
  apiKey: 'AIzaSyArwo4lDPBxUNk-eafoqedY0Ylp6FodOu0',
  authDomain: 'encantos-vivero.firebaseapp.com',
  projectId: 'encantos-vivero',
  storageBucket: 'encantos-vivero.firebasestorage.app',
  messagingSenderId: '892959442776',
  appId: '1:892959442776:web:e51c8af2b425f7f11fc72d',
});
const db = firebase.firestore();

// Mismo orden y emojis que en la app interna (js/inventario.js)
const CATEGORIAS = [
  ['interior', '🪴'], ['flor', '🌸'], ['cactus', '🌵'], ['suculentas', '🪷'],
  ['orquideas', '🌺'], ['bromelias', '🍍'], ['helechos', '🌿'], ['arbustos', '🌳'],
  ['palmas', '🌴'], ['arboles', '🌲'], ['enredaderas', '🍃'], ['cubresuelos', '🌱'],
  ['aromaticas', '🌿'], ['acuaticas', '💧'], ['bonsai', '🎍'],
  ['piedra-pomez', '🪨'], ['abono', '🧪'], ['tierra', '🟫'], ['macetas', '🏺'], ['otros', '🧰'],
];
const ORDEN_CAT = new Map(CATEGORIAS.map(([id], i) => [id, i]));
const EMOJI_CAT = new Map(CATEGORIAS);
const LUCES = [
  ['Sol completo', '☀️ Sol'],
  ['Medio sol', '⛅ Medio sol'],
  ['Sombra', '🌥️ Sombra / interior'],
];
const ICONO_LUZ = { 'Sol completo': '☀️', 'Medio sol': '⛅', 'Sombra': '🌥️' };
const ORDEN_DISP = { disponible: 0, ultimas: 1, agotado: 2 };

let plantas = [];
let config = {};
const estado = leerEstadoUrl();
let pedido = cargarPedido();

// ---------- Utilidades ----------
function esc(t) {
  return String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function lempiras(n) {
  return 'L ' + (Number(n) || 0).toLocaleString('es-HN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
function sinAcentos(t) {
  return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
function avisar(texto) {
  const el = document.getElementById('avisoFlotante');
  el.textContent = texto;
  el.hidden = false;
  clearTimeout(avisar._t);
  avisar._t = setTimeout(() => { el.hidden = true; }, 2200);
}
function numeroWhatsApp() {
  let n = String(config.whatsapp || '').replace(/[^0-9]/g, '');
  if (n.length === 8) n = '504' + n; // número hondureño sin código de país
  return n;
}
function enlaceWhatsApp(mensaje) {
  const n = numeroWhatsApp();
  return (n ? `https://wa.me/${n}` : 'https://wa.me/') + '?text=' + encodeURIComponent(mensaje);
}

// ---------- Estado en la URL (para compartir enlaces filtrados) ----------
function leerEstadoUrl() {
  const u = new URLSearchParams(location.search);
  return { cat: u.get('cat') || '', luz: u.get('luz') || '', q: u.get('q') || '' };
}
function guardarEstadoUrl() {
  const u = new URLSearchParams();
  if (estado.cat) u.set('cat', estado.cat);
  if (estado.luz) u.set('luz', estado.luz);
  if (estado.q) u.set('q', estado.q);
  const qs = u.toString();
  history.replaceState(null, '', location.pathname + (qs ? '?' + qs : ''));
}

// ---------- Carga ----------
async function cargar() {
  try {
    const snap = await db.collection('catalogo_publico').get();
    snap.docs.forEach((d) => {
      const data = d.data();
      if (d.id.startsWith('_')) {
        if (d.id === '_config') config = data;
        return;
      }
      plantas.push({ id: d.id, ...data });
    });
    plantas.sort((a, b) =>
      (ORDEN_DISP[a.disponibilidad] ?? 0) - (ORDEN_DISP[b.disponibilidad] ?? 0) ||
      (a.etiquetas?.includes('Oferta') ? 0 : 1) - (b.etiquetas?.includes('Oferta') ? 0 : 1) ||
      (a.nombre || '').localeCompare(b.nombre || '', 'es')
    );
    aplicarConfig();
    pedido = pedido.filter((l) => plantas.some((p) => p.id === l.id && p.disponibilidad !== 'agotado'));
    dibujarTodo();
    const idFicha = new URLSearchParams(location.hash.slice(1)).get('p');
    if (idFicha) abrirFicha(idFicha);
  } catch (err) {
    console.error(err);
    document.getElementById('estado').textContent =
      'No se pudo cargar el catálogo. Revisa tu conexión a internet e inténtalo de nuevo.';
  }
}

function aplicarConfig() {
  if (config.negocio) {
    document.getElementById('nombreNegocio').textContent = config.negocio;
  }
  if (config.bienvenida) document.getElementById('bienvenida').textContent = config.bienvenida;
  const ub = document.getElementById('ubicacion');
  if (config.ubicacion) { ub.textContent = '📍 ' + config.ubicacion; ub.hidden = false; }
}

// ---------- Dibujar ----------
function plantasFiltradas({ ignorarCat = false, ignorarLuz = false } = {}) {
  const q = sinAcentos(estado.q.trim());
  return plantas.filter((p) =>
    (ignorarCat || !estado.cat || p.categoriaId === estado.cat) &&
    (ignorarLuz || !estado.luz || p.tipoSol === estado.luz) &&
    (!q || sinAcentos([p.nombre, p.nombreCientifico, p.categoria, p.descripcion].join(' ')).includes(q))
  );
}

function dibujarTodo() {
  dibujarChips();
  dibujarRejilla();
  dibujarPedido();
  const nombreCat = estado.cat ? (plantas.find((p) => p.categoriaId === estado.cat)?.categoria || '') : '';
  document.getElementById('tituloSeccion').textContent = nombreCat || 'Catálogo de plantas';
  document.title = (nombreCat ? nombreCat + ' · ' : 'Catálogo de plantas · ') + (config.negocio || 'Encantos');
  guardarEstadoUrl();
}

function dibujarChips() {
  const base = plantasFiltradas({ ignorarCat: true });
  const cuentas = new Map();
  base.forEach((p) => cuentas.set(p.categoriaId, (cuentas.get(p.categoriaId) || 0) + 1));
  // Mostrar también la categoría activa aunque la búsqueda la deje en 0
  if (estado.cat && !cuentas.has(estado.cat)) cuentas.set(estado.cat, 0);

  const cats = [...cuentas.keys()].sort((a, b) => (ORDEN_CAT.get(a) ?? 99) - (ORDEN_CAT.get(b) ?? 99));
  const nombreDe = (id) => plantas.find((p) => p.categoriaId === id)?.categoria || id;
  const cont = document.getElementById('chipsCategorias');
  cont.innerHTML =
    `<button class="chip ${!estado.cat ? 'activo' : ''}" data-cat="">Todo <span class="cuenta">${base.length}</span></button>` +
    cats.map((id) => `<button class="chip ${estado.cat === id ? 'activo' : ''}" data-cat="${esc(id)}">${EMOJI_CAT.get(id) || '🌿'} ${esc(nombreDe(id))} <span class="cuenta">${cuentas.get(id)}</span></button>`).join('');
  cont.querySelectorAll('.chip').forEach((b) => b.addEventListener('click', () => {
    estado.cat = b.dataset.cat;
    dibujarTodo();
    window.scrollTo({ top: document.querySelector('.barra-filtros').offsetTop, behavior: 'smooth' });
  }));
  const activo = cont.querySelector('.activo');
  if (activo) activo.scrollIntoView({ inline: 'center', block: 'nearest' });

  // Luz: solo se muestra si hay plantas (no insumos) en la vista actual
  const conLuz = plantasFiltradas({ ignorarLuz: true }).filter((p) => p.tipoSol);
  const contLuz = document.getElementById('chipsLuz');
  const luces = LUCES.filter(([v]) => conLuz.some((p) => p.tipoSol === v));
  contLuz.hidden = luces.length < 2 && !estado.luz;
  contLuz.innerHTML =
    `<button class="chip ${!estado.luz ? 'activo' : ''}" data-luz="">Cualquier luz</button>` +
    luces.map(([v, t]) => `<button class="chip ${estado.luz === v ? 'activo' : ''}" data-luz="${esc(v)}">${t}</button>`).join('');
  contLuz.querySelectorAll('.chip').forEach((b) => b.addEventListener('click', () => {
    estado.luz = b.dataset.luz;
    dibujarTodo();
  }));
}

function insignia(p) {
  if (p.disponibilidad === 'agotado') return '<span class="insignia agotado">Agotada</span>';
  if (p.disponibilidad === 'ultimas') return '<span class="insignia ultimas">Últimas unidades</span>';
  if (p.etiquetas?.includes('Oferta')) return '<span class="insignia oferta">Oferta</span>';
  return '';
}

function dibujarRejilla() {
  const lista = plantasFiltradas();
  const est = document.getElementById('estado');
  if (plantas.length === 0) est.textContent = 'Muy pronto publicaremos nuestras plantas aquí. 🌱';
  else if (lista.length === 0) est.textContent = 'No encontramos plantas con ese filtro.';
  else est.textContent = '';

  document.getElementById('rejilla').innerHTML = lista.map((p) => `
    <button class="tarjeta ${p.disponibilidad === 'agotado' ? 'agotada' : ''}" data-id="${esc(p.id)}">
      ${p.foto ? `<img class="foto" src="${esc(p.foto)}" alt="${esc(p.nombre)}" loading="lazy">` : `<div class="sin-foto">${EMOJI_CAT.get(p.categoriaId) || '🌿'}</div>`}
      <div class="cuerpo">
        ${insignia(p)}
        <h3>${esc(p.nombre)}</h3>
        <div class="iconos">${[ICONO_LUZ[p.tipoSol], p.riego ? '💧' : '', p.mascotas === 'Segura para mascotas' ? '🐾' : ''].filter(Boolean).join(' ')}</div>
        <div class="precio">${lempiras(p.precio)}</div>
      </div>
    </button>`).join('');
  document.querySelectorAll('.tarjeta').forEach((t) => t.addEventListener('click', () => abrirFicha(t.dataset.id)));
}

// ---------- Ficha ----------
function dato(etq, val, clase = '') {
  return val ? `<div class="dato ${clase}"><div class="etq">${etq}</div><div class="val">${esc(val)}</div></div>` : '';
}

function textoRiego(r) {
  if (!r) return '';
  return /diario/i.test(r) ? r : r + ' (cuando la tierra esté seca)';
}

function abrirFicha(id) {
  const p = plantas.find((x) => x.id === id);
  if (!p) return;
  const agotada = p.disponibilidad === 'agotado';
  const disp = { disponible: 'Disponible', ultimas: 'Últimas unidades', agotado: 'Agotada' }[p.disponibilidad] || '';
  document.getElementById('fichaContenido').innerHTML = `
    ${p.foto ? `<img class="foto-grande" src="${esc(p.foto)}" alt="${esc(p.nombre)}">` : ''}
    <h2 id="fichaNombre">${esc(p.nombre)}</h2>
    ${p.nombreCientifico ? `<p class="cientifico">${esc(p.nombreCientifico)}</p>` : ''}
    <div class="precio-grande">${lempiras(p.precio)}${p.tamanoMaceta ? ` <span style="font-size:14px;color:var(--gris);font-weight:500">· maceta ${esc(p.tamanoMaceta)}</span>` : ''}</div>
    ${insignia(p)}
    ${p.descripcion ? `<p class="descripcion">${esc(p.descripcion)}</p>` : ''}
    <div class="datos">
      ${dato('Luz', p.tipoSol ? (ICONO_LUZ[p.tipoSol] || '') + ' ' + p.tipoSol : '')}
      ${dato('Riego', p.riego ? '💧 ' + textoRiego(p.riego) : '')}
      ${dato('Ubicación', p.ubicacion)}
      ${dato('Cuidado', p.dificultad)}
      ${dato('Tamaño adulto', p.tamanoAdulto)}
      ${dato('Mascotas', p.mascotas ? (p.mascotas === 'Segura para mascotas' ? '🐾 ' : '⚠️ ') + p.mascotas : '', p.mascotas === 'Tóxica para mascotas' ? 'aviso' : '')}
      ${dato('Disponibilidad', disp, agotada ? 'aviso' : '')}
      ${dato('Categoría', p.categoria)}
    </div>
    ${p.etiquetas?.length ? `<div class="etiquetas">${p.etiquetas.map((e) => `<span>${esc(e)}</span>`).join('')}</div>` : ''}
    <div class="acciones">
      ${agotada
        ? `<a class="btn-whatsapp" target="_blank" rel="noopener" href="${esc(enlaceWhatsApp(`Hola ${config.negocio || 'Encantos'} 🌿, ¿cuándo vuelven a tener *${p.nombre}*?`))}">Avísame cuando vuelva a haber</a>`
        : `<button class="btn-principal" id="btnAgregar">🧺 Agregar a mi pedido</button>
           <a class="btn-whatsapp" target="_blank" rel="noopener" href="${esc(enlaceWhatsApp(`Hola ${config.negocio || 'Encantos'} 🌿, me interesa: *${p.nombre}* (${lempiras(p.precio)}). ¿Está disponible?`))}">Preguntar por WhatsApp</a>`}
      <button class="btn-borde" id="btnCompartirPlanta">📤 Compartir esta planta</button>
    </div>`;
  const btnAgregar = document.getElementById('btnAgregar');
  if (btnAgregar) btnAgregar.addEventListener('click', () => { agregarAlPedido(p); cerrarFicha(); });
  document.getElementById('btnCompartirPlanta').addEventListener('click', () => {
    const url = new URL('catalogo.html', location.href);
    if (estado.cat) url.searchParams.set('cat', estado.cat);
    url.hash = 'p=' + p.id;
    compartir(`${p.nombre} · ${lempiras(p.precio)} 🌿`, url.toString());
  });
  document.getElementById('velo').hidden = false;
  const ficha = document.getElementById('ficha');
  ficha.hidden = false;
  ficha.scrollTop = 0;
}

function cerrarFicha() {
  document.getElementById('ficha').hidden = true;
  document.getElementById('panelPedido').hidden = true;
  document.getElementById('velo').hidden = true;
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
}
document.getElementById('cerrarFicha').addEventListener('click', cerrarFicha);
document.getElementById('cerrarPedido').addEventListener('click', cerrarFicha);
document.getElementById('velo').addEventListener('click', cerrarFicha);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrarFicha(); });

// ---------- Pedido ----------
function cargarPedido() {
  try { return JSON.parse(localStorage.getItem('encantos-pedido') || '[]'); } catch { return []; }
}
function guardarPedido() {
  try { localStorage.setItem('encantos-pedido', JSON.stringify(pedido)); } catch { /* sin almacenamiento */ }
}
function agregarAlPedido(p) {
  const linea = pedido.find((l) => l.id === p.id);
  if (linea) linea.cantidad++;
  else pedido.push({ id: p.id, cantidad: 1 });
  guardarPedido();
  dibujarPedido();
  avisar(`${p.nombre} agregada a tu pedido`);
}
function lineasPedido() {
  return pedido.map((l) => ({ ...l, p: plantas.find((x) => x.id === l.id) })).filter((l) => l.p);
}
function dibujarPedido() {
  const lineas = lineasPedido();
  const unidades = lineas.reduce((s, l) => s + l.cantidad, 0);
  const total = lineas.reduce((s, l) => s + l.cantidad * (Number(l.p.precio) || 0), 0);
  document.getElementById('barraPedido').hidden = unidades === 0;
  document.getElementById('resumenPedido').textContent =
    `Ver mi pedido · ${unidades} ${unidades === 1 ? 'planta' : 'plantas'} · ${lempiras(total)}`;
  document.getElementById('totalPedido').textContent = 'Total: ' + lempiras(total);
  document.getElementById('listaPedido').innerHTML = lineas.map((l) => `
    <div class="linea-pedido">
      <div class="nom">${esc(l.p.nombre)}<br><small style="color:var(--gris)">${lempiras(l.p.precio)} c/u</small></div>
      <div class="cantidad">
        <button data-id="${esc(l.id)}" data-d="-1" aria-label="Quitar uno">−</button>
        <span>${l.cantidad}</span>
        <button data-id="${esc(l.id)}" data-d="1" aria-label="Agregar uno">+</button>
      </div>
      <div class="sub">${lempiras(l.cantidad * l.p.precio)}</div>
    </div>`).join('');
  document.querySelectorAll('.linea-pedido button').forEach((b) => b.addEventListener('click', () => {
    const l = pedido.find((x) => x.id === b.dataset.id);
    l.cantidad += Number(b.dataset.d);
    pedido = pedido.filter((x) => x.cantidad > 0);
    guardarPedido();
    dibujarPedido();
    if (!pedido.length) cerrarFicha();
  }));
}
document.getElementById('btnVerPedido').addEventListener('click', () => {
  document.getElementById('velo').hidden = false;
  document.getElementById('panelPedido').hidden = false;
});
document.getElementById('btnVaciarPedido').addEventListener('click', () => {
  pedido = [];
  guardarPedido();
  dibujarPedido();
  cerrarFicha();
});
document.getElementById('btnEnviarPedido').addEventListener('click', () => {
  const lineas = lineasPedido();
  if (!lineas.length) return;
  const total = lineas.reduce((s, l) => s + l.cantidad * (Number(l.p.precio) || 0), 0);
  const texto =
    `Hola ${config.negocio || 'Encantos'} 🌿, quiero hacer este pedido:\n\n` +
    lineas.map((l) => `• ${l.cantidad} × ${l.p.nombre} — ${lempiras(l.cantidad * l.p.precio)}`).join('\n') +
    `\n\n*Total: ${lempiras(total)}*\n¿Me confirman disponibilidad y entrega?`;
  window.open(enlaceWhatsApp(texto), '_blank', 'noopener');
});

// ---------- Compartir ----------
async function compartir(titulo, url) {
  if (navigator.share) {
    try { await navigator.share({ title: titulo, text: titulo, url }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  window.open('https://wa.me/?text=' + encodeURIComponent(titulo + '\n' + url), '_blank', 'noopener');
}
document.getElementById('btnCompartir').addEventListener('click', () => {
  // Una sola categoría sin otros filtros: usar el enlace con vista previa propia
  const url = estado.cat && !estado.luz && !estado.q
    ? new URL(`c/${estado.cat}.html`, location.href).toString()
    : location.href;
  compartir(`${document.getElementById('tituloSeccion').textContent} · ${config.negocio || 'Encantos'} 🌿`, url);
});

// ---------- Búsqueda ----------
const inputBuscar = document.getElementById('buscar');
inputBuscar.value = estado.q;
inputBuscar.addEventListener('input', () => {
  estado.q = inputBuscar.value;
  clearTimeout(inputBuscar._t);
  inputBuscar._t = setTimeout(dibujarTodo, 150);
});

cargar();
