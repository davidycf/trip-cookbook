# Principles

These fifteen principles come from building a real family trip site and planning a trip with it; [reference/japan-trip.md](../reference/japan-trip.md) shows how that site applied them. Read them before the interview, and come back to them while designing.

- **Required** principles back the Cookbook's safety, usability and privacy contracts. Every site must satisfy them, and the checker or the rubric tests them.
- **Recommended** principles are design advice. Discuss the relevant ones with the user during design; they are not mandatory features. A site can serve its travellers well while skipping several of them.

Each principle gives a rule, why it matters, two ways to implement it and one counter-example. The two approaches are examples, not a menu: choose whatever fits the site you are building.

| # | Principle | Level |
| --- | --- | --- |
| 1 | [Never move what is booked without authorization; warn instead](#1-never-move-what-is-booked-without-authorization-warn-instead) | Required |
| 2 | [High-impact facts carry a source and check date; estimates and unconfirmed claims are marked](#2-high-impact-facts-carry-a-source-and-check-date-estimates-and-unconfirmed-claims-are-marked) | Required |
| 3 | [Rejected options are never added back automatically](#3-rejected-options-are-never-added-back-automatically) | Required |
| 4 | [Keep prohibited private data out of deployment output and Git; publish personal trip details only within approved scope](#4-keep-prohibited-private-data-out-of-deployment-output-and-git-publish-personal-trip-details-only-within-approved-scope) | Required |
| 5 | [Works on a phone and offline after the documented preparation](#5-works-on-a-phone-and-offline-after-the-documented-preparation) | Required |
| 6 | [Keep fixed items separate from adjustable activities](#6-keep-fixed-items-separate-from-adjustable-activities) | Recommended; recognizing fixed items is a required rubric check |
| 7 | [Separate hard and soft constraints; warn rather than silently reshuffle](#7-separate-hard-and-soft-constraints-warn-rather-than-silently-reshuffle) | Recommended |
| 8 | [Keep the recommended plan separate from the user's own choices](#8-keep-the-recommended-plan-separate-from-the-users-own-choices) | Recommended |
| 9 | [One main activity per day; make the load visible](#9-one-main-activity-per-day-make-the-load-visible) | Recommended |
| 10 | [Keep candidate lists separate from the itinerary; store each place once](#10-keep-candidate-lists-separate-from-the-itinerary-store-each-place-once) | Recommended |
| 11 | [Pages show the current plan; history lives elsewhere](#11-pages-show-the-current-plan-history-lives-elsewhere) | Recommended |
| 12 | [Stable links and IDs; changes can be undone easily](#12-stable-links-and-ids-changes-can-be-undone-easily) | Recommended |
| 13 | [Organize to-dos by owner and deadline](#13-organize-to-dos-by-owner-and-deadline) | Recommended |
| 14 | [Turn traveller needs into scheduling rules, such as sleep and solo side trips](#14-turn-traveller-needs-into-scheduling-rules-such-as-sleep-and-solo-side-trips) | Recommended |
| 15 | [Make on-trip essentials a tap away: today, hotel return and emergency information](#15-make-on-trip-essentials-a-tap-away-today-hotel-return-and-emergency-information) | Recommended |

## Required

### 1. Never move what is booked without authorization; warn instead

**Rule.** Confirmed bookings, and promises the user has made, change only with the user's authorization. When a requested change conflicts with one, explain the conflict and ask; don't resolve it yourself.

**Why it matters.** Bookings carry money, cancellation deadlines and other people's arrangements. A helpful-looking rearrangement can quietly put a non-refundable ticket on the wrong day, and on the trip the traveller trusts the page over their memory.

**Two ways to implement it.**

1. Record bookings as confirmed commitments in `ledger.json` and render their details from it. When the user asks for a change that touches one, the checker lists it as a protected change, and you get consent before applying it.
2. In an interactive site where travellers rearrange activities themselves, make fixed items immovable: swapping an activity never carries a booking along with it. A swap that would separate a ticket from its date asks for confirmation and says plainly that the page does not change the real booking.

**Counter-example.** The user asks to "move the aquarium to Thursday". The agent moves the aquarium day, timed-entry ticket and all, to Thursday. The ticket is for Tuesday and non-refundable, and the page now shows the wrong date with full confidence.

### 2. High-impact facts carry a source and check date; estimates and unconfirmed claims are marked

**Rule.** A claim whose failure could cause a missed booking, a wasted day, refused entry or a safety problem carries a source and the date it was checked. Estimates and unverified claims are labelled as such on the page.

**Why it matters.** Closed days, ticket-sale openings, entry rules and timetables change, and model knowledge goes stale. Travellers can't tell confident prose from a checked fact unless the page shows the difference.

**Two ways to implement it.**

1. Record the claim as a `sourced` fact in the ledger, with `source` and `checked`. Render a small "checked <date>" link beside it on the page.
2. Use visible inline labels: "estimate" on travel times, "to verify" on anything that depends on a calendar or timetable not yet published. Add a matching to-do with the date when it can be verified.

**Counter-example.** A day page states "Train departs 9:03" for a date after the operator's annual timetable change, with no source and no note that next year's timetable isn't published yet.

### 3. Rejected options are never added back automatically

**Rule.** Once the user rejects an option, it stays out of the plan. A `revisit_if` condition lets you raise it again; it does not let you restore it.

**Why it matters.** A rejection usually encodes a reason the user gave once, such as cost, energy or the children's needs. Re-adding the option makes it look as if nobody was listening, and can undo arrangements made around the rejection.

**Two ways to implement it.**

1. Record the decision in the ledger with `rejected` and `revisit_if`. Read decisions before every edit, and check proposals against them.
2. Keep rejected material available but clearly parked: for example, activity cards kept in a library and labelled "not in the plan", never scheduled automatically and never suggested as a default.

**Counter-example.** The user dropped two nights in the mountains to cut travel. Weeks later they ask for "something relaxing mid-trip", and the agent adds the mountain stay back because it fits the request.

### 4. Keep prohibited private data out of deployment output and Git; publish personal trip details only within approved scope

**Rule.** Booking numbers, confirmation codes, identity and payment details and credentials never enter Git (public or private) or the deployed site. Personal trip details, such as names, ages, home city, dates and hotels, are published only within the scope the user approved.

**Why it matters.** Repositories and sites get copied and cached, and Git history keeps everything. A booking code is often all someone needs to change or cancel a booking.

**Two ways to implement it.**

1. Create `.gitignore` with `private/` before any private material arrives. Keep booking details in `private/`, list sensitive terms in `private/sensitive.txt`, and let the checker's privacy scan cover the repository, its history and the rendered pages.
2. Design the page so it never needs secrets: refer to "the confirmation in your email" rather than showing a code, and use role names ("Parent", "Older child") if the user prefers not to publish names.

**Counter-example.** The agent hides a confirmation code with `display: none`. It no longer shows on screen, but it is still in the HTML, the service-worker cache and the Git history.

### 5. Works on a phone and offline after the documented preparation

**Rule.** Every listed view works on a 390px-wide phone screen, and keeps working offline after the traveller follows the documented preparation step.

**Why it matters.** On the trip the site is used on a phone, often on weak roaming data, underground or in a crowded station. A site that needs a good connection fails exactly when it is needed.

**Two ways to implement it.**

1. For a small site, precache every file at service-worker install and serve from the cache first. Simple and robust; updates arrive on the next visit.
2. For a site that changes often, fetch from the network first with a short timeout and fall back to the cache. Save each release as a complete set, so offline pages never mix files from two releases, and show an "offline version saved at …" banner.

**Counter-example.** A layout designed on a laptop, with a wide table that scrolls sideways on a phone. Or day pages that fetch opening hours from a third-party API at view time, and go blank in an underground station.

## Recommended

### 6. Keep fixed items separate from adjustable activities

*Recommended. Recognizing fixed items at a glance is a required rubric check.*

**Rule.** Travellers can tell immediately which items can't move (trains, check-ins, reserved meals) and which are flexible.

**Why it matters.** On the day, plans bend. People need to know what they can drop without consequence, and what they must not miss.

**Two ways to implement it.**

1. Mark fixed steps visually: a filled marker and a "fixed" label in the day's route, with flexible steps drawn differently.
2. Split the data: dates own their fixed items, and activities are separate content assigned to a date. Swapping an activity never touches the date's fixed items.

**Counter-example.** A single bulleted list where "Shinkansen 9:03, reserved seats" and "maybe a café near the station" look identical.

### 7. Separate hard and soft constraints; warn rather than silently reshuffle

**Rule.** Distinguish what is impossible (a weekly closed day) from what is merely unwise (a long transfer, a late return). Warn about both, and never rearrange other days to make a change fit.

**Why it matters.** Treating every constraint as hard blocks reasonable choices; treating every constraint as soft allows impossible ones. Silent reshuffles destroy trust, because the user can no longer predict the plan.

**Two ways to implement it.**

1. Use three levels in the interface: infeasible (the option is disabled and the reason shown), to verify (a warning that doesn't block), and hints (overlaps, long transit, late return).
2. When editing on the user's behalf, keep the hard constraints in a list, check every change against them, and report conflicts with their consequences instead of fixing them elsewhere.

**Counter-example.** The user swaps two days. To keep a museum off its closed day, the page quietly moves three other days, and nobody notices until the trip.

### 8. Keep the recommended plan separate from the user's own choices

**Rule.** The plan you recommend and the choices the user makes are stored separately, and neither silently overwrites the other.

**Why it matters.** Users want to try alternatives without losing the recommendation, and your later updates shouldn't wipe out choices they made on their phone.

**Two ways to implement it.**

1. Keep the recommended plan in the repository's data, and store the user's choices on the device, with "restore recommended" and export/import. When the recommendation changes, tell the user which days changed and keep their own choices.
2. For a site without on-device editing, keep the user's overrides as a separate, labelled layer in the data that you apply on top of the recommendation, and record it in `NOTES.md`.

**Counter-example.** The user picks a different activity on their phone, and the next deploy silently resets it. Or the agent bakes one traveller's phone choice into the shared recommendation without asking.

### 9. One main activity per day; make the load visible

**Rule.** Each day has one main activity. Extras are optional, and the page shows when a day is getting heavy.

**Why it matters.** Travel days are longer and more tiring than they look on paper, especially with children or jet lag. One anchor per day leaves slack for weather, queues and tired legs.

**Two ways to implement it.**

1. Give each day one main activity, with extras as optional branches that are off by default. Show a load warning when extras, long transit or early fixed items add up.
2. Show an energy rating (light, medium or heavy) and a transit estimate in each day's header.

**Counter-example.** A day with an aquarium, a castle, a shopping street and a late dinner across town, all listed as equally essential.

### 10. Keep candidate lists separate from the itinerary; store each place once

**Rule.** Restaurants, shops and sights worth considering live in their own lists. Days refer to them; they don't copy them.

**Why it matters.** Candidate lists grow large and would bury the daily plan. Copies drift: the closing day gets fixed in one place and stays wrong in another.

**Two ways to implement it.**

1. Build a place library grouped by neighbourhood, with stable IDs, and have each day link to the places on its route. Each place page can show which days pass nearby.
2. Build an activity library where each activity shows whether it is scheduled and on which day, and can be scheduled from there.

**Counter-example.** The same restaurant typed out on three day pages, which after a few edits show three different closing days.

### 11. Pages show the current plan; history lives elsewhere

**Rule.** Pages show what is true now. Earlier versions, struck-through plans and change narratives belong in Git, the ledger's decisions and notes.

**Why it matters.** On the day, travellers need the current plan, not its history. Old plans left on the page get read as current.

**Two ways to implement it.**

1. Let Git history and ledger decisions (with rejected options) carry the history, and render only the current plan.
2. Show a short "changed since your last visit" notice listing what changed, which disappears once acknowledged.

**Counter-example.** A day page that still reads "~~Two nights in the mountains~~ → coast instead (changed last week)".

### 12. Stable links and IDs; changes can be undone easily

**Rule.** Days, activities, places and to-dos have IDs that never change. Changes travellers make on the page can be undone in one step.

**Why it matters.** Travellers bookmark and share links. On-device state, such as checked to-dos, breaks if it is keyed to positions that move. One-step undo makes it safe to try things.

**Two ways to implement it.**

1. Give everything a permanent ID (for example `#d4` always means day 4), and keep an alias map and redirects when something is renamed, merged or moved.
2. Offer one-step undo after every on-device change, and confirm before anything that affects a booking.

**Counter-example.** Checklist state stored by list position. A new to-do inserted at the top shifts every checkmark onto the wrong item.

### 13. Organize to-dos by owner and deadline

**Rule.** Every pre-trip task has a deadline, or the date it becomes possible, in a stated time zone, plus an owner when it isn't the whole group.

**Why it matters.** Many tasks have hard windows: ticket sales that open at a set hour abroad, lotteries that close, free-cancellation deadlines. A "someday" list misses them.

**Two ways to implement it.**

1. Give to-dos `due` and `from` dates, sort them, and show the next few on the home page.
2. Attach each to-do to the day or activity it serves, so it appears only while that activity is in the plan, and label solo tasks with their owner.

**Counter-example.** A flat list item "Book train tickets", with no note that sales open at 10:00 local time one month ahead, which is the previous evening in the traveller's home time zone. It's discovered after the good seats are gone.

### 14. Turn traveller needs into scheduling rules, such as sleep and solo side trips

**Rule.** Needs that shape every day, such as bedtimes, jet-lag naps, mobility or one traveller's solo outing, become explicit rules that the plan follows and the site can check.

**Why it matters.** Remembered case by case, these needs get forgotten on some day. As rules, they make the plan consistent and give warnings something to check against.

**Two ways to implement it.**

1. Add day context notes ("first days: main activity in the morning, afternoon free for a nap") and time-of-day bands, and keep dinner times within the travellers' bedtime.
2. Label solo side trips with their owner, exclude them from the family's load, and warn when an activity returns late on a day with a fixed evening item.

**Counter-example.** Every day ends with a dinner across town at 20:00, for a family whose children are asleep by 21:00.

### 15. Make on-trip essentials a tap away: today, hotel return and emergency information

**Rule.** During the trip, three things are one tap from anywhere: today's plan, the way back to tonight's hotel, and emergency information. All three work offline.

**Why it matters.** In the moment, travellers don't need the planning views. They need where to be next, how to get back, and what to do if something goes wrong.

**Two ways to implement it.**

1. During the trip, open the home page on today, and end each day page with a "back to hotel" button that opens transit directions to the hotel's public address.
2. Add an offline emergency card: local emergency numbers, each hotel's name and public address in the local language, and where to find insurance and embassy contacts.

**Counter-example.** The hotel's address exists only in a booking email, which won't load in a taxi with no signal.
