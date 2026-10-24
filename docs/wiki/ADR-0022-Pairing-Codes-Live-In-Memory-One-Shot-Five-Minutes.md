# ADR-0022: Pairing codes live in memory: one-shot, five minutes, look-alike-free

Source of truth: this wiki page.

- **Area:** [§2 Ownership, Authentication and Exposure](ADR-Index.md#area-2)
- **Status:** Accepted
- **Version:** `internal/httpapi/pairing_handlers.go`

**Decided.** `pairingTTL = 5 * time.Minute`, `pairingCodeLen = 8` over the 32-symbol Crockford-ish alphabet `0123456789ABCDEFGHJKMNPQRSTVWXYZ`, `maxPairingCodes = 64`, redeemed by deletion whether or not it had expired.

**Why.** The claim endpoint has to be unauthenticated — the phone has no credential yet, which is the whole point — so the code *is* the credential for those few minutes and is treated like one. Eight characters of a 32-symbol alphabet is 40 bits, trivial to brute-force unthrottled, which is why the claim route is rate limited and why the TTL is minutes. No I, L, O or U, so a code read off a screen cannot be mistyped into a different valid code. The modulo in `newPairingCode` is unbiased only because 256 is an exact multiple of 32, and the comment says so — an earlier version of that comment claimed rejection sampling, which the code has never done, and correcting a comment that lied is worth as much as fixing code. Codes live in a map rather than a table because they outlive nothing: a restart costs one tap, and it keeps a transient concern out of the schema and out of the backup archive.

**Reversal.** Eviction originally took the globally-oldest entry, so one account holding down "Pair a device" could evict everyone else's pending code. I got the scope wrong: I was thinking about the map, not about whose map it is. Eviction now prefers the minter's own oldest code and only reaches other users' when it has none of its own. Small on a family box, but a cross-user effect for no reason.

<sub>`internal/httpapi/pairing_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
