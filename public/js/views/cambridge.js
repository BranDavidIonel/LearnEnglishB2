// Cambridge mock exams (B1 Preliminary / B2 First): papers, self-assessment, readiness.
import { h, md, gap, speak, speakScript, stopSpeak, speakBtn, checkText, picture, confetti, sfx, toast, recorder, canRecord } from '../util.js';
import { S, save, camState, recordCam, camReadiness, CAM_TARGET, PAPERS } from '../store.js';
import { header, btn, bar, chip, ring, empty, pct, go } from '../ui.js';
import { L, plural } from '../i18n.js';

/** The tests are titled 'Simulare N' in the data; show 'Mock test N' in the English interface. */
const testTitle = (t) => L(t.title, t.title.replace(/^Simulare/, 'Mock test'));
const PAPER_INFO = {
  reading: ['📖', 'Reading'], listening: ['🎧', 'Listening'], writing: ['✍️', 'Writing'], speaking: ['🗣️', 'Speaking'],
};
const paperName = (exam, p) => (exam.id === 'fce' && p === 'reading' ? 'Reading & Use of English' : PAPER_INFO[p][1]);
const VERDICT = {
  ready: [L('✅ Ești pregătit', '✅ Ready'), 'ok', L('Rezultatele tale la simulări sunt peste ținta de siguranță. Te poți înscrie la examen.', 'Your mock test results are above the safe target. You can sign up for the exam.')],
  close: [L('🟡 Aproape pregătit', '🟡 Almost ready'), 'warn', L('Ești în zona de trecere, dar fără rezervă. Lucrează la probele cu scor mai mic și fă toate cele 4 probe.', "You're in the pass zone, but with no margin. Work on your weaker papers and do all 4 papers.")],
  notyet: [L('🔴 Încă nu', '🔴 Not yet'), 'bad', L('Deocamdată scorurile sunt sub pragul de trecere. Continuă cursul și revino la simulări.', 'For now your scores are below the pass mark. Keep going with the course and come back to the mock tests.')],
  unknown: [L('❔ Necunoscut', '❔ Unknown'), 'lock', L('Fă cel puțin probele de Reading și Listening dintr-o simulare ca să afli unde te situezi.', 'Do at least the Reading and Listening papers of a mock test to find out where you stand.')],
};

export function view(main, examId, testId, paper) {
  const exams = S.cambridge || [];
  if (!examId) return list(main, exams);
  const exam = exams.find((e) => e.id === examId);
  if (!exam) return main.append(empty('🤷', L('Examen indisponibil', 'Exam not available'), '', [btn(L('Înapoi', 'Back'), '#/cambridge', 'primary')]));
  if (!testId) return examPage(main, exam);
  const test = exam.tests.find((t) => t.id === testId);
  if (!test || !PAPERS.includes(paper)) return go(`#/cambridge/${exam.id}`);
  if (paper === 'writing') return writing(main, exam, test);
  if (paper === 'speaking') return speaking(main, exam, test);
  return paperRunner(main, exam, test, paper);
}

function readinessCard(exam) {
  const r = camReadiness(exam);
  const [label, cls, text] = VERDICT[r.verdict];
  return h('div.card.ready.' + cls,
    h('div.row.wrap.gap-lg',
      ring(r.overall ?? 0, r.verdict === 'ready' ? '#22c55e' : r.verdict === 'close' ? '#facc15' : r.verdict === 'notyet' ? '#ef4444' : '#64748b', r.overall === null ? '?' : pct(r.overall) + '%', 96),
      h('div.grow', h('div.muted', L(`Sunt pregătit pentru ${exam.name}?`, `Am I ready for ${exam.name}?`)), h('h2', label), h('p', text))),
    h('div.ready-grid', PAPERS.map((p) => {
      const x = r.latest[p];
      return h('div.ready-paper', h('div.row.between', h('span', PAPER_INFO[p][0], ' ', paperName(exam, p)), h('strong', x ? pct(x.score) + '%' : '—')),
        h('div.bar.target', { style: `--t:${CAM_TARGET * 100}%` }, h('div.bar-fill', { style: `width:${x ? pct(x.score) : 0}%;background:${!x ? '#64748b' : x.score >= CAM_TARGET ? '#22c55e' : x.score >= 0.6 ? '#facc15' : '#ef4444'}` })),
        h('small.muted', x ? (p === 'writing' || p === 'speaking' ? L('autoevaluare · ', 'self-assessment · ') : '') + x.date : L('nefăcut încă', 'not done yet')));
    })),
    h('div.to-goal', h('div.row.between', h('span', L(`Cursul până la nivelul ${exam.level} inclusiv`, `Course up to and including ${exam.level}`)), h('strong', pct(r.course) + '%')), bar(r.course)),
    h('p.muted.small', L(`Ținta de siguranță este ${pct(CAM_TARGET)}% la fiecare probă (linia verticală). La examenul real se trece cu aproximativ 60–65%, dar emoțiile și vocile reale scad de obicei scorul. Writing și Speaking sunt autoevaluări, deci orientative.`, `The safe target is ${pct(CAM_TARGET)}% on each paper (the vertical line). The real exam's pass mark is about 60–65%, but nerves and real voices usually lower your score. Writing and Speaking are self-assessments, so treat them as a rough guide.`)));
}

