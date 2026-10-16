#!/usr/bin/env node
// Trip Cookbook checker. Usage and meaning: cookbook/build.md, section 7.
//
//   node evals/check.mjs --site <static-output-dir> --base <initial|published|git-ref> \
//     [--root <project-dir>] [--url <live-site-base-URL>] [--fetch-sources]
//
// Writes <root>/.trip-check/report.md and report.json. Exit codes: 0 when every
// required automated check passes, 1 when any fails or is incomplete, 2 for usage
// errors. A zero exit code is never permission to publish.

import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import Ajv2020Module from 'ajv/dist/2020.js';
import { chromium } from 'playwright';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const Ajv2020 = Ajv2020Module.default ?? Ajv2020Module;

const CONFIG = {
  viewport: { width: 390, height: 844 },
  readyTimeoutMs: 15000,          // load + fonts + same-origin network quiet
  quietMs: 500,                   // no in-flight same-origin requests for this long
  offlineReadyTimeoutMs: 15000,   // service worker controlling, or __TRIP_OFFLINE_READY__ === true
  overflowTolerancePx: 1,
  fetchTimeoutMs: 30000,          // some official sites answer slowly
  maxRedirects: 5,
  scanChunkBytes: 1024 * 1024,   // large text is scanned in overlapping chunks, never skipped
  scanOverlapBytes: 8192,
};
const SUITES = [
  { name: 'root', prefix: '/' },
  { name: 'subpath', prefix: '/site/' },
];
const PASS = 'PASS', FAIL = 'FAIL', SKIPPED = 'SKIPPED', NA = 'NOT APPLICABLE';
const CHECK_IDS = ['G1', 'E1', 'E2', 'E3', 'E4', 'E5', 'L1', 'L2', 'L3', 'P1', 'N1'];
const CHECK_TITLES = {
  G1: 'Inputs, route list, Git context and baseline',
  E1: 'Routes load at the local root',
  E2: 'No horizontal overflow at 390px',
  E3: 'Routes load without overflow under /site/',
  E4: 'Offline after preparation, both prefixes',
  E5: 'Live routes load without overflow',
  L1: 'Ledger schema and field rules',
  L2: 'Confirmed commitments annotated on the page',
  L3: 'Sourced facts have source and check date',
  P1: 'Privacy scan',
  N1: 'Notes structure and pointers',
};
const USAGE = `Usage: node evals/check.mjs --site <static-output-dir> --base <initial|published|git-ref>
                         [--root <project-dir>] [--url <live-site-base-URL>] [--fetch-sources]`;

const sleep = ms => new Promise(r => setTimeout(r, ms));
const short = e => String(e?.message ?? e).split('\n')[0].slice(0, 300);
const posix = p => p.split(path.sep).join('/');

// ---------------------------------------------------------------- arguments

function parseArgs(argv) {
  const opts = { fetchSources: false };
  const errors = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const value = () => {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith('--')) { errors.push(`${a} needs a value`); return undefined; }
      i++;
      return v;
    };
    if (a === '--site') opts.site = value();
    else if (a === '--root') opts.root = value();
    else if (a === '--url') opts.url = value();
    else if (a === '--base') opts.base = value();
    else if (a === '--fetch-sources') opts.fetchSources = true;
    else if (a === '--help' || a === '-h') opts.help = true;
    else errors.push(`unknown argument: ${a}`);
  }
  if (!opts.help) {
    if (!opts.site) errors.push('--site is required');
    if (!opts.base) errors.push('--base is required: use "initial" before the first accepted publication, then "published"');
  }
  return { opts, errors };
}

// ---------------------------------------------------------------- git

function git(cwd, args, { input, buffer } = {}) {
  return execFileSync('git', args, {
    cwd, input, encoding: buffer ? undefined : 'utf8',
    maxBuffer: 1024 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'],
  });
}
function tryGit(cwd, args, o) {
  try { return git(cwd, args, o); } catch { return null; }
}

// Reads many blobs at once. Returns Map sha -> Buffer, or null for missing objects.
function readBlobs(repo, shas) {
  const out = new Map();
  if (!shas.length) return out;
  const buf = git(repo, ['cat-file', '--batch'], { input: shas.join('\n') + '\n', buffer: true });
  let pos = 0;
  while (pos < buf.length) {
    const nl = buf.indexOf(0x0a, pos);
    const header = buf.subarray(pos, nl).toString('utf8');
    pos = nl + 1;
    const [sha, type, size] = header.split(' ');
    if (type === 'missing' || size === undefined) { out.set(sha, null); continue; }
    const n = Number(size);
    out.set(sha, buf.subarray(pos, pos + n));
    pos += n + 1;
  }
  return out;
}

// ---------------------------------------------------------------- ledger

const ajv = new Ajv2020({ allErrors: true, strict: false });
const validateSchema = ajv.compile(JSON.parse(fs.readFileSync(path.join(HERE, 'ledger.schema.json'), 'utf8')));

function isCalendarDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}
function isTimeZone(tz) {
  if (typeof tz !== 'string' || /^[+-]/.test(tz)) return false;
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch { return false; }
}
function isHttpUrl(s) {
  try { const u = new URL(s); return (u.protocol === 'http:' || u.protocol === 'https:') && !!u.hostname; } catch { return false; }
}
const arr = v => (Array.isArray(v) ? v : []);
const items = l => [
  ...arr(l?.commitments).map(item => ({ kind: 'commitment', item })),
  ...arr(l?.facts).map(item => ({ kind: 'fact', item })),
  ...arr(l?.decisions).map(item => ({ kind: 'decision', item })),
];

function ledgerErrors(ledger) {
  const errs = [];
  if (!validateSchema(ledger)) {
    for (const e of validateSchema.errors) {
      const extra = e.params?.additionalProperty ? ` "${e.params.additionalProperty}"` : '';
      errs.push(`schema: ${e.instancePath || '/'} ${e.message}${extra}`);
    }
  }
  const counts = new Map();
  for (const { kind, item } of items(ledger)) {
    if (!item || typeof item !== 'object') continue;
    const where = `${kind} "${item.id ?? '?'}"`;
    if (typeof item.id === 'string') counts.set(item.id, (counts.get(item.id) ?? 0) + 1);
    for (const f of ['date', 'end_date', 'checked']) {
      if (item[f] !== undefined && !isCalendarDate(item[f])) errs.push(`${where}: ${f} "${item[f]}" is not a valid calendar date`);
    }
    if (item.approval?.on !== undefined && !isCalendarDate(item.approval.on)) errs.push(`${where}: approval.on "${item.approval.on}" is not a valid calendar date`);
    if (item.time_zone !== undefined && !isTimeZone(item.time_zone)) errs.push(`${where}: time_zone "${item.time_zone}" is not an IANA time zone`);
    if (isCalendarDate(item.date) && isCalendarDate(item.end_date) && item.end_date < item.date) errs.push(`${where}: end_date ${item.end_date} is before date ${item.date}`);
    if (item.source !== undefined && !isHttpUrl(item.source)) errs.push(`${where}: source is not an absolute http(s) URL`);
  }
  for (const [id, n] of counts) if (n > 1) errs.push(`duplicate id "${id}" (${n} items)`);
  return errs;
}

function canonical(v) {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;
  return JSON.stringify(v);
}
function changedFields(a, b) {
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(k => canonical(a[k]) !== canonical(b[k])).sort();
}
function byId(list) {
  return new Map(arr(list).filter(x => x && typeof x.id === 'string').map(x => [x.id, x]));
}

// Section 3.1 of the spec: changes to confirmed commitments and approved decisions,
// and decisions newly marked approved. baseline null means --base initial.
function protectedChanges(baseline, current) {
  const out = [];
  const guard = (kind, protectedStatus, baseList, curList) => {
    const cur = byId(curList);
    for (const [id, b] of byId(baseList)) {
      if (b.status !== protectedStatus) continue;
      const c = cur.get(id);
      if (!c) out.push({ kind, id, change: 'deleted', was: protectedStatus });
      else if (canonical(b) !== canonical(c)) {
        out.push({ kind, id, change: c.status !== protectedStatus ? `status changed from ${protectedStatus} to ${c.status}` : 'modified', fields: changedFields(b, c) });
      }
    }
  };
  if (baseline) {
    guard('commitment', 'confirmed', baseline.commitments, current?.commitments);
    guard('decision', 'approved', baseline.decisions, current?.decisions);
  }
  const before = byId(baseline?.decisions);
  for (const [id, c] of byId(current?.decisions)) {
    if (c.status !== 'approved' || before.get(id)?.status === 'approved') continue;
    out.push({ kind: 'decision', id, change: before.has(id) ? 'newly approved' : 'added as approved', evidence: c.approval?.evidence ?? null });
  }
  return out;
}

// ---------------------------------------------------------------- routes

