// "My words": the whole vocabulary with its status, and ways to say "I know this" or "teach me this now".
import { h, speak, speakBtn, picture, modal, shuffle, sample, sfx, toast, checkText } from '../util.js';
import { S, save, wordStatus, wordCounts, markKnown, learnWord, forgetWord, gradeWord, skippedLevelWords, addXp, LEARNED_BOX } from '../store.js';
import { header, chip, levelChip, bar } from '../ui.js';
import { L, plural } from '../i18n.js';

const STATUS = {
  learned: [L('✅ Învățat', '✅ Learned'), 'ok'],
  learning: [L('🌱 În curs', '🌱 Learning'), 'now'],
  new: [L('🆕 De învățat', '🆕 To learn'), 'lock'],
};
const nWords = (n) => `${n} ${plural(n, L('cuvânt', 'word'), L('cuvinte', 'words'))}`;

export function wordsView(main) {
  let fStatus = 'all', fLevel = 'all', q = '';
  const all = Object.values(S.wordIndex);
  const progress = h('div.card');
  const banner = h('div');
  const tabs = h('div.tabs');
  const list = h('div.word-list');
  const count = h('span.muted');
  const bulk = h('span');

  const act = (icon, title, fn) => h('button.icon-btn.word-act', { title, 'aria-label': title, onclick: (e) => { e.stopPropagation(); fn(); save(); draw(); } }, icon);

  function draw() {
    const wc = wordCounts();
    progress.replaceChildren(
      h('div.row.between', h('span', L('Vocabular învățat', 'Vocabulary learned')), h('strong', `${wc.learned} / ${wc.total}`)),
      bar(wc.total ? wc.learned / wc.total : 0, '#22c55e'));

    // offer to mark the vocabulary of skipped levels as known
    const skipped = skippedLevelWords();
    const flags = S.p.flags || (S.p.flags = {});
    banner.replaceChildren(skipped.length && !flags.keepSkippedWords ? h('div.card.notice',
      h('div', h('strong', L('Ai sărit peste niveluri la testul de nivel.', 'You skipped levels in the placement test.')), ' ',
        L(`Marchez cele ${nWords(skipped.length)} din nivelurile de dinainte ca știute? (Le poți schimba oricând, cuvânt cu cuvânt.)`,
          `Shall I mark the ${nWords(skipped.length)} from the earlier levels as known? (You can change any of them later.)`)),
      h('div.row.wrap',
        h('button.btn.success', { onclick: () => { skipped.forEach((w) => markKnown(w.en)); save(); toast(L(`${nWords(skipped.length)} marcate ca știute ✓`, `${nWords(skipped.length)} marked as known ✓`)); draw(); } }, L('✓ Da, le știu', '✓ Yes, I know them')),
        h('button.btn', { onclick: () => { flags.keepSkippedWords = true; save(); draw(); } }, L('Nu, vreau să le parcurg', 'No, I want to go through them')))) : null);

    tabs.replaceChildren(...[['all', L('Toate', 'All'), wc.total], ['learned', L('✅ Învățate', '✅ Learned'), wc.learned], ['learning', L('🌱 În curs', '🌱 Learning'), wc.learning], ['new', L('🆕 De învățat', '🆕 To learn'), wc.new]]
      .map(([k, label, n]) => h('button.tab' + (k === fStatus ? '.on' : ''), { onclick: () => { fStatus = k; draw(); } }, `${label} (${n})`)));

    const rows = all.filter((w) => (fStatus === 'all' || wordStatus(w.en) === fStatus) && (fLevel === 'all' || w.levelId === fLevel)
      && (!q || w.en.toLowerCase().includes(q) || w.ro.toLowerCase().includes(q)));
    count.textContent = nWords(rows.length);
    const notKnown = rows.filter((w) => wordStatus(w.en) !== 'learned');
    bulk.replaceChildren(notKnown.length ? h('button.btn', { onclick: () => {
      if (!confirm(L(`Marchezi ${nWords(notKnown.length)} din lista afișată ca știute?`, `Mark the ${nWords(notKnown.length)} shown in this list as known?`))) return;
      notKnown.forEach((w) => markKnown(w.en)); save(); draw();
    } }, L(`✓ Le știu pe toate (${notKnown.length})`, `✓ I know all of these (${notKnown.length})`)) : null);

    list.replaceChildren(...rows.slice(0, 700).map((w) => {
      const st = wordStatus(w.en);
      const [label, cls] = STATUS[st];
      const box = (S.p.words[w.en] || {}).box || 0;
      return h('div.word-row', { onclick: () => wordModal(w, draw) },
        h('span.word-emoji', w.emoji), h('span.word-en', h('strong', w.en), h('small.muted', w.ipa)),
        h('span.word-ro', w.ro), levelChip(w.levelId), chip(label, cls),
        h('span.word-box', { title: L('Cât de bine îl știi', 'How well you know it') }, [0, 1, 2, 3].map((n) => h('i' + (S.p.words[w.en] && box > n ? '.on' : '')))),
        h('span.word-acts',
          st === 'learned'
            ? act('↺', L('Nu-l mai știu — vreau să-l repet', "I've forgotten it — practise it again"), () => learnWord(w.en))
            : [act('✓', L('Îl știu deja', 'I already know it'), () => markKnown(w.en)),
              h('button.icon-btn.word-act', { title: L('Învață-l acum', 'Learn it now'), 'aria-label': L('Învață-l acum', 'Learn it now'), onclick: (e) => { e.stopPropagation(); wordModal(w, draw, true); } }, '🧠')],
          speakBtn(w.en)));
    }));
    if (!rows.length) list.append(h('p.muted.center', L('Niciun cuvânt pentru filtrele alese.', 'No words match these filters.')));
  }

  main.append(
    header(L('📖 Cuvintele mele', '📖 My words'),
      L(`Un cuvânt devine „învățat” după ce îl știi la ${LEARNED_BOX} repetări la rând pe cartonașe — sau când spui tu că îl știi deja.`,
        `A word becomes “learned” after you know it ${LEARNED_BOX} times in a row on the flashcards — or when you say you already know it.`), '#/'),
    progress, banner, tabs,
    h('div.row.wrap.filters',
      h('input.search', { type: 'search', placeholder: L('🔍 Caută în engleză sau română…', '🔍 Search in English or Romanian…'), oninput: (e) => { q = e.target.value.trim().toLowerCase(); draw(); } }),
      h('select', { onchange: (e) => { fLevel = e.target.value; draw(); } }, h('option', { value: 'all' }, L('Toate nivelurile', 'All levels')), S.levels.map((l) => h('option', { value: l.id }, l.name))),
      count, bulk),
    h('p.muted.small', L('✓ = îl știu deja · 🧠 = învață-l acum · ↺ = vreau să-l repet · apasă pe un rând pentru detalii', '✓ = I already know it · 🧠 = learn it now · ↺ = practise it again · click a row for details')),
    list);
  draw();
}

