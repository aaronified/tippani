import { json, errText } from './api.js'
import { toast } from './ui.jsx'

// Undo, while you still remember.
//
// Every delete in the app is recoverable for thirty days and lives in Settings →
// The bin. That is the safety net; this is the shortcut. Nobody who deletes the
// wrong quote wants to be told there is a bin — they want the quote back, now,
// without leaving the screen they are on.
//
// ONE HELPER, NOT SEVEN. There are five kinds and seven screens that delete one,
// and each used to write its own `json('DELETE', …)` then `load()`. Threading an
// Undo through all of them separately would mean seven chances to forget it, and
// the one that forgot would be indistinguishable from a delete that was not
// recoverable at all.
//
// The trash id comes from the DELETE's own response rather than from a lookup
// afterwards: two deletes in the same second are otherwise indistinguishable by
// time, and picking the wrong entry would restore the wrong thing.

// deleteWithUndo deletes `path` and, on success, offers the Undo in the toast.
//
// `reload` is called after a successful restore — the caller's own list refresh,
// because the row has to reappear where it was. It is also called on a delete, by
// the caller, exactly as before: this helper does not take over that half, so a
// screen's existing optimistic behaviour is untouched.
//
// Returns the response, so every call site keeps its own error handling.
export async function deleteWithUndo(path, { label = 'deleted', reload } = {}) {
  const r = await json('DELETE', path)
  if (!r.ok) return r
  const id = r.data?.trash_id
  if (!id) {
    // An older server, or a kind that does not go to the bin. Say what happened
    // and offer nothing — an Undo that cannot work is worse than none.
    toast(label)
    return r
  }
  toast(label, {
    label: 'Undo',
    onClick: async () => {
      const u = await json('POST', `/trash/${id}/restore`)
      if (!u.ok) return toast(errText(u, 'could not undo'))
      toast('restored')
      reload?.()
    },
  })
  return r
}
