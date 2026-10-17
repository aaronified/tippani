package metadata

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"os"
	"path/filepath"
)

// StoreSignature writes a signature image into destDir and answers its name.
//
// NAMED BY ITS BYTES, NOT AT RANDOM, which is the one way it differs from
// StoreImage: the first sixteen hex digits of the SHA-256 of what is written. Two
// readers who hold the same signature (a famous one, fetched from Wikidata by
// both) then share one file, where a random name would keep a copy each. Sixteen
// because every stored picture has to match the name the server serves and the
// bin parks (coverFile in internal/httpapi); a longer name would 404.
//
// A name already taken by DIFFERENT bytes gets a random one instead, so a
// collision costs a second file and never one reader's signature replacing
// another's. The file is written under a temp name and renamed whole, as every
// other picture is.
//
// What it accepts is narrower than StoreImage: the PNG internal/signature
// produces, or an SVG that passes the same script check as a sticker. A cleaned
// signature is small by nature and legitimately falls under the placeholder floor
// that rejects a tracking pixel, so that floor is not applied to it.
func StoreSignature(data []byte, destDir string) (string, error) {
	var ext string
	switch ct := sniffImageType(data); ct {
	case "image/png":
		if len(data) == 0 {
			return "", errors.New("empty image")
		}
		if len(data) > maxImageBytes {
			return "", errors.New("image too large")
		}
		ext = imageExt[ct]
	case "image/svg+xml":
		e, err := checkImage(data, maxImageBytes)
		if err != nil {
			return "", err
		}
		ext = e
	default:
		return "", errors.New("a signature is stored as a PNG or an SVG")
	}

	sum := sha256.Sum256(data)
	name := hex.EncodeToString(sum[:8]) + ext
	final := filepath.Join(destDir, name)
	if have, err := os.ReadFile(final); err == nil {
		if bytes.Equal(have, data) {
			return name, nil // someone already stored exactly this
		}
		if name, err = imageName(ext); err != nil {
			return "", err
		}
		final = filepath.Join(destDir, name)
	}

	tmp, err := os.CreateTemp(destDir, DownloadPrefix+"*")
	if err != nil {
		return "", err
	}
	if _, err := tmp.Write(data); err != nil {
		_ = tmp.Close()
		_ = os.Remove(tmp.Name())
		return "", err
	}
	if err := promote(tmp, final); err != nil {
		_ = tmp.Close()
		_ = os.Remove(tmp.Name())
		return "", err
	}
	return name, nil
}
