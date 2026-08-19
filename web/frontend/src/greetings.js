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

// EVERY POOL BELOW IS KEYS, NOT SENTENCES. The copy lives in the locale files
// under greeting.*, and the index in a key IS that pool member's identity — which
// is what lets a language carry a different NUMBER of lines than English, and its
// own festivals rather than a translation of these.
import { t } from './i18n.js'

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
  { md: '01-25', regions: ['EG'], greetings: ['greeting.holiday.eg.01-25.1'] },
  { md: '01-26', regions: ['AU'], greetings: ['greeting.holiday.au.01-26.1'] },
  { md: '01-26', regions: ['IN'], greetings: ['greeting.holiday.in.01-26.1'] },
  { md: '02-04', regions: ['LK'], greetings: ['greeting.holiday.lk.02-04.1'] },
  { md: '02-06', regions: ['NZ'], greetings: ['greeting.holiday.nz.02-06.1'] },
  { md: '02-11', regions: ['JP'], greetings: ['greeting.holiday.jp.02-11.1'] },
  { md: '02-21', regions: ['BD'], greetings: ['greeting.holiday.bd.02-21.1', 'greeting.holiday.bd.02-21.2'] },
  { md: '02-22', regions: ['SA'], greetings: ['greeting.holiday.sa.02-22.1'] },
  { md: '03-01', regions: ['KR'], greetings: ['greeting.holiday.kr.03-01.1'] },
  { md: '03-06', regions: ['GH'], greetings: ['greeting.holiday.gh.03-06.1'] },
  { md: '03-15', regions: ['HU'], greetings: ['greeting.holiday.hu.03-15.1'] },
  { md: '03-17', regions: ['IE'], greetings: ['greeting.holiday.ie.03-17.1'] },
  { md: '03-23', regions: ['PK'], greetings: ['greeting.holiday.pk.03-23.1'] },
  { md: '03-25', regions: ['GR'], greetings: ['greeting.holiday.gr.03-25.1'] },
  { md: '03-26', regions: ['BD'], greetings: ['greeting.holiday.bd.03-26.1'] },
  { md: '04-13', regions: ['TH'], greetings: ['greeting.holiday.th.04-13.1'] },
  // Poila Boishakh / Pohela Boishakh, the SOLAR Bengali new year — 14 April in
  // Bangladesh, 14 or 15 April in West Bengal. Solar, so it is fixed, which is
  // why it is here and Diwali is not. Worth having in an app called টিপ্পনী.
  { md: '04-14', regions: ['IN', 'BD'], greetings: ['greeting.holiday.in.04-14.1', 'greeting.holiday.in.04-14.2'] },
  { md: '04-15', regions: ['IN'], greetings: ['greeting.holiday.in.04-15.1', 'greeting.holiday.in.04-15.2'] },
  { md: '04-19', regions: ['VE'], greetings: ['greeting.holiday.ve.04-19.1'] },
  { md: '04-23', regions: ['TR'], greetings: ['greeting.holiday.tr.04-23.1'] },
  { md: '04-25', regions: ['AU', 'NZ'], greetings: ['greeting.holiday.au.04-25.1'] },
  { md: '04-25', regions: ['IT'], greetings: ['greeting.holiday.it.04-25.1'] },
  { md: '04-25', regions: ['EG'], greetings: ['greeting.holiday.eg.04-25.1'] },
  { md: '04-27', regions: ['ZA'], greetings: ['greeting.holiday.za.04-27.1'] },
  { md: '04-30', regions: ['VN'], greetings: ['greeting.holiday.vn.04-30.1'] },
  { md: '05-03', regions: ['PL'], greetings: ['greeting.holiday.pl.05-03.1'] },
  { md: '05-03', regions: ['JP'], greetings: ['greeting.holiday.jp.05-03.1'] },
  { md: '05-05', regions: ['NL'], greetings: ['greeting.holiday.nl.05-05.1'] },
  { md: '05-05', regions: ['JP'], greetings: ['greeting.holiday.jp.05-05.1'] },
  { md: '05-17', regions: ['NO'], greetings: ['greeting.holiday.no.05-17.1'] },
  { md: '05-25', regions: ['AR'], greetings: ['greeting.holiday.ar.05-25.1'] },
  { md: '06-01', regions: ['KE'], greetings: ['greeting.holiday.ke.06-01.1'] },
  { md: '06-01', regions: ['ID'], greetings: ['greeting.holiday.id.06-01.1'] },
  { md: '06-02', regions: ['IT'], greetings: ['greeting.holiday.it.06-02.1'] },
  { md: '06-06', regions: ['SE'], greetings: ['greeting.holiday.se.06-06.1'] },
  { md: '06-10', regions: ['PT'], greetings: ['greeting.holiday.pt.06-10.1'] },
  { md: '06-12', regions: ['PH'], greetings: ['greeting.holiday.ph.06-12.1'] },
  { md: '06-12', regions: ['NG'], greetings: ['greeting.holiday.ng.06-12.1'] },
  { md: '06-16', regions: ['ZA'], greetings: ['greeting.holiday.za.06-16.1'] },
  { md: '06-19', regions: ['US'], greetings: ['greeting.holiday.us.06-19.1'] },
  { md: '06-28', regions: ['UA'], greetings: ['greeting.holiday.ua.06-28.1'] },
  { md: '07-01', regions: ['CA'], greetings: ['greeting.holiday.ca.07-01.1'] },
  { md: '07-01', regions: ['HK'], greetings: ['greeting.holiday.hk.07-01.1'] },
  { md: '07-04', regions: ['US'], greetings: ['greeting.holiday.us.07-04.1', 'greeting.holiday.us.07-04.2'] },
  { md: '07-05', regions: ['VE'], greetings: ['greeting.holiday.ve.07-05.1'] },
  { md: '07-09', regions: ['AR'], greetings: ['greeting.holiday.ar.07-09.1'] },
  { md: '07-14', regions: ['FR'], greetings: ['greeting.holiday.fr.07-14.1'] },
  { md: '07-18', regions: ['UY'], greetings: ['greeting.holiday.uy.07-18.1'] },
  { md: '07-20', regions: ['CO'], greetings: ['greeting.holiday.co.07-20.1'] },
  { md: '07-21', regions: ['BE'], greetings: ['greeting.holiday.be.07-21.1'] },
  { md: '07-23', regions: ['EG'], greetings: ['greeting.holiday.eg.07-23.1'] },
  { md: '07-24', regions: ['VE'], greetings: ['greeting.holiday.ve.07-24.1'] },
  { md: '07-26', regions: ['MV'], greetings: ['greeting.holiday.mv.07-26.1'] },
  { md: '07-28', regions: ['PE'], greetings: ['greeting.holiday.pe.07-28.1'] },
  { md: '07-29', regions: ['PE'], greetings: ['greeting.holiday.pe.07-29.1'] },
  { md: '08-01', regions: ['CH'], greetings: ['greeting.holiday.ch.08-01.1'] },
  { md: '08-07', regions: ['CO'], greetings: ['greeting.holiday.co.08-07.1'] },
  { md: '08-09', regions: ['SG'], greetings: ['greeting.holiday.sg.08-09.1'] },
  { md: '08-14', regions: ['PK'], greetings: ['greeting.holiday.pk.08-14.1'] },
  { md: '08-15', regions: ['KR'], greetings: ['greeting.holiday.kr.08-15.1'] },
  { md: '08-15', regions: ['IN'], greetings: ['greeting.holiday.in.08-15.1'] },
  { md: '08-17', regions: ['ID'], greetings: ['greeting.holiday.id.08-17.1'] },
  { md: '08-20', regions: ['HU'], greetings: ['greeting.holiday.hu.08-20.1'] },
  { md: '08-24', regions: ['UA'], greetings: ['greeting.holiday.ua.08-24.1'] },
  { md: '08-25', regions: ['UY'], greetings: ['greeting.holiday.uy.08-25.1'] },
  { md: '08-30', regions: ['TR'], greetings: ['greeting.holiday.tr.08-30.1'] },
  { md: '08-31', regions: ['MY'], greetings: ['greeting.holiday.my.08-31.1'] },
  { md: '09-02', regions: ['VN'], greetings: ['greeting.holiday.vn.09-02.1'] },
  { md: '09-07', regions: ['BR'], greetings: ['greeting.holiday.br.09-07.1'] },
  { md: '09-16', regions: ['MX'], greetings: ['greeting.holiday.mx.09-16.1'] },
  { md: '09-16', regions: ['MY'], greetings: ['greeting.holiday.my.09-16.1'] },
  { md: '09-18', regions: ['CL'], greetings: ['greeting.holiday.cl.09-18.1'] },
  { md: '09-19', regions: ['CL'], greetings: ['greeting.holiday.cl.09-19.1'] },
  { md: '09-21', regions: ['GH'], greetings: ['greeting.holiday.gh.09-21.1'] },
  { md: '09-23', regions: ['SA'], greetings: ['greeting.holiday.sa.09-23.1'] },
  { md: '09-24', regions: ['ZA'], greetings: ['greeting.holiday.za.09-24.1'] },
  { md: '09-28', regions: ['CZ'], greetings: ['greeting.holiday.cz.09-28.1'] },
  { md: '09-30', regions: ['CA'], greetings: ['greeting.holiday.ca.09-30.1'] },
  { md: '10-01', regions: ['NG'], greetings: ['greeting.holiday.ng.10-01.1'] },
  { md: '10-01', regions: ['CN', 'HK'], greetings: ['greeting.holiday.cn.10-01.1'] },
  { md: '10-02', regions: ['IN'], greetings: ['greeting.holiday.in.10-02.1'] },
  { md: '10-03', regions: ['KR'], greetings: ['greeting.holiday.kr.10-03.1'] },
  { md: '10-03', regions: ['DE'], greetings: ['greeting.holiday.de.10-03.1'] },
  { md: '10-05', regions: ['PT'], greetings: ['greeting.holiday.pt.10-05.1'] },
  { md: '10-10', regions: ['TW'], greetings: ['greeting.holiday.tw.10-10.1'] },
  { md: '10-12', regions: ['ES'], greetings: ['greeting.holiday.es.10-12.1'] },
  { md: '10-20', regions: ['KE'], greetings: ['greeting.holiday.ke.10-20.1'] },
  { md: '10-23', regions: ['HU'], greetings: ['greeting.holiday.hu.10-23.1'] },
  { md: '10-26', regions: ['AT'], greetings: ['greeting.holiday.at.10-26.1'] },
  { md: '10-28', regions: ['CZ'], greetings: ['greeting.holiday.cz.10-28.1'] },
  { md: '10-28', regions: ['GR'], greetings: ['greeting.holiday.gr.10-28.1'] },
  { md: '10-29', regions: ['TR'], greetings: ['greeting.holiday.tr.10-29.1'] },
  { md: '11-02', regions: ['MX'], greetings: ['greeting.holiday.mx.11-02.1'] },
  { md: '11-03', regions: ['MV'], greetings: ['greeting.holiday.mv.11-03.1'] },
  { md: '11-05', regions: ['GB'], greetings: ['greeting.holiday.gb.11-05.1'] },
  { md: '11-06', regions: ['MA'], greetings: ['greeting.holiday.ma.11-06.1'] },
  { md: '11-11', regions: ['FR'], greetings: ['greeting.holiday.fr.11-11.1'] },
  { md: '11-11', regions: ['PL'], greetings: ['greeting.holiday.pl.11-11.1'] },
  { md: '11-11', regions: ['AU', 'CA', 'GB'], greetings: ['greeting.holiday.au.11-11.1'] },
  { md: '11-11', regions: ['MV'], greetings: ['greeting.holiday.mv.11-11.1'] },
  { md: '11-11', regions: ['US'], greetings: ['greeting.holiday.us.11-11.1'] },
  { md: '11-15', regions: ['BR'], greetings: ['greeting.holiday.br.11-15.1'] },
  { md: '11-18', regions: ['MA'], greetings: ['greeting.holiday.ma.11-18.1'] },
  { md: '12-01', regions: ['RO'], greetings: ['greeting.holiday.ro.12-01.1'] },
  { md: '12-01', regions: ['PT'], greetings: ['greeting.holiday.pt.12-01.1'] },
  { md: '12-02', regions: ['AE'], greetings: ['greeting.holiday.ae.12-02.1'] },
  { md: '12-05', regions: ['TH'], greetings: ['greeting.holiday.th.12-05.1'] },
  { md: '12-06', regions: ['ES'], greetings: ['greeting.holiday.es.12-06.1'] },
  { md: '12-06', regions: ['FI'], greetings: ['greeting.holiday.fi.12-06.1'] },
  { md: '12-12', regions: ['KE'], greetings: ['greeting.holiday.ke.12-12.1'] },
  { md: '12-16', regions: ['BD'], greetings: ['greeting.holiday.bd.12-16.1'] },
  { md: '12-17', regions: ['BT'], greetings: ['greeting.holiday.bt.12-17.1'] },
  { md: '12-25', regions: ['PK'], greetings: ['greeting.holiday.pk.12-25.1'] },
]

