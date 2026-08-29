package httpapi

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"testing/fstest"
)

// Serving the SPA, and the one thing about it that turned a broken build into a
// blank page with no evidence.
//
// The fallback exists for the client-side router: /library and /quotes/12 are not
// files and have to be answered with index.html. It was applied to EVERYTHING
// missing, so a request for a bundle that was not in the image came back as
// index.html — status 200, Content-Type text/html — and the browser declined to
// execute HTML as a module and rendered nothing at all. No error in the log, no
// failing healthcheck, nothing in the status code. That is what shipped in
// 1.11.2, and the fallback is the reason it looked like nothing was wrong.

func spaServer(t *testing.T, files map[string]string) http.Handler {
	t.Helper()
	fsys := fstest.MapFS{}
	for name, body := range files {
		fsys[name] = &fstest.MapFile{Data: []byte(body)}
	}
	srv := newTestServer(t)
	srv.Static = fsys
	return srv.Handler()
}

const indexHTML = `<!doctype html><html><body><script src="/assets/index-abc.js"></script></body></html>`

func get(t *testing.T, h http.Handler, path string) *httptest.ResponseRecorder {
	t.Helper()
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", path, nil))
	return rec
}

// Both of the ways a request has to end up at the app: the root, which is served
// directly, and a client route, which reaches index.html through the fallback.
func TestTheAppIsServedForTheRootAndClientRoutes(t *testing.T) {
	// One fixture for every row: each row is a read-only GET against a static
	// FS holding nothing but index.html, so no row's assertion can observe
	// another row's data. This is the same sharing the client-route loop
	// already did across its five paths.
	h := spaServer(t, map[string]string{"index.html": indexHTML})

	cases := []struct {
		name string
		path string
	}{
		{"the root serves the app", "/"},

		// The whole reason the fallback exists. These are not files and never will be.
		{"a client route falls back to the app: /library", "/library"},
		{"a client route falls back to the app: /quotes", "/quotes"},
		{"a client route falls back to the app: /library/12", "/library/12"},
		{"a client route falls back to the app: /settings", "/settings"},
		{"a client route falls back to the app: /bin", "/bin"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			rec := get(t, h, tc.path)
			if rec.Code != http.StatusOK {
				t.Fatalf("%s: got %d, this must be answered with the app", tc.path, rec.Code)
			}
			if !strings.Contains(rec.Body.String(), "index-abc.js") {
				t.Fatalf("%s: did not serve index.html: %s", tc.path, rec.Body)
			}
		})
	}
}

// THE REGRESSION TEST FOR 1.11.2.
//
// A missing asset must be a 404. Answering it with index.html is what made a
// frontend build with the wrong bundle in it indistinguishable, from the outside,
// from a working deployment.
func TestAMissingAssetIsA404AndNotTheApp(t *testing.T) {
	h := spaServer(t, map[string]string{"index.html": indexHTML})
	for _, missing := range []string{
		"/assets/index-abc.js",  // the bundle index.html asks for
		"/assets/index-abc.css", // and its stylesheet
		"/assets/layout-xyz.js", // a code-split chunk
		"/manifest.json",        // the PWA manifest
		"/mark.svg",             // an icon
		"/icons/icon-192.png",   // a nested one
	} {
		rec := get(t, h, missing)
		if rec.Code != http.StatusNotFound {
			t.Errorf("%s: got %d, want 404 — serving the app here is a blank page with no error", missing, rec.Code)
		}
		if strings.Contains(rec.Body.String(), "<!doctype html>") {
			t.Errorf("%s: was answered with index.html; a browser will not run HTML as a module", missing)
		}
	}
}

func TestAnAssetThatExistsIsServed(t *testing.T) {
	h := spaServer(t, map[string]string{
		"index.html":           indexHTML,
		"assets/index-abc.js":  "console.log('hi')",
		"assets/index-abc.css": ".a{}",
	})
	for path, want := range map[string]string{
		"/assets/index-abc.js":  "console.log",
		"/assets/index-abc.css": ".a{}",
	} {
		rec := get(t, h, path)
		if rec.Code != http.StatusOK {
			t.Errorf("%s: %d", path, rec.Code)
		}
		if !strings.Contains(rec.Body.String(), want) {
			t.Errorf("%s: served %q", path, rec.Body)
		}
	}
}

