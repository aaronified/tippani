# ADR-0619: The roadmap has no curated list — labels decide the page

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 1.3.2

**Decided.** Known bugs, accepted requests and Later / maybe are generated from the issue tracker. `bug` + `accepted` for a bug, `enhancement` + `accepted` for a request, `enhancement` + `considered` for something parked. Applying a label needs Triage.

**Why.** There is no curated list left in the repo to drift out of step: I cannot add an entry without agreeing to it in public, and I cannot forget to remove one, because closing the issue removes it. Promotion out of Later / maybe is a label edit on the same issue, keeping the same thread of argument. The Triage gate matters because the roadmap is a public page — an ungated pipeline would put a stranger's title and body on it within a minute. Issue text is escaped, fenced blocks dropped, only paragraphs, lists and `code` spans emitted — but no amount of escaping makes a wrong report right, and that judgement is not something to automate. Prose stays mine where it matters: per-issue `overrides` in the data files replace whatever the form produced, and automation cannot touch them.

**Approved.** Mine, and I approved acceptance being a human step on purpose.

<sub>1.3.2 — `CHANGELOG.md` · `How-this-was-written.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
