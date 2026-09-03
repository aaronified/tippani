// The row vocabulary the character and person screens are assembled from, and
// the two places it departs from the design pack on the owner's ruling.
//
// WHY THE VOCABULARY IS TESTED SEPARATELY FROM THE SCREENS. The pack's five
// sheets are five SCOPES of one object — the identity, the same character local
// to a book, a film and a game, and the person behind a credit — and what makes
// that true is that the rows are built once. A defect in a row kind is a defect
// on five screens, and a test that reached it only through one of them would
// pass while the other four were wrong.
//
// THE TWO DEPARTURES ARE THE FIRST ASSERTIONS HERE, because the owner's
// instruction was that the screens resemble the pack exactly and that every
// departure be reasoned and approved. Both are approved and recorded in
// docs/PLAN.md; both are the kind of thing that silently reverts.
import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import {
  AppearanceStrip, CreditRow, FactsRow, NamesRow, PairRow, PillRow,
  PortraitBlock, ScreenHead, ScreenRow, SectionHead, SegHead,
} from '../../src/characterRows.jsx'

describe('the departures the owner approved', () => {
  // THE PACK ELLIPSISES; THE STANDING RULE FORBIDS IT. A shortened name and a
  // short name look alike, so the ellipsis destroys the thing the row exists to
  // show. NameScroll holds the row height exactly as nowrap does, which is what
  // keeps the pack's own reason for nowrap intact — a credit row must not reflow
  // and shove its neighbours.
  it('scrolls a long name rather than clipping it, on every row that holds one', () => {
    const long = 'Bartholomew Featherstonehaugh Wodehouse-Ferrars'
    const { container } = render(
      <>
        <ScreenHead title={long} crumb="in a work" glyph={null} />
        <ScreenRow label={long} onClick={() => {}} />
        <CreditRow name={long} onPick={() => {}} onOpen={() => {}} onNote={() => {}} onRemove={() => {}} />
      </>,
    )
    const scrollers = container.querySelectorAll('.name-scroll')
    // The header title, the row label and the credit name: three names, three
    // scrollers, no ellipsis class among them.
    expect(scrollers.length).toBe(3)
    for (const s of scrollers) {
      expect(s.textContent).toBe(long)
    }
  })

  // THE FADE IS MEASURED, NOT COUNTED. The pack fades at four tiles or more;
  // Scroller writes data-scroll-x from real overflow, so a row that fits wears
  // none and a row of three wide tiles on a phone wears one.
  it('hands the strip to the repo Scroller rather than counting tiles', () => {
    const tile = (i) => ({
      key: String(i), title: 'A Work', kind: 'book', badge: null,
      onOpen: () => {}, faceName: 'Harry',
    })
    const { container } = render(<AppearanceStrip tiles={[1, 2, 3, 4, 5].map(tile)} />)
    const box = container.querySelector('.cs-tiles')
    expect(box).toBeTruthy()
    // jsdom has no layout, so the attribute is absent here — which is the point:
    // it is written from a measurement rather than from tiles.length, and five
    // tiles alone do not produce it.
    expect(box.getAttribute('data-scroll-x')).toBeNull()
  })
})

describe('the header', () => {
  it('lays the medium glyph on the work own cover, on a local scope', () => {
    const { container } = render(
      <ScreenHead title="Harry" crumb="in Deathly Hallows" glyph={<i data-t="book" />} art="cover.jpg" artKind="book" />,
    )
    const art = container.querySelector('.cs-scope-art')
    expect(art).toBeTruthy()
    // A BOOK TAKES THE HAND-DRAWN CORNER, which is how the shape carries the
    // medium alongside the badge.
    expect(art.classList.contains('is-book')).toBe(true)
    expect(art.querySelector('img')).toBeTruthy()
    expect(art.querySelector('.cs-scope-overlay')).toBeTruthy()
  })

  it('keeps a bare globe on a global scope, because a globe has no cover to sit on', () => {
    const { container } = render(<ScreenHead title="Harry" glyph={<i />} />)
    expect(container.querySelector('.cs-scope-globe')).toBeTruthy()
    expect(container.querySelector('.cs-scope-art')).toBeNull()
  })

  // NO QUALIFIER CHIP — the owner's ruling. The pack prints its own screen ids
  // there because its four sheets sit side by side; in the app you see one.
  it('prints no qualifier chip', () => {
    const { container } = render(<ScreenHead title="Harry" crumb="in a film" glyph={<i />} />)
    expect(container.textContent).not.toMatch(/char-(global|book|film|game)|people-global/)
  })
})