function parseRoutes(text) {
  const routes = [];
  const errors = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('# ')) return;
    const problem = routeProblem(line);
    if (problem) errors.push(`routes.txt line ${i + 1} "${line}": ${problem}`);
    else routes.push(line);
  });
  if (!routes.length && !errors.length) errors.push('routes.txt lists no routes');
  return { routes, errors };
}
function routeProblem(r) {
  if (r === '.' || r.startsWith('#')) return null;
  if (r.startsWith('/')) return 'routes are site-relative; remove the leading slash';
  if (/^[a-z][a-z0-9+.-]*:/i.test(r)) return 'absolute URLs are not allowed';
  if (r.includes('\\')) return 'backslashes are not allowed';
  const pathPart = r.split('#')[0].split('?')[0];
  if (pathPart.split('/').includes('..')) return 'parent traversal is not allowed';
  const base = 'http://route.invalid/base/';
  if (!new URL(r, base).href.startsWith(base)) return 'route escapes the site base';
  return null;
}
const routeUrl = (base, r) => (r === '.' ? base : r.startsWith('#') ? base + r : new URL(r, base).href);

// ---------------------------------------------------------------- notes

// The NOTES.md structure and pointer syntax: cookbook/build.md, section 1.
const NOTES_HEADINGS = ['Where to look', 'Context', 'Open', 'Recent changes', 'Visibility', 'Build and deploy'];
const NOTES_NONEMPTY = ['Visibility', 'Build and deploy'];
const LEDGER_REF = /\bledger:([A-Za-z0-9][A-Za-z0-9._-]*)/g;

// Splits NOTES.md into level-2 sections. Lines inside fenced code blocks never count as
// headings or table rows, but they stay in the section's text. HTML comments aren't
// rendered, so they count for nothing at all.
function parseNotes(text) {
  const sections = [];
  let fence = null;
  let comment = false;
  let current = null;
  text.split(/\r?\n/).forEach((raw, i) => {
    let line = raw;
    if (!fence) {
      let visible = '';
      let rest = line;
      while (rest) {
        if (comment) {
          const end = rest.indexOf('-->');
          if (end < 0) break;
          comment = false;
          rest = rest.slice(end + 3);
        } else {
          const start = rest.indexOf('<!--');
          if (start < 0) { visible += rest; break; }
          visible += rest.slice(0, start);
          comment = true;
          rest = rest.slice(start + 4);
        }
      }
      if (visible !== line) {
        if (!visible.trim()) { current?.lines.push({ text: raw, code: true, hidden: true }); return; }
        line = visible;
      }
    }
    const f = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (fence) {
      if (f && f[1][0] === fence[0] && f[1].length >= fence.length && !line.slice(f[0].length).trim()) fence = null;
      current?.lines.push({ text: line, code: true });
      return;
    }
    if (f) { fence = f[1]; current?.lines.push({ text: line, code: true }); return; }
    const h = line.match(/^ {0,3}##(?!#)(?:[ \t]+(.*?))?[ \t]*$/);
    if (h) {
      current = { title: (h[1] ?? '').replace(/[ \t]+#+$/, '').trim(), line: i + 1, lines: [] };
      sections.push(current);
      return;
    }
    if (/^ {0,3}#(?:[ \t]|$)/.test(line)) { current = null; return; }
    current?.lines.push({ text: line, code: false });
  });
  return sections;
}

function splitRow(line) {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
  return s.split(/(?<!\\)\|/).map(c => c.trim());
}

// Backticked tokens in the Location column of every table that has one.
function locationTokens(section) {
  const tokens = [];
  let tables = 0;
  const rows = section.lines;
  for (let i = 0; i + 1 < rows.length; i++) {
    if (rows[i].code || rows[i + 1].code || !rows[i].text.includes('|')) continue;
    if (!/^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/.test(rows[i + 1].text) || !rows[i + 1].text.includes('-')) continue;
    const col = splitRow(rows[i].text).findIndex(c => c.toLowerCase() === 'location');
    if (col < 0) continue;
    tables++;
    let j = i + 2;
    for (; j < rows.length && !rows[j].code && rows[j].text.includes('|') && rows[j].text.trim(); j++) {
      const cell = splitRow(rows[j].text)[col] ?? '';
      for (const m of cell.matchAll(/`([^`]+)`/g)) tokens.push(m[1].trim());
    }
    i = j - 1;
  }
  return { tables, tokens };
}

function relPathProblem(p) {
  if (!p) return 'empty path';
  if (p.startsWith('/') || /^[a-z]:/i.test(p) || /^[a-z][a-z0-9+.-]*:\/\//i.test(p)) return 'paths are relative to the project root';
  if (p.includes('\\')) return 'backslashes are not allowed';
  if (p.split('/').includes('..')) return 'parent traversal is not allowed';
  return null;
}

// Resolves a dot-separated key path through own properties of non-array objects only.
function keyPathProblem(value, keyPath) {
  const segs = keyPath.split('.');
  if (segs.some(s => !s)) return `key path "${keyPath}" has an empty segment`;
  let v = value;
  for (let i = 0; i < segs.length; i++) {
    const at = segs.slice(0, i).join('.') || '(top level)';
    if (Array.isArray(v)) return `${at} is an array; key paths don't go through arrays`;
    if (!v || typeof v !== 'object') return `${at} is not an object`;
    if (!Object.hasOwn(v, segs[i])) return `key "${segs[i]}" not found at ${at}`;
    v = v[segs[i]];
  }
  return null;
}

// N1. Returns { result, details }. ledgerIds is null when ledger.json is unreadable.
function checkNotes(root, ledgerIds) {
  const file = path.join(root, 'NOTES.md');
  if (!fs.existsSync(file)) return { result: FAIL, details: ['NOTES.md not found in the project root'] };
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch (e) { return { result: FAIL, details: [`NOTES.md could not be read: ${short(e)}`] }; }
  const fails = [];
  const skips = [];

  const sections = parseNotes(text);
  const norm = s => s.toLowerCase().replace(/\s+/g, ' ');
  const found = new Map(NOTES_HEADINGS.map(h => [h, sections.filter(s => norm(s.title) === norm(h))]));
  let last = null;
  for (const h of NOTES_HEADINGS) {
    const list = found.get(h);
    if (!list.length) { fails.push(`required heading "## ${h}" is missing`); continue; }
    if (list.length > 1) { fails.push(`"## ${h}" appears ${list.length} times (lines ${list.map(s => s.line).join(', ')}); keep one`); continue; }
    if (last && list[0].line < last.line) fails.push(`"## ${h}" (line ${list[0].line}) comes before "## ${last.title}" (line ${last.line}); the order is: ${NOTES_HEADINGS.join(', ')}`);
    else last = { title: h, line: list[0].line };
  }
  for (const h of NOTES_NONEMPTY) {
    const [s] = found.get(h);
    if (s && found.get(h).length === 1 && !s.lines.some(l => !l.hidden && l.text.trim())) fails.push(`"## ${h}" is empty`);
  }

  const where = found.get('Where to look');
  if (where.length === 1) {
    const { tables, tokens } = locationTokens(where[0]);
    if (!tables) fails.push('"## Where to look" has no table with a Location column');
    else if (!tokens.length) fails.push('the "## Where to look" table has no backticked tokens in its Location column');

    let routeLines = null;
    let routesWhy = null;
    const routesFile = path.join(root, 'evals', 'routes.txt');
    try {
      routeLines = new Set(fs.readFileSync(routesFile, 'utf8').split(/\r?\n/).map(s => s.trim()).filter(s => s && !s.startsWith('# ')));
    } catch (e) { routesWhy = fs.existsSync(routesFile) ? `evals/routes.txt could not be read (${short(e)})` : 'evals/routes.txt not found'; }
    const unchecked = [];

    for (const t of tokens) {
      const route = t.startsWith('route:') ? t.slice(6).trim() : t.startsWith('#') ? t : null;
      if (route !== null) {
        if (!route) fails.push(`\`${t}\`: no route after "route:"`);
        else if (!routeLines) unchecked.push(t);
        else if (!routeLines.has(route)) fails.push(`\`${t}\`: "${route}" is not a line of evals/routes.txt`);
        continue;
      }
      const hash = t.indexOf('#');
      const rel = hash < 0 ? t : t.slice(0, hash);
      const bad = relPathProblem(rel);
      if (bad) { fails.push(`\`${t}\`: ${bad}`); continue; }
      const abs = path.join(root, rel);
      if (!fs.existsSync(abs)) { fails.push(`\`${t}\`: ${rel} does not exist${hash < 0 && !rel.includes('.') ? '; a site route needs the "route:" prefix' : ''}`); continue; }
      if (hash < 0) continue;
      if (!fs.statSync(abs).isFile()) { fails.push(`\`${t}\`: ${rel} is not a file`); continue; }
      let data;
      try { data = JSON.parse(fs.readFileSync(abs, 'utf8')); } catch { fails.push(`\`${t}\`: ${rel} is not valid JSON; key pointers work only into JSON files`); continue; }
      const problem = keyPathProblem(data, t.slice(hash + 1));
      if (problem) fails.push(`\`${t}\`: ${problem}`);
    }
    if (unchecked.length) skips.push(`route tokens not checked because ${routesWhy}: ${unchecked.map(t => `\`${t}\``).join(', ')}`);
  }

  // An exact ID wins; otherwise trailing full stops are read as sentence punctuation.
  const refs = [...new Set([...text.matchAll(LEDGER_REF)].map(m => m[1]))];
  if (refs.length && !ledgerIds) skips.push(`ledger references not checked because ledger.json could not be read: ${refs.map(r => `ledger:${r}`).join(', ')}`);
  else {
    for (const r of refs) {
      const bare = r.replace(/\.+$/, '');
      if (!ledgerIds.has(r) && !(bare && ledgerIds.has(bare))) fails.push(`ledger:${bare || r} has no matching id in ledger.json`);
    }
  }

  return { result: fails.length ? FAIL : skips.length ? SKIPPED : PASS, details: [...fails, ...skips] };
}

// Change discovery: informational, never a verdict on the notes and never part of the exit code.
const COPIED_FILES = new Set(['AGENTS.md', 'COOKBOOK_LICENSE', 'COOKBOOK_VERSION']);
const isProjectFile = rel => rel !== 'NOTES.md' && !COPIED_FILES.has(rel)
  && !/^(cookbook|reference|private|\.trip-check)\//.test(rel)
  && !(rel.startsWith('evals/') && rel !== 'evals/routes.txt');
const MAX_COMMITS_LISTED = 50;

function notesChanges(repo, rootRel) {
  const spec = rootRel || '.';
  const notesRel = posix(path.join(rootRel, 'NOTES.md'));
  const inRoot = p => (rootRel ? (p.startsWith(rootRel + '/') ? p.slice(rootRel.length + 1) : null) : p);
  const out = { baseline: null, history: { available: false, reason: null, commits: [], more: 0 }, working_tree: [], notes_uncommitted: false };

  const hasHead = !!tryGit(repo, ['rev-parse', '--verify', '--quiet', 'HEAD']);
  const base = hasHead ? tryGit(repo, ['log', '-1', '--format=%H%x09%ad', '--date=short', '--', notesRel])?.trim() : '';
  if (!base) out.history.reason = 'NOTES.md has never been committed, so there is no history to compare against';
  else {
    const [commit, date] = base.split('\t');
    out.baseline = { commit, date };
    out.history.available = true;
    const log = tryGit(repo, ['-c', 'core.quotePath=false', 'log', '--no-renames', '--diff-merges=first-parent', '--format=%x1e%H%x1f%ad%x1f%s', '--date=short', '--name-only', `${commit}..HEAD`, '--', spec]) ?? '';
    for (const rec of log.split('\x1e').slice(1)) {
      const [head, ...rest] = rec.split('\n');
      const [sha, d, subject] = head.split('\x1f');
      const files = rest.map(s => s.trim()).filter(Boolean).map(inRoot).filter(p => p !== null && isProjectFile(p));
      if (!files.length) continue;
      if (out.history.commits.length < MAX_COMMITS_LISTED) out.history.commits.push({ commit: sha, date: d, subject, files });
      else out.history.more++;
    }
  }

  const status = tryGit(repo, ['-c', 'core.quotePath=false', 'status', '--porcelain=v1', '-z', '--no-renames', '--untracked-files=all', '--', spec]) ?? '';
  const words = { M: 'modified', A: 'added', D: 'deleted', T: 'type changed', U: 'unmerged', '?': 'untracked' };
  for (const entry of status.split('\0').filter(Boolean)) {
    const xy = entry.slice(0, 2), p = inRoot(entry.slice(3));
    if (p === null) continue;
    if (p === 'NOTES.md') { out.notes_uncommitted = true; continue; }
    if (!isProjectFile(p)) continue;
    const state = [];
    if (xy === '??') state.push('untracked');
    else {
      if (xy[0] !== ' ') state.push(`${words[xy[0]] ?? xy[0]}, staged`);
      if (xy[1] !== ' ') state.push(`${words[xy[1]] ?? xy[1]}, not staged`);
    }
    out.working_tree.push({ path: p, status: state.join('; ') });
  }
  return out;
}

// ---------------------------------------------------------------- static server

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.ttf': 'font/ttf', '.otf': 'font/otf', '.pdf': 'application/pdf', '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.map': 'application/json',
};

// Plain static-file and directory-index resolution under one prefix. No SPA fallback,
// no clean-URL rewriting, no caching (offline success must come from the site's own storage).
function startServer(siteReal, prefix) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const send = (code, body = '', headers = {}) => {
        res.writeHead(code, { 'Cache-Control': 'no-store', ...headers });
        res.end(req.method === 'HEAD' ? '' : body);
      };
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(405);
      let pathname;
      try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { return send(400); }
      if (pathname.includes('\0')) return send(400);
      if (pathname + '/' === prefix) return send(301, '', { Location: prefix });
      if (!pathname.startsWith(prefix)) return send(404, 'Not found');
      const file = path.join(siteReal, pathname.slice(prefix.length));
      const inside = p => p === siteReal || p.startsWith(siteReal + path.sep);
      if (!inside(file)) return send(404, 'Not found');
      fs.stat(file, (err, st) => {
        if (err) return send(404, 'Not found');
        let target = file;
        if (st.isDirectory()) {
          if (!pathname.endsWith('/')) return send(301, '', { Location: encodeURI(pathname + '/') });
          target = path.join(file, 'index.html');
        }
        fs.realpath(target, (e2, real) => {
          if (e2 || !inside(real)) return send(404, 'Not found');
          fs.readFile(real, (e3, buf) => {
            if (e3) return send(404, 'Not found');
            send(200, buf, { 'Content-Type': TYPES[path.extname(real).toLowerCase()] ?? 'application/octet-stream' });
          });
        });
      });
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const origin = `http://127.0.0.1:${server.address().port}`;
      let closed = false;
      resolve({
        origin, base: origin + prefix,
        close: () => new Promise(r => {
          if (closed) return r();
          closed = true;
          server.closeAllConnections();
          server.close(() => r());
        }),
      });
    });
  });
}

// ---------------------------------------------------------------- browser helpers

function instrument(page, origin) {
  const st = { pageErrors: [], consoleErrors: [], failed: [], thirdParty: [], inflight: 0, last: Date.now() };
  const kind = u => {
    try {
      const url = new URL(u);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return 'other';
      return url.origin === origin ? 'same' : 'third';
    } catch { return 'other'; }
  };
  page.on('pageerror', e => st.pageErrors.push(short(e)));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const text = m.text();
    const url = m.location()?.url ?? '';
    if (/^Failed to load resource/.test(text) && kind(url) === 'third') st.thirdParty.push({ url, error: text });
    else st.consoleErrors.push(url ? `${text} (${url})` : text);
  });
  page.on('request', r => { if (kind(r.url()) === 'same') { st.inflight++; st.last = Date.now(); } });
  const done = r => { if (kind(r.url()) === 'same') { st.inflight = Math.max(0, st.inflight - 1); st.last = Date.now(); } };
  page.on('requestfinished', done);
  page.on('requestfailed', r => {
    done(r);
    const entry = { url: r.url(), error: r.failure()?.errorText ?? 'failed' };
    const k = kind(r.url());
    if (k === 'same') st.failed.push(entry);
    else if (k === 'third') st.thirdParty.push(entry);
  });
  page.on('response', resp => {
    if (resp.status() < 400) return;
    const entry = { url: resp.url(), status: resp.status() };
    const k = kind(resp.url());
    if (k === 'same') st.failed.push(entry);
    else if (k === 'third') st.thirdParty.push(entry);
  });
  return st;
}

