  // ---- CARDIbot: asistente virtual ----
(function () {
  const fab = document.getElementById('cardibotFab');
  const ventana = document.getElementById('cardibotVentana');
  const btnCerrarChat = document.getElementById('cardibotCerrar');
  const log = document.getElementById('cardibotMensajes');
  const zonaChips = document.getElementById('cardibotSugerencias');
  const formChat = document.getElementById('cardibotForm');
  const entrada = document.getElementById('cardibotEntrada');

  // Datos de la clínica (ajústalos aquí cuando tengas los oficiales)
  const CLINICA = {
    telefono: '(602) 485 7164',
    telefonoLink: 'tel:+576024857164',
    emergencias: '123'
  };

  const SUGERENCIAS = [
    '¿Cómo creo un recordatorio?',
    '¿Cómo agendo una cita prioritaria?',
    '¿Dónde reclamo mis medicamentos?',
    '¿Cómo llego a la clínica?',
    '¿Qué hago si tengo dolor en la herida?',
    'Necesito hablar con alguien'
  ];

  const VISTAS = [panel, agenda, urgencias, citaPrioritaria, farmacias, contactoProfesionales, cuidados, ubicacion];
  function irA(abrir) {
    VISTAS.forEach((s) => { s.hidden = true; });
    document.body.classList.add('vista-interna');
    abrir();
  }

  const ACC = {
    recordatorios: { texto: 'Ir a Citas y recordatorios', fn: () => irA(abrirAgenda) },
    urgencias: { texto: 'Ir a Necesidades urgentes', fn: () => irA(abrirUrgencias) },
    cita: { texto: 'Agendar cita prioritaria', fn: () => irA(abrirCitaPrioritaria) },
    farmacias: { texto: 'Ver puntos Cruz Verde', fn: () => irA(abrirFarmacias) },
    profesionales: { texto: 'Hablar con un profesional', fn: () => irA(abrirProfesionales) },
    ubicacion: { texto: 'Ver ubicación y cómo llegar', fn: () => irA(abrirUbicacion) },
    cuidados: { texto: 'Ver preguntas frecuentes', fn: () => irA(abrirCuidados) },
    llamar: { texto: 'Llamar a la clínica', href: CLINICA.telefonoLink }
  };

  const norm = (t) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

  // ---- Señales de alarma: tienen prioridad sobre cualquier otra respuesta ----
  const RE_URGENTE = /dolor (en |de |del |con )?(el )?(pecho|torax)|presion (en )?(el )?pecho|opresion|falta de aire|no puedo respirar|me ahogo|me cuesta respirar mucho|desmay|perdi el conocimiento|sangrado (abundante|fuerte)|no para de sangrar|no puedo hablar|cara torcida|infarto|derrame|convulsion/;
  const RE_CRISIS = /quitarme la vida|suicid|hacerme dano|no quiero vivir|quiero morir/;

  // ---- Intenciones sobre el uso de la página ----
  const INTENCIONES = [
    { re: /^(hola|buenas|buenos dias|buenas tardes|buenas noches|hey|saludos)\b/,
      r: () => 'Hola, ¿en qué puedo ayudarte? Puedo explicarte cómo usar la página o responder dudas sobre tu recuperación.' },
    { re: /gracias|muy amable|excelente|perfecto/,
      r: () => 'Con gusto. Si tienes otra duda, aquí estaré.' },
    { re: /\b(adios|chao|hasta luego|nos vemos)\b/,
      r: () => 'Hasta pronto. Cuídate mucho.' },
    { re: /quien eres|como te llamas|que eres|que haces|que puedes|para que sirves|^ayuda$|necesito ayuda con la pagina|no entiendo la pagina|como funciona la pagina|como uso la pagina/,
      r: () => 'Soy CARDIbot, el asistente virtual de Latido Seguro. Te explico cómo usar cada sección de la página (recordatorios, citas, medicamentos, ubicación) y respondo dudas generales sobre tus cuidados. No doy diagnósticos ni cambio indicaciones médicas.\n\nPrueba preguntándome, por ejemplo: “¿Cómo creo un recordatorio?”.',
      a: ['recordatorios', 'cuidados'] },
    { re: /(crear|abrir|hacer|sacar).*(cuenta|usuario)|registrar|registro|inscrib/,
      r: () => 'Para crear tu cuenta:\n1. En la pantalla de inicio pulsa “Crear cuenta”.\n2. Escribe tu correo y una contraseña (mínimo 10 caracteres, con mayúscula, minúscula y número).\n3. Pulsa “Continuar con mis datos” y completa nombre, apellido, documento y celular.\n4. Revisa tu correo, escribe el código de seis dígitos y listo.' },
    { re: /olvid.*(contrasena|clave)|perdi.*(contrasena|clave)|recuperar.*(contrasena|clave)|cambiar.*(contrasena|clave)|restablecer/,
      r: () => 'Por ahora la página no tiene una opción automática para recuperar o cambiar la contraseña. Comunícate con la clínica al ' + CLINICA.telefono + ' para recibir ayuda.',
      a: ['llamar'] },
    { re: /contrasena|clave/,
      r: () => 'Tu contraseña debe tener al menos 10 caracteres, con una mayúscula, una minúscula y un número. Puedes pulsar “Mostrar” para ver lo que escribes.' },
    { re: /codigo|verificar|verificacion|no me llega|no llego el correo/,
      r: () => 'Al crear tu cuenta enviamos un código de seis dígitos a tu correo. Vence en 10 minutos y tienes 5 intentos. Si no te llegó, revisa la carpeta de spam y pulsa “Reenviar código” (puedes pedir uno nuevo cada 60 segundos).' },
    { re: /cerrar sesion|salir de la cuenta|desconectarme|salir de mi cuenta/,
      r: () => 'Para cerrar sesión, ve a la pantalla principal (con tus cuatro tarjetas) y pulsa “Cerrar sesión”, arriba a la derecha. Si estás en otra sección, pulsa “Volver” primero.' },
    { re: /(eliminar|borrar|quitar|cancelar).*(recordatorio|aviso|alarma)/,
      r: () => 'Para eliminar un recordatorio: entra a “Citas y recordatorios”, pulsa el día en el calendario y, en la lista “Recordatorios del día”, presiona “Eliminar” junto al que quieres quitar.',
      a: ['recordatorios'] },
    { re: /recordatorio|recordarme|recuerd|alarma|crear mi dieta|cuando me tomo|en que momento hago ejercicio|programar.*(aviso|medicamento)/,
      r: () => 'Para crear un recordatorio:\n1. Entra a “Citas y recordatorios”.\n2. Pulsa el día en el calendario.\n3. Elige qué quieres recordar (cita de control, cita prioritaria, dieta, medicamentos o ejercicio).\n4. Indica la hora, un detalle opcional y cómo quieres recibir el aviso (SMS, correo o WhatsApp) con tu dato de contacto.\n5. Pulsa “Guardar recordatorio”.\n\nLos números verdes en el calendario muestran cuántos recordatorios tienes cada día. La opción “Crear mi dieta” crea un recordatorio de alimentación; la dieta que debes seguir te la indica tu equipo médico.',
      a: ['recordatorios'] },
    { re: /reclamar|reclamo|farmacia|drogueria|cruz verde|dispensa|entreg.*medicament|conseguir.*medicament|donde.*medicament/,
      r: () => 'Para encontrar dónde reclamar tus medicamentos: entra a “Necesidades urgentes” → “¿Dónde reclamar mis medicamentos?”. Verás un mapa con droguerías Cruz Verde en Cali; escribe tu barrio o dirección y pulsa “Encuentra la más cerca de ti”. Antes de ir, confirma con la droguería que dispensan tu medicamento y revisa su horario.',
      a: ['farmacias'] },
    { re: /(agendar|solicitar|pedir|sacar|programar|necesito|quiero).*\bcitas?\b|\bcita prioritaria|\bcita urgente|\bcita de control/,
      r: () => 'Hay dos opciones:\n• Cita prioritaria: “Necesidades urgentes” → “Necesito agendar una cita”. Elige un día disponible, una hora y completa tus datos.\n• Recordatorio de cita de control: en “Citas y recordatorios” puedes anotar la fecha de tus controles y recibir un aviso.\n\nImportante: la solicitud de cita prioritaria todavía no se envía automáticamente a la clínica. Para confirmarla llama al ' + CLINICA.telefono + '.',
      a: ['cita', 'recordatorios', 'llamar'] },
    { re: /hablar con alguien|alguien con quien|psicolog|enfermer|acompanamiento|trabajo social|apoyo emocional|me siento (solo|sola|triste|mal|ansios)|estoy (triste|ansios|preocupad)/,
      r: () => 'Estamos para acompañarte. En “Necesidades urgentes” → “Necesito a alguien con quien hablar” encontrarás profesionales de enfermería, acompañamiento emocional y trabajo social, y la línea de la clínica: ' + CLINICA.telefono + '. Es normal sentir emociones intensas después de una cirugía; hablarlo ayuda.',
      a: ['profesionales', 'llamar'] },
    { re: /visita|visitar|horario de visita|hasta que hora|venir acompanad|ir acompanad|acompanante/,
      r: () => 'Las visitas son hasta las 5 pm, y te recomendamos venir acompañado a la clínica.',
      a: ['ubicacion'] },
    { re: /donde (estan|queda|esta)|ubicacion|ubicados|direccion|como llego|como llegar|llegar a la clinica|\bmapa\b|\bruta\b/,
      r: () => 'En “Dónde estamos ubicados” ves el mapa de la clínica. Escribe tu dirección o barrio en “¿En dónde te encuentras ubicado?” y pulsa “Cómo llegar” para abrir la ruta en Google Maps. Recuerda venir acompañado; las visitas son hasta las 5 pm.',
      a: ['ubicacion'] },
    { re: /contacto|contactar|telefono|\bllamar\b|whatsapp|instagram|gmail|correo de la clinica|numero de la clinica|comunicarme/,
      r: () => 'Puedes llamar a la línea general de la clínica: ' + CLINICA.telefono + '. Los íconos de WhatsApp, Instagram, Gmail y X de la barra inferior aún están en configuración.',
      a: ['llamar', 'profesionales'] },
    { re: /^(cuidados|preguntas frecuentes|faq|recomendaciones|conoce mas)|donde (veo|encuentro|estan) .*(cuidados|preguntas|recomendaciones)/,
      r: () => 'En “Conoce más sobre tus cuidados” encuentras preguntas frecuentes sobre señales de alarma, herida, medicamentos, alimentación, actividad física, sueño y emociones. Puedes escribir en el buscador la inquietud que tengas.',
      a: ['cuidados'] },
    { re: /urgente|urgencias|necesidades urgentes/,
      r: () => '“Necesidades urgentes” reúne tres ayudas: agendar una cita, saber dónde reclamar tus medicamentos y hablar con alguien del equipo. Si tienes dolor en el pecho, falta de aire o un desmayo, no uses la página: llama al ' + CLINICA.emergencias + ' o acude a urgencias.',
      a: ['urgencias'] }
  ];

  // ---- Búsqueda en las preguntas frecuentes de "Cuidados" ----
  const PARADA = new Set(('que como cuando donde cual cuales cuanto para por con sin una uno unos unas del los las mis mas muy' +
    ' hago hacer puedo puede debo tengo tiene tener siento sentir esta estoy estar son ser hay esto eso ese esa mi me se' +
    ' mis tus tu al el la lo le les de en y o a es si no ya pero porque hola quiero necesito saber duda dudas' ).split(' '));
  const raiz = (p) => p.slice(0, 5);
  const tokens = (t) => norm(t).split(' ').filter((p) => p.length > 2 && !PARADA.has(p)).map(raiz);

  const FAQ_INDICE = FAQ_DATA.flatMap(({ categoria, preguntas }) =>
    preguntas.map(({ p, r }) => ({ p, r, categoria, tp: new Set(tokens(p)), tr: new Set(tokens(r)) })));

  function buscarFaq(texto) {
    const q = [...new Set(tokens(texto))];
    if (!q.length) return [];
    const umbral = q.length === 1 ? 2 : 3;
    return FAQ_INDICE
      .map((it) => ({ it, s: q.reduce((acc, t) => acc + (it.tp.has(t) ? 3 : it.tr.has(t) ? 1 : 0), 0) }))
      .filter((x) => x.s >= umbral)
      .sort((a, b) => b.s - a.s);
  }

  // ---- Render de mensajes ----
  function agregar(rol, texto, { acciones = [], chips = [], urgente = false, id } = {}) {
    const cont = document.createElement('div');
    cont.className = `cardibot-msg ${rol}${urgente ? ' urgente' : ''}`;
    if (id) cont.id = id;
    const burbuja = document.createElement('div');
    burbuja.className = 'cardibot-burbuja';
    burbuja.textContent = texto;
    cont.appendChild(burbuja);

    if (acciones.length || chips.length) {
      const fila = document.createElement('div');
      fila.className = 'cardibot-acciones';
      acciones.forEach((clave) => {
        const def = ACC[clave];
        if (!def) return;
        let el;
        if (def.href) {
          el = document.createElement('a');
          el.href = def.href;
        } else {
          el = document.createElement('button');
          el.type = 'button';
          el.addEventListener('click', () => { cerrarChat(false); def.fn(); });
        }
        el.className = 'cardibot-accion';
        el.textContent = def.texto;
        fila.appendChild(el);
      });
      chips.forEach((pregunta) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'cardibot-accion';
        b.textContent = pregunta;
        b.addEventListener('click', () => enviarUsuario(pregunta));
        fila.appendChild(b);
      });
      cont.appendChild(fila);
    }
    log.appendChild(cont);
    log.scrollTop = log.scrollHeight;
    return cont;
  }

  function responder(texto) {
    const t = norm(texto);

    if (RE_CRISIS.test(t)) {
      return { texto: 'Lamento que estés pasando por esto, y me importa que estés a salvo. Por favor llama ahora al ' + CLINICA.emergencias + ' o ve a urgencias, y no te quedes solo/a: avisa a alguien cercano. También puedes comunicarte con la clínica al ' + CLINICA.telefono + '.',
        acciones: ['llamar', 'profesionales'], urgente: true };
    }
    if (RE_URGENTE.test(t)) {
      return { texto: 'Lo que describes puede ser una señal de alarma. No esperes a que pase: llama al ' + CLINICA.emergencias + ' o acude de inmediato a urgencias, y avisa a alguien que esté cerca de ti. Después comunícate con tu equipo médico.',
        acciones: ['urgencias', 'llamar'], urgente: true };
    }
    for (const it of INTENCIONES) {
      if (it.re.test(t)) return { texto: it.r(), acciones: it.a || [] };
    }
    const faq = buscarFaq(texto);
    if (faq.length) {
      return {
        texto: faq[0].it.p.replace(/^¿|\?$/g, '') + ':\n\n' + faq[0].it.r +
          '\n\nEsta es orientación general; sigue siempre las indicaciones de tu equipo médico.',
        acciones: ['cuidados'],
        chips: faq.slice(1, 3).map((x) => x.it.p)
      };
    }
    return {
      texto: 'No estoy seguro de haber entendido tu pregunta. Puedo ayudarte con recordatorios, citas, medicamentos, ubicación de la clínica y dudas generales de tu recuperación. Intenta con otras palabras o elige una opción.\n\nSi es algo que te preocupa, comunícate con la clínica al ' + CLINICA.telefono + '.',
      acciones: ['cuidados', 'llamar'],
      chips: ['¿Cómo creo un recordatorio?', '¿Cómo llego a la clínica?']
    };
  }

  function enviarUsuario(texto) {
    const limpio = texto.replace(/\s+/g, ' ').trim();
    if (!limpio) return;
    agregar('usuario', limpio);
    const espera = agregar('bot cardibot-escribiendo', 'CARDIbot está escribiendo…');
    setTimeout(() => {
      espera.remove();
      const res = responder(limpio);
      agregar('bot', res.texto, { acciones: res.acciones, chips: res.chips, urgente: res.urgente });
    }, 450);
  }

  function nombreActual() {
    const m = (saludo.textContent || '').replace(/^Hola,?\s*/i, '').trim();
    return m && m.toLowerCase() !== 'hola' ? m : '';
  }

  let iniciado = false;
  function abrirChat() {
    ventana.hidden = false;
    fab.setAttribute('aria-expanded', 'true');
    if (!iniciado) {
      iniciado = true;
      const nombre = nombreActual();
      agregar('bot', `Hola${nombre ? ', ' + nombre : ''}. Soy CARDIbot, el asistente virtual de Latido Seguro. Puedo explicarte cómo usar la página o resolver dudas generales sobre tu recuperación. ¿En qué te ayudo?`);
    }
    entrada.focus();
  }

  function cerrarChat(devolverFoco = true) {
    ventana.hidden = true;
    fab.setAttribute('aria-expanded', 'false');
    if (devolverFoco) fab.focus();
  }

  SUGERENCIAS.forEach((texto) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'cardibot-chip';
    b.textContent = texto;
    b.addEventListener('click', () => enviarUsuario(texto));
    zonaChips.appendChild(b);
  });

  fab.addEventListener('click', () => (ventana.hidden ? abrirChat() : cerrarChat()));
  btnCerrarChat.addEventListener('click', () => cerrarChat());
  const obtenerFocosChat = () => Array.from(ventana.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'))
    .filter((elemento) => elemento.getClientRects().length > 0);
  ventana.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { cerrarChat(); return; }
    if (e.key !== 'Tab') return;
    const enfocados = obtenerFocosChat();
    if (!enfocados.length) { e.preventDefault(); entrada.focus(); return; }
    const primero = enfocados[0];
    const ultimo = enfocados[enfocados.length - 1];
    if (e.shiftKey && (document.activeElement === primero || !ventana.contains(document.activeElement))) {
      e.preventDefault();
      ultimo.focus();
    } else if (!e.shiftKey && (document.activeElement === ultimo || !ventana.contains(document.activeElement))) {
      e.preventDefault();
      primero.focus();
    }
  });
  document.addEventListener('focusin', (e) => {
    const modalVideoAbierto = document.getElementById('modalVideo')?.classList.contains('active');
    if (!ventana.hidden && !modalVideoAbierto && !ventana.contains(e.target)) {
      (obtenerFocosChat()[0] || entrada).focus();
    }
  });
  formChat.addEventListener('submit', (e) => {
    e.preventDefault();
    const texto = entrada.value;
    entrada.value = '';
    enviarUsuario(texto);
  });

  // Al cerrar sesión se borra la conversación
  btnSalir.addEventListener('click', () => {
    cerrarChat(false);
    log.replaceChildren();
    iniciado = false;
  });
})();
