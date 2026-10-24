# ADR-0659: Who capitalises: the page, the keyboard, and the two of them disagreeing

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 2.2.4

**Decided.** Every field that capitalises its own value carries `autocapitalize="off"`.

**The question was "how phone keyboards know to capitalise after a fullstop in some apps … it doesnt do that in some other apps".** The answer is that both halves are true at once. The keyboard does it, and the PAGE tells it to: the HTML `autocapitalize` attribute takes `off` · `sentences` · `words` · `characters`, defaults to `sentences` for a text input, and is a hint to the SOFTWARE keyboard only — no effect on a desktop, none with a hardware keyboard. An app that does not capitalise has said `off`.

**Tippani had said nothing**, so on a phone the browser default ran underneath `capitalizeNames`. They agree almost always, which is why it never showed. They disagree on exactly the case the rule exists to protect: type "bell hooks" on a phone, the keyboard promotes the b before any of our code runs, and the promote-only rule then leaves it — because a word carrying a capital is somebody's decision. The reader is fighting a rule that is not in this codebase, and the field never goes `free`, so the hatch is shut.

**One thing decides, and it is the one that can be argued with.** Prose fields — a quote, a note — keep the default, where sentence capitalisation is what anybody wants.

<sub>2.2.4 — `web/frontend/src/ui.jsx` · `web/frontend/src/suggest.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