// INTERNATIONAL — days that need no region, checked after NATIONAL so a
// country's own day always wins the date.
const INTERNATIONAL = [
  { md: '01-01', greetings: ['greeting.holiday.intl.01-01.1', 'greeting.holiday.intl.01-01.2', 'greeting.holiday.intl.01-01.3'] },
  { md: '02-14', greetings: ['greeting.holiday.intl.02-14.1', 'greeting.holiday.intl.02-14.2'] },
  { md: '04-23', greetings: ['greeting.holiday.intl.04-23.1', 'greeting.holiday.intl.04-23.2'] },
  { md: '10-31', greetings: ['greeting.holiday.intl.10-31.1', 'greeting.holiday.intl.10-31.2'] },
  { md: '12-24', greetings: ['greeting.holiday.intl.12-24.1'] },
  { md: '12-25', greetings: ['greeting.holiday.intl.12-25.1', 'greeting.holiday.intl.12-25.2'] },
  { md: '12-31', greetings: ['greeting.holiday.intl.12-31.1', 'greeting.holiday.intl.12-31.2'] },
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
  if (sameDay(d, easter)) return ['greeting.holiday.easter']
  const goodFriday = new Date(easter)
  goodFriday.setDate(easter.getDate() - 2)
  if (sameDay(d, goodFriday)) return ['greeting.holiday.good-friday']

  if (region === 'US' && sameDay(d, nthWeekdayOfMonth(d.getFullYear(), 10, 4, 4))) {
    return ['greeting.holiday.thanksgiving.us']
  }
  if (region === 'CA' && sameDay(d, nthWeekdayOfMonth(d.getFullYear(), 9, 1, 2))) {
    return ['greeting.holiday.thanksgiving.ca']
  }
  return null
}

