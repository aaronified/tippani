import { useState } from 'react'
import { json, errText } from './api.js'
import { toast } from './ui.jsx'

// What acting on some rows actually DOES — the network half of the action
// registry.
//
// actions.jsx says what can be done and where the control for it sits; it
// deliberately holds no behaviour, so every screen that renders from it has had
// to supply the callbacks itself. That was fine while the selection bar was the
// only surface acting on several rows at once. It stopped being fine the moment
// a work's own card wanted a menu: the bar could skip a book in the quiz, fill
// its gaps and delete it, and the tile it was selected from could do none of
// those — not because anybody decided so, but because the four callbacks that
// do the work were local variables inside SelectionBar.
//
// So they live here, and the bar and the card call the same hook. A selection
// of forty passes forty ids; a card passes its own one. Nothing about the
// operations is plural — /books/bulk with a single id is exactly what the bar
// sends when you have picked one thing — so there is no second code path to
// keep in step, which is the whole point.

// KIND_ROUTES maps a kind to its endpoints and to the word a reader types. The
// bulk vocabulary and the URLs differ by one word — a standalone quote is
// `/quotes`, a film is a "title" — and this is the one place that has to know.
export const KIND_ROUTES = {
  annotation: { bulk: '/annotations/bulk', del: '/annotations/bulk/delete', noun: ['highlight', 'highlights'] },
  dialogue: { bulk: '/dialogues/bulk', del: '/dialogues/bulk/delete', noun: ['film line', 'film lines'] },
  quote: { bulk: '/quotes/bulk', del: '/quotes/bulk/delete', noun: ['quote', 'quotes'] },
  // A work carries its quotes into the bin with it, which is why the phrase and
  // the dialog say so rather than just naming a count.
  book: { bulk: '/books/bulk', del: '/books/bulk/delete', status: '/books/bulk/status', noun: ['book', 'books'] },
  movie: { bulk: '/movies/bulk', del: '/movies/bulk/delete', status: '/movies/bulk/status', noun: ['title', 'titles'] },
}

// REVIEW_BULK_KIND crosses from the SCHEDULE's vocabulary to this file's.
//
// A review card names its kind the way item_reviews does — book / screen /
// utterance — because that is what the schedule is keyed on. The bulk endpoints
// name the same three things annotation / dialogue / quote, because that is what
// the rows are. The two vocabularies are both correct and neither is going to
// change, so the crossing lives here, once, beside the table it crosses into.
//
// It exists because "stop asking me about this one" is written by the BULK
// endpoint — no single-item PUT touches review_excluded — so the review card
// has to speak this file's language to set it.
export const REVIEW_BULK_KIND = {
  book: 'annotation',
  screen: 'dialogue',
  utterance: 'quote',
}

// deletePhrase has to match the server's, exactly, because the server is where
// it is checked. Duplicated on purpose rather than fetched: a client that cannot
// compose the phrase cannot show it, and showing it is the whole affordance.
export function deletePhrase(kind, n) {
  const pair = KIND_ROUTES[kind]?.noun || ['item', 'items']
  return `delete ${n} ${n === 1 ? pair[0] : pair[1]}`
}

// countedNoun — "3 books", "1 title". The bar and the card menu both phrase
// toasts with it, and getting the singular from one place is what stops
// "deleted 1 books".
export function countedNoun(kind, n) {
  const pair = KIND_ROUTES[kind]?.noun || ['item', 'items']
  return `${n} ${n === 1 ? pair[0] : pair[1]}`
}

// FILL_CHUNK matches the server's per-call cap. A selection larger than this is
// sent as sequential batches, which is what bounds provider load — the same
// shape the re-verify console already uses.
const FILL_CHUNK = 15

export function useBulkOps({ kind, ids = [], onDone }) {
  const [busy, setBusy] = useState(false)
  const routes = KIND_ROUTES[kind]
  const count = ids.length

  // post is every field-setting action: colour, tags, the seal, favourite, the
  // quiz toggle. One shape because the server takes one — `{ids, ...fields}` —
  // and the only thing that varies is what the toast says afterwards.
  async function post(body, said) {
    if (!routes) return
    setBusy(true)
    const r = await json('POST', routes.bulk, { ids, ...body })
    setBusy(false)
    if (!r.ok) return toast(errText(r, 'could not apply'))
    toast(said)
    onDone?.()
  }

  async function setShelf(status, said) {
    if (!routes?.status) return
    setBusy(true)
    const r = await json('POST', routes.status, { ids, status })
    setBusy(false)
    if (!r.ok) return toast(errText(r, 'could not apply'))
    toast(said)
    onDone?.()
  }

  // fillGaps sends the rows in batches the server will accept and reports one
  // total. A per-batch toast for a selection of forty would be three toasts
  // saying three different numbers about one action.
  async function fillGaps() {
    setBusy(true)
    const key = kind === 'book' ? 'book_ids' : 'movie_ids'
    let fields = 0
    let failed = 0
    for (let i = 0; i < ids.length; i += FILL_CHUNK) {
      const r = await json('POST', '/metadata/fill', { [key]: ids.slice(i, i + FILL_CHUNK) })
      if (!r.ok) {
        setBusy(false)
        return toast(errText(r, 'could not fill'))
      }
      // The FIELD count is what the toast reports, not the work count: "filled 3
      // books" over a selection of forty reads as a failure, while "filled 7
      // fields" is what actually happened and is unambiguously a win.
      fields += r.data?.fields || 0
      failed += r.data?.failed || 0
    }
    setBusy(false)
    // "Nothing was missing" is the good case and has to read like one, or people
    // learn to distrust the button.
    toast(fields === 0 ? (failed ? 'nothing could be fetched' : 'nothing was missing') : `filled ${fields} fields`)
    onDone?.()
  }

  // remove goes through the BULK delete even for one row, and that is not
  // laziness. It is the endpoint that writes ONE bin entry for everything it
  // took — a book and the forty quotes that went with it — so the Undo in the
  // toast puts the whole thing back or nothing. A single DELETE /books/{id}
  // would work too, and would be a second path to keep in step with the first
  // the next time the bin's shape changes.
  async function remove() {
    if (!routes) return
    setBusy(true)
    const r = await json('POST', routes.del, { ids, confirm: deletePhrase(kind, count) })
    setBusy(false)
    if (!r.ok) return toast(errText(r, 'could not delete'))
    const trashID = r.data?.trash_id
    toast(
      `deleted ${count}`,
      trashID
        ? {
            label: 'Undo',
            onClick: async () => {
              const u = await json('POST', `/trash/${trashID}/restore`)
              toast(u.ok ? 'restored' : errText(u, 'could not undo'))
              onDone?.()
            },
          }
        : undefined,
    )
    onDone?.()
  }

  return { busy, routes, count, post, setShelf, fillGaps, remove }
}
