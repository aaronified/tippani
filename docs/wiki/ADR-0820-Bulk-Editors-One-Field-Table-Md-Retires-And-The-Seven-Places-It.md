# ADR-0820: bulk-editors-one-field-table.md retires, and the seven places it turned out to be wrong

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted, then changed or withdrawn: the entry says how

The plan is folded in here and its file deleted, which is what `docs/plans/README.md`
requires of a plan that has shipped. What follows is the verification pass — the part
worth keeping, because a plan that was simply right teaches nothing, and this one was
right about the DISEASE and wrong about most of the symptoms it listed.

### What shipped

`internal/httpapi/bulk_fields.go` — one `bulkFields` table naming every bulk-settable
column once, with the kinds it applies to, its column on the live tables, its column on
`staged_quotes`, and whether clearing it writes `''` or `NULL`. `quoteFieldKinds` and
`notNullQuoteCols` are derived views of it rather than literals beside it. Both endpoints
read it.

The guards are NAMED rather than counted, because counting them is what this document has
got wrong twice this month. They walk the table against the migrations (every column
exists on the table it names; every NOT NULL flag is the schema's, read off the CREATE and
ALTER statements rather than transcribed), against `bulkTag`'s kind vocabulary in both of
its spellings, against the live panel's `BULK_QUOTE_FIELDS`, against the staged endpoint's
own writes, and against itself for gaps in both directions — a field one editor has and
the other lacks is a named entry with a reason, whichever way round it falls. Every field
is also set and cleared over real rows, on every kind the table gives it, because the
clear is the half that catches the NOT NULL trap.

One more guard touches no column in the table at all: the staged endpoint against the
staged panel. That pair is JSX on one side and Go on the other with no shared row to
compare, which is precisely why it had nothing watching it.

The fields: the live editor gained `remove_tags`, `occasion_date`, `occasion_circa` and
`translation`; the staged editor gained the occasion-date shape check it never had.

### 1. The inventory was stale in six particulars, and the plan's own lesson predicted it

Taken against `619eb05` and read against a tree that had moved a long way. Measured at
`d331b5f8`: `stagedBulkReq` had **30** fields, not 14; `quoteFieldKinds` **23**, not 19;
the live-only set was **6**, not 15; `language` was already on both; `occasion_circa` was
already on staging. Ten fields divided the two editors where the plan found twenty — and
every one of those ten closed by hand, one column at a time, in the migrations between.

That is the argument FOR the registry rather than against it. Nothing stopped the drift
and nothing stopped the next one; the value was always the guard, not the fields. And the
staleness is the plan's own lesson one iteration on: its verification pass opens *"I
expected one editor to be behind the other. Both are behind each other"* — a correction it
earned by reading the tree instead of the brief. A plan is read against the tree too.

### 2. "Both gain `translation`" — staging refuses the text by a rule of its own

`translation` was the one field genuinely missing from both, so half of this was right.
The other half was not: `import_staged_bulk.go` states the rule six lines above its field
list — the endpoint *"corrects where a line CAME FROM, never what it SAYS"*, and names
`quote`, `note` and `translation` as the three it will not touch, because a staged row is
a record of what the file said and wording is fixed after approval on a row that is yours.
The plan proposed breaking a documented design rule that the neighbouring fields cite.

It shipped live-only, and the honest use went in the comment rather than being implied:
two quotes cannot share a translation, so nobody sets the same words on forty rows — but
an import that mis-mapped a column onto two hundred of them is exactly what a bulk editor
is for.

**And the ratchet was giving the wrong reason for `note`, the same shape one field over.**
Its entry read *"the staged editor has no note field; parity says it should"* while the
endpoint says the opposite in as many words. A wrong reason on a ratchet is worse than
none: it tells the next reader a gap is waiting to be closed when the endpoint has already
refused to close it.

### 3. The four `common.field.*` keys were already there

The plan costed the i18n at four missing keys — `chapter`, `medium`, `kind`, `category`.
Measured: all 45 `t('…')` keys in `bulkOps.jsx` resolve in **both** `en.txt` and `bn.txt`.
`chapter` is `common.field.chapter-name.label`; `kind` uses `quotes.form.kind.label`;
`medium` is deliberately absent from the panel (0053 retired it) and `category` is
superseded by `board`. Nothing to add.

