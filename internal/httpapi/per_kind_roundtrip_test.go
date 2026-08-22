package httpapi

// THE PER-KIND FIELD MODEL THROUGH THE ROUND TRIP (0047).
//
// Every column 0047 added is now settable, and that is the easy half. This file
// is the hard half: a field that is stored and then dropped somewhere between the
// export and the row it comes back as. That failure is silent in the worst
// possible way — the request succeeds, the counters match, and the reader finds
// out months later that half of what they typed is gone.
//
// So each field is asserted THREE TIMES, because there are three separate places
// it can be lost, and the reasoning is quote_category_import_test.go's:
//
//	1. THE FILE. If the export does not write the binding there is nothing to
//	   parse, and a "contains" check on the bytes says which side broke.
//	2. THE QUEUE. staged_quotes is a separate table read by two separate queries
//	   (listStagedQuotes and loadStagedForApproval), so a field the queue does not
//	   carry survives the export, survives the parse, and dies on approval. This
//	   is the step 0034 nearly shipped a hole in.
//	3. THE APPROVAL, into a SECOND ACCOUNT — so nothing can be merely matched back
//	   onto the row it was exported from.
//
// The book's two languages get two of the three, deliberately: they live on
// staged_works, whose list row does not report them, for the reason
// stagedWorkForApproval spells out. That is the same shape
// TestATranslatorSurvivesTheMarkdownRoundTrip settled for, and this file follows
// it rather than widening a queue row to suit a test.

import (
	"net/http"
	"strings"
	"testing"
)

// oneStaged reads the pending queue — the step between the upload and the
// approval, and the one nobody looks at until a field goes missing — for the
// ordinary case of one file holding one quote. queue() is import_staging_test.go's
// helper; these tests extend that harness rather than growing a second one.
func oneStaged(t *testing.T, c *testClient) stagedQuoteRow {
	t.Helper()
	q := queue(t, c, "").Quotes
	if len(q) != 1 {
		t.Fatalf("expected exactly one staged quote, got %d: %+v", len(q), q)
	}
	return q[0]
}

// dialoguesOf reads every line in an account, whatever work it belongs to.
func dialoguesOf(t *testing.T, c *testClient) []dialogueRow {
	t.Helper()
	return decode[dlgList](t, c.mustDo("GET", "/dialogues", nil, http.StatusOK)).Dialogues
}

func annotationsOf(t *testing.T, c *testClient) []annotationRow {
	t.Helper()
	return decode[pagedAnnotations](t, c.mustDo("GET", "/annotations", nil, http.StatusOK)).Annotations
}

// ---- 1. a book highlight's character ---------------------------------------

// A novel has speakers and no cast, which is the whole of what 0047 gave the book
// side. It is also the field that broke book-file detection: "- character:" is one
// of the bindings MarkdownKind reads as "this is a film", so this test would have
// re-imported its own book as a FILM until renderBookExport started stating
// `type: book`. Both halves are asserted here.
func TestABookCharacterSurvivesItsOwnExport(t *testing.T) {
	h := newTestServer(t).Handler()
	alice := signupAdmin(t, h)

	book := decode[bookDetail](t, alice.mustDo("POST", "/books",
		map[string]any{"title": "Moby-Dick", "author": "Herman Melville"}, http.StatusCreated))
	alice.mustDo("POST", "/annotations", map[string]any{
		"book_id": book.ID, "quote": "Call me Ishmael.", "character": "Ishmael",
	}, http.StatusCreated)

	md := alice.mustDo("GET", "/books/"+itoa(book.ID)+"/export", nil, http.StatusOK).Body.String()
	if !strings.Contains(md, "- character: Ishmael") {
		t.Fatalf("the export dropped the character:\n%s", md)
	}
	// The type line that makes the character safe to write at all.
	if !strings.Contains(md, "\ntype: book\n") {
		t.Fatalf("a book file must say that it is a book:\n%s", md)
	}

	bob := addUser(t, h, alice, "bob")
	if rec := bob.importFile("/import/markdown", "moby.md", []byte(md)); rec.Code != http.StatusOK {
		t.Fatalf("import: %d %s", rec.Code, rec.Body)
	}
	if q := oneStaged(t, bob); q.Character != "Ishmael" {
		t.Fatalf("the queue cannot show what it is about to approve: %+v", q)
	}
	bob.mustDo("POST", "/import/staged/approve", map[string]any{"all": true}, http.StatusOK)

	anns := annotationsOf(t, bob)
	if len(anns) != 1 {
		t.Fatalf("expected one highlight back, got %d: %+v", len(anns), anns)
	}
	if anns[0].Character != "Ishmael" {
		t.Fatalf("the character was lost on approval: %+v", anns[0])
	}
	// It arrived as a BOOK, not as a film. Asserted separately because the count
	// above would be satisfied by zero annotations and one dialogue only if the
	// list happened to be empty — and it would be.
	if dlgs := dialoguesOf(t, bob); len(dlgs) != 0 {
		t.Fatalf("the book re-imported as a film: %+v", dlgs)
	}
}

