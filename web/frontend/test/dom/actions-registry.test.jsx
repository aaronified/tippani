// The action registry: one list of the things you can do to a quote.
//
// The registry exists to stop a divergence, so the tests are about the
// divergence rather than about any one action. Two surfaces will read this list —
// a card and a bulk bar today, a context menu next — and the failure it prevents
// is silent by construction: a menu that offers Delete beside a bar that does not
// looks completely normal on both screens, and nobody notices until somebody
// wonders why they cannot do to forty what they just did to one.
//
// So: every item action has a selection equivalent or is explicitly marked
// `single`, and the ONLY thing marked single is the one that genuinely does not
// generalise. A test that just listed the expected ids would pass for a registry
// that had quietly dropped one.

import { describe, expect, it, vi } from 'vitest'
import {
  actionsFor,
  atOverflow,
  atRow,
  bulkActionsFor,
  bulkable,
  KINDS,
  OVERFLOW,
  ROW,
} from '../../src/actions.jsx'

const ITEM = { id: 7, quote: 'Only in silence the word' }

// Every callback a screen can own, so nothing is filtered out for being absent.
const full = () => ({
  copy: vi.fn(),
  share: vi.fn(),
  edit: vi.fn(),
  remove: vi.fn(),
  addTags: vi.fn(),
  setFields: vi.fn(),
})

describe('what you can do to one quote', () => {
  it.each(KINDS)('%s offers copy, share, edit and delete', (kind) => {
    const ids = actionsFor(kind, ITEM, full()).map((a) => a.id)
    expect(ids).toEqual(['copy', 'share', 'edit', 'delete'])
  })

  it('puts copy and share in the row, edit and delete behind the ⋯', () => {
    const acts = actionsFor('annotation', ITEM, full())
    expect(atRow(acts).map((a) => a.id)).toEqual(['copy', 'share'])
    expect(atOverflow(acts).map((a) => a.id)).toEqual(['edit', 'delete'])
    // Every action has a placement: one with neither would render nowhere, which
    // is the quietest way for an action to stop existing.
    for (const a of acts) expect([ROW, OVERFLOW]).toContain(a.where)
  })

  it('drops an action the screen cannot perform, rather than offering a dead one', () => {
    // A surface without an edit callback (a read-only view, a demo) shows no Edit.
    const acts = actionsFor('quote', ITEM, { copy: vi.fn(), share: vi.fn() })
    expect(acts.map((a) => a.id)).toEqual(['copy', 'share'])
  })

  it('runs the screen’s own callback with the item', () => {
    const ctx = full()
    for (const a of actionsFor('dialogue', ITEM, ctx)) a.run()
    expect(ctx.copy).toHaveBeenCalledWith(ITEM)
    expect(ctx.share).toHaveBeenCalledWith(ITEM)
    expect(ctx.edit).toHaveBeenCalledWith(ITEM)
    expect(ctx.remove).toHaveBeenCalledWith(ITEM)
  })

  it('marks delete as dangerous and nothing else', () => {
    const acts = actionsFor('book', ITEM, full())
    expect(acts.filter((a) => a.danger).map((a) => a.id)).toEqual(['delete'])
  })
})

describe('the two lists cannot drift apart', () => {
  it('marks the actions that do not generalise to a selection, and only those', () => {
    // THE INVARIANT. An action you can do to one thing and not to forty is a real
    // category, and it is stated with a flag rather than by being absent from the
    // other list — absence is what drift looks like.
    const acts = actionsFor('annotation', ITEM, full())
    expect(acts.filter((a) => a.single).map((a) => a.id)).toEqual(['edit'])
    // And the reason, restated as a test: editing forty quotes at once is a bulk
    // FIELD change with its own form, not this action applied forty times.
    expect(acts.filter(bulkable).map((a) => a.id)).toEqual(['copy', 'share', 'delete'])
  })

  it.each(KINDS)('%s: nothing is silently missing from the bulk list', (kind) => {
    // Every non-single action must be findable in the bulk list OR be one this
    // release has not built yet — and the ones not built yet are named here, so
    // adding one to the registry without a bulk equivalent fails until it is
    // either implemented or declared.
    const NOT_YET = new Set(['copy', 'share', 'delete'])
    const wanted = actionsFor(kind, ITEM, full()).filter(bulkable).map((a) => a.id)
    const have = new Set(bulkActionsFor(kind, [ITEM], full()).map((a) => a.id))
    for (const id of wanted) {
      expect(have.has(id) || NOT_YET.has(id), `${kind}: ${id} has no selection equivalent`).toBe(true)
    }
  })
})

