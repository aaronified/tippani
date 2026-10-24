# ADR-0349: The photo taken for OCR is worth keeping, attached to the quote

Source of truth: this wiki page.

- **Area:** [§9 Import and the Staging Queue](ADR-Index.md#area-9)
- **Status:** Accepted
- **Version:** ?

**Decided.** One nullable path column on the image pipeline that already stores covers, posters, portraits and stickers.

**Why.** The correction screen already holds the photo beside the text, and keeping it "keeps the evidence next to the transcription for the next time you doubt a line".

**Instead of.** Discarding the photo after transcription — rejected.

**Approved.** Mine, and I approved it on the cost: the pipeline already exists, so the whole feature is one column and a path.

<sub>?</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
