-- 0080 — AN ANSWER SENT TWICE IS ONE ANSWER.
--
-- The Daily Quiz used to post each grade the moment it was given and forget it
-- if the post failed: Next moved on, the server never heard, and the card came
-- back after a refresh. The owner, on 1 October: "4 registered. 1 didn't. Now on
-- page refresh, that will come back." So the browser now keeps every answer until
-- the server has taken it, and sends it again until it does.
--
-- SENDING AGAIN MEANS A REPLY CAN BE LOST AFTER THE WRITE, and the next attempt
-- then arrives as a second answer. A Daily answer was already safe — a same-day
-- repeat is an echo (`touchedToday`) — but a Practice answer was not: it would be
-- logged twice, tallied twice, and with `srPracticeCounts` on it would compound
-- the half-life twice. So every queued answer carries an id the browser made,
-- and the log keeps it: an id the log already holds is answered with the state
-- as it stands and writes nothing.
--
-- NULLABLE, because every answer before this has none and an answer from an
-- older client still sends none. The index covers only the rows that have one,
-- and it is per reader: two readers' browsers may not share an id space.
ALTER TABLE item_recalls ADD COLUMN client_id TEXT;

CREATE UNIQUE INDEX idx_item_recalls_client ON item_recalls(user_id, client_id) WHERE client_id IS NOT NULL;
