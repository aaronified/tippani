package httpapi

import (
	"database/sql"
	"embed"
	"os"

	"tippani/internal/metadata"
	"tippani/internal/olog"
)

// The starter sticker library.
//
// Stickers are the seal a quote's text flows around, and the feature shipped
// upload-only: a brand-new account had an empty strip with a ＋ on it, which is
// a feature you have to go and find a transparent PNG for before you can see
// what it does. So five come in the box — three faces, a heart and a star. Small,
// obvious, and the kinds of mark somebody actually wants beside a line they
// liked.
//
// THEY ARE ORDINARY STICKER ROWS, not a built-in kind. Each one is copied into
// the user's own MediaCover store on the way in and inserted like any upload, so
// every path that already exists keeps working with no new case: the cover route
// serves them, the picker offers them, they can be renamed, they can be deleted,
// they leave with a deleted user and they travel inside a backup archive. A
// built-in sticker id would have needed a branch in each of those.
//
//go:embed assets/stickers/*.svg
var stickerAssets embed.FS

var defaultStickers = []struct{ Name, File string }{
	{"heart", "heart.svg"},
	{"star", "star.svg"},
	{"smile", "smile.svg"},
	{"wink", "wink.svg"},
	{"sad", "sad.svg"},
}

// seededStickersKey marks the one-shot backfill as run, instance-wide.
//
// It is what makes "everybody gets the starter set" safe to ship to a library
// somebody has been keeping for a year: without it, the sweep below would run on
// every boot, and a default sticker you deliberately deleted would be back by
// dinner. The flag says the offer was made once.
const seededStickersKey = "seeded_stickers_v1"

// seedDefaultStickers copies the starter set into one user's library.
//
// Best-effort, per sticker, like seedDefaultTags: a failure is logged and the
// rest still go in. The account is already made either way, and an empty strip
// with a ＋ on it is exactly the state this improves on rather than a broken one.
//
// Skips a name the user already has, so the backfill cannot double up on an
// account that was created new after the upgrade.
func (s *Server) seedDefaultStickers(userID int64) {
	dir := s.coversDir()
	if err := os.MkdirAll(dir, 0o700); err != nil {
		olog.Warnf(olog.CodeStickerSeed, "[sticker] seed: cover dir %s: %v", dir, err)
		return
	}
	for _, d := range defaultStickers {
		data, err := stickerAssets.ReadFile("assets/stickers/" + d.File)
		if err != nil {
			olog.Warnf(olog.CodeStickerSeed, "[sticker] seed: read %s: %v", d.File, err)
			continue
		}
		var exists bool
		if err := s.Store.DB.QueryRow(
			`SELECT EXISTS(SELECT 1 FROM stickers WHERE user_id = ? AND name = ?)`,
			userID, d.Name).Scan(&exists); err == nil && exists {
			continue
		}
		stored, err := metadata.StoreImage(data, dir)
		if err != nil {
			olog.Warnf(olog.CodeStickerSeed, "[sticker] seed: store %s: %v", d.File, err)
			continue
		}
		if _, err := s.Store.DB.Exec(
			`INSERT INTO stickers (user_id, name, path) VALUES (?, ?, ?)`,
			userID, d.Name, stored); err != nil {
			s.removeCoverFile(stored) // no orphan file for a row that never landed
			olog.Warnf(olog.CodeStickerSeed, "[sticker] seed: insert %s for user %d: %v", d.Name, userID, err)
		}
	}
}

// BackfillDefaultStickers hands the starter set to the users who already exist —
// an upgrade gets the same box a fresh install does, rather than the feature
// being something only new accounts ever see.
//
// Called once at boot from cmd/tippani, and once per instance for all time (see
// seededStickersKey). Not a migration: migrations run inside the store package
// against the DB alone, and this writes FILES into the cover store, which is the
// server's business and not the schema's.
//
// The flag is set even when a user's seeding partly failed. The alternative is
// retrying on every boot forever, and the failure modes here — a full disk, a
// read-only volume — are not the kind that clear up by being retried a thousand
// times; the log line is the honest signal.
func (s *Server) BackfillDefaultStickers() {
	if !s.SeedNewUsers {
		return
	}
	done, err := s.Store.GetSetting(seededStickersKey)
	if err != nil {
		olog.Warnf(olog.CodeStickerSeed, "[sticker] backfill: read flag: %v", err)
		return
	}
	if done != "" {
		return
	}
	ids, err := allUserIDs(s.Store.DB)
	if err != nil {
		olog.Warnf(olog.CodeStickerSeed, "[sticker] backfill: list users: %v", err)
		return
	}
	for _, id := range ids {
		s.seedDefaultStickers(id)
	}
	if err := s.Store.SetSetting(seededStickersKey, "1"); err != nil {
		olog.Warnf(olog.CodeStickerSeed, "[sticker] backfill: set flag: %v", err)
		return
	}
	if len(ids) > 0 {
		olog.Printf("[sticker] seeded the starter stickers for %d existing user(s)", len(ids))
	}
}

func allUserIDs(db *sql.DB) ([]int64, error) {
	rows, err := db.Query(`SELECT id FROM users ORDER BY id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var ids []int64
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}
