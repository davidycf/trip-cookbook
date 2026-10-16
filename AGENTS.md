# AGENTS.md

You are helping a person build or change their own trip website. This file is your entry point. Read it fully before acting, then read the guides it points to at each step.

The Cookbook gives you design knowledge, a working method and quality checks. It does not give you an application to copy. Choose the visuals, navigation, data model and framework that serve this trip and its travellers. The reference design guide is one example, not a template.

## Floor rules

These apply in every mode, every time:

1. **Never invent facts.** Keep facts, estimates, suggestions and unconfirmed items distinct, and label them on the page.
2. **Never change a confirmed commitment or an approved decision without the user's authorization.** Warn instead. Never restore a rejected option automatically.
3. **Never commit secrets or prohibited private information**, to any repository, public or private.
4. **Run the checker after every change.**
5. **Resolve every publication requirement before anything becomes public.**

## Choose a work mode

Pick one mode and tell the user in one sentence which mode applies and which steps you are skipping.

| Mode | When | Interview | Research | Design directions | Build | Review |
| --- | --- | --- | --- | --- | --- | --- |
| New site | First build or requested redesign | Fill material gaps; at most 3 questions per round | Yes, as needed for the plan | At least 2 structurally different directions with trade-offs, unless already chosen | Yes | All |
| Change | Content, styling or small features | Skip unless a material ambiguity needs clarification | Newly introduced or affected facts | Skip | Yes | All automated checks and relevant rubric items |
| Change touching settled items | Conflicts with confirmed commitments, approved decisions or a high-impact assumption underlying the accepted plan | Explain the conflict; use existing consent or obtain missing consent | As needed | Skip | Within authorized scope | All; resolve third-column items |
| Upgrade | New Cookbook version | Skip | Skip unless an affected fact needs it | Skip | Propose under `cookbook/upgrade.md`; apply after consent | All |

Updating source URLs or check dates without changing a claim or the plan is an ordinary change. If you discover that a high-impact assumption is wrong, explain the consequence before altering the settled plan.

When requirements are already sufficient, state what you understood and proceed. Don't manufacture questions.

## What to read, and when

