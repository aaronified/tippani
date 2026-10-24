// Package mount reads files from a folder the operator mounted into the box, and
// never anything else.
//
// A mount is the FIRST path in this codebase that a person chose: every other path is
// derived from the data directory or is internal. So this package is the guards before
// it is the feature (docs/plans/work-source-files.md, "The security surface"):
//
//   - READ-ONLY TWICE. The operator's `:ro` is their guarantee; this is the app's. The
//     package has no function that writes, renames, moves, creates or deletes, and a
//     test reads its own source to keep it that way. Every open is O_RDONLY, through
//     os.Open.
//   - CONTAINED. The root is resolved once. Every candidate path is resolved again with
//     EvalSymlinks and must still be under the root, so a symlink pointing out of the
//     mount is refused and not followed.
//   - REGULAR FILES ONLY. A device, a FIFO or a socket is skipped and counted, never
//     opened: opening a FIFO blocks, and a device can be anything.
//   - NO PATH FROM THE CLIENT. Callers hand this package paths RELATIVE to a root that
//     the server derived or verified itself; the walk reports what it found and the
//     reader chooses from that.
//   - BOUNDED. A walk stops at a file cap or a wall-clock budget and says so, with a
//     cursor to resume from, so a large library is a few presses and a silent
//     truncation can never read as a clean library.
//
// Nothing here starts a goroutine, and nothing here wakes on a timer.
package mount

import (
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

// ErrOutside is a path that resolves outside the root, usually by a symlink.
var ErrOutside = errors.New("mount: path resolves outside the mount")

// ErrNotRegular is a path that is not a regular file (a device, FIFO, socket or directory).
var ErrNotRegular = errors.New("mount: not a regular file")

// Root is one resolved mount.
type Root struct {
	path string // absolute, symlinks resolved
}

// Open resolves a configured mount root once. The path must exist and be a directory.
func Open(path string) (*Root, error) {
	if strings.TrimSpace(path) == "" {
		return nil, errors.New("mount: no path")
	}
	abs, err := filepath.Abs(path)
	if err != nil {
		return nil, err
	}
	real, err := filepath.EvalSymlinks(abs)
	if err != nil {
		return nil, fmt.Errorf("mount: %w", err)
	}
	st, err := os.Stat(real)
	if err != nil {
		return nil, fmt.Errorf("mount: %w", err)
	}
	if !st.IsDir() {
		return nil, errors.New("mount: the path is not a folder")
	}
	return &Root{path: real}, nil
}

// Path is the resolved root, for messages.
func (r *Root) Path() string { return r.path }

// within reports whether p (already resolved) is the root or beneath it.
func (r *Root) within(p string) bool {
	rel, err := filepath.Rel(r.path, p)
	if err != nil {
		return false
	}
	return rel == "." || (rel != ".." && !strings.HasPrefix(rel, ".."+string(filepath.Separator)))
}

// resolve turns a relative path into a verified absolute one: joined, symlinks
// resolved, still inside the root, and a regular file.
func (r *Root) resolve(rel string) (string, error) {
	if rel == "" || filepath.IsAbs(rel) || filepath.VolumeName(rel) != "" {
		return "", ErrOutside
	}
	joined := filepath.Join(r.path, filepath.FromSlash(rel))
	real, err := filepath.EvalSymlinks(joined)
	if err != nil {
		return "", err
	}
	if !r.within(real) {
		return "", ErrOutside
	}
	st, err := os.Stat(real)
	if err != nil {
		return "", err
	}
	if !st.Mode().IsRegular() {
		return "", ErrNotRegular
	}
	return real, nil
}

// ReadFile reads a file under the root, at most max bytes (an error beyond that, so a
// huge file is refused rather than truncated into something that parses wrongly).
func (r *Root) ReadFile(rel string, max int64) ([]byte, error) {
	real, err := r.resolve(rel)
	if err != nil {
		return nil, err
	}
	f, err := os.Open(real) // O_RDONLY
	if err != nil {
		return nil, err
	}
	defer f.Close()
	b, err := io.ReadAll(io.LimitReader(f, max+1))
	if err != nil {
		return nil, err
	}
	if int64(len(b)) > max {
		return nil, fmt.Errorf("mount: the file is over the %d byte limit", max)
	}
	return b, nil
}

// Exists reports whether rel is still a readable regular file under the root, without
// reading it: the "is the file where it was" question.
func (r *Root) Exists(rel string) bool {
	_, err := r.resolve(rel)
	return err == nil
}

// Found is one file a walk reported.
type Found struct {
	Rel  string // slash-separated, relative to the root
	Size int64
}

// WalkResult says what a walk did, including what it refused.
type WalkResult struct {
	Files []Found
	// Truncated is true when the walk stopped at its cap or budget; Cursor is then the
	// path it stopped at, and Walk resumed from it covers the rest exactly once.
	Truncated bool
	Cursor    string
	// Skipped counts what was seen and not reported, by reason.
	Skipped struct {
		Irregular  int // devices, FIFOs, sockets
		Outside    int // symlinks that resolve outside the root
		Unreadable int
	}
}

// Walk lists regular files under the root whose lower-case extension is in exts, in a
// stable lexical order, starting after cursor. It stops after maxFiles reported files
// or when budget has elapsed, whichever comes first.
//
// A SYMLINK IS NEVER FOLLOWED OUT OF THE ROOT, and is followed within it only as a
// file: a link to a directory is not descended into, which is also what stops a loop.
func (r *Root) Walk(cursor string, exts map[string]bool, maxFiles int, budget time.Duration) WalkResult {
	var res WalkResult
	deadline := time.Now().Add(budget)
	stopped := false

	var walk func(dirAbs, dirRel string)
	walk = func(dirAbs, dirRel string) {
		if stopped {
			return
		}
		ents, err := os.ReadDir(dirAbs)
		if err != nil {
			res.Skipped.Unreadable++
			return
		}
		sort.Slice(ents, func(i, j int) bool { return ents[i].Name() < ents[j].Name() })
		for _, e := range ents {
			if stopped {
				return
			}
			rel := e.Name()
			if dirRel != "" {
				rel = dirRel + "/" + e.Name()
			}
			abs := filepath.Join(dirAbs, e.Name())
			typ := e.Type()
			if typ&fs.ModeSymlink != 0 {
				real, err := filepath.EvalSymlinks(abs)
				if err != nil || !r.within(real) {
					res.Skipped.Outside++
					continue
				}
				st, err := os.Stat(real)
				if err != nil {
					res.Skipped.Unreadable++
					continue
				}
				if st.IsDir() {
					continue // never descended: a loop, or a way out
				}
				typ = st.Mode().Type()
			}
			if typ.IsDir() {
				// A directory wholly before the cursor has been done.
				if cursor != "" && cursor > rel && !strings.HasPrefix(cursor, rel+"/") {
					continue
				}
				walk(abs, rel)
				continue
			}
			if !typ.IsRegular() {
				res.Skipped.Irregular++
				continue
			}
			if cursor != "" && rel <= cursor {
				continue
			}
			if !exts[strings.ToLower(filepath.Ext(e.Name()))] {
				continue
			}
			st, err := os.Stat(abs)
			if err != nil {
				res.Skipped.Unreadable++
				continue
			}
			res.Files = append(res.Files, Found{Rel: rel, Size: st.Size()})
			if len(res.Files) >= maxFiles || time.Now().After(deadline) {
				res.Truncated, res.Cursor = true, rel
				stopped = true
			}
		}
	}
	walk(r.path, "")
	return res
}
