// EVERY SETTINGS CARD CAN BE FOUND BY SEARCHING SETTINGS.
//
// THE DEFECT THIS EXISTS FOR IS A SILENT DISAPPEARANCE. `settingsMatches` reads a
// card's searchable words out of its own i18n prefix, and the prefixes live in a map
// keyed by card id. A card whose id is not in that map falls through to
// `if (!prefix) return false` — so it matches nothing, and the moment a reader types
// a single character it VANISHES from Settings. Not greyed, not "no results": gone,
// while the rest of the page is still there. The reader's conclusion is that the app
// lost their backup card.
//
// AND THE MAP IS EXACTLY THE SHAPE `settingsMatches`' OWN COMMENT CONDEMNS. That
// comment argues against a hand-kept list of search terms on the grounds that it
// agrees on the day it is written and drifts on the next rename — and then keeps a
// hand-kept list of PREFIXES one line below, with nothing watching it. Deriving the
// terms from the catalogue was the right half; this is the half that was missed, and
// a rating found it before a reader did.
//
// A SCANNER RATHER THAN A RENDER TEST, because the claim is about every card
// including the ones a given account never draws: Updates and Backup are admin-only,
// so a jsdom render as an ordinary reader would pass while those two were unfindable.
// It reads source text, which is this directory's declared exception.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = process.env.TIPPANI_SRC || join(process.cwd(), 'src')
const src = readFileSync(join(SRC, 'Settings.jsx'), 'utf8')

// The canonical list of cards, and the map of prefixes that has to answer for it.
const cards = (src.match(/export const SETTINGS_CARDS = \[([^\]]*)\]/) || [, ''])[1]
  .split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean)

const prefixBlock = (src.match(/const SETTINGS_PREFIX = \{([\s\S]*?)\n\}/) || [, ''])[1]
const prefixed = [...prefixBlock.matchAll(/^\s*([A-Za-z0-9_]+):\s*'([^']+)'/gm)].map((m) => m[1])

describe('searching Settings', () => {
  it('found both lists at all, so this file cannot pass by finding nothing', () => {
    expect(cards.length, 'SETTINGS_CARDS did not parse; the scan is broken').toBeGreaterThan(3)
    expect(prefixed.length, 'SETTINGS_PREFIX did not parse; the scan is broken').toBeGreaterThan(3)
  })

  it('can reach every registered card', () => {
    const unreachable = cards.filter((k) => !prefixed.includes(k))
    expect(
      unreachable,
      'these cards are registered but have no search prefix, so typing anything hides them',
    ).toEqual([])
  })

  it('has no prefix for a card that is not registered', () => {
    // THE OTHER DIRECTION, and it is not symmetry for its own sake: a prefix left
    // behind by a deleted card is a search term pointing at nothing, and the next
    // person reads it as evidence the card still exists. `appearance` is the one
    // legitimate entry that is not in SETTINGS_CARDS — it is drawn above the grid
    // rather than placed in a column — so it is named here rather than excused by a
    // rule that would also excuse a mistake.
    const stray = prefixed.filter((k) => k !== 'appearance' && !cards.includes(k))
    expect(stray, 'these prefixes name no registered card').toEqual([])
  })
})
