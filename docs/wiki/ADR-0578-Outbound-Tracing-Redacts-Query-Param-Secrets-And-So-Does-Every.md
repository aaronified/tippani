# ADR-0578: Outbound tracing redacts query-param secrets, and so does every error a call returns

Source of truth: this wiki page.

- **Area:** [§16 Serving and Running It: HTTP Surface, Logging, TLS and Updates](ADR-Index.md#area-16)
- **Status:** Accepted
- **Version:** 0.6.4; one list 3.1.0

**Decided.** Every outbound provider call logs at trace level — `[trace] [meta] GET … -> 200 (N bytes)` — and the URL passes through `outbound.Redact` first, which replaces the value of every query or fragment parameter on one list with `…` and drops any `user:password@`. The list is twenty-two names: `key` and `api_key` (the Google Books and TMDB v3 keys, the only two providers here that put a credential in the query string), the other common spellings of a key, a token, a secret, a password, a signature, `auth` and `code`, and the S3 and Google Cloud Storage presign names, for a cover address a reader pastes in. The v4 TMDB token and the TVDB JWT travel in the `Authorization` header and so are structurally absent from a trace — not redacted, absent, which is the stronger property and the reason I prefer header auth where a provider offers both. `Redact` works on the text rather than through `url.Parse`, so a URL too broken to parse is still redacted, and everything but the hidden values stays byte for byte. **And the error a failed call returns is redacted where the client makes it** (`outbound.RedactError`, in `httpGet`, `httpPost` and the other clients that call out): Go's `*url.Error` quotes the whole URL, and that text went on up to handlers that printed it and to 502 messages that showed it. Tracing itself is a no-op unless `TIPPANI_LOG_LEVEL=debug`. I approved the redaction and the no-op gate together, because a trace that is expensive is a trace nobody turns on.

**Instead of.** Logging the URL whole at debug level, on the theory that debug logs are private. They end up in bug reports. Redacting in the handlers that print a failed call's error: there are dozens, and the next one would be written without it.

**Reversal.** In 3.1.0. This entry described `redactURL`, which knew two names, masked them as `***` by re-encoding the query, and returned an unparseable URL as it was. Logs kept for thirty days and exported for somebody else to read made a second, longer list necessary, and two lists of secret names had already grown apart; `redactURL` went and `outbound.Redact` is the one list, used by the trace, by the log's own door (§18) and by the error text.

<sub>0.6.4; one list 3.1.0 — `internal/outbound/redact.go` · `internal/metadata/metadata.go` · `internal/olog/olog.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
