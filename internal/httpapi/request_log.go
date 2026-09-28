package httpapi

import (
	"net/http"
	"net/url"
	"path"
	"strings"

	"tippani/internal/jobs"
)

// THE REQUEST LINE THE SERVER KEEPS, AND WHAT IT LEAVES OUT.
//
// stderr has always carried one line per request with the whole request URI, and
// it still does, byte for byte (logRequests). The line kept in the system log is
// a different thing: it is kept for thirty days, read by an admin who is not
// necessarily the reader it is about, and exported as Markdown to whoever the
// operator asks for help. So it keeps what the request did and drops what the
// request carried:
//
//   - the method, the path and the query's NAMES — enough to tell a search from a
//     sort, and a failing route from a working one;
//   - not the query's VALUES: they are what a reader searched for, a title, a
//     name, and on the OIDC callback the one-time code and state;
//   - not a share link's token, /share/image/{token}, which is the credential
//     itself — whoever holds it can fetch the picture without signing in; nor a
//     safety copy's, /admin/backup/safety/{token}, which with its admin's session
//     hands over a whole library; nor in the lines that name a request still
//     running (keptPath).
//
// And it is not kept at all for the Jobs tab's own reads. The tab polls while it
// is open; a log that wrote a line for every read of the log would fill itself
// with its own reading, and the one thing an admin never needs in the system log
// is the fact that they were looking at the system log.

// requestLevel is the level a request's line is kept at, and whether it is kept.
//
// "asset" is a file: the SPA's own files and everything else outside /api, and the
// pictures and fonts the app serves under it. There are dozens per screen, so the
// Jobs tab hides them unless asked. Only a successful one is an asset; a file that
// failed is a request like any other, because a missing cover or a 404 on the
// bundle is exactly what somebody opens the log to find.
func requestLevel(method, path string, status int) (string, bool) {
	read := method == http.MethodGet || method == http.MethodHead
	if read && (under(path, "/api/jobs") || strings.HasPrefix(path, "/api/admin/logs")) {
		return "", false
	}
	if read && status < 400 && servesAFile(path) {
		return jobs.LevelAsset, true
	}
	return jobs.LevelRequest, true
}

// servesAFile is whether path is one of the routes that answer with a file rather
// than with data: everything outside /api (the SPA's index and its bundle — the
// root mux sends every such path to spaHandler), GET /covers/{file}, which serves
// every stored picture (covers, posters, avatars, stickers, portraits, character
// art — all live in MediaCover), and a reader's own font, GET /fonts/{id}/file.
// The backup download and the exports are files too, but each is one deliberate
// act somebody may need to find, so they stay requests.
func servesAFile(path string) bool {
	if !strings.HasPrefix(path, "/api/") {
		return true
	}
	if strings.HasPrefix(path, "/api/covers/") {
		return true
	}
	if rest, ok := strings.CutPrefix(path, "/api/fonts/"); ok {
		id, tail, _ := strings.Cut(rest, "/")
		return id != "" && tail == "file"
	}
	return false
}

// under is whether path is prefix or below it, as a path and not as a string:
// /api/jobs and /api/jobs/12 are, /api/jobsearch would not be.
func under(path, prefix string) bool {
	return path == prefix || strings.HasPrefix(path, prefix+"/")
}

// shareImagePrefix and safetyCopyPath are the paths whose last segment is a
// credential, or half of one.
const (
	shareImagePrefix = "/api/share/image/"
	safetyCopyPath   = "/api" + safetyCopyRoute
)

// keptPath is a request's path as any line that outlives the request shows it:
// the path as it was sent, or, for a share link or a safety copy's download, its
// prefix and "…".
//
// THE TEST IS ON THE PATH AS THE ROUTER READS IT, NOT AS IT WAS SENT. The router
// unescapes each segment and cleans the path before it matches, so
// /api/share/%69mage/{token} is served the picture (200), and /api//share/image/
// {token} is redirected to it (307); both still carry the token as sent, and a
// test on the raw text let both through into the kept log. u.Path is the path
// unescaped, and path.Clean does the rest, so every spelling that reaches the
// share route, or is sent on to it, is caught. A path that only looks like one
// (an escaped slash, which the router would not follow) is blanked as well: a
// line that hides a little too much costs nothing.
//
// The in-flight tracker and the database door use it too: their lines name the
// requests still running, go to the same system log, and are kept as long.
func keptPath(u *url.URL) string {
	c := path.Clean("/" + u.Path)
	for _, prefix := range []string{shareImagePrefix, safetyCopyPath} {
		if strings.HasPrefix(c, prefix) && len(c) > len(prefix) {
			return prefix + "…"
		}
	}
	return u.EscapedPath()
}

// keptURI is the request URI as the kept line shows it: the path (keptPath), and
// the query with every value that is not empty as "…". A name with no value stays
// as it was, and so does an empty value — "q=" says the box was empty, which is
// worth reading and hides nothing.
func keptURI(u *url.URL) string {
	p := keptPath(u)
	if u.RawQuery == "" {
		return p
	}
	pairs := strings.Split(u.RawQuery, "&")
	for i, pair := range pairs {
		if name, value, ok := strings.Cut(pair, "="); ok && value != "" {
			pairs[i] = name + "=…"
		}
	}
	return p + "?" + strings.Join(pairs, "&")
}

// requestJob is the request's in-request job, when the server keeps one (it has a
// logbook), else nil.
func requestJob(r *http.Request) *jobs.Lazy {
	l, _ := jobs.From(r.Context()).(*jobs.Lazy)
	return l
}

// routed notes the route pattern on the request's job for a handler requireAuth
// does not wrap. requireAuth notes it for every signed-in route; a public route
// that can look outward (single sign-on, before there is a session) needs this,
// or its job would be kept as kind "request" with no pattern to say which route
// it was.
func routed(h http.HandlerFunc) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if job := requestJob(r); job != nil {
			job.Route(r.Pattern)
		}
		h(w, r)
	})
}
