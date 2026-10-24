# ADR-0863: A door that outlived its reason

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

**THE RULING, AND IT IS NOW THE REPO'S MANTRA.** The owner: *"The in-depth controls were a
screen before because this was part of a long settings screen. Now it has its own screen.
There is a lot of space. Use the space available. Think like the user. Whatever will be used
more needs to be up front. This is how to design an intuitive ui. Bake this into the
claude.md."* It is in CLAUDE.md under the standing UI rules, and Review is the worked example
it names.

**WHAT THE CAPTURE SHOWED.** Three controls and five hundred pixels of empty ground, with ten
more behind a door called "In-depth controls". Every one of those ten was put there when
Settings was one column of nine cards, where an extra row was something to scroll past on the
way to the fonts. The constraint is gone and the door survived it.

**THE SPLIT IS BY WHAT IS ASKED, NOT BY HOW FIDDLY IT LOOKS.** Everything about the QUESTION
goes on the screen: how much of it, what it draws from, how hard it is, which kinds get asked,
whether it confirms. Everything about the SCHEDULE stays behind the door: adaptive or ladder,
where a new line enters, the seen multiplier, and the ten numbers.

> **SUPERSEDED — see "Review: the schedule comes out from behind the door" at the foot of
> this file.** The second half of that sentence is no longer true and was wrong when it was
> written: the pack keeps only the ten numbers behind the door, and adaptive, practice,
> where a new line starts and the seen multiplier are on the section. The first half stands. That is one decision a
reader makes once and then lives inside, and it is the only thing left that a door is for.

**THE REPERTOIRE HAD THE BEST CLAIM OF THE LOT.** Its own commit says why: until 1.16.0 the
deck's question types were a constant, so *"somebody who cannot bear multiple choice, or who
wants the daily deck to be nothing but fill-in-the-blank, had no way to say so."* That want
was answered — two presses and a scroll away, inside a pop-up.

**AND "HOW HARD THE QUESTIONS ARE" IS THE CONTROL SOMEBODY REACHES FOR** the moment the deck
feels wrong in either direction. It was the fifth block down inside the door.

**TWO HEADINGS COLLIDED ON THE FIRST CUT, WHICH IS THE SAME DEFECT ONE LAYER IN.** The door
got a numbered group of its own titled "How the schedule moves", and the panel it opens took
the same words — so one press showed the phrase twice. A group heading over a single button is
a heading saying what the button says: the group went, and the panel kept the name. The
tuning block INSIDE the panel had been called "How the schedule moves" too, which made the
panel's title a repeat of its own first heading; that one is "The numbers behind it" now,
which is what it is.

**THE DOOR'S LABEL SAYS WHAT IT HOLDS.** "In-depth controls" describes the door, not the room.

*Unreleased — `web/frontend/src/Settings.jsx`, `internal/i18n/en.txt`, `internal/i18n/bn.txt`.*

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
