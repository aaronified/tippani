// A CARD PRINTS THE WORDS AND WHERE THEY CAME FROM. NOT WHEN YOU FILED THEM.
//
// THE OWNER, from their own phone, in one breath with the locator ask: "date of
// capture is not needed on any card. and except for the quote annoations, others
// do not need year of writing/shooting/recording etc. as those are already there
// in the work level details."
//
// TWO DIFFERENT FACTS AND ONE RULE. The capture date — `noted_at`, else
// `created_at` — is a fact about the reader's own filing, not about the quote; it
// was on the meta line of every book highlight and every search hit that reuses
// the card. The work's year is a fact about the WORK, and the surfaces that
// carry a work already carry it. Neither earns a line on the card.
//
// THE DATE IS NOT DELETED FROM THE APP, and the distinction matters: the table
// view has a sortable Date column, the staging queue's rows say when an import
// arrived, and the share dialog lists it as a toggle. What goes is the printing
// on the CARD, where nothing was asking the question it answers.
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../src/api.js', () => ({
  json: async () => ({ ok: true, data: {} }),
  errText: () => 'nope',
  coverImgURL: () => '',
  upload: async () => ({ ok: true, data: {} }),
}))

const { AnnotationCard, annDate } = await import('../../src/Library.jsx')
const { fmtDate } = await import('../../src/ui.jsx')

// A highlight filed on a date that is nowhere else on the card, so finding the
// string anywhere means the meta line printed it.
const ROW = {
  id: 1,
  quote: 'It is a far, far better thing that I do',
  chapter: 'Recalled to Life',
  chapter_no: 3,
  location: '204',
  noted_at: '2023-06-14',
  created_at: '2024-01-02',
}

const card = (row = ROW) =>
  render(<AnnotationCard a={row} tagMap={{}} save={() => {}} patch={() => {}} remove={() => {}} />)

describe('the capture date is off the card', () => {
  it('does not print the day it was filed', () => {
    card()
    // Through the app's own formatter rather than a typed string: the meta line
    // called `fmtDate(annDate(a))`, so asking for exactly that output is what
    // makes this fail if the line comes back, whatever the locale's date shape.
    const filed = fmtDate(annDate(ROW))
    expect(filed, 'the fixture has no date to look for').toBeTruthy()
    expect(document.body.textContent).not.toContain(filed)
  })

  // AND IT IS THE CREATED DATE TOO, since `annDate` falls back to it — a row
  // imported without a source date would otherwise keep printing one.
  it('nor the day the row was created, where that is all there is', () => {
    const row = { ...ROW, noted_at: '' }
    card(row)
    expect(document.body.textContent).not.toContain(fmtDate(annDate(row)))
  })

  // THE CARD STILL SAYS WHERE THE WORDS ARE FROM. A test that only asserts an
  // absence passes on a card that renders nothing at all.
  it('and still says where in the book it is', () => {
    card()
    expect(screen.getByText(/Recalled to Life/)).toBeTruthy()
  })

  // The other half of the locator rule, on the rendered card rather than on the
  // function — see locator-meta.test.js for the rule itself.
  it('one locator, not two: a named chapter drops the page', () => {
    card()
    expect(document.body.textContent).not.toMatch(/204/)
  })

  it('but a highlight with no chapter keeps its page, which is all it has', () => {
    card({ ...ROW, chapter: '', chapter_no: 0 })
    expect(screen.getByText(/204/)).toBeTruthy()
  })
})
