// usuarios.js — Personas con acceso a la app y qué puede hacer cada una.
// El documento se guarda con el correo como identificador (usuarios/<correo>).
// Las reglas de Firestore leen esta lista para dar o quitar permisos.

// Dueños fundadores: están fijos en firestore.rules y no se pueden quitar desde aquí.
const DUENOS_FIJOS = ['juceas19@gmail.com', 'sairareyes4@gmail.com'];

const ROLES_TEXTO = {
  vendedor: { texto: 'Vendedor(a)', detalle: 'Ve el inventario (sin costos), vende, agrega clientes y ve solo sus ventas.', emoji: '🧑‍💼' },
  dueno: { texto: 'Dueño(a)', detalle: 'Ve y maneja todo: costos, compras, gastos y estado financiero.', emoji: '👑' },
};

function correoValido(c) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c); }

async function listarUsuarios() {
  const lista = await DB.obtenerTodos(DB.STORES.usuarios);
  return lista.sort((a, b) => (a.nombre || a.id).localeCompare(b.nombre || b.id));
}

// datos = { correo, nombre, rol, activo }
async function guardarUsuario(datos, existente = null) {
  const correo = String(datos.correo || '').trim().toLowerCase();
  if (!correoValido(correo)) throw new Error('Escribe un correo válido.');
  if (DUENOS_FIJOS.includes(correo)) throw new Error('Esa cuenta ya es dueña fija del negocio.');
  const nombre = String(datos.nombre || '').trim().slice(0, 60);
  if (!nombre) throw new Error('Escribe el nombre de la persona.');
  const rol = datos.rol === 'dueno' ? 'dueno' : 'vendedor';
  if (!existente) {
    const ya = await DB.obtener(DB.STORES.usuarios, correo);
    if (ya) throw new Error('Ese correo ya está en la lista.');
  }
  await DB.actualizar(DB.STORES.usuarios, {
    id: correo,
    nombre,
    rol,
    activo: datos.activo !== false,
    creadoEl: (existente && existente.creadoEl) || new Date().toISOString(),
    creadoPor: (existente && existente.creadoPor) || DB.correoActual(),
    actualizadoEl: new Date().toISOString(),
  });
}

async function cambiarActivo(usuario, activo) {
  await DB.actualizarCampos(DB.STORES.usuarios, usuario.id, { activo: !!activo, actualizadoEl: new Date().toISOString() });
}

async function eliminarUsuario(correo) {
  await DB.eliminar(DB.STORES.usuarios, correo);
}

window.Usuarios = { DUENOS_FIJOS, ROLES_TEXTO, listarUsuarios, guardarUsuario, cambiarActivo, eliminarUsuario, correoValido };
