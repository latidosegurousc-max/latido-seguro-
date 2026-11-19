    // Puntos de farmacia en un mapa de búsqueda de Google Maps.
    const farmacias = document.getElementById('farmacias');
    const contactoProfesionales = document.getElementById('contactoProfesionales');
    const mapaFarmacias = document.getElementById('mapaFarmacias');
    const enlaceFarmacias = document.getElementById('enlaceFarmacias');
    const origenFarmacia = document.getElementById('origenFarmacia');
    const notaFarmacia = document.getElementById('notaFarmacia');

    function abrirFarmacias() {
      document.body.classList.add('vista-interna');
      panel.hidden = true;
      farmacias.hidden = false;
      window.scrollTo({ top: 0, behavior: 'auto' });
    }

    document.getElementById('btnVolverFarmacias').addEventListener('click', () => {
      farmacias.hidden = true;
      panel.hidden = false;
      document.body.classList.remove('vista-interna');
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
      document.body.classList.add('vista-interna');
      panel.hidden = true;
      contactoProfesionales.hidden = false;
      window.scrollTo({ top: 0, behavior: 'auto' });
    }

    document.getElementById('btnVolverProfesionales').addEventListener('click', () => {
      contactoProfesionales.hidden = true;
      panel.hidden = false;
      document.body.classList.remove('vista-interna');
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


    // Navegación superior compartida por la página pública y las vistas internas.
    (() => {
      const paginaPublicaNavegacion = document.getElementById('pagina-publica');
      const rutasNavegacion = {
        nosotros: document.getElementById('sobreNosotros'),
        ayuda: document.getElementById('seccionAyuda'),
        contacto: document.getElementById('seccionContacto')
      };

      function ocultarPanelesNavegacion() {
        document.querySelectorAll('.panel').forEach((vista) => { vista.hidden = true; });
      }

      function mostrarVistaPublicaNavegacion(id) {
        ocultarPanelesNavegacion();
        document.querySelectorAll('#pagina-publica > .vista-publica').forEach((vista) => {
          vista.hidden = vista.id !== id;
        });
        paginaPublicaNavegacion.style.display = 'block';
        document.body.classList.toggle('vista-interna', id !== 'inicio');
        window.scrollTo({ top: 0, behavior: 'auto' });
      }

      function mostrarInicioNavegacion() {
        ocultarPanelesNavegacion();
        if (document.body.classList.contains('sesion-activa')) {
          document.body.classList.remove('vista-interna');
          paginaPublicaNavegacion.style.display = 'none';
          document.getElementById('panel').hidden = false;
          window.scrollTo({ top: 0, behavior: 'auto' });
          return;
        }
        mostrarVistaPublicaNavegacion('inicio');
      }

      function mostrarServiciosNavegacion() {
        mostrarVistaPublicaNavegacion('servicios');
      }

      function mostrarSeccionNavegacion(nombre) {
        const vista = rutasNavegacion[nombre];
        if (!vista) return;
        ocultarPanelesNavegacion();
        document.querySelectorAll('#pagina-publica > .vista-publica').forEach((vistaPublica) => {
          vistaPublica.hidden = true;
        });
        paginaPublicaNavegacion.style.display = 'none';
        document.body.classList.add('vista-interna');
        vista.hidden = false;
        window.scrollTo({ top: 0, behavior: 'auto' });
      }

      document.querySelectorAll('.ls-nav a').forEach((enlace) => {
        enlace.addEventListener('click', (evento) => {
          evento.preventDefault();
          const destino = enlace.getAttribute('href').slice(1);
          if (destino === 'inicio') mostrarInicioNavegacion();
          else if (destino === 'servicios') mostrarServiciosNavegacion();
          else mostrarSeccionNavegacion(destino);
        });
      });

      document.querySelector('.ls-brand').addEventListener('click', (evento) => {
        evento.preventDefault();
        mostrarInicioNavegacion();
      });

      document.getElementById('btnIniciar').addEventListener('click', (evento) => {
        evento.preventDefault();
        abrirAcceso('login');
      });

      document.querySelector('.ls-hero-cta').addEventListener('click', (evento) => {
        evento.preventDefault();
        mostrarServiciosNavegacion();
      });

      ['btnVolverInicio', 'btnVolverAyuda', 'btnVolverContacto'].forEach((id) => {
        document.getElementById(id).addEventListener('click', mostrarInicioNavegacion);
      });
    })();

    // ---- Lógica para la interfaz "Ayuda / Reportar Problema" ----
    (() => {
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
        const respuesta = await fetch(window.API_BASE_URL + '/api/reportar-problema', {
          method: 'POST',
          credentials: 'include',
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

      if (formReporte && mensajeReporte) {
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

    // Anima las vistas cuando pasan de ocultas a visibles.
    (() => {
      const selectoresVista = '#pagina-publica, .panel, #formAcceso, #formVerificacion, #datosRegistro, #formRecordatorio';

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
    // ---- Mensajes del Corazón Guía ----
    (() => {
      const guiaCorazon = document.getElementById('guiaCorazon');
      const textoGuiaCorazon = document.getElementById('textoGuiaCorazon');
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

      document.getElementById('cardCitas')?.addEventListener('click', () => {
        window.mostrarMensajeCorazon('Aquí puedes agendar y ver tus recordatorios.');
      });
      document.getElementById('cardCuidados')?.addEventListener('click', () => {
        window.mostrarMensajeCorazon('Aprende a cuidarte aquí.');
      });
    })();
