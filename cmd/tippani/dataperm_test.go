package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// A writable directory produces NO advice — the point of returning "" is that
// a corrupt or locked database is never explained away as a permissions
// problem, which would send somebody chowning a directory that was fine.
func TestDataDirAdviceIsSilentWhenTheDirectoryIsWritable(t *testing.T) {
	if got := dataDirAdvice(t.TempDir()); got != "" {
		t.Fatalf("advice on a writable dir: %q", got)
	}
}

// The failure this exists for: the directory is owned by somebody else, and the
// message has to carry the path, both uids, and the command to type. Tested on
// the sentence rather than through the probe, because root can write into a
// 0500 directory and so cannot construct the case at all — and root is exactly
// what this environment and some CI runners are.
func TestOwnershipAdviceNamesTheOwnerAndTheFix(t *testing.T) {
	got := ownershipAdvice("/data", 0, true, 65532, 65532, 0o755)
	for _, want := range []string{"/data", "uid 0", "uid 65532", "chown -R 65532:65532 /data", "HOST"} {
		if !strings.Contains(got, want) {
			t.Errorf("advice is missing %q:\n%s", want, got)
		}
	}

	// Same owner, wrong mode: a chown would do nothing, so it must not be the
	// advice. This is the mode bits' fault and the sentence has to say so.
	got = ownershipAdvice("/data", 65532, true, 65532, 65532, 0o500)
	if strings.Contains(got, "chown") {
		t.Errorf("chown advice for a directory the user already owns:\n%s", got)
	}
	if !strings.Contains(got, "permissions") {
		t.Errorf("advice does not point at the mode:\n%s", got)
	}

	// A platform with no uid to report falls back to the same mode sentence
	// rather than printing "uid 0" from a zero value.
	if got := ownershipAdvice("C:/data", 0, false, 0, 0, 0o500); strings.Contains(got, "chown") {
		t.Errorf("chown advice where there is no owner to name:\n%s", got)
	}
}

// And the probe still has to be the thing that decides there is a problem: a
// writable directory owned by somebody else is fine and gets nothing.
func TestDataDirAdviceProbesRatherThanGuessingFromOwnership(t *testing.T) {
	dir := t.TempDir()
	if err := os.Chmod(dir, 0o777); err != nil {
		t.Fatal(err)
	}
	if got := dataDirAdvice(dir); got != "" {
		t.Fatalf("advice for a writable dir: %q", got)
	}
}

// A path that is not there at all is a different fault and gets a different
// sentence — telling somebody to chown a directory that does not exist is the
// kind of confident wrong answer this whole helper is meant to avoid.
func TestDataDirAdviceOnAMissingPath(t *testing.T) {
	got := dataDirAdvice(filepath.Join(t.TempDir(), "nope"))
	if strings.Contains(got, "chown") {
		t.Errorf("chown advice for a missing directory: %q", got)
	}
}
