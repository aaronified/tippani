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
// TZ and locale are pinned. Five places format dates through toLocaleDateString
// with an undefined locale, so without this the same test passes here and fails
// on a runner set to anything else.
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
