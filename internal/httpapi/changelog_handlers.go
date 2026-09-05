package httpapi

import (
	"net/http"
	"time"

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

// releaseDate is the day the embedded history gives for one version, or "" when
// it does not know one.
//
// WHAT IT IS FOR. The Updates card said which build you are running and nothing
// about how old it is, and "how old is this" is the question somebody opens that
// card to answer. The history is already in the binary, so the answer costs no
// network and is the same offline, after a restore from somebody else's backup,
// and after a downgrade — because it is a fact about the BUILD rather than about
// this machine's history. Nothing is stored, so there is nothing for any of those
// to make confidently wrong.
//
// THE SAME EXACT-MATCH RULE `listed` USES, and for its reason: a build that is not
// a finished release — "dev", "3.0.0-edge.v3.a66ff6c", a release candidate —
// matches no heading and gets no date rather than the nearest one.
//
// THE SHAPE CHECK IS THIS LAYER'S, NOT THE CHANGELOG PACKAGE'S. `Release.Date` is
// verbatim on purpose — the file is the only thing that knows its own format —
// but a field a client is going to FORMAT needs a shape the client can parse. So
// a heading that lost its date, or wrote it another way, reads here as "no date"
// rather than as a string the card would print raw or render as NaN. The field's
// contract is exactly `"YYYY-MM-DD"` or `""`, and the card has one branch.
//
// TAKES ITS RELEASES AS AN ARGUMENT so it is testable without the embed.
func releaseDate(rs []changelog.Release, version string) string {
	for _, r := range rs {
		if r.Version != version {
			continue
		}
		if _, err := time.Parse("2006-01-02", r.Date); err != nil {
			return ""
		}
		return r.Date
	}
	return ""
}

// ReleaseDateOf is releaseDate against the history built into this binary — the
// one caller outside this file is /auth/me, which sends it to the Updates card.
func ReleaseDateOf(version string) string {
	return releaseDate(changelog.Releases(), version)
}