The naming question the plan left open — whether `chapter-name` and `media-type` are
`chapter` and `medium` under other names — resolves to leaving them. `chapter-name`'s
sibling is `chapter-no`, and the two are the NAME and the NUMBER of one field; renaming it
would leave a pair reading `chapter` / `chapter-no` that hides its own halves.

### 4. The reason for keeping `season` and `episode` off the live editor was false, in four places

Two Go guards, the panel's field table and its test all said *"a number retarget already
moves them"*. `stagedRetarget` moves a staged GROUP to another work and never touches
either column; the staged endpoint bulk-sets them itself, bounds-checked and written
through `nullableCount`. So the stated reason named a mechanism that does not exist and a
capability the other editor has.

What survives is the second half, and it is about the SELECTION rather than ownership: a
Quotes-screen selection can span works and episodes, so setting a season across it
renumbers lines from different episodes alike, where a staged selection is scoped to the
one file being reviewed. They are staged-only table ENTRIES now rather than exemptions —
and the gap ratchet, which only ever recorded live-only gaps, records both directions,
which is the case the plan named in its own opening.

### 5. "Fourteen hand-written pointers become the shared path" — thirty, and folding them was the wrong fix

The count was taken at `619eb05`. More to the point, the staged chain is hand-written for
fields that genuinely differ: `location` and `timestamp` write an `_orig` snapshot beside
themselves, `chapter_no` goes through `nullableMeasure`, `season` and `episode` through
`nullableCount`, and the whole block runs before tags, formula and retarget in an order
this file fixes. Folding those into a registry means encoding four write strategies and an
ordering into it, which buys less than it risks. The DEFECT was that nothing checked the
lists against each other, and that is what was closed.

### 6. One panel for both screens was the plan's headline and is not what shipped

The two controls do different jobs. The staged panel sets MANY fields at once over a
mixed-kind selection — a checkbox grid, deliberately not kind-gated, because a selection
spans groups and the checkbox is what makes that safe. The live one sets ONE field
carefully, with the control that field actually needs (a partial-date picker, a language
combobox, a kind chooser) and a warning naming what the press will overwrite. Merging them
loses the multi-field pass on one side or the rich controls on the other.

So the drift is closed by the shared table and by a guard per panel instead. The staged
side had never had one: `WRITABLE_FIELDS` was read by no Go file, so a column the queue
accepts and its bulk panel never offers was invisible in exactly the direction the live
side's guard covers. There was already one — `occasion_date` and `occasion_circa`, argued
in a comment and checked by nothing. It is on the record now, with the real reason: a
checkbox beside a free-text box cannot say "about 399 BCE", and the staged ROW editor does
offer it under the key `when`.

**The roadmap card was rewritten to say this**, rather than being marked shipped over a
promise that was not kept.

### 7. The guards found four things the plan never mentioned, and one of them was mine

- **`kind` lost its NOT NULL flag in the refactor itself.** The table was built by
  extracting the old literal with a regex wanting one space after the colon; sixteen of
  seventeen entries were written that way and the seventeenth was aligned. Clearing a
  quote's kind in bulk became a 500 inside the transaction. **The check written to prove
  the refactor used the same extraction**, so it confirmed the misreading and reported
  sixteen of sixteen. `go test ./...` found it, through a behaviour case. The flags are
  read off the migrations now.
- **`occasion_date` skipped the applicability check** while it was written by a hand-rolled
  `if` beside the shared loop, so a date sent to `/annotations/bulk` was a 500 rather than
  a 400. Found by reading the neighbouring function, not by a test; the kind-refusal guard
  is a table walk now — 45 pairs, response body checked, not seven hand-picked ones.
- **A test named for both editors exercised one.** It passed with the staged half of its
  own fix removed.
- **`bulkFieldTakesKind` had no callers** and a comment claiming two. `go vet` does not
  flag an unused package-level function; the file's only `slices` import was the tell.

### Two questions carried here rather than lost

- **`category` versus `board`.** `category` is superseded by `board`; `board` exists on
  `staged_quotes` and nothing sets it, while the live side sets `board_id` on utterances
  only. Whether `category` becomes a deprecated alias or the column retires is a data
  decision, and the plan was explicit that it must not be made silently.
- **Whether `season` and `episode` should reach the live editor under a same-work guard.**
  The repair is real — *these forty lines are all S2E5 and the importer said S1* — and
  nothing else in the app makes it. The overwrite machinery could refuse a selection
  spanning two seasons, which keeps the repair and removes the failure mode. Not built: it
  is a behaviour change, and the reason it was refused before turned out to be false.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
