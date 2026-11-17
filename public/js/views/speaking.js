// Speaking practice: conversations with a "client", role-play from the lessons, repeat-after-me,
// say-it-in-English, open questions, sound-alike words and a voice sprint.
import { h, speak, stopSpeak, speakBtn, listen, listenStream, speechDetail, speechEngine, canListen, recorder, canRecord, MIC_FATAL, shuffle, sample, sfx, confetti, norm } from '../util.js';
import { S, level, levelUnlocked, currentLevel, unitUnlocked, knownWords, wordStatus, speakState, countSpoken, recordConversation, speakRecord, addXp } from '../store.js';
import { resultCard } from '../exercise.js';
import { header, btn, chip, empty, pct, go } from '../ui.js';
import { L, plural } from '../i18n.js';

// Pairs of words that sound alike and are hard to tell apart for Romanian speakers.
const PAIRS = [
  ['ship', 'sheep'], ['live', 'leave'], ['sit', 'seat'], ['fill', 'feel'], ['chip', 'cheap'], ['rich', 'reach'],
  ['bad', 'bed'], ['man', 'men'], ['pan', 'pen'], ['sad', 'said'], ['cut', 'cat'], ['cup', 'cap'], ['fun', 'fan'],
  ['not', 'note'], ['cot', 'coat'], ['work', 'walk'], ['word', 'ward'], ['bird', 'board'],
  ['think', 'sink'], ['thin', 'tin'], ['three', 'tree'], ['thought', 'taught'], ['mouth', 'mouse'],
  ['vest', 'west'], ['vine', 'wine'], ['bag', 'back'], ['bed', 'bet'], ['price', 'prize'], ['hair', 'air'], ['heat', 'eat'],
];

// ---------- small helpers ----------
/** Empty state for a level without speaking content. An outdated server is the usual reason, so say that plainly. */
function noContent(what) {
  return S.serverOld
    ? empty('🔄', L('Serverul trebuie repornit', 'The server needs a restart'),
      L('Conținutul există, dar serverul pornit acum este dinaintea actualizării și nu îl trimite. Închide fereastra neagră „English Levels”, pornește din nou Start.bat și reîncarcă pagina.', 'The content exists, but the server running now was started before the update and does not send it. Close the black “English Levels” window, run Start.bat again and reload the page.'),
      [h('button.btn.primary', { onclick: () => location.reload() }, L('Am repornit — reîncarcă pagina', 'I restarted it — reload the page'))])
    : empty('⏳', what, L('Până atunci, încearcă jocul de rol din lecții.', 'Meanwhile, try the role-play from the lessons.'), [btn(L('Înapoi', 'Back'), '#/speak', 'primary')]);
}
const sentences = (n) => `${n} ${plural(n, L('propoziție', 'sentence'), L('propoziții', 'sentences'))}`;
function chosenLevel() {
  let id = null;
  try { id = localStorage.getItem('el-speak-level'); } catch { /* ignore */ }
  const lv = id && level(id);
  return lv && levelUnlocked(lv) ? lv : currentLevel();
}
function chooseLevel(id) { try { localStorage.setItem('el-speak-level', id); } catch { /* ignore */ } }
/** Says a text and resolves when it has been said (or after a safety timeout). */
const sayAsync = (text) => new Promise((resolve) => {
  if (!window.speechSynthesis) return resolve();
  let done = false;
  const fin = () => { if (!done) { done = true; resolve(); } };
  speak(text, { onend: fin });
  setTimeout(fin, 2000 + text.length * 95);
});
/** Target sentence with the words that were heard in green and the missed ones underlined. */
const coloured = (words) => h('span', words.map((x, i) => [i ? ' ' : '', h('span.tw.' + (x.hit ? 'hit' : 'miss'), x.w)]));
const has = (text, phrase) => ` ${norm(text)} `.includes(` ${norm(phrase)} `);
/** True when a word or short phrase was said. Hyphens and spacing do not matter: easy-going = easygoing = easy going. */
function saidWord(text, target) {
  const flat = (x) => norm(x).replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
  const t = flat(target), x = flat(text);
  if (!t || !x) return false;
  if (` ${x} `.includes(` ${t} `)) return true;
  return t.includes(' ') && x.split(' ').includes(t.replace(/ /g, ''));
}
/** First letter of each word plus blanks: "easy-going" → "e _ _ _ - g _ _ _ _". */
const letterHint = (en) => en.split('').map((ch, i, all) => (/[a-z]/i.test(ch) ? (i === 0 || !/[a-z]/i.test(all[i - 1]) ? ch : '_') : ch === ' ' ? '  ' : ch)).join(' ');
/** Words for the voice sprint: ones the learner should already know, short enough to say in one breath. */
function sprintPool() {
  const short = (w) => w.en.split(/\s+/).length <= 2 && w.en.length <= 16;
  const below = currentLevel().index;
  const known = Object.values(S.wordIndex).filter((w) => short(w) && (wordStatus(w.en) === 'learned' || level(w.levelId).index < below));
  return shuffle(known.length >= 20 ? known : [...new Set([...known, ...knownWords(12).filter(short)])]);
}
/** Sentences from the lessons of a level that are open to the learner. */
function lessonLines(lv) {
  return lv.units.filter(unitUnlocked).flatMap((u) => u.dialogue.lines.map((l) => ({ en: l.en, ro: l.ro })));
}

