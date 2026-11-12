    // ---- Cuidados: datos del FAQ ----
const FAQ_DATA = [
  {
    categoria: 'Signos de alarma',
    preguntas: [
      {
        p: '¿Cuándo debo acudir a urgencias o llamar a emergencias?',
        r: `Acude a urgencias o llama a los servicios de emergencia si presentas:
• Dolor u opresión intensa en el pecho que persiste o se acompaña de sudor frío o falta de aire.
• Falta de aire repentina o intensa.
• Desmayo o pérdida de conciencia.
• Debilidad repentina de un lado del cuerpo, dificultad para hablar o desviación de la cara.
• Sangrado abundante que no se detiene.
• Hinchazón o dolor de una sola pierna con falta de aire o dolor torácico.
• Palpitaciones con desmayo, dolor torácico o dificultad respiratoria intensa.
• Apertura de la herida quirúrgica con deterioro importante, dolor intenso o dificultad para respirar.`
      },
      {
        p: '¿Cuándo debo contactar al equipo médico con prontitud?',
        r: `Contacta al equipo médico cuanto antes si presentas:
• Fiebre después de la cirugía, sobre todo si persiste o se acompaña de escalofríos, enrojecimiento o secreción en la herida.
• Hinchazón, calor, dolor o enrojecimiento nuevos en una sola pierna.
• Enrojecimiento creciente, pus o cambios en la herida quirúrgica.
• Aumento rápido de peso o hinchazón progresiva de las piernas.
• Cambios persistentes en el pulso o la presión arterial fuera del rango indicado.
• Efectos secundarios de medicamentos, fatiga que empeora o dificultad respiratoria nueva.
• Chasquido repetido o sensación de inestabilidad del esternón.`
      }
    ]
  },
  {
    categoria: 'Cuidados generales',
    preguntas: [
      {
        p: '¿Cuándo puedo retomar mis actividades normales después de la cirugía?',
        r: 'El tiempo para retomar actividades varía según el individuo y el tipo de cirugía. Es importante seguir las recomendaciones específicas del equipo médico y reintroducir las actividades gradualmente.'
      },
      {
        p: '¿Cómo manejo el dolor sin depender demasiado de los medicamentos?',
        r: 'Incorporar técnicas de manejo del dolor no farmacológicas como la meditación, los ejercicios de respiración y la fisioterapia puede ayudar a reducir la dependencia de medicamentos. Discute las opciones con el equipo médico para recibir estrategias alternativas efectivas.'
      },
      {
        p: '¿Es normal sentirse emocionalmente inestable después de la cirugía?',
        r: 'Sí, es común experimentar una amplia gama de emociones después de una cirugía cardíaca. Buscar apoyo emocional y profesional es clave para manejar estos sentimientos.'
      }
    ]
  },
  {
    categoria: 'Herida quirúrgica',
    preguntas: [
      {
        p: '¿Qué hago si tengo dolor en la herida?',
        r: 'Toma los analgésicos según la prescripción médica, sin aumentar ni cambiar las dosis por cuenta propia. Si te han indicado sostener el pecho con una almohada al toser o estornudar, hazlo suavemente. Evita movimientos bruscos.'
      },
      {
        p: '¿Qué significa enrojecimiento, calor, hinchazón o secreción en la herida?',
        r: 'Mantén la herida limpia y sigue las instrucciones de curación y baño recibidas al alta. No apliques cremas ni productos sin autorización. Contacta al equipo médico el mismo día si aparecen estos cambios, especialmente si empeoran o hay pus.'
      },
      {
        p: '¿Es normal sentir picazón durante la cicatrización?',
        r: 'Sí, puede ocurrir durante la cicatrización. No rasques ni apliques productos sin autorización. Usa ropa cómoda que no roce la herida. Consulta si aparecen sarpullido, hinchazón creciente o secreción.'
      },
      {
        p: '¿Qué hago si la herida se abre o siento un chasquido en el esternón?',
        r: 'Si la herida se abre, busca valoración médica urgente. Un chasquido nuevo o repetido, sensación de movimiento o inestabilidad del esternón requiere contactar inmediatamente al equipo quirúrgico. Si se acompaña de dolor intenso o dificultad respiratoria, acude a urgencias.'
      },
      {
        p: '¿Son normales los hematomas (moretones) en la zona?',
        r: 'Pueden aparecer después de la cirugía. Vigila si aumentan rápidamente, se endurecen, duelen cada vez más o se acompañan de sangrado. Comunica estos cambios al equipo médico, especialmente si tomas anticoagulantes.'
      }
    ]
  },
  {
    categoria: 'Problemas cardíacos y circulatorios',
    preguntas: [
      {
        p: '¿Qué hago si tengo dolor o presión en el pecho?',
        r: 'Si el dolor o la presión en el pecho es intensa, persiste o se acompaña de sudor frío o falta de aire, acude de inmediato a urgencias o llama a los servicios de emergencia. No esperes a que los síntomas pasen por sí solos.'
      },
      {
        p: '¿Cómo manejo la presión arterial alta?',
        r: 'Mide y registra la presión según las indicaciones médicas. Toma los medicamentos prescritos y reduce el consumo de sal según el plan de alimentación. Si la presión es muy elevada, especialmente con dolor torácico, dificultad respiratoria o síntomas neurológicos, busca atención urgente.'
      },
      {
        p: '¿Qué hago si tengo palpitaciones o latidos irregulares?',
        r: 'Siéntate y descansa, registra cuándo ocurren y cuánto duran, y coméntalo con el equipo médico. Evita estimulantes si así te lo han recomendado. Si aparecen con dolor torácico, falta de aire intensa, mareo importante o desmayo, acude a urgencias.'
      },
      {
        p: '¿Qué hago si tengo presión arterial baja o mareo al levantarme?',
        r: 'Levántate lentamente, pasando primero por la posición sentada. Mantén la hidratación indicada, salvo que exista restricción de líquidos. Consulta si los mareos persisten y busca atención urgente ante un desmayo o síntomas intensos.'
      },
      {
        p: '¿Qué significa dolor, calor o enrojecimiento en una pierna?',
        r: 'Puede indicar una trombosis venosa. Busca valoración médica urgente y no masajees la zona. Si aparece falta de aire repentina o dolor torácico, llama a los servicios de emergencia.'
      },
      {
        p: '¿Qué hago si mi frecuencia cardíaca es muy lenta o muy rápida?',
        r: 'Mide el pulso en reposo si te lo han indicado y compáralo con el rango individual recomendado. Contacta al equipo médico si está fuera de ese rango. Si el cambio se acompaña de dolor torácico, falta de aire intensa, mareo importante o desmayo, acude a urgencias.'
      },
      {
        p: '¿Qué significa la hinchazón de piernas o tobillos?',
        r: 'Eleva las piernas al descansar si resulta cómodo y está permitido. Controla el peso según las indicaciones del equipo médico. Comunica el aumento rápido de peso o la hinchazón creciente. La hinchazón nueva de una sola pierna requiere valoración urgente, especialmente si hay dolor o calor.'
      }
    ]
  },
  {
    categoria: 'Problemas respiratorios',
    preguntas: [
      {
        p: '¿Qué hago si tengo falta de aire al esfuerzo o en reposo?',
        r: 'Reduce la actividad y avisa al equipo médico si la falta de aire es nueva, empeora o aparece en reposo. Si es repentina, intensa o se acompaña de dolor torácico, confusión o coloración azulada de los labios, llama a emergencias.'
      },
      {
        p: '¿Qué hacer con una tos persistente?',
        r: 'Realiza los ejercicios respiratorios indicados, mantén una hidratación compatible con las restricciones médicas y sostén suavemente el pecho con una almohada si ayuda. Consulta si la tos persiste o se acompaña de fiebre, sangre en el esputo o empeoramiento respiratorio.'
      },
      {
        p: '¿Qué hago si me cuesta respirar profundamente?',
        r: 'Usa el espirómetro incentivador únicamente si fue indicado y siguiendo las instrucciones recibidas. Camina suavemente y cambia de posición según las recomendaciones médicas para ayudar a prevenir complicaciones pulmonares. Si la dificultad es repentina o intensa, acude a urgencias.'
      }
    ]
  },
  {
    categoria: 'Medicamentos',
    preguntas: [
      {
        p: '¿Qué hago si olvido una dosis?',
        r: 'Sigue las instrucciones específicas del medicamento o consulta al médico o farmacéutico. No dupliques la dosis siguiente para compensar el olvido, salvo indicación profesional expresa. Usa alarmas o pastilleros para mejorar la organización.'
      },
      {
        p: '¿Qué hacer si tengo sangrado de encías, nariz o hematomas al tomar anticoagulantes?',
        r: 'Usa un cepillo dental suave y evita actividades con riesgo de golpes. Cumple los controles de laboratorio que correspondan, como el INR en pacientes tratados con warfarina. Consulta ante cualquier sangrado nuevo; si es abundante o no se detiene, acude a urgencias.'
      },
      {
        p: '¿Qué hacer si tengo náuseas o malestar estomacal?',
        r: 'Consulta si el medicamento debe tomarse con alimentos, ya que esto depende de cada fármaco. No suspendas ni modifiques la dosis por cuenta propia. Busca atención si los síntomas son intensos o persistentes.'
      },
      {
        p: '¿Qué hago ante efectos secundarios como tos seca, mareo o debilidad?',
        r: 'Registra los síntomas, cuándo comenzaron y qué medicamentos estás tomando. Informa al equipo médico para valorar posibles ajustes. No suspendas tratamientos cardíacos sin orientación profesional.'
      },
      {
        p: '¿Puedo tomar antiinflamatorios, suplementos o hierbas?',
        r: 'Consulta antes de utilizarlos. Algunos antiinflamatorios pueden afectar los riñones, la presión arterial o el riesgo de sangrado; los suplementos y las hierbas también pueden interactuar con medicamentos cardíacos.'
      }
    ]
  },
  {
    categoria: 'Alimentación y digestión',
    preguntas: [
      {
        p: '¿Qué hacer si pierdo el apetito?',
        r: 'Come porciones pequeñas y frecuentes, con alimentos nutritivos y fáciles de tolerar. Consulta si la falta de apetito persiste, hay pérdida de peso involuntaria o no se logra comer suficiente.'
      },
      {
        p: '¿Cómo evitar el estreñimiento?',
        r: 'Aumenta gradualmente el consumo de frutas, verduras y avena, si se toleran. Bebe líquidos según la cantidad permitida y camina suavemente si está autorizado. Evita hacer esfuerzos excesivos al evacuar y consulta si el estreñimiento persiste.'
      },
      {
        p: '¿Cómo manejar la retención de líquidos?',
        r: 'Sigue las restricciones individuales de sal y líquidos. Limita los alimentos muy salados si así se ha indicado. Informa al equipo médico si aumentan la hinchazón o el peso rápidamente.'
      },
      {
        p: '¿Qué hacer si aumento de peso rápidamente?',
        r: 'Registra el peso con la frecuencia indicada. Un aumento rápido después de la cirugía puede reflejar retención de líquidos y no necesariamente un aumento de grasa. Consulta antes de realizar cambios importantes en la dieta o el ejercicio.'
      },
      {
        p: '¿Cómo controlar la glucosa si tengo diabetes?',
        r: 'Controla la glucosa según el plan médico, respeta los horarios de alimentación y los medicamentos, y sigue las instrucciones específicas para tratar valores bajos o altos. Busca ayuda si los valores están fuera del rango indicado o aparecen síntomas importantes.'
      }
    ]
  },
  {
    categoria: 'Movilidad y actividad física',
    preguntas: [
      {
        p: '¿Qué hacer ante cansancio o fatiga excesiva?',
        r: 'Alterna actividad y descanso, duerme lo suficiente y aumenta gradualmente las actividades cotidianas. El cansancio puede ser frecuente durante las primeras semanas, pero si empeora, es intenso o se acompaña de falta de aire, mareos o dolor torácico, consulta de inmediato según la gravedad.'
      },
      {
        p: '¿Qué hacer ante debilidad muscular?',
        r: 'Comienza con caminatas suaves y aumenta la duración de manera progresiva, de acuerdo con las indicaciones médicas. Participa en un programa de rehabilitación cardíaca cuando esté disponible y autorizado.'
      },
      {
        p: '¿Cómo vencer el miedo a moverse o hacer esfuerzo?',
        r: 'Solicita orientación sobre las actividades seguras y las restricciones temporales. La rehabilitación cardíaca supervisada puede ayudar a recuperar la confianza y mejorar la capacidad física.'
      },
      {
        p: '¿Qué hacer ante dolor en hombros o espalda?',
        r: 'Mantén una postura cómoda, cambia de posición regularmente y realiza solo los movimientos recomendados por el fisioterapeuta. Evita levantar objetos pesados o hacer esfuerzos que estén restringidos durante la recuperación.'
      },
      {
        p: '¿Cómo subir escaleras de forma segura?',
        r: 'Sube lentamente, haz pausas y sigue las indicaciones del equipo médico. No continúes si aparece dolor torácico, falta de aire fuera de lo esperado o mareo. Si estos síntomas son intensos o repentinos, busca atención urgente.'
      }
    ]
  },
  {
    categoria: 'Sueño',
    preguntas: [
      {
        p: '¿Cómo dormir o encontrar una posición cómoda?',
        r: 'Usa almohadas para apoyar el cuerpo y el pecho, si resulta cómodo. Duerme con la cabecera elevada solo si ayuda o si fue recomendado. Mantén horarios regulares de sueño.'
      },
      {
        p: '¿Qué hacer ante despertares nocturnos?',
        r: 'Evita la cafeína por la tarde y reduce el uso de pantallas antes de acostarte. Comunica al equipo médico si los despertares se relacionan con falta de aire, palpitaciones o dolor que no mejora.'
      },
      {
        p: '¿Qué hacer con pesadillas o sueño inquieto?',
        r: 'Habla con el equipo médico si las pesadillas o la inquietud persisten. El estrés de la operación, la ansiedad y algunos medicamentos pueden influir en el sueño. No uses somníferos sin consultar.'
      }
    ]
  },
  {
    categoria: 'Emocionales y psicológicos',
    preguntas: [
      {
        p: '¿Qué hacer ante ansiedad o miedo a sufrir otro evento cardíaco?',
        r: 'Habla sobre las preocupaciones con familiares y profesionales sanitarios. Practica respiración lenta y técnicas de relajación. Busca apoyo psicológico si la ansiedad interfiere con el sueño, la actividad o la vida cotidiana.'
      },
      {
        p: '¿Es normal sentir tristeza después de la cirugía?',
        r: 'Mantén contacto con otras personas y recupera gradualmente las rutinas. Consulta si la tristeza persiste, empeora o afecta el funcionamiento diario; no es necesario esperar dos semanas para pedir ayuda. Si aparecen pensamientos de hacerte daño, busca ayuda inmediata.'
      },
      {
        p: '¿Qué hacer ante irritabilidad o cambios de humor?',
        r: 'Comunica estos cambios a la familia y al equipo médico. Pueden relacionarse con el estrés, el dolor, la falta de sueño o los medicamentos, por lo que conviene evaluar su causa si persisten.'
      },
      {
        p: '¿Cómo manejar la dificultad para concentrarme o la pérdida leve de memoria?',
        r: 'Usa notas, calendarios y recordatorios. Informa al equipo médico si los síntomas persisten, empeoran o interfieren con las actividades cotidianas. Una confusión repentina requiere atención urgente.'
      },
      {
        p: '¿Cómo manejar la dependencia o sensación de ser una carga?',
        r: 'Involúcrate en las decisiones de tu recuperación y realiza tareas ligeras que sean seguras. Mantén una comunicación abierta con el cuidador y solicita apoyo cuando sea necesario.'
      }
    ]
  },
  {
    categoria: 'Actividades cotidianas',
    preguntas: [
      {
        p: '¿Cuándo puedo volver a conducir?',
        r: 'No conduzcas hasta recibir autorización del equipo médico. El tiempo de espera depende del tipo de cirugía, la recuperación, los medicamentos y la normativa aplicable.'
      },
      {
        p: '¿Cuándo puedo retomar el trabajo?',
        r: 'Reanuda las actividades laborales de forma gradual y con autorización médica. El momento depende del tipo de trabajo, el esfuerzo físico requerido y la evolución del paciente.'
      },
      {
        p: '¿Cuándo puedo retomar la actividad sexual?',
        r: 'Retómala cuando el equipo médico lo autorice. La capacidad de realizar actividad física moderada sin síntomas puede servir como orientación, pero no sustituye la evaluación individual. Consulta las dudas sin vergüenza.'
      },
      {
        p: '¿Cuándo puedo viajar?',
        r: 'Consulta antes de realizar viajes largos o viajar en avión, especialmente durante las primeras semanas. En trayectos prolongados, sigue las recomendaciones médicas para moverte con seguridad y reducir el riesgo de coágulos.'
      },
      {
        p: '¿Cómo cuidar la herida al bañarme?',
        r: 'Sigue las instrucciones específicas de alta para ducharte y cuidar la herida. Evita sumergirla en bañeras, piscinas o jacuzzis hasta que esté suficientemente cicatrizada y el equipo médico lo autorice. Seca suavemente, sin frotar.'
      }
    ]
  },
  {
    categoria: 'Dispositivos cardíacos y válvulas',
    preguntas: [
      {
        p: '¿Qué hacer ante mareo o desmayo si tengo marcapasos?',
        r: 'Un desmayo o mareo intenso requiere atención urgente, especialmente si se acompaña de dolor torácico o falta de aire. No asumas que el marcapasos está funcionando correctamente solo porque está implantado; el equipo especializado debe evaluar el dispositivo cuando sea necesario.'
      },
      {
        p: '¿Puedo mover el brazo del lado del marcapasos?',
        r: 'Sigue las instrucciones específicas del equipo que implantó el dispositivo. Pueden existir restricciones temporales para elevar el brazo o levantar peso, pero el tiempo y el grado de restricción varían según el procedimiento.'
      },
      {
        p: '¿Qué cuidados debo tener con campos electromagnéticos?',
        r: 'Sigue las recomendaciones específicas para el modelo del dispositivo. Mantén teléfonos y otros aparatos con imanes potentes a la distancia indicada por el fabricante y evita apoyarlos directamente sobre el implante. Informa al personal sanitario sobre el dispositivo antes de procedimientos médicos y consulta antes de una resonancia magnética.'
      },
      {
        p: '¿Cómo manejar la válvula mecánica y el tratamiento anticoagulante?',
        r: 'Toma el anticoagulante exactamente como fue prescrito y cumple los controles de INR cuando corresponda. Lleva una identificación que indique la presencia de la válvula y el tratamiento. Informa al médico o dentista antes de procedimientos; no suspendas el anticoagulante por cuenta propia.'
      },
      {
        p: '¿Qué hacer ante descargas del desfibrilador implantable?',
        r: 'Si el desfibrilador emite una descarga y te sientes bien, contacta al equipo médico para valoración. Si recibes varias descargas, te sientes mal o presentas dolor torácico, falta de aire o desmayo, llama a emergencias de inmediato.'
      }
    ]
  },
  {
    categoria: 'Factores de riesgo persistentes',
    preguntas: [
      {
        p: '¿Cómo dejar de fumar?',
        r: 'Deja de fumar y evita el humo de segunda mano. Solicita apoyo profesional si resulta difícil dejarlo; existen tratamientos y programas de ayuda.'
      },
      {
        p: '¿Puedo consumir alcohol?',
        r: 'Consulta antes de consumir alcohol durante la recuperación, especialmente si tomas anticoagulantes, analgésicos u otros medicamentos que puedan interactuar con él. Sigue las restricciones individuales.'
      },
      {
        p: '¿Cómo controlar el colesterol alto?',
        r: 'Toma los medicamentos prescritos, como las estatinas cuando correspondan, y sigue una alimentación equilibrada con menos grasas saturadas. Realiza actividad física según la autorización médica.'
      },
      {
        p: '¿Cómo manejar el estrés crónico?',
        r: 'Practica técnicas de relajación, respiración o meditación, mantén una rutina equilibrada y busca apoyo psicológico si el estrés afecta el bienestar o la recuperación.'
      },
      {
        p: '¿Cómo evitar el sedentarismo?',
        r: 'Retoma el movimiento gradualmente mediante caminatas y, cuando sea apropiado, rehabilitación cardíaca. La intensidad y la duración del ejercicio deben ajustarse a la evolución y las recomendaciones médicas.'
      }
    ]
  }
];

