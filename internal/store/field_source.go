package store

// Where each field came from.
//
// SEE migrations/0054_field_source.sql for why the table is sparse, why nothing
// is backfilled, and why there is no history. This file is the two operations
// that go with it and one rule about which fields are worth recording.

import (
	"database/sql"
	"sort"
	"strings"
)

// FieldSource is one answer: which supplier last wrote a field, and when.
type FieldSource struct {
	Field    string `json:"field"`
	Source   string `json:"source"`
	SourceID string `json:"source_id,omitempty"`
	At       string `json:"at"`
}

// SourceManual is what a field the reader typed themselves is recorded as.
//
// IT IS A REAL ANSWER AND NOT THE ABSENCE OF ONE. A field with no row means "we
// do not know" — every field of every library that existed before this table did,
// and every field nothing has written since. A field marked manual means somebody
// looked at it and decided. Collapsing those two into "not from a supplier" would
// make the reader's own work indistinguishable from a gap, which is the one
// distinction this table exists to draw.
const SourceManual = "manual"

// recordableFields is the whitelist, and it is a whitelist because the
// alternative silently records whatever a caller happens to pass.
//
// WHAT IS ABSENT AND WHY. `source_metadata` is a provider blob rather than a
// field a reader sees. `cast_json` is superseded by work_cast, which carries its
// own per-row source already. The id columns (tmdb_id, tvdb_id, imdb_id) name a
// supplier by construction — recording that tmdb_id came from TMDB is a tautology
// that would fill a third of the table. Positions, ratings, shelf state and
// progress are the reader's alone and no supplier has an opinion about them.
var recordableFields = map[string]bool{
	// Both kinds.
	"title": true, "description": true, "genres": true, "poster": true,
	// Films, shows and games.
	"director": true, "release_year": true, "series": true, "publisher": true,
	// Books.
	"author": true, "published_year": true, "publisher_name": true,
	"page_count": true, "isbn": true, "cover": true,
}

// RecordFieldSources notes that `source` wrote each of `fields` on one work.
//
// TAKES A TX because every caller is already inside one: a fetch writes the work
// and its provenance together or does neither, and provenance that survived a
// rolled-back write would describe a value that is not there.
//
// UPSERT, because a field is written many times over a library's life and only
// the current answer is kept. An unknown field name is DROPPED rather than
// erroring: this is bookkeeping beside a write that has already succeeded, and
// failing the reader's fetch because the audit trail did not recognise a column
// would be the tail wagging the dog. The whitelist is enforced in tests instead.
func RecordFieldSources(tx *sql.Tx, uid int64, kind string, workID int64, source, sourceID string, fields []string) error {
	source = strings.TrimSpace(source)
	if source == "" || len(fields) == 0 {
		return nil
	}
	stmt, err := tx.Prepare(`
		INSERT INTO work_field_source (user_id, kind, work_id, field, source, source_id, at)
		VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
		ON CONFLICT(user_id, kind, work_id, field)
		DO UPDATE SET source = excluded.source, source_id = excluded.source_id, at = excluded.at`)
	if err != nil {
		return err
	}
	defer stmt.Close()
	seen := map[string]bool{}
	for _, f := range fields {
		f = strings.TrimSpace(f)
		if f == "" || seen[f] || !recordableFields[f] {
			continue
		}
		seen[f] = true
		if _, err := stmt.Exec(uid, kind, workID, f, source, strings.TrimSpace(sourceID)); err != nil {
			return err
		}
	}
	return nil
}

// FieldSourcesFor returns every recorded field for one work, field-ordered so the
// response is stable. Scoped by user_id like every other query here; another
// reader's work simply has no rows, which is the same shape a work with no
// provenance has and leaks nothing about whether it exists.
func (s *Store) FieldSourcesFor(uid int64, kind string, workID int64) ([]FieldSource, error) {
	rows, err := s.DB.Query(
		`SELECT field, source, source_id, at FROM work_field_source
		  WHERE user_id = ? AND kind = ? AND work_id = ?`, uid, kind, workID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []FieldSource
	for rows.Next() {
		var f FieldSource
		if err := rows.Scan(&f.Field, &f.Source, &f.SourceID, &f.At); err != nil {
			return nil, err
		}
		out = append(out, f)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Field < out[j].Field })
	return out, nil
}

// ForgetFieldSources drops a work's provenance. Called when a work is deleted for
// real, so a later work reusing the id cannot inherit somebody else's answers.
func ForgetFieldSources(tx *sql.Tx, uid int64, kind string, workID int64) error {
	_, err := tx.Exec(
		`DELETE FROM work_field_source WHERE user_id = ? AND kind = ? AND work_id = ?`,
		uid, kind, workID)
	return err
}
