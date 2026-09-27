// A SERVER THAT FOLDS FETCHED LINKS INTO A RECORD PROVES IT KEEPS THE READER'S NAMES.
//
// WHY A BROWSER-SIDE RULE READS GO. Until 3.1.0 the fold that merges a fetch's
// links into a person's stored field was `mergeLinks` in people.jsx, and
// link-names.test.js held the two cases that matter about it: a fetch leaves the
// names a reader gave their links alone (`https://… | The other one`), and a link
// nobody named stays unnamed rather than gaining an empty name. The People row's
// Fetch (`POST /people/id/{id}/fetch`) and the `people` job moved the fold to the
// server, the browser copy went — and the two cases went with it, to a Go test
// that did not exist yet.
//
// THE OBVIOUS GO FOLD DESTROYED NAMES. `mergePersonLinks`, re-verify's fold until
// merge_links.go replaced it, split the field on whitespace, so
// `https://…/nm0000123/ | The other one` came back as five "links": the URL, `|`,
// `The`, `other`, `one`. A fold of that shape erases every name on every fetched
// record, silently and for good — and with the browser's cases gone, nothing in
// the repository would fail.
//
// SO THIS HOLDS THE OBLIGATION OPEN ACROSS THE BOUNDARY, the way
// bulk-wire-shape.test.js holds the bulk editor's wire to the Go struct: the day
// server.go routes the People row's Fetch, or jobs_kinds.go (the file the spec
// names for the kinds' validation) registers the `people` job, the Go test
// `TestMergeLinksKeepsTheReadersNames` has to be in
// internal/httpapi/merge_links_test.go, carrying both cases. Both have been served
// since 3.1.0, so the test must stay; a tree that served neither would have no
// server fold to guard, and the rule would say so rather than invent one.
//
// NAMED FILES, NOT A WALK: one-walk.test.js holds every directory read in this
// suite to the shared walk over src/, which cannot see the Go tree. Every route is
// registered in server.go, so the anchor cannot hide in another file; the test's
// file is named here and in the backend's handoff, and a move is one line.
//
// WHAT A TEST WRITER NEEDS TO KNOW: `obligation(files)` is the whole rule over a
// map of file name → contents (absent files simply absent), so the two synthetic
// cases below show it bites without touching the Go tree; the last case runs it
// over the real one.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { SRC } from '../src-files.js'

const HTTPAPI = join(SRC, '..', '..', '..', 'internal', 'httpapi')
const READ = ['server.go', 'jobs_kinds.go', 'merge_links_test.go']

// The two anchors that say the server folds links: the row's in-request Fetch, and
// the job that loops the same function. Either alone is enough.
const SERVES_FETCH = /"POST \/people\/id\/\{id\}\/fetch"/
const REGISTERS_PEOPLE_JOB = /Name:\s*"people"/
const TEST_NAME = /func TestMergeLinksKeepsTheReadersNames\(/

// The two cases, by the strings only they carry: the named link that has to keep
// its name, and the unnamed one that has to stay bare.
const NAMED_CASE = /\| The other one/
const UNNAMED_CASE = /example\.org\/essays/

function obligation(files) {
  const folds = SERVES_FETCH.test(files['server.go'] || '') || REGISTERS_PEOPLE_JOB.test(files['jobs_kinds.go'] || '')
  if (!folds) return { folds: false, missing: [] }
  const home = files['merge_links_test.go'] || ''
  const missing = []
  if (!TEST_NAME.test(home)) missing.push('TestMergeLinksKeepsTheReadersNames in merge_links_test.go')
  else {
    if (!NAMED_CASE.test(home)) missing.push('the case where a named link keeps its name (“| The other one”)')
    if (!UNNAMED_CASE.test(home)) missing.push('the case where an unnamed link stays unnamed')
  }
  return { folds: true, missing }
}

const realTree = () => {
  const out = {}
  for (const name of READ) {
    const full = join(HTTPAPI, name)
    if (existsSync(full)) out[name] = readFileSync(full, 'utf8')
  }
  return out
}

describe('the server’s link fold keeps the names a reader gave their links', () => {
  it('asks for the Go test the moment the People row’s Fetch is served', () => {
    const r = obligation({
      'server.go': 'mux.Handle("POST /people/id/{id}/fetch", s.requireAuth(s.handlePersonFetch))',
      'reverify_handlers.go': 'func mergePersonLinks(stored string, fetched map[string]string) string {',
    })
    expect(r).toEqual({ folds: true, missing: ['TestMergeLinksKeepsTheReadersNames in merge_links_test.go'] })
  })

  it('and for both of its cases, not just its name', () => {
    const r = obligation({
      'jobs_kinds.go': 'r.Register(jobs.Kind{Name:       "people", Run: s.runPeople})',
      'merge_links_test.go': 'func TestMergeLinksKeepsTheReadersNames(t *testing.T) { stored := "https://www.imdb.com/name/nm0000123/ | The other one" }',
    })
    expect(r.missing).toEqual(['the case where an unnamed link stays unnamed'])
  })

  it('holds over internal/httpapi as it stands', () => {
    const files = realTree()
    // A read that found nothing would pass everything (see src-files.js): the
    // route table has to be there, and has to be the route table.
    expect((files['server.go'] || '').match(/mux\.Handle\(/g)?.length || 0, 'server.go was not read, or holds no routes').toBeGreaterThan(100)
    const r = obligation(files)
    expect(r.missing, r.folds
      ? 'internal/httpapi folds fetched links into a person but has no Go test proving a link keeps its name — a fold that splits the field on whitespace erases every one'
      : '').toEqual([])
  })
})
