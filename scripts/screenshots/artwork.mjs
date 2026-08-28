// Real cover art for the seeded fixtures, fetched from the two services that publish it
// under terms that allow this: Open Library for book jackets, Wikimedia Commons for film
// posters and period television stills.
//
// FETCHED ONCE, THEN CACHED ON DISK. Every later run reads the cached bytes, which is what
// keeps the captures byte-identical — a screenshot harness that re-downloaded its art each
// run would produce a different library whenever an upstream file was re-uploaded, and the
// diff would look like a change in the app. The cache directory is gitignored: this art is
// not ours to commit, and it is reproducible from the identifiers in seed.mjs.
//
// EVERY REFERENCE IS PINNED, never searched at run time. A book names an Open Library
// cover id, a film names an exact Commons file title. Resolving "Citizen Kane poster" by
// search would return whatever ranks first on the day, which is the same class of drift
// this whole scaffold exists to remove.
//
// Failure is per-item and never fatal. A cover that will not download leaves that work
// without one — a real state the interface has to render, and one worth capturing — and
// the seeder reports the count rather than pretending the art is there.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// Wikimedia REQUIRES a descriptive User-Agent identifying the tool and a contact; requests
// without one are refused outright. Open Library asks for the same courtesy.
const UA = 'tippani-screenshot-fixtures/1.0 (+https://github.com/aaronified/tippani)'

const CACHE = join(import.meta.dirname, '.artwork-cache')

// Thumbnail width to ask Commons for. The originals run to 3000px and several megabytes;
// the app renders these at a couple of hundred pixels, and the upload endpoint caps at
// 10 MB. 500 is comfortably above what any screen draws.
const COMMONS_WIDTH = 500

function slug(s) {
  return s
    .replace(/^File:/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
}

async function get(url, accept) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, ...(accept ? { Accept: accept } : {}) } })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res
}

function cached(name) {
  const path = join(CACHE, name)
  return existsSync(path) ? readFileSync(path) : null
}

function store(name, buf) {
  mkdirSync(CACHE, { recursive: true })
  writeFileSync(join(CACHE, name), buf)
  return buf
}

// A book jacket by Open Library cover id. `default=false` is what makes a miss a 404
// rather than Open Library's 1x1 placeholder — without it a book with no jacket gets a
// blank image uploaded as though it had one, which is worse than having none.
export async function bookCover(coverId) {
  const name = `ol-${coverId}.jpg`
  const hit = cached(name)
  if (hit) return { data: hit, filename: name, cached: true }
  const res = await get(`https://covers.openlibrary.org/b/id/${coverId}-L.jpg?default=false`, 'image/jpeg')
  const data = Buffer.from(await res.arrayBuffer())
  if (data.length < 1000) throw new Error(`suspiciously small (${data.length} bytes)`)
  return { data: store(name, data), filename: name, cached: false }
}

// commonsURL resolves an exact Commons title ("File:Citizen Kane poster, 1941 (Style A).jpg")
// to a thumbnail URL. The title is resolved rather than the URL being hardcoded because
// Commons rewrites its upload paths, and a hardcoded upload.wikimedia.org path is a link
// that rots quietly.
//
// The API decorates thumburl with utm_* campaign parameters. They are stripped, because
// this URL is handed to the SERVER in the portrait case (see commonsPortraitURL) and a
// tracking query string on a fixture's image is noise that ends up in a log.
export async function commonsURL(fileTitle, width = COMMONS_WIDTH) {
  const api = 'https://commons.wikimedia.org/w/api.php?' + new URLSearchParams({
    action: 'query', format: 'json', titles: fileTitle,
    prop: 'imageinfo', iiprop: 'url|mime|size', iiurlwidth: String(width),
  })
  const meta = await (await get(api, 'application/json')).json()
  const pages = meta?.query?.pages ?? {}
  const page = Object.values(pages)[0]
  if (!page || page.missing !== undefined) throw new Error('no such file on Commons')
  const info = page.imageinfo?.[0]
  const raw = info?.thumburl ?? info?.url
  if (!raw) throw new Error('no image url in response')
  const u = new URL(raw)
  for (const k of [...u.searchParams.keys()]) if (k.startsWith('utm_')) u.searchParams.delete(k)
  return u.toString()
}

// A Commons file by its exact title, downloaded and cached.
export async function commonsImage(fileTitle) {
  const name = `wm-${slug(fileTitle)}.jpg`
  const hit = cached(name)
  if (hit) return { data: hit, filename: name, cached: true }

  const url = await commonsURL(fileTitle)
  const data = Buffer.from(await (await get(url, 'image/*')).arrayBuffer())
  if (data.length < 1000) throw new Error(`suspiciously small (${data.length} bytes)`)
  return { data: store(name, data), filename: name, cached: false }
}

// A PORTRAIT IS THE ONE IMAGE THIS MODULE CANNOT HAND OVER AS BYTES, and the reason is
// a security control doing its job. There is no multipart upload for a person's photo —
// `PUT /people` takes an `image_url` and fetches it server-side through
// metadata.FetchUserImage, which refuses loopback and private addresses at dial time. So
// the obvious trick, serving the disk cache off 127.0.0.1 and handing the server that
// URL, is exactly the SSRF the guard exists to stop, and defeating it to seed a fixture
// would be the worst possible reason to.
//
// So this one resolves a URL and lets the server do the fetching. The title stays pinned,
// which is what keeps the picture the same picture; what is lost is the disk cache, so
// this is the only fixture image that touches the network on EVERY run. Sized larger than
// a poster because a backdrop portrait is drawn across nearly half the card at 2× — the
// share image is the whole reason this person is seeded.
export const PORTRAIT_WIDTH = 800

export function commonsPortraitURL(fileTitle) {
  return commonsURL(fileTitle, PORTRAIT_WIDTH)
}
