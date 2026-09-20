// A dialog you mounted is a dialog you opened.
//
// FormModal took `open` with no default and returned null without it, and two
// call sites mount it inside a `{cond && <FormModal …>}` guard rather than
// keeping a persistent instance around. Both were therefore DEAD — not
// mis-positioned, not unstyled, absent — and had been since they were written:
//
//   Settings -> Daily quiz & practice -> In depth   (SRDeepControls)
//   Search   -> Filters                            (FacetPanel)
//
// Nothing inside either one was wrong, which is what made it survive. The quiz
// panel's toggles, its tuning sliders, its ladder refusal and its Back to
// defaults all round-trip correctly, and quiz.js mirrors review_questions.go key
// for key — there is a whole pure test file (quiz-questions.test.js) asserting
// that agreement, green the entire time, for a panel no reader could open.
//
// THE LESSON IS ABOUT THE PRIMITIVE, NOT THE CALLERS. A prop whose absence
// renders nothing, silently, is a trap: React does not warn, the guard reads
// correctly, and the only symptom is a button that appears to do nothing. So the
// default is the fix, and the first test here is the one that matters — it pins
// the contract rather than the two places that tripped over it.
//
// The two screens are then mounted and clicked anyway, because a contract test
// on the primitive would still have passed if a caller had gone on omitting a
// DIFFERENT required prop, and because these two dialogs had no coverage at all.

import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { openSettingsSection } from './helpers/settingsSection.jsx'

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path) => {
    if (path === '/fonts') return { ok: true, data: { fonts: [] } }
    if (path === '/vocabulary') return { ok: true, data: {} }
    return { ok: true, data: {} }
  }),
  downloadPost: vi.fn(async () => ({ ok: false, status: 500, error: 'no' })),
}))

const { FormModal } = await import('../../src/ui.jsx')
const { default: Settings } = await import('../../src/Settings.jsx')
const { default: SearchPage } = await import('../../src/SearchPage.jsx')
const { t } = await import('../../src/i18n.js')

const noop = () => {}

describe('the contract', () => {
  it('renders its children when nothing said open', () => {
    render(
      <FormModal title="Untold" onClose={noop}>
        <p>the body</p>
      </FormModal>,
    )
    expect(screen.getByText('the body')).toBeTruthy()
  })

  // The guard idiom and the persistent-instance idiom have to coexist: 23 call
  // sites keep an instance mounted and pass open={false} to close it, and a
  // default of true must not wedge those open.
  it('still closes for a caller that keeps the instance and says open={false}', () => {
    const { rerender } = render(
      <FormModal open onClose={noop} title="Kept">
        <p>the body</p>
      </FormModal>,
    )
    expect(screen.getByText('the body')).toBeTruthy()
    rerender(
      <FormModal open={false} onClose={noop} title="Kept">
        <p>the body</p>
      </FormModal>,
    )
    expect(screen.queryByText('the body')).toBeNull()
  })

  it('escapes, so a guard-mounted dialog is closable by keyboard', () => {
    const onClose = vi.fn()
    render(
      <FormModal title="Untold" onClose={onClose}>
        <p>the body</p>
      </FormModal>,
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })
})

describe('the two dialogs that were dead', () => {
  // ── AND ONE OF THEM IS NOT A DIALOG ANY MORE.
  //
  // This case pressed "Open the numbers" and asserted a panel appeared. The door
  // is gone: the ten schedule numbers are rows on the Review section, because
  // what is merely DETAILED goes lower on the same screen and only what is
  // genuinely RARE goes behind a door. So the case asserts the other side of the
  // same fact — they are reachable with nothing pressed at all.
  //
  // IT IS THE SAME GUARD POINTING THE OTHER WAY, and it still fails if the door
  // comes back: a row behind a modal is not on the screen when the section opens.
  it('puts the schedule numbers on the Review section, with nothing to open', async () => {
    render(
      <Settings
        user={{ username: 'a', is_admin: false, preferences: {} }}
        onPreferences={noop}
        update={null}
        onUpdateInfo={noop}
        onStartTour={noop}
        onOpenBin={noop}
      />,
    )
    await openSettingsSection('Review')
    // A TUNING ROW, WHICH USED TO BE PANEL-ONLY. The first of the ten says this,
    // and it is the string the old case waited for AFTER a press. Nothing is
    // pressed here.
    //
    // (It read `t(TUNING_FIELDS[0].label)` — an import of `src/quiz.js` for a
    // value that is already a resolved string, since the field's `label` is a
    // getter that calls `t` itself. So the file knew a module path it has no
    // exception for, and resolved one key twice.)
    expect(screen.getByText('Correct answer stretches by'), 'the schedule numbers should be on the section')
      .toBeTruthy()
    // AND THE LAST OF THE TEN, because "the first row rendered" does not say the
    // group did: a door replaced by one stray row would pass on the line above.
    expect(screen.getByText('Ladder rung 4'), 'the whole group should be on the section').toBeTruthy()
    // AND NOTHING OPENS. `queryByRole('dialog')` is what a modal announces itself
    // as, so this fails the moment the door comes back.
    expect(screen.queryByRole('dialog'), 'the Review section should have no dialog on it').toBeNull()
    // AND THE TWO REPERTOIRES ARE ON THE SECTION, NOT IN HERE. This counted two
    // cloze labels and called them "the panel lists the repertoire for daily AND
    // practice" — but the panel holds the ten numbers and nothing else, and the
    // two matches are the section's own chip rows, visible the whole time. The
    // count is worth keeping and the claim was not: one would mean a deck went
    // missing, three would mean the list doubled.
    expect(screen.getAllByText(t('quiz.question.cloze.label')).length).toBe(2)
  })

  it('opens the filters panel from Search', () => {
    render(<SearchPage onOpenBook={noop} onOpenMovie={noop} creditSeparators=",;&" />)
    expect(screen.queryByText(t('search.filters.title'))).toBeNull()
    fireEvent.click(screen.getByText(t('search.filters.label')))
    expect(screen.getByText(t('search.filters.title'))).toBeTruthy()
  })
})
