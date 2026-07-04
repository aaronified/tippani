package metadata

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"strings"
)

// Test seams: real endpoints in production, httptest servers in tests.
var (
	googleBase      = "https://www.googleapis.com"
	openLibraryBase = "https://openlibrary.org"
)

// maxBookCandidates caps the merged list — the user picks from a short
// candidate list (PLAN §6); more is noise.
const maxBookCandidates = 8

// ErrQuota signals Google Books answered 429 — the shared anonymous daily
// quota is exhausted. Google gives every keyless caller one global quota, so
// this is common. The handler turns it into a "add a free key in Settings"
// hint rather than a generic failure.
var ErrQuota = errors.New("google books daily quota exceeded (429)")

type BookCandidate struct {
	Source        string   `json:"source"` // "google" | "openlibrary"
	SourceID      string   `json:"source_id"`
	Title         string   `json:"title"`
	Author        string   `json:"author"`
	ISBN13        string   `json:"isbn13"`
	Description   string   `json:"description"`
	PublishedYear int      `json:"published_year"`
	Genres        []string `json:"genres"`
	CoverURL      string   `json:"cover_url"`
}

// SearchBooks queries Google Books (isbn: or intitle:) and Open Library (by
// ISBN or by title) and merges the candidates. Best-effort: results from any
// source win. When no source returns a candidate, whichever error explains the
// emptiness is surfaced — notably ErrQuota, so the UI can point at the key
// field. isbn should already be normalized (PLAN §3). googleKey is the optional
// settings-managed Google Books API key (PLAN §6); "" stays anonymous.
func SearchBooks(ctx context.Context, isbn, title, googleKey string) ([]BookCandidate, error) {
	q := "intitle:" + title
	if isbn != "" {
		q = "isbn:" + isbn
	}

	out, gErr := searchGoogle(ctx, q, googleKey)

	// Open Library is a keyless fallback — vital when Google is quota-blocked.
	// Query it by ISBN when we have one, otherwise by title.
	var ol []BookCandidate
	var olErr error
	if isbn != "" {
		ol, olErr = searchOpenLibrary(ctx, url.Values{"isbn": {isbn}}, isbn)
	} else {
		ol, olErr = searchOpenLibrary(ctx, url.Values{"title": {title}}, "")
	}
	out = append(out, ol...)

	if len(out) == 0 {
		// Nothing found. Surface an error so the handler can explain (the quota
		// case especially); a clean empty result stays a non-error empty list.
		if gErr != nil {
			return nil, gErr
		}
		if olErr != nil {
			return nil, olErr
		}
	}
	if len(out) > maxBookCandidates {
		out = out[:maxBookCandidates]
	}
	return out, nil
}

func searchGoogle(ctx context.Context, q, key string) ([]BookCandidate, error) {
	u := googleBase + "/books/v1/volumes?q=" + url.QueryEscape(q)
	if key != "" { // optional API key raises the ~1,000/day courtesy quota
		u += "&key=" + url.QueryEscape(key)
	}
	body, status, err := httpGet(ctx, u, "")
	if err != nil {
		return nil, fmt.Errorf("google books: %w", err)
	}
	if status == 429 { // shared anonymous quota blown — the common keyless failure
		return nil, fmt.Errorf("google books: %w", ErrQuota)
	}
	if status != 200 {
		return nil, fmt.Errorf("google books: status %d", status)
	}
	var r struct {
		Items []struct {
			ID         string `json:"id"`
			VolumeInfo struct {
				Title               string   `json:"title"`
				Authors             []string `json:"authors"`
				Description         string   `json:"description"`
				PublishedDate       string   `json:"publishedDate"`
				Categories          []string `json:"categories"`
				IndustryIdentifiers []struct {
					Type       string `json:"type"`
					Identifier string `json:"identifier"`
				} `json:"industryIdentifiers"`
				// Google returns whichever sizes it has; prefer the largest.
				ImageLinks googleImageLinks `json:"imageLinks"`
			} `json:"volumeInfo"`
		} `json:"items"`
	}
	if err := json.Unmarshal(body, &r); err != nil {
		return nil, fmt.Errorf("google books: %w", err)
	}
	var out []BookCandidate
	for _, it := range r.Items {
		vi := it.VolumeInfo
		var isbn13, isbn10 string
		for _, id := range vi.IndustryIdentifiers {
			switch id.Type {
			case "ISBN_13":
				isbn13 = id.Identifier
			case "ISBN_10":
				isbn10 = id.Identifier
			}
		}
		if isbn13 == "" {
			isbn13 = NormalizeISBN(isbn10) // "" in, "" out
		}
		out = append(out, BookCandidate{
			Source:        "google",
			SourceID:      it.ID,
			Title:         vi.Title,
			Author:        strings.Join(vi.Authors, ", "),
			ISBN13:        isbn13,
			Description:   vi.Description,
			PublishedYear: leadingYear(vi.PublishedDate),
			Genres:        vi.Categories,
			CoverURL:      bestGoogleCover(vi.ImageLinks),
		})
	}
	return out, nil
}

