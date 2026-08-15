package httpapi

// The starter proverbs.
//
// 0035 gave a quote a category, and a Proverbs board on a library that has never
// filed one is an empty screen with a ＋ on it — a feature you have to go and
// think of ten proverbs for before you can see what it does. The other two boards
// do not have this problem: Speeches and Others fill up from the same capture flow
// everything else uses, whereas nobody sits down and types in proverbs.
//
// SO IT IS OPT-IN, PER LANGUAGE, AND THAT IS THE WHOLE DESIGN. There is no boot
// hook, no backfill and no settings flag — every other seeder in this app has all
// three (see seedDefaultStickers), and this one deliberately has none.
//
// The difference is what is being seeded. A starter sticker is a TOOL: five marks
// to put beside a line, and handing them to everyone costs nothing because
// nobody's library is a library of stickers. A proverb is CONTENT. Putting thirty
// lines somebody never chose into a collection they have been keeping for a year
// is not a friendly default, it is the app writing in their book — and worse, the
// three boards then open onto a shelf whose Bengali section is entirely mine and
// none of theirs.
//
// So the offer appears on an empty board, names the language, and does nothing at
// all until it is asked. Ask for Bengali and you get the Bengali ten; the Hindi
// ten are still a separate question.
//
// IDEMPOTENT THROUGH THE ORDINARY DEDUPE HASH, not through a flag. These are
// plain `utterances` rows — INSERT OR IGNORE against (user_id, dedupe_hash) — so
// asking twice adds nothing the second time, and the count says so. The
// consequence, stated rather than discovered: a starter proverb you DELETED comes
// back if you ask for that language again. That is the honest behaviour for a
// button that says "add the Bengali ten", and it is only ever reachable by asking.
//
// `source` is 'seed', written server-side. captureSources deliberately does not
// list it — "only a real import may claim to be one" — so the provenance of these
// rows is something the server asserts and a client cannot forge.

import (
	"net/http"

	"tippani/internal/olog"
	"tippani/internal/store"
)

// seedProverb is one curated line. Translation is the English of it, and is empty
// for the English set — a translation of a line already in the reader's language
// would print the same words twice on the card.
type seedProverb struct {
	Quote       string
	Translation string
}

// starterProverbLanguages is the OFFER ORDER, and it is a slice because a map
// has none. Three languages, which is what was asked for; a fourth is this slice
// plus a block below and nothing else, because `language` is free text in 0035
// rather than an enum.
var starterProverbLanguages = []string{"Bengali", "English", "Hindi"}

// starterProverbs are ten per language, chosen for being genuinely proverbial —
// the kind of line a person quotes without attributing, which is what makes it a
// proverb rather than a quotation. None of them is attributed and none of them
// can be: a proverb with an author is somebody's aphorism, and the review deck
// reads exactly that absence to keep these out of the quiz.
var starterProverbs = map[string][]seedProverb{
	"Bengali": {
		{"চোরের মায়ের বড় গলা", "The thief's mother has the loudest voice"},
		{"অতি লোভে তাঁতি নষ্ট", "Too much greed ruined the weaver"},
		{"যত গর্জে তত বর্ষে না", "It rains less than it thunders"},
		{"অল্প বিদ্যা ভয়ংকরী", "A little learning is a dangerous thing"},
		{"নিজের নাক কেটে পরের যাত্রা ভঙ্গ", "Cutting off your own nose to spoil another's journey"},
		{"উপরে ফিটফাট ভিতরে সদরঘাট", "Spruce on the outside, a shambles within"},
		{"এক মাঘে শীত যায় না", "Winter does not pass in a single Magh"},
		{"আপনি বাঁচলে বাপের নাম", "Save yourself first, and your father's name after"},
		{"গাছে কাঁঠাল গোঁফে তেল", "The jackfruit is still on the tree and he is oiling his moustache"},
		{"যে রাঁধে সে চুলও বাঁধে", "She who cooks also braids her hair"},
	},
	"English": {
		{"Least said, soonest mended", ""},
		{"Still waters run deep", ""},
		{"A stitch in time saves nine", ""},
		{"Don't count your chickens before they hatch", ""},
		{"The proof of the pudding is in the eating", ""},
		{"Many hands make light work", ""},
		{"Fine words butter no parsnips", ""},
		{"A watched pot never boils", ""},
		{"Empty vessels make the most noise", ""},
		{"Necessity is the mother of invention", ""},
	},
	"Hindi": {
		{"अब पछताए होत क्या, जब चिड़िया चुग गई खेत", "What use is regret now, when the birds have eaten the field"},
		{"नाच न जाने आँगन टेढ़ा", "One who cannot dance complains the courtyard is crooked"},
		{"बंदर क्या जाने अदरक का स्वाद", "What does a monkey know of the taste of ginger"},
		{"अंधों में काना राजा", "Among the blind, the one-eyed man is king"},
		{"दूर के ढोल सुहावने", "Distant drums sound sweet"},
		{"जितनी चादर हो उतने पैर फैलाओ", "Stretch your legs only as far as your blanket reaches"},
		{"एक हाथ से ताली नहीं बजती", "One hand alone cannot clap"},
		{"काला अक्षर भैंस बराबर", "To the unlettered, black letters are so many buffaloes"},
		{"ऊँट के मुँह में जीरा", "A cumin seed in a camel's mouth"},
		{"जिसकी लाठी उसकी भैंस", "The buffalo belongs to whoever holds the stick"},
	},
}

