// Harness smoke test. Not testing the app — testing that the app is reachable.
//
// Both assertions below correspond to a specific reason `node --test` could
// never have run this suite, and both would fail as an import error rather than
// an assertion, which is why they are worth stating explicitly: if either
// breaks, every other test in the pure project breaks with it and the cause
// will not be obvious from the failure.

import { describe, expect, it } from 'vitest'

describe('the pure harness', () => {
  it('resolves import.meta.env, which api.js reads at module scope', async () => {
    const api = await import('../../src/api.js')
    // DEMO is `import.meta.env.VITE_DEMO === '1'` evaluated at import. Under
    // bare node import.meta.env is undefined and the property read throws.
    expect(api.DEMO).toBe(false)
    expect(api.apiURL('/books')).toBe('/api/books')
  })

  it('survives theme.js calling window.matchMedia at module scope', async () => {
    const theme = await import('../../src/theme.js')
    expect(theme.ACCENTS.terracotta).toBe('#B4482D')
  })

  it('runs with the timezone pinned, so date formatting is reproducible', () => {
    expect(new Date('2026-08-07T00:00:00Z').getHours()).toBe(0)
  })
})
