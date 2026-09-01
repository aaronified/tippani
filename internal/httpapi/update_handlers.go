package httpapi

// In-app updates (Settings → Updates, admin). Two endpoints:
//
//   GET  /admin/update/check — compare the running version against the latest
//        GitHub release; report whether a one-click update is possible (i.e.
//        the Docker Engine API is reachable).
//   POST /admin/update/apply — pull the new image and run a one-shot Watchtower
//        that recreates this container. Requires {"confirm":"UPDATE"} and a
//        reachable Engine API; otherwise it returns the guided command so the
//        operator can update by hand.
//   POST /admin/update/channel — {"channel":"stable"|"prerelease"}: which line
//        the check follows. Instance-wide, because the thing it changes is
//        which image the box is going to be running, and that is not a per-user
//        opinion.
//
// The check is strictly on demand — Tippani never contacts GitHub on its own.
// The apply is an opt-in, privileged operation: it only works when the operator
// has mounted the Docker socket (and granted the non-root user access) or has
// pointed TIPPANI_DOCKER_HOST at a docker-socket-proxy — both documented as a
// deliberate security trade-off (proxy included: it must allow container
// create/start, which is host-root-equivalent in the wrong hands).

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
	// Probe is Available with the reason attached — see updater.Docker.Probe.
	Probe(ctx context.Context) (bool, string)
	Self(ctx context.Context) (id, name, image string, err error)
	Pull(ctx context.Context, ref string) error
	RunWatchtower(ctx context.Context, target string) error
}

const guidedUpdateCommand = "docker compose up -d --pull always --force-recreate"

// settingUpdateChannel is "prerelease" to follow the run-ups, "stable" to skip
// them, and "" to let the running build decide (see updateChannel). Stored
// rather than an env var so the box can be moved onto the rc line from the
// page that shows the rc, without an operator editing compose and recreating
// the container to answer a question the app already asked.
const settingUpdateChannel = "update_channel"

// updateChannel resolves the stored preference. The default is not a constant:
// an image that is ITSELF a pre-release (3.0.0-edge.f7ddba5, the branch build)
// is already on that line, and defaulting it to stable would have the update
// card offer it the last stable release — a downgrade, which is exactly the
// wrong answer to "am I current?" and exactly what the branch tester saw. An
// explicit stored value always wins, in both directions.
func (s *Server) updateChannel() (channel string, pre bool, explicit bool) {
	v, _ := s.Store.GetSetting(settingUpdateChannel)
	switch v {
	case "prerelease":
		return "prerelease", true, true
	case "stable":
		return "stable", false, true
	}
	if updater.IsPrerelease(buildinfo.Version) {
		return "prerelease", true, false
	}
	return "stable", false, false
}

