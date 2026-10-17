// Package signature turns a photographed or scanned signature into ink on a
// transparent ground, so the card it is drawn on can tint it to any theme.
//
// Standard library only, on purpose: go.mod requires no image module and this adds
// none. The price is that WebP cannot be decoded here (the stdlib has no decoder),
// so a WebP is refused with a sentence rather than stored uncleaned.
//
// The steps, each answering one way a capture goes wrong:
//
//	flatten onto white   a transparent PNG's paper would otherwise read as ink
//	greyscale            colour carries nothing a pen did not put there
//	divide by a wide blur   uneven light (a shadow across the page) becomes even
//	Otsu threshold       the split between paper and ink, found rather than guessed
//	ink as alpha         a soft edge, so the stroke is not a staircase when scaled
package signature

import (
	"bytes"
	"errors"
	"image"
	"image/color"
	"image/gif"
	"image/jpeg"
	"image/png"
	"math"
)

// MaxPixels bounds a decode. A signature photographed at 12 megapixels is fine; a
// decompression bomb is not, and DecodeConfig answers before any pixel is allocated.
const MaxPixels = 40_000_000

// workWidth is the longest side the cleaner works at. A signature's detail is in
// its stroke width, not its pixel count, and the blur below is a cost per pixel.
const workWidth = 1600

// DefaultStrength is the ink-strength slider's resting place: Otsu's own split.
const DefaultStrength = 0.5

var (
	// ErrUnsupported is a format the standard library cannot read.
	ErrUnsupported = errors.New("only PNG, JPEG and GIF images can be cleaned")
	// ErrNoInk is a capture with nothing in it to keep.
	ErrNoInk = errors.New("no ink found in this image")
	// ErrTooMuchInk is a capture where most of the picture is "ink" — a dark photo,
	// or an inverted scan — which no threshold turns into a signature.
	ErrTooMuchInk = errors.New("most of this image reads as ink; try a photo of dark ink on light paper")
	// ErrTooLarge is a picture past MaxPixels.
	ErrTooLarge = errors.New("image is too large to clean")
)

// Clean decodes data and returns a PNG of the ink alone, cropped to it, black on
// transparent. strength is the ink-strength slider in [0,1]: higher keeps fainter
// strokes (and more paper grain), lower keeps only the darkest.
func Clean(data []byte, strength float64) ([]byte, error) {
	cfg, _, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil {
		return nil, ErrUnsupported
	}
	if cfg.Width <= 0 || cfg.Height <= 0 || cfg.Width*cfg.Height > MaxPixels {
		return nil, ErrTooLarge
	}
	img, err := decode(data)
	if err != nil {
		return nil, ErrUnsupported
	}
	out, err := cleanImage(img, strength)
	if err != nil {
		return nil, err
	}
	var buf bytes.Buffer
	if err := (&png.Encoder{CompressionLevel: png.BestCompression}).Encode(&buf, out); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func decode(data []byte) (image.Image, error) {
	switch {
	case bytes.HasPrefix(data, []byte("\x89PNG")):
		return png.Decode(bytes.NewReader(data))
	case bytes.HasPrefix(data, []byte{0xFF, 0xD8}):
		return jpeg.Decode(bytes.NewReader(data))
	case bytes.HasPrefix(data, []byte("GIF8")):
		return gif.Decode(bytes.NewReader(data))
	}
	return nil, ErrUnsupported
}

func cleanImage(src image.Image, strength float64) (*image.NRGBA, error) {
	if strength < 0 {
		strength = 0
	}
	if strength > 1 {
		strength = 1
	}
	grey := flattenToGrey(src)
	w, h := grey.w, grey.h

	// A wide blur is the paper's own tone, shadows and all. Wider than any stroke,
	// or the blur would follow the ink and divide it away.
	r := max(12, min(w, h)/6)
	bg := boxBlur(grey, r)

	norm := make([]uint8, len(grey.pix))
	for i, v := range grey.pix {
		b := bg[i]
		if b < 1 {
			b = 1
		}
		n := float32(v) / b * 255
		if n > 255 {
			n = 255
		}
		norm[i] = uint8(n)
	}

	t := otsu(norm)
	// Strength moves the cut by up to 40 grey levels either way. Otsu is the
	// midpoint; the slider is for the capture Otsu reads wrong, not a second guess.
	cut := t + (strength-DefaultStrength)*80
	const soft = 24.0 // grey levels over which a stroke's edge fades

	minX, minY, maxX, maxY := w, h, -1, -1
	alpha := make([]uint8, len(norm))
	ink := 0
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			a := (cut - float64(norm[y*w+x])) / soft
			if a <= 0 {
				continue
			}
			if a > 1 {
				a = 1
			}
			av := uint8(math.Round(a * 255))
			alpha[y*w+x] = av
			if av > 32 {
				ink++
				minX, maxX = min(minX, x), max(maxX, x)
				minY, maxY = min(minY, y), max(maxY, y)
			}
		}
	}
	if ink == 0 || maxX < 0 {
		return nil, ErrNoInk
	}
	if ink*2 > w*h {
		return nil, ErrTooMuchInk
	}

	const pad = 4
	minX, minY = max(0, minX-pad), max(0, minY-pad)
	maxX, maxY = min(w-1, maxX+pad), min(h-1, maxY+pad)
	out := image.NewNRGBA(image.Rect(0, 0, maxX-minX+1, maxY-minY+1))
	for y := minY; y <= maxY; y++ {
		for x := minX; x <= maxX; x++ {
			if a := alpha[y*w+x]; a > 0 {
				out.SetNRGBA(x-minX, y-minY, color.NRGBA{A: a})
			}
		}
	}
	return out, nil
}

