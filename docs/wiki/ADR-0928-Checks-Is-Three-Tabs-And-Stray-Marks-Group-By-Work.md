# ADR-0928: Checks is three tabs, and stray marks group by work

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

**What was wrong.** Checks was one long page of six sections stacked under each other, with a filter style per section (a row of
chips on Stray marks, group headings that opened on Corrections, headings with no control at all on the others). Stray marks listed a
quote per row and repeated the work's title on every one, and each row had a lone button, "Open where this quote lives", that
opened the work and nothing more: the owner's words were that the button took you to the work and there was no need for it.

**Decided, by the owner, 1 November 2026.**

- **Three tabs on the shared section rail** (Settings and Metadata draw the same one: a row of tabs on a desk, an index list on a
  phone): **Imports**, **Stray marks** and **Files**.
- **Stray marks group by work.** One card per work, the poster at its head as the only way into the work, the quotes with something
  wrong under it. Each quote has **Edit**, which opens the same edit form the work's page does (loaded with `GET ...?id=`, saved
  with the usual full-state PUT, as the review card does), and **In context** when the file's lines are stored. A standalone quote
  has no work and shares one group. Two columns from 1100px wide.
- **The Files tab** holds Files in your library folders, Times and places from files and Corrections from the file, each folding
  away by its title, each filtered with the same pills (`bucketFilter.jsx`: All, then one pill per group with its count). The
  attached-files prune, which was not in the owner's list of three, stays as a fourth section rather than losing its only door.

**Not built yet.** Character checks on this page wait on the character detection existing; there is nothing to list.

**What it costs.** The stray-marks answer carries `work_cover` for each row. Corrections' buckets stopped being headings that open:
the pill is the filter and every row of the chosen bucket is listed. A Files tab with nothing waiting is blank, since every section
draws nothing when it has nothing.

See also: [ADR index](ADR-Index.md) · [Home](Home.md)
