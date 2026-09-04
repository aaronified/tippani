// THE STANDING TICK/CROSS RULE, COUNTED.
//
// CLAUDE.md states it, and it is the design pack's: "A tick confirms, a cross
// discards, and the tick lights only when something actually changed. Every
// editable field and every form wears the pair. The tick takes the accent fill
// *and* a small count badge — how many fields this press will change — the moment
// the substance differs from what is stored."
//
// WHY THIS IS TWO RATCHETS AND NOT TWO ASSERTIONS OF ZERO. Neither number can be
// zero today. `FormModal`'s own header says why: "`dirty` and `closeDanger` ARE
// THE STANDING TICK/CROSS RULE, arriving one caller at a time… Flipping the
// defaults is the sweep the owner has deferred." A test asserting zero would
// either be red for a release or force a twenty-eight-file sweep nobody has
// asked for. So each records what is true now and refuses to let it grow — the
// same shape as `spacing-debt.test.js` and `typescale-baseline.json`, and worth
// more than an aspiration: it makes the debt visible, stops it increasing, and
// turns paying it down into a one-line diff.
//
// WHY IT IS WRITTEN OVER THE SOURCE AND NOT OVER A RENDER. What both numbers
// measure is an ABSENCE — a prop not passed, a verb drawn in the wrong place —
// and an absence renders perfectly. Nothing throws, nothing looks broken in a
// screenshot, and a jsdom test asserting "the ✓ exists" passes on a ✓ that can
// never arm. The two observables that DO exist are in the source: whether the
// caller handed the surface a count, and whether the surface's commit verb is in
// its body instead of its head. `make controls` covers the runtime half by
// pressing everything and asking what changed.
//
// WHAT A TEST WRITER NEEDS TO KNOW TO HAVE WRITTEN THIS: the rule above, and that
// `FormModal` takes `dirty`. Nothing about any particular screen, which is the
// point — the first run of it named a block of seven plain inputs behind one
// "Save" button on a panel whose head drew no ✓ at all, on three sheets.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const SRC = process.env.TIPPANI_SRC || join(process.cwd(), 'src')
const FILES = readdirSync(SRC).filter((f) => /\.jsx$/.test(f))
const read = (f) => readFileSync(join(SRC, f), 'utf8')

// The opening tag of every <Name ...>, from the name to the '>' that closes the
// tag rather than the first '>' in an expression — `dirty={a > b}` and a nested
// arrow both contain one. Brace depth is what tells them apart, and quotes are
// skipped so a '>' inside a string cannot end a tag either.
function openTags(src, name) {
  const out = []
  const re = new RegExp(`<${name}(?=[\\s/>])`, 'g')
  let m
  while ((m = re.exec(src))) {
    let i = m.index + m[0].length
    let brace = 0
    let quote = null
    for (; i < src.length; i++) {
      const c = src[i]
      if (quote) {
        if (c === quote && src[i - 1] !== '\\') quote = null
        continue
      }
      if (c === '"' || c === "'" || c === '`') { quote = c; continue }
      if (c === '{') brace++
      else if (c === '}') brace--
      else if (c === '>' && brace === 0) break
    }
    out.push({ attrs: src.slice(m.index + m[0].length, i), line: src.slice(0, m.index).split('\n').length })
  }
  return out
}

describe('a dialog tells its tick what is at stake', () => {
  // A `FormModal` with no `dirty` still draws a ✓ — `blocked === null` is the only
  // thing that hides it — so the tick is there, plain, and identical whether the
  // reader has changed everything or nothing. That is precisely the state the rule
  // names as teaching the reader to stop reading it.
  const missing = []
  for (const f of FILES) {
    for (const t of openTags(read(f), 'FormModal')) {
      if (!/\bdirty\s*=/.test(t.attrs)) missing.push(`${f}:${t.line}`)
    }
  }

  it('and the number that do not may only fall', () => {
    expect(missing.length, `no dirty count: ${missing.join(', ')}`).toBeLessThanOrEqual(26)
  })

  it('is a debt and not the whole app — some callers do pass one', () => {
    // The guard on the guard. If the ceiling above is ever raised to the total,
    // this fails: it says at least some callers comply, so "26" cannot quietly
    // become "all of them" by someone editing one number.
    let total = 0
    for (const f of FILES) total += openTags(read(f), 'FormModal').length
    expect(total).toBeGreaterThan(missing.length)
  })
})

describe('a commit verb belongs to the surface, not to its body', () => {
  // `FormModal` and `PanelHost` draw the pair in the head, and a form joins it
  // with `useFormHost`. A button in the BODY reading the app's own Save or Create
  // word is a second mechanism for the same act: it cannot go red, it carries no
  // count, and where the surface is a panel its head is left with an empty slot.
  // `InlineField`'s own header names this arrangement as the thing it was written
  // to replace — "every field that used to sit in a modal behind an 'Edit' button
  // and save with a 'Save' one".
  //
  // Matched as the label being a button's CHILD TEXT: `submitLabel={t(…)}` is a
  // form handing its own host a word and is not this, and neither is the label on
  // the pair's own disc, which arrives as `ariaLabel` or `tooltip`.
  const hand = []
  for (const f of FILES) {
    const src = read(f)
    const re = />\s*\{t\(\s*(?:[A-Za-z][A-Za-z0-9_.]*\s*\?\s*'[^']*'\s*:\s*)?'common\.action\.(?:save|create)\.label'/g
    let m
    while ((m = re.exec(src))) hand.push(`${f}:${src.slice(0, m.index).split('\n').length}`)
  }

  it('and the number that draw their own may only fall', () => {
    expect(hand.length, `hand-rolled commit verbs: ${hand.join(', ')}`).toBeLessThanOrEqual(5)
  })
})