async function waitReady(page, st) {
  const deadline = Date.now() + CONFIG.readyTimeoutMs;
  await page.waitForLoadState('load', { timeout: CONFIG.readyTimeoutMs });
  const fonts = await page.evaluate(ms => Promise.race([
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => true),
    new Promise(r => setTimeout(() => r(false), ms)),
  ]), Math.max(1, deadline - Date.now()));
  if (!fonts) throw new Error(`fonts not ready within ${CONFIG.readyTimeoutMs} ms`);
  for (;;) {
    if (st.inflight === 0 && Date.now() - st.last >= CONFIG.quietMs) return;
    if (Date.now() > deadline) throw new Error(`same-origin network not quiet within ${CONFIG.readyTimeoutMs} ms`);
    await sleep(50);
  }
}

function collectLedger() {
  return [...document.querySelectorAll('[data-ledger]')].map(el => {
    const r = el.getBoundingClientRect();
    const shown = el.checkVisibility ? el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) : true;
    const day = el.closest('[data-day]');
    return {
      id: el.getAttribute('data-ledger'),
      visible: shown && r.width > 0 && r.height > 0,
      nonEmpty: (el.innerText || '').trim().length > 0,
      day: day ? day.getAttribute('data-day') : null,
    };
  });
}

async function offlineReady(timeout) {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const deadline = Date.now() + timeout;
  if ('__TRIP_OFFLINE_READY__' in window) {
    while (window.__TRIP_OFFLINE_READY__ !== true) {
      if (Date.now() > deadline) return { ok: false, reason: `window.__TRIP_OFFLINE_READY__ did not become true within ${timeout} ms` };
      await wait(100);
    }
    return { ok: true, via: 'readiness flag' };
  }
  if (!('serviceWorker' in navigator)) return { ok: false, reason: 'service workers are unavailable in this context' };
  const reg = await Promise.race([navigator.serviceWorker.ready, wait(timeout).then(() => null)]);
  if (!reg) return { ok: false, reason: `no active service worker within ${timeout} ms, and no window.__TRIP_OFFLINE_READY__ flag` };
  while (!navigator.serviceWorker.controller) {
    if (Date.now() > deadline) {
      return { ok: false, reason: 'page is not controlled by the service worker after it activated; call clients.claim() on activate (the checker does not reload to obtain control)' };
    }
    await wait(100);
  }
  return { ok: true, via: 'service worker' };
}

