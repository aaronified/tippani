package httpapi

// Bring your own font.
//
// The server stores bytes and never parses them, so almost everything worth
// testing here is about the boundary: what it accepts, what it refuses, and
// whether one account can read another's file.

import (
	"bytes"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// A minimal file with each container's magic. Nothing past the first four bytes
// is ever read by this package, which is the point.
func fontBytes(magic string) []byte {
	return append([]byte(magic), bytes.Repeat([]byte{0x42}, 256)...)
}

func uploadFont(t *testing.T, c *testClient, filename string, data []byte, want int) *httptest.ResponseRecorder {
	t.Helper()
	var body bytes.Buffer
	mw := multipart.NewWriter(&body)
	fw, err := mw.CreateFormFile("file", filename)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := fw.Write(data); err != nil {
		t.Fatal(err)
	}
	mw.Close()
	rec := c.doRaw("POST", "/fonts", &body, mw.FormDataContentType())
	if rec.Code != want {
		t.Fatalf("POST /fonts %s = %d, want %d: %s", filename, rec.Code, want, rec.Body)
	}
	return rec
}

func TestFontUploadAcceptsTheFourContainers(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	for _, tc := range []struct{ magic, format string }{
		{"wOF2", "woff2"},
		{"wOFF", "woff"},
		{"OTTO", "otf"},
		{"\x00\x01\x00\x00", "ttf"},
	} {
		got := decode[fontRow](t, uploadFont(t, c, "My-Face.woff2", fontBytes(tc.magic), http.StatusCreated))
		if got.Format != tc.format {
			t.Errorf("magic %q stored as format %q, want %q", tc.magic, got.Format, tc.format)
		}
		// The token is what a preference stores, composed by the server so no
		// client has to know how the two halves join.
		if !strings.HasPrefix(got.Token, "upload:") {
			t.Errorf("token %q is not an upload reference", got.Token)
		}
		// Named from the filename, tidied. A font's real family name is inside
		// the file, and reading it would mean parsing one.
		if got.Name != "My Face" {
			t.Errorf("name = %q, want %q", got.Name, "My Face")
		}
	}
}

// THE CASE AN EXTENSION CHECK MISSES. A .woff2 that is really a ZIP is refused
// here rather than by the browser later, with nothing on screen to say why.
func TestFontUploadRefusesWhatIsNotAFont(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	uploadFont(t, c, "trojan.woff2", []byte("PK\x03\x04 a zip pretending"), http.StatusBadRequest)
	uploadFont(t, c, "font.ttf", []byte("<svg>not type</svg>"), http.StatusBadRequest)
	uploadFont(t, c, "empty.woff", []byte{}, http.StatusBadRequest)
	uploadFont(t, c, "tiny.woff", []byte{0x00}, http.StatusBadRequest)
}

func TestFontFileIsServedOnlyToItsOwner(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	owner := signupAdmin(t, h)
	mine := decode[fontRow](t, uploadFont(t, owner, "mine.woff2", fontBytes("wOF2"), http.StatusCreated))

	rec := owner.mustDo("GET", "/fonts/"+itoa(mine.ID)+"/file", nil, http.StatusOK)
	if ct := rec.Header().Get("Content-Type"); ct != "font/woff2" {
		t.Errorf("served as %q, want font/woff2", ct)
	}
	// A font is parsed by the browser's font engine and by nothing else; without
	// this a crafted file could be re-read as whatever a sniffer prefers.
	if rec.Header().Get("X-Content-Type-Options") != "nosniff" {
		t.Error("no nosniff on a file the server never parsed")
	}

	stranger := addUser(t, h, owner, "stranger")
	stranger.mustDo("GET", "/fonts/"+itoa(mine.ID)+"/file", nil, http.StatusNotFound)
	stranger.mustDo("DELETE", "/fonts/"+itoa(mine.ID), nil, http.StatusNotFound)

	// And the owner's list is their own.
	list := decode[struct {
		Fonts []fontRow `json:"fonts"`
	}](t, stranger.mustDo("GET", "/fonts", nil, http.StatusOK))
	if len(list.Fonts) != 0 {
		t.Fatalf("a stranger listed %d of somebody else's fonts", len(list.Fonts))
	}
}

// DELETING A FONT A PREFERENCE STILL NAMES IS NOT AN ERROR, and nothing is
// rewritten: the client falls back to the built-in for any token it cannot
// resolve, which is the same rule that covers a typo and an older client.
func TestDeletingAFontAPreferenceStillNames(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	f := decode[fontRow](t, uploadFont(t, c, "mine.otf", fontBytes("OTTO"), http.StatusCreated))

	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"fontDisplay": f.Token}, http.StatusOK)
	c.mustDo("DELETE", "/fonts/"+itoa(f.ID), nil, http.StatusNoContent)

	// The preference is untouched, and still readable.
	me := decode[struct {
		Preferences prefs `json:"preferences"`
	}](t, c.mustDo("GET", "/auth/me", nil, http.StatusOK))
	if me.Preferences.FontDisplay != f.Token {
		t.Fatalf("the preference was rewritten to %q", me.Preferences.FontDisplay)
	}
	// The bytes are gone.
	c.mustDo("GET", "/fonts/"+itoa(f.ID)+"/file", nil, http.StatusNotFound)
}

func TestFontNameFallsBackWhenThereIsNothingToUse(t *testing.T) {
	for _, c := range []struct{ in, want string }{
		{"Source-Serif-4.woff2", "Source Serif 4"},
		{"my_font.ttf", "my font"},
		{"  spaced   out .otf", "spaced out"},
		{".woff2", "Uploaded font"},
		{"", "Uploaded font"},
	} {
		if got := fontName(c.in); got != c.want {
			t.Errorf("fontName(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}
