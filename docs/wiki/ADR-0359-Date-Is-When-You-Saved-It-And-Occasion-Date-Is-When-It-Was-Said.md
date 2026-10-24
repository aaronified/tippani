# ADR-0359: date is when you saved it and occasion date is when it was said

Source of truth: this wiki page.

- **Area:** [§10 What Leaves the App: Exports, Round-Trips and the Shared Image](ADR-Index.md#area-10)
- **Status:** Accepted
- **Version:** `internal/httpapi/export_quotes.go` · `internal/httpapi/export_handlers.go`

**Decided.** Two keys, never folded together. `date` matches the book export's key and carries `noted_at`, truncated to `YYYY-MM-DD`. `occasion_date` carries the partial date the quote was spoken — `YYYY`, `YYYY-MM` or `YYYY-MM-DD`.

**Why.** They are two different facts and a single `date` key would silently merge them, producing a file in which a 1944 broadcast is dated to the afternoon you typed it in. Keeping the saved-date key spelled the same across all three exports is what lets one parser read all three. The partial form is preserved rather than normalised, because a text with a contested date has a contested date and saying so is more honest than inventing a day. I approved the two keys knowing it makes the file slightly noisier.

<sub>`internal/httpapi/export_quotes.go` · `internal/httpapi/export_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
