# ADR-0684: Two placeholder findings, reported rather than fixed

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** Unreleased

- **Decided** — `people.jsx` draws the `.ph` cover hatch where a person's portrait
  belongs, and an empty cast face draws a flat grey box. Neither was changed.
- **Why** — the rule says a missing person is a silhouette and a missing anything-else is
  the hatch, and that "a hatch where a face belongs reads as a broken tile". The person
  panel is a real violation of it. But the fix needs a silhouette drawing: the pack claims
  `assets/person-silhouette.svg` is already committed here and it is not, and the owner
  has since said the person assets are unavailable and to skip them. The cast face is a
  different matter — its flat box is a DOCUMENTED decision in this repo ("a role without
  one says so permanently"), and the repo's own rule is that where it already has a
  component, the repo's name wins. Overriding a recorded decision with a rule from the
  pack, unasked, would be the wrong way round.
- **Approved** — reported to the owner as findings at the end of the standing-rules pass.

<sub>Unreleased — `web/frontend/src/ui.jsx` · `web/frontend/src/index.css` · `web/frontend/src/tokens.js` · `web/frontend/src/cast.jsx` · `web/frontend/src/Account.jsx` · `scripts/screenshots/typescale.mjs` · `web/frontend/test/dom/edge-fade.test.jsx` · `web/frontend/test/dom/entrance-rule.test.jsx` · `web/frontend/test/rules/spacing-debt.test.js`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
