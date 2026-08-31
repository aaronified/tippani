// The glossary can only describe things that exist, and cannot miss things that do.
//
// WHAT WENT WRONG WITHOUT THIS. docs/ui-glossary.html was 150 entries of hand-written
// markup, and nothing compared it with the app. So it went on offering a "Paper / Film
// aesthetic" toggle a whole release after v3 deleted aesthetics — driving a
// `data-aesthetic` attribute that appears zero times in index.css — and its topbar
// sample showed an Import tab that routes.js had already dropped. Four CSS classes it
// rendered had been deleted from the app. None of that was carelessness; a document
// nothing executes has no way to fail.
//
// The page is generated now (web/frontend/scripts/glossary-build.mjs), which fixes the
// half where the page invents markup. This file is the other half: it checks that what
// the catalogue CLAIMS still matches the code, in both directions.
//
// WHY THE BUILT STYLESHEET IS THE AUTHORITY on whether a class exists. index.css is the
// source, but the app is Tailwind v4 — `flex`, `gap-2` and `px-3` are real classes that
// never appear there, because Tailwind generates them into web/dist at build time. A
// check against the source would therefore reject every utility the app legitimately
// uses. The built file holds both, and it is committed, so it is always available.
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { SECTIONS } from '../../scripts/glossary/catalogue.js'

const SRC = process.env.TIPPANI_SRC || join(process.cwd(), 'src')
const ROOT = join(SRC, '..', '..', '..')
const ASSETS = join(ROOT, 'web', 'dist', 'assets')
const builtName = readdirSync(ASSETS).filter((f) => /^index-.*\.css$/.test(f))
const builtCss = readFileSync(join(ASSETS, builtName[0]), 'utf8')
const uiSrc = readFileSync(join(SRC, 'ui.jsx'), 'utf8')

const entries = SECTIONS.flatMap((s) => s.entries)

// The page's own furniture, which is defined in the template's <style> block rather
// than in the app — a sample sometimes has to be told to sit at poster proportions.
const PAGE_LOCAL = /^(g-|is-|has-)|^(center|wide|poster)$/

const classExists = (c) => new RegExp(`\\.${c.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}[^a-zA-Z0-9_-]`).test(builtCss)

describe('every class the glossary renders', () => {
  it('still exists in the stylesheet the app ships', () => {
    const missing = new Set()
    for (const e of entries) {
      for (const m of String(e.html || '').matchAll(/class="([^"]+)"/g)) {
        for (const c of m[1].split(/\s+/).filter(Boolean)) {
          if (PAGE_LOCAL.test(c) || classExists(c)) continue
          missing.add(`${c}  (in entry "${e.name}")`)
        }
      }
    }
    expect([...missing].sort(), 'the glossary renders classes the app no longer defines').toEqual([])
  })
})

