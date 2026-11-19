// Entry point: loads data, draws the menu, routes between pages.
import { h, stopSpeak } from './util.js';
import { S, load, save, applySettings, streak, xpToday, dueWords, dueVerbs, currentLevel, mistakeItems, THEMES } from './store.js';
import { L, lang, setLang } from './i18n.js';
import * as home from './views/home.js';
import * as unit from './views/unit.js';
import * as words from './views/words.js';
import * as wordlist from './views/wordlist.js';
import * as speaking from './views/speaking.js';
import * as cambridge from './views/cambridge.js';
import * as settings from './views/settings.js';
import * as bank from './views/bank.js';
import * as verbs from './views/verbs.js';

const routes = [
  [/^\/?$/, home.dashboard, 'home'],
  [/^\/learn$/, home.learn, 'learn'],
  [/^\/unit\/([\w-]+)(?:\/(\w+))?$/, unit.unitView, 'learn'],
  [/^\/exam\/(\w+)$/, unit.examView, 'learn'],
  [/^\/placement$/, unit.placementView, 'placement'],
  [/^\/mistakes$/, unit.mistakesView, 'mistakes'],
  [/^\/speak(?:\/(\w+))?(?:\/([\w-]+))?$/, speaking.view, 'speak'],
  [/^\/cards$/, words.cardsView, 'cards'],
  [/^\/words\/verbs$/, verbs.verbsView, 'words'],
  [/^\/words(?:\/(\w+))?$/, wordlist.wordsView, 'words'],
  [/^\/sort\/(\w+)$/, bank.sortView, 'words'],
  [/^\/grammar(?:\/([\w-]+))?$/, words.grammarView, 'grammar'],
  [/^\/videos$/, words.videosView, 'videos'],
  [/^\/games(?:\/(\w+))?$/, words.gamesView, 'games'],
  [/^\/cambridge(?:\/(\w+))?(?:\/([\w-]+))?(?:\/(\w+))?$/, cambridge.view, 'cambridge'],
  [/^\/progress$/, home.progressView, 'progress'],
  [/^\/settings$/, settings.view, 'settings'],
];

const NAV = [
  ['home', '#/', '🏠', L('Acasă', 'Home')],
  ['learn', '#/learn', '🎓', L('Învață', 'Learn')],
  ['speak', '#/speak', '🗣️', L('Vorbire', 'Speaking')],
  ['cards', '#/cards', '🗂️', L('Cartonașe', 'Flashcards')],
  ['words', '#/words', '📖', L('Cuvinte', 'Words')],
  ['grammar', '#/grammar', '📐', L('Gramatică', 'Grammar')],
  ['games', '#/games', '🎮', L('Jocuri', 'Games')],
  ['videos', '#/videos', '🎬', L('Video', 'Videos')],
  ['mistakes', '#/mistakes', '🩹', L('Greșelile mele', 'My mistakes')],
  ['placement', '#/placement', '🧭', L('Test de nivel', 'Placement test')],
  ['cambridge', '#/cambridge', '📝', 'Cambridge'],
  ['progress', '#/progress', '📊', L('Progres', 'Progress')],
];

const app = document.getElementById('app');
const main = h('main#main');
const nav = h('nav.nav');
const status = h('div.status');
let cleanup = null;
let active = 'home';

const closeMenu = () => document.body.classList.remove('menu-open');
const navItem = ([id, href, icon, label], badge) => h('a.nav-item' + (id === active ? '.on' : ''), { href, onclick: closeMenu },
  h('span.nav-icon', icon), h('span.nav-label', label), badge ? h('span.nav-badge', badge) : null);

function nextTheme() {
  const i = THEMES.findIndex((t) => t.id === S.p.settings.theme);
  S.p.settings.theme = THEMES[(i + 1) % THEMES.length].id;
  applySettings(); save();
  if (active === 'settings') route();
}

