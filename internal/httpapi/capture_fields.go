package httpapi

import (
	"fmt"
	"time"
)

// Shared validation for the two fields an offline capture has to set on create:
// when it was taken, and what took it. Both are inert for the web UI, which
// omits them and gets the previous behaviour (now, and "manual").

// sqliteTimeLayout is the format the schema stores and datetime('now') emits.
// The SPA parses it by swapping the space for a T, so anything written here has
// to match it exactly.
const sqliteTimeLayout = "2006-01-02 15:04:05"

// notedAtLayouts are the inputs accepted for noted_at, in the order tried. A
// date alone is the common case (a highlight remembers its day, not its
// second); the offset forms let a client send an unambiguous instant.
var notedAtLayouts = []string{
	sqliteTimeLayout,
	"2006-01-02",
	time.RFC3339,
	"2006-01-02T15:04:05",
}

// notedAtSkew is how far ahead of the server's clock a noted_at may sit before
// it is treated as nonsense rather than a timezone. A phone in UTC+14 sending
// local time is legitimately most of a day ahead, so the tolerance has to cover
// the timezone range; beyond that a date is a typo or a broken clock, and
// silently accepting it would park the quote at the end of every sort forever.
const notedAtSkew = 24 * time.Hour

// parseNotedAt normalizes a client-supplied capture date to the stored format.
// An empty string means "not supplied" and is the caller's cue to default.
func parseNotedAt(s string) (string, error) {
	for _, layout := range notedAtLayouts {
		t, err := time.Parse(layout, s)
		if err != nil {
			continue
		}
		if t.After(time.Now().UTC().Add(notedAtSkew)) {
			return "", fmt.Errorf("noted_at is in the future")
		}
		return t.UTC().Format(sqliteTimeLayout), nil
	}
	return "", fmt.Errorf("noted_at must be a date (2026-07-14) or timestamp (2026-07-14T09:30:00Z)")
}

// captureSources are the provenance values a client may claim on create.
// Importers set their own source strings server-side and are not listed here —
// only a real import may claim to be one.
var captureSources = map[string]bool{
	"manual": true, // typed in, the default
	"ocr":    true, // recognised from a photographed page by the mobile app
}

// validateSource defaults an empty source to "manual" and rejects anything
// off the allowlist. source is displayed and filtered on, so a client must not
// be able to invent provenance.
func validateSource(s string) (string, error) {
	if s == "" {
		return "manual", nil
	}
	if !captureSources[s] {
		return "", fmt.Errorf("source must be manual or ocr")
	}
	return s, nil
}
