package metadata

import "testing"

// The provider image-URL builders pin the hi-res variants: storage fetches
// must never regress to thumbnail sizes (the "fetched covers are low-res" bug).
func TestHiResImageURLs(t *testing.T) {
	if got, want := TMDBPosterURL("/p.jpg"), "https://image.tmdb.org/t/p/original/p.jpg"; got != want {
		t.Errorf("TMDBPosterURL = %q, want %q", got, want)
	}
	if got := TMDBPosterURL(""); got != "" {
		t.Errorf("TMDBPosterURL(\"\") = %q, want empty", got)
	}
	if got, want := AmazonCoverURL("B00X"), "https://images-na.ssl-images-amazon.com/images/P/B00X.01.jpg"; got != want {
		t.Errorf("AmazonCoverURL = %q, want modifier-less original %q", got, want)
	}

	amazonCases := map[string]string{
		"https://m.media-amazon.com/images/I/x._SY300_.jpg":     "https://m.media-amazon.com/images/I/x.jpg",
		"https://m.media-amazon.com/images/I/x._AC_SX466_.jpg":  "https://m.media-amazon.com/images/I/x.jpg",
		"https://m.media-amazon.com/images/I/plain.jpg":         "https://m.media-amazon.com/images/I/plain.jpg",
		"https://books.google.com/books/content?id=1&zoom=1":    "https://books.google.com/books/content?id=1&zoom=1",
	}
	for in, want := range amazonCases {
		if got := AmazonFullSizeImage(in); got != want {
			t.Errorf("AmazonFullSizeImage(%q) = %q, want %q", in, got, want)
		}
	}

	// url.Values.Encode re-emits the query alphabetically; expectations match.
	googleCases := map[string]string{
		"https://books.google.com/books/content?id=1&printsec=frontcover&img=1&zoom=1": "https://books.google.com/books/content?fife=w1280-h1920&id=1&img=1&printsec=frontcover&zoom=1",
		"https://books.googleusercontent.com/books/content?id=2&fife=w100":             "https://books.googleusercontent.com/books/content?fife=w1280-h1920&id=2",
		"https://covers.openlibrary.org/b/id/1-L.jpg":                                  "https://covers.openlibrary.org/b/id/1-L.jpg",
		"https://m.media-amazon.com/images/I/x.jpg":                                    "https://m.media-amazon.com/images/I/x.jpg",
	}
	for in, want := range googleCases {
		if got := GoogleHiResCover(in); got != want {
			t.Errorf("GoogleHiResCover(%q) = %q, want %q", in, got, want)
		}
	}
}

// TVDB artwork URLs are full artworks.thetvdb.com URLs; the allowlist must
// admit them or every TVDB-sourced title silently saves without a poster.
// OL covers redirect through archive.org download nodes, so those hosts must
// pass too — every OL cover fetch used to die on the redirect hop.
func TestAllowedCoverHosts(t *testing.T) {
	for _, h := range []string{
		"artworks.thetvdb.com",
		"image.tmdb.org",
		"covers.openlibrary.org",
		"books.google.com",
		"books.googleusercontent.com",
		"images-na.ssl-images-amazon.com",
		"m.media-amazon.com",
		"archive.org",
		"ia800100.us.archive.org",
		"ia601604.us.archive.org",
	} {
		if !allowedCoverHost(h) {
			t.Errorf("allowedCoverHost(%q) = false, want true", h)
		}
	}
	for _, h := range []string{
		"evil.example",
		"ia800100.us.archive.org.evil.example",
		"notarchive.org",
	} {
		if allowedCoverHost(h) {
			t.Errorf("allowedCoverHost(%q) = true, want false", h)
		}
	}
}
