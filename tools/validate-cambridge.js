// Validates Cambridge mock exams. Usage: node tools/validate-cambridge.js [pet|fce]
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'data', 'cambridge');
const exams = process.argv[2] ? [process.argv[2].toLowerCase()] : ['pet', 'fce'];
// expected number of questions per part
const SHAPE = {
  pet: { reading: [5, 5, 5, 5, 6, 6], listening: [7, 6, 6, 6], writing: 3, speaking: 4 },
  fce: { reading: [8, 8, 8, 6, 6, 6, 10], listening: [8, 10, 5, 7], writing: 3, speaking: 4 },
};
let errors = 0, warnings = 0;
const err = (f, m) => { errors++; console.log(`  ERROR ${f}: ${m}`); };
const warn = (f, m) => { warnings++; console.log(`  warn  ${f}: ${m}`); };
const str = (v) => typeof v === 'string' && v.trim().length > 0;
const script = (a) => Array.isArray(a) && a.length > 0 && a.every((l) => l && str(l.s) && str(l.en));

function checkQuestion(f, q, w, listening, partHasAudio) {
  if (!q || typeof q !== 'object') return err(f, `${w}: not an object`);
  if (!str(q.explainRo)) err(f, `${w}: missing explainRo`);
  if (q.audio !== undefined && !script(q.audio)) err(f, `${w}: bad audio script`);
  if (listening && !partHasAudio && !q.audio) err(f, `${w}: listening question without any audio script`);
  if (q.audio && new Set(q.audio.map((l) => l.s)).size > 2) err(f, `${w}: more than 2 speakers`);
  if (q.type === 'mc') {
    if (!str(q.q)) err(f, `${w}: missing q`);
    if (!Array.isArray(q.options) || q.options.length < 3 || q.options.length > 8 || !q.options.every(str)) err(f, `${w}: needs 3-8 options`);
    else {
      if (new Set(q.options.map((o) => o.trim().toLowerCase())).size !== q.options.length) err(f, `${w}: duplicate options`);
      if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.options.length) err(f, `${w}: bad answer index`);
    }
  } else if (q.type === 'fill') {
    if (!str(q.q) || (q.q.match(/_{3,}/g) || []).length !== 1) err(f, `${w}: q must contain exactly one ___`);
    if (!Array.isArray(q.answers) || !q.answers.length || !q.answers.every(str)) err(f, `${w}: needs answers[]`);
  } else err(f, `${w}: type must be mc or fill`);
}

function checkPaper(f, name, paper, shape, listening) {
  if (!paper || !Number.isInteger(paper.minutes)) return err(f, `${name}: missing or no minutes`);
  if (!Array.isArray(paper.parts) || paper.parts.length !== shape.length) return err(f, `${name}: needs ${shape.length} parts (has ${paper.parts ? paper.parts.length : 0})`);
  paper.parts.forEach((p, pi) => {
    const w = `${name}.parts[${pi}]`;
    if (!str(p.title) || !str(p.instructionsRo)) err(f, `${w}: needs title + instructionsRo`);
    if (p.audio !== undefined && !script(p.audio)) err(f, `${w}: bad audio script`);
    if (p.audio && new Set(p.audio.map((l) => l.s)).size > 2) err(f, `${w}: more than 2 speakers`);
    if (!Array.isArray(p.questions) || p.questions.length !== shape[pi]) err(f, `${w}: needs ${shape[pi]} questions (has ${p.questions ? p.questions.length : 0})`);
    (p.questions || []).forEach((q, qi) => checkQuestion(f, q, `${w}.questions[${qi}]`, listening, !!p.audio));
    const mc = (p.questions || []).filter((q) => q.type === 'mc');
    if (mc.length >= 5 && new Set(mc.map((q) => q.answer)).size < 2) warn(f, `${w}: every correct answer is in the same position`);
    // gaps referenced in a shared text should exist
    if (str(p.text)) {
      const gaps = (p.text.match(/_{3,}/g) || []).length;
      if (gaps && gaps !== p.questions.length) warn(f, `${w}: text has ${gaps} gaps but ${p.questions.length} questions`);
    }
  });
}

