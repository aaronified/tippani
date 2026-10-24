# ADR-0611: A composite map key uses an escape, never a literal NUL byte

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 1.5.1

**Decided.** `CoverPicker.jsx` joins its composite map key with `\u0000` rather than a literal NUL.

**Why.** Ripgrep classified the file as binary and omitted it from every repo-wide search; git classified it as binary too, storing it with CRLF while every other text file in the repo is LF, and giving "Binary files differ" instead of a line diff — so no blame, no merge, and only a choice between two whole copies. The built bundle is unchanged byte for byte, which is what makes it invisible.

**Approved.** Mine, and I approved it as a rule about source files rather than a fix to one.

<sub>1.5.1 — `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
