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
	"regexp"
	"sort"
	"strings"
	"unicode"

	"tippani/internal/metadata"
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
func personChoices(card *reviewCard, answer string, distractors []string, kind string, rng *rand.Rand, tier string) bool {
	opts, ans := choicesFrom(answer, distractors, tierOptions(tier), rng)
	// THE FLOOR FOLLOWS THE TIER. Easy offers two faces on purpose, so holding it
	// to three would mean the tier could never draw the card it is defined by —
	// see tierMinOptions.
	if len(opts) < tierMinOptions(tier) {
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

// enough — as many distractors as the widest tier will use. Counted against the
// ceiling rather than the tier in force, so a collector filled for one tier is
// never short for another; choicesFrom takes what it needs from the top.
func (c *nameCollector) enough() bool { return len(c.out) >= quizOptions-1 }

// attachSpeaker fills a card's options with the people who might have said the
// line: a film's cast, or the speakers the library has heard from.
//
// DISTRACTORS COME FROM THIS FILM FIRST. Three actors the reader has quoted
// elsewhere make the answer guessable from familiarity; three from this film's
// own billing make it a question about the film. The wider pool is the fallback
// for a title whose cast was never fetched.
func attachSpeaker(card *reviewCard, ownKey string, p quizPools, seed int64, tier string) bool {
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
	// BEFORE THE OPTIONS ARE BUILT, so a line that is nothing but its own
	// speaker's name costs a refusal rather than a pool scan — and so the card
	// that reaches the reader is never one whose words gave the answer away.
	if !hideTheAnswer(card, answer) {
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
	return personChoices(card, answer, c.out, kind, rng, tier)
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
func attachAuthor(card *reviewCard, ownKey string, p quizPools, seed int64, tier string) bool {
	if card.Kind != kindBook {
		return false
	}
	answer := strings.TrimSpace(card.Author)
	if answer == "" {
		return false
	}
	if !hideTheAnswer(card, answer) {
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
	return personChoices(card, answer, c.out, "author", rng, tier)
}

// ---- the answer must not be printed above its own options --------------------
//
// THE LEAK. A `speaker` or `author` card shows the WORDS and asks who is behind
// them (review.jsx's prompt side sends every direction but "quote" down
// QuoteBlock). So a line whose own text names that person answers the question
// before it is asked, and the reader picks the option they can already read.
//
// WHAT IT IS NOT. An earlier reading of this had it as "mask every character and
// actor name in the line", which is wrong for the commonest case: a film line's
// answer is the ACTOR, and a line naming its CHARACTER — "frankly, my dear
// Scarlett" — gives the actor away only to a reader who knows the film, which is
// precisely what the card is asking. Masking that would blank half the dialogue
// in the library to remove knowledge the question is testing for. What leaks is
// the ANSWER STRING, so that is what is hidden.
//
// A JOINT CREDIT IS ALSO ITS PARTS. "Gaiman & Pratchett" is one option, and a
// line containing "Pratchett" picks it out just as surely as the whole string
// would, so each split credit is masked too. Split by the FULL default
// separator set rather than by the reader's creditSeparators preference, and
// deliberately: this is hiding an answer rather than rendering a credit, so
// splitting more aggressively than the reader asked for hides more and
// reveals nothing.

// maskName is one string to hide, and whether case may be ignored while looking
// for it.
//
// A FULL NAME IS UNAMBIGUOUS IN ANY CASE; A BARE SURNAME IS NOT. "as pratchett
// put it" is the name however it is typed, so the full credit and its parts fold
// case. A surname on its own is a different matter: "Stephen King" would have
// this masking "the king was dead" in every line of the library. So a surname is
// matched case-SENSITIVELY, which is the discriminator that actually works —
// prose naming a person capitalises them, and prose using the same word as a
// common noun does not.
type maskName struct {
	text string
	fold bool
}

// answerNames is the answer, every credit inside it, and each credit's surname —
// longest first, so a name that contains a shorter one is masked whole rather
// than in pieces.
func answerNames(answer string) []maskName {
	out := []maskName{}
	seen := map[string]bool{}
	// TWO RUNES, NOT THREE, AND THE DIFFERENCE IS A WHOLE CLASS OF NAME. The floor
	// was 3 with nothing said about it, which silently dropped "Wu", "Li", "Ai" —
	// and every two-character CJK name, where two characters is a FULL name:
	// 鲁迅 produced an empty list, so hideTheAnswer masked nothing, returned true,
	// and the card went out with its answer in plain view.
	//
	// One rune is still refused: a single letter is an initial, and blanking every
	// standalone "A" or "I" in a library would be redaction rather than masking.
	add := func(s string, fold bool) {
		s = strings.TrimSpace(strings.Trim(s, ".,;:"))
		if len([]rune(s)) < 2 || seen[strings.ToLower(s)] {
			return
		}
		seen[strings.ToLower(s)] = true
		out = append(out, maskName{text: s, fold: fold})
	}
	add(answer, true)
	for _, part := range metadata.SplitCredits(answer, metadata.ParseCreditSeps(defaultCreditSeps)) {
		add(part, true)
		// The last word of a multi-word credit. A one-word credit IS the whole
		// answer and is already above, so this only ever adds a surname lifted out
		// of a longer name — which is how a person is referred to in prose, and the
		// spelling a joint credit is most often leaked by.
		if f := strings.Fields(part); len(f) > 1 {
			add(f[len(f)-1], false)
		}
	}
	sort.SliceStable(out, func(i, j int) bool { return len(out[i].text) > len(out[j].text) })
	return out
}

// maskNames blanks each name wherever it stands as a word.
//
// A REGEXP RATHER THAN AN INDEX SCAN, because case-insensitive matching by
// lowercasing both sides and slicing by the offsets is only correct while
// folding preserves byte length, which it does not for every script this app
// accepts. `(?i)` folds by rune, and the boundary is stated as "not a letter or
// a number" rather than as `\b`, which is an ASCII-word rule and would refuse to
// fire on a Bengali or Devanagari line — the scripts the plan specifically wants
// this to reach.
func maskNames(text string, names []maskName) string {
	for _, n := range names {
		if text == "" {
			return text
		}
		fold := ""
		if n.fold {
			fold = "(?i)"
		}
		pat := fold + `(^|[^\p{L}\p{N}])(` + regexp.QuoteMeta(n.text) + `)([^\p{L}\p{N}]|$)`
		if !spacedScript(n.text) {
			// A SCRIPT WITH NO WORD SPACES HAS NO WORD BOUNDARIES TO ASK FOR.
			// 鲁迅 inside 这是鲁迅先生说过的话 is a name in running text and there is no
			// non-letter either side of it, ever — so the boundary rule, which is
			// what makes a Latin surname safe to match, would leave every such name
			// standing. Matched bare instead. The trade is the mirror of the
			// case-sensitivity rule: a Han name is short and specific enough that a
			// bare match is safe, where a bare "king" would not be.
			pat = regexp.QuoteMeta(n.text)
		}
		re := regexp.MustCompile(pat)
		rep := "${1}" + clozeBlank + "${3}"
		if !spacedScript(n.text) {
			rep = clozeBlank
		}
		// UNTIL IT STOPS CHANGING, because the boundary characters are CONSUMED by
		// the match. "King King said so" left the second King standing: the space
		// between them belonged to the first match, so the second had no boundary
		// left to start on. Each pass strictly reduces the letters in the text, so
		// this terminates; the cap is belt for a pattern that could somehow match
		// its own replacement.
		for i := 0; i < 8; i++ {
			next := re.ReplaceAllString(text, rep)
			if next == text {
				break
			}
			text = next
		}
	}
	return text
}

// spacedScript — does this name belong to a script that separates words with
// spaces? Han, the kana, Thai, Lao, Khmer and Myanmar do not, so a name written
// in one of them can never sit between two non-letters in running text.
//
// ANY such rune decides it, rather than all: a name is one name whatever it
// mixes, and the question being asked is whether a word boundary can be relied
// on to appear beside it. One Han character in the middle answers no.
func spacedScript(name string) bool {
	for _, r := range name {
		for _, t := range []*unicode.RangeTable{
			unicode.Han, unicode.Hiragana, unicode.Katakana,
			unicode.Thai, unicode.Lao, unicode.Khmer, unicode.Myanmar,
		} {
			if unicode.Is(t, r) {
				return false
			}
		}
	}
	return true
}

// hasWordsLeft — is there anything still to read?
func hasWordsLeft(text string) bool {
	for _, r := range text {
		if unicode.IsLetter(r) || unicode.IsNumber(r) {
			return true
		}
	}
	return false
}

// hideTheAnswer masks a person card's own answer in the words it shows, and
// REFUSES the card when that leaves nothing to read — the same rule
// TestClozeRefusesWhatItCannotAsk already applies to a quote that is all
// stopwords. A line that is only its speaker's name is not a question, and
// buildQuestion falls through to another direction rather than serving it.
func hideTheAnswer(card *reviewCard, answer string) bool {
	names := answerNames(answer)
	quote, note := maskNames(card.Quote, names), maskNames(card.Note, names)
	if !hasWordsLeft(quote) && !hasWordsLeft(note) {
		return false
	}
	card.Quote, card.Note = quote, note
	return true
}
