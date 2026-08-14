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

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [react()],
        test: {
          name: 'pure',
          environment: 'node',
          include: ['test/pure/**/*.test.{js,jsx}'],
          setupFiles: ['./test/setup-pure.js'],
        },
      },
      {
        plugins: [react()],
        test: {
          name: 'dom',
          environment: 'jsdom',
          include: ['test/dom/**/*.test.{js,jsx}'],
          setupFiles: ['./test/setup-dom.js'],
        },
      },
    ],
  },
})