function capture(confirmed) {
  const conf = new Set(confirmed);
  const isVisible = el => {
    const r = el.getBoundingClientRect();
    const shown = el.checkVisibility ? el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) : true;
    return shown && r.width > 0 && r.height > 0;
  };
  const vol = [...document.querySelectorAll('[data-offline-volatile]')];
  const volatileProblems = [];
  for (const v of vol) {
    for (const el of [v, ...v.querySelectorAll('[data-ledger]')]) {
      const id = el.getAttribute('data-ledger');
      if (id && conf.has(id)) volatileProblems.push(id);
    }
  }
  const saved = vol.map(e => [e.style.getPropertyValue('display'), e.style.getPropertyPriority('display')]);
  vol.forEach(e => e.style.setProperty('display', 'none', 'important'));
  const text = (document.body ? document.body.innerText : '').replace(/\s+/g, ' ').trim();
  const visible = [...document.querySelectorAll('[data-ledger]')]
    .filter(e => conf.has(e.getAttribute('data-ledger')) && isVisible(e) && (e.innerText || '').trim())
    .map(e => e.getAttribute('data-ledger'));
  vol.forEach((e, i) => {
    if (saved[i][0]) e.style.setProperty('display', saved[i][0], saved[i][1]);
    else e.style.removeProperty('display');
  });
  return { text, visible: [...new Set(visible)], volatileProblems: [...new Set(volatileProblems)] };
}

// Short excerpt around the first difference, so the cause (often an unmarked offline banner) is visible.
function firstDifference(online, offline) {
  let i = 0;
  while (i < online.length && i < offline.length && online[i] === offline[i]) i++;
  const cut = s => JSON.stringify(s.slice(Math.max(0, i - 20), i + 40));
  return `online …${cut(online)}… vs offline …${cut(offline)}…`;
}

const overflowOf = () => document.documentElement.scrollWidth - document.documentElement.clientWidth;

// One prefix: online visits (E1/E2, L2 and rendered text on root), offline preparation,
// then offline navigation and reload with the server stopped (E4).
async function runSuite(browser, suite, siteReal, routes, confirmedIds, thirdParty, terms) {
  const srv = await startServer(siteReal, suite.prefix);
  const context = await browser.newContext({ viewport: CONFIG.viewport });
  const results = [];
  try {
    for (const route of routes) {
      const url = routeUrl(srv.base, route);
      const rec = { route, url, loadErrors: [], pageErrors: [], consoleErrors: [], failed: [], overflow: null, ledger: null, dom: null, ready: null, prepared: null, offline: null };
      const page = await context.newPage();
      const st = instrument(page, srv.origin);
      try {
        const resp = await page.goto(url, { waitUntil: 'load', timeout: CONFIG.readyTimeoutMs });
        if (!resp) rec.loadErrors.push('no document response');
        else if (resp.status() >= 400) rec.loadErrors.push(`document returned HTTP ${resp.status()}`);
        await waitReady(page, st);
        rec.overflow = await page.evaluate(overflowOf);
        if (suite.name === 'root') {
          rec.ledger = await page.evaluate(collectLedger);
          rec.dom = { html: await page.content(), text: await page.evaluate(() => (document.body ? document.body.innerText : '')) };
        }
        rec.ready = await page.evaluate(offlineReady, CONFIG.offlineReadyTimeoutMs);
        if (rec.ready.ok) rec.prepared = await page.evaluate(capture, confirmedIds);
      } catch (e) {
        rec.loadErrors.push(`did not finish loading: ${short(e)}`);
      }
      rec.pageErrors = [...st.pageErrors];
      rec.consoleErrors = [...st.consoleErrors];
      rec.failed = [...st.failed];
      for (const t of st.thirdParty) thirdParty.push({ suite: suite.name, route, phase: 'online', ...t });
      await page.close();
      results.push(rec);
    }

    await srv.close();
    await context.setOffline(true);
    for (const rec of results) {
      if (!rec.ready?.ok || !rec.prepared) continue;
      const off = { errors: [], text: null, reloadText: null, missingLedger: [] };
      const page = await context.newPage();
      const st = instrument(page, srv.origin);
      try {
        const resp = await page.goto(rec.url, { waitUntil: 'load', timeout: CONFIG.readyTimeoutMs });
        if (!resp) off.errors.push('offline navigation produced no document response');
        else if (resp.status() >= 400) off.errors.push(`offline document returned HTTP ${resp.status()}`);
        await waitReady(page, st);
        const first = await page.evaluate(capture, confirmedIds);
        await page.reload({ waitUntil: 'load', timeout: CONFIG.readyTimeoutMs });
        await waitReady(page, st);
        const second = await page.evaluate(capture, confirmedIds);
        off.text = first.text;
        off.reloadText = second.text;
        for (const [label, cap] of [['after navigation', first], ['after reload', second]]) {
          if (!cap.text) off.errors.push(`offline page is empty ${label}`);
          else if (cap.text !== rec.prepared.text) off.errors.push(`offline content differs from the prepared online content ${label}: ${firstDifference(redactText(rec.prepared.text, terms), redactText(cap.text, terms))}`);
          const missing = rec.prepared.visible.filter(id => !cap.visible.includes(id));
          if (missing.length) off.errors.push(`confirmed ledger elements not visible offline ${label}: ${missing.join(', ')}`);
        }
      } catch (e) {
        off.errors.push(`offline load failed: ${short(e)}`);
      }
      off.errors.push(...st.pageErrors.map(m => `uncaught exception offline: ${m}`));
      off.errors.push(...st.failed.map(f => `same-origin resource unavailable offline: ${f.url} (${f.status ? `HTTP ${f.status}` : f.error})`));
      off.errors.push(...st.consoleErrors.map(m => `console error offline: ${m}`));
      for (const t of st.thirdParty) thirdParty.push({ suite: suite.name, route: rec.route, phase: 'offline', ...t });
      await page.close();
      rec.offline = off;
    }
  } finally {
    await context.close();
    await srv.close();
  }
  return results;
}

async function runLive(browser, liveBase, routes, thirdParty) {
  const origin = new URL(liveBase).origin;
  const context = await browser.newContext({ viewport: CONFIG.viewport, serviceWorkers: 'block' });
  const results = [];
  try {
    for (const route of routes) {
      const url = routeUrl(liveBase, route);
      const rec = { route, url, loadErrors: [], pageErrors: [], consoleErrors: [], failed: [], overflow: null };
      const page = await context.newPage();
      const st = instrument(page, origin);
      try {
        const resp = await page.goto(url, { waitUntil: 'load', timeout: CONFIG.readyTimeoutMs });
        if (!resp) rec.loadErrors.push('no document response');
        else if (resp.status() >= 400) rec.loadErrors.push(`document returned HTTP ${resp.status()}`);
        await waitReady(page, st);
        rec.overflow = await page.evaluate(overflowOf);
      } catch (e) {
        rec.loadErrors.push(`did not finish loading: ${short(e)}`);
      }
      rec.pageErrors = [...st.pageErrors];
      rec.consoleErrors = [...st.consoleErrors];
      rec.failed = [...st.failed];
      for (const t of st.thirdParty) thirdParty.push({ suite: 'live', route, phase: 'online', ...t });
      await page.close();
      results.push(rec);
    }
  } finally {
    await context.close();
  }
  return results;
}

