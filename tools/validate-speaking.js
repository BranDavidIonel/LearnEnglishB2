// Validates speaking content. Usage: node tools/validate-speaking.js [a1|a2|b1|b2]
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'data');
const levels = process.argv[2] ? [process.argv[2].toLowerCase()] : ['a1', 'a2', 'b1', 'b2'];
const SAMPLE_LEN = { A1: [6, 24], A2: [12, 34], B1: [20, 50], B2: [35, 80] };
let errors = 0, warnings = 0;
const err = (f, m) => { errors++; console.log(`  ERROR ${f}: ${m}`); };
const warn = (f, m) => { warnings++; console.log(`  warn  ${f}: ${m}`); };
const str = (v) => typeof v === 'string' && v.trim().length > 0;
const words = (s) => String(s).trim().split(/\s+/).filter(Boolean).length;

// same normalisation the app uses when it compares speech with the model answers
const CONTR = [
  [/\bcan't\b/g, 'can not'], [/\bcannot\b/g, 'can not'], [/\bwon't\b/g, 'will not'], [/\bshan't\b/g, 'shall not'],
  [/n't\b/g, ' not'], [/\bi'm\b/g, 'i am'], [/'re\b/g, ' are'], [/'ve\b/g, ' have'], [/'ll\b/g, ' will'],
  [/\b(he|she|it|that|there|what|where|who|how|here)'s\b/g, '$1 is'], [/\blet's\b/g, 'let us'],
];
function norm(s) {
  let t = String(s).toLowerCase().replace(/[’‘`´]/g, "'").replace(/[“”"]/g, '');
  t = t.replace(/[.,!?;:()…]/g, ' ').replace(/\s+-\s+|—|–/g, ' ').replace(/\s+/g, ' ').trim();
  for (const [re, to] of CONTR) t = t.replace(re, to);
  return t.replace(/\s+/g, ' ').trim();
}

for (const lvl of levels) {
  console.log(`\n== ${lvl.toUpperCase()} ==`);
  const f = `${lvl}/speaking.json`;
  const p = path.join(ROOT, lvl, 'speaking.json');
  if (!fs.existsSync(p)) { err(f, 'file missing'); continue; }
  let d;
  try { d = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { err(f, `invalid JSON: ${e.message}`); continue; }
  const L = lvl.toUpperCase();
  try {
    if (d.level !== L) err(f, `level must be "${L}"`);

    if (!Array.isArray(d.scenarios) || d.scenarios.length !== 8) err(f, `needs exactly 8 scenarios (has ${d.scenarios ? d.scenarios.length : 0})`);
    (d.scenarios || []).forEach((s, si) => {
      const w = `scenarios[${si}]`;
      const id = `${lvl}-s${String(si + 1).padStart(2, '0')}`;
      if (s.id !== id) err(f, `${w}: id must be "${id}"`);
      for (const k of ['emoji', 'title', 'titleRo', 'youRo', 'partner']) if (!str(s[k])) err(f, `${w}: missing ${k}`);
      if (s.closing !== undefined && !str(s.closing)) err(f, `${w}: empty closing`);
      if (!Array.isArray(s.turns) || s.turns.length < 6 || s.turns.length > 8) return err(f, `${w}: needs 6-8 turns (has ${s.turns ? s.turns.length : 0})`);
      s.turns.forEach((t, ti) => {
        const tw = `${w}.turns[${ti}]`;
        for (const k of ['say', 'sayRo', 'hintRo']) if (!str(t[k])) err(f, `${tw}: missing ${k}`);
        if (!Array.isArray(t.answers) || t.answers.length < 2 || t.answers.length > 4 || !t.answers.every(str)) return err(f, `${tw}: needs 2-4 answers`);
        t.answers.forEach((a) => { const n = words(a); if (n < 1 || n > 16) warn(f, `${tw}: answer has ${n} words: "${a}"`); if (/\d/.test(a)) warn(f, `${tw}: digits in a spoken answer: "${a}"`); });
        if (new Set(t.answers.map(norm)).size !== t.answers.length) err(f, `${tw}: duplicate answers`);
        if (!Array.isArray(t.keywords) || t.keywords.length < 1 || t.keywords.length > 3 || !t.keywords.every(str)) return err(f, `${tw}: needs 1-3 keywords`);
        for (const k of t.keywords) {
          if (k !== k.toLowerCase()) err(f, `${tw}: keyword must be lowercase: "${k}"`);
          for (const a of t.answers) if (!` ${norm(a)} `.includes(` ${norm(k)} `)) err(f, `${tw}: keyword "${k}" is missing from answer "${a}"`);
        }
      });
    });

    const seen = new Set();
    if (!Array.isArray(d.phrases) || d.phrases.length !== 6) err(f, `needs exactly 6 phrase topics (has ${d.phrases ? d.phrases.length : 0})`);
    (d.phrases || []).forEach((t, ti) => {
      const w = `phrases[${ti}]`;
      for (const k of ['topic', 'topicRo', 'emoji']) if (!str(t[k])) err(f, `${w}: missing ${k}`);
      if (!Array.isArray(t.items) || t.items.length !== 10) return err(f, `${w}: needs exactly 10 items (has ${t.items ? t.items.length : 0})`);
      t.items.forEach((it, ii) => {
        if (!str(it.en) || !str(it.ro)) return err(f, `${w}.items[${ii}]: needs en + ro`);
        const n = words(it.en);
        if (n < 2 || n > 13) warn(f, `${w}.items[${ii}]: ${n} words: "${it.en}"`);
        if (/\d/.test(it.en)) warn(f, `${w}.items[${ii}]: digits in a spoken phrase: "${it.en}"`);
        const key = norm(it.en);
        if (seen.has(key)) err(f, `${w}.items[${ii}]: phrase repeated: "${it.en}"`); else seen.add(key);
      });
    });

    if (!Array.isArray(d.questions) || d.questions.length !== 12) err(f, `needs exactly 12 questions (has ${d.questions ? d.questions.length : 0})`);
    (d.questions || []).forEach((q, qi) => {
      const w = `questions[${qi}]`;
      for (const k of ['q', 'qRo', 'sample']) if (!str(q[k])) err(f, `${w}: missing ${k}`);
      if (!Array.isArray(q.starters) || q.starters.length < 2 || q.starters.length > 3 || !q.starters.every(str)) err(f, `${w}: needs 2-3 starters`);
      if (str(q.sample)) { const n = words(q.sample), [lo, hi] = SAMPLE_LEN[L]; if (n < lo || n > hi) warn(f, `${w}: sample has ${n} words (expected ${lo}-${hi})`); }
    });
  } catch (e) { err(f, `crashed while checking: ${e.message}`); }
}
console.log(`\n${errors} error(s), ${warnings} warning(s)`);
process.exit(errors ? 1 : 0);
