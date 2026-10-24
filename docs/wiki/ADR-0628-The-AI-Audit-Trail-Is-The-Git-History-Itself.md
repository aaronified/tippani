# ADR-0628: The AI audit trail is the git history itself

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 1.4.2 onward

**Decided.** Nearly every commit carries a `Co-Authored-By:` trailer naming the model that worked on it, the counts are published with the commands that reproduce them, and the four trailerless commits are accounted for one by one.

**Why.** A claim about provenance that cannot be checked is a claim. One trailerless commit adds attribution URLs to the README and was typed by hand; the other three are `github-actions[bot]` regenerating the roadmap's known-bugs block from the tracker, which is machine-written but not AI-written — and that distinction is the point of the file: a script that renders JSON into HTML is not a model making choices. The agent configuration under `.claude/` is gitignored, so what is published is the output, not the toolchain.

**Approved.** My call, and I approved naming the four exceptions individually rather than rounding the number.

<sub>1.4.2 onward — `How-this-was-written.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
