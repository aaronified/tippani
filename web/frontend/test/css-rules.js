// EVERY RULE IN A STYLESHEET, WITH ITS WHOLE SELECTOR LIST.
//
// THE HOLE THIS CLOSES, found by a rater mutating a guard rather than the app.
// Three sweeps over `index.css` split it with `/([^{}]+)\{([^{}]*)\}/g` and then
// took `m[1].split('\n').pop()` — the LAST line of the selector, because the
// capture also swallows the `@media (...) {` above it. That works when the
// selector is one line and when the one you are looking for happens to be last.
// It under-reads every other case:
//
//     .hand-card .heart,
//     .hand-card .status-mark,      <-- invisible
//     .film-frame .heart {
//
// A guard that misses a selector does not fail; it PASSES, which is the shape of
// broken guard nothing reports. The mark's touch-floor case was mutated into
// exactly that position and came back green.
//
// SO THE SPLIT TRACKS BRACES INSTEAD, and recurses into at-rules so a rule inside
// `@media`/`@layer`/`@container` is returned with its own selector rather than
// the wrapper's. Comments go first: a `{` inside prose would derail a counter,
// and this file's comments are long.
//
// It is not a CSS parser and does not want to be — no specificity, no cascade, no
// custom-property resolution. It answers one question: which declarations land on
// a selector that names this class, wherever in the file they were written.
export function cssRules(css) {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const out = []
  const walk = (text) => {
    let sel = ''
    let i = 0
    while (i < text.length) {
      const ch = text[i]
      if (ch === '{') {
        let depth = 1
        let j = i + 1
        while (j < text.length && depth > 0) {
          if (text[j] === '{') depth++
          else if (text[j] === '}') depth--
          j++
        }
        const inner = text.slice(i + 1, depth === 0 ? j - 1 : j)
        const name = sel.trim()
        // An at-rule wraps rules; its own "body" is those rules, so descend.
        // `@font-face` and friends hold declarations, not rules, and are of no
        // interest to any caller here — recursing finds nothing in them, which
        // is the right answer rather than a special case.
        if (name.startsWith('@')) walk(inner)
        else if (name) out.push({ sel: name, body: inner })
        i = j
        sel = ''
        continue
      }
      if (ch === '}') {
        sel = ''
        i++
        continue
      }
      sel += ch
      i++
    }
  }
  walk(clean)
  return out
}

// selectorsFor — every rule whose selector list NAMES this class, with the list
// split into its individual selectors. `.a.cls`, `.parent .cls` and `.cls:hover`
// all name it; `.clsish` does not.
export function rulesNaming(css, cls) {
  const word = new RegExp(`\\.${cls.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}(?![\\w-])`)
  return cssRules(css)
    .map((r) => ({ ...r, selectors: r.sel.split(',').map((x) => x.trim()).filter(Boolean) }))
    .filter((r) => r.selectors.some((x) => word.test(x)))
}
