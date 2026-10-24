# ADR-0186: The Amazon cookie is opt-in, write-only, and its risk is stated rather than softened

Source of truth: this wiki page.

- **Area:** [§6 People, Credits and Metadata Providers](ADR-Index.md#area-6)
- **Status:** Accepted
- **Version:** `README.md`

**Decided.** An admin may paste an Amazon session cookie to enrich book metadata by scraping; off by default, stored write-only, never shown back.

**Why.** Book covers (the keyless image CDN) and Kindle highlight import (a file you export) both work with no cookie, so nothing core depends on it. The warning says plainly that the cookie grants access to your Amazon account and that automated scraping is against Amazon's Conditions of Use: the account whose cookie you supply bears that risk, so only you can decide to enable it. Tippani never ships, shares or centralises it, and only ever uses it on your behalf. I approved shipping the feature only with the warning at full strength — softening it would have been the same as shipping it on by default.

**Instead of.** Enabling it by default, or omitting the risk statement — refused.

<sub>`README.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
