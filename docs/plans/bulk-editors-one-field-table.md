# The two bulk editors, and the one field table they should both read

Fixing a whole file before you approve it, and fixing the same rows after, are the
same job on two screens. They are not the same code, they do not offer the same
fields, and **neither one's list is a superset of the other's**. The staged editor
can set a season and cannot set a note; the live editor can set a note and cannot
set a season. Twenty-seven of the forty-one columns a staged quote holds cannot be
bulk-edited there at all.

So this is not "add the missing fields to the staged editor". Adding them by hand
produces the same drift again, a release later. The repo already solved this
problem once on the live side and wrote down what it cost —
`bulk_handlers.go:205-213`:

> THE KIND NAMES ARE bulkTag's… That has to be spelled out because the bin's table
> one line down calls the third kind "quote", and for four releases this table did
> too — with the result that `POST /quotes/bulk` answered 400 to every per-kind
> field the Quotes screen offers ("speaker does not apply to this kind"), for a
> kind that has the column. **Two vocabularies for one concept, and the mismatch
> was invisible because the refusal is a legitimate answer for some other kind.**
> TestEveryBulkFieldKindIsAKindBulkTagKnows now walks the two tables against each
> other, so a third spelling cannot be introduced quietly.

The staged editor is the third spelling. It was introduced quietly.

And the owner's own directive, in `CLAUDE.md`: *"similar things should act
similarly… A control drawn by one component on two screens has ONE behaviour, and
it lives in one function that both screens call — not in a line each, which is how
one of them goes on being right while the other quietly stops."* That is exactly
what happened here, in both directions.

---

## What already exists

Verified against `619eb05`.

| Thing | State |
| :-- | :-- |
| `staged_quotes` columns | **41**, grown across ten migrations: 0023 (create), 0025 season/episode, 0028 speaker/occasion/occasion_date/place/medium, 0035 category/language/translation, 0036 board, 0043 anthology×3, 0044 chapter_no, 0047 act/quest/episode_name/region/recipient/work_title/locator/occasion_circa, 0053 kind |
| Staged bulk request | **14 fields** — `stagedBulkReq` (`import_staged_bulk.go:40-60`): add_tags, remove_tags, color, favorite, chapter, chapter_no, location, character, actor, timestamp, season, episode, retarget, formula |
| Live bulk request | `bulkTagReq` (`bulk_handlers.go:62-135`) plus a per-kind table |
| The live per-kind table | **Built** — `quoteFieldKinds` (`bulk_handlers.go:214-236`), 19 fields mapped to `annotation` / `dialogue` / `utterance` |
| A test that walks the live tables against each other | **Built** — `TestEveryBulkFieldKindIsAKindBulkTagKnows` (`bulk_fields_test.go:33`), plus `TestEveryBulkFieldSetsAndClearsOnItsOwnKind` (`:69`) and `TestABulkFieldTheKindHasNoColumnForIsStillRefused` (`:132`) |
| A per-kind table on the staged side | **None.** No applicability table, no drift test, no shared vocabulary |
| Clear semantics | **The same on both, by luck.** Staged uses `*string` where `""` clears (`import_staged_bulk.go:38,53,101`); live has `notNullQuoteCols` and its own comment about writing `''` rather than NULL |
| The field-name vocabulary | **Built and nearly complete** — 89 `common.field.*.label` keys, under the stated rule that *"a field's name is the same field's name wherever it is drawn"* (`ReverifyReview.jsx:42-46`) |
| A per-field review UI | **Built** — `ReverifyReview.jsx`: one checkbox per field, `emptyStored()` (`:94-99`) defaults a pure fill to ticked and an overwrite to unticked |
| Staged UI | `FieldsPanel` (`StagingPage.jsx:595-604`) — **8 fields** |
| Live UI | `BULK_QUOTE_FIELDS` (`bulkOps.jsx:248-264`) — **11 fields** |
| Any prior record of this | **None.** Nothing in `docs/plans/`, nothing in the defects register. One roadmap line, §7 `#data-hygiene`: *"The after-import jobs the bulk editor and staging miss."* |

### What the verification changed

**I expected one editor to be behind the other. Both are behind each other.** The
brief was "the updater needs more fields", which reads as a catch-up. It is not:

| Only the **staged** editor can set | Only the **live** editor can set |
| :-- | :-- |
| `season`, `episode` | `note`, `sticker_id`, `review_excluded` |
| `remove_tags` (live adds only) | `act`, `quest`, `episode_name` |
| `retarget` (move rows between works) | `speaker`, `occasion`, `place`, `medium`, `kind` |
| `formula` (transform a numeric run) | `region`, `recipient`, `work_title`, `locator`, `board_id` |

A reader who imports a season of dialogue can set the season number before
approving and not after; a reader who imports a book of highlights can set a note
after approving and not before. Neither list contains the other, so "make staging
match the live editor" would silently drop `season`, `episode`, `remove_tags`,
`retarget` and `formula` — which is the same mistake in the other direction.

