// The six faces reach the screen — handoff §1.8.
//
// The pure test pins the choosing; this pins the DRAWING, because a stable index
// nothing renders is a stable index. What a reader is owed is that a person with
// no photograph still has a face, that it is the SAME face wherever they appear,
// and that two people do not look alike merely because neither has been
// photographed.
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { PersonChip } from '../../src/people.jsx'
import { SILHOUETTE_COUNT, silhouetteIndex } from '../../src/silhouette.jsx'

const chip = (name) => {
  const { container } = render(<PersonChip kind="book" name={name} onOpen={() => {}} />)
  return container.querySelector('svg.tp-silhouette')
}

describe('a person with no photograph', () => {
  it('still has a face', () => {
    const face = chip('Mikhail Bulgakov')
    expect(face).toBeTruthy()
    // A MASK, NOT AN <img>: it takes the theme, and it can never be mistaken for
    // a photograph that was actually uploaded.
    expect(face.getAttribute('fill')).toBe('currentColor')
    expect(face.querySelectorAll('path, circle').length).toBeGreaterThan(0)
  })

  it('wears the same face on every chip that names them', () => {
    expect(chip('Mikhail Bulgakov').innerHTML).toBe(chip('  MIKHAIL BULGAKOV  ').innerHTML)
  })

  // THE INDEX REACHES THE DRAWING. The pure test proves the choosing spreads; what
  // is left to go wrong here is a component that computes an index and then draws
  // the same shape for all of them, which no assertion about the function catches.
  it('draws a different shape for every face the name picks', () => {
    const names = [
      'Mikhail Bulgakov', 'Ursula K. Le Guin', 'Italo Calvino', 'Toni Morrison',
      'Jorge Luis Borges', 'Marguerite Yourcenar', 'Anton Chekhov', 'Zadie Smith',
      'Haruki Murakami', 'Clarice Lispector', 'James Baldwin', 'Elena Ferrante',
      'Vladimir Nabokov', 'Doris Lessing', 'Kazuo Ishiguro', 'Octavia Butler',
      'Fyodor Dostoevsky', 'Iris Murdoch', 'Gabriel García Márquez', 'Han Kang',
    ]
    const drawn = new Map()
    for (const n of names) {
      const i = silhouetteIndex(n)
      const svg = chip(n).innerHTML
      if (drawn.has(i)) expect(drawn.get(i)).toBe(svg)
      else drawn.set(i, svg)
    }
    expect(drawn.size).toBe(SILHOUETTE_COUNT)
    expect(new Set(drawn.values()).size).toBe(SILHOUETTE_COUNT)
  })

  // A PHOTOGRAPH WINS. The silhouette is the absence of one, and a chip that drew
  // both would be saying the picture is a placeholder.
  it('gives way to a photograph', () => {
    const { container } = render(
      <PersonChip kind="book" name="Mikhail Bulgakov" person={{ image_path: 'p/1.jpg' }} onOpen={() => {}} />,
    )
    expect(container.querySelector('svg.tp-silhouette')).toBeNull()
    expect(container.querySelector('img')).toBeTruthy()
  })
})
