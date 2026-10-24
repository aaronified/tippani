# ADR-0493: The measured genre chip strip was abandoned for a single dropdown

Source of truth: this wiki page.

- **Area:** [§14 Boards, Cards, Charts and Popups](ADR-Index.md#area-14)
- **Status:** Accepted

**Decided.** Reversed. Genre was a strip of chips sized by measuring each chip's text width against the row's leftover space, with the overflow behind "More…". It is one dropdown now, with `All` as its first option. **Why I was wrong.** The row holds a dozen other controls whose widths change with the data, so the measurement was right only until something else moved — and the failure was a chip clipped mid-word against "More…", which reads as a rendering bug rather than as a layout running out of room. The phone case was worse and should have been the tell: inside the filter sheet the measurement always collapsed to zero, so the strip was a lone `All` chip above a dropdown holding every genre. Every genre is now one tap away instead of some being one and the rest two, and it matches how series, sort, group and shelf already read beside it. The general lesson is the same one Settings taught: measuring is the right tool when the question is about content, and the wrong tool when the answer has to be stable.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
