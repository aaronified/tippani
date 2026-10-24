# ADR-0901: Single sign-on, a dashboard widget, and Pushover

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

**The ask.** *"Add OIDC support and support for a custom homepage widget that will show: Work
count, quote count, forgot count, mastered count. Also add support for pushover (mainly for
"new spaced repetition deck is ready" message everyday, but also for the completion of large
imports, or large fetches, you decide what else)."*

**OIDC is the code flow with PKCE, in the standard library.** `internal/auth/oidc.go` fetches
discovery, sends the browser to the provider with `state`, `nonce` and an S256 challenge, and
exchanges the code at the token endpoint. The ID token's signature is **not** verified, and
that is the spec's own allowance rather than a shortcut: Core 1.0 §3.1.3.7 lets a token
received directly from the token endpoint over TLS rely on TLS in place of the JWS. Every claim
that binds the token to this login — `iss`, `aud`, `azp`, `exp`, `nonce` — is checked.
Rejected: a JOSE dependency and a JWKS cache, which would defend a hop TLS already defends and
add a key-rotation story to a module list of three. The state rides a cookie as well as the
URL, so a callback completes only in the browser that started it
(`TestOIDCCallbackNeedsTheBrowserThatStartedIt`).

**An identity meets an account in one of three ways, and two are opt-in.** An account linked to
`issuer|sub` signs in. A signed-in reader can link from Profile, proving both halves at once.
Otherwise nothing, unless the operator set `TIPPANI_OIDC_LINK_USERNAME` (match
`preferred_username` to a username) or `TIPPANI_OIDC_AUTO_CREATE`. Both trust the provider's
idea of a name, and a provider that lets people choose `preferred_username` would hand them any
account they can spell — so both default off. The link key is `sub`, never the username or the
email, because `sub` is the one claim OIDC promises is stable. The provider's client is **not**
gated by `TIPPANI_OFFLINE`: it is the operator's own box, and switching the app offline must not
lock everyone out. It is named in `ungated` in `internal/outbound/clients_test.go`.

**"Homepage widget" is read as gethomepage's Custom API widget.** It fetches a URL with headers
you choose and maps JSON fields onto four blocks, which is exactly the four numbers asked for.
`GET /api/widget` answers `{works, quotes, forgot, mastered}` against a per-account key
(`widget_keys`, stored hashed). It is not a device token: a device token opens the whole API,
and a key pasted into dashboard YAML should open four numbers. *Forgot* is the recall dot's
probably-forgotten count — a lapse on the last answer or overdue on the curve — so it agrees
with the Stats page. *Mastered* is a card at the schedule's top rung (`reviewCeilingFor`) with
no miss since, which is where "start new lines at Mastered" puts a line; the word means one
thing in the app. Both are earned by answering the quiz in `TestWidgetReportsTheFourNumbers`.
Mutation: dropping the rung and lapse conditions from the mastered query reports 2 for 1.

**The daily message has no timer in the app.** The approved decision *Nothing wakes on a
timer* (§1) settles it — the host's cron is "the user's timer and not mine": `tippani notify daily` is run by
the host's cron, and `notify_settings.last_daily_day` makes a cron that fires twice send once.
It counts the deck with `dailyDeck`, the function `GET /review/daily` now calls, so the phone
and the screen cannot disagree about how many cards wait. Mutation: removing the
`last_daily_day` check sends a second message in `TestSendDailyDecksOncePerDay`.

**What else sends, and why those.** The rule was: the reader has plausibly left the screen, and
the thing is finished or waiting on them. A large import (50+ quotes) when it is staged and when
it is approved; a long metadata run (20+ works) — a covers or fill job, as it ends, since from
3.1.0 the job knows the run's size and when it is over (until then the covers refetch sent it
on its last chunk, and a bulk fill's client named the run's size on its last chunk because no
single 15-item request knew the run was over); and a written backup archive. Rejected: a
message per quiz answer, per metadata fault, or on update availability — each either happens
while the reader is looking at it or is a nag rather than news. A request's message is sent
inside the request that finished the work, after the response is flushed; a job's is sent by
the job as it ends, on the queue's worker. Both have a five-second timeout, and neither is
sent from a goroutine of its own. A failing Pushover logs `TIP-NOTIFY-001` and never
fails the import that caused it. Pushover itself is gated by `TIPPANI_OFFLINE`.

