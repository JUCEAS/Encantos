// reportes.js — Generación de reportes PDF (ventas, ganancias, más vendidos)
// Usa jsPDF, incluido localmente para funcionar sin internet.

function formatoLempiras(valor) {
  return 'L. ' + (valor || 0).toFixed(2);
}

async function construirPDF({ desde = null, hasta = null, titulo = 'Reporte de Ventas' } = {}) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  const { ventas, totalVendido, totalGanancia, masVendidos } = await Ventas.resumen({ desde, hasta });

  const margenIzq = 14;
  let y = 18;

  doc.setFontSize(16);
  doc.text('Encantos - ' + titulo, margenIzq, y);
  y += 7;

  doc.setFontSize(10);
  const rango = desde || hasta
    ? `Periodo: ${desde ? new Date(desde).toLocaleDateString() : '...'} a ${hasta ? new Date(hasta).toLocaleDateString() : 'hoy'}`
    : 'Periodo: todas las ventas registradas';
  doc.text(rango, margenIzq, y);
  y += 5;
  doc.text('Generado el: ' + new Date().toLocaleString(), margenIzq, y);
  y += 10;

  doc.setFontSize(12);
  doc.text('Resumen', margenIzq, y);
  y += 6;
  doc.setFontSize(10);
  doc.text(`Total vendido: ${formatoLempiras(totalVendido)}`, margenIzq, y);
  y += 5;
  doc.text(`Ganancia total: ${formatoLempiras(totalGanancia)}`, margenIzq, y);
  y += 5;
  doc.text(`Número de ventas: ${ventas.length}`, margenIzq, y);
  y += 10;

  doc.setFontSize(12);
  doc.text('Productos más vendidos', margenIzq, y);
  y += 6;
  doc.setFontSize(9);
  doc.text('Producto', margenIzq, y);
  doc.text('Cant.', 110, y);
  doc.text('Total', 135, y);
  doc.text('Ganancia', 165, y);
  y += 4;
  doc.line(margenIzq, y, 196, y);
  y += 4;

  masVendidos.slice(0, 15).forEach((item) => {
    if (y > 270) { doc.addPage(); y = 18; }
    doc.text(item.nombre.substring(0, 40), margenIzq, y);
    doc.text(String(item.cantidad), 110, y);
    doc.text(formatoLempiras(item.total), 135, y);
    doc.text(formatoLempiras(item.ganancia), 165, y);
    y += 5;
  });

  y += 8;
  if (y > 260) { doc.addPage(); y = 18; }
  doc.setFontSize(12);
  doc.text('Detalle de ventas', margenIzq, y);
  y += 6;
  doc.setFontSize(9);
  doc.text('Fecha', margenIzq, y);
  doc.text('Producto', 45, y);
  doc.text('Cant.', 120, y);
  doc.text('Total', 140, y);
  doc.text('Ganancia', 170, y);
  y += 4;
  doc.line(margenIzq, y, 196, y);
  y += 4;

  ventas.forEach((v) => {
    if (y > 280) { doc.addPage(); y = 18; }
    doc.text(new Date(v.fecha).toLocaleDateString(), margenIzq, y);
    doc.text((v.nombreProducto || '').substring(0, 28), 45, y);
    doc.text(String(v.cantidad), 120, y);
    doc.text(formatoLempiras(v.total), 140, y);
    doc.text(formatoLempiras(v.ganancia), 170, y);
    y += 5;
  });

  const nombreArchivo = `encantos-reporte-${new Date().toISOString().slice(0, 10)}.pdf`;
  return { doc, nombreArchivo };
}

// Descarga el PDF directamente al teléfono (funciona sin internet).
async function generarReportePDF(opciones = {}) {
  const { doc, nombreArchivo } = await construirPDF(opciones);
  doc.save(nombreArchivo);
}

// Abre el menú "Compartir" del teléfono (WhatsApp, correo, imprimir, etc.).
// No necesita internet para abrirse; solo se usaría internet si eliges enviarlo
// por WhatsApp u otra app que sí lo requiera.
async function compartirReportePDF(opciones = {}) {
  const { doc, nombreArchivo } = await construirPDF(opciones);
  const blob = doc.output('blob');
  const archivo = new File([blob], nombreArchivo, { type: 'application/pdf' });

  if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
    await navigator.share({
      files: [archivo],
      title: 'Reporte Encantos',
      text: 'Reporte de ventas - Encantos',
    });
  } else {
    // El teléfono no soporta compartir archivos directamente: se descarga
    // y se puede adjuntar manualmente en WhatsApp.
    doc.save(nombreArchivo);
    alert('Tu navegador no permite compartir directamente. El PDF se descargó; puedes adjuntarlo manualmente en WhatsApp desde tus archivos descargados.');
  }
}

window.Reportes = { generarReportePDF, compartirReportePDF };
