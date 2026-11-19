// Progress chart ("like a crypto price chart"): one line over time, coloured by direction,
// with a crosshair tooltip, range buttons and a small "XP per day" strip underneath.
import { h, today } from './util.js';
import { S } from './store.js';
import { L, locale } from './i18n.js';

const int = (v) => Math.round(v).toLocaleString(locale);
const dec = (v) => v.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const METRICS = {
  xp: { tab: L('XP total', 'Total XP'), fmt: int, unit: ' XP', what: L('Puncte XP adunate', 'XP earned') },
  w: { tab: L('Cuvinte învățate', 'Words learned'), fmt: int, unit: '', what: L('Cuvinte învățate', 'Words learned') },
  v: { tab: L('Verbe neregulate', 'Irregular verbs'), fmt: int, unit: '', what: L('Verbe neregulate învățate', 'Irregular verbs learned') },
  b1: { tab: L('Drumul spre B1', 'Road to B1'), fmt: dec, unit: '%', pp: true, what: L('Drumul parcurs până la B1', 'Progress towards B1') },
  b2: { tab: L('Drumul spre B2', 'Road to B2'), fmt: dec, unit: '%', pp: true, what: L('Drumul parcurs până la B2', 'Progress towards B2') },
};
const RANGES = [[7, L('7Z', '7D')], [30, L('30Z', '30D')], [90, L('90Z', '90D')], [0, L('Tot', 'All')]];
const NS = 'http://www.w3.org/2000/svg';
const s = (tag, attrs = {}, ...kids) => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== null && v !== undefined) el.setAttribute(k, v);
  el.append(...kids);
  return el;
};
const dayLabel = (key, long) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(locale, long ? { weekday: 'short', day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short' });
};

function dayKeys(n) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); out.push(today(d)); }
  return out;
}
function allDays() {
  const keys = [...Object.keys(S.p.days || {}), ...Object.keys(S.p.history || {})].sort();
  if (!keys.length) return 7;
  const [y, m, d] = keys[0].split('-').map(Number);
  return Math.max(7, Math.round((new Date().setHours(12, 0, 0, 0) - new Date(y, m - 1, d, 12).getTime()) / 864e5) + 1);
}
/** [{ d: 'YYYY-MM-DD', v, xp }] — v = the metric at the end of that day, xp = XP earned that day. */
function buildSeries(metric, n) {
  const dates = dayKeys(n);
  const days = S.p.days || {};
  if (metric === 'xp') {
    const keys = Object.keys(days).sort();
    let cum = 0, ki = 0;
    return dates.map((d) => { while (ki < keys.length && keys[ki] <= d) cum += days[keys[ki++]]; return { d, v: cum, xp: days[d] || 0 }; });
  }
  const hist = S.p.history || {};
  const keys = Object.keys(hist).sort();
  let ki = 0, last = null;
  // days before the first snapshot stay empty (v = null): the line starts where the history starts
  return dates.map((d) => { while (ki < keys.length && keys[ki] <= d) last = hist[keys[ki++]][metric] ?? last; return { d, v: last, xp: days[d] || 0 }; });
}
function niceStep(span, count) {
  const raw = span / count, mag = 10 ** Math.floor(Math.log10(raw)), f = raw / mag;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * mag;
}

