package httpapi

import (
	"net/http"

	"tippani/internal/buildinfo"
	"tippani/internal/changelog"
)

// The release history, out of the binary rather than off the internet.
//
// The card this hangs off already links to GitHub's releases page, and that link
// stays — it is the right answer for "what is in a version I have not installed".
// This is the other question: what is in the one I am running. It is answerable
// with no network at all, and on the hardware this app is built for (a NAS on a
// LAN, behind Tailscale, sometimes genuinely offline) that is the difference
// between a dialog and an empty dialog.
//
// NOT BEHIND requireAdmin, though the button that opens it is on an admin-only
// card. Release history is not privileged information — it is published on the
// internet — and gating the endpoint would mean a second user on the same
// instance could not be shown what changed even if a future screen wanted to.
// The entry point is admin-only because the Updates card is; the data is not.
func (s *Server) handleChangelog(w http.ResponseWriter, r *http.Request) {
	releases := changelog.Releases()
	writeJSON(w, http.StatusOK, map[string]any{
		// The version the CLIENT is talking to, so the dialog can mark which entry
		// is the build in front of them. Sent rather than inferred: the frontend
		// already knows its own version from /auth/me, but the two could disagree
		// during an update and the honest answer is the server's.
		"current":  buildinfo.Version,
		"releases": releases,
		// Whether the running build is one the embedded history knows about. It is
		// false for a dev build ("dev" is never a heading), and that is worth
		// saying out loud rather than silently marking nothing.
		"current_listed": listed(releases, buildinfo.Version),
	})
}

func listed(rs []changelog.Release, version string) bool {
	for _, r := range rs {
		if r.Version == version {
			return true
		}
	}
	return false
}
