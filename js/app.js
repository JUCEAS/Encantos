// app.js — Controlador principal: navegación entre pestañas y conexión de la interfaz

let productoEditandoId = null;
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
  document.querySelectorAll('.vista').forEach((v) => v.classList.remove('activa'));
  document.getElementById('vista-' + nombre).classList.add('activa');
  document.querySelectorAll('.tabbar .tab').forEach((b) => b.classList.toggle('activo', b.dataset.vista === nombre));

  document.getElementById('btnAgregar').style.display = (nombre === 'inventario' || nombre === 'clientes' || nombre === 'proveedores') ? 'block' : 'none';

  if (nombre === 'inventario') refrescarInventario();
  if (nombre === 'ventas') refrescarVentas();
  if (nombre === 'clientes') refrescarClientes();
  if (nombre === 'proveedores') refrescarProveedores();
}

// ---------- Botón flotante "+" según la pestaña activa ----------
document.getElementById('btnAgregar').addEventListener('click', () => {
  const vistaActiva = document.querySelector('.vista.activa').id;
  if (vistaActiva === 'vista-inventario') abrirModalProducto();
  if (vistaActiva === 'vista-clientes') abrirModalCliente();
  if (vistaActiva === 'vista-proveedores') abrirModalProveedor();
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
    <div class="card">
      <div class="info">
        <h3>${escaparHtml(v.nombreProducto)} &times;${v.cantidad}</h3>
        <p>${new Date(v.fecha).toLocaleString()}</p>
        <p class="precio">Total: L. ${v.total.toFixed(2)} &middot; Ganancia: L. ${v.ganancia.toFixed(2)}</p>
      </div>
    </div>
  `).join('');
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
  mostrarModal('modalCliente');
}

document.getElementById('btnCancelarCliente').addEventListener('click', () => ocultarModal('modalCliente'));

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
  if (!confirm('Esto reemplazará todos los datos actuales con los del respaldo. ¿Continuar?')) return;
  try {
    await Backup.importarRespaldoDesdeArchivo(archivo);
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
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch((err) => console.warn('SW no registrado', err));
  });
}

refrescarInventario();

// Sincronización en tiempo real: cuando el otro celular agrega, edita o vende
// algo, esta pantalla se actualiza sola (y al revés).
DB.escucharCambios(DB.STORES.productos, () => refrescarInventario(document.getElementById('buscarTexto').value));
DB.escucharCambios(DB.STORES.clientes, () => refrescarClientes(document.getElementById('buscarCliente').value));
DB.escucharCambios(DB.STORES.ventas, () => refrescarVentas());
DB.escucharCambios(DB.STORES.proveedores, () => refrescarProveedores(document.getElementById('buscarProveedor').value));