/**
 * Microphone button with a loudness meter and a status line.
 * onHeard(alternatives) — or onHeard(null) when the learner checks themself (no speech recognition).
 */
function micPanel(onHeard) {
  const status = h('div.mic-status');
  const meter = h('span.mic-level.hidden', h('i'));
  const extra = h('div.center');
  let session = null, alive = true;
  if (!canListen()) {
    const rec = canRecord() ? recorder() : null;
    const node = h('div.mic-panel',
      h('p.muted.small', L('Browserul acesta nu are recunoaștere a vocii. Spune propoziția cu voce tare (te poți înregistra) și verifică-te singur.', 'This browser has no speech recognition. Say the sentence aloud (you can record yourself) and check yourself.')),
      rec ? rec.node : null,
      h('div.row.center.mt', h('button.btn.success', { onclick: () => onHeard(null) }, L('✓ Am spus-o bine', '✓ I said it well'))));
    return { node, start() {}, stop() { if (rec) rec.stop(); } };
  }
  const button = h('button.btn.round.mic-big', { title: L('Apasă și vorbește', 'Press and speak'), onclick: () => (session ? session.stop() : start()) }, '🎤');
  async function start() {
    if (!alive || session) return;
    stopSpeak();
    button.classList.add('rec'); meter.classList.remove('hidden');
    status.className = 'mic-status'; status.textContent = L('Pornesc microfonul…', 'Starting the microphone…');
    const mine = listen((kind, value) => {
      if (!alive) return;
      if (kind === 'ready') status.textContent = L('🎙 Vorbește acum… (apasă din nou când ai terminat)', '🎙 Speak now… (press again when you finish)');
      else if (kind === 'level') meter.firstChild.style.width = `${Math.min(100, Math.round(value * 250))}%`;
      else if (kind === 'interim') status.textContent = `„${value}”`;
      else if (kind === 'info') status.textContent = value;
      else if (kind === 'retry') status.textContent = L('🎙 Am trecut pe recunoașterea de pe calculator. Spune din nou, acum…', '🎙 Switched to on-device recognition. Say it again now…');
    });
    session = mine;
    let heard = null, error = null;
    try { heard = await mine.done; } catch (e) { error = e; }
    session = null; button.classList.remove('rec'); meter.classList.add('hidden');
    if (!alive) return;
    if (error) {
      status.classList.add('bad');
      status.textContent = `${error.text || L('Recunoașterea vocii a dat o eroare.', 'Speech recognition failed.')} (${L('cod', 'code')}: ${error.code || error.message})`;
      if (MIC_FATAL.includes(error.code) && canRecord() && !extra.childNodes.length) extra.append(recorder().node);
      return;
    }
    status.textContent = '';
    onHeard(heard);
  }
  return {
    node: h('div.mic-panel', h('div.row.center', button, meter), status, extra),
    start,
    stop() { alive = false; if (session) session.stop(); },
  };
}

function sessionShell(box, title, backHash, onExit) {
  const fill = h('div.bar-fill');
  const counter = h('span.sess-count');
  const stage = h('div');
  box.replaceChildren(h('div.session',
    h('div.sess-top', h('button.icon-btn', { title: L('Ieși', 'Exit'), onclick: () => { onExit(); go(backHash); } }, '✕'), h('div.bar', fill), counter),
    h('div.sess-title', title), stage));
  return { stage, progress(done, total) { fill.style.width = `${(done / total) * 100}%`; counter.textContent = `${Math.min(done + 1, total)} / ${total}`; } };
}

