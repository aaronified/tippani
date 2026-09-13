// THE JOURNEYS: a real browser, a real server, a real database, and no knowledge
// of the code.
//
// A journey may know the address it opens, what is on the screen, what a person
// can do to it, and what the app shows or keeps afterwards. It may not know a
// function's name, a module's path, a CSS class, a JSON field name, a Go type, or
// the text of any source file. Exceptions are declared in the file's own header,
// naming what the file knows and why nothing observable could serve.
//
// WHY THIS TIER EXISTS. The suite let a feature ship 100% dead: the bulk
// season/episode control answered HTTP 400 on every press and wrote nothing,
// while two tests stayed green — one asserting the client's shape, one asserting
// the server's, neither ever pressing the button. That is not a gap in coverage,
// it is a suite measuring the wrong thing.
//
// ITS OWN CONFIG, AND NOT A THIRD PROJECT IN vitest.config.js, which is where the
// plan put it. Two reasons, both about cost. `globalSetup` is where the Go binary
// is built and the library seeded, and in one config file that setup is paid by
// whoever runs `vitest run` — including the fast unit suite, which has no use for
// it. And the dials here are nothing like the other two: minutes of hook timeout
// instead of twenty seconds, a worker cap because each worker holds a server AND
// a Chromium. Same mechanism, same tool, separate file so neither suite can
// silently make the other expensive.

import { defineConfig } from 'vitest/config'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(HERE, '..', '..')

export default defineConfig({
  // The harness imports the screenshot scaffold's capture.mjs — ensureSession,
  // findBrowser, launchBrowser — rather than keeping a second copy of how to log
  // in and how to start a browser. That file is outside this root, so Vite has to
  // be told it may read it; the same allowlist vitest.config.js sets for the
  // locale files, and for the same reason.
  server: { fs: { allow: [REPO_ROOT] } },
  test: {
    name: 'journeys',
    environment: 'node',
    include: ['test/journeys/**/*.journey.mjs'],
    globalSetup: ['./test/journeys/harness/global-setup.mjs'],

    // A JOURNEY IS SLOW BECAUSE IT IS REAL. A press waits for a render, a save
    // waits for a round trip to SQLite. 20s — what the other two projects use —
    // is a unit-test budget and would fail honest journeys on a busy machine.
    testTimeout: 60000,
    // beforeAll copies a library, boots a server, launches Chromium and signs in
    // through the real login form. On a cold cache that is not fast.
    hookTimeout: 180000,

    // EACH WORKER HOLDS A SERVER AND A BROWSER, so parallelism here costs
    // hundreds of megabytes rather than a few. Four is a machine working hard;
    // fifteen is a machine swapping, and a swapping machine fails journeys for
    // reasons that have nothing to do with the app.
    pool: 'forks',
    maxWorkers: 4,
    minWorkers: 1,

    // NO RETRIES, ON PURPOSE. A retry turns "this is broken sometimes" into
    // "this is green", which is the exact failure this whole tier was built to
    // end. A journey that only passes on the second go is a bug report.
    retry: 0,
  },
})
