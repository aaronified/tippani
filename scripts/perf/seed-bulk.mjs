// Fills a scratch account with enough quotes that the boards are a realistic size.
//
// scripts/screenshots/seed.mjs builds a library that LOOKS right — a couple of dozen
// works, each with its art — because its job is to be photographed. This one builds a
// library that WEIGHS right, which is a different requirement and the one that matters
// here: the defect this harness exists to catch only appears on a board with hundreds
// of cards on it, and a fixture of five would have measured a fast app and said so.
//
// The text lengths vary deliberately. The quotes board packs cards of unequal height
// into columns, and a fixture where every card is the same size would exercise none of
// that — it is the heterogeneous heights that make the board expensive.

const BASE = process.argv.includes('--base-url')
  ? process.argv[process.argv.indexOf('--base-url') + 1]
  : 'http://127.0.0.1:8080'
const COUNT = process.argv.includes('--count')
  ? Number(process.argv[process.argv.indexOf('--count') + 1])
  : 400
const USER = process.argv.includes('--username')
  ? process.argv[process.argv.indexOf('--username') + 1]
  : 'screenshot-bot'
const PASS = process.argv.includes('--password')
  ? process.argv[process.argv.indexOf('--password') + 1]
  : 'screenshot-bot-pw'

const jar = new Map()
const cookieHeader = () => [...jar].map(([k, v]) => `${k}=${v}`).join('; ')

async function api(method, path, body) {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(jar.size ? { Cookie: cookieHeader() } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  for (const line of res.headers.getSetCookie?.() ?? []) {
    const [kv] = line.split(';')
    const i = kv.indexOf('=')
    jar.set(kv.slice(0, i).trim(), kv.slice(i + 1).trim())
  }
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${await res.text()}`)
  return res.status === 204 ? null : res.json()
}

// The server's own vocabulary, not a superset of it: a colour it does not accept is a
// 400 on the first row and an empty board for the run.
const COLORS = ['green', 'orange', 'pink', 'blue', 'purple', 'yellow']
const KINDS = ['proverb', 'essay', 'speech', 'other']
const WORDS =
  'paper lantern river winter memory salt hour glass letter wind harbour clock garden thread stone ember quiet field ledger tide'.split(
    ' ',
  )

await api('POST', '/auth/login', { username: USER, password: PASS })

let made = 0
for (let i = 0; i < COUNT; i++) {
  const len = 6 + ((i * 7) % 60)
  const text = Array.from({ length: len }, (_, j) => WORDS[(i * 13 + j * 5) % WORDS.length]).join(' ')
  await api('POST', '/quotes', {
    // The index is in the text because the server refuses a duplicate quote, and two
    // generated rows collide sooner than you would think.
    quote: `${text} — no. ${i + 1}.`,
    color: COLORS[i % COLORS.length],
    kind: KINDS[i % KINDS.length],
    speaker: `Speaker ${i % 25}`,
    noted_at: new Date(Date.UTC(2025, i % 12, (i % 27) + 1)).toISOString(),
  })
  made++
  if (made % 100 === 0) console.log(`  ${made}/${COUNT}`)
}
// ---- one quote that can actually wear a backdrop -----------------------------
//
// The backdrop is the single most expensive thing the app draws and the whole reason
// this harness exists, and it only appears when the quote credits a person who HAS a
// portrait. Every generated quote above credits an invented speaker with no photo, so
// without this the share measurement would quietly fall back to the cheap card and
// report a fast app — the exact shape of a test that passes by not looking.
//
// It reuses the person the screenshot fixture already created rather than fetching a
// second photograph, and it is written LAST with the latest date so it sits at the top
// of a newest-first board, where the harness can find it without hunting.
const roster = (await api('GET', '/people?kind=speaker').catch(() => null)) || {}
const list = Array.isArray(roster) ? roster : (roster.people ?? [])
// image_path, not image_url: the server has already fetched and stored the photograph,
// and what it hands back is where it put it.
const sitter = list.find((p) => p.image_path)
if (!sitter) {
  console.log('no speaker has a portrait — the backdrop will be reported as not measured')
} else {
  await api('POST', '/quotes', {
    quote: `A picture of a quote is exactly the kind of thing that travels with its source cropped off — no. ${COUNT + 1}.`,
    color: 'blue',
    kind: 'essay',
    speaker: sitter.name,
    // Now, rather than a pinned date: the server refuses a future noted_at, and any
    // fixed past date would eventually stop being the newest row on the board. "A
    // minute ago" is the only value that is always first and never rejected.
    noted_at: new Date(Date.now() - 60_000).toISOString(),
  })
  console.log(`backdrop quote credited to ${sitter.name}`)
}

console.log(`bulk quotes ${made}`)
