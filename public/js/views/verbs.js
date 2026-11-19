// Irregular verbs: the three forms (go – went – gone), learned 10 at a time by typing them, then reviewed
// with spaced repetition. Lives as a tab of the "My words" page (#/words/verbs).
import { h, md, speak, stopSpeak, speakBtn, sample, sfx, confetti, checkText, modal } from '../util.js';
import {
  S, save, addXp, wordCounts, verbAlts, verbAnswers, verbStatus, verbCounts, dueVerbs, gradeVerb, verbKnown, learnVerb, forgetVerb,
} from '../store.js';
import { header, bar, chip, levelChip, empty, grammarNode } from '../ui.js';
import { L, plural } from '../i18n.js';

const BATCH = 10;
const nVerbs = (n) => `${n} ${plural(n, L('verb', 'verb'), L('verbe', 'verbs'))}`;
const STATUS = {
  learned: [L('✅ Învățat', '✅ Learned'), 'ok'],
  learning: [L('🌱 În curs', '🌱 Learning'), 'now'],
  new: [L('🆕 De învățat', '🆕 To learn'), 'lock'],
};
const PATTERNS = {
  abc: [L('toate diferite', 'all different'), 'go – went – gone'],
  abb: [L('trecutul = participiul', 'past = participle'), 'buy – bought – bought'],
  aba: [L('prima = a treia', 'first = third'), 'come – came – come'],
  aaa: [L('toate trei la fel', 'all three the same'), 'cut – cut – cut'],
};
/** Which shape the three forms have — a big help for remembering them. */
export function pattern(v) {
  const a = v.v1, b = verbAlts(v.v2)[0], c = verbAlts(v.v3)[0];
  if (a === b && b === c) return 'aaa';
  if (b === c) return 'abb';
  if (a === c) return 'aba';
  return 'abc';
}
const forms = (v) => `${v.v1} – ${v.v2} – ${v.v3}`;
const sayForms = (v) => speak(`${v.v1}. ${verbAlts(v.v2).join(' or ')}. ${verbAlts(v.v3).join(' or ')}.`);
/** Bolds the verb form inside an example sentence. */
const mark = (text, form) => {
  let out = text;
  for (const alt of verbAlts(form)) out = out.replace(new RegExp(`\\b(${alt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\b`, 'i'), '**$1**');
  return md(out);
};
const patternChip = (v) => chip(`${PATTERNS[pattern(v)][0]} · ${PATTERNS[pattern(v)][1]}`, 'now');

