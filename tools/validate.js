// Validates course content. Usage: node tools/validate.js [a1|a2|b1|b2]
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'data');
const levels = process.argv[2] ? [process.argv[2].toLowerCase()] : ['a1', 'a2', 'b1', 'b2'];
const POS = ['noun', 'verb', 'adj', 'adv', 'phrase', 'prep', 'pron', 'conj', 'other'];
const READ_LEN = { A1: [50, 110], A2: [90, 160], B1: [150, 240], B2: [220, 330] };
let errors = 0, warnings = 0;

const err = (f, m) => { errors++; console.log(`  ERROR ${f}: ${m}`); };
const warn = (f, m) => { warnings++; console.log(`  warn  ${f}: ${m}`); };
const str = (v) => typeof v === 'string' && v.trim().length > 0;

function checkExercise(f, ex, where, onlyMc) {
  const w = `${where}`;
  if (!ex || typeof ex !== 'object') return err(f, `${w}: not an object`);
  if (onlyMc && ex.type !== 'mc') return err(f, `${w}: must be type "mc"`);
  if (ex.type !== 'match' && !str(ex.explainRo)) err(f, `${w}: missing explainRo`);
  switch (ex.type) {
    case 'mc':
      if (!str(ex.q)) err(f, `${w}: missing q`);
      if (!Array.isArray(ex.options) || ex.options.length < 3 || ex.options.length > 4) err(f, `${w}: needs 3-4 options`);
      else {
        if (!ex.options.every(str)) err(f, `${w}: empty option`);
        if (new Set(ex.options.map((o) => o.trim().toLowerCase())).size !== ex.options.length) err(f, `${w}: duplicate options`);
        if (!Number.isInteger(ex.answer) || ex.answer < 0 || ex.answer >= ex.options.length) err(f, `${w}: bad answer index`);
      }
      break;
    case 'fill':
      if (!str(ex.q) || (ex.q.match(/___/g) || []).length !== 1) err(f, `${w}: q must contain exactly one ___`);
      if (!Array.isArray(ex.answers) || !ex.answers.length || !ex.answers.every(str)) err(f, `${w}: needs answers[]`);
      break;
    case 'order':
      if (!Array.isArray(ex.words) || ex.words.length < 4 || ex.words.length > 9 || !ex.words.every(str)) err(f, `${w}: words must have 4-9 tokens`);
      if (!str(ex.ro)) err(f, `${w}: missing ro`);
      break;
    case 'translate':
      if (!str(ex.ro)) err(f, `${w}: missing ro`);
      if (!Array.isArray(ex.answers) || !ex.answers.length || !ex.answers.every(str)) err(f, `${w}: needs answers[]`);
      break;
    case 'listen':
      if (!str(ex.audio)) err(f, `${w}: missing audio`);
      if (!Array.isArray(ex.answers) || !ex.answers.length || !ex.answers.every(str)) err(f, `${w}: needs answers[]`);
      else if (!ex.answers.includes(ex.audio)) err(f, `${w}: answers must include the audio text`);
      break;
    case 'match':
      if (!Array.isArray(ex.pairs) || ex.pairs.length !== 5 || !ex.pairs.every((p) => Array.isArray(p) && p.length === 2 && p.every(str))) err(f, `${w}: needs exactly 5 [en, ro] pairs`);
      break;
    default:
      err(f, `${w}: unknown type "${ex.type}"`);
  }
}

