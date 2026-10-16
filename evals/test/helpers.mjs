// Shared fixtures for the checker tests. Every test builds its own temporary Git
// repository and runs the real checker against it.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const CHECK = path.resolve(HERE, '..', 'check.mjs');

export function gitIn(dir, ...args) {
  return execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', '-c', 'tag.gpgsign=false', ...args], { cwd: dir, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
}

export function write(dir, files) {
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    if (content === null) { fs.rmSync(abs, { force: true }); continue; }
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, typeof content === 'string' ? content : JSON.stringify(content, null, 2) + '\n');
  }
}

export function commitAll(dir, message = 'update') {
  gitIn(dir, 'add', '-A');
  gitIn(dir, 'commit', '-q', '--allow-empty', '-m', message);
  return gitIn(dir, 'rev-parse', 'HEAD').trim();
}

export function makeProject(files, { commit = true } = {}) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'trip-check-')));
  gitIn(dir, 'init', '-q', '-b', 'main');
  write(dir, files);
  if (commit) commitAll(dir, 'initial');
  return dir;
}

export function runCheck(dir, args, { cwd = dir, reportDir = '.' } = {}) {
  const file = path.join(dir, reportDir, '.trip-check', 'report.json');
  fs.rmSync(file, { force: true });
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CHECK, ...args], { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', d => { stdout += d; });
    child.stderr.on('data', d => { stderr += d; });
    child.on('error', reject);
    child.on('close', code => {
      const report = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
      resolve({ code, report, stdout, stderr });
    });
  });
}

// Checksum-valid synthetic card number, built at runtime so no full value is committed.
export function syntheticCard(prefix = '4' + '1'.repeat(14)) {
  const digits = prefix.split('').map(Number);
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = digits[digits.length - 1 - i];
    if (i % 2 === 0) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return prefix + ((10 - (sum % 10)) % 10);
}

// A small static server for E5 and L3 reachability tests.
export function serveDir(dir) {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      let file = path.join(dir, p);
      if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
      if (!file.startsWith(dir) || !fs.existsSync(file)) { res.writeHead(404); return res.end('Not found'); }
      const type = file.endsWith('.html') ? 'text/html' : file.endsWith('.js') ? 'text/javascript' : 'text/plain';
      res.writeHead(200, { 'Content-Type': type });
      res.end(fs.readFileSync(file));
    });
    server.listen(0, '127.0.0.1', () => resolve({
      url: `http://127.0.0.1:${server.address().port}/`,
      close: () => new Promise(r => { server.closeAllConnections(); server.close(() => r()); }),
    }));
  });
}

export async function closedPortUrl() {
  const s = await serveDir(os.tmpdir());
  await s.close();
  return s.url;
}

export const LEDGER = {
  ledger: 1,
  commitments: [
    { id: 'flight-out', what: 'Outbound flight', date: '2027-03-13', time: '10:25', time_zone: 'America/Chicago', status: 'confirmed', private_ref: 'bookings#flight-out' },
    { id: 'hotel', what: 'Hotel, two nights', date: '2027-03-13', end_date: '2027-03-15', status: 'tentative' },
  ],
  facts: [
    { id: 'museum-closed-tue', claim: 'The museum is closed on Tuesdays.', status: 'sourced', source: 'https://example.org/visit', checked: '2026-10-05' },
  ],
  decisions: [
    { id: 'no-mountain-stay', decision: 'No overnight mountain stay.', rejected: ['Two nights in the mountains'], status: 'approved', approval: { on: '2026-10-05', evidence: 'User instruction in conversation, recorded in private/approvals.md#no-mountain-stay' } },
  ],
};

export const INDEX = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" href="data:,">
<title>Weekend trip</title>
</head>
<body>
<main id="app">Loading</main>
<script src="app.js"></script>
</body>
</html>
`;

export const APP = `const views = {
  '': '<h1>Weekend trip</h1><p data-ledger="flight-out">Outbound flight, Saturday 10:25</p><a href="#/day/1">Day 1</a>',
  '#/day/1': '<section data-day="2027-03-13"><h1>Day 1</h1><p data-ledger="flight-out">10:25 Outbound flight</p></section>',
};
function render() {
  document.getElementById('app').innerHTML = views[location.hash] ?? views[''];
}
addEventListener('hashchange', render);
render();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
`;

// The service worker pattern from cookbook/build.md: prefixed caches, no unconditional skipWaiting.
export const swSource = (files = ['./', 'app.js'], { claim = true } = {}) => `const PREFIX = 'test-trip-';
const CACHE = PREFIX + 'v1';
const FILES = ${JSON.stringify(files)};
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith(PREFIX) && k !== CACHE).map(k => caches.delete(k))))${claim ? '.then(() => self.clients.claim())' : ''});
});
self.addEventListener('message', e => { if (e.data === 'activate-update') self.skipWaiting(); });
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request)));
});
`;

export function compliantFiles(overrides = {}) {
  return {
    '.gitignore': 'private/\n.trip-check/\n',
    'ledger.json': LEDGER,
    'evals/routes.txt': '# Entry\n.\n# Days\n#/day/1\n',
    'site/index.html': INDEX,
    'site/app.js': APP,
    'site/sw.js': swSource(),
    ...overrides,
  };
}

export const SITE = ['--site', 'site'];
export const detailsText = check => JSON.stringify(check.details);
