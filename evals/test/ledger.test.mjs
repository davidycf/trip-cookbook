// L1, L2, L3 and E5 (spec section 6.5).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { makeProject, runCheck, compliantFiles, LEDGER, APP, SITE, detailsText, serveDir, closedPortUrl } from './helpers.mjs';

const clone = v => JSON.parse(JSON.stringify(v));

test('invalid schema, duplicate ID, calendar date, time zone and date range each fail L1', async () => {
  const ledger = clone(LEDGER);
  ledger.commitments[0].seat = '12A';                                  // unknown field
  ledger.commitments[1].date = '2027-02-30';                           // not a calendar date
  ledger.commitments.push({ id: 'museum-closed-tue', what: 'Duplicate', status: 'tentative' });
  ledger.commitments.push({ id: 'dinner', what: 'Dinner', date: '2027-03-14', time: '19:00', time_zone: 'Mars/Olympus', status: 'tentative' });
  ledger.commitments.push({ id: 'car', what: 'Rental car', date: '2027-03-15', end_date: '2027-03-14', status: 'tentative' });
  const dir = makeProject(compliantFiles({ 'ledger.json': ledger }));
  const { code, report } = await runCheck(dir, [...SITE, '--base', 'initial']);
  const d = detailsText(report.checks.L1);
  assert.equal(report.checks.L1.result, 'FAIL');
  assert.match(d, /must NOT have additional properties \\"seat\\"/);
  assert.match(d, /duplicate id \\"museum-closed-tue\\"/);
  assert.match(d, /2027-02-30.*not a valid calendar date/);
  assert.match(d, /Mars\/Olympus.*not an IANA time zone/);
  assert.match(d, /end_date 2027-03-14 is before date 2027-03-15/);
  assert.equal(code, 1);
});

test('missing annotation, unknown visible ID and wrong enclosing day each fail L2', async () => {
  const ledger = clone(LEDGER);
  ledger.commitments.push({ id: 'museum-entry', what: 'Museum timed entry', date: '2027-03-14', time: '10:00', time_zone: 'America/Chicago', status: 'confirmed' });
  const app = APP
    .replace('<a href="#/day/1">', '<p data-ledger="ghost-booking">Mystery</p><a href="#/day/1">')
    .replace('data-day="2027-03-13"', 'data-day="2027-03-20"');
  const dir = makeProject(compliantFiles({ 'ledger.json': ledger, 'site/app.js': app }));
  const { report } = await runCheck(dir, [...SITE, '--base', 'initial']);
  const l2 = report.checks.L2;
  assert.equal(l2.result, 'FAIL');
  assert.equal(l2.sub.confirmed_visible, 'FAIL');
  assert.equal(l2.sub.ids_resolve, 'FAIL');
  assert.equal(l2.sub.day_association, 'FAIL');
  const d = detailsText(l2);
  assert.match(d, /confirmed commitment \\"museum-entry\\" has no visible/);
  assert.match(d, /data-ledger=\\"ghost-booking\\" is not an ID/);
  assert.match(d, /data-day=\\"2027-03-20\\"/);
});

test('without day containers, day association is NOT APPLICABLE rather than passed', async () => {
  const dir = makeProject(compliantFiles({ 'evals/routes.txt': '.\n' }));
  const { report } = await runCheck(dir, [...SITE, '--base', 'initial']);
  assert.equal(report.checks.L2.result, 'PASS', detailsText(report.checks.L2));
  assert.equal(report.checks.L2.sub.day_association, 'NOT APPLICABLE');
});

