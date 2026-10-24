# ADR-0797: A card says where in the book once, and the plan for it was one size too big

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

The owner, from their own phone, in one message: *"the book annotations in the book details
view do not need to show page number if chapter details are available. think through all
cases like that"*, *"date of capture is not needed on any card"*, and *"except for the quote
annoations, others do not need year of writing/shooting/recording etc. as those are already
there in the work level details."*

### Where the plan was wrong: the surface prop was not needed at all

The plan read *"in the book details view"* as the rule's SCOPE and concluded the card needed
something it does not have — a prop saying which screen it is on — and that this was the
bulk of the work: *"a card cannot tell which surface it is on… so 'in the book details view'
is not expressible today — adding that is part of this job, not a detail of it."*

It is not, and the enumeration the owner asked for is what shows why. The redundancy is
between **two fields on one card**, not between a card and the surface under it. A page
number is no more useful beside a named chapter on Home, in a search hit or on a recall card
than it is on the book page. And a rule scoped to one screen would put the identical row on
two screens reading two different ways — which this repo's own directive forbids in as many
words ("two things that look the same behave the same"). So the rule is unconditional, the
prop is unnecessary, and the whole of (1) is one function.

### Thinking through all cases, which is what the ask actually asked for

Every pair a card can print, and whether one answers for the other:

| The pair | Same question? | What happens |
|---|---|---|
| chapter · page (book) | **yes** — both say where in the book | the chapter wins |
| episode · timestamp (show) | no — *which* episode, then *where inside it* | both stay |
| essay title · page | no — *what piece*, then *where in it* | both stay, and `essay-at` already prints them as one citation |
| speaker text · person chip | yes | already handled — `chipCount ? null : a.character`, `creditsNotOnChips` |
| work title · the work's own page | yes | already clean: no card prints it |
| board name · the board | yes | already clean: no card prints it |
| kind's word · the kind's phrase | yes | already handled in `attribution.js`'s `phrase` |
| language word · script mark | the owner ruled the mark stays ("the script mark should be in the same row") | left alone |

So exactly one live instance, and the reason the chapter is the half that survives is
stronger than tidiness: **a chapter is the locator that survives an edition and a page is the
one that does not.** A reader holding a different printing gets one durable fact and one that
is wrong for them.

### The consolidation found three defects nobody reported

Four screens composed the pair by hand — `Library.jsx`, two places in `Home.jsx`, and
`review.jsx` — and no two agreed:

- **Library prefixed `CH.` onto a chapter NAME**, so "CH. Envoi" appeared where Home and the
  recall card printed "Envoi". `chapterMeta` exists precisely to stop that and its own
  comment claimed it had: *"Library's own meta line, which prefixed CH. onto everything
  unconditionally, stops disagreeing with Home and the quiz."* It never did — the comment
  described an intention.
- **Two locale keys for one string.** `common.locator.page.label` is `P. {n}` and
  `common.locator.page.short.label` was `P.{n}`; they differed by a space, and Library used
  the short one. The key is retired.
- **A caption hard-coded in English.** `chapterMeta` spelled `CH. ` as a literal, in a module
  that imports nothing on purpose — so a Bengali reader got "CH." on Home and the recall card
  and the translated caption on the book page, for one row.

### Where it lives, and why not in `text.js`

`locatorMeta` is in `attribution.js`. `text.js` takes strings and returns values and has **no
imports at all**, deliberately, so it cannot reach `t` — which is exactly how the caption came
to be hard-coded there. A caption is vocabulary, so it belongs beside the vocabulary
`attribution.js` already owns, under the same rule that module states for itself: i18n and
nothing else, so it cannot be the far end of a cycle. `chapterLabel` stays in `text.js`,
because punctuating a number and a name is not vocabulary. `chapterMeta` is deleted rather
than kept beside the new function, and `locator-meta.test.js` fails if it comes back.

### (3) was not a card at all, and it is a default rather than a removal

The work's year is on **no card** — searched for `published_year` and `release_year` across
every screen. It appears in work headers, in the metadata console, in the add surface's
edition rows (where it is what distinguishes two printings), and in the **share payloads**,
which is where the owner was seeing it. So the fix is `SHARE_OFF_BY_DEFAULT`, which already
held the page number and the save-date: `published` and `year` join them.

A default and not a removal, on the owner's own ruling about this dialog — *"the user anyway
chooses what to put on the share image"* — so both parts stay listed and one tap away. A
reader composing an epigraph wants the year in it; what changes is what arrives unasked.
`quoteShare`'s `when` is deliberately untouched: that is the OCCASION's date, the quote's
own, and there is no work behind a broadcast line to carry a date instead.

### Two places the date deliberately stays

The table view's sortable **Date** column, and the **staging queue's** rows. The queue row is
not a card — its own comment says what it is, *"Every kind's locator on one line — a staged
row shows whichever it has"* — because its job is to show every field so the reader can check
it before approving. Suppressing a field there would hide the thing under review.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
