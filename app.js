/* Airport Announcer – ES/EN TTS + optional translation (LibreTranslate) */
const textInput = document.getElementById('textInput');
const textLang  = document.getElementById('textLang');
const dualLang  = document.getElementById('dualLang');
const voiceEs   = document.getElementById('voiceEs');
const voiceEn   = document.getElementById('voiceEn');
const rateEl    = document.getElementById('rate');
const pitchEl   = document.getElementById('pitch');
const volumeEl  = document.getElementById('volume');
const btnSpeakEs= document.getElementById('speakEs');
const btnTrans  = document.getElementById('translateSpeak');
const btnSpeakEn= document.getElementById('speakEn');
const btnPause  = document.getElementById('pauseResume');
const btnStop   = document.getElementById('stop');
const historyUl = document.getElementById('history');
const presetsDiv= document.getElementById('presets');
const testAudio = document.getElementById('testAudio');
const installBtn= document.getElementById('installBtn');


const chimeEl = document.getElementById('chime');
async function playChime(){
  try{
    chimeEl.currentTime = 0;
    await chimeEl.play();
    // Small wait so the chime finishes before TTS
    await new Promise(r => setTimeout(r, 700));
  }catch(e){ /* ignore autoplay issues */ }
}

// Optional translation endpoint (can be self-hosted):
const TRANSLATE_URL = localStorage.getItem('translate_url') || 'https://libretranslate.com/translate';
const TRANSLATE_ENABLED = true; // toggle if needed

let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBtn.style.display = 'inline-flex';
});
installBtn.addEventListener('click', async () => {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    installBtn.style.display = 'none';
  }
});

// Populate presets for quick use
const presets = [
  'Atención, comienza el embarque del vuelo FO*** con destino a ***, por puerta ***.',
  'Último llamado para el pasajero ***, del vuelo FO***, por favor presentarse en puerta ***.',
  'Recordamos tener preparados documento y tarjeta de embarque.',
  'El embarque se realizará por grupos. Por favor, aguarde su turno.',
  'Pasajeros con prioridad, familias con niños y personas con movilidad reducida, embarcan primero.'
];
function renderPresets() {
  presetsDiv.innerHTML = '';
  presets.forEach(p => {
    const b = document.createElement('button');
    b.textContent = p;
    b.addEventListener('click', () => {
      textInput.value = p;
      textInput.focus();
    });
    presetsDiv.appendChild(b);
  });
}
renderPresets();

// Get voices and auto-pick female if possible
function listVoices() {
  const voices = speechSynthesis.getVoices();
  const esVoices = voices.filter(v => v.lang.toLowerCase().startsWith('es'));
  const enVoices = voices.filter(v => v.lang.toLowerCase().startsWith('en'));
  fillSelect(voiceEs, esVoices, 'es');
  fillSelect(voiceEn, enVoices, 'en');
}
function fillSelect(select, voices, langCode) {
  const preferredNames = ['Google', 'Samantha', 'Zira', 'Jenny', 'Hazel','Helena','Laura','Paloma']; // common female-like
  select.innerHTML = '';
  voices.forEach((v, i) => {
    const opt = document.createElement('option');
    opt.value = v.name;
    opt.textContent = `${v.name} (${v.lang})`;
    select.appendChild(opt);
  });
  // Try to pick a likely female voice
  const pick = voices.find(v => /female|mujer|woman|girl/i.test(v.name))
    || voices.find(v => preferredNames.some(n => v.name.includes(n)))
    || voices[0];
  if (pick) select.value = pick.name;
}
speechSynthesis.addEventListener('voiceschanged', listVoices);
listVoices();

function speak(text, lang, voiceName) {
  if (!text) return;
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = lang;
  utter.rate = parseFloat(rateEl.value);
  utter.pitch = parseFloat(pitchEl.value);
  utter.volume = parseFloat(volumeEl.value);
  const v = speechSynthesis.getVoices().find(v => v.name === voiceName);
  if (v) utter.voice = v;
  speechSynthesis.speak(utter);
  addHistory(text, lang, voiceName);
}

