# ADR-0791: Four fields the add surface asked for, and one argument reversed

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted, then changed or withdrawn: the entry says how

The owner's ground-up redesign of the add surface needed four things the schema could not
hold. Two are new relations, one is a second half of an existing locator, and one is a
column two tables should have had since 0051.

### Who the words reach us through

**The owner's case decided the shape of it:** *"letter/speech needs a source article, and
also a source author/editor. e.g. socrates' speeches are known from plato's paraphrasing."*

The source *article* already had a column — 0047's `work_title` — so a letter and a speech
simply get it back on their forms. The person who wrote that article had nowhere at all,
and the test that settles whether a field needs its own column is whether any existing one
is the same fact. Four names sit on an `utterances` row and Plato is none of them:

| Column | What it means | Is it Plato? |
|---|---|---|
| `speaker` | who said it | No — Socrates said it |
| `recipient` | who it was said **to** (0047) | No — a letter's addressee |
| `author` | not on this table; a `books` row has one | No — an utterance has no work to hang it off |
| `character` | the annotations/dialogues column: a person **inside** a work | No |

So `source_author` is a fifth relation: the person the words *survive through*. Before it,
recording Plato meant putting "as paraphrased by Plato" in the note, where nothing can
group by it, cite it or find it.

**In the search index, on the same argument `speaker` and `recipient` already won.** The
reason to write Plato down is to find the Socrates lines by typing Plato; a name outside
the index is a name you can only reach by remembering which quote it sits on, which is the
thing you were looking up. That cost one rebuild of `utterances_fts` — fts5
external-content tables cannot gain a column (0029, 0047, 0051, 0069 all paid it). **The
column was proven load-bearing rather than assumed**: pulled out of the index, the search
test returns zero hits.

**`utterances` only.** A book highlight's source is the book — the row already points at it
by id, and a second typed answer beside a real foreign key is how the two come to disagree.
This is the one kind of quote with no work behind it, which is exactly why 0047 gave *this*
table the four free-text locators and not the other two.

### Where a line stops

*"Film timestamp: start and end."* A second column rather than a range spelled inside the
first — `"01:12:40–01:13:02"` in one field would be one string every reader has to re-split,
and the sort, the card, the IMDb import, the dedupe hash and the Markdown export all read
`timestamp` as it stands today. A start that keeps meaning exactly what it meant is a change
nothing downstream has to notice.

Out of the dedupe hash, for the reason `occasion_circa` is: the same line timed to the same
start is the same line, and folding the end in would make *correcting* it fork a duplicate
on the next import of the same file. Not in the search index either, because no locator is
— you do not find a line by typing the minute it lands on.

A game's line has neither end. `normalizeLocator` already dropped a timestamp on a game
(0047); it now drops the end with it, in the same branch, because an end with no start
points at nothing.

### Which pack a game's line came in

*"Game needs a DLC field for DLC quotes. act, and quest remain as is."* A third game
locator, coarser than both the others: an act and a quest place a line inside a body of
content, and the DLC names **which body** — Blood and Wine, Far Harbor, Phantom Liberty.
Without it two expansions that both open with a "Prologue" are one shelf.

**It joins `gameRef`**, so "which locators does a game have" keeps one answer rather than
gaining a second one next door to the first — and the games-only clearing rule it needs is
already written there.

**But it is not identity, and act and quest are.** Those two are in the dedupe hash on
0025's reasoning: a bark reused in two quests is two quotes. A DLC name is a container the
act and quest already sit inside, so folding it in buys no distinguishing power and would
fork a duplicate the moment somebody filled the name in on a line that already existed.
`gameRef`'s comment says which of its three fields is which, because a reader who took
"both are identity" at its word and added a third field under it would get this wrong.

### A language belongs to the line, and 0051 said otherwise

**This is a reversal, and the old reasoning is quoted rather than deleted.** `quote.go`
carried this note from 0051 to 0070:

> NO Language BESIDE IT HERE. A standalone quote carries its own, because it has no parent
> to ask; an annotation's is the book's (0047's two columns); a film's is nowhere yet.
> Promoting Language would put a permanently unfillable field on two kinds.

The middle claim is the wrong one. **A language is a fact about the line, not about the
shelf it came off:** a Bengali couplet quoted inside an English novel is in Bengali, and a
line of Hindi in an English-language film is in Hindi. Neither is answered by asking the
work.

**What settled it was that the field is load-bearing, not decorative** — the owner's: *"it
is the thing that ascertains whether a translation will get priority over a quote text or
not. it should be everywhere."* `translation` has been on all three kinds since 0051. The
fact that ranks the two texts was on one. So for two releases a book highlight and a film
line could hold a second text with nothing able to say which of the pair should lead.

`Language` is now on the shared `quoteReq`/`quoteRow`, which is what makes it one field
rather than three — and **its 100-character cap moved with it**, so an annotation and a
dialogue refuse the same absurd value a standalone quote always did. A promotion that left
the rule behind would have given two kinds a name column able to swallow prose.

**Free text, deliberately, and not an ISO code.** The language respec — one master list,
four display states, three scopes — is queued and will migrate all three columns together.
A code column here would be guessing at that design's shape and would have to be undone;
the same free-text column the app already has makes the respec one migration over three
tables instead of one over one.

### Deliberately not done here

- **No frontend.** Every one of these is a column with a handler, an export, an importer, a
  staging row and a bulk editor behind it and no box on any screen yet. The forms that draw
  them are the add-surface rework, and shipping the schema first is what lets that work be
  about layout rather than about migrations.
- **`timestamp_end` and `dlc` have no `_orig` snapshot.** Only the locators the reader can
  *reset* in the import queue carry one, and neither of these is parsed out of a file
  wrongly — one is typed in the app and the other is a name.
- **Neither new locator is in a search index**, and that is consistent rather than lazy: no
  locator is. `dialogues_fts` holds the quote, the note, the character, the actor and the
  translation, which are the things a reader has words for.

### And the pack list is a pool, not a picker

`GET /movies/{id}/packs` mirrors `GET /books/{id}/chapters` and lives in the same file,
because it is the same question one medium over: *what does this work already know about
its own locators.* Every argument in that handler's header transfers word for word — a
two-column query rather than a fetch of every line of the film, per work rather than
library-wide, empty as a legitimate answer rather than an error.

**It differs in one thing and the difference is the shape of the reply.** A chapter is a
number and a name that mean each other, so 0044's pairing lets choosing one fill the other,
and the endpoint returns objects to express it. A pack is a name and nothing else: act and
quest sit *inside* it and are not implied by it, because one expansion holds many quests.
So a flat list of names is the honest shape and a pair would be inventing a mapping.

**A film answers `[]` rather than 404.** The media type is not checked: a film's lines carry
no pack because `normalizeLocator` clears it, so the endpoint would have to be right about
a fact the writer already enforces. Two places asserting one rule is how they come to
disagree.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
