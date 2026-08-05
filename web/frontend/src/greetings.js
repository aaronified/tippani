// greetings.js — what Home says at the top of the screen.
//
// It used to be `Good ${morning|afternoon|evening}, ${name}` and nothing else,
// which is three strings for 365 days. This picks from a pool, and the pool is
// chosen from what the *device* knows: its clock, its date, and its IANA time
// zone. Everything here is local — no locale is asked of the server, nothing is
// sent anywhere, and there is no network call. A different line each reload is
// the point, so the pick is random rather than seeded.
//
// THE RULE FOR THIS FILE, and it is the whole design: a date earns a place here
// only if it falls on the SAME Gregorian month and day EVERY year, forever, or
// can be computed exactly from a stated rule (Easter's computus; "the fourth
// Thursday in November"). Nothing lunar, lunisolar, moon-sighted or decreed
// annually — Diwali, Holi, Eid, Lunar New Year, Vesak, Rosh Hashanah. Those move
// every year and several differ by country in the same year, so a table of them
// written from memory would be confidently wrong, and a wrong festival greeting
// is worse than no greeting at all. There is deliberately no escape hatch for
// them: an empty "add your own dates here" list is an invitation to break the
// rule later.
//
// The national list below was compiled and then adversarially re-checked
// source-by-source. Some of what that turned up, because it is the kind of thing
// that looks fine until it isn't:
//
//   - Days anchored to a LIVING monarch move on succession, so they are not
//     fixed at all. The Netherlands' King's Day has been 31 Aug, 30 Apr and
//     27 Apr; Thailand's King's Birthday moved from 5 Dec to 28 Jul. Excluded.
//   - England's St George's Day is transferred whenever it collides with Easter
//     week, so it is Easter-derived, and no IANA zone can express "England"
//     anyway — Europe/London is also Scotland, Wales and Northern Ireland.
//   - Ethiopia has no zone of its own: Africa/Addis_Ababa is a tzdb *Link* to
//     Africa/Nairobi, so a canonicalising platform reports Ethiopian devices as
//     Kenyan. Ethiopia is therefore absent rather than mislabelled.
//   - Several real, fixed national days are commemorations of the dead, not
//     celebrations — Remembrance Day, Anzac Day, Truth and Reconciliation,
//     Shaheed Dibash. "Happy" is the wrong word for those, so they carry a
//     `Marking …` line instead. Taiwan's 228 and Rizal Day were dropped for the
//     same reason: nobody there wants a greeting on them.

// ---- time of day -----------------------------------------------------------

// Six buckets, not three. "Good evening" at 23:50 and at 17:05 are the same
// sentence for very different moments.
export function timeBucket(d = new Date()) {
  const h = d.getHours()
  if (h < 5) return 'latenight'
  if (h < 8) return 'dawn'
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  if (h < 21) return 'evening'
  return 'night'
}

// isWeekend uses Saturday/Sunday. Deliberately not localised further: the
// Fri/Sat weekend of much of West Asia and North Africa is real, but guessing it
// from a time zone would mislabel more people than it helps, and the weekend
// pool is a nicety rather than information.
export function isWeekend(d = new Date()) {
  const day = d.getDay()
  return day === 0 || day === 6
}

// ---- where the device thinks it is -----------------------------------------

// The zone, not the language: someone reading English in Kolkata should still
// get Poila Boishakh, and someone reading Bengali in Toronto should get Canada
// Day. An unknown zone falls through to the international list, which is the
// whole point of having one.
export function localZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || ''
  } catch {
    return ''
  }
}

