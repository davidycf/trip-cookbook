# Upgrade

**When to read:** when the user asks to update a site to a newer Cookbook version, or when you notice that one exists.
**What you produce:** a proposal the user approves before anything changes; the applied upgrade; a passing checker run; an updated `COOKBOOK_VERSION`.

An upgrade brings in new knowledge and checks, not new application code. Every site is different, so you decide what a change means for this site, propose it, and apply it only after consent.

## 1. Find out what changed

1. Read `COOKBOOK_VERSION` for the tag and commit the site was built with.
2. Clone the new release into a temporary directory outside the project, as during setup:
   `git clone --depth 1 --branch <new-tag> https://github.com/davidycf/trip-cookbook <temp-dir>`
3. Read the new `CHANGELOG.md` from the current version up to the new one. Each entry says whether it applies to existing sites.
4. Compare the copied files: `AGENTS.md`, `cookbook/`, `reference/`, `evals/` (without `evals/test/`) and `COOKBOOK_LICENSE`. Also check whether the project's copies were edited locally since setup: compare them with the old release, which you can clone the same way.

## 2. Work out what applies

For each change, decide which of these it is, for this site:

| Kind | Example | What to propose |
| --- | --- | --- |
| Guide or rule text only | Clearer wording in `research.md` | Replace the copied files |
| New or stricter check | The checker now tests a new failure | Replace `evals/`, run it, and list what this site must fix |
| Ledger schema change | A new optional field, or a stricter rule | Replace the schema, run L1, and propose ledger edits if needed |
| New recommendation | A new design principle | Explain it, and ask whether the user wants it applied |
| Not applicable | Advice for a feature this site doesn't have | Say so, and why |

Never overwrite local edits to copied files silently. If the project's `cookbook/` or `AGENTS.md` was edited, show the conflict and ask.

## 3. Propose, then wait

Write a short proposal for the user:

- The version change (old tag to new tag).
- What changes in the project's copied files.
- What, if anything, the site itself must change to keep passing, and what that change touches.
- Anything that affects confirmed commitments, approved decisions or the published content. These follow the normal authorization rules in `AGENTS.md`.
- What you recommend skipping, and why.

Apply nothing until the user agrees. Agreement to the upgrade covers the changes you listed, not extra ones you discover while applying it; ask about those.

## 4. Apply and recheck

1. Copy the new files into the project, keeping the user's agreed local edits.
2. Run `npm --prefix evals ci` if the checker's dependencies changed, and install the browser again if the Playwright version changed.
3. Make the agreed site changes.
4. Update `COOKBOOK_VERSION` to the new tag and commit.
5. Rebuild, and run the checker with `--base published` (or `initial` if the site was never published).
6. Hand off the completed three-column report. Publishing the upgraded site follows the normal publishing checklist in `build.md`.
7. Remove the temporary clones.

## If an upgrade goes wrong

The upgrade is ordinary Git history: revert the upgrade commit, and the site is back on the old version. Tell the user what failed, and record it in `NOTES.md` so the next attempt starts from it.
