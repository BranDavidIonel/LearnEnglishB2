// Dashboard, learning path, progress & settings.
import { h } from '../util.js';
import {
  S, streak, xpToday, nextAction, currentLevel, achieved, progressTo, levelProgress,
  levelUnlocked, levelDone, levelPassed, levelSkipped, unitUnlocked, unitProgress, reviewUnits, dueWords, wordCounts,
  badges, mistakeItems, PASS,
} from '../store.js';
import { ring, bar, chip, header, btn, pct, weekChart, go } from '../ui.js';
import { progressChart } from '../chart.js';
import { L, plural } from '../i18n.js';

const STEP_NAME = { vocab: L('Cuvinte noi', 'New words'), grammar: L('Gramatică', 'Grammar'), dialogue: L('Dialog', 'Dialogue'), practice: L('Exerciții', 'Exercises'), reading: L('Citire', 'Reading'), test: L('Testul unității', 'Unit test') };

function nextCard() {
  const p = S.p;
  const a = nextAction();
  const totalUnits = S.levels.reduce((n, l) => n + l.units.length, 0);
  if (!totalUnits) return h('div.card.hero', h('h2', L('Lecțiile se încarcă…', 'Loading lessons…')), h('p.muted', L('Nu am găsit încă lecții în folderul data/. Reîncarcă pagina peste puțin timp.', 'No lessons found in the data/ folder yet. Reload the page in a moment.')));
  if (!p.placement && p.xp === 0 && !Object.keys(p.exams).length) {
    return h('div.card.hero',
      h('div.hero-emoji', '👋'),
      h('h2', L('Bine ai venit! Hai să vedem de unde pornim.', "Welcome! Let's see where you're starting from.")),
      h('p', L('Fă un test scurt (10–15 minute) ca să aflu nivelul tău. Dacă știi deja lucruri, sari direct la nivelul potrivit.', 'Take a short test (10–15 minutes) so I can find your level. If you already know some English, you can skip straight to the right level.')),
      h('div.row.wrap',
        btn(L('🧭 Fă testul de nivel', '🧭 Take the placement test'), '#/placement', 'primary big'),
        btn(L('▶ Încep de la zero (A1)', '▶ Start from scratch (A1)'), `#/unit/${a.unit ? a.unit.id : ''}`, 'big')));
  }
  if (a.kind === 'unit') {
    const u = a.unit;
    return h('div.card.hero', { style: `--c:${a.level.color}` },
      h('div.hero-emoji', u.emoji),
      h('div.muted', a.review ? L('⚠️ De recapitulat înainte de examen', '⚠️ Review before the exam') : L(`Continuă · ${a.level.name} · Unitatea ${u.order}`, `Continue · ${a.level.name} · Unit ${u.order}`)),
      h('h2', u.title), h('p.muted', u.titleRo),
      h('p', L('Următorul pas: ', 'Next step: '), h('strong', STEP_NAME[a.step])),
      h('div.row.wrap', btn('▶ START', `#/unit/${u.id}/${a.step}`, 'primary big start'), btn(L('Vezi unitatea', 'View unit'), `#/unit/${u.id}`)));
  }
  if (a.kind === 'exam') {
    return h('div.card.hero', { style: `--c:${a.level.color}` },
      h('div.hero-emoji', '🎓'),
      h('h2', L(`Ești gata de examenul ${a.level.name}!`, `You're ready for the ${a.level.name} level exam!`)),
      h('p', L(`Ai terminat toate unitățile. Treci examenul cu minimum ${pct(PASS)}% ca să deblochezi nivelul următor.`, `You've finished all the units. Pass the exam with at least ${pct(PASS)}% to unlock the next level.`)),
      btn(L('▶ Începe examenul', '▶ Start the exam'), `#/exam/${a.level.id}`, 'primary big start'));
  }
  return h('div.card.hero', h('div.hero-emoji', '🏆'), h('h2', L('Felicitări! Ai terminat toate nivelurile.', "Congratulations! You've finished all the levels.")),
    h('p', L('Continuă cu cartonașele, jocurile și simulările Cambridge ca să-ți păstrezi nivelul.', 'Keep going with flashcards, games and Cambridge practice tests to stay in shape.')),
    btn(L('📝 Simulări Cambridge', '📝 Cambridge practice tests'), '#/cambridge', 'primary big'));
}

