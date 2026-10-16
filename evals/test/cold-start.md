# Cold-start tests (V0.1.1)

V0.1.1 adds `NOTES.md` as each project's index, so that an agent arriving cold finds the current shape of the trip in a few targeted reads. These tests check that with fresh agent sessions. This file isn't copied into projects.

## Method

Each case ran in a fresh Claude Code session (Claude Opus 5.5) in a neutrally named folder. The session started with nothing but the traveller's question, plus one neutral line of background that the app requires: "This folder is my weekend trip project, with the trip website and its files. I'm asking a question about the trip." Once the session answered, the change request followed as its second message.

**Fixture.** The weekend sample, assembled beforehand and outside the test session into a project exactly as setup leaves one:

1. A new folder, whose name gives no hint of the case.
2. At the project root: the sample's `ledger.json`, `site/` and `evals/routes.txt`; its `NOTES.md`, with the build record rewritten as project-relative commands; and a short project README.
3. The Cookbook as `AGENTS.md` installs it: `AGENTS.md`, `cookbook/`, `reference/`, `evals/` without `test/` and with its dependencies installed, `COOKBOOK_LICENSE` and `COOKBOOK_VERSION`.
4. The ignore rules from setup (`private/`, `evals/node_modules/`, `.trip-check/`), and a `private/sensitive.txt`.
5. Git history: a "First build" commit tagged `published`. In case 2 this is followed by an ordinary commit, "Sunday afternoon: rock-pool walk". It changes Sunday's 14:00 item in `site/plan.json` (and the cache name in `site/sw.js`) and doesn't touch the notes.
6. A check before handing the project over: `node evals/check.mjs --site site --base published` passes, change discovery shows what the case intends, and the report is removed.

**Messages.**

| Case | Question | Change request |
| --- | --- | --- |
| 1 · Notes and site agree | "What's the plan on Sunday afternoon, and what's still open?" | "Move Sunday's fish lunch to 13:00." An ordinary edit: no notes edit expected |
| 2 · Site changed, notes didn't | The same | "Add a rainy-day alternative to each afternoon, shown on the day pages." A new kind of content: a notes edit expected |

**Scoring.** Correctness first, then retrieval scope: which files the agent read, and whether the notes' pointers led there.

## Results, first round (PR 7)

| | Case 1 | Case 2 |
| --- | --- | --- |
| Answer | Correct: 12:30 lunch, free afternoon, 16:30 bags, confirmed 17:05 train. Open: the unverified later train and the proposed cliff-path fallback | Correct, including the 14:00 rock-pool walk from the commit after the last notes edit. The agent didn't need to call the notes outdated, and their pointers still held |
| Reads | `NOTES.md`, then `ledger.json` and `site/plan.json` (the pointers' targets) and `git log` | `NOTES.md`, then the ledger and plan, then `git show HEAD`; it also ran the checker |
| Change | Correct time; ledger untouched; checker run; full three-column report; notes correctly left alone. **But the cache name wasn't changed**, so phones that had prepared the site would keep 12:30 and never be offered the update. Reproduced in a browser; no check caught it | Correct. Added an optional `rain` field, rendered and labelled. Cache name changed (following the previous commit's example). Notes correctly updated: a line explaining the new field, a Recent changes entry, and an open item. Minor: it also logged the earlier activity swap, which the rule doesn't require |
| `AGENTS.md` read? | No | No (it read part of `build.md`) |

Findings:

1. **Agents open `NOTES.md` first, and may never read `AGENTS.md`.** Both did, unprompted. Nothing in `NOTES.md` pointed back to the rules.
2. **A content-only change without a new cache name leaves prepared phones on the old copy.** `build.md` already said "change the cache name on every release", but it didn't spell out content-only changes, and neither the notes nor the checker raised it. The checker always tests in fresh browsers, so it can't see a phone holding an older copy.
3. A fixture mistake, found by case 1: the project was tagged `published` while its notes said it wasn't deployed. The second round says what the tag marks.

## Fixes (PR 8)

- `NOTES.md` opens with a line pointing to `AGENTS.md`, before its first `##` heading; N1 checks it (`build.md`, section 1).
- `build.md` says the cache name changes with every content change too, and uses that as its example of a `## Context` trap. The sample's notes record it for `site/sw.js`.
- **E6 · Offline copies of the baseline update** (required). The checker follows the travellers' update steps in one browser:
  - it prepares the baseline build from Git for offline use;
  - it switches the server to the current build and opens each route online;
  - it takes any update by closing every page and reopening the site, then prepares again;
  - it goes offline.

  Every route must then show the current content, and every file it loads must match the current build. Review of the first version showed that accepting "a new service worker was found" or "the page looks current online" lets stale assets, failed installs and network-first workers that never save fresh copies through, so E6 checks where the traveller ends up instead.
  - E6 is not applicable with `--base initial`.
  - It's also not applicable when the output directory isn't committed, and the report then asks for a manual check.
  - Run against the first round's projects, E6 fails case 1 on Sunday's route and passes case 2.

## Results, second round (case 1 re-run on the fixes)

A new folder, assembled from the PR 8 branch, with the same messages. The app's shared notes folder for linked sessions was emptied for this run; in the first round it held unrelated hand-over notes, which the case 1 session glanced at.

| | Result |
| --- | --- |
| Answer | Correct, as in the first round. Reads: `NOTES.md`, `ledger.json`, the Sunday entry and to-dos of `site/plan.json`, and `git log` |
| Change | Correct time **and a new cache name**: it looked up `CACHE` in `site/sw.js` straight away, as the notes' trap line says. E6 PASS. Ledger untouched; notes correctly left alone; full three-column report with reasons |
| `AGENTS.md` read? | Still no. It read `evals/rubric.md` and the checker report, which carry the review method |

**Pass.** Both cases give the right current answer from the notes' pointers. Change requests are made correctly, and the notes are edited only when the maintenance rule calls for it.

**What's still open.** The opening line didn't get the agent to read `AGENTS.md` before changing something. What protected the change was the trap line in `## Context` and the checker's E6. Notes can't make an agent read anything. The safeguards that hold are the ones in the files an agent actually reads (`NOTES.md` and the checker report), plus the README's advice to start a returning session with "read AGENTS.md and NOTES.md".
