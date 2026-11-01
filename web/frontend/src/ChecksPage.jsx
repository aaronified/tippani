// Checks — one screen for the two lists that are waiting on YOU.
//
// It merges two pages that were already written and were each reachable only by
// a tile buried in Settings: the pending-import queue (StagingPage) and stray
// marks (CleanupPage). Settings is where you go to change how the app behaves,
// not to discover it has been holding forty quotes for a fortnight — so the
// count now rides the rail and the drawer, and this is where both rows land.
//
// NOT CALLED "REVIEW". That word is already the daily quiz and the
// spaced-repetition deck. Two meanings for one word in one app is how a rename
// becomes a support question.
//
// THE STAGING INVARIANT IS UNTOUCHED. Imports still land in the queue and are
// still approved out of it; nothing here writes to the library. What changed is
// that a waiting import is visible from every screen instead of found by
// accident — a better door, not a shorter path.
//
// IT COMPOSES THE TWO PAGES RATHER THAN ABSORBING THEM. Both keep their own
// routes, so an old bookmark still opens the page it named, and both take an
// `embedded` flag that gives up the page header and the back link — the only two
// things a section cannot keep when it stops being a screen.
import { lazy, Suspense, useState } from 'react'
import { t } from './i18n.js'
import { IconHighlight, IconImport, IconSourceFile, PageHeader } from './ui.jsx'
import { SectionRail } from './sectionRail.jsx'

const StagingPage = lazy(() => import('./StagingPage.jsx'))
const CleanupPage = lazy(() => import('./CleanupPage.jsx'))
const LocatorsPage = lazy(() => import('./LocatorsPage.jsx'))
const CorrectionsPage = lazy(() => import('./CorrectionsPage.jsx'))
const FoundFilesPage = lazy(() => import('./FoundFilesPage.jsx'))
const AttachedFilesPage = lazy(() => import('./AttachedFilesPage.jsx'))

// THREE TABS, the same rail Settings and Metadata draw (a row of tabs on a desk, an index
// list on a phone). It was one long page of six sections; the three below are what a
// reader actually comes to do, and the file sections belong together because every one of
// them is about what a file says.
//
//   Imports      what is waiting to be approved. First: a queue somebody is waiting on is
//                more urgent than a sweep that found a stray bracket.
//   Stray marks  quotes carrying something the page left in them.
//   Files        what the files in your library folders have to say: files found for works,
//                times and places they propose, and where a quote differs from the file's
//                own words. Each section folds away and filters the same way.
const TABS = [
  ['imports', 'checks.tab.imports.label', <IconImport />],
  ['marks', 'checks.tab.marks.label', <IconHighlight />],
  ['files', 'checks.tab.files.label', <IconSourceFile />],
]

// The Files tab's sections, each folded or open by itself. All open to begin with: what is
// here is what the last scan left to decide, and a section that draws nothing is not here.
function FilesTab({ onOpenBook, onOpenMovie }) {
  const [shut, setShut] = useState({})
  const fold = (id) => ({ open: !shut[id], onToggle: () => setShut((o) => ({ ...o, [id]: !o[id] })) })
  return (
    <div className="space-y-8">
      {/* Files a mounted library holds for works that have quotes. Draws nothing, rule
          included, for a box with no folders mounted. */}
      <Suspense fallback={null}>
        <FoundFilesPage embedded {...fold('found')} />
      </Suspense>
      {/* Times and places a work's file proposes for its lines. Draws nothing, rule
          included, when there is nothing to propose. */}
      <Suspense fallback={null}>
        <LocatorsPage embedded {...fold('locators')} onOpenBook={onOpenBook} onOpenMovie={onOpenMovie} />
      </Suspense>
      {/* Where a quote differs from the file's own words, in buckets. Draws nothing, rule
          included, when nothing differs. */}
      <Suspense fallback={null}>
        <CorrectionsPage embedded {...fold('corrections')} onOpenBook={onOpenBook} onOpenMovie={onOpenMovie} />
      </Suspense>
      {/* The files attached to your works, biggest first, and the prune. Draws nothing for a
          reader with no uploaded file. */}
      <Suspense fallback={null}>
        <AttachedFilesPage embedded {...fold('attached')} />
      </Suspense>
    </div>
  )
}

export default function ChecksPage({ onPending, onOpenBook, onOpenMovie, onApproved, onOpenQuotes }) {
  const [tab, setTab] = useState('imports')
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
          {tab === 'imports' && (
            <StagingPage
              embedded
              onPending={onPending}
              onOpenBook={onOpenBook}
              onOpenMovie={onOpenMovie}
              onApproved={onApproved}
            />
          )}
          {tab === 'marks' && (
            <CleanupPage embedded onOpenBook={onOpenBook} onOpenMovie={onOpenMovie} onOpenQuotes={onOpenQuotes} />
          )}
        </Suspense>
        {tab === 'files' && <FilesTab onOpenBook={onOpenBook} onOpenMovie={onOpenMovie} />}
      </SectionRail>
    </section>
  )
}
