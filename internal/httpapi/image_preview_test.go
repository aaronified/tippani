package httpapi

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// A PICTURE CHOSEN FROM A SEARCH CAN BE FRAMED BEFORE THE FORM IS SAVED.
//
// What a person would say: I picked a cover from the strip, and I can move it about in
// its frame straight away — nothing is saved until I say so, and looking at pictures I
// then do not use leaves nothing behind.
//
// What the test knows, declared: the route is POST /images/preview {url} -> {image}, and
// srv.fetchUserImage is the server's own seam for the download, because a test may not
// reach a supplier. The reply is a data: URL because that is the only form the page may
// draw and read back (its img-src is 'self' and data:).

func stubUserImage(srv *Server, calls *[]string, payload []byte) {
	srv.fetchUserImage = func(_ context.Context, rawURL, dir string) (string, error) {
		*calls = append(*calls, rawURL)
		name := "00000000000000aa.png"
		return name, os.WriteFile(filepath.Join(dir, name), payload, 0o600)
	}
}

func TestAChosenPictureComesBackAsBytesThePageCanFrame(t *testing.T) {
	srv := newTestServer(t)
	png := append([]byte("\x89PNG\r\n\x1a\n"), []byte("the-rest-of-a-picture")...)
	var asked []string
	stubUserImage(srv, &asked, png)
	c := signupAdmin(t, srv.Handler())

	rec := c.mustDo("POST", "/images/preview", map[string]string{"url": "https://pics.example/cover.png"}, http.StatusOK)

	var got struct {
		Image string `json:"image"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	const prefix = "data:image/png;base64,"
	if !strings.HasPrefix(got.Image, prefix) {
		t.Fatalf("the reply is %.40q, want a PNG data: URL", got.Image)
	}
	back, err := base64.StdEncoding.DecodeString(strings.TrimPrefix(got.Image, prefix))
	if err != nil || string(back) != string(png) {
		t.Errorf("the bytes that came back are not the picture that was fetched (err %v)", err)
	}
	if len(asked) != 1 || asked[0] != "https://pics.example/cover.png" {
		t.Errorf("the server fetched %v, want exactly the address that was chosen", asked)
	}
}

func TestLookingAtAPictureLeavesNothingStored(t *testing.T) {
	srv := newTestServer(t)
	var asked []string
	stubUserImage(srv, &asked, append([]byte("\x89PNG\r\n\x1a\n"), 'x'))
	c := signupAdmin(t, srv.Handler())

	for i := 0; i < 3; i++ {
		c.mustDo("POST", "/images/preview", map[string]string{"url": "https://pics.example/a.png"}, http.StatusOK)
	}
	if n := filesIn(t, srv.coversDir()); n != 0 {
		t.Errorf("covers dir holds %d files after three previews, want none", n)
	}
}

func TestAPreviewNeedsAnAddressAndASignedInReader(t *testing.T) {
	srv := newTestServer(t)
	var asked []string
	stubUserImage(srv, &asked, []byte("x"))
	c := signupAdmin(t, srv.Handler())

	c.mustDo("POST", "/images/preview", map[string]string{"url": "  "}, http.StatusBadRequest)

	anon := httptest.NewRecorder()
	req := httptest.NewRequest("POST", "/api/images/preview", strings.NewReader(`{"url":"https://pics.example/a.png"}`))
	req.Header.Set("Content-Type", "application/json")
	srv.Handler().ServeHTTP(anon, req)
	if anon.Code != http.StatusUnauthorized {
		t.Errorf("a signed-out reader got %d, want 401", anon.Code)
	}
	if len(asked) != 0 {
		t.Errorf("a refused request still made the server fetch %v", asked)
	}
}

func TestAPictureThatCannotBeFetchedIsAnAnswerNotACrash(t *testing.T) {
	srv := newTestServer(t)
	srv.fetchUserImage = func(context.Context, string, string) (string, error) {
		return "", context.DeadlineExceeded
	}
	c := signupAdmin(t, srv.Handler())
	c.mustDo("POST", "/images/preview", map[string]string{"url": "https://pics.example/a.png"}, http.StatusBadGateway)
}

func TestAnSVGComesBackAsAnSVGTheBrowserCanDecode(t *testing.T) {
	srv := newTestServer(t)
	var asked []string
	stubUserImage(srv, &asked, []byte(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300" viewBox="0 0 600 300"><rect width="600" height="300" fill="#789"/></svg>`))
	c := signupAdmin(t, srv.Handler())

	rec := c.mustDo("POST", "/images/preview", map[string]string{"url": "https://pics.example/logo.svg"}, http.StatusOK)

	var got struct {
		Image string `json:"image"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(got.Image, "data:image/svg+xml;base64,") {
		t.Errorf("an SVG previews as %.40q; a page cannot decode an image under that type", got.Image)
	}
}
