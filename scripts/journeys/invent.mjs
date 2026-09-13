// INVENTED PROSE THAT KEEPS THE SHAPE OF WHAT IT REPLACES.
//
// The journeys' fixture is built from the owner's real library, and the repo is
// public, so what a person reads and watches must not go into it. The owner's
// ruling: "Shape only. But invented prose for names, titles, annotations, notes
// (in same scripts)."
//
// SHAPE IS THE WHOLE POINT, because shape is what catches the bugs. CLAUDE.md
// records that the seeded fixture hides a class of defect precisely by being
// tidy — no name long enough to truncate, no quote long enough to wrap badly, a
// cast of three. The real library has a 72-character title, a 2,378-character
// quote and eleven cast rows on one film. Invented text that lands in the same
// band keeps every one of those tests honest while saying nothing about anybody.
//
// SAME SCRIPT, because a Devanagari quote replaced by Latin text would silently
// delete the per-language font work, the script-keyed faces and the bidi
// handling from everything downstream of the fixture.
//
// DETERMINISTIC, keyed on the ORIGINAL. The same input always yields the same
// invented output, so re-running the curation produces a byte-identical recipe
// and a diff means somebody's library changed rather than that a generator
// rolled differently. The key is a hash of the input, so no counter and no
// ordering dependence.
//
// AND OBVIOUSLY SYNTHETIC. The pools are common nouns and constructed surnames;
// nothing here is a real person or a real book, and the point is that a reader of
// the fixture can tell at a glance that it is invented rather than wondering
// whether they are looking at somebody's shelf.

// FNV-1a, for a stable 32-bit key from a string. Small, dependency-free, and its
// only job is to spread inputs across seeds.
function keyOf(s) {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

// mulberry32: a real generator with a fixed seed, so the output varies the way
// text varies. Returning a constant would make every pick the same word.
function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const POOLS = {
  Latin: {
    words: ('lantern harbour meadow cinder thistle vellum compass orchard bramble ember quarry ' +
      'willow tideline furrow beacon almanac cobble hollow marram sparrow nettle gable cairn ' +
      'shingle bracken heather kestrel alder plover reed lichen rowan sedge tern wold').split(' '),
    joins: ['and', 'of', 'in', 'before', 'beneath', 'against', 'without', 'toward'],
    first: ('Mira Anselm Ora Bertil Halla Cormac Ines Jarl Nadia Osric Perrin Quilla Rhoda Silas ' +
      'Tamsin Ulric Vesna Wray Ysolde Zeno Alba Ferran Lioba Nuala').split(' '),
    last: ('Ashcombe Brightwater Callender Dunmore Elverson Fairweather Grimsby Hollowell Ivenshaw ' +
      'Jarrow Kettleby Lindhurst Marrowby Netherfield Orrindale Pellworth Quainton Ravensmere ' +
      'Stonebrook Thurlow Underhill Vallence Wexbury Yarrowfield').split(' '),
  },
  Devanagari: {
    words: ('दीपक नदी पर्वत आकाश धरती वृक्ष पवन सागर किरण छाया मौसम पथिक दर्पण कमल बादल सरिता ' +
      'अंगन शिखर तट वन पुष्प तारा प्रभात संध्या स्वर').split(' '),
    joins: ['और', 'का', 'में', 'से', 'पर', 'बिना', 'तक'],
    first: ('अरुणा वीरेन कमला नीरज सरिता मोहन इरा तरुण उमा यश').split(' '),
    last: ('वनवासी शैलेश तटकर दीपांकर मेघवाल नभचर').split(' '),
  },
  Bengali: {
    words: ('আলো নদী পাহাড় আকাশ মাটি গাছ বাতাস সাগর কিরণ ছায়া পথিক দর্পণ পদ্ম মেঘ ভোর সন্ধ্যা সুর').split(' '),
    joins: ['এবং', 'এর', 'মধ্যে', 'থেকে', 'ছাড়া'],
    first: ('অরুণা বীরেন কমলা নীরজ সরিতা মোহন ইরা তরুণ').split(' '),
    last: ('বনবাসী শৈলেশ তটকর দীপাঙ্কর').split(' '),
  },
}

// scriptOf — which pool fits. A string with any Bengali in it is Bengali, and so
// on down: mixed text takes the non-Latin script, because that is the one whose
// rendering the fixture exists to exercise.
export function scriptOf(s) {
  if (/[ঀ-৿]/.test(s)) return 'Bengali'
  if (/[ऀ-ॿ]/.test(s)) return 'Devanagari'
  if (/[؀-ۿ]/.test(s)) return 'Arabic'
  if (/[一-鿿]/.test(s)) return 'Han'
  return 'Latin'
}

const pick = (r, arr) => arr[Math.floor(r() * arr.length) % arr.length]
const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1)

