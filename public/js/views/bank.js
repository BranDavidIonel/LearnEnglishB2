// Word bank: the extra words of each unit, and the quick sort ("I knew it" / "new for me") that moves words into the flashcards.
import { h, speak, stopSpeak, speakBtn, picture, shuffle, sfx, confetti } from '../util.js';
import {
  save, level, addXp, wordStatus, learnWord, gradeWord, sortedKnown, bankWords, countWords, levelWords, wordsToLearn,
  levelUnlocked, levelDone,
} from '../store.js';
import { runSession } from '../exercise.js';
import { header, btn, bar, chip, empty } from '../ui.js';
import { wordRow } from './wordlist.js';
import { L, plural } from '../i18n.js';

export const BATCH = 20;
const nWords = (n) => `${n} ${plural(n, L('cuvânt', 'word'), L('cuvinte', 'words'))}`;

/** Four meanings to choose from: the right one and three others, preferably of the same part of speech. */
function meaningOptions(w, pool) {
  const same = pool.filter((x) => x.pos === w.pos);
  const src = shuffle(same.length >= 8 ? same : pool);
  const seen = new Set([w.ro]);
  const others = [];
  for (const x of src) {
    if (seen.has(x.ro)) continue;
    seen.add(x.ro); others.push(x.ro);
    if (others.length === 3) break;
  }
  return shuffle([w.ro, ...others]);
}

/**
 * Quick sort of a batch of words. Each card shows the English word; you think of the meaning, turn the card,
 * then say "I knew it" (it counts as learned and comes back on the flashcards in a week, as a check)
 * or "New for me" (it goes into the flashcards). The new ones then get a short "what does it mean?" round.
 * opts: { title, onExit(), actions() → buttons shown at the end }. Returns a stop function.
 */
export function sortSession(box, words, opts = {}) {
  const known = [], fresh = [];
  let i = 0, shown = false, stopQuiz = null, ended = false;
  const progress = h('div.bar', h('div.bar-fill'));
  const counter = h('span.sess-count');
  const stage = h('div.fc-stage');
  const buttons = h('div.fc-buttons');

  const onKey = (e) => {
    if (!shown && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); reveal(); }
    else if (shown && e.key === '1') answer(true);
    else if (shown && e.key === '2') answer(false);
  };
  document.addEventListener('keydown', onKey);
  const stopKeys = () => { document.removeEventListener('keydown', onKey); stopSpeak(); };

  function reveal() {
    if (shown || i >= words.length) return;
    shown = true; sfx('flip');
    stage.querySelector('.fc').classList.add('flipped');
    buttons.replaceChildren(
      h('button.btn.success.big', { onclick: () => answer(true) }, L('✓ Știam', '✓ I knew it'), h('small', '1')),
      h('button.btn.warn.big', { onclick: () => answer(false) }, L('🧠 Nou pentru mine', '🧠 New for me'), h('small', '2')));
  }

  function answer(knew) {
    if (!shown) return;
    const w = words[i];
    if (knew) { sortedKnown(w.en); known.push(w); } else { learnWord(w.en); fresh.push(w); }
    save();
    i++; show();
  }

  function show() {
    progress.firstChild.style.width = `${(i / words.length) * 100}%`;
    if (i >= words.length) { stopKeys(); return quiz(); }
    counter.textContent = `${i + 1} / ${words.length}`;
    const w = words[i];
    shown = false;
    const front = h('div.fc-face.fc-front', picture(w), h('div.fc-word', w.en, ' ', speakBtn(w.en)), h('div.vipa', w.ipa, ' · ', h('em', w.pos)),
      h('div.fc-hint.mt', L('Ce înseamnă? Gândește-te, apoi întoarce cartonașul.', 'What does it mean? Think, then turn the card.')));
    const back = h('div.fc-face.fc-back', h('div.fc-word', w.ro), h('div.muted', w.en, ' ', speakBtn(w.en)),
      h('div.vex', speakBtn(w.ex), h('div', h('div.en', w.ex), h('div.ro', w.exRo))));
    stage.replaceChildren(h('div.fc.fade-in', { onclick: reveal }, front, back));
    buttons.replaceChildren(h('button.btn.primary.big', { onclick: reveal }, L('Arată traducerea (Space)', 'Show the meaning (Space)')));
    speak(w.en);
  }

  // the words that were new get one "what does it mean?" question each
  function quiz() {
    if (!fresh.length) return finish(0);
    const pool = levelWords(level(fresh[0].levelId));
    const items = shuffle(fresh).map((w) => {
      const options = meaningOptions(w, pool.filter((x) => x.en !== w.en));
      return { key: w.en, ex: { type: 'mc', q: L(`Ce înseamnă **${w.en}**?`, `What does **${w.en}** mean?`), options, answer: options.indexOf(w.ro), explainRo: `**${w.en}** = ${w.ro}. ${w.ex}` } };
    });
    stopQuiz = runSession(box, items, {
      mode: 'practice', title: L('Cuvintele noi: îți amintești ce înseamnă?', 'The new words: do you remember what they mean?'),
      onExit: () => finish(0),
      onFinish: (res) => {
        const ok = res.filter((r) => r.correct);
        ok.forEach((r) => gradeWord(r.key, 2)); // right first time: next review tomorrow; wrong: it stays for today
        finish(ok.length, true);
      },
    });
  }

  function finish(ok, quizDone = false) {
    if (ended) return;
    ended = true;
    stopKeys();
    const xp = known.length + ok * 3;
    addXp(xp);
    if (!known.length && !fresh.length) return opts.onExit && opts.onExit();
    if (fresh.length + known.length >= 10) { confetti(1200); sfx('win'); }
    box.replaceChildren(empty('🗂️', L('Gata cu porția asta!', 'Batch done!'),
      [known.length ? L(`✓ ${nWords(known.length)} știute — le mai verifici o dată la cartonașe, peste o săptămână.`, `✓ ${nWords(known.length)} you knew — ${plural(known.length, 'it comes', 'they come')} back once on the flashcards in a week, as a check.`) : '',
        fresh.length ? L(`🧠 ${nWords(fresh.length)} noi au intrat la cartonașe${quizDone ? ` (${ok} recunoscute din prima)` : ''}.`, `🧠 ${fresh.length} new ${plural(fresh.length, 'word', 'words')} went into your flashcards${quizDone ? ` (${ok} right first time)` : ''}.`) : '',
        xp ? `+${xp} XP ⚡` : ''].filter(Boolean).join(' · '),
      opts.actions ? opts.actions() : []));
  }

  box.replaceChildren(h('div.session',
    h('div.sess-top', h('button.icon-btn', { title: L('Ieși', 'Exit'), onclick: () => finish(0) }, '✕'), progress, counter),
    opts.title ? h('div.sess-title', opts.title) : null,
    stage, buttons));
  show();
  return () => { stopKeys(); if (stopQuiz) stopQuiz(); };
}

