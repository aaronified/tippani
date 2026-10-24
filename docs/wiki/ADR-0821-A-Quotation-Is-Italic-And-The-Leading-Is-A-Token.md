# ADR-0821: A quotation is italic, and the leading is a token

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

§6's reading-comfort dials need one thing to move. There were seventeen — fifteen inline
styles and two CSS rules — and they did not agree.

**MEASURED BEFORE ANYTHING WAS CHANGED**, off the commit this replaced, because the drift
is the whole argument for the change:

| | Inline (15) | CSS (2) | All 17 |
|---|---|---|---|
| `italic` | 12 | 1 (`.quote-translation`) | **13** |
| upright, via `var(--font-display-style)` | 3 | 1 (`.anthology-quote`) | **4** |
| leading 1.55 | 3 | — | 3 |
| leading 1.5 | 9 | 1 | 10 |
| leading 1.42 | — | 1 | 1 |
| no leading at all | 3 | — | 3 |

`var(--font-display-style)` resolves to `inherit`, so those four rendered **upright**. One
was the film CARD — a film line and a book highlight, the two surfaces the release before
this one spent its time making behave alike, setting the same words differently. Two were
search rows beside rows that were italic. The fourth was `.anthology-quote`, which is what
the EXPORT and the PRINT stylesheet draw, under a comment promising it reads "like every
other quote surface". And `SearchPage.jsx` held both answers **ten lines apart** — 1701
italic, 1711 upright, the windowed and un-windowed branches of one result row.

**THE RULING: ITALIC IS THE QUOTATION CONVENTION AND NOT THE DISPLAY FACE'S BUSINESS.**
`--font-display-style` is the style a reader chose for HEADINGS. Letting it reach the quote
means a reader who wants upright titles silently loses the convention on their own words.
Thirteen of the seventeen already agreed; the change makes it seventeen. *(The rejected alternative
was to leave the dial reaching the quote and only make the fifteen consistent about it —
which is one setting answering two questions, and the reason the four drifted is that
nobody could see which question they were answering.)*

**AND THE TRANSLATION WAS THE TIGHTEST TEXT IN THE APP AT THE SMALLEST SIZE.** 1.42 under a
body at 1.5 or 1.55, which is backwards: smaller text wants more leading, not less. That
one is a fix rather than a consolidation, and it arrived as one.

**WHERE IT LIVES.** `QUOTE_TEXT` (`fonts.js`) for the slots that draw inline, and
`--quote-leading` (`index.css`) for the two that draw through CSS — `.quote-translation`
and `.anthology-quote`, which are components rather than sites and are exempted from the
object but not from the token. Size is deliberately NOT in the object: it is the one part
that genuinely differs by surface (display-17 on a card, display-15 in a row), so it stays
the caller's.

**THE GUARD IS THE POINT, AND ITS FIRST DRAFT PASSED WHILE MISSING TWO SITES.** The
rewrite that introduced `QUOTE_TEXT` used a regex, and at the two MULTI-LINE style objects
it deleted the property list without inserting the spread — `FavouriteTile` and the quiz
card's `QuoteBlock` lost their face outright. Two DOM tests caught those two; nothing
would have caught the rest. `quote-type.test.js` asks four questions of every slot, and
its own first draft found slots by `languageClass(` alone — so the two board cards, which
take their class from `quoteTexts`' `bodyScript` one layer up and their type from a named
constant, were invisible to it, and a mutation that broke one of them passed. Both forms
are walked now, and all nine mutations fail.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
