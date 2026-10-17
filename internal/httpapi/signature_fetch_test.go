package httpapi

import (
	"context"
	"encoding/base64"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
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

func TestAFetchWithNoWikidataSignatureLeavesTheSlotEmpty(t *testing.T) {
	srv := newTestServer(t)
	stubSignatureSuppliers(t, srv, false)
	c := signupAdmin(t, srv.Handler())
	id := makePerson(t, c, "Jane Solo")

	fetchPersonAs(t, c, id)
	if got, _ := signatureOf(t, c, id); got != "" {
		t.Errorf("a signature appeared from nowhere: %q", got)
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

func TestTheSlotsFetchSaysWhenThereIsNothingToOffer(t *testing.T) {
	srv := newTestServer(t)
	stubSignatureSuppliers(t, srv, false)
	c := signupAdmin(t, srv.Handler())
	id := makePerson(t, c, "Jane Solo")

	got := decode[struct {
		Found bool `json:"found"`
	}](t, c.mustDo("POST", "/people/id/"+itoa(id)+"/signature/fetch", nil, http.StatusOK))
	if got.Found {
		t.Error("the fetch claimed to find a signature for an author with none")
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
