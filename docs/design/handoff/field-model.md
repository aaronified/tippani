# What the spec changed in this prototype

Read against `Book Detail.dc.html`. Corrections applied, in order of how much they
changed the design rather than the code.

## 1. The kind question is gone from the form

The Kind chips (Speech · Essay · Letter · Saying) came off. The board owns the kind, so
by the time a capture form opens, its shape is already decided — asking again was the
"wrong shape" migration being reintroduced by hand. The prototype now switches kind from
the Tweaks toggle, which stands in for *which board you arrived from*.

Nine types, flat, no sub-kinds: Book · Film · Show · Game · Others · Proverb · Speech ·
Letter · Essay.

## 2. Colour IS the category

There was a Category button opening a six-swatch sheet, and separately a colour concept.
They were always one thing. The button is now **Colour**, and nothing in the app calls
that enum a category.

## 3. Quiz/skip left the quote form

Review exclusion is work-level, and the spec is explicit that there are no ratings and no
per-quote review control. The filing row is Colour · Sticker · Favourite — three, not
four.

## 4. A book has characters

I had asserted the opposite, twice, in comments: that a book quote has no speaker because
the words are the author's. The spec says a novel has speakers, and a book's cast is
characters with no actors. Both the form field and the People screen now reflect that.
The comments claiming otherwise are deleted rather than softened — they were wrong, and a
wrong comment in this file is worse than none.

## 5. Locators are per medium, and a game has none of the obvious ones

- **Book** — Chapter (number) · Chapter name · one locator with its unit (Page / Location / %)
- **Film** — Timestamp `hh:mm:ss`
- **Show** — Season · Episode · Episode name · Timestamp
- **Game** — Act · Quest. **No timestamp**, no season, no episode; the server refuses all
  three, so the form must not offer them.

Act and Quest are two fields that nest exactly as Season and Episode do.

## 6. Actor is never typed

It arrives from the work's character ↔ actor mapping. On the form it is a derived line
under the character, not an input — and on a game it is labelled *voice actor*, on a book
it is absent entirely.

## 7. circa is a checkbox, not a convention

I had told Claude Code that the date parser accepts `c. 1930` as text. The spec puts
`circa` beside the date as its own boolean, with one date field at variable precision
(`YYYY` / `YYYY-MM` / `YYYY-MM-DD`). The date field and the circa box are now one control
group, and there is no year box beside a date box anywhere.

## 8. Translation is not Note

A note is what you think; a translation is what it says. Separate multiline fields on
every standalone kind.

---

# Still owed

- **Type scale.** The sheet uses 9.5 · 12.5 · 13.5 · 14.5 · 16.5 · 21px. The spec allows
  ten integer steps only — 9 · 11 · 12 · 13 · 15 · 17 · 19 · 22 · 26 · 30 — in four roles,
  each scalable 75–200%. Every off-scale size in this file is a build failure. This is a
  mechanical pass over the whole prototype and it has not been done.
- **The cast editor** on the work page: a two-column character ↔ actor list, add / edit /
  delete, showing which rows came from the provider and which the reader typed. The People
  screen here lists the cast but cannot edit the mapping.
- **Add-a-character from inside the quote form** — the affordance exists as a picker row
  ("Name someone new") but does not yet write back to the work's cast.
- **Board create / settings**, where the kind and a proverb board's language list are
  chosen. Not started; it is the screen that makes §1 true.
- **Import review** rows must expose every field above, or approval silently drops them.
- The **§4 asymmetries** (Series/Genres/Description missing from book add, IMDb id
  editable only in Details, Publisher for games only, review exclusion having no
  single-item control, Google Books / Open Library ids with no surface) are work-page
  bugs, not quote-form ones — none are fixed here.

# Open questions answered by this prototype

- **Q3, inherited work fields on a quote form:** not shown. The form opens from the work's
  own page, so restating the book and author was four rows repeating what the reader was
  looking at a second earlier. On a form reached from the global ＋ they would be needed.
- **Q5, what is above the fold:** the quote box, always. It is the only required field, and
  it holds the fold on its own — locators and filing sit under it in one scroll.
- **Q7, adding a missing character:** a row inside the picker, always present rather than
  an empty-state fallback, since on a first quote the cast is empty.
