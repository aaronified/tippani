# ADR-0639: A reader's own picture and a fetched one are the same picture

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 2.2.0

**Decided.** `POST /cast/{id}/image` takes an optional `{"image_url": "..."}`. With a body it fetches that and replaces whatever is stored; without one it fetches the provider's URL only if nothing is stored yet. Both write `character_image_path`, which is the only column anything downstream reads.

**Why one route and not two.** "Fetched and reader-provided should work the same way" is a claim about what happens AFTER the fetch, and the cheapest way to make it true is to leave nothing downstream able to tell the difference: one column, one chip, one fallback. A second endpoint writing a second column would be two of everything and an invitation for the two to diverge — a chip that prefers one, an export that carries the other.

**The reader's picture survives every refetch, and that falls out of 0050 rather than needing a rule.** A stored path is not a provider fact, so 0048's merge never touches it while it goes on replacing `character_image_url` beside it. That asymmetry is the whole design: the provider owns what it said, the reader owns what is on disk, and a re-verify cannot quietly discard a choice somebody made. It is also what lets a character on a game or in a book — where no provider has ever had art — work by the same mechanism as one on a film.

**Two fetchers, and picking the wrong one fails quietly.** `fetchImage` enforces the provider host allowlist, which is right for a URL TheTVDB supplied and wrong for one a reader typed — their picture is wherever they found it, and the allowlist would refuse it with a message about a fetch failure. `fetchUserImage` is the no-allowlist path the person form already uses, with the same size and format checks. Provenance chooses, and it is the one place the two paths differ.

**Scheme-checked before either fetcher sees it.** `file://` and `data:` would be read by the SERVER, from the server's own disk, on behalf of whoever typed the URL.

<sub>2.2.0 — `internal/httpapi/cast_image_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
