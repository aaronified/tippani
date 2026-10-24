# ADR-0669: A vocabulary that changed has to be chased into the copy and the stored keys

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 2.2.6

**Decided.** The Quotes help text names Kind, and a stored `medium` grouping is read as `kind`.

**Two more places the 0053 rename did not reach**, both of which a test cannot see: the help copy is prose in two language files, and the persisted grouping choice lives in the reader's browser. The second is the sharper one — the FILTER was deliberately given a new key so a stale value could not restore a filter that matches nothing, and the GROUPING was not, so a reader who had been grouping by Medium went on grouping by a column that still exists, beside a control showing no selection because the value is no longer one of its options.

**Read through a rename rather than re-keyed**, because unlike the filter the stored value has an exact successor: somebody who chose to group by what a quote IS still wants that.

**The pattern to check next time a field is replaced**: the column, the API, the forms, the cards, the export, the import, the staging queue, the search hit, the bulk editor, the help copy, the glossary, and every `usePersistedState` key that can hold its name.

<sub>2.2.6 — `internal/i18n/en.txt` · `internal/i18n/bn.txt` · `web/frontend/src/Quotes.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
