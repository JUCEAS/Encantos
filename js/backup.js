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

function importarRespaldoDesdeArchivo(archivo) {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = async (e) => {
      try {
        const datos = JSON.parse(e.target.result);
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
