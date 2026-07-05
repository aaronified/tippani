package httpapi

import (
	"testing"
)

// A newly-created user gets the default sticker/tag vocabulary seeded, so the
// tag palette isn't empty on day one (v3). Seeding is normally off in tests
// (newTestServer) to keep other tag assertions deterministic — flip it on here.
func TestSeedDefaultTags(t *testing.T) {
	srv := newTestServer(t)
	srv.SeedNewUsers = true
	h := srv.Handler()
	c := signupAdmin(t, h)

	tg := decode[tagsResp](t, c.mustDo("GET", "/tags", nil, 200))
	if len(tg.Tags) != len(defaultSeedTags) {
		t.Fatalf("seeded %d tags, want %d: %+v", len(tg.Tags), len(defaultSeedTags), tg.Tags)
	}

	got := make(map[string][2]string, len(tg.Tags))
	for _, x := range tg.Tags {
		got[x.Name] = [2]string{x.Color, x.Style}
	}
	for _, want := range defaultSeedTags {
		if g, ok := got[want.Name]; !ok || g[0] != want.Color || g[1] != want.Style {
			t.Fatalf("seed tag %q = %v (present=%v); want {%s %s}", want.Name, g, ok, want.Color, want.Style)
		}
	}
}
