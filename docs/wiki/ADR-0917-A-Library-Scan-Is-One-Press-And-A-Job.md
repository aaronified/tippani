# ADR-0917: A library scan is one press and a job

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted
- **Refines:** [ADR-0907](ADR-0907-Library-Folders-Are-Mounted-Read-Only-And-Only-Propose.md)

**What ADR-0907 decided.** A reader presses **Scan** and is offered "this file for this work". The walk ran inside the request and
was bounded: at most 400 files and 8 seconds, then it answered `truncated` with a cursor and the screen showed **Continue**.

**Why that was wrong.** A real library (hundreds of books, thousands of subtitle files on spinning disks) took many presses. The
reader had to sit at the screen and keep pressing. The bound was chosen to keep the work in a request small. That was a reason about
the server, and the cost fell on the reader.

**What replaced it.** One press queues a job of kind `library.scan` on the app's own queue, one per reader and folder at a time.
The job walks the whole folder with no cap and needs no second press.

- It saves its state in SQLite (migration 0087) as it goes: a checkpoint, the findings, and the files already seen.
- A Stop, a crash or a restart resumes from the checkpoint. Pressing Scan again continues the unfinished scan.
- Findings are written in batches of 50 files. The reader can review them in Checks while the scan runs, and after a restart.
  An accepted or refused finding leaves the table.
- A later scan reads only new or changed files (size and modification time). An EPUB's identity is stored, so unchanged files are
  matched again against a larger library without being opened. A scan of an unchanged folder takes seconds.
- Memory and disk stay flat: the walk is streamed, one batch is held at a time, each EPUB is read and closed before the next, a
  short pause follows each EPUB read, and the Go runtime is asked to return memory after each batch that read one.
- The scan runs in slices of 60 seconds. At the end of a slice it commits the checkpoint, queues the next slice (same user, same
  folder) and finishes. The next slice goes to the back of the queue, so imports, backups and other jobs queued meanwhile run
  first. The reader still presses Scan once. The screen reads progress from `library_scans`, so it shows one continuous scan.
  Between slices the scan reads as waiting, not stopped.
- Stop ends the whole chain: no further slice is queued, the checkpoint stays, and pressing Scan resumes. After a restart, a
  slice that was interrupted or waiting is marked interrupted like any job, and pressing Scan resumes. Nothing continues by itself,
  because that would need a boot-time scan.
- A continuation is not counted against the reader's limit of 5 jobs or the duplicate check (`Job.Continue`), and a new press
  while a slice is queued or running shows that slice. A chain never holds more than one queued or running slice per folder.
  Every slice has the same params (the folder id), so the queue's duplicate check, which runs inside the insert's write
  transaction, keeps this rule. There is no mutex around the press (3.4.2: a mutex held across the insert made every press wait
  behind one that was waiting for the database). A press that cannot queue the job within 10 seconds answers 503
  (`TIP-JOBS-004`), and a failed or interrupted last slice shows on the folder's scan status with its error.
- Progress, Stop and the jobs card come from the existing job system. There is no new UI machinery. Each slice is its own row in
  the job list.

**What is kept.** The scan only proposes. Nothing under a mount is written (a test still checks the `mount` package). A path that
resolves outside the folder is refused, only regular files are read, and a reader never sends a path. Tokens are signed when
findings are read, from the stored relative path, and do not survive a restart. Findings and seen files are per user. Only the
administrator configures folders. A scan starts only when a reader presses Scan: no scan on boot or on a timer.

**Cost.** The job list shows one row per slice. A reader with more folders than the per-user job limit (5) cannot start them all at
once.

**Rejected as a first version.** Running the whole scan as one job. The queue runs one job at a time for the whole server, so a
long first scan held back imports and backups until it ended.

**Rejected.** Keeping the cap and raising it (still a bound the reader has to press past). Holding all findings in memory until the
end (a crash or a restart would lose them, and the reader could not review early). A separate job system for scans.

See [Library folders](Library-Folders.md).

See also: [ADR index](ADR-Index.md) · [Home](Home.md)
