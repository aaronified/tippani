import { useCallback, useEffect, useRef, useState } from 'react'
import { json } from './api.js'
import { t } from './i18n.js'
import { toast } from './ui.jsx'
import { announceJobs, isLive, listJobs, pressStop } from './jobs.js'
import { QUICK_MS, READ_MS, failToast, forgetFound, invalidateContext, sourceFail } from './sources.jsx'

// The library folders and their scans, for the two screens that show them: Checks > Found
// files (the proposals, to accept or refuse) and Metadata > Source files (every work and its
// file). One copy of the reads, the polling and the presses, so the two cannot drift.
//
// The server stores findings as it goes, so they appear while the scan runs and are still
// there after a restart. While a scan runs this polls its progress and reads the list again
// when the number found changes. Every request has a timeout, and every failure is said.

const POLL_MS = 1500

// THE LAST SCAN OF EACH FOLDER THAT ENDED BADLY, from the jobs list: the scan's own status
// says only that it did not finish, and the job row has the reason. Newest first, so the
// first job named for a folder is its last scan.
async function lastBadScans(list) {
  const r = await listJobs({ view: 'past', kind: 'library.scan', limit: 30 })
  if (!r.ok) return {}
  const out = {}
  for (const m of list) {
    const j = r.jobs.find((x) => x.own !== false && x.params?.mount_id === m.id)
    if (j && (j.state === 'failed' || j.state === 'interrupted')) out[m.id] = j
  }
  return out
}

// One proposal per work across folders. Exact beats review; otherwise the first stays.
function oneEach(list) {
  const seen = new Map()
  for (const c of list) {
    const key = `${c.subject}:${c.work_id}:${c.episode || ''}`
    const cur = seen.get(key)
    if (!cur || (cur.bucket !== 'exact' && c.bucket === 'exact')) seen.set(key, c)
  }
  return [...seen.values()]
}

