// A unit (6 steps), level exam, placement test, mistakes review.
import { h, md, speak, stopSpeak, speakBtn, picture, shuffle, sample, confetti, sfx, canListen, listen, speechScore, toast, recorder, canRecord, MIC_FATAL } from '../util.js';
import {
  S, save, level, bankWords, countWords, unitState, unitUnlocked, levelUnlocked, levelPassed, completeStep, recordUnitTest, buildExam, recordExam,
  recordPlacement, reviewUnits, addMistake, clearMistake, mistakeItems, addXp, STEPS, PASS, PLACEMENT_PASS,
} from '../store.js';
import { runSession, resultCard } from '../exercise.js';
import { header, btn, bar, chip, grammarNode, empty, pct, go } from '../ui.js';
import { L, plural } from '../i18n.js';
import { bankStep } from './bank.js';

const STEP_INFO = {
  vocab: ['🗂️', L('Cuvinte noi', 'New words'), L('Vezi, ascultă și reține cuvintele unității', 'See, hear and remember the words of the unit')],
  grammar: ['📐', L('Gramatică', 'Grammar'), L('Regula explicată simplu, cu exemple', 'The rule explained simply, with examples')],
  dialogue: ['💬', L('Dialog', 'Dialogue'), L('Ascultă o conversație reală și repet-o', 'Listen to a real conversation and repeat it')],
  practice: ['✏️', L('Exerciții', 'Exercises'), L('Exersează cu feedback imediat', 'Practise with instant feedback')],
  reading: ['📖', L('Citire', 'Reading'), L('Un text scurt și întrebări de înțelegere', 'A short text and comprehension questions')],
  test: ['🎯', L('Testul unității', 'Unit test'), L(`Minimum ${Math.round(PASS * 100)}% ca să treci mai departe`, `At least ${Math.round(PASS * 100)}% to move on`)],
};
const ORDER = [...STEPS, 'test'];
const nextStep = (s) => ORDER[ORDER.indexOf(s) + 1];

export function unitView(main, id, step) {
  const u = S.unitById[id];
  if (!u) return main.append(empty('🤷', L('Unitatea nu există', "This unit doesn't exist"), '', [btn(L('Înapoi la lecții', 'Back to lessons'), '#/learn', 'primary')]));
  const lv = level(u.levelId);
  if (!unitUnlocked(u)) return main.append(empty('🔒', L('Unitate blocată', 'Unit locked'), L('Termină întâi unitatea anterioară (testul cu minimum 80%).', 'Finish the previous unit first (its test with at least 80%).'), [btn(L('Înapoi la lecții', 'Back to lessons'), '#/learn', 'primary')]));
  if (!step) return overview(main, u, lv);
  const steps = { vocab, grammar, dialogue, practice, reading, test, bank: bankStep };
  if (!steps[step]) return go(`#/unit/${u.id}`);
  main.append(h('div.step-head', { style: `--c:${lv.color}` },
    h('a.back', { href: `#/unit/${u.id}` }, `← ${u.emoji} ${u.title}`),
    h('div.step-dots', ORDER.map((s) => h('a.step-dot' + (s === step ? '.now' : '') + ((s === 'test' ? unitState(u.id).passed : unitState(u.id).steps[s]) ? '.done' : ''), { href: `#/unit/${u.id}/${s}`, title: STEP_INFO[s][1] }, STEP_INFO[s][0])))));
  const box = h('div.step-body');
  main.append(box);
  return steps[step](box, u, lv);
}

function overview(main, u, lv) {
  const st = unitState(u.id);
  main.append(
    h('div.unit-hero', { style: `--c:${lv.color}` },
      h('a.back', { href: '#/learn' }, L('← Toate lecțiile', '← All lessons')),
      h('div.unit-hero-row', h('div.unit-hero-emoji', u.emoji),
        h('div', h('div.muted', L(`${lv.name} · Unitatea ${u.order}`, `${lv.name} · Unit ${u.order}`)), h('h1', u.title), h('p.muted', u.titleRo))),
      h('p.goal', '🎯 ', u.goalRo),
      st.review ? h('div.alert.warn', L('⚠️ La examen ai greșit întrebări din această unitate. Recapitulează și treci din nou testul unității.', '⚠️ You got some questions from this unit wrong in the exam. Review it and pass the unit test again.')) : null),
    h('div.steps', ORDER.map((s, i) => {
      const done = s === 'test' ? st.passed : !!st.steps[s];
      const [icon, name, desc] = STEP_INFO[s];
      return [h('a.step-row' + (done ? '.done' : ''), { href: `#/unit/${u.id}/${s}` },
        h('span.step-icon', icon),
        h('span.grow', h('strong', `${i + 1}. ${name}`), h('small.muted', s === 'grammar' ? u.grammar.titleRo : desc)),
        s === 'test' && st.best ? chip(L(`cel mai bun: ${pct(st.best)}%`, `best: ${pct(st.best)}%`), st.passed ? 'ok' : 'warn') : null,
        h('span.step-check', done ? '✅' : '▶')),
      s === 'vocab' ? bankRow(u, lv) : null];
    }),
    h('a.step-row.extra', { href: `#/speak/role/${u.id}` },
      h('span.step-icon', '🎭'),
      h('span.grow', h('strong', L('Bonus: joc de rol cu vocea', 'Bonus: voice role-play')), h('small.muted', L('Joacă un personaj din dialog: aplicația spune replicile celuilalt, tu le spui pe ale tale', 'Play one character of the dialogue: the app says the other lines, you say yours'))),
      (S.p.speak && S.p.speak.scen && S.p.speak.scen[`role-${u.id}`] !== undefined) ? chip(`${pct(S.p.speak.scen[`role-${u.id}`])}%`, 'ok') : null,
      h('span.step-check', '🎙'))),
    u.video ? videoCard(u) : null);
}

