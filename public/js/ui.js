// Shared UI pieces.
import { h, md, speakBtn } from './util.js';
import { S, level } from './store.js';
import { L } from './i18n.js';

export const pct = (x) => Math.round(x * 100);
export const go = (hash) => { location.hash = hash; };

export function ring(value, color, label, size = 64) {
  return h('div.ring', { style: `--p:${pct(value)};--c:${color};--s:${size}px` }, h('span', label ?? pct(value) + '%'));
}
export function bar(value, color) {
  return h('div.bar', h('div.bar-fill', { style: `width:${pct(value)}%;${color ? `background:${color}` : ''}` }));
}
export function chip(text, cls = '', color) {
  return h('span.chip-tag' + (cls ? '.' + cls : ''), color ? { style: `--c:${color}` } : {}, text);
}
export function levelChip(levelId) {
  const lv = level(levelId);
  return chip(lv ? lv.name : levelId.toUpperCase(), 'lvl', lv && lv.color);
}
export function header(title, sub, backHash) {
  return h('div.page-head',
    backHash ? h('a.back', { href: backHash }, L('← Înapoi', '← Back')) : null,
    h('h1', title), sub ? h('p.muted', sub) : null);
}
export function empty(icon, title, text, actions) {
  return h('div.empty', h('div.empty-icon', icon), h('h2', title), text ? h('p.muted', text) : null, actions ? h('div.row.center.wrap', actions) : null);
}
export const btn = (label, hash, cls = '') => h('a.btn' + (cls ? '.' + cls.split(' ').join('.') : ''), { href: hash }, label);

/** Full grammar lesson of a unit. */
export function grammarNode(u) {
  const g = u.grammar;
  return h('div.grammar',
    h('div.grammar-head', h('h2', g.title), h('div.muted', g.titleRo)),
    g.sections.map((s) => h('section.card.g-sec',
      h('h3', s.headingRo),
      h('p', { html: md(s.textRo) }),
      s.table ? h('div.table-wrap', h('table.g-table',
        h('thead', h('tr', s.table.headers.map((x) => h('th', x)))),
        h('tbody', s.table.rows.map((r) => h('tr', r.map((c) => h('td', { html: md(c) }))))))) : null,
      h('div.examples', (s.examples || []).map((e) => h('div.example',
        speakBtn(e.en), h('div', h('div.en', e.en), h('div.ro', e.ro))))))),
    g.tipsRo && g.tipsRo.length ? h('section.card.tips', h('h3', L('⚠️ Atenție — greșeli frecvente', '⚠️ Watch out — common mistakes')),
      h('ul', g.tipsRo.map((t) => h('li', { html: md(t) })))) : null);
}

export function weekChart() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    days.push({ label: L(['D', 'L', 'Ma', 'Mi', 'J', 'V', 'S'], ['S', 'M', 'T', 'W', 'T', 'F', 'S'])[d.getDay()], xp: S.p.days[key] || 0, today: i === 0 });
  }
  const max = Math.max(S.p.goal, ...days.map((d) => d.xp));
  return h('div.week', days.map((d) => h('div.week-day' + (d.today ? '.today' : ''),
    h('div.week-xp', d.xp || ''),
    h('div.week-bar', h('div.week-fill' + (d.xp >= S.p.goal ? '.goal' : ''), { style: `height:${Math.max(d.xp ? 6 : 0, (d.xp / max) * 100)}%` })),
    h('div.week-label', d.label))));
}
