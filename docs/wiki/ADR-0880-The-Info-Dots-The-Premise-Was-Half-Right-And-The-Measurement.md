# ADR-0880: The info dots: the premise was half right, and the measurement said which half

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

The ask: *"Twenty-two in Settings alone. A dot on every heading is a dot nobody presses.
One at the section level; a dot lower down has to earn it by saying something a reader
cannot work out from the control itself."*

**THE COUNT WAS LOW, AND THE REASON IS WORTH KEEPING.** There are **twenty-four** below the
section level, not twenty-two: two are written as a bare `<InfoDot>` rather than as an
`info=` prop, so a grep for the prop misses them. A count of a thing that has two spellings
is a count of one of them.

**THE FIRST INSTINCT WAS TO DELETE, AND THE MEASUREMENT KILLED IT.** Every dot's body was
compared, word by word, against the text already on its own element — label, sub, title,
aside. The highest overlap of the twenty-four was **14%**; most were under 8%. **Not one was
a restatement.** What they carry is the invisible half of each control: a quote with no
speaker never joins the deck, a passphrase archive is recoverable by nothing, changing your
password deliberately does not unpair your phone, a multiplier below 1 would ask the same
quote for ever. None of that is on a label, and deleting the dots to reach "one per section"
would have deleted the only place it is stated.

**SO THE DEFECT WAS PLACEMENT, NOT REDUNDANCY**, and the ask's own second sentence is the
one that bites: *a dot on every heading*. Six sat on headings — attached to no control,
competing with the section's own dot at the same level, and pressable only by somebody
already curious. Five came down onto the row they are about: the archive's dot onto "Back up
now", the saved look's onto Save, the device rule onto the pairing control. One became a
`sub` line, because two short sentences saying what reordering the sections actually does —
it is the rail, the drawer and what ＋ offers — are needed BEFORE the drag, and a sub-line is
read where a dot has to be pressed. One went: "Never asked about" had the set's only caption,
describing the grouped, restorable list directly beneath it.

**ONE GROUP-LEVEL DOT SURVIVES AND IS NAMED IN THE GUARD.** The ten schedule numbers obey a
bound that is invisible at every slider and is not true of any single row, so it cannot come
down; ten copies of it on ten rows is the repetition this pass removes. `settings-dots.test.js`
holds that no `PrefGroup` carries an `info` except the one spelled out in its allow-list —
and a third case fails if that exception stops being taken, because an allow-list nothing
matches has quietly become dead text describing a screen that has moved on.

**AND THE SWEEP FOUND WHAT IT WAS NOT LOOKING FOR.** `DevicesCard` was the **last** component
in Settings still drawing its own `SectionTitle` — the pre-sectioning shape, missed when
every other card became numbered groups. That is why it had a heading-level dot at all: it
had a heading nothing else on the screen had. It is a `PrefGroup` now with its paired count
in the aside, and the guard's fourth case fails if any card heads itself again.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