**Where the three live: Profile, one set per account.** The placement moved four times. The
record is kept in order because the middle steps are the ones somebody will propose again.
First, Settings → Server (*"The server tab will host these settings"*). Then, before that
shipped, back to Profile (*"Nooo! Keep them in profile. That's the better home for all of
them."*). Then a split: SSO on Profile, Notifications and the widget on Server (*"SSO must be
under profile. Notification and Homepage cards can move to Settings>server"*). Last, the owner
refined the split: Notifications on Profile only, because it is a profile-level setting, and
API keys made on Profile, each reading only its maker's library (*"strictly profile level"*). The
admin sees only that keys exist. So the code's placement is the final one: all three are Profile
cards. What the refinement adds is planned in `docs/plans/admin-and-profile.md` and not built
in 3.0.0: Server renamed Admin, the users card moved there with SSO flags, an in-app SSO setup
card, and multiple named API keys. Nothing is shared between accounts. The SSO link is a column
on the reader's own `users` row, and `notify_settings` and `widget_keys` are keyed by `user_id`.
The only server-wide settings are the ones the operator sets in the environment (which provider,
and an optional shared Pushover application token), and the cards say when those are missing
rather than hiding. Where to find each is in the README: three how-to sections, with Authelia as
the worked provider.

**What the rater found, and where the first cut was wrong.** The login-CSRF test passed with the
cookie check deleted: it never visited the provider's authorize step, so the token exchange
failed for its own reasons whatever the cookie did. It now runs the full flow with the cookie
(control) and without it. Three guards had no test at all — the `azp` check, username linking's
`oidc_subject IS NULL` (which stops a second identity taking an already-linked account), and the
link-collision refusal — and each is now named with its mutation in `oidc_test.go`. The fetch and
backup messages had no test; `TestPushoverOnLongMetadataRuns` and `TestPushoverOnBackup` fail
with their call sites removed. And `SendDailyDecks` returned on the first reader's error, so one
bad row cost everyone after it their message; it now records the error on that reader's line,
carries on, and returns the joined errors so the cron job still exits non-zero. Beside those:
names may be absent from the ID token (some providers serve them only from userinfo), so the
client asks userinfo once when both `preferred_username` and `email` are missing, and accepts the
answer only when its `sub` matches the token's (Core §5.3.2).

**Three gaps closed before 3.0.0, found by the release rating.** Each was already a task in
`docs/plans/admin-and-profile.md`, and the rating's point was that a known exposure should not
ship in a release. Two of the three have left the plan for that reason; the third is new.
*Fetch reads only the admin's own library.* `POST /covers/refetch` is admin-gated, and the gate
had been read as permission to walk every account's shelf. It was the one confirmed place where
an admin's press wrote into another reader's rows, and its finish message told the admin the
total across every library. Every query in the handler now carries `user_id`, and
`TestCoversRefetch` puts a fetchable book and film in bob's library and fails if either URL is
requested (red with the scoping removed). *An unlink that would lock the account out is
refused.* Accounts that SSO creates get a random password nobody sees, so removing the link
left no way in. The hash cannot say whether anyone knows the password, so migration 0077 records
it: `password_unknown` is 1 from SSO creation until `tippani user passwd` sets a password. The
route answers 409 while it is 1. Rejected: a check in the Profile card only, because a button is
not a guard. *The widget key travels only in a header.* `?key=` was accepted but never
documented. The request log prints the full URI, so a dashboard polling it would have written the
key to the log on every poll. The query form is gone, and the widget test asserts it is refused.

**Two more gaps closed before 3.0.0, at the owner's choice.** Asked whether to tag with the
admin-data gaps planned or to build them first, the owner chose to build them. *A deleted
account is opaque in the admin's bin.* The snapshot has to live in the deleting admin's bin,
because a row in its owner's own would cascade away with them. That placement is custody, not
access. So `GET /trash/{id}` answers an `account` entry with its name and count and no
contents, and the Bin draws no chevron for it. Hiding it only in the client was rejected: the
route would still have served the quotes to anyone who asked. *A password somebody else chose
is temporary.* Migration 0078 adds `must_change_password`. It is set when an admin makes an
account and by `tippani user passwd`, and by `user add` for every account after the first (the
first is the operator's own). It is cleared when the reader changes their password. While it is
set, `requireAuth` answers 403 to everything except `GET /auth/me`, `POST /auth/password`,
`POST /auth/logout`, and the reader's own fonts (`GET /fonts` and `GET /fonts/{id}/file`, which
the app loads before any screen), keyed on the matched route pattern rather than a path prefix.
`mustChangePassword` fails closed on a read error. The app shows only "Choose your own
password" in the sign-in frame. Choosing the given password again is refused, since it would
leave the admin holding a working password. *Restore and reset begin with a downloaded backup.*
The obvious build was to press "Back up" first. It fails for restore-from-server: the server
keeps one archive, so the fresh backup would replace the archive the restore was about to read,
and the restore would put back exactly what was there. So `POST /admin/backup/safety` seals a
copy the same way a backup is sealed (`sealBackup`, now shared with `handleBackupCreate`),
streams it, and deletes it. The server records the download only when `io.Copy` has sent the
whole file, and only for that admin. `/admin/restore`, `/admin/restore/upload` and
`/admin/reset` answer 428 without a record from the last 30 minutes. The record lives in
memory, so a restart fails closed. The onboarding restore is exempt, because an empty server
has nothing to lose. In the app, one `SafetyBackupStep` heads both the restore dialog and the
factory reset. Its password box is named for the copy ("Your password, to seal the copy"), so
it cannot be confused with the restore's own.

**The phone's section index cards are `.hand-card`s, inset by `--card-pad` on all four sides.**
They had copied `.hand-card`'s gradient and border but not the class. The material tile and
the dither live in the class's `::before` and `::after`, so these cards stayed flat in every
material set, and the owner saw the difference beside the quote cards. Their content also sat
6px from the side border while the row's height left about 18px above and below. The first
fix padded the sides and bottom and left the top to the row's height, which matched by
coincidence (15px against 18). All four sides are the token now, and the row inside a card is
44px, the touch floor, with no padding of its own. Measured at 390: 19px on every side of every
card (18 plus the border).

*A third rating pass corrected three things.* Matching the four sides had been done by cutting
Settings' sides to the top's number — the owner's first sentence was that the sides were too
thin, so that answered the second by undoing the first. `--card-pad` took the sides' old width
instead, 24 on a desk and 20 on a phone on both screens, and the top grew to meet it. A card
ending on a slider was still 7px heavier at the bottom: the range input was inline and carried
the line's descender space; it is a block now. And the index row's pull-up became padding with
an equal negative margin, so a section name that wraps taller than the chevron disc grows the
row downward instead of reaching 6px past the inset. The inset journey had measured a bordered
row's whole box as painted, which is why it passed over the slider card; a border now counts
only the edge it draws, and the journey checks the right edge where nothing scrolls sideways.

**Every supplier on the Sources list can be tested, which reverses "only the suppliers a reader
can configure".** The owner, looking at eight rows with no Test beside them: "why can i not
test all the metadata sources?" The reason recorded above was that the picture rungs are
scrapes and a synthetic question on a press earns a rate limit. That holds for a timer and not
for a button: a press is one person asking one question, which is what every lookup already
is. So each row's Test asks its supplier with a famous subject through the same call the app
makes (Dune by its Ace paperback's ISBN and ASIN, Metropolis by its IMDb id, Fritz Lang for
Wikimedia's portrait rung, Harry Potter on Fandom's Harry Potter wiki), and records the answer
where every lookup records it. Two consents still decide what is asked. Google's image results
are asked only once the instance has said yes to reading them, so that row's Test is disabled
until then and its tip names the switch. Amazon's product page is read only with the cookie
that consents to it; without one the Test asks the keyless cover address, which is what the app
uses. The screen's own copy of the testable list went with the change, and
`test/rules/testable-sources.test.js` now holds the server's list to every row instead.

**A Test that found nothing asks whether the host answered, and Test all asks everyone at
once.** A rating ran Test all on a server that could reach nothing, and Amazon, Letterboxd,
Wikimedia and Fandom each said "answered · found nothing" while IMDb beside them said it did
not answer. Those rungs, and Google's image results, return "nothing" for a refused
connection on purpose: each is one guess among several and must not fail the lookup it is part
of. So a Test that finds nothing on one of those five now sends one HEAD to the same host,
through the same client and the same offline switch (`metadata.Reachable`), and a transport
error or a 5xx ("letterboxd.com: status 503") is what the row reports. It is asked only after the real question, never
instead of it, so the rule that a Test asks the way a lookup asks still holds. The same pass
found Test all asking twelve suppliers one after another inside one request, under the
server's 60-second write timeout with ten seconds allowed per call. They are now asked
together, with a 30-second deadline for the press, and a supplier still quiet at it reads "no
answer within 30s". One book search answers for both Google Books and Open Library, as it does
in a lookup, where Test all had run it twice. And each book row now carries its own supplier's
failure: a search that finds nothing because Google failed returned Google's error alone, which
was recorded against Open Library too.

**A game's fill and re-verify ask IGDB, and a game with no id is resolved by an exact IGDB
title.** The owner, over a fill that said «The Witcher 3: Wild Hunt» had "no pinned identity
(TMDB/TheTVDB id)": "This is a game. Why should there be a pinned identity in TMDB and TVDB?
This is supposed to be searched in IGDB and resolved there." The re-verify path, which the fill
also runs, read a film's two ids and never a game's `igdb_id`, so every game ended unpinned,
one added from IGDB included. It now reads the id and asks IGDB for the record by it. A game
with no id is the one departure from "never re-guess by name": IGDB's search is asked, and the
id is taken only when exactly one game there has the same title, compared with case,
punctuation and spacing folded and the subtitle kept (so the base game is not its Game of the
Year edition), and the same year when both have one. Several of that name, none, or one another
of the reader's works already carries is said in words and left to Look up. The id is offered
back as an `igdb_id` diff like any other field, so a fill writes it and the next run asks by id.
A film with no id is still never guessed: a film title is shared far more often than a game's,
and the reader has TMDB and TheTVDB's Look up for it.

**Every number on the phone's Metadata index is the number behind it, and the pills that
made that true.** The owner, 30 September: "The works > no source shows 3 on the index card,
but inside it shows 0." A sweep over every pill found the same fault four ways, and each fix
departs from how the index was drawn. The People pill that counted people with "no portrait
or link" was a union no People filter draws, so it opened on everybody; it is now one pill per
filter the console has (`no links`, `no photo`, `in no work`, `no quotes`), each opening on its
own. A gap films, shows and games share was counted over all three and opened on films alone;
it now opens on every type when more than one has it. "Characters who may be the same
character" opened on a list that drew no pairs, so the Characters console now draws the People
console's duplicate card (one component, posting to `/characters/merge`). "No actor" opened on
Characters, where nothing said how many lines had none; the speaker remap now says it at its
head. A rating then found two faults in that pass, and both are fixed. The dock's "Everything
that needs work" sheet printed People's and Characters' "no quotes" as two identical rows, so
its rows now sit under their section's name as the index's pills sit under their door. And a
pill's filter outlived its console, so a section's own door opened on the last pill's filter;
every door, Works' included, and every index verb that walks in through one ("Scan for
duplicate works", "Fetch missing") now opens where a fresh visit does: Works on every type's
flagged works, People and Characters on everyone.

**One card, "All sources", which brings Metadata › Sources back to the pack's one card.** The
pack draws a single group, "Who the app can ask" (`metadata.dc.html:846`), and each supplier's
row there carries its own "Add …'s key" beside "Test …" (`metadata.dc.html:819`). The app had
moved the credentials onto a card of their own, "Keys and credentials", on the owner's earlier
ruling ("split the API keys into their own subsection with cards"), which left the row saying
TMDB needs a key a scroll away from the field that takes it. The owner, 30 September: "who the
app can ask, and keys and credentials can be merged into one card (full width in desktop). Just
add the edit buttons in the 'who the app can ask' card. The combined card can be renamed to
'all sources'." So each row that takes a key, a pin, a cookie or a switch carries a Set up door
that opens exactly those fields under the row, and a supplier that takes nothing draws no door.
Three things still depart from the pack, each on the owner's word: the title is "All sources";
the card spans both columns on a desk; and the pack's "records supplied" aside is gone ("has no
need to be there"), with "Test all" on the card head's row. A key that fails to save says so
under the row whose setup failed, not at the foot of the card; a rating found it printing a
phone's screen away from the Save.

**Home's screen tile counts films, shows and games apart.** It printed the screen shelf's
total over "films", whatever the shelf held. The owner: "the total section in the homepage
lists games and shows as films as well. That card show all three (without changing the card
size)." The big figure stays the total; beside it, on its line, each kind the shelf holds is
a count wearing that medium's glyph (`Tally`, the noun in the glyph's name), the glyph the
person and character pages already badge a work's medium with (`GLYPH_NAME` through
`NavIcon`), and a kind with none is left out. The caption names what the figure counts, in
the number it takes: "titles" for a mixed shelf, and the kind's own noun for a shelf of one
kind, "1 show" as against "12 shows". The figure and its kinds are one row that never wraps; the kinds scroll under
the edge fade when they do not fit, so the tile is the Library tile's height at any size of
shelf and any type size. The first build let the row wrap, and a rating measured what that
cost: it fitted the owner's fourteen titles with 29px to spare at 390, and grew both tiles
by a line for any shelf with three-digit films and at the larger type sizes. Two more of its
claims were wrong: the film glyph was the Catalogue's outline reel beside two filled glyphs,
not the medium glyph the app uses, and a caption written out per kind read "1 shows".

