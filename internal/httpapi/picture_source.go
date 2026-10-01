package httpapi

import (
	"encoding/json"
	"net/url"
	"sort"
	"strings"

	"tippani/internal/store"
)

// pictureSupplier is the supplier an image address belongs to, by its host, or
// `fallback` when the host names none. The hosts are the ones the app fetches
// pictures from (metadata/covers.go).
func pictureSupplier(rawURL, fallback string) string {
	u, err := url.Parse(strings.TrimSpace(rawURL))
	if err != nil || u.Host == "" {
		return fallback
	}
	host := strings.ToLower(u.Hostname())
	for _, h := range []struct{ suffix, slug string }{
		{"image.tmdb.org", "tmdb"}, {"thetvdb.com", "tvdb"}, {"covers.openlibrary.org", "openlibrary"},
		{"archive.org", "openlibrary"}, {"wikimedia.org", "wikimedia"}, {"wikipedia.org", "wikimedia"},
		{"images.igdb.com", "igdb"}, {"nocookie.net", "fandom"}, {"books.google.com", "google"},
		{"books.googleusercontent.com", "google"}, {"media-amazon.com", "amazon"}, {"images-amazon.com", "amazon"},
		{"m.media-amazon.com", "amazon"},
	} {
		if host == h.suffix || strings.HasSuffix(host, "."+h.suffix) {
			return h.slug
		}
	}
	return fallback
}

// pickedPictureSource is the source a client may name for a picture it took from
// a strip: a supplier the app asks for pictures, or, for anything else, the
// reader (a pasted address is their choice).
func pickedPictureSource(source string) string {
	switch s := strings.TrimSpace(source); s {
	case "tmdb", "tvdb", "openlibrary", "wikimedia", "igdb", "fandom", "google", "google-images", "amazon", "wikidata", "imdb":
		return s
	}
	return store.SourceManual
}

// linkSupplierFor is the supplier a person's fetched links come from, by the
// role the fetch asked as (lookupLinks' arms).
func linkSupplierFor(kind string) string {
	switch kind {
	case "author":
		return "openlibrary"
	case "studio", "publisher":
		return "igdb"
	}
	return "tmdb"
}

// readLinkSources parses the column. Empty or malformed is an empty map, never an
// error: a note must not fail the save it rides on.
func readLinkSources(raw string) map[string]string {
	out := map[string]string{}
	if strings.TrimSpace(raw) != "" {
		_ = json.Unmarshal([]byte(raw), &out)
	}
	return out
}

// linkTokens is every address a links field holds, as parseLinks reads them.
func linkTokens(text string) []string {
	p := parseLinks(text)
	var out []string
	for _, v := range p.known {
		out = append(out, v)
	}
	out = append(out, p.extra...)
	sort.Strings(out)
	return out
}

// relinkSources is the column's new value after `prev` became `next`: an address
// that was there keeps the source it had, a new one is credited to `by`, and one
// that went is forgotten. Compared, not assumed: every fact save re-sends an
// unchanged links field, and that changes nothing here.
func relinkSources(prev, next string, had map[string]string, by string) string {
	before := map[string]bool{}
	for _, t := range linkTokens(prev) {
		before[t] = true
	}
	out := map[string]string{}
	for _, t := range linkTokens(next) {
		if before[t] {
			if s := had[t]; s != "" {
				out[t] = s
			}
		} else if by != "" {
			out[t] = by
		}
	}
	if len(out) == 0 {
		return ""
	}
	b, _ := json.Marshal(out)
	return string(b)
}