export function useLibraryScan() {
  const [mounts, setMounts] = useState(null)
  const [found, setFound] = useState(null) // null: nothing scanned yet
  const [scans, setScans] = useState({}) // folder id -> the scan's status
  const [busy, setBusy] = useState(false)
  const [starting, setStarting] = useState(false) // a Scan press waiting for its answer
  const [loadError, setLoadError] = useState('')
  const [bad, setBad] = useState({}) // folder id -> its last scan's job, when it failed
  const [tries, setTries] = useState(0)
  const alive = useRef(true)
  const loadedCount = useRef({}) // folder id -> findings the list was last read with

  // Read every folder's findings and status.
  const load = useCallback(async (list) => {
    let all = []
    const next = {}
    let failed = ''
    for (const m of list) {
      const r = await json('GET', `/sources/found?mount_id=${encodeURIComponent(m.id)}`, undefined, { timeoutMs: QUICK_MS })
      if (!r.ok) {
        failed = sourceFail(r)
        continue
      }
      next[m.id] = r.data.scan
      loadedCount.current[m.id] = r.data.scan?.found || 0
      all = all.concat(r.data.candidates || [])
    }
    const lastBad = await lastBadScans(list)
    if (!alive.current) return
    setLoadError(failed ? t('found.error.load', { why: failed }) : '')
    setBad(lastBad)
    setScans(next)
    const any = Object.values(next).some((st) => st && st.state !== 'none')
    setFound(any || all.length ? oneEach(all) : null)
  }, [])

  useEffect(() => {
    alive.current = true
    json('GET', '/sources/mounts', undefined, { timeoutMs: QUICK_MS }).then((r) => {
      if (!alive.current) return
      // A failed read of the folder list is said, not taken for "no folders".
      if (!r.ok) {
        setLoadError(t('found.error.load', { why: sourceFail(r) }))
        setMounts([])
        return
      }
      const list = r.data.mounts || []
      setLoadError('')
      setMounts(list)
      if (list.length) load(list)
    })
    return () => {
      alive.current = false
    }
  }, [load, tries])

  const scanning = Object.values(scans).some(isLive)

  // While a scan runs, poll its progress. The list is read again when the count of findings
  // moves, and once more when the scan ends.
  useEffect(() => {
    if (!scanning || !mounts) return undefined
    const timer = setTimeout(async () => {
      let reload = false
      const next = { ...scans }
      for (const m of mounts) {
        if (!isLive(scans[m.id])) continue
        const r = await json('GET', `/sources/found?mount_id=${encodeURIComponent(m.id)}&status=1`, undefined, { timeoutMs: QUICK_MS })
        if (!r.ok) continue
        next[m.id] = r.data.scan
        if (!isLive(r.data.scan) || r.data.scan.found !== loadedCount.current[m.id]) reload = true
      }
      if (!alive.current) return
      if (reload) await load(mounts)
      else setScans(next)
    }, POLL_MS)
    return () => clearTimeout(timer)
  }, [scanning, scans, mounts, load])

  // EVERY START GETS AN ANSWER OR A TIMEOUT. The scan route answers at once (the walk is a
  // job), so a press that has heard nothing after QUICK_MS says so and gives the button back.
  async function scan() {
    // Nothing to scan is said, not done quietly (the phone's Scan shortcut lands here too).
    if (!(mounts || []).length) {
      toast(t('found.nofolders'))
      return
    }
    setStarting(true)
    let failed = ''
    for (const m of mounts || []) {
      const r = await json('POST', '/sources/scan', { mount_id: m.id }, { timeoutMs: QUICK_MS })
      if (!r.ok) failed = sourceFail(r, 'found.error.scan')
    }
    if (failed) failToast(failed, () => scan())
    announceJobs()
    forgetFound()
    if (alive.current) await load(mounts || [])
    if (alive.current) setStarting(false)
  }

  async function stop() {
    for (const st of Object.values(scans)) {
      if (!isLive(st) || !st.job_id) continue
      const r = await pressStop(st.job_id)
      if (!r.ok) toast(r.error || t('common.source.noanswer'))
    }
  }

  async function attach(bucket, list) {
    setBusy(true)
    const r = await json('POST', '/sources/attach-found', { bucket, tokens: list.map((c) => c.token) }, { timeoutMs: READ_MS })
    setBusy(false)
    if (!r.ok) {
      failToast(sourceFail(r), () => attach(bucket, list))
      return
    }
    const { attached = 0, skipped = 0, failed = 0, context = {} } = r.data
    const placed = (context.matched || 0) + (context.skipped || 0)
    const total = placed + (context.ambiguous || 0) + (context.unmatched || 0)
    const parts = []
    if (attached) parts.push(t('found.attached', { n: attached, count: attached, found: placed, total }))
    if (failed) parts.push(t('found.failed', { n: failed, count: failed }))
    if (skipped) parts.push(t('found.skipped', { n: skipped, count: skipped }))
    if (parts.length) toast(parts.join(' · '))
    // ONLY THE ONES THAT ATTACHED GO. The server names them; the rest stay, to be retried or
    // refused, rather than vanishing with a count. Times proposed from the new files are now
    // waiting in the section below, and every card may now have context.
    const done = new Set(r.data.done || [])
    setFound((cur) => (cur || []).filter((c) => !done.has(c.token)))
    invalidateContext()
  }

  async function refuse(list) {
    setBusy(true)
    const r = await json('POST', '/sources/ignore-found', { tokens: list.map((c) => c.token) }, { timeoutMs: QUICK_MS })
    setBusy(false)
    if (!r.ok) toast(sourceFail(r))
    if (r.ok) {
      forgetFound()
      const gone = new Set(list.map((c) => c.token))
      setFound((cur) => (cur || []).filter((c) => !gone.has(c.token)))
    }
  }

  const retry = () => setTries((n) => n + 1)
  const badLines = Object.entries(bad)
    .filter(([id]) => !isLive(scans[id]))
    .map(([id, j]) => {
      const folder = (mounts || []).find((m) => m.id === id)?.label || id
      return j.state === 'failed'
        ? t('found.last.failed', { folder, error: j.error || t('common.source.failed.generic') })
        : t('found.last.interrupted', { folder })
    })
  const sum = (key) => Object.values(scans).reduce((n, st) => n + (st?.[key] || 0), 0)
  return { mounts, found, scans, scanning, starting, busy, loadError, badLines, sum, scan, stop, attach, refuse, retry, reload: () => load(mounts || []) }
}
