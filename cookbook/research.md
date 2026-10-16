# Research

**When to read:** before planning a new site, and whenever a change introduces or affects a fact.
**What you produce:** sourced, dated facts in `ledger.json` for anything high-impact; clearly labelled estimates and suggestions on the page.

Research serves the plan. Its job is to stop the trip from failing on something knowable: a closed day, a sale that opened last week, an entry rule, a train that doesn't run that season. It is not a survey of everything a destination offers.

## What counts as high-impact

Ask: **if this were wrong, would it cost something real?** A missed booking, a wasted day, refused entry or a safety problem.

High-impact, usually:

- Weekly closed days and seasonal closures of anything the plan depends on.
- When tickets go on sale, lotteries open or close, and how far ahead reservations open, with the time zone.
- Entry requirements: visas or travel authorizations, passport validity, child policies at hotels and venues.
- Transit assumptions that connect to bookings: the last train back, a ferry that runs only on weekends, a timetable change before the trip.
- Safety-relevant facts: road closures in season, weather restrictions, medical access for a traveller's condition.

Usually not high-impact, unless this plan makes it so: ordinary opening hours, restaurant suggestions, general sightseeing descriptions. Make a fact high-impact when the plan leans on it, for example the only dinner option near the hotel on a late-arrival day.

## Source priority

Prefer, in this order:

1. **The operator itself:** the venue, airline, railway, hotel or ticketing site, in the local language if it's more current than the translated version.
2. **Government or official tourism bodies** for entry rules, holidays and safety.
3. **Established secondary sources** (major guides, reputable news) for context, and to find the primary source.
4. **Recent first-hand reports** (forums, reviews) only for practical detail the operator doesn't publish, such as how long a queue really is. Label these as reports, not facts.

Your own memory is not a source. Use it to know where to look, and then look.

## Cross-checking and conflicts

- Check a high-impact fact against a second source when you can, especially one that changes yearly.
- **When sources conflict,** prefer the operator, and the more recent and more specific page. If the conflict still matters, record the fact as `unverified`, say on the page what's uncertain, and add a to-do to confirm (for example by contacting the venue).
- **When the information isn't published yet** (next year's timetable, a holiday calendar), say so. Record the plan as an `estimate` with its `basis`, and add a to-do with the date when it can be checked.
- If research shows that an assumption under an accepted plan is wrong, explain the consequence to the user before changing anything settled.

## Recording facts

High-impact facts go into `ledger.json`:

| Status | Use when | Required fields |
| --- | --- | --- |
| `sourced` | You read the source and it supports the claim | `source` (absolute http(s) URL), `checked` (the date you read it) |
| `estimate` | Reasoned from something, not stated anywhere | `basis` (what you reasoned from) |
| `unverified` | You couldn't confirm it, or sources conflict | None, but say on the page what's uncertain |

```json
{
  "id": "museum-closed-tue",
  "claim": "The museum is closed on Tuesdays.",
  "status": "sourced",
  "source": "https://example.org/visit",
  "checked": "2026-10-05"
}
```

`checked` records when you inspected the source. It doesn't prove the fact is still true. Before publishing an update close to the trip, re-check facts that change often.

## Keeping things distinct on the page

Readers must be able to tell these apart:

- **Facts** you sourced: show them plainly, and ideally a "checked" link.
- **Estimates:** travel times, queue lengths, costs. Label them ("about 25 min, estimate").
- **Suggestions:** your recommendations, as recommendations.
- **Unconfirmed items:** labelled "to verify", with what is uncertain.

## Avoiding research drift

- Research what the plan needs, in the order the plan needs it: bookings and fixed items first, then main activities, then nice-to-haves.
- Don't research options the user has rejected, unless their `revisit_if` condition has happened, and then only to raise the question.
- Time-box candidate lists (restaurants, shops). A handful of good options per area beats an exhaustive list.
- When you find something interesting but out of scope, note it in `NOTES.md` as an idea instead of adding it to the plan.

## Checking sources with the checker

`node evals/check.mjs ... --fetch-sources` checks that each `sourced` URL is reachable now. A failure means the page didn't load, not that the claim is false. A success means the page loaded, not that it supports the claim; that judgment is yours, in the rubric.

Some official sites refuse automated requests or answer very slowly, so reachability can fail for a source that's fine. Don't swap in a weaker source to make the check pass: read the page in a browser, keep the official source, and say in the report which sources failed the fetch and why.