**Categories on a phone: the tag form loses its box and its heading, tags go one to a row,
stickers three.** The owner, 1 October: "The "+new tag" wording not required, we already
have the add tag button. The new tag section need not have a card boundary within the card.
It is okay for tags or stickers though … Tags on mobile: 1 per row. Stickers on mobile: 3
per row." That reverses the owner's own earlier "two columns for tags, four for stickers on
the phone": at two to a row the owner's phone broke the verbs under a tag mid-word ("practi /
se", "edi / t", "delet / e"), and the golden library breaks the same three at 390. The ⋯
row that goes to the form keeps its name, now "New tag" with no text plus beside the glyph
that already draws one. The tag columns follow the card's width (13em each) rather than the
screen's: at 900 Metadata goes two-up, the Tags card is narrower than a phone's, and a
rating found the same verbs broken there while the grid turned at the app's phone width.

**Every path that writes a work's fields says who supplied them.** The owner: "I have added new
books and movies since then and have used the looked up results. They too do not show the
provider glyphs or increase the number. And it should track if i am re-scanning/fetching
missing and taking fields from there." Taking a match onto a work you already have (Details ›
Fetch metadata, the shelf's Edit, the Metadata console's match, a picture from the cover strip)
went through the edit endpoint, which recorded every changed field as yours. The edit body now
carries per-field `sources`, the wire the re-verify apply already used, and the server credits
each field it CHANGED to the supplier named for it (validated for the kind; a cover or poster
may also be Google Images or Amazon), and every other changed field to you; `source` keeps its
own job of pinning an id. A merged book candidate names, per field, the supplier other than its
primary that gave it, and every path honours that: taking the match, Fetch covers and details,
Fill gaps and Re-verify credit each field, the cover included, to the half that gave it. A
Re-verify diff carries that supplier per field, and the review applies each field under it by
default; the review screen does not print it. A film's Fill credits the supplier that answered
rather than the first in the work's pin order, which named TheTVDB for TMDB's fields when
TheTVDB's read failed. Fetch covers and details credits a cover it found elsewhere (Amazon's,
Open Library's by ISBN) to whichever address served it; Re-verify no longer credits a cover
that did not arrive; an uploaded picture is yours; a film typed in by hand is yours, as a typed
book was; and an imported file's fields read "Imported", which is neither you nor a supplier
the app asked. The whitelist of recordable fields named `publisher_name` and `page_count`,
which nothing sends, and lacked `subtitle`, `pages` and `series_index`, which three writers
send, so those edition facts carried no credit from any path. Nothing is backfilled: what was
written before stays unattributed.