/** The full explanation of the three forms, shown like a grammar lesson (explanations in Romanian, as in the course). */
const FORMS_HELP = { grammar: {
  title: 'The three forms of irregular verbs',
  titleRo: 'Cele trei forme ale verbelor neregulate: ce sunt și când le folosești',
  sections: [
    {
      headingRo: 'Ce sunt cele trei forme?',
      textRo: 'Orice verb englezesc are trei forme de bază. La verbele **regulate**, V2 și V3 se fac simplu, cu **-ed**: work – worked – worked. La cele **neregulate** sunt speciale și trebuie învățate pe de rost: **say – said – said**, **go – went – gone**. Atenție: **viitorul nu e o formă separată** — se face cu *will* + V1 (I will say).',
      table: { headers: ['Forma', 'Numele', 'say', 'go', 'write'], rows: [
        ['**V1**', 'forma de bază (base form / infinitive)', 'say', 'go', 'write'],
        ['**V2**', 'trecutul simplu (past simple)', 'said', 'went', 'wrote'],
        ['**V3**', 'participiul trecut (past participle)', 'said', 'gone', 'written'],
      ] },
      examples: [
        { en: 'I always say hello to the security guard.', ro: 'Mereu îl salut pe paznic. (V1)' },
        { en: 'She said yes to our offer yesterday.', ro: 'Ieri a spus da la oferta noastră. (V2)' },
        { en: 'I have said it many times: test before you deploy!', ro: 'Am spus-o de multe ori: testează înainte de deploy! (V3)' },
      ],
    },
    {
      headingRo: 'V1 — forma de bază: prezent, viitor și după did / can / to',
      textRo: 'V1 e forma din dicționar. O folosești la **prezent** (la he/she/it primește **-s**: she says, he goes), la **viitor** (will say), după **can / must / should**, după **to**, la **imperativ** și — foarte important — în **întrebările și negațiile la trecut, după did**: *Did you say…?*, *I didn\'t go*.',
      table: { headers: ['Structura', 'Exemplu'], rows: [
        ['I / you / we / they + **V1**', 'I **say** · they **go**'],
        ['he / she / it + **V1 + s**', 'she **says** · he **goes**'],
        ['will / going to + **V1**', 'I will **say** · we\'re going to **go**'],
        ['can / must / should + **V1**', 'you should **say** · we must **go**'],
        ['to + **V1**', 'I want to **say** something'],
        ['**did** + V1 (întrebare la trecut)', 'Did you **say** that? · Did he **go**?'],
        ['**didn\'t** + V1 (negație la trecut)', 'I didn\'t **say** that · she didn\'t **go**'],
      ] },
      examples: [
        { en: 'The client says the invoice is wrong.', ro: 'Clientul zice că factura e greșită.' },
        { en: 'We will go live on Monday.', ro: 'Lansăm luni.' },
        { en: 'Did the manager say anything about the deadline?', ro: 'A zis managerul ceva despre termen?' },
      ],
    },
    {
      headingRo: 'V2 — trecutul simplu (past simple)',
      textRo: 'Pentru o acțiune **terminată**, într-un moment clar din trecut: *yesterday, last week, in 2020, two days ago, when I was a child*. V2 apare **doar în propoziții afirmative**. În întrebări și negații revii la **V1**, pentru că *did* poartă deja timpul trecut.',
      table: { headers: ['Tip de propoziție', 'Corect', 'Greșit'], rows: [
        ['Afirmativă', 'I **said** · we **went**', '—'],
        ['Întrebare', 'Did you **say**? · Did you **go**?', 'Did you said? · Did you went?'],
        ['Negativă', 'I didn\'t **say** · we didn\'t **go**', 'I didn\'t said · we didn\'t went'],
      ] },
      examples: [
        { en: 'The client said yes last Friday.', ro: 'Clientul a zis da vinerea trecută.' },
        { en: 'We went to Rome two years ago.', ro: 'Am fost la Roma acum doi ani.' },
        { en: 'I wrote the first version in one night.', ro: 'Am scris prima versiune într-o singură noapte.' },
      ],
    },
    {
      headingRo: 'V3 — participiul trecut (past participle)',
      textRo: 'V3 **nu stă niciodată singur ca verb**: vine după **have / has / had** (timpurile perfecte) sau după **be** (pasivul). Poate fi și **adjectiv**: *a broken screen*, *a written offer*.',
      table: { headers: ['Structura', 'Când o folosești', 'Exemplu'], rows: [
        ['have / has + **V3**', 'prezentul perfect: experiență, rezultat care contează acum', 'I have **said** it twice · She has **gone** home'],
        ['had + **V3**', 'mai-mult-ca-perfectul: înaintea altui moment din trecut', 'He had **gone** when I arrived'],
        ['be (is / was / will be) + **V3**', 'pasivul: nu contează cine face acțiunea', 'It was **said** in the meeting · The bug was **found**'],
        ['will have + **V3**', 'viitorul perfect: gata până la un moment', 'By Friday we will have **written** the tests'],
        ['should / could / must have + **V3**', 'despre trecut: regret, critică, deducție', 'You should have **said** something'],
        ['**V3** ca adjectiv', 'descrie ceva', 'a **broken** laptop · a **written** offer'],
      ] },
      examples: [
        { en: 'I have never said that to a client.', ro: 'N-am spus niciodată asta unui client.' },
        { en: 'She has gone to the airport.', ro: 'A plecat la aeroport (și e încă acolo / pe drum).' },
        { en: 'The new feature was written in TypeScript.', ro: 'Funcția nouă a fost scrisă în TypeScript.' },
      ],
    },
    {
      headingRo: 'Cum le înveți mai ușor: pe tipare',
      textRo: 'Aproape **jumătate** dintre verbe au **V2 = V3** (say – said – said), deci de multe ori ai de învățat o singură formă nouă. Folosește filtrul **„Tipar”** din listă ca să le exersezi pe grupe. Iar verbele cu prefix (over-, re-, under-, mis-, out-) se conjugă exact ca verbul de bază: **oversee** ca *see – saw – seen*, **rewrite** ca *write – wrote – written*.',
      table: { headers: ['Tipar', 'Exemple'], rows: [
        ['**V2 = V3** (A – B – B)', 'say – said – said · buy – bought – bought · keep – kept – kept'],
        ['**toate diferite** (A – B – C)', 'go – went – gone · write – wrote – written · take – took – taken'],
        ['**toate la fel** (A – A – A)', 'cut – cut – cut · put – put – put · let – let – let'],
        ['**prima = a treia** (A – B – A)', 'come – came – come · run – ran – run · become – became – become'],
      ] },
      examples: [
        { en: 'I bought a laptop last week. Have you bought one yet?', ro: 'Mi-am luat un laptop săptămâna trecută. Tu ți-ai luat deja unul?' },
        { en: 'We cut the budget last year and it has been cut again.', ro: 'Am tăiat bugetul anul trecut și a fost tăiat din nou.' },
      ],
    },
  ],
  tipsRo: [
    'După **did** vine mereu V1: **Did you go?**, nu „Did you went?”.',
    'După **have / has** vine V3: **I have gone**, nu „I have went”.',
    'V3 nu stă singur: **I saw it** sau **I have seen it**, nu „I seen it”.',
    '**been** vs **gone**: *She has been to Paris* (a fost și s-a întors) · *She has gone to Paris* (e acolo acum).',
  ],
} };
/** Opens the explanation of the three forms. */
export function formsHelp() { modal(h('div.forms-help', grammarNode(FORMS_HELP)), { wide: true }); }
const helpBtn = (label) => h('button.btn.help-btn', { type: 'button', onclick: (e) => { e.stopPropagation(); formsHelp(); } },
  label || L('❓ Cum se folosesc cele trei forme', '❓ How the three forms are used'));

