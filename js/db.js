// db.js — Capa de acceso a datos para Encantos, respaldada por Firestore
// para que el inventario, los clientes, las ventas y los pedidos se sincronicen automáticamente
// entre los celulares que usan la app. Firestore guarda una copia local en el
// teléfono (funciona sin internet) y sincroniza sola cuando hay conexión.

firebase.initializeApp(firebaseConfig);
const firestoreDB = firebase.firestore();
const firebaseAuth = firebase.auth();

// Persistencia sin conexión: permite seguir usando la app sin internet y
// sincroniza automáticamente en cuanto vuelve la señal.
firestoreDB.enablePersistence({ synchronizeTabs: true }).catch((err) => {
  console.warn('No se pudo activar la persistencia sin conexión de Firestore', err.code);
});

const STORES = {
  productos: 'productos',
  clientes: 'clientes',
  ventas: 'ventas',
  proveedores: 'proveedores',
  catalogo: 'catalogo',
  pedidos: 'pedidos',
  notas: 'notas',
};

// Documento único con los datos públicos del negocio (WhatsApp, cuenta bancaria...)
const COLECCION_CONFIG = 'configuracion';
const DOC_NEGOCIO = 'negocio';

// Sesión real por correo y contraseña. Solo las cuentas autorizadas en las
// reglas de Firestore pueden leer o escribir datos privados. La sesión queda
// guardada en el teléfono, así que el inicio de sesión solo se pide una vez
// (y esa primera vez necesita internet).
let authReadyResolve;
const authReady = new Promise((resolve) => { authReadyResolve = resolve; });
firebaseAuth.onAuthStateChanged((user) => {
  // Las sesiones anónimas de versiones anteriores ya no sirven.
  if (user && !user.isAnonymous) authReadyResolve(user);
});

function alCambiarSesion(callback) {
  return firebaseAuth.onAuthStateChanged(callback);
}

function iniciarSesion(correo, clave) {
  return firebaseAuth.signInWithEmailAndPassword(correo.trim(), clave);
}

function cerrarSesion() {
  return firebaseAuth.signOut();
}

// Comprueba que la cuenta tenga permiso real sobre los datos privados.
// Devuelve false solo si Firestore responde "permission-denied" (cuenta no
// autorizada); sin internet o con otro error se asume que sí hay acceso.
async function verificarAcceso() {
  try {
    await firestoreDB.collection(STORES.clientes).limit(1).get();
    return true;
  } catch (err) {
    return err.code !== 'permission-denied';
  }
}

function coleccion(nombreTienda) {
  return firestoreDB.collection(nombreTienda);
}

async function agregar(nombreTienda, objeto) {
  await authReady;
  const ref = await coleccion(nombreTienda).add(objeto);
  return ref.id;
}

async function actualizar(nombreTienda, objeto) {
  await authReady;
  const { id, ...resto } = objeto;
  await coleccion(nombreTienda).doc(id).set(resto, { merge: false });
  return id;
}

// Incremento atómico (por ejemplo, descontar stock). Evita que dos celulares
// vendiendo al mismo tiempo se "pisen" el uno al otro al escribir.
async function incrementarCampo(nombreTienda, id, campo, delta) {
  await authReady;
  return coleccion(nombreTienda).doc(id).update({
    [campo]: firebase.firestore.FieldValue.increment(delta),
  });
}

// Cambia solo algunos campos de un documento (sin tocar el resto).
async function actualizarCampos(nombreTienda, id, campos) {
  await authReady;
  return coleccion(nombreTienda).doc(id).update(campos);
}

async function eliminar(nombreTienda, id) {
  await authReady;
  await coleccion(nombreTienda).doc(id).delete();
}

