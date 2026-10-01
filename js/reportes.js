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
  // Margen = ganancia ÷ total vendido (de cada L.100 vendidos, cuánto se gana)
  const margen = totalVendido > 0 ? (totalGanancia / totalVendido) * 100 : 0;
  doc.text(`Margen de ganancia: ${totalVendido > 0 ? margen.toFixed(1) + '%' : '—'}`, margenIzq, y);
  y += 5;
  doc.text(`Número de ventas: ${ventas.length}`, margenIzq, y);
  y += 5;
  try {
    const { compras, total } = await Compras.totalComprado({ desde, hasta });
    doc.text(`Compras de mercadería: ${formatoLempiras(total)} (${compras.length} compra${compras.length === 1 ? '' : 's'})`, margenIzq, y);
    y += 5;
    // Caja: lo que entró por ventas menos lo que salió en compras. No es lo
    // mismo que la ganancia: lo comprado puede no haberse vendido todavía.
    doc.text(`Vendido - Compras (caja del período): ${formatoLempiras(totalVendido - total)}`, margenIzq, y);
    y += 5;
  } catch (e) { console.warn('No se pudieron leer las compras', e); }
  y += 5;

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
// Reporte de COMPRAS
// ---------------------------------------------------------
function textoPeriodo(desde, hasta, todo) {
  return desde || hasta
    ? `Periodo: ${desde ? new Date(desde + 'T00:00:00').toLocaleDateString() : '...'} a ${hasta ? new Date(hasta + 'T00:00:00').toLocaleDateString() : 'hoy'}`
    : todo;
}