/** How this verb's three forms are used, built from its forms (go → I go · will go · did you go? · I went · I have gone). */
function usage(v) {
  const a = v.v1, b = verbAlts(v.v2)[0], c = verbAlts(v.v3)[0];
  const rows = a === 'be'
    ? [['V1', L('prezent / viitor', 'present / future'), 'I am · you are · she is · I will be'],
      ['V2', L('trecut simplu', 'past simple'), 'I was · we were · Were you…?'],
      ['V3', L('după have / had', 'after have / had'), 'I have been · it had been']]
    : [['V1', L('prezent, viitor, după did / can / to', 'present, future, after did / can / to'), `I ${a} · I will ${a} · Did you ${a}? · I didn't ${a}`],
      ['V2', L('trecut simplu (doar afirmativ)', 'past simple (affirmative only)'), `I ${b} (yesterday)`],
      ['V3', L('după have / had / be', 'after have / had / be'), `I have ${c} · I had ${c}`]];
  return h('div.verb-usage',
    rows.map(([k, when, ex]) => h('div.verb-usage-row', h('strong', k), h('span.muted.small', when), h('span', ex))));
}

/** The full card of a verb: forms, pronunciation, meaning, pattern, two examples. */
function verbCard(v) {
  return h('div.vcard-in.fade-in',
    h('div.verb-forms', h('span', v.v1), h('i', '–'), h('span', v.v2), h('i', '–'), h('span', v.v3), speakBtn(`${v.v1}. ${verbAlts(v.v2).join(' or ')}. ${verbAlts(v.v3).join(' or ')}.`)),
    h('div.verb-labels', h('span', 'V1'), h('span', L('V2 · trecut', 'V2 · past')), h('span', L('V3 · participiu', 'V3 · participle'))),
    v.ipa ? h('div.vipa', v.ipa) : null,
    h('div.vro', v.ro || ''),
    h('div.row.center.wrap', levelChip(v.levelId), patternChip(v)),
    usage(v),
    v.ex2 ? h('div.vex', speakBtn(v.ex2), h('div', h('div.en', { html: mark(v.ex2, v.v2) }), h('div.ro', v.ex2Ro || ''))) : null,
    v.ex3 ? h('div.vex', speakBtn(v.ex3), h('div', h('div.en', { html: mark(v.ex3, v.v3) }), h('div.ro', v.ex3Ro || ''))) : null,
    h('div.row.center.mt', helpBtn()));
}

