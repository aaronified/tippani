# Nightly backup

**Not built. Nothing of it exists** — no non-test Go source mentions it, and there is no
scheduler in this app to hang it on:

```bash
grep -rni nightly internal/ --include='*.go' | grep -v _test   # no matches
```

(The unfiltered grep DOES match, in `internal/updater/updater_test.go`,
`internal/olog/codes_test.go` and `internal/httpapi/update_test.go` — a release tagged
`nightly` and CI's own nightly sweep, neither of which is this feature. An earlier draft of
this file cited the unfiltered command and said it returned nothing, which was wrong about
the command while right about the conclusion.)

## Where it comes from

The design pack draws it as the middle row of Server's Backup group
(`docs/design/prototypes/settings-restructured.dc.html:2756`):

```
{ k: 'nightly', label: 'Nightly backup', sub: 'Last one 04:00 · 41 MB', kind: 'toggle' },
```

Server's other two Backup rows — *Make a backup* and *Restore from an archive* — are built
and match the pack. This one is the whole of the gap between that group and the pack's, and
it was deliberately left out of the pass that brought the rest of Server across: the owner's
standing instruction for that sweep was *"no new features now, but keep notes"*, and a row
that writes archives on a timer is a feature rather than a layout.

## Why it is not a small addition

**It needs the one thing this repo's invariants forbid by default.** From `CLAUDE.md`:

> No goroutine outlives its request — no worker pool, ticker, or scheduler; adding one is a
> design discussion first.

A nightly backup is precisely a ticker. So the first question is not where the toggle goes,
it is whether this app gains a scheduler at all, and if so what else is allowed to use it.
That is the owner's call, not a detail of the Server screen.

**And the sub-line the pack draws is a second feature.** *"Last one 04:00 · 41 MB"* means the
server records when the last automatic archive was written and how big it was, and hands both
back — none of which exists either. A toggle that ran the job but could not say when it last
ran would be the worst version of this: a promise with no receipt.

## What it would take

1. **A decision on the scheduler**, first and separately: one owned ticker with a documented
   owner and shutdown, or a cron-style entry the operator installs outside the app. The
   second needs no goroutine and no invariant change, and for a self-hosted box on a LAN it
   may simply be the better answer — `docker exec` and the existing backup endpoint already
   compose into it.
2. **A record of the last automatic run** — timestamp and size — stored and served, because
   the row cannot be drawn honestly without it.
3. **Retention**, which the pack does not mention and which a nightly archive forces: an
   unbounded nightly backup fills the disk of exactly the small machine this app is built
   for. Some answer is needed even if it is "keep the last seven".
4. **The row itself**, which is the smallest part: a `PrefRow` with a `Toggle` in the Backup
   group, its sub-line fed by (2).

## Not on the roadmap, deliberately

The roadmap sweep's own rule is that a plan with no entry gets one — and this one does not,
because publishing it would be promising something the repo has already decided against.
`docs/wiki/Design-decisions.md:151` is marked **Approved** and settles the mechanism:

> Litestream for continuous backup — rejected for constant background CPU; nightly
> `VACUUM INTO` from the host's own cron is the answer instead, **which is the user's timer
> and not mine.**

So the feature as the pack draws it — a switch inside the app that makes the app wake itself
up — is not merely unbuilt, it is contrary to a signed-off line. A roadmap card saying
"Nightly backup, coming" would be a promise nobody has agreed to make. The sweep's other rule
covers exactly this: *"The sweep reports; it does not decide. Adding a plan to the roadmap is
publishing a promise on a public page, so a sweep that is unsure says so rather than inventing
a card."*

**What could go on the roadmap without contradicting anything** is the smaller, honest half:
the app RECORDING and SHOWING when the last archive was written, whoever wrote it — which is
step 2 below and is what makes the operator's own cron auditable from the screen. That is the
owner's call to make, not a sweep's.

## Where it goes when it is built

`ServerCard`'s group 2, between *Make a backup* and *Restore from an archive*, which is the
pack's order. The group is already rows, so the row is the only UI work.
