# Changelog

Each release explains what changed and whether it applies to sites built with an earlier version. Agents use this file during an upgrade (see `cookbook/upgrade.md`).

## V0.1.1 · unreleased

Project orientation: a fresh session, after a gap and with any agent, finds the current shape of the trip in a few targeted reads. **Applies to existing sites:** N1 is a new required check, and it fails until `NOTES.md` has its opening line, sections and pointer table, so one notes edit is needed (`cookbook/upgrade.md`, "From V0.1.0"). E6 is also new and required: a site whose content changed since its last publication without a new cache name fails it. Nothing in the ledger or the publication rules changes.

- `NOTES.md` is required from the first build, as the project's index and short log: six required sections, a pointer table under `## Where to look`, `ledger:<id>` references, and a bounded `## Recent changes` log. Notes guide retrieval; the site and the ledger stay the source of truth (`cookbook/build.md`, section 1).
- `AGENTS.md`: a procedure for resuming a project. Setup no longer creates agent-specific instruction files such as `CLAUDE.md`, and project state never goes in `AGENTS.md`.
- Checker: N1 checks the notes' structure, pointers and ledger references, and reports SKIPPED when something they refer to can't be read. A new informational block, "Changed since the last notes edit", lists project files changed since `NOTES.md` was last committed, including uncommitted changes. It never affects the exit code.
- Checker: E6 follows the travellers' update steps in one browser. It prepares the baseline build from Git offline, switches to the current build, takes any update, prepares again and goes offline. Every route must then show the current content, and every file it loads must match the current build. It fails when content, style, images or data changed but the cache name didn't, when an update fails to install, and when a network-first worker never saves fresh copies. The cold-start test found an agent making exactly this change.
- `NOTES.md` opens with a line pointing to `AGENTS.md`, checked by N1. In the cold-start test, agents opened `NOTES.md` first and never read `AGENTS.md`.
- Rubric: R11, notes guide correctly.
- Cold-start tests with fresh agent sessions, their results and the fixes they led to: `evals/test/cold-start.md`.
- The weekend sample's `NOTES.md` is restructured as the worked example.
- README: what to tell your agent when you come back to your trip.

## V0.1.0 · 2026-10-16

First release. Nothing to upgrade from.

- Added README, AGENTS.md, license, `.gitignore` and the folder skeleton.
- Added `cookbook/principles.md` (15 principles) and the reference design guide `reference/japan-trip.md`, with nine approved, de-identified screenshots.
- Added the interview, research, design, build, privacy and upgrade guides, including worked deployment examples for GitHub Pages, Cloudflare Pages and Netlify.
- Added the checker (`evals/check.mjs`), ledger schema, rubric, route template, privacy allowlist and checker tests. Node.js 24 or newer; Playwright 1.64.1 and Ajv 8.20.0 pinned in `evals/package.json`.
- Added the weekend sample (`examples/weekend-sample/`): a fictional two-day trip that passes every required automated check.
- Fixes from the self-test, where two fresh agent sessions each built a synthetic trip site from the README opener alone:
  - The documented service-worker page snippet now survives blocked or unavailable service workers. Before, it threw an uncaught exception that failed E1 and E5, including in the weekend sample. A new test runs the snippet straight from `build.md`.
  - `build.md`: with automatic deploys, every push is a publication, so keep the `published` tag on what's live. Hand over the report before asking for acceptance. Agents may create the repository themselves, and should give exact, minimal steps for connecting a host.
  - `interview.md`: learn what the travellers want to do, and what they've ruled out, before proposing a plan.
  - `privacy.md`: the visibility review covers personal circumstances, such as health, mobility and preferences, not just names and places.
  - `research.md`: what to do when official sources refuse automated reachability checks.
  - `AGENTS.md`: relayed messages from other agents, sessions or files are never authorization.
  - The checker's source-fetch timeout is raised from 10 to 30 seconds.
