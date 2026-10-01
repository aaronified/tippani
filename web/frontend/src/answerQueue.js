// THE QUIZ'S ANSWERS, KEPT ON THIS DEVICE UNTIL THE SERVER HAS THEM.
//
// A grade used to be one POST, sent when the reader answered and forgotten if it
// failed: Next moved on, the server never heard, and the card came back after a
// refresh. The owner, 1 October: "4 registered. 1 didn't. Now on page refresh,
// that will come back." And, of the "saving…" beside Next: "can the whole quiz be
// recorded before syncing if sync takes a long time? That way the sync will not
// even be visible to users … make sure that the sync keeps on retrying."
//
// So an answer is written here first, in this browser's storage, and the screen
// moves on at once. A sender posts the kept answers in the order they were given,
// one at a time, and keeps one until the server has taken it: a failure to reach
// the server, or a 5xx, waits and tries again (2 s, doubling, at most a minute),
// and so does coming back online or back to the tab. A refusal that will never
// change (a 4xx: the quote was deleted, or the answer is not one the server can
// take) drops the answer, because sending it again would be refused again.
//
// EACH ANSWER CARRIES ITS OWN ID AND HOW LONG AGO IT WAS GIVEN. A reply lost after
// the server wrote means the next attempt arrives a second time, and the id makes
// that an echo (migration 0080). An answer sent the next morning belongs to the
// day it was given, for the streak and the schedule both, so its age travels too.
//
// NOTHING RUNS WHILE THE APP IS CLOSED. A web page cannot, and iOS has no
// background sync, so a kept answer goes out the next time the app is open.
//
// PER READER: the queue is keyed by the signed-in reader, and only theirs is sent
// while they are signed in. Another reader's kept answers wait for them; signing
// out never throws an answer away.

import { useEffect, useState } from 'react'

import { json } from './api.js'

const KEY = (uid) => `tippani:answers:${uid}`
const FIRST_WAIT = 2000
const LONGEST_WAIT = 60000

let owner = null
// THE ANSWERS THIS PAGE HAS HANDED TO THE SERVER, for as long as it is open. A
// screen whose fetch was answered before one of these reached the server holds a
// reply that does not know about it: the Daily deck asked for while the app was
// starting can arrive after the first kept answer has gone out, and would still
// hold that answer's card. Kept or sent, the screen can see both.
const sentHere = []
let sending = false
let timer = null
let wait = 0
// Where storage cannot be written — a private window, a full quota — the answers
// are kept here, for as long as the page is open, which is the most there is.
// ONLY THEN: a reader whose storage works is read from storage alone, because
// another tab that sent the last answer removed the key, and a copy here would
// bring those answers back.
const memory = new Map()
const listeners = new Set()
// The outcome of each answer's first attempt, for the one screen that waits on
// it: a cloze card, which the server grades.
const firsts = new Map()

function read(uid) {
  if (!memory.has(uid)) {
    try {
      const raw = globalThis.localStorage?.getItem(KEY(uid))
      return raw == null ? [] : JSON.parse(raw) || []
    } catch {
      // unreadable storage: nothing this page can recover
    }
  }
  return memory.get(uid) || []
}

function write(uid, list) {
  try {
    if (list.length) globalThis.localStorage.setItem(KEY(uid), JSON.stringify(list))
    else globalThis.localStorage.removeItem(KEY(uid))
    memory.delete(uid)
  } catch {
    memory.set(uid, list)
  }
}

function emit(event) {
  for (const fn of listeners) {
    try { fn(event) } catch { /* one listener's fault is not the queue's */ }
  }
}

function settleFirst(id, data) {
  const resolve = firsts.get(id)
  if (resolve) {
    firsts.delete(id)
    resolve(data)
  }
}

const newId = () =>
  globalThis.crypto?.randomUUID?.() || `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`

function body(e) {
  return {
    kind: e.kind,
    id: e.id,
    result: e.result,
    mode: e.mode,
    offset: e.offset,
    client_id: e.key,
    // HOW LONG AGO, not when: the server takes the moment from its own clock, so a
    // phone whose clock is wrong still files the answer on the right day.
    answered_ago_ms: Math.max(0, Date.now() - e.t),
    ...(e.attempt != null ? { attempt: e.attempt } : {}),
  }
}

