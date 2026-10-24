# ADR-0165: The IGDB pair gets two rows and one warning, and the warning is only for half a pair

Source of truth: this wiki page.

- **Area:** [§6 People, Credits and Metadata Providers](ADR-Index.md#area-6)
- **Status:** Accepted
- **Version:** 1.15.3

**Decided.** The Metadata screen's Sources section carries an **IGDB client id** and an **IGDB secret** row, write-only like the other secrets and saved independently. Neither set renders nothing. Exactly one set renders a line naming the blank half.

**Why it was missing, which is the part worth recording.** 1.15.1 shipped the games board, the IGDB lookup, the settings *endpoint* (`igdb_client_id` / `igdb_secret`), a GET that reports the halves separately, and an Add-sheet warning naming the screen to go and fix it on. The two rows on that screen were the only piece that did not land, and nothing failed: the handler had tests, the lookup had tests, the warning had a test, and the reader had no field. **Games were the one feature in the app whose key could only be set by editing the database** — while every layer under it reported itself healthy.

The GET's own comment had been describing this card since the release before it existed: *"Reported separately rather than as one `igdb_key_set`, so the Settings card can point at the half that is missing."* A comment about a caller is not a caller.

**Why no chip for "unset".** There is no shared built-in for IGDB the way there is for TMDB — the credentials are per-application and rate-limited to 4 req/s, so a key shipped with the app would be a shared quota — which means **unset is the ordinary state of every instance** until somebody registers a Twitch app. A standing chip for that is the "Untested" mistake with a new label, decided one entry above.

**Why a warning for half a pair.** That state is not ordinary and is not self-evident. It fails at the Twitch token exchange with "invalid client", which surfaces as a lookup failure — so the reader is told games are broken when one box is blank. It is the only IGDB state with something to act on, and it is exactly what the split booleans were reported for.

**Instead of** one combined "IGDB credentials" field taking `id:secret`. Rejected because correcting a mistyped secret would mean re-entering the id, which is the reason the server saves them independently in the first place.

**Approved.** The owner's: "Games apparently need IGDB key, but there is no option in metadata sources for that!"

<sub>1.15.3 — `web/frontend/src/Settings.jsx` · `web/frontend/src/help.jsx` · `internal/httpapi/metadata_handlers.go` · `web/frontend/test/dom/settings-key-field.test.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