async function construirPDFCompras({ desde = null, hasta = null } = {}) {
  const doc = nuevoDocPDF('Reporte de Compras');
  const margenIzq = 14;
  let y = 32;
  const { compras, total } = await Compras.totalComprado({ desde, hasta });
  const nuevaPagina = (limite) => { if (y > limite) { doc.addPage(); y = 18; } };

  doc.setFontSize(10);
  doc.text(textoPeriodo(desde, hasta, 'Periodo: todas las compras registradas'), margenIzq, y);
  y += 10;
  doc.setFontSize(12);
  doc.text('Resumen', margenIzq, y);
  y += 6;
  doc.setFontSize(10);
  const unidades = compras.reduce((s, c) => s + Compras.unidadesDe(c), 0);
  const transporte = compras.reduce((s, c) => s + (Number(c.transporte) || 0), 0);
  doc.text(`Total comprado: ${formatoLempiras(total)}`, margenIzq, y); y += 5;
  if (transporte > 0) { doc.text(`  de eso, transporte: ${formatoLempiras(transporte)} (ya incluido en el costo de las plantas)`, margenIzq, y); y += 5; }
  doc.text(`Número de compras: ${compras.length}`, margenIzq, y); y += 5;
  doc.text(`Unidades compradas: ${unidades}`, margenIzq, y); y += 10;

  if (compras.length === 0) {
    doc.text('No hay compras en este período.', margenIzq, y);
    return { doc, nombreArchivo: `encantos-compras-${(desde || new Date().toISOString()).slice(0, 7)}.pdf` };
  }

  // Por producto: cada línea de cada factura, con su parte del transporte
  const agrupar = (registros, clave, cantidad, valor) => {
    const g = {};
    registros.forEach((r) => {
      const k = clave(r) || 'Sin proveedor';
      if (!g[k]) g[k] = { cantidad: 0, total: 0 };
      g[k].cantidad += cantidad(r);
      g[k].total += valor(r);
    });
    return Object.entries(g).map(([nombre, d]) => ({ nombre, ...d })).sort((a, b) => b.total - a.total);
  };
  const todasLasLineas = compras.flatMap((c) => Compras.lineasDe(c));

  const tabla = (titulo, filas, encabezado) => {
    nuevaPagina(255);
    doc.setFontSize(12);
    doc.text(titulo, margenIzq, y); y += 6;
    doc.setFontSize(9);
    doc.text(encabezado, margenIzq, y); doc.text('Cant.', 130, y); doc.text('Total', 160, y);
    y += 4; doc.line(margenIzq, y, 196, y); y += 4;
    filas.forEach((f) => {
      nuevaPagina(280);
      doc.text(String(f.nombre).substring(0, 55), margenIzq, y);
      doc.text(String(f.cantidad), 130, y);
      doc.text(formatoLempiras(f.total), 160, y);
      y += 5;
    });
    y += 8;
  };
  tabla('Por producto (costo con transporte)', agrupar(todasLasLineas, (l) => l.nombreProducto, (l) => Number(l.cantidad) || 0,
    (l) => (Number(l.subtotal) || 0) + (Number(l.transporte) || 0)), 'Producto');
  tabla('Por proveedor', agrupar(compras, (c) => c.nombreProveedor, (c) => Compras.unidadesDe(c), (c) => Number(c.total) || 0), 'Proveedor');

  nuevaPagina(255);
  doc.setFontSize(12);
  doc.text('Detalle de compras', margenIzq, y); y += 6;
  doc.setFontSize(9);
  doc.text('Fecha', margenIzq, y); doc.text('Producto', 38, y); doc.text('Proveedor', 95, y);
  doc.text('Cant.', 140, y); doc.text('C/u', 155, y); doc.text('Total', 177, y);
  y += 4; doc.line(margenIzq, y, 196, y); y += 4;
  compras.slice().reverse().forEach((c) => {
    const lineas = Compras.lineasDe(c);
    lineas.forEach((l, i) => {
      nuevaPagina(280);
      if (i === 0) {
        doc.text(new Date(c.fecha).toLocaleDateString(), margenIzq, y);
        doc.text(((c.nombreProveedor || '-') + (c.numeroFactura ? ' #' + c.numeroFactura : '')).substring(0, 24), 95, y);
      }
      doc.text((l.nombreProducto || '').substring(0, 28), 38, y);
      doc.text(String(l.cantidad), 140, y);
      doc.text((Number(l.costoUnitario) || 0).toFixed(2), 155, y);
      doc.text((Number(l.subtotal) || 0).toFixed(2), 177, y);
      y += 5;
    });
    if (Number(c.transporte) > 0) {
      nuevaPagina(280);
      doc.text('Transporte', 38, y); doc.text((Number(c.transporte) || 0).toFixed(2), 177, y); y += 5;
      // Cuánto se le sumó a cada planta por el transporte (por unidad)
      nuevaPagina(280);
      doc.text('Transporte sumado a cada planta (por unidad):', 38, y); y += 5;
      lineas.forEach((l) => {
        nuevaPagina(280);
        const inc = Math.max(0, (Number(l.costoFinalUnit) || 0) - (Number(l.costoUnitario) || 0));
        doc.text(`${(l.nombreProducto || '').substring(0, 30)}: ${(Number(l.costoUnitario) || 0).toFixed(2)} + ${inc.toFixed(2)} = ${(Number(l.costoFinalUnit) || 0).toFixed(2)}`, 42, y);
        y += 5;
      });
    }
    if (c.lineas) {
      nuevaPagina(280);
      doc.text('Total factura', 38, y); doc.text((Number(c.total) || 0).toFixed(2), 177, y); y += 3;
      doc.line(38, y, 196, y); y += 4;
    }
  });

  const nombreArchivo = `encantos-compras-${(desde || new Date().toISOString()).slice(0, 7)}.pdf`;
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

async function generarReporteComprasPDF(opciones) { return descargarPDF(construirPDFCompras, opciones); }
async function compartirReporteComprasPDF(opciones) { return compartirPDF(construirPDFCompras, opciones); }

async function generarReporteClientesPDF() { return descargarPDF(construirPDFClientes); }
async function compartirReporteClientesPDF() { return compartirPDF(construirPDFClientes); }

async function generarReporteInventarioPDF() { return descargarPDF(construirPDFInventario); }
async function compartirReporteInventarioPDF() { return compartirPDF(construirPDFInventario); }

async function generarReporteProveedoresPDF() { return descargarPDF(construirPDFProveedores); }
async function compartirReporteProveedoresPDF() { return compartirPDF(construirPDFProveedores); }

window.Reportes = {
  generarReporteVentasPDF,
  compartirReporteVentasPDF,
  generarReporteComprasPDF,
  compartirReporteComprasPDF,
  generarReporteClientesPDF,
  compartirReporteClientesPDF,
  generarReporteInventarioPDF,
  compartirReporteInventarioPDF,
  generarReporteProveedoresPDF,
  compartirReporteProveedoresPDF,
};
