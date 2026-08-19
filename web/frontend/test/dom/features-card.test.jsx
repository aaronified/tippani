// Settings -> Features, mounted and clicked.
//
// features-nav.test.js owns the pure half — what visibleSections answers and what
// visibleTabs does with it. This is the other half, and it exists because the two
// failures that matter here are both invisible to a pure test:
//
//   - the card is registered in SETTINGS_CARDS and in every SETTINGS_LAYOUT column
//     or it never renders at all (the render walks the layout, not the card list);
//   - the switch writes the hide* key the Go struct actually reads. The PUT handler
//     silently ignores an unknown preference key and returns 200, and the client
//     updates optimistically — so a misspelled key gives a switch that moves, sticks
//     and reverts on the next reload, with nothing failing anywhere.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'

let PUTS

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    if (method === 'PUT') {
      PUTS.push([path, body])
      return { ok: true, data: { ok: true } }
    }
    if (path === '/fonts') return { ok: true, data: { fonts: [] } }
    return { ok: true, data: {} }
  }),
}))

const { default: Settings } = await import('../../src/Settings.jsx')
const { SECTIONS } = await import('../../src/routes.js')
// SECTIONS[].label IS A KEY, so the accessible name to look for is what it resolves
// to. Every table in the app that names something now holds the key and the words
// arrive at the dot that draws them — Settings renders {t(sec.label)}, so a test
// querying by visible text has to resolve it the same way rather than restate the
// English.
const { t } = await import('../../src/i18n.js')
const named = (sec) => t(sec.label)

beforeEach(() => {
  PUTS = []
})

const page = (preferences = {}) => {
  const onPreferences = vi.fn()
  render(
    <Settings
      user={{ username: 'a', is_admin: false, preferences }}
      onPreferences={onPreferences}
      update={null}
      onUpdateInfo={() => {}}
      onStartTour={() => {}}
      onOpenBin={() => {}}
    />,
  )
  return onPreferences
}

const prefsPuts = () => PUTS.filter(([p]) => p === '/auth/me/preferences')

