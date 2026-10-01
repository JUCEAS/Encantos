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
    { id: 'editar', texto: '✏️ Editar o eliminar' },
  ]);
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

async function abrirModalVenta(producto) {
  if ((Number(producto.stock) || 0) <= 0) {
    alert(`⛔ No se puede vender "${producto.nombre}": no hay existencias (stock 0).`);
    return;
  }
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

function actualizarGananciaEstimada() {
  if (!ventaProductoActual) return;
  const cantidad = parseInt(document.getElementById('campoCantidadVenta').value, 10) || 0;
  const precio = parseFloat(document.getElementById('campoPrecioVenta').value) || 0;
  const ganancia = (precio - (ventaProductoActual.costo || 0)) * cantidad;
  document.getElementById('gananciaEstimada').textContent = `L. ${ganancia.toFixed(2)}`;
}

document.getElementById('campoCantidadVenta').addEventListener('input', actualizarGananciaEstimada);
document.getElementById('campoPrecioVenta').addEventListener('input', actualizarGananciaEstimada);
document.getElementById('btnCancelarVenta').addEventListener('click', () => ocultarModal('modalVenta'));

document.getElementById('btnConfirmarVenta').addEventListener('click', async () => {
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
  const ventasHoy = ventas.filter((v) => !v.anulada && new Date(v.fecha).toDateString() === hoy);
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

  contenedor.innerHTML = '<p class="ayuda-lista">Toca una venta para anularla.</p>' + ventasDelMes.map((v) => `
    <div class="card${v.anulada ? ' venta-anulada' : ''}" data-id="${escaparHtml(v.id)}">
      <div class="info">
        <h3>${escaparHtml(v.nombreProducto)} &times;${Number(v.cantidad) || 0}${v.anulada ? ' <span class="chip anulada">ANULADA</span>' : ''}</h3>
        <p>${new Date(v.fecha).toLocaleString()}</p>
        <p class="precio">Total: L. ${(Number(v.total) || 0).toFixed(2)} &middot; Ganancia: L. ${(Number(v.ganancia) || 0).toFixed(2)}</p>
        ${v.anulada ? `<p class="nota-anulada">Anulada el ${new Date(v.anuladaEl).toLocaleString()}${v.anuladaPor ? ' por ' + escaparHtml(v.anuladaPor) : ''}</p>` : ''}
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
  const delMes = delMesElegido(ventas, mesVentas).filter((v) => !v.anulada);
  const vendido = delMes.reduce((s, v) => s + (Number(v.total) || 0), 0);
  const ganancia = delMes.reduce((s, v) => s + (Number(v.ganancia) || 0), 0);
  const margen = vendido > 0 ? (ganancia / vendido) * 100 : 0;
  document.getElementById('resumenVendidoMes').textContent = formatoL(vendido);
  document.getElementById('resumenGananciaMes').textContent = formatoL(ganancia);
  const elMargen = document.getElementById('resumenMargenMes');
  elMargen.textContent = vendido > 0 ? margen.toFixed(1) + '%' : '—';
  elMargen.classList.toggle('margen-bajo', vendido > 0 && margen < 10);

  // Ventas de productos sin costo registrado: su ganancia sale "inflada"
  const sinCosto = delMes.filter((v) => !(Number(v.costoUnitario) > 0)).length;
  let nota = vendido > 0
    ? `De cada L. 100 vendidos, les quedan L. ${margen.toFixed(0)} de ganancia (${delMes.length} venta${delMes.length === 1 ? '' : 's'} en el mes).`
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
  const detalle = `${venta.nombreProducto} ×${venta.cantidad} · Total L. ${(Number(venta.total) || 0).toFixed(2)} · ${new Date(venta.fecha).toLocaleString()}`;
  if (venta.anulada) {
    await elegirAccion('Venta anulada', [], detalle + ' · Ya no cuenta en los totales ni en los reportes.', 'Cerrar');
    return;
  }
  const accion = await elegirAccion('¿Anular esta venta?', [
    { id: 'anular', texto: '↩️ Sí, anular y devolver al inventario', principal: true },
  ], detalle);
  if (accion !== 'anular') return;
  try {
    const r = await Ventas.anularVenta(id);
    refrescarVentas();
    refrescarInventario(document.getElementById('buscarTexto').value);
    if (!r.productoExiste) alert('Venta anulada. El producto ya no existe en el inventario, así que no se devolvió stock.');
  } catch (err) {
    alert(err.message || 'No se pudo anular la venta. Revisa tu conexión e intenta de nuevo.');
  }
}

// =========================================================
// COMPRAS
// =========================================================

let compraProductos = [];

async function abrirModalCompra(productoElegido = null) {
  const [productos, proveedores] = await Promise.all([Inventario.listarProductos(), Proveedores.listarProveedores()]);
  compraProductos = productos.slice().sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
  const selProd = document.getElementById('campoProductoCompra');
  selProd.innerHTML = '<option value="">— Elige el producto —</option>' + compraProductos.map((p) =>
    `<option value="${escaparHtml(p.id)}">${escaparHtml(p.nombre)} (stock: ${Number(p.stock) || 0})</option>`).join('');
  const selProv = document.getElementById('campoProveedorCompra');
  selProv.innerHTML = '<option value="">— Sin proveedor —</option>' + proveedores.map((pr) =>
    `<option value="${escaparHtml(pr.id)}">${escaparHtml(pr.nombre)}${pr.empresa ? ' · ' + escaparHtml(pr.empresa) : ''}</option>`).join('');
  selProd.value = productoElegido ? productoElegido.id : '';
  document.getElementById('campoCantidadCompra').value = 1;
  document.getElementById('campoFechaCompra').value = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  document.getElementById('campoNotaCompra').value = '';
  alCambiarProductoCompra();
  mostrarModal('modalCompra');
}

function alCambiarProductoCompra() {
  const p = compraProductos.find((x) => x.id === document.getElementById('campoProductoCompra').value);
  document.getElementById('campoCostoCompra').value = p && Number(p.costo) > 0 ? Number(p.costo).toFixed(2) : '';
  if (p && p.proveedorId) document.getElementById('campoProveedorCompra').value = p.proveedorId;
  actualizarPreviaCompra();
}

function actualizarPreviaCompra() {
  const caja = document.getElementById('previaCompra');
  const p = compraProductos.find((x) => x.id === document.getElementById('campoProductoCompra').value);
  const cantidad = parseInt(document.getElementById('campoCantidadCompra').value, 10) || 0;
  const costo = parseFloat(document.getElementById('campoCostoCompra').value);
  if (!p || cantidad < 1 || !(costo >= 0)) { caja.innerHTML = ''; return; }
  const stock = Number(p.stock) || 0;
  const nuevoCosto = Compras.costoPromedio(stock, p.costo, cantidad, costo);
  const precio = Number(p.precio) || 0;
  const margen = precio > 0 ? ((precio - nuevoCosto) / precio) * 100 : null;
  caja.innerHTML = `
    Total de la compra: <b>${formatoL(cantidad * costo)}</b><br>
    Stock: ${stock} → <b>${stock + cantidad}</b><br>
    Costo por unidad: ${formatoL(p.costo)} → <b>${formatoL(nuevoCosto)}</b> (promedio)<br>
    ${margen !== null ? `Vendiendo a ${formatoL(precio)}, ganarían <b>${margen.toFixed(0)}%</b> por unidad.` : 'Este producto no tiene precio de venta.'}`;
}

document.getElementById('campoProductoCompra').addEventListener('change', alCambiarProductoCompra);
['campoCantidadCompra', 'campoCostoCompra'].forEach((id) => document.getElementById(id).addEventListener('input', actualizarPreviaCompra));
document.getElementById('btnCancelarCompra').addEventListener('click', () => ocultarModal('modalCompra'));

document.getElementById('btnConfirmarCompra').addEventListener('click', async () => {
  const boton = document.getElementById('btnConfirmarCompra');
  if (boton.disabled) return;
  boton.disabled = true;
  try {
    const compra = await Compras.registrarCompra({
      productoId: document.getElementById('campoProductoCompra').value,
      proveedorId: document.getElementById('campoProveedorCompra').value,
      cantidad: document.getElementById('campoCantidadCompra').value,
      costoUnitario: document.getElementById('campoCostoCompra').value,
      fecha: document.getElementById('campoFechaCompra').value,
      nota: document.getElementById('campoNotaCompra').value,
    });
    ocultarModal('modalCompra');
    refrescarCompras();
    refrescarInventario(document.getElementById('buscarTexto').value);
    alert(`✅ Compra guardada: ${compra.nombreProducto} +${compra.cantidad}.`);
  } catch (err) {
    alert(err.message || 'No se pudo guardar la compra.');
  } finally {
    boton.disabled = false;
  }
});

async function refrescarCompras() {
  const contenedor = document.getElementById('listaCompras');
  if (!contenedor) return;
  const todas = await Compras.listarCompras({ incluirAnuladas: true });
  pintarSelectorMes('selectorMesCompras', mesCompras);
  const compras = delMesElegido(todas, mesCompras);
  const delMes = compras.filter((c) => !c.anulada);
  document.getElementById('resumenComprasMes').textContent = formatoL(delMes.reduce((s, c) => s + (Number(c.total) || 0), 0));
  document.getElementById('resumenUnidadesMes').textContent = String(delMes.reduce((s, c) => s + (Number(c.cantidad) || 0), 0));

  if (compras.length === 0) {
    contenedor.innerHTML = todas.length
      ? `<div class="vacio">No hay compras en ${nombreDeMes(mesCompras)}.</div>`
      : '<div class="vacio">Aún no hay compras. Toca "+" para registrar la primera.</div>';
    return;
  }
  contenedor.innerHTML = '<p class="ayuda-lista">Toca una compra para ver el detalle o anularla.</p>' + compras.map((c) => `
    <div class="card${c.anulada ? ' compra-anulada' : ''}" data-id="${escaparHtml(c.id)}">
      <div class="info">
        <h3>${escaparHtml(c.nombreProducto)} +${Number(c.cantidad) || 0}${c.anulada ? ' <span class="chip anulada">ANULADA</span>' : ''}</h3>
        <p>${new Date(c.fecha).toLocaleDateString()}${c.nombreProveedor ? ' · 🚚 ' + escaparHtml(c.nombreProveedor) : ''}</p>
        <p class="precio">Total: ${formatoL(c.total)} &middot; ${formatoL(c.costoUnitario)} c/u</p>
        ${c.nota ? `<p style="font-size:12px;color:#888;">📝 ${escaparHtml(c.nota)}</p>` : ''}
        ${c.anulada ? `<p class="nota-anulada">Anulada el ${new Date(c.anuladaEl).toLocaleString()}${c.anuladaPor ? ' por ' + escaparHtml(c.anuladaPor) : ''}</p>` : ''}
      </div>
    </div>`).join('');
  contenedor.querySelectorAll('.card[data-id]').forEach((card) => {
    card.addEventListener('click', () => mostrarOpcionesCompra(card.dataset.id));
  });
}

async function mostrarOpcionesCompra(id) {
  const compras = await Compras.listarCompras({ incluirAnuladas: true });
  const c = compras.find((x) => x.id === id);
  if (!c) return;
  const detalle = `${c.nombreProducto} +${c.cantidad} · ${formatoL(c.costoUnitario)} c/u · Total ${formatoL(c.total)} · ${new Date(c.fecha).toLocaleDateString()}` +
    (c.registradaPor ? ` · Registró: ${c.registradaPor}` : '');
  if (c.anulada) {
    await elegirAccion('Compra anulada', [], detalle + ' · Ya no cuenta en los totales.', 'Cerrar');
    return;
  }
  const accion = await elegirAccion('Compra', [
    { id: 'anular', texto: '↩️ Anular compra (quitar del stock)' },
  ], detalle, 'Cerrar');
  if (accion !== 'anular') return;
  const seguro = await elegirAccion('¿Anular esta compra?', [
    { id: 'si', texto: 'Sí, anular', principal: true },
  ], `Se quitarán ${c.cantidad} unidades de "${c.nombreProducto}" y se recalculará el costo.`);
  if (seguro !== 'si') return;
  try {
    await Compras.anularCompra(id);
    refrescarCompras();
    refrescarInventario(document.getElementById('buscarTexto').value);
  } catch (err) {
    alert(err.message || 'No se pudo anular la compra.');
  }
}

// =========================================================
// CLIENTES
// =========================================================

async function refrescarClientes(filtro = '') {
  const contenedor = document.getElementById('listaClientes');
  const clientes = filtro ? await Clientes.buscarClientes(filtro) : await Clientes.listarClientes();

  if (clientes.length === 0) {
    contenedor.innerHTML = '<div class="vacio">Aún no hay clientes. Toca "+" para agregar el primero.</div>';
    return;
  }

  contenedor.innerHTML = clientes.map((c) => `
    <div class="card" data-id="${c.id}">
      <div class="info">
        <h3>${escaparHtml(c.nombre)}</h3>
        <p>${escaparHtml(c.celular || 'Sin celular')}</p>
        ${c.creadoEl ? `<p style="font-size:12px;color:#888;">Cliente desde: ${new Date(c.creadoEl).toLocaleDateString()}</p>` : ''}
      </div>
    </div>
  `).join('');

  contenedor.querySelectorAll('.card').forEach((card) => {
    card.addEventListener('click', () => mostrarOpcionesCliente(card.dataset.id));
  });
}

document.getElementById('buscarCliente').addEventListener('input', (e) => refrescarClientes(e.target.value));

async function mostrarOpcionesCliente(id) {
  const clientes = await Clientes.listarClientes();
  const cliente = clientes.find((c) => c.id === id);
  if (!cliente) return;
  const accion = await elegirAccion(cliente.nombre, [
    { id: 'historial', texto: '🧾 Ver historial de compras', principal: true },
    { id: 'editar', texto: '✏️ Editar o eliminar' },
  ]);
  if (accion === 'historial') abrirHistorialCliente(cliente);
  else if (accion === 'editar') abrirModalCliente(cliente);
}

function abrirModalCliente(cliente = null) {
  clienteEditandoId = cliente ? cliente.id : null;
  clienteEditandoCreadoEl = cliente ? cliente.creadoEl : null;
  document.getElementById('tituloModalCliente').textContent = cliente ? 'Editar cliente' : 'Nuevo cliente';
  document.getElementById('campoNombreCliente').value = cliente?.nombre || '';
  document.getElementById('campoCelularCliente').value = cliente?.celular || '';
  document.getElementById('campoNotasCliente').value = cliente?.notas || '';
  document.getElementById('filaEliminarCliente').style.display = cliente ? 'flex' : 'none';
  mostrarModal('modalCliente');
}

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
