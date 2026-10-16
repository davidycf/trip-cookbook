// E6: browsers that prepared the baseline build get the current content or an update.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeProject, runCheck, compliantFiles, commitAll, gitIn, write, APP, SITE, swSource, detailsText } from './helpers.mjs';

const CHANGED_APP = APP.replace('<h1>Weekend trip</h1>', '<h1>Weekend trip, lunch at 13:00</h1>');

function published(files = {}) {
  const dir = makeProject(compliantFiles(files));
  gitIn(dir, 'tag', 'published');
  return dir;
}
const check = dir => runCheck(dir, [...SITE, '--base', 'published']);

test('changed content with an unchanged service worker fails E6', async () => {
  const dir = published();
  write(dir, { 'site/app.js': CHANGED_APP });
  commitAll(dir, 'Move lunch');
  const { code, report } = await check(dir);
  assert.equal(report.checks.E4.result, 'PASS', detailsText(report.checks.E4));
  assert.equal(report.checks.E6.result, 'FAIL');
  assert.match(detailsText(report.checks.E6), /still shows its old content, and no service-worker update was found/);
  assert.equal(code, 1);
});

test('changed content with a new cache name passes E6, committed or not', async () => {
  const dir = published();
  write(dir, { 'site/app.js': CHANGED_APP, 'site/sw.js': swSource().replace("'v1'", "'v2'") });
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