test('missing source fields and malformed URL fail L1 and L3, never a source pass', async () => {
  const ledger = clone(LEDGER);
  ledger.facts.push({ id: 'ferry-weekends', claim: 'The ferry runs only at weekends.', status: 'sourced', checked: '2026-10-05' });
  ledger.facts.push({ id: 'pass-sale', claim: 'Passes go on sale a month ahead.', status: 'sourced', source: 'https://', checked: '2026-10-05' });
  const dir = makeProject(compliantFiles({ 'ledger.json': ledger }));
  const { report } = await runCheck(dir, [...SITE, '--base', 'initial']);
  assert.equal(report.checks.L1.result, 'FAIL');
  assert.equal(report.checks.L3.result, 'FAIL');
  const d = detailsText(report.checks.L3);
  assert.match(d, /ferry-weekends.*source is missing/);
  assert.match(d, /pass-sale.*source is missing or not an absolute/);
});

test('requested source fetching: unreachable fails L3, reachable passes', async () => {
  const pages = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'trip-src-')));
  fs.writeFileSync(path.join(pages, 'visit.html'), '<!doctype html><title>Visit</title>');
  const server = await serveDir(pages);
  const down = await closedPortUrl();
  try {
    const ledger = clone(LEDGER);
    ledger.facts[0].source = server.url + 'visit.html';
    ledger.facts.push({ id: 'gone', claim: 'A claim whose source page is gone.', status: 'sourced', source: server.url + 'missing-page', checked: '2026-10-05' });
    ledger.facts.push({ id: 'down', claim: 'A claim with an unreachable source.', status: 'sourced', source: down + 'visit', checked: '2026-10-05' });
    const dir = makeProject(compliantFiles({ 'ledger.json': ledger }));
    const { report } = await runCheck(dir, [...SITE, '--base', 'initial', '--fetch-sources']);
    assert.equal(report.checks.L3.result, 'FAIL');
    assert.equal(report.checks.L3.sub.reachability, 'FAIL');
    const d = detailsText(report.checks.L3);
    assert.doesNotMatch(d, /museum-closed-tue/);
    assert.match(d, /\\"gone\\": source not reachable now \(HTTP 404\); this does not show the claim is false/);
    assert.match(d, /\\"down\\": source not reachable now/);
  } finally {
    await server.close();
  }
});

test('E5 passes against a reachable live server and fails against an unreachable one, independently of local results', async () => {
  const dir = makeProject(compliantFiles());
  const live = await serveDir(path.join(dir, 'site'));
  try {
    const up = await runCheck(dir, [...SITE, '--base', 'initial', '--url', live.url]);
    assert.equal(up.report.checks.E5.result, 'PASS', detailsText(up.report.checks.E5));
    assert.equal(up.code, 0);
  } finally {
    await live.close();
  }
  const down = await runCheck(dir, [...SITE, '--base', 'initial', '--url', await closedPortUrl()]);
  assert.equal(down.report.checks.E5.result, 'FAIL');
  assert.equal(down.report.checks.E1.result, 'PASS');
  assert.equal(down.report.checks.E4.result, 'PASS');
  assert.equal(down.code, 1);
});

test('the page snippet documented in cookbook/build.md passes E1 to E5, including with service workers blocked', async () => {
  const md = fs.readFileSync(new URL('../../cookbook/build.md', import.meta.url), 'utf8');
  const blocks = [...md.matchAll(/```js\n(.*?)```/gs)].map(m => m[1]);
  const pageSnippet = blocks.find(b => b.startsWith('// in the page'));
  assert.ok(pageSnippet, 'build.md page snippet not found');
  const app = APP.replace("if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');\n", '')
    + 'function showUpdateButton() {}\n' + pageSnippet;
  const dir = makeProject(compliantFiles({ 'site/app.js': app }));
  const live = await serveDir(path.join(dir, 'site'));
  try {
    const { code, report } = await runCheck(dir, [...SITE, '--base', 'initial', '--url', live.url]);
    for (const id of ['E1', 'E2', 'E3', 'E4', 'E5']) assert.equal(report.checks[id].result, 'PASS', `${id}: ${detailsText(report.checks[id])}`);
    assert.equal(code, 0);
  } finally {
    await live.close();
  }
});
