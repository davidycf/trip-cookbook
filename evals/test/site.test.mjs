// E1, E2, E3 and the G1 guards (spec section 6.5).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { makeProject, runCheck, compliantFiles, APP, INDEX, SITE, detailsText, closedPortUrl } from './helpers.mjs';

test('compliant mini site passes every required local check at root and subpath', async () => {
  const dir = makeProject(compliantFiles());
  const { code, report } = await runCheck(dir, [...SITE, '--base', 'initial']);
  for (const id of ['G1', 'E1', 'E2', 'E3', 'E4', 'L1', 'L2', 'L3', 'P1']) assert.equal(report.checks[id].result, 'PASS', `${id}: ${detailsText(report.checks[id])}`);
  assert.equal(report.checks.E5.result, 'SKIPPED');
  assert.equal(report.checks.L3.sub.reachability, 'SKIPPED');
  assert.equal(code, 0);
  assert.ok(fs.existsSync(path.join(dir, '.trip-check', 'report.md')));
  const md = fs.readFileSync(path.join(dir, '.trip-check', 'report.md'), 'utf8');
  for (const heading of ['## Automated Pass', '## Agent Reviewed', '## User Confirmation Required']) assert.ok(md.includes(heading), heading);
  assert.ok(report.agent_reviewed.some(a => a.id === 'R1' && a.status === 'awaiting review'));
  assert.ok(report.user_confirmation.some(u => u.kind === 'visibility-review'));
});

test('uncaught page exception fails E1', async () => {
  const dir = makeProject(compliantFiles({ 'site/app.js': APP + 'setTimeout(() => { throw new Error("boom in app"); }, 0);\n' }));
  const { code, report } = await runCheck(dir, [...SITE, '--base', 'initial']);
  assert.equal(report.checks.E1.result, 'FAIL');
  assert.match(detailsText(report.checks.E1), /uncaught exception: .*boom in app/);
  assert.equal(code, 1);
});

test('failed required same-origin resource fails E1', async () => {
  const dir = makeProject(compliantFiles({ 'site/index.html': INDEX.replace('</main>', '</main><img src="missing.png" alt="">') }));
  const { report } = await runCheck(dir, [...SITE, '--base', 'initial']);
  assert.equal(report.checks.E1.result, 'FAIL');
  assert.match(detailsText(report.checks.E1), /missing\.png/);
});

test('third-party failure is reported separately and does not fail E1', async () => {
  const other = await closedPortUrl();
  const dir = makeProject(compliantFiles({ 'site/index.html': INDEX.replace('</main>', `</main><img src="${other}tile.png" alt="">`) }));
  const { report } = await runCheck(dir, [...SITE, '--base', 'initial']);
  assert.equal(report.checks.E1.result, 'PASS', detailsText(report.checks.E1));
  assert.ok(report.third_party.some(t => t.url.includes('tile.png')));
  assert.ok(report.agent_reviewed.some(a => a.id === 'third-party'));
});

test('horizontal overflow fails E2', async () => {
  const dir = makeProject(compliantFiles({ 'site/index.html': INDEX.replace('</main>', '</main><div style="width:600px;height:10px"></div>') }));
  const { report } = await runCheck(dir, [...SITE, '--base', 'initial']);
  assert.equal(report.checks.E2.result, 'FAIL');
  assert.match(detailsText(report.checks.E2), /wider than the 390px viewport/);
});

test('root-absolute application dependency fails E3 but not E1', async () => {
  const dir = makeProject(compliantFiles({ 'site/index.html': INDEX.replace('src="app.js"', 'src="/app.js"') }));
  const { report } = await runCheck(dir, [...SITE, '--base', 'initial']);
  assert.equal(report.checks.E1.result, 'PASS', detailsText(report.checks.E1));
  assert.equal(report.checks.E3.result, 'FAIL');
  assert.match(detailsText(report.checks.E3), /app\.js/);
});

test('--site at the repository root fails G1 and is not served', async () => {
  const files = compliantFiles();
  const dir = makeProject({ ...files, 'index.html': INDEX });
  const { code, report } = await runCheck(dir, ['--site', '.', '--base', 'initial']);
  assert.equal(report.checks.G1.result, 'FAIL');
  assert.match(detailsText(report.checks.G1), /repository root/);
  assert.equal(report.checks.E1.result, 'SKIPPED');
  assert.equal(code, 1);
});

test('--site containing private/ fails G1', async () => {
  const dir = makeProject(compliantFiles({ 'site/private/notes.md': 'never deploy this\n' }), { commit: false });
  const { report } = await runCheck(dir, [...SITE, '--base', 'initial']);
  assert.equal(report.checks.G1.result, 'FAIL');
  assert.match(detailsText(report.checks.G1), /contains private/);
});

test('missing --base is a setup error that fails G1', async () => {
  const dir = makeProject(compliantFiles());
  const { code, report } = await runCheck(dir, [...SITE]);
  assert.equal(code, 2);
  assert.equal(report.checks.G1.result, 'FAIL');
  assert.match(detailsText(report.checks.G1), /--base is required/);
});

test('private/ or .git nested anywhere in the output fails G1', async () => {
  for (const nested of ['site/assets/private/notes.md', 'site/vendor/lib/.git/HEAD']) {
    const dir = makeProject(compliantFiles({ [nested]: 'not for deployment\n' }), { commit: false });
    const { code, report } = await runCheck(dir, [...SITE, '--base', 'initial']);
    assert.equal(report.checks.G1.result, 'FAIL', nested);
    assert.match(detailsText(report.checks.G1), /at any depth/);
    assert.equal(report.checks.E1.result, 'SKIPPED');
    assert.equal(code, 1);
  }
});
