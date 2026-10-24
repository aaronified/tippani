# ADR-0428: A shortcut is not real until the button that shares its job says so

Source of truth: this wiki page.

- **Area:** [§12 Shell, Navigation and Entry Points](ADR-Index.md#area-12)
- **Status:** Accepted
- **Version:** 1.16.x

**Decided.** One table (`keys.js`) binds every key to an ACTION id, and `Tooltip` takes a `shortcut` prop that reads from it — so `<Tooltip label="Search" shortcut="search">` renders "Search · /". Bind a key and the control starts announcing it; change the key and the control changes with it.

**Why the registry rather than handlers per screen.** There was no global registry at all, which for a text app with a large library was the biggest single desktop gap. The alternative — a keydown handler on each screen — fails twice: a shortcut that works on one screen and silently does nothing on the next is worse than none, and bindings enforced in a dozen places will disagree with each other. There is one window listener, and it knows which key means which action and nothing about what an action does.

**Typing is never a shortcut**, and that single rule decides whether the feature is usable or infuriating. `n` is "capture a quote" and also the fourteenth letter of a note somebody is writing, so a key pressed inside an editable target is just a letter — and "editable" has to include `contenteditable`, not only `input`/`textarea`, or a rich-text field would eat its own content.

**Invariants the table is tested against:** no id twice, no key bound to two actions (which is a coin toss dressed as a feature), and no single key that is also the first key of a sequence — pressing it would have to fire immediately or wait to find out, and both are wrong. `?` and `/` are kept distinct because one is Shift-ed and the other is not; folding Shift in would open the help sheet when somebody meant to search.

**The review keys are the exception and belong to the card.** A grade only means something to the card in front of you, so `QuizRunner` owns `1`, `2` and `Space`, gated on the same conditions the buttons are — the key and the button can never disagree about whether a card is answerable.

**Instead of.** A key legend in the help sheet only, which is where shortcuts go to be forgotten.

**A binding's identity includes its CONTEXT.** A quiz shows one of three kinds of question and they want different answers, so `ctx` is part of what makes a binding unique: `1` is the first MCQ answer and `Forgot` on a flip card, and the two never share a screen. Binding `1` globally to "Forgot" would mean pressing it on a four-option question graded the card instead of answering it — a keystroke that silently marks the reader wrong. A context key may not shadow a global one, which is tested, because a global is live everywhere and the two would both fire.

**Practice asks for Shift and the Daily Quiz does not**, which is the one place this app deliberately makes a gesture harder. The decks show the same card with the same buttons and are not the same act: the daily deck IS the schedule and its grades are permanent. A reader running through Practice with the daily keys in their fingers should not be able to move a schedule by reflex, so the LOWER-stakes mode is the one that costs an extra finger — and a key with the wrong modifier does nothing rather than doing the right thing anyway, because a guard that can be ignored is not a guard. `eventCombo` reads `event.code` for digits so `Shift-1` is not `!` on one layout and something else on the next; it reads `key` for letters, because `code` names a physical position and would give a Dvorak reader the wrong action.

**The legends are generated, and nothing is listed that does not work.** `?` opens a sheet built from `groupedShortcuts()`, the drawer prints each destination's key on its own row, and the quiz's buttons carry theirs — all from the one table, because a legend maintained by hand is wrong by the second release. The first draft of that table also bound a command palette, `j`/`k`, `f`, `e` and `u` with no handler behind any of them; since the sheet and the tooltips both read it, an entry is a promise printed on a button, and those five would have been promises the app does not keep. A test now fails if an unwired action is added.

<sub>1.16.x — `web/frontend/src/keys.js` · `web/frontend/src/ui.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
