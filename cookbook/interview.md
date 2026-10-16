# Interview

**When to read:** at the start of a new site, and whenever a change has a material ambiguity only the user can resolve.
**What you produce:** a short statement of understood requirements; public-safe notes in `NOTES.md`; first entries in `ledger.json`; private details in `private/`.

The interview exists to fill gaps, not to collect a form. If the user's first message already tells you enough to plan, say what you understood and move on. Never invent questions to look thorough, and never invent answers to avoid asking.

## How to ask

- **At most three questions per round.** Pick the ones whose answers change the plan most. Everything else can wait, or be an assumption you state and the user can correct.
- **Ask concretely.** "Do the children still nap after lunch?" beats "Tell me about your children's needs."
- **Offer a default with the question** when one is reasonable: "I'll assume you'd rather not drive after dark unless you tell me otherwise."
- **Say why you're asking** when it isn't obvious: "I'm asking because two of these museums close on Mondays."
- **Stop when you have enough.** A round ends with either your next questions or a statement of understood requirements, never both piled together.

## What you need to know

Not every trip needs all of this. Work out which gaps matter for this trip.

| Topic | Examples of what matters |
| --- | --- |
| Travellers | How many; ages of children; mobility, health or dietary needs; who reads which language |
| Dates and shape | Fixed dates; cities or stops; nights in each; how they travel between them |
| Bookings so far | What is booked, what is held, what is only an idea (see below) |
| Energy and rhythm | Bedtimes, naps, jet lag, how much walking is fine, how early they can start |
| Interests | What the trip is for; what each traveller wants; what to skip |
| Hard limits | Budget lines, things they won't do, things already rejected and why |
| On-trip use | Who uses the site, on which phones, with what data plan; language of the site |
| Visibility and hosting | Public or private repository; host accounts they already have; who should see the site |

## Bookings and private details

Ask what is booked, but take only what the plan needs: the date, time, place and status of each booking. Booking numbers, confirmation codes, passport and payment details are never needed for the site.

- If the user pastes a confirmation email, extract the public-safe facts into a ledger commitment, and keep anything else in `private/` (for example `private/bookings.md`). Use an opaque `private_ref` such as `bookings#flight-out` to point at it.
- A booking becomes `confirmed` only on evidence from the user (a confirmation, or their clear statement). Anything held, planned or "probably" is `tentative`.
- Recording a booking never means you may buy, change or cancel one. You don't take booking actions.

## Recording what you learn

Keep three things separate, and say which is which:

- **Hard requirements:** must hold for the plan to work ("back at the hotel by 20:00", "no driving on the mountain road in snow").
- **Preferences:** shape choices but can bend ("prefers quiet neighbourhoods").
- **Open items:** not yet known or decided ("waiting for the lottery result in December").

Where each goes:

| What | Where |
| --- | --- |
| Bookings and promises that must not change without the user | `ledger.json` commitments |
| Key decisions and rejected options, with the reason and when to revisit | `ledger.json` decisions (`approved` only on explicit authorization) |
| Requirements, preferences, open items, design rationale, public-safe | `NOTES.md` |
| Anything sensitive: codes, contact details, private reasons, consent quotes | `private/` |

`NOTES.md` stays public-safe even in a private repository, because repositories get made public later.

## Ending the interview

Close with a short statement in plain words:

> Here's what I understood: four travellers including two young children, ten days, two cities. The two hotels and the outbound flight are booked. Bedtime is around 21:00, so evenings stay near the hotel. The main interests are trains, food markets and one theme park day. Still open: the return flight time. Next I'll research the high-impact facts and then come back with two design directions.

Then tell the user which mode you're in and which steps you're skipping, as `AGENTS.md` requires.

## In later sessions

In Change mode, skip the interview unless something material is ambiguous. Before asking anything, read `ledger.json` decisions and `NOTES.md`: the answer may already be there, and asking again for consent the user already gave is a failure, not caution.
