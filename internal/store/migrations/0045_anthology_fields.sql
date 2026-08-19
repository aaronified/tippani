-- Per-anthology field visibility: what an anthology shows, and therefore what it
-- exports.
--
-- WHY THESE LIVE ON THE ANTHOLOGY ROW rather than in the preferences blob or as an
-- export query parameter. A collection of film lines wants its actors named; a
-- collection of book passages wants chapters and pages; a book of proverbs wants
-- neither and no dates. One global preference cannot say all three at once, which
-- is most of the reason to want the feature at all. On the row, the choices travel
-- with the anthology through the export, the re-import, the bin and the account
-- backup — none of which had to learn anything new for that to be true.
--
-- AND THEY GOVERN THE READING VIEW AND THE EXPORT EQUALLY. What you see when you
-- read the anthology is what you get when you export it. Every other export in
-- this app round-trips faithfully and an export that quietly differs from the
-- screen is the kind of surprise you only find in a file you already sent
-- somebody.
--
-- HIDE_ VERSUS SHOW_, AND WHY BOTH APPEAR HERE. The convention throughout this
-- repo is that a default must be the ZERO VALUE — the prefs struct is compared
-- with != and a non-zero default there is a preference that reads as changed the
-- moment it is read (see hideLibrary versus showAnthologies for the same
-- asymmetry). The same rule applied to a column keeps DEFAULT 0 honest and makes
-- an upgraded database identical to a fresh one:
--
--   hide_credit      the credit IS shown today, so hiding is the opt-in
--   hide_source      likewise
--   hide_commentary  likewise — the per-entry note (0043)
--   hide_colour      likewise — the category bar
--   show_locator     the chapter / page / timestamp is NOT rendered today, in the
--                    reading view or the export, so showing it is the opt-in
--   show_date        noted_at is NOT rendered today either, same reasoning
--
-- Read that list as the six switches the owner asked for and not as a closed set:
-- the mechanism is a filter the renderer consults, so a seventh switch is a column
-- and an entry in that filter rather than a new code path.
--
-- INTEGER AND NOT BOOLEAN because SQLite has no boolean, and 0/1 is what every
-- other flag in this schema stores (favorite, review_excluded). NOT NULL DEFAULT 0
-- so a row written by an older binary — or by the restore of an older backup —
-- reads as "show everything", which is what those anthologies looked like.
--
-- No CHECK constraint: these are read as truthy in Go and in SQL alike, and a
-- CHECK on six columns is six things SQLite cannot later alter (0029 rebuilt four
-- tables to widen one CHECK, which is the whole argument).

ALTER TABLE anthologies ADD COLUMN hide_credit     INTEGER NOT NULL DEFAULT 0;
ALTER TABLE anthologies ADD COLUMN hide_source     INTEGER NOT NULL DEFAULT 0;
ALTER TABLE anthologies ADD COLUMN hide_commentary INTEGER NOT NULL DEFAULT 0;
ALTER TABLE anthologies ADD COLUMN hide_colour     INTEGER NOT NULL DEFAULT 0;
ALTER TABLE anthologies ADD COLUMN show_locator    INTEGER NOT NULL DEFAULT 0;
ALTER TABLE anthologies ADD COLUMN show_date       INTEGER NOT NULL DEFAULT 0;
