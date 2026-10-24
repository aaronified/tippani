# ADR-0543: Info dots are what the control does plus one consequence, and it is enforced

Source of truth: this wiki page.

- **Area:** [§14 Boards, Cards, Charts and Popups](ADR-Index.md#area-14)
- **Status:** Accepted
- **Version:** 1.13.0

**Decided.** An info dot's copy is capped at 240 characters and three sentences per branch, checked by `test/rules/infodot-copy.test.js`. Seventeen were rewritten; the longest went from 988 characters to 281.

**Why.** The five-word rule works — of 162 tooltip labels only five exceed it, each by one word — but it has an unbounded consequence nobody had noticed: longer copy was told to go and live in an info dot, and nothing ever constrained an info dot. They grew to 400, 700, nearly a thousand characters, and what filled them was consistently RATIONALE rather than instruction. One spent 680 characters on a switch whose behaviour takes 90.

**That reasoning already has a home — this file.** `docs/wiki/Design-decisions.md` exists to hold it at whatever length it needs. A popover attached to a control is not that place: it is read once, standing up, while the reader is deciding whether to press the thing.

**Mechanical, like the icon-geometry check, because "is this line necessary" is a judgement that quietly stops being made once nothing checks it.** Measured per BRANCH so a ternary whose book and film cases differ is not penalised for doing the right thing, and the suite asserts it found more than 25 dots — an extraction that silently matched nothing would turn the whole file into a no-op reporting success. It caught one of the rewrites at four sentences.

**Instead of.** Tightening the prose without removing any line (the padding IS the rationale, so it would not have fixed the feel). One sentence, hard stop (a few genuinely load-bearing warnings, like the password doubling as the backup key, would have had to move to the help screen rather than vanish).

**Approved.** The reader's, in the form "every line must pass a rigour test — is it absolutely necessary for the understanding?"

<sub>1.13.0 — `web/frontend/test/rules/infodot-copy.test.js` · `web/frontend/src/share.jsx` · `web/frontend/src/Account.jsx` · `web/frontend/src/Settings.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