type greyImage struct {
	w, h int
	pix  []uint8
}

// flattenToGrey lays the picture over white (so transparency is paper, not ink),
// reduces it to luminance and shrinks it to workWidth by area-averaging.
func flattenToGrey(src image.Image) greyImage {
	b := src.Bounds()
	sw, sh := b.Dx(), b.Dy()
	scale := 1
	for sw/scale > workWidth || sh/scale > workWidth {
		scale++
	}
	w, h := sw/scale, sh/scale
	if w < 1 {
		w = 1
	}
	if h < 1 {
		h = 1
	}
	pix := make([]uint8, w*h)
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			var sum, n float64
			for dy := 0; dy < scale; dy++ {
				for dx := 0; dx < scale; dx++ {
					r, g, bl, a := src.At(b.Min.X+x*scale+dx, b.Min.Y+y*scale+dy).RGBA()
					// Premultiplied 16-bit; add the white that shows through.
					white := 0xffff - a
					lum := 0.2126*float64(r+white) + 0.7152*float64(g+white) + 0.0722*float64(bl+white)
					sum += lum / 257
					n++
				}
			}
			v := sum / n
			if v > 255 {
				v = 255
			}
			pix[y*w+x] = uint8(v)
		}
	}
	return greyImage{w: w, h: h, pix: pix}
}

// boxBlur is a separable box blur through running sums, so its cost does not grow
// with the radius. Edges clamp to the nearest pixel.
func boxBlur(g greyImage, r int) []float32 {
	w, h := g.w, g.h
	tmp := make([]float32, w*h)
	out := make([]float32, w*h)
	win := float32(2*r + 1)
	for y := 0; y < h; y++ {
		row := g.pix[y*w : (y+1)*w]
		var sum float32
		for i := -r; i <= r; i++ {
			sum += float32(row[clamp(i, 0, w-1)])
		}
		for x := 0; x < w; x++ {
			tmp[y*w+x] = sum / win
			sum += float32(row[clamp(x+r+1, 0, w-1)]) - float32(row[clamp(x-r, 0, w-1)])
		}
	}
	for x := 0; x < w; x++ {
		var sum float32
		for i := -r; i <= r; i++ {
			sum += tmp[clamp(i, 0, h-1)*w+x]
		}
		for y := 0; y < h; y++ {
			out[y*w+x] = sum / win
			sum += tmp[clamp(y+r+1, 0, h-1)*w+x] - tmp[clamp(y-r, 0, h-1)*w+x]
		}
	}
	return out
}

func clamp(v, lo, hi int) int {
	if v < lo {
		return lo
	}
	if v > hi {
		return hi
	}
	return v
}

// otsu is the grey level that best separates two populations. Otsu's own answer is
// the class boundary that maximises the variance between them, but with paper at
// 255 and ink at one flat level every boundary from that level up ties, and the
// first of them sits ON the ink, keeping none of it. The midpoint of the two
// class means at the best split is the same idea without the tie.
func otsu(pix []uint8) float64 {
	var hist [256]float64
	for _, v := range pix {
		hist[v]++
	}
	total := float64(len(pix))
	var sumAll float64
	for i, c := range hist {
		sumAll += float64(i) * c
	}
	var sumB, wB, best float64
	cut := 128.0
	for t := 0; t < 256; t++ {
		wB += hist[t]
		if wB == 0 {
			continue
		}
		wF := total - wB
		if wF == 0 {
			break
		}
		sumB += float64(t) * hist[t]
		mB, mF := sumB/wB, (sumAll-sumB)/wF
		if v := wB * wF * (mB - mF) * (mB - mF); v > best {
			best, cut = v, (mB+mF)/2
		}
	}
	return cut
}
