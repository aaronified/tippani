package httpapi

import (
	"bytes"
	"encoding/json"
	"fmt"
	"mime/multipart"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// A READER CAN GIVE A PICTURE FROM THEIR OWN MACHINE, for each of the three
// things in this app that wear one: a role in a work, a character's identity, and
// a person.
//
// THE SPECIFICATION. `docs/design/prototypes/character-popup.dc.html:1257-1260`
// draws three picture verbs on every media block and names the middle one
// "Upload — A file from this machine". Its own comment calls the trio "the repo's
// order", meaning these are the three ways a picture is expected to arrive
// throughout.
//
// WHAT THAT IMPLIES, AND IS WHAT THESE TESTS PIN. Not "there is a route with this
// name" — that is a fact about the source. What a reader can do:
//
//   THE FILE IS KEPT AND SERVED FROM HERE. Every other image in this app is
//   fetched once and served locally, because the premise of a self-hosted library
//   is that the library is nobody else's business. An uploaded picture is stored
//   the same way and the row points at it.
//
//   IT IS THE SAME COLUMN THE OTHER TWO VERBS WRITE. Nothing downstream — a chip,
//   a share card, a cast list — may be able to tell an uploaded picture from a
//   fetched one, or the fallback ladder would have to know the difference.
//
//   ANOTHER READER'S ROW IS A 404, NEVER A 403. The per-user rule this whole API
//   follows: one reader may not learn that another reader's row exists.
//
//   A ROW THAT IS NOT THERE ANY MORE IS NOT THERE. `work_cast` keeps a removed
//   pairing as a tombstone so a provider refetch cannot resurrect it, and every
//   other cast route treats one as absent.
//
// WHAT A TEST WRITER NEEDS TO KNOW: the paragraphs above. Nothing about which
// handler serves what or what it delegates to.

func uploadPictureTo(t *testing.T, c *testClient, path string, data []byte, want int) []byte {
	t.Helper()
	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	fw, err := mw.CreateFormFile("file", "chosen.png")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := fw.Write(data); err != nil {
		t.Fatal(err)
	}
	_ = mw.Close()
	rec := c.doRaw("POST", path, &buf, mw.FormDataContentType())
	if rec.Code != want {
		t.Fatalf("POST %s = %d, want %d: %s", path, rec.Code, want, rec.Body)
	}
	return rec.Body.Bytes()
}

// storedName pulls whatever filename the reply names, whichever key it used. The
// point of the test is that the caller is TOLD where the picture went — a reply
// that keeps it secret leaves the screen unable to redraw without a reload.
func storedName(t *testing.T, body []byte) string {
	t.Helper()
	var m map[string]any
	if err := json.Unmarshal(body, &m); err != nil {
		t.Fatalf("reply is not JSON: %s", body)
	}
	for _, v := range m {
		if s, ok := v.(string); ok && strings.HasSuffix(s, ".png") {
			return s
		}
	}
	t.Fatalf("the reply names no stored picture: %s", body)
	return ""
}

func TestAReaderCanUploadAPictureForARoleAnIdentityAndAPerson(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	_, withArt, _ := seedTVDBCast(t, srv, c)

	// The role in a work.
	name := storedName(t, uploadPictureTo(t, c, fmt.Sprintf("/cast/%d/image/upload", withArt), pngMagic, 200))
	if _, err := os.Stat(filepath.Join(srv.coversDir(), name)); err != nil {
		t.Fatalf("the uploaded picture was not kept: %v", err)
	}
	// AND IT IS THE SAME COLUMN THE OTHER TWO VERBS WRITE, which is what makes a
	// chip unable to tell where the picture came from. Read it back through the
	// cast list rather than the database, because that is what the screens read.
	var film int64
	if err := srv.Store.DB.QueryRow(`SELECT work_id FROM work_cast WHERE id = ?`, withArt).Scan(&film); err != nil {
		t.Fatal(err)
	}
	var found bool
	for _, row := range castOf(t, c, "/movies/"+itoa(film)+"/cast").Cast {
		if row.ID == withArt {
			found = row.CharacterImagePath == name
		}
	}
	if !found {
		t.Fatalf("the cast row does not point at the uploaded picture %q", name)
	}

	// The character's identity — the record the cast row is linked to.
	var charID int64
	if err := srv.Store.DB.QueryRow(`SELECT character_id FROM work_cast WHERE id = ?`, withArt).Scan(&charID); err != nil {
		t.Fatal(err)
	}
	if charID == 0 {
		t.Fatal("the seeded cast row is not linked to a character record")
	}
	cname := storedName(t, uploadPictureTo(t, c, fmt.Sprintf("/characters/%d/image/upload", charID), pngMagic, 200))
	if _, err := os.Stat(filepath.Join(srv.coversDir(), cname)); err != nil {
		t.Fatalf("the identity's uploaded picture was not kept: %v", err)
	}

	// A person.
	pid := personIDNamed(t, srv, "Viola Davis")
	pname := storedName(t, uploadPictureTo(t, c, fmt.Sprintf("/people/id/%d/portrait", pid), pngMagic, 200))
	if _, err := os.Stat(filepath.Join(srv.coversDir(), pname)); err != nil {
		t.Fatalf("the person's uploaded picture was not kept: %v", err)
	}
	var got string
	if err := srv.Store.DB.QueryRow(`SELECT image_path FROM people WHERE id = ?`, pid).Scan(&got); err != nil {
		t.Fatal(err)
	}
	if got != pname {
		t.Fatalf("people.image_path = %q, want the uploaded %q", got, pname)
	}
}

func TestAnotherReadersRowCannotBeGivenAPicture(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	owner := signupAdmin(t, h)
	_, withArt, _ := seedTVDBCast(t, srv, owner)
	var charID int64
	if err := srv.Store.DB.QueryRow(`SELECT character_id FROM work_cast WHERE id = ?`, withArt).Scan(&charID); err != nil {
		t.Fatal(err)
	}
	pid := personIDNamed(t, srv, "Viola Davis")

	other := addUser(t, h, owner, "intruder")
	for _, path := range []string{
		fmt.Sprintf("/cast/%d/image/upload", withArt),
		fmt.Sprintf("/characters/%d/image/upload", charID),
		fmt.Sprintf("/people/id/%d/portrait", pid),
	} {
		// 404 AND NOT 403: a 403 would confirm the row exists.
		uploadPictureTo(t, other, path, pngMagic, 404)
	}
}

func TestARemovedCastRowCannotBeGivenAPicture(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	_, withArt, _ := seedTVDBCast(t, srv, c)

	c.mustDo("DELETE", fmt.Sprintf("/cast/%d", withArt), nil, 204)
	uploadPictureTo(t, c, fmt.Sprintf("/cast/%d/image/upload", withArt), pngMagic, 404)
}

func TestSomethingThatIsNotAnImageIsRefused(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	_, withArt, _ := seedTVDBCast(t, srv, c)

	uploadPictureTo(t, c, fmt.Sprintf("/cast/%d/image/upload", withArt),
		[]byte("this is a text file pretending to be a picture"), 400)
}

// AND THE ROW THE UPLOAD CHANGED IS THE ROW THE REPLY DESCRIBES. A board's
// picture is uploaded the same way, and the caller redraws from the reply: a
// reply describing some OTHER row leaves the screen showing the old picture, or
// failing outright, for an upload that in fact succeeded.
func TestAnUploadRepliesAboutTheRowItChanged(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	rec := c.mustDo("POST", "/boards", map[string]any{"name": "Marginalia"}, 201)
	var board struct {
		ID int64 `json:"id"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &board); err != nil {
		t.Fatal(err)
	}
	body := uploadPictureTo(t, c, fmt.Sprintf("/boards/%d/cover", board.ID), pngMagic, 200)
	name := storedName(t, body)

	var stored string
	if err := srv.Store.DB.QueryRow(`SELECT image_path FROM boards WHERE id = ?`, board.ID).Scan(&stored); err != nil {
		t.Fatal(err)
	}
	if stored != name {
		t.Fatalf("the reply named %q and the board holds %q — the caller redraws from the wrong row", name, stored)
	}
	if strings.Contains(string(body), "poster_path") {
		t.Fatalf("a board's upload answered with a film's shape: %s", body)
	}
}

// personIDNamed is the record behind a credited name, which the cast seed creates
// as a side effect of naming a performer.
func personIDNamed(t *testing.T, srv *Server, name string) int64 {
	t.Helper()
	var id int64
	if err := srv.Store.DB.QueryRow(`SELECT id FROM people WHERE name = ?`, name).Scan(&id); err != nil {
		t.Fatalf("no person record for %q: %v", name, err)
	}
	return id
}
