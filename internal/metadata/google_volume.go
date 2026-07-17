package metadata

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"strings"
)

// FetchGoogleVolume fetches ONE Google Books volume by its pinned id — the
// re-verify path for a book that carries a google_id but no ISBN/ASIN, so the
// lookup targets the exact edition instead of re-guessing by title. Mapped
// exactly like a searchGoogle item; key is the optional settings-managed
// Google Books key ("" stays anonymous).
func FetchGoogleVolume(ctx context.Context, id, key string) (*BookCandidate, error) {
	u := googleBase + "/books/v1/volumes/" + url.PathEscape(id)
	if key != "" {
		u += "?key=" + url.QueryEscape(key)
	}
	body, status, err := httpGet(ctx, u, "")
	if err != nil {
		return nil, fmt.Errorf("google books: %w", err)
	}
	if status == 429 {
		return nil, fmt.Errorf("google books: %w", ErrQuota)
	}
	if status == 404 {
		return nil, fmt.Errorf("google books: volume %q not found", id)
	}
	if status != 200 {
		return nil, fmt.Errorf("google books: status %d", status)
	}
	var r struct {
		ID         string `json:"id"`
		VolumeInfo struct {
			Title               string   `json:"title"`
			Subtitle            string   `json:"subtitle"`
			Authors             []string `json:"authors"`
			Description         string   `json:"description"`
			PublishedDate       string   `json:"publishedDate"`
			Categories          []string `json:"categories"`
			IndustryIdentifiers []struct {
				Type       string `json:"type"`
				Identifier string `json:"identifier"`
			} `json:"industryIdentifiers"`
			ImageLinks googleImageLinks `json:"imageLinks"`
		} `json:"volumeInfo"`
	}
	if err := json.Unmarshal(body, &r); err != nil {
		return nil, fmt.Errorf("google books: %w", err)
	}
	vi := r.VolumeInfo
	var isbn13, isbn10 string
	for _, ident := range vi.IndustryIdentifiers {
		switch ident.Type {
		case "ISBN_13":
			isbn13 = ident.Identifier
		case "ISBN_10":
			isbn10 = ident.Identifier
		}
	}
	if isbn13 == "" {
		isbn13 = NormalizeISBN(isbn10)
	}
	gName, gIdx := deriveSeriesFromTitle(vi.Title, vi.Subtitle)
	return &BookCandidate{
		Source:        "google",
		SourceID:      r.ID,
		Title:         vi.Title,
		Author:        strings.Join(vi.Authors, ", "),
		ISBN13:        isbn13,
		Description:   vi.Description,
		PublishedYear: leadingYear(vi.PublishedDate),
		Genres:        vi.Categories,
		CoverURL:      bestGoogleCover(vi.ImageLinks),
		Series:        gName,
		SeriesIndex:   gIdx,
	}, nil
}
