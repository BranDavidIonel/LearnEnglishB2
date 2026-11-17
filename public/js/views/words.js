// Flashcards, grammar reference, videos, games. (The word list lives in wordlist.js.)
import { h, speak, stopSpeak, speakBtn, picture, shuffle, sample, sfx, confetti, modal } from '../util.js';
import { S, save, dueWords, gradeWord, wordCounts, knownWords, addXp } from '../store.js';
import { header, btn, chip, levelChip, grammarNode, empty, bar, pct, go } from '../ui.js';
import { videoCard } from './unit.js';
import { L, plural } from '../i18n.js';

// ================= flashcards =================
export function cardsView(main) {
  main.append(header(L('🗂️ Cartonașe', '🗂️ Flashcards'), L('Repetare la intervale: cuvintele pe care le știi apar tot mai rar, cele grele tot mai des.', 'Spaced repetition: words you know come back less often, hard ones more often.'), '#/'));
  const box = h('div');
  main.append(box);
  let reverse = false;
  let cleanup = null;

  const intro = () => {
    const due = dueWords();
    const wc = wordCounts();
    const inDeck = Object.keys(S.p.words).length;
    if (!inDeck) return box.replaceChildren(empty('🗂️', L('Încă nu ai cartonașe', 'No flashcards yet'), L('Cuvintele intră aici automat când termini pasul „Cuvinte noi” dintr-o unitate.', 'Words are added here automatically when you finish the “New words” step of a unit.'), [btn(L('Mergi la lecții', 'Go to lessons'), '#/learn', 'primary')]));
    box.replaceChildren(
      h('div.stats',
        h('div.card.stat', h('div.stat-icon', '⏰'), h('div.stat-num', due.length), h('div.muted', L('de repetat azi', 'to review today'))),
        h('div.card.stat', h('div.stat-icon', '🌱'), h('div.stat-num', wc.learning), h('div.muted', L('în curs de învățare', 'being learned'))),
        h('div.card.stat', h('div.stat-icon', '✅'), h('div.stat-num', wc.learned), h('div.muted', L('învățate', 'learned')))),
      empty(due.length ? '⏰' : '🎉', due.length ? L(`${due.length} ${due.length === 1 ? 'cartonaș te așteaptă' : 'cartonașe te așteaptă'}`, `${due.length} ${plural(due.length, 'flashcard is', 'flashcards are')} waiting for you`) : L('Ai terminat repetarea pe azi!', "You're done reviewing for today!"),
        due.length ? L('Uită-te la cuvânt, spune traducerea în gând, apoi întoarce cartonașul.', 'Look at the word, say the translation in your head, then flip the card.') : L('Revino mâine — sau exersează suplimentar cuvinte la întâmplare.', 'Come back tomorrow — or practise some random words.'),
        [due.length ? h('button.btn.primary.big', { onclick: () => session(due.slice(0, 30), true) }, L('▶ Începe repetarea', '▶ Start review')) : null,
          h('button.btn', { onclick: () => session(sample(knownWords(), 20), false) }, L('🎲 Exersare liberă (20 de cuvinte)', '🎲 Free practice (20 words)')),
          h('label.check', h('input', { type: 'checkbox', checked: reverse, onchange: (e) => { reverse = e.target.checked; } }), L(' Invers: română → engleză', ' Reverse: Romanian → English'))]));
  };

  const session = (words, scheduled) => {
    const queue = words.slice();
    const total = words.length;
    let done = 0, flipped = false, cur;
    const progress = h('div.bar', h('div.bar-fill'));
    const stage = h('div.fc-stage');
    const buttons = h('div.fc-buttons');
    const onKey = (e) => {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (!flipped) flip(); }
      else if (flipped && ['1', '2', '3'].includes(e.key)) grade(Number(e.key) - 1);
    };
    document.addEventListener('keydown', onKey);
    cleanup = () => { document.removeEventListener('keydown', onKey); stopSpeak(); };
    const flip = () => {
      flipped = true; sfx('flip');
      stage.querySelector('.fc').classList.add('flipped');
      if (reverse) speak(cur.en);
      buttons.replaceChildren(
        h('button.btn.danger.big', { onclick: () => grade(0) }, L('😕 Nu știam', "😕 Didn't know"), h('small', '1')),
        h('button.btn.warn.big', { onclick: () => grade(1) }, L('🤔 Greu', '🤔 Hard'), h('small', '2')),
        h('button.btn.success.big', { onclick: () => grade(2) }, L('😀 Știam', '😀 Knew it'), h('small', '3')));
    };
    const grade = (g) => {
      if (scheduled) gradeWord(cur.en, g);
      if (g === 0) queue.push(cur); else { done++; addXp(1); }
      show();
    };
    const show = () => {
      progress.firstChild.style.width = `${(done / total) * 100}%`;
      if (!queue.length) {
        cleanup(); confetti(1500); sfx('win');
        return box.replaceChildren(empty('🎉', L('Sesiune terminată!', 'Session complete!'), L(`Ai repetat ${total} ${total === 1 ? 'cuvânt' : 'cuvinte'} · +${total} XP ⚡`, `You reviewed ${total} ${plural(total, 'word', 'words')} · +${total} XP ⚡`), [h('button.btn.primary.big', { onclick: intro }, L('Continuă', 'Continue')), btn(L('Acasă', 'Home'), '#/')]));
      }
      cur = queue.shift(); flipped = false;
      const front = reverse
        ? h('div.fc-face.fc-front', h('div.fc-hint', L('🇷🇴 Cum se spune în engleză?', '🇷🇴 How do you say it in English?')), h('div.fc-word', cur.ro))
        : h('div.fc-face.fc-front', picture(cur), h('div.fc-word', cur.en, ' ', speakBtn(cur.en)), h('div.vipa', cur.ipa));
      const back = h('div.fc-face.fc-back',
        h('div.fc-word', reverse ? cur.en : cur.ro, reverse ? [' ', speakBtn(cur.en)] : null),
        reverse ? h('div.vipa', cur.ipa) : h('div.muted', cur.en),
        h('div.vex', speakBtn(cur.ex), h('div', h('div.en', cur.ex), h('div.ro', cur.exRo))));
      stage.replaceChildren(h('div.fc.fade-in', { onclick: () => { if (!flipped) flip(); } }, front, back));
      buttons.replaceChildren(h('button.btn.primary.big', { onclick: flip }, L('Întoarce cartonașul (Space)', 'Flip the card (Space)')));
      if (!reverse) speak(cur.en);
    };
    box.replaceChildren(h('div.session', h('div.sess-top', h('button.icon-btn', { onclick: () => { cleanup(); intro(); } }, '✕'), progress), stage, buttons));
    show();
  };
  intro();
  return () => cleanup && cleanup();
}

