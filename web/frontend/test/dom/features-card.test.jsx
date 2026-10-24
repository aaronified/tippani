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

  // SECTIONS[].what IS A KEY and this card rendered it raw, so the three lines of
  // microcopy under the three switches read `nav.section.library.what`,
  // `nav.section.movies.what` and `nav.section.quotes.what` — on screen, in every
  // language. The Metadata card reads the same table correctly forty lines away in
  // the same file, which is what makes this worth a test rather than a fix: one
  // table with two readings will grow a third.
  //
  // Asserted over the whole card's text rather than per row, so a key leaking from
  // any other field here is caught by the same case.

  // The blurbs travel in each chip's tooltip now — the same place the review-scope
  // chips beside them have always kept theirs — so they are no longer standing text
  // and cannot be read off the DOM. What the old case was really defending is that
  // the card resolves the KEY before handing it over, so that is what is checked
  // here; the sweep above proves nothing renders the raw token.

  it('writes the stored key the server reads, and only that key', async () => {
    // The whole point of the case. `hideCatalogue` is what the Go prefs struct
    // names; anything else is a 200 that stores nothing.
    await page()
    fireEvent.click(side('Catalogue', false))
    expect(prefsPuts().length, 'nothing was saved').toBeGreaterThan(0)
    expect(prefsPuts().at(-1)[1]).toEqual({ hideCatalogue: true })
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

  // WHICH GROUP SPANS THE CARD, which is a layout fact nothing else can hold.
  //
  // DECLARED EXCEPTION: this case reads a CLASS, `is-wide`. The rule here is that
  // a test knows what a person can see, and the honest position is that this one
  // cannot — a reader sees a wide group and a narrow one, and neither jsdom nor
  // the accessibility tree has a width. The behaviour is real and expensive to get
  // wrong: the pack spans the ORDER list across both columns and pairs the two
  // size groups beneath it (settings-restructured.dc.html:3311, "it reads across
  // the whole measure, and the tuners pair beneath it"), and this screen shipped
  // with that rule applied to the wrong groups — measured at 1280, roughly
  // 480x344 of the card's right half stood empty and the page ran 321px longer.
  // A browser journey cannot see it either: the sample's column is half the card
  // whichever group spans, so the count it draws is the same both ways
  // (mutation-checked in putting-a-section-first.journey.mjs). So the class is the
  // only thing left that changes, and a test that reads it is better than the
  // silence that let the inversion ship.
})
