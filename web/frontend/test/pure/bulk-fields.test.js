// Editing a whole selection, and the warning that says what it will cost.
//
// THE OWNER'S RULE, in three parts:
//   "any change will overwrite only with warnings per field"
//   "fields that are empty across the full selection do not need warnings"
//   "only things offlimits for multi-edit will be the work names & annotations
//    themselves"
//
// The second is the one that makes the first usable. A warning on every field
// is a warning on nothing — a reader who sees eight of them stops reading them,
// and the one that mattered goes past with the rest. Filling a blank cannot lose
// anything, so it says nothing.

import { describe, expect, it } from 'vitest'
import { bulkFieldsFor, overwriteWarning } from '../../src/bulkOps.jsx'

const keys = (kind) => bulkFieldsFor(kind).map((f) => f.key)

describe('what may be set over a selection', () => {
  // THE RULE THIS FILE EXISTS FOR. A title is what tells five rows apart;
  // setting it across them destroys four records and leaves five nothing can
  // distinguish afterwards.
  it('never the name of a work', () => {
    for (const kind of ['book', 'movie']) {
      expect(keys(kind), `${kind} must not offer its title`).not.toContain('title')
    }
  })

  it('never the words of a quote', () => {
    for (const kind of ['annotation', 'dialogue', 'quote']) {
      expect(keys(kind), `${kind} must not offer its own text`).not.toContain('quote')
    }
  })
})

describe('the per-field warning', () => {
  it('counts only the rows that would actually lose something', () => {
    const rows = [{ series: 'Hainish' }, { series: '' }, { series: 'Earthsea' }, {}]
    const w = overwriteWarning(rows, 'series')
    expect(w.rows).toBe(2)
    expect(w.distinct).toBe(2)
    expect(w.text).toMatch(/2 different values/)
  })
})

// ---- one column, two words for it -------------------------------------------
//
// A book's `series` is a Series and a film's is a Collection — which is what both
// Details panels call them. The bulk editor said "Series" over a selection of
// films, the one place in the app using the other side's word.