function list(main, exams) {
  main.append(header(L('📝 Examene Cambridge', '📝 Cambridge exams'), L('Simulări în formatul real al examenelor, ca să știi dacă ești pregătit înainte să te înscrii.', 'Mock tests in the real exam format, so you know if you are ready before you sign up.'), '#/'));
  if (!exams.length) return main.append(empty('⏳', L('Simulările sunt în pregătire', 'Mock tests are on the way'), L('Testele PET (B1) și FCE (B2) vor apărea aici imediat ce sunt gata. Reîncarcă pagina mai târziu.', 'The PET (B1) and FCE (B2) tests will appear here as soon as they are ready. Reload the page later.')));
  for (const exam of exams) {
    const r = camReadiness(exam);
    const [label, cls] = VERDICT[r.verdict];
    main.append(h('a.card.exam-card', { href: `#/cambridge/${exam.id}` },
      ring(r.overall ?? 0, '#a78bfa', exam.level, 84),
      h('div.grow', h('h2', exam.name), h('p.muted', `${exam.tests.length} ${exam.tests.length === 1 ? L('simulare completă', 'full mock test') : L('simulări complete', 'full mock tests')} · Reading, Listening, Writing, Speaking`), chip(label, cls)),
      h('span.btn.primary', L('Deschide →', 'Open →'))));
  }
  main.append(h('div.card', h('h3', L('ℹ️ Cum folosești simulările', 'ℹ️ How to use the mock tests')),
    h('ul',
      h('li', L('Fă-le abia când ai terminat (sau aproape) nivelul respectiv din curs: PET după B1, FCE după B2.', "Only take them once you've finished (or nearly finished) that level of the course: PET after B1, FCE after B2.")),
      h('li', L('Respectă timpul afișat și nu folosi dicționarul — ca la examen.', "Stick to the time shown and don't use a dictionary — just like in the exam.")),
      h('li', L('Reading și Listening se corectează automat. La Writing și Speaking compari cu un răspuns-model și te autoevaluezi.', 'Reading and Listening are marked automatically. For Writing and Speaking you compare with a model answer and do a self-assessment.')),
      h('li', L('Înregistrările de la Listening sunt citite de vocea calculatorului. La examenul real vocile sunt naturale și mai rapide, așa că exersează și cu videourile din aplicație.', 'The Listening recordings are read by the computer voice. In the real exam the voices are natural and faster, so practise with the videos in the app too.')))));
}

