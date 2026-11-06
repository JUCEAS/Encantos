// finanzas.js — Estado financiero automático. No se escribe nada a mano: todo
// sale de las ventas, compras y gastos que ya están registrados.
//
// ESTADO DE RESULTADOS (¿ganamos o perdimos?)
//   Ventas
// − Costo de lo vendido (lo que costaron las plantas que se vendieron)
// = Utilidad bruta
// − Gastos del negocio
// = UTILIDAD NETA
//
// FLUJO DE CAJA (¿cuánto dinero entró y salió?)
//   Entró: ventas.  Salió: compras de mercadería + gastos.
//   Puede ser negativo en un mes en que se compró mucho inventario aunque se
//   haya ganado: ese dinero quedó en plantas, no se perdió.

function r2(n) { return Math.round((Number(n) || 0) * 100) / 100; }

function claveDia(fechaIso) {
  const d = new Date(fechaIso);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// mes = 'AAAA-MM'. Devuelve el estado completo del mes, con acumulado día a día.
async function estadoDelMes(mes) {
  const [anio, m] = mes.split('-').map(Number);
  const ultimoDia = new Date(anio, m, 0).getDate();
  const desde = mes + '-01';
  const hasta = mes + '-' + String(ultimoDia).padStart(2, '0');

  const [ventas, compras, gastos, productos, usuarios] = await Promise.all([
    Ventas.listarVentas({ desde, hasta }),
    Compras.listarCompras({ desde, hasta }),
    Gastos.listarGastos({ desde, hasta }),
    DB.obtenerTodos(DB.STORES.productos),
    DB.obtenerTodos(DB.STORES.usuarios).catch(() => []),
  ]);

  const totalVentas = r2(ventas.reduce((s, v) => s + (Number(v.total) || 0), 0));
  const utilidadBruta = r2(ventas.reduce((s, v) => s + (Number(v.ganancia) || 0), 0));
  const costoVendido = r2(totalVentas - utilidadBruta);
  const totalGastos = r2(gastos.reduce((s, g) => s + (Number(g.monto) || 0), 0));
  const utilidadNeta = r2(utilidadBruta - totalGastos);
  const totalCompras = r2(compras.reduce((s, c) => s + (Number(c.total) || 0), 0));
  const flujo = r2(totalVentas - totalCompras - totalGastos);
  const ventasSinCosto = ventas.filter((v) => !(Number(v.costoUnitario) > 0)).length;

  // Gastos por categoría
  const porCat = {};
  gastos.forEach((g) => {
    const c = Gastos.categoriaGasto(g.categoria);
    if (!porCat[c.id]) porCat[c.id] = { ...c, total: 0, cantidad: 0 };
    porCat[c.id].total += Number(g.monto) || 0;
    porCat[c.id].cantidad++;
  });
  const gastosPorCategoria = Object.values(porCat).map((c) => ({ ...c, total: r2(c.total) })).sort((a, b) => b.total - a.total);

  // Día a día, con acumulado del mes (corte mensual: el 1 vuelve a empezar)
  const dias = {};
  const dia = (k) => (dias[k] = dias[k] || { ventas: 0, utilidadBruta: 0, gastos: 0, compras: 0 });
  ventas.forEach((v) => { const d = dia(claveDia(v.fecha)); d.ventas += Number(v.total) || 0; d.utilidadBruta += Number(v.ganancia) || 0; });
  gastos.forEach((g) => { dia(claveDia(g.fecha)).gastos += Number(g.monto) || 0; });
  compras.forEach((c) => { dia(claveDia(c.fecha)).compras += Number(c.total) || 0; });
  let acumulado = 0;
  let ventasAcum = 0;
  const porDia = Object.keys(dias).sort().map((k) => {
    const d = dias[k];
    const neta = d.utilidadBruta - d.gastos;
    acumulado += neta;
    ventasAcum += d.ventas;
    return {
      fecha: k,
      ventas: r2(d.ventas),
      utilidadBruta: r2(d.utilidadBruta),
      gastos: r2(d.gastos),
      compras: r2(d.compras),
      utilidadNeta: r2(neta),
      acumulado: r2(acumulado),
      ventasAcumuladas: r2(ventasAcum),
    };
  });

  // Ventas por persona (quién vendió)
  const nombres = {};
  usuarios.forEach((u) => { nombres[u.id] = u.nombre || u.id; });
  // Las dueñas no están en "usuarios": su nombre sale de las vendedoras del catálogo
  try {
    const config = await Catalogo.obtenerConfig();
    (config.vendedores || []).forEach((v) => { if (v.correo && v.nombre && !nombres[v.correo.toLowerCase()]) nombres[v.correo.toLowerCase()] = v.nombre; });
  } catch (e) { /* sin datos del catálogo */ }
  const porPersona = {};
  ventas.forEach((v) => {
    const k = String(v.vendidaPor || '').toLowerCase() || '(sin registrar)';
    if (!porPersona[k]) porPersona[k] = { correo: k, nombre: nombres[k] || (k === '(sin registrar)' ? 'Ventas anteriores (sin nombre)' : k.split('@')[0]), total: 0, ventas: 0, unidades: 0 };
    porPersona[k].total += Number(v.total) || 0;
    porPersona[k].ventas++;
    porPersona[k].unidades += Number(v.cantidad) || 0;
  });
  const ventasPorPersona = Object.values(porPersona).map((p) => ({ ...p, total: r2(p.total) })).sort((a, b) => b.total - a.total);

  // Valor del inventario HOY (existencias × costo). No depende del mes.
  const conStock = productos.filter((p) => (Number(p.stock) || 0) > 0);
  const valorInventarioCosto = r2(conStock.reduce((s, p) => s + (Number(p.stock) || 0) * (Number(p.costo) || 0), 0));
  const valorInventarioVenta = r2(conStock.reduce((s, p) => s + (Number(p.stock) || 0) * (Number(p.precio) || 0), 0));
  const productosSinCosto = conStock.filter((p) => !(Number(p.costo) > 0)).length;

  return {
    mes, desde, hasta,
    totalVentas, costoVendido, utilidadBruta, totalGastos, utilidadNeta,
    margenBruto: totalVentas > 0 ? (utilidadBruta / totalVentas) * 100 : null,
    margenNeto: totalVentas > 0 ? (utilidadNeta / totalVentas) * 100 : null,
    totalCompras, flujo,
    numeroVentas: ventas.length, numeroGastos: gastos.length, numeroCompras: compras.length,
    ventasSinCosto,
    gastosPorCategoria, porDia, ventasPorPersona,
    valorInventarioCosto, valorInventarioVenta, productosSinCosto,
  };
}

window.Finanzas = { estadoDelMes };
