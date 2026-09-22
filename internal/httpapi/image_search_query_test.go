package httpapi

import "testing"

// THE SENTENCE A PICTURE SEARCH IS SENT, and the case that made it worth pinning.
//
// The owner: "WHY DOES ITKOVIAN YIELD ZERO HITS? Google image is turned on in my
// settings." It was on, and the rung ran, and it searched for something that does
// not exist. Itkovian is a character in a BOOK, and `mediaNoun` answered "movie"
// for everything it did not recognise — so a caller with nothing to say about the
// medium got a film appended to its query. "Itkovian character movie" is a
// correct search for a film that was never made, and it correctly returns
// nothing.
//
// A WRONG NOUN IS WORSE THAN NO NOUN, which is the rule these cases hold. Two of
// the words narrow a search usefully; the default narrowed it to fiction.
//
// THE MUTATION: put the `default: return "movie"` back and the unknown-medium
// case fails, reading "Itkovian character in Memories of Ice movie" — which is
// verbatim what the app was sending. And delete the actor inference in the
// character branch and the last case fails, losing the "movie" that names what
// kind of still to look for.
func TestAPictureSearchNamesTheRightMedium(t *testing.T) {
	for _, c := range []struct {
		what                              string
		kind, subject, actor, title, mtyp string
		want                              string
	}{
		{
			what: "a book's character says book, not movie",
			kind: imageKindCharacter, subject: "Itkovian", title: "Memories of Ice", mtyp: "book",
			want: "Itkovian character in Memories of Ice book",
		},
		{
			// The defect itself: a caller that knows nothing about the medium.
			what: "an unknown medium adds no noun at all",
			kind: imageKindCharacter, subject: "Itkovian", title: "Memories of Ice",
			want: "Itkovian character in Memories of Ice",
		},
		{
			// And with no work either — the state the character sheet used to send.
			// Thin, but honestly thin: it no longer claims a medium.
			what: "a bare name stays a bare name",
			kind: imageKindCharacter, subject: "Itkovian",
			want: "Itkovian character",
		},
		{
			what: "a film's role keeps the sentence that finds a still",
			kind: imageKindCharacter, subject: "Roy Batty", actor: "Rutger Hauer",
			title: "Blade Runner", mtyp: "movie",
			want: "Rutger Hauer as Roy Batty in Blade Runner movie",
		},
		{
			what: "a show says so",
			kind: imageKindCharacter, subject: "Saul Goodman", title: "Better Call Saul", mtyp: "show",
			want: "Saul Goodman character in Better Call Saul tv series",
		},
		{
			// A CREDITED PERFORMER IS ITSELF A MEDIUM. Nobody is credited with
			// playing a novel's character, so a role naming one is a screen role
			// even where the caller said nothing — and that is what separates
			// this from the unknown-medium case two rows up, which has no actor.
			// Deleting the noun in a first cut broke exactly this, and the older
			// suite caught it.
			what: "a role with a performer and no medium is still a screen role",
			kind: imageKindCharacter, subject: "Amanda Waller", actor: "Viola Davis",
			title: "Suicide Squad",
			want:  "Viola Davis as Amanda Waller in Suicide Squad movie",
		},
	} {
		got := imageSearchQuery(c.kind, c.subject, "", c.actor, c.title, c.mtyp, 0)
		if got != c.want {
			t.Errorf("%s:\n  got  %q\n  want %q", c.what, got, c.want)
		}
	}
}