/** Word details. With learn = true it opens straight into the three-step mini lesson. */
function wordModal(w, onChange, learn = false) {
  const u = S.unitById[w.unit];
  const body = h('div');
  const close = modal(body);
  const changed = () => { save(); onChange(); };

  const card = () => h('div.vcard-in', picture(w, 'big'),
    h('div.vword', h('span', w.en), speakBtn(w.en)), h('div.vipa', w.ipa, ' · ', h('em', w.pos)), h('div.vro', w.ro),
    h('div.vex', speakBtn(w.ex), h('div', h('div.en', w.ex), h('div.ro', w.exRo))));

  function details() {
    const st = wordStatus(w.en);
    const [label, cls] = STATUS[st];
    speak(w.en);
    body.replaceChildren(card(),
      h('div.center.mt', chip(label, cls), (S.p.words[w.en] || {}).known ? h('span.muted.small', ' ', L('· marcat de tine ca știut', '· marked as known by you')) : null),
      h('div.row.center.wrap.mt',
        st !== 'learned' ? h('button.btn.primary', { onclick: lesson }, L('🧠 Învață-l acum', '🧠 Learn it now')) : null,
        st !== 'learned' ? h('button.btn.success', { onclick: () => { markKnown(w.en); changed(); details(); } }, L('✓ Îl știu deja', '✓ I already know it')) : null,
        st === 'new' ? h('button.btn', { onclick: () => { learnWord(w.en); changed(); toast(L('Adăugat la cartonașe', 'Added to your flashcards')); details(); } }, L('➕ Pune-l la cartonașe', '➕ Add to flashcards')) : null,
        st === 'learned' ? h('button.btn', { onclick: () => { learnWord(w.en); changed(); details(); } }, L('↺ Vreau să-l repet', '↺ Practise it again')) : null,
        st !== 'new' ? h('button.btn', { onclick: () => { forgetWord(w.en); changed(); details(); } }, L('Scoate din cartonașe', 'Remove from flashcards')) : null),
      u ? h('p.muted.small.center', L('Din: ', 'From: '), h('a', { href: `#/unit/${u.id}`, onclick: close }, `${u.level} · ${L('Unitatea', 'Unit')} ${u.order} · ${u.title}`)) : null);
  }

  // mini lesson: look and listen → pick the meaning → type the word
  function lesson() {
    const step = (n, title, content) => body.replaceChildren(h('div.muted.small.center', L(`Pasul ${n} din 3`, `Step ${n} of 3`)), h('h3.center', title), content);
    const others = sample(Object.values(S.wordIndex).filter((x) => x.levelId === w.levelId && x.ro !== w.ro), 3);

    const typeIt = () => {
      const input = h('input.gap-input.wide', { type: 'text', autocomplete: 'off', spellcheck: 'false', autocapitalize: 'off', placeholder: '…' });
      const out = h('div.mt');
      const check = () => {
        if (!input.value.trim()) return;
        const ok = checkText(input.value, [w.en]).ok;
        sfx(ok ? 'ok' : 'bad');
        input.classList.remove('right', 'wrong'); input.classList.add(ok ? 'right' : 'wrong');
        if (!ok) { out.replaceChildren(h('p.muted', L('Nu chiar. Se scrie: ', 'Not quite. It is spelled: '), h('strong', w.en), L(' — mai încearcă o dată.', ' — try once more.'))); speak(w.en); input.select(); return; }
        learnWord(w.en); gradeWord(w.en, 2); addXp(3); changed(); speak(w.en);
        body.replaceChildren(card(), h('div.feedback.good.mt', h('div.fb-head', L('Învățat! +3 XP ⚡', 'Learned! +3 XP ⚡')),
          h('div', L('Cuvântul e acum la cartonașe și îl repeți mâine, ca să nu-l uiți.', 'The word is now in your flashcards and comes back tomorrow, so you do not forget it.'))),
          h('div.row.center.mt', h('button.btn.primary', { onclick: close }, L('Gata', 'Done'))));
      };
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') check(); });
      step(3, L('Scrie cuvântul în engleză', 'Type the word in English'), h('div.center',
        h('div.vro', w.emoji, ' ', w.ro), input, h('div.row.center.mt', h('button.btn.primary', { onclick: check }, L('Verifică', 'Check'))), out));
      setTimeout(() => input.focus(), 50);
    };

    const pick = () => {
      const opts = shuffle([w, ...others]);
      step(2, L('Ce înseamnă?', 'What does it mean?'), h('div',
        h('div.vword', h('span', w.en), speakBtn(w.en)),
        h('div.opts.mt', opts.map((o) => h('button.opt', { onclick: (e) => {
          if (o === w) { sfx('ok'); e.currentTarget.classList.add('right'); setTimeout(typeIt, 450); }
          else { sfx('bad'); e.currentTarget.classList.add('wrong'); e.currentTarget.disabled = true; }
        } }, h('span', o.ro))))));
      speak(w.en);
    };

    speak(w.en);
    step(1, L('Privește, ascultă și repetă cu voce tare', 'Look, listen and repeat aloud'), h('div', card(),
      h('div.row.center.mt', h('button.btn.primary', { onclick: pick }, L('Am reținut →', 'Got it →')))));
  }

  if (learn) lesson(); else details();
}
