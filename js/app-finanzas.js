// app-finanzas.js — Pantallas de dueños: Estado financiero, Gastos y Usuarios.
// Usa las utilidades de app.js (formatoL, escaparHtml, elegirAccion, selector de mes...).

let mesFinanzas = MES_ACTUAL();
let mesGastos = MES_ACTUAL();
let usuarioEditando = null;

// Nombres para mostrar quién vendió: usuarios agregados + vendedoras del catálogo
const nombresPersonas = {};
function nombrePersona(correo) {
  const c = String(correo || '').toLowerCase();
  return nombresPersonas[c] || c.split('@')[0];
}
async function cargarNombresPersonas() {
  try {
    const config = await Catalogo.obtenerConfig();
    (config.vendedores || []).forEach((v) => { if (v.correo && v.nombre) nombresPersonas[v.correo.toLowerCase()] = v.nombre; });
  } catch (e) { /* sin datos del catálogo */ }
  try {
    (await Usuarios.listarUsuarios()).forEach((u) => { if (u.nombre) nombresPersonas[u.id] = u.nombre; });
  } catch (e) { /* sin permiso o sin internet */ }
}
DB.authReady.then(() => cargarNombresPersonas().then(() => {
  if (document.getElementById('vista-ventas').classList.contains('activa')) refrescarVentas();
}));

// =========================================================
// ESTADO FINANCIERO
// =========================================================
function filaER(texto, valor, clase = '') {
  return `<div class="er-fila ${clase}"><span>${texto}</span><b>${formatoL(valor)}</b></div>`;
}

function fechaCorta(clave) {
  const [a, m, d] = clave.split('-').map(Number);
  return new Date(a, m - 1, d).toLocaleDateString('es-HN', { weekday: 'short', day: 'numeric' });
}

