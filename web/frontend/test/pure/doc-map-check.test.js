// DEVELOPING'S CI TABLE IS READ AS A MAINTAINER WRITES IT, AND A FAULT IS BLAMED ON
// THE RIGHT SIDE.
//
// Run the way CI's roadmap job runs it, as a command, here over a small tree of its
// own (`--root`): a Developing.md with a "Maintainer: CI" table and a ci.yml with jobs.
// What is asserted is what a maintainer sees, the exit and the line it names. Exit 1
// means the document is wrong and names the line; exit 2 means the script could not
// read what it was given, and only for that.
//
// It knows the script's command line and the two files it reads, and nothing inside it.

import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const REPO = join(process.env.TIPPANI_SRC, '..', '..', '..')
const SCRIPT = join(REPO, 'scripts', 'doc-map-check.mjs')

const CI = `name: ci
on: [push]
jobs:
  go:
    runs-on: ubuntu-latest
  frontend:
    runs-on: ubuntu-latest
`
const ROWS = ['| `go` | the Go suite |', '| `frontend` | the frontend suite |']
const doc = (table) => `# Developing

The workflow is \`.github/workflows/ci.yml\`.

## Maintainer: CI

${table.join('\n')}

## After
`

let dir
afterEach(() => { if (dir) rmSync(dir, { recursive: true, force: true }) })

function check(table, { ci = CI } = {}) {
  dir = mkdtempSync(join(tmpdir(), 'doc-map-'))
  mkdirSync(join(dir, 'docs', 'wiki'), { recursive: true })
  mkdirSync(join(dir, '.github', 'workflows'), { recursive: true })
  writeFileSync(join(dir, 'docs', 'wiki', 'Developing.md'), doc(table))
  writeFileSync(join(dir, '.github', 'workflows', 'ci.yml'), ci)
  const r = spawnSync(process.execPath, [SCRIPT, '--root', dir], { encoding: 'utf8' })
  return { code: r.status, out: r.stdout + r.stderr }
}

describe('doc-map-check reading the CI table', () => {
  it('passes a table that names every job', () => {
    expect(check(['| Job | What |', '| --- | --- |', ...ROWS]).code).toBe(0)
  })

  it('takes a GFM delimiter row with or without its closing pipe, and with alignment colons', () => {
    for (const delim of ['| - | - |', '|:-:|:--|', '| --- | ---', '|---|---|']) {
      expect(check(['| Job | What |', delim, ...ROWS]).code, delim).toBe(0)
    }
  })

  it('reads the first table only, so a second one under the heading is prose', () => {
    expect(check(['| Job | What |', '| --- | --- |', ...ROWS, '', '| Other | table |', '|---|---|', '| not | a job |']).code).toBe(0)
  })

  it('blames the document, by line, for a row that is not a backticked job id', () => {
    const { code, out } = check(['| Job | What |', '| --- | --- |', ROWS[0], '| frontend | unticked |'])
    expect(code).toBe(1)
    expect(out).toMatch(/Developing\.md:10: a CI table row whose first cell is not one backticked job id/)
  })

  it('blames the document for a table with no delimiter row', () => {
    const { code, out } = check(['| Job | What |', ...ROWS])
    expect(code).toBe(1)
    expect(out).toMatch(/Developing\.md:7: the CI table has no delimiter row/)
  })

  it('names a job with no row, and a row for a job there is not', () => {
    const { code, out } = check(['| Job | What |', '| --- | --- |', ROWS[0], '| `gone` | removed |'])
    expect(code).toBe(1)
    expect(out).toMatch(/no row for ci\.yml's job `frontend`/)
    expect(out).toMatch(/a row for `gone`, which ci\.yml has no job called/)
  })

  it('says the extractor is broken, exit 2, only for what it could not read', () => {
    expect(check([]).code, 'no table under the heading').toBe(2)
    const odd = check(['| Job | What |', '| --- | --- |', ...ROWS], { ci: CI + '  "quoted":\n    runs-on: x\n' })
    expect(odd.code, 'a key under jobs: that is not a job id').toBe(2)
    expect(odd.out).toMatch(/a key under jobs: that is not a job id: "quoted":/)
  })
})
