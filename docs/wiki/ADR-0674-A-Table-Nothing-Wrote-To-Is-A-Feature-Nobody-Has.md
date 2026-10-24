# ADR-0674: A table nothing wrote to is a feature nobody has

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 2.2.8

**Decided.** `GET /books|movies/{id}/cast` adopts every character named on that work's own
quotes.

**0048 built the table and 0048's own header said there was no screen.** 2.2.3 built the
screen. What neither noticed is that the only two things that ever WROTE a row were a
provider fetch and an Add button — and a book has no cast fetch, and most games have none
worth the name (TIP-META-018). So for the two kinds the table was built to serve, the list
was empty on day one and empty for ever, while the reader typed character names onto
highlight after highlight into a column 0047 had added for exactly this.

**THE SAVE PATH IS SIX PLACES AND THE LIST IS ONE.** A character reaches a quote from the
capture form, the edit modal, a bulk edit, the staging approve, a Markdown import and the
demo seed. A rule applied in five of six is not a rule — and it would still have needed a
one-time pass for every quote already written, which is the same code again with a
different lifetime. The list covers the whole history for free and is what the panel and
both capture forms already call. It writes nothing once every name is on, so the steady
state is one SELECT and no transaction.

**A GET THAT WRITES IS NOT FREE OF DOUBT**, and the answer to the doubt is that the write
is idempotent, bounded, and once per name ever. What made it acceptable rather than merely
convenient is that a row is permanent: the film board reads its cast from
`GET /movies/{id}`, which never calls this, and does not need to.

**The delete rule moved with it, and that is the part a test found.** `DELETE /cast/{id}`
hard-deleted a reader-authored row on the stated grounds that "nothing will ever re-add
it". Something does now. The condition is no longer "did a provider list this?" but the
question that was always underneath it: WILL ANYTHING RE-ADD IT? A quoted character is
tombstoned; a row nothing names is still deleted outright, so the litter argument survives
for the rows it was made about.

<sub>2.2.8 — `internal/httpapi/cast_from_quotes.go` · `internal/httpapi/cast_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
