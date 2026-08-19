import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Two projects, because the two kinds of test have very different costs.
//
// `pure` is the bulk of it: functions that take values and return values —
// credit splitting, the forgetting curve, grouping, share formatting, routing,
// word wrap. Those need no DOM, so they run in the node environment and stay
// fast enough that you run them without thinking about it.
//
// `dom` is for components, and pays for jsdom only where a component is
// actually under test.
//
// Both go through Vite rather than bare node, and they have to: api.js reads
// import.meta.env at module scope, and ui.jsx imports api.js, so almost the
// whole tree is unloadable by `node --test`. That is also why the two existing
// hand-rolled check scripts could only ever cover greetings.js and secret.js —
// they are the only modules with no imports at all.
//
// TZ is pinned here. THE LOCALE IS PINNED TOO, and not here — see
// test/pin-locale.js, imported by both setup files.
//
// The split is forced rather than chosen. An env var reaches the workers and is all
// TZ needs; the locale ignores env vars on Windows, so it has to be pinned inside
// the environment the tests run in. This comment used to claim both were done on
// this line, and only TZ ever was — which is how four date assertions shipped
// depending on the author's machine and went red on CI the day the runner's default
// moved. A comment claiming a guarantee nothing implements is worse than no comment:
// the next person reads it and stops looking.
process.env.TZ = 'UTC'

// Where the source lives, as an absolute path, for the handful of tests that
// read a source file rather than import it — the CSS/JS agreement checks in
// palette.test.jsx and button-labels.test.jsx.
//
// They cannot work it out themselves. Under jsdom `import.meta.url` is an http
// URL (the page's origin), so readFileSync rejects it; and process.cwd() is
// whatever directory vitest was launched from, which is web/frontend for `npm
// test` and the repo root for `npx vitest --root web/frontend`. Both are real
// invocations, and the second one is how the divergence was found. The config
// is the only place that knows for certain, and it runs in Node where
// import.meta.url is a file: URL.
process.env.TIPPANI_SRC = join(dirname(fileURLToPath(import.meta.url)), 'src')

// THE LOCALE FILES ARE OUTSIDE THIS TREE, and Vite has to be told it may read
// them. internal/i18n/en.txt and bn.txt are the canonical copy for BOTH sides of
// the app (see web/frontend/src/i18n.js for why they live in a Go package), and
// i18n.js imports them with `?raw`.
//
// The node project resolved that happily and the jsdom one refused it with
// "Denied ID", which is Vite's fs allowlist: it defaults to the detected
// workspace root, and the two environments do not detect the same one. Named
// explicitly rather than left to a heuristic, because a heuristic that disagrees
// with itself between two projects in one config file is not a heuristic worth
// depending on. `npm run build` never checks this at all — the guard is the dev
// server's — so vite.config.js says the same thing for `npm run dev`.
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const fs = { allow: [REPO_ROOT] }

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [react()],
        server: { fs },
        test: {
          name: 'pure',
          environment: 'node',
          include: ['test/pure/**/*.test.{js,jsx}'],
          setupFiles: ['./test/setup-pure.js'],
        },
      },
      {
        plugins: [react()],
        server: { fs },
        test: {
          name: 'dom',
          environment: 'jsdom',
          include: ['test/dom/**/*.test.{js,jsx}'],
          setupFiles: ['./test/setup-dom.js'],
          // THE DEFAULT 5s IS A MEASUREMENT OF THE MACHINE, NOT OF THE CODE.
          //
          // A handful of these files render a whole screen — Settings mounts
          // eight cards and each fetches on mount — and jsdom does that an order
          // of magnitude slower than a browser. Alone, they finish in well under
          // a second. Run as one of forty files across every core at once, the
          // slowest of them crossed 5s and failed with "Test timed out", which
          // reads exactly like a hung await and is nothing of the sort: the same
          // file passes on its own, and WHICH files fail changes between runs.
          //
          // That is the worst shape a failure can have. It is not reproducible on
          // the machine you would debug it on, it moves when you add an unrelated
          // test file (which is how it surfaced — a 70th file changed the worker
          // scheduling), and the obvious reading of the message sends you looking
          // for a promise that never settles.
          //
          // 20s is not slack for slow tests to hide in; a genuine hang still fails,
          // just twenty seconds later. It is the margin between "this code is
          // wrong" and "this laptop was busy", and only the first is worth a red
          // suite.
          testTimeout: 20000,
        },
      },
    ],
  },
})