// THE COMMITTED BUNDLE HAS TO BE SELF-CONSISTENT, and this reads the real thing
// off disk rather than a fixture.
//
// web/dist is what a non-Docker deploy serves, and index.html names its bundle by
// content hash — so a dist committed half-built, or rebuilt without its index, is
// a deployment that answers 200 and renders nothing. Cheap to check and the only
// test in the tree that looks at the artifact a user actually receives.
//
// Skipped rather than failed when dist holds only the placeholder: a fresh clone
// has not run `make frontend`, and a test that fails on a clean checkout gets
// disabled rather than fixed.
func TestTheCommittedBundleIsSelfConsistent(t *testing.T) {
	const dist = "../../web/dist"
	index, err := os.ReadFile(filepath.Join(dist, "index.html"))
	if err != nil {
		t.Skipf("no built dist to check (%v) — run make frontend", err)
	}
	refs := assetRefs(string(index))
	if len(refs) == 0 {
		t.Skip("dist/index.html references no hashed assets — placeholder, not a build")
	}
	for _, ref := range refs {
		path := filepath.Join(dist, strings.TrimPrefix(ref, "/"))
		info, err := os.Stat(path)
		if err != nil {
			t.Errorf("index.html asks for %s and it is not in dist: %v\n"+
				"A deployment serving this dist answers that request with index.html and renders nothing.\n"+
				"Fix: make frontend", ref, err)
			continue
		}
		if info.Size() == 0 {
			t.Errorf("%s is empty", ref)
		}
	}
}

// assetRefs pulls src="/assets/…" and href="/assets/…" out of a document.
func assetRefs(html string) []string {
	var out []string
	for _, attr := range []string{`src="`, `href="`} {
		rest := html
		for {
			i := strings.Index(rest, attr)
			if i < 0 {
				break
			}
			rest = rest[i+len(attr):]
			j := strings.Index(rest, `"`)
			if j < 0 {
				break
			}
			if v := rest[:j]; strings.HasPrefix(v, "/assets/") {
				out = append(out, v)
			}
			rest = rest[j:]
		}
	}
	return out
}

// THE 751 KILOBYTES THAT WERE DOWNLOADED AGAIN ON EVERY VISIT.
//
// Everything under /assets is content-hashed by the build — index-DsRtUZ5f.css,
// caveat-latin-500-normal-B9SDL8cy.woff2 — so the name IS the version and a
// changed file is a changed URL. This handler sent no Cache-Control, no ETag and
// no Last-Modified, which leaves a browser with no freshness lifetime and
// nothing to revalidate against: measured in Chromium against a real instance,
// the bundle, the stylesheet and seven fonts came down on the first visit, the
// second and the third alike. That is the "app has become sluggish" and the
// "not even cached" reports, and on a LAN it is most of both.
func TestHashedAssetsAreCachedAndIndexIsNot(t *testing.T) {
	h := spaServer(t, map[string]string{
		"index.html":          indexHTML,
		"assets/index-abc.js": "console.log(1)",
	})

	asset := get(t, h, "/assets/index-abc.js").Header().Get("Cache-Control")
	if !strings.Contains(asset, "immutable") || !strings.Contains(asset, "max-age=31536000") {
		t.Errorf("hashed asset Cache-Control = %q, want a year and immutable", asset)
	}

	// INDEX MUST NOT BE. It is the one file whose name never changes, so it is
	// the one that has to be revalidated — it is what tells the browser which
	// hashed bundle to ask for next, and a cached copy of it pins the app to
	// the version it named for as long as the cache holds.
	for _, p := range []string{"/", "/index.html", "/library"} {
		got := get(t, h, p).Header().Get("Cache-Control")
		if strings.Contains(got, "immutable") || strings.Contains(got, "max-age=31536000") {
			t.Errorf("%s Cache-Control = %q, want it revalidated", p, got)
		}
		if got == "" {
			t.Errorf("%s sent no Cache-Control at all", p)
		}
	}

	// A 404 for a missing asset keeps its no-cache answer rather than being
	// pinned for a year by the header set on the way in.
	if rec := get(t, h, "/assets/gone-999.js"); rec.Code != http.StatusNotFound {
		t.Errorf("missing asset = %d, want 404", rec.Code)
	}
}