async function obtener(nombreTienda, id) {
  await authReady;
  const snap = await coleccion(nombreTienda).doc(id).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

async function obtenerTodos(nombreTienda) {
  await authReady;
  const snap = await coleccion(nombreTienda).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Documentos sueltos (por ejemplo, la configuración del negocio)
async function obtenerDocumento(nombreColeccion, id) {
  await authReady;
  const snap = await firestoreDB.collection(nombreColeccion).doc(id).get();
  return snap.exists ? snap.data() : null;
}

async function guardarDocumento(nombreColeccion, id, datos) {
  await authReady;
  await firestoreDB.collection(nombreColeccion).doc(id).set(datos, { merge: true });
}

// Se llama cuando cambia algo en una colección (propio o del otro celular) y
// permite refrescar la pantalla automáticamente.
function escucharCambios(nombreTienda, callback) {
  return coleccion(nombreTienda).onSnapshot(
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => console.warn('Error escuchando cambios de ' + nombreTienda, err)
  );
}

// Exportar toda la base de datos como un objeto plano (para respaldo)
async function exportarTodo() {
  const [productos, clientes, ventas, proveedores, catalogo, pedidos, notas] = await Promise.all([
    obtenerTodos(STORES.productos),
    obtenerTodos(STORES.clientes),
    obtenerTodos(STORES.ventas),
    obtenerTodos(STORES.proveedores),
    obtenerTodos(STORES.catalogo),
    obtenerTodos(STORES.pedidos),
    obtenerTodos(STORES.notas),
  ]);
  return {
    version: 5,
    exportadoEl: new Date().toISOString(),
    productos,
    clientes,
    ventas,
    proveedores,
    catalogo,
    pedidos,
    notas,
  };
}

async function limpiarColeccion(nombreTienda) {
  const snap = await coleccion(nombreTienda).get();
  const lotes = [];
  let batch = firestoreDB.batch();
  let contador = 0;
  snap.docs.forEach((d) => {
    batch.delete(d.ref);
    contador++;
    if (contador === 400) {
      lotes.push(batch.commit());
      batch = firestoreDB.batch();
      contador = 0;
    }
  });
  if (contador > 0) lotes.push(batch.commit());
  return Promise.all(lotes);
}

// Importar un respaldo (reemplaza todo el contenido actual de la nube)
async function importarTodo(data) {
  await authReady;
  await Promise.all([
    limpiarColeccion(STORES.productos),
    limpiarColeccion(STORES.clientes),
    limpiarColeccion(STORES.ventas),
    limpiarColeccion(STORES.proveedores),
    limpiarColeccion(STORES.catalogo),
    limpiarColeccion(STORES.pedidos),
    limpiarColeccion(STORES.notas),
  ]);

  const escrituras = [];
  let batch = firestoreDB.batch();
  let contador = 0;

  function agregarAlLote(nombreTienda, registro) {
    const { id, ...resto } = registro;
    const ref = id ? coleccion(nombreTienda).doc(String(id)) : coleccion(nombreTienda).doc();
    batch.set(ref, resto);
    contador++;
    if (contador === 400) {
      escrituras.push(batch.commit());
      batch = firestoreDB.batch();
      contador = 0;
    }
  }

  (data.productos || []).forEach((p) => agregarAlLote(STORES.productos, p));
  (data.clientes || []).forEach((c) => agregarAlLote(STORES.clientes, c));
  (data.ventas || []).forEach((v) => agregarAlLote(STORES.ventas, v));
  (data.proveedores || []).forEach((pr) => agregarAlLote(STORES.proveedores, pr));
  (data.catalogo || []).forEach((c) => agregarAlLote(STORES.catalogo, c));
  (data.pedidos || []).forEach((pe) => agregarAlLote(STORES.pedidos, pe));
  (data.notas || []).forEach((n) => agregarAlLote(STORES.notas, n));

  if (contador > 0) escrituras.push(batch.commit());
  await Promise.all(escrituras);
}

window.DB = {
  STORES,
  COLECCION_CONFIG,
  DOC_NEGOCIO,
  alCambiarSesion,
  iniciarSesion,
  cerrarSesion,
  verificarAcceso,
  agregar,
  actualizar,
  actualizarCampos,
  obtenerDocumento,
  guardarDocumento,
  incrementarCampo,
  eliminar,
  obtener,
  obtenerTodos,
  escucharCambios,
  exportarTodo,
  importarTodo,
};
