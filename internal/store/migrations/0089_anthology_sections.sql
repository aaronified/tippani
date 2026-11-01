-- 0089: sections in an anthology, and a grouping setting.
--
-- A SECTION IS A HEADING THE READER WRITES, with optional prose under it, placed anywhere among the
-- entries. It lives in the entries' own position space, so one ordering covers both and a move of
-- either is one write.
--
-- anthology_slots IS THE ONE PLACE THE TWO ARE READ TOGETHER. Every query that asks "what is the
-- next position" or "what follows this" has to see sections as well as entries, or a renumber moves
-- passages into the wrong section and a new entry ties with a trailing heading. Reading them through
-- a view means a third kind of slot is one more arm here and not a hunt through the handlers.
CREATE TABLE anthology_sections (
  id           INTEGER PRIMARY KEY,
  anthology_id INTEGER NOT NULL REFERENCES anthologies(id) ON DELETE CASCADE,
  position     REAL NOT NULL,
  title        TEXT NOT NULL DEFAULT '',
  prose        TEXT NOT NULL DEFAULT ''
);
CREATE INDEX idx_anthology_sections_order ON anthology_sections(anthology_id, position);

CREATE VIEW anthology_slots AS
  SELECT anthology_id, position, kind, item_id FROM anthology_entries
  UNION ALL
  SELECT anthology_id, position, 'section', id FROM anthology_sections;

-- How the page groups consecutive passages under a header of their own: '' (not at all), 'work',
-- 'person' or 'character'. A DISPLAY SETTING, like the anthology's field switches: it reorders
-- nothing, and a section heading ends a run. Validated in app code, as the other vocabularies are.
ALTER TABLE anthologies ADD COLUMN group_by TEXT NOT NULL DEFAULT '';

-- A SECTION RIDES THE STAGING QUEUE ON THE ENTRY IT OPENS. Staging is per quote, so a heading in an
-- imported anthology file is carried as the title and prose of the section that begins at this
-- entry; approval creates the section just before the entry. A heading with nothing after it has no
-- entry to ride on and is not imported.
ALTER TABLE staged_quotes ADD COLUMN anthology_section TEXT NOT NULL DEFAULT '';
ALTER TABLE staged_quotes ADD COLUMN anthology_section_prose TEXT NOT NULL DEFAULT '';
