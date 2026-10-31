import { useCallback, useEffect, useState } from 'react'
import { json } from './api.js'
import { t } from './i18n.js'
import { READ_MS, sourceFail, useSourcesChanged } from './sources.jsx'
import { Card, GhostButton, IconArrow, IconButton, IconCheck, IconClose, InfoDot, SectionHead, toast } from './ui.jsx'

// Times the subtitles propose for film lines, and places an EPUB proposes for a book's
// highlights (its chapter and a percent of the file's text) — a section of Checks.
//
// A line you kept has words and often no time. The subtitle the work keeps knows it,
// and the server has already placed each line in it (source_context), so everything
// here is read from rows: no file is opened, and nothing is written until you press.
//
// CLEANUP'S DOCTRINE, IN CLEANUP'S SHAPE: these are corrections to rows that exist,
// each shown with what it is now, what the file says, and the file's own words as
// evidence. A tick accepts and a red cross refuses, and a refusal is remembered.
//
// TWO GROUPS BY HOW MUCH JUDGEMENT A ROW NEEDS. An exact one — found once, word for
// word — has nothing for an eye to add, so those may be accepted together; that is a
// departure from Cleanup's "no accept-all", and it is stated here rather than
// quietly widened. A fuzzy one wants its evidence read, one press each. Bulk never
// crosses the two: the server refuses a mixed press and says how many it skipped.
//
// IT DRAWS NOTHING WHEN THERE IS NOTHING: a reader with no subtitles, or none that
// proposes a change, sees no empty section explaining itself.

// THE VERTICAL STEP IS THE SCREEN'S CONSTANT, not a number typed into each stack (the
// spacing ratchet counts `space-y-N` and may only fall).
const stack = { display: 'flex', flexDirection: 'column', gap: 'var(--row)' }

const range = (a, b) => (b && b !== a ? `${a} – ${b}` : a)

export default function LocatorsPage({ embedded = false, onOpenBook, onOpenMovie }) {
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const r = await json('GET', '/locators/proposals', undefined, { timeoutMs: READ_MS })
    // A read that failed is said once; the section then draws nothing, as when it is empty.
    if (!r.ok) toast(sourceFail(r))
    setData(r.ok ? r.data : { proposals: [], counts: { exact: 0, review: 0 } })
  }, [])
  useEffect(() => {
    load()
  }, [load])
  // A file attached elsewhere on this screen proposes times here.
  useSourcesChanged(load)

  async function press(path, bucket, items) {
    setBusy(true)
    const r = await json('POST', path, bucket ? { bucket, items } : { items }, { timeoutMs: READ_MS })
    setBusy(false)
    if (!r.ok) {
      toast(sourceFail(r))
      return
    }
    if (path.endsWith('/accept')) {
      const { applied = 0, stale = 0, skipped = 0 } = r.data || {}
      const parts = []
      if (applied) parts.push(t('locators.applied', { n: applied, count: applied }))
      if (stale) parts.push(t('locators.stale', { n: stale, count: stale }))
      if (skipped) parts.push(t('locators.skipped', { n: skipped, count: skipped }))
      if (parts.length) toast(parts.join(' · '))
    }
    load()
  }

  const wire = (p) => ({
    kind: p.kind,
    id: p.id,
    current_chapter: p.current_chapter,
    proposed_chapter: p.proposed_chapter,
    proposed: p.proposed,
    proposed_end: p.proposed_end,
    current: p.current,
    current_end: p.current_end,
  })

  if (!data || data.proposals.length === 0) return null
  const groups = [
    ['exact', data.proposals.filter((p) => p.bucket === 'exact')],
    ['review', data.proposals.filter((p) => p.bucket === 'review')],
  ].filter(([, list]) => list.length > 0)

  return (
    <>
      {embedded && <hr className="tp-rule" />}
      <section style={stack} data-screen-label="locators">
        <SectionHead
          embedded={embedded}
          title={t('locators.title')}
          counts={t('locators.counts', { exact: data.counts.exact, review: data.counts.review })}
          right={<InfoDot title={t('locators.info.title')} text={t('locators.info.body')} />}
        />
        <Card>
          <div style={stack}>
            {groups.map(([bucket, list]) => (
              <div key={bucket} style={stack} data-testid={`locators-${bucket}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="mono-label">{t(`locators.${bucket}.title`)}</h3>
                  <span className="microcopy">{t(`locators.${bucket}.note`)}</span>
                  {bucket === 'exact' && (
                    <span className="ml-auto">
                      <GhostButton
                        type="button"
                        disabled={busy}
                        onClick={() => press('/locators/accept', 'exact', list.map(wire))}
                      >
                        <IconCheck />
                        <span>{t('locators.accept.all', { n: list.length })}</span>
                      </GhostButton>
                    </span>
                  )}
                </div>
                {list.map((p) => {
                  // A book's highlight is proposed a place, a film's line a time: same row,
                  // same two presses, different words for what is being set.
                  const place = p.kind === 'annotation'
                  const open = place ? onOpenBook : onOpenMovie
                  const proposed = place
                    ? [p.proposed !== p.current && p.proposed, p.proposed_chapter !== p.current_chapter && p.proposed_chapter].filter(Boolean).join(' · ')
                    : range(p.proposed, p.proposed_end)
                  return (
                    <div key={`${p.kind}:${p.id}`} className="flex flex-wrap items-start gap-3" data-testid="locator-row">
                      <div className="min-w-0 flex-1 flex flex-col gap-1">
                        <p>{p.quote}</p>
                        <p className="microcopy">
                          <button type="button" className="tp-link" onClick={() => open?.(p.work_id)}>
                            {p.work_title}
                          </button>
                          {p.season || p.episode ? ` · S${p.season}E${p.episode}` : ''}
                        </p>
                        <p className="microcopy">
                          {t('locators.now')}: {p.current ? range(p.current, p.current_end) : t(place ? 'locators.none.place' : 'locators.none')}{' '}
                          <span className="import-arrow"><IconArrow size={12} /></span>{' '}
                          {t('locators.file.says')}: <b>{proposed}</b>
                        </p>
                        {p.evidence && p.evidence !== p.quote && <p className="microcopy" style={{ color: 'var(--soft)' }}>{p.evidence}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <IconButton
                          icon={<IconCheck />}
                          ariaLabel={place ? t('locators.accept.aria.place', { place: p.proposed }) : t('locators.accept.aria', { time: p.proposed })}
                          tooltip={t(place ? 'locators.accept.tip.place' : 'locators.accept.tip')}
                          disabled={busy}
                          onClick={() => press('/locators/accept', p.bucket, [wire(p)])}
                        />
                        <IconButton
                          icon={<IconClose />}
                          ariaLabel={t('locators.ignore.aria')}
                          tooltip={t('locators.ignore.tip')}
                          danger
                          disabled={busy}
                          onClick={() => press('/locators/ignore', null, [wire(p)])}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </Card>
      </section>
    </>
  )
}
