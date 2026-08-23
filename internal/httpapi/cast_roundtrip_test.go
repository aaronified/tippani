package httpapi

import (
	"net/http"
	"strings"
	"testing"

	"tippani/internal/store"
)

// A WORK'S CAST HAS TO SURVIVE ITS OWN EXPORT (0048).
//
// work_reads is the precedent 0048's header cites — "copied deliberately rather
// than reinvented" — and the Markdown export is the one place work_reads actually
// round-trips: written as frontmatter, parsed back, carried across the queue and
// written at approval. That half had not been copied. So exporting a film and
// re-importing it lost every cast row with no quote attached: a character with
// quotes survived only as the per-line actor string, a character somebody had
// typed and not yet quoted was gone entirely, and every origin and every
// tombstone went with them.
//
// Each test here fails on the export line before the fix and on the import after
// it, which is why they assert on both halves.

// THE WHOLE PATH, on a game — the kind whose cast exists nowhere else. Export
// writes the line, the parser reads it, staging carries it, approval writes it
// back, and the provenance arrives intact on the other side.
func TestAGamesVoiceCastSurvivesTheMarkdownRoundTrip(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	game := createGame(t, c, "Portal 2", "Valve")
	// A provider row, a correction on top of one, a row the reader typed and never
	// quoted, and a deletion they made on purpose: all four origins in one file.
	seeded := seedProviderCast(t, srv, 1, "movie", game,
		[2]string{"Wheatley", "Stephen Merchant"},
		[2]string{"Glados", "Ellen McLain"},
		[2]string{"Cave Johnson", "J.K. Simmons"})
	c.mustDo("PUT", "/cast/"+itoa(seeded[1]), map[string]any{
		"character": "GLaDOS", "actor": "Ellen McLain",
	}, http.StatusOK)
	c.mustDo("DELETE", "/cast/"+itoa(seeded[2]), nil, http.StatusNoContent)
	c.mustDo("POST", "/movies/"+itoa(game)+"/cast", map[string]any{
		"character": "Chell", "actor": "",
	}, http.StatusCreated)
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": game, "quote": "The cake is a lie.", "character": "GLaDOS",
	}, http.StatusCreated)

	md := c.mustDo("GET", "/movies/"+itoa(game)+"/export", nil, http.StatusOK).Body.String()
	// The export half. Every one of these four was missing before the fix.
	for _, want := range []string{
		"Wheatley — Stephen Merchant",
		"GLaDOS — Ellen McLain (corrected)",
		"Cave Johnson — J.K. Simmons (removed)",
		"Chell (reader)",
	} {
		if !strings.Contains(md, want) {
			t.Fatalf("the export dropped %q:\n%s", want, md)
		}
	}

	// Back in as a SECOND account, so nothing can be merely matched to the rows it
	// came from. Import → staging → approve is the whole path.
	other := addUser(t, h, c, "second")
	if rec := other.importApprove("/import/markdown", "portal.md", []byte(md)); rec.Code != http.StatusOK {
		t.Fatalf("import: %d %s", rec.Code, rec.Body)
	}
	list := decode[struct {
		Movies []struct {
			ID int64 `json:"id"`
		} `json:"movies"`
	}](t, other.mustDo("GET", "/movies", nil, http.StatusOK))
	if len(list.Movies) != 1 {
		t.Fatalf("expected one imported game, got %+v", list.Movies)
	}
	got := list.Movies[0].ID

	cast := castOf(t, other, "/movies/"+itoa(got)+"/cast")
	if cast.ActorRole != "voice" {
		t.Fatalf("actor_role = %q — a game came back as something else", cast.ActorRole)
	}
	byName := map[string]castRow{}
	for _, row := range cast.Cast {
		byName[row.Character] = row
	}
	if len(cast.Cast) != 3 {
		t.Fatalf("three live rows should have come back, got %+v", cast.Cast)
	}
	if row := byName["Wheatley"]; row.Actor != "Stephen Merchant" || row.Origin != "provider" {
		t.Fatalf("the provider's row came back wrong: %+v", row)
	}
	if row := byName["GLaDOS"]; row.Origin != "corrected" {
		t.Fatalf("the correction lost its protection: %+v — the next lookup would "+
			"overwrite a name the reader had already fixed", row)
	}
	if row, ok := byName["Chell"]; !ok || row.Origin != "reader" {
		t.Fatalf("the typed row with no quote and no actor is the one nothing else in the "+
			"file could carry: %+v", cast.Cast)
	}
	if _, resurrected := byName["Cave Johnson"]; resurrected {
		t.Fatalf("a deleted credit came back as a live row: %+v", cast.Cast)
	}
	if byOrigin := castRowsOnWork(t, srv, "movie", got); byOrigin["removed"] != 1 {
		t.Fatalf("the tombstone did not survive the round trip: %v — the imported "+
			"title's first lookup would hand the credit back", byOrigin)
	}
	// THE TOMBSTONE'S PROVIDER KEY IS REBUILT FROM THE TWO NAMES, which is what
	// makes it recognisable to the imported title's first lookup rather than merely
	// present. An untouched row's key IS ProviderKey(character, actor), so it is
	// reconstructible with nothing stored in the file.
	var key string
	if err := srv.Store.DB.QueryRow(
		`SELECT provider_key FROM work_cast WHERE kind = 'movie' AND work_id = ? AND origin = 'removed'`,
		got).Scan(&key); err != nil {
		t.Fatal(err)
	}
	if key != store.ProviderKey("Cave Johnson", "J.K. Simmons") {
		t.Fatalf("the tombstone came back with provider_key %q — a fresh fetch would not "+
			"match it, and would re-add the credit beside it", key)
	}
	// A CORRECTION COMES BACK WITH NO PROVIDER KEY, on purpose: the key held the
	// provider's original spelling, which the file deliberately does not carry, and
	// writing the corrected name into it would claim the provider had said it. With
	// no key a refetch cannot see the row at all, which is the most protected state
	// there is.
	if err := srv.Store.DB.QueryRow(
		`SELECT provider_key FROM work_cast WHERE kind = 'movie' AND work_id = ? AND origin = 'corrected'`,
		got).Scan(&key); err != nil {
		t.Fatal(err)
	}
	if key != "" {
		t.Fatalf("an imported correction claims a provider entry it cannot vouch for: %q", key)
	}

	// And the end of the chain: the mapping that came back is a live mapping, so a
	// new line naming that character finds its voice actor.
	d := decode[dialogueRow](t, other.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": got, "quote": "I'm not even angry.", "character": "GLaDOS",
	}, http.StatusCreated))
	if d.Actor != "Ellen McLain" {
		t.Fatalf("actor = %q — the imported mapping does not answer the autofill", d.Actor)
	}
}

