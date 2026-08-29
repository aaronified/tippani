package metadata

// TheTVDB as a PICTURE source, which is a different question from TheTVDB as a
// record source and needed a different pair of calls.
//
// WHY THIS FILE EXISTS AT ALL. `details` already brings back a character's art
// and an actor's headshot — it is the only supplier that has the first of those —
// but it brings them back as a by-product of fetching a WORK: capped at maxCast,
// filtered to peopleType=="Actor", and shaped as a cast list for a film page.
// The picture strip asks a narrower question ("show me pictures of this role")
// and a wider one ("show me every portrait you have of this person"), and neither
// is answerable by re-reading a cast list.
//
// THE STRIP WANTS SEVERAL AND THE CAST LIST HAS ONE. A picker exists so somebody
// can reject the first picture, so `artworks` matters here in a way it never did
// for a cast row: a person's extended record carries every portrait TheTVDB
// holds, and the cast payload carries only the one it considers primary.

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"unicode"
)

// PersonImages returns every portrait TheTVDB holds for one person id, primary
// first. A person with no art is not an error — it is the ordinary case for a
// bit-part actor and answers with no hits.
//
// THE ID IS THEIRS, NOT TMDB'S. `peopleId` off the extended cast payload is what
// this takes (stored as `work_cast.person_id` when the row came from TheTVDB),
// which is exactly the id the portrait resolver has been holding and throwing
// away for want of a client to hand it to.
func (t *TVDB) PersonImages(ctx context.Context, id string) ([]ImageHit, error) {
	id = strings.TrimSpace(id)
	if id == "" {
		return nil, nil
	}
	body, err := t.authGet(ctx, "/people/"+id+"/extended", nil)
	if err != nil {
		return nil, err
	}
	var r struct {
		Data struct {
			Name     string `json:"name"`
			Image    string `json:"image"`
			Artworks []struct {
				Image     string `json:"image"`
				Thumbnail string `json:"thumbnail"`
			} `json:"artworks"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &r); err != nil {
		return nil, fmt.Errorf("tvdb: %w", err)
	}
	// Primary first, then the rest. Deduped because the primary is normally also
	// present in `artworks`, and a strip that offers the same picture twice reads
	// as a bug in the strip rather than as a duplicate upstream.
	seen := map[string]bool{}
	var out []ImageHit
	add := func(full, thumb string) {
		full = strings.TrimSpace(full)
		if full == "" || seen[full] || len(out) >= maxImageHits {
			return
		}
		seen[full] = true
		// artworks.thetvdb.com is already an allowed <img> host, so the strip can
		// draw the real picture and Thumb stays empty — see ImageHit's contract.
		// A thumbnail is offered only when TheTVDB has a genuinely smaller one.
		if strings.TrimSpace(thumb) == full {
			thumb = ""
		}
		out = append(out, ImageHit{URL: full, Thumb: strings.TrimSpace(thumb), Source: "tvdb"})
	}
	add(r.Data.Image, "")
	for _, a := range r.Data.Artworks {
		add(a.Image, a.Thumbnail)
	}
	return out, nil
}

// CharacterImages returns the art TheTVDB holds for one ROLE in one work.
//
// A WORK ID IS REQUIRED AND THAT IS NOT AN OVERSIGHT. TheTVDB has no
// character-by-name search: a role is a row on a work's extended record, so the
// only way to reach "V" is to ask for V for Vendetta and read its characters.
// Every caller that has a pinned title already has this id; a hand-typed
// character on a book has neither, and falls to the next tier instead.
//
// MATCHED ON THE ROLE, LOOSELY. The name on a quote is what the reader typed and
// the name on the record is what TheTVDB spells it — "V" against "V", but also
// "Agent Smith" against "Smith". So the compare is case- and space-folded, and an
// exact hit wins over a contained one: a work with both "Smith" and "Agent Smith"
// must not answer the first with the second.
//
// THE ACTOR'S HEADSHOT IS NOT OFFERED HERE, deliberately, even though this
// payload carries it and TheTVDB's own site falls back to it. This function
// answers "pictures of the ROLE"; the strip's own ladder decides what to do when
// there are none, and a headshot arriving under the character tier would make
// that fallback invisible to the reader choosing.
func (t *TVDB) CharacterImages(ctx context.Context, mediaType, workID, character string) ([]ImageHit, error) {
	workID, character = strings.TrimSpace(workID), strings.TrimSpace(character)
	if workID == "" || character == "" {
		return nil, nil
	}
	path := "/movies/" + workID + "/extended"
	if mediaType == "show" {
		path = "/series/" + workID + "/extended"
	}
	body, err := t.authGet(ctx, path, nil)
	if err != nil {
		return nil, err
	}
	var r tvdbExtended
	if err := json.Unmarshal(body, &r); err != nil {
		return nil, fmt.Errorf("tvdb: %w", err)
	}
	want := foldRole(character)
	wantWords := splitRoleWords(character)
	var exact, loose []ImageHit
	for _, c := range r.Data.Characters {
		img := strings.TrimSpace(c.Image)
		if img == "" {
			continue
		}
		got := foldRole(c.Name)
		switch {
		case got == want:
			exact = append(exact, ImageHit{URL: img, Source: "tvdb"})
		case roleWordsMatch(wantWords, splitRoleWords(c.Name)):
			loose = append(loose, ImageHit{URL: img, Source: "tvdb"})
		}
	}
	out := append(exact, loose...)
	if len(out) > maxImageHits {
		out = out[:maxImageHits]
	}
	return out, nil
}

// roleWordsMatch reports whether two role names are plausibly the same role,
// comparing WHOLE WORDS and never substrings.
//
// THE SUBSTRING VERSION SHIPPED AND WAS WRONG WITHIN ONE REAL QUERY. Matching
// "contains" in either direction reads well against the examples you think of —
// "Smith" ought to find "Agent Smith" — and then a reader asks for V, whose name
// is one letter, and every role containing the letter v matches: V for Vendetta
// answered with V's mask AND Evey Hammond. A short name is not a rare edge here;
// it is a whole convention of character naming (V, M, Q, Neo, Trinity).
//
// So every word of the shorter name has to appear as a WORD in the longer one.
// "smith" is a word of "agent smith" and matches; "v" is not a word of "evey
// hammond" and does not. The empty name matches nothing, rather than everything.
func splitRoleWords(s string) []string { return strings.Fields(foldRole(s)) }

func roleWordsMatch(a, b []string) bool {
	if len(a) == 0 || len(b) == 0 {
		return false
	}
	short, long := a, b
	if len(short) > len(long) {
		short, long = long, short
	}
	have := make(map[string]bool, len(long))
	for _, w := range long {
		have[w] = true
	}
	for _, w := range short {
		if !have[w] {
			return false
		}
	}
	return true
}

// foldRole is the loose compare used to match a typed character against the name
// on a record. It is NOT store.CastKey and must not be mistaken for it: that fold
// is the storage key two rows are merged on, and this one only decides which
// picture to offer. Kept here rather than imported because internal/metadata does
// not depend on internal/store, and inverting that for a string compare would be
// the wrong price.
func foldRole(s string) string {
	// Punctuation becomes a separator rather than part of a word, so "Dr.
	// Manhattan" and "Dr Manhattan" fold together, and so does the apostrophe in
	// "O'Brien" against a record that spells it without one.
	var b strings.Builder
	for _, r := range strings.ToLower(strings.TrimSpace(s)) {
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			b.WriteRune(r)
		} else {
			b.WriteRune(' ')
		}
	}
	return strings.Join(strings.Fields(b.String()), " ")
}
