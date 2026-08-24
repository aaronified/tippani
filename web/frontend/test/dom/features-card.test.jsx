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
//
// THE CONTROL IS A CHIP NOW (1.17.0) rather than a Hide/Show Toggle per section, so
// every case here reads the state off `aria-pressed` instead of off the selected
// segment. WHAT IS ASSERTED DID NOT CHANGE — the polarity of each stored key, which
// key is written, that turning one back on sends `false` rather than dropping the
// field, and that the last one standing refuses in words — because those are
// properties of the card and not of the widget it draws. That is the whole reason
// this file was worth carrying through the change rather than rewriting after it: a
// card that swapped its control and kept its bugs still fails here.

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

// One section's chip, by its accessible name — SCOPED TO THE CARD'S OWN GROUP, and
// that scope is not tidiness. The review-scope chips in the quiz card are named
// after the same screens ("Library" is `nav.tab.library.label` in both places), so
// an unscoped getByRole('button', {name: 'Library'}) matches two controls in two
// cards that write two different preferences. The group is what ChipSwitches puts
// the card's own name on.
const card = () => within(screen.getByRole('group', { name: t('settings.features.title') }))
const chip = (sec) => card().getByRole('button', { name: named(sec) })
const named2 = (name) => card().getByRole('button', { name })
const pressed = (sec) => chip(sec).getAttribute('aria-pressed')

