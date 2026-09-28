// The demo shim answers Settings › Jobs in the server's shapes (3.1.0).
//
// The published demo has no server, so every route the Jobs screen reads is
// answered from src/demo/install.js — and the shim's own header records how a
// shape that is close but not identical goes wrong: the screen reads a field that
// is not there and either throws or shows an empty card that looks like a working
// app. The shapes below are the jobs wire contract's, field for field.
//
// DECLARED EXCEPTION, shared with demo-quotes.test.js: this calls the shim's
// exported `route` directly. The claim is about the stand-in for a server, and
// the only observable of a stand-in is what it answers.

import { describe, expect, it } from 'vitest'
import { route } from '../../src/demo/install.js'

const get = (path, qs = '') => route('GET', path, new URLSearchParams(qs), null)
const post = (path, body = null) => route('POST', path, new URLSearchParams(), body)

// Every field a job carries on the wire, and nothing renamed.
const JOB_FIELDS = [
  'id', 'kind', 'queued', 'subject', 'state', 'params', 'counts', 'error', 'total', 'done',
  'ahead', 'username', 'own', 'rerunnable', 'applied', 'rerun_of', 'from_job',
  'created_at', 'started_at', 'finished_at',
]

describe('GET /jobs', () => {
  it('answers the current view with an empty queue in the full envelope', () => {
    const [status, body] = get('/jobs', 'view=current')
    expect(status).toBe(200)
    expect(body).toEqual({ jobs: [], running: 0, waiting: 0, more: false })
  })

  it('answers the past view with jobs that carry every field, times in unix ms', () => {
    const [status, body] = get('/jobs', 'view=past')
    expect(status).toBe(200)
    expect(body.jobs.length).toBeGreaterThan(0)
    for (const job of body.jobs) {
      expect(Object.keys(job).sort()).toEqual([...JOB_FIELDS].sort())
      expect(typeof job.created_at).toBe('number')
    }
  })

  it('narrows the past view by state', () => {
    const [, body] = get('/jobs', 'view=past&state=interrupted')
    expect(body.jobs.length).toBeGreaterThan(0)
    expect(body.jobs.every((j) => j.state === 'interrupted')).toBe(true)
  })
})

describe('one job', () => {
  it('answers a poll with the job, its lines after the one asked for, and `more`', () => {
    const [, list] = get('/jobs', 'view=past')
    const id = list.jobs.find((j) => j.kind === 'fill').id
    const [status, body] = get(`/jobs/${id}`, 'log_after=0')
    expect(status).toBe(200)
    expect(body.job.id).toBe(id)
    expect(body.more).toBe(false)
    expect(body.lines.length).toBeGreaterThan(1)
    for (const l of body.lines) expect(Object.keys(l).sort()).toEqual(['at', 'id', 'level', 'line'])
    const [, later] = get(`/jobs/${id}`, `log_after=${body.lines[0].id}`)
    expect(later.lines).toHaveLength(body.lines.length - 1)
  })

  it('answers a result as {kind, result}', () => {
    const [, list] = get('/jobs', 'view=past')
    const [status, body] = get(`/jobs/${list.jobs[0].id}/result`)
    expect(status).toBe(200)
    expect(Object.keys(body).sort()).toEqual(['kind', 'result'])
  })

  it('says a job it never had is not found', () => {
    expect(get('/jobs/9999')[0]).toBe(404)
  })
})

describe('the summary and the system log', () => {
  it('answers the summary the tile and the restore prompt read', () => {
    expect(get('/jobs/summary')).toEqual([200, { running: null, waiting: 0 }])
  })

  it('answers the system log as lines with a level and a code, narrowed by level', () => {
    const [status, body] = get('/admin/logs', 'level=error,warn,info,request&since=3600000')
    expect(status).toBe(200)
    expect(Object.keys(body).sort()).toEqual(['from', 'lines', 'more', 'upto'])
    expect(body.more).toBe(false)
    // The window read, which the screen sends back for its next page and export.
    expect(typeof body.from).toBe('number')
    expect(body.upto).toBeGreaterThanOrEqual(Math.max(...body.lines.map((l) => l.id)))
    for (const l of body.lines) {
      expect(Object.keys(l).sort()).toEqual(['at', 'code', 'id', 'level', 'line'])
      expect(['error', 'warn', 'info', 'request']).toContain(l.level)
    }
    const [, files] = get('/admin/logs', 'level=asset')
    expect(files.lines.every((l) => l.level === 'asset')).toBe(true)
  })
})

