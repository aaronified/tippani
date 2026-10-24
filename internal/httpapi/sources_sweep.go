package httpapi

// The orphans that got away: stored source files no row names, and rows whose file is gone.
//
// A source's file is written BEFORE its row changes and removed AFTER, so a crash between the two
// leaves a file nobody names; a data directory restored without Sources/ leaves rows nobody can
// read. Neither breaks anything (context is stored as rows, so a quote opens its surroundings
// either way) but both are untidy, and a 25 MB upload nobody names is the same bug a forgotten
// cover is with a hundred times the bill.
//
// REPORT FIRST, THEN SWEEP, and the sweep removes FILES ONLY. A row with no file is not deleted:
// it is the only record that the work ever had a source, the stored context still opens, and
// "re-add the file" is a sentence the reader can act on. A file with no row is removed.
//
// A FILE YOUNGER THAN A GRACE PERIOD IS LEFT ALONE, because an upload writes its bytes before it
// writes its row, and a sweep that ran in between would delete the file of an upload still in
// flight. Nothing runs on a timer: this is the administrator pressing a button.
//
// Files parked in the bin (Sources/.trash) are not orphans: an entry names them, and the bin's
// own sweep owns them (sweepOrphanParkedSources). Covers deserve the same sweep and are a fix to
// ship beside this one, not inside it: a cover is referenced from a dozen columns.

import (
	"net/http"
	"os"
	"path/filepath"
	"time"
)

// sourceGrace is how old a file must be before it can be called an orphan.
const sourceGrace = 10 * time.Minute

type sourceOrphans struct {
	// Files are names under Sources/ that no row names and that are older than the grace.
	Files []string
	Bytes int64
	// Missing counts uploaded rows whose file is not on disk.
	Missing int
}

func (s *Server) findSourceOrphans() (sourceOrphans, error) {
	var out sourceOrphans
	named := map[string]bool{}
	rows, err := s.Store.DB.Query(`SELECT path FROM work_sources WHERE origin = 'upload' AND path != ''`)
	if err != nil {
		return out, err
	}
	for rows.Next() {
		var p string
		if rows.Scan(&p) == nil {
			named[p] = true
		}
	}
	rows.Close()

	ents, err := os.ReadDir(s.sourcesDir())
	if err != nil && !os.IsNotExist(err) {
		return out, err
	}
	present := map[string]bool{}
	for _, e := range ents {
		if e.IsDir() || !sourceFile.MatchString(e.Name()) {
			continue
		}
		present[e.Name()] = true
		if named[e.Name()] {
			continue
		}
		info, err := e.Info()
		if err != nil || time.Since(info.ModTime()) < sourceGrace {
			continue
		}
		out.Files = append(out.Files, e.Name())
		out.Bytes += info.Size()
	}
	for p := range named {
		if !present[p] {
			out.Missing++
		}
	}
	return out, nil
}

// handleSourceOrphans: GET /admin/maintenance/sources — what a sweep would remove, and what is
// missing, without touching anything.
func (s *Server) handleSourceOrphans(w http.ResponseWriter, r *http.Request) {
	o, err := s.findSourceOrphans()
	if err != nil {
		internalError(w, r, "find orphaned source files", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"orphan_files": len(o.Files), "orphan_bytes": o.Bytes, "missing_files": o.Missing})
}

// handleSweepSources: POST /admin/maintenance/sources/sweep — removes the files no row names.
func (s *Server) handleSweepSources(w http.ResponseWriter, r *http.Request) {
	o, err := s.findSourceOrphans()
	if err != nil {
		internalError(w, r, "sweep orphaned source files", err)
		return
	}
	removed := 0
	for _, n := range o.Files {
		if err := os.Remove(filepath.Join(s.sourcesDir(), n)); err == nil {
			removed++
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"removed": removed, "bytes": o.Bytes, "missing_files": o.Missing})
}
