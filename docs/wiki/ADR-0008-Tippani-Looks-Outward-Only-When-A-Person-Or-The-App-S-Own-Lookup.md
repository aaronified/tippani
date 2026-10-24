# ADR-0008: Tippani looks outward only when a person or the app's own lookup asks, and every call is a line in a log

Source of truth: this wiki page.

- **Area:** [§1 The Target Host, the Budgets, and the Scope They Fix](ADR-Index.md#area-1)
- **Status:** Accepted
- **Version:** pre-1.0; reworded 3.1.0

**Decided.** There is no scheduled or ambient outbound traffic. Metadata lookups (Google Books, Open Library, TMDB, TheTVDB, Wikidata) run when somebody asks for them — a search in Add, a Fetch, a save with a cover address, a fill, a re-verify — and the GitHub release check runs only when an admin presses the button. Pushover is told only what a reader set it up to hear, and there are four things it can be told: an import large enough to be worth a message, staged for review or approved into the library; a long metadata run of theirs finishing; a backup written; and the daily deck, which `tippani notify daily` sends when the host's cron runs it. Its test message goes when the reader presses for one. The app's own lookups are the ones a screen makes for what it is about to draw: a work page asks for the portraits and character pictures it has no file for. Cover and portrait fetches go through a host allowlist behind an SSRF guard and are then served from local disk, never hotlinked. **Every call that leaves is a line in a log** — method, host, path and query, then what came back, and no key in it — in the job that made it, or in the system log, tagged `[outbound]`, when no job did. `TIPPANI_OFFLINE` refuses them all except sign-in to the operator's own provider, and a refusal is logged like a call.

**Why.** It follows from the rule that nothing wakes on a timer, and it is also the honest reading of "self-hosted". A CSP of `default-src 'self'` with nothing external is what makes it checkable from the browser side, and since 3.1.0 the log makes it checkable from the server side: an operator who wants to know what left the box reads it, rather than trusting this entry.

**Reversal.** In wording, in 3.1.0, and the wording had been wrong for a while before that. This entry was *"Tippani never contacts the network on its own — every outbound call is one you triggered"*. A work page had been fetching faces nobody pressed for since 2.2.4, from the browser; 3.1.0 moved that onto the server as one request and made it, like every other call, a line somebody can read. "One you triggered" had stopped being true without anybody deciding it should.

**Approved.** I approved this and I approved saying it plainly in `How-this-was-written.md` rather than leaving it to be inferred from the absence of code. The heading is drawn from my invariant sentence, *"nothing runs unless a person or the app's own lookup started it, and nothing wakes on a timer"*, which is mine word for word; the heading carries it from what runs to what leaves the box. The reading that the heading is narrower than it looks — that the app may look for what is on a screen somebody opened, and for nothing else — is the builder's. I left the ruling to the session, which kept it as built on 28 September (F13, in §18).

<sub>pre-1.0; reworded 3.1.0 — `How-this-was-written.md` · `README.md` · `internal/outbound/outbound.go` · `internal/jobs/outbound.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