// ================= hub =================
export function view(main, mode, arg) {
  const modes = { talk, role, repeat, say, answer, pairs, sprint };
  if (mode && modes[mode]) return modes[mode](main, arg);
  if (mode) return go('#/speak');
  const lv = chosenLevel();
  const st = speakState();
  const sp = lv.speaking;
  const doneTalks = sp ? sp.scenarios.filter((s) => s.id in st.scen).length : 0;
  const card = (href, icon, title, text, tag) => h('a.card.game', { href }, h('div.game-icon', icon), h('h3', title), h('p.muted', text), tag || null);
  main.append(
    header(L('🗣️ Vorbire', '🗣️ Speaking'), L('Vorbești cu voce tare, aplicația te ascultă și îți spune ce a înțeles. Cu cât vorbești mai mult, cu atât prinzi curaj.', 'You speak aloud, the app listens and tells you what it understood. The more you speak, the more confident you get.'), '#/'),
    !canListen() ? h('div.alert.warn', L('Browserul acesta nu are recunoaștere a vocii (merge în Chrome și Edge). Poți exersa oricum: te înregistrezi și te verifici singur.', 'This browser has no speech recognition (it works in Chrome and Edge). You can still practise: record yourself and check yourself.')) : null,
    h('div.stats',
      h('div.card.stat', h('div.stat-icon', '🎙️'), h('div.stat-num', st.said), h('div.muted', L('propoziții rostite bine', 'sentences said well'))),
      h('div.card.stat', h('div.stat-icon', '💬'), h('div.stat-num', Object.keys(st.scen).length), h('div.muted', L('conversații terminate', 'conversations finished'))),
      h('div.card.stat', h('div.stat-icon', '⚡'), h('div.stat-num', st.best.sprint || 0), h('div.muted', L('record la sprintul vocal', 'voice sprint record')))),
    h('div.row.wrap.level-pick', h('span.muted', L('Nivel:', 'Level:')),
      S.levels.filter((l) => l.units.length).map((l) => h('button.tab' + (l.id === lv.id ? '.on' : ''), { disabled: !levelUnlocked(l), title: levelUnlocked(l) ? '' : L('Nivel blocat', 'Locked level'), onclick: () => { chooseLevel(l.id); main.replaceChildren(); view(main); } }, l.name, levelUnlocked(l) ? '' : ' 🔒'))),
    h('div.game-grid',
      card('#/speak/talk', '🤝', L('Conversații', 'Conversations'), L('Aplicația e clientul, colegul sau recepționerul. Tu răspunzi cu voce tare.', 'The app is the client, the colleague or the receptionist. You answer aloud.'),
        sp ? chip(`${doneTalks} / ${sp.scenarios.length}`, doneTalks ? 'ok' : 'lock') : chip(S.serverOld ? L('repornește serverul', 'restart the server') : L('în pregătire', 'coming soon'), 'warn')),
      card('#/speak/repeat', '🔁', L('Repetă după mine', 'Repeat after me'), L('Auzi o propoziție utilă și o repeți. Vezi ce cuvinte s-au înțeles.', 'Hear a useful sentence and repeat it. See which words were understood.')),
      card('#/speak/say', '💬', L('Spune în engleză', 'Say it in English'), L('Vezi propoziția în română și o spui în engleză, fără să o vezi scrisă.', 'See the sentence in Romanian and say it in English, without seeing it written.')),
      card('#/speak/answer', '🙋', L('Răspunde la întrebare', 'Answer the question'), L('Întrebări despre tine, ca la un interviu sau la o discuție cu un client.', 'Questions about you, like in an interview or small talk with a client.'), sp ? null : chip(L('în pregătire', 'coming soon'), 'lock')),
      card('#/speak/pairs', '👂', L('Cuvinte care seamănă', 'Sound-alike words'), L('ship sau sheep? Antrenează sunetele grele pentru vorbitorii de română.', 'ship or sheep? Train the sounds that are hard for Romanian speakers.'), st.best.pairs ? chip(L(`Record: ${st.best.pairs}/8`, `Best: ${st.best.pairs}/8`), 'ok') : null),
      card('#/speak/sprint', '⚡', L('Sprint vocal', 'Voice sprint'), L('60 de secunde: vezi cuvântul în română și îl spui în engleză, cât de multe poți.', '60 seconds: see the word in Romanian and say it in English, as many as you can.'), st.best.sprint ? chip(L(`Record: ${st.best.sprint}`, `Best: ${st.best.sprint}`), 'ok') : null)),
    h('div.card', h('h3', L('🎭 Joc de rol din lecții', '🎭 Role-play from the lessons')),
      h('p.muted', L('Joacă un personaj din dialogul unei unități. Aplicația spune replicile celuilalt.', 'Play one character from a unit dialogue. The app says the other lines.')),
      h('div.gram-list', { style: `--c:${lv.color}` }, lv.units.filter(unitUnlocked).map((u) => h('a.gram-row', { href: `#/speak/role/${u.id}` },
        h('span.gram-n', u.order), h('span.grow', h('strong', `${u.emoji} ${u.title}`), h('small.muted', u.dialogue.titleRo)),
        st.scen[`role-${u.id}`] !== undefined ? chip(`${pct(st.scen[`role-${u.id}`])}%`, 'ok') : null)))));
}

