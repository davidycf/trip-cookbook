# Build and deploy

**When to read:** once a design direction is chosen, and for every change after that.
**What you produce:** a static site directory that works on a phone and offline; `NOTES.md`, with its index and build record; a passing checker run; a deployment on the user's chosen host.

You choose the framework and the build tools. The Cookbook fixes only the output: **a directory of static files that any static host can serve over HTTPS.** No server-side code, no database.

## 1. `NOTES.md`: the project's index

Write `NOTES.md` from the first build, and keep it accurate. It's the project's **index and short log**: it tells the next session, after a gap of days and possibly with a different agent, where current content lives and how to read it. **The site and the ledger stay the source of truth.** The notes point at content; they never reproduce the itinerary, bookings or to-do list. Write the index while you write the first draft, when you know best where everything is.

### Structure

These level-2 headings are required, each once, in this order. You can add other level-2 headings anywhere.

| Heading | Holds | Must not hold |
| --- | --- | --- |
| `## Where to look` | A pointer table: topic → location of the current content. Also one-line notes on important relationships, such as "activities link to places via `place`" | Copies of the content it points to |
| `## Context` | Requirements, the rationale behind the design and plan, and implementation traps that aren't apparent from the site. Cite decisions as `ledger:<id>`; don't restate them | A second decision register; itinerary details |
| `## Open` | Unfinished discussions, implementation work and blockers. Travel to-dos appear as a pointer to the site view that lists them | Copies of the site's to-do list |
| `## Recent changes` | A short, bounded log (see below) | A full history; restatements of changed content |
| `## Visibility` | The approved publication scope (`privacy.md`) | Private information |
| `## Build and deploy` | The build record (see below) | Credentials or secrets |

`## Context`, `## Open` and `## Recent changes` may be empty, or say "None", when there's nothing to record. `## Where to look` must hold its pointer table, and `## Visibility` and `## Build and deploy` must not be empty. Keep the whole file readable in one sitting.

`NOTES.md` stays public-safe. Booking numbers, confirmation codes, identity and payment details and credentials belong in `private/`. A public-safe status such as "awaiting booking confirmation" or "boat trip on hold, payment due by 14 May" is fine in `## Open`.

### Pointers

The checker (N1) checks pointers only where they're declared: backticked tokens in the **Location** column of the table under `## Where to look`. Everything else is ordinary prose, and HTML comments (`<!-- … -->`) don't count: headings and tables inside them are ignored.

```markdown
## Where to look

| Topic | Location |
| --- | --- |
| Daily plans | `site/data/days.json#days`, `#/day/2027-04-10` |
| Stays | `site/data/plan.json#stays` |
| Travel to-dos | `#/prepare` |
| Overview | `route:.` |
| Booking details | `ledger.json`, rendered by `site/app.js` |
```

Token forms, recognized in this order. Paths are relative to the project root:

| Form | Meaning | Checked for |
| --- | --- | --- |
| `route:<entry>` | A site route of any form: `.`, a hash route, a path route such as `day/sunday/`, or a path with a hash such as `day.html#map` | `<entry>` is exactly a line of `evals/routes.txt` |
| `#…` | Shorthand for `route:#…` | As above |
| `path#a.b` | A key path in a JSON file | The file parses as JSON, and the dot-separated keys resolve |
| `path` | A file or directory | Exists |

- Anything that looks like a site route needs `route:`. Without it, `day/sunday/` is a project path, and `day.html#map` is a key path into `day.html`.
- Key paths go through object keys only, never into arrays: indices go stale with ordinary edits. Point at the array itself (`plan.json#days`) and the route that shows it.
- Point at JSON keys only; for other files, point at the file.
- **Ledger references** are written `ledger:<id>` and may appear anywhere in `NOTES.md`. N1 checks each against `ledger.json`. A full stop right after the ID is read as punctuation, unless the ID itself ends with one.

N1 shows that targets exist. Whether they're the right targets is rubric item R11.

### When to edit the notes

Update `NOTES.md` when a change affects:

- where information lives;
- how it should be interpreted; or
- what the next session needs in order to resume.

Ordinary content edits don't require a notes edit. The test for a `## Recent changes` entry: *would a fresh agent look in the wrong place, or misread something, without it?* Changing a restaurant usually fails that test. Replacing a destination, or introducing activity swapping, passes it.

