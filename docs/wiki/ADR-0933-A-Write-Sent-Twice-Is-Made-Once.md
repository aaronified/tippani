# ADR-0933: A write sent twice is made once

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

**What was decided.** The create routes a queuing client uses (`POST /anthologies`, its `/sections` and `/entries`, `POST /annotations`,
`/dialogues` and `/quotes`) honour an `Idempotency-Key` request header. The first request with a key is run and, if it succeeded,
its answer is kept with the key, the method and the path (migration 0093, per account). The same key with the same method and path
within a day is answered with that answer, marked `Idempotency-Replayed: true`, and changes nothing. The same key on a different
method or path is refused (422). A refused or failed request is not kept, so it may be sent again and succeed. API revision 11, feature
`idempotency-key`.

**Why.** The Android app queues writes made with no signal and replays them in order. When a request reaches the server and the
reply does not reach the phone (a timeout, or the app killed between the send and saving its queue), the replay made a second
anthology, heading or quote. Only the client knows a request is a repeat, and the server is the only place that can make the repeat
harmless.

**No timer.** A key is honoured for a day. The age is checked when the key is looked up, and rows past a day are deleted when the next
key is written, so an idle server costs nothing and the invariant that nothing wakes on a timer holds.

**Limits.** Two requests with the same key in flight at once can both run; a client that queues its writes sends them one at a time.
A key is not kept for a request that failed, which is the right side to err on: the client sends it again.

**Rejected.** A server-side hash of the request body, as quote creation does for duplicates: an anthology titled the same twice is
legitimate, so the body cannot say whether it is a repeat. Only a key the client chose can.

See also: [ADR index](ADR-Index.md) · [ADR-0932](ADR-0932-A-Quote-May-Be-Captured-By-Voice.md)