function loadProblems(rec) {
  return [
    ...rec.loadErrors,
    ...rec.pageErrors.map(m => `uncaught exception: ${m}`),
    ...rec.consoleErrors.map(m => `console error: ${m}`),
    ...rec.failed.map(f => `failed same-origin resource: ${f.url} (${f.status ? `HTTP ${f.status}` : f.error})`),
  ];
}
function e1Result(results) {
  const details = results.flatMap(r => loadProblems(r).map(p => ({ route: r.route, problem: p })));
  return { result: details.length ? FAIL : PASS, details };
}
function e2Result(results) {
  const details = [];
  for (const r of results) {
    if (r.overflow === null) details.push({ route: r.route, problem: 'overflow not measured: the route did not finish loading' });
    else if (r.overflow > CONFIG.overflowTolerancePx) details.push({ route: r.route, problem: `document is ${r.overflow}px wider than the 390px viewport` });
  }
  return { result: details.length ? FAIL : PASS, details };
}
function e4Details(suite, results) {
  const details = [];
  for (const r of results) {
    const add = problem => details.push({ suite, route: r.route, problem });
    if (!r.ready) add('offline preparation not reached: the route did not finish loading online');
    else if (!r.ready.ok) add(r.ready.reason);
    else if (!r.prepared?.text) add('prepared online content is empty after excluding data-offline-volatile elements');
    else {
      for (const id of r.prepared.volatileProblems) add(`confirmed ledger element "${id}" is inside a data-offline-volatile element`);
      for (const p of r.offline?.errors ?? ['offline phase did not run']) add(p);
    }
  }
  return details;
}

// L2: section 2.3 of the spec. Runs on the online pass at the local root prefix.
function evaluateL2(rootResults, ledger) {
  const commitments = byId(ledger.commitments);
  const known = new Set(items(ledger).map(x => x.item?.id).filter(Boolean));
  const details = [];
  const shown = new Set();
  let unknown = false, wrongDay = false, applicable = 0;
  for (const r of rootResults) {
    for (const occ of r.ledger ?? []) {
      if (!occ.visible) continue;
      if (!known.has(occ.id)) {
        unknown = true;
        details.push({ route: r.route, problem: `visible data-ledger="${occ.id}" is not an ID in ledger.json` });
        continue;
      }
      if (occ.nonEmpty) shown.add(occ.id);
      const c = commitments.get(occ.id);
      if (c && isCalendarDate(c.date) && occ.day !== null) {
        applicable++;
        const last = isCalendarDate(c.end_date) ? c.end_date : c.date;
        if (!isCalendarDate(occ.day) || occ.day < c.date || occ.day > last) {
          wrongDay = true;
          details.push({ route: r.route, problem: `"${occ.id}" is inside data-day="${occ.day}", but the commitment applies to ${c.date === last ? c.date : `${c.date} to ${last}`}` });
        }
      }
    }
  }
  let missing = false;
  for (const c of commitments.values()) {
    if (c.status === 'confirmed' && !shown.has(c.id)) {
      missing = true;
      details.push({ problem: `confirmed commitment "${c.id}" has no visible, non-empty data-ledger element on any listed route` });
    }
  }
  const sub = {
    confirmed_visible: missing ? FAIL : PASS,
    ids_resolve: unknown ? FAIL : PASS,
    day_association: applicable === 0 ? NA : wrongDay ? FAIL : PASS,
  };
  return { result: missing || unknown || wrongDay ? FAIL : PASS, details, sub };
}

// ---------------------------------------------------------------- sources

async function reach(url) {
  let u = url;
  for (let hop = 0; hop <= CONFIG.maxRedirects; hop++) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), CONFIG.fetchTimeoutMs);
    try {
      const res = await fetch(u, { redirect: 'manual', signal: ctl.signal, headers: { 'User-Agent': 'trip-cookbook-check/0.1' } });
      clearTimeout(timer);
      await res.body?.cancel().catch(() => {});
      const loc = res.headers.get('location');
      if (res.status >= 300 && res.status < 400 && loc) { u = new URL(loc, u).href; continue; }
      return res.ok ? { ok: true, status: res.status } : { ok: false, status: res.status };
    } catch (e) {
      clearTimeout(timer);
      return { ok: false, error: e.name === 'AbortError' ? `timeout after ${CONFIG.fetchTimeoutMs} ms` : String(e.cause?.code ?? e.message) };
    }
  }
  return { ok: false, error: `more than ${CONFIG.maxRedirects} redirects` };
}

// ---------------------------------------------------------------- privacy

const IIN = /^(4|5[1-5]|222[1-9]|22[3-9]\d|2[3-6]\d\d|27[01]\d|2720|3[47]|6011|65|64[4-9]|35(2[89]|[3-8]\d)|62|30[0-5]|36|38)/;
function luhn(digits) {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = digits.charCodeAt(digits.length - 1 - i) - 48;
    if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return sum % 10 === 0;
}
const PATTERNS = [
  ['aws-access-key', /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g],
  ['github-token', /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g],
  ['github-fine-grained-token', /\bgithub_pat_[A-Za-z0-9_]{50,}\b/g],
  ['slack-token', /\bxox[abprs]-[A-Za-z0-9-]{10,}/g],
  ['stripe-live-key', /\b(?:sk|rk)_live_[A-Za-z0-9]{20,}\b/g],
  ['google-api-key', /\bAIza[0-9A-Za-z_-]{35}\b/g],
  ['anthropic-api-key', /\bsk-ant-[A-Za-z0-9_-]{20,}/g],
  ['openai-api-key', /\bsk-(?!ant-)(?:proj-)?[A-Za-z0-9_-]{32,}/g],
  ['private-key', /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----/g],
  ['passport-mrz', /\bP[A-Z<][A-Z<]{3}[A-Z]+<<[A-Z]+(?:<[A-Z]+)*<+/g],
];
const PASSPORT_NEAR = /(?:passport|护照|護照|旅券|パスポート)[^\n]{0,24}?\b([A-Z]{0,2}[0-9]{6,9})\b/gi;
const PATTERN_NAMES = ['card-number', 'passport-number', 'custom-term', ...PATTERNS.map(p => p[0])];

function scanText(text, terms) {
  const found = [];
  for (const m of text.matchAll(/(?<![0-9])(?:[0-9][ -]?){12,18}[0-9](?![0-9])/g)) {
    const digits = m[0].replace(/[ -]/g, '');
    if (digits.length >= 13 && digits.length <= 19 && IIN.test(digits) && luhn(digits)) found.push({ pattern: 'card-number', value: m[0] });
  }
  for (const [name, re] of PATTERNS) for (const m of text.matchAll(re)) found.push({ pattern: name, value: m[0] });
  for (const m of text.matchAll(PASSPORT_NEAR)) found.push({ pattern: 'passport-number', value: m[1] });
  if (terms.length) {
    const lower = text.toLowerCase();
    terms.forEach((t, i) => { if (lower.includes(t.toLowerCase())) found.push({ pattern: 'custom-term', value: t, term: i + 1 }); });
  }
  return found;
}
// Replaces every pattern and custom-term match in free text with its redacted form.
function redactText(text, terms) {
  let out = text;
  for (const f of scanText(text, terms)) {
    const label = `[${f.pattern === 'custom-term' ? redact(f) : `${f.pattern} ${redact(f)}`}]`;
    out = f.pattern === 'custom-term'
      ? out.replace(new RegExp(f.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), label)
      : out.split(f.value).join(label);
  }
  return out;
}
function redact(f) {
  if (f.pattern === 'custom-term') return `custom term #${f.term}`;
  const v = f.value;
  if (v.length <= 6) return '•'.repeat(v.length);
  return v.slice(0, 2) + '•'.repeat(Math.min(v.length - 4, 12)) + v.slice(-2);
}
const isBinary = buf => buf.subarray(0, 8000).includes(0);

// private/ and .git entries anywhere in the output tree. Symbolic links are not followed.
function forbiddenEntries(dir, base = dir, found = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, ent.name);
    if (ent.name === 'private' || ent.name === '.git') found.push(posix(path.relative(base, abs)));
    else if (ent.isDirectory() && !ent.isSymbolicLink()) forbiddenEntries(abs, base, found);
  }
  return found;
}

