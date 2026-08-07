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

import { beforeAll, describe, expect, it } from 'vitest'
import { dateLine, greetingFor, holidayFor, isWeekend, localRegion, timeBucket } from '../../src/greetings.js'

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

// timeBucket and isWeekend are the two primitives every greeting routes
// through, and the sweep below tests neither. Its bucket assertion only checks
// that all six LABELS turn up somewhere across the matrix, which stays true if
// you swap the bodies of two branches: I mutated `h < 5` to return 'dawn' and
// `h < 8` to return 'latenight' — so 02:00 says "Early start" and 06:00 says
// "Still up?" — and all fifty tests still passed. The mapping is pinned here
// instead, at both ends of every bucket, and the sweep's version is left as
// what it honestly is: proof the matrix was covered, not proof it is right.
describe('timeBucket — both ends of all six buckets', () => {
  const AT = [
    [0, 'latenight'], [4, 'latenight'],
    [5, 'dawn'], [7, 'dawn'],
    [8, 'morning'], [11, 'morning'],
    [12, 'afternoon'], [16, 'afternoon'],
    [17, 'evening'], [20, 'evening'],
    [21, 'night'], [23, 'night'],
  ]

  for (const [h, want] of AT) {
    it(`${h}:30 is ${want}`, () => {
      expect(timeBucket(new Date(YEAR, 0, 5, h, 30))).toBe(want)
    })
  }
})

describe('isWeekend', () => {
  // greetings.js argues at length for Saturday/Sunday over the Fri/Sat weekend
  // of much of West Asia, and an argument that deliberate deserves an
  // assertion: `day === 5 || day === 6` is a one-character edit that nothing
  // else in this file notices, and it would tell Monday-to-Friday readers to
  // enjoy their weekend on a Friday.
  it('is Saturday and Sunday, not Friday', () => {
    expect(isWeekend(new Date(YEAR, 0, 2))).toBe(false) // Fri 2 Jan 2026
    expect(isWeekend(new Date(YEAR, 0, 3))).toBe(true) // Sat
    expect(isWeekend(new Date(YEAR, 0, 4))).toBe(true) // Sun
    expect(isWeekend(new Date(YEAR, 0, 5))).toBe(false) // Mon
  })
})

describe('localRegion — IANA zone to ISO region', () => {
  const ZONES = [
    ['America/Bahia', 'BR'],
    ['America/Bahia_Banderas', 'MX'], // startsWith America/Bahia — must NOT be BR
    ['America/Argentina/Cordoba', 'AR'],
    ['America/Indiana/Indianapolis', 'US'],
    ['America/North_Dakota/Beulah', 'US'],
    ['Australia/Sydney', 'AU'],
    ['Antarctica/Macquarie', 'AU'],
    ['Asia/Kolkata', 'IN'], ['Asia/Calcutta', 'IN'],
    ['Asia/Dhaka', 'BD'], ['Africa/Nairobi', 'KE'],
    ['Europe/London', 'GB'], ['America/Toronto', 'CA'],
    ['America/New_York', 'US'], ['America/Sao_Paulo', 'BR'],
    ['Europe/Istanbul', 'TR'], ['Pacific/Honolulu', 'US'],
    // Unlisted zones must yield NO region rather than a wrong one. Addis Ababa
    // is absent on purpose: tzdb Links it to Africa/Nairobi, so Ethiopian
    // devices would otherwise be wished a happy Jamhuri Day.
    ['America/Havana', ''], ['Africa/Addis_Ababa', ''], ['Not/AZone', ''],
  ]

  for (const [zone, want] of ZONES) {
    it(`maps ${zone} to ${want ? want : 'no region'}`, () => {
      expect(localRegion(zone)).toBe(want)
    })
  }

  // The regression itself, spelled out end to end rather than as a table row,
  // because the table row alone does not show what the bug looked like: a
  // Mexican device being told to celebrate Brazilian independence on 7
  // September, which is an ordinary Monday in Mexico.
  it('does not hand Bahia_Banderas devices Brazil’s national days', () => {
    const brazilIndependence = new Date(YEAR, 8, 7)
    expect(localRegion('America/Bahia_Banderas')).toBe('MX')
    expect(holidayFor(brazilIndependence, localRegion('America/Bahia_Banderas'))).toBeNull()
    expect(holidayFor(brazilIndependence, localRegion('America/Bahia'))).toEqual(['Happy Independence Day, {name}'])
  })
})