/** The unit's word bank: extra words learned in batches, next to "New words" (not needed to pass the unit). */
function bankRow(u, lv) {
  const ws = bankWords(u);
  if (!ws.length) return null;
  const c = countWords(ws);
  const done = c.new === 0;
  return h('a.step-row.bank-row' + (done ? '.done' : ''), { href: `#/unit/${u.id}/bank`, style: `--c:${lv.color}` },
    h('span.step-icon', '📚'),
    h('span.grow', h('strong', L(`1+. Banca de cuvinte: încă ${ws.length}`, `1+. Word bank: ${ws.length} more words`)),
      h('small.muted', L(`Cuvinte uzuale de nivel ${lv.name}, câte 20 pe rând — așa ajungi la vocabularul real al nivelului`, `Common ${lv.name} words, 20 at a time — this is how you reach the real vocabulary of the level`)),
      bar((c.learned + c.learning * 0.5) / c.total, lv.color)),
    chip(`${c.learned} / ${c.total}`, c.learned === c.total ? 'ok' : c.learned + c.learning ? 'now' : 'lock'),
    h('span.step-check', done ? '✅' : '▶'));
}

export function videoCard(u) {
  const v = u.video;
  const holder = h('div.video-thumb', { onclick: () => {
    holder.replaceWith(h('div.video-frame', h('iframe', {
      src: `https://www.youtube-nocookie.com/embed/${v.youtubeId}?autoplay=1&rel=0&cc_load_policy=1&cc_lang_pref=en`,
      allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture', allowfullscreen: true,
      referrerpolicy: 'strict-origin-when-cross-origin', title: v.title })));
  } }, h('img', { src: `https://i.ytimg.com/vi/${v.youtubeId}/hqdefault.jpg`, alt: v.title, loading: 'lazy' }), h('span.play', '▶'));
  return h('div.card.video-card', h('h3', L('🎬 Video recomandat', '🎬 Recommended video')), holder,
    h('div.row.between.wrap', h('span', v.title), h('a', { href: `https://www.youtube.com/watch?v=${v.youtubeId}`, target: '_blank', rel: 'noopener' }, L('Deschide pe YouTube ↗', 'Open on YouTube ↗'))));
}

const doneBar = (u, step, label) => h('div.row.center.mt', h('button.btn.primary.big', { onclick: () => {
  if (completeStep(u, step)) { sfx('ok'); toast('+10 XP ⚡'); }
  go(`#/unit/${u.id}/${nextStep(step)}`);
} }, label));

// ---------- 1. vocabulary ----------
function vocab(box, u) {
  let i = 0;
  const words = u.vocab;
  const card = h('div.vcard');
  const dots = h('div.dots');
  const prev = h('button.btn', { onclick: () => { if (i > 0) { i--; draw(); } } }, L('← Înapoi', '← Back'));
  const next = h('button.btn.primary', { onclick: () => { if (i < words.length - 1) { i++; draw(); } else quickCheck(); } }, L('Următorul →', 'Next →'));
  const onKey = (e) => { if (e.key === 'ArrowRight') next.click(); else if (e.key === 'ArrowLeft') prev.click(); else if (e.key === ' ') { e.preventDefault(); speak(words[i].en); } };
  document.addEventListener('keydown', onKey);
  function draw() {
    const w = words[i];
    card.replaceChildren(h('div.vcard-in.fade-in',
      picture(w, 'big'),
      h('div.vword', h('span', w.en), speakBtn(w.en)),
      h('div.vipa', w.ipa, ' · ', h('em', w.pos)),
      h('div.vro', w.ro),
      h('div.vex', speakBtn(w.ex), h('div', h('div.en', w.ex), h('div.ro', w.exRo)))));
    dots.replaceChildren(...words.map((_, n) => h('span.dot' + (n === i ? '.now' : n < i ? '.done' : ''), { onclick: () => { i = n; draw(); } })));
    prev.disabled = i === 0;
    next.textContent = i === words.length - 1 ? L('Verificare rapidă →', 'Quick check →') : L('Următorul →', 'Next →');
    speak(w.en);
  }
  function quickCheck() {
    document.removeEventListener('keydown', onKey);
    const items = sample(words, Math.min(6, words.length)).map((w) => {
      const opts = shuffle([w.ro, ...sample(words.filter((x) => x.ro !== w.ro), 3).map((x) => x.ro)]);
      return { ex: { type: 'mc', q: L(`Ce înseamnă **${w.en}**?`, `What does **${w.en}** mean?`), options: opts, answer: opts.indexOf(w.ro), explainRo: `**${w.en}** = ${w.ro}. ${w.ex}` } };
    });
    runSession(box, items, {
      mode: 'practice', title: L('Verificare rapidă: îți amintești cuvintele?', 'Quick check: do you remember the words?'), onExit: () => go(`#/unit/${u.id}`),
      onFinish: (res) => {
        const first = completeStep(u, 'vocab');
        const score = res.filter((r) => r.correct).length / res.length;
        box.replaceChildren(resultCard({ score, title: L('Cuvintele au intrat în cartonașele tale 🗂️', 'The words are now in your flashcards 🗂️'),
          lines: [first ? L('+10 XP ⚡ · Le vei repeta la intervale tot mai mari, ca să nu le uiți.', "+10 XP ⚡ · You'll review them at growing intervals so you don't forget them.") : L('Le poți repeta oricând la „Cartonașe”.', 'You can review them anytime in “Flashcards”.')],
          actions: [btn(L('Mai departe: Gramatică →', 'Next: Grammar →'), `#/unit/${u.id}/grammar`, 'primary big'), h('button.btn', { onclick: () => go(`#/unit/${u.id}`) }, L('Înapoi la unitate', 'Back to unit'))] }));
      },
    });
  }
  box.append(h('p.muted.center', L(`${words.length} cuvinte · ← → pentru navigare · Space pentru audio`, `${words.length} words · ← → to navigate · Space for audio`)), card, dots, h('div.row.center', prev, next));
  draw();
  return () => { document.removeEventListener('keydown', onKey); stopSpeak(); };
}

