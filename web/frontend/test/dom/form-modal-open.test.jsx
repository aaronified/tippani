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
  it('opens the in-depth quiz panel from Settings', async () => {
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
    // THE DOOR AND THE ROOM SHARE A NAME, so the name cannot be the test. The
    // pack labels the row "The numbers behind the schedule" and titles the panel
    // it opens the same words — deliberately, so a reader knows they arrived —
    // which means that string is on the section BEFORE anything is pressed. This
    // asserted on it in both directions and would now pass the "before" only by
    // accident of which node matched first.
    //
    // WHAT IS PANEL-ONLY IS A TUNING ROW, and the first of the ten says this.
    // (It read `t(TUNING_FIELDS[0].label)` — an import of `src/quiz.js` for a
    // value that is already a resolved string, since the field's `label` is a
    // getter that calls `t` itself. So the file knew a module path it has no
    // exception for, and resolved one key twice.)
    expect(screen.queryByText('Correct answer stretches by')).toBeNull()
    fireEvent.click(screen.getByText(t('settings.quiz.in-depth.label')))
    expect(screen.getByText('Correct answer stretches by')).toBeTruthy()
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
