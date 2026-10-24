import { beforeAll, describe, expect, it } from 'vitest'
import { greetingFor, holidayFor, timeBucket } from '../../src/greetings.js'
import { EN, value } from '../locale-file.js'
import { KINDS, WORK_KINDS, specFor } from '../../src/workKinds.js'
import { nativeFaceName } from '../../src/fonts.js'

// The Home greeting, across every region it knows, every day of a year, and
// every time-of-day bucket.
//
// This file is scripts/greetings-check.mjs, ported. That script was a
// hand-rolled suite with its own assertion helper — a `problems` array and a
// process.exit(1) — written because the frontend had no test runner when
// greetings.js landed. It has one now, so the checks live here and the script
// is gone. Nothing it asserted was dropped in the move: the sweep is still the
// same 129,210 greetings. What changed is the bookkeeping. The sweep runs once
// and each category of failure is asserted once, rather than 129,210 it()
// blocks — that is not a test report, it is a denial of service on the
// terminal, and it would turn a 140ms check into a minutes-long one.
//
// The port also gained what the script never had. The old sweep only ever
// checked the SHAPE of a greeting — non-empty, name substituted, no "Happy the
// " — and every pool in greetings.js satisfies all three, so nothing it ran
// could tell which pool had been chosen. I verified that by mutating the source
// and re-running: swapping the timeBucket labels, deleting the weekend pool,
// letting the weekend pool outrank a holiday, and removing Easter and both
// Thanksgivings all passed the ported suite untouched. The timeBucket, isWeekend,
// computed-holiday and pool-routing blocks below exist to kill those, and each
// one is a mutant I actually ran rather than a hypothetical.
//
// WHY ANY OF THIS IS CHECKED AT ALL. greetings.js is a ~150-row table of
// national days plus a ~150-row IANA-zone map, and every failure mode in it is
// silent: a greeting that renders "{name}" literally, a commemoration that says
// "Happy", a country whose time zone resolves to its neighbour's. None of those
// throw, none of them show up in a build, and nobody would notice for months.
// Two of the checks below exist because the bug had already happened:
//
//   - America/Bahia_Banderas (Mexico) startsWith America/Bahia (Brazil), so an
//     ordered prefix scan handed Mexican devices Brazilian national days.
//   - a national day has to beat the international list on a shared date, or
//     25 December says "Merry Christmas" in Pakistan instead of Quaid-e-Azam
//     Day — while 1 January must NOT be overridden, which is why Taiwan's
//     Founding Day was dropped rather than shadowing New Year.
//
// I pass `region` explicitly to every call here rather than letting it default.
// greetings.js takes it as an argument for exactly this reason — its own
// comment says the zone lookup is parameterised "instead of reading Intl
// internally" so that it is testable — and a test leaning on the default would
// silently be testing only whichever zone the runner happens to sit in.

