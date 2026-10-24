# ADR-0115: Read dates are partial TEXT compared lexically — then required to be real calendar dates

Source of truth: this wiki page.

- **Area:** [§5 Works, Shelves and Reading History](ADR-Index.md#area-5)
- **Status:** Accepted
- **Version:** 1.3.0, corrected later

**Decided.** `started_at` and `finished_at` are TEXT holding 'YYYY', 'YYYY-MM' or 'YYYY-MM-DD', compared as TEXT. The validator accepts all three shapes, bounds the year to 1000–3000, and for a full date hands it to `time.Parse` to confirm it exists.

**Why.** "I read it in 2019" is often all anyone honestly knows, and padding it to January 1st invents a precision nobody has. The three shapes sort correctly against each other lexically, which is the same trick `noted_at` has relied on since 0008, so `MAX()` over the mixed shapes is meaningful without parsing anything.

**Reversal.** The range checks alone were not enough and I fixed that. A day between 1 and 31 is not the same as a day that exists: the validator accepted 30 February and 31 April while its own comment promised "a stored date is always a real one". `time.Parse` is the calendar and now does the deciding.

**Approved.** Mine, and the correction is mine too — the comment was right and the code was not, which is the useful thing to record.

<sub>1.3.0, corrected later — `internal/httpapi/shelf.go` · `internal/store/migrations/0024_in_progress.sql`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
