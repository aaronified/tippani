import { useEffect, useMemo, useState } from 'react'
import { MonoLabel, Toggle, GhostButton } from './ui.jsx'

const PRIMARY = 'tp-btn tp-btn-primary'

// ---- supported formats -------------------------------------------------
// Each format's `logic` line is shown at the top of the popup so the sharer
// knows exactly which syntax will be produced; `hint` is a compact mono sample
// of that format's key tokens. Rules verified against the WhatsApp (2023
// formatting update) and Reddit markdown conventions.
export const SHARE_FORMATS = [
  {
    id: 'markdown',
    name: 'Markdown',
    logic: 'Rich Markdown — renders on GitHub, Obsidian, Notion and most editors.',
    hint: '**bold**  *italic*  ~~strike~~  > quote  `code`  [text](url)',
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    logic: 'WhatsApp chat formatting — single-character wrappers; no headings or link syntax (raw URLs auto-link).',
    hint: '*bold*  _italic_  ~strike~  > quote  ```code```',
  },
  {
    id: 'plaintext',
    name: 'Plain',
    logic: 'Plain text for Twitter/X, SMS — nothing renders, so: “curly quotes” around the quote and an — attribution line.',
    hint: 'no markup · “…” · — Author, Title · #tags',
  },
  {
    id: 'reddit',
    name: 'Reddit',
    logic: 'Reddit markdown (old & new) — like Markdown, with `> ` quotes and [text](url) links.',
    hint: '**bold**  *italic*  ~~strike~~  > quote  [text](url)',
  },
]

// ---- normalised share payload builders ---------------------------------
// Callers pass already-resolved strings (dates pre-formatted); these shape the
// uniform payload the dialog assembles + renders. Empty values are dropped by
// the dialog, so passing '' is fine.
export function bookShare({ quote, note, author, title, published, chapter, location, date, rating, tags }) {
  return {
    quote: quote || '',
    // Author-first (bold), work italic, then the publication year — the classic
    // epigraph order ("— **Author**, *Title*, 1965").
    attribution: [
      { id: 'author', label: 'Author', value: author || '', emphasis: 'bold' },
      { id: 'work', label: 'Book', value: title || '', emphasis: 'italic' },
      { id: 'published', label: 'Published', value: published ? String(published) : '' },
    ],
    // "Noted" is the date you saved/highlighted it (noted_at, else added_at) —
    // distinct from the publication year above.
    meta: [
      { id: 'chapter', label: 'Chapter', value: chapter ? `Ch. ${chapter}` : '' },
      { id: 'location', label: 'Location', value: location ? `p.${location}` : '' },
      { id: 'noted', label: 'Noted', value: date || '' },
    ],
    rating: rating || 0,
    tags: tags || [],
    note: note || '',
  }
}

export function movieShare({ quote, note, title, year, character, actor, timestamp, rating, tags, tmdbId, tvdbId }) {
  return {
    quote: quote || '',
    attribution: [
      { id: 'work', label: 'Title', value: title || '', emphasis: 'italic' },
      { id: 'year', label: 'Released', value: year ? String(year) : '' },
      { id: 'tmdb', label: 'TMDB', value: tmdbId ? `TMDB #${tmdbId}` : '' },
      { id: 'tvdb', label: 'TVDB', value: tvdbId ? `TVDB #${tvdbId}` : '' },
    ],
    // Actor name bold inside the "played by …" credit; character stays plain.
    meta: [
      { id: 'character', label: 'Character', value: character || '' },
      { id: 'actor', label: 'Actor', value: actor || '', emphasis: 'bold', prefix: 'played by ' },
      { id: 'timestamp', label: 'Time', value: timestamp || '' },
    ],
    rating: rating || 0,
    tags: tags || [],
    note: note || '',
  }
}

// fieldsOf lists the toggleable parts present in a payload, in output order.
function fieldsOf(share) {
  const f = []
  if (share.quote) f.push({ id: 'quote', label: 'Quote' })
  for (const a of share.attribution || []) if (a.value) f.push({ id: a.id, label: a.label })
  for (const m of share.meta || []) if (m.value) f.push({ id: m.id, label: m.label })
  if (share.rating) f.push({ id: 'rating', label: 'Rating' })
  if (share.tags && share.tags.length) f.push({ id: 'tags', label: 'Tags' })
  if (share.note) f.push({ id: 'note', label: 'Note' })
  return f
}

// ---- text generation (source per format) -------------------------------
function italic(text, fmt) {
  if (fmt === 'markdown' || fmt === 'reddit') return `*${text}*`
  if (fmt === 'whatsapp') return `_${text}_`
  return text // plaintext: no styling
}
function bold(text, fmt) {
  if (fmt === 'markdown' || fmt === 'reddit') return `**${text}**`
  if (fmt === 'whatsapp') return `*${text}*`
  return text // plaintext: no styling
}
// emph applies a part's emphasis (bold for people — author/actor; italic for
// works — book/film title) in the syntax of the chosen format.
function emph(text, style, fmt) {
  if (style === 'bold') return bold(text, fmt)
  if (style === 'italic') return italic(text, fmt)
  return text
}