export function roadCard() {
  const got = achieved();
  return h('div.card',
    h('h3', L('🗺️ Drumul tău spre B2', '🗺️ Your road to B2')),
    h('p.muted', got ? L(`Nivel atins: ${got.name}. Lucrezi acum la ${currentLevel().name}.`, `Level reached: ${got.name}. Now working on ${currentLevel().name}.`) : L(`Lucrezi acum la nivelul ${currentLevel() ? currentLevel().name : 'A1'}.`, `Now working on level ${currentLevel() ? currentLevel().name : 'A1'}.`)),
    h('div.road', S.levels.map((lv) => {
      const v = levelProgress(lv);
      return h('a.road-step' + (levelDone(lv) ? '.done' : '') + (!levelUnlocked(lv) ? '.locked' : ''), { href: '#/learn', style: `--c:${lv.color}` },
        ring(v, lv.color, levelDone(lv) ? '✓' : (levelUnlocked(lv) ? pct(v) + '%' : '🔒'), 72),
        h('strong', lv.name), h('small.muted', lv.title));
    })),
    h('div.to-goals',
      ['b1', 'b2'].map((id) => {
        const v = progressTo(id);
        const lv = S.levels.find((l) => l.id === id);
        return h('div.to-goal', h('div.row.between', h('span', L(`Drumul parcurs până la ${lv.name}`, `Progress towards ${lv.name}`)), h('strong', pct(v) + '%')), bar(v, lv.color));
      })));
}

export function dashboard(main) {
  const p = S.p;
  const due = dueWords().length;
  const wc = wordCounts();
  const st = streak();
  const mist = mistakeItems().length;
  main.append(
    h('div.dash',
      nextCard(),
      h('div.stats',
        h('div.card.stat', h('div.stat-icon', '🔥'), h('div.stat-num', st), h('div.muted', st === 1 ? L('zi la rând', 'day streak') : L('zile la rând', 'day streak'))),
        h('div.card.stat', ring(Math.min(1, xpToday() / p.goal), '#facc15', '⚡', 56), h('div.stat-num', `${xpToday()} / ${p.goal}`), h('div.muted', L('XP azi', 'XP today'))),
        h('a.card.stat.link', { href: '#/words' }, h('div.stat-icon', '📖'), h('div.stat-num', wc.learned), h('div.muted', L(`cuvinte învățate din ${wc.total}`, `words learned of ${wc.total}`))),
        h('a.card.stat.link' + (due ? '.pulse' : ''), { href: '#/cards' }, h('div.stat-icon', '🗂️'), h('div.stat-num', due), h('div.muted', L('cartonașe de repetat azi', plural(due, 'flashcard to review today', 'flashcards to review today'))))),
      roadCard(),
      h('div.grid2',
        h('div.card', h('h3', L('📅 Ultimele 7 zile', '📅 Last 7 days')), weekChart()),
        h('div.card', h('h3', L('⚡ Scurtături', '⚡ Shortcuts')),
          h('div.quick',
            h('a.quick-item', { href: '#/speak' }, '🗣️', h('span', L('Exersează vorbirea', 'Speaking practice'))),
            h('a.quick-item', { href: '#/games' }, '🎮', h('span', L('Jocuri cu cuvinte', 'Word games'))),
            h('a.quick-item', { href: '#/mistakes' }, '🩹', h('span', L(`Greșelile mele${mist ? ` (${mist})` : ''}`, `My mistakes${mist ? ` (${mist})` : ''}`))),
            h('a.quick-item', { href: '#/videos' }, '🎬', h('span', L('Videouri', 'Videos'))),
            h('a.quick-item', { href: '#/cambridge' }, '📝', h('span', L('Simulări Cambridge', 'Cambridge practice tests'))),
            h('a.quick-item', { href: '#/grammar' }, '📐', h('span', L('Toată gramatica', 'All grammar'))),
            h('a.quick-item', { href: '#/placement' }, '🧭', h('span', p.placement ? L('Refă testul de nivel', 'Retake the placement test') : L('Test de nivel', 'Placement test'))))))));
}

