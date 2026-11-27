# ADR-0937: A staged quote's words can be edited, one row at a time

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted and built (API revision 13, feature `staged-text-edit`)
- **The owner, 27 November 2026**, on the Android app's plan for spoken bookmarks: "Quote text can't be edited in the imports queue. Only metadata can … Then add that feature as well."

**What was decided.** `PATCH /import/staged/quotes/{id}` changes one waiting quote's `quote`, `note` and `translation`. Any of the three may be sent; none is required, and at least one must be. The row's `dedupe_hash` is recomputed from the new words exactly as `stageQuotes` computes it. New words equal to another waiting quote's in the same staged work answer `409`. A row left with no quote and no note answers `400`. Another reader's row answers `404`, never `403`. `/capabilities` lists the feature `staged-text-edit` and `apiRevision` is 13, so an app can offer the control only to a server that has the route.

**Why.** [ADR-0820](ADR-0820-Bulk-Editors-One-Field-Table-Md-Retires-And-The-Seven-Places-It.md) says the staged bulk endpoint "corrects where a line CAME FROM, never what it SAYS", because a staged row records what a file said and wording is fixed after approval. That is right for a file somebody else wrote. It is wrong for a quote the owner made themselves and sent to the queue to look at later: the Android app turns a spoken audiobook bookmark into one line of Tippani Markdown and imports it, because the owner cannot trim it while driving. Its words are a draft by construction. Until now the only way to shorten them was to approve them into the library first and edit the saved row, which puts the untrimmed text in the library.

**Why a separate door and not a field on the bulk request.** "Set the text of these four hundred quotes" is a request nobody means, and the bulk endpoint's refusal of it is true, documented and tested (`bulk_fields_test.go`). The edit is one row, by id, from the screen that is showing it. The bulk endpoint, its comment and its tests are unchanged.

**The hash moves with the words.** `staged_quotes` is `UNIQUE (staged_work_id, dedupe_hash)`, which is what keeps a file's repeated line from being counted twice in the queue. A row whose text changed and whose hash did not would collide on a later edit or import and hide its real duplicate. A clash is refused with a sentence rather than merged, because the owner can see the two rows and meant them as two.

**Rejected.**

| Option | Why not |
|---|---|
| Text as another field of `POST /import/staged/bulk`, valid when the selection is one id | Keeps one door but makes the endpoint's stated principle conditional, and its refusal test would have to know the condition |
| Edit only after approval (what the queue offered) | Puts the draft in the library first |
| Trim in the app before upload | Possible, and the app may also do it, but it needs the clip to wait outside the queue the owner asked for |
| Let the importer keep the words and add a "draft" flag | A second state to carry through approval for a case one edit covers |

**Not changed.** Source provenance: a staged quote still arrives with the importer's source (`md`), not `voice`. That is a property of imports, not of this route.
