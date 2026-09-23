// db.js — Capa de acceso a datos para Encantos, ahora respaldada por Firestore
// para que el inventario, los clientes y las ventas se sincronicen automáticamente
// entre los celulares que usan la app. Firestore guarda una copia local en el
// teléfono (funciona sin internet) y sincroniza sola cuando hay conexión.

const firebaseConfig = {
  apiKey: "AIzaSyArwo4lDPBxUNk-eafoqedY0Ylp6FodOu0",
  authDomain: "encantos-vivero.firebaseapp.com",
  projectId: "encantos-vivero",
  storageBucket: "encantos-vivero.firebasestorage.app",
  messagingSenderId: "892959442776",
  appId: "1:892959442776:web:e51c8af2b425f7f11fc72d",
};

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
  catalogo: 'catalogo_publico', // copia pública para clientes (sin costos)
};

// ---------- Acceso: solo cuentas de Google autorizadas ----------
// Antes la app usaba una sesión anónima, que cualquier persona podía obtener.
// Ahora cada celular inicia sesión con Google y solo estos correos pueden
// entrar. La MISMA lista debe estar en las reglas de Firestore (firestore.rules),
// que son las que realmente protegen los datos en la nube.
const CORREOS_AUTORIZADOS = [
  'juceas19@gmail.com',
  // Para agregar a otra persona: 'sucorreo@gmail.com',  (y también en firestore.rules)
];

function esCorreoAutorizado(user) {
  return !!(user && user.email && CORREOS_AUTORIZADOS.includes(user.email.toLowerCase()));
}

// La sesión queda guardada en el teléfono: después del primer inicio de sesión
// la app abre directo, incluso sin internet.
firebaseAuth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(() => {});

let authReadyResolve;
const authReady = new Promise((resolve) => { authReadyResolve = resolve; });
const oyentesSesion = [];

firebaseAuth.onAuthStateChanged(async (user) => {
  if (user && !esCorreoAutorizado(user)) {
    // Cuenta de Google válida pero no autorizada (o sesión anónima antigua).
    await firebaseAuth.signOut();
    oyentesSesion.forEach((fn) => fn(null, 'no-autorizado', user.email || ''));
    return;
  }
  if (user) authReadyResolve(user);
  oyentesSesion.forEach((fn) => fn(user, user ? 'ok' : 'sin-sesion'));
});

function alCambiarSesion(fn) { oyentesSesion.push(fn); }

async function iniciarSesionGoogle() {
  const proveedor = new firebase.auth.GoogleAuthProvider();
  proveedor.setCustomParameters({ prompt: 'select_account' });
  try {
    await firebaseAuth.signInWithPopup(proveedor);
  } catch (err) {
    if (err.code === 'auth/popup-blocked' || err.code === 'auth/operation-not-supported-in-this-environment') {
      await firebaseAuth.signInWithRedirect(proveedor);
    } else {
      throw err;
    }
  }
}

async function cerrarSesion() {
  await firebaseAuth.signOut();
  location.reload();
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

// Se llama cuando cambia algo en una colección (propio o del otro celular) y
// permite refrescar la pantalla automáticamente.
function escucharCambios(nombreTienda, callback) {
  let cancelar = () => {};
  authReady.then(() => {
    cancelar = coleccion(nombreTienda).onSnapshot(
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => console.warn('Error escuchando cambios de ' + nombreTienda, err)
    );
  });
  return () => cancelar();
}

// Exportar toda la base de datos como un objeto plano (para respaldo)
async function exportarTodo() {
  await authReady;
  const [productos, clientes, ventas, proveedores] = await Promise.all([
    obtenerTodos(STORES.productos),
    obtenerTodos(STORES.clientes),
    obtenerTodos(STORES.ventas),
    obtenerTodos(STORES.proveedores),
  ]);
  return {
    version: 3,
    exportadoEl: new Date().toISOString(),
    productos,
    clientes,
    ventas,
    proveedores,
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

  if (contador > 0) escrituras.push(batch.commit());
  await Promise.all(escrituras);
}

window.DB = {
  STORES,
  agregar,
  actualizar,
  incrementarCampo,
  eliminar,
  obtener,
  obtenerTodos,
  escucharCambios,
  exportarTodo,
  importarTodo,
  authReady,
  alCambiarSesion,
  iniciarSesionGoogle,
  cerrarSesion,
};
