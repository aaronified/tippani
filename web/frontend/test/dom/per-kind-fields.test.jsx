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

  it('offers the book’s own cast and its own chapters', async () => {
    render(<AnnotationForm initial={{ id: 5, book_id: 3, quote: 'x' }} onSubmit={() => null} submitLabel="Save" bookId={3} />)
    await flush()
    // EVERY ONE OF THE THREE IS A REAL DROPDOWN NOW, on the owner's ask: "tag,
    // character, chapter name, and number will be comboboxes based on the available
    // items." The chapter pair kept a native datalist until then, and a datalist on
    // desktop Chrome shows nothing until you have typed — fatal for a list you open
    // the box in order to be reminded of.
    //
    // Asserted through what is ON SCREEN rather than through the fetch: a list
    // nobody can see is not a suggestion.
    const shown = (label) => {
      fireEvent.focus(screen.getByLabelText(label))
      return screen.getAllByRole('option').map((o) => o.textContent)
    }
    expect(shown(t('common.field.chapter-name.label')), 'the chapter names are not offered').toContain('The Whale')
    expect(shown(t('common.field.chapter-no.label')), 'the chapter numbers are not offered').toContain('42')
    expect(shown(t('common.field.character.label')), 'the cast is not offered').toContain('Ahab')
  })

  // THE EDIT FORM'S COPY OF THE PAIRING CHECK, and it is here rather than folded
  // into chapter-commit.test.jsx on purpose: that file drives the ADD surface, this
  // one drives the edit form, and the owner's point is that the two must behave
  // alike. One rule (`chapterPatch`), two callers, two tests that agree.
  it('fills an empty chapter number from the name — on commit, not mid-word', async () => {
    render(<AnnotationForm initial={{ id: 5, book_id: 3, quote: 'x' }} onSubmit={() => null} submitLabel="Save" bookId={3} />)
    await flush()
    const name = screen.getByLabelText(t('common.field.chapter-name.label'))
    const no = screen.getByLabelText(t('common.field.chapter-no.label'))

    // Typing changes the text and nothing else. The owner found the old behaviour by
    // typing a two-digit chapter: "the chapter name is assigned at typing 1 and then
    // no rewrites".
    fireEvent.change(name, { target: { value: 'The Whal' } })
    expect(no.value, 'the number was filled from a half-typed name').toBe('')

    fireEvent.change(name, { target: { value: 'The Whale' } })
    fireEvent.blur(name)
    await vi.waitFor(() => expect(no.value, 'the number was not filled from the name').toBe('42'))
  })

  it('and never overwrites a number already there — it offers instead', async () => {
    render(<AnnotationForm initial={{ id: 5, book_id: 3, quote: 'x' }} onSubmit={() => null} submitLabel="Save" bookId={3} />)
    await flush()
    const name = screen.getByLabelText(t('common.field.chapter-name.label'))
    const no = screen.getByLabelText(t('common.field.chapter-no.label'))

    fireEvent.change(no, { target: { value: '7' } })
    fireEvent.change(name, { target: { value: 'Loomings' } })
    fireEvent.blur(name)
    // A suggestion that edits what you have just typed is the form arguing with you.
    await vi.waitFor(() => expect(no.value, 'the number was overwritten').toBe('7'))
    // And refusing to overwrite with no way back is a trap, so the pool's answer is
    // one tap away.
    fireEvent.click(await screen.findByRole('button', { name: /1/ }))
    await vi.waitFor(() => expect(no.value).toBe('1'))
  })
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
describe('a dialogue form whose host passed no cast', () => {
  it('fetches the work’s own characters rather than offering none', async () => {
    // No `cast` prop at all — exactly what Home.jsx renders.
    render(<DialogueForm initial={{ id: 9, movie_id: 4, quote: 'a bark' }} onSubmit={() => null} submitLabel="Save" />)
    const box = screen.getByLabelText(t('film.line.form.characters.aria'))
    fireEvent.focus(box)
    fireEvent.change(box, { target: { value: 'Ah' } })
    // `Ahab` comes from the mocked /cast above, so seeing it here means the form
    // asked. Before the fix this list was empty whatever was typed.
    expect(await screen.findByText('Ahab'), 'the form offered no character to a host that passed none').toBeTruthy()
  })

  it('and prefers the cast it WAS handed, without a second request', async () => {
    // A work page has already paid for its cast list. Re-reading a fetched copy
    // would flicker the box as it arrived, and would spend a request to learn what
    // the caller already knew.
    const { json } = await import('../../src/api.js')
    json.mockClear()
    render(
      <DialogueForm
        initial={{ id: 9, movie_id: 4, quote: 'a bark' }}
        onSubmit={() => null}
        submitLabel="Save"
        cast={[{ character: 'Renault', actor: 'Claude Rains' }]}
      />,
    )
    const box = screen.getByLabelText(t('film.line.form.characters.aria'))
    fireEvent.focus(box)
    fireEvent.change(box, { target: { value: 'Ren' } })
    expect(await screen.findByText('Renault')).toBeTruthy()
    await flush()
    const castCalls = json.mock.calls.filter(([, path]) => String(path).endsWith('/cast'))
    expect(castCalls, 'a cast was fetched over the one the caller supplied').toEqual([])
  })
})