// THE TABLE HOLDS KEYS AND THE FILE HOLDS THE WORDS, which splits this file's
// subject in two. holidayFor answers with greeting.holiday.br.09-07.1 — a fact about
// ROUTING, and the half every regression in here has been about — so the routing
// tests assert keys and read like the table they are checking.
//
// The COPY rules (one {name} slot, never "Happy" on a commemoration) read
// internal/i18n/en.txt, because that is where the words are and because reading them
// back through t() would make two of them pass on nothing: a key with no line
// resolves to a humanised stub, which has no "Happy" in it and no {name} either. The
// tone rule in particular was vacuous the moment the pools became keys — /^Happy /
// cannot match `greeting.holiday.gb.11-11.1` — and a rule that cannot fail is worse
// than a rule nobody wrote.
describe('greetings', () => {
  const YEAR = 2026 // any Gregorian year; the table is year-independent by design
  const HOURS = [2, 6, 9, 14, 19, 22] // one hour inside each of the six buckets
  const NAME = 'arani'

  // Every region the greeting table knows about, plus '' for a device whose zone
  // is unlisted and which therefore only ever sees the international list.
  const REGIONS = ['', 'IN', 'BD', 'PK', 'LK', 'BT', 'MV', 'US', 'CA', 'GB', 'IE', 'AU', 'NZ',
    'DE', 'FR', 'IT', 'ES', 'PT', 'NL', 'BE', 'CH', 'AT', 'PL', 'CZ', 'SE', 'NO', 'FI', 'GR',
    'RO', 'HU', 'UA', 'JP', 'KR', 'CN', 'TW', 'HK', 'SG', 'MY', 'ID', 'PH', 'TH', 'VN',
    'AE', 'SA', 'TR', 'EG', 'ZA', 'NG', 'KE', 'GH', 'MA', 'BR', 'MX', 'AR', 'CL', 'CO', 'PE', 'VE', 'UY']

  // A systemic break — someone deletes the {name} substitution, say — fails all
  // 129,210 cases at once, and a diff with 129,210 lines in it is unreadable and
  // slow to print. I keep the first few examples of each kind, which is all
  // anyone reads anyway, and carry the true total alongside so that a capped list
  // is never mistaken for "only five of these".
  const CAP = 5

  function collector() {
    const first = []
    let total = 0
    return {
      add(message) {
        total++
        if (first.length < CAP) first.push(message)
      },
      get report() {
        return { total, first }
      },
    }
  }

  const expectNothing = (c) => expect(c.report).toEqual({ total: 0, first: [] })

  // One pass over the whole matrix, memoised into `sweep` by beforeAll. Every
  // assertion below reads from the same pass — running the loop once per
  // assertion would multiply a 140ms check by six for no extra coverage, since
  // the loop is a pure function of the table.
  function runSweep() {
    const threw = collector()
    const empty = collector()
    const placeholder = collector()
    const nameless = collector()
    const grammar = collector()
    const buckets = new Set()
    let checked = 0
    let days = 0

    for (const region of REGIONS) {
      days = 0
      for (let day = 0; day < 366; day++) {
        const d = new Date(YEAR, 0, 1 + day)
        if (d.getFullYear() !== YEAR) break // 2026 is not a leap year; stop at 365
        days++
        for (const h of HOURS) {
          const when = new Date(YEAR, d.getMonth(), d.getDate(), h, 30)
          const at = `${region || 'intl'} ${when.toDateString()} ${h}h`
          let out
          try {
            out = greetingFor(NAME, when, region)
          } catch (e) {
            threw.add(`${at}: ${e.message}`)
            continue
          }
          checked++
          const where = `${at} → ${JSON.stringify(out)}`
          if (typeof out !== 'string' || !out.trim()) empty.add(where)
          if (out.includes('{name}')) placeholder.add(where)
          if (!out.includes(NAME)) nameless.add(where)
          // The two artefacts a table edit actually produces: a "Happy {name}"
          // row given a leading article, and a "Marking the ..." row that already
          // carried its own "the".
          if (out.includes('Happy the ') || out.includes('Marking the the')) grammar.add(where)
          buckets.add(timeBucket(when))
        }
      }
    }
    return { threw, empty, placeholder, nameless, grammar, buckets, checked, days }
  }

  describe('greetingFor — every region × every day × every bucket', () => {
    let sweep

    beforeAll(() => {
      sweep = runSweep()
    })

    it('never leaves {name} unsubstituted', () => {
      expectNothing(sweep.placeholder)
    })
  })

  describe('holidayFor — tone: a commemoration never says "Happy"', () => {
    // Getting this backwards is the most embarrassing thing the file could do, and
    // it is a one-word edit away at all times. Remembrance Day, Anzac Day, Truth
    // and Reconciliation, Shaheed Dibash, Día de Muertos, Gandhi Jayanti and the
    // 1956 Revolution are commemorations of the dead, not celebrations.
    const CASES = [
      ['GB', 10, 11], ['US', 10, 11], ['AU', 3, 25], ['NZ', 3, 25], ['FR', 10, 11],
      ['CA', 8, 30], ['BD', 1, 21], ['ZA', 5, 16], ['MX', 10, 2], ['IN', 9, 2], ['HU', 9, 23],
    ]

    // One test over all 11 rows rather than eleven it() blocks: every body ran the
    // identical two-step check and differed only in the (region, month, day)
    // tuple. Both steps stay INSIDE the loop, per row — see the vacuity note
    // below — and the offenders are collected so a failure names every
    // commemoration that went wrong at once rather than stopping at the first.
    it('never wishes anyone a happy commemoration', () => {
      const wrong = []
      for (const [region, m, d] of CASES) {
        const pool = holidayFor(new Date(YEAR, m, d), region) || []
        const at = `${region} on ${m + 1}-${d}`
        // An empty pool would pass the "Happy" assertion vacuously, so the day
        // has to actually be in the table for this test to mean anything.
        // Per row, never hoisted: one row falling out of the table must not be
        // covered by another row's pool being non-empty.
        if (pool.length === 0) wrong.push(`${at}: not in the table at all`)
        // The words, from en.txt. A key would pass /^Happy / for ever.
        for (const key of pool) {
          const line = value(key)
          if (!line) wrong.push(`${at}: ${key} has no line in en.txt`)
          else if (/^Happy /.test(line)) wrong.push(`${at}: ${line}`)
        }
      }
      expect(wrong).toEqual([])
    })
  })
})

