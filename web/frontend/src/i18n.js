// The words the interface is in.
//
// Every user-facing string in this app is a KEY resolved here. There is no
// English literal at a call site and no English fallback argument to t(): the
// code holds keys, the files hold copy, and the two are the same shape for every
// language including the two that ship in the box.
//
// THE FILES ARE NOT IN THIS DIRECTORY, and that is the one surprising thing in
// this module. The canonical bytes live at internal/i18n/en.txt and bn.txt, and
// this file imports them across the tree boundary with Vite's `?raw`. The reason
// is asymmetric tooling: //go:embed cannot reach outside its own package
// directory — internal/changelog exists entirely to work around that and pays for
// it with a duplicated CHANGELOG.md and a drift test — while Vite can resolve any
// path in the repository. So the bytes go where the constrained side can see
// them, and there is exactly ONE copy of every string with nothing to keep in
// step. The Dockerfile's frontend stage copies internal/i18n/*.txt for the same
// reason.
//
// THIS MODULE IS SHAPED LIKE theme.js, deliberately, because the problem is the
// same one: frozen tables at module scope, mutable module state holding the live
// answer, one applier that writes the DOM, pure readers called during render.
// Nothing here is context and nothing is reactive. The one addition is a
// subscription (useLocale), because unlike a palette the answer changes AFTER the
// first paint — the server has to be asked what is in data/Locales.
//
// AND IT IS ITS OWN APPLIER WITH ITS OWN PUT, for the reason theme.js states
// twice: Settings' Appearance card re-sends every theme field on any change, so a
// preference riding inside that object would be wiped by an unrelated accent
// click. Two writers of one setting is how they drift.

import { useEffect, useState } from 'react'
import { json } from './api.js'
import builtinEN from '../../../internal/i18n/en.txt?raw'

// ---- the format ------------------------------------------------------------
//
// One parser, and the Go one in internal/i18n/i18n.go applies the same rules in
// the same order. They are pinned to one hand-written answer over one fixture —
// internal/i18n/testdata/agree.txt and agree.json — so neither generates the
// other's expectation and either drifting goes red on its own.

// The whitespace the two parsers agree on, named explicitly because the two
// languages disagree about what "whitespace" means: String.prototype.trim strips
// NBSP and U+FEFF, Go's strings.TrimSpace strips U+0085. Neither default is
// wrong; two different defaults across one file format is.
//
// NBSP IS DELIBERATELY NOT IN HERE. A leading or trailing non-breaking space is a
// character a translator typed on purpose — French punctuation needs one before a
// colon — and trimming it would silently correct their language.
const TRIM = ' \t\n\r\v\f'

function trim(s) {
  let a = 0
  let b = s.length
  while (a < b && TRIM.includes(s[a])) a += 1
  while (b > a && TRIM.includes(s[b - 1])) b -= 1
  return s.slice(a, b)
}

// parseLocale reads a locale file. It never throws: every recoverable problem is
// recorded in the result and the rest of the file loads.
//
// THE RULES, in the order they apply:
//
//  1. a leading U+FEFF byte-order mark is dropped from the document, once. An
//     editor that writes one would otherwise leave the mark glued to the first
//     key, which resolves nowhere and looks like a typo nobody can see.
//  2. CRLF and lone CR both become LF, so a file edited on Windows or by an older
//     Mac editor parses the same as one edited on Linux.
//  3. a line that trims to nothing is skipped.
//  4. a line that trims to something starting with # is a comment.
//  5. the FIRST = splits key from value, so a value may contain =.
//  6. both halves are trimmed.
//  7. no =, or an empty key, is a bad line: recorded, skipped, and the rest of the
//     file loads. Design §5 — one mangled line costs exactly that one string.
//  8. a duplicate key is LAST WINS. A file is read top to bottom and the later
//     line is the later edit; refusing the file over it would cost every other
//     string in it.
//
// AN EMPTY VALUE IS ABSENT, NOT EMPTY, and this is the rule that makes the
// generated template safe to drop in half-finished. `some.key =` is a line nobody
// has filled in yet: it is not in `keys`, so the resolver walks past it to the
// next language, and it does not count towards coverage. Without it, a template
// dropped in unfilled would blank the entire interface — the exact failure §8
// forbids.
export function parseLocale(src) {
  const keys = {}
  const reserved = {}
  const emptySet = new Set()
  const bad = []
  let text = String(src == null ? '' : src)
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i += 1) {
    const s = trim(lines[i])
    if (s === '' || s[0] === '#') continue
    const eq = s.indexOf('=')
    if (eq < 0) {
      bad.push(i + 1)
      continue
    }
    const key = trim(s.slice(0, eq))
    if (key === '') {
      bad.push(i + 1)
      continue
    }
    const val = trim(s.slice(eq + 1))
    // Last wins in BOTH directions: a key re-appearing with an empty value
    // un-sets it, and one re-appearing with a value un-empties it. Otherwise the
    // two collections disagree about the same file.
    delete keys[key]
    delete reserved[key]
    emptySet.delete(key)
    if (val === '') {
      emptySet.add(key)
    } else if (key[0] === '_') {
      reserved[key] = val
    } else {
      keys[key] = val
    }
  }
  return { keys, reserved, empty: [...emptySet].sort(), bad }
}

