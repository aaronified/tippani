package httpapi

// In-app updates (Settings → Updates, admin). Two endpoints:
//
//   GET  /admin/update/check — compare the running version against the latest
//        GitHub release; report whether a one-click update is possible (i.e.
//        the Docker socket is reachable).
//   POST /admin/update/apply — pull the new image and run a one-shot Watchtower
//        that recreates this container. Requires {"confirm":"UPDATE"} and the
//        Docker socket; without the socket it returns the guided command so the
//        operator can update by hand.
//
// The check is strictly on demand — Tippani never contacts GitHub on its own.
// The apply is an opt-in, privileged operation: it only works when the operator
// has mounted the Docker socket (and granted the non-root user access), which
// is documented as a deliberate security trade-off.

import (
	"context"
	"net/http"
	"time"

	"tippani/internal/buildinfo"
	"tippani/internal/olog"
	"tippani/internal/updater"
)

// UpdateDocker is the slice of the Docker Engine API a self-update needs;
// *updater.Docker implements it, and tests inject a fake via Server.newDocker.
type UpdateDocker interface {
	Available(ctx context.Context) bool
	Self(ctx context.Context) (id, name, image string, err error)
	Pull(ctx context.Context, ref string) error
	RunWatchtower(ctx context.Context, target string) error
}

const guidedUpdateCommand = "docker compose up -d --pull always --force-recreate"

// handleUpdateCheck reports the running version, the latest release, whether an
// update is available, and whether a one-click update is possible on this host.
// A GitHub failure (offline, rate-limited, no releases) is soft: it comes back
// as check_error with 200 so the card still shows the current version.
func (s *Server) handleUpdateCheck(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	socket := s.newDocker().Available(ctx)
	out := map[string]any{
		"current":         buildinfo.Version,
		"image":           buildinfo.Image(),
		"socket":          socket,
		"can_self_update": socket,
		"guided_command":  guidedUpdateCommand,
	}
	rel, err := updater.LatestRelease(ctx, s.GitHubAPI, buildinfo.Repo())
	if err != nil {
		olog.Printf("[update] check for user %d (%s): %v", userID(r), username(r), err)
		out["check_error"] = err.Error()
		out["update_available"] = false
	} else {
		out["latest"] = rel.TagName
		out["release_name"] = rel.Name
		out["notes_url"] = rel.HTMLURL
		out["published_at"] = rel.PublishedAt
		out["update_available"] = updater.UpdateAvailable(buildinfo.Version, rel.TagName)
	}
	writeJSON(w, http.StatusOK, out)
}

// handleUpdateApply pulls the newest image and recreates this container via a
// one-shot Watchtower. Guarded by {"confirm":"UPDATE"} + the Docker socket.
// After it returns, Watchtower stops and recreates the container, so the client
// should expect the connection to drop and the app to come back on the new
// version — it polls for that.
func (s *Server) handleUpdateApply(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Confirm string `json:"confirm"`
	}
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Confirm != "UPDATE" {
		writeErr(w, http.StatusBadRequest, `confirmation required: send {"confirm":"UPDATE"}`)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Minute)
	defer cancel()

	d := s.newDocker()
	if !d.Available(ctx) {
		// No socket → one-click isn't possible; hand back the manual command so
		// the operator can update by hand.
		olog.Printf("[update] apply requested by user %d (%s) but Docker socket is unavailable", userID(r), username(r))
		writeJSON(w, http.StatusConflict, map[string]any{
			"error":          "the Docker socket is not available — one-click update needs it mounted (see the README)",
			"guided_command": guidedUpdateCommand,
			"socket":         false,
		})
		return
	}
	_, name, image, err := d.Self(ctx)
	if err != nil {
		internalError(w, r, "update identify self", err)
		return
	}
	olog.Alertf("[update] APPLY requested by user %d (%s) — pulling %s and recreating container %q", userID(r), username(r), image, name)
	if err := d.Pull(ctx, image); err != nil {
		internalError(w, r, "update pull image", err)
		return
	}
	if err := d.RunWatchtower(ctx, name); err != nil {
		internalError(w, r, "update run recreater", err)
		return
	}
	olog.Alertf("[update] recreater launched for %q — the container will restart on the new image", name)
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":      true,
		"message": "Update started — Tippani is pulling the new image and will restart in a moment.",
	})
}