// starterOffer is one entry in the offer the empty board draws its buttons from.
type starterOffer struct {
	Language string `json:"language"`
	Count    int    `json:"count"`
}

// handleListProverbStarters answers what is on offer.
//
// Served rather than hardcoded in the client for the usual reason: the counts on
// the buttons ("Add 10 Bengali proverbs") and the set actually inserted would be
// two lists to keep in step, and the one that drifts is the one nobody tests.
func (s *Server) handleListProverbStarters(w http.ResponseWriter, r *http.Request) {
	offers := make([]starterOffer, 0, len(starterProverbLanguages))
	for _, lang := range starterProverbLanguages {
		offers = append(offers, starterOffer{Language: lang, Count: len(starterProverbs[lang])})
	}
	writeJSON(w, http.StatusOK, map[string]any{"languages": offers})
}

// handleSeedProverbs writes one language's starter set into the caller's own
// library.
//
// One language per request, not "all of them": the point of the design is that
// asking for Bengali is not asking for Hindi.
func (s *Server) handleSeedProverbs(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Language string `json:"language"`
		// Which board they land on. The offer is made ON a board — an empty one —
		// so it files where it was accepted, exactly as capture inside a board
		// does. Absent means the default board.
		BoardID *int64 `json:"board_id"`
	}
	if !decodeBody(w, r, &req) {
		return
	}
	set, ok := starterProverbs[req.Language]
	if !ok {
		// Named, so a client typo does not read as "there are no proverbs".
		writeErr(w, http.StatusBadRequest, "no starter proverbs for "+req.Language)
		return
	}
	uid := userID(r)
	olog.Tracef("[seed] handleSeedProverbs uid=%v language=%q n=%d", uid, req.Language, len(set))

	tx, err := s.Store.DB.Begin()
	if err != nil {
		internalError(w, r, "begin tx", err)
		return
	}
	defer tx.Rollback()

	// Filed on the board that offered them. Without this the rows land with a
	// NULL board and appear on no shelf — the reader presses "Add 10 Bengali
	// proverbs", the board they are standing on stays empty, and the only sign it
	// worked at all is the count under All quotes.
	boardID, err := resolveBoard(tx, uid, req.BoardID)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "board not found")
		return
	}

	// One reservation for the batch, as writeUtterances does.
	ids := newIDBlock(tx, "utterances", len(set))
	added := 0
	for _, p := range set {
		id, err := ids.take()
		if err != nil {
			internalError(w, r, "reserve quote id", err)
			return
		}
		// No speaker, no occasion, no date, no place — the shape 0035 exists for,
		// and the hash is over the words alone because there is nothing else.
		res, err := tx.Exec(`
			INSERT OR IGNORE INTO utterances
			  (id, user_id, quote, color, category, language, translation, board_id, source, dedupe_hash)
			VALUES (?, ?, ?, 'yellow', 'proverb', ?, ?, ?, 'seed', ?)`,
			id, uid, p.Quote, req.Language, p.Translation, boardID,
			store.UtteranceDedupeHash(p.Quote, "", "", ""))
		if err != nil {
			internalError(w, r, "insert starter proverb", err)
			return
		}
		if n, _ := res.RowsAffected(); n > 0 {
			added++
		}
	}
	if err := tx.Commit(); err != nil {
		internalError(w, r, "commit tx", err)
		return
	}
	// `skipped` is the honest half of the answer: asking twice reports ten
	// skipped rather than ten added, so the screen can say nothing happened
	// instead of implying it wrote twenty rows.
	writeJSON(w, http.StatusOK, map[string]any{
		"language": req.Language,
		"added":    added,
		"skipped":  len(set) - added,
	})
}