// ---------- 2. grammar ----------
function grammar(box, u) {
  box.append(grammarNode(u), doneBar(u, 'grammar', L('Am înțeles ✓ — mai departe: Dialog →', 'Got it ✓ — next: Dialogue →')));
}

// ---------- 3. dialogue ----------
function dialogue(box, u) {
  const d = u.dialogue;
  const speakers = [...new Set(d.lines.map((l) => l.speaker))];
  let showRo = true;
  let playRun = 0, playing = false; // playRun changes whenever playback is started or stopped
  let active = null;                // the microphone session in progress, if any
  const list = h('div.dialogue');
  const fallback = h('div');        // "record yourself" card, shown when speech recognition cannot be used
  const showRecorder = (why) => {
    if (fallback.childNodes.length || !canRecord()) return;
    fallback.append(h('div.card', h('h3', L('🎙 Înregistrează-te și ascultă-te', '🎙 Record yourself and listen back')), h('p.muted', why), recorder().node));
  };
  const stopPlay = () => {
    playRun++; playing = false; stopSpeak();
    playAll.textContent = L('▶ Ascultă tot dialogul', '▶ Listen to the whole dialogue');
    rows.forEach((r) => r.classList.remove('playing'));
  };
  const rows = d.lines.map((l) => {
    const side = speakers.indexOf(l.speaker) === 0 ? 'left' : 'right';
    const score = h('div.mic-score');
    const level = h('span.mic-level.hidden', h('i'));
    const mic = canListen() ? h('button.icon-btn', { title: L('Repetă tu propoziția', 'Say the sentence yourself'), onclick: async () => {
      if (active && active.mic === mic) return active.session.stop(); // second click = "I'm done speaking"
      if (active) active.session.stop();
      stopPlay();
      mic.classList.add('rec'); level.classList.remove('hidden');
      score.className = 'mic-score'; score.textContent = L('Pornesc microfonul…', 'Starting the microphone…');
      await new Promise((r) => setTimeout(r, 250)); // let the speakers go quiet first
      const session = listen((kind, value) => {
        if (kind === 'ready') score.textContent = L('🎙 Vorbește acum…', '🎙 Speak now…');
        else if (kind === 'info') score.textContent = value;
        else if (kind === 'retry') score.textContent = L('🎙 Am trecut pe recunoașterea de pe calculator. Spune propoziția din nou, acum…', '🎙 Switched to on-device recognition. Say the sentence again, now…');
        else if (kind === 'level') level.firstChild.style.width = `${Math.min(100, Math.round(value * 250))}%`;
        else if (kind === 'interim') score.textContent = L(`Aud: „${value}”`, `I hear: “${value}”`);
      });
      const mine = { mic, session };
      active = mine;
      try {
        const heard = await session.done;
        const sc = speechScore(l.en, heard);
        score.classList.add(sc >= 0.8 ? 'good' : 'warn');
        score.textContent = sc >= 0.8 ? L(`Excelent! ${pct(sc)}% 🎉`, `Excellent! ${pct(sc)}% 🎉`) : sc >= 0.5 ? L(`Aproape: ${pct(sc)}% — am auzit „${heard[0]}”`, `Almost: ${pct(sc)}% — I heard “${heard[0]}”`) : L(`Mai încearcă — am auzit „${heard[0]}”`, `Try again — I heard “${heard[0]}”`);
        if (sc >= 0.8) sfx('ok');
      } catch (e) {
        score.classList.add('bad');
        score.textContent = L(`${e.text || 'Recunoașterea vocii a dat o eroare.'} (cod: ${e.code || e.message})`, `${e.text || 'Speech recognition ran into an error.'} (code: ${e.code || e.message})`);
        if (MIC_FATAL.includes(e.code)) showRecorder(L('Recunoașterea automată a vocii nu merge în acest browser, dar te poți înregistra și asculta, apoi compara cu vocea aplicației.', "Automatic speech recognition doesn't work in this browser, but you can record yourself, listen back and compare with the app's voice."));
      }
      if (active === mine) active = null;
      mic.classList.remove('rec'); level.classList.add('hidden');
    } }, '🎤') : null;
    return h('div.line.' + side,
      h('div.bubble', h('div.spk', l.speaker), h('div.en', l.en), h('div.ro', l.ro),
        h('div.row.line-tools', speakBtn(l.en), mic, level), score));
  });
  list.append(...rows);
  const playAll = h('button.btn.primary', { onclick: () => {
    if (playing) return stopPlay();
    if (active) active.session.stop();
    const run = ++playRun;
    playing = true; playAll.textContent = L('⏹ Oprește', '⏹ Stop');
    let i = 0;
    const step = () => {
      if (run !== playRun) return;
      rows.forEach((r) => r.classList.remove('playing'));
      if (i >= d.lines.length) return stopPlay();
      rows[i].classList.add('playing'); rows[i].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      speak(d.lines[i].en, { onend: () => { i++; setTimeout(step, 350); } });
    };
    step();
  } }, L('▶ Ascultă tot dialogul', '▶ Listen to the whole dialogue'));
  const toggle = h('button.btn', { onclick: () => { showRo = !showRo; list.classList.toggle('hide-ro', !showRo); toggle.textContent = showRo ? L('🙈 Ascunde traducerea', '🙈 Hide translation') : L('👁 Arată traducerea', '👁 Show translation'); } }, L('🙈 Ascunde traducerea', '🙈 Hide translation'));
  box.append(h('h2.center', '💬 ', d.titleRo),
    h('p.muted.center', canListen() ? L('Ascultă, apoi apasă 🎤 și repetă fiecare replică cu voce tare. Apasă din nou pe 🎤 când ai terminat de vorbit.', 'Listen, then tap 🎤 and repeat each line out loud. Tap 🎤 again when you have finished speaking.') : L('Ascultă și repetă fiecare replică cu voce tare.', 'Listen and repeat each line out loud.')),
    h('div.row.center.wrap', playAll, toggle, canListen() ? btn(L('🎭 Joacă un rol', '🎭 Play a role'), `#/speak/role/${u.id}`) : null),
    list, fallback, doneBar(u, 'dialogue', L('Gata ✓ — mai departe: Exerciții →', 'Done ✓ — next: Exercises →')));
  if (!canListen()) showRecorder(L('Browserul acesta nu are recunoaștere automată a vocii (merge în Chrome și Edge), dar te poți înregistra și asculta.', "This browser doesn't have automatic speech recognition (it works in Chrome and Edge), but you can record yourself and listen back."));
  return () => { if (active) active.session.stop(); stopPlay(); };
}