function checkUnit(f, u, lvl, n, seenWords) {
  const L = lvl.toUpperCase();
  const id = `${lvl}-u${String(n).padStart(2, '0')}`;
  if (u.id !== id) err(f, `id must be "${id}"`);
  if (u.level !== L) err(f, `level must be "${L}"`);
  if (u.order !== n) err(f, `order must be ${n}`);
  for (const k of ['title', 'titleRo', 'emoji', 'goalRo']) if (!str(u[k])) err(f, `missing ${k}`);

  if (!Array.isArray(u.vocab) || u.vocab.length < 14 || u.vocab.length > 18) err(f, `vocab must have 14-18 items (has ${u.vocab ? u.vocab.length : 0})`);
  (u.vocab || []).forEach((v, i) => {
    for (const k of ['en', 'ro', 'ipa', 'emoji', 'ex', 'exRo']) if (!str(v[k])) err(f, `vocab[${i}] missing ${k}`);
    if (!POS.includes(v.pos)) err(f, `vocab[${i}] bad pos "${v.pos}"`);
    if (v.wiki !== undefined && !str(v.wiki)) err(f, `vocab[${i}] empty wiki`);
    const key = String(v.en).toLowerCase();
    if (seenWords.has(key)) err(f, `vocab "${v.en}" already used in ${seenWords.get(key)}`);
    else seenWords.set(key, f);
  });

  const g = u.grammar;
  if (!g || !str(g.title) || !str(g.titleRo)) err(f, 'grammar needs title + titleRo');
  else {
    if (!Array.isArray(g.sections) || g.sections.length < 2 || g.sections.length > 5) err(f, 'grammar needs 2-5 sections');
    (g.sections || []).forEach((s, i) => {
      if (!str(s.headingRo) || !str(s.textRo)) err(f, `grammar.sections[${i}] needs headingRo + textRo`);
      if (!Array.isArray(s.examples) || s.examples.length < 2 || !s.examples.every((e) => str(e.en) && str(e.ro))) err(f, `grammar.sections[${i}] needs >=2 examples {en, ro}`);
      if (s.table) {
        const t = s.table;
        if (!Array.isArray(t.headers) || !Array.isArray(t.rows) || !t.rows.every((r) => Array.isArray(r) && r.length === t.headers.length)) err(f, `grammar.sections[${i}] bad table`);
      }
    });
    if (!Array.isArray(g.tipsRo) || g.tipsRo.length < 2 || !g.tipsRo.every(str)) err(f, 'grammar needs >=2 tipsRo');
  }

  const d = u.dialogue;
  if (!d || !str(d.titleRo) || !Array.isArray(d.lines) || d.lines.length < 6 || d.lines.length > 10) err(f, 'dialogue needs titleRo + 6-10 lines');
  else {
    if (!d.lines.every((l) => str(l.speaker) && str(l.en) && str(l.ro))) err(f, 'dialogue line needs speaker, en, ro');
    if (new Set(d.lines.map((l) => l.speaker)).size !== 2) err(f, 'dialogue must have exactly 2 speakers');
  }

  const r = u.reading;
  if (!r || !str(r.title) || !str(r.text) || !str(r.textRo)) err(f, 'reading needs title, text, textRo');
  else {
    const wc = r.text.split(/\s+/).filter(Boolean).length;
    const [lo, hi] = READ_LEN[L];
    if (wc < lo || wc > hi) warn(f, `reading has ${wc} words (expected ${lo}-${hi})`);
    if (!Array.isArray(r.questions) || r.questions.length !== 4) err(f, 'reading needs exactly 4 questions');
    else r.questions.forEach((q, i) => checkExercise(f, q, `reading.questions[${i}]`, true));
  }

  const ex = u.exercises;
  if (!Array.isArray(ex) || ex.length < 18 || ex.length > 20) err(f, `exercises must have 18-20 items (has ${ex ? ex.length : 0})`);
  else {
    ex.forEach((e, i) => checkExercise(f, e, `exercises[${i}]`));
    const cnt = {};
    ex.forEach((e) => { cnt[e.type] = (cnt[e.type] || 0) + 1; });
    const min = { mc: 6, fill: 3, order: 3, translate: 2, listen: 2, match: 1 };
    for (const t in min) if ((cnt[t] || 0) < min[t]) err(f, `needs at least ${min[t]} "${t}" exercises (has ${cnt[t] || 0})`);
    const mc = ex.filter((e) => e.type === 'mc');
    if (mc.length >= 6 && new Set(mc.map((e) => e.answer)).size < 3) warn(f, 'mc correct answers are not varied enough in position');
  }

  if (u.video !== undefined) {
    if (!u.video || !/^[\w-]{11}$/.test(u.video.youtubeId || '') || !str(u.video.title)) err(f, 'video needs an 11-char youtubeId + title');
  }
}

