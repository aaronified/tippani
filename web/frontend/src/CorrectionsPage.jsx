import { useCallback, useEffect, useState } from 'react'
import { json } from './api.js'
import { t } from './i18n.js'
import { useSourcesChanged } from './sources.jsx'
import { Card, GhostButton, IconButton, IconCheck, IconClose, InfoDot, SectionHead, toast } from './ui.jsx'

// Corrections from the file — a section of Checks.
//
// A quote you kept can differ from the line as the file prints it: an OCR slip, a typo,
// a tidied quote, accents a subtitle lost. The server has the file's own words stored
// beside each quote (source_context), so every difference is read from rows: no file is
// opened, and nothing is written until you press.
//
// A SECTION OF ITS OWN, NOT A FOURTH FAMILY IN CLEANUP'S. Cleanup's rows show a snippet
// with the match marked and one rule's rewrite; this family's unit is a before/after
// PAIR of two whole wordings, grouped into buckets, with the file as evidence. Folding it
// into CleanupPage would have meant a second row shape inside a page that is built round
// one. The doctrine is Cleanup's and the shape is Locators': proposals, a durable refusal,
// accept.
//
// A BUCKET IS ONE KIND OF DIFFERENCE, which is what makes its bulk press safe, and bulk
// never crosses buckets. Every bucket has the same two verbs: the tick takes the file's
// words, the red cross keeps yours (and is remembered). A bulk tick skips the quotes you
// edited yourself since they arrived, and says how many it skipped: those are one press
// each.
//
// IT DRAWS NOTHING WHEN THERE IS NOTHING.

// The vertical step is the screen's constant (the spacing ratchet counts `space-y-N`).
const stack = { display: 'flex', flexDirection: 'column', gap: 'var(--row)' }

// marked draws `text` with its first `part` wrapped, so the pair differs in one visible
// place. A part that is not found (or empty) draws the text plain.
function Marked({ text, part }) {
  const i = part ? text.indexOf(part) : -1
  if (i < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, i)}
      <mark>{part}</mark>
      {text.slice(i + part.length)}
    </>
  )
}

const wire = (p) => ({ kind: p.kind, id: p.id, quote: p.quote, proposed: p.proposed })

