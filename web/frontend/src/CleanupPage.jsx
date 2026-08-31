import { useEffect, useMemo, useState } from 'react'
import { errText, json } from './api.js'
import { t } from './i18n.js'
import {
  Card,
  EmptyState,
  FieldIconButton,
  FilterChip,
  GhostButton,
  IconBack,
  IconCheck,
  IconClose,
  IconHighlight,
  IconDialogue,
  IconOpen,
  IconQuote,
  IconRefresh,
  InfoDot,
  MonoLabel,
  SectionHead,
  Tooltip,
  toast,
  useIsMobileScreen,
} from './ui.jsx'

// Stray marks — every quote in the library, read once, and what a page left
// behind in it.
//
// A PAGE RATHER THAN A CARD, and the bin's argument (BinPage.jsx) applies here
// word for word: a settings card is a control panel, and this is a list of
// unbounded length whose rows carry four facts each — which rule fired, in which
// text, how many times, and the words around it. In a 300px grid column the
// snippet is the fact that gets truncated, and the snippet is the whole reason to
// look.
//
// IT REPORTED AND NEVER EDITED, AND NOW IT ASKS (2.2.1). The original note here
// said a fix button was worse than a list you read once, because every rule has a
// false positive that is somebody's real writing. That was an argument against a
// "fix all" — one press over five hundred finds with no diff — and it stands. What
// it ruled out too much of is the smaller control the reader actually asked for:
// **the rewrite, shown, accepted or refused one finding at a time**.
//
// So every finding now carries what it would become, drawn beside what it is, with
// the find marked in both — and two answers:
//
//	Accept   rewrites THAT field by THAT rule. Nothing else on the quote moves, and
//	         the server applies the rule itself rather than storing a string the
//	         client sent (cleanup_apply_handlers.go).
//	Ignore   remembers the refusal (0052) and takes the finding off this list. The
//	         words are untouched. It is remembered per FINDING, not per field, so
//	         accepting something else on the same quote does not bring it back.
//
// TWO BUCKETS, ONE SCAN. `To answer` and `Ignored` are two partitions of one walk
// on the server, so the counts cannot disagree; the reader can go and undo a
// refusal, which is the thing that makes refusing safe.
//
// STILL ONE ROUND TRIP PER VIEW. The rule filter is a view of a list already in
// hand; a bucket change and an answer are the only things that refetch, because
// both change what the list IS.

// The three kinds the sweep reports, in the bin's vocabulary. ONE VOCABULARY, not
// a second set of words for the same three things — a highlight is a দাগ on both
// screens — so these are bin.* keys, held as keys and resolved where they are
// drawn (a table of resolved words freezes the language at import time).
const KIND_LABELS = {
  book: 'bin.kind.annotation.label',
  screen: 'bin.kind.dialogue.label',
  quote: 'bin.kind.quote.label',
}

const KIND_ICONS = {
  book: <IconHighlight />,
  screen: <IconDialogue />,
  quote: <IconQuote />,
}

