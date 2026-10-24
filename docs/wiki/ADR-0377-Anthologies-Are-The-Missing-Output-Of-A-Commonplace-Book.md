# ADR-0377: Anthologies are the missing output of a commonplace book

Source of truth: this wiki page.

- **Area:** [§10 What Leaves the App: Exports, Round-Trips and the Shared Image](ADR-Index.md#area-10)
- **Status:** Accepted
- **Version:** `docs/roadmap.html`

**Decided.** The roadmap's [anthologies](Roadmap.md#anthologies) section: a named, ordered list of quotes drawn from anywhere in the library, carrying prose of its own — an introduction, and commentary between the entries. Exported as one Markdown file, and via [interop](Roadmap.md#interop) as EPUB.

**Why.** Everything in Tippani today points inward: you file a passage, you find it again, you get asked about it. An anthology is what you make *from* the collection — a sequence you arranged, on a theme you chose, with the connective tissue that explains why these twelve passages belong next to each other. It is explicitly not a tag with a nicer hat: the two things a tag cannot do are hold an order and hold your writing, and those are the whole point. Letterboxd's lists are the closest proven form; the nearest thing in the annotation world is Zotero's extract-annotations-into-a-note, which is the most-used feature it has. It also reuses what exists — the bulk-select bar on three screens for composing, and the themed-deck review loop, which shipped in 1.15.0. Mine, and it is the one planned feature I would call load-bearing for what the app is *for*.

<sub>`docs/roadmap.html`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
