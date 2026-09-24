// backup.js — Exportar/Importar toda la base de datos (respaldo, o para fusionar con otro celular)

async function exportarRespaldo() {
  const datos = await DB.exportarTodo();
  const blob = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `encantos-respaldo-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Revisa que el archivo sea realmente un respaldo de Encantos antes de tocar
// los datos. Importar reemplaza TODO lo que hay en la nube (en ambos celulares).
function validarRespaldo(datos) {
  const colecciones = ['productos', 'clientes', 'ventas', 'proveedores'];
  const esObjeto = datos && typeof datos === 'object' && !Array.isArray(datos);
  if (!esObjeto || !colecciones.some((c) => Array.isArray(datos[c]))) {
    throw new Error('Este archivo no es un respaldo de Encantos. No se cambió nada.');
  }
  for (const c of colecciones) {
    if (datos[c] !== undefined && !Array.isArray(datos[c])) throw new Error(`El respaldo está dañado (${c}). No se cambió nada.`);
    for (const r of datos[c] || []) {
      if (!r || typeof r !== 'object' || Array.isArray(r)) throw new Error(`El respaldo tiene registros dañados en ${c}. No se cambió nada.`);
    }
  }
  const total = colecciones.reduce((n, c) => n + (datos[c] || []).length, 0);
  if (total === 0) throw new Error('El respaldo está vacío. No se cambió nada.');
}

function importarRespaldoDesdeArchivo(archivo) {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = async (e) => {
      try {
        let datos;
        try { datos = JSON.parse(e.target.result); } catch { throw new Error('El archivo no es un respaldo válido.'); }
        validarRespaldo(datos);
        // Copia de seguridad automática de lo que hay ahora, por si acaso
        await exportarRespaldo();
        await DB.importarTodo(datos);
        resolve(datos);
      } catch (err) {
        reject(err);
      }
    };
    lector.onerror = reject;
    lector.readAsText(archivo);
  });
}

window.Backup = { exportarRespaldo, importarRespaldoDesdeArchivo };
