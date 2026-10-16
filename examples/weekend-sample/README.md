# Weekend sample

A small, complete site built the Cookbook way: two friends, one night in **Port Alder**, a fictional coastal town. Every name, address, booking and source here is sample data; sources point at `example.org`, which is reserved for examples.

Use it to see the contracts in action, or as a starting point. It deliberately looks and works nothing like the reference site in `reference/`: one English timeline per day with top navigation, instead of station signs, a bottom tab bar and an activity-card library.

## What it shows

| Contract | Where |
| --- | --- |
| Ledger as the single source | `ledger.json`, copied to `site/ledger.json` by the build step; `site/app.js` renders bookings, facts and decisions from it |
| Page annotations | `data-ledger` on every ledger item shown; `data-day` on each day's timeline |
| Fixed items recognizable | Solid markers and "Booked" badges; tentative items dashed; flexible items labelled |
| Uncertainty labels | Sourced facts link to their source with the check date; estimates and items to verify are labelled |
| Route list | `evals/routes.txt`: the overview, both days, places, preparation and help |
| Offline | `site/sw.js` follows `cookbook/build.md`: precached files, a prefixed cache, waiting updates with an "Update" button, and a status line marked `data-offline-volatile` |
| On-trip essentials | Each day ends with the way back to the guesthouse, saved on the page; live directions are labelled as needing a connection |

## Build and check

There is no build tool; copying the ledger is the build step. From the repository root:

```sh
cp examples/weekend-sample/ledger.json examples/weekend-sample/site/ledger.json
node evals/check.mjs --root examples/weekend-sample --site examples/weekend-sample/site --base initial
```

All required automated checks pass. E5 is skipped because the sample isn't deployed, and the report still lists the rubric items and the third-column items for review, as it would for a real site. The two approved decisions appear there as "added as approved": with `--base initial` the checker always lists them for review.

`NOTES.md` is the sample's build record, in the format `cookbook/build.md` asks for.
