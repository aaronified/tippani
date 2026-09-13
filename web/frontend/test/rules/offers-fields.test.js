// The client's door list against the server's picker tables.
//
// WHY THIS TEST EXISTS. `OFFERED_FIELDS` decides which provenance marks become
// buttons, and the server's `bookAltPickers` / `movieAltPickers` decide which
// fields the offers pass can actually answer for. Two lists, two languages, and
// nothing in either file that would notice them diverging: a field added to the
// client's set draws a door onto an empty panel, and a field added to a picker
// table without the client hides a choice the reader now has.
//
// It reads the Go source rather than running the server, which is the same
// bargain locale-complete.test.js strikes with internal/i18n: a regex over a
// declaration is cruder than an API call and it is the only cross-language pin
// that costs nothing to run.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { OFFERED_FIELDS } from '../../src/fieldOffers.jsx'

// vitest.config.js sets TIPPANI_SRC to web/frontend/src whichever directory the
// run starts from, which is the seam bin-kinds.test.js uses to reach the repo.
const GO = join(process.env.TIPPANI_SRC, '..', '..', '..', 'internal', 'httpapi')

// The keys of one `var <name> = map[string]func(...) any{ ... }` block.
function pickerKeys(src, name) {
  const start = src.indexOf(`var ${name} = map[string]func(`)
  expect(start, `${name} is declared in reverify_handlers.go`).toBeGreaterThan(-1)
  // The map literal's own brace. Taking the SECOND `{` lands inside the first
  // entry's function body and eats that entry, which is how this test first ran
  // green-looking while missing `title`.
  const open = src.indexOf('{', start)
  const end = src.indexOf('\n}', open)
  const body = src.slice(open, end)
  return new Set([...body.matchAll(/^\s*"([a-z_]+)":/gm)].map((m) => m[1]))
}

// The keys of the two `offersFrom(map[string]any{ ... }` literals — the STORED
// side of an offers row. A field in a picker table but not in one of these maps
// would offer a supplier's value against a blank "kept" row, which reads as "you
// have nothing here" when in fact nobody declared where to look.
function storedKeys(src) {
  const out = []
  for (const m of src.matchAll(/offersFrom\(map\[string\]any\{([\s\S]*?)\},/g)) {
    out.push(new Set([...m[1].matchAll(/"([a-z_]+)":/g)].map((k) => k[1])))
  }
  return out
}

function skipped(src) {
  const line = src.match(/var offersSkip = map\[string\]bool\{([^}]*)\}/)
  expect(line, 'offersSkip is declared in field_offers.go').toBeTruthy()
  return new Set([...line[1].matchAll(/"([a-z_]+)"/g)].map((m) => m[1]))
}

describe('the fields with a door', () => {
  const reverify = readFileSync(join(GO, 'reverify_handlers.go'), 'utf8')
  const skip = skipped(readFileSync(join(GO, 'field_offers.go'), 'utf8'))
  const server = new Set(
    [...pickerKeys(reverify, 'bookAltPickers'), ...pickerKeys(reverify, 'movieAltPickers')]
      .filter((f) => !skip.has(f)),
  )

  it('is exactly what the server can offer', () => {
    expect([...OFFERED_FIELDS].sort()).toEqual([...server].sort())
  })

  // A FIELD WITH NOWHERE TO READ ITS STORED VALUE FROM. The offers pass walks the
  // picker table and reads `stored[field]` out of a literal written beside the
  // row scan; a field added to the table and not to that literal offers a
  // supplier's value against a blank, which reads as "you have nothing here".
  it('has a stored value declared for every field it offers', () => {
    const maps = storedKeys(reverify)
    expect(maps.length, 'both kinds run an offers pass').toBe(2)
    const book = new Set([...pickerKeys(reverify, 'bookAltPickers')].filter((f) => !skip.has(f)))
    const movie = new Set([...pickerKeys(reverify, 'movieAltPickers')].filter((f) => !skip.has(f)))
    // The book pass is written first in the file, the film's second.
    expect([...maps[0]].sort()).toEqual([...book].sort())
    expect([...maps[1]].sort()).toEqual([...movie].sort())
  })

  it('leaves out the fields a picker cannot draw', () => {
    // Named rather than derived, because "why is the cover not here" is the
    // question a reader of this file will have: a picture is not a field
    // (handoff §1.4) and a cast is a panel, so neither wears a tag to press.
    for (const f of ['cover', 'poster', 'cast']) {
      expect(OFFERED_FIELDS.has(f), `${f} must not have a door`).toBe(false)
    }
    // And a supplier id names its own supplier, so it is not in either table.
    for (const f of ['tmdb_id', 'tvdb_id', 'isbn']) {
      expect(OFFERED_FIELDS.has(f), `${f} must not have a door`).toBe(false)
    }
  })
})
