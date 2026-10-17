package metadata

import (
	"os"
	"path/filepath"
	"regexp"
	"testing"
)

// A tiny but real PNG: under the placeholder floor, which a signature may be.
var tinyPNG = []byte("\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc`\x00\x00\x00\x02\x00\x01H\xaf\xa4q\x00\x00\x00\x00IEND\xaeB`\x82")

func TestStoreSignatureSharesIdenticalBytes(t *testing.T) {
	dir := t.TempDir()
	a, err := StoreSignature(tinyPNG, dir)
	if err != nil {
		t.Fatalf("store: %v", err)
	}
	b, err := StoreSignature(tinyPNG, dir)
	if err != nil {
		t.Fatalf("store again: %v", err)
	}
	if a != b {
		t.Errorf("same bytes stored as %q then %q, want one shared file", a, b)
	}
	if !regexp.MustCompile(`^[0-9a-f]{16}\.png$`).MatchString(a) {
		t.Errorf("name %q does not match what the server serves", a)
	}
	if entries, _ := os.ReadDir(dir); len(entries) != 1 {
		t.Errorf("directory holds %d files, want 1", len(entries))
	}
}

func TestStoreSignatureNameTakenByOtherBytes(t *testing.T) {
	dir := t.TempDir()
	name, err := StoreSignature(tinyPNG, dir)
	if err != nil {
		t.Fatal(err)
	}
	// Someone else's different bytes sit under the name these bytes hash to.
	if err := os.WriteFile(filepath.Join(dir, name), []byte("other reader's file"), 0o644); err != nil {
		t.Fatal(err)
	}
	got, err := StoreSignature(tinyPNG, dir)
	if err != nil {
		t.Fatal(err)
	}
	if got == name {
		t.Fatalf("took the name %q held by different bytes", name)
	}
	if have, _ := os.ReadFile(filepath.Join(dir, name)); string(have) != "other reader's file" {
		t.Errorf("the other file was overwritten: %q", have)
	}
}

func TestStoreSignatureRefuses(t *testing.T) {
	dir := t.TempDir()
	for name, data := range map[string][]byte{
		"a JPEG":         []byte("\xff\xd8\xff\xe0" + string(make([]byte, 800))),
		"garbage":        []byte("not an image at all"),
		"a scripted SVG": []byte(`<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script></svg>`),
	} {
		if n, err := StoreSignature(data, dir); err == nil {
			t.Errorf("%s was stored as %q", name, n)
		}
	}
}