// THE SWEEP INVARIANT FOR THE KIND TABLE.
//
// workKinds.js exists so that one work-detail screen can serve a book, a film, a
// show and a game — which means the screen stops asking "am I a film?" and starts
// asking the table. The failure mode that replaces the old one is therefore not a
// screen that drifted; it is a ROW THAT IS HALF FILLED IN. Add a fifth media type,
// forget its `quoteUnit`, and the board's counts say `undefined` in a language
// nobody has; forget its `capWords` and the cap dialog opens blank.
//
// So this file asks three things of the table and nothing about taste:
//
//   1. EVERY WORK KIND ANSWERS EVERY FIELD the shared screen will read. Not a
//      hand-written list of kinds against a hand-written list of fields — the
//      fields are taken from the `book` row, which is the one the merged screen
//      was lifted out of, so a field that screen comes to need is a field this
//      test starts demanding of the other three the moment it is added to book.
//
//   2. THE KEY SETS AGREE WITH works.jsx. ACTIVE_STATUS, SHELF_CAPS and this
//      table are three tables keyed the same way, and the in-progress word and
//      the cap number stay in works.jsx because the server mirrors them. Three
//      tables keyed the same way is exactly the shape where a fifth kind gets
//      added to two of them.
//
//   3. EVERY LOCALE KEY THE TABLE NAMES EXISTS. locale-complete already fails on
//      a key the source asks for and en.txt lacks, but it scans for key-SHAPED
//      literals — and it cannot tell that `spec.detail.export` is reached through
//      t(). Reading the table structurally is the only way to know that the
//      field a screen will index actually resolves.
//
// WHAT THIS DOES NOT ASSERT: that the values are the RIGHT ones. That the book
// board sorts by six dimensions and the film by six is a fact about the boards,
// and the board tests drive the real controls to prove it. This file proves the
// table is complete and internally consistent, which is the property no rendered
// test can see.
describe('work kinds', () => {
  const enHas = (k) => Object.prototype.hasOwnProperty.call(EN.keys, k)

  // The resolved spec for each kind, which is what a screen actually holds.
  const resolved = Object.fromEntries(
    WORK_KINDS.map((k) => [k, specFor(KINDS[k].side, { media_type: KINDS[k].mediaType })]),
  )
  // Every row including the card-only one, which inherits nothing and is already
  // whole.
  const specOf = { ...KINDS, ...resolved }

  describe('the four work kinds', () => {
    // The field list is the book row's, on purpose: see the header. Functions and
    // explicit nulls both count as answered — `origLanguage: null` is the film
    // saying "no such fact", which is an answer.
    const FIELDS = Object.keys(KINDS.book)
    it.each(WORK_KINDS)('%s answers every field the book row declares', (kind) => {
      const spec = resolved[kind]
      const unanswered = FIELDS.filter((f) => f !== 'inherits' && spec[f] === undefined)
      expect(unanswered, `${kind} has no answer for: ${unanswered.join(', ')}`).toEqual([])
    })
  })

  describe('the locale keys the table names', () => {
    // Walk the table structurally. A string that looks like a key IS one here —
    // the table holds nothing else that is dotted and lower-kebab.
    const KEYISH = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*\.[a-z0-9-]+$/
    // Values that are deliberately not locale keys: wire words, storage keys,
    // field names and the two enumerations.
    const NOT_KEYS = new Set([
      'kind', 'side', 'mediaType', 'workPath', 'workListKey', 'quotePath', 'quoteListKey',
      'quoteParam', 'addTarget', 'practiseParam', 'seedField', 'seenKind', 'workActionKind',
      'quoteActionKind', 'selectKind', 'screenLabel', 'scrollKey', 'shelfKind', 'statusFields',
      'facts', 'factDoors', 'requires', 'stateBuilder', 'carried', 'cleared', 'meta', 'views',
      'sortDims', 'groupDims', 'defaultSort', 'card', 'countsTone', 'yearField', 'circaField',
      'persist', 'field', 'personKind', 'suggest', 'input', 'options', 'key', 'fillsFrom',
      'requiredFor', 'faceFallback', 'family', 'inherits',
    ])

    function walk(node, path, out) {
      if (typeof node === 'string') {
        if (KEYISH.test(node)) out.push([path, node])
        return out
      }
      if (Array.isArray(node)) {
        node.forEach((v, i) => walk(v, `${path}[${i}]`, out))
        return out
      }
      if (node && typeof node === 'object')
        for (const [k, v] of Object.entries(node)) {
          if (NOT_KEYS.has(k)) continue
          walk(v, `${path}.${k}`, out)
        }
      return out
    }

    // THE RESOLVED SPEC, not the raw row. A show and a game are written as patches
    // over the film, so their own rows name a fraction of the keys their screen
    // will index — and it is the inherited half that a broken `inherits` would
    // silently drop. What must resolve is what a screen holds.
    it.each(Object.keys(KINDS))('%s names only keys en.txt has', (kind) => {
      const named = walk(specOf[kind], kind, [])
      // A floor, because a walk that finds nothing passes the real assertion below
      // vacuously. Per row rather than one number: the card-only quote row names
      // six keys and a work page names dozens, and a floor set for the second
      // would have to be lowered to the first to be true of both.
      const floor = KINDS[kind].hasWorkPage ? 20 : 5
      expect(named.length, `${kind}: the walk found ${named.length} keys — broken?`).toBeGreaterThanOrEqual(floor)
      const absent = named.filter(([, k]) => !enHas(k))
      expect(absent.map(([p, k]) => `${p} = ${k}`)).toEqual([])
    })
  })
})

