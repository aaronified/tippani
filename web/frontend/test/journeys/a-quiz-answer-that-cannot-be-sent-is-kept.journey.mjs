// A reader answers a quiz card while the server cannot be reached, moves on at
// once, refreshes, and the answer is still theirs: when the server can be
// reached again, it goes out by itself and their score counts it.
//
// THE OWNER'S REPORT, 1 October: "this saving thing is often a long thing … If i
// click next at this point, it progresses without saving and then after the quiz
// is over it again comes back on page refresh", then a screenshot: "4 registered.
// 1 didn't. Now on page refresh, that will come back." And the ask: "can the whole
// quiz be recorded before syncing if sync takes a long time? That way the sync
// will not even be visible to users … make sure that the sync keeps on retrying."
//
// WHY PRACTICE AND NOT THE DAILY QUIZ. Both send through the same keeper, and the
// golden library has nothing due today (it was seeded inside the week a new card
// waits), so the Daily card shows "nothing due" and has no card to answer.
// Practice deals from the whole library. What the Daily card does with a kept
// answer — leaves its card out of the deck and counts it — is the dom test
// `daily-quiz-kept-answers.test.jsx`.
//
// WHY A JOURNEY. The failure is a browser's: a request that does not land, a page
// reloaded under it, storage that outlives the page. A Go test proves the server
// takes an answer twice as one (review_kept_answer_test.go); only a page can say
// whether an answer survives a refresh and goes out when the server is back.
//
// DECLARED EXCEPTIONS, and what each knows:
//   - `app.page`'s request interception REFUSES THE ANSWER'S ADDRESS, POST
//     /api/review/answer, to stand for a server the phone cannot reach. Taking the
//     whole browser offline (`setOfflineMode`, as a-restore-starts-with-a-backup
//     does) would also stop the page itself loading on the refresh, which is the
//     step this is about; only the send has to fail.
//   - `app.page.waitForResponse` waits for that address to answer 200 once it is
//     reachable again, because the sending is invisible by design: there is no
//     word on the screen that says "sent", and the owner asked for none.
//
// THE MUTATIONS, each built and run and put back, each red at the wait for the
// 200 (nothing was sent):
//   - kept answers held in memory only (answerQueue.js's `read` and `write` no
//     longer touching storage): the refresh forgets the answer;
//   - no retry after a failed send (the backoff timer in `drain` removed): the
//     refreshed page's first send is refused and nothing tries again;
//   - a send that never reached the server taken as a refusal for good
//     (`refusedForGood` true below 500): the answer is thrown away on the spot.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

const isAnswer = (req) => req.url().endsWith('/api/review/answer') && req.method() === 'POST'
let away = false

// "12 answered · 75% recalled", the lifetime Practice score; absent until the
// first answer.
async function practiceScore() {
  const m = (await app.onScreen()).match(/(\d+) answered/i)
  return m ? Number(m[1]) : 0
}

it('an answer the server cannot take yet is kept through a refresh and goes out when it can', async () => {
  await app.page.setRequestInterception(true)
  app.page.on('request', (req) => (away && isAnswer(req) ? req.abort() : req.continue()))
  await app.goto('/')
  await app.see('Start practice')
  const before = await practiceScore()

  await app.press('Start practice')
  await app.see('skip')
  // Practice deals a random kind of question per card; skip to one to recall,
  // reading the screen rather than timing a press (reviewing-a-card says why).
  let found = false
  for (let tries = 0; tries < 40 && !found; tries++) {
    if ((await app.onScreen()).toLowerCase().includes('show me')) found = true
    else await app.press('skip')
  }
  expect(found, 'Practice never dealt a card meant to be recalled in 40 draws').toBe(true)

  // THE SERVER GOES AWAY, and the reader answers.
  away = true
  await app.press('Show me')
  await app.press('Got it')
  // MOVED ON AT ONCE, AND NOTHING ABOUT SENDING. The old screen said "saving…"
  // beside Next for as long as the send took, and an error when it failed.
  await app.see('recalled')
  await app.gone('saving')
  await app.gone('couldn')
  await app.press('End practice')

  // THE REFRESH, with the server still away: the new page's first send is refused.
  await app.goto('/')
  await app.see('Start practice')
  expect(await practiceScore(), 'the score counted an answer the server never took').toBe(before)

  // THE SERVER COMES BACK, and nobody presses anything: the page tries again.
  const sent = app.page.waitForResponse((r) => isAnswer(r.request()), { timeout: 20000 })
  away = false
  expect((await sent).status(), 'the kept answer was refused').toBe(200)

  // AND THE SCORE, WHICH IS THE SERVER'S, COUNTS IT.
  await app.see(`${before + 1} answered`)

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
