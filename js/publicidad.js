// publicidad.js — Fase 1 del "bot" de publicidad de Encantos.
//
// 1) "✨ Completar ficha con IA": con el nombre (o el nombre científico que da
//    Pl@ntNet) le pide a la IA de Cloudflare la ficha de cuidados y una
//    descripción para clientes. Solo llena lo que está vacío; siempre se revisa
//    antes de guardar.
// 2) "📣 Crear publicación": arma una imagen lista para Facebook, Instagram o
//    estados de WhatsApp (foto + nombre + precio + cuidados) y un texto con el
//    enlace a la planta en el catálogo. Se comparte con el menú del teléfono.
//
// La IA vive en un Worker de Cloudflare (carpeta worker/). La dirección se
// puede cambiar desde la app y se guarda en ajustes/ia (solo la ve el equipo).

const IA_URL_PREDETERMINADA = 'https://encantos-ia.juceas19.workers.dev';
const AJUSTE_IA = 'ia';
let urlIA = null;

async function obtenerUrlIA() {
  if (urlIA) return urlIA;
  const doc = await DB.obtener(DB.STORES.ajustes, AJUSTE_IA).catch(() => null);
  urlIA = (doc && doc.workerUrl) || IA_URL_PREDETERMINADA;
  return urlIA;
}

async function cambiarUrlIA() {
  const actual = await obtenerUrlIA();
  const nueva = prompt('Dirección del Worker de IA en Cloudflare (termina en .workers.dev):', actual);
  if (!nueva) return false;
  const limpia = nueva.trim().replace(/\/+$/, '');
  if (!/^https:\/\/[a-z0-9.-]+\.[a-z]{2,}$/i.test(limpia)) { alert('Esa dirección no parece válida. Debe empezar con https://'); return false; }
  await DB.actualizar(DB.STORES.ajustes, { id: AJUSTE_IA, workerUrl: limpia, actualizadoEl: new Date().toISOString() });
  urlIA = limpia;
  return true;
}

async function llamarIA(ruta, cuerpo) {
  const base = await obtenerUrlIA();
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), 45000);
  let r;
  try {
    r = await fetch(base + ruta, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
      signal: control.signal,
    });
  } catch (e) {
    throw Object.assign(new Error(navigator.onLine === false
      ? 'No hay internet. La IA necesita conexión.'
      : 'No se pudo conectar con la IA. Revisa que el Worker "encantos-ia" esté publicado en Cloudflare.'), { tipo: 'red' });
  } finally { clearTimeout(reloj); }
  let datos = {};
  try { datos = await r.json(); } catch (e) { /* respuesta vacía */ }
  if (!r.ok) throw Object.assign(new Error(datos.error || `La IA respondió con un error (${r.status}).`), { tipo: r.status === 403 ? 'red' : '' });
  return datos;
}

// ---------------------------------------------------------------------------
// 1) Completar la ficha de la planta con IA
// ---------------------------------------------------------------------------

function _elegirOpcion(idSelect, valor) {
  const sel = document.getElementById(idSelect);
  if (!sel || sel.value || !valor) return false;
  if (![...sel.options].some((o) => o.value === valor)) return false;
  sel.value = valor;
  return true;
}