function quoteBlock(quote, fmt) {
  if (fmt === 'plaintext') return `“${quote}”`
  // markdown / reddit / whatsapp all support the "> " blockquote prefix.
  return quote
    .split('\n')
    .map((l) => `> ${l}`)
    .join('\n')
}

function hashtag(t) {
  const clean = String(t).trim().replace(/\s+/g, '')
  return clean ? '#' + clean : ''
}

export function buildShareText(share, selected, fmt) {
  const blocks = []
  if (selected.quote && share.quote) blocks.push(quoteBlock(share.quote, fmt))

  const attr = []
  for (const a of share.attribution || [])
    if (selected[a.id] && a.value) attr.push(emph(a.value, a.emphasis, fmt))
  if (attr.length) blocks.push('— ' + attr.join(', '))

  const meta = []
  for (const m of share.meta || [])
    if (selected[m.id] && m.value) meta.push((m.prefix || '') + emph(m.value, m.emphasis, fmt))
  if (selected.rating && share.rating) meta.push('★'.repeat(share.rating))
  if (meta.length) blocks.push(meta.join(' · '))

  if (selected.note && share.note) blocks.push(share.note)

  if (selected.tags && share.tags && share.tags.length) {
    const tags = share.tags.map(hashtag).filter(Boolean).join(' ')
    if (tags) blocks.push(tags)
  }
  return blocks.join('\n\n')
}

// ---- HTML-simulation renderer ------------------------------------------
// Not a markdown library: a small per-format tokenizer that mirrors how each
// target app *displays* the source, so the live preview reflects the real
// result. Inline patterns are tried at each position; the earliest match wins
// (ties broken by array order, so ** beats *), and inner text recurses so
// bold-inside-italic etc. nest. `code` does not recurse (renders literally).

