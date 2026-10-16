// N1 and change discovery (V0.1.1 addendum, sections 2, 4 and 7).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { makeProject, runCheck, compliantFiles, commitAll, gitIn, write, notesFile, SITE, NO_SITE, detailsText } from './helpers.mjs';

const ROUTES = '# Views\n.\n#/day/1\ndays/1/\nday.html#map\n';
const DATA = { days: { sat: { lunch: 'Harbour café' } }, list: [{ a: 1 }] };

async function n1(files, { commit = true } = {}) {
  const dir = makeProject(compliantFiles({ 'evals/routes.txt': ROUTES, 'site/data.json': DATA, ...files }), { commit });
  const { report } = await runCheck(dir, [...NO_SITE, '--base', 'initial']);
  return { check: report.checks.N1, report };
}
const where = (...tokens) => `| Topic | ${tokens.map(t => `\`${t}\``).join(', ')} |`;

test('compliant notes with every pointer form pass N1, even when the site guard fails', async () => {
  const notes = notesFile({
    where: [
      where('route:.', '#/day/1', 'route:days/1/', 'route:day.html#map'),
      where('site/app.js', 'site/', 'ledger.json#commitments', 'site/data.json#days.sat.lunch'),
    ].join('\n'),
    context: 'The flight is fixed (ledger:flight-out).',
    open: '- Hotel still tentative: ledger:hotel.',
  });
  const { check, report } = await n1({ 'NOTES.md': notes });
  assert.equal(report.checks.G1.result, 'FAIL');
  assert.equal(check.result, 'PASS', detailsText(check));
});

test('empty or "None" Context, Open and Recent changes pass N1', async () => {
  for (const v of ['', 'None.']) {
    const { check } = await n1({ 'NOTES.md': notesFile({ context: v, open: v, recent: v }) });
    assert.equal(check.result, 'PASS', `${JSON.stringify(v)}: ${detailsText(check)}`);
  }
});

test('missing notes, missing, duplicated or reordered headings, and missing tokens fail N1', async () => {
  const fail = async (files, pattern) => {
    const { check } = await n1(files);
    assert.equal(check.result, 'FAIL', String(pattern));
    assert.match(detailsText(check), pattern);
  };
  await fail({ 'NOTES.md': null }, /NOTES\.md not found/);
  const full = notesFile();
  for (const h of ['Where to look', 'Context', 'Open', 'Recent changes', 'Visibility', 'Build and deploy']) {
    await fail({ 'NOTES.md': full.replace(`## ${h}\n`, '') }, new RegExp(`required heading \\\\"## ${h}\\\\" is missing`));
  }
  await fail({ 'NOTES.md': full + '\n## Open\n\nAgain.\n' }, /\\"## Open\\" appears 2 times/);
  const swapped = full.replace('## Context\n', '## TEMP\n').replace('## Open\n', '## Context\n').replace('## TEMP\n', '## Open\n');
  await fail({ 'NOTES.md': swapped }, /\\"## Open\\" \(line \d+\) comes before \\"## Context\\"/);
  await fail({ 'NOTES.md': notesFile({ where: '| Topic | no tokens here |' }) }, /no backticked tokens in its Location column/);
  await fail({ 'NOTES.md': full.replace(/\| Topic \| Location \|[^]*?\|\n\n/, 'Everything is in site/.\n\n') }, /has no table with a Location column/);
  await fail({ 'NOTES.md': notesFile({ visibility: '' }) }, /\\"## Visibility\\" is empty/);
});

test('extra headings are accepted, and a required heading inside a code block does not count', async () => {
  const extra = await n1({ 'NOTES.md': notesFile() + '\n## Ideas\n\nA boat trip, maybe.\n' });
  assert.equal(extra.check.result, 'PASS', detailsText(extra.check));
  const fenced = notesFile().replace('## Context\n', '```markdown\n## Context\n```\n');
  const { check } = await n1({ 'NOTES.md': fenced });
  assert.equal(check.result, 'FAIL');
  assert.match(detailsText(check), /required heading \\"## Context\\" is missing/);
});

test('broken file and JSON-key pointers fail N1, each named', async () => {
  const tokens = ['site/missing.js', 'site/data.json#days.sun', 'site/data.json#list.a', 'site/data.json#toString', 'site/data.json#constructor', 'site/app.js#render', 'site/data.json#days..sat'];
  const { check } = await n1({ 'NOTES.md': notesFile({ where: where(...tokens) }) });
  assert.equal(check.result, 'FAIL');
  const d = detailsText(check);
  assert.match(d, /`site\/missing.js`: site\/missing.js does not exist/);
  assert.match(d, /`site\/data.json#days.sun`: key \\"sun\\" not found at days/);
  assert.match(d, /`site\/data.json#list.a`: list is an array/);
  assert.match(d, /`site\/data.json#toString`: key \\"toString\\" not found/);
  assert.match(d, /`site\/data.json#constructor`: key \\"constructor\\" not found/);
  assert.match(d, /`site\/app.js#render`: site\/app.js is not valid JSON/);
  assert.match(d, /`site\/data.json#days..sat`: .*empty segment/);
});