// ---------- sessions ----------
/** Look and listen: one card per verb, then `onDone()`. Returns a stop function. */
function study(box, verbs, title, onDone) {
  let i = 0;
  const card = h('div.vcard');
  const dots = h('div.dots');
  const prev = h('button.btn', { onclick: () => { if (i > 0) { i--; draw(); } } }, L('← Înapoi', '← Back'));
  const next = h('button.btn.primary', { onclick: () => { if (i < verbs.length - 1) { i++; draw(); } else { stop(); onDone(); } } });
  const onKey = (e) => { if (e.target.tagName === 'INPUT') return; if (e.key === 'ArrowRight') next.click(); else if (e.key === 'ArrowLeft') prev.click(); else if (e.key === ' ') { e.preventDefault(); sayForms(verbs[i]); } };
  document.addEventListener('keydown', onKey);
  const stop = () => { document.removeEventListener('keydown', onKey); stopSpeak(); };
  function draw() {
    card.replaceChildren(verbCard(verbs[i]));
    dots.replaceChildren(...verbs.map((_, n) => h('span.dot' + (n === i ? '.now' : n < i ? '.done' : ''), { onclick: () => { i = n; draw(); } })));
    prev.disabled = i === 0;
    next.textContent = i === verbs.length - 1 ? L('Acum scrie-le tu →', 'Now type them →') : L('Următorul →', 'Next →');
    sayForms(verbs[i]);
  }
  box.replaceChildren(h('div.sess-title', title),
    h('p.muted.center', L('Privește, ascultă și repetă cu voce tare cele trei forme · ← → navigare · Space = audio', 'Look, listen and say the three forms aloud · ← → to navigate · Space = audio')),
    card, dots, h('div.row.center', prev, next));
  draw();
  return stop;
}

/**
 * Typing drill: for each verb you type the past simple and the past participle.
 * onAnswer(v, ok) runs once per verb (first attempt); wrong ones come back once at the end.
 * onDone(results, early) gets [{ v, ok }]. Returns a stop function.
 */