describe('a game’s line', () => {
  it('asks for the act and the quest, and not for a timestamp', () => {
    render(<DialogueForm initial={{ id: 9, quote: 'a bark' }} onSubmit={() => null} submitLabel="Save" game />)
    expect(screen.getByLabelText(t('common.field.act.label'))).toBeTruthy()
    expect(screen.getByLabelText(t('common.field.quest.label'))).toBeTruthy()
    // The box the server discards.
    expect(screen.queryByLabelText(t('common.field.timestamp.label'))).toBeNull()
  })

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

  it('leaves a film’s line exactly as it was', async () => {
    let sent = null
    render(
      <DialogueForm
        initial={{ id: 9, quote: 'here is looking at you', timestamp: '01:12:40', act: 'kept', quest: 'kept' }}
        onSubmit={(fields) => {
          sent = fields
          return null
        }}
        submitLabel="Save"
      />,
    )
    expect(screen.getByLabelText(t('common.field.timestamp.label'))).toBeTruthy()
    expect(screen.queryByLabelText(t('common.field.act.label'))).toBeNull()
    fireEvent.click(screen.getByText('Save'))
    await vi.waitFor(() => expect(sent).not.toBeNull())
    expect(sent.timestamp).toBe('01:12:40')
    // And a film's line carries whatever act and quest it somehow had, rather than
    // being cleared by a form that does not show them.
    expect(sent.act).toBe('kept')
    expect(sent.quest).toBe('kept')
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
describe('a standalone quote', () => {
  const box = (key) => screen.getByLabelText(t(`common.field.${key}.label`))

  it('offers the speakers the library already knows', async () => {
    render(<UtteranceForm initial={{ id: 3, quote: 'a spoken line', kind: 'speech' }} onSubmit={() => null} onCancel={() => {}} submitLabel="Save" />)
    const el = box('speaker')
    fireEvent.focus(el)
    fireEvent.change(el, { target: { value: 'Bos' } })
    expect(await screen.findByText('Subhas Chandra Bose'), 'the speaker box offered nothing').toBeTruthy()
  })

  it('and the occasions too', async () => {
    render(<UtteranceForm initial={{ id: 3, quote: 'a spoken line', kind: 'speech' }} onSubmit={() => null} onCancel={() => {}} submitLabel="Save" />)
    const el = box('occasion')
    fireEvent.focus(el)
    fireEvent.change(el, { target: { value: 'Azad' } })
    expect(await screen.findByText('the Azad Hind address'), 'the occasion box offered nothing').toBeTruthy()
  })

  it('but neither is a cage — a name nobody has used still types', async () => {
    // Every field this serves is optional free text at the API. A pool that
    // restricted would turn a helper into a form that refuses new answers, which
    // is the one outcome worse than no helper.
    let sent = null
    render(
      <UtteranceForm
        initial={{ id: 3, quote: 'a spoken line', kind: 'speech' }}
        onSubmit={(fields) => { sent = fields; return null }}
        onCancel={() => {}}
        submitLabel="Save"
      />,
    )
    fireEvent.change(box('speaker'), { target: { value: 'Someone Entirely New' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await vi.waitFor(() => expect(sent, 'the form never submitted').toBeTruthy())
    expect(sent.speaker, 'a speaker outside the pool did not survive the save').toBe('Someone Entirely New')
  })
})

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

  it('and a bare 1 still types a 1', async () => {
    // The reason the plan chose a modifier, and the reason it is worth pinning:
    // this field is numeric, and a route that ate the digit would be printed on
    // the chip and broken exactly where the feature lives.
    const no = await openWithOffer()
    const chip = await screen.findByRole('button', { name: /1/ })
    no.focus()
    fireEvent.keyDown(window, { key: '1', code: 'Digit1' })
    // THE BOX IS UNTOUCHED AND THE CHIP IS STILL THERE. Asserting a later typed
    // value instead would prove nothing: a `change` event sets the box outright,
    // so it would overwrite an offer the bare key had wrongly taken and pass
    // either way. This was that test for one revision, and a mutation firing the
    // handler on a bare digit walked straight past it.
    expect(no.value, 'a bare digit took the offer — the modifier is not being checked').toBe('7')
    expect(chip.isConnected, 'the offer was accepted by a bare digit').toBe(true)
  })

  it('and asks the registry for the key rather than spelling one', async () => {
    // READ FROM THE SOURCE, not the DOM, and that is forced rather than lazy:
    // `Tooltip`'s bubble is script-driven (ui.jsx — "it can be asked for directly,
    // with no DOM at all"), so the key is nowhere in the tree until a pointer is
    // over the chip. What IS checkable is the pair that makes the legend right —
    // the chip asks by id, and the id resolves to a real key.
    const { shortcutFor } = await import('../../src/keys.js')
    const key = shortcutFor('offer-accept')
    expect(key, 'the binding is not in the registry, so the chip can print nothing').toBeTruthy()
    // Alt is the point of the binding. A registry entry that had lost its modifier
    // would still be truthy above and would be a route that eats a digit.
    expect(key.toLowerCase(), 'the binding lost its modifier').toMatch(/alt|⌥/)

    const src = readFileSync(join(SRC, 'suggest.jsx'), 'utf8')
    expect(src, 'OfferChip spells its own key instead of asking keys.js')
      .toContain('shortcut="offer-accept"')
    // AND NOTHING NEAR IT HARD-CODES ONE. A chip that printed "Alt-1" itself would
    // go on saying so the day the binding moved, which is the whole failure the
    // registry exists to prevent.
    const chipBody = src.slice(src.indexOf('export function OfferChip'))
    expect(chipBody.slice(0, 400), 'the chip hard-codes a key cap').not.toMatch(/['"`]Alt[-+ ]?1/i)
  })
})
