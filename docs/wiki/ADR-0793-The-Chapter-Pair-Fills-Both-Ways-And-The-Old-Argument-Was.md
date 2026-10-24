# ADR-0793: The chapter pair fills both ways, and the old argument was answering a different question

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

`suggest.jsx` carried this, and it is quoted rather than deleted because it is not wrong:

> THE NAME IS THE KEY AND NOT THE NUMBER, deliberately. Filling the name from a number
> would be guessing at what somebody meant by "42"; filling the number from a name is
> repeating what they themselves typed against those exact words.

The owner's correction: *"chapter number auto populates from chapter name now, but not
vice versa. chapter name from number is more useful."*

**They are right, and the two claims are not in conflict — they answer different
questions.** The old note asks which direction is more RELIABLE, and its answer stands: a
name maps to a number the reader typed against those exact words, while a number maps to
whatever they happened to call chapter 42. The owner's question is which direction is
more USEFUL, and that turns on which box gets reached for first. You are holding a book
open at chapter 42. The number is printed on the page in front of you; the name is the
thing you would have to flip back to the contents to find. So the number is what gets
typed and the name is what is worth recalling — the reverse of what the one-way rule
assumed.

**The reliability is bought back by never overwriting.** `chapterPatch` fills only an
EMPTY counterpart, in both directions. The failure that guards against is specific: you
type 7, then pick a chapter name to save typing, and the 7 silently becomes 42 — you
would not notice until the quote was filed under the wrong chapter, and nothing on screen
would record that the app had done it. A disagreement is left alone and the reader's own
typing wins, so the less reliable direction can never cost anything.

**It moved to `text.js`, and that is the point of the change rather than a side effect.**
The rule had been a line inside the edit form and a second line inside the capture card,
which is the shape the repo's own directive forbids — two things that look the same
behaving the same has to live in one function both call. They had already drifted: the
add card's copy filled the number and the edit form's copy filled the number, and neither
did the direction the owner wanted, so fixing one would have left the other. Now there is
one import-free function, and `chapter-pair.test.js` reads it without mounting anything.

`useWorkSuggestions` keeps the DATA (`state.chapters`, pairs intact, commonest first) and
loses `chapterNoFor` — a hook is where the fetch belongs and not where a rule does.

**The tie-break is the pool's own order.** A name recorded against two numbers is
genuinely ambiguous, and the endpoint returns commonest first — so first-match is
most-used, and a one-off typo of a chapter name sinks rather than sitting next to the
real one. That is cheaper than the ambiguity chips `docs/plans/entry-helpers.md` proposes,
and it is the right cost here: this is a form whose whole point is being quick.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
