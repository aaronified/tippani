# Tippani

A self-hosted, multi-user home for book highlights, movie dialogues, and quotes from
anywhere else. One static Go binary with the SPA embedded — SQLite and FTS5 inside, no
Node at runtime, built for a low-powered NAS box.

- 🎭 **[Interactive demo](https://aaronified.github.io/tippani/demo/)** — the real interface, on dummy data
- 🗺 **[Roadmap](https://aaronified.github.io/tippani/roadmap.html)** — everything ahead, in priority order
- 🔤 **[UI glossary](https://aaronified.github.io/tippani/ui-glossary.html)** — every control in the app, named
- 📦 **[The repository](https://github.com/aaronified/tippani)**

---

## This wiki is the documentation. There is no second copy.

Every document below **lives here and nowhere else** — it was moved, not copied, so there
is no original left to drift out of step. Anything in the repository that used to point at
`docs/PLAN.md`, `DEVELOPMENT.md`, `AI.md`, `docs/troubleshoot.md` and the rest now points
at the page that holds it.

| Page | The one question it answers | Was |
| --- | --- | --- |
| **[Developing](Developing.md)** | I want to change the code — where does it go, and how do I know it worked? | `DEVELOPMENT.md` |
| **[Design decisions](Design-decisions.md)** | Why is it built this way, what was rejected, and what turned out wrong? | `docs/PLAN.md` |
| **[Troubleshooting](Troubleshooting.md)** | The app logged a `TIP-*` code at me — what now? | `docs/troubleshoot.md` |
| **[How this was written](How-this-was-written.md)** | How much of this is AI-written, and what is actually checked? | `AI.md` |
| **[Spaced repetition](Spaced-repetition.md)** | How does the recall deck decide what to show, and when? | `docs/spaced-repetition-difficulty.md` |
| **[Bengali style](Bengali-style.md)** | Register, terms, loanwords — how the Bengali interface is written | `docs/bengali-style.md` |
| **[Provider marks](Provider-marks.md)** | The twelve supplier marks: where each came from, under what licence | `docs/PROVIDER-MARKS.md` |

**[Developing](Developing.md) is the map of the whole repository** — its *Where things
live* section names every package, script and workflow, and a check
(`node scripts/doc-map-check.mjs`) fails the build when the tree and that map disagree.

## What is still outside the wiki, and why

Each of these is load-bearing for something other than reading, so moving it would break
the thing rather than tidy it.

| Stays | Why it cannot move |
| --- | --- |
| [`README.md`](https://github.com/aaronified/tippani/blob/main/README.md) | GitHub renders it as the repository's front page. It is the "should I run this, and how" document and now links here for everything deeper. |
| [`CHANGELOG.md`](https://github.com/aaronified/tippani/blob/main/CHANGELOG.md) | **The binary embeds this file** (through `changelog.go` at the root) and serves it in-app. A wiki page cannot be compiled in. |
| `CLAUDE.md` | Agent instructions. Tooling reads it from the repository root by name. |
| `docs/roadmap.html`, `docs/ui-glossary.html`, `docs/landing.html` | **Generated**, and published by the Pages workflow — see below. |
| `docs/data/*.json` | The roadmap generator's input, not prose. |
| [`docs/plans/`](https://github.com/aaronified/tippani/blob/main/docs/plans/README.md) | The queue of things **not built yet**. Its own rule: *"Nothing in here describes the app as it stands"*, and a plan is deleted when it ships. Mixing promises into the reference documentation is what that directory exists to prevent. |
| [`docs/design/`](https://github.com/aaronified/tippani/blob/main/docs/design/README.md) | The prototypes are self-contained `.dc.html` files you open in a browser — pressable, carrying their own data. A wiki cannot host one, and the handoff documents are read beside them. |

## Why the roadmap is a link and not a page

**A wiki cannot host it.** `docs/roadmap.html` is a *generated*, self-contained page: it
carries its own stylesheet and is re-rendered from `docs/data/*.json` by
`node scripts/roadmap-data.mjs`, with `--check` proving page and data are in step. A wiki
strips the `<style>` such a page depends on, so pasting it here would produce an unstyled
wall of text **and** a copy that goes stale the next time the generator runs — the exact
duplication this wiki was built to end.

So it stays where it is generated, and is published:

### 🗺 **<https://aaronified.github.io/tippani/roadmap.html>**

The same is true of the **[UI glossary](https://aaronified.github.io/tippani/ui-glossary.html)**,
generated from the source with the app's own built stylesheet embedded, and guarded by
`npm run glossary:check`.
