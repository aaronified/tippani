// A reader's highlights are not always in Tippani's own file. They come out of a
// Kindle, out of Readest, out of the Bookcision bookmarklet — and the app reads
// each of those too. This checks that it really does, one format per case.
//
// WHAT EACH CASE ASSERTS, AND WHY THAT IS THE RIGHT LINE. The whole of a route is
// "the app read this file and understood it": which book it belongs to, and what
// the highlight says. Both of those are on the staging screen, in words, before
// anything is approved. So each case uploads, and reads back the book the app
// matched and the text it parsed. Approving is NOT repeated here — that half is
// proven end to end, once, in importing-a-file.journey.mjs, and repeating it three
// times would be three copies of one check rather than three routes.
//
// WHAT NOTHING CHEAPER CATCHES. `internal/importer` has a Go test per parser and
// they are good ones — but a parser that works and a route a person can use are
// different claims. Between them sit the format DETECTION (nothing tells the app
// which of eight formats this file is; it works it out), the multipart upload, and
// a screen that has to draw a queue afterwards. A file the detector sends to the
// wrong parser produces zero rows and a Go parser test that still passes.
//
// THE FILES ARE COMMITTED AND THEIR TEXT IS REAL. Each carries one line taken
// verbatim from this fixture's own copy of a public-domain book — Grimm,
// Dostoyevsky, Bhagat Singh — so a case that finds its line on the queue found
// something the parser actually read out of the bytes, not a title it guessed from
// the filename. Their SHAPES follow the importer's own testdata and the format
// notes in `kindle_clippings.go` and `bookcision.go`, including the CRLF line
// endings a real Kindle writes.

import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

const HERE = dirname(fileURLToPath(import.meta.url))
const file = (name) => join(HERE, 'fixture', 'imports', name)

const ROUTES = [
  {
    what: "a Kindle's own My Clippings.txt",
    file: 'grimm-my-clippings.txt',
    book: "Grimm's Fairy Stories",
    line: 'He who says A must say B too',
  },
  {
    what: 'a Bookcision export of Kindle highlights',
    file: 'idiot-bookcision.json',
    book: 'The Idiot',
    line: 'he must needs begin to insist on the prohibition of faith in God by force',
  },
  {
    what: "Readest's annotation export",
    file: 'atheist-readest.json',
    book: 'Why I Am An Atheist and Other Works',
    line: 'The sword of revolution is sharpened on the whetting stone of ideas',
  },
]

for (const route of ROUTES) {
  it(`a reader imports ${route.what}, and the queue shows what it read`, async () => {
    await app.goto('/')
    await app.press('Add or import')
    await app.press('Files')
    await app.upload('Choose file', file(route.file))

    // The app's own report of what it made of the file, before a queue is opened:
    // it says how many quotes it found and which existing work they belong to.
    // SINGULAR, because each of these files carries one line — and the first draft
    // of this journey asserted "quotes staged" and went red on all three at once.
    // The app was right and the assertion was wrong: it counts properly, and a
    // screen that says "1 quote staged" is a screen that is paying attention.
    await app.see('1 quote staged')
    await app.see(route.book)

    // AND THE WORDS THEMSELVES, off the queue. A count alone would pass on a
    // parser that produced the right number of empty rows.
    //
    // BY THE PANEL'S OWN DOOR, not the sidebar's. The import surface is a modal,
    // and `press` only sees inside the topmost one — which is ARIA's rule and what
    // a scrim means, so the sidebar's Checks is unreachable from here exactly as it
    // is for a reader. The panel offers its own way through, and that is the press
    // a person actually makes.
    await app.press('Review 1 staged quote')
    await app.see('Pending import')
    await app.see(route.line)

    expect(app.pageErrors(), 'the page threw on the way').toEqual([])
  })
}
