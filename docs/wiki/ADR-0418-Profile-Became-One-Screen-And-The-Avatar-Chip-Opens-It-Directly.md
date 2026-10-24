# ADR-0418: Profile became one screen and the avatar chip opens it directly

Source of truth: this wiki page.

- **Area:** [§12 Shell, Navigation and Entry Points](ADR-Index.md#area-12)
- **Status:** Accepted
- **Version:** 1.4.1, completed 1.5.2

**Decided.** The chip's dropdown — Profile, User management, Log out — is gone. The chip opens Profile, and everything the menu offered is a section of it, including the admin user list.

**Why.** "My account" was a menu of screens rather than a screen, and the drawer repeated the same three rows underneath it.

**Reversal.** Finished a release later than it looked. 1.5.2 found the phone drawer's avatar was a decorative `aria-hidden` span with a separate Profile row further up — so the phone had two account entries and the one that looked most like the account was inert. The footer renders the same `AccountChip` the bars use now.

**Approved.** Mine, and I approved the second half as a completion of the first rather than a new fix.

<sub>1.4.1, completed 1.5.2 — `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
