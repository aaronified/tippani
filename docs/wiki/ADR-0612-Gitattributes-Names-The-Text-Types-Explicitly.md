# ADR-0612: .gitattributes names the text types explicitly

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 1.7.4

**Decided.** The file lists the text types rather than relying on git's auto-detection.

**Why.** Auto-detection is precisely what failed: a lone CR made git call a correct text file binary, which switched normalisation off for the one file that needed it.

**Approved.** My call, and I approved the explicit list over trusting the heuristic a second time.

<sub>1.7.4 — `CHANGELOG.md` · `.gitattributes`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
