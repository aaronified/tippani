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
import { openSettingsSection } from './helpers/settingsSection.jsx'

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

const page = async (preferences = {}) => {
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
  await openSettingsSection('Sections')
  return onPreferences
}

const prefsPuts = () => PUTS.filter(([p]) => p === '/auth/me/preferences')

// ONE ROW PER SECTION, holding its name, its switch AND its order arrows — which
// is what the pack draws (`sectionRows()`, settings-restructured.dc.html:2477) and
// what this card was rebuilt to. It used to be a row of chips with a second list
// of the same four names underneath for the order: "Why have you added separate
// enable button and sorter? The prototype had both together, right?"
//
// THE SWITCH IS FOUND THROUGH ITS ROW, not by an unscoped name. The review-scope
// chips in the quiz card are named after the same screens ("Library" is
// `nav.tab.library.label` in both places), so a bare getByRole('button', {name:
// 'Library'}) matches two controls in two cards writing two different
// preferences.
const card = () => within(screen.getByRole('region', { name: t('settings.features.order.title') }))
const row = (sec) => card().getByText(named(sec)).closest('.pref-row')
// Toggle draws its options as tabs, and "Show" is the one that says this section
// is on — `aria-pressed` on it is the switch's state.
const chip = (sec) => within(row(sec)).getByRole('tab', { name: t('settings.features.show.label') })
// Pressing a side of the switch by name. The chips this replaced were toggles —
// one press meant "the other one" — and a two-sided switch is pressed by saying
// which side you want, which is also what makes "turn it back on" an explicit
// `false` rather than an omission.
const side = (name, on) => within(card().getByText(name).closest('.pref-row'))
  .getByRole('tab', { name: on ? t('settings.features.show.label') : t('settings.features.hide.label') })
const named2 = (name) => side(name, true)
const pressed = (sec) => chip(sec).getAttribute('aria-pressed')

