// WHERE A FIELD CAME FROM, when the answer is the book's own file. A field filled from
// an attached EPUB is credited to it, and the tag says so in the reader's words rather
// than falling through to "unknown source".
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FieldSourceTag } from '../../src/ui.jsx'

describe('a field filled from the book\'s own file', () => {
  it('is tagged as the book file, not as an unknown source', () => {
    render(<FieldSourceTag source="epub" at="2026-02-14" />)
    expect(screen.getAllByText(/Book file/).length).toBeGreaterThan(0)
    expect(screen.queryByText(/unknown source/i)).toBeNull()
  })
})
