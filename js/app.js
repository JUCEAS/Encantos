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
let catalogoEditando = null;
let fotoCatalogoDataUrl = null;
let pedidoEditando = null;
let cacheCatalogoPedidos = [];

// ---------- Navegación entre pestañas ----------
// Las pestañas de abajo son 5; lo demás (catálogo, proveedores, reportes y
// datos del negocio) cuelga de "Más".
const VISTAS_DE_MAS = ['mas', 'catalogo', 'proveedores', 'reportes', 'configuracion'];
const VISTAS_CON_BOTON_AGREGAR = ['inventario', 'clientes', 'proveedores', 'catalogo', 'pedidos'];

document.querySelectorAll('.tabbar .tab').forEach((btn) => {
  btn.addEventListener('click', () => cambiarVista(btn.dataset.vista));
});

// Tarjetas del menú "Más" y botones "Volver"
document.querySelectorAll('[data-ir]').forEach((el) => {
  el.addEventListener('click', () => cambiarVista(el.dataset.ir));
});

function cambiarVista(nombre) {
  document.querySelectorAll('.vista').forEach((v) => v.classList.remove('activa'));
  document.getElementById('vista-' + nombre).classList.add('activa');

  const pestanaActiva = VISTAS_DE_MAS.includes(nombre) ? 'mas' : nombre;
  document.querySelectorAll('.tabbar .tab').forEach((b) => b.classList.toggle('activo', b.dataset.vista === pestanaActiva));

  document.getElementById('btnAgregar').style.display = VISTAS_CON_BOTON_AGREGAR.includes(nombre) ? 'block' : 'none';

  if (nombre === 'inventario') refrescarInventario();
  if (nombre === 'ventas') refrescarVentas();
  if (nombre === 'pedidos') refrescarPedidos();
  if (nombre === 'clientes') refrescarClientes();
  if (nombre === 'proveedores') refrescarProveedores();
  if (nombre === 'catalogo') refrescarCatalogo();
  if (nombre === 'configuracion') cargarConfiguracion();

  window.scrollTo(0, 0);
}

// ---------- Botón flotante "+" según la pestaña activa ----------
document.getElementById('btnAgregar').addEventListener('click', () => {
  const vistaActiva = document.querySelector('.vista.activa').id;
  if (vistaActiva === 'vista-inventario') abrirModalProducto();
  if (vistaActiva === 'vista-clientes') abrirModalCliente();
  if (vistaActiva === 'vista-proveedores') abrirModalProveedor();
  if (vistaActiva === 'vista-catalogo') abrirModalCatalogo();
  if (vistaActiva === 'vista-pedidos') abrirModalPedido();
});

function mostrarModal(id) { document.getElementById(id).classList.add('activo'); }
function ocultarModal(id) { document.getElementById(id).classList.remove('activo'); }

// =========================================================
// INVENTARIO
// =========================================================

async function refrescarInventario(filtro = '') {
  const contenedor = document.getElementById('listaProductos');
  const productos = filtro ? await Inventario.buscarPorTexto(filtro) : await Inventario.listarProductos();

  if (productos.length === 0) {
    contenedor.innerHTML = '<div class="vacio">Aún no hay productos. Toca "+" para agregar el primero.</div>';
    return;
  }

  const proveedores = await Proveedores.listarProveedores();
  const mapaProveedores = new Map(proveedores.map((pr) => [pr.id, pr]));

  contenedor.innerHTML = productos.map((p) => {
    let lineaOrigen = '';
    if (p.origen === 'Compra a proveedor') {
      const prov = mapaProveedores.get(p.proveedorId);
      lineaOrigen = `🚚 Proveedor: ${prov ? escaparHtml(prov.nombre) : 'no especificado'}`;
    } else if (p.origen === 'Reproducción propia') {
      lineaOrigen = '🌱 Reproducción propia';
    }
    return `
    <div class="card" data-id="${p.id}">
      <img class="foto-producto" src="${p.foto || ''}" onerror="this.style.opacity=0">
      <div class="info">
        <span class="chip">${p.categoria}</span>
        <h3>${escaparHtml(p.nombre)}</h3>
        <p>${escaparHtml(p.descripcion || '')}</p>
        ${(p.tipoSol || p.riego) ? `<p style="font-size:12px;color:#888;">${[p.tipoSol ? '☀️ ' + p.tipoSol : '', p.riego ? '💧 ' + p.riego : ''].filter(Boolean).join(' &middot; ')}</p>` : ''}
        ${lineaOrigen ? `<p style="font-size:12px;color:#888;">${lineaOrigen}</p>` : ''}
        <p class="precio">L. ${p.precio.toFixed(2)} &middot; <span class="${p.stock <= 2 ? 'stock-bajo' : ''}">Stock: ${p.stock}</span></p>
      </div>
    </div>
  `;
  }).join('');

  contenedor.querySelectorAll('.card').forEach((card) => {
    card.addEventListener('click', () => mostrarOpcionesProducto(card.dataset.id));
  });
}

