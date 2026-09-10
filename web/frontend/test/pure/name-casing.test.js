// Every box that holds a NAME asks the keyboard for capitals. No box that holds
// prose does.
//
// THE OWNER'S: "all name type fields should have the auto capitalisation (the html
// based one used in character name for example). chapter name, editor, song name,
// etc all can benefit from that."
//
// WHY THIS READS THE SOURCE RATHER THAN MOUNTING THE FORMS. The hint is a prop at
// each call site — `nameCase` on Field, `autoCapitalize` on the forms that lay out
// their own inputs — spread across a dozen files, and nine sites were missing it
// when the owner asked. Mounting every form that holds a name box means mounting
// most of the app; the rule is about which BOXES exist, which the source answers
// directly. Same reasoning as `spacing-debt` and `no-free-names`, which read the
// tree for the same kind of rule.
//
// AND IT CHECKS BOTH DIRECTIONS, which is what makes it a rule rather than a
// ratchet. A sweep that added the hint to every input in the app would satisfy
// half of this test and fail the other half: `autoCapitalize="words"` on a quote
// box shift-locks the first letter of every word of a sentence somebody is typing,
// which is worse than the default.
import { describe, expect, it } from 'vitest'
import { readSource, sourcesUnder } from '../src-files.js'

// A NAME OR A TITLE — something with proper-noun casing. `editor` is
// `source-author` (0070) and `song name` is `work-title`, which are the two the
// owner named that did not already have it.
const NAME_FIELDS = [
  'common.field.character', 'common.field.actor', 'common.field.speaker',
  'common.field.recipient', 'common.field.work-title', 'common.field.source-author',
  'common.field.chapter-name', 'common.field.episode-name', 'common.field.quest',
  'common.field.dlc', 'common.field.place', 'common.field.region',
  'common.field.language', 'common.field.author', 'common.field.title',
  'common.field.series', 'common.field.publisher', 'common.field.director',
  'common.field.studio',
  // `common.field.name` IS DELIBERATELY ABSENT, and the reason is a flaw in
  // keying this rule on the i18n key at all: that one key is reused by a BOARD's
  // name, a STICKER's name and a TAG's name, and the third is lowercase by this
  // app's own convention — the same convention that keeps `common.field.tags` in
  // the prose list below. One key cannot answer for all three, so the two that
  // want the hint carry it at their call site and this test does not police them.
  // Naming the gap beats a rule that would be wrong a third of the time.
]

// PROSE, AND THE HINT WOULD BE WRONG ON EVERY ONE. Each exclusion has a reason,
// because "why is this one not a name" is the question the next sweep will ask:
//
//   quote / note / translation — sentences. Per-word capitals on a sentence is
//     the keyboard fighting the typist.
//   occasion — a phrase and not a title: "the funeral of his brother" is the
//     common shape, and "The Funeral Of His Brother" is not an improvement.
//   location / locator — a page, a percentage, a stanza. Numbers and units.
//   timestamp / timestamp-end — a clock reading.
//   tags — lowercase by this app's own convention; the token input's own
//     `nameCase` is opt-in for exactly that reason.
const PROSE_FIELDS = [
  'common.field.quote', 'common.field.note', 'common.field.translation',
  'common.field.occasion', 'common.field.location', 'common.field.locator',
  'common.field.timestamp', 'common.field.timestamp-end', 'common.field.tags',
]

// The controls that take a name. Two are absent deliberately, both because the
// hint is already inside them: `CastCombo`'s `nameCase` DEFAULTS to true, and
// `NameInput` hardcodes `autoCapitalize="words"` — it exists for exactly this.
// Requiring the prop at those call sites would be requiring people to restate a
// default, and a caller that DID restate it would read as though the others had
// opted out.
const ELEMENT = /<(input|textarea|Field|SuggestCombo|TokenInput)\b([^>]*?)\/?>/gs
const LABEL = /(?:label|aria-label|ariaLabel|placeholder)=\{t\('([^']+)'\)\}/

// THROUGH sourcesUnder, NOT A HAND-ROLLED readdir. `one-walk.test.js` refuses a
// second walk over src/ and its reason is this test's own worry, already solved:
// "a walk that finds nothing makes a guard green while it checks nothing, which
// is how two of these were found wrong by a reader rather than by a run." The
// shared walk throws below its floor, so this guard cannot silently read nothing
// — and it is recursive, which a hand-rolled readdir of one directory is not.
// A guard that stopped seeing a form moved into a subfolder is the exact bug.
function boxes() {
  const out = []
  for (const file of sourcesUnder((n) => n.endsWith('.jsx'), 20)) {
    const src = readSource(file)
    for (const m of src.matchAll(ELEMENT)) {
      const body = m[2]
      const label = body.match(LABEL)
      if (!label) continue
      out.push({
        file,
        line: src.slice(0, m.index).split('\n').length,
        tag: m[1],
        // The key without its final segment, so `.label` and `.placeholder` of
        // one field fold together.
        field: label[1].replace(/\.[^.]+$/, ''),
        hinted: /\bnameCase\b/.test(body) || /autoCapitalize=/.test(body),
      })
    }
  }
  return out
}

describe('the keyboard hint on a name box', () => {
  const all = boxes()

  it('finds boxes to check at all', () => {
    // A REGEX THAT MATCHES NOTHING PASSES SILENTLY, and that is how a source-
    // reading guard dies: someone reformats the forms, the pattern stops fitting,
    // and the test goes on reporting success over zero boxes.
    expect(all.length).toBeGreaterThan(60)
  })

  it('is on every box that holds a name', () => {
    const missing = all
      .filter((b) => NAME_FIELDS.includes(b.field) && !b.hinted)
      .map((b) => `${b.file}:${b.line} <${b.tag}> ${b.field}`)
    expect(missing).toEqual([])
  })

  it('is on no box that holds prose', () => {
    const wrong = all
      .filter((b) => PROSE_FIELDS.includes(b.field) && b.hinted)
      .map((b) => `${b.file}:${b.line} <${b.tag}> ${b.field}`)
    expect(wrong).toEqual([])
  })

  it('actually covers the fields the owner named', () => {
    // "chapter name, editor, song name" were the three called out, and a test
    // that passed because none of them appears anywhere would be a test of
    // nothing. So each named field must have at least one box, and every box it
    // has must carry the hint.
    //
    // `source-author` — the owner's "editor" — is NOT here, and that is a fact
    // about the tree rather than an exemption: the column shipped in 0070 and the
    // form that draws it is the add-surface rework, so there is no box to check
    // yet. It stays in NAME_FIELDS above, so the first box that appears without
    // the hint fails the case above. This list gains it when that form lands.
    for (const field of ['common.field.chapter-name', 'common.field.work-title']) {
      const found = all.filter((b) => b.field === field)
      expect(found.length, `no box found for ${field}`).toBeGreaterThan(0)
      expect(found.every((b) => b.hinted), `${field} is unhinted somewhere`).toBe(true)
    }
    // And the field with no box yet has no box yet — stated, so the day it gains
    // one this case is what tells somebody to move it up a line.
    expect(all.filter((b) => b.field === 'common.field.source-author')).toEqual([])
  })
})
