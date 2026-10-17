package httpapi

import (
	"bytes"
	"encoding/json"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"math"
	"mime/multipart"
	"net/http/httptest"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
)

// A READER CAN GIVE A PERSON A SIGNATURE, SEE IT CLEANED BEFORE ANYTHING IS KEPT,
// AND TAKE IT OFF AGAIN — without touching another reader's copy of the same
// signature.
//
// What a test here knows: the addresses it presses, what the replies say, and what
// is on disk and in the person's record afterwards. Nothing about which function
// cleans or names the file.

// aSignaturePhoto is a looped stroke in dark ink on grey, unevenly lit paper: the
// shape of a phone photo of a signature, small enough to build in a test.
func aSignaturePhoto(t *testing.T) []byte {
	t.Helper()
	const w, h = 480, 200
	img := image.NewNRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			v := uint8(150 + 90*x/w) // shadow on the left, bright on the right
			img.SetNRGBA(x, y, color.NRGBA{v, v, v, 255})
		}
	}
	for i := 0; i < 2000; i++ {
		tt := float64(i) / 2000 * 6 * math.Pi
		cx := 40 + float64(i)/2000*400
		cy := 100 + 45*math.Sin(tt) + 15*math.Sin(3*tt)
		for dy := -3; dy <= 3; dy++ {
			for dx := -3; dx <= 3; dx++ {
				if dx*dx+dy*dy <= 9 {
					img.SetNRGBA(int(cx)+dx, int(cy)+dy, color.NRGBA{15, 15, 40, 255})
				}
			}
		}
	}
	var b bytes.Buffer
	if err := png.Encode(&b, img); err != nil {
		t.Fatal(err)
	}
	return b.Bytes()
}

func blankPaper(t *testing.T) []byte {
	t.Helper()
	img := image.NewNRGBA(image.Rect(0, 0, 300, 120))
	for i := range img.Pix {
		img.Pix[i] = 250
	}
	var b bytes.Buffer
	if err := png.Encode(&b, img); err != nil {
		t.Fatal(err)
	}
	return b.Bytes()
}

// postSignature presses a signature route with a file and an optional strength.
func postSignature(c *testClient, path string, data []byte, fields map[string]string) *httptest.ResponseRecorder {
	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	fw, _ := mw.CreateFormFile("file", "signature.png")
	_, _ = fw.Write(data)
	for k, v := range fields {
		_ = mw.WriteField(k, v)
	}
	_ = mw.Close()
	return c.doRaw("POST", path, &buf, mw.FormDataContentType())
}

func makePerson(t *testing.T, c *testClient, name string) int64 {
	t.Helper()
	rec := c.do("PUT", "/people", map[string]string{"kind": "author", "name": name})
	if rec.Code != 200 {
		t.Fatalf("PUT /people %q: %d %s", name, rec.Code, rec.Body)
	}
	var out struct {
		ID int64 `json:"id"`
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &out)
	if out.ID == 0 {
		t.Fatalf("no id for %q in %s", name, rec.Body)
	}
	return out.ID
}

func signatureOf(t *testing.T, c *testClient, id int64) (path, source string) {
	t.Helper()
	var d struct {
		SignaturePath   string `json:"signature_path"`
		SignatureSource string `json:"signature_source"`
	}
	if err := json.Unmarshal(c.mustDo("GET", fmt.Sprintf("/people/id/%d", id), nil, 200).Body.Bytes(), &d); err != nil {
		t.Fatal(err)
	}
	return d.SignaturePath, d.SignatureSource
}

func filesIn(t *testing.T, dir string) int {
	t.Helper()
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatal(err)
	}
	return len(entries)
}

func TestAPreviewCleansAndKeepsNothing(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	id := makePerson(t, c, "Ursula Writer")
	before := filesIn(t, srv.coversDir())

	rec := postSignature(c, fmt.Sprintf("/people/id/%d/signature/preview", id), aSignaturePhoto(t), nil)
	if rec.Code != 200 {
		t.Fatalf("preview = %d: %s", rec.Code, rec.Body)
	}
	var out struct {
		Image string `json:"image"`
		Kind  string `json:"kind"`
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &out)
	if !strings.HasPrefix(out.Image, "data:image/png;base64,") || out.Kind != "png" {
		t.Fatalf("a preview answers the cleaned PNG, got kind %q image %.40q", out.Kind, out.Image)
	}
	if p, _ := signatureOf(t, c, id); p != "" {
		t.Errorf("a preview saved %q", p)
	}
	if n := filesIn(t, srv.coversDir()); n != before {
		t.Errorf("a preview wrote %d file(s)", n-before)
	}
}

