// What the release workflow does to CHANGELOG.md, with no workflow in the way.
//
// The notes a release publishes are the section under "## [Unreleased]" moved under the new
// version. Where nobody wrote any, they are built from commit subjects; where there is nothing
// of either, the cut refuses, because a Release whose notes are a stub is the thing this exists
// to stop. The workflow itself cannot run here, so the part that can go wrong in a way a person
// reads is this one.
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