function loadAllowlist(file, errors) {
  if (!fs.existsSync(file)) return [];
  let data;
  try { data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { errors.push(`privacy-fixtures.json is not valid JSON: ${short(e)}`); return []; }
  return parseAllowlist(data, errors);
}
function parseAllowlist(data, errors) {
  const list = Array.isArray(data?.exceptions) ? data.exceptions : null;
  if (!list) { errors.push('privacy-fixtures.json needs an "exceptions" array'); return []; }
  const ok = [];
  list.forEach((e, i) => {
    const bad = !e || typeof e.path !== 'string' || !e.path || typeof e.value !== 'string' || !e.value
      || typeof e.reason !== 'string' || !e.reason.trim() || !PATTERN_NAMES.includes(e.pattern) || e.pattern === 'custom-term';
    if (bad) errors.push(`privacy-fixtures.json exception ${i + 1} needs path, value, a known pattern and a reason`);
    else if (/[*?[\]]/.test(e.path) || e.path.endsWith('/')) errors.push(`privacy-fixtures.json exception ${i + 1}: wildcards and directory exceptions are not allowed`);
    else ok.push(e);
  });
  return ok;
}

function privacyScan({ repo, rootRel, siteReal, rendered, renderedComplete, allowlist, allowlistRel, terms }) {
  const findings = [];
  const excepted = [];
  let selfRefs = 0;
  const problems = [];
  const coverage = { tracked_files: 0, staged_blobs: 0, site_files: 0, routes_rendered: 0, history: { commits: 0, blobs: 0, complete: true }, skipped_non_text: [], custom_terms: terms.length ? `${terms.length} supplied` : 'custom terms not supplied' };
  const seen = new Set();
  const sensitiveRel = posix(path.join(rootRel, 'private', 'sensitive.txt'));
  const privatePrefix = posix(path.join(rootRel, 'private')) + '/';

  const consider = (scope, where, text, extra = {}) => {
    for (const f of scanText(text, terms)) {
      const key = `${scope}|${where}|${f.pattern}|${f.value}|${extra.commit ?? ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const repoPath = scope === 'rendered' ? null : where;
      if (repoPath === allowlistRel && allowlist.some(e => e.value === f.value)) { selfRefs++; continue; }
      const ex = repoPath && allowlist.find(e => e.path === repoPath && e.value === f.value && e.pattern === f.pattern);
      const entry = { scope, [scope === 'rendered' ? 'route' : 'path']: where, ...extra, pattern: f.pattern, match: redact(f) };
      (ex ? excepted : findings).push(entry);
    }
  };
  const skip = (where, reason) => coverage.skipped_non_text.push({ path: where, reason });
  const scanBuffer = (scope, where, buf, extra = {}) => {
    if (isBinary(buf)) return skip(where, scope === 'history' ? `binary, in history at ${extra.commit}` : 'binary');
    const step = CONFIG.scanChunkBytes;
    if (buf.length <= step) return consider(scope, where, buf.toString('utf8'), extra);
    for (let i = 0; i < buf.length; i += step) {
      consider(scope, where, buf.subarray(Math.max(0, i - CONFIG.scanOverlapBytes), i + step).toString('utf8'), extra);
    }
  };

  // Current tracked files (working tree), and staged contents that differ from it.
  const tracked = git(repo, ['ls-files', '-z']).split('\0').filter(Boolean);
  if (tracked.some(p => p.startsWith(privatePrefix))) problems.push('files under private/ are tracked by Git; remove them from the repository and treat their contents as exposed');
  const staged = new Map();
  for (const line of git(repo, ['ls-files', '-s', '-z']).split('\0').filter(Boolean)) {
    const m = line.match(/^\d+ ([0-9a-f]+) \d\t(.*)$/s);
    if (m) staged.set(m[2], m[1]);
  }
  const stagedBlobs = readBlobs(repo, [...new Set(staged.values())]);
  for (const p of tracked) {
    if (p === sensitiveRel) continue;
    const abs = path.join(repo, p);
    let work = null;
    try { if (fs.statSync(abs).isFile()) work = fs.readFileSync(abs); } catch { /* deleted in working tree */ }
    if (work) { coverage.tracked_files++; scanBuffer('tracked', p, work); }
    const sb = stagedBlobs.get(staged.get(p));
    if (sb && (!work || !sb.equals(work))) { coverage.staged_blobs++; scanBuffer('staged', p, sb); }
  }

  // Deployable output, including files that exist only in the output.
  if (siteReal) {
    const walk = dir => {
      for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const abs = path.join(dir, ent.name);
        if (ent.isDirectory()) walk(abs);
        else if (ent.isFile()) {
          const rel = posix(path.relative(repo, abs));
          const where = rel.startsWith('..') ? `site:${posix(path.relative(siteReal, abs))}` : rel;
          coverage.site_files++;
          scanBuffer('site', where, fs.readFileSync(abs));
        }
      }
    };
    walk(siteReal);
  }

  // Rendered page text and serialized DOM on listed routes.
  for (const r of rendered) {
    coverage.routes_rendered++;
    consider('rendered', r.route, r.text);
    consider('rendered', r.route, r.html);
  }
  if (!renderedComplete) problems.push('rendered pages were not available for every listed route; rendered-page coverage is incomplete');

  // History: every blob at every path, across all local refs.
  if (tryGit(repo, ['rev-parse', '--is-shallow-repository'])?.trim() === 'true') {
    coverage.history.complete = false;
    problems.push('the repository is a shallow clone; fetch full history (git fetch --unshallow) so history can be scanned');
  }
  const commits = (tryGit(repo, ['rev-list', '--all']) ?? '').split('\n').filter(Boolean);
  coverage.history.commits = commits.length;
  const occurrences = new Map(); // `${blob}\0${path}` -> commit
  for (const c of commits) {
    for (const ent of git(repo, ['ls-tree', '-r', '-z', '--full-tree', c]).split('\0').filter(Boolean)) {
      const m = ent.match(/^\d+ blob ([0-9a-f]+)\t(.*)$/s);
      if (m && m[2] !== sensitiveRel) occurrences.set(`${m[1]}\0${m[2]}`, c);
    }
  }
  const blobs = readBlobs(repo, [...new Set([...occurrences.keys()].map(k => k.split('\0')[0]))]);
  coverage.history.blobs = blobs.size;
  for (const [key, commit] of occurrences) {
    const [sha, p] = key.split('\0');
    const buf = blobs.get(sha);
    if (buf === null || buf === undefined) {
      coverage.history.complete = false;
      problems.push(`history blob for ${p} is missing locally (partial clone?); history coverage is incomplete`);
      continue;
    }
    scanBuffer('history', p, buf, { commit: commit.slice(0, 12) });
  }
  coverage.skipped_non_text = dedupeBy(coverage.skipped_non_text, s => s.path);
  return { findings, excepted, selfRefs, problems, coverage };
}
function dedupeBy(list, key) {
  const m = new Map();
  for (const x of list) if (!m.has(key(x))) m.set(key(x), x);
  return [...m.values()];
}

// ---------------------------------------------------------------- report

function rubricItems() {
  const file = path.join(HERE, 'rubric.md');
  if (!fs.existsSync(file)) return [{ id: 'rubric', item: 'evals/rubric.md is missing; review against the Cookbook rubric', status: 'awaiting review' }];
  return [...fs.readFileSync(file, 'utf8').matchAll(/^### (R\d+)\s*·\s*(.+)$/gm)].map(m => ({ id: m[1], item: m[2].trim(), status: 'awaiting review' }));
}

function renderMarkdown(rep) {
  const L = [];
  const esc = s => String(s).replace(/\|/g, '\\|');
  L.push('# Trip check report', '');
  L.push(`Generated ${rep.generated} by \`evals/check.mjs\`.`);
  const b = rep.inputs.base;
  L.push(`Baseline: \`${b.arg ?? '(missing)'}\`${b.commit ? ` = ${b.commit}` : ''}${rep.inputs.published_tag ? `; \`published\` tag = ${rep.inputs.published_tag}` : ''}.`);
  L.push('', 'These three columns are separate. Nothing here is "verified" as a whole, and a zero exit code is never permission to publish.', '');
  L.push('## Automated Pass', '', '| Check | Result | What was checked |', '| --- | --- | --- |');
  for (const id of CHECK_IDS) L.push(`| ${id} | ${rep.checks[id].result} | ${esc(CHECK_TITLES[id])} |`);
  L.push('');
  for (const id of CHECK_IDS) {
    const c = rep.checks[id];
    const lines = [];
    if (c.sub) for (const [k, v] of Object.entries(c.sub)) lines.push(`- ${k.replace(/_/g, ' ')}: ${v}`);
    for (const d of c.details ?? []) {
      const where = [d.suite, d.route].filter(Boolean).join(' ');
      lines.push(`- ${where ? `\`${where}\`: ` : ''}${typeof d === 'string' ? d : d.problem}`);
    }
    if (lines.length) L.push(`### ${id}`, '', ...lines, '');
  }
  if (rep.third_party.length) {
    L.push('### Third-party resources', '', 'Reported separately; review whether any of these prevent trip use.', '');
    for (const t of rep.third_party) L.push(`- \`${t.suite} ${t.route}\` (${t.phase}): ${t.url} — ${t.status ? `HTTP ${t.status}` : t.error}`);
    L.push('');
  }
  if (rep.privacy) {
    const p = rep.privacy, cv = p.coverage;
    L.push('### Privacy scan coverage', '');
    L.push(`- Tracked files: ${cv.tracked_files}; staged versions: ${cv.staged_blobs}; output files: ${cv.site_files}; rendered routes: ${cv.routes_rendered}`);
    L.push(`- History: ${cv.history.commits} commits, ${cv.history.blobs} blobs, ${cv.history.complete ? 'complete' : 'INCOMPLETE'}`);
    L.push(`- Custom terms: ${cv.custom_terms}`);
    L.push(`- Exceptions applied: ${p.excepted.length}; allowlist self-references: ${p.allowlist_self_references}`);
    L.push(`- Skipped non-text files (not covered; review them yourself): ${cv.skipped_non_text.length}`);
    for (const f of p.findings) L.push(`- FINDING ${f.scope} \`${f.path ?? f.route}\`${f.commit ? ` @ ${f.commit}` : ''}: ${f.pattern} ${f.match}`);
    for (const f of p.excepted) L.push(`- excepted ${f.scope} \`${f.path}\`${f.commit ? ` @ ${f.commit}` : ''}: ${f.pattern} ${f.match}`);
    L.push('');
  }
  if (rep.notes_changes) {
    const n = rep.notes_changes;
    L.push('### Changed since the last notes edit', '');
    L.push('Informational, with no result: project files changed since `NOTES.md` was last committed. Ordinary content edits don\'t need a notes edit. Use this list as evidence for R11.', '');
    if (n.unavailable) L.push(`- Change discovery is unavailable: ${n.unavailable}.`);
    else {
      if (n.history.available) {
        L.push(`- Last commit touching \`NOTES.md\`: ${n.baseline.commit.slice(0, 12)} (${n.baseline.date})`);
        L.push(`- Commits since then that touch project files: ${n.history.commits.length + n.history.more}`);
        for (const c of n.history.commits) L.push(`  - ${c.commit.slice(0, 12)} ${c.date} ${c.subject}: ${c.files.map(f => `\`${f}\``).join(', ')}`);
        if (n.history.more) L.push(`  - and ${n.history.more} more`);
      } else L.push(`- History comparison unavailable: ${n.history.reason}.`);
      L.push(`- Uncommitted changes to project files: ${n.working_tree.length}`);
      for (const w of n.working_tree) L.push(`  - \`${w.path}\` (${w.status})`);
      if (n.notes_uncommitted) L.push(`- \`NOTES.md\` has uncommitted edits${n.history.available ? '; the history comparison above uses its last committed version' : ''}.`);
    }
    L.push('');
  }
  L.push('## Agent Reviewed', '', 'Complete each applicable item with a result and reasons.', '');
  for (const a of rep.agent_reviewed) L.push(`- [ ] **${a.id}** ${a.item} — ${a.status}`);
  L.push('', '## User Confirmation Required', '', 'Mark each as covered by specific existing consent, not applicable (with a reason), or awaiting the user.', '');
  for (const u of rep.user_confirmation) L.push(`- [ ] ${u.text} — ${u.status}`);
  L.push('');
  return L.join('\n');
}

