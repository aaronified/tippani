# ADR-0919: A highlight keeps its own location, and the file proposes the chapter

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted
- **Refines:** [ADR-0916](ADR-0916-A-Books-Location-Is-A-Percent-Of-This-File.md)

**What ADR-0916 decided.** For a book with an attached file, Checks proposes a chapter and a percent through ("42%") for each
highlight it can place. A highlight that already had a location was proposed a replacement of it, one press each, never in bulk.

**Why that was wrong.** It was reported as [#58](https://github.com/aaronified/tippani/issues/58): "the chapters and locations have
not come from the books". The scan, the reading of the EPUB and the stored positions all worked. The owner's database held 637
placed highlights, 635 of them word for word. But 558 of those already carried a Kindle location (a number such as `8856`), because
Kindle imports write one. Every one of those became a replacement of a Kindle location by a percent, so only 90 of the 667
proposals could be accepted together and the other 547 needed a press each. The chapter, which no highlight had (609 of 637 had
none), was tied to the same press. The reader saw hundreds of rows asking to swap one scale for another, and no way to say "just
fill in the chapters".

**What replaced it.**

- A highlight that has a location **keeps it**. A Kindle location or a printed page is a different scale from a percent of this
  file; neither is worth losing for the other, and a percent is a worse answer than the number the reader's own device wrote.
- The proposal for such a highlight carries the same location back unchanged and is about the **chapter alone**. It sits in the
  group that can be accepted together when the match was word for word, like any other exact proposal.
- A highlight with no location is still proposed the percent and the chapter together.
- A chapter the reader typed is theirs and is never replaced, as before.
- A press is refused as stale when the location moved between looking and pressing, as before.

**What it costs.** A reader who wants the file's percent in place of a Kindle location cannot have it from here. They would edit the
location by hand. That is deliberate: nothing in the app asked for it, and the reverse (losing a number the device wrote) cannot be
undone from a bulk press.

See [Source files and context](Source-Files-And-Context.md).

See also: [ADR index](ADR-Index.md) · [Home](Home.md)
