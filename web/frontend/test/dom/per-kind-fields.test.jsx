// The boxes each kind of quote needs, and the suggestions behind them.
//
// WHY THIS FILE EXISTS. Three of these fields were added to a form in one release and
// one of them shipped INERT: the payload had two `character` keys, so the later
// carry-through won and the box wrote nothing. Vite printed "Duplicate key" and the
// build went on. No test typed into a field and looked at what was sent, which is the
// only check that would have caught it — so that is what every case here does.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { SRC } from '../src-files.js'

// The suggestion hook fetches the work's cast and (for a book) its chapters. Answered
// here so the comboboxes have something in them.
vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path) => {
    if (path.endsWith('/cast')) {
      return { ok: true, data: { cast: [{ character: 'Ahab', actor: '' }, { character: 'Ishmael', actor: '' }] } }
    }
    // The library-wide pool, for the two boxes that have no work to ask.
    if (path.startsWith('/search/vocabulary')) {
      return { ok: true, data: { speakers: ['Subhas Chandra Bose'], occasions: ['the Azad Hind address'], languages: [] } }
    }
    if (path.endsWith('/chapters')) {
      return { ok: true, data: { chapters: [{ no: 42, name: 'The Whale', count: 3 }, { no: 1, name: 'Loomings', count: 1 }] } }
    }
    return { ok: true, data: {} }
  }),
}))

const { AnnotationForm } = await import('../../src/Library.jsx')
const { DialogueForm } = await import('../../src/Movies.jsx')
const { UtteranceForm } = await import('../../src/Quotes.jsx')
const { t } = await import('../../src/i18n.js')

const flush = () => new Promise((r) => setTimeout(r, 0))

describe('a book highlight', () => {
  it('sends the character that was typed into it', async () => {
    // THE REGRESSION. This form had a Character box whose value was discarded by a
    // duplicate key in the same object literal.
    let sent = null
    render(
      <AnnotationForm
        initial={{ id: 5, book_id: 3, quote: 'call me Ishmael', character: '' }}
        onSubmit={(fields) => {
          sent = fields
          return null
        }}
        submitLabel="Save"
        bookId={3}
      />,
    )
    const box = document.querySelector(`input[placeholder="${t('book.quote.form.character.placeholder')}"]`)
    expect(box, 'no character box on the highlight form').toBeTruthy()
    fireEvent.change(box, { target: { value: 'Ahab' } })
    fireEvent.click(screen.getByText('Save'))
    await vi.waitFor(() => expect(sent).not.toBeNull())
    expect(sent.character, 'the character box wrote nothing').toBe('Ahab')
  })

  // THE EDIT FORM'S COPY OF THE PAIRING CHECK, and it is here rather than folded
  // into chapter-commit.test.jsx on purpose: that file drives the ADD surface, this
  // one drives the edit form, and the owner's point is that the two must behave
  // alike. One rule (`chapterPatch`), two callers, two tests that agree.

})

// A HOST THAT HANDS THE FORM NO CAST STILL OFFERS ONE.
//
// `DialogueForm` took its characters from a `cast` prop, and the favourites editor
// (Home.jsx) renders it through a per-kind registry that passes none — so editing a
// line from Home offered nothing while editing the SAME line from its work page
// offered the whole cast. Two spellings of one control, which is the rule this repo
// keeps restating.
//
// THE FIX IS IN THE FORM, NOT IN THE HOST, and the reason is the fourth host: a new
// screen rendering this form would arrive with the same gap. `AnnotationForm` has
// always worked this way — it takes an id and fetches its own pool — so this is the
// two of them agreeing rather than a new mechanism.

describe('a game’s line', () => {

  it('sends both, and sends no timestamp', async () => {
    let sent = null
    render(
      <DialogueForm
        initial={{ id: 9, quote: 'a bark', timestamp: '01:12:40' }}
        onSubmit={(fields) => {
          sent = fields
          return null
        }}
        submitLabel="Save"
        game
      />,
    )
    fireEvent.change(screen.getByLabelText(t('common.field.act.label')), { target: { value: 'Act II' } })
    fireEvent.change(screen.getByLabelText(t('common.field.quest.label')), { target: { value: 'The Battle' } })
    fireEvent.click(screen.getByText('Save'))
    await vi.waitFor(() => expect(sent).not.toBeNull())
    expect(sent.act).toBe('Act II')
    expect(sent.quest).toBe('The Battle')
    // A stale timestamp is NOT carried back: the form no longer shows the box, and
    // the server clears the column for a game anyway.
    expect(sent.timestamp).toBe('')
  })

})

// A STANDALONE QUOTE'S TWO BOXES, AND THE POOL THEY HAD TO BORROW.
//
// Speaker and occasion were the last pair in the app still typed from memory.
// Every other locator gained a pool from the work it belongs to — and these two
// have no work, which is what standalone means, so `useWorkSuggestions` could
// never serve them. Their pool is the library's own.
//
// `occasions` DID NOT EXIST ON THE SERVER until this shipped. `speakers` was there
// because SEARCH asks for it (`speaker:` is a facet) and `occasion:` is not — so
// the list nobody could search by was the list nobody had written.

// THE OFFER CHIP ANSWERS A KEY, AND IT HAD TO BE A LOCAL ONE.
//
// `docs/plans/entry-helpers.md` designed this as a `keys.js` binding and argued at
// length about WHICH key: bare digits cannot work, because the fields these chips
// sit beside are numeric inputs and the chip appears BECAUSE you are typing in one,
// so `1` has to type `1`. The key choice was right. What the plan never read is
// `keys.js`'s own dispatcher, which returns on any typing target — so a binding
// routed through the registry is dead exactly where this control lives.
//
// So `keys.js` owns the binding's NAME and label (`offer-accept`, printed on the
// chip) and `OfferChip` owns the firing. These cases are the difference between
// those two claims: the first proves the key reaches the chip while the caret is in
// a field, which is the case the registry route could not have served.
describe('the offer chip’s key', () => {
  // The same steps as "never overwrites a number already there" above, which is
  // the state that RAISES an offer: a number already typed, then a chapter name
  // the library records against a different one.
  const openWithOffer = async () => {
    render(<AnnotationForm initial={{ id: 5, book_id: 3, quote: 'x' }} onSubmit={() => null} submitLabel="Save" bookId={3} />)
    await flush()
    const name = screen.getByLabelText(t('common.field.chapter-name.label'))
    const no = screen.getByLabelText(t('common.field.chapter-no.label'))
    fireEvent.change(no, { target: { value: '7' } })
    fireEvent.change(name, { target: { value: 'Loomings' } })
    fireEvent.blur(name)
    await vi.waitFor(() => expect(no.value, 'no offer was raised, so this proves nothing').toBe('7'))
    return no
  }

  it('takes the offer with the caret still in the field', async () => {
    const no = await openWithOffer()
    const chip = await screen.findByRole('button', { name: /1/ })
    expect(chip, 'no offer chip appeared').toBeTruthy()

    // THE CARET IS IN THE NUMBER BOX, which is the whole case: the global
    // dispatcher returns on a typing target, so this press could only ever be
    // heard by the chip itself.
    no.focus()
    fireEvent.keyDown(window, { key: '1', code: 'Digit1', altKey: true })
    await vi.waitFor(() => expect(no.value, 'Alt+1 did not take the offer').toBe('1'))
  })

})
