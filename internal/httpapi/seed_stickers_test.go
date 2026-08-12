package httpapi

import (
	"net/http"
	"os"
	"path/filepath"
	"testing"
)

// The starter sticker set: five seals every account gets so the strip is not an
// empty box with a ＋ in it on day one.
//
// Three things here can fail quietly and each one costs the whole feature:
//
//   - the embedded SVGs not passing the image guard StoreImage applies to an
//     upload (it refuses scripted SVG and anything under 48 bytes), which would
//     leave every new account with the empty strip and one [warn] line nobody
//     reads;
//   - the row landing without its FILE, so the picker shows five broken images;
//   - and the backfill, which is the half that has no UI at all. It runs once at
//     boot for accounts that predate the feature, and both of its failure modes
//     are invisible: never running, so an upgrade never sees the stickers, or
//     running every boot, so a default somebody deliberately deleted comes back.

type stickerList struct {
	Stickers []stickerRow `json:"stickers"`
}

func listStickers(t *testing.T, c *testClient) []stickerRow {
	t.Helper()
	return decode[stickerList](t, c.mustDo("GET", "/stickers", nil, 200)).Stickers
}

func stickerNames(rows []stickerRow) map[string]stickerRow {
	byName := make(map[string]stickerRow, len(rows))
	for _, r := range rows {
		byName[r.Name] = r
	}
	return byName
}

func TestSeedDefaultStickers(t *testing.T) {
	srv := newTestServer(t)
	srv.SeedNewUsers = true // off by default in tests; see newTestServer
	h := srv.Handler()
	c := signupAdmin(t, h)

	rows := listStickers(t, c)
	if len(rows) != len(defaultStickers) {
		t.Fatalf("seeded %d stickers, want %d: %+v", len(rows), len(defaultStickers), rows)
	}
	byName := stickerNames(rows)
	for _, want := range defaultStickers {
		got, ok := byName[want.Name]
		if !ok {
			t.Fatalf("no seeded sticker named %q; got %+v", want.Name, rows)
		}
		// The FILE is the sticker. A row with a path that is not on disk renders
		// as a broken image in the picker and as nothing at all on a card.
		onDisk := filepath.Join(srv.coversDir(), got.Path)
		info, err := os.Stat(onDisk)
		if err != nil {
			t.Fatalf("sticker %q: file %s: %v", want.Name, got.Path, err)
		}
		if info.Size() == 0 {
			t.Fatalf("sticker %q: file %s is empty", want.Name, got.Path)
		}
		// And it is served, by the same route an uploaded sticker is served by.
		rec := c.mustDo("GET", "/covers/"+got.Path, nil, http.StatusOK)
		if rec.Body.Len() == 0 {
			t.Fatalf("sticker %q: /covers/%s served nothing", want.Name, got.Path)
		}
	}
}

func TestSeedDefaultStickersPerUser(t *testing.T) {
	// Stickers are per-user rows (the list query is user-scoped), so a second
	// account gets its own five rather than seeing the admin's.
	srv := newTestServer(t)
	srv.SeedNewUsers = true
	h := srv.Handler()
	admin := signupAdmin(t, h)
	bob := addUser(t, h, admin, "bob")

	for who, c := range map[string]*testClient{"alice": admin, "bob": bob} {
		if rows := listStickers(t, c); len(rows) != len(defaultStickers) {
			t.Fatalf("%s has %d stickers, want %d", who, len(rows), len(defaultStickers))
		}
	}
	// Not the same rows: bob cannot attach alice's sticker, so they cannot be
	// shared rows behind one id.
	aliceIDs := map[int64]bool{}
	for _, r := range listStickers(t, admin) {
		aliceIDs[r.ID] = true
	}
	for _, r := range listStickers(t, bob) {
		if aliceIDs[r.ID] {
			t.Fatalf("bob's sticker %d is alice's row", r.ID)
		}
	}
}

func TestBackfillDefaultStickers(t *testing.T) {
	// An account that predates the feature: created with seeding off, so it has
	// nothing, exactly like every account on an instance being upgraded.
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	if rows := listStickers(t, c); len(rows) != 0 {
		t.Fatalf("expected a bare account, got %+v", rows)
	}

	srv.SeedNewUsers = true
	srv.BackfillDefaultStickers()
	rows := listStickers(t, c)
	if len(rows) != len(defaultStickers) {
		t.Fatalf("after backfill: %d stickers, want %d", len(rows), len(defaultStickers))
	}

	// Idempotent within one boot AND across boots: the second call is what a
	// restart looks like, and doubling up would give somebody ten stickers, then
	// fifteen.
	srv.BackfillDefaultStickers()
	if again := listStickers(t, c); len(again) != len(defaultStickers) {
		t.Fatalf("second backfill: %d stickers, want %d", len(again), len(defaultStickers))
	}

	// THE ONE THAT MATTERS. Deleting a starter sticker is a decision, and a
	// backfill that re-offers the set on every boot overrules it forever — the
	// bug you cannot report because it looks like the app not saving anything.
	victim := stickerNames(rows)["star"]
	c.mustDo("DELETE", "/stickers/"+itoa(victim.ID), nil, http.StatusOK)
	srv.BackfillDefaultStickers()
	after := stickerNames(listStickers(t, c))
	if _, back := after["star"]; back {
		t.Fatal("a deleted starter sticker came back on the next boot")
	}
	if len(after) != len(defaultStickers)-1 {
		t.Fatalf("after deleting one: %d stickers, want %d", len(after), len(defaultStickers)-1)
	}
}

func TestBackfillSkipsNamesAlreadyThere(t *testing.T) {
	// A fresh account created after the upgrade already has the set from
	// seedDefaultStickers. If the instance's backfill has not run yet — a new
	// install whose first user signs up before the next restart — the sweep must
	// not hand them a second copy of each.
	srv := newTestServer(t)
	srv.SeedNewUsers = true
	h := srv.Handler()
	c := signupAdmin(t, h)

	srv.BackfillDefaultStickers()
	if rows := listStickers(t, c); len(rows) != len(defaultStickers) {
		t.Fatalf("backfill doubled a seeded account: %d stickers, want %d", len(rows), len(defaultStickers))
	}
}

func TestBackfillRespectsSeedingOff(t *testing.T) {
	// The switch the rest of the suite relies on. Tag and sticker assertions
	// elsewhere count rows, so a backfill that ignored SeedNewUsers would salt
	// every one of them with five stickers.
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	srv.BackfillDefaultStickers()
	if rows := listStickers(t, c); len(rows) != 0 {
		t.Fatalf("seeding is off, yet the backfill added %+v", rows)
	}
}
