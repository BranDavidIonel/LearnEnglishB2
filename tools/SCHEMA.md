# Content schema (English course for a Romanian speaker)

All content lives in `data/<level>/` where `<level>` is `a1`, `a2`, `b1`, `b2`.
Each level folder contains:

- `unit01.json` … `unit10.json` — one file per unit
- `placement.json` — 12 placement-test questions for that level

Files are strict JSON (UTF-8, no comments, no trailing commas). Use real Romanian
diacritics (ă â î ș ț). All explanations for the learner are written in **Romanian**;
all material to learn is in **English**. Run `node tools/validate.js <level>` until it
reports 0 errors.

## Unit file

```jsonc
{
  "id": "a1-u01",              // "<level>-u<2 digits>"
  "level": "A1",               // A1 | A2 | B1 | B2
  "order": 1,                  // 1..10
  "title": "Hello! Nice to meet you",          // English, short, catchy
  "titleRo": "Salut! Îmi pare bine",           // Romanian
  "emoji": "👋",
  "goalRo": "La final vei putea să te prezinți și să saluți pe cineva.",

  "vocab": [                   // 14–18 items, the most useful words/phrases of the topic
    {
      "en": "apple",           // word or short phrase, lowercase unless proper noun. UNIQUE across the level
      "ro": "măr",
      "pos": "noun",           // noun | verb | adj | adv | phrase | prep | pron | conj | other
      "ipa": "/ˈæp.əl/",
      "emoji": "🍎",            // one emoji that illustrates it (always required)
      "wiki": "Apple",         // OPTIONAL: exact English Wikipedia article title, ONLY for concrete,
                               // picturable things (objects, animals, food, places). Omit for abstract words.
      "ex": "I eat an apple every day.",       // example at the unit's level
      "exRo": "Mănânc un măr în fiecare zi."
    }
  ],

  "grammar": {
    "title": "The verb 'to be'",
    "titleRo": "Verbul „a fi”",
    "sections": [              // 2–5 sections, clear and friendly, short paragraphs
      {
        "headingRo": "Când îl folosim?",
        "textRo": "Explicație în română. Poți folosi **bold** pentru cuvinte cheie.",
        "table": {             // OPTIONAL
          "headers": ["Persoană", "Formă", "Scurt"],
          "rows": [["I", "am", "I'm"], ["you", "are", "you're"]]
        },
        "examples": [          // 2–5 per section
          { "en": "I am a student.", "ro": "Eu sunt student." }
        ]
      }
    ],
    "tipsRo": [                // 2–4 typical mistakes Romanian speakers make
      "Nu spunem „I have 20 years”. Corect: **I am 20 years old**."
    ]
  },

  "dialogue": {                // short everyday conversation that uses the unit's vocab + grammar
    "titleRo": "La cafenea",
    "lines": [                 // 6–10 lines, exactly 2 speakers
      { "speaker": "Anna", "en": "Hi! I'm Anna.", "ro": "Bună! Eu sunt Anna." }
    ]
  },

  "reading": {
    "title": "My friend Tom",
    "text": "English text. A1: 60–90 words, A2: 100–140, B1: 160–220, B2: 230–300. Use \n\n between paragraphs.",
    "textRo": "Traducerea completă în română.",
    "questions": [             // exactly 4 exercises of type "mc" about the text
    ]
  },

  "exercises": [               // 18–20 exercises, mixed types, ordered easy → hard
  ],

  "video": {                   // OPTIONAL – only if you verified it exists (see below)
    "youtubeId": "xxxxxxxxxxx",
    "title": "Title of the video"
  }
}
```

## Exercise types

Every exercise has `"type"` and `"explainRo"` (one short Romanian sentence explaining
WHY the answer is correct — shown after answering). `match` does not need `explainRo`.