// ================= grammar reference =================
export function grammarView(main, id) {
  if (id && S.unitById[id]) {
    const u = S.unitById[id];
    main.append(h('a.back', { href: '#/grammar' }, L('← Toată gramatica', '← All grammar')), grammarNode(u),
      h('div.row.center.mt', btn(L(`Mergi la unitatea ${u.order} →`, `Go to unit ${u.order} →`), `#/unit/${u.id}`, 'primary')));
    return;
  }
  main.append(header(L('📐 Gramatică', '📐 Grammar'), L('Toate regulile din curs, într-un singur loc. Le poți citi oricând.', 'All the rules from the course in one place. Read them any time.'), '#/'));
  for (const lv of S.levels) {
    if (!lv.units.length) continue;
    main.append(h('section.card', { style: `--c:${lv.color}` },
      h('h2', levelChip(lv.id), ' ', lv.title),
      h('div.gram-list', lv.units.map((u) => h('a.gram-row', { href: `#/grammar/${u.id}` },
        h('span.gram-n', u.order), h('span.grow', h('strong', u.grammar.title), h('small.muted', u.grammar.titleRo)),
        (S.p.units[u.id] || {}).steps?.grammar ? h('span', '✅') : null)))));
  }
}

// ================= videos =================
export function videosView(main) {
  main.append(header(L('🎬 Videouri', '🎬 Videos'), L('Clipuri scurte de la profesori de engleză, alese pentru fiecare unitate. Pornește subtitrarea în engleză!', 'Short clips from English teachers, picked for each unit. Turn on English subtitles!'), '#/'));
  let any = false;
  for (const lv of S.levels) {
    const vs = lv.units.filter((u) => u.video);
    if (!vs.length) continue;
    any = true;
    main.append(h('h2', levelChip(lv.id), ' ', lv.title),
      h('div.video-grid', vs.map((u) => h('div.video-item', { onclick: () => modal(h('div', videoCard(u), h('p.muted', L(`${u.level} · Unitatea ${u.order} · ${u.title}`, `${u.level} · Unit ${u.order} · ${u.title}`))), { wide: true }) },
        h('div.video-thumb', h('img', { src: `https://i.ytimg.com/vi/${u.video.youtubeId}/mqdefault.jpg`, alt: '', loading: 'lazy' }), h('span.play', '▶')),
        h('strong', u.video.title), h('small.muted', `U${u.order} · ${u.grammar.title}`)))));
  }
  if (!any) main.append(empty('🎬', L('Niciun video încă', 'No videos yet'), L('Videourile apar aici pe măsură ce sunt adăugate la unități.', 'Videos will appear here as they are added to units.')));
}