// ---------- 4. practice ----------
function practice(box, u) {
  const items = u.exercises.map((ex, i) => ({ ex, unit: u.id, key: `${u.id}:${i}` }));
  return runSession(box, items, {
    mode: 'practice', onExit: () => go(`#/unit/${u.id}`),
    onFinish: (res) => {
      const ok = res.filter((r) => r.correct).length;
      res.forEach((r) => { if (r.correct) clearMistake(r.key); else if (r.ex.type !== 'match') addMistake(r.key); });
      completeStep(u, 'practice', 0);
      addXp(ok * 2);
      const score = ok / res.length;
      if (score >= 0.8) confetti(1500);
      box.replaceChildren(resultCard({ score, title: score >= 0.8 ? L('Foarte bine! 💪', 'Very good! 💪') : score >= 0.5 ? L('Merge! Încă puțin exercițiu.', 'Not bad! A bit more practice.') : L('E greu la început — e normal.', "It's hard at first — that's normal."),
        lines: [L(`${ok} din ${res.length} corecte din prima · +${ok * 2} XP ⚡`, `${ok} of ${res.length} right on the first try · +${ok * 2} XP ⚡`), score < 0.6 ? L('Sfat: recitește gramatica și refă exercițiile înainte de test.', 'Tip: reread the grammar and redo the exercises before the test.') : ''],
        actions: [btn(L('Mai departe: Citire →', 'Next: Reading →'), `#/unit/${u.id}/reading`, 'primary big'),
          h('button.btn', { onclick: () => { box.replaceChildren(); practice(box, u); } }, L('🔁 Refă exercițiile', '🔁 Redo the exercises')),
          score < 0.6 ? btn(L('📐 Recitește gramatica', '📐 Reread the grammar'), `#/unit/${u.id}/grammar`) : null] }));
    },
  });
}