describe('greetingFor — every region × every day × every bucket', () => {
  let sweep

  beforeAll(() => {
    sweep = runSweep()
  })

  it('covers the whole matrix', () => {
    expect(sweep.days).toBe(365)
    expect(sweep.checked).toBe(REGIONS.length * sweep.days * HOURS.length)
    expect(sweep.checked).toBe(129210)
  })

  it('never throws', () => {
    expectNothing(sweep.threw)
  })

  it('never returns an empty greeting', () => {
    expectNothing(sweep.empty)
  })

  it('never leaves {name} unsubstituted', () => {
    expectNothing(sweep.placeholder)
  })

  it('always includes the name it was given', () => {
    expectNothing(sweep.nameless)
  })

  it('never produces a grammar artefact', () => {
    expectNothing(sweep.grammar)
  })

  it('reaches all six time buckets', () => {
    expect([...sweep.buckets].sort()).toEqual(['afternoon', 'dawn', 'evening', 'latenight', 'morning', 'night'])
  })

  // The sweep above takes one random pick per cell, because that is what
  // greetingFor does and the randomness is the feature. That leaves the
  // placeholder check probabilistic for a pool line that is one of five. The
  // holiday pools are reachable without the random pick, so I check every
  // string in every one of them directly — the one part of this I can make
  // deterministic, I do.
  it('ships no holiday pool line missing its {name} slot', () => {
    const bad = collector()
    for (const region of REGIONS) {
      for (let day = 0; day < 366; day++) {
        const d = new Date(YEAR, 0, 1 + day)
        if (d.getFullYear() !== YEAR) break
        for (const g of holidayFor(d, region) || []) {
          const where = `${region || 'intl'} ${d.toDateString()} → ${JSON.stringify(g)}`
          if (typeof g !== 'string' || !g.trim()) bad.add(`empty: ${where}`)
          else if (g.split('{name}').length !== 2) bad.add(`wants exactly one {name}: ${where}`)
        }
      }
    }
    expectNothing(bad)
  })
})

describe('holidayFor — precedence: a national day beats the international list', () => {
  const CASES = [
    ['PK', new Date(YEAR, 11, 25), 'Quaid'],      // 25 Dec is Quaid-e-Azam Day in Pakistan
    ['GB', new Date(YEAR, 11, 25), 'Christmas'],  // ...and Christmas everywhere else
    ['TW', new Date(YEAR, 0, 1), 'new year'],     // TW Founding Day dropped so New Year survives
    ['IN', new Date(YEAR, 0, 26), 'Republic'],
    ['AU', new Date(YEAR, 0, 26), 'Australia Day'],
    ['TR', new Date(YEAR, 3, 23), 'Sovereignty'], // beats World Book Day in Turkey
    ['', new Date(YEAR, 3, 23), 'World Book Day'],
  ]

  for (const [region, when, want] of CASES) {
    it(`${region || 'intl'} on ${when.toDateString()} says ${want}`, () => {
      const pool = holidayFor(when, region) || []
      expect(pool.some((g) => g.includes(want))).toBe(true)
    })
  }
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

  for (const [region, m, d] of CASES) {
    it(`${region} on ${m + 1}-${d}`, () => {
      const pool = holidayFor(new Date(YEAR, m, d), region) || []
      // An empty pool would pass the "Happy" assertion vacuously, so the day
      // has to actually be in the table for this test to mean anything.
      expect(pool.length).toBeGreaterThan(0)
      for (const g of pool) expect(g).not.toMatch(/^Happy /)
    })
  }
})

// The two families holidayFor computes instead of tabulating. Every date below
// is worked out by hand and cross-checked against a calendar, never by asking
// the implementation what it thinks — a test that calls easterSunday() to find
// out what easterSunday() should return has tested nothing at all.
//
// Easter 2026 is 5 April. 1 Jan 2026 is a Thursday, so day-of-year 95 is a
// Sunday, and it being a Sunday is itself the check on the computus. Good
// Friday is the Friday before, 3 April. That Easter lands on a Sunday also
// makes it the one date where a holiday and the weekend pool both apply.
const EASTER = new Date(YEAR, 3, 5)
const GOOD_FRIDAY = new Date(YEAR, 3, 3)
// US Thanksgiving is the 4th Thursday in November: 1 Nov 2026 is a Sunday, so
// the first Thursday is the 5th and the fourth is the 26th. Canada's is the 2nd
// Monday in October: 1 Oct 2026 is a Thursday, first Monday the 5th, second the
// 12th.
const US_THANKSGIVING = new Date(YEAR, 10, 26)
const CA_THANKSGIVING = new Date(YEAR, 9, 12)

describe('holidayFor — the two computed families', () => {
  it('finds Easter and Good Friday with no table row', () => {
    expect(EASTER.getDay()).toBe(0) // the computus is wrong if this is not a Sunday
    expect(GOOD_FRIDAY.getDay()).toBe(5)
    expect(holidayFor(EASTER, '')).toEqual(['Happy Easter, {name}'])
    expect(holidayFor(GOOD_FRIDAY, '')).toEqual(['A quiet Good Friday, {name}'])
    expect(holidayFor(EASTER, 'IN')).toEqual(['Happy Easter, {name}']) // region-free
  })

  // Two countries, two different rules, and each has to stay behind its own
  // region check: a Canadian device on 26 November is having an ordinary
  // Thursday, and an American one on 12 October is having an ordinary Monday.
  it('keeps each Thanksgiving inside its own country', () => {
    expect(US_THANKSGIVING.getDay()).toBe(4)
    expect(CA_THANKSGIVING.getDay()).toBe(1)
    expect(holidayFor(US_THANKSGIVING, 'US')).toEqual(['Happy Thanksgiving, {name}'])
    expect(holidayFor(US_THANKSGIVING, 'CA')).toBeNull()
    expect(holidayFor(CA_THANKSGIVING, 'CA')).toEqual(['Happy Thanksgiving, {name}'])
    expect(holidayFor(CA_THANKSGIVING, 'US')).toBeNull()
  })
})

