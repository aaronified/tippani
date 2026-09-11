// WHAT IS ACTUALLY BROKEN ABOUT THIS INSTALL'S METADATA, and it used to be two
// things because two were all anybody had wired up.
//
// THE OWNER'S REPORT: "those two cannot be the only metadata faults. add all kinds
// of faults there. like now i can see that google photo search is yielding zero
// results, zilch."
//
// They are right, and the reason is worth naming rather than fixing quietly. The
// Metadata sources card reported exactly two states — the books lookup failed, and
// the film source has no key — because those were the only two the server ever
// remembered. Every other supplier in the app answers a request, succeeds or fails,
// and is forgotten the moment the response is written. So a reader whose picture
// searches have come back empty for a week sees a card with nothing on it, which is
// the card saying "all is well" about something it never looked at.
//
// A ZERO IS NOT AN ERROR, AND IT IS THE CASE THAT PROMPTED THIS. A search engine
// asked for a picture of an obscure character and answering "none" is working
// correctly. The same engine answering "none" to everything, all week, is broken —
// a consent wall, a rate limit, a markup rotation — and nothing in a single
// response can tell the two apart. So what is recorded is the RUN: how many times
// in a row a source has been asked and answered nothing. One miss is a miss; a run
// is a fault, and the number is what makes it one.
//
// IN MEMORY, AND DELIBERATELY. This describes the running process rather than the
// library — the same reasoning `books_lookup` was written under (§10). A restart
// clears it, which is correct: whatever was wrong may have been fixed by the
// restart, and a fault surviving into a process that has not yet reproduced it is a
// warning about the past.

package httpapi

import (
	"strings"
	"sync"
	"time"
)

// The areas a source can fail in. A supplier appears in more than one — TheTVDB
// answers both film lookups and picture searches — and a picture miss is not a
// lookup failure, so the area is part of the identity rather than a label on it.
const (
	faultAreaBooks    = "books"
	faultAreaFilms    = "films"
	faultAreaGames    = "games"
	faultAreaPictures = "pictures"
)

// HOW MANY CONSECUTIVE NOTHINGS BEFORE A SOURCE IS CALLED BROKEN, and there are two
// answers because the question is not the same one twice.
//
// ONE IS NEVER A FAULT: an image search for a minor character in a Bengali film
// genuinely has nothing behind it, and a card that said so would be a card nobody
// reads by the second week.
//
// THREE IS, FROM A SOURCE THAT HAS NEVER ANSWERED. Three different subjects in a row
// finding nothing, from something that has produced not one picture since the server
// started, is no longer about the subjects — that is the owner's case exactly, and
// three is the smallest number that cannot be one unlucky subject.
//
// EIGHT FROM A SOURCE THAT HAS. This is the distinction the single threshold got
// wrong, and it would have made the feature useless: Wikimedia and Fandom MISS
// often and correctly, because plenty of characters have no article — so a working
// Fandom would have sat permanently on the fault list, three obscure characters
// being all it takes. A source that has demonstrably produced pictures in this
// process is a different claim from one that never has, and it deserves a longer
// silence before it is accused.
//
// NEITHER NUMBER IS A GUESS AT A RATE. They are both "how long before this stops
// being explainable by the subjects", asked of two different priors.
const (
	emptyRunFault         = 3
	emptyRunFaultAfterHit = 8
)

// sourceOutcome is one supplier's most recent answer in one area.
//
// THREE STATES, NOT TWO. `OK=false` is a call that failed — a timeout, a 500, a
// refused connection. `OK=true, Found=0` is a call that worked and returned
// nothing, which is the state the old single boolean could not express and the one
// the owner is looking at. `OK=true, Found>0` is working.
type sourceOutcome struct {
	Source string
	Area   string

	OK    bool
	Found int
	Err   string

	// EmptyRun counts consecutive successful calls that returned nothing, and
	// resets the moment anything is found. It is the whole of the difference
	// between "this search had no answer" and "this source has stopped
	// answering".
	EmptyRun int

	// EverFound is whether this source has produced anything at all since the
	// process started, and it is what picks the threshold above. It is
	// deliberately NOT reset by a run: the claim it supports is "this thing works
	// here", which one dry spell does not undo.
	EverFound bool

	CheckedAt time.Time

	// Note is whatever the source itself had to say about the attempt — the
	// picture ladder already composes one per rung ("fandom: no wiki for this
	// work"), and it is far more use than a count. Empty when there is nothing to
	// add.
	Note string
}

