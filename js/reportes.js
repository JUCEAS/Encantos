// reportes.js — Generación de reportes PDF (ventas, clientes, inventario)
// Usa jsPDF, incluido localmente para funcionar sin internet.

function formatoLempiras(valor) {
  return 'L. ' + (valor || 0).toFixed(2);
}

function nuevoDocPDF(titulo) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text('Encantos - ' + titulo, 14, 18);
  doc.setFontSize(10);
  doc.text('Generado el: ' + new Date().toLocaleString(), 14, 25);
  return doc;
}

// ---------------------------------------------------------
// Reporte de VENTAS
// ---------------------------------------------------------
async function construirPDFVentas({ desde = null, hasta = null } = {}) {
  const doc = nuevoDocPDF('Reporte de Ventas');
  const margenIzq = 14;
  let y = 32;

  const { ventas, totalVendido, totalGanancia, masVendidos } = await Ventas.resumen({ desde, hasta });

  doc.setFontSize(10);
  const rango = desde || hasta
    ? `Periodo: ${desde ? new Date(desde + 'T00:00:00').toLocaleDateString() : '...'} a ${hasta ? new Date(hasta + 'T00:00:00').toLocaleDateString() : 'hoy'}`
    : 'Periodo: todas las ventas registradas';
  doc.text(rango, margenIzq, y);
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

  const nombreArchivo = `encantos-ventas-${new Date().toISOString().slice(0, 10)}.pdf`;
  return { doc, nombreArchivo };
}

// ---------------------------------------------------------
// Reporte de CLIENTES
// ---------------------------------------------------------
async function construirPDFClientes() {
  const doc = nuevoDocPDF('Lista de Clientes');
  const margenIzq = 14;
  let y = 32;

  const clientes = await Clientes.listarClientes();

  doc.setFontSize(10);
  doc.text(`Total de clientes registrados: ${clientes.length}`, margenIzq, y);
  y += 10;

  doc.setFontSize(9);
  doc.text('Nombre', margenIzq, y);
  doc.text('Celular', 100, y);
  doc.text('Cliente desde', 145, y);
  y += 4;
  doc.line(margenIzq, y, 196, y);
  y += 4;

  clientes.forEach((c) => {
    if (y > 280) { doc.addPage(); y = 18; }
    doc.text((c.nombre || '').substring(0, 38), margenIzq, y);
    doc.text(c.celular || '-', 100, y);
    doc.text(c.creadoEl ? new Date(c.creadoEl).toLocaleDateString() : '-', 145, y);
    y += 6;
    if (c.notas) {
      doc.setFontSize(8);
      doc.text('Notas: ' + c.notas.substring(0, 70), margenIzq + 2, y);
      doc.setFontSize(9);
      y += 5;
    }
  });

  const nombreArchivo = `encantos-clientes-${new Date().toISOString().slice(0, 10)}.pdf`;
  return { doc, nombreArchivo };
}

// ---------------------------------------------------------
// Reporte de PROVEEDORES
// ---------------------------------------------------------
async function construirPDFProveedores() {
  const doc = nuevoDocPDF('Lista de Proveedores');
  const margenIzq = 14;
  let y = 32;

  const proveedores = await Proveedores.listarProveedores();

  doc.setFontSize(10);
  doc.text(`Total de proveedores registrados: ${proveedores.length}`, margenIzq, y);
  y += 10;

  proveedores.forEach((p) => {
    if (y > 265) { doc.addPage(); y = 18; }
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text(p.nombre || '', margenIzq, y);
    doc.setFont(undefined, 'normal');
    y += 5;
    doc.setFontSize(9);
    if (p.empresa) { doc.text('Empresa: ' + p.empresa, margenIzq + 2, y); y += 5; }
    doc.text('Celular: ' + (p.telefono || '-'), margenIzq + 2, y); y += 5;
    if (p.direccion) { doc.text('Dirección: ' + p.direccion.substring(0, 80), margenIzq + 2, y); y += 5; }
    if (p.creadoEl) { doc.text('Proveedor desde: ' + new Date(p.creadoEl).toLocaleDateString(), margenIzq + 2, y); y += 5; }
    y += 3;
    doc.line(margenIzq, y, 196, y);
    y += 6;
  });

  const nombreArchivo = `encantos-proveedores-${new Date().toISOString().slice(0, 10)}.pdf`;
  return { doc, nombreArchivo };
}