**Six columns can be bulk-edited by neither, and two of them are shipped
features.** `language` and `translation` arrived in 0035 and are the multilingual
feature's own columns; they are importable and per-row editable and cannot be
changed over a selection anywhere. `occasion_circa` is a flag exactly like
`favorite`, which both editors do have. `category` is superseded by `board`;
`board` exists on `staged_quotes` and nothing sets it, while the live side sets
`board_id` on utterances only. `noted_at` is import metadata and should stay out.

**`quote` is bulk-editable by neither, and that is correct.** Worth stating
because a plan that says "27 columns are missing" invites someone to add all 27.
The passage itself is per-row by nature; find-and-replace already exists for the
case that isn't (`TestFindAndReplaceReachesABookCharacter`, `bulk_fields_test.go:168`).

**The i18n cost is four strings.** Of the twenty-odd field names this needs,
`common.field.*` already has all but `chapter`, `medium`, `kind` and `category` —
and `chapter-name` and `media-type` are probably those first two under other
names, which is its own small question. The shared vocabulary was built for
exactly this and has been waiting.

---

## The design: one registry, both endpoints read it

`quoteFieldKinds` is already the right shape. It is on the wrong side of one
boundary — it knows only the live tables — and it has no staged twin. So:

**One table, in Go, naming every bulk-settable field once**, with for each:

- the **kinds** it applies to (`annotation` · `dialogue` · `utterance`), which is
  what `quoteFieldKinds` already carries;
- its **column on the live table** and its **column on `staged_quotes`**, which are
  the same name for all but one (`board_id` live, `board` staged) — worth an
  explicit mapping precisely because the one exception is invisible otherwise;
- its **validation**: max length, or the range check `season`/`episode` already
  have, or the enum `color` and `kind` already have;
- whether a clear writes `''` or NULL — the `notNullQuoteCols` trap, which is
  stated on the live side as *"THIS IS THE MISTAKE THAT WOULD NOT BE CAUGHT BY
  READING THE CODE"* and is unstated on the staged side.

Both endpoints build their `UPDATE` from that table. `stagedBulkReq`'s hand-written
struct of fourteen pointers, and the live request's parallel one, both become a
map from field name to value, validated once.

**Retarget and formula stay bespoke, and stay staged-only.** They are not field
edits: `retarget` moves a row to a different work and re-bases its locators;
`formula` transforms a numeric run inside free text and has its own validator and
its own documented ordering (`PLAN.md:3870-3880`: assignments → tags → formula →
retarget). Folding them into a field table would flatten two operations into a
vocabulary that cannot express them. They are correctly where they are; the plan
says so rather than leaving their absence looking like more drift.

### What each side gains

**The staged editor gains** everything the live one has that is a field:
`note`, `speaker`, `occasion`, `place`, `medium`, `kind`, `region`, `recipient`,
`work_title`, `locator`, `act`, `quest`, `episode_name`, `sticker_id`,
`review_excluded`, `board`.

`review_excluded` is worth naming: `PLAN.md:3470-3480` records the review-exclusion
flag *"the importer forgot"* — one column missing from one `INSERT` — and observes
that *"the single book most likely to be imported into again is the book whose
exclusion silently stopped holding."* Being able to set it over a whole imported
file, before it reaches the deck, is the natural home for that.

**The live editor gains** `season`, `episode` and `remove_tags`. Dialogues have
those columns; the Quotes screen cannot set them; the asymmetry on tags is that
staging can remove a tag and the live screen can only add one.

**Both gain** `language`, `translation` and `occasion_circa`.

### Three that need a ruling, not a default

- **`anthology`, `anthology_note`, `anthology_intro`.** `anthology_intro` is one
  string for a whole document, not a per-quote value, so bulk-setting it over a
  selection means something different from the others. My reading is that
  `anthology` (which document a quote belongs to) is a legitimate bulk field and
  the other two are not — but that is the anthology feature's call, and
  `docs/plans/anthologies.md` is its home.
- **`note` over a selection.** The live editor already allows it, so parity says
  yes. It is also the one field where "set the same value on two hundred rows" is
  a strange thing to want. Parity wins by default; recording the doubt because if
  it is wrong, it is wrong on the live side too and should be removed from both.
- **`category` vs `board`.** `category` is superseded. Either it joins the table
  as a deprecated alias of `board` or it is left out and the column retired. Not
  this plan's call to make silently.

---

## The UI

`FieldsPanel` (8 fields) and `BULK_QUOTE_FIELDS` (11 fields) become **one component
reading the shared table, filtered by the kinds present in the selection**. That is
the directive applied: one function both screens call, rather than a line each.

Two consequences worth planning for rather than discovering:

- **Thirty fields is not eight.** The panel becomes a list long enough to need
  `Scroller` — never bare `overflow`, per the standing rule, because an edge fade
  is how the app says a thing scrolls. `ReverifyReview` is the precedent for a long
  field list that stays legible.
