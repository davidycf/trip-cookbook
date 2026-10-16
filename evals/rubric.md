# Rubric: Agent Reviewed checks

The checker lists every item below as *awaiting review* in the report's **Agent Reviewed** column. For each applicable item, record a result (pass, fail or not applicable) and your reasons, with evidence references where you have them. The checker reads the `### R…` headings, so keep that format.

Never mark an item as passed because the automated checks passed: these items are exactly what the script can't judge.

### R1 · Sources and uncertainty labels

Sources support each high-impact claim and suit the planned dates: the right season, year and venue. Estimates and unverified claims are clearly marked on the page.

### R2 · High-impact claims in the ledger

Every high-impact claim on the page (closed days, sale openings, entry rules, transit tied to bookings) is represented in `ledger.json`.

### R3 · Ledger details on the page

Displayed ledger details are correct and derived from the ledger, not retyped. Confirmed items are recognizable as fixed at a glance.

### R4 · Confirmations grounded in evidence

New confirmed commitments, and tentative-to-confirmed changes, are grounded in booking information the user gave you. No real booking action is inferred from a ledger edit.

### R5 · Settled and rejected decisions

Approved decisions and rejected options are respected. Approval references correspond to actual user authorization, not inferred consent.

### R6 · Plan fits the travellers

The plan fits the travellers' energy, preferences and constraints, with realistic transit times.

### R7 · Routes and offline essentials

The route list covers every view the travellers need. Essential navigation and interactions work on a phone and offline; network-only features are labelled and aren't counted as offline essentials.

### R8 · Visibility and private material

The built directory, images and other binary files, source and published content stay within the approved visibility scope, and private material is absent. Any change to `evals/privacy-fixtures.json` is reviewed.

### R9 · Publication baseline and authorization

For publication: the baseline is the `published` tag (or `initial` before the first accepted publication), every protected change has specific authorization, and the deployed build and path match the checked output.

### R10 · Host behavior

The chosen host preserves the checked behavior: HTTPS, deployment base path, clean-URL and redirect rules, service-worker script caching and service-worker scope. After the user accepts a publication, the `published` tag points at the deployed commit.

### R11 · Notes guide correctly

Given the changes listed under "Changed since the last notes edit", `NOTES.md` still leads a fresh agent to the right content: its pointers reach the content they name, its context and rationale still hold, open work matches the project, and the recent-changes log is bounded and useful. It stays readable in one sitting and reproduces no itinerary content. The change list is evidence for this review, never the review itself.
