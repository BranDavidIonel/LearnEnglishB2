// Course content + learner progress + all the "rules" (unlocking, XP, spaced repetition).
import { today, dayNum, addDays, speechCfg, soundCfg, sample } from './util.js';
import { L } from './i18n.js';

export const LEVEL_INFO = {
  a1: { name: 'A1', title: L('Începător', 'Beginner'), color: '#22c55e', desc: L('Primele propoziții: te prezinți, vorbești despre tine, rutină, mâncare, oraș.', 'Your first sentences: introducing yourself, your routine, food, the city.') },
  a2: { name: 'A2', title: L('Elementar', 'Elementary'), color: '#38bdf8', desc: L('Trecut și viitor simplu, cumpărături, planuri, primele discuții cu clienți.', 'Simple past and future, shopping, plans, your first conversations with clients.') },
  b1: { name: 'B1', title: L('Intermediar', 'Intermediate'), color: '#a78bfa', desc: L('Te descurci la muncă și în călătorii: proiecte, interviuri, emailuri, povești.', 'Getting by at work and on trips: projects, interviews, emails, stories.') },
  b2: { name: 'B2', title: L('Intermediar avansat', 'Upper intermediate'), color: '#fb923c', desc: L('Engleză fluentă pentru carieră: negociere, prezentări, propuneri, idiomuri.', 'Fluent English for your career: negotiating, presenting, proposals, idioms.') },
};
/** Colour themes: id, name, and the three colours shown on the theme picker. */
export const THEMES = [
  { id: 'dark', name: L('Întunecată', 'Dark'), swatch: ['#0b1020', '#151c36', '#6366f1'] },
  { id: 'slate', name: L('Gri (mai blândă)', 'Slate (softer)'), swatch: ['#1b1e26', '#272c38', '#7c83f5'] },
  { id: 'light', name: L('Luminoasă', 'Light'), swatch: ['#f6f7fb', '#ffffff', '#4f46e5'] },
  { id: 'sepia', name: L('Sepia (caldă)', 'Sepia (warm)'), swatch: ['#f3ead6', '#fbf5e6', '#a0521d'] },
];
export const PASS = 0.8;            // 80% to pass a unit test or a level exam
export const PLACEMENT_PASS = 0.75; // 75% in the placement test = level considered known
export const STEPS = ['vocab', 'grammar', 'dialogue', 'practice', 'reading'];
const INTERVALS = [0, 1, 3, 7, 14, 30, 60]; // days until next review, by box
export const LEARNED_BOX = 3;

export const S = { levels: [], unitById: {}, wordIndex: {}, p: null, serverOld: false };
/** The server version these pages need (see API in server.js). */
const API_NEEDED = 3;

const fresh = () => ({
  v: 1, xp: 0, goal: 50, streak: { count: 0, last: null }, days: {},
  placement: null, units: {}, exams: {}, words: {}, mistakes: [], games: {},
  settings: { theme: 'dark', rate: 0.9, voice: null, sound: true },
});

export async function load() {
  const [c, p] = await Promise.all([
    fetch('/api/content').then((r) => r.json()),
    fetch('/api/progress').then((r) => r.json()).catch(() => ({})),
  ]);
  S.levels = c.levels;
  S.serverOld = (c.api || 1) < API_NEEDED; // the server was started before the last update
  S.cambridge = c.cambridge || [];
  S.unitById = {}; S.wordIndex = {};
  S.levels.forEach((lv, li) => {
    lv.index = li; Object.assign(lv, LEVEL_INFO[lv.id]);
    lv.units.forEach((u, ui) => {
      u.levelId = lv.id; u.index = ui; S.unitById[u.id] = u;
      u.bank = u.bank || [];
      u.vocab.forEach((w) => { if (!S.wordIndex[w.en]) S.wordIndex[w.en] = { ...w, unit: u.id, levelId: lv.id }; });
      u.bank.forEach((w) => { if (!S.wordIndex[w.en]) S.wordIndex[w.en] = { ...w, unit: u.id, levelId: lv.id, bank: true }; });
    });
  });
  let saved = p && p.v ? p : null;
  if (!saved) { try { saved = JSON.parse(localStorage.getItem('el-progress') || 'null'); } catch { saved = null; } }
  S.p = Object.assign(fresh(), saved || {});
  S.p.settings = Object.assign(fresh().settings, S.p.settings || {});
  applySettings();
  if (saved) snapshot(); // keeps today's point on the chart current (not written until the next save)
}