// ---- the tables ------------------------------------------------------------

// The two languages compiled in, in picker order. BOTH, always: design §3 says
// neither is the source language and neither is the other's fallback of last
// resort, so this is an inventory and not a precedence.
export const BUILTIN_CODES = ['en', 'bn']

// ---- one of the two is compiled in; the other is a chunk ---------------------
//
// Both used to be inlined here, and between them they were 870KB of text — 236KB
// gzipped, which was FIFTY-EIGHT PER CENT of the application bundle. Every reader
// downloaded both languages and parsed 6,880 lines before the first paint,
// whichever one they read in.
//
// English stays compiled in, because it is what a device that has never chosen
// renders (DEFAULT_LOCALE) and what the login screen is in before any session
// exists. Deferring it would trade a working first screen for a request.
//
// Bengali is loaded on demand — awaited at boot when it is the active language, so
// a Bengali reader still never sees a frame of English, and fetched quietly after
// the first paint otherwise, so the symmetric fallback below is restored without
// anybody waiting for it. It is the same bytes from the same origin either way;
// what changes is that they are no longer on the critical path of a reader who
// does not want them. Design §3 is untouched: both languages are still shipped in
// the box, still offered by the picker, and neither is the other's source.
const BUILTIN = { en: parseLocale(builtinEN) }

// ensureBuiltin loads a compiled-in language that is not resident yet. Idempotent
// and safe to call from anywhere; concurrent callers share one request.
const loading = new Map()
export function ensureBuiltin(code) {
  if (BUILTIN[code]) return Promise.resolve()
  if (!BUILTIN_CODES.includes(code)) return Promise.resolve()
  if (loading.has(code)) return loading.get(code)
  const p = import('../../../internal/i18n/bn.txt?raw')
    .then(({ default: src }) => {
      BUILTIN[code] = parseLocale(src)
      // Both derived answers are now stale: the key set is a union over the
      // built-ins, and every merged table that fell through to this language was
      // memoised without it.
      fullKeySet = null
      tables = new Map()
      reresolve()
    })
    .catch(() => {
      // A language that will not load is a language the reader cannot pick, which
      // installedLocales already handles by asking BUILTIN_CODES rather than
      // BUILTIN. Nothing to report: the interface is complete in English.
    })
  loading.set(code, p)
  return p
}

// ensureBuiltins loads every compiled-in language. The coverage arithmetic below
// is the only thing that needs all of them at once.
export const ensureBuiltins = () => Promise.all(BUILTIN_CODES.map(ensureBuiltin))

// DEFAULT_LOCALE is what a device that has never chosen renders.
//
// NOT THE BROWSER'S LANGUAGE, on purpose. navigator.language would be a nicer
// first guess and a worse one to reason about: it makes the default a property of
// the machine, so two readers of one account see different words and every test
// has to pin it. The first-run screen carries a picker instead, which is a
// question asked once rather than a guess made forever.
export const DEFAULT_LOCALE = 'en'

// PSEUDO is design §9's pseudo-locale: not a translation, a transform. See
// pseudoTransform.
export const PSEUDO = 'qps'