async function refrescarFinanzas() {
  pintarSelectorMes('selectorMesFinanzas', mesFinanzas);
  const caja = document.getElementById('contenidoFinanzas');
  caja.innerHTML = '<div class="cargando">Calculando...</div>';
  let e;
  try {
    e = await Finanzas.estadoDelMes(mesFinanzas);
  } catch (err) {
    console.error(err);
    caja.innerHTML = '<div class="vacio">No se pudo calcular el estado financiero. Revisa tu conexión e intenta de nuevo.</div>';
    return;
  }
  const signo = (n) => (n < 0 ? 'negativo' : 'positivo');
  const avisos = [];
  if (e.ventasSinCosto) avisos.push(`⚠️ ${e.ventasSinCosto} venta${e.ventasSinCosto === 1 ? '' : 's'} de productos sin costo registrado: la utilidad sale más alta de lo real.`);

  const gastosHtml = e.gastosPorCategoria.length
    ? e.gastosPorCategoria.map((c) => `<div class="er-fila sub"><span>${c.emoji} ${escaparHtml(c.texto)}</span><b>${formatoL(c.total)}</b></div>`).join('')
    : '<div class="er-fila sub"><span>Sin gastos registrados</span><b>L. 0.00</b></div>';

  const diasHtml = e.porDia.length
    ? `<table class="tabla-dias"><thead><tr><th>Día</th><th>Ventas</th><th>Gastos</th><th>Utilidad</th><th>Acumulado</th></tr></thead><tbody>${
      e.porDia.map((d) => `<tr><td>${fechaCorta(d.fecha)}</td><td>${formatoL(d.ventas)}</td><td>${d.gastos ? formatoL(d.gastos) : '—'}</td><td class="${signo(d.utilidadNeta)}">${formatoL(d.utilidadNeta)}</td><td class="${signo(d.acumulado)}"><b>${formatoL(d.acumulado)}</b></td></tr>`).join('')
    }</tbody></table>`
    : '<div class="vacio">Todavía no hay movimientos en este mes.</div>';

  const personasHtml = e.ventasPorPersona.length
    ? e.ventasPorPersona.map((p) => `<div class="er-fila sub"><span>${escaparHtml(p.nombre)} <small>(${p.ventas} venta${p.ventas === 1 ? '' : 's'})</small></span><b>${formatoL(p.total)}</b></div>`).join('')
    : '<div class="er-fila sub"><span>Sin ventas</span><b>L. 0.00</b></div>';

  caja.innerHTML = `
    <div class="resumen-grid">
      <div class="card"><div><div class="valor ${e.utilidadNeta < 0 ? 'margen-bajo' : ''}">${formatoL(e.utilidadNeta)}</div><div class="etiqueta">Utilidad neta del mes</div></div></div>
      <div class="card"><div><div class="valor">${pct(e.margenNeto)}</div><div class="etiqueta">De cada L.100 vendidos, quedan</div></div></div>
    </div>

    <div class="card er">
      <h3>📊 Estado de resultados</h3>
      ${filaER('Ventas (' + e.numeroVentas + ')', e.totalVentas)}
      ${filaER('− Costo de lo vendido', e.costoVendido, 'resta')}
      ${filaER('= Utilidad bruta', e.utilidadBruta, 'total')}
      ${filaER('− Gastos del negocio', e.totalGastos, 'resta')}
      ${gastosHtml}
      ${filaER('= Utilidad neta', e.utilidadNeta, 'total grande ' + signo(e.utilidadNeta))}
      ${avisos.map((a) => `<p class="aviso-er">${a}</p>`).join('')}
    </div>

    <div class="card er">
      <h3>💵 Dinero que entró y salió</h3>
      ${filaER('Entró por ventas', e.totalVentas)}
      ${filaER('− Salió en compras de mercadería', e.totalCompras, 'resta')}
      ${filaER('− Salió en gastos', e.totalGastos, 'resta')}
      ${filaER('= Saldo del mes', e.flujo, 'total ' + signo(e.flujo))}
      <p class="nota-margen" style="margin:8px 0 0">${e.flujo < e.utilidadNeta
        ? 'El saldo es menor que la utilidad porque parte del dinero se invirtió en mercadería que todavía está en el inventario.'
        : 'El saldo es mayor que la utilidad porque se vendió inventario que se había comprado antes.'}</p>
    </div>

    <div class="card er">
      <h3>🌱 Inventario hoy</h3>
      ${filaER('Valor a costo', e.valorInventarioCosto)}
      ${filaER('Valor a precio de venta', e.valorInventarioVenta)}
      ${e.productosSinCosto ? `<p class="aviso-er">⚠️ ${e.productosSinCosto} producto${e.productosSinCosto === 1 ? '' : 's'} con existencias pero sin costo registrado.</p>` : ''}
    </div>

    <div class="card er">
      <h3>🧑‍💼 Ventas por persona</h3>
      ${personasHtml}
    </div>

    <div class="card er">
      <h3>📅 Día a día (se reinicia cada mes)</h3>
      ${diasHtml}
    </div>`;
}