// The hole itself, isolated: the barest book that can carry a character. No
// author and no isbn — both dropped from the frontmatter when empty — so before
// `type: book` there was nothing in this file that said "book" and one line in it
// that said "film".
func TestTheBarestBookWithACharacterStillReimportsAsABook(t *testing.T) {
	h := newTestServer(t).Handler()
	alice := signupAdmin(t, h)

	book := decode[bookDetail](t, alice.mustDo("POST", "/books",
		map[string]any{"title": "An Unattributed Novel"}, http.StatusCreated))
	alice.mustDo("POST", "/annotations", map[string]any{
		"book_id": book.ID, "quote": "A line somebody says.", "character": "A Speaker",
	}, http.StatusCreated)

	md := alice.mustDo("GET", "/books/"+itoa(book.ID)+"/export", nil, http.StatusOK).Body.String()
	for _, absent := range []string{"author:", "isbn:"} {
		if strings.Contains(md, absent) {
			t.Fatalf("this fixture is meant to be bare and carries %q:\n%s", absent, md)
		}
	}

	bob := addUser(t, h, alice, "bob")
	if rec := bob.importApprove("/import/markdown", "bare.md", []byte(md)); rec.Code != http.StatusOK {
		t.Fatalf("import: %d %s", rec.Code, rec.Body)
	}
	books := decode[pagedBooks](t, bob.mustDo("GET", "/books", nil, http.StatusOK))
	if len(books.Books) != 1 || books.Books[0].Title != "An Unattributed Novel" {
		t.Fatalf("the book did not come back as a book: %+v", books.Books)
	}
	if movies := decode[struct {
		Movies []movieDetail `json:"movies"`
	}](t, bob.mustDo("GET", "/movies", nil, http.StatusOK)); len(movies.Movies) != 0 {
		t.Fatalf("the book re-imported into the catalogue: %+v", movies.Movies)
	}
}

// ---- 2. a game's act and quest --------------------------------------------

// The full path for the two fields that are IDENTITY as well as content. Two
// barks in two quests have to arrive as two lines, which is only true if the
// queue and the live table hash the same way — a queue that dropped act and
// quest would collapse them into one staged row and then report "1 staged, 1
// added" with nothing missing anywhere a reader could see.
func TestAGamesActAndQuestSurviveTheirOwnExport(t *testing.T) {
	h := newTestServer(t).Handler()
	alice := signupAdmin(t, h)

	game := newWork(t, alice, "Disco Elysium", "game")
	newLine(t, alice, map[string]any{
		"movie_id": game, "quote": "You are the man with the hangover.",
		"act": "1", "quest": "The Whirling-in-Rags", "character": "Kim Kitsuragi",
	})
	// The same words in another quest: a different line, and the reason act and
	// quest are in the hash at all.
	newLine(t, alice, map[string]any{
		"movie_id": game, "quote": "You are the man with the hangover.",
		"act": "2", "quest": "Martinaise",
	})

	md := alice.mustDo("GET", "/movies/"+itoa(game)+"/export", nil, http.StatusOK).Body.String()
	for _, want := range []string{
		"type: game", "- act: 1", "- quest: The Whirling-in-Rags", "- act: 2", "- quest: Martinaise",
	} {
		if !strings.Contains(md, want) {
			t.Fatalf("the export is missing %q:\n%s", want, md)
		}
	}
	// A game has no runtime, so nothing should have written a timestamp for it.
	if strings.Contains(md, "- timestamp:") {
		t.Fatalf("a game's export carries a timestamp:\n%s", md)
	}

	bob := addUser(t, h, alice, "bob")
	if rec := bob.importFile("/import/markdown", "disco.md", []byte(md)); rec.Code != http.StatusOK {
		t.Fatalf("import: %d %s", rec.Code, rec.Body)
	}
	staged := queue(t, bob, "").Quotes
	if len(staged) != 2 {
		t.Fatalf("the queue collapsed one bark's two quests into %d row(s): %+v", len(staged), staged)
	}
	quests := map[string]string{}
	for _, q := range staged {
		quests[q.Quest] = q.Act
	}
	if quests["The Whirling-in-Rags"] != "1" || quests["Martinaise"] != "2" {
		t.Fatalf("the queue cannot show what it is about to approve: %+v", staged)
	}
	bob.mustDo("POST", "/import/staged/approve", map[string]any{"all": true}, http.StatusOK)

	dlgs := dialoguesOf(t, bob)
	if len(dlgs) != 2 {
		t.Fatalf("approval wrote %d line(s), want 2: %+v", len(dlgs), dlgs)
	}
	got := map[string]string{}
	for _, d := range dlgs {
		got[d.Quest] = d.Act
		if d.Timestamp != "" {
			t.Errorf("a game's line came back with a timestamp: %+v", d)
		}
	}
	if got["The Whirling-in-Rags"] != "1" || got["Martinaise"] != "2" {
		t.Fatalf("the locators were lost on approval: %+v", dlgs)
	}
}

