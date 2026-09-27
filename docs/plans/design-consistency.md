# Consistent design, checked adversarially

Not built. Last in the queue. Verified against `75e55ae` (main, 28 September 2026; its code is
`ee4be1f`'s). Each citation is `path:line` and the text at that line. Like `screen-audit.md`,
this file ends as a list of findings for the owner to schedule, and is deleted when that list
is empty. Tasks, one per ask:

- [ ] Re-verify before the first capture, then correct what moved:
      `git diff --stat 75e55ae..HEAD -- web/frontend/src web/frontend/test/rules scripts/screenshots test/journeys/harness Makefile`,
      then `git grep -n` each quoted anchor below.
- [ ] Run one adversarial pass per principle below over every screen, at 390 and 1280, in
      light and dark, against the restored archive, on Chromium (`TIPPANI_BROWSER=chrome`;
      Firefox cannot be had in the container). A finder reports; independent refuters, told
      to refute and to default to refuted when unsure, vote; a finding survives on a majority.
- [ ] Every finder, refuter and capture runs on haiku, as the repo's model rule says for any
      fan-out and any screenshot run.
- [ ] A finding already on `screen-audit.md`, `codebase-audit.md`, `open-defects.md` or
      `prefetch-and-loaders.md` is cited there, not recorded twice.

The owner's principles, 27 September, each a pass:

- [ ] **1 · Consistency: the same visual means the same action or purpose.** Map every `Icon*`
      and every look-alike control to what it does; report a look with two meanings and a
      meaning with two looks. Builds on `one-verb-one-glyph.test.js:1`
      `// THE THREE VERBS STAY SPLIT. A source scanner, not a test.`
- [ ] **2 · Margins: the same on all sides, and the same throughout.** Measure each card's
      four insets in the browser; report a side that differs and a screen whose inset differs
      with no reason given. Builds on `spacing-debt.test.js:38` `const CEILING = 173` and the
      per-screen insets (`index.css:9326`
      `[data-screen-label="metadata"] { --meta-gap: 24px; --card-pad: 24px; --section-top: 0px; }`).
- [ ] **3 · Distinct, telltale icons, not used predominantly for anything else.** Count each
      glyph's meanings by call site; report a glyph whose second meaning is more than an
      occasional one, and any two glyphs that read alike at 20px. Builds on
      `glyphs-are-drawn.test.js`, and starts from the one reuse the app declares
      (`ui.jsx:10649` `// A SHOW AND A GAME REUSE THE PICTURES THE APP ALREADY HAS`).
- [ ] **4 · What is used more is reached more easily.** For each screen, name what a reader
      comes to do; count the presses and the scroll to reach it at 390 with `inReach`
      (`screen.mjs:563` `async function inReach(name, opts) {`); report a frequent action
      behind a door or below the fold, and a rare one in front of it.
- [ ] **5 · No lag between a press and its action; a wait says what it waits on.** Measure
      press to next paint for every press a screen offers, and report each over the limit
      below with its number; report every wait that does not name what it is waiting on.
- [ ] **6 · The GfG list** ([Principles of UI/UX
      Design](https://www.geeksforgeeks.org/techtips/principles-of-ui-ux-design/); the page is
      blocked from the container, so its list is taken from a search summary of it):
      Simplicity, User-centred design, Visibility, Consistency, Feedback, Clarity,
      Accessibility, Efficiency. One pass for each of the seven that pass 1 does not already
      cover.
- [ ] **7 · Whatever else is important**, one pass each: Nielsen's *user control and freedom*
      (every destructive press can be undone or escaped); *error prevention* (a disabled
      control says why, and a destructive one confirms); *help users recover from errors* (a
      failure names its `TIP-*` code and the next step); *recognition rather than recall*;
      WCAG 2.2 2.5.8, targets of at least 24×24 CSS px, beside the app's own 44 at 390
      (`controls.mjs:139` `const TOUCH_FLOOR = 44`); WCAG 2.2 2.4.11, focus not hidden;
      text contrast in both themes; nothing lost at 175% type (`make typescale`); nothing
      that depends on motion once motion is reduced.

The owner's answers, 27 September, each a task:

- [ ] A surviving finding is recorded, not fixed: the pass writes it under *Findings* below
      for the owner to schedule, as `screen-audit.md` does.
- [ ] The limits for pass 5: every press paints a visible response within 100 ms, and any wait
      over 1 s says what it is waiting on, by the job's name when it is a job. (Nielsen's
      0.1 s and 1 s response limits.)
- [ ] No roadmap card: this file is on the README's no-card table.

Decided while planning, so the pass needs nothing further:

- [ ] A finding line gives the principle, the screen and width and theme, what was seen, the
      measured number where there is one, `path:line` with its anchor at the commit the pass
      ran on, and the vote.
- [ ] The passes start from these leads, found and checked at the pin while planning; each
      still has to survive its refuters:
  - [ ] One look, two meanings: `.tp-empty` draws both "loading" (`StatsPage.jsx:1556`
        `<Card><p className="tp-empty" style={{ padding: '32px 0' }}>{t('common.action.load.busy')}</p></Card>`)
        and "nothing here" (`StatsPage.jsx:353`
        `<p className="tp-empty" style={{ padding: '16px 0' }}>{meta.empty}</p>`).
  - [ ] Insets that disagree: `--card-pad` falls back to 18px in one rule (`index.css:11004`
        `padding: var(--card-pad, 18px);`) and 16px in another (`index.css:11581`
        `padding: var(--card-pad, 16px);`), and a Home card is padded unevenly on its sides
        (`Home.jsx:224` `style={{ padding: '18px 6px 12px' }}`).
  - [ ] A disabled button only dims (`index.css:1616`
        `.tp-btn:disabled { opacity: .55; cursor: default; }`), and says nothing about why.
  - [ ] Forms whose ✓ carries no count: the ratchet allows 25 (`tick-pair.test.js:159`
        `` expect(missing.length, `no dirty count: ${missing.join(", ")}`).toBeLessThanOrEqual(25) ``).

## Findings

None yet. The pass writes them here.