export default function CleanupPage({ onClose, onOpenBook, onOpenMovie, onOpenQuotes, embedded = false }) {
  const mobile = useIsMobileScreen()
  const [data, setData] = useState(null) // null = still reading
  const [rule, setRule] = useState('all')
  const [bucket, setBucket] = useState('open')
  const [busy, setBusy] = useState(false)
  // Bumped by an answer, which is what re-runs the sweep. A refetch rather than a
  // local edit: accepting can turn out to be stale or a duplicate, and the server's
  // second answer is the only honest one.
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    let stale = false
    setData(null)
    json('GET', `/cleanup?bucket=${bucket}`).then((r) => {
      if (stale) return
      if (!r.ok) {
        toast(errText(r, t('error.cleanup.generic')))
        // An empty answer rather than a permanent "reading…": a page stuck on its
        // loading line is indistinguishable from a slow server.
        return setData({ rules: [], items: [], scanned: 0, counts: {} })
      }
      setData(r.data)
    })
    return () => {
      stale = true
    }
  }, [bucket, nonce])

  // One finding, as the server identifies it. The hash is what makes an ignore
  // about THIS find rather than about the rule on the field for ever.
  const target = (it, f) => ({ kind: it.kind, id: it.id, field: f.field, rule: f.rule, match_hash: f.match_hash })

  async function answer(path, items, said) {
    setBusy(true)
    const r = await json('POST', path, { items })
    setBusy(false)
    if (!r.ok) return toast(errText(r, t('error.save.generic')))
    said(r.data || {})
    setNonce((n) => n + 1)
  }

  const accept = (items) =>
    answer('/cleanup/accept', items, ({ applied = 0, stale = 0, duplicates = 0 }) => {
      // Reported, not assumed. A finding whose text changed since the page was drawn
      // is stale, and a correction that would collide with another quote is a
      // duplicate — in both cases the words are still exactly as they were, which
      // the reader has to be told rather than left to notice.
      if (applied > 0) toast(t('cleanup.toast.applied', { n: applied }))
      if (stale > 0) toast(t('cleanup.toast.stale', { n: stale }))
      if (duplicates > 0) toast(t('cleanup.toast.duplicate', { n: duplicates }))
    })

  const setIgnored = (items, ignore) =>
    answer(ignore ? '/cleanup/ignore' : '/cleanup/unignore', items, () =>
      toast(ignore ? t('cleanup.toast.ignored', { n: items.length }) : t('cleanup.toast.restored', { n: items.length })),
    )

  // MEMOISED ON `data`, NOT ON A DERIVED ARRAY. `data?.items || []` is a fresh
  // array every render, so a memo keyed on it recomputes every render and — worse
  // — the effect below that watches `chips` would fire on every render too.
  // Keying everything on the one thing that actually changes fixes both.
  const items = useMemo(() => data?.items || [], [data])

  // How many times each rule fired, across the whole sweep. The counts are what
  // decide which chips exist: a chip for a rule that found nothing is a control
  // that can only ever empty the list.
  const hits = useMemo(() => {
    const out = new Map()
    for (const it of items) {
      for (const f of it.findings) out.set(f.rule, (out.get(f.rule) || 0) + 1)
    }
    return out
  }, [items])

  // In the SERVER's order, which is the order a reader is likely to care about —
  // not the order the chips happen to be counted in. resp.rules is the whole set
  // whether or not it fired, which is exactly what makes this filterable.
  const chips = useMemo(() => (data?.rules || []).filter((r) => hits.has(r)), [data, hits])

  const shown = rule === 'all' ? items : items.filter((it) => it.findings.some((f) => f.rule === rule))

  // A filter that outlives what it was filtering would leave the page reading
  // "nothing of that kind" over a list with rows in it. Nothing can remove a
  // finding while the page is open — there is no fix button — but a refetch after
  // an edit elsewhere can, so the guard is here for the same reason the bin's is.
  useEffect(() => {
    if (rule !== 'all' && data && !chips.includes(rule)) setRule('all')
  }, [rule, chips, data])

  const counts =
    data === null
      ? ''
      : [
          t('common.count.phrase', { n: items.length, noun: t('unit.quote', { count: items.length }) }),
          t('cleanup.counts.scanned', {
            n: data.scanned,
            noun: t('unit.quote', { count: data.scanned }),
          }),
        ].join(' · ')
  const ignoredCount = data?.counts?.ignored ?? 0

  // Where a row's quote lives. A book highlight and a film line open their work;
  // a standalone quote has none, so it opens the board list it is filed on.
  //
  // NOT A DEEP LINK TO THE QUOTE ITSELF, and deliberately not: nothing else in
  // this app can focus one quote inside a work, and inventing that mechanism for
  // the one screen that never edits anything is the wrong place to start. The
  // snippet is what finds the line once you are there.
  function open(it) {
    if (it.kind === 'book') return onOpenBook(it.work_id)
    if (it.kind === 'screen') return onOpenMovie(it.work_id)
    return onOpenQuotes()
  }

  return (
    <section className="space-y-6" data-screen-label="cleanup">
      <div className={mobile && !embedded ? 'mobile-sticky-bar' : ''}>
        {/* Named, not a bare arrow — the same reason the bin's is. One door in
            means the way out has to say where it goes. Suppressed when embedded
            in Checks: the section is not somewhere you navigated to, so there is
            nothing there to go back FROM. */}
        {!embedded && (
          <Tooltip label={t('cleanup.back.tip')} side="bottom">
            <button type="button" className="page-back" onClick={onClose}>
              <IconBack />
              <MonoLabel>{t('nav.tab.settings.label')}</MonoLabel>
            </button>
          </Tooltip>
        )}
        {/* The dot rides in the header rather than on a label row of its own: the
            page has no controls to sit beside, and a lone MonoLabel repeating the
            title above it is a second copy of the same word. */}
        <SectionHead
          embedded={embedded}
          title={t('cleanup.title')}
          counts={counts}
          right={<InfoDot title={t('cleanup.info.title')} text={t('cleanup.info.body')} />}
        />
      </div>

      <Card>
        <div className="space-y-4">
          {/* THE TWO BUCKETS, and the Ignored one is drawn even at zero — unlike
              the rule chips below, which only exist for a rule that fired. It is
              not a filter over what is on screen; it is the other half of the page,
              and somebody who has just pressed Ignore has to be able to find what
              they ignored. */}
          <div className="flex flex-wrap items-center gap-2">
            <FilterChip
              active={bucket === 'open'}
              keepLabel
              label={t('cleanup.bucket.open.label')}
              onClick={() => { setBucket('open'); setRule('all') }}
            />
            <FilterChip
              active={bucket === 'ignored'}
              keepLabel
              label={t('cleanup.bucket.ignored.label', { n: ignoredCount })}
              onClick={() => { setBucket('ignored'); setRule('all') }}
            />
            <span className="ml-auto">
              <GhostButton icon={<IconRefresh />} onClick={() => setNonce((n) => n + 1)} disabled={busy}>
                {t('cleanup.rescan.label')}
              </GhostButton>
            </span>
          </div>

          {/* THE RULE LEGEND IS THE FILTER. Two lists — "here is what I look for"
              and "here is what I found" — would say the same thing twice, so a
              chip carries its rule's name, its count, and its one-line
              explanation in the bubble. */}
          {chips.length > 1 && (
            <div className="flex flex-wrap items-center gap-2">
              <FilterChip
                active={rule === 'all'}
                keepLabel
                label={t('cleanup.filter.all.label')}
                onClick={() => setRule('all')}
              />
              {chips.map((r) => (
                // The bubble carries the rule's one-line explanation. FilterChip
                // only grows its own tooltip when it can lose its words to the
                // Button labels preference, and these keep them — so the wrapper
                // is what gives a rule somewhere to explain itself.
                <Tooltip key={r} label={t(`cleanup.rule.${r}.body`)} side="top">
                  <FilterChip
                    active={rule === r}
                    keepLabel
                    label={`${t(`cleanup.rule.${r}.label`)} ${t('cleanup.row.times', { n: hits.get(r) })}`}
                    onClick={() => setRule(r)}
                  />
                </Tooltip>
              ))}
            </div>
          )}

          {/* THERE IS NO ACCEPT-ALL, and it was here for one afternoon. It is the
              control cleanup.go's original note was arguing against, one filter
              narrower: a press that rewrites up to five hundred fields on rules that
              each carry a known false positive, with the diffs scrolled past rather
              than read. The row's own button is the feature; a button that skips the
              row is the feature undone. Nobody asked for it either. */}

          {data === null && <p className="microcopy">{t('cleanup.state.loading')}</p>}
          {data !== null && items.length === 0 && (
            <EmptyState>{bucket === 'ignored' ? t('cleanup.state.none-ignored') : t('cleanup.state.clean')}</EmptyState>
          )}
          {data !== null && items.length > 0 && shown.length === 0 && (
            <EmptyState>{t('cleanup.state.clean-rule')}</EmptyState>
          )}

          {data?.truncated && (
            <p className="microcopy">
              {t('cleanup.state.truncated', {
                count: t('common.count.phrase', {
                  n: items.length,
                  noun: t('unit.quote', { count: items.length }),
                }),
              })}
            </p>
          )}

          {shown.length > 0 && (
            <ul className="cleanup-list">
              {shown.map((it) => {
                const label = it.work_title || t('cleanup.row.no-work.label')
                // Filtered inside the row too, so picking a rule shows that rule's
                // finds rather than every find on a quote that happens to have one.
                const found = rule === 'all' ? it.findings : it.findings.filter((f) => f.rule === rule)
                return (
                  <li key={`${it.kind}-${it.id}`} className="cleanup-row">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="cleanup-kind">{KIND_ICONS[it.kind]}</span>
                      <MonoLabel>{t(KIND_LABELS[it.kind])}</MonoLabel>
                      <span className="cleanup-work">{label}</span>
                      <span className="ml-auto">
                        <FieldIconButton
                          icon={<IconOpen />}
                          ariaLabel={t('cleanup.row.open.aria', { label })}
                          tooltip={t('cleanup.row.open.tip')}
                          onClick={() => open(it)}
                        />
                      </span>
                    </div>
                    <ul className="cleanup-finds">
                      {found.map((f, i) => (
                        <li key={`${f.rule}-${f.field}-${i}`}>
                          <p className="microcopy">
                            {[
                              t(`cleanup.rule.${f.rule}.label`),
                              t(`cleanup.field.${f.field}.label`),
                              f.count > 1 && t('cleanup.row.times', { n: f.count }),
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                          {/* THE SNIPPET IS THE EVIDENCE. Half these rules find
                              something with no appearance at all, so the
                              guillemets the server marks the find with are the
                              only thing to see — and the CSS keeps whitespace
                              rather than collapsing it, which is what makes two
                              spaces look like two. */}
                          <p className="cleanup-snippet">{f.snippet}</p>
                          {/* AND WHAT IT WOULD BECOME, in the same context and marked
                              the same way. Both lines come from the server, produced by
                              the function that does the writing — so what is on screen
                              is what will happen, rather than a diff this page computed
                              and hoped matched. The first version drew the whole
                              rewritten field here, unmarked, which in a long quote left
                              the reader comparing two paragraphs by eye. A rule with no
                              rewrite in this build sends no snippet, and then there is
                              nothing to accept. */}
                          {f.after_snippet && (
                            <p className="cleanup-after">
                              <span className="cleanup-arrow" aria-hidden="true">→</span>
                              {f.after_snippet}
                            </p>
                          )}
                          <div className="cleanup-answers">
                            {bucket === 'open' ? (
                              <>
                                {f.after_snippet && (
                                  <GhostButton
                                    icon={<IconCheck />}
                                    keepLabel
                                    disabled={busy}
                                    onClick={() => accept([target(it, f)])}
                                  >
                                    {t('cleanup.accept.label')}
                                  </GhostButton>
                                )}
                                <Tooltip label={t('cleanup.ignore.tip')}>
                                  <GhostButton
                                    icon={<IconClose />}
                                    keepLabel
                                    disabled={busy}
                                    onClick={() => setIgnored([target(it, f)], true)}
                                  >
                                    {t('cleanup.ignore.label')}
                                  </GhostButton>
                                </Tooltip>
                              </>
                            ) : (
                              <GhostButton
                                icon={<IconRefresh />}
                                keepLabel
                                disabled={busy}
                                onClick={() => setIgnored([target(it, f)], false)}
                              >
                                {t('cleanup.restore.label')}
                              </GhostButton>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </Card>
    </section>
  )
}
