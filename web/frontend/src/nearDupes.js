// WHICH OF THESE NAMES ARE THE SAME NAME, SPELLED TWICE.
//
// IT LIVES HERE BECAUSE TWO CONSOLES ASK IT. The people console asks it of
// records and the tags console asks it of a vocabulary, and the repo's directive
// is that a thing two screens do lives in one function both call — not a line
// each, which is how one of them goes on being right while the other quietly
// stops. It was a private function inside `MetadataPage.jsx` until the tags
// console needed the same answer.
//
// UNION-FIND, NOT PAIRS, and that is the part a second copy would get wrong.
// "translation", "on translation" and "translations" are one cluster, but no
// single comparison sees all three: a pairwise list would offer the reader three
// overlapping merges of the same three tags and let them do two of them. Joining
// them into a set means the screen offers one decision per real duplicate.
//
// WHAT COUNTS AS THE SAME: identical after normalisation, or within an edit
// distance of 2 that is also within a quarter of the longer string. The ratio is
// what keeps short words apart — "cat" and "cot" are one edit and two different
// words, while "Bandyopadhyay" and "Bandopadhyay" are one edit in thirteen
// characters and obviously one person. Two is the ceiling because three admits
// pairs no reader would call a duplicate.
import { editDistance } from './text.js'
import { normName } from './ui.jsx'

export function nearDupGroups(names) {
  const norm = names.map(normName)
  const parent = names.map((_, i) => i)
  const find = (x) => {
    while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x] }
    return x
  }
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const a = norm[i], b = norm[j]
      if (!a || !b) continue
      const same = a === b || (() => { const d = editDistance(a, b); return d > 0 && d <= 2 && d / Math.max(a.length, b.length) <= 0.25 })()
      if (same) parent[find(i)] = find(j)
    }
  }
  const groups = {}
  names.forEach((n, i) => { const r = find(i); (groups[r] = groups[r] || []).push(n) })
  return Object.values(groups).filter((g) => g.length >= 2)
}

// dupNames — the flat set of names that are in ANY cluster, for a row asking
// "am I one of them". A caller that wanted this from `nearDupGroups` would flatten
// it at every render over every row; a Set answers in one pass and is read in
// constant time per row.
export function dupNames(names) {
  return new Set(nearDupGroups(names).flat())
}