// ---------------------------------------------------------------- main

async function main() {
  const { opts, errors: argErrors } = parseArgs(process.argv.slice(2));
  if (opts.help) { console.log(USAGE); return 0; }
  const cwd = process.cwd();
  const root = path.resolve(cwd, opts.root ?? '.');
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    console.error(`Project root not found: ${root}\n${USAGE}`);
    return 2;
  }

  const report = {
    tool: 'trip-cookbook check', format: 1, generated: new Date().toISOString(), config: CONFIG,
    inputs: { site: opts.site ?? null, root, url: opts.url ?? null, fetch_sources: opts.fetchSources, base: { arg: opts.base ?? null, commit: null }, published_tag: null, routes: [] },
    checks: {}, third_party: [], privacy: null, notes_changes: null, agent_reviewed: [], user_confirmation: [],
  };
  const g1 = [...argErrors];
  const set = (id, result, details = [], extra = {}) => { report.checks[id] = { result, details, ...extra }; };

  // Git context.
  const repo = tryGit(root, ['rev-parse', '--show-toplevel'])?.trim();
  const repoReal = repo ? fs.realpathSync(repo) : null;
  if (!repoReal) g1.push('the project root is not inside a Git repository');
  const rootRel = repoReal ? posix(path.relative(repoReal, fs.realpathSync(root))) : '';

  // Site directory guard (section 1.1).
  let siteReal = null;
  if (opts.site) {
    const site = path.resolve(cwd, opts.site);
    if (!fs.existsSync(site) || !fs.statSync(site).isDirectory()) g1.push(`site directory not found: ${opts.site}`);
    else {
      const real = fs.realpathSync(site);
      const problems = [];
      if (repoReal) {
        const up = path.relative(real, repoReal);
        if (!up.startsWith('..') && !path.isAbsolute(up)) problems.push('--site is the repository root or one of its ancestors; keep the deployable site in its own directory');
        const down = path.relative(repoReal, real);
        if (!down.startsWith('..') && down.split(path.sep).some(s => s === 'private' || s === '.git')) problems.push('--site is inside private/ or .git/');
      }
      for (const rel of forbiddenEntries(real)) problems.push(`--site contains ${rel}; private/ and .git must never be part of the deployable output, at any depth`);
      if (!fs.existsSync(path.join(real, 'index.html'))) problems.push('--site has no index.html entry page');
      g1.push(...problems);
      if (!problems.length) siteReal = real;
    }
  }

  // Custom sensitive terms: used by P1 and to redact every diagnostic the report carries.
  const termsFile = path.join(root, 'private', 'sensitive.txt');
  const terms = fs.existsSync(termsFile) ? fs.readFileSync(termsFile, 'utf8').split(/\r?\n/).map(s => s.trim()).filter(Boolean) : [];

  // Current ledger.
  let ledger = null;
  const ledgerFile = path.join(root, 'ledger.json');
  if (!fs.existsSync(ledgerFile)) g1.push('ledger.json not found in the project root');
  else {
    try { ledger = JSON.parse(fs.readFileSync(ledgerFile, 'utf8')); } catch (e) { g1.push(`ledger.json is not valid JSON: ${short(e)}`); }
  }

  // Route list.
  let routes = [];
  const routesFile = path.join(root, 'evals', 'routes.txt');
  if (!fs.existsSync(routesFile)) g1.push('evals/routes.txt not found; create it from evals/routes.example.txt');
  else {
    const parsed = parseRoutes(fs.readFileSync(routesFile, 'utf8'));
    g1.push(...parsed.errors);
    routes = parsed.errors.length ? [] : parsed.routes;
  }
  report.inputs.routes = routes;

  // Baseline (section 3.2).
  let baseline = null;
  let baselineOk = false;
  let baseSha = null;
  const ledgerRel = posix(path.join(rootRel, 'ledger.json'));
  const allowlistRel = posix(path.join(rootRel, 'evals', 'privacy-fixtures.json'));
  if (repoReal && opts.base) {
    if (opts.base === 'initial') baselineOk = true;
    else {
      baseSha = tryGit(repoReal, ['rev-parse', '--verify', '--quiet', `${opts.base}^{commit}`])?.trim() || null;
      if (!baseSha) g1.push(`baseline "${opts.base}" does not resolve to a commit`);
      else {
        report.inputs.base.commit = baseSha;
        const text = tryGit(repoReal, ['show', `${baseSha}:${ledgerRel}`]);
        if (text === null) g1.push(`baseline ${baseSha.slice(0, 12)} has no ${ledgerRel}`);
        else {
          try { baseline = JSON.parse(text); baselineOk = true; } catch (e) { g1.push(`baseline ${ledgerRel} is not valid JSON: ${short(e)}`); }
        }
      }
    }
    const tag = tryGit(repoReal, ['rev-parse', '--verify', '--quiet', 'refs/tags/published^{commit}'])?.trim() || null;
    report.inputs.published_tag = tag;
    if (tag && tag !== baseSha) {
      report.user_confirmation.push({ kind: 'baseline-mismatch', text: `--base ${opts.base} ${baseSha ? `(${baseSha.slice(0, 12)}) ` : ''}differs from the \`published\` tag (${tag.slice(0, 12)}); publication must be compared against the last accepted publication`, status: 'awaiting authorization review' });
    }
  }

  // L1.
  const l1 = ledger ? ledgerErrors(ledger) : ['ledger.json could not be read'];
  set('L1', l1.length ? FAIL : PASS, l1);
  const ledgerUsable = !!ledger && typeof ledger === 'object';

  // Protected changes (third column).
  if (ledgerUsable && baselineOk) {
    for (const c of protectedChanges(baseline, ledger)) {
      const what = `${c.kind} \`${c.id}\`: ${c.change}${c.fields?.length ? ` (fields: ${c.fields.join(', ')})` : ''}${c.evidence ? `; approval evidence: ${c.evidence}` : ''}`;
      report.user_confirmation.push({ kind: 'protected-change', item: c.kind, id: c.id, change: c.change, fields: c.fields ?? [], evidence: c.evidence ?? null, text: `Protected change, ${what}`, status: 'awaiting authorization review' });
    }
  } else {
    report.user_confirmation.push({ kind: 'comparison-incomplete', text: 'Protected-change comparison is incomplete: the current ledger or the baseline could not be read', status: 'awaiting authorization review' });
  }

  // Browser checks.
  const confirmedIds = ledgerUsable ? arr(ledger.commitments).filter(c => c?.status === 'confirmed' && typeof c.id === 'string').map(c => c.id) : [];
  let suites = null;
  let live = null;
  const browserReason = !siteReal ? 'site directory failed the G1 guard' : !routes.length ? 'no valid route list' : null;
  if (!browserReason) {
    let browser = null;
    try {
      browser = await chromium.launch();
    } catch (e) {
      g1.push(`browser could not start (${short(e)}); run: npm --prefix evals exec -- playwright install chromium`);
    }
    if (browser) {
      try {
        suites = {};
        for (const s of SUITES) suites[s.name] = await runSuite(browser, s, siteReal, routes, confirmedIds, report.third_party, terms);
        if (opts.url) {
          let liveBase = null;
          try {
            const u = new URL(opts.url);
            if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('not http(s)');
            if (!u.pathname.endsWith('/')) u.pathname += '/';
            u.hash = ''; u.search = '';
            liveBase = u.href;
          } catch { live = { error: `--url "${opts.url}" is not an absolute http(s) URL` }; }
          if (liveBase) live = { results: await runLive(browser, liveBase, routes, report.third_party) };
        }
      } finally {
        await browser.close();
      }
    }
  }
  if (suites) {
    const e1 = e1Result(suites.root);
    set('E1', e1.result, e1.details);
    const e2 = e2Result(suites.root);
    set('E2', e2.result, e2.details);
    const e3a = e1Result(suites.subpath), e3b = e2Result(suites.subpath);
    set('E3', e3a.result === PASS && e3b.result === PASS ? PASS : FAIL, [...e3a.details, ...e3b.details]);
    const e4 = [...e4Details('root', suites.root), ...e4Details('subpath', suites.subpath)];
    set('E4', e4.length ? FAIL : PASS, e4);
  } else {
    const why = browserReason ?? 'the browser did not start';
    for (const id of ['E1', 'E2', 'E3', 'E4']) set(id, SKIPPED, [`not run: ${why}`]);
  }
  if (!opts.url) set('E5', SKIPPED, ['no --url given; deployment acceptance is not established']);
  else if (live?.error) set('E5', FAIL, [live.error]);
  else if (live) {
    const a = e1Result(live.results), b = e2Result(live.results);
    set('E5', a.result === PASS && b.result === PASS ? PASS : FAIL, [...a.details, ...b.details]);
  } else set('E5', SKIPPED, [`not run: ${browserReason ?? 'the browser did not start'}`]);

  // L2.
  if (!ledgerUsable) set('L2', SKIPPED, ['not run: ledger.json could not be read']);
  else if (!suites) set('L2', SKIPPED, ['not run: the local root suite did not run']);
  else {
    const l2 = evaluateL2(suites.root, ledger);
    set('L2', l2.result, l2.details, { sub: l2.sub });
  }

  // L3.
  if (!ledgerUsable) set('L3', FAIL, ['ledger.json could not be read'], { sub: { reachability: SKIPPED } });
  else {
    const sourced = arr(ledger.facts).filter(f => f?.status === 'sourced');
    const details = [];
    for (const f of sourced) {
      if (!isHttpUrl(f.source)) details.push({ problem: `fact "${f.id}": source is missing or not an absolute http(s) URL` });
      if (!isCalendarDate(f.checked)) details.push({ problem: `fact "${f.id}": checked is missing or not a valid date` });
    }
    let reachability = SKIPPED;
    if (opts.fetchSources) {
      const fetchable = sourced.filter(f => isHttpUrl(f.source));
      let failed = false;
      for (const f of fetchable) {
        const r = await reach(f.source);
        if (!r.ok) {
          failed = true;
          details.push({ problem: `fact "${f.id}": source not reachable now (${r.status ? `HTTP ${r.status}` : r.error}); this does not show the claim is false` });
        }
      }
      reachability = fetchable.length === 0 ? NA : failed ? FAIL : PASS;
    }
    const fieldsFail = details.some(d => !/not reachable/.test(d.problem));
    const result = fieldsFail || reachability === FAIL ? FAIL : sourced.length === 0 ? NA : PASS;
    set('L3', result, details, { sub: { sourced_facts: sourced.length, reachability } });
  }

  // P1.
  const allowErrors = [];
  const allowlist = loadAllowlist(path.join(root, 'evals', 'privacy-fixtures.json'), allowErrors);
  if (repoReal) {
    const rendered = suites ? suites.root.filter(r => r.dom).map(r => ({ route: r.route, ...r.dom })) : [];
    const renderedComplete = !!suites && rendered.length === routes.length;
    const scan = privacyScan({ repo: repoReal, rootRel, siteReal, rendered, renderedComplete, allowlist, allowlistRel, terms });
    if (!siteReal) scan.problems.push('the deployable output was not scanned because the site directory failed the G1 guard');
    scan.problems.push(...allowErrors);
    report.privacy = { coverage: scan.coverage, findings: scan.findings, excepted: scan.excepted, allowlist_self_references: scan.selfRefs, problems: scan.problems };
    const details = [
      ...scan.problems.map(problem => ({ problem })),
      ...scan.findings.map(f => ({ problem: `${f.scope} ${f.path ?? f.route}${f.commit ? ` @ ${f.commit}` : ''}: ${f.pattern} ${f.match}` })),
    ];
    set('P1', details.length ? FAIL : PASS, details, { sub: { findings: scan.findings.length, exceptions: scan.excepted.length } });
  } else set('P1', FAIL, ['not run: no Git repository']);

  // Allowlist changes go to Agent Reviewed.
  const allowChanges = [];
  if (repoReal && baselineOk) {
    const before = baseSha ? tryGit(repoReal, ['show', `${baseSha}:${allowlistRel}`]) : null;
    let beforeList = [];
    if (before) { try { beforeList = parseAllowlist(JSON.parse(before), []); } catch { /* treated as empty */ } }
    const key = e => canonical({ path: e.path, value: e.value, pattern: e.pattern, reason: e.reason });
    const old = new Set(beforeList.map(key));
    for (const e of allowlist) if (!old.has(key(e))) allowChanges.push(`${e.path} (${e.pattern})`);
    const now = new Set(allowlist.map(key));
    for (const e of beforeList) if (!now.has(key(e))) allowChanges.push(`removed: ${e.path} (${e.pattern})`);
  }

  // N1 needs no browser and no site, so it runs whatever happened to G1.
  const ledgerIds = ledgerUsable ? new Set(items(ledger).map(x => x.item?.id).filter(id => typeof id === 'string')) : null;
  const n1 = checkNotes(root, ledgerIds);
  set('N1', n1.result, n1.details);
  report.notes_changes = repoReal ? notesChanges(repoReal, rootRel) : { unavailable: 'no Git repository' };

  // G1.
  set('G1', g1.length ? FAIL : PASS, g1);

  // Columns two and three.
  report.agent_reviewed = rubricItems();
  if (report.third_party.length) report.agent_reviewed.push({ id: 'third-party', item: `${report.third_party.length} third-party resource failures (listed under Automated Pass): do any prevent trip use?`, status: 'awaiting review' });
  const skipped = report.privacy?.coverage.skipped_non_text ?? [];
  if (skipped.length) report.agent_reviewed.push({ id: 'binary-files', item: `${skipped.length} non-text files were not scanned: ${skipped.slice(0, 20).map(s => s.path).join(', ')}${skipped.length > 20 ? ', …' : ''}. Inspect them for private content.`, status: 'awaiting review' });
  if (allowChanges.length) report.agent_reviewed.push({ id: 'privacy-allowlist', item: `privacy-fixtures.json changed against the baseline: ${allowChanges.join('; ')}. Confirm each is a synthetic value.`, status: 'awaiting review' });
  report.user_confirmation.push({ kind: 'visibility-review', text: 'Visibility review: does everything that will be public stay within the approved publication scope? (first publication or any new category needs the user\'s confirmation)', status: 'awaiting authorization review' });

  // Exit code reflects automated checks only.
  const required = ['G1', 'E1', 'E2', 'E3', 'E4', 'L1', 'L2', 'L3', 'P1', 'N1', ...(opts.url ? ['E5'] : [])];
  const ok = required.every(id => report.checks[id].result === PASS || report.checks[id].result === NA);
  const exitCode = argErrors.length ? 2 : ok ? 0 : 1;
  report.exit_code = exitCode;

  const scrub = v => (typeof v === 'string' ? redactText(v, terms)
    : Array.isArray(v) ? v.map(scrub)
    : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, scrub(x)])) : v);
  for (const key of ['checks', 'third_party', 'notes_changes', 'agent_reviewed', 'user_confirmation']) report[key] = scrub(report[key]);

  const outDir = path.join(root, '.trip-check');
  fs.mkdirSync(outDir, { recursive: true });
  const ordered = { ...report, checks: Object.fromEntries(CHECK_IDS.map(id => [id, report.checks[id]])) };
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(ordered, null, 2) + '\n');
  fs.writeFileSync(path.join(outDir, 'report.md'), renderMarkdown(ordered));

  for (const id of CHECK_IDS) console.log(`${id.padEnd(3)} ${report.checks[id].result.padEnd(14)} ${CHECK_TITLES[id]}`);
  console.log(`\nAgent Reviewed: ${report.agent_reviewed.length} items awaiting review. User Confirmation Required: ${report.user_confirmation.length} items.`);
  console.log(`Report: ${path.relative(cwd, path.join(outDir, 'report.md')) || outDir}`);
  if (argErrors.length) console.error(`\n${argErrors.join('\n')}\n${USAGE}`);
  return exitCode;
}

main().then(code => { process.exitCode = code; }, e => { console.error(e); process.exitCode = 1; });