// ZONE_EXACT is matched first and ZONE_PREFIX only after, which is not a
// micro-optimisation — it is a correctness requirement. Mexico's
// America/Bahia_Banderas startsWith Brazil's America/Bahia, so a single ordered
// prefix scan hands Mexican devices Brazilian national days. Only identifiers
// ending in "/" are ever treated as prefixes, and each covers exactly one
// country. There is deliberately no "America/" catch-all: that string spans two
// continents, and the fallback for an unlisted zone is "no region", which costs
// nothing but a national greeting.
const ZONE_EXACT = new Map([
  ['Asia/Dubai', 'AE'],
  ['America/Buenos_Aires', 'AR'],
  ['Europe/Vienna', 'AT'],
  ['Antarctica/Macquarie', 'AU'],
  ['Asia/Dhaka', 'BD'], ['Asia/Dacca', 'BD'],
  ['Europe/Brussels', 'BE'],
  ['America/Sao_Paulo', 'BR'], ['America/Bahia', 'BR'], ['America/Fortaleza', 'BR'],
  ['America/Recife', 'BR'], ['America/Maceio', 'BR'], ['America/Araguaina', 'BR'],
  ['America/Belem', 'BR'], ['America/Santarem', 'BR'], ['America/Noronha', 'BR'],
  ['America/Manaus', 'BR'], ['America/Cuiaba', 'BR'], ['America/Campo_Grande', 'BR'],
  ['America/Porto_Velho', 'BR'], ['America/Boa_Vista', 'BR'], ['America/Rio_Branco', 'BR'],
  ['America/Eirunepe', 'BR'],
  ['Asia/Thimphu', 'BT'], ['Asia/Thimbu', 'BT'],
  ['America/Toronto', 'CA'], ['America/Vancouver', 'CA'], ['America/Edmonton', 'CA'],
  ['America/Winnipeg', 'CA'], ['America/Halifax', 'CA'], ['America/St_Johns', 'CA'],
  ['America/Regina', 'CA'], ['America/Moncton', 'CA'], ['America/Goose_Bay', 'CA'],
  ['America/Glace_Bay', 'CA'], ['America/Blanc-Sablon', 'CA'], ['America/Whitehorse', 'CA'],
  ['America/Dawson', 'CA'], ['America/Iqaluit', 'CA'], ['America/Resolute', 'CA'],
  ['America/Rankin_Inlet', 'CA'], ['America/Cambridge_Bay', 'CA'], ['America/Inuvik', 'CA'],
  ['America/Fort_Nelson', 'CA'], ['America/Dawson_Creek', 'CA'], ['America/Creston', 'CA'],
  ['America/Swift_Current', 'CA'], ['America/Atikokan', 'CA'],
  ['Europe/Zurich', 'CH'],
  ['America/Santiago', 'CL'], ['America/Punta_Arenas', 'CL'], ['Pacific/Easter', 'CL'],
  ['Asia/Shanghai', 'CN'], ['Asia/Urumqi', 'CN'], ['Asia/Chongqing', 'CN'],
  ['Asia/Harbin', 'CN'], ['Asia/Kashgar', 'CN'],
  ['America/Bogota', 'CO'],
  ['Europe/Prague', 'CZ'],
  ['Europe/Berlin', 'DE'], ['Europe/Busingen', 'DE'],
  ['Africa/Cairo', 'EG'],
  ['Europe/Madrid', 'ES'], ['Africa/Ceuta', 'ES'], ['Atlantic/Canary', 'ES'],
  ['Europe/Helsinki', 'FI'], ['Europe/Mariehamn', 'FI'],
  ['Europe/Paris', 'FR'],
  ['Europe/London', 'GB'], ['Europe/Belfast', 'GB'],
  ['Africa/Accra', 'GH'],
  ['Europe/Athens', 'GR'],
  ['Asia/Hong_Kong', 'HK'],
  ['Europe/Budapest', 'HU'],
  ['Asia/Jakarta', 'ID'], ['Asia/Pontianak', 'ID'], ['Asia/Makassar', 'ID'], ['Asia/Jayapura', 'ID'],
  ['Europe/Dublin', 'IE'],
  ['Asia/Kolkata', 'IN'], ['Asia/Calcutta', 'IN'],
  ['Europe/Rome', 'IT'],
  ['Asia/Tokyo', 'JP'],
  ['Africa/Nairobi', 'KE'],
  ['Asia/Seoul', 'KR'],
  ['Asia/Colombo', 'LK'],
  ['Africa/Casablanca', 'MA'],
  // Indian/Maldives is the Maldives' only identifier. zone1970.tab also lists it
  // for the French Southern Territories, which have no permanent population, so
  // the false-positive set is empty in practice.
  ['Indian/Maldives', 'MV'],
  ['America/Mexico_City', 'MX'], ['America/Cancun', 'MX'], ['America/Merida', 'MX'],
  ['America/Monterrey', 'MX'], ['America/Matamoros', 'MX'], ['America/Chihuahua', 'MX'],
  ['America/Ciudad_Juarez', 'MX'], ['America/Ojinaga', 'MX'], ['America/Mazatlan', 'MX'],
  ['America/Bahia_Banderas', 'MX'], ['America/Hermosillo', 'MX'], ['America/Tijuana', 'MX'],
  ['Asia/Kuala_Lumpur', 'MY'], ['Asia/Kuching', 'MY'],
  ['Africa/Lagos', 'NG'],
  ['Europe/Amsterdam', 'NL'],
  ['Europe/Oslo', 'NO'], ['Arctic/Longyearbyen', 'NO'],
  ['Pacific/Auckland', 'NZ'], ['Pacific/Chatham', 'NZ'],
  ['America/Lima', 'PE'],
  ['Asia/Manila', 'PH'],
  ['Asia/Karachi', 'PK'],
  ['Europe/Warsaw', 'PL'],
  ['Europe/Lisbon', 'PT'], ['Atlantic/Madeira', 'PT'], ['Atlantic/Azores', 'PT'],
  ['Europe/Bucharest', 'RO'],
  ['Asia/Riyadh', 'SA'],
  ['Europe/Stockholm', 'SE'],
  ['Asia/Singapore', 'SG'],
  ['Asia/Bangkok', 'TH'],
  ['Europe/Istanbul', 'TR'], ['Asia/Istanbul', 'TR'],
  ['Asia/Taipei', 'TW'],
  ['Europe/Kyiv', 'UA'], ['Europe/Simferopol', 'UA'], ['Europe/Uzhgorod', 'UA'], ['Europe/Zaporozhye', 'UA'],
  ['America/New_York', 'US'], ['America/Chicago', 'US'], ['America/Denver', 'US'],
  ['America/Los_Angeles', 'US'], ['America/Anchorage', 'US'], ['America/Phoenix', 'US'],
  ['America/Detroit', 'US'], ['America/Boise', 'US'], ['America/Juneau', 'US'],
  ['America/Sitka', 'US'], ['America/Nome', 'US'], ['America/Yakutat', 'US'],
  ['America/Metlakatla', 'US'], ['America/Menominee', 'US'], ['America/Adak', 'US'],
  ['Pacific/Honolulu', 'US'],
  ['America/Montevideo', 'UY'],
  ['America/Caracas', 'VE'],
  ['Asia/Ho_Chi_Minh', 'VN'], ['Asia/Saigon', 'VN'],
  ['Africa/Johannesburg', 'ZA'],
])