async function completarFichaConIA({ auto = false } = {}) {
  const nombre = document.getElementById('campoNombre').value.trim();
  const cientifico = document.getElementById('campoNombreCientifico').value.trim();
  const categoria = document.getElementById('campoCategoria').value;
  const nota = document.getElementById('notaIdentificacion');
  const boton = document.getElementById('btnCompletarIA');

  if (!nombre && !cientifico) {
    nota.classList.add('sin-ficha');
    nota.textContent = '✍️ Escribe primero el nombre de la planta (por ejemplo "lengua de suegra") o identifícala con la foto.';
    return;
  }

  const textoBoton = boton.textContent;
  boton.disabled = true;
  boton.textContent = '⏳ Buscando información...';
  nota.classList.remove('sin-ficha');
  nota.textContent = auto ? '🔎 No tenía la ficha de cuidados guardada: la estoy buscando con IA...' : '';

  try {
    const f = await llamarIA('/ficha', { nombre, cientifico, categoria });
    const llenados = [];
    if (!nombre && f.nombreComun) { document.getElementById('campoNombre').value = f.nombreComun; llenados.push('nombre'); }
    const campoCient = document.getElementById('campoNombreCientifico');
    if (!campoCient.value.trim() && f.nombreCientifico) { campoCient.value = f.nombreCientifico; llenados.push('nombre científico'); }

    // Categoría: solo en productos nuevos y si la IA reconoce la planta
    if (!productoEditandoId && f.reconocida && f.categoria && f.categoria !== categoria &&
        Inventario.CATEGORIAS.includes(f.categoria)) {
      document.getElementById('campoCategoria').value = f.categoria;
      actualizarFormularioSegunCategoria();
      llenados.push('categoría');
    }

    [['campoTipoSol', f.tipoSol, 'luz'], ['campoRiego', f.riego, 'riego'], ['campoUbicacion', f.ubicacion, 'ubicación'],
      ['campoDificultad', f.dificultad, 'cuidado'], ['campoMascotas', f.mascotas, 'mascotas']]
      .forEach(([id, v, t]) => { if (_elegirOpcion(id, v)) llenados.push(t); });

    const tam = document.getElementById('campoTamanoAdulto');
    if (!tam.value.trim() && f.tamanoAdulto) { tam.value = f.tamanoAdulto; llenados.push('tamaño adulto'); }

    const marcar = (texto) => {
      const chk = [...document.querySelectorAll('#campoEtiquetas input')].find((i) => i.value === texto);
      if (chk && !chk.checked) { chk.checked = true; llenados.push(`"${texto}"`); }
    };
    if (f.paraPrincipiantes) marcar('Para principiantes');
    if (f.pocaLuz) marcar('Poca luz');

    const desc = document.getElementById('campoDescripcion');
    const descActual = desc.value.trim();
    if (f.descripcion) {
      const otros = (f.otrosNombres || []).filter((n) => n.toLowerCase() !== (nombre || f.nombreComun).toLowerCase());
      const nueva = f.descripcion + (otros.length ? ` También conocida como ${otros.join(', ')}.` : '');
      // Si está vacía, o solo tiene la frase corta que pone la identificación, se reemplaza
      if (!descActual || descActual.length < 60) { desc.value = nueva; llenados.push('descripción'); }
    }

    nota.classList.toggle('sin-ficha', !f.reconocida);
    nota.textContent = (f.reconocida ? '✨ ' : '⚠️ La IA no está segura de qué planta es. ') +
      (llenados.length ? `Se llenó con IA: ${llenados.join(', ')}.` : 'Todo ya estaba lleno, no se cambió nada.') +
      ' Revisa antes de guardar: la IA puede equivocarse.';
    if (typeof actualizarAvisoCatalogo === 'function') actualizarAvisoCatalogo();
  } catch (err) {
    nota.classList.add('sin-ficha');
    nota.textContent = '⚠️ ' + err.message;
    if (err.tipo === 'red' && !auto && confirm(err.message + '\n\n¿Quieres revisar la dirección de la IA?')) {
      if (await cambiarUrlIA()) completarFichaConIA();
    }
  } finally {
    boton.disabled = false;
    boton.textContent = textoBoton;
  }
}

function actualizarBotonIA() {
  const b = document.getElementById('btnCompletarIA');
  if (!b) return;
  const cat = Inventario.infoCategoria(document.getElementById('campoCategoria').value);
  b.style.display = cat.grupo === 'planta' ? 'block' : 'none';
}

// ---------------------------------------------------------------------------
// 2) Crear publicación (imagen + texto)
// ---------------------------------------------------------------------------

const FORMATOS_PUB = {
  cuadrada: { w: 1080, h: 1080, texto: '⬛ Feed (cuadrada)' },
  historia: { w: 1080, h: 1920, texto: '📱 Estado / historia' },
};

