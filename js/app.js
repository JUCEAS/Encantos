// app.js — Controlador principal: navegación entre pestañas y conexión de la interfaz

let productoEditandoId = null;
let productoEditandoCreadoEl = null;
let fotoTemporalDataUrl = null;
let embeddingTemporal = null;
let ventaProductoActual = null;
let clienteEditandoId = null;
let clienteEditandoCreadoEl = null;
let proveedorEditandoId = null;
let proveedorEditandoCreadoEl = null;

// ---------- Navegación entre pestañas ----------
document.querySelectorAll('.tabbar .tab').forEach((btn) => {
  btn.addEventListener('click', () => cambiarVista(btn.dataset.vista));
});

function cambiarVista(nombre) {
  // "Agotados" usa la misma pantalla de Inventario, filtrada solo a los agotados
  const filtroCat = document.getElementById('filtroCategoria');
  if (nombre === 'agotados' || (nombre === 'inventario' && filtroCat.value === '__agotados')) {
    filtroCat.value = nombre === 'agotados' ? '__agotados' : '';
    document.getElementById('buscarTexto').value = '';
    window.scrollTo({ top: 0 });
  }
  const vista = nombre === 'agotados' ? 'inventario' : nombre;
  document.querySelectorAll('.vista').forEach((v) => v.classList.remove('activa'));
  document.getElementById('vista-' + vista).classList.add('activa');
  document.querySelectorAll('.tabbar .tab').forEach((b) => b.classList.toggle('activo', b.dataset.vista === nombre));

  document.getElementById('btnAgregar').style.display = (nombre === 'inventario' || nombre === 'compras' || nombre === 'clientes' || nombre === 'proveedores') ? 'block' : 'none';

  if (vista === 'inventario') refrescarInventario();
  if (nombre === 'ventas') refrescarVentas();
  if (nombre === 'compras') refrescarCompras();
  if (nombre === 'clientes') refrescarClientes();
  if (nombre === 'proveedores') refrescarProveedores();
}

// ---------- Botón flotante "+" según la pestaña activa ----------
document.getElementById('btnAgregar').addEventListener('click', () => {
  const vistaActiva = document.querySelector('.vista.activa').id;
  if (vistaActiva === 'vista-inventario') abrirModalProducto();
  if (vistaActiva === 'vista-clientes') abrirModalCliente();
  if (vistaActiva === 'vista-proveedores') abrirModalProveedor();
  if (vistaActiva === 'vista-compras') abrirModalCompra();
});

// Menú de acciones (reemplaza los confirm "Aceptar = … / Cancelar = …",
// que eran confusos). Devuelve el id de la opción elegida o null.
function elegirAccion(titulo, opciones, mensaje = '', textoCancelar = 'Cancelar') {
  return new Promise((resolve) => {
    const velo = document.createElement('div');
    velo.className = 'modal-overlay activo menu-acciones';
    velo.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true">
        <h2>${escaparHtml(titulo)}</h2>
        ${mensaje ? `<p class="mensaje-accion">${escaparHtml(mensaje)}</p>` : ''}
        ${opciones.map((o) => `<button class="btn ${o.principal ? '' : 'secundario'}" data-accion="${escaparHtml(o.id)}">${escaparHtml(o.texto)}</button>`).join('')}
        <button class="btn btn-cancelar" data-accion="">${escaparHtml(textoCancelar)}</button>
      </div>`;
    const cerrar = (valor) => { velo.remove(); resolve(valor || null); };
    velo.addEventListener('click', (e) => {
      const b = e.target.closest('[data-accion]');
      if (b) cerrar(b.dataset.accion);
      else if (e.target === velo) cerrar(null);
    });
    document.body.appendChild(velo);
  });
}

// Ventana para anular: motivo (obligatorio), nota y, en ventas, si la planta
// regresa al inventario. Devuelve { motivo, nota, regresaInventario } o null.
function pedirMotivo({ titulo, mensaje = '', motivos, conRegreso = false, textoBoton = 'Anular' }) {
  return new Promise((resolve) => {
    const velo = document.createElement('div');
    velo.className = 'modal-overlay activo menu-acciones';
    velo.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true">
        <h2>${escaparHtml(titulo)}</h2>
        ${mensaje ? `<p class="mensaje-accion">${escaparHtml(mensaje)}</p>` : ''}
        <label>¿Por qué se anula?</label>
        <select class="m-motivo"><option value="">— Elige el motivo —</option>${motivos.map((m) => `<option value="${escaparHtml(m.id)}">${escaparHtml(m.texto)}</option>`).join('')}</select>
        <label>Nota (opcional)</label>
        <textarea class="m-nota" rows="2" maxlength="300" placeholder="Ej.: no le gustó el color y la cambió por una Monstera"></textarea>
        ${conRegreso ? '<label class="m-regreso"><input type="checkbox" class="m-check" checked> La planta regresa al inventario (se suma al stock)</label>' : ''}
        <p class="m-error"></p>
        <button class="btn peligro" data-accion="ok">${escaparHtml(textoBoton)}</button>
        <button class="btn btn-cancelar" data-accion="">Cancelar</button>
      </div>`;
    const sel = velo.querySelector('.m-motivo');
    const nota = velo.querySelector('.m-nota');
    const check = velo.querySelector('.m-check');
    const error = velo.querySelector('.m-error');
    sel.addEventListener('change', () => {
      const m = motivos.find((x) => x.id === sel.value);
      if (check && m && typeof m.regresa === 'boolean') check.checked = m.regresa;
      nota.placeholder = sel.value === 'otro' ? 'Escribe el motivo (obligatorio)' : 'Ej.: detalles de lo que pasó';
      error.textContent = '';
    });
    const cerrar = (valor) => { velo.remove(); resolve(valor); };
    velo.addEventListener('click', (e) => {
      const b = e.target.closest('[data-accion]');
      if (!b) { if (e.target === velo) cerrar(null); return; }
      if (b.dataset.accion !== 'ok') { cerrar(null); return; }
      if (!sel.value) { error.textContent = 'Elige el motivo.'; return; }
      if (sel.value === 'otro' && !nota.value.trim()) { error.textContent = 'Escribe en la nota cuál fue el motivo.'; return; }
      cerrar({ motivo: sel.value, nota: nota.value.trim(), regresaInventario: check ? check.checked : true });
    });
    document.body.appendChild(velo);
  });
}

// Texto del historial de una anulación (motivo, nota, si regresó al inventario)
function textoAnulacion(x, conRegreso = false) {
  let t = `Anulada el ${new Date(x.anuladaEl).toLocaleString()}${x.anuladaPor ? ' por ' + x.anuladaPor : ''}`;
  if (x.motivoAnulacion) t += `. Motivo: ${x.motivoAnulacion}`;
  if (x.notaAnulacion) t += ` — "${x.notaAnulacion}"`;
  if (conRegreso && x.regresoInventario === false) t += '. La planta NO regresó al inventario';
  return t + '.';
}

function mostrarModal(id) { document.getElementById(id).classList.add('activo'); }
function ocultarModal(id) { document.getElementById(id).classList.remove('activo'); }

// =========================================================
// INVENTARIO
// =========================================================

// Pestaña "⛔ Agotados" de la barra de abajo: muestra cuántos hay y se marca
// cuando se están viendo los agotados (también si se eligen desde el filtro)
async function actualizarBotonAgotados() {
  const insignia = document.getElementById('insigniaAgotados');
  if (!insignia) return;
  const total = (await Inventario.listarProductos()).filter((p) => (Number(p.stock) || 0) <= 0).length;
  insignia.textContent = total > 99 ? '99+' : String(total);
  insignia.hidden = total === 0;
  if (document.getElementById('vista-inventario').classList.contains('activa')) {
    const enModo = document.getElementById('filtroCategoria').value === '__agotados';
    document.querySelector('.tabbar .tab[data-vista="inventario"]').classList.toggle('activo', !enModo);
    document.getElementById('tabAgotados').classList.toggle('activo', enModo);
    document.getElementById('btnAgregar').style.display = enModo ? 'none' : 'block';
  }
}

async function refrescarInventario(filtro = '') {
  const contenedor = document.getElementById('listaProductos');
  actualizarBotonAgotados();
  let productos = filtro ? await Inventario.buscarPorTexto(filtro) : await Inventario.listarProductos();
  const hayProductos = productos.length > 0;

  const filtroCat = document.getElementById('filtroCategoria').value;
  if (filtroCat === '__catalogo') productos = productos.filter((p) => p.publicarCatalogo);
  else if (filtroCat === '__no_catalogo') productos = productos.filter((p) => !p.publicarCatalogo);
  else if (filtroCat === '__agotados') productos = productos.filter((p) => (Number(p.stock) || 0) <= 0);
  else if (filtroCat) productos = productos.filter((p) => p.categoria === filtroCat);

  // Aviso si una venta sin internet dejó algún stock en negativo
  const negativos = productos.filter((p) => p.stock < 0);
  const avisoNegativo = negativos.length
    ? `<div class="card" style="background:#fbe9e6;border:1px solid #e8b9b0;display:block;font-size:13px;line-height:1.4;">
        ⚠️ <strong>Se vendió más de lo que había</strong> en: ${negativos.map((p) => escaparHtml(p.nombre) + ' (' + p.stock + ')').join(', ')}.
        Pasó porque se vendió la misma planta en los dos celulares y uno estaba sin internet.
        Revisen la venta y corrijan el stock editando el producto.
      </div>`
    : '';

  if (productos.length === 0) {
    contenedor.innerHTML = hayProductos
      ? '<div class="vacio">No hay productos con este filtro.</div>'
      : '<div class="vacio">Aún no hay productos. Toca "+" para agregar el primero.</div>';
    return;
  }

  const proveedores = await Proveedores.listarProveedores();
  const mapaProveedores = new Map(proveedores.map((pr) => [pr.id, pr]));

  const tarjeta = (p) => {
    let lineaOrigen = '';
    if (p.origen === 'Compra a proveedor') {
      const prov = mapaProveedores.get(p.proveedorId);
      lineaOrigen = `🚚 Proveedor: ${prov ? escaparHtml(prov.nombre) : 'no especificado'}`;
    } else if (p.origen === 'Reproducción propia') {
      lineaOrigen = '🌱 Reproducción propia';
    }
    return `
    <div class="card${p.stock <= 0 ? ' sin-stock' : ''}" data-id="${p.id}">
      <img class="foto-producto" src="${srcFotoSegura(p.foto)}" alt="" onerror="this.style.opacity=0">
      <div class="info">
        <span class="chip">${Inventario.infoCategoria(p.categoria).emoji} ${escaparHtml(p.categoria)}</span>
        ${p.publicarCatalogo ? '<span class="chip catalogo">🛒 En catálogo</span>' : ''}
        <h3>${escaparHtml(p.nombre)}</h3>
        <p>${escaparHtml(p.descripcion || '')}</p>
        ${(p.tipoSol || p.riego) ? `<p style="font-size:12px;color:#888;">${[p.tipoSol ? ({ 'Sol completo': '☀️ ', 'Medio sol': '⛅ ', 'Sombra': '🌥️ ' }[p.tipoSol] || '☀️ ') + escaparHtml(p.tipoSol) : '', p.riego ? '💧 ' + escaparHtml(p.riego) : ''].filter(Boolean).join(' &middot; ')}</p>` : ''}
        ${lineaOrigen ? `<p style="font-size:12px;color:#888;">${lineaOrigen}</p>` : ''}
        <p class="precio">L. ${(Number(p.precio) || 0).toFixed(2)} &middot; ${p.stock < 0 ? `<span class="agotado">⚠️ Stock ${p.stock}: se vendió de más</span>` : p.stock <= 0 ? '<span class="agotado">⛔ Agotado</span>' : `<span class="${p.stock <= 2 ? 'stock-bajo' : ''}">Stock: ${p.stock}</span>`}</p>
      </div>
    </div>
  `;
  };

  // Los agotados no ocupan la lista principal. Se ven con el botón fijo
  // "⛔ Agotados" (abajo, a la izquierda), al buscar por nombre o con el filtro.
  // Cuando se les pone stock, vuelven solos a la lista principal.
  const agotado = (p) => (Number(p.stock) || 0) <= 0;
  const enModoAgotados = filtroCat === '__agotados';
  let html = avisoNegativo;
  if (enModoAgotados) {
    html += '<div class="titulo-agotados">⛔ Productos agotados <small>Ponles inventario y regresan solos a la lista principal.</small></div>';
    html += productos.map(tarjeta).join('');
  } else if (filtro) {
    html += productos.map(tarjeta).join('');
  } else {
    const disponibles = productos.filter((p) => !agotado(p));
    html += disponibles.length
      ? disponibles.map(tarjeta).join('')
      : '<div class="vacio">No hay productos con existencias en esta vista.</div>';
  }
  contenedor.innerHTML = html;

  contenedor.querySelectorAll('.card[data-id]').forEach((card) => {
    card.addEventListener('click', () => mostrarOpcionesProducto(card.dataset.id));
  });
}