export function applySettings() {
  const s = S.p.settings;
  if (!THEMES.some((t) => t.id === s.theme)) s.theme = 'dark';
  document.documentElement.dataset.theme = s.theme;
  try { localStorage.setItem('el-theme', s.theme); } catch { /* ignore */ } // lets the page start in the right theme
  speechCfg.rate = s.rate; speechCfg.voice = s.voice; soundCfg.on = s.sound;
}

/** One snapshot per day of the numbers shown on the progress chart (today's entry is overwritten). */
export function snapshot() {
  if (!S.levels.length || !S.p) return;
  const hist = S.p.history || (S.p.history = {});
  const pc = (id) => (level(id) ? Math.round(progressTo(id) * 1000) / 10 : 0);
  hist[today()] = { xp: S.p.xp, w: wordCounts().learned, b1: pc('b1'), b2: pc('b2') };
}

let saveTimer;
export function save() {
  snapshot();
  try { localStorage.setItem('el-progress', JSON.stringify(S.p)); } catch { /* ignore */ }
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fetch('/api/progress', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(S.p) }).catch(() => {});
  }, 400);
  window.dispatchEvent(new Event('progress'));
}
export function resetAll() { S.p = fresh(); applySettings(); save(); }

// ---- XP & streak ----
export function addXp(n) {
  if (!n) return;
  const p = S.p, t = today();
  p.xp += n; p.days[t] = (p.days[t] || 0) + n;
  if (p.streak.last !== t) {
    p.streak.count = p.streak.last === today(addDays(-1)) ? p.streak.count + 1 : 1;
    p.streak.last = t;
  }
  save();
}
export const xpToday = () => S.p.days[today()] || 0;
export function streak() {
  const s = S.p.streak;
  return (s.last === today() || s.last === today(addDays(-1))) ? s.count : 0;
}

// ---- units / levels ----
export const level = (id) => S.levels.find((l) => l.id === id);
export const unitState = (id) => S.p.units[id] || (S.p.units[id] = { steps: {}, best: 0, passed: false, review: false, tries: 0 });
const peek = (id) => S.p.units[id] || { steps: {}, best: 0, passed: false, review: false, tries: 0 };