**Each All sources row reads "Fields | works", with people where the supplier filled any.** The
owner chose "Works & people it supplied", then: "not just the count of works and peoples, but
of fields. \"Fields | works\"". So a row says how many fields the supplier wrote into the
library, then the works those fields are in and the people it supplied any of, each wearing the
console's own section glyph. A person counts for every supplier that wrote any of them, the
option's own words: their portrait (`image_source`), their identity and the facts that came
with it (`source`, written by a fetch, a re-verify, a `PUT /people` that names one, and a merge
that borrows it) and each fetched link (`link_sources`). A portrait is one field, and so is a
character's picture, on the record or on a cast row; a character is not a person and adds to no
people count. Only what the library still holds counts: the provenance table outlives a binned
work, so the count joins the live works, and a role the reader removed keeps its row as a
tombstone, so its picture is left out. Zero fields reads "0 fields", with the people after it
where there are any, and the count is red only when the supplier needs a key it has not been
given and has supplied nothing at all, no field, work or person: a supplier that once filled a
person's links before its key was cleared is not a warning, and its tooltip says no field, but
so many people have a link or a record from it, rather than that nothing came from it. It does
not offer a picture as a reason: a portrait counts as a field, so with no field there is none.

**A person's page says who supplied the portrait and who added each link.** The owner chose
"Links auto/you + portrait source", the pack's §1.3. `people.source` could not answer it: it is
the identity a record is pinned to, and an author's photo from Wikipedia was filed under Open
Library. So 0081 gives the picture its own `image_source` (people, characters, and a cast row's
character picture) and a person's links a `link_sources` map from address to source, kept
beside the free-text `links` field they describe. A picture's supplier is read from the host
that served it, recorded only when the bytes arrived; one the reader picked from a strip is
credited to the supplier that offered it, and a pasted address or an upload is theirs. A
fetched link is credited to the supplier that answered, one the reader typed is theirs, an
unchanged links field changes nothing, and a removed link is forgotten. "The supplier that
answered" is the one the fetch actually asked: links that came with a portrait are credited to
the supplier of the identity the fetch found, not to the host that served the picture, so a
speaker's, which come from Open Library's author match, are Open Library's even though a
speaker's own link lookup asks TMDB, and an author whose photo came from Wikimedia still has
Open Library's links. Links the fetch had to look up separately are that lookup's supplier's. A
Re-verify that rewrites a person's links credits them the same way. A merge that borrows a
portrait or links borrows their credits with them, and its undo puts them back. The page draws
the portrait's tag and, on each link, "auto" or "you" (the supplier in its tooltip); anything
written before 0081 says nothing.

