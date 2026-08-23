package store

import (
	"database/sql"
	"sort"
	"strconv"
	"strings"

	"tippani/internal/olog"
)

// One-time passes: the upgrades that cannot be SQL, run once per database, and
// DELETABLE WITHOUT TOUCHING ANYTHING ELSE.
//
// WHAT THIS IS FOR, AND WHAT IT IS NOT FOR. A numbered migration under
// migrations/ changes the SCHEMA and is forward-only and never edited. Two boot
// repairs (BackfillDialogueHashes, BackfillCastKeys) fix DATA that SQLite cannot
// express — no sha256, no Unicode-aware lower() — and are deliberately unguarded
// so they re-run on every start and heal a row a later rename left stale. Neither
// covers the third thing: a change that has to happen ONCE, on a database that
// already existed, because the meaning of something changed in a particular
// RELEASE. "Every instance upgrading to 2.2.0 needs to be told the default
// metadata provider moved" is not a schema change and not a repair; running it
// twice would be wrong, and running it on a fresh install would be a lie.
//
// THE RETIREMENT PROBLEM IS THE REASON FOR THE REGISTRY. A pass is dead weight
// once every instance anybody cares about has run it, and dead weight that cannot
// be removed cheaply is never removed. If Migrate() called each pass by name,
// deleting the pass would mean editing Migrate() too — so the deletion touches a
// file every other pass also lives in, and a mistake there breaks startup for
// everybody. Instead each pass registers ITSELF from an init() in its own file,
// and this registry only ever iterates what registered. DELETING THE FILE
// REMOVES THE PASS, and nothing else in the tree mentions it.
//
// THE NAME CARRIES THE VERSION IT FIRST SHIPS IN — onetime_2_2_0_*.go — so the
// retirement question is answerable from `ls` alone: a pass named for a release
// old enough that no supported instance can still be behind it is a pass to
// delete. That is the whole convention, and it is the reason the version is in
// the filename rather than only in the struct.
//
// EVERY PASS RECORDS ITSELF, in one_time_passes, in the same transaction as its
// own work. So a pass that fails leaves no record and is retried on the next
// start, and a pass that succeeds is never run again — including after its file
// is deleted, because nothing then asks. The record outlives the code on purpose:
// it is the only remaining evidence of what a database has been through.
//
// A FAILURE IS LOGGED AND SKIPPED, NEVER RETURNED. This runs from Migrate(), and
// an error out of Migrate() means the application does not start. BackfillCastKeys
// settled that argument already, in those words, for a repair whose failure costs
// one row's autofill; a one-time pass is generally cosmetic and refusing to boot
// over one would be far worse than going without it. The pass stays unrecorded,
// so the next start tries again.
//
// The table is created here rather than in a numbered migration for the reason
// schema_version is: the mechanism has to work on a database at version 0, and
// keeping it beside the code that reads it means the whole convention is one file
// plus one file per pass.

// OneTimePass is one such upgrade. Registered from its own file's init(), never
// from a list somebody has to maintain.
type OneTimePass struct {
	// Version is the release this pass first ships in — "2.2.0". It orders the
	// passes and it is recorded, so a database can say which release taught it
	// what. It must match the version in the filename.
	Version string
	// Name is the stable identifier written to one_time_passes. Changing it
	// re-runs the pass on every database that already ran it, so it is chosen
	// once and left alone — even if the file is later renamed.
	Name string
	// Why is one line, logged when the pass runs, for whoever is reading a boot
	// log six months from now with the file already deleted.
	Why string
	// Run does the work. It is handed the transaction its record will be written
	// in, so its writes and the record commit or roll back together.
	Run func(tx *sql.Tx, env OneTimeEnv) error
}

// OneTimeEnv is what a pass needs to know about the database it is running
// against, beyond the transaction itself.
type OneTimeEnv struct {
	// FreshInstall is true when this Migrate() call CREATED the database — there
	// was no recorded schema version before it ran.
	//
	// THIS IS THE FIELD THAT KEEPS A PASS HONEST, and every pass that exists to
	// tell an upgrader something has to check it. A brand-new install has no
	// history to reconcile: flagging "the default provider changed" on a database
	// that has never had a title in it is not a migration, it is a false
	// statement rendered in the interface. The pass still RECORDS itself on a
	// fresh install — it has nothing to do, and doing nothing is done — so it
	// never runs again.
	FreshInstall bool
	// SchemaVersionBefore is what the database was at when this boot started; 0
	// for a fresh one. A pass that has to reason about how far behind an instance
	// was reads it rather than guessing from the data.
	SchemaVersionBefore int
}

