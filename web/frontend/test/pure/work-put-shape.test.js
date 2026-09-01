// Every full-state PUT for a work starts from the record, not from a list of
// the boxes some form happens to draw.
//
// THE DEFECT THIS EXISTS FOR was live at three sites at once and cost the most at
// the least obvious one. PUT /books/:id and PUT /movies/:id are full-state: a
// field the body does not name is a field the request CLEARS. Three call sites
// hand-wrote their body as an object literal listing the form's own inputs — a
// list that has never been the same list as the one the server writes — so:
//
//   * saving a book from the Library's Edit form cleared both languages (0047
//     added them, no client had ever sent them);
//   * saving a film cleared its IMDb id;
//   * and applying a metadata match on the Metadata screen cleared the
//     translator, the editor, both languages and the circa flag. That one could
//     not be undone: store.SetCredits DELETEs every work_person row for a role
//     before re-inserting, and an absent translator is zero names — so the link
//     went and `credit_as`, the per-work spelling of the name, went with it.
//
// full-state-put.test.js watches the three BUILDERS. It cannot see a body that
// never calls one, which is exactly what all three of these were. So this reads
// the source and requires the shape instead: the body opens with a spread, and
// the form's own fields override on top of it. A fourth site written the old way
// fails here on the day it is written.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = process.env.TIPPANI_SRC || join(process.cwd(), 'src')

// The work PUTs, and only those. `/books/:id/status` is its own endpoint with its
// own small body — the shelf and the read log deliberately cannot be touched by a
// full-state save — so it is not one of these.
const CALL = /json\(\s*'PUT'\s*,\s*`\/(books|movies)\/\$\{[^`]*\}`\s*,\s*/g

// Reads the object literal that starts at `i`, balancing braces so a nested
// object in the body cannot end the scan early.
function objectAt(text, i) {
  let depth = 0
  for (let j = i; j < text.length; j++) {
    if (text[j] === '{') depth++
    else if (text[j] === '}' && --depth === 0) return text.slice(i, j + 1)
  }
  return text.slice(i)
}

// The body an argument stands for.
//
// A BODY PASSED BY NAME IS STILL A BODY, and the first version of this file did
// not follow one — which left the hole exactly where the worst site was.
// MetadataPage's apply builds `const base = {...}` and then passes `base`, so a
// rule that only read literals reported it clean while it was destroying
// translator credits. An identifier is resolved back to its `const <name> = {`
// in the same file.
function bodyAt(text, i, all) {
  if (text[i] === '{') return { kind: 'literal', body: objectAt(text, i) }
  const call = (text.slice(i).match(/^([A-Za-z_$][\w$]*)\s*\(/) || [])[1]
  if (call) {
    // A builder called by name: AddSurface passes sourceRef(c, mediaType), whose
    // whole body is the object. Resolved across files, because the caller and the
    // builder rarely live together.
    const def = all.match(new RegExp(`function ${call}\\b[^)]*\\)\\s*\\{\\s*return\\s*\\{`))
    if (def) {
      return { kind: 'named', name: call, body: objectAt(all, all.indexOf('{', def.index + def[0].length - 2)) }
    }
    return { kind: 'call', body: `${call}(…)` }
  }
  const name = (text.slice(i).match(/^([A-Za-z_$][\w$]*)\s*[),]/) || [])[1]
  if (!name) return { kind: 'other', body: text.slice(i, i + 80) }
  const decl = text.slice(0, i).lastIndexOf(`const ${name} = {`)
  if (decl === -1) return { kind: 'unresolved', body: name }
  return { kind: 'named', name, body: objectAt(text, text.indexOf('{', decl)) }
}

function sites() {
  const files = readdirSync(SRC).filter((n) => n.endsWith('.jsx')).sort()
  // One concatenated copy, so a builder called from another file still resolves.
  const all = files.map((f) => readFileSync(join(SRC, f), 'utf8')).join('\n')
  const found = []
  for (const f of files) {
    const text = readFileSync(join(SRC, f), 'utf8')
    for (const m of text.matchAll(CALL)) {
      const at = m.index + m[0].length
      if (/\/status`/.test(m[0])) continue
      const { kind, body, name } = bodyAt(text, at, all)
      found.push({
        file: f,
        line: text.slice(0, at).split('\n').length,
        work: m[1],
        kind,
        name,
        body,
      })
    }
  }
  return found
}

