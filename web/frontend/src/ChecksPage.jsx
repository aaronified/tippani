// Checks — one screen for the lists that are waiting on YOU: quotes carrying
// something the page left in them (CleanupPage) and the files in your library
// folders (FoundFilesPage, LocatorsPage, CorrectionsPage, AttachedFilesPage).
//
// NOT CALLED "REVIEW". That word is already the daily quiz and the
// spaced-repetition deck, and the deck is gone from the web app (ADR-0936).
//
// IT COMPOSES THE PAGES RATHER THAN ABSORBING THEM. Each keeps its own route, so an
// old bookmark still opens the page it named, and each takes an `embedded` flag that
// gives up the page header and the back link — the only two things a section cannot
// keep when it stops being a screen.
import { lazy, Suspense, useMemo, useState } from 'react'
import { t } from './i18n.js'
import { IconHighlight, IconSourceFile, PageHeader } from './ui.jsx'
import { SectionRail } from './sectionRail.jsx'

const CleanupPage = lazy(() => import('./CleanupPage.jsx'))
const LocatorsPage = lazy(() => import('./LocatorsPage.jsx'))
const CorrectionsPage = lazy(() => import('./CorrectionsPage.jsx'))
const FoundFilesPage = lazy(() => import('./FoundFilesPage.jsx'))
const AttachedFilesPage = lazy(() => import('./AttachedFilesPage.jsx'))

// TWO TABS, the same rail Settings and Metadata draw (a row of tabs on a desk, an index
// list on a phone). The imports queue left this screen with the file import (ADR-0936).
//
//   Stray marks  quotes carrying something the page left in them.
//   Files        what the files in your library folders have to say: files found for works,
//                times and places they propose, and where a quote differs from the file's
//                own words. Each section folds away and filters the same way.
const TABS = [
  ['marks', 'checks.tab.marks.label', <IconHighlight />],
  ['files', 'checks.tab.files.label', <IconSourceFile />],
]

// The Files tab's sections, each folded or open by itself. All open to begin with: what is
// here is what the last scan left to decide, and a section that draws nothing is not here.
function FilesTab({ onOpenBook, onOpenMovie }) {
  const [shut, setShut] = useState({})
  const fold = (id) => ({ open: !shut[id], onToggle: () => setShut((o) => ({ ...o, [id]: !o[id] })) })
  // WHAT EACH SECTION SAYS ABOUT ITSELF: undefined until it has read, then true if it draws something.
  // Each draws nothing when it has nothing, so when all four have answered "nothing" the tab would be
  // blank, which reads as broken. It says so instead. Until every one has answered it says nothing, so
  // "nothing waiting" is never claimed before the asking is done.
  const [present, setPresent] = useState({})
  const ids = ['found', 'locators', 'corrections', 'attached']
  const reporters = useMemo(
    () => Object.fromEntries(ids.map((id) => [id, (v) => setPresent((p) => (p[id] === v ? p : { ...p, [id]: v }))])),
    [], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const allEmpty = ids.every((id) => present[id] === false)
  return (
    <div className="space-y-8">
      {allEmpty && (
        <p className="microcopy" data-testid="files-empty">{t('checks.files.empty')}</p>
      )}
      {/* Files a mounted library holds for works that have quotes. Draws nothing, rule
          included, for a box with no folders mounted. */}
      <Suspense fallback={null}>
        <FoundFilesPage embedded {...fold('found')} onPresence={reporters.found} />
      </Suspense>
      {/* Times and places a work's file proposes for its lines. Draws nothing, rule
          included, when there is nothing to propose. */}
      <Suspense fallback={null}>
        <LocatorsPage embedded {...fold('locators')} onPresence={reporters.locators} onOpenBook={onOpenBook} onOpenMovie={onOpenMovie} />
      </Suspense>
      {/* Where a quote differs from the file's own words, in buckets. Draws nothing, rule
          included, when nothing differs. */}
      <Suspense fallback={null}>
        <CorrectionsPage embedded {...fold('corrections')} onPresence={reporters.corrections} onOpenBook={onOpenBook} onOpenMovie={onOpenMovie} />
      </Suspense>
      {/* The files attached to your works, biggest first, and the prune. Draws nothing for a
          reader with no uploaded file. */}
      <Suspense fallback={null}>
        <AttachedFilesPage embedded {...fold('attached')} onPresence={reporters.attached} />
      </Suspense>
    </div>
  )
}

export default function ChecksPage({ onOpenBook, onOpenMovie, onOpenQuotes }) {
  const [tab, setTab] = useState('marks')
  return (
    <section className="space-y-8" data-screen-label="checks">
      {/* Title only, and it is not drawn — see .page-header h1. The screen is
          named by the crumb and by the phone's header already; what is left here
          is the document's heading, which nothing else supplies. */}
      <PageHeader title={t('checks.title')} />
      <SectionRail
        sections={TABS.map(([id, label, icon]) => ({ id, label: t(label), icon }))}
        value={tab}
        onChange={setTab}
        ariaLabel={t('checks.tab.aria')}
      >
        <Suspense fallback={null}>
          {tab === 'marks' && (
            <CleanupPage embedded onOpenBook={onOpenBook} onOpenMovie={onOpenMovie} onOpenQuotes={onOpenQuotes} />
          )}
        </Suspense>
        {tab === 'files' && <FilesTab onOpenBook={onOpenBook} onOpenMovie={onOpenMovie} />}
      </SectionRail>
    </section>
  )
}
