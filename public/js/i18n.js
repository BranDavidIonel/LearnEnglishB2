// Interface language. Every piece of interface text is written as L('text în română', 'English text').
// The language is read once, before anything else runs; changing it reloads the page, so texts kept
// in module-level constants are always in the right language.
// (Lesson content — explanations, translations — stays in Romanian: it is what the learner learns from.)
let stored = null;
try { stored = localStorage.getItem('el-lang'); } catch { /* private mode */ }

/** 'en' (default) or 'ro' */
export const lang = stored === 'ro' ? 'ro' : 'en';
/** Picks the text for the current interface language. */
export const L = (ro, en) => (lang === 'ro' || en === undefined ? ro : en);
/** Locale for dates and numbers. */
export const locale = lang === 'ro' ? 'ro-RO' : 'en-GB';
/** one/many helper: plural(n, 'zi', 'zile') */
export const plural = (n, one, many) => (n === 1 ? one : many);

export function setLang(next) {
  if (next === lang) return;
  try { localStorage.setItem('el-lang', next === 'ro' ? 'ro' : 'en'); } catch { /* ignore */ }
  location.reload();
}

document.documentElement.lang = lang;
