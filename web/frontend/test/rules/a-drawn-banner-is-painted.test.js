// A banner that is drawn by the stylesheet has to be painted by it.
//
// A SOURCE SCANNER, NOT A TEST. An anthology with no poster of its own gets a generated one: an empty element
// (a list tile's, the page's, the reader's) whose only content is a gradient. With the gradient's rule deleted
// the element is still there, still the right size, and invisible, and a test that looks for the element passes.
// So this reads the stylesheet: each class that stands for a generated banner must declare a background.
import { describe, expect, it } from 'vitest'

import { readSource } from '../src-files.js'

const BANNERS = ['.anthology-poster-fallback', '.anthology-tile-poster-fallback']

describe('a generated banner is painted', () => {
  const css = readSource('index.css')
  for (const cls of BANNERS) {
    it(`${cls} declares a background`, () => {
      const rules = [...css.matchAll(new RegExp(`${cls.replace('.', '\\.')}\\s*\\{([^}]*)\\}`, 'g'))]
      expect(rules.length, `${cls} has no rule in index.css`).toBeGreaterThan(0)
      expect(rules.some((m) => /(^|[;\s])background\s*:/.test(m[1])), `${cls} paints nothing`).toBe(true)
    })
  }
})
