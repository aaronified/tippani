// Tiny fetch helpers (PLAN §10: fetch + useState suffice — no fetch libraries).
// Every response resolves to {ok, status, data}; API errors are {"error":"msg"}.

async function parse(r) {
  let data = null
  try {
    data = await r.json()
  } catch {
    // non-JSON or empty body — leave data null
  }
  return { ok: r.ok, status: r.status, data }
}

export async function json(method, url, body) {
  const opts = { method }
  if (body !== undefined) {
    opts.headers = { 'Content-Type': 'application/json' }
    opts.body = JSON.stringify(body)
  }
  return parse(await fetch(url, opts))
}

// upload posts a single file as multipart form data (field name "file").
export async function upload(url, file) {
  const form = new FormData()
  form.append('file', file)
  return parse(await fetch(url, { method: 'POST', body: form }))
}

// errText extracts the server's error message with a fallback.
export function errText(res, fallback = 'something went wrong') {
  return (res.data && res.data.error) || fallback
}