test('a route outside routes.txt, or a path route without "route:", fails N1', async () => {
  const { check } = await n1({ 'NOTES.md': notesFile({ where: where('route:#/day/9', 'day/sunday/') }) });
  assert.equal(check.result, 'FAIL');
  const d = detailsText(check);
  assert.match(d, /`route:#\/day\/9`: \\"#\/day\/9\\" is not a line of evals\/routes.txt/);
  assert.match(d, /`day\/sunday\/`: day\/sunday\/ does not exist; a site route needs the \\"route:\\" prefix/);
});

test('an unknown ledger reference in any section fails N1', async () => {
  const { check } = await n1({ 'NOTES.md': notesFile({ recent: '- 2026-10-16: boat trip dropped (ledger:boat-trip).' }) });
  assert.equal(check.result, 'FAIL');
  assert.match(detailsText(check), /ledger:boat-trip has no matching id/);
});

test('backticked text outside the Location column is not checked', async () => {
  const notes = notesFile({
    where: '| `missing.txt` | `route:.` |',
    context: 'Days render from `site/nowhere.json#days`, and `#/nowhere` is an old route. Run `node evals/check.mjs`.',
  });
  const { check } = await n1({ 'NOTES.md': notes });
  assert.equal(check.result, 'PASS', detailsText(check));
});

test('unreadable dependencies make N1 SKIPPED only when something refers to them', async () => {
  const noLedgerPointer = where('route:.', 'site/app.js');
  const refs = await n1({ 'ledger.json': '{ not json', 'NOTES.md': notesFile({ where: noLedgerPointer, context: 'See ledger:flight-out.' }) });
  assert.equal(refs.check.result, 'SKIPPED');
  assert.match(detailsText(refs.check), /ledger references not checked because ledger.json could not be read: ledger:flight-out/);

  const noRefs = await n1({ 'ledger.json': '{ not json', 'NOTES.md': notesFile({ where: noLedgerPointer }) });
  assert.equal(noRefs.check.result, 'PASS', detailsText(noRefs.check));
  assert.equal(noRefs.report.checks.L1.result, 'FAIL');

  const routes = await n1({ 'evals/routes.txt': null, 'NOTES.md': notesFile({ where: where('#/day/1', 'site/app.js') }) });
  assert.equal(routes.check.result, 'SKIPPED');
  assert.match(detailsText(routes.check), /route tokens not checked because evals\/routes.txt not found: `#\/day\/1`/);

  const broken = await n1({ 'evals/routes.txt': null, 'NOTES.md': notesFile({ where: where('#/day/1', 'site/missing.js') }) });
  assert.equal(broken.check.result, 'FAIL');
  assert.match(detailsText(broken.check), /site\/missing.js does not exist/);
  assert.match(detailsText(broken.check), /route tokens not checked/);
});

test('a failing N1 fails the run on an otherwise passing site', async () => {
  const dir = makeProject(compliantFiles({ 'NOTES.md': notesFile({ where: where('site/missing.js') }) }));
  const { code, report } = await runCheck(dir, [...SITE, '--base', 'initial']);
  assert.equal(report.checks.E4.result, 'PASS', detailsText(report.checks.E4));
  assert.equal(report.checks.N1.result, 'FAIL');
  assert.equal(code, 1);
});

// ---- change discovery

function changeBlock(dir, reportDir = '.') {
  const md = fs.readFileSync(path.join(dir, reportDir, '.trip-check', 'report.md'), 'utf8');
  const start = md.indexOf('### Changed since the last notes edit');
  assert.ok(start >= 0, 'change block missing');
  const block = md.slice(start, md.indexOf('\n## ', start));
  return block;
}
const neutral = (block, json) => {
  assert.doesNotMatch(block, /stale|current/i);
  assert.doesNotMatch(JSON.stringify(json), /stale|current/i);
};

