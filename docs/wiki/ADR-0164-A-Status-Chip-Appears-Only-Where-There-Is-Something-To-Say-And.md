# ADR-0164: A status chip appears only where there is something to say, and "working" is silence

Source of truth: this wiki page.

- **Area:** [§6 People, Credits and Metadata Providers](ADR-Index.md#area-6)
- **Status:** Accepted

<sub>These four entries decided the sources block's contents while it was a card on the Settings page. It is a section of the Metadata screen now — see *Where the facts come from lives beside the records it configures* — and every decision below is unchanged by the move; only the screen is different.</sub>

**Decided.** The chip row under Metadata sources carries a chip for a **failed** book lookup, and for TMDB running on the shared built-in key or on no key at all. A working lookup produces **no chip**, a lookup nobody has tried yet produces **no chip**, and the row itself is not rendered when both are absent.

**Why.** The chip had three states and one of them was "OK". A badge that is present exactly when there is nothing to do about it, and absent the moment there is, teaches the reader to look at a place that is empty in every case that matters — and it spends a row under the heading to say so. Silence is the healthy state; the heading's info dot explains that, so the absence is documented rather than merely quiet.

Dropping the whole row rather than leaving an empty flex box is the smaller half of the same point: a gap under a heading reads as a missing element, not as nothing to report.

**Instead of** keeping "OK" and toning it down — grey instead of green, or smaller. Rejected because the objection is not that it is loud, it is that it carries no information.

**Reversal (1.15.2).** "Untested" was kept in 1.7.9 on this reasoning, which I now think was wrong:

> **Instead of** dropping "Untested" with it. That one *is* information a key field cannot give: whether anything has been tried since the process started, which is the difference between "your key is fine" and "nobody has asked yet".

The distinction is real and the chip was still the "OK" mistake wearing a duller colour. `books_lookup.ok` is null until the first book lookup of a *process's* life, so the chip greeted every admin on a freshly started or freshly restarted server — the exact moment they are least sure the thing works — with a word that sounds like a warning, describes no fault, names nothing to do, and clears itself as soon as anybody uses the app. "Whether anything has been tried yet" turned out to be a fact about the server's uptime dressed as a fact about the reader's configuration. The owner asked for it to go; I agree with the ask, and the reasoning above is what it corrects.

**Approved.** Mine for the original chip cull; the owner's for the reversal.

<sub>1.7.9, revised 1.15.2 — `web/frontend/src/Settings.jsx` · `web/frontend/test/dom/settings-key-field.test.jsx` · `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