// ================= games =================
export function gamesView(main, game) {
  if (game === 'memory') return memory(main);
  if (game === 'sprint') return sprint(main);
  if (game === 'spell') return spell(main);
  const g = S.p.games || {};
  main.append(header(L('🎮 Jocuri', '🎮 Games'), L('Repetă cuvintele jucându-te. Jocurile folosesc cuvintele pe care le-ai întâlnit deja.', "Review words while you play. The games use words you've already met."), '#/'),
    h('div.game-grid',
      h('a.card.game', { href: '#/games/memory' }, h('div.game-icon', '🧩'), h('h3', L('Perechi', 'Pairs')), h('p.muted', L('Găsește perechile engleză–română cât mai repede.', 'Match English–Romanian pairs as fast as you can.')), g.memory ? chip(L(`Record: ${g.memory} mutări`, `Record: ${g.memory} moves`), 'ok') : null),
      h('a.card.game', { href: '#/games/sprint' }, h('div.game-icon', '⚡'), h('h3', 'Sprint 60'), h('p.muted', L('Câte cuvinte traduci corect în 60 de secunde?', 'How many words can you translate correctly in 60 seconds?')), g.sprint ? chip(L(`Record: ${g.sprint} puncte`, `Record: ${g.sprint} points`), 'ok') : null),
      h('a.card.game', { href: '#/games/spell' }, h('div.game-icon', '🎧'), h('h3', L('Dictare', 'Dictation')), h('p.muted', L('Ascultă cuvântul și scrie-l corect, literă cu literă.', 'Listen to the word and spell it correctly, letter by letter.')), g.spell ? chip(L(`Record: ${g.spell}/10`, `Record: ${g.spell}/10`), 'ok') : null)));
}

