// WHAT A RUN SAYS. A run is a whole anthology or board spoken in order, and what it says is decided here,
// once, so the page and the player cannot disagree about it. A single card speaks only its text
// (speech.js quoteSegments); a run speaks more, and what a switch hides is not spoken.
import { quoteSpeechId, tagFor, textSegments } from './speech.js'

// the attribution line as the page draws it: who, then where from, under the anthology's own switches
const credit = (e, fields = {}) =>
  [!fields.hide_credit && (e.credit || e.speaker), !fields.hide_source && e.source].filter(Boolean).join(', ')

// anthologyRun — the intro, then each slot in the order the page draws it. A section is its heading and
// the words under it. An entry is the reader's note first (as the page puts it above the passage, and
// unless commentary is hidden), then the passage in its own language, then its attribution. Everything
// but the passage is the reader's own words or names, so it is spoken in the interface's language.
export function anthologyRun(anthology, slots) {
  const ui = tagFor('')
  const out = []
  if (anthology?.intro) out.push(...textSegments(anthology.intro, ui, 'intro'))
  for (const slot of slots || []) {
    if (slot.type === 'section') {
      const mark = `section:${slot.section.id}`
      out.push(...textSegments(slot.section.title, ui, mark), ...textSegments(slot.section.prose, ui, mark))
      continue
    }
    const e = slot.entry
    const mark = quoteSpeechId(e.kind, e)
    if (!anthology?.hide_commentary && e.note) out.push(...textSegments(e.note, ui, mark))
    out.push(...textSegments(e.quote, tagFor(e.language), mark))
    out.push(...textSegments(credit(e, anthology), ui, mark))
  }
  return out
}

// boardRun — a board's quotes in the order it shows them: each passage, then who and where.
export function boardRun(items, kind = 'quote') {
  const ui = tagFor('')
  const out = []
  for (const q of items || []) {
    const mark = quoteSpeechId(q.kind || kind, q)
    out.push(...textSegments(q.quote || q.text || '', tagFor(q.language), mark))
    out.push(...textSegments(credit(q), ui, mark))
  }
  return out
}