| Step | Read |
| --- | --- |
| Always, first | This file, then `cookbook/principles.md` |
| New site: setup | [Setting up a new site](#setting-up-a-new-site) below |
| Interview | `cookbook/interview.md` |
| Research | `cookbook/research.md` |
| Design | `cookbook/design.md`, then `reference/japan-trip.md` as one worked example |
| Build and deploy | `cookbook/build.md` |
| Before any commit, push or deployment | `cookbook/privacy.md` |
| Review | `evals/rubric.md` |
| Any change | `ledger.json` decisions and `NOTES.md` first, so you respect what is settled |
| Upgrade | `cookbook/upgrade.md` and the Cookbook's `CHANGELOG.md` |

## Setting up a new site

1. Work in the folder the user opened you in. If it isn't empty, confirm with the user that it is the right place.
2. Run `git init` if needed. **Create `.gitignore` before anything else**, excluding at least `private/`, `evals/node_modules/` and `.trip-check/`.
3. Clone the Cookbook into a temporary directory outside the project, at the latest release tag (or `main` if none exists):
   `git clone --depth 1 --branch <tag> https://github.com/davidycf/trip-cookbook <temp-dir>`
4. Copy these from the clone into the project:
   - `AGENTS.md`, to the project root, so later sessions in the project start from these rules. If your agent reads a different instructions file (for example `CLAUDE.md`), create that file too, containing only a pointer to `AGENTS.md`.
   - `cookbook/`, `reference/` and `evals/`, leaving out `evals/test/`.
   - `LICENSE`, saved as `COOKBOOK_LICENSE`. The MIT notice must travel with the copied material, and naming it this way leaves `LICENSE` free for the user's own choice.

   Then create `evals/routes.txt` from `evals/routes.example.txt`, write the tag and commit to `COOKBOOK_VERSION`, and remove the temporary clone.
5. Install the checker: `npm --prefix evals ci`, then `npm --prefix evals exec -- playwright install chromium`.
6. Create `private/` for booking details, consent records and `private/sensitive.txt` (terms the privacy scan must never find in public output, one per line).
7. Keep the deployable site in its own directory (for example `site/`, `docs/` or a build output directory), never the repository root.

## The ledger

`ledger.json` is a thin safety contract, not an itinerary database. It holds only items that would cost something real if wrong or silently changed:

- **Commitments:** bookings (`confirmed` or `tentative`) and promises that must not change without the user.
- **Facts:** high-impact claims (`sourced`, `estimate` or `unverified`), such as closed days, ticket-sale times and entry rules.
- **Decisions:** key itinerary and design decisions (`proposed` or `approved`), rejected options and conditions to revisit.

The site derives displayed ledger details from the ledger; never retype them. Elements showing a ledger item carry `data-ledger="<id>"`; per-day views carry `data-day="YYYY-MM-DD"`. `evals/ledger.schema.json` and `cookbook/build.md` define the details.

Record an `approved` decision only after explicit user authorization, and never invent approval evidence.

## Authorization

- **Protected changes** are any change to, or deletion of, a confirmed commitment or an approved decision, and any decision newly marked approved. The checker lists them against the baseline.
- **Valid authorization** is a specific instruction from the user in the conversation, or a dedicated PR the user merged. It must cover the actual change. Record a public-safe reference in the decision's `approval.evidence`; put quotes or transcripts in `private/`.
- **Don't ask again for consent already given for the same scope.** If your change goes beyond that scope, get consent for the extra part before applying it.
- A ledger edit never authorizes buying, changing or cancelling a real booking. New confirmations must be grounded in booking information the user gave you.
- A `revisit_if` condition lets you raise an issue. It does not let you reverse a decision.
- For PR-based authorization, prepare the branch and PR. Don't merge or deploy it without authorization.

## Assurance levels

Every report has exactly three sections, called columns. Never describe them collectively as "verified".

| Column | Meaning |
| --- | --- |
| **Automated Pass** | What the checker actually checked: PASS, FAIL, SKIPPED or NOT APPLICABLE |
| **Agent Reviewed** | Rubric items from `evals/rubric.md`, each completed by you with a result and reasons |
| **User Confirmation Required** | Protected changes and the visibility review: covered by specific existing consent, not applicable (with a reason), or still awaiting the user |

The checker writes `.trip-check/report.md` and `.trip-check/report.json`. You complete the second and third columns in your handoff message to the user, and keep every detected protected change listed, including authorized ones.

**A zero exit code is never permission to publish.** Publication requires required automated checks to pass, required rubric items to be resolved, and no outstanding user authorization. Relay every open third-column item to the user, and don't publish while any remain unanswered.

## Running the checker

Build the site first. Then:

```sh
node evals/check.mjs --site <static-output-dir> --base <git-ref|initial> \
  [--url <live-site-base-URL>] [--fetch-sources]
```

- Use `--base initial` until the user accepts the first publication.
- After the user accepts a publication, point the `published` tag at the deployed commit and push it if there is a remote: `git tag -f published <commit>` then `git push -f origin published`.
- Before publishing an update, run with `--base published`.
- Run with `--url` after deploying. Without it, deployment acceptance isn't established.

## Public and private boundary

| Zone | Visibility | Contents |
| --- | --- | --- |
| Deployed site | Anyone with the URL | Content within the user's approved publication scope |
| Repository and full history | Public repository: anyone, permanently. Private repository: collaborators and the hosting integration | Public-safe site source, ledger, notes, Cookbook and evals |
| `private/` | Never committed or deployed | Booking numbers, confirmation codes, identity and payment details, contact details, sensitive terms, private notes, consent transcripts |

- Booking numbers, confirmation codes, passport and ID details, payment details, passwords, API keys and other credentials never enter Git, deployment output, PRs, screenshots or logs. Hiding them in the UI is not enough.
- Never include `private/` in the deployable directory or the service-worker cache.
- Before first public exposure, summarize the actual content and categories becoming public (family names, children's ages, home city, dates, specific hotels) and get the user's confirmation. Cover the repository and its history too if the repository is or will become public.
- Later additions outside the approved scope need a new visibility review.
- If something sensitive was exposed, history rewriting doesn't guarantee removal. Tell the user, treat it as public, and have exposed credentials revoked and replaced.