// ---- the pools -------------------------------------------------------------

const BY_BUCKET = {
  latenight: [
    'greeting.bucket.latenight.1',
    'greeting.bucket.latenight.2',
    'greeting.bucket.latenight.3',
    'greeting.bucket.latenight.4',
    'greeting.bucket.latenight.5',
  ],
  dawn: [
    'greeting.bucket.dawn.1',
    'greeting.bucket.dawn.2',
    'greeting.bucket.dawn.3',
    'greeting.bucket.dawn.4',
  ],
  morning: [
    'greeting.bucket.morning.1',
    'greeting.bucket.morning.2',
    'greeting.bucket.morning.3',
    'greeting.bucket.morning.4',
    'greeting.bucket.morning.5',
  ],
  afternoon: [
    'greeting.bucket.afternoon.1',
    'greeting.bucket.afternoon.2',
    'greeting.bucket.afternoon.3',
    'greeting.bucket.afternoon.4',
  ],
  evening: [
    'greeting.bucket.evening.1',
    'greeting.bucket.evening.2',
    'greeting.bucket.evening.3',
    'greeting.bucket.evening.4',
  ],
  night: [
    'greeting.bucket.night.1',
    'greeting.bucket.night.2',
    'greeting.bucket.night.3',
    'greeting.bucket.night.4',
  ],
}