test('commits and uncommitted edits since the last notes commit are listed, without Cookbook files or private/, and leave the exit code alone', async () => {
  const dir = makeProject(compliantFiles({ 'site/data.json': DATA }));
  write(dir, {
    'site/app.js': fs.readFileSync(path.join(dir, 'site/app.js'), 'utf8') + '// lunch moved\n',
    'site/data.json': { days: { sat: { lunch: 'Pier kitchen' } } },
    'AGENTS.md': '# copied\n', 'COOKBOOK_VERSION': 'v0.1.1\n', 'cookbook/build.md': '# copied\n', 'reference/x.md': '# copied\n', 'evals/check-notes.txt': 'copied\n',
  });
  commitAll(dir, 'Swap Saturday lunch');
  write(dir, { 'site/data.json': DATA, 'site/extra.txt': 'untracked\n', 'evals/routes.txt': '# Entry\n.\n# Days\n#/day/1\n\n' });
  gitIn(dir, 'add', 'evals/routes.txt');

  const { code, report } = await runCheck(dir, [...SITE, '--base', 'initial']);
  assert.equal(code, 0, JSON.stringify(report.checks));
  const n = report.notes_changes;
  assert.equal(n.history.available, true);
  assert.equal(n.history.commits.length, 1);
  assert.equal(n.history.commits[0].subject, 'Swap Saturday lunch');
  assert.deepEqual(n.history.commits[0].files.sort(), ['site/app.js', 'site/data.json']);
  assert.deepEqual(n.working_tree.map(w => w.path).sort(), ['evals/routes.txt', 'site/data.json', 'site/extra.txt']);
  assert.equal(n.working_tree.find(w => w.path === 'site/extra.txt').status, 'untracked');
  assert.equal(n.working_tree.find(w => w.path === 'evals/routes.txt').status, 'modified, staged');
  assert.equal(n.working_tree.find(w => w.path === 'site/data.json').status, 'modified, not staged');
  assert.equal(n.notes_uncommitted, false);
  const block = changeBlock(dir);
  assert.match(block, /Swap Saturday lunch: `site\/app.js`, `site\/data.json`|Swap Saturday lunch: `site\/data.json`, `site\/app.js`/);
  assert.doesNotMatch(block, /AGENTS|COOKBOOK|cookbook\/|reference\/|evals\/check/);
  neutral(block, n);
});

test('notes never committed: history is unavailable, working-tree changes are still listed', async () => {
  const dir = makeProject(compliantFiles(), { commit: false });
  gitIn(dir, 'add', 'ledger.json', 'site/index.html');
  const { report } = await runCheck(dir, [...NO_SITE, '--base', 'initial']);
  const n = report.notes_changes;
  assert.equal(n.history.available, false);
  assert.match(n.history.reason, /never been committed/);
  assert.equal(n.history.commits.length, 0);
  const paths = n.working_tree.map(w => w.path);
  for (const p of ['ledger.json', 'site/index.html', 'site/app.js', 'evals/routes.txt']) assert.ok(paths.includes(p), p);
  assert.ok(!paths.includes('NOTES.md'));
  assert.equal(n.working_tree.find(w => w.path === 'ledger.json').status, 'added, staged');
  assert.equal(n.notes_uncommitted, true);
  const block = changeBlock(dir);
  assert.match(block, /History comparison unavailable: NOTES.md has never been committed/);
  assert.match(block, /Uncommitted changes to project files: \d+/);
  neutral(block, n);
});

test('uncommitted notes edits are stated, and history still compares against the last committed notes', async () => {
  const dir = makeProject(compliantFiles());
  const base = gitIn(dir, 'rev-parse', 'HEAD').trim();
  write(dir, { 'site/data.json': DATA });
  commitAll(dir, 'Add day data');
  write(dir, { 'NOTES.md': notesFile({ open: '- Decide on Sunday lunch.' }) });
  const { report } = await runCheck(dir, [...NO_SITE, '--base', 'initial']);
  const n = report.notes_changes;
  assert.equal(n.baseline.commit, base);
  assert.deepEqual(n.history.commits.map(c => c.subject), ['Add day data']);
  assert.equal(n.notes_uncommitted, true);
  assert.equal(n.working_tree.length, 0);
  const block = changeBlock(dir);
  assert.match(block, /`NOTES.md` has uncommitted edits; the history comparison above uses its last committed version/);
  neutral(block, n);
});

test('with --root in a subdirectory, only that project\'s files are listed, relative to it, never private/', async () => {
  const inner = Object.fromEntries(Object.entries(compliantFiles()).map(([k, v]) => [`trip/${k}`, v]));
  const dir = makeProject({ ...inner, 'README.md': '# Outer\n' });
  write(dir, { 'README.md': '# Outer, edited\n', 'trip/site/data.json': DATA, 'trip/AGENTS.md': '# copied\n', 'trip/private/approvals.md': 'never listed\n' });
  gitIn(dir, 'add', '-f', 'trip/private/approvals.md');
  commitAll(dir, 'Edit both');
  const { report } = await runCheck(dir, ['--root', 'trip', '--site', 'trip/no-such-site', '--base', 'initial'], { reportDir: 'trip' });
  const n = report.notes_changes;
  assert.deepEqual(n.history.commits.map(c => c.files), [['site/data.json']]);
  assert.equal(report.checks.N1.result, 'PASS', detailsText(report.checks.N1));
  neutral(changeBlock(dir, 'trip'), n);
});
