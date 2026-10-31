// What the release workflow does to CHANGELOG.md, with no workflow in the way.
//
// The notes a release publishes are the section under "## [Unreleased]" moved under the new
// version. Where nobody wrote any, they are built from commit subjects; where there is nothing
// of either, the cut refuses, because a Release whose notes are a stub is the thing this exists
// to stop. The workflow itself cannot run here, so the part that can go wrong in a way a person
// reads is this one.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'

const { cutRelease, entriesFromSubjects, VERSION } = await import(
  pathToFileURL(join(process.cwd(), '../../scripts/release-changelog.mjs')).href
)

const OLD = `## [3.4.2] - 2026-10-25

### Fixed

- **Pressing Scan could hang.** It no longer does.
  A second line.

## [3.4.1] - 2026-10-24

### Added

- Something older.
`

const PRE = '# Changelog\n\nAll notable changes.\n\n'

describe('cutting a release from the changelog', () => {
  it('moves what is under Unreleased beneath the new version and leaves Unreleased empty', () => {
    const md = `${PRE}## [Unreleased]\n\n### Added\n\n- Kindle files are read.\n\n### Fixed\n\n- A highlight keeps its location.\n\n${OLD}`
    const r = cutRelease(md, '3.5.0', '2026-10-31')
    expect(r.source).toBe('unreleased')
    expect(r.entries).toBe(2)
    expect(r.md).toContain('## [Unreleased]\n\n## [3.5.0] - 2026-10-31\n\n### Added\n\n- Kindle files are read.')
    expect(r.md.endsWith(OLD)).toBe(true) // the older releases are untouched, byte for byte
    expect(r.md.startsWith(PRE)).toBe(true)
  })

  it('builds the notes from commit subjects when nothing was written, and says which kinds it keeps', () => {
    const r = cutRelease(`${PRE}${OLD}`, '3.5.0', '2026-10-31', [
      'feat(sources): read MOBI and AZW3 (#62)',
      'fix(locators): a highlight keeps its own location',
      'docs: handoff',
      'chore(dist): rebuild (last)',
      'chore(release): 3.4.2',
      'test(srcmatch): another script',
      'refactor(ebook): share the percent rule',
      'not a conventional subject',
    ])
    expect(r.source).toBe('commits')
    expect(r.md).toContain('### Added\n\n- **sources:** Read MOBI and AZW3 (#62).')
    expect(r.md).toContain('### Changed\n\n- **ebook:** Share the percent rule.')
    expect(r.md).toContain('### Fixed\n\n- **locators:** A highlight keeps its own location.')
    expect(r.md).not.toMatch(/handoff|rebuild|another script/)
    expect(r.entries).toBe(3)
  })

  it('refuses when there is nothing to put in the notes', () => {
    expect(() => cutRelease(`${PRE}## [Unreleased]\n\n${OLD}`, '3.5.0', '2026-10-31', ['docs: only docs'])).toThrow(/nothing to release/)
  })

  it('refuses a version that already has a section, and one that is not a version', () => {
    const md = `${PRE}## [Unreleased]\n\n### Fixed\n\n- A fix.\n\n${OLD}`
    expect(() => cutRelease(md, '3.4.2', '2026-10-31')).toThrow(/already has a section for 3.4.2/)
    expect(() => cutRelease(md, 'v3.5.0', '2026-10-31')).toThrow(/not a version/)
    expect(() => cutRelease(md, '3.5', '2026-10-31')).toThrow(/not a version/)
  })

  it('accepts a pre-release suffix', () => {
    expect(VERSION.test('3.5.0-rc.1')).toBe(true)
    expect(VERSION.test('3.5.0')).toBe(true)
    expect(VERSION.test('v3.5.0')).toBe(false)
  })

  it('keeps a bullet that runs onto a second line whole', () => {
    const md = `${PRE}## [Unreleased]\n\n### Fixed\n\n- **First line.** Second\n  line of the same bullet.\n\n${OLD}`
    const r = cutRelease(md, '3.5.0', '2026-10-31')
    expect(r.md).toContain('- **First line.** Second\n  line of the same bullet.')
    expect(r.entries).toBe(1)
  })
})

// THE REAL FILE, because the cut above is only as good as what it is given. People and agents
// edit CHANGELOG.md; this is what says, in the same run as everything else, that the file is
// still something the release workflow can cut. AGENTS.md and CONTRIBUTING.md tell them how to
// keep it so.
describe('CHANGELOG.md, as the release will find it', () => {
  const real = readFileSync(join(process.cwd(), '../../CHANGELOG.md'), 'utf8').replaceAll('\r\n', '\n')
  const headings = real.split('\n').filter((l) => l.startsWith('## '))

  it('opens with an Unreleased section, which is where an entry goes', () => {
    expect(headings[0]).toBe('## [Unreleased]')
    expect(headings.filter((h) => /^## \[Unreleased\]/i.test(h))).toHaveLength(1)
  })

  it('names every release as [X.Y.Z] - YYYY-MM-DD, so the release notes can be found by version', () => {
    const bad = headings.slice(1).filter((h) => !/^## \[[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.]+)?\] - [0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(h))
    expect(bad).toEqual([])
  })

  it('can be cut now, with or without anything under Unreleased, and leaves the older releases as they were', () => {
    const olderReleases = (md) => md.slice(md.indexOf('\n## [', md.indexOf('## [Unreleased]') + 1) + 1)
    const r = cutRelease(real, '999.0.0', '2030-01-01', ['fix(test): a fix to cut with'])
    expect(r.md).toContain('## [999.0.0] - 2030-01-01')
    // everything from the first release that was already out is byte for byte what it was
    const firstOld = real.split('\n').find((l, i, all) => l.startsWith('## [') && i > all.findIndex((x) => x.startsWith('## [Unreleased]')) && !/Unreleased/.test(l))
    const fromOld = (md) => md.slice(md.indexOf(`\n${firstOld}\n`) + 1)
    expect(fromOld(r.md)).toBe(fromOld(real))
    expect(olderReleases(real).length).toBeGreaterThan(1000)
  })
})