/** Summary card: how many of these words you know. */
function statsCard(ws, color) {
  const c = countWords(ws);
  return h('div.card',
    h('div.row.between', h('span', L('Învățate', 'Learned')), h('strong', `${c.learned} / ${c.total}`)),
    bar(c.total ? c.learned / c.total : 0, color),
    h('p.muted.small', L(`${c.learning} în curs de învățare · ${c.new} de învățat`, `${c.learning} being learned · ${c.new} to learn`)));
}

// ---------- the word bank of one unit (#/unit/<id>/bank) ----------
export function bankStep(box, u, lv) {
  let stop = null;
  const draw = () => {
    if (stop) { stop(); stop = null; }
    stopSpeak();
    const ws = bankWords(u);
    if (!ws.length) return box.replaceChildren(empty('📚', L('Banca de cuvinte nu e încă disponibilă', 'The word bank is not available yet'), L('Repornește serverul (Start.bat) și reîncarcă pagina.', 'Restart the server (Start.bat) and reload the page.')));
    const todo = ws.filter((w) => wordStatus(w.en) === 'new');
    const n = Math.min(BATCH, todo.length);
    box.replaceChildren(
      h('h2.center', L('📚 Banca de cuvinte', '📚 Word bank')),
      h('p.muted.center', L(`Încă ${nWords(ws.length)} uzuale de nivel ${lv.name}, pe lângă cele ${u.vocab.length} de la „Cuvinte noi”. Le parcurgi câte ${BATCH}: spui dacă le știai, iar cele noi intră la cartonașe.`,
        `${nWords(ws.length)} in common use at ${lv.name} level, on top of the ${u.vocab.length} in “New words”. Go through them ${BATCH} at a time: say whether you knew each one, and the new ones go into your flashcards.`)),
      statsCard(ws, lv.color),
      h('div.row.center.wrap',
        todo.length ? h('button.btn.primary.big', { onclick: () => start(todo.slice(0, BATCH)) }, L(`▶ Învață următoarele ${n}`, `▶ Learn the next ${n}`)) : chip(L('✓ Le-ai parcurs pe toate', '✓ You have been through them all'), 'ok'),
        btn(L('🗂️ Cartonașe', '🗂️ Flashcards'), '#/cards')),
      h('div.word-list.mt', ws.map((w) => wordRow(w, draw))));
  };
  const start = (words) => {
    stop = sortSession(box, words, {
      title: L(`📚 ${u.title} · banca de cuvinte`, `📚 ${u.title} · word bank`),
      onExit: draw,
      actions: () => {
        const left = bankWords(u).filter((w) => wordStatus(w.en) === 'new');
        return [left.length ? h('button.btn.primary.big', { onclick: () => start(left.slice(0, BATCH)) }, L(`▶ Încă ${Math.min(BATCH, left.length)}`, `▶ ${Math.min(BATCH, left.length)} more`)) : null,
          h('button.btn', { onclick: draw }, L('Lista de cuvinte', 'Word list')),
          btn(L('Înapoi la unitate', 'Back to unit'), `#/unit/${u.id}`)];
      },
    });
  };
  draw();
  return () => { if (stop) stop(); stopSpeak(); };
}