function addHistory(text, lang, voice) {
  const li = document.createElement('li');
  const ts = new Date().toLocaleTimeString();
  li.innerHTML = `<strong>[${ts}] ${lang.toUpperCase()}</strong> — ${escapeHtml(text)} <br><small>Voz: ${voice || 'auto'}</small>`;
  historyUl.prepend(li);
}
function escapeHtml(s){return s.replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}

// Translate ES->EN using LibreTranslate-compatible API
async function translate(text, from='es', to='en') {
  if (!TRANSLATE_ENABLED) return text;
  try {
    const res = await fetch(TRANSLATE_URL, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ q: text, source: from, target: to, format: 'text' })
    });
    if (!res.ok) throw new Error('HTTP '+res.status);
    const data = await res.json();
    // libretranslate returns {translatedText: "..."} (single) or array; handle both
    const out = data.translatedText || (Array.isArray(data) ? data[0]?.translatedText : null);
    return out || text;
  } catch (e) {
    console.warn('Translation failed:', e);
    return text; // fallback: speak original
  }
}

// Buttons
btnSpeakEs.addEventListener('click', async () => {
  await playChime();
  stopSpeak();
  await ensureVoices();
  speak(textInput.value.trim(), 'es-AR', voiceEs.value || null);
  if (dualLang.value === 'en') {
    const en = await translate(textInput.value.trim(), 'es', 'en');
    speak('English version:', 'en-US', voiceEn.value || null);
    speak(en, 'en-US', voiceEn.value || null);
  }
});

btnTrans.addEventListener('click', async () => {
  await playChime();
  stopSpeak();
  await ensureVoices();
  const en = await translate(textInput.value.trim(), 'es', 'en');
  speak(en, 'en-US', voiceEn.value || null);
  if (dualLang.value === 'es') {
    speak('Versión en español:', 'es-AR', voiceEs.value || null);
    speak(textInput.value.trim(), 'es-AR', voiceEs.value || null);
  }
});

btnSpeakEn.addEventListener('click', async () => {
  await playChime();
  stopSpeak();
  await ensureVoices();
  speak(textInput.value.trim(), 'en-US', voiceEn.value || null);
  if (dualLang.value === 'es') {
    const es = await translate(textInput.value.trim(), 'en', 'es');
    speak('Versión en español:', 'es-AR', voiceEs.value || null);
    speak(es, 'es-AR', voiceEs.value || null);
  }
});

btnPause.addEventListener('click', () => {
  if (speechSynthesis.speaking) {
    if (speechSynthesis.paused) {
      speechSynthesis.resume();
      btnPause.textContent = 'Pausar';
    } else {
      speechSynthesis.pause();
      btnPause.textContent = 'Reanudar';
    }
  }
});

btnStop.addEventListener('click', stopSpeak);
function stopSpeak(){ speechSynthesis.cancel(); btnPause.textContent='Pausar'; }

async function ensureVoices() {
  // On some browsers, voices load async; wait briefly
  if (speechSynthesis.getVoices().length) return;
  await new Promise(r => setTimeout(r, 250));
}

// Quick audio test link
testAudio.addEventListener('click', (e) => {
  e.preventDefault();
  stopSpeak();
  ensureVoices().then(() => speak('Prueba de audio. Audio test.', 'es-AR', voiceEs.value || null));
});

// Simple persistence
['textLang','dualLang','voiceEs','voiceEn','rate','pitch','volume'].forEach(id => {
  const el = document.getElementById(id);
  const key = 'announcer_'+id;
  if (localStorage.getItem(key) !== null) {
    if (el.type === 'range') el.value = localStorage.getItem(key);
    else el.value = localStorage.getItem(key);
  }
  el.addEventListener('change', () => localStorage.setItem(key, el.value));
});

// Register service worker for offline
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js');
  });
}