// Escapa texto para insertarlo en la pantalla, también dentro de atributos
// (value="...", data-...="..."). Evita que un nombre con comillas o etiquetas,
// o un respaldo manipulado, rompa la pantalla o ejecute código.
function escaparHtml(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Solo se aceptan fotos guardadas por la propia app (imágenes en base64)
function srcFotoSegura(foto) {
  return typeof foto === 'string' && /^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(foto) ? foto : '';
}

async function mostrarOpcionesProducto(id) {
  const productos = await Inventario.listarProductos();
  const producto = productos.find((p) => p.id === id);
  if (!producto) return;

  if ((Number(producto.stock) || 0) <= 0) {
    // Sin existencias: no se ofrece vender
    const accion = await elegirAccion(producto.nombre, [
      { id: 'comprar', texto: '🛒 Registrar compra (reabastecer)', principal: true },
      { id: 'editar', texto: '✏️ Editar o eliminar' },
    ], '⛔ No se puede vender: no hay existencias (stock 0). Si compraste más, registra la compra.');
    if (accion === 'comprar') abrirModalCompra(producto);
    else if (accion === 'editar') abrirModalProducto(producto);
    return;
  }

  const accion = await elegirAccion(producto.nombre, [
    { id: 'vender', texto: '💰 Vender', principal: true },
    { id: 'comprar', texto: '🛒 Registrar compra' },
    { id: 'interesados', texto: '💎 ¿Quién busca esta planta?' },
    { id: 'editar', texto: '✏️ Editar o eliminar' },
  ]);
  if (accion === 'interesados') {
    const hay = await avisarInteresados([producto], `💎 Interesados en ${producto.nombre}`);
    if (!hay) alert('Ningún cliente tiene esta planta (o su categoría) en su lista de plantas que anda buscando. Puedes agregarla en la ficha del cliente.');
    return;
  }
  if (accion === 'vender') abrirModalVenta(producto);
  else if (accion === 'comprar') abrirModalCompra(producto);
  else if (accion === 'editar') abrirModalProducto(producto);
}

document.getElementById('buscarTexto').addEventListener('input', (e) => refrescarInventario(e.target.value));

// Filtro por categoría / catálogo en la pestaña Inventario
(function llenarFiltroCategoria() {
  const sel = document.getElementById('filtroCategoria');
  const plantas = Inventario.CATEGORIAS_INFO.filter((c) => c.grupo === 'planta');
  const insumos = Inventario.CATEGORIAS_INFO.filter((c) => c.grupo === 'insumo');
  const opt = (c) => `<option value="${c.nombre}">${c.emoji} ${c.nombre}</option>`;
  sel.innerHTML = '<option value="">Todas las categorías</option>' +
    '<option value="__catalogo">🛒 Publicadas en catálogo</option>' +
    '<option value="__no_catalogo">🚫 No publicadas</option>' +
    '<option value="__agotados">⛔ Agotados</option>' +
    `<optgroup label="Plantas">${plantas.map(opt).join('')}</optgroup>` +
    `<optgroup label="Complementos">${insumos.map(opt).join('')}</optgroup>`;
  sel.addEventListener('change', () => refrescarInventario(document.getElementById('buscarTexto').value));
})();

function opcionesSelect(lista, textoVacio) {
  return `<option value="">${textoVacio}</option>` + lista.map((v) => `<option value="${v}">${v}</option>`).join('');
}

function esInsumo(nombreCategoria) {
  return Inventario.infoCategoria(nombreCategoria).grupo === 'insumo';
}

function actualizarFormularioSegunCategoria() {
  const insumo = esInsumo(document.getElementById('campoCategoria').value);
  document.getElementById('camposPlanta').style.display = insumo ? 'none' : 'block';
  actualizarAvisoCatalogo();
}

function actualizarAvisoCatalogo() {
  const aviso = document.getElementById('avisoCatalogo');
  if (!document.getElementById('campoPublicarCatalogo').checked) { aviso.textContent = ''; return; }
  const faltan = [];
  if (!fotoTemporalDataUrl) faltan.push('foto');
  if (!(parseFloat(document.getElementById('campoPrecio').value) > 0)) faltan.push('precio');
  if (!document.getElementById('campoDescripcion').value.trim()) faltan.push('descripción');
  if (!esInsumo(document.getElementById('campoCategoria').value)) {
    if (!document.getElementById('campoTipoSol').value) faltan.push('luz');
    if (!document.getElementById('campoRiego').value) faltan.push('riego');
  }
  aviso.textContent = faltan.length ? '⚠️ Para que se vea completa en el catálogo falta: ' + faltan.join(', ') + '.' : '';
}

['campoCategoria'].forEach((id) => document.getElementById(id).addEventListener('change', actualizarFormularioSegunCategoria));
['campoPublicarCatalogo', 'campoPrecio', 'campoDescripcion', 'campoTipoSol', 'campoRiego'].forEach((id) => {
  document.getElementById(id).addEventListener('input', actualizarAvisoCatalogo);
  document.getElementById(id).addEventListener('change', actualizarAvisoCatalogo);
});

async function abrirModalProducto(producto = null) {
  productoEditandoId = producto ? producto.id : null;
  productoEditandoCreadoEl = producto ? producto.creadoEl : null;
  fotoTemporalDataUrl = producto ? producto.foto : null;
  embeddingTemporal = producto ? producto.embedding : null;

  document.getElementById('tituloModalProducto').textContent = producto ? 'Editar producto' : 'Nuevo producto';

  const select = document.getElementById('campoCategoria');
  const opt = (c) => `<option value="${c.nombre}">${c.emoji} ${c.nombre}</option>`;
  select.innerHTML =
    `<optgroup label="Plantas">${Inventario.CATEGORIAS_INFO.filter((c) => c.grupo === 'planta').map(opt).join('')}</optgroup>` +
    `<optgroup label="Complementos">${Inventario.CATEGORIAS_INFO.filter((c) => c.grupo === 'insumo').map(opt).join('')}</optgroup>`;

  const selectSol = document.getElementById('campoTipoSol');
  selectSol.innerHTML = opcionesSelect(Inventario.TIPOS_SOL, 'Sin definir');
  const selectRiego = document.getElementById('campoRiego');
  selectRiego.innerHTML = opcionesSelect(Inventario.TIPOS_RIEGO, 'Sin definir');
  document.getElementById('campoUbicacion').innerHTML = opcionesSelect(Inventario.UBICACIONES, 'Sin definir');
  document.getElementById('campoDificultad').innerHTML = opcionesSelect(Inventario.DIFICULTADES, 'Sin definir');
  document.getElementById('campoMascotas').innerHTML = opcionesSelect(Inventario.MASCOTAS, 'No sé / sin definir');

  const etiquetasActuales = producto?.etiquetas || [];
  document.getElementById('campoEtiquetas').innerHTML = Inventario.ETIQUETAS.map((e) =>
    `<label><input type="checkbox" value="${e}" ${etiquetasActuales.includes(e) ? 'checked' : ''}>${e}</label>`
  ).join('');

  document.getElementById('campoNombre').value = producto?.nombre || '';
  select.value = producto?.categoria || Inventario.CATEGORIAS[0];
  document.getElementById('campoDescripcion').value = producto?.descripcion || '';
  selectSol.value = producto?.tipoSol || '';
  selectRiego.value = producto?.riego || '';
  document.getElementById('campoNombreCientifico').value = producto?.nombreCientifico || '';
  document.getElementById('campoUbicacion').value = producto?.ubicacion || '';
  document.getElementById('campoDificultad').value = producto?.dificultad || '';
  document.getElementById('campoMascotas').value = producto?.mascotas || '';
  document.getElementById('campoTamanoMaceta').value = producto?.tamanoMaceta || '';
  document.getElementById('campoTamanoAdulto').value = producto?.tamanoAdulto || '';
  document.getElementById('campoPublicarCatalogo').checked = !!producto?.publicarCatalogo;

  await refrescarSelectProveedorProducto(producto?.proveedorId || '');
  const selectOrigen = document.getElementById('campoOrigen');
  selectOrigen.value = producto?.origen || Inventario.ORIGENES[0];
  actualizarVisibilidadProveedorProducto();

  document.getElementById('campoCosto').value = producto?.costo ?? '';
  document.getElementById('campoPrecio').value = producto?.precio ?? '';
  document.getElementById('campoStock').value = producto?.stock ?? '';

  const preview = document.getElementById('previewFotoProducto');
  if (fotoTemporalDataUrl) {
    preview.src = fotoTemporalDataUrl;
    preview.style.display = 'block';
  } else {
    preview.style.display = 'none';
  }

  document.getElementById('filaEliminarProducto').style.display = producto ? 'flex' : 'none';
  actualizarFormularioSegunCategoria();

  mostrarModal('modalProducto');
}

async function refrescarSelectProveedorProducto(proveedorIdSeleccionado = '') {
  const proveedores = await Proveedores.listarProveedores();
  const select = document.getElementById('campoProveedorProducto');
  select.innerHTML = '<option value="">Selecciona un proveedor...</option>' +
    proveedores.map((pr) => `<option value="${pr.id}">${escaparHtml(pr.nombre)}${pr.empresa ? ' - ' + escaparHtml(pr.empresa) : ''}</option>`).join('');
  select.value = proveedorIdSeleccionado || '';
}

function actualizarVisibilidadProveedorProducto() {
  const esCompra = document.getElementById('campoOrigen').value === 'Compra a proveedor';
  document.getElementById('filaProveedorProducto').style.display = esCompra ? 'block' : 'none';
}

document.getElementById('campoOrigen').addEventListener('change', actualizarVisibilidadProveedorProducto);

document.getElementById('btnCancelarProducto').addEventListener('click', () => ocultarModal('modalProducto'));

document.getElementById('btnTomarFoto').addEventListener('click', () => {
  document.getElementById('inputCamaraProducto').click();
});
document.getElementById('btnElegirGaleria').addEventListener('click', () => {
  document.getElementById('inputGaleriaProducto').click();
});

async function manejarSeleccionFotoProducto(e) {
  const archivo = e.target.files[0];
  if (!archivo) return;
  const dataUrl = await leerArchivoComoDataUrl(archivo);
  const comprimida = await Inventario.comprimirImagen(dataUrl);
  fotoTemporalDataUrl = comprimida;

  const preview = document.getElementById('previewFotoProducto');
  preview.src = comprimida;
  preview.style.display = 'block';
  actualizarAvisoCatalogo();

  // Generar la huella visual en segundo plano para habilitar la búsqueda por foto
  try {
    const img = new Image();
    img.onload = async () => {
      embeddingTemporal = await BusquedaVisual.generarEmbedding(img);
    };
    img.src = comprimida;
  } catch (err) {
    console.warn('No se pudo generar huella visual', err);
  }
}

document.getElementById('inputCamaraProducto').addEventListener('change', manejarSeleccionFotoProducto);
document.getElementById('inputGaleriaProducto').addEventListener('change', manejarSeleccionFotoProducto);

function leerArchivoComoDataUrl(archivo) {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = (e) => resolve(e.target.result);
    lector.onerror = reject;
    lector.readAsDataURL(archivo);
  });
}

document.getElementById('btnGuardarProducto').addEventListener('click', async () => {
  const nombre = document.getElementById('campoNombre').value.trim();
  if (!nombre) { alert('Ingresa un nombre para el producto.'); return; }

  if (document.getElementById('campoOrigen').value === 'Compra a proveedor' && !document.getElementById('campoProveedorProducto').value) {
    if (!confirm('No seleccionaste un proveedor. ¿Guardar de todas formas?')) return;
  }

  const datosPlanta = !esInsumo(document.getElementById('campoCategoria').value);
  await Inventario.guardarProducto({
    id: productoEditandoId,
    creadoEl: productoEditandoCreadoEl,
    nombre,
    categoria: document.getElementById('campoCategoria').value,
    descripcion: document.getElementById('campoDescripcion').value,
    nombreCientifico: document.getElementById('campoNombreCientifico').value,
    tipoSol: document.getElementById('campoTipoSol').value,
    riego: document.getElementById('campoRiego').value,
    ubicacion: document.getElementById('campoUbicacion').value,
    dificultad: document.getElementById('campoDificultad').value,
    mascotas: document.getElementById('campoMascotas').value,
    tamanoMaceta: document.getElementById('campoTamanoMaceta').value,
    tamanoAdulto: document.getElementById('campoTamanoAdulto').value,
    etiquetas: [...document.querySelectorAll('#campoEtiquetas input:checked')].map((i) => i.value),
    ...(datosPlanta ? {} : { nombreCientifico: '', tipoSol: '', riego: '', ubicacion: '', dificultad: '', mascotas: '', tamanoAdulto: '' }),
    publicarCatalogo: document.getElementById('campoPublicarCatalogo').checked,
    origen: document.getElementById('campoOrigen').value,
    proveedorId: document.getElementById('campoProveedorProducto').value || null,
    costo: document.getElementById('campoCosto').value,
    precio: document.getElementById('campoPrecio').value,
    stock: document.getElementById('campoStock').value,
    foto: fotoTemporalDataUrl,
    embedding: embeddingTemporal,
  });

  ocultarModal('modalProducto');
  refrescarInventario();
});

document.getElementById('btnEliminarProducto').addEventListener('click', async () => {
  if (!productoEditandoId) return;
  if (!confirm('¿Eliminar este producto del inventario?')) return;
  await Inventario.eliminarProducto(productoEditandoId);
  ocultarModal('modalProducto');
  refrescarInventario();
});

// =========================================================
// CATÁLOGO PÚBLICO: compartir y datos
// =========================================================

function urlCatalogo(ruta) {
  return new URL(ruta, location.href).toString();
}

