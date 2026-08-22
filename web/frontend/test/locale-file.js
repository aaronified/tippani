// The shipped English, for the tests that measure COPY rather than behaviour.
//
// The budgets in this suite used to read the source: a 240-character cap on an
// InfoDot matched `text="…"` in a .jsx file, and a 160-character cap on a help
// entry read a string literal out of help.jsx's registry. After the migration
// there is no copy in the source to read — the code holds keys and the words live
// in internal/i18n/en.txt — so a scan of src/ reports success about an empty set,
// which is the one failure mode those tests were written to prevent.
//
// So they read the file instead, through THIS module rather than each parsing it
// again. Two parsers over one format is how the two come to disagree about a value
// containing '=' (the rule is "split on the FIRST ="), and the app already ships a
// parser whose behaviour is pinned against the Go one by a shared fixture. That is
// the one imported here.
//
// SELECTION IS BY KEY, and that is what makes it mechanical. A key's last segment
// says what the string IS — .what, .how.N, .more, .info.body — so a budget can pick
// out exactly the strings it governs without a human maintaining a list. It is the
// property design §2 asks the naming to carry, used.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseLocale } from '../src/i18n.js'

// TIPPANI_SRC is web/frontend/src, exported by vitest.config.js — a test cannot
// work out where the source is on its own. The locale files live three levels up,
// beside the Go parser that embeds them; see src/i18n.js for why they are there.
export const I18N_DIR = join(process.env.TIPPANI_SRC, '..', '..', '..', 'internal', 'i18n')
export const EN_PATH = join(I18N_DIR, 'en.txt')

export const BN_PATH = join(I18N_DIR, 'bn.txt')

export const EN_RAW = readFileSync(EN_PATH, 'utf8')

// The parsed file: { keys, reserved, empty, bad }. An empty value is ABSENT rather
// than empty, so `keys` is exactly what the app can render.
export const EN = parseLocale(EN_RAW)
export const BN = parseLocale(readFileSync(BN_PATH, 'utf8'))

// BUILTINS is both languages in the box, for a rule about what RENDERS rather than
// about the English. A copy budget is one of those: a translation that runs 30%
// longer than the English overflows the same box, so the cap applies to it too.
//
// A BUDGET IS MEASURED OVER WHAT EACH FILE HAS, never over what it lacks — an
// absent key is skipped rather than counted as zero characters. This paragraph
// used to give design §7 as the reason and stop there, which read as "no test may
// ever require a language to be complete". §7 is about the NUMBER the picker
// shows, and about a config language, whose half-finished state is the supported
// normal. It says nothing about the two files inside the binary, and those are
// now held to every token by token-coverage.test.js — the standing rule is that a
// feature ships its English and its Bengali together. The distinction matters
// here: a budget cannot enforce completeness anyway, because a key a file lacks
// has no length to measure.
export const BUILTINS = [
  ['en', EN],
  ['bn', BN],
]

export const enKeys = () => Object.keys(EN.keys)

// value returns one string, or '' — never undefined, so a caller measuring lengths
// does not have to guard.
export const value = (key) => EN.keys[key] || ''

// under selects a namespace: every key beginning `<prefix>.`, in file order.
export const under = (prefix) => enKeys().filter((k) => k.startsWith(`${prefix}.`))

// leaf selects a ROLE: every key whose last segment is `name`. This is the
// selector the copy budgets use — `.what` is one sentence wherever it appears, on
// whatever screen, in whatever language.
export const leaf = (name) => enKeys().filter((k) => k.endsWith(`.${name}`))

// matching selects by pattern, for a role that carries an index (`.how.1`).
export const matching = (re) => enKeys().filter((k) => re.test(k))

// pool reads an indexed prose pool — greeting.epigraph.1, .2, … — in numeric
// order, stopping at the first gap. The number in the key IS the line's identity
// (greetings.js), so a gap is a missing line and not a shorter pool.
export function pool(prefix) {
  const out = []
  for (let i = 1; ; i += 1) {
    const v = EN.keys[`${prefix}.${i}`]
    if (!v) return out
    out.push(v)
  }
}