function examPage(main, exam) {
  main.append(header(`📝 ${exam.name}`, L(`Nivel ${exam.level}`, `Level ${exam.level}`), '#/cambridge'), readinessCard(exam));
  for (const t of exam.tests) {
    const st = camState(exam.id, t.id);
    main.append(h('div.card', h('h3', testTitle(t)),
      h('div.paper-grid', PAPERS.map((p) => {
        const r = st[p];
        const n = p === 'reading' || p === 'listening' ? t[p].parts.reduce((a, x) => a + x.questions.length, 0) + L(' întrebări', ' questions') : t[p].tasks.length + L(' sarcini', ' tasks');
        return h('a.paper', { href: `#/cambridge/${exam.id}/${t.id}/${p}` },
          h('div.paper-icon', PAPER_INFO[p][0]), h('strong', paperName(exam, p)), h('small.muted', `${t[p].minutes} min · ${n}`),
          r ? chip(`${pct(r.score)}% · ${r.date}`, r.score >= CAM_TARGET ? 'ok' : r.score >= 0.6 ? 'warn' : 'bad') : chip(L('Neînceput', 'Not started'), 'lock'));
      }))));
  }
  main.append(h('div.card', h('h3', L('Despre examenul real', 'About the real exam')), h('p', { html: md(exam.aboutRo) }),
    h('div.gram-list', (exam.papersRo || []).map((p) => h('div.gram-row', h('strong', p.name), h('span.grow.muted', p.info))))));
}

// ---------- countdown ----------
function countdown(minutes) {
  let left = minutes * 60, warned = false;
  const el = h('div.timer', '');
  const draw = () => {
    const a = Math.abs(left);
    el.textContent = `${left < 0 ? '+' : ''}${Math.floor(a / 60)}:${String(a % 60).padStart(2, '0')}`;
    el.classList.toggle('low', left <= 300 && left > 0); el.classList.toggle('over', left <= 0);
  };
  draw();
  const id = setInterval(() => {
    left--; draw();
    if (left <= 0 && !warned) { warned = true; toast(L('⏰ Timpul a expirat! La examenul real ai fi predat acum. Poți continua, dar notează-ți asta.', "⏰ Time's up! In the real exam you would hand in now. You can carry on, but make a note of it."), 'warn'); }
  }, 1000);
  return { el, stop: () => clearInterval(id) };
}