func TestASignatureIsSavedSharedAndRemovedWithoutHarmingAnotherReader(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")
	photo := aSignaturePhoto(t)

	a := makePerson(t, alice, "Ursula Writer")
	b := makePerson(t, bob, "Ursula Writer")

	pathA := fmt.Sprintf("/people/id/%d/signature", a)
	rec := postSignature(alice, pathA, photo, nil)
	if rec.Code != 200 {
		t.Fatalf("save = %d: %s", rec.Code, rec.Body)
	}
	nameA, srcA := signatureOf(t, alice, a)
	if !regexp.MustCompile(`^[0-9a-f]{16}\.png$`).MatchString(nameA) {
		t.Fatalf("stored as %q, want 16 hex digits and .png", nameA)
	}
	if srcA != "manual" {
		t.Errorf("an uploaded signature is credited to %q, want manual", srcA)
	}
	if _, err := os.Stat(filepath.Join(srv.coversDir(), nameA)); err != nil {
		t.Fatalf("the file was not kept: %v", err)
	}

	// THE SAME SIGNATURE FOR ANOTHER READER IS THE SAME FILE.
	if rec := postSignature(bob, fmt.Sprintf("/people/id/%d/signature", b), photo, nil); rec.Code != 200 {
		t.Fatalf("bob's save = %d: %s", rec.Code, rec.Body)
	}
	if nameB, _ := signatureOf(t, bob, b); nameB != nameA {
		t.Errorf("identical signatures stored as %q and %q, want one shared file", nameA, nameB)
	}

	// ALICE TAKES HERS OFF. Bob's survives, and the file with it.
	alice.mustDo("PUT", fmt.Sprintf("/people/id/%d", a), map[string]any{"clear_signature": true}, 200)
	if p, _ := signatureOf(t, alice, a); p != "" {
		t.Errorf("alice's signature is still %q after removal", p)
	}
	if _, err := os.Stat(filepath.Join(srv.coversDir(), nameA)); err != nil {
		t.Fatalf("alice's removal deleted the file bob's signature names: %v", err)
	}
	if p, _ := signatureOf(t, bob, b); p != nameA {
		t.Errorf("bob's signature is %q after alice removed hers, want %q", p, nameA)
	}
	var removed int
	_ = srv.Store.DB.QueryRow(`SELECT signature_removed FROM people WHERE id = ?`, a).Scan(&removed)
	if removed != 1 {
		t.Errorf("a removed signature is not remembered (signature_removed = %d)", removed)
	}

	// BOB TAKES HIS OFF. Nothing names the file now, so it goes.
	bob.mustDo("PUT", fmt.Sprintf("/people/id/%d", b), map[string]any{"clear_signature": true}, 200)
	if _, err := os.Stat(filepath.Join(srv.coversDir(), nameA)); !os.IsNotExist(err) {
		t.Errorf("the file outlived the last signature naming it (err = %v)", err)
	}

	// AN UPLOAD IS A READER ASKING FOR ONE, so it clears the memory of the removal.
	if rec := postSignature(alice, pathA, photo, nil); rec.Code != 200 {
		t.Fatalf("second save = %d: %s", rec.Code, rec.Body)
	}
	_ = srv.Store.DB.QueryRow(`SELECT signature_removed FROM people WHERE id = ?`, a).Scan(&removed)
	if removed != 0 {
		t.Errorf("an upload left signature_removed = %d", removed)
	}
}

func TestASignatureRouteAnswers404ForAnotherReadersPerson(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")
	a := makePerson(t, alice, "Ursula Writer")

	for _, route := range []string{"signature", "signature/preview"} {
		rec := postSignature(bob, fmt.Sprintf("/people/id/%d/%s", a, route), aSignaturePhoto(t), nil)
		if rec.Code != 404 {
			t.Errorf("bob on alice's person, %s = %d, want 404", route, rec.Code)
		}
	}
	if p, _ := signatureOf(t, alice, a); p != "" {
		t.Errorf("bob's refused upload still wrote %q on alice's person", p)
	}
}

func TestASignatureThatCannotBeCleanedSaysWhy(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	id := makePerson(t, c, "Ursula Writer")
	path := fmt.Sprintf("/people/id/%d/signature", id)

	cases := map[string]struct {
		data []byte
		want string
	}{
		"blank paper": {blankPaper(t), "no ink"},
		"a WebP":      {append([]byte("RIFF\x00\x00\x00\x00WEBPVP8 "), make([]byte, 600)...), "WebP"},
		"garbage":     {[]byte("not an image"), "PNG, JPEG and GIF"},
	}
	for name, tc := range cases {
		rec := postSignature(c, path, tc.data, nil)
		if rec.Code != 422 || !strings.Contains(rec.Body.String(), tc.want) {
			t.Errorf("%s: %d %s, want 422 mentioning %q", name, rec.Code, rec.Body, tc.want)
		}
	}
	if p, _ := signatureOf(t, c, id); p != "" {
		t.Errorf("a refused upload left %q on the person", p)
	}
	// And an out-of-range strength is the caller's mistake, not a cleaner's.
	if rec := postSignature(c, path, aSignaturePhoto(t), map[string]string{"strength": "7"}); rec.Code != 400 {
		t.Errorf("strength 7 = %d, want 400", rec.Code)
	}
}
