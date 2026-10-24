package httpapi

// The starter proverbs (0035).
//
// The rules worth pinning are all about RESTRAINT rather than about the writing:
// nothing arrives unasked, one language is not three, and asking twice does not
// double the shelf. The curated text itself is data — what these tests hold it to
// is that every line is shaped like a proverb, because a line with a speaker is
// somebody's aphorism and would land in the review deck, which is the one place
// a proverb must never be.

import (
	"net/http"
	"strings"
	"testing"
)

type starterOffersResp struct {
	Languages []starterOffer `json:"languages"`
}

type seedResp struct {
	Language string `json:"language"`
	Added    int    `json:"added"`
	Skipped  int    `json:"skipped"`
}

// NOTHING ARRIVES UNASKED. Every other seeder in this app runs at boot for every
// account; this one must not, because a proverb is content and the other things
// seeded are tools. A fresh library has an empty Proverbs board until somebody
// presses the button.
func TestAFreshLibraryHasNoProverbs(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	got := decode[utterancesResp](t, c.mustDo("GET", "/quotes", nil, http.StatusOK))
	if len(got.Utterances) != 0 {
		t.Fatalf("a new account must not be given quotes it never chose: %+v", got.Utterances)
	}
}

// ASKING FOR ONE LANGUAGE IS NOT ASKING FOR THE OTHERS. This is the whole reason
// the endpoint takes a language rather than seeding the lot.
func TestSeedingOneLanguageLeavesTheOthersAlone(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	res := decode[seedResp](t, c.mustDo("POST", "/quotes/starters",
		map[string]any{"language": "Bengali"}, http.StatusOK))
	if res.Added != 10 || res.Skipped != 0 {
		t.Fatalf("first ask: %+v", res)
	}

	all := decode[utterancesResp](t, c.mustDo("GET", "/quotes", nil, http.StatusOK))
	if len(all.Utterances) != 10 {
		t.Fatalf("expected exactly the Bengali ten, got %d", len(all.Utterances))
	}
	for _, u := range all.Utterances {
		if u.Category != "proverb" {
			t.Errorf("%q filed as %q", u.Quote, u.Category)
		}
		if u.Language != "Bengali" {
			t.Errorf("%q is in %q", u.Quote, u.Language)
		}
		// A PROVERB HAS NO ATTRIBUTION, and the review deck reads exactly this to
		// keep these out of the quiz — there is nothing to recall but the words
		// already on the card. A seeded line with a speaker would enter the deck.
		if u.Speaker != "" || u.Occasion != "" {
			t.Errorf("%q arrived attributed: speaker=%q occasion=%q", u.Quote, u.Speaker, u.Occasion)
		}
		if u.Translation == "" {
			t.Errorf("%q came without its English", u.Quote)
		}
	}

	// Hindi is still a separate question.
	hindi := decode[utterancesResp](t, c.mustDo("GET", "/quotes?language=Hindi", nil, http.StatusOK))
	if len(hindi.Utterances) != 0 {
		t.Fatalf("asking for Bengali must not have seeded Hindi: %d", len(hindi.Utterances))
	}
}

// Idempotent through the ordinary dedupe hash rather than a flag, and the count
// says so — ten skipped, not ten added, so the screen can report that nothing
// happened instead of implying it wrote twenty rows.
func TestAskingTwiceAddsNothing(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	body := map[string]any{"language": "Hindi"}
	c.mustDo("POST", "/quotes/starters", body, http.StatusOK)
	again := decode[seedResp](t, c.mustDo("POST", "/quotes/starters", body, http.StatusOK))
	if again.Added != 0 || again.Skipped != 10 {
		t.Fatalf("second ask should add nothing: %+v", again)
	}

	all := decode[utterancesResp](t, c.mustDo("GET", "/quotes", nil, http.StatusOK))
	if len(all.Utterances) != 10 {
		t.Fatalf("the shelf doubled: %d", len(all.Utterances))
	}
}

func TestAnUnknownStarterLanguageIsRefusedByName(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	rec := c.mustDo("POST", "/quotes/starters", map[string]any{"language": "Marathi"}, http.StatusBadRequest)
	if !strings.Contains(rec.Body.String(), "Marathi") {
		t.Fatalf("the refusal should name the language asked for: %s", rec.Body.String())
	}
}

// One account's starter set is not another's. The seeder writes with an explicit
// user_id, and utterances are the one kind whose ownership is a column rather
// than a parent join — the property every query in utterance_handlers.go carries
// its own WHERE for.
func TestSeededProverbsStayInTheirAccount(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	admin := signupAdmin(t, h)
	bob := addUser(t, h, admin, "bob")

	admin.mustDo("POST", "/quotes/starters", map[string]any{"language": "Bengali"}, http.StatusOK)

	got := decode[utterancesResp](t, bob.mustDo("GET", "/quotes", nil, http.StatusOK))
	if len(got.Utterances) != 0 {
		t.Fatalf("bob can see quotes seeded for the admin: %+v", got.Utterances)
	}
	// And bob can still take his own copy — the dedupe hash is scoped per user, so
	// the admin already holding these lines does not block him.
	res := decode[seedResp](t, bob.mustDo("POST", "/quotes/starters",
		map[string]any{"language": "Bengali"}, http.StatusOK))
	if res.Added != 10 {
		t.Fatalf("bob's own set: %+v", res)
	}
}
