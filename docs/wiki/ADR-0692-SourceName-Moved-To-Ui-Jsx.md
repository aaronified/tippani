# ADR-0692: sourceName moved to ui.jsx

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** Unreleased

- **Decided** — the supplier-name table lives in `ui.jsx`; `CoverPicker.jsx` and
  `ReverifyReview.jsx` import it. It gained `imdb`, `wikipedia` and `manual`.
- **Why** — it was right in `CoverPicker` while a supplier was only named on a cover
  candidate. Per-field provenance names one on every field row, and two tables of supplier
  names is how a picker and a field row come to call one company two things.

<sub>Unreleased — `web/frontend/src/providerMarks.js` · `web/frontend/src/ui.jsx` · `web/frontend/src/WorkDetails.jsx` · `web/frontend/src/CoverPicker.jsx` · `internal/httpapi/book_handlers.go` · `internal/httpapi/movie_handlers.go` · `docs/wiki/Provider-marks.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
