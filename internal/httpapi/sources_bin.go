package httpapi

// An attached file and the bin.
//
// THE BIN COVERS EVERYTHING. A delete it can take back must take back the file a work's quotes
// came from and what was read from it, or Undo would return the work and its quotes and quietly
// lose the rest: a 25 MB upload and every stored context. The rows travel in the snapshot
// (collectWork, accountTables); the bytes are PARKED here, under Sources/.trash, and a bin entry
// names them in its file list with a prefix so the covers' park, restore, purge and sweep each
// find them without a second mechanism. A mounted source has no bytes of ours, so it travels as
// its row alone and nothing under a mount is ever moved.

import (
	"errors"
	"os"
	"path/filepath"
	"strings"

	"tippani/internal/olog"
)

// sourceFilePrefix tags a source file's name in a bin entry's file list, so it cannot be
// mistaken for a cover (whose names the cover regex matches and these never do).
const sourceFilePrefix = "src:"

func (s *Server) sourceTrashDir() string { return filepath.Join(s.sourcesDir(), ".trash") }

func taggedSources(names []string) []string {
	out := make([]string, 0, len(names))
	for _, n := range names {
		out = append(out, sourceFilePrefix+n)
	}
	return out
}

// untagged returns the source names in a file list, validated: only a name this package wrote.
func untagged(list []string) []string {
	var out []string
	for _, n := range list {
		if strings.HasPrefix(n, sourceFilePrefix) {
			if name := strings.TrimPrefix(n, sourceFilePrefix); sourceFile.MatchString(name) {
				out = append(out, name)
			}
		}
	}
	return out
}

// parkSourceFiles moves uploaded source files into the bin's corner, after the transaction
// that binned them has committed. It fails towards keeping the file, as parkFiles does.
func (s *Server) parkSourceFiles(names []string) {
	if len(names) == 0 {
		return
	}
	if err := os.MkdirAll(s.sourceTrashDir(), 0o700); err != nil {
		olog.Warnf(olog.CodeTrashFile, "[trash] park sources: cannot create %s: %v", s.sourceTrashDir(), err)
		return
	}
	for _, n := range names {
		if !sourceFile.MatchString(n) {
			continue
		}
		if err := os.Rename(filepath.Join(s.sourcesDir(), n), filepath.Join(s.sourceTrashDir(), n)); err != nil && !errors.Is(err, os.ErrNotExist) {
			olog.Warnf(olog.CodeTrashFile, "[trash] park source %s: %v", n, err)
		}
	}
}

// unparkSourceFiles puts parked source files back on a restore.
func (s *Server) unparkSourceFiles(list []string) {
	for _, n := range untagged(list) {
		if err := os.Rename(filepath.Join(s.sourceTrashDir(), n), filepath.Join(s.sourcesDir(), n)); err != nil && !errors.Is(err, os.ErrNotExist) {
			olog.Warnf(olog.CodeTrashFile, "[trash] unpark source %s: %v", n, err)
		}
	}
}

// removeParkedSources deletes parked source files for good: the purge, never a delete.
func (s *Server) removeParkedSources(list []string) {
	for _, n := range untagged(list) {
		_ = os.Remove(filepath.Join(s.sourceTrashDir(), n))
	}
}

// sweepOrphanParkedSources deletes parked source files no bin entry names, on the same rule
// as the covers' sweep (referenced holds every name some entry lists, tagged as stored).
func (s *Server) sweepOrphanParkedSources(referenced map[string]bool) {
	entries, err := os.ReadDir(s.sourceTrashDir())
	if err != nil {
		return
	}
	for _, e := range entries {
		if e.IsDir() || referenced[sourceFilePrefix+e.Name()] {
			continue
		}
		_ = os.Remove(filepath.Join(s.sourceTrashDir(), e.Name()))
	}
}
