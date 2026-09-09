package httpapi

import (
	"net/http"
	"net/url"
	"strings"
	"testing"
)

// A quote can carry its own words in another script (0069).
//
// The owner's example is a Bengali proverb written three ways: the script, a
// romanisation of it, and what it means. The middle one had no column, and the
// reason it needs its own rather than sharing the translation's is that it says
// nothing about the meaning — so a deck that promised a translation and showed a
// romanisation would be prompting with the wrong thing, and a card drawing both
// from one column would print the sentence twice.
//
// The proverb, and the shape of the report:
//
//	অতি সন্ন্যাসীতে গাজন নষ্ট        the quote
//	Ati sannyasite gajon nosto      the transliteration
//	Too many ascetics ruin …        the translation
const (
	proverbBengali = "অতি সন্ন্যাসীতে গাজন নষ্ট"
	proverbRoman   = "Ati sannyasite gajon nosto"
	proverbMeaning = "Too many ascetics ruin the festival"
)

func TestAQuoteKeepsItsThreeTexts(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	u := newUtterance(t, c, map[string]any{
		"quote":           proverbBengali,
		"transliteration": proverbRoman,
		"translation":     proverbMeaning,
		"kind":            "proverb",
	})
	if u.Transliteration != proverbRoman {
		t.Fatalf("create dropped the transliteration: got %q", u.Transliteration)
	}
	// All three survive together, which is the claim: one of them arriving would
	// look identical to the reader until they opened the card.
	if u.Quote != proverbBengali || u.Translation != proverbMeaning {
		t.Fatalf("create lost one of the three: %q / %q / %q", u.Quote, u.Transliteration, u.Translation)
	}

	// THE READ IS A SEPARATE CLAIM FROM THE WRITE, and this is the pair that broke
	// for occasion_circa: it was accepted, stored, and never sent back, so it was
	// write-only across the whole app for a release. There is no single-quote GET —
	// the list is the read — and it is the right one to assert anyway, because the
	// card draws this field and a list that omitted it would leave every card
	// fetching its own quote again to render one line.
	list := decode[utterancesResp](t, c.mustDo("GET", "/quotes", nil, http.StatusOK))
	if len(list.Utterances) != 1 || list.Utterances[0].Transliteration != proverbRoman {
		t.Fatalf("list row lacks the transliteration: %+v", list.Utterances)
	}

	// Editable, and clearable — a romanisation somebody got wrong has to be
	// removable, not just replaceable.
	body := map[string]any{"quote": proverbBengali, "transliteration": "Oti shonnyashite gajon nosto", "color": "yellow"}
	c.mustDo("PUT", "/quotes/"+itoa(u.ID), body, http.StatusOK)
	after := decode[utterancesResp](t, c.mustDo("GET", "/quotes", nil, http.StatusOK))
	if after.Utterances[0].Transliteration != "Oti shonnyashite gajon nosto" {
		t.Fatalf("update did not take: got %q", after.Utterances[0].Transliteration)
	}
	body["transliteration"] = ""
	c.mustDo("PUT", "/quotes/"+itoa(u.ID), body, http.StatusOK)
	cleared := decode[utterancesResp](t, c.mustDo("GET", "/quotes", nil, http.StatusOK))
	if cleared.Utterances[0].Transliteration != "" {
		t.Fatalf("update could not clear it: got %q", cleared.Utterances[0].Transliteration)
	}
}

// THE WHOLE POINT OF WRITING IT DOWN IS TO FIND IT AGAIN. A reader on a keyboard
// that cannot produce Bengali letters types the romanisation, and the proverb has
// to come back — so the column is in utterances_fts, which cost a rebuild of the
// index and is the reason this test exists rather than a note saying it should.
func TestARomanisationFindsTheQuoteItRomanises(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	newUtterance(t, c, map[string]any{
		"quote":           proverbBengali,
		"transliteration": proverbRoman,
		"kind":            "proverb",
	})
	// A word that appears ONLY in the transliteration. Searching for a word the
	// quote itself contains would pass with the column left out of the index.
	res := decode[searchResults](t, c.mustDo("GET", "/search?q="+url.QueryEscape("sannyasite"), nil, http.StatusOK))
	if len(res.Quotes) != 1 {
		t.Fatalf("a romanised word did not find the quote: %d hits", len(res.Quotes))
	}
	if res.Quotes[0].Quote != proverbBengali {
		t.Fatalf("found the wrong row: %q", res.Quotes[0].Quote)
	}
}

// EVERY KIND, which is the owner's ruling ("All quote shall get one") and the
// thing a column on one table would have quietly failed. A Bengali line
// highlighted in a book wants this exactly as much as a proverb does.
func TestEveryKindOfQuoteTakesATransliteration(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	book := decode[bookDetail](t, c.mustDo("POST", "/books",
		map[string]any{"title": "গীতাঞ্জলি", "author": "Rabindranath Tagore"}, http.StatusCreated))
	ann := decode[annotationRow](t, c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book.ID, "quote": "আমার এ গান", "transliteration": "Amar e gaan",
	}, http.StatusCreated))
	if ann.Transliteration != "Amar e gaan" {
		t.Fatalf("a book highlight dropped it: %q", ann.Transliteration)
	}

	movie := decode[movieDetail](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "Pather Panchali"}, http.StatusCreated))
	dia := decode[dialogueRow](t, c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": movie.ID, "quote": "চল", "transliteration": "Chol",
	}, http.StatusCreated))
	if dia.Transliteration != "Chol" {
		t.Fatalf("a film line dropped it: %q", dia.Transliteration)
	}
}

// A FIELD THE EXPORT DROPS IS A FIELD A BACKUP LOSES. This app's own export is an
// importer's source, so the key has to be written — 0034 and 0047 both record
// what it costs when it is not.
func TestTheExportWritesTheTransliteration(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	newUtterance(t, c, map[string]any{
		"quote":           proverbBengali,
		"transliteration": proverbRoman,
		"translation":     proverbMeaning,
	})
	out := c.mustDo("POST", "/export/quotes", map[string]any{}, http.StatusOK).Body.String()
	if !strings.Contains(out, "transliteration: "+proverbRoman) {
		t.Fatalf("the quote export has no transliteration binding:\n%s", out)
	}
	// Beside the translation and not instead of it — three keys for three texts,
	// because an importer folding any two together is the merge 0051 undid.
	if !strings.Contains(out, "translation: "+proverbMeaning) {
		t.Fatalf("the export lost the translation while gaining the romanisation:\n%s", out)
	}
}