// handleUpdateCheck reports the running version, the latest release, whether an
// update is available, and whether a one-click update is possible on this host.
// A GitHub failure (offline, rate-limited, no releases) is soft: it comes back
// as check_error with 200 so the card still shows the current version.
func (s *Server) handleUpdateCheck(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	socket, why := s.newDocker().Probe(ctx)
	out := map[string]any{
		"current":         buildinfo.Version,
		"image":           buildinfo.Image(),
		"socket":          socket,
		"can_self_update": socket,
		"guided_command":  guidedUpdateCommand,
	}
	// WHY THERE IS NO BUTTON. Without this the card says one-click needs the
	// socket mounted and stops, which is the same sentence whether it was never
	// mounted, was mounted somewhere this user cannot read, or is being looked
	// for under a path with a ":ro" suffix left on it. Only ever the operator's
	// own configuration and the OS's own words — see updater.Docker.Probe.
	if !socket && why != "" {
		out["socket_error"] = why
	}
	channel, includePre, explicit := s.updateChannel()
	out["channel"] = channel
	out["channel_explicit"] = explicit

	rel, err := updater.LatestRelease(ctx, s.GitHubAPI, buildinfo.Repo(), includePre)
	if err != nil {
		olog.Printf("[update] check for user %d (%s): %v", userID(r), username(r), err)
		out["check_error"] = err.Error()
		out["update_available"] = false
	} else {
		out["latest"] = rel.TagName
		out["latest_prerelease"] = rel.Prerelease
		out["release_name"] = rel.Name
		out["notes_url"] = rel.HTMLURL
		out["published_at"] = rel.PublishedAt
		out["update_available"] = updater.UpdateAvailable(buildinfo.Version, rel.TagName)
	}

	// A BUILD THAT TRACKS A MOVING TAG HAS NO RELEASE TO COMPARE AGAINST, and
	// until this existed the pre-release channel answered "no update" to a box
	// running :v3 with three unpulled commits sitting in the image it points at.
	// That answer was correct and useless: a branch push builds an image and
	// creates no GitHub release, so the release list — everything the channel
	// could see — genuinely had nothing newer in it. The newest STABLE release
	// is older than a run-up to the next major, which is exactly the arithmetic
	// that stops it being offered as a downgrade.
	//
	// So for a branch build the question is the other one: has the branch this
	// image is rebuilt from moved? Compared by commit, because that is what the
	// version carries and what the tag will pull. A published release that
	// outranks the running version still wins — an rc, or 3.0.0 itself, is a
	// better answer than another commit on the branch it came from.
	if branch, running, isBranch := updater.BranchBuild(buildinfo.Version); isBranch {
		out["branch"] = branch
		out["commit"] = running
		// DECISIVE, not merely true. For an unorderable version — `edge.main.<sha>`,
		// which is what a build off the default branch is — UpdateAvailable
		// returns true for any release that exists at all, because it cannot
		// prove the build is current. That is the right default with nothing
		// else to go on, and it is the WRONG answer here: main is ahead of the
		// last release, so offering it is offering a downgrade. The release only
		// wins when the comparator can say so.
		beaten := false
		if rel != nil {
			if cmp, ok := updater.Compare(buildinfo.Version, rel.TagName); ok && cmp < 0 {
				beaten = true
			}
		}
		out["update_available"] = beaten
		if !beaten {
			head, herr := updater.BranchHead(ctx, s.GitHubAPI, buildinfo.Repo(), branch)
			switch {
			case herr != nil:
				// Soft, like the release check above: the card still shows the
				// version, and a branch that has been deleted (merged and tidied
				// away) is a 404 rather than a reason to fail the request.
				olog.Printf("[update] branch head for user %d (%s): %v", userID(r), username(r), herr)
			case head != running:
				out["latest"] = branch + " @ " + head
				out["latest_commit"] = head
				out["update_available"] = true
				out["notes_url"] = "https://github.com/" + buildinfo.Repo() + "/compare/" + running + "..." + head
			}
		}
	}
	writeJSON(w, http.StatusOK, out)
}

// handleUpdateChannel stores which release line the check follows. "" clears
// the preference back to "whatever this build implies", which is the only way
// back to the default once it has been set either way.
func (s *Server) handleUpdateChannel(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Channel string `json:"channel"`
	}
	if !decodeBody(w, r, &req) {
		return
	}
	switch req.Channel {
	case "", "stable", "prerelease":
	default:
		writeErr(w, http.StatusBadRequest, `channel must be "stable", "prerelease", or "" for the default`)
		return
	}
	if err := s.Store.SetSetting(settingUpdateChannel, req.Channel); err != nil {
		writeErr(w, http.StatusInternalServerError, "save channel")
		return
	}
	channel, _, explicit := s.updateChannel()
	writeJSON(w, http.StatusOK, map[string]any{"channel": channel, "channel_explicit": explicit})
}

