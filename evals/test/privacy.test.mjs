// P1: privacy scan coverage and exact synthetic exceptions (spec sections 5.1 and 6.5).
// Synthetic values are generated at runtime, so this file contains none in full.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeProject, runCheck, compliantFiles, commitAll, gitIn, write, syntheticCard, APP, SITE } from './helpers.mjs';

const CARD = syntheticCard();
const findingsIn = (report, scope) => report.privacy.findings.filter(f => f.scope === scope);
const neverPrinted = (report, value) => assert.ok(!JSON.stringify(report).includes(value), 'report must not contain the full matched value');

test('synthetic value in a current tracked file fails P1', async () => {
  const dir = makeProject(compliantFiles({ 'NOTES.md': `Card on file: ${CARD}\n` }));
  const { report } = await runCheck(dir, [...SITE, '--base', 'initial']);
  assert.equal(report.checks.P1.result, 'FAIL');
  assert.ok(findingsIn(report, 'tracked').some(f => f.path === 'NOTES.md' && f.pattern === 'card-number'));
  neverPrinted(report, CARD);
});

test('synthetic value only in the rendered DOM fails P1', async () => {
  const parts = [CARD.slice(0, 4), CARD.slice(4, 8), CARD.slice(8, 12), CARD.slice(12)];
  const app = APP.replace("render();\n", `render();\ndocument.body.insertAdjacentHTML('beforeend', '<p>' + ${JSON.stringify(parts)}.join('') + '</p>');\n`);
  const dir = makeProject(compliantFiles({ 'site/app.js': app }));
  const { report } = await runCheck(dir, [...SITE, '--base', 'initial']);
  assert.equal(report.checks.P1.result, 'FAIL');
  assert.ok(findingsIn(report, 'rendered').some(f => f.pattern === 'card-number'));
  assert.equal(findingsIn(report, 'tracked').length, 0);
  neverPrinted(report, CARD);
});

test('synthetic value only in an output file fails P1', async () => {
  const dir = makeProject(compliantFiles());
  write(dir, { 'site/extra.txt': `Reference ${CARD}\n` });          // untracked, output only
  const { report } = await runCheck(dir, [...SITE, '--base', 'initial']);
  assert.equal(report.checks.P1.result, 'FAIL');
  assert.ok(findingsIn(report, 'site').some(f => f.path === 'site/extra.txt'));
  assert.equal(findingsIn(report, 'tracked').length, 0);
});

test('synthetic value only in history fails P1', async () => {
  const dir = makeProject(compliantFiles({ 'old-notes.md': `Card ${CARD}\n` }));
  gitIn(dir, 'rm', '-q', 'old-notes.md');
  commitAll(dir, 'remove notes');
  const { report } = await runCheck(dir, [...SITE, '--base', 'initial']);
  assert.equal(report.checks.P1.result, 'FAIL');
  const hist = findingsIn(report, 'history');
  assert.ok(hist.some(f => f.path === 'old-notes.md' && /^[0-9a-f]{12}$/.test(f.commit)));
  assert.equal(findingsIn(report, 'tracked').length, 0);
});

test('custom terms match case-insensitively and are never printed', async () => {
  const dir = makeProject(compliantFiles({ 'NOTES.md': 'Family: the Zyxwvut household\n' }));
  write(dir, { 'private/sensitive.txt': 'zyxwvut\n' });
  const { report } = await runCheck(dir, [...SITE, '--base', 'initial']);
  assert.equal(report.checks.P1.result, 'FAIL');
  assert.ok(report.privacy.findings.some(f => f.pattern === 'custom-term' && f.match === 'custom term #1'));
  assert.equal(report.privacy.coverage.custom_terms, '1 supplied');
  neverPrinted(report, 'zyxwvut');
});

test('missing custom terms are reported, and the built-in scan still runs', async () => {
  const dir = makeProject(compliantFiles());
  const { report } = await runCheck(dir, [...SITE, '--base', 'initial']);
  assert.equal(report.privacy.coverage.custom_terms, 'custom terms not supplied');
  assert.equal(report.checks.P1.result, 'PASS');
});

test('exact approved synthetic fixture is excepted; the same value elsewhere fails', async () => {
  const allowlist = { version: 1, exceptions: [{ path: 'docs/example.md', value: CARD, pattern: 'card-number', reason: 'Documented synthetic test number' }] };
  const dir = makeProject(compliantFiles({
    'evals/privacy-fixtures.json': allowlist,
    'docs/example.md': `Example card: ${CARD}\n`,
    'other.md': `Copied: ${CARD}\n`,
  }));
  const { report } = await runCheck(dir, [...SITE, '--base', 'initial']);
  assert.equal(report.checks.P1.result, 'FAIL');
  assert.ok(report.privacy.excepted.some(f => f.path === 'docs/example.md'));
  assert.ok(report.privacy.findings.some(f => f.path === 'other.md'));
  assert.ok(!report.privacy.findings.some(f => f.path === 'docs/example.md'));
  assert.ok(report.privacy.allowlist_self_references > 0);
  assert.ok(report.agent_reviewed.some(a => a.id === 'privacy-allowlist'));
});

test('a historical exception does not cover the same blob at a second path', async () => {
  const allowlist = { version: 1, exceptions: [{ path: 'a.md', value: CARD, pattern: 'card-number', reason: 'Documented synthetic test number' }] };
  const dir = makeProject(compliantFiles({ 'evals/privacy-fixtures.json': allowlist, 'a.md': `Card ${CARD}\n`, 'b.md': `Card ${CARD}\n` }));
  gitIn(dir, 'rm', '-q', 'b.md');
  commitAll(dir, 'remove b');
  const { report } = await runCheck(dir, [...SITE, '--base', 'initial']);
  assert.equal(report.checks.P1.result, 'FAIL');
  assert.ok(report.privacy.findings.some(f => f.scope === 'history' && f.path === 'b.md'));
  assert.ok(!report.privacy.findings.some(f => f.path === 'a.md'));
});
