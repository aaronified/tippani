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
// AND THE OWNER'S CALL AT 3.0.4, asked what the public repo should keep of those
// four books once it was found that only one had been checked: "Swap unverified
// lines for invented prose".
//
// So: the four real books keep their titles and authors, and keep a line only
// where it has been checked word for word against a public-domain text (VERIFIED,
// below); the boards of quotes and proverbs survive verbatim; everything else
// keeps its SHAPE — its length, its script, its counts, its structure — and loses
// its content.
//
// IT WRITES NOTHING AND COMMITS NOTHING. Output lands in a directory you name,
// and the summary at the end is for a person to read before any of it is added to
// git. The archive it reads never leaves the machine: the server is on 127.0.0.1,
// the data directory is a mktemp the trap removes, and nothing here uploads or
// prints a title that is not on the keep list.
//
//   scripts/screenshots/run-with-backup.sh \
//     node scripts/journeys/curate-fixture.mjs --base-url http://127.0.0.1:8128 --out <dir>

import { createHash } from 'node:crypto'
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { inventName, inventProse, inventTitle, scriptOf } from './invent.mjs'

// ---- the keep list ---------------------------------------------------------
//
// Matched on a substring of the title because the archive spells two of them
// differently from the way the owner named them ("Why I Am An Atheist and Other
// Works", "Grimm's Fairy Stories").
//
// WHAT IS KEPT IS THE TITLE AND THE AUTHOR, so a journey can name them and survive
// a rebuild. The LINES are another matter. The authors are long dead and that is
// not the same as the lines being free: Bhagat Singh died in 1931, and a modern
// translation is under copyright however long ago its author died. The highlights
// are the owner's own, from the owner's editions, so each one is kept only if it is
// in VERIFIED below, and everything else in these four books is invented prose.
const KEEP_BOOKS = ['idiot', 'shortness of life', 'atheist', 'grimm']

// ---- the lines checked against a public-domain text ----------------------------
//
// HOW THEY WERE CHECKED. Each highlight was looked for in the Project Gutenberg
// text named beside it, with both sides lowercased and every run of anything but a
// letter or a digit folded to one space, so a curly quote or a dash is no reason
// to miss. The match is exact after that: a highlight that differs by one word is
// another translation, and is not here.
//
//   The Idiot, 22 highlights: 11 found in Eva Martin's 1915 translation (Project
//   Gutenberg #2638), and 11 not, which is the count a09f2527 recorded. Checked
//   again for 3.1.0 against the same text.
//   Grimm's Fairy Stories, 1 highlight: found in Project Gutenberg #11027, which
//   carries that title — in "Hansel and Grethel". Checked for 3.1.0.
//   On the Shortness of Life, and Why I Am An Atheist: none checked. The Seneca is
//   not Aubrey Stewart's 1889 translation (Gutenberg #64576, looked for); its
//   translator is unknown. So every line of both is invented.
//
// MATCHED HERE BY EXACT TEXT, NOT FOLDED. A highlight the owner later edits stops
// matching and becomes invented prose until it is checked again, which is the safe
// direction for a list whose whole job is to say what may be published.
const VERIFIED = {
  idiot: [
    'if one of us becomes an Atheist he must needs begin to insist on the prohibition of faith in God by force, that is, by the sword.',
    'On this particular night, while in semi-delirium, he had an idea: what if on the morrow he were to have a fit before everybody? The thought seemed to freeze his blood within him.',
    'We must never forget that human motives are generally far more complicated than we are apt to suppose, and that we can very rarely accurately describe the motives of another.',
    'why must I be humble through all this?',
    'how impossible it is to follow up the effects of any isolated good deed one may do, in all its influences and subtle workings upon the heart and after actions of others.',
    'I can assure you that crimes just as dreadful, and probably more horrible, have occurred before our times, and at all times, and not only here in Russia, but everywhere else as well; and in my opinion it is not at all likely that such murders will cease to occur for a very long time to come. The only difference is that in former times there was less publicity, while now everyone talks and writes freely about such things—which fact gives the impression that such crimes have only now sprung into existence.',
    '“Are you tempting me to box your ears for you, or what?”',
    'here I should imagine the most terrible part of the whole punishment is, not the bodily pain at all—but the certain knowledge that in an hour,—then in ten minutes, then in half a minute, then now—this very instant—your soul must quit your body and that you will no longer be a man—and that this is certain, certain! that’s the point—the certainty of it. Just that instant when you place your head on the block and hear the iron grate over your head—then—that quarter of a second is the most awful of all.',
    '“What, did they hang the fellow?” “No, they cut off people’s heads in France.”',
    'he so respected and feared his wife that he was very near loving her.',
    'General Epanchin was in the very prime of life; that is, about fifty-five years of age,—the flowering time of existence, when real enjoyment of life begins.',
  ],
  grimm: [
    'He who says A must say B too; and he who consents the first time must also the second.',
  ],
}

