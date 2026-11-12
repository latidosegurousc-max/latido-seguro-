    // ---- Pantalla de citas y recordatorios ----
    const cardCitas = document.getElementById('cardCitas');
    const agenda = document.getElementById('agenda');
    const btnVolverAgenda = document.getElementById('btnVolverAgenda');
    const calendarioDias = document.getElementById('calendarioDias');
    const mesCalendario = document.getElementById('mesCalendario');
    const formRecordatorio = document.getElementById('formRecordatorio');
    const fechaRecordatorio = document.getElementById('fechaRecordatorio');
    const horaRecordatorio = document.getElementById('horaRecordatorio');
    const detalleRecordatorio = document.getElementById('detalleRecordatorio');
    const canalRecordatorio = document.getElementById('canalRecordatorio');
    const campoContacto = document.getElementById('campoContacto');
    const labelContacto = document.getElementById('labelContacto');
    const contactoRecordatorio = document.getElementById('contactoRecordatorio');
    const agendaMensaje = document.getElementById('agendaMensaje');
    const recordatoriosDia = document.getElementById('recordatoriosDia');
    const tituloRecordatoriosDia = document.getElementById('tituloRecordatoriosDia');
    const opcionesAgenda = document.querySelectorAll('.agenda-opcion');
    const hoy = new Date();
    let fechaSeleccionada = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    let mesVisible = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    let tipoRecordatorio = '';
    let recordatorios = [];
    let fechaConfirmada = '';
    let contactoInfo = null;
    let guardandoRecordatorio = false;
    let claveSolicitud = nuevaClaveSolicitud();
    let confirmacionPendiente = null;
    const agendaAviso = document.getElementById('agendaAviso');
    const fechaConfirmadaTexto = document.getElementById('fechaConfirmadaTexto');
    const campoDestino = document.getElementById('campoDestino');
    const textoDestino = document.getElementById('textoDestino');
    const labelUsarOtro = document.getElementById('labelUsarOtro');
    const usarOtroContacto = document.getElementById('usarOtroContacto');
    const textoUsarOtro = document.getElementById('textoUsarOtro');
    const avisoCanal = document.getElementById('avisoCanal');
    const notaCanal = document.getElementById('notaCanal');
    const modalFecha = document.getElementById('modalConfirmarFecha');
    const modalFechaTexto = document.getElementById('modalFechaTexto');
    const btnConfirmarFecha = document.getElementById('btnConfirmarFecha');
    const btnCancelarFecha = document.getElementById('btnCancelarFecha');
    const TIPOS_CITA = ['Cita de control', 'Cita prioritaria'];

    function mostrarMensajeAgenda(lineas) {
      const destino = formRecordatorio.hidden ? agendaAviso : agendaMensaje;
      agendaAviso.replaceChildren();
      agendaMensaje.replaceChildren();
      lineas.forEach(([nivel, texto]) => {
        const linea = document.createElement('span');
        linea.dataset.nivel = nivel;
        linea.textContent = texto;
        destino.appendChild(linea);
      });
    }

    function horaLegible12(hora) {
      const [h, m] = hora.split(':').map(Number);
      return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'a. m.' : 'p. m.'}`;
    }

    function fechaHoraAviso(texto) {
      const [fecha, hora] = texto.split(' ');
      const [anio, mes, dia] = fecha.split('-');
      return `${dia}/${mes}/${anio} a las ${horaLegible12(hora)}`;
    }

    const ETIQUETA_AVISO = { CONFIRMACION: 'Confirmación', RECORDATORIO_DIA: 'Recordatorio del día de la cita', RECORDATORIO: 'Aviso a la hora indicada' };

    function describirAviso(aviso) {
      const descripcion = describirAvisoBase(aviso);
      descripcion.texto = descripcion.texto.replace(/\.\.$/, '.'); // evita "p. m.."
      return descripcion;
    }

    function describirAvisoBase(aviso) {
      const nombre = ETIQUETA_AVISO[aviso.clase] || 'Aviso';
      const o = aviso.clase === 'CONFIRMACION' ? 'a' : 'o';
      const motivo = aviso.motivo ? ` (${aviso.motivo})` : '';
      switch (aviso.estado) {
        case 'ENVIADO': return { nivel: 'ok', texto: `${nombre} por ${aviso.canal}: enviad${o} el ${fechaHoraAviso(aviso.enviada_en)}.` };
        case 'PROCESANDO': return { nivel: 'info', texto: `${nombre} por ${aviso.canal}: enviándose ahora.` };
        case 'PENDIENTE':
          return aviso.intentos > 0
            ? { nivel: 'info', texto: `${nombre} por ${aviso.canal}: pendiente, se reintentará automáticamente${motivo}.` }
            : aviso.clase === 'CONFIRMACION'
              ? { nivel: 'info', texto: `${nombre} por ${aviso.canal}: pendiente de envío.` }
              : { nivel: 'info', texto: `${nombre} por ${aviso.canal}: programad${o} para el ${fechaHoraAviso(aviso.programada_para)}.` };
        case 'FALLIDO': return { nivel: 'error', texto: `${nombre} por ${aviso.canal}: no se pudo enviar${motivo}.` };
        case 'SIN_CONFIGURAR': return { nivel: 'error', texto: `${nombre} por ${aviso.canal}: no se enviará. ${aviso.motivo || 'El servicio de mensajería no está configurado.'}` };
        case 'VENCIDO': return { nivel: 'info', texto: `${nombre} por ${aviso.canal}: ya no se enviará porque pasó el momento útil.` };
        default: return { nivel: 'info', texto: `${nombre} por ${aviso.canal}: ${aviso.estado}.` };
      }
    }

    function resumenGuardado(recordatorio, creado) {
      const lineas = [['ok', creado === false
        ? 'Esta solicitud ya estaba guardada; no se creó una cita duplicada.'
        : (recordatorio.es_cita ? 'Tu cita quedó guardada.' : 'Tu recordatorio quedó guardado.')]];
      const avisos = recordatorio.notificaciones || [];
      avisos.forEach((aviso) => {
        const { nivel, texto } = describirAviso(aviso);
        lineas.push([nivel, texto]);
      });
      if (recordatorio.es_cita && !avisos.some((a) => a.clase === 'RECORDATORIO_DIA')) {
        lineas.push(['info', 'No se programó el recordatorio del día porque la cita es muy próxima.']);
      }
      return lineas;
    }

    function actualizarFechaConfirmadaTexto() {
      fechaConfirmadaTexto.textContent = fechaConfirmada ? `Fecha confirmada: ${nombreFecha(fechaConfirmada)}` : '';
    }

    function actualizarNotaCanal() {
      notaCanal.textContent = TIPOS_CITA.includes(tipoRecordatorio)
        ? 'La cita queda guardada en tu cuenta. Al guardarla recibirás un aviso de confirmación y, el día de la cita, un recordatorio automático (hora de Colombia).'
        : 'El recordatorio queda guardado en tu cuenta y recibirás un aviso a la hora indicada (hora de Colombia).';
    }

    // ---- Confirmación de la fecha elegida ----
    function pedirConfirmacionFecha(textoFecha, origen) {
      const esCita = !tipoRecordatorio || TIPOS_CITA.includes(tipoRecordatorio);
      modalFechaTexto.textContent = `¿Estás seguro de que deseas programar tu ${esCita ? 'cita' : 'recordatorio'} para el ${nombreFecha(textoFecha).toLowerCase()}?`;
      confirmacionPendiente = { fecha: textoFecha, origen };
      if (!modalFecha.open) modalFecha.showModal();
    }

    function aplicarFechaConfirmada(textoFecha) {
      fechaConfirmada = textoFecha;
      fechaSeleccionada = fechaDesdeTexto(textoFecha);
      mesVisible = new Date(fechaSeleccionada.getFullYear(), fechaSeleccionada.getMonth(), 1);
      fechaRecordatorio.value = textoFecha;
      claveSolicitud = nuevaClaveSolicitud();
      actualizarFechaConfirmadaTexto();
      dibujarCalendario();
      dibujarRecordatoriosDia();
      mostrarMensajeAgenda([['ok', tipoRecordatorio
        ? `Fecha confirmada: ${nombreFecha(textoFecha)}. Completa los datos y guarda.`
        : `Fecha confirmada: ${nombreFecha(textoFecha)}. Ahora elige qué quieres programar.`]]);
      const destino = tipoRecordatorio ? horaRecordatorio : document.querySelector('.agenda-opcion');
      if (destino) destino.focus({ preventScroll: false });
    }

    function cancelarConfirmacionFecha() {
      const pendiente = confirmacionPendiente;
      confirmacionPendiente = null;
      if (modalFecha.open) modalFecha.close();
      if (!pendiente) return;
      if (pendiente.origen === 'campo') {
        fechaRecordatorio.value = fechaConfirmada;
        fechaRecordatorio.focus();
      } else {
        const dia = calendarioDias.querySelector('.dia-calendario.seleccionado');
        if (dia) dia.focus();
      }
    }

    btnConfirmarFecha.addEventListener('click', () => {
      const pendiente = confirmacionPendiente;
      confirmacionPendiente = null;
      if (modalFecha.open) modalFecha.close();
      if (pendiente) aplicarFechaConfirmada(pendiente.fecha);
    });
    btnCancelarFecha.addEventListener('click', cancelarConfirmacionFecha);
    modalFecha.addEventListener('close', () => { if (confirmacionPendiente) cancelarConfirmacionFecha(); });
    modalFecha.addEventListener('click', (e) => { if (e.target === modalFecha) cancelarConfirmacionFecha(); });


    async function solicitarApiRecordatorios(ruta, opciones = {}) {
      let respuesta;
      try {
        respuesta = await fetch(window.API_BASE_URL + ruta, {
          ...opciones,
          credentials: 'include',
          headers: {
            ...(opciones.headers || {}),
            ...(opciones.body ? { 'Content-Type': 'application/json' } : {})
          }
        });
      } catch (error) {
        throw new Error('No se pudo conectar con el servidor. Ejecuta python mi_paciente_server.py y vuelve a intentarlo.');
      }
      const datos = await respuesta.json().catch(() => null);
      if (!respuesta.ok) {
        throw new Error(datos?.error || `El servidor respondió con el estado ${respuesta.status}.`);
      }
      return datos || {};
    }

    async function cargarRecordatorios() {
      try {
        const datos = await solicitarApiRecordatorios('/recordatorios');
        recordatorios = Array.isArray(datos.recordatorios) ? datos.recordatorios : [];
      } catch (error) {
        recordatorios = [];
        mostrarMensajeAgenda([['error', error.message]]);
      }
      dibujarCalendario();
      dibujarRecordatoriosDia();
    }

    function abrirAgenda() {
      document.body.classList.add('vista-interna');
      panel.hidden = true;
      agenda.hidden = false;
      // Cada visita exige elegir y confirmar la fecha de nuevo.
      fechaConfirmada = '';
      tipoRecordatorio = '';
      formRecordatorio.hidden = true;
      opcionesAgenda.forEach((opcion) => opcion.setAttribute('aria-pressed', 'false'));
      mostrarMensajeAgenda([]);
      dibujarCalendario();
      dibujarRecordatoriosDia();
      void cargarRecordatorios();
      void cargarContactoNotificaciones();
      window.scrollTo({ top: 0, behavior: 'auto' });
    }

    cardCitas.addEventListener('click', abrirAgenda);
    cardCitas.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        abrirAgenda();
      }
    });

    btnVolverAgenda.addEventListener('click', () => {
      document.body.classList.remove('vista-interna');
      agenda.hidden = true;
      panel.hidden = false;
      window.scrollTo({ top: 0, behavior: 'auto' });
    });

    function dibujarCalendario() {
      const mesNombre = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' }).format(mesVisible);
      mesCalendario.textContent = mesNombre.charAt(0).toUpperCase() + mesNombre.slice(1);
      calendarioDias.replaceChildren();

      const primerDia = new Date(mesVisible.getFullYear(), mesVisible.getMonth(), 1);
      const inicioSemana = (primerDia.getDay() + 6) % 7;
      const inicio = new Date(mesVisible.getFullYear(), mesVisible.getMonth(), 1 - inicioSemana);
      const hoyTexto = fechaLocal(ahoraBogota());

      for (let i = 0; i < 42; i++) {
        const fechaDia = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i);
        const textoFecha = fechaLocal(fechaDia);
        const cantidad = recordatorios.filter((item) => item.fecha === textoFecha).length;
        const boton = document.createElement('button');
        boton.type = 'button';
        boton.className = 'dia-calendario';
        boton.setAttribute('aria-pressed', textoFecha === fechaLocal(fechaSeleccionada) ? 'true' : 'false');
        boton.setAttribute('aria-label', `${nombreFecha(textoFecha)}${cantidad ? `, ${cantidad} recordatorios` : ''}`);
        if (fechaDia.getMonth() !== mesVisible.getMonth()) boton.classList.add('otro-mes');
        if (textoFecha === hoyTexto) boton.classList.add('hoy');
        if (textoFecha === fechaLocal(fechaSeleccionada)) boton.classList.add('seleccionado');

        const numero = document.createElement('span');
        numero.className = 'dia-numero';
        numero.textContent = fechaDia.getDate();
        const marca = document.createElement('span');
        marca.className = 'dia-contador';
        marca.textContent = cantidad ? String(cantidad) : '';
        boton.append(numero, marca);
        boton.addEventListener('click', () => {
          fechaSeleccionada = fechaDia;
          mesVisible = new Date(fechaDia.getFullYear(), fechaDia.getMonth(), 1);
          dibujarCalendario();
          dibujarRecordatoriosDia();
          if (textoFecha < fechaLocal(ahoraBogota())) {
            mostrarMensajeAgenda([['info', 'Esa fecha ya pasó: puedes consultar tus recordatorios, pero no programar citas en ella.']]);
            return;
          }
          pedirConfirmacionFecha(textoFecha, 'calendario');
        });
        calendarioDias.appendChild(boton);
      }
    }

    document.getElementById('mesAnterior').addEventListener('click', () => {
      mesVisible = new Date(mesVisible.getFullYear(), mesVisible.getMonth() - 1, 1);
      fechaSeleccionada = new Date(mesVisible.getFullYear(), mesVisible.getMonth(), 1);
      dibujarCalendario();
      dibujarRecordatoriosDia();
    });

    document.getElementById('mesSiguiente').addEventListener('click', () => {
      mesVisible = new Date(mesVisible.getFullYear(), mesVisible.getMonth() + 1, 1);
      fechaSeleccionada = new Date(mesVisible.getFullYear(), mesVisible.getMonth(), 1);
      dibujarCalendario();
      dibujarRecordatoriosDia();
    });

    opcionesAgenda.forEach((opcion) => {
      opcion.addEventListener('click', () => {
        if (!fechaConfirmada) {
          mostrarMensajeAgenda([['info', 'Primero elige un día en el calendario y confírmalo para continuar.']]);
          calendarioDias.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
        tipoRecordatorio = opcion.dataset.tipo;
        opcionesAgenda.forEach((otra) => otra.setAttribute('aria-pressed', otra === opcion ? 'true' : 'false'));
        document.getElementById('tituloFormulario').textContent = `Nuevo recordatorio: ${tipoRecordatorio}`;
        formRecordatorio.hidden = false;
        fechaRecordatorio.min = fechaLocal(ahoraBogota());
        fechaRecordatorio.value = fechaConfirmada;
        detalleRecordatorio.value = '';
        canalRecordatorio.value = '';
        contactoRecordatorio.value = '';
        usarOtroContacto.checked = false;
        claveSolicitud = nuevaClaveSolicitud();
        mostrarMensajeAgenda([]);
        actualizarFechaConfirmadaTexto();
        actualizarNotaCanal();
        actualizarCampoContacto();

        // Mostrar u ocultar el especialista según el tipo
        const campoEspecialista = document.getElementById('campoEspecialista');
        const selectEspecialista = document.getElementById('especialistaRecordatorio');

        if (tipoRecordatorio === 'Cita de control') {
          campoEspecialista.hidden = false;
          selectEspecialista.required = true;
        } else {
          campoEspecialista.hidden = true;
          selectEspecialista.required = false;
          selectEspecialista.value = '';
        }
        // Deslizar suavemente hacia el formulario
        setTimeout(() => {
          formRecordatorio.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      });
    });

    // El aviso se envía por defecto al teléfono/correo registrado; el paciente puede usar otro solo para esta cita.
    function destinoRegistradoUtil() {
      const canal = canalRecordatorio.value;
      if (!canal || !contactoInfo) return false;
      return canal === 'Correo electrónico' ? Boolean(contactoInfo.correo && contactoInfo.correo.valido) : Boolean(contactoInfo.telefono && contactoInfo.telefono.valido);
    }

    function actualizarCampoContacto() {
      const canal = canalRecordatorio.value;
      avisoCanal.hidden = true;
      avisoCanal.textContent = '';
      if (!canal) {
        campoDestino.hidden = true;
        campoContacto.hidden = true;
        contactoRecordatorio.required = false;
        return;
      }
      const esCorreo = canal === 'Correo electrónico';
      const registrado = destinoRegistradoUtil();
      const usarOtro = !registrado || usarOtroContacto.checked;

      if (contactoInfo) {
        campoDestino.hidden = false;
        labelUsarOtro.hidden = !registrado;
        if (registrado) {
          const enmascarado = esCorreo ? contactoInfo.correo.enmascarado : contactoInfo.telefono.enmascarado;
          textoDestino.textContent = `Enviaremos los avisos a tu ${esCorreo ? 'correo registrado' : 'número registrado'}: ${enmascarado}`;
          textoUsarOtro.textContent = esCorreo ? 'Usar otro correo solo para esta cita' : 'Usar otro número solo para esta cita';
        } else if (esCorreo) {
          textoDestino.textContent = 'No pudimos usar el correo de tu cuenta. Escribe un correo para recibir los avisos.';
        } else if (!contactoInfo.telefono.registrado) {
          textoDestino.textContent = 'No tienes un número de celular registrado. Escribe uno para activar los avisos por teléfono.';
        } else {
          textoDestino.textContent = `El número registrado en tu cuenta (${contactoInfo.telefono.enmascarado}) no es válido. ${contactoInfo.telefono.problema} Escribe otro para activar los avisos por teléfono.`;
        }
        if (contactoInfo.canales_configurados && contactoInfo.canales_configurados[canal] === false) {
          avisoCanal.textContent = `El envío por ${canal} no está configurado en el servidor: tu cita se guardará, pero no se enviarán avisos hasta que se configure.`;
          avisoCanal.hidden = false;
        }
      } else {
        campoDestino.hidden = true; // sin datos del servidor: se pide el contacto manualmente
      }

      campoContacto.hidden = !usarOtro;
      contactoRecordatorio.required = usarOtro;
      if (esCorreo) {
        contactoRecordatorio.type = 'email';
        contactoRecordatorio.placeholder = 'nombre@correo.com';
        labelContacto.textContent = registrado ? 'Otro correo electrónico' : 'Correo electrónico';
        contactoRecordatorio.autocomplete = 'email';
      } else {
        contactoRecordatorio.type = 'tel';
        contactoRecordatorio.placeholder = 'Ej.: 300 123 4567';
        labelContacto.textContent = registrado ? (canal === 'WhatsApp' ? 'Otro número de WhatsApp' : 'Otro número de celular') : (canal === 'WhatsApp' ? 'Número de WhatsApp' : 'Número de celular');
        contactoRecordatorio.autocomplete = 'tel';
      }
    }

    canalRecordatorio.addEventListener('change', () => { usarOtroContacto.checked = false; actualizarCampoContacto(); });
    usarOtroContacto.addEventListener('change', () => {
      actualizarCampoContacto();
      if (usarOtroContacto.checked) contactoRecordatorio.focus();
    });

    async function cargarContactoNotificaciones() {
      try {
        contactoInfo = await solicitarApiRecordatorios('/api/contacto-notificaciones');
      } catch (error) {
        contactoInfo = null;
      }
      actualizarCampoContacto();
    }

    // Cambiar la fecha desde el formulario obliga a confirmarla de nuevo.
    fechaRecordatorio.addEventListener('change', () => {
      const nueva = fechaRecordatorio.value;
      if (!nueva) { fechaRecordatorio.value = fechaConfirmada; return; }
      if (nueva === fechaConfirmada) return;
      if (nueva < fechaLocal(ahoraBogota())) {
        fechaRecordatorio.value = fechaConfirmada;
        mostrarMensajeAgenda([['error', 'No puedes programar una cita en una fecha pasada.']]);
        return;
      }
      pedirConfirmacionFecha(nueva, 'campo');
    });

    function dibujarRecordatoriosDia() {
      const dia = fechaLocal(fechaSeleccionada);
      tituloRecordatoriosDia.textContent = `Recordatorios del ${nombreFecha(dia)}`;
      recordatoriosDia.replaceChildren();
      const delDia = recordatorios
        .filter((item) => item.fecha === dia)
        .sort((a, b) => a.hora.localeCompare(b.hora));

      if (!delDia.length) {
        const vacio = document.createElement('li');
        vacio.className = 'sin-recordatorios';
        vacio.textContent = 'No tienes recordatorios para este día.';
        recordatoriosDia.appendChild(vacio);
        return;
      }

      delDia.forEach((item) => {
        const fila = document.createElement('li');
        fila.className = 'recordatorio-item';
        const informacion = document.createElement('div');
        const titulo = document.createElement('strong');
        titulo.textContent = `${item.hora} · ${item.tipo}`;
        const especialista = document.createElement('span');
        especialista.textContent = item.especialista ? `Especialista: ${item.especialista}` : '';
        especialista.style.fontWeight = '600';
        especialista.style.color = 'var(--color-citas-recordatorios)';

        const detalle = document.createElement('span');
        detalle.textContent = item.detalle || 'Sin detalle adicional';
        const canal = document.createElement('span');
        canal.textContent = `${item.canal}: ${item.contacto}`;

        informacion.append(titulo, especialista, detalle, canal);
        (item.notificaciones || []).forEach((aviso) => {
          const { nivel, texto } = describirAviso(aviso);
          const estado = document.createElement('span');
          estado.className = 'aviso-estado';
          estado.dataset.nivel = nivel;
          estado.textContent = texto;
          informacion.appendChild(estado);
          if (aviso.estado === 'FALLIDO') {
            const reintentar = document.createElement('button');
            reintentar.type = 'button';
            reintentar.className = 'btn-reintentar-aviso';
            reintentar.textContent = 'Reintentar envío';
            reintentar.dataset.reintentar = aviso.id;
            informacion.appendChild(reintentar);
          }
        });

        const eliminar = document.createElement('button');
        eliminar.type = 'button';
        eliminar.className = 'btn-eliminar-recordatorio';
        eliminar.textContent = 'Eliminar';
        eliminar.setAttribute('aria-label', `Eliminar recordatorio de ${item.tipo} a las ${item.hora}`);
        eliminar.dataset.eliminar = item.id;
        fila.append(informacion, eliminar);
        recordatoriosDia.appendChild(fila);
      });
    }

    recordatoriosDia.addEventListener('click', async (e) => {
      const reintento = e.target.closest('[data-reintentar]');
      if (reintento) { await reintentarAviso(reintento); return; }
      const boton = e.target.closest('[data-eliminar]');
      if (!boton) return;
      boton.disabled = true;
      try {
        await solicitarApiRecordatorios('/eliminar-recordatorio', {
          method: 'POST',
          body: JSON.stringify({ id: boton.dataset.eliminar })
        });
        recordatorios = recordatorios.filter((item) => String(item.id) !== boton.dataset.eliminar);
      } catch (error) {
        boton.disabled = false;
        mostrarMensajeAgenda([['error', error.message]]);
        return;
      }
      dibujarCalendario();
      dibujarRecordatoriosDia();
    });

    async function reintentarAviso(boton) {
      boton.disabled = true;
      try {
        const datos = await solicitarApiRecordatorios('/reintentar-notificacion', {
          method: 'POST',
          body: JSON.stringify({ id: Number(boton.dataset.reintentar) })
        });
        recordatorios.forEach((item) => {
          item.notificaciones = (item.notificaciones || []).map((aviso) => aviso.id === datos.notificacion.id ? datos.notificacion : aviso);
        });
        const { nivel, texto } = describirAviso(datos.notificacion);
        mostrarMensajeAgenda([[nivel, texto]]);
      } catch (error) {
        mostrarMensajeAgenda([['error', error.message]]);
      }
      dibujarRecordatoriosDia();
    }

    formRecordatorio.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (guardandoRecordatorio) return;
      if (!formRecordatorio.reportValidity()) return;

      // La fecha del formulario debe ser la que el paciente confirmó.
      if (!fechaConfirmada || fechaRecordatorio.value !== fechaConfirmada) {
        if (fechaRecordatorio.value && fechaRecordatorio.value >= fechaLocal(ahoraBogota())) pedirConfirmacionFecha(fechaRecordatorio.value, 'campo');
        else mostrarMensajeAgenda([['error', 'Elige y confirma una fecha futura.']]);
        return;
      }
      const fechaHora = new Date(`${fechaRecordatorio.value}T${horaRecordatorio.value}:00`);
      if (fechaHora <= ahoraBogota()) {
        mostrarMensajeAgenda([['error', 'Elige una fecha y hora futuras (hora de Colombia).']]);
        return;
      }

      const usarRegistrado = destinoRegistradoUtil() && !usarOtroContacto.checked;
      const recordatorio = {
        tipo: tipoRecordatorio,
        fecha: fechaRecordatorio.value,
        hora: horaRecordatorio.value,
        especialista: document.getElementById('especialistaRecordatorio').value,
        detalle: detalleRecordatorio.value.trim(),
        canal: canalRecordatorio.value,
        usar_contacto_registrado: usarRegistrado,
        contacto: usarRegistrado ? '' : contactoRecordatorio.value.trim(),
        clave_solicitud: claveSolicitud
      };
      const botonGuardar = formRecordatorio.querySelector('button[type="submit"]');
      const textoBoton = botonGuardar.textContent;
      guardandoRecordatorio = true;
      botonGuardar.disabled = true;
      botonGuardar.textContent = 'Guardando…';
      formRecordatorio.setAttribute('aria-busy', 'true');
      let datos;
      try {
        datos = await solicitarApiRecordatorios('/guardar-recordatorio', {
          method: 'POST',
          body: JSON.stringify(recordatorio)
        });
      } catch (error) {
        mostrarMensajeAgenda([['error', error.message]]);
        return;
      } finally {
        guardandoRecordatorio = false;
        botonGuardar.disabled = false;
        botonGuardar.textContent = textoBoton;
        formRecordatorio.removeAttribute('aria-busy');
      }

      recordatorios = recordatorios.filter((item) => item.id !== datos.recordatorio.id);
      recordatorios.push(datos.recordatorio);
      fechaSeleccionada = fechaDesdeTexto(recordatorio.fecha);
      mesVisible = new Date(fechaSeleccionada.getFullYear(), fechaSeleccionada.getMonth(), 1);
      dibujarCalendario();
      dibujarRecordatoriosDia();
      formRecordatorio.reset();
      fechaRecordatorio.value = fechaConfirmada;
      usarOtroContacto.checked = false;
      claveSolicitud = nuevaClaveSolicitud();
      actualizarCampoContacto();
      mostrarMensajeAgenda(resumenGuardado(datos.recordatorio, datos.creado));
    });