// ---- word banks (bankNN.json next to unitNN.json) ----
// Every unit ends up with this many words in total (core vocab + bank): 600 / 1200 / 2000 / 3000 by the end of A1 / A2 / B1 / B2.
const UNIT_WORDS = { A1: 60, A2: 60, B1: 80, B2: 100 };
const pad = (n) => String(n).padStart(2, '0');
const readOr = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } };
// all words of the whole course, so a bank word is never a repeat of a word from any level
const coreWords = new Map();
for (const l of ['a1', 'a2', 'b1', 'b2']) {
  for (let n = 1; n <= 10; n++) {
    const u = readOr(path.join(ROOT, l, `unit${pad(n)}.json`));
    if (u && Array.isArray(u.vocab)) u.vocab.forEach((v) => { const k = String(v.en).toLowerCase(); if (!coreWords.has(k)) coreWords.set(k, `${l}/unit${pad(n)}.json`); });
  }
}
const bankSeen = new Map();
for (const l of ['a1', 'a2', 'b1', 'b2']) { // banks of the levels before the checked one count too
  if (l === levels[0]) break;
  for (let n = 1; n <= 10; n++) {
    const b = readOr(path.join(ROOT, l, `bank${pad(n)}.json`));
    if (b && Array.isArray(b.words)) b.words.forEach((w) => bankSeen.set(String(w.en).toLowerCase(), `${l}/bank${pad(n)}.json`));
  }
}

function checkBank(lvl, n) {
  const L = lvl.toUpperCase();
  const f = `${lvl}/bank${pad(n)}.json`;
  const p = path.join(ROOT, lvl, `bank${pad(n)}.json`);
  if (!fs.existsSync(p)) return warn(f, 'file missing (the unit has no word bank)');
  let b;
  try { b = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return err(f, `invalid JSON: ${e.message}`); }
  const id = `${lvl}-u${pad(n)}`;
  if (b.unit !== id) err(f, `unit must be "${id}"`);
  if (!Array.isArray(b.words) || !b.words.length) return err(f, 'needs a words[] array');
  const u = readOr(path.join(ROOT, lvl, `unit${pad(n)}.json`));
  const want = u && Array.isArray(u.vocab) ? UNIT_WORDS[L] - u.vocab.length : null;
  if (want !== null && b.words.length !== want) warn(f, `has ${b.words.length} words, expected ${want} (unit total ${UNIT_WORDS[L]})`);
  b.words.forEach((v, i) => {
    for (const k of ['en', 'ro', 'ipa', 'emoji', 'ex', 'exRo']) if (!str(v[k])) err(f, `words[${i}] missing ${k}`);
    if (!POS.includes(v.pos)) err(f, `words[${i}] bad pos "${v.pos}"`);
    if (v.wiki !== undefined && !str(v.wiki)) err(f, `words[${i}] empty wiki`);
    if (str(v.ipa) && !/^\/.+\/$/.test(v.ipa.trim())) err(f, `words[${i}] ipa must look like /.../`);
    if (str(v.en) && v.en !== v.en.trim()) err(f, `words[${i}] en has extra spaces`);
    const key = String(v.en).toLowerCase();
    if (coreWords.has(key)) err(f, `"${v.en}" is already a core word in ${coreWords.get(key)}`);
    else if (bankSeen.has(key)) err(f, `"${v.en}" is already in ${bankSeen.get(key)}`);
    else bankSeen.set(key, f);
  });
}

// ---- new unit-test questions (testNN.json next to unitNN.json) ----
// Half of every unit test comes from here: the same grammar and words as the unit, in sentences the unit never shows.
const TEST_COUNT = 12;
const TEST_MIN = { mc: 4, fill: 2, order: 2, translate: 1, listen: 1 };
const flat = (s) => String(s || '').toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();
/** The full English sentence an exercise is about (gap filled in), for spotting repeats. */
function sentencesOf(ex) {
  const fillGap = (q, a) => (q || '').replace('___', a || '');
  switch (ex && ex.type) {
    case 'mc': return [fillGap(ex.q, (ex.options || [])[ex.answer])];
    case 'fill': return [fillGap(ex.q, (ex.answers || [])[0])];
    case 'order': return [(ex.words || []).join(' ')];
    case 'translate': return [(ex.answers || [])[0]];
    case 'listen': return [ex.audio];
    default: return [];
  }
}
function unitSentences(u) {
  const out = [];
  (u.exercises || []).forEach((e) => out.push(...sentencesOf(e)));
  (u.vocab || []).forEach((v) => out.push(v.ex));
  ((u.grammar && u.grammar.sections) || []).forEach((s) => (s.examples || []).forEach((e) => out.push(e.en)));
  ((u.dialogue && u.dialogue.lines) || []).forEach((l) => out.push(l.en));
  if (u.reading) {
    out.push(...String(u.reading.text || '').split(/(?<=[.!?])\s+/));
    (u.reading.questions || []).forEach((q) => out.push(q.q));
  }
  return new Set(out.map(flat).filter((s) => s.split(' ').length >= 3));
}