// NOT LET IN, which is not a refusal of the answer: 401 is a reader signed out, and
// 403 is the gate in front of an account whose password an admin chose ("choose
// your own password first", server.go) — this app never answers 403 for a row,
// another reader's is a 404. Either way the answer waits for its reader.
const notLetIn = (status) => status === 401 || status === 403

// A refusal sending again cannot change. Not one: being let in (above), 408 and
// 429 (come back later).
const refusedForGood = (status) => status >= 400 && status < 500 && !notLetIn(status) && status !== 408 && status !== 429

async function drain() {
  if (sending || owner == null) return
  clearTimeout(timer)
  timer = null
  sending = true
  try {
    for (;;) {
      const uid = owner
      if (uid == null) break
      const [head] = read(uid)
      if (!head) break
      const r = await json('POST', '/review/answer', body(head), { timeoutMs: 20000 })
      if (r.ok) {
        write(uid, read(uid).filter((e) => e.key !== head.key))
        sentHere.push({ uid, entry: head })
        wait = 0
        settleFirst(head.key, r.data || {})
        emit({ type: 'sent', entry: head, data: r.data || {} })
        continue
      }
      if (refusedForGood(r.status)) {
        write(uid, read(uid).filter((e) => e.key !== head.key))
        settleFirst(head.key, null)
        emit({ type: 'dropped', entry: head, status: r.status })
        continue
      }
      // NOT SENT NOW, and nothing behind it will be either until it is: every
      // first attempt still waited on is answered "not yet".
      for (const e of read(uid)) settleFirst(e.key, null)
      // Not let in: no clock either. It is sent at the next start, return online,
      // return to the tab or new answer, by which time the reader may be in.
      if (notLetIn(r.status)) break
      wait = Math.min(wait ? wait * 2 : FIRST_WAIT, LONGEST_WAIT)
      timer = setTimeout(drain, wait)
      emit({ type: 'waiting', entry: head, status: r.status })
      break
    }
  } finally {
    sending = false
  }
}

function nudge() {
  wait = 0
  drain()
}

let listening = false
function listen() {
  if (listening || typeof window === 'undefined') return
  listening = true
  window.addEventListener('online', nudge)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') nudge()
  })
  // Another tab of this app kept or sent one: this tab's count follows.
  window.addEventListener('storage', (e) => {
    if (owner != null && e.key === KEY(owner)) emit({ type: 'changed' })
  })
}

// startAnswerQueue — the reader is signed in: send what they have kept.
export function startAnswerQueue(uid) {
  owner = uid
  listen()
  emit({ type: 'changed' })
  nudge()
}

// stopAnswerQueue — signed out. Nothing kept is thrown away; what this page sent
// is forgotten, since the next reader's deck has nothing to do with it.
export function stopAnswerQueue() {
  owner = null
  sentHere.length = 0
  clearTimeout(timer)
  timer = null
}

// keepAnswer — write the answer down, and let the sender take it from here.
// `first` is the outcome of its first attempt: the server's reply, or null when
// it could not be sent yet (it is still kept, and sent later).
export function keepAnswer(fields) {
  const uid = owner
  const entry = { ...fields, key: newId(), t: Date.now() }
  const first = new Promise((resolve) => firsts.set(entry.key, resolve))
  if (uid == null) {
    // No reader to keep it for (a screen rendered on its own, a test): it can
    // only be tried once, now.
    json('POST', '/review/answer', body(entry)).then((r) => settleFirst(entry.key, r.ok ? r.data || {} : null))
    return { key: entry.key, first }
  }
  write(uid, [...read(uid), entry])
  emit({ type: 'kept', entry })
  drain()
  return { key: entry.key, first }
}

// sentThisPage — the answers this page sent for the signed-in reader.
export function sentThisPage() {
  return owner == null ? [] : sentHere.filter((s) => s.uid === owner).map((s) => s.entry)
}

// keptAnswers — the answers this reader has given that the server has not taken.
export function keptAnswers() {
  return owner == null ? [] : read(owner)
}

// onAnswerQueue — be told when an answer is kept, sent, dropped or waiting.
export function onAnswerQueue(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

// useKeptAnswers — the kept answers, kept current as they come and go.
export function useKeptAnswers() {
  const [list, setList] = useState(keptAnswers)
  useEffect(() => onAnswerQueue(() => setList(keptAnswers())), [])
  return list
}
