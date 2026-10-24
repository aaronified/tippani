// QuizRunner — the shared flow behind the Daily Quiz and Practice.
//
// IT HAD NO TESTS AT ALL until this file, which is how it came to be rewritten
// by six features in a row with nothing checking the path every current reader
// is actually on. The only thing that rendered it was a smoke test that mounts
// every screen with all requests refused, so it never reached an active deck.
//
// Two card shapes now share one state machine, and the risky part of that is
// what each of them REVEALS and WHEN. A card that shows its answer before the
// reader has committed is not a quiz.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

let SENT
let RESP

// The portrait map every person chip on a card is drawn from. Real rows, with
// image paths, because a chip with no photo behind it renders no photo — and a
// test that asserts nothing about the pictures cannot tell a working cluster
// from a broken lookup.
const PEOPLE = [
  { id: 1, kind: 'author', name: 'Ursula K. Le Guin', image_path: 'leguin.jpg' },
  { id: 2, kind: 'author', name: 'Stanisław Lem', image_path: 'lem.jpg' },
  { id: 3, kind: 'author', name: 'Austen', image_path: 'austen.jpg' },
]

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    SENT.push({ method, path, body })
    if (path.startsWith('/people')) return { ok: true, data: { people: PEOPLE } }
    // RESP lets one case stand in a different reply — a cloze grade comes back
    // with the words and, when it was one, the fact that it was a synonym.
    return { ok: true, data: RESP || { ok: true, stability: 7, status: 'remembered' } }
  }),
}))

const { QuizRunner } = await import('../../src/review.jsx')

// EVERY console.error THE FILE PRODUCES, from its first render, passed through
// unchanged. React reports an unknown prop ONCE per process, so a case that spied
// on the console only while it rendered saw nothing whenever an earlier case had
// already drawn a cloze card: with the defect back it passed in the whole file and
// failed only when run alone. Collected from the top, the warning is seen
// wherever it fires.
const consoleErrors = []
const consoleError = console.error
console.error = (...args) => { consoleErrors.push(args.map(String).join(' ')); consoleError(...args) }


const mcq = (over = {}) => ({
  kind: 'book', id: 1, direction: 'source', quote: 'the only way out is through',
  title: 'Persuasion', author: 'Austen', color: 'yellow',
  options: ['Persuasion', 'Emma', 'Villette'], answer: 0, ...over,
})

// A flip card is defined by having NO options — the client keys on that rather
// than on the direction string, so an unknown direction from a newer server
// degrades to the card type that always works.
const flip = (over = {}) => ({
  kind: 'book', id: 2, direction: 'flip', quote: 'a scrupulous fidelity',
  title: 'Middlemarch', author: 'Eliot', color: 'blue', options: [], answer: 0, ...over,
})

const posted = () => SENT.filter((s) => s.path === '/review/answer')

beforeEach(() => { SENT = []; RESP = null })

describe('a multiple-choice card', () => {
  it('grades on the tap and posts once', async () => {
    render(<QuizRunner mode="daily" cards={[mcq()]} />)
    fireEvent.click(screen.getByText('Emma'))
    await waitFor(() => expect(posted()).toHaveLength(1))
    expect(posted()[0].body.result).toBe('forgot')
    expect(screen.getByText('not quite')).toBeTruthy()
  })

  it('takes one answer per card, however many times it is tapped', async () => {
    render(<QuizRunner mode="daily" cards={[mcq()]} />)
    fireEvent.click(screen.getByText('Persuasion'))
    await waitFor(() => expect(posted()).toHaveLength(1))
    fireEvent.click(screen.getByText('Emma'))
    fireEvent.click(screen.getByText('Villette'))
    expect(posted()).toHaveLength(1)
    expect(posted()[0].body.result).toBe('got')
  })

})

