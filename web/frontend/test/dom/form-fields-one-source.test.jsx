// EVERY FORM READS THE SAME TABLE, and a proverb is the case that proves it.
//
// THE OWNER, editing one: "while editing a proverb, i still see all the useless
// fields. also standardise those (for all kinds and work annotations)" — then,
// deciding the shape: "both edit and add should read field list from one source.
// standardise it", and "only add will have show all fields button, edit won't
// (all fields will show)."
//
// WHAT WAS WRONG. `addFields.js` holds what each of the eleven doors shows,
// hides, and hard-drops — and it was imported by `AddSurface.jsx` ALONE. So the
// add surface asked a proverb for its nine fields and the EDIT form asked it for
// all seventeen the table knows, including the ten it drops: no speaker, no
// occasion, no date, no place, no recipient, no source, no page.
//
// AND THE REASON THE EDIT FORM DREW EVERYTHING HAD EXPIRED. Its own note said the
// kind "lives on the BOARD and not on the quote… only the first of those knows
// which kind is being edited". True when written; 0053 made `kind` a column on
// the quote, and the form has read it ever since.
//
// THIS IS A DOM TEST AND NOT A SOURCE SCAN because the question is what a reader
// SEES. A scan for `showsField` would pass on a form that imported it and gated
// nothing, which is most of the distance between the defect and the fix.
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import { editFields, fieldKeys } from '../../src/addFields.js'
import { t } from '../../src/i18n.js'

vi.mock('../../src/api.js', () => ({
  json: async () => ({ ok: true, data: {} }),
  errText: () => 'nope',
  upload: async () => ({ ok: true, data: {} }),
  uploadWithProgress: async () => ({ ok: true, data: {} }),
  coverImgURL: () => '',
  downloadPost: async () => ({ ok: true }),
}))

const { UtteranceForm } = await import('../../src/Quotes.jsx')

// The words a reader would see for each field key, so a hard-drop is looked for
// by the label rather than by a prop name. Only the keys a quote kind can differ
// on are here — `quote`, `note`, `tags` and `colour` are on every door.
//
// RESOLVED, NOT TYPED. The first cut of this spelled them out and got two wrong —
// `recipient` is "To" and not "Sent to", `locator` is "Page" and not "Where in
// it" — so it failed against correct code and looked like a defect. The forms all
// draw `common.field.<key>.label` (hyphenated, which is the locale file's
// convention for a two-word key), so deriving it means a rename moves the test
// with the app instead of breaking it.
const LABELS = ['speaker', 'occasion', 'place', 'recipient', 'work_title',
  'locator', 'source_author', 'region', 'language']
const LABEL = Object.fromEntries(
  LABELS.map((k) => [k, t(`common.field.${k.replace(/_/g, '-')}.label`)]),
)

const form = (initial) =>
  render(<UtteranceForm initial={initial} onSubmit={async () => null} onCancel={() => {}} submitLabel="Save" />)

// A label may be drawn by a `<label>` wrapper or as a sibling MonoLabel, so this
// asks the document for the words rather than for a binding.
const drawn = (word) => screen.queryAllByText((s) => s.trim() === word).length > 0

