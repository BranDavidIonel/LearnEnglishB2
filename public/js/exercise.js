// Exercise engine: renders one exercise at a time, checks answers, gives feedback.
import { h, md, gap, shuffle, checkText, norm, speak, stopSpeak, sfx } from './util.js';
import { L } from './i18n.js';

const TYPE_LABEL = {
  mc: L('Alege varianta corectă', 'Choose the correct answer'), fill: L('Completează spațiul liber', 'Fill in the gap'), order: L('Pune cuvintele în ordine', 'Put the words in order'),
  translate: L('Tradu în engleză', 'Translate into English'), listen: L('Ascultă și scrie ce auzi', 'Listen and type what you hear'), match: L('Potrivește perechile', 'Match the pairs'),
};

/**
 * Runs a session.
 * items: [{ ex, unit?, key? }]
 * opts: { mode: 'practice' | 'test', title, onFinish(results), onExit(), context? (HTML node shown above, e.g. reading text) }
 * practice: shows explanation after each answer and repeats wrong ones at the end.
 * test: shows only right/wrong, no repeats.
 * results: [{ ex, unit, key, correct }] (first attempt only)
 */
export function runSession(root, items, opts = {}) {
  const mode = opts.mode || 'practice';
  const queue = items.map((it, i) => ({ ...it, n: i, retry: false }));
  const results = [];
  let pos = 0;
  let cleanup = null;

  const bar = h('div.bar', h('div.bar-fill'));
  const counter = h('span.sess-count');
  const stage = h('div.stage');
  const exitBtn = h('button.icon-btn', { title: L('Ieși', 'Exit'), onclick: () => { if (confirm(L('Sigur vrei să ieși? Progresul din această sesiune se pierde.', 'Are you sure you want to exit? Your progress in this session will be lost.'))) { stop(); opts.onExit && opts.onExit(); } } }, '✕');
  root.replaceChildren(h('div.session',
    h('div.sess-top', exitBtn, bar, counter),
    opts.title ? h('div.sess-title', opts.title) : null,
    stage));

  const onKey = (e) => { if (cleanup && cleanup.key) cleanup.key(e); };
  document.addEventListener('keydown', onKey);
  function stop() { document.removeEventListener('keydown', onKey); stopSpeak(); }

  function next() {
    if (pos >= queue.length) { stop(); return opts.onFinish && opts.onFinish(results); }
    const item = queue[pos];
    const doneFirst = results.length;
    bar.firstChild.style.width = `${Math.round((doneFirst / items.length) * 100)}%`;
    counter.textContent = item.retry ? L('Repetare', 'Retry') : `${Math.min(doneFirst + 1, items.length)} / ${items.length}`;
    cleanup = renderExercise(stage, item.ex, {
      mode, retry: item.retry,
      onAnswer(correct) {
        if (!item.retry) results.push({ ex: item.ex, unit: item.unit, key: item.key, correct });
        if (!correct && mode === 'practice' && !item.retry) queue.push({ ...item, retry: true });
      },
      onNext() { pos++; next(); },
    });
  }
  next();
  return stop;
}

