// A SMALL JOBS SERVER, for the screens that start a job and wait for its end.
//
// WHY ONE FILE. Fill gaps, the covers fetch, the people fetch, re-verify and the
// backup all moved onto the server's queue in 3.1.0, and each of their tests has
// to fake the same five routes in the same shapes — the start, the poll, the
// current view, the result and a stop. Five hand-written copies of one contract
// is how one of them drifts from the others and goes on passing against a
// server that does not exist. This is the one copy, spelled to the wire contract
// (the spec's D0) the way src/jobs.js is on the app's side.
//
// DECLARED EXCEPTION, the one every network-faking test here makes: this file
// knows the paths and the JSON field names the jobs routes answer with, because
// a fake server has to answer in the server's shapes. What a test built on it
// READS BACK is only what the screen showed and what a request said.
//
// HOW A TEST USES IT. `const jobs = jobsServer()`, then inside the `json` mock:
// `const a = jobs.answer(method, path, body); if (a) return a`. By default a job
// finishes the moment it is started (offline, a small job does); `hold(kind)`
// keeps the next job of that kind running until `finish(id, …)` is called, and
// `plan(kind, {counts, result, state, error})` says how the next one ends —
// called twice, the next two, in order (a set over one job's cap is several jobs;
// a held job uses up its plan too, since `finish` says how it ends).

const NOW = () => Date.now()

export function jobsServer({ own = true } = {}) {
  const jobs = new Map() // id → job
  const results = new Map() // id → result
  const plans = new Map() // kind → how the next jobs of it end, in order
  const held = new Set() // kinds whose next job stays running
  const refusals = [] // the next POST /jobs answers, in order: [status, data, starts to let through first]
  const calls = [] // every request this server answered: [method, path, body]
  let next = 100

  const job = (over) => ({
    id: 0, kind: 'fill', queued: true, subject: '', state: 'queued', params: {}, counts: {},
    error: '', total: 0, done: 0, ahead: 0, username: '', own, rerunnable: false, applied: false,
    rerun_of: null, from_job: null, created_at: NOW(), started_at: null, finished_at: null,
    ...over,
  })

  function add(over) {
    const j = job({ id: next++, ...over })
    jobs.set(j.id, j)
    if ('result' in over) results.set(j.id, over.result)
    return j
  }

  function finish(id, { state = 'succeeded', counts, result, error = '', done } = {}) {
    const j = jobs.get(id)
    if (!j) throw new Error(`no job ${id}`)
    Object.assign(j, {
      state,
      error,
      counts: counts || j.counts,
      done: done ?? j.total,
      started_at: j.started_at || NOW(),
      finished_at: NOW(),
    })
    if (result !== undefined) results.set(id, result)
    return j
  }

  function start(kind, params) {
    const plan = (plans.get(kind) || []).shift() || {}
    const total = plan.total ?? (params?.book_ids?.length || 0) + (params?.movie_ids?.length || 0) +
      (params?.ids?.length || 0) + (params?.people?.length || 0) + (params?.items?.length || 0)
    const j = add({ kind, params, total, state: plan.queued ? 'queued' : 'running', ahead: plan.ahead || 0, started_at: NOW(), from_job: params?.from_job ?? null })
    if (held.has(kind)) {
      held.delete(kind)
      return j
    }
    return finish(j.id, plan)
  }

  const ok = (data, status = 200) => ({ ok: true, status, data })

  function answer(method, path, body) {
    const [p, qs = ''] = String(path).split('?')
    const q = new URLSearchParams(qs)
    let a = null
    if (method === 'POST' && p === '/jobs') {
      if (refusals.length && refusals[0][2] > 0) {
        refusals[0][2] -= 1
        a = ok({ job: { ...start(body.kind, body.params) } }, 202)
      } else if (refusals.length) {
        const [status, data] = refusals.shift()
        a = { ok: false, status, data }
      } else {
        a = ok({ job: { ...start(body.kind, body.params) } }, 202)
      }
    } else if (method === 'GET' && p === '/jobs') {
      const live = (j) => j.state === 'queued' || j.state === 'running'
      const kind = q.get('kind')
      const current = q.get('view') === 'current'
      const list = [...jobs.values()].filter((j) => (current ? live(j) : !live(j)) && (!kind || j.kind === kind))
      a = ok({
        jobs: list.map((j) => ({ ...j })),
        running: list.filter((j) => j.state === 'running').length,
        waiting: list.filter((j) => j.state === 'queued').length,
        more: false,
      })
    } else if (method === 'GET' && p === '/jobs/summary') {
      const all = [...jobs.values()]
      const running = all.find((j) => j.state === 'running') || null
      a = ok({ running: running && { ...running }, waiting: all.filter((j) => j.state === 'queued').length })
    } else {
      const one = /^\/jobs\/(\d+)(\/result|\/stop)?$/.exec(p)
      const j = one && jobs.get(Number(one[1]))
      if (one && !j) a = { ok: false, status: 404, data: { error: 'job not found' } }
      else if (one && method === 'GET' && !one[2]) a = ok({ job: { ...j }, lines: [], more: false })
      else if (one && method === 'GET' && one[2] === '/result') a = ok({ kind: j.kind, result: results.has(j.id) ? results.get(j.id) : null })
      else if (one && method === 'POST' && one[2] === '/stop') {
        if (j.state === 'queued') finish(j.id, { state: 'stopped' })
        a = ok({ job: { ...j } })
      }
    }
    if (a) calls.push([method, path, body])
    return a
  }

  return {
    answer,
    add,
    finish,
    calls,
    jobs,
    // The jobs started through POST /jobs, oldest first: [kind, params].
    started: () => calls.filter(([m, p]) => m === 'POST' && p === '/jobs').map(([, , b]) => [b.kind, b.params]),
    stops: () => calls.filter(([m, p]) => m === 'POST' && /^\/jobs\/\d+\/stop$/.test(p)).map(([, p]) => Number(p.split('/')[2])),
    hold: (kind) => held.add(kind),
    plan: (kind, how) => plans.set(kind, [...(plans.get(kind) || []), how]),
    // `after` lets that many starts through first — the second piece of a big set
    // refused while the first runs.
    refuse: (status, data, { after = 0 } = {}) => refusals.push([status, data, after]),
  }
}
