# Privacy

**When to read:** before the first commit, before every push, pull request or deployment, and whenever private material arrives.
**What you produce:** a project where private material stays in `private/`; a visibility review the user confirms before anything becomes public; an honest account of what the privacy scan did and didn't cover.

A trip site holds a family's dates, the places they'll be, and sometimes their names. Some of that can be public by choice. Some of it must never be: it lets a stranger change a booking, impersonate someone or follow them.

## Three zones

| Zone | Who can see it | What belongs there |
| --- | --- | --- |
| Deployed site | Anyone with the URL | Content within the scope the user approved |
| Repository and its full history | Public repository: anyone, permanently, including forks and caches. Private repository: collaborators and the hosting integration | Public-safe site source, ledger, notes, Cookbook copies |
| `private/` | Only the user's machine; never committed or deployed | Booking numbers, confirmation codes, identity and payment details, contact details, sensitive terms, private notes, consent transcripts |

Keep the repository public-safe **even when it's private.** Private repositories get shared, transferred and made public, and making one public exposes its whole history at once.

## Never public, anywhere

These never enter Git (public or private), the deployed output, pull requests, screenshots or logs:

- Booking numbers and confirmation codes.
- Passport, ID and visa numbers.
- Payment details: card numbers, bank details, payment links.
- Account passwords, API keys, tokens and other credentials.

Hiding them in the interface is not enough: hidden text is still in the HTML, the offline cache and the history.

## Public only by approval

These may be public if the user approves, and only within the approved scope:

- Travellers' names (roles such as "Parent" or "Older child" are an alternative).
- Children's ages, and anything that identifies a child.
- Home city or region.
- Trip dates.
- Specific hotels and other places the travellers will be at, at known times.
- Contact details for venues or hotels (official public ones are usually fine).

## Setting up

1. Create `.gitignore` with `private/` **before** any private material arrives.
2. Keep private material in `private/`, for example `private/bookings.md` and `private/approvals.md`. Refer to it from the ledger with an opaque `private_ref`, such as `bookings#flight-out`, which contains no booking number, name or secret.
3. Put terms the scan must never find in public output in `private/sensitive.txt`, one per line: surnames, a street address, an account handle. Matching is literal and case-insensitive. The file itself is never committed or printed in reports.
4. Make sure the deployable directory and the service-worker cache can never include `private/`.

## The visibility review

### Before first public exposure

Before you push to a public repository, open a public pull request, or publish a deployment for the first time:

1. Look at the **actual content** that will become public: rendered pages, the ledger, `NOTES.md`, images, and, for a public repository, the history.
2. Summarize, for the user, the categories it reveals, with examples: "Your family name appears on the home page; both children's ages appear on day 3; the hotel names and dates for all nine nights are listed."
3. Ask for confirmation, and wait. Record the approved scope in `NOTES.md` in public-safe words ("Approved to publish: first names, children's ages, hotel names and dates; not: home city").

### On every later change

- If the change stays within the approved scope, record that in the report's third column ("within the approved scope: hotel names and dates").
- If it adds a new category (the first appearance of a surname, a home address, a child's school), get a new confirmation before publishing.
- Detecting a new category is your job, not the scanner's: the checker always lists a visibility reminder, and you answer it.

## What the privacy scan covers

The checker's P1 scan looks at:

- current tracked text files, including staged and uncommitted changes;
- text files in the deployable output;
- rendered page text and page markup on every listed route;
- text in every locally available Git ref and its full history.

It looks for likely card numbers (format and checksum), common credential and key formats, selected passport-number shapes, and your terms from `private/sensitive.txt`.

What it can and can't tell you:

- **Zero findings means zero unexcepted matches within the reported coverage.** It is not a privacy guarantee.
- **It can't read images or other binary files.** Review every screenshot and image yourself, including text visible in it.
- **It can't recognize most personal information:** names, addresses and dates look like ordinary text. Your review and the user's visibility review cover these.
- **A shallow clone hides history,** and the scan fails until history is complete.
- Findings show a redacted match, never the full value.

### Synthetic test values

If the project needs a value that looks sensitive but is synthetic, such as a documented test card number, it can be allowed by an exact entry in `evals/privacy-fixtures.json`: the repository-relative path, the exact value, the pattern and the reason. No wildcards and no whole-directory exclusions. Any change to that file is listed for your review; never add an entry to silence a real finding.

## If something leaks

Rewriting Git history doesn't guarantee removal: clones, forks, caches and previews may already hold it.

1. Stop publishing further changes.
2. Tell the user plainly what was exposed, where, and since when.
3. Credentials and keys: have them revoked and replaced. Treat them as compromised whether or not you see misuse.
4. Booking codes: suggest the user contact the provider about changing them.
5. Other personal details: treat them as public from now on, and remove them from current content.
6. Only then, and with the user's agreement, consider rewriting history; and say it is damage reduction, not removal.

## Pull requests, previews and logs

- In a public repository, branches and pull requests are public too, the moment they're pushed.
- Host preview deployments are public URLs (see `build.md`).
- Don't paste private material into commit messages, pull request descriptions, issue comments or checker reports.
- Keep the user's consent quotes and transcripts in `private/`; the ledger's `approval.evidence` holds only a public-safe reference to them.

## Access-controlled sites

Some hosts can put a site behind a login or password. That narrows who sees the site, but it doesn't relax any rule above, and access control can interfere with offline use. The Cookbook's offline path assumes a site anyone with the URL can reach.