async function abrirModalCompartir() {
  mostrarModal('modalCompartir');
  document.getElementById('notaEnvio')?.remove();
  const lista = document.getElementById('listaCompartir');
  lista.innerHTML = '<div class="cargando">Cargando...</div>';

  const [productos, config] = await Promise.all([Inventario.listarProductos(), Catalogo.obtenerConfig()]);
  document.getElementById('avisoSinNumero').textContent = config.whatsapp
    ? ''
    : '⚠️ Aún no has puesto tu número de WhatsApp en "Datos del catálogo". Sin él, los pedidos de los clientes no te llegarán directo.';

  const publicados = productos.filter((p) => p.publicarCatalogo);
  if (!publicados.length) {
    lista.innerHTML = '<div class="vacio">Todavía no hay productos publicados. Edita una planta y activa "Publicar en el catálogo para clientes".</div>';
    return;
  }

  const cuentas = new Map();
  publicados.forEach((p) => {
    const c = Inventario.infoCategoria(p.categoria);
    const act = cuentas.get(c.id) || { info: c, n: 0 };
    act.n++;
    cuentas.set(c.id, act);
  });
  const orden = Inventario.CATEGORIAS_INFO.map((c) => c.id);
  const filas = [{ id: '', titulo: '🌿 Catálogo completo', n: publicados.length, url: urlCatalogo('catalogo.html') }]
    .concat([...cuentas.values()]
      .sort((a, b) => orden.indexOf(a.info.id) - orden.indexOf(b.info.id))
      .map(({ info, n }) => ({ id: info.id, titulo: `${info.emoji} ${info.nombre}`, n, url: urlCatalogo(`c/${info.id}.html`) })));

  const negocio = config.negocio || 'Encantos';

  // Si quien comparte es una vendedora registrada, sus enlaces llevan su firma
  const yo = (config.vendedores || []).find((v) => v.correo && v.correo === correoSesion());
  const conFirma = yo && yo.whatsapp;
  if (conFirma) filas.forEach((f) => { f.url += '#v=' + yo.id; });
  const numeroVisible = (n) => String(n).replace(/^504/, '').replace(/^(\d{4})(\d{4})$/, '$1-$2');
  document.getElementById('avisoSinNumero').insertAdjacentHTML('afterend',
    `<p class="nota-envio" id="notaEnvio">${conFirma
      ? `📲 Los pedidos de estos enlaces te llegarán a ti, <strong>${escaparHtml(yo.nombre)}</strong> (${escaparHtml(numeroVisible(yo.whatsapp))}).`
      : `📲 Los pedidos de estos enlaces llegarán al número principal${config.whatsapp ? ' (' + escaparHtml(numeroVisible(config.whatsapp)) + ')' : ''}.${yo ? ' Agrega tu WhatsApp en "Datos del catálogo" para recibirlos tú.' : ''}`}</p>`);

  lista.innerHTML = filas.map((f, i) => `
    <div class="fila-compartir">
      <div class="nom">${escaparHtml(f.titulo)}<br><small>${f.n} ${f.n === 1 ? 'producto' : 'productos'}</small></div>
      <button class="btn whatsapp" data-i="${i}" data-accion="wa">📤 Compartir</button>
      <button class="btn secundario" data-i="${i}" data-accion="ver">Ver</button>
    </div>`).join('');

  lista.querySelectorAll('button').forEach((b) => b.addEventListener('click', async () => {
    const f = filas[Number(b.dataset.i)];
    if (b.dataset.accion === 'ver') { window.open(f.url, '_blank', 'noopener'); return; }
    const texto = f.id
      ? `🌿 Mira nuestras plantas de *${f.titulo.replace(/^\S+\s/, '')}* en ${negocio}: fotos, precios y cuidados.\n${f.url}`
      : `🌿 Este es el catálogo de ${negocio}: fotos, precios y cuidados de cada planta. Puedes hacer tu pedido desde ahí.\n${f.url}`;
    // Menú "Compartir" del teléfono: deja elegir WhatsApp, WhatsApp Business,
    // Messenger, etc. (un enlace wa.me siempre abre la app predeterminada).
    if (navigator.share) {
      try { await navigator.share({ text: texto }); return; }
      catch (e) { if (e && e.name === 'AbortError') return; }
    }
    window.open('https://wa.me/?text=' + encodeURIComponent(texto), '_blank', 'noopener');
  }));
}

let vendedorasEditando = [];

function correoSesion() {
  try { return ((firebase.auth().currentUser || {}).email || '').toLowerCase(); } catch (e) { return ''; }
}

// Lee lo escrito en el formulario para no perderlo al agregar o quitar filas
function leerVendedorasDelFormulario() {
  document.querySelectorAll('#cfgVendedores .vendedora').forEach((fila) => {
    const v = vendedorasEditando[Number(fila.dataset.i)];
    if (!v) return;
    v.nombre = fila.querySelector('[data-campo="nombre"]').value;
    v.whatsapp = fila.querySelector('[data-campo="whatsapp"]').value;
    v.correo = fila.querySelector('[data-campo="correo"]').value;
  });
}

function dibujarVendedoras() {
  document.getElementById('cfgVendedores').innerHTML = vendedorasEditando.map((v, i) => `
    <div class="vendedora" data-i="${i}">
      <div class="dos-columnas">
        <div><label>Nombre</label><input type="text" data-campo="nombre" value="${escaparHtml(v.nombre || '')}" placeholder="Ej: Saira"></div>
        <div><label>WhatsApp</label><input type="tel" inputmode="tel" data-campo="whatsapp" value="${escaparHtml(v.whatsapp || '')}" placeholder="9876-5432"></div>
      </div>
      <label>Correo con el que entra a la app</label>
      <input type="email" data-campo="correo" value="${escaparHtml(v.correo || '')}" placeholder="nombre@gmail.com">
      <button type="button" class="quitar" data-quitar="${i}">Quitar vendedora</button>
    </div>`).join('') || '<p class="nota-catalogo">Aún no hay vendedoras. Todos los pedidos llegan al número principal.</p>';
  document.querySelectorAll('#cfgVendedores [data-quitar]').forEach((b) => b.addEventListener('click', () => {
    leerVendedorasDelFormulario();
    vendedorasEditando.splice(Number(b.dataset.quitar), 1);
    dibujarVendedoras();
  }));
}

async function abrirModalDatosCatalogo() {
  const config = await Catalogo.obtenerConfig();
  document.getElementById('cfgWhatsapp').value = config.whatsapp || '';
  document.getElementById('cfgNegocio').value = config.negocio || 'Encantos';
  document.getElementById('cfgBienvenida').value = config.bienvenida || '';
  document.getElementById('cfgUbicacion').value = config.ubicacion || '';
  vendedorasEditando = (config.vendedores || []).map((v) => ({ ...v }));
  if (!vendedorasEditando.length) {
    // Primera vez: propone a las dos cuentas que usan la app
    vendedorasEditando = [
      { id: 'encantos', nombre: 'Julio', whatsapp: config.whatsapp || '', correo: 'juceas19@gmail.com' },
      { id: 'saira', nombre: 'Saira', whatsapp: '', correo: 'sairareyes4@gmail.com' },
    ];
  }
  dibujarVendedoras();
  mostrarModal('modalDatosCatalogo');
}

document.getElementById('btnAgregarVendedora').addEventListener('click', () => {
  leerVendedorasDelFormulario();
  vendedorasEditando.push({ id: '', nombre: '', whatsapp: '', correo: '' });
  dibujarVendedoras();
});

document.getElementById('btnCompartirCatalogo').addEventListener('click', abrirModalCompartir);
document.getElementById('btnCerrarCompartir').addEventListener('click', () => ocultarModal('modalCompartir'));
document.getElementById('btnDatosCatalogo').addEventListener('click', abrirModalDatosCatalogo);
document.getElementById('btnCancelarDatos').addEventListener('click', () => ocultarModal('modalDatosCatalogo'));
document.getElementById('btnGuardarDatos').addEventListener('click', async () => {
  const numero = document.getElementById('cfgWhatsapp').value.replace(/[^0-9]/g, '');
  if (numero && numero.length < 8) { alert('El número de WhatsApp parece incompleto. Revisa que tenga al menos 8 dígitos.'); return; }
  leerVendedorasDelFormulario();
  const vendedores = [];
  for (const v of vendedorasEditando) {
    const nombre = (v.nombre || '').trim();
    const tel = (v.whatsapp || '').replace(/[^0-9]/g, '');
    if (!nombre && !tel) continue; // fila vacía
    if (!nombre) { alert('Falta el nombre de una vendedora.'); return; }
    if (tel && tel.length < 8) { alert(`El WhatsApp de ${nombre} parece incompleto.`); return; }
    const id = v.id || Catalogo.idVendedor(nombre, vendedores.map((x) => x.id));
    vendedores.push({ id, nombre, whatsapp: tel, correo: v.correo });
  }
  try {
    await Catalogo.guardarConfig({
      vendedores,
      whatsapp: numero,
      negocio: document.getElementById('cfgNegocio').value,
      bienvenida: document.getElementById('cfgBienvenida').value,
      ubicacion: document.getElementById('cfgUbicacion').value,
    });
    ocultarModal('modalDatosCatalogo');
    alert('Datos del catálogo guardados.');
  } catch (err) {
    alert('No se pudo guardar: ' + err.message);
  }
});

// ---------- Búsqueda por foto ----------
document.getElementById('btnBuscarFoto').addEventListener('click', () => {
  document.getElementById('previewFotoBusqueda').style.display = 'none';
  document.getElementById('resultadosBusquedaVisual').innerHTML = '';
  mostrarModal('modalBusquedaVisual');
});
document.getElementById('btnCerrarBusquedaVisual').addEventListener('click', () => ocultarModal('modalBusquedaVisual'));
document.getElementById('btnTomarFotoBusqueda').addEventListener('click', () => {
  document.getElementById('inputCamaraBusqueda').click();
});
document.getElementById('btnElegirGaleriaBusqueda').addEventListener('click', () => {
  document.getElementById('inputGaleriaBusqueda').click();
});

async function manejarSeleccionFotoBusqueda(e) {
  const archivo = e.target.files[0];
  if (!archivo) return;
  const dataUrl = await leerArchivoComoDataUrl(archivo);

  const preview = document.getElementById('previewFotoBusqueda');
  preview.src = dataUrl;
  preview.style.display = 'block';

  const resultadosDiv = document.getElementById('resultadosBusquedaVisual');
  resultadosDiv.innerHTML = '<div class="cargando">Analizando foto...</div>';

  try {
    const productos = await Inventario.listarProductos();
    const resultados = await BusquedaVisual.buscarPorFoto(dataUrl, productos, 5);

    if (resultados.length === 0) {
      resultadosDiv.innerHTML = '<div class="vacio">No hay productos con huella visual guardada aún, o no se encontró coincidencia. Prueba agregando fotos nuevas a tus productos.</div>';
      return;
    }

    resultadosDiv.innerHTML = resultados.map(({ producto, similitud }) => `
      <div class="resultado-visual" data-id="${producto.id}">
        <img src="${srcFotoSegura(producto.foto)}" alt="">
        <div>${escaparHtml(producto.nombre)}</div>
        <div class="similitud">${Math.round(similitud * 100)}%</div>
      </div>
    `).join('');

    resultadosDiv.querySelectorAll('.resultado-visual').forEach((el) => {
      el.addEventListener('click', async () => {
        const id = el.dataset.id;
        const productos = await Inventario.listarProductos();
        const producto = productos.find((p) => p.id === id);
        ocultarModal('modalBusquedaVisual');
        if (producto) mostrarOpcionesProducto(producto.id);
      });
    });
  } catch (err) {
    console.error(err);
    resultadosDiv.innerHTML = '<div class="vacio">No se pudo analizar la foto. Intenta de nuevo.</div>';
  }
}

document.getElementById('inputCamaraBusqueda').addEventListener('change', manejarSeleccionFotoBusqueda);
document.getElementById('inputGaleriaBusqueda').addEventListener('change', manejarSeleccionFotoBusqueda);

// =========================================================
// VENTAS
// =========================================================

// ---------- Corregir una venta (cantidad, precio, cliente) ----------
let ventaEnCorreccion = null;

async function abrirCorreccionVenta(venta) {
  const producto = venta.productoId ? await DB.obtener(DB.STORES.productos, venta.productoId) : null;
  ventaEnCorreccion = venta;
  const disponible = (producto ? Number(producto.stock) || 0 : 0) + (Number(venta.cantidad) || 0);
  // Para la ganancia se usa el costo que tenía la planta el día de la venta
  ventaProductoActual = { id: venta.productoId, nombre: venta.nombreProducto, costo: Number(venta.costoUnitario) || 0, stock: disponible };
  document.querySelector('#modalVenta h2').textContent = '✏️ Corregir venta';
  document.getElementById('btnConfirmarVenta').textContent = 'Guardar corrección';
  document.getElementById('ventaProductoNombre').textContent =
    `${venta.nombreProducto} · vendida el ${new Date(venta.fecha).toLocaleDateString()}` + (producto ? ` (puedes subir hasta ${disponible})` : '');
  const cant = document.getElementById('campoCantidadVenta');
  cant.value = venta.cantidad; cant.min = 1; cant.step = 1; cant.max = producto ? disponible : venta.cantidad;
  document.getElementById('campoPrecioVenta').value = (Number(venta.precioUnitario) || 0).toFixed(2);
  const clientes = await Clientes.listarClientes();
  const select = document.getElementById('campoClienteVenta');
  select.innerHTML = '<option value="">Cliente general</option>' +
    clientes.map((c) => `<option value="${escaparHtml(c.id)}">${escaparHtml(c.nombre)}</option>`).join('');
  select.value = venta.clienteId || '';
  actualizarGananciaEstimada();
  mostrarModal('modalVenta');
}

async function abrirModalVenta(producto) {
  if ((Number(producto.stock) || 0) <= 0) {
    alert(`⛔ No se puede vender "${producto.nombre}": no hay existencias (stock 0).`);
    return;
  }
  ventaEnCorreccion = null;
  document.querySelector('#modalVenta h2').textContent = 'Registrar venta';
  document.getElementById('btnConfirmarVenta').textContent = 'Confirmar venta';
  ventaProductoActual = producto;
  document.getElementById('ventaProductoNombre').textContent = `${producto.nombre} (stock: ${producto.stock})`;
  document.getElementById('campoCantidadVenta').value = 1;
  document.getElementById('campoCantidadVenta').min = 1;
  document.getElementById('campoCantidadVenta').step = 1;
  document.getElementById('campoCantidadVenta').max = producto.stock;
  document.getElementById('campoPrecioVenta').value = (Number(producto.precio) || 0).toFixed(2);

  const clientes = await Clientes.listarClientes();
  const select = document.getElementById('campoClienteVenta');
  select.innerHTML = '<option value="">Cliente general</option>' +
    clientes.map((c) => `<option value="${c.id}">${escaparHtml(c.nombre)}</option>`).join('');

  actualizarGananciaEstimada();
  mostrarModal('modalVenta');
}

// Desglose de una venta o de un período: venta − costo = ganancia, y los dos
// porcentajes. Ej.: costó 200 y se vendió en 400 → ganancia 200,
// 100% sobre el costo y 50% de la venta (margen).
function desglose(total, ganancia) {
  const t = Number(total) || 0;
  const g = Number(ganancia) || 0;
  const costo = t - g;
  return {
    venta: t,
    costo,
    ganancia: g,
    sobreCosto: costo > 0 ? (g / costo) * 100 : null,
    sobreVenta: t > 0 ? (g / t) * 100 : null,
  };
}
function pct(n) { return n === null ? '—' : `${Math.round(n * 10) / 10}%`; }