// The other direction of the same gate: act and quest belong to a game, so a FILM
// file that carries them (hand-written, or a game retargeted onto a film in the
// queue) has them dropped rather than stored. Retargeting is a legitimate repair,
// which is why this is a clear and not a refusal — writeMovieDialogues' own
// comment, one medium over.
func TestAFilmFileDoesNotKeepAGamesLocator(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	md := "---\ntitle: Solaris\ntype: movie\n---\n\n> We don't want to conquer space at all.\n" +
		"- act: 3\n- quest: The Ocean\n- episode_name: Pilot\n- timestamp: 01:40:00\n"
	if rec := c.importApprove("/import/markdown", "solaris.md", []byte(md)); rec.Code != http.StatusOK {
		t.Fatalf("import: %d %s", rec.Code, rec.Body)
	}
	dlgs := dialoguesOf(t, c)
	if len(dlgs) != 1 {
		t.Fatalf("want one line, got %d", len(dlgs))
	}
	d := dlgs[0]
	if d.Act != "" || d.Quest != "" || d.EpisodeName != "" {
		t.Errorf("a film kept a locator it has no use for: %+v", d)
	}
	if d.Timestamp != "01:40:00" {
		t.Errorf("and it lost the one locator it does have: %+v", d)
	}
}

// ---- 3. a show's episode name ---------------------------------------------

// The episode's name, beside its number. Unlike act and quest this one is NOT in
// the dedupe hash — a name is a name for the episode, not a second episode — so
// it is also the field the enrichment arm can still fill in, which the second
// half of this test covers.
func TestAnEpisodeNameSurvivesItsOwnExport(t *testing.T) {
	h := newTestServer(t).Handler()
	alice := signupAdmin(t, h)

	show := newWork(t, alice, "The Wire", "show")
	newLine(t, alice, map[string]any{
		"movie_id": show, "quote": "All the pieces matter.",
		"season": 1, "episode": 6, "episode_name": "All Prologue", "timestamp": "00:22:10",
	})

	md := alice.mustDo("GET", "/movies/"+itoa(show)+"/export", nil, http.StatusOK).Body.String()
	if !strings.Contains(md, "- episode_name: All Prologue") {
		t.Fatalf("the export dropped the episode name:\n%s", md)
	}

	bob := addUser(t, h, alice, "bob")
	if rec := bob.importFile("/import/markdown", "wire.md", []byte(md)); rec.Code != http.StatusOK {
		t.Fatalf("import: %d %s", rec.Code, rec.Body)
	}
	if q := oneStaged(t, bob); q.EpisodeName != "All Prologue" {
		t.Fatalf("the queue cannot show what it is about to approve: %+v", q)
	}
	bob.mustDo("POST", "/import/staged/approve", map[string]any{"all": true}, http.StatusOK)

	dlgs := dialoguesOf(t, bob)
	if len(dlgs) != 1 || dlgs[0].EpisodeName != "All Prologue" {
		t.Fatalf("the episode name was lost on approval: %+v", dlgs)
	}

	// THE ENRICHMENT ARM. A second file naming the same line with the name filled
	// in has to donate it, and on a NOT NULL DEFAULT '' column the obvious
	// COALESCE spelling silently donates nothing.
	carol := addUser(t, h, alice, "carol")
	bare := "---\ntitle: The Wire\ntype: show\n---\n\n> All the pieces matter.\n- season: 1\n- episode: 6\n"
	if rec := carol.importApprove("/import/markdown", "wire-bare.md", []byte(bare)); rec.Code != http.StatusOK {
		t.Fatalf("first import: %d %s", rec.Code, rec.Body)
	}
	if got := dialoguesOf(t, carol); len(got) != 1 || got[0].EpisodeName != "" {
		t.Fatalf("the bare file should have landed without a name: %+v", got)
	}
	if rec := carol.importApprove("/import/markdown", "wire-named.md", []byte(md)); rec.Code != http.StatusOK {
		t.Fatalf("second import: %d %s", rec.Code, rec.Body)
	}
	got := dialoguesOf(t, carol)
	if len(got) != 1 {
		t.Fatalf("the second file forked a duplicate: %+v", got)
	}
	if got[0].EpisodeName != "All Prologue" {
		t.Fatalf("the second file did not donate the episode name: %+v", got[0])
	}
}