// ---------- 5. reading ----------
function reading(box, u) {
  const r = u.reading;
  let showRo = false;
  const ro = h('div.read-ro.hidden', { html: md(r.textRo) });
  const toggle = h('button.btn', { onclick: () => { showRo = !showRo; ro.classList.toggle('hidden', !showRo); toggle.textContent = showRo ? L('🙈 Ascunde traducerea', '🙈 Hide translation') : L('🇷🇴 Arată traducerea', '🇷🇴 Show translation'); } }, L('🇷🇴 Arată traducerea', '🇷🇴 Show translation'));
  const qbox = h('div.read-q');
  box.append(h('div.read',
    h('div.card.read-text', h('h2', '📖 ', r.title),
      h('div.row.wrap', h('button.btn', { onclick: () => speak(r.text) }, L('🔊 Ascultă textul', '🔊 Listen to the text')), h('button.btn', { onclick: stopSpeak }, '⏹'), toggle),
      h('div.read-en', { html: md(r.text) }), ro),
    qbox));
  const stop = runSession(qbox, r.questions.map((ex, i) => ({ ex, unit: u.id, key: `${u.id}:r${i}` })), {
    mode: 'practice', title: L('Întrebări despre text', 'Questions about the text'), onExit: () => go(`#/unit/${u.id}`),
    onFinish: (res) => {
      const ok = res.filter((x) => x.correct).length;
      const first = completeStep(u, 'reading');
      qbox.replaceChildren(resultCard({ score: ok / res.length, title: ok === res.length ? L('Ai înțeles tot textul! 🎉', 'You understood the whole text! 🎉') : L('Text parcurs ✓', 'Text done ✓'),
        lines: [L(`${ok} din ${res.length} corecte${first ? ' · +10 XP ⚡' : ''}`, `${ok} of ${res.length} correct${first ? ' · +10 XP ⚡' : ''}`)],
        actions: [btn(L('Mai departe: Testul unității →', 'Next: Unit test →'), `#/unit/${u.id}/test`, 'primary big')] }));
    },
  });
  return () => { stop(); stopSpeak(); };
}

// ---------- 6. unit test ----------
function test(box, u, lv) {
  const st = unitState(u.id);
  const missing = STEPS.filter((s) => !st.steps[s]);
  const start = () => {
    const pool = u.exercises.map((ex, i) => ({ ex, unit: u.id, key: `${u.id}:${i}` })).filter((x) => x.ex.type !== 'match');
    runSession(box, sample(pool, Math.min(12, pool.length)), {
      mode: 'test', title: L(`🎯 Testul unității ${u.order}`, `🎯 Unit ${u.order} test`), onExit: () => go(`#/unit/${u.id}`),
      onFinish: (res) => {
        const score = res.filter((r) => r.correct).length / res.length;
        res.forEach((r) => { if (r.correct) clearMistake(r.key); else addMistake(r.key); });
        const passed = recordUnitTest(u, score);
        const nextU = lv.units[u.index + 1];
        const stillReview = reviewUnits(lv);
        if (passed) { confetti(); sfx('win'); }
        box.replaceChildren(resultCard({ score, passed, passMark: PASS,
          title: passed ? L('Unitate trecută! ⭐', 'Unit passed! ⭐') : L('Încă nu — mai exersează puțin', 'Not yet — practise a bit more'),
          lines: passed ? [L('Ai deblocat pasul următor.', "You've unlocked the next step.")] : [L('Nu-i nimic, așa se învață. Întoarce-te la **gramatică** și **exerciții**, apoi încearcă din nou. Întrebările greșite sunt salvate la „Greșelile mele”.', "No worries, that's how you learn. Go back to the **grammar** and **exercises**, then try again. The questions you got wrong are saved in “My mistakes”.")],
          actions: passed
            ? [stillReview.length ? btn(L(`Următoarea de recapitulat: unitatea ${stillReview[0].order} →`, `Next to review: Unit ${stillReview[0].order} →`), `#/unit/${stillReview[0].id}`, 'primary big')
              : nextU ? btn(L(`Unitatea ${nextU.order}: ${nextU.title} →`, `Unit ${nextU.order}: ${nextU.title} →`), `#/unit/${nextU.id}`, 'primary big') : btn(L(`🎓 Examenul ${lv.name} →`, `🎓 ${lv.name} level exam →`), `#/exam/${lv.id}`, 'primary big'),
            btn(L('Acasă', 'Home'), '#/')]
            : [btn(L('📐 Gramatică', '📐 Grammar'), `#/unit/${u.id}/grammar`, 'primary'), btn(L('✏️ Exerciții', '✏️ Exercises'), `#/unit/${u.id}/practice`, 'primary'), btn(L('🩹 Greșelile mele', '🩹 My mistakes'), '#/mistakes'),
              h('button.btn', { onclick: () => { box.replaceChildren(); start(); } }, L('🔁 Încearcă din nou', '🔁 Try again'))] }));
      },
    });
  };
  box.append(empty('🎯', L(`Testul unității ${u.order}`, `Unit ${u.order} test`),
    L(`12 întrebări din tot ce ai învățat în această unitate. Ai nevoie de minimum ${pct(PASS)}% ca să treci. La test nu primești explicații după fiecare întrebare.`, `12 questions on everything you learned in this unit. You need at least ${pct(PASS)}% to pass. There are no explanations after each question in the test.`),
    [h('button.btn.primary.big', { onclick: () => { box.replaceChildren(); start(); } }, L('▶ Începe testul', '▶ Start the test'))]),
  missing.length ? h('div.alert.warn', L(`Sfat: nu ai terminat încă pașii: ${missing.map((s) => STEP_INFO[s][1]).join(', ')}. Poți da testul oricum, dacă știi deja materia.`, `Tip: you haven't finished these steps yet: ${missing.map((s) => STEP_INFO[s][1]).join(', ')}. You can take the test anyway if you already know the material.`)) : null,
  st.best ? h('p.muted.center', L(`Cel mai bun rezultat până acum: ${pct(st.best)}% (${st.tries} ${st.tries === 1 ? 'încercare' : 'încercări'})`, `Best result so far: ${pct(st.best)}% (${st.tries} ${st.tries === 1 ? 'attempt' : 'attempts'})`)) : null);
}

