// A reader takes a book's highlights out of the quiz, then goes to Settings to see
// how much of that book they have quietly switched off.
//
// WHAT IS BEING ASSERTED, AND IT IS A FRACTION. The list used to say "27 SKIPPED"
// against a work and leave the reader to guess whether that was the whole book or
// a corner of it — the one question somebody auditing their own exclusions has.
// The row says both numbers now, and the summary above says how many works they
// are spread over. Neither can be read off the old screen, and neither is a
// rewording: the denominator is a fact the server did not send.
//
// THE COUNTS ARE GLYPHS ON THE ROW AND WORDS IN THE SUBHEADER, which is the rule
// this whole pass is carrying out — "when there is enough space the glyph will
// follow the text so the association is clear; where there is small space, they
// serve as a visual indicator of the nouns". So the summary is asserted by its
// WORDS (they are painted there) and the row by its NAMES (the glyph is all that
// is painted, and a glyph with no name is a picture).
//
// THE MUTATION, and there are two. Send the excluded count as the denominator —
// drop the correlated COUNT(*) in review_excluded.go for `len(g.Quotes)` — and the
// row reads "n skipped / n quotes": the fraction assertion goes red while every
// `see` on this screen stays green, which is why the two numbers are compared
// rather than merely found. And take `showWord` off the summary's tallies: the
// subheader loses its words and the first block goes red, while the row is
// unaffected — the two halves of the rule, each failing on its own.
//
// It knows the words on the screen and nothing else — no route, no component, no
// class, no field name.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

it('a reader skips a book\'s highlights and reads how many of it that was', async () => {
  await app.goto('/library')
  // Seneca, for the reason the selection journey gives: a curated public-domain
  // title survives a regeneration of the derived fixture, and this one has several
  // highlights — a work with one cannot show a fraction at all.
  await app.press('On the Shortness of Life')

  const ticked = await app.pressAll('Select this quote')
  expect(ticked, 'the book should carry several highlights to tick').toBeGreaterThan(1)
  // THE BAR'S OWN BUTTON, not the overflow behind "More": this verb is drawn in
  // the row (`where: ROW`), which is where a reader meets it.
  await app.press('Skip in quiz')

  // A SECOND BOOK, so the summary has a plural to get right and the list has two
  // rows rather than one. Grimm is the other curated title and carries a single
  // highlight, which is also the shape that would expose a summary counting rows
  // instead of quotes.
  await app.goto('/library')
  await app.press("Grimm's Fairy Stories")
  const alone = await app.pressAll('Select this quote')
  await app.press('Skip in quiz')

  await app.goto('/settings/review')

  // THE SUBHEADER, IN WORDS. This is the roomy half of the rule and the place a
  // reader learns which drawing means what, so the nouns are on the screen.
  await app.see('Never asked about')
  await app.see(`${ticked + alone} skipped`)
  await app.see('2 works')

  // THE ROW, BY ITS NAMES. All that is painted on it is two figures and two
  // glyphs; the nouns live in the accessible names, and a glyph with no name is a
  // picture of nothing. This is the half `see` cannot reach, and the reason the
  // harness grew `said`.
  // THE GLYPHS NAME THEMSELVES. The figure beside each one is ordinary text — read,
  // copied and found in the page as drawn — and the drawing standing in for the
  // noun carries the noun. `said` refuses an ambiguous match, so finding exactly
  // one thing named "skipped" is also finding that the two rows agree about which
  // drawing means what.
  expect(await app.said('skipped'), 'the red glyph should say what it stands for').toBe('skipped')
  // The SINGULAR, off the one-quote book: "quotes" is also what the rail calls the
  // Quotes screen, and `said` folds case — so asking for the plural would be asking
  // about two different things and being told so.
  expect(await app.said('quote'), 'and the one beside it should say quote').toBe('quote')

  // AND THE FRACTION IS ON THE SCREEN AS TWO FIGURES OVER A SLASH. Which figure is
  // which is the pair above; that the second is the WORK'S count rather than the
  // list's is proved where it can be built — review_excluded_test.go's
  // TestTheExcludedListCarriesTheWholeCountAndTheCreditsFace.
  await app.see(`${ticked} / ${ticked}`)

  // THE DENOMINATOR IS THE WORK'S OWN COUNT rather than the list's, which is what
  // makes the pair a fraction — proved at the API tier, where a book with quotes
  // still in the deck can be built and read back
  // (review_excluded_test.go, TestTheExcludedListCarriesTheWholeCount…). Here both
  // books happen to be entirely skipped, so what this tier can add is that the
  // screen PRINTS both halves and names each one.

  // AND THE COVER IS AS TALL AS WHAT IS BESIDE IT. It was a fixed 56px stamp
  // against a title that wraps and a credit chip under it, so the row read as a
  // caption with a thumbnail rather than as a shelf — the owner's ask, and a thing
  // with no words in it, which is why this is measured. `page` is the harness's
  // escape hatch and this is what it is for.
  //
  // THE MUTATION, AND IT IS NOT THE ONE YOU WOULD REACH FOR. Putting
  // `align-items: flex-start` back on `.skipped-work` changes nothing, because the
  // art column carries `align-self: stretch` and a child's own alignment outranks
  // its container's — a fact this file learned by trying it and watching the case
  // stay green. The load-bearing line is that `align-self` on
  // `.skipped-work-art`: set it to `flex-start`, `make frontend`, and the ratio
  // falls to 0.68.
  const fit = await app.page.evaluate(() => {
    const row = [...document.querySelectorAll('*')].filter(
      (el) => el.querySelector('img, .ph') && /On the Shortness of Life/.test(el.textContent),
    ).pop()
    if (!row) return null
    const art = row.querySelector('img, .ph')
    const said = [...row.children].find((c) => !c.contains(art) && c.textContent.trim())
    if (!said) return null
    return art.getBoundingClientRect().height / said.getBoundingClientRect().height
  })
  expect(fit, 'no row on this screen holds artwork beside a title').not.toBeNull()
  // EQUAL, WITHIN A HAIR. The ask was that the cover's height be the height of
  // the title and the credit chip beside it; measured, the pair comes out 88 and
  // 88. The window is there because a fractional layout pixel is not a defect —
  // it is narrow on BOTH sides on purpose, because the two failures this has to
  // tell apart are a cover that is too short (the 56px stamp it replaced) and one
  // that is too tall (453px, which is what the first attempt at this actually
  // drew: the row's height fed the art's width and the art's width fed its
  // height).
  expect(fit, 'the cover should be exactly as tall as the title and credit beside it')
    .toBeGreaterThan(0.95)
  expect(fit, 'the cover is taller than the text it stands beside — the row is sizing itself off the picture')
    .toBeLessThan(1.05)

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
