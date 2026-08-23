package httpapi

// "Who said this?" — a screen-only review direction whose options are ACTORS.
//
// The reviewer picks a face. dialogues.actor has been stored per line since 0003
// (auto-filled from the film's own cast on save), and `work_cast` holds the whole
// cast — so the hard, interesting distractors, the other people in this same
// film, are already on disk. No API call, exactly as the roadmap promised.
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

import "strings"

// speakerMinOptions — fewer than three faces is a coin toss rather than a
// question, so a card that cannot reach three falls back to another direction.
// (Which it can now do for free: buildQuestion tries the rest of the table and
// ends at the flip card, which never fails.)
const speakerMinOptions = 3

// attachSpeaker fills a screen card's options with actor names.
//
// DISTRACTORS COME FROM THIS FILM FIRST. Three actors the reader has quoted
// elsewhere make the answer guessable from familiarity; three from this film's
// own billing make it a question about the film. The wider pool is the fallback
// for a title whose cast was never fetched.
func attachSpeaker(card *reviewCard, ownKey string, p quizPools, seed int64) bool {
	if card.Kind != kindScreen || strings.TrimSpace(card.Actor) == "" {
		return false
	}
	answer := strings.TrimSpace(card.Actor)
	rng := seededRand(seed)
	same := strings.EqualFold

	var distractors []string
	seen := map[string]bool{strings.ToLower(answer): true}
	add := func(name string) {
		n := strings.TrimSpace(name)
		if n == "" || seen[strings.ToLower(n)] || same(n, answer) {
			return
		}
		seen[strings.ToLower(n)] = true
		distractors = append(distractors, n)
	}
	for _, a := range p.byKey[ownKey].cast {
		add(a)
	}
	// Then everyone else the library knows, so a film with a thin cast record
	// still gets a question.
	if len(distractors) < quizOptions-1 {
		var wider []string
		for _, w := range p.works {
			if w.kind != kindScreen || w.key == ownKey {
				continue
			}
			wider = append(wider, w.cast...)
			wider = append(wider, w.actorNames...)
		}
		shuffleN(rng, len(wider), func(i, j int) { wider[i], wider[j] = wider[j], wider[i] })
		for _, a := range wider {
			add(a)
		}
	}
	opts, ans := choicesFrom(answer, distractors, quizOptions, rng)
	if len(opts) < speakerMinOptions {
		return false
	}
	card.Options = opts
	card.Answer = ans
	// Every option is a person, so every option gets a face. The client already
	// renders option_meta as a PersonChip.
	card.OptionMeta = make([]optionMeta, len(opts))
	for i, o := range opts {
		card.OptionMeta[i] = optionMeta{Person: o, Kind: "actor"}
	}
	return true
}
