// WHICH FACES A CARD ASKS FOR.
//
// Its own file, because share-redraw.test.jsx mocks quoteImage.js wholesale to
// count draws — importing the real ensureFonts beside that mock gets the stub.

import { describe, expect, it } from 'vitest'
import { ensureFonts } from '../../src/quoteImage.js'

describe('the faces a card asks for', () => {
  let asked
  const fontsStub = () => {
    asked = []
    return { load: (font, text) => { asked.push({ font, text }); return Promise.resolve([]) } }
  }

  it('asks only for what the quote is written in', async () => {
    const prev = document.fonts
    Object.defineProperty(document, 'fonts', { configurable: true, value: fontsStub() })
    try {
      await ensureFonts({ text: 'The world breaks everyone', hand: false })
      const fams = asked.map((a) => a.font)
      expect(fams.some((f) => /Noto Serif Bengali|Hind Siliguri|Tiro Bangla/.test(f)), 'asked for a Bengali face').toBe(false)
      expect(fams.some((f) => /Devanagari|Kalam|Hind/.test(f)), 'asked for a Devanagari face').toBe(false)
      expect(fams.some((f) => /Caveat/.test(f)), 'asked for the hand face with no note').toBe(false)
      expect(fams.length, 'asked for nothing at all').toBeGreaterThan(0)
      // And it narrows each request to the characters that will be drawn, so a
      // family with a dozen unicode-range subsets sends the one that is needed.
      expect(asked.every((a) => a.text === 'The world breaks everyone')).toBe(true)
    } finally {
      Object.defineProperty(document, 'fonts', { configurable: true, value: prev })
    }
  })

  it('asks for the Bengali face when the quote is in Bengali', async () => {
    const prev = document.fonts
    Object.defineProperty(document, 'fonts', { configurable: true, value: fontsStub() })
    try {
      await ensureFonts({ text: 'যেখানে মন ভয়শূন্য', hand: true })
      const fams = asked.map((a) => a.font)
      expect(fams.some((f) => /12px/.test(f)), 'no 12px script face was asked for').toBe(true)
      expect(fams.some((f) => /22px/.test(f)), 'a note was set and the hand face was not asked for').toBe(true)
    } finally {
      Object.defineProperty(document, 'fonts', { configurable: true, value: prev })
    }
  })

  it('still asks for everything when the caller cannot say', async () => {
    const prev = document.fonts
    Object.defineProperty(document, 'fonts', { configurable: true, value: fontsStub() })
    try {
      await ensureFonts()
      expect(asked.length).toBeGreaterThanOrEqual(10)
      expect(asked.every((a) => a.text === undefined)).toBe(true)
    } finally {
      Object.defineProperty(document, 'fonts', { configurable: true, value: prev })
    }
  })
})