/** Renders a single exercise into `stage`. Returns { key(e) } for keyboard handling. */
export function renderExercise(stage, ex, { mode, retry, onAnswer, onNext }) {
  let answered = false;
  const api = {};
  const body = h('div.ex-body');
  const footer = h('div.ex-foot');
  const checkBtn = h('button.btn.primary.big', { disabled: true }, L('Verifică', 'Check'));
  footer.append(checkBtn);
  stage.replaceChildren(h('div.ex.fade-in',
    h('div.ex-type', retry ? L('🔁 Încă o dată: ', '🔁 One more time: ') : '', TYPE_LABEL[ex.type] || ''), body, footer));

  function finish(correct, rightAnswer, note) {
    if (answered) return;
    answered = true;
    sfx(correct ? 'ok' : 'bad');
    onAnswer(correct);
    const fb = h('div.feedback.' + (correct ? 'good' : 'bad'),
      h('div.fb-head', correct ? (note || pick(L(['Corect! 🎉', 'Bravo! ✅', 'Exact! 💪', 'Perfect! ⭐'], ['Correct! 🎉', 'Well done! ✅', 'Exactly! 💪', 'Perfect! ⭐']))) : L('Nu chiar… ❌', 'Not quite… ❌')),
      !correct && rightAnswer ? h('div.fb-answer', L('Răspuns corect: ', 'Correct answer: '), h('strong', rightAnswer)) : null,
      correct && note && rightAnswer ? h('div.fb-answer', L('Forma corectă: ', 'Correct spelling: '), h('strong', rightAnswer)) : null,
      (mode === 'practice' && ex.explainRo) ? h('div.fb-explain', { html: '💡 ' + md(ex.explainRo) }) : null);
    const nextBtn = h('button.btn.big.' + (correct ? 'success' : 'danger'), { onclick: onNext }, L('Continuă →', 'Continue →'));
    footer.replaceChildren(fb, nextBtn);
    nextBtn.focus();
  }
  api.key = (e) => {
    if (e.key === 'Enter') {
      if (answered) { e.preventDefault(); onNext(); }
      else if (!checkBtn.disabled && ex.type !== 'mc' && ex.type !== 'match') { e.preventDefault(); checkBtn.click(); }
    } else if (api.extraKey) api.extraKey(e);
  };

  // ---------- multiple choice ----------
  if (ex.type === 'mc') {
    checkBtn.remove();
    const order = shuffle(ex.options.map((_, i) => i));
    const btns = order.map((oi, n) => h('button.opt', {
      onclick: () => {
        if (answered) return;
        btns.forEach((b) => { b.disabled = true; });
        btns[order.indexOf(ex.answer)].classList.add('right');
        if (oi !== ex.answer) btns[n].classList.add('wrong');
        finish(oi === ex.answer, ex.options[ex.answer]);
      },
    }, h('span.opt-n', String(n + 1)), h('span', ex.options[oi])));
    body.append(h('div.ex-q', { html: gap(ex.q) }), h('div.opts', btns));
    api.extraKey = (e) => { const n = Number(e.key); if (!answered && n >= 1 && n <= btns.length) btns[n - 1].click(); };
  }

  // ---------- fill the gap ----------
  else if (ex.type === 'fill') {
    const input = h('input.gap-input', { type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', placeholder: '…' });
    const [before, after] = ex.q.split(/_{3,}/);
    body.append(h('div.ex-q.fill-q', h('span', { html: md(before) }), input, h('span', { html: md(after || '') })));
    input.addEventListener('input', () => { checkBtn.disabled = !input.value.trim(); });
    checkBtn.onclick = () => {
      const r = checkText(input.value, ex.answers);
      input.disabled = true; input.classList.add(r.ok ? 'right' : 'wrong');
      finish(r.ok, ex.answers[0]);
    };
    setTimeout(() => input.focus(), 50);
  }

  // ---------- word order ----------
  else if (ex.type === 'order') {
    let bankOrder = shuffle(ex.words.map((w, i) => ({ w, i })));
    if (bankOrder.every((x, i) => x.i === i)) bankOrder = bankOrder.reverse();
    const chosen = [];
    const line = h('div.order-line');
    const bank = h('div.order-bank');
    const draw = () => {
      line.replaceChildren(...chosen.map((x) => h('button.chip', { onclick: () => { if (answered) return; chosen.splice(chosen.indexOf(x), 1); draw(); } }, x.w)));
      if (!chosen.length) line.append(h('span.muted', L('Apasă pe cuvinte în ordinea corectă', 'Tap the words in the right order')));
      bank.replaceChildren(...bankOrder.map((x) => h('button.chip' + (chosen.includes(x) ? '.used' : ''), { disabled: chosen.includes(x), onclick: () => { if (answered) return; chosen.push(x); draw(); } }, x.w)));
      checkBtn.disabled = chosen.length !== ex.words.length;
    };
    body.append(h('div.ex-q', '🇷🇴 ', ex.ro), line, bank);
    draw();
    checkBtn.onclick = () => {
      const got = norm(chosen.map((x) => x.w).join(' '), false);
      const targets = [ex.words, ...(ex.alt || [])].map((ws) => norm(ws.join(' '), false));
      const ok = targets.includes(got);
      line.classList.add(ok ? 'right' : 'wrong');
      if (ok) speak(ex.words.join(' '));
      finish(ok, ex.words.join(' '));
    };
  }

  // ---------- translate / listen (typing) ----------
  else if (ex.type === 'translate' || ex.type === 'listen') {
    const isListen = ex.type === 'listen';
    const input = h('textarea.type-input', { rows: 2, autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', placeholder: isListen ? L('Scrie în engleză ce auzi…', 'Type what you hear in English…') : L('Scrie traducerea în engleză…', 'Type the English translation…') });
    if (isListen) {
      body.append(h('div.listen-box',
        h('button.btn.round.primary', { onclick: () => { speak(ex.audio); input.focus(); } }, '🔊'),
        h('button.btn.round', { title: L('Mai rar', 'Slower'), onclick: () => { speak(ex.audio, { slow: true }); input.focus(); } }, '🐢'),
        h('span.muted', L('Apasă ca să asculți din nou', 'Tap to listen again'))));
      setTimeout(() => speak(ex.audio), 350);
    } else {
      body.append(h('div.ex-q', '🇷🇴 ', ex.ro));
    }
    body.append(input);
    input.addEventListener('input', () => { checkBtn.disabled = !input.value.trim(); });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.preventDefault(); });
    checkBtn.onclick = () => {
      const r = checkText(input.value, ex.answers, true);
      input.disabled = true; input.classList.add(r.ok ? 'right' : 'wrong');
      if (isListen && ex.ro) body.append(h('div.muted.mt', '🇷🇴 ', ex.ro));
      if (!isListen && r.ok) speak(ex.answers[0]);
      finish(r.ok, ex.answers[0], r.typo ? L('Corect, dar ai o mică greșeală de scriere ✍️', 'Correct, but with a small spelling mistake ✍️') : null);
    };
    setTimeout(() => input.focus(), 50);
  }

  // ---------- match pairs ----------
  else if (ex.type === 'match') {
    checkBtn.remove();
    let sel = null, errors = 0, left = ex.pairs.length;
    const mk = (text, side, id) => {
      const b = h('button.match-item', {
        onclick: () => {
          if (b.classList.contains('done')) return;
          if (side === 'en') speak(text);
          if (!sel || sel.side === side) { if (sel) sel.b.classList.remove('sel'); sel = { b, side, id }; b.classList.add('sel'); return; }
          const other = sel; sel = null; other.b.classList.remove('sel');
          if (other.id === id) {
            [b, other.b].forEach((x) => { x.classList.add('done'); x.disabled = true; });
            sfx('flip');
            if (--left === 0) finish(errors <= 1, null);
          } else {
            errors++;
            [b, other.b].forEach((x) => { x.classList.add('shake'); setTimeout(() => x.classList.remove('shake'), 400); });
          }
        },
      }, text);
      return b;
    };
    const ens = shuffle(ex.pairs.map((p, i) => mk(p[0], 'en', i)));
    const ros = shuffle(ex.pairs.map((p, i) => mk(p[1], 'ro', i)));
    body.append(h('div.match', h('div.match-col', ens), h('div.match-col', ros)));
  }

  else { body.append(h('p', L('Tip de exercițiu necunoscut.', 'Unknown exercise type.'))); checkBtn.disabled = false; checkBtn.onclick = () => finish(true); }

  return api;
}

const pick = (a) => a[Math.floor(Math.random() * a.length)];

/** Summary card after a session. */
export function resultCard({ score, passed, title, lines = [], actions = [], passMark }) {
  const pct = Math.round(score * 100);
  return h('div.result.fade-in',
    h('div.result-ring' + (passed === false ? '.fail' : ''), { style: `--p:${pct}` }, h('span', pct + '%')),
    h('h2', title),
    passMark ? h('p.muted', L(`Prag de trecere: ${Math.round(passMark * 100)}%`, `Pass mark: ${Math.round(passMark * 100)}%`)) : null,
    lines.map((l) => (l instanceof Node ? l : h('p', { html: md(l) }))),
    h('div.row.center.wrap', actions));
}
