# ADR-0694: A nav row names its container and its contents

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** Unreleased

- **Decided** — every rail and drawer row that leads to a collection carries two numbers
  joined by `|`: books|highlights, titles|lines, boards|quotes, anthologies|entries,
  tags|stickers, and imports|marks on Checks. The three utility rows keep one answer,
  because a gap count, a streak and a version are not containers.
- **One separator for all six.** The owner wrote `tags:stickers` with a colon and `|`
  everywhere else; a rail where some pairs use a bar and others a colon reads as two
  different kinds of fact, and they are the same kind.
- **The four new counts ride `/stats`**, which the shell already calls on load — four
  `count(*)` subqueries over indexed `user_id` columns in a statement that was going to
  run anyway, against four round trips and four more places for the rail and the screen
  to disagree.
- **`anthologies` was read and never sent.** `navBadge` has had `stats.anthologies != null`
  in it since the drawer was written and the endpoint has never carried the key, so that
  row has drawn no count for its whole life. The guard was right; the payload was missing.
  Found by needing the number, not by anything failing.
- **`/cleanup?counts=1`** is how the stray-marks count reached a permanent surface. The
  shell had *correctly* refused to ask for it: the scan reads every quote, and building
  500 findings and their work titles on every page load to print one number is the
  standing cost this app turns down. The counts arm runs the same three indexed reads and
  builds none of them. It is also **more accurate than the list it omits** —
  `maxCleanupFindings` stops the walk and takes the totals with it, and with no items
  there is nothing to cap.

<sub>Unreleased — `internal/httpapi/stats_handlers.go` · `internal/httpapi/cleanup_handlers.go` · `web/frontend/src/App.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