export function learn(main) {
  main.append(header(L('Învață', 'Learn'), L('Parcurge unitățile în ordine. Fiecare unitate se termină cu un test; fiecare nivel, cu un examen.', 'Work through the units in order. Each unit ends with a test; each level ends with an exam.')));
  for (const lv of S.levels) {
    const unlocked = levelUnlocked(lv);
    const state = levelPassed(lv) ? chip(L('✓ Terminat', '✓ Finished'), 'ok') : levelSkipped(lv) ? chip(L('✓ Echivalat prin testul de nivel', '✓ Credited by the placement test'), 'ok') : unlocked ? chip(L('În curs', 'In progress'), 'now') : chip(L('🔒 Blocat', '🔒 Locked'), 'lock');
    const sec = h('section.level' + (unlocked ? '' : '.locked'), { style: `--c:${lv.color}` },
      h('div.level-head',
        ring(levelProgress(lv), lv.color, lv.name, 76),
        h('div.grow', h('h2', `${lv.name} · ${lv.title}`, ' ', state), h('p.muted', lv.desc), bar(levelProgress(lv), lv.color))));
    if (!lv.units.length) sec.append(h('p.muted', L('Lecțiile pentru acest nivel nu sunt încă disponibile.', 'Lessons for this level are not available yet.')));
    else if (!unlocked) {
      const prev = S.levels[lv.index - 1];
      sec.append(h('div.locked-note', L(`🔒 Treci examenul ${prev.name} ca să deblochezi acest nivel — sau fă `, `🔒 Pass the ${prev.name} level exam to unlock this level — or take the `), h('a', { href: '#/placement' }, L('testul de nivel', 'placement test')), L(' dacă știi deja mai mult.', ' if you already know more.')));
    }
    const grid = h('div.units');
    lv.units.forEach((u) => {
      const open = unitUnlocked(u);
      const st = S.p.units[u.id] || {};
      const v = unitProgress(u);
      const badge = st.review ? '⚠️' : st.passed ? '⭐' : open ? '' : '🔒';
      grid.append(h(open ? 'a.unit-card' : 'div.unit-card.locked', open ? { href: `#/unit/${u.id}` } : { title: L('Termină unitatea anterioară', 'Finish the previous unit first') },
        h('div.unit-top', h('span.unit-emoji', u.emoji), h('span.unit-badge', badge)),
        h('div.unit-n', L(`Unitatea ${u.order}`, `Unit ${u.order}`)),
        h('div.unit-title', u.title),
        h('div.unit-ro', u.titleRo),
        h('div.unit-gram', '📐 ', u.grammar.title),
        st.review ? h('div.unit-warn', L('De recapitulat', 'Needs review')) : null,
        bar(v, lv.color)));
    });
    if (lv.units.length) {
      const e = S.p.exams[lv.id];
      const rev = reviewUnits(lv);
      grid.append(h(unlocked ? 'a.unit-card.exam' : 'div.unit-card.exam.locked', unlocked ? { href: `#/exam/${lv.id}` } : {},
        h('div.unit-top', h('span.unit-emoji', '🎓'), h('span.unit-badge', levelPassed(lv) ? '🏆' : '')),
        h('div.unit-n', L('Examen final', 'Level exam')),
        h('div.unit-title', L(`Examenul ${lv.name}`, `${lv.name} level exam`)),
        h('div.unit-ro', rev.length ? L(`Întâi recapitulează ${rev.length} ${rev.length === 1 ? 'unitate' : 'unități'}`, `First review ${rev.length} ${plural(rev.length, 'unit', 'units')}`) : L(`30 de întrebări · minimum ${pct(PASS)}%`, `30 questions · at least ${pct(PASS)}%`)),
        e ? h('div.unit-gram', L(`Cel mai bun rezultat: ${pct(e.best)}%`, `Best score: ${pct(e.best)}%`)) : null));
    }
    sec.append(grid);
    main.append(sec);
  }
}

export function progressView(main) {
  const p = S.p, wc = wordCounts();
  const passedUnits = Object.values(p.units).filter((u) => u.passed).length;
  const totalUnits = S.levels.reduce((n, l) => n + l.units.length, 0);
  const chart = progressChart();
  main.append(header(L('Progres', 'Progress')),
    chart.node,
    roadCard(),
    h('div.stats',
      h('div.card.stat', h('div.stat-icon', '💎'), h('div.stat-num', p.xp), h('div.muted', L('XP în total', 'total XP'))),
      h('div.card.stat', h('div.stat-icon', '🔥'), h('div.stat-num', streak()), h('div.muted', L('zile la rând', 'day streak'))),
      h('div.card.stat', h('div.stat-icon', '📗'), h('div.stat-num', `${passedUnits}/${totalUnits}`), h('div.muted', L('unități trecute', 'units passed'))),
      h('div.card.stat', h('div.stat-icon', '📖'), h('div.stat-num', `${wc.learned}`), h('div.muted', L(`învățate · ${wc.learning} în curs · ${wc.new} noi`, `learned · ${wc.learning} in progress · ${wc.new} new`)))),
    h('div.card', h('h3', L('🏅 Realizări', '🏅 Achievements')),
      h('div.badges', badges().map((b) => h('div.badge' + (b.ok ? '.ok' : ''), { title: b.desc }, h('div.badge-icon', b.icon), h('strong', b.name), h('small.muted', b.desc))))),
    h('a.card.exam-card', { href: '#/settings' }, h('div.stat-icon', '⚙️'), h('div.grow', h('h3', L('Setări', 'Settings')), h('p.muted', L('Tema de culori, limba aplicației, vocea, obiectivul zilnic.', 'Colour theme, app language, voice, daily goal.'))), h('span.btn', L('Deschide →', 'Open →'))));
  return chart.stop;
}