// A FACE'S NAME, IN THE SCRIPT IT IS BEING CHOSEN FOR.
//
// WHY THIS IS A PURE TEST AND NOT A JOURNEY. What the two functions below decide
// is a string, and the browser tier already presses the picker that shows it —
// see language-faces.test.jsx, which reads the Bengali name off a rendered
// option. What cannot be asked there is the rule at its edges: a script this app
// knows nothing about, a face with no entry, a family the measurement cannot
// judge. Those are the cases where "fall back to Latin" either holds or quietly
// starts showing boxes.
//
// THE OWNER'S REASON, in their words: "if a font doesn't natively support a
// script, it is very hard to see what it will show when chosen to render that
// script."
describe('font script names', () => {
  describe("a face's name in another script", () => {
    // THE HALF THAT MATTERS MORE. A Latin-only face named in Bengali would be a
    // promise the face cannot keep, and the reader finds out only when a quote
    // turns into boxes.
    it('is empty where it cannot, so the caller uses the Latin name', () => {
      expect(nativeFaceName('literata', 'bengali')).toBe('')
      expect(nativeFaceName('noto-serif-bengali', 'devanagari')).toBe('')
      expect(nativeFaceName('upload:7', 'bengali')).toBe('')
      // A script this app has no faces for at all — the ninety-odd languages
      // iso639 knows come back with scripts nothing here is written for.
      expect(nativeFaceName('noto-serif-bengali', 'arabic')).toBe('')
      expect(nativeFaceName('noto-serif-bengali', '')).toBe('')
    })
  })
})
