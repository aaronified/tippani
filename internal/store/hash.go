package store

import (
	"crypto/sha256"
	"encoding/hex"
	"strings"
)

// typographicFold maps smart punctuation to its ASCII form so the same passage
// synced through different tools (Bookcision emits ’ and –, markdown exports
// often use ' and -) hashes identically.
var typographicFold = strings.NewReplacer(
	"‘", "'", "’", "'", "‚", "'", "‛", "'", // ‘ ’ ‚ ‛
	"“", `"`, "”", `"`, "„", `"`, "‟", `"`, // “ ” „ ‟
	"«", `"`, "»", `"`, // « »
	"‐", "-", "‑", "-", "‒", "-", "–", "-", "—", "-", "−", "-", // ‐ ‑ ‒ – — −
	"…", "...", // …
)

// DedupeHash implements the PLAN §3 dedupe rule shared by annotations and
// dialogues: sha256(lower(collapse_ws(fold_punct(text)))). Location/timestamp
// are deliberately excluded so re-imports stay idempotent.
func DedupeHash(text string) string {
	norm := typographicFold.Replace(text)
	norm = strings.ToLower(strings.Join(strings.Fields(norm), " "))
	sum := sha256.Sum256([]byte(norm))
	return hex.EncodeToString(sum[:])
}