- **A mixed selection.** Selecting annotations and dialogues together should offer
  the intersection plus the shared fields, not a list of controls that 400 on
  press. `quoteFieldKinds` already knows the answer; the UI has never had to ask it
  because eleven fields fit without thinking.

And the tick-and-cross rule binds here: the tick lights only when something
actually changed, and carries the count of fields this press will change — which on
a thirty-field panel is the difference between a usable control and a guess.

---

## Guards

The live side already has the guards this needs. The staged side has none of them,
and the shared table is what lets one set cover both.

| Guard | What it needs |
| :-- | :-- |
| `bulk_fields_test.go:33` `TestEveryBulkFieldKindIsAKindBulkTagKnows` | Extend to walk the **shared** table, so a field cannot exist on one side only. This is the test whose absence is the whole defect |
| `bulk_fields_test.go:69` `TestEveryBulkFieldSetsAndClearsOnItsOwnKind` | Run it over both endpoints. The clear case is the one that catches the `''`-vs-NULL trap |
| `bulk_fields_test.go:132` `TestABulkFieldTheKindHasNoColumnForIsStillRefused` | Same, on staged |
| **New**: every field in the table has a column on both `staged_quotes` and its live table | A schema walk, not a typed list. A typed list is how this drifted |
| **New**: every bulk-settable column on `staged_quotes` is either in the table or on a named exclusion list | The exclusions (`quote`, `dedupe_hash`, `created_at`, `noted_at`, `*_orig`, `id`, `staged_work_id`) are stated with their reason, so the next migration's column has to be classified rather than forgotten |
| `import_staging_test.go` | `TestStagedBulkEdit` and `TestStagedBulkValidation` pin the current 14; they widen |
| `test/pure/locale-complete.test.js` | Four new `common.field.*` keys in `en.txt` **and** `bn.txt` |
| `go test ./...` | `internal/i18n/*.txt` counts as a frontend change — `src/i18n.js` imports it with `?raw`, so `web/dist` rebuilds |

---

## The order

1. **The shared field table**, in Go, with the kinds, the two column names, the
   validation and the clear semantics. No behaviour change yet: `quoteFieldKinds`
   becomes a view of it and the live tests go on passing.
   — `internal/httpapi/bulk_fields.go` (new), `bulk_handlers.go`
2. **The schema-walk tests** — every field has both columns; every column is
   classified. These fail on arrival and are the specification.
   — `internal/httpapi/bulk_fields_test.go`
3. **The staged endpoint reads the table.** Its fourteen hand-written pointers
   become the shared path; `retarget` and `formula` stay bespoke and keep their
   documented ordering. — `internal/httpapi/import_staged_bulk.go`
4. **The live endpoint gains `season`, `episode`, `remove_tags`.**
   — `internal/httpapi/bulk_handlers.go`
5. **`language`, `translation`, `occasion_circa` on both.**
6. **One field-panel component**, kind-filtered, scrolled, with the counted tick.
   — `web/frontend/src/bulkOps.jsx`, `StagingPage.jsx`, `ui.jsx`
7. **Four `common.field.*` keys** in both locales, and the `chapter-name` /
   `media-type` naming question settled.
8. **Docs** — `docs/PLAN.md` (the decision, and this plan folded in per this
   directory's rule), `CHANGELOG.md`, `docs/ui-glossary.html` if the panel is
   documented, `AI.md` if verification changes.

## Verification

```bash
go vet ./... && go test ./internal/httpapi/ -run 'Bulk|Staged' -v
go test ./...
cd web/frontend && npm test
make frontend && make glossary && npm run glossary:check
```

By hand, because the interesting cases are selections:

- Import a file, select the whole batch, and set every field the panel offers.
  Approve. Select the same rows on the Quotes screen and confirm the same panel
  offers the same fields with the same words.
- Select annotations and dialogues together and confirm the panel offers the
  intersection rather than controls that refuse on press.
- Clear a field that is `NOT NULL DEFAULT ''` on both sides and confirm neither
  writes a NULL.
- Set a season on a staged dialogue batch, approve, then change it from the Quotes
  screen — the path that is impossible today in its second half.

## Out of scope

- **Retarget and formula on the live side.** Moving an approved quote to a
  different work is a different operation with different consequences (it is not
  staged, so there is nothing to un-approve), and it deserves its own argument.
- **Find-and-replace parity.** It exists on the live side and not on staging. Same
  shape of gap, different feature; worth its own plan if it is wanted.
- **The importers carrying more fields.** The owner's note — *"the fetcher is
  already fetching all relevant fields, other sources need to match up to that"* —
  is the motivation for this plan rather than its scope: the bulk editor is
  precisely where a reader supplies what a source could not carry. Which parsers
  should learn which fields is a per-source question and belongs with the source.
  `docs/plans/import-one-drop-target.md` already carries the Readest case, where
  the JSON brings colour, notes and timestamps that the markdown loses.