describe('a flip card', () => {
  it('hides the answer until it is asked for', () => {
    render(<QuizRunner mode="daily" cards={[flip()]} />)
    expect(screen.getByText('a scrupulous fidelity')).toBeTruthy()
    expect(screen.queryByText('Middlemarch')).toBeNull()
    expect(screen.getByText('Show me')).toBeTruthy()
  })

  it('records the reader’s own verdict, and only theirs', async () => {
    render(<QuizRunner mode="daily" cards={[flip()]} />)
    fireEvent.click(screen.getByText('Show me'))
    fireEvent.click(screen.getByText('Got it'))
    await waitFor(() => expect(posted()).toHaveLength(1))
    expect(posted()[0].body.result).toBe('got')
    // ...and it reports what the reader said rather than marking their homework.
    expect(screen.getByText('recalled')).toBeTruthy()
    expect(screen.queryByText('correct')).toBeNull()
  })

})

// ---- the leech offer -------------------------------------------------------
//
// A card forgotten five times over costs a slot in every deck and gives nothing
// back, and until now the only way to stop being asked was to delete the quote.
//
// The two rules that matter are about WHEN it appears. Never before the answer —
// the card is still asked, and the offer is what you do with the answer once it
// is in. And never automatically: nothing is suspended on the app's own
// initiative, because a card vanishing because a counter reached five is a
// decision nobody asked it to make.
describe('the leech offer', () => {
  const leechy = (over = {}) => mcq({ leech: true, lapse_count: 5, ...over })

  // Nothing is suspended by answering. The only thing that takes a card out of
  // the deck is the reader pressing the button that says so.
  it('takes the card out only when asked, and by the bulk route that writes the flag', async () => {
    render(<QuizRunner mode="daily" cards={[leechy()]} />)
    fireEvent.click(screen.getByText('Emma'))
    await waitFor(() => expect(screen.getByText('Set it aside')).toBeTruthy())
    expect(SENT.some((s) => s.path.endsWith('/bulk'))).toBe(false)

    fireEvent.click(screen.getByText('Set it aside'))
    await waitFor(() => expect(SENT.some((s) => s.path === '/annotations/bulk')).toBe(true))
    const call = SENT.find((s) => s.path === '/annotations/bulk')
    expect(call.body).toEqual({ ids: [1], review: false })
  })

})

// ---- the submit step -------------------------------------------------------
//
// Roadmap §2 asked for "undo the last answer". An exact undo needs the previous
// half-life, which nothing stores — so the MISCLICK it exists to protect against
// is prevented instead: a tap selects, a button commits, and until then the
// choice can be changed freely.
//
// The dangerous half is not the button. It is that "chosen" and "graded" used to
// be the same fact, and every reveal in the card was written against that. Split
// them and leave one reveal reading the selection, and the card tells you the
// answer while you can still change it.
describe('the submit step', () => {
  it('lets the choice be changed, and grades the last one', async () => {
    render(<QuizRunner mode="daily" submitStep cards={[mcq()]} />)
    fireEvent.click(screen.getByText('Emma'))
    fireEvent.click(screen.getByText('Villette'))
    fireEvent.click(screen.getByText('Persuasion'))
    expect(posted()).toHaveLength(0)
    fireEvent.click(screen.getByText('Submit'))
    await waitFor(() => expect(posted()).toHaveLength(1))
    expect(posted()[0].body.result).toBe('got')
  })

})

// ---- cloze -----------------------------------------------------------------
//
// The server sends the quote with a hole in it and keeps the answer. Unlike an
// MCQ — whose `answer` is an index that means nothing without the options — the
// cloze answer IS the words being recalled, so it is graded on the server and
// the browser is never in a position to leak it.
describe('a cloze card', () => {
  const BLANK = '\uFFFC'
  const clz = (over = {}) => ({
    kind: 'book', id: 3, direction: 'cloze',
    quote: `It is a truth ${BLANK} that a single man in possession of a good fortune`,
    title: 'Pride and Prejudice', color: 'yellow', options: [], answer: 0, ...over,
  })

  it('sends the attempt for the server to grade', async () => {
    render(<QuizRunner mode="daily" cards={[clz()]} />)
    fireEvent.change(screen.getByPlaceholderText(/type what belongs/), {
      target: { value: 'universally acknowledged' },
    })
    fireEvent.click(screen.getByText('Check'))
    await waitFor(() => expect(posted()).toHaveLength(1))
    expect(posted()[0].body.attempt).toBe('universally acknowledged')
  })

})