// handleUpdateApply pulls the newest image and recreates this container via a
// one-shot Watchtower. Guarded by {"confirm":"UPDATE"} + the Docker socket.
// After it returns, Watchtower stops and recreates the container, so the client
// should expect the connection to drop and the app to come back on the new
// version — it polls for that.
// handleUpdateState reports the last apply attempt — see update_progress.go for
// why it has to exist at all.
//
// ADMIN ONLY, like the other two: the record names an image, a container and an
// Engine error, which is the operator's own deployment and nobody else's
// business. Absent is a 200 with `attempted: false`, not a 404 — "there has
// never been an update on this box" is an answer, and the page draws it.
func (s *Server) handleUpdateState(w http.ResponseWriter, r *http.Request) {
	rec, ok := s.readUpdateProgress()
	if !ok {
		writeJSON(w, http.StatusOK, map[string]any{"attempted": false})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"attempted":  true,
		"phase":      rec.Phase,
		"started_at": rec.StartedAt,
		"at":         rec.At,
		"from":       rec.From,
		"image":      rec.Image,
		"container":  rec.Container,
		"error":      rec.Error,
		"user":       rec.User,
		// The version answering RIGHT NOW, in the same reply. The page's whole
		// question is "is this a different box yet", and asking it in one request
		// rather than two removes the window where the two disagree.
		"current": buildinfo.Version,
	})
}

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
	// ONLY ONE UPDATE AT A TIME. Two applies race two one-shot recreaters at the
	// same container, and the second one is the natural thing to do when the first
	// appears to have done nothing — which, before the two fixes below, is exactly
	// what it appeared to have done.
	if !s.updateMu.TryLock() {
		writeErr(w, http.StatusConflict, "an update is already running")
		return
	}
	defer s.updateMu.Unlock()

	// WHERE IT GOT TO, written down as it goes — see update_progress.go. The page
	// that started this almost never hears the answer (the pull outlasts the
	// server's 60-second write timeout, so the browser's fetch resolves to no
	// status at all), which left it guessing "probably running" whatever really
	// happened. Each step below says what it is ABOUT to try before trying it, so
	// a record that stops at "pulling" names the pull as the thing that did not
	// come back.
	prog := s.newUpdateProgress(username(r))
	prog.step(updatePhaseRequested)

	// THE TWO WAYS THIS HANDLER USED TO BE CUT OFF MID-PULL, and why the symptom
	// was "it works in a browser on the server and almost never from my laptop".
	//
	// It pulls two images and creates a container before it writes a single byte,
	// which on a slow line is minutes.
	//
	//   1. The server sets WriteTimeout = 60s (cmd/tippani/main.go). Generous for
	//      every other endpoint, short for this one: the final writeJSON lands
	//      after the deadline and never reaches the client, so the page reports a
	//      failure for an update that may well have started.
	//   2. r.Context() is cancelled when the CONNECTION DROPS, and a request that
	//      sends nothing for minutes is exactly the request an intermediary gives
	//      up on: a phone that sleeps, a Wi-Fi roam, a reverse proxy's own read
	//      timeout, a closed tab. Over loopback on the box itself that essentially
	//      never happens. From another device it happens routinely — and a pull
	//      two minutes in was simply abandoned, leaving nothing updated and no
	//      trace beyond the APPLY line in the log with no "recreater launched"
	//      after it.
	//
	// WithoutCancel keeps the request's VALUES (the request id and the identity
	// the logger reads) and drops only the cancellation, so the 10 minutes below
	// is the real bound. No goroutine outlives the request: the handler still runs
	// the work itself and still answers, to whoever is left listening.
	_ = http.NewResponseController(w).SetWriteDeadline(time.Time{})
	ctx, cancel := context.WithTimeout(context.WithoutCancel(r.Context()), 10*time.Minute)
	defer cancel()

	d := s.newDocker()
	prog.step(updatePhaseEngine)
	if !d.Available(ctx) {
		// No Engine API → one-click isn't possible; hand back the manual command
		// so the operator can update by hand.
		olog.Printf("[update] apply requested by user %d (%s) but the Docker Engine API is unreachable", userID(r), username(r))
		// NOT "failed": nothing was attempted, and the operator's next move is the
		// guided command rather than pressing this again. The page says so.
		_, why := d.Probe(ctx)
		prog.fail(updatePhaseUnsupported)
		if why != "" {
			prog.fail(why)
		}
		writeJSON(w, http.StatusConflict, map[string]any{
			"error":          "the Docker Engine API is not reachable — one-click update needs the socket mounted, or TIPPANI_DOCKER_HOST pointed at a socket proxy (see the README)",
			"guided_command": guidedUpdateCommand,
			"socket":         false,
		})
		return
	}
	prog.step(updatePhaseIdentify)
	_, name, image, err := d.Self(ctx)
	if err != nil {
		// THE STEP THAT LOOKS LIKE NOTHING HAPPENING. Self asks the Engine about
		// the container whose name is this machine's hostname, so a compose file
		// that sets `hostname:` — or any runtime that does not name the container
		// after its id — gets a 404 here, BEFORE a single image is pulled. From
		// the outside that is an update that issued no Docker command at all,
		// which is exactly how it was reported.
		prog.fail("identify this container: " + err.Error())
		codedError(w, r, olog.CodeUpdateEngine, "update identify self", err)
		return
	}
	prog.on(image, name)
	olog.Alertf("[update] APPLY requested by user %d (%s) — pulling %s and recreating container %q", userID(r), username(r), image, name)
	prog.step(updatePhasePulling)
	if err := d.Pull(ctx, image); err != nil {
		prog.fail("pull " + image + ": " + err.Error())
		codedError(w, r, olog.CodeUpdateEngine, "update pull image", err)
		return
	}
	prog.step(updatePhaseRecreate)
	if err := d.RunWatchtower(ctx, name); err != nil {
		prog.fail("start the recreater: " + err.Error())
		codedError(w, r, olog.CodeUpdateEngine, "update run recreater", err)
		return
	}
	prog.step(updatePhaseLaunched)
	olog.Alertf("[update] recreater launched for %q — the container will restart on the new image", name)
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":      true,
		"message": "Update started — Tippani is pulling the new image and will restart in a moment.",
	})
}
