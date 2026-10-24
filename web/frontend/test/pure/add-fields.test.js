// The per-kind field spec, checked against what the owner actually signed off.
//
// THESE ARE NOT WORDING TESTS. Each case below is a rule the owner stated in their
// own words, and the assertion is on the FIELD KEYS a door offers — the thing that
// decides what a reader is asked for. A test that checked labels would pass while
// a proverb form asked who said it.
import { describe, expect, it } from 'vitest'
import { showsField } from '../../src/addFields.js'

describe('what each kind refuses to ask', () => {
  // The case the owner named first and the one that proves the exercise: "Hard
  // drop anything that is not relevant (writer of a movie, timestamp of a book,
  // speaker of a proverb, etc)."
  it('never asks a proverb who said it, when, or where', () => {
    for (const f of ['speaker', 'occasion', 'when', 'place', 'recipient', 'source_author']) {
      expect(showsField('proverb', f), f).toBe(false)
    }
  })

  it('never asks a book highlight for a timestamp, and never asks a film line for a chapter', () => {
    for (const f of ['timestamp', 'timestamp_end', 'season', 'episode', 'act', 'quest', 'dlc', 'speaker', 'occasion']) {
      expect(showsField('annotation', f), f).toBe(false)
    }
    for (const f of ['chapter', 'chapter_no', 'location', 'speaker', 'work_title']) {
      expect(showsField('dialogue', f, { mediaType: 'movie' }), f).toBe(false)
    }
  })
})

