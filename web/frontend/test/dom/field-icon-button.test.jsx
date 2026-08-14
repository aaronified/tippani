// The 34px icon button, which was a class string until it was this.
//
// `field-icon-btn tactile` was hand-written at 46 call sites across 13 files, with
// three colour variants and two latches spelled out at each one. The audit that
// found it went looking for drift and found almost none: all 46 carried an
// aria-label, all 46 were wrapped in a Tooltip, and exactly one had lost `tactile`
// — so one button in the app did not press when you pushed it.
//
// The reason it had to become a component is not the drift, it is that a class
// string cannot make a decision. `IconButton` gained an opt-in `label` so the 44px
// family could honour the Button labels preference; the 34px family could not opt
// into anything, because there was nowhere to put the opting. Forty-six buttons sat
// outside a preference claiming to govern the app, not by a decision but by never
// having been asked.
//
// THE ANSWER IS THAT THIS SIZE IS NAMELESS, and the assertion below is the point of
// this file. 34px exists because it sits in a row that has already spent its width
// — an input with a ✓ and a ✕ after it, a card's action row that wraps at six
// colour dots. A word beside the glyph is the one thing there is no room for. The
// no-label test is not a description of today's markup; it is the rule, pinned, so
// that adding `label` here later is a decision somebody has to argue with rather
// than a patch that slips through.

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FieldIconButton, IconEdit } from '../../src/ui.jsx'

const SRC = process.env.TIPPANI_SRC

const btn = (ui) => {
  const { container } = render(ui)
  return container.querySelector('button')
}

describe('the shape it always has', () => {
  const b = () => btn(<FieldIconButton icon={<IconEdit />} ariaLabel="Edit fields" />)

  it('is the dense control', () => {
    expect(b().className).toContain('field-icon-btn')
  })

  // The one thing that had actually drifted. It is guaranteed rather than
  // remembered now, which is the whole difference between a component and a
  // string somebody copies.
  it('presses, always', () => {
    expect(b().className).toContain('tactile')
  })

  it('is a button and not a submit', () => {
    expect(b().getAttribute('type')).toBe('button')
  })

  it('carries its name in the accessibility tree', () => {
    render(<FieldIconButton icon={<IconEdit />} ariaLabel="Edit fields" />)
    expect(screen.getByRole('button', { name: 'Edit fields' })).toBeTruthy()
  })
})

describe('it is nameless on purpose', () => {
  // The rule, not the markup. See the note at the top of this file.
  it('renders no label span, so there is nothing for the preference to reveal', () => {
    const b = btn(<FieldIconButton icon={<IconEdit />} ariaLabel="Edit fields" />)
    expect(b.querySelector('.btn-label')).toBeNull()
    expect(b.className).not.toContain('has-btn-icon')
  })

  it('takes no label prop, so a word cannot arrive by accident', () => {
    // Passed anyway, the way a hopeful call site would. It lands in ...rest as a
    // DOM attribute and renders nothing — what must NOT happen is words appearing
    // in a 34px box and silently breaking the row it sits in.
    const b = btn(<FieldIconButton icon={<IconEdit />} ariaLabel="Edit fields" label="Edit" />)
    expect(b.textContent).toBe('')
    expect(b.querySelector('.btn-label')).toBeNull()
  })
})

describe('the variants compose', () => {
  it('tints ok and danger', () => {
    expect(btn(<FieldIconButton ariaLabel="Save" ok />).className).toContain('field-icon-btn-ok')
    expect(btn(<FieldIconButton ariaLabel="Delete" danger />).className).toContain('field-icon-btn-danger')
  })

  // -boxed keeps a resting outline, for the cover cluster that has no field row
  // around it to be the affordance.
  it('boxes the free-standing cluster', () => {
    expect(btn(<FieldIconButton ariaLabel="Fetch" boxed />).className).toContain('field-icon-btn-boxed')
  })

  // A latch has to survive the pointer leaving, which is why it is a class and
  // not a hover state.
  it('latches active and busy', () => {
    expect(btn(<FieldIconButton ariaLabel="Paste a URL" active />).className).toContain('is-active')
    expect(btn(<FieldIconButton ariaLabel="Fetching" busy />).className).toContain('is-busy')
  })

  it('carries none of them unasked', () => {
    const c = btn(<FieldIconButton ariaLabel="Edit" />).className
    for (const not of ['-ok', '-danger', '-boxed', 'is-active', 'is-busy']) {
      expect(c).not.toContain(not)
    }
  })

  it('still takes a caller class, for the odd shrink-0', () => {
    expect(btn(<FieldIconButton ariaLabel="Edit" className="shrink-0" />).className).toContain('shrink-0')
  })
})

// ---- and nobody writes the class by hand any more -------------------------
//
// The migration moved 46 sites. Without this, the 47th is a copy-paste away and
// the primitive becomes one of two ways to draw the same button — which is worse
// than the class string was, because now there are two.
//
// It counts rather than forbids, because the primitive itself has to emit the
// class. One <button> in the SPA may carry it, and it is that one.
describe('the class belongs to the primitive', () => {
  // Read the <button ...> tags out of a file, brace-aware so a JSX expression
  // containing '>' does not end a tag early.
  const buttonTags = (src) => {
    const out = []
    const re = /<button(?=[\s/>])/g
    let m
    while ((m = re.exec(src))) {
      let i = m.index + m[0].length
      let depth = 0
      for (; i < src.length; i++) {
        const c = src[i]
        if (c === '{') depth++
        else if (c === '}') depth--
        else if (c === '>' && depth === 0) break
      }
      out.push(src.slice(m.index, i + 1))
    }
    return out
  }

  const sources = readdirSync(SRC)
    .filter((f) => (f.endsWith('.jsx') || f.endsWith('.js')) && !f.includes('.test.'))
    .map((f) => [f, readFileSync(join(SRC, f), 'utf8')])

  it('is emitted by exactly one button, in ui.jsx', () => {
    const wearers = sources.flatMap(([file, src]) =>
      buttonTags(src).filter((t) => t.includes('field-icon-btn')).map(() => file),
    )
    expect(wearers).toEqual(['ui.jsx'])
  })

  // The one non-button that wears it, named so the count above cannot be met by
  // quietly turning a button into something else. A file picker HAS to be a
  // <label> wrapping an <input type="file"> — a button cannot open the dialog —
  // so it borrows the look on purpose and is not a candidate for the primitive.
  it('is worn by one <label>, the file picker, and nothing else', () => {
    const others = sources.flatMap(([file, src]) =>
      [...src.matchAll(/<(\w+)[^>]*?field-icon-btn/g)]
        .map((m) => `${file}:${m[1]}`)
        .filter((x) => !x.endsWith(':button')),
    )
    expect(others).toEqual(['CoverPicker.jsx:label'])
  })
})

describe('what the call sites need to pass through', () => {
  it('disables', () => {
    expect(btn(<FieldIconButton ariaLabel="Save" disabled />).disabled).toBe(true)
  })

  it('lets the tooltip differ from the accessible name', () => {
    // ariaLabel doubles as the tooltip, because they should say the same thing.
    // A caller that needs them to differ says so, and one that needs no bubble
    // passes null — the two escape hatches IconButton has.
    render(<FieldIconButton icon={<IconEdit />} ariaLabel="Edit fields" tooltip="Change the metadata" />)
    expect(screen.getByRole('button', { name: 'Edit fields' })).toBeTruthy()
  })
})