// faultRow is one line of the card's fault list. Only failing sources are sent:
// silence is the healthy state, which is this screen's own rule.
type faultRow struct {
	Source string `json:"source"`
	Area   string `json:"area"`
	// "error" — the call failed. "empty" — the call worked and found nothing, for
	// long enough to be a fault rather than a miss.
	Kind string `json:"kind"`
	// How many nothings in a row, on an "empty" row. The reader needs it: "seven
	// searches in a row found nothing" is actionable where "no results" is the
	// ordinary state of a search box.
	Run       int    `json:"run,omitempty"`
	Error     string `json:"error,omitempty"`
	Note      string `json:"note,omitempty"`
	CheckedAt string `json:"checked_at"`
}

// lookupRegistry is the per-process store. A sync.Map rather than a mutex and a
// plain map because the access pattern is exactly the one it is for: written once
// per request from many goroutines, read whole by one screen, and the key set is
// small and fixed by the code rather than by user input.
type lookupRegistry struct {
	m sync.Map // string (area/source) -> *sourceOutcome
}

func regKey(area, source string) string { return area + "/" + source }

// record folds one attempt into a source's running state.
//
// THE WHOLE POINT IS THE FOLD. A store that only kept the last answer could not
// tell a run from a miss, and a store that kept every answer would be a log. What
// is kept is the last outcome plus one integer, which is the least that can answer
// "has this stopped working".
func (r *lookupRegistry) record(area, source string, found int, note string, err error) {
	if source == "" {
		return
	}
	key := regKey(area, source)
	next := &sourceOutcome{
		Source: source, Area: area,
		OK: err == nil, Found: found, Note: note,
		CheckedAt: time.Now().UTC(),
	}
	if err != nil {
		// One line: this reaches a card, and a provider's multi-line error would
		// push the rest of the page down. The same flattening recordBooksLookup
		// has always done.
		next.Err = strings.ReplaceAll(err.Error(), "\n", "; ")
	}
	next.EverFound = found > 0
	if prev, ok := r.m.Load(key); ok {
		p := prev.(*sourceOutcome)
		next.EverFound = next.EverFound || p.EverFound
		// A FAILED CALL DOES NOT COUNT AS AN EMPTY ONE and does not clear the run
		// either: the run is about calls that WORKED and found nothing, so a
		// timeout in the middle of a dry spell should neither extend it nor
		// pretend it ended.
		switch {
		case err != nil:
			next.EmptyRun = p.EmptyRun
		case found > 0:
			next.EmptyRun = 0
		default:
			next.EmptyRun = p.EmptyRun + 1
		}
	} else if err == nil && found == 0 {
		next.EmptyRun = 1
	}
	r.m.Store(key, next)
}

// faults is every source whose last answer was a failure, or which has been
// answering nothing for long enough to count.
//
// SORTED, because a list that reorders itself between two renders of the same page
// reads as things changing when nothing has. By area then source: the areas are a
// fixed vocabulary and the sources within one are few.
func (r *lookupRegistry) faults() []faultRow {
	out := []faultRow{}
	r.m.Range(func(_, v any) bool {
		o := v.(*sourceOutcome)
		switch {
		case !o.OK:
			out = append(out, faultRow{
				Source: o.Source, Area: o.Area, Kind: "error",
				Error: o.Err, Note: o.Note,
				CheckedAt: o.CheckedAt.UTC().Format(time.RFC3339),
			})
		case o.EmptyRun >= o.emptyThreshold():
			out = append(out, faultRow{
				Source: o.Source, Area: o.Area, Kind: "empty",
				Run: o.EmptyRun, Note: o.Note,
				CheckedAt: o.CheckedAt.UTC().Format(time.RFC3339),
			})
		}
		return true
	})
	sortFaults(out)
	return out
}

// emptyThreshold is how long this source has to be silent before the silence is a
// fault — see the two constants for why one number could not serve both cases.
func (o *sourceOutcome) emptyThreshold() int {
	if o.EverFound {
		return emptyRunFaultAfterHit
	}
	return emptyRunFault
}

// A hand-rolled insertion sort rather than sort.Slice: the list is at most a
// dozen rows and this saves the reflection and the import. Area first, then
// source, both ascending.
func sortFaults(rows []faultRow) {
	for i := 1; i < len(rows); i++ {
		for j := i; j > 0; j-- {
			a, b := rows[j-1], rows[j]
			if a.Area < b.Area || (a.Area == b.Area && a.Source <= b.Source) {
				break
			}
			rows[j-1], rows[j] = b, a
		}
	}
}

// recordLookup is what the handlers call. It lives on the Server so a call site
// reads as "the server noticed this" rather than as reaching into a field.
func (s *Server) recordLookup(area, source string, found int, note string, err error) {
	s.lookups.record(area, source, found, note, err)
}
