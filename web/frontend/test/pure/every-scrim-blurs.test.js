// EVERYTHING THAT COVERS THE PAGE SOFTENS WHAT IS BEHIND IT.
//
// THE OWNER'S WORDS: "also introduce focus blur, on desktop and mobile both."
//
// AND THE THREE TIMES THIS ANSWER HAS BEEN WRONG, which is why the list is
// derived and not typed:
//
//   1. The blur was declared on `.tp-panel-scrim` alone, so a panel softened the
//      page and every modal, picker, add sheet and search overlay left it sharp.
//   2. Moved to `.tp-scrim`, it was written standard-property-first and the build
//      dropped the standard half — declared everywhere, reaching nothing.
//      (`prefixed-pairs-survive.test.js` holds that half now.)
//   3. `.tp-scrim` still missed the two scrims that do not wear that class: the
//      drawer's and the account dialog's.
//
// Each fix landed on the site in hand while its twin stood beside it unchanged,
// which is the shape this round kept finding. So this asks the QUESTION rather
// than checking the answers: whatever covers the whole viewport must blur, and a
// fourth scrim joins the rule by existing.
//
// WHAT COUNTS AS A WASH OVER THE PAGE, and it took two cuts to say. `position:
// fixed` with `inset: 0` alone catches things that cover the viewport without
// being a scrim at all: the paper grain (opaque black at 5% opacity — blurring it
// would blur the whole app, permanently), an invisible click-catcher with no
// background, the full-screen image viewer, whose ground is opaque ON PURPOSE
// ("a true full-screen viewer — no page bleeding through"), the account route,
// and a mobile sheet's own surface. What they have in common is that nothing
// shows through them, so there is nothing behind to soften.
//
// So a wash is a cover that is TRANSLUCENT: an rgba or a color-mix with
// transparent. `.tp-scrim-deep` fails the cover test as well — it is a chip's
// ground on artwork, and blurring a poster behind a 20px chip is a cost with no
// reader.
//
// WHY THE STYLESHEET AND NOT THE SCREEN: jsdom paints nothing. The browser half —
// that the declaration survives the build and actually applies — is
// `panel-depth.mjs`, which reads the computed value with a panel open.
//
// WHAT A TEST WRITER NEEDS TO KNOW: the paragraphs above.

import { describe, expect, it } from 'vitest'

import { declaredIn, rules } from '../css-cascade.js'

const decl = (sel, prop) => {
  let out = null
  for (const r of declaredIn(sel)) if (r.decls[prop]) out = String(r.decls[prop].value).trim()
  return out
}

// Every selector that positions itself over the whole viewport, taken from the
// stylesheet rather than from a list somebody has to remember to extend.
// The exceptions, each with the ruling that granted it — the shape
// `no-truncated-names.test.js` uses, so an exception stays visible as one.
const EXCEPTED = {
  // The tour dims the page to point AT something on it. A blur would soften the
  // very thing the spotlight is drawing the reader to, which is the opposite of
  // what this one cover is for.
  'tour-scrim': 'a spotlight, not a curtain',
}

const translucent = (v) => /rgba\(|color-mix\([^)]*transparent/.test(String(v || ''))

const COVERS = [...new Set(
  rules
    .filter((r) => {
      const pos = r.decls.position && String(r.decls.position.value).trim()
      const inset = r.decls.inset && String(r.decls.inset.value).trim()
      const bg = r.decls.background && r.decls.background.value
      if (!translucent(bg)) return false
      // COVERS THE VIEWPORT IN ITS OWN RULE, *OR* IS NAMED ONE. `.tp-scrim` takes
      // `fixed inset-0` from utility classes in the JSX rather than from the
      // stylesheet, so a positioning test alone missed the app's main scrim
      // entirely — this file would have passed while checking three of four, and
      // the one it skipped is the one every modal wears. Found by printing the
      // derived list rather than by trusting the count.
      const covers = pos === 'fixed' && (inset === '0' || inset === '0px')
      return covers || r.selectors.some((sel) => /-scrim$/.test(sel.trim()))
    })
    .flatMap((r) => r.selectors)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    // One class, not a compound or a descendant — the thing that IS the cover.
    .filter((s) => /^\.[a-z0-9-]+$/.test(s))
    .filter((s) => !(s.slice(1) in EXCEPTED)),
)]

describe('anything that covers the page', () => {
  it('is found at all, and the main one is among them', () => {
    expect(COVERS.length, 'no rule in the stylesheet washes over the viewport any more').toBeGreaterThan(3)
    // NAMED, because this file once passed with it missing: `.tp-scrim` is the
    // ground every modal, picker, panel and search overlay stands on, and a
    // derivation that skips it is a guard about the exceptions.
    expect(COVERS, 'the app\'s main scrim is not in the derived list').toContain('.tp-scrim')
  })

  it.each(COVERS)('%s softens what is behind it', (sel) => {
    const std = decl(sel, 'backdrop-filter')
    const pre = decl(sel, '-webkit-backdrop-filter')
    expect(std || pre,
      `${sel} covers the whole page and blurs nothing behind it — the owner asked for the blur ` +
      '"on desktop and mobile both", and a cover that only darkens is the answer that was given three times')
      .toBeTruthy()
    expect(String(std || pre), `${sel} declares a backdrop-filter with no blur in it`).toMatch(/blur\(/)
    // Both halves, in the order the build keeps: the prefixed twin first.
    expect(std, `${sel} has only the -webkit- twin, which the build ships and Chrome ignores`).toBeTruthy()
    expect(pre, `${sel} has only the standard property, which Safari before 18 ignores`).toBeTruthy()
  })
})
