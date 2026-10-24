# ADR-0834: The search bar's helper text, and a word that was thrown away

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

Two more from the same rating, both small and both about the bar saying what it is
doing.

**THE WORDS WERE ON TWO SCREENS AND THE PILL WAS ON FIVE.** The ask was for the
context in the helper text "along with the pills", and the scoped screens — Library,
Catalogue, Quotes, and a work you have open — wore the pill and then offered "author,
tag, a line you half remember…", which is advice about HOW to type and says nothing
about where the typing goes. `shell.search.hint.within` names the scope in the sentence
now, and `hint.scoped` is gone.

**AND × THREW THE WORD AWAY.** Pressing the pill's × having typed something landed the
reader on an empty search screen. Asking for the whole library is a reader saying "not
here — everywhere", and answering it by discarding what they typed makes them type it
twice. It carries now, on both paths; what the screen's own filter is holding is still
released, because they have stopped asking the screen anything.

**ONE LABEL WAS SIMPLY WRONG.** The metadata console published "people and metadata"
while filtering the works-and-films list — a pill naming people over a list of books.
It says "works and films", which is what that console holds.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
