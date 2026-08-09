// Every local link on the published site resolves to a file that exists.
//
// WHY THIS EXISTS. The Pages site is assembled by copying, not by a build that
// understands links: pages.yml drops the landing page at the root, the two docs
// beside it, the screenshots under img/, and the demo one level down at /demo/.
// Nothing checks that the pieces agree. The failures are all silent and all of
// the same shape — a copy step that stops running, a file renamed on one side
// of the move, a relative path written for the old layout.
//
// The move itself is the reason. The demo used to be the site ROOT and the docs
// sat beside it, so `href="roadmap.html"` from inside the demo was correct.
// The demo is at /demo/ now, and that same href silently points at
// /demo/roadmap.html — a 404 reached only by clicking the link in the ribbon.
// Exactly the kind of thing nobody notices for eight releases.
//
// Run against an assembled _site: `node scripts/site-links.mjs [dir]`.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, resolve, relative } from 'node:path'

const ROOT = resolve(process.argv[2] || '_site')

if (!existsSync(ROOT)) {
  console.error(`site-links: ${ROOT} does not exist — build it first (npm run build:demo, then the pages.yml copy steps)`)
  process.exit(2)
}

function htmlFiles(dir) {
  const out = []
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) out.push(...htmlFiles(p))
    else if (e.name.endsWith('.html')) out.push(p)
  }
  return out
}

// href/src on any element, plus the CSS url() forms that reference real files.
const ATTR = /(?:href|src)\s*=\s*"([^"]+)"/g

// Not our problem: other origins, and the schemes that are not file lookups.
const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#|mailto:|data:)/i

const problems = []
let checked = 0

for (const file of htmlFiles(ROOT)) {
  const html = readFileSync(file, 'utf8')
  for (const m of html.matchAll(ATTR)) {
    const raw = m[1].trim()
    if (!raw || EXTERNAL.test(raw)) continue
    // Strip the query and fragment; neither affects which file is served.
    const path = raw.split('#')[0].split('?')[0]
    if (!path) continue

    // Root-absolute paths are a real hazard here and NOT resolvable against the
    // site root: the site is served from /tippani/, so `/icons/x.png` means
    // github.io/icons/x.png, which is somebody else's 404. Flag rather than
    // resolve.
    if (path.startsWith('/')) {
      problems.push(`${relative(ROOT, file)} → ${raw}  (root-absolute; the site is served from a subpath)`)
      continue
    }

    const target = resolve(dirname(file), path)
    // A directory link (…/demo/) is served by its index.html.
    const candidates = path.endsWith('/') ? [join(target, 'index.html')] : [target, join(target, 'index.html')]
    checked++
    if (!candidates.some((c) => existsSync(c) && statSync(c).isFile())) {
      problems.push(`${relative(ROOT, file)} → ${raw}`)
    }
  }
}

// The sweep's own failure mode: a regex that stops matching and reports a clean
// site because it looked at nothing.
if (checked < 10) {
  console.error(`site-links: only ${checked} local links found — the extractor is probably broken`)
  process.exit(2)
}

if (problems.length) {
  console.error(`site-links: ${problems.length} broken link(s) in ${ROOT}\n`)
  for (const p of problems) console.error('  ' + p)
  process.exit(1)
}

console.log(`site-links: ${checked} local links, all resolve`)