// inventTitle — a title of roughly the original's length, in its script.
export function inventTitle(original) {
  const script = scriptOf(original)
  const pool = POOLS[script] || POOLS.Latin
  const r = rng(keyOf('title:' + original))
  const out = []
  // Titles are capitalised in Latin and not in the Indic scripts, which is how
  // they are actually written — a Devanagari title in Title Case would look
  // wrong to anyone who reads it.
  while (out.join(' ').length < Math.max(6, original.length)) {
    const w = pick(r, pool.words)
    out.push(script === 'Latin' ? cap(w) : w)
    if (out.join(' ').length < original.length - 4 && r() < 0.4) out.push(pick(r, pool.joins))
  }
  return out.join(' ').slice(0, Math.max(6, original.length)).trim()
}

// inventName — a person's name, in the original's script, of a similar length.
// Held to two parts, because that is what a credit line is and a ten-word name
// would be testing something the app never sees.
export function inventName(original) {
  const script = scriptOf(original)
  const pool = POOLS[script] || POOLS.Latin
  const r = rng(keyOf('name:' + original))
  // A long real name is one of the things the fixture exists to carry — the
  // "never truncate a name" rule has nothing to bite on in a library of short
  // ones — so a long original gets a long invention rather than a clipped one.
  //
  // IT APPENDS. THE FIRST DRAFT REASSIGNED, and that is an infinite loop for any
  // original longer than the longest name these pools can spell in three parts:
  // the name was rebuilt from scratch each time round, so it never got longer and
  // the condition never went false. It hung the curator with no output at all,
  // which is the worst way for a loop to be wrong — nothing to read, nothing to
  // grep, just a process that never returns. The cap is the second half of the
  // fix: a bound that cannot be reasoned about is a bound.
  const parts = [`${pick(r, pool.first)} ${pick(r, pool.last)}`]
  while (parts.join('-').length < original.length - 2 && parts.length < 5) {
    parts.push(pick(r, pool.last))
  }
  return parts.join('-')
}

// inventProse — a passage of about the original's length, in its script. Used for
// quote text and for notes; the only difference between them is how long the
// original was, which is exactly the property being preserved.
export function inventProse(original) {
  const script = scriptOf(original)
  const pool = POOLS[script] || POOLS.Latin
  const r = rng(keyOf('prose:' + original))
  const stop = script === 'Devanagari' || script === 'Bengali' ? '।' : '.'
  let out = ''
  while (out.length < original.length) {
    const n = 4 + Math.floor(r() * 9)
    const words = []
    for (let i = 0; i < n; i++) {
      words.push(pick(r, pool.words))
      if (i < n - 2 && r() < 0.25) words.push(pick(r, pool.joins))
    }
    let sentence = words.join(' ')
    if (script === 'Latin') sentence = cap(sentence)
    out += (out ? ' ' : '') + sentence + stop
  }
  // Trimmed to the original's length so a 2,378-character quote stays a
  // 2,378-character quote, then tidied so it does not end mid-word.
  if (out.length > original.length) {
    out = out.slice(0, original.length)
    const cut = out.lastIndexOf(' ')
    if (cut > original.length * 0.6) out = out.slice(0, cut)
    out = out.replace(/[\s.।]+$/, '') + stop
  }
  return out
}