// A MOVIE body carrying source + source_id never reaches the UPDATE at all:
// handleUpdateMovie short-circuits it to resyncMovieFromSource before validation
// (internal/httpapi/movie_handlers.go). These are re-sync verbs wearing a PUT's
// clothes, and making them full-state would be a change for the worse.
//
// A BOOK BODY WITH THE SAME TWO KEYS IS NOT EXEMPT, and the first version of this
// file got that wrong in the one place it mattered. handleUpdateBook has no such
// short-circuit — it handles `source` inside the ordinary update path
// (internal/httpapi/book_handlers.go), so the full UPDATE still runs. Metadata's
// "apply this match" sends both keys to clear the no-source gap AND is entirely
// full-state, which is exactly why it was destroying translator credits; an
// exemption keyed on the keys alone excused the worst site in the app.
// The two argument shapes this file can actually read. Anything else is caught
// by its own assertion below rather than silently skipped.
const READ = ['literal', 'named']

const isResync = (site) =>
  site.work === 'movies' && /\bsource_id\s*:/.test(site.body) && /\bsource\s*:/.test(site.body)

// The comment lines a body may open with before its first real entry.
const firstEntry = (body) =>
  body
    .slice(1)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('//'))[0] || ''

describe('a work PUT is built from the record', () => {
  const all = sites()

  it('finds the call sites at all', () => {
    // The anchor. If the pattern stops matching, every assertion below passes
    // about an empty list — which is the shape of a ratchet that has quietly
    // stopped ratcheting.
    expect(all.length, 'no work PUTs found — has the call shape changed?').toBeGreaterThanOrEqual(6)
    expect(all.some((s) => s.file === 'MetadataPage.jsx')).toBe(true)
    expect(all.some((s) => s.file === 'Library.jsx')).toBe(true)
    expect(all.some((s) => s.file === 'Movies.jsx')).toBe(true)
  })

  it('opens every full-state body with a spread of the record', () => {
    const bad = all
      .filter((s) => READ.includes(s.kind) && !isResync(s))
      .filter((s) => !firstEntry(s.body).startsWith('...'))
      .map((s) => `${s.file}:${s.line} begins "${firstEntry(s.body).slice(0, 48)}"`)
    expect(
      bad,
      'these bodies list a form’s own boxes instead of starting from the record, so every\n' +
        'field they do not mention is cleared on save. Spread bookState / movieState /\n' +
        'fullState first and let the form override on top:',
    ).toEqual([])
  })

  it('and the spread names a builder, not just any object', () => {
    // `{ ...base, cover_url }` is legitimate — `base` is itself built from a
    // builder a few lines up — so a spread of a local is allowed. What is not
    // allowed is a body whose ONLY spread is of something with a form-shaped
    // name, which is how this defect would come back wearing a spread.
    const suspicious = all
      .filter((s) => READ.includes(s.kind) && !isResync(s))
      .filter((s) => /^\.\.\.(form|fields|values|draft|input)\b/.test(firstEntry(s.body)))
      .map((s) => `${s.file}:${s.line}`)
    expect(suspicious, 'a body spread from the form is the same defect with a spread on it').toEqual([])
  })

  // A body this file cannot read is a body it cannot vouch for, and a rule that
  // silently skips what it does not understand is worse than no rule.
  it('can read every body it is asked about', () => {
    const opaque = all.filter((s) => !READ.includes(s.kind)).map((s) => `${s.file}:${s.line} (${s.kind}: ${s.body.slice(0, 40)})`)
    expect(opaque, 'this check cannot see these bodies — teach bodyAt their shape').toEqual([])
  })

  it('leaves the re-sync verbs alone', () => {
    // Named rather than merely excluded: someone widening this rule would
    // reasonably "fix" them, and making them full-state would send a title-less
    // body down a path that never validates one.
    const resyncs = all.filter((s) => READ.includes(s.kind) && isResync(s))
    expect(resyncs.length, 'the re-sync bodies have gone — check they were not made full-state').toBeGreaterThanOrEqual(3)
  })
})