describe('the Features card', () => {
  it('renders at all, which means it is in every layout', async () => {
    await page()
    // ITS OWN HEADING, NOT THE SECTION'S. This read `getByText('Features')`, which
    // was the card's title — and that title was a second heading under a rail that
    // had just said "Sections", so it went. What proves this card is on the screen
    // is the one heading that is ITS and not the section's.
    // The pack's words — "Show me, in this order" (settings-restructured.dc.html
    // :2725), where this read "In this order", taken when the two size sliders
    // below were given the pack's own two groups.
    expect(screen.getByText(/Show me, in this order/)).toBeTruthy()
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
  it('renders no unresolved key anywhere in it', async () => {
    await page()
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

  it('offers one chip per section, named after the section', async () => {
    await page()
    for (const sec of SECTIONS) {
      expect(chip(sec), `no chip for ${sec.label}`).toBeTruthy()
    }
  })

  it('opens on each section’s own default, for a reader who has set nothing', async () => {
    // NOT A BLANKET "shown" any more. Three sections are on until you turn them off
    // and Anthologies is off until you ask for it, so the expectation is read off
    // the row's polarity rather than assumed — a card that rendered every chip the
    // same way would pass a blanket assertion and be wrong about a quarter of them.
    await page()
    for (const sec of SECTIONS) {
      expect(pressed(sec), sec.label).toBe(sec.off ? 'false' : 'true')
    }
  })

  it('opens showing an asked-for section as shown', async () => {
    // The other direction for the inverted row, and the one that catches a card
    // reading a show* key as though it were a hide* one.
    await page({ showAnthologies: true })
    expect(named2('Anthologies').getAttribute('aria-pressed')).toBe('true')
  })

  it('opens showing a hidden section as hidden', async () => {
    // The other direction, and the one that catches a card reading the wrong key:
    // a chip that is always lit would pass every assertion above.
    await page({ hideCatalogue: true })
    expect(named2('Catalogue').getAttribute('aria-pressed')).toBe('false')
    expect(named2('Library').getAttribute('aria-pressed')).toBe('true')
  })

  it('writes the stored key the server reads, and only that key', async () => {
    // The whole point of the case. `hideCatalogue` is what the Go prefs struct
    // names; anything else is a 200 that stores nothing.
    await page()
    fireEvent.click(side('Catalogue', false))
    expect(prefsPuts().length, 'nothing was saved').toBeGreaterThan(0)
    expect(prefsPuts().at(-1)[1]).toEqual({ hideCatalogue: true })
  })

  it('turns one back on by sending false rather than by dropping the key', async () => {
    // An absent field means "leave it alone" to the merge handler, so turning a
    // section back on has to be an explicit false. Omitting it would make the chip
    // a one-way door and nothing would report it.
    await page({ hideQuotes: true })
    fireEvent.click(side('Quotes', true))
    expect(prefsPuts().at(-1)[1]).toEqual({ hideQuotes: false })
  })

  it('writes an inverted section’s key the right way round', async () => {
    // THE FAILURE THIS CASE EXISTS FOR. `{ [sec.pref]: !show }` was correct while
    // every section was spelled hide*, and for a show* key it sends the OPPOSITE of
    // what was pressed. The PUT handler takes the key at its word and returns 200,
    // and the shell updates optimistically — so the chip would light, stick, and
    // come back the other way round on the next reload, with nothing failing.
    await page()
    fireEvent.click(side('Anthologies', true))
    expect(prefsPuts().at(-1)[1]).toEqual({ showAnthologies: true })
    await page({ showAnthologies: true })
    fireEvent.click(within(screen.getAllByRole('region', { name: t('settings.features.order.title') }).at(-1))
      .getByText('Anthologies').closest('.pref-row')
      .querySelector('[role="tab"][aria-pressed="false"]'))
    expect(prefsPuts().at(-1)[1]).toEqual({ showAnthologies: false })
  })

  it('never locks the inverted section, whatever the others are doing', async () => {
    // Anthologies is not a content section — it holds quotes that live in the other
    // three — so it can never be the last one standing, and the lock must not spill
    // onto it when one of the three is. It stays switchable while Quotes is locked.
    await page({ hideLibrary: true, hideCatalogue: true, showAnthologies: true })
    expect(side('Quotes', false).disabled, 'the last one standing should be locked').toBe(true)
    const gathered = side('Anthologies', false)
    // NATIVE `disabled`, not aria-disabled: the switch is a Toggle now and every
    // option carries the real attribute, which is what stops a keydown originating
    // inside a locked one in a browser.
    expect(gathered.disabled, 'the anthologies switch was locked too').toBe(false)
    fireEvent.click(gathered)
    expect(prefsPuts().at(-1)[1]).toEqual({ showAnthologies: false })
  })

  it('updates the shell optimistically as well as saving', async () => {
    // The nav has to change under the reader's finger. Nothing re-fetches
    // /auth/me after a settings save, so the optimistic call is the only thing
    // that moves the strip.
    const onPreferences = await page()
    fireEvent.click(side('Library', false))
    expect(onPreferences).toHaveBeenCalledWith({ hideLibrary: true })
  })

  it('will not let the last section go', async () => {
    // Two already hidden, so Quotes is the only one left. Its chip refuses, and the
    // card says why IN WORDS under the row rather than only in a bubble a phone has
    // to be held down to open.
    await page({ hideLibrary: true, hideCatalogue: true })
    const last = side('Quotes', false)
    expect(last.disabled, 'the last section is still switchable off').toBe(true)
    expect(screen.getByText(/last section has to stay/i)).toBeTruthy()
    // And pressing it anyway writes nothing.
    fireEvent.click(last)
    expect(prefsPuts().length, 'the last section was hidden anyway').toBe(0)
  })

  it('leaves the other two chips usable while one is locked', async () => {
    // The lock is on the last one STANDING, not on the card. Somebody who has hidden
    // two must still be able to turn one of them back on — which is the way out of
    // the locked state, so it cannot itself be locked.
    await page({ hideLibrary: true, hideCatalogue: true })
    fireEvent.click(named2('Library'))
    expect(prefsPuts().at(-1)[1]).toEqual({ hideLibrary: false })
  })
})