const mdInline = [
  { re: /`([^`]+)`/, el: (m, k) => <code key={k} className="share-code">{m[1]}</code> },
  { re: /\*\*([^*]+)\*\*/, el: (m, k, P) => <strong key={k}>{inlineNodes(m[1], P)}</strong> },
  { re: /__([^_]+)__/, el: (m, k, P) => <strong key={k}>{inlineNodes(m[1], P)}</strong> },
  { re: /~~([^~]+)~~/, el: (m, k, P) => <s key={k}>{inlineNodes(m[1], P)}</s> },
  { re: /\*([^*\n]+)\*/, el: (m, k, P) => <em key={k}>{inlineNodes(m[1], P)}</em> },
  { re: /(?<![A-Za-z0-9])_([^_\n]+)_(?![A-Za-z0-9])/, el: (m, k, P) => <em key={k}>{inlineNodes(m[1], P)}</em> },
  { re: /\[([^\]]+)\]\(([^)\s]+)\)/, el: (m, k) => <a key={k} className="share-link">{m[1]}</a> },
]

const waInline = [
  { re: /```([^`]+)```/, el: (m, k) => <code key={k} className="share-code">{m[1]}</code> },
  { re: /`([^`]+)`/, el: (m, k) => <code key={k} className="share-code">{m[1]}</code> },
  { re: /\*([^*\n]+)\*/, el: (m, k, P) => <strong key={k}>{inlineNodes(m[1], P)}</strong> },
  { re: /_([^_\n]+)_/, el: (m, k, P) => <em key={k}>{inlineNodes(m[1], P)}</em> },
  { re: /~([^~\n]+)~/, el: (m, k, P) => <s key={k}>{inlineNodes(m[1], P)}</s> },
]

function patternsFor(fmt) {
  if (fmt === 'whatsapp') return waInline
  if (fmt === 'markdown' || fmt === 'reddit') return mdInline
  return null // plaintext: no inline markup
}

// inlineNodes tokenizes one line of text into React nodes using `patterns`.
function inlineNodes(text, patterns) {
  if (!patterns) return [text]
  const out = []
  let rest = text
  let k = 0
  let guard = 0
  while (rest.length && guard++ < 2000) {
    let best = null
    for (const p of patterns) {
      const m = p.re.exec(rest) // non-global: always scans from index 0
      if (m && (!best || m.index < best.m.index)) best = { p, m }
    }
    if (!best) {
      out.push(rest)
      break
    }
    if (best.m.index > 0) out.push(rest.slice(0, best.m.index))
    out.push(best.p.el(best.m, 'i' + k++, patterns))
    rest = rest.slice(best.m.index + best.m[0].length)
  }
  return out
}

// multiline renders text with intra-block newlines as <br>.
function multiline(text, patterns, keyBase) {
  const lines = text.split('\n')
  return lines.map((line, j) => (
    <span key={`${keyBase}-${j}`}>
      {inlineNodes(line, patterns)}
      {j < lines.length - 1 && <br />}
    </span>
  ))
}

function renderBlock(blk, fmt, patterns, i) {
  const lines = blk.split('\n')
  const nonEmpty = lines.filter((l) => l.trim() !== '')
  // blockquote — supported by markdown / reddit / whatsapp
  if (fmt !== 'plaintext' && nonEmpty.length && nonEmpty.every((l) => /^>\s?/.test(l))) {
    const inner = lines.map((l) => l.replace(/^>\s?/, '')).join('\n')
    return (
      <blockquote key={i} className="share-quote">
        {multiline(inner, patterns, `q${i}`)}
      </blockquote>
    )
  }
  // heading — markdown / reddit only (whatsapp shows '#' literally)
  if ((fmt === 'markdown' || fmt === 'reddit') && lines.length === 1) {
    const h = blk.match(/^(#{1,6})\s+(.*)$/)
    if (h) {
      const lvl = Math.min(h[1].length + 2, 6) // keep previews modest (h3–h6)
      const Tag = `h${lvl}`
      return (
        <Tag key={i} className="share-h">
          {inlineNodes(h[2], patterns)}
        </Tag>
      )
    }
  }
  // bulleted list
  if (fmt !== 'plaintext' && nonEmpty.length && nonEmpty.every((l) => /^[-*+]\s+/.test(l))) {
    return (
      <ul key={i} className="share-ul">
        {nonEmpty.map((l, j) => (
          <li key={j}>{inlineNodes(l.replace(/^[-*+]\s+/, ''), patterns)}</li>
        ))}
      </ul>
    )
  }
  // numbered list
  if (fmt !== 'plaintext' && nonEmpty.length && nonEmpty.every((l) => /^\d+[.)]\s+/.test(l))) {
    return (
      <ol key={i} className="share-ol">
        {nonEmpty.map((l, j) => (
          <li key={j}>{inlineNodes(l.replace(/^\d+[.)]\s+/, ''), patterns)}</li>
        ))}
      </ol>
    )
  }
  return (
    <p key={i} className="share-p">
      {multiline(blk, patterns, `p${i}`)}
    </p>
  )
}

export function renderShareHTML(text, fmt) {
  const patterns = patternsFor(fmt)
  const blocks = text.split(/\n{2,}/)
  return blocks.map((blk, i) => renderBlock(blk, fmt, patterns, i))
}

// ---- the dialog --------------------------------------------------------
export function ShareDialog({ share, onClose }) {
  const [format, setFormat] = useState('markdown')
  const fields = useMemo(() => fieldsOf(share), [share])
  const [selected, setSelected] = useState(() => Object.fromEntries(fields.map((f) => [f.id, true])))
  const [text, setText] = useState('')
  const [copied, setCopied] = useState(false)

  const active = SHARE_FORMATS.find((f) => f.id === format) || SHARE_FORMATS[0]

  // Regenerate the source whenever the format or the chosen fields change.
  // Manual edits to the textarea persist until the next such change.
  useEffect(() => {
    setText(buildShareText(share, selected, format))
    setCopied(false)
  }, [share, selected, format])

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      /* clipboard API unavailable on insecure origins — selection still works */
    }
  }

  const preview = useMemo(() => renderShareHTML(text, format), [text, format])

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto px-4 py-10"
      style={{ background: 'rgba(21,16,12,.55)' }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div role="dialog" aria-modal="true" aria-label="Share quote" className="hand-card hc-r2 mx-auto w-full max-w-3xl px-6 py-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="display-title text-xl">Share</h2>
          <GhostButton onClick={onClose}>Close</GhostButton>
        </div>

        {/* format toggle + the per-format logic shown up top */}
        <div className="mb-4 space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <MonoLabel>format</MonoLabel>
            <Toggle
              ariaLabel="Share format"
              value={format}
              onChange={setFormat}
              options={SHARE_FORMATS.map((f) => [f.id, f.name])}
            />
          </div>
          <p className="microcopy" style={{ color: 'var(--soft)' }}>{active.logic}</p>
          <code className="share-hint">{active.hint}</code>
        </div>

        {/* choose what to include */}
        {fields.length > 0 && (
          <div className="mb-4">
            <MonoLabel className="mb-2 block">include</MonoLabel>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {fields.map((f) => (
                <label key={f.id} className="flex items-center gap-2" style={{ cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={!!selected[f.id]}
                    onChange={(e) => setSelected((s) => ({ ...s, [f.id]: e.target.checked }))}
                  />
                  <span className="microcopy">{f.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* editable source ↔ live rendered preview */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <MonoLabel className="mb-1.5 block">text</MonoLabel>
            <textarea
              className="tp-input share-source"
              rows="11"
              value={text}
              onChange={(e) => setText(e.target.value)}
              aria-label="Shareable text"
            />
          </div>
          <div>
            <MonoLabel className="mb-1.5 block">preview</MonoLabel>
            <div className="share-preview" aria-live="polite">
              {text.trim() ? preview : <p className="microcopy">nothing selected</p>}
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <GhostButton onClick={onClose}>Done</GhostButton>
          <button className={PRIMARY} onClick={copy}>
            {copied ? 'Copied ✓' : 'Copy'}
          </button>
        </div>
      </div>
    </div>
  )
}
