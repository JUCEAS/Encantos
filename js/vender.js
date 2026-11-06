// vender.js — App de la vendedora: ver inventario (sin costos), vender varios
// productos en una sola venta, agregar clientes y ver sus propias ventas.
// Las reglas de Firestore solo le permiten bajar existencias, crear ventas a su
// nombre y crear clientes; todo lo demás queda para los dueños.

let productos = [];
let clientes = [];
let misVentas = [];
let carrito = []; // [{ id, nombre, precio, cantidad, stock }]
let clienteVenta = null;
let nombreVendedora = '';

// ---------- Utilidades ----------
function escaparHtml(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function srcFotoSegura(foto) {
  return typeof foto === 'string' && /^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(foto) ? foto : '';
}
function formatoL(n) {
  return 'L. ' + (Number(n) || 0).toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function normalizar(t) {
  return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
function claveDia(f) {
  const d = new Date(f);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function mostrarModal(id) { document.getElementById(id).classList.add('activo'); }
function ocultarModal(id) { document.getElementById(id).classList.remove('activo'); }
function r2(n) { return Math.round((Number(n) || 0) * 100) / 100; }

// ---------- Navegación ----------
document.querySelectorAll('.tabbar .tab').forEach((b) => b.addEventListener('click', () => cambiarVista(b.dataset.vista)));

function cambiarVista(nombre) {
  document.querySelectorAll('.vista').forEach((v) => v.classList.toggle('activa', v.id === 'vista-' + nombre));
  document.querySelectorAll('.tabbar .tab').forEach((b) => b.classList.toggle('activo', b.dataset.vista === nombre));
  pintarBarraCarrito();
  window.scrollTo(0, 0);
  if (nombre === 'clientes') pintarClientes();
  if (nombre === 'misventas') pintarMisVentas();
}

// =========================================================
// INVENTARIO (sin costos)
// =========================================================
function llenarCategorias() {
  const sel = document.getElementById('filtroCategoria');
  const actual = sel.value;
  const cats = [...new Set(productos.map((p) => p.categoria))].sort((a, b) => a.localeCompare(b));
  sel.innerHTML = '<option value="">Todas las categorías</option>' +
    cats.map((c) => { const i = Inventario.infoCategoria(c); return `<option value="${escaparHtml(c)}">${i.emoji} ${escaparHtml(i.nombre)}</option>`; }).join('');
  sel.value = cats.includes(actual) ? actual : '';
}

function enCarrito(id) { return carrito.find((l) => l.id === id); }

function pintarProductos() {
  const q = normalizar(document.getElementById('buscarProducto').value);
  const cat = document.getElementById('filtroCategoria').value;
  const lista = productos.filter((p) =>
    (!cat || p.categoria === cat) &&
    (!q || normalizar(p.nombre).includes(q) || normalizar(p.nombreCientifico).includes(q) || normalizar(p.categoria).includes(q)));
  // Primero los que hay en existencia
  lista.sort((a, b) => ((Number(b.stock) > 0) - (Number(a.stock) > 0)) || (a.nombre || '').localeCompare(b.nombre || ''));
  const caja = document.getElementById('listaProductos');
  if (!lista.length) {
    caja.innerHTML = `<div class="vacio">${productos.length ? 'No hay productos con esa búsqueda.' : 'El inventario está vacío.'}</div>`;
    return;
  }
  caja.innerHTML = lista.map((p) => {
    const stock = Number(p.stock) || 0;
    const ya = enCarrito(p.id);
    const disponible = stock - (ya ? ya.cantidad : 0);
    const foto = srcFotoSegura(p.foto);
    const info = Inventario.infoCategoria(p.categoria);
    return `<div class="card producto-venta ${stock <= 0 ? 'sin-stock' : ''}" data-id="${escaparHtml(p.id)}">
      ${foto ? `<img class="foto-producto" src="${foto}" alt="">` : ''}
      <div class="info">
        <h3>${escaparHtml(p.nombre)}${ya ? ` <span class="chip">🛒 ${ya.cantidad}</span>` : ''}</h3>
        <p>${info.emoji} ${escaparHtml(info.nombre)}</p>
        <p class="existencias">${stock <= 0 ? '<span class="agotado">Agotado</span>' : `Quedan ${disponible}${ya ? ' (sin contar la venta)' : ''}`}</p>
      </div>
      <div class="precio">${formatoL(p.precio)}</div>
    </div>`;
  }).join('');
  caja.querySelectorAll('.producto-venta').forEach((el) => el.addEventListener('click', () => agregarAlCarrito(el.dataset.id)));
}

document.getElementById('buscarProducto').addEventListener('input', pintarProductos);
document.getElementById('filtroCategoria').addEventListener('change', pintarProductos);

// =========================================================
// VENTA (carrito)
// =========================================================
function agregarAlCarrito(id) {
  const p = productos.find((x) => x.id === id);
  if (!p) return;
  const stock = Number(p.stock) || 0;
  if (stock <= 0) { alert(`"${p.nombre}" está agotado.`); return; }
  if (!(Number(p.precio) > 0)) { alert(`"${p.nombre}" no tiene precio de venta. Pídele a la dueña que lo registre.`); return; }
  const linea = enCarrito(id);
  if (linea) {
    if (linea.cantidad >= stock) { alert(`Solo hay ${stock} de "${p.nombre}".`); return; }
    linea.cantidad++;
  } else {
    carrito.push({ id, nombre: p.nombre, precio: Number(p.precio), cantidad: 1 });
  }
  if (navigator.vibrate) navigator.vibrate(20);
  pintarProductos();
  pintarBarraCarrito();
}

function totalCarrito() { return r2(carrito.reduce((s, l) => s + l.precio * l.cantidad, 0)); }

function pintarBarraCarrito() {
  const barra = document.getElementById('barraCarrito');
  const enVender = document.getElementById('vista-vender').classList.contains('activa');
  barra.hidden = !carrito.length || !enVender;
  const unidades = carrito.reduce((s, l) => s + l.cantidad, 0);
  document.getElementById('resumenCarrito').textContent = `${unidades} producto${unidades === 1 ? '' : 's'} · ${formatoL(totalCarrito())}`;
  document.body.style.paddingBottom = barra.hidden ? '' : '130px';
}

function pintarLineasCarrito() {
  const caja = document.getElementById('lineasCarrito');
  caja.innerHTML = carrito.map((l, i) => `
    <div class="linea-carrito">
      <div class="nombre">${escaparHtml(l.nombre)}<small>${formatoL(l.precio)} c/u · ${formatoL(l.precio * l.cantidad)}</small></div>
      <div class="cant">
        <button type="button" data-menos="${i}" aria-label="Quitar uno">−</button>
        <span>${l.cantidad}</span>
        <button type="button" data-mas="${i}" aria-label="Agregar uno">+</button>
      </div>
    </div>`).join('');
  document.getElementById('totalCarrito').textContent = formatoL(totalCarrito());
  caja.querySelectorAll('[data-menos]').forEach((b) => b.addEventListener('click', () => {
    const l = carrito[Number(b.dataset.menos)];
    l.cantidad--;
    if (l.cantidad <= 0) carrito.splice(Number(b.dataset.menos), 1);
    if (!carrito.length) { ocultarModal('modalCobrar'); }
    pintarLineasCarrito(); pintarProductos(); pintarBarraCarrito();
  }));
  caja.querySelectorAll('[data-mas]').forEach((b) => b.addEventListener('click', () => {
    const l = carrito[Number(b.dataset.mas)];
    const p = productos.find((x) => x.id === l.id);
    if (p && l.cantidad >= (Number(p.stock) || 0)) { alert(`Solo hay ${p.stock} de "${l.nombre}".`); return; }
    l.cantidad++;
    pintarLineasCarrito(); pintarProductos(); pintarBarraCarrito();
  }));
}

function pintarClienteElegido() {
  const caja = document.getElementById('clienteElegido');
  const buscar = document.getElementById('cajaBuscarClienteVenta');
  if (clienteVenta) {
    caja.innerHTML = `<div class="cliente-elegido"><span>👤 ${escaparHtml(clienteVenta.nombre)}${clienteVenta.celular ? ' · ' + escaparHtml(clienteVenta.celular) : ''}</span><button type="button" id="btnQuitarCliente">Cambiar</button></div>`;
    document.getElementById('btnQuitarCliente').addEventListener('click', () => { clienteVenta = null; pintarClienteElegido(); });
    buscar.style.display = 'none';
  } else {
    caja.innerHTML = '';
    buscar.style.display = '';
    document.getElementById('buscarClienteVenta').value = '';
    document.getElementById('sugerenciasCliente').innerHTML = '';
  }
}

function buscarClientesTexto(texto) {
  const q = normalizar(texto);
  const digitos = String(texto || '').replace(/\D/g, '');
  if (!q) return [];
  return clientes.filter((c) => normalizar(c.nombre).includes(q) || (digitos.length >= 3 && String(c.celular || '').replace(/\D/g, '').includes(digitos)));
}

document.getElementById('buscarClienteVenta').addEventListener('input', (e) => {
  const res = buscarClientesTexto(e.target.value).slice(0, 5);
  const caja = document.getElementById('sugerenciasCliente');
  caja.innerHTML = res.map((c) => `<div class="card" data-cliente="${escaparHtml(c.id)}"><div class="info"><h3>${escaparHtml(c.nombre)}</h3><p>${escaparHtml(c.celular || 'Sin celular')}</p></div></div>`).join('');
  caja.querySelectorAll('[data-cliente]').forEach((el) => el.addEventListener('click', () => {
    clienteVenta = clientes.find((c) => c.id === el.dataset.cliente) || null;
    pintarClienteElegido();
  }));
});

document.getElementById('btnCobrar').addEventListener('click', () => {
  if (!carrito.length) return;
  document.getElementById('errorCobrar').textContent = '';
  pintarLineasCarrito();
  pintarClienteElegido();
  mostrarModal('modalCobrar');
});
document.getElementById('btnCancelarCobro').addEventListener('click', () => ocultarModal('modalCobrar'));
document.getElementById('btnVaciarCarrito').addEventListener('click', () => {
  if (!confirm('¿Vaciar la venta?')) return;
  carrito = []; clienteVenta = null;
  ocultarModal('modalCobrar'); pintarProductos(); pintarBarraCarrito();
});
document.getElementById('btnClienteNuevoVenta').addEventListener('click', () => abrirModalCliente(true));

// Guarda un producto vendido. Con internet: en una sola operación revisa las
// existencias reales, las descuenta y guarda la venta. Sin internet: se guarda
// en el teléfono y se sincroniza sola al volver la señal.
async function venderLinea(linea, grupoVenta, clienteId) {
  const p = productos.find((x) => x.id === linea.id);
  if (!p) throw new Error(`"${linea.nombre}" ya no existe en el inventario.`);
  const costoUnitario = Number(p.costo) || 0;
  const venta = {
    productoId: p.id,
    nombreProducto: p.nombre,
    clienteId: clienteId || null,
    cantidad: linea.cantidad,
    precioUnitario: linea.precio,
    costoUnitario,
    total: r2(linea.precio * linea.cantidad),
    ganancia: r2((linea.precio - costoUnitario) * linea.cantidad),
    fecha: new Date().toISOString(),
    vendidaPor: DB.correoActual(),
    grupoVenta,
  };
  if (navigator.onLine) {
    try {
      await DB.venderEnTransaccion(p.id, linea.cantidad, venta);
      actualizarCatalogo(p.id, (Number(p.stock) || 0) - linea.cantidad);
      return;
    } catch (err) {
      if (err.code === 'sin-stock') {
        throw new Error(err.stock <= 0 ? `"${p.nombre}" se acaba de agotar.` : `De "${p.nombre}" solo quedan ${err.stock}.`);
      }
      if (err.code === 'no-existe') throw new Error(`"${p.nombre}" ya no existe en el inventario.`);
      if (!DB.esErrorDeConexion(err)) throw new Error(DB.mensajeDeError(err));
    }
  }
  // Sin conexión: no se espera la respuesta de la nube (llega al volver la señal)
  DB.agregar(DB.STORES.ventas, venta).catch((e) => console.warn('Venta pendiente', e));
  DB.incrementarCampo(DB.STORES.productos, p.id, 'stock', -linea.cantidad).catch((e) => console.warn('Stock pendiente', e));
}

// Mantiene al día "Disponible / Últimas unidades / Agotado" del catálogo público
function actualizarCatalogo(id, stock) {
  const disponibilidad = stock <= 0 ? 'agotado' : stock <= 2 ? 'ultimas' : 'disponible';
  DB.obtener(DB.STORES.catalogo, id).then((ficha) => {
    if (ficha && ficha.disponibilidad !== disponibilidad) {
      return DB.actualizarCampos(DB.STORES.catalogo, id, { disponibilidad, actualizadoEl: new Date().toISOString() });
    }
  }).catch((e) => console.warn('Catálogo no actualizado', e));
}

document.getElementById('btnConfirmarVenta').addEventListener('click', async () => {
  const boton = document.getElementById('btnConfirmarVenta');
  const error = document.getElementById('errorCobrar');
  if (!carrito.length) return;
  boton.disabled = true;
  error.textContent = '';
  const grupoVenta = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const total = totalCarrito();
  const vendidas = [];
  const fallidas = [];
  for (const linea of [...carrito]) {
    try {
      await venderLinea(linea, grupoVenta, clienteVenta && clienteVenta.id);
      vendidas.push(linea);
    } catch (err) {
      fallidas.push({ linea, mensaje: err.message });
    }
  }
  boton.disabled = false;
  carrito = carrito.filter((l) => !vendidas.includes(l));
  pintarProductos();
  pintarBarraCarrito();
  if (!fallidas.length) {
    ocultarModal('modalCobrar');
    clienteVenta = null;
    alert(`✅ Venta registrada: ${formatoL(total)}` + (navigator.onLine ? '' : '\n\nSin internet: se enviará sola cuando vuelva la señal.'));
  } else {
    pintarLineasCarrito();
    error.textContent = (vendidas.length ? `Se vendió ${vendidas.length} producto(s). ` : '') +
      'No se pudo vender: ' + fallidas.map((f) => f.mensaje).join(' ');
  }
});

// =========================================================
// MIS VENTAS
// =========================================================
function pintarMisVentas() {
  const hoy = claveDia(new Date());
  const mes = hoy.slice(0, 7);
  const validas = misVentas.filter((v) => !v.anulada && !v.corregida);
  document.getElementById('totalHoy').textContent = formatoL(validas.filter((v) => claveDia(v.fecha) === hoy).reduce((s, v) => s + (Number(v.total) || 0), 0));
  document.getElementById('totalMes').textContent = formatoL(validas.filter((v) => claveDia(v.fecha).startsWith(mes)).reduce((s, v) => s + (Number(v.total) || 0), 0));
  const caja = document.getElementById('listaMisVentas');
  const lista = [...misVentas].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).slice(0, 150);
  if (!lista.length) { caja.innerHTML = '<div class="vacio">Todavía no has registrado ventas.</div>'; return; }
  const nombreCliente = (id) => { const c = clientes.find((x) => x.id === id); return c ? c.nombre : 'Cliente general'; };
  caja.innerHTML = lista.map((v) => {
    const fecha = new Date(v.fecha).toLocaleString('es-HN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
    const estado = v.anulada ? ' <span class="chip anulada">Anulada</span>' : v.corregida ? ' <span class="chip anulada">Corregida</span>' : '';
    return `<div class="card ${v.anulada || v.corregida ? 'venta-anulada' : ''}">
      <div class="info">
        <h3>${escaparHtml(v.nombreProducto)} × ${Number(v.cantidad) || 0}${estado}</h3>
        <p>${fecha} · ${escaparHtml(nombreCliente(v.clienteId))}</p>
      </div>
      <div class="precio">${formatoL(v.total)}</div>
    </div>`;
  }).join('');
}

// =========================================================
// CLIENTES
// =========================================================
function pintarClientes() {
  const texto = document.getElementById('buscarCliente').value;
  const lista = (texto ? buscarClientesTexto(texto) : [...clientes]).sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
  const caja = document.getElementById('listaClientes');
  if (!lista.length) { caja.innerHTML = `<div class="vacio">${clientes.length ? 'No se encontró ese cliente.' : 'Aún no hay clientes.'}</div>`; return; }
  caja.innerHTML = lista.slice(0, 200).map((c) => `<div class="card"><div class="info">
    <h3>${escaparHtml(c.nombre)}</h3>
    <p>${escaparHtml(c.celular || 'Sin celular')}${c.municipio ? ' · ' + escaparHtml(c.municipio) : ''}</p>
  </div></div>`).join('');
}
document.getElementById('buscarCliente').addEventListener('input', pintarClientes);
document.getElementById('btnNuevoCliente').addEventListener('click', () => abrirModalCliente(false));

let clienteDesdeVenta = false;
function abrirModalCliente(desdeVenta) {
  clienteDesdeVenta = desdeVenta;
  document.getElementById('campoNombreCliente').value = desdeVenta ? document.getElementById('buscarClienteVenta').value.replace(/[0-9-]/g, '').trim() : '';
  document.getElementById('campoCelularCliente').value = '';
  document.getElementById('campoNotasCliente').value = '';
  document.getElementById('errorCliente').textContent = '';
  const selDep = document.getElementById('campoDepartamento');
  selDep.innerHTML = '<option value="">Departamento...</option>' +
    Object.keys(Clientes.DEPARTAMENTOS_HN).map((d) => `<option>${escaparHtml(d)}</option>`).join('');
  let ultimo = {};
  try { ultimo = JSON.parse(localStorage.getItem('encantos-ultima-ubicacion') || '{}') || {}; } catch (e) { ultimo = {}; }
  selDep.value = ultimo.departamento || '';
  llenarMunicipios(ultimo.municipio || '');
  if (desdeVenta) ocultarModal('modalCobrar');
  mostrarModal('modalCliente');
  setTimeout(() => document.getElementById('campoNombreCliente').focus(), 50);
}

function llenarMunicipios(elegido = '') {
  const dep = document.getElementById('campoDepartamento').value;
  const sel = document.getElementById('campoMunicipio');
  const lista = Clientes.municipiosDe(dep);
  sel.innerHTML = `<option value="">${dep ? 'Municipio...' : '← Elige departamento'}</option>` + lista.map((m) => `<option>${escaparHtml(m)}</option>`).join('');
  sel.disabled = !dep;
  sel.value = lista.includes(elegido) ? elegido : '';
}
document.getElementById('campoDepartamento').addEventListener('change', () => llenarMunicipios());

function cerrarModalCliente() {
  ocultarModal('modalCliente');
  if (clienteDesdeVenta) { pintarClienteElegido(); mostrarModal('modalCobrar'); }
}
document.getElementById('btnCancelarCliente').addEventListener('click', cerrarModalCliente);

document.getElementById('btnGuardarCliente').addEventListener('click', async () => {
  const error = document.getElementById('errorCliente');
  const nombre = document.getElementById('campoNombreCliente').value.trim();
  const celular = document.getElementById('campoCelularCliente').value.trim();
  if (!nombre) { error.textContent = 'Escribe el nombre del cliente.'; return; }
  const digitos = celular.replace(/\D/g, '');
  if (digitos.length >= 8) {
    const repetido = clientes.find((c) => String(c.celular || '').replace(/\D/g, '').endsWith(digitos.slice(-8)));
    if (repetido && !confirm(`Ya existe un cliente con ese celular: ${repetido.nombre}. ¿Guardar de todos modos?`)) {
      if (clienteDesdeVenta) { clienteVenta = repetido; }
      cerrarModalCliente();
      return;
    }
  }
  const departamento = document.getElementById('campoDepartamento').value;
  const municipio = document.getElementById('campoMunicipio').value;
  try { localStorage.setItem('encantos-ultima-ubicacion', JSON.stringify({ departamento, municipio })); } catch (e) { /* sin almacenamiento */ }
  const boton = document.getElementById('btnGuardarCliente');
  boton.disabled = true;
  try {
    const promesa = Clientes.guardarCliente({ nombre, celular, departamento, municipio, notas: document.getElementById('campoNotasCliente').value });
    let id = null;
    if (navigator.onLine) id = await promesa; else promesa.catch((e) => console.warn('Cliente pendiente', e));
    if (clienteDesdeVenta) clienteVenta = { id, nombre, celular };
    cerrarModalCliente();
    pintarClientes();
  } catch (err) {
    error.textContent = DB.mensajeDeError(err);
  } finally {
    boton.disabled = false;
  }
});

// =========================================================
// SESIÓN E INICIO
// =========================================================
const pantallaAcceso = document.getElementById('pantallaAcceso');
const formLogin = document.getElementById('formLogin');
const btnEntrarGoogle = document.getElementById('btnEntrarGoogle');
const btnSesion = document.getElementById('btnSesion');

function mensajeErrorLogin(err) {
  switch (err && err.code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-login-credentials':
      return 'Correo o contraseña incorrectos.';
    case 'auth/too-many-requests':
      return 'Demasiados intentos. Espera unos minutos.';
    case 'auth/network-request-failed':
      return 'Sin internet. La primera vez necesitas conexión.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return '';
    default:
      return 'No se pudo iniciar sesión (' + ((err && (err.code || err.message)) || '') + ').';
  }
}

DB.alCambiarSesion((user, estado, correo) => {
  if (user) {
    pantallaAcceso.classList.add('oculta');
    btnSesion.style.display = 'block';
    btnSesion.textContent = (user.displayName || user.email || 'Sesión').split(/[ @]/)[0] + ' · Salir';
    return;
  }
  pantallaAcceso.classList.remove('oculta');
  btnSesion.style.display = 'none';
  formLogin.style.display = 'block';
  btnEntrarGoogle.style.display = 'block';
  document.getElementById('notaLogin').style.display = 'block';
  document.getElementById('mensajeAcceso').textContent = estado === 'no-autorizado'
    ? 'La cuenta ' + correo + ' no tiene acceso o fue desactivada. Pídele acceso a la dueña.'
    : 'Inicia sesión para vender.';
});

formLogin.addEventListener('submit', async (e) => {
  e.preventDefault();
  const boton = document.getElementById('btnLogin');
  const error = document.getElementById('loginError');
  boton.disabled = true;
  error.textContent = '';
  try {
    await DB.iniciarSesion(document.getElementById('loginCorreo').value, document.getElementById('loginClave').value);
  } catch (err) {
    error.textContent = mensajeErrorLogin(err);
  } finally {
    boton.disabled = false;
  }
});

btnEntrarGoogle.addEventListener('click', async () => {
  if (!navigator.onLine) { alert('Para iniciar sesión la primera vez necesitas internet.'); return; }
  try { await DB.iniciarSesionGoogle(); } catch (err) { document.getElementById('loginError').textContent = mensajeErrorLogin(err); }
});

btnSesion.addEventListener('click', () => {
  if (carrito.length && !confirm('Tienes una venta sin confirmar. ¿Cerrar sesión de todos modos?')) return;
  if (confirm('¿Cerrar sesión en este celular? Necesitarás internet para volver a entrar.')) DB.cerrarSesion();
});

DB.authReady.then(async () => {
  const correo = DB.correoActual();
  // Nombre de la vendedora y del negocio (pensado para usar la app con otras marcas)
  DB.obtener(DB.STORES.usuarios, correo).then((u) => {
    nombreVendedora = (u && u.nombre) || correo.split('@')[0];
    document.getElementById('saludo').textContent = `Hola, ${nombreVendedora} 👋`;
  }).catch(() => {});
  DB.obtenerDocumento(DB.COLECCION_CONFIG, DB.DOC_NEGOCIO).then((n) => {
    if (n && n.nombreNegocio) {
      document.getElementById('tituloNegocio').textContent = '🌿 ' + n.nombreNegocio + ' · Ventas';
      document.title = n.nombreNegocio + ' · Ventas';
    }
  }).catch(() => {});

  DB.escucharCambios(DB.STORES.productos, (docs) => {
    productos = docs.map((p) => ({ ...p, categoria: Inventario.normalizarCategoria(p.categoria) }));
    // Si alguien vendió mientras tanto, el carrito no puede pasar de lo que queda
    carrito.forEach((l) => { const p = productos.find((x) => x.id === l.id); if (p) l.cantidad = Math.min(l.cantidad, Math.max(0, Number(p.stock) || 0)); });
    carrito = carrito.filter((l) => l.cantidad > 0);
    llenarCategorias();
    pintarProductos();
    pintarBarraCarrito();
  });
  DB.escucharCambios(DB.STORES.clientes, (docs) => {
    clientes = docs;
    if (document.getElementById('vista-clientes').classList.contains('activa')) pintarClientes();
  });
  DB.escucharDonde(DB.STORES.ventas, 'vendidaPor', correo, (docs) => {
    misVentas = docs;
    if (document.getElementById('vista-misventas').classList.contains('activa')) pintarMisVentas();
  });
});

window.addEventListener('beforeunload', (e) => {
  if (carrito.length) { e.preventDefault(); e.returnValue = ''; }
});