// THE QUEUE'S OWN ENRICHMENT ARM, which is a different code path from the live
// table's: two copies of one line inside ONE file collide on
// UNIQUE (staged_work_id, dedupe_hash) and the second donates whatever the first
// lacks, so nothing is lost before the reader has seen it.
//
// The episode name is the field that can actually change hands. Act and quest are
// IN the hash, so a collision means the copy already staged holds the same pair —
// stated at the call site rather than implemented as a donation that could never
// fire.
func TestTheQueueDonatesAnEpisodeNameBetweenTwoCopies(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	// One file, one work, the same line twice: bare first, named second.
	md := "---\ntitle: The Wire\ntype: show\n---\n\n" +
		"> All the pieces matter.\n- season: 1\n- episode: 6\n\n" +
		"> All the pieces matter.\n- season: 1\n- episode: 6\n- episode_name: All Prologue\n"
	staged := stage(t, c, "/import/markdown", "wire.md", []byte(md))
	if staged.Staged != 1 {
		t.Fatalf("two copies of one line should stage as one row, got %d", staged.Staged)
	}
	if q := oneStaged(t, c); q.EpisodeName != "All Prologue" {
		t.Fatalf("the second copy did not donate the episode name to the queue: %+v", q)
	}
}

// ---- 4. a standalone quote's five ----------------------------------------

// Region, recipient, work title, page and circa — the fields that make a proverb
// a proverb, a letter a letter and an essay an essay. Written for every quote
// whatever board it sits on, because the KIND lives on the board and the board
// does not round-trip yet: gating the file on the kind would lose a field the
// moment a reader moved the quote.
func TestAQuotesPerKindFieldsSurviveTheirOwnExport(t *testing.T) {
	h := newTestServer(t).Handler()
	alice := signupAdmin(t, h)

	newUtterance(t, alice, map[string]any{
		"quote":          "I have a bird in my hand.",
		"speaker":        "Rabindranath Tagore",
		"recipient":      "Jawaharlal Nehru",
		"occasion":       "a letter from Santiniketan",
		"occasion_date":  "1934",
		"occasion_circa": true,
		"place":          "Santiniketan",
		"region":         "Birbhum",
		"work_title":     "Letters to a Friend",
		"locator":        "p. 44",
	})

	md := exportQuotes(t, alice, nil)
	for _, want := range []string{
		"- recipient: Jawaharlal Nehru",
		"- occasion_date: 1934",
		"- circa: true",
		"- place: Santiniketan",
		"- region: Birbhum",
		"- work_title: Letters to a Friend",
		"- page: p. 44",
	} {
		if !strings.Contains(md, want) {
			t.Fatalf("the export is missing %q:\n%s", want, md)
		}
	}
	// The column is `locator` and the FILE KEY is `page`, on purpose — the
	// anthology export already owns "- locator:" for a joined display string. See
	// applyQuoteBinding.
	if strings.Contains(md, "- locator:") {
		t.Fatalf("the quotes export must not write the anthology's key:\n%s", md)
	}

	bob := addUser(t, h, alice, "bob")
	staged := stageQuotesMD(t, bob, "tippani-quotes.md", md)
	q := oneStaged(t, bob)
	if q.Region != "Birbhum" || q.Recipient != "Jawaharlal Nehru" ||
		q.WorkTitle != "Letters to a Friend" || q.Locator != "p. 44" || !q.OccasionCirca {
		t.Fatalf("the queue cannot show what it is about to approve: %+v", q)
	}
	approveBatch(t, bob, staged.BatchID)

	got := decode[utterancesResp](t, bob.mustDo("GET", "/quotes", nil, http.StatusOK)).Utterances
	if len(got) != 1 {
		t.Fatalf("approval wrote %d quote(s), want 1", len(got))
	}
	u := got[0]
	for _, f := range []struct{ name, got, want string }{
		{"region", u.Region, "Birbhum"},
		{"recipient", u.Recipient, "Jawaharlal Nehru"},
		{"work_title", u.WorkTitle, "Letters to a Friend"},
		{"locator", u.Locator, "p. 44"},
	} {
		if f.got != f.want {
			t.Errorf("%s came back %q, want %q", f.name, f.got, f.want)
		}
	}
	if !u.OccasionCirca {
		t.Errorf("the circa tick was lost in the round trip: %+v", u)
	}
}

