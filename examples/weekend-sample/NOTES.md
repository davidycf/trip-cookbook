# Notes

Working rules for this project: AGENTS.md. Read it before changing anything.

The weekend sample's index and log, in the structure `cookbook/build.md` asks for. It says where current content lives and how to read it; the site and the ledger hold the content itself. Everything here is sample data.

## Where to look

| Topic | Location |
| --- | --- |
| Bookings, high-impact facts and decisions | `ledger.json` (the site's copy, `site/ledger.json`, is written by the build step) |
| Day plans: times, places, flexible items | `site/plan.json#days`, shown at `#/day/2027-06-12` and `#/day/2027-06-13` |
| Places, each stored once | `site/plan.json#places`, shown at `#/places` |
| Travel to-dos, by owner and deadline | `site/plan.json#todos`, shown at `#/prepare` |
| The way back to the guesthouse, and emergencies | `site/plan.json#help`, shown on every day page and at `#/help` |
| Overview: fixed items, facts, decisions | `route:.`, rendered by `site/app.js` |
| Offline behaviour | `site/sw.js` |

- A day item with a `ledger` field is a booking: its time, title and status come from the ledger, never from the item.
- Day items link to places through `place`, and to facts through `facts`.

## Context

- Hard requirements: home by Sunday evening, and one night only (ledger:one-night).
- Preferences: slow mornings, seafood, one "proper" activity per day.
- Design: a single-page timeline per day, chosen over a map-led layout (ledger:timeline-layout). Two days with few places don't need a map, and a timeline makes the fixed items easy to spot.
- Adopted principles: fixed items separate from flexible ones; one main activity per day; places stored once with the days that pass them; to-dos by owner and deadline; the way back to the guesthouse on every day page.
- Trap: every change to a file the service worker caches (`plan.json`, `ledger.json`, `app.js`, `style.css`, the page) needs a new `CACHE` name in `site/sw.js`. Otherwise phones that prepared the site keep the old copy and are never offered the update.
- Trap: every view is a hash route on one page, so the service worker caches `./` for all of them. A new view needs its route in `evals/routes.txt` and its files in `site/sw.js`.

## Open

- Whether a later Sunday train runs: still to verify (ledger:late-sunday-train).
- Cliff path as the fallback if the boat doesn't sail: proposed, not yet approved (ledger:cliff-path-fallback).
- Travel to-dos: see `#/prepare`.

## Recent changes

- 2026-10-16: notes restructured as an index for V0.1.1. No content moved.

## Visibility

Approved to publish: the travellers' first names, the town, the dates, the guesthouse name and its public address. Not to publish: booking references, surnames, home town.

## Build and deploy

- Host: none (the sample isn't deployed; the Cookbook repository doesn't enable GitHub Pages)
- Repository visibility: public (part of the Cookbook)
- Install: `npm --prefix evals ci` (checker only)
- Build: no build tool; `cp examples/weekend-sample/ledger.json examples/weekend-sample/site/ledger.json`
- Output directory: `examples/weekend-sample/site/`
- Deployment base path: any; the site uses hash routes and page-relative URLs
- Checker: `node evals/check.mjs --root examples/weekend-sample --site examples/weekend-sample/site --base initial`
- Offline preparation for travellers: the "Before you go" view (`#/prepare`)
