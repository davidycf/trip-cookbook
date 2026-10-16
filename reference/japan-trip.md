# Reference: a family trip site

This is a design guide to one real trip site: a multi-city family trip in Japan with young children, built with coding agents over several weeks of planning. It is here to show **decisions and their reasons**, not a template. Your site may differ in visuals, navigation, data model, language and framework, and that is a success, not a deviation.

The site predates this Cookbook, so it doesn't use `ledger.json` or the checker. Where it solved a problem the Cookbook now addresses, this guide says so.

**About the screenshots.** Each screenshot below is marked *pending approval* until it has been reviewed and added; until then the caption describes it. They were taken at 390px wide from a local copy of the site, with personal details replaced in the rendered page: hotel names appear as 〔酒店〕, dates as •/•, family roles as 大人 (adult) and 孩子 (child), and the home city as 〔出发地〕. The interface is in Chinese with Japanese place names, because that's what the family reads.

## The brief, in short

- A two-week trip across three cities, with young children who don't nap and go to bed early.
- Designed to be used mainly on phones, on and off roaming data.
- Plans would change on the trip: weather, energy, a lottery result for one sought-after venue.
- Some things were booked and must not move; most activities were flexible.
- The family wanted to try alternatives themselves on their phones, without asking the agent each time.

## Design language: the trip as a railway line

The whole site uses one metaphor: the trip is a train line and each day is a station. The trip moves between cities by train, and the metaphor fits naturally: stations are ordered, have neighbours, and belong to lines with colours.

- Each city has a line colour, used for its route segment, its day markers and its station signs.
- Each day page opens with a station sign (駅名標): the place name in large type, the romanized name below, and the previous and next stations on either side. These are the page's previous/next navigation.
- Navigation uses single characters as badges (程 trip, 宿 stay, 食 eat, 买 buy, 观 see, 要 appendix), echoing station-sign typography.

**Takeaway:** pick one metaphor that means something to your travellers, and let it carry navigation, not just decoration. A road trip might use mile markers, a hiking trip trail blazes.

> **Screenshot pending approval** (`img/01-overview.png`): Overview: header, countdown, next to-dos and the route line in city colours.

*Overview. The route line shows the cities in their colours with nights per stop. "接下来" (next up) lists the nearest to-dos by deadline. The badge "正在保存离线版本" means the offline copy is being saved.*

## Information architecture

Six sections, reachable from a fixed bottom bar:

| Section | Holds |
| --- | --- |
| 程 Trip | The itinerary, one "station" per day, and the activity library |
| 宿 Stay | Places near each hotel, in rings by walking distance |
| 食 Eat / 买 Buy / 观 See | Candidate places by neighbourhood ("stations"), each with the days that pass nearby |
| 要 Appendix | To-dos, booking and ticket notes, children and daily-life notes, an emergency card |

Every day has a permanent address (`#d1` to `#d15`) that never changes when activities move.

> **Screenshot pending approval** (`img/02-itinerary.png`): Itinerary list grouped by city, one line per day.

*Itinerary list. Each day is a station on its city's line, with one title line. Fixed travel days and flexible activity days share the same list.*

## Two kinds of day

Days split into **fixed days** (arrival, intercity moves, departure) and **activity days**:

- A **date** owns its fixed items: trains, check-ins, a reserved lunch, packing the night before a move. These never move.
- An **activity card** owns the flexible content: route, food nearby, optional branches, preparation. Each activity day has one main card.
- Swapping the card changes only that day. If the card is already on another day, the page asks whether to swap the two days or move it and leave the other day free. Every swap has one-step undo.

Cards can't assume their date, so a card never says "this is your first day". Weekdays and closures are worked out from the actual date the card lands on.

