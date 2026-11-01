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
//   - STREAMED. A walk hands each file to a callback and keeps none. It holds one
//     directory's entries at most, so memory does not grow with the library. The callback
//     can end the walk (a Stop). The caller keeps the checkpoint (ADR-0917-A).
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

// OpenReader opens a regular file under the root for reading and returns it with its size, for a
// caller that needs random access without loading the whole file: an EPUB's package document
// is a few kilobytes at the end of a zip that may be tens of megabytes. The caller closes it.
// Still os.Open, so still read-only.
func (r *Root) OpenReader(rel string) (*os.File, int64, error) {
	real, err := r.resolve(rel)
	if err != nil {
		return nil, 0, err
	}
	f, err := os.Open(real) // O_RDONLY
	if err != nil {
		return nil, 0, err
	}
	st, err := f.Stat()
	if err != nil {
		f.Close()
		return nil, 0, err
	}
	return f, st.Size(), nil
}

// Exists reports whether rel is still a readable regular file under the root, without
// reading it: the "is the file where it was" question.
func (r *Root) Exists(rel string) bool {
	_, err := r.resolve(rel)
	return err == nil
}

// Found is one file a walk reported.
type Found struct {
	Rel     string // slash-separated, relative to the root
	Size    int64
	ModTime int64 // unix milliseconds; with Size, shows whether the file changed
}

// WalkResult says what a walk did, including what it refused.
type WalkResult struct {
	// Stopped is true when the callback ended the walk before the end of the tree.
	Stopped bool
	// Skipped counts what was seen and not reported, by reason.
	Skipped struct {
		Irregular  int // devices, FIFOs, sockets
		Outside    int // symlinks that resolve outside the root
		Unreadable int
	}
}

// Walk reports regular files under the root whose lower-case extension is in exts, one at a
// time to visit, in lexical order of their full paths, starting after cursor (a relative
// path from an earlier walk; "" for the start). visit returns false to end the walk. The
// file it was given is then not handled, so a caller that saves the last file it finished
// resumes at that one.
//
// A symlink is never followed out of the root. Inside the root it is followed only as a
// file; a link to a directory is not entered, which also prevents loops.
func (r *Root) Walk(cursor string, exts map[string]bool, visit func(Found) bool) WalkResult {
	var res WalkResult

	var walk func(dirAbs, dirRel string)
	walk = func(dirAbs, dirRel string) {
		if res.Stopped {
			return
		}
		ents, err := os.ReadDir(dirAbs)
		if err != nil {
			res.Skipped.Unreadable++
			return
		}
		// Order by full path, which is what a cursor compares. A directory is keyed with a
		// trailing slash, so `a.srt` sorts before the directory `a/`. Sorting by bare name
		// would walk `a/` first and skip `a.srt` on resume.
		key := func(e fs.DirEntry) string {
			if e.IsDir() {
				return e.Name() + "/"
			}
			return e.Name()
		}
		sort.Slice(ents, func(i, j int) bool { return key(ents[i]) < key(ents[j]) })
		for _, e := range ents {
			if res.Stopped {
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
				if cursor != "" && cursor > rel+"/" && !strings.HasPrefix(cursor, rel+"/") {
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
			if !visit(Found{Rel: rel, Size: st.Size(), ModTime: st.ModTime().UnixMilli()}) {
				res.Stopped = true
			}
		}
	}
	walk(r.path, "")
	return res
}

// Entry is one name in a folder listing.
type Entry struct {
	Name string
	Rel  string // slash-separated, relative to the root
	Dir  bool
	Size int64
}

// List reports one folder under the root for a person choosing a file by hand: its sub-folders
// and the regular files whose lower-case extension is in exts, folders first, each group in
// name order. rel is "" for the root. The same guards as a walk apply: the folder is resolved
// and must still be under the root, and a symlink is listed only when it resolves inside the
// root, a link to a folder is shown as nothing (a walk never enters one either).
func (r *Root) List(rel string, exts map[string]bool) ([]Entry, error) {
	dir := r.path
	if rel != "" {
		if filepath.IsAbs(rel) || filepath.VolumeName(rel) != "" {
			return nil, ErrOutside
		}
		real, err := filepath.EvalSymlinks(filepath.Join(r.path, filepath.FromSlash(rel)))
		if err != nil {
			return nil, err
		}
		if !r.within(real) {
			return nil, ErrOutside
		}
		dir = real
	}
	st, err := os.Stat(dir)
	if err != nil {
		return nil, err
	}
	if !st.IsDir() {
		return nil, errors.New("mount: not a folder")
	}
	ents, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}
	var dirs, files []Entry
	for _, e := range ents {
		abs := filepath.Join(dir, e.Name())
		erel := e.Name()
		if rel != "" {
			erel = strings.TrimSuffix(rel, "/") + "/" + e.Name()
		}
		typ := e.Type()
		if typ&fs.ModeSymlink != 0 {
			real, err := filepath.EvalSymlinks(abs)
			if err != nil || !r.within(real) {
				continue
			}
			sst, err := os.Stat(real)
			if err != nil || sst.IsDir() {
				continue
			}
			typ = sst.Mode().Type()
		}
		switch {
		case typ.IsDir():
			dirs = append(dirs, Entry{Name: e.Name(), Rel: erel, Dir: true})
		case typ.IsRegular() && exts[strings.ToLower(filepath.Ext(e.Name()))]:
			fst, err := os.Stat(abs)
			if err != nil {
				continue
			}
			files = append(files, Entry{Name: e.Name(), Rel: erel, Size: fst.Size()})
		}
	}
	byName := func(l []Entry) {
		sort.Slice(l, func(i, j int) bool { return strings.ToLower(l[i].Name) < strings.ToLower(l[j].Name) })
	}
	byName(dirs)
	byName(files)
	return append(dirs, files...), nil
}
