import { useState } from 'react'
import { errText, uploadWithProgress } from './api.js'
import { t, tNodes } from './i18n.js'
import { IconArrow, IconImport, IconWarning, ProgressBar } from './ui.jsx'
import { IMPORT_ACCEPT, sourceTitle } from './importSources.js'

// ONE TARGET, AND THE BYTES SAY WHAT THE FILE IS.
//
// THE OWNER'S: "import should be single upload (and a drag and drop target) in
// the first screen." What was here was a wall of seven cards — Markdown,
// Bookcision, Hardcover, Goodreads, IMDb, Kindle notebook, My Clippings — each
// with its own file input, and a searchable format picker on the phone because
// seven cards do not fit one. The reader had to answer "which of these is my
// file" before the app would look at it, and the app is better placed to answer
// that than they are: every one of those formats has a signature in its first
// bytes. So the question is gone and `POST /import/auto` sniffs instead
// (internal/httpapi/import_auto.go).
//
// THE HOW-TOS ARE HELP NOW, not a disclosure on this screen. "Where do I get a
// Goodreads file" is a real question and the eight step-lists are the answer —
// but they are reference rather than a control, and they were the only reason
// this screen still carried a fold. They are the `import` help section, one
// press of the "?" in the header above away, and the plan's line for why is the
// one that decides it: a list belongs in help. This screen kept its own copy for
// one release, which made the same eight rows two things to keep in step.
//
// AND THE SNIFFER CAN BE WRONG, so a row that failed offers "Read this as…".
// That is not politeness: detection failure is the one import fault the staging
// queue cannot repair — `retarget` moves staged rows between works, not a file
// between parsers — so a Goodreads page read as Hardcover parses empty and no
// bulk edit rescues it.
//
// An import still writes nothing into the library: it parses into the staging
// queue and answers a batch id and a staged count, and the rows below report
// what was STAGED.

// THE SOURCE TABLE MOVED OUT (importSources.js) when the help guide became its
// second reader. This screen still needs it for two things — the `accept` filter
// and the "Read this as…" list — and the step-lists it used to draw are now the
// `import` help section, so the list lives in one place and this screen holds
// none of it.

// THE OVERRIDE'S SLUGS ARE THE SERVER'S, and they are NOT the seven route
// names. `POST /import/auto` matches `as` against `importSources`, whose keys
// are the `importer.Source*` constants (`md`, `kindle_notebook`, …) — the routes
// spell the same formats with hyphens. One table, here, because the mismatch is
// exactly the sort a second copy gets wrong silently: an unknown slug is a 400
// and the reader sees "unknown import source" for a file that was fine.
const READ_AS = [
  { as: 'md', kind: 'markdown' },
  { as: 'readest_json', kind: 'readest' },
  { as: 'bookcision', kind: 'bookcision' },
  { as: 'hardcover_html', kind: 'hardcover-html' },
  { as: 'goodreads_html', kind: 'goodreads-html' },
  { as: 'imdb', kind: 'imdb-quotes' },
  { as: 'kindle_notebook', kind: 'kindle-notebook' },
  { as: 'kindle_clippings', kind: 'kindle-clippings' },
]

// The six things a file can BE that it cannot be imported as. The server names
// which one in `near_miss` and the words are the app's, because they point at
// the door that does take the file — Restore, Type — and those are screen names
// this locale file already owns.
const NEAR_MISS = new Set(['backup', 'zip', 'epub', 'image', 'font', 'binary'])