// ---- and the prose written in place of the rest ---------------------------------
//
// WRITTEN FOR THIS FIXTURE, not generated. A kept book's unverified line becomes a
// passage of about its length and of its kind — a remark in dialogue where the
// original was dialogue, a lowercase start where the highlight began mid-sentence,
// a stray PDF hyphen where the highlight carried one — so the book still reads as a
// book a person highlighted, and the shape a card has to draw is the same. None of
// it is a quotation of anything, and none of it paraphrases the line it replaces.
//
// KEYED BY A HASH OF THE ORIGINAL, so the curator can find the replacement without
// the repo holding the line it replaces. The location beside each is for a reader
// of this file. A highlight with no entry here — one the owner adds or edits later
// — falls back to inventProse, and the summary says how many did, so a re-run
// never publishes an unverified line and never fails silently either.
const WRITTEN = {
  // On the Shortness of Life
  ddbf16dcc488: 'A household is measured less by what it keeps than by what it lets go: the grudge left at the door, the debt forgiven before anyone asked, the letter answered late but kindly, the chair set out for the neigh- bour who never quite arrives.', // loc 15
  '8c856abd0f75': 'An hour lent to worry is never paid back in full', // loc 15
  '5a8a646fc274': 'A morning spent well does not ask to be remembered; it simply makes the evening lighter.', // loc 13
  '043fd5820bb3': 'The long argument of the tides', // loc 8
  '425f94680483': 'A garden will forgive a late planting and a missed weeding, but not a gardener who only ever stands at the gate deciding where to begin.', // loc 9
  // Why I Am An Atheist and Other Works
  '367f68c97d01': 'A people that has learned to read will not long consent to be ruled by what it is forbidden to read. Schools are slower than barricades, and they are a great deal harder to pull down again.', // loc 501
  fc772fcf6115: 'A tired crowd still remembers every promise,', // loc 389
  '55db84134a8b': 'The old press in the back room was older than any of us who worked it, and it never once missed a Monday edition.', // loc 308
  '02586d35acb6': 'A strike is won in the kitchens as much as at the gates; someone must feed those who stand there.', // loc 206
  '3b4bbbc74dc4': 'His letters from prison were short, cheerful and all about the harvest, which is how we knew he was worried.', // loc 203
  ad6a5f9a4ca8: 'one’s first lesson in the movement was how to carry a message without reading it.', // loc 189
  // The Idiot, the 11 not found in Gutenberg #2638
  ac3ef53d086f: 'only say whether you think the bridge will hold till spring, because I must decide tonight whether to send the cart round by the mill.” “Send it by the mill,” said the ferryman, “and a lamp with it, for that road forgets itself after dark.”', // loc 7082
  '4a8c3622ff2f': 'was it you who left the gate open again?” the old woman called from the porch, “because the goats are in the lettuces, and I will not chase them twice in one week.” Nobody answered. The boys had gone down to the river, and the only sound in the yard was the goats, eating the lettuces with the calm of creatures who knew perfectly well—', // loc 6046
  '0ace65c9da5d': 'the quieter the house becomes, the louder every clock in it seems to grow;', // loc 5556
  '0a01287b41c9': '“You may laugh at the almanac as much as you please,” said the widow, folding her napkin, “but it has told me when to plant for thirty years, and it has never once asked me for money, which is more than I can say for any of the gentlemen who have sat at this table and laughed at it.”', // loc 3869
  '2d69d31c70dd': '“Think for a moment,” he said, “what a railway timetable really is: a promise made by people you will never meet, printed in a type too small to read, about hours that have not happened yet. And still we plan our weddings by it, and our funerals, and the day we shall finally write to our brother again. I do not call that foolish—not at all—I call it the most touching faith of the whole century, and no priest I ever met has dared to ask for half as much of it.”', // loc 3852
  df5b334dd709: 'There is a kind of tiredness that no sleep repairs and no holiday touches, and it lifts, oddly, only when somebody asks, without hurrying, how you have really been.', // loc 3118
  dc11d0172672: '“Before I go, I want to say one thing plainly,” said the guest, buttoning his coat, “because I am bad at letters and worse at remembering to post them. When I came here I expected a week of polite dinners and early nights, and instead I have had arguments about the stars at two in the morning, a lesson in mending nets from your youngest, and the best bread I have eaten since I was a boy—you will laugh, but it is true. I have been treated not as a visitor but as a cousin who had been away too long. I do not know how to repay that, and I think you would be offended if I tried; so I will only promise that when you come to the city, as you keep threatening to, there will be a bed made up, a lamp left burning, and nobody asking what time you mean to get up.”', // loc 1450
  '4ea7796c3ea1': 'The house stood at the very end of the lane, where the gravel gave up and the grass took over, and it had the air of a place that had been expecting visitors for years and had long since stopped minding that none came; the gate was never locked, and the kettle was never quite cold.', // loc 627
  dd192ce6bba0: 'the soup is cold again, and nobody will admit to letting it cool.', // loc 344
  '4d9384c4a809': 'I can’t say how the old sexton came by a key to every house in the parish, but he has had them longer than anyone remembers.” “Every house! Then he could live wherever he liked!” laughed the carter, and the sexton, who had heard it for forty years, laughed too.', // loc 105
  '4b8e072abe9b': 'By seven o’clock the square had filled with the kind of noise that has no single source—carts backing into their places, a dog objecting to all of them, two sisters disagreeing about the price of onions in voices meant to be overheard by the whole street. The baker’s boy went from stall to stall with a tray on his head, and everyone took a roll and promised to pay on Saturday, and he wrote each promise in chalk on the inside of his cap, which was the only ledger in the town that had never once been wrong.', // loc 93
}

