// Every theme the server understands is a theme the app can ask for.
//
// THE BUG: the review engine has taken `?anthology=` since migration 0043 — it
// narrows the deck by a join on anthology_entries and excludes no kind, so a mixed
// anthology practises as one deck — and for two releases nothing could reach it.
// themeQuery() copied five keys out of the theme object and anthology was not one
// of them, so the parameter was silently dropped on the way out; and no screen had
// a button to set it in the first place. Server-side tests passed, the handler
// worked, and the sixth theme was unreachable.
//
// Nothing could have caught it from one side. The Go tests call the endpoint
// directly with a query string they build themselves, so they never exercise
// themeQuery; the JS tests never knew the parameter existed. The only assertion
// that finds this is the one that reads BOTH sides and compares them — the same
// shape as the CSS/JS agreement checks in palette.test.jsx.
//
// It is a scrape of Go source from a JS test, which is unusual and is the point:
// the drift being measured is between two languages, so a test in either one alone
// cannot see it. If parseReviewTheme is rewritten in a way this regex cannot read,
// the first assertion fails loudly rather than quietly measuring nothing.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { themeKeys, themeQuery } from '../../src/review.jsx'

const SRC = process.env.TIPPANI_SRC || join(process.cwd(), 'src')
const REPO = join(SRC, '..', '..', '..')
const theme = readFileSync(join(REPO, 'internal', 'httpapi', 'review_theme.go'), 'utf8')

// The body of parseReviewTheme, and only that: reviewTheme's own fields and the
// SQL below it mention the same words, and matching those would prove nothing
// about what the endpoint READS.
const parseBody = (() => {
  const start = theme.indexOf('func parseReviewTheme(')
  const end = theme.indexOf('\nfunc ', start + 1)
  return theme.slice(start, end === -1 ? undefined : end)
})()

describe('the theme parameters', () => {
  it('are found at all, so this test is measuring something', () => {
    expect(parseBody, 'parseReviewTheme has moved or been renamed').toContain('q.Get(')
    expect(parseBody.length).toBeGreaterThan(100)
  })

  it('are every one of them in themeKeys', () => {
    const server = [...parseBody.matchAll(/q\.Get\("([a-z_]+)"\)/g)].map((m) => m[1]).sort()
    expect(server.length, 'expected several parameters').toBeGreaterThan(4)
    expect(
      server,
      'the server reads a theme parameter the app never sends — that theme is unreachable',
    ).toEqual([...themeKeys].sort())
  })

  it('and themeQuery actually writes each one', () => {
    // themeKeys being right is half of it; the loop has to use it. A key listed
    // and not written is the same unreachable feature with a passing list.
    for (const k of themeKeys) {
      const qs = themeQuery({ [k]: k === 'tag' || k === 'color' || k === 'person' ? 'x' : 7 })
      expect(qs, `themeQuery drops ${k}`).toContain(`${k}=`)
    }
  })

  it('are dropped when empty, so an unthemed round stays unthemed', () => {
    // The empty theme is a FULL round, and a stray `book=0` would be a theme about
    // a book that does not exist — which the server reads as no book at all, but
    // only by luck.
    expect(themeQuery(null)).toBe('')
    expect(themeQuery({})).toBe('')
    expect(themeQuery({ book: 0, tag: '', anthology: 0 })).toBe('')
  })
})

describe('the anthology theme', () => {
  it('reaches the query string', () => {
    // The specific regression. Named on its own because it is the one that shipped.
    expect(themeQuery({ anthology: 12, label: 'Anything' })).toBe('anthology=12')
  })

  it('has a button on the anthology screen', () => {
    // The other half of "unreachable": the parameter working and nothing setting
    // it is the same feature nobody can use.
    const src = readFileSync(join(SRC, 'anthologies.jsx'), 'utf8')
    expect(src, 'no practise button on the anthology screen').toContain('usePractice')
    expect(src).toMatch(/practise\(\{\s*anthology:/)
    // And the dialog is rendered, or the button opens nothing.
    expect(src, 'usePractice wired up but practiceDialog never drawn').toContain('{practiceDialog}')
  })
})