// ================= level exam =================
export function examView(main, levelId) {
  const lv = level(levelId);
  if (!lv || !lv.units.length) return main.append(empty('🤷', L('Examen indisponibil', 'Exam not available')));
  main.append(header(L(`🎓 Examenul ${lv.name}`, `🎓 ${lv.name} level exam`), lv.title, '#/learn'));
  const box = h('div');
  main.append(box);
  if (!levelUnlocked(lv)) return box.append(empty('🔒', L('Nivel blocat', 'Level locked'), L(`Treci întâi examenul ${S.levels[lv.index - 1].name} sau fă testul de nivel.`, `First pass the ${S.levels[lv.index - 1].name} level exam or take the placement test.`), [btn(L('Test de nivel', 'Placement test'), '#/placement', 'primary')]));
  const rev = reviewUnits(lv);
  if (rev.length) {
    return box.append(empty('📚', L('Întâi puțină recapitulare', 'A little review first'),
      L('La ultima încercare ai greșit întrebări din unitățile de mai jos. Treci din nou testul fiecăreia și examenul se deblochează.', 'On your last attempt you got questions wrong from the units below. Pass each unit test again and the exam unlocks.'),
      rev.map((u) => btn(L(`${u.emoji} Unitatea ${u.order}: ${u.title}`, `${u.emoji} Unit ${u.order}: ${u.title}`), `#/unit/${u.id}`, 'primary'))));
  }
  const e = S.p.exams[lv.id];
  const notPassed = lv.units.filter((u) => !unitState(u.id).passed).length;
  const start = () => {
    runSession(box, shuffle(buildExam(lv)), {
      mode: 'test', title: L(`Examen ${lv.name}`, `${lv.name} level exam`), onExit: () => go('#/learn'),
      onFinish: (res) => {
        res.forEach((r) => { if (!r.correct) addMistake(r.key); });
        const out = recordExam(lv, res);
        const nextLv = S.levels[lv.index + 1];
        if (out.passed) { confetti(3500); sfx('win'); }
        box.replaceChildren(resultCard({ score: out.score, passed: out.passed, passMark: PASS,
          title: out.passed ? L(`Felicitări! Ai trecut nivelul ${lv.name}! 🏆`, `Congratulations! You passed level ${lv.name}! 🏆`) : L('Încă nu ai trecut — dar acum știi exact ce să repeți', "Not passed yet — but now you know exactly what to review"),
          lines: [
            h('div.exam-units', lv.units.map((u) => { const b = out.byUnit[u.id] || { ok: 0, n: 0 }; return h('a.exam-unit' + (b.ok / b.n < 0.6 ? '.weak' : ''), { href: `#/unit/${u.id}` }, h('span', `${u.emoji} U${u.order}`), h('strong', `${b.ok}/${b.n}`)); })),
            out.passed ? (nextLv && nextLv.units.length ? L(`Nivelul **${nextLv.name}** este acum deblocat.`, `Level **${nextLv.name}** is now unlocked.`) : L('Ai terminat tot cursul!', "You've finished the whole course!"))
              : (out.weak.length ? L(`Te întorc în zona de învățare: recapitulează **${out.weak.length} ${out.weak.length === 1 ? 'unitate' : 'unități'}** (marcate cu roșu) și treci din nou testul lor. Apoi poți relua examenul.`, `Back to learning: review **${out.weak.length} ${out.weak.length === 1 ? 'unit' : 'units'}** (marked in red) and pass their tests again. Then you can retake the exam.`) : L('Ai fost aproape. Repetă greșelile și încearcă din nou.', 'You were close. Go over your mistakes and try again.')),
          ],
          actions: out.passed
            ? [nextLv && nextLv.units.length ? btn(L(`Începe ${nextLv.name} →`, `Start ${nextLv.name} →`), `#/unit/${nextLv.units[0].id}`, 'primary big') : btn(L('Acasă', 'Home'), '#/', 'primary big'), btn(L('📝 Simulări Cambridge', '📝 Cambridge practice tests'), '#/cambridge')]
            : [out.weak.length ? btn(L(`Recapitulează unitatea ${out.weak[0].order} →`, `Review Unit ${out.weak[0].order} →`), `#/unit/${out.weak[0].id}`, 'primary big') : h('button.btn.primary.big', { onclick: () => { box.replaceChildren(); start(); } }, L('🔁 Încearcă din nou', '🔁 Try again')),
              btn(L('🩹 Greșelile mele', '🩹 My mistakes'), '#/mistakes')] }));
      },
    });
  };
  box.append(empty('🎓', L(`Examen final ${lv.name}`, `${lv.name} level exam`),
    L(`${lv.units.length * 3} de întrebări din toate unitățile (câte 3 din fiecare). Ai nevoie de minimum ${pct(PASS)}%. Dacă nu treci, îți arăt exact ce unități trebuie recapitulate.`, `${lv.units.length * 3} questions from all units (3 from each). You need at least ${pct(PASS)}%. If you don't pass, I'll show you exactly which units to review.`),
    [h('button.btn.primary.big', { onclick: () => { box.replaceChildren(); start(); } }, levelPassed(lv) ? L('🔁 Dă examenul din nou', '🔁 Take the exam again') : L('▶ Începe examenul', '▶ Start the exam'))]),
  notPassed && !levelPassed(lv) ? h('div.alert.warn', L(`Mai ai ${notPassed} ${notPassed === 1 ? 'unitate netrecută' : 'unități netrecute'} la acest nivel. Poți da examenul oricum, dacă știi deja materia — dacă îl treci, sari direct la nivelul următor.`, `You still have ${notPassed} ${notPassed === 1 ? 'unit' : 'units'} not passed at this level. You can take the exam anyway if you already know the material — if you pass, you jump straight to the next level.`)) : null,
  e ? h('p.muted.center', L(`Cel mai bun rezultat: ${pct(e.best)}% · ${e.tries} ${e.tries === 1 ? 'încercare' : 'încercări'}`, `Best result: ${pct(e.best)}% · ${e.tries} ${e.tries === 1 ? 'attempt' : 'attempts'}`)) : null);
}

