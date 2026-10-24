package httpapi

// What a backup does about source files, and what a restore says it did not get.
//
// A new directory under DataDir is archived by the walk with no code change, so
// doing nothing CHOSES "include" — and an ebook per book roughly triples a small
// library's archive. The rule splits along the line the reader has already drawn:
//
//   - the rows (work_sources, and later the kept context) ride in the database
//     snapshot with no special handling, always. Kept context is tiny and is the
//     half that cannot be re-derived once a file is gone.
//   - the raw files follow a setting, default OFF. They are the bulky half and the
//     recoverable half (an ebook can be fetched again; a highlight cannot).
//   - a restore reports what the archive did not carry, by work, so a dead control
//     is never how the loss is discovered.

import (
	"net/http"
	"os"
	"path/filepath"

	"tippani/internal/olog"
)

// settingBackupSources is "1" when the archive should carry Sources/. The same
// "1"/"" boolean the other instance settings use.
const settingBackupSources = "backup_include_sources"

// sourcesDirName is the top-level entry the archive walk consults the setting
// for. It is NOT a control entry: a restore must still swap it, so a restored
// database is never left holding the files of the one it replaced.
const sourcesDirName = "Sources"

func (s *Server) backupIncludesSources() bool {
	v, err := s.Store.GetSetting(settingBackupSources)
	return err == nil && v == "1"
}

// handleGetBackupSources: GET /admin/backup/sources.
func (s *Server) handleGetBackupSources(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"include": s.backupIncludesSources()})
}

// handlePutBackupSources: PUT /admin/backup/sources {include}.
func (s *Server) handlePutBackupSources(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Include *bool `json:"include"`
	}
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Include == nil {
		writeErr(w, http.StatusBadRequest, "include must be true or false")
		return
	}
	v := ""
	if *req.Include {
		v = "1"
	}
	if err := s.Store.SetSetting(settingBackupSources, v); err != nil {
		internalError(w, r, "save backup sources setting", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"include": *req.Include})
}

// missingSource is one work whose stored file this data directory does not hold.
type missingSource struct {
	Subject string `json:"subject"`
	Title   string `json:"title"`
	Episode string `json:"episode,omitempty"`
	Name    string `json:"name"`
}

// maxMissingListed bounds the list a restore answer carries; the count is always
// the whole truth.
const maxMissingListed = 50

// missingSources lists works whose uploaded source has a row and no file. After a
// restore from an archive made without Sources/, that is every one of them.
func (s *Server) missingSources() (total int, listed []missingSource) {
	rows, err := s.Store.DB.Query(`
		SELECT ws.subject, ws.subject_key, ws.name, ws.path,
		       COALESCE(b.title, m.title, ws.subject_key, '')
		FROM work_sources ws
		LEFT JOIN books  b ON ws.subject = 'book'   AND b.id = ws.subject_id
		LEFT JOIN movies m ON ws.subject = 'screen' AND m.id = ws.subject_id
		WHERE ws.origin = 'upload' AND ws.path != '' AND ws.pruned_at = ''
		ORDER BY ws.id`)
	if err != nil {
		olog.Printf("[sources] could not list missing sources after restore: %v", err)
		return 0, nil
	}
	defer rows.Close()
	for rows.Next() {
		var m missingSource
		var key, path string
		if err := rows.Scan(&m.Subject, &key, &m.Name, &path, &m.Title); err != nil {
			continue
		}
		if !sourceFile.MatchString(path) {
			continue
		}
		if _, err := os.Stat(filepath.Join(s.sourcesDir(), path)); err == nil {
			continue
		}
		if m.Subject == sourceScreen {
			m.Episode = key
		}
		total++
		if len(listed) < maxMissingListed {
			listed = append(listed, m)
		}
	}
	return total, listed
}
