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
