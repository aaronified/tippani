# The review dot opens a popup: half-life, and the recall history behind it

**Status: the table is built (migration 0064, and every answer is logged). The read
endpoint and the popup are not.** The owner's request, verbatim:

> when i click on the spaced repetition icon in the quote cards, it should show a popup for
> the halflife status, and recall history (will need to create a recall history table),
> like the infodots (this is not an infodot, btw, so will not be restricted by the budget).
>
> we will also do a complete overhaul of the spaced repetition system after this.

## What has landed

`item_recalls` (0064): one row per answer — the result, the half-life that answer produced,
how long it had been since the previous one, and when. Written from `handleReviewAnswer`
inside the same transaction as the schedule update, for **every** answer including skips,
and a failed insert is logged (`TIP-REVIEW-002`) rather than costing the reader their
grade: the log sits beside the schedule, not inside it. It is in `accountTables`, so it
survives a backup and a restore — six months of evidence about how somebody remembers is
the one thing in this feature that exists nowhere else.

**Nothing reads it to decide anything**, and that is deliberate with an overhaul coming: a
scheduler that derives its state by replaying a log is a different design, and if the
overhaul wants that it can build it from this table without a migration to fill the
history, because the history will already be there.

## What is left

- **`GET /api/review/card?kind=&id=`** — the state and the history for one item: the
  current half-life, when it is next due, the counts, and the last N answers. Scoped by
  the item's own ownership check (`ownsItem`), which is how `item_reviews` is already
  reached.
- **The popup.** *Not* an infodot, on the owner's instruction — so it is not subject to
  `help-budget.test.js`'s caps and does not go through `infodot-copy`. It is a panel on
  the same stack as every other answer on that screen (the repo's rule: a question wears
  the same chrome as its answer), opened by the review dot in a quote card's action row.
- **What it draws.** The half-life as a number of days and as the four-state dot the card
  already shows; when the card is next due; and the history as a list of answers, each with
  its date, its result and the half-life it produced. The curve is drawable from the log
  because each row carries the stability it produced — which is why that column exists.

## The one design decision worth arguing before it is built

**The dot on the card currently does something.** Whatever that is, it cannot simply become
"open the popup" without checking: the repo's directive is that two things which look the
same behave the same, and this dot is drawn on quote cards across several screens. Either
every one of them opens the popup, or the popup is opened from somewhere else. Read
`characterRows.jsx`/the card's action row before choosing, and put the verb in ONE function
that every screen calls.

## Not in this plan

The overhaul itself. The owner has said it is coming; this popup is a window onto the
system as it stands, and its value is that it makes the current behaviour legible enough to
argue about before it is replaced.