// A quote with none of the five exports none of them, so a shelf written before
// 0047 diffs clean against a fresh export — the same rule the default colour and
// the residual category already follow.
func TestAQuoteWithNoPerKindFieldsWritesNoneOfThem(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	newUtterance(t, c, bose())

	md := exportQuotes(t, c, nil)
	for _, absent := range []string{"- region:", "- recipient:", "- work_title:", "- page:", "- circa:"} {
		if strings.Contains(md, absent) {
			t.Fatalf("an untouched quote exported %q:\n%s", absent, md)
		}
	}
}

// THE KEY COLLISION, and the reason the file says `page`. The anthology export
// writes "- locator:" for a JOINED DISPLAY STRING built in SQL — "7 · The Fall ·
// p. 288" — and applyQuoteBinding is shared by both parsers. Parsing `locator`
// would pour that whole string into utterances.locator on every anthology
// re-import, so a reader who turned the citations on would find their page field
// reading like a breadcrumb trail.
func TestAnAnthologyLocatorDoesNotBecomeAQuotesPage(t *testing.T) {
	h := newTestServer(t).Handler()
	alice := signupAdmin(t, h)

	book := decode[bookDetail](t, alice.mustDo("POST", "/books",
		map[string]any{"title": "A Book", "author": "An Author"}, http.StatusCreated))
	ann := decode[annotationRow](t, alice.mustDo("POST", "/annotations", map[string]any{
		"book_id": book.ID, "quote": "A passage worth keeping.",
		"chapter_no": 7, "chapter": "The Fall", "location": "p. 288",
	}, http.StatusCreated))
	a := newAnthology(t, alice, "With citations")
	addEntries(t, alice, a.ID, []map[string]any{{"kind": "book", "item_id": ann.ID}})
	setFields(t, alice, a.ID, "With citations", map[string]any{"show_locator": true})

	md := exportAnthology(t, alice, a.ID)
	if !strings.Contains(md, "- locator: 7 · The Fall · p. 288") {
		t.Fatalf("this fixture needs the anthology's locator line:\n%s", md)
	}

	bob := addUser(t, h, alice, "bob")
	staged := stageQuotesMD(t, bob, "citations.md", md)
	approveBatch(t, bob, staged.BatchID)

	got := decode[utterancesResp](t, bob.mustDo("GET", "/quotes", nil, http.StatusOK)).Utterances
	if len(got) != 1 {
		t.Fatalf("want one quote back, got %d", len(got))
	}
	if got[0].Locator != "" {
		t.Fatalf("an anthology's display locator was parsed as a page: %q", got[0].Locator)
	}
}

// ---- 5. a book's two languages -------------------------------------------

// Two of the three assertions, and the third is deliberately absent: the
// languages live on staged_works, whose LIST row does not report them, for the
// reason stagedWorkForApproval gives about translator and editor. So the file and
// the approved row are what there is to check — exactly the shape
// TestATranslatorSurvivesTheMarkdownRoundTrip settled on.
func TestABooksTwoLanguagesSurviveTheirOwnExport(t *testing.T) {
	h := newTestServer(t).Handler()
	alice := signupAdmin(t, h)

	book := decode[bookDetail](t, alice.mustDo("POST", "/books", map[string]any{
		"title": "Gora", "author": "Rabindranath Tagore",
		"language": "English", "orig_language": "Bengali",
	}, http.StatusCreated))
	alice.mustDo("POST", "/annotations", map[string]any{
		"book_id": book.ID, "quote": "A line from the novel.",
	}, http.StatusCreated)

	md := alice.mustDo("GET", "/books/"+itoa(book.ID)+"/export", nil, http.StatusOK).Body.String()
	for _, want := range []string{"language: English", "orig_language: Bengali"} {
		if !strings.Contains(md, want) {
			t.Fatalf("the export is missing %q:\n%s", want, md)
		}
	}

	bob := addUser(t, h, alice, "bob")
	if rec := bob.importApprove("/import/markdown", "gora.md", []byte(md)); rec.Code != http.StatusOK {
		t.Fatalf("import: %d %s", rec.Code, rec.Body)
	}
	list := decode[pagedBooks](t, bob.mustDo("GET", "/books", nil, http.StatusOK))
	if len(list.Books) != 1 {
		t.Fatalf("expected one imported book, got %d", len(list.Books))
	}
	got := decode[bookDetail](t, bob.mustDo("GET", "/books/"+itoa(list.Books[0].ID), nil, http.StatusOK))
	if got.Language != "English" || got.OrigLanguage != "Bengali" {
		t.Fatalf("the round trip lost a language: %+v", got)
	}
}