export default function CorrectionsPage({ embedded = false, onOpenBook, onOpenMovie }) {
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState({})

  const load = useCallback(async () => {
    const r = await json('GET', '/corrections')
    setData(r.ok ? r.data : { buckets: [], proposals: [], wrong_file: [] })
  }, [])
  useEffect(() => {
    load()
  }, [load])
  // A file attached elsewhere on this screen brings its own differences.
  useSourcesChanged(load)

  async function press(path, body) {
    setBusy(true)
    const r = await json('POST', path, body)
    setBusy(false)
    if (!r.ok) {
      toast(r.data?.error || t('common.source.error'))
      return
    }
    if (path.endsWith('/accept')) {
      const { applied = 0, stale = 0, skipped = 0, skipped_edited: edited = 0, duplicates = 0 } = r.data || {}
      const parts = []
      if (applied) parts.push(t('corrections.applied', { n: applied, count: applied }))
      if (edited) parts.push(t('corrections.skipped.edited', { n: edited, count: edited }))
      if (stale) parts.push(t('corrections.stale', { n: stale, count: stale }))
      if (skipped) parts.push(t('corrections.skipped', { n: skipped, count: skipped }))
      if (duplicates) parts.push(t('corrections.duplicates', { n: duplicates, count: duplicates }))
      if (parts.length) toast(parts.join(' · '))
    }
    load()
  }

  const total = data ? data.proposals.length : 0
  if (!data || (total === 0 && data.wrong_file.length === 0)) return null
  const groups = data.buckets
    .map((b) => ({ ...b, rows: data.proposals.filter((p) => p.bucket === b.id) }))
    .filter((g) => g.rows.length > 0)

  return (
    <>
      {embedded && <hr className="tp-rule" />}
      <section style={stack} data-screen-label="corrections">
        <SectionHead
          embedded={embedded}
          title={t('corrections.title')}
          counts={t('corrections.counts', { n: total })}
          right={<InfoDot title={t('corrections.info.title')} text={t('corrections.info.body')} />}
        />
        <Card>
          <div style={stack}>
            {data.wrong_file.map((w) => (
              <p key={`${w.kind}:${w.work_id}`} className="microcopy" data-testid="corrections-wrong-file">
                <button
                  type="button"
                  className="tp-link"
                  onClick={() => (w.kind === 'screen' ? onOpenMovie?.(w.work_id) : onOpenBook?.(w.work_id))}
                >
                  {w.work_title}
                </button>
                {t('corrections.wrong.file', { differing: w.differing, total: w.total })}
              </p>
            ))}
            {groups.map((g) => {
              const isOpen = !!open[g.id]
              return (
                <div key={g.id} style={stack} data-testid={`corrections-${g.id}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="tp-link"
                      aria-expanded={isOpen}
                      onClick={() => setOpen((o) => ({ ...o, [g.id]: !o[g.id] }))}
                    >
                      <h3 className="mono-label">
                        {t(`corrections.bucket.${g.id}.title`)} · {g.rows.length}
                      </h3>
                    </button>
                    <span className="microcopy">{t(`corrections.bucket.${g.id}.note`)}</span>
                    <span className="ml-auto flex flex-wrap items-center gap-2">
                      <GhostButton
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          press('/corrections/accept', { bucket: g.id, bulk: true, items: g.rows.map(wire) })
                        }
                      >
                        <IconCheck />
                        <span>{t('corrections.take.all', { n: g.rows.length })}</span>
                      </GhostButton>
                      <GhostButton
                        type="button"
                        disabled={busy}
                        onClick={() => press('/corrections/ignore', { items: g.rows.map(wire) })}
                      >
                        <IconClose />
                        <span>{t('corrections.keep.all', { n: g.rows.length })}</span>
                      </GhostButton>
                    </span>
                  </div>
                  {isOpen &&
                    g.rows.map((p) => (
                      <div key={`${p.kind}:${p.id}`} className="flex flex-wrap items-start gap-3" data-testid="correction-row">
                        <div className="min-w-0 flex-1 flex flex-col gap-1">
                          <p dir="auto">
                            <span className="microcopy">{t('corrections.yours')}: </span>
                            <Marked text={p.quote} part={p.from} />
                          </p>
                          <p dir="auto">
                            <span className="microcopy">{t('corrections.file.says')}: </span>
                            <Marked text={p.proposed} part={p.to} />
                          </p>
                          <p className="microcopy">
                            {p.work_title && (
                              <button
                                type="button"
                                className="tp-link"
                                onClick={() => (p.kind === 'screen' ? onOpenMovie?.(p.work_id) : onOpenBook?.(p.work_id))}
                              >
                                {p.work_title}
                              </button>
                            )}
                            {p.edited && <span data-testid="correction-edited">{p.work_title ? ' · ' : ''}{t('corrections.edited')}</span>}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <IconButton
                            icon={<IconCheck />}
                            ariaLabel={t('corrections.take.aria')}
                            tooltip={t('corrections.take.tip')}
                            disabled={busy}
                            onClick={() => press('/corrections/accept', { bucket: p.bucket, bulk: false, items: [wire(p)] })}
                          />
                          <IconButton
                            icon={<IconClose />}
                            ariaLabel={t('corrections.keep.aria')}
                            tooltip={t('corrections.keep.tip')}
                            danger
                            disabled={busy}
                            onClick={() => press('/corrections/ignore', { items: [wire(p)] })}
                          />
                        </div>
                      </div>
                    ))}
                </div>
              )
            })}
          </div>
        </Card>
      </section>
    </>
  )
}