/** Index of the level the placement test put the learner in (levels below are "known"). */
export const startIndex = () => (S.p.placement ? S.p.placement.start : 0);
export const levelSkipped = (lv) => lv.index < startIndex() && !(S.p.exams[lv.id] && S.p.exams[lv.id].passed);
export const levelPassed = (lv) => !!(S.p.exams[lv.id] && S.p.exams[lv.id].passed);
export const levelDone = (lv) => levelPassed(lv) || levelSkipped(lv);
export function levelUnlocked(lv) {
  if (lv.index === 0 || lv.index <= startIndex()) return true;
  return levelDone(S.levels[lv.index - 1]);
}
export function unitUnlocked(u) {
  const lv = level(u.levelId);
  if (!levelUnlocked(lv)) return false;
  if (u.index === 0 || levelDone(lv)) return true;
  const st = peek(u.id);
  if (st.passed || st.review) return true;
  return peek(lv.units[u.index - 1].id).passed;
}
export function unitProgress(u) {
  const st = peek(u.id);
  if (st.passed && !st.review) return 1;
  return (STEPS.filter((s) => st.steps[s]).length / STEPS.length) * 0.8;
}
export function levelProgress(lv) {
  if (levelDone(lv)) return 1;
  if (!lv.units.length) return 0;
  return 0.9 * lv.units.reduce((a, u) => a + unitProgress(u), 0) / lv.units.length;
}
/** How far the learner is on the road to finishing level `id` (0..1), counting all levels before it. */
export function progressTo(id) {
  const idx = S.levels.findIndex((l) => l.id === id);
  const ls = S.levels.slice(0, idx + 1);
  return ls.reduce((a, l) => a + levelProgress(l), 0) / ls.length;
}
/** The level the learner is working on now. */
export function currentLevel() {
  return S.levels.find((l) => !levelDone(l) && l.units.length) || S.levels[S.levels.length - 1];
}
/** Highest finished level name, or null. */
export function achieved() {
  let best = null;
  for (const l of S.levels) { if (levelDone(l)) best = l; else break; }
  return best;
}
export function reviewUnits(lv) { return lv.units.filter((u) => peek(u.id).review); }
/** What to do next: { kind:'placement'|'unit'|'exam'|'done', unit, step, level } */
export function nextAction() {
  const lv = currentLevel();
  if (!lv || !lv.units.length) return { kind: 'done' };
  if (levelDone(lv)) return { kind: 'done', level: lv };
  const rev = reviewUnits(lv);
  if (rev.length) return { kind: 'unit', unit: rev[0], step: 'test', level: lv, review: true };
  for (const u of lv.units) {
    const st = peek(u.id);
    if (st.passed) continue;
    const step = STEPS.find((s) => !st.steps[s]) || 'test';
    return { kind: 'unit', unit: u, step, level: lv };
  }
  return { kind: 'exam', level: lv };
}

export function completeStep(u, step, xp = 10) {
  const st = unitState(u.id);
  const first = !st.steps[step];
  st.steps[step] = true;
  if (step === 'vocab') addWords(u);
  if (first && xp) addXp(xp); else save();
  return first;
}
export function recordUnitTest(u, score) {
  const st = unitState(u.id);
  st.tries++; st.best = Math.max(st.best, score);
  const passed = score >= PASS;
  if (passed) { const first = !st.passed; st.passed = true; st.review = false; addXp(first ? 30 : 10); }
  save();
  return passed;
}

// ---- exams ----
export function buildExam(lv) {
  const items = [];
  for (const u of lv.units) {
    const pool = u.exercises.map((ex, i) => ({ ex, unit: u.id, key: `${u.id}:${i}` })).filter((x) => x.ex.type !== 'match');
    items.push(...sample(pool, 3));
  }
  return items;
}
/** results: [{unit, correct}] → stores the exam, flags weak units for review. */
export function recordExam(lv, results) {
  const score = results.filter((r) => r.correct).length / results.length;
  const byUnit = {};
  results.forEach((r) => { const b = byUnit[r.unit] || (byUnit[r.unit] = { ok: 0, n: 0 }); b.n++; if (r.correct) b.ok++; });
  const e = S.p.exams[lv.id] || (S.p.exams[lv.id] = { best: 0, passed: false, tries: 0 });
  e.tries++; e.best = Math.max(e.best, score); e.last = today();
  const passed = score >= PASS;
  const weak = [];
  for (const u of lv.units) {
    const b = byUnit[u.id];
    if (b && b.ok / b.n < 0.6) { weak.push(u); if (!passed) unitState(u.id).review = true; }
  }
  if (passed) { const first = !e.passed; e.passed = true; lv.units.forEach((u) => { unitState(u.id).review = false; }); addXp(first ? 150 : 20); }
  save();
  return { score, passed, weak, byUnit };
}

// ---- placement ----
export function recordPlacement(scores) {
  // scores: { a1: 0.83, a2: 0.4 } → start = first level below the pass mark
  let start = 0;
  for (const lv of S.levels) { if ((scores[lv.id] ?? 0) >= PLACEMENT_PASS) start = lv.index + 1; else break; }
  start = Math.min(start, S.levels.length - 1);
  S.p.placement = { start, scores, date: today() };
  addXp(20);
  return start;
}