**Every ask a supplier answers is on its row, recorded at the call.** A row's last answer moved
only after a lookup, a picture search or a Test; Re-verify, Fill gaps, Fetch covers and
details, adding a film by its id, cast from IMDb or TheTVDB, and a person's portrait or links
asked the same suppliers and left the row saying nothing had. Each of those calls now records
through one door, `recordAsk`, rather than through the outbound gate's observer: the gate sees
round trips, not asks, and knows neither what was found nor which area the ask was about. Two
answers are not the supplier's: a Stop records nothing, and an empty answer met while the app
walks the library is recorded without lengthening the run of empty answers that raises a fault,
since it is about the shelf's gaps. A walk is any queued job, Re-verify included, or the
request forms of Fill gaps and Fetch covers and details, which an API caller walks a shelf
through and which mark themselves (`asLibraryWalk`); the app runs both as jobs. The Details
panel's field offers ask about one work for the reader looking at it, and count, as a lookup
and a Test do. "A queued job" is `jobs.Queued`, not "has a recorder": every request carries a
log of its own, and reading that as a job spared a reader's own lookups from the run too, so no
fault could be raised by them (the first cut's defect). Letterboxd and Fandom answered a page
they could not reach exactly as a page that is not there, so the first cut recorded neither;
they now return the error, so every ask is on the row as an answer, a miss or a failure. Only a
404 (or an article Fandom reports missing) is a miss: a 403 or a 5xx is the supplier not
answering, as it is for TMDB and TheTVDB. For a work with no Fandom wiki stored, the search for
one is the ask, and is recorded the same way, so most films, which have none, still put
Fandom's answer on its row. That answer is about the work, not about Fandom, so like a walk's
it does not lengthen the run that raises a fault: recorded as an ordinary answer, three presses
of the field picker on films with no wiki put a working Fandom on the fault list. A wiki host's
404 is a miss; the cross-wiki index's 404 is not, because it says the endpoint is not where it
was. Asks about a person or a company have their own area, "people", on Open Library's, TMDB's
and IGDB's rows, so a miss on an obscure translator does not count against Open Library's book
search.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
