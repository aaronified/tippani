// WHOEVER SAID IT GETS A CHIP, WHATEVER KIND OF QUOTE IT IS.
//
// THE RULE. A quote card names the people behind the line as chips — a face and
// a name, and a way in. That is the same promise on every screen that draws a
// quote, and the app has two sources for it because a quote has two shapes:
//
//   A LINE FROM A WORK has a CAST. `character_images` carries one entry per
//   character named on the line, each with the cast row behind it, and
//   `SpeakerChips` draws those.
//
//   A STANDALONE QUOTE HAS NO CAST. A letter, an essay, a speech — the person
//   who said it is a `people` record and there is no work whose cast they could
//   be on. `character_images` is empty for every one of them.
//
// So the card needs a ladder, not one source. Home's tiles have carried it since
// they were written; `AnnotationCard` had only the first rung, so on the Quotes
// screen a letter drew NO chip at all while the same line on Home drew one. The
// owner's report: "Quotes section cards have no chip at all."
//
// WHY THIS IS EASY TO SHIP AND HARD TO SEE. The empty case renders perfectly —
// an empty chip row is an empty row. Nothing throws, nothing looks broken, and
// the speaker is still readable as text in the meta line, so the card looks
// complete. Only holding it beside the same quote on another screen shows it.
//
// WHAT A TEST WRITER NEEDS TO KNOW: the paragraphs above. Nothing about which
// component draws which rung.
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async () => ({ ok: true, data: {} })),
}))

const { AnnotationCard } = await import('../../src/Library.jsx')

const card = (a, extra = {}) => render(
  <AnnotationCard
    a={a}
    variant={0}
    tagMap={{}}
    save={() => {}}
    patch={() => {}}
    remove={() => {}}
    setEditingId={() => {}}
    seps={{ comma: true, semicolon: true, amp: true, and: true }}
    {...extra}
  />,
)

const chips = () => document.querySelectorAll('.speaker-chips .tp-chip, .speaker-chips button')

afterEach(() => cleanup())

describe('a line from a work', () => {
  it('chips the characters its cast names', () => {
    card({
      id: 1, quote: 'Here’s looking at you, kid.', tags: [],
      character: 'Rick Blaine', speaker: 'Rick Blaine',
      character_images: [{ name: 'Rick Blaine', path: '', cast_id: 3, character_id: 2 }],
      speaker_cast: { name: 'Rick Blaine', cast_id: 3, character_id: 2 },
    })
    expect(screen.getByText('Rick Blaine'), 'a line with a cast drew no chip').toBeTruthy()
  })
})