// The device-local mirror of the choice. Same shape as theme.js's LABELS_KEY and
// for a related reason: it is read SYNCHRONOUSLY at boot, before the first paint
// and before any session exists, which is the only way the login screen and the
// first-run screen are in the reader's language at all. It is a mirror and not a
// second preference — the account's `locale` is what carries the choice between
// devices, and every write goes through both.
export const LOCALE_KEY = 'tippani:locale'

// normCode mirrors i18n.NormalizeCode on the server exactly. Shape only: design
// §4 says the preference is validated against what EXISTS rather than against a
// hardcoded list, so a code nobody has heard of is a valid code.
export function normCode(raw) {
  const s = trim(String(raw == null ? '' : raw)).toLowerCase()
  if (!s || s.length > 16) return ''
  return /^[a-z0-9-]+$/.test(s) ? s : ''
}

// The full key set is what "100%" means, and it is the union of the two built-ins
// rather than either one of them.
//
// SYMMETRIC BECAUSE §3 IS. Measuring bn against en would make en the source
// language by arithmetic, and would also hide the opposite mistake: a key added
// to bn.txt and forgotten in en.txt would leave en at a silent 100%. Measured
// against the union, both files report the truth about themselves. A key that
// exists only in a data/Locales file is NOT in here — the app's key set is
// defined by what the code asks for, which the shipped files approximate, and a
// string nothing renders is not coverage.
// Computed on demand rather than at module scope, because the second built-in now
// arrives later — see ensureBuiltin, which clears this. A caller that wants the
// true union awaits ensureBuiltins() first; one that does not gets the union over
// whatever is resident, which is the same answer whenever the files agree.
let fullKeySet = null
const fullKeySetNow = () => {
  if (!fullKeySet) {
    fullKeySet = new Set(BUILTIN_CODES.flatMap((c) => Object.keys(BUILTIN[c]?.keys || {})))
  }
  return fullKeySet
}

// fullKeys is the key set coverage is measured against, sorted. Exported so the
// suite can assert the percentages against real keys rather than invented ones,
// and returned as a copy so nothing can shrink what "100%" means.
export const fullKeys = () => [...fullKeySetNow()].sort()

// ---- the live answer -------------------------------------------------------

let files = {} // code -> parsed file, from data/Locales via GET /locales
let filesSig = '{}' // the payload we last applied, so an unchanged one is free
let pref = '' // what the reader STORED, which may name a file that is gone
let active = DEFAULT_LOCALE // what is actually RENDERING
let chainCodes = [DEFAULT_LOCALE] // the resolved fallback chain, in order
let tables = new Map() // code -> merged key table, memoised
let pseudo = null // the generated pseudo table, memoised
const warned = new Set() // keys already complained about, so one bug is one line

const fileOf = (code) => files[code] || null
const builtinOf = (code) => BUILTIN[code] || null

// installedLocales lists every language a reader may choose right now: the two in
// the box, whatever is in data/Locales, and the pseudo-locale.
export function installedLocales() {
  const out = [...BUILTIN_CODES]
  for (const code of Object.keys(files).sort()) if (!out.includes(code)) out.push(code)
  out.push(PSEUDO)
  return out
}

export const isInstalled = (code) => installedLocales().includes(code)

// tableFor is one language's merged strings: the data/Locales file OVER the
// compiled-in copy, per key. Design §5, and symmetric — en.txt in the data dir
// overrides the compiled-in English exactly as fr.txt provides French.
function tableFor(code) {
  if (tables.has(code)) return tables.get(code)
  let merged
  if (code === PSEUDO) {
    merged = pseudoTable()
  } else {
    merged = { ...(builtinOf(code)?.keys || {}), ...(fileOf(code)?.keys || {}) }
  }
  tables.set(code, merged)
  return merged
}

// reservedFor is one language's metadata — _name, _fallback, _dir — with the same
// file-over-built-in rule as its strings.
function reservedFor(code) {
  if (code === PSEUDO) return { _name: pseudoTransform(resolveIn([DEFAULT_LOCALE, ...BUILTIN_CODES], 'locale.pseudo.name') || 'Pseudo') }
  return { ...(builtinOf(code)?.reserved || {}), ...(fileOf(code)?.reserved || {}) }
}

// ---- the chain -------------------------------------------------------------

