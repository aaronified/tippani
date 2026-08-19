package httpapi

// What the client cannot see for itself: the contents of data/Locales.
//
// The two languages that ship in the box are compiled into the SPA bundle as
// well as into the binary (they are the same bytes — internal/i18n holds them and
// web/frontend/src/i18n.js imports them), so the client already has en and bn
// before it has a connection. What it cannot have is a file an OPERATOR dropped
// in, which is the whole of design §4 and §5: fr.txt appears with no rebuild, and
// a key in data/Locales/en.txt overrides the compiled-in line.
//
// So this route serves the OVERRIDES ONLY. On an instance where nobody has added
// a language it answers `{"builtin":["en","bn"],"files":{}}` — a few dozen bytes
// — and the interface is already complete without it. That is the shape design §3
// asks for stated as a payload: the config directory is an addition, never a
// dependency.
//
// IT IS PUBLIC, AND THAT IS THE ONE DECISION THIS ROUTE FORCES.
//
// The login screen and the first-run onboarding screen both render before any
// session exists. Behind requireAuth, those two screens would be the only ones in
// the app stuck in whichever language happens to be compiled in — including for
// the reader whose whole reason for choosing a language was that they do not read
// the other one. A locale payload is UI copy: button words, help prose, the names
// of the app's own screens. It is the same class of thing as GET /capabilities,
// which is public for the same reason (a client needs it before it holds a
// credential).
//
// What it does reveal to an unauthenticated caller is which language files the
// operator has added, and their contents. That is copy, not library data, and
// nothing here reads the database. The bound worth having is on SIZE rather than
// on access, and internal/i18n owns it: one file over 512 KiB is skipped and at
// most 64 are read, because the directory's contents are somebody else's decision
// and an unauthenticated route should not be able to be made expensive by editing
// a folder.

import (
	"net/http"

	"tippani/internal/i18n"
)

// handleLocales lists the compiled-in languages and serves every parsed file in
// data/Locales.
//
// A MANGLED LINE IS REPORTED RATHER THAN HIDDEN. Each file carries the 1-based
// line numbers that had no `=` (design §5 — one bad line costs one string), so a
// translator can be told which line to look at instead of hunting for a string
// that silently never appears. Nothing on screen uses it yet; it is in the
// payload because the parser already knows and throwing it away here would mean
// re-reading the file to ask.
func (s *Server) handleLocales(w http.ResponseWriter, r *http.Request) {
	files := s.locales.Files(s.DataDir)
	if files == nil {
		// `{}` rather than `null`: every client then has one shape to read, and no
		// "no languages added" special case.
		files = map[string]i18n.File{}
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"builtin": i18n.Builtins,
		"files":   files,
	})
}
