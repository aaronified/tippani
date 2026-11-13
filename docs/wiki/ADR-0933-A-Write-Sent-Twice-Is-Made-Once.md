# ADR-0933: A write sent twice is made once

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

**What was decided.** The create routes a queuing client uses (`POST /anthologies`, its `/sections` and `/entries`, `POST /annotations`,
`/dialogues` and `/quotes`) honour an `Idempotency-Key` request header. The key is **reserved before the handler runs**: the first request inserts a
pending row (migration 0093, per account), a repeat that arrives while it is still being made is told 409 with `Retry-After`, and the row becomes the
kept answer when the handler succeeds. A repeat of a finished request within a day is answered with that answer, marked `Idempotency-Replayed: true`,
and changes nothing. The same key on a different path is refused (422), a key over 100 characters is refused (400) so the client learns it is not
protected, and a refused or failed request releases its key so it may be sent again. A pending row older than two minutes belongs to a request that
died with the process and is replaced. API revision 11, feature `idempotency-key`.

**Why.** The Android app queues writes made with no signal and replays them in order. When a request reaches the server and the reply does not reach
the phone (a timeout, or the app killed between the send and saving its queue), the replay made a second anthology, heading or quote. A phone that
times out and resends while the first request is still running is the same case, which is why the key is reserved first and not looked up afterwards.
Only the client knows a request is a repeat, and the server is the only place that can make the repeat harmless.

**No timer.** A key is honoured for a day. The age is checked when the key is looked up, and rows past a day are deleted when the next key is
reserved, so an idle server costs nothing and the invariant that nothing wakes on a timer holds.

**Limits.** The key table is not part of an account snapshot (`accountSkipTables`): it is a memory of requests, not library content.

**Rejected.** A server-side hash of the request body, as quote creation does for duplicates: an anthology titled the same twice is
legitimate, so the body cannot say whether it is a repeat. Only a key the client chose can.

See also: [ADR index](ADR-Index.md) · [ADR-0932](ADR-0932-A-Quote-May-Be-Captured-By-Voice.md)
