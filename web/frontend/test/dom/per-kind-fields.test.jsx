// The boxes each kind of quote needs, and the suggestions behind them.
//
// WHY THIS FILE EXISTS. Three of these fields were added to a form in one release and
// one of them shipped INERT: the payload had two `character` keys, so the later
// carry-through won and the box wrote nothing. Vite printed "Duplicate key" and the
// build went on. No test typed into a field and looked at what was sent, which is the
// only check that would have caught it — so that is what every case here does.

import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

// The suggestion hook fetches the work's cast and (for a book) its chapters. Answered
// here so the comboboxes have something in them.
vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path) => {
    if (path.endsWith('/cast')) {
      return { ok: true, data: { cast: [{ character: 'Ahab', actor: '' }, { character: 'Ishmael', actor: '' }] } }
    }
    if (path.endsWith('/chapters')) {
      return { ok: true, data: { chapters: [{ no: 42, name: 'The Whale', count: 3 }, { no: 1, name: 'Loomings', count: 1 }] } }
    }
    return { ok: true, data: {} }
  }),
}))

const { AnnotationForm } = await import('../../src/Library.jsx')
const { DialogueForm } = await import('../../src/Movies.jsx')
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