// Everything above tests holidayFor. Nothing tested that greetingFor USES it,
// or that it reaches the weekend pool on a weekend — and the sweep structurally
// cannot, because every pool in the file yields a non-empty line with the name
// substituted into it, so swapping WHICH pool is chosen is invisible to a check
// on the shape of the output. I proved that by mutation: making the weekend
// pool outrank the holiday pool, so Easter Sunday morning says "Weekend
// morning, arani", passed all fifty tests, as did deleting the weekend pool
// outright and as did dropping Easter and Thanksgiving from holidayFor. The
// routing rules are stated below as the exact line each one produces.
describe('greetingFor — which pool it reaches', () => {
  // The pick is random on purpose, so a test that wants to know which pool was
  // reached has to pin the pick. I assign Math.random and put it back in a
  // finally rather than reaching for a mocking helper — this removes
  // nondeterminism from a pure function rather than standing in for a
  // collaborator, and index 0 of a pool is a real string I can write down
  // instead of recomputing one.
  const firstPick = (fn) => {
    const real = Math.random
    Math.random = () => 0
    try {
      return fn()
    } finally {
      Math.random = real
    }
  }

  const SAT = [YEAR, 0, 3] // 3 Jan 2026 — a Saturday, and no holiday is on it
  const SUN = [YEAR, 0, 4]
  const MON = [YEAR, 0, 5]

  it('reaches the weekend pool on a Saturday', () => {
    expect(firstPick(() => greetingFor(NAME, new Date(...SAT, 9, 30), ''))).toBe('Happy Saturday, arani')
    expect(firstPick(() => greetingFor(NAME, new Date(...SAT, 14, 30), ''))).toBe('Weekend afternoon, arani')
  })

  // "Happy Saturday" on a Sunday is the whole reason SUNDAY_MORNING exists.
  it('gives Sunday morning its own pool', () => {
    expect(firstPick(() => greetingFor(NAME, new Date(...SUN, 9, 30), ''))).toBe('Happy Sunday, arani')
  })

  it('lets the small hours outrank the weekend', () => {
    expect(firstPick(() => greetingFor(NAME, new Date(...SAT, 2, 30), ''))).toBe('Still up, arani?')
  })

  it('falls back to the time of day on a weekday', () => {
    expect(firstPick(() => greetingFor(NAME, new Date(...MON, 9, 30), ''))).toBe('Good morning, arani')
  })

  // The rule greetings.js spells out in prose: at one in the morning on
  // Christmas the date has not rolled over, so the day is still the day, and
  // "Still up?" would be the one greeting that ignores it.
  it('lets a holiday outrank the small hours', () => {
    expect(greetingFor(NAME, new Date(YEAR, 11, 25, 2, 30), 'GB')).toContain('Christmas')
  })

  // Easter 2026 is a Sunday, so it is the case where holiday and weekend both
  // apply and only one of them can win.
  it('lets a holiday outrank the weekend', () => {
    expect(greetingFor(NAME, new Date(YEAR, 3, 5, 9, 30), '')).toBe('Happy Easter, arani')
  })
})

describe('greetingFor — a blank name still greets someone', () => {
  it('falls back to "reader"', () => {
    expect(greetingFor('', new Date(YEAR, 5, 3, 10, 0), '')).toContain('reader')
  })

  // greetingFor trims before it tests for emptiness, so a name of nothing but
  // spaces has to take the same path — a stored username of " " is a thing that
  // happens, and "Good morning,  " is worse than "Good morning, reader".
  it('treats a whitespace-only name as blank', () => {
    expect(greetingFor('   ', new Date(YEAR, 5, 3, 10, 0), '')).toContain('reader')
  })
})

describe('dateLine', () => {
  // The old script printed this line rather than asserting on it, and the
  // reason it could not assert is still true: dateLine passes `undefined` as
  // the locale on purpose, so the date reads the way the reader's own system
  // writes dates, and the runner's locale is not pinned (vitest.config.js pins
  // TZ only). "5 August 2026" here and "August 5, 2026" on a US runner are both
  // correct. So I assert the shape, which is the part that belongs to this
  // file: two non-empty fields, weekday first, joined by the mono separator.
  it('joins a weekday and a date with the separator', () => {
    const when = new Date(YEAR, 7, 5)
    const parts = dateLine(when).split(' · ')
    expect(parts).toHaveLength(2)
    expect(parts[0]).toBe(when.toLocaleDateString(undefined, { weekday: 'long' }))
    expect(parts[1]).toBe(when.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }))
    expect(parts[0].trim()).not.toBe('')
    expect(parts[1].trim()).not.toBe('')
  })
})
