#!/usr/bin/env node
// BUILDS THE JOURNEYS' FIXTURE FROM THE OWNER'S REAL LIBRARY, WITH THE OWNER OUT
// OF IT.
//
// WHY FROM THE REAL LIBRARY AT ALL. CLAUDE.md is explicit that the seeded fixture
// hides a whole class of defect by being tidy: no cover artwork, a cast of three,
// no name long enough to truncate. Every one of those defects was reported by the
// owner from their own phone and not one reproduced here. The real library has a
// 72-character title, a 2,378-character quote, eleven cast rows on one film and
// three writing systems.
//
// AND WHY NONE OF ITS CONTENT REACHES THE REPO. github.com/aaronified/tippani is
// PUBLIC. Two different things had to be kept out and they are not the same
// question:
//
//   COPYRIGHT — 629 highlights and 92 film lines are somebody else's text. A
//   highlight from a novel IS the copyrighted thing.
//   PRIVACY — 27 book titles and 13 film titles are a reading and watching list,
//   and publishing that discloses something about a person even with every quote
//   replaced. The owner was asked about this separately, because answering the
//   first question does not answer the second.
//
// THE OWNER'S RULING, and this file implements exactly it: "Shape only. But
// invented prose for names, titles, annotations, notes (in same scripts). Use
// different single colour blocks as images. Also you can keep the idiot, on the
// shortness of life, why i am an atheist, grimm's fairy tales, and the quotes and
// proverbs as is."
//
// So: four public-domain books and the boards of quotes and proverbs survive
// verbatim; everything else keeps its SHAPE — its length, its script, its counts,
// its structure — and loses its content.
//
// IT WRITES NOTHING AND COMMITS NOTHING. Output lands in a directory you name,
// and the summary at the end is for a person to read before any of it is added to
// git. The archive it reads never leaves the machine: the server is on 127.0.0.1,
// the data directory is a mktemp the trap removes, and nothing here uploads or
// prints a title that is not on the keep list.
//
//   scripts/screenshots/run-with-backup.sh \
//     node scripts/journeys/curate-fixture.mjs --base-url http://127.0.0.1:8128 --out <dir>

import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { inventName, inventProse, inventTitle, scriptOf } from './invent.mjs'

// ---- the keep list ---------------------------------------------------------
//
// Matched on a substring of the title because the archive spells two of them
// differently from the way the owner named them ("Why I Am An Atheist and Other
// Works", "Grimm's Fairy Stories"). All four authors died well over a century
// ago; these are public domain wherever this repo is read.
const KEEP_BOOKS = ['idiot', 'shortness of life', 'atheist', 'grimm']

const args = process.argv.slice(2)
const argOf = (name, fallback) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : fallback
}
const base = argOf('--base-url', 'http://127.0.0.1:8128')
const outDir = argOf('--out', join(process.cwd(), 'fixture-draft'))

