package httpapi

// fillSearchCharacterImages attaches each dialogue hit's character pictures, in
// ONE query for the whole response.
//
// A SINGLE PASS AT THE END, rather than at each of the six places a dialogue hit
// is produced. The sections are assembled independently by design — that is what
// makes each one's query simple — and threading the lookup through all of them
// would mean six chances to forget it, on a field whose absence looks exactly
// like "this role has no picture".
//
// THE COST OF THAT CHOICE, stated: a section added later is not covered until its
// slice is named here. The compiler cannot help, because the miss is a field left
// empty rather than a type error. `everyDialogueHit` is the one list to extend,
// and TestSearchHitsCarryCharacterPictures walks the sections it names.
func (s *Server) fillSearchCharacterImages(uid int64, res *searchResults) {
	if res == nil {
		return
	}
	groups := everyDialogueHit(res)
	refs := []characterImageRef{}
	for _, hits := range groups {
		for _, h := range hits {
			if h.Character != "" {
				refs = append(refs, characterImageRef{WorkID: h.MovieID, Character: h.Character})
			}
		}
	}
	found := s.loadCharacterImages(uid, "movie", refs)
	seps := s.creditSeps(uid)
	for _, hits := range groups {
		for i := range hits {
			hits[i].CharacterImages = characterImagesFor(found, seps, hits[i].MovieID, hits[i].Character)
		}
	}
}

// everyDialogueHit names every slice of dialogue hits in a response. The slices
// are returned rather than copied, so writing through them writes into the
// response.
//
// The ACTORS section is included deliberately even though its chips draw the
// actor: the client decides which face to show from the section it is rendering,
// so the data is there either way and a reader who expands an actor's line still
// sees the character named. Withholding it here would make the client's choice
// depend on what the server guessed the reader meant.
func everyDialogueHit(res *searchResults) [][]dialogueHit {
	out := [][]dialogueHit{res.Dialogues, res.Notes.Dialogues}
	for _, a := range res.Actors {
		out = append(out, a.Dialogues)
	}
	for _, c := range res.Characters {
		out = append(out, c.Dialogues)
	}
	for _, tg := range res.Tags {
		out = append(out, tg.Dialogues)
	}
	if res.DateAdded != nil {
		out = append(out, res.DateAdded.Dialogues)
	}
	// Movies, Genres and Decade carry no dialogue hits — they group WORKS, and a
	// work's lines arrive through res.Dialogues. Named here so the next reader does
	// not have to check three structs to be sure they were not forgotten.
	return out
}
