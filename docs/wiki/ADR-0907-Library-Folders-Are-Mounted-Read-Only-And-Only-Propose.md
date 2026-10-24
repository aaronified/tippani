# ADR-0907: Library folders are mounted read-only, and a scan only proposes

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

Three hundred books are not three hundred uploads. The administrator mounts the folders read-only and names them; a reader presses
**Scan** and is offered "this file for this work". Nothing attaches until accepted, and a refusal is remembered.

**Read-only is structural.** The `mount` package holds no call that writes (a test keeps it that way), refuses a path that resolves
outside its folder, reads only regular files and never runs on its own: no scan on boot, none on a timer. `:ro` is the
administrator's guarantee on top.

**A reader never sends a path.** A proposal carries an HMAC-signed token; a forged one attaches nothing, and tokens do not survive
a restart. A scan walks a bounded number of files per press and says where it stopped.

**Rejected.** A background watcher (a NAS pays for it forever); accepting a path from the client (a path traversal waiting to
happen). See [Library folders](Library-Folders.md).

See also: [ADR index](ADR-Index.md) · [Home](Home.md)