const ZONE_PREFIX = [
  ['Australia/', 'AU'],
  ['America/Argentina/', 'AR'],
  ['America/Indiana/', 'US'],
  ['America/Kentucky/', 'US'],
  ['America/North_Dakota/', 'US'],
]

export function localRegion(zone = localZone()) {
  const exact = ZONE_EXACT.get(zone)
  if (exact) return exact
  for (const [prefix, region] of ZONE_PREFIX) {
    if (zone.startsWith(prefix)) return region
  }
  return ''
}

// ---- holidays --------------------------------------------------------------

// NATIONAL — fixed-date days that belong to specific countries. Checked BEFORE
// the international list, so a country's own day wins over a generic one on the
// same date (25 December is Quaid-e-Azam Day in Pakistan).
//
// Tone matters and is carried in the wording, not in a flag: celebrations get
// "Happy X", commemorations get "Marking X". Getting that backwards is the most
// embarrassing thing this file could do.
const NATIONAL = [
  { md: '01-25', regions: ['EG'], greetings: ['Happy Revolution Day, {name}'] },
  { md: '01-26', regions: ['AU'], greetings: ['Happy Australia Day, {name}'] },
  { md: '01-26', regions: ['IN'], greetings: ['Happy Republic Day, {name}'] },
  { md: '02-04', regions: ['LK'], greetings: ['Happy Independence Day, {name}'] },
  { md: '02-06', regions: ['NZ'], greetings: ['Happy Waitangi Day, {name}'] },
  { md: '02-11', regions: ['JP'], greetings: ['Happy National Foundation Day, {name}'] },
  { md: '02-21', regions: ['BD'], greetings: ['Marking Shaheed Dibash, {name}', 'অমর একুশে — a day for words, {name}'] },
  { md: '02-22', regions: ['SA'], greetings: ['Happy Founding Day, {name}'] },
  { md: '03-01', regions: ['KR'], greetings: ['Marking Samiljeol, {name}'] },
  { md: '03-06', regions: ['GH'], greetings: ['Happy Independence Day, {name}'] },
  { md: '03-15', regions: ['HU'], greetings: ['Happy 1848 Revolution Day, {name}'] },
  { md: '03-17', regions: ['IE'], greetings: ['Happy St Patrick’s Day, {name}'] },
  { md: '03-23', regions: ['PK'], greetings: ['Happy Pakistan Day, {name}'] },
  { md: '03-25', regions: ['GR'], greetings: ['Happy Independence Day, {name}'] },
  { md: '03-26', regions: ['BD'], greetings: ['Happy Independence Day, {name}'] },
  { md: '04-13', regions: ['TH'], greetings: ['Happy Songkran, {name}'] },
  // Poila Boishakh / Pohela Boishakh, the SOLAR Bengali new year — 14 April in
  // Bangladesh, 14 or 15 April in West Bengal. Solar, so it is fixed, which is
  // why it is here and Diwali is not. Worth having in an app called টিপ্পনী.
  { md: '04-14', regions: ['IN', 'BD'], greetings: ['শুভ নববর্ষ, {name}', 'Happy Bengali new year, {name}'] },
  { md: '04-15', regions: ['IN'], greetings: ['শুভ নববর্ষ, {name}', 'Happy Bengali new year, {name}'] },
  { md: '04-19', regions: ['VE'], greetings: ['Happy Primer Grito de Independencia, {name}'] },
  { md: '04-23', regions: ['TR'], greetings: ['Happy National Sovereignty and Children’s Day, {name}'] },
  { md: '04-25', regions: ['AU', 'NZ'], greetings: ['Marking Anzac Day, {name}'] },
  { md: '04-25', regions: ['IT'], greetings: ['Happy Liberation Day, {name}'] },
  { md: '04-25', regions: ['EG'], greetings: ['Happy Sinai Liberation Day, {name}'] },
  { md: '04-27', regions: ['ZA'], greetings: ['Happy Freedom Day, {name}'] },
  { md: '04-30', regions: ['VN'], greetings: ['Happy Reunification Day, {name}'] },
  { md: '05-03', regions: ['PL'], greetings: ['Happy Constitution Day, {name}'] },
  { md: '05-03', regions: ['JP'], greetings: ['Happy Constitution Memorial Day, {name}'] },
  { md: '05-05', regions: ['NL'], greetings: ['Happy Bevrijdingsdag, {name}'] },
  { md: '05-05', regions: ['JP'], greetings: ['Happy Children’s Day, {name}'] },
  { md: '05-17', regions: ['NO'], greetings: ['Happy Syttende mai, {name}'] },
  { md: '05-25', regions: ['AR'], greetings: ['Happy May Revolution Day, {name}'] },
  { md: '06-01', regions: ['KE'], greetings: ['Happy Madaraka Day, {name}'] },
  { md: '06-01', regions: ['ID'], greetings: ['Happy Pancasila Day, {name}'] },
  { md: '06-02', regions: ['IT'], greetings: ['Happy Festa della Repubblica, {name}'] },
  { md: '06-06', regions: ['SE'], greetings: ['Happy Sveriges nationaldag, {name}'] },
  { md: '06-10', regions: ['PT'], greetings: ['Happy Portugal Day, {name}'] },
  { md: '06-12', regions: ['PH'], greetings: ['Happy Araw ng Kalayaan, {name}'] },
  { md: '06-12', regions: ['NG'], greetings: ['Happy Democracy Day, {name}'] },
  { md: '06-16', regions: ['ZA'], greetings: ['Marking Youth Day, {name}'] },
  { md: '06-19', regions: ['US'], greetings: ['Happy Juneteenth, {name}'] },
  { md: '06-28', regions: ['UA'], greetings: ['Happy Constitution Day, {name}'] },
  { md: '07-01', regions: ['CA'], greetings: ['Happy Canada Day, {name}'] },
  { md: '07-01', regions: ['HK'], greetings: ['Happy Establishment Day, {name}'] },
  { md: '07-04', regions: ['US'], greetings: ['Happy Fourth of July, {name}', 'Happy Fourth, {name}'] },
  { md: '07-05', regions: ['VE'], greetings: ['Happy Independence Day, {name}'] },
  { md: '07-09', regions: ['AR'], greetings: ['Happy Independence Day, {name}'] },
  { md: '07-14', regions: ['FR'], greetings: ['Happy Bastille Day, {name}'] },
  { md: '07-18', regions: ['UY'], greetings: ['Happy Constitution Day, {name}'] },
  { md: '07-20', regions: ['CO'], greetings: ['Happy Independence Day, {name}'] },
  { md: '07-21', regions: ['BE'], greetings: ['Happy Belgian National Day, {name}'] },
  { md: '07-23', regions: ['EG'], greetings: ['Happy Revolution Day, {name}'] },
  { md: '07-24', regions: ['VE'], greetings: ['Happy Bolívar Day, {name}'] },
  { md: '07-26', regions: ['MV'], greetings: ['Happy Independence Day, {name}'] },
  { md: '07-28', regions: ['PE'], greetings: ['Happy Fiestas Patrias, {name}'] },
  { md: '07-29', regions: ['PE'], greetings: ['Happy Gran Parada Militar, {name}'] },
  { md: '08-01', regions: ['CH'], greetings: ['Happy Swiss National Day, {name}'] },
  { md: '08-07', regions: ['CO'], greetings: ['Happy Battle of Boyacá Day, {name}'] },
  { md: '08-09', regions: ['SG'], greetings: ['Happy National Day, {name}'] },
  { md: '08-14', regions: ['PK'], greetings: ['Happy Independence Day, {name}'] },
  { md: '08-15', regions: ['KR'], greetings: ['Happy Gwangbokjeol, {name}'] },
  { md: '08-15', regions: ['IN'], greetings: ['Happy Independence Day, {name}'] },
  { md: '08-17', regions: ['ID'], greetings: ['Happy Hari Kemerdekaan, {name}'] },
  { md: '08-20', regions: ['HU'], greetings: ['Happy St Stephen’s Day, {name}'] },
  { md: '08-24', regions: ['UA'], greetings: ['Happy Independence Day, {name}'] },
  { md: '08-25', regions: ['UY'], greetings: ['Happy Independence Day, {name}'] },
  { md: '08-30', regions: ['TR'], greetings: ['Happy Zafer Bayramı, {name}'] },
  { md: '08-31', regions: ['MY'], greetings: ['Happy Hari Merdeka, {name}'] },
  { md: '09-02', regions: ['VN'], greetings: ['Happy Quốc Khánh, {name}'] },
  { md: '09-07', regions: ['BR'], greetings: ['Happy Independence Day, {name}'] },
  { md: '09-16', regions: ['MX'], greetings: ['Happy Independence Day, {name}'] },
  { md: '09-16', regions: ['MY'], greetings: ['Happy Malaysia Day, {name}'] },
  { md: '09-18', regions: ['CL'], greetings: ['Happy Fiestas Patrias, {name}'] },
  { md: '09-19', regions: ['CL'], greetings: ['Happy Día de las Glorias del Ejército, {name}'] },
  { md: '09-21', regions: ['GH'], greetings: ['Marking Founders’ Day, {name}'] },
  { md: '09-23', regions: ['SA'], greetings: ['Happy Saudi National Day, {name}'] },
  { md: '09-24', regions: ['ZA'], greetings: ['Happy Heritage Day, {name}'] },
  { md: '09-28', regions: ['CZ'], greetings: ['Happy Czech Statehood Day, {name}'] },
  { md: '09-30', regions: ['CA'], greetings: ['Marking the National Day for Truth and Reconciliation, {name}'] },
  { md: '10-01', regions: ['NG'], greetings: ['Happy Independence Day, {name}'] },
  { md: '10-01', regions: ['CN', 'HK'], greetings: ['Happy National Day, {name}'] },
  { md: '10-02', regions: ['IN'], greetings: ['Marking Gandhi Jayanti, {name}'] },
  { md: '10-03', regions: ['KR'], greetings: ['Happy Gaecheonjeol, {name}'] },
  { md: '10-03', regions: ['DE'], greetings: ['Happy German Unity Day, {name}'] },
  { md: '10-05', regions: ['PT'], greetings: ['Happy Republic Day, {name}'] },
  { md: '10-10', regions: ['TW'], greetings: ['Happy Double Ten Day, {name}'] },
  { md: '10-12', regions: ['ES'], greetings: ['Happy Fiesta Nacional, {name}'] },
  { md: '10-20', regions: ['KE'], greetings: ['Happy Mashujaa Day, {name}'] },
  { md: '10-23', regions: ['HU'], greetings: ['Marking 1956 Revolution Day, {name}'] },
  { md: '10-26', regions: ['AT'], greetings: ['Happy National Day, {name}'] },
  { md: '10-28', regions: ['CZ'], greetings: ['Happy Independent Czechoslovak State Day, {name}'] },
  { md: '10-28', regions: ['GR'], greetings: ['Happy Ohi Day, {name}'] },
  { md: '10-29', regions: ['TR'], greetings: ['Happy Cumhuriyet Bayramı, {name}'] },
  { md: '11-02', regions: ['MX'], greetings: ['Marking Día de Muertos, {name}'] },
  { md: '11-03', regions: ['MV'], greetings: ['Happy Victory Day, {name}'] },
  { md: '11-05', regions: ['GB'], greetings: ['Remember, remember, {name}'] },
  { md: '11-06', regions: ['MA'], greetings: ['Happy Green March Day, {name}'] },
  { md: '11-11', regions: ['FR'], greetings: ['Marking Armistice Day, {name}'] },
  { md: '11-11', regions: ['PL'], greetings: ['Happy Independence Day, {name}'] },
  { md: '11-11', regions: ['AU', 'CA', 'GB'], greetings: ['Marking Remembrance Day, {name}'] },
  { md: '11-11', regions: ['MV'], greetings: ['Happy Republic Day, {name}'] },
  { md: '11-11', regions: ['US'], greetings: ['Marking Veterans Day, {name}'] },
  { md: '11-15', regions: ['BR'], greetings: ['Happy Republic Day, {name}'] },
  { md: '11-18', regions: ['MA'], greetings: ['Happy Independence Day, {name}'] },
  { md: '12-01', regions: ['RO'], greetings: ['Happy Great Union Day, {name}'] },
  { md: '12-01', regions: ['PT'], greetings: ['Happy Restoration of Independence Day, {name}'] },
  { md: '12-02', regions: ['AE'], greetings: ['Happy National Day, {name}'] },
  { md: '12-05', regions: ['TH'], greetings: ['Happy National Day, {name}'] },
  { md: '12-06', regions: ['ES'], greetings: ['Happy Constitution Day, {name}'] },
  { md: '12-06', regions: ['FI'], greetings: ['Happy Independence Day, {name}'] },
  { md: '12-12', regions: ['KE'], greetings: ['Happy Jamhuri Day, {name}'] },
  { md: '12-16', regions: ['BD'], greetings: ['Happy Victory Day, {name}'] },
  { md: '12-17', regions: ['BT'], greetings: ['Happy National Day, {name}'] },
  { md: '12-25', regions: ['PK'], greetings: ['Happy Quaid-e-Azam Day, {name}'] },
]