// ---------------------------------------------------------
// Reporte de INVENTARIO
// ---------------------------------------------------------
async function construirPDFInventario() {
  const doc = nuevoDocPDF('Reporte de Inventario');
  const margenIzq = 14;
  let y = 32;

  const productos = await Inventario.listarProductos();
  const valorTotalCosto = productos.reduce((s, p) => s + (p.costo || 0) * (p.stock || 0), 0);
  const valorTotalVenta = productos.reduce((s, p) => s + (p.precio || 0) * (p.stock || 0), 0);
  const totalUnidades = productos.reduce((s, p) => s + (p.stock || 0), 0);
  const bajoStock = productos.filter((p) => (p.stock || 0) <= 2);

  doc.setFontSize(10);
  doc.text(`Total de productos distintos: ${productos.length}`, margenIzq, y);
  y += 5;
  doc.text(`Total de unidades en stock: ${totalUnidades}`, margenIzq, y);
  y += 5;
  doc.text(`Valor del inventario (a costo): ${formatoLempiras(valorTotalCosto)}`, margenIzq, y);
  y += 5;
  doc.text(`Valor del inventario (a precio de venta): ${formatoLempiras(valorTotalVenta)}`, margenIzq, y);
  y += 5;
  if (bajoStock.length > 0) {
    doc.text(`Productos con stock bajo (2 o menos): ${bajoStock.length}`, margenIzq, y);
    y += 5;
  }
  y += 5;

  // Resumen por categoría
  const porCategoria = {};
  productos.forEach((p) => {
    const cat = p.categoria || 'Sin categoría';
    if (!porCategoria[cat]) porCategoria[cat] = { unidades: 0, valorCosto: 0 };
    porCategoria[cat].unidades += p.stock || 0;
    porCategoria[cat].valorCosto += (p.costo || 0) * (p.stock || 0);
  });

  doc.setFontSize(12);
  doc.text('Resumen por categoría', margenIzq, y);
  y += 6;
  doc.setFontSize(9);
  doc.text('Categoría', margenIzq, y);
  doc.text('Unidades', 130, y);
  doc.text('Valor (costo)', 160, y);
  y += 4;
  doc.line(margenIzq, y, 196, y);
  y += 4;
  Object.entries(porCategoria).forEach(([cat, datos]) => {
    if (y > 270) { doc.addPage(); y = 18; }
    doc.text(cat.substring(0, 45), margenIzq, y);
    doc.text(String(datos.unidades), 130, y);
    doc.text(formatoLempiras(datos.valorCosto), 160, y);
    y += 5;
  });

  y += 8;
  if (y > 260) { doc.addPage(); y = 18; }
  doc.setFontSize(12);
  doc.text('Detalle de productos', margenIzq, y);
  y += 6;
  doc.setFontSize(9);
  doc.text('Producto', margenIzq, y);
  doc.text('Categoría', 80, y);
  doc.text('Stock', 135, y);
  doc.text('Costo', 155, y);
  doc.text('Precio', 178, y);
  y += 4;
  doc.line(margenIzq, y, 196, y);
  y += 4;

  productos
    .slice()
    .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''))
    .forEach((p) => {
      if (y > 280) { doc.addPage(); y = 18; }
      doc.text((p.nombre || '').substring(0, 30), margenIzq, y);
      doc.text((p.categoria || '').substring(0, 22), 80, y);
      doc.text(String(p.stock ?? 0), 135, y);
      doc.text(formatoLempiras(p.costo), 155, y);
      doc.text(formatoLempiras(p.precio), 178, y);
      y += 5;
    });

  const nombreArchivo = `encantos-inventario-${new Date().toISOString().slice(0, 10)}.pdf`;
  return { doc, nombreArchivo };
}

// ---------------------------------------------------------
// Descargar / compartir (genérico para cualquiera de los 3 reportes)
// ---------------------------------------------------------
async function descargarPDF(constructor, opciones = {}) {
  const { doc, nombreArchivo } = await constructor(opciones);
  doc.save(nombreArchivo);
}

// Abre el menú "Compartir" del teléfono (WhatsApp, correo, imprimir, etc.).
// No necesita internet para abrirse; solo se usaría internet si eliges enviarlo
// por WhatsApp u otra app que sí lo requiera.
async function compartirPDF(constructor, opciones = {}) {
  const { doc, nombreArchivo } = await constructor(opciones);
  const blob = doc.output('blob');
  const archivo = new File([blob], nombreArchivo, { type: 'application/pdf' });

  if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
    await navigator.share({
      files: [archivo],
      title: 'Reporte Encantos',
      text: 'Reporte - Encantos',
    });
  } else {
    // El teléfono no soporta compartir archivos directamente: se descarga
    // y se puede adjuntar manualmente en WhatsApp.
    doc.save(nombreArchivo);
    alert('Tu navegador no permite compartir directamente. El PDF se descargó; puedes adjuntarlo manualmente en WhatsApp desde tus archivos descargados.');
  }
}

async function generarReporteVentasPDF(opciones) { return descargarPDF(construirPDFVentas, opciones); }
async function compartirReporteVentasPDF(opciones) { return compartirPDF(construirPDFVentas, opciones); }

async function generarReporteClientesPDF() { return descargarPDF(construirPDFClientes); }
async function compartirReporteClientesPDF() { return compartirPDF(construirPDFClientes); }

async function generarReporteInventarioPDF() { return descargarPDF(construirPDFInventario); }
async function compartirReporteInventarioPDF() { return compartirPDF(construirPDFInventario); }

async function generarReporteProveedoresPDF() { return descargarPDF(construirPDFProveedores); }
async function compartirReporteProveedoresPDF() { return compartirPDF(construirPDFProveedores); }

window.Reportes = {
  generarReporteVentasPDF,
  compartirReporteVentasPDF,
  generarReporteClientesPDF,
  compartirReporteClientesPDF,
  generarReporteInventarioPDF,
  compartirReporteInventarioPDF,
  generarReporteProveedoresPDF,
  compartirReporteProveedoresPDF,
};