async function construirPDFEstadoFinanciero({ mes }) {
  const e = await Finanzas.estadoDelMes(mes);
  const doc = nuevoDocPDF('Estado financiero');
  const L = (n) => formatoLempiras(Number(n) || 0);
  let y = 34;
  const nueva = (lim = 275) => { if (y > lim) { doc.addPage(); y = 18; } };
  const linea = (texto, valor, negrita = false, x = 14) => {
    nueva();
    doc.setFont(undefined, negrita ? 'bold' : 'normal');
    doc.text(texto, x, y);
    if (valor !== undefined) doc.text(L(valor), 196, y, { align: 'right' });
    y += 7;
  };
  const titulo = (t) => { y += 3; nueva(260); doc.setFontSize(12); doc.setFont(undefined, 'bold'); doc.text(t, 14, y); doc.setFontSize(10); y += 8; };

  doc.setFontSize(11);
  doc.text('Mes: ' + nombreDeMes(mes), 14, y); y += 6;
  doc.setFontSize(10);

  titulo('Estado de resultados');
  linea(`Ventas (${e.numeroVentas})`, e.totalVentas);
  linea('(-) Costo de lo vendido', e.costoVendido);
  linea('= Utilidad bruta', e.utilidadBruta, true);
  linea('(-) Gastos del negocio', e.totalGastos);
  e.gastosPorCategoria.forEach((c) => linea(c.texto, c.total, false, 22));
  linea('= UTILIDAD NETA', e.utilidadNeta, true);
  if (e.margenNeto !== null) linea('Margen neto: ' + pct(e.margenNeto));
  if (e.ventasSinCosto) linea(`Aviso: ${e.ventasSinCosto} venta(s) sin costo registrado; la utilidad puede ser mayor a la real.`);

  titulo('Flujo de dinero');
  linea('Entró por ventas', e.totalVentas);
  linea('(-) Compras de mercadería', e.totalCompras);
  linea('(-) Gastos', e.totalGastos);
  linea('= Saldo del mes', e.flujo, true);

  titulo('Inventario al día de hoy');
  linea('Valor a costo', e.valorInventarioCosto);
  linea('Valor a precio de venta', e.valorInventarioVenta);

  titulo('Ventas por persona');
  e.ventasPorPersona.forEach((p) => linea(`${p.nombre} (${p.ventas})`, p.total));

  titulo('Día a día');
  nueva();
  doc.setFont(undefined, 'bold');
  ['Día', 'Ventas', 'Gastos', 'Utilidad', 'Acumulado'].forEach((h, i) => doc.text(h, [14, 70, 105, 140, 196][i], y, i ? { align: 'right' } : undefined));
  y += 7;
  doc.setFont(undefined, 'normal');
  e.porDia.forEach((d) => {
    nueva();
    doc.text(d.fecha, 14, y);
    doc.text(L(d.ventas), 70, y, { align: 'right' });
    doc.text(L(d.gastos), 105, y, { align: 'right' });
    doc.text(L(d.utilidadNeta), 140, y, { align: 'right' });
    doc.text(L(d.acumulado), 196, y, { align: 'right' });
    y += 6;
  });

  return { doc, nombreArchivo: `Estado_financiero_${mes}.pdf` };
}

document.getElementById('btnPdfFinanzas').addEventListener('click', async () => {
  try { await descargarPDF(construirPDFEstadoFinanciero, { mes: mesFinanzas }); } catch (err) { console.error(err); alert('No se pudo generar el PDF.'); }
});
document.getElementById('btnCompartirFinanzas').addEventListener('click', async () => {
  try { await compartirPDF(construirPDFEstadoFinanciero, { mes: mesFinanzas }); } catch (err) { if (err && err.name !== 'AbortError') { console.error(err); alert('No se pudo compartir el PDF.'); } }
});

prepararSelectorMes('selectorMesFinanzas', () => mesFinanzas, (m) => { mesFinanzas = m; refrescarFinanzas(); },
  async () => {
    const [v, g] = await Promise.all([Ventas.listarVentas(), Gastos.listarGastos()]);
    return [...v.map((x) => claveMes(x.fecha)), ...g.map((x) => claveMes(x.fecha))];
  });

// =========================================================
// GASTOS
// =========================================================
async function refrescarGastos() {
  pintarSelectorMes('selectorMesGastos', mesGastos);
  const { desde, hasta } = limitesDeMes(mesGastos);
  const lista = document.getElementById('listaGastos');
  let gastos;
  try {
    gastos = await Gastos.listarGastos({ desde, hasta, incluirAnulados: true });
  } catch (err) {
    console.error(err);
    lista.innerHTML = '<div class="vacio">No se pudieron cargar los gastos.</div>';
    return;
  }
  const validos = gastos.filter((g) => !g.anulado);
  document.getElementById('resumenGastosMes').textContent = formatoL(validos.reduce((s, g) => s + (Number(g.monto) || 0), 0));
  document.getElementById('resumenGastosCantidad').textContent = validos.length;
  if (!gastos.length) {
    lista.innerHTML = '<div class="vacio">No hay gastos en este mes. Toca "+" para registrar uno.</div>';
    return;
  }
  lista.innerHTML = gastos.map((g) => {
    const c = Gastos.categoriaGasto(g.categoria);
    const fecha = new Date(g.fecha).toLocaleDateString('es-HN', { day: 'numeric', month: 'short' });
    return `<div class="card ${g.anulado ? 'compra-anulada' : ''}" data-gasto="${escaparHtml(g.id)}">
      <div class="info">
        <h3>${c.emoji} ${escaparHtml(c.texto)}${g.anulado ? ' <span class="chip anulada">Anulado</span>' : ''}</h3>
        <p>${fecha}${g.descripcion ? ' · ' + escaparHtml(g.descripcion) : ''}</p>
        ${g.anulado ? `<p class="nota-anulada">${escaparHtml(g.motivoAnulacion || '')}${g.notaAnulacion ? ': ' + escaparHtml(g.notaAnulacion) : ''}</p>` : ''}
      </div>
      <div class="precio">${formatoL(g.monto)}</div>
    </div>`;
  }).join('');
  lista.querySelectorAll('[data-gasto]').forEach((el) => el.addEventListener('click', () => {
    const g = gastos.find((x) => x.id === el.dataset.gasto);
    if (g && !g.anulado) preguntarAnularGasto(g);
  }));
}

