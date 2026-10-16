# Design

**When to read:** after the interview and enough research to plan, in New site mode or for a requested redesign.
**What you produce:** at least two structurally different design directions with trade-offs; the user's choice, recorded as an approved decision; a design rationale in `NOTES.md`.

You are designing a tool the travellers will hold in one hand on a crowded platform, not a brochure. Start from what they will need on the trip, then work back to planning.

## Start from on-trip priorities

Before sketching anything, answer these for this trip:

1. **What will they look at most during the trip?** Usually today's plan, the next fixed item, and the way back to the hotel.
2. **What must never be missed?** Fixed items: trains, check-ins, reservations, ticket times.
3. **What will change on the trip,** and who changes it: weather swaps, tired afternoons, a lottery result?
4. **Who reads it,** in which language, on which phones, and with what data?
5. **What is the plan's real shape?** A city base with day trips, a moving line of stops, a road loop, a festival week?

The answers decide the structure. Visual style comes after.

## Propose at least two directions

Offer at least two directions that differ in **structure**, not just colour, unless the user has already chosen one. For each, give:

- **The organizing idea,** in one sentence ("one screen per day, swipe between days").
- **Navigation:** what's on the home screen and how you reach today, a day, a place, a to-do.
- **How it handles change:** what the travellers can adjust on the phone, and what needs you.
- **Trade-offs:** what it's good at, what it's worse at, and the build cost.
- **A visual note:** typography, colour and one motif. A rough sketch or a short mock of the home and day screens helps.

Example pairs of structurally different directions:

| Direction A | Direction B |
| --- | --- |
| Timeline: one scrolling page per day, fixed items pinned at their times | Map-led: neighbourhoods as the main navigation, days as routes through them |
| Static plan: the agent maintains the itinerary; the site only reads | Interactive plan: travellers swap activities on their phones within rules |
| Single page with sections and in-page links | Multi-view app with a bottom bar and per-day pages |

Keep the directions honest: don't present a strawman to make your favourite look good. Then recommend one, with your reason.

When the user chooses, record it as an approved decision in `ledger.json` (with the rejected direction in `rejected`), and the rationale in `NOTES.md`. Later sessions read both before changing the design.

## Use the reference without copying it

[`reference/japan-trip.md`](../reference/japan-trip.md) shows one site's decisions and reasons. Borrow reasons, not looks: a railway-sign metaphor fit that trip and that family. A site that looks nothing like it but serves its travellers equally well is the goal.

Discuss the recommended principles in [`principles.md`](principles.md) that matter for this trip, such as one main activity per day, candidate lists or scheduling rules, and agree which to adopt. They are design advice, not required features.

## Phone first

Design at 390px wide first; the checker tests there, and it's what the travellers will use.

- **No sideways scrolling of the page.** Wide content (tables, timetables) wraps, stacks, or scrolls inside its own container.
- **Tap targets** at least 44px, with space between them.
- **Readable type:** body text at least 16px, with real contrast. Check pages in bright light and in the dark; a dark theme helps at night.
- **One-handed reach:** primary navigation near the bottom of the screen, or a short top bar.
- **Fast first screen:** today's essentials should be visible without scrolling on a typical phone.
- **Long words and place names** in the destination's script must wrap or fit, not overflow.

## Offline first

Every view in the route list must work offline after the documented preparation (see `build.md`). Design for it from the start:

- Keep trip content in files the site serves itself. Don't fetch essentials from third-party services at view time.
- Show **network-only features** (live maps, live availability, embedded videos) as such: label them "needs a connection", and never make them the only way to reach essential information.
- Show the offline state honestly: a small banner saying the page is the saved version, and when it was saved, is better than silence.
- Mark content that legitimately differs offline, such as that banner or an "unavailable offline" note, with `data-offline-volatile` so the checker's offline comparison ignores it.

## Make fixed items recognizable

Whatever the design, travellers must be able to recognize booked and fixed items at a glance; the rubric checks it. Common ways: a distinct marker, a "fixed" or "booked" label, a time pinned on the left, or a separate band at the top of the day.

## Plan the routes early

The checker visits the routes listed in `evals/routes.txt`, and only those. Design so that every view the travellers need has its own route: an entry page, per-day pages or hash routes, and the other views you build. A view reachable only by tapping through without its own route can't be checked directly.

## Before you build

Confirm with the user:

- The chosen direction, and which recommended principles you'll adopt.
- The site language.
- The host and repository visibility (see `build.md` and `privacy.md`).
- What will be public: names or roles, children's ages, home city, dates, hotel names. The visibility review before first publication will confirm this again with the actual content.
