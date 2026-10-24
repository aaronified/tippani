# ADR-0099: The bulk field editor named the third quote kind twice, and answered 400 to every field it has

Source of truth: this wiki page.

- **Area:** [§4 What a Quote Is](ADR-Index.md#area-4)
- **Status:** Accepted
- **Version:** 2.2.0

**Decided.** `quoteFieldKinds` now spells the standalone-quote kind `utterance`, which is what `bulkTag` is actually called with, and a test walks it against `quoteBulkKinds` so a third spelling cannot be introduced quietly.

**What was wrong.** Two tables in `bulk_handlers.go` name kinds, deliberately and with a comment explaining that they answer different questions — but one called the third kind `utterance` and the other called it `quote`. `POST /quotes/bulk` therefore answered *"speaker does not apply to this kind"* to `speaker`, `occasion`, `place`, `medium` and `note`, for a kind that has all five columns, while the client's own `BULK_QUOTE_FIELDS` offered exactly those four. Every per-field bulk edit on the Quotes screen was a 400 from the day the endpoint shipped.

**It was invisible for the usual reason.** "Does not apply to this kind" is a legitimate answer for some other kind, so the response looked like a rule working rather than a name mismatch — and no test set a per-kind field on that endpoint.

**And it was hiding a second fault.** `speaker`, `occasion`, `place` and `medium` have been NOT NULL with an empty-string default since 0026, while every text field in this file is written through `nullable()`, which maps the empty string to NULL. So *clearing* any of them over a selection is a NOT NULL violation — a 500, from inside the transaction, after the ownership check. Fixing the 400 uncovers it, so both are fixed together: shipping the first alone would replace a 400 with a 500, which is worse than either. `notNullQuoteCols` is the list, and it names why the genuinely nullable columns are absent from it.

**Approved.** Mine. Found by the test written for 0047's four new quote fields, which would have been dead on arrival under the old spelling.

<sub>2.2.0 — `internal/httpapi/bulk_handlers.go` · `internal/httpapi/bulk_fields_test.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
