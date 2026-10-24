# ADR-0547: A decade is a door; a year and a century are deliberately not

Source of truth: this wiki page.

- **Area:** [§14 Boards, Cards, Charts and Popups](ADR-Index.md#area-14)
- **Status:** Accepted
- **Version:** 1.13.2

**Decided.** A decade tick with something under it is a button opening that decade's works in Search, as is the "Most quoted decade" superlative. `bucketQuery(start, size)` returns the query or `null`, and it returns `null` at year and century scale. The chart asks with a zero-padded year (`0050s`); `parseDecade` learns BCE.

**Why.** Every other number on the Stats page opens the rows behind it — a breakdown row, a day on the activity calendar, seven of the eight superlatives. The chart answering "when is my library FROM" answered it and stopped, and the eighth tile named a decade and did nothing with it, though the server has understood `1990s` since the decade facet shipped. Nothing on the page ever asked it.

**The refusals are the design.** A bare year cannot go through the query box at all: `1984` is a book people own, and teaching search to read four digits as a span would take that search away to pay for this click — the search is worth more. A century is worse than unsupported, because `1900s` *parses*, as the decade: a column covering a hundred years would return ten of them and look like a complete answer. **A control that returns a confident wrong answer is worse than one that is not there**, because nothing on the wrong page says so. So the door exists exactly where the server can answer the column that was clicked.

**The shorthand would have misfiled the oldest thing in a library.** `90s` means the 1990s to the server, rightly, for somebody typing it. That makes the label unsafe to send: a column for the 50s CE — which a library holding a gospel really has — would have opened a shelf of mid-century paperbacks. The query is zero-padded because four digits cannot be a shorthand, and the facet still reports itself as `50s` because the server labels the range rather than echoing the query. The label is for reading and the query is for the server, and for a short year they are deliberately different strings.

**The parser learns BCE because the chart writes it.** A form the app produces itself and cannot read is a control that leads nowhere, and the one column it would have failed on is the one holding the oldest thing on the shelf. Nothing is titled "380s BCE", so no search is lost. The era also suppresses the two-digit shorthand on its own, since "80s BCE" cannot also mean the 1980s.

**Instead of.** Making every tick clickable (the century case would have been wrong, not empty). Adding a `year:` query syntax (a vocabulary to learn, for one click). Generalising the facet to any span (the bare-year collision survives it).

**Approved.** The reader's, in the form "and clicking on a decade should search for it as well."

<sub>1.13.2 — `web/frontend/src/StatsPage.jsx` · `internal/httpapi/search_handler.go` · `internal/httpapi/search_decade_test.go` · `web/frontend/test/dom/stats-timeline-link.test.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
