package updater

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCompareAndUpdateAvailable(t *testing.T) {
	cases := []struct {
		cur, latest string
		cmp         int
		ok          bool
		available   bool
	}{
		{"v1.2.3", "v1.2.4", -1, true, true},
		{"1.2.3", "1.2.3", 0, true, false},
		{"v2.0.0", "v1.9.9", 1, true, false},
		{"v0.9", "v0.10", -1, true, true}, // 9 < 10 numerically, not lexically
		{"dev", "v0.5.0", 0, false, true}, // non-semver current → offer if a release exists
		{"edge", "", 0, false, false},     // no release → nothing to offer
		{"v1.0.0-rc1", "v1.0.0", 0, true, false},
	}
	for _, c := range cases {
		cmp, ok := Compare(c.cur, c.latest)
		if ok != c.ok || (ok && cmp != c.cmp) {
			t.Errorf("Compare(%q,%q) = (%d,%v), want (%d,%v)", c.cur, c.latest, cmp, ok, c.cmp, c.ok)
		}
		if got := UpdateAvailable(c.cur, c.latest); got != c.available {
			t.Errorf("UpdateAvailable(%q,%q) = %v, want %v", c.cur, c.latest, got, c.available)
		}
	}
}

func TestLatestRelease(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/repos/owner/repo/releases/latest" {
			w.WriteHeader(404)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"tag_name":"v1.4.0","name":"1.4.0","html_url":"https://x/releases/v1.4.0","published_at":"2026-07-13T00:00:00Z"}`))
	}))
	defer ts.Close()

	rel, err := LatestRelease(context.Background(), ts.URL, "owner/repo")
	if err != nil {
		t.Fatal(err)
	}
	if rel.TagName != "v1.4.0" || rel.HTMLURL == "" {
		t.Fatalf("release: %+v", rel)
	}

	// A repo with no releases (404) is an error, not a panic.
	if _, err := LatestRelease(context.Background(), ts.URL, "owner/missing"); err == nil {
		t.Fatal("expected error for 404")
	}
}

func TestSplitRef(t *testing.T) {
	cases := map[string][2]string{
		"ghcr.io/owner/tippani:latest": {"ghcr.io/owner/tippani", "latest"},
		"ghcr.io/owner/tippani":        {"ghcr.io/owner/tippani", "latest"},
		"registry:5000/img:v1":         {"registry:5000/img", "v1"},
	}
	for ref, want := range cases {
		img, tag := splitRef(ref)
		if img != want[0] || tag != want[1] {
			t.Errorf("splitRef(%q) = (%q,%q), want (%q,%q)", ref, img, tag, want[0], want[1])
		}
	}
}
