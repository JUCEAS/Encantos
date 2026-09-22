// db.js — Capa de acceso a IndexedDB para Encantos
// Todo se guarda localmente en el teléfono. Nada sale a internet.

const DB_NAME = 'encantos-db';
const DB_VERSION = 1;

const STORES = {
  productos: 'productos',
  clientes: 'clientes',
  ventas: 'ventas',
};

let dbInstance = null;

function abrirDB() {
  if (dbInstance) return Promise.resolve(dbInstance);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains(STORES.productos)) {
        const store = db.createObjectStore(STORES.productos, { keyPath: 'id', autoIncrement: true });
        store.createIndex('nombre', 'nombre', { unique: false });
        store.createIndex('categoria', 'categoria', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.clientes)) {
        const store = db.createObjectStore(STORES.clientes, { keyPath: 'id', autoIncrement: true });
        store.createIndex('nombre', 'nombre', { unique: false });
        store.createIndex('celular', 'celular', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.ventas)) {
        const store = db.createObjectStore(STORES.ventas, { keyPath: 'id', autoIncrement: true });
        store.createIndex('fecha', 'fecha', { unique: false });
        store.createIndex('clienteId', 'clienteId', { unique: false });
        store.createIndex('productoId', 'productoId', { unique: false });
      }
    };

    req.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    req.onerror = (event) => reject(event.target.error);
  });
}

function conTienda(nombreTienda, modo, callback) {
  return abrirDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(nombreTienda, modo);
      const store = tx.objectStore(nombreTienda);
      const resultado = callback(store);
      tx.oncomplete = () => resolve(resultado);
      tx.onerror = (e) => reject(e.target.error);
    });
  });
}

function agregar(nombreTienda, objeto) {
  return abrirDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(nombreTienda, 'readwrite');
      const store = tx.objectStore(nombreTienda);
      const req = store.add(objeto);
      req.onsuccess = () => resolve(req.result);
      req.onerror = (e) => reject(e.target.error);
    });
  });
}

function actualizar(nombreTienda, objeto) {
  return abrirDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(nombreTienda, 'readwrite');
      const store = tx.objectStore(nombreTienda);
      const req = store.put(objeto);
      req.onsuccess = () => resolve(req.result);
      req.onerror = (e) => reject(e.target.error);
    });
  });
}

function eliminar(nombreTienda, id) {
  return abrirDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(nombreTienda, 'readwrite');
      const store = tx.objectStore(nombreTienda);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = (e) => reject(e.target.error);
    });
  });
}

function obtener(nombreTienda, id) {
  return abrirDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(nombreTienda, 'readonly');
      const store = tx.objectStore(nombreTienda);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = (e) => reject(e.target.error);
    });
  });
}

function obtenerTodos(nombreTienda) {
  return abrirDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(nombreTienda, 'readonly');
      const store = tx.objectStore(nombreTienda);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = (e) => reject(e.target.error);
    });
  });
}

// Exportar toda la base de datos como un objeto plano (para respaldo)
async function exportarTodo() {
  const [productos, clientes, ventas] = await Promise.all([
    obtenerTodos(STORES.productos),
    obtenerTodos(STORES.clientes),
    obtenerTodos(STORES.ventas),
  ]);
  return {
    version: DB_VERSION,
    exportadoEl: new Date().toISOString(),
    productos,
    clientes,
    ventas,
  };
}

// Importar un respaldo (reemplaza todo el contenido actual)
async function importarTodo(data) {
  const db = await abrirDB();
  const nombres = [STORES.productos, STORES.clientes, STORES.ventas];
  return new Promise((resolve, reject) => {
    const tx = db.transaction(nombres, 'readwrite');
    nombres.forEach((nombre) => tx.objectStore(nombre).clear());

    (data.productos || []).forEach((p) => tx.objectStore(STORES.productos).put(p));
    (data.clientes || []).forEach((c) => tx.objectStore(STORES.clientes).put(c));
    (data.ventas || []).forEach((v) => tx.objectStore(STORES.ventas).put(v));

    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });
}

window.DB = {
  STORES,
  agregar,
  actualizar,
  eliminar,
  obtener,
  obtenerTodos,
  exportarTodo,
  importarTodo,
};
