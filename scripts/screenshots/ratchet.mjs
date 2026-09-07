// JUDGING A RATCHET, SEPARATED FROM THE FIFTY MINUTES THAT FEED IT.
//
// WHY THIS IS ITS OWN FILE. The rule "the number may fall and never rise" lived
// inside `controls.mjs`, after a browser walk of thirty surfaces — so the only way
// to ask whether the rule was right was to spend an hour producing an input for
// it. That is how the rule went wrong twice without anyone noticing: once when the
// ceiling was recorded against a different library from the run, and once when
// there was no ceiling at all and a missing one is not a failure. Both are
// arithmetic. Arithmetic should be testable in a millisecond.
//
// THE TWO WAYS A RATCHET STOPS WORKING, and it is worth naming that they are
// opposites:
//
//   IT ROSE. The thing being counted got worse. This is the failure everyone
//   thinks of, and it is the easy half.
//
//   IT WAS LEFT BEHIND. The thing got BETTER and the ceiling did not move, so the
//   gate now has room in it — and a ceiling with room is a gate that passes
//   whatever it measures until the room is used up. 139 controls of room went
//   unnoticed for as long as the ceiling belonged to another library. This half
//   has to fail too, or the first improvement quietly buys the next regression.
//   `spacing-debt.test.js` has held that line since it was written; this is the
//   same rule where the count is expensive.
//
// THE TOLERANCE IS SMALL AND DELIBERATE. The seeded fixture is built by a script
// and measured twice at 187 and 9 — the same numbers both times — so the honest
// allowance is nearly zero. A few is kept so that one control appearing behind a
// slower render does not fail a run that found nothing wrong.

export const SLACK = 5

// counts: { bucket: number }   bar: { bucket: number | undefined }
// Returns one row per bucket, each saying what it is and what to do about it.
export function judge(counts, bar, slack = SLACK) {
  return Object.keys(counts).map((k) => {
    const n = counts[k]
    const was = bar[k]
    // A MISSING CEILING IS NOT A REGRESSION. There is nothing to have risen from,
    // and failing here is how a ratchet gets deleted rather than filled in. It is
    // said loudly instead, every run, until somebody records it.
    if (was === undefined) return { k, n, was, state: 'unrecorded' }
    if (n > was) return { k, n, was, state: 'rose' }
    if (was - n > slack) return { k, n, was, state: 'slack' }
    return { k, n, was, state: 'ok' }
  })
}

// The rows that must fail a run. `unrecorded` is not among them, on purpose.
export const failing = (rows) => rows.filter((r) => r.state === 'rose' || r.state === 'slack')

// WHAT THE RUN EXITS WITH, which is the only part of all this anybody reads.
//
// THREE IS THE ONE WORTH EXPLAINING. An unrecorded ceiling is deliberately not a
// regression — failing there is how a ratchet gets deleted rather than filled in
// — but exiting 0 tells a reader "this width is guarded", and it is not. Three
// says the app came back clean AND the touch floor was measured against nothing.
// One flag turns it into a recorded run.
export function exitCode(anyFailingBucket, rows) {
  if (anyFailingBucket || failing(rows).length) return 1
  if (rows.some((r) => r.state === 'unrecorded')) return 3
  return 0
}

// MAY THIS RUN RECORD A CEILING? Two ways a run measures less than the app, and
// both used to write anyway:
//
//   A SURFACE THAT DID NOT RENDER. Its controls were never counted, so the total
//   is a floor of the harness. A run against a server that was not there records
//   0, and every real run afterwards reads as slack — or, once that is recorded
//   too, as clean.
//
//   A RUN THAT SKIPPED SURFACES. `--only home --update-baseline` has no blanks at
//   all: it looked at one screen, found nothing wrong, and wrote that over a
//   ceiling of 187. Zero blanks is not the same as everything measured.
export const canRecord = ({ blanks, walked, total }) => blanks === 0 && total > 0 && walked === total

export function say(row, width, shelf) {
  const { k, n, was } = row
  const at = `for ${shelf} at ${width}px`
  switch (row.state) {
    case 'unrecorded':
      return `RATCHET  ${k.padEnd(9)} ${n} — no baseline ${at}; run with --fixture ${shelf} --update-baseline`
    case 'rose':
      return `FAIL     ${k.padEnd(9)} ${n} against a ceiling of ${was} ${at} — the number may fall and never rise`
    case 'slack':
      return `FAIL     ${k.padEnd(9)} ${n} against a ceiling of ${was} ${at} — the ceiling has ${was - n} of room in it, `
        + 'so the next regression this size passes unseen. Re-run with --update-baseline to record it'
    default:
      return `ok       ${k.padEnd(9)} ${n} against a ceiling of ${was} ${at}`
  }
}