describe('the edit form asks a kind for its own fields and no others', () => {
  // THE REPORTED CASE. A proverb has no speaker, no date, no place, no recipient,
  // no source and no page — `addFields.js` says so, and now the form does too.
  it('draws none of the ten a proverb hard-drops', () => {
    form({ id: 1, kind: 'proverb', quote: 'অতি সন্ন্যাসীতে গাজন নষ্ট' })
    const has = fieldKeys('proverb')
    const dropped = Object.keys(LABEL).filter((k) => !has.includes(k))
    // The table has to actually drop some, or this test is vacuous.
    expect(dropped.length, 'a proverb hard-drops nothing, so this case proves nothing')
      .toBeGreaterThan(4)
    for (const key of dropped) {
      expect(drawn(LABEL[key]), `a proverb was asked for ${key}`).toBe(false)
    }
  })

  it('and draws the ones it does carry', () => {
    form({ id: 1, kind: 'proverb', quote: 'a saying' })
    // Region and language are a proverb's own two — the language is its whole
    // attribution line on the card, so a form that hid it would leave the card
    // with nothing to say.
    for (const key of ['region', 'language']) {
      expect(fieldKeys('proverb').includes(key), `the table stopped giving a proverb ${key}`).toBe(true)
      expect(drawn(LABEL[key]), `a proverb was not asked for ${key}`).toBe(true)
    }
  })

  // THE FALLBACK MATTERS AS MUCH AS THE GATE. A row saved before 0053 carries no
  // `kind`, and guessing one would hide a box that has a value in it. `other`
  // hard-drops nothing, which is exactly true of a row that never said what it
  // was — so an old row is asked for everything, as it was before.
  it('asks a kindless row for everything, because it cannot know', () => {
    form({ id: 1, quote: 'from before the kind column' })
    for (const key of Object.keys(LABEL)) {
      expect(drawn(LABEL[key]), `a kindless row lost its ${key} box`).toBe(true)
    }
  })

  // Two kinds differing proves the gate reads the KIND rather than one hardcoded
  // list — a form that gated on a constant would pass the proverb case alone.
  it('and a letter differs from a speech, by the table', () => {
    form({ id: 1, kind: 'letter', quote: 'a letter' })
    expect(drawn(LABEL.recipient), 'a letter was not asked who it was sent to').toBe(true)
  })
})

// AND THE TABLE IS THE AUTHORITY EVEN WHERE A FORM ALREADY AGREES WITH IT.
//
// Verified before writing this: `AnnotationForm` and `DialogueForm` had NO visible
// defect. Each serves one door — a book highlight, a screen line — so each was
// written to that door and does not over-ask. `UtteranceForm` was the only one
// serving seven kinds, and the only one that drew all of them.
//
// SO THIS IS NOT A REPAIR, IT IS AN ANCHOR. `DialogueForm` gates by medium with
// its own conditions (`episodeFields = show || initial?.season != null`,
// `timestamp: game ? '' : …`) rather than by the table, which is two spellings of
// one rule — the shape the repo forbids, and the shape that let the add and edit
// surfaces disagree about a proverb in the first place. Rewriting two working
// forms to prove a point is not worth the risk; holding all three to the table is,
// because the next kind or medium added lands in one place and fails here if a
// form does not follow.
describe('a work annotation is held to the same table', () => {
  it('a book highlight is asked for exactly what the table gives it', async () => {
    const { AnnotationForm } = await import('../../src/Library.jsx')
    render(<AnnotationForm initial={{ id: 1, quote: 'a passage' }} onSubmit={async () => null}
      onCancel={() => {}} submitLabel="Save" />)
    const has = fieldKeys('annotation')
    for (const key of Object.keys(LABEL)) {
      // `language` and `character` a book highlight does carry; the quote-kind
      // fields — speaker, occasion, place, recipient, source, region — it does not.
      expect(drawn(LABEL[key]), `a book highlight ${has.includes(key) ? 'lost its' : 'was asked for'} ${key}`)
        .toBe(has.includes(key))
    }
  })
})

describe('edit shows every field of that kind, flat', () => {
  // THE OWNER'S RULING: "only add will have show all fields button, edit won't
  // (all fields will show)." Adding is fast capture, so a disclosure earns its
  // place; editing is deliberate, so hiding half the row behind a press is
  // friction. The add surface's own disclosure is tested in add-surface.test.jsx.
  it('draws no disclosure at all', () => {
    form({ id: 1, kind: 'letter', quote: 'a letter' })
    expect(screen.queryByText(/Show every field/i), 'the edit form grew a disclosure').toBeNull()
    expect(screen.queryByText(/Hide the rare fields/i)).toBeNull()
  })

  // And "all fields" means all of THIS KIND's — `editFields` is main ++ more, and
  // a field behind the add surface's disclosure must be on screen here.
  it('including the ones the add surface keeps behind its disclosure', () => {
    form({ id: 1, kind: 'letter', quote: 'a letter' })
    const flat = editFields('letter')
    // `occasion` is in a letter's `more`, so it is exactly the case: hidden on
    // add until the disclosure opens, always visible on edit.
    expect(flat.includes('occasion'), 'the table moved occasion off a letter').toBe(true)
    expect(drawn(LABEL.occasion), "a letter's occasion is behind something on the edit form").toBe(true)
  })
})