function drill(box, verbs, { title, onAnswer, onDone }) {
  const queue = verbs.map((v) => ({ v, retry: false }));
  const results = [];
  let pos = 0, ended = false;
  const progress = h('div.bar', h('div.bar-fill'));
  const counter = h('span.sess-count');
  const stage = h('div');
  const end = (early) => { if (ended) return; ended = true; stopSpeak(); onDone(results, early); };
  box.replaceChildren(h('div.session',
    h('div.sess-top', h('button.icon-btn', { title: L('Ieși', 'Exit'), onclick: () => end(true) }, '✕'), progress, counter),
    title ? h('div.sess-title', title) : null, stage));

  function show() {
    if (pos >= queue.length) return end(false);
    const item = queue[pos];
    const v = item.v;
    let answered = false;
    progress.firstChild.style.width = `${(results.length / verbs.length) * 100}%`;
    counter.textContent = item.retry ? L('Încă o dată', 'Once more') : `${results.length + 1} / ${verbs.length}`;
    const input = () => h('input.gap-input.verb-input', { type: 'text', autocomplete: 'off', spellcheck: 'false', autocapitalize: 'off' });
    const in2 = input(), in3 = input();
    const fb = h('div.mt');
    const foot = h('div.row.center.mt');
    const next = () => { pos++; show(); };
    const check = () => {
      if (answered) return;
      if (!in2.value.trim()) return in2.focus();
      if (!in3.value.trim()) return in3.focus();
      answered = true;
      const ok2 = checkText(in2.value, verbAnswers(v.v2)).ok;
      const ok3 = checkText(in3.value, verbAnswers(v.v3)).ok;
      in2.classList.add(ok2 ? 'right' : 'wrong'); in3.classList.add(ok3 ? 'right' : 'wrong');
      in2.readOnly = true; in3.readOnly = true;
      const ok = ok2 && ok3;
      sfx(ok ? 'ok' : 'bad');
      sayForms(v);
      if (!item.retry) { results.push({ v, ok }); if (onAnswer) onAnswer(v, ok); }
      if (!ok && !item.retry) queue.push({ v, retry: true });
      fb.replaceChildren(h('div.feedback.' + (ok ? 'good' : 'bad'),
        h('div.fb-head', ok ? L('Corect! 🎉', 'Correct! 🎉') : L('Nu chiar… ❌', 'Not quite… ❌')),
        h('div.fb-answer', h('strong', forms(v)), ' ', speakBtn(`${v.v1}. ${verbAlts(v.v2).join(' or ')}. ${verbAlts(v.v3).join(' or ')}.`)),
        !ok && !item.retry ? h('div.fb-explain', L('Îl mai primești o dată la final.', 'It comes back once more at the end.')) : null,
        v.ex3 ? h('div.fb-explain', { html: mark(v.ex3, v.v3) }) : null));
      const nb = h('button.btn.big.' + (ok ? 'success' : 'danger'), { onclick: next }, L('Continuă →', 'Continue →'));
      foot.replaceChildren(nb);
      nb.focus();
    };
    in2.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); if (!answered) in3.focus(); } });
    in3.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); check(); } });
    foot.replaceChildren(h('button.btn.primary.big', { onclick: check }, L('Verifică', 'Check')));
    stage.replaceChildren(h('div.card.verb-drill.fade-in',
      h('div.muted.small', L('Scrie trecutul (V2) și participiul (V3)', 'Type the past simple (V2) and the past participle (V3)')),
      h('div.vword', h('span', v.v1), speakBtn(v.v1)),
      h('div.vro', v.ro || ''),
      h('div.verb-inputs',
        h('label', h('span.muted.small', L('V2 · trecut (past simple)', 'V2 · past simple')), in2),
        h('label', h('span.muted.small', L('V3 · participiu (past participle)', 'V3 · past participle')), in3)),
      foot, fb));
    setTimeout(() => in2.focus(), 50);
  }
  show();
  return () => { ended = true; stopSpeak(); };
}

/** The end of a session: score, the verbs you missed, and what to do next. */
function summary(box, results, { title, lines = [], actions = [] }) {
  const ok = results.filter((r) => r.ok).length;
  if (results.length && ok === results.length) { confetti(1200); sfx('win'); }
  box.replaceChildren(h('div.result.fade-in',
    h('div.result-ring', { style: `--p:${results.length ? Math.round((ok / results.length) * 100) : 0}` }, h('span', `${ok}/${results.length}`)),
    h('h2', title),
    lines.filter(Boolean).map((l) => h('p', { html: md(l) })),
    results.length ? h('div.verb-results', results.map((r) => h('div.verb-result' + (r.ok ? '.ok' : '.bad'), r.ok ? '✓ ' : '✗ ', forms(r.v)))) : null,
    h('div.row.center.wrap.mt', actions)));
}