export function progressChart() {
  let metric = 'xp', range = 30;
  try { const saved = JSON.parse(localStorage.getItem('el-chart') || '{}'); if (METRICS[saved.metric]) metric = saved.metric; if (RANGES.some((r) => r[0] === saved.range)) range = saved.range; } catch { /* default */ }
  const remember = () => { try { localStorage.setItem('el-chart', JSON.stringify({ metric, range })); } catch { /* ignore */ } };

  const tabs = h('div.tabs.chart-tabs');
  const ranges = h('div.chart-ranges');
  const head = h('div.chart-head');
  const plot = h('div.chart-plot');
  const note = h('p.muted.small');
  const table = h('details.script.chart-table');
  const card = h('div.card.chart-card', h('div.row.between.wrap', tabs, ranges), head, plot, note, table);

  function draw() {
    const M = METRICS[metric];
    tabs.replaceChildren(...Object.entries(METRICS).map(([k, m]) => h('button.tab' + (k === metric ? '.on' : ''), { onclick: () => { metric = k; remember(); draw(); } }, m.tab)));
    ranges.replaceChildren(...RANGES.map(([n, label]) => h('button.range' + (n === range ? '.on' : ''), { onclick: () => { range = n; remember(); draw(); } }, label)));

    const data = buildSeries(metric, range || allDays());
    if (data[data.length - 1].v === null) data[data.length - 1].v = 0;
    const known = data.map((p, i) => ({ ...p, i })).filter((p) => p.v !== null);
    const short = known.length < 2;
    const first = known[0].v, last = known[known.length - 1].v, delta = last - first;
    const dir = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
    const rawPct = !M.pp && first > 0 ? (delta / first) * 100 : null;
    const pctChange = rawPct !== null && Math.abs(rawPct) < 1000 ? rawPct : null; // "+3840%" from a tiny start says nothing
    const sign = delta > 0 ? '+' : delta < 0 ? '−' : '';
    const period = range ? L(`în ultimele ${range} zile`, `in the last ${range} days`) : L('de la început', 'since the start');

    head.replaceChildren(
      h('div.chart-value', M.fmt(last), h('small', M.unit)),
      h('div.chart-change.' + dir,
        h('span.arrow', dir === 'up' ? '▲' : dir === 'down' ? '▼' : '■'),
        h('span', `${sign}${M.fmt(Math.abs(delta))}${M.pp ? L(' pp', ' pts') : M.unit}`, pctChange !== null ? ` (${sign}${dec(Math.abs(pctChange))}%)` : '', ` ${period}`)));
    note.textContent = short && metric !== 'xp' ? L('Istoricul pentru acest indicator începe de azi — graficul se umple zi de zi, pe măsură ce înveți.', 'The history for this measure starts today — the chart fills in day by day as you learn.')
      : metric === 'w' ? L('Linia poate și să scadă: un cuvânt iese din „învățate” dacă îl uiți la cartonașe.', 'The line can also go down: a word leaves "learned" if you forget it in the flashcards.') : '';

    // ---- geometry ----
    const W = Math.max(320, plot.clientWidth || 720), padL = 6, padR = 54, top = 14, H = 250, gapY = 36, VH = 54;
    const plotW = W - padL - padR, n = data.length, band = plotW / n;
    const x = (i) => padL + (i + 0.5) * band;
    let lo = Math.min(...known.map((p) => p.v)), hi = Math.max(...known.map((p) => p.v));
    if (hi === lo) { hi += 1; lo = Math.max(0, lo - 1); }
    const step = niceStep(hi - lo, 4);
    lo = Math.max(0, Math.floor(lo / step) * step); hi = Math.ceil(hi / step) * step;
    const y = (v) => top + (1 - (v - lo) / (hi - lo)) * (H - top);
    const totalH = H + gapY + VH + 22;

    const svg = s('svg', { width: W, height: totalH, viewBox: `0 0 ${W} ${totalH}`, role: 'img', 'aria-label': L(`${M.what}, ${period}: de la ${M.fmt(first)} la ${M.fmt(last)}${M.unit}`, `${M.what}, ${period}: from ${M.fmt(first)} to ${M.fmt(last)}${M.unit}`) });
    const col = `var(--${dir === 'down' ? 'down' : dir === 'up' ? 'up' : 'flatc'})`;
    svg.append(s('defs', {}, s('linearGradient', { id: 'chart-fill', x1: 0, y1: 0, x2: 0, y2: 1 },
      s('stop', { offset: '0', style: `stop-color:${col};stop-opacity:.32` }), s('stop', { offset: '1', style: `stop-color:${col};stop-opacity:0` }))));

    // grid + y labels (recessive)
    for (let v = lo; v <= hi + step / 1e6; v += step) {
      svg.append(s('line', { x1: padL, x2: padL + plotW, y1: y(v), y2: y(v), class: 'grid' }),
        s('text', { x: padL + plotW + 8, y: y(v) + 4, class: 'axis' }, M.pp ? dec(v) : int(v)));
    }
    // x labels: about 5, always including the last day
    const every = Math.max(1, Math.ceil(n / 5));
    for (let i = n - 1; i >= 0; i -= every) svg.append(s('text', { x: x(i), y: H + 16, class: 'axis', 'text-anchor': i === n - 1 ? 'end' : 'middle' }, dayLabel(data[i].d)));

    // reference line at the starting value (like "previous close")
    svg.append(s('line', { x1: padL, x2: padL + plotW, y1: y(first), y2: y(first), class: 'ref' }));
    // area + line
    const pts = known.map((p) => `${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`);
    if (known.length > 1) {
      svg.append(s('path', { d: `M${x(known[0].i).toFixed(1)},${H} L${pts.join(' L')} L${x(n - 1).toFixed(1)},${H} Z`, fill: 'url(#chart-fill)' }),
        s('path', { d: `M${pts.join(' L')}`, fill: 'none', stroke: col, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
    }
    svg.append(s('circle', { cx: x(n - 1), cy: y(last), r: 5, fill: col, class: 'ring' }));

    // "XP per day" strip — a separate little chart with its own baseline
    const v0 = H + gapY + VH, maxXp = Math.max(S.p.goal, ...data.map((p) => p.xp));
    const bw = Math.max(2, Math.min(18, band - 2)), r = Math.min(4, bw / 2);
    svg.append(s('text', { x: padL, y: H + gapY - 6, class: 'axis strong' }, L('XP pe zi', 'XP per day')));
    const goalY = v0 - (S.p.goal / maxXp) * VH;
    svg.append(s('line', { x1: padL, x2: padL + plotW, y1: goalY, y2: goalY, class: 'ref' }),
      s('text', { x: padL + plotW + 8, y: goalY + 4, class: 'axis' }, L(`țintă ${S.p.goal}`, `goal ${S.p.goal}`)),
      s('line', { x1: padL, x2: padL + plotW, y1: v0, y2: v0, class: 'grid' }));
    const bars = data.map((p, i) => {
      const bh = p.xp ? Math.max(3, (p.xp / maxXp) * VH) : 0;
      if (!bh) return null;
      const bx = x(i) - bw / 2, by = v0 - bh, rr = Math.min(r, bh);
      const bar = s('path', { d: `M${bx},${v0} V${by + rr} Q${bx},${by} ${bx + rr},${by} H${bx + bw - rr} Q${bx + bw},${by} ${bx + bw},${by + rr} V${v0} Z`, class: 'bar' });
      svg.append(bar);
      return bar;
    });

    // ---- hover layer ----
    const cross = s('line', { y1: top, y2: v0, class: 'cross', visibility: 'hidden' });
    const dot = s('circle', { r: 5, fill: col, class: 'ring', visibility: 'hidden' });
    svg.append(cross, dot);
    const tip = h('div.chart-tip.hidden');
    const move = (e) => {
      const rect = svg.getBoundingClientRect();
      const i = Math.max(0, Math.min(n - 1, Math.floor(((e.clientX - rect.left) * (W / rect.width) - padL) / band)));
      const p = data[i], prev = data[i - 1], has = p.v !== null;
      cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i)); cross.setAttribute('visibility', 'visible');
      dot.setAttribute('cx', x(i)); dot.setAttribute('cy', has ? y(p.v) : 0); dot.setAttribute('visibility', has ? 'visible' : 'hidden');
      bars.forEach((b, bi) => b && b.classList.toggle('hot', bi === i));
      const dd = has && prev && prev.v !== null ? p.v - prev.v : 0;
      tip.replaceChildren(h('div.tip-date', dayLabel(p.d, true)),
        has ? h('div.tip-val', M.fmt(p.v), M.unit, dd ? h('span.tip-d', ` ${dd > 0 ? '▲ +' : '▼ −'}${M.fmt(Math.abs(dd))}${M.pp ? L(' pp', ' pts') : ''}`) : null) : h('div.tip-xp', L('fără date pentru acest indicator', 'no data for this measure')),
        h('div.tip-xp', L(`${p.xp} XP în acea zi`, `${p.xp} XP that day`)));
      tip.classList.remove('hidden');
      const px = (x(i) / W) * rect.width;
      tip.style.left = `${Math.max(0, Math.min(rect.width - tip.offsetWidth, px > rect.width / 2 ? px - tip.offsetWidth - 12 : px + 12))}px`;
      tip.style.top = `${Math.max(0, ((has ? y(p.v) : top + 40) / totalH) * rect.height - tip.offsetHeight - 10)}px`;
    };
    const leave = () => { cross.setAttribute('visibility', 'hidden'); dot.setAttribute('visibility', 'hidden'); tip.classList.add('hidden'); bars.forEach((b) => b && b.classList.remove('hot')); };
    svg.addEventListener('pointermove', move);
    svg.addEventListener('pointerdown', move);
    svg.addEventListener('pointerleave', leave);
    plot.replaceChildren(svg, tip);

    // ---- table view ----
    const rows = known.slice(-60).reverse();
    table.replaceChildren(h('summary', L('📋 Vezi datele ca tabel', '📋 Show the data as a table')),
      h('div.table-wrap', h('table.g-table', h('thead', h('tr', h('th', L('Ziua', 'Day')), h('th', M.what), h('th', L('XP în acea zi', 'XP that day')))),
        h('tbody', rows.map((p) => h('tr', h('td', dayLabel(p.d, true)), h('td', M.fmt(p.v) + M.unit), h('td', String(p.xp))))))));
  }

  let lastW = 0;
  const ro = new ResizeObserver(() => { const w = plot.clientWidth; if (w && Math.abs(w - lastW) > 4) { lastW = w; draw(); } });
  ro.observe(plot);
  draw();
  return { node: card, stop: () => ro.disconnect() };
}
