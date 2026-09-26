#!/usr/bin/env node
// Writes docs/wiki/ out as the GitHub wiki must receive it. .github/workflows/wiki.yml
// runs it in place of a plain copy.
//
// WHY A COPY WAS NOT ENOUGH. The sources link the way the repository needs, so that
// wiki-check.mjs can prove every link resolves and a reader browsing docs/wiki/ on
// github.com gets working links. The wiki reads the same text from another place, and
// two kinds of link that work in the repository break there:
//
//   A PAGE LINK WITH ITS .md. `[Developing](Developing.md)` goes to /wiki/Developing.md,
//   which GitHub answers with a 302 to raw.githubusercontent.com: the page's Markdown
//   as plain text rather than the page. A wiki page's name has no extension. 9b07dcd9
//   wrote these links believing they resolved "both in the repo and in the wiki"; they
//   resolved in the repo only.
//
//   A LINK INTO THE REPOSITORY. `../roadmap.html` and `../../go.mod` are relative to
//   docs/wiki/ in the tree, and relative to /<owner>/<repo>/wiki/ on the wiki, where
//   they name nothing: every one was a 404.
//
// So, outside code spans and fences: a link to a wiki page loses its `.md`; a link to
// a file the Pages site publishes goes to the site; any other path in the repository
// goes to github.com at the ref being published, under blob/ for a file and tree/ for
// a directory (a target ending in `/`). Anchors are kept. Nothing else is touched.
// It resolves paths as strings and reads no file but the pages, so what exists is
// still wiki-check's to say.
//
//   node scripts/wiki-publish.mjs --out DIR --repo OWNER/NAME --ref REF [--from DIR]
//
// It refuses, rather than publishing, a link that climbs out of the repository.

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, posix, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// What pages.yml copies into the Pages site, by the path each has in the repository.
// pages.yml's "Assemble the site" step is the source; a file added there and not here
// is linked on github.com instead, which shows its source rather than breaking.
const ON_THE_SITE = {
  'docs/roadmap.html': 'roadmap.html',
  'docs/ui-glossary.html': 'ui-glossary.html',
}

function args(argv) {
  const o = { from: join(REPO_ROOT, 'docs', 'wiki') }
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i]
    if (k === '--out' || k === '--repo' || k === '--ref' || k === '--from') o[k.slice(2)] = argv[++i]
    else throw new Error(`wiki-publish: unknown argument ${k}`)
  }
  for (const k of ['out', 'repo', 'ref']) if (!o[k]) throw new Error(`wiki-publish: --${k} is required`)
  if (!/^[\w.-]+\/[\w.-]+$/.test(o.repo)) throw new Error(`wiki-publish: --repo wants OWNER/NAME, got ${o.repo}`)
  return o
}

// The Pages URL GitHub gives a project site with no custom domain.
const siteOf = (repo) => {
  const [owner, name] = repo.split('/')
  return `https://${owner.toLowerCase()}.github.io/${name}/`
}

// One link target, as the wiki must see it. `pages` is the set of page files.
export function wikiTarget(target, { pages, repo, ref }) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('#')) return target
  const hash = target.indexOf('#')
  const path = hash < 0 ? target : target.slice(0, hash)
  const anchor = hash < 0 ? '' : target.slice(hash)
  if (!path.includes('/') && pages.has(path)) return path.replace(/\.md$/, '') + anchor
  const inRepo = posix.normalize(posix.join('docs/wiki', path))
  if (inRepo === '..' || inRepo.startsWith('../')) {
    throw new Error(`link "${target}" climbs out of the repository`)
  }
  if (ON_THE_SITE[inRepo]) return siteOf(repo) + ON_THE_SITE[inRepo] + anchor
  const dir = path.endsWith('/')
  return `https://github.com/${repo}/${dir ? 'tree' : 'blob'}/${ref}/${inRepo.replace(/\/$/, '')}${dir ? '/' : ''}${anchor}`
}

// A page's text with every inline link outside code rewritten.
export function publishPage(text, opts) {
  let fence = null
  return text.split('\n').map((line) => {
    const open = /^\s*(```+|~~~+)/.exec(line)
    if (fence) {
      if (open && open[1][0] === fence[0] && open[1].length >= fence.length) fence = null
      return line
    }
    if (open) { fence = open[1]; return line }
    // Even pieces are outside a code span, odd ones inside.
    return line.split(/(`+[^`]*`+)/).map((piece, i) => (i % 2
      ? piece
      : piece.replace(/\]\(([^)\s]+)\)/g, (_, t) => `](${wikiTarget(t, opts)})`))).join('')
  }).join('\n')
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  let o
  try { o = args(process.argv) } catch (e) { console.error(e.message); process.exit(2) }
  const files = readdirSync(o.from).filter((f) => f.endsWith('.md'))
  const pages = new Set(files)
  mkdirSync(o.out, { recursive: true })
  let changed = 0
  const bad = []
  for (const f of files) {
    const text = readFileSync(join(o.from, f), 'utf8')
    let out
    try { out = publishPage(text, { pages, repo: o.repo, ref: o.ref }) } catch (e) { bad.push(`${f}: ${e.message}`); continue }
    if (out !== text) changed++
    writeFileSync(join(o.out, f), out)
  }
  for (const b of bad) console.error(`wiki-publish: ${b}`)
  if (bad.length) process.exit(1)
  console.log(`wiki-publish: ${files.length} pages written to ${o.out}, ${changed} with links rewritten for the wiki`)
}