function memory(main) {
  main.append(header(L('🧩 Perechi', '🧩 Pairs'), L('Întoarce două cărți: un cuvânt în engleză și traducerea lui.', 'Flip two cards: an English word and its translation.'), '#/games'));
  const box = h('div');
  main.append(box);
  const start = () => {
    const words = sample(knownWords(8), 8);
    const cards = shuffle(words.flatMap((w, i) => [{ id: i, text: w.en, en: true, emoji: w.emoji }, { id: i, text: w.ro, en: false }]));
    let open = [], found = 0, moves = 0, lock = false;
    const info = h('div.muted.center', L('Mutări: 0', 'Moves: 0'));
    const grid = h('div.mem-grid', cards.map((c) => {
      const el = h('button.mem', { onclick: () => {
        if (lock || el.classList.contains('open') || el.classList.contains('found')) return;
        el.classList.add('open'); sfx('flip'); if (c.en) speak(c.text);
        open.push({ c, el });
        if (open.length < 2) return;
        moves++; info.textContent = L(`Mutări: ${moves}`, `Moves: ${moves}`);
        const [a, b] = open; open = [];
        if (a.c.id === b.c.id && a.c.en !== b.c.en) {
          a.el.classList.add('found'); b.el.classList.add('found'); sfx('ok');
          if (++found === words.length) {
            const g = S.p.games || (S.p.games = {});
            const rec = !g.memory || moves < g.memory;
            if (rec) g.memory = moves;
            addXp(10); save(); confetti(); sfx('win');
            box.append(h('div.result', h('h2', rec ? L(`Record nou: ${moves} mutări! 🏆`, `New record: ${moves} moves! 🏆`) : L(`Gata în ${moves} mutări!`, `Done in ${moves} moves!`)), h('p.muted', '+10 XP ⚡'),
              h('div.row.center', h('button.btn.primary.big', { onclick: start }, L('🔁 Joc nou', '🔁 New game')), btn(L('Alte jocuri', 'More games'), '#/games'))));
          }
        } else { lock = true; setTimeout(() => { a.el.classList.remove('open'); b.el.classList.remove('open'); lock = false; }, 900); }
      } }, h('span.mem-back', '?'), h('span.mem-front' + (c.en ? '.en' : ''), c.en ? h('small', c.emoji) : null, c.text));
      return el;
    }));
    box.replaceChildren(info, grid);
  };
  start();
}

function sprint(main) {
  main.append(header('⚡ Sprint 60', L('Alege traducerea corectă. Seriile de răspunsuri corecte dau puncte bonus.', 'Pick the right translation. Streaks of correct answers earn bonus points.'), '#/games'));
  const box = h('div');
  main.append(box);
  let timer;
  const start = () => {
    const pool = knownWords(8);
    let left = 60, score = 0, combo = 0, right = 0;
    const tEl = h('div.sprint-time', '60'), sEl = h('div.sprint-score', L('0 puncte', '0 points')), stage = h('div');
    const ask = () => {
      const w = pool[Math.floor(Math.random() * pool.length)];
      const opts = shuffle([w, ...sample(pool.filter((x) => x.ro !== w.ro), 3)]);
      stage.replaceChildren(h('div.ex.fade-in', h('div.sprint-word', w.emoji, ' ', w.en),
        h('div.opts', opts.map((o) => h('button.opt', { onclick: (e) => {
          if (o === w) { combo++; right++; score += 1 + Math.floor(combo / 5); sfx('ok'); } else { combo = 0; sfx('bad'); e.currentTarget.classList.add('wrong'); }
          sEl.textContent = L(`${score} puncte${combo >= 5 ? ` · 🔥 serie ${combo}` : ''}`, `${score} ${plural(score, 'point', 'points')}${combo >= 5 ? ` · 🔥 streak ${combo}` : ''}`);
          setTimeout(ask, o === w ? 80 : 450);
        } }, h('span', o.ro))))));
    };
    box.replaceChildren(h('div.sprint-top', tEl, sEl), stage);
    ask();
    clearInterval(timer);
    timer = setInterval(() => {
      left--; tEl.textContent = left; tEl.classList.toggle('low', left <= 10);
      if (left > 0) return;
      clearInterval(timer);
      const g = S.p.games || (S.p.games = {});
      const rec = !g.sprint || score > g.sprint;
      if (rec) g.sprint = score;
      const xp = Math.min(20, right); addXp(xp); save(); if (rec && score) confetti(); sfx('win');
      box.replaceChildren(h('div.result', h('div.big-level', score), h('h2', rec && score ? L('Record nou! 🏆', 'New record! 🏆') : L('Timpul a expirat!', "Time's up!")), h('p.muted', L(`${right} răspunsuri corecte · +${xp} XP ⚡`, `${right} correct ${plural(right, 'answer', 'answers')} · +${xp} XP ⚡`)),
        h('div.row.center', h('button.btn.primary.big', { onclick: start }, L('🔁 Încă o dată', '🔁 Play again')), btn(L('Alte jocuri', 'More games'), '#/games'))));
    }, 1000);
  };
  box.append(empty('⚡', L('Ești gata?', 'Ready?'), L('Ai 60 de secunde.', 'You have 60 seconds.'), [h('button.btn.primary.big', { onclick: start }, L('▶ Start', '▶ Start'))]));
  return () => clearInterval(timer);
}

