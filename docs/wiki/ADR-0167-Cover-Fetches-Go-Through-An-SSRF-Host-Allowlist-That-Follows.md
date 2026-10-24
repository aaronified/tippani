# ADR-0167: Cover fetches go through an SSRF host allowlist that follows redirects

Source of truth: this wiki page.

- **Area:** [§6 People, Credits and Metadata Providers](ADR-Index.md#area-6)
- **Status:** Accepted
- **Version:** `internal/metadata/covers.go` · `docs/wiki/Design-decisions.md`

**Decided.** `coverHosts` is the allowlist, checked on the initial URL *and* on every redirect target, with at most two redirects. `blockPrivateAddr` runs as the dialer's `Control` function, so loopback, private, link-local and unspecified addresses are refused at connect time. A user-typed URL drops the host allowlist and the https-only rule; every other guard still applies.

**Why.** Checking only the first URL is the classic hole — a permitted host that redirects to `169.254.169.254` is a permitted host. Checking at dial time rather than after a DNS resolution closes the rebinding gap, because the address the guard sees is the address the connection uses. The allowlist has grown honestly: `archive.org` and the `iaNNNNNN.us.archive.org` pattern are there because Open Library's cover service redirects through them and without them every OL cover died silently on the redirect hop. Two Amazon hosts, two Wikimedia hosts, TVDB's artwork host — each carries a comment saying which feature needs it. The relaxation for a pasted URL is deliberate and narrow: the user may point at any image host, but the private-IP guard, the size cap, the sniff and the redirect limit are not theirs to disable. I approved each host addition individually rather than widening the rule.

<sub>`internal/metadata/covers.go` · `docs/wiki/Design-decisions.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
