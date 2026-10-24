# ADR-0229: A feature nobody can find has not shipped

Source of truth: this wiki page.

- **Area:** [§7 Search and the Full-Text Index](ADR-Index.md#area-7)
- **Status:** Accepted
- **Version:** 1.16.0

**Decided.** The facet grammar shipped in 1.10.0 complete on every layer — parser, chips, vocabulary endpoint, SQL, URL round-trip — and 1.16.0 shipped a **Filters panel** beside the scope chips that does nothing new except make it visible. Nothing about the engine changed.

**Why.** The report was three words: *"I do not see search facets yet"*, then *"these should have landed before"*. Both were true at once, and that pairing is the whole finding. The only affordance the feature ever had was one placeholder string — `Search, or type tag: author: colour:…` — which is on screen until you type a single character and then gone. Using facets required having read that line, remembered it, inferred that the trailing `…` meant more fields than the three named, and guessed which. On a phone it sat over a keyboard that had just covered half the screen, with no tab key to complete with. So Tippani had a faceted search only its author could operate, and the correct description of that is not "shipped".

Two further things made it worse and are recorded because they are the same mistake in a second place. `docs/roadmap.html` §3 still listed **"Field operators"** as a coming feature fifteen releases after it shipped, and **"Highlight the matched words"** likewise — so a reader who could not find facets in the interface and went to the roadmap to check was told, twice, that they did not exist. §1 was carrying three more (the manifest surfaces, the app-icon badge, the rotating login epigraph). All five came out in 1.16.0. That is thirteen shipped items culled across two releases, all of them in the hand-written backlog, which `scripts/roadmap-data.mjs --check` cannot see — it validates only the generated sections.

**The rule the panel is built on.** It adds chips; it does not add a second grammar. Picking a value calls the same `makeChip`/`addChip` the dropdown calls, so a chip built by pressing is indistinguishable from one built by typing. `facets.js` opens by explaining why the syntax lives on one side only — *"a grammar the client parses for chips and the server re-parses for SQL is a grammar that drifts, and the drift does not announce itself"* — and a panel assembling its own query object would reintroduce exactly that, one file apart instead of one process apart.

**Instead of.** Counts beside each value, deferred at the time — see the next entry, which is where that got revisited and where the deferral turned out to be right about the principle and wrong about the price.

<sub>1.16.0 — `web/frontend/src/SearchPage.jsx` · `web/frontend/src/facets.js`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
