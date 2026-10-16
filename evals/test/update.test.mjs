// E6: browsers that prepared the baseline build get the current content or an update.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeProject, runCheck, compliantFiles, commitAll, gitIn, write, APP, INDEX, SITE, swSource, detailsText } from './helpers.mjs';

const CHANGED_APP = APP.replace('<h1>Weekend trip</h1>', '<h1>Weekend trip, lunch at 13:00</h1>');

function published(files = {}) {
  const dir = makeProject(compliantFiles(files));
  gitIn(dir, 'tag', 'published');
  return dir;
}
const check = dir => runCheck(dir, [...SITE, '--base', 'published']);
const STYLED = {
  'site/index.html': INDEX.replace('</head>', '<link rel="stylesheet" href="style.css">\n</head>'),
  'site/style.css': 'body { color: #222; }\n',
  'site/sw.js': swSource(['./', 'app.js', 'style.css']),
};
const bumped = (files = ['./', 'app.js']) => swSource(files).replace("'v1'", "'v2'");

test('changed content with an unchanged service worker fails E6', async () => {
  const dir = published();
  write(dir, { 'site/app.js': CHANGED_APP });
  commitAll(dir, 'Move lunch');
  const { code, report } = await check(dir);
  assert.equal(report.checks.E4.result, 'PASS', detailsText(report.checks.E4));
  assert.equal(report.checks.E6.result, 'FAIL');
  assert.match(detailsText(report.checks.E6), /offline copy still shows different content from the current build/);
  assert.equal(code, 1);
});

test('changed content with a new cache name passes E6, committed or not', async () => {
  const dir = published();
  write(dir, { 'site/app.js': CHANGED_APP, 'site/sw.js': bumped() });
  const { code, report } = await check(dir);
  assert.equal(report.checks.E6.result, 'PASS', detailsText(report.checks.E6));
  assert.equal(code, 0);
});

test('a network-first service worker passes E6 without a new version', async () => {
  const networkFirst = swSource().replace(
    'caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request))',
    'fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request, { ignoreSearch: true }))');
  const dir = published({ 'site/sw.js': networkFirst });
  write(dir, { 'site/app.js': CHANGED_APP });
  commitAll(dir, 'Move lunch');
  const { report } = await check(dir);
  assert.equal(report.checks.E6.result, 'PASS', detailsText(report.checks.E6));
});

test('E6 passes when the output is unchanged, and is not applicable before the first publication', async () => {
  const dir = published();
  write(dir, { 'NOTES.md': (await import('./helpers.mjs')).notesFile({ open: '- Nothing on the site changed.' }) });
  commitAll(dir, 'Notes only');
  const same = await check(dir);
  assert.equal(same.report.checks.E6.result, 'PASS');
  assert.match(detailsText(same.report.checks.E6), /unchanged since the baseline/);
  const initial = await runCheck(dir, [...SITE, '--base', 'initial']);
  assert.equal(initial.report.checks.E6.result, 'NOT APPLICABLE');
  assert.equal(initial.code, 0);
});

test('untracked output makes E6 not applicable and asks for a review instead', async () => {
  const dir = published({ '.gitignore': 'private/\n.trip-check/\nsite/\n' });
  write(dir, { 'site/app.js': CHANGED_APP });
  const { report } = await check(dir);
  assert.equal(report.checks.E6.result, 'NOT APPLICABLE');
  assert.match(detailsText(report.checks.E6), /not tracked in Git/);
  assert.ok(report.agent_reviewed.some(a => a.id === 'offline-update'));
});

test('a style-only change with an unchanged service worker fails E6, naming the file', async () => {
  const dir = published(STYLED);
  write(dir, { 'site/style.css': 'body { color: #036; }\n' });
  commitAll(dir, 'Darker text');
  const { code, report } = await check(dir);
  assert.equal(report.checks.E6.result, 'FAIL');
  assert.match(detailsText(report.checks.E6), /offline copies of \/style.css still differ/);
  assert.equal(code, 1);
  write(dir, { 'site/sw.js': bumped(['./', 'app.js', 'style.css']) });
  const fixed = await check(dir);
  assert.equal(fixed.report.checks.E6.result, 'PASS', detailsText(fixed.report.checks.E6));
});

test('a route new in this build does not stop E6 from testing the others', async () => {
  const dir = published();
  write(dir, { 'site/app.js': CHANGED_APP, 'site/extra.html': INDEX.replace('Weekend trip', 'Extra'), 'evals/routes.txt': '# Entry\n.\n# Days\n#/day/1\nextra.html\n' });
  commitAll(dir, 'Move lunch, add a page');
  const { code, report } = await check(dir);
  assert.equal(report.checks.E6.result, 'FAIL');
  const d = detailsText(report.checks.E6);
  assert.match(d, /extra.html: not in the baseline build/);
  assert.match(d, /still shows different content from the current build/);
  assert.equal(code, 1);
});

test('an update whose installation fails on upgrade fails E6', async () => {
  const dir = published();
  const failingUpgrade = bumped().replace(
    'e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));',
    "e.waitUntil(caches.has(PREFIX + 'v1').then(old => { if (old) throw new Error('migration failed'); return caches.open(CACHE).then(c => c.addAll(FILES)); }));");
  assert.notEqual(failingUpgrade, bumped());
  write(dir, { 'site/app.js': CHANGED_APP, 'site/sw.js': failingUpgrade });
  commitAll(dir, 'Move lunch');
  const { code, report } = await check(dir);
  assert.equal(report.checks.E4.result, 'PASS', detailsText(report.checks.E4));
  assert.equal(report.checks.E6.result, 'FAIL');
  assert.match(detailsText(report.checks.E6), /did not install \(state: redundant\)/);
  assert.equal(code, 1);
});

test('a network-first worker that never saves fresh responses fails E6', async () => {
  const noSave = swSource().replace(
    'caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request))',
    'fetch(e.request).catch(() => caches.match(e.request, { ignoreSearch: true }))');
  const dir = published({ 'site/sw.js': noSave });
  write(dir, { 'site/app.js': CHANGED_APP });
  commitAll(dir, 'Move lunch');
  const { code, report } = await check(dir);
  assert.equal(report.checks.E4.result, 'PASS', detailsText(report.checks.E4));
  assert.equal(report.checks.E6.result, 'FAIL');
  assert.equal(code, 1);
});