// ---- talking to the app ----------------------------------------------------
const jar = new Map()
const cookie = () => [...jar].map(([k, v]) => `${k}=${v}`).join('; ')
const eat = (res) => {
  for (const line of res.headers.getSetCookie?.() ?? []) {
    const [pair] = line.split(';')
    const i = pair.indexOf('=')
    if (i > 0) jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim())
  }
}
async function api(method, path, body) {
  const res = await fetch(base + '/api' + path, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(jar.size ? { Cookie: cookie() } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  eat(res)
  const text = await res.text()
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 200)}`)
  return text ? JSON.parse(text) : null
}

// ---- a single colour block, as a PNG ---------------------------------------
//
// HAND-WRITTEN RATHER THAN A DEPENDENCY, because a solid rectangle is four
// chunks and a CRC, and the repo's rule is to prefer what is already in the box.
// zlib is Node's; the rest is the PNG spec.
//
// THE OWNER ASKED FOR COLOUR BLOCKS and the reason matters: the seeded fixture
// has NO artwork at all — this container cannot fetch any, every image request
// comes back 403 — so a poster behind a medium glyph, one of the defects
// reported from a real phone, is invisible to every probe that uses it. A flat
// colour is not a jacket, but it is an image of the right size in the right
// place, and it is nobody's copyright.
const CRC = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return (buf) => {
    let c = -1
    for (const b of buf) c = t[(c ^ b) & 0xff] ^ (c >>> 8)
    return (c ^ -1) >>> 0
  }
})()

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(CRC(body))
  return Buffer.concat([len, body, crc])
}

function solidPNG(width, height, [r, g, b]) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // colour type: truecolour
  // Each scanline is a filter byte followed by its pixels; filter 0 is "none",
  // which is what a flat colour wants and what compresses to almost nothing.
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array(width).fill([r, g, b]).flat())])
  const raw = Buffer.concat(Array(height).fill(row))
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// A different colour per work, walked round the hue circle so neighbours in a
// grid never share one — which is the whole point of "different single colour
// blocks" rather than forty of the same grey.
function hueColour(i, total) {
  const h = ((i * 360) / Math.max(1, total)) % 360
  const s = 0.55
  const l = 0.5
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]
  return [r, g, b].map((v) => Math.round((v + m) * 255))
}

// ---- the transform ---------------------------------------------------------
const kept = (title) => KEEP_BOOKS.some((k) => title.toLowerCase().includes(k))
const keepOr = (keep, value, invent) => (keep || !value ? value : invent(value))

async function main() {
  await api('POST', '/auth/login', {
    username: process.env.TIPPANI_USER,
    password: process.env.TIPPANI_PASS,
  })

  const books = (await api('GET', '/books')).books || []
  const movies = (await api('GET', '/movies')).movies || []
  const annotations = (await api('GET', '/annotations')).annotations || []
  const dialogues = (await api('GET', '/dialogues')).dialogues || []
  const utterances = (await api('GET', '/quotes')).utterances || []
  const boards = (await api('GET', '/boards')).boards || []
  const tags = (await api('GET', '/tags')).tags || []

  mkdirSync(join(outDir, 'assets'), { recursive: true })

  // NO imports/ DIRECTORY YET, AND THAT IS DELIBERATE. The owner asked for a
  // subset of the kept public-domain works to become import files, exercising the
  // import routes — and there are eight of them (bookcision, goodreads-html,
  // hardcover-html, imdb-quotes, kindle-clippings, kindle-notebook, markdown,
  // readest-json). Writing eight formats from memory is eight guesses, and a
  // fixture that a parser silently half-reads is worse than none: the import
  // journey would pass on the rows that happened to parse.
  //
  // So they are written where they can be CHECKED — beside the import journeys,
  // against internal/importer's actual parsers, each proved by importing it and
  // seeing the rows arrive. An empty directory here would look like a feature
  // that shipped.

  const totalWorks = books.length + movies.length
  let colourIndex = 0
  const artFor = (slug) => {
    const file = `${slug}.png`
    writeFileSync(join(outDir, 'assets', file), solidPNG(300, 450, hueColour(colourIndex++, totalWorks)))
    return `assets/${file}`
  }

  const report = { keptBooks: [], invented: 0, quotesKept: 0, quotesInvented: 0 }

  const recipeBooks = books.map((b, i) => {
    const keep = kept(b.title)
    if (keep) report.keptBooks.push(b.title)
    const rows = annotations.filter((a) => a.book_id === b.id)
    keep ? (report.quotesKept += rows.length) : (report.quotesInvented += rows.length)
    if (!keep) report.invented++
    return {
      title: keepOr(keep, b.title, inventTitle),
      author: keepOr(keep, b.author, inventName),
      published_year: b.published_year || undefined,
      published_circa: b.published_circa || undefined,
      series: keepOr(keep, b.series, inventTitle) || undefined,
      series_index: b.series_index || undefined,
      genres: b.genres || undefined,
      favorite: b.favorite || undefined,
      cover: artFor(`book-${i + 1}`),
      annotations: rows.map((a) => ({
        quote: keepOr(keep, a.quote, inventProse),
        // NOTES ARE ALWAYS INVENTED, keep list or not. They are the owner's own
        // writing rather than the book's, so the public-domain argument that
        // saves the four books says nothing about them.
        note: a.note ? inventProse(a.note) : undefined,
        translation: a.translation ? inventProse(a.translation) : undefined,
        language: a.language || undefined,
        color: a.color || undefined,
        favorite: a.favorite || undefined,
        tags: a.tags?.length ? a.tags : undefined,
        chapter: keepOr(keep, a.chapter, inventTitle) || undefined,
        chapter_no: a.chapter_no || undefined,
        location: a.location || undefined,
        noted_at: a.noted_at || undefined,
      })),
    }
  })

  const recipeMovies = movies.map((m, i) => {
    const rows = dialogues.filter((d) => d.movie_id === m.id)
    report.quotesInvented += rows.length
    report.invented++
    return {
      title: inventTitle(m.title),
      director: m.director ? inventName(m.director) : undefined,
      release_year: m.release_year || undefined,
      media_type: m.media_type,
      genres: m.genres || undefined,
      favorite: m.favorite || undefined,
      poster: artFor(`work-${i + 1}`),
      cast: (m.actors || []).map((a) => {
        const name = typeof a === 'string' ? a : a?.name
        return name ? { actor: inventName(name), character: inventName(name) } : null
      }).filter(Boolean),
      dialogues: rows.map((d) => ({
        quote: inventProse(d.quote),
        note: d.note ? inventProse(d.note) : undefined,
        language: d.language || undefined,
        color: d.color || undefined,
        favorite: d.favorite || undefined,
        tags: d.tags?.length ? d.tags : undefined,
        character: d.character ? inventName(d.character) : undefined,
        actor: d.actor ? inventName(d.actor) : undefined,
        season: d.season || undefined,
        episode: d.episode || undefined,
        timestamp: d.timestamp || undefined,
        noted_at: d.noted_at || undefined,
      })),
    }
  })

  // THE BOARDS AND THEIR QUOTES SURVIVE VERBATIM — the owner's "the quotes and
  // proverbs as is". Traditional sayings in three languages, which is where the
  // fixture's Bengali and Devanagari actually live.
  const byBoard = new Map(boards.map((b) => [b.id, b.name]))
  const recipeQuotes = utterances.map((u) => {
    report.quotesKept++
    return {
      quote: u.quote,
      note: u.note ? inventProse(u.note) : undefined,
      translation: u.translation || undefined,
      language: u.language || undefined,
      kind: u.kind || undefined,
      speaker: u.speaker || undefined,
      occasion: u.occasion || undefined,
      occasion_date: u.occasion_date || undefined,
      work_title: u.work_title || undefined,
      source_author: u.source_author || undefined,
      recipient: u.recipient || undefined,
      category: u.category || undefined,
      region: u.region || undefined,
      medium: u.medium || undefined,
      color: u.color || undefined,
      favorite: u.favorite || undefined,
      tags: u.tags?.length ? u.tags : undefined,
      board: byBoard.get(u.board_id) || undefined,
    }
  })

  // A SHOW WITH SEVERAL EPISODES, ADDED RATHER THAN COPIED. The archive has one
  // show carrying one line, and the plan's acceptance test is a BULK season and
  // episode edit — which one row cannot exercise at all. This is the fixture
  // earning its keep: it has to carry the shapes the journeys need, not only the
  // shapes the archive happened to have.
  recipeMovies.push({
    // A FIXED TITLE, NOT A GENERATED ONE, and that is the whole difference between
    // this work and every other in the recipe. The rest are derived from a real
    // library, so their titles are invented and REGENERATE — a journey naming one
    // would go red on a fixture rebuild that changed nothing about the app. This
    // show is not derived from anything; it is added because the acceptance test
    // needs a show with several lines and the archive has one with one. So it gets
    // a name a journey can rely on, the way the four public-domain books do.
    title: 'A Serial In Several Parts',
    media_type: 'show',
    release_year: 2019,
    poster: artFor('work-show-extra'),
    cast: [],
    // Six lines, each distinguishable, none carrying a season or an episode —
    // which is exactly the state the bulk editor exists to fix and the acceptance
    // test exists to prove it fixes.
    dialogues: Array.from({ length: 6 }, (_, i) => ({
      quote: `A line from the serial, the ${['first', 'second', 'third', 'fourth', 'fifth', 'sixth'][i]} of six.`,
      character: 'Somebody In The Serial',
    })),
  })

  const recipe = {
    // A NOTE TO WHOEVER OPENS THIS FILE, because "where did this come from" is
    // the first thing they will ask and the answer is not obvious from the data.
    _: 'Generated by scripts/journeys/curate-fixture.mjs from a real library. Titles, names, ' +
       'annotations and notes are INVENTED — same script, same length, no content. Four ' +
       'public-domain books and the boards of quotes and proverbs are verbatim. Images are ' +
       'flat colour blocks. Do not hand-edit: re-run the curator.',
    boards: boards.map((b) => ({ name: b.name, kind: b.kind, color: b.color, description: b.description || undefined })),
    tags: tags.map((t) => ({ name: t.name, color: t.color, style: t.style || undefined })),
    books: recipeBooks,
    movies: recipeMovies,
    quotes: recipeQuotes,
  }

  // ---- THE REFUSAL ---------------------------------------------------------
  //
  // EVERYTHING ABOVE IS A TRANSFORM I BELIEVE IN. This is the part that checks it,
  // and it exists because "I replaced the titles" and "no title survived" are
  // different claims — the first is about what the code intends and the second is
  // about what is in the file. A field added to a read endpoint next year, copied
  // into the recipe by a spread I forgot to narrow, is a leak that every line of
  // reasoning above would still describe correctly.
  //
  // So: serialise what is about to be written, and look in it for every original
  // string that was supposed to be replaced. If one is there, write nothing and
  // say which. A curator that half-works and says nothing would publish somebody's
  // shelf under a summary claiming it had not.
  const serialised = JSON.stringify(recipe)
  const mustBeGone = []
  for (const b of books) {
    if (kept(b.title)) continue
    if (b.title) mustBeGone.push(['a book title', b.title])
    if (b.author) mustBeGone.push(['a book author', b.author])
  }
  for (const m of movies) {
    if (m.title) mustBeGone.push(['a film title', m.title])
    if (m.director) mustBeGone.push(['a director', m.director])
  }
  for (const a of annotations) {
    const b = books.find((x) => x.id === a.book_id)
    if (b && kept(b.title)) continue
    // Long text only: a two-word quote can collide with invented prose by chance,
    // and a false refusal nobody can act on is how a guard gets switched off.
    if (a.quote && a.quote.length > 40) mustBeGone.push(['a highlight', a.quote])
    if (a.note) mustBeGone.push(["one of the owner's notes", a.note])
  }
  for (const d of dialogues) {
    if (d.quote && d.quote.length > 40) mustBeGone.push(['a film line', d.quote])
    if (d.note) mustBeGone.push(["one of the owner's notes", d.note])
  }
  const leaks = mustBeGone.filter(([, text]) => serialised.includes(text))
  if (leaks.length) {
    console.error(`REFUSING TO WRITE: ${leaks.length} thing(s) that should have been replaced are still in the recipe.`)
    for (const [what, text] of leaks.slice(0, 10)) {
      console.error(`  ${what}: ${JSON.stringify(text.slice(0, 60))}${text.length > 60 ? '…' : ''}`)
    }
    console.error('Nothing has been written. Fix the transform above, not this check.')
    process.exit(3)
  }

  writeFileSync(join(outDir, 'library.json'), JSON.stringify(recipe, null, 2) + '\n')

  // ---- the review summary, which is the point of stopping here -------------
  const line = (k, v) => console.log(`  ${String(k).padEnd(34)} ${v}`)
  console.log('\nCURATED FIXTURE — NOTHING HAS BEEN COMMITTED\n')
  line('written to', outDir)
  // COUNTED OFF THE RECIPE, not off a tally kept while building it. The tally
  // version was six short: it was incremented per source row and the show added
  // below never passed through that loop, so the summary described a file that
  // was not the file on disk.
  const annCount = recipe.books.reduce((n, b) => n + b.annotations.length, 0)
  const diaCount = recipe.movies.reduce((n, m) => n + m.dialogues.length, 0)
  line('books', `${recipe.books.length} (${report.keptBooks.length} verbatim, ${recipe.books.length - report.keptBooks.length} invented)`)
  line('verbatim, and why', report.keptBooks.join('; ') + '  — public domain')
  line('films, games and shows', `${recipe.movies.length} (all invented; one show ADDED, see the note in the source)`)
  line('quotes in the recipe', `${annCount + diaCount + recipe.quotes.length} (${annCount} highlights, ${diaCount} lines, ${recipe.quotes.length} standalone)`)
  line('of those, verbatim', `${report.quotesKept}  (the four public-domain books, and the boards of quotes and proverbs)`)
  line('of those, invented', annCount + diaCount + recipe.quotes.length - report.quotesKept)
  line('notes', 'all invented, including on the verbatim books')
  line('images', `${colourIndex} flat colour blocks, 300x450`)
  line('boards', recipe.boards.map((b) => b.name).join(', '))
  console.log('\n  THE THREE NON-PROVERB BOARDS ARE WORTH A GLANCE:')
  for (const q of recipeQuotes.filter((q) => q.kind !== 'proverb')) {
    console.log(`    ${String(q.kind).padEnd(8)} board=${q.board}  ${JSON.stringify((q.quote || '').slice(0, 70))}`)
  }
  console.log('\n  Everything else in the recipe is invented prose in the original script.\n')
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