function actualizarGananciaEstimada() {
  if (!ventaProductoActual) return;
  const cantidad = parseInt(document.getElementById('campoCantidadVenta').value, 10) || 0;
  const precio = parseFloat(document.getElementById('campoPrecioVenta').value) || 0;
  const costoU = Number(ventaProductoActual.costo) || 0;
  const d = desglose(precio * cantidad, (precio - costoU) * cantidad);
  document.getElementById('desgloseVenta').innerHTML = `
    <div><span>Precio de venta (${cantidad} × ${formatoL(precio)})</span><b>${formatoL(d.venta)}</b></div>
    <div><span>− Costo (${cantidad} × ${formatoL(costoU)}, incluye transporte)</span><b>${formatoL(d.costo)}</b></div>
    <div class="total"><span>= Ganancia</span><b id="gananciaEstimada" class="${d.ganancia < 0 ? 'negativa' : ''}">${formatoL(d.ganancia)}</b></div>
    <div class="pcts"><span>📈 ${pct(d.sobreCosto)} sobre el costo</span><span>${pct(d.sobreVenta)} de la venta</span></div>
    ${costoU > 0 ? '' : '<div class="aviso">⚠️ Este producto no tiene costo registrado: la ganancia sale más alta de lo real.</div>'}`;
}

document.getElementById('campoCantidadVenta').addEventListener('input', actualizarGananciaEstimada);
document.getElementById('campoPrecioVenta').addEventListener('input', actualizarGananciaEstimada);
document.getElementById('btnCancelarVenta').addEventListener('click', () => { ventaEnCorreccion = null; ocultarModal('modalVenta'); });

document.getElementById('btnConfirmarVenta').addEventListener('click', async () => {
  if (ventaEnCorreccion) {
    const boton = document.getElementById('btnConfirmarVenta');
    if (boton.disabled) return;
    boton.disabled = true;
    try {
      const v = await Ventas.corregirVenta(ventaEnCorreccion.id, {
        clienteId: document.getElementById('campoClienteVenta').value || null,
        cantidad: document.getElementById('campoCantidadVenta').value,
        precioVenta: document.getElementById('campoPrecioVenta').value,
      });
      ventaEnCorreccion = null;
      ocultarModal('modalVenta');
      refrescarInventario(document.getElementById('buscarTexto').value);
      refrescarVentas();
      alert(`✅ Venta corregida: ${v.nombreProducto} ×${v.cantidad}, total ${formatoL(v.total)}. La versión anterior quedó como historial.`);
    } catch (err) {
      alert(err.message || 'No se pudo corregir la venta.');
    } finally {
      boton.disabled = false;
    }
    return;
  }
  try {
    await Ventas.registrarVenta({
      productoId: ventaProductoActual.id,
      clienteId: document.getElementById('campoClienteVenta').value || null,
      cantidad: document.getElementById('campoCantidadVenta').value,
      precioVenta: document.getElementById('campoPrecioVenta').value,
    });
    ocultarModal('modalVenta');
    refrescarInventario();
    refrescarVentas();
  } catch (err) {
    alert(err.message);
  }
});

async function refrescarVentas() {
  const contenedor = document.getElementById('listaVentas');
  const ventas = await Ventas.listarVentas({ incluirAnuladas: true });

  const hoy = new Date().toDateString();
  const ventasHoy = ventas.filter((v) => !v.anulada && !v.corregida && new Date(v.fecha).toDateString() === hoy);
  document.getElementById('resumenTotalHoy').textContent = 'L. ' + ventasHoy.reduce((s, v) => s + v.total, 0).toFixed(2);
  document.getElementById('resumenGananciaHoy').textContent = 'L. ' + ventasHoy.reduce((s, v) => s + v.ganancia, 0).toFixed(2);
  // "Hoy" solo tiene sentido viendo el mes actual
  document.getElementById('tarjetasHoy').style.display = mesVentas === MES_ACTUAL() ? '' : 'none';
  pintarSelectorMes('selectorMesVentas', mesVentas);
  actualizarResumenMes(ventas);

  const ventasDelMes = delMesElegido(ventas, mesVentas);
  if (ventasDelMes.length === 0) {
    contenedor.innerHTML = `<div class="vacio">No hay ventas en ${nombreDeMes(mesVentas)}.</div>`;
    return;
  }

  contenedor.innerHTML = '<p class="ayuda-lista">Toca una venta para corregirla o anularla.</p>' + ventasDelMes.map((v) => `
    <div class="card${v.anulada || v.corregida ? ' venta-anulada' : ''}" data-id="${escaparHtml(v.id)}">
      <div class="info">
        <h3>${escaparHtml(v.nombreProducto)} &times;${Number(v.cantidad) || 0}${v.anulada ? ' <span class="chip anulada">ANULADA</span>' : ''}${v.corregida ? ' <span class="chip corregida">CORREGIDA</span>' : ''}${v.corrigeA ? ' <span class="chip">✏️ corrección</span>' : ''}</h3>
        <p>${new Date(v.fecha).toLocaleString()}</p>
        ${(() => { const d = desglose(v.total, v.ganancia); return `
        <p class="precio">Venta ${formatoL(d.venta)} − Costo ${formatoL(d.costo)} = Ganancia ${formatoL(d.ganancia)}</p>
        <p class="pct-venta">📈 ${pct(d.sobreCosto)} sobre el costo &middot; ${pct(d.sobreVenta)} de la venta</p>`; })()}
        ${v.anulada ? `<p class="nota-anulada">${escaparHtml(textoAnulacion(v, true))}</p>` : ''}
        ${v.corregida ? `<p class="nota-anulada">Corregida el ${new Date(v.corregidaEl).toLocaleString()}${v.corregidaPor ? ' por ' + escaparHtml(v.corregidaPor) : ''}. No cuenta en los totales.</p>` : ''}
      </div>
    </div>
  `).join('');

  contenedor.querySelectorAll('.card').forEach((card) => {
    card.addEventListener('click', () => mostrarOpcionesVenta(card.dataset.id));
  });
}

// ---------- Resumen del mes: vendido, ganancia y % de margen ----------
// Margen = ganancia ÷ total vendido. Ej.: vendieron L.10,000 y ganaron L.2,000 → 20%.
// ---------- Selector de mes (Ventas y Compras) ----------
// Un mes se guarda como 'AAAA-MM'. Las ventas y compras no se mueven ni se
// borran: quedan guardadas siempre y la pantalla solo filtra por el mes elegido.
function claveMes(fecha) {
  const d = new Date(fecha);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}
const MES_ACTUAL = () => claveMes(new Date());
function moverMes(clave, dir) {
  const [a, m] = clave.split('-').map(Number);
  return claveMes(new Date(a, m - 1 + dir, 1));
}
function nombreDeMes(clave) {
  const [a, m] = clave.split('-').map(Number);
  const t = new Date(a, m - 1, 1).toLocaleDateString('es-HN', { month: 'long', year: 'numeric' });
  return t.charAt(0).toUpperCase() + t.slice(1);
}
function delMesElegido(lista, clave) {
  return lista.filter((x) => claveMes(x.fecha) === clave);
}
// Primer y último día del mes, como 'AAAA-MM-DD' (para reportes y filtros)
function limitesDeMes(clave) {
  const [a, m] = clave.split('-').map(Number);
  const ultimo = new Date(a, m, 0).getDate();
  return { desde: `${clave}-01`, hasta: `${clave}-${String(ultimo).padStart(2, '0')}` };
}

let mesVentas = MES_ACTUAL();
let mesCompras = MES_ACTUAL();

// Pinta el selector y conecta flechas y lista de meses.
function prepararSelectorMes(idSelector, obtenerMes, cambiarMes, listarMesesConDatos) {
  const caja = document.getElementById(idSelector);
  caja.querySelectorAll('.flecha-mes').forEach((b) => b.addEventListener('click', () => {
    const nuevo = moverMes(obtenerMes(), Number(b.dataset.dir));
    if (nuevo > MES_ACTUAL()) return;
    cambiarMes(nuevo);
  }));
  caja.querySelector('.nombre-mes').addEventListener('click', async () => {
    const meses = new Set(await listarMesesConDatos());
    meses.add(MES_ACTUAL());
    const opciones = [...meses].sort().reverse().map((k) => ({ id: k, texto: (k === obtenerMes() ? '✔ ' : '') + nombreDeMes(k), principal: k === obtenerMes() }));
    const elegido = await elegirAccion('Elige el mes', opciones, '', 'Cerrar');
    if (elegido) cambiarMes(elegido);
  });
}

function pintarSelectorMes(idSelector, clave) {
  const caja = document.getElementById(idSelector);
  caja.querySelector('.nombre-mes').textContent = '📅 ' + nombreDeMes(clave) + ' ▾';
  caja.querySelector('.flecha-mes[data-dir="1"]').disabled = clave >= MES_ACTUAL();
}

function formatoL(n) {
  return 'L. ' + (Number(n) || 0).toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function actualizarResumenMes(ventas) {
  const delMes = delMesElegido(ventas, mesVentas).filter((v) => !v.anulada && !v.corregida);
  const vendido = delMes.reduce((s, v) => s + (Number(v.total) || 0), 0);
  const ganancia = delMes.reduce((s, v) => s + (Number(v.ganancia) || 0), 0);
  const d = desglose(vendido, ganancia);
  const margen = d.sobreVenta || 0;
  document.getElementById('resumenVendidoMes').textContent = formatoL(vendido);
  document.getElementById('resumenCostoMes').textContent = formatoL(d.costo);
  document.getElementById('resumenGananciaMes').textContent = formatoL(ganancia);
  document.getElementById('resumenSobreCostoMes').textContent = pct(d.sobreCosto);
  const elMargen = document.getElementById('resumenMargenMes');
  elMargen.textContent = pct(d.sobreVenta);
  elMargen.classList.toggle('margen-bajo', vendido > 0 && margen < 10);

  // Ventas de productos sin costo registrado: su ganancia sale "inflada"
  const sinCosto = delMes.filter((v) => !(Number(v.costoUnitario) > 0)).length;
  let nota = vendido > 0
    ? `Vendieron ${formatoL(vendido)} en plantas que les costaron ${formatoL(d.costo)}: ganaron ${formatoL(ganancia)}. ` +
      `Eso es ${pct(d.sobreCosto)} sobre lo que costaron, o ${pct(d.sobreVenta)} de lo vendido (de cada L. 100 que entran, L. ${Math.round(margen)} son ganancia). ` +
      `${delMes.length} venta${delMes.length === 1 ? '' : 's'} en el mes.`
    : 'No hay ventas en este mes.';
  try {
    const { desde, hasta } = limitesDeMes(mesVentas);
    const { total } = await Compras.totalComprado({ desde, hasta });
    if (total > 0) nota += ` Compras del mes: ${formatoL(total)}.`;
  } catch (e) { console.warn(e); }
  if (sinCosto) nota += ` ⚠️ ${sinCosto} venta${sinCosto === 1 ? '' : 's'} de productos sin costo registrado: el margen sale más alto de lo real.`;
  document.getElementById('notaMargenMes').textContent = nota;
}

async function mostrarOpcionesVenta(id) {
  const ventas = await Ventas.listarVentas({ incluirAnuladas: true });
  const venta = ventas.find((v) => v.id === id);
  if (!venta) return;
  const cliente = venta.clienteId ? (await Clientes.listarClientes()).find((c) => c.id === venta.clienteId) : null;
  const d = desglose(venta.total, venta.ganancia);
  const detalle = `${venta.nombreProducto} ×${venta.cantidad} · ${new Date(venta.fecha).toLocaleString()}${cliente ? ' · Cliente: ' + cliente.nombre : ''}\n\n` +
    `Precio de venta: ${venta.cantidad} × ${formatoL(venta.precioUnitario)} = ${formatoL(d.venta)}\n` +
    `− Costo: ${venta.cantidad} × ${formatoL(venta.costoUnitario)} = ${formatoL(d.costo)}\n` +
    `= Ganancia: ${formatoL(d.ganancia)}\n` +
    `📈 ${pct(d.sobreCosto)} sobre el costo · ${pct(d.sobreVenta)} de la venta`;
  if (venta.anulada) {
    await elegirAccion('Venta anulada', [], detalle + '\n\n' + textoAnulacion(venta, true) + '\nYa no cuenta en los totales ni en los reportes.', 'Cerrar');
    return;
  }
  if (venta.corregida) {
    await elegirAccion('Venta corregida', [], detalle + `\n\nEsta es la versión anterior. Fue corregida el ${new Date(venta.corregidaEl).toLocaleString()}${venta.corregidaPor ? ' por ' + venta.corregidaPor : ''} y ya no cuenta en los totales.`, 'Cerrar');
    return;
  }
  const accion = await elegirAccion('Venta', [
    { id: 'corregir', texto: '✏️ Corregir venta (cantidad, precio o cliente)', principal: true },
    { id: 'anular', texto: '↩️ Anular venta (devolución, cambio, etc.)' },
  ], detalle, 'Cerrar');
  if (accion === 'corregir') { abrirCorreccionVenta(venta); return; }
  if (accion !== 'anular') return;
  const r = await pedirMotivo({
    titulo: '¿Anular esta venta?',
    mensaje: detalle,
    motivos: Ventas.MOTIVOS_ANULAR,
    conRegreso: true,
    textoBoton: 'Anular venta',
  });
  if (!r) return;
  try {
    const res = await Ventas.anularVenta(id, r);
    refrescarVentas();
    refrescarInventario(document.getElementById('buscarTexto').value);
    let aviso = res.regresoInventario
      ? (res.productoExiste ? `✅ Venta anulada. Se devolvieron ${venta.cantidad} al inventario.` : '✅ Venta anulada. El producto ya no existe en el inventario, así que no se devolvió stock.')
      : '✅ Venta anulada. La planta no regresó al inventario.';
    if (r.motivo === 'cambio') aviso += '\n\n🔁 Ahora registra la venta de la planta nueva desde Inventario.';
    alert(aviso);
  } catch (err) {
    alert(err.message || 'No se pudo anular la venta. Revisa tu conexión e intenta de nuevo.');
  }
}

// =========================================================
// COMPRAS
// =========================================================

// ---------- Factura de compra: varios productos + transporte ----------
// Cada fila es un producto de la factura. Si el nombre no existe en el
// inventario, la fila se marca como "producto nuevo" y se crea al guardar.

let compraProductos = [];
let filasFactura = [];
let compraEnCorreccion = null; // compra que se está corrigiendo (o null si es una factura nueva)
const CLAVE_BORRADOR = 'encantos-borrador-factura';

function filaVacia() { return { nombre: '', cantidad: '', costo: '', categoria: '', precio: '' }; }
function filaTieneDatos(f) { return !!(String(f.nombre).trim() || String(f.cantidad).trim() || String(f.costo).trim()); }
function normalizarNombre(t) { return String(t || '').trim().toLowerCase().replace(/\s+/g, ' '); }
function productoPorNombre(nombre) {
  const n = normalizarNombre(nombre);
  return n ? compraProductos.find((p) => normalizarNombre(p.nombre) === n) || null : null;
}

function leerBorrador() {
  try { return JSON.parse(localStorage.getItem(CLAVE_BORRADOR) || 'null'); } catch { return null; }
}
function guardarBorrador() {
  if (compraEnCorreccion) return; // una corrección no pisa el borrador de una factura nueva
  try {
    localStorage.setItem(CLAVE_BORRADOR, JSON.stringify({
      proveedorId: document.getElementById('campoProveedorCompra').value,
      fecha: document.getElementById('campoFechaCompra').value,
      numero: document.getElementById('campoNumeroFactura').value,
      transporte: document.getElementById('campoTransporte').value,
      nota: document.getElementById('campoNotaCompra').value,
      filas: filasFactura,
    }));
  } catch (e) { /* sin espacio o bloqueado: se ignora */ }
}
function borrarBorrador() { try { localStorage.removeItem(CLAVE_BORRADOR); } catch (e) { /* nada */ } }

function hoyLocal() { return new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10); }

