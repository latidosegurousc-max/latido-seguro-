    // ---- Pantalla de necesidades urgentes ----
    const cardUrgencias = document.getElementById('cardUrgencias');
    const urgencias = document.getElementById('urgencias');
    const btnVolverUrgencias = document.getElementById('btnVolverUrgencias');
    const citaPrioritaria = document.getElementById('citaPrioritaria');
    const farmacias = document.getElementById('farmacias');
    const contactoProfesionales = document.getElementById('contactoProfesionales');

    function abrirUrgencias() {
      document.body.classList.add('vista-interna');
      panel.hidden = true;
      urgencias.hidden = false;
      window.scrollTo({ top: 0, behavior: 'auto' });
    }

    cardUrgencias.addEventListener('click', abrirUrgencias);
    cardUrgencias.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        abrirUrgencias();
      }
    });

    btnVolverUrgencias.addEventListener('click', () => {
      document.body.classList.remove('vista-interna');
      urgencias.hidden = true;
      panel.hidden = false;
      window.scrollTo({ top: 0, behavior: 'auto' });
    });

    // La cita prioritaria tiene su propio calendario, separado del de recordatorios.
    const calendarioCita = document.getElementById('calendarioCita');
    const mesCita = document.getElementById('mesCita');
    const tituloDiaCita = document.getElementById('tituloDiaCita');
    const mensajeDisponibilidad = document.getElementById('mensajeDisponibilidad');
    const horariosCita = document.getElementById('horariosCita');
    const formCitaPrioritaria = document.getElementById('formCitaPrioritaria');
    const estadoCita = document.getElementById('estadoCita');
    const HORARIOS_CITA_DEMO = [
      { valor: '09:00', texto: '9:00 a. m.' },
      { valor: '11:00', texto: '11:00 a. m.' },
      { valor: '14:30', texto: '2:30 p. m.' }
    ];
    const hoyCita = new Date();
    let mesCitaVisible = new Date(hoyCita.getFullYear(), hoyCita.getMonth(), 1);
    let fechaCitaSeleccionada = '';
    let horaCitaSeleccionada = '';

    function diaCitaDisponible(textoFecha) {
      const fecha = fechaDesdeTexto(textoFecha);
      const diaSemana = fecha.getDay();
      return textoFecha > fechaLocal(new Date()) && diaSemana !== 0 && diaSemana !== 6;
    }

    function dibujarCalendarioCita() {
      const nombreMes = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' }).format(mesCitaVisible);
      mesCita.textContent = nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1);
      calendarioCita.replaceChildren();

      const primerDia = new Date(mesCitaVisible.getFullYear(), mesCitaVisible.getMonth(), 1);
      const espacioInicial = (primerDia.getDay() + 6) % 7;
      const inicio = new Date(mesCitaVisible.getFullYear(), mesCitaVisible.getMonth(), 1 - espacioInicial);

      for (let indice = 0; indice < 42; indice++) {
        const fecha = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + indice);
        const fechaTexto = fechaLocal(fecha);
        const enMesActual = fecha.getMonth() === mesCitaVisible.getMonth();
        const disponible = enMesActual && diaCitaDisponible(fechaTexto);
        const boton = document.createElement('button');
        boton.type = 'button';
        boton.className = 'dia-prioritario';
        boton.disabled = !disponible;
        if (disponible) boton.classList.add('disponible');
        if (fechaTexto === fechaCitaSeleccionada) boton.classList.add('seleccionado');
        boton.setAttribute('aria-pressed', fechaTexto === fechaCitaSeleccionada ? 'true' : 'false');
        boton.setAttribute('aria-label', `${nombreFecha(fechaTexto)}${disponible ? ', disponibilidad de ejemplo' : ', no disponible'}`);
        const numero = document.createElement('span');
        numero.textContent = fecha.getDate();
        boton.appendChild(numero);
        if (disponible) {
          const marca = document.createElement('span');
          marca.className = 'marca-disponible';
          marca.setAttribute('aria-hidden', 'true');
          boton.appendChild(marca);
        }
        boton.addEventListener('click', () => {
          fechaCitaSeleccionada = fechaTexto;
          horaCitaSeleccionada = '';
          formCitaPrioritaria.hidden = true;
          estadoCita.textContent = '';
          dibujarCalendarioCita();
          dibujarHorariosCita();
        });
        calendarioCita.appendChild(boton);
      }
    }

    function dibujarHorariosCita() {
      horariosCita.replaceChildren();
      if (!fechaCitaSeleccionada) {
        tituloDiaCita.textContent = 'Selecciona una fecha';
        mensajeDisponibilidad.textContent = 'Elige un día hábil futuro en el calendario para ver los horarios.';
        return;
      }

      tituloDiaCita.textContent = nombreFecha(fechaCitaSeleccionada);
      mensajeDisponibilidad.textContent = 'Estos horarios son ilustrativos; la clínica debe confirmar disponibilidad.';
      HORARIOS_CITA_DEMO.forEach((horario) => {
        const boton = document.createElement('button');
        boton.type = 'button';
        boton.className = 'hora-disponible';
        boton.textContent = horario.texto;
        boton.setAttribute('aria-pressed', horario.valor === horaCitaSeleccionada ? 'true' : 'false');
        if (horario.valor === horaCitaSeleccionada) boton.classList.add('seleccionada');
        boton.addEventListener('click', () => {
          horaCitaSeleccionada = horario.valor;
          formCitaPrioritaria.hidden = false;
          estadoCita.textContent = '';
          dibujarHorariosCita();
        });
        horariosCita.appendChild(boton);
      });
    }

    function abrirCitaPrioritaria() {
      urgencias.hidden = true;
      citaPrioritaria.hidden = false;
      mesCitaVisible = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      fechaCitaSeleccionada = '';
      horaCitaSeleccionada = '';
      formCitaPrioritaria.reset();
      formCitaPrioritaria.hidden = true;
      estadoCita.textContent = '';
      dibujarCalendarioCita();
      dibujarHorariosCita();
      window.scrollTo({ top: 0, behavior: 'auto' });
    }

    document.getElementById('urgenciaCita').addEventListener('click', abrirCitaPrioritaria);
    document.getElementById('mesCitaAnterior').addEventListener('click', () => {
      mesCitaVisible = new Date(mesCitaVisible.getFullYear(), mesCitaVisible.getMonth() - 1, 1);
      fechaCitaSeleccionada = '';
      horaCitaSeleccionada = '';
      formCitaPrioritaria.hidden = true;
      dibujarCalendarioCita();
      dibujarHorariosCita();
    });
    document.getElementById('mesCitaSiguiente').addEventListener('click', () => {
      mesCitaVisible = new Date(mesCitaVisible.getFullYear(), mesCitaVisible.getMonth() + 1, 1);
      fechaCitaSeleccionada = '';
      horaCitaSeleccionada = '';
      formCitaPrioritaria.hidden = true;
      dibujarCalendarioCita();
      dibujarHorariosCita();
    });

    formCitaPrioritaria.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!formCitaPrioritaria.reportValidity()) return;
      if (!fechaCitaSeleccionada || !horaCitaSeleccionada) {
        estadoCita.textContent = 'Selecciona un día y una hora para continuar.';
        return;
      }

      const solicitud = {
        id: `${Date.now()}-${Math.random()}`,
        tipo: 'Cita prioritaria',
        fecha: fechaCitaSeleccionada,
        hora: horaCitaSeleccionada,
        nombre: document.getElementById('nombreCita').value.trim(),
        telefono: document.getElementById('telefonoCita').value.trim(),
        motivo: document.getElementById('motivoCita').value.trim()
      };
      let solicitudes = [];
      try {
        solicitudes = JSON.parse(localStorage.getItem('cardioContigoSolicitudesPrioritarias') || '[]');
        if (!Array.isArray(solicitudes)) solicitudes = [];
        solicitudes.push(solicitud);
        localStorage.setItem('cardioContigoSolicitudesPrioritarias', JSON.stringify(solicitudes));
        estadoCita.textContent = `Solicitud guardada en este navegador para ${nombreFecha(solicitud.fecha)} a las ${solicitud.hora}. No ha sido enviada ni confirmada por la clínica.`;
        formCitaPrioritaria.hidden = true;
      } catch (error) {
        estadoCita.textContent = 'No se pudo guardar la solicitud en este navegador.';
      }
    });

    document.getElementById('btnVolverCita').addEventListener('click', () => {
      citaPrioritaria.hidden = true;
      urgencias.hidden = false;
      window.scrollTo({ top: 0, behavior: 'auto' });
    });

    // Puntos de farmacia en un mapa de búsqueda de Google Maps.
    const mapaFarmacias = document.getElementById('mapaFarmacias');
    const enlaceFarmacias = document.getElementById('enlaceFarmacias');
    const origenFarmacia = document.getElementById('origenFarmacia');
    const notaFarmacia = document.getElementById('notaFarmacia');

    function abrirFarmacias() {
      urgencias.hidden = true;
      farmacias.hidden = false;
      window.scrollTo({ top: 0, behavior: 'auto' });
    }

    document.getElementById('urgenciaMedicamentos').addEventListener('click', abrirFarmacias);
    document.getElementById('btnVolverFarmacias').addEventListener('click', () => {
      farmacias.hidden = true;
      urgencias.hidden = false;
      window.scrollTo({ top: 0, behavior: 'auto' });
    });

    function mostrarFarmaciasCercanas(lugar) {
      const consulta = lugar ? `Cruz Verde cerca de ${lugar}, Cali` : 'Cruz Verde Cali';
      const consultaCodificada = encodeURIComponent(consulta);
      mapaFarmacias.src = `https://www.google.com/maps?q=${consultaCodificada}&hl=es&output=embed`;
      enlaceFarmacias.href = `https://www.google.com/maps/search/?api=1&query=${consultaCodificada}`;
      notaFarmacia.textContent = lugar ? `Mostrando resultados cerca de ${lugar}.` : 'Mostrando droguerías Cruz Verde en Cali.';
    }

    function buscarFarmaciaCercana() {
      const lugar = origenFarmacia.value.trim();
      if (lugar) {
        mostrarFarmaciasCercanas(lugar);
        return;
      }
      if (!navigator.geolocation) {
        notaFarmacia.textContent = 'Escribe tu dirección o barrio para buscar los puntos más cercanos.';
        origenFarmacia.focus();
        return;
      }
      notaFarmacia.textContent = 'Buscando tu ubicación…';
      navigator.geolocation.getCurrentPosition((posicion) => {
        const coordenadas = `${posicion.coords.latitude}, ${posicion.coords.longitude}`;
        mostrarFarmaciasCercanas(coordenadas);
      }, () => {
        notaFarmacia.textContent = 'No se pudo obtener tu ubicación. Escribe tu dirección o barrio para continuar.';
        origenFarmacia.focus();
      }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
    }

    document.getElementById('btnBuscarFarmacia').addEventListener('click', buscarFarmaciaCercana);
    origenFarmacia.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') buscarFarmaciaCercana();
    });

    // Contacto con profesionales de referencia.
    function abrirProfesionales() {
      urgencias.hidden = true;
      contactoProfesionales.hidden = false;
      window.scrollTo({ top: 0, behavior: 'auto' });
    }

    document.getElementById('urgenciaHablar').addEventListener('click', abrirProfesionales);
    document.getElementById('btnVolverProfesionales').addEventListener('click', () => {
      contactoProfesionales.hidden = true;
      urgencias.hidden = false;
      window.scrollTo({ top: 0, behavior: 'auto' });
    });

    // ---- Canales de contacto en la barra inferior ----
    const canalMensaje = document.getElementById('canalMensaje');

    document.querySelectorAll('.canal-oficial').forEach((boton) => {
      boton.addEventListener('click', () => {
        const canal = boton.dataset.canal;
        const datoNecesario = canal === 'Gmail' ? 'la dirección de correo oficial' :
          canal === 'WhatsApp' ? 'el número oficial de WhatsApp' :
          `el perfil oficial de ${canal}`;
        canalMensaje.textContent = `Falta configurar ${datoNecesario} de la clínica para activar este canal.`;
      });
    });

    // ---- Pantalla "Conoce más sobre tus cuidados" ----
    const cardCuidados = document.getElementById('cardCuidados');
    const cuidados = document.getElementById('cuidados');
    const btnVolver = document.getElementById('btnVolver');

    function abrirCuidados() {
      buscador.value = '';
      buscador.dispatchEvent(new Event('input'));
      document.body.classList.add('vista-interna');
      panel.hidden = true;
      cuidados.hidden = false;
      window.scrollTo({ top: 0, behavior: 'auto' });
    }

    cardCuidados.addEventListener('click', abrirCuidados);
    cardCuidados.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        abrirCuidados();
      }
    });

    btnVolver.addEventListener('click', () => {
      document.body.classList.remove('vista-interna');
      cuidados.hidden = true;
      panel.hidden = false;
      window.scrollTo({ top: 0, behavior: 'auto' });
    });

    // ---- Pantalla "Dónde estamos ubicados" ----
    const cardUbicacion = document.getElementById('cardUbicacion');
    const ubicacion = document.getElementById('ubicacion');
    const btnVolverUbicacion = document.getElementById('btnVolverUbicacion');
    const origen = document.getElementById('origen');
    const notaOrigen = document.getElementById('notaOrigen');
    const DESTINO_CLINICA = 'Al Alba Clínica, Cali, Colombia'; // debe coincidir con el lugar del mapa

    function abrirUbicacion() {
      document.body.classList.add('vista-interna');
      panel.hidden = true;
      ubicacion.hidden = false;
      window.scrollTo({ top: 0, behavior: 'auto' });
    }

    cardUbicacion.addEventListener('click', abrirUbicacion);
    cardUbicacion.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        abrirUbicacion();
      }
    });

    btnVolverUbicacion.addEventListener('click', () => {
      document.body.classList.remove('vista-interna');
      ubicacion.hidden = true;
      panel.hidden = false;
      window.scrollTo({ top: 0, behavior: 'auto' });
    });

    // "Cómo llegar": abre Google Maps con la ruta desde donde está el paciente hasta la clínica
    function irACalcularRuta() {
      const desde = origen.value.trim();
      if (!desde) {
        notaOrigen.textContent = 'Escribe tu dirección o barrio para trazar la ruta.';
        origen.focus();
        return;
      }
      notaOrigen.textContent = '';
      const url = 'https://www.google.com/maps/dir/?api=1&origin=' + encodeURIComponent(desde) +
                  '&destination=' + encodeURIComponent(DESTINO_CLINICA);
      window.open(url, '_blank', 'noopener');
    }

    document.getElementById('btnLlegar').addEventListener('click', irACalcularRuta);
    origen.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') irACalcularRuta();
    });


    // ---- Lógica para la interfaz "Sobre Nosotros" ----
    (() => {
      const btnNavNosotros = document.getElementById('btnNavNosotros');
      const seccionNosotros = document.getElementById('sobreNosotros');
      const btnVolverInicio = document.getElementById('btnVolverInicio');
      const paginaPublicaNosotros = document.getElementById('pagina-publica');

      if (btnNavNosotros && seccionNosotros && btnVolverInicio && paginaPublicaNosotros) {
        btnNavNosotros.addEventListener('click', (e) => {
          e.preventDefault();
          paginaPublicaNosotros.style.display = 'none';
          seccionNosotros.hidden = false;
          window.scrollTo({ top: 0, behavior: 'auto' });
        });

        btnVolverInicio.addEventListener('click', () => {
          seccionNosotros.hidden = true;
          paginaPublicaNosotros.style.display = 'block';
          window.scrollTo({ top: 0, behavior: 'auto' });
        });
      }
    })();
    // ---- Lógica para la interfaz "Ayuda / Reportar Problema" ----
    (() => {
      const btnNavAyuda = document.querySelector('.ls-nav a[href="#ayuda"]');
      const seccionAyuda = document.getElementById('seccionAyuda');
      const btnVolverAyuda = document.getElementById('btnVolverAyuda');
      const formReporte = document.getElementById('formReporte');
      const mensajeReporte = document.getElementById('mensajeReporte');
      const STORAGE_KEY = 'reportesTecnicos';

      function crearIdReporte() {
        return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
      }

      function leerReportesLocales() {
        try {
          const reportes = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
          if (!Array.isArray(reportes)) return [];
          let cambio = false;
          for (const reporte of reportes) {
            if (reporte && typeof reporte === 'object' && !reporte.id) {
              reporte.id = crearIdReporte();
              cambio = true;
            }
          }
          if (cambio) localStorage.setItem(STORAGE_KEY, JSON.stringify(reportes));
          return reportes.filter((reporte) => reporte && typeof reporte === 'object');
        } catch (error) {
          return [];
        }
      }

      function quitarReporteLocal(id) {
        try {
          const restantes = leerReportesLocales().filter((reporte) => reporte.id !== id);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(restantes));
        } catch (error) {
          // Si el navegador no permite borrar, el reporte seguirá en el respaldo local.
        }
      }

      async function enviarAlServidor(reporte) {
        const respuesta = await fetch('/api/reportar-problema', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: reporte.id, correo: reporte.correo, tipo: reporte.tipo, detalle: reporte.detalle })
        });
        if (!respuesta.ok) throw new Error('No se pudo enviar el reporte.');
      }

      async function reenviarPendientes() {
        if (!navigator.onLine) return;
        const pendientes = leerReportesLocales();
        for (const reporte of pendientes) {
          if (!reporte.tipo) continue;
          try {
            await enviarAlServidor(reporte);
            quitarReporteLocal(reporte.id);
          } catch (error) {
            return;
          }
        }
      }

      if (btnNavAyuda && seccionAyuda && btnVolverAyuda && formReporte && mensajeReporte) {
        btnNavAyuda.addEventListener('click', (e) => {
          e.preventDefault();
          const paginaPublica = document.getElementById('pagina-publica');
          if (paginaPublica) paginaPublica.style.display = 'none';
          seccionAyuda.hidden = false;
          window.scrollTo({ top: 0, behavior: 'auto' });
        });

        btnVolverAyuda.addEventListener('click', () => {
          seccionAyuda.hidden = true;
          const paginaPublica = document.getElementById('pagina-publica');
          if (paginaPublica) paginaPublica.style.display = 'block';
          window.scrollTo({ top: 0, behavior: 'auto' });
        });

        formReporte.addEventListener('submit', async (e) => {
          e.preventDefault();
          if (!formReporte.checkValidity()) {
            formReporte.reportValidity();
            return;
          }

          const correo = document.getElementById('correoPaciente').value.trim().toLowerCase();
          const tipo = document.getElementById('tipoProblema').value;
          const detalle = document.getElementById('detalleProblema').value.trim();
          const reporte = { id: crearIdReporte(), fecha: new Date().toISOString(), correo, tipo, detalle };
          const btn = document.getElementById('btnEnviarReporte');
          btn.disabled = true;
          btn.textContent = 'Enviando...';
          mensajeReporte.textContent = '';

          try {
            await enviarAlServidor(reporte);
            mensajeReporte.textContent = '¡Gracias! Tu reporte fue enviado al equipo técnico.';
            mensajeReporte.style.color = 'green';
            formReporte.reset();
          } catch (error) {
            try {
              const reportes = leerReportesLocales();
              reportes.push(reporte);
              localStorage.setItem(STORAGE_KEY, JSON.stringify(reportes));
              mensajeReporte.textContent = 'Reporte guardado en este navegador. Se reintentará cuando vuelva la conexión o al abrir de nuevo la página.';
              mensajeReporte.style.color = 'orange';
              formReporte.reset();
            } catch (errorLocal) {
              mensajeReporte.textContent = 'No se pudo enviar ni guardar el reporte. Intenta de nuevo.';
              mensajeReporte.style.color = 'red';
            }
          } finally {
            btn.disabled = false;
            btn.textContent = 'Enviar reporte';
          }
        });

        window.addEventListener('online', () => { void reenviarPendientes(); });
        void reenviarPendientes();
      }
    })();

    // ---- Lógica para la interfaz "Contacto" ----
    (() => {
      const btnNavContacto = document.querySelector('.ls-nav a[href="#contacto"]');
      const seccionContacto = document.getElementById('seccionContacto');
      const btnVolverContacto = document.getElementById('btnVolverContacto');
      const paginaPublicaContacto = document.getElementById('pagina-publica');

      if (btnNavContacto && seccionContacto && btnVolverContacto && paginaPublicaContacto) {
        btnNavContacto.addEventListener('click', (e) => {
          e.preventDefault();
          paginaPublicaContacto.style.display = 'none';
          seccionContacto.hidden = false;
          window.scrollTo({ top: 0, behavior: 'auto' });
        });

        btnVolverContacto.addEventListener('click', () => {
          seccionContacto.hidden = true;
          paginaPublicaContacto.style.display = 'block';
          window.scrollTo({ top: 0, behavior: 'auto' });
        });
      }
    })();
    // ---- Script para inyectar el logo en las pantallas internas ----
    document.addEventListener('DOMContentLoaded', () => {
      const vistasInternas = document.querySelectorAll('.panel');

      vistasInternas.forEach((vista) => {
        if (!vista.querySelector('.header-interno')) {
          const header = document.createElement('header');
          header.className = 'header-interno';
          header.innerHTML = `
            <div class="logo-interno">
              <img src="LOGO_SINL.png" alt="Logo Latido Seguro">
              <span>Latido Seguro</span>
            </div>
          `;
          vista.prepend(header);
        }
      });
    });
    // Anima las vistas cuando pasan de ocultas a visibles.
    (() => {
      const selectoresVista = '#pagina-publica, .panel, #formAcceso, #formVerificacion, #datosRegistro, #formRecordatorio, #formCitaPrioritaria';

      function procesarCambioVista(elemento) {
        if (!(elemento instanceof HTMLElement) || !elemento.matches(selectoresVista)) return;

        const visible = elemento.matches('#pagina-publica')
          ? getComputedStyle(elemento).display !== 'none'
          : !elemento.hidden && getComputedStyle(elemento).display !== 'none';

        if (!visible) {
          elemento.classList.remove('interfaz-entrada-suave');
          return;
        }

        elemento.classList.remove('interfaz-entrada-suave');
        void elemento.offsetWidth;
        elemento.classList.add('interfaz-entrada-suave');
        elemento.addEventListener('animationend', () => {
          elemento.classList.remove('interfaz-entrada-suave');
        }, { once: true });
      }

      const interfazEntradaObserver = new MutationObserver((cambios) => {
        for (const cambio of cambios) procesarCambioVista(cambio.target);
      });

      interfazEntradaObserver.observe(document.body, {
        subtree: true,
        attributes: true,
        attributeFilter: ['hidden', 'style']
      });
    })();
    // ---- Guía Interactiva para Preguntas Frecuentes y Corazón Guía ----
    (() => {
      const configurarGuia = () => {
        const btnIniciarGuia = document.getElementById('btnIniciarGuia');
        const guiaCorazon = document.getElementById('guiaCorazon');
        const textoGuiaCorazon = document.getElementById('textoGuiaCorazon');
        const guiaInteractiva = document.getElementById('guiaInteractiva');
        const buscadorEl = document.getElementById('buscador');
        const listaFaq = document.getElementById('faqLista');
        const tooltipBuscador = document.getElementById('tooltipBuscador');
        const tooltipResultados = document.getElementById('tooltipResultados');
        const tooltipAbrir = document.getElementById('tooltipAbrir');

        let temporizadorCorazon = null;
        window.mostrarMensajeCorazon = function(mensaje, duracion = 4000) {
          if (!guiaCorazon || !textoGuiaCorazon) return;
          if (temporizadorCorazon) window.clearTimeout(temporizadorCorazon);
          textoGuiaCorazon.textContent = mensaje;
          guiaCorazon.style.display = 'flex';
          guiaCorazon.style.opacity = '1';
          temporizadorCorazon = window.setTimeout(() => {
            guiaCorazon.style.opacity = '0';
            temporizadorCorazon = window.setTimeout(() => {
              guiaCorazon.style.display = 'none';
              temporizadorCorazon = null;
            }, 300);
          }, duracion);
        };

        if (btnIniciarGuia && buscadorEl && listaFaq && guiaInteractiva &&
            tooltipBuscador && tooltipResultados && tooltipAbrir) {
          const esperar = (milisegundos) =>
            new Promise((resolver) => window.setTimeout(resolver, milisegundos));
          const comportamientoScroll = window.matchMedia('(prefers-reduced-motion: reduce)').matches
            ? 'auto'
            : 'smooth';

          const posicionarTooltip = (tooltip, elemento, debajo = false) => {
            const rect = elemento.getBoundingClientRect();
            const topDeseado = window.scrollY + (debajo ? rect.bottom + 10 : rect.top - 45);
            const topMaximo = window.scrollY + window.innerHeight - tooltip.offsetHeight - 12;
            const leftMinimo = window.scrollX + 12;
            const leftMaximo = window.scrollX + window.innerWidth - tooltip.offsetWidth - 12;
            const leftDeseado = window.scrollX + rect.left + 20;
            tooltip.style.top = Math.max(window.scrollY + 8, Math.min(topDeseado, topMaximo)) + 'px';
            tooltip.style.left = Math.max(leftMinimo, Math.min(leftDeseado, leftMaximo)) + 'px';
          };

          const primerResultadoVisible = () =>
            Array.from(listaFaq.querySelectorAll('.faq-item'))
              .find((item) => !item.hidden && item.style.display !== 'none');

          const limpiarGuia = () => {
            tooltipBuscador.classList.remove('visible');
            tooltipResultados.classList.remove('visible');
            tooltipAbrir.classList.remove('visible');
            buscadorEl.classList.remove('resaltado-guia');
            listaFaq.querySelectorAll('.faq-item.resaltado-guia').forEach((item) => {
              item.classList.remove('resaltado-guia');
            });
            buscadorEl.value = '';
            buscadorEl.dispatchEvent(new Event('input', { bubbles: true }));
            guiaInteractiva.style.display = 'flex';
            btnIniciarGuia.disabled = false;
          };

          btnIniciarGuia.addEventListener('click', async () => {
            if (btnIniciarGuia.disabled) return;
            btnIniciarGuia.disabled = true;
            guiaInteractiva.style.display = 'none';

            try {
              window.mostrarMensajeCorazon('¡Hola! Te enseñaré a usar esta sección.', 3000);
              buscadorEl.scrollIntoView({ behavior: comportamientoScroll, block: 'center' });
              await esperar(500);

              buscadorEl.classList.add('resaltado-guia');
              posicionarTooltip(tooltipBuscador, buscadorEl);
              tooltipBuscador.classList.add('visible');

              buscadorEl.value = '';
              for (const caracter of 'cirugía') {
                buscadorEl.value += caracter;
                buscadorEl.dispatchEvent(new Event('input', { bubbles: true }));
                await esperar(150);
              }

              tooltipBuscador.classList.remove('visible');
              await esperar(800);
              buscadorEl.classList.remove('resaltado-guia');

              const primerFaqItem = primerResultadoVisible();
              if (!primerFaqItem) {
                window.mostrarMensajeCorazon('No encontré resultados para esta búsqueda.', 3500);
                await esperar(3500);
                return;
              }

              window.mostrarMensajeCorazon('¡Genial! Aquí ves los resultados.', 3500);
              primerFaqItem.scrollIntoView({ behavior: comportamientoScroll, block: 'center' });
              await esperar(500);
              primerFaqItem.classList.add('resaltado-guia');
              posicionarTooltip(tooltipResultados, primerFaqItem);
              tooltipResultados.classList.add('visible');

              await esperar(2500);
              tooltipResultados.classList.remove('visible');

              const botonPregunta = primerFaqItem.querySelector('.faq-pregunta');
              if (botonPregunta && !primerFaqItem.classList.contains('abierta')) {
                botonPregunta.click();
              }
              await esperar(150);
              posicionarTooltip(tooltipAbrir, primerFaqItem, true);
              tooltipAbrir.classList.add('visible');
              window.mostrarMensajeCorazon('Haz clic aquí para leer más.', 4000);
              await esperar(4000);
            } catch (error) {
              console.error('No se pudo completar la guía interactiva:', error);
            } finally {
              limpiarGuia();
            }
          });
        }

        const mostrarMensaje = window.mostrarMensajeCorazon;
        document.getElementById('cardCitas')?.addEventListener('click', () => {
          mostrarMensaje('Aquí puedes agendar y ver tus recordatorios.');
        });
        document.getElementById('cardUrgencias')?.addEventListener('click', () => {
          mostrarMensaje('En caso de emergencia, usa esta sección.');
        });
        document.getElementById('cardCuidados')?.addEventListener('click', () => {
          mostrarMensaje('Aprende a cuidarte aquí.');
        });
      };

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', configurarGuia, { once: true });
      } else {
        configurarGuia();
      }
    })();