for (const ex of exams) {
  console.log(`\n== ${ex.toUpperCase()} ==`);
  const dir = path.join(ROOT, ex);
  const shape = SHAPE[ex];
  if (!shape) { err(ex, 'unknown exam'); continue; }
  if (!fs.existsSync(dir)) { err(ex, 'folder missing'); continue; }
  const read = (name) => {
    const p = path.join(dir, name);
    if (!fs.existsSync(p)) { err(`${ex}/${name}`, 'file missing'); return null; }
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { err(`${ex}/${name}`, `invalid JSON: ${e.message}`); return null; }
  };
  const info = read('exam.json');
  if (info) {
    const f = `${ex}/exam.json`;
    if (info.id !== ex) err(f, `id must be "${ex}"`);
    for (const k of ['name', 'level', 'aboutRo']) if (!str(info[k])) err(f, `missing ${k}`);
    if (!Array.isArray(info.papersRo) || info.papersRo.length < 4 || !info.papersRo.every((p) => str(p.name) && str(p.info))) err(f, 'papersRo needs >=4 {name, info}');
  }
  for (const n of [1, 2]) {
    const f = `${ex}/test${n}.json`;
    const t = read(`test${n}.json`);
    if (!t) continue;
    try {
      if (t.id !== `${ex}-test${n}`) err(f, `id must be "${ex}-test${n}"`);
      if (!str(t.title)) err(f, 'missing title');
      checkPaper(f, 'reading', t.reading, shape.reading, false);
      checkPaper(f, 'listening', t.listening, shape.listening, true);
      const wr = t.writing;
      if (!wr || !Number.isInteger(wr.minutes) || !Array.isArray(wr.tasks) || wr.tasks.length !== shape.writing) err(f, `writing: needs minutes + ${shape.writing} tasks`);
      else wr.tasks.forEach((k, i) => {
        for (const key of ['title', 'task', 'taskRo', 'model']) if (!str(k[key])) err(f, `writing.tasks[${i}]: missing ${key}`);
        if (!Number.isInteger(k.minWords) || !Number.isInteger(k.maxWords)) err(f, `writing.tasks[${i}]: needs minWords + maxWords`);
        else { const wc = String(k.model || '').split(/\s+/).filter(Boolean).length; if (wc < k.minWords * 0.9 || wc > k.maxWords * 1.15) warn(f, `writing.tasks[${i}]: model has ${wc} words (limits ${k.minWords}-${k.maxWords})`); }
        if (!Array.isArray(k.checklistRo) || k.checklistRo.length < 5 || !k.checklistRo.every(str)) err(f, `writing.tasks[${i}]: needs >=5 checklistRo`);
        if (!Array.isArray(k.usefulPhrases) || k.usefulPhrases.length < 5 || !k.usefulPhrases.every((p) => str(p.en) && str(p.ro))) err(f, `writing.tasks[${i}]: needs >=5 usefulPhrases {en, ro}`);
      });
      const sp = t.speaking;
      if (!sp || !Number.isInteger(sp.minutes) || !Array.isArray(sp.tasks) || sp.tasks.length !== shape.speaking) err(f, `speaking: needs minutes + ${shape.speaking} tasks`);
      else sp.tasks.forEach((k, i) => {
        for (const key of ['title', 'infoRo', 'model']) if (!str(k[key])) err(f, `speaking.tasks[${i}]: missing ${key}`);
        if (!Array.isArray(k.prompts) || k.prompts.length < 1 || !k.prompts.every(str)) err(f, `speaking.tasks[${i}]: needs prompts[]`);
        if (!Array.isArray(k.usefulPhrases) || k.usefulPhrases.length < 5 || !k.usefulPhrases.every((p) => str(p.en) && str(p.ro))) err(f, `speaking.tasks[${i}]: needs >=5 usefulPhrases {en, ro}`);
      });
    } catch (e) { err(f, `crashed while checking: ${e.message}`); }
  }
}
console.log(`\n${errors} error(s), ${warnings} warning(s)`);
process.exit(errors ? 1 : 0);
