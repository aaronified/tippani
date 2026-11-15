# ADR-0935: The AI census is retired for a plain disclosure

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted
- **The owner, 15 November 2026:** "The AI census can be retired in favour of a generic AI disclaimer."

**What was decided.** [How this was written](How-this-was-written.md) states that the repository was written with AI
assistance, that the app contains no AI, and that the git history, through its `Co-Authored-By:` trailers, is the audit
trail. It carries no figures. The block of counts stamped at one commit, the breakdown by model and the commands to
reproduce them are removed, and so is the release step that regenerated them (the claude-kit `ai_census.py --check`).

**Why.** Every figure was stale at the next commit, so each release began with a pull request whose only job was to
restamp it; the disclosure the page exists for was never in doubt. The statement is true of every commit, and the trail
that backs it is the history, which nothing needs to re-count.

**Rejected.** Keeping the census and automating the restamp in the release workflow (it needs the private kit's script
inside the repository, to keep a number current that no reader needed). Dropping the page (the app's no-AI claim lives there).

See also: [ADR-0628](ADR-0628-The-AI-Audit-Trail-Is-The-Git-History-Itself.md) · [ADR Index](ADR-Index.md) · [Home](Home.md)
