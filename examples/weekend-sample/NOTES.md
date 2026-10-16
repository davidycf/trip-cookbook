# Notes

Public-safe requirements and design rationale for the weekend sample. Everything here is sample data.

## Requirements

- Hard: home by Sunday evening; one night only (see decision `one-night`).
- Preferences: slow mornings; seafood; one "proper" activity per day.
- Open: whether a later Sunday train runs (fact `late-sunday-train`, to verify).

## Design

Direction A, a single-page timeline per day, was chosen over direction B, a map-led layout with neighbourhoods as navigation (decision `timeline-layout`). Reason: two days with few places don't need a map to navigate, and a timeline makes the fixed items easy to spot.

Adopted recommended principles: fixed items separate from flexible ones; one main activity per day; places stored once with the days that pass them; to-dos by owner and deadline; the way back to the guesthouse on every day page.

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
