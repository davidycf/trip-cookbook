// E4: offline preparation and comparison (spec sections 6.2 and 6.5).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { makeProject, runCheck, compliantFiles, write, APP, INDEX, swSource, SITE, detailsText } from './helpers.mjs';

test('offline route unavailable fails E4', async () => {
  // The service worker precaches only ./ and app.js and never caches page2.html.
  const dir = makeProject(compliantFiles({
    'evals/routes.txt': '.\npage2.html\n',
    'site/page2.html': INDEX.replace('Loading', 'Second page'),
    'site/sw.js': swSource(['./', 'app.js']),
  }));
  const { report } = await runCheck(dir, [...SITE, '--base', 'initial']);
  assert.equal(report.checks.E1.result, 'PASS', detailsText(report.checks.E1));
  assert.equal(report.checks.E4.result, 'FAIL');
  assert.ok(report.checks.E4.details.some(d => d.route === 'page2.html' && /offline load failed/.test(d.problem)), detailsText(report.checks.E4));
});

test('offline shell loads but prepared trip content is missing: E4 fails', async () => {
  const app = `fetch('data.json').then(r => r.json()).then(d => {
  document.getElementById('app').innerHTML = '<h1>' + d.title + '</h1><p data-ledger="flight-out">Outbound flight 10:25</p>';
}).catch(() => {});
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
`;
  const dir = makeProject(compliantFiles({
    'evals/routes.txt': '.\n',
    'site/app.js': app,
    'site/data.json': { title: 'Weekend trip' },
    'site/sw.js': swSource(['./', 'app.js']),
  }));
  const { report } = await runCheck(dir, [...SITE, '--base', 'initial']);
  assert.equal(report.checks.E1.result, 'PASS', detailsText(report.checks.E1));
  assert.equal(report.checks.E4.result, 'FAIL');
  assert.match(detailsText(report.checks.E4), /differs from the prepared online content|not visible offline/);
});

test('a page the service worker never controls fails E4 with a diagnostic', async () => {
  const dir = makeProject(compliantFiles({ 'evals/routes.txt': '.\n', 'site/sw.js': swSource(['./', 'app.js'], { claim: false }) }));
  const { report } = await runCheck(dir, [...SITE, '--base', 'initial']);
  assert.equal(report.checks.E4.result, 'FAIL');
  assert.match(detailsText(report.checks.E4), /clients\.claim\(\)/);
});

test('an offline banner marked data-offline-volatile does not fail E4', async () => {
  const app = APP + `function banner() {
  let b = document.getElementById('banner');
  if (!b) { b = document.createElement('p'); b.id = 'banner'; b.setAttribute('data-offline-volatile', ''); document.body.prepend(b); }
  b.textContent = navigator.onLine ? '' : 'Offline version, saved earlier';
}
banner();
`;
  const dir = makeProject(compliantFiles({ 'site/app.js': app }));
  const { report } = await runCheck(dir, [...SITE, '--base', 'initial']);
  assert.equal(report.checks.E4.result, 'PASS', detailsText(report.checks.E4));
});

test('data-offline-volatile wrapping a confirmed ledger element fails E4', async () => {
  const dir = makeProject(compliantFiles({
    'evals/routes.txt': '.\n',
    'site/app.js': APP.replace('<p data-ledger="flight-out">Outbound flight, Saturday 10:25</p>', '<div data-offline-volatile><p data-ledger="flight-out">Outbound flight, Saturday 10:25</p></div><p>Plan</p>'),
  }));
  const { report } = await runCheck(dir, [...SITE, '--base', 'initial']);
  assert.equal(report.checks.E4.result, 'FAIL');
  assert.match(detailsText(report.checks.E4), /\\"flight-out\\" is inside a data-offline-volatile element/);
});

test('a same-origin resource missing offline fails E4 even when the text matches', async () => {
  // style.css loads online but is not precached, so it fails offline while the text stays the same.
  const dir = makeProject(compliantFiles({
    'evals/routes.txt': '.\n',
    'site/index.html': INDEX.replace('</head>', '<link rel="stylesheet" href="style.css">\n</head>'),
    'site/style.css': 'body { font-family: serif; }\n',
    'site/sw.js': swSource(['./', 'app.js']),
  }));
  const { report } = await runCheck(dir, [...SITE, '--base', 'initial']);
  assert.equal(report.checks.E1.result, 'PASS', detailsText(report.checks.E1));
  assert.equal(report.checks.E4.result, 'FAIL');
  assert.match(detailsText(report.checks.E4), /same-origin resource unavailable offline: .*style\.css/);
});

test('offline-difference excerpts are redacted in both reports', async () => {
  const term = 'Qz' + Math.random().toString(36).slice(2, 10);
  const app = APP.replace("render();\n", `render();\nif (navigator.onLine) document.getElementById('app').insertAdjacentHTML('afterbegin', '<p>Guest: ${term}</p>');\n`);
  const dir = makeProject(compliantFiles({ 'evals/routes.txt': '.\n', 'site/app.js': app }));
  write(dir, { 'private/sensitive.txt': term + '\n' });
  const { report } = await runCheck(dir, [...SITE, '--base', 'initial']);
  assert.equal(report.checks.E4.result, 'FAIL');
  assert.match(detailsText(report.checks.E4), /custom term #1/);
  const md = fs.readFileSync(path.join(dir, '.trip-check', 'report.md'), 'utf8');
  const json = fs.readFileSync(path.join(dir, '.trip-check', 'report.json'), 'utf8');
  assert.ok(!md.toLowerCase().includes(term.toLowerCase()), 'report.md must not contain the term');
  assert.ok(!json.toLowerCase().includes(term.toLowerCase()), 'report.json must not contain the term');
});
