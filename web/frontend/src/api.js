// Tiny fetch helpers (PLAN §10: fetch + useState suffice — no fetch libraries).
// Every response resolves to {ok, status, data}; API errors are {"error":"msg"}.

// The whole REST API is mounted under /api so the root path space is free for
// client-side routes. Callers still pass bare paths ("/books"); apiURL prefixes
// them. Covers (<img src>) and export links build /api URLs directly (see
// coverURL / exportURL in ui.jsx) since they don't go through these helpers.
export const API_BASE = '/api'
export const apiURL = (url) => (url && url.startsWith('/') ? API_BASE + url : url)

// DEMO — the read-only GitHub Pages build (VITE_DEMO=1). Lives here rather
// than App.jsx so any module can gate demo-only behavior without an import
// cycle through the app shell.
export const DEMO = import.meta.env.VITE_DEMO === '1'

// coverImgURL resolves a stored cover/poster/sticker/portrait path to its
// served URL — the ONE builder every <img src> uses. Demo fixtures carry
// data: URIs directly (a static host has no cover route); those pass through.
export const coverImgURL = (path) =>
  !path ? '' : String(path).startsWith('data:') ? path : `${API_BASE}/covers/${path}`

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
  return parse(await fetch(apiURL(url), opts))
}

// upload posts a single file as multipart form data (field name "file").
export async function upload(url, file) {
  const form = new FormData()
  form.append('file', file)
  return parse(await fetch(apiURL(url), { method: 'POST', body: form }))
}

// downloadPost POSTs a JSON body and saves the response as a file (used for the
// export endpoints, which stream markdown rather than JSON). Same-origin, so the
// browser adds Sec-Fetch-Site + cookies for the CSRF/auth checks.
export async function downloadPost(url, body, filename) {
  const r = await fetch(apiURL(url), {
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
  // Revoke LATER: browsers (mobile especially) save blob URLs asynchronously;
  // an immediate revoke races the save and truncates the file.
  setTimeout(() => URL.revokeObjectURL(href), 60_000)
  return true
}

// errText extracts the server's error message with a fallback.
export function errText(res, fallback = 'something went wrong') {
  return (res.data && res.data.error) || fallback
}

// copyText copies text to the clipboard, returning true on success. The async
// Clipboard API only exists in a secure context (HTTPS or localhost); a
// self-hosted instance reached over plain HTTP has navigator.clipboard
// undefined, so writeText silently no-ops. This falls back to a hidden
// <textarea> + execCommand('copy'), which works on insecure origins too.
export async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // permission denied / not focused — fall through to the legacy path
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.top = '-1000px'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    ta.setSelectionRange(0, ta.value.length)
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  } catch {
    return false
  }
}
