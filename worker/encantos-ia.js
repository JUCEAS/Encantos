// encantos-ia.js — Worker de Cloudflare que usa la IA de Cloudflare (Workers AI)
// para ayudar a la app de Encantos:
//
//   POST /ficha   { nombre, cientifico, categoria }
//        -> ficha de cuidados de la planta en español (luz, riego, etc.)
//   POST /textos  { nombre, precio, descripcion, tipoSol, riego, categoria, negocio, oferta }
//        -> 3 textos distintos para publicar en redes sociales
//
// No necesita ninguna clave: usa el "binding" AI de Cloudflare (se agrega en
// Settings → Bindings → Workers AI, con el nombre AI). El plan gratis da
// 10,000 "neuronas" por día, suficiente para cientos de consultas.
//
// Solo responde a la app publicada en juceas.github.io (y a pruebas locales).

const MODELO = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

const ORIGENES_PERMITIDOS = [
  'https://juceas.github.io',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
];

// Mismas opciones que usa la app (js/inventario.js). La IA solo puede elegir de aquí.
const LUZ = ['Sol completo', 'Medio sol', 'Sombra'];
const RIEGO = ['Diario / abundante', '2 a 3 veces por semana', 'Una vez por semana', 'Cada 15 días', 'Una vez al mes'];
const UBICACION = ['Interior', 'Exterior', 'Interior y exterior'];
const DIFICULTAD = ['Fácil', 'Media', 'Requiere experiencia'];
const MASCOTAS = ['Segura para mascotas', 'Tóxica para mascotas', 'No se sabe'];
const CATEGORIAS = [
  'Interior / follaje', 'Con flor / de temporada', 'Cactus', 'Suculentas', 'Orquídeas', 'Bromelias',
  'Helechos', 'Arbustos ornamentales', 'Palmas', 'Árboles ornamentales y frutales',
  'Enredaderas, trepadoras y colgantes', 'Cubresuelos y grama', 'Aromáticas, medicinales y comestibles',
  'Acuáticas', 'Bonsái',
];

const ESQUEMA_FICHA = {
  type: 'object',
  properties: {
    reconocida: { type: 'boolean' },
    nombreComun: { type: 'string' },
    otrosNombres: { type: 'array', items: { type: 'string' } },
    nombreCientifico: { type: 'string' },
    categoria: { type: 'string', enum: CATEGORIAS },
    tipoSol: { type: 'string', enum: LUZ },
    riego: { type: 'string', enum: RIEGO },
    ubicacion: { type: 'string', enum: UBICACION },
    dificultad: { type: 'string', enum: DIFICULTAD },
    mascotas: { type: 'string', enum: MASCOTAS },
    tamanoAdulto: { type: 'string' },
    paraPrincipiantes: { type: 'boolean' },
    pocaLuz: { type: 'boolean' },
    descripcion: { type: 'string' },
  },
  required: ['reconocida', 'nombreComun', 'nombreCientifico', 'categoria', 'tipoSol', 'riego', 'ubicacion',
    'dificultad', 'mascotas', 'tamanoAdulto', 'paraPrincipiantes', 'pocaLuz', 'descripcion'],
};

const ESQUEMA_TEXTOS = {
  type: 'object',
  properties: { textos: { type: 'array', items: { type: 'string' } } },
  required: ['textos'],
};

