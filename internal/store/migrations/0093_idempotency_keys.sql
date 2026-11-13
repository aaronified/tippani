-- 0093: idempotency keys (ADR-0933). A client that queues a write while it has no signal can send it twice when the
-- reply is lost: the request reached the server, the answer did not reach the client, so the client sends it again
-- and a second anthology, heading or quote appears. A request that carries an Idempotency-Key header is remembered
-- for a day, per account, with the answer it got; the same key and the same request answers that answer again and
-- does nothing.
--
-- Rows are not swept by a timer. A key older than a day is ignored when it is looked up, and the rows older than a
-- day are deleted when the next one is written, so an idle server costs nothing.
CREATE TABLE idempotency_keys (
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key          TEXT    NOT NULL,
    method       TEXT    NOT NULL,
    path         TEXT    NOT NULL,
    status       INTEGER NOT NULL,
    content_type TEXT    NOT NULL DEFAULT '',
    body         BLOB    NOT NULL,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, key)
);
CREATE INDEX idempotency_keys_created ON idempotency_keys(created_at);
