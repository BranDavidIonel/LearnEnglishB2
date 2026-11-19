// English Levels — tiny local server (no dependencies).
// Start:  node server.js [--open]      Port: 4747 (change with PORT=xxxx)
const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Optional: --port=4848 (or PORT=4848) and --profile=name (keeps a separate progress file, e.g. for testing)
const arg = (name) => { const a = process.argv.find((x) => x.startsWith('--' + name + '=')); return a ? a.split('=')[1] : null; };
const PORT = Number(arg('port') || process.env.PORT) || 4747;
const HOST = '127.0.0.1';
const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const DATA = path.join(ROOT, 'data');
const PROFILE = (arg('profile') || '').replace(/[^\w-]/g, '');
const USER_DIR = path.join(ROOT, PROFILE ? 'user-' + PROFILE : 'user');
const PROGRESS = path.join(USER_DIR, 'progress.json');
const LEVELS = ['a1', 'a2', 'b1', 'b2'];
// Raise this whenever the server starts sending something new that the pages need.
// The page compares it with the version it expects and asks for a restart when the server is older.
const API = 5;
const URL_ = `http://localhost:${PORT}`;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon', '.webp': 'image/webp', '.woff2': 'font/woff2',
};

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, '')); } catch { return null; }
}

function loadContent() {
  return LEVELS.map((id) => {
    const dir = path.join(DATA, id);
    const units = [];
    if (fs.existsSync(dir)) {
      for (const f of fs.readdirSync(dir).filter((n) => /^unit\d+\.json$/.test(n)).sort()) {
        const u = readJson(path.join(dir, f));
        if (!(u && u.id && Array.isArray(u.vocab) && Array.isArray(u.exercises))) continue;
        // extra words of the unit ("word bank") live next to it: unit03.json → bank03.json
        const bank = readJson(path.join(dir, f.replace(/^unit/, 'bank')));
        u.bank = bank && Array.isArray(bank.words) ? bank.words : [];
        // new questions for the unit test (sentences the learner has not seen in the unit): unit03.json → test03.json
        const test = readJson(path.join(dir, f.replace(/^unit/, 'test')));
        u.testItems = test && Array.isArray(test.questions) ? test.questions : [];
        units.push(u);
      }
    }
    units.sort((a, b) => a.order - b.order);
    const pl = readJson(path.join(dir, 'placement.json'));
    const sp = readJson(path.join(dir, 'speaking.json'));
    const speaking = sp && Array.isArray(sp.scenarios) && Array.isArray(sp.phrases) && Array.isArray(sp.questions) ? sp : null;
    return { id, name: id.toUpperCase(), units, placement: (pl && Array.isArray(pl.questions)) ? pl.questions : [], speaking };
  });
}

/** Irregular verbs (data/verbs.json), most used first. */
function loadVerbs() {
  const v = readJson(path.join(DATA, 'verbs.json'));
  return v && Array.isArray(v.verbs) ? v.verbs : [];
}

function loadCambridge() {
  const out = [];
  for (const id of ['pet', 'fce']) {
    const dir = path.join(DATA, 'cambridge', id);
    const info = readJson(path.join(dir, 'exam.json'));
    if (!info) continue;
    const tests = fs.readdirSync(dir).filter((n) => /^test\d+\.json$/.test(n)).sort()
      .map((n) => readJson(path.join(dir, n))).filter((t) => t && t.id && t.reading && t.listening);
    out.push({ ...info, id, tests });
  }
  return out;
}

function send(res, code, body, type = 'application/json; charset=utf-8') {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, URL_);
  const p = decodeURIComponent(url.pathname);

  if (p === '/api/ping') return send(res, 200, JSON.stringify({ app: 'english-levels', api: API }));
  if (p === '/api/content') return send(res, 200, JSON.stringify({ api: API, levels: loadContent(), cambridge: loadCambridge(), verbs: loadVerbs() }));

  if (p === '/api/progress' && req.method === 'GET') {
    return send(res, 200, JSON.stringify(readJson(PROGRESS) || {}));
  }
  if (p === '/api/progress' && (req.method === 'PUT' || req.method === 'POST')) {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 5e6) req.destroy(); });
    req.on('end', () => {
      try {
        const obj = JSON.parse(body);
        fs.mkdirSync(USER_DIR, { recursive: true });
        const tmp = PROGRESS + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify(obj, null, 1));
        fs.renameSync(tmp, PROGRESS);
        send(res, 200, '{"ok":true}');
      } catch (e) { send(res, 400, JSON.stringify({ error: String(e.message) })); }
    });
    return;
  }

  // static files
  let file = path.normalize(path.join(PUBLIC, p === '/' ? 'index.html' : p));
  if (!file.startsWith(PUBLIC)) return send(res, 403, 'Forbidden', 'text/plain');
  fs.readFile(file, (err, buf) => {
    if (err) return send(res, 404, 'Not found', 'text/plain');
    send(res, 200, buf, MIME[path.extname(file).toLowerCase()] || 'application/octet-stream');
  });
});

function openBrowser() {
  const cmd = process.platform === 'win32' ? `start "" "${URL_}"` : process.platform === 'darwin' ? `open "${URL_}"` : `xdg-open "${URL_}"`;
  exec(cmd, () => {});
}

// Start.bat runs the server with `node --watch`, so it restarts by itself whenever this file is
// updated. A restart must not open a new browser tab: remember which launch already opened one.
// (The watcher is our parent process and stays the same across restarts.)
const WATCHED = !!process.env.WATCH_REPORT_DEPENDENCIES;
function openOnce() {
  if (!WATCHED) return openBrowser();
  const marker = path.join(require('os').tmpdir(), `english-levels-${PORT}.opened`);
  const launch = String(process.ppid);
  try { if (fs.readFileSync(marker, 'utf8') === launch) return true; } catch { /* first start of this launch */ }
  try { fs.writeFileSync(marker, launch); } catch { /* ignore */ }
  openBrowser();
  return false;
}

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    // Probably already running: just open the browser.
    http.get(`${URL_}/api/ping`, (r) => {
      let b = '';
      r.on('data', (c) => (b += c));
      r.on('end', () => {
        if (b.includes('english-levels')) {
          console.log(`Aplicatia ruleaza deja pe ${URL_}`);
          if (process.argv.includes('--open')) openBrowser();
          setTimeout(() => process.exit(0), 500);
        } else {
          console.error(`Portul ${PORT} este ocupat de alt program. Porneste cu alt port:  set PORT=4848 && node server.js`);
          process.exit(1);
        }
      });
    }).on('error', () => { console.error(`Portul ${PORT} este ocupat.`); process.exit(1); });
  } else { console.error(e); process.exit(1); }
});

server.listen(PORT, HOST, () => {
  console.log('');
  console.log('  English Levels  —  A1 -> B2');
  console.log(`  Deschide in browser:  ${URL_}`);
  console.log('  (lasa fereastra asta deschisa cat timp inveti; Ctrl+C pentru oprire)');
  console.log('');
  if (process.argv.includes('--open') && openOnce() === true) {
    console.log('  Serverul a fost actualizat si a repornit singur. Reincarca pagina in browser (F5).');
    console.log('');
  }
});
