package metadata

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
)

// pngData sniffs as image/png: magic header plus padding past minImageBytes.
var pngData = append([]byte("\x89PNG\r\n\x1a\n"), bytes.Repeat([]byte{0}, 600)...)

// allowAny lifts the SSRF guard for this test so plain-http httptest servers
// on 127.0.0.1 are reachable.
func allowAny(t *testing.T) {
	t.Helper()
	fetchAllowAny = true
	t.Cleanup(func() { fetchAllowAny = false })
}

func imageServer(t *testing.T, body []byte) *httptest.Server {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write(body)
	}))
	t.Cleanup(srv.Close)
	return srv
}

func TestFetchImageHappyPath(t *testing.T) {
	allowAny(t)
	srv := imageServer(t, pngData)
	dir := t.TempDir()

	// URL says .jpeg; the sniffed bytes must win.
	name, err := FetchImage(context.Background(), srv.URL+"/cover.jpeg", dir)
	if err != nil {
		t.Fatal(err)
	}
	if !regexp.MustCompile(`^[0-9a-f]{16}\.png$`).MatchString(name) {
		t.Fatalf("name = %q, want 16 hex chars + sniffed .png", name)
	}
	got, err := os.ReadFile(filepath.Join(dir, name))
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(got, pngData) {
		t.Fatalf("stored %d bytes, want %d", len(got), len(pngData))
	}
}

func TestFetchImageOversize(t *testing.T) {
	allowAny(t)
	big := append([]byte("\x89PNG\r\n\x1a\n"), make([]byte, maxImageBytes)...)
	srv := imageServer(t, big)

	_, err := FetchImage(context.Background(), srv.URL, t.TempDir())
	if err == nil || !strings.Contains(err.Error(), "exceeds") {
		t.Fatalf("err = %v, want size cap rejection", err)
	}
}

func TestFetchImageNotAnImage(t *testing.T) {
	allowAny(t)
	srv := imageServer(t, []byte("<html>not an image</html>"))

	if _, err := FetchImage(context.Background(), srv.URL, t.TempDir()); err == nil {
		t.Fatal("want rejection for non-image content")
	}
}

func TestFetchImageRedirects(t *testing.T) {
	allowAny(t)
	mux := http.NewServeMux()
	mux.HandleFunc("/img", func(w http.ResponseWriter, r *http.Request) { _, _ = w.Write(pngData) })
	mux.HandleFunc("/hop1", func(w http.ResponseWriter, r *http.Request) { http.Redirect(w, r, "/img", http.StatusFound) })
	mux.HandleFunc("/hop2", func(w http.ResponseWriter, r *http.Request) { http.Redirect(w, r, "/hop1", http.StatusFound) })
	mux.HandleFunc("/hop3", func(w http.ResponseWriter, r *http.Request) { http.Redirect(w, r, "/hop2", http.StatusFound) })
	srv := httptest.NewServer(mux)
	defer srv.Close()

	if _, err := FetchImage(context.Background(), srv.URL+"/hop2", t.TempDir()); err != nil {
		t.Fatalf("2 redirects should pass: %v", err)
	}
	if _, err := FetchImage(context.Background(), srv.URL+"/hop3", t.TempDir()); err == nil {
		t.Fatal("3 redirects should be refused")
	}
}

func TestFetchImageGuards(t *testing.T) {
	// Deliberately no allowAny: the real guard must reject these before any
	// request is made.
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("guarded fetch reached the server")
	}))
	defer srv.Close()
	dir := t.TempDir()

	if _, err := FetchImage(context.Background(), srv.URL, dir); err == nil {
		t.Fatal("plain-http 127.0.0.1 URL accepted")
	}
	if _, err := FetchImage(context.Background(), "https://127.0.0.1/x.png", dir); err == nil {
		t.Fatal("https loopback URL accepted")
	}
	if _, err := FetchImage(context.Background(), "https://evil.example/x.png", dir); err == nil {
		t.Fatal("non-allowlisted host accepted")
	}
}

func TestBlockPrivateAddr(t *testing.T) {
	cases := []struct {
		addr string
		bad  bool
	}{
		{"127.0.0.1:443", true},
		{"10.1.2.3:443", true},
		{"172.16.0.1:443", true},
		{"192.168.1.10:443", true},
		{"169.254.1.1:443", true}, // link-local (cloud metadata range)
		{"0.0.0.0:443", true},
		{"[::1]:443", true},
		{"[fe80::1]:443", true},
		{"93.184.216.34:443", false},
		{"[2606:2800:220:1:248:1893:25c8:1946]:443", false},
	}
	for _, c := range cases {
		err := blockPrivateAddr("tcp", c.addr, nil)
		if c.bad && err == nil {
			t.Errorf("blockPrivateAddr(%s) = nil, want refusal", c.addr)
		}
		if !c.bad && err != nil {
			t.Errorf("blockPrivateAddr(%s) = %v, want nil", c.addr, err)
		}
	}
}
