// A JOB DOWNSTREAM OF ONE THAT CAN BE SKIPPED SAYS WHAT IT DOES WHEN THAT HAPPENS.
//
// THE DEFECT. A job's `if` with no status function gets an implicit success(),
// and success() is false when any job it needs, directly or not, was skipped. So
// giving a job an ancestor that has its own `if` silently skips it whenever that
// ancestor is skipped. f4c05af2 did exactly that: it put `needs: label` on the
// roadmap's render job, and the publish job below it, whose `if` named no status
// function, stopped running on every push and dispatch, with nothing red. A rater
// caught it before it shipped, and nothing would have caught it again.
//
// THE RULE: in every workflow, a job with an ancestor (through `needs`) that has
// its own `if` must itself have an `if` naming success(), failure(), always() or
// cancelled(), so the decision about a skipped ancestor is written down.
//
// WHAT IT KNOWS, declared: the text of .github/workflows/*.yml, read by
// indentation (jobs at two spaces, their keys at four), because no YAML parser is
// installed here and a workflow is not something a person can press. It refuses a
// `needs:` it cannot read rather than passing it.

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const DIR = join(process.env.TIPPANI_SRC, '..', '..', '..', '.github', 'workflows')

function jobsOf(text) {
  const block = (text.split(/^jobs:\s*$/m)[1] ?? '').split(/^[^\s#]/m)[0]
  const jobs = {}
  let cur = null
  let inNeeds = false
  for (const line of block.split('\n')) {
    const job = /^ {2}([A-Za-z_][\w-]*):\s*(#.*)?$/.exec(line)
    if (job) { cur = jobs[job[1]] = { needs: [], if: null }; inNeeds = false; continue }
    if (!cur) continue
    const key = /^ {4}([\w-]+):\s*(.*)$/.exec(line)
    if (key) {
      inNeeds = false
      if (key[1] === 'if') cur.if = key[2]
      if (key[1] === 'needs') {
        const v = key[2].replace(/#.*/, '').trim()
        if (!v) inNeeds = true
        else if (v.startsWith('[')) cur.needs = v.replace(/[[\]]/g, '').split(',').map((s) => s.trim()).filter(Boolean)
        else if (/^[\w-]+$/.test(v)) cur.needs = [v]
        else throw new Error(`a needs: this test cannot read: ${line}`)
      }
      continue
    }
    if (inNeeds) {
      const item = /^ {6}- ([\w-]+)\s*$/.exec(line)
      if (item) cur.needs.push(item[1])
      else if (line.trim()) inNeeds = false
    }
  }
  return jobs
}

const ancestors = (jobs, name, seen = new Set()) => {
  for (const n of jobs[name]?.needs ?? []) {
    if (!seen.has(n)) { seen.add(n); ancestors(jobs, n, seen) }
  }
  return seen
}

const STATUS = /\b(success|failure|always|cancelled)\(\)/
const files = readdirSync(DIR).filter((f) => f.endsWith('.yml'))

describe('workflow jobs downstream of a skippable job', () => {
  it('each name a status function in their if', () => {
    let chains = 0
    const silent = []
    for (const f of files) {
      const jobs = jobsOf(readFileSync(join(DIR, f), 'utf8'))
      for (const [name, job] of Object.entries(jobs)) {
        const skippable = [...ancestors(jobs, name)].filter((a) => jobs[a]?.if)
        if (!skippable.length) continue
        chains++
        if (!STATUS.test(job.if ?? '')) silent.push(`${f}: ${name} (needs ${skippable.join(', ')}, which can be skipped)`)
      }
    }
    expect(chains, 'no workflow has a job downstream of a skippable one; the reader has gone stale').toBeGreaterThan(0)
    expect(silent, 'these jobs are skipped whenever an ancestor is, with nothing saying so').toEqual([])
  })
})