async function preguntarAnularGasto(g) {
  const c = Gastos.categoriaGasto(g.categoria);
  const accion = await elegirAccion(c.emoji + ' ' + c.texto, [{ id: 'anular', texto: '🚫 Anular este gasto' }],
    `${formatoL(g.monto)}${g.descripcion ? ' · ' + g.descripcion : ''}`, 'Cerrar');
  if (accion !== 'anular') return;
  const motivo = await elegirAccion('¿Por qué se anula?', Gastos.MOTIVOS_ANULAR_GASTO.map((m) => ({ id: m.id, texto: m.texto })), '', 'Cancelar');
  if (!motivo) return;
  const nota = motivo === 'otro' ? (prompt('Escribe el motivo:') || '') : '';
  try {
    await Gastos.anularGasto(g.id, { motivo, nota });
    refrescarGastos();
  } catch (err) {
    alert(err.message);
  }
}

function abrirModalGasto() {
  const sel = document.getElementById('campoGastoCategoria');
  if (!sel.options.length) {
    sel.innerHTML = Gastos.CATEGORIAS_GASTO.map((c) => `<option value="${c.id}">${c.emoji} ${escaparHtml(c.texto)}</option>`).join('');
  }
  sel.value = 'empaque';
  document.getElementById('campoGastoMonto').value = '';
  document.getElementById('campoGastoDescripcion').value = '';
  const fecha = document.getElementById('campoGastoFecha');
  fecha.max = Gastos.hoyLocal();
  // Si se está viendo un mes anterior, se propone el último día de ese mes
  fecha.value = mesGastos === MES_ACTUAL() ? Gastos.hoyLocal() : limitesDeMes(mesGastos).hasta;
  document.getElementById('errorGasto').textContent = '';
  mostrarModal('modalGasto');
  setTimeout(() => document.getElementById('campoGastoMonto').focus(), 50);
}

document.getElementById('btnCancelarGasto').addEventListener('click', () => ocultarModal('modalGasto'));
document.getElementById('btnGuardarGasto').addEventListener('click', async () => {
  const boton = document.getElementById('btnGuardarGasto');
  const error = document.getElementById('errorGasto');
  error.textContent = '';
  boton.disabled = true;
  try {
    const guardado = Gastos.registrarGasto({
      categoria: document.getElementById('campoGastoCategoria').value,
      monto: document.getElementById('campoGastoMonto').value,
      fecha: document.getElementById('campoGastoFecha').value,
      descripcion: document.getElementById('campoGastoDescripcion').value,
    });
    // Sin internet la promesa de Firestore no termina hasta que vuelve la señal
    if (navigator.onLine) await guardado; else guardado.catch((e) => console.warn(e));
    ocultarModal('modalGasto');
    refrescarGastos();
  } catch (err) {
    error.textContent = err.message;
  } finally {
    boton.disabled = false;
  }
});

prepararSelectorMes('selectorMesGastos', () => mesGastos, (m) => { mesGastos = m; refrescarGastos(); },
  async () => (await Gastos.listarGastos({ incluirAnulados: true })).map((g) => claveMes(g.fecha)));

DB.escucharCambios(DB.STORES.gastos, () => {
  if (document.getElementById('vista-gastos').classList.contains('activa')) refrescarGastos();
  if (document.getElementById('vista-finanzas').classList.contains('activa')) refrescarFinanzas();
});