// ---------- the page ----------
export function verbsView(main) {
  const wc = wordCounts();
  const vc = () => verbCounts();
  main.append(
    header(L('📖 Cuvintele mele', '📖 My words'),
      L('Verbele neregulate: cele trei forme pe care trebuie să le știi pe de rost, de la cele mai folosite la cele mai rare.', 'Irregular verbs: the three forms you need to know by heart, from the most used to the rarest.'), '#/'),
    h('div.tabs',
      [['all', L('Toate', 'All'), wc.total], ['learned', L('✅ Învățate', '✅ Learned'), wc.learned], ['learning', L('🌱 În curs', '🌱 Learning'), wc.learning], ['new', L('🆕 De învățat', '🆕 To learn'), wc.new]]
        .map(([k, label, n]) => h('a.tab', { href: `#/words/${k}` }, `${label} (${n})`)),
      h('a.tab.on.tab-verbs', { href: '#/words/verbs' }, L(`🔁 Verbe neregulate (${S.verbs.length})`, `🔁 Irregular verbs (${S.verbs.length})`))));
  const box = h('div');
  main.append(box);
  if (!S.verbs.length) {
    box.append(empty('🔁', L('Lista de verbe nu e încă disponibilă', 'The verb list is not available yet'), L('Repornește serverul (Start.bat) și reîncarcă pagina.', 'Restart the server (Start.bat) and reload the page.')));
    return;
  }

  let stop = null, q = '', fLevel = 'all', fStatus = 'all', fPat = 'all';
  const list = h('div.word-list');
  const count = h('span.muted');
  const run = (fn) => { if (stop) stop(); stop = fn(); scrollTo(0, 0); };

  // --- learn: study 10 new verbs, then type them ---
  function learn(verbs) {
    run(() => study(box, verbs, L(`🔁 Verbe noi: ${verbs.map((v) => v.v1).join(', ')}`, `🔁 New verbs: ${verbs.map((v) => v.v1).join(', ')}`), () => {
      let xp = 0;
      stop = drill(box, verbs, {
        title: L('Scrie formele din memorie', 'Type the forms from memory'),
        onAnswer: (v, ok) => { if (ok) { gradeVerb(v.v1, 2); xp += 2; addXp(2); } else learnVerb(v.v1); save(); },
        onDone: (res, early) => {
          if (early && !res.length) return draw();
          summary(box, res, { title: L('Verbe noi învățate', 'New verbs learned'),
            lines: [L(`Le repeți mâine, apoi la intervale tot mai mari, ca să rămână. · +${xp} XP ⚡`, `You review them tomorrow, then at growing intervals so they stick. · +${xp} XP ⚡`)],
            actions: afterActions() });
        },
      });
    }));
  }
  // --- check: type first; what you already know counts as learned ---
  function checkMe(verbs) {
    let xp = 0;
    run(() => drill(box, verbs, {
      title: L('⚡ Verificare: scrie formele fără să le vezi înainte', '⚡ Check: type the forms without seeing them first'),
      onAnswer: (v, ok) => { if (ok) { verbKnown(v.v1); xp += 2; addXp(2); } else learnVerb(v.v1); save(); },
      onDone: (res, early) => {
        if (early && !res.length) return draw();
        const missed = res.filter((r) => !r.ok).map((r) => r.v);
        summary(box, res, { title: missed.length ? L('Acum știi exact ce ai de învățat', 'Now you know exactly what to learn') : L('Le știai pe toate! 💪', 'You knew them all! 💪'),
          lines: [L(`Cele știute le mai verifici o dată peste o săptămână. · +${xp} XP ⚡`, `The ones you knew get one more check in a week. · +${xp} XP ⚡`)],
          actions: [missed.length ? h('button.btn.primary.big', { onclick: () => learn(missed) }, L(`📖 Învață-le acum pe cele ${missed.length} greșite`, `📖 Learn the ${missed.length} you missed now`)) : null, ...afterActions()] });
      },
    }));
  }
  // --- review: the verbs due today (spaced repetition) ---
  function review(verbs, graded = true) {
    let xp = 0;
    run(() => drill(box, verbs, {
      title: graded ? L('🔁 Repetare: verbele de azi', "🔁 Review: today's verbs") : L('🎲 Exersare liberă', '🎲 Free practice'),
      onAnswer: (v, ok) => { if (graded) gradeVerb(v.v1, ok ? 2 : 0); if (ok) { xp += 1; addXp(1); } },
      onDone: (res, early) => {
        if (early && !res.length) return draw();
        summary(box, res, { title: L('Repetare terminată', 'Review done'), lines: [`+${xp} XP ⚡`], actions: afterActions() });
      },
    }));
  }
  function afterActions() {
    const fresh = S.verbs.filter((v) => verbStatus(v.v1) === 'new');
    const due = dueVerbs();
    return [
      due.length ? h('button.btn.primary.big', { onclick: () => review(due.slice(0, 20)) }, L(`🔁 Repetă ${Math.min(20, due.length)} de azi`, `🔁 Review ${Math.min(20, due.length)} due today`)) : null,
      fresh.length ? h('button.btn' + (due.length ? '' : '.primary.big'), { onclick: () => learn(fresh.slice(0, BATCH)) }, L(`▶ Următoarele ${Math.min(BATCH, fresh.length)} verbe`, `▶ The next ${Math.min(BATCH, fresh.length)} verbs`)) : null,
      h('button.btn', { onclick: draw }, L('Lista de verbe', 'Verb list'))];
  }

  function details(v) {
    const body = h('div');
    const close = modal(body);
    const st = verbStatus(v.v1);
    const act = (label, cls, fn) => h('button.btn' + cls, { onclick: () => { fn(); save(); close(); draw(); } }, label);
    body.append(verbCard(v),
      h('div.center.mt', chip(...STATUS[st]), S.p.verbs[v.v1] && S.p.verbs[v.v1].known ? h('span.muted.small', ' ', L('· îl știai deja la verificare', '· you already knew it at the check')) : null),
      h('div.row.center.wrap.mt',
        st !== 'learned' ? h('button.btn.primary', { onclick: () => { close(); learn([v]); } }, L('🧠 Învață-l acum', '🧠 Learn it now')) : null,
        st === 'new' ? h('button.btn', { onclick: () => { close(); checkMe([v]); } }, L('⚡ Verifică-mă', '⚡ Test me')) : null,
        st === 'learned' ? act(L('↺ Vreau să-l repet', '↺ Practise it again'), '', () => learnVerb(v.v1)) : null,
        st !== 'new' ? act(L('Scoate din repetare', 'Remove from review'), '', () => forgetVerb(v.v1)) : null));
    sayForms(v);
  }

  function row(v) {
    const st = verbStatus(v.v1);
    const [label, cls] = STATUS[st];
    const b = (S.p.verbs[v.v1] || {}).box || 0;
    return h('div.word-row.verb-row', { onclick: () => details(v) },
      h('span.verb-rank.muted', `#${v.rank}`),
      h('span.word-en', h('strong', forms(v)), h('small.muted', v.ipa || '')),
      h('span.word-ro', v.ro || ''), levelChip(v.levelId), chip(label, cls),
      h('span.word-box', { title: L('Cât de bine îl știi', 'How well you know it') }, [0, 1, 2, 3].map((n) => h('i' + (S.p.verbs[v.v1] && b > n ? '.on' : '')))),
      h('span.word-acts',
        st !== 'learned' ? h('button.icon-btn.word-act', { title: L('Învață-l acum', 'Learn it now'), onclick: (e) => { e.stopPropagation(); learn([v]); } }, '🧠') : null,
        h('button.icon-btn.speak', { title: L('Ascultă', 'Listen'), onclick: (e) => { e.stopPropagation(); sayForms(v); } }, '🔊')));
  }

  const matches = (v) => {
    if (!q) return true;
    const all = [v.v1, ...verbAlts(v.v2), ...verbAlts(v.v3)].map((x) => x.toLowerCase());
    return all.some((x) => x.startsWith(q)) || (v.ro || '').toLowerCase().includes(q);
  };
  function drawList() {
    const rows = S.verbs.filter((v) => matches(v) && (fLevel === 'all' || v.levelId === fLevel)
      && (fStatus === 'all' || verbStatus(v.v1) === fStatus) && (fPat === 'all' || pattern(v) === fPat));
    count.textContent = nVerbs(rows.length);
    list.replaceChildren(...rows.map(row));
    if (!rows.length) list.append(h('p.muted.center', L('Niciun verb pentru căutarea asta.', 'No verb matches this search.')));
  }

  function draw() {
    if (stop) { stop(); stop = null; }
    stopSpeak();
    const c = vc();
    const fresh = S.verbs.filter((v) => verbStatus(v.v1) === 'new');
    const due = dueVerbs();
    const search = h('input.search', { type: 'search', value: q, placeholder: L('🔍 Caută: go, went, gone sau „a merge”…', '🔍 Search: go, went, gone or a Romanian meaning…'),
      oninput: (e) => { q = e.target.value.trim().toLowerCase(); drawList(); } });
    const sel = (value, opts, onchange) => h('select', { onchange: (e) => { onchange(e.target.value); drawList(); } },
      opts.map(([k, label]) => h('option', { value: k, selected: k === value }, label)));
    box.replaceChildren(
      h('div.card',
        h('div.row.between', h('span', L('Verbe neregulate învățate', 'Irregular verbs learned')), h('strong', `${c.learned} / ${c.total}`)),
        bar(c.total ? c.learned / c.total : 0, '#a78bfa'),
        h('p.muted.small', L(`${c.learning} în curs · ${c.new} de învățat · ${due.length} de repetat azi`, `${c.learning} being learned · ${c.new} to learn · ${due.length} to review today`))),
      h('div.card.verb-help',
        h('div.verb-help-grid',
          h('div', h('strong', 'V1 · say'), h('span.muted.small', L('forma de bază: prezent, viitor (will say), după did / can / to', 'base form: present, future (will say), after did / can / to'))),
          h('div', h('strong', 'V2 · said'), h('span.muted.small', L('trecutul simplu: ieri, anul trecut (doar afirmativ)', 'past simple: yesterday, last year (affirmative only)'))),
          h('div', h('strong', 'V3 · said'), h('span.muted.small', L('participiul: după have / had / be (I have said, it was said)', 'past participle: after have / had / be (I have said, it was said)')))),
        h('div.row.center.mt', helpBtn())),
      h('div.row.center.wrap',
        due.length ? h('button.btn.primary.big', { onclick: () => review(due.slice(0, 20)) }, L(`🔁 Repetă ${Math.min(20, due.length)} de azi`, `🔁 Review ${Math.min(20, due.length)} due today`)) : null,
        fresh.length ? h('button.btn' + (due.length ? '.big' : '.primary.big'), { onclick: () => learn(fresh.slice(0, BATCH)) }, L(`▶ Învață următoarele ${Math.min(BATCH, fresh.length)}`, `▶ Learn the next ${Math.min(BATCH, fresh.length)}`)) : null,
        fresh.length ? h('button.btn.big', { onclick: () => checkMe(fresh.slice(0, BATCH)), title: L('Scrii formele înainte să le vezi: cele pe care le știi deja trec la „învățate”', 'Type the forms before seeing them: the ones you already know go straight to “learned”') }, L(`⚡ Verifică-mă direct (${Math.min(BATCH, fresh.length)})`, `⚡ Test me first (${Math.min(BATCH, fresh.length)})`)) : null,
        c.learned + c.learning >= 4 ? h('button.btn', { onclick: () => review(sample(S.verbs.filter((v) => verbStatus(v.v1) !== 'new'), 10), false) }, L('🎲 Exersare liberă', '🎲 Free practice')) : null),
      h('p.muted.small.center', L('Verbele vin în ordinea folosirii: primele sunt cele mai frecvente. Fiecare răspuns corect îți aduce XP pentru obiectivul zilnic. ', 'The verbs come in order of use: the first ones are the most frequent. Every correct answer earns XP for your daily goal. '),
        h('button.icon-btn.help-icon', { type: 'button', title: L('Cum se folosesc cele trei forme', 'How the three forms are used'), onclick: formsHelp }, '❓')),
      h('div.row.wrap.filters', search,
        sel(fLevel, [['all', L('Toate nivelurile', 'All levels')], ['a1', 'A1'], ['a2', 'A2'], ['b1', 'B1'], ['b2', 'B2']], (x) => { fLevel = x; }),
        sel(fStatus, [['all', L('Orice stare', 'Any status')], ['new', STATUS.new[0]], ['learning', STATUS.learning[0]], ['learned', STATUS.learned[0]]], (x) => { fStatus = x; }),
        sel(fPat, [['all', L('Orice tipar', 'Any pattern')], ...Object.entries(PATTERNS).map(([k, [name, ex]]) => [k, `${name} (${ex})`])], (x) => { fPat = x; }),
        count),
      list);
    drawList();
  }
  draw();
  return () => { if (stop) stop(); stopSpeak(); };
}