// buildChain is design §8: the active language, then its declared _fallback and
// that one's, guarding against a cycle, then a compiled-in built-in.
//
// THE TERMINAL IS BOTH BUILT-INS, IN ORDER, AND THAT IS THE READING OF §3 THIS
// CODE COMMITS TO. §8 ends the chain at "a compiled-in built-in" without saying
// which, and §3 says neither of the two is the other's fallback of last resort.
// The only way to honour both is symmetry: whichever language is active, the
// terminal is every built-in it has not already reached, in BUILTIN_CODES order.
// So Bengali's floor is English and English's floor is Bengali — each other's,
// equally, which is not the same as one being the other's source.
//
// The alternative readings were both worse. Ending bn's chain at bn alone is
// literal and leaves an app of placeholders while bn.txt is still being written,
// which is not "incompleteness is a visible fact" but a broken screen. Ending
// every chain at en makes en the source language by mechanism, which is the one
// thing §3 names.
//
// A CYCLE TERMINATES BECAUSE THE CHAIN IS A SET, not because a depth counter runs
// out. `_fallback = b` in a.txt and `_fallback = a` in b.txt is a mistake two
// people can make separately, and it must cost nothing.
function buildChain(code) {
  // THE PSEUDO-LOCALE FALLS THROUGH TO NOTHING, and that is the whole point of
  // it. Its table is generated from the full key set, so it can only miss a key
  // no language has — and reaching English for that one would put a single
  // untransformed sentence on screen, which is exactly the signal §9 exists to
  // give about an UNWRAPPED literal. A false positive there is worse than a terse
  // placeholder, which t() transforms instead.
  if (code === PSEUDO) return [PSEUDO]
  const out = []
  const seen = new Set()
  let cur = code
  while (cur && !seen.has(cur)) {
    seen.add(cur)
    out.push(cur)
    cur = normCode(reservedFor(cur)._fallback || '')
    if (cur && !isInstalled(cur)) cur = '' // a _fallback naming a language nobody has
  }
  for (const b of BUILTIN_CODES) if (!seen.has(b)) out.push(b)
  return out
}

// localeChain exposes the chain for the tests and for nothing else. Returned as a
// copy: a caller that mutated it would change what the app renders.
export const localeChain = () => [...chainCodes]

function resolveIn(codes, key) {
  for (const code of codes) {
    const v = tableFor(code)[key]
    if (v) return v
  }
  return ''
}

// ---- t() -------------------------------------------------------------------

// fill substitutes {name} placeholders. The convention is taken from
// greetings.js, which has carried 149 lines of `{name}` since long before this
// module existed, rather than invented here.
//
// AN UNKNOWN PLACEHOLDER IS LEFT ON SCREEN, not blanked. `{count}` showing
// through is a call site that forgot an argument, and that is worth seeing; a
// silent gap is the same bug with nothing to notice.
function fill(text, vars) {
  if (!vars) return text
  return text.replace(/\{(\w+)\}/g, (whole, name) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : whole,
  )
}

// pluralCategory asks the ACTIVE language's own rules, not English's. Bengali has
// two forms, Polish four, Arabic six; a file supplies whichever ones its language
// needs and the lookup finds them by name.
//
// A code Intl has never heard of throws, and the fall-through is the English-ish
// two-form rule — which is wrong for some languages and is still better than
// refusing to render a count.
function pluralCategory(count) {
  try {
    return new Intl.PluralRules(active).select(count)
  } catch {
    return count === 1 ? 'one' : 'other'
  }
}

