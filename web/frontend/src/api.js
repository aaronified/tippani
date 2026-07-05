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

// downloadPost POSTs a JSON body and saves the response as a file (used for the
// export endpoints, which stream markdown rather than JSON). Same-origin, so the
// browser adds Sec-Fetch-Site + cookies for the CSRF/auth checks.
export async function downloadPost(url, body, filename) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!r.ok) return false
  const blob = await r.blob()
  const href = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(href)
  return true
}

// errText extracts the server's error message with a fallback.
export function errText(res, fallback = 'something went wrong') {
  return (res.data && res.data.error) || fallback
}
