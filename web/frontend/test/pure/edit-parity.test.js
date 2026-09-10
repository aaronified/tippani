// EVERY FIELD THE ADD SURFACE CAN SET, THE EDIT FORM MUST SEND.
//
// THE OWNER'S, AFTER FINDING THE CHAPTER PAIRING FIRED MID-WORD: "these should
// hold for both edit and add surfaces. audit that too. both should offer the same
// entry support for the same fields."
//
// THE FAILURE THIS EXISTS FOR IS SILENT AND IT DESTROYS DATA. Every PUT in this
// app is full-state — `board_test.go:185`, `annotation_character_test.go:49`, and
// half a dozen other places say so — so a form that omits a column does not
// "leave it alone", it CLEARS it. The forms know: DialogueForm's own comment says
// "Both must be SENT either way: omitting a field would clear it on every save,
// which is the same reason `actor` above is carried rather than blanked."
//
// It has bitten before. `annotation_character_test.go` calls it "the trap 0034
// caught on translator". Nothing guarded against the recurrence, and it recurred:
// 0070 and 0071 added `language`, `dlc`, `timestamp_end` and `source_author`, the
// add surface drew all four, and the three edit forms sent none of them. Editing a
// game's line wiped its pack. Editing any line wiped its language. Editing a
// speech wiped the person it reaches us through.
//
// READS THE SOURCE, because that is where the bug is. The payload is an object
// literal in each form and a mounted test would have to reach a save to see it —
// possible, but it would prove one kind at a time and the whole point is the sweep.
// Same reasoning as `name-casing` and `spacing-debt`.
import { describe, expect, it } from 'vitest'
import { fieldKeys } from '../../src/addFields.js'
import { readSource } from '../src-files.js'

// The wire name for a control, where they differ. Three do, and each for its own
// reason: a sticker and a board are chosen by name and stored by id, and a date is
// typed as a phrase ("399 BCE") and stored canonically ("-0399").
const WIRE = { sticker: 'sticker_id', board: 'board_id', when: 'occasion_date' }

// The doors, and the form that edits what each one adds.
const FORMS = [
  { door: 'annotation', ctx: {}, file: 'Library.jsx', fn: 'export function AnnotationForm(' },
  { door: 'dialogue', ctx: { mediaType: 'movie' }, file: 'Movies.jsx', fn: 'export function DialogueForm(' },
  { door: 'dialogue', ctx: { mediaType: 'show' }, file: 'Movies.jsx', fn: 'export function DialogueForm(' },
  { door: 'dialogue', ctx: { mediaType: 'game' }, file: 'Movies.jsx', fn: 'export function DialogueForm(' },
  // One form serves all seven standalone kinds, so the union of their fields is
  // what it has to send.
  ...['speech', 'letter', 'essay', 'poem', 'song', 'proverb', 'other'].map((door) => ({
    door, ctx: {}, file: 'Quotes.jsx', fn: 'export function UtteranceForm(',
  })),
]

// Fields the edit form legitimately does not send, each with its reason. A short
// list on purpose: an exception here is a column a reader can set once and never
// correct, so it has to be argued rather than added.
const EXEMPT = {
  // The door IS the kind (0053) and an edit form does not let you change what a
  // quote is — that is a different operation with its own bulk control.
  kind: 'the door is the kind; changing it is a bulk operation, not a field',
  // The work a quote belongs to is chosen when it is added and moved by the
  // queue's retarget, never by retyping it in the form.
  book_id: 'the work is chosen, not typed',
  movie_id: 'the work is chosen, not typed',
}

// The payload literal, read out of the form's own `onSubmit({ ... })`.
function sentBy(file, fn) {
  const src = readSource(file)
  const at = src.indexOf(fn)
  expect(at, `${fn} not found in ${file} — did it move or get renamed?`).toBeGreaterThan(-1)
  let end = src.length
  const nx = src.slice(at + fn.length).search(/\n(?:export )?function [A-Z]/)
  if (nx >= 0) end = at + fn.length + nx
  const body = src.slice(at, end)
  const call = body.indexOf('onSubmit({')
  expect(call, `${fn} has no onSubmit({ … }) payload`).toBeGreaterThan(-1)
  // To the matching close brace, counting depth so a nested object does not end it.
  let depth = 0
  let i = call + 'onSubmit('.length
  let stop = i
  for (; i < body.length; i++) {
    if (body[i] === '{') depth++
    else if (body[i] === '}') {
      depth--
      if (depth === 0) { stop = i; break }
    }
  }
  const payload = body.slice(call, stop)
  const keys = new Set()
  // `color,` and `tags,` are ES6 shorthand and just as much a sent field as
  // `note: note.trim()`. A pattern that read only the colon form reported both as
  // missing, which is a guard crying wolf about the two fields the owner said
  // must be on every form.
  for (const m of payload.matchAll(/^\s*(?:\.\.\.)?([a-z][a-z0-9_]*)\s*[,:]/gm)) keys.add(m[1])
  for (const m of payload.matchAll(/[\s{,]([a-z][a-z0-9_]*)\s*:/g)) keys.add(m[1])
  // A regex that matched nothing would pass every case below.
  expect(keys.size, `no keys parsed out of ${fn}'s payload`).toBeGreaterThan(5)
  return keys
}

describe('the edit forms send every column the add surface can set', () => {
  for (const { door, ctx, file, fn } of FORMS) {
    const label = ctx.mediaType ? `${door}/${ctx.mediaType}` : door
    it(`${label} → ${file}`, () => {
      const sent = sentBy(file, fn)
      const missing = fieldKeys(door, ctx)
        .map((k) => WIRE[k] || k)
        .filter((k) => !EXEMPT[k] && !sent.has(k))
      expect(missing, `${file}'s form would CLEAR these on every save — a PUT here is full-state`).toEqual([])
    })
  }

  // THE GUARD ITSELF HAS TO BE ABLE TO FAIL. A parse that silently found nothing
  // would report success over zero fields, which is how a source-reading guard
  // dies — and two of this repo's own guards had exactly that flaw.
  it('and would notice a form that sent nothing at all', () => {
    expect(() => sentBy('Library.jsx', 'function ThisFormDoesNotExist(')).toThrow()
  })
})