describe('what you can do to a selection', () => {
  it('offers tags for every kind', () => {
    for (const kind of KINDS) {
      expect(bulkActionsFor(kind, [ITEM], full()).map((a) => a.id)).toContain('add-tags')
    }
  })

  it('offers the field edits only where the fields exist', () => {
    // An author and a series belong to a work. A quote's equivalent is its colour,
    // which is a later commit — and until then its absence here is deliberate
    // rather than forgotten.
    for (const kind of ['book', 'movie']) {
      expect(bulkActionsFor(kind, [ITEM], full()).map((a) => a.id)).toContain('set-fields')
    }
    for (const kind of ['annotation', 'dialogue', 'quote']) {
      expect(bulkActionsFor(kind, [ITEM], full()).map((a) => a.id)).not.toContain('set-fields')
    }
  })

  it('says which form each action needs, so the bar does not guess', () => {
    for (const a of bulkActionsFor('book', [ITEM], full())) {
      expect(typeof a.form).toBe('string')
    }
  })

  it('runs with the selection and the typed values', () => {
    const ctx = full()
    const values = { tags: ['grief'] }
    bulkActionsFor('annotation', [ITEM], ctx)[0].run(values)
    expect(ctx.addTags).toHaveBeenCalledWith([ITEM], values)
  })
})

// ---- two selections, one registry (1.11.1) ---------------------------------
//
// A selection of quotes and a selection of works have almost nothing in common: a
// book has no colour and no tag of its own, a quote has no shelf and nothing to
// look up. That could have been two components; it is one registry and a kind,
// and these are the assertions that keep it honest.

const everything = () => ({
  ...full(),
  setColour: vi.fn(),
  setSticker: vi.fn(),
  favourite: vi.fn(),
  fillGaps: vi.fn(),
  setShelf: vi.fn(),
  setReview: vi.fn(),
})

describe('what a selection of quotes can do', () => {
  it.each(['annotation', 'dialogue', 'quote'])('%s: colour, tags, seal, favourite, quiz, delete', (kind) => {
    const ids = bulkActionsFor(kind, [ITEM], everything()).map((a) => a.id)
    expect(ids).toEqual(['colour', 'add-tags', 'sticker', 'favourite', 'review', 'delete'])
  })

  it('leads with colour and ends with delete', () => {
    // Colour first because it is the single most plausible reason to select forty
    // quotes and needs no typing; delete last, and never adjacent to a control that
    // merely sets a field.
    const ids = bulkActionsFor('quote', [ITEM], everything()).map((a) => a.id)
    expect(ids[0]).toBe('colour')
    expect(ids[ids.length - 1]).toBe('delete')
  })
})

describe('what a selection of works can do', () => {
  it.each(['book', 'movie'])('%s: fill, shelf, fields, quiz, delete — and no colour or seal', (kind) => {
    const ids = bulkActionsFor(kind, [ITEM], everything()).map((a) => a.id)
    expect(ids).toContain('fill')
    expect(ids).toContain('shelf')
    expect(ids).toContain('set-fields')
    expect(ids).toContain('review')
    expect(ids[ids.length - 1]).toBe('delete')
    // A colour category is a note about a quote, and a work has never had one.
    expect(ids).not.toContain('colour')
    expect(ids).not.toContain('sticker')
    expect(ids).not.toContain('favourite')
  })
})

describe('the quiz toggle', () => {
  it('names the action, not the state, and flips', () => {
    // A bar that always said "Skip in quiz" over a selection that is already
    // skipped is a control whose state you cannot read.
    const inQuiz = bulkActionsFor('quote', [ITEM], { ...everything(), excluded: false })
    const skipped = bulkActionsFor('quote', [ITEM], { ...everything(), excluded: true })
    expect(inQuiz.find((a) => a.id === 'review').label).toBe('Skip in quiz')
    expect(skipped.find((a) => a.id === 'review').label).toBe('Add to quiz')
  })

  it('passes the state it read, so the caller sends the opposite', () => {
    const ctx = { ...everything(), excluded: true }
    bulkActionsFor('quote', [ITEM], ctx).find((a) => a.id === 'review').run()
    expect(ctx.setReview).toHaveBeenCalledWith([ITEM], true)
  })
})

describe('every bulk action still says which form it needs', () => {
  it.each(KINDS)('%s', (kind) => {
    // BULK_NONE is the empty string rather than null, so "needs nothing" and
    // "nobody said" cannot be confused for one another.
    for (const a of bulkActionsFor(kind, [ITEM], everything())) {
      expect(typeof a.form, a.id).toBe('string')
    }
  })
})