// A BOOK'S CHARACTERS ROUND-TRIP TOO, under their own key, and they need it more
// than a film does: nothing seeds a book's list, so the file is the only copy.
func TestABooksCharactersSurviveTheMarkdownRoundTrip(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	book := createTestBook(t, c, "Moby-Dick", "Herman Melville")
	c.mustDo("POST", "/books/"+itoa(book)+"/cast", map[string]any{"character": "Queequeg"},
		http.StatusCreated)
	c.mustDo("POST", "/books/"+itoa(book)+"/cast", map[string]any{"character": "Ahab"},
		http.StatusCreated)
	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book, "quote": "Call me Ishmael.",
	}, http.StatusCreated)

	md := c.mustDo("GET", "/books/"+itoa(book)+"/export", nil, http.StatusOK).Body.String()
	if !strings.Contains(md, "characters: Queequeg (reader); Ahab (reader)") {
		t.Fatalf("a book's list is written under its own key, in billing order:\n%s", md)
	}
	if strings.Contains(md, "cast:") {
		t.Fatalf("a novel has speakers, not a cast:\n%s", md)
	}

	other := addUser(t, h, c, "second")
	if rec := other.importApprove("/import/markdown", "moby.md", []byte(md)); rec.Code != http.StatusOK {
		t.Fatalf("import: %d %s", rec.Code, rec.Body)
	}
	list := decode[struct {
		Books []bookDetail `json:"books"`
	}](t, other.mustDo("GET", "/books", nil, http.StatusOK))
	if len(list.Books) != 1 {
		t.Fatalf("expected one imported book, got %d", len(list.Books))
	}
	cast := castOf(t, other, "/books/"+itoa(list.Books[0].ID)+"/cast")
	if len(cast.Cast) != 2 || cast.Cast[0].Character != "Queequeg" || cast.Cast[1].Character != "Ahab" {
		t.Fatalf("the round trip lost the characters, or their order: %+v", cast.Cast)
	}
}