// ---------- Reading / Listening ----------
function paperRunner(main, exam, test, paper) {
  const data = test[paper];
  const listening = paper === 'listening';
  const answers = {};
  let partIdx = 0, review = false, result = null;
  const numbers = {}; // global question numbers
  let n = 0;
  data.parts.forEach((p, pi) => p.questions.forEach((_, qi) => { numbers[`${pi}:${qi}`] = ++n; }));
  const total = n;
  const clock = countdown(data.minutes);
  const tabs = h('div.tabs');
  const body = h('div.paper-body');
  const top = h('div.paper-top');
  const backHash = `#/cambridge/${exam.id}`;

  const isRight = (q, v) => (q.type === 'mc' ? v === q.answer : (v !== undefined && checkText(v, q.answers).ok));

  function audioBtn(script, label) {
    let plays = 0;
    const b = h('button.btn.audio', { onclick: () => {
      if (b.classList.contains('playing')) { stopSpeak(); b.classList.remove('playing'); draw(); return; }
      document.querySelectorAll('.btn.audio.playing').forEach((x) => x.classList.remove('playing'));
      plays++; b.classList.add('playing'); draw();
      speakScript(script, () => { b.classList.remove('playing'); draw(); });
    } });
    const draw = () => { b.textContent = b.classList.contains('playing') ? L('⏹ Oprește', '⏹ Stop') : L(`▶ ${label} (ascultări: ${plays}/2)`, `▶ ${label} (plays: ${plays}/2)`); b.classList.toggle('muted-btn', plays >= 2 && !b.classList.contains('playing')); };
    draw();
    return b;
  }

  function question(q, pi, qi) {
    const key = `${pi}:${qi}`;
    const val = answers[key];
    const wrap = h('div.cq');
    if (review) wrap.classList.add(isRight(q, val) ? 'right' : 'wrong');
    const qText = q.q.replace(/^\s*\*{0,2}\(?\d+\)?\*{0,2}\s*/, '');
    wrap.append(h('div.cq-n', numbers[key]));
    const inner = h('div.grow');
    wrap.append(inner);
    if (q.text) inner.append(h('div.cq-text', { html: md(q.text) }));
    if (q.audio) inner.append(review ? scriptBox(q.audio) : audioBtn(q.audio, L('Ascultă', 'Listen')));
    if (q.type === 'mc') {
      if (qText) inner.append(h('div.cq-q', { html: gap(qText) }));
      // options that already carry their own letter ("A", "B The rest is…") are shown as written
      const lettered = q.options.every((o, oi) => new RegExp(`^${String.fromCharCode(65 + oi)}([\\s.):]|$)`).test(o.trim()));
      inner.append(h('div.cq-opts', q.options.map((o, oi) => {
        const letter = lettered ? '' : String.fromCharCode(65 + oi);
        return h('button.cq-opt' + (val === oi ? '.sel' : '') + (review && oi === q.answer ? '.right' : '') + (review && val === oi && oi !== q.answer ? '.wrong' : ''), {
          disabled: review, onclick: (e) => {
            answers[key] = oi;
            e.currentTarget.parentNode.querySelectorAll('.cq-opt').forEach((x) => x.classList.remove('sel'));
            e.currentTarget.classList.add('sel'); drawTabs();
          } }, letter ? h('b', letter) : null, h('span', { html: md(o) }));
      })));
    } else {
      const [before, after] = (qText || q.q).split(/_{3,}/);
      const input = h('input.gap-input.wide', { type: 'text', value: val || '', disabled: review, autocomplete: 'off', spellcheck: 'false', autocapitalize: 'off',
        oninput: (e) => { const v = e.target.value.trim(); if (v) answers[key] = v; else delete answers[key]; drawTabs(); } });
      if (review) input.classList.add(isRight(q, val) ? 'right' : 'wrong');
      inner.append(h('div.cq-q.fill-q', h('span', { html: md(before || '') }), input, h('span', { html: md(after || '') })));
      if (review && !isRight(q, val)) inner.append(h('div.fb-answer', L('Corect: ', 'Correct: '), h('strong', q.answers.join(' / '))));
    }
    if (review) inner.append(h('div.fb-explain', { html: '💡 ' + md(q.explainRo) }));
    return wrap;
  }
  const scriptBox = (script) => h('details.script', h('summary', L('📜 Vezi textul înregistrării', '📜 Show the recording script')), script.map((l) => h('p', h('b', l.s + ': '), l.en)),
    h('button.btn', { onclick: () => speakScript(script) }, L('▶ Ascultă din nou', '▶ Listen again')));

  function drawTabs() {
    tabs.replaceChildren(...data.parts.map((p, pi) => {
      const done = p.questions.filter((_, qi) => answers[`${pi}:${qi}`] !== undefined).length;
      const okN = review ? p.questions.filter((q, qi) => isRight(q, answers[`${pi}:${qi}`])).length : 0;
      return h('button.tab' + (pi === partIdx ? '.on' : ''), { onclick: () => { stopSpeak(); partIdx = pi; draw(); } }, p.title.replace(/\s*[—–-].*$/, ''), ' ',
        h('small', review ? `${okN}/${p.questions.length}` : `${done}/${p.questions.length}`));
    }));
  }
  function draw() {
    drawTabs();
    const p = data.parts[partIdx];
    const qs = h('div.cqs', p.questions.map((q, qi) => question(q, partIdx, qi)));
    const side = h('div.paper-side');
    if (p.text) side.append(h('div.card.passage', { html: md(p.text) }));
    if (p.audio) side.append(h('div.card', review ? scriptBox(p.audio) : [audioBtn(p.audio, L('Ascultă înregistrarea', 'Listen to the recording')), h('p.muted.small', L('La examen auzi fiecare înregistrare de două ori. Citește întâi întrebările!', 'In the exam you hear each recording twice. Read the questions first!'))]));
    body.replaceChildren(
      h('div.card.instr', h('strong', p.title), h('p', p.instructionsRo)),
      h('div.paper-cols' + (side.childNodes.length ? '' : '.single'), side.childNodes.length ? side : null, qs),
      h('div.row.between.mt',
        partIdx > 0 ? h('button.btn', { onclick: () => { stopSpeak(); partIdx--; draw(); scrollTo(0, 0); } }, L('← Partea anterioară', '← Previous part')) : h('span'),
        partIdx < data.parts.length - 1 ? h('button.btn.primary', { onclick: () => { stopSpeak(); partIdx++; draw(); scrollTo(0, 0); } }, L('Partea următoare →', 'Next part →'))
          : review ? btn(L('Înapoi la examen', 'Back to the exam'), backHash, 'primary') : h('button.btn.success.big', { onclick: submit }, L('✔ Predă lucrarea', '✔ Hand in'))));
  }
  function submit() {
    const answered = Object.keys(answers).length;
    if (answered < total && !confirm(L(`Ai răspuns la ${answered} din ${total} întrebări. Predai oricum?`, `You answered ${answered} of ${total} questions. Hand in anyway?`))) return;
    clock.stop(); stopSpeak();
    let ok = 0;
    const parts = data.parts.map((p, pi) => { const c = p.questions.filter((q, qi) => isRight(q, answers[`${pi}:${qi}`])).length; ok += c; return c; });
    result = { score: ok / total, correct: ok, total, parts };
    recordCam(exam.id, test.id, paper, result);
    review = true; partIdx = 0;
    if (result.score >= CAM_TARGET) { confetti(); sfx('win'); }
    drawTop(); draw(); scrollTo(0, 0);
  }
  function drawTop() {
    top.replaceChildren(
      h('a.back', { href: backHash, onclick: (e) => { if (!review && Object.keys(answers).length && !confirm(L('Ieși din probă? Răspunsurile se pierd.', 'Leave this paper? Your answers will be lost.'))) e.preventDefault(); } }, `← ${exam.name}`),
      h('div.row.between.wrap', h('h1', `${PAPER_INFO[paper][0]} ${paperName(exam, paper)} · ${testTitle(test)}`), review ? null : clock.el),
      review ? h('div.card.ready.' + (result.score >= CAM_TARGET ? 'ok' : result.score >= 0.6 ? 'warn' : 'bad'),
        h('div.row.wrap.gap-lg', ring(result.score, result.score >= CAM_TARGET ? '#22c55e' : result.score >= 0.6 ? '#facc15' : '#ef4444', pct(result.score) + '%', 88),
          h('div.grow', h('h2', L(`${result.correct} din ${result.total} corecte`, `${result.correct} of ${result.total} correct`)),
            h('p', result.score >= CAM_TARGET ? L('Peste ținta de siguranță (70%). Foarte bine!', 'Above the safe target (70%). Well done!') : result.score >= 0.6 ? L('În zona de trecere, dar fără rezervă. Uită-te la explicații mai jos.', 'In the pass zone, but with no margin. Look at the explanations below.') : L('Sub pragul de trecere deocamdată. Parcurge explicațiile de mai jos — din ele înveți cel mai mult.', "Below the pass mark for now. Go through the explanations below — that's where you learn the most."))))) : null,
      tabs);
  }
  main.append(top, body);
  drawTop(); draw();
  return () => { clock.stop(); stopSpeak(); };
}