function drawNav() {
  const badge = { cards: dueWords().length, mistakes: mistakeItems().length, words: dueVerbs().length };
  nav.replaceChildren(
    ...NAV.map((item) => navItem(item, badge[item[0]])),
    h('div.nav-gap'),
    navItem(['settings', '#/settings', '⚙️', L('Setări', 'Settings')]));
  const lv = currentLevel();
  const theme = THEMES.find((t) => t.id === S.p.settings.theme) || THEMES[0];
  status.replaceChildren(
    h('div.lang-switch', { role: 'group', 'aria-label': L('Limba aplicației', 'App language') },
      ['en', 'ro'].map((code) => h('button' + (code === lang ? '.on' : ''), { title: code === 'en' ? 'English' : 'Română', onclick: () => setLang(code) }, code.toUpperCase()))),
    h('button.pill.theme-btn', { title: L(`Temă: ${theme.name} — apasă pentru următoarea`, `Theme: ${theme.name} — click for the next one`), onclick: nextTheme }, '🎨'),
    lv ? h('a.pill', { href: '#/learn', style: `--c:${lv.color}`, title: L('Nivelul la care lucrezi', 'The level you are working on') }, lv.name) : null,
    h('a.pill', { href: '#/progress', title: L('Zile la rând', 'Day streak') }, '🔥 ', streak()),
    h('a.pill', { href: '#/progress', title: L('XP azi / obiectiv', 'XP today / goal') }, '⚡ ', `${xpToday()}/${S.p.goal}`));
}

function route() {
  const path = location.hash.replace(/^#/, '') || '/';
  if (cleanup) { try { cleanup(); } catch { /* ignore */ } cleanup = null; }
  stopSpeak();
  document.querySelectorAll('.modal-back').forEach((m) => m.remove());
  main.replaceChildren();
  for (const [re, fn, id] of routes) {
    const m = path.match(re);
    if (!m) continue;
    active = id; drawNav();
    try {
      const out = fn(main, ...m.slice(1));
      if (typeof out === 'function') cleanup = out;
    } catch (e) {
      console.error(e);
      main.append(h('div.empty', h('div.empty-icon', '😵'), h('h2', L('Ceva nu a mers', 'Something went wrong')), h('p.muted', String(e.message || e)), h('a.btn.primary', { href: '#/' }, L('Acasă', 'Home'))));
    }
    scrollTo(0, 0);
    return;
  }
  location.hash = '#/';
}

async function start() {
  try { await load(); } catch (e) {
    app.replaceChildren(h('div.empty', h('div.empty-icon', '🔌'), h('h2', L('Nu pot încărca datele', 'Cannot load the data')),
      h('p.muted', L('Verifică dacă serverul rulează (Start.bat) și reîncarcă pagina.', 'Check that the server is running (Start.bat) and reload the page.'))));
    return;
  }
  app.replaceChildren(
    h('aside.side',
      h('a.brand', { href: '#/', onclick: closeMenu }, h('span.brand-logo', 'EN'), h('span', h('strong', 'English Levels'), h('small', 'A1 → B2'))),
      nav),
    h('div.content',
      h('header.top', h('button.icon-btn.menu-btn', { onclick: () => document.body.classList.toggle('menu-open'), title: L('Meniu', 'Menu') }, '☰'), h('div.grow'), status),
      S.serverOld ? h('div.alert.warn.server-old',
        h('strong', L('🔄 Serverul aplicației trebuie repornit. ', '🔄 The app server needs a restart. ')),
        L('A primit o actualizare, dar rulează încă versiunea de dinainte, așa că o parte din conținut lipsește (de exemplu conversațiile de la Vorbire). Închide fereastra neagră „English Levels” și pornește din nou Start.bat. ',
          'It was updated but is still running the earlier version, so some content is missing (for example the Speaking conversations). Close the black “English Levels” window and run Start.bat again. '),
        h('button.btn', { onclick: () => location.reload() }, L('Am repornit — reîncarcă pagina', 'I restarted it — reload the page'))) : null,
      main));
  window.addEventListener('hashchange', route);
  window.addEventListener('progress', drawNav);
  route();
}
start();