// A WORK WITH NO CAST EXPORTS EXACTLY AS IT DID BEFORE 0048 — writeFrontmatter
// drops an empty value, so no existing file gains a blank key and no fixture that
// pins an export's bytes has to move.
func TestAWorkWithNoCastExportsUnchanged(t *testing.T) {
	c := signupAdmin(t, newTestServer(t).Handler())
	film := createFilm(t, c, "Solaris", "Andrei Tarkovsky")
	md := c.mustDo("GET", "/movies/"+itoa(film)+"/export", nil, http.StatusOK).Body.String()
	if strings.Contains(md, "cast:") {
		t.Fatalf("a film with no cast should carry no cast line:\n%s", md)
	}
}

// A FILM'S FILE RETARGETED ONTO A BOOK LOSES ITS ACTORS RATHER THAN FAILING.
// 0047's rule, and the half of it that had nothing to enforce it until the cast
// gained an import path: the API rejects a field the kind does not have, and an
// import clears it, because a file is something somebody already wrote.
func TestABooksImportedCharactersLoseTheirActors(t *testing.T) {
	c := signupAdmin(t, newTestServer(t).Handler())

	// A book file — no `type: movie` — whose cast line names actors anyway, which
	// is what a hand-retargeted film export looks like.
	md := "---\ntitle: Moby-Dick\nauthor: Herman Melville\ntype: book\n" +
		"characters: Ahab — Gregory Peck (reader)\n---\n\n> Call me Ishmael.\n"
	if rec := c.importApprove("/import/markdown", "moby.md", []byte(md)); rec.Code != http.StatusOK {
		t.Fatalf("import: %d %s — a file is not rejected over a field its kind lacks", rec.Code, rec.Body)
	}
	list := decode[struct {
		Books []bookDetail `json:"books"`
	}](t, c.mustDo("GET", "/books", nil, http.StatusOK))
	if len(list.Books) != 1 {
		t.Fatalf("expected one imported book, got %d", len(list.Books))
	}
	cast := castOf(t, c, "/books/"+itoa(list.Books[0].ID)+"/cast")
	if len(cast.Cast) != 1 || cast.Cast[0].Character != "Ahab" {
		t.Fatalf("the character should have come in: %+v", cast.Cast)
	}
	if cast.Cast[0].Actor != "" {
		t.Fatalf("actor = %q — nobody plays Ahab", cast.Cast[0].Actor)
	}
}

// RE-IMPORTING AN OLD EXPORT MUST NOT FIGHT THE LIST THAT IS ALREADY THERE. The
// read log's rule, applied to the cast: the file is adopted only when the work
// has none, so a two-year-old file cannot undo a correction made last week.
func TestAReImportedFileDoesNotDisturbACastAlreadyThere(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	film := createFilm(t, c, "Alien", "Ridley Scott")
	seeded := seedProviderCast(t, srv, 1, "movie", film, [2]string{"ripley", "sigourney weaver"})
	md := c.mustDo("GET", "/movies/"+itoa(film)+"/export", nil, http.StatusOK).Body.String()

	// The reader fixes the name AFTER taking that export.
	c.mustDo("PUT", "/cast/"+itoa(seeded[0]), map[string]any{
		"character": "Ripley", "actor": "Sigourney Weaver",
	}, http.StatusOK)

	// The stale file comes back and anchors to the same title.
	if rec := c.importApprove("/import/markdown", "alien.md", []byte(md)); rec.Code != http.StatusOK {
		t.Fatalf("import: %d %s", rec.Code, rec.Body)
	}
	cast := castOf(t, c, "/movies/"+itoa(film)+"/cast")
	if len(cast.Cast) != 1 {
		t.Fatalf("the stale file should have added nothing: %+v", cast.Cast)
	}
	if cast.Cast[0].Character != "Ripley" || cast.Cast[0].Origin != "corrected" {
		t.Fatalf("a re-import overwrote a newer correction: %+v", cast.Cast[0])
	}
}

