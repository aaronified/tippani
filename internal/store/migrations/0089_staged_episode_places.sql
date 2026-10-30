-- 0089: where a staged line's episode sits in the show's other orders.
--
-- An export writes `episode_dvd` and `episode_custom` beside a line's episode name (the show's orders,
-- 0088). Every import lands in the staging queue before it reaches the library, so the places have to
-- be carried through it: one text column, "dvd:2:1,custom:5:7", empty for every book, film and line that
-- names none. They are applied on approval, to an episode that has no place in that order yet.
ALTER TABLE staged_quotes ADD COLUMN episode_places TEXT NOT NULL DEFAULT '';
