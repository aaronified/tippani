# ADR-0668: The reply is the answer, unless the filter disagrees

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 2.2.6

**Decided.** A one-field save splices the PUT's reply into the board, and refetches only when the change moves the row out of the filter in force.

**What was wrong.** `patch` is the ♥, the colour dots and a sticker drag — the most frequent interactions in the app — and each one did a PUT whose reply carried the updated row and then a full `GET /annotations` to learn what the reply had just said. Two serialised round trips where one had all the information.

**This contradicts 2.2.3's own analysis**, which measured the server honestly, concluded correctly that the cost is round trips rather than work, and then said there was exactly one duplicate read. There were two, and this was the hotter by a wide margin. Counting requests on the path the user is watching is only useful if you count the path they actually use.

**The refetch is still right sometimes**, which is why this is a guard and not a deletion: the filters are applied by the server, so un-hearting a row while the favourites filter is on has to take it off the board. `patchMovesTheRow` is exported and pure so that rule can be read and argued with, rather than living inside a closure — and it asks about the FILTERS IN FORCE, not about the fields, because changing a colour while no colour filter is on moves nothing.

<sub>2.2.6 — `web/frontend/src/Library.jsx` · `web/frontend/src/Quotes.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
