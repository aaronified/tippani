-- 0079 — jobs, their logs, and the app's own log, kept in the database.
--
-- THE OWNER: "Store jobs, job logs and system logs in the app's SQLite database;
-- stdout and stderr keep working for `docker logs`." Three tables, because they are
-- read three ways: a job is a row with a state that changes (queued, running,
-- finished), its log is append-only lines read in order under one job, and the
-- system log is append-only lines read by time and level across everything.
--
-- NO CHECK ON kind, state OR level. Design-decisions: "Open-ended vocabularies are
-- validated in app code, never in a CHECK" — a new job kind or log level is then a
-- Go change, not a table rebuild, and this file never has to be rewritten the way
-- 0029 rewrote five tables to widen one list.
--
-- TIMES ARE UNIX MILLISECONDS, not the datetime('now') TEXT the library tables use.
-- Every read here is a range — the last hour, the last 30 days, the prune's cutoff —
-- and several request lines land in the same second, so the order they arrived in
-- needs finer grain than a second to show.
--
-- jobs.id IS AUTOINCREMENT, which the library tables are not. The queue's in-memory
-- maps, a job's log spool and a link a reader keeps all name a job by id, and a
-- pruned job's id handed to a new one would put a stranger's job behind that link.
-- The two log tables do not need it: a plain rowid is reused only when the newest
-- row is deleted, and the prune removes the oldest.
--
-- counts IS WRITTEN BESIDE result, NOT DERIVED FROM IT ON READ. Every list of jobs
-- carries each job's counts, and a count means something only to its kind (a
-- re-verify's is how many of its items differ, an apply's how many were written),
-- so the kind works them out once, when the job stores its result. And result is
-- the row's LAST column: a re-verify's is every field of up to five hundred works,
-- which spills into overflow pages, and SQLite reaches a column by walking the row
-- from its start, so a read of the columns before result never walks those pages.
CREATE TABLE jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,  -- never reused: in-memory maps, spools and links name a job by id
  -- NO REFERENCES users(id), on purpose. A foreign key is checked on INSERT as well
  -- as on delete, and the logbook writes an in-request job's row after its request
  -- has ended: by then the account can be gone, and one refused row would fail the
  -- whole batch it rides in. The trigger below does the delete half of the job.
  user_id INTEGER,                       -- NULL = admin-only (owner gone, carried from another generation, no account)
  username TEXT NOT NULL DEFAULT '',     -- snapshot at creation
  kind TEXT NOT NULL,                    -- validated in Go
  queued INTEGER NOT NULL DEFAULT 1,     -- 1 ran through the queue, 0 ran in its request
  subject TEXT NOT NULL DEFAULT '',      -- data, not prose: what was searched, the file name
  state TEXT NOT NULL,                   -- queued|running|succeeded|failed|stopped|interrupted (Go-validated)
  params TEXT NOT NULL DEFAULT '{}',     -- JSON; never a secret
  counts TEXT NOT NULL DEFAULT '{}',     -- JSON: the result's counts, as the job's kind counts them
  error TEXT NOT NULL DEFAULT '',
  total INTEGER NOT NULL DEFAULT 0,
  done INTEGER NOT NULL DEFAULT 0,
  stop_requested INTEGER NOT NULL DEFAULT 0,
  rerun_of INTEGER,
  from_job INTEGER,                      -- reverify-apply → the reverify it came from
  created_at INTEGER NOT NULL,           -- unix ms
  started_at INTEGER,
  finished_at INTEGER,
  result TEXT NOT NULL DEFAULT ''        -- JSON the job's own screen reads back; last, see above
);
-- The queue's claim (oldest queued), a reader's own list, and the prune's cutoff.
CREATE INDEX jobs_state ON jobs(state, id);
CREATE INDEX jobs_user ON jobs(user_id, id);
CREATE INDEX jobs_finished ON jobs(finished_at);

CREATE TABLE job_logs (
  id INTEGER PRIMARY KEY,
  job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  at INTEGER NOT NULL, level TEXT NOT NULL, line TEXT NOT NULL
);
CREATE INDEX job_logs_job ON job_logs(job_id, id);

CREATE TABLE system_logs (
  id INTEGER PRIMARY KEY,
  at INTEGER NOT NULL,
  level TEXT NOT NULL,                   -- error|warn|info|request|asset|trace (Go-validated)
  code TEXT NOT NULL DEFAULT '',         -- TIP-XXX-NNN when the line carries one
  line TEXT NOT NULL
);
CREATE INDEX system_logs_at ON system_logs(at);
CREATE INDEX system_logs_level_at ON system_logs(level, at);

-- Every path that deletes a user (the admin handler, `tippani user del`) leaves their
-- history to the admin rather than to whoever is given that id next (users.id is
-- reused: 0001 has no AUTOINCREMENT). A trigger rather than a line in each path,
-- because a third path added later would otherwise hand a stranger somebody's jobs
-- without anything failing.
CREATE TRIGGER jobs_owner_gone AFTER DELETE ON users BEGIN
  UPDATE jobs SET user_id = NULL WHERE user_id = OLD.id;
END;
