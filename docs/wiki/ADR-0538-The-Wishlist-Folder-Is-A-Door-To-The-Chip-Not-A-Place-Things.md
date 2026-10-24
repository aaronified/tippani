# ADR-0538: The wishlist folder is a door to the chip, not a place things live

Source of truth: this wiki page.

- **Area:** [§14 Boards, Cards, Charts and Popups](ADR-Index.md#area-14)
- **Status:** Accepted
- **Version:** 1.12.0

**Decided.** An optional tile at the front of the Library's flat board, folding every book with zero quotes into one cover — a collage of the first four. Opening it switches to the `wishlist` chip that has existed since 0024. Persisted, off by default, flat board only, and not selectable.

**Why.** The wishlist is derived and stays derived (see the entry above): a work with zero annotations *is* the wishlist, no column, no bookkeeping. That decision solved *browsing* them and did nothing about the real complaint, which is that they are IN THE WAY. Forty unopened covers scattered through a grid of books you have read is forty tiles of noise between the ones you are looking for, and the chip only helps when the wishlist is what you came for.

So the folder holds nothing. It is a rendering of a filter — open it and you are in the chip. That is what keeps 0024's property intact: a folder with its own membership would be exactly the second source of truth the derived wishlist was chosen to avoid, and it would drift the first time somebody quoted a book while the folder was on screen.

**Not selectable**, and this is the part that would have been wrong the other way. A tick in its corner would have to mean "select the twelve behind it" — a different act from every other tick on the board, over rows the bar cannot count because they are not on screen. The bar's whole invariant is that its count is a count it can act on.

**Flat board only.** Inside the wishlist chip there is nothing to fold away from; grouped by author or series, a "Wishlist" folder would appear inside each bucket meaning "the unquoted ones by Borges", which is a different thing from the folder on the flat board and looks identical.

**Persisted, and Reset leaves it alone.** It is not a question about this visit — it is how you want your board drawn, the same class as the cover size. Off by default because a grid that silently rearranged itself on upgrade is a library that looks like it lost books.

**Instead of.** A real `wishlist` collection with membership (the second source of truth 0024 refused). Hiding the unquoted outright (loses them). Folding on the Catalogue too — not asked for, and the film side's board has different pressure on it.

**Approved.** The reader chose the derived version over an explicit one, having been shown both.

<sub>1.12.0 — `web/frontend/src/works.jsx` · `web/frontend/src/Library.jsx` · `web/frontend/src/index.css` · `web/frontend/test/dom/wishlist-folder.test.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
