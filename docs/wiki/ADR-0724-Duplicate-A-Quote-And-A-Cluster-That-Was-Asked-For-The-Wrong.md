# ADR-0724: Duplicate a quote, and a cluster that was asked for the wrong name

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** Unreleased

- **§1.7 landed as a form, not a POST.** The pack is emphatic about why: "Nothing is
  created until Save: a duplicate you abandon is a duplicate that never existed." A
  reader duplicates a quote in order to CHANGE it, so the form is the point rather than
  a step after it — which also means no undo to own.
- **The words carry across**, which is the pack's call and reads like an oversight until
  you read its reason: "the reader is usually keeping most of a sentence and changing a
  clause, so an empty box would be a worse start than a full one."
- **`duplicateSeed` is keyed by the wire field name**, so the form does not have to know
  which fields a duplicate fills. Two conversions are the whole reason it is a function:
  a row's `tags` is an array and the box is a comma string, and `chapter_no` is a number
  or null while every box holds a string — `String(null)` is `"null"` and `Number(null)`
  is `0`, and 0 is a real chapter.
- **What is NOT seeded is not an omission.** The capture form has no translation, no
  language and no sticker box, so seeding them would put values in a draft nothing can
  show and nothing will send. The menu row's sub-line names what actually carries, for
  exactly that reason.
- **The seed's PRESENCE is what makes the surface a duplicate** — one fact, not a
  boolean beside the data that would let the two disagree. It is applied at
  initialisation rather than in an effect: an effect lands a frame after the first paint,
  which is a form a reader can start typing into and then watch overwrite itself.
- **The quiz's person chip was asked for the joined credit.** `PersonChip` looked the
  portrait up by the whole option string, so a co-written book asked for a person nobody
  is called. It splits and draws `CreditFaces` now — the same cluster the library, the
  catalogue and Home use, rather than a second overlap written here, because a cluster
  that drifted between the quiz and the library would be two answers to "who is this".
- **That needed `FaceStack` to move.** It lived in `people.jsx`, which is a SCREEN — the
  metadata panel, its form, its merge flow — and `people.jsx` imports `usePractice` from
  `review.jsx`, so importing it back would close a cycle. `credits.jsx` exists for
  precisely this (its own note: "that was fine until the quiz card wanted portraits"), so
  the three face components moved there and `people.jsx` re-exports them; the four
  existing call sites are untouched.
- **Settings' role label moved to the shell bar's sub-line.** `.page-header`'s `<h1>` is
  visually hidden on a phone — three copies of a screen's name is two too many — so the
  mono label beside it became the only thing in that header and took a sticky row to say
  one word. A caption for a title belongs under the title.

<sub>Unreleased — `web/frontend/src/actions.jsx` · `AddSurface.jsx` · `App.jsx` ·
`Library.jsx` · `review.jsx` · `credits.jsx` · `people.jsx` · `Settings.jsx` ·
`internal/i18n/{en,bn}.txt` · `test/pure/duplicate-seed.test.js` ·
`test/dom/duplicate-quote.test.jsx` · `test/dom/quiz-runner.test.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