// INTERNATIONAL — days that need no region, checked after NATIONAL so a
// country's own day always wins the date.
const INTERNATIONAL = [
  { md: '01-01', greetings: ['Happy new year, {name}', 'A fresh year of margins, {name}', 'New year, empty notebook, {name}'] },
  { md: '02-14', greetings: ['Happy Valentine’s day, {name}', 'Something quotable today, {name}?'] },
  { md: '04-23', greetings: ['Happy World Book Day, {name}', 'World Book Day — good company, {name}'] },
  { md: '10-31', greetings: ['Happy Hallowe’en, {name}', 'Something spooky in the margins, {name}?'] },
  { md: '12-24', greetings: ['Christmas eve, {name}'] },
  { md: '12-25', greetings: ['Merry Christmas, {name}', 'Happy Christmas, {name}'] },
  { md: '12-31', greetings: ['Last page of the year, {name}', 'See the year out, {name}'] },
]

// easterSunday — Anonymous Gregorian computus. Exact for any Gregorian year, so
// Easter and Good Friday need no table.
function easterSunday(year) {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31) // 3 = March, 4 = April
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

// nthWeekdayOfMonth — "the 4th Thursday in November" and friends, as a Date.
function nthWeekdayOfMonth(year, month, weekday, n) {
  const first = new Date(year, month, 1)
  const shift = (weekday - first.getDay() + 7) % 7
  return new Date(year, month, 1 + shift + (n - 1) * 7)
}

