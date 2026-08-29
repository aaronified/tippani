package main

import (
	"errors"
	"fmt"
	"io/fs"
	"os"
)

// dataDirAdvice explains a failure to open the database when the cause is the
// data directory's ownership rather than anything SQLite did.
//
// THIS IS THE WORST FAILURE THE APP HAS, and it used to be reported by passing
// SQLite's "unable to open database file" straight through. It happens before
// the HTTP server exists, so there is no page, no TIP- code and no log beyond
// that one line — the container simply exits 1 and the restart policy loops it
// forever. And the cause is almost always the same one: a Docker BIND mount
// whose host directory did not exist, so Docker created it as root, while the
// image runs as uid 65532. The fix is one chown, and nothing on screen said so.
//
// Returns "" when ownership is not the problem, so a genuinely corrupt or
// locked database is not explained away with a wrong answer.
func dataDirAdvice(dir string) string {
	f, err := os.CreateTemp(dir, ".probe-*")
	if err == nil {
		name := f.Name()
		f.Close()
		os.Remove(name)
		return "" // writable: whatever went wrong, it was not this
	}
	if !errors.Is(err, fs.ErrPermission) {
		return ""
	}
	me := os.Getuid()
	fi, serr := os.Stat(dir)
	if serr != nil {
		return fmt.Sprintf("%s cannot be read either (%v) — check the path and the mount", dir, serr)
	}
	owner, known := dirOwner(fi)
	return ownershipAdvice(dir, owner, known, me, os.Getgid(), fi.Mode())
}

// ownershipAdvice is the sentence itself, split out from the probe so it can be
// tested without a directory the running user cannot write to — which is a case
// root cannot construct, and CI is not always non-root.
func ownershipAdvice(dir string, owner int, known bool, me, mygid int, mode fs.FileMode) string {
	if !known || owner == me {
		return fmt.Sprintf("%s is not writable by the user tippani runs as (uid %d) — check its permissions (%s)", dir, me, mode)
	}
	return fmt.Sprintf(
		"%s is owned by uid %d, but tippani runs as uid %d and cannot write there. "+
			"If that is a Docker bind mount, Docker created the directory as root when it did not exist: "+
			"run `chown -R %d:%d %s` on the HOST (the path outside the container). "+
			"A named volume is chowned for you and needs none of this.",
		dir, owner, me, me, mygid, dir)
}
