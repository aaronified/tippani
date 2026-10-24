# ADR-0736: The work detail's header gets air under the top bar

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted

*"the hero section leaves no gap from the top bar, which looks constricted."*

Measured before the fix: on a phone the hero's top and the shell bar's bottom were both
at 65px — touching exactly. The cause was `md:pt-4`, a Tailwind step that only applies
from 768px up, so the padding existed on a desk and nowhere else. It is `.screen-air`
now, `padding-top: var(--edge)`, both widths, and stated as the app's own constant rather
than a step typed into a class.

**The wider inconsistency is not fixed and is recorded instead.** Measured across every
phone screen: library, catalogue, quotes, anthologies and checks open 16px under the bar;
home, tags, metadata, stats, settings, search and bin open at 0. The 16 comes from each
of those screens' own first child rather than from the shell, so making all thirteen
agree means finding one owner for that step — which is a decision about the shell, not a
fix to a screen.

**And the hero's rhythm is uniform where it was measured to be.** The report was that the
vertical spaces are "highly uneven". The declared steps are honoured exactly: 11px between
the hero's blocks and 9px (7 on a phone, the pack's own number) between the facts, at
every child, at both widths. What is uneven is the INK: a row of pills carries ~10px of its
own padding inside its box, so a chip row reads ~31px from its neighbour where a text row
reads ~9px.

**WRONG TWICE, THEN MEASURED.** The two paragraphs that stood here recorded a fix that
made the column worse, and they are replaced rather than amended because their reasoning
is the thing to avoid. The claim was that the air a touch-sized row carries must be
subtracted back out of the rhythm, by one constant on the component — `--hero-pill-air`,
derived from `.tp-filter-chip`'s 34/44px height — so that the ink gap comes out at the
declared number against a text row and a chip row alike. It was asserted by a stylesheet
test and "verified by derivation rather than in a browser", which the entry itself flagged
as weaker. It was weaker in the way that mattered: it was not true.

**WHAT THE PROTOTYPE ACTUALLY DOES**, now that `docs/design/prototypes` carries the
`support.js` those files need and the pack renders. Its facts column at 1480px:

| row | box | air (top/bottom) | ink gap after |
| --- | --- | --- | --- |
| `Book · 1967 · Russian` | 13.0 | 0.5 / 0.5 | 9.5 |
| the title, over two lines | 67.2 | 0.0 / 0.6 | 9.6 |
| `satire magical realism …` | 12.0 | 0.0 / 0.0 | 9.0 |
| `128 quotes` | 23.0 | 0.0 / −1.0 | **24.0** |
| `Reading · 62%` · `read 3d ago` | 44.0 | **16.0 / 16.0** | — |

Two facts, and each is the opposite of what was recorded here:

**A TEXT ROW HUGS ITS INK.** Half a pixel of leading, so the declared 9px IS the seen gap.
The app's rows carried 2.0px top and bottom and so read 11.0 / 11.6 — the whole of the
error, and it is body leading applied to a header's one-line facts. The fix is one
constant, `--hero-lh: 1.15`, on `.work-hero-facts` beside the gap it has to agree with.
The title is deliberately not in that rule: WorkHero sets its leading inline on the `h1`,
so a rule aimed at it from the stylesheet loses and reads as though it worked — which an
earlier attempt did, silently, for a whole round.

**A THUMB TARGET IS LEFT BREATHING.** The pack's state row is 44px around a 12px chip with
16px of air each side, sitting 24px below the count. It is not compensated, and that is a
decision rather than an oversight: a touch target is not a line of type, and pretending
otherwise made that gap 7.1px — tighter than every text gap around it, which is exactly
why the column still read as uneven after the "fix". `--hero-pill-air` is deleted, and
`hero-rhythm.test.js` now asserts that NO child of the facts column carries a negative
block margin, so the idea cannot come back by hand.

**AND THE SHELF ROW IS ONE LINE AT EVERY WIDTH**, which was the largest single departure
from the pack's density and needed no new code. `ShelfControl` has always taken `compact`
— itself minus the full-width progress track — and the hero asked for it on a phone only.
So a desk header drew a chip, a second chip and a track three deep at 59.8px against the
prototype's 44px on one line. The hero passes `compact` unconditionally now. Nothing is
lost with the track: the compact chip carries the same percentage, the reads count becomes
the pack's own "read 3d ago" at the right end of the row, and the full history is in the
shelf popover either way.

**Measured in Chromium, on the app and on the pack, with the same script.** The earlier
entry's excuse — the harness drives Firefox, which this container cannot install — is
gone: `scripts/screenshots/` takes `--browser chrome` / `TIPPANI_BROWSER` now, defaulting
to Firefox so nothing changes for a machine that has one. One more trap worth recording,
because it invalidated a whole round of numbers before it was noticed: `--type-*` are
generated at runtime by `type.js`, not declared in the stylesheet, so a probe that mounts
a component without applying them measures a hero whose every font has fallen back to an
inherited size. The tell was `--type-display-30` — the hero's own title token — resolving
to nothing inside a `calc()`.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