function cabecerasCors(origen) {
  return {
    'Access-Control-Allow-Origin': origen,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function responder(datos, estado, origen) {
  return new Response(JSON.stringify(datos), {
    status: estado,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...cabecerasCors(origen) },
  });
}

// Recorta los textos que manda la app para que nadie la use para otra cosa
function limpio(t, max = 300) {
  return String(t ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

async function preguntarIA(env, sistema, usuario, esquema) {
  const r = await env.AI.run(MODELO, {
    messages: [
      { role: 'system', content: sistema },
      { role: 'user', content: usuario },
    ],
    response_format: { type: 'json_schema', json_schema: esquema },
    max_tokens: 900,
    temperature: 0.6,
  });
  const resp = r && r.response;
  return typeof resp === 'string' ? JSON.parse(resp) : resp;
}

async function ficha(env, cuerpo) {
  const nombre = limpio(cuerpo.nombre, 80);
  const cientifico = limpio(cuerpo.cientifico, 80);
  const categoria = limpio(cuerpo.categoria, 60);
  if (!nombre && !cientifico) throw Object.assign(new Error('Falta el nombre de la planta.'), { estado: 400 });

  const sistema =
    'Eres un experto en plantas ornamentales de un vivero en Olancho, Honduras (clima tropical cálido, ' +
    'época lluviosa de mayo a octubre y seca de noviembre a abril). Respondes SIEMPRE en español de Honduras, ' +
    'sencillo y claro. Das cuidados prácticos para ese clima. Si no reconoces la planta con seguridad, ' +
    'pon reconocida=false y llena lo demás con lo más probable. Si no estás seguro de si es tóxica para ' +
    'perros y gatos, usa "No se sabe". La descripción: 2 o 3 oraciones atractivas para un cliente, ' +
    'que digan cómo es la planta y por qué conviene tenerla, sin inventar precios ni ofertas. ' +
    'tamanoAdulto: texto corto como "40 a 80 cm".';
  const usuario =
    `Planta: ${nombre || '(sin nombre común)'}` +
    (cientifico ? `\nNombre científico: ${cientifico}` : '') +
    (categoria ? `\nCategoría que le pusimos: ${categoria}` : '') +
    '\nDame su ficha de cuidados.';

  const d = await preguntarIA(env, sistema, usuario, ESQUEMA_FICHA);
  if (!d || typeof d !== 'object') throw new Error('La IA no devolvió una ficha.');
  // Se valida contra las listas por si el modelo se sale de las opciones
  const de = (lista, v) => (lista.includes(v) ? v : '');
  return {
    reconocida: d.reconocida !== false,
    nombreComun: limpio(d.nombreComun, 80),
    otrosNombres: (Array.isArray(d.otrosNombres) ? d.otrosNombres : []).map((x) => limpio(x, 60)).filter(Boolean).slice(0, 4),
    nombreCientifico: limpio(d.nombreCientifico, 80),
    categoria: de(CATEGORIAS, d.categoria),
    tipoSol: de(LUZ, d.tipoSol),
    riego: de(RIEGO, d.riego),
    ubicacion: de(UBICACION, d.ubicacion),
    dificultad: de(DIFICULTAD, d.dificultad),
    mascotas: d.mascotas === 'No se sabe' ? '' : de(MASCOTAS, d.mascotas),
    tamanoAdulto: limpio(d.tamanoAdulto, 40),
    paraPrincipiantes: !!d.paraPrincipiantes,
    pocaLuz: !!d.pocaLuz,
    descripcion: limpio(d.descripcion, 500),
  };
}

async function textos(env, cuerpo) {
  const p = {
    nombre: limpio(cuerpo.nombre, 80),
    precio: limpio(cuerpo.precio, 20),
    descripcion: limpio(cuerpo.descripcion, 400),
    tipoSol: limpio(cuerpo.tipoSol, 40),
    riego: limpio(cuerpo.riego, 40),
    categoria: limpio(cuerpo.categoria, 60),
    negocio: limpio(cuerpo.negocio, 40) || 'Encantos',
    oferta: !!cuerpo.oferta,
  };
  if (!p.nombre) throw Object.assign(new Error('Falta el nombre del producto.'), { estado: 400 });

  const sistema =
    `Escribes publicaciones para Facebook, Instagram y estados de WhatsApp de "${p.negocio}", un vivero ` +
    'de plantas ornamentales en Olancho, Honduras. Español hondureño cercano y alegre (puedes usar "vos" ' +
    'o "usted", pero no "tú" de España). Cada texto: máximo 60 palabras, 2 a 4 emojis, un gancho en la ' +
    'primera línea, un dato de cuidado, el precio tal como te lo doy, una invitación a escribir por ' +
    'WhatsApp y al final 3 a 5 hashtags (incluye #Olancho y #PlantasHonduras). No inventes descuentos, ' +
    'envíos gratis ni datos que no te doy. NO pongas enlaces: la app los agrega. Haz 3 textos con ' +
    'estilos distintos: 1) vendedor directo, 2) consejo o dato curioso, 3) emotivo o para regalo.';
  const usuario =
    `Producto: ${p.nombre}\nCategoría: ${p.categoria}\nPrecio: ${p.precio}` +
    (p.oferta ? '\nEstá en OFERTA.' : '') +
    (p.tipoSol ? `\nLuz: ${p.tipoSol}` : '') +
    (p.riego ? `\nRiego: ${p.riego}` : '') +
    (p.descripcion ? `\nDescripción: ${p.descripcion}` : '');

  const d = await preguntarIA(env, sistema, usuario, ESQUEMA_TEXTOS);
  const lista = (d && Array.isArray(d.textos) ? d.textos : [])
    .map((t) => String(t || '').trim().slice(0, 900)).filter(Boolean).slice(0, 3);
  if (!lista.length) throw new Error('La IA no devolvió textos.');
  return { textos: lista };
}

export default {
  async fetch(request, env) {
    const origen = request.headers.get('Origin') || '';
    const permitido = ORIGENES_PERMITIDOS.includes(origen);
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: permitido ? 204 : 403, headers: permitido ? cabecerasCors(origen) : {} });
    }
    if (request.method === 'GET' && url.pathname === '/') {
      return new Response('Encantos IA funcionando ✅', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
    if (!permitido) return new Response('No autorizado', { status: 403 });
    if (request.method !== 'POST') return responder({ error: 'Usa POST.' }, 405, origen);
    if (!env.AI) {
      return responder({ error: 'Falta conectar la IA: en Cloudflare ve a Settings → Bindings → Add → Workers AI y ponle el nombre AI.' }, 500, origen);
    }

    let cuerpo;
    try { cuerpo = await request.json(); } catch { return responder({ error: 'Datos inválidos.' }, 400, origen); }

    try {
      if (url.pathname === '/ficha') return responder(await ficha(env, cuerpo), 200, origen);
      if (url.pathname === '/textos') return responder(await textos(env, cuerpo), 200, origen);
      return responder({ error: 'Ruta no encontrada.' }, 404, origen);
    } catch (err) {
      const msj = String(err && err.message || err);
      const limite = /neuron|limit|429|capacity/i.test(msj);
      return responder({
        error: err.estado ? msj
          : limite ? 'Se acabó el uso gratis de IA de hoy. Vuelve a intentar mañana.'
          : 'La IA no pudo responder: ' + msj.slice(0, 200),
      }, err.estado || (limite ? 429 : 502), origen);
    }
  },
};
