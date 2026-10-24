# ADR-0097: A seventh quote kind, on the sixth's mechanism

Source of truth: this wiki page.

- **Area:** [§4 What a Quote Is](ADR-Index.md#area-4)
- **Status:** Accepted
- **Version:** 3.1.0

**Decided.** `song` joins the seven. Migration 0068 is 0067's six statements — park, drop, rename — a day apart, and that repetition is the argument for the shape rather than a coincidence: the vocabulary is now known to grow, and each widening must stay cheap and safe rather than being 0029's table rebuild each time.

**Why it is not a poem.** One is read and the other is sung, and a library that files Tagore's songs under his poems has lost the distinction its owner keeps them for. 0026's `medium` column already listed "song" among the values it expected, so a reader who has been here since then may have `medium = 'song'` on rows the one-time pass declined to fold — those cards have been showing the leftover text ever since, which is what made it visible as work to do.

**Approved.** Mine, on the owner's "you have added poem, add songs too".

<sub>3.1.0 — `internal/store/migrations/0068_quote_kind_song.sql` · `internal/httpapi/utterance_handlers.go` · `web/frontend/src/quoteKind.js` · `internal/i18n/en.txt` · `internal/i18n/bn.txt` · `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