// ---------- Writing ----------
function phrases(list) {
  return list && list.length ? h('details.script', h('summary', L('💬 Expresii utile', '💬 Useful phrases')), list.map((p) => h('div.example', speakBtn(p.en), h('div', h('div.en', p.en), h('div.ro', p.ro))))) : null;
}

function writing(main, exam, test) {
  const data = test.writing;
  const st = camState(exam.id, test.id);
  const drafts = st.drafts || (st.drafts = {});
  const checks = {}; // task index -> Set of ticked items (after reveal)
  const revealed = {};
  let idx = 0;
  const clock = countdown(data.minutes);
  const tabs = h('div.tabs'), body = h('div');
  const words = (s) => (s.trim() ? s.trim().split(/\s+/).length : 0);
  let saveT;

  function draw() {
    tabs.replaceChildren(...data.tasks.map((t, i) => h('button.tab' + (i === idx ? '.on' : ''), { onclick: () => { idx = i; draw(); } }, t.title, revealed[i] ? ' ✓' : '')));
    const t = data.tasks[idx];
    const count = h('span.wc');
    const ta = h('textarea.write-area', { rows: 12, spellcheck: 'false', placeholder: L('Scrie aici răspunsul tău în engleză…', 'Write your answer in English here…'), disabled: !!revealed[idx] });
    ta.value = drafts[idx] || '';
    const upd = () => { const w = words(ta.value); count.textContent = L(`${w} cuvinte (țintă: ${t.minWords}–${t.maxWords})`, `${w} ${plural(w, 'word', 'words')} (goal: ${t.minWords}–${t.maxWords})`); count.className = 'wc ' + (w >= t.minWords && w <= t.maxWords ? 'ok' : w > t.maxWords ? 'bad' : ''); };
    ta.addEventListener('input', () => { drafts[idx] = ta.value; upd(); clearTimeout(saveT); saveT = setTimeout(save, 1500); });
    upd();
    const after = h('div');
    const i = idx;
    const fillAfter = () => {
      checks[i] = checks[i] || new Set();
      after.replaceChildren(
        h('div.card', h('h3', L('✅ Verifică-ți textul (bifează ce ai făcut cu adevărat)', '✅ Check your text (tick what you really did)')),
          t.checklistRo.map((c, ci) => h('label.check.block', h('input', { type: 'checkbox', checked: checks[i].has(ci), onchange: (e) => { if (e.target.checked) checks[i].add(ci); else checks[i].delete(ci); drawSave(); } }), ' ', c))),
        h('div.card', h('h3', L('⭐ Răspuns-model', '⭐ Model answer')), h('p.model', { html: md(t.model) }), h('button.btn', { onclick: () => speak(t.model) }, L('🔊 Ascultă modelul', '🔊 Listen to the model'))));
    };
    const doneBtn = h('button.btn.primary', { onclick: () => {
      if (words(ta.value) < 20) return toast(L('Scrie întâi textul tău (măcar câteva propoziții).', 'Write your text first (at least a few sentences).'), 'warn');
      revealed[i] = true; ta.disabled = true; doneBtn.remove(); fillAfter(); drawSave();
    } }, L('Am terminat — compară cu modelul', "I'm done — compare with the model"));
    body.replaceChildren(
      h('div.card.instr', h('strong', t.title), h('p', t.taskRo)),
      h('div.card.passage', { html: md(t.task) }),
      phrases(t.usefulPhrases),
      ta, h('div.row.between.wrap', count, revealed[i] ? null : doneBtn),
      after);
    if (revealed[i]) fillAfter();
  }
  const saveBox = h('div');
  function drawSave() {
    const doneIdx = Object.keys(revealed).map(Number);
    if (!doneIdx.length) return saveBox.replaceChildren();
    const score = doneIdx.reduce((a, i) => a + checks[i].size / data.tasks[i].checklistRo.length, 0) / doneIdx.length;
    saveBox.replaceChildren(h('div.card.ready.' + (score >= CAM_TARGET ? 'ok' : 'warn'),
      h('div.row.between.wrap', h('div', h('strong', L(`Autoevaluare: ${pct(score)}%`, `Self-assessment: ${pct(score)}%`)), h('div.muted.small', `${doneIdx.length} ${doneIdx.length === 1 ? L('sarcină făcută', 'task done') : L('sarcini făcute', 'tasks done')}${L(' · la examenul real faci 2', ' · in the real exam you do 2')}`)),
        h('button.btn.success', { disabled: doneIdx.length < 2, onclick: () => { clock.stop(); recordCam(exam.id, test.id, 'writing', { score }); toast(L('Rezultat salvat ✓', 'Result saved ✓')); go(`#/cambridge/${exam.id}`); } }, doneIdx.length < 2 ? L('Fă 2 sarcini ca să salvezi', 'Do 2 tasks to save') : L('Salvează rezultatul', 'Save result')))));
  }
  main.append(h('a.back', { href: `#/cambridge/${exam.id}` }, `← ${exam.name}`),
    h('div.row.between.wrap', h('h1', `✍️ Writing · ${testTitle(test)}`), clock.el),
    h('p.muted', L('Aplicația nu poate corecta automat un text liber. Scrie textul, apoi compară-l sincer cu lista de verificare și cu răspunsul-model.', "The app can't mark free writing automatically. Write your text, then compare it honestly with the checklist and the model answer.")),
    tabs, body, saveBox);
  draw();
  return () => { clock.stop(); stopSpeak(); save(); };
}

