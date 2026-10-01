// A person's page says who added each link and who supplied the portrait: the
// pack's §1.3, chosen by the owner as "Links auto/you + portrait source". Each
// link wears "auto" (the app found it) or "you" (the reader pasted it), and the
// portrait the supplier's tag; a link or a picture with nothing recorded says
// nothing.
//
// DECLARED EXCEPTION: the two components are rendered on their own, handed what
// the person record carries (the server's link_sources and image_source), since
// the offline journey server has no supplier to fetch a portrait or a link from.

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

import { PillRow, PortraitBlock } from '../../src/characterRows.jsx'

afterEach(() => cleanup())

describe("a person's page", () => {
  it('marks each link auto or you, and leaves an unrecorded one unmarked', () => {
    render(<PillRow pills={[
      { url: 'https://openlibrary.org/authors/OL1A', slug: 'openlibrary', name: 'Open Library', provenance: 'auto', supplier: 'openlibrary' },
      { url: 'https://ursulakleguin.com', name: 'ursulakleguin.com', provenance: 'you', supplier: 'manual' },
      { url: 'https://example.org', name: 'example.org' },
    ]} />)
    const pill = (name) => screen.getByRole('link', { name: new RegExp(name) })
    expect(pill('Open Library').textContent).toMatch(/auto$/)
    expect(pill('ursulakleguin.com').textContent).toMatch(/you$/)
    expect(pill('example.org').textContent).toBe('example.org')
    expect(screen.getByTitle('Found by the app, from Open Library')).toBeTruthy()
  })

  it("tags the portrait with whoever supplied it", () => {
    render(<PortraitBlock src="/covers/shelley.jpg" source="wikimedia" name="Mary Shelley" px="" />)
    expect(document.body.textContent).toMatch(/wikimedia/i)
    cleanup()
    render(<PortraitBlock src="/covers/shelley.jpg" name="Mary Shelley" px="" />)
    expect(document.body.textContent).not.toMatch(/wikimedia/i)
  })
})
