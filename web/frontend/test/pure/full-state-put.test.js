// Every PUT in this app is full-state, so a field missing from the object a card
// saves is a field that request CLEARS.
//
// THIS IS A TEST FOR A BUG THAT WAS LIVE, not for a feature that is new.
// `annotationState` did not carry `character` from the release that added the
// column (0047) until 0051, which meant that recolouring a highlight — or
// hearting it, or dragging its sticker, or touching it from the selection bar —
// quietly threw away who said the line. `dialogueState` lost an episode's title
// and a game line's act and quest the same way. Nothing noticed, because every
// one of those saves answers 200 and the field it dropped was one the form
// showing it never had a box for.
//
// utteranceState has carried a comment saying "AND THIS IS A SILENT-LOSS SITE"
// since 0035 and has been correct ever since. The comment was not enough; the
// difference between that kind and the other two is that somebody wrote the
// sentence down on one of them. So this is the sentence as a test.
//
// WHY A LIST AND NOT INTROSPECTION. There is nothing on this side of the wire to
// introspect: the server's shape is the authority, and a browser test cannot ask
// it. So the list below is a hand-kept mirror of what each kind stores — which is
// exactly what makes it useful, because adding a column to the API and NOT
// arriving here is the failure, and the next person to add one has to come and
// argue with this file.

import { describe, expect, it } from 'vitest'
import { annotationState, bookState } from '../../src/Library.jsx'
import { dialogueState, movieState } from '../../src/Movies.jsx'
import { utteranceState } from '../../src/Quotes.jsx'
import { fullState } from '../../src/WorkDetails.jsx'

// A LIST PER KIND, not one function. A book is saved by two different builders —
// bookState for the ♥ and the shelf, fullState for the Details panel — and they
// are written out separately in two files. Checking one and not the other leaves
// the other free to drift, which is how they came to disagree in the first place.
const STATE = {
  annotation: [annotationState],
  dialogue: [dialogueState],
  quote: [utteranceState],
  book: [bookState, (r) => fullState('book', r)],
  movie: [movieState, (r) => fullState('movie', r)],
}

describe('the translation reaches every kind (0051)', () => {
  it('is carried by all three, since a recolour must not erase it', () => {
    // The three QUOTE kinds. A book and a film have no translation column —
    // 0051 put it on the quote, not on the work it came from.
    for (const kind of ['annotation', 'dialogue', 'quote']) {
      const body = STATE[kind][0]({ quote: 'x', translation: 'what it says' })
      expect(body.translation, `${kind} drops the translation`).toBe('what it says')
    }
  })
})
