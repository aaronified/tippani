# ADR-0715: A deadline that cannot reach the connection fails by doing nothing

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** Unreleased

*Found while investigating "I cannot update from Settings — it sometimes works in a
browser on the server, almost never from another device."*

- **The reported symptom was the smaller half.** `handleUpdateApply` pulls two images and
  creates a container before it writes a byte. It budgeted itself ten minutes from
  `r.Context()` — and that context dies with the CONNECTION. A request that sends nothing
  for minutes is precisely the one an intermediary abandons: a sleeping phone, a Wi-Fi
  roam, a reverse proxy's own read timeout, a closed tab. Over loopback on the box itself
  that essentially never happens; from another device it happens routinely, and the pull
  was simply dropped with nothing in the log after the `APPLY requested` line.
  `context.WithoutCancel` keeps the request's values and drops only the cancellation, so
  the ten minutes is the real bound and **no goroutine outlives the request** — the
  handler still does the work and still answers, to whoever is left listening.
- **The larger half was that the repo's existing fix for this had never worked.** The
  server sets `WriteTimeout: 60s`, and three handlers cleared it with
  `http.NewResponseController(w).SetWriteDeadline(time.Time{})`, each with a comment
  saying why. **All three were no-ops.** ResponseController walks the writer chain by
  calling `Unwrap()`; this package wraps every response twice — `logRequests` →
  `statusRecorder`, `gzipResponses` → `gzipResponseWriter` — and neither implemented it,
  so the controller ended its walk at the wrapper and returned `http.ErrNotSupported`.
  Every call site discards that error with `_ =`, because there is nothing useful to do
  with it. Probed both ways round before changing anything: with `Accept-Encoding: gzip`
  and without, the answer was `feature not supported`.
- **So a restore of a large library could not report its own success and a multi-GB upload
  died at the 30s `ReadTimeout`** — both with a comment in the source saying the opposite.
  This is the failure mode worth naming: a fix that is *present, commented, and inert*.
- **Guarded twice, for two different readers.**
  `TestEveryResponseWrapperCanBeUnwrapped` fails with a message naming the consequence, so
  the next person who adds a wrapper learns what they broke;
  `TestTheWriteDeadlineReachesTheConnection` builds the real chain over a real connection
  and asks with gzip and without, because a fix to one wrapper and not the other passes
  for browsers and fails for everything else. `gzipResponseWriter` also carries a compile-time assertion for the
  `Unwrap` shape — the method is found at runtime by shape, so dropping it otherwise
  breaks nothing that builds.
- **One update at a time**, via `TryLock` → 409. Two applies race two one-shot recreaters
  at the same container, and pressing the button again is the natural response to an
  update that appears to have done nothing — which, before the above, is exactly what it
  appeared to have done.

<sub>Unreleased — `internal/httpapi/update_handlers.go` · `server.go` (`statusRecorder`) ·
`gzip.go` · `web/frontend/src/Settings.jsx` ·
`internal/httpapi/response_controller_test.go` · `update_test.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
