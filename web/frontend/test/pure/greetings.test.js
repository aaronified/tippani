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
import { beforeAll, describe, expect, it } from 'vitest'
import {  greetingFor, holidayFor,   timeBucket } from '../../src/greetings.js'
import { value } from '../locale-file.js'

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

