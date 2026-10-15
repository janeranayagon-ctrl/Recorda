let sesion = JSON.parse(localStorage.getItem('sesion'));
const GOOGLE_SHEETS_URL = 'https://script.google.com/macros/s/AKfycbzGJNKoE4Eip5JpxrlzF3s8i7yIevqGlwSWLH_lV2bJ5eWbcrLLIYOibN5tME2lXktadg/exec';
let sheetsUrl = localStorage.getItem('google_sheets_url') || GOOGLE_SHEETS_URL;
const CONFIG_KEY = 'recordarplus_config';
const configDefault = { idioma: 'es', tono: 'Campana', notificaciones: true };

function obtenerConfig() {
  try {
    const guardada = JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}');
    return { ...configDefault, ...guardada };
  } catch (error) {
    return { ...configDefault };
  }
}

function aplicarConfig() {
  const config = obtenerConfig();
  document.documentElement.lang = config.idioma || 'es';
}

function reproducirTonoNotificacion() {
  const config = obtenerConfig();
  if (!config.notificaciones) return;
  const tono = config.tono || 'Campana';
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;

  const audioCtx = new AudioCtx();
  const now = audioCtx.currentTime;
  const frecuenciaBase = { Campana: 880, Cristal: 1040, Digital: 660, Alarma: 220 }[tono] || 880;

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = tono === 'Digital' ? 'square' : tono === 'Alarma' ? 'sawtooth' : 'triangle';
  osc.frequency.setValueAtTime(frecuenciaBase, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.08, now + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + (tono === 'Alarma' ? 0.35 : 0.55));
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + (tono === 'Alarma' ? 0.4 : 0.6));

  setTimeout(() => audioCtx.close().catch(() => {}), 800);
}

async function activarNotificaciones() {
  const config = obtenerConfig();
  if (!config.notificaciones) return;
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') {
    await Notification.requestPermission();
  }
}

activarNotificaciones();
aplicarConfig();

function mostrarNotificacion(titulo, mensaje) {
  const config = obtenerConfig();
  if (!config.notificaciones) return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  new Notification(titulo, {
    body: mensaje,
    icon: 'icon-192.png',
    badge: 'icon-192.png'
  });

  reproducirTonoNotificacion();
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('service-worker.js').catch(error => {
    console.warn('No se pudo registrar el service worker:', error.message);
  });
}

if (sesion && !sesion.usuario_id) {
  const usuarios = JSON.parse(localStorage.getItem('usuarios')) || [];
  const usuarioActual = usuarios.find(usuario => usuario.correo === sesion.correo);
  if (usuarioActual) {
    sesion = usuarioActual;
    localStorage.setItem('sesion', JSON.stringify(sesion));
  }
}

if (!sesion) {
  window.location.href = 'login.html';
} else {
  const correo = sesion.correo || '';
  document.getElementById('saludo').innerHTML = `Hola, ${correo.split('@')[0]} 👋`;
  document.querySelector('.avatar').innerHTML = correo.charAt(0).toUpperCase() || '?';
  actualizarEstadoSync();
}

function actualizarEstadoSync(texto) {
  const estado = document.getElementById('syncStatus');
  if (estado) estado.textContent = texto || (sheetsUrl ? 'Google Sheets conectado' : 'Modo local activo');
}

async function sincronizarGoogleSheets(accion, datos) {
  if (!sheetsUrl) return false;
  try {
    const respuesta = await fetch(sheetsUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ accion, ...datos })
    });
    if (!respuesta.ok) throw new Error('Respuesta no válida');
    actualizarEstadoSync('Sincronizado con Google Sheets');
    return true;
  } catch (error) {
    actualizarEstadoSync('Guardado local; sincronización pendiente');
    console.warn('Google Sheets no disponible:', error.message);
    return false;
  }
}

function actualizarReloj() {
  const ahora = new Date();

  const hora = ahora.toLocaleTimeString('es-CO', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });

  const fecha = ahora.toLocaleDateString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });

  const horaEl = document.getElementById('hora');
  const fechaEl = document.getElementById('fecha');

  if (horaEl) horaEl.textContent = hora;
  if (fechaEl) fechaEl.textContent = fecha;
}

function mostrarProximoEvento() {
  const destino = document.getElementById('proximoEvento') || document.getElementById('proximo');
  if (!destino) return;

  const eventos = JSON.parse(localStorage.getItem('eventos')) || [];
  const eventosUsuario = sesion
    ? eventos.filter(evento => evento.usuario_id === sesion.usuario_id && !evento.completado)
    : eventos.filter(evento => !evento.completado);

  if (!eventosUsuario.length) {
    destino.textContent = 'No tienes eventos';
    return;
  }

  eventosUsuario.sort((a, b) => new Date(a.fecha + 'T' + a.hora) - new Date(b.fecha + 'T' + b.hora));

  const e = eventosUsuario[0];
  destino.textContent = `${e.titulo} · ${e.fecha} · ${e.hora}`;
}

actualizarReloj();
mostrarProximoEvento();
setInterval(actualizarReloj, 1000);

document.getElementById('btnInicio').onclick = () => {
  window.location.href = 'index.html';
};

document.getElementById('btnEventos').onclick = () => {
  window.location.href = 'mis_eventos.html';
};

document.getElementById('btnNuevo').onclick = () => {
  if (!sesion) return;
  if (!sesion.usuario_id) {
    alert('Tu sesión no tiene un usuario_id. Cierra sesión y vuelve a entrar.');
    return;
  }
  window.location.href = 'crear_evento.html';
};

document.getElementById('btnCampana').onclick = () => {
  window.location.href = 'notificaciones.html';
};

document.getElementById('btnPerfil').onclick = () => {
  window.location.href = 'perfil.html';
};
