// Small helpers: DOM, text checking, speech, sounds, confetti, images.
import { L } from './i18n.js';

// The native append/replaceChildren print "null" for empty values. All pages in this app build
// their content with optional pieces (cond ? node : null), so make these methods skip
// null/undefined/false and accept nested arrays.
for (const name of ['append', 'prepend', 'replaceChildren']) {
  const native = Element.prototype[name];
  Element.prototype[name] = function (...kids) {
    return native.apply(this, kids.flat(Infinity).filter((k) => k !== null && k !== undefined && k !== false));
  };
}

/** Hyperscript: h('div.card#id', {onclick}, child, 'text', [children]) */
export function h(tag, ...args) {
  const m = tag.match(/^([a-z0-9]+)?((?:[.#][\w-]+)*)$/i);
  const el = document.createElement((m && m[1]) || 'div');
  if (m && m[2]) {
    for (const part of m[2].match(/[.#][\w-]+/g) || []) {
      if (part[0] === '.') el.classList.add(part.slice(1)); else el.id = part.slice(1);
    }
  }
  let kids = args;
  const first = args[0];
  if (first && typeof first === 'object' && !(first instanceof Node) && !Array.isArray(first)) {
    kids = args.slice(1);
    for (const [k, v] of Object.entries(first)) {
      if (v === null || v === undefined || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'class') String(v).split(/\s+/).filter(Boolean).forEach((c) => el.classList.add(c));
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'style') el.style.cssText = v;
      else if (k === 'value') el.value = v;
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
  }
  add(el, kids);
  return el;
}
function add(el, kids) {
  for (const k of kids) {
    if (k === null || k === undefined || k === false) continue;
    if (Array.isArray(k)) add(el, k);
    else el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
}

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/** Tiny markdown: **bold**, *italic*, newlines. Returns safe HTML. */
export const md = (s) => esc(s || '')
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  .replace(/(^|[\s(])\*([^*\n]+?)\*(?=[\s).,;:!?]|$)/g, '$1<em>$2</em>')
  .replace(/\n/g, '<br>');
/** Highlights the gap "___" in a question. */
export const gap = (s) => md(s).replace(/_{3,}/g, '<span class="gap"></span>');

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export const sample = (arr, n) => shuffle(arr).slice(0, n);

// ---- dates ----
export function today(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function dayNum(d = new Date()) {
  return Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 864e5 + 0.5);
}
export function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d; }

// ---- answer checking ----
const CONTR = [
  [/\bcan't\b/g, 'can not'], [/\bcannot\b/g, 'can not'], [/\bwon't\b/g, 'will not'], [/\bshan't\b/g, 'shall not'],
  [/n't\b/g, ' not'], [/\bi'm\b/g, 'i am'], [/'re\b/g, ' are'], [/'ve\b/g, ' have'], [/'ll\b/g, ' will'],
  [/\b(he|she|it|that|there|what|where|who|how|here)'s\b/g, '$1 is'], [/\blet's\b/g, 'let us'],
];
export function norm(s, expand = true) {
  let t = String(s).toLowerCase().replace(/[’‘`´]/g, "'").replace(/[“”"]/g, '');
  t = t.replace(/[.,!?;:()…]/g, ' ').replace(/\s+-\s+|—|–/g, ' ').replace(/\s+/g, ' ').trim();
  if (expand) { for (const [re, to] of CONTR) t = t.replace(re, to); t = t.replace(/\s+/g, ' ').trim(); }
  return t;
}
export function lev(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}
/** Compares typed text with accepted answers. typo=true tolerates one small typo in long answers. */
export function checkText(input, answers, typo = false) {
  const a = norm(input);
  if (!a) return { ok: false };
  for (const ans of answers) if (norm(ans) === a) return { ok: true };
  if (typo) for (const ans of answers) { const b = norm(ans); if (b.length >= 10 && lev(a, b) <= 1) return { ok: true, typo: true }; }
  return { ok: false };
}

// ---- speech ----
let voices = [];
function loadVoices() { voices = window.speechSynthesis ? speechSynthesis.getVoices().filter((v) => /^en[-_]/i.test(v.lang)) : []; }
if (window.speechSynthesis) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
export const englishVoices = () => voices;
export const speechCfg = { voice: null, rate: 0.9 };
function pickVoice() {
  if (!voices.length) loadVoices();
  if (speechCfg.voice) { const v = voices.find((x) => x.name === speechCfg.voice); if (v) return v; }
  const pref = [/natural.*(en-US|United States)/i, /Google US English/i, /natural/i, /Aria|Jenny|Guy/i, /Google UK English/i, /Zira|David|Mark/i];
  for (const re of pref) { const v = voices.find((x) => re.test(x.name + ' ' + x.lang)); if (v) return v; }
  return voices.find((v) => /en[-_]US/i.test(v.lang)) || voices[0] || null;
}
export function speak(text, opts = {}) {
  if (!window.speechSynthesis) return;
  scriptRun++;
  speechSynthesis.cancel();
  const clean = String(text).replace(/_{3,}/g, ' ').replace(/\*\*/g, '');
  // Chrome cuts off long utterances after ~15 seconds, so long texts are read sentence by sentence.
  const parts = clean.length > 180 ? (clean.match(/[^.!?\n]+[.!?]*["”')]*\s*/g) || [clean]).map((s) => s.trim()).filter(Boolean) : [clean];
  const v = pickVoice();
  parts.forEach((part, i) => {
    const u = new SpeechSynthesisUtterance(part);
    if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'en-US';
    u.rate = (opts.slow ? 0.6 : 1) * (speechCfg.rate || 0.9);
    if (opts.onend && i === parts.length - 1) u.onend = opts.onend;
    speechSynthesis.speak(u);
  });
}
export const stopSpeak = () => { scriptRun++; if (window.speechSynthesis) speechSynthesis.cancel(); };

/** Reads a script [{s, en}] aloud, giving each speaker a different voice (or pitch). */
let scriptRun = 0;
export function speakScript(lines, onend) {
  if (!window.speechSynthesis) { if (onend) onend(); return; }
  stopSpeak();
  const run = ++scriptRun;
  const main = pickVoice();
  const others = voices.filter((v) => v !== main && /en[-_](US|GB)/i.test(v.lang));
  const speakers = [...new Set(lines.map((l) => l.s))];
  let i = 0;
  const next = () => {
    if (run !== scriptRun) return;
    if (i >= lines.length) { if (onend) onend(); return; }
    const l = lines[i++];
    const idx = speakers.indexOf(l.s);
    const u = new SpeechSynthesisUtterance(l.en);
    const v = idx === 0 ? main : (others[(idx - 1) % Math.max(1, others.length)] || main);
    if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'en-US';
    u.pitch = v === main && idx > 0 ? 0.7 : 1;
    u.rate = speechCfg.rate || 0.9;
    u.onend = () => setTimeout(next, 280);
    u.onerror = () => setTimeout(next, 50);
    speechSynthesis.speak(u);
  };
  next();
}
export function speakBtn(text, cls = '') {
  return h('button.icon-btn.speak' + (cls ? '.' + cls : ''), { title: L('Ascultă', 'Listen'), type: 'button', onclick: (e) => { e.stopPropagation(); speak(text); } }, '🔊');
}

// ---- speech recognition (Chrome / Edge) ----
export const canListen = () => !!(window.SpeechRecognition || window.webkitSpeechRecognition);

const MIC_HELP = L('Apasă pe iconița din stânga adresei paginii (lângă „localhost:4747”) → Microfon', 'Click the icon to the left of the address (next to "localhost:4747") → Microphone');
const MIC_ERRORS = {
  'not-allowed': L(`Microfonul este blocat pentru această pagină. ${MIC_HELP} → Permite, apoi reîncarcă pagina.`, `The microphone is blocked for this page. ${MIC_HELP} → Allow, then reload the page.`),
  'service-not-allowed': L('Browserul nu permite recunoașterea vocii pe această pagină. Folosește Google Chrome sau Microsoft Edge.', "The browser doesn't allow speech recognition on this page. Use Google Chrome or Microsoft Edge."),
  'audio-capture': L('Browserul nu găsește niciun microfon. Verifică ce microfon este ales în chrome://settings/content/microphone.', "The browser can't find a microphone. Check which microphone is selected in chrome://settings/content/microphone."),
  network: L('Microfonul tău merge, dar browserul nu a putut contacta serviciul online de recunoaștere a vocii (Chrome trimite sunetul la serverele Google), iar recunoașterea direct pe calculator nu este disponibilă în acest browser. Cauze obișnuite: VPN, firewall sau antivirus, o extensie care blochează conexiuni, ori un browser bazat pe Chromium fără serviciile Google (Brave, Opera, Vivaldi). Încearcă în Microsoft Edge sau cu VPN-ul / extensiile oprite — sau folosește înregistrarea de mai jos.', "Your microphone works, but the browser couldn't reach the online speech recognition service (Chrome sends the audio to Google's servers), and on-device recognition isn't available in this browser. Common causes: a VPN, firewall or antivirus, an extension that blocks connections, or a Chromium-based browser without Google services (Brave, Opera, Vivaldi). Try Microsoft Edge, or turn off the VPN / extensions — or use the recording below."),
  aborted: L('Ascultarea a fost întreruptă. Apasă din nou pe microfon.', 'Listening was interrupted. Tap the microphone again.'),
  'language-not-supported': L('Browserul acesta nu are recunoaștere a vocii pentru limba engleză.', "This browser doesn't have speech recognition for English."),
  'start-failed': L('Recunoașterea vocii nu a putut porni. Reîncarcă pagina și încearcă din nou.', "Speech recognition couldn't start. Reload the page and try again."),
};
/** Codes after which trying again will not help: offer "record yourself" instead. */
export const MIC_FATAL = ['service-not-allowed', 'network', 'language-not-supported'];

function micError(code, info = {}) {
  let text = MIC_ERRORS[code];
  if (code === 'no-speech') {
    const dev = info.label ? ` („${info.label}”)` : '';
    text = info.metered && info.peak < 0.02
      ? L(`Microfonul pe care ascultă browserul${dev} nu prinde niciun sunet. Probabil browserul folosește alt microfon decât cel cu care vorbești de obicei: ${MIC_HELP.toLowerCase()} și alege-l pe cel bun (sau deschide chrome://settings/content/microphone).`, `The microphone the browser is listening to${dev} isn't picking up any sound. The browser is probably using a different microphone from the one you usually speak into: ${MIC_HELP.toLowerCase()} and choose the right one (or open chrome://settings/content/microphone).`)
      : L(`Microfonul merge${dev}, dar nu am prins cuvinte în engleză. Vorbește imediat după ce apeși, clar și aproape de microfon.`, `The microphone works${dev}, but no English words were heard. Speak right after you tap, clearly and close to the microphone.`);
  }
  return Object.assign(new Error(code), { code, text: text || L(`Recunoașterea vocii a dat o eroare (${code}).`, `Speech recognition returned an error (${code}).`) });
}

/** Remembers whether speech is recognised by the browser's online service ('cloud') or on this computer ('local'). */
function sttMode(set) {
  try { if (set) localStorage.setItem('el-stt', set); return localStorage.getItem('el-stt') || 'cloud'; } catch { return 'cloud'; }
}
/** True when on-device English recognition can be used; downloads the language pack the first time. */
async function localSpeechReady(R, onstate) {
  if (typeof R.available !== 'function' || typeof R.install !== 'function') return false;
  const opts = { langs: ['en-US'], processLocally: true };
  try {
    const state = await R.available(opts);
    if (state === 'available') return true;
    if (state === 'unavailable') return false;
    onstate('info', L('Serviciul online de recunoaștere nu răspunde. Descarc pachetul de recunoaștere pentru engleză, ca să meargă direct pe calculator (o singură dată, poate dura un minut)…', "The online recognition service isn't responding. Downloading the English speech pack so it works directly on this computer (only once, it may take a minute)…"));
    return !!(await R.install(opts));
  } catch { return false; }
}

/**
 * Listens to one spoken sentence.
 * onstate(kind, value): 'ready' (microphone label), 'level' (0..1 loudness), 'interim' (text heard so far),
 * 'info' (a message while the on-device language pack downloads), 'retry' (switched to on-device: speak again).
 * Returns { done: Promise<string[]> (alternatives), stop() }. Rejections carry .code and a Romanian .text.
 */
export function listen(onstate = () => {}) {
  let rec, stream, ctx, raf, timer, peak = 0, label = '', metered = false;
  const cleanup = () => {
    cancelAnimationFrame(raf); clearTimeout(timer);
    if (stream) stream.getTracks().forEach((t) => t.stop());
    if (ctx) ctx.close().catch(() => {});
  };
  const done = (async () => {
    // Open the microphone ourselves first: this gives clear permission errors and a live level
    // meter, so a silent or wrong microphone can be told apart from "nothing was understood".
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (e) {
        throw micError(e.name === 'NotAllowedError' || e.name === 'SecurityError' ? 'not-allowed' : e.name === 'NotFoundError' || e.name === 'NotReadableError' ? 'audio-capture' : 'start-failed');
      }
      label = (stream.getAudioTracks()[0] || {}).label || '';
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        const an = ctx.createAnalyser(); an.fftSize = 512;
        ctx.createMediaStreamSource(stream).connect(an);
        const buf = new Uint8Array(an.fftSize);
        const tick = () => {
          an.getByteTimeDomainData(buf);
          let m = 0; for (const v of buf) m = Math.max(m, Math.abs(v - 128));
          peak = Math.max(peak, m / 128); onstate('level', m / 128);
          raf = requestAnimationFrame(tick);
        };
        metered = true; tick();
      } catch { /* no meter, recognition still works */ }
    }
    const R = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognise = (local) => new Promise((resolve, reject) => {
      rec = new R();
      rec.lang = 'en-US'; rec.interimResults = true; rec.maxAlternatives = 3; rec.continuous = false;
      if (local) rec.processLocally = true;
      let finals = null, interim = '', err = null;
      rec.onresult = (e) => {
        const last = e.results[e.results.length - 1];
        if (last.isFinal) finals = Array.from(last).map((a) => a.transcript);
        else { interim = Array.from(e.results).map((r) => r[0].transcript).join(' '); onstate('interim', interim); }
      };
      rec.onerror = (e) => { err = e.error; };
      rec.onend = () => {
        clearTimeout(timer);
        if (finals && finals.some((t) => t.trim())) resolve(finals);
        else if (interim.trim()) resolve([interim]);
        else reject(micError(err || 'no-speech', { peak, label, metered }));
      };
      try { rec.start(); } catch { reject(micError('start-failed')); }
      timer = setTimeout(() => { try { rec.stop(); } catch { /* already stopped */ } }, 15000);
    });

    // Chrome normally sends the audio to Google's speech service. Where that service cannot be
    // reached (error "network"), use Chrome's on-device recognition instead and remember it.
    let local = sttMode() === 'local';
    if (local && !(await localSpeechReady(R, onstate))) local = false;
    onstate('ready', label);
    try {
      return await recognise(local);
    } catch (e) {
      if (local && e.code === 'language-not-supported') sttMode('cloud');
      if (local || e.code !== 'network' || !(await localSpeechReady(R, onstate))) throw e;
      sttMode('local');
      onstate('retry', label);
      return recognise(true);
    }
  })();
  done.then(cleanup, cleanup);
  return { done, stop: () => { try { if (rec) rec.stop(); } catch { /* already stopped */ } } };
}

/** "Record yourself and listen back" — works without any speech service. */
export function recorder(labelText = L('🎙 Înregistrează-te', '🎙 Record yourself')) {
  let rec, chunks = [], stream;
  const audio = h('audio', { controls: true, class: 'hidden' });
  const b = h('button.btn', { onclick: async () => {
    if (rec && rec.state === 'recording') { rec.stop(); return; }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunks = []; rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = () => { stream.getTracks().forEach((t) => t.stop()); audio.src = URL.createObjectURL(new Blob(chunks)); audio.classList.remove('hidden'); b.textContent = L('🎙 Înregistrează din nou', '🎙 Record again'); b.classList.remove('rec'); };
      rec.start(); b.textContent = L('⏹ Oprește înregistrarea', '⏹ Stop recording'); b.classList.add('rec');
    } catch { toast(MIC_ERRORS['not-allowed'], 'warn'); }
  } }, labelText);
  const stop = () => { if (rec && rec.state === 'recording') rec.stop(); };
  return { node: h('div.row.wrap', b, audio), stop };
}
export const canRecord = () => !!(navigator.mediaDevices && window.MediaRecorder);
/** Share of target words that were said (0..1). */
export function speechScore(target, heardList) {
  const t = norm(target).split(' ');
  let best = 0;
  for (const heard of heardList) {
    const hw = norm(heard).split(' ');
    const hit = t.filter((w) => hw.includes(w)).length / t.length;
    best = Math.max(best, hit);
  }
  return best;
}
/** Word-by-word comparison: { score, heard (best alternative), words: [{ w, hit }] } for showing what was missed. */
export function speechDetail(target, heardList) {
  const shown = String(target).split(/\s+/).filter(Boolean);
  let best = { score: -1, heard: heardList[0] || '', words: shown.map((w) => ({ w, hit: false })) };
  for (const heard of heardList) {
    const hw = norm(heard).split(' ');
    const words = shown.map((w) => { const parts = norm(w).split(' ').filter(Boolean); return { w, hit: parts.length ? parts.every((p) => hw.includes(p)) : true }; });
    const counted = words.filter((x) => norm(x.w));
    const score = counted.length ? counted.filter((x) => x.hit).length / counted.length : 0;
    if (score > best.score) best = { score, heard, words };
  }
  return best;
}
/** Which engine recognises speech here: 'cloud' (browser's online service) or 'local' (on this computer). */
export const speechEngine = () => sttMode();

/**
 * Keeps listening until stop() is called (for games). onText(text) receives everything heard since
 * the last reset(); call reset() after using it to start a fresh segment.
 * onstate(kind, value): 'ready', 'info' (language pack download), 'error' (object with .text and .code).
 */
export function listenStream(onText, onstate = () => {}) {
  const R = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec, active = true, local = sttMode() === 'local', triedLocal = false, quickEnds = 0;
  const fail = (code) => { active = false; onstate('error', micError(code)); };
  const start = () => {
    if (!active) return;
    rec = new R();
    rec.lang = 'en-US'; rec.interimResults = true; rec.continuous = true; rec.maxAlternatives = 1;
    if (local) rec.processLocally = true;
    let err = null;
    const began = Date.now();
    rec.onresult = (e) => { quickEnds = 0; onText(Array.from(e.results).map((r) => r[0].transcript).join(' ')); };
    rec.onerror = (e) => { err = e.error; };
    rec.onend = async () => {
      if (!active) return;
      if (err === 'network' && !local && !triedLocal) {
        triedLocal = true;
        if (await localSpeechReady(R, onstate)) { local = true; sttMode('local'); onstate('ready'); }
      }
      if (err === 'network' && !local) return fail('network');
      if (err && !['no-speech', 'aborted', 'network'].includes(err)) return fail(err);
      // a recogniser that keeps dying immediately would loop forever
      if (err !== 'aborted' && Date.now() - began < 700 && ++quickEnds > 6) return fail(err || 'start-failed');
      setTimeout(start, 120);
    };
    try { rec.start(); } catch { setTimeout(start, 400); }
  };
  (async () => {
    if (local && !(await localSpeechReady(R, onstate))) local = false;
    onstate('ready');
    start();
  })();
  const abort = () => { try { if (rec) rec.abort(); } catch { /* not running */ } };
  return { stop: () => { active = false; abort(); }, reset: abort };
}

// ---- sounds ----
let actx;
export const soundCfg = { on: true };
function tone(freq, start, dur, type = 'sine', vol = 0.12) {
  const o = actx.createOscillator(), g = actx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(vol, actx.currentTime + start);
  g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + start + dur);
  o.connect(g).connect(actx.destination);
  o.start(actx.currentTime + start); o.stop(actx.currentTime + start + dur + 0.02);
}
export function sfx(name) {
  if (!soundCfg.on) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (name === 'ok') { tone(660, 0, 0.12); tone(990, 0.1, 0.18); }
    else if (name === 'bad') { tone(220, 0, 0.22, 'triangle', 0.14); }
    else if (name === 'win') { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.25)); }
    else if (name === 'flip') { tone(440, 0, 0.05, 'sine', 0.05); }
  } catch { /* ignore */ }
}

// ---- confetti ----
export function confetti(ms = 2200) {
  const c = h('canvas', { style: 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999' });
  document.body.append(c);
  const ctx = c.getContext('2d');
  c.width = innerWidth; c.height = innerHeight;
  const colors = ['#22c55e', '#38bdf8', '#a78bfa', '#fb923c', '#f472b6', '#facc15'];
  const ps = Array.from({ length: 160 }, () => ({
    x: Math.random() * c.width, y: -20 - Math.random() * c.height * 0.4, r: 4 + Math.random() * 6,
    vx: -2 + Math.random() * 4, vy: 2 + Math.random() * 5, rot: Math.random() * 6, vr: -0.2 + Math.random() * 0.4,
    col: colors[Math.floor(Math.random() * colors.length)],
  }));
  const t0 = performance.now();
  (function frame(t) {
    ctx.clearRect(0, 0, c.width, c.height);
    for (const p of ps) {
      p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.rot += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.col;
      ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 1.6); ctx.restore();
    }
    if (t - t0 < ms) requestAnimationFrame(frame); else c.remove();
  })(t0);
}

// ---- Wikipedia thumbnails for vocabulary pictures ----
let imgCache;
function cache() {
  if (!imgCache) { try { imgCache = JSON.parse(localStorage.getItem('el-img') || '{}'); } catch { imgCache = {}; } }
  return imgCache;
}
export async function wikiImage(title) {
  if (!title) return null;
  const c = cache();
  if (title in c) return c[title];
  try {
    const r = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`);
    if (!r.ok && r.status !== 404) return null; // busy or offline: try again another time
    const j = r.ok ? await r.json() : null;
    c[title] = (j && j.thumbnail && j.thumbnail.source) || null;
    try { localStorage.setItem('el-img', JSON.stringify(c)); } catch { /* full */ }
    return c[title];
  } catch { return null; }
}
/** A picture box: shows the emoji, then swaps in a photo when one is found. */
export function picture(word, cls = '') {
  const box = h('div.pic' + (cls ? '.' + cls : ''), h('span.pic-emoji', word.emoji || '📘'));
  if (word.wiki) {
    wikiImage(word.wiki).then((src) => {
      if (!src) return;
      const img = new Image();
      img.alt = word.en;
      img.onload = () => { box.classList.add('has-img'); box.prepend(img); };
      img.src = src;
    });
  }
  return box;
}

export function toast(msg, kind = '') {
  let wrap = document.querySelector('.toasts');
  if (!wrap) { wrap = h('div.toasts'); document.body.append(wrap); }
  const t = h('div.toast' + (kind ? '.' + kind : ''), msg);
  wrap.append(t);
  setTimeout(() => t.classList.add('out'), 2600);
  setTimeout(() => t.remove(), 3100);
}

export function modal(content, opts = {}) {
  const close = () => { stopSpeak(); back.remove(); document.removeEventListener('keydown', onKey); if (opts.onclose) opts.onclose(); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const back = h('div.modal-back', { onclick: (e) => { if (e.target === back) close(); } },
    h('div.modal' + (opts.wide ? '.wide' : ''), h('button.icon-btn.modal-x', { onclick: close, title: L('Închide', 'Close') }, '✕'), content));
  document.addEventListener('keydown', onKey);
  document.body.append(back);
  return close;
}