// THE FILL-EMPTY-ONLY RULE, both halves, because on a NOT NULL DEFAULT ” column
// each half fails to a DIFFERENT wrong spelling and either one alone would pass.
//
//	plain COALESCE(language, ?)      never fills  — COALESCE('', x) is ''
//	a bare assignment language = ?   always fills — and clobbers a hand correction
//
// Only NULLIF turns the stored empty string back into the NULL that COALESCE
// understands, which is the form the two credits already use (upsertImportBook).
func TestAReimportFillsAnEmptyLanguageAndOverwritesNeither(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	// HALF ONE: THE ROW HAS NOTHING AND THE FILE HAS BOTH, so both are filled in.
	bare := "---\ntitle: Gora\nauthor: Rabindranath Tagore\ntype: book\n---\n\n> A line from the novel.\n"
	if rec := c.importApprove("/import/markdown", "gora-bare.md", []byte(bare)); rec.Code != http.StatusOK {
		t.Fatalf("first import: %d %s", rec.Code, rec.Body)
	}
	books := decode[pagedBooks](t, c.mustDo("GET", "/books", nil, http.StatusOK))
	if len(books.Books) != 1 {
		t.Fatalf("want one book, got %d", len(books.Books))
	}
	id := books.Books[0].ID
	if got := decode[bookDetail](t, c.mustDo("GET", "/books/"+itoa(id), nil, http.StatusOK)); got.Language != "" {
		t.Fatalf("the bare file should have left the languages empty: %+v", got)
	}

	md := "---\ntitle: Gora\nauthor: Rabindranath Tagore\nlanguage: English\n" +
		"orig_language: Bengali\ntype: book\n---\n\n> A line from the novel.\n"
	if rec := c.importApprove("/import/markdown", "gora.md", []byte(md)); rec.Code != http.StatusOK {
		t.Fatalf("second import: %d %s", rec.Code, rec.Body)
	}
	if got := decode[bookDetail](t, c.mustDo("GET", "/books/"+itoa(id), nil, http.StatusOK)); got.Language != "English" || got.OrigLanguage != "Bengali" {
		t.Fatalf("a re-import did not fill the empty languages: %+v", got)
	}

	// HALF TWO: THE READER CORRECTS ONE BY HAND and re-imports the same file. What
	// is already on the row wins.
	c.mustDo("PUT", "/books/"+itoa(id), map[string]any{
		"title": "Gora", "author": "Rabindranath Tagore",
		"language": "English", "orig_language": "Bangla",
	}, http.StatusOK)
	if rec := c.importApprove("/import/markdown", "gora.md", []byte(md)); rec.Code != http.StatusOK {
		t.Fatalf("third import: %d %s", rec.Code, rec.Body)
	}
	got := decode[bookDetail](t, c.mustDo("GET", "/books/"+itoa(id), nil, http.StatusOK))
	if got.OrigLanguage != "Bangla" {
		t.Fatalf("a re-import overwrote a hand-corrected language: %q", got.OrigLanguage)
	}
}

// The same two halves for a book highlight's character, one table down. This is
// writeBookAnnotations' enrichment arm, which is a different statement from
// upsertImportBook's and gets the rule wrong in its own way: `character` is not in
// the dedupe hash, so the two copies below really do collide, and the guard's
// `character = ” AND ? <> ”` clause is what makes the UPDATE fire at all —
// `IS NOT NULL` would be true for the empty string and report an enrichment that
// donated nothing.
func TestAReimportFillsAnEmptyCharacterAndOverwritesNeither(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	bare := "---\ntitle: Moby-Dick\ntype: book\n---\n\n> Call me Ishmael.\n"
	named := "---\ntitle: Moby-Dick\ntype: book\n---\n\n> Call me Ishmael.\n- character: Ishmael\n"

	if rec := c.importApprove("/import/markdown", "moby-bare.md", []byte(bare)); rec.Code != http.StatusOK {
		t.Fatalf("first import: %d %s", rec.Code, rec.Body)
	}
	if got := annotationsOf(t, c); len(got) != 1 || got[0].Character != "" {
		t.Fatalf("the bare file should have landed without a character: %+v", got)
	}
	if rec := c.importApprove("/import/markdown", "moby.md", []byte(named)); rec.Code != http.StatusOK {
		t.Fatalf("second import: %d %s", rec.Code, rec.Body)
	}
	got := annotationsOf(t, c)
	if len(got) != 1 {
		t.Fatalf("the second file forked a duplicate highlight: %+v", got)
	}
	annID := got[0].ID
	if got[0].Character != "Ishmael" {
		t.Fatalf("the second file did not donate the character: %+v", got[0])
	}

	// And it does not overwrite: the reader renames the speaker, re-imports, keeps
	// their own word.
	c.mustDo("PUT", "/annotations/"+itoa(annID), map[string]any{
		"book_id": got[0].BookID, "quote": "Call me Ishmael.", "character": "The narrator",
	}, http.StatusOK)
	if rec := c.importApprove("/import/markdown", "moby.md", []byte(named)); rec.Code != http.StatusOK {
		t.Fatalf("third import: %d %s", rec.Code, rec.Body)
	}
	if after := annotationsOf(t, c); len(after) != 1 || after[0].Character != "The narrator" {
		t.Fatalf("a re-import overwrote a hand-corrected character: %+v", after)
	}
}

