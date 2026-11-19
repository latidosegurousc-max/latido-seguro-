    const btnIniciar = document.getElementById('btnIniciar');
    const tabIniciar = document.getElementById('tabIniciar');
    const tabCrear = document.getElementById('tabCrear');
    const selectorModoAcceso = document.querySelector('.modo-acceso-header');
    const acceso = document.getElementById('acceso');
    const form = document.getElementById('formAcceso');
    const formVerificacion = document.getElementById('formVerificacion');
    const correoVerificacion = document.getElementById('correoVerificacion');
    const codigoVerificacion = document.getElementById('codigoVerificacion');
    const mensajeVerificacion = document.getElementById('mensajeVerificacion');
    const btnConfirmarVerificacion = document.getElementById('btnConfirmarVerificacion');
    const btnReenviarCodigo = document.getElementById('btnReenviarCodigo');
    let correoPendienteVerificacion = '';
    const correoAcceso = document.getElementById('correoAcceso');
    const clave = document.getElementById('clave');
    const btnMostrar = document.getElementById('btnMostrar');
    const textoBtnMostrar = document.getElementById('textoBtnMostrar');
    const mensaje = document.getElementById('mensaje');
    const tituloAcceso = document.getElementById('tituloAcceso');
    const ayudaAcceso = document.getElementById('ayudaAcceso');
    const tituloVerificacion = document.getElementById('tituloVerificacion');
    const ayudaVerificacion = document.getElementById('ayudaVerificacion');
    const ayudaClave = document.getElementById('ayudaClave');
    const btnContinuarRegistro = document.getElementById('btnContinuarRegistro');
    const btnEnviarAcceso = document.getElementById('btnEnviarAcceso');
    const necesitaServidor = window.location.protocol === 'file:';
    if (necesitaServidor) {
      document.getElementById('avisoServidor').hidden = false;
      btnIniciar.disabled = true;
      acceso.querySelectorAll('button').forEach((boton) => { boton.disabled = true; });
    }
    const datosRegistro = document.getElementById('datosRegistro');
    const camposRegistro = [
      document.getElementById('nombrePaciente'),
      document.getElementById('apellidoPaciente'),
      document.getElementById('tipoDocumento'),
      document.getElementById('documentoPaciente'),
      document.getElementById('celularPaciente')
    ];
    let modoAutenticacion = 'login';

    function abrirAcceso(modo) {
      if (necesitaServidor) return;
      modoAutenticacion = modo;
      form.hidden = false;
      formVerificacion.hidden = true;
      selectorModoAcceso.hidden = false;
      const creandoCuenta = modo === 'registro';
      tabIniciar.parentElement.dataset.modo = creandoCuenta ? 'registro' : 'login';
      tituloAcceso.textContent = creandoCuenta ? 'Crea tu cuenta' : 'Ingresa a tu cuenta';
      ayudaAcceso.textContent = creandoCuenta
        ? 'Registra tu correo y contraseña; después completa tus datos.'
        : 'Usa el correo personal y la contraseña de tu cuenta.';
      correoAcceso.autocomplete = creandoCuenta ? 'email' : 'username';
      clave.autocomplete = creandoCuenta ? 'new-password' : 'current-password';
      ayudaClave.hidden = !creandoCuenta;
      datosRegistro.hidden = true;
      camposRegistro.forEach((campo) => { campo.required = false; });
      btnContinuarRegistro.hidden = !creandoCuenta;
      btnEnviarAcceso.textContent = creandoCuenta ? 'Crear cuenta' : 'Iniciar sesión';
      tabIniciar.setAttribute('aria-pressed', String(!creandoCuenta));
      tabCrear.setAttribute('aria-pressed', String(creandoCuenta));
      tabIniciar.classList.toggle('tab-activo', !creandoCuenta);
      tabIniciar.classList.toggle('tab-inactivo', creandoCuenta);
      tabCrear.classList.toggle('tab-activo', creandoCuenta);
      tabCrear.classList.toggle('tab-inactivo', !creandoCuenta);
      btnIniciar.setAttribute('aria-expanded', 'true');
      form.reset();
      ocultarClave();
      mensaje.textContent = '';
      acceso.classList.add('abierto');
      setTimeout(() => {
        acceso.scrollIntoView({ behavior: 'smooth', block: 'start' });
        correoAcceso.focus({ preventScroll: true });
      }, 200);
    }

    function mostrarVerificacion(email, textoMensaje = '') {
      correoPendienteVerificacion = email;
      correoVerificacion.textContent = email;
      codigoVerificacion.value = '';
      mensajeVerificacion.textContent = textoMensaje;
      tituloVerificacion.textContent = 'Verifica tu correo';
      ayudaVerificacion.textContent = 'Tu cuenta quedará activa cuando confirmes el código.';
      form.hidden = true;
      formVerificacion.hidden = false;
      selectorModoAcceso.hidden = true;
      formVerificacion.scrollIntoView({ behavior: 'smooth', block: 'center' });
      codigoVerificacion.focus({ preventScroll: true });
    }

    btnIniciar.addEventListener('click', () => abrirAcceso('login'));
    tabIniciar.addEventListener('click', () => abrirAcceso('login'));
    tabCrear.addEventListener('click', () => abrirAcceso('registro'));

    const btnIrCrearCuenta = document.getElementById('btnIrCrearCuenta');
    const btnIrIniciarSesion = document.getElementById('btnIrIniciarSesion');
    const cardCrearCuenta = document.getElementById('cardCrearCuenta');

    if (btnIrCrearCuenta) {
      btnIrCrearCuenta.addEventListener('click', (event) => {
        event.stopPropagation();
        abrirAcceso('registro');
      });
    }

    if (btnIrIniciarSesion) {
      btnIrIniciarSesion.addEventListener('click', (event) => {
        event.stopPropagation();
        abrirAcceso('login');
      });
    }

    if (cardCrearCuenta) {
      cardCrearCuenta.addEventListener('click', (event) => {
        if (!event.target.closest('button')) abrirAcceso('registro');
      });
      cardCrearCuenta.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          abrirAcceso('registro');
        }
      });
    }

    btnMostrar.addEventListener('click', () => {
      const mostrarClave = clave.type !== 'text';
      clave.type = mostrarClave ? 'text' : 'password';
      textoBtnMostrar.textContent = mostrarClave ? 'Ocultar' : 'Mostrar';
      btnMostrar.setAttribute('aria-pressed', String(mostrarClave));
      btnMostrar.setAttribute('aria-label', mostrarClave ? 'Ocultar contraseña' : 'Mostrar contraseña');
    });

    function ocultarClave() {
      clave.type = 'password';
      textoBtnMostrar.textContent = 'Mostrar';
      btnMostrar.setAttribute('aria-pressed', 'false');
      btnMostrar.setAttribute('aria-label', 'Mostrar contraseña');
    }

    const elDocumentoPaciente = document.getElementById('documentoPaciente');
    if (elDocumentoPaciente) {
      elDocumentoPaciente.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/\D/g, '');
      });
    }

    const formatoClaveAdecuada = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{10,128}$/;

    btnContinuarRegistro.addEventListener('click', () => {
      mensaje.textContent = '';
      if (!correoAcceso.checkValidity()) {
        correoAcceso.reportValidity();
        return;
      }
      if (!formatoClaveAdecuada.test(clave.value)) {
        mensaje.textContent = 'La contraseña debe tener al menos 10 caracteres, con mayúscula, minúscula y número.';
        clave.focus();
        return;
      }
      datosRegistro.hidden = false;
      camposRegistro.forEach((campo) => { campo.required = true; });
      btnContinuarRegistro.hidden = true;
      btnEnviarAcceso.textContent = 'Finalizar registro';
      datosRegistro.scrollIntoView({ behavior: 'smooth', block: 'start' });
      document.getElementById('nombrePaciente').focus({ preventScroll: true });
    });

    async function enviarSolicitudApi(ruta, contenido) {
      let respuesta;
      try {
        respuesta = await fetch(window.API_BASE_URL + ruta, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(contenido)
        });
      } catch (error) {
        throw new Error('No se pudo conectar con el servidor. Verifica tu conexión e inténtalo de nuevo.');
      }
      const datos = await respuesta.json().catch(() => ({}));
      if (!respuesta.ok) {
        const error = new Error(datos.error || 'No fue posible completar la solicitud.');
        error.datos = datos;
        throw error;
      }
      return datos;
    }

    const paginaPublica = document.getElementById('pagina-publica');
    let destinoGuiaPendiente = null;
    const panel = document.getElementById('panel');
    const saludo = document.getElementById('saludo');
    const btnSalir = document.getElementById('btnSalir');

    function mostrarPanel(usuario) {
      window.usuarioLogueadoEmail = usuario?.email || '';
      document.body.classList.remove('vista-interna');
      const primerNombre = (usuario?.first_name || usuario?.email || 'paciente').trim().split(/\s+/)[0];
      saludo.textContent = 'Hola, ' + primerNombre;
      document.body.classList.add('sesion-activa');
      paginaPublica.style.display = 'none';
      panel.classList.remove('animar-entrada-panel');
      panel.hidden = false;
      void panel.offsetWidth;
      panel.classList.add('animar-entrada-panel');
      const destinoGuia = destinoGuiaPendiente;
      destinoGuiaPendiente = null;
      if (destinoGuia === 'citas') abrirAgenda();
      else if (destinoGuia === 'profesionales') abrirProfesionales();
      else if (destinoGuia === 'cuidados') abrirCuidados();
      window.scrollTo({ top: 0, behavior: 'auto' });
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (necesitaServidor) return;
      mensaje.textContent = '';

      if (!correoAcceso.checkValidity()) {
        correoAcceso.reportValidity();
        return;
      }
      if (!clave.value) {
        clave.reportValidity();
        return;
      }

      if (modoAutenticacion === 'registro') {
        if (datosRegistro.hidden) {
          mensaje.textContent = 'Pulsa “Continuar con mis datos” para completar el registro.';
          return;
        }
        if (!formatoClaveAdecuada.test(clave.value)) {
          mensaje.textContent = 'La contraseña debe tener al menos 10 caracteres, con mayúscula, minúscula y número.';
          clave.focus();
          return;
        }
        const campoInvalido = camposRegistro.find((campo) => !campo.checkValidity());
        if (campoInvalido) {
          campoInvalido.reportValidity();
          return;
        }
      }

      const eraRegistro = modoAutenticacion === 'registro';
      const ruta = eraRegistro ? '/api/register' : '/api/login';
      const contenido = eraRegistro
        ? {
            email: correoAcceso.value.trim(),
            password: clave.value,
            first_name: document.getElementById('nombrePaciente').value.trim(),
            last_name: document.getElementById('apellidoPaciente').value.trim(),
            document_type: document.getElementById('tipoDocumento').value,
            document_number: document.getElementById('documentoPaciente').value.trim(),
            phone: document.getElementById('celularPaciente').value.trim()
          }
        : { email: correoAcceso.value.trim(), password: clave.value };

      btnEnviarAcceso.disabled = true;
      btnEnviarAcceso.textContent = eraRegistro ? 'Creando cuenta…' : 'Ingresando…';
      try {
        const resultado = await enviarSolicitudApi(ruta, contenido);
        if (resultado.verification_required) {
          mostrarVerificacion(resultado.email || correoAcceso.value.trim(), resultado.mensaje || '');
          return;
        }
        mostrarPanel(resultado.user);
        form.reset();
        formVerificacion.reset();
        ocultarClave();
        datosRegistro.hidden = true;
        camposRegistro.forEach((campo) => { campo.required = false; });
      } catch (error) {
        if (error.datos?.verification_required) {
          mostrarVerificacion(
            error.datos.email || correoAcceso.value.trim(),
            error.message
          );
        } else {
          mensaje.textContent = error.message;
        }
      } finally {
        btnEnviarAcceso.disabled = false;
        btnEnviarAcceso.textContent = modoAutenticacion === 'registro'
          ? (datosRegistro.hidden ? 'Crear cuenta' : 'Finalizar registro')
          : 'Iniciar sesión';
      }
    });

    codigoVerificacion.addEventListener('input', () => {
      codigoVerificacion.value = codigoVerificacion.value.replace(/\D/g, '').slice(0, 6);
    });

    formVerificacion.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (necesitaServidor || !formVerificacion.reportValidity()) return;
      mensajeVerificacion.textContent = '';
      btnConfirmarVerificacion.disabled = true;
      btnConfirmarVerificacion.textContent = 'Verificando…';
      try {
        const resultado = await enviarSolicitudApi('/api/verify-email', {
          email: correoPendienteVerificacion,
          code: codigoVerificacion.value
        });
        mostrarPanel(resultado.user);
        form.reset();
        formVerificacion.reset();
        ocultarClave();
        datosRegistro.hidden = true;
        camposRegistro.forEach((campo) => { campo.required = false; });
      } catch (error) {
        mensajeVerificacion.textContent = error.message;
      } finally {
        btnConfirmarVerificacion.disabled = false;
        btnConfirmarVerificacion.textContent = 'Verificar correo';
      }
    });

    btnReenviarCodigo.addEventListener('click', async () => {
      btnReenviarCodigo.disabled = true;
      mensajeVerificacion.textContent = 'Enviando código…';
      try {
        const resultado = await enviarSolicitudApi('/api/resend-verification', {
          email: correoPendienteVerificacion
        });
        mensajeVerificacion.textContent = resultado.message || 'Enviamos un nuevo código.';
      } catch (error) {
        mensajeVerificacion.textContent = error.message;
      } finally {
        btnReenviarCodigo.disabled = false;
      }
    });

    document.getElementById('btnVolverAcceso').addEventListener('click', () => {
      formVerificacion.hidden = true;
      selectorModoAcceso.hidden = false;
      form.hidden = false;
      abrirAcceso('login');
    });

    btnSalir.addEventListener('click', async () => {
      window.usuarioLogueadoEmail = '';
      try {
        await fetch(window.API_BASE_URL + '/api/logout', { method: 'POST', credentials: 'include' });
      } catch (error) {
        // El panel se cierra localmente aunque el servidor ya no esté disponible.
      }
      panel.hidden = true;
      document.body.classList.remove('sesion-activa', 'vista-interna');
      paginaPublica.style.display = 'block';
      form.reset();
      formVerificacion.reset();
      mensaje.textContent = '';
      mensajeVerificacion.textContent = '';
      form.hidden = false;
      formVerificacion.hidden = true;
      selectorModoAcceso.hidden = false;
      ocultarClave();
      datosRegistro.hidden = true;
      camposRegistro.forEach((campo) => { campo.required = false; });
      acceso.classList.remove('abierto');
      acceso.style.display = '';
      btnIniciar.setAttribute('aria-expanded', 'false');
      modoAutenticacion = 'login';
      window.scrollTo({ top: 0, behavior: 'auto' });
    });

    document.addEventListener('DOMContentLoaded', () => {
      fetch(window.API_BASE_URL + '/api/me', { credentials: 'include' })
        .then((respuesta) => respuesta.ok ? respuesta.json() : null)
        .then((datos) => { if (datos?.user) mostrarPanel(datos.user); })
        .catch(() => { /* La autenticación requiere server.py. */ });
    });