function _cargarImagen(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function _rectRedondo(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Parte el texto en líneas que quepan en "ancho" (máximo "maxLineas")
function _lineas(ctx, texto, ancho, maxLineas) {
  const palabras = String(texto).split(/\s+/);
  const lineas = [];
  let actual = '';
  palabras.forEach((p) => {
    const prueba = actual ? actual + ' ' + p : p;
    if (ctx.measureText(prueba).width > ancho && actual) { lineas.push(actual); actual = p; } else actual = prueba;
  });
  if (actual) lineas.push(actual);
  if (lineas.length > maxLineas) {
    const cortadas = lineas.slice(0, maxLineas);
    cortadas[maxLineas - 1] = cortadas[maxLineas - 1].replace(/\s*\S*$/, '') + '…';
    return cortadas;
  }
  return lineas;
}

function _precioCorto(n) {
  return 'L ' + (Number(n) || 0).toLocaleString('es-HN', { maximumFractionDigits: 2 });
}

async function dibujarPublicacion(canvas, p, formato, negocio) {
  const { w, h } = FORMATOS_PUB[formato];
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const fuente = (peso, tam) => `${peso} ${tam}px -apple-system, Roboto, "Segoe UI", sans-serif`;

  // Fondo: la foto ocupando todo (recortada al centro)
  ctx.fillStyle = '#f4f1ea';
  ctx.fillRect(0, 0, w, h);
  const foto = srcFotoSegura(p.foto);
  if (foto) {
    const img = await _cargarImagen(foto);
    const escala = Math.max(w / img.width, h / img.height);
    const iw = img.width * escala, ih = img.height * escala;
    ctx.drawImage(img, (w - iw) / 2, (h - ih) / 2, iw, ih);
  } else {
    ctx.font = fuente('400', 420);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(Inventario.infoCategoria(p.categoria).emoji || '🌿', w / 2, h * 0.38);
  }

  // Degradado oscuro abajo para que el texto se lea sobre cualquier foto
  const alto = formato === 'historia' ? h * 0.42 : h * 0.5;
  const grad = ctx.createLinearGradient(0, h - alto, 0, h);
  grad.addColorStop(0, 'rgba(24,44,24,0)');
  grad.addColorStop(0.45, 'rgba(24,44,24,0.72)');
  grad.addColorStop(1, 'rgba(24,44,24,0.94)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, h - alto, w, alto);

  const margen = 64;
  const arriba = formato === 'historia' ? 150 : 56;

  // Marca arriba a la izquierda
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = fuente('700', 40);
  const marca = '🌿 ' + negocio;
  const anchoMarca = ctx.measureText(marca).width + 56;
  ctx.fillStyle = 'rgba(63,107,63,0.92)';
  _rectRedondo(ctx, margen - 8, arriba, anchoMarca, 76, 38);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillText(marca, margen + 20, arriba + 40);

  // Sello de oferta arriba a la derecha
  if ((p.etiquetas || []).includes('Oferta')) {
    ctx.font = fuente('800', 42);
    const t = '🔥 OFERTA';
    const aw = ctx.measureText(t).width + 56;
    ctx.fillStyle = '#b3402f';
    _rectRedondo(ctx, w - margen - aw + 8, arriba, aw, 76, 38);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(t, w - margen - aw + 36, arriba + 40);
  }

  // Bloque de abajo (se dibuja de abajo hacia arriba)
  let y = h - (formato === 'historia' ? 190 : 64);
  ctx.textBaseline = 'alphabetic';

  ctx.font = fuente('600', 36);
  ctx.fillStyle = '#e6efe2';
  ctx.fillText(p.publicarCatalogo ? '📲 Pedí por WhatsApp · catálogo en línea' : '📲 Pedí por WhatsApp', margen, y);
  y -= 44;

  // Precio
  y -= 96;
  ctx.font = fuente('800', 64);
  const precio = _precioCorto(p.precio);
  const pw = ctx.measureText(precio).width + 64;
  ctx.fillStyle = '#f6d365';
  _rectRedondo(ctx, margen - 8, y, pw, 92, 46);
  ctx.fill();
  ctx.fillStyle = '#2c2c2c';
  ctx.fillText(precio, margen + 24, y + 68);
  if (p.tamanoMaceta) {
    ctx.font = fuente('600', 34);
    ctx.fillStyle = '#fff';
    ctx.fillText(`maceta ${p.tamanoMaceta}`, margen + pw + 16, y + 60);
  }
  y -= 28;

  // Cuidados
  const cuidados = [p.tipoSol && `☀️ ${p.tipoSol}`, p.riego && `💧 ${p.riego}`].filter(Boolean).join('   ');
  if (cuidados) {
    ctx.font = fuente('500', 36);
    ctx.fillStyle = '#ffffff';
    const lin = _lineas(ctx, cuidados, w - margen * 2, 2);
    for (let i = lin.length - 1; i >= 0; i--) { ctx.fillText(lin[i], margen, y); y -= 48; }
    y -= 8;
  }

  // Nombre
  ctx.font = fuente('800', 82);
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 12;
  const nom = _lineas(ctx, p.nombre || '', w - margen * 2, 2);
  for (let i = nom.length - 1; i >= 0; i--) { ctx.fillText(nom[i], margen, y); y -= 92; }
  ctx.shadowBlur = 0;
}

// Textos sin IA: plantillas que se van rotando con "🔄 Otro texto"
function textosPlantilla(p, negocio) {
  const precio = _precioCorto(p.precio);
  const oferta = (p.etiquetas || []).includes('Oferta');
  const desc = String(p.descripcion || '').split(/(?<=[.!?])\s+/)[0] || '';
  const cuidado = [p.tipoSol && `☀️ ${p.tipoSol}`, p.riego && `💧 Riego: ${p.riego.toLowerCase()}`].filter(Boolean).join('\n');
  const cat = Inventario.infoCategoria(p.categoria);
  const etiqueta = '#' + String(cat.nombre).split(/[ /,]/)[0].normalize('NFD').replace(/[̀-ͯ]/g, '');
  const tags = `#${negocio.replace(/\s+/g, '')} #PlantasHonduras #Olancho ${etiqueta}`;
  const principiantes = (p.etiquetas || []).includes('Para principiantes');
  return [
    `${oferta ? '🔥 ¡OFERTA! ' : '🌿 '}${p.nombre} disponible en ${negocio}\n\n${desc ? desc + '\n\n' : ''}${cuidado ? cuidado + '\n' : ''}💰 ${precio}${p.tamanoMaceta ? ` (maceta ${p.tamanoMaceta})` : ''}\n\n📲 Escribinos por WhatsApp y apartala.\n${tags}`,
    `¿Buscás una planta ${principiantes ? 'fácil de cuidar' : 'que le dé vida a tu casa'}? 🪴\n\nTe presentamos ${p.nombre}.${p.tipoSol ? ` Le gusta: ${p.tipoSol.toLowerCase()}.` : ''}${p.riego ? ` Riego: ${p.riego.toLowerCase()}.` : ''}\n\nLa tenemos en ${precio} 💚\nPedila por WhatsApp 📲\n${tags}`,
    `🎁 ¿Un regalo diferente? Una ${p.nombre} 🌸\n\nUn detalle vivo que dura y alegra cualquier espacio.\n💰 ${precio}\n\nHacé tu pedido por WhatsApp 📲 ${oferta ? '¡Precio de oferta por tiempo limitado! 🔥' : ''}\n${tags}`,
  ].map((t) => t.replace(/\n{3,}/g, '\n\n').trim());
}

async function crearPublicacion(producto) {
  const config = await Catalogo.obtenerConfig().catch(() => ({}));
  const negocio = config.negocio || 'Encantos';
  const yo = (config.vendedores || []).find((v) => v.correo && v.correo === correoSesion());
  const enlace = producto.publicarCatalogo
    ? urlCatalogo('catalogo.html') + '#p=' + encodeURIComponent(producto.id) + (yo && yo.whatsapp ? '&v=' + yo.id : '')
    : '';

  let formato = 'cuadrada';
  let textos = textosPlantilla(producto, negocio);
  let iTexto = 0;
  const conEnlace = (t) => (enlace && !t.includes(enlace) ? `${t}\n\n👉 Mirala aquí: ${enlace}` : t);

  const velo = document.createElement('div');
  velo.className = 'modal-overlay activo menu-acciones publicacion';
  velo.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <h2>📣 Crear publicación</h2>
      <div class="pub-formatos">
        ${Object.entries(FORMATOS_PUB).map(([k, f]) => `<button type="button" class="pub-formato${k === formato ? ' activo' : ''}" data-formato="${k}">${f.texto}</button>`).join('')}
      </div>
      <canvas class="pub-lienzo" aria-label="Vista previa de la imagen"></canvas>
      <label class="pub-label">Texto de la publicación</label>
      <textarea class="pub-texto" rows="8"></textarea>
      <div class="pub-fila">
        <button type="button" class="btn secundario" data-accion="otro">🔄 Otro texto</button>
        <button type="button" class="btn secundario" data-accion="ia">✨ Texto con IA</button>
      </div>
      <p class="m-error pub-error"></p>
      ${producto.publicarCatalogo ? '' : '<p class="pub-nota">ℹ️ Esta planta no está publicada en el catálogo, por eso el texto no lleva enlace. Actívalo en "Editar" si quieres que lo lleve.</p>'}
      <button type="button" class="btn" data-accion="compartir">📤 Compartir imagen y texto</button>
      <div class="pub-fila">
        <button type="button" class="btn secundario" data-accion="descargar">⬇️ Guardar imagen</button>
        <button type="button" class="btn secundario" data-accion="copiar">📋 Copiar texto</button>
      </div>
      <p class="pub-nota">Al compartir, el texto también queda copiado: si Facebook o Instagram no lo ponen solo, mantén presionado y toca <b>Pegar</b>. Los estados de WhatsApp se publican desde el menú de compartir.</p>
      <button type="button" class="btn btn-cancelar" data-accion="cerrar">Cerrar</button>
    </div>`;
  document.body.appendChild(velo);

  const lienzo = velo.querySelector('.pub-lienzo');
  const area = velo.querySelector('.pub-texto');
  const error = velo.querySelector('.pub-error');
  area.value = conEnlace(textos[0]);

  const redibujar = async () => {
    lienzo.classList.toggle('historia', formato === 'historia');
    try { await dibujarPublicacion(lienzo, producto, formato, negocio); }
    catch (e) { error.textContent = 'No se pudo armar la imagen: ' + e.message; }
  };
  await redibujar();

  const aBlob = () => new Promise((res) => lienzo.toBlob(res, 'image/jpeg', 0.9));
  const nombreArchivo = () => `${negocio}-${producto.nombre}`.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() + `-${formato}.jpg`;
  const copiar = async () => {
    try { await navigator.clipboard.writeText(area.value); return true; } catch (e) { return false; }
  };
  const descargar = async () => {
    const blob = await aBlob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nombreArchivo();
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  };

  velo.addEventListener('click', async (e) => {
    if (e.target === velo) { velo.remove(); return; }
    const bf = e.target.closest('[data-formato]');
    if (bf) {
      formato = bf.dataset.formato;
      velo.querySelectorAll('.pub-formato').forEach((b) => b.classList.toggle('activo', b === bf));
      await redibujar();
      return;
    }
    const b = e.target.closest('[data-accion]');
    if (!b) return;
    error.textContent = '';
    const accion = b.dataset.accion;

    if (accion === 'cerrar') { velo.remove(); return; }
    if (accion === 'otro') { iTexto = (iTexto + 1) % textos.length; area.value = conEnlace(textos[iTexto]); return; }
    if (accion === 'copiar') { b.textContent = (await copiar()) ? '✅ Copiado' : '⚠️ No se pudo copiar'; setTimeout(() => { b.textContent = '📋 Copiar texto'; }, 1800); return; }
    if (accion === 'descargar') { await descargar(); return; }

    if (accion === 'ia') {
      const original = b.textContent;
      b.disabled = true;
      b.textContent = '⏳ Escribiendo...';
      try {
        const r = await llamarIA('/textos', {
          nombre: producto.nombre, precio: _precioCorto(producto.precio), descripcion: producto.descripcion,
          tipoSol: producto.tipoSol, riego: producto.riego, categoria: Inventario.infoCategoria(producto.categoria).nombre,
          negocio, oferta: (producto.etiquetas || []).includes('Oferta'),
        });
        textos = r.textos.concat(textosPlantilla(producto, negocio));
        iTexto = 0;
        area.value = conEnlace(textos[0]);
      } catch (err) {
        error.textContent = err.message;
      } finally { b.disabled = false; b.textContent = original; }
      return;
    }

    if (accion === 'compartir') {
      const copiado = await copiar();
      const blob = await aBlob();
      const archivo = new File([blob], nombreArchivo(), { type: 'image/jpeg' });
      if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
        try { await navigator.share({ files: [archivo], text: area.value }); return; }
        catch (err) { if (err && err.name === 'AbortError') return; }
      }
      // Sin menú de compartir con imágenes (computadora): se guarda la imagen
      await descargar();
      alert(`Se guardó la imagen${copiado ? ' y el texto quedó copiado' : ''}. Súbela a la red social que quieras${copiado ? ' y pega el texto' : ''}.`);
    }
  });
}

window.Publicidad = { completarFichaConIA, actualizarBotonIA, crearPublicacion, cambiarUrlIA, textosPlantilla, dibujarPublicacion };

// Botón del formulario de producto
document.getElementById('btnCompletarIA')?.addEventListener('click', () => completarFichaConIA());
document.getElementById('campoCategoria')?.addEventListener('change', actualizarBotonIA);