describe('every source line an entry claims', () => {
  // `src` is the line under an entry's name — "GhostButton — ui.jsx · .tp-btn". It is
  // the only machine-readable link between the documentation and the code, and the
  // generator uses its leading identifier to decide whether to render the component
  // live. A src naming something that does not exist breaks that link silently.
  it('names only CSS classes the app still defines', () => {
    const missing = new Set()
    for (const e of entries) {
      // A dot only starts a class name at a boundary: `dialogues.season` is a database
      // column and `.dot-*` is a wildcard standing for six real classes, and neither is
      // a claim this test can check. Matching them anyway is how a checker earns its
      // reputation for crying wolf and then gets deleted.
      for (const m of String(e.src || '').matchAll(/(?:^|[\s·(])\.([a-z][a-zA-Z0-9_-]*)/g)) {
        const c = m[1]
        if (c.endsWith('-')) continue
        if (!classExists(c)) missing.add(`.${c}  (in entry "${e.name}")`)
      }
    }
    expect([...missing].sort(), 'an entry cites a CSS class that no longer exists').toEqual([])
  })

  it('names only identifiers the source still defines', () => {
    // DEFINED, not EXPORTED, and the difference is not pedantry: ColorMenu, HintBubble
    // and InfoPopover are real components that live inside ui.jsx without being
    // exported, and an entry that names one is telling the truth. Demanding an export
    // reported four working components as missing — the same false alarm the icon
    // import test warns about, where a checker that cries wolf gets deleted.
    const allSrc = readdirSync(SRC).filter((f) => /\.jsx?$/.test(f))
      .map((f) => readFileSync(join(SRC, f), 'utf8')).join('\n')
    const exported = new Set([...allSrc.matchAll(/(?:^|\s)(?:export\s+)?(?:function|const|class|let)\s+([A-Za-z_][A-Za-z0-9_]*)/gm)].map((m) => m[1]))
    const missing = new Set()
    for (const e of entries) {
      const src = String(e.src || '')
      // Only claims of the form "Name — ui.jsx" are checked, and only against whether
      // the name is defined SOMEWHERE in src/ — a src line often cites two files at
      // once ("HelpButton / PageHelp — ui.jsx + help.jsx") and attributing every name
      // in it to the first file named would be inventing a claim the entry never made.
      // The identifier has to be captured WHOLE. Anchored on a capital, this read
      // `useCardMenu` as `CardMenu` and `skipReason` as `Reason`, and reported four
      // real exports as missing — a hook and a helper are not absent components.
      for (const m of src.matchAll(/(?:^|[^A-Za-z0-9_])([A-Za-z_][A-Za-z0-9_]*)\s*(?:—|&mdash;)\s*ui\.jsx/g)) {
        if (!exported.has(m[1])) missing.add(`${m[1]}  (in entry "${e.name}")`)
      }
    }
    expect([...missing].sort(), 'an entry cites a ui.jsx export that no longer exists').toEqual([])
  })
})

// ---- the two ratchets ------------------------------------------------------
//
// Neither of these can be zero today, and pretending otherwise would mean either a red
// suite or 69 entries written in a hurry. So each records the number that is true now
// and refuses to let it grow. A ratchet is worth more than an aspiration: it makes the
// debt visible, stops it increasing, and turns paying it down into a one-line diff.

describe('component coverage', () => {
  // Hooks, constants and helpers are not UI elements and have no business in a glossary
  // of the interface — only PascalCase components are counted. Icon* glyphs are counted
  // separately because they are one undocumented FAMILY, not 49 unrelated omissions:
  // the page has a "Marks" section with two entries and no catalogue of the icon set.
  const components = [...uiSrc.matchAll(/^export (?:function|const|class) ([A-Z][A-Za-z0-9_]*)/gm)]
    .map((m) => m[1])
    // ANNOTATION_COLORS and BOARD_COLUMNS start with a capital and are not components.
    .filter((n) => !/^[A-Z0-9_]+$/.test(n))
  const mentioned = (n) => {
    const re = new RegExp(`\\b${n}\\b`)
    return entries.some((e) => re.test(`${e.src || ''} ${e.name || ''} ${e.desc || ''}`))
  }
  const undocumented = components.filter((n) => !mentioned(n))
  const icons = undocumented.filter((n) => /^Icon/.test(n))
  const rest = undocumented.filter((n) => !/^Icon/.test(n))

  it('does not get worse for ordinary components', () => {
    expect(rest.length, `undocumented: ${rest.join(', ')}`).toBeLessThanOrEqual(20)
  })

  it('does not get worse for icon glyphs', () => {
    expect(icons.length).toBeLessThanOrEqual(37)
  })

  it('and a new component cannot arrive undocumented without moving one of those numbers', () => {
    // The guard on the guard: if someone raises a ceiling above, this states the total
    // the two are allowed to add up to, so raising one means lowering the other.
    expect(rest.length + icons.length).toBeLessThanOrEqual(57)
  })
})

describe('the migration off carried markup', () => {
  // An entry whose `src` leads with a ui.jsx export is a candidate to render its real
  // component instead of a copy of that component's markup — which is how the page came
  // to show buttons missing the `tactile` class that makes them press. Adding a
  // `glossary` declaration beside the component is the whole conversion.
  const carried = entries.filter((e) => e.html != null)
  it('only ever shrinks', () => {
    expect(carried.length).toBeLessThanOrEqual(141)
  })
})
