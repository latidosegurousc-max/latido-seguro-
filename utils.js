window.API_BASE_URL = 'https://latido-seguro-api.onrender.com';

// Shared utilities and file:// notice.
if (window.location.protocol === 'file:') {
  const avisoServidor = document.getElementById('avisoServidor');
  if (avisoServidor) avisoServidor.hidden = false;
}

function nuevaClaveSolicitud() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
// Hora de Colombia (America/Bogota) como "hora de pared", sin depender de la zona del navegador.
function ahoraBogota() {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date());
  const v = Object.fromEntries(partes.map((p) => [p.type, p.value]));
  return new Date(Number(v.year), Number(v.month) - 1, Number(v.day), Number(v.hour), Number(v.minute), Number(v.second));
}
function fechaLocal(fecha) {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

function fechaDesdeTexto(texto) {
  const [anio, mes, dia] = texto.split('-').map(Number);
  return new Date(anio, mes - 1, dia);
}

function nombreFecha(texto) {
  const fecha = fechaDesdeTexto(texto);
  const nombre = new Intl.DateTimeFormat('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  }).format(fecha);
  return nombre.charAt(0).toUpperCase() + nombre.slice(1);
}