// ---------- all the words of a level (#/sort/<level>) ----------
export function sortView(main, levelId) {
  const lv = level(levelId);
  if (!lv) return main.append(empty('🤷', L('Nivel necunoscut', 'Unknown level')));
  main.append(header(L(`📚 Cuvintele ${lv.name}`, `📚 ${lv.name} words`),
    L(`Verifică rapid ce știi, câte ${BATCH} cuvinte: le vezi, spui dacă le știai, iar cele noi intră la cartonașe.`, `Check what you know quickly, ${BATCH} words at a time: see each one, say whether you knew it, and the new ones go into your flashcards.`), '#/words'));
  const box = h('div');
  main.append(box);
  let stop = null;
  const draw = () => {
    if (stop) { stop(); stop = null; }
    if (!levelUnlocked(lv)) return box.replaceChildren(empty('🔒', L('Nivel blocat', 'Level locked'), L('Cuvintele acestui nivel se deschid odată cu unitățile lui.', "This level's words open together with its units.")));
    const todo = wordsToLearn(lv);
    const n = Math.min(BATCH, todo.length);
    box.replaceChildren(
      statsCard(levelWords(lv), lv.color),
      !levelDone(lv) ? h('p.muted.small.center', L('Apar doar cuvintele din unitățile pe care le-ai deschis deja.', 'Only the words of the units you have already opened are included.')) : null,
      h('div.row.center.wrap',
        todo.length ? h('button.btn.primary.big', { onclick: () => start(todo.slice(0, BATCH)) }, L(`▶ Următoarele ${n} (mai sunt ${todo.length})`, `▶ The next ${n} (${todo.length} left)`))
          : chip(L('✓ Nimic nou de parcurs aici', '✓ Nothing new to go through here'), 'ok'),
        btn(L('📖 Toate cuvintele', '📖 All words'), '#/words')));
  };
  const start = (words) => {
    stop = sortSession(box, words, {
      title: L(`📚 Cuvinte ${lv.name}`, `📚 ${lv.name} words`),
      onExit: draw,
      actions: () => {
        const left = wordsToLearn(lv);
        return [left.length ? h('button.btn.primary.big', { onclick: () => start(left.slice(0, BATCH)) }, L(`▶ Încă ${Math.min(BATCH, left.length)}`, `▶ ${Math.min(BATCH, left.length)} more`)) : null,
          h('button.btn', { onclick: draw }, L('Înapoi', 'Back'))];
      },
    });
  };
  draw();
  return () => { if (stop) stop(); stopSpeak(); };
}

/** "Words for B1: 340 / 2000" — the vocabulary goal of a level, counting the levels before it. */
export function vocabGoal(stats, lv) {
  return h('div.to-goal',
    h('div.row.between', h('span', L(`📚 Cuvinte pentru ${lv.name}`, `📚 Words for ${lv.name}`)), h('strong', `${stats.learned} / ${stats.total}`)),
    bar(stats.total ? stats.learned / stats.total : 0, lv.color));
}

