// A reader on a phone opens a finished fill's log and reads the lookups it tried:
// each address reads as words, and where a line has to break it breaks at a joint
// of the address — after a / ? & , or =, or at a space — never inside a word or a
// number.
//
// WHAT WENT WRONG, and the owner photographed it (30 September). A request line is
// one long word to the browser, so at 390 the pane broke it wherever its width ran
// out: "volume|s?", "97814090831|08". And the query was as it was sent,
// "fields=key%2Ctitle%2Csubtitle…", three characters of noise per comma.
//
// WHAT NO OTHER TIER SEES. The Go tier proves the server writes the query as words
// (TestACallsLineReadsItsQueryAsWords); where a line breaks is the browser's, at a
// width, and only a pane a person looks at has one.
//
// NO HOLD. The fill runs offline and finishes, its lookups refused, which is what
// puts two long addresses in its log.
//
// DECLARED EXCEPTIONS, and what each knows:
//   - SETUP KNOWS `GET /api/books`, `GET` and `PUT /api/books/{id}`, the `books`,
//     `id`, `title` and `isbn` fields, and `POST /api/jobs` with `kind: 'fill'` and
//     `book_ids`: the book needs an ISBN or the fill asks nobody anything.
//   - `app.page` READS WHERE THE LINES BREAK, character by character, which no word
//     of the vocabulary does (`splitWords` counts a word cut in two, and an address
//     is one word however well it is cut). It finds the pane by its role, a log,
//     and the lines by the text they hold.
//
// THE MUTATIONS, each built and run and put back:
//   - `breakable` in jobsSection.jsx returning the line as it came: red, the
//     openlibrary address breaks inside a word;
//   - `readable` taken out of internal/jobs/outbound.go's outboundLine: red at
//     "fields=key,title", which then reads fields=key%2Ctitle.

import { expect, it } from 'vitest'

import { PHONE, openApp } from './harness/world.mjs'

const app = openApp({ viewport: PHONE })

const TITLE = 'On the Shortness of Life'
const ISBN = '9780141018812'

it('on a phone a finished fill’s log reads its lookups as words and breaks them only at their joints', async () => {
  const { books } = await app.setup('GET', '/books')
  const { id } = books.find((b) => b.title === TITLE)
  const book = await app.setup('GET', `/books/${id}`)
  await app.setup('PUT', `/books/${id}`, { ...book, isbn: ISBN })
  await app.setup('POST', '/jobs', { kind: 'fill', params: { book_ids: [id] } })

  await app.goto('/settings/jobs')
  await app.see('Past jobs')
  await app.press(`Fill gaps ${TITLE}`)
  await app.see(`q=isbn:${ISBN}`)
  await app.see('fields=key,title,subtitle')

  // Every place a lookup's line wraps, as "the character before|the one after". A
  // lookup's line is the smallest element in a log pane that holds a whole
  // "GET … → refused (offline)"; the System logs pane beside it is not asked about.
  const cuts = await app.page.evaluate(() => [...document.querySelectorAll('[role="log"] *')]
    .filter((el) => /^GET \S+ → refused \(offline\)$/.test(el.textContent)
      && ![...el.children].some((c) => /^GET /.test(c.textContent)))
    .flatMap((el) => {
      const out = []
      let top = null
      let before = ''
      const texts = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
      for (let n = texts.nextNode(); n; n = texts.nextNode()) {
        for (let i = 0; i < n.data.length; i++) {
          const r = document.createRange()
          r.setStart(n, i)
          r.setEnd(n, i + 1)
          const box = r.getClientRects()[0]
          if (!box) continue
          if (top !== null && box.top > top + box.height / 2) out.push(`${before}|${n.data[i]}`)
          top = box.top
          before = n.data[i]
        }
      }
      return out
    }))

  expect(cuts.length, 'no lookup line wrapped at all, so nothing was measured').toBeGreaterThan(0)
  const inside = cuts.filter((c) => !/^[/?&,= ]\|/.test(c) && !/\| /.test(c))
  expect(inside, 'a lookup line broke inside a word or a number').toEqual([])
  expect(await app.sideways()).toBe(0)
})