// =========================================================
// USUARIOS Y PERMISOS
// =========================================================
async function refrescarUsuarios() {
  const lista = document.getElementById('listaUsuarios');
  let usuarios = [];
  try {
    usuarios = await Usuarios.listarUsuarios();
  } catch (err) {
    console.error(err);
    lista.innerHTML = '<div class="vacio">No se pudo cargar la lista. Revisa que las reglas nuevas de Firebase estén publicadas.</div>';
    return;
  }
  const fijos = Usuarios.DUENOS_FIJOS.map((c) => `<div class="card"><div class="info"><h3>👑 ${escaparHtml(c)}</h3><p>Dueño(a) fundador(a) · acceso completo</p></div></div>`).join('');
  const otros = usuarios.map((u) => {
    const r = Usuarios.ROLES_TEXTO[u.rol] || Usuarios.ROLES_TEXTO.vendedor;
    return `<div class="card ${u.activo ? '' : 'sin-stock'}" data-usuario="${escaparHtml(u.id)}">
      <div class="info">
        <h3>${r.emoji} ${escaparHtml(u.nombre || u.id)} ${u.activo ? '' : '<span class="chip anulada">Desactivado</span>'}</h3>
        <p>${escaparHtml(u.id)} · ${r.texto}</p>
      </div>
    </div>`;
  }).join('');
  lista.innerHTML = fijos + (otros || '<div class="vacio">Aún no hay vendedoras. Toca "+" para agregar una.</div>');
  lista.querySelectorAll('[data-usuario]').forEach((el) => el.addEventListener('click', () => {
    abrirModalUsuario(usuarios.find((u) => u.id === el.dataset.usuario));
  }));
}

function abrirModalUsuario(u = null) {
  usuarioEditando = u;
  document.getElementById('tituloModalUsuario').textContent = u ? 'Editar acceso' : 'Agregar persona';
  document.getElementById('campoUsuarioNombre').value = u ? u.nombre || '' : '';
  const correo = document.getElementById('campoUsuarioCorreo');
  correo.value = u ? u.id : '';
  correo.disabled = !!u;
  document.getElementById('campoUsuarioRol').value = u ? u.rol : 'vendedor';
  document.getElementById('campoUsuarioActivo').checked = u ? u.activo !== false : true;
  document.getElementById('filaEliminarUsuario').style.display = u ? 'flex' : 'none';
  document.getElementById('errorUsuario').textContent = '';
  mostrarModal('modalUsuario');
}

document.getElementById('btnCancelarUsuario').addEventListener('click', () => ocultarModal('modalUsuario'));
document.getElementById('btnGuardarUsuario').addEventListener('click', async () => {
  const boton = document.getElementById('btnGuardarUsuario');
  const error = document.getElementById('errorUsuario');
  if (!navigator.onLine) { error.textContent = 'Para cambiar permisos necesitas internet.'; return; }
  const rol = document.getElementById('campoUsuarioRol').value;
  if (rol === 'dueno' && !confirm('Un dueño ve TODO: costos, ganancias, compras, gastos y puede cambiar permisos. ¿Continuar?')) return;
  boton.disabled = true;
  error.textContent = '';
  try {
    await Usuarios.guardarUsuario({
      nombre: document.getElementById('campoUsuarioNombre').value,
      correo: document.getElementById('campoUsuarioCorreo').value,
      rol,
      activo: document.getElementById('campoUsuarioActivo').checked,
    }, usuarioEditando);
    ocultarModal('modalUsuario');
    refrescarUsuarios();
  } catch (err) {
    error.textContent = err.message || DB.mensajeDeError(err);
  } finally {
    boton.disabled = false;
  }
});
document.getElementById('btnEliminarUsuario').addEventListener('click', async () => {
  if (!usuarioEditando) return;
  if (!navigator.onLine) { alert('Para cambiar permisos necesitas internet.'); return; }
  if (!confirm(`¿Quitar el acceso a ${usuarioEditando.nombre || usuarioEditando.id}? Sus ventas registradas se conservan.`)) return;
  try {
    await Usuarios.eliminarUsuario(usuarioEditando.id);
    ocultarModal('modalUsuario');
    refrescarUsuarios();
  } catch (err) {
    alert(DB.mensajeDeError(err));
  }
});