describe('the Features card', () => {
  it('renders at all, which means it is in every layout', () => {
    page()
    expect(screen.getByText('Features')).toBeTruthy()
  })

  it('offers one switch per section, named after the section', () => {
    page()
    for (const sec of SECTIONS) {
      expect(screen.getByLabelText(named(sec)), `no switch for ${sec.label}`).toBeTruthy()
    }
  })

  it('opens on each section’s own default, for a reader who has set nothing', () => {
    // NOT A BLANKET "Show" any more. Three sections are on until you turn them off
    // and Anthologies is off until you ask for it, so the expectation is read off
    // the row's polarity rather than assumed — a card that rendered every switch
    // the same way would pass a blanket assertion and be wrong about a quarter of
    // its rows.
    page()
    for (const sec of SECTIONS) {
      const group = screen.getByLabelText(named(sec))
      // Read off the segment Toggle marks selected, not off the one we expected to
      // find: `getByRole('tab', {selected: true})` throws when nothing is selected,
      // which is the failure a `?? 'true'` fallback would have swallowed.
      const selected = within(group).getByRole('tab', { selected: true })
      expect(selected.textContent, sec.label).toBe(sec.off ? 'Hide' : 'Show')
    }
  })

  it('opens showing an asked-for section as shown', () => {
    // The other direction for the inverted row, and the one that catches a card
    // reading a show* key as though it were a hide* one.
    page({ showAnthologies: true })
    expect(within(screen.getByLabelText('Anthologies')).getByRole('tab', { selected: true }).textContent).toBe('Show')
  })

  it('opens showing a hidden section as hidden', () => {
    // The other direction, and the one that catches a card reading the wrong key:
    // a switch that always renders Show would pass every assertion above.
    page({ hideCatalogue: true })
    expect(within(screen.getByLabelText('Catalogue')).getByRole('tab', { selected: true }).textContent).toBe('Hide')
    expect(within(screen.getByLabelText('Library')).getByRole('tab', { selected: true }).textContent).toBe('Show')
  })

  it('writes the stored key the server reads, and only that key', () => {
    // The whole point of the case. `hideCatalogue` is what the Go prefs struct
    // names; anything else is a 200 that stores nothing.
    page()
    fireEvent.click(within(screen.getByLabelText('Catalogue')).getByText('Hide'))
    expect(prefsPuts().length, 'nothing was saved').toBeGreaterThan(0)
    expect(prefsPuts().at(-1)[1]).toEqual({ hideCatalogue: true })
  })

  it('turns one back on by sending false rather than by dropping the key', () => {
    // An absent field means "leave it alone" to the merge handler, so turning a
    // section back on has to be an explicit false. Omitting it would make the
    // switch a one-way door and nothing would report it.
    page({ hideQuotes: true })
    fireEvent.click(within(screen.getByLabelText('Quotes')).getByText('Show'))
    expect(prefsPuts().at(-1)[1]).toEqual({ hideQuotes: false })
  })

  it('writes an inverted section’s key the right way round', () => {
    // THE FAILURE THIS CASE EXISTS FOR. `{ [sec.pref]: !show }` was correct while
    // every section was spelled hide*, and for a show* key it sends the OPPOSITE of
    // what was pressed. The PUT handler takes the key at its word and returns 200,
    // and the shell updates optimistically — so the switch would move, stick, and
    // come back the other way round on the next reload, with nothing failing.
    page()
    fireEvent.click(within(screen.getByLabelText('Anthologies')).getByText('Show'))
    expect(prefsPuts().at(-1)[1]).toEqual({ showAnthologies: true })
    page({ showAnthologies: true })
    fireEvent.click(within(screen.getAllByLabelText('Anthologies').at(-1)).getByText('Hide'))
    expect(prefsPuts().at(-1)[1]).toEqual({ showAnthologies: false })
  })

  it('never locks the inverted section, whatever the others are doing', () => {
    // Anthologies is not a content section — it holds quotes that live in the other
    // three — so it can never be the last one standing, and the lock must not spill
    // onto it when one of the three is. It stays switchable while Quotes is locked.
    page({ hideLibrary: true, hideCatalogue: true, showAnthologies: true })
    expect(screen.getByLabelText('Quotes').getAttribute('aria-disabled')).toBe('true')
    const gathered = screen.getByLabelText('Anthologies')
    expect(gathered.getAttribute('aria-disabled'), 'the anthologies switch was locked too').not.toBe('true')
    fireEvent.click(within(gathered).getByText('Hide'))
    expect(prefsPuts().at(-1)[1]).toEqual({ showAnthologies: false })
  })

  it('updates the shell optimistically as well as saving', () => {
    // The nav has to change under the reader's finger. Nothing re-fetches
    // /auth/me after a settings save, so the optimistic call is the only thing
    // that moves the strip.
    const onPreferences = page()
    fireEvent.click(within(screen.getByLabelText('Library')).getByText('Hide'))
    expect(onPreferences).toHaveBeenCalledWith({ hideLibrary: true })
  })

  it('will not let the last section go', () => {
    // Two already hidden, so Quotes is the only one left. Its switch is disabled and
    // the row says why in words rather than in a title attribute a phone cannot show.
    page({ hideLibrary: true, hideCatalogue: true })
    const last = screen.getByLabelText('Quotes')
    expect(last.getAttribute('aria-disabled'), 'the last switch is still live').toBe('true')
    for (const seg of within(last).getAllByRole('tab')) {
      expect(seg.hasAttribute('disabled'), seg.textContent).toBe(true)
    }
    expect(screen.getByText(/last section has to stay/i)).toBeTruthy()
    // And pressing it anyway writes nothing.
    fireEvent.click(within(last).getByText('Hide'))
    expect(prefsPuts().length, 'the last section was hidden anyway').toBe(0)
  })

  it('leaves the other two switches usable while one is locked', () => {
    // The lock is on the last one STANDING, not on the card. Somebody who has hidden
    // two must still be able to turn one of them back on — which is the way out of
    // the locked state, so it cannot itself be locked.
    page({ hideLibrary: true, hideCatalogue: true })
    fireEvent.click(within(screen.getByLabelText('Library')).getByText('Show'))
    expect(prefsPuts().at(-1)[1]).toEqual({ hideLibrary: false })
  })
})