const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
const pad2 = (n) => String(n).padStart(2, '0')

// holidayFor returns today's greeting pool, or null. Order is the design: a
// national day, then an international one, then the two computed families.
export function holidayFor(d = new Date(), region = localRegion()) {
  const md = `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`

  if (region) {
    for (const h of NATIONAL) {
      if (h.md === md && h.regions.includes(region)) return h.greetings
    }
  }
  for (const h of INTERNATIONAL) {
    if (h.md === md) return h.greetings
  }

  const easter = easterSunday(d.getFullYear())
  if (sameDay(d, easter)) return ['Happy Easter, {name}']
  const goodFriday = new Date(easter)
  goodFriday.setDate(easter.getDate() - 2)
  if (sameDay(d, goodFriday)) return ['A quiet Good Friday, {name}']

  if (region === 'US' && sameDay(d, nthWeekdayOfMonth(d.getFullYear(), 10, 4, 4))) {
    return ['Happy Thanksgiving, {name}']
  }
  if (region === 'CA' && sameDay(d, nthWeekdayOfMonth(d.getFullYear(), 9, 1, 2))) {
    return ['Happy Thanksgiving, {name}']
  }
  return null
}

// ---- the pools -------------------------------------------------------------

const BY_BUCKET = {
  latenight: [
    'Still up, {name}?',
    'The small hours, {name}',
    'One more page, {name}?',
    'Burning the midnight oil, {name}',
    'Quiet o’clock, {name}',
  ],
  dawn: [
    'Early start, {name}',
    'Morning, {name} — before the world wakes',
    'First light, {name}',
    'Up with the birds, {name}',
  ],
  morning: [
    'Good morning, {name}',
    'Morning, {name}',
    'A good morning for a good line, {name}',
    'Fresh page, {name}',
    'Morning, {name} — what did you read?',
  ],
  afternoon: [
    'Good afternoon, {name}',
    'Afternoon, {name}',
    'Mid-afternoon, {name} — time for a chapter',
    'Afternoon, {name}. Anything worth keeping?',
  ],
  evening: [
    'Good evening, {name}',
    'Evening, {name}',
    'Evening, {name} — the reading hour',
    'Wind down, {name}',
  ],
  night: [
    'Good night, {name}',
    'Evening, {name}',
    'A late line or two, {name}?',
    'Night, {name} — one chapter more',
  ],
}