export default function ImportPage({ onReviewImport, onStaged }) {
  const [rows, setRows] = useState(null) // per-file, in batch order
  const [summary, setSummary] = useState('')
  const [staged, setStaged] = useState(0) // this run's total, for the hand-over
  const [busy, setBusy] = useState(false)

  // HOW FAR THE FILE IN HAND HAS GOT, 0..1, or null when nothing is uploading.
  //
  // A 5 MB clippings file staging tens of thousands of rows showed NOTHING: the
  // row said "pending" from the first byte to the last, so a reader on a slow
  // link could not tell a large upload from a hung one. `upload()` cannot report
  // this — fetch has no upload-progress event at all — which is why
  // `uploadWithProgress` exists and why moving to it is the whole fix rather
  // than a spinner.
  const [pct, setPct] = useState(null)

  // ONE REQUEST PER FILE (§10 bulk contract), and `as` rides with the bytes.
  async function post(file, as) {
    // THE FORM IS BUILT HERE because uploadWithProgress takes a prepared
    // FormData rather than a file — the same two lines `upload()` runs, kept
    // beside the call that needs them rather than added as a third helper.
    const form = new FormData()
    form.append('file', file)
    if (as) form.append('as', as)
    setPct(0)
    // NO TIMEOUT, DELIBERATELY, and the plan says why in the API's own words: "a
    // timeout on an import or a backup would abort work the server is really
    // doing". uploadWithProgress has none and must not gain one.
    const r = await uploadWithProgress('/import/auto', form, setPct)
    setPct(null)
    if (r.ok) return { name: file.name, file, as, ok: true, ...r.data }
    // `near_miss` PRESENT means the sniffer reached a verdict: a name for what
    // the file is, or "" for a text file nothing claimed. Absent means the
    // failure happened after a parser took it, and that parser's own message is
    // the better one — it says which line broke.
    const miss = typeof r.data?.near_miss === 'string' ? r.data.near_miss : null
    return {
      name: file.name,
      file,
      as,
      ok: false,
      // Only an unclaimed file gets the override. A backup or a JPEG is not a
      // parser away from working, and offering a format list for one would
      // invite the reader to try eight of them.
      unclaimed: miss === '',
      error:
        miss === ''
          ? t('import.unknown.body')
          : miss
            ? t(`import.near-miss.${NEAR_MISS.has(miss) ? miss : 'binary'}`)
            : errText(r, t('error.import.failed')),
    }
  }

  function tally(list) {
    const total = list.reduce((n, r) => n + (r.ok ? r.staged || 0 : 0), 0)
    setStaged(total)
    setSummary(
      t('import.summary.arrow', {
        files: t('import.summary.files', { count: list.length, n: list.length }),
        quotes: t('import.summary.quotes', { count: total, n: total }),
      }),
    )
    onStaged?.()
  }

  async function runBatch(files) {
    if (busy || files.length === 0) return
    setBusy(true)
    setSummary('')
    setStaged(0)
    const next = files.map((f) => ({ name: f.name, file: f, pending: true }))
    setRows([...next])
    for (let i = 0; i < files.length; i++) {
      next[i] = await post(files[i])
      setRows([...next])
    }
    tally(next)
    setBusy(false)
  }

  // The reader's answer, on one row. It replaces that row rather than starting a
  // batch, so the files that landed stay reported.
  async function reread(i, as) {
    if (busy) return
    setBusy(true)
    const next = [...rows]
    next[i] = { ...next[i], pending: true }
    setRows([...next])
    next[i] = await post(next[i].file, as)
    setRows([...next])
    tally(next)
    setBusy(false)
  }

  return (
    <section className="flex flex-col gap-4">
      <DropTarget busy={busy} pct={pct} onFiles={runBatch} />
      {rows && <BatchResults rows={rows} summary={summary} staged={staged} busy={busy} onReviewImport={onReviewImport} onReread={reread} />}
      <NothingLandsYetNote />
      <SaveDontPasteNote />
    </section>
  )
}

// DropTarget — the one upload, and the one thing a file can be dropped on.
//
// A LABEL WRAPPING THE INPUT is the whole control: the well IS the button, so
// there is no "press this, or alternatively drop there" to read. `tp-btn` inside
// it would be a second press-target inside a press-target, which is why the
// inner line is plain text.
function DropTarget({ busy, pct, onFiles }) {
  const [over, setOver] = useState(false)
  return (
    <label
      className={'import-drop' + (over ? ' is-over' : '') + (busy ? ' is-busy' : '')}
      onDragOver={(e) => {
        e.preventDefault()
        if (!busy) setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        if (!busy) onFiles([...e.dataTransfer.files])
      }}
    >
      <IconImport size={22} />
      {/* The busy word is the app's own upload verb, not an import-only twin:
          a second string for the same moment is one more thing to translate and
          one more place for the two to drift apart. */}
      <span className="import-drop-label">{t(busy ? 'common.action.upload.busy' : 'import.choose.label')}</span>
      <span className="microcopy">{t('import.drop.hint')}</span>
      {/* HOW FAR THE BYTES HAVE GOT, on the control that is sending them. A
          separate progress row would be a second place to look while the first
          one still says "uploading"; this is the same well, filling.
          INDETERMINATE AT 0 is deliberate and is what ProgressBar does with
          `max <= 0`: the fraction is honest only once the browser has a total,
          and a bar pinned at zero reads as stalled rather than as starting. */}
      {pct != null && <ProgressBar value={Math.round(pct * 100)} max={pct > 0 ? 100 : 0} />}
      <input
        type="file"
        multiple
        accept={IMPORT_ACCEPT}
        /* sr-only, NOT `hidden`: a display:none input cannot take focus, so the
           label around it would be a control no keyboard could reach. This is
           the pattern Settings' typeface upload already uses. */
        className="sr-only"
        disabled={busy}
        onChange={(e) => {
          const fs = [...e.target.files]
          e.target.value = ''
          if (fs.length > 0) onFiles(fs)
        }}
      />
    </label>
  )
}

// SaveDontPasteNote records why imports are save-the-page-and-upload rather than
// "paste a URL and we'll fetch it" (a natural question). Collapsed by default —
// an expand action for those interested — so it doesn't clutter the page.
function SaveDontPasteNote() {
  return (
    <details className="import-note">
      <summary className="mono-label cursor-pointer" style={{ listStyle: 'revert' }}>
        {t('import.why-upload.summary')}
      </summary>
      <p className="mt-2" style={{ fontSize: 'var(--type-ui-13)', lineHeight: 1.55 }}>
        {tNodes('import.why-upload.body', {
          emphasis: <i>{t('import.why-upload.emphasis')}</i>,
        })}
      </p>
    </details>
  )
}