// ---- 6. what the library zip still does not carry -------------------------

// STATED RATHER THAN FIXED. GET /export zips books and movies only — there is no
// quotes member and never has been (handleExportAll's own kind list), so the five
// standalone-quote fields are not in the library zip because standalone quotes are
// not. That is a gap in the ZIP, not in this pass: POST /export/quotes is the
// endpoint that writes them and the account BACKUP carries every column of every
// table (VACUUM INTO, see the test below).
//
// The assertion exists so that adding a quotes member later is a deliberate act
// with a test to move, rather than something this file quietly implied was done.
func TestTheLibraryZipStillCarriesOnlyBooksAndFilms(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	c.mustDo("POST", "/books", map[string]any{"title": "A Book"}, http.StatusCreated)
	newUtterance(t, c, bose())

	body := c.mustDo("GET", "/export", nil, http.StatusOK).Body.String()
	if !strings.Contains(body, "books/") {
		t.Fatalf("the zip lost its books member")
	}
	if strings.Contains(body, "quotes/") {
		t.Fatal("the zip has grown a quotes member — welcome, but this test and " +
			"handleExportAll's kind list have to move together")
	}
}

// ---- 7. the two OTHER serialisations ---------------------------------------

// seedEveryNewField fills every column 0047 added, across all four kinds, and
// returns the ids needed to read them back. One seeder for the two tests below,
// because the thing they are both checking is "all of it", and two lists of
// fields would drift.
func seedEveryNewField(t *testing.T, c *testClient) (book, ann, game, line, quote int64) {
	t.Helper()
	book = decode[bookDetail](t, c.mustDo("POST", "/books", map[string]any{
		"title": "Gora", "author": "Rabindranath Tagore",
		"language": "English", "orig_language": "Bengali",
	}, http.StatusCreated)).ID
	ann = decode[annotationRow](t, c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book, "quote": "Call me Ishmael.", "character": "Ishmael",
	}, http.StatusCreated)).ID
	game = newWork(t, c, "Disco Elysium", "game")
	line = newLine(t, c, map[string]any{
		"movie_id": game, "quote": "You are the man with the hangover.",
		"act": "1", "quest": "The Whirling-in-Rags",
	}).ID
	quote = newUtterance(t, c, map[string]any{
		"quote": "I have a bird in my hand.", "speaker": "Rabindranath Tagore",
		"recipient": "Jawaharlal Nehru", "occasion_date": "1934", "occasion_circa": true,
		"region": "Birbhum", "work_title": "Letters to a Friend", "locator": "p. 44",
	}).ID
	return book, ann, game, line, quote
}

// assertEveryNewFieldIsThere reads all of it back through the app's own
// endpoints — what the reader would see — rather than counting columns.
func assertEveryNewFieldIsThere(t *testing.T, c *testClient, book, ann, line, quote int64) {
	t.Helper()
	b := decode[bookDetail](t, c.mustDo("GET", "/books/"+itoa(book), nil, http.StatusOK))
	if b.Language != "English" || b.OrigLanguage != "Bengali" {
		t.Errorf("the book's languages: %q / %q", b.Language, b.OrigLanguage)
	}
	anns := decode[pagedAnnotations](t, c.mustDo("GET", "/annotations?id="+itoa(ann), nil, http.StatusOK)).Annotations
	if len(anns) != 1 || anns[0].Character != "Ishmael" {
		t.Errorf("the highlight's character: %+v", anns)
	}
	dlgs := decode[dlgList](t, c.mustDo("GET", "/dialogues?id="+itoa(line), nil, http.StatusOK)).Dialogues
	if len(dlgs) != 1 || dlgs[0].Act != "1" || dlgs[0].Quest != "The Whirling-in-Rags" {
		t.Errorf("the game line's locator: %+v", dlgs)
	}
	us := decode[utterancesResp](t, c.mustDo("GET", "/quotes?id="+itoa(quote), nil, http.StatusOK)).Utterances
	if len(us) != 1 {
		t.Fatalf("the quote did not come back: %+v", us)
	}
	u := us[0]
	if u.Region != "Birbhum" || u.Recipient != "Jawaharlal Nehru" ||
		u.WorkTitle != "Letters to a Friend" || u.Locator != "p. 44" || !u.OccasionCirca {
		t.Errorf("the quote's per-kind fields: %+v", u)
	}
}