// ---- Cuidados: render del FAQ ----
const faqLista = document.getElementById('faqLista');
const buscador = document.getElementById('buscador');
const sinResultados = document.getElementById('sinResultados');

function renderFAQ() {
  faqLista.replaceChildren();
  FAQ_DATA.forEach(({ categoria, preguntas }) => {
    const tituloCat = document.createElement('h3');
    tituloCat.className = 'faq-categoria';
    tituloCat.textContent = categoria;
    faqLista.appendChild(tituloCat);

    preguntas.forEach(({ p, r }) => {
      const item = document.createElement('div');
      item.className = 'faq-item';

      const boton = document.createElement('button');
      boton.type = 'button';
      boton.className = 'faq-pregunta';
      boton.setAttribute('aria-expanded', 'false');

      const textoPregunta = document.createElement('span');
      textoPregunta.textContent = p;

      const icono = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      icono.setAttribute('viewBox', '0 0 24 24');
      icono.setAttribute('aria-hidden', 'true');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'm6 9 6 6 6-6');
      icono.appendChild(path);

      boton.append(textoPregunta, icono);

      const respuestaWrap = document.createElement('div');
      respuestaWrap.className = 'faq-respuesta';
      const respuestaInner = document.createElement('div');
      const parrafo = document.createElement('p');
      parrafo.textContent = r;
      respuestaInner.appendChild(parrafo);
      respuestaWrap.appendChild(respuestaInner);

      item.append(boton, respuestaWrap);
      faqLista.appendChild(item);
    });
  });
}
renderFAQ();

