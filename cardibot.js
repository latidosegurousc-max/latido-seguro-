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

  const VISTAS = [panel, agenda, farmacias, contactoProfesionales, cuidados, ubicacion];
  function irA(abrir) {
    VISTAS.forEach((s) => { s.hidden = true; });
    document.body.classList.add('vista-interna');
    abrir();
  }

  const ACC = {
    recordatorios: { texto: 'Ir a Citas y recordatorios', fn: () => irA(abrirAgenda) },
    urgencias: { texto: 'Llamar a emergencias', href: 'tel:123' },
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
  let estadoCita = null;

  // ---- Intenciones sobre la salud del paciente y el uso de la página ----
  const INTENCIONES = [
    { re: /^(hola|buenas|buenos dias|buenas tardes|buenas noches|hey|saludos)\b/,
      r: () => 'Hola, soy CARDIbot. ¿En qué te puedo ayudar hoy? Puedo orientarte sobre síntomas de tu recuperación o enseñarte a usar la plataforma.' },
    { re: /gracias|muy amable|excelente|perfecto/,
      r: () => 'Con gusto. Si tienes otra duda de salud o de la plataforma, aquí estaré.' },
    { re: /\b(adios|chao|hasta luego|nos vemos)\b/,
      r: () => 'Hasta pronto. Cuídate mucho.' },
    { re: /(herida|puntos|sutura|esternon|pecho|costilla).*(dolor|duele|se abrio|supura|pus|rojo|caliente|infeccion)|(dolor|duele|se abrio|supura|pus|rojo|caliente).*(herida|esternon)/,
      r: () => 'Si notas que la herida quirúrgica se abre, hay secreción (pus), enrojecimiento o sientes un chasquido en el esternón, esto requiere valoración médica urgente. No te automediques.',
      a: ['urgencias', 'llamar'] },
    { re: /(dolor|presion|opresion|pesadez).*(pecho|torax)|falta de aire|no puedo respirar|me ahogo|desmayo|palpitaciones fuertes/,
      r: () => 'El dolor en el pecho o la falta de aire repentina pueden ser signos de alarma cardiovascular. No esperes a que pase. Si es intenso, acude a urgencias.',
      a: ['urgencias', 'llamar'] },
    { re: /(mareo|vertigo|inestabilidad).*(frecuente|constante|fuerte)|me duele la cabeza|dolor de cabeza/,
      r: () => 'El mareo o vértigo puede tener múltiples causas. Si se acompaña de visión doble, dificultad para hablar o debilidad en un lado del cuerpo, acude a urgencias inmediatamente.',
      a: ['urgencias', 'cuidados'] },
    { re: /(ansiedad|miedo|tristeza|depresion|estres|panico|no puedo dormir|insomnio)/,
      r: () => 'Es completamente normal sentir ansiedad, miedo o tristeza después de un evento cardíaco. El estrés afecta tu recuperación. Te recomiendo leer nuestras guías de manejo emocional y, si lo necesitas, buscar apoyo profesional.',
      a: ['cuidados', 'profesionales'] },
    { re: /(dieta|alimentacion|comer|comida|sal|colesterol|grasa|azucar|peso|obesidad)/,
      r: () => 'Una alimentación baja en grasas saturadas, sal y azúcares puede ayudar a cuidar tu corazón. Revisa nuestras recomendaciones sobre dieta cardiosaludable y evita dietas extremas sin supervisión.',
      a: ['cuidados'] },
    { re: /(medicamento|pastilla|medicina|tomar|dosis|anticoagulante|warfarina|aspirina).*(olvide|suspender|doble|cuando)/,
      r: () => 'Nunca suspendas ni dupliques la dosis de tus medicamentos (especialmente anticoagulantes como la warfarina) sin consultar a tu médico. Puedes crear un recordatorio en la plataforma para que no olvides tus tomas.',
      a: ['recordatorios', 'llamar'] },
    { re: /(ejercicio|actividad fisica|caminar|deporte|escaleras|esfuerzo|movilidad)/,
      r: () => 'La actividad física gradual es fundamental. Sigue las indicaciones de tu equipo médico y revisa nuestra guía de movilidad para conocer recomendaciones generales para la recuperación.',
      a: ['cuidados'] },
    { re: /(crear|abrir|hacer|sacar).*(cuenta|usuario)|registrar|registro|inscrib/,
      r: () => 'Para crear tu cuenta:\n1. En la pantalla de inicio pulsa “Crear cuenta”.\n2. Escribe tu correo y una contraseña (mínimo 10 caracteres, con mayúscula, minúscula y número).\n3. Pulsa “Continuar con mis datos” y completa nombre, apellido, documento y celular.\n4. Revisa tu correo, escribe el código de seis dígitos y listo.' },
    { re: /codigo|verificar|verificacion|no me llega|no llego el correo/,
      r: () => 'Al crear tu cuenta enviamos un código de seis dígitos a tu correo. Vence en 10 minutos y tienes 5 intentos. Si no te llegó, revisa la carpeta de spam y pulsa “Reenviar código” (puedes pedir uno nuevo cada 60 segundos).' },
    { re: /cerrar sesion|salir de la cuenta|desconectarme|salir de mi cuenta/,
      r: () => 'Para cerrar sesión, ve a la pantalla principal (con tus cuatro tarjetas) y pulsa “Cerrar sesión”, arriba a la derecha. Si estás en otra sección, pulsa “Volver” primero.' },
    { re: /(eliminar|borrar|quitar|cancelar).*(recordatorio|aviso|alarma|cita)/,
      r: () => 'Para eliminar un recordatorio, entra a “Citas y recordatorios”, selecciona el día en el calendario y en la lista de abajo presiona el botón “Eliminar”.',
      a: ['recordatorios'] },
    { re: /reclamar|reclamo|farmacia|drogueria|cruz verde|dispensa|entreg.*medicament|conseguir.*medicament|donde.*medicament/,
      r: () => 'Abre el mapa de droguerías Cruz Verde en Cali, escribe tu barrio o dirección y pulsa “Encuentra la más cerca de ti”. Antes de ir, confirma que allí dispensan tu medicamento y revisa el horario.',
      a: ['farmacias'] },
    { re: /(agendar|solicitar|pedir|sacar|programar|necesito|quiero).*\bcita prioritaria|\bcita prioritaria|\bcita urgente/,
      r: () => 'La plataforma no permite solicitar citas prioritarias. Para consultar opciones, comunícate directamente con la clínica al ' + CLINICA.telefono + '.',
      a: ['llamar'] },
    { re: /(agendar|solicitar|pedir|sacar|programar|necesito|quiero).*\bcitas?\b/,
      r: () => {
        estadoCita = {
          paso: 'esperando_fecha',
          fecha: '',
          hora: '',
          correo: '',
          correoRegistrado: false
        };
        return 'Puedo crear un recordatorio personal para tu cita de control, pero no agendar la cita con la clínica. Indícame la fecha del recordatorio en formato AAAA-MM-DD (por ejemplo: 2026-11-30).';
      } },
    { re: /hablar con alguien|alguien con quien|psicolog|enfermer|acompanamiento|trabajo social|apoyo emocional|me siento (solo|sola|triste|mal|ansios)|estoy (triste|ansios|preocupad)/,
      r: () => 'Estamos para acompañarte. En la sección de contacto con profesionales encontrarás opciones de enfermería, acompañamiento emocional y trabajo social. También puedes llamar a la clínica al ' + CLINICA.telefono + '.',
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
      r: () => 'Si tienes síntomas graves, llama al ' + CLINICA.emergencias + ' o acude a urgencias. También puedes consultar el mapa de farmacias o contactar a un profesional.',
      a: ['urgencias', 'farmacias', 'profesionales'] },
    { re: /quien eres|como te llamas|que eres|que haces|que puedes|para que sirves|^ayuda$|necesito ayuda con la pagina|no entiendo la pagina|como funciona la pagina|como uso la pagina/,
      r: () => 'Soy CARDIbot, el asistente virtual de Latido Seguro. Te explico cómo usar cada sección de la página (recordatorios, citas, medicamentos, ubicación) y respondo dudas generales sobre tus cuidados. No doy diagnósticos ni cambio indicaciones médicas.\n\nPrueba preguntándome, por ejemplo: “¿Cómo creo un recordatorio?”.',
      a: ['recordatorios', 'cuidados'] },
    { re: /olvid.*(contrasena|clave)|perdi.*(contrasena|clave)|recuperar.*(contrasena|clave)|cambiar.*(contrasena|clave)|restablecer/,
      r: () => 'Por ahora la página no tiene una opción automática para recuperar o cambiar la contraseña. Comunícate con la clínica al ' + CLINICA.telefono + ' para recibir ayuda.',
      a: ['llamar'] },
    { re: /contrasena|clave/,
      r: () => 'Tu contraseña debe tener al menos 10 caracteres, con una mayúscula, una minúscula y un número. Puedes pulsar “Mostrar” para ver lo que escribes.' },
    { re: /recordatorio|recordarme|recuerd|alarma|crear mi dieta|cuando me tomo|en que momento hago ejercicio|programar.*(aviso|medicamento)/,
      r: () => 'Para crear un recordatorio:\n1. Entra a “Citas y recordatorios”.\n2. Pulsa el día en el calendario.\n3. Elige qué quieres recordar (cita de control, dieta, medicamentos o ejercicio).\n4. Indica la hora y un detalle opcional; por ahora, el aviso se recibe solo por correo electrónico.\n5. Pulsa “Guardar recordatorio”.\n\nLos números verdes en el calendario muestran cuántos recordatorios tienes cada día. La opción “Crear mi dieta” crea un recordatorio de alimentación; la dieta que debes seguir te la indica tu equipo médico.',
      a: ['recordatorios'] },

    { re: /(farmacia|drogueria|medicamento|reclamar|recoger|pastillas).*(donde|conseguir)/,
      r: () => 'Para encontrar dónde reclamar tus medicamentos, puedes usar nuestro mapa con las droguerías Cruz Verde en Cali. Solo escribe tu barrio y te mostraremos las más cercanas.',
      a: ['farmacias'] },
    { re: /(cita|agendar|medico|control|cardiologo|especialista)/,
      r: () => 'Puedes agendar un recordatorio para tu próxima cita médica. Si necesitas atención urgente, llama al 123 o comunícate directamente con la clínica. Recuerda asistir con tus exámenes y lista de medicamentos.',
      a: ['recordatorios', 'urgencias'] }
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

  async function responder(texto) {
    const t = norm(texto);

    if (RE_CRISIS.test(t)) {
      estadoCita = null;
      return { texto: 'Lamento que estés pasando por esto, y me importa que estés a salvo. Por favor llama ahora al ' + CLINICA.emergencias + ' o ve a urgencias, y no te quedes solo/a: avisa a alguien cercano. También puedes comunicarte con la clínica al ' + CLINICA.telefono + '.',
        acciones: ['llamar', 'profesionales'], urgente: true };
    }
    if (RE_URGENTE.test(t)) {
      estadoCita = null;
      return { texto: 'Lo que describes puede ser una señal de alarma. No esperes a que pase: llama al ' + CLINICA.emergencias + ' o acude de inmediato a urgencias, y avisa a alguien que esté cerca de ti. Después comunícate con tu equipo médico.',
        acciones: ['urgencias', 'llamar'], urgente: true };
    }
    if (estadoCita) {
      if (/\b(cancelar|cancela|detener|olvidalo)\b/.test(t) || (t === 'no' && estadoCita.paso !== 'confirmando')) {
        estadoCita = null;
        return { texto: 'Entendido, cancelé la creación del recordatorio. ¿Hay algo más en lo que te pueda ayudar?' };
      }

      if (estadoCita.paso === 'esperando_fecha') {
        let fechaTexto = texto;
        const matchBarra = texto.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
        if (matchBarra) {
          fechaTexto = `${matchBarra[3]}-${matchBarra[2].padStart(2, '0')}-${matchBarra[1].padStart(2, '0')}`;
        }
        const fechaMatch = fechaTexto.match(/\b\d{4}-\d{2}-\d{2}\b/);
        if (!fechaMatch) {
          return { texto: 'Escribe la fecha en formato AAAA-MM-DD (por ejemplo: 2026-11-30) o DD/MM/AAAA (por ejemplo: 30/11/2026).' };
        }
        const [anio, mes, dia] = fechaMatch[0].split('-').map(Number);
        const fechaUTC = new Date(Date.UTC(anio, mes - 1, dia));
        if (
          fechaUTC.getUTCFullYear() !== anio
          || fechaUTC.getUTCMonth() !== mes - 1
          || fechaUTC.getUTCDate() !== dia
        ) {
          return { texto: 'Esa fecha no existe. Escribe una fecha válida en formato AAAA-MM-DD.' };
        }
        estadoCita.fecha = fechaMatch[0];
        estadoCita.paso = 'esperando_hora';
        return { texto: `Entendido. La fecha es el ${estadoCita.fecha}. ¿A qué hora quieres el recordatorio? Usa formato de 24 horas, por ejemplo 15:00.` };
      }

      if (estadoCita.paso === 'esperando_hora') {
        const horaMatch = texto.match(/\b(?:[01]\d|2[0-3]):[0-5]\d\b/);
        if (!horaMatch) {
          return { texto: 'Escribe una hora válida en formato de 24 horas (por ejemplo: 14:30).' };
        }
        estadoCita.hora = horaMatch[0];
        estadoCita.paso = 'esperando_correo';
        return { texto: '¿A qué correo quieres enviar el aviso? Escribe una dirección completa o escribe “mi correo” para usar el correo de tu cuenta.' };
      }

      if (estadoCita.paso === 'esperando_correo') {
        let correoFinal = '';
        if (
          t.includes('mi correo')
          || t.includes('el mio')
          || t.includes('el de mi cuenta')
        ) {
          if (window.usuarioLogueadoEmail) {
            correoFinal = window.usuarioLogueadoEmail;
            estadoCita.correoRegistrado = true;
          } else {
            return { texto: 'No he podido detectar tu correo registrado. Escríbelo manualmente (por ejemplo, correo@gmail.com).' };
          }
        } else {
          const emailMatch = texto.match(/[^\s@]+@[^\s@]+\.[^\s@]+/);
          if (emailMatch) correoFinal = emailMatch[0];
          estadoCita.correoRegistrado = false;
        }

        if (!/^[^\s@]{1,64}@[^\s@]{1,189}\.[^\s@]{2,63}$/.test(correoFinal)) {
          return { texto: 'No entendí el correo. Escribe una dirección válida (por ejemplo: paciente@correo.com) o “mi correo”.' };
        }
        estadoCita.correo = correoFinal;
        estadoCita.paso = 'confirmando';
        return {
          texto: `Resumen del recordatorio de cita:\n📅 Fecha: ${estadoCita.fecha}\n⏰ Hora: ${estadoCita.hora}\n✉️ Aviso a: ${estadoCita.correo}\n\n¿Confirmas que guarde este recordatorio? (Sí o No). Esto no agenda ni confirma una cita con la clínica.`
        };
      }

      if (estadoCita.paso === 'confirmando') {
        if (t === 'si' || t.includes('claro') || t === 'dale' || t === 'confirmo') {
          const cita = { ...estadoCita };
          estadoCita = null;
          void (async () => {
            try {
              const respuesta = await fetch(window.API_BASE_URL + '/guardar-recordatorio', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  tipo: 'Cita de control',
                  fecha: cita.fecha,
                  hora: cita.hora,
                  especialista: 'Cardiólogo clínico',
                  detalle: 'Recordatorio creado por CARDIbot',
                  canal: 'Correo electrónico',
                  usar_contacto_registrado: cita.correoRegistrado,
                  contacto: cita.correo,
                  clave_solicitud: nuevaClaveSolicitud()
                })
              });
              const datos = await respuesta.json().catch(() => null);
              if (!respuesta.ok || !datos?.recordatorio) {
                agregar('bot', datos?.error || `No se pudo guardar el recordatorio (respuesta ${respuesta.status}).`);
                return;
              }
              agregar('bot', `¡Listo! Guardé un recordatorio personal para el ${cita.fecha} a las ${cita.hora}. Esto no confirma una cita con la clínica.`);
              agregar('bot', 'Puedes consultar tus recordatorios en el calendario.', { acciones: ['recordatorios'] });
            } catch (error) {
              agregar('bot', 'No pude conectar con el servidor. Verifica tu conexión e inicia sesión para guardar el recordatorio.');
            }
          })();
          return { texto: 'Estoy guardando el recordatorio…' };
        }
        if (t === 'no' || t.includes('cancelar') || t.includes('cancela')) {
          estadoCita = null;
          return { texto: 'Entendido, cancelé la creación del recordatorio. ¿Hay algo más en lo que te pueda ayudar?' };
        }
        return { texto: 'Responde “Sí” para guardar este recordatorio o “No” para cancelarlo.' };
      }
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
      responder(limpio)
        .then((res) => {
          if (res) agregar('bot', res.texto, { acciones: res.acciones, chips: res.chips, urgente: res.urgente });
        })
        .catch(() => agregar('bot', 'No pude procesar tu mensaje. Inténtalo de nuevo.'));
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
    estadoCita = null;
  });
})();
