// E4: offline preparation and comparison (spec sections 6.2 and 6.5).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeProject, runCheck, compliantFiles, APP, INDEX, swSource, SITE, detailsText } from './helpers.mjs';

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