```jsonc
// 1. Multiple choice. 3–4 options, exactly one correct. "answer" = index of the correct option.
//    Vary the position of the correct answer (do not always use 0).
{ "type": "mc", "q": "She ___ a teacher.", "options": ["am", "is", "are"], "answer": 1, "explainRo": "…" }

// 2. Fill in the gap by typing. "q" contains exactly one "___". Hint in brackets is allowed.
//    "answers" = ALL accepted answers (include contractions/variants).
{ "type": "fill", "q": "They ___ (to be) from Spain.", "answers": ["are", "'re"], "explainRo": "…" }

// 3. Put the words in order. "words" = tokens IN THE CORRECT ORDER (the app shuffles them).
//    4–9 tokens. First word capitalised, punctuation attached to the last token. "ro" = Romanian meaning.
{ "type": "order", "words": ["Where", "are", "you", "from?"], "ro": "De unde ești?", "explainRo": "…" }

// 4. Translate Romanian → English by typing. "answers" = ALL reasonable correct translations
//    (contractions and full forms). Comparison ignores case and punctuation.
{ "type": "translate", "ro": "Eu sunt student.", "answers": ["I am a student.", "I'm a student."], "explainRo": "…" }

// 5. Listening: the app reads "audio" aloud (text-to-speech) and the learner types what they hear.
//    Keep it short (3–9 words). "answers" must include the audio text and any equivalent spelling.
{ "type": "listen", "audio": "Nice to meet you.", "answers": ["Nice to meet you."], "ro": "Îmi pare bine.", "explainRo": "…" }

// 6. Match pairs: 5 pairs [english, romanian] taken from the unit's vocabulary.
{ "type": "match", "pairs": [["dog", "câine"], ["cat", "pisică"], ["bird", "pasăre"], ["fish", "pește"], ["horse", "cal"]] }
```

Required mix in `exercises` for every unit (18–20 total):
at least 6 `mc`, 3 `fill`, 3 `order`, 2 `translate`, 2 `listen`, 1 `match`.
About half of the exercises must practise the unit's grammar, the rest its vocabulary.
Exercises must be answerable using only what this unit (and earlier units) taught.
Never write an exercise with two defensible answers unless both are in `answers`.

## placement.json

```jsonc
{
  "level": "A1",
  "questions": [               // exactly 12 "mc" exercises (same shape as above, with explainRo)
  ]                            // covering the key grammar + vocabulary of the WHOLE level,
}                              // 4 options each, ordered easy → hard, no instructions in Romanian inside "q"
```

## Video (optional, one per unit)

A short (2–12 min), free, educational YouTube video for English learners matching the unit
(e.g. BBC Learning English, British Council | LearnEnglish, English with Lucy, Easy English,
EnglishClass101, TED-Ed for B1/B2). Only include it if you verified the ID with:

    curl -s -o /dev/null -w "%{http_code}" "https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=<ID>&format=json"

and got `200`. Never invent an ID. If you cannot verify, omit `video`.

## Learner profile (IMPORTANT — tailor the content to this person)

The learner is a Romanian software developer (currently A1/A2) who builds business software
(CRMs, ERPs, web apps) and wants English mainly to:

1. **work as a programmer** — read docs, talk about code, bugs, features, deadlines, tools;
2. **find and talk to clients** — introduce himself and his services, emails, calls, meetings,
   requirements, offers, prices, negotiation, invoices, support;
3. **travel** — airport, hotel, restaurant, directions, small talk;
4. **personal life** — family, friends, hobbies, health, everyday conversation.

So: every unit keeps its grammar target, but examples, dialogues, readings and a good part of
the vocabulary should come from these worlds (roughly half career/IT/business, half
travel/everyday life — follow the theme given for each unit). Typical characters: a freelance
developer, a client who needs a CRM, a project manager, a teammate, a hotel receptionist.
At A1/A2 keep the IT words simple and international (laptop, email, password, meeting, client,
website, app, bug, team); at B1/B2 use real professional language (requirements, deadline,
estimate, invoice, deploy, stakeholder, quote, onboarding, follow up, scope).

## Quality bar

- Natural, modern, correct English (British or American, be consistent inside a unit).
- Correct, natural Romanian with diacritics.
- Fun, real-life situations (travel, food, friends, work, music, films, internet) — not dry textbook sentences.
- Difficulty must really match the CEFR level of the unit.
