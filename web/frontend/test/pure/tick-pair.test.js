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
// COMMENTS ARE NOT CODE, and a scanner that forgets it finds tags nobody wrote.
// `ui.jsx` explains its own `open` prop with the words "`{cond && <FormModal …>}`"
// in a paragraph of prose, and that sentence was being counted as a call site —
// the last one left after the rule below was corrected, so the whole guard would
// have come to rest on a comment.
const read = (f) => readFileSync(join(SRC, f), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')

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
  // WHAT THIS NUMBER IS, stated correctly at last. The prose here used to read:
  // "A FormModal with no `dirty` still draws a ✓ — `blocked === null` is the only
  // thing that hides it." The second half refutes the first, and checking it
  // settled the matter: `blocked` starts at null and only a CHILD calling
  // `useFormHost` sets it, so a FormModal whose children never register draws NO
  // TICK AT ALL. Twenty-five of the twenty-six counted here are exactly that.
  //
  // So the count is not "ticks that cannot arm". It is DIALOGS THAT ARE NOT ON
  // THE STANDING PAIR — each one either commits through a button in its own body
  // or draws a tick with nothing behind it, and both are the same debt seen from
  // two sides. The owner deferred the sweep; the number may only fall, which is
  // what keeps the deferral from becoming a direction of travel.
  //
  // AND ONE DIALOG IS EXEMPT, BY NAME AND WITH ITS REASON. A blanket rule that
  // cannot be argued with is a rule people work around; an exemption somebody has
  // to read is one they can refuse. `ChoosePicker` is a list of things a press
  // could mean, where every ROW is its own commit — there is no draft to count, no
  // ✓ to arm, and inventing a `dirty` for it would be answering a test rather
  // than a reader. Verified rather than assumed: it registers no form, so the
  // dialog draws no tick.
  const NO_FORM = [
    ['identityPicker.jsx', 'ChoosePicker'],
  ]
  const exempt = (f, src, at) => NO_FORM.some(([file, comp]) => {
    if (file !== f) return false
    const i = src.indexOf(`function ${comp}(`)
    if (i === -1) return false
    const after = src.indexOf('\nexport function ', i + 1)
    const plain = src.indexOf('\nfunction ', i + 1)
    const end2 = Math.min(after === -1 ? src.length : after, plain === -1 ? src.length : plain)
    return at > i && at < end2
  })
  const missing = []
  for (const f of FILES) {
    const src = read(f)
    for (const t of openTags(src, 'FormModal')) {
      if (/\bdirty\s*=/.test(t.attrs)) continue
      const at = src.split('\n').slice(0, t.line).join('\n').length
      if (exempt(f, src, at)) continue
      missing.push(`${f}:${t.line}`)
    }
  }

  it('and the number that do not may only fall', () => {
    // 25 AND NOT 26. Two of the twenty-six left in the same pass and one arrived:
    // `ui.jsx`'s was a `<FormModal …>` written inside a PARAGRAPH OF PROSE — the
    // scanner did not skip comments, so the guard's last case was a sentence —
    // and `ChoosePicker` is exempt above with its reason. A ceiling is only worth
    // the count under it being real.
    expect(missing.length, `no dirty count: ${missing.join(", ")}`).toBeLessThanOrEqual(25)
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
