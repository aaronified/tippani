import { describe, expect, it } from 'vitest'


// ---- one pill, one behaviour, wherever it is drawn --------------------------
//
// THE OWNER MADE THIS A REPO DIRECTIVE: "the home favourite chips directly opens
// the character. the work page chips gives the option. both should behave
// similarly. in fact this should be a repo directive. similar things should act
// similarly." Home opened the character outright — a line written before the
// chooser existed and never swept — so one pill did two different things
// depending on which board it was drawn on, and neither screen was wrong on its
// own terms.
//
// WHAT THE BEHAVIOUR IS, is asserted above: press a chip, get the question, with
// the global gated on the count. What is left to check is that the OTHER board
// goes through that and does not keep a second copy of the verb — and that is a
// fact about the wiring, which is read from the source. A DOM test could only
// prove it by supplying the handler itself, which is the test writing the answer
// down and then reading it back.
//
// The shape is deliberately "does not build its own panel", not "imports the
// right name": a second copy called `openCharacterDoor` would pass an import
// check and fail this one.

describe('the same pill on every board that draws it', () => {
  // EVERY BOARD, DERIVED — not two files named here. The first cut read a
  // 700-character window in `Home.jsx` and `WorkDetail.jsx`, which is a directive
  // written repo-wide and enforced on the two screens that already obeyed it.
  //
  // AND SCOPED TO THE PILL, which the second cut was not: widening it to every
  // `onOpenCharacter` flagged the cast EDITOR's row and the cast strip's tile,
  // and those are not the control the owner was talking about. A row in a work's
  // own cast list means "open this billing", has one destination by construction,
  // and pushes on purpose so Back returns to the list. A pill on a quote card
  // carries two people and up to three records, which is why it asks.
  //
  // So the rule is: A COMPONENT THAT DRAWS CHARACTER PILLS GETS THE SHARED DOOR.
  // Which components those are is read from the source — they are the ones that
  // render `SpeakerChips` — so a fourth card that starts drawing pills joins the
  // rule by drawing them, not by being added to a list here.
  const read = async () => {
    const { readSource, sourcesUnder } = await import('../src-files.js')
    return sourcesUnder((n) => /\.jsx?$/.test(n), 60).map((f) => [f, readSource(f)])
  }

  // From an index, the balanced run of braces starting at the first `{`.
  // A REGEX FOR A FUNCTION BODY IS A REGEX FOR THE WRONG THING: the first cut
  // stopped at the first `}` in column 0, which is a function's end only when
  // nothing inside it is written that way — and `FavouriteTile` is, so the one
  // card the owner reported was silently left out of its own guard.
  const balanced = (src, from) => {
    let i = src.indexOf('{', from)
    if (i === -1) return ''
    let depth = 0
    const at = i
    for (; i < src.length; i++) {
      if (src[i] === '{') depth++
      else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(at, i + 1) }
    }
    return src.slice(at)
  }

  // The components that draw a character pill: the ones whose own body renders
  // <SpeakerChips>. Derived, so a fourth card joins by drawing them.
  // PAST THE PARAMETERS FIRST. A destructured parameter list is itself a `{…}`,
  // so taking the first brace after `function Name(` balances the props object
  // and reads none of the body — which returned an empty set and made the cases
  // below pass on nothing.
  const afterParams = (src, from) => {
    let depth = 0
    for (let i = from; i < src.length; i++) {
      if (src[i] === '(') depth++
      else if (src[i] === ')') { depth--; if (depth < 0) return i + 1 }
    }
    return from
  }

  const pillDrawers = async () => {
    const names = new Set()
    for (const [, src] of await read()) {
      for (const m of src.matchAll(/(?:export\s+)?function ([A-Z][A-Za-z0-9]*)\s*\(/g)) {
        const body = balanced(src, afterParams(src, m.index + m[0].length))
        if (/<SpeakerChips/.test(body)) names.add(m[1])
      }
    }
    return names
  }

  // Every place one of those cards is handed its handler, with the whole
  // expression — and, where that expression is a NAME, what the name resolves to
  // in the same file. A handler threaded down from `WorkDetail`'s render prop
  // resolves to nothing here, and is covered by that screen's own case below.
  const pillHandlers = async () => {
    const drawers = await pillDrawers()
    const out = []
    for (const [file, src] of await read()) {
      for (const m of src.matchAll(/onOpenCharacter=\{/g)) {
        const before = src.slice(0, m.index)
        const open = [...before.matchAll(/<([A-Z][A-Za-z0-9]*)/g)]
        const owner = open.length ? open[open.length - 1][1] : ''
        if (!drawers.has(owner)) continue
        const body = balanced(src, m.index + 'onOpenCharacter='.length - 1)
        const bare = body.replace(/[{}\s]/g, '')
        const local = /^[a-zA-Z_$][\w$]*$/.test(bare)
          ? (src.match(new RegExp(`const ${bare}\\s*=`)) ? balanced(src, src.indexOf(`const ${bare} =`)) : null)
          : null
        out.push({ file, owner, body, decides: /=>/.test(body) || !!local, expr: local || body })
      }
    }
    return out
  }

  it('knows which components draw a pill, and finds handlers on them', async () => {
    const drawers = await pillDrawers()
    expect([...drawers].length, 'no component draws character pills — the derivation has drifted')
      .toBeGreaterThan(1)
    const all = await pillHandlers()
    expect(all.length, `no pill-drawing card is handed a character handler (drawers: ${[...drawers].join(', ')})`)
      .toBeGreaterThan(1)
  })

  it('and not one of those handlers opens a record itself', async () => {
    for (const h of await pillHandlers()) {
      // A handler that merely passes the prop along is not a behaviour; only one
      // that DECIDES is.
      if (!h.decides) continue
      expect(h.expr, `${h.file} opens a panel from <${h.owner}>'s pill itself — one control, two behaviours`)
        .not.toMatch(/characterPanel\s*\(|personPanel\s*\(/)
    }
  })

  it('and every one that decides goes through the door', async () => {
    const deciders = (await pillHandlers()).filter((h) => h.decides)
    expect(deciders.length, 'no board decides what the pill does, so nothing is being checked')
      .toBeGreaterThan(0)
    for (const h of deciders) {
      expect(h.expr, `${h.file} decides what <${h.owner}>'s pill does without going through openCharacterDoor`)
        .toMatch(/openCharacterDoor\s*\(/)
    }
  })

  it('and the door is defined in exactly one file', async () => {
    const defs = (await read())
      .filter(([, src]) => /function openCharacterDoor/.test(src))
      .map(([f]) => f)
    expect(defs, 'more than one file defines the door, which is the drift this directive is about')
      .toEqual(['identity.jsx'])
  })

  it('and the handler the work screen threads down to its boards goes through it too', async () => {
    // THE ONE THE DERIVATION ABOVE CANNOT SEE. `WorkDetail` hands `openCharacter`
    // to a render prop, and the board passes it to the card — so the card's own
    // handler is a bare name and the DECIDING expression is two files away. It is
    // named here because it is the last link in that chain, and because a
    // regression there would reach both a book's board and a film's at once.
    const [, src] = (await read()).find(([f]) => f === 'WorkDetail.jsx')
    const decl = src.indexOf('const openCharacter =')
    expect(decl, 'the work screen no longer names a character handler').toBeGreaterThan(-1)
    const expr = src.slice(decl, src.indexOf('\n\n', decl))
    expect(expr, 'the work screen opens a record from the pill itself')
      .not.toMatch(/characterPanel\s*\(|personPanel\s*\(/)
    expect(expr, 'the work screen decides what the pill does without going through the door')
      .toMatch(/openCharacterDoor\s*\(/)
  })

  it('and the work page kept no chooser of its own', async () => {
    const [, src] = (await read()).find(([f]) => f === 'WorkDetail.jsx')
    expect(src, 'the work page still holds its own copy of the question').not.toMatch(/setSpeakerChoice/)
  })
})
