# ADR-0169: Cover art is upgraded at the URL level, preferring Amazon's keyless ISBN-10 CDN

Source of truth: this wiki page.

- **Area:** [§6 People, Credits and Metadata Providers](ADR-Index.md#area-6)
- **Status:** Accepted
- **Version:** `internal/metadata/amazon.go` · `internal/metadata/covers.go`

**Decided.** `AmazonCoverByISBN` converts an ISBN-13 to the ISBN-10 that Amazon's image CDN indexes by and requests the `_SCLZZZZZZZ_` variant; `AmazonFullSizeImage` strips the inline size modifier from any Amazon image URL so the stored file is the original scan; Google's is rewritten to a w1280-h1920 render. `maxImageBytes` was raised to 10 MiB and `minImageBytes` floors out placeholders.

**Why.** This is the trick book apps use for a hi-res cover when Google and Open Library only offer a thumbnail, and it needs no key — that host serves cover art openly. The bare `.01.jpg` returns a ~4 KB thumbnail while `_SCLZZZZZZZ_` returns the full-size cover, typically five times the bytes. The size caps had to move with it: the original 2 MB cap rejected exactly the full-size provider art this exists to get, so a cap written to bound abuse was silently bounding quality. A book Amazon does not stock returns a small "image unavailable" placeholder, which is what the minimum-size floor is for, so this is a source to *try* rather than a guaranteed hit. I approved raising the cap as part of the same change, because shipping the upgrade without it would have been a no-op dressed as a feature.

<sub>`internal/metadata/amazon.go` · `internal/metadata/covers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
