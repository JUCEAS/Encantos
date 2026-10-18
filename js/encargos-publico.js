// encargos-publico.js — Página de plantas por encargo que ven los clientes (encargos.html).
//
// No inicia sesión: solo lee dos cosas públicas de Firestore, el catálogo
// visible y los datos del negocio. Todo lo demás (clientes, costos, ventas,
// pedidos) está protegido por las reglas y esta página nunca lo toca.
// Los pedidos no se guardan aquí: el botón abre WhatsApp con el mensaje listo.

(function () {
  firebase.initializeApp(firebaseConfig);
  const db = firebase.firestore();

  const estado = { items: [], negocio: {} };

  const $ = (id) => document.getElementById(id);

  // Crea elementos con textContent (nada de innerHTML con datos de la base).
  function h(etiqueta, propiedades, ...hijos) {
    const nodo = document.createElement(etiqueta);
    Object.entries(propiedades || {}).forEach(([clave, valor]) => {
      if (clave === 'class') nodo.className = valor;
      else if (clave === 'text') nodo.textContent = valor;
      else nodo.setAttribute(clave, valor);
    });
    hijos.flat().forEach((hijo) => {
      if (hijo) nodo.appendChild(typeof hijo === 'string' ? document.createTextNode(hijo) : hijo);
    });
    return nodo;
  }

  function dinero(valor) {
    return 'L. ' + (Number(valor) || 0).toFixed(2);
  }

  // Deja solo los dígitos; si son 8 (número hondureño), agrega el 504.
  function numeroWhatsapp(crudo) {
    const digitos = String(crudo || '').replace(/\D/g, '');
    if (!digitos) return '';
    return digitos.length === 8 ? '504' + digitos : digitos;
  }

  function enlaceWhatsapp(item, cantidad) {
    const numero = numeroWhatsapp(estado.negocio.whatsapp);
    if (!numero) return '';
    const precio = item.precio ? ` (${dinero(item.precio)} c/u)` : '';
    const mensaje =
      `Hola, me gustaría encargar: ${cantidad} x ${item.nombre}${precio}. ` +
      '¿Cuándo podrían tenerla disponible?';
    return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
  }

  function crearTarjeta(item) {
    let cantidad = 1;

    const foto = item.foto
      ? h('img', { class: 'foto', src: item.foto, alt: item.nombre, loading: 'lazy' })
      : h('div', { class: 'sin-foto', text: '🌿' });

    const cuidados = [item.tipoSol ? '☀️ ' + item.tipoSol : '', item.riego ? '💧 ' + item.riego : '']
      .filter(Boolean)
      .join('  ·  ');

    const etiquetaCantidad = h('span', { text: '1' });
    const menos = h('button', { type: 'button', 'aria-label': 'Menos', text: '−' });
    const mas = h('button', { type: 'button', 'aria-label': 'Más', text: '+' });

    const enlace = enlaceWhatsapp(item, 1);
    const boton = enlace
      ? h('a', { class: 'btn-whatsapp', href: enlace, target: '_blank', rel: 'noopener', text: 'Encargar por WhatsApp' })
      : null;

    function actualizar() {
      etiquetaCantidad.textContent = String(cantidad);
      if (boton) boton.setAttribute('href', enlaceWhatsapp(item, cantidad));
    }
    menos.addEventListener('click', () => { if (cantidad > 1) { cantidad -= 1; actualizar(); } });
    mas.addEventListener('click', () => { if (cantidad < 99) { cantidad += 1; actualizar(); } });

    return h('article', { class: 'tarjeta' },
      foto,
      h('div', { class: 'cuerpo' },
        item.categoria ? h('span', { class: 'chip', text: item.categoria }) : null,
        h('h3', { text: item.nombre }),
        item.descripcion ? h('p', { class: 'descripcion', text: item.descripcion }) : null,
        cuidados ? h('p', { class: 'cuidados', text: cuidados }) : null,
        item.tiempoEntrega ? h('p', { class: 'entrega', text: '⏱ Entrega: ' + item.tiempoEntrega }) : null,
        h('p', { class: 'precio', text: item.precio ? dinero(item.precio) : 'Consultar precio' }),
        boton
          ? h('div', { class: 'pedir' }, h('div', { class: 'cantidad' }, menos, etiquetaCantidad, mas), boton)
          : null
      )
    );
  }

  function pintarCatalogo() {
    const texto = $('buscar').value.trim().toLowerCase();
    const categoria = $('categoria').value;

    const visibles = estado.items.filter((i) => {
      if (categoria && i.categoria !== categoria) return false;
      if (!texto) return true;
      return (
        (i.nombre || '').toLowerCase().includes(texto) ||
        (i.descripcion || '').toLowerCase().includes(texto)
      );
    });

    const rejilla = $('rejilla');
    rejilla.textContent = '';
    visibles.forEach((i) => rejilla.appendChild(crearTarjeta(i)));

    const mensaje = $('estado');
    if (estado.items.length === 0) {
      mensaje.textContent = 'Pronto agregaremos plantas al catálogo.';
      mensaje.style.display = 'block';
    } else if (visibles.length === 0) {
      mensaje.textContent = 'No encontramos plantas con esa búsqueda.';
      mensaje.style.display = 'block';
    } else {
      mensaje.style.display = 'none';
    }
  }

  function pintarCuenta() {
    const n = estado.negocio;
    const bloque = $('bloqueCuenta');
    const hayDatos = n.mostrarCuenta !== false && (n.banco || n.numeroCuenta);
    if (!hayDatos) { bloque.style.display = 'none'; return; }

    bloque.textContent = '';
    bloque.appendChild(h('h2', { text: '¿Cómo apartar tu encargo?' }));
    bloque.appendChild(h('p', {
      text: n.mensajeAdelanto || 'Para confirmar tu encargo se puede dejar un adelanto por transferencia o depósito.',
    }));

    const datos = h('dl');
    [
      ['Banco', n.banco],
      ['Tipo de cuenta', n.tipoCuenta],
      ['Número de cuenta', n.numeroCuenta],
      ['Titular', n.titularCuenta],
    ].forEach(([etiqueta, valor]) => {
      if (valor) { datos.appendChild(h('dt', { text: etiqueta })); datos.appendChild(h('dd', { text: valor })); }
    });
    bloque.appendChild(datos);

    if (n.numeroCuenta) {
      const copiar = h('button', { type: 'button', text: 'Copiar número de cuenta' });
      copiar.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(n.numeroCuenta);
          copiar.textContent = '¡Copiado!';
        } catch (err) {
          copiar.textContent = 'Mantén presionado el número para copiarlo';
        }
      });
      bloque.appendChild(copiar);
    }
    bloque.style.display = 'block';
  }

  function llenarCategorias() {
    const select = $('categoria');
    const categorias = [...new Set(estado.items.map((i) => i.categoria).filter(Boolean))].sort();
    select.textContent = '';
    select.appendChild(h('option', { value: '', text: 'Todas' }));
    categorias.forEach((c) => select.appendChild(h('option', { value: c, text: c })));
    $('filtros').style.display = estado.items.length > 0 ? 'flex' : 'none';
  }

  function mostrarError() {
    const mensaje = $('estado');
    mensaje.style.display = 'block';
    mensaje.textContent = 'No pudimos cargar el catálogo. Revisa tu conexión a internet.';
    const reintentar = h('div', null, h('button', { type: 'button', text: 'Intentar de nuevo' }));
    reintentar.firstChild.addEventListener('click', cargar);
    mensaje.appendChild(reintentar);
  }

  async function cargar() {
    $('estado').style.display = 'block';
    $('estado').textContent = 'Cargando catálogo...';
    try {
      const [negocioDoc, catalogoSnap] = await Promise.all([
        db.collection('configuracion').doc('negocio').get().catch(() => null),
        // El filtro visible==true es obligatorio: las reglas solo dejan leer lo visible.
        db.collection('catalogo').where('visible', '==', true).get(),
      ]);

      estado.negocio = negocioDoc && negocioDoc.exists ? negocioDoc.data() : {};
      estado.items = catalogoSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));

      if (estado.negocio.nombreNegocio) {
        $('tituloNegocio').textContent = estado.negocio.nombreNegocio;
        document.title = 'Catálogo — ' + estado.negocio.nombreNegocio;
      }
      llenarCategorias();
      pintarCatalogo();
      pintarCuenta();
    } catch (err) {
      console.error('Error cargando el catálogo', err);
      mostrarError();
    }
  }

  $('buscar').addEventListener('input', pintarCatalogo);
  $('categoria').addEventListener('change', pintarCatalogo);

  cargar();
})();