describe('the portrait block', () => {
  it('states the pixels, and inks the statement under the floor', () => {
    const { container, unmount } = render(<PortraitBlock name="Harry" px="820 × 820 px" />)
    expect(container.querySelector('.cs-px').classList.contains('is-soft')).toBe(false)
    unmount()
    render(<PortraitBlock name="Harry" px="266 × 350 px · soft" soft />)
    expect(document.querySelector('.cs-px').classList.contains('is-soft')).toBe(true)
  })

  it('draws the silhouette where no picture has been supplied, never the cover hatch', () => {
    const { container } = render(<PortraitBlock name="Harry" px="no picture" />)
    // A hatch means a picture nobody supplied for a WORK; a silhouette means a
    // person nobody has named, which is what this box holds.
    expect(container.querySelector('.cs-face img')).toBeNull()
    expect(container.querySelector('.cs-face')).toBeTruthy()
  })
})

describe('the rows', () => {
  it('makes the heading itself the control where there are two answers', () => {
    const onPick = vi.fn()
    render(
      <SegHead
        label="THE CAST"
        options={[['actor', 'Played by'], ['voice', 'Voiced by']]}
        value="actor"
        onPick={onPick}
      />,
    )
    const played = screen.getByRole('button', { name: 'Played by' })
    const voiced = screen.getByRole('button', { name: 'Voiced by' })
    expect(played.getAttribute('aria-pressed')).toBe('true')
    expect(voiced.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(voiced)
    expect(onPick).toHaveBeenCalledWith('voice')
  })

  it('puts a row trailing keys outside its own button', () => {
    // A button inside a button is not a thing, and a reader who meant the pencil
    // must not open the row.
    const { container } = render(
      <ScreenRow label="Note" onClick={() => {}} trailing={<button type="button">pencil</button>} />,
    )
    const row = container.querySelector('.cs-row')
    expect(row.querySelector('button')).toBeNull()
    expect(container.querySelectorAll('button').length).toBe(2)
  })

  it('draws three facts on one line, each with its own label', () => {
    const { container } = render(
      <FactsRow cells={[
        { label: 'PART', value: 'Protagonist', onClick: () => {} },
        { label: 'FIRST APPEARS', value: 'CH 1 · PAGE 9', onClick: () => {} },
        { label: 'AGE HERE', value: '17', onClick: () => {} },
      ]} />,
    )
    expect(container.querySelectorAll('.cs-fact').length).toBe(3)
    // NO CLAMP ON A VALUE: it scrolls, so "Protagonist" never renders as
    // "Protagoni…" in an export while the live box measures fine.
    expect(container.querySelector('.cs-fact-value').classList.contains('name-scroll')).toBe(true)
  })

  it('draws two counts as a sentence rather than a stacked tile', () => {
    const { container } = render(
      <PairRow cells={[
        { label: 'QUOTES', figure: '37', onClick: () => {} },
        { label: 'CHAPTERS', figure: '19', onClick: () => {} },
      ]} />,
    )
    expect(container.querySelectorAll('.cs-count').length).toBe(2)
    expect(container.textContent).toContain('37')
    expect(container.textContent).toContain('19')
  })

  it('wears each site own mark on a link pill, and marks the add control apart', () => {
    const { container } = render(
      <PillRow
        pills={[
          { url: 'https://en.wikipedia.org/wiki/Harry_Potter', slug: 'wikipedia', name: 'Wikipedia' },
          { url: 'https://hp-lexicon.org', slug: '', name: 'A web page', fallbackIcon: <i data-globe /> },
        ]}
        addLabel="Add a link"
        onAdd={() => {}}
      />,
    )
    // ROUND MEANS A VALUE HERE, so the add control takes the square corner and a
    // dashed border and cannot be mistaken for a fifth link.
    expect(container.querySelectorAll('a.cs-pill').length).toBe(2)
    expect(container.querySelector('.cs-pill.is-add')).toBeTruthy()
    expect(container.querySelector('a.cs-pill .src-mark')).toBeTruthy()
    // A site with no mark takes the globe rather than a hand-drawn lookalike.
    expect(container.querySelectorAll('a.cs-pill')[1].querySelector('.src-mark')).toBeNull()
  })
})

describe('a performer credit', () => {
  const spies = () => ({
    onPick: vi.fn(), onOpen: vi.fn(), onNote: vi.fn(), onRemove: vi.fn(),
  })

  // THREE TARGETS IN ONE ROW, and the split is where the jobs split: the
  // portrait picks who it is, the name opens that person, the pencil notes the
  // credit, the ✕ takes it off.
  it('splits the portrait from the name, so one press cannot do the other job', () => {
    const s = spies()
    const { container } = render(
      <CreditRow name="Daniel Radcliffe" pickTitle="Change this credit" openTitle="Open the record"
        noteTitle="Note on this credit" removeTitle="Remove this credit" {...s} />,
    )
    fireEvent.click(container.querySelector('.cs-credit-pick'))
    expect(s.onPick).toHaveBeenCalled()
    expect(s.onOpen).not.toHaveBeenCalled()
    fireEvent.click(container.querySelector('.cs-credit-name'))
    expect(s.onOpen).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Note on this credit' }))
    expect(s.onNote).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Remove this credit' }))
    expect(s.onRemove).toHaveBeenCalled()
  })

  // A CREDIT WITH NOBODY NAMED IS A LEGITIMATE STATE — a mute animated short
  // performs nobody, and forcing a name into it would be inventing a person. So
  // it draws in faint rather than being hidden.
  it('draws an unnamed credit rather than hiding it', () => {
    const { container } = render(
      <CreditRow name="Not named yet" empty {...spies()} />,
    )
    const text = container.querySelector('.cs-credit-text')
    expect(text.textContent).toBe('Not named yet')
    expect(text.classList.contains('is-empty')).toBe(true)
  })

  it('shows the language in front of the note, so two dub rows tell apart', () => {
    const { container } = render(<CreditRow name="Rajesh Kava" note="Hindi · dub" {...spies()} />)
    expect(container.querySelector('.cs-credit-note').textContent).toBe('Hindi · dub')
  })
})

describe('the appearance strip', () => {
  const tile = (over = {}) => ({
    key: 'a', title: 'Deathly Hallows', meta: '2007 · Harry', count: '37 quotes',
    kind: 'book', badge: <i data-badge />, faceName: 'Harry', onOpen: () => {}, ...over,
  })

  it('carries the count that is the reason the work is in the list', () => {
    const { container } = render(<AppearanceStrip tiles={[tile()]} />)
    expect(container.querySelector('.cs-tile-count').textContent).toBe('37 quotes')
  })

  it('puts a round local face on the cover, because the cover alone says only which work', () => {
    const { container } = render(<AppearanceStrip tiles={[tile({ face: 'harry.jpg' })]} />)
    expect(container.querySelector('.cs-tile-chip img')).toBeTruthy()
  })

  // NO CHIP WHERE THERE IS NO PERSON-IN-THE-WORK. On a work somebody WROTE they
  // are the maker, not somebody inside it, and a silhouette there would claim a
  // character nobody has named.
  it('draws no face at all on a work the person made rather than appeared in', () => {
    const { container } = render(<AppearanceStrip tiles={[tile({ face: false })]} />)
    expect(container.querySelector('.cs-tile-chip')).toBeNull()
  })

  it('shows a silhouette where the work has no picture of them', () => {
    const { container } = render(<AppearanceStrip tiles={[tile()]} />)
    const chip = container.querySelector('.cs-tile-chip')
    expect(chip).toBeTruthy()
    expect(chip.querySelector('img')).toBeNull()
  })
})

describe('the name field row', () => {
  // SHOWN AS THE SPLIT IT PRODUCES, so the reader can see which line prints.
  it('puts the printing name where a value goes and the spellings underneath', () => {
    const { container } = render(
      <NamesRow label="Canonical name" lines={['Harry Potter', 'The Boy Who Lived', 'The Chosen One']} onOpen={() => {}} />,
    )
    expect(container.querySelector('.cs-row-meta').textContent).toBe('Harry Potter')
    expect(container.querySelector('.cs-row-sub').textContent).toBe('The Boy Who Lived · The Chosen One')
  })

  it('says so when there are no other spellings, rather than drawing an empty line', () => {
    const { container } = render(
      <NamesRow label="Called here" lines={['Harry']} empty="no other spellings here" onOpen={() => {}} />,
    )
    expect(container.querySelector('.cs-row-sub').textContent).toBe('no other spellings here')
  })
})

describe('a section heading', () => {
  it('carries prose only where there is prose to carry', () => {
    const { container, unmount } = render(<SectionHead label="THE IDENTITY" note="Edits here reach every work." />)
    expect(container.querySelector('.cs-section-note').textContent).toBe('Edits here reach every work.')
    unmount()
    render(<SectionHead label="LINKS" />)
    expect(document.querySelector('.cs-section-note')).toBeNull()
  })
})

// ---- the add tile -----------------------------------------------------------
//
// THE OWNER'S INSTRUCTION: "in the character / actor page (only globals), do have
// a plus card in the works carousel (to add new works when needed)."
describe('the works strip’s add tile', () => {
  const tiles = [
    { key: 'a', title: 'The Master and Margarita', badge: 'book', kind: 'book', faceName: 'Woland', onOpen: () => {} },
  ]

  it('is absent unless the strip is given something to add to', () => {
    // A LOCAL SCOPE GETS NONE. There the strip is this identity's OTHER
    // appearances seen from inside one work, so an add would read as adding a
    // work to the book you are already in.
    const { container } = render(<AppearanceStrip tiles={tiles} />)
    expect(container.querySelector('.cs-tile-add')).toBeNull()
  })

  it('sits after every work, because the strip’s order is the release order', () => {
    const onAdd = vi.fn()
    const { container } = render(<AppearanceStrip tiles={tiles} onAdd={onAdd} addTitle="Add a work this character appears in" />)
    const cells = [...container.querySelectorAll('.cs-tiles > *')]
    expect(cells).toHaveLength(2)
    expect(cells[1].classList.contains('cs-tile-add'), 'the control displaced the earliest appearance').toBe(true)
    fireEvent.click(cells[1])
    expect(onAdd).toHaveBeenCalledTimes(1)
  })

  it('wears the app’s own wording rather than the caller’s invention', () => {
    // ONE CONTROL, ONE LABEL: two callers (the character page and the person
    // page) would otherwise word the same button two ways. Only the TIP differs,
    // because a character appears IN a work and a person is credited ON one.
    const { container } = render(<AppearanceStrip tiles={tiles} onAdd={() => {}} addTitle="tip" />)
    expect(container.querySelector('.cs-tile-add-label').textContent.trim()).not.toBe('')
    expect(container.querySelector('.cs-tile-add').title).toBe('tip')
    // The glyph is decoration beside that label, so it is hidden from a reader
    // who is being read to rather than announced as "plus".
    expect(container.querySelector('.cs-tile-add-art').getAttribute('aria-hidden')).toBe('true')
  })
})
