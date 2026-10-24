# ADR-0090: A board is a work, and /quotes is a two-level screen like the other two

Source of truth: this wiki page.

- **Area:** [§4 What a Quote Is](ADR-Index.md#area-4)
- **Status:** Accepted
- **Version:** Not shipped

**Decided.** The three-board segmented control shipped in 1.13.0 is **withdrawn**. Boards become rows the reader owns, listed on `/quotes` the way books are listed in the Library and films in the Catalogue, each opening its own page at `/quotes/{id}`. The reader creates as many as they like. Called **boards**, on screen and here.

**Why, and it is my error rather than a change of mind.** I built the board as a filter. It is not one: a filter narrows what you see *within* a container, and the board decides which container you are in. Everything that went wrong followed from that single misclassification — `WorkListScaffold` renders the `leading` slot inside the **Filters sheet** on a phone, so the three boards were invisible on the device the app is designed for first; and it gates that whole row on `hasItems`, which `Quotes.jsx` passes as *the current board is non-empty*, so switching to an empty Speeches board **removed the control that got you there**. `tippani:quotes:category` is persisted, so a reload did not rescue you. A reader on a phone saw a screen identical to 1.12, which is exactly what was reported.

Neither is a bug to patch. A control that belongs above the list was placed in the drawer that narrows the list, and the fix is to stop calling it a filter.

**What this buys beyond the fix.** The route falls out for free (a board's page is a work's page), capture inside a board files into that board exactly as capture inside a book does, and the vocabulary stops being three names the code knows.

**Approved.** The reader's, in the form "proverbs, speeches, and others (user can create other boards) sit in the quotes page like works do in libraries."

<sub>Not shipped — supersedes the 1.13.0 board toggle</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
