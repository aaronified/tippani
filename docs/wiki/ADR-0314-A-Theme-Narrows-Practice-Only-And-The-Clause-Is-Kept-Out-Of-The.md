# ADR-0314: A theme narrows Practice only, and the clause is kept out of the shared eligibility string

Source of truth: this wiki page.

- **Area:** [§8 The Review Loop](ADR-Index.md#area-8)
- **Status:** Accepted
- **Version:** 1.15.0

**Decided.** `reviewTheme` is threaded through the three candidate queries as its own clause. It is **not** added to `reviewSource.where()`, and `handleDailyQuiz` passes `reviewTheme{}` **by name** with a comment saying why.

**Why not in `where()`.** Five queries splice that string and two of them are Daily's own: `dailyRemaining`, which decides the badge, and `reviewStates`, which draws the "where you stand" row. A theme there would narrow both — so opening a themed round would change the number of cards the app said were due today, in the same commit whose stated constraint is that Daily is not themeable.

**Why Daily is not themeable at all.** The daily deck IS the schedule. Filtering it would leave the cards that are actually due unasked while the streak still counted the day as cleared, which quietly turns the one authoritative surface into a second practice mode.

**A theme about something a kind cannot have drops that kind entirely** rather than leaving it unfiltered. "Quiz me on this book" over film lines must return no film lines — not all of them, which is what an ignored clause does.

**The buttons are contextual rather than central.** There is no "pick a theme" screen: you are already looking at the book, the tag, the person or the colour when you want to be asked about it. A picker would mean choosing a book from a list of books one screen after leaving the list of books.

**Approved.** The reader's, as "themed review".

<sub>1.15.0 — `internal/httpapi/review_theme.go` · `web/frontend/src/review.jsx` · `web/frontend/src/works.jsx` · `web/frontend/src/StatsPage.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