function escaparHtml(texto) {
  const d = document.createElement('div');
  d.textContent = texto;
  return d.innerHTML;
}

async function mostrarOpcionesProducto(id) {
  const productos = await Inventario.listarProductos();
  const producto = productos.find((p) => p.id === id);
  if (!producto) return;

  const accion = confirm(`${producto.nombre}\n\nAceptar = Vender\nCancelar = Editar / Eliminar`);
  if (accion) {
    abrirModalVenta(producto);
  } else {
    abrirModalProducto(producto);
  }
}

document.getElementById('buscarTexto').addEventListener('input', (e) => refrescarInventario(e.target.value));

async function abrirModalProducto(producto = null) {
  productoEditandoId = producto ? producto.id : null;
  productoEditandoCreadoEl = producto ? producto.creadoEl : null;
  fotoTemporalDataUrl = producto ? producto.foto : null;
  embeddingTemporal = producto ? producto.embedding : null;

  document.getElementById('tituloModalProducto').textContent = producto ? 'Editar producto' : 'Nuevo producto';

  const select = document.getElementById('campoCategoria');
  select.innerHTML = Inventario.CATEGORIAS.map((c) => `<option value="${c}">${c}</option>`).join('');

  const selectSol = document.getElementById('campoTipoSol');
  selectSol.innerHTML = '<option value="">No aplica</option>' +
    Inventario.TIPOS_SOL.map((s) => `<option value="${s}">${s}</option>`).join('');

  const selectRiego = document.getElementById('campoRiego');
  selectRiego.innerHTML = '<option value="">No aplica</option>' +
    Inventario.TIPOS_RIEGO.map((r) => `<option value="${r}">${r}</option>`).join('');

  document.getElementById('campoNombre').value = producto?.nombre || '';
  select.value = producto?.categoria || Inventario.CATEGORIAS[0];
  document.getElementById('campoDescripcion').value = producto?.descripcion || '';
  selectSol.value = producto?.tipoSol || '';
  selectRiego.value = producto?.riego || '';

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

  await Inventario.guardarProducto({
    id: productoEditandoId,
    creadoEl: productoEditandoCreadoEl,
    nombre,
    categoria: document.getElementById('campoCategoria').value,
    descripcion: document.getElementById('campoDescripcion').value,
    tipoSol: document.getElementById('campoTipoSol').value,
    riego: document.getElementById('campoRiego').value,
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
        <img src="${producto.foto || ''}">
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
  ventaProductoActual = producto;
  document.getElementById('ventaProductoNombre').textContent = `${producto.nombre} (stock: ${producto.stock})`;
  document.getElementById('campoCantidadVenta').value = 1;
  document.getElementById('campoCantidadVenta').max = producto.stock;
  document.getElementById('campoPrecioVenta').value = producto.precio.toFixed(2);

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
  const ventas = await Ventas.listarVentas();

  const hoy = new Date().toDateString();
  const ventasHoy = ventas.filter((v) => new Date(v.fecha).toDateString() === hoy);
  document.getElementById('resumenTotalHoy').textContent = 'L. ' + ventasHoy.reduce((s, v) => s + v.total, 0).toFixed(2);
  document.getElementById('resumenGananciaHoy').textContent = 'L. ' + ventasHoy.reduce((s, v) => s + v.ganancia, 0).toFixed(2);

  if (ventas.length === 0) {
    contenedor.innerHTML = '<div class="vacio">Aún no hay ventas registradas.</div>';
    return;
  }

  contenedor.innerHTML = ventas.map((v) => `
    <div class="card" data-id="${v.id}">
      <div class="info">
        <h3>${escaparHtml(v.nombreProducto)} &times;${v.cantidad}</h3>
        <p>${new Date(v.fecha).toLocaleString()}</p>
        <p class="precio">Total: L. ${v.total.toFixed(2)} &middot; Ganancia: L. ${v.ganancia.toFixed(2)}</p>
      </div>
    </div>
  `).join('');

  contenedor.querySelectorAll('.card').forEach((card) => {
    card.addEventListener('click', () => mostrarOpcionesVenta(card.dataset.id));
  });
}

async function mostrarOpcionesVenta(id) {
  const ventas = await Ventas.listarVentas();
  const venta = ventas.find((v) => v.id === id);
  if (!venta) return;
  if (!confirm(`${venta.nombreProducto} x${venta.cantidad}\nTotal: L. ${venta.total.toFixed(2)}\n\n¿Anular esta venta? El stock vendido regresará al inventario.`)) return;
  await Ventas.eliminarVenta(id);
  refrescarVentas();
  refrescarInventario();
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
  const accion = confirm(`${cliente.nombre}\n\nAceptar = Ver historial de compras\nCancelar = Editar / Eliminar`);
  if (accion) {
    abrirHistorialCliente(cliente);
  } else {
    abrirModalCliente(cliente);
  }
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
// CATÁLOGO DE ENCARGOS (lo que ve el público en catalogo.html)
// =========================================================

function llenarSelect(select, opciones, textoVacio) {
  select.innerHTML = (textoVacio !== undefined ? `<option value="">${textoVacio}</option>` : '') +
    opciones.map((o) => `<option value="${escaparHtml(o)}">${escaparHtml(o)}</option>`).join('');
}

async function refrescarCatalogo(filtro = '') {
  const contenedor = document.getElementById('listaCatalogo');
  const items = filtro ? await Catalogo.buscarEnCatalogo(filtro) : await Catalogo.listarCatalogo();

  if (items.length === 0) {
    contenedor.innerHTML = '<div class="vacio">Aún no hay plantas en el catálogo. Toca "+" para agregar la primera.</div>';
    return;
  }

  contenedor.innerHTML = items.map((i) => `
    <div class="card" data-id="${i.id}">
      <img class="foto-producto" src="${i.foto || ''}" onerror="this.style.opacity=0">
      <div class="info">
        ${i.visible === false ? '<span class="chip oculto">Oculto</span>' : (i.categoria ? `<span class="chip">${escaparHtml(i.categoria)}</span>` : '')}
        <h3>${escaparHtml(i.nombre)}</h3>
        <p>${escaparHtml(i.descripcion || '')}</p>
        ${i.tiempoEntrega ? `<p style="font-size:12px;color:#888;">⏱ ${escaparHtml(i.tiempoEntrega)}</p>` : ''}
        <p class="precio">L. ${(i.precio || 0).toFixed(2)}</p>
      </div>
    </div>
  `).join('');

  contenedor.querySelectorAll('.card').forEach((card) => {
    card.addEventListener('click', async () => {
      const lista = await Catalogo.listarCatalogo();
      const item = lista.find((x) => x.id === card.dataset.id);
      if (item) abrirModalCatalogo(item);
    });
  });
}

document.getElementById('buscarCatalogo').addEventListener('input', (e) => refrescarCatalogo(e.target.value));

async function abrirModalCatalogo(item = null) {
  catalogoEditando = item;
  fotoCatalogoDataUrl = item ? item.foto : null;

  document.getElementById('tituloModalCatalogo').textContent = item ? 'Editar planta del catálogo' : 'Nueva planta en el catálogo';
  llenarSelect(document.getElementById('campoCatCategoria'), Inventario.CATEGORIAS);
  llenarSelect(document.getElementById('campoCatTipoSol'), Inventario.TIPOS_SOL, 'No aplica');
  llenarSelect(document.getElementById('campoCatRiego'), Inventario.TIPOS_RIEGO, 'No aplica');

  const proveedores = await Proveedores.listarProveedores();
  const selectProv = document.getElementById('campoCatProveedor');
  selectProv.innerHTML = '<option value="">Sin proveedor asignado</option>' +
    proveedores.map((pr) => `<option value="${pr.id}">${escaparHtml(pr.nombre)}${pr.empresa ? ' - ' + escaparHtml(pr.empresa) : ''}</option>`).join('');

  document.getElementById('campoCatCategoria').value = item?.categoria || Inventario.CATEGORIAS[0];
  document.getElementById('campoCatNombre').value = item?.nombre || '';
  document.getElementById('campoCatDescripcion').value = item?.descripcion || '';
  document.getElementById('campoCatTipoSol').value = item?.tipoSol || '';
  document.getElementById('campoCatRiego').value = item?.riego || '';
  document.getElementById('campoCatPrecio').value = item?.precio ?? '';
  document.getElementById('campoCatTiempo').value = item?.tiempoEntrega || '';
  selectProv.value = item?.proveedorId || '';
  document.getElementById('campoCatVisible').checked = item ? item.visible !== false : true;

  const preview = document.getElementById('previewFotoCatalogo');
  if (fotoCatalogoDataUrl) {
    preview.src = fotoCatalogoDataUrl;
    preview.style.display = 'block';
  } else {
    preview.style.display = 'none';
  }

  document.getElementById('filaEliminarCatalogo').style.display = item ? 'flex' : 'none';
  mostrarModal('modalCatalogo');
}

document.getElementById('btnCancelarCatalogo').addEventListener('click', () => ocultarModal('modalCatalogo'));
document.getElementById('btnTomarFotoCatalogo').addEventListener('click', () => document.getElementById('inputCamaraCatalogo').click());
document.getElementById('btnElegirGaleriaCatalogo').addEventListener('click', () => document.getElementById('inputGaleriaCatalogo').click());

async function manejarSeleccionFotoCatalogo(e) {
  const archivo = e.target.files[0];
  if (!archivo) return;
  const dataUrl = await leerArchivoComoDataUrl(archivo);
  // Más pequeña que la del inventario: el catálogo carga muchas fotos en el celular del cliente.
  fotoCatalogoDataUrl = await Inventario.comprimirImagen(dataUrl, 600, 0.7);
  const preview = document.getElementById('previewFotoCatalogo');
  preview.src = fotoCatalogoDataUrl;
  preview.style.display = 'block';
  e.target.value = '';
}

document.getElementById('inputCamaraCatalogo').addEventListener('change', manejarSeleccionFotoCatalogo);
document.getElementById('inputGaleriaCatalogo').addEventListener('change', manejarSeleccionFotoCatalogo);

document.getElementById('btnGuardarCatalogo').addEventListener('click', async () => {
  const nombre = document.getElementById('campoCatNombre').value.trim();
  if (!nombre) { alert('Ingresa el nombre de la planta.'); return; }
  if (!fotoCatalogoDataUrl && !confirm('No agregaste una foto. ¿Guardar de todas formas?')) return;

  await Catalogo.guardarItemCatalogo({
    id: catalogoEditando?.id || null,
    creadoEl: catalogoEditando?.creadoEl || null,
    nombre,
    categoria: document.getElementById('campoCatCategoria').value,
    descripcion: document.getElementById('campoCatDescripcion').value,
    tipoSol: document.getElementById('campoCatTipoSol').value,
    riego: document.getElementById('campoCatRiego').value,
    precio: document.getElementById('campoCatPrecio').value,
    tiempoEntrega: document.getElementById('campoCatTiempo').value,
    proveedorId: document.getElementById('campoCatProveedor').value || null,
    visible: document.getElementById('campoCatVisible').checked,
    foto: fotoCatalogoDataUrl,
  });

  ocultarModal('modalCatalogo');
  refrescarCatalogo(document.getElementById('buscarCatalogo').value);
});

document.getElementById('btnEliminarCatalogo').addEventListener('click', async () => {
  if (!catalogoEditando) return;
  if (!confirm('¿Quitar esta planta del catálogo? Los pedidos que ya la tienen conservan su información.')) return;
  await Catalogo.eliminarItemCatalogo(catalogoEditando.id);
  ocultarModal('modalCatalogo');
  refrescarCatalogo(document.getElementById('buscarCatalogo').value);
});

// =========================================================
// PEDIDOS (encargos de clientes)
// =========================================================

function claseEstadoPedido(estado) {
  return {
    'Solicitado': 'estado-solicitado',
    'Pedido al proveedor': 'estado-pedido',
    'Llegó': 'estado-llego',
    'Cliente avisado': 'estado-avisado',
    'Entregado': 'estado-entregado',
    'Cancelado': 'estado-cancelado',
  }[estado] || 'estado-solicitado';
}

function fechaCorta(iso) {
  // 'YYYY-MM-DD' sin zona horaria: se arma local para que no se corra un día.
  if (!iso) return '';
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d).toLocaleDateString();
}

async function refrescarPedidos() {
  const contenedor = document.getElementById('listaPedidos');
  const filtro = document.getElementById('filtroPedidos').value;
  const todos = await Pedidos.listarPedidos();

  const activos = todos.filter(Pedidos.esPedidoActivo);
  document.getElementById('resumenPedidosActivos').textContent = String(activos.length);
  document.getElementById('resumenPedidosSaldo').textContent =
    'L. ' + activos.reduce((s, p) => s + Pedidos.saldoPedido(p), 0).toFixed(2);

  let lista = todos;
  if (filtro === 'activos') lista = activos;
  else if (filtro !== 'todos') lista = todos.filter((p) => p.estado === filtro);

  if (lista.length === 0) {
    contenedor.innerHTML = '<div class="vacio">No hay pedidos en esta lista. Toca "+" para registrar uno.</div>';
    return;
  }

  contenedor.innerHTML = lista.map((p) => `
    <div class="card" data-id="${p.id}">
      <div class="info">
        <span class="chip ${claseEstadoPedido(p.estado)}">${escaparHtml(p.estado)}</span>
        <h3>${escaparHtml(p.nombreProducto)} &times;${p.cantidad}</h3>
        <p>${escaparHtml(p.nombreCliente || 'Cliente')}${p.celularCliente ? ' &middot; ' + escaparHtml(p.celularCliente) : ''}</p>
        ${p.fechaEstimada ? `<p style="font-size:12px;color:#888;">Entrega estimada: ${fechaCorta(p.fechaEstimada)}</p>` : ''}
        <p class="precio">Total: L. ${Pedidos.totalPedido(p).toFixed(2)} &middot; Adelanto: L. ${(p.adelanto || 0).toFixed(2)}</p>
        <p style="font-size:12px;color:#888;">Saldo: L. ${Pedidos.saldoPedido(p).toFixed(2)}</p>
      </div>
    </div>
  `).join('');

  contenedor.querySelectorAll('.card').forEach((card) => {
    card.addEventListener('click', async () => {
      const pedidos = await Pedidos.listarPedidos();
      const pedido = pedidos.find((x) => x.id === card.dataset.id);
      if (pedido) abrirModalPedido(pedido);
    });
  });
}

document.getElementById('filtroPedidos').addEventListener('change', refrescarPedidos);

const VALOR_OTRA_PLANTA = '__otra__';

function actualizarResumenPedidoModal() {
  const cantidad = Math.max(1, parseInt(document.getElementById('campoPedidoCantidad').value, 10) || 1);
  const precio = parseFloat(document.getElementById('campoPedidoPrecio').value) || 0;
  const adelanto = parseFloat(document.getElementById('campoPedidoAdelanto').value) || 0;
  const total = cantidad * precio;
  document.getElementById('pedidoTotal').textContent = 'L. ' + total.toFixed(2);
  document.getElementById('pedidoSaldo').textContent = 'L. ' + Math.max(0, total - adelanto).toFixed(2);
}

function actualizarVisibilidadOtraPlanta() {
  const esOtra = document.getElementById('campoPedidoProducto').value === VALOR_OTRA_PLANTA;
  document.getElementById('filaPedidoOtro').style.display = esOtra ? 'block' : 'none';
}

['campoPedidoCantidad', 'campoPedidoPrecio', 'campoPedidoAdelanto'].forEach((id) => {
  document.getElementById(id).addEventListener('input', actualizarResumenPedidoModal);
});

// Al elegir una planta del catálogo se sugiere su precio (editable).
document.getElementById('campoPedidoProducto').addEventListener('change', () => {
  actualizarVisibilidadOtraPlanta();
  const item = cacheCatalogoPedidos.find((c) => c.id === document.getElementById('campoPedidoProducto').value);
  if (item) {
    document.getElementById('campoPedidoPrecio').value = item.precio ?? '';
    actualizarResumenPedidoModal();
  }
});

async function abrirModalPedido(pedido = null) {
  pedidoEditando = pedido;
  document.getElementById('tituloModalPedido').textContent = pedido ? 'Editar pedido' : 'Nuevo pedido';

  cacheCatalogoPedidos = await Catalogo.listarCatalogo();
  const selectProducto = document.getElementById('campoPedidoProducto');
  selectProducto.innerHTML =
    cacheCatalogoPedidos.map((c) => `<option value="${c.id}">${escaparHtml(c.nombre)}</option>`).join('') +
    `<option value="${VALOR_OTRA_PLANTA}">Otra planta (escribir nombre)...</option>`;

  const clientes = await Clientes.listarClientes();
  const selectCliente = document.getElementById('campoPedidoCliente');
  selectCliente.innerHTML = '<option value="">Selecciona un cliente...</option>' +
    clientes.map((c) => `<option value="${c.id}">${escaparHtml(c.nombre)}${c.celular ? ' - ' + escaparHtml(c.celular) : ''}</option>`).join('');

  // "Entregado" solo se asigna con el botón que también registra la venta.
  const estadosElegibles = Pedidos.ESTADOS_PEDIDO.filter(
    (e) => e !== 'Entregado' || pedido?.estado === 'Entregado'
  );
  llenarSelect(document.getElementById('campoPedidoEstado'), estadosElegibles);

  if (pedido) {
    const enCatalogo = pedido.catalogoId && cacheCatalogoPedidos.some((c) => c.id === pedido.catalogoId);
    selectProducto.value = enCatalogo ? pedido.catalogoId : VALOR_OTRA_PLANTA;
    document.getElementById('campoPedidoOtroNombre').value = enCatalogo ? '' : pedido.nombreProducto;
    selectCliente.value = pedido.clienteId || '';
    document.getElementById('campoPedidoCantidad').value = pedido.cantidad;
    document.getElementById('campoPedidoPrecio').value = pedido.precioUnitario;
    document.getElementById('campoPedidoCosto').value = pedido.costoUnitario || '';
    document.getElementById('campoPedidoAdelanto').value = pedido.adelanto || '';
    document.getElementById('campoPedidoFecha').value = pedido.fechaEstimada || '';
    document.getElementById('campoPedidoEstado').value = pedido.estado;
    document.getElementById('campoPedidoNotas').value = pedido.notas || '';
  } else {
    const primero = cacheCatalogoPedidos[0];
    selectProducto.value = primero ? primero.id : VALOR_OTRA_PLANTA;
    document.getElementById('campoPedidoOtroNombre').value = '';
    selectCliente.value = '';
    document.getElementById('campoPedidoCantidad').value = 1;
    document.getElementById('campoPedidoPrecio').value = primero ? (primero.precio ?? '') : '';
    document.getElementById('campoPedidoCosto').value = '';
    document.getElementById('campoPedidoAdelanto').value = '';
    document.getElementById('campoPedidoFecha').value = '';
    document.getElementById('campoPedidoEstado').value = 'Solicitado';
    document.getElementById('campoPedidoNotas').value = '';
  }

  actualizarVisibilidadOtraPlanta();
  actualizarResumenPedidoModal();

  const puedeEntregar = pedido && Pedidos.esPedidoActivo(pedido);
  document.getElementById('filaEntregarPedido').style.display = puedeEntregar ? 'flex' : 'none';
  document.getElementById('filaEliminarPedido').style.display = pedido ? 'flex' : 'none';
  mostrarModal('modalPedido');
}

// Lee el formulario y lo convierte en los datos del pedido (o avisa qué falta).
async function leerFormularioPedido() {
  const valorProducto = document.getElementById('campoPedidoProducto').value;
  const item = cacheCatalogoPedidos.find((c) => c.id === valorProducto);
  const nombreProducto = item ? item.nombre : document.getElementById('campoPedidoOtroNombre').value.trim();
  if (!nombreProducto) { alert('Escribe el nombre de la planta.'); return null; }

  const clienteId = document.getElementById('campoPedidoCliente').value;
  if (!clienteId) { alert('Selecciona un cliente (si es nuevo, agrégalo primero en Clientes).'); return null; }
  const clientes = await Clientes.listarClientes();
  const cliente = clientes.find((c) => c.id === clienteId);

  return {
    id: pedidoEditando?.id || null,
    creadoEl: pedidoEditando?.creadoEl || null,
    ventaId: pedidoEditando?.ventaId || null,
    entregadoEl: pedidoEditando?.entregadoEl || null,
    catalogoId: item ? item.id : null,
    proveedorId: item ? (item.proveedorId || null) : (pedidoEditando?.proveedorId || null),
    nombreProducto,
    clienteId,
    nombreCliente: cliente ? cliente.nombre : (pedidoEditando?.nombreCliente || ''),
    celularCliente: cliente ? (cliente.celular || '') : (pedidoEditando?.celularCliente || ''),
    cantidad: document.getElementById('campoPedidoCantidad').value,
    precioUnitario: document.getElementById('campoPedidoPrecio').value,
    costoUnitario: document.getElementById('campoPedidoCosto').value,
    adelanto: document.getElementById('campoPedidoAdelanto').value,
    fechaEstimada: document.getElementById('campoPedidoFecha').value,
    estado: document.getElementById('campoPedidoEstado').value,
    notas: document.getElementById('campoPedidoNotas').value,
  };
}

document.getElementById('btnCancelarPedido').addEventListener('click', () => ocultarModal('modalPedido'));

document.getElementById('btnGuardarPedido').addEventListener('click', async () => {
  const datos = await leerFormularioPedido();
  if (!datos) return;
  await Pedidos.guardarPedido(datos);
  ocultarModal('modalPedido');
  refrescarPedidos();
});

document.getElementById('btnEntregarPedido').addEventListener('click', async () => {
  const datos = await leerFormularioPedido();
  if (!datos) return;
  if (!(parseFloat(datos.costoUnitario) > 0) &&
      !confirm('No registraste el costo de la planta, así que la ganancia saldría igual al total. ¿Continuar de todas formas?')) return;
  if (!confirm('¿Marcar como entregado y registrar la venta?')) return;

  const guardado = await Pedidos.guardarPedido(datos);
  await Pedidos.entregarPedido(guardado);
  ocultarModal('modalPedido');
  refrescarPedidos();
  refrescarVentas();
});

document.getElementById('btnEliminarPedido').addEventListener('click', async () => {
  if (!pedidoEditando) return;
  if (!confirm('¿Eliminar este pedido? Si ya se entregó, la venta registrada no se borra.')) return;
  await Pedidos.eliminarPedido(pedidoEditando.id);
  ocultarModal('modalPedido');
  refrescarPedidos();
});

// =========================================================
// DATOS DEL NEGOCIO (WhatsApp, cuenta bancaria, enlace del catálogo)
// =========================================================

function enlaceCatalogo() {
  return new URL('catalogo.html', window.location.href).href;
}

async function cargarConfiguracion() {
  document.getElementById('campoEnlaceCatalogo').value = enlaceCatalogo();
  try {
    const n = await Negocio.obtenerNegocio();
    document.getElementById('campoCfgNombre').value = n.nombreNegocio || '';
    document.getElementById('campoCfgWhatsapp').value = n.whatsapp || '';
    document.getElementById('campoCfgAdelanto').value = n.mensajeAdelanto || '';
    document.getElementById('campoCfgBanco').value = n.banco || '';
    document.getElementById('campoCfgTipoCuenta').value = n.tipoCuenta || '';
    document.getElementById('campoCfgCuenta').value = n.numeroCuenta || '';
    document.getElementById('campoCfgTitular').value = n.titularCuenta || '';
    document.getElementById('campoCfgMostrarCuenta').checked = n.mostrarCuenta !== false;
  } catch (err) {
    console.warn('No se pudo leer la configuración del negocio', err);
  }
}

document.getElementById('btnGuardarConfig').addEventListener('click', async () => {
  try {
    await Negocio.guardarNegocio({
      nombreNegocio: document.getElementById('campoCfgNombre').value,
      whatsapp: document.getElementById('campoCfgWhatsapp').value,
      mensajeAdelanto: document.getElementById('campoCfgAdelanto').value,
      banco: document.getElementById('campoCfgBanco').value,
      tipoCuenta: document.getElementById('campoCfgTipoCuenta').value,
      numeroCuenta: document.getElementById('campoCfgCuenta').value,
      titularCuenta: document.getElementById('campoCfgTitular').value,
      mostrarCuenta: document.getElementById('campoCfgMostrarCuenta').checked,
    });
    alert('Datos guardados. El catálogo ya muestra la información nueva.');
  } catch (err) {
    console.error(err);
    alert('No se pudieron guardar los datos. Revisa tu conexión e intenta de nuevo.');
  }
});

async function compartirEnlaceCatalogo() {
  const url = enlaceCatalogo();
  const texto = 'Mira el catálogo de plantas por encargo de Encantos:';
  if (navigator.share) {
    try {
      await navigator.share({ title: 'Catálogo Encantos', text: texto, url });
    } catch (err) {
      if (err.name !== 'AbortError') console.warn(err);
    }
  } else {
    window.open('https://wa.me/?text=' + encodeURIComponent(texto + ' ' + url), '_blank', 'noopener');
  }
}

document.getElementById('btnCompartirEnlace').addEventListener('click', compartirEnlaceCatalogo);
document.getElementById('btnCompartirCatalogo').addEventListener('click', compartirEnlaceCatalogo);

document.getElementById('btnCopiarEnlace').addEventListener('click', async () => {
  const campo = document.getElementById('campoEnlaceCatalogo');
  try {
    await navigator.clipboard.writeText(campo.value);
    alert('Enlace copiado.');
  } catch (err) {
    campo.select();
    alert('Mantén presionado el enlace y elige "Copiar".');
  }
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

document.getElementById('btnGenerarReportePedidos').addEventListener('click', () => Reportes.generarReportePedidosPDF());
document.getElementById('btnCompartirReportePedidos').addEventListener('click', async () => {
  try {
    await Reportes.compartirReportePedidosPDF();
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
  if (!confirm('Esto reemplazará todos los datos actuales con los del respaldo. ¿Continuar?')) return;
  try {
    await Backup.importarRespaldoDesdeArchivo(archivo);
    alert('Respaldo importado correctamente.');
    refrescarInventario();
    refrescarVentas();
    refrescarClientes();
    refrescarProveedores();
    refrescarCatalogo();
    refrescarPedidos();
  } catch (err) {
    alert('No se pudo importar el respaldo: ' + err.message);
  }
});

// =========================================================
// SESIÓN E INICIO
// =========================================================

function mostrarLogin(mensaje) {
  if (mensaje !== undefined) document.getElementById('loginError').textContent = mensaje;
  document.getElementById('pantallaLogin').classList.add('activo');
}

function ocultarLogin() {
  document.getElementById('pantallaLogin').classList.remove('activo');
  document.getElementById('loginClave').value = '';
  document.getElementById('loginError').textContent = '';
}

function mensajeErrorLogin(err) {
  switch (err.code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return 'Correo o contraseña incorrectos.';
    case 'auth/network-request-failed':
      return 'Sin internet. La primera vez que inicias sesión necesitas conexión.';
    case 'auth/too-many-requests':
      return 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.';
    case 'auth/operation-not-allowed':
      return 'El inicio de sesión por correo no está activado en Firebase.';
    default:
      return 'No se pudo iniciar sesión. Intenta de nuevo.';
  }
}

document.getElementById('formLogin').addEventListener('submit', async (e) => {
  e.preventDefault();
  const boton = document.getElementById('btnLogin');
  boton.disabled = true;
  document.getElementById('loginError').textContent = '';
  try {
    await DB.iniciarSesion(
      document.getElementById('loginCorreo').value,
      document.getElementById('loginClave').value
    );
    // El resto lo hace el observador de sesión de abajo.
  } catch (err) {
    document.getElementById('loginError').textContent = mensajeErrorLogin(err);
  } finally {
    boton.disabled = false;
  }
});

document.getElementById('btnCerrarSesion').addEventListener('click', async () => {
  if (!confirm('¿Cerrar sesión en este teléfono?')) return;
  await DB.cerrarSesion();
  window.location.reload();
});

let appIniciada = false;

// Carga los datos y activa la sincronización en tiempo real. Solo se llama
// cuando ya hay una sesión autorizada (antes, las reglas rechazarían todo).
function iniciarApp() {
  if (appIniciada) return;
  appIniciada = true;

  refrescarInventario();

  // Cuando el otro celular agrega, edita o vende algo, la pantalla se actualiza sola.
  DB.escucharCambios(DB.STORES.productos, () => refrescarInventario(document.getElementById('buscarTexto').value));
  DB.escucharCambios(DB.STORES.clientes, () => refrescarClientes(document.getElementById('buscarCliente').value));
  DB.escucharCambios(DB.STORES.ventas, () => refrescarVentas());
  DB.escucharCambios(DB.STORES.proveedores, () => refrescarProveedores(document.getElementById('buscarProveedor').value));
  DB.escucharCambios(DB.STORES.catalogo, () => refrescarCatalogo(document.getElementById('buscarCatalogo').value));
  DB.escucharCambios(DB.STORES.pedidos, () => refrescarPedidos());
}

DB.alCambiarSesion(async (usuario) => {
  // Las sesiones anónimas de versiones anteriores ya no tienen acceso.
  if (usuario && usuario.isAnonymous) {
    await DB.cerrarSesion();
    return;
  }
  if (!usuario) {
    mostrarLogin();
    return;
  }
  const tieneAcceso = await DB.verificarAcceso();
  if (!tieneAcceso) {
    mostrarLogin('Esta cuenta no tiene permiso para usar Encantos. Pídele acceso al dueño.');
    await DB.cerrarSesion();
    return;
  }
  ocultarLogin();
  iniciarApp();
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .then((registro) => registro.update())
      .catch((err) => console.warn('SW no registrado', err));
  });
}