// ---- who said this ---------------------------------------------------------
//
// Options are ACTORS, not characters — the reviewer picks a face. The prompt is
// the line alone, which matters more here than on any other card: the attribution
// side of a screen card prints the actor as a chip and the character in its meta
// line, so showing it would put the answer directly above the options.
describe('a "who said this" card', () => {
  const spk = (over = {}) => ({
    kind: 'screen', id: 5, direction: 'speaker', media_type: 'movie',
    quote: "Don't let yourself get attached", title: 'Heat',
    character: 'Neil', actor: 'Robert De Niro', color: 'yellow',
    options: ['Al Pacino', 'Robert De Niro', 'Val Kilmer', 'Jon Voight'],
    option_meta: [
      { person: 'Al Pacino', kind: 'actor' },
      { person: 'Robert De Niro', kind: 'actor' },
      { person: 'Val Kilmer', kind: 'actor' },
      { person: 'Jon Voight', kind: 'actor' },
    ],
    answer: 1, ...over,
  })

  // THE LEAK THIS CARD TYPE WOULD OTHERWISE HAVE. Before the prompt side was
  // narrowed to the "quote" direction, every non-source card rendered the
  // attribution — actor chip and all — directly above its own options.
  it('does not print the character, which is the answer by another name', () => {
    render(<QuizRunner mode="daily" cards={[spk()]} />)
    // The card is on screen first — see the leech offer above for why an
    // absence-only assertion needs one.
    expect(screen.getAllByText('Al Pacino').length, 'the card did not render at all').toBeGreaterThan(0)
    expect(screen.queryByText('Neil')).toBeNull()
    // The film's title is not shown either: it is not asked for, and the meta
    // line that carries it also carries the character.
    expect(screen.queryByText(/Film ·/)).toBeNull()
  })

})

// ---- "which quote?" names its options once it is answered ------------------
describe('a “which quote is from this work?” card', () => {
  const which = (over = {}) => ({
    kind: 'book', id: 1, direction: 'quote', quote: 'the only way out is through',
    title: 'Persuasion', author: 'Austen', color: 'yellow', art: 'persuasion.jpg',
    options: ['a line of ours', 'a line of theirs', 'a third line'],
    option_meta: [
      { source: 'Persuasion', art: 'persuasion.jpg', item_kind: 'book', item_id: 1 },
      { source: 'Moby-Dick', art: 'moby.jpg', item_kind: 'book', item_id: 20 },
      { source: 'Middlemarch', art: '', item_kind: 'utterance', item_id: 30 },
    ],
    answer: 0, ...over,
  })

  const seen = () => SENT.filter((s) => s.path === '/review/seen')

  // READING THEM COUNTS AS SEEING THEM, priced by the reader's own srSeen. Never
  // the card being graded: its own answer moves the schedule properly, and a
  // seeing on top would pay it twice.
  it('reports the other quotes as seen, and never the card itself', async () => {
    render(<QuizRunner mode="daily" cards={[which()]} />)
    fireEvent.click(screen.getByText('a line of ours'))
    await waitFor(() => expect(seen()).toHaveLength(2))
    expect(seen().map((s) => s.body)).toEqual([
      { kind: 'book', id: 20 },
      { kind: 'utterance', id: 30 },
    ])
  })

  it('reports them once, however long the card stays on screen', async () => {
    render(<QuizRunner mode="daily" cards={[which()]} />)
    fireEvent.click(screen.getByText('a line of ours'))
    await waitFor(() => expect(seen()).toHaveLength(2))
    fireEvent.click(screen.getByText('a line of theirs'))
    fireEvent.click(screen.getByText('a third line'))
    expect(seen()).toHaveLength(2)
  })
})
