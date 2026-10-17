// firebase-config.js — Configuración del proyecto Firebase, compartida por la
// app interna (db.js) y la página pública del catálogo (catalogo-publico.js).
//
// Estos valores identifican el proyecto; NO son una contraseña. Lo que protege
// los datos son las reglas de Firestore (ver el archivo firestore.rules): solo
// el catálogo visible y la configuración del negocio se pueden leer sin sesión.

const firebaseConfig = {
  apiKey: "AIzaSyArwo4lDPBxUNk-eafoqedY0Ylp6FodOu0",
  authDomain: "encantos-vivero.firebaseapp.com",
  projectId: "encantos-vivero",
  storageBucket: "encantos-vivero.firebasestorage.app",
  messagingSenderId: "892959442776",
  appId: "1:892959442776:web:e51c8af2b425f7f11fc72d",
};
