# ADR-0894: A character is their performers, and the row says so

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted
- **Version:** v3.0.0

The owner, asked what a character's row should carry where a person's carries roles:
*"medium and performers (full list of chip with clickable pills, edgemasked)"*. So the row
is two content lines under the name, the same shape the person row took: the counts and
the MEDIUM answer "what is this to my library", the performers answer "who is it".

**THE ID TRAVELS WITH THE NAME, which is what makes a pill a door.** `characterWorkRef`
carries `actors` — id and name per performer — rather than a name the row would have to
resolve. A chip that looks pressable and is not is the failure this repo has a rule about,
and a press that has to go and search for the person it is already looking at is the same
failure with a delay in front of it.

**IT WAS `MAX(actor_id)` FOR ONE COMMIT, AND THAT IS THE INTERESTING PART.** The query
grouped by (character, work) and took the highest actor id, which answers "one of the
performers" while reading as though it answered "the performer". `idx_work_cast_pair` is
UNIQUE on (kind, work_id, character_key, actor_key) — the actor is IN the key — so two
performers of one character on one work are legal and ordinary: the young Vito and the old
Vito, a role and its voice, a part recast across a run. The owner asked for the "full
list"; a silent MAX is the half of that which looks complete from the outside, and the
only thing separating it from the real answer was a name nobody would think to count.

The grouping now names the actor and the Go loop merges the split rows back into one
appearance per work. `hasFace` is OR-ed across them for the reason it was a MAX before: the
row asks whether this appearance has a face anywhere on it, and splitting the group without
carrying that forward would let a second, faceless performer's row answer for both.

**AND THE KEY THAT MERGED THEM LOST THE WORK'S KIND, which is the second defect this
section records and the more expensive one.** Grouping by `(character, work_id)` is not
grouping by work: `books` and `movies` number themselves independently, so book 1 and movie
1 both exist in any library holding one of each, and the map folded them into a single row.
A character in a novel and its adaptation — the case the medium glyphs exist FOR — came
back as the novel alone, with the film's performer hung on it. The fix commit's own body
said "a novel and its adaptation draws two glyphs" while breaking exactly that.

It is worth stating how it was found, because the answer is not a test: the three tests
written in the same commit all passed over it, and a rating pass reading the merge loop
caught it. The test exists now
(`TestACharacterInANovelAndItsFilmIsTwoAppearances`) and its first fixture ALSO passed over
the bug — billing one character on two works files two records, one per work, and two
records never collide. It needed a merge first. A test whose fixture cannot reach the state
it names is a test that reports on nothing.

**A SHOW WAS LABELLED A FILM ON EVERY ROW THAT HAD ONE.** `media_type` is `'movie' |
'show'` since migration 0006, with `'game'` layered on top, and the medium table read only
the game branch — so a character in a television series drew a clapper board whose tooltip
and accessible name said "film", in an app whose catalogue has drawn that distinction for
sixty migrations and whose `unit.show` string was already written.

**Both media draw the SAME clapper, and the row groups by the DRAWING rather than by the
key.** There is one clapper in the set, and inventing a second would be a picture nobody
has seen standing for a distinction the word already makes. But keying the marks on the
medium meant a character in a film AND a show drew that one clapper TWICE, side by side,
told apart only by a tooltip nobody has hovered — which is this repo's own "a lookalike
next to the real glyph is two pictures of one thing", and on a row it reads as a rendering
fault rather than as a fact. One mark, and its name lists what it covers, joined by the
` · ` this file already uses for a list inside a label.

<sub>v3.0.0 — `internal/httpapi/identity_handlers.go` · `web/frontend/src/MetadataPage.jsx` ·
`internal/httpapi/metadata_rows_test.go` · `web/frontend/test/dom/console-rows-act.test.jsx` ·
`web/frontend/test/journeys/who-played-this-character.journey.mjs`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
