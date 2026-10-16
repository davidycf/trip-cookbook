// Protected changes, baselines and the published tag (spec sections 3.1, 3.2 and 6.5).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeProject, runCheck, compliantFiles, commitAll, gitIn, write, LEDGER, SITE, detailsText } from './helpers.mjs';

const clone = v => JSON.parse(JSON.stringify(v));
const changes = report => report.user_confirmation.filter(u => u.kind === 'protected-change');
const change = (report, id) => changes(report).find(c => c.id === id);

const BASE = (() => {
  const l = clone(LEDGER);
  l.commitments.push({ id: 'train-in', what: 'Train to the coast', date: '2027-03-14', status: 'confirmed' });
  l.commitments.push({ id: 'museum-entry', what: 'Museum timed entry', date: '2027-03-15', status: 'confirmed' });
  l.decisions.push({ id: 'coast-stay', decision: 'Two nights on the coast.', status: 'approved', approval: { on: '2026-10-06', evidence: 'User instruction in conversation' } });
  l.decisions.push({ id: 'rail-pass', decision: 'Buy a regional rail pass.', status: 'approved', approval: { on: '2026-10-06', evidence: 'User instruction in conversation' } });
  l.decisions.push({ id: 'late-dinner', decision: 'Allow one late dinner.', status: 'proposed' });
  return l;
})();
const APP_ALL = `const html = ['flight-out', 'train-in', 'museum-entry'].map(id => '<p data-ledger="' + id + '">' + id + '</p>').join('');
document.getElementById('app').innerHTML = '<h1>Trip</h1>' + html;
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
`;
const files = ledger => compliantFiles({ 'ledger.json': ledger, 'evals/routes.txt': '.\n', 'site/app.js': APP_ALL });

test('changed, deleted and downgraded confirmed commitments are each listed (uncommitted changes included)', async () => {
  const dir = makeProject(files(BASE));
  const cur = clone(BASE);
  cur.commitments.find(c => c.id === 'flight-out').time = '11:40';
  cur.commitments = cur.commitments.filter(c => c.id !== 'train-in');
  cur.commitments.find(c => c.id === 'museum-entry').status = 'tentative';
  write(dir, { 'ledger.json': cur });                                   // not committed
  const { report } = await runCheck(dir, [...SITE, '--base', 'HEAD']);
  assert.equal(report.checks.G1.result, 'PASS', detailsText(report.checks.G1));
  assert.equal(change(report, 'flight-out').change, 'modified');
  assert.deepEqual(change(report, 'flight-out').fields, ['time']);
  assert.equal(change(report, 'train-in').change, 'deleted');
  assert.equal(change(report, 'museum-entry').change, 'status changed from confirmed to tentative');
  assert.ok(changes(report).every(c => c.status === 'awaiting authorization review'));
});

test('changed, downgraded and newly approved decisions are each listed', async () => {
  const dir = makeProject(files(BASE));
  const cur = clone(BASE);
  cur.decisions.find(d => d.id === 'coast-stay').decision = 'Three nights on the coast.';
  const pass = cur.decisions.find(d => d.id === 'rail-pass');
  pass.status = 'proposed';
  delete pass.approval;
  const dinner = cur.decisions.find(d => d.id === 'late-dinner');
  dinner.status = 'approved';
  dinner.approval = { on: '2026-10-10', evidence: 'User instruction in conversation' };
  cur.decisions.push({ id: 'ferry', decision: 'Take the morning ferry.', status: 'approved', approval: { on: '2026-10-10', evidence: 'Merged PR' } });
  write(dir, { 'ledger.json': cur });
  const { report } = await runCheck(dir, [...SITE, '--base', 'HEAD']);
  assert.equal(change(report, 'coast-stay').change, 'modified');
  assert.equal(change(report, 'rail-pass').change, 'status changed from approved to proposed');
  assert.equal(change(report, 'late-dinner').change, 'newly approved');
  assert.equal(change(report, 'ferry').change, 'added as approved');
  assert.equal(change(report, 'no-mountain-stay'), undefined);
});

test('a missing baseline fails G1 and never produces a false empty change list', async () => {
  const dir = makeProject(files(BASE));
  const { code, report } = await runCheck(dir, [...SITE, '--base', 'no-such-ref']);
  assert.equal(report.checks.G1.result, 'FAIL');
  assert.match(detailsText(report.checks.G1), /does not resolve to a commit/);
  assert.ok(report.user_confirmation.some(u => u.kind === 'comparison-incomplete'));
  assert.equal(code, 1);
});

test('a baseline commit without a ledger fails G1', async () => {
  const dir = makeProject({ 'README.md': 'empty start\n' });
  const first = gitIn(dir, 'rev-parse', 'HEAD').trim();
  write(dir, files(BASE));
  commitAll(dir, 'add trip');
  const { report } = await runCheck(dir, [...SITE, '--base', first]);
  assert.equal(report.checks.G1.result, 'FAIL');
  assert.match(detailsText(report.checks.G1), /has no ledger\.json/);
});

test('explicit initial baseline works and still lists approved decisions and the visibility reminder', async () => {
  const dir = makeProject(files(BASE));
  const { report } = await runCheck(dir, [...SITE, '--base', 'initial']);
  assert.equal(report.checks.G1.result, 'PASS', detailsText(report.checks.G1));
  for (const id of ['no-mountain-stay', 'coast-stay', 'rail-pass']) assert.equal(change(report, id).change, 'added as approved');
  assert.ok(report.user_confirmation.some(u => u.kind === 'visibility-review'));
});

test('a --base that differs from the published tag is listed', async () => {
  const dir = makeProject(files(BASE));
  gitIn(dir, 'tag', 'published');
  write(dir, { 'NOTES.md': 'later work\n' });
  commitAll(dir, 'later');
  const { report } = await runCheck(dir, [...SITE, '--base', 'HEAD']);
  assert.ok(report.user_confirmation.some(u => u.kind === 'baseline-mismatch'));
  const same = await runCheck(dir, [...SITE, '--base', 'published']);
  assert.ok(!same.report.user_confirmation.some(u => u.kind === 'baseline-mismatch'));
});

test('with --root in a subdirectory, the baseline ledger is read from the same repository path', async () => {
  const inner = files(BASE);
  const dir = makeProject(Object.fromEntries(Object.entries(inner).map(([k, v]) => [k === '.gitignore' ? k : `trip/${k}`, v])));
  const cur = clone(BASE);
  cur.commitments.find(c => c.id === 'flight-out').time = '11:40';
  write(dir, { 'trip/ledger.json': cur });
  const { report } = await runCheck(dir, ['--root', 'trip', '--site', 'trip/site', '--base', 'HEAD'], { cwd: dir, reportDir: 'trip' });
  assert.equal(report.checks.G1.result, 'PASS', detailsText(report.checks.G1));
  assert.equal(change(report, 'flight-out').change, 'modified');
});
