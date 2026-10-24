package httpapi

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"math"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync/atomic"
	"testing"

	"tippani/internal/metadata"
)

// THE PERSON'S FETCH FILLS AN EMPTY SIGNATURE SLOT, AND ONLY AN EMPTY ONE.
//
// What a person would say: pressing Fetch on an author gives them their Wikidata
// signature if they have none; it never replaces one I uploaded; and a signature I
// took off stays off however often I press Fetch again.
//
// What the test knows, declared: the suppliers are the server's own seams —
// srv.resolveAuthor answers a signature address, and srv.fetchImage stands in for
// the download, answering a photographed signature for that address and a stub
// JPEG for the portrait — because a test may not reach Wikidata or Commons.

const signatureAddress = "https://commons.wikimedia.org/wiki/Special:FilePath/Jane%20Solo%20signature.svg?width=600"

func stubSignatureSuppliers(t *testing.T, srv *Server, withSignature bool) {
	t.Helper()
	srv.resolveAuthor = func(_ context.Context, name string, _ []string) (metadata.AuthorResolution, error) {
		res := metadata.AuthorResolution{
			Key: "OL9A", Name: name, Bio: "A writer.",
			ImageURL: "https://covers.openlibrary.org/a/id/9-L.jpg",
			Links:    map[string]string{"openlibrary": "https://openlibrary.org/authors/OL9A"},
		}
		if withSignature {
			res.SignatureURL = signatureAddress
		}
		return res, nil
	}
	photo := aSignaturePhoto(t)
	var n atomic.Int64
	srv.fetchImage = func(_ context.Context, rawURL, dir string) (string, error) {
		data := []byte("jpeg")
		if strings.Contains(rawURL, "signature") {
			data = photo
		}
		name := fmt.Sprintf("%016x.png", n.Add(1)+0xabc000)
		return name, os.WriteFile(filepath.Join(dir, name), data, 0o600)
	}
}

func fetchPersonAs(t *testing.T, c *testClient, id int64) {
	t.Helper()
	c.mustDo("POST", "/people/id/"+itoa(id)+"/fetch", nil, http.StatusOK)
}

func TestAFetchFillsAnEmptySignatureSlotAndNothingElse(t *testing.T) {
	srv := newTestServer(t)
	stubSignatureSuppliers(t, srv, true)
	c := signupAdmin(t, srv.Handler())
	id := makePerson(t, c, "Jane Solo")

	fetchPersonAs(t, c, id)
	name, src := signatureOf(t, c, id)
	if name == "" {
		t.Fatal("a Fetch on an author whose Wikidata item has a signature left the slot empty")
	}
	if src != "wikidata" {
		t.Errorf("a fetched signature is credited to %q, want wikidata", src)
	}
	if _, err := os.Stat(filepath.Join(srv.coversDir(), name)); err != nil {
		t.Fatalf("the signature file was not kept: %v", err)
	}
	// The download's own temporary file does not linger beside it: the portrait
	// and the signature are the only two files.
	if n := filesIn(t, srv.coversDir()); n != 2 {
		t.Errorf("covers dir holds %d files after a fetch, want the portrait and the signature", n)
	}
}

func TestAFetchNeverReplacesASignatureTheReaderChose(t *testing.T) {
	srv := newTestServer(t)
	stubSignatureSuppliers(t, srv, true)
	c := signupAdmin(t, srv.Handler())
	id := makePerson(t, c, "Jane Solo")

	// The reader's own upload. It cleans to the same bytes as the fetched one here,
	// so what tells them apart is the supplier it is credited to: manual, not wikidata.
	if rec := postSignature(c, fmt.Sprintf("/people/id/%d/signature", id), aSignaturePhoto(t), nil); rec.Code != 200 {
		t.Fatalf("upload = %d: %s", rec.Code, rec.Body)
	}
	chosen, _ := signatureOf(t, c, id)

	before := filesIn(t, srv.coversDir())
	fetchPersonAs(t, c, id)
	if got, src := signatureOf(t, c, id); got != chosen || src != "manual" {
		t.Errorf("after a Fetch the signature is %q (%s), want the reader's %q (manual)", got, src, chosen)
	}
	// The fetched one was not used, so nothing names it, so it is not left behind
	// (the Fetch itself adds the portrait).
	if n := filesIn(t, srv.coversDir()); n != before+1 {
		t.Errorf("covers dir went from %d to %d files; only the portrait should have been added", before, n)
	}
}

