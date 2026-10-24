# ADR-0419: Switching accounts is laid out as the sibling of the log-out beside it

Source of truth: this wiki page.

- **Area:** [§12 Shell, Navigation and Entry Points](ADR-Index.md#area-12)
- **Status:** Accepted
- **Version:** 1.7.2

**Decided.** The two ways out of an account share one row and one plan. The form names the account you are leaving, uses real labels rather than placeholders, and puts the reason a button is grey beside the button.

**Why.** They were built to different plans — a heading over a full-width button here, a right-aligned button there — for one kind of action. The account being left is the one fact the form is about and it was nowhere on it. The disabled reason lived only in a `title` attribute, which a touch screen has no way to show, so on a phone the button was grey and silent.

**Approved.** My call, and I approved the `title`-only pattern being treated as a bug wherever else it appears.

<sub>1.7.2 — `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