describe('GET /jobs/common', () => {
  const ROW_FIELDS = ['admin_only', 'current', 'id', 'kind', 'last', 'params']

  it('answers the four rows an admin may run, in the server’s order, each in the full row shape', () => {
    const [status, body] = get('/jobs/common')
    expect(status).toBe(200)
    expect(body.jobs.map((r) => [r.id, r.kind, r.admin_only])).toEqual([
      ['fill-all', 'fill', false],
      ['people-missing', 'people', false],
      ['covers', 'covers', true],
      ['backup', 'backup', true],
    ])
    expect(body.jobs.map((r) => r.params)).toEqual([{ all: true }, { missing: true }, { missing_only: false }, {}])
    for (const row of body.jobs) {
      expect(Object.keys(row).sort()).toEqual(ROW_FIELDS)
      // Nothing runs in a demo, so nothing is ever current.
      expect(row.current).toBeNull()
      if (row.last) expect(Object.keys(row.last).sort()).toEqual([...JOB_FIELDS].sort())
    }
    // The fixture's interrupted cover fetch is the covers row's last run; its fill
    // of a selection is no row's.
    expect(body.jobs.find((r) => r.id === 'covers').last.state).toBe('interrupted')
  })

  it('makes a Run pressed in the demo its row’s last run, and keeps no credential', () => {
    const [, started] = post('/jobs', { kind: 'fill', params: { all: true } })
    post('/jobs', { kind: 'fill', params: { book_ids: [1] } })
    const [, backup] = post('/jobs', { kind: 'backup', params: { password: 'the reader’s own' } })
    const [, body] = get('/jobs/common')
    const row = (id) => body.jobs.find((r) => r.id === id)
    expect(row('fill-all').last.id).toBe(started.job.id)
    expect(row('fill-all').last.state).toBe('failed')
    expect(row('backup').last.id).toBe(backup.job.id)
    expect(JSON.stringify(body)).not.toContain('the reader’s own')
  })
})

describe('the writes a read-only demo still answers', () => {
  it('answers a started job as the server does — 202 and the job — and keeps it for the poll', () => {
    const [status, body] = post('/jobs', { kind: 'fill', params: { book_ids: [1] } })
    expect(status).toBe(202)
    expect(Object.keys(body.job).sort()).toEqual([...JOB_FIELDS].sort())
    expect(body.job.kind).toBe('fill')
    // Nothing can run in a demo, and the job says why rather than pretending.
    expect(body.job.state).toBe('failed')
    expect(body.job.error).toMatch(/read-only demo/)
    const [again, polled] = get(`/jobs/${body.job.id}`, 'log_after=0')
    expect(again).toBe(200)
    expect(polled.job.id).toBe(body.job.id)
  })

  it('answers Stop all with nothing stopped', () => {
    expect(post('/jobs/stop-all')).toEqual([200, { stopping: 0, stopped_waiting: 0 }])
  })

  it('answers a work page’s cast art and a person’s fetch in their shapes', () => {
    expect(post('/books/1/cast/art', { names: ['A. Whitfield'] })).toEqual([200, { character_images: 0, portraits: 0 }])
    expect(post('/movies/1/cast/art', { names: [] })).toEqual([200, { character_images: 0, portraits: 0 }])
    const [status, body] = post('/people/id/1/fetch')
    expect(status).toBe(200)
    expect(Object.keys(body).sort()).toEqual(['links', 'person'])
    expect(body.person.id).toBe(1)
  })
})