// ---------- Speaking ----------
function speaking(main, exam, test) {
  const data = test.speaking;
  const stars = {};
  let idx = 0, rec = null;
  const tabs = h('div.tabs'), body = h('div'), saveBox = h('div');
  function draw() {
    if (rec) rec.stop();
    tabs.replaceChildren(...data.tasks.map((t, i) => h('button.tab' + (i === idx ? '.on' : ''), { onclick: () => { idx = i; draw(); } }, t.title, stars[i] ? ' ✓' : '')));
    const t = data.tasks[idx];
    rec = canRecord() ? recorder() : null;
    const rate = h('div.stars', [1, 2, 3, 4, 5].map((s) => h('button.star' + ((stars[idx] || 0) >= s ? '.on' : ''), { onclick: () => { stars[idx] = s; draw(); drawSave(); } }, '★')));
    body.replaceChildren(
      h('div.card.instr', h('strong', t.title), h('p', t.infoRo)),
      t.wiki || t.sceneRo ? h('div.card', t.wiki ? picture({ emoji: '🖼️', wiki: t.wiki, en: t.wiki }, 'photo') : null, t.sceneRo ? h('p.muted', '🖼️ ', t.sceneRo) : null) : null,
      h('div.card', h('h3', L('🧑‍🏫 Examinatorul spune:', '🧑‍🏫 The examiner says:')), t.prompts.map((p) => h('div.example', speakBtn(p), h('div.en', p)))),
      phrases(t.usefulPhrases),
      h('div.card', h('h3', L('🎙 Răspunsul tău', '🎙 Your answer')), h('p.muted', L('Răspunde cu voce tare, ca la examen. Înregistrează-te și ascultă-te apoi — e cea mai bună metodă de a-ți auzi greșelile.', 'Answer out loud, as in the exam. Record yourself and then listen back — it is the best way to hear your mistakes.')), rec ? rec.node : h('p.muted', L('Înregistrarea nu este disponibilă în acest browser; răspunde cu voce tare.', "Recording isn't available in this browser; answer out loud."))),
      h('details.script', h('summary', L('⭐ Vezi un răspuns-model', '⭐ Show a model answer')), h('p.model', { html: md(t.model) }), h('button.btn', { onclick: () => speak(t.model) }, L('🔊 Ascultă modelul', '🔊 Listen to the model'))),
      h('div.card', h('h3', L('Cum te-ai descurcat?', 'How did you do?')), h('p.muted.small', L('1 = m-am blocat · 3 = am răspuns, cu pauze și greșeli · 5 = fluent, la fel de bine ca modelul', '1 = I got stuck · 3 = I answered, with pauses and mistakes · 5 = fluent, as good as the model')), rate));
  }
  function drawSave() {
    const vals = Object.values(stars);
    if (!vals.length) return saveBox.replaceChildren();
    const score = vals.reduce((a, b) => a + b, 0) / (vals.length * 5);
    const all = vals.length === data.tasks.length;
    saveBox.replaceChildren(h('div.card.ready.' + (score >= CAM_TARGET ? 'ok' : 'warn'),
      h('div.row.between.wrap', h('strong', L(`Autoevaluare: ${pct(score)}% (${vals.length}/${data.tasks.length} părți)`, `Self-assessment: ${pct(score)}% (${vals.length}/${data.tasks.length} parts)`)),
        h('button.btn.success', { disabled: !all, onclick: () => { recordCam(exam.id, test.id, 'speaking', { score }); toast(L('Rezultat salvat ✓', 'Result saved ✓')); go(`#/cambridge/${exam.id}`); } }, all ? L('Salvează rezultatul', 'Save result') : L('Evaluează toate părțile', 'Rate all the parts')))));
  }
  main.append(h('a.back', { href: `#/cambridge/${exam.id}` }, `← ${exam.name}`), h('h1', `🗣️ Speaking · ${testTitle(test)}`),
    h('p.muted', L(`La examenul real proba durează ${data.minutes} minute și o dai împreună cu un alt candidat. Aici exersezi singur fiecare parte.`, `In the real exam this paper takes ${data.minutes} minutes and you take it with another candidate. Here you practise each part on your own.`)),
    tabs, body, saveBox);
  draw();
  return () => { if (rec) rec.stop(); stopSpeak(); };
}