// ---- vocabulary / spaced repetition ----
export function addWords(u) {
  const d = dayNum();
  for (const w of u.vocab) if (!S.p.words[w.en]) S.p.words[w.en] = { box: 0, due: d, ok: 0, bad: 0 };
}
export function wordStatus(en) {
  const w = S.p.words[en];
  if (!w) return 'new';
  return w.box >= LEARNED_BOX ? 'learned' : 'learning';
}
export function dueWords() {
  const d = dayNum();
  return Object.entries(S.p.words).filter(([en, w]) => w.due <= d && S.wordIndex[en]).sort((a, b) => a[1].due - b[1].due).map(([en]) => S.wordIndex[en]);
}
/** grade: 0 = didn't know, 1 = hard, 2 = knew it */
export function gradeWord(en, grade) {
  const w = S.p.words[en] || (S.p.words[en] = { box: 0, due: dayNum(), ok: 0, bad: 0 });
  if (grade === 0) { w.box = 0; w.bad++; w.due = dayNum(); }
  else if (grade === 1) { w.box = Math.max(1, w.box); w.due = dayNum() + 1; w.ok++; }
  else { w.box = Math.min(w.box + 1, INTERVALS.length - 1); w.due = dayNum() + INTERVALS[w.box]; w.ok++; }
  save();
}
/** "I already know this word": counts as learned and comes back for a check only after two months. */
export function markKnown(en) {
  S.p.words[en] = { box: INTERVALS.length - 1, due: dayNum() + INTERVALS[INTERVALS.length - 1], ok: 0, bad: 0, known: true };
}
/** Puts a word into the flashcard deck as something to learn (or to learn again). */
export function learnWord(en) {
  S.p.words[en] = { box: 0, due: dayNum(), ok: 0, bad: 0 };
}
/** Takes a word out of the deck: it goes back to "to learn". */
export function forgetWord(en) { delete S.p.words[en]; }
/** Words of the levels the placement test skipped that are still marked "to learn". */
export function skippedLevelWords() {
  return Object.values(S.wordIndex).filter((w) => level(w.levelId).index < startIndex() && !S.p.words[w.en]);
}

/** "I knew it" in a quick sort: counts as learned and comes back on the flashcards in a week, as a check. */
export function sortedKnown(en) {
  S.p.words[en] = { box: LEARNED_BOX, due: dayNum() + INTERVALS[LEARNED_BOX], ok: 1, bad: 0, known: true };
}

export function wordCounts() {
  return countWords(Object.values(S.wordIndex));
}
/** { learned, learning, new, total } for a list of words. */
export function countWords(ws) {
  const c = { learned: 0, learning: 0, new: 0, total: ws.length };
  for (const w of ws) c[wordStatus(w.en)]++;
  return c;
}
const uniq = (ws) => [...new Map(ws.map((w) => [w.en, w])).values()];
/** The extra words of a unit (its "word bank"). */
export const bankWords = (u) => u.bank.map((w) => S.wordIndex[w.en]).filter(Boolean);
/** Every word a unit teaches: its core words first, then its word bank. */
export const unitWords = (u) => uniq([...u.vocab, ...u.bank].map((w) => S.wordIndex[w.en]).filter(Boolean));
/** Every word of a level, in course order. */
export const levelWords = (lv) => uniq(lv.units.flatMap(unitWords));
/** The vocabulary of level `id` and of all the levels before it — what "knowing B1 words" means. */
export function vocabTo(id) {
  const idx = S.levels.findIndex((l) => l.id === id);
  return countWords(uniq(S.levels.slice(0, idx + 1).flatMap(levelWords)));
}
/** Words still "to learn" from the units the learner can open, in course order. */
export function wordsToLearn(lv) {
  return uniq(lv.units.filter(unitUnlocked).flatMap(unitWords)).filter((w) => wordStatus(w.en) === 'new');
}
/** The first level (up to the current one) that still has words to learn in its open units. */
export function nextWordsLevel() {
  const cur = currentLevel();
  return S.levels.slice(0, (cur ? cur.index : 0) + 1).find((lv) => wordsToLearn(lv).length) || null;
}
/** Words the learner has met (or, if too few, words from open units) — used by games. */
export function knownWords(min = 8) {
  let ws = Object.keys(S.p.words).map((en) => S.wordIndex[en]).filter(Boolean);
  if (ws.length < min) {
    const lv = currentLevel();
    ws = lv ? lv.units.slice(0, 3).flatMap((u) => u.vocab.map((w) => S.wordIndex[w.en])) : [];
  }
  return ws;
}

