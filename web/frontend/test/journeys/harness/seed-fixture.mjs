// REPLAYS test/journeys/fixture/library.json THROUGH THE PUBLIC API.
//
// The same endpoints the SPA calls, with the same validation — so a fixture the
// API would have refused never becomes a library a journey can see. seed.mjs
// makes the same argument for the screenshot scaffold and it is the right one:
// writing into SQLite directly would let the fixture hold states the app cannot
// reach, and a journey over an unreachable state audits clean while the real one
// is broken.
//
// SETUP MAY USE THE API; THE JOURNEY MAY NOT. Arranging the world is not the
// thing under test — a reader does not curl their own library into existence
// either. What has to be user-like is the part being asserted.

import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
export const FIXTURE_DIR = join(HERE, '..', 'fixture')

export async function seedFixture({ baseUrl, username, password }) {
  const jar = new Map()
  const cookie = () => [...jar].map(([k, v]) => `${k}=${v}`).join('; ')
  const eat = (res) => {
    for (const line of res.headers.getSetCookie?.() ?? []) {
      const [pair] = line.split(';')
      const i = pair.indexOf('=')
      if (i > 0) jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim())
    }
  }

  // ONE PLACE TALKS TO THE SERVER, so a failure has one shape and every non-2xx
  // is loud. A seeder that half-worked and said nothing would leave every journey
  // asserting against a library nobody can describe.
  async function api(method, path, body) {
    const res = await fetch(baseUrl + '/api' + path, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(jar.size ? { Cookie: cookie() } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    eat(res)
    const text = await res.text()
    if (!res.ok) {
      let detail = text.slice(0, 300)
      try { detail = JSON.parse(text).error ?? detail } catch { /* raw body reads better */ }
      throw new Error(`${method} ${path} -> ${res.status}: ${detail}`)
    }
    return text ? JSON.parse(text) : null
  }

  // Multipart, and it must NOT set Content-Type: fetch writes the boundary
  // itself, and an explicit header here produces a body the server cannot parse.
  async function uploadCover(kind, id, file) {
    const bytes = await readFile(join(FIXTURE_DIR, file))
    const form = new FormData()
    form.append('file', new Blob([bytes], { type: 'image/png' }), file.split('/').pop())
    const res = await fetch(`${baseUrl}/api/${kind}/${id}/cover`, {
      method: 'POST', headers: jar.size ? { Cookie: cookie() } : {}, body: form,
    })
    eat(res)
    if (!res.ok) throw new Error(`cover ${kind}/${id} -> ${res.status}: ${(await res.text()).slice(0, 200)}`)
  }

  const recipe = JSON.parse(await readFile(join(FIXTURE_DIR, 'library.json'), 'utf8'))

  const status = await api('GET', '/auth/status')
  if (status?.needs_onboarding) await api('POST', '/auth/signup', { username, password })
  else await api('POST', '/auth/login', { username, password })

  for (const t of recipe.tags) await api('POST', '/tags', t)

  // Boards first: a quote names the board it belongs to, and the server wants the
  // id. Some boards may already exist on a fresh account, so the map is built
  // from what is there afterwards rather than from what this loop created.
  for (const b of recipe.boards) {
    await api('POST', '/boards', b).catch(() => {}) // already there is fine
  }
  const boardId = new Map(((await api('GET', '/boards'))?.boards || []).map((b) => [b.name, b.id]))

  for (const b of recipe.books) {
    const { annotations, cover, ...body } = b
    const created = await api('POST', '/books', body)
    if (cover) await uploadCover('books', created.id, cover)
    for (const a of annotations) await api('POST', '/annotations', { book_id: created.id, ...a })
  }

  for (const m of recipe.movies) {
    const { dialogues, cast, poster, ...body } = m
    const created = await api('POST', '/movies', body)
    if (poster) await uploadCover('movies', created.id, poster)
    for (const c of cast || []) await api('POST', `/movies/${created.id}/cast`, c).catch(() => {})
    for (const d of dialogues) await api('POST', '/dialogues', { movie_id: created.id, ...d })
  }

  for (const q of recipe.quotes) {
    const { board, ...body } = q
    await api('POST', '/quotes', { ...body, ...(boardId.has(board) ? { board_id: boardId.get(board) } : {}) })
  }

  return {
    books: recipe.books.length,
    movies: recipe.movies.length,
    quotes: recipe.books.reduce((n, b) => n + b.annotations.length, 0)
      + recipe.movies.reduce((n, m) => n + m.dialogues.length, 0)
      + recipe.quotes.length,
  }
}
