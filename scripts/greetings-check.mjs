#!/usr/bin/env node
// Exercises web/frontend/src/greetings.js — the Home greeting — across every
// region it knows, every day of a year, and every time-of-day bucket.
//
// WHY A CHECK AND NOT A COMMENT. greetings.js is a ~150-row table of national
// days plus a ~150-row IANA-zone map, and the failure modes are all silent: a
// greeting that renders "{name}" literally, a commemoration that says "Happy",
// a country whose time zone resolves to its neighbour. None of those throw, none
// of them show up in a build, and nobody would notice for months. Two of the
// four assertions below were written because the bug had already happened:
//
//   - America/Bahia_Banderas (Mexico) startsWith America/Bahia (Brazil), so an
//     ordered prefix scan handed Mexican devices Brazilian national days.
//   - a national day has to beat the international list on a shared date, or
//     25 December says "Merry Christmas" in Pakistan instead of Quaid-e-Azam Day
//     — while 1 January must NOT be overridden, which is why Taiwan's Founding
//     Day was dropped rather than shadowing New Year.
//
// It imports the module directly (no bundler, no DOM), because everything in it
// is a pure function of a Date and a region string. That is the whole reason the
// zone lookup takes `region` as an argument instead of reading Intl internally.
//
//   node scripts/greetings-check.mjs
//
// No dependencies, and none wanted: it runs on a bare `node` in a workflow
// container, like the roadmap and glossary scripts beside it.

import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const MOD = pathToFileURL(join(ROOT, 'web', 'frontend', 'src', 'greetings.js')).href
const { greetingFor, holidayFor, timeBucket, localRegion, dateLine } = await import(MOD)

const problems = []
const note = (m) => problems.push(m)

// ---- 1. zone → region, including the prefix/exact trap ---------------------
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
  // Unlisted zones must yield NO region rather than a wrong one. Addis Ababa is
  // absent on purpose: tzdb Links it to Africa/Nairobi, so Ethiopian devices
  // would otherwise be wished a happy Jamhuri Day.
  ['America/Havana', ''], ['Africa/Addis_Ababa', ''], ['Not/AZone', ''],
]
for (const [zone, want] of ZONES) {
  const got = localRegion(zone)
  if (got !== want) note(`zone ${zone}: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`)
}

// ---- 2. every region, every day, every bucket ------------------------------
const REGIONS = ['', 'IN', 'BD', 'PK', 'LK', 'BT', 'MV', 'US', 'CA', 'GB', 'IE', 'AU', 'NZ',
  'DE', 'FR', 'IT', 'ES', 'PT', 'NL', 'BE', 'CH', 'AT', 'PL', 'CZ', 'SE', 'NO', 'FI', 'GR',
  'RO', 'HU', 'UA', 'JP', 'KR', 'CN', 'TW', 'HK', 'SG', 'MY', 'ID', 'PH', 'TH', 'VN',
  'AE', 'SA', 'TR', 'EG', 'ZA', 'NG', 'KE', 'GH', 'MA', 'BR', 'MX', 'AR', 'CL', 'CO', 'PE', 'VE', 'UY']
const HOURS = [2, 6, 9, 14, 19, 22]
const YEAR = 2026 // any Gregorian year; the table is year-independent by design

let checked = 0
const buckets = new Set()
for (const region of REGIONS) {
  for (let day = 0; day < 366; day++) {
    const d = new Date(YEAR, 0, 1 + day)
    if (d.getFullYear() !== YEAR) break
    for (const h of HOURS) {
      const when = new Date(YEAR, d.getMonth(), d.getDate(), h, 30)
      let out
      try {
        out = greetingFor('arani', when, region)
      } catch (e) {
        note(`threw for ${region} ${when.toDateString()} ${h}h: ${e.message}`)
        continue
      }
      checked++
      if (typeof out !== 'string' || !out.trim()) note(`empty greeting: ${region} ${when.toDateString()}`)
      if (out.includes('{name}')) note(`unsubstituted placeholder: ${out}`)
      if (!out.includes('arani')) note(`name missing: ${out}`)
      if (out.includes('Happy the ') || out.includes('Marking the the')) note(`grammar: ${out}`)
      buckets.add(timeBucket(when))
    }
  }
}
if (buckets.size !== 6) note(`expected all 6 time buckets, saw ${[...buckets].sort().join(', ')}`)

// ---- 3. precedence: a national day beats the international list ------------
for (const [region, when, want] of [
  ['PK', new Date(YEAR, 11, 25), 'Quaid'],      // 25 Dec is Quaid-e-Azam Day in Pakistan
  ['GB', new Date(YEAR, 11, 25), 'Christmas'],  // ...and Christmas everywhere else
  ['TW', new Date(YEAR, 0, 1), 'new year'],     // TW Founding Day dropped so New Year survives
  ['IN', new Date(YEAR, 0, 26), 'Republic'],
  ['AU', new Date(YEAR, 0, 26), 'Australia Day'],
  ['TR', new Date(YEAR, 3, 23), 'Sovereignty'], // beats World Book Day in Turkey
  ['', new Date(YEAR, 3, 23), 'World Book Day'],
]) {
  const pool = holidayFor(when, region) || []
  if (!pool.some((g) => g.includes(want))) {
    note(`precedence: ${region || 'intl'} on ${when.toDateString()} expected /${want}/, got ${JSON.stringify(pool)}`)
  }
}

// ---- 4. tone: a commemoration must never say "Happy" -----------------------
for (const [region, m, d] of [
  ['GB', 10, 11], ['US', 10, 11], ['AU', 3, 25], ['NZ', 3, 25], ['FR', 10, 11],
  ['CA', 8, 30], ['BD', 1, 21], ['ZA', 5, 16], ['MX', 10, 2], ['IN', 9, 2], ['HU', 9, 23],
]) {
  for (const g of holidayFor(new Date(YEAR, m, d), region) || []) {
    if (/^Happy /.test(g)) note(`tone: ${region} ${m + 1}-${d} says "${g}" for a commemoration`)
  }
}

// ---- 5. a blank name still greets someone ---------------------------------
if (!greetingFor('', new Date(YEAR, 5, 3, 10, 0), '').includes('reader')) {
  note('a blank username did not fall back to "reader"')
}

console.log(`greetings-check: ${checked} greetings · ${REGIONS.length} regions × 366 days × ${HOURS.length} hours`)
console.log(`greetings-check: buckets ${[...buckets].sort().join(', ')} · dateLine "${dateLine(new Date(YEAR, 7, 5))}"`)
if (problems.length) {
  console.error(`\ngreetings-check: ${problems.length} problem(s)\n` + problems.map((p) => '  ' + p).join('\n'))
  process.exit(1)
}
console.log('greetings-check: ok')
