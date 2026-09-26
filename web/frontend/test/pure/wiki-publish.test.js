// THE WIKI GETS LINKS IT CAN FOLLOW.
//
// Run the way wiki.yml runs it: scripts/wiki-publish.mjs over a directory of pages,
// then read what it wrote. On the wiki a `Page.md` link is served as raw text and a
// `../` path into the repository is a 404, and both were published that way until
// this script existed.
//
// Nothing here knows a function in the script, only its command line and the pages
// it writes, which are what a maintainer and the wiki see.

import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const REPO = join(process.env.TIPPANI_SRC, '..', '..', '..')
const SCRIPT = join(REPO, 'scripts', 'wiki-publish.mjs')

let dir
afterEach(() => { if (dir) rmSync(dir, { recursive: true, force: true }) })

function publish(pages, { ref = 'main' } = {}) {
  dir = mkdtempSync(join(tmpdir(), 'wiki-publish-'))
  const from = join(dir, 'src')
  mkdirSync(from)
  for (const [name, text] of Object.entries(pages)) writeFileSync(join(from, name), text)
  const run = (out) => execFileSync(process.execPath,
    [SCRIPT, '--from', from, '--out', out, '--repo', 'aaronified/tippani', '--ref', ref],
    { encoding: 'utf8', stdio: 'pipe' })
  const out = join(dir, 'out')
  run(out)
  return (name) => readFileSync(join(out, name), 'utf8')
}

describe('wiki-publish', () => {
  it('links a page by its name, without the .md the wiki would serve raw', () => {
    const read = publish({
      'Home.md': 'See [Developing](Developing.md) and [codes](Troubleshooting.md#health).\n',
      'Developing.md': '# Developing\n',
      'Troubleshooting.md': '# Troubleshooting\n',
    })
    expect(read('Home.md')).toBe('See [Developing](Developing) and [codes](Troubleshooting#health).\n')
  })

  it('sends a path into the repository to github.com at the ref, and a site page to the site', () => {
    const read = publish({
      'Home.md': [
        '[go.mod](../../go.mod), [plans](../plans/), [the roadmap](../roadmap.html#android),',
        '[the glossary](../ui-glossary.html), [a design](../design/handoff/handoff.md),',
        '[home](../landing.html)',
        '',
      ].join('\n'),
    }, { ref: 'next' })
    expect(read('Home.md')).toBe([
      '[go.mod](https://github.com/aaronified/tippani/blob/next/go.mod), '
        + '[plans](https://github.com/aaronified/tippani/tree/next/docs/plans/), '
        + '[the roadmap](https://aaronified.github.io/tippani/roadmap.html#android),',
      '[the glossary](https://aaronified.github.io/tippani/ui-glossary.html), '
        + '[a design](https://github.com/aaronified/tippani/blob/next/docs/design/handoff/handoff.md),',
      '[home](https://aaronified.github.io/tippani/)',
      '',
    ].join('\n'))
  })

  it('leaves code, anchors and absolute links as they are', () => {
    const text = [
      '[top](#top) and [out](https://example.com/a.md) and `[x](Developing.md)`',
      '```',
      '[also](Developing.md)',
      '```',
      '',
    ].join('\n')
    const read = publish({ 'Home.md': text, 'Developing.md': '' })
    expect(read('Home.md')).toBe(text)
  })

  it('refuses a link that climbs out of the repository, rather than publishing it', () => {
    expect(() => publish({ 'Home.md': '[away](../../../elsewhere.md)\n' })).toThrow(/climbs out of the repository/)
  })
})