// ================= placement test =================
export function placementView(main) {
  main.append(header(L('🧭 Test de nivel', '🧭 Placement test'), L('Află de unde să pornești', 'Find out where to start'), '#/'));
  const box = h('div');
  main.append(box);
  const lvls = S.levels.filter((l) => l.placement.length);
  if (!lvls.length) return box.append(empty('⏳', L('Testul nu este încă disponibil', 'The test is not available yet'), L('Întrebările se încarcă. Reîncarcă pagina peste puțin timp.', 'The questions are loading. Reload the page in a moment.')));
  const scores = {};
  const runLevel = (i) => {
    const lv = lvls[i];
    runSession(box, lv.placement.map((ex) => ({ ex })), {
      mode: 'test', title: L(`Partea ${i + 1} din maximum ${lvls.length} · întrebări de nivel ${lv.name}`, `Part ${i + 1} of up to ${lvls.length} · ${lv.name} level questions`), onExit: () => go('#/'),
      onFinish: (res) => {
        scores[lv.id] = res.filter((r) => r.correct).length / res.length;
        if (scores[lv.id] >= PLACEMENT_PASS && lvls[i + 1]) {
          box.replaceChildren(empty('💪', L(`Foarte bine: ${pct(scores[lv.id])}% la ${lv.name}!`, `Very good: ${pct(scores[lv.id])}% at ${lv.name}!`), L(`Trecem la întrebări mai grele, de nivel ${lvls[i + 1].name}.`, `On to harder questions, at ${lvls[i + 1].name} level.`),
            [h('button.btn.primary.big', { onclick: () => { box.replaceChildren(); runLevel(i + 1); } }, L('Continuă →', 'Continue →'))]));
        } else finish();
      },
    });
  };
  const finish = () => {
    const start = recordPlacement(scores);
    const lv = S.levels[start];
    const all = scores[lv.id] >= PLACEMENT_PASS; // passed even the last level
    confetti(1800); sfx('win');
    box.replaceChildren(h('div.result.fade-in',
      h('div.big-level', { style: `--c:${lv.color}` }, lv.name),
      h('h2', all ? L(`Wow — stăpânești deja ${lv.name}!`, `Wow — you've already mastered ${lv.name}!`) : L(`Nivelul tău de pornire: ${lv.name} · ${lv.title}`, `Your starting level: ${lv.name} · ${lv.title}`)),
      h('p.muted', all ? L('Poți folosi cursul ca recapitulare și simulările Cambridge pentru pregătire.', 'You can use the course for review and the Cambridge practice tests to prepare.') : start > 0 ? L(`Nivelurile de dinainte sunt deblocate (le poți parcurge oricând ca recapitulare). Începem cu ${lv.name}.`, `The earlier levels are unlocked (you can go through them anytime to review). We start with ${lv.name}.`) : L('Perfect — începem cu bazele și construim pas cu pas.', "Perfect — we'll start with the basics and build up step by step.")),
      h('div.place-scores', lvls.map((l) => l.id in scores ? h('div.place-row', h('strong', l.name), bar(scores[l.id], l.color), h('span', pct(scores[l.id]) + '%')) : h('div.place-row.muted', h('strong', l.name), h('span', L('— netestat (întrebările de dinainte au fost prea grele)', '— not tested (the earlier questions were too hard)'))))),
      h('div.row.center.wrap', lv.units.length ? btn(L(`▶ Începe ${lv.name}`, `▶ Start ${lv.name}`), `#/unit/${lv.units[0].id}`, 'primary big start') : null, btn(L('Vezi toate lecțiile', 'See all lessons'), '#/learn'))));
  };
  box.append(empty('🧭', L('Cât de bine știi engleză acum?', 'How good is your English right now?'),
    L(`Testul are până la ${lvls.length} părți a câte 12 întrebări (${lvls.map((l) => l.name).join(' → ')}). Dacă o parte e prea grea, testul se oprește acolo — durează 5–15 minute. Răspunde fără dicționar; dacă nu știi, alege ce ți se pare cel mai potrivit.`, `The test has up to ${lvls.length} parts of 12 questions each (${lvls.map((l) => l.name).join(' → ')}). If a part is too hard, the test stops there — it takes 5–15 minutes. Answer without a dictionary; if you don't know, pick what seems most likely.`),
    [h('button.btn.primary.big', { onclick: () => { box.replaceChildren(); runLevel(0); } }, L('▶ Începe testul', '▶ Start the test'))]),
  S.p.placement ? h('p.muted.center', L(`Ultimul rezultat: nivel de pornire ${S.levels[S.p.placement.start].name} (${S.p.placement.date}). Dacă refaci testul, rezultatul nou îl înlocuiește.`, `Last result: starting level ${S.levels[S.p.placement.start].name} (${S.p.placement.date}). If you retake the test, the new result replaces it.`)) : null);
}