// ---- mistakes ----
export function addMistake(key) { if (key && !S.p.mistakes.includes(key)) { S.p.mistakes.push(key); if (S.p.mistakes.length > 200) S.p.mistakes.shift(); } }
export function clearMistake(key) { const i = S.p.mistakes.indexOf(key); if (i >= 0) S.p.mistakes.splice(i, 1); }
export function mistakeItems() {
  return S.p.mistakes.map((key) => {
    const [uid, idx] = key.split(':');
    const u = S.unitById[uid];
    if (!u) return null;
    const ex = idx[0] === 'r' ? u.reading.questions[Number(idx.slice(1))] : u.exercises[Number(idx)];
    if (!ex || idx[0] === 'r') return null; // reading questions need their text; skip them here
    return { ex, unit: uid, key };
  }).filter(Boolean);
}

// ---- Cambridge mock exams ----
export const CAM_TARGET = 0.7; // safe target in a mock (the real pass mark is roughly 60-65%)
export const PAPERS = ['reading', 'listening', 'writing', 'speaking'];
export function camState(examId, testId) {
  const c = S.p.cambridge || (S.p.cambridge = {});
  const e = c[examId] || (c[examId] = {});
  return e[testId] || (e[testId] = {});
}
export function recordCam(examId, testId, paper, data) {
  camState(examId, testId)[paper] = { ...data, date: today() };
  addXp(paper === 'reading' || paper === 'listening' ? 40 : 20);
}
/** Readiness for an exam: latest result per paper + how much of the course is done. */
export function camReadiness(exam) {
  const all = (S.p.cambridge || {})[exam.id] || {};
  const latest = {};
  for (const paper of PAPERS) {
    for (const t of Object.values(all)) {
      const r = t[paper];
      if (r && (!latest[paper] || r.date >= latest[paper].date)) latest[paper] = r;
    }
  }
  const course = progressTo(exam.level.toLowerCase());
  const auto = ['reading', 'listening'].map((k) => latest[k]).filter(Boolean);
  const scores = PAPERS.map((k) => latest[k]).filter(Boolean).map((r) => r.score);
  const overall = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
  let verdict = 'unknown';
  if (auto.length) {
    const minAuto = Math.min(...auto.map((r) => r.score));
    if (auto.length === 2 && scores.length === 4 && minAuto >= CAM_TARGET && overall >= CAM_TARGET) verdict = 'ready';
    else if (overall >= 0.6) verdict = 'close';
    else verdict = 'notyet';
  }
  return { latest, course, overall, verdict, done: scores.length };
}

// ---- speaking practice ----
/** { said: sentences spoken well, scen: { id: best score 0..1 }, best: { game: record } } */
export function speakState() {
  const s = S.p.speak || (S.p.speak = {});
  s.said = s.said || 0; s.scen = s.scen || {}; s.best = s.best || {};
  return s;
}
/** Counts a sentence that was said well enough. */
export function countSpoken(n = 1, xp = 2) { speakState().said += n; addXp(n * xp); }
/** Stores the result of a conversation / role-play; returns true when it is a first completion. */
export function recordConversation(id, score) {
  const s = speakState();
  const first = !(id in s.scen);
  s.scen[id] = Math.max(s.scen[id] || 0, score);
  addXp(first ? 15 : 5);
  return first;
}
/** Keeps the best result of a speaking game; returns true for a new record. */
export function speakRecord(game, value) {
  const s = speakState();
  const rec = !s.best[game] || value > s.best[game];
  if (rec) s.best[game] = value;
  save();
  return rec;
}