- **Entry format:** one or two lines: the date, what changed in meaning, where the current content now lives, and a commit or PR reference where useful. Don't reproduce the new details.
- **Keep the log bounded:** about 5–10 entries, never append-only. When it needs trimming, promote each old entry (its pointer into `## Where to look`, any rationale that still matters into `## Context`) or drop it; Git keeps the history. Nobody should need to replay the log to reconstruct the present.
- **When to tidy:** within the ordinary change, before the final checks and publication. Never after deployment or user acceptance: a notes edit then is a new source change, and with automatic deploys, pushing it publishes again (section 8). A publication is a chance to review the log, not a mandatory pruning.

### The build record

`## Build and deploy` records how this site is built and deployed. Later sessions, and upgrades, depend on it.

```markdown
## Build and deploy

- Host: Cloudflare Pages (project `our-trip`), deploys from `main` via Git integration
- Repository visibility: private
- Install: `npm ci` (site) and `npm --prefix evals ci` (checker)
- Build: `npm run build` (or: no build; `cp ledger.json site/ledger.json` only)
- Output directory: `dist/`
- Deployment base path: `/`
- Live URL: https://our-trip.pages.dev/
- Checker: `node evals/check.mjs --site dist --base published --url https://our-trip.pages.dev/`
- Offline preparation for travellers: see the "Before you go" page at `#/prepare`
- Deploy steps: merge to `main` (publishing; needs the user's go-ahead)
```

`examples/weekend-sample/NOTES.md` in the Cookbook is a complete example.

## 2. Project layout

```text
my-trip/
  AGENTS.md            copied from the Cookbook
  COOKBOOK_LICENSE     copied from the Cookbook
  COOKBOOK_VERSION
  NOTES.md
  ledger.json
  cookbook/  reference/  evals/
  src/ or site/        your site source
  dist/ or site/       the deployable output (never the repository root)
  private/             gitignored, never deployed
```

- The deployable directory is its own folder. The checker refuses a `--site` that is the repository root, or that contains `private/` or `.git`.
- `.gitignore` excludes at least `private/`, `evals/node_modules/` and `.trip-check/`.
- Whether the build output is committed depends on the host: committed for a branch-based deploy (for example GitHub Pages from `/docs`), ignored when the host builds it. Record the choice under `## Build and deploy` in `NOTES.md`.

## 3. Static output rules

- **Entry point:** the output directory has an `index.html`.
- **Relative URLs, relative to each page.** Never `/app.js`: the checker serves the site at both `/` and `/site/`, and a root-absolute URL breaks the second, as well as project sites on hosts that serve from a subpath. Relative URLs resolve from the page's own location: on the entry page `app.js` is right, but a page at `day/3/index.html` needs `../../app.js`. Hash routes avoid this, because every view is the entry page. With path routes, have the build write depth-correct URLs, or give each nested page a relative `<base href="../../">`.
- **Routes:** use hash routes (`#/day/3`) or real files for path routes (`day/3/index.html`). The checker has no "single-page app fallback" and no clean-URL rewriting, and a host's rewrite rules are not a substitute.
- **No essential content from third parties at view time.** Maps, fonts and widgets from other origins may fail offline or on bad data. Essentials are served from the site's own files.
- **Deterministic trip views.** Apart from content marked `data-offline-volatile`, a route renders the same content online and offline. Clocks, countdowns and rotating tips go inside volatile elements.

## 4. The ledger and the page

`ledger.json` is the single source for what it lists. The site **derives** displayed ledger details from it, at runtime or during the build. Looking up an item by ID is fine; retyping its date, time or wording into page source is not.

- **Runtime:** ship `ledger.json` in the output and read it with `fetch('ledger.json')` from the entry page (with a depth-correct URL from nested pages). Include it in the offline cache.
- **Build time:** your build reads `ledger.json` and renders from it.
- **No build step:** copying is the build step. Use `cp ledger.json site/ledger.json` as the documented build command, never edit the copy by hand, and re-run it before every check.

Annotate the page so the checker can find ledger items:

- An element showing a ledger item carries `data-ledger="<id>"`, with one ID per element.
- If the site has per-day views, each day's container carries `data-day="YYYY-MM-DD"`. A commitment shown inside a day container must belong to that day (`date`, or within `date` to `end_date`).
- Every **confirmed** commitment must be visible, non-empty and annotated on at least one listed route.

```html
<section data-day="2027-03-13">
  <h2>Saturday 13 March</h2>
  <p data-ledger="flight-out">10:25 · Outbound flight</p>
</section>
```

The schema is in `evals/ledger.schema.json`. In short:

- IDs are unique across the whole file and safe to publish.
- A `time` needs a `date` and an IANA `time_zone`, for example `Asia/Tokyo`.
- An `end_date` is inclusive.
- A `sourced` fact needs `source` and `checked`; an `estimate` needs `basis`.
- An `approved` decision needs `approval` with `on` and `evidence`; a `proposed` one may not have `approval`.
- Unknown fields are rejected: put the site's other data in its own files.

## 5. The route list

`evals/routes.txt` lists every view the travellers need, one per line. Start from `evals/routes.example.txt`.

```text
# Entry
.
# Days
#/day/1
#/day/2
# Other views
#/places
#/prepare
day-list.html#today
```

- `.` is the entry page. Other routes are site-relative paths without a leading slash, hash routes, or a path followed by a hash.
- Lines starting with `# ` (hash and space) are comments. Use `#/…` for hash routes so they can't be mistaken for comments.
- No absolute URLs, and nothing that climbs out of the site (`../`).
- List views reached through navigation too. If a view has no route of its own, the checker can't visit it.

## 6. Offline

The required guarantee: **after the traveller's preparation step, every listed route works offline.** Preparation may be "open each listed view once" or "open the site once"; precaching everything on first visit is stronger and optional.

### A service worker that passes

The simplest approach that meets the checker's rules precaches every file at install:

```js
// sw.js, at the root of the output directory
const PREFIX = 'our-trip-';                // unique to this site
const CACHE = PREFIX + '2027-03-01-a';     // change on every release
const FILES = ['./', 'app.js', 'style.css', 'ledger.json', 'data/days.json', 'icon-192.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

// Take over only when the traveller asks for the update (see the page code below).
self.addEventListener('message', event => {
  if (event.data === 'activate-update') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== location.origin) return;
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then(hit => hit || fetch(event.request))
  );
});
```

```js
// in the page
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').then(reg => {
    if (!reg) return;   // service workers can be blocked (private windows, some browsers, the live check)
    const offer = () => {
      if (reg.waiting && navigator.serviceWorker.controller) showUpdateButton(() => reg.waiting.postMessage('activate-update'));
    };
    offer();
    reg.addEventListener('updatefound', () => reg.installing?.addEventListener('statechange', offer));
  }).catch(() => {});   // the site still works online without its offline copy
  // A takeover by a new release reloads every open page, so none runs on another release's files.
  // The first worker taking control (clients.claim on first install) does not reload.
  let controlled = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (controlled) location.reload();
    controlled = true;
  });
}
```

`showUpdateButton` is yours to write: a small "New version available: update" button is enough.

Registration can fail or give no registration where service workers are blocked: private windows, some browsers, and the checker's live check (E5), which blocks them. The page must keep working online in that case, so guard it as above; an unhandled rejection or a `null` registration is an uncaught exception that fails E1 and E5.

Rules that matter:

- **Register relative to the page,** so the scope follows the deployment base path: `sw.js` from the entry page, `../../sw.js` from a page at `day/3/index.html`. Never `/sw.js`.
- **Call `clients.claim()` on activate.** A first-time worker activates as soon as it installs, and `claim()` makes it control the page that installed it. The checker requires the first visited page to be controlled without a reload, and so does a traveller who opens the site once.
- **Let updates wait.** Never call `skipWaiting()` unconditionally. A new release waits until every page of the old release is closed, so an open page never reads files from a release it wasn't built with. When the traveller taps "update", the page asks the waiting worker to take over and reloads as soon as it does.
- **Delete only your own caches.** Give every cache name a prefix unique to this site, and on activate delete only this site's old caches. Several sites can share one origin (for example project sites under `https://<user>.github.io`), and they share its cache storage. Prefix `localStorage` keys for the same reason.
- **Cache the page under the key it's requested by.** Navigations to `#/day/3` request `./`, which is why `./` is in the list. With path routes, list each route's URL relative to `sw.js`, for example `day/3/`.
- **Change the cache name on every release.** The new release then installs into its own cache, and the old one stays intact until the old pages are gone.
- **Never cache anything from `private/`.** It shouldn't be in the output at all.

For a site that changes often, network-first with a short timeout and a cache fallback works too. The same rules apply: save each release's files as one set under a prefixed cache name, and let updates wait.

### Other preparation mechanisms

If the site needs more than "service worker installed and controlling" (for example it downloads per-day data on demand), expose a readiness flag. Set `window.__TRIP_OFFLINE_READY__ = false` during page startup, and set it to `true` only when preparation for that route is complete. The checker waits for it when it exists.

### Content that changes offline

Wrap anything that legitimately differs offline in an element with `data-offline-volatile`: the offline banner, "unavailable offline" notes on maps, clocks. The checker leaves it out of the online/offline comparison. A volatile element may not contain a confirmed commitment's `data-ledger` element, and the rest of the page must not be empty.

### Telling the travellers

Write the preparation step on the site itself, for example a short "Before you go" view:

1. On Wi-Fi, open the site on each phone that will be used on the trip.
2. Open each listed view once, or wait for "Saved for offline use".
3. Check: switch on airplane mode, close the browser, reopen the site, and tap through a few days.
4. After the last update before departure, open the site and tap "update" if it offers one (or close all of its tabs and reopen it), then repeat steps 2 and 3.

Moving the site to a new host or domain is a new origin: offline copies and on-device choices don't carry over, and travellers must prepare again.

## 7. The checker

### Setup (once per project)

```sh
npm --prefix evals ci
npm --prefix evals exec -- playwright install chromium
```

### Running it

Build first. Then:

```sh
node evals/check.mjs --site <output-dir> --base <initial|published|git-ref> \
  [--url <live-base-url>] [--fetch-sources]
```

- `--site` is the built output directory.
- `--base` is required. Use `initial` until the user accepts the first publication, and `published` after that (see section 8).
- `--url` adds the live check (E5) after deployment. Without it, deployment acceptance isn't established.
- `--fetch-sources` also checks that sourced URLs are reachable now.

The checker serves the output itself at `/` and `/site/`, in fresh browsers at 390px. It visits every listed route, tests offline after preparation, validates the ledger, compares it with the baseline, scans for private data, and checks `NOTES.md`'s structure and pointers. It also lists the project files changed since `NOTES.md` was last committed, as information for rubric item R11. It writes `.trip-check/report.md` and `.trip-check/report.json`.

### Reading the result

- The exit code reflects automated checks only. **Zero is never permission to publish.**
- Fix failures in the site. Don't suppress console errors, add retries, special-case the checker, or weaken a check to make it pass.
- Complete the report's second and third columns in your handoff to the user: rubric items from `evals/rubric.md` with reasons, then each protected change and the visibility review, marked covered by specific consent, not applicable with a reason, or awaiting the user.

## 8. The publication baseline

The checker compares the current ledger with a baseline to list protected changes.

- **Before the first accepted publication:** `--base initial`.
- **After the user accepts a publication:** point the `published` tag at the commit that was deployed, and push it if there is a remote:

  ```sh
  git tag -f published <deployed-commit>
  git push -f origin published
  ```

- **Before publishing an update:** run with `--base published`. You can compare against other refs while working, but the report flags a `--base` that differs from the `published` tag.
- If the tag is missing or doesn't match what's live, resolve the baseline with the user before publishing.
- **With automatic deploys, every push to the deploy branch is a publication,** even one that changes only notes. Once a publication is accepted, either keep later commits local until the next real change, or treat the push as a new publication: check it, get it accepted, and move the tag. The tag should always point at what's live.

## 9. Choosing a host

Any static host with HTTPS works. Propose one based on the accounts the user already has, and the visibility they want:

| Host | Private repository on the free tier | Default site address | Notes |
| --- | --- | --- | --- |
| GitHub Pages | No; needs a paid GitHub plan | `https://<user>.github.io/<repo>/` (a subpath) | Simplest if the repository is public and on GitHub |
| Cloudflare Pages | Yes | `https://<project>.pages.dev/` | Git integration or direct upload |
| Netlify | Yes | `https://<name>.netlify.app/` | Git integration or CLI deploy |

Other static hosts should work too; the deployment is then Agent Reviewed against the pitfalls below. Host plans and features change, so check the host's current documentation when setting up.

You can create the repository yourself once the user agrees to its name and visibility (for example `gh repo create <name> --private --source . --push`); don't make them do it by hand. Connecting a host to the repository usually needs the user's own sign-in: give them short, exact steps, say which permissions to grant (access to that one repository only), and ask for the resulting site address.

## 10. Host pitfalls

After the first deployment, and after any change to host settings, check:

- **HTTPS.** Service workers require it (localhost is exempt for testing).
- **Base path.** Subpath hosting (`/<repo>/`) breaks root-absolute URLs. E5 catches broken pages; also confirm the service worker's scope is the site's path.
- **Clean URLs and redirects.** Some hosts redirect `page.html` to `page`, or `index.html` to `/`. A service worker that cached `page.html` can then miss. Link to and cache the canonical URLs the host serves, and check with `curl -I <url>` that the URLs you cache answer `200` without a redirect.
- **Caching of `sw.js`.** Browsers check the service-worker script for updates while bypassing their own HTTP cache, but a host or CDN cache can still delay updates. Check with `curl -I <url>/sw.js`; if needed, set `Cache-Control: no-cache` for it (for example in a `_headers` file on hosts that support one).
- **Preview deployments.** Hosts that build previews for branches or pull requests publish them at public URLs. Treat a preview as publication, or turn previews off, until the visibility review is done.
- **Automatic deploys.** If merging to the deploy branch deploys the site, then merging is publishing. Get the user's go-ahead before merging, as for any publication.
- **404 handling.** Don't rely on a host's 404 page to serve app routes; listed routes must exist as files or hash routes.

## 11. Worked deployment examples

These assume the built site is in `site/`; substitute your output directory.

### GitHub Pages (via GitHub Actions)

1. In the repository on GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Add `.github/workflows/deploy.yml`. It deploys on every push to `main`, which makes merging to `main` a publication:

   ```yaml
   name: Deploy site
   on:
     push:
       branches: [main]
     workflow_dispatch:
   permissions:
     contents: read
     pages: write
     id-token: write
   concurrency:
     group: pages
     cancel-in-progress: false
   jobs:
     deploy:
       runs-on: ubuntu-latest
       environment:
         name: github-pages
         url: ${{ steps.deployment.outputs.page_url }}
       steps:
         - uses: actions/checkout@v4
         - uses: actions/configure-pages@v5
         # Add install and build steps here if the site has a build.
         - uses: actions/upload-pages-artifact@v3
           with:
             path: site
         - id: deployment
           uses: actions/deploy-pages@v4
   ```

   Check GitHub's current Pages starter workflow for newer action versions.
3. The site appears at `https://<user>.github.io/<repo>/`, a subpath, so relative URLs are essential.
4. Run the checker with `--url https://<user>.github.io/<repo>/`.

Without Actions, **Deploy from a branch** serves only the branch root or its `/docs` folder. Put the output in `docs/`, commit it, and add an empty `docs/.nojekyll` file so files and folders starting with `_` aren't dropped.

### Cloudflare Pages

1. In the Cloudflare dashboard, create a Pages project and connect the Git repository, which can be private. Set the build command (or leave it empty for no build) and the output directory, `site`.
2. Or deploy without Git integration: `npx wrangler pages deploy site --project-name <name>`.
3. The site appears at `https://<project>.pages.dev/`, at the root.
4. Watch for clean-URL redirects (`page.html` redirecting to `page`) and cache the URLs that answer `200`.
5. Headers, for example for `sw.js`, can be set with a `_headers` file in the output directory.
6. Branch previews get their own public URLs; see the preview pitfall above.

Cloudflare also offers static hosting through Workers; the same rules apply.

### Netlify

1. In Netlify, add a new site from the Git repository, which can be private. Set the build command (or none) and the publish directory, `site`.
2. Or deploy from the command line: `npx netlify-cli deploy --dir=site --prod`.
3. The site appears at `https://<name>.netlify.app/`, at the root.
4. Headers can be set with a `_headers` file in the publish directory or in `netlify.toml`. Check whether URL handling settings rewrite or redirect `.html` URLs, and cache the URLs that answer `200`.
5. Deploy previews for pull requests are public by default; see the preview pitfall above.

## 12. Publishing checklist

Publish only when all of these hold:

1. The build is fresh, and the checker's required automated checks pass at both prefixes.
2. Rubric items in `evals/rubric.md` are resolved, with reasons. `NOTES.md` was reviewed, and any update or tidying that section 1 calls for was made within this change, before these checks. Unchanged notes are fine when nothing called for an edit.
3. Every protected change has specific authorization, and the user has answered every open third-column item.
4. The visibility review is done (`privacy.md`), and covers this content.
5. The deployment matches the checked output: same build, same path.
6. After deploying, the checker passes with `--url` against the live site.
7. Hand the user the completed three-column report for this publication **before** asking them to accept it.
8. Once the user accepts the publication, move the `published` tag to the deployed commit.
