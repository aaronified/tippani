package httpapi

// "Who said this?" and "Who wrote this?" — the two questions whose answer is a
// PERSON rather than a work or a passage.
//
// The reviewer picks a face. dialogues.actor has been stored per line since 0003
// (auto-filled from the film's own cast on save), and `work_cast` holds the whole
// cast — so the hard, interesting distractors, the other people in this same
// film, are already on disk. No API call, exactly as the roadmap promised.
//
// THE CLASS IS ONE AND THE COLUMNS ARE THREE, which is why this file holds two
// attach functions rather than one. A film line has an ACTOR; a speech has a
// SPEAKER; a book highlight has neither, and the person behind it is the AUTHOR
// of the volume it sits in. Asking "who?" of all three from one function would
// mean a switch on kind inside every step of it — the pool, the answer, the chip
// — and the two halves genuinely differ in where the distractors come from: an
// actor's rivals are the rest of THIS film's cast, an author's are the people
// who wrote the books nearest to this one.
//
// UNTIL 3.0 THIS WAS SCREEN-ONLY, and that was never a fact about the question.
// A reader who turned "who said this?" on and kept a library of speeches was
// shown it for one kind of card in three and told nothing about why; a reader
// with no films at all had switched on a question that could never be asked. The
// per-kind table in directionsForMode is what says which kinds may be asked
// what, and it now says what the data has always supported.
//
// THE POOL IS THE MAPPING AND NOT movies.cast_json, and the argument for that is
// where the pool is loaded (quizPools, review_handlers.go) rather than here,
// because that is the code the next person will change. In short: the blob was
// frozen against the unattended bulk fill by 0048, which left this direction
// reading a column that an approved cast diff no longer updates; and the blob is
// '[]' for nearly every game, so a typed voice cast — the case the table exists
// for — could never be a distractor. Both stopped being true when the loader
// moved, and TestAGamesTypedVoiceCastFeedsTheQuiz (cast_speaker_test.go) is what
// says so.

import (
	"math/rand/v2"
	"strings"
)

// speakerMinOptions — fewer than three faces is a coin toss rather than a
// question, so a card that cannot reach three falls back to another direction.
// (Which it can now do for free: buildQuestion tries the rest of the table and
// ends at the flip card, which never fails.)
const speakerMinOptions = 3

// personChoices is the shared tail of both questions: fold the answer and the
// candidate distractors into one set of options, refuse anything thinner than
// speakerMinOptions, and hang a face on every one of them.
//
// `kind` is the chip's credit kind — actor / speaker / author — which is what
// the client looks the portrait up by, so it has to be the kind the People
// console files that person under and not merely a word that describes the
// question.
func personChoices(card *reviewCard, answer string, distractors []string, kind string, rng *rand.Rand) bool {
	opts, ans := choicesFrom(answer, distractors, quizOptions, rng)
	if len(opts) < speakerMinOptions {
		return false
	}
	card.Options = opts
	card.Answer = ans
	// Every option is a person, so every option gets a face — the other half of
	// the rule optionMeta states: a work is shown by its picture, a person by
	// their chip.
	card.OptionMeta = make([]optionMeta, len(opts))
	for i, o := range opts {
		card.OptionMeta[i] = optionMeta{Person: o, Kind: kind}
	}
	return true
}

// nameCollector accumulates distinct names, case-insensitively, never admitting
// the answer itself. Written once because both questions below need exactly it,
// and a second copy would be the place the two quietly diverged.
type nameCollector struct {
	answer string
	seen   map[string]bool
	out    []string
}

func newNameCollector(answer string) *nameCollector {
	return &nameCollector{answer: answer, seen: map[string]bool{strings.ToLower(answer): true}}
}

func (c *nameCollector) add(name string) {
	n := strings.TrimSpace(name)
	if n == "" || c.seen[strings.ToLower(n)] {
		return
	}
	c.seen[strings.ToLower(n)] = true
	c.out = append(c.out, n)
}

func (c *nameCollector) enough() bool { return len(c.out) >= quizOptions-1 }

// attachSpeaker fills a card's options with the people who might have said the
// line: a film's cast, or the speakers the library has heard from.
//
// DISTRACTORS COME FROM THIS FILM FIRST. Three actors the reader has quoted
// elsewhere make the answer guessable from familiarity; three from this film's
// own billing make it a question about the film. The wider pool is the fallback
// for a title whose cast was never fetched.
func attachSpeaker(card *reviewCard, ownKey string, p quizPools, seed int64) bool {
	answer, kind := "", ""
	switch card.Kind {
	case kindScreen:
		answer, kind = strings.TrimSpace(card.Actor), "actor"
	case kindUtterance:
		answer, kind = strings.TrimSpace(card.Speaker), "speaker"
		// A SPEECH WITH NO OCCASION IS TITLED BY ITS SPEAKER, so "who said this?"
		// and "which source is this from?" would be the same question with the
		// same four answers — and the reader would meet it twice as though it
		// were two. utteranceAttribution is what makes the title fall back to the
		// name, so comparing against Title is exactly the right test.
		if strings.EqualFold(answer, strings.TrimSpace(card.Title)) {
			return false
		}
	}
	if answer == "" {
		return false
	}
	rng := seededRand(seed)
	c := newNameCollector(answer)
	for _, a := range p.byKey[ownKey].cast {
		c.add(a)
	}
	// Then everyone else the library has heard speak, so a film with a thin cast
	// record — or a speech, which has no cast at all — still gets a question.
	if !c.enough() {
		var wider []string
		for _, w := range p.works {
			if w.key == ownKey {
				continue
			}
			switch w.kind {
			case kindScreen:
				wider = append(wider, w.cast...)
				wider = append(wider, w.actorNames...)
			case kindUtterance:
				// A speech's workRef carries its speaker in `author` — see the
				// field's comment. Other people who have given speeches are the
				// natural wrong answers for one.
				wider = append(wider, w.author)
			}
		}
		shuffleN(rng, len(wider), func(i, j int) { wider[i], wider[j] = wider[j], wider[i] })
		for _, a := range wider {
			c.add(a)
		}
	}
	return personChoices(card, answer, c.out, kind, rng)
}

// attachAuthor fills a book card's options with author credits — "who wrote the
// book this is from?".
//
// THE CREDIT IS OFFERED AS STORED, joint credits and all. "Gaiman & Pratchett"
// is one answer because it is one book's author line, and splitting it here
// would offer two options that are each half right — which is not a harder
// question, it is an unanswerable one.
//
// DISTRACTORS ARE THE AUTHORS OF THE NEAREST BOOKS, ranked by the same
// similarity the "which book?" card uses: someone who writes the same genre is a
// real hesitation, someone from the other end of the library is not.
func attachAuthor(card *reviewCard, ownKey string, p quizPools, seed int64) bool {
	if card.Kind != kindBook {
		return false
	}
	answer := strings.TrimSpace(card.Author)
	if answer == "" {
		return false
	}
	rng := seededRand(seed)
	c := newNameCollector(answer)
	for _, w := range rankWorks(p.byKey[ownKey], p.works, rng) {
		if w.kind != kindBook || w.key == ownKey {
			continue
		}
		c.add(w.author)
		if c.enough() {
			break
		}
	}
	return personChoices(card, answer, c.out, "author", rng)
}
