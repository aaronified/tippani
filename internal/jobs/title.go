package jobs

import "strconv"

// THE ONE ENGLISH NAME A JOB HAS OUTSIDE THE SCREENS.
//
// The Jobs tab never shows a title the server wrote: it composes one in the
// reader's language from the kind, the subject and the counts (the locale keys
// settings.jobs.kind.<kind>), because what the server stores is data, not prose.
// Two places have no locale to reach for and still have to say what a job was:
// the server's own line when a queued job ends (stdout, `docker logs`), and the
// Markdown a person exports to hand to somebody else. Both call Title, so a job
// is called the same thing in both, and a kind named in one is named in the
// other. A kind with no entry here is called by its kind, which is still a word
// an operator can grep for.

// Title is a job's name in English, from what its row holds: the kind, the
// subject (what was searched, the file name) and the item count. It is one line
// when subject is, which a subject that came through the door always is.
func Title(kind, subject string, total int) string {
	t := kind
	switch kind {
	// The queued kinds, whose count is what they walk.
	case "fill":
		t = "Fill gaps" + counted(" in", total, "work", "works")
	case "covers":
		t = "Fetch covers" + counted(" for", total, "work", "works")
	case "people":
		t = "Fetch portraits and links" + counted(" for", total, "person", "people")
	case "reverify":
		t = "Re-verify" + counted("", total, "item", "items")
	case "reverify-apply":
		t = "Apply re-verified fields" + counted(" to", total, "item", "items")
	case "backup":
		t = "Back up the server"
	case "import":
		t = "Import"
	case "import.approve":
		t = "Approve imported quotes" + counted(" from", total, "work", "works")
	case "backup.safety":
		t = "Take a safety copy"
	// What runs in its request and is kept as a job all the same.
	case "restore":
		t = "Restore a backup"
	case "reset":
		t = "Factory reset"
	case "update.check":
		t = "Check for an update"
	case "update.apply":
		t = "Update the server"
	case "lookup.book":
		t = "Look up a book"
	case "lookup.movie":
		t = "Look up a film or show"
	case "lookup.images":
		t = "Search for pictures"
	case "lookup.portrait":
		t = "Look up a portrait"
	case "lookup.links":
		t = "Look up a person's links"
	case "lookup.person":
		t = "Fetch a person's portrait and links"
	case "lookup.reverify":
		t = "Re-verify"
	case "lookup.cast-image":
		t = "Fetch a character's picture"
	case "lookup.cast-imdb":
		t = "Fetch the cast from IMDb"
	case "lookup.cast-tvdb":
		t = "Fetch the cast from TheTVDB"
	case "lookup.cast-art":
		t = "Fetch a work's pictures"
	case "work.save":
		t = "Save a work"
	case "person.save":
		t = "Save a person"
	case "character.save":
		t = "Save a character"
	case "metadata.test":
		t = "Test a metadata source"
	case "notify.test":
		t = "Send a test notification"
	case "notify.daily":
		t = "Send the daily decks"
	case "signin.oidc":
		t = "Sign in with single sign-on"
	case "request":
		t = "Request"
	}
	if subject != "" {
		t += ": " + subject
	}
	return t
}

// counted is " in 40 works", " for 1 person": the item count as it follows a
// job's name, or nothing when the count is not known yet.
func counted(prep string, n int, one, many string) string {
	if n <= 0 {
		return ""
	}
	noun := many
	if n == 1 {
		noun = one
	}
	return prep + " " + strconv.Itoa(n) + " " + noun
}
