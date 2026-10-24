# ADR-0721: Two verbs on the Settings dock, and a toggle that stopped moving

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** Unreleased

- **Settings has exactly two acts, and everything else on it is a preference.** You
  change a preference where it is drawn, so a dock key pointing at a toggle would be a
  door to a switch. "Make an archive now" and "install the release now" are different:
  both are verbs, and both live in admin-only cards six cards down a scroll on a phone.
- **The key skips the scroll and not the decision.** Backup still opens `BackupPrompt`
  and asks for the credential that seals the archive; the update still asks for the word
  UPDATE typed out — the server compares it byte for byte, and a one-tap update on a
  phone is precisely the accident that confirmation exists to prevent. The prompt runs
  the check on open, because a key that showed a stale "nothing to do" would be lying
  about the one thing it is for.
- **The card's inline confirmation and the prompt's are one field twice.** They share
  `confirm` and `apply`, so they cannot disagree; the sheet is a shortcut to the card,
  not a second implementation of it.
- **`PromptFrame` replaced four copies of one dialog.** The changelog dialog, the
  restore prompt and the backup prompt each ended with the same forty lines and had
  already drifted — one locked body scroll, one refused a scrim dismiss, one did
  neither. The differences are parameters now. It stays in `Settings.jsx` rather than
  moving to `ui.jsx`: the app's fifth copy of this frame is inside `FormModal`, which
  has a registered form and a ✓ in its header and is a different thing wearing the same
  coat. Pulling all five together is a change to every dialog in the app.
- **Stats: the activity toggle shared a wrapping row with a conditional link.** The
  reset is drawn on one of three streams, so selecting that stream re-laid the row out
  and moved the toggle — a control that moves because of what it was set to, which means
  the reader's next press lands on whatever slid into the gap. The row has two children
  now, always, and the reset sits after the grid it empties.

<sub>Unreleased — `web/frontend/src/Settings.jsx` · `StatsPage.jsx` ·
`internal/i18n/{en,bn}.txt` · `test/dom/settings-dock.test.jsx` ·
`test/dom/stats-activity.test.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