describe('the Features card', () => {
  it('renders at all, which means it is in every layout', () => {
    page()
    expect(screen.getByText('Features')).toBeTruthy()
  })

  // SECTIONS[].what IS A KEY and this card rendered it raw, so the three lines of
  // microcopy under the three switches read `nav.section.library.what`,
  // `nav.section.movies.what` and `nav.section.quotes.what` — on screen, in every
  // language. The Metadata card reads the same table correctly forty lines away in
  // the same file, which is what makes this worth a test rather than a fix: one
  // table with two readings will grow a third.
  //
  // Asserted over the whole card's text rather than per row, so a key leaking from
  // any other field here is caught by the same case.
  it('renders no unresolved key anywhere in it', () => {
    page()
    // THE WHOLE PAGE, not just this card. Scoping this to the Features card was
    // the first draft and it was worth less: run over all of Settings it
    // immediately found a THIRD leak nobody was looking for — the review-scope
    // chips in the quiz card, whose own comment says "both words are keys" and
    // which resolved one of them. A key on screen is a key on screen; the card
    // this case is filed under is not a reason to stop looking at the next one.
    const keyish = [...document.querySelectorAll('*')]
      .flatMap((el) => [...el.childNodes])
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim())
      .filter((txt) => /^[a-z][a-z0-9-]*(?:\.[a-z0-9-]+)+$/.test(txt))
    expect(keyish, 'unresolved keys on screen').toEqual([])
  })

  // The blurbs travel in each chip's tooltip now — the same place the review-scope
  // chips beside them have always kept theirs — so they are no longer standing text
  // and cannot be read off the DOM. What the old case was really defending is that
  // the card resolves the KEY before handing it over, so that is what is checked
  // here; the sweep above proves nothing renders the raw token.
  it('has words behind every section’s blurb, not just a key', () => {
    for (const sec of SECTIONS) {
      expect(t(sec.what), `no copy for ${sec.what}`).not.toBe(sec.what)
      expect(t(sec.what).length, `empty copy for ${sec.what}`).toBeGreaterThan(0)
    }
  })

  it('offers one chip per section, named after the section', () => {
    page()
    for (const sec of SECTIONS) {
      expect(chip(sec), `no chip for ${sec.label}`).toBeTruthy()
    }
  })

  it('opens on each section’s own default, for a reader who has set nothing', () => {
    // NOT A BLANKET "shown" any more. Three sections are on until you turn them off
    // and Anthologies is off until you ask for it, so the expectation is read off
    // the row's polarity rather than assumed — a card that rendered every chip the
    // same way would pass a blanket assertion and be wrong about a quarter of them.
    page()
    for (const sec of SECTIONS) {
      expect(pressed(sec), sec.label).toBe(sec.off ? 'false' : 'true')
    }
  })

  it('opens showing an asked-for section as shown', () => {
    // The other direction for the inverted row, and the one that catches a card
    // reading a show* key as though it were a hide* one.
    page({ showAnthologies: true })
    expect(named2('Anthologies').getAttribute('aria-pressed')).toBe('true')
  })

  it('opens showing a hidden section as hidden', () => {
    // The other direction, and the one that catches a card reading the wrong key:
    // a chip that is always lit would pass every assertion above.
    page({ hideCatalogue: true })
    expect(named2('Catalogue').getAttribute('aria-pressed')).toBe('false')
    expect(named2('Library').getAttribute('aria-pressed')).toBe('true')
  })

  it('writes the stored key the server reads, and only that key', () => {
    // The whole point of the case. `hideCatalogue` is what the Go prefs struct
    // names; anything else is a 200 that stores nothing.
    page()
    fireEvent.click(named2('Catalogue'))
    expect(prefsPuts().length, 'nothing was saved').toBeGreaterThan(0)
    expect(prefsPuts().at(-1)[1]).toEqual({ hideCatalogue: true })
  })

  it('turns one back on by sending false rather than by dropping the key', () => {
    // An absent field means "leave it alone" to the merge handler, so turning a
    // section back on has to be an explicit false. Omitting it would make the chip
    // a one-way door and nothing would report it.
    page({ hideQuotes: true })
    fireEvent.click(named2('Quotes'))
    expect(prefsPuts().at(-1)[1]).toEqual({ hideQuotes: false })
  })

  it('writes an inverted section’s key the right way round', () => {
    // THE FAILURE THIS CASE EXISTS FOR. `{ [sec.pref]: !show }` was correct while
    // every section was spelled hide*, and for a show* key it sends the OPPOSITE of
    // what was pressed. The PUT handler takes the key at its word and returns 200,
    // and the shell updates optimistically — so the chip would light, stick, and
    // come back the other way round on the next reload, with nothing failing.
    page()
    fireEvent.click(named2('Anthologies'))
    expect(prefsPuts().at(-1)[1]).toEqual({ showAnthologies: true })
    page({ showAnthologies: true })
    fireEvent.click(within(screen.getAllByRole('group', { name: t('settings.features.title') }).at(-1)).getByRole('button', { name: 'Anthologies' }))
    expect(prefsPuts().at(-1)[1]).toEqual({ showAnthologies: false })
  })

  it('never locks the inverted section, whatever the others are doing', () => {
    // Anthologies is not a content section — it holds quotes that live in the other
    // three — so it can never be the last one standing, and the lock must not spill
    // onto it when one of the three is. It stays switchable while Quotes is locked.
    page({ hideLibrary: true, hideCatalogue: true, showAnthologies: true })
    expect(named2('Quotes').getAttribute('aria-disabled')).toBe('true')
    const gathered = named2('Anthologies')
    expect(gathered.getAttribute('aria-disabled'), 'the anthologies chip was locked too').toBe('false')
    fireEvent.click(gathered)
    expect(prefsPuts().at(-1)[1]).toEqual({ showAnthologies: false })
  })

  it('updates the shell optimistically as well as saving', () => {
    // The nav has to change under the reader's finger. Nothing re-fetches
    // /auth/me after a settings save, so the optimistic call is the only thing
    // that moves the strip.
    const onPreferences = page()
    fireEvent.click(named2('Library'))
    expect(onPreferences).toHaveBeenCalledWith({ hideLibrary: true })
  })

  it('will not let the last section go', () => {
    // Two already hidden, so Quotes is the only one left. Its chip refuses, and the
    // card says why IN WORDS under the row rather than only in a bubble a phone has
    // to be held down to open.
    page({ hideLibrary: true, hideCatalogue: true })
    const last = named2('Quotes')
    expect(last.getAttribute('aria-disabled'), 'the last chip is still live').toBe('true')
    expect(screen.getByText(/last section has to stay/i)).toBeTruthy()
    // And pressing it anyway writes nothing.
    fireEvent.click(last)
    expect(prefsPuts().length, 'the last section was hidden anyway').toBe(0)
  })

  it('leaves the other two chips usable while one is locked', () => {
    // The lock is on the last one STANDING, not on the card. Somebody who has hidden
    // two must still be able to turn one of them back on — which is the way out of
    // the locked state, so it cannot itself be locked.
    page({ hideLibrary: true, hideCatalogue: true })
    fireEvent.click(named2('Library'))
    expect(prefsPuts().at(-1)[1]).toEqual({ hideLibrary: false })
  })
})