// oneTimePasses is appended to by init() in each pass's own file. Never read
// before Migrate() runs, so ordinary package-init ordering is enough.
var oneTimePasses []OneTimePass

// RegisterOneTimePass is called from a pass file's init(). Exported so a pass can
// live in another package later if one ever needs to; today they are all here.
func RegisterOneTimePass(p OneTimePass) { oneTimePasses = append(oneTimePasses, p) }

// runOneTimePasses applies every registered pass that this database has not
// recorded, oldest release first.
func (s *Store) runOneTimePasses(env OneTimeEnv) error {
	if _, err := s.DB.Exec(
		`CREATE TABLE IF NOT EXISTS one_time_passes (
		   name       TEXT PRIMARY KEY,
		   version    TEXT NOT NULL,
		   applied_at TEXT NOT NULL DEFAULT (datetime('now'))
		 )`,
	); err != nil {
		return err
	}

	done := map[string]bool{}
	rows, err := s.DB.Query(`SELECT name FROM one_time_passes`)
	if err != nil {
		return err
	}
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			rows.Close()
			return err
		}
		done[name] = true
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return err
	}

	// A stable order, oldest release first, so a pass may rely on an earlier one
	// having already run. Sorted by name within a version because two passes in
	// one release are otherwise ordered by package-init order, which is a
	// filename accident nobody should have to reason about.
	pending := make([]OneTimePass, 0, len(oneTimePasses))
	for _, p := range oneTimePasses {
		if !done[p.Name] {
			pending = append(pending, p)
		}
	}
	sort.Slice(pending, func(i, j int) bool {
		if c := compareVersions(pending[i].Version, pending[j].Version); c != 0 {
			return c < 0
		}
		return pending[i].Name < pending[j].Name
	})

	for _, p := range pending {
		if err := s.runOneTimePass(p, env); err != nil {
			// Logged and skipped — see the header. The pass is left unrecorded, so
			// the next start tries it again.
			olog.Warnf(olog.CodeStoreOneTimePass,
				"[store] one-time pass %q (%s) failed and was skipped: %v", p.Name, p.Version, err)
			continue
		}
		// Printf rather than Tracef: this happens once in a database's life and is
		// the only account of it that reaches a boot log. A pass whose file has
		// since been deleted leaves this line as the only readable explanation.
		olog.Printf("[store] one-time pass %q (%s) applied: %s", p.Name, p.Version, p.Why)
	}
	return nil
}

// runOneTimePass is one pass in one transaction, with its record written inside
// it. Separate function so the deferred rollback is scoped to a single pass
// rather than to the whole loop.
func (s *Store) runOneTimePass(p OneTimePass, env OneTimeEnv) error {
	tx, err := s.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback() // no-op after a successful Commit
	if p.Run != nil {
		if err := p.Run(tx, env); err != nil {
			return err
		}
	}
	if _, err := tx.Exec(
		`INSERT INTO one_time_passes (name, version) VALUES (?, ?)`, p.Name, p.Version,
	); err != nil {
		return err
	}
	return tx.Commit()
}

// compareVersions orders dotted numeric versions — "2.10.0" after "2.9.1", which
// a string compare gets backwards. Anything non-numeric compares as 0, which is
// enough: these are release numbers this repository issues, not arbitrary input.
func compareVersions(a, b string) int {
	as, bs := strings.Split(a, "."), strings.Split(b, ".")
	for i := 0; i < len(as) || i < len(bs); i++ {
		var x, y int
		if i < len(as) {
			x, _ = strconv.Atoi(as[i])
		}
		if i < len(bs) {
			y, _ = strconv.Atoi(bs[i])
		}
		if x != y {
			if x < y {
				return -1
			}
			return 1
		}
	}
	return 0
}