// Acordeón (delegación de eventos, funciona con el DOM generado)
faqLista.addEventListener('click', (e) => {
  const boton = e.target.closest('.faq-pregunta');
  if (!boton) return;
  const item = boton.parentElement;
  const abierta = item.classList.toggle('abierta');
  boton.setAttribute('aria-expanded', abierta ? 'true' : 'false');
});

// Buscador (filtra y oculta categorías sin resultados)
const normalizar = (t) =>
  t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

buscador.addEventListener('input', () => {
  const termino = normalizar(buscador.value.trim());
  let visibles = 0;
  let categoriaActual = null;
  let visiblesEnCategoria = 0;

  Array.from(faqLista.children).forEach((hijo) => {
    if (hijo.classList.contains('faq-categoria')) {
      if (categoriaActual) categoriaActual.hidden = visiblesEnCategoria === 0;
      categoriaActual = hijo;
      visiblesEnCategoria = 0;
    } else if (hijo.classList.contains('faq-item')) {
      const coincide = normalizar(hijo.textContent).includes(termino);
      hijo.style.display = coincide ? '' : 'none';
      if (coincide) {
        visibles++;
        visiblesEnCategoria++;
      }
    }
  });
  if (categoriaActual) categoriaActual.hidden = visiblesEnCategoria === 0;
  sinResultados.style.display = visibles === 0 ? 'block' : 'none';
});
  let videoTrigger = null;
  function abrirVideo(videoId) {
    const modal = document.getElementById('modalVideo');
    const iframe = document.getElementById('iframeVideo');
    if (!modal || !iframe || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) return;

    videoTrigger = document.activeElement;
    iframe.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(videoId) + '?autoplay=1&rel=0';
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    document.getElementById('btnCerrarVideo').focus();
  }

  function cerrarVideo() {
    const modal = document.getElementById('modalVideo');
    const iframe = document.getElementById('iframeVideo');
    if (!modal || !iframe) return;

    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    iframe.src = '';
    document.body.style.overflow = '';

    const trigger = videoTrigger;
    videoTrigger = null;
    if (trigger && document.contains(trigger)) trigger.focus();
  }

  const modalVideo = document.getElementById('modalVideo');
  const btnCerrarVideo = document.getElementById('btnCerrarVideo');
  btnCerrarVideo.addEventListener('click', cerrarVideo);
  document.querySelectorAll('[data-video]').forEach((boton) => {
    boton.addEventListener('click', () => abrirVideo(boton.dataset.video));
  });
  modalVideo.addEventListener('click', (e) => {
    if (e.target === modalVideo) cerrarVideo();
  });
  document.addEventListener('keydown', (e) => {
    if (!modalVideo.classList.contains('active')) return;
    if (e.key === 'Escape') { cerrarVideo(); return; }
    if (e.key !== 'Tab') return;
    const enfocados = Array.from(modalVideo.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])'))
      .filter((elemento) => elemento.getClientRects().length > 0);
    if (!enfocados.length) { e.preventDefault(); btnCerrarVideo.focus(); return; }
    const primero = enfocados[0];
    const ultimo = enfocados[enfocados.length - 1];
    if (e.shiftKey && (document.activeElement === primero || !modalVideo.contains(document.activeElement))) {
      e.preventDefault();
      ultimo.focus();
    } else if (!e.shiftKey && (document.activeElement === ultimo || !modalVideo.contains(document.activeElement))) {
      e.preventDefault();
      primero.focus();
    }
  });
  document.addEventListener('focusin', (e) => {
    if (modalVideo.classList.contains('active') && !modalVideo.contains(e.target)) btnCerrarVideo.focus();
  });
  document.querySelectorAll('[data-guia-destino]').forEach((boton) => {
    boton.addEventListener('click', () => {
      destinoGuiaPendiente = boton.dataset.guiaDestino;
      abrirAcceso('login');
    });
  });
