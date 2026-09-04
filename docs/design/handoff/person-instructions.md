# Person identity — instruction set

Build note for the People model in Tippani. This is the part of the schema that the
Book Detail prototype exercises but does not fully implement; the UI is drawn, the
storage is not. Read with `Book Detail Wide.dc.html` → `PANELS.person` open.

## The rule everything else follows

**One person, many credits.** A person is a single record in the library. How that
person is *credited* is a property of the WORK, not of the person — so the same human
being legitimately appears as different strings on different books, and all of them
must resolve to one record.

Bulgakov is the ordinary case, not an edge one:

| On this work | The credit string |
| --- | --- |
| Penguin Classics, 2016 | Mikhail Bulgakov |
| Vintage, 2004 | M. Bulgakov |
| Азбука, 2019 | Михаил Булгаков |
| a Bengali edition | মিখাইল বুলগাকভ |

Four strings, one person, 12 works, 128 quotes. If the app stores the credit string as
the person, the reader gets four Bulgakovs, each with a quarter of the quotes, and the
"Works: 6" figure on every one of them is a lie.

**Corollary.** Never key a person by their displayed name. The name is a label on an
id, and there are at least three names in play at once.

## The three name fields, and why each exists

Each answers a question the other two cannot.

1. **`name`** — the canonical one. What the app calls them when nothing else applies:
   in search results, on their own panel, in a picker. One per person.
2. **`sortName`** — how they file. `Bulgakov, Mikhail`; `ঘোষ, শঙ্খ`. Never derived by
   splitting on the last space: that breaks on mononyms, on Spanish double surnames, on
   every name where the family name comes first, and on characters (`Woland` sorts as
   `Woland`, not `Woland, ` ). It is a field because it is a judgement.
3. **`creditAs`** — per work-person link, not per person. Nullable; when null the work
   prints `name`. This is the field that lets one record wear four jackets.

And one list:

4. **`aliases`** — every other spelling that should FIND this person. Populated by
   merges (each merged record's `name` becomes an alias) and by hand. Search matches
   any alias; display never uses one. This is what makes "Also credited as · 2" on the
   person panel real rather than decorative.

## What the UI already assumes

The prototype's person panel is split into three scopes on purpose, and the split is
the schema:

- **On this work** — `role` and `creditAs`. Editing either touches the work-person
  link and nothing else. This is why "Credit as" says *on this work only* in its own
  sub-line: without that sentence a reader will believe they just renamed the author on
  31 other books.
- **Across the library** — `quoteCount`, `workCount`, `aliases`. Read-only, except that
  an alias can be split back out into its own person.
- **This person** — `name`, `sortName`, `born`, `died`, `photo`, `note`. Shared by every
  work they appear on. A change here propagates; a change in the first section does not.

**Merge is the one destructive operation here.** Merging folds record B into record A:
B's works re-point, B's quotes re-point, B's `name` joins A's `aliases`, B is deleted.
Split-out reverses one alias into a new record but cannot restore which works came from
where — so merge asks first, and the confirm says so.

## Characters

A character is a person record with `kind: 'character'`, scoped to the works it appears
in. Same three name fields, same aliases, same photo — Woland is credited as *Woland*,
*the professor* and *Messire* inside one novel, which is `creditAs` doing its job at a
finer grain than usual.

**A book character has no actor.** The cast pairing (character ↔ performer) belongs to
film, show and game records only. Do not add a second name slot to a book's character:
a slot invites a value, and there is nothing true to put in it.

Characters attach to quotes (`quote.speakerId`). A line of dialogue attributed to the
author is wrong for most of the dialogue in any novel, and the difference between
"Bulgakov said" and "Yeshua said" is the whole meaning of the line.

## Build checklist

- [ ] `person` table keyed by id; `name`, `sortName`, `born`, `died`, `photo`, `note`,
      `kind` (`person` | `character`).
- [ ] `personAlias` table: `personId`, `alias`. Unique on `alias` per library, so two
      records cannot claim one spelling.
- [ ] `workPerson` link table: `workId`, `personId`, `role`, `creditAs` (nullable),
      ordering within role.
- [ ] `quote.speakerId` → person, nullable, and constrained to characters of that work.
- [ ] Search indexes `name` + every alias; display never resolves through an alias.
- [ ] Add-person flow searches before it creates — the picker in `personPicker` is the
      shape. Typing an existing name and getting a second record is the failure this
      whole model exists to prevent.
- [ ] Merge is transactional and writes an undo record; the toast offers Undo.
- [ ] Default portrait is `faceFor(name)` — a hash of the canonical `name`, so the face
      is stable across screens and reloads. It must NOT hash `creditAs`, or a person
      changes face between two books.
