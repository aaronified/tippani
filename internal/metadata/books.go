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

// SearchBooks queries Google Books (isbn: or intitle:) and, when an ISBN is
// given, Open Library too. Best-effort merge: a source failing is only an
// error if every queried source fails — one good candidate list beats none.
// isbn should already be normalized (PLAN §3).
func SearchBooks(ctx context.Context, isbn, title string) ([]BookCandidate, error) {
	q := "intitle:" + title
	if isbn != "" {
		q = "isbn:" + isbn
	}

	out, gErr := searchGoogle(ctx, q)
	var olErr error
	if isbn != "" {
		var ol []BookCandidate
		ol, olErr = searchOpenLibrary(ctx, isbn)
		out = append(out, ol...)
	}
	if gErr != nil && (isbn == "" || olErr != nil) {
		return nil, errors.Join(gErr, olErr)
	}
	if len(out) > maxBookCandidates {
		out = out[:maxBookCandidates]
	}
	return out, nil
}

func searchGoogle(ctx context.Context, q string) ([]BookCandidate, error) {
	body, status, err := httpGet(ctx, googleBase+"/books/v1/volumes?q="+url.QueryEscape(q), "")
	if err != nil {
		return nil, fmt.Errorf("google books: %w", err)
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
				ImageLinks struct {
					Thumbnail string `json:"thumbnail"`
				} `json:"imageLinks"`
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
			CoverURL:      httpsURL(vi.ImageLinks.Thumbnail),
		})
	}
	return out, nil
}

func searchOpenLibrary(ctx context.Context, isbn string) ([]BookCandidate, error) {
	u := openLibraryBase + "/search.json?isbn=" + url.QueryEscape(isbn) +
		"&fields=key,title,author_name,first_publish_year,cover_i,subject&limit=3"
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
			ISBN13:        isbn, // the lookup key; OL docs don't echo it back
			PublishedYear: d.FirstPublishYear,
			Genres:        genres,
			CoverURL:      cover,
		})
	}
	return out, nil
}
