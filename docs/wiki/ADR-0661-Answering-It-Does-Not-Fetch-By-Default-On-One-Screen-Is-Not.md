# ADR-0661: Answering "it does not fetch by default" on one screen is not answering it

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 2.2.4

**Decided.** The film board fetches the character art for the faces it is about to draw, from what it is already holding.

**Why the panel was not enough.** 2.2.3 made the People panel call `POST /cast/{id}/image`, which was the first caller that route had ever had. But the panel is not where character faces appear in quantity — a work's board of lines is, and a reader who never opens People saw exactly the empty chips they had reported. Fixing the reported symptom on the surface that does not show it is a fix that reads as complete and is not.

**It costs nothing when there is nothing to do**, which is what makes it safe to do on a page rather than behind a button: `GET /movies/{id}` already carries both image fields on every cast row, so the page can answer "is anything missing" without asking anyone, and only then asks. Serial and capped for the reason the panel's is. The page is told once, at the end, and only if something arrived. **Since 3.1.0 the asking is one request the server does whole** — `POST /movies/{id}/cast/art`, shared with the headshots (*The route was right and nothing was asking*, below) — where the board went for each role's id itself, one `POST /cast/{id}/image` at a time.

<sub>2.2.4 — `web/frontend/src/cast.jsx` · `web/frontend/src/Movies.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