// ================= conversations =================
/** conv: { id, partner, me, turns: [{ who: 'partner', en, ro } | { who: 'me', hint, answers, keywords, show }] } */
function runConversation(box, conv, backHash, again) {
  let alive = true, i = 0, mic = null;
  const scores = [];
  const myTurns = conv.turns.filter((t) => t.who === 'me').length;
  const log = h('div.dialogue.talk-log');
  const panel = h('div.turn-panel.card');
  const shell = sessionShell(box, conv.title, backHash, () => stop());
  const stop = () => { alive = false; if (mic) mic.stop(); stopSpeak(); };
  shell.stage.append(conv.intro ? h('div.card.instr', conv.intro) : null, log, panel);

  const bubble = (side, who, en, ro, extra) => {
    const row = h('div.line.' + side, h('div.bubble', h('div.spk', who), h('div.en', en), ro ? h('div.ro', ro) : null, extra));
    log.append(row);
    return row;
  };
  async function next() {
    if (!alive) return;
    if (mic) { mic.stop(); mic = null; }
    shell.progress(scores.length, myTurns);
    if (i >= conv.turns.length) return finish();
    const t = conv.turns[i++];
    if (t.who === 'partner') {
      panel.replaceChildren(h('p.muted.center', L(`${conv.partner} vorbește… ascultă.`, `${conv.partner} is speaking… listen.`)));
      bubble('left', conv.partner, t.en, t.ro, h('div.row.line-tools', speakBtn(t.en)));
      panel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      await sayAsync(t.en);
      return next();
    }
    myTurn(t);
  }
  function evaluate(t, heard) {
    let best = { score: -1 };
    for (const a of t.answers) { const d = speechDetail(a, heard); if (d.score > best.score) best = { ...d, answer: a }; }
    const kw = t.keywords && t.keywords.length ? heard.find((x) => t.keywords.every((k) => has(x, k))) : null;
    return { pass: best.score >= (t.show ? 0.7 : 0.6) || !!kw, heard: kw || best.heard, words: best.words, answer: best.answer };
  }
  function myTurn(t) {
    let tries = 0, helped = false;
    const target = h('div.say-target');
    const model = h('div');
    const feedback = h('div');
    const showModel = () => {
      helped = true;
      model.replaceChildren(h('div.example', speakBtn(t.answers[0]), h('div', h('div.en', t.answers[0]),
        t.answers.length > 1 ? h('div.ro', L('sau: ', 'or: '), t.answers.slice(1).join(' / ')) : null)));
    };
    const done = (score, said, note) => {
      scores.push(score);
      bubble('right', conv.me, said, null, note ? h('div.muted.small', note) : null);
      setTimeout(next, 650);
    };
    if (t.show) target.textContent = t.answers[0];
    mic = micPanel((heard) => {
      tries++;
      if (heard === null) { countSpoken(); return done(0.7, t.answers[0]); }
      const ev = evaluate(t, heard);
      if (t.show) target.replaceChildren(coloured(ev.words));
      if (ev.pass) {
        sfx('ok'); countSpoken();
        return done(helped || tries > 1 ? 0.7 : 1, ev.heard, t.show ? null : L(`✓ Model: ${ev.answer}`, `✓ Model: ${ev.answer}`));
      }
      sfx('bad');
      feedback.replaceChildren(h('div.feedback.bad', h('div.fb-head', L('Încă nu — mai încearcă', 'Not yet — try again')),
        h('div', L('Am auzit: ', 'I heard: '), h('em', `„${ev.heard}”`))));
      if (tries >= 2 && !t.show) showModel();
    });
    panel.replaceChildren(
      h('div.turn-head', L('🎯 Rândul tău', '🎯 Your turn'), h('span.muted', ` · ${conv.me}`)),
      t.show ? target : null,
      h('div.hint-box', t.show ? '🇷🇴 ' : '💡 ', t.hint),
      model, mic.node, feedback,
      h('div.row.center.wrap',
        t.show ? h('button.btn', { onclick: () => speak(t.answers[0]) }, L('🔊 Ascultă replica', '🔊 Hear the line')) : h('button.btn', { onclick: showModel }, L('👁 Arată un răspuns', '👁 Show an answer')),
        h('button.btn', { onclick: () => done(0, t.answers[0], L('sărită', 'skipped')) }, L('Sari peste →', 'Skip →'))));
    panel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  function finish() {
    const score = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const first = recordConversation(conv.id, score);
    if (score >= 0.7) { confetti(); sfx('win'); }
    panel.replaceChildren();
    panel.replaceWith(resultCard({ score,
      title: score >= 0.85 ? L('Excelent! Te-ai descurcat ca într-o discuție reală 🎉', 'Excellent! You handled it like a real conversation 🎉') : score >= 0.6 ? L('Bine! Conversația a mers.', 'Good! The conversation worked.') : L('Ai dus-o la capăt — mai fă-o o dată.', 'You got through it — do it once more.'),
      lines: [L(`${sentences(scores.filter((s) => s > 0).length)} din ${myTurns} rostite · +${first ? 15 : 5} XP ⚡`, `${scores.filter((s) => s > 0).length} of ${myTurns} lines said · +${first ? 15 : 5} XP ⚡`)],
      actions: [h('button.btn.primary.big', { onclick: again }, L('🔁 Încă o dată', '🔁 Once more')), btn(L('Înapoi', 'Back'), backHash)] }));
  }
  next();
  return stop;
}

function talk(main, id) {
  const lv = chosenLevel();
  const st = speakState();
  // a conversation can belong to any level
  const found = id && S.levels.flatMap((l) => (l.speaking ? l.speaking.scenarios : [])).find((s) => s.id === id);
  if (found) {
    const box = h('div');
    main.append(box);
    let stop = () => {};
    const start = () => {
      stop = runConversation(box, {
        id: found.id, title: `${found.emoji} ${found.title}`, partner: found.partner, me: L('Tu', 'You'), intro: found.youRo,
        turns: [...found.turns.flatMap((t) => [{ who: 'partner', en: t.say, ro: t.sayRo }, { who: 'me', hint: t.hintRo, answers: t.answers, keywords: t.keywords }]),
          ...(found.closing ? [{ who: 'partner', en: found.closing }] : [])],
      }, '#/speak/talk', () => { stop(); start(); });
    };
    start();
    return () => stop();
  }
  main.append(header(L('🤝 Conversații', '🤝 Conversations'), L(`Situații reale la nivelul ${lv.name}. Citești ce ai de făcut, asculți și răspunzi cu voce tare.`, `Real situations at level ${lv.name}. Read what you have to do, listen and answer aloud.`), '#/speak'));
  if (!lv.speaking) return main.append(noContent(L('Conversațiile pentru acest nivel sunt în pregătire', 'Conversations for this level are coming soon')));
  main.append(h('div.units', { style: `--c:${lv.color}` }, lv.speaking.scenarios.map((s, n) => h('a.unit-card', { href: `#/speak/talk/${s.id}` },
    h('div.unit-top', h('span.unit-emoji', s.emoji), h('span.unit-badge', s.id in st.scen ? (st.scen[s.id] >= 0.85 ? '⭐' : '✓') : '')),
    h('div.unit-n', L(`Conversația ${n + 1}`, `Conversation ${n + 1}`)),
    h('div.unit-title', s.title), h('div.unit-ro', s.titleRo),
    h('div.unit-gram', L(`${s.turns.length} replici de spus`, `${s.turns.length} lines to say`), s.id in st.scen ? ` · ${pct(st.scen[s.id])}%` : '')))));
}

// ================= role-play with a unit dialogue =================
function role(main, unitId) {
  const u = S.unitById[unitId];
  if (!u || !unitUnlocked(u)) return go('#/speak');
  const speakers = [...new Set(u.dialogue.lines.map((l) => l.speaker))];
  const box = h('div');
  main.append(box);
  let stop = () => {};
  const choose = () => {
    let hard = false;
    box.replaceChildren(
      header(L('🎭 Joc de rol', '🎭 Role-play'), `${u.emoji} ${u.title} · ${u.dialogue.titleRo}`, `#/unit/${u.id}`),
      empty('🎭', L('Ce personaj vrei să fii?', 'Which character do you want to be?'),
        L('Aplicația spune replicile celuilalt personaj, iar tu le spui pe ale tale cu voce tare.', 'The app says the other character’s lines and you say yours aloud.'),
        speakers.map((who) => h('button.btn.primary.big', { onclick: () => play(who, hard) }, who))),
      h('div.center', h('label.check', h('input', { type: 'checkbox', onchange: (e) => { hard = e.target.checked; } }),
        ' ', L('Mod greu: nu văd replica mea în engleză, doar traducerea', 'Hard mode: I do not see my line in English, only the translation'))));
  };
  const play = (me, hard) => {
    stop = runConversation(box, {
      id: `role-${u.id}`, title: `🎭 ${u.dialogue.titleRo}`, partner: speakers.find((s) => s !== me) || '…', me,
      intro: hard ? L('Mod greu: spune replica în engleză pornind de la traducere.', 'Hard mode: say the line in English from its translation.') : L('Citește replica ta cu voce tare, cât mai natural.', 'Read your line aloud, as naturally as you can.'),
      turns: u.dialogue.lines.map((l) => (l.speaker === me ? { who: 'me', hint: l.ro, answers: [l.en], keywords: [], show: !hard } : { who: 'partner', en: l.en, ro: l.ro })),
    }, `#/speak/role/${u.id}`, () => { stop(); play(me, hard); });
  };
  choose();
  return () => stop();
}

// ================= repeat after me / say it in English =================
function sentenceRound(box, items, { hidden, title, backHash, again }) {
  let alive = true, i = 0, ok = 0, mic = null;
  const stop = () => { alive = false; if (mic) mic.stop(); stopSpeak(); };
  const shell = sessionShell(box, title, backHash, stop);
  function show() {
    if (!alive) return;
    if (mic) { mic.stop(); mic = null; }
    if (i >= items.length) return finish();
    shell.progress(i, items.length);
    const it = items[i], at = i;
    let tries = 0, revealed = !hidden;
    const target = h('div.say-target');
    const feedback = h('div');
    const draw = (words) => target.replaceChildren(revealed ? (words ? coloured(words) : it.en) : h('span.muted', '•••'));
    const go2 = () => { i++; show(); };
    mic = micPanel((heard) => {
      tries++;
      const d = heard === null ? { score: 1, heard: '', words: it.en.split(/\s+/).map((w) => ({ w, hit: true })) } : speechDetail(it.en, heard);
      const pass = d.score >= (hidden ? 0.7 : 0.8);
      if (pass || tries >= 2) revealed = true;
      draw(d.words);
      if (pass) {
        sfx('ok'); ok++; countSpoken();
        feedback.replaceChildren(h('div.feedback.good', h('div.fb-head', d.score === 1 ? L('Perfect! ⭐', 'Perfect! ⭐') : L(`Bine! ${pct(d.score)}% ✅`, `Good! ${pct(d.score)}% ✅`))));
        if (hidden) speak(it.en);
        return setTimeout(() => { if (alive && i === at) go2(); }, hidden ? 1900 : 1100);
      }
      sfx('bad');
      feedback.replaceChildren(h('div.feedback.bad', h('div.fb-head', L(`${pct(d.score)}% — mai încearcă`, `${pct(d.score)}% — try again`)), h('div', L('Am auzit: ', 'I heard: '), h('em', `„${d.heard}”`))));
    });
    draw(null);
    shell.stage.replaceChildren(h('div.ex.fade-in',
      h('div.ex-type', hidden ? L('Spune în engleză', 'Say it in English') : L('Ascultă și repetă', 'Listen and repeat')),
      hidden ? h('div.ex-q', '🇷🇴 ', it.ro) : null,
      target,
      hidden ? null : h('div.muted.center', it.ro),
      mic.node, feedback,
      h('div.row.center.wrap.mt',
        h('button.btn', { onclick: () => { revealed = true; draw(null); speak(it.en); } }, hidden ? L('👁 Arată și ascultă răspunsul', '👁 Show and hear the answer') : L('🔊 Ascultă din nou', '🔊 Listen again')),
        h('button.btn', { onclick: go2 }, L('Sari peste →', 'Skip →')))));
    if (!hidden) sayAsync(it.en).then(() => { if (alive && i === at) mic.start(); });
  }
  function finish() {
    if (mic) { mic.stop(); mic = null; }
    const score = ok / items.length;
    if (score >= 0.75) { confetti(1500); sfx('win'); }
    shell.stage.replaceChildren(resultCard({ score, title: score >= 0.75 ? L('Foarte bine! 💪', 'Very good! 💪') : L('Rundă terminată', 'Round finished'),
      lines: [L(`${sentences(ok)} din ${items.length} rostite bine · +${ok * 2} XP ⚡`, `${ok} of ${items.length} said well · +${ok * 2} XP ⚡`)],
      actions: [h('button.btn.primary.big', { onclick: again }, L('🔁 Rundă nouă', '🔁 New round')), btn(L('Înapoi', 'Back'), backHash)] }));
  }
  show();
  return stop;
}

function repeat(main, topic) {
  const lv = chosenLevel();
  const topics = lv.speaking ? lv.speaking.phrases : [];
  const fromLessons = lessonLines(lv);
  const pool = topic === 'lessons' ? fromLessons : topics[Number(topic)] ? topics[Number(topic)].items : null;
  if (pool && pool.length) {
    const box = h('div');
    main.append(box);
    let stop = () => {};
    const start = () => { stop = sentenceRound(box, sample(pool, Math.min(8, pool.length)), { hidden: false, backHash: '#/speak/repeat',
      title: topic === 'lessons' ? L('🔁 Propoziții din lecțiile tale', '🔁 Sentences from your lessons') : `${topics[Number(topic)].emoji} ${topics[Number(topic)].topic}`, again: () => { stop(); start(); } }); };
    start();
    return () => stop();
  }
  main.append(header(L('🔁 Repetă după mine', '🔁 Repeat after me'), L(`Alege o temă (nivel ${lv.name}). Câte 8 propoziții pe rundă.`, `Pick a topic (level ${lv.name}). 8 sentences per round.`), '#/speak'),
    h('div.game-grid',
      topics.map((t, n) => h('a.card.game', { href: `#/speak/repeat/${n}` }, h('div.game-icon', t.emoji), h('h3', t.topic), h('p.muted', t.topicRo))),
      fromLessons.length ? h('a.card.game', { href: '#/speak/repeat/lessons' }, h('div.game-icon', '📚'), h('h3', L('Din lecțiile mele', 'From my lessons')), h('p.muted', L('Replici din dialogurile unităților deschise.', 'Lines from the dialogues of your open units.'))) : null),
    !topics.length ? noContent(L('Temele de fraze pentru acest nivel sunt în pregătire', 'Phrase topics for this level are coming soon')) : null);
}

function say(main) {
  const lv = chosenLevel();
  const pool = [
    ...(lv.speaking ? lv.speaking.phrases.flatMap((t) => t.items) : []),
    ...lv.units.filter(unitUnlocked).flatMap((u) => u.vocab.map((w) => ({ en: w.ex, ro: w.exRo }))),
  ].filter((x) => x.en.split(/\s+/).length <= 12);
  if (!pool.length) return main.append(empty('⏳', L('Nimic de exersat încă', 'Nothing to practise yet'), '', [btn(L('Înapoi', 'Back'), '#/speak', 'primary')]));
  const box = h('div');
  main.append(box);
  let stop = () => {};
  const start = () => { stop = sentenceRound(box, sample(pool, 8), { hidden: true, backHash: '#/speak', title: L(`🇬🇧 Spune în engleză · nivel ${lv.name}`, `🇬🇧 Say it in English · level ${lv.name}`), again: () => { stop(); start(); } }); };
  start();
  return () => stop();
}

// ================= open questions =================
function answer(main) {
  const lv = chosenLevel();
  if (!lv.speaking) return main.append(header(L('🙋 Răspunde la întrebare', '🙋 Answer the question'), '', '#/speak'), noContent(L('Întrebările pentru acest nivel sunt în pregătire', 'Questions for this level are coming soon')));
  const box = h('div');
  main.append(box);
  let alive = true, mic = null;
  const stop = () => { alive = false; if (mic) mic.stop(); stopSpeak(); };
  const start = () => {
    const items = sample(lv.speaking.questions, 5);
    let i = 0, good = 0;
    const shell = sessionShell(box, L(`🙋 Răspunde la întrebare · nivel ${lv.name}`, `🙋 Answer the question · level ${lv.name}`), '#/speak', stop);
    const show = () => {
      if (mic) { mic.stop(); mic = null; }
      if (i >= items.length) {
        if (good >= 4) { confetti(1500); sfx('win'); }
        return shell.stage.replaceChildren(resultCard({ score: good / items.length, title: L('Rundă terminată', 'Round finished'),
          lines: [L(`Ai răspuns la ${good} din ${items.length} întrebări · +${good * 3} XP ⚡`, `You answered ${good} of ${items.length} questions · +${good * 3} XP ⚡`)],
          actions: [h('button.btn.primary.big', { onclick: start }, L('🔁 Alte întrebări', '🔁 More questions')), btn(L('Înapoi', 'Back'), '#/speak')] }));
      }
      shell.progress(i, items.length);
      const q = items[i];
      let counted = false;
      const out = h('div');
      const sampleBox = h('div');
      const showSample = () => sampleBox.replaceChildren(h('div.example', speakBtn(q.sample), h('div', h('div.muted.small', L('Un răspuns bun:', 'A good answer:')), h('div.en', q.sample))));
      mic = micPanel((heard) => {
        const text = heard === null ? '' : heard[0];
        const n = text.trim() ? text.trim().split(/\s+/).length : 0;
        const fine = heard === null || n >= 4;
        if (fine && !counted) { counted = true; good++; countSpoken(1, 3); sfx('ok'); }
        out.replaceChildren(h('div.feedback.' + (fine ? 'good' : 'bad'),
          h('div.fb-head', fine ? L('Am înțeles ce ai spus ✅', 'I understood what you said ✅') : L('Prea scurt — spune o propoziție întreagă', 'Too short — say a full sentence')),
          text ? h('div', L('Am auzit: ', 'I heard: '), h('em', `„${text}”`), ` · ${n} ${plural(n, L('cuvânt', 'word'), L('cuvinte', 'words'))}`) : null));
        showSample();
      });
      shell.stage.replaceChildren(h('div.ex.fade-in',
        h('div.ex-type', L('Răspunde cu voce tare', 'Answer aloud')),
        h('div.ex-q', speakBtn(q.q), ' ', q.q),
        h('div.muted', '🇷🇴 ', q.qRo),
        h('div.starters', h('span.muted.small', L('Poți începe cu:', 'You can start with:')), q.starters.map((s) => h('span.chip-tag.now', s))),
        mic.node, out, sampleBox,
        h('div.row.center.wrap.mt', h('button.btn', { onclick: showSample }, L('👁 Arată un răspuns bun', '👁 Show a good answer')),
          h('button.btn.primary', { onclick: () => { i++; show(); } }, L('Următoarea →', 'Next →')))));
      sayAsync(q.q);
    };
    show();
  };
  start();
  return stop;
}

// ================= sound-alike words =================
function pairs(main) {
  const box = h('div');
  main.append(box);
  let alive = true, mic = null;
  const stop = () => { alive = false; if (mic) mic.stop(); stopSpeak(); };
  const start = () => {
    const items = sample(PAIRS, 8).map((p) => ({ pair: p, target: p[Math.floor(Math.random() * 2)] }));
    let i = 0, good = 0;
    const shell = sessionShell(box, L('👂 Cuvinte care seamănă', '👂 Sound-alike words'), '#/speak', stop);
    const show = () => {
      if (mic) { mic.stop(); mic = null; }
      if (i >= items.length) {
        const rec = speakRecord('pairs', good);
        addXp(good * 2);
        if (good >= 6) { confetti(1500); sfx('win'); }
        return shell.stage.replaceChildren(resultCard({ score: good / items.length, title: rec && good ? L('Record nou! 🏆', 'New record! 🏆') : L('Rundă terminată', 'Round finished'),
          lines: [L(`${good} din ${items.length} · +${good * 2} XP ⚡`, `${good} of ${items.length} · +${good * 2} XP ⚡`),
            L('Recunoașterea vocii greșește uneori la cuvinte izolate. Dacă ești sigur că ai spus bine, ascultă din nou modelul și compară.', 'Speech recognition sometimes gets single words wrong. If you are sure you said it right, listen to the model again and compare.')],
          actions: [h('button.btn.primary.big', { onclick: start }, L('🔁 Rundă nouă', '🔁 New round')), btn(L('Înapoi', 'Back'), '#/speak')] }));
      }
      shell.progress(i, items.length);
      const { pair, target } = items[i];
      const other = pair.find((w) => w !== target);
      const at = i;
      let tries = 0;
      const feedback = h('div');
      mic = micPanel((heard) => {
        tries++;
        const okNow = heard === null || heard.some((x) => saidWord(x, target));
        if (okNow) {
          sfx('ok'); if (tries === 1) good++;
          feedback.replaceChildren(h('div.feedback.good', h('div.fb-head', L(`Da — „${target}” ✅`, `Yes — “${target}” ✅`))));
          return setTimeout(() => { if (alive && i === at) { i++; show(); } }, 1000);
        }
        sfx('bad');
        const said = heard.some((x) => saidWord(x, other));
        feedback.replaceChildren(h('div.feedback.bad', h('div.fb-head', said ? L(`Am auzit „${other}” — celălalt cuvânt`, `I heard “${other}” — the other word`) : L('Nu am prins cuvântul', 'I did not catch the word')),
          h('div', L('Am auzit: ', 'I heard: '), h('em', `„${heard[0]}”`), L(' · ascultă diferența și mai încearcă.', ' · listen to the difference and try again.'))));
      });
      shell.stage.replaceChildren(h('div.ex.fade-in',
        h('div.ex-type', L('Ascultă ambele cuvinte, apoi spune-l pe cel cerut', 'Listen to both words, then say the one asked for')),
        h('div.pair-cards', pair.map((w) => h('button.pair-card' + (w === target ? '.target' : ''), { onclick: () => speak(w) }, h('span', '🔊'), h('strong', w)))),
        h('div.ex-q.center', L('Spune: ', 'Say: '), h('span.tw.hit', target)),
        mic.node, feedback,
        h('div.row.center.mt', h('button.btn', { onclick: () => { i++; show(); } }, L('Sari peste →', 'Skip →')))));
      speak(target);
    };
    show();
  };
  start();
  return stop;
}

// ================= voice sprint =================
function sprint(main) {
  main.append(header(L('⚡ Sprint vocal', '⚡ Voice sprint'), L('Vezi cuvântul în română și îl spui în engleză. Microfonul ascultă tot timpul.', 'See the word in Romanian and say it in English. The microphone listens the whole time.'), '#/speak'));
  const box = h('div');
  main.append(box);
  let timer = null, stream = null;
  const stop = () => { clearInterval(timer); if (stream) stream.stop(); stream = null; };
  if (!canListen()) return box.append(empty('🎙', L('Jocul are nevoie de recunoașterea vocii', 'This game needs speech recognition'), L('Merge în Chrome și Edge.', 'It works in Chrome and Edge.'), [btn(L('Înapoi', 'Back'), '#/speak', 'primary')]));
  const start = () => {
    stop();
    const pool = sprintPool();
    let left = 60, score = 0, n = 0, cur = null;
    const time = h('div.sprint-time', '60'), points = h('div.sprint-score', L('0 cuvinte', '0 words'));
    const word = h('div.sprint-word'), hint = h('div.sprint-hint'), heardEl = h('div.mic-status');
    const next = () => {
      cur = pool[n++ % pool.length];
      word.replaceChildren(cur.emoji, ' ', cur.ro);
      hint.className = 'sprint-hint'; hint.textContent = letterHint(cur.en);
      if (stream) stream.reset();
    };
    // "I don't know": show and say the word, so the round still teaches something, then move on
    const reveal = () => {
      if (!cur) return;
      const w = cur; cur = null;
      hint.className = 'sprint-hint shown'; hint.textContent = w.en; speak(w.en);
      setTimeout(() => { if (stream) next(); }, 1500);
    };
    const end = (errorText) => {
      stop();
      const rec = !errorText && speakRecord('sprint', score);
      const xp = Math.min(20, score * 2); addXp(xp);
      if (rec && score) { confetti(); sfx('win'); }
      box.replaceChildren(h('div.result', h('div.big-level', score),
        h('h2', errorText ? L('Microfonul s-a oprit', 'The microphone stopped') : rec && score ? L('Record nou! 🏆', 'New record! 🏆') : L('Timpul a expirat!', 'Time is up!')),
        h('p.muted', errorText || L(`${score} ${plural(score, 'cuvânt spus', 'cuvinte spuse')} · +${xp} XP ⚡`, `${score} ${plural(score, 'word', 'words')} said · +${xp} XP ⚡`)),
        h('div.row.center', h('button.btn.primary.big', { onclick: start }, L('🔁 Încă o dată', '🔁 Once more')), btn(L('Înapoi', 'Back'), '#/speak'))));
    };
    box.replaceChildren(h('div.sprint-top', time, points),
      h('div.ex', word, hint, heardEl, h('div.row.center.mt', h('button.btn', { onclick: reveal }, L('Nu știu — arată-mi', "I don't know — show me")))));
    stream = listenStream((text) => {
      heardEl.textContent = text ? `„${text}”` : '';
      if (cur && saidWord(text, cur.en)) { score++; sfx('ok'); points.textContent = `${score} ${plural(score, L('cuvânt', 'word'), L('cuvinte', 'words'))}`; heardEl.textContent = `✅ ${cur.en}`; next(); }
    }, (kind, value) => {
      if (kind === 'error') end(`${value.text} (${L('cod', 'code')}: ${value.code})`);
      else if (kind === 'info') heardEl.textContent = value;
    });
    next();
    timer = setInterval(() => { left--; time.textContent = left; time.classList.toggle('low', left <= 10); if (left <= 0) end(); }, 1000);
  };
  box.append(empty('⚡', L('Ești gata?', 'Ready?'), L(`Ai 60 de secunde. Motor de recunoaștere: ${speechEngine() === 'local' ? 'pe calculator' : 'online'}.`, `You have 60 seconds. Recognition engine: ${speechEngine() === 'local' ? 'on this computer' : 'online'}.`),
    [h('button.btn.primary.big', { onclick: start }, '▶ Start')]));
  return stop;
}
