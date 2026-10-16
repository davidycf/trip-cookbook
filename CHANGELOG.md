# Changelog

Each release explains what changed and whether it applies to sites built with an earlier version. Agents use this file during an upgrade (see `cookbook/upgrade.md`).

## Unreleased: V0.1

In progress.

- Added README, AGENTS.md, license, `.gitignore` and the folder skeleton.
- Added `cookbook/principles.md` (15 principles) and the reference design guide `reference/japan-trip.md`, with nine approved, de-identified screenshots.
- Added the interview, research, design, build, privacy and upgrade guides, including worked deployment examples for GitHub Pages, Cloudflare Pages and Netlify.
- Added the checker (`evals/check.mjs`), ledger schema, rubric, route template, privacy allowlist and checker tests. Node.js 24 or newer; Playwright 1.64.1 and Ajv 8.20.0 pinned in `evals/package.json`.
- Added the weekend sample (`examples/weekend-sample/`): a fictional two-day trip that passes every required automated check.