func TestARemovedSignatureStaysRemovedUntilTheReaderAsksAgain(t *testing.T) {
	srv := newTestServer(t)
	stubSignatureSuppliers(t, srv, true)
	c := signupAdmin(t, srv.Handler())
	id := makePerson(t, c, "Jane Solo")

	fetchPersonAs(t, c, id)
	if got, _ := signatureOf(t, c, id); got == "" {
		t.Fatal("the first Fetch did not fill the slot")
	}
	c.mustDo("PUT", "/people/id/"+itoa(id), map[string]any{"clear_signature": true}, http.StatusOK)

	fetchPersonAs(t, c, id)
	if got, _ := signatureOf(t, c, id); got != "" {
		t.Errorf("the next Fetch put back the signature the reader removed: %q", got)
	}
}

// THE SLOT'S OWN FETCH OFFERS THE RAW SIGNATURE AND SAVES NOTHING. The screen
// shows what it answers through the same preview and ink slider an upload gets, and
// saves it, if the reader keeps it, through the ordinary save: so a fetch that
// wrote anything would be a signature the reader had not yet agreed to.
func TestTheSlotsFetchOffersASignatureAndSavesNothing(t *testing.T) {
	srv := newTestServer(t)
	stubSignatureSuppliers(t, srv, true)
	c := signupAdmin(t, srv.Handler())
	id := makePerson(t, c, "Jane Solo")
	before := filesIn(t, srv.coversDir())

	got := decode[struct {
		Found bool   `json:"found"`
		Image string `json:"image"`
	}](t, c.mustDo("POST", "/people/id/"+itoa(id)+"/signature/fetch", nil, http.StatusOK))
	if !got.Found || !strings.HasPrefix(got.Image, "data:image/png;base64,") {
		t.Fatalf("the slot's fetch answered %+v, want the signature as a PNG", got)
	}
	if p, _ := signatureOf(t, c, id); p != "" {
		t.Errorf("a fetch the reader has not accepted saved %q", p)
	}
	if n := filesIn(t, srv.coversDir()); n != before {
		t.Errorf("a fetch left %d file(s) behind", n-before)
	}

	// Taking it is the ordinary save, which credits Wikidata and clears the memory of
	// a removal, because that is the reader asking for a signature.
	c.mustDo("PUT", "/people/id/"+itoa(id), map[string]any{"clear_signature": true}, http.StatusOK)
	raw := mustDataURL(t, got.Image)
	if rec := postSignature(c, "/people/id/"+itoa(id)+"/signature", raw, map[string]string{"source": "wikidata"}); rec.Code != 200 {
		t.Fatalf("save = %d: %s", rec.Code, rec.Body)
	}
	if name, src := signatureOf(t, c, id); name == "" || src != "wikidata" {
		t.Errorf("after taking the fetched signature: %q credited to %q, want a file credited to wikidata", name, src)
	}
}

func TestTheSlotsFetchIsNotThereForAnotherReader(t *testing.T) {
	srv := newTestServer(t)
	stubSignatureSuppliers(t, srv, true)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")
	id := makePerson(t, alice, "Jane Solo")
	bob.mustDo("POST", "/people/id/"+itoa(id)+"/signature/fetch", nil, http.StatusNotFound)
}

func mustDataURL(t *testing.T, u string) []byte {
	t.Helper()
	_, b64, ok := strings.Cut(u, ",")
	if !ok {
		t.Fatalf("not a data URL: %.40q", u)
	}
	raw, err := base64.StdEncoding.DecodeString(b64)
	if err != nil {
		t.Fatal(err)
	}
	return raw
}

// THE DETAILS POPUP'S OWN LOOKUP FILLS THE SLOT TOO. It is a different route from
// the People row's Fetch (POST /people/portrait, by kind and name, not by id) and
// the owner asked for both; they share the resolve, and this holds the second one to
// the same rules: an empty slot is filled, a signature the reader removed is not put
// back.
func TestThePopupsLookupFillsAnEmptySlotAndHonoursARemoval(t *testing.T) {
	srv := newTestServer(t)
	stubSignatureSuppliers(t, srv, true)
	c := signupAdmin(t, srv.Handler())
	id := makePerson(t, c, "Jane Solo")

	c.mustDo("POST", "/people/portrait", map[string]any{"kind": "author", "name": "Jane Solo"}, http.StatusOK)
	name, src := signatureOf(t, c, id)
	if name == "" || src != "wikidata" {
		t.Fatalf("after the popup's lookup the slot holds %q (%s), want a Wikidata signature", name, src)
	}

	c.mustDo("PUT", "/people/id/"+itoa(id), map[string]any{"clear_signature": true}, http.StatusOK)
	c.mustDo("POST", "/people/portrait", map[string]any{"kind": "author", "name": "Jane Solo"}, http.StatusOK)
	if got, _ := signatureOf(t, c, id); got != "" {
		t.Errorf("the popup's lookup put back the signature the reader removed: %q", got)
	}
}

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