// The weekend pool is used *instead of* the time-of-day pool on Saturday and
// Sunday, except in the small hours, where "Still up?" beats any weekend line.
const WEEKEND = {
  dawn: ['greeting.weekend.dawn.1', 'greeting.weekend.dawn.2'],
  morning: ['greeting.weekend.morning.1', 'greeting.weekend.morning.2', 'greeting.weekend.morning.3', 'greeting.weekend.morning.4'],
  afternoon: ['greeting.weekend.afternoon.1', 'greeting.weekend.afternoon.2', 'greeting.weekend.afternoon.3'],
  evening: ['greeting.weekend.evening.1', 'greeting.weekend.evening.2', 'greeting.weekend.evening.3'],
  night: ['greeting.weekend.night.1', 'greeting.weekend.night.2'],
}

// Sunday gets its own morning line, since "Happy Saturday" on a Sunday is worse
// than saying nothing clever at all.
const SUNDAY_MORNING = ['greeting.sunday.1', 'greeting.sunday.2', 'greeting.sunday.3']

const pick = (list) => list[Math.floor(Math.random() * list.length)]

// greetingFor builds today's greeting: holiday, then weekend, then time of day.
//
// The late-night pool ("Still up?") outranks the weekend one — at 02:00 the fact
// that it is Saturday is not the interesting thing about the moment — but NOT
// the holiday one. Opening the app at one in the morning on Christmas should say
// Merry Christmas; the date has not rolled over yet, so the day is still the
// day, and "Still up?" would be the one greeting that ignores it.
export function greetingFor(username, now = new Date(), region = localRegion()) {
  const name = (username || '').trim() || t('greeting.name-fallback')
  const bucket = timeBucket(now)
  let pool = BY_BUCKET[bucket] || BY_BUCKET.morning

  const holiday = holidayFor(now, region)
  if (holiday) {
    pool = holiday
  } else if (isWeekend(now) && bucket !== 'latenight') {
    const weekend = now.getDay() === 0 && bucket === 'morning' ? SUNDAY_MORNING : WEEKEND[bucket]
    if (weekend?.length) pool = weekend
  }
  return t(pick(pool), { name })
}

// dateLine — the mono line above the greeting. Rendered with the device's own
// locale and zone (toLocaleDateString with no locale argument), so the date
// reads the way the reader's system writes dates.
export function dateLine(now = new Date()) {
  const weekday = now.toLocaleDateString(undefined, { weekday: 'long' })
  const date = now.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
  return t('greeting.dateline.format', { weekday, date })
}