async function abrirModalCompra(productoElegido = null, compraACorregir = null) {
  const [productos, proveedores] = await Promise.all([Inventario.listarProductos(), Proveedores.listarProveedores()]);
  compraEnCorreccion = compraACorregir;
  document.querySelector('#modalCompra h2').textContent = compraACorregir ? '✏️ Corregir compra' : '🧾 Registrar compra (factura)';
  document.getElementById('btnConfirmarCompra').textContent = compraACorregir ? 'Guardar corrección' : 'Guardar factura';
  document.getElementById('avisoCorreccion').hidden = !compraACorregir;
  compraProductos = productos;
  document.getElementById('listaProductosCompra').innerHTML = productos.map((p) =>
    `<option value="${escaparHtml(p.nombre)}">${escaparHtml(p.categoria)} · stock ${Number(p.stock) || 0}</option>`).join('');
  document.getElementById('campoProveedorCompra').innerHTML = '<option value="">— Sin proveedor —</option>' + proveedores.map((pr) =>
    `<option value="${escaparHtml(pr.id)}">${escaparHtml(pr.nombre)}${pr.empresa ? ' · ' + escaparHtml(pr.empresa) : ''}</option>`).join('');

  if (compraACorregir) {
    const c = compraACorregir;
    const porId = new Map(productos.map((p) => [p.id, p]));
    document.getElementById('campoProveedorCompra').value = c.proveedorId || '';
    const f = new Date(c.fecha);
    document.getElementById('campoFechaCompra').value = new Date(f.getTime() - f.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    document.getElementById('campoNumeroFactura').value = c.numeroFactura || '';
    document.getElementById('campoTransporte').value = Number(c.transporte) > 0 ? String(c.transporte) : '';
    document.getElementById('campoNotaCompra').value = c.nota || '';
    filasFactura = Compras.lineasDe(c).map((l) => ({
      ...filaVacia(),
      nombre: (porId.get(l.productoId) || {}).nombre || l.nombreProducto,
      cantidad: String(l.cantidad),
      costo: String(l.costoUnitario),
    }));
    dibujarFilasFactura();
    mostrarModal('modalCompra');
    return;
  }

  let borrador = leerBorrador();
  if (borrador && (borrador.filas || []).some(filaTieneDatos)) {
    const n = borrador.filas.filter(filaTieneDatos).length;
    const r = await elegirAccion('Tienes una factura sin terminar', [
      { id: 'seguir', texto: `📝 Continuar (${n} producto${n === 1 ? '' : 's'})`, principal: true },
      { id: 'nueva', texto: '🗑️ Empezar una nueva (borrar la anterior)' },
    ], '', 'Cancelar');
    if (!r) return;
    if (r === 'nueva') { borrarBorrador(); borrador = null; }
  } else {
    borrador = null;
  }

  if (borrador) {
    document.getElementById('campoProveedorCompra').value = borrador.proveedorId || '';
    document.getElementById('campoFechaCompra').value = borrador.fecha || hoyLocal();
    document.getElementById('campoNumeroFactura').value = borrador.numero || '';
    document.getElementById('campoTransporte').value = borrador.transporte || '';
    document.getElementById('campoNotaCompra').value = borrador.nota || '';
    filasFactura = borrador.filas.map((f) => ({ ...filaVacia(), ...f }));
  } else {
    document.getElementById('campoProveedorCompra').value = productoElegido && productoElegido.proveedorId ? productoElegido.proveedorId : '';
    document.getElementById('campoFechaCompra').value = hoyLocal();
    document.getElementById('campoNumeroFactura').value = '';
    document.getElementById('campoTransporte').value = '';
    document.getElementById('campoNotaCompra').value = '';
    filasFactura = [filaVacia()];
  }
  if (productoElegido && !filasFactura.some((f) => productoPorNombre(f.nombre)?.id === productoElegido.id)) {
    const vacia = filasFactura.findIndex((f) => !filaTieneDatos(f));
    const fila = { ...filaVacia(), nombre: productoElegido.nombre };
    if (vacia >= 0) filasFactura[vacia] = fila; else filasFactura.push(fila);
  }
  dibujarFilasFactura();
  mostrarModal('modalCompra');
}

function dibujarFilasFactura() {
  const cont = document.getElementById('lineasFactura');
  const categorias = Inventario.CATEGORIAS_INFO.map((c) => `<option value="${escaparHtml(c.nombre)}">${c.emoji} ${escaparHtml(c.nombre)}</option>`).join('');
  cont.innerHTML = filasFactura.map((f, i) => `
    <div class="linea-factura" data-i="${i}">
      <div class="linea-cab">
        <span class="num">${i + 1}</span>
        <input class="l-nombre" list="listaProductosCompra" placeholder="Planta o producto" value="${escaparHtml(f.nombre)}" autocomplete="off">
        <button type="button" class="l-quitar" aria-label="Quitar fila">✖</button>
      </div>
      <div class="linea-nuevo" hidden>
        <div class="aviso-nuevo">🆕 Producto nuevo: se creará en Inventario</div>
        <div class="linea-nums">
          <label>Categoría<select class="l-categoria"><option value="">— Elige —</option>${categorias}</select></label>
          <label>Precio de venta<input class="l-precio" type="number" min="0" step="0.01" inputmode="decimal" placeholder="L." value="${escaparHtml(f.precio)}"></label>
        </div>
      </div>
      <div class="linea-nums">
        <label>Cantidad<input class="l-cant" type="number" min="1" step="1" inputmode="numeric" value="${escaparHtml(f.cantidad)}"></label>
        <label>Costo c/u (L.)<input class="l-costo" type="number" min="0" step="0.01" inputmode="decimal" value="${escaparHtml(f.costo)}"></label>
        <div class="l-sub"><span>Subtotal</span><b>L. 0.00</b></div>
      </div>
      <div class="linea-info"></div>
    </div>`).join('');
  cont.querySelectorAll('.linea-factura').forEach((el) => {
    const i = Number(el.dataset.i);
    el.querySelector('.l-categoria').value = filasFactura[i].categoria || '';
    const enlazar = (sel, campo) => el.querySelector(sel).addEventListener('input', (e) => { filasFactura[i][campo] = e.target.value; recalcularFactura(); });
    enlazar('.l-nombre', 'nombre'); enlazar('.l-cant', 'cantidad'); enlazar('.l-costo', 'costo'); enlazar('.l-precio', 'precio');
    el.querySelector('.l-categoria').addEventListener('change', (e) => { filasFactura[i].categoria = e.target.value; recalcularFactura(); });
    el.querySelector('.l-quitar').addEventListener('click', () => {
      filasFactura.splice(i, 1);
      if (!filasFactura.length) filasFactura.push(filaVacia());
      dibujarFilasFactura();
    });
  });
  document.getElementById('campoNumLineas').value = filasFactura.length;
  recalcularFactura();
}

// Recalcula subtotales, transporte, costo final y total sin redibujar las filas
// (así no se pierde lo que se está escribiendo).
function recalcularFactura() {
  const transporte = Math.max(0, parseFloat(document.getElementById('campoTransporte').value) || 0);
  const base = filasFactura.map((f) => ({
    cantidad: Math.max(0, parseInt(f.cantidad, 10) || 0),
    costoUnitario: Math.max(0, parseFloat(f.costo) || 0),
  }));
  const calculadas = Compras.repartirTransporte(base, transporte);
  const conteo = {};
  filasFactura.forEach((f) => { const k = normalizarNombre(f.nombre); if (k) conteo[k] = (conteo[k] || 0) + 1; });
  let nuevos = 0;
  document.querySelectorAll('#lineasFactura .linea-factura').forEach((el) => {
    const i = Number(el.dataset.i);
    const f = filasFactura[i];
    const c = calculadas[i];
    const p = productoPorNombre(f.nombre);
    const esNuevo = !p && !!String(f.nombre).trim();
    if (esNuevo) nuevos++;
    el.querySelector('.linea-nuevo').hidden = !esNuevo;
    el.classList.toggle('es-nuevo', esNuevo);
    el.querySelector('.l-costo').placeholder = p && Number(p.costo) > 0 ? 'Antes ' + Number(p.costo).toFixed(2) : '0.00';
    el.querySelector('.l-sub b').textContent = formatoL(c.subtotal);
    const repetido = conteo[normalizarNombre(f.nombre)] > 1;
    let info = '';
    if (repetido) info = '⚠️ Este producto está repetido en la factura.';
    else if (c.cantidad > 0 && String(f.costo).trim() !== '') {
      const finalTxt = transporte > 0
        ? `${formatoL(c.costoUnitario)} + <b>${formatoL(incrementoTransporte(c))}</b> de transporte = <b>${formatoL(c.costoFinalUnit)}</b> c/u`
        : `Costo c/u ${formatoL(c.costoFinalUnit)}`;
      info = p ? `Stock ${Number(p.stock) || 0} → <b>${(Number(p.stock) || 0) + c.cantidad}</b> · ${finalTxt}` : finalTxt;
    }
    const caja = el.querySelector('.linea-info');
    caja.innerHTML = info;
    caja.classList.toggle('alerta', repetido);
  });
  const totalProductos = calculadas.reduce((s, c) => s + c.subtotal, 0);
  const unidades = calculadas.reduce((s, c) => s + c.cantidad, 0);
  const conDatos = filasFactura.filter(filaTieneDatos).length;
  document.getElementById('resumenFactura').innerHTML = `
    <div><span>Productos (${conDatos}${nuevos ? `, ${nuevos} nuevo${nuevos === 1 ? '' : 's'}` : ''})</span><b>${formatoL(totalProductos)}</b></div>
    <div><span>Transporte</span><b>${formatoL(transporte)}</b></div>
    <div class="total"><span>Total de la factura</span><b>${formatoL(totalProductos + transporte)}</b></div>
    <div class="unidades">${unidades} unidad${unidades === 1 ? '' : 'es'} en total</div>`;
  guardarBorrador();
}

// "¿Cuántos productos trae la factura?": agrega filas vacías o quita las vacías del final
document.getElementById('campoNumLineas').addEventListener('change', (e) => {
  let n = parseInt(e.target.value, 10) || 1;
  n = Math.min(Math.max(n, 1), Compras.MAX_LINEAS || 200);
  if (n === filasFactura.length) { e.target.value = n; return; } // nada que cambiar: no redibujar
  while (filasFactura.length < n) filasFactura.push(filaVacia());
  while (filasFactura.length > n && !filaTieneDatos(filasFactura[filasFactura.length - 1])) filasFactura.pop();
  if (filasFactura.length > n) alert('Algunas filas ya tienen datos. Quítalas con la ✖ si no van en la factura.');
  dibujarFilasFactura();
});
document.getElementById('btnAgregarLinea').addEventListener('click', () => {
  filasFactura.push(filaVacia());
  dibujarFilasFactura();
  const filas = document.querySelectorAll('#lineasFactura .l-nombre');
  filas[filas.length - 1].focus();
});
['campoTransporte'].forEach((id) => document.getElementById(id).addEventListener('input', recalcularFactura));
['campoProveedorCompra', 'campoFechaCompra', 'campoNumeroFactura', 'campoNotaCompra'].forEach((id) =>
  document.getElementById(id).addEventListener('change', guardarBorrador));
document.getElementById('btnCancelarCompra').addEventListener('click', () => { compraEnCorreccion = null; ocultarModal('modalCompra'); });

document.getElementById('btnConfirmarCompra').addEventListener('click', async () => {
  const boton = document.getElementById('btnConfirmarCompra');
  if (boton.disabled) return;
  // Se ignoran las filas totalmente vacías (por ejemplo, si pusieron 10 y llenaron 9)
  const filas = filasFactura.filter(filaTieneDatos);
  if (!filas.length) { alert('Agrega al menos un producto a la factura.'); return; }
  boton.disabled = true;
  boton.textContent = 'Guardando...';
  try {
    const datosFactura = {
      proveedorId: document.getElementById('campoProveedorCompra').value,
      fecha: document.getElementById('campoFechaCompra').value,
      numeroFactura: document.getElementById('campoNumeroFactura').value,
      nota: document.getElementById('campoNotaCompra').value,
      transporte: document.getElementById('campoTransporte').value,
      lineas: filas.map((f) => {
        const p = productoPorNombre(f.nombre);
        return {
          productoId: p ? p.id : null,
          nombre: f.nombre,
          cantidad: f.cantidad,
          costoUnitario: f.costo,
          nuevo: p ? null : { categoria: f.categoria, precio: f.precio },
        };
      }),
    };
    const corrigiendo = compraEnCorreccion;
    const factura = corrigiendo
      ? await Compras.corregirFactura(corrigiendo.id, datosFactura)
      : await Compras.registrarFactura(datosFactura);
    if (!corrigiendo) borrarBorrador();
    compraEnCorreccion = null;
    ocultarModal('modalCompra');
    refrescarCompras();
    refrescarInventario(document.getElementById('buscarTexto').value);
    const nuevos = factura.lineas.filter((l) => l.creadoEnFactura).length;
    alert(`${corrigiendo ? '✅ Corrección guardada. La compra anterior quedó como historial. Ahora' : '✅ Factura guardada:'} ${factura.lineas.length} producto${factura.lineas.length === 1 ? '' : 's'}, ${factura.unidades} unidades, total ${formatoL(factura.total)}.` +
      (nuevos ? `\n\n🆕 ${nuevos === 1 ? 'Se creó 1 producto nuevo' : `Se crearon ${nuevos} productos nuevos`} en Inventario (sin publicar en el catálogo). Agrégales foto y datos cuando puedas.` : ''));
    // Avisar a coleccionistas que buscan alguna de estas plantas
    if (!corrigiendo) {
      try {
        const productos = await Inventario.listarProductos();
        const porId = new Map(productos.map((p) => [p.id, p]));
        await avisarInteresados(factura.lineas.map((l) => ({ nombre: l.nombreProducto, categoria: (porId.get(l.productoId) || {}).categoria })));
      } catch (e) { console.warn('No se pudo revisar coleccionistas', e); }
    }
  } catch (err) {
    alert(err.message || 'No se pudo guardar la factura.');
  } finally {
    boton.disabled = false;
    boton.textContent = compraEnCorreccion ? 'Guardar corrección' : 'Guardar factura';
  }
});

async function refrescarCompras() {
  const contenedor = document.getElementById('listaCompras');
  if (!contenedor) return;
  const todas = await Compras.listarCompras({ incluirAnuladas: true });
  pintarSelectorMes('selectorMesCompras', mesCompras);
  const compras = delMesElegido(todas, mesCompras);
  const delMes = compras.filter((c) => !c.anulada && !c.corregida);
  document.getElementById('resumenComprasMes').textContent = formatoL(delMes.reduce((s, c) => s + (Number(c.total) || 0), 0));
  document.getElementById('resumenUnidadesMes').textContent = String(delMes.reduce((s, c) => s + Compras.unidadesDe(c), 0));

  if (compras.length === 0) {
    contenedor.innerHTML = todas.length
      ? `<div class="vacio">No hay compras en ${nombreDeMes(mesCompras)}.</div>`
      : '<div class="vacio">Aún no hay compras. Toca "+" para registrar la primera.</div>';
    return;
  }
  contenedor.innerHTML = '<p class="ayuda-lista">Toca una compra para ver el detalle, corregirla o anularla.</p>' + compras.map((c) => {
    const lineas = Compras.lineasDe(c);
    const titulo = c.lineas
      ? `🧾 ${c.numeroFactura ? 'Factura N.º ' + escaparHtml(c.numeroFactura) : 'Factura'} · ${lineas.length} producto${lineas.length === 1 ? '' : 's'}`
      : `${escaparHtml(c.nombreProducto)} +${Number(c.cantidad) || 0}`;
    const resumen = c.lineas
      ? escaparHtml(lineas.slice(0, 3).map((l) => `${l.nombreProducto} ×${l.cantidad}`).join(', ') + (lineas.length > 3 ? `, y ${lineas.length - 3} más` : ''))
      : `${formatoL(c.costoUnitario)} c/u`;
    return `
    <div class="card${c.anulada || c.corregida ? ' compra-anulada' : ''}" data-id="${escaparHtml(c.id)}">
      <div class="info">
        <h3>${titulo}${c.anulada ? ' <span class="chip anulada">ANULADA</span>' : ''}${c.corregida ? ' <span class="chip corregida">CORREGIDA</span>' : ''}${c.corrigeA ? ' <span class="chip">✏️ corrección</span>' : ''}</h3>
        <p>${new Date(c.fecha).toLocaleDateString()}${c.nombreProveedor ? ' · 🚚 ' + escaparHtml(c.nombreProveedor) : ''}</p>
        <p style="font-size:12px;color:#666;">${resumen}</p>
        <p class="precio">Total: ${formatoL(c.total)}${Number(c.transporte) > 0 ? ` &middot; incluye transporte ${formatoL(c.transporte)}` : ''}</p>
        ${c.nota ? `<p style="font-size:12px;color:#888;">📝 ${escaparHtml(c.nota)}</p>` : ''}
        ${c.anulada ? `<p class="nota-anulada">${escaparHtml(textoAnulacion(c))}</p>` : ''}
        ${c.corregida ? `<p class="nota-anulada">Corregida el ${new Date(c.corregidaEl).toLocaleString()}${c.corregidaPor ? ' por ' + escaparHtml(c.corregidaPor) : ''}. No cuenta en los totales.</p>` : ''}
      </div>
    </div>`;
  }).join('');
  contenedor.querySelectorAll('.card[data-id]').forEach((card) => {
    card.addEventListener('click', () => mostrarOpcionesCompra(card.dataset.id));
  });
}

// Lo que se le sumó a una planta por el transporte, por unidad
function incrementoTransporte(l) {
  return Math.max(0, Math.round(((Number(l.costoFinalUnit) || 0) - (Number(l.costoUnitario) || 0)) * 100) / 100);
}

function detalleCompraTexto(c) {
  const lineas = Compras.lineasDe(c);
  const filas = lineas.map((l) =>
    `• ${l.nombreProducto} ×${l.cantidad} a ${formatoL(l.costoUnitario)} = ${formatoL(l.subtotal)}` +
    (l.creadoEnFactura ? ' 🆕' : ''));
  const partes = [
    `${new Date(c.fecha).toLocaleDateString()}${c.nombreProveedor ? ' · ' + c.nombreProveedor : ''}${c.numeroFactura ? ' · Factura N.º ' + c.numeroFactura : ''}`,
    ...filas,
    Number(c.transporte) > 0 ? `Transporte: ${formatoL(c.transporte)}` : '',
    `Total: ${formatoL(c.total)} · ${Compras.unidadesDe(c)} unidades`,
  ].filter(Boolean);
  // Al final: cuánto se le sumó a cada planta por el transporte (por unidad)
  if (Number(c.transporte) > 0) {
    partes.push('', '🚚 Transporte sumado a cada planta (por unidad):',
      ...lineas.map((l) => `• ${l.nombreProducto}: ${formatoL(l.costoUnitario)} + ${formatoL(incrementoTransporte(l))} = ${formatoL(l.costoFinalUnit)}`));
  }
  if (c.registradaPor) partes.push('', `Registró: ${c.registradaPor}`);
  return partes.join('\n');
}

async function mostrarOpcionesCompra(id) {
  const compras = await Compras.listarCompras({ incluirAnuladas: true });
  const c = compras.find((x) => x.id === id);
  if (!c) return;
  const detalle = detalleCompraTexto(c);
  if (c.anulada) {
    await elegirAccion('Compra anulada', [], detalle + '\n\n' + textoAnulacion(c) + '\nYa no cuenta en los totales.', 'Cerrar');
    return;
  }
  if (c.corregida) {
    await elegirAccion('Compra corregida', [], detalle + `\n\nEsta es la versión anterior. Fue corregida el ${new Date(c.corregidaEl).toLocaleString()}${c.corregidaPor ? ' por ' + c.corregidaPor : ''} y ya no cuenta en los totales.`, 'Cerrar');
    return;
  }
  const accion = await elegirAccion(c.lineas ? 'Factura de compra' : 'Compra', [
    { id: 'corregir', texto: '✏️ Corregir compra', principal: true },
    { id: 'anular', texto: c.lineas ? '↩️ Anular factura completa' : '↩️ Anular compra (quitar del stock)' },
  ], detalle, 'Cerrar');
  if (accion === 'corregir') { abrirModalCompra(null, c); return; }
  if (accion !== 'anular') return;
  const unidades = Compras.unidadesDe(c);
  const motivo = await pedirMotivo({
    titulo: c.lineas ? '¿Anular esta factura?' : '¿Anular esta compra?',
    mensaje: `Se quitarán ${unidades} unidades del inventario y se recalcularán los costos.`,
    motivos: Compras.MOTIVOS_ANULAR_COMPRA,
    textoBoton: 'Anular compra',
  });
  if (!motivo) return;
  try {
    if (c.lineas) await Compras.anularFactura(id, motivo);
    else await Compras.anularCompra(id, motivo);
    refrescarCompras();
    refrescarInventario(document.getElementById('buscarTexto').value);
  } catch (err) {
    alert(err.message || 'No se pudo anular la compra.');
  }
}

// =========================================================
// CLIENTES
// =========================================================

let filtroTipoCliente = ''; // '' = todos

async function refrescarClientes(filtro = '') {
  const contenedor = document.getElementById('listaClientes');
  const todos = await Clientes.listarClientes();
  // Filtros rápidos por tipo, con cuántos hay de cada uno
  const cuenta = (t) => todos.filter((c) => (c.tipo || 'normal') === t).length;
  const botones = [{ id: '', t: `Todos (${todos.length})` }]
    .concat(Clientes.TIPOS_CLIENTE.filter((t) => t.id !== 'normal').map((t) => ({ id: t.id, t: `${t.emoji} ${t.texto.split(' (')[0]}s (${cuenta(t.id)})` })))
    .concat([{ id: 'busca', t: `🔎 Buscan algo (${todos.filter((c) => (c.deseos || []).length).length})` }]);
  document.getElementById('filtroTiposCliente').innerHTML = botones.map((b) =>
    `<button type="button" class="chip-filtro${filtroTipoCliente === b.id ? ' activo' : ''}" data-tipo="${b.id}">${escaparHtml(b.t)}</button>`).join('');
  document.querySelectorAll('#filtroTiposCliente [data-tipo]').forEach((b) => b.addEventListener('click', () => {
    filtroTipoCliente = b.dataset.tipo;
    refrescarClientes(document.getElementById('buscarCliente').value);
  }));

  const q = filtro.trim().toLowerCase();
  let clientes = q
    ? todos.filter((c) => (c.nombre || '').toLowerCase().includes(q) || (c.celular || '').includes(q) ||
        (c.deseos || []).some((d) => d.toLowerCase().includes(q)) || (c.intereses || []).some((d) => d.toLowerCase().includes(q)))
    : todos;
  if (filtroTipoCliente === 'busca') clientes = clientes.filter((c) => (c.deseos || []).length);
  else if (filtroTipoCliente) clientes = clientes.filter((c) => (c.tipo || 'normal') === filtroTipoCliente);

  if (clientes.length === 0) {
    contenedor.innerHTML = todos.length
      ? '<div class="vacio">No hay clientes con este filtro.</div>'
      : '<div class="vacio">Aún no hay clientes. Toca "+" para agregar el primero.</div>';
    return;
  }

  contenedor.innerHTML = clientes.map((c) => {
    const tipo = Clientes.tipoDe(c);
    const especial = tipo.id !== 'normal';
    return `
    <div class="card${especial ? ' cliente-' + tipo.id : ''}" data-id="${escaparHtml(c.id)}">
      <div class="info">
        <h3>${escaparHtml(c.nombre)}${especial ? ` <span class="chip tipo-${tipo.id}">${tipo.emoji} ${escaparHtml(tipo.texto.split(' (')[0])}</span>` : ''}</h3>
        <p>${escaparHtml(c.celular || 'Sin celular')}</p>
        ${(c.intereses || []).length ? `<p class="interes-cliente">Le interesa: ${escaparHtml(c.intereses.join(', '))}</p>` : ''}
        ${(c.deseos || []).length ? `<p class="interes-cliente">🔎 Busca: ${escaparHtml(c.deseos.join(', '))}</p>` : ''}
        ${c.creadoEl ? `<p style="font-size:12px;color:#888;">Cliente desde: ${new Date(c.creadoEl).toLocaleDateString()}</p>` : ''}
        ${c.ultimoCatalogo ? `<p class="ultimo-catalogo">${escaparHtml(textoUltimoCatalogo(c))}</p>` : ''}
      </div>
    </div>`;
  }).join('');

  contenedor.querySelectorAll('.card[data-id]').forEach((card) => {
    card.addEventListener('click', () => mostrarOpcionesCliente(card.dataset.id));
  });
}

document.getElementById('buscarCliente').addEventListener('input', (e) => refrescarClientes(e.target.value));

async function mostrarOpcionesCliente(id) {
  const clientes = await Clientes.listarClientes();
  const cliente = clientes.find((c) => c.id === id);
  if (!cliente) return;
  const accion = await elegirAccion(cliente.nombre, [
    { id: 'catalogo', texto: '📤 Enviar catálogo por WhatsApp', principal: true },
    { id: 'historial', texto: '🧾 Ver historial de compras' },
    { id: 'editar', texto: '✏️ Editar o eliminar' },
  ], textoUltimoCatalogo(cliente));
  if (accion === 'catalogo') enviarCatalogoACliente(cliente);
  else if (accion === 'historial') abrirHistorialCliente(cliente);
  else if (accion === 'editar') abrirModalCliente(cliente);
}

function textoUltimoCatalogo(c) {
  const u = c && c.ultimoCatalogo;
  if (!u || !u.fecha) return '';
  const fecha = new Date(u.fecha).toLocaleDateString('es-HN', { day: 'numeric', month: 'short', year: 'numeric' });
  return `📤 Último catálogo enviado: ${fecha}${u.catalogos && u.catalogos.length ? ' · ' + u.catalogos.join(', ') : ''}`;
}

// ---------- Avisar a coleccionistas cuando llega una planta que buscan ----------
async function avisarInteresados(productosNuevos, titulo = '🔎 Clientes que buscan estas plantas') {
  const clientes = await Clientes.listarClientes();
  const interesados = Clientes.interesadosEn(productosNuevos, clientes);
  if (!interesados.length) return false;
  const { negocio, yo } = await catalogosParaEnviar().catch(() => ({ negocio: 'Encantos', yo: null }));
  const android = esAndroid();
  const velo = document.createElement('div');
  velo.className = 'modal-overlay activo menu-acciones avisos-coleccion';
  velo.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <h2>${escaparHtml(titulo)}</h2>
      <p class="mensaje-accion">${interesados.length === 1 ? 'Este cliente anda buscando' : `Estos ${interesados.length} clientes andan buscando`} algo de lo que acaba de llegar. Ofréceselo antes de publicarlo:</p>
      ${interesados.map((x, i) => {
        const tipo = Clientes.tipoDe(x.cliente);
        const num = Clientes.numeroWhatsApp(x.cliente.celular);
        return `
        <div class="aviso-cliente">
          <div><b>${tipo.emoji} ${escaparHtml(x.cliente.nombre)}</b><br><small>${escaparHtml(x.motivos.join(' · '))}</small><br><small>🌿 ${escaparHtml(x.plantas.join(', '))}</small></div>
          ${num ? (android
            ? `<div class="botones-wa"><button class="btn whatsapp chico" data-i="${i}" data-app="normal">WhatsApp</button><button class="btn whatsapp chico" data-i="${i}" data-app="business">Business</button></div>`
            : `<button class="btn whatsapp chico" data-i="${i}" data-app="">WhatsApp</button>`)
            : '<small class="sin-numero">Sin celular registrado</small>'}
        </div>`;
      }).join('')}
      <button class="btn btn-cancelar" data-cerrar="1">Cerrar</button>
    </div>`;
  document.body.appendChild(velo);
  velo.addEventListener('click', (e) => {
    if (e.target === velo || e.target.closest('[data-cerrar]')) { velo.remove(); return; }
    const b = e.target.closest('[data-app]');
    if (!b) return;
    const x = interesados[Number(b.dataset.i)];
    const nombre = String(x.cliente.nombre || '').trim().split(/\s+/)[0];
    const plantas = x.plantas.map((p) => `*${p}*`).join(', ');
    const texto = `Hola ${nombre} 👋 ${yo && yo.nombre ? `Soy ${yo.nombre}, de ${negocio}. ` : ''}` +
      `Te cuento que nos llegó ${plantas} 🌿 y me acordé de ti. ¿Te interesa? Te la puedo apartar antes de publicarla.`;
    b.closest('.aviso-cliente').classList.add('avisado');
    abrirChatWhatsApp(Clientes.numeroWhatsApp(x.cliente.celular), texto, b.dataset.app);
  });
  return true;
}

// ---------- Enviar catálogos a un cliente por WhatsApp ----------
// Catálogos publicados (completo + por categoría) con la firma de quien envía,
// para que los pedidos le lleguen a esa vendedora.
async function catalogosParaEnviar() {
  const [productos, config] = await Promise.all([Inventario.listarProductos(), Catalogo.obtenerConfig()]);
  const publicados = productos.filter((p) => p.publicarCatalogo);
  const cuentas = new Map();
  publicados.forEach((p) => {
    const c = Inventario.infoCategoria(p.categoria);
    const act = cuentas.get(c.id) || { info: c, n: 0 };
    act.n++;
    cuentas.set(c.id, act);
  });
  const orden = Inventario.CATEGORIAS_INFO.map((c) => c.id);
  const filas = publicados.length ? [{ id: '', emoji: '🌿', nombre: 'Catálogo completo', n: publicados.length, url: urlCatalogo('catalogo.html') }]
    .concat([...cuentas.values()]
      .sort((a, b) => orden.indexOf(a.info.id) - orden.indexOf(b.info.id))
      .map(({ info, n }) => ({ id: info.id, emoji: info.emoji, nombre: info.nombre, n, url: urlCatalogo(`c/${info.id}.html`) }))) : [];
  const yo = (config.vendedores || []).find((v) => v.correo && v.correo === correoSesion());
  if (yo && yo.whatsapp) filas.forEach((f) => { f.url += '#v=' + yo.id; });
  return { filas, negocio: config.negocio || 'Encantos', yo };
}

function mensajeCatalogo(cliente, elegidas, negocio, yo) {
  const nombre = String(cliente.nombre || '').trim().split(/\s+/)[0];
  const lineas = elegidas.map((f) => `${f.emoji} *${f.nombre}*: ${f.url}`);
  return `Hola ${nombre} 👋 ${yo && yo.nombre ? `Soy ${yo.nombre}, de ${negocio}. ` : ''}` +
    `Te comparto ${elegidas.length === 1 ? 'nuestro catálogo' : 'nuestros catálogos'} de plantas 🌿\n\n` +
    lineas.join('\n') +
    '\n\nAhí ves fotos, precios y cuidados de cada planta, y puedes hacer tu pedido directo. ¡Cualquier consulta, con gusto te ayudo!';
}

function esAndroid() { return /Android/i.test(navigator.userAgent || ''); }

// Abre el chat del cliente con el mensaje listo. En Android se puede elegir
// WhatsApp o WhatsApp Business; en otros teléfonos se usa wa.me.
function abrirChatWhatsApp(numero, texto, app) {
  const wa = `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
  if (esAndroid() && app) {
    const paquete = app === 'business' ? 'com.whatsapp.w4b' : 'com.whatsapp';
    location.href = `intent://send/?phone=${numero}&text=${encodeURIComponent(texto)}#Intent;scheme=whatsapp;package=${paquete};S.browser_fallback_url=${encodeURIComponent(wa)};end`;
    return;
  }
  window.open(wa, '_blank', 'noopener');
}

async function enviarCatalogoACliente(cliente) {
  const { filas, negocio, yo } = await catalogosParaEnviar();
  if (!filas.length) {
    alert('Todavía no hay plantas publicadas en el catálogo. Edita una planta y activa "Publicar en el catálogo para clientes".');
    return;
  }
  const android = esAndroid();
  // A un coleccionista se le marcan de entrada las categorías que colecciona
  const interesCat = (cliente.intereses || []).filter((x) => filas.some((f) => f.id && f.nombre === x));
  const velo = document.createElement('div');
  velo.className = 'modal-overlay activo menu-acciones envio-catalogo';
  velo.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <h2>📤 Enviar catálogo a ${escaparHtml(cliente.nombre)}</h2>
      <label>WhatsApp del cliente</label>
      <input type="tel" inputmode="tel" class="e-cel" value="${escaparHtml(cliente.celular || '')}" placeholder="Ej.: 9876-5432">
      <label>¿Qué catálogos le envías?</label>
      <div class="e-lista">${filas.map((f, i) => `
        <label class="e-op"><input type="checkbox" data-i="${i}"${(interesCat.length ? interesCat.includes(f.nombre) : i === 0) ? ' checked' : ''}>
          <span>${f.emoji} ${escaparHtml(f.nombre)}</span><small>${f.n} ${f.n === 1 ? 'planta' : 'plantas'}</small></label>`).join('')}
      </div>
      <label>Mensaje (lo puedes cambiar)</label>
      <textarea class="e-texto" rows="7"></textarea>
      <p class="m-error"></p>
      ${android
        ? `<div class="fila-botones"><button class="btn whatsapp" data-app="normal">WhatsApp</button><button class="btn whatsapp" data-app="business">WhatsApp Business</button></div>`
        : '<button class="btn whatsapp" data-app="">Abrir WhatsApp</button>'}
      <button class="btn btn-cancelar" data-cerrar="1">Cancelar</button>
    </div>`;
  document.body.appendChild(velo);
  const texto = velo.querySelector('.e-texto');
  const error = velo.querySelector('.m-error');
  const checks = [...velo.querySelectorAll('.e-op input')];
  let editado = false;
  const elegidas = () => checks.filter((c) => c.checked).map((c) => filas[Number(c.dataset.i)]);
  const actualizarTexto = () => { if (!editado) texto.value = mensajeCatalogo(cliente, elegidas(), negocio, yo); };
  texto.addEventListener('input', () => { editado = true; });
  checks.forEach((c) => c.addEventListener('change', () => {
    // Si marca el catálogo completo, se desmarcan las categorías (y al revés)
    if (c.checked && c.dataset.i === '0') checks.slice(1).forEach((x) => { x.checked = false; });
    if (c.checked && c.dataset.i !== '0') checks[0].checked = false;
    editado = false;
    actualizarTexto();
    error.textContent = '';
  }));
  actualizarTexto();
  const cerrar = () => velo.remove();
  velo.addEventListener('click', async (e) => {
    if (e.target === velo || e.target.closest('[data-cerrar]')) { cerrar(); return; }
    const b = e.target.closest('[data-app]');
    if (!b) return;
    const lista = elegidas();
    if (!lista.length) { error.textContent = 'Marca al menos un catálogo.'; return; }
    const cel = velo.querySelector('.e-cel').value;
    const numero = Clientes.numeroWhatsApp(cel);
    if (!numero) { error.textContent = 'Escribe un número de WhatsApp válido (8 dígitos, o con código de país).'; return; }
    if (!texto.value.trim()) { error.textContent = 'El mensaje está vacío.'; return; }
    // Guarda el número si era nuevo o cambió, y registra el envío en la ficha
    try {
      if (cel.trim() !== String(cliente.celular || '').trim()) await Clientes.actualizarCelular(cliente.id, cel);
      await Clientes.registrarEnvioCatalogo(cliente.id, lista.map((f) => f.nombre));
    } catch (err) { console.warn('No se pudo registrar el envío', err); }
    cerrar();
    refrescarClientes(document.getElementById('buscarCliente').value);
    abrirChatWhatsApp(numero, texto.value, b.dataset.app);
  });
}

function abrirModalCliente(cliente = null) {
  clienteEditandoId = cliente ? cliente.id : null;
  clienteEditandoCreadoEl = cliente ? cliente.creadoEl : null;
  document.getElementById('tituloModalCliente').textContent = cliente ? 'Editar cliente' : 'Nuevo cliente';
  document.getElementById('campoNombreCliente').value = cliente?.nombre || '';
  document.getElementById('campoCelularCliente').value = cliente?.celular || '';
  document.getElementById('campoNotasCliente').value = cliente?.notas || '';
  document.getElementById('filaEliminarCliente').style.display = cliente ? 'flex' : 'none';
  // Tipo, intereses y plantas que busca
  const selTipo = document.getElementById('campoTipoCliente');
  selTipo.innerHTML = Clientes.TIPOS_CLIENTE.map((t) => `<option value="${t.id}">${t.emoji ? t.emoji + ' ' : ''}${escaparHtml(t.texto)}</option>`).join('');
  selTipo.value = cliente?.tipo || 'normal';
  const opciones = Inventario.CATEGORIAS_INFO.filter((c) => c.grupo === 'planta').map((c) => ({ v: c.nombre, t: `${c.emoji} ${c.nombre}` }))
    .concat(Clientes.INTERESES_EXTRA.map((x) => ({ v: x, t: `✨ ${x}` })));
  const marcados = new Set(cliente?.intereses || []);
  document.getElementById('campoInteresesCliente').innerHTML = opciones.map((o) =>
    `<label><input type="checkbox" value="${escaparHtml(o.v)}"${marcados.has(o.v) ? ' checked' : ''}> ${escaparHtml(o.t)}</label>`).join('');
  deseosEditando = [...(cliente?.deseos || [])];
  document.getElementById('campoDeseoNuevo').value = '';
  document.getElementById('sugerenciasDeseo').innerHTML = '';
  pintarDeseos();
  document.getElementById('bloqueIntereses').open = marcados.size > 0;
  Inventario.listarProductos().then((ps) => {
    nombresInventario = [...new Map(ps.filter((p) => Inventario.infoCategoria(p.categoria).grupo === 'planta')
      .map((p) => [normalizarBusqueda(p.nombre), p])).values()];
  }).catch(() => { nombresInventario = []; });
  mostrarModal('modalCliente');
}

// ---------- Plantas que anda buscando el cliente (etiquetas con sugerencias) ----------
let deseosEditando = [];
let nombresInventario = [];

function normalizarBusqueda(t) {
  return String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function pintarDeseos() {
  document.getElementById('listaDeseosCliente').innerHTML = deseosEditando.map((d, i) =>
    `<span class="deseo-chip">🌿 ${escaparHtml(d)}<button type="button" data-quitar="${i}" aria-label="Quitar ${escaparHtml(d)}">✕</button></span>`).join('');
}

function agregarDeseo(texto) {
  const d = String(texto || '').trim().replace(/\s+/g, ' ');
  const campo = document.getElementById('campoDeseoNuevo');
  campo.value = '';
  document.getElementById('sugerenciasDeseo').innerHTML = '';
  if (!d) return;
  if (!deseosEditando.some((x) => normalizarBusqueda(x) === normalizarBusqueda(d))) deseosEditando.push(d);
  pintarDeseos();
  campo.focus();
}

function mostrarSugerenciasDeseo() {
  const q = normalizarBusqueda(document.getElementById('campoDeseoNuevo').value);
  const caja = document.getElementById('sugerenciasDeseo');
  if (q.length < 2) { caja.innerHTML = ''; return; }
  const ya = new Set(deseosEditando.map(normalizarBusqueda));
  const lista = nombresInventario
    .filter((p) => normalizarBusqueda(p.nombre).includes(q) && !ya.has(normalizarBusqueda(p.nombre)))
    .slice(0, 6);
  const exacto = lista.some((p) => normalizarBusqueda(p.nombre) === q);
  const texto = document.getElementById('campoDeseoNuevo').value.trim();
  caja.innerHTML = lista.map((p) =>
    `<button type="button" data-deseo="${escaparHtml(p.nombre)}">🌿 ${escaparHtml(p.nombre)} <small>· ${Number(p.stock) > 0 ? `hay ${p.stock}` : 'agotada'}</small></button>`).join('') +
    (exacto || ya.has(q) ? '' : `<button type="button" data-deseo="${escaparHtml(texto)}">➕ Agregar "${escaparHtml(texto)}"</button>`);
}

document.getElementById('campoDeseoNuevo').addEventListener('input', mostrarSugerenciasDeseo);
document.getElementById('campoDeseoNuevo').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); agregarDeseo(e.target.value); }
});
document.getElementById('btnAgregarDeseo').addEventListener('click', () => agregarDeseo(document.getElementById('campoDeseoNuevo').value));
document.getElementById('sugerenciasDeseo').addEventListener('click', (e) => {
  const b = e.target.closest('[data-deseo]');
  if (b) agregarDeseo(b.dataset.deseo);
});
document.getElementById('listaDeseosCliente').addEventListener('click', (e) => {
  const b = e.target.closest('[data-quitar]');
  if (!b) return;
  deseosEditando.splice(Number(b.dataset.quitar), 1);
  pintarDeseos();
});

document.getElementById('btnCancelarCliente').addEventListener('click', () => ocultarModal('modalCliente'));

document.getElementById('btnEliminarCliente').addEventListener('click', async () => {
  if (!clienteEditandoId) return;
  if (!confirm('¿Eliminar este cliente? Su historial de compras pasadas se conservará, pero ya no podrás seleccionarlo en ventas nuevas.')) return;
  await Clientes.eliminarCliente(clienteEditandoId);
  ocultarModal('modalCliente');
  refrescarClientes();
});

document.getElementById('btnGuardarCliente').addEventListener('click', async () => {
  const nombre = document.getElementById('campoNombreCliente').value.trim();
  if (!nombre) { alert('Ingresa el nombre del cliente.'); return; }

  await Clientes.guardarCliente({
    id: clienteEditandoId,
    creadoEl: clienteEditandoCreadoEl,
    nombre,
    celular: document.getElementById('campoCelularCliente').value,
    notas: document.getElementById('campoNotasCliente').value,
    tipo: document.getElementById('campoTipoCliente').value,
    intereses: [...document.querySelectorAll('#campoInteresesCliente input:checked')].map((i) => i.value),
    // Lo que quedó escrito sin tocar "Agregar" también se guarda
    deseos: deseosEditando.concat(document.getElementById('campoDeseoNuevo').value.trim() || []),
  });

  ocultarModal('modalCliente');
  refrescarClientes();
});

async function abrirHistorialCliente(cliente) {
  document.getElementById('tituloHistorialCliente').textContent = `Compras de ${cliente.nombre}`;
  const historial = await Clientes.historialDeCliente(cliente.id);
  const contenedor = document.getElementById('listaHistorialCliente');

  if (historial.length === 0) {
    contenedor.innerHTML = '<div class="vacio">Este cliente aún no tiene compras registradas.</div>';
  } else {
    contenedor.innerHTML = historial.map((v) => `
      <div class="card">
        <div class="info">
          <h3>${escaparHtml(v.nombreProducto)} &times;${v.cantidad}</h3>
          <p>${new Date(v.fecha).toLocaleString()}</p>
          <p class="precio">Total: L. ${v.total.toFixed(2)}</p>
        </div>
      </div>
    `).join('');
  }
  mostrarModal('modalHistorialCliente');
}

document.getElementById('btnCerrarHistorial').addEventListener('click', () => ocultarModal('modalHistorialCliente'));

// =========================================================
// PROVEEDORES
// =========================================================

async function refrescarProveedores(filtro = '') {
  const contenedor = document.getElementById('listaProveedores');
  const proveedores = filtro ? await Proveedores.buscarProveedores(filtro) : await Proveedores.listarProveedores();

  if (proveedores.length === 0) {
    contenedor.innerHTML = '<div class="vacio">Aún no hay proveedores. Toca "+" para agregar el primero.</div>';
    return;
  }

  contenedor.innerHTML = proveedores.map((p) => `
    <div class="card" data-id="${p.id}">
      <div class="info">
        <h3>${escaparHtml(p.nombre)}</h3>
        ${p.empresa ? `<p>${escaparHtml(p.empresa)}</p>` : ''}
        <p>${escaparHtml(p.telefono || 'Sin celular')}</p>
        ${p.direccion ? `<p style="font-size:12px;color:#888;">${escaparHtml(p.direccion)}</p>` : ''}
      </div>
    </div>
  `).join('');

  contenedor.querySelectorAll('.card').forEach((card) => {
    card.addEventListener('click', () => mostrarOpcionesProveedor(card.dataset.id));
  });
}

document.getElementById('buscarProveedor').addEventListener('input', (e) => refrescarProveedores(e.target.value));

async function mostrarOpcionesProveedor(id) {
  const proveedores = await Proveedores.listarProveedores();
  const proveedor = proveedores.find((p) => p.id === id);
  if (!proveedor) return;
  abrirModalProveedor(proveedor);
}

function abrirModalProveedor(proveedor = null) {
  proveedorEditandoId = proveedor ? proveedor.id : null;
  proveedorEditandoCreadoEl = proveedor ? proveedor.creadoEl : null;
  document.getElementById('tituloModalProveedor').textContent = proveedor ? 'Editar proveedor' : 'Nuevo proveedor';
  document.getElementById('campoNombreProveedor').value = proveedor?.nombre || '';
  document.getElementById('campoEmpresaProveedor').value = proveedor?.empresa || '';
  document.getElementById('campoTelefonoProveedor').value = proveedor?.telefono || '';
  document.getElementById('campoDireccionProveedor').value = proveedor?.direccion || '';
  document.getElementById('filaEliminarProveedor').style.display = proveedor ? 'flex' : 'none';
  mostrarModal('modalProveedor');
}

document.getElementById('btnCancelarProveedor').addEventListener('click', () => ocultarModal('modalProveedor'));

document.getElementById('btnGuardarProveedor').addEventListener('click', async () => {
  const nombre = document.getElementById('campoNombreProveedor').value.trim();
  if (!nombre) { alert('Ingresa el nombre del proveedor.'); return; }

  await Proveedores.guardarProveedor({
    id: proveedorEditandoId,
    creadoEl: proveedorEditandoCreadoEl,
    nombre,
    empresa: document.getElementById('campoEmpresaProveedor').value,
    telefono: document.getElementById('campoTelefonoProveedor').value,
    direccion: document.getElementById('campoDireccionProveedor').value,
  });

  ocultarModal('modalProveedor');
  refrescarProveedores();
});

document.getElementById('btnEliminarProveedor').addEventListener('click', async () => {
  if (!proveedorEditandoId) return;
  if (!confirm('¿Eliminar este proveedor? Los productos que lo tengan asignado conservarán el historial, pero ya no podrás seleccionarlo para productos nuevos.')) return;
  await Proveedores.eliminarProveedor(proveedorEditandoId);
  ocultarModal('modalProveedor');
  refrescarProveedores();
});

// =========================================================
// REPORTES Y RESPALDO
// =========================================================

function manejarErrorCompartir(err) {
  // El usuario cancela el menú de compartir: no es un error real, se ignora.
  if (err.name !== 'AbortError') {
    console.error(err);
    alert('No se pudo compartir el reporte.');
  }
}

prepararSelectorMes('selectorMesVentas', () => mesVentas, (m) => { mesVentas = m; refrescarVentas(); },
  async () => (await Ventas.listarVentas({ incluirAnuladas: true })).map((v) => claveMes(v.fecha)));
prepararSelectorMes('selectorMesCompras', () => mesCompras, (m) => { mesCompras = m; refrescarCompras(); },
  async () => (await Compras.listarCompras({ incluirAnuladas: true })).map((c) => claveMes(c.fecha)));

// Reportes: al elegir un mes se llenan solas las fechas Desde y Hasta
function conectarMesReporte(idMes, idDesde, idHasta) {
  const mes = document.getElementById(idMes);
  const aplicar = () => {
    if (!/^\d{4}-\d{2}$/.test(mes.value)) return;
    const { desde, hasta } = limitesDeMes(mes.value);
    document.getElementById(idDesde).value = desde;
    document.getElementById(idHasta).value = hasta;
  };
  mes.value = MES_ACTUAL();
  aplicar();
  mes.addEventListener('change', aplicar);
  // Si cambian una fecha a mano, el mes deja de aplicar
  [idDesde, idHasta].forEach((id) => document.getElementById(id).addEventListener('change', () => { mes.value = ''; }));
}
conectarMesReporte('reporteMes', 'reporteDesde', 'reporteHasta');
conectarMesReporte('reporteComprasMes', 'reporteComprasDesde', 'reporteComprasHasta');

document.getElementById('btnGenerarReporteCompras').addEventListener('click', async () => {
  const desde = document.getElementById('reporteComprasDesde').value || null;
  const hasta = document.getElementById('reporteComprasHasta').value || null;
  try { await Reportes.generarReporteComprasPDF({ desde, hasta }); } catch (err) { alert(err.message || 'No se pudo crear el reporte.'); }
});

document.getElementById('btnCompartirReporteCompras').addEventListener('click', async () => {
  const desde = document.getElementById('reporteComprasDesde').value || null;
  const hasta = document.getElementById('reporteComprasHasta').value || null;
  try {
    await Reportes.compartirReporteComprasPDF({ desde, hasta });
  } catch (err) {
    manejarErrorCompartir(err);
  }
});

document.getElementById('btnGenerarReporte').addEventListener('click', async () => {
  const desde = document.getElementById('reporteDesde').value || null;
  const hasta = document.getElementById('reporteHasta').value || null;
  await Reportes.generarReporteVentasPDF({ desde, hasta });
});

document.getElementById('btnCompartirReporte').addEventListener('click', async () => {
  const desde = document.getElementById('reporteDesde').value || null;
  const hasta = document.getElementById('reporteHasta').value || null;
  try {
    await Reportes.compartirReporteVentasPDF({ desde, hasta });
  } catch (err) {
    manejarErrorCompartir(err);
  }
});

document.getElementById('btnGenerarReporteClientes').addEventListener('click', () => Reportes.generarReporteClientesPDF());
document.getElementById('btnCompartirReporteClientes').addEventListener('click', async () => {
  try {
    await Reportes.compartirReporteClientesPDF();
  } catch (err) {
    manejarErrorCompartir(err);
  }
});

document.getElementById('btnGenerarReporteInventario').addEventListener('click', () => Reportes.generarReporteInventarioPDF());
document.getElementById('btnCompartirReporteInventario').addEventListener('click', async () => {
  try {
    await Reportes.compartirReporteInventarioPDF();
  } catch (err) {
    manejarErrorCompartir(err);
  }
});

document.getElementById('btnGenerarReporteProveedores').addEventListener('click', () => Reportes.generarReporteProveedoresPDF());
document.getElementById('btnCompartirReporteProveedores').addEventListener('click', async () => {
  try {
    await Reportes.compartirReporteProveedoresPDF();
  } catch (err) {
    manejarErrorCompartir(err);
  }
});

document.getElementById('btnExportar').addEventListener('click', () => Backup.exportarRespaldo());

document.getElementById('btnImportar').addEventListener('click', () => document.getElementById('inputImportar').click());

document.getElementById('inputImportar').addEventListener('change', async (e) => {
  const archivo = e.target.files[0];
  if (!archivo) return;
  e.target.value = ''; // permite volver a elegir el mismo archivo
  if (!confirm('⚠️ Esto REEMPLAZA todo el inventario, ventas, clientes y proveedores (en todos los celulares) con los datos del respaldo.\n\nAntes se descargará automáticamente una copia de lo que hay ahora.\n\n¿Continuar?')) return;
  try {
    await Backup.importarRespaldoDesdeArchivo(archivo);
    await Catalogo.sincronizarTodo().catch(() => {});
    alert('Respaldo importado correctamente.');
    refrescarInventario();
    refrescarVentas();
    refrescarClientes();
    refrescarProveedores();
  } catch (err) {
    alert('No se pudo importar el respaldo: ' + err.message);
  }
});

// =========================================================
// INICIO
// =========================================================

if ('serviceWorker' in navigator) {
  // Cuando se publica una versión nueva, la app se recarga sola una vez para
  // mostrarla (sin tener que cerrarla y abrirla dos veces). Si hay una ventana
  // abierta (por ejemplo, una venta a medio llenar) espera a que se cierre.
  const habiaVersion = !!navigator.serviceWorker.controller;
  let recargaPendiente = false;
  const recargarSiSePuede = () => {
    if (!recargaPendiente) return;
    if (document.querySelector('.modal-overlay.activo')) return;
    recargaPendiente = false;
    location.reload();
  };
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!habiaVersion) return; // primera instalación: no hace falta recargar
    recargaPendiente = true;
    recargarSiSePuede();
  });
  setInterval(recargarSiSePuede, 3000);
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((reg) => {
      reg.update().catch(() => {});
      // Al volver a la app (desde WhatsApp, por ejemplo) revisa si hay versión nueva
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {});
      });
    }).catch((err) => console.warn('SW no registrado', err));
  });
}

// ---------- Acceso con Google ----------
const pantallaAcceso = document.getElementById('pantallaAcceso');
const mensajeAcceso = document.getElementById('mensajeAcceso');
const btnEntrarGoogle = document.getElementById('btnEntrarGoogle');
const btnSesion = document.getElementById('btnSesion');

DB.alCambiarSesion((user, estado, correo) => {
  if (user) {
    pantallaAcceso.classList.add('oculta');
    btnSesion.style.display = 'block';
    btnSesion.textContent = (user.displayName || user.email).split(' ')[0] + ' · Salir';
    return;
  }
  pantallaAcceso.classList.remove('oculta');
  btnSesion.style.display = 'none';
  btnEntrarGoogle.style.display = 'block';
  mensajeAcceso.textContent = estado === 'no-autorizado'
    ? 'La cuenta ' + correo + ' no tiene permiso para usar Encantos. Entra con una cuenta autorizada.'
    : 'Inicia sesión con tu cuenta de Google autorizada para ver el inventario.';
});

btnEntrarGoogle.addEventListener('click', async () => {
  if (!navigator.onLine) { alert('Para iniciar sesión la primera vez necesitas internet.'); return; }
  btnEntrarGoogle.disabled = true;
  mensajeAcceso.textContent = 'Abriendo Google...';
  try {
    await DB.iniciarSesionGoogle();
  } catch (err) {
    mensajeAcceso.textContent = 'No se pudo iniciar sesión (' + (err.code || err.message) + '). Intenta de nuevo.';
  } finally {
    btnEntrarGoogle.disabled = false;
  }
});

btnSesion.addEventListener('click', () => {
  if (confirm('¿Cerrar sesión en este celular? Necesitarás internet para volver a entrar.')) DB.cerrarSesion();
});

DB.authReady.then(() => {
  refrescarInventario();
  // Revisa que el catálogo público coincida con el inventario (precios, fotos,
  // disponibilidad). Solo con internet, para no gastar tiempo sin señal.
  if (navigator.onLine) {
    Catalogo.sincronizarTodo()
      .then((n) => { if (n) console.info('Catálogo actualizado: ' + n + ' cambio(s)'); })
      .catch((e) => console.warn('No se pudo revisar el catálogo', e));
  }
});

// Sincronización en tiempo real: cuando el otro celular agrega, edita o vende
// algo, esta pantalla se actualiza sola (y al revés).
DB.escucharCambios(DB.STORES.productos, () => refrescarInventario(document.getElementById('buscarTexto').value));
DB.escucharCambios(DB.STORES.clientes, () => refrescarClientes(document.getElementById('buscarCliente').value));
DB.escucharCambios(DB.STORES.ventas, () => refrescarVentas());
DB.escucharCambios(DB.STORES.compras, () => refrescarCompras());
DB.escucharCambios(DB.STORES.proveedores, () => refrescarProveedores(document.getElementById('buscarProveedor').value));
