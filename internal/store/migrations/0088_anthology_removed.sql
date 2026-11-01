-- 0088: an anthology remembers what was taken out of it.
--
-- WHAT WAS WRONG. Removing an entry was a plain DELETE, and a rule that fills an anthology
-- (0075) inserts whatever matches and is not already there. So a passage removed on Monday
-- came back the next time the rule ran, and the only defence was not to use the rule.
--
-- A REMOVAL IS A ROW NOW. It is keyed the way an entry is (anthology, kind, item), so the
-- two can never both exist, and it keeps the entry's note and position so bringing the
-- passage back restores both. It lasts until the passage is brought back or the anthology
-- is deleted, because a rule can run again at any time.
CREATE TABLE anthology_removed (
  anthology_id INTEGER NOT NULL REFERENCES anthologies(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL,            -- book | screen | utterance, as anthology_entries
  item_id      INTEGER NOT NULL,
  position     REAL NOT NULL,            -- where it was, so a restore puts it back there
  note         TEXT NOT NULL DEFAULT '', -- the commentary that went with it
  PRIMARY KEY (anthology_id, kind, item_id)
);

-- The quote itself going away takes its removed rows with it, as 0043's triggers do for
-- entries: a list of removed passages that cannot be shown (no quote behind them) is a row
-- nobody can act on.
CREATE TRIGGER anthology_removed_book_del AFTER DELETE ON annotations BEGIN
  DELETE FROM anthology_removed WHERE kind = 'book' AND item_id = OLD.id;
END;
CREATE TRIGGER anthology_removed_screen_del AFTER DELETE ON dialogues BEGIN
  DELETE FROM anthology_removed WHERE kind = 'screen' AND item_id = OLD.id;
END;
CREATE TRIGGER anthology_removed_utterance_del AFTER DELETE ON utterances BEGIN
  DELETE FROM anthology_removed WHERE kind = 'utterance' AND item_id = OLD.id;
END;