// The weekend pool is used *instead of* the time-of-day pool on Saturday and
// Sunday, except in the small hours, where "Still up?" beats any weekend line.
const WEEKEND = {
  dawn: ['Early, for a weekend, {name}', 'A quiet weekend start, {name}'],
  morning: ['Happy Saturday, {name}', 'Weekend morning, {name}', 'Slow morning, {name}', 'No alarm today, {name}'],
  afternoon: ['Weekend afternoon, {name}', 'A whole afternoon to read, {name}', 'Lazy afternoon, {name}'],
  evening: ['Weekend evening, {name}', 'Evening, {name} — no Monday yet', 'Settle in, {name}'],
  night: ['Late weekend night, {name}', 'No alarm tomorrow, {name}'],
}

// Sunday gets its own morning line, since "Happy Saturday" on a Sunday is worse
// than saying nothing clever at all.
const SUNDAY_MORNING = ['Happy Sunday, {name}', 'Sunday morning, {name}', 'Slow Sunday, {name}']

const pick = (list) => list[Math.floor(Math.random() * list.length)]

// greetingFor builds today's greeting: holiday, then weekend, then time of day.
//
// The late-night pool ("Still up?") outranks the weekend one — at 02:00 the fact
// that it is Saturday is not the interesting thing about the moment — but NOT
// the holiday one. Opening the app at one in the morning on Christmas should say
// Merry Christmas; the date has not rolled over yet, so the day is still the
// day, and "Still up?" would be the one greeting that ignores it.
export function greetingFor(username, now = new Date(), region = localRegion()) {
  const name = (username || '').trim() || 'reader'
  const bucket = timeBucket(now)
  let pool = BY_BUCKET[bucket] || BY_BUCKET.morning

  const holiday = holidayFor(now, region)
  if (holiday) {
    pool = holiday
  } else if (isWeekend(now) && bucket !== 'latenight') {
    const weekend = now.getDay() === 0 && bucket === 'morning' ? SUNDAY_MORNING : WEEKEND[bucket]
    if (weekend?.length) pool = weekend
  }
  return pick(pool).replace('{name}', name)
}

// dateLine — the mono line above the greeting. Rendered with the device's own
// locale and zone (toLocaleDateString with no locale argument), so the date
// reads the way the reader's system writes dates.
export function dateLine(now = new Date()) {
  const weekday = now.toLocaleDateString(undefined, { weekday: 'long' })
  const date = now.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
  return `${weekday} · ${date}`
}
