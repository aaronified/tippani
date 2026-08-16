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
// A selection of two. Some actions mean something over a SELECTION and nothing
// over one item that happens to be in one — see the cardinality block at the foot
// of this file — so the length of the list is now load-bearing.
const TWO = [ITEM, { id: 8, quote: 'The unread shelf' }]

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
  it.each(['annotation', 'dialogue', 'quote'])('%s offers copy, share, edit and delete', (kind) => {
    const ids = actionsFor(kind, ITEM, full()).map((a) => a.id)
    expect(ids).toEqual(['copy', 'share', 'edit', 'delete'])
  })

  // A WORK IS NOT A QUOTE HERE EITHER (1.14.2). This list said copy and share
  // were available on a book for as long as it was quote-only — nothing broke,
  // because no work surface passed the callbacks, and the moment one did it
  // would have offered to put a cover on the clipboard.
  it.each(['book', 'movie'])('%s offers neither copy nor share, because there is nothing to copy', (kind) => {
    const ids = actionsFor(kind, ITEM, full()).map((a) => a.id)
    expect(ids).toEqual(['edit', 'delete'])
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

  // THE DRIFT THAT ACTUALLY HAPPENED, and in the direction the test above does
  // not look. 1.11.1 gave `bulkActionsFor` a work branch; `actionsFor` stayed
  // quote-only for three releases, so a work's card menu had nothing to render
  // and the selection bar could do four things to one selected book that the
  // book's own tile could not. Every assertion here ran green throughout,
  // because they all walk item → bulk.
  it.each(['book', 'movie'])('%s: a selected one and the tile it came from offer the same things', (kind) => {
    // Set fields and Shelf are the two exceptions, and both are stated rather
    // than skipped. Set fields is bulk-only BY RULE — over a single work the
    // full form beside it is strictly better, which the cardinality block at
    // the foot of this file already pins. Shelf needs a submenu, and a card
    // menu has no shape for one; the work's own page has the control.
    const BULK_ONLY = new Set(['set-fields', 'shelf'])
    const bulk = bulkActionsFor(kind, [ITEM], everything()).map((a) => a.id).filter((id) => !BULK_ONLY.has(id))
    const item = new Set(actionsFor(kind, ITEM, everything()).map((a) => a.id))
    for (const id of bulk) {
      expect(item.has(id), `${kind}: the bar can ${id} one selected row and its card cannot`).toBe(true)
    }
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
  it('offers tags for every kind of QUOTE', () => {
    for (const kind of ['annotation', 'dialogue', 'quote']) {
      expect(bulkActionsFor(kind, [ITEM], full()).map((a) => a.id)).toContain('add-tags')
    }
  })

  // A tag belongs to a quote. There is no book_tags table and no `add_tags` on
  // /books/bulk — only `add_genres` — so this was never an action a selection
  // of works could perform, and the registry said it was for three releases.
  // The only reason nobody saw it is that SelectionBar passes no addTags
  // callback for the work half, which is a guard in the wrong file: three of
  // the four quote-only bulk actions state the rule here and this one did not.
  it('does not offer tags over works, which have genres instead', () => {
    for (const kind of ['book', 'movie']) {
      expect(bulkActionsFor(kind, [ITEM], full()).map((a) => a.id)).not.toContain('add-tags')
    }
  })

  it('offers the field edits only where the fields exist', () => {
    // An author and a series belong to a work. A quote's equivalent is its colour,
    // which is a later commit — and until then its absence here is deliberate
    // rather than forgotten.
    //
    // TWO items rather than one: over a single work Set fields is strictly worse
    // than the work's own form beside it, so 1.12.0 offers it only from two
    // upwards. See the cardinality block at the foot of this file.
    for (const kind of ['book', 'movie']) {
      expect(bulkActionsFor(kind, TWO, full()).map((a) => a.id)).toContain('set-fields')
    }
    for (const kind of ['annotation', 'dialogue', 'quote']) {
      expect(bulkActionsFor(kind, TWO, full()).map((a) => a.id)).not.toContain('set-fields')
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
    const ids = bulkActionsFor(kind, TWO, everything()).map((a) => a.id)
    expect(ids).toEqual(['colour', 'add-tags', 'sticker', 'favourite', 'review', 'delete'])
  })

  it('leads with colour and ends with delete', () => {
    // Colour first because it is the single most plausible reason to select forty
    // quotes and needs no typing; delete last, and never adjacent to a control that
    // merely sets a field.
    const ids = bulkActionsFor('quote', TWO, everything()).map((a) => a.id)
    expect(ids[0]).toBe('colour')
    expect(ids[ids.length - 1]).toBe('delete')
  })
})

describe('what a selection of works can do', () => {
  it.each(['book', 'movie'])('%s: fill, shelf, fields, quiz, delete — and no colour or seal', (kind) => {
    const ids = bulkActionsFor(kind, TWO, everything()).map((a) => a.id)
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

// ---- where an action sits, and how many it takes (1.12.0) -----------------
//
// The bar became three glyphs and an overflow. Both halves of that are decided
// here rather than in the component that draws them: WHICH three (`where`), and
// WHETHER an action means anything at this count. A component holding the second
// opinion is how a bar and a menu drift, which is the whole reason this file
// exists.

describe('where a bulk action sits', () => {
  it.each(KINDS)('%s: every one has a placement and a picture', (kind) => {
    for (const a of bulkActionsFor(kind, TWO, everything())) {
      expect([ROW, OVERFLOW], a.id + ' sits nowhere').toContain(a.where)
      expect(a.icon, a.id + ' has no glyph').toBeTruthy()
    }
  })

  it.each(['annotation', 'dialogue', 'quote'])('%s: colour, favourite and the quiz stand in the row', (kind) => {
    const acts = bulkActionsFor(kind, TWO, everything())
    expect(atRow(acts).map((a) => a.id)).toEqual(['colour', 'favourite', 'review'])
    expect(atOverflow(acts).map((a) => a.id)).toEqual(['add-tags', 'sticker', 'delete'])
  })

  it.each(['book', 'movie'])('%s: fill, shelf and the quiz stand in the row', (kind) => {
    const acts = bulkActionsFor(kind, TWO, everything())
    expect(atRow(acts).map((a) => a.id)).toEqual(['fill', 'shelf', 'review'])
  })

  it.each(KINDS)('%s: exactly three stand in the row', (kind) => {
    // THE INVARIANT THE STRIP IS SIZED FOR. A fourth fits on a desktop and pushes
    // the count off the screen on a phone, where the bar is pinned under the
    // header at a fixed height — and it does it silently.
    expect(atRow(bulkActionsFor(kind, TWO, everything())).length).toBe(3)
  })

  it('keeps delete in the overflow, and it is still the last thing there', () => {
    const over = atOverflow(bulkActionsFor('quote', TWO, everything()))
    expect(over[over.length - 1].id).toBe('delete')
    expect(over.find((a) => a.id === 'delete').danger).toBe(true)
  })

  it('flips the quiz glyph with the quiz label, because a picture carries no state', () => {
    const skip = bulkActionsFor('quote', TWO, { ...everything(), excluded: false }).find((a) => a.id === 'review')
    const add = bulkActionsFor('quote', TWO, { ...everything(), excluded: true }).find((a) => a.id === 'review')
    expect(skip.icon.type).not.toBe(add.icon.type)
  })
})

describe('the actions that depend on how many are picked', () => {
  it('offers Edit over exactly one, and runs it on that one', () => {
    const ctx = everything()
    const edit = bulkActionsFor('quote', [ITEM], ctx).find((a) => a.id === 'edit')
    expect(edit).toBeTruthy()
    edit.run()
    // The ITEM itself, not the list — this is editing the one thing in the
    // selection, which is why the item list still marks it `single`.
    expect(ctx.edit).toHaveBeenCalledWith(ITEM)
  })

  it('drops Edit the moment a second is picked', () => {
    expect(bulkActionsFor('quote', TWO, everything()).map((a) => a.id)).not.toContain('edit')
  })

  it('is the mirror image for Set fields, so the two are never offered together', () => {
    // Over one work the full form beside it is strictly better; over several there
    // is no single form to open. Neither is ever a dead control, and a selection
    // never shows two ways to change the same fields.
    const one = bulkActionsFor('book', [ITEM], everything()).map((a) => a.id)
    const two = bulkActionsFor('book', TWO, everything()).map((a) => a.id)
    expect(one).toContain('edit')
    expect(one).not.toContain('set-fields')
    expect(two).toContain('set-fields')
    expect(two).not.toContain('edit')
  })

  it('offers neither where the screen passes no callback for it', () => {
    const ids = bulkActionsFor('book', [ITEM], { remove: vi.fn() }).map((a) => a.id)
    expect(ids).toEqual(['delete'])
  })
})