// A CHARACTER WHOSE NAME LOOKS LIKE A MARKER IS STILL THAT CHARACTER.
//
// The origin marker is a parenthesis stripped off the END of a line, so every word
// the parser accepts is a word that cannot appear at the end of somebody's
// character name. That set has to be exactly what castFrontmatter writes —
// 'corrected', 'reader', 'removed' — and it began five words wider, on the
// reasonable-sounding grounds that a hand-edited file deserves the same aliases
// "colour" and "ep" already get.
//
// IT IS NOT THE SAME CONCESSION, and a book is where it shows. A book character
// has no actor, so its whole line is the name; an entry with no marker is read as
// the provider's (castOriginForImport). So "X (deleted)" — a name, on a line that
// ends where the name ends — came in as a TOMBSTONE called "X", and a tombstone is
// filtered out of every read but the merge's. The credit did not arrive wrong, it
// did not arrive at all, and the file said nothing about a deletion.
func TestACharacterNamedLikeAMarkerIsNotATombstone(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	// A HAND-WRITTEN FILE, which is the case the aliases were added for.
	md := "---\ntitle: Moby-Dick\nauthor: Herman Melville\ntype: book\n" +
		"characters: X (deleted); Ahab\n---\n\n> Call me Ishmael.\n"
	if rec := c.importApprove("/import/markdown", "moby.md", []byte(md)); rec.Code != http.StatusOK {
		t.Fatalf("import: %d %s", rec.Code, rec.Body)
	}
	list := decode[struct {
		Books []bookDetail `json:"books"`
	}](t, c.mustDo("GET", "/books", nil, http.StatusOK))
	if len(list.Books) != 1 {
		t.Fatalf("expected one imported book, got %d", len(list.Books))
	}
	book := list.Books[0].ID

	cast := castOf(t, c, "/books/"+itoa(book)+"/cast")
	if len(cast.Cast) != 2 {
		t.Fatalf("the file named two characters and %d came back: %+v — a name ending in "+
			"a marker-shaped parenthesis was read as a deletion, and a tombstone is "+
			"invisible to every read but the merge's", len(cast.Cast), cast.Cast)
	}
	if cast.Cast[0].Character != "X (deleted)" {
		t.Fatalf("the import ate part of the name: %+v", cast.Cast[0])
	}
	if byOrigin := castRowsOnWork(t, srv, "book", book); byOrigin["removed"] != 0 {
		t.Fatalf("origins = %v — the import invented a deletion the file never mentioned", byOrigin)
	}

	// AND IT SURVIVES TIPPANI'S OWN EXPORT, which is the harder half: a provider
	// row is written with NO marker at all, so nothing on the line marks where the
	// name ends except the vocabulary the parser will accept.
	out := c.mustDo("GET", "/books/"+itoa(book)+"/export", nil, http.StatusOK).Body.String()
	if !strings.Contains(out, "characters: X (deleted); Ahab") {
		t.Fatalf("the export should write the name and no marker:\n%s", out)
	}
	other := addUser(t, h, c, "second")
	if rec := other.importApprove("/import/markdown", "moby.md", []byte(out)); rec.Code != http.StatusOK {
		t.Fatalf("re-import: %d %s", rec.Code, rec.Body)
	}
	back := decode[struct {
		Books []bookDetail `json:"books"`
	}](t, other.mustDo("GET", "/books", nil, http.StatusOK))
	if len(back.Books) != 1 {
		t.Fatalf("expected one re-imported book, got %d", len(back.Books))
	}
	cast = castOf(t, other, "/books/"+itoa(back.Books[0].ID)+"/cast")
	if len(cast.Cast) != 2 || cast.Cast[0].Character != "X (deleted)" {
		t.Fatalf("the round trip turned a name into a deletion: %+v", cast.Cast)
	}
}