function checkTest(lvl, n) {
  const f = `${lvl}/test${pad(n)}.json`;
  const p = path.join(ROOT, lvl, `test${pad(n)}.json`);
  if (!fs.existsSync(p)) return warn(f, 'file missing (the unit test uses only the unit\'s exercises)');
  let t;
  try { t = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return err(f, `invalid JSON: ${e.message}`); }
  const id = `${lvl}-u${pad(n)}`;
  if (t.unit !== id) err(f, `unit must be "${id}"`);
  if (!Array.isArray(t.questions)) return err(f, 'needs a questions[] array');
  if (t.questions.length !== TEST_COUNT) err(f, `needs exactly ${TEST_COUNT} questions (has ${t.questions.length})`);
  const cnt = {};
  t.questions.forEach((q, i) => {
    if (q && q.type === 'match') return err(f, `questions[${i}]: "match" is not used in tests`);
    checkExercise(f, q, `questions[${i}]`);
    cnt[q && q.type] = (cnt[q && q.type] || 0) + 1;
  });
  for (const k in TEST_MIN) if ((cnt[k] || 0) < TEST_MIN[k]) err(f, `needs at least ${TEST_MIN[k]} "${k}" questions (has ${cnt[k] || 0})`);
  const u = readOr(path.join(ROOT, lvl, `unit${pad(n)}.json`));
  const known = u ? unitSentences(u) : new Set();
  const mine = new Set();
  t.questions.forEach((q, i) => sentencesOf(q).map(flat).forEach((s) => {
    if (!s) return;
    if (known.has(s)) err(f, `questions[${i}]: "${s}" already appears in the unit — tests need new sentences`);
    if (mine.has(s)) err(f, `questions[${i}]: "${s}" is repeated inside the test`);
    mine.add(s);
  }));
}

for (const lvl of levels) {
  console.log(`\n== ${lvl.toUpperCase()} ==`);
  const dir = path.join(ROOT, lvl);
  if (!fs.existsSync(dir)) { err(lvl, 'folder missing'); continue; }
  const seen = new Map();
  for (let n = 1; n <= 10; n++) {
    const name = `unit${String(n).padStart(2, '0')}.json`;
    const f = `${lvl}/${name}`;
    const p = path.join(dir, name);
    if (!fs.existsSync(p)) { err(f, 'file missing'); continue; }
    let u;
    try { u = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { err(f, `invalid JSON: ${e.message}`); continue; }
    try { checkUnit(f, u, lvl, n, seen); } catch (e) { err(f, `crashed while checking: ${e.message}`); }
    try { checkBank(lvl, n); } catch (e) { err(`${lvl}/bank${pad(n)}.json`, `crashed while checking: ${e.message}`); }
    try { checkTest(lvl, n); } catch (e) { err(`${lvl}/test${pad(n)}.json`, `crashed while checking: ${e.message}`); }
  }
  const pf = `${lvl}/placement.json`;
  const pp = path.join(dir, 'placement.json');
  if (!fs.existsSync(pp)) err(pf, 'file missing');
  else {
    try {
      const pl = JSON.parse(fs.readFileSync(pp, 'utf8'));
      if (pl.level !== lvl.toUpperCase()) err(pf, 'bad level');
      if (!Array.isArray(pl.questions) || pl.questions.length !== 12) err(pf, 'needs exactly 12 questions');
      else pl.questions.forEach((q, i) => {
        checkExercise(pf, q, `questions[${i}]`, true);
        if (q.options && q.options.length !== 4) err(pf, `questions[${i}]: needs 4 options`);
      });
    } catch (e) { err(pf, `invalid JSON: ${e.message}`); }
  }
}
console.log(`\n${errors} error(s), ${warnings} warning(s)`);
process.exit(errors ? 1 : 0);