// ---- badges ----
export function badges() {
  const p = S.p, wc = wordCounts();
  const passedUnits = Object.values(p.units).filter((u) => u.passed).length;
  const lvPassed = (id) => { const l = level(id); return !!(l && levelDone(l)); };
  const said = (p.speak && p.speak.said) || 0;
  const talks = Object.keys((p.speak && p.speak.scen) || {}).length;
  return [
    { icon: '🚀', name: L('Primul pas', 'First step'), desc: L('Câștigă primele puncte XP', 'Earn your first XP'), ok: p.xp > 0 },
    { icon: '🧭', name: L('Știu de unde pornesc', 'I know where I start'), desc: L('Fă testul de nivel', 'Take the placement test'), ok: !!p.placement },
    { icon: '📗', name: L('Prima unitate', 'First unit'), desc: L('Treci testul unei unități', 'Pass a unit test'), ok: passedUnits >= 1 },
    { icon: '📚', name: L('Zece unități', 'Ten units'), desc: L('Treci 10 unități', 'Pass 10 units'), ok: passedUnits >= 10 },
    { icon: '🗣️', name: L('Prima conversație', 'First conversation'), desc: L('Termină o conversație la „Vorbire”', 'Finish a conversation in Speaking'), ok: talks >= 1 },
    { icon: '🎙️', name: L('100 de propoziții', '100 sentences'), desc: L('Rostește corect 100 de propoziții', 'Say 100 sentences correctly'), ok: said >= 100 },
    { icon: '🔥', name: L('3 zile la rând', '3 days in a row'), desc: L('Învață 3 zile consecutive', 'Study 3 days in a row'), ok: p.streak.count >= 3 },
    { icon: '⚡', name: L('O săptămână', 'One week'), desc: L('Învață 7 zile consecutive', 'Study 7 days in a row'), ok: p.streak.count >= 7 },
    { icon: '🏅', name: L('O lună', 'One month'), desc: L('Învață 30 de zile consecutive', 'Study 30 days in a row'), ok: p.streak.count >= 30 },
    { icon: '🗂️', name: L('50 de cuvinte', '50 words'), desc: L('Învață 50 de cuvinte', 'Learn 50 words'), ok: wc.learned >= 50 },
    { icon: '🧠', name: L('200 de cuvinte', '200 words'), desc: L('Învață 200 de cuvinte', 'Learn 200 words'), ok: wc.learned >= 200 },
    { icon: '📘', name: L('500 de cuvinte', '500 words'), desc: L('Vocabular de nivel A1', 'An A1-sized vocabulary'), ok: wc.learned >= 500 },
    { icon: '📙', name: L('1000 de cuvinte', '1000 words'), desc: L('Vocabular de nivel A2', 'An A2-sized vocabulary'), ok: wc.learned >= 1000 },
    { icon: '📕', name: L('2000 de cuvinte', '2000 words'), desc: L('Vocabular de nivel B1', 'A B1-sized vocabulary'), ok: wc.learned >= 2000 },
    { icon: '📚', name: L('3000 de cuvinte', '3000 words'), desc: L('Vocabular de nivel B2', 'A B2-sized vocabulary'), ok: wc.learned >= 3000 },
    { icon: '💎', name: '1000 XP', desc: L('Strânge 1000 de puncte', 'Collect 1000 XP'), ok: p.xp >= 1000 },
    { icon: '🥉', name: L('Nivel A1', 'Level A1'), desc: L('Termină nivelul A1', 'Finish level A1'), ok: lvPassed('a1') },
    { icon: '🥈', name: L('Nivel A2', 'Level A2'), desc: L('Termină nivelul A2', 'Finish level A2'), ok: lvPassed('a2') },
    { icon: '🥇', name: L('Nivel B1', 'Level B1'), desc: L('Termină nivelul B1', 'Finish level B1'), ok: lvPassed('b1') },
    { icon: '🏆', name: L('Nivel B2', 'Level B2'), desc: L('Termină nivelul B2', 'Finish level B2'), ok: lvPassed('b2') },
  ];
}
