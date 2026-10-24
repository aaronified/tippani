# ADR-0162: A rejected key is reported as a rejected key

Source of truth: this wiki page.

- **Area:** [§6 People, Credits and Metadata Providers](ADR-Index.md#area-6)
- **Status:** Accepted

**Decided.** `ErrTMDBAuth`, `ErrTVDBAuth` and `ErrQuota` are distinct sentinels, and each produces its own message naming the remedy. Everything else gets the generic "lookup failed" with the real cause logged.

**Why.** "Try again in a moment" is false when the answer is that the credential is wrong, and it costs the reader an afternoon of retrying. So TMDB's 401 says a v4 token starts with `ey` and asks for the v3 API key, since pasting the wrong one of the two is the actual mistake people make. Google's quota case says whether *your* key was rejected or the shared free quota is exhausted, and gives the one-step remedy for each. The client still never sees a provider's raw error — that goes to the log with the ISBN and title — because a provider message is not written for this reader. My decision, and it is the same principle as the 404-not-403 rule pointed the other way: say what is true and useful, not what is safe and empty.

<sub>`internal/httpapi/lookup_handlers.go` · `internal/metadata/tmdb.go` · `internal/metadata/tvdb.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