// THE ACCOUNT BACKUP IS A SECOND SERIALISATION, and the brief's own warning is
// that a field stored by the API and dropped by the backup is the failure worth
// hunting for. This is the test that says it is not happening.
//
// It passes because store.Backup is `VACUUM INTO` — a byte-level copy of the
// whole database file, which cannot know or care that eleven columns were added —
// and the restore swaps the file back and reopens it. That is an ARGUMENT, though,
// not a proof: it stops being true the day anybody replaces the snapshot with a
// per-table dump, and this is what would fail if they did.
//
// The divergence in the middle matters. Without it the restore could be a
// complete no-op and every assertion below would still pass.
func TestABackupAndRestoreKeepsEveryNewField(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	admin := signupAdmin(t, h)

	book, ann, _, line, quote := seedEveryNewField(t, admin)
	// A board of the kind 0047's widened vocabulary made legal — the one thing in
	// that migration that is not a column, and so the one thing a per-table dump
	// would be likeliest to get wrong.
	admin.mustDo("POST", "/boards", map[string]any{"name": "Speeches", "kind": "speech"}, http.StatusCreated)
	backupNow(admin)

	// Diverge: clear every one of them through a full-state PUT, which is exactly
	// what the API is for and exactly what the restore has to undo.
	admin.mustDo("PUT", "/books/"+itoa(book), map[string]any{"title": "Gora"}, http.StatusOK)
	admin.mustDo("PUT", "/annotations/"+itoa(ann),
		map[string]any{"book_id": book, "quote": "Call me Ishmael."}, http.StatusOK)
	admin.mustDo("PUT", "/quotes/"+itoa(quote),
		map[string]any{"quote": "I have a bird in my hand.", "speaker": "Rabindranath Tagore"}, http.StatusOK)
	if got := decode[bookDetail](t, admin.mustDo("GET", "/books/"+itoa(book), nil, http.StatusOK)); got.Language != "" {
		t.Fatalf("the divergence did not take, so the restore below proves nothing: %+v", got)
	}

	admin.mustDo("POST", "/admin/restore", map[string]any{"password": testPw}, http.StatusOK)

	// The old session may be stale — log in fresh against the restored DB, as
	// TestRestoreRoundTrip does.
	fresh := &testClient{t: t, h: h}
	lrec := fresh.do("POST", "/auth/login", map[string]string{"username": "alice", "password": testPw})
	if lrec.Code != http.StatusOK {
		t.Fatalf("login after restore: %d %s", lrec.Code, lrec.Body)
	}
	fresh.cookie = cookieOf(t, lrec)

	assertEveryNewFieldIsThere(t, fresh, book, ann, line, quote)
	boards := decode[boardsResp](t, fresh.mustDo("GET", "/boards", nil, http.StatusOK)).Boards
	found := false
	for _, b := range boards {
		if b.Name == "Speeches" && b.Kind == "speech" {
			found = true
		}
	}
	if !found {
		t.Errorf("the speech board did not survive the restore: %+v", boards)
	}
}

// THE BIN IS THE THIRD SERIALISATION: a delete parks a JSON snapshot of the
// row's whole subtree in `trash` and really deletes the row (0031). It survives a
// new column because every row is read with `SELECT *` and keyed by the column
// names the driver reports — trash.go's own "COLUMNS ARE DISCOVERED" rule, which
// exists because "a snapshot that lists its columns by hand is a snapshot that
// stops carrying the column added next release".
//
// This is the test that says the rule held for these eleven. It is cheap and the
// failure it guards against is not: a locator quietly reset to its default months
// after somebody restored a line from the bin.
func TestTheBinBringsBackEveryNewField(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	book, ann, _, line, quote := seedEveryNewField(t, c)
	// The book last: deleting it bins its highlight too, and restoring the book is
	// what brings the highlight's own character back.
	for _, path := range []string{
		"/dialogues/" + itoa(line), "/quotes/" + itoa(quote), "/books/" + itoa(book),
	} {
		c.mustDo("DELETE", path, nil, http.StatusOK)
	}
	bin := binOf(t, c).Trash
	if len(bin) != 3 {
		t.Fatalf("expected three bin entries, got %d: %+v", len(bin), bin)
	}
	for _, e := range bin {
		restore(t, c, e.ID, http.StatusOK)
	}
	assertEveryNewFieldIsThere(t, c, book, ann, line, quote)
}