const lineKey = (text) => createHash('sha256').update(text).digest('hex').slice(0, 12)

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
const verified = (title, text) => Object.entries(VERIFIED)
  .some(([k, lines]) => title.toLowerCase().includes(k) && lines.includes(text))

// A kept book's line: itself if checked, else the passage written for it, else
// generated prose — and the tally says which, per book.
function keptLine(title, text, tally, location) {
  if (!text) return text
  if (verified(title, text)) { tally.verified++; return text }
  const written = WRITTEN[lineKey(text)]
  if (written) { tally.written++; return written }
  tally.generated++
  // The key and the location only: enough to add a passage, nothing of the line.
  tally.missing.push(`${lineKey(text)} (loc ${location || '?'}, ${text.length} characters)`)
  return inventProse(text)
}

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
  // subset of the four kept books to become import files, exercising the
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
    const tally = { title: b.title, verified: 0, written: 0, generated: 0, missing: [] }
    if (keep) report.keptBooks.push(tally)
    const rows = annotations.filter((a) => a.book_id === b.id)
    if (!keep) report.quotesInvented += rows.length
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
        quote: keep ? keptLine(b.title, a.quote, tally, a.location) : keepOr(keep, a.quote, inventProse),
        // NOTES ARE ALWAYS INVENTED, keep list or not. They are the owner's own
        // writing rather than the book's, so the owner's ruling that keeps the
        // four books' titles and checked lines says nothing about them.
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
    // a name a journey can rely on, the way the four real books do.
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
       'real books keep their titles and authors, and only those of their lines found word ' +
       'for word in a Project Gutenberg text (the curator\'s VERIFIED list); their other ' +
       'lines are invented prose written for this fixture. The boards of quotes and ' +
       'proverbs are verbatim. Images are flat colour blocks. Do not hand-edit: re-run the curator.',
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
    if (b && kept(b.title)) {
      // A KEPT BOOK'S UNCHECKED LINES ARE GUARDED TOO, and from a shorter length:
      // what replaces them is written prose or generated prose, neither of which
      // can land on a 20-character sentence of somebody's translation by chance.
      // The shortest unchecked line in the archive at 3.1.0 is thirty.
      if (a.quote && a.quote.length > 20 && !verified(b.title, a.quote)) {
        mustBeGone.push(['an unchecked line of a kept book', a.quote])
      }
      if (a.note) mustBeGone.push(["one of the owner's notes", a.note])
      continue
    }
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
  const checked = report.keptBooks.reduce((n, t) => n + t.verified, 0)
  const generatedInKept = report.keptBooks.reduce((n, t) => n + t.generated, 0)
  line('books', `${recipe.books.length} (${report.keptBooks.length} real titles, ${recipe.books.length - report.keptBooks.length} invented)`)
  line('real titles, and why', 'kept at the owner\'s call, title and author; a line only if VERIFIED')
  for (const t of report.keptBooks) {
    line(`  ${t.title.slice(0, 30)}`, `${t.verified} checked and kept, ${t.written} written, ${t.generated} generated`)
  }
  line('films, games and shows', `${recipe.movies.length} (all invented; one show ADDED, see the note in the source)`)
  line('quotes in the recipe', `${annCount + diaCount + recipe.quotes.length} (${annCount} highlights, ${diaCount} lines, ${recipe.quotes.length} standalone)`)
  line('of those, verbatim', `${report.quotesKept + checked}  (${checked} checked lines of the real titles, and the boards of quotes and proverbs)`)
  line('of those, invented', annCount + diaCount + recipe.quotes.length - report.quotesKept - checked)
  line('notes', 'all invented, including on the real titles')
  line('images', `${colourIndex} flat colour blocks, 300x450`)
  line('boards', recipe.boards.map((b) => b.name).join(', '))
  console.log('\n  THE THREE NON-PROVERB BOARDS ARE WORTH A GLANCE:')
  for (const q of recipeQuotes.filter((q) => q.kind !== 'proverb')) {
    console.log(`    ${String(q.kind).padEnd(8)} board=${q.board}  ${JSON.stringify((q.quote || '').slice(0, 70))}`)
  }
  if (generatedInKept) {
    console.log(`\n  ${generatedInKept} UNCHECKED LINE(S) OF A REAL TITLE HAD NO WRITTEN PASSAGE and got generated`)
    console.log('  prose. Nothing unchecked was published, but add a passage to WRITTEN for each:')
    for (const t of report.keptBooks) for (const m of t.missing) console.log(`    ${t.title.slice(0, 30)}: ${m}`)
  }
  console.log('\n  Everything else in the recipe is invented prose in the original script.\n')
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
