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
import { lazy, Suspense } from 'react'
import { t } from './i18n.js'
import { PageHeader } from './ui.jsx'

const StagingPage = lazy(() => import('./StagingPage.jsx'))
const CleanupPage = lazy(() => import('./CleanupPage.jsx'))

export default function ChecksPage({ onPending, onOpenBook, onOpenMovie, onApproved, onOpenQuotes }) {
  return (
    <section className="space-y-8" data-screen-label="checks">
      {/* Title only, and it is not drawn — see .page-header h1. The screen is
          named by the crumb and by the phone's header already; what is left here
          is the document's heading, which nothing else supplies. The counts and
          the explanation went with the visible title: each section states its own
          count beside its own name, which is the only place either means
          anything. */}
      <PageHeader title={t('checks.title')} />
      {/* Imports lead. A queue somebody is waiting on is more urgent than a
          sweep that found a stray bracket, and the order says so once rather
          than through a badge on each. */}
      <Suspense fallback={null}>
        <StagingPage
          embedded
          onPending={onPending}
          onOpenBook={onOpenBook}
          onOpenMovie={onOpenMovie}
          onApproved={onApproved}
        />
      </Suspense>
      <hr className="tp-rule" />
      <Suspense fallback={null}>
        <CleanupPage
          embedded
          onOpenBook={onOpenBook}
          onOpenMovie={onOpenMovie}
          onOpenQuotes={onOpenQuotes}
        />
      </Suspense>
    </section>
  )
}