// googleImageLinks is Google Books' imageLinks block; sizes present vary per
// volume (search hits usually carry only smallThumbnail/thumbnail).
type googleImageLinks struct {
	SmallThumbnail string `json:"smallThumbnail"`
	Thumbnail      string `json:"thumbnail"`
	Small          string `json:"small"`
	Medium         string `json:"medium"`
	Large          string `json:"large"`
	ExtraLarge     string `json:"extraLarge"`
}

// bestGoogleCover picks the largest image Google returned. Search results
// usually carry only a thumbnail; the &edge=curl page-curl overlay is stripped
// so the stored cover is a clean front cover.
func bestGoogleCover(l googleImageLinks) string {
	for _, u := range []string{l.ExtraLarge, l.Large, l.Medium, l.Small, l.Thumbnail, l.SmallThumbnail} {
		if u != "" {
			return httpsURL(strings.Replace(u, "&edge=curl", "", 1))
		}
	}
	return ""
}

// searchOpenLibrary queries OL's search.json with the given params (isbn= or
// title=). isbnEcho is stamped onto candidates when the query was by ISBN (OL
// docs don't echo the queried ISBN back).
func searchOpenLibrary(ctx context.Context, params url.Values, isbnEcho string) ([]BookCandidate, error) {
	params.Set("fields", "key,title,author_name,first_publish_year,cover_i,subject")
	params.Set("limit", "5")
	u := openLibraryBase + "/search.json?" + params.Encode()
	body, status, err := httpGet(ctx, u, "")
	if err != nil {
		return nil, fmt.Errorf("open library: %w", err)
	}
	if status != 200 {
		return nil, fmt.Errorf("open library: status %d", status)
	}
	var r struct {
		Docs []struct {
			Key              string   `json:"key"`
			Title            string   `json:"title"`
			AuthorName       []string `json:"author_name"`
			FirstPublishYear int      `json:"first_publish_year"`
			CoverI           int64    `json:"cover_i"`
			Subject          []string `json:"subject"`
		} `json:"docs"`
	}
	if err := json.Unmarshal(body, &r); err != nil {
		return nil, fmt.Errorf("open library: %w", err)
	}
	var out []BookCandidate
	for _, d := range r.Docs {
		genres := d.Subject
		if len(genres) > 6 { // subjects are noisy folksonomy; keep the head
			genres = genres[:6]
		}
		var cover string
		if d.CoverI != 0 {
			cover = fmt.Sprintf("https://covers.openlibrary.org/b/id/%d-L.jpg", d.CoverI)
		}
		out = append(out, BookCandidate{
			Source:        "openlibrary",
			SourceID:      d.Key,
			Title:         d.Title,
			Author:        strings.Join(d.AuthorName, ", "),
			ISBN13:        isbnEcho, // OL docs don't echo the queried ISBN back
			PublishedYear: d.FirstPublishYear,
			Genres:        genres,
			CoverURL:      cover,
		})
	}
	return out, nil
}