This is principles [6](../cookbook/principles.md#6-keep-fixed-items-separate-from-adjustable-activities), [8](../cookbook/principles.md#8-keep-the-recommended-plan-separate-from-the-users-own-choices) and [9](../cookbook/principles.md#9-one-main-activity-per-day-make-the-load-visible) working together.

> **Screenshot pending approval** (`img/03-day-top.png`): Top of a day page: station sign, title, context note and plan controls.

*Day page. The station sign links to the neighbouring days. Below the title, a context note ("still jet-lagged: main item in the morning, rest at the hotel after lunch if needed") applies to the date, whatever card is on it. The buttons are 推荐方案 (recommended plan), 卡片详情 (card details) and 换活动 (swap activity).*

## The day page

Planning and the trip itself use the same page; it doesn't switch modes. From top to bottom:

1. Station sign, title, summary and the date's context note.
2. Plan controls: recommended plan or the traveller's choice, card details, swap.
3. Hints and warnings.
4. Optional branches, collapsed into one line ("branches · selected: …").
5. Tickets, for activities that need one.
6. Today's route, grouped into morning, midday, afternoon and evening.
7. Eat, buy and see nearby, each linking to the full neighbourhood list.
8. Tonight's hotel, with a "back to hotel" directions link.
9. Preparation for this day; finished items fold away.
10. Items still to verify.
11. More nearby, then previous and next day.

In the route, **fixed steps carry a filled marker and the label 固定 (fixed)**, card steps are filled without the label, and optional branch steps appear hollow, labelled 支线 (branch).

> **Screenshot pending approval** (`img/04-day-route.png`): Route for a moving day, with fixed items labelled.

*Today's route on a moving day. The train, the luggage drop at the hotel and lunch are fixed (固定); lunch names a fallback if the queue is too long. The afternoon comes from the card. Train times carry a note that next year's timetable isn't published yet, with a link to the appendix.*

> **Screenshot pending approval** (`img/05-swap.png`): Swap panel with recommended alternatives.

*Swap panel. It says up front that only this day changes and that fixed items stay ("只改这一天；日期固定的事不动"). Recommended alternatives come first, then the rest of the library behind "更多活动". Options that can't work on this date are disabled with the reason shown.*

## Warnings, not reshuffles

The site never rearranges other days to make a change fit ([principle 7](../cookbook/principles.md#7-separate-hard-and-soft-constraints-warn-rather-than-silently-reshuffle)). It uses three levels:

- **Infeasible:** wrong city, a moving day, or a weekly closed day. The button is disabled and says why.
- **To verify:** a calendar not yet published, or a ticket registered for a different date. Shown as a warning; nothing is blocked.
- **Hint:** two activities that cover the same thing, a long transfer, a late return on a day with a fixed evening item, or a day getting heavy. Shown with a one-tap "remove this one".

## Candidate libraries

Activities live in a **card library**, separate from the itinerary ([principle 10](../cookbook/principles.md#10-keep-candidate-lists-separate-from-the-itinerary-store-each-place-once)). Each card shows whether it's scheduled and on which day, and can be searched in Chinese, Japanese or by content. Cards for a city the family dropped stay in the library, labelled as backup, and are never scheduled automatically ([principle 3](../cookbook/principles.md#3-rejected-options-are-never-added-back-automatically)).

Restaurants, shops and sights live in neighbourhood lists, each place stored once. Day pages link to the neighbourhoods on their route, and each neighbourhood page shows which days pass nearby.

> **Screenshot pending approval** (`img/06-cards.png`): Activity card library with search, filters and scheduling status.

*Activity library. Each card has a station-sign label for its area, a summary, length, travel distance and status: 已安排 (scheduled, with the day) or 未安排 (not scheduled).*

## Scenario presets with preview and undo

One sought-after venue was sold by lottery, with the result due weeks before the trip. Instead of rewriting the plan by hand after the result, the site has a scenario page: pick the lottery outcome, preview what changes across the four affected days, and apply in one step, with undo. Fixed items, such as sending luggage ahead on one of those mornings, never move. The venue stays marked as a simulated plan until the traveller registers an actual ticket, and the page never claims a ticket exists.

> **Screenshot pending approval** (`img/07-museum.png`): Scenario preset: lottery outcome, preview of affected days.

*Scenario page. The current state is "not won; any museum day is simulated". The preview shows each affected day and whether it changes; one day carries a 待核对 (to verify) label because the venue's opening calendar for that year isn't published.*

## To-dos with deadlines

To-dos carry a deadline or a "from" date, and the home page shows the next ones ([principle 13](../cookbook/principles.md#13-organize-to-dos-by-owner-and-deadline)). Tasks that belong to an activity appear only while that activity is in the plan. Ticket-sale times are given in both the destination's and the home time zone, because a 10:00 sale abroad is the previous evening at home.

Checklist state is stored on the device by stable to-do ID. An earlier version stored it by list position, which meant to-dos could never be inserted or reordered without moving checkmarks onto the wrong items. The site moved to stable IDs, with a one-time notice asking the traveller to recheck ([principle 12](../cookbook/principles.md#12-stable-links-and-ids-changes-can-be-undone-easily)).

> **Screenshot pending approval** (`img/08-todo.png`): Appendix: to-dos awaiting confirmation, with deadlines.

*Appendix index. Section chips across the top stay pinned and follow the reading position. "尚待确认" (awaiting confirmation) lists open to-dos, each with a deadline and a link to details.*

## On the trip

- During the trip, the current day's sign shows TODAY.
- Every day page ends its stay section with tonight's hotel and "回酒店 ↗" (back to hotel), which opens public-transit directions to the hotel's official public address. That link needs a connection, which the page signals only with the ↗ mark. Offline, the hotel's name stays on the day page and its address is on the cached emergency card. A site built from this Cookbook should go further: keep short return instructions on the page itself and label live directions as needing a connection ([principle 15](../cookbook/principles.md#15-make-on-trip-essentials-a-tap-away-today-hotel-return-and-emergency-information)).
- An emergency card in the appendix lists emergency numbers and each hotel's public address in Japanese, to show a taxi driver.
- Items still unconfirmed sit in a highlighted 待确认 (to confirm) block on the day they affect.

> **Screenshot pending approval** (`img/09-stay.png`): Stay section with the back-to-hotel directions link, an item to confirm, and nearby lists.

*End of a day page. Tonight's hotel with the back-to-hotel directions link (online only), a 待确认 note that depends on a calendar not yet published, and nearby neighbourhood lists with counts.*

## Offline

The site is static: one HTML file, one script and five JSON data files, with no build step. A service worker makes it work offline ([principle 5](../cookbook/principles.md#5-works-on-a-phone-and-offline-after-the-documented-preparation)):

- Network first with a four-second timeout, falling back to the saved copy.
- The page, script and data files are saved **as one set per release**. If the network returns a mix of new and old files (for example new day data referring to an activity that only exists in the new card data), the page uses the complete saved set instead.
- A banner says when the page is showing the offline version and when it was saved.

## Privacy choices

The site is public, so it was designed to need no secrets ([principle 4](../cookbook/principles.md#4-keep-prohibited-private-data-out-of-deployment-output-and-git-publish-personal-trip-details-only-within-approved-scope)):

- Travellers appear by role, never by name.
- Booking numbers, prices, payment and cancellation terms never appear; hotels appear by their official name and public address only.
- On-device choices can be exported and imported as a small file that contains no documents, booking numbers or checklist state.

## Lessons worth reusing

- **Dates own fixed items; cards own activities.** Because cards move, the site's rules forbid card text that assumes a date and date text that describes an activity.
- **Keep recommendations and the traveller's choices apart.** When the recommended plan changes, the page lists which days changed and keeps the traveller's own choices.
- **Stable IDs everywhere, with alias maps** for renamed or merged cards and appendix entries, and redirects for moved pages, so old links keep working.
- **Save offline files as a set.** Mixing two releases offline can produce pages that refer to data that isn't there.
- **Warn, don't reshuffle.** Overlaps and conflicts only produce hints, with a one-tap fix the traveller chooses; there is no hidden rearrangement, so the plan never changes behind the family's back.
