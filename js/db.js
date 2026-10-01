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
  compras: 'compras',           // compras de mercadería
  catalogo: 'catalogo_publico', // copia pública para clientes (sin costos)
  ajustes: 'ajustes',           // configuración privada del equipo
};

// ---------- Acceso: solo cuentas de Google autorizadas ----------
// Antes la app usaba una sesión anónima, que cualquier persona podía obtener.
// Ahora cada celular inicia sesión con Google y solo estos correos pueden
// entrar. La MISMA lista debe estar en las reglas de Firestore (firestore.rules),
// que son las que realmente protegen los datos en la nube.
const CORREOS_AUTORIZADOS = [
  'juceas19@gmail.com',
  'sairareyes4@gmail.com',
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

// Venta atómica (requiere internet): en una sola operación revisa el stock
// real en la nube, lo descuenta y guarda la venta. Si los dos celulares venden
// la última unidad al mismo tiempo, solo una de las dos ventas pasa.
async function venderEnTransaccion(productoId, cantidad, venta) {
  await authReady;
  const refProducto = coleccion(STORES.productos).doc(productoId);
  const refVenta = coleccion(STORES.ventas).doc();
  await firestoreDB.runTransaction(async (tx) => {
    const snap = await tx.get(refProducto);
    if (!snap.exists) {
      const e = new Error('Producto no encontrado'); e.code = 'no-existe'; throw e;
    }
    const stock = Number(snap.data().stock) || 0;
    if (stock < cantidad) {
      const e = new Error('sin stock'); e.code = 'sin-stock'; e.stock = stock; throw e;
    }
    tx.update(refProducto, { stock: stock - cantidad });
    tx.set(refVenta, venta);
  });
  return refVenta.id;
}

// Anulación atómica (requiere internet): marca la venta como anulada y
// devuelve el stock en una sola operación. Si los dos celulares anulan la misma
// venta al mismo tiempo, solo una pasa y el stock no se devuelve dos veces.
async function anularVentaEnTransaccion(ventaId, datosAnulacion) {
  await authReady;
  const refVenta = coleccion(STORES.ventas).doc(ventaId);
  let resultado = { productoId: null, productoExiste: false };
  await firestoreDB.runTransaction(async (tx) => {
    const snapVenta = await tx.get(refVenta);
    if (!snapVenta.exists) { const e = new Error('Venta no encontrada'); e.code = 'no-existe'; throw e; }
    const venta = snapVenta.data();
    if (venta.anulada) { const e = new Error('Ya anulada'); e.code = 'ya-anulada'; throw e; }
    let snapProducto = null;
    const refProducto = venta.productoId ? coleccion(STORES.productos).doc(venta.productoId) : null;
    if (refProducto) snapProducto = await tx.get(refProducto);
    if (snapProducto && snapProducto.exists) {
      const stock = Number(snapProducto.data().stock) || 0;
      tx.update(refProducto, { stock: stock + (Number(venta.cantidad) || 0) });
    }
    tx.update(refVenta, { anulada: true, ...datosAnulacion });
    resultado = { productoId: venta.productoId || null, productoExiste: !!(snapProducto && snapProducto.exists) };
  });
  return resultado;
}

// Compra atómica (requiere internet): suma el stock, recalcula el costo
// promedio y guarda la compra en una sola operación.
async function comprarEnTransaccion(productoId, compra, calcularCosto) {
  await authReady;
  const refProducto = coleccion(STORES.productos).doc(productoId);
  const refCompra = coleccion(STORES.compras).doc();
  let resultado = {};
  await firestoreDB.runTransaction(async (tx) => {
    const snap = await tx.get(refProducto);
    if (!snap.exists) { const e = new Error('Producto no encontrado'); e.code = 'no-existe'; throw e; }
    const p = snap.data();
    const stockAnterior = Number(p.stock) || 0;
    const costoAnterior = Number(p.costo) || 0;
    const costoNuevo = calcularCosto(stockAnterior, costoAnterior, compra.cantidad, compra.costoUnitario);
    const cambios = { stock: stockAnterior + compra.cantidad, costo: costoNuevo };
    if (compra.proveedorId && !p.proveedorId) { cambios.proveedorId = compra.proveedorId; cambios.origen = 'Compra a proveedor'; }
    tx.update(refProducto, cambios);
    resultado = { stockAnterior, costoAnterior, costoNuevo, stockNuevo: cambios.stock };
    tx.set(refCompra, { ...compra, stockAnterior, costoAnterior, costoNuevo });
  });
  return { id: refCompra.id, ...resultado };
}

// Anulación atómica de una compra: quita las unidades y saca la compra del promedio.
async function anularCompraEnTransaccion(compraId, datosAnulacion, calcularCosto) {
  await authReady;
  const refCompra = coleccion(STORES.compras).doc(compraId);
  let resultado = { productoId: null, productoExiste: false };
  await firestoreDB.runTransaction(async (tx) => {
    const snapCompra = await tx.get(refCompra);
    if (!snapCompra.exists) { const e = new Error('Compra no encontrada'); e.code = 'no-existe'; throw e; }
    const compra = snapCompra.data();
    if (compra.anulada) { const e = new Error('Ya anulada'); e.code = 'ya-anulada'; throw e; }
    const refProducto = compra.productoId ? coleccion(STORES.productos).doc(compra.productoId) : null;
    const snapProducto = refProducto ? await tx.get(refProducto) : null;
    if (snapProducto && snapProducto.exists) {
      const p = snapProducto.data();
      const stock = Number(p.stock) || 0;
      if (stock < compra.cantidad) { const e = new Error('Stock insuficiente'); e.code = 'stock-insuficiente'; e.stock = stock; throw e; }
      tx.update(refProducto, {
        stock: stock - compra.cantidad,
        costo: calcularCosto(stock, p.costo, compra.cantidad, compra.costoUnitario, compra.costoAnterior),
      });
    }
    tx.update(refCompra, { anulada: true, ...datosAnulacion });
    resultado = { productoId: compra.productoId || null, productoExiste: !!(snapProducto && snapProducto.exists) };
  });
  return resultado;
}

// Solo se guarda "sin internet" cuando el error es de conexión. Cualquier otro
// error (por ejemplo, falta de permiso) se muestra, para no dar algo por guardado.
function esErrorDeConexion(err) {
  return !navigator.onLine || ['unavailable', 'deadline-exceeded', 'failed-precondition'].includes(err && err.code);
}

function mensajeDeError(err) {
  if (err && err.code === 'permission-denied') return 'No hay permiso para guardar esto. Avísale a JUCEAS: falta actualizar las reglas de seguridad de Firestore.';
  return (err && err.message) || 'No se pudo guardar. Revisa tu conexión e intenta de nuevo.';
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
  const [productos, clientes, ventas, proveedores, compras] = await Promise.all([
    obtenerTodos(STORES.productos),
    obtenerTodos(STORES.clientes),
    obtenerTodos(STORES.ventas),
    obtenerTodos(STORES.proveedores),
    obtenerTodos(STORES.compras),
  ]);
  return {
    version: 4,
    exportadoEl: new Date().toISOString(),
    productos,
    clientes,
    ventas,
    proveedores,
    compras,
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
    limpiarColeccion(STORES.compras),
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
  (data.compras || []).forEach((c) => agregarAlLote(STORES.compras, c));

  if (contador > 0) escrituras.push(batch.commit());
  await Promise.all(escrituras);
}

window.DB = {
  STORES,
  agregar,
  actualizar,
  incrementarCampo,
  venderEnTransaccion,
  anularVentaEnTransaccion,
  comprarEnTransaccion,
  anularCompraEnTransaccion,
  esErrorDeConexion,
  mensajeDeError,
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
