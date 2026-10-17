package signature

import (
	"bytes"
	"errors"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"math"
	"math/rand"
	"testing"
)

// A "signature" here is a looping stroke stamped with discs, which gives a known
// set of ink pixels to measure the cleaner against: how much of it survives, and
// how much of everything else it lets through.
const sw, sh = 600, 240

func strokeMask() []bool {
	m := make([]bool, sw*sh)
	for i := 0; i < 2400; i++ {
		t := float64(i) / 2400 * 6 * math.Pi
		cx := 60 + float64(i)/2400*480
		cy := 120 + 55*math.Sin(t) + 20*math.Sin(3*t)
		for dy := -3; dy <= 3; dy++ {
			for dx := -3; dx <= 3; dx++ {
				if dx*dx+dy*dy > 9 {
					continue
				}
				x, y := int(cx)+dx, int(cy)+dy
				if x >= 0 && x < sw && y >= 0 && y < sh {
					m[y*sw+x] = true
				}
			}
		}
	}
	return m
}

func count(m []bool) int {
	n := 0
	for _, v := range m {
		if v {
			n++
		}
	}
	return n
}

// paint draws the stroke over paper(x, y) in the given ink and returns the image.
func paint(paper func(x, y int) color.NRGBA, ink color.NRGBA) *image.NRGBA {
	img := image.NewNRGBA(image.Rect(0, 0, sw, sh))
	m := strokeMask()
	for y := 0; y < sh; y++ {
		for x := 0; x < sw; x++ {
			if m[y*sw+x] {
				img.SetNRGBA(x, y, ink)
			} else {
				img.SetNRGBA(x, y, paper(x, y))
			}
		}
	}
	return img
}

func encodePNG(t *testing.T, img image.Image) []byte {
	t.Helper()
	var b bytes.Buffer
	if err := png.Encode(&b, img); err != nil {
		t.Fatal(err)
	}
	return b.Bytes()
}

// measure cleans data and reports the cleaned ink's pixel count against the
// source stroke's: ~1 means the ink was kept and nothing else came with it.
func measure(t *testing.T, data []byte, strength float64) (kept float64, bounds image.Rectangle) {
	t.Helper()
	out, err := Clean(data, strength)
	if err != nil {
		t.Fatalf("Clean: %v", err)
	}
	img, err := png.Decode(bytes.NewReader(out))
	if err != nil {
		t.Fatal(err)
	}
	b := img.Bounds()
	n := 0
	for y := b.Min.Y; y < b.Max.Y; y++ {
		for x := b.Min.X; x < b.Max.X; x++ {
			if _, _, _, a := img.At(x, y).RGBA(); a>>8 > 128 {
				n++
			}
		}
	}
	return float64(n) / float64(count(strokeMask())), b
}

func within(t *testing.T, name string, got float64) {
	t.Helper()
	if got < 0.9 || got > 1.15 {
		t.Errorf("%s: cleaned ink is %.2f of the stroke, want 0.9–1.15 (kept it all, kept only it)", name, got)
	}
}

func TestCleanKeepsInkAndClearsPaper(t *testing.T) {
	dark := color.NRGBA{20, 20, 60, 255}

	t.Run("plain white paper", func(t *testing.T) {
		img := paint(func(x, y int) color.NRGBA { return color.NRGBA{250, 250, 250, 255} }, dark)
		k, b := measure(t, encodePNG(t, img), DefaultStrength)
		within(t, "plain", k)
		if b.Dx() > sw || b.Dy() > sh {
			t.Errorf("output %v larger than the capture", b)
		}
		if b.Dx() > 520 || b.Dy() > 170 {
			t.Errorf("output %v is not cropped to the ink", b)
		}
	})

	t.Run("uneven light across the page", func(t *testing.T) {
		// Left edge in shadow, right edge bright: a fixed threshold would read the
		// whole shaded half as ink.
		img := paint(func(x, y int) color.NRGBA {
			v := uint8(120 + 125*x/sw)
			return color.NRGBA{v, v, v, 255}
		}, color.NRGBA{10, 10, 10, 255})
		k, _ := measure(t, encodePNG(t, img), DefaultStrength)
		within(t, "shadow", k)
	})

	t.Run("photographed paper with grain, as a JPEG", func(t *testing.T) {
		rng := rand.New(rand.NewSource(1))
		img := paint(func(x, y int) color.NRGBA {
			v := uint8(200 + 40*x/sw + rng.Intn(14))
			return color.NRGBA{v, v - 6, v - 18, 255}
		}, color.NRGBA{25, 30, 70, 255})
		var b bytes.Buffer
		if err := jpeg.Encode(&b, img, &jpeg.Options{Quality: 80}); err != nil {
			t.Fatal(err)
		}
		k, _ := measure(t, b.Bytes(), DefaultStrength)
		within(t, "jpeg", k)
	})

	t.Run("lined paper", func(t *testing.T) {
		img := paint(func(x, y int) color.NRGBA {
			if y%30 == 0 {
				return color.NRGBA{190, 205, 230, 255}
			}
			return color.NRGBA{248, 246, 238, 255}
		}, dark)
		k, _ := measure(t, encodePNG(t, img), DefaultStrength)
		within(t, "lined", k)
	})

	t.Run("a transparent PNG is paper, not ink", func(t *testing.T) {
		img := paint(func(x, y int) color.NRGBA { return color.NRGBA{} }, color.NRGBA{0, 0, 0, 255})
		k, _ := measure(t, encodePNG(t, img), DefaultStrength)
		within(t, "transparent", k)
	})
}

func TestStrengthMovesTheCut(t *testing.T) {
	// A pale stroke on paper: the default may lose it, a higher strength keeps it.
	img := paint(func(x, y int) color.NRGBA { return color.NRGBA{245, 245, 245, 255} },
		color.NRGBA{150, 150, 150, 255})
	data := encodePNG(t, img)
	lo, _ := measure(t, data, 0.1)
	hi, _ := measure(t, data, 0.9)
	if hi < lo {
		t.Errorf("strength 0.9 kept %.2f of the stroke, 0.1 kept %.2f; more strength must not keep less", hi, lo)
	}
}

func TestCleanRefuses(t *testing.T) {
	blank := image.NewNRGBA(image.Rect(0, 0, 200, 100))
	for i := range blank.Pix {
		blank.Pix[i] = 255
	}
	if _, err := Clean(encodePNG(t, blank), DefaultStrength); !errors.Is(err, ErrNoInk) {
		t.Errorf("blank paper: err = %v, want ErrNoInk", err)
	}
	if _, err := Clean([]byte("RIFF....WEBPVP8 "), DefaultStrength); !errors.Is(err, ErrUnsupported) {
		t.Errorf("WebP bytes: err = %v, want ErrUnsupported", err)
	}
	if _, err := Clean([]byte("not an image"), DefaultStrength); !errors.Is(err, ErrUnsupported) {
		t.Errorf("garbage: err = %v, want ErrUnsupported", err)
	}
}
