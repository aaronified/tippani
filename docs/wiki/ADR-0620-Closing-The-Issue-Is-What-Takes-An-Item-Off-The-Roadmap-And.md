# ADR-0620: Closing the issue is what takes an item off the roadmap, and something checks that now

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 1.16.x

**Decided.** Culling a section from `docs/roadmap.html` and closing its issue are one job, done in one pass. `node scripts/roadmap-tracker.mjs --audit` reconciles the page against the tracker and exits non-zero on either direction of drift: an **orphan** is open, labelled for the page and no longer on it; a **ghost** is closed and still listed. It reads the page and the tracker, writes nothing at all, and prints the `gh issue close` line instead of running it.

**Why.** The entry above claims "I cannot forget to remove one, because closing the issue removes it". That was true of the *generated* regions and false of the hand-written backlog, which is where the numbered sections live. Removing one is an ordinary edit to prose, and nothing anywhere noticed that an issue number went with it. Four of them — §§1–3 (Quick wins, The review loop deepened, Search precision) and §18 (Verbose, structured logs) — sat open with no section on the page across two releases, while the tracker is the surface anyone outside this repo actually subscribes to. `roadmap-data.mjs --check` cannot catch it, for the same reason it could not catch the nineteen culled items: it validates the generated regions against `docs/data/*.json` and never reads the backlog.

**Why the disposition stays manual.** The audit finds the drift; it does not settle it. Whether an item shipped or was dropped is the whole content of the answer, and GitHub offers two coarse reasons for it — `completed` on something half delivered overstates, `not planned` on the same thing reads as a refusal to whoever asked for it. So the script prints the command and the comment is written by hand: what shipped, what was dropped and why, and whether somebody saying "I still want this" would reopen it. A script that closed issues by itself would turn a public no into a silent one.

**Instead of.** A fifth CI gate. It needs a live tracker read, so it would put a contributor's pull request at the mercy of what is happening on the issue tracker and go red for maintainer bookkeeping that has nothing to do with their diff. It is a step in the cull, not a property of the tree — which is also why it lives in `roadmap-tracker.mjs`, the script that already holds the `gh` dependency, rather than becoming a fourth roadmap script.

**Approved.** The owner's, who asked whether the roadmap culls had been closing the issues behind them — they had not — and for the closing to become part of the pass rather than something I remembered.

<sub>1.16.x — `scripts/roadmap-tracker.mjs` · `Developing.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
