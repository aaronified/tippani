package httpapi

import (
	"bytes"
	"encoding/json"
	"fmt"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// uploadSticker posts a multipart image (+ optional name) to POST /stickers.
func uploadSticker(t *testing.T, c *testClient, filename, name string, content []byte) *stickerRow {
	t.Helper()
	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	if name != "" {
		_ = mw.WriteField("name", name)
	}
	fw, _ := mw.CreateFormFile("file", filename)
	_, _ = fw.Write(content)
	_ = mw.Close()
	rec := c.doRaw("POST", "/stickers", &buf, mw.FormDataContentType())
	if rec.Code != http.StatusCreated {
		t.Fatalf("upload sticker: %d %s", rec.Code, rec.Body)
	}
	var st stickerRow
	if err := json.Unmarshal(rec.Body.Bytes(), &st); err != nil {
		t.Fatal(err)
	}
	return &st
}

// TestStickerLifecycle: upload (PNG + SVG), attach to an annotation, rename,
// and delete — where the delete must clear the annotation's sticker_id (ON
// DELETE SET NULL) and remove the file.
func TestStickerLifecycle(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	// Upload a PNG sticker and an SVG sticker.
	png := uploadSticker(t, c, "seal.png", "Gold Seal", pngMagic)
	if !strings.HasSuffix(png.Path, ".png") || png.Name != "Gold Seal" {
		t.Fatalf("png sticker: %+v", png)
	}
	svgBytes := []byte(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>`)
	svg := uploadSticker(t, c, "star.svg", "", svgBytes)
	if !strings.HasSuffix(svg.Path, ".svg") {
		t.Fatalf("svg sticker path = %q, want .svg", svg.Path)
	}

	// Both list, newest first.
	listed := decode[struct {
		Stickers []stickerRow `json:"stickers"`
	}](t, c.mustDo("GET", "/stickers", nil, 200))
	if len(listed.Stickers) != 2 {
		t.Fatalf("want 2 stickers, got %d", len(listed.Stickers))
	}

	// Attach the PNG sticker to a new annotation.
	book := createBook(t, c, "Dune")
	rec := c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book, "quote": "Fear is the mind-killer.", "sticker_id": png.ID,
	}, 201)
	var ann struct {
		ID        int64  `json:"id"`
		StickerID *int64 `json:"sticker_id"`
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &ann)
	if ann.StickerID == nil || *ann.StickerID != png.ID {
		t.Fatalf("annotation sticker_id = %v, want %d", ann.StickerID, png.ID)
	}

	// Usage count reflects the attachment.
	one := decode[stickerRow](t, c.mustDo("PUT", fmt.Sprintf("/stickers/%d", png.ID),
		map[string]any{"name": "Wax Seal"}, 200))
	if one.Name != "Wax Seal" || one.Annotations != 1 {
		t.Fatalf("after rename: %+v (want name 'Wax Seal', 1 annotation)", one)
	}

	// Delete the attached sticker: the file goes away and the annotation keeps
	// its row but loses the reference (ON DELETE SET NULL).
	pngFile := filepath.Join(srv.coversDir(), png.Path)
	if _, err := os.Stat(pngFile); err != nil {
		t.Fatalf("sticker file missing before delete: %v", err)
	}
	c.mustDo("DELETE", fmt.Sprintf("/stickers/%d", png.ID), nil, 200)
	if _, err := os.Stat(pngFile); !os.IsNotExist(err) {
		t.Fatalf("sticker file should be gone after delete, stat err = %v", err)
	}
	anns := decode[struct {
		Annotations []struct {
			ID        int64  `json:"id"`
			StickerID *int64 `json:"sticker_id"`
		} `json:"annotations"`
	}](t, c.mustDo("GET", fmt.Sprintf("/annotations?book_id=%d", book), nil, 200))
	if len(anns.Annotations) != 1 || anns.Annotations[0].StickerID != nil {
		t.Fatalf("annotation should survive with null sticker_id: %+v", anns.Annotations)
	}
}

// TestStickerCrossUserGuard: a user cannot attach another user's sticker by
// guessing its id, and cannot rename/delete it.
func TestStickerCrossUserGuard(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	admin := signupAdmin(t, h)
	bob := addUser(t, h, admin, "bob")

	victim := uploadSticker(t, admin, "a.png", "admin sticker", pngMagic)

	// Bob attaching admin's sticker to his own annotation is a clean 400.
	book := createBook(t, bob, "Bob's Book")
	rec := bob.do("POST", "/annotations", map[string]any{
		"book_id": book, "quote": "not mine", "sticker_id": victim.ID,
	})
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("cross-user attach: got %d, want 400: %s", rec.Code, rec.Body)
	}
	// And he can't rename or delete it (scoped by user_id → 404).
	bob.mustDo("PUT", fmt.Sprintf("/stickers/%d", victim.ID), map[string]any{"name": "hijacked"}, http.StatusNotFound)
	bob.mustDo("DELETE", fmt.Sprintf("/stickers/%d", victim.ID), nil, http.StatusNotFound)
}
