# Nightly backup

**Not built. Nothing of it exists** — `grep -rni nightly internal/ --include='*.go'` returns
nothing, and there is no scheduler in this app to hang it on.

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

## Where it goes when it is built

`ServerCard`'s group 2, between *Make a backup* and *Restore from an archive*, which is the
pack's order. The group is already rows, so the row is the only UI work.
