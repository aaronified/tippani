# ADR-0293: TheTVDB's free key logs in with a PIN, and a refused supplier is said out loud

Source of truth: this wiki page.

- **Area:** [§8 The Review Loop](ADR-Index.md#area-8)
- **Status:** Accepted
- **Version:** v3.0.0

**Decided.** `TVDB.PIN` is sent in the login exchange when it is set and OMITTED when it is not, stored as its own write-only setting. And a film lookup that got hits from one supplier while the other REFUSED THE KEY now carries a `warning` naming that, which the picker prints above the results.

**Why the key looked inactive and the app looked fine.** TheTVDB issues two kinds of v4 credential: a project key authenticates with the key alone, and the free user-supported key authenticates only with the subscriber's PIN — their own dashboard calls such a key "inactive" until a subscription stands behind it. The client sent `{apikey}` and nothing else, so every user-supported key 401'd at login. The reader's report was the exact shape of that: *"TVDB says the API key is inactive! but i can search TVDB from the app!"* — both halves true, and the second one was TMDB.

**Why the silence was the worse half.** The partial-failure rule (surface an error only when NOTHING came back) is right: one supplier being down must not hide the other's hits. But it made a rejected key indistinguishable from a working one, because the failure mode of "TheTVDB refused" is "a full picker of TMDB results". A warning beside results is a different thing from an error instead of them, and only an AUTH failure earns one — a timeout is noise the reader can do nothing about, and a line under every search trains them to ignore the one that matters.

**Omitted rather than empty.** TheTVDB refuses an empty `pin`, so always sending the field would break the credential that works today in order to support the one that does not.

**Approved.** The reader's report, and my reading of the two halves as one defect.

<sub>v3.0.0 — `internal/metadata/tvdb.go` · `internal/metadata/tvdb_test.go` · `internal/httpapi/lookup_handlers.go` · `internal/httpapi/metadata_handlers.go` · `internal/httpapi/tvdb_pin_test.go` · `web/frontend/src/CoverPicker.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
