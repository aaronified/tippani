package httpapi

// The book's own EPUB as a source of its metadata.
//
// A file the reader attached to a book (sources.go) says what its publisher, year,
// series and subjects are — from the edition they actually hold, with no network, no
// key and no identity to look up. So it is a supplier like Google Books or Open
// Library, with the slug "epub":
//
//   - FILL GAPS uses it for whatever a book is missing. A book not pinned to any online
//     identity (which re-verify used to refuse with "no re-checkable identity") can be
//     filled from its own file; where an online source answered, the file fills what
//     that source left empty.
//   - THE FIELD PICKER offers it beside the other suppliers, at any time: a value the
//     file holds is one more choice for the field, not a replacement for the stored one.
//
// Nothing is written here. It builds a candidate and the existing re-verify, fill and
// apply paths do everything else, including crediting each field to "epub" so the
// provenance tag says where it came from.

import (
	"database/sql"
	"errors"

	"tippani/internal/ebook"
	"tippani/internal/metadata"
)

// epubSourceSlug is the supplier's name in the vocabulary (knownBookSource).
const epubSourceSlug = "epub"

// epubCandidate reads the EPUB attached to a book and returns what it says as a
// candidate, or nil when the book has none, the file is gone or it cannot be read.
// Any failure is quietly "no candidate": the file is an extra source and its absence
// must never make a re-verify fail.
func (s *Server) epubCandidate(uid, bookID int64) *metadata.BookCandidate {
	var path, format, origin, mountID string
	err := s.Store.DB.QueryRow(
		`SELECT path, format, origin, mount_id FROM work_sources
		 WHERE user_id = ? AND subject = 'book' AND subject_id = ? AND role = 'text'
		   AND pruned_at = '' AND path != ''`, uid, bookID).Scan(&path, &format, &origin, &mountID)
	if errors.Is(err, sql.ErrNoRows) || err != nil || format != "epub" {
		return nil
	}
	// A book attached from a mounted library is the common case, and its file is read through
	// the mount: an upload only is a feature that works for the files nobody uses.
	var data []byte
	if origin == "mount" {
		data, err = s.readMountedSource(mountID, path)
	} else {
		data, err = s.readSourceFile(path)
	}
	if err != nil {
		return nil
	}
	m, err := ebook.ReadMeta(data)
	if err != nil {
		return nil
	}
	return candidateFromEPUB(m)
}

// candidateFromEPUB maps what an EPUB says onto a book candidate. The ISBN is
// normalised to the library's form (ISBN-13, no hyphens); an ISBN-10 is converted.
func candidateFromEPUB(m ebook.Meta) *metadata.BookCandidate {
	c := &metadata.BookCandidate{
		Source:        epubSourceSlug,
		Title:         m.Title,
		Author:        m.Creator,
		Description:   m.Description,
		PublishedYear: m.Year,
		Genres:        m.Subjects,
		Series:        m.Series,
		SeriesIndex:   m.SeriesIndex,
		Publisher:     m.Publisher,
	}
	for _, raw := range m.ISBNs {
		if n := metadata.NormalizeISBN(raw); n != "" {
			c.ISBN13 = n
			break
		}
	}
	return c
}

// fillFromEPUB gives an online candidate the file's values for the fields it left
// empty, crediting each to the file (Sources names a supplier other than the
// candidate's own, which is how the field is then tagged with where it came from).
// It never overwrites: an online answer that has a value keeps it, and the file's
// own value for that field is still on offer as an alternative.
func fillFromEPUB(c, ep *metadata.BookCandidate) {
	credit := func(field string) {
		if c.Sources == nil {
			c.Sources = map[string]string{}
		}
		c.Sources[field] = epubSourceSlug
	}
	if c.Author == "" && ep.Author != "" {
		c.Author = ep.Author
		credit("author")
	}
	if c.Description == "" && ep.Description != "" {
		c.Description = ep.Description
		credit("description")
	}
	if c.PublishedYear == 0 && ep.PublishedYear != 0 {
		c.PublishedYear = ep.PublishedYear
		credit("published_year")
	}
	if len(c.Genres) == 0 && len(ep.Genres) > 0 {
		c.Genres = ep.Genres
		credit("genres")
	}
	if c.Series == "" && ep.Series != "" {
		c.Series = ep.Series
		credit("series")
	}
	if c.SeriesIndex == 0 && ep.SeriesIndex != 0 {
		c.SeriesIndex = ep.SeriesIndex
		credit("series_index")
	}
	if c.Publisher == "" && ep.Publisher != "" {
		c.Publisher = ep.Publisher
		credit("publisher")
	}
	if c.ISBN13 == "" && ep.ISBN13 != "" {
		c.ISBN13 = ep.ISBN13
		credit("isbn")
	}
}