// placeholderFor is what a key that resolves NOWHERE renders.
//
// §8 forbids both blank and the key itself, and it is right to: a dotted key on
// screen is debug output leaking into somebody's library, and it is also unusable
// — `library.help.topbar.swipe.description` in a button is worse than no button.
// So the LAST SEGMENT is humanised. Keys are long and self-describing by §2, which
// makes their last segment a real word: `actions.copy` renders "Copy",
// `board.filters.clear` renders "Clear". It reads as terse rather than as broken,
// which is the most a reader can be given for a string nobody has written.
//
// The developer gets the actual key, once, in the console — because this state is
// always a bug (a typo, or a key added to the code and not to en.txt) and the
// person who can fix it is not looking at the button.
export function placeholderFor(key) {
  const last = String(key).split('.').pop() || String(key)
  const words = trim(last.replace(/[_-]+/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2')).toLowerCase()
  return words ? words[0].toUpperCase() + words.slice(1) : '…'
}

// t is the whole reading surface: t(key) or t(key, {vars}).
//
// NO FALLBACK ARGUMENT, and that is the design rather than an omission. An
// English string at the call site is a second source of truth that nothing keeps
// in step, and — worse — it is the one that gets read: a reviewer stops looking at
// the file the moment the sentence is visible in the JSX, and the key stops being
// the name of anything.
//
// A NUMERIC `count` SELECTS A PLURAL FORM. `t('bin.quotes', {count: n})` looks for
// bin.quotes.one / .other / whatever category the active language uses, then falls
// back to bin.quotes itself. That is what replaces the three separate copies of an
// English `plural()` helper in Library.jsx, TagsPage.jsx and stickers.jsx.
export function t(key, vars) {
  return fill(resolveText(key, countIn(vars)), vars)
}

const countIn = (vars) => (vars && typeof vars.count === 'number' ? vars.count : undefined)

// resolveText walks the chain and returns the string with its {placeholders}
// still in it. Split out from t() so tNodes shares one plural rule and one
// missing-key rule instead of growing a second copy of either.
function resolveText(key, count) {
  const k = String(key || '')
  const text =
    count === undefined
      ? resolveIn(chainCodes, k)
      : resolveIn(chainCodes, `${k}.${pluralCategory(count)}`) ||
        resolveIn(chainCodes, `${k}.other`) ||
        resolveIn(chainCodes, k)
  if (text) return text
  if (!warned.has(k)) {
    warned.add(k)
    // eslint-disable-next-line no-console
    console.warn(`tippani: no string for "${k}" in any language`)
  }
  const stand = placeholderFor(k)
  // The pseudo-locale has to transform this too, or a missing key would be the
  // one thing on screen that looks like real copy.
  return active === PSEUDO ? pseudoTransform(stand) : stand
}

// tNodes is t() for a sentence that has to carry a React node — a <b> fragment, a
// link, a count in its own styling.
//
// IT EXISTS SO MARKUP NEVER GOES IN A LOCALE VALUE. A value holding `<b>x</b>`
// would have to be rendered as HTML (there is no dangerouslySetInnerHTML anywhere
// in this app and adding one for copy is a poor trade), and a translator who
// mistypes a tag would break a screen rather than a string. So the value carries
// {placeholders} and the call site supplies what goes in them:
//
//   <p>{tNodes('tour.welcome.body', { app: <b>tippani</b> })}</p>
//
// Returns an array of strings and whatever was passed, which React renders as
// children. A placeholder with no value is left as its own text, exactly as fill
// leaves it.
export function tNodes(key, vars) {
  const text = resolveText(key, countIn(vars)) // NOT filled, so the braces survive
  const out = []
  const re = /\{(\w+)\}/g
  let last = 0
  let m = re.exec(text)
  while (m) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const has = vars && Object.prototype.hasOwnProperty.call(vars, m[1])
    out.push(has ? vars[m[1]] : m[0])
    last = m.index + m[0].length
    m = re.exec(text)
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

// ---- the pseudo-locale (design §9) -----------------------------------------

// PSEUDO_LETTERS accents every ASCII letter. The point is not to look like a
// language — it is that a string which came through t() is unmistakable, so an
// English literal still sitting in the JSX is the only plain text on the screen.
const PSEUDO_LETTERS = {
  a: 'à', b: 'ƀ', c: 'ç', d: 'ð', e: 'ë', f: 'ƒ', g: 'ĝ', h: 'ĥ', i: 'í', j: 'ĵ',
  k: 'ķ', l: 'ł', m: 'ɱ', n: 'ñ', o: 'ö', p: 'þ', q: 'ɋ', r: 'ř', s: 'š', t: 'ţ',
  u: 'ü', v: 'ṽ', w: 'ŵ', x: 'ẋ', y: 'ý', z: 'ž',
  A: 'À', B: 'Ɓ', C: 'Ç', D: 'Ð', E: 'Ë', F: 'Ƒ', G: 'Ĝ', H: 'Ĥ', I: 'Í', J: 'Ĵ',
  K: 'Ķ', L: 'Ł', M: 'Ɱ', N: 'Ñ', O: 'Ö', P: 'Þ', Q: 'Q', R: 'Ř', S: 'Š', T: 'Ţ',
  U: 'Ü', V: 'Ṽ', W: 'Ŵ', X: 'Ẋ', Y: 'Ý', Z: 'Ž',
}

// How much longer a pseudo string is than its source, as a fraction. Real
// translations of English run 20-40% longer; the padding is what makes a layout
// that only fits English fail visibly here instead of in Bengali.
const PSEUDO_PAD = 0.3

// pseudoTransform wraps and accents one string.
//
// PLACEHOLDERS COME THROUGH UNTOUCHED, which is the only part that is not
// cosmetic: `{name}` accented to `{ñàmë}` would stop matching, and every
// interpolated string in the app would show its braces under the one locale meant
// to find layout bugs.
export function pseudoTransform(text) {
  const parts = String(text == null ? '' : text).split(/(\{\w+\})/g)
  let out = ''
  let visible = 0
  for (const part of parts) {
    if (/^\{\w+\}$/.test(part)) {
      out += part
      continue
    }
    visible += part.length
    for (const ch of part) out += PSEUDO_LETTERS[ch] || ch
  }
  return `⟦${out}${'·'.repeat(Math.ceil(visible * PSEUDO_PAD))}⟧`
}

// pseudoTable generates the pseudo-locale as a TABLE rather than as a mode.
//
// That is a real choice and it buys one thing: the pseudo-locale is then a
// language like any other. It goes in the picker, it goes through buildChain, and
// its coverage falls out of the same formula instead of needing a special case in
// four places. Its source for each key is what a reader would otherwise SEE —
// English over its data-dir override, then Bengali — so an operator who corrected
// an English string sees their correction transformed.
//
// ITS HONEST COVERAGE IS 100%, BY CONSTRUCTION, because it is generated from the
// key set coverage is measured against. That number is not flattery and not a
// lie; it is what "derived from every key" arithmetically means.
function pseudoTable() {
  if (pseudo) return pseudo
  pseudo = {}
  for (const key of fullKeySetNow()) {
    const source = tableFor('en')[key] || tableFor('bn')[key] || ''
    if (source) pseudo[key] = pseudoTransform(source)
  }
  return pseudo
}

// ---- coverage (design §7) --------------------------------------------------

// coverage is the percentage the picker shows beside a language.
//
// SHOWN, NEVER ENFORCED. No test may fail because a language is incomplete — that
// is §7, and it is what makes a half-finished contribution shippable. One test
// does fail if this NUMBER is wrong, because a lying percentage is worse than
// none.
//
// FLOORED, AND 100 ONLY WHEN COMPLETE. Rounding 99.6% up to 100% is the exact lie
// worth guarding against: a reader who is told a language is finished and then
// meets English in it has been told something false about the app. So the floor
// is the general rule and 100 is a special case that requires every key.
//
// An empty key set is 100%, not a division by zero. That is the honest answer
// while the migration has not started: a language that has every string there is
// has every string there is, even when there are none.
export function coverage(code) {
  const table = tableFor(code)
  let have = 0
  const full = fullKeySetNow()
  for (const key of full) if (table[key]) have += 1
  return coveragePercent(have, full.size)
}

// coveragePercent is the arithmetic on its own, so the suite can assert it at
// sizes the shipped files do not reach yet. The 99 clamp only bites past a
// hundred keys, which is exactly where it starts to matter and exactly where a
// test over the real tables cannot reach it.
export function coveragePercent(have, total) {
  if (!total) return 100
  if (have >= total) return 100
  return Math.min(99, Math.floor((have * 100) / total))
}

// ---- the catalogue ---------------------------------------------------------

// localeName is how a language labels ITSELF, per §6 — Français, বাংলা. A file
// with no _name falls back to its bare code, which is metadata rather than copy:
// seeing `fr` in the picker is the accurate report that the file forgot a line.
export function localeName(code) {
  return reservedFor(code)._name || code
}

// localeDir reads _dir. Only 'rtl' counts; anything else is ltr.
//
// SAID HONESTLY IN THE README AND HERE: this flips text direction and the LAYOUT
// HAS NOT BEEN AUDITED FOR RTL. Icons, edges and the film-strip sprockets are all
// positioned on the assumption that reading runs left to right. It is offered
// because a right-to-left language with no dir at all is unreadable, not because
// the app is finished for one.
export function localeDir(code) {
  return reservedFor(code)._dir === 'rtl' ? 'rtl' : 'ltr'
}

// localeCatalogue is what the two pickers render: built-ins in their declared
// order, then whatever the operator added, alphabetically, then the pseudo-locale
// last. Deterministic on purpose — a list that reorders itself between boots is a
// control that moves under a finger.
// localeCatalogue is what the two pickers render. It is NOT installedLocales():
// the pseudo-locale is applicable but not offered.
//
// WHY THEY DIVERGED. §9's pseudo-locale is a translator's instrument — it accents
// and brackets every string that came through the resolver, so an English literal
// still sitting in the JSX is the only plain text on the screen. It earned its
// keep: it is what test/dom/screens-i18n.test.jsx drives, and it is how the three
// tables that held a key and drew it raw were found. But it was also the third
// row of every reader's language menu, under a name written in its own transform
// — ⟦Pšëüðö··⟧ — which reads as a bug in the build rather than as a tool, and the
// app ships two languages, not two and a diagnostic.
//
// So it stays a language in every other sense: isInstalled accepts it,
// applyLocale applies it, buildChain and coverage treat it like any other code.
// It is simply not listed. A translator reaches it by storing the code directly —
// localStorage['tippani:locale'] = 'qps' — which is the same door applyLocale
// reads at boot, and the suite reaches it by calling applyLocale(PSEUDO).
// TWO LANGUAGES CALLING THEMSELVES THE SAME THING are disambiguated by their code,
// never refused. `_name` is somebody's own word for their own language and nothing
// stops two files using it: a dialect that has not renamed itself (fr and fr-ca
// both "Français"), a fork of a translation, or the same file copied under a
// second code while it is being worked on. All three are reasonable, and the
// picker showing two identical rows is not — you cannot choose between them, and
// the one you get is whichever the list happened to put first.
//
// REFUSING THE SECOND FILE WAS THE OTHER OPTION AND IT IS WORSE. It would delete
// somebody's translation from the app over a naming collision they can only
// diagnose from a log they have no reason to read. Appending the code costs one
// parenthesis and leaves both reachable, which is the same instinct as the Go
// side's collision rule next door: prefer the answer that loses nothing.
//
// Compared case- and space-insensitively, because "Français" and "français " are
// the same claim and the reader who typed the second one cannot see the difference
// either.
export function localeCatalogue() {
  const codes = installedLocales().filter((code) => code !== PSEUDO)
  const seen = new Map() // normalised name -> how many claim it
  for (const code of codes) {
    const k = localeName(code).trim().toLowerCase()
    seen.set(k, (seen.get(k) || 0) + 1)
  }
  return codes.map((code) => {
    const name = localeName(code)
    const shared = (seen.get(name.trim().toLowerCase()) || 0) > 1
    return {
      code,
      // The bare code when a file forgot its _name is deliberately NOT dressed up
      // as "fr (fr)": localeName already reports that omission by showing the code,
      // and saying it twice reads as a different fault.
      name: shared && name !== code ? t('locale.picker.disambiguate', { name, code }) : name,
      dir: localeDir(code),
      percent: coverage(code),
      builtin: BUILTIN_CODES.includes(code),
    }
  })
}

// localePref is what the reader STORED and localeActive is what is RENDERING, and
// they are two questions because they have two answers.
//
// theme.js writes data-labels AND data-labels-mode for the same reason: the
// resolved value cannot express the difference that matters. Here the difference
// is design §4's — a stored preference may name a file the operator has since
// removed, and the app renders a built-in rather than blanking. The picker needs
// to be able to say so instead of silently showing a language nobody chose.
export const localePref = () => pref
export const localeActive = () => active

// localeMissing is the stored code when it names a language that is not installed,
// and '' otherwise.
export const localeMissing = () => (pref && !isInstalled(pref) ? pref : '')

// ---- the applier -----------------------------------------------------------

function invalidate() {
  tables = new Map()
  pseudo = null
}

function reresolve() {
  active = isInstalled(pref) ? pref : DEFAULT_LOCALE
  chainCodes = buildChain(active)
  if (typeof document !== 'undefined' && document.documentElement) {
    const root = document.documentElement
    // TWO ATTRIBUTES, per theme.js. `lang` is what is actually rendering, and CSS
    // and a screen reader both read it. `data-locale-pref` is the RAW preference,
    // so a stored language that is no longer installed is visible in the DOM
    // rather than being silently indistinguishable from having chosen nothing.
    root.lang = active
    root.dir = localeDir(active)
    root.dataset.localePref = pref
  }
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
    // The escape hatch for anything that is not a React subtree, exactly as
    // theme.js's 'tippani:theme' is — and what useLocale listens to.
    window.dispatchEvent(new CustomEvent('tippani:locale', { detail: { active, pref, dir: localeDir(active) } }))
  }
}

// applyLocale sets the language. Called with NO ARGUMENT it reads the device-local
// mirror itself, which is what boot does — the preference has to be readable
// synchronously, before the first paint, or a phone shows one frame of English and
// then snaps.
//
// Called WITH a code it writes the mirror, so the next boot's pre-session screens
// match the choice. The account's own `locale` preference is PUT separately by
// whoever is changing it; this function does not touch the network, for the same
// reason applyTheme does not.
export function applyLocale(code) {
  if (code === undefined) {
    let stored = null
    try {
      stored = localStorage.getItem(LOCALE_KEY)
    } catch {
      stored = null // private mode / storage disabled — fall through to the default
    }
    pref = normCode(stored)
  } else {
    pref = normCode(code)
    try {
      if (pref) localStorage.setItem(LOCALE_KEY, pref)
      else localStorage.removeItem(LOCALE_KEY)
    } catch {
      // The choice still applies to this session; it just will not survive a
      // reload. Nothing to report — losing it is not worth an error message.
    }
  }
  reresolve()
}

// setLocaleFiles applies what GET /locales answered.
//
// A PAYLOAD THAT CHANGED NOTHING COSTS NOTHING. On the ordinary instance — nobody
// has added a language — this is `{}` on every boot, and returning early means no
// re-render and no flash. Without the check, every boot would re-render the whole
// app once for no reason.
export function setLocaleFiles(payload) {
  const incoming = payload || {}
  const sig = JSON.stringify(incoming)
  if (sig === filesSig) return false
  filesSig = sig
  const next = {}
  for (const [raw, file] of Object.entries(incoming)) {
    const code = normCode(raw)
    if (!code || !file) continue
    next[code] = {
      keys: file.keys || {},
      reserved: file.reserved || {},
      empty: file.empty || [],
      bad: file.bad || [],
    }
  }
  files = next
  invalidate()
  // Re-resolved rather than left alone: a file that just arrived may be exactly
  // the language the reader stored, which until now was falling back.
  reresolve()
  return true
}

// loadLocaleFiles asks the server what is in data/Locales. Best effort and never
// throwing: the built-ins are already loaded, so a server that cannot answer
// costs the operator's added languages and nothing else. Design §3.
export async function loadLocaleFiles() {
  const r = await json('GET', '/locales')
  if (!r.ok || !r.data) return false
  return setLocaleFiles(r.data.files)
}

// useLocale re-renders a component when the language changes.
//
// ONE CALL, IN App, IS ENOUGH for the whole tree, and that is why t() is a plain
// function everywhere else. A migration that had to add a hook to every component
// would be a migration nobody finishes; a call site reads `t('key')` and knows
// nothing about subscriptions. The two pickers call it as well, because they show
// the coverage numbers and the ✓, which change without App re-rendering for any
// other reason.
export function useLocale() {
  const [, bump] = useState(0)
  useEffect(() => {
    const onChange = () => bump((n) => n + 1)
    window.addEventListener('tippani:locale', onChange)
    return () => window.removeEventListener('tippani:locale', onChange)
  }, [])
  return active
}

// resetLocaleForTests puts the module back to a fresh boot. Exported for the
// suite only: module state is shared across tests in one file, and a test that
// dropped a French file in would otherwise decide the next one's chain.
export function resetLocaleForTests() {
  files = {}
  filesSig = '{}'
  pref = ''
  warned.clear()
  invalidate()
  reresolve()
}
