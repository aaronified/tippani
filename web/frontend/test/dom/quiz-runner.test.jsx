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

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    SENT.push({ method, path, body })
    // RESP lets one case stand in a different reply — a cloze grade comes back
    // with the words and, when it was one, the fact that it was a synonym.
    return { ok: true, data: RESP || { ok: true, stability: 7, status: 'remembered' } }
  }),
}))

const { QuizRunner } = await import('../../src/review.jsx')

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

  // The prompt side. A "source" card shows the words and asks where they came
  // from, so the attribution must not be on screen — it is the answer.
  it('does not show the attribution on a card that asks for it', () => {
    render(<QuizRunner mode="daily" cards={[mcq()]} />)
    expect(screen.getByText('the only way out is through')).toBeTruthy()
    expect(screen.queryByText('Austen')).toBeNull()
  })
})

describe('a flip card', () => {
  it('hides the answer until it is asked for', () => {
    render(<QuizRunner mode="daily" cards={[flip()]} />)
    expect(screen.getByText('a scrupulous fidelity')).toBeTruthy()
    expect(screen.queryByText('Middlemarch')).toBeNull()
    expect(screen.getByText('Show me')).toBeTruthy()
  })

  // Revealing is NOT answering. Posting on the reveal would turn self-grading
  // into a button you press to make the card go away.
  it('posts nothing when the answer is revealed', () => {
    render(<QuizRunner mode="daily" cards={[flip()]} />)
    fireEvent.click(screen.getByText('Show me'))
    expect(screen.getByText('Middlemarch')).toBeTruthy()
    expect(posted()).toHaveLength(0)
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

  it('takes Forgot as readily as Got it', async () => {
    render(<QuizRunner mode="daily" cards={[flip()]} />)
    fireEvent.click(screen.getByText('Show me'))
    fireEvent.click(screen.getByText('Forgot'))
    await waitFor(() => expect(posted()).toHaveLength(1))
    expect(posted()[0].body.result).toBe('forgot')
  })

  // Skipping after the reveal would be a way to read the answer and move on
  // without ever saying whether you knew it.
  it('withdraws skip once the answer is on screen', () => {
    render(<QuizRunner mode="practice" allowSkip cards={[flip(), mcq()]} />)
    expect(screen.getByText('skip')).toBeTruthy()
    fireEvent.click(screen.getByText('Show me'))
    expect(screen.queryByText('skip')).toBeNull()
  })
})

// An older client meeting a newer server. The direction is unknown, so there is
// nothing to render it as — except the one card type that needs no options.
it('renders an unknown direction as a flip card rather than as nothing', () => {
  render(<QuizRunner mode="daily" cards={[flip({ direction: 'something-new' })]} />)
  expect(screen.getByText('Show me')).toBeTruthy()
  expect(screen.queryByText('Middlemarch')).toBeNull()
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

  it('says nothing until the card has been answered', () => {
    render(<QuizRunner mode="daily" cards={[leechy()]} />)
    // ANCHORED ON A CARD THAT IS ACTUALLY THERE. Every assertion below is an
    // absence, and an absence is also what a runner that failed to mount leaves
    // behind — so without this line the test passes hardest when the screen is
    // most broken.
    expect(screen.getByText('Emma'), 'the card did not render at all').toBeTruthy()
    expect(screen.queryByText('Set it aside')).toBeNull()
  })

  it('offers a way out once the answer is in', async () => {
    render(<QuizRunner mode="daily" cards={[leechy()]} />)
    fireEvent.click(screen.getByText('Emma'))
    await waitFor(() => expect(screen.getByText('Set it aside')).toBeTruthy())
    expect(screen.getByText(/forgotten 5 times/)).toBeTruthy()
  })

  it('never appears for a card that is not a leech', async () => {
    render(<QuizRunner mode="daily" cards={[mcq({ leech: false, lapse_count: 2 })]} />)
    fireEvent.click(screen.getByText('Emma'))
    await waitFor(() => expect(posted()).toHaveLength(1))
    expect(screen.queryByText('Set it aside')).toBeNull()
  })

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

  it('lets the reader keep being asked, and stops offering for the session', async () => {
    render(<QuizRunner mode="daily" cards={[leechy()]} />)
    fireEvent.click(screen.getByText('Emma'))
    await waitFor(() => expect(screen.getByText('Keep asking')).toBeTruthy())
    fireEvent.click(screen.getByText('Keep asking'))
    expect(screen.queryByText('Set it aside')).toBeNull()
    expect(SENT.some((s) => s.path.endsWith('/bulk'))).toBe(false)
  })

  // A film line and a standalone quote are the same offer through different
  // endpoints — the schedule names its kinds book/screen/utterance and the bulk
  // routes name the rows annotation/dialogue/quote.
  it('reaches the right endpoint for a film line', async () => {
    render(<QuizRunner mode="daily" cards={[leechy({ kind: 'screen', id: 9 })]} />)
    fireEvent.click(screen.getByText('Emma'))
    await waitFor(() => expect(screen.getByText('Set it aside')).toBeTruthy())
    fireEvent.click(screen.getByText('Set it aside'))
    await waitFor(() => expect(SENT.some((s) => s.path === '/dialogues/bulk')).toBe(true))
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
  it('posts nothing when an option is chosen', () => {
    render(<QuizRunner mode="daily" submitStep cards={[mcq()]} />)
    fireEvent.click(screen.getByText('Emma'))
    expect(posted()).toHaveLength(0)
    expect(screen.getByText('Submit')).toBeTruthy()
  })

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

  // THE LEAK THE SPLIT CREATES. The wrong-answer styling read `chosen &&
  // !isAnswer`, which was safe only while a chosen option was necessarily a
  // graded one. Without an explicit commit test, selecting a wrong option paints
  // it red — telling you it is wrong while you can still change it.
  it('says nothing about whether the choice is right until it is submitted', () => {
    render(<QuizRunner mode="daily" submitStep cards={[mcq()]} />)
    fireEvent.click(screen.getByText('Emma')) // the wrong one

    // THE STYLING, not the verdict line. The verdict is gated on the commit by a
    // different expression, so checking it would pass while the option itself
    // sat there painted red — which is the actual leak, and is how the first
    // version of this test managed to pass against the bug it names.
    const optionStyle = (label) => screen.getByText(label).closest('button').getAttribute('style') || ''
    expect(optionStyle('Emma'), 'the wrong choice is marked wrong before it is submitted').not.toMatch(/--error/)
    expect(optionStyle('Persuasion'), 'the right answer is revealed before submitting').not.toMatch(/--ok/)
    expect(screen.queryByText('not quite')).toBeNull()

    fireEvent.click(screen.getByText('Submit'))
    expect(optionStyle('Emma')).toMatch(/--error/)
    expect(optionStyle('Persuasion')).toMatch(/--ok/)
    expect(screen.getByText('not quite')).toBeTruthy()
  })

  it('is off by default, and a tap still grades immediately', async () => {
    render(<QuizRunner mode="daily" cards={[mcq()]} />)
    fireEvent.click(screen.getByText('Emma'))
    await waitFor(() => expect(posted()).toHaveLength(1))
    expect(screen.queryByText('Submit')).toBeNull()
  })

  // A flip card is already two acts — reveal, then say whether you had it — so a
  // confirmation on top would be asking twice.
  it('does not add a second step to a flip card', async () => {
    render(<QuizRunner mode="daily" submitStep cards={[flip()]} />)
    fireEvent.click(screen.getByText('Show me'))
    fireEvent.click(screen.getByText('Got it'))
    await waitFor(() => expect(posted()).toHaveLength(1))
    expect(screen.queryByText('Submit')).toBeNull()
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

  it('asks for the missing words and carries no answer', () => {
    render(<QuizRunner mode="daily" cards={[clz()]} />)
    expect(screen.getByText(/Fill in the blank/)).toBeTruthy()
    expect(screen.getByPlaceholderText(/type what belongs/)).toBeTruthy()
    // Not a flip card: it must not offer to reveal, because there is nothing
    // here to reveal from.
    expect(screen.queryByText('Show me')).toBeNull()
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

  it('will not submit an empty attempt', () => {
    render(<QuizRunner mode="daily" cards={[clz()]} />)
    fireEvent.click(screen.getByText('Check'))
    expect(posted()).toHaveLength(0)
  })

  // The confirm step is for multiple choice. Typing an answer and pressing
  // Check is already a submit step; a confirmation on top would be asking twice.
  it('is not given a second confirm step', () => {
    render(<QuizRunner mode="daily" submitStep cards={[clz()]} />)
    fireEvent.change(screen.getByPlaceholderText(/type what belongs/), { target: { value: 'x' } })
    expect(screen.queryByText('Submit')).toBeNull()
    expect(screen.getByText('Check')).toBeTruthy()
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

  it('asks the question and offers actors', () => {
    render(<QuizRunner mode="daily" cards={[spk()]} />)
    expect(screen.getByText('Who says this?')).toBeTruthy()
    expect(screen.getByText("Don't let yourself get attached")).toBeTruthy()
    for (const a of ['Al Pacino', 'Robert De Niro', 'Val Kilmer']) {
      expect(screen.getAllByText(a).length).toBeGreaterThan(0)
    }
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

  it('grades the pick like any other multiple choice', async () => {
    render(<QuizRunner mode="daily" cards={[spk()]} />)
    fireEvent.click(screen.getAllByText('Al Pacino')[0])
    await waitFor(() => expect(posted()).toHaveLength(1))
    expect(posted()[0].body.result).toBe('forgot')
  })
})

// ---- a cloze answer that was a synonym -------------------------------------
//
// The server grades a typed blank and pays a synonym less than the word itself.
// The reader has to be told which of the two right answers theirs was, or the
// schedule moves by an amount they have no way to account for.
describe('a fill-in-the-blank graded as a synonym', () => {
  const blank = () => ({
    kind: 'book', id: 4, direction: 'cloze', color: 'yellow',
    quote: 'it is a truth ￼ acknowledged', title: 'Pride and Prejudice', options: [], answer: 0,
  })

  it('says so beside the words', async () => {
    RESP = { ok: true, result: 'got', answer: 'universally', synonym: true }
    render(<QuizRunner mode="daily" cards={[blank()]} />)
    fireEvent.change(screen.getByPlaceholderText(/type what belongs/), { target: { value: 'widely' } })
    fireEvent.click(screen.getByText('Check'))
    await screen.findByText('universally')
    expect(screen.getByText(/counted as a synonym/)).toBeTruthy()
  })

  it('says nothing of the sort when the answer was the word', async () => {
    RESP = { ok: true, result: 'got', answer: 'universally' }
    render(<QuizRunner mode="daily" cards={[blank()]} />)
    fireEvent.change(screen.getByPlaceholderText(/type what belongs/), { target: { value: 'universally' } })
    fireEvent.click(screen.getByText('Check'))
    await screen.findByText('universally')
    expect(screen.queryByText(/counted as a synonym/)).toBeNull()
  })
})

// ---- what is drawn beside an option (3.0) ----------------------------------
//
// ONE RULE: a work is shown by its picture, a person by their chip. A film
// option used to wear the face of one of its actors — a person's portrait under
// a thing that is not a person, on the one card whose job is to ask which of
// four things this is, while the film's own poster went undrawn.
describe('what an option is drawn as', () => {
  const withArt = () => mcq({
    option_meta: [
      { art: 'persuasion.jpg' },
      { art: 'emma.jpg' },
      { art: '' }, // a work whose cover was never fetched
    ],
  })

  // THE CONTRACT, NOT THE CURRENT PAYLOAD. The server sends art OR a person, so
  // a card carrying both is not something it produces today — which is exactly
  // why the rule has to be asserted here: it is the client that decides what a
  // work option looks like, and "we happen not to send a face" is not the same
  // promise as "a work option never wears one".
  it('draws the cover and not the face when a card carries both', () => {
    render(<QuizRunner mode="daily" cards={[mcq({
      option_meta: [
        { art: 'persuasion.jpg', person: 'Austen', kind: 'author' },
        { art: 'emma.jpg', person: 'Austen', kind: 'author' },
        { art: '', person: 'Brontë', kind: 'author' },
      ],
    })]} />)
    expect(document.querySelector('img[src*="persuasion.jpg"]')).toBeTruthy()
    expect(screen.queryByText('Austen')).toBeNull()
    expect(screen.queryByText('Brontë')).toBeNull()
  })

  it('gives a work option its cover and no face', () => {
    const { container } = render(<QuizRunner mode="daily" cards={[withArt()]} />)
    const srcs = [...container.querySelectorAll('img')].map((i) => i.getAttribute('src'))
    expect(srcs.some((s) => s.includes('persuasion.jpg'))).toBe(true)
    expect(srcs.some((s) => s.includes('emma.jpg'))).toBe(true)
    // No portrait, because none of these options is a person.
    expect(screen.queryByText('Austen')).toBeNull()
  })

  // The slot is reserved whether or not a given work has art, so four options
  // start at the same x rather than stepping in and out with the covers.
  it('still reserves the slot for a work with no cover', () => {
    const { container } = render(<QuizRunner mode="daily" cards={[withArt()]} />)
    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(0)
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

  it('says nothing about where any of them came from until it is answered', () => {
    render(<QuizRunner mode="daily" cards={[which()]} />)
    expect(screen.getByText('a line of theirs'), 'the card did not render at all').toBeTruthy()
    expect(screen.queryByText(/from Moby-Dick/)).toBeNull()
    expect(seen()).toHaveLength(0)
  })

  it('names all four sources once the answer is in', async () => {
    render(<QuizRunner mode="daily" cards={[which()]} />)
    fireEvent.click(screen.getByText('a line of theirs'))
    await waitFor(() => expect(posted()).toHaveLength(1))
    expect(screen.getByText('from Moby-Dick')).toBeTruthy()
    expect(screen.getByText('from Middlemarch')).toBeTruthy()
  })

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

  // THE CARD OBJECT IS REPLACED UNDER THE RUNNER IN NORMAL USE — an in-card edit
  // patches it, and a host that re-renders hands down a fresh deck array — which
  // is what the effect's guard is actually for. Before this case existed, the
  // "reports once" test below passed against a runner with no guard at all: it
  // only clicked things that change no dependency.
  it('reports them once when the card object is handed down again', async () => {
    const { rerender } = render(<QuizRunner mode="daily" cards={[which()]} />)
    fireEvent.click(screen.getByText('a line of ours'))
    await waitFor(() => expect(seen()).toHaveLength(2))
    rerender(<QuizRunner mode="daily" cards={[which()]} />)
    await waitFor(() => expect(posted()).toHaveLength(1))
    expect(seen()).toHaveLength(2)
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

// ---- fill in the blank, with choices ---------------------------------------
//
// The same hole in the same words, answered by picking rather than typing. The
// client tells the two apart by whether there is anything to pick — which is
// also what makes an unknown direction from a newer server degrade sensibly.
describe('a cloze card with choices', () => {
  const blanked = (over = {}) => ({
    kind: 'book', id: 3, direction: 'cloze-mcq', color: 'green',
    quote: 'it is a truth ￼ acknowledged',
    title: 'Pride and Prejudice', author: 'Austen',
    options: ['universally', 'privately', 'grudgingly'], answer: 0, ...over,
  })

  it('offers the phrases instead of a box to type into', () => {
    render(<QuizRunner mode="daily" cards={[blanked()]} />)
    expect(screen.getByText('Which words belong in the blank?')).toBeTruthy()
    expect(screen.getByText('universally')).toBeTruthy()
    expect(screen.queryByPlaceholderText(/type what belongs/)).toBeNull()
  })

  it('grades the pick like any other multiple choice', async () => {
    render(<QuizRunner mode="daily" cards={[blanked()]} />)
    fireEvent.click(screen.getByText('privately'))
    await waitFor(() => expect(posted()).toHaveLength(1))
    expect(posted()[0].body.result).toBe('forgot')
    // NOT as a cloze attempt: the answer was on the card, so the server has
    // nothing to grade that the client did not already know.
    expect(posted()[0].body.attempt).toBeUndefined()
  })

  // The typed cloze is the same blank with nothing offered, and it must still
  // take the typing path.
  it('leaves a blank with no options as something to type', () => {
    render(<QuizRunner mode="daily" cards={[blanked({ direction: 'cloze', options: [] })]} />)
    expect(screen.getByPlaceholderText(/type what belongs/)).toBeTruthy()
  })
})

// ---- "who wrote this?" -----------------------------------------------------
describe('a “who wrote this?” card', () => {
  const wrote = (over = {}) => ({
    kind: 'book', id: 7, direction: 'author', color: 'pink',
    quote: 'you cannot buy the revolution', title: 'The Dispossessed', author: 'Ursula K. Le Guin',
    options: ['Frank Herbert', 'Ursula K. Le Guin', 'George Eliot'],
    option_meta: [
      { person: 'Frank Herbert', kind: 'author' },
      { person: 'Ursula K. Le Guin', kind: 'author' },
      { person: 'George Eliot', kind: 'author' },
    ],
    answer: 1, ...over,
  })

  it('asks the question and offers people', () => {
    render(<QuizRunner mode="daily" cards={[wrote()]} />)
    expect(screen.getByText('Who wrote this?')).toBeTruthy()
    expect(screen.getAllByText('Frank Herbert').length).toBeGreaterThan(0)
  })

  // The title is the answer to a different question and must not be on screen.
  it('does not print the book it is asking about', () => {
    render(<QuizRunner mode="daily" cards={[wrote()]} />)
    expect(screen.getByText('Who wrote this?'), 'the card did not render at all').toBeTruthy()
    expect(screen.queryByText('The Dispossessed')).toBeNull()
  })
})