// ================= mistakes =================
export function mistakesView(main) {
  main.append(header(L('🩹 Greșelile mele', '🩹 My mistakes'), L('Întrebările la care ai greșit se strâng aici. Când răspunzi corect, dispar.', 'Questions you got wrong collect here. When you answer them correctly, they disappear.'), '#/'));
  const box = h('div');
  main.append(box);
  const draw = () => {
    const items = mistakeItems();
    if (!items.length) return box.replaceChildren(empty('🎉', L('Nicio greșeală de repetat', 'No mistakes to review'), L('Când greșești la exerciții sau la teste, întrebările apar aici ca să le exersezi.', 'When you make mistakes in exercises or tests, the questions show up here so you can practise them.'), [btn(L('Înapoi la lecții', 'Back to lessons'), '#/learn', 'primary')]));
    const byUnit = {};
    items.forEach((it) => { byUnit[it.unit] = (byUnit[it.unit] || 0) + 1; });
    box.replaceChildren(empty('🩹', L(`${items.length} ${items.length === 1 ? 'întrebare' : 'întrebări'} de repetat`, `${items.length} ${items.length === 1 ? 'question' : 'questions'} to review`), L('Exersăm câte maximum 15 odată, cu explicații.', 'We practise up to 15 at a time, with explanations.'),
      [h('button.btn.primary.big', { onclick: () => {
        runSession(box, sample(items, Math.min(15, items.length)), {
          mode: 'practice', title: L('Repetăm greșelile', 'Reviewing your mistakes'), onExit: draw,
          onFinish: (res) => {
            const ok = res.filter((r) => r.correct);
            ok.forEach((r) => clearMistake(r.key));
            addXp(ok.length * 2); save();
            box.replaceChildren(resultCard({ score: ok.length / res.length, title: L(`${ok.length} ${ok.length === 1 ? 'greșeală reparată' : 'greșeli reparate'} ✓`, `${ok.length} ${ok.length === 1 ? 'mistake fixed' : 'mistakes fixed'} ✓`),
              lines: [L(`+${ok.length * 2} XP ⚡ · Au mai rămas ${mistakeItems().length}.`, `+${ok.length * 2} XP ⚡ · ${mistakeItems().length} left.`)],
              actions: [h('button.btn.primary.big', { onclick: draw }, L('Continuă', 'Continue')), btn(L('Acasă', 'Home'), '#/')] }));
          },
        });
      } }, L('▶ Exersează', '▶ Practise'))]),
    h('div.card', h('h3', L('Unde greșești cel mai des', 'Where you make the most mistakes')),
      h('div.mist-list', Object.entries(byUnit).sort((a, b) => b[1] - a[1]).map(([uid, n]) => {
        const u = S.unitById[uid];
        return h('a.mist-row', { href: `#/unit/${uid}` }, h('span', `${u.emoji} ${u.level} · U${u.order} · ${u.grammar.titleRo}`), chip(`${n}`, 'warn'));
      }))));
  };
  draw();
}
