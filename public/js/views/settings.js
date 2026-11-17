// Settings: colour theme, interface language, daily goal, voice, microphone test, data.
import { h, englishVoices, speak, toast, listen, canListen, speechEngine } from '../util.js';
import { S, save, resetAll, applySettings, THEMES } from '../store.js';
import { header, go } from '../ui.js';
import { L, lang, setLang } from '../i18n.js';

export function view(main) {
  const s = S.p.settings;
  const set = (k, v) => { s[k] = v; applySettings(); save(); };
  const voices = englishVoices();
  let session = null;

  const themes = h('div.theme-grid');
  const drawThemes = () => themes.replaceChildren(...THEMES.map((t) => h('button.theme-card' + (t.id === s.theme ? '.on' : ''), {
    'aria-pressed': String(t.id === s.theme), onclick: () => { set('theme', t.id); drawThemes(); },
  },
  h('span.theme-preview', { style: `background:${t.swatch[0]}` },
    h('span.theme-panel', { style: `background:${t.swatch[1]}` }, h('i', { style: `background:${t.swatch[2]}` }), h('i'), h('i'))),
  h('strong', t.name), t.id === s.theme ? h('small.muted', L('✓ activă', '✓ active')) : h('small.muted', L('alege', 'choose')))));
  drawThemes();

  const micOut = h('div.mic-status');
  const micBtn = h('button.btn', { onclick: async () => {
    if (session) return session.stop();
    micBtn.classList.add('rec'); micBtn.textContent = L('⏹ Am terminat de vorbit', '⏹ I have finished speaking');
    micOut.className = 'mic-status'; micOut.textContent = L('Pornesc microfonul…', 'Starting the microphone…');
    session = listen((kind, value) => {
      if (kind === 'ready') micOut.textContent = L(`🎙 Spune ceva în engleză… (microfon: ${value || 'necunoscut'})`, `🎙 Say something in English… (microphone: ${value || 'unknown'})`);
      else if (kind === 'interim') micOut.textContent = `„${value}”`;
      else if (kind === 'info') micOut.textContent = value;
      else if (kind === 'retry') micOut.textContent = L('🎙 Am trecut pe recunoașterea de pe calculator. Spune din nou…', '🎙 Switched to on-device recognition. Say it again…');
    });
    try {
      const heard = await session.done;
      micOut.classList.add('good');
      micOut.textContent = L(`✅ Merge! Am auzit: „${heard[0]}” · recunoaștere ${speechEngine() === 'local' ? 'pe calculator' : 'online'}`, `✅ It works! I heard: “${heard[0]}” · ${speechEngine() === 'local' ? 'on-device' : 'online'} recognition`);
    } catch (e) {
      micOut.classList.add('bad');
      micOut.textContent = `${e.text || L('Recunoașterea vocii a dat o eroare.', 'Speech recognition failed.')} (${L('cod', 'code')}: ${e.code || e.message})`;
    }
    session = null; micBtn.classList.remove('rec'); micBtn.textContent = L('🎙 Testează microfonul', '🎙 Test the microphone');
  } }, L('🎙 Testează microfonul', '🎙 Test the microphone'));

  main.append(
    header(L('⚙️ Setări', '⚙️ Settings'), L('Se salvează automat.', 'Saved automatically.'), '#/'),

    h('div.card', h('h3', L('🎨 Tema de culori', '🎨 Colour theme')), themes),

    h('div.card', h('h3', L('🌐 Limba aplicației', '🌐 App language')),
      h('p.muted', L('Meniurile, butoanele și mesajele. Explicațiile de gramatică și traducerile din lecții rămân în română, ca să le înțelegi sigur.', 'Menus, buttons and messages. Grammar explanations and the translations inside lessons stay in Romanian, so you are sure to understand them.')),
      h('div.row.wrap',
        [['en', '🇬🇧 English'], ['ro', '🇷🇴 Română']].map(([code, label]) => h('button.btn' + (code === lang ? '.primary' : ''), { onclick: () => setLang(code) }, label)))),

    h('div.card', h('h3', L('🎯 Învățare', '🎯 Learning')),
      h('div.settings',
        h('label', L('Obiectiv zilnic (XP)', 'Daily goal (XP)'),
          h('select', { onchange: (e) => { S.p.goal = Number(e.target.value); save(); } },
            [[20, L('lejer', 'easy')], [50, L('normal', 'regular')], [100, L('serios', 'serious')], [150, L('intens', 'intense')]]
              .map(([g, name]) => h('option', { value: g, selected: S.p.goal === g }, `${g} XP · ${name}`)))),
        h('label', L('Sunete', 'Sounds'),
          h('select', { onchange: (e) => set('sound', e.target.value === '1') },
            h('option', { value: '1', selected: s.sound }, L('Pornite', 'On')), h('option', { value: '0', selected: !s.sound }, L('Oprite', 'Off')))))),

    h('div.card', h('h3', L('🔊 Vocea și microfonul', '🔊 Voice and microphone')),
      h('div.settings',
        h('label', L('Vocea care citește în engleză', 'The voice that reads English'),
          h('select', { onchange: (e) => { set('voice', e.target.value || null); speak('Hello! This is my voice.'); } },
            h('option', { value: '' }, L('Automat', 'Automatic')),
            voices.map((v) => h('option', { value: v.name, selected: s.voice === v.name }, `${v.name} (${v.lang})`)))),
        h('label', L('Viteza vocii', 'Voice speed'),
          h('select', { onchange: (e) => { set('rate', Number(e.target.value)); speak('This is how fast I speak.'); } },
            [[0.7, L('Rar', 'Slow')], [0.9, L('Normal', 'Normal')], [1.05, L('Rapid', 'Fast')]].map(([v, n]) => h('option', { value: v, selected: s.rate === v }, n))))),
      canListen()
        ? h('div.mt', h('div.row.wrap', micBtn, h('span.muted.small', L('Verifică dacă aplicația te aude și te înțelege.', 'Check that the app hears and understands you.'))), micOut)
        : h('p.muted.mt', L('Browserul acesta nu are recunoaștere a vocii. Pentru exercițiile de vorbire folosește Chrome sau Edge.', 'This browser has no speech recognition. For the speaking exercises use Chrome or Edge.'))),

    h('div.card', h('h3', L('💾 Datele tale', '💾 Your data')),
      h('p.muted', L('Progresul se salvează automat pe calculatorul tău, în fișierul user/progress.json din folderul aplicației.', 'Your progress is saved automatically on your computer, in the file user/progress.json inside the app folder.')),
      h('div.row.wrap',
        h('button.btn', { onclick: () => {
          const a = h('a', { href: URL.createObjectURL(new Blob([JSON.stringify(S.p, null, 1)], { type: 'application/json' })), download: 'english-levels-progress.json' });
          a.click(); toast(L('Progresul a fost salvat într-un fișier.', 'Your progress was saved to a file.'));
        } }, L('⬇ Salvează o copie a progresului', '⬇ Save a copy of my progress')),
        h('button.btn.danger-outline', { onclick: () => {
          if (confirm(L('Sigur vrei să ștergi TOT progresul? Nu se poate anula.', 'Really delete ALL your progress? This cannot be undone.'))
            && confirm(L('Ultima confirmare: ștergem tot?', 'Last check: delete everything?'))) { resetAll(); go('#/'); location.reload(); }
        } }, L('🗑 Șterge tot progresul', '🗑 Delete all progress')))));

  return () => { if (session) session.stop(); };
}