// BatchResults — accent-barred card: a summary line, one mono row per file, and
// the hand-over to the pending queue. Rows report what was STAGED and where each
// work will land if approved; the added/skipped/enriched counters now belong to
// the approval, so they are reported there.
function BatchResults({ rows, summary, staged, busy, onReviewImport, onReread }) {
  return (
    <div className="hand-card hc-r2 space-y-1.5 p-4" style={{ borderInlineStart: '4px solid var(--accent)' }}>
      {summary && (
        <p className="microcopy" style={{ color: 'var(--ink)' }}>
          {summary}
        </p>
      )}
      {rows.map((r, i) => (
        <div key={i}>
          <p className="microcopy">
            {r.name}{' '}<IconArrow size={12} />{' '}
            {r.pending ? (
              '…'
            ) : r.ok ? (
              t('import.row.staged', { count: r.staged, n: r.staged })
            ) : (
              <span style={{ color: 'var(--error)' }}>{r.error}</span>
            )}
          </p>
          {/* THE SECOND DOOR, and only where it can help — see `post`. */}
          {r.unclaimed && (
            <label className="microcopy flex flex-wrap items-center gap-2">
              {t('import.read-as.label')}
              <select
                className="tp-input w-auto"
                value={r.as || ''}
                disabled={busy}
                aria-label={t('import.read-as.aria')}
                onChange={(e) => e.target.value && onReread(i, e.target.value)}
              >
                <option value="">{t('import.read-as.placeholder')}</option>
                {READ_AS.map((o) => (
                  <option key={o.as} value={o.as}>{sourceTitle(o.kind)}</option>
                ))}
              </select>
            </label>
          )}
          {r.ok && <ClippingsNotice row={r} />}
          {r.ok && (r.works || []).map((w) => <StagedWorkNotice key={w.id} work={w} />)}
          {r.ok && r.possible_duplicates && r.possible_duplicates.length > 0 && (
            <p className="microcopy" style={{ color: 'var(--amber, var(--accent-ui))' }}>
              {t('import.row.duplicate', {
                titles: r.possible_duplicates.map((d) => d.title).join(', '),
              })}
            </p>
          )}
        </div>
      ))}
      {staged > 0 && onReviewImport && (
        <button className="tp-btn tp-btn-primary mt-1.5" onClick={onReviewImport}>
          {t('import.review', { count: staged, n: staged })}
        </button>
      )}
      {staged > 0 && !onReviewImport && (
        <p className="microcopy" style={{ color: 'var(--accent-ui)' }}>
          {t('import.review.absent')}
        </p>
      )}
    </div>
  )
}

// StagedWorkNotice says where one parsed work will land — a new row, or a title
// already in the library — and flags an ambiguous match. This is the check the
// 1.1.1 routing bug wanted: it happens before the write, not after it.
function StagedWorkNotice({ work }) {
  // The three media the parser can report, each named by the app's shared noun.
  const kindWord = t(work.kind === 'book' ? 'unit.book' : work.kind === 'show' ? 'unit.show' : 'unit.film', {
    count: 1,
  })
  return (
    <div className="microcopy" style={{ color: 'var(--soft)' }}>
      <span>
        {work.title} ({work.staged}){' '}<IconArrow size={12} />{' '}
        {work.target_id
          ? work.target_year
            ? t('import.work.joins-year', {
                title: work.target_title || work.title,
                year: work.target_year,
              })
            : t('import.work.joins', { title: work.target_title || work.title })
          : t('import.work.new', { kind: kindWord })}
      </span>
      {work.ambiguous && (
        <p style={{ color: 'var(--amber, var(--accent-ui))' }}>
          {t('import.work.ambiguous', { n: work.alternatives + 1, title: work.title })}
        </p>
      )}
    </div>
  )
}

// NothingLandsYetNote states the contract of the screen once, in place, so the
// absence of "12 added" is understood rather than read as a failure.
function NothingLandsYetNote() {
  return (
    <p className="import-note microcopy">
      {tNodes('import.nothing-lands.body', { queue: <b>{t('staging.title')}</b> })}
    </p>
  )
}

// ClippingsNotice reports what a My Clippings.txt import dropped. A best-effort
// parser that quietly returns fewer quotes than the file held is worse than one
// that says so, so every skipped record is accounted for on screen.
function ClippingsNotice({ row }) {
  const parts = []
  const say = (key, n) => t(key, { count: n, n })
  if (row.bookmarks_skipped) parts.push(say('import.clippings.bookmarks', row.bookmarks_skipped))
  if (row.notes_merged) parts.push(say('import.clippings.notes', row.notes_merged))
  if (row.near_duplicates) parts.push(say('import.clippings.duplicates', row.near_duplicates))
  if (row.blocks_malformed) parts.push(say('import.clippings.malformed', row.blocks_malformed))
  if (parts.length === 0) return null
  return (
    <p className="microcopy" style={{ color: row.blocks_malformed ? 'var(--amber, var(--accent-ui))' : 'var(--soft)' }}>
      {row.blocks_malformed ? <IconWarning size={12} /> : null}
      {row.blocks_malformed ? ' ' : ''}
      {parts.join(' · ')}
    </p>
  )
}
