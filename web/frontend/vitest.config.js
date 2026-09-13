import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// THREE PROJECTS NOW, AND THE THIRD IS NOT A KIND OF TEST — IT IS A KIND OF LINT.
//
// `rules` holds the files that READ THE SOURCE TEXT and assert something about how
// it is spelled: never truncate a name, spacing is a constant, no emoji glyphs, the
// tick and cross pair, the typescale. Seventy-four of them.
//
// THEY ARE WORTH KEEPING AND THEY WERE NEVER TESTS. A suite let a feature ship 100%
// dead — the bulk season/episode control answered HTTP 400 on every press and wrote
// nothing, while two tests stayed green, one asserting the client's shape and one
// the server's, neither ever pressing the button. Counting a source scan as a test
// is what made a green count mean nothing: the app can be entirely broken and every
// one of these still passes, because none of them runs it.
//
// So `npm test` runs `pure` and `dom`. `npm run lint:rules` runs these, and CI runs
// it as its own step, so a broken design rule still fails the build — it just stops
// being counted as evidence the app works. Each is deleted as a journey covers its
// ground.
//
// NODE, NOT JSDOM, AND THAT WAS A MISTAKE WORTH RECORDING. jsdom looked like the
// safe superset — four of these came from test/dom — and it broke a dozen of them
// instantly: under jsdom `import.meta.url` is an HTTP url (the page's origin), so
// `readFileSync(new URL('../../src/Library.jsx', import.meta.url))` resolves to
// /src/Library.jsx and throws ENOENT. The comment on TIPPANI_SRC above says exactly
// this and I chose jsdom anyway. A file that reads source text wants the node
// environment by definition.
//
// THE OTHER TWENTY-ONE SCANNERS STAY IN `dom`, AND THAT IS DELIBERATE. They RENDER a
// component and scan the source, both in one file; moving them would throw away the
// render to relocate the scan. The plan said "the 99" and the measured split is 74
// pure scanners and 21 mixed — the mixed ones are real tests carrying a lint
// assertion, not lint pretending to be a test.
//
// Two projects before that, because the two kinds of test have very different costs.
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
          // THE SAME 20s THE dom PROJECT ALREADY HAS, and for a reason the note
          // beside that one nearly describes: several cases here PARSE THE WHOLE
          // SOURCE TREE — one-stand-in walks every file with a real parser, and
          // no-free-names and the call-site guards read files too. Their cost is
          // a function of how big the app is, so they creep towards the default
          // 5s as the tree grows and then cross it, three files at a time, on a
          // change that has nothing to do with them. Two of them went red at
          // 6.8s and 5.1s having asserted exactly what they always asserted.
          //
          // NOT SLACK FOR SLOW TESTS TO HIDE IN, which is the argument the dom
          // block makes and it holds here: a genuine hang still fails, twenty
          // seconds later. What this buys is that "this code is wrong" and "this
          // tree got bigger" stop looking the same.
          testTimeout: 20000,
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
      {
        plugins: [react()],
        server: { fs },
        test: {
          name: 'rules',
          environment: 'node',
          include: ['test/rules/**/*.test.{js,jsx}'],
          setupFiles: ['./test/setup-pure.js'],
          // Same reasoning as the other two: several of these parse the whole
          // source tree, so their cost is a function of how big the app is.
          testTimeout: 20000,
        },
      },
    ],
  },
})
