# Trip Cookbook

A cookbook for coding agents: give it to your agent and, in an afternoon, end up with your own trip website. The site works on a phone, keeps working offline, and is deployed where you choose.

> **Status: V0.1.0, the first release.** [CHANGELOG.md](CHANGELOG.md) lists what's included and, for later releases, what changed.

## What this is, and isn't

This repository holds design knowledge, a working method and quality checks. It does **not** contain a shared app or template site. Your agent interviews you, researches your trip, proposes designs, and builds a site that belongs entirely to you: your framework, your visuals, your repository, your host. A site that looks nothing like anyone else's but serves your travellers well is the goal.

What carries over between sites is a small set of safety rules:

- **Bookings don't move without you.** Confirmed bookings and approved decisions are recorded in a small `ledger.json`. Your agent warns instead of silently changing them, and asks before changing anything you've settled.
- **Facts carry sources.** High-impact facts (closed days, ticket-sale dates, entry rules) carry a source and the date it was checked. Estimates and unverified claims are labelled as such.
- **Private stays private.** Booking numbers, passport and payment details, and credentials never go into Git or onto the site.
- **Checks you can read.** A checker tests the site on a phone-sized screen, offline, and under a subpath, and scans for leaked private data. Its report separates what was checked automatically, what the agent reviewed, and what still needs your confirmation.

## Prerequisites

- A coding agent that can read files and run shell commands. Recommended: [Claude Code](https://claude.com/claude-code) with a current Claude model (Claude Opus 5.5 or Sonnet 5.5). Other capable agents should work; results and style vary across models.
- [Git](https://git-scm.com/) and [Node.js](https://nodejs.org/) 24 LTS or newer.
- About 1 GB of free disk space for the checker's headless browser.
- An account with a Git host (for example GitHub) and a static site host (see [Hosting](#hosting)).
- Your trip details: who's travelling, dates, and any bookings you've already made. Keep booking confirmations handy; you'll share what's needed with your agent, and it keeps sensitive parts out of the public site.

## The four-hour path

Plan on an afternoon, plus the token spend that comes with it. A typical run:

| Step | Roughly |
| --- | --- |
| Setup: empty folder, agent installs the Cookbook and checker | 20 min |
| Interview: the agent asks what it needs, a few questions at a time | 20–30 min |
| Research: high-impact facts, with sources | 45–60 min |
| Design: at least two different directions; you pick one | 20 min |
| Build, check and fix | 60–90 min |
| Visibility review and deployment | 30 min |

You stay in the loop for the interview, the design choice, anything that touches a booking or a settled decision, and the final "is this OK to publish?".

## Start

Make an empty folder and open your coding agent in it:

```bash
mkdir my-trip && cd my-trip
```

Then paste this one-line opener:

```text
Build me a trip website with the Trip Cookbook at https://github.com/davidycf/trip-cookbook — read its AGENTS.md first.
```

During setup the agent copies the Cookbook's `AGENTS.md`, `cookbook/`, `reference/` and `evals/` into your project, along with its license notice as `COOKBOOK_LICENSE`, then installs the checker. These are the commands it runs (you don't need to run them yourself):

```bash
npm --prefix evals ci
```

```bash
npm --prefix evals exec -- playwright install chromium
```

### Coming back later

When you come back to your trip, start with:

```text
Read AGENTS.md and NOTES.md.
```

Your agent keeps `NOTES.md` as a short index of where everything lives in your project, so a new session, with any agent, picks up from the site itself rather than from memory.

## Visibility

Decide early who can see what. There are three zones:

| Zone | Who can see it |
| --- | --- |
| Your deployed site | Anyone with the URL |
| Your repository and its full history | Public repository: anyone, permanently (it can be forked or cached). Private repository: you and the people and services you allow |
| `private/` folder in your project | Only you; it is never committed or deployed |

**A public repository exposes everything in it, including every past version, not just the site.** A private repository is recommended where your host supports deploying from one for free. If you later make a private repository public, its whole history becomes public too, so your agent keeps the repository's contents public-safe either way.

Before anything becomes public for the first time, your agent summarizes what will be visible (for example family names, children's ages, home city, dates and specific hotels) and waits for your OK.

## Hosting

Your site is a folder of static files, so any static host that serves HTTPS works. Your agent proposes one based on accounts you already have, and the Cookbook includes worked examples for:

- **GitHub Pages:** free for public repositories; private repositories need a paid GitHub plan.
- **Cloudflare Pages:** deploys from public or private repositories.
- **Netlify:** deploys from public or private repositories.

Other static hosts should work too; your agent reviews the deployment against the host's behavior.

## What's in this repository

| Path | For |
| --- | --- |
| [AGENTS.md](AGENTS.md) | Your agent: work modes, rules, and what to read when |
| `cookbook/` | Guides the agent follows: principles, interview, research, design, build, privacy, upgrade |
| `evals/` | Ledger schema, checker, rubric and checker tests |
| `examples/weekend-sample/` | A small, complete example site |
| `reference/` | A design guide drawn from a real family trip site, with de-identified screenshots |

## License

[MIT](LICENSE).
