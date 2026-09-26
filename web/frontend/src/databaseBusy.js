// databaseBusy.js — the database door's refusal, heard once for the whole app.
//
// The server answers 503 with code TIP-HTTP-002 when no database connection came
// free in time (issue #40), and the request changed nothing. Any request can meet
// it, so api.js's send() reports it here, and App shows its busy screen. Every
// caller still gets its own {ok:false} as before.
//
// Its own module, not a line in api.js: it holds listeners, not anything a server
// sent, and beside api.js's fetch it read to the session-cache guard as a cached
// response.

export const DATABASE_BUSY = 'TIP-HTTP-002'

export const isDatabaseBusy = (r) => r?.status === 503 && r?.data?.code === DATABASE_BUSY

const listeners = new Set()

// onDatabaseBusy(fn) calls fn whenever a request meets the door's refusal, and
// returns the unsubscribe, which is what a React effect's cleanup wants.
export function onDatabaseBusy(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function reportIfDatabaseBusy(r) {
  if (isDatabaseBusy(r)) for (const fn of listeners) fn()
}