function spell(main) {
  main.append(header(L('🎧 Dictare', '🎧 Dictation'), L('Ascultă și scrie cuvântul. 10 cuvinte pe rundă.', 'Listen and type the word. 10 words per round.'), '#/games'));
  const box = h('div');
  main.append(box);
  const start = () => {
    const words = sample(knownWords(10).filter((w) => !/\s/.test(w.en) || w.en.length < 18), 10);
    let i = 0, ok = 0;
    const next = () => {
      if (i >= words.length) {
        const g = S.p.games || (S.p.games = {});
        if (!g.spell || ok > g.spell) g.spell = ok;
        addXp(ok); save(); if (ok >= 8) confetti(); sfx('win');
        return box.replaceChildren(h('div.result', h('div.big-level', `${ok}/${words.length}`), h('h2', ok >= 8 ? L('Excelent! 🎉', 'Excellent! 🎉') : L('Runda s-a terminat', 'Round over')), h('p.muted', `+${ok} XP ⚡`),
          h('div.row.center', h('button.btn.primary.big', { onclick: start }, L('🔁 Rundă nouă', '🔁 New round')), btn(L('Alte jocuri', 'More games'), '#/games'))));
      }
      const w = words[i];
      const input = h('input.gap-input.wide', { type: 'text', autocomplete: 'off', spellcheck: 'false', autocapitalize: 'off', placeholder: L('Scrie cuvântul…', 'Type the word…') });
      const fb = h('div.spell-fb');
      let answered = false;
      const check = () => {
        if (answered) { i++; return next(); }
        if (!input.value.trim()) return;
        answered = true;
        box.querySelector('.ex-foot')?.remove();
        const good = input.value.trim().toLowerCase() === w.en.toLowerCase();
        if (good) ok++;
        sfx(good ? 'ok' : 'bad'); input.disabled = true; input.classList.add(good ? 'right' : 'wrong');
        fb.replaceChildren(h('div.feedback.' + (good ? 'good' : 'bad'), h('div.fb-head', good ? L('Corect! ✅', 'Correct! ✅') : L('Nu chiar ❌', 'Not quite ❌')), h('div.fb-answer', h('strong', w.en), ` = ${w.ro}`)),
          h('button.btn.primary.big', { onclick: check }, L('Continuă →', 'Continue →')));
        fb.querySelector('button').focus();
      };
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); check(); } });
      box.replaceChildren(h('div.ex.fade-in', h('div.muted.center', `${i + 1} / ${words.length}`),
        h('div.listen-box', h('button.btn.round.primary', { onclick: () => { speak(w.en); input.focus(); } }, '🔊'), h('button.btn.round', { onclick: () => { speak(w.en, { slow: true }); input.focus(); } }, '🐢'), h('span.muted', L(`Indiciu: ${w.emoji} ${w.ro}`, `Hint: ${w.emoji} ${w.ro}`))),
        input, h('div.ex-foot', h('button.btn.primary.big', { onclick: check }, L('Verifică', 'Check'))), fb));
      setTimeout(() => { input.focus(); speak(w.en); }, 200);
    };
    next();
  };
  start();
  return stopSpeak;
}
