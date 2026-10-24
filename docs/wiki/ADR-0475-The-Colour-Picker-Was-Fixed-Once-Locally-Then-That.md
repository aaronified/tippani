# ADR-0475: The colour picker was fixed once locally, then that implementation was deleted the same day

Source of truth: this wiki page.

- **Area:** [§14 Boards, Cards, Charts and Popups](ADR-Index.md#area-14)
- **Status:** Accepted

**Decided.** A bespoke measured placement was written for the collapsed colour picker, and the app-wide primitive landed later the same day and removed it. **Why this is here.** The local fix was correct and it was wasted work, and the reason is worth keeping: I fixed the instance I was looking at instead of asking why the instance was broken. The answer — every popup in the app places itself in CSS — was one grep away and had been true for the whole life of the project. The general rule that comes out of it is the same one `personCreditSQL`, the orphan sweep and `facesOnAttribution` produced from the server side: when a bug is a class, fixing the member is the expensive way to find out. My call to write it, and my call to delete it hours later.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
