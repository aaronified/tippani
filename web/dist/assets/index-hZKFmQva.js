const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/MetadataPage-BIXgnLzr.js","assets/react-BZwu_XJr.js","assets/TagsPage-CCkms8AE.js","assets/SearchPage-Dbcjahym.js","assets/StatsPage-BSOoqMpf.js","assets/Settings-DP8sZe-C.js","assets/BinPage-CiHLRN0U.js","assets/CleanupPage-jkblS7bv.js"])))=>i.map(i=>d[i]);
import{r as c,j as e,a as Ue,c as Zd}from"./react-BZwu_XJr.js";(function(){const a=document.createElement("link").relList;if(a&&a.supports&&a.supports("modulepreload"))return;for(const r of document.querySelectorAll('link[rel="modulepreload"]'))s(r);new MutationObserver(r=>{for(const i of r)if(i.type==="childList")for(const l of i.addedNodes)l.tagName==="LINK"&&l.rel==="modulepreload"&&s(l)}).observe(document,{childList:!0,subtree:!0});function o(r){const i={};return r.integrity&&(i.integrity=r.integrity),r.referrerPolicy&&(i.referrerPolicy=r.referrerPolicy),r.crossOrigin==="use-credentials"?i.credentials="include":r.crossOrigin==="anonymous"?i.credentials="omit":i.credentials="same-origin",i}function s(r){if(r.ep)return;r.ep=!0;const i=o(r);fetch(r.href,i)}})();const eh="modulepreload",th=function(t){return"/"+t},Rr={},Ve=function(a,o,s){let r=Promise.resolve();if(o&&o.length>0){let l=function(m){return Promise.all(m.map(p=>Promise.resolve(p).then(u=>({status:"fulfilled",value:u}),u=>({status:"rejected",reason:u}))))};document.getElementsByTagName("link");const h=document.querySelector("meta[property=csp-nonce]"),d=(h==null?void 0:h.nonce)||(h==null?void 0:h.getAttribute("nonce"));r=l(o.map(m=>{if(m=th(m),m in Rr)return;Rr[m]=!0;const p=m.endsWith(".css"),u=p?'[rel="stylesheet"]':"";if(document.querySelector(`link[href="${m}"]${u}`))return;const f=document.createElement("link");if(f.rel=p?"stylesheet":eh,p||(f.as="script"),f.crossOrigin="",f.href=m,d&&f.setAttribute("nonce",d),document.head.appendChild(f),p)return new Promise((b,y)=>{f.addEventListener("load",b),f.addEventListener("error",()=>y(new Error(`Unable to preload CSS for ${m}`)))})}))}function i(l){const h=new Event("vite:preloadError",{cancelable:!0});if(h.payload=l,window.dispatchEvent(h),!h.defaultPrevented)throw l}return r.then(l=>{for(const h of l||[])h.status==="rejected"&&i(h.reason);return a().catch(i)})},nh=`# tippani — English. The other half of this pair is bn.txt beside it.
#
# THE FORMAT, in full, because a stranger editing this file has nothing else:
#
#   key = value      one string per line; the FIRST = splits it, so a value may
#                    contain = freely.
#   # anything       a comment. A comment directly above a key is CONTEXT for
#                    whoever translates it — write it whenever the string alone
#                    does not say where it appears or what it is doing.
#   (blank)          ignored.
#   _key            reserved. Never rendered as UI text. See the README.
#
# Leading and trailing spaces, tabs and newlines are trimmed off both halves. A
# non-breaking space is NOT whitespace here and survives, which is what French
# punctuation needs.
#
# AN EMPTY VALUE COUNTS AS ABSENT. \`some.key =\` is not the empty string; it is a
# key nobody has filled in yet, and the resolver walks past it to the next
# language in the chain. That is what lets the generated template be dropped in
# half-finished without blanking the interface.
#
# A LINE WITH NO = IS DROPPED, ON ITS OWN, and the rest of the file loads. One
# mangled line costs exactly that one string.
#
# THIS FILE IS THE SOURCE OF TRUTH FOR BOTH SIDES. The Go binary embeds it
# (internal/i18n/i18n.go) and the frontend imports these same bytes
# (web/frontend/src/i18n.js). There is no second copy to keep in step.
#
# It is also overridable: a key of the same name in data/Locales/en.txt wins over
# the line here, per key. The override path privileges nobody — bn.txt works the
# same way.

# How this language is labelled in the picker, in its own words.
_name = English

# ===========================================================================
# THE LANGUAGE PICKER'S OWN WORDS.
#
# First in the file because they are the first strings a translator needs: the
# row that changes the language, and the label the picker gives their own
# file. Everything after this point is the interface itself, in the order you
# meet it — the frame, then the screens, then the help panel.
# ===========================================================================

# The Settings row that changes the language, in the Appearance card.
settings.language.title = Language
# The information dot beside that row.
settings.language.info.title = Language
settings.language.info.body = English and Bengali ship with tippani. Any other is a file: copy data/Locales/_TEMPLATE.txt — the app puts it there — to fr.txt and fill it in. It appears here with no rebuild, at whatever percentage it covers.
# Shown under the picker when the stored language names a file that is no longer
# on disk. {code} is what was stored, {name} is the language showing instead.
settings.language.missing = {code} is not installed — showing {name}.
# The language chooser on the first-run screen, above the account form.
onboarding.language.title = Language
# One row of the picker: the language's own name, then how complete it is.
# {name} is the language's _name, {percent} is a whole number.
locale.picker.coverage = {name} · {percent}%
# The accessible name of the picker itself, on both screens.
locale.picker.aria = Choose a language
# Two languages whose files claim the same _name: the code tells them apart.
# Never a refusal — see localeCatalogue.
locale.picker.disambiguate = {name} ({code})
# The pseudo-locale's row in the picker. It is not a translation: it transforms
# every string that came from a locale file, so any English still hardcoded in
# the source stands out on screen untransformed.
locale.pseudo.name = Pseudo


# ===========================================================================
# THE FRAME — the shell, Settings, and the shared primitive layer every screen
# borrows from.
#
# Sources: App.jsx routes.js keys.js ui.jsx works.jsx Settings.jsx theme.js
# fonts.js secret.js languages.jsx gestures.jsx api.js undo.jsx flow.jsx.
#
# EVERYTHING IS IN HERE NOW. This paragraph used to name the eight files that
# were still English at their call sites — Account, ImportPage, StagingPage,
# BinPage, MetadataPage, ReverifyReview, CoverPicker, people — plus nine cards
# inside Settings.jsx. All of them landed, and the screens they render are in
# whichever language the reader chose.
#
# WHAT KEEPS IT THAT WAY is test/dom/screens-i18n.test.jsx rather than this
# comment. It mounts every screen App can route to under the pseudo-locale, where
# a string that came through the resolver comes back bracketed and accented, and
# fails on any readable plain-ASCII text — in a rendered attribute as well as in
# the page. A new screen is gated the day it joins test/screens.js, and a literal
# left in the JSX is a red test rather than a paragraph somebody has to remember
# to update.
#
# FOUR THINGS ARE KEYED HERE THAT NO TRANSLATOR SHOULD TOUCH, each carrying the
# same value in every language: shell.wordmark.label (a logotype),
# settings.type.size.format ({n}px, a unit beside a Western digit),
# settings.credits.sep.*.symbol (the characters the credit splitter matches) and
# settings.updates.version.dev. They go through the resolver so the gate above
# can see them; the alternative was a list of exemptions inside the gate, which
# is where the next untokenised screen would have hidden.
#
# THE common.*, nav.*, unit.* AND vocab.* NAMESPACES ARE SHARED. A screen that
# names a column, a countable noun or a shared verb points here rather than
# keying its own copy of the word, which is what keeps the add form, the bulk
# editor, the table head and the export heading spelling it the same way.
# ===========================================================================

# ---------------------------------------------------------------------------
# nav.* — routes.js. The tab names, the desktop strip's hover labels, the phone
# bar's screen-reader names, and the four Settings → Features rows.
#
# One tab has ONE name: four hand-maintained lists in routes.js, help.jsx's
# section titles, the Settings Features card and the bin's back link all point
# here rather than each holding their own copy of the word.
# ---------------------------------------------------------------------------

nav.tab.home.label = Home
# Hover label on the desktop strip, which collapses to icons.
nav.tab.home.tip = Today's review
nav.tab.library.label = Library
nav.tab.library.tip = Your books
# The films / shows / games section. Its URL is /catalogue.
nav.tab.movies.label = Catalogue
nav.tab.movies.tip = Films, shows and games
nav.tab.quotes.label = Quotes
nav.tab.quotes.tip = Lines from anywhere else
nav.tab.anthologies.label = Anthologies
nav.tab.anthologies.tip = Quotes you have gathered
nav.tab.tags.label = Tags
nav.tab.tags.tip = Tags and stickers
nav.tab.metadata.label = Metadata
nav.tab.metadata.tip = Covers, people and duplicates
nav.tab.stats.label = Stats
nav.tab.stats.tip = Calendar, memory, breakdowns
nav.tab.settings.label = Settings
nav.tab.settings.tip = Appearance, keys, backups
nav.tab.search.label = Search

# The floating phone nav is icon-only, so each row's name is read aloud rather
# than shown.
nav.bottom.home.aria = Go home to today's review
nav.bottom.library.aria = Open your book library
nav.bottom.movies.aria = Open your film catalogue
nav.bottom.quotes.aria = Open your standalone quotes
nav.bottom.anthologies.aria = Open your anthologies

# The info-dot body under each switch in Settings → Features, saying what the
# section you are about to hide actually holds.
nav.section.library.what = Books, and the highlights you keep in them.
nav.section.movies.what = Films, shows and games, and the lines from them.
nav.section.quotes.what = Speeches, letters, proverbs — anything with no work behind it.
nav.section.anthologies.what = Quotes gathered into a reading order, with your own words between them.

# ---------------------------------------------------------------------------
# vocab.* — the word lists that are not sentences. theme.js, fonts.js,
# languages.jsx, credits.jsx, gestures.jsx, ui.jsx's source badges.
# ---------------------------------------------------------------------------

# --- vocab.category.* — what a highlight colour slot is CALLED when the reader
# has not renamed it (Settings → Colours, the colour filters, the Stats
# breakdown). NOT stored: an untouched account holds no name at all, so these are
# presentation and translating them files nothing differently.
# Slot 1, where a quote lands when nobody picked a colour.
vocab.category.unset.label = Default
vocab.category.blue.label = Fact
vocab.category.pink.label = Disagreed
vocab.category.orange.label = Inspirational
vocab.category.green.label = Funny
vocab.category.purple.label = Meta

# --- vocab.swatch.* — the sixteen colours the category picker offers, as a
# tooltip and an accessible name on each swatch. Colour words, nothing else.
vocab.swatch.sun.label = Sun
vocab.swatch.amber.label = Amber
vocab.swatch.rose.label = Rose
vocab.swatch.blush.label = Blush
vocab.swatch.crimson.label = Crimson
vocab.swatch.mauve.label = Mauve
vocab.swatch.violet.label = Violet
vocab.swatch.periwinkle.label = Periwinkle
vocab.swatch.sky.label = Sky
vocab.swatch.teal.label = Teal
vocab.swatch.mint.label = Mint
vocab.swatch.jade.label = Jade
vocab.swatch.leaf.label = Leaf
vocab.swatch.moss.label = Moss
vocab.swatch.clay.label = Clay
vocab.swatch.stone.label = Stone

# --- vocab.accent.* — the four app accent colours, named inside a sentence in
# Settings → Appearance ("Use the terracotta accent"), so lower case.
vocab.accent.terracotta.label = terracotta
vocab.accent.ochre.label = ochre
vocab.accent.olive.label = olive
vocab.accent.slate.label = slate

# --- vocab.font-role.* — the six jobs type does in this app, in Settings → Type.
# \`.sample\` is the specimen line, set in the face being offered, so it must be
# text this role would actually carry — not a translation of the English one.
vocab.font-role.display.label = Quotes
vocab.font-role.display.what = The words themselves, and every title.
vocab.font-role.display.sample = It is a truth universally acknowledged
vocab.font-role.ui.label = Interface
vocab.font-role.ui.what = Buttons, fields, everything you press.
vocab.font-role.ui.sample = Add to quiz · Move to board · Fill gaps
vocab.font-role.mono.label = Labels
vocab.font-role.mono.what = Locators, dates, counts — the small caps lines.
# Small caps and figures, which is what this role is for. Keep it that shape.
vocab.font-role.mono.sample = CH. 12 · P. 288 · 3 QUOTES
vocab.font-role.hand.label = Notes
vocab.font-role.hand.what = Your margin notes, and the score on a finished round.
vocab.font-role.hand.sample = the bit about the garden
vocab.font-role.bengali.label = Bengali
vocab.font-role.bengali.what = Every Bengali quote, wherever it appears.
# Already Bengali on the English side, and it has to stay Bengali: it is the
# specimen for the Bengali face.
vocab.font-role.bengali.sample = যে জীবন ফড়িঙের দোয়েলের
vocab.font-role.devanagari.label = Devanagari
vocab.font-role.devanagari.what = Hindi, Marathi, Sanskrit — anything in this script.
# Already Devanagari on the English side, for the same reason.
vocab.font-role.devanagari.sample = जो बीत गई सो बात गई

# --- vocab.face.* — the eighteen bundled typefaces, in Settings → Type.
# \`.name\` is the face's own name: DO NOT TRANSLATE it, though transliterating it
# into the reader's script is fine. \`.note\` is the one-line reason to pick it.
vocab.face.newsreader.name = Newsreader
vocab.face.newsreader.note = The built-in
vocab.face.source-serif-4.name = Source Serif 4
vocab.face.source-serif-4.note = Cleaner, a little wider
vocab.face.literata.name = Literata
vocab.face.literata.note = Made for long reading
vocab.face.hanken-grotesk.name = Hanken Grotesk
vocab.face.hanken-grotesk.note = The built-in
vocab.face.inter.name = Inter
vocab.face.inter.note = Neutral, very legible small
vocab.face.public-sans.name = Public Sans
vocab.face.public-sans.note = Plainer, squarer
vocab.face.ibm-plex-mono.name = IBM Plex Mono
vocab.face.ibm-plex-mono.note = The built-in
vocab.face.jetbrains-mono.name = JetBrains Mono
vocab.face.jetbrains-mono.note = Taller, more open
vocab.face.source-code-pro.name = Source Code Pro
vocab.face.source-code-pro.note = Quieter
vocab.face.caveat.name = Caveat
vocab.face.caveat.note = The built-in
vocab.face.kalam.name = Kalam
vocab.face.kalam.note = Rounder — and writes Devanagari too
vocab.face.gloria-hallelujah.name = Gloria Hallelujah
vocab.face.gloria-hallelujah.note = Looser, more casual
vocab.face.noto-serif-bengali.name = Noto Serif Bengali
vocab.face.noto-serif-bengali.note = The built-in
vocab.face.hind-siliguri.name = Hind Siliguri
vocab.face.hind-siliguri.note = Sans — plainer and larger on the line
vocab.face.tiro-bangla.name = Tiro Bangla
vocab.face.tiro-bangla.note = Traditional; the built-in before 1.15
vocab.face.noto-serif-devanagari.name = Noto Serif Devanagari
vocab.face.noto-serif-devanagari.note = The built-in
vocab.face.hind.name = Hind
vocab.face.hind.note = Sans — plainer and larger on the line
vocab.face.tiro-devanagari-hindi.name = Tiro Devanagari Hindi
vocab.face.tiro-devanagari-hindi.note = Traditional; the built-in before 1.15
# A face the reader uploaded themselves, in the same slot as a bundled one's note.
vocab.face.upload.note = Yours

# --- vocab.font-style.* — the modifiers offered per role in Settings → Type.
vocab.font-style.bold.label = Bold
vocab.font-style.italic.label = Italic
vocab.font-style.smallcaps.label = Small caps
vocab.font-style.allcaps.label = All caps
# \`font-variant-numeric: tabular-nums\` — figures that line up in a column.
vocab.font-style.figures.label = Lining figures

# --- vocab.gesture.* — the eleven touch gestures, drawn as a clip with the word
# beside it. It names the gesture, never the instruction: "Long press", not
# "press and hold for half a second".
vocab.gesture.long-press.label = Long press
vocab.gesture.swipe-left.label = Swipe left
vocab.gesture.swipe-right.label = Swipe right
vocab.gesture.swipe-up.label = Swipe up
vocab.gesture.swipe-down.label = Swipe down
vocab.gesture.pinch-in.label = Pinch in
vocab.gesture.pinch-out.label = Pinch out
vocab.gesture.two-finger-left.label = Two fingers left
vocab.gesture.two-finger-right.label = Two fingers right
vocab.gesture.two-finger-up.label = Two fingers up
vocab.gesture.two-finger-down.label = Two fingers down

# --- vocab.tag-style.* — the five shapes a tag chip can take, offered as live
# previews in TagsPage's StylePicker. TAG_STYLES in ui.jsx holds the storage
# tokens and the picker used to draw the token itself, so the chip and its
# tooltip both read the stored word.
#
# EACH NAMES ITS SHAPE, which is what makes them translatable at all: a banner
# is notched on the right, a flyout comes to a point underneath, tape has torn
# edges, a reel is round with sprockets.
vocab.tag-style.sticker.label = sticker
vocab.tag-style.banner.label = banner
vocab.tag-style.flyout.label = flyout
vocab.tag-style.tape.label = tape
vocab.tag-style.reel.label = reel

# ---------------------------------------------------------------------------
# common.action.* — THE SHARED VERBS. One key per act, however many objects it
# is performed on: 24 copies of "could not save" is 24 chances for a translator
# to phrase one failure three ways, and the same is true of every verb here.
# \`.busy\` is the transient state of the same button.
# ---------------------------------------------------------------------------

common.action.save.label = Save
common.action.save.busy = Saving…
# The pencil on a row whose name is already on screen. {field} is that name,
# lower-cased by the caller.
common.action.save.field.aria = Save {field}
common.action.cancel.label = Cancel
common.action.confirm.label = Confirm
common.action.delete.label = Delete
common.action.close.label = Close
# The × on a window that sits over the screen. {name} is the word above — Close,
# or whatever the caller renamed it to.
common.action.close.window.tip = {name} this window
common.action.done.label = Done
common.action.add.label = Add
common.action.edit.label = Edit
common.action.edit.field.aria = Edit {field}
common.action.copy.label = Copy
common.action.share.label = Share
common.action.export.label = Export
common.action.restore.label = Restore
common.action.apply.label = Apply
common.action.apply.busy = Applying…
common.action.undo.label = Undo
common.action.remove.label = Remove
# The × on a tag pill, a cover candidate, a device row, a search chip. {name} is
# whatever is being taken out, so the sentence is the same in all four places.
common.action.remove.aria = Remove {name}
common.action.move.label = Move
common.action.reload.label = Reload
common.action.upload.busy = Uploading…
common.action.load.busy = loading…
common.action.fetch.busy = Fetching…
# The verb on a button. The named MODE is quiz.practice.label — English tells the
# two apart with an s and a c, which no other language can reproduce.
common.action.practise.label = Practise
common.action.capture.label = Capture
common.action.filter.label = Filter
common.action.show.label = Show
common.action.hide.label = Hide
common.action.show-less.label = Show less
common.action.got-it.label = Got it
# The favourite toggle says what PRESSING it will do, not what the state is.
common.action.favourite.on.label = Add to favourites
common.action.favourite.off.label = Remove from favourites
# The tick on a card or a row, which names what is being picked.
common.action.select.aria = Select {name}
common.action.deselect.aria = Deselect {name}
# What the tick calls the thing when its caller did not name it.
common.select.target.fallback = this

# Tooltips on a table row's action cell. {noun} is what the row holds.
common.action.copy.row.tip = Copy this {noun}
common.action.practise.row.tip = Quiz me on this {noun}
common.action.share.row.tip = Share this {noun}
common.action.edit.row.tip = Edit this {noun}
common.action.delete.row.tip = Delete this {noun}

# ---------------------------------------------------------------------------
# common.* — the shared component chrome from ui.jsx and works.jsx.
# ---------------------------------------------------------------------------

# The accent strip above a selectable list. {n} is how many are ticked.
common.selection.count.one = {n} selected
common.selection.count.other = {n} selected
common.selection.clear.aria = Clear the selection

# --- the calendar. Three-letter month abbreviations, because they sit in a
# 3-column grid and in a one-line date; a language with no short form should use
# whatever fits that grid.
common.month.jan.label = Jan
common.month.feb.label = Feb
common.month.mar.label = Mar
common.month.apr.label = Apr
common.month.may.label = May
common.month.jun.label = Jun
common.month.jul.label = Jul
common.month.aug.label = Aug
common.month.sep.label = Sep
common.month.oct.label = Oct
common.month.nov.label = Nov
common.month.dec.label = Dec
# A stored partial date, read back at the precision it was kept at.
common.date.month-year.label = {month} {year}
common.date.full.label = {day} {month} {year}
common.date.picker.aria = Pick a date
common.date.picker.prev.tip = Show earlier dates
common.date.picker.prev.aria = Previous
common.date.picker.next.tip = Show later dates
common.date.picker.next.aria = Next
# The heading of the year / month grid is also the way back up a level.
common.date.picker.up.tip = Go back a level
common.date.picker.year-range.title = {a}–{b}
# The button that STOPS at a coarser precision — the whole point of a partial date.
common.date.picker.just-year.label = Just {year}
common.date.picker.just-month.label = Just {month} {year}
common.date.pick.tip = Pick a date
# {field} is the name of the field being filled in.
common.date.pick.aria = Pick {field}
common.date.pick.field.fallback = a date
# The three shapes a date may be typed in. The letters are a format, not words:
# use whichever letters stand for year, month and day in the reader's language,
# and keep the punctuation and the count of them.
common.field.date.placeholder = YYYY, YYYY-MM or YYYY-MM-DD
common.field.year.placeholder = e.g. 1920

# --- shelf states. ONE CONCEPT, TWO WORDS: a book is read and a film is
# watched, so every state carries both. A game adds a third and is spelled out
# on both sides because a game only ever lives on the catalogue side.
common.shelf.wishlist.book.label = Wishlist
common.shelf.wishlist.film.label = Wishlist
common.shelf.reading.book.label = Reading
common.shelf.reading.film.label = Watching
common.shelf.playing.book.label = Playing
common.shelf.playing.film.label = Playing
common.shelf.paused.book.label = Paused
common.shelf.paused.film.label = Paused
common.shelf.abandoned.book.label = Abandoned
common.shelf.abandoned.film.label = Abandoned
common.shelf.completed.book.label = Completed
common.shelf.completed.film.label = Completed
# The colour bar under a cover, read aloud. {name} is the shelf state above.
common.shelf.progress.label = {name} — {percent}%
# The badge on the artwork of something you are in the middle of. A game is
# played, and only ever lives on the catalogue side.
common.reading-badge.book.aria = Currently reading
common.reading-badge.film.aria = Currently watching
common.reading-badge.game.aria = Currently playing
# The ♥ in the corner of a favourited cover. Not a button — the card is.
common.favourite.badge.aria = Favourite

# --- the fold on a long description or a long quote.
common.clamp.description.more.tip = Show the whole description
common.clamp.text.more.tip = Show the full text

# --- shared field chrome.
common.field.token.placeholder = add…
common.field.select.placeholder = Select…
# A typeable Select: the box at the top of the panel, and the line it shows
# when the typing matches nothing.
common.field.filter.placeholder = Type to narrow
common.field.filter.none = nothing matches
# What a row with nothing in it says, in the inline editors on a work's page.
common.field.inline.placeholder = not set
common.field.colour.label = Colour

# --- the pop-up form frame.
common.form.close.tip = Close without saving

# --- the information dot.
common.info.default.title = About this
# Announced by the dot itself; the popover carries the payload.
common.info.dot.aria = More information: {name}

# --- key caps. The joining word between two keys of a chord ("G then L").
common.kbd.then.label = then
# The word between the two caps of one quiz action in the shortcut sheet, where the
# daily key is followed by the Practice one. Lower case: it labels a cap, not a row.
common.kbd.practice.label = practice

# --- help, from any screen.
common.help.sheet.title = Help
common.help.rail.aria = Help sections
# The fold on a help row, over the .more half of every entry that has one. One
# word, lower case, because it sits under the sentence it continues.
common.help.more.label = more
# {name} is the screen you are standing on.
common.help.button.tip = What's on this screen — {name}
common.help.button.aria = Help for {name}

# --- the memory status dot on every quote. The dot names the state and the ONE
# number that matters: how long it keeps, or that it is already owed a look.
common.status.remembered.label = Remembered
common.status.forgetting.label = Forgetting
common.status.probably-forgotten.label = Probably forgotten
common.status.unseen.label = Not yet reviewed
# {name} is the state above, {detail} the clause after it.
common.status.tip = {name} · {detail}
common.status.new.detail = added this week
common.status.due.detail = due now
# {span} is a compact duration from common.half-life.* below.
common.status.half-life.detail = half-life {span}
# A memory half-life, written as compactly as a locator: these sit in a tooltip
# and in the Stats memory card, and the unit is a single letter on purpose.
common.half-life.hours.label = {n}h
common.half-life.days.label = {n}d
common.half-life.weeks.label = {n}w
common.half-life.months.label = {n}mo

# --- the number beside a slider, in the quiz panel. THE WHOLE READOUT IS ONE
# STRING rather than a number with a unit glued to it: the unit used to be written
# ' days', with a leading space no line in this file can carry, and the number does
# not come first in every language. {n} is already formatted to the slider's
# decimals; the plural form is chosen by the same value.
common.slider.multiplier.format = {n}×
common.slider.days.format.one = {n} day
common.slider.days.format.other = {n} days

# --- the struck flash card on a row the quiz will not draw. {kind} is the word
# for the work it hangs off — book, film, show.
common.quiz-skip.with-work.label = Skipped with its {kind}
common.quiz-skip.alone.label = Not in the quiz

# --- covers and posters.
common.cover.alt = Cover of {title}
common.cover.lightbox.untitled.aria = Cover
common.cover.zoom.tip = See this cover full screen
common.cover.zoom.aria = View cover of {title} full screen
common.cover.zoom.untitled.aria = View cover full screen
# The word printed across a striped placeholder where artwork would be. It sits
# in a narrow fixed slot in small caps, so shorter is better than accurate.
common.badge.cover = COVER
common.badge.poster = POSTER
common.badge.none = NONE
# The perforated edge of the film-strip decoration. BRANDING — DO NOT TRANSLATE.
common.filmstrip.edge.label = TIPPANI · SAFETY FILM

# The wordmark — the logotype, drawn three times in the shell (the login screen,
# the drawer header and the top bar). BRANDING, LIKE THE FILM-STRIP EDGE ABOVE:
# the same value in every language.
#
# THE APP'S NAME AND THE APP'S LOGOTYPE ARE TWO THINGS, and this key is only the
# second. Bengali calls the app টিপ্পনী and says so in its own prose — see
# shell.onboarding.title and shell.drawer.tagline.label — but a logotype is a
# drawn mark set in one face at one size, and changing its script is a branding
# decision rather than a translation. It goes through the resolver anyway so that
# the pseudo-locale can see it, and so a language that DOES want its own mark has
# somewhere to say so.
shell.wordmark.label = tippani

# --- THE THREE THINGS ON THIS SCREEN THAT ARE NOT COPY.
#
# Each goes through the resolver anyway, because the alternative is an exemption
# in the pseudo-locale gate and a gate with exemptions in it stops being a gate.
# Each carries the SAME VALUE IN EVERY LANGUAGE, exactly as
# common.filmstrip.edge.label does and as §6.3's "unchanged" rows do.
#
# The size readout beside the Type card's slider. A unit symbol next to a Western
# digit, in the same class as {n}h / {n}d / ×{n} — not a word.
settings.type.size.format = {n}px
# The four credit separators, as the chip DRAWS them. These are the characters the
# splitter actually matches, so translating one would name a separator nothing
# splits on: an author line reads "Gaiman & Pratchett" or "Gaiman and Pratchett"
# in English whatever language the interface is in. The screen-reader names beside
# them (settings.credits.sep.*.aria) ARE copy and are translated.
settings.credits.sep.comma.symbol = ,
settings.credits.sep.semicolon.symbol = ;
settings.credits.sep.amp.symbol = &
settings.credits.sep.and.symbol = “and”
# What the Updates card shows for a build with no version stamped on it. A version
# identifier, per §8 — never translated, and not a word about anything.
settings.updates.version.dev = dev

# --- the tiles / list / table switch.
common.view.toggle.aria = View
common.view.tiles.label = Tiles
common.view.list.label = List
common.view.table.label = Table

# --- tables and filter rows.
common.table.sort.tip = Sort by this column
common.filters.label = Filters
common.filters.genre.aria = Filter by genre
common.filters.genre.all.label = All genres
common.filters.reset.aria = Reset every filter
common.sheet.close.tip = Close this sheet
common.more.aria = More actions
common.progress.aria = progress

# --- how a year is written. FOUR MESSAGES rather than a prefix and a suffix,
# because "c." and "BCE" may need to sit on the other side of the number.
common.year.ce.label = {year}
common.year.bce.label = {year} BCE
common.year.circa.ce.label = c. {year}
common.year.circa.bce.label = c. {year} BCE

# --- the colour a quote is filed under.
common.colour.pick.tip = Pick {name}
common.colour.current.tip = Colour: {name}
common.colour.pick.empty.tip = Pick a colour

# --- where a metadata row came from.
common.source.detail.tip = {name} · {detail}
common.source.aria = Source: {name}

# The mark a proverb board wears in place of a face. {name} is the language.
common.language-mark.aria = in {name}

# ---------------------------------------------------------------------------
# vocab.source.* — the metadata suppliers. PROPER NOUNS: DO NOT TRANSLATE.
# Transliterating into the reader's script is fine; renaming is not.
# ---------------------------------------------------------------------------
vocab.source.google.label = Google Books
vocab.source.openlibrary.label = Open Library
vocab.source.wikipedia.label = Wikipedia
# The picture ladder's keyless rung. Named for the FOUNDATION and not for
# Wikipedia, because the picture may come from either the article or Commons
# and the reader is being told who to credit, not which API answered.
vocab.source.wikimedia.label = Wikimedia
# The wikis that cover what Wikipedia does not — the long tail of characters.
vocab.source.fandom.label = Fandom

# The floor under IGDB for games rather than a second opinion, so it is named.
vocab.source.wikidata.label = Wikidata

vocab.source.amazon.label = Amazon
# The picture search — Google's Programmable Search, which is a different
# product from the Books API above and takes a different pair of credentials.
vocab.source.tmdb.label = TMDB
vocab.source.tvdb.label = TheTVDB
# What a row whose supplier the app does not recognise is called.
vocab.source.unknown.label = unknown source

# ---------------------------------------------------------------------------
# shell.* — the frame rather than a screen: App.jsx's login box, first run,
# the drawer, both top bars, the update banner, the profile panel.
# ---------------------------------------------------------------------------

# The panel a crashed screen is replaced by. The rest of the app keeps working.
shell.error.boundary.title = Something broke on this screen
shell.error.boundary.body = the rest of the app is fine.
# The same line when the crashed area has a name. {name} is that name.
shell.error.boundary.named.body = {name} — the rest of the app is fine.

# The legend for every keyboard shortcut at once, opened by \`?\`.
shell.shortcuts.title = Keyboard shortcuts
shell.shortcuts.intro.prose = Every one of these is also written on the button that does the same thing, so you never have to memorise one to find it. Keys do nothing while you are typing.
# {mode} is the name of the Practice mode, in bold; {key} is a drawn key cap.
shell.shortcuts.practice.prose = A quiz card answers to the keys for the kind of question it is asking. In {mode} the same keys need {key} — the daily deck is your schedule and its grades are permanent, so the mode with lower stakes is the one that costs an extra finger.

# ---------------------------------------------------------------------------
# unit.* — EVERY COUNTABLE NOUN'S FORMS, and nothing else. The only namespace
# whose values are word-forms rather than sentences.
#
# A value here goes AFTER A NUMERAL, which is the whole reason the namespace
# exists: in Bengali a noun after a numeral usually takes no plural marker at all
# ("৩ বই"), while a bare heading wants the plural or a classifier — so a
# heading uses <screen>.section.<noun>.title and never one of these.
#
# The sentence that holds one is common.count.phrase ({n} {noun}); resolve the
# noun first with t('unit.book', {count: n}), then the sentence.
# ---------------------------------------------------------------------------

unit.book.one = book
unit.book.other = books
# A film, show or game as a row of the catalogue — "title" is what the three have
# in common, and it is what the bulk bar and the wishlist folder count in.
unit.title.one = title
unit.title.other = titles
unit.film.one = film
unit.film.other = films
unit.show.one = show
unit.show.other = shows
unit.quote.one = quote
unit.quote.other = quotes
# A quote saved against a book.
unit.highlight.one = highlight
unit.highlight.other = highlights
# A quote saved against a film or show. The stored kind is 'dialogue' and the
# WORD is "film line" — this pair composes the bulk toasts, and the typed delete
# phrase the Go server checks is built from the English of it, not from here.
unit.dialogue.one = film line
unit.dialogue.other = film lines
unit.entry.one = entry
unit.entry.other = entries
unit.anthology.one = anthology
unit.anthology.other = anthologies
unit.board.one = board
unit.board.other = boards
unit.tag.one = tag
unit.tag.other = tags
unit.sticker.one = sticker
unit.sticker.other = stickers
unit.item.one = item
unit.item.other = items
unit.work.one = work
unit.work.other = works
unit.issue.one = issue
unit.issue.other = issues
unit.actor.one = actor
unit.actor.other = actors
# A row of a table, which is what a table's action cell calls the thing it acts on
# when its caller did not name it.
unit.row.one = row
unit.row.other = rows

# The sentence that puts a number in front of one of the words above. ALSO
# EMITTED BY GROUP C (bulkOps.jsx composes it) — same key, same value.
common.count.phrase = {n} {noun}

# ---------------------------------------------------------------------------
# common.* continued — works.jsx: the shelf, the read log, the shared filter
# toolbar, the work tile and its delete confirm.
# ---------------------------------------------------------------------------

# --- the primary credit, whose column is one but whose word depends on the
# medium: a film has a director, a show a creator, a game a studio.
common.field.director.label = Director
common.field.creator.label = Creator
common.field.studio.label = Studio
# The same three as a small-caps badge on a card, in a narrow fixed slot.
common.badge.director = DIR.
common.badge.created-by = CREATED BY
common.badge.studio = STUDIO

# --- the bucket a "group by" view puts the rows with nothing to group on.
common.group.no-series.label = No series
common.group.no-genre.label = No genre
common.group.unknown-year.label = Unknown year
common.group.unknown-credit.label = Unknown
common.group.none.label = None
# A decade heading: 1920 becomes "1920s".
common.group.decade.label = {year}s
# The tooltip on a group heading that names a person.
common.person.open.tip = Open this person's details

# --- the in-progress cap. Starting one more than the shelf holds asks first.
# {verb} is the in-progress word for the medium — reading, watching, playing.
common.work.cap.confirm.title = Already {verb} {n}
common.work.cap.confirm.action.label = Start it anyway
common.work.cap.confirm.body = The shelf holds {n} {noun} at a time, to keep it worth glancing at. Settle one below — that marks it finished today, and you can correct the date on its own page — or start this one too and let the shelf run long.
# The date prompt a shelf transition opens.
common.work.shelf-date.hint = as precise as you actually know — a year on its own is fine

# --- where you are in a work, in the units it is actually counted in. These sit
# in a narrow mono slot: E for episode, S for season, p. for page.
common.position.episode.label = E{a}
common.position.episode-season.label = {a} · S{b}
common.position.page.label = p. {a} of {b}

# --- the progress editor under a work's state chip.
common.progress.editor.title = progress
common.progress.unit.aria = Progress unit
common.progress.unit.percent.label = %
common.progress.unit.pages.label = pages
common.progress.unit.episodes.label = episodes
common.progress.field.season.label = season
common.progress.field.episode.label = episode
common.progress.field.page.label = page
# The word between "episode 6" and "10" — 6 OF 10.
common.progress.field.of.label = of
common.action.set.label = set

# --- the read / watch log.
common.read-log.unknown.label = unknown
# A finished read, as a date range.
common.read-log.range.label = {a} – {b}
# One still open. {a} is the date it was started.
common.read-log.range.open.label = {a} – still going
common.read-log.abandoned.label = (abandoned)
# Why the open row cannot be edited here: the status control above sets it.
common.read-log.open.hint = set above
# The log's own small lower-case buttons. Lower case is the slot, not a mistake.
common.read-log.edit.label = edit
common.read-log.save.label = save
common.read-log.cancel.label = cancel
common.read-log.delete.label = delete
common.read-log.add.book.label = add a past read
common.read-log.add.film.label = add a past watch
common.read-log.started.placeholder = 2009 or 2009-06-14
common.read-log.finished.placeholder = 2009-06
common.read-log.outcome.finished.label = finished
common.read-log.outcome.abandoned.label = abandoned
common.field.started.label = Started
common.field.finished.label = Finished
common.field.outcome.label = Outcome

# --- the shelf chip on a work's page.
# What the chip says when the work has no shelf state yet.
common.shelf.shelve.label = Shelve
common.shelf.wishlist.tip = Why this is on the wishlist
common.shelf.wishlist.explainer.prose = On the wishlist because nothing is quoted from it yet — automatic, and it clears itself the moment you add a quote. Putting it on a shelf below is a separate thing.
common.shelf.change.tip = Change the shelf state
# How many times it has been finished, as a multiplier.
common.shelf.reads.label = ×{n}
common.shelf.read-log.tip = Open the read log

# --- the shelf transitions, named by what pressing one will DO. The word follows
# the medium: a book is read, a film watched, a game played.
common.shelf.move.playing.again.label = Play it again
common.shelf.move.playing.resume.label = Carry on playing
common.shelf.move.playing.start.label = Mark as playing
common.shelf.move.reading.again.book.label = Read it again
common.shelf.move.reading.again.film.label = Watch it again
common.shelf.move.reading.resume.book.label = Pick it back up
common.shelf.move.reading.resume.film.label = Carry on watching
common.shelf.move.reading.start.book.label = Mark as reading
common.shelf.move.reading.start.film.label = Mark as watching
common.shelf.move.paused.label = Pause it
common.shelf.move.abandoned.label = Give up on it
common.shelf.move.completed.played.label = Mark as played
common.shelf.move.completed.book.label = Mark as read
common.shelf.move.completed.film.label = Mark as watched
common.shelf.move.clear.label = Clear the shelf tag

# --- the work tile.
common.poster.alt = Poster of {title}
# The count under a tile. A film's rows are called "dialogues" HERE and "film
# lines" in the bulk vocabulary (unit.dialogue) — two words for one row, and the
# tile's is the one in the narrow slot.
common.work-card.count.quote.one = {n} quote
common.work-card.count.quote.other = {n} quotes
common.work-card.count.dialogue.one = {n} dialogue
common.work-card.count.dialogue.other = {n} dialogues

# --- deleting one work, from its own card. ONE TAP, not a typed phrase: the
# subject is the cover you just pressed and the bin holds it for thirty days.
common.work.delete.confirm.title = Delete {title}?
common.work.delete.confirm.body.one = It goes to the bin with the {n} quote saved from it — one entry, put back together or not at all. The toast offers an Undo.
common.work.delete.confirm.body.other = It goes to the bin with the {n} quotes saved from it — one entry, put back together or not at all. The toast offers an Undo.
# The same confirm for a work nothing is quoted from.
common.work.delete.confirm.body.empty = It goes to the bin and can be put back. The toast offers an Undo.
common.work.delete.confirm.action.label = Delete it

# --- the wishlist folder tile: the works you have nothing from yet, in one card.
common.wishlist-folder.tip = The {n} you have nothing from yet
common.wishlist-folder.subtitle.label = nothing quoted yet

# --- the four numbers in a work's hero. {noun} is already the plural.
common.hero.counts.empty.label = no {noun} yet
common.hero.counts.favourites.one = {n} favourite
common.hero.counts.favourites.other = {n} favourites
common.hero.counts.noted.label = {n} noted
common.hero.counts.tagged.label = {n} tagged

# --- the sticky bar on a work's page, on a phone.
common.detail.back.tip = Back to the list
common.action.back.label = Back

# --- the shared filter toolbar. The chip carries the short word and the tooltip
# the sentence, so a chip row can lose its words on a phone and still be readable.
common.filters.favourites.label = ♥ favourites
common.filters.favourites.tip = Show only favourites
common.filters.tagged.label = tagged
common.filters.tagged.tip = Only tagged {noun}
common.filters.noted.label = has notes
common.filters.noted.tip = Only {noun} with notes
# The three-way wishlist scope. "all" ignores it, "wishlist" shows only the works
# nothing is quoted from, "annotated" hides them.
common.filters.wish.label = wishlist
common.filters.wish.all.label = all
common.filters.wish.all.tip = Every {noun}
common.filters.wish.only.label = wishlist
common.filters.wish.only.tip = Only unquoted {noun}
common.filters.wish.annotated.label = annotated
common.filters.wish.annotated.tip = Hide unquoted {noun}
common.filters.shelf.label = shelf
common.filters.shelf.aria = Filter by shelf state
common.filters.shelf.all.label = any state
common.filters.shelf.none.label = No shelf tag
common.filters.genre.label = genre
common.filters.only.label = show only
common.filters.sort.label = sort
common.filters.sort.aria = Sort
# {field} is the name of the column being filtered — series, collection, actor.
common.filters.by.aria = Filter by {field}
common.filters.all.label = all {field}
# What a book's group of related titles is called, and its plural. A film's is a
# "collection", passed in by the Catalogue.
common.filters.series.noun.one = series
common.filters.series.noun.other = series
common.filters.credit.noun.one = actor
common.filters.credit.noun.other = actors
# The live count in a filter sheet's footer.
common.filters.shown.label = {n} shown
common.action.export.shown.tip = Export what is shown

# ---------------------------------------------------------------------------
# error.* — keyed by WHAT FAILED, never by where. "could not save" had 24 copies
# before this; one key collapses them and makes every remaining distinction a
# deliberate one.
# ---------------------------------------------------------------------------
error.save.generic = could not save
error.save.read = could not save this read
error.save.watch = could not save this watch
error.validate.partial-date = needs to be YYYY, YYYY-MM or YYYY-MM-DD
error.validate.episodes-total = how many episodes in this season?
error.validate.pages-total = how many pages in the book?

# ---------------------------------------------------------------------------
# vocab.key.* — the words on a key cap. keys.js draws these; a keyboard's own
# legend is what the reader is looking at, so translate only where the platform
# does.
# ---------------------------------------------------------------------------
# The Mac modifier, and the word everywhere else. DO NOT TRANSLATE the glyph.
vocab.key.mod.mac.label = ⌘
vocab.key.mod.label = Ctrl
vocab.key.space.label = Space
vocab.key.esc.label = Esc
vocab.key.shift.label = Shift

# ---------------------------------------------------------------------------
# shell.shortcut.* — the keyboard registry. Nothing is listed here that does not
# work, so every one of these is a promise printed on a button and in the legend.
# ---------------------------------------------------------------------------
shell.shortcut.group.anywhere.label = Anywhere
shell.shortcut.group.go-to.label = Go to
shell.shortcut.group.mcq.label = Multiple choice
shell.shortcut.group.flip.label = Flip card
shell.shortcut.group.cloze.label = Fill in the blank
shell.shortcut.search.label = Search
shell.shortcut.capture.label = Capture a quote
shell.shortcut.help.label = Keyboard shortcuts
shell.shortcut.go-home.label = Go to Home
shell.shortcut.go-library.label = Go to Library
shell.shortcut.go-catalogue.label = Go to Catalogue
shell.shortcut.go-quotes.label = Go to Quotes
shell.shortcut.go-anthologies.label = Go to Anthologies
shell.shortcut.go-stats.label = Go to Stats
shell.shortcut.go-metadata.label = Go to Metadata
shell.shortcut.go-profile.label = Open your profile
shell.shortcut.go-settings.label = Go to Settings
shell.shortcut.pick-1.label = Choose the first answer
shell.shortcut.pick-2.label = Choose the second
shell.shortcut.pick-3.label = Choose the third
shell.shortcut.pick-4.label = Choose the fourth
shell.shortcut.reveal.label = Reveal the answer
shell.shortcut.grade-forgot.label = Forgot
shell.shortcut.grade-got.label = Got it
shell.shortcut.focus-blank.label = Type in the blank

# A control's tooltip with its key appended. {name} is the tooltip, {key} the cap.
common.shortcut.suffix.label = {name} · {key}
# The Practice form of a quiz key, which asks for one extra finger.
common.shortcut.shifted.label = Shift-{key}

# ---------------------------------------------------------------------------
# undo, and the last-resort failure.
# ---------------------------------------------------------------------------
# The toast every delete answers with. Five words or fewer: it is one glance.
common.toast.deleted.label = deleted
# And the one undo answers with, from both places that can undo — the toast's own
# button and the selection bar. ONE KEY, because it is one word about one act: the
# migration briefly had two (this and common.toast.restored) and a translator would
# have had to write it twice and been free to disagree with themselves.
common.toast.restored.label = restored
# The failure of an undo is error.undo.generic, with the other three verbs of the
# selection bar, further down. Kept as one family rather than split between here and
# there for the same reason.
# What errText says when the server sent no message and the caller named no
# failure. The last resort, and it should read as one.
error.generic = something went wrong

# The one-word wait every screen shows while a fetch is in flight.
common.state.loading = loading…

# The round sticker a quote flows around, on a board that lets you move it.
common.sticker.drag.tip = Drag to reposition

# ---------------------------------------------------------------------------
# error.validate.* for the two typed secrets. ONE MESSAGE PER SECRET rather than
# one sentence with the noun dropped into the front of it: the marker on
# "password" depends on what follows it in Bengali, which a shared sentence
# cannot express.
# ---------------------------------------------------------------------------
error.validate.password.min = Password must be at least {n} characters
error.validate.password.max = Password must be at most {n} characters
error.validate.password.charset = Password: letters, digits and punctuation only — no accents
error.validate.passphrase.min = Passphrase must be at least {n} characters
error.validate.passphrase.max = Passphrase must be at most {n} characters
error.validate.passphrase.charset = Passphrase: letters, digits and punctuation only — no accents

# ---------------------------------------------------------------------------
# shell.* continued — App.jsx. The login box, first run, restore-before-login,
# the drawer, both top bars, the update link and the profile panel frame.
# ---------------------------------------------------------------------------

# --- the demo ribbon, on the read-only GitHub Pages build only.
# {link} is a link to the repository, whose words are the key below it.
shell.demo.ribbon.prose = Demo · dummy data, read-only · rougher than the real thing — {link}
shell.demo.ribbon.link.label = the self-hosted app is more polished →
shell.demo.roadmap.link.label = roadmap →

# --- the login form, shared by first run and every visit after it.
common.field.username.label = Username
common.field.username.placeholder = username
common.field.password.label = Password
common.field.password.placeholder = password
common.field.passphrase.label = Passphrase
# The signup form's password box, which states the rule up front. {a} is the
# shortest allowed and {b} the longest.
shell.login.password.range.placeholder = password ({a}–{b})
shell.login.cta.label = Sign in
shell.login.microcopy.prose = locked out? an admin can reset your password
# The toast on a successful login. {name} is the account's username.
shell.login.toast.welcome = welcome back, {name}
# What the toast calls somebody whose account has no username to read.
shell.login.reader.fallback = reader
# A blocked button prints its reason as a sentence underneath. {reason} is one of
# the error.validate.* messages, and this key is what puts the full stop on it.
common.form.reason.sentence = {reason}.

# --- the first-run screen. The first account becomes the admin.
shell.onboarding.title = Welcome to tippani
shell.onboarding.subtitle.prose = This first account becomes the admin.
shell.onboarding.cta.label = Create admin account
shell.onboarding.microcopy.prose = onboarding closes once a user exists

# --- restoring a backup INSTEAD of creating an account: the moving-to-a-new-box
# path, offered on the first-run screen.
shell.restore.title = or restore a backup
shell.restore.what.prose = Loads everything in it — accounts, libraries and settings — then you log in with the credentials from that backup.
shell.restore.source.aria = Restore from
shell.restore.source.server.label = This server
shell.restore.source.file.label = A file
# {date} is when the archive this server keeps was made, in bold.
shell.restore.server.dated.prose = archive from {date}
shell.restore.server.empty.prose = nothing in this server’s backups folder
shell.restore.file.aria = Choose a backup file to restore
shell.restore.file.choose.label = Choose backup file…
shell.restore.passphrase.placeholder = the archive’s passphrase
# The archive was sealed with one account's password. {name} is that account.
shell.restore.password.named.label = Password for ‘{name}’
shell.restore.password.placeholder = the password it was sealed with
shell.restore.password.recoverable.prose = If this server made the archive, its recovery key opens it and any password of that account will do.
shell.restore.password.era.prose = The password that account had when the archive was made.
shell.restore.unkeyed.prose = this archive predates 1.4.1 and carries no key
shell.restore.uploading.busy = Uploading… {percent}%
shell.restore.toast.done = restored · log in again

# --- the two nav landmarks. The drawer already claims "Primary", so the phone's
# floating bar needs a different name or a screen reader lists two of one thing.
shell.nav.primary.aria = Primary
shell.nav.tools.aria = Tools
shell.nav.quick.aria = Quick navigation

# --- the avatar chip, in both top bars and in the drawer's footer.
shell.account.chip.tip = Your profile
shell.account.chip.aria = Profile — {name}
shell.account.back.tip = Close and go back
shell.account.panel.close.tip = Close this panel
# The profile screen's own name. It is a route rather than a nav tab, so it has
# no strip entry — the avatar is its door.
nav.tab.profile.label = Profile

# --- the ☰ drawer.
shell.drawer.open.tip = Open the navigation menu
shell.drawer.open.aria = Menu
shell.drawer.close.aria = Close menu
# The app's name in Bengali, and what the word means. ALREADY BENGALI on the
# English side, and it stays: it is the app naming itself.
shell.drawer.tagline.label = টিপ্পনী · a marginal annotation
# What the one Add row can reach, as a badge beside it.
shell.drawer.add.badge.label = work · quote · import
shell.drawer.pending.label = Pending import
# The Metadata row's badge when the console has nothing to fix.
shell.drawer.metadata.clear.label = all clear
shell.drawer.stats.streak.label = {n}-day streak
shell.drawer.settings.version.label = v{version}
shell.drawer.role.admin.label = admin · self-hosted
shell.drawer.role.user.label = self-hosted
shell.drawer.logout.label = log out
shell.drawer.changelog.tip = Release notes on GitHub
shell.drawer.changelog.label = v{version} · changelog ↗
shell.drawer.update.tip = Update to {version}
shell.drawer.update.label = ↑ update to {version}

# --- the ＋ in both top bars, which reads the route it is standing on.
shell.add.work.label = Add or import
shell.add.film.label = Add a film or show
shell.add.quote.label = Capture a quote
# The same button when an import is waiting in the pending queue.
shell.add.pending.tip = {n} imports awaiting review

# --- Search, and its global mode (right-click on a desktop).
shell.search.global.tip = Searching everything
shell.search.global.aria = Search everything

# The crashed-screen panel names the screen by its route key, which is not a
# translated word — keep {name} where it lands and translate the frame.
shell.error.boundary.screen.label = The {name} screen

# ---------------------------------------------------------------------------
# error.validate.* — what a blocked button says instead of refusing after the
# click. Each is printed as a sentence by common.form.reason.sentence.
# ---------------------------------------------------------------------------
error.validate.username-required = Enter your username
error.validate.password-required = Enter your password
error.validate.backup-file-required = Choose a backup file
error.validate.backup-absent = No backup on this server
error.validate.archive-passphrase-required = Enter the archive’s passphrase
error.validate.archive-password-required = Enter the password it was sealed with
error.restore.failed = restore failed

# ---------------------------------------------------------------------------
# settings.* — Settings.jsx. The cards migrated in this pass: multi-author
# credits, colour categories, review scope, the Type panel, language marks, the
# quiz panel, Features, button labels and Appearance.
# ---------------------------------------------------------------------------

# --- multi-author credits.
settings.credits.title = Multi-author credits
settings.credits.info.title = Multi-author credits
settings.credits.info.body = Splits a credit like “Gaiman & Pratchett” into two people, on the separators you pick. The author line stored on each book is untouched, so this is safe to change at any time. Turn the comma off if you store authors as “Last, First”.
settings.credits.chip.tip = Split credits on this separator
settings.credits.off.prose = splitting is off — every credit stays one person

# --- colour categories. Renaming changes the words and never the stored value.
settings.colours.title = Colour categories
settings.colours.info.body = Tags say what a quote is about; its colour says what KIND of note it is. Renaming changes only the words on screen — the stored value never moves, so exports round-trip. Hiding one leaves every quote wearing it untouched.
# Slot 1 has no name, and its dot says so instead of offering a rename.
settings.colours.fixed.tip = The default colour
settings.colours.fixed.info.title = Why this one has no name
settings.colours.fixed.info.body = Where a quote lands when nobody picks a colour, and where an import with no colour lands. Naming it would file every quote you never sorted under a category you never chose. Its colour is still yours to change.
# {name} is the category's current name.
settings.colours.recolour.tip = Recolour {name}
settings.colours.name.aria = Name for the {name} category
settings.colours.palette.aria = Colour for {name}
settings.colours.offer.aria = Offer this category
settings.colours.hide.aria = Hide this category
settings.colours.offer.tip = Offer this again
# Two categories is the floor, so the second-to-last cannot be hidden.
settings.colours.keep-two.tip = Keep two categories
settings.colours.hide.tip = Stop offering this
settings.colours.reset.aria = Reset this colour
settings.colours.reset.tip = Back to the original

# --- which quotes the quiz draws from. The chip names the SCREEN (nav.tab.*)
# and the tooltip says what that screen's quotes are.
settings.review-scope.title = Review covers
settings.review-scope.info.title = Review covers
settings.review-scope.info.body = Which kinds of quote the Daily Quiz and Practice draw from, independently. A quote with no speaker and no occasion never joins the deck — there is nothing to recall but the words. Nor does anything saved in the last week.
settings.review-scope.books.tip = Your book highlights
settings.review-scope.movies.tip = Dialogue from films, shows and games
settings.review-scope.quotes.tip = Speeches, letters, anything else
# The last scope standing cannot be turned off, or the deck empties.
settings.review-scope.stuck.tip = The deck needs one

# --- Settings → Type. Six roles, three faces each, all bundled.
settings.type.title = Type
settings.type.open.tip = Every face the app uses
settings.type.intro.prose = Every face the app uses, each shown doing its own job. Two alternates apiece, all bundled with the app and free to use — nothing here is fetched from anywhere.
settings.type.style.title = style
settings.type.upload.label = ＋ Upload
settings.type.face.aria = Typeface for {name}
settings.type.face.filter.placeholder = Type a typeface name
settings.type.font.remove.tip = Remove this font
settings.type.font.remove.confirm = Remove {name}? Any role using it goes back to its built-in.
# Shown when an uploaded face measures as though it does not draw the script the
# role needs. A warning and not a refusal. {field} is the script's name.
settings.type.script-warning.prose = This font doesn’t look like it draws {field}. It is set anyway — if the text below turns into boxes, that is why.
# The script a role needs when the role does not name one.
vocab.script.latin.label = Latin

# --- Settings → Language marks. The mark a proverb board wears.
settings.languages.title = Language marks
settings.languages.open.tip = What a proverb wears
settings.languages.script.title = script
settings.languages.glyphs.aria = Script letters for {name}
settings.languages.no-script.prose = No script letters for {name} — give it a mark of your own below.
# The reader's own marks, and how many of the allowance are used. {done}/{total}.
settings.languages.customs.title = your own · {done}/{total}
settings.languages.customs.aria = Your own marks for {name}
settings.languages.mark.remove.aria = Remove {name} from {field}
settings.languages.mark.remove.tip = Remove this mark
settings.languages.full.prose = {name} keeps {n} marks of its own — remove one to add another.
settings.languages.add-mark.label = Add one of your own
settings.languages.add-mark.placeholder = any letter, symbol or emoji
settings.languages.reset.aria = Reset the {name} mark
settings.languages.reset.tip = Back to the script letter
# Renaming a language is a DISPLAY name. The stored name stays and is shown
# beside it, so "why does my Bangla board say Bengali" stays answerable.
settings.languages.rename.label = Shown as (stored as “{name}”)
settings.languages.add.label = Add a language
settings.languages.name.label = Language name
settings.languages.name.placeholder = Yoruba, Swahili, Tamil…

# --- the quiz panel.
settings.quiz.info.body = These drive both the Daily Quiz and Practice. A card's interval climbs a fixed ladder — 7, 30, then 100 days — one step per correct recall, and one lapse drops it straight back to 7.
settings.quiz.per-day.label = Daily quiz cards / day
settings.quiz.in-depth.label = In-depth controls
settings.quiz.in-depth.tip = Every question, both decks
settings.quiz.panel.title = In-depth quiz controls
# {name} is the deck — Daily quiz, or Practice.
settings.quiz.deck.title = {name} asks
settings.quiz.deck.daily.info.body = The daily deck is marked by the server from end to end, so it never offers a self-marked card. That is why the flip card is missing from this list rather than switched off in it.
settings.quiz.deck.practice.info.body = Practice leads with the flip card and varies the rest. Turn Practice scoring on and the flip card drops out, because nothing checks a self-marked answer.
settings.quiz.practice-counts.title = Practice moves the schedule
settings.quiz.practice-counts.aria = Practice affects schedule
settings.quiz.practice-counts.info.body = By default Practice is study only. Turn this on to let correct Practice answers stretch half-lives just like the Daily Quiz does.
settings.quiz.submit.title = Confirm each answer
settings.quiz.submit.aria = Confirm each answer
settings.quiz.submit.info.body = Normally a tap answers straight away. Turn this on and a tap only chooses — you can change your mind, and a Submit button records it. Flip cards are unaffected: revealing and grading are already two steps.
settings.quiz.adaptive.title = Adaptive intervals
settings.quiz.adaptive.aria = Adaptive intervals
settings.quiz.adaptive.info.body = The ladder steps 7 → 30 → 100 days, and any lapse drops you straight back to 7. Adaptive multiplies by 2.5 instead, and halves on a lapse rather than resetting — so one slip on a well-known quote no longer costs you the whole climb.
settings.quiz.adaptive.ladder.label = Ladder
settings.quiz.adaptive.on.label = Adaptive
settings.quiz.seen.title = Seeing lengthens half-life by
settings.quiz.seen.label = Seeing lengthens half-life by
settings.quiz.seen.info.body = “Seeing” a quote — practising it, sharing it, favouriting it, or meeting it among the choices on a card you answered — nudges its half-life up a little, separate from Daily Quiz recall. Leave at 1.0× to turn this off.
settings.quiz.tuning.title = How the schedule moves
settings.quiz.tuning.info.body = These multiply a quote's half-life on every answer, and are bounded rather than free: a multiplier below 1 would shorten a card every time you got it right, which never looks broken — it just asks the same quote for ever.
settings.quiz.reset.label = Back to defaults
settings.quiz.reset.tip = Undo every change on this panel

# --- Settings → Features. Hiding a section is cosmetic: it takes away the doors.
settings.features.info.title = Features
settings.features.info.body = Which sections you want to see. Hiding one takes away its tab, its tile on Home, its chip on Search and its offer under ＋ — and nothing else: every book, film and quote stays where it is, and a link or bookmark still opens it.
settings.features.intro.prose = Turn off what you do not keep, and on what you have not tried yet. This changes what you see, never what you have.
settings.features.locked.prose = The last section has to stay — turn another one on first.

# --- button labels: whether a glyph shows its words.
settings.labels.title = Button labels
settings.labels.info.title = Button labels
settings.labels.info.body = Buttons with a glyph can show their words or drop them. Auto shows them on a desktop and hides them on a phone. Hidden words are still read aloud by screen readers, and every glyph names itself on hover or long-press.
settings.labels.auto.label = Auto

# --- Appearance.
settings.appearance.title = Appearance
settings.appearance.theme.title = Theme
settings.appearance.theme.light.label = Light
settings.appearance.theme.dark.label = Dark
settings.appearance.match.label = Match system
settings.appearance.match.aria = Match system theme
# --- Appearance -> Material. Seven sets, each naming what four surfaces are
# made of: the desk under everything, the furniture, the page you read, the
# binding on a cover. Independent of light/dark -- every set works in both -- so
# these are PLACES, not moods. Translate each as the room it is, not word for
# word: the English is already the room's name rather than a description.
settings.appearance.material.title = Material
settings.material.manuscript.label = Manuscript
settings.material.film-assembly.label = Film assembly
settings.material.office.label = Office
settings.material.school.label = School
settings.material.atelier.label = Atelier
settings.material.bindery.label = Bindery
settings.material.quarry.label = Quarry
settings.material.atrium.label = Atrium
settings.appearance.accent.title = Accent
# {name} is one of the vocab.accent.* words.
settings.appearance.accent.tip = Use the {name} accent
settings.appearance.accent.aria = {name} accent
settings.appearance.book-size.label = Library cover size
settings.appearance.film-size.label = Catalogue poster size

# The global dial. It RENORMALISES rather than multiplying: moving it writes
# itself into all four kinds (type.js).
settings.appearance.text-size.label = Text size
settings.appearance.text-size.info.body = Sets every kind of text at once. Each kind can then be tuned on its own in Type, and this reads as — until you set it again. Sizes are whole pixels at every step, so nothing lands on a half.
settings.type.size.factor = {n}%
# What the global dial reads when the four kinds no longer agree. An em dash,
# deliberately not a word: it is the absence of one answer, not a state.
settings.type.size.mixed = —
settings.type.size.aria = Size of {name} text

# --- yes / no, the two words every switch in the quiz panel uses.
vocab.yes.label = Yes
vocab.no.label = No

error.delete.font = could not remove that font
# A language may keep only so many marks of its own. {name} is the language,
# {n} the allowance.
error.validate.marks-full = {name} already keeps {n} marks of its own — remove one first.


# ===========================================================================
# THE SCREENS — Home, Library, the Catalogue, Quotes, Anthologies, boards,
# Search, Stats, Tags, a work page, the quiz, sharing, the tour, and the two
# prose pools (the login epigraph and the greeting).
#
# Key scheme: <place>.<surface>.<element>[.<qualifier>].<role>.
# ===========================================================================

# ---------------------------------------------------------------------------
# THE LOGIN EPIGRAPH (epigraphs.js)
#
# One line above the sign-in box, a different one each visit. The rule for this
# pool: the app's OWN voice, unattributed, nobody named and nothing quoted —
# a bundled list of famous quotes is a bundled list of attributions written
# from memory. One sentence each, ending in a full stop, under 90 characters.
# A language may hold a different number of lines than English.
# ---------------------------------------------------------------------------

greeting.epigraph.1 = A margin is a promise: that there is always room to answer back.
greeting.epigraph.2 = The book is the author’s. The margin is yours.
greeting.epigraph.3 = Nothing is really read until something is written beside it.
greeting.epigraph.4 = A quote you cannot find again is a quote you did not keep.
greeting.epigraph.5 = Reading twice is not repetition. It is the second half of reading once.
greeting.epigraph.6 = Keep the line, and the book keeps you.
greeting.epigraph.7 = Underlining is a question. A note is the answer.
greeting.epigraph.8 = What you copied out by hand is what you actually read.
greeting.epigraph.9 = A commonplace book is a memory you are allowed to lend.
greeting.epigraph.10 = The margin is the only part of a book that is about you.

# 25 January in Egypt.
greeting.holiday.eg.01-25.1 = Happy Revolution Day, {name}
# 26 January in Australia.
greeting.holiday.au.01-26.1 = Happy Australia Day, {name}
# 26 January in India.
greeting.holiday.in.01-26.1 = Happy Republic Day, {name}
# 4 February in Sri Lanka.
greeting.holiday.lk.02-04.1 = Happy Independence Day, {name}
# 6 February in New Zealand.
greeting.holiday.nz.02-06.1 = Happy Waitangi Day, {name}
# 11 February in Japan.
greeting.holiday.jp.02-11.1 = Happy National Foundation Day, {name}
# 21 February in Bangladesh. A COMMEMORATION, not a celebration: the tone is sombre and "happy" would be wrong.
greeting.holiday.bd.02-21.1 = Marking Shaheed Dibash, {name}
greeting.holiday.bd.02-21.2 = অমর একুশে — a day for words, {name}
# 22 February in Saudi Arabia.
greeting.holiday.sa.02-22.1 = Happy Founding Day, {name}
# 1 March in South Korea. A COMMEMORATION, not a celebration: the tone is sombre and "happy" would be wrong.
greeting.holiday.kr.03-01.1 = Marking Samiljeol, {name}
# 6 March in Ghana.
greeting.holiday.gh.03-06.1 = Happy Independence Day, {name}
# 15 March in Hungary.
greeting.holiday.hu.03-15.1 = Happy 1848 Revolution Day, {name}
# 17 March in Ireland.
greeting.holiday.ie.03-17.1 = Happy St Patrick’s Day, {name}
# 23 March in Pakistan.
greeting.holiday.pk.03-23.1 = Happy Pakistan Day, {name}
# 25 March in Greece.
greeting.holiday.gr.03-25.1 = Happy Independence Day, {name}
# 26 March in Bangladesh.
greeting.holiday.bd.03-26.1 = Happy Independence Day, {name}
# 13 April in Thailand.
greeting.holiday.th.04-13.1 = Happy Songkran, {name}
# 14 April in India and Bangladesh.
greeting.holiday.in.04-14.1 = শুভ নববর্ষ, {name}
greeting.holiday.in.04-14.2 = Happy Bengali new year, {name}
# 15 April in India.
greeting.holiday.in.04-15.1 = শুভ নববর্ষ, {name}
greeting.holiday.in.04-15.2 = Happy Bengali new year, {name}
# 19 April in Venezuela.
greeting.holiday.ve.04-19.1 = Happy Primer Grito de Independencia, {name}
# 23 April in Türkiye.
greeting.holiday.tr.04-23.1 = Happy National Sovereignty and Children’s Day, {name}
# 25 April in Australia and New Zealand. A COMMEMORATION, not a celebration: the tone is sombre and "happy" would be wrong.
greeting.holiday.au.04-25.1 = Marking Anzac Day, {name}
# 25 April in Italy.
greeting.holiday.it.04-25.1 = Happy Liberation Day, {name}
# 25 April in Egypt.
greeting.holiday.eg.04-25.1 = Happy Sinai Liberation Day, {name}
# 27 April in South Africa.
greeting.holiday.za.04-27.1 = Happy Freedom Day, {name}
# 30 April in Vietnam.
greeting.holiday.vn.04-30.1 = Happy Reunification Day, {name}
# 3 May in Poland.
greeting.holiday.pl.05-03.1 = Happy Constitution Day, {name}
# 3 May in Japan.
greeting.holiday.jp.05-03.1 = Happy Constitution Memorial Day, {name}
# 5 May in the Netherlands.
greeting.holiday.nl.05-05.1 = Happy Bevrijdingsdag, {name}
# 5 May in Japan.
greeting.holiday.jp.05-05.1 = Happy Children’s Day, {name}
# 17 May in Norway.
greeting.holiday.no.05-17.1 = Happy Syttende mai, {name}
# 25 May in Argentina.
greeting.holiday.ar.05-25.1 = Happy May Revolution Day, {name}
# 1 June in Kenya.
greeting.holiday.ke.06-01.1 = Happy Madaraka Day, {name}
# 1 June in Indonesia.
greeting.holiday.id.06-01.1 = Happy Pancasila Day, {name}
# 2 June in Italy.
greeting.holiday.it.06-02.1 = Happy Festa della Repubblica, {name}
# 6 June in Sweden.
greeting.holiday.se.06-06.1 = Happy Sveriges nationaldag, {name}
# 10 June in Portugal.
greeting.holiday.pt.06-10.1 = Happy Portugal Day, {name}
# 12 June in the Philippines.
greeting.holiday.ph.06-12.1 = Happy Araw ng Kalayaan, {name}
# 12 June in Nigeria.
greeting.holiday.ng.06-12.1 = Happy Democracy Day, {name}
# 16 June in South Africa. A COMMEMORATION, not a celebration: the tone is sombre and "happy" would be wrong.
greeting.holiday.za.06-16.1 = Marking Youth Day, {name}
# 19 June in the United States.
greeting.holiday.us.06-19.1 = Happy Juneteenth, {name}
# 28 June in Ukraine.
greeting.holiday.ua.06-28.1 = Happy Constitution Day, {name}
# 1 July in Canada.
greeting.holiday.ca.07-01.1 = Happy Canada Day, {name}
# 1 July in Hong Kong.
greeting.holiday.hk.07-01.1 = Happy Establishment Day, {name}
# 4 July in the United States.
greeting.holiday.us.07-04.1 = Happy Fourth of July, {name}
greeting.holiday.us.07-04.2 = Happy Fourth, {name}
# 5 July in Venezuela.
greeting.holiday.ve.07-05.1 = Happy Independence Day, {name}
# 9 July in Argentina.
greeting.holiday.ar.07-09.1 = Happy Independence Day, {name}
# 14 July in France.
greeting.holiday.fr.07-14.1 = Happy Bastille Day, {name}
# 18 July in Uruguay.
greeting.holiday.uy.07-18.1 = Happy Constitution Day, {name}
# 20 July in Colombia.
greeting.holiday.co.07-20.1 = Happy Independence Day, {name}
# 21 July in Belgium.
greeting.holiday.be.07-21.1 = Happy Belgian National Day, {name}
# 23 July in Egypt.
greeting.holiday.eg.07-23.1 = Happy Revolution Day, {name}
# 24 July in Venezuela.
greeting.holiday.ve.07-24.1 = Happy Bolívar Day, {name}
# 26 July in the Maldives.
greeting.holiday.mv.07-26.1 = Happy Independence Day, {name}
# 28 July in Peru.
greeting.holiday.pe.07-28.1 = Happy Fiestas Patrias, {name}
# 29 July in Peru.
greeting.holiday.pe.07-29.1 = Happy Gran Parada Militar, {name}
# 1 August in Switzerland.
greeting.holiday.ch.08-01.1 = Happy Swiss National Day, {name}
# 7 August in Colombia.
greeting.holiday.co.08-07.1 = Happy Battle of Boyacá Day, {name}
# 9 August in Singapore.
greeting.holiday.sg.08-09.1 = Happy National Day, {name}
# 14 August in Pakistan.
greeting.holiday.pk.08-14.1 = Happy Independence Day, {name}
# 15 August in South Korea.
greeting.holiday.kr.08-15.1 = Happy Gwangbokjeol, {name}
# 15 August in India.
greeting.holiday.in.08-15.1 = Happy Independence Day, {name}
# 17 August in Indonesia.
greeting.holiday.id.08-17.1 = Happy Hari Kemerdekaan, {name}
# 20 August in Hungary.
greeting.holiday.hu.08-20.1 = Happy St Stephen’s Day, {name}
# 24 August in Ukraine.
greeting.holiday.ua.08-24.1 = Happy Independence Day, {name}
# 25 August in Uruguay.
greeting.holiday.uy.08-25.1 = Happy Independence Day, {name}
# 30 August in Türkiye.
greeting.holiday.tr.08-30.1 = Happy Zafer Bayramı, {name}
# 31 August in Malaysia.
greeting.holiday.my.08-31.1 = Happy Hari Merdeka, {name}
# 2 September in Vietnam.
greeting.holiday.vn.09-02.1 = Happy Quốc Khánh, {name}
# 7 September in Brazil.
greeting.holiday.br.09-07.1 = Happy Independence Day, {name}
# 16 September in Mexico.
greeting.holiday.mx.09-16.1 = Happy Independence Day, {name}
# 16 September in Malaysia.
greeting.holiday.my.09-16.1 = Happy Malaysia Day, {name}
# 18 September in Chile.
greeting.holiday.cl.09-18.1 = Happy Fiestas Patrias, {name}
# 19 September in Chile.
greeting.holiday.cl.09-19.1 = Happy Día de las Glorias del Ejército, {name}
# 21 September in Ghana. A COMMEMORATION, not a celebration: the tone is sombre and "happy" would be wrong.
greeting.holiday.gh.09-21.1 = Marking Founders’ Day, {name}
# 23 September in Saudi Arabia.
greeting.holiday.sa.09-23.1 = Happy Saudi National Day, {name}
# 24 September in South Africa.
greeting.holiday.za.09-24.1 = Happy Heritage Day, {name}
# 28 September in Czechia.
greeting.holiday.cz.09-28.1 = Happy Czech Statehood Day, {name}
# 30 September in Canada. A COMMEMORATION, not a celebration: the tone is sombre and "happy" would be wrong.
greeting.holiday.ca.09-30.1 = Marking the National Day for Truth and Reconciliation, {name}
# 1 October in Nigeria.
greeting.holiday.ng.10-01.1 = Happy Independence Day, {name}
# 1 October in China and Hong Kong.
greeting.holiday.cn.10-01.1 = Happy National Day, {name}
# 2 October in India. A COMMEMORATION, not a celebration: the tone is sombre and "happy" would be wrong.
greeting.holiday.in.10-02.1 = Marking Gandhi Jayanti, {name}
# 3 October in South Korea.
greeting.holiday.kr.10-03.1 = Happy Gaecheonjeol, {name}
# 3 October in Germany.
greeting.holiday.de.10-03.1 = Happy German Unity Day, {name}
# 5 October in Portugal.
greeting.holiday.pt.10-05.1 = Happy Republic Day, {name}
# 10 October in Taiwan.
greeting.holiday.tw.10-10.1 = Happy Double Ten Day, {name}
# 12 October in Spain.
greeting.holiday.es.10-12.1 = Happy Fiesta Nacional, {name}
# 20 October in Kenya.
greeting.holiday.ke.10-20.1 = Happy Mashujaa Day, {name}
# 23 October in Hungary. A COMMEMORATION, not a celebration: the tone is sombre and "happy" would be wrong.
greeting.holiday.hu.10-23.1 = Marking 1956 Revolution Day, {name}
# 26 October in Austria.
greeting.holiday.at.10-26.1 = Happy National Day, {name}
# 28 October in Czechia.
greeting.holiday.cz.10-28.1 = Happy Independent Czechoslovak State Day, {name}
# 28 October in Greece.
greeting.holiday.gr.10-28.1 = Happy Ohi Day, {name}
# 29 October in Türkiye.
greeting.holiday.tr.10-29.1 = Happy Cumhuriyet Bayramı, {name}
# 2 November in Mexico. A COMMEMORATION, not a celebration: the tone is sombre and "happy" would be wrong.
greeting.holiday.mx.11-02.1 = Marking Día de Muertos, {name}
# 3 November in the Maldives.
greeting.holiday.mv.11-03.1 = Happy Victory Day, {name}
# 5 November in the United Kingdom.
greeting.holiday.gb.11-05.1 = Remember, remember, {name}
# 6 November in Morocco.
greeting.holiday.ma.11-06.1 = Happy Green March Day, {name}
# 11 November in France. A COMMEMORATION, not a celebration: the tone is sombre and "happy" would be wrong.
greeting.holiday.fr.11-11.1 = Marking Armistice Day, {name}
# 11 November in Poland.
greeting.holiday.pl.11-11.1 = Happy Independence Day, {name}
# 11 November in Australia and Canada and the United Kingdom. A COMMEMORATION, not a celebration: the tone is sombre and "happy" would be wrong.
greeting.holiday.au.11-11.1 = Marking Remembrance Day, {name}
# 11 November in the Maldives.
greeting.holiday.mv.11-11.1 = Happy Republic Day, {name}
# 11 November in the United States. A COMMEMORATION, not a celebration: the tone is sombre and "happy" would be wrong.
greeting.holiday.us.11-11.1 = Marking Veterans Day, {name}
# 15 November in Brazil.
greeting.holiday.br.11-15.1 = Happy Republic Day, {name}
# 18 November in Morocco.
greeting.holiday.ma.11-18.1 = Happy Independence Day, {name}
# 1 December in Romania.
greeting.holiday.ro.12-01.1 = Happy Great Union Day, {name}
# 1 December in Portugal.
greeting.holiday.pt.12-01.1 = Happy Restoration of Independence Day, {name}
# 2 December in the United Arab Emirates.
greeting.holiday.ae.12-02.1 = Happy National Day, {name}
# 5 December in Thailand.
greeting.holiday.th.12-05.1 = Happy National Day, {name}
# 6 December in Spain.
greeting.holiday.es.12-06.1 = Happy Constitution Day, {name}
# 6 December in Finland.
greeting.holiday.fi.12-06.1 = Happy Independence Day, {name}
# 12 December in Kenya.
greeting.holiday.ke.12-12.1 = Happy Jamhuri Day, {name}
# 16 December in Bangladesh.
greeting.holiday.bd.12-16.1 = Happy Victory Day, {name}
# 17 December in Bhutan.
greeting.holiday.bt.12-17.1 = Happy National Day, {name}
# 25 December in Pakistan.
greeting.holiday.pk.12-25.1 = Happy Quaid-e-Azam Day, {name}
# 1 January in everywhere — no region needed.
greeting.holiday.intl.01-01.1 = Happy new year, {name}
greeting.holiday.intl.01-01.2 = A fresh year of margins, {name}
greeting.holiday.intl.01-01.3 = New year, empty notebook, {name}
# 14 February in everywhere — no region needed.
greeting.holiday.intl.02-14.1 = Happy Valentine’s day, {name}
greeting.holiday.intl.02-14.2 = Something quotable today, {name}?
# 23 April in everywhere — no region needed.
greeting.holiday.intl.04-23.1 = Happy World Book Day, {name}
greeting.holiday.intl.04-23.2 = World Book Day — good company, {name}
# 31 October in everywhere — no region needed.
greeting.holiday.intl.10-31.1 = Happy Hallowe’en, {name}
greeting.holiday.intl.10-31.2 = Something spooky in the margins, {name}?
# 24 December in everywhere — no region needed.
greeting.holiday.intl.12-24.1 = Christmas eve, {name}
# 25 December in everywhere — no region needed.
greeting.holiday.intl.12-25.1 = Merry Christmas, {name}
greeting.holiday.intl.12-25.2 = Happy Christmas, {name}
# 31 December in everywhere — no region needed.
greeting.holiday.intl.12-31.1 = Last page of the year, {name}
greeting.holiday.intl.12-31.2 = See the year out, {name}

# Easter Sunday, computed rather than tabled, so it needs no region.
greeting.holiday.easter = Happy Easter, {name}
# Good Friday. A solemn day: the English deliberately avoids "happy".
greeting.holiday.good-friday = A quiet Good Friday, {name}
# Fourth Thursday in November, United States.
greeting.holiday.thanksgiving.us = Happy Thanksgiving, {name}
# Second Monday in October, Canada.
greeting.holiday.thanksgiving.ca = Happy Thanksgiving, {name}

# Home greeting, after midnight and before 05:00. {name} is the reader's own name.
greeting.bucket.latenight.1 = Still up, {name}?
greeting.bucket.latenight.2 = The small hours, {name}
greeting.bucket.latenight.3 = One more page, {name}?
greeting.bucket.latenight.4 = Burning the midnight oil, {name}
greeting.bucket.latenight.5 = Quiet o’clock, {name}
# Home greeting, 05:00 to 08:00. {name} is the reader's own name.
greeting.bucket.dawn.1 = Early start, {name}
greeting.bucket.dawn.2 = Morning, {name} — before the world wakes
greeting.bucket.dawn.3 = First light, {name}
greeting.bucket.dawn.4 = Up with the birds, {name}
# Home greeting, 08:00 to noon. {name} is the reader's own name.
greeting.bucket.morning.1 = Good morning, {name}
greeting.bucket.morning.2 = Morning, {name}
greeting.bucket.morning.3 = A good morning for a good line, {name}
greeting.bucket.morning.4 = Fresh page, {name}
greeting.bucket.morning.5 = Morning, {name} — what did you read?
# Home greeting, noon to 17:00. {name} is the reader's own name.
greeting.bucket.afternoon.1 = Good afternoon, {name}
greeting.bucket.afternoon.2 = Afternoon, {name}
greeting.bucket.afternoon.3 = Mid-afternoon, {name} — time for a chapter
greeting.bucket.afternoon.4 = Afternoon, {name}. Anything worth keeping?
# Home greeting, 17:00 to 21:00. {name} is the reader's own name.
greeting.bucket.evening.1 = Good evening, {name}
greeting.bucket.evening.2 = Evening, {name}
greeting.bucket.evening.3 = Evening, {name} — the reading hour
greeting.bucket.evening.4 = Wind down, {name}
# Home greeting, after 21:00. {name} is the reader's own name.
greeting.bucket.night.1 = Good night, {name}
greeting.bucket.night.2 = Evening, {name}
greeting.bucket.night.3 = A late line or two, {name}?
greeting.bucket.night.4 = Night, {name} — one chapter more

# Home greeting on a Saturday or Sunday, 05:00 to 08:00. {name} is the reader's own name.
greeting.weekend.dawn.1 = Early, for a weekend, {name}
greeting.weekend.dawn.2 = A quiet weekend start, {name}
# Home greeting on a Saturday or Sunday, 08:00 to noon. {name} is the reader's own name.
greeting.weekend.morning.1 = Happy Saturday, {name}
greeting.weekend.morning.2 = Weekend morning, {name}
greeting.weekend.morning.3 = Slow morning, {name}
greeting.weekend.morning.4 = No alarm today, {name}
# Home greeting on a Saturday or Sunday, noon to 17:00. {name} is the reader's own name.
greeting.weekend.afternoon.1 = Weekend afternoon, {name}
greeting.weekend.afternoon.2 = A whole afternoon to read, {name}
greeting.weekend.afternoon.3 = Lazy afternoon, {name}
# Home greeting on a Saturday or Sunday, 17:00 to 21:00. {name} is the reader's own name.
greeting.weekend.evening.1 = Weekend evening, {name}
greeting.weekend.evening.2 = Evening, {name} — no Monday yet
greeting.weekend.evening.3 = Settle in, {name}
# Home greeting on a Saturday or Sunday, after 21:00. {name} is the reader's own name.
greeting.weekend.night.1 = Late weekend night, {name}
greeting.weekend.night.2 = No alarm tomorrow, {name}

# Home greeting on a Sunday morning, instead of the weekend pool — "Happy
# Saturday" on a Sunday is worse than saying nothing clever at all.
greeting.sunday.1 = Happy Sunday, {name}
greeting.sunday.2 = Sunday morning, {name}
greeting.sunday.3 = Slow Sunday, {name}

# What the greeting calls somebody with no display name set.
greeting.name-fallback = reader
# The small mono line above the Home greeting. Both halves come from the
# device's own date formatting; this key is only the punctuation between them.
greeting.dateline.format = {weekday} · {date}

# ---------------------------------------------------------------------------
# THE QUIZ (quiz.js) — the deck rules, as the Settings panel lists them.
#
# quiz.* is a MODE rather than a screen: the same runner opens over Home, a
# book, a person and a tag, so its words belong to the mode.
# ---------------------------------------------------------------------------

# The two decks, named. "Practice" is the name of a FEATURE here, not the verb
# on a button — that one is common.action.practise.label and will be a
# different word.
quiz.daily.label = Daily quiz
quiz.practice.label = Practice

# The seven question types. .label is the chip in Settings, .hint its tooltip.
quiz.question.source.label = Name the source
quiz.question.source.hint = Shows the quote and asks which book, film, show, game or speech it came from. Multiple choice.
quiz.question.quote.label = Pick the quote
quiz.question.quote.hint = The other way round: shows the work and asks which of these lines came out of it. Multiple choice.
quiz.question.cloze.label = Fill in the blank
quiz.question.cloze.hint = Blanks a phrase out of the quote and asks you to type it back. Graded on the server, and forgiving about typos and punctuation. Worth more than a multiple choice, and costs less when you miss it.
quiz.question.cloze-mcq.label = Fill in the blank — with choices
quiz.question.cloze-mcq.hint = The same blank, with four phrases to pick between instead of a box to type into. The other three are real phrases cut out of your own other quotes, so they are the right length and the right kind of words.
quiz.question.speaker.label = Who said this?
quiz.question.speaker.hint = Anything with a speaker on record: a film, show or game line offers its cast, a speech offers the people you have heard from. A highlight has neither, so this is never asked of one.
quiz.question.author.label = Who wrote this?
quiz.question.author.hint = Books only — nobody is credited with writing a film line, so the question there is who SAID it. The wrong answers are the authors of the books nearest this one.
quiz.question.flip.label = Flip and self-mark
quiz.question.flip.hint = Shows the quote, reveals the source, and asks you whether you had it. Nothing checks the answer, so it is offered in Practice only — and drops out there too once Practice is scored.

# The two axes every question type sits on, appended to its tooltip: WHAT is
# being asked, and HOW you answer it. Two questions sharing a class are the same
# question asked two ways — which is what a flat row of chips cannot show.
quiz.class.work.label = Which work
quiz.class.quote.label = Which quote
quiz.class.person.label = Who is behind it
quiz.class.words.label = The words themselves
quiz.form.choose.label = pick one of four
quiz.form.type.label = type it back
quiz.form.self.label = mark yourself
quiz.taxonomy.line = {klass} · {form}

# Appended to the hint of a question toggle that REFUSES to switch off,
# because it is the last one the deck could ask of a book as well as a film.
quiz.question.last-universal.info = Every deck needs at least one question it can ask of a book as well as a film — this is the last one.

# The ten tuning sliders in Settings → Quiz. .label sits above the slider,
# .hint is its info dot. Every one of these multiplies a half-life.
quiz.tuning.grow.label = Correct answer stretches by
quiz.tuning.grow.hint = Adaptive scheduling only. A correct recall multiplies the half-life by this. 2.5 is SM-2’s classic ease — higher means longer gaps sooner, and more forgetting between them.
quiz.tuning.shrink.label = A lapse shortens by
quiz.tuning.shrink.hint = Adaptive scheduling only. A miss multiplies the half-life by this rather than resetting it — 0.5 halves it. It cannot be 1 or more, which would make forgetting a card lengthen its interval.
quiz.tuning.cloze-grow.label = Typed answers earn
quiz.tuning.cloze-grow.hint = Fill-in-the-blank is recall with nothing to lean on, where a multiple choice has three quarters of the work done for you. This is how much more a typed answer is worth when you get it right.
quiz.tuning.cloze-shrink.label = And cost
quiz.tuning.cloze-shrink.hint = The other half, and the one that makes it fair rather than generous: failing the hardest question in the deck is weak evidence that you have forgotten the quote, where failing to recognise it among four is strong evidence.
quiz.tuning.cloze-synonym.label = A synonym is worth
quiz.tuning.cloze-synonym.hint = A blank filled with a close synonym counts as correct, and earns this much of the stretch an exact recall does. At 0.5 the word itself is worth twice a word that means the same; at 0 a synonym counts without moving the card.
quiz.tuning.cloze-words.label = Multi-word blanks from
quiz.tuning.cloze-words.hint = A blank hides one word until a quote has been remembered this long, and only then may it hide a phrase. Set it to 1 to allow wide blanks immediately.
quiz.tuning.ladder-1.label = Ladder rung 1
quiz.tuning.ladder-1.hint = The fixed ladder’s first rung, and where any lapse drops a card back to. Ignored when Adaptive intervals is on.
quiz.tuning.ladder-2.label = Ladder rung 2
quiz.tuning.ladder-2.hint = The middle rung.
quiz.tuning.ladder-3.label = Ladder rung 3
quiz.tuning.ladder-3.hint = The top rung. Cards sit here for as long as the correct answers keep coming.

# Under the three ladder sliders when they are not in ascending order. The
# panel refuses rather than letting the server silently revert them.
quiz.tuning.ladder.error = The three rungs have to climb — each one longer than the one before it.

# ---------------------------------------------------------------------------
# THE FACET GRAMMAR (facets.js)
#
# NOTE FOR THE TRANSLATOR: the FIELD names in the search box — tag:, author:,
# colour: — are deliberately NOT here. They are grammar the box parses, not
# copy, and translating one would stop the box understanding what was typed.
# Only the two values below are words.
# ---------------------------------------------------------------------------

# The only two facet values the app supplies itself: the dropdown offered for
# favourite:, note: and wishlist:. The wire still carries yes/no; this is what
# the reader picks from and types over.
vocab.yesno.yes.label = yes
vocab.yesno.no.label = no

# ---------------------------------------------------------------------------
# ACTING ON A SELECTION (bulkOps.jsx) — shared by the selection bar and by one
# work card's own menu, so common.* rather than any one screen.
# ---------------------------------------------------------------------------

# The nouns a selection is counted in are unit.* above, and the sentence that puts
# a number in front of one is common.count.phrase — both shared, so a bulk toast and
# a board heading cannot disagree about what a row is called.

# The toast after acting on a selection. {n} is how many rows were touched — which
# is what makes it a different string from common.toast.deleted.label above and not
# a second copy of it. Undoing says common.toast.restored.label, up there, because
# undoing one row and undoing forty say the same word.
common.toast.deleted = deleted {n}
# Fill gaps: the three outcomes. "nothing was missing" is the GOOD case and has
# to read like one, or people learn to distrust the button.
common.selection.fill.toast.nothing-missing = nothing was missing
common.selection.fill.toast.none-fetched = nothing could be fetched
# {n} counts FIELDS filled, not works — "filled 3 books" over a selection of
# forty reads as a failure where "filled 7 fields" reads as the win it is.
common.selection.fill.toast.filled = filled {n} fields

# Under one field of the bulk edit sheet, warning what setting it would destroy.
# {n} is how many rows already hold a value; {value} is that value when they all
# agree; {distinct} is how many different ones there are when they do not.
common.selection.edit.title = Set a field on {n}
common.selection.edit.body = Choose one field and one value. Every selected record gets it; nothing else is touched.
common.selection.edit.field.label = field
common.selection.edit.field.aria = Which field to set
common.selection.edit.value.aria = The value to set
common.selection.edit.value.none.label = (none)
common.selection.edit.clear.hint = Empty clears the field.
common.selection.edit.overwrite.same = overwrites {n} that already say “{value}”
common.selection.edit.overwrite.differ = overwrites {n}, with {distinct} different values

# Failures, keyed by WHAT failed rather than by where.
error.apply.generic = could not apply
error.fill.generic = could not fill
error.delete.generic = could not delete
error.undo.generic = could not undo

# ---------------------------------------------------------------------------
# THE CARD AND SELECTION ACTIONS (actions.jsx, selection.jsx, SelectionBar.jsx)
#
# One registry drives a card's ⋯ menu AND the bar a selection puts up, so all
# of this is common.*. Every label is FIVE WORDS OR FEWER — the house rule —
# and every one of them names what pressing it will DO, never where the row
# currently stands.
# ---------------------------------------------------------------------------

# What a card menu calls its own subject, dropped into the tooltips below. A
# film or show is "this title" because that is the word the delete confirmation
# uses too. In Bengali the case marker belongs on the noun, so it is carried
# here rather than in the sentences that quote it.
common.subject.book.label = this book
common.subject.movie.label = this title
common.subject.quote.label = this quote

# The card actions. .label is the menu row, .tip the hover tooltip.
common.action.copy.tip = Copy {subject}
common.action.share.tip = Share {subject}
common.action.edit.tip = Edit {subject}
common.action.delete.tip = Delete {subject}
# Fetch only what is MISSING and touch nothing else.
common.action.fill.label = Fill gaps
common.action.fill.tip = Fill the empty fields
# While it is fetching.
# A themed quiz round over one book or one title.
common.action.practise.tip = Quiz me on {subject}
# The quiz toggle, which flips to name what pressing it will do.
common.action.review.add.label = Add to quiz
common.action.review.add.tip = Put it back in the quiz
common.action.review.skip.label = Skip in quiz
common.action.review.skip.tip = Keep it out of the quiz
# The other flipping pair: .on when the row is NOT a favourite yet, .off when
# it already is. Bengali negation is a different construction, so both are keys.
common.action.favourite.menu.on.label = Favourite
common.action.favourite.menu.off.label = Unfavourite
common.action.favourite.tip = Favourite {subject}
# Filing a standalone quote on a different board.
common.action.board.label = Move to board
common.action.board.tip = File it on another board
# The bulk-only actions: recolour, tag, sticker ("seal"), shelf, anthology, and
# setting fields across several works at once.
common.action.colour.label = Colour
common.action.add-tags.label = Add tags
common.action.seal.label = Seal
common.action.shelf.label = Shelf
common.action.anthology.label = Add to anthology
common.action.set-fields.label = Set fields

# The select controls a card's own menu puts above its actions. {n} is how many
# cards are on screen — never how many the library holds, because a filter may
# be hiding four hundred.
common.selection.menu.select.label = Select
common.selection.menu.deselect.label = Deselect
common.selection.menu.select-all.label = Select all {n}
common.selection.menu.deselect-all.label = Deselect all

# THE SELECTION BAR. The count badge at the left empties the picks and leaves
# the bar standing; the ✕ at the right ends the mode. {noun} arrives already in
# the right form from unit.*.
common.selection.deselect-all.label = Deselect all
# Spoken and hovered when nothing is picked. A bare 0 in a count reads as
# something having gone wrong, so zero is worded rather than numbered.
common.selection.none.aria = no {noun} selected
common.selection.count.aria = Deselect all, {n} {noun} selected
common.selection.count.tip = {n} {noun} selected
common.selection.colour.aria = Recolour the {n} selected
common.selection.shelf.aria = Move the {n} selected to a shelf
common.selection.shelf.tip = Move to a shelf
# The first row of the shelf menu: take the selection off its shelf entirely.
common.selection.shelf.clear.label = Clear
common.selection.more.aria = More for the {n} selected
common.selection.more.tip = More actions
common.selection.dismiss.aria = Dismiss the selection

# Toasts after a bulk action. {n} is how many rows were touched.
common.selection.toast.recoloured = recoloured {n}
common.selection.toast.tagged = tagged {n}
common.selection.toast.sealed = sealed {n}
common.selection.toast.seals-removed = seals removed
common.selection.toast.fields-set.one = 1 record updated
common.selection.toast.fields-set.other = {n} records updated
common.selection.toast.favourited = favourited {n}
common.selection.toast.moved = moved {n}
common.selection.toast.back-in-quiz = back in the quiz
common.selection.toast.skipping = skipping {n}
# Gathering into an anthology. A quote already there is SKIPPED, not an error,
# so the second form reports both numbers rather than claiming they all landed.
common.selection.toast.gathered = {n} gathered
common.selection.toast.gathered-some = {n} gathered, {skipped} already there

# The delete confirmation. The reader has to TYPE {phrase} — and {phrase} is
# still assembled in English by bulkOps.deletePhrase, because the Go server
# compares it byte for byte. Translating this sentence without the server would
# make the control impossible to satisfy.
common.selection.delete.confirm.title = Delete {n} {noun}?
common.selection.delete.confirm.body.work = They go to the bin with every quote saved from them — one entry for the whole selection, put back together or not at all. Type {phrase} to confirm.
common.selection.delete.confirm.body.quote = They go to the bin and can be put back — one entry for the whole selection, with an Undo in the toast. Type {phrase} to confirm.
common.selection.delete.confirm.phrase.aria = Type the confirmation phrase
common.selection.delete.confirm.action.label = Delete them

# The tag sheet the bar opens. Every tag is ADDED; nothing is removed.
common.selection.tags.title = Tag {n}
common.selection.tags.body = Every tag here is ADDED to all {n}. Nothing already on them is removed.
common.selection.tags.placeholder = add tags
common.selection.tags.input.aria = Tags to add to the selection

# The sticker sheet. "none" is the option that takes the seal off.
common.selection.seal.title = Seal {n}
common.selection.seal.body = One sticker across the whole selection. “none” takes the seal off every one of them.

error.add.generic = could not add those

# ---------------------------------------------------------------------------
# THE TAGS SCREEN (TagsPage.jsx) and THE STICKER LIBRARY (stickers.jsx)
#
# One screen holds both: the tag vocabulary at the top, the uploaded stickers
# below the rule. A "sticker" is an image; the SEAL is that image pinned into a
# quote, which the text then flows around.
# ---------------------------------------------------------------------------

# The three lower-case word links on a small card — deliberately lower case, so
# they are their own strings and not the Title Case buttons of the same name.
common.link.practise.label = practise
common.link.edit.label = edit
common.link.delete.label = delete

# Under the page title. {n} tags, and a reminder that one vocabulary serves both
# sides of the library.
tags.header.counts = {n} {noun} · shared by books & films
tags.board.empty = no tags yet — create one above, or tag an annotation

# The dashed add card, and the form inside it.
tags.new.title = ＋ New tag
tags.new.submit.label = Create tag
tags.form.edit.title = Edit tag
# The radio group of live chip previews, one per tag style.
tags.form.style.aria = Tag style

# The chip on a tag card: the tag's own name, then how many quotes wear it.
tags.card.chip.label = {name} · {n}

# The sortable table behind "more". {n} is how many rows are NOT in the top five.
tags.table.more.label = More tags ({n})…
tags.table.hide.label = Hide table
# How many quotes wear this tag / this sticker. A derived count, not a column.
tags.table.uses.label = Uses

# Deleting a tag. The second form is used when the tag is actually on something:
# nothing is lost but the tag itself, and saying so is what makes it safe to say
# yes to. {noun} arrives from unit.item.
tags.delete.confirm.body = Delete tag "{name}"?
tags.delete.confirm.body-used = Delete tag "{name}"? It will be detached from {n} {noun} — they keep working, just untagged.

# THE STICKER LIBRARY, lower half of the same screen.
tags.sticker.section.title = Stickers
tags.sticker.board.empty = no stickers yet — upload a transparent PNG or SVG above
tags.sticker.new.title = ＋ New sticker
tags.sticker.new.body = transparent PNG or SVG images — attach one to any quote in its add/edit form
tags.sticker.new.upload.label = Upload sticker
# The same button while the file is going up. Lower case, unlike the tooltip on
# the picker's ＋, which is common.action.upload.busy.
tags.sticker.new.upload.busy = uploading…
tags.sticker.table.more.label = More stickers ({n})…
# Deleting a sticker. A quote that loses its seal still works; saying so is the
# difference between a safe yes and a guess.
tags.sticker.delete.confirm.body = Delete this sticker?
tags.sticker.delete.confirm.body-used = Delete this sticker? It will be detached from {n} {noun} — they keep working, just without the seal.

# THE STICKER PICKER, which appears in every add and edit form and in the
# selection bar's seal sheet — not only on the Tags screen.
# The alt text on a sticker image that has no name of its own.
common.sticker.image.alt = sticker
# The first option in the strip: no seal on this quote.
common.sticker.none.label = none
common.sticker.none.tip = No sticker
common.sticker.use.tip = Use “{name}”
# The same tooltip for a sticker nobody has named yet.
common.sticker.use-any.tip = Use as the seal
common.sticker.upload.tip = Upload a new sticker


# Failures.
error.upload.sticker = could not upload sticker
error.delete.sticker = could not delete sticker
error.delete.tag = could not delete tag
error.save.tag = could not save tag
error.create.tag = could not create tag
error.rename.generic = could not rename
error.validate.name-required = A name is required
error.validate.name-blank = name is required

# ---------------------------------------------------------------------------
# THE GUIDED TOUR (tour.jsx)
#
# Thirteen steps that open once on a first launch and can be replayed from
# Settings → Onboarding. This is ONE EDITORIAL VOICE and wants a writer rather
# than a translator: it is the only place in the app that speaks in paragraphs.
#
#   .name   the row in the Settings feature list (welcome and done have none)
#   .blurb  the one-line summary beside that row
#   .title  the step's own heading, and the dialog's accessible name
#   .prose  the sentence or two the step is actually about
#   .more   the detail behind the info dot next to the title
#
# {em1} {em2} … ARE THE BOLD RUNS inside a .prose value, and each one is its own
# key below it — <step>.em1.label and so on. The sentence may move them wherever
# it needs to; the words inside them are translated like any others.
# ---------------------------------------------------------------------------

# Step "welcome".
tour.step.welcome.title = Welcome to tippani
tour.step.welcome.prose = Tippani is a home for the lines worth keeping — book highlights and film dialogue, with covers, tags, instant search and a daily memory quiz. This tour walks through every feature.
tour.step.welcome.more = Next moves on step by step, “skip tour” ends it, and “finish later” saves your place — a Resume button waits in Settings → Onboarding. Nothing here needs your files: every example is built in. The top bar also carries a “?” that lists what every control on whichever screen you are looking at does — this tour is the once-over, that is the reference.

# Step "add".
tour.step.add.name = Add & import
tour.step.add.blurb = one ＋ pill adds books, films & shows, captures quotes, or bulk-imports highlights
tour.step.add.title = One ＋ Add for everything
tour.step.add.prose = The ＋ pill is the single way in, and it knows where you are: a {em1} on Library, a {em2} on the Catalogue, a {em3} against whichever work you have open. Bulk {em4} is a tab of the same surface.
tour.step.add.em1.label = book
tour.step.add.em2.label = film or show
tour.step.add.em3.label = quote
tour.step.add.em4.label = import
tour.step.add.more = Books are looked up by title, author or ISBN and films on TMDB/TheTVDB, with covers and details fetched for you. Import reads Markdown and Readest exports, Kindle Bookcision and your Kindle notebook, Goodreads and Hardcover pages, and IMDb quote pages. An import lands in Pending import first and stays there until you okay it — fix chapters and locations in bulk, move quotes to the right work, then approve or discard. A count on the ＋ pill says how much is waiting, and re-importing the same file never duplicates anything. The drawer’s Add is the context-free twin — it opens with nothing pre-filled, wherever you started from.

# Step "library".
tour.step.library.name = Library — books & annotations
tour.step.library.blurb = covers, series, highlight colours, tags, favourites; masonry/list/table + group-by
tour.step.library.title = The Library
tour.step.library.prose = Books live here with their covers, and every highlight you have kept from them. A book highlight looks like this:
tour.step.library.more = Each annotation carries a highlight colour, tags, a chapter and location, and a favourite ♥. Browse as a packed masonry, a plain list or a sortable table; filter by genre, shelf state, favourites, tags or notes; and group by series, author, decade or genre. Series keep their reading order.

# Step "catalogue".
tour.step.catalogue.name = Catalogue — films & dialogues
tour.step.catalogue.blurb = memorable lines with timestamp, character and auto-filled actor
tour.step.catalogue.title = The Catalogue
tour.step.catalogue.prose = Films and shows keep their dialogue the same way — each line with its timestamp and character. A dialogue looks like this:
tour.step.catalogue.more = The actor is auto-filled from the title’s cast, so you only type the character. Shows carry a season and episode too. Everything else matches the Library: the same tags, favourites, views and group-bys.

# Step "share".
tour.step.share.name = Share & export
tour.step.share.blurb = share sheet (WhatsApp/Markdown/image cards) + Obsidian-friendly export
tour.step.share.title = Share a line, export the lot
tour.step.share.prose = Any quote shares in one tap — as text, or as an {em1} drawn in your own skin.
tour.step.share.em1.label = image card
tour.step.share.more = Share formats: rich Markdown, WhatsApp, plain text or Reddit, plus a shareable image rendered locally (nothing is uploaded) with a live preview. Export works at any scale — one work, a filtered set, or the whole library — as Obsidian-friendly Markdown that round-trips cleanly back through the importer.

# Step "quiz".
tour.step.quiz.name = Daily Quiz & Practice
tour.step.quiz.blurb = spaced repetition over your quotes — cards resurface as you start to forget
tour.step.quiz.title = The daily ritual
tour.step.quiz.prose = Home deals a short quiz over your own quotes, scheduled so each card comes back right as you’d start to forget it. Two or three minutes a day.
tour.step.quiz.more = Every quote wears a status dot — remembered, forgetting, or probably forgotten — and answering honestly is what moves it. Practice is the unlimited, skippable twin: it keeps its own score and by default never touches the schedule. How many cards, whether covers show, and how much a look lengthens a half-life all live in Settings.

# Step "search".
tour.step.search.name = Instant search
tour.step.search.blurb = typo-tolerant full-text search across quotes, works, people and notes
tour.step.search.title = Find any line again
tour.step.search.prose = Instant, {em1} search over everything you have kept, with results sectioned by what matched. Started from Library or the Catalogue it arrives scoped to that side; the drawer’s Search clears the scope.
tour.step.search.em1.label = typo-tolerant
tour.step.search.more = It searches titles, authors, directors, genres, series, quotes, notes, tags and dialogue, and the sections mirror that: books, films, people, annotations, dialogues, notes, tags, genres. A decade (“1990s”) or a day (“2026-07-14”) is a valid search and finds what you captured then. Group results like the Library, open a hit in place to share or edit, or tick a set for a bulk tag or field edit. Your last search is remembered.

# Step "tags".
tour.step.tags.name = Tags & stickers
tour.step.tags.blurb = cross-cutting tags with styles; pin your own PNG/SVG stickers to quotes
tour.step.tags.title = Tags & stickers
tour.step.tags.prose = Tags cut across books and films alike, each with its own look. {em1} are your own images, pinned to a quote as a seal.
tour.step.tags.em1.label = Stickers
tour.step.tags.more = A tag draws as a sticker, banner, flyout, tape or reel, in a colour you choose; renaming one updates every quote carrying it. Stickers are transparent PNG or SVG files you upload. The quote’s text flows around a pinned sticker, and you can drag it wherever you like on the card.

# Step "metadata".
tour.step.metadata.name = Metadata console & People
tour.step.metadata.blurb = coverage per field, bulk fixes, duplicate merges; people with portraits & links
tour.step.metadata.title = Keep the shelves tidy
tour.step.metadata.prose = The console shows what is missing across the library and fixes it in bulk. {em1} get portraits and reference links — tap any author or actor name, anywhere.
tour.step.metadata.em1.label = People
tour.step.metadata.more = Per-field coverage tiles double as filters: tap “no cover” to list exactly those books. From there you can bulk-correct a selection, merge duplicate titles, remap speaker labels onto a cast, and re-verify pinned works against the live sources before anything is written. Fetching missing covers and metadata runs in chunks behind a real progress bar. People resolve to IMDb, TMDB, TheTVDB, Wikipedia and Open Library.

# Step "stats".
tour.step.stats.name = Stats
tour.step.stats.blurb = capture calendar, memory health, and author/actor/director/tag breakdowns
tour.step.stats.title = Your library in numbers
tour.step.stats.prose = A calendar of your captures, memory health from the quiz, and the people and tags your library leans on.
tour.step.stats.more = Everything on this screen is a doorway rather than a read-out: a calendar dot opens that day’s additions in Search, and any book, author, actor, director or tag clicks through the same way.

# Step "appearance".
tour.step.appearance.name = Appearance
tour.step.appearance.blurb = paper or film, light/dark/system, four accents — per user
tour.step.appearance.title = Make it yours
tour.step.appearance.prose = Paper or film, light or dark or match-the-OS, four accents, and your own cover sizes — every user keeps their own combination.

# Step "keys".
tour.step.keys.name = Metadata keys & Amazon cookie
tour.step.keys.blurb = TMDB/TheTVDB/Google Books keys and the optional Amazon cookie (admin)
tour.step.keys.title = Metadata keys & the Amazon cookie
tour.step.keys.prose = Lookups run on keys saved in the highlighted card. Each field there edits and saves on its own, and each carries its own info dot with where to get that key. Paste them now — the tour waits — or press Next and add them later.
tour.step.keys.more = TMDB (films & shows) is usually active out of the box on a shared built-in key; your own free v3 key comes from themoviedb.org → Settings → API. TheTVDB is optional and usually better for long-running shows: thetvdb.com → Dashboard → API keys. Google Books is optional and only matters past roughly 1,000 lookups a day. The Amazon cookie is optional and advanced — it only adds description and genres for Kindle/ASIN books, and covers already work without it. Books need no key at all: Google Books and Open Library work without one, and manual entry always works.

# Step "backup".
tour.step.backup.name = Backup, restore & updates
tour.step.backup.blurb = one encrypted dated archive, in-place or cross-server restore, on-demand updates (admin)
tour.step.backup.title = Sleep well
tour.step.backup.prose = One click builds a dated archive of everything and downloads it, {em1} with your own password. Restore it here, or restore a file taken off another Tippani to move house.
tour.step.backup.em1.label = encrypted
tour.step.backup.more = The archive holds the database, images, users and settings — including password hashes and API keys — which is why it is sealed before it leaves the server. Your account name and password are the key, so the same archive opens on any Tippani; set a separate passphrase instead if you would rather it were not tied to a login. Either way the key is never stored anywhere, so keep it: nobody can open the archive without it, including you. Updates are checked on demand only — never in the background — in the card above; with the Docker socket mounted, applying one is a single click.

# Step "account".
tour.step.account.name = Profile & users
tour.step.account.blurb = photo, display name, password, account switching; per-user libraries; admin user management
tour.step.account.title = Yours, and everyone else’s
tour.step.account.prose = The avatar chip opens your {em1} — photo, display name, password, switching to another account, logging out. Every user gets a fully separate library.
tour.step.account.em1.label = Profile
tour.step.account.more = Admins manage users from the same screen: add, remove, grant or revoke admin. The last remaining admin cannot be demoted, so an instance can never be locked out of itself. To hand over, grant another user admin first, then revoke your own. Switching accounts asks for that account’s password every time — being an admin does not let you in without one.

# Step "done".
tour.step.done.title = That’s the tour
tour.step.done.prose = You’ve seen everything. Replay this tour anytime from {em1}, and use the {em2} on any screen for what its controls do. Enjoy the margins.
tour.step.done.em1.label = Settings → Onboarding
tour.step.done.em2.label = ?

# The tour's own chrome. {done} of {total} counts steps, and {total} varies: an
# admin sees two steps nobody else does, and a switched-off section drops its own.
tour.progress.label = {done} of {total}
# Saves your place and closes. Escape does the same thing.
tour.later.label = finish later
# Ends the tour for good.
tour.skip.label = skip tour
tour.back.aria = Previous step
tour.next.label = Next
# The last step's Next.
tour.finish.label = Finish
# One toast per way out, so which one you took is never in doubt.
tour.toast.done = tour complete · replay in Settings
tour.toast.skipped = tour skipped · start in Settings
tour.toast.postponed = saved · resume in Settings

# THE BUILT-IN SAMPLE QUOTES, rendered under the Library and Catalogue steps so
# an empty library still shows what a captured quote looks like. Both are public
# domain. A LANGUAGE MAY REPLACE THEM WITH ITS OWN: the point is to show the
# shape of a kept line, and a line nobody in the room can read does not.
# Leave the titles and the names alone if you keep these two.
tour.demo.book.quote.prose = It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.
tour.demo.book.title = Pride and Prejudice
tour.demo.book.author.label = Jane Austen
tour.demo.book.meta.label = Chapter 1
# The credit line under the sample book highlight. {title} arrives italicised.
tour.demo.book.credit.label = — {name}, {title} · {meta}
tour.demo.film.quote.prose = Here's looking at you, kid.
tour.demo.film.title = Casablanca
tour.demo.film.character.label = Rick Blaine
tour.demo.film.actor.label = Humphrey Bogart
tour.demo.film.meta.label = 01:15:00
# The credit line under the sample film line. {title} arrives italicised.
tour.demo.film.credit.label = — {character} ({actor}), {title} ({year}) · {meta}

# ---------------------------------------------------------------------------
# THE QUOTES SCREEN AND ITS BOARDS (boards.jsx)
#
# A board is a shelf standalone quotes are filed on. Every quote is on exactly
# one, which is why deleting a board asks where its quotes go rather than
# refusing or orphaning them.
# ---------------------------------------------------------------------------

# ⚠ SEEDED USER DATA. Pressing a starter WRITES this name into the reader's own
# database as a board they then own and can rename. Translating these changes
# what a NEW install gets and leaves boards made before the change in English.
# That is accepted — but nobody should ever "fix" the mismatch by migrating a
# reader's own board names.
quotes.starter.proverbs.name = Proverbs
quotes.starter.proverbs.description = Handed down, not attributed.
quotes.starter.speeches.name = Speeches
quotes.starter.speeches.description = Said aloud, to a room.
quotes.starter.others.name = Others
quotes.starter.others.description = Everything else worth keeping.

# The board list itself.
quotes.board.new.label = New board
quotes.board.all.label = All quotes
# The toggle that folds hidden boards back in. "In use" is the default view.
quotes.board.hidden.aria = Hidden boards
quotes.board.hidden.inuse.label = In use
quotes.board.hidden.all.label = All {n}
# What a reader with no standalone quotes lands on. {em1} is the New board
# button, named again in bold so the sentence points at a real control.
quotes.board.list.empty = No boards yet. {em1} offers the three to start from — Proverbs, Speeches and Others — and takes any name you like instead. The ＋ in the top bar saves a quote and makes the first one for you.

# The board form, new and editing.
quotes.board.form.new.title = New board
quotes.board.form.edit.title = Edit board
# The example name in the empty Name box.
quotes.board.form.name.placeholder = Proverbs
quotes.board.form.clash.error = You already have a board called that.
# WHAT the board holds, which is not the same question as what it is called: a
# proverb board puts the language and the translation first on the quote form.
quotes.board.form.kind.label = what it holds
quotes.board.form.kind.aria = What it holds
quotes.board.kind.plain.label = Quotes
quotes.board.kind.proverb.label = Proverbs
# Under the three starter chips. Pressing one fills the form in; it does not
# create anything.
quotes.board.form.starters.hint = Fills the form in. Change any of it before you create.
quotes.board.form.languages.label = languages
quotes.board.form.languages.hint = Offered on the quote form, and what the language sections group by.
quotes.board.form.language.label = Another language
quotes.board.form.language.placeholder = Tamil, Yoruba…
quotes.board.form.colour.label = colour
quotes.board.form.description.label = What it is for
quotes.board.form.description.placeholder = Handed down, not attributed.
# The upload control for the board's own picture.
quotes.board.form.picture.label = Picture

quotes.board.toast.picture-saved = picture saved
quotes.board.toast.deleted = board deleted

# Deleting a board. {name} is the board's own name.
quotes.board.delete.confirm.title = Delete {name}?
# The refusal: nowhere to put the quotes. Said plainly rather than shown as a
# disabled button with no reason. {noun} arrives from unit.quote.
quotes.board.delete.only.body = This is your only board and it holds {n} {noun}. Make another board first — the quotes have to go somewhere.
# English inflects the VERB with the count here, not just the noun, so the two
# forms carry the whole sentence rather than substituting a noun into one.
quotes.board.delete.holds.body.one = {n} quote is filed here. They move to another board rather than being deleted.
quotes.board.delete.holds.body.other = {n} quotes are filed here. They move to another board rather than being deleted.
quotes.board.delete.move.aria = Move the quotes to
quotes.board.delete.empty.body = Nothing is filed here, so nothing is lost.

# THE MOVE-TO-BOARD SHEET, opened from a card's ⋯ and from the selection bar,
# so common.* rather than quotes.*.
common.board.move.title.one = Move this quote
common.board.move.title.other = Move {n} quotes
common.board.move.body.one = Which board it is filed on. Nothing else about the quote changes.
common.board.move.body.other = All {n} move to one board. Nothing else about them changes.
common.board.move.empty = There is nowhere to move them — make a board first.
common.board.move.select.placeholder = choose a board

# Two more shared verbs, and the pair on a board's own menu. The words say what
# pressing them DOES, so Hide is on a board that is currently visible.
common.action.create.label = Create


error.upload.generic = could not upload that
error.save.board = could not save that board
error.delete.board = could not delete that board
error.validate.board-name-required = Give the board a name

# ---------------------------------------------------------------------------
# ANTHOLOGIES (anthologies.jsx)
#
# Quotes gathered into a chosen READING ORDER, with the reader's own prose
# between them. Not a board (which says where a quote is filed) and not a tag
# (which says what it is about): an anthology is a piece of writing, so the
# words here are an editor's words rather than a filing system's.
# ---------------------------------------------------------------------------

anthologies.list.new.label = New anthology
# The empty state names the way IN rather than reporting that the list is empty:
# nothing on this screen can add an entry, by design. {em1} is the New anthology
# button, {em2} the selection bar's Add to anthology.
anthologies.list.empty = No anthologies yet. {em1} makes one; to fill it, select some quotes on the Library, the Catalogue or Quotes and choose {em2} from the selection bar.

# The form. A duplicate title is fine here, unlike a board, so there is no clash
# warning to write.
anthologies.form.new.title = New anthology
anthologies.form.edit.title = Edit anthology
anthologies.form.title.placeholder = On grief
anthologies.form.intro.label = Introduction
anthologies.form.intro.placeholder = Why these lines, and in this order.

# The anthology as it reads. {title} falls back to this while it is loading.
anthologies.read.title.fallback = Anthology
anthologies.read.back.label = All anthologies
anthologies.read.empty = Nothing gathered here yet. Select some quotes on the Library, the Catalogue or Quotes and choose {em1} from the selection bar.

# One entry. The reader's note reads ABOVE the quote, which is the shape of every
# anthology ever printed: the editor introduces the piece, then the piece speaks.
anthologies.entry.more.aria = More for this entry
anthologies.entry.note.title = Your note
anthologies.entry.note.body = What this passage is doing here. It reads above the quote.
anthologies.entry.note.placeholder = The turn this line makes.
anthologies.entry.note.add.label = Add note
anthologies.entry.note.edit.label = Edit note
# The attribution line under a quote with no credit recorded.
anthologies.entry.unattributed.label = unattributed
# The attribution line itself. The second form is used where the quote has a
# parent work; {source} is then a link into it. The separator is part of the
# value so another language can choose its own.
anthologies.entry.credit.label = {credit}
anthologies.entry.credit-source.label = {credit} · {source}
# The same line with the credit switched off (0045). Its own key rather than the
# one above with an empty hole, so the separator never appears with nothing beside it.
anthologies.entry.source.label = {source}

# --- What an anthology shows, and therefore what it exports. Six switches on the
# anthology itself: a collection of film lines wants its actors named and a book of
# proverbs wants nothing but the words. Each label names the THING, because the
# control beside it is what says on or off.
anthologies.form.fields.label = What each passage shows
anthologies.form.fields.hint = The same for what you read and what you export.
anthologies.form.fields.credit.label = Who said it
anthologies.form.fields.source.label = Where it came from
anthologies.form.fields.locator.label = Chapter, page or timestamp
anthologies.form.fields.date.label = The day you saved it
anthologies.form.fields.commentary.label = Your commentary
anthologies.form.fields.colour.label = The colour bar

anthologies.toast.deleted = anthology deleted
anthologies.toast.entry-removed = entry removed

# Deleting one. UNUSUAL TWICE OVER: it does not go to the bin, and what is lost
# is the reader's own writing while the quotes themselves are untouched. Saying
# both halves is what makes it a question somebody can answer.
anthologies.delete.confirm.title = Delete {title}?
anthologies.delete.confirm.body = The introduction and the note on each of its {n} {noun} go with it. The quotes themselves stay exactly where they are.
anthologies.delete.confirm.note = This one does not wait in the bin, so there is nothing to put back.

# THE ADD-TO-ANTHOLOGY SHEET, opened from the selection bar on three different
# screens, so common.* rather than anthologies.*.
common.anthology.add.title.one = Add this quote
common.anthology.add.title.other = Add {n} quotes
common.anthology.add.body.one = It goes to the end of the anthology. The quote itself does not move.
common.anthology.add.body.other = All {n} go to the end of the anthology. The quotes themselves do not move.
# Reachable with the Anthologies section switched OFF, which is why it names the
# switch as well as the screen — a dead end otherwise.
common.anthology.add.empty = No anthologies yet — make one on the Anthologies screen (Settings → Features).
common.anthology.add.select.placeholder = choose an anthology

# Reordering an entry. No drag: a drag has no keyboard equivalent, and a menu row
# is reachable by tab, by arrow key and by a thumb.
common.action.move-up.label = Move up
common.action.move-down.label = Move down


error.load.anthologies = could not load your anthologies
error.open.anthology = could not open that anthology
error.save.anthology = could not save that anthology
error.delete.anthology = could not delete that anthology
error.save.note = could not save that note
error.remove.entry = could not remove that entry
error.move.entry = could not move that entry
error.validate.anthology-title-required = Give the anthology a title

# ---------------------------------------------------------------------------
# THE QUOTES SCREEN — one board of standalone quotes (Quotes.jsx)
#
# A standalone quote has no parent work: a proverb, a speech, a letter. So the
# four things that stand in for a title here are who said it, through what
# medium, where, and when.
# ---------------------------------------------------------------------------

# THE STARTER PROVERBS, offered only on an EMPTY board. Nothing arrives unasked:
# a proverb is content, and seeding content nobody chose is the app writing in
# somebody's collection.
quotes.starter.title = start with a curated set
quotes.starter.body = Ten each, unattributed, with an English translation where the words are not in English.
# {n} is how many will land, {name} the language they are in.
quotes.starter.take.label = Add {n} {name}
quotes.starter.take.busy = Adding…
# Asking twice adds nothing, and says so rather than implying a second copy.
quotes.starter.added.label = added {n}
quotes.starter.already.label = already there

# The capture / edit form for a standalone quote.
# "When" rather than "Date": a year alone is a complete answer here.
quotes.form.when.label = When
# WHERE IT IS FILED, which is a board — the word is historical.
quotes.form.kind.label = Kind

# The board being read.
quotes.board.back.label = All boards
quotes.board.empty = nothing on this board yet — the ＋ in the top bar saves a line from anywhere
quotes.board.nomatch = no quotes match these filters
# Under the board title. The second form is used where the board has a
# description of its own; the separator is inside the value on purpose.
quotes.board.counts = {n} {noun}
quotes.board.counts-described = {n} {noun} · {description}

# The filters. The colour swatch row doubles as its own off switch.
quotes.filters.colour.aria = Filter by category
quotes.filters.speaker.aria = Filter by speaker
quotes.filters.speaker.all.label = all speakers
quotes.filters.kind.aria = Filter by kind
quotes.filters.kind.all.label = all kinds
quotes.filters.language.aria = Filter by language
quotes.filters.language.all.label = all languages

# Group by. "Quotes" here means UNGROUPED — one pile.
quotes.group.none.label = Quotes
quotes.group.speaker.label = Speaker
quotes.group.kind.label = Kind
quotes.group.place.label = Place
quotes.group.decade.label = Decade
# Offered on a proverb board only: on a board of speeches the field is empty on
# every row, which would be one section called "No language" holding all of it.
quotes.group.language.label = Language
# The catch-all section heading, per dimension. It says WHAT IS MISSING rather
# than "None", because a proverb lands in the catch-all of every one of these.
quotes.group.residual.speaker.label = No speaker
quotes.group.residual.kind.label = No kind
quotes.group.residual.place.label = No place
quotes.group.residual.language.label = No language
quotes.group.residual.none.label = None

# Sort.
quotes.sort.recent.label = Recent
quotes.sort.speaker.label = Speaker
quotes.sort.occasion.label = Occasion
quotes.sort.said.label = When said

quotes.delete.confirm = Delete this quote?
quotes.toast.moved = moved
quotes.export.confirm.title = Export quotes
quotes.export.confirm.body.one = {n} quote in view will be exported as a single Markdown file (re-importable into Tippani).
quotes.export.confirm.body.other = {n} quotes in view will be exported as a single Markdown file (re-importable into Tippani).

# The lower-case small-caps labels above a control in a filter sheet or a form.
# Their Title Case twins are common.field.*.label and are different strings.
common.mono.colour.label = colour
common.mono.group.label = group
common.mono.tag.label = tag
common.mono.speaker.label = speaker
common.mono.medium.label = medium
common.mono.language.label = language

# Filter controls shared by the Library, the Catalogue and Quotes.
common.filters.tag.aria = Filter by tag
common.filters.tag.all.label = all tags
common.filters.group.aria = Group by

error.add.starters = could not add them
error.move.generic = could not move
error.validate.quote-required = Write the quote
error.validate.date = Check the date

# ---------------------------------------------------------------------------
# SHARING A QUOTE (share.jsx, quoteImage.js)
#
# THIS NAMESPACE HAS A DIFFERENT AUDIENCE FROM THE REST OF THE APP. Some of
# these words are written INTO the text the reader sends to somebody else — a
# stranger who has never opened tippani — rather than drawn in the interface.
# Those are the share.credit.* and share.text.* keys, and they should read as
# an epigraph rather than as a form label.
# ---------------------------------------------------------------------------

# The dialog itself.
share.dialog.aria = Share quote
share.dialog.title = Share
share.format.label = format
share.format.aria = Share format
share.include.label = include
share.text.label = text
share.text.aria = Shareable text
share.preview.label = preview
share.preview.empty = nothing selected

# THE FOUR TEXT FORMATS AND THE PICTURE. .name is the row in the format toggle
# — all four are PROPER NOUNS and must not be translated. .what says exactly
# which syntax will be produced, and .hint is a mono sample of that syntax:
# ⚠ THE .hint VALUES ARE LITERAL MARKUP. Translate the words inside them (bold,
# italic, quote, code, text, url) only if you are sure; never the punctuation.
share.format.whatsapp.name = WhatsApp
share.format.whatsapp.what = WhatsApp chat formatting — single-character wrappers; no headings or link syntax (raw URLs auto-link).
share.format.whatsapp.hint = *bold*  _italic_  ~strike~  > quote  \`\`\`code\`\`\`
share.format.plaintext.name = Plain
share.format.plaintext.what = Plain text for Twitter/X, SMS — nothing renders, so: “curly quotes” around the quote and an — attribution line.
share.format.plaintext.hint = no markup · “…” · — Author, Title · #tags
share.format.markdown.name = Markdown
share.format.markdown.what = Rich Markdown — renders on GitHub, Obsidian, Notion and most editors.
share.format.markdown.hint = **bold**  *italic*  ~~strike~~  > quote  \`code\`  [text](url)
share.format.reddit.name = Reddit
share.format.reddit.what = Reddit markdown (old & new) — like Markdown, with \`> \` quotes and [text](url) links.
share.format.reddit.hint = **bold**  *italic*  ~~strike~~  > quote  [text](url)
# The picture has no syntax to describe, so its help says what the thing IS.
share.format.image.name = Image
share.format.image.what = A picture of the quote, drawn on this device in whichever of the four skins you pick — nothing is uploaded, and the photograph of whoever said it never leaves the machine either. Tick the parts you want below, then download it or copy it straight to the clipboard.

# THE TICK LABELS under "include" — one per part of the quote the reader can
# keep or drop. They name the same columns the forms do, but they are the
# share sheet's own words: a reader deciding what to send is asking a different
# question from a reader filling a form in.
share.field.quote.label = Quote
share.field.author.label = Author
# The work, named the way its side names it: a book, a film or show.
share.field.work.book.label = Book
share.field.work.film.label = Title
share.field.published.label = Published
share.field.released.label = Released
share.field.chapter.label = Chapter
share.field.location.label = Location
# The day YOU saved the line, as against the year the work came out.
share.field.noted.label = Noted
# ⚠ Proper nouns. Do not translate.
share.field.tmdb.label = TMDB
share.field.tvdb.label = TVDB
share.field.character.label = Character
share.field.actor.label = Actor
share.field.episode.label = Episode
share.field.time.label = Time
share.field.speaker.label = Speaker
share.field.occasion.label = Occasion
share.field.when.label = When
share.field.place.label = Place
share.field.medium.label = Kind
share.field.tags.label = Tags
share.field.note.label = Note
# A proverb's English translation. Ticked by default, unlike the note: a proverb
# IS its own language plus what it says, so a share carrying only the original is
# half the quote to anybody who cannot read it.
share.field.translation.label = Translation
# A PROVERB SAYS WHAT IT IS, because nothing else on its line can. A proverb has
# no speaker, no occasion, no date and no place, so every other field on the meta
# line is empty and a shared proverb arrives as words from nowhere.
#
# \`legend\` is the WHOLE CLAUSE with a {value} hole, not a noun with the language
# glued in front of it: the article and the word order belong to the translator,
# and Bengali puts the noun last and has no "a". The hole is spelled {value}
# because that is what every phrase token on the meta line is handed — the same
# mechanism as the "played by {value}" credit — and a token written {language}
# renders the braces to the reader. \`label\` is the tick in the share dialog,
# which names the thing rather than the sentence.
share.field.proverb.label = Kind
share.field.proverb.legend = a {value} proverb

# THE CREDIT PHRASES THEMSELVES — these go into the text somebody else reads.
share.credit.chapter.phrase = Ch. {n}
# The page number. "p." is the abbreviation a printed citation uses.
share.credit.location.phrase = p.{n}
share.credit.actor.phrase = played by {value}
share.credit.tmdb.phrase = TMDB #{code}
share.credit.tvdb.phrase = TVDB #{code}
# The attribution line under the quote: an em-dash, then the credits. {value} is
# already assembled — author, title, year — in the order the fields were ticked.
share.text.attribution.phrase = — {value}
# How the plain-text format wraps the quote, since nothing renders there. Use
# whichever quotation marks your language actually uses.
share.text.quote.phrase = “{value}”

# THE PICTURE PANEL. The skin is chosen per device and is independent of the
# app's own theme.
share.image.theme.label = theme
share.image.theme.aria = Image theme
share.image.theme.info.title = Image theme
share.image.theme.info.body = The picture's look — light or dark. Choosing one here never changes the app's own theme. Starts on whatever the app is showing now.
# The two skins. One palette per mode means the mode is the only thing that
# differs in the drawing.
share.image.theme.light.label = Light
share.image.theme.dark.label = Dark
# The material the picture is made of. Independent of the mode above and of what the
# app itself is set to, so a dark Bindery card can be shared out of a light
# Manuscript app. Names come from settings.material.*.
share.image.material.label = material
share.image.material.aria = Image material
# How a credited person appears. Offered only when somebody credited has a photo.
share.image.facekind.label = face
share.image.facekind.aria = Whose picture the card draws
share.image.facekind.actor.label = Actor
share.image.facekind.character.label = Character
share.image.facekind.info.title = Face
share.image.facekind.info.body = Whose picture goes on the card: the performer, or the part they played. Offered only when the work has a saved picture for both — a character in costume is often the one the line belongs to.
share.image.portrait.label = portrait
share.image.portrait.aria = Portrait
share.image.portrait.chip.label = Chip
share.image.portrait.backdrop.label = Backdrop
share.image.portrait.info.title = Portrait
share.image.portrait.info.body = How a credited person appears. Chip is a small round photo beside their name; Backdrop bleeds the same photo in from the edge. One or the other, never both, and only when someone credited has a saved photo.
share.image.sides.label = sides
share.image.sides.aria = Which side each person takes
share.image.sides.as-credited.label = As credited
share.image.sides.swap.label = Swap
share.image.sides.info.title = Sides
share.image.sides.info.body = Which of the credited people leads. On chips the other face comes to the front; on a backdrop it swaps the edges, or reverses the row when three or more line up along the bottom.
# Whether the quote's own filing colour shows in the picture. Off by default.
share.image.colour.aria = Quote colour
share.image.colour.info.title = Quote colour
share.image.colour.info.body = Shows this quote's colour in the picture — a stripe on a plain card, the portrait's tint on a backdrop. Off by default: the colour is your own filing and means nothing to whoever you send it to.
share.image.preview.aria = Quote card image preview
share.image.share.aria = Share picture
share.image.share.tip = Share this picture
share.image.copy.label = Copy image
share.image.copy.unsupported.error = image copy isn't supported here — use Download
# Drawn in the bottom-left of the picture, before the wordmark. It is what makes
# the line a CREDIT rather than a claim on the words above it.
share.image.footer.credit.label = made with

# The two-state toggles this screen uses, and the copy button's done state.
common.toggle.on.label = On
common.toggle.off.label = Off
common.action.copy.done.label = Copied ✓
common.toast.copied = copied

error.copy.generic = could not copy
error.render.image = couldn't render the image on this device

# ---------------------------------------------------------------------------
# THE QUIZ CARD (review.jsx)
#
# One runner behind the Daily Quiz, Practice, and a themed round started from a
# work tile, a tag, a person or a colour. quiz.* is a MODE rather than a screen.
# ---------------------------------------------------------------------------

# What a card calls its own source in the question line. A standalone quote has
# no work behind it, so its source is the OCCASION it was said on.
quiz.noun.book.label = book
quiz.noun.film.label = film
quiz.noun.show.label = show
quiz.noun.occasion.label = occasion

# The prompt at the top of a card, one per question type. {kind} is a word from
# quiz.noun.* above, so in Bengali the case marker belongs on the noun, not here.
quiz.question.source.stem = Which {kind} is this quote from?
quiz.question.quote.stem = Which quote is from this {kind}?
quiz.question.cloze.stem = Fill in the blank
quiz.question.cloze-mcq.stem = Which words belong in the blank?
quiz.question.speaker.stem = Who says this?
quiz.question.author.stem = Who wrote this?
# A flip card, and any question type a newer server sends that this client has
# never heard of: both are answered the same way.
quiz.question.flip.stem = Where is this from?
# Where the card is in the round.
quiz.progress.label = {done} of {total}

# The gap the server left in a cloze quote, announced to a screen reader.
quiz.cloze.blank.aria = blank
quiz.cloze.field.label = The missing words
quiz.cloze.placeholder = type what belongs in the blank
# The same placeholder where there is a keyboard. {key} is a key cap.
quiz.cloze.placeholder-key = type what belongs in the blank · {key}
quiz.cloze.check.label = Check
# Above the right answer, once it has been checked.
quiz.cloze.answer.label = the missing words
# Under the revealed words when the attempt was a close synonym rather than the
# word itself: it counted, and it earned less. See quiz.tuning.cloze-synonym.
quiz.cloze.synonym.note = counted as a synonym — worth less than the words themselves

# Under each option of a "which quote?" card, once it has been answered: the
# work that option came out of. {title} is a book, film, show, game or occasion.
quiz.option.source.label = from {title}

# A multiple-choice option that is longer than three lines.
quiz.option.expand.aria = Expand this option
quiz.option.collapse.aria = Collapse this option
quiz.option.expand.tip = Show the whole quote

# A FLIP CARD: reveal, then say whether you had it. The reveal posts nothing —
# treating it as an answer would make self-grading a button you press to make
# the card go away.
quiz.flip.reveal.label = Show me
quiz.flip.reveal.tip = Reveal the answer
quiz.grade.forgot.label = Forgot
quiz.grade.got.label = Got it

# THE LEECH OFFER — a card forgotten over and over is costing a slot in every
# deck and giving nothing back. It is an OFFER: nothing is ever suspended
# automatically, and the card is still asked before it appears.
quiz.leech.count.label = forgotten {n} times
quiz.leech.keep.label = Keep asking
quiz.leech.aside.action.label = Set it aside
quiz.leech.aside.label = out of the quiz

# The verdict after an answer. A flip card was not right or wrong — it was
# recalled or it was not, and the READER said so, which is why it gets its own
# two words rather than the marked ones.
quiz.verdict.correct.label = correct
quiz.verdict.wrong.label = not quite
quiz.verdict.recalled.label = recalled
quiz.verdict.noted.label = noted
quiz.saving.label = saving…
quiz.next.label = Next
quiz.finish.label = Finish
# With the confirm step on: an option is chosen but nothing has been posted.
quiz.submit.hint = tap another to change
quiz.submit.label = Submit
# Practice only. It advances locally and touches neither schedule nor score.
quiz.skip.label = skip

# Fixing a quote from inside the card, after it has been answered.
quiz.card.fix.label = fix or tag this
quiz.card.tags.placeholder = comma separated
quiz.card.favourite.on.label = Favourited
quiz.card.favourite.off.label = Favourite

# A THEMED ROUND — "quiz me on this book / tag / colour / person".
# Not an error: a theme with nothing behind it is the ordinary answer for a book
# you have not quoted yet, or a colour you stopped using.
quiz.practice.empty = no quotes here to practise
quiz.practice.end.label = End round
quiz.round.score.label = {done} / {total}
quiz.round.summary.label = {got} recalled · {missed} missed
quiz.round.again.label = Another round

# The page locator on a book card. Small caps in a narrow slot.
common.locator.page.label = P. {n}
common.toast.saved = saved

# ⚠ NEAR-DUPLICATES OF error.save.generic ("could not save"). Kept apart because
# the shipped English used a contraction at these two sites and this pass is a
# migration rather than a copy edit — collapse them if the copy is ever revised.
error.save.quiz-card = couldn’t save
error.save.quiz-answer = couldn’t save — this answer won’t count towards your schedule
error.load.quiz-card = couldn’t load this quote
error.setaside.generic = couldn’t set it aside

# ---------------------------------------------------------------------------
# HOME (Home.jsx) — the daily ritual, and the two ways back into your own
# library that are neither the quiz nor a search.
# ---------------------------------------------------------------------------

# THE DAILY QUIZ CARD.
home.daily.title = Daily quiz
# {n} consecutive days with a finished deck.
home.daily.streak.label = {n}-day streak
home.daily.loading = gathering today’s cards…
# A failed fetch must NOT masquerade as "all caught up".
home.daily.error = couldn’t load today’s quiz — reload to try again
# Two different good outcomes: you finished today's deck, or there was none.
home.daily.done.label = all caught up ✓
home.daily.done.summary = {got} recalled · {missed} to resurface · back tomorrow
home.daily.empty.label = nothing due today
home.daily.empty.summary = add or review more quotes to build your schedule

# "WHERE YOU STAND" — a count per memory status, with the explainer under it.
home.states.title = where you stand
home.states.help.label = how these work
# THE EXPLAINER HAS TWO VERSIONS and the app shows whichever rule is actually in
# force: describing the ladder to somebody who switched it off would make the one
# piece of copy that explains the schedule the one piece that lies about it.
# {curve} and {spaced} are links to Wikipedia; {remembered} {forgetting} and
# {forgotten} are the three status words in bold, and they must match
# common.status.*.label, which is what the dots on every card say.
home.states.help.adaptive.prose = Each quote carries a memory “half-life” that stretches to two and a half times its length each time you recall it — up to 100 days — and is halved, not reset, when you forget: the classic {curve} behind {spaced}. A quote is {remembered} while your odds of recalling it stay high, {forgetting} as they slip, and {forgotten} once they fall past half — which is when the Daily Quiz brings it back. A quote you’ve just saved counts as remembered for its first week, then joins the rotation. Hover a quote’s dot anywhere to see its half-life.
home.states.help.ladder.prose = Each quote carries a memory “half-life” that climbs a fixed ladder — a week, then 30 and 100 days — each time you recall it, and falls straight back to a week when you forget — the classic {curve} behind {spaced}. A quote is {remembered} while your odds of recalling it stay high, {forgetting} as they slip, and {forgotten} once they fall past half — which is when the Daily Quiz brings it back. A quote you’ve just saved counts as remembered for its first week, then joins the rotation. Hover a quote’s dot anywhere to see its half-life.
# The two link texts inside those paragraphs.
home.states.help.curve.label = forgetting curve
home.states.help.spaced.label = spaced repetition
# The three status words as they read INSIDE the paragraph — lower case, bold.
home.states.help.remembered.label = remembered
home.states.help.forgetting.label = forgetting
home.states.help.forgotten.label = probably forgotten

# THE PRACTICE CARD — unlimited, skippable, and schedule-neutral by default.
home.practice.title = Practice
home.practice.info.title = Practice
home.practice.info.body = Unlimited, skippable recall practice across your whole library. It leaves your review schedule alone unless you turn that on in Settings, and its own score resets without losing any learning history.
home.practice.unlimited.label = unlimited
home.practice.start.label = Start practice
home.practice.start.busy = Loading…
# The lifetime practice score. {n} answered, {percent} of them recalled.
home.practice.score.label = {n} answered · {percent}% recalled
home.practice.reset.aria = Reset practice score
home.practice.reset.tip = Reset the practice score
home.practice.end.label = End practice
home.practice.round.summary = practice round done — {got} recalled · {missed} missed
home.practice.toast.reset = practice score cleared

# THE TWO COUNT TILES, which are DOORS: pressing one opens that screen.
home.tile.library.tip = Open the Library
home.tile.library.counts = books · {n} quotes
home.tile.movies.tip = Open the Catalogue
home.tile.movies.counts = films · {n} dialogues

# THE FAVOURITES WALL.
home.favourites.title = Favourites
# Beside the heading. The ♥ is the glyph, {n} how many are on the wall.
home.favourites.count.label = ♥ {n}
home.favourites.more.label = View more ({n})
# The small caps kind tag on a favourite tile. SMALL CAPS IN A FIXED SLOT —
# three or four characters is all that fits, and a script with no case will
# need a shorter word rather than a translated one.
common.badge.book = BOOK
common.badge.film = FILM
common.badge.show = SHOW
common.badge.game = GAME
common.badge.quote = QUOTE
# Opening the thing a favourite came from, or the screen it lives on.
home.favourites.open.book.aria = Open this book
home.favourites.open.film.aria = Open this film
home.favourites.open.show.aria = Open this show
home.favourites.open.quotes.aria = Go to your quotes
home.favourites.collapse.tip = Collapse this quote

# SERENDIPITY — one line at random, and what you saved on this date in other
# years. Neither moves a schedule.
home.shuffle.label = Shuffle
home.shuffle.tip = One line, at random
home.onthisday.title = On this day · {n}

# The edit form a favourite tile opens in place, per kind, and its delete
# confirmation.
home.favourites.edit.annotation.title = Edit quote
home.favourites.edit.dialogue.title = Edit dialogue
home.favourites.edit.quote.title = Edit quote
home.favourites.delete.annotation.confirm = Delete this annotation?
home.favourites.delete.dialogue.confirm = Delete this dialogue?
home.favourites.delete.quote.confirm = Delete this quote?

# The colour swatch row on a card.
common.colour.category.aria = Colour category

error.load.practice = add a few quotes first

# ---------------------------------------------------------------------------
# A WORK'S OWN DETAILS PANEL (WorkDetails.jsx)
#
# One panel serves a book and a Catalogue title, and it has three views: the
# fields, a lookup, and the field-by-field comparison a match is adopted
# through. The .info values are the dots beside each field.
# ---------------------------------------------------------------------------

# The three views.
common.work.details.title = Details
common.work.lookup.title = Fetch metadata
common.work.merge.title = Choose what to keep
# On the header ✓ while nothing has been edited. Five words.
common.work.details.done.tip = Save and close
common.work.fetch.label = Fetch metadata
common.work.lookup.back.aria = Back to the fields
common.work.lookup.pick.label = pick the closest match
common.work.lookup.info.title = Fetch metadata
common.work.lookup.info.body = Nothing is applied yet. Choosing a match opens a comparison of what you have against what it offers, and you tick the fields worth taking.
# {noun} is a book or a title, from unit.*.
common.work.delete.aria = Delete this {noun}

# A supplier id field: it edits like any other and reads as a link.
common.work.id.placeholder = type an id, or fetch metadata
common.work.id.open.tip = Open on {source}
# The id as it reads when it is not being edited. The arrow means "opens away".
common.work.id.display.label = #{n} ↗

# Saving. {field} is a field name, already lower-cased by the caller.
common.work.field-saved.toast = {field} saved
common.work.fields-saved.toast.one = 1 field saved
common.work.fields-saved.toast.other = {n} fields saved

# THE COMPARISON VIEW. Fields you have nothing in are pre-ticked; anything
# already filled starts unticked, so a match can never quietly overwrite you.
common.work.merge.back.aria = Back to the matches
common.work.merge.info.title = Choose what to keep
common.work.merge.info.body = Fields you have nothing in are ticked for you — filling a blank costs nothing. Anything already filled starts unticked, so a match can never quietly overwrite something you typed.
common.work.merge.all.aria = Take every field
common.work.merge.all.tip = Take everything
common.work.merge.none.aria = Take no fields
common.work.merge.none.tip = Take nothing
common.work.merge.empty = this match agrees with everything you already have — nothing to change.
common.work.merge.row.tip = Take this field
# The two columns of a comparison row: what you have, and what the match offers.
common.work.merge.yours.label = yours
common.work.merge.theirs.label = theirs
# In the "yours" column when you have nothing there. Not "0", which is what an
# unset year actually stores.
common.work.merge.blank.label = nothing yet
common.work.merge.take.one = Take {n} field
common.work.merge.take.other = Take {n} fields
common.work.merge.toast.one = {n} field updated
common.work.merge.toast.other = {n} fields updated
# The all-in option on the Catalogue side: the CAST is the reason to reach for
# it, because a search result never carries one.
common.work.resync.label = Re-sync everything
common.work.resync.busy = Re-syncing…
common.work.resync.info.title = Re-sync everything
common.work.resync.info.body = Pulls the whole record from this source — poster, cast, genres, director and details — replacing what is stored. The cast is the reason to reach for it: a search result does not carry one, so ticking fields above can never fill it.
common.work.resync.toast = re-synced from source

# THE INFO DOT ON EACH BOOK FIELD.
book.field.author.info = Multiple authors can share one line — Settings decides which separators split them into distinct people.
book.field.translator.info = Who brought it into this language. They get a portrait and a page like an author does, and they appear on this book’s own page — but never on the Library board or on a quote, where one credit is the whole point of the line.
book.field.editor.info = Who chose what is in it — the credit an anthology or a collected edition is often bought for. Same separators as the author line.
book.field.series.info = The series or franchise this book belongs to. Books group by it in the Library, and sort by the number below.
book.field.isbn.info = Ten digits or thirteen, hyphens and all — an older book’s ten-digit ISBN is kept as its thirteen-digit form. Only used to look the book up: a better cover or description comes from a match on it.
book.field.asin.info = Amazon’s own identifier, on the product page of anything you bought or read on a Kindle. A cover can be fetched from it with no key or cookie at all.
book.fetch.info.body = Searches Google Books, Open Library and Amazon for this book, then lets you compare each field against what you already have and take only what you want.

# THE INFO DOT ON EACH CATALOGUE FIELD. A Catalogue row is a film, a show or a
# game, and the words change with the MEDIUM rather than with the screen.
film.field.media-type.info = A show’s dialogue carries a season and episode; a film’s and a game’s do not. Changing this does not move any lines you have already saved.
film.field.publisher.info = Who put the game out, as against the studio above, who made it — usually two different companies. A fetch once collapsed the two, so a game added before 1.17.0 may credit its publisher as its studio; re-fetching separates them.
film.field.series.info = The franchise this title belongs to — the film side of a book’s series.
film.field.tmdb-id.label = TMDB id
film.field.tmdb-id.info = The Movie Database’s id for this title — the number in its URL. Picking a match under “Fetch metadata” sets it, or type it in: a title search cannot tell two films of one name apart and an id can. Empty the field to clear it.
film.field.tvdb-id.label = TheTVDB id
film.field.tvdb-id.info = TheTVDB’s id, typed or fetched the same way. Optional — it usually has better coverage for long-running shows, so it is worth filling in when TMDB has a show only half-catalogued.
film.field.imdb-id.label = IMDb id
film.field.imdb-id.info = IMDb’s id for this title — the ttNNNNNNN in its URL. Nothing is fetched with it: IMDb has no public API, so this id is only ever carried, never used. It is here because it is the one most people have to hand, and it names one title exactly.
film.field.igdb-id.label = IGDB id
film.field.igdb-id.info = IGDB’s id for this game — the database the games lookup runs on. Picking a match under “Fetch metadata” sets it, or type it in: two games can share a title and an id cannot. Empty the field to clear it.
film.fetch.info.body = Searches TMDB and TheTVDB, then compares each field with what you have. From there you can take single fields, or re-sync everything — poster, cast, genres and details — from that source.

# THE THREE THINGS A CATALOGUE ROW CAN BE. One list, so the display and the
# picker cannot offer different sets. "movie" is the stored token; the WORD is
# Film, because that is what a reader calls it.
vocab.kind.movie.label = Film
vocab.quote-kind.unset.label = (not set)
vocab.quote-kind.speech.label = Speech
vocab.quote-kind.letter.label = Letter
vocab.quote-kind.essay.label = Essay
vocab.quote-kind.proverb.label = Proverb
vocab.quote-kind.other.label = Other
vocab.kind.show.label = Show
vocab.kind.game.label = Game

# The suppliers a work can be looked up on. ⚠ PROPER NOUNS — do not translate.
vocab.source.imdb.label = IMDb
vocab.source.igdb.label = IGDB

# Field labels this panel needs that no other screen names. A show has a
# CREATOR where a film has a director; a game has a STUDIO, and its franchise is
# a series where a film's is a collection.
common.field.publisher.label = Publisher
common.field.collection.label = Collection
common.field.collection-no.label = Collection #
common.field.cover.label = Cover
common.field.poster.label = Poster

error.sync.source = could not sync from the source
error.validate.title-required = a title is required

# ---------------------------------------------------------------------------
# THE ＋ SURFACE (AddSurface.jsx) — the one way into the library.
#
# Three tabs: look one up, capture a quote, import a file. capture.* is the
# screen key the route already uses for it.
# ---------------------------------------------------------------------------

# The ＋ surface's own title, per tab.
capture.title.add = Add
capture.title.quote = Capture
capture.title.import = Import
capture.dialog.aria = Add to your library
capture.tabs.aria = Add, capture or import
# The three tabs. The SHORT set is what fits a phone's three-segment slider —
# keep those to one word.
capture.tab.add.label = Look up / add
capture.tab.quote.label = Capture quote
capture.tab.import.label = Import files
capture.tab.add.short.label = Add
capture.tab.quote.short.label = Capture
capture.tab.import.short.label = Import
# On the ✓ when a must-fill field is empty and nothing more specific applies.
capture.save.blocked.tip = Fill the required fields
capture.close.tip = Close without saving

# THE FOUR KINDS the ＋ can add. A book goes to the Library; a film, a show and
# a game all go to the Catalogue.
vocab.kind.book.label = Book
capture.lookup.kind.aria = What to add
# The search box, worded for whichever kind is chosen.
capture.lookup.book.placeholder = ISBN or title
capture.lookup.film.placeholder = Film title
capture.lookup.show.placeholder = Show title
capture.lookup.game.placeholder = Game title
capture.lookup.year.placeholder = Year
capture.lookup.year.aria = Year (optional)
capture.lookup.search.label = Search
capture.lookup.search.busy = Searching…
capture.lookup.empty = no matches found
# Where a group of printings disagree on everything but the title.
capture.lookup.edition.none.label = no edition details
# ⚠ NAMES A SUPPLIER AND A SETTING. A game still searches WITHOUT a key — this
# says what you are getting rather than that the lookup is off.
capture.lookup.nokey.game = no IGDB key — searching Wikidata instead, which rarely has cover art. A Twitch client id and secret in Settings gets the full record; “Add manually” always works.
capture.lookup.nokey.film = no movie-lookup key configured — “Add manually” below always works.
# The two doors to hand entry: a real button once the lookup has let you down,
# and a link that is always there.
capture.lookup.manual.button.label = ＋ Add manually instead
capture.lookup.manual.link.label = ＋ Skip the lookup — add manually
# The hand-entry popup, per kind.
capture.manual.book.title = Add a book manually
capture.manual.film.title = Add a film manually
capture.manual.show.title = Add a show manually
capture.manual.game.title = Add a game manually

# THE WORK PICKER — type to filter every book and title in the library. The
# last row quick-creates the work from whatever you typed.
capture.picker.placeholder = search your books, films & shows…
capture.picker.change.label = change
# {title} is what you typed, in quotes. The second form is for an empty box.
capture.picker.create.label = ＋ Add {title} — book, film or show
capture.picker.create.blank.label = ＋ Add a new work — book, film or show

# THE CAPTURE FORM.
# The label above the work picker, and the chip that turns the picker off.
capture.form.target.label = Book · Film · Show
capture.form.standalone.label = From somewhere else
capture.form.standalone.chip.label = no book or film
capture.form.create.label = Add a new book, film or show
capture.form.create.cancel.label = cancel
capture.form.quote.placeholder = the line worth keeping…
capture.form.note.placeholder = your margin note (renders handwritten)
capture.form.timestamp.placeholder = e.g. 01:12:40
capture.form.season.placeholder = e.g. 2
capture.form.episode.placeholder = e.g. 5
capture.form.chapter-no.placeholder = e.g. 7
capture.form.chapter-name.placeholder = optional
capture.form.location.placeholder = e.g. 142
# This field takes NAMES SEPARATED BY COMMAS rather than one tag at a time.
capture.form.tags.label = Tags · comma separated
capture.form.tags.placeholder = memory, craft
# Under the fields when Save is greyed: {reason} is one of the must-fill
# messages below, and this sentence completes it.
capture.form.missing.hint = {reason} to save.

# One toast per kind of capture, because which one landed is worth knowing.
capture.toast.annotation = annotation captured
capture.toast.dialogue = dialogue captured
capture.toast.quote = quote captured

# An import already waiting, shown on the Import tab.
capture.import.pending.one = {n} staged quote waiting — review the queue
capture.import.pending.other = {n} staged quotes waiting — review the queue


# What must be filled before a capture can save. Each doubles as the tooltip on
# the greyed ✓, so each has to make sense on its own.
error.validate.quote-words = A quote needs the words themselves
error.validate.line-words = A line needs the words themselves
error.validate.quote-or-note = Write a quote or a note
error.validate.target-required = Pick a book, film or show
error.validate.season-required = An episode needs its season

error.lookup.failed = lookup failed
error.add.book = could not add book
error.add.title = could not add title
error.enrich.title = could not enrich that title

# Placeholders shared with the Quotes screen's own form.
common.field.speaker.placeholder = who said it
common.field.character.placeholder = who says it

# ---------------------------------------------------------------------------
# STATS (StatsPage.jsx)
#
# EVERYTHING NAMED ON THIS SCREEN IS A DOORWAY, not a read-out: a calendar dot,
# a breakdown row, a superlative tile and a top tag all click through to Search.
# ---------------------------------------------------------------------------

# Under the page title: how many quotes of all three kinds are kept.
stats.header.counts = {n} saved

# The overview tiles. "Annotations" is what the API, the database and the README
# call a book highlight; "Quotes" here is the standalone kind, the same thing the
# Quotes tab means. Naming them the same would count two different things.
stats.overview.books.label = Books
stats.overview.annotations.label = Annotations
stats.overview.movies.label = Films
stats.overview.dialogues.label = Dialogues
stats.overview.quotes.label = Quotes
stats.overview.genres.label = Genres
stats.overview.tags.label = Tags
stats.overview.favourites.label = Favourites

# THE ACTIVITY CALENDAR. Three streams over one heatmap.
# {n} is the total for the stream, {noun} the stream's own verb below.
stats.activity.title = Activity · {n} {noun}
stats.activity.stream.aria = Activity stream
stats.activity.saves.label = Saves
stats.activity.saves.noun = saved
stats.activity.saves.empty = nothing saved yet
stats.activity.quiz.label = Quiz
stats.activity.quiz.noun = reviewed
stats.activity.quiz.empty = no quiz answers yet
stats.activity.practice.label = Practice
stats.activity.practice.noun = practised
# Practice is the one stream a reader can empty on purpose, so its empty state
# has to read as the reset having worked rather than as a chart that failed.
stats.activity.practice.empty = no practice history
stats.activity.practice.reset.label = reset practice
# What one day says on hover. {date} is already formatted by the device.
stats.activity.day.saves.tip = {date}: {n} {noun}
# The two review streams count ANSWERS, where the tally alone is the less
# interesting half — so they report the ratio too.
stats.activity.day.none.tip = {date}: no answers
stats.activity.day.answers.one = {n} answer
stats.activity.day.answers.other = {n} answers
stats.activity.day.tally.tip = {date}: {answers}
stats.activity.day.accuracy.tip = {date}: {answers} · {percent}% correct
# Appended to a day that is a doorway into Search.
stats.activity.day.search.tip = {label} — view in search
# The heatmap legend, least to most.
stats.activity.legend.less.label = less
stats.activity.legend.more.label = more

# WHERE THE WHOLE LIBRARY STANDS ON THE FORGETTING CURVE.
stats.memory.title = Memory
stats.memory.rotation.label = {done} of {total} in rotation
stats.memory.half-life.label = Avg half-life
stats.memory.streak.label = longest streak
# {n} is a number of days; the tile prints it big, so this is the unit beside it.
stats.memory.streak.value = {n}d
stats.memory.streak.current = {n} now

# THE PER-KIND RECALL BREAKDOWN. A dropdown picks the dimension.
stats.breakdown.title = Breakdown · {n}
stats.breakdown.kind.aria = Breakdown kind
stats.breakdown.authors.label = Authors
stats.breakdown.books.label = Books
stats.breakdown.series.label = Series
stats.breakdown.films.label = Films
stats.breakdown.shows.label = Shows
stats.breakdown.directors.label = Directors
stats.breakdown.actors.label = Actors
# Beside Actors, never instead of it: one actor plays several characters, one
# character is played by several actors, and a book has characters and no actors.
stats.breakdown.characters.label = Characters
stats.breakdown.speakers.label = Speakers
stats.breakdown.people.label = People
# The headline above the rows. {name} is a person, a title or a series.
stats.breakdown.best.label = best remembered: {name} · {n}
stats.breakdown.worst.label = most forgotten: {name} · {n}
# How many WORKS an entity spans — an author's books, a series' volumes.
stats.breakdown.works.one = {n} work
stats.breakdown.works.other = {n} works
# One status and its count, spelled out under the bar. Never colour alone.
stats.breakdown.status.label = {n} {name}
stats.breakdown.name.tip = Search for this name

# THE COLOUR CATEGORIES — the fourth theme, and the only one with no page of its
# own, which is why "quiz me on the ones I marked Disagreed" lives here.
stats.colours.title = Colour categories
stats.colours.counts.label = {n} quotes
stats.colours.empty = no highlights yet
# One magnitude row. {name} is the category as the READER named it.
stats.bar.tip = {name}: {n}
stats.bar.practise.aria = Practise {name}
stats.bar.practise.tip = Quiz me on {name}

# Top tags, and what any ranked list says when it holds nothing.
stats.top-tags.title = Top tags
stats.list.empty = nothing yet
stats.tag.tip = Search for this tag

# THE TIMELINE — when the works you quote were written, and the gaps between.
stats.timeline.title = Timeline
stats.timeline.counts.title = Timeline · {n}
stats.timeline.scale.aria = Timeline scale
stats.timeline.decade.label = Decades
stats.timeline.century.label = Centuries
stats.timeline.year.label = Years
# One column on hover: how many works, and how many quotes out of them.
stats.timeline.column.tip = {label}: {a} works, {b} quotes
# A stretch with nothing in it, {a} to {b}.
stats.timeline.gap.aria = {a} to {b}: nothing
stats.timeline.gap.tick.label = {a}–{b}
stats.timeline.key.quotes.label = quotes
stats.timeline.key.works.label = works

# A YEAR AND A DECADE, WRITTEN THE WAY THEY ARE SAID. The "s" on a decade is an
# English plural and a BCE decade is named by the START of it as spoken — the
# 480s BCE runs from 489 to 480. These sit in narrow ticks under a chart.
common.year.decade.label = {year}s
common.year.decade.bce.label = {year}s BCE

# THE GAP LINES. Four bands by width, four lines in each, drawn WITHOUT
# REPLACEMENT so a band is exhausted before anything repeats. THEY ARE A VOICE
# RATHER THAN A MESSAGE: dry, lower case, no full stop capital, and they are
# about the reading rather than about history. Write your own; do not translate
# these literally. Band 1 is the narrowest gap and has the least room.
stats.timeline.gap.1.1 = a long quiet.
stats.timeline.gap.1.2 = nothing quoted here.
stats.timeline.gap.1.3 = the shelf skips this.
stats.timeline.gap.1.4 = no lines from in here.
stats.timeline.gap.2.1 = plenty was written. none of it is here.
stats.timeline.gap.2.2 = a gap this wide is not history’s fault.
stats.timeline.gap.2.3 = centuries pass. the shelf does not notice.
stats.timeline.gap.2.4 = the years go by. the shelf has nothing to say.
stats.timeline.gap.3.1 = history happened. you were reading something else.
stats.timeline.gap.3.2 = somebody was writing through all of this. you kept none of it.
stats.timeline.gap.3.3 = a stretch with no quotes in it is still a stretch you lived past.
stats.timeline.gap.3.4 = the era had its arguments. none of them are on this shelf.
stats.timeline.gap.4.1 = no quotes, no covers, no year worth marking — which says more about the reading than about the era.
stats.timeline.gap.4.2 = the width of this gap is measured in centuries. the reason for it is measured in evenings.
stats.timeline.gap.4.3 = every year in here had its writers, its arguments and its best sentence. your copy of that sentence is missing.
stats.timeline.gap.4.4 = this stretch is not empty because nothing was written in it. it is empty because you have not got round to any of it yet.

# THE SUPERLATIVES — one row of tiles, each a doorway.
stats.super.title = Superlatives
stats.super.most-annotated.label = Most annotated book
stats.super.most-quoted-work.label = Most quoted film/show
stats.super.most-quoted-person.label = Most quoted person
stats.super.most-favourited-person.label = Most favourited person
stats.super.most-quoted-decade.label = Most quoted decade
stats.super.busiest-month.label = Busiest month
stats.super.best-remembered.label = Best remembered
stats.super.most-forgotten.label = Most forgotten
stats.super.since.label = Collecting since
# The small line under a superlative tile.
stats.super.quotes.label = {n} quotes
stats.super.saved.label = {n} saved
stats.super.of.label = {done} of {total}
stats.super.title.tip = Search for this title
# "Month YYYY" — the month a busiest-month tile names.
stats.month.label = {name} {n}
# The twelve months, spelled out. Only used for that tile and the calendar's
# x axis, which shows the FIRST THREE LETTERS of whatever is written here.
vocab.month.1.label = January
vocab.month.2.label = February
vocab.month.3.label = March
vocab.month.4.label = April
vocab.month.5.label = May
vocab.month.6.label = June
vocab.month.7.label = July
vocab.month.8.label = August
vocab.month.9.label = September
vocab.month.10.label = October
vocab.month.11.label = November
vocab.month.12.label = December

stats.toast.practice-reset = practice history cleared
error.reset.practice = could not reset practice

# ---------------------------------------------------------------------------
# SEARCH (SearchPage.jsx)
#
# Results come back FACETED BY WHAT MATCHED and render as one section per
# facet. Every section heading is "<name> · <count>", which is one key with two
# holes so another language can punctuate it its own way.
# ---------------------------------------------------------------------------

# The box itself. Note that tag: author: colour: are GRAMMAR, not copy — the box
# parses them, so they stay as they are in the placeholder too.
search.box.placeholder = Search, or type tag: author: colour:…
search.box.aria = Search
# The dropdown's "show me another five" row.
search.box.more.label = More ({n})
# A facet already applied, as a removable pill.
search.chip.remove.tip = Remove {field}
search.chip.remove.aria = Remove {name}

# WHAT to search. "All" is everything; the rest narrow to one kind.
search.scope.all.label = All
search.scope.all.tip = Search everything
search.scope.books.label = Books
search.scope.annotations.label = Annotations
search.scope.movies.label = Movies
search.scope.dialogues.label = Dialogues
search.scope.quotes.label = Quotes
# {name} is the scope, already lower-cased.
search.scope.only.tip = Search {name} only

# The filter sheet.
search.filters.label = Filters
search.filters.count.label = Filters · {n}
search.filters.tip = Narrow by tag, author, character…
search.filters.title = Narrow the search
# Above the facet groups. tag: author: character: are the typed grammar.
search.filters.type.hint = Or type them: {em1} {em2} {em3} in the box.
# HOW TWO VALUES OF ONE FIELD COMBINE, written down rather than discovered: two
# tags narrow, two authors widen, and a yes/no field can only be one or the other.
search.filters.combine.and = all of them
search.filters.combine.or = any of them
search.filters.combine.exclusive = one or the other
search.filters.narrow.placeholder = filter {field}…
search.filters.narrow.aria = Filter {field}
# On a value with no hits under the current search. Greyed, not hidden, and
# still pressable: a value that disappears leaves you doubting your own library.
search.filters.dead.tip = No hits under the current search
search.filters.clear.label = Clear all

# The two empty states, which are different questions. The first is "you have
# not typed anything"; the second is "there is nothing there".
search.results.empty.prompt = type to search your books, annotations, movies, and dialogues
# {query} names the WHOLE question — the words AND the chips — because with
# filters up, "no results for “”" would be reporting an empty search.
search.results.none = no results for “{query}”
search.results.none.scope = no results for “{query}” in {name}
search.results.clear.label = Clear search
search.results.drop-filters.label = Drop the filters
search.results.everything.label = Search everything
# The server ran a fuzzy pass because the exact query had no hits at all.
search.results.corrected = no exact matches — showing results for “{query}”

# THE SECTION HEADINGS. {name} is the section, {n} its hit count.
search.section.heading = {name} · {n}
search.section.books.title = Books
search.section.movies.title = Movies
search.section.annotations.title = Annotations
search.section.dialogues.title = Dialogues
search.section.quotes.title = Quotes
search.section.authors.title = Authors
search.section.directors.title = Directors
search.section.actors.title = Actors
search.section.characters.title = Characters
search.section.speakers.title = Speakers
search.section.notes.title = Notes
search.section.tags.title = Tags
search.section.genres.title = Genres
# A decade section names the decade as well as the count.
search.section.decade.title = Decade · {name} · {n}
# Everything added on one day — the Stats calendar's dot target. {date} is
# already formatted by the device.
search.section.date.title = Added on {date} · {n}
# A character chip: pressing it narrows the search to everything they say.
search.character.all.tip = Everything {name} says

# Group the results, the same five dimensions the Library offers.
search.group.none.label = None
search.group.series.label = Series
search.group.author.label = Author
search.group.decade.label = Decade
search.group.genre.label = Genre
# The catch-all group heading where the credit is missing.
search.group.residual.author.label = Unknown author
search.group.residual.director.label = Unknown director

# THE TABLE VIEW. Every column head names a stored field.
search.table.select-all.tip = Select every row
search.table.select-all.aria = Select all
search.table.select-row.tip = Select this row
search.table.select-row.aria = Select row

# The table's inline bulk editor.
search.bulk.author.placeholder = set author
search.bulk.director.placeholder = set director
search.bulk.series.placeholder = set series
search.bulk.tags.placeholder = add tags (comma-separated)
search.bulk.genres.placeholder = add genres (comma-separated)
search.bulk.tags.blocked.tip = Type at least one tag
search.bulk.fields.blocked.tip = Set a field first

# One search hit opened in place.
search.hit.title.fallback = Quote
search.hit.open.book.label = Open book
search.hit.open.film.label = Open film
search.hit.gone = this quote no longer exists
search.hit.work.tip = Open this work
search.hit.work.aria = Open {title}


error.search.failed = search failed
error.bulk.failed = bulk action failed
error.validate.tag-required = type at least one tag
error.validate.field-required = set a field first

# ---------------------------------------------------------------------------
# THE LIBRARY (Library.jsx) — books, and every highlight kept from them.
#
# book.* is the book's own page; library.* is the board of them.
# ---------------------------------------------------------------------------

# The board.
library.header.counts = {a} · {b}
# Beside the title on a wide screen: what a lookup here takes. The Catalogue's
# equivalent is movies.header.lookup.label, and the two are separate keys because
# the two searches take different things.
library.header.lookup.label = lookup: ISBN or title
library.board.empty = no books yet — the ＋ in the top bar adds one, or imports a file of highlights
library.board.nomatch = no books match these filters
# The chip that folds every unquoted book into one tile.
library.filters.fold-wishlist.label = Fold wishlist
library.filters.fold-wishlist.tip = Fold the unquoted into one tile
# The catch-all group heading where a book has no author recorded.
library.group.residual.author.label = Unknown author

# Sort, and group.
library.sort.recent.label = Recent
library.sort.title.label = Title
library.sort.author.label = Author
library.sort.series.label = Series
library.sort.read.label = Last read
# "Books" here means UNGROUPED — one board of them.
library.group.none.label = Books
library.group.series.label = Series
library.group.author.label = Author
library.group.decade.label = Decade
library.group.genre.label = Genre

# Exporting the board.
library.export.confirm.title = Export library
library.export.confirm.body = {a} · {b} in view will be exported as one Markdown file per book, in a single download (re-importable into Tippani).

# A BOOK'S OWN PAGE.
book.title.fallback = Untitled
book.filter.aria = Filter annotations
book.capture.aria = Capture a quote
book.export.label = Export .md
book.export.aria = Export as Markdown
book.export.tip = Export as Markdown
book.practise.aria = Practise this book
book.practise.menu.label = Practise this book
book.practise.tip = Quiz me on this book
book.details.tip = Details and metadata
book.delete.aria = Delete this book
book.delete.tip = Delete this book
book.toast.deleted = book deleted
# The role labels beside a second or third credit on a book's page. An
# UNLABELLED name reads as the author, so these two are always labelled.
book.credit.translator.label = tr.
book.credit.editor.label = ed.
# The date-confirm dialog's own word for what just happened to the shelf.
book.shelf.started.label = Started
book.shelf.abandoned.label = Gave up
book.shelf.finished.label = Finished
book.shelf.cap.past.label = Mark as read

# The hand-entry and edit forms for a book.
book.form.edit.title = Edit book
# Under the form when the ✓ in the header is greyed. A disabled icon cannot say
# why, so this line does. Its twin on the film form is film.form.missing.hint: one
# sentence per form, because the word for "title" is not the same in both.
book.form.missing.hint = A title is required to save.
book.form.translator.placeholder = whose English this is
book.form.editor.placeholder = who chose what is in it
book.form.series.placeholder = e.g. Discworld
book.form.series-no.placeholder = e.g. 5

# ONE HIGHLIGHT, as a card. This card is drawn on four screens, so common.*.
common.quote.edit.title = Edit quote
common.quote.pick.label = this quote
# The chapter and page locator under a highlight. ⚠ "CH." here is spelled the
# same way the Markdown export writes a chapter heading and the importer reads
# it back — see text.js. Changing it breaks the round trip.
common.locator.chapter.label = CH. {name}
common.locator.page.short.label = P.{n}

# THE HIGHLIGHTS TABLE on a book's page.
book.table.quote.label = Quote
book.table.chapter.label = Chapter
book.table.location.label = Location
book.table.date.label = Date
# The favourite column, a bare heart.
book.table.favourite.label = ♥
book.table.sort.tip = Sort by this column

# The highlights board on a book's page.
book.quotes.counts.shown = {a} · {n} shown
book.quotes.filter.title = Filter annotations
book.quotes.filter.label = filter
book.quotes.capture.label = ＋ Capture a quote
book.quotes.empty = no annotations yet — the ＋ in the bar above captures your first
book.quotes.nomatch = no annotations match the filters
book.quotes.delete.confirm = Delete this annotation?

# The highlight form.
book.quote.form.character.placeholder = who says it, if anybody
book.quote.form.chapter-no.placeholder = e.g. 7
book.quote.form.location.placeholder = e.g. 1042

error.validate.title-required.lower = title is required
error.validate.year = year must be a year
error.save.annotation = could not save annotation

# ---------------------------------------------------------------------------
# THE CATALOGUE (Movies.jsx) — films, shows and games, and their dialogue.
#
# All three are one kind of row split by media_type, so most words here have to
# work for all three. film.* is a title's own page; movies.* is the board.
# ---------------------------------------------------------------------------

# The board. ⚠ The page title says "Movies & Shows" and predates games.
movies.header.title = Movies & Shows
movies.header.counts = {a} · {b}
# Beside the title on a wide screen: whether a lookup is even possible.
movies.header.nokey.label = no TMDB key — manual entry
movies.header.lookup.label = lookup: title + year
movies.board.empty = No titles yet — look one up on TMDB/TVDB or add it manually.
movies.board.nomatch = no titles match these filters
movies.group.residual.director.label = Unknown director

# The media-type filter above the board. Only offered for the kinds you have.
movies.filters.media.all.label = All
movies.filters.media.movie.label = Movies
movies.filters.media.show.label = Shows
movies.filters.media.game.label = Games

# Sort, and group. "Titles" means UNGROUPED; a film's franchise is a COLLECTION
# where a book's is a series.
movies.sort.recent.label = Recent
movies.sort.title.label = Title
movies.sort.year.label = Year
movies.sort.series.label = Collection
movies.sort.read.label = Last watched
movies.group.none.label = Titles
movies.group.series.label = Collection
movies.group.author.label = Director
movies.group.decade.label = Decade
movies.group.genre.label = Genre

# Exporting the board. Counted PER MEDIUM, because a game tallied as a movie is
# a dialog that lies about what it is going to write.
movies.export.confirm.title = Export catalogue
movies.export.confirm.body = {a} in view will be exported as a single Markdown file.
movies.export.count.none = 0 titles
movies.export.count.movies.one = {n} movie
movies.export.count.movies.other = {n} movies
movies.export.count.shows.one = {n} show
movies.export.count.shows.other = {n} shows
movies.export.count.games.one = {n} game
movies.export.count.games.other = {n} games

# The poster, full screen.
movies.poster.fullscreen.aria = View poster of {title} full screen
movies.poster.fullscreen.plain.aria = View poster full screen

# A LOOKUP THAT FOUND SOMETHING YOU ALREADY HAVE. The two ways out are named
# rather than implied: fill the gaps in what you have, or keep them apart.
movies.duplicate.dialogues.one = {n} dialogue
movies.duplicate.dialogues.other = {n} dialogues
movies.duplicate.poster.yes = has poster
movies.duplicate.poster.no = no poster
movies.duplicate.enrich.label = Enrich this
movies.duplicate.separate.label = Add as a separate title

# The hand-entry and edit forms for a Catalogue title.
film.form.edit.title = Edit title
film.form.title.placeholder = Title (required)
film.form.publisher.placeholder = Publisher
film.form.year.placeholder = Year
film.form.series.placeholder = Collection / franchise
film.form.series-no.placeholder = Collection #
film.form.description.placeholder = Description
film.form.tmdb-id.placeholder = TMDB id
film.form.tvdb-id.placeholder = TheTVDB id
# Under the form when the ✓ in the header is greyed. A disabled icon cannot say
# why, so this line does.
film.form.missing.hint = A title is required to save.
# Above the picker the re-sync opens, saying what picking a row will overwrite.
film.resync.pick.label = Pick the right title — replaces details, cast & poster
# The Movie | Show | Game switch. ⚠ "Movie" here, not "Film" — it is the word
# this one control has always used.
film.form.media.aria = Media type
film.form.media.movie.label = Movie

# A TITLE'S OWN PAGE.
film.title.fallback = Untitled
film.filter.aria = Filter dialogues
film.capture.aria = Capture a line
film.export.label = Export .md
film.export.aria = Export as Markdown
film.export.tip = Export as Markdown
film.practise.aria = Practise this title
film.practise.menu.label = Practise this title
film.practise.tip = Quiz me on this title
film.details.tip = Details and metadata
film.delete.aria = Delete this title
film.delete.tip = Delete this title
film.toast.deleted = title deleted
# The mono credit line under a title. ⚠ SMALL CAPS IN A NARROW SLOT.
film.credit.publisher.label = PUB. {name}
film.credit.actor.label = PLAYED BY
# The date-confirm dialog's word for what just happened to the shelf.
film.shelf.started.label = Started
film.shelf.abandoned.label = Gave up
film.shelf.finished.label = Finished
film.shelf.cap.past.label = Mark as watched

# The dialogue board on a title's page.
film.lines.filter.title = Filter dialogues
film.lines.filter.placeholder = character or tag…
film.lines.filter.tag.all.label = All tags
film.lines.capture.label = ＋ Capture a line
film.lines.empty = No dialogues yet — the ＋ in the bar above captures the first line.
film.lines.nomatch = No dialogues match the filters.
film.lines.delete.confirm = Delete this dialogue?

# THE DIALOGUE TABLE.
film.table.quote.label = Quote
film.table.character.label = Character
film.table.episode.label = Episode
film.table.time.label = Time
film.table.favourite.label = ♥

# ONE FILM LINE, as a card. Drawn on four screens, so common.*.
common.dialogue.edit.title = Edit dialogue
common.dialogue.pick.label = this line

# The dialogue form.
film.line.form.quote.placeholder = Quote (required)
film.line.form.characters.placeholder = add a character… (picks from the cast)
film.line.form.characters.aria = Characters
film.line.form.season.placeholder = Season
film.line.form.season.tip = Season (blank if unknown)
film.line.form.episode.placeholder = Episode
film.line.form.episode.tip = Episode (needs a season)
# HH:MM:SS is a time format rather than words — keep the shape.
film.line.form.timestamp.placeholder = HH:MM:SS
film.line.form.timestamp.tip = Timestamp

error.validate.line-required = The line itself is required
error.save.dialogue = could not save dialogue

# The countable nouns the Catalogue counts in.
unit.line.one = line
unit.line.other = lines


# ---------------------------------------------------------------------------
# ONE MORE COUNTABLE NOUN, for the Catalogue's franchise filter.
# ---------------------------------------------------------------------------
unit.collection.one = collection
unit.collection.other = collections

# One more countable noun, for the studio whose credits are games.
unit.game.one = game
unit.game.other = games

# ---------------------------------------------------------------------------
# THE BIN — BinPage.jsx. The one screen you open because you have already lost
# something, and the only one with a single door: the tile in Settings. That is
# why the way back is NAMED rather than drawn as a bare arrow.
# ---------------------------------------------------------------------------
bin.back.tip = Back to Settings
bin.title = The bin
# What a row calls each kind, and what the chip above the list calls a pile of
# them. ONE TABLE, TWO ROLES — a row is always singular and a chip always plural
# — so these are two keys each rather than a .one/.other family, which would
# need a count neither site has. “Film or show” is one label over two media
# because the API stores 'movie' for both and no unit.* noun spans them.
bin.kind.book.label = Book
bin.kind.book.plural = Books
bin.kind.movie.label = Film or show
bin.kind.movie.plural = Films & shows
bin.kind.annotation.label = Highlight
bin.kind.annotation.plural = Highlights
bin.kind.dialogue.label = Film line
bin.kind.dialogue.plural = Film lines
bin.kind.quote.label = Quote
bin.kind.quote.plural = Quotes
bin.kind.account.label = Account
bin.kind.account.plural = Accounts
# The retention control. The three windows are counted with the shared day
# format, so only “never” needs a word of its own.
bin.keep-for.label = keep for
bin.retention.aria = How long the bin keeps things
bin.retention.never.label = Never
bin.info.title = The bin
bin.info.body = Everything you delete waits here first, and putting one back returns it exactly as it was — quotes, tags, colours, schedule and cover alike. “Empty now” is for when you wanted something gone today.
bin.empty-now.label = Empty now
# The kind filter, which appears only once there is more than one kind to tell
# apart. {kind} is a plural from the table above, lower-cased by the caller.
bin.filter.all.label = All
bin.filter.only.tip = Show {kind} only
bin.state.loading = reading the bin…
bin.state.empty = nothing deleted — anything you delete waits here first
bin.state.empty-kind = nothing of that kind in the bin
# A row. {label} is what the thing was called; the two fallbacks below stand in
# when it had no name a reader would recognise.
bin.row.untitled.label = untitled
bin.row.expand.aria = What is inside {label}
bin.row.expand.fallback = this entry
bin.row.this.label = this
bin.row.restore.aria = Restore {label}
bin.row.restore.tip = Put this back
bin.row.purge.aria = Remove {label} for good
bin.row.purge.tip = Remove for good
# When it went. The year is left out when it is this one — a column of “deleted
# 1 Aug 2026” on a bin you emptied last week is noise.
bin.row.deleted.label = deleted {when}
# The pictures that went down with it and are still held. No number: the row
# says whether any survived, not how many.
bin.row.pictures.one = picture kept
bin.row.pictures.other = pictures kept
# When it is due to go for good. A DATE, NOT A COUNTDOWN: the purge clock runs
# on server time and only while the server is up, so “gone in 3 days” is a
# promise nothing here can keep.
bin.row.expiry.due = due to go {date}
bin.row.expiry.never = kept until you empty the bin
bin.row.contents.empty = no quotes inside
# Beside the page title: how many entries, and how many quotes went with them.
bin.counts.held = {n} {noun} held
bin.confirm.title = Empty the bin?
bin.confirm.body = This removes {count} and the pictures they were holding. There is no undo for this one.
bin.confirm.label = Empty it
bin.toast.gone.label = gone
bin.toast.emptied.label = bin emptied
error.restore.generic = could not restore
error.remove.generic = could not remove
error.empty.bin = could not empty

# ---------------------------------------------------------------------------
# STRAY MARKS — CleanupPage.jsx. What a quote picked up on its way in: the
# footnote number that came with the selection, the dictionary's pronunciation
# gloss, the double space a justified line left behind. The page LISTS and never
# fixes — see internal/httpapi/cleanup.go for why — so every string here is
# descriptive rather than an instruction, and there is no "fix all" to name.
# ---------------------------------------------------------------------------
cleanup.back.tip = Back to Settings
cleanup.title = Stray marks
# Beside the title: how many quotes were read, so “nothing found” is
# distinguishable from “nothing looked at”.
cleanup.counts.scanned = {n} {noun} read
cleanup.info.title = Stray marks
cleanup.info.body = A quote pasted from a page brings the page's furniture with it, and none of it shows in a card. This finds it and changes nothing — every rule below has a false positive that is somebody's real writing, so each one is yours to decide.
cleanup.state.loading = reading every quote…
cleanup.state.clean = nothing to look at — every quote reads as it was written
cleanup.state.clean-rule = nothing of that kind found
# When the cap was reached. A silently shortened list is indistinguishable from a
# clean library, so the page says it out loud.
cleanup.state.truncated = the first {count} — clear some and look again for the rest
# THE RULES, one label and one line each. The label names what was found, never
# what to do about it: nothing here fixes anything.
cleanup.rule.invisible.label = Invisible characters
cleanup.rule.invisible.body = A space or hyphen you cannot see — from HTML, a justified PDF, or a word broken across two lines.
cleanup.rule.edge-space.label = Space at the ends
cleanup.rule.edge-space.body = The quote begins or ends with a space, which a card hides and a search does not.
cleanup.rule.double-space.label = Double spaces
cleanup.rule.double-space.body = Two or more spaces in a row, left behind by justified text — or typed on purpose after a full stop.
cleanup.rule.space-before-punctuation.label = Space before punctuation
cleanup.rule.space-before-punctuation.body = A space before a comma, full stop or bracket. French does this deliberately.
cleanup.rule.reference-mark.label = Footnote numbers
cleanup.rule.reference-mark.body = A reference index the page left behind — a superscript, a number in brackets, or a digit welded to the last word.
cleanup.rule.pronunciation.label = Pronunciation glosses
cleanup.rule.pronunciation.body = A dictionary's guide to saying the word, carried in with the headword.
cleanup.rule.hyphen-break.label = Hyphen from a line break
cleanup.rule.hyphen-break.body = A word split across two lines and rejoined with the hyphen still in it.
cleanup.rule.repeated-punctuation.label = Repeated punctuation
cleanup.rule.repeated-punctuation.body = Doubled commas, stops or marks. An ellipsis and an em-dash pair are left alone.
# WHICH TEXT it was found in. Names are never scanned — see cleanup.go — so these
# three are the whole list.
cleanup.field.quote.label = in the quote
cleanup.field.note.label = in the note
cleanup.field.translation.label = in the translation
# A row. {count} is how many times the rule fired in that one field; the snippet
# beside it marks the find with guillemets, because half these rules find
# something that has no appearance at all.
cleanup.row.times = ×{n}
cleanup.row.open.tip = Open where this quote lives
cleanup.row.open.aria = Open {label}
cleanup.row.no-work.label = a quote of its own
cleanup.filter.all.label = All
error.cleanup.generic = could not read the library

# ---------------------------------------------------------------------------
# RE-VERIFY — ReverifyReview.jsx. The review-before-apply flow: every pinned
# work re-checked against its live source, every changed field shown as
# stored-versus-fresh with a tick, and nothing written until the tick is there.
#
# THE PLURALS ARE REAL ONES NOW. The English read “item(s)”, “change(s)” and
# “image(s)” — the parenthesised -s that stands in for a plural nobody wanted to
# write twice. A locale file has a plural category per language, so the hedge is
# no longer needed in English and would not have worked in any language that has
# more than two forms.
# ---------------------------------------------------------------------------
reverify.title = Re-verify metadata
reverify.checking.prose = re-checking each item against its pinned source — nothing is written until you approve it.
reverify.checking.progress = checking · {done}/{total}
# The tally across the top once the checking is done.
reverify.summary = {checked} checked · {changed} with changes · {clean} up to date
reverify.summary.skipped = {n} skipped (no pinned id)
reverify.summary.failed = {n} failed
reverify.clean = everything checked is already up to date ✓
# One item's card.
reverify.item.open.tip = Show the proposed changes
reverify.item.approved = {n}/{total} approved
reverify.item.approve-all = approve all
reverify.item.approve-none = none
# One field's row inside it. The two column heads are drawn in small caps.
reverify.field.approve.tip = Approve this change
reverify.column.stored = STORED
reverify.column.fresh = FRESH
# A cast list is clamped to six; this is the tail.
reverify.value.more = +{n} more
# Why an item had nothing checked, or could not be.
reverify.status.unpinned = no pinned id
reverify.status.fetch-failed = could not reach the source
reverify.status.not-found = not found
# The button, and what it says while it works.
reverify.apply.label.one = Apply {n} approved change
reverify.apply.label.other = Apply {n} approved changes
reverify.apply.busy = Applying…
# One line per applied item, afterwards. {note} is the server's own reason for
# leaving an image alone.
reverify.result.applied = applied
reverify.result.applied-note = applied ({note})
# The toast at the end.
reverify.flash.one = re-verify: {n} item updated
reverify.flash.other = re-verify: {n} items updated
reverify.flash.failed = {n} failed
reverify.flash.skipped.one = {n} image skipped
reverify.flash.skipped.other = {n} images skipped
error.reverify.preview = preview failed
error.reverify.apply = apply failed
error.reverify.interrupted = the check was interrupted — check your connection and reopen Re-verify
error.reverify.apply-interrupted = apply was interrupted — check your connection and try again (already-applied items stay applied)

# ---------------------------------------------------------------------------
# IMPORT — ImportPage.jsx. Seven source formats, each a card with a how-to, and
# the per-file result rows underneath.
#
# THE FORMAT NAMES ARE PROPER NOUNS and stay as themselves (§8): Markdown,
# Bookcision, Hardcover, Goodreads, IMDb, Kindle. Where a common noun is stuck to
# one — “IMDb quotes”, “Kindle notebook” — the common half translates and the
# name does not. “My Clippings” is the FILENAME on the device, so it stays Latin
# in every language or the instruction stops being followable.
#
# The steps are numbered by the code, so each is one line of instruction with no
# number in it.
# ---------------------------------------------------------------------------
import.title = Import
import.counts = bring the highlights home

import.source.markdown.title = Markdown
import.source.markdown.desc = Tippani book or catalogue exports, or a Readest export — auto-detected.
import.source.markdown.step.1 = Re-import a Tippani export (books or the catalogue), a Readest export, or your own frontmatter + quotes.
import.source.markdown.step.2 = A single .md may hold many books or titles — each is imported. Drop the file(s) here.

import.source.bookcision.title = Bookcision
import.source.bookcision.desc = Kindle highlights via the Bookcision bookmarklet.
import.source.bookcision.step.1 = On read.amazon.com/notebook, open the book’s Notes & Highlights.
import.source.bookcision.step.2 = Run the Bookcision bookmarklet, then Download → JSON, and drop it here.
import.source.bookcision.step.3 = Prefer to skip the bookmarklet? Use the Kindle notebook card to import the saved page directly (keeps colours).

import.source.hardcover-html.title = Hardcover
import.source.hardcover-html.desc = Your reading-journal page for one book.
import.source.hardcover-html.step.1 = Open your journal page, e.g. hardcover.app/books/<book>/journals/@you
import.source.hardcover-html.step.2 = Save it as a web page, HTML only (Ctrl+S / ⌘S).
import.source.hardcover-html.step.3 = Drop the saved .html here.

import.source.goodreads-html.title = Goodreads
import.source.goodreads-html.desc = A book's public Quotes page — quote tags come across too.
import.source.goodreads-html.step.1 = Open the book’s Quotes page, e.g. goodreads.com/work/quotes/<id>-<book>
import.source.goodreads-html.step.2 = Save it as a web page, HTML only (Ctrl+S / ⌘S).
import.source.goodreads-html.step.3 = Drop the saved .html here.

import.source.imdb-quotes.title = IMDb quotes
import.source.imdb-quotes.desc = A movie or show’s Quotes page → dialogues (into Movies & Shows).
import.source.imdb-quotes.step.1 = Open the title’s Quotes page, e.g. imdb.com/title/tt0434409/quotes
import.source.imdb-quotes.step.2 = Save it as a web page, HTML only (Ctrl+S / ⌘S).
import.source.imdb-quotes.step.3 = Drop the saved .html here.

import.source.kindle-notebook.title = Kindle notebook
import.source.kindle-notebook.desc = Your Kindle Notes & Highlights page — colours + locations come across.
import.source.kindle-notebook.step.1 = Open read.amazon.com/notebook and pick the book.
import.source.kindle-notebook.step.2 = Save it as a web page, HTML only (Ctrl+S / ⌘S).
import.source.kindle-notebook.step.3 = Drop the saved .html here.

# The filename on the device. Latin in every language, per §8.
import.source.kindle-clippings.title = My Clippings
import.source.kindle-clippings.desc = The Kindle device’s own file — every book at once, highlights and notes.
import.source.kindle-clippings.step.1 = Plug the Kindle in by USB.
import.source.kindle-clippings.step.2 = Copy documents/My Clippings.txt off the device.
import.source.kindle-clippings.step.3 = Drop it here — every book in the file lands at once.
# Not keyed as .info or .hint on purpose: this is a caveat under a chip, not a
# dot's body, and it is longer than the 240 those are held to.
import.source.kindle-clippings.caveat = Kindle never documented this format and localises it, so a device in another language (or an unusual firmware) can produce records this misreads. Nothing is guessed at: whatever can’t be read is skipped and counted back to you.

# The honest chip beside a format that can misread a file.
import.experimental.label = experimental
# The desktop card's button, and the phone picker's.
import.choose.label = Choose file — one or many
import.drop.hint = or drag & drop here
import.pick.label = Import — pick file(s)
# The phone's format chooser.
import.format.aria = Import format
import.format.search.placeholder = Search formats…
import.format.none = no format matches

# The run's summary line. Two plural families rather than one sentence, because
# the file count and the quote count pluralise independently.
import.summary.files.one = {n} file
import.summary.files.other = {n} files
import.summary.quotes.one = {n} quote staged
import.summary.quotes.other = {n} quotes staged
import.summary.arrow = {files} → {quotes} · nothing has entered your library yet
# One row per file.
import.row.staged.one = {n} quote staged
import.row.staged.other = {n} quotes staged
import.row.duplicate = ⚠ looks like a book you already have: {titles} — retarget the staged quotes onto it in the queue, or approve them as a separate book
# The hand-over to the queue.
import.review.one = Review {n} staged quote
import.review.other = Review {n} staged quotes
import.review.absent = open Pending import to review and approve them

# Where one parsed work will land. Two keys rather than one with an optional
# parenthetical, so neither language has to build a bracket.
import.work.joins = joins your existing “{title}”
import.work.joins-year = joins your existing “{title}” ({year})
import.work.new = a new {kind}
import.work.ambiguous = ⚠ you have {n} titles named “{title}” — the queue shows which one it picked, and lets you move it

# What a My Clippings.txt import dropped, and why. A best-effort parser that
# quietly returns fewer quotes than the file held is worse than one that says so.
import.clippings.bookmarks.one = {n} bookmark skipped (no text to import)
import.clippings.bookmarks.other = {n} bookmarks skipped (no text to import)
import.clippings.notes.one = {n} note attached to their highlight
import.clippings.notes.other = {n} notes attached to their highlight
import.clippings.duplicates.one = {n} re-saved highlight collapsed
import.clippings.duplicates.other = {n} re-saved highlights collapsed
import.clippings.malformed.one = {n} record couldn’t be read
import.clippings.malformed.other = {n} records couldn’t be read

# The contract of the screen, stated in place so the absence of “12 added” reads
# as intended rather than as a failure. {queue} is the queue's own name, in bold.
import.nothing-lands.body = Imports land in {queue} first and stay there until you okay them — nothing enters your library, your search or your review deck on arrival. Review a whole file at once there: fix chapters and locations in bulk, move quotes to the right book or film, then approve or discard.
# Why imports are save-the-page-and-upload rather than paste-a-URL — a natural
# question, answered once and collapsed. {emphasis} is “on their page”, italic.
import.why-upload.summary = Why upload the saved page, not paste a URL?
import.why-upload.body = Fetching the page from a URL in your browser is blocked by cross-origin rules (CORS) — sites like Amazon, IMDb and Goodreads don’t allow it, which is exactly why a bookmarklet such as Bookcision has to run {emphasis}. Fetching server-side would dodge CORS but needs your logged-in session for private pages (Kindle), and scraping from a server trips anti-bot defences and site terms — fragile and easy to break silently. Saving the page in your own signed-in browser and uploading it is the robust path that keeps working, so that’s what we do.
import.why-upload.emphasis = on their page

error.import.failed = import failed

# The queue's own name, which the import screen also puts in bold in its
# standing note. ONE KEY, so the two screens cannot disagree about what the
# place is called.
staging.title = Pending import

# ---------------------------------------------------------------------------
# PROFILE — Account.jsx. Everything about “you on this server”, in the order you
# would ask it: who you are, which account you are in, your password, and — for
# an admin — everyone else's accounts and the recovery tools.
#
# RESET IS NOT TRANSLATED. The reset confirmation asks you to type RESET and the
# client sends that exact word to the server, which compares it. Translating the
# word the reader must type would make the instruction unfollowable, exactly as
# with the bulk-delete phrase (§8). The prose around it translates; {word} is
# supplied by the code and is always RESET.
# ---------------------------------------------------------------------------
account.photo.upload = Upload photo
account.photo.change = Change photo
account.photo.info.title = Profile photo
account.photo.info.body = Shown as your avatar chip in the top bar, the drawer and the user list. A square image reads best; up to 5 MB.
account.photo.remove.aria = Remove photo
account.photo.remove.tip = Remove the photo

account.name.label = Display name
account.name.save = Save name
account.name.done = Name updated.

account.password.label = Change password
account.password.info.title = Change password
account.password.info.body = {min}–{max} characters: letters, digits and punctuation, no accents. It doubles as the key to your backup archives, so it must be typeable on another machine. Changing it signs out other browsers; paired phones stay.
account.password.current.placeholder = current password
account.password.new.placeholder = new password ({min}–{max})
account.password.repeat.placeholder = repeat new password
account.password.done = Password updated.
account.password.submit = Update password

# Switching accounts is a real re-authentication, not an impersonation.
account.switch.title = Switch account
account.switch.info.title = Switch account
account.switch.info.body = Sign in as another user on this server. Each account has a fully separate library, so nothing is shared. It asks for that account's password every time, admin or not.
account.switch.action = Switch
# WHO YOU ARE LEAVING — the one fact the form is about. {name} is bold.
account.switch.leaving = Leaving {name}. This browser signs out of it.
# Real labels, not placeholders: a placeholder is gone the moment you type.
account.switch.name.label = account name
account.switch.password.label = their password
account.switch.submit = Sign in
account.switch.busy = Switching…

account.logout.title = Log out
account.logout.info.title = Log out
account.logout.info.body = Ends this browser session only. Other browsers stay signed in, and a paired phone keeps its own token — unpair it from Settings › Devices if you want it out too.
account.logout.action = Log out

account.maintenance.label = Maintenance
account.reindex.title = Rebuild search index
account.reindex.info.title = Rebuild search index
account.reindex.info.body = Fixes “search failed / internal error” by rebuilding the full-text indexes from your library. Non-destructive — no books, quotes or settings are touched.
account.reindex.action = Rebuild
account.reindex.busy = Rebuilding…
account.reindex.done = Search index rebuilt — search should work again.
account.reindex.partial = Some indexes were too damaged to rebuild ({failed}). If search stays broken, a full reset is the remaining option.

account.reset.title = Reset all data
account.reset.info.title = Reset all data
account.reset.info.body = Permanently deletes everything — every account, all works, quotes, tags, people, stickers, covers, keys and preferences — and restarts Tippani at first-run setup. No backup is taken, and this cannot be undone.
account.reset.open = Reset all data…
account.reset.confirm.prose = Type {word} to confirm you want to delete everything:
account.reset.submit = Delete everything & restart
account.reset.busy = Resetting…

# The admin's list of everyone on the server. Granting is something you do to
# others; revoking is something you do only to yourself.
account.users.label = Users on this server
account.users.info.title = User management
account.users.info.body = Every user gets a fully separate library — nothing is shared. You can make someone an admin, but only they can step down: nobody can remove another admin's rights or delete their account. The last admin cannot step down.
account.users.admin.chip = admin
account.users.you.chip = you
account.users.step-down = Step down
account.users.step-down.tip = Give up your own admin rights
account.users.make-admin = Make admin
account.users.make-admin.tip = Make {name} an admin
account.users.only-admin = only admin
account.users.their-own = their own
account.users.delete.tip = Delete {name} and their library
account.users.delete.aria = Delete {name}
account.users.delete.confirm = Delete user "{name}"? Their books and annotations are removed too.
account.users.add = Add user

# What went wrong, keyed by what failed.
error.validate.name-cannot-be-blank = name cannot be blank
error.validate.password-current-required = Enter your current password
error.validate.password-mismatch = The new passwords do not match
error.validate.switch-name-required = Enter the account name
error.validate.switch-same = That is the account you are already in
error.validate.switch-password-required = Enter that account’s password
error.validate.username-required-add = Enter a username
error.upload.failed = upload failed
error.remove.photo = could not remove photo
error.save.name = could not change name
error.save.password = could not change password
error.switch.account = could not switch account
error.reindex.failed = could not rebuild the search index
error.reset.failed = could not reset the database
error.load.users = could not load users
error.add.user = could not add user
error.save.role = could not change role
error.delete.user = could not delete user

# ---------------------------------------------------------------------------
# PEOPLE — people.jsx. The panel behind every credited name: bio, portrait,
# lifespan, reference-page chips, and the library-wide rename.
#
# THE PROVIDER NAMES ARE NOT KEYED HERE. IMDb, TMDB, TheTVDB, Open Library and
# Wikipedia are vocab.source.*, which the metadata screens already point at — a
# provider has one name in this app wherever it is drawn.
#
# A STUDIO IS NOT A PERSON, which is why the date fields fork: it is founded and
# it closes rather than born and died, and its picture is a logo.
# ---------------------------------------------------------------------------
# The lifespan line shows only YEARS even when the record holds a full day: a
# person's years are what the line is for, and “4 Mar 1920 – 12 Nov 2001” reads
# as a gravestone next to a title. Born-only renders the bare year and needs no
# key.
people.lifespan.range = {born} – {died}
people.lifespan.died = d. {died}

people.photo.zoom.tip = View this photo full screen
people.photo.zoom.aria = View photo of {name} full screen
people.links.heading = reference pages
people.source.via = via {source}
people.state.nothing-saved = nothing saved yet
people.add-details = Add details
people.links.fetching = looking up reference pages…
people.links.refetch = refetch links

# The edit form. Bio and Links reuse common.field.*; these are the ones this
# form words for itself.
people.form.photo.remove = remove photo
people.form.founded.label = Founded
people.form.closed.label = Closed
people.form.born.placeholder = e.g. 1982
people.form.died.placeholder = e.g. 2001
people.form.closed.placeholder = e.g. 2011
people.form.photo-url.label = Photo URL
people.form.logo-url.label = Logo URL
people.form.image-search = search images
# The strip of candidates the search comes back with, when this install has a
# picture source configured. Without one the button opens a web search in a tab
# instead, exactly as it always did, and none of these three are shown.
people.form.image-pick.prose = Pick one, or paste an address below
people.form.image-pick.none = Nothing came back — try the name on its own, or paste an address below
people.form.image-pick.use = Use this picture from {source}
# The same strip on a cast row, where the picture is of a ROLE — an actor in
# costume — rather than of a person. Only shown when a picture source is
# configured; without one the button opens a web search in a tab as before.
cast.picture.pick.prose = Pick one, or paste an address
cast.picture.pick.none = Nothing came back — try the actor's name, or paste an address
cast.picture.pick.use = Use this picture from {source}
# The same strip on a cast row, where the picture is of a ROLE — an actor in
# costume — rather than of a person. Only shown when a picture source is
# configured; without one the button opens a web search in a tab as before.
cast.picture.pick.prose = Pick one, or paste an address
cast.picture.pick.none = Nothing came back — try the actor's name, or paste an address
cast.picture.pick.use = Use this picture from {source}
people.form.image-url.placeholder = https://… paste an image link
# Two lines of example, joined by the code — the file format is one value per
# line, so a two-line placeholder is two keys. URLs, so unchanged in any
# language.
people.form.links.placeholder.1 = https://en.wikipedia.org/wiki/…
people.form.links.placeholder.2 = https://openlibrary.org/authors/…
people.form.links.hint = one link per line — known sites (Wikipedia, Open Library, IMDb, TMDB, TheTVDB) are labelled automatically; anything else shows as-is.

# The library-wide rename: the fix for two transliterations of one person.
people.rename.label = Rename across your library
people.rename.action = Rename everywhere
people.rename.busy = Renaming…
# {noun} is the plural this person is counted in, {entity} the singular row that
# carries the credit — both from unit.*.
people.rename.confirm = Rename “{from}” to “{to}” across all your {noun}? This updates every {entity} crediting them.
# Two keys rather than one with an it/them switch in the code: English grammar
# living in a ternary is exactly what a locale file is for.
people.rename.hint.person = rewrites this name on every {entity} that credits them and merges the saved details — use it to unify two spellings.
people.rename.hint.org = rewrites this name on every {entity} that credits it and merges the saved details — use it to unify two spellings.

people.delete.confirm = Remove saved {kind} metadata for “{name}”?

error.validate.born-date = born must be a year, YYYY-MM or YYYY-MM-DD
error.validate.died-date = died must be a year, YYYY-MM or YYYY-MM-DD
error.lookup.none = no reference pages found for this name
error.save.links = could not save links

# ---------------------------------------------------------------------------
# COVERS AND POSTERS — CoverPicker.jsx. The picker under every work's image
# field, the candidate strip a search fills it with, and the two look-up pickers
# that replace a record's fields from a source.
#
# ONE NOUN, TWO WORDS, AND THE CODE USED TO LOWER-CASE IT. The component knew it
# was handling a “COVER” or a “POSTER” and built every sentence around
# \`label.toLowerCase()\` — English casing as grammar, in a language that has no
# case where Bengali is concerned. The noun is now a key and the sentences take
# it as {noun}, with {nouns} for the plural.
#
# THE SOURCE BADGES ARE vocab.source.*, not spellings of their own. This one file
# held GOOGLE, OPEN LIBRARY, AMAZON, TMDB, TVDB — three of them a third spelling
# of a provider the app already names.
# ---------------------------------------------------------------------------
cover.noun.cover = cover
cover.noun.cover.plural = covers
cover.noun.poster = poster
cover.noun.poster.plural = posters
# The field's own heading, drawn in small caps.
cover.heading.cover = COVER
cover.heading.poster = POSTER
# A remote host outside the CSP allowlist cannot paint the preview; the file is
# fetched server-side on save regardless.
cover.preview.blocked = preview blocked — will fetch on save

cover.upload.tip = Upload a {noun} image
cover.upload.aria = Upload {noun} image
cover.fetch-meta.aria = Fetch metadata
cover.fetch-meta.tip = Fetch metadata by edition
cover.url.aria = Paste image URL
cover.url.tip = Paste an image URL
cover.url.placeholder = https://… direct image link
cover.url.use.aria = Use this image URL
cover.url.use.tip = Use this image
cover.search.aria = Search {nouns}
# NAMED BY WHAT ACTUALLY ANSWERS. A game's lookup goes to IGDB, and this said
# “Search TMDB & TheTVDB” — a promise about a supplier that is never asked.
cover.search.books.tip = Search Books, Library & Amazon
cover.search.screen.tip = Search TMDB & TheTVDB
cover.search.game.tip = Search IGDB & Wikidata
cover.remove.aria = Remove {noun}
cover.pick.prose = pick a {noun} — resolution shown; larger is sharper
cover.pick.none = no {nouns} found
# One candidate in the strip. {res} is its measured pixel size, or the wait.
cover.pick.use = Use this {noun} — {source} · {res}
cover.pending = new {noun} — applies when you Save
cover.clearing = {noun} will be removed on Save

# One compact look-up match, shared by the Add surface and the edition picker.
cover.candidate.editions = {n} eds
cover.candidate.show-editions = Show the editions
cover.candidate.add.tip = Add this match
cover.candidate.add.label = Add
cover.candidate.choose-edition.aria = Choose an edition of {title}
cover.candidate.add.aria = {action} {title}

# The book edition picker.
cover.editions.busy = finding editions…
cover.editions.prose = pick the right edition — replaces the fields below
cover.editions.close.aria = Close the picker
cover.editions.browse = Browse other matches…
cover.editions.looking = Looking up…
cover.editions.none = no matches — try editing the title or ISBN
cover.editions.use.tip = Use this edition
cover.editions.use.aria = Use {title}
cover.editions.use.exact = Use: {title}

# The film / show / game picker.
cover.movie.search.aria = Search
cover.movie.use.tip = Use this match
cover.movie.none = no matches found
# Says why a match you did not search for is sitting at the top. {ids} is a list
# of supplier ids, which are Latin in every language.
cover.movie.by-id = searching by id · {ids}

error.validate.lookup-fields = enter a title, ISBN, or ASIN first

# ---------------------------------------------------------------------------
# PENDING IMPORT — StagingPage.jsx. The queue an import lands in and stays in
# until it is okayed: one list for everything staged from every file, grouped by
# the work each quote will attach to, with a batch filter, checkbox multi-select
# over the rows, a bulk editor, a location-formula box, a retargeter, and the two
# buttons that end it.
#
# staging.title lives beside import.* — ONE KEY for the queue's name, because
# ImportPage.jsx prints it in bold in its standing note and the two screens must
# not disagree about what the place is called.
#
# FOUR PLURAL FAMILIES REPLACED FOUR JAVASCRIPT TERNARIES. The English built its
# own -s ("quote\${n === 1 ? '' : 's'}"), and the Home-screen card built three at
# once — quote/quotes, is/are, it/them. A locale file has a plural category per
# language, so the count picks the form and no language is stuck with English's
# two.
#
# WHAT THIS SCREEN DOES NOT NAME AGAIN. The eight locator fields are the shared
# common.field.* labels, the three kind badges are the shared common.badge.*, the
# group count is common.count.phrase over unit.quote, and the row's edit button is
# common.action.edit.*. A staged chapter is the same chapter it will be after
# approval, so it is spelt the same way.
# ---------------------------------------------------------------------------

# The synthetic group a batch of standalone quotes hangs from. The other three
# badges are common.badge.book / .film / .show; only this one is a PLURAL, because
# the group is not one work. ⚠ SMALL CAPS IN A NARROW SLOT, and a script with no
# case wants one short word rather than a translated shout.
staging.badge.quotes = QUOTES

# The three states before the list. "nothing waiting" sits in the header's counts
# slot; "nothing staged" is the empty state under it; the third is what a batch
# filter says when the file it points at has no rows left.
staging.state.loading = reading the queue…
staging.state.empty-counts = nothing waiting
staging.state.empty = nothing staged — an import lands here first, and stays until you okay it
staging.state.empty-file = no staged quotes in that file

# The header's counts. A batch can hold works and no quotes at all (a book
# exported with none), which is why there are two of these rather than one.
staging.counts.quotes.one = {n} quote waiting
staging.counts.quotes.other = {n} quotes waiting
staging.counts.works.one = {n} work waiting, no quotes
staging.counts.works.other = {n} works waiting, no quotes

# The batch filter. It is a FILTER and not a view: the queue stays one list and
# this narrows it to the file being worked through. {name} is the uploaded
# filename, or the source's name when the file had none.
staging.filter.file.label = File
staging.filter.batch.aria = Import batch
staging.filter.all-files.label = All files ({n})
staging.filter.batch.label = {name} · {n}
staging.select-all.label = select all {n}

# The two page-level actions, which end the whole queue. The count on Approve
# appears only when there is something to count, so it is two keys rather than a
# number glued onto a label.
staging.approve-all.label = Approve all
staging.approve-all.count.label = Approve all {n}
staging.discard-all.label = Discard all
staging.discard-all.confirm.title = Discard everything staged?
staging.discard-all.confirm.body = All {n} staged quotes go, from every file. Nothing in your library is touched.

# THE BULK BAR, over the checked rows. The colour swatches, the two favourite
# buttons, the three panel toggles, and the pair that ends the selection.
staging.bulk.colour.aria = Set category
staging.bulk.favourite.label = ♥ favourite
staging.bulk.unfavourite.label = un-♥
staging.bulk.unfavourite.tip = Remove the favourite mark
staging.bulk.fields.label = Edit fields…
staging.bulk.move.label = Move to…
staging.bulk.locations.label = Locations…
staging.bulk.approve.label = Approve {n}
# One word for the bulk button and for the confirm's own button, so the dialog
# cannot promise something the bar did not offer.
staging.discard.label = Discard
staging.discard.confirm.title.one = Discard {n} staged quote?
staging.discard.confirm.title.other = Discard {n} staged quotes?
staging.discard.confirm.body = They leave the queue without ever entering your library.

# THE FLASH LINE beside the header — what the last bulk POST did. Every action
# funnels through one request, so these are one family rather than a toast per
# control.
staging.flash.updated = updated {n}
# Approving reports three numbers, and the third only when the server actually
# fetched metadata. THREE KEYS JOINED BY THE CODE rather than one value with an
# optional tail: the parser trims a value, so a file cannot carry the leading
# " · " a third fragment would need.
staging.flash.approved.added = {n} added
staging.flash.approved.skipped = {n} skipped
staging.flash.approved.enriched = {n} enriched
staging.flash.discarded = discarded {n}
staging.flash.saved = saved
# {name} is the CATEGORY's name, not the stored colour token — it said
# "colour → blue" while every card on the screen said "Fact".
staging.flash.colour = → {name}
staging.flash.favourited = favourited
staging.flash.unfavourited = unfavourited
staging.flash.edited = edited {n}
staging.flash.moved = moved {n} to {title}
staging.flash.merged = merged {n}
# {op} is one of the six operation words below.
staging.flash.formula = {op} applied to {n}

# ONE GROUP — a target work and the staged quotes going to it. The heading is the
# contract: it names where these will land if approved, so a misdetected file is
# visible before the write rather than after it.
staging.group.select.tip = Select this whole group
staging.group.select.aria = Select every staged quote for {title}
# Where the group will land, in three shapes. The standalone-quote group has no
# destination at all — it is the queue's way of holding quotes that belong to
# nothing.
staging.group.standalone.prose = → will be saved as quotes of their own, from no book and no film
# {target} IS A NODE — the destination's name as a link, supplied by the call
# site, because markup never goes in a locale value.
staging.group.joins.prose = → joins your existing {target}
# The link's own words. Two keys rather than one with an optional parenthetical,
# so no language has to build the bracket itself.
staging.group.target.year.label = {title} ({year})
# The match was pinned by hand rather than guessed, which is worth saying.
staging.group.pinned.label = you chose this
# {kind} is a singular unit.* noun: book, show or film.
staging.group.new.prose = → will be added as a new {kind}
# {n} is at least 2 by construction — a work is only ambiguous when a second
# title shares its name — so this needs no plural family.
staging.group.ambiguous.warning = ⚠ you have {n} titles with this name — check it went to the right one
# A group with no quotes left in it. An empty WORK still creates the book or
# film on approval; an empty quotes group creates nothing, because there is
# nothing to it but the quotes.
staging.group.empty.standalone = no quotes left in this group
staging.group.empty.work = no quotes — approving adds the {kind} itself

# ONE STAGED ROW. Its locators are drawn from the data; these are the words
# around them.
staging.row.select.tip = Select this quote
staging.row.select.aria = Select this staged quote
staging.row.note.label = note: {note}
# WHAT THE LINE SAYS, on a staged row. Drawn above the note, the order every card
# in the app uses, and lower-cased to match its neighbour — these two are the row's
# quiet second line, not headings.
staging.row.translation.label = translation: {text}
# The mark on a row a location formula has moved. ⚠ MONO SLOT — one short word.
staging.row.shifted.label = shifted
staging.row.shifted.tip = a location formula moved this; reset restores it

# THE BULK FIELD EDITOR, following the Metadata console: a blank box is ambiguous
# between "leave it" and "clear it", so the tick is what says "act on this field"
# and an empty value then genuinely clears it. The eight field names are the
# shared common.field.* labels.
staging.fields.panel.title = Edit {n} selected
# {field} is one of those eight labels, LOWER-CASED BY THE CALLER — the same
# arrangement bin.filter.only.tip uses, and the reason a field's name stays a
# single source of truth rather than being written out eight more times.
staging.fields.set.placeholder = set {field} (blank = clear)
staging.fields.add-tags.aria = Tags to add
staging.fields.remove-tags.label = Remove tags
staging.fields.remove-tags.info = The live bulk endpoint can only add tags. A staged tag is plain text until approval, so here it comes off again.
staging.fields.remove-tags.placeholder = remove a tag…
staging.fields.remove-tags.aria = Tags to remove
staging.fields.apply.label = Apply to {n}

# RETARGETING. Book and film are interchangeable here on purpose: moving a batch
# onto the other kind is the repair for a misdetected file, and a staged row keeps
# both locator sets so the move is reversible.
staging.move.panel.title = Move {n} selected
staging.move.library.label = Onto a work in your library
staging.move.library.info = Across kinds too — book highlights can move onto a film, and back. Approval reads whichever locators the destination uses.
# The button, before and after something is picked. Two keys, so neither language
# has to build "Move to" plus a noun out of two fragments.
staging.move.button.label = Move to {title}
staging.move.button.none.label = Move to a work
# The other half: merging into a group already in the queue. {badge} is one of
# the kind badges above.
staging.move.merge.label = Or merge into another group in this queue
staging.move.group.aria = Staged group
staging.move.group.placeholder = pick a group…
staging.move.group.option = {title} · {badge} ({n})
staging.move.merge.button.label = Merge

# THE LOCATION FORMULA — the reason bulk location editing needs more than a text
# box: a Kindle export numbers by location rather than by page (a division), and
# a PDF runs a few pages ahead of the print edition (a subtraction).
staging.formula.panel.title = Shift locations on {n} selected
staging.formula.field.label = Field
staging.formula.field.aria = Locator field
# The visible label and the Select's aria label are the same word, so they are
# one key rather than two chances to disagree.
staging.formula.op.label = Operation
# The six operations. STORED TOKENS live in the code; these are the words, and
# they are resolved during render rather than at import — a table of copy at
# module scope freezes the language.
staging.formula.op.add.label = add
staging.formula.op.subtract.label = subtract
staging.formula.op.multiply.label = multiply
staging.formula.op.divide.label = divide
staging.formula.op.set.label = set to
staging.formula.op.reset.label = reset
# The number to shift by, and the text to set instead. Both labels sit in boxes
# 110px and 160px wide.
staging.formula.by.label = By
staging.formula.by.placeholder = 5
staging.formula.to.label = To
staging.formula.to.placeholder = p.1
# What a formula does to the text, stated once under the controls. FIVE HOLES,
# ALL OF THEM NODES: the four worked examples and the reset operation's own name
# are drawn in bold by the call site, because markup never goes in a value. Named
# .prose rather than .info.body or .hint on purpose — it is a worked explanation
# under a control, not a popover, and it is longer than a dot's 240-character
# budget allows.
staging.formula.prose = Numbers inside the text move and everything around them stays: {from} minus 5 is {to}, and a range like {range} moves at both ends. Timestamps convert to seconds, shift, and come back as {clock}. Results stop at zero and division rounds. {reset} restores every row's as-imported value, so a formula applied by mistake is undone rather than lived with.
# The five bold fragments. HH:MM:SS is a picture of a time format rather than
# words and stays as it is in every language.
staging.formula.example.page-from = p.142
staging.formula.example.page-to = p.137
staging.formula.example.range = 610-612
staging.formula.example.clock = HH:MM:SS
staging.formula.example.reset = Reset

# THE PER-ROW EDITOR, for one-offs. The quote's own text is not editable here,
# because a staged row is a record of what the file said; wording is fixed after
# approval, in the normal edit form.
staging.form.title = Edit staged quote
# The row's words, shown back as a quotation. The curly pair, as everywhere else.
staging.form.quoted = “{text}”
staging.form.locators.prose = Both locator sets are here because a staged quote carries both: approval reads whichever the destination uses, so moving this onto a film — or back onto a book — never loses the other half.
# The eight example values. The labels above them are the shared common.field.*
# ones. Philip Marlowe and Elliott Gould are proper nouns; 01:02:03 is a picture
# of a time format.
staging.form.chapter-no.placeholder = 7
staging.form.chapter.placeholder = optional
staging.form.location.placeholder = p.142
staging.form.character.placeholder = Philip Marlowe
staging.form.actor.placeholder = Elliott Gould
staging.form.season.placeholder = 2 (shows only)
staging.form.episode.placeholder = 5 (needs a season)
staging.form.timestamp.placeholder = 01:02:03

# THE HOME-SCREEN NUDGE. A half-finished import must not be forgettable, so the
# count surfaces outside the Add surface too. ⚠ THE LABEL IS A MONO SLOT, and it
# is lower case where staging.title is not — the two are different roles, not two
# spellings of one.
staging.card.label = pending import
staging.card.body.one = {n} imported quote is waiting for you to okay it — nothing has entered your library yet.
staging.card.body.other = {n} imported quotes are waiting for you to okay them — nothing has entered your library yet.
staging.card.review.label = Review {n}

# ---------------------------------------------------------------------------
# METADATA — MetadataPage.jsx. The management console: coverage tiles, the
# catalogue with its bulk bar, duplicate books, the per-title speaker remap and
# the people table. It was the biggest screen in the app with no keys at all —
# every word of it rendered English in every language.
#
# metadata.help.* IS A DIFFERENT SURFACE and already exists above: the "?" panel's
# entries for this screen. These are the screen's own words. Where the two say the
# same thing they are kept in step by hand rather than shared, because a help
# entry is prose under a length cap and a heading is a heading.
#
# THE PLURALS ARE REAL ONES NOW. The English hedged five times — "item(s)",
# "book(s)", "actor(s)", "title(s)", "cover(s)" — and one count picked between
# "group" and "groups" with a JavaScript ternary. A locale file carries a plural
# category per language, so each of those is a .one/.other family here and the
# ternary is gone.
#
# THE GAP WORDS ARE ONE SET, drawn by the coverage tiles, by both filter
# dropdowns and by the chips on a row. "no cover" is NOT a field name — it is a
# phrase about a missing field — so it lives here rather than in common.field.*,
# and the field labels this screen does draw (author, series, name, links,
# character, actor) come from there untouched.
# ---------------------------------------------------------------------------

# --- the page header. The title is nav.tab.metadata.label, the tab's own name;
# these are the two subtitles, one per form factor.
metadata.counts.mobile = maintenance
metadata.counts.desktop = stats · filters · bulk actions

# --- the phone. A dot rather than an apology: the big filterable lists are
# desktop-only, so the screen says so.
metadata.mobile.info.title = Metadata on a phone
metadata.mobile.info.body = This is the trimmed-down maintenance view. Open Tippani on a desktop for the full metadata console — coverage stats, filterable book & film lists, and bulk actions.

# --- FETCH COVERS & METADATA, the admin-only run over the whole library. The
# endpoint is chunked, so the bar is a real fraction — except before the first
# chunk has reported a total, which is what the second label is for.
metadata.fetch.label = Fetch
metadata.fetch.aria = Fetch missing covers and metadata
metadata.fetch.tip = Fill missing covers and metadata
metadata.fetch.progress = fetching covers & metadata · {done}/{total}
metadata.fetch.progress.start = fetching covers & metadata…
# The tally afterwards, joined with " · ". Skipped and failed are spelled out so
# a partial run reads as intentional rather than as nothing having happened.
metadata.fetch.flash.covers.one = {n} cover fetched/upgraded
metadata.fetch.flash.covers.other = {n} covers fetched/upgraded
metadata.fetch.flash.details.one = {n} detail filled
metadata.fetch.flash.details.other = {n} details filled
metadata.fetch.flash.skipped = {n} left as-is (no higher-res source)
metadata.fetch.flash.failed = {n} failed
metadata.fetch.flash.uptodate = everything already up to date

# --- the two action cards on the phone: a title, one line of what-it-does, and a
# single button. .desc AND NOT .info.body ON PURPOSE — the fetch card's sentence
# is 259 characters and the info-dot budget is 240, and cutting a true caveat to
# fit a role name is the wrong way round. Nothing measures .desc, which is the
# point; both are held to the same voice by hand.
metadata.mobile.run.label = Run
metadata.mobile.fetch.title = Fetch covers & metadata
metadata.mobile.fetch.desc = Fills missing covers, posters, authors, descriptions, years and genres across every library on this instance. It only fills blanks — nothing you already have is replaced — and it caps genres at five per item so a source cannot bury a work in low-quality tags.
metadata.mobile.reverify.title = Re-verify metadata
metadata.mobile.reverify.desc = Re-checks every pinned book, film and show against the live sources. Nothing is written until you have seen each proposed change and accepted it.
metadata.reverify.label = Re-verify

# --- COVERAGE. Tiles on a desktop, the same numbers as plain lines on a phone.
# {group} is one of the three group names and {gaps} the run of non-zero gaps;
# the bold half is a node the code supplies, which is why the line has a hole in
# it rather than markup.
metadata.coverage.title = Coverage
metadata.coverage.group.books = Books
metadata.coverage.group.movies = Films & shows
metadata.coverage.group.dialogues = Dialogues
metadata.coverage.group.count = {group} ({n})
metadata.coverage.line = {group} — {gaps}
metadata.coverage.complete = all complete ✓
metadata.coverage.total.label = total
# A tile is also a filter button; {label} is the gap it would filter to.
metadata.coverage.tile.tip = Show only {label}

# --- THE GAP WORDS, one set for the tiles, the two filter dropdowns and the row
# chips. The two long ones are what a ROW says, where a bare "low-res" would not
# say low-res what.
metadata.gap.flagged.label = flagged
metadata.gap.all.label = all
metadata.gap.no-cover.label = no cover
metadata.gap.no-poster.label = no poster
metadata.gap.low-res.label = low-res
metadata.gap.low-res-cover.label = low-res cover
metadata.gap.low-res-poster.label = low-res poster
metadata.gap.no-author.label = no author
metadata.gap.no-series.label = no series
metadata.gap.no-year.label = no year
metadata.gap.no-genre.label = no genre
metadata.gap.no-source.label = no source
metadata.gap.no-cast.label = no cast
metadata.gap.no-director.label = no director
metadata.gap.no-actor.label = no actor
# And a row with nothing missing at all.
metadata.row.complete = complete ✓

# --- THE CATALOGUE, books and films and shows in one list. The type dropdown's
# other three rows are unit.book / unit.film / unit.show — the app's own nouns,
# not a second set for one screen.
metadata.catalogue.title = Catalogue
metadata.catalogue.type.all.label = all types
metadata.catalogue.filter.tip = Show only these gaps
metadata.shown.count = {n} shown
metadata.search.placeholder = search…
metadata.catalogue.nomatch = nothing matches.
metadata.select-all.label = select all shown

# --- the bulk bar over a selection. Bulk edit is books-only, so its button says
# so; the actors one greys out when nothing selected has a cast to fill from.
metadata.bulk.open.label = Bulk edit books…
metadata.bulk.close.label = Close bulk edit
metadata.actors.fill.label = Fill actors from cast
metadata.actors.fill.disabled.tip = none of the selected titles have a cast to fill from
metadata.reverify.open.label = Re-verify…
# What each bulk action asks and reports. The failed tail hangs off whichever ran.
metadata.delete.confirm.one = Delete {n} item and all its quotes/dialogues?
metadata.delete.confirm.other = Delete {n} items and all their quotes/dialogues?
metadata.delete.flash.one = deleted {n} item
metadata.delete.flash.other = deleted {n} items
metadata.bulk.failed.suffix = , {n} failed
metadata.bulk.flash.one = updated {n} book
metadata.bulk.flash.other = updated {n} books
# {actors} and {titles} arrive already counted, which is the only way one
# sentence can carry two counts without a plural rule per pair.
metadata.actors.flash = filled {actors} across {titles}

# --- one row of either list: the tick, the three buttons, the counts. The edit
# and look-up buttons are TOGGLES, so each carries a second word for the state it
# is already in — a latched glyph says which, and the tooltip says what. {noun} is
# the app's own word for the row, book or title.
metadata.row.select.tip = Select this {noun}
metadata.row.edit.close.label = Close the editor
metadata.row.lookup.label = Look up
metadata.row.lookup.close.label = Close the look-up
metadata.row.lookup.tip = Look up the sources
metadata.row.open.aria = Open
metadata.row.open.tip = Open this {noun}
# A film's own count. NOT unit.dialogue, which now reads "film line": this row has
# always counted "dialogues", and migrating keys is not the place to rename a
# thing.
metadata.count.dialogues.one = {n} dialogue
metadata.count.dialogues.other = {n} dialogues

# --- BULK EDIT, books only. The three row labels are common.field.author,
# common.field.series and the genres line below; these are the placeholders that
# say what filling one will do. "#" is a symbol rather than a word (§8) and is the
# same in every language.
metadata.bulk.title = Bulk edit {n} selected
metadata.bulk.author.placeholder = set author (blank = clear)
metadata.bulk.series.placeholder = set series (blank = clear)
metadata.bulk.series-no.placeholder = #
metadata.bulk.genres.label = add genres
metadata.bulk.genres.placeholder = comma-separated — added, not replaced
metadata.bulk.apply.label = Apply to {n}

# --- DUPLICATE BOOKS. One copy imported and one added by hand is the case this
# finds; merging moves the quotes onto the copy you keep.
metadata.duplicates.title = Duplicate books
metadata.duplicates.info.body = Finds books whose title and author match closely enough to be the same book twice — usually one imported, one added by hand. Merging moves every quote onto the copy you keep and deletes the rest, defaulting to the one with most quotes.
metadata.duplicates.groups.one = {n} group
metadata.duplicates.groups.other = {n} groups
metadata.duplicates.scan.label = Scan for duplicate books
metadata.duplicates.rescan.aria = Scan again for duplicates
metadata.duplicates.rescan.tip = Scan again
metadata.duplicates.none = no duplicate titles found ✓
# The keeper, and the confirm before the others go. BOTH HALVES of that sentence
# have to agree with the count, so each form is written whole rather than as a
# shared head and a tail.
metadata.duplicates.keep.label = keep
metadata.duplicates.merge.label = Merge into keeper
metadata.duplicates.merge.confirm.one = Merge {n} book into the keeper? Its annotations move over; the other copy is deleted.
metadata.duplicates.merge.confirm.other = Merge {n} books into the keeper? Their annotations move over; the others are deleted.
metadata.duplicates.merge.flash.one = merged {n} book
metadata.duplicates.merge.flash.other = merged {n} books

# --- SPEAKER & CHARACTER REMAP, one title at a time. RICK, Rick Blaine and
# Bogart are one man; this maps each label onto a real cast member and fills the
# actor in on every line. The three names in the dot are a PERSON and a ROLE, so
# they stay as themselves in every language (§8).
metadata.speakers.title = Speaker & character remap
metadata.speakers.info.body = Imported dialogue arrives with whatever label the source used — RICK, Rick Blaine, Bogart. This maps each onto a real cast member across the title, then fills in the actor on every line. A title with no cast must be looked up first.
metadata.speakers.pick.placeholder = — choose a title —
# The year beside a title in the picker. A wrapper, so the digits stay Western
# and the brackets stay brackets.
metadata.speakers.option.year = ({year})
metadata.speakers.nocast = ⚠ This title has no cast yet — look it up above first, then come back to remap.
metadata.speakers.nolabels = No speaker labels on this title’s dialogues.
metadata.speakers.map.label = Speaker labels → cast
metadata.speakers.apply.label = Apply remap
metadata.speakers.apply.disabled.tip = Choose at least one mapping
metadata.speakers.remapped.flash = {n} remapped
metadata.speakers.refilled.flash.one = , {n} actor filled
metadata.speakers.refilled.flash.other = , {n} actors filled
# One label's row: what it maps onto, or nothing, or a name you type yourself.
metadata.remap.keep.label = keep as-is
metadata.remap.nocharacter.label = (no character)
metadata.remap.cast.option = {character} — {actor}
metadata.remap.custom.label = custom…

# --- PEOPLE. Every author, actor, director, studio and speaker the library
# mentions, with a portrait and reference links.
metadata.people.title = People
metadata.people.info.body = Photos and reference pages, matched to the right person — an author by their books, an actor or director from a film's credits, a studio from a game's. Actor and director photos need a TMDB key; the rest come from Wikidata.
# The five toggles. Studios are their own row rather than folded in with
# directors: the two share one stored column and are told apart only by media
# type, so listing them together would offer a studio for renaming as a director.
metadata.people.kind.author.label = Authors
metadata.people.kind.actor.label = Actors
metadata.people.kind.director.label = Directors
metadata.people.kind.studio.label = Studios
metadata.people.kind.speaker.label = Speakers
metadata.people.fetch.label = Fetch missing
metadata.people.fetch.count.label = Fetch missing ({n})
metadata.people.fetch.progress = fetching photos & links · {done}/{total}
metadata.people.fetch.flash = people: {ok} fetched · {failed} failed
# The first thing that went wrong, bracketed after the tally. The joining space
# is in the code, because the parser trims a value's ends.
metadata.people.fetch.flash.reason = ({error})
metadata.people.reverify.label = Re-verify saved
metadata.people.reverify.tip = Re-check every saved person's identity, links and portrait against the live sources — review before anything is applied
# The phone has no browsable list, so it says only how many still need work.
# {noun} is the countable noun for whichever kind is showing.
metadata.people.compact.one = {n} {noun} still needs photos or links
metadata.people.compact.other = {n} {noun} still need photos or links
# What an empty list says. FIVE, one per toggle: the studio line is new, because
# the table this replaces had four rows and a studio list with nothing in it drew
# an empty state with nothing in it.
metadata.people.empty.author = no authors in the library yet
metadata.people.empty.actor = no actors on any dialogue yet
metadata.people.empty.director = no directors on any film yet
metadata.people.empty.studio = no studios on any game yet
metadata.people.empty.speaker = nobody has said anything yet
# The table. Name and Links are shared field names; the middle column's head
# changes with the kind, because what it counts does.
metadata.people.column.books = Books
metadata.people.column.quotes = Quotes
metadata.people.column.titles = Titles
metadata.people.photo.label = photo
metadata.people.photo.tip = photo saved
metadata.people.search.tip = Search the library for “{name}”
# ONE GLYPH, two words: fetch and refetch are the same act — go and get this
# person's photo and links — and the word flips only because the row already has
# some of it.
metadata.people.row.fetch.label = fetch
metadata.people.row.refetch.label = refetch
metadata.people.row.fetch.busy = fetching…
metadata.people.row.error = {name}: {error}
# Near-duplicate spellings of one person, offered as a one-click merge. Same
# glyph and same act as the book merge above, and it rewrites names across the
# library either way.
metadata.people.dups.count = Possible duplicates ({n})
metadata.people.dup.title = Possible duplicate — keep which spelling?
metadata.people.merge.label = Merge into “{name}”
metadata.people.merge.busy = Merging…

# ---------------------------------------------------------------------------
# settings.* (part two) — the nine cards Settings.jsx still held in English:
# Updates, the changelog dialog, Onboarding, Devices, the bin tile, Backup, the
# restore prompt, the metadata-key fields and the Metadata card itself. The
# cards migrated earlier — credits, colours, review scope, Type, language marks,
# the quiz panel, Features, button labels and Appearance — are above.
#
# WHAT WAS TAKEN OUT OF THE CODE, rather than merely moved:
#
#   The KEY FIELD LABELS were seven hardcoded strings ("Google Books key",
#   "IGDB client id"), and their aria-labels were assembled from them with a
#   .toLowerCase() and an article picked by hand — "Add a google books key",
#   which is neither translatable nor even right ("a IGDB client id"). The
#   supplier is a proper noun that vocab.source.* already spells, so a label is
#   now {source} + a noun, and the frames take the name whole.
#
#   The BIN TILE's count line was two JavaScript ternaries picking entry/entries
#   and quote/quotes. Both go through unit.* and common.count.phrase now.
#
#   The THEME PRESETS held their four names at module scope, which freezes the
#   language at import time. They hold keys — and the keys are the share sheet's
#   own four skins (share.image.theme.*), because there is one set of four skins
#   in this app and it should not be spelled twice.
#
#   The RESTORE and BACK UP prompts borrow the onboarding twin's words wherever
#   the control is literally the same one (shell.restore.source.*, its file
#   picker's aria, its upload label, and the three validate reasons). The two
#   screens are one operation seen from either end and are not to read as two
#   features.
# ---------------------------------------------------------------------------

# The fallback title for a card's info dot when the heading is not plain text.
settings.card.info.title = About this

# --- the quiz card's own heading, which was the last literal left on it.
settings.quiz.title = Daily quiz & practice

# --- Features: the heading beside the dot that was already keyed.
settings.features.title = Features

# --- the four credit separators. The CHIP draws the bare symbol — the character
# the splitter matches — and this is the name a screen reader reads instead. It
# used to read the stored token out raw.
settings.credits.sep.comma.aria = comma
settings.credits.sep.semicolon.aria = semicolon
settings.credits.sep.amp.aria = amp
settings.credits.sep.and.aria = and

# --- Language marks: the standing paragraph above the rows. The rest of this
# panel was migrated earlier; this line was missed.
settings.languages.intro.prose = A proverb has nobody to credit, so its card leads with its language instead of a face. Each language offers four letters from its own script; anything else you type — a symbol, a flag, an emoji — is kept as one of that language’s own marks.

# --- Appearance → the seven material specimens. Each card is drawn in
# the materials it offers; this is the line of type inside it.
# The specimen inside the little callout — a line of the app's own display face
# doing its job, not a pangram. Write one a reader of this language would keep.
settings.appearance.preset.specimen.label = the margins, wider than the text…

# ---------------------------------------------------------------------------
# UPDATES (admin only). Checked on demand, never in the background.
# ---------------------------------------------------------------------------
settings.updates.title = Updates
settings.updates.version.label = version
settings.updates.releases.tip = Release notes on GitHub
# The roadmap line. {roadmap} is the link — markup never goes in a value.
settings.updates.roadmap.prose = What is still ahead is on the {roadmap} — including the bugs I already know about, which is worth a look before you report one. Requests and bug reports both start there too.
settings.updates.roadmap.link.label = roadmap ↗
settings.updates.restarting.prose = updating & restarting — this page will reload automatically when Tippani is back…
settings.updates.check.label = Check for updates
settings.updates.check.busy = Checking…
# WHICH RELEASE LINE THIS INSTALL FOLLOWS. A mono label and a two-way toggle;
# the two .implied.* lines appear only when nobody has chosen and the running
# build decided it.
settings.updates.channel.title = release line
settings.updates.channel.aria = Which release line to follow
settings.updates.channel.info.body = Stable follows finished releases only. Pre-release also offers release candidates and branch builds — newer, and more likely to be broken. Either way nothing installs itself.
settings.updates.channel.stable.label = stable
settings.updates.channel.prerelease.label = pre-release
settings.updates.channel.implied.prerelease.prose = you are running a pre-release build, so this line is followed by default — switch to stable to be offered finished releases only
settings.updates.channel.implied.stable.prose = the default for a released build — switch to see release candidates too
# A mono label: one short word or symbol pair, whatever the language.
settings.updates.current.label = ✓ up to date
settings.updates.unreachable.prose = couldn’t reach GitHub ({error}) — check your connection and try again
# {version} is the release that is available and arrives as a bold node;
# {current} is the build you are on.
settings.updates.available.prose = {version} is available (you’re on {current}).
settings.updates.notes.label = release notes ↗
# {word} is the literal UPDATE the server compares byte for byte. It arrives as
# a bold node and is never translated.
settings.updates.confirm.prose = Type {word} to pull {version} and restart the container:
settings.updates.apply.label = Update & restart now
settings.updates.apply.busy = Starting…
settings.updates.failed.prose = update didn’t start — check the container logs, or update by hand below
settings.updates.manual.prose = One-click update needs the Docker socket mounted, or a socket proxy configured (see the README). To update by hand, run on your host:
settings.updates.copy.label = copy
settings.updates.toast.reload = reload in a moment
settings.updates.toast.copied = command copied

# ---------------------------------------------------------------------------
# THE CHANGELOG DIALOG — the release history out of the binary itself.
# ---------------------------------------------------------------------------
settings.changelog.title = Changelog
# Which release you are actually running, marked on its own row.
settings.changelog.running.label = running
settings.changelog.unlisted.prose = You are running {version}, which is not one of the versions above — a build made outside a release.
settings.changelog.close.tip = Close the changelog

# ---------------------------------------------------------------------------
# ONBOARDING — the guided tour's home.
# ---------------------------------------------------------------------------
settings.onboarding.title = Onboarding
settings.onboarding.info.body = A guided tour of every feature. It runs once on first launch and never needs your files — a sample book quote and film dialogue are built in. Next skips a step, “finish later” parks it, and you pick it back up here.
settings.onboarding.done.label = ✓ completed
# The Resume button carries its own step count, which is why it keeps its words.
settings.onboarding.resume.label = Resume tour · step {n} of {total}
settings.onboarding.restart.label = Start over
settings.onboarding.replay.label = Replay the tour
settings.onboarding.start.label = Start the tour
settings.onboarding.pick.label = Refresh one section
settings.onboarding.pick.prose = The tour opens on that screen and carries on from there — Next moves to the next section, and “finish later” parks it back here.

# ---------------------------------------------------------------------------
# DEVICES — pair a phone with this account, and unpair it again.
# ---------------------------------------------------------------------------
settings.devices.title = Devices
settings.devices.info.body = Pairs the Android app with this account. A device stays paired until you unpair it here — changing your password signs out browsers but deliberately leaves phones alone, so a routine password change can’t silently unpair them.
settings.devices.paired.count = {n} paired
settings.devices.code.label = pairing code
settings.devices.code.info.title = Pairing code
settings.devices.code.info.body = Enter it in the app within five minutes. It works once, then expires — start another pairing for a second device.
settings.devices.code.copy.aria = Copy the pairing code
settings.devices.code.copy.tip = Copy the code
settings.devices.code.done.aria = Done pairing
settings.devices.pair.label = Pair a device
settings.devices.revoke-all.aria = Unpair every device
settings.devices.revoke-all.confirm = Unpair every device? Each will stop working immediately.
# {name} is the device's own name, as the phone reported it.
settings.devices.revoke.aria = Unpair {name}
settings.devices.revoke.confirm = Unpair “{name}”? It will stop working immediately.
settings.devices.last-seen.label = last seen {when}
settings.devices.never.label = never used
settings.devices.empty.prose = No devices paired yet.
settings.devices.toast.unpaired = device unpaired
settings.devices.toast.all-unpaired = all devices unpaired

# ---------------------------------------------------------------------------
# THE BIN, AS A TILE. The list is a page of its own (bin.*), and the tile draws
# the page's own name and its two states from there — one bin, one vocabulary.
# Only the dot and the count line belong to Settings.
# ---------------------------------------------------------------------------
settings.bin.info.body = Everything you delete waits here first, and putting one back returns it exactly as it was — quotes, tags, colours, schedule and cover alike. An entry leaves on its own past the window, and that clock only runs while the server does.
# {count} and {held} both arrive already counted, through
# common.count.phrase + unit.entry / unit.quote.
settings.bin.tile.prose = {count} waiting — put any of them back, or empty it
settings.bin.tile.holding.prose = {count} waiting, holding {held} — put any of them back, or empty it
settings.bin.open.label = Open the bin

# ---------------------------------------------------------------------------
# STRAY MARKS, AS A TILE. Same shape as the bin above and for the same reason:
# the list is a page of its own (cleanup.*), and the tile draws the page's name
# from there. The tile is the only door — this is a place you are sent when
# something reads oddly, not a place you browse.
# ---------------------------------------------------------------------------
settings.cleanup.info.body = Pasting a quote from a page brings the page's furniture with it — footnote numbers, double spaces, characters you cannot see. This lists them and changes nothing; each one is yours to decide.
# {count} arrives already counted, through common.count.phrase + unit.quote.
settings.cleanup.tile.prose = {count} with something worth a look
settings.cleanup.tile.clean.prose = nothing to look at — every quote reads as it was written
settings.cleanup.open.label = Look for stray marks

# ---------------------------------------------------------------------------
# BACKUP (admin only) — one dated, encrypted archive, and the prompt that seals
# it. The restore half is settings.restore.* below.
# ---------------------------------------------------------------------------
settings.backup.title = Backup & restore
# The prompt's own name, and the button inside it. One act, one word.
settings.backup.prompt.title = Back up
settings.backup.info.body = One dated, encrypted archive of everything, sealed with your password or a passphrase. Moved to another machine it needs the password that sealed it, and a passphrase archive is recoverable by nothing. Restoring replaces everything here.
settings.backup.what.prose = The archive holds every user, library, password hash and API key, so it is encrypted before it leaves the server. Keep the key: it is what opens the archive on any other machine.
settings.backup.password.prose = This password opens the archive on any Tippani. On THIS server your current password always will, even after you change it.
settings.backup.passphrase.label = Passphrase · {min}–{max} characters
settings.backup.passphrase.prose = Not tied to any account — and not recoverable. Lose it and the archive is lost.
settings.backup.use-passphrase.label = Set a separate passphrase instead
settings.backup.use-password.label = Use my account password instead
settings.backup.now.label = Back up now
settings.backup.now.busy = Backing up…
settings.backup.download.label = Download the last one
# {when} arrives as a bold node; {size} is a byte count in MB or KB, which are
# symbols rather than words.
settings.backup.last.prose = last backup: {when} · {size} · kept on this server until the next one replaces it
settings.backup.empty.prose = no backup on this server yet
# A mono label above the source picker, whose own words are shell.restore.*.
settings.backup.restore-from.label = restore from
# What the chosen archive will ask for, said before you commit to it.
settings.backup.asks.passphrase = asks for its passphrase
settings.backup.asks.password = asks for your password
settings.backup.asks.password.named = asks for the password ‘{name}’ had when it was made
# The same, for an archive whose header names nobody. This used to read
# "the password ‘it’ had" — a pronoun assembled in code.
settings.backup.asks.password.era = asks for the password it was sealed with
settings.backup.asks.unknown = unreadable, or written by a newer Tippani
settings.backup.asks.unkeyed = predates 1.4.1 · no key, asks you to type RESTORE
settings.backup.server.empty.prose = nothing kept here yet
settings.backup.file.choose.label = Choose file…
settings.backup.file.replace.label = Choose a different file…
settings.backup.file.none.label = no file chosen
settings.backup.file.chosen.label = {name} · {size}
settings.backup.restore.label = Restore…
settings.backup.toast.created = backup created
settings.backup.toast.restored = restored · logging you out

# ---------------------------------------------------------------------------
# THE RESTORE PROMPT — one dialog, asking for exactly what the chosen archive's
# own header needs. The consequence line lives here rather than on the card,
# because this is the moment it applies.
# ---------------------------------------------------------------------------
settings.restore.title = Restore
# TWO WHOLE SENTENCES, not one with a hole in it: the date clause lands in the
# middle of the warning, and a value cannot begin with the space that would
# need — the parser trims both halves.
settings.restore.warn.prose = Replaces everything on this server — every user, library and setting. Everyone is logged out. The data being replaced is kept on the server as one recovery copy.
settings.restore.warn.dated.prose = Replaces everything on this server with the backup from {date} — every user, library and setting. Everyone is logged out. The data being replaced is kept on the server as one recovery copy.
# The account password, as against a passphrase — which is why it is not just
# common.field.password.label.
settings.restore.password.label = Your password
settings.restore.password.recoverable.prose = This server made this archive, so your current password opens it — even if it is not the one it was sealed with.
settings.restore.password.named.prose = Sealed by ‘{name}’ on another server, so it needs that account’s password as it was then.
settings.restore.password.era.prose = Not made on this server, so it needs the password that was current when it was made.
# A pre-1.4.1 archive carries no key at all, so the typed word stands for it.
# RESTORE is compared byte for byte and stays Latin in every language.
settings.restore.confirm.label = Type RESTORE
settings.restore.confirm.prose = This archive predates 1.4.1 and carries no key, so the typed word is the confirmation.
# The close on both prompts: backing out of a form is not the same as closing a
# window you were only reading.
settings.prompt.close.tip = Cancel and close

# ---------------------------------------------------------------------------
# THE METADATA CARD — the status chips, and the key fields under them.
# ---------------------------------------------------------------------------
settings.metadata.title = Metadata sources
settings.metadata.info.body = Books need no key: Google Books and Open Library, merged. Films and shows try TheTVDB first, then TMDB; games run on an IGDB pair with no built-in behind it. Each field saves on its own, and manual entry always works.
# Three chips, and only where a key field cannot answer: that lookups are
# failing, that they are running on the shared built-in key or on nothing at
# all, and that titles are still pinned to the source that used to be default.
settings.metadata.books.failing.label = Lookup failing
settings.metadata.tmdb.builtin.label = Built-in TMDB key
settings.metadata.tvdb.builtin.label = Built-in TheTVDB key
settings.metadata.tmdb.none.label = No key
settings.metadata.last-error.prose = last error: {error}
# Shown only on an instance that existed before 2.2.0 moved the default film
# source to TheTVDB, and only while that reader still has titles pinned to TMDB
# alone — so it clears itself rather than needing a dismiss button.
settings.metadata.filmsource.moved.label = {n} still on TMDB
settings.metadata.filmsource.moved.prose = TheTVDB is the default for films and shows now. Re-verify one and its cast gains a picture per character; nothing changes until you do.
# Half an IGDB pair fails at the Twitch token exchange, which arrives as a
# lookup failure — so the missing half is named. {half} is one of the nouns
# below, not a sentence.
settings.metadata.igdb.half.prose = IGDB needs both halves — the {half} is still blank, so game lookups will fail as if the key were wrong.

# --- a key field's NAME: the supplier, then the noun beside it. The supplier is
# a proper noun and comes from vocab.source.*; only the noun is copy. Seven
# hardcoded labels became this plus five words.
settings.keys.field.label = {source} {noun}
settings.keys.noun.key = key
# "client id" and "secret" are the field names on Twitch's own console — field
# identifiers, so they appear as themselves (see settings.help.igdb).
settings.keys.noun.client-id = client id
settings.keys.noun.secret = secret
settings.keys.noun.cookie = cookie
settings.keys.noun.domain = domain
# The subscriber number a free TheTVDB key logs in with. Their own site calls it
# a PIN, so it appears as itself.
settings.keys.noun.pin = PIN
# The half of a Programmable Search credential that names WHICH engine — its own
# console calls it a search engine ID.

settings.keys.google.hint = Optional, and only if you exceed roughly 1,000 lookups a day: console.cloud.google.com → enable the Books API → create a key. Books work with no key at all.
settings.keys.google.placeholder = Google Books API key — optional
settings.keys.tmdb.hint = The FALLBACK for films and shows, tried after TheTVDB: themoviedb.org → Settings → API → a free v3 key (a v4 read token works too). Overrides the built-in shared key. With neither source keyed, lookups return 503.
settings.keys.tmdb.placeholder = TMDB v3 key or v4 token — overrides built-in
settings.keys.tvdb.hint = Tried FIRST for films and shows, and the only source with a picture per character: thetvdb.com → Dashboard → API keys. A project key works on its own. Only a free (user-supported) key also needs the PIN below.
settings.keys.tvdb-pin.hint = Only for a free (user-supported) key, which is refused at login without it — results then come quietly from TMDB. A project key, including the built-in one, never sends a PIN. thetvdb.com → your account → Subscriber PIN.
settings.keys.tvdb-pin.placeholder = TheTVDB subscriber PIN — free keys only
settings.keys.tvdb.placeholder = TheTVDB v4 API key — optional
settings.keys.igdb-id.hint = Games only, and IGDB authenticates through Twitch: dev.twitch.tv/console → Register Your Application → the client id is shown there. The secret below is the other half; one on its own looks nothing up.
settings.keys.igdb-id.placeholder = Twitch client id — needed for games
settings.keys.igdb-secret.hint = The other half of the pair, from the same Twitch application: press “New Secret” on it. It is shown once. With no key at all, game lookups return 503 — manual entry always works.
settings.keys.igdb-secret.placeholder = Twitch client secret — needed for games
# ⚠ .caveat AND NOT .hint, DELIBERATELY. This one runs to 440 characters and the
# 240-character dot budget measures .hint in both languages. It is a security
# warning with a procedure in it — fragile, against Amazon's terms, grants
# account access, and here is where the header is — and no clause in it can be
# dropped to fit a cap, so it is named for what it is instead. Keep it that way.
settings.keys.amazon-cookie.caveat = Optional. Covers already work from an ASIN with no setup at all; the cookie only adds description and genres by reading the product page. It is fragile, it is against Amazon’s terms, and it grants access to your account — it is stored write-only and never shown. To get it: sign in to Amazon on the marketplace your books live on, open DevTools (F12) → Network → click any amazon request → Request Headers, and copy the whole "cookie:" value.
settings.keys.amazon-cookie.placeholder = Amazon session cookie — optional
settings.keys.amazon-domain.hint = The marketplace your books were bought on, e.g. www.amazon.com or www.amazon.de. Not a secret, so this one shows its value.
# A domain to type, not a word to read.
settings.keys.amazon-domain.placeholder = www.amazon.com
settings.keys.google-scrape.title = Read Google image results directly
settings.keys.google-scrape.aria = Read Google image results directly
settings.keys.google-scrape.info.body = A last resort, used only when nothing above answers. It needs no key because it reads the results page — so the requests come from THIS SERVER, and being rate-limited or shown a consent wall affects everyone here. Off by default.

# --- the row's own controls. A secret is write-only, so "stored" is the whole of
# what can be reported about one; a non-secret shows its value instead.
settings.keys.unset.label = not set
settings.keys.need.bundled.label = built in
settings.keys.need.required.label = needed
settings.keys.need.optional.label = optional
settings.keys.need.closed.label = closed to new keys
settings.keys.saved.tip = Saved
settings.keys.saved.aria = {name}: saved
# {name} is a whole field name — "Google Books key" — and goes in unaltered.
# These two replaced "Add a google books key", lower-cased in code.
settings.keys.add.aria = Add the {name}
settings.keys.replace.aria = Replace the {name}
settings.keys.save.blank.tip = Save blank — clears this key
settings.keys.toast.cleared = cleared

# ===========================================================================
# SHARED VOCABULARY THE LAST THREE SCREENS ASKED FOR.
#
# error.* keyed by WHAT FAILED, a handful of countable people-nouns beside the
# unit.actor that already existed, one field label and one shared verb. They
# sit here rather than up in the frame section for the reason the section below
# gives about its own contents: a screen asked for them first, and nothing is
# defined twice, so a translator can search the namespace and find all of it.
# ===========================================================================

# --- from staging ---
error.load.import-queue = could not read the import queue
error.apply.edit = could not apply the edit
error.approve.generic = could not approve
error.discard.generic = could not discard
common.field.favourite.label = Favourite

# --- from metadata ---
# Re-fetching covers and metadata across the whole library (POST /covers/refetch).
error.refetch.covers = could not re-fetch covers
# The duplicate-title scan (GET /metadata/duplicates).
error.scan.duplicates = could not scan for duplicates
# Merging, both kinds: two books into one, and two spellings of one person into
# one name. One act, one error.
error.merge.failed = merge failed
# The speaker remap will not run with nothing mapped. {action} is the name of the
# button that DOES work with nothing mapped, so the button is named once.
error.validate.mapping-required = Choose at least one mapping, or use “{action}”.

# The four countable people-nouns beside the existing unit.actor. The Metadata
# screen counts all five ("3 authors still need photos or links"); the studio row
# is the one that was silently missing before.
unit.author.one = author
unit.author.other = authors
unit.director.one = director
unit.director.other = directors
unit.studio.one = studio
unit.studio.other = studios
unit.speaker.one = speaker
unit.speaker.other = speakers

# --- from settings ---
# The toast that follows a backup offers the copy. "Export" is the neighbouring
# verb and is a different act — this one hands you a file the server already has.
common.action.download.label = Download

# Updates.
error.check.updates = couldn’t check for updates
error.update.start = update failed to start
# A clipboard write the browser refused — the command is still on screen.
error.copy.manual = copy failed — select it manually
error.load.changelog = could not load the changelog

# Devices.
error.load.devices = could not load devices
error.pair.device = could not start pairing
error.revoke.device = could not revoke device
error.revoke.devices = could not revoke devices

# Backup and restore. "data intact" is the load-bearing half: a restore that
# failed changed nothing.
error.backup.failed = backup failed
error.restore.intact = restore failed — data intact

# An uploaded typeface the server would not take.
error.upload.font = could not upload that font

# The third validate reason the restore prompt needs. The other two already
# exist (error.validate.password-required, error.validate.archive-passphrase-
# required) and are reused. RESTORE is compared byte for byte and stays Latin.
error.validate.restore-word = Type RESTORE to confirm

# ===========================================================================
# THE REST OF THE SHARED VOCABULARY — common.field.* and one shell key.
#
# These sit in namespaces the frame section above also writes into, and they are
# down here rather than up there because a screen asked for them first. The rest
# of common.field.* is in the frame section under "shared field chrome"; nothing
# is defined twice, so a translator can search the namespace and find all of it.
# ===========================================================================

# The stored-column labels. THE POINT OF ONE KEY PER COLUMN is that the add
# form, the bulk editor, the table head, the share credit and the export
# heading agree — which they do in English today, by accident, and which is the
# first property a per-screen key would lose.
common.field.title.label = Title
common.field.author.label = Author
common.field.translator.label = Translator
common.field.editor.label = Editor
common.field.year.label = Year
common.field.series.label = Series
common.field.series-no.label = Series #
common.field.isbn.label = ISBN
common.field.asin.label = ASIN
common.field.genres.label = Genres
common.field.genres.placeholder = add a genre…
common.field.description.label = Description
common.field.note.label = Note
common.field.tags.label = Tags
common.field.tags.placeholder = add a tag…
common.field.quote.label = Quote
common.field.chapter-no.label = Chapter #
common.field.chapter-name.label = Chapter name
common.field.location.label = Location
common.field.character.label = Character
common.field.actor.label = Actor
common.field.timestamp.label = Timestamp
common.field.season.label = Season
common.field.episode.label = Episode
common.field.episode-name.label = Episode name
common.field.act.label = Act
common.field.quest.label = Quest
common.field.speaker.label = Speaker
common.field.occasion.label = Occasion
common.field.occasion.placeholder = a speech, a letter…
common.field.place.label = Place
common.field.place.placeholder = where
common.field.region.label = Region
common.field.recipient.label = To
common.field.work-title.label = Source title
common.field.locator.label = Page
common.field.language.label = Language
common.field.language.placeholder = Bengali, Hindi…
common.field.orig-language.label = Original language
common.field.translation.label = Translation
common.field.translation.placeholder = what it says in English
common.field.media-type.label = Type
common.field.name.label = Name
common.field.name.placeholder = name…
common.field.tag.label = Tag
common.field.style.label = Style
# --- the fields a re-verify diff can name that nothing else in the app has a
# word for. The other fifteen it reports — title, author, description, year,
# series, isbn, genres, cover, poster, director — already have their label
# above; these are the six a person carries and the three identifiers.
common.field.cast.label = Cast
common.field.portrait.label = Portrait
common.field.bio.label = Bio
common.field.born.label = Born
common.field.died.label = Died
common.field.links.label = Links
common.field.identity.label = Identity
# Identifiers, which appear as themselves in every language.
common.field.tmdb-id.label = TMDB id
common.field.tvdb-id.label = TheTVDB id

common.field.board.label = Board
common.field.anthology.label = Anthology
common.field.sticker.label = Sticker

# The shell's ? — reached from a work page's own ⋯ menu as well as the top bar.
shell.help.menu.label = What’s on this screen

# ---------------------------------------------------------------------------
# THE LAST FEW, found by sweeping the twenty-five files for a literal still
# sitting in a label, a title or a placeholder prop.
# ---------------------------------------------------------------------------
# The ♥ filter chip, on the Library board and the Catalogue board.
common.favourite.filter.tip = Only favourites
# The poster on a title's own page, before it is opened full screen.
movies.poster.open.tip = View this poster full screen


# ===========================================================================
# THE HELP PANEL — the "?" every screen carries, in 16 sections plus the shell.
#
# Every row has the same shape:
#
#   .term    the row's heading — the control's own name, as the screen spells it
#   .what    ONE front-loaded sentence, always visible. Max 160 characters.
#   .how.N   up to three verb-first lines, always visible, in order. Max 120
#            characters each. The numbering IS the reading order.
#   .more    the folded body behind "more". Max 420 characters. A note, not an
#            essay — the fold is a second chance to be long and the budget says no.
#
# THE BUDGETS ARE ENFORCED AGAINST THIS FILE, not against the source: a
# translation that runs 30% longer than the English has to be cut rather than
# allowed to overflow. See test/pure/help-budget.test.js. Nothing here
# interpolates — there is not one placeholder in the whole section.
#
# A HEADING IS OFTEN AN ALIAS. Nine of the sixteen sections are named by a tab,
# so the panel points at nav.tab.<screen>.label above rather than holding a
# second copy of the screen’s name. The seven that are not aliased are the ones
# whose heading differs from any tab: they carry their own <place>.help.title.
# ===========================================================================

# ---------------------------------------------------------------------------
# home.help.* — the "?" panel’s section for Home.
# ---------------------------------------------------------------------------

# Heading: aliases nav.tab.home.label, so the screen has ONE name. Nothing to add here.

home.help.greeting.term = Greeting
home.help.greeting.what = The date, and a greeting picked for your local time of day, the weekend, or a holiday. It changes on every reload.

home.help.daily-quiz.term = Daily Quiz
home.help.daily-quiz.what = A short multiple-choice round over your own quotes, scheduled on the forgetting curve — each card comes back right as you would start to lose it.
home.help.daily-quiz.more = Answering moves that quote’s memory half-life.

# The named mode beside the Daily Quiz — unlimited and off the schedule.
home.help.practice.term = Practice
home.help.practice.what = The unlimited, skippable twin of the quiz. It keeps its own score and, by default, never touches your review schedule (Settings can change that).

# The verb on a button: a round about one book, person or tag.
home.help.practise.term = Practise
home.help.practise.what = A round about one thing.
home.help.practise.more = It sits in a book or film’s own menu, on a person’s panel, beside a tag, and on the colour rows in Stats — wherever that thing is already named. The round opens over the screen you were on and hands you back to it. The Daily Quiz has no themed version on purpose: that deck is the schedule, and filtering it would leave the cards actually due unasked while the streak still counted the day.

# The three grading buttons on a quiz card.
home.help.grade.term = Reveal / Got it / Missed
home.help.grade.what = Reveal shows the answer; then say honestly whether you had it. The honest answer is what makes the schedule work.

# The edit link on an already-answered quiz card.
home.help.fix-or-tag.term = Fix or tag this
home.help.fix-or-tag.what = On an answered card: correct a typo, change its tags, or ♥ it — without leaving the round.
home.help.fix-or-tag.more = It appears only once you have answered, because an edit form shows the quote and its source, which on most cards is the answer. A cloze card keeps its blank afterwards: the words you were asked for are the server’s to hide, not the card’s to redraw.

# The letter or flag a proverb card leads with instead of a face.
home.help.language-mark.term = Language mark
home.help.language-mark.what = A proverb has nobody to credit, so its card leads with its language where every other quote leads with a face.
home.help.language-mark.more = The built-in is a letter from that language’s own script; Settings offers flags and anything else you can type. No language arrives wearing a flag — a flag is a country, and a language is not.

# The memory dot every quote card wears.
home.help.status-dot.term = Status dot
home.help.status-dot.what = Every quote wears one: remembered, forgetting, probably forgotten, or not yet reviewed. Hover or tap it for the memory half-life.

home.help.favourites.term = Favourites
home.help.favourites.what = The lines you marked with ♥ — book highlights, film dialogue and standalone quotes together, reshuffled on every visit.
home.help.favourites.more = It is a re-surfacing wall rather than a feed, which is why the order changes. Tap one open and it carries the same row as every other quote card — ♥, copy, share, colour, then the ⋯ — led by a glyph that takes you where the quote lives: the Library for a highlight, the Catalogue for a film line, Quotes for one that belongs to neither.

# ---------------------------------------------------------------------------
# library.help.* — the "?" panel’s section for Library.
# ---------------------------------------------------------------------------

# Heading: aliases nav.tab.library.label, so the screen has ONE name. Nothing to add here.

library.help.filters.term = Filters
library.help.filters.what = Genre, wishlist scope, favourites, tagged, has-notes, shelf state, series and sort. On a phone they open as a full-screen sheet with a live result count.

library.help.translator-editor.term = Translator · Editor
library.help.translator-editor.what = The other two people a book is by.
library.help.translator-editor.more = Both are real people here — they get a portrait, a life, links and a page, exactly as an author does, and one human can be an author on one book and a translator on another without becoming two records. Multiple names split on the same separators the author line uses. They show on the BOOK’S OWN PAGE, marked tr. and ed. so a second face is never mistaken for a second author — and nowhere else.

# The chip that scopes the board to books with nothing quoted from them.
library.help.wishlist.term = Wishlist / annotated
library.help.wishlist.what = A book with nothing quoted yet counts as wishlist. Show everything, only those, or hide them to see what you have actually quoted.

library.help.fold-wishlist.term = Fold wishlist
library.help.fold-wishlist.what = Puts every book you have nothing from yet into ONE tile at the front of the board, wearing a collage of the first four covers.
library.help.fold-wishlist.more = Nothing moves and nothing is stored — opening it is the same wishlist chip, and a book leaves the folder by itself the moment you save a quote from it. Off until you turn it on, and it stays on. It applies to the flat board only: inside the wishlist chip there is nothing to fold away from, and a Wishlist folder sitting inside the bucket for one author would mean something different in every group it appeared in.

library.help.shelf-state.term = Shelf state
library.help.shelf-state.what = Reading, paused, abandoned, completed — the coloured bar under each cover. Set it from the state chip on a book’s page.

library.help.sort.term = Sort
library.help.sort.what = Recent, Title, Author, Series, or Last read — the date you last had it in your hands, whether you finished it, are still in it, or gave up on it.
library.help.sort.more = Books you have never logged a read for sit at the end, in alphabetical order, because most of a library that exists to hold quotes has never been logged.

library.help.group-by.term = Group by
library.help.group-by.what = Break the grid into sections by series, author, decade or genre.

# The masonry / list / table switch.
library.help.view.term = View
library.help.view.what = Packed masonry, a plain list, or a sortable table.

library.help.export.term = Export
library.help.export.what = What is in view, as Obsidian-friendly Markdown that imports back cleanly. Filter first and you export that shelf; filter nothing and you export the library.
library.help.export.more = It asks before it writes, and the count it quotes is the count you will get.

# ---------------------------------------------------------------------------
# movies.help.* — the "?" panel’s section for Catalogue.
# ---------------------------------------------------------------------------

# Heading: aliases nav.tab.movies.label, so the screen has ONE name. Nothing to add here.

# The chips that narrow the catalogue to one of the three media.
movies.help.media-types.term = Films / shows / games
movies.help.media-types.what = All three live here. The media-type chips narrow to one; a show’s dialogue carries season and episode, and a game’s credit is its studio rather than a director.
movies.help.media-types.more = A chip only appears once the catalogue holds that type.

movies.help.filters.term = Filters
movies.help.filters.what = Genre, wishlist scope, favourites, tagged, has-notes, shelf state, actor, collection and sort — as a full-screen sheet on a phone.

# The filter that narrows the board to one person’s quoted lines.
movies.help.actor.term = Actor
movies.help.actor.what = Narrows the board to the titles you have quoted a line from, spoken by one person.
movies.help.actor.more = It lists who is QUOTED, not the whole cast — a film whose cast you fetched and whose lines you have not saved is not under anybody, because the point of the filter is to find what somebody said. That is also what makes it agree with the search box: press Search from a board filtered to an actor and the same name goes with it, and search answers with that actor’s lines, grouped under the films they are from.

movies.help.shelf-state.term = Shelf state
movies.help.shelf-state.what = Watching, paused, abandoned, watched — the coloured bar under each poster.
movies.help.shelf-state.more = A game is playing rather than watching, and played rather than watched; both words appear in the filter once you have a game.

movies.help.collection.term = Collection
movies.help.collection.what = A franchise or series grouping, the film side of the Library’s "series".

movies.help.sort.term = Sort
movies.help.sort.what = Recent, Title, Year, Collection, or Last watched — the date you last had it on, finished or not.
movies.help.sort.more = Anything you have never logged a watch for sits at the end, alphabetically.

movies.help.group-by.term = Group by
movies.help.group-by.what = Break the grid into sections by collection, director, decade or genre.

movies.help.export.term = Export
movies.help.export.what = The titles in view and their dialogue as Markdown. It asks first and names the count.

# ---------------------------------------------------------------------------
# book.help.* — the "?" panel’s section for Book.
# ---------------------------------------------------------------------------

# The help panel’s heading on a book’s own page. Not the media-type word — the name of the screen.
book.help.title = Book

book.help.details.term = Details
book.help.details.what = Every stored field — title, author, year, series, ISBN, ASIN, genres, description, cover.
book.help.details.more = Read it there, edit any one field with its pencil, or fetch fresh metadata and choose field by field what to take. Edits do not have to go one at a time: open as many fields as you like and the ✓ in the header saves the lot in one go, which is also the only way that is safe — each field otherwise writes the whole record back, so saving them one after another would undo the ones before it.

# The quote tallies under the author.
book.help.counts.term = Counts
book.help.counts.what = Under the author, what this book is holding: how many quotes, and how many of those are favourites, carry a note, or are tagged.
book.help.counts.more = The three breakdowns only appear when there is something in them — a row of zeroes is nothing to act on — and a book with nothing saved yet says so plainly, because that is the same state the Wishlist tag reports. They count everything on the book, not what a filter has left on screen, so narrowing to one colour cannot make the book look emptier than it is.

book.help.hearts.term = Hearts
book.help.hearts.what = Mark the book a favourite. It is stored per user.

# The reading-state control: start, pause, abandon, finish.
book.help.state-chip.term = State chip
book.help.state-chip.what = The shelf: start reading, pause, abandon, finish — and, while reading, your page or percentage. A finished book keeps a ×N re-read count.

book.help.add-annotation.term = Add annotation
book.help.add-annotation.what = Capture a highlight: the quote, an optional note, the chapter (its number, its name, or both) and where on the page, a colour and tags.

book.help.colour-category.term = Colour category
book.help.colour-category.what = The left bar on each quote card, and the top of the hierarchy: tags say what a quote is about, its colour says what KIND of note it is.
book.help.colour-category.more = Six of them, named in Settings — a fact, a line you disagreed with, something to come back to — and every picker, filter and breakdown in the app uses your words. The first one is the odd one out: it is what a quote gets when nobody picks, and what an import writes when the source named no colour, so it cannot be named without labelling every unmarked quote you own.

book.help.copy.term = Copy
book.help.copy.what = The quote and its credit straight onto the clipboard, plain — no markdown, no asterisks, nothing to strip out at the other end.
book.help.copy.more = The same words the share sheet’s plain-text format writes, and it holds back the same two parts the sheet does: the page or timestamp, and the day you saved it.

book.help.share.term = Share
book.help.share.what = A picture of the line, which is what it opens on — or the words as Markdown, WhatsApp, plain text or Reddit.
book.help.share.more = The image is drawn locally in whichever of the four skins you pick and never leaves the machine. The image can carry a portrait backdrop — the author’s photo bled in from the card’s edge, tinted with the quote’s own colour and faded out before the words start. It rides the same Author tick as the credit itself, so turning that off takes the backdrop with it.

book.help.export.term = Export .md
book.help.export.what = This book and all its quotes as Markdown.

# The ⋯ that carries the phone-only actions.
book.help.more-menu.term = More (⋯)
book.help.more-menu.what = Where the shelf action, export, details and delete live on a phone.

# ---------------------------------------------------------------------------
# film.help.* — the "?" panel’s section for Film, show or game.
# ---------------------------------------------------------------------------

# The help panel’s heading on a film, show or game page — one screen serves all three.
film.help.title = Film, show or game

# The credit slot a game uses where a film credits its director.
film.help.studio.term = Studio
film.help.studio.what = A game credits its studio where a film credits its director — the same slot, with the studio’s logo in place of a face.
film.help.studio.more = Fetching a game pins its IGDB id and takes the DEVELOPER, the company that made it. If the source names no developer the slot stays empty rather than borrowing the publisher’s name, which is what it used to do.

film.help.publisher.term = Publisher
film.help.publisher.what = Who put the game out, which is usually not who made it: Electronic Arts published Mass Effect and BioWare developed it.
film.help.publisher.more = It sits after the studio on the credit line, as PUB., and it is a plain name rather than a link — a publisher has no page of its own here the way a studio does. A game added before 1.17.0 has this empty and may be crediting its publisher as its studio, because the two used to share one field; re-fetching it under Fetch metadata separates them. Films and shows do not show it.

film.help.voice-cast.term = Voice cast
film.help.voice-cast.what = Fetched from Wikidata, the only free structured source for game voice credits — and a thin one: ten of 24 titles checked had a usable cast.
film.help.voice-cast.more = A game with no credits on file shows an honest blank rather than a failed lookup, and the cast is hand-editable either way, so you can type what you know. Cast photos need no key.

film.help.details.term = Details
film.help.details.what = Every stored field — title, director or creator, year, collection, TMDB and TheTVDB ids, genres, description, poster.
film.help.details.more = Edit one field at a time, or open several and save them together with the ✓ in the header. Re-sync from the source to choose field by field what to take. The two ids can be typed as well as fetched, and once set every later search fetches that exact record first. There is a third, the IMDb id, and it is the odd one: nothing is fetched with it, because IMDb has no public API.

# The dialogue tallies under the credit.
film.help.counts.term = Counts
film.help.counts.what = Under the credit, what this title is holding: how many lines, and how many of those are favourites, carry a note, or are tagged.
film.help.counts.more = The breakdowns appear only when there is something in them, and a title with nothing saved says so — the same state the Wishlist tag reports. They count every line on the title rather than what a filter has left on screen.

# The watching-state control: start, pause, abandon, finish.
film.help.state-chip.term = State chip
film.help.state-chip.what = The shelf: start watching, pause, abandon, finish — with a ×N re-watch count.
film.help.state-chip.more = A game reads start playing and played, and three can be in progress at once where a film allows two.

film.help.add-dialogue.term = Add dialogue
film.help.add-dialogue.what = A line with its timestamp, the character, and the actor auto-filled from the cast. Shows also take season and episode.
film.help.add-dialogue.more = A game’s line is placed by its act and its quest, not by a timestamp.

film.help.cast.term = Cast
film.help.cast.what = Pulled from the source when you fetch metadata; it is what fills the actor on a new line.

film.help.copy.term = Copy
film.help.copy.what = The quote and its credit straight onto the clipboard, plain — no markdown, no asterisks, nothing to strip out at the other end.
film.help.copy.more = The same words the share sheet’s plain-text format writes, and it holds back the same two parts the sheet does: the page or timestamp, and the day you saved it.

film.help.share.term = Share
film.help.share.what = A picture of the line, which is what it opens on — or the words as Markdown, WhatsApp, plain text or Reddit.
film.help.share.more = The image can carry a portrait backdrop — the actor’s photo bled in from the card’s edge, tinted with the quote’s own colour and faded out before the words start. Two credited actors take a side each, with the line between them, which is the shape a scene has. The small portrait disc steps aside when the backdrop is on: the portrait is already the face.

# ---------------------------------------------------------------------------
# search.help.* — the "?" panel’s section for Search.
# ---------------------------------------------------------------------------

# Heading: aliases nav.tab.search.label, so the screen has ONE name. Nothing to add here.

search.help.exact-phrase.term = An exact phrase
search.help.exact-phrase.what = Put it in quotation marks — “to be or not to be” — and it is searched as one phrase rather than as six words in any order.
search.help.exact-phrase.more = Everything outside the quotes still matches as you type. A quotation mark you did not close is not an error: those words simply search loosely.

# The search input itself.
search.help.box.term = The box
search.help.box.what = Typo-tolerant and instant. Your last search is remembered.

search.help.filters.term = Filters
search.help.filters.what = The colon grammar with nothing to remember: every field, every value your library uses, and whether a second pick narrows or widens.
search.help.filters.more = Pressing a value makes exactly the chip typing it would make, so the two are the same thing seen from different ends. Each value carries how many hits it would give under the search you are running now — so a number of 0 goes grey rather than disappearing, which tells you which chip to take off.

# The field:value grammar and its dropdown.
search.help.colon.term = What a colon does
search.help.colon.what = Type a field name and a colon, and a dropdown offers the words your own library actually uses.
search.help.colon.how.1 = tag: author: colour: speaker: actor: character: director: genre: series: shelf:
search.help.colon.how.2 = year: favourite: note: wishlist: book: movie: — five offered at a time, More for the rest.
search.help.colon.how.3 = Choosing one lifts it into a chip below, so the box goes back to being free text.
search.help.colon.more = The dropdown narrows as you type and forgives a typo. A search made only of chips is a whole search: the box is allowed to be empty. Backspace on an empty box takes the last chip off, the same as every tag field in the app.

# Escaping a colon with a backslash so the word stays plain text.
search.help.escaped-colon.term = When you meant the word
search.help.escaped-colon.what = Thirteen ordinary words are field names now, and “note:” is a thing people write.
search.help.escaped-colon.more = Put a backslash before the colon — note\\: to self — and it stays plain text: no dropdown, and the words are searched exactly as they read. Only that colon is affected, so a backslash anywhere else in the query is still a character you are looking for.

# Whether a second chip of one field narrows or widens.
search.help.two-chips.term = Two chips of one field
search.help.two-chips.what = Two tags narrow: tag:stoicism tag:death finds the quotes wearing both, because narrowing by a second tag is what pressing a second chip is for.
search.help.two-chips.more = Two colours widen: a quote has one colour, so asking for two would be asking for something nothing is, and that query would come back empty forever and look broken. The same goes for a shelf, a series, a year and any credit — one each, so a second means "or". It depends on the field because one rule cannot serve both.

# A colour chip carries the reader’s own name for the slot.
search.help.colour-names.term = Colours by their names
search.help.colour-names.what = A colour chip reads the word you gave the slot — colour:doubt, not colour:blue — and searching runs on that word too.
search.help.colour-names.more = The stored colour is not what is on screen, so it is not what you type.

# Searching from an already-filtered board.
search.help.arriving-narrowed.term = Arriving already narrowed
search.help.arriving-narrowed.what = Searching from a filtered shelf searches that shelf — genre, series, shelf, favourites and wishlist arrive as chips.
search.help.arriving-narrowed.more = Every chip is removable, so narrowing costs nothing — widening is one click. The filter sheet and these chips are the same state, so they cannot disagree.

# Right-clicking the search button to make every search global.
search.help.global-scope.term = A globe in the lens
search.help.global-scope.what = Right-click the search button and every search becomes a search of everything, with a small globe on the magnifier to say so.
search.help.global-scope.more = Right-click again to put it back. The drawer’s Search has always been global; this makes the top bar’s behave the same way if that is what you want.

# The row of chips that says where to look.
search.help.scope-chips.term = Scope chips
search.help.scope-chips.what = Where to look: everything, or only books, annotations, films, dialogues or quotes.
search.help.scope-chips.more = Each one carries a glyph — the Library and Catalogue chips wear their own tabs’ marks, so the scope looks like the screen it searches — and the words beside them come and go with the Button labels setting in Appearance, which hides them on a phone where six of them stop fitting. All keeps its word at every width: it is the default and the way back, and that is not something to have to have learned a glyph for.

# The headings results are grouped under.
search.help.sections.term = Sections
search.help.sections.what = Results arrive grouped by what matched: books, films, people, characters, annotations, dialogues, notes, tags, genres.

# The results section that gathers one character’s lines.
search.help.characters.term = Characters
search.help.characters.what = A character’s lines gather under their name rather than scattering under the films they came from.
search.help.characters.how.1 = Press the name to narrow the search to that character.
search.help.characters.more = So “everything this character says” is one section rather than something you assemble yourself. It carries no photograph, because a character is not a person and the actor’s face would be answering a different question. Films, shows and games alike.

# Searching a decade or a capture date.
search.help.dates.term = Dates & decades
search.help.dates.what = A decade ("1990s", "90s", "380s BCE") finds the works from it. A day ("2026-07-14") finds what you captured then.
search.help.dates.more = The Stats timeline’s decade ticks come here.

search.help.select.term = Select
search.help.select.what = Tick a set of results for a bulk tag or field edit.

# ---------------------------------------------------------------------------
# quotes.help.* — the "?" panel’s section for Quotes.
# ---------------------------------------------------------------------------

# Heading: aliases nav.tab.quotes.label, so the screen has ONE name. Nothing to add here.

# What the Quotes screen is for.
quotes.help.what-lives-here.term = What lives here
quotes.help.what-lives-here.what = Lines that belong to no book and no film: a speech, a letter, an interview, a song, a proverb, something a friend said.

quotes.help.boards.term = Boards
quotes.help.boards.what = This screen lists BOARDS, the way the Library lists books — you open one to read what is on it.
quotes.help.boards.more = They are yours: name them, colour them, describe them, give them a picture, make as many as you like. Proverbs, Speeches and Others are simply the three you started with, and nothing in the app treats those names as special, so rename or delete them freely.

# The three boards New board offers to fill the form in from.
quotes.help.starters.term = Starting from one of the three
quotes.help.starters.what = New board offers Proverbs, Speeches and Others.
quotes.help.starters.more = Pressing one fills the form in — a name, a colour, and what it holds — and stops there, so it is yours to rename before you create it. They stay on offer rather than disappearing once you have one, because a board you renamed is one this app can no longer recognise, and the name box refuses a duplicate either way.

# The ordinary-or-proverbs setting on a board.
quotes.help.board-kind.term = What it holds
quotes.help.board-kind.what = A board is either ordinary quotes or proverbs, and that is a setting rather than a name.
quotes.help.board-kind.more = A proverb board puts the language and the English translation first, because those are the fields that carry a proverb and are noise on a board of speeches. Rename a proverb board to anything you like and it stays one; call an ordinary board Proverbs and nothing about it changes.

# The language short-list a proverb board offers its quote form.
quotes.help.languages.term = Languages on a proverb board
quotes.help.languages.what = Chosen when you make it and editable after: the short list the quote form offers instead of a box you have to spell the same way twice.
quotes.help.languages.more = Any language, not only the three the starter proverbs come in. Group by Language then breaks the board into a section per language, which is a way of reading the shelf rather than a set of folders — nothing moves, and every other view still shows the whole board.

# The pinned row above the boards.
quotes.help.all-quotes.term = All quotes
quotes.help.all-quotes.what = Pinned above the boards and not a board itself: every quote you have, whatever it is filed under, so the collection stays readable as a whole.
quotes.help.all-quotes.more = It cannot be renamed, hidden or deleted.

quotes.help.hide-board.term = Hiding a board
quotes.help.hide-board.what = Folds it out of the list without touching what is on it — its quotes are still under All quotes, still in search, still in the review deck.
quotes.help.hide-board.more = A board is hidden only when you hide it; an empty one stays put, because a board you have just made is empty and vanishing at that moment would be the opposite of helpful.

quotes.help.delete-board.term = Deleting a board
quotes.help.delete-board.what = Asks where its quotes go and will not proceed until you say.
quotes.help.delete-board.more = Nothing is deleted with the shelf — a board is where you filed something, and unfiling should not destroy it. An empty board goes without a question. The one thing this cannot do is delete your only board while quotes are on it, because there would be nowhere to move them.

quotes.help.occasion.term = Occasion
quotes.help.occasion.what = Where the words were said. It is the locator, and unlike a page number it tells two quotes apart — the same line on two occasions is two quotes, not one.

quotes.help.speaker.term = Speaker
quotes.help.speaker.what = Who said it. It stands where a book’s author stands, it is what the review deck asks you to recall, and it takes a portrait and a bio like any other person.
quotes.help.speaker.more = Two names separated by one of your credit separators are two speakers, here as everywhere else.

# The partial-date field on a standalone quote.
quotes.help.when.term = When
quotes.help.when.what = A partial date: a year on its own is a complete answer, so nothing is padded to a day nobody recorded.

# Saving a quote with nobody to credit.
quotes.help.no-attribution.term = A quote with no attribution
quotes.help.no-attribution.what = Perfectly fine to save, and it stays out of the review deck — there is nothing to recall but the words already in front of you.

# The name under a line, which opens the person.
quotes.help.speaker-credit.term = Speaker credit
quotes.help.speaker-credit.what = The name under a line is a doorway, the way an author is on a book: their portrait sits beside it, and tapping it opens who they were.
quotes.help.speaker-credit.more = A line credited to two people shows both faces and two doorways.

quotes.help.copy.term = Copy
quotes.help.copy.what = The quote and its credit straight onto the clipboard, plain — no markdown, no asterisks, nothing to strip out at the other end.
quotes.help.copy.more = The same words the share sheet’s plain-text format writes, and it holds back the same two parts the sheet does: the page or timestamp, and the day you saved it.

quotes.help.share.term = Share
quotes.help.share.what = A picture of the quote, which is what it opens on — or the words as Markdown, WhatsApp, plain text or Reddit.
quotes.help.share.more = The image can carry a portrait backdrop — the speaker’s photo bled in from the card’s edge, tinted with the quote’s own colour and faded out before the words start. Two speakers take a side each with the words between them, which is the shape a conversation has. The small portrait disc steps aside when the backdrop is on: the portrait is already the face.

quotes.help.filters.term = Filters
quotes.help.filters.what = Colour, favourites, tagged, has-notes, then a tag, speaker, kind or language — the tag and speaker lists are built from what you have saved.
quotes.help.filters.more = On a phone they open as a full-screen sheet with a live result count.

quotes.help.group-by.term = Group by
quotes.help.group-by.what = Break the grid into sections by speaker, kind, place or decade.
quotes.help.group-by.more = A line missing that field lands in a bucket that says which field it is missing, because a quote with no speaker, no kind and no date is a perfectly ordinary proverb.

quotes.help.export.term = Export
quotes.help.export.what = The quotes in view as Markdown, which imports back cleanly. It asks first and names the count.

# ---------------------------------------------------------------------------
# anthologies.help.* — the "?" panel’s section for Anthologies.
# ---------------------------------------------------------------------------

# Heading: aliases nav.tab.anthologies.label, so the screen has ONE name. Nothing to add here.

# What an anthology is for.
anthologies.help.what-lives-here.term = What lives here
anthologies.help.what-lives-here.what = Quotes gathered into a reading order, with your own words between them — a piece of writing rather than a shelf.
anthologies.help.what-lives-here.more = Book highlights, film dialogue and standalone quotes go in side by side, because what is being assembled is an argument and not a filing. The same line may sit in as many anthologies as you like, and none of them owns it.

# How an anthology differs from a board and from a tag.
anthologies.help.not-a-board.term = Not a board, not a tag
anthologies.help.not-a-board.what = A board is where a quote is filed and a tag is what it is about. An anthology is an order you chose, and a quote can be in many.

anthologies.help.new.term = New anthology
anthologies.help.new.what = A title and an introduction. Two anthologies may share a title — nothing here refuses a name.
anthologies.help.new.more = The introduction is the paragraph that says why these lines and in this order. It keeps the blank lines you type between paragraphs, which is the only formatting it has.

# How quotes get in — from another screen’s selection bar.
anthologies.help.adding.term = Adding quotes
anthologies.help.adding.what = Select some on the Library, the Catalogue or Quotes, then choose Add to anthology from the selection bar.
anthologies.help.adding.more = They land at the end, in the order you had them. A quote already gathered here is skipped rather than doubled, and the toast says how many landed and how many were already in. Nothing on the anthology’s own page adds an entry, because only a screen holding quotes knows which ones you mean.

# The paragraph the reader writes above one gathered quote.
anthologies.help.entry-note.term = Your note on an entry
anthologies.help.entry-note.what = The paragraph that introduces one passage. It reads above the quote, the way an editor speaks before the piece does.
anthologies.help.entry-note.more = Saved on its own, so writing about one entry never rewrites the other twenty-nine. Clearing the box takes it off again. It is a different thing from the note on the quote itself, and both can be there at once.

# The Move up / Move down pair in an entry’s ⋯ menu.
anthologies.help.reorder.term = Move up / Move down
anthologies.help.reorder.what = The order is the anthology, so it is yours to change — one step at a time, from each entry’s ⋯ menu.
anthologies.help.reorder.more = A menu item rather than a drag, so it works from the keyboard and under a thumb. The end of the list has no Move down: a greyed row in a menu is a thing to wonder about.

# Taking one passage out of this anthology.
anthologies.help.remove.term = Remove
anthologies.help.remove.what = Takes the passage out of this anthology, with the note you wrote about it. The quote itself is untouched.

anthologies.help.delete.term = Delete an anthology
anthologies.help.delete.what = The introduction and every entry’s note go. The quotes stay exactly where they are.
anthologies.help.delete.more = This is the one delete in the app that does not wait in the bin, so it asks first and says so. What is lost is your own writing about the gathering — never the lines themselves, which an anthology never owned.

anthologies.help.export.term = Export
anthologies.help.export.what = The whole anthology as Markdown: the introduction, then each entry with your note above the quote and its credit under it.
anthologies.help.export.more = A real link, so middle-click and “save link as” work on it.

# Turning the whole section off in Settings → Features.
anthologies.help.feature-switch.term = Turning it off
anthologies.help.feature-switch.what = Settings → Features. It starts off, because most libraries never hold one.
anthologies.help.feature-switch.more = Switching it off takes away the tab and nothing else — the anthologies stay, the URL still opens, and turning it back on finds every one of them where you left it.

# ---------------------------------------------------------------------------
# tags.help.* — the "?" panel’s section for Tags & stickers.
# ---------------------------------------------------------------------------

# The help panel’s heading on the Tags screen. Longer than the tab’s own word, which is just “Tags”.
tags.help.title = Tags & stickers

tags.help.tags.term = Tags
tags.help.tags.what = Cut across books and films alike. Rename one here and every quote follows.

# How a tag draws on a quote card: sticker, banner, flyout, tape or reel.
tags.help.style.term = Tag style
tags.help.style.what = Sticker, banner, flyout, tape or reel — how the tag draws on a quote card.

tags.help.stickers.term = Stickers
tags.help.stickers.what = A heart, a star and three faces to start with, plus any transparent PNG or SVG you upload.
tags.help.stickers.more = Pin one to a quote as a seal the text flows around, and drag it where you like. The five that came with the app are ordinary stickers — rename them, or delete the ones you will never use and they stay gone.

# ---------------------------------------------------------------------------
# metadata.help.* — the "?" panel’s section for Metadata.
# ---------------------------------------------------------------------------

# Heading: aliases nav.tab.metadata.label, so the screen has ONE name. Nothing to add here.

# The tiles counting what each field is missing.
metadata.help.coverage.term = Coverage
metadata.help.coverage.what = How many books and titles are missing each field. On a desktop the tiles are buttons: tapping one filters the list below to exactly those rows.

metadata.help.fetch.term = Fetch covers & metadata
metadata.help.fetch.what = Fills what is missing across the whole library — covers, posters, author, description, year, genres. It never replaces what you already have.

metadata.help.reverify.term = Re-verify
metadata.help.reverify.what = Re-checks pinned works against the live sources and shows you every proposed change before any of it is applied.

metadata.help.duplicates.term = Duplicates
metadata.help.duplicates.what = Finds near-identical titles and merges them, moving the quotes onto the survivor.

# The tool that remaps a character label across a title’s dialogue.
metadata.help.speakers.term = Speakers
metadata.help.speakers.what = Bulk-remaps a character label across a title’s dialogue, and can refill the actors from the cast.

metadata.help.people.term = People
metadata.help.people.what = Authors, actors and directors with portraits and reference links, resolved from the sources.

metadata.help.bulk-edit.term = Bulk edit
metadata.help.bulk-edit.what = Applies an author, series or set of genres to every selected row at once.

# ---------------------------------------------------------------------------
# stats.help.* — the "?" panel’s section for Stats.
# ---------------------------------------------------------------------------

# Heading: aliases nav.tab.stats.label, so the screen has ONE name. Nothing to add here.

stats.help.calendar.term = Calendar
stats.help.calendar.what = A dot per day you captured something. Tapping a day opens exactly those captures in Search.
stats.help.calendar.more = Switch it to Quiz or Practice and it counts answers instead — those days report how many you got right as well as how many you answered, because a dot shaded by volume alone reads a day you got everything wrong exactly like a day you got everything right. Resetting your practice score empties that stream outright, so nothing stale is left behind to hover over.

stats.help.memory.term = Memory
stats.help.memory.what = Health straight from the quiz: how many quotes are remembered, slipping, or probably gone, and your streak.

# The most-quoted lists: authors, speakers, actors, directors, tags.
stats.help.breakdowns.term = Breakdowns
stats.help.breakdowns.what = The authors, speakers, actors, directors and tags your library leans on — plus People, one row each however you credited them.
stats.help.breakdowns.more = Everything is a doorway — tap through to the works.

# When the works are FROM, by decade, century or year.
stats.help.timeline.term = Timeline
stats.help.timeline.what = When your works are from, not when you saved them.
stats.help.timeline.more = Readable by decade, century or year, because a library holding something from 380 BCE and something from last year needs different bucket sizes to make sense.

stats.help.superlatives.term = Superlatives
stats.help.superlatives.what = The most annotated book, the most quoted film, the person you quote most, your busiest month, and who keeps slipping away.

# The header totals, one per kind of quote.
stats.help.counts.term = Counts
stats.help.counts.what = All three kinds counted separately: annotations from books, dialogues from films and shows, quotes from no work at all.
stats.help.counts.more = The header total is the three added up.

# ---------------------------------------------------------------------------
# staging.help.* — the "?" panel’s section for Pending import.
# ---------------------------------------------------------------------------

# The help panel’s heading on the import staging screen.
staging.help.title = Pending import

# Why an import waits here instead of landing in the library.
staging.help.why.term = Why this exists
staging.help.why.what = An import lands here first and stays until you okay it, so a bad parse never reaches your library.

staging.help.bulk-fix.term = Fix in bulk
staging.help.bulk-fix.what = Correct chapters and locations across many rows at once, or move quotes onto the right book or film.

# The Approve / discard pair.
staging.help.approve.term = Approve / discard
staging.help.approve.what = Approving files the quotes; discarding drops them. Re-importing the same file never duplicates.

# ---------------------------------------------------------------------------
# bin.help.* — the "?" panel’s section for The bin.
# ---------------------------------------------------------------------------

# The help panel’s heading on the bin screen.
bin.help.title = The bin

# What waits in the bin.
bin.help.what-is-here.term = What is here
bin.help.what-is-here.what = Everything you delete waits here first — a book with all its quotes, a film with its lines, or one highlight on its own.
bin.help.what-is-here.more = Putting one back returns it exactly as it was: the same quotes, the same tags, the same colours, the same review schedule, and the cover picture too, which waits in a corner of the image store rather than being thrown away. Deleting an account is kept the same way, whole, in the bin of whichever admin deleted it.

# How the bin is reached — the Settings tile, and nothing else.
bin.help.getting-here.term = Getting here
bin.help.getting-here.what = The tile in Settings, and nothing else.
bin.help.getting-here.more = This page has a URL, so it bookmarks and survives a refresh, but it is in no menu on purpose: a permanent tab for things you have deleted would be a standing invitation to browse them.

# What one row of the bin tells you.
bin.help.row.term = A row
bin.help.row.what = What kind of thing it was, what it was called, when it went, how many quotes went with it, whether its picture is still held, and when it is due to go for good.
bin.help.row.more = Open a row that is holding something to read the lines inside it, each with its own colour. It is read-only — the two things you can do to an entry are put it back and get rid of it.

bin.help.restore.term = Restore
bin.help.restore.what = Puts the whole entry back in one go, exactly as it was.
bin.help.restore.more = The buttons are never hidden until you point at them, unlike every other repeated row in the app: you came here having already lost something.

# Throwing one entry away now, with no undo.
bin.help.purge.term = Remove for good
bin.help.purge.what = Throws that one entry away now, with its pictures. There is no undo behind this one.

# The chips that show one kind of deleted thing at a time.
bin.help.kinds.term = Kinds
bin.help.kinds.what = Once there is more than one kind in the bin, chips appear to show one kind at a time.
bin.help.kinds.more = Like the search scopes they lose their words to the Button labels setting in Appearance.

# How long a deleted thing waits before it goes for good.
bin.help.keep-for.term = Keep for
bin.help.keep-for.what = 7, 30 or 90 days, or never.
bin.help.keep-for.more = The clock runs on server time and only while the server is up, so an instance that spends a week switched off has not spent a week of anybody’s thirty days — which is why a row says the date it is DUE to go rather than counting down to it. “Never” keeps everything until you empty the bin yourself.

# Emptying the whole bin.
bin.help.empty-now.term = Empty now
bin.help.empty-now.what = Removes every entry and the pictures they were holding. It asks first, and it is the one act in this feature with nothing behind it.

# ---------------------------------------------------------------------------
# cleanup.help.* — the "?" panel’s section for Stray marks.
# ---------------------------------------------------------------------------

# The help panel’s heading on the stray-marks screen.
cleanup.help.title = Stray marks

# What the page is for.
cleanup.help.what-is-here.term = What is here
cleanup.help.what-is-here.what = Every quote in your library, read once, and anything in it that looks like it came from the page rather than from the writer.
cleanup.help.what-is-here.more = A quote typed by hand is clean. One that arrived by selecting text in an ebook, a PDF or a browser brings the page's furniture with it — a footnote index, a pronunciation gloss, a double space, a soft hyphen — and none of it shows in a card while all of it is in the search index. That is why a search for a phrase you can see sometimes finds nothing.

# The one thing it deliberately does not do.
cleanup.help.no-fix.term = Why nothing is fixed for you
cleanup.help.no-fix.what = Every rule has a false positive that is somebody's real writing, so each find is yours to decide.
cleanup.help.no-fix.more = A sentence may genuinely end in a numeral, a quote may genuinely contain a bracketed aside, and a language may genuinely use a character another one calls invisible. A single button would edit your own words on the strength of a guess, silently, in a library whose whole point is that the words are yours.

# How the page is reached.
cleanup.help.getting-here.term = Getting here
cleanup.help.getting-here.what = The tile in Settings, and nothing else.
cleanup.help.getting-here.more = It has a URL, so it bookmarks and survives a refresh, but it is in no menu: this is a page you visit when something reads oddly, not one you browse.

# A row, and the marked snippet in it.
cleanup.help.row.term = A row
cleanup.help.row.what = What was found, which text it was found in, how many times, and the words around it with the find marked.
cleanup.help.row.more = The marks are guillemets — »like this« — and they are what makes an invisible character visible at all: a no-break space, a zero-width space and an ordinary space look identical otherwise. Open the row's work to edit the quote where it lives.

# The rule filter.
cleanup.help.filter.term = Filtering
cleanup.help.filter.what = One chip per rule that found something, for working through a single kind at a time.
cleanup.help.filter.more = Only rules with a find get a chip. Working by rule rather than by quote is usually faster: the same decision repeated fifty times is one decision.

# Names, and why they are left out.
cleanup.help.names.term = What is not read
cleanup.help.names.what = Only the prose — the quote, the note and a standalone quote's translation.
cleanup.help.names.more = A character, an actor or a speaker is short, and far more often picked from autofill than typed. “R2-D2” looks exactly like a footnote number to a rule, and a droid is not a typo.

# The cap.
cleanup.help.cap.term = A long list
cleanup.help.cap.what = At most five hundred quotes are listed at once, and the page says when it stopped early.
cleanup.help.cap.more = It is a worklist rather than a report, and a worklist that reshuffles as you edit it is worse than a long one — so it is capped rather than paged. Clear some and look again for the rest.

# ---------------------------------------------------------------------------
# settings.help.* — the "?" panel’s section for Settings.
# ---------------------------------------------------------------------------

# Heading: aliases nav.tab.settings.label, so the screen has ONE name. Nothing to add here.

# The names of the six highlight colours.
settings.help.colour-categories.term = Colour categories
settings.help.colour-categories.what = What the six highlight colours are called. They arrive as Fact, Disagreed, Inspirational, Funny and Meta, and all are yours to rename.
settings.help.colour-categories.more = Renaming one changes nothing but the words on your screen — the stored value stays yellow, blue, pink or orange, so exports and imports round-trip exactly as before. Hiding one takes it out of the pickers without touching a single quote already wearing it, and the palette deliberately shares no colour with the app’s own accents.

settings.help.appearance.term = Appearance
settings.help.appearance.what = Paper or film, light or dark or match-the-OS, four accents, and your own cover sizes. Every user keeps their own.
settings.help.appearance.more = If your system asks for more contrast or less transparency, Tippani drops every texture — the page grain, the backdrop, the card and shell tiles — and leaves the borders, colours and layout exactly where they were.

# Whether a control with a glyph also shows its words.
settings.help.button-labels.term = Button labels
settings.help.button-labels.what = Whether a control that has a glyph also shows its words. Auto shows them on a desktop and hides them on a phone, where the row stops fitting.
settings.help.button-labels.more = It governs the filter chips as well as the buttons — the search screen’s scope row is six controls above a search box, and six words do not fit a phone. Hiding them never hides them from a screen reader, and every glyph still names itself on hover or long-press. A few controls opt out and keep their words at every width: primary submits, destructive confirms, and search’s All.

# Which sections of the app are switched on.
settings.help.features.term = Features
settings.help.features.what = Which sections of the app you want to see — the Library, the Catalogue, Quotes.
settings.help.features.more = Turn one off and its tab goes from the strip, the drawer and the phone bar, its tile goes from Home, its chip goes from Search’s scope row, and ＋ stops offering that kind. Nothing else changes: every book, film and quote stays exactly where it is, the review deck still draws on it, and a link or a bookmark still opens it — so turning it back on finds everything where you left it.

# The guided tour card.
settings.help.onboarding.term = Onboarding
settings.help.onboarding.what = The guided tour of every feature.
settings.help.onboarding.more = Start, replay or resume the whole thing, or pick one section and replay only that — the tour opens on that screen and carries on from there. It used to list every section on the card itself; a list you cannot press answers "is this covered?", which is not the question anybody arrives here with.

settings.help.users.term = Users
settings.help.users.what = Everyone on this instance, admin only.
settings.help.users.more = Add an account, remove one, or hand over admin — deliberately asymmetric: any member can be made an admin, and an admin can step down, and that is all. Nobody can take another admin’s rights away, and nobody can delete another admin’s account either, because that would be the same thing with their whole library attached. The last remaining admin cannot step down, so the instance always has one.

settings.help.metadata-sources.term = Metadata sources
settings.help.metadata-sources.what = The API keys lookups run on.
settings.help.metadata-sources.more = Each field edits and saves on its own, and a floppy-with-a-tick beside a field means that key is stored — secrets are write-only, so nothing can ever show you one back. Press edit and a box appears below the row; save it blank to clear the key.

# The two IGDB fields, which only work as a pair.
settings.help.igdb.term = IGDB client id & secret
settings.help.igdb.what = The games pair, and it is a pair — IGDB authenticates through Twitch, so one field on its own cannot look anything up.
settings.help.igdb.more = Register an application at dev.twitch.tv/console for the client id, then press “New Secret” on it for the other half. Unlike films there is no shared built-in to fall back on: the credentials are per-application and rate-limited, so a key shipped with the app would be a queue everybody stands in.

# The typography section — the faces the app draws with, not a media type.
settings.help.type.term = Type
settings.help.type.what = Every face the app uses, each shown doing its own job — the quote face setting a quote, the label face setting a locator.
settings.help.type.more = Two alternates apiece, bundled with the app and free to use; nothing is fetched from anywhere. Bold, italic, small caps, all caps and lining figures are per role.

# The mark a proverb card leads with in place of a face.
settings.help.language-marks.term = Language marks
settings.help.language-marks.what = The other button on the Appearance card. A proverb has nobody to credit, so its card leads with its language instead of a face, and this is what that mark is.
settings.help.language-marks.more = The built-in is a letter from the language’s own script; the tray offers flags and a flag is never assumed, because a flag is a country and a language is not — Bengali is spoken either side of a border and Hindi has no flag of its own. Anything typable works, so a script the tray has no flag for is still yours to mark.

settings.help.upload-font.term = Upload a font
settings.help.upload-font.what = Beside the three bundled faces on every row. It is stored on your own server and never parsed there — the browser is the only thing that reads it.
settings.help.upload-font.more = A check then measures whether the face actually draws that row’s script, because swapping the Bengali face for one with no Bengali in it turns every Bengali quote into boxes. It is a warning and not a refusal: it can be fooled either way, and it is your font.

settings.help.review.term = Review
settings.help.review.what = The card keeps the two you set once — how many cards a day, and which of the three kinds of quote it draws from. Everything else is behind In-depth controls.
settings.help.review.more = The three media are independent — books and standalone quotes without film dialogue is a valid answer. A quote with no speaker and no occasion stays out whatever you pick, and so does anything saved in the last week.

# The folded second half of the Review card.
settings.help.in-depth.term = In-depth controls
settings.help.in-depth.what = Which questions each deck may ask, one switch per type per deck — plus adaptive intervals, the confirm step, and what a look is worth.
settings.help.in-depth.more = Back to defaults at the bottom puts every one of them back, not most of them. Three things it will not do: the daily quiz never offers a self-marked card, because a score that mixes marked and self-marked answers can be read as neither; a question type it does not recognise is ignored rather than refused, so a backup from a newer version still restores; and no deck can be left with nothing to ask.

# Which characters split one author line into two people.
settings.help.credit-separators.term = Multi-author credits
settings.help.credit-separators.what = Which separators split "Gaiman & Pratchett" into two people, at the bottom of the Metadata sources card.
settings.help.credit-separators.more = The author line on each book is never rewritten, so this is safe to change at any time.

settings.help.devices.term = Devices
settings.help.devices.what = Pair the Android app with this account, and unpair it again.

# The Settings tile that opens the bin.
settings.help.bin.term = The bin
settings.help.bin.what = A tile, and a page behind it.
settings.help.bin.more = Everything you delete waits in the bin first — a book with all its quotes, a film with its lines, or one highlight on its own — and the tile says whether there is anything in it and opens it. The list moved off this screen in 1.11.2: a settings card is a control panel, and the bin is a list of unbounded length whose rows expand, which in a 300px column had to leave one of its four facts out.
settings.help.cleanup.term = Stray marks
settings.help.cleanup.what = A tile, and a page listing what your quotes picked up on their way in.
settings.help.cleanup.more = Footnote numbers, pronunciation glosses, double spaces, characters with no appearance at all — the furniture a page brings with it when you select text on it. The page reports and never edits: every rule has a false positive that is somebody's real writing, so each find is one decision of yours.

settings.help.backup.term = Backup & restore
settings.help.backup.what = Admin only: one dated, encrypted archive of everything — restored in place, or from a file taken off another Tippani.
settings.help.backup.more = On the server that made it, your current password opens it whichever password sealed it. Carried elsewhere, it needs the password it was sealed with. A passphrase archive is tied to no login and recoverable by nothing.

# The button that makes the archive.
settings.help.backup-now.term = Back up now
settings.help.backup-now.what = Makes the archive and keeps it here, on the server, ready to restore from.
settings.help.backup-now.more = It does NOT download it any more: making a backup and taking a copy of it are two different things, and doing both every time put a multi-megabyte file in your downloads whether you wanted one or not. The toast that says it worked offers the copy if you want it.

# The link that hands over the archive already on the server.
settings.help.backup-download.term = Download the last one
settings.help.backup-download.what = Hands you the archive that is on the server. It is a real link, so middle-click and “save link as” work on it.
settings.help.backup-download.more = Only the newest archive is kept — a new backup replaces it.

settings.help.changelog.term = Changelog
settings.help.changelog.what = Every release, newest first, out of the binary itself — so it works with the network off, on a LAN-only box, and behind a firewall.
settings.help.changelog.more = Only the newest is open when it appears; the rest fold. The version you are actually running is marked, which is the one thing a link to GitHub cannot tell you. It stops at the build you have: for what is in a version you have NOT installed, the version number above it links to the releases page.

settings.help.updates.term = Updates
settings.help.updates.what = Admin only, checked on demand — never in the background.

# ---------------------------------------------------------------------------
# profile.help.* — the "?" panel’s section for Profile.
# ---------------------------------------------------------------------------

# The help panel’s heading on the profile panel.
profile.help.title = Profile

profile.help.photo.term = Photo
profile.help.photo.what = Your avatar chip. A square image reads best.

profile.help.display-name.term = Display name
profile.help.display-name.what = What the greeting and the user list call you.

profile.help.switch-account.term = Switch account
profile.help.switch-account.what = Sign in as another user on this server.
profile.help.switch-account.more = It asks for that account’s password every time — being an admin does not let you in without one — and each account has a fully separate library. The form names the account you are leaving, because on a server with several adjacent names “switch” with no subject is a question about something you cannot see.

profile.help.log-out.term = Log out
profile.help.log-out.what = Ends this browser session only. Other browsers stay signed in; a paired phone keeps its own token until you unpair it.

profile.help.password.term = Password
profile.help.password.what = 8–20 characters — letters, digits and punctuation, no accents.
profile.help.password.more = That narrow alphabet is deliberate: your password is also the key to your backup archives, so it has to be typeable on another machine months later. Changing it signs out every other browser session but deliberately leaves paired phones alone, and since 1.4.2 it no longer orphans your backups: on this server your current password opens every archive this server made.

# The admin-only user list, on the profile panel.
profile.help.users.term = Users on this server
profile.help.users.what = Admin only: add an account, grant or revoke admin, or delete an account and everything in its library.
profile.help.users.more = To hand over, grant another user admin first, then revoke your own.

# The admin-only rebuild-index and reset-instance pair.
profile.help.maintenance.term = Maintenance
profile.help.maintenance.what = Admin only: rebuild the search index if search starts failing, or reset the whole instance back to first run.

# ---------------------------------------------------------------------------
# capture.help.* — the "?" panel’s section for Add & capture.
# ---------------------------------------------------------------------------

# The help panel’s heading on the ＋ surface.
capture.help.title = Add & capture

# The ＋’s option for a line that belongs to no book and no film. Its term is the chip’s own lower-case wording.
capture.help.no-work.term = no book or film
capture.help.no-work.what = Saves the line on its own, with who said it and on what occasion instead of a chapter and a page. It lands on the Quotes screen.

# The ＋’s book tab.
capture.help.book.term = Book
capture.help.book.what = Look one up by title, author or ISBN — covers and details come with it. Manual entry always works, key or no key.

# The ＋’s film-or-show tab.
capture.help.film.term = Film or show
capture.help.film.what = Looked up on TMDB and TheTVDB by title and year — or by a TMDB/TheTVDB id you type in Details, which names one record exactly where a title cannot.
capture.help.film.more = Picking a match pulls the poster, cast and details.

# The ＋’s capture-a-quote tab.
capture.help.quote.term = Capture quote
capture.help.quote.what = A line against any work you already have, without leaving the screen you were on.
capture.help.quote.more = Opened from a book or film’s own page, that work is already filled in — it is the same surface either way, and the only add form there is.

# The ✓ in the form’s title bar.
capture.help.save.term = Save (✓)
capture.help.save.what = In the title bar, not at the foot of the form, so it is reachable on a phone without scrolling past every field.
capture.help.save.more = It stays greyed until the must-fill fields are filled, and says which one is missing.

# The ＋’s bulk-import tab.
capture.help.import.term = Import
capture.help.import.what = Markdown and Readest exports, Kindle Bookcision and your Kindle notebook, Goodreads and Hardcover pages, IMDb quote pages.
capture.help.import.more = Everything lands in Pending import first.

# The accessible name of the little diagram in the Import entry — a screen reader reads this instead of the three boxes.
capture.help.import.flow.aria = A file goes to Pending import, and reaches your library only when you approve it
# The three boxes of that diagram, in order, then the arrow between the last two. Each sits in a fixed 52-68px box in a mono face, so a long word will not fit — abbreviate rather than overflow.
capture.help.import.flow.file.label = file
capture.help.import.flow.pending.label = pending
capture.help.import.flow.library.label = library
capture.help.import.flow.approve.label = approve

# ---------------------------------------------------------------------------
# common.help.* — the shell’s own rows, appended to EVERY screen’s panel, and
# its heading in the whole-guide rail.
# ---------------------------------------------------------------------------

# The last section of the guide: the controls that are on every screen.
common.help.title = Everywhere

# --- On every screen, both shells ---

# The ＋ in the top bar.
common.help.topbar.add.term = Add (＋)
common.help.topbar.add.what = The single way in, and it knows where you are: a book on Library, a film or show on the Catalogue, and a quote against the work whose page you have open.
common.help.topbar.add.more = Look-up, capture and bulk import are all tabs of the one surface. A badge on it counts imports waiting for review. After you save one, the next capture starts where that one left off — the same colour and the same tags, and the same work for the next half-hour, so a sitting of six quotes off one page is not six full re-entries. The words themselves never carry over.

# The magnifier in the top bar.
common.help.topbar.search.term = Search
common.help.topbar.search.what = Typo-tolerant search across titles, people, quotes, notes, tags and genres. Started from Library or the Catalogue it lands scoped to that side.

# The ? in the top bar — the button that opens this panel.
common.help.topbar.help.term = Help (?)
common.help.topbar.help.what = This list — the controls on whichever screen you are looking at, with the shell’s own appended.
common.help.topbar.help.more = It sits in the top bar rather than in each page’s header, so it is in the same place on every screen.

# The avatar chip at the end of the top bar.
common.help.topbar.avatar.term = Avatar chip
common.help.topbar.avatar.what = Opens your profile directly: photo, display name, password, switching accounts, logging out — and, for an admin, the user list and the recovery tools.

# Multi-select and the bar it opens.
common.help.selecting.term = Selecting several
common.help.selecting.what = Act on several cards at once — quotes, books, films and shows alike.
common.help.selecting.how.1 = Tick a card’s corner, Ctrl-click it, or Select from its own menu.
common.help.selecting.how.2 = Shift-click extends the run. Select all takes what is on screen, never what a filter hid.
common.help.selecting.how.3 = A bar appears: three glyphs in the row, the rest behind its ⋯. Hold one to read it.
common.help.selecting.more = Over QUOTES: colour, ♥ and the quiz toggle in the row; tags, one sticker, another board and delete behind the ⋯. Over BOOKS, FILMS AND SHOWS: fill gaps, move to a shelf, the quiz toggle, delete behind the ⋯. Pick exactly one and Edit appears; pick a second and it goes. The bar holds until you dismiss it, even at zero. Deleting asks you to type what it will do, and lands the lot in the bin as one entry with one Undo.

# Favouriting one quote from its own menu.
common.help.favourite.term = Favourite one thing
common.help.favourite.what = Right-click a quote (or long-press it on a phone) and Favourite is in the menu, beside Edit and Delete.
common.help.favourite.more = The ♥ on the card does the same thing, but it only appears when you hover — so on a phone this is the way in, and favouriting is the most common thing anybody does to a quote. The menu item says what pressing it will do, so it reads Unfavourite once the quote already is one.

# The right-click menu on a book, film or show cover.
common.help.cover-menu.term = A cover’s own menu
common.help.cover-menu.what = Right-click a book, film or show on its board — long-press on a phone — and it offers Select, Fill gaps, the quiz toggle, Edit and Delete.
common.help.cover-menu.more = Everything there is something the selection bar could already do to exactly one thing you had picked, which is the point: the bar and the cover now read the same list. Delete asks first and says how many quotes go with the work, and the toast that follows has an Undo.

# The selection-bar toggle that takes things out of the Daily Quiz.
common.help.skip-in-quiz.term = Skip in quiz
common.help.skip-in-quiz.what = Some things you keep are not things to be tested on — a shopping list saved as a quote, a reference manual whose highlights are all page numbers.
common.help.skip-in-quiz.more = Select them and press Skip in quiz and the Daily Quiz stops drawing on them, without deleting anything. Do it to a BOOK and it covers every highlight you add to that book afterwards too. The button says Add to quiz when the selection is already skipped, so you can always read which way round it is.

# The selection-bar action that fetches only the EMPTY fields.
common.help.fill-gaps.term = Fill gaps
common.help.fill-gaps.what = Over a selection of books, films or shows: fetches each one’s metadata and writes only the fields that are EMPTY.
common.help.fill-gaps.more = A description you wrote, a year you corrected, a cover you chose — none of them are touched, which is why this needs no preview. Re-verify (Metadata) is the other half: it shows you every difference and waits for you to tick the ones you believe.

# The circled i beside a control.
common.help.info-dots.term = Info dots
common.help.info-dots.what = The small circled “i” beside a control carries the explanation that used to sit under it as a paragraph.
common.help.info-dots.more = Hover one on a desktop and it opens on its own; click it and it stays open until you click it again. On a phone, tap.

# --- Phone only — the drawer, the bottom bar, the hold ---

# Tippani added to a phone’s home screen.
common.help.installed-app.term = Installed app
common.help.installed-app.what = Add Tippani to your home screen and three things come with it. Long-press the icon for Capture a quote, Daily quiz or Pending imports.
common.help.installed-app.more = Tap a .md, a My Clippings.txt or a Bookcision .json in your file manager and it opens straight into import staging, in the window you already have. And the icon carries a badge of cards due plus imports waiting — set when the app loads rather than by anything running in the background, because nothing here wakes up on its own.

# The ☰ drawer button, phone only.
common.help.topbar.menu.term = Menu (☰)
common.help.topbar.menu.what = The drawer: every screen, your profile, and the pending-import queue.
common.help.topbar.menu.more = Its Add and Search are the deliberately context-free pair — they open with nothing pre-filled, whatever page you came from. Swipe it left or tap outside to close.

# The floating phone nav.
common.help.bottom-bar.term = Bottom bar
common.help.bottom-bar.what = The thumb-reachable screens — Home, Library, Catalogue and Quotes, or whichever of those you have left switched on in Settings → Features.
common.help.bottom-bar.more = Search is not among them; it is in the top bar, within the same thumb’s reach and one row up. It slides away as you scroll down and comes back as you scroll up.

# What holding a finger down does.
common.help.long-press.term = Long press
common.help.long-press.what = Three different things, decided by what is under your thumb.
common.help.long-press.more = On a CONTROL it shows that control’s label — there is no hover on a phone — and the hold swallows the tap, so holding Delete to find out what it does never deletes anything. On the WORDS OF A QUOTE it does nothing at all, which is deliberate: that is how your phone selects text, and this is an app for keeping other people’s sentences.

# --- Pointer devices only — the tab strip, hover, the keyboard ---

# The shortcuts, and the sheet ? opens.
common.help.keyboard.term = Keyboard
common.help.keyboard.what = Press ? anywhere for the full list. / searches, N captures a quote, and G then H, L, C, Q or S goes Home or to the Library, the Catalogue, Quotes or Stats.
common.help.keyboard.more = In a quiz, 1 and 2 grade and Space reveals a flip card. Every shortcut is also written on the button that does the same thing, so you never have to memorise one to find it.

# The always-visible desktop tab strip that stands in for the drawer.
common.help.tab-strip.term = Tab strip
common.help.tab-strip.what = Every screen, always visible in the top bar: Home, Library, Catalogue and Quotes, then the tools — Tags, Metadata, Stats, Settings.
common.help.tab-strip.more = The first four are what Settings → Features governs, so the strip is as long as you want it to be. It collapses to icons when the window is too narrow for the labels, and each one names itself on hover.

# The bubble a glyph-only control shows on hover.
common.help.hover-labels.term = Hover labels
common.help.hover-labels.what = Every glyph-only control says what it is when you hover or tab to it, in a small bubble anchored to the control itself.

# The right-click menu on a quote card.
common.help.card-menu.term = Right-click a card
common.help.card-menu.what = A quote card answers a right-click with its own menu — copy, share, edit, delete — opened where you pressed.
common.help.card-menu.more = Shift+F10 or the Menu key does the same from the keyboard, and Escape closes it and hands focus back. If you have selected text inside the card, the browser’s own menu wins instead: you wanted Copy, or Look Up, and those are not ours to take away.

# ---------------------------------------------------------------------------
# The capture surface's per-kind locator boxes (1.17.0). A game is placed by its
# act and its quest and has no timestamp at all — the server clears one on a game's
# line — so the form asks for the pair the medium actually has. The episode's name
# is the same locator as its number, said in words.
capture.form.act.placeholder = e.g. Act II
capture.form.quest.placeholder = e.g. The Battle of Kaer Morhen
capture.form.episode-name.placeholder = e.g. The Rains of Castamere
# The actor the chosen character implies, from the work's own cast. Read-only: the
# server derives the stored actor, so this says the character matched a real row.
capture.form.played-by.prose = played by {name}

# The one on-demand IMDb pass (1.17.0) — a cast for the works whose structured
# source has none, which is most games. It asks for a LINK rather than searching,
# because a title search is how a cast lands on the wrong work, and it reports the
# title it attached because that is the only check against exactly that.
film.imdb.open.label = Cast from IMDb
film.imdb.link.label = IMDb link or id
film.imdb.link.placeholder = imdb.com/title/tt1073668/
film.imdb.go.label = Fetch the cast
film.imdb.busy.label = Fetching…
film.imdb.done.prose = {title} — {n} in the cast now.
cast.open.label = People
cast.heading.label = people
cast.role.voice.label = Voice actor
cast.add.aria = Add a character
cast.empty.prose = No cast on file yet. Fetch one, or add a character.
cast.unnamed.label = (unnamed)
cast.picture.aria = Picture for {name}
cast.picture.url.aria = Image URL for {name}
cast.picture.placeholder = https://… image URL
cast.remove.aria = Remove {name}
cast.remove.confirm.prose = Remove {name}?
cast.fill.heading.label = cast only
cast.fill.tvdb.label = Cast from TheTVDB
cast.fill.done.prose = {title} — {n} in the cast now.
cast.fill.match.prose = No TheTVDB id on this title yet — pick the record that is this one, and its cast and character pictures come with it:
cast.fill.match.none = TheTVDB has no record matching this title — set the id by hand in Details if you know it.
cast.fill.info.title = Fetching a cast
cast.fill.info.body = TheTVDB is the only source with a picture of the character in costume, and needs this title matched to it. IMDb has the games, and takes the page you are looking at. Either way, names you have typed are never overwritten.
cast.info.title = About people
cast.info.body = Every character in this work and who plays them. The character's picture belongs to the role and lives here; an actor's headshot belongs to the person and is shared by every work they are in, so it is edited on their own page.
error.load.imdb-cast = Could not read that IMDb title.
error.load.cast = could not load the cast
error.load.cast-picture = could not fetch that picture
error.load.tvdb-cast = Could not read the cast from TheTVDB.

# ---- answering a finding (2.2.1) -------------------------------------------
# The page reported and fixed nothing; it now offers the rewrite and remembers a
# refusal. The copy's job is to make accepting safe: the reader must know what will
# change before they press, and know that ignoring changes nothing at all.
cleanup.bucket.open.label = To answer
cleanup.bucket.ignored.label = Ignored ({n})
cleanup.rescan.label = Look again
cleanup.accept.label = Accept
cleanup.ignore.label = Ignore
cleanup.ignore.tip = Stop offering this one. The quote is not changed.
cleanup.restore.label = Offer it again
cleanup.state.none-ignored = Nothing ignored yet. A finding you ignore waits here, and stops being offered.
cleanup.toast.applied = {n} corrected
cleanup.toast.stale = {n} had already changed, so nothing was done to them
cleanup.toast.duplicate = {n} would have matched a quote you already keep, so they were left alone
cleanup.toast.ignored = {n} ignored
cleanup.toast.restored = {n} back on the list

# A game's line, in the form it is corrected in (2.2.1). A game has no runtime, so
# where a film's line has a timestamp a game's has an act and a quest — the two the
# dedupe hash is keyed by, since a bark reused in two quests is two quotes.
film.line.form.act.placeholder = act
film.line.form.act.tip = Which act or chapter this line is in — free text, so "Prologue" is an answer.
film.line.form.quest.placeholder = quest
film.line.form.quest.tip = The quest or mission it belongs to. Two quests can share a line and keep it twice.

# What a kind of standalone quote carries (0047's five, on screen at last in 2.2.1).
# Grouped under one heading because the kind lives on the board and not on the quote,
# so the form cannot know which of them applies — and because the alternative,
# boxes appearing and disappearing under a Select, hides a field somebody has filled.
quotes.form.carries.label = What this kind carries
quotes.form.region.placeholder = Sylhet, Kolkata…
quotes.form.recipient.placeholder = who it was written to
quotes.form.work-title.placeholder = the essay or article it is from
quotes.form.locator.placeholder = page, section, line
quotes.form.circa.label = The date is approximate
`,Dr=` 	
\r\v\f`;function aa(t){let a=0,o=t.length;for(;a<o&&Dr.includes(t[a]);)a+=1;for(;o>a&&Dr.includes(t[o-1]);)o-=1;return t.slice(a,o)}function ol(t){const a={},o={},s=new Set,r=[];let i=String(t??"");i.charCodeAt(0)===65279&&(i=i.slice(1)),i=i.replace(/\r\n/g,`
`).replace(/\r/g,`
`);const l=i.split(`
`);for(let h=0;h<l.length;h+=1){const d=aa(l[h]);if(d===""||d[0]==="#")continue;const m=d.indexOf("=");if(m<0){r.push(h+1);continue}const p=aa(d.slice(0,m));if(p===""){r.push(h+1);continue}const u=aa(d.slice(m+1));delete a[p],delete o[p],s.delete(p),u===""?s.add(p):p[0]==="_"?o[p]=u:a[p]=u}return{keys:a,reserved:o,empty:[...s].sort(),bad:r}}const fn=["en","bn"],eo={en:ol(nh)},Uo=new Map;function sl(t){if(eo[t]||!fn.includes(t))return Promise.resolve();if(Uo.has(t))return Uo.get(t);const a=Ve(async()=>{const{default:o}=await import("./bn-DCBo7ik4.js");return{default:o}},[]).then(({default:o})=>{eo[t]=ol(o),Va=null,oa=new Map,Cs()}).catch(()=>{});return Uo.set(t,a),a}const ah=()=>Promise.all(fn.map(sl)),ka="en",cn="qps",Go="tippani:locale";function to(t){const a=aa(String(t??"")).toLowerCase();return!a||a.length>16?"":/^[a-z0-9-]+$/.test(a)?a:""}let Va=null;const rl=()=>(Va||(Va=new Set(fn.flatMap(t=>{var a;return Object.keys(((a=eo[t])==null?void 0:a.keys)||{})}))),Va);let Ss={},Ir="{}",yt="",St=ka,Qn=[ka],oa=new Map,kn=null;const Pr=new Set,il=t=>Ss[t]||null,ll=t=>eo[t]||null;function cl(){const t=[...fn];for(const a of Object.keys(Ss).sort())t.includes(a)||t.push(a);return t.push(cn),t}const Ns=t=>cl().includes(t);function no(t){var o,s;if(oa.has(t))return oa.get(t);let a;return t===cn?a=dh():a={...((o=ll(t))==null?void 0:o.keys)||{},...((s=il(t))==null?void 0:s.keys)||{}},oa.set(t,a),a}function Ts(t){var a,o;return t===cn?{_name:Es(Xn([ka,...fn],"locale.pseudo.name")||"Pseudo")}:{...((a=ll(t))==null?void 0:a.reserved)||{},...((o=il(t))==null?void 0:o.reserved)||{}}}function oh(t){if(t===cn)return[cn];const a=[],o=new Set;let s=t;for(;s&&!o.has(s);)o.add(s),a.push(s),s=to(Ts(s)._fallback||""),s&&!Ns(s)&&(s="");for(const r of fn)o.has(r)||a.push(r);return a}function Xn(t,a){for(const o of t){const s=no(o)[a];if(s)return s}return""}function sh(t,a){return a?t.replace(/\{(\w+)\}/g,(o,s)=>Object.prototype.hasOwnProperty.call(a,s)?String(a[s]):o):t}function rh(t){try{return new Intl.PluralRules(St).select(t)}catch{return t===1?"one":"other"}}function ih(t){const a=String(t).split(".").pop()||String(t),o=aa(a.replace(/[_-]+/g," ").replace(/([a-z0-9])([A-Z])/g,"$1 $2")).toLowerCase();return o?o[0].toUpperCase()+o.slice(1):"…"}function n(t,a){return sh(hl(t,dl(a)),a)}const dl=t=>t&&typeof t.count=="number"?t.count:void 0;function hl(t,a){const o=String(t||""),s=a===void 0?Xn(Qn,o):Xn(Qn,`${o}.${rh(a)}`)||Xn(Qn,`${o}.other`)||Xn(Qn,o);if(s)return s;Pr.has(o)||(Pr.add(o),console.warn(`tippani: no string for "${o}" in any language`));const r=ih(o);return St===cn?Es(r):r}function Ie(t,a){const o=hl(t,dl(a)),s=[],r=/\{(\w+)\}/g;let i=0,l=r.exec(o);for(;l;){l.index>i&&s.push(o.slice(i,l.index));const h=a&&Object.prototype.hasOwnProperty.call(a,l[1]);s.push(h?a[l[1]]:l[0]),i=l.index+l[0].length,l=r.exec(o)}return i<o.length&&s.push(o.slice(i)),s}const lh={a:"à",b:"ƀ",c:"ç",d:"ð",e:"ë",f:"ƒ",g:"ĝ",h:"ĥ",i:"í",j:"ĵ",k:"ķ",l:"ł",m:"ɱ",n:"ñ",o:"ö",p:"þ",q:"ɋ",r:"ř",s:"š",t:"ţ",u:"ü",v:"ṽ",w:"ŵ",x:"ẋ",y:"ý",z:"ž",A:"À",B:"Ɓ",C:"Ç",D:"Ð",E:"Ë",F:"Ƒ",G:"Ĝ",H:"Ĥ",I:"Í",J:"Ĵ",K:"Ķ",L:"Ł",M:"Ɱ",N:"Ñ",O:"Ö",P:"Þ",Q:"Q",R:"Ř",S:"Š",T:"Ţ",U:"Ü",V:"Ṽ",W:"Ŵ",X:"Ẋ",Y:"Ý",Z:"Ž"},ch=.3;function Es(t){const a=String(t??"").split(/(\{\w+\})/g);let o="",s=0;for(const r of a){if(/^\{\w+\}$/.test(r)){o+=r;continue}s+=r.length;for(const i of r)o+=lh[i]||i}return`⟦${o}${"·".repeat(Math.ceil(s*ch))}⟧`}function dh(){if(kn)return kn;kn={};for(const t of rl()){const a=no("en")[t]||no("bn")[t]||"";a&&(kn[t]=Es(a))}return kn}function hh(t){const a=no(t);let o=0;const s=rl();for(const r of s)a[r]&&(o+=1);return uh(o,s.size)}function uh(t,a){return!a||t>=a?100:Math.min(99,Math.floor(t*100/a))}function os(t){return Ts(t)._name||t}function ss(t){return Ts(t)._dir==="rtl"?"rtl":"ltr"}function mh(){const t=cl().filter(o=>o!==cn),a=new Map;for(const o of t){const s=os(o).trim().toLowerCase();a.set(s,(a.get(s)||0)+1)}return t.map(o=>{const s=os(o),r=(a.get(s.trim().toLowerCase())||0)>1;return{code:o,name:r&&s!==o?n("locale.picker.disambiguate",{name:s,code:o}):s,dir:ss(o),percent:hh(o),builtin:fn.includes(o)}})}const ao=()=>St,ph=()=>yt&&!Ns(yt)?yt:"";function fh(){oa=new Map,kn=null}function Cs(){if(St=Ns(yt)?yt:ka,Qn=oh(St),typeof document<"u"&&document.documentElement){const t=document.documentElement;t.lang=St,t.dir=ss(St),t.dataset.localePref=yt}typeof window<"u"&&typeof window.dispatchEvent=="function"&&typeof CustomEvent=="function"&&window.dispatchEvent(new CustomEvent("tippani:locale",{detail:{active:St,pref:yt,dir:ss(St)}}))}function As(t){if(t===void 0){let a=null;try{a=localStorage.getItem(Go)}catch{a=null}yt=to(a)}else{yt=to(t);try{yt?localStorage.setItem(Go,yt):localStorage.removeItem(Go)}catch{}}Cs()}function gh(t){const a=t||{},o=JSON.stringify(a);if(o===Ir)return!1;Ir=o;const s={};for(const[r,i]of Object.entries(a)){const l=to(r);!l||!i||(s[l]={keys:i.keys||{},reserved:i.reserved||{},empty:i.empty||[],bad:i.bad||[]})}return Ss=s,fh(),Cs(),!0}async function bh(){const t=await X("GET","/locales");return!t.ok||!t.data?!1:gh(t.data.files)}function ul(){const[,t]=c.useState(0);return c.useEffect(()=>{const a=()=>t(o=>o+1);return window.addEventListener("tippani:locale",a),()=>window.removeEventListener("tippani:locale",a)},[]),St}const ml="/api",wt=t=>t&&t.startsWith("/")?ml+t:t,qs=!1,$e=t=>t?String(t).startsWith("data:")?t:`${ml}/covers/${t}`:"";async function yh(t){let a=null;try{a=await t.json()}catch{}return{ok:t.ok,status:t.status,data:a}}async function pl(t,a){let o;try{o=await fetch(wt(t),a)}catch{return{ok:!1,status:0,data:null}}return yh(o)}async function X(t,a,o){const s={method:t};return o!==void 0&&(s.headers={"Content-Type":"application/json"},s.body=JSON.stringify(o)),pl(a,s)}async function xa(t,a){const o=new FormData;return o.append("file",a),pl(t,{method:"POST",body:o})}function fl(t,a,o){return new Promise(s=>{const r=new XMLHttpRequest;r.open("POST",wt(t)),r.upload.onprogress=i=>{o&&i.lengthComputable&&o(i.loaded/i.total)},r.upload.onload=()=>o&&o(1),r.onload=()=>{let i=null;try{i=JSON.parse(r.responseText)}catch{}s({ok:r.status>=200&&r.status<300,status:r.status,data:i})},r.onerror=()=>s({ok:!1,status:0,data:null}),r.send(a)})}async function Ms(t,a,o){const s=await fetch(wt(t),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(a)});if(!s.ok)return!1;const r=await s.blob(),i=URL.createObjectURL(r),l=document.createElement("a");return l.href=i,l.download=o,document.body.appendChild(l),l.click(),l.remove(),setTimeout(()=>URL.revokeObjectURL(i),6e4),!0}function le(t,a){return t.data&&t.data.error||a||n("error.generic")}async function gl(t){var a;try{if((a=navigator.clipboard)!=null&&a.writeText)return await navigator.clipboard.writeText(t),!0}catch{}try{const o=document.createElement("textarea");o.value=t,o.setAttribute("readonly",""),o.style.position="fixed",o.style.top="-1000px",o.style.opacity="0",document.body.appendChild(o),o.select(),o.setSelectionRange(0,o.value.length);const s=document.execCommand("copy");return o.remove(),s}catch{return!1}}function Br(t,a){const o=t.length,s=a.length;if(!o)return s;if(!s)return o;const r=Array.from({length:o+1},(i,l)=>l);for(let i=1;i<=s;i++){let l=r[0];r[0]=i;for(let h=1;h<=o;h++){const d=r[h];r[h]=t[h-1]===a[i-1]?l:1+Math.min(l,r[h],r[h-1]),l=d}}return r[o]}function Fr(t){return(t||"").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g,"").normalize("NFC").trim()}function wh(t){return t<3?0:t<=5?1:2}function gn(t){return(t==null?void 0:t.season)==null?"":t.episode==null?`S${t.season}`:`S${t.season}E${t.episode}`}function dn(t){const a=Number(t==null?void 0:t.chapter_no)||0,o=((t==null?void 0:t.chapter)||"").trim();return a?o?`${a} · ${o}`:String(a):o}function Os(t){const a=dn(t);return a?Number(t==null?void 0:t.chapter_no)?`CH. ${a}`:a:""}function vh(t=new Date){const a=t.getHours();return a<5?"latenight":a<8?"dawn":a<12?"morning":a<17?"afternoon":a<21?"evening":"night"}function kh(t=new Date){const a=t.getDay();return a===0||a===6}function xh(){try{return Intl.DateTimeFormat().resolvedOptions().timeZone||""}catch{return""}}const jh=new Map([["Asia/Dubai","AE"],["America/Buenos_Aires","AR"],["Europe/Vienna","AT"],["Antarctica/Macquarie","AU"],["Asia/Dhaka","BD"],["Asia/Dacca","BD"],["Europe/Brussels","BE"],["America/Sao_Paulo","BR"],["America/Bahia","BR"],["America/Fortaleza","BR"],["America/Recife","BR"],["America/Maceio","BR"],["America/Araguaina","BR"],["America/Belem","BR"],["America/Santarem","BR"],["America/Noronha","BR"],["America/Manaus","BR"],["America/Cuiaba","BR"],["America/Campo_Grande","BR"],["America/Porto_Velho","BR"],["America/Boa_Vista","BR"],["America/Rio_Branco","BR"],["America/Eirunepe","BR"],["Asia/Thimphu","BT"],["Asia/Thimbu","BT"],["America/Toronto","CA"],["America/Vancouver","CA"],["America/Edmonton","CA"],["America/Winnipeg","CA"],["America/Halifax","CA"],["America/St_Johns","CA"],["America/Regina","CA"],["America/Moncton","CA"],["America/Goose_Bay","CA"],["America/Glace_Bay","CA"],["America/Blanc-Sablon","CA"],["America/Whitehorse","CA"],["America/Dawson","CA"],["America/Iqaluit","CA"],["America/Resolute","CA"],["America/Rankin_Inlet","CA"],["America/Cambridge_Bay","CA"],["America/Inuvik","CA"],["America/Fort_Nelson","CA"],["America/Dawson_Creek","CA"],["America/Creston","CA"],["America/Swift_Current","CA"],["America/Atikokan","CA"],["Europe/Zurich","CH"],["America/Santiago","CL"],["America/Punta_Arenas","CL"],["Pacific/Easter","CL"],["Asia/Shanghai","CN"],["Asia/Urumqi","CN"],["Asia/Chongqing","CN"],["Asia/Harbin","CN"],["Asia/Kashgar","CN"],["America/Bogota","CO"],["Europe/Prague","CZ"],["Europe/Berlin","DE"],["Europe/Busingen","DE"],["Africa/Cairo","EG"],["Europe/Madrid","ES"],["Africa/Ceuta","ES"],["Atlantic/Canary","ES"],["Europe/Helsinki","FI"],["Europe/Mariehamn","FI"],["Europe/Paris","FR"],["Europe/London","GB"],["Europe/Belfast","GB"],["Africa/Accra","GH"],["Europe/Athens","GR"],["Asia/Hong_Kong","HK"],["Europe/Budapest","HU"],["Asia/Jakarta","ID"],["Asia/Pontianak","ID"],["Asia/Makassar","ID"],["Asia/Jayapura","ID"],["Europe/Dublin","IE"],["Asia/Kolkata","IN"],["Asia/Calcutta","IN"],["Europe/Rome","IT"],["Asia/Tokyo","JP"],["Africa/Nairobi","KE"],["Asia/Seoul","KR"],["Asia/Colombo","LK"],["Africa/Casablanca","MA"],["Indian/Maldives","MV"],["America/Mexico_City","MX"],["America/Cancun","MX"],["America/Merida","MX"],["America/Monterrey","MX"],["America/Matamoros","MX"],["America/Chihuahua","MX"],["America/Ciudad_Juarez","MX"],["America/Ojinaga","MX"],["America/Mazatlan","MX"],["America/Bahia_Banderas","MX"],["America/Hermosillo","MX"],["America/Tijuana","MX"],["Asia/Kuala_Lumpur","MY"],["Asia/Kuching","MY"],["Africa/Lagos","NG"],["Europe/Amsterdam","NL"],["Europe/Oslo","NO"],["Arctic/Longyearbyen","NO"],["Pacific/Auckland","NZ"],["Pacific/Chatham","NZ"],["America/Lima","PE"],["Asia/Manila","PH"],["Asia/Karachi","PK"],["Europe/Warsaw","PL"],["Europe/Lisbon","PT"],["Atlantic/Madeira","PT"],["Atlantic/Azores","PT"],["Europe/Bucharest","RO"],["Asia/Riyadh","SA"],["Europe/Stockholm","SE"],["Asia/Singapore","SG"],["Asia/Bangkok","TH"],["Europe/Istanbul","TR"],["Asia/Istanbul","TR"],["Asia/Taipei","TW"],["Europe/Kyiv","UA"],["Europe/Simferopol","UA"],["Europe/Uzhgorod","UA"],["Europe/Zaporozhye","UA"],["America/New_York","US"],["America/Chicago","US"],["America/Denver","US"],["America/Los_Angeles","US"],["America/Anchorage","US"],["America/Phoenix","US"],["America/Detroit","US"],["America/Boise","US"],["America/Juneau","US"],["America/Sitka","US"],["America/Nome","US"],["America/Yakutat","US"],["America/Metlakatla","US"],["America/Menominee","US"],["America/Adak","US"],["Pacific/Honolulu","US"],["America/Montevideo","UY"],["America/Caracas","VE"],["Asia/Ho_Chi_Minh","VN"],["Asia/Saigon","VN"],["Africa/Johannesburg","ZA"]]),Sh=[["Australia/","AU"],["America/Argentina/","AR"],["America/Indiana/","US"],["America/Kentucky/","US"],["America/North_Dakota/","US"]];function bl(t=xh()){const a=jh.get(t);if(a)return a;for(const[o,s]of Sh)if(t.startsWith(o))return s;return""}const Nh=[{md:"01-25",regions:["EG"],greetings:["greeting.holiday.eg.01-25.1"]},{md:"01-26",regions:["AU"],greetings:["greeting.holiday.au.01-26.1"]},{md:"01-26",regions:["IN"],greetings:["greeting.holiday.in.01-26.1"]},{md:"02-04",regions:["LK"],greetings:["greeting.holiday.lk.02-04.1"]},{md:"02-06",regions:["NZ"],greetings:["greeting.holiday.nz.02-06.1"]},{md:"02-11",regions:["JP"],greetings:["greeting.holiday.jp.02-11.1"]},{md:"02-21",regions:["BD"],greetings:["greeting.holiday.bd.02-21.1","greeting.holiday.bd.02-21.2"]},{md:"02-22",regions:["SA"],greetings:["greeting.holiday.sa.02-22.1"]},{md:"03-01",regions:["KR"],greetings:["greeting.holiday.kr.03-01.1"]},{md:"03-06",regions:["GH"],greetings:["greeting.holiday.gh.03-06.1"]},{md:"03-15",regions:["HU"],greetings:["greeting.holiday.hu.03-15.1"]},{md:"03-17",regions:["IE"],greetings:["greeting.holiday.ie.03-17.1"]},{md:"03-23",regions:["PK"],greetings:["greeting.holiday.pk.03-23.1"]},{md:"03-25",regions:["GR"],greetings:["greeting.holiday.gr.03-25.1"]},{md:"03-26",regions:["BD"],greetings:["greeting.holiday.bd.03-26.1"]},{md:"04-13",regions:["TH"],greetings:["greeting.holiday.th.04-13.1"]},{md:"04-14",regions:["IN","BD"],greetings:["greeting.holiday.in.04-14.1","greeting.holiday.in.04-14.2"]},{md:"04-15",regions:["IN"],greetings:["greeting.holiday.in.04-15.1","greeting.holiday.in.04-15.2"]},{md:"04-19",regions:["VE"],greetings:["greeting.holiday.ve.04-19.1"]},{md:"04-23",regions:["TR"],greetings:["greeting.holiday.tr.04-23.1"]},{md:"04-25",regions:["AU","NZ"],greetings:["greeting.holiday.au.04-25.1"]},{md:"04-25",regions:["IT"],greetings:["greeting.holiday.it.04-25.1"]},{md:"04-25",regions:["EG"],greetings:["greeting.holiday.eg.04-25.1"]},{md:"04-27",regions:["ZA"],greetings:["greeting.holiday.za.04-27.1"]},{md:"04-30",regions:["VN"],greetings:["greeting.holiday.vn.04-30.1"]},{md:"05-03",regions:["PL"],greetings:["greeting.holiday.pl.05-03.1"]},{md:"05-03",regions:["JP"],greetings:["greeting.holiday.jp.05-03.1"]},{md:"05-05",regions:["NL"],greetings:["greeting.holiday.nl.05-05.1"]},{md:"05-05",regions:["JP"],greetings:["greeting.holiday.jp.05-05.1"]},{md:"05-17",regions:["NO"],greetings:["greeting.holiday.no.05-17.1"]},{md:"05-25",regions:["AR"],greetings:["greeting.holiday.ar.05-25.1"]},{md:"06-01",regions:["KE"],greetings:["greeting.holiday.ke.06-01.1"]},{md:"06-01",regions:["ID"],greetings:["greeting.holiday.id.06-01.1"]},{md:"06-02",regions:["IT"],greetings:["greeting.holiday.it.06-02.1"]},{md:"06-06",regions:["SE"],greetings:["greeting.holiday.se.06-06.1"]},{md:"06-10",regions:["PT"],greetings:["greeting.holiday.pt.06-10.1"]},{md:"06-12",regions:["PH"],greetings:["greeting.holiday.ph.06-12.1"]},{md:"06-12",regions:["NG"],greetings:["greeting.holiday.ng.06-12.1"]},{md:"06-16",regions:["ZA"],greetings:["greeting.holiday.za.06-16.1"]},{md:"06-19",regions:["US"],greetings:["greeting.holiday.us.06-19.1"]},{md:"06-28",regions:["UA"],greetings:["greeting.holiday.ua.06-28.1"]},{md:"07-01",regions:["CA"],greetings:["greeting.holiday.ca.07-01.1"]},{md:"07-01",regions:["HK"],greetings:["greeting.holiday.hk.07-01.1"]},{md:"07-04",regions:["US"],greetings:["greeting.holiday.us.07-04.1","greeting.holiday.us.07-04.2"]},{md:"07-05",regions:["VE"],greetings:["greeting.holiday.ve.07-05.1"]},{md:"07-09",regions:["AR"],greetings:["greeting.holiday.ar.07-09.1"]},{md:"07-14",regions:["FR"],greetings:["greeting.holiday.fr.07-14.1"]},{md:"07-18",regions:["UY"],greetings:["greeting.holiday.uy.07-18.1"]},{md:"07-20",regions:["CO"],greetings:["greeting.holiday.co.07-20.1"]},{md:"07-21",regions:["BE"],greetings:["greeting.holiday.be.07-21.1"]},{md:"07-23",regions:["EG"],greetings:["greeting.holiday.eg.07-23.1"]},{md:"07-24",regions:["VE"],greetings:["greeting.holiday.ve.07-24.1"]},{md:"07-26",regions:["MV"],greetings:["greeting.holiday.mv.07-26.1"]},{md:"07-28",regions:["PE"],greetings:["greeting.holiday.pe.07-28.1"]},{md:"07-29",regions:["PE"],greetings:["greeting.holiday.pe.07-29.1"]},{md:"08-01",regions:["CH"],greetings:["greeting.holiday.ch.08-01.1"]},{md:"08-07",regions:["CO"],greetings:["greeting.holiday.co.08-07.1"]},{md:"08-09",regions:["SG"],greetings:["greeting.holiday.sg.08-09.1"]},{md:"08-14",regions:["PK"],greetings:["greeting.holiday.pk.08-14.1"]},{md:"08-15",regions:["KR"],greetings:["greeting.holiday.kr.08-15.1"]},{md:"08-15",regions:["IN"],greetings:["greeting.holiday.in.08-15.1"]},{md:"08-17",regions:["ID"],greetings:["greeting.holiday.id.08-17.1"]},{md:"08-20",regions:["HU"],greetings:["greeting.holiday.hu.08-20.1"]},{md:"08-24",regions:["UA"],greetings:["greeting.holiday.ua.08-24.1"]},{md:"08-25",regions:["UY"],greetings:["greeting.holiday.uy.08-25.1"]},{md:"08-30",regions:["TR"],greetings:["greeting.holiday.tr.08-30.1"]},{md:"08-31",regions:["MY"],greetings:["greeting.holiday.my.08-31.1"]},{md:"09-02",regions:["VN"],greetings:["greeting.holiday.vn.09-02.1"]},{md:"09-07",regions:["BR"],greetings:["greeting.holiday.br.09-07.1"]},{md:"09-16",regions:["MX"],greetings:["greeting.holiday.mx.09-16.1"]},{md:"09-16",regions:["MY"],greetings:["greeting.holiday.my.09-16.1"]},{md:"09-18",regions:["CL"],greetings:["greeting.holiday.cl.09-18.1"]},{md:"09-19",regions:["CL"],greetings:["greeting.holiday.cl.09-19.1"]},{md:"09-21",regions:["GH"],greetings:["greeting.holiday.gh.09-21.1"]},{md:"09-23",regions:["SA"],greetings:["greeting.holiday.sa.09-23.1"]},{md:"09-24",regions:["ZA"],greetings:["greeting.holiday.za.09-24.1"]},{md:"09-28",regions:["CZ"],greetings:["greeting.holiday.cz.09-28.1"]},{md:"09-30",regions:["CA"],greetings:["greeting.holiday.ca.09-30.1"]},{md:"10-01",regions:["NG"],greetings:["greeting.holiday.ng.10-01.1"]},{md:"10-01",regions:["CN","HK"],greetings:["greeting.holiday.cn.10-01.1"]},{md:"10-02",regions:["IN"],greetings:["greeting.holiday.in.10-02.1"]},{md:"10-03",regions:["KR"],greetings:["greeting.holiday.kr.10-03.1"]},{md:"10-03",regions:["DE"],greetings:["greeting.holiday.de.10-03.1"]},{md:"10-05",regions:["PT"],greetings:["greeting.holiday.pt.10-05.1"]},{md:"10-10",regions:["TW"],greetings:["greeting.holiday.tw.10-10.1"]},{md:"10-12",regions:["ES"],greetings:["greeting.holiday.es.10-12.1"]},{md:"10-20",regions:["KE"],greetings:["greeting.holiday.ke.10-20.1"]},{md:"10-23",regions:["HU"],greetings:["greeting.holiday.hu.10-23.1"]},{md:"10-26",regions:["AT"],greetings:["greeting.holiday.at.10-26.1"]},{md:"10-28",regions:["CZ"],greetings:["greeting.holiday.cz.10-28.1"]},{md:"10-28",regions:["GR"],greetings:["greeting.holiday.gr.10-28.1"]},{md:"10-29",regions:["TR"],greetings:["greeting.holiday.tr.10-29.1"]},{md:"11-02",regions:["MX"],greetings:["greeting.holiday.mx.11-02.1"]},{md:"11-03",regions:["MV"],greetings:["greeting.holiday.mv.11-03.1"]},{md:"11-05",regions:["GB"],greetings:["greeting.holiday.gb.11-05.1"]},{md:"11-06",regions:["MA"],greetings:["greeting.holiday.ma.11-06.1"]},{md:"11-11",regions:["FR"],greetings:["greeting.holiday.fr.11-11.1"]},{md:"11-11",regions:["PL"],greetings:["greeting.holiday.pl.11-11.1"]},{md:"11-11",regions:["AU","CA","GB"],greetings:["greeting.holiday.au.11-11.1"]},{md:"11-11",regions:["MV"],greetings:["greeting.holiday.mv.11-11.1"]},{md:"11-11",regions:["US"],greetings:["greeting.holiday.us.11-11.1"]},{md:"11-15",regions:["BR"],greetings:["greeting.holiday.br.11-15.1"]},{md:"11-18",regions:["MA"],greetings:["greeting.holiday.ma.11-18.1"]},{md:"12-01",regions:["RO"],greetings:["greeting.holiday.ro.12-01.1"]},{md:"12-01",regions:["PT"],greetings:["greeting.holiday.pt.12-01.1"]},{md:"12-02",regions:["AE"],greetings:["greeting.holiday.ae.12-02.1"]},{md:"12-05",regions:["TH"],greetings:["greeting.holiday.th.12-05.1"]},{md:"12-06",regions:["ES"],greetings:["greeting.holiday.es.12-06.1"]},{md:"12-06",regions:["FI"],greetings:["greeting.holiday.fi.12-06.1"]},{md:"12-12",regions:["KE"],greetings:["greeting.holiday.ke.12-12.1"]},{md:"12-16",regions:["BD"],greetings:["greeting.holiday.bd.12-16.1"]},{md:"12-17",regions:["BT"],greetings:["greeting.holiday.bt.12-17.1"]},{md:"12-25",regions:["PK"],greetings:["greeting.holiday.pk.12-25.1"]}],Th=[{md:"01-01",greetings:["greeting.holiday.intl.01-01.1","greeting.holiday.intl.01-01.2","greeting.holiday.intl.01-01.3"]},{md:"02-14",greetings:["greeting.holiday.intl.02-14.1","greeting.holiday.intl.02-14.2"]},{md:"04-23",greetings:["greeting.holiday.intl.04-23.1","greeting.holiday.intl.04-23.2"]},{md:"10-31",greetings:["greeting.holiday.intl.10-31.1","greeting.holiday.intl.10-31.2"]},{md:"12-24",greetings:["greeting.holiday.intl.12-24.1"]},{md:"12-25",greetings:["greeting.holiday.intl.12-25.1","greeting.holiday.intl.12-25.2"]},{md:"12-31",greetings:["greeting.holiday.intl.12-31.1","greeting.holiday.intl.12-31.2"]}];function Eh(t){const a=t%19,o=Math.floor(t/100),s=t%100,r=Math.floor(o/4),i=o%4,l=Math.floor((o+8)/25),h=Math.floor((o-l+1)/3),d=(19*a+o-r-h+15)%30,m=Math.floor(s/4),p=s%4,u=(32+2*i+2*m-d-p)%7,f=Math.floor((a+11*d+22*u)/451),b=Math.floor((d+u-7*f+114)/31),y=(d+u-7*f+114)%31+1;return new Date(t,b-1,y)}function Hr(t,a,o,s){const r=new Date(t,a,1),i=(o-r.getDay()+7)%7;return new Date(t,a,1+i+(s-1)*7)}const Ia=(t,a)=>t.getFullYear()===a.getFullYear()&&t.getMonth()===a.getMonth()&&t.getDate()===a.getDate(),zr=t=>String(t).padStart(2,"0");function Ch(t=new Date,a=bl()){const o=`${zr(t.getMonth()+1)}-${zr(t.getDate())}`;if(a){for(const i of Nh)if(i.md===o&&i.regions.includes(a))return i.greetings}for(const i of Th)if(i.md===o)return i.greetings;const s=Eh(t.getFullYear());if(Ia(t,s))return["greeting.holiday.easter"];const r=new Date(s);return r.setDate(s.getDate()-2),Ia(t,r)?["greeting.holiday.good-friday"]:a==="US"&&Ia(t,Hr(t.getFullYear(),10,4,4))?["greeting.holiday.thanksgiving.us"]:a==="CA"&&Ia(t,Hr(t.getFullYear(),9,1,2))?["greeting.holiday.thanksgiving.ca"]:null}const $r={latenight:["greeting.bucket.latenight.1","greeting.bucket.latenight.2","greeting.bucket.latenight.3","greeting.bucket.latenight.4","greeting.bucket.latenight.5"],dawn:["greeting.bucket.dawn.1","greeting.bucket.dawn.2","greeting.bucket.dawn.3","greeting.bucket.dawn.4"],morning:["greeting.bucket.morning.1","greeting.bucket.morning.2","greeting.bucket.morning.3","greeting.bucket.morning.4","greeting.bucket.morning.5"],afternoon:["greeting.bucket.afternoon.1","greeting.bucket.afternoon.2","greeting.bucket.afternoon.3","greeting.bucket.afternoon.4"],evening:["greeting.bucket.evening.1","greeting.bucket.evening.2","greeting.bucket.evening.3","greeting.bucket.evening.4"],night:["greeting.bucket.night.1","greeting.bucket.night.2","greeting.bucket.night.3","greeting.bucket.night.4"]},Ah={dawn:["greeting.weekend.dawn.1","greeting.weekend.dawn.2"],morning:["greeting.weekend.morning.1","greeting.weekend.morning.2","greeting.weekend.morning.3","greeting.weekend.morning.4"],afternoon:["greeting.weekend.afternoon.1","greeting.weekend.afternoon.2","greeting.weekend.afternoon.3"],evening:["greeting.weekend.evening.1","greeting.weekend.evening.2","greeting.weekend.evening.3"],night:["greeting.weekend.night.1","greeting.weekend.night.2"]},qh=["greeting.sunday.1","greeting.sunday.2","greeting.sunday.3"],Mh=t=>t[Math.floor(Math.random()*t.length)];function Oh(t,a=new Date,o=bl()){const s=(t||"").trim()||n("greeting.name-fallback"),r=vh(a);let i=$r[r]||$r.morning;const l=Ch(a,o);if(l)i=l;else if(kh(a)&&r!=="latenight"){const h=a.getDay()===0&&r==="morning"?qh:Ah[r];h!=null&&h.length&&(i=h)}return n(Mh(i),{name:s})}function Lh(t=new Date){const a=t.toLocaleDateString(void 0,{weekday:"long"}),o=t.toLocaleDateString(void 0,{month:"long",day:"numeric",year:"numeric"});return n("greeting.dateline.format",{weekday:a,date:o})}const oo={terracotta:"#B4482D",ochre:"#C8992B",olive:"#3F7D5A",slate:"#2F6D8F"},Ls={light:{bg:"#F4EDDE",raised:"#FBF6EA",card:"#FFFEF9","card-top":"#FFFFFC","card-bottom":"#FCF8ED","topbar-top":"#F3EBDB","topbar-bottom":"#EDE3D1",ink:"#221C16",soft:"#6A5F50",faint:"#8A7C68",line:"#E4DAC7","ink-border":"rgba(41,38,29,.6)","frame-border":"rgba(41,38,29,.35)",amber:"#BE8A4E",note:"#221C16",error:"#A93B26",ok:"#3E8E5A",strip:"#E9E1CC",holes:"#F7F2E6","holes-border":"#D3C7AB","holes-glow":"none",sh:"41,38,29","bevel-hi":"rgba(255,255,255,.75)","bevel-mid":"rgba(255,255,255,.35)"},dark:{bg:"#262019",raised:"#2A231C",card:"#2F2820","card-top":"#352D23","card-bottom":"#2C251E","topbar-top":"#2B241C","topbar-bottom":"#241E17",ink:"#EFE6D4",soft:"#B3A48C",faint:"#9A8C74",line:"#453B2D","ink-border":"rgba(239,230,212,.4)","frame-border":"rgba(214,162,92,.3)",amber:"#D6A25C",note:"#E8DCC2",error:"#C96B5B",ok:"#5FB47E",strip:"#1C1710",holes:"rgba(239,230,212,.4)","holes-border":"transparent","holes-glow":"none",sh:"0,0,0","bevel-hi":"rgba(255,255,255,.07)","bevel-mid":"rgba(255,255,255,.05)"}},Kt={flat:["flat",0,0,0],paper:["paper",220,71,.1],linen:["linen",340,109,.11],cotton:["cotton",300,97,.12],canvas:["canvas",400,129,.1],denim:["denim",320,103,.12],wool:["wool",360,113,.12],wood:["wood",300,97,.12],metal:["metal",260,84,.09],brushed:["brushed",240,78,.08],matte:["matte",200,65,.07],satin:["satin",210,68,.07],glass:["glass",280,90,.06],"glass-soft":["glass-soft",280,90,.12],rubber:["rubber-flat",230,74,.1],fabric:["fabric",260,84,.11],walnut:["walnut",300,97,.09],pine:["pine",340,109,.09],marble:["marble",360,116,.08],granite:["granite",280,90,.08],sandstone:["sandstone",300,97,.09],concrete:["concrete",320,103,.08],cardboard:["cardboard",280,90,.1],"paper-photo":["paper-photo",300,97,.07],leather:["leather-004",260,84,.1],"leather-suede":["leather-021",240,78,.11],"leather-pebbled":["leather-034d",280,90,.09],"leather-tooled":["leather-037",320,103,.06]},Et={manuscript:["linen","paper","paper","wood"],"film-assembly":["metal","brushed","matte","glass"],office:["glass","rubber","satin","metal"],school:["wood","rubber","paper","cotton"],atelier:["canvas","denim","cotton","wool"],bindery:["concrete","leather-suede","paper-photo","leather-pebbled"],quarry:["sandstone","granite","satin","marble"],atrium:["flat","flat","flat","flat"]},Fn="manuscript",_h={manuscript:"settings.material.manuscript.label","film-assembly":"settings.material.film-assembly.label",office:"settings.material.office.label",school:"settings.material.school.label",atelier:"settings.material.atelier.label",bindery:"settings.material.bindery.label",quarry:"settings.material.quarry.label",atrium:"settings.material.atrium.label"},Rh=new Set(["glass","glass-soft"]),Dh=new Set(["flat"]),Ih=new Set(["metal","brushed"]);function yl(t,a){return`color-mix(in srgb, ${t} ${((1-a)*100).toFixed(1)}%, transparent)`}function Ph(t,a,o,s,r,i){const l=yl(t,r),h=i?.16:.55,d=i?.04:.12;return{color:`color-mix(in srgb, ${t} ${i?34:24}%, transparent)`,image:`linear-gradient(124deg, rgba(255,255,255,${h}) 0%, rgba(255,255,255,0) 34%, rgba(255,255,255,0) 64%, rgba(255,255,255,${d}) 100%), linear-gradient(${l}, ${l}), var(--tile-${a}), var(--tile-${a})`,size:`auto, auto, ${o}px ${o}px, ${s}px ${s}px`,blend:"normal, normal, overlay, normal",blur:"blur(18px) saturate(1.5)",border:i?"rgba(255,255,255,.15)":"rgba(255,255,255,.6)",inset:`inset 0 1px 0 ${i?"rgba(255,255,255,.1)":"rgba(255,255,255,.7)"}, inset 0 -10px 16px -12px rgba(255,255,255,${i?.06:.3})`}}function wl(t,a,o,s){const[r,i,l,h]=Kt[a]||Kt.paper;if(Dh.has(r))return{color:t,image:"none",size:"auto",blend:"normal",blur:"none",border:"transparent",inset:"none"};if(Rh.has(r))return Ph(t,r,i,l,h,o);const d=yl(t,h),m=[],p=[],u=[];return Ih.has(r)&&(m.push(`linear-gradient(126deg, color-mix(in oklab, ${s}, transparent 84%) 0%, transparent 40%, transparent 60%, color-mix(in oklab, ${s}, transparent 90%) 100%)`),p.push("auto"),u.push("soft-light")),m.push(`linear-gradient(${d}, ${d})`,`var(--tile-${r})`,`var(--tile-${r})`),p.push("auto",`${i}px ${i}px`,`${l}px ${l}px`),u.push("normal","overlay","normal"),{color:t,image:m.join(", "),size:p.join(", "),blend:u.join(", "),blur:"none",border:"transparent",inset:"none"}}const vl={ground:"bg",shell:"topbar-top",card:"card",cover:"raised"},da=["ground","shell","card","cover"];Object.keys(Kt).filter(t=>t!=="flat");function Bh(t){var o;if(typeof getComputedStyle!="function"||typeof document>"u")return"";const a=getComputedStyle(document.documentElement).getPropertyValue(`--tile-${t}`).trim();return((o=/url\((['"]?)([^)'"]+)\1\)/.exec(a))==null?void 0:o[2])||""}function kl(t,a,o){const s=Et[t]||Et[Fn],r=da.indexOf(a),i=Kt[o]?o:s[r<0?2:r],[l,h,d,m]=Kt[i];return{name:i,file:l,coarse:h,fine:d,strength:m,url:Bh(l)}}function bw(t,a,o,s,r){const i=Et[t]||Et[Fn],l=Ls[o?"dark":"light"],h=s||oo.terracotta,d=xl(h)>.32,m=o&&!d?`color-mix(in oklab, ${h}, white 20%)`:h,p=da.indexOf(a),u=wl(l[vl[a]||"card"],i[p<0?2:p],o,m);return{backgroundColor:u.color,backgroundImage:u.image,backgroundSize:u.size,backgroundBlendMode:u.blend,backdropFilter:u.blur==="none"?void 0:u.blur,boxShadow:u.inset==="none"?void 0:u.inset}}function xl(t){const a=/^#?([0-9a-f]{6})$/i.exec(t||"");if(!a)return .3;const o=parseInt(a[1],16),s=[o>>16&255,o>>8&255,o&255].map(r=>{const i=r/255;return i<=.04045?i/12.92:((i+.055)/1.055)**2.4});return .2126*s[0]+.7152*s[1]+.0722*s[2]}let ht={materialSet:void 0,theme:"system",accent:"terracotta"};const jl=window.matchMedia("(prefers-color-scheme: dark)");jl.addEventListener("change",()=>{ht.theme!=="light"&&ht.theme!=="dark"&&Tl()});const Fh="tippani:labels";let sa="auto";const Sl=window.matchMedia("(max-width: 768px)");Sl.addEventListener("change",Nl);function Hh(t){let a=t;if(a===void 0)try{a=JSON.parse(localStorage.getItem(Fh))}catch{a=null}sa=a==="on"||a==="off"?a:"auto",Nl()}function Nl(){const t=sa==="auto"?!Sl.matches:sa==="on";document.documentElement.dataset.labels=t?"on":"off",document.documentElement.dataset.labelsMode=sa}function yw(){return sa}function So(t={}){const{materialSet:a,theme:o,accent:s}=t;ht={materialSet:a,theme:o||"system",accent:s||"terracotta",tiles:da.map(r=>{const i=t["tile"+r[0].toUpperCase()+r.slice(1)];return Kt[i]?i:""})},Tl()}function ww(){const a=document.documentElement.dataset.matSet;return{materialSet:Et[a]?a:Fn,theme:ht.theme||"system",accent:ht.accent||"terracotta",tiles:(ht.tiles||["","","",""]).slice()}}function zh(t,a){const o=Ls[t?"dark":"light"];return{dark:!!t,bg:o.bg,cardTop:o["card-top"],cardBottom:o["card-bottom"],ink:o.ink,soft:o.soft,faint:o.faint,line:o.line,accent:a||oo.terracotta,inkBorder:o["ink-border"]}}function Tl(){const t=ht.theme==="dark"||ht.theme!=="light"&&jl.matches,a=Et[ht.materialSet]?ht.materialSet:Fn,o=document.documentElement;o.dataset.matSet=a,o.dataset.theme=t?"dark":"light";const s=Ls[t?"dark":"light"];for(const[m,p]of Object.entries(s))o.style.setProperty("--"+m,p);const r=oo[ht.accent]||oo.terracotta,i=xl(r)>.32,l=t&&!i?`color-mix(in oklab, ${r}, white 20%)`:r;o.style.setProperty("--accent",r),o.style.setProperty("--accent-dark",`color-mix(in oklab, ${r}, white 20%)`),o.style.setProperty("--accent-ui",l),o.style.setProperty("--on-accent",i?"#221C16":"#FBF6EA");const h=Et[a].map((m,p)=>(ht.tiles||[])[p]||m);for(const[m,p]of da.entries()){const u=wl(s[vl[p]],h[m],t,l);for(const[f,b]of Object.entries(u))o.style.setProperty(`--surf-${p}-${f}`,b);o.style.setProperty(`--tile-${p}`,`var(--tile-${Kt[h[m]][0]})`)}const d=h[da.indexOf("shell")];o.style.setProperty("--sel-veil",`${((1-Kt[d][3])*100).toFixed(1)}%`),window.dispatchEvent(new CustomEvent("tippani:theme",{detail:{materialSet:a,dark:t}}))}const xt=["yellow","blue","pink","orange","green","purple"],No=["#E5C355","#7FA6C9","#D98CA6","#DF9A5B","#7CB342","#8A7BC8"],so=["","vocab.category.blue.label","vocab.category.pink.label","vocab.category.orange.label","vocab.category.green.label","vocab.category.purple.label"],$h="vocab.category.unset.label",vw=[["#E5C355","vocab.swatch.sun.label"],["#DF9A5B","vocab.swatch.amber.label"],["#D98CA6","vocab.swatch.rose.label"],["#E8A0C0","vocab.swatch.blush.label"],["#C2555F","vocab.swatch.crimson.label"],["#A8739E","vocab.swatch.mauve.label"],["#8A7BC8","vocab.swatch.violet.label"],["#6E8FD0","vocab.swatch.periwinkle.label"],["#7FA6C9","vocab.swatch.sky.label"],["#5AA8B5","vocab.swatch.teal.label"],["#6FBF9F","vocab.swatch.mint.label"],["#4FA98A","vocab.swatch.jade.label"],["#7CB342","vocab.swatch.leaf.label"],["#B5C05A","vocab.swatch.moss.label"],["#B0806B","vocab.swatch.clay.label"],["#8C7F6E","vocab.swatch.stone.label"]],Wr=15;function Wh(t){const a=String(t||""),o=[...a];return o.length<=Wr?a:o.slice(0,Wr).join("")}let ro=xt.map(()=>""),ha=[...No],_s=xt.map(()=>!1);function El(t={}){for(let a=0;a<xt.length;a++){const o=a+1,s=String(t["catName"+o]||""),r=String(t["catColor"+o]||"");ro[a]=o===1?"":Wh(s),_s[a]=o===1?!1:!!t["catHidden"+o],ha[a]=/^#[0-9a-f]{6}$/i.test(r)?r:No[a],document.documentElement.style.setProperty("--hl-"+o,ha[a])}}function Mn(t){const a=xt.indexOf(t);return a<0?t:ro[a]?ro[a]:a===0?n($h):so[a]?n(so[a]):t[0].toUpperCase()+t.slice(1)}function bn(t){const a=xt.indexOf(t);return a<0?null:"var(--hl-"+(a+1)+")"}function Uh(t){const a=xt.indexOf(t);return a<0?null:ha[a]}function Gh(t){const a=xt.indexOf(t);return a>-1&&!!_s[a]}function kw(){return xt.map((t,a)=>({token:t,slot:a+1,name:ro[a],label:Mn(t),defaultName:so[a]?n(so[a]):t[0].toUpperCase()+t.slice(1),hex:ha[a],custom:ha[a].toLowerCase()!==No[a].toLowerCase(),hidden:_s[a],fixed:a===0}))}const Pa=72,Kh=["long-press","swipe-left","swipe-right","swipe-up","swipe-down","pinch-in","pinch-out","two-finger-left","two-finger-right","two-finger-up","two-finger-down"],Vh={"long-press":"vocab.gesture.long-press.label","swipe-left":"vocab.gesture.swipe-left.label","swipe-right":"vocab.gesture.swipe-right.label","swipe-up":"vocab.gesture.swipe-up.label","swipe-down":"vocab.gesture.swipe-down.label","pinch-in":"vocab.gesture.pinch-in.label","pinch-out":"vocab.gesture.pinch-out.label","two-finger-left":"vocab.gesture.two-finger-left.label","two-finger-right":"vocab.gesture.two-finger-right.label","two-finger-up":"vocab.gesture.two-finger-up.label","two-finger-down":"vocab.gesture.two-finger-down.label"},Ur={left:[-1,0],right:[1,0],up:[0,-1],down:[0,1]},Yh=t=>{if(t==="pinch-in")return[1,0];if(t==="pinch-out")return[-1,0];const a=t.replace("swipe-","").replace("two-finger-","");return Ur[a]||Ur.right};function rs({kind:t,size:a=68,className:o=""}){if(!Kh.includes(t))return null;const s=n(Vh[t]),r=t.startsWith("two-finger"),i=t.startsWith("pinch"),l=t.startsWith("swipe")||r,[h,d]=Yh(t);return e.jsxs("svg",{className:`gesture ${o}`,viewBox:`0 0 ${Pa} ${Pa}`,width:a,height:a,role:"img","aria-label":s,style:{"--gd":`${h}`,"--gdy":`${d}`},children:[e.jsx("rect",{x:"8",y:"8",width:Pa-16,height:Pa-16,rx:"10",fill:"none",stroke:"currentColor",strokeWidth:"1.5",opacity:"0.22"}),l&&e.jsx("line",{x1:36-h*16,y1:36-d*16,x2:36+h*16,y2:36+d*16,stroke:"currentColor",strokeWidth:"1.5",strokeDasharray:"3 3",opacity:"0.35"}),t==="long-press"&&e.jsx("circle",{className:"g-ring",cx:"36",cy:"36",r:"18",fill:"none",stroke:"currentColor",strokeWidth:"2"}),i||r?e.jsxs(e.Fragment,{children:[e.jsx("circle",{className:`g-tip g-a ${i?"g-pinch":"g-move"}`,cx:"24",cy:"36",r:"7",fill:"currentColor"}),e.jsx("circle",{className:`g-tip g-b ${i?"g-pinch":"g-move"}`,cx:"48",cy:"36",r:"7",fill:"currentColor"})]}):e.jsx("circle",{className:`g-tip ${l?"g-move":"g-hold"}`,cx:"36",cy:"36",r:"8",fill:"currentColor"})]})}function Qh(t){return!!t&&t.type===rs}const ra=[{id:"search",keys:["/"],label:"shell.shortcut.search.label",group:"shell.shortcut.group.anywhere.label"},{id:"capture",keys:["n"],label:"shell.shortcut.capture.label",group:"shell.shortcut.group.anywhere.label"},{id:"help",keys:["?"],label:"shell.shortcut.help.label",group:"shell.shortcut.group.anywhere.label"},{id:"go-home",seq:["g","h"],label:"shell.shortcut.go-home.label",group:"shell.shortcut.group.go-to.label"},{id:"go-library",seq:["g","l"],label:"shell.shortcut.go-library.label",group:"shell.shortcut.group.go-to.label"},{id:"go-catalogue",seq:["g","c"],label:"shell.shortcut.go-catalogue.label",group:"shell.shortcut.group.go-to.label"},{id:"go-quotes",seq:["g","q"],label:"shell.shortcut.go-quotes.label",group:"shell.shortcut.group.go-to.label"},{id:"go-anthologies",seq:["g","a"],label:"shell.shortcut.go-anthologies.label",group:"shell.shortcut.group.go-to.label"},{id:"go-stats",seq:["g","s"],label:"shell.shortcut.go-stats.label",group:"shell.shortcut.group.go-to.label"},{id:"go-metadata",seq:["g","m"],label:"shell.shortcut.go-metadata.label",group:"shell.shortcut.group.go-to.label"},{id:"go-profile",seq:["g","p"],label:"shell.shortcut.go-profile.label",group:"shell.shortcut.group.go-to.label"},{id:"go-settings",seq:["g",","],label:"shell.shortcut.go-settings.label",group:"shell.shortcut.group.go-to.label"},{id:"pick-1",ctx:"mcq",keys:["1"],label:"shell.shortcut.pick-1.label",group:"shell.shortcut.group.mcq.label"},{id:"pick-2",ctx:"mcq",keys:["2"],label:"shell.shortcut.pick-2.label",group:"shell.shortcut.group.mcq.label"},{id:"pick-3",ctx:"mcq",keys:["3"],label:"shell.shortcut.pick-3.label",group:"shell.shortcut.group.mcq.label"},{id:"pick-4",ctx:"mcq",keys:["4"],label:"shell.shortcut.pick-4.label",group:"shell.shortcut.group.mcq.label"},{id:"reveal",ctx:"flip",keys:["space"],label:"shell.shortcut.reveal.label",group:"shell.shortcut.group.flip.label"},{id:"grade-forgot",ctx:"flip",keys:["1"],label:"shell.shortcut.grade-forgot.label",group:"shell.shortcut.group.flip.label"},{id:"grade-got",ctx:"flip",keys:["2"],label:"shell.shortcut.grade-got.label",group:"shell.shortcut.group.flip.label"},{id:"focus-blank",ctx:"cloze",keys:["space"],label:"shell.shortcut.focus-blank.label",group:"shell.shortcut.group.cloze.label"}],Xh=new Map(ra.map(t=>[t.id,t])),Cl=(()=>{try{return/mac|iphone|ipad/i.test(navigator.platform||navigator.userAgent||"")}catch{return!1}})();function Gr(t){return t==="mod"?n(Cl?"vocab.key.mod.mac.label":"vocab.key.mod.label"):t==="space"?n("vocab.key.space.label"):t==="esc"?n("vocab.key.esc.label"):t==="shift"?n("vocab.key.shift.label"):t.length===1?t.toUpperCase():t}function Al(t){var o;return t?t.seq?t.seq.map(Gr).join(` ${n("common.kbd.then.label")} `):(((o=t.keys)==null?void 0:o[0])||"").split("+").map(Gr).join(Cl?"":"-"):""}function Ft(t,a=!1){const o=Xh.get(t);if(!o)return"";const s=Al(o);return a&&o.ctx?n("common.shortcut.shifted.label",{key:s}):s}function Jh(t,a,o=!1){const s=Ft(a,o);return s?n("common.shortcut.suffix.label",{name:t,key:s}):t}function Zh(t){var o;const a=[];for(const s of ra){if((o=t==null?void 0:t.has)!=null&&o.call(t,s.id))continue;let r=a.find(i=>i.key===s.group);r||a.push(r={key:s.group,group:n(s.group),items:[]}),r.items.push({id:s.id,label:n(s.label),keys:Al(s),practiceKeys:s.ctx?Ft(s.id,!0):""})}return a}function Kr(t){if(!t)return!1;const a=(t.tagName||"").toLowerCase();return!!(a==="input"||a==="textarea"||a==="select"||t.isContentEditable)}function eu(t){if(!t||!t.key)return"";const a=[];(t.metaKey||t.ctrlKey)&&a.push("mod"),t.altKey&&a.push("alt");let o=t.key;return t.shiftKey&&/^Digit[0-9]$/.test(t.code||"")&&(o=t.code.slice(5)),o===" "?o="space":o==="Escape"?o="esc":o.length===1&&(o=o.toLowerCase()),t.shiftKey&&(o==="space"||/^[0-9]$/.test(o))&&a.push("shift"),a.push(o),a.join("+")}function tu(t,a="",o=null){if(!t)return null;let s=!1;t.startsWith("shift+")&&(s=!0,t=t.slice(6));const r=l=>!l.ctx||l.ctx===o;if(a){const l=ra.find(h=>h.seq&&h.seq[0]===a&&h.seq[1]===t&&r(h));return l?{id:l.id,shift:s}:null}const i=ra.find(l=>{var h;return((h=l.keys)==null?void 0:h.includes(t))&&r(l)});return i?s&&!i.ctx?null:{id:i.id,shift:s}:s?null:ra.some(l=>l.seq&&l.seq[0]===t&&r(l))?{pending:t}:null}const nu=2e3;function ql(t,a={}){const o=typeof a.ctx=="function"?a.ctx:()=>a.ctx||null,s=a.document||(typeof document<"u"?document:null),r=a.window||(typeof window<"u"?window:null);if(!r)return()=>{};let i="",l=0;const h=d=>{if(Kr(d.target)||Kr(s==null?void 0:s.activeElement)||d.altKey)return;const m=eu(d);i&&Date.now()-l>nu&&(i="");const p=tu(m,i,o());if(!p){i="";return}if(p.pending){i=p.pending,l=Date.now(),d.preventDefault();return}i="",d.preventDefault(),t(p.id,{shift:!!p.shift,event:d})};return r.addEventListener("keydown",h),()=>r.removeEventListener("keydown",h)}class Ml extends c.Component{constructor(a){super(a),this.state={error:null}}static getDerivedStateFromError(a){return{error:a}}componentDidCatch(a,o){console.error("tippani render error:",a,o==null?void 0:o.componentStack)}render(){var a;return this.state.error?e.jsxs("div",{role:"alert",style:{maxWidth:560,margin:"0 auto",padding:"48px 20px",textAlign:"center"},children:[e.jsx("p",{className:"display-title",style:{fontSize:"var(--type-ui-22)",marginBottom:8},children:n("shell.error.boundary.title")}),e.jsx("p",{className:"microcopy",style:{marginBottom:16},children:this.props.label?n("shell.error.boundary.named.body",{name:this.props.label}):n("shell.error.boundary.body")}),e.jsx("pre",{style:{textAlign:"left",whiteSpace:"pre-wrap",overflowWrap:"anywhere",fontFamily:"var(--font-mono)",fontSize:"var(--type-mono-12)",color:"var(--error)",background:"var(--raised)",border:"1px solid var(--line)",borderRadius:10,padding:"12px 14px",marginBottom:18},children:String(((a=this.state.error)==null?void 0:a.message)||this.state.error)}),e.jsx("button",{type:"button",className:"tp-btn tp-btn-primary tactile",onClick:()=>window.location.reload(),children:n("common.action.reload.label")})]}):this.props.children}}const Vr=xt;Object.fromEntries(xt.map((t,a)=>[t,No[a]]));const xw=["sticker","banner","flyout","tape","reel"];function Rs(){const t=c.useRef(null);return c.useEffect(()=>{const a=t.current;if(!a)return;if(window.matchMedia("(prefers-reduced-motion: reduce)").matches){a.classList.add("is-in");return}if("IntersectionObserver"in window){const s=new IntersectionObserver(r=>r.forEach(i=>{i.isIntersecting&&(a.classList.add("is-in"),s.disconnect())}),{rootMargin:"0px 0px -8% 0px"});return s.observe(a),()=>s.disconnect()}const o=()=>{a.getBoundingClientRect().top<window.innerHeight-40&&(a.classList.add("is-in"),window.removeEventListener("scroll",o))};return window.addEventListener("scroll",o,{passive:!0}),o(),()=>window.removeEventListener("scroll",o)},[]),t}function au(){const[t,a]=c.useState(()=>document.documentElement.dataset.theme==="dark");return c.useEffect(()=>{const o=s=>a(s.detail.dark);return window.addEventListener("tippani:theme",o),()=>window.removeEventListener("tippani:theme",o)},[]),t}const Ol="(max-width: 768px)";function Ll(){var t;return typeof window<"u"&&((t=window.matchMedia)==null?void 0:t.call(window,Ol).matches)}function _e(){const[t,a]=c.useState(Ll);return c.useEffect(()=>{var r;if(typeof window>"u"||!window.matchMedia)return;const o=window.matchMedia(Ol),s=()=>a(o.matches);return s(),o.addEventListener?(o.addEventListener("change",s),()=>o.removeEventListener("change",s)):((r=o.addListener)==null||r.call(o,s),()=>{var i;return(i=o.removeListener)==null?void 0:i.call(o,s)})},[]),t}const Yr="(prefers-reduced-motion: reduce)";function ou({enabled:t=!0,forceShow:a=!1,resetKey:o=null,threshold:s=12,topZone:r=24}={}){const[i,l]=c.useState(!1),[h,d]=c.useState(()=>{var p;return typeof window<"u"&&!!((p=window.matchMedia)!=null&&p.call(window,Yr).matches)});c.useEffect(()=>{var f;if(typeof window>"u"||!window.matchMedia)return;const p=window.matchMedia(Yr),u=()=>d(p.matches);return u(),p.addEventListener?(p.addEventListener("change",u),()=>p.removeEventListener("change",u)):((f=p.addListener)==null||f.call(p,u),()=>{var b;return(b=p.removeListener)==null?void 0:b.call(p,u)})},[]);const m=t&&!h&&!a;return c.useEffect(()=>{if(!m){l(!1);return}let p=window.scrollY,u=!1;const f=()=>{u=!1;const y=window.scrollY,v=y-p;if(y<=r){p=y,l(!1);return}Math.abs(v)<s||(p=y,l(v>0))},b=()=>{u||(u=!0,window.requestAnimationFrame(f))};return window.addEventListener("scroll",b,{passive:!0}),()=>window.removeEventListener("scroll",b)},[m,s,r]),c.useEffect(()=>{l(!1)},[o]),m?i:!1}const _l=[[1900,5],[1600,4],[1280,3],[640,2]],su=[[1900,5],[1600,4],[1280,3],[860,2]];function To(t){const a=()=>{if(typeof window>"u")return 1;const r=window.innerWidth;for(const[i,l]of t)if(r>=i)return l;return 1},[o,s]=c.useState(a);return c.useEffect(()=>{const r=()=>s(a());return window.addEventListener("resize",r),r(),()=>window.removeEventListener("resize",r)},[]),o}let Qr=0;function At(t){c.useEffect(()=>{if(t)return++Qr===1&&(document.body.style.overflow="hidden"),()=>{--Qr===0&&(document.body.style.overflow="")}},[t])}function ja(t,a){c.useEffect(()=>{if(!t)return;let o=!1;window.history.pushState({...window.history.state,tpOverlay:!0},"");const s=()=>{o=!0,a==null||a()};return window.addEventListener("popstate",s),()=>{var r;window.removeEventListener("popstate",s),!o&&((r=window.history.state)!=null&&r.tpOverlay)&&window.history.back()}},[t])}const Xr=["","hc-r1","hc-r2","hc-r3"];function Xe({variant:t=0,colorBar:a,className:o="",style:s,children:r,...i}){const l=a?{borderLeft:`4px solid ${bn(a)||a}`}:void 0;return e.jsx("div",{className:`hand-card ${Xr[t%Xr.length]} ${o}`,style:l?{...l,...s}:s,...i,children:r})}function bt({pad:t="p-6",className:a="",children:o,...s}){return e.jsx("div",{className:`hand-card ${t} ${a}`.trim(),...s,children:o})}function ru({n:t,onClear:a,children:o}){return t===0?null:e.jsxs("div",{className:"flex flex-wrap items-center gap-2 px-3 py-2",style:{background:"color-mix(in srgb, var(--accent) 8%, transparent)",border:"1px solid color-mix(in srgb, var(--accent) 30%, var(--line))",borderRadius:9},children:[e.jsx($,{style:{color:"var(--accent-ui)"},children:n("common.selection.count",{count:t,n:t})}),o,e.jsx(Ce,{icon:e.jsx(it,{}),ariaLabel:n("common.selection.clear.aria"),onClick:a,wrapClassName:"ml-auto"})]})}function Ds({base:t,className:a="",icon:o,keepLabel:s,onClick:r,children:i,...l}){const{play:h,animClass:d,onAnimationEnd:m}=Il("anim-btn",3);return e.jsx("button",{...l,className:`tp-btn tactile ${t} ${d}${o&&!s?" has-btn-icon":""}${o&&s?" has-fixed-label":""} ${a}`,onClick:p=>{h(),r==null||r(p)},onAnimationEnd:m,children:o?e.jsxs(e.Fragment,{children:[e.jsx("span",{className:"btn-icon",children:o}),e.jsx("span",{className:s?"btn-label-fixed":"btn-label",children:i})]}):i})}function Jt(t){return e.jsx(Ds,{base:"btn-sticker",...t})}function iu(t){return e.jsx(Ds,{base:"btn-film",...t})}function ge(t){return e.jsx(Ds,{base:"tp-btn-ghost",...t})}function $({className:t="",children:a,...o}){return e.jsx("span",{className:"mono-label "+t,...o,children:a})}function Gt({title:t,counts:a,right:o}){return e.jsxs("header",{className:"page-header",children:[e.jsxs("div",{className:"ph-left",children:[e.jsx("h1",{children:t}),a&&e.jsx($,{children:a})]}),o&&e.jsx("div",{className:"flex flex-wrap items-center gap-3",children:o})]})}function xe({label:t,className:a="",nameCase:o=!1,onChange:s,inputRef:r,...i}){return e.jsxs("label",{className:"tp-field "+a,children:[e.jsx($,{children:t}),e.jsx("input",{className:"tp-input",ref:r,autoCapitalize:o?"words":void 0,...i,onChange:s})]})}function Nt({onChange:t,...a}){return e.jsx("input",{className:"tp-input",autoCapitalize:"words",...a,onChange:t})}const ia=["common.month.jan.label","common.month.feb.label","common.month.mar.label","common.month.apr.label","common.month.may.label","common.month.jun.label","common.month.jul.label","common.month.aug.label","common.month.sep.label","common.month.oct.label","common.month.nov.label","common.month.dec.label"];function ua(t){if(!/^\d{4}(-\d{2}(-\d{2})?)?$/.test(t))return!1;const[a,o,s]=t.split("-").map(Number);return!(a<1e3||a>3e3||o!=null&&(o<1||o>12)||s!=null&&(s<1||s>Rl(a,o)))}function sn(t){if(!t)return"";const[a,o,s]=t.split("-").map(Number);return o?s?n("common.date.full.label",{day:s,month:n(ia[o-1]),year:a}):n("common.date.month-year.label",{month:n(ia[o-1]),year:a}):String(a)}function Wt(){const t=new Date,a=o=>String(o).padStart(2,"0");return`${t.getFullYear()}-${a(t.getMonth()+1)}-${a(t.getDate())}`}function Rl(t,a){return new Date(t,a,0).getDate()}function lu({value:t,onPick:a,onClose:o,granularity:s="day"}){const r=/^\d{4}/.test(t||"")?(t||"").split("-").map(Number):[],i=new Date,[l,h]=c.useState(r[0]||i.getFullYear()),[d,m]=c.useState(r[1]||null),[p,u]=c.useState(()=>s==="year"?"year":s==="month"?r[0]?"month":"year":r[1]?"day":r[0]?"month":"year"),[f,b]=c.useState(()=>Math.floor((r[0]||i.getFullYear())/12)*12),y=w=>{a(w),o()},v=(w,k,S,N)=>e.jsx("button",{type:"button",className:`menu-item${k?" active":""}`,style:{justifyContent:"center",padding:"7px 4px",fontSize:"var(--type-ui-13)"},onClick:S,children:w},w),g=(w,k,S,N)=>e.jsxs("div",{className:"mb-1.5 flex items-center gap-1",children:[k&&e.jsx(ye,{label:n("common.date.picker.prev.tip"),children:e.jsx("button",{type:"button",className:"tp-btn tp-btn-ghost",style:{padding:"2px 8px"},onClick:k,"aria-label":n("common.date.picker.prev.aria"),children:"‹"})}),e.jsx(ye,{label:N?n("common.date.picker.up.tip"):null,className:"flex-1",children:e.jsx("button",{type:"button",className:"mono-label",style:{flex:1,background:"none",border:"none",cursor:N?"pointer":"default",padding:"4px 0"},onClick:N||void 0,children:w})}),S&&e.jsx(ye,{label:n("common.date.picker.next.tip"),children:e.jsx("button",{type:"button",className:"tp-btn tp-btn-ghost",style:{padding:"2px 8px"},onClick:S,"aria-label":n("common.date.picker.next.aria"),children:"›"})})]});return e.jsxs("div",{className:"hand-card hc-r2 date-picker",role:"dialog","aria-label":n("common.date.picker.aria"),children:[p==="year"&&e.jsxs(e.Fragment,{children:[g(n("common.date.picker.year-range.title",{a:f,b:f+11}),()=>b(w=>w-12),()=>b(w=>w+12)),e.jsx("div",{className:"date-grid",style:{gridTemplateColumns:"repeat(3, 1fr)"},children:Array.from({length:12},(w,k)=>f+k).map(w=>v(w,w===r[0],()=>{if(h(w),s==="year")return y(String(w));u("month")}))})]}),p==="month"&&e.jsxs(e.Fragment,{children:[g(String(l),()=>h(w=>w-1),()=>h(w=>w+1),()=>u("year")),e.jsx("div",{className:"date-grid",style:{gridTemplateColumns:"repeat(3, 1fr)"},children:ia.map((w,k)=>v(n(w),l===r[0]&&k+1===r[1],()=>{if(m(k+1),s==="month")return y(`${l}-${String(k+1).padStart(2,"0")}`);u("day")}))}),e.jsx("button",{type:"button",className:"date-coarse",onClick:()=>y(String(l)),children:n("common.date.picker.just-year.label",{year:l})})]}),p==="day"&&e.jsxs(e.Fragment,{children:[g(n("common.date.month-year.label",{month:n(ia[(d||1)-1]),year:l}),null,null,()=>u("month")),e.jsx("div",{className:"date-grid",style:{gridTemplateColumns:"repeat(7, 1fr)"},children:Array.from({length:Rl(l,d||1)},(w,k)=>k+1).map(w=>v(w,l===r[0]&&d===r[1]&&w===r[2],()=>y(`${l}-${String(d).padStart(2,"0")}-${String(w).padStart(2,"0")}`)))}),e.jsx("button",{type:"button",className:"date-coarse",onClick:()=>y(`${l}-${String(d||1).padStart(2,"0")}`),children:n("common.date.picker.just-month.label",{month:n(ia[(d||1)-1]),year:l})})]})]})}function ma({label:t,value:a,onChange:o,granularity:s="day",placeholder:r,hint:i,className:l=""}){const[h,d]=c.useState(!1),m=c.useRef(null),{popRef:p,style:u}=qt(h,m,{minHeight:240});Mt(h,()=>d(!1),[m,p]);const f=!!a&&!ua(a),b=r||n(s==="year"?"common.field.year.placeholder":"common.field.date.placeholder");return e.jsxs("label",{className:"tp-field "+l,children:[t&&e.jsx($,{children:t}),e.jsxs("span",{className:"relative flex items-center gap-2",ref:m,children:[e.jsx("input",{className:"tp-input",value:a||"",inputMode:"numeric",placeholder:b,maxLength:10,"aria-invalid":f||void 0,onChange:y=>o(y.target.value.replace(/[^\d-]/g,"").slice(0,10)),style:f?{borderColor:"var(--error)"}:void 0}),e.jsx(ye,{label:n("common.date.pick.tip"),className:"shrink-0",children:e.jsx("button",{type:"button",className:"tp-btn tp-btn-ghost tactile",style:{padding:"6px 9px",flex:"none"},"aria-label":n("common.date.pick.aria",{field:t||n("common.date.pick.field.fallback")}),"aria-expanded":h,onClick:()=>d(y=>!y),children:e.jsx(Xl,{})})}),h&&Ue.createPortal(e.jsx("span",{ref:p,className:"date-pop",style:u,children:e.jsx(lu,{value:a,granularity:s,onPick:o,onClose:()=>d(!1)})}),document.body)]}),(f||i)&&e.jsx("span",{style:{display:"block",marginTop:5,fontSize:"var(--type-ui-12)",lineHeight:1.4,color:f?"var(--error)":"var(--faint)"},children:f?n("error.validate.partial-date"):i})]})}function cu({values:t=[],onChange:a,options:o,ariaLabel:s,allLabel:r="all",width:i}){const[l,h]=c.useState(!1),d=c.useRef(null),{popRef:m,style:p}=qt(l,d,{matchWidth:"min",minHeight:140});Mt(l,()=>h(!1),[d,m]);const u=o.filter(([y])=>t.includes(y)),f=u.length===0?r:u.length===1?u[0][1]:`${u.length} states`,b=y=>a(t.includes(y)?t.filter(v=>v!==y):[...t,y]);return e.jsxs("span",{className:"tp-select",ref:d,style:i?{width:i}:void 0,children:[e.jsxs("button",{type:"button",className:"tp-select-trigger tactile","aria-label":s,"aria-expanded":l,onClick:()=>h(y=>!y),children:[e.jsx("span",{className:u.length?"":"tp-select-ph",children:f}),e.jsx("span",{className:"tp-select-chev","aria-hidden":"true",children:"▾"})]}),l&&Ue.createPortal(e.jsxs("span",{ref:m,className:"hand-card hc-r2 tp-select-panel tp-multi",role:"listbox","aria-multiselectable":"true",style:p,children:[o.map(([y,v,g])=>{const w=t.includes(y);return e.jsxs("button",{type:"button",role:"option","aria-selected":w,className:`menu-item${w?" active":""}`,onClick:()=>b(y),children:[e.jsx("span",{"aria-hidden":"true",style:{width:14,flex:"none",textAlign:"center"},children:w?"✓":""}),g&&e.jsx("span",{"aria-hidden":"true",style:{width:8,height:8,borderRadius:2,background:g,flex:"none"}}),v]},y)}),t.length>0&&e.jsxs("button",{type:"button",className:"menu-item",style:{color:"var(--soft)"},onClick:()=>a([]),children:[e.jsx("span",{"aria-hidden":"true",style:{width:14,flex:"none"}}),"clear"]})]}),document.body)]})}function Sa({color:t="yellow",style:a="sticker",className:o="",children:s,...r}){return e.jsx("span",{className:`tag-chip tc-${t} ts-${a} ${o}`,...r,children:s})}function jw({children:t}){return e.jsx("mark",{className:"hl",children:t})}function Eo({className:t="",children:a}){return e.jsxs("p",{className:"hand-note card-text "+t,children:[e.jsx("span",{className:"tick","aria-hidden":"true",children:"▍"}),a]})}function Dl({className:t="",children:a}){return e.jsx("p",{className:"quote-translation card-text "+t,children:a})}function Is(t=11,a=1.3){const o=(Math.random()*2-1)*t,s=.85+Math.random()*.32,r=(Math.random()*2-1)*a;return{"--grot":`${o.toFixed(1)}deg`,"--gscale":s.toFixed(3),"--gdy":`${r.toFixed(1)}px`}}const du=()=>{var t;return typeof window<"u"&&((t=window.matchMedia)==null?void 0:t.call(window,"(prefers-reduced-motion: reduce)").matches)};function Il(t,a=3){const[o,s]=c.useState("");return{play:()=>{du()||s(`${t}-${1+Math.floor(Math.random()*a)}`)},animClass:o,onAnimationEnd:()=>s("")}}function hu(){const t=c.useMemo(()=>Is(13,0),[]);return e.jsx("span",{"aria-label":n("common.favourite.badge.aria"),className:"absolute right-1.5 top-1.5",style:{...t,color:"#ef5a5a",fontSize:"var(--type-ui-19)",lineHeight:1,filter:"drop-shadow(0 1px 2px rgba(0,0,0,.55))",transform:"rotate(var(--grot)) scale(var(--gscale))"},children:"♥"})}const Ya="#7FA6C9",gt={wishlist:{color:"var(--faint)",book:"common.shelf.wishlist.book.label",movie:"common.shelf.wishlist.film.label"},reading:{color:Ya,book:"common.shelf.reading.book.label",movie:"common.shelf.reading.film.label"},watching:{color:Ya,book:"common.shelf.reading.book.label",movie:"common.shelf.reading.film.label"},playing:{color:Ya,book:"common.shelf.playing.book.label",movie:"common.shelf.playing.film.label"},paused:{color:"var(--amber)",book:"common.shelf.paused.book.label",movie:"common.shelf.paused.film.label"},abandoned:{color:"var(--error)",book:"common.shelf.abandoned.book.label",movie:"common.shelf.abandoned.film.label"},completed:{color:"var(--ok)",book:"common.shelf.completed.book.label",movie:"common.shelf.completed.film.label"}},uu=new Set(["reading","watching","playing"]);function _t(t,a="book"){const o=gt[t];return o?n(a==="book"?o.book:o.movie):""}function Ps({state:t,kind:a="book",progress:o=0,radius:s=0,title:r}){const i=gt[t];if(!i)return null;const l=uu.has(t),h=l?Math.max(0,Math.min(100,o)):100,d=r||(l&&h>0?n("common.shelf.progress.label",{name:_t(t,a),percent:h}):_t(t,a));return e.jsx("div",{role:"img","aria-label":d,title:d,style:{height:5,background:`color-mix(in srgb, ${i.color} 22%, transparent)`,borderBottomLeftRadius:s,borderBottomRightRadius:s,overflow:"hidden"},children:e.jsx("div",{style:{width:`${h}%`,height:"100%",background:i.color,transition:"width .3s ease"}})})}function mu({kind:t="book",stacked:a=!1}){const o=c.useMemo(()=>Is(11,0),[]),s=t==="book",i=n(t==="game"?"common.reading-badge.game.aria":s?"common.reading-badge.book.aria":"common.reading-badge.film.aria");return e.jsx("span",{"aria-label":i,title:i,className:"absolute left-1.5 reading-badge",style:{...o,top:a?26:6,background:Ya,transform:"rotate(var(--grot))"},children:s?e.jsx(Ks,{size:15}):e.jsx(Ql,{size:15})})}function Ba({state:t,label:a,tip:o,children:s}){const[r,i]=c.useState(!1),l=c.useRef(null),{popRef:h,style:d}=qt(r,l,{align:"start",minHeight:160}),m=()=>i(!1);Mt(r,m,[l,h],{onEscape:()=>{var u,f;return(f=(u=l.current)==null?void 0:u.querySelector("button"))==null?void 0:f.focus()}});const p=(gt[t]||{}).color||"var(--soft)";return e.jsxs("span",{className:"relative",ref:l,style:{display:"inline-flex"},children:[e.jsx(ye,{label:o,side:"bottom",children:e.jsxs("button",{type:"button",className:"tp-chip tp-chip-btn",style:{gap:6,color:p,borderColor:"color-mix(in srgb, currentColor 45%, transparent)"},"aria-expanded":r,"aria-haspopup":"true",onClick:()=>i(u=>!u),children:[e.jsx("span",{"aria-hidden":"true",style:{width:8,height:8,borderRadius:2,background:p,flex:"none"}}),a]})}),r&&Ue.createPortal(e.jsx("div",{ref:h,className:"hand-card hc-r2 more-menu",style:{...d,minWidth:210,maxWidth:280},role:"menu",children:typeof s=="function"?s(m):s}),document.body)]})}function On({value:t,onChange:a}){const o=c.useMemo(()=>Is(9,1),[]),{play:s,animClass:r,onAnimationEnd:i}=Il("anim-heart",3);return e.jsx(ye,{label:n(t?"common.action.favourite.off.label":"common.action.favourite.on.label"),children:e.jsx("button",{type:"button",className:`heart ${r}${t?" on":""}`,style:o,"aria-pressed":!!t,onAnimationEnd:i,onClick:a?()=>{s(),a(!t)}:void 0,children:t?"♥":"♡"})})}function Pl(t,a=150,o=96,s=240){const[r,i]=c.useState(()=>{const l=Number(typeof localStorage<"u"&&localStorage.getItem(t));return l>=o&&l<=s?l:Ll()?100:a});return c.useEffect(()=>{try{localStorage.setItem(t,String(r))}catch{}},[t,r]),[r,i]}function Na({open:t}){return e.jsx("span",{"aria-hidden":"true",className:"clamp-more","data-open":t?"1":"0",children:e.jsx("svg",{width:"15",height:"15",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.4",strokeLinecap:"round",strokeLinejoin:"round",children:e.jsx("polyline",{points:"6 9 12 15 18 9"})})})}function Bl(t,a){return t?{role:"button",tabIndex:0,onClick:a,onKeyDown:o=>{(o.key==="Enter"||o.key===" ")&&(o.preventDefault(),a())}}:{}}function is({text:t,style:a,lines:o=3,className:s=""}){const[r,i]=c.useState(!1),[l,h]=c.useState(!1),d=c.useRef(null);if(c.useEffect(()=>{const u=d.current;if(!u)return;const f=()=>h(u.scrollHeight>u.clientHeight+2);f();const b=new ResizeObserver(f);return b.observe(u),()=>b.disconnect()},[t,r,o]),!t)return null;const m=l||r,p=r?null:{display:"-webkit-box",WebkitLineClamp:o,WebkitBoxOrient:"vertical",overflow:"hidden"};return e.jsxs("div",{className:`clampable${m?" is-clickable":""} ${s}`.trim(),"aria-expanded":m?r:void 0,...Bl(m,()=>i(u=>!u)),children:[e.jsx("p",{ref:d,style:{whiteSpace:"pre-wrap",color:"var(--soft)",fontSize:"var(--type-ui-15)",lineHeight:1.55,margin:0,...a,...p},children:t}),m&&e.jsx(ye,{label:n(r?"common.action.show-less.label":"common.clamp.description.more.tip"),side:"bottom",className:"flex w-full justify-center",children:e.jsx(Na,{open:r})})]})}function He(t,a){const[o,s]=c.useState(()=>{try{const r=localStorage.getItem(t);return r==null?a:JSON.parse(r)}catch{return a}});return c.useEffect(()=>{try{localStorage.setItem(t,JSON.stringify(o))}catch{}},[t,o]),[o,s]}function Co({text:t,lines:a=5,style:o,className:s="",open:r,onToggle:i}){const[l,h]=c.useState(!1),d=r!==void 0,m=d?r:l,p=()=>d?i==null?void 0:i():h(g=>!g),[u,f]=c.useState(!1),b=c.useRef(null);if(c.useEffect(()=>{const g=b.current;if(!g)return;const w=()=>f(g.scrollHeight>g.clientHeight+2);w();const k=new ResizeObserver(w);return k.observe(g),()=>k.disconnect()},[t,m,a]),!t)return null;const y=u||m,v=m?null:{display:"-webkit-box",WebkitLineClamp:a,WebkitBoxOrient:"vertical",overflow:"hidden"};return e.jsxs("div",{className:`clampable card-text${y?" is-clickable":""} ${s}`.trim(),"aria-expanded":y?m:void 0,...Bl(y,p),children:[e.jsx("p",{ref:b,style:{whiteSpace:"pre-wrap",margin:0,...o,...v},children:t}),y&&e.jsx(ye,{label:n(m?"common.action.show-less.label":"common.clamp.text.more.tip"),side:"bottom",className:"flex w-full justify-center",children:e.jsx(Na,{open:m})})]})}let Jr=!1;function pu(){Jr||typeof document>"u"||(Jr=!0,!matchMedia("(prefers-reduced-motion: reduce)").matches&&document.addEventListener("pointerdown",t=>{const a=t.target.closest&&t.target.closest(".tactile, .tp-btn");if(!a)return;const o=a.getBoundingClientRect();a.style.setProperty("--px",`${t.clientX-o.left}px`),a.style.setProperty("--py",`${t.clientY-o.top}px`),a.dataset.pressing="1";const s=()=>{a.dataset.pressing="0",window.removeEventListener("pointerup",s),window.removeEventListener("pointercancel",s)};window.addEventListener("pointerup",s),window.addEventListener("pointercancel",s)},!0))}function Ta(t){let a=t>>>0||1;return function(){a=a+1831565813|0;let o=Math.imul(a^a>>>15,1|a);return o=o+Math.imul(o^o>>>7,61|o)^o,((o^o>>>14)>>>0)/4294967296}}function Bs(t,a,o=3,s=5){const r=s-o+1,i=[];for(let l=0;l<t;l++){let h=o+Math.floor(a()*r);if(l>=2&&i[l-1]===i[l-2]&&i[l-1]===h){const d=Math.floor(a()*(r-1));h=o+(d>=h-o?d+1:d)}i.push(h)}return i}function fu(t,a,o=s=>s.key){return t.map((s,r)=>{const i=String(o(s)??r);let l=a>>>0^2166136261;for(let h=0;h<i.length;h++)l^=i.charCodeAt(h),l=Math.imul(l,16777619);return{item:s,key:i,rank:Ta(l)()}}).sort((s,r)=>s.rank-r.rank||(s.key<r.key?-1:s.key>r.key?1:0)).map(s=>s.item)}function Ao({columns:t=2,gap:a=24,seed:o=1,pinnedCount:s=0,lockOrder:r=!1,order:i="height",className:l="",children:h}){const d=c.useMemo(()=>c.Children.toArray(h),[h]),m=d.length,p=Math.max(1,t),u=c.useRef([]),f=c.useMemo(()=>{const _=new Array(d.length+1);let T=0;_[0]=0;for(let B=0;B<d.length;B++){const L=String(d[B].key);for(let V=0;V<L.length;V++)T=Math.imul(T,31)+L.charCodeAt(V)|0;_[B+1]=T}return _},[d]),b=f[d.length],y=c.useRef(null),v=c.useRef(!1),g=c.useRef(""),w=c.useRef(!1),k=c.useRef(0),S=c.useRef(0),N=c.useRef(""),[j,x]=c.useState([]),[M,q]=c.useState(0);c.useLayoutEffect(()=>{const _=`${m}|${p}|${o}|${s}|${b}`,T=g.current!==_,B=`${p}|${o}|${s}`,L=N.current===B&&y.current&&k.current<m&&y.current.colOf.length===k.current&&f[k.current]===S.current?y.current:null;N.current=B,k.current=m,S.current=b,T&&(g.current=_,L||(v.current=!1,y.current=null)),r&&!w.current&&!T&&(v.current=!0),w.current=r;const V=()=>{const H=u.current.slice(0,m).map(D=>D?D.getBoundingClientRect().height:0),R=Math.max(0,Math.min(s,m));let I=y.current;if(!I||I.colOf.length!==m||!v.current){const D=H.map(G=>Math.round(G)),z=G=>{if(i==="source")return Array.from({length:m-G},(he,ue)=>ue+G);const ae=Math.max(G,R),Z=Array.from({length:m-ae},(he,ue)=>ue+ae).sort((he,ue)=>D[ue]-D[he]||he-ue),pe=new Array(m);Z.forEach((he,ue)=>pe[he]=ue);const ce=Ta(o),F=new Array(m);for(let he=0;he<Z.length;he++){const ue=ce()<.2,re=ce()<.5?2:3,J=ce()<.5;F[Z[he]]=he+(ue?J?-re:re:0)}const Q=Z.slice().sort((he,ue)=>F[he]-F[ue]||pe[he]-pe[ue]),ie=[];for(let he=G;he<ae;he++)ie.push(he);for(const he of Q)ie.push(he);return ie},K=L?[...L.order,...z(L.colOf.length)]:z(0),A=new Array(m),Y=Array(p).fill(0);for(const G of K){let ae;if(L&&G<L.colOf.length)ae=L.colOf[G];else{ae=0;for(let Z=1;Z<p;Z++)Y[Z]<Y[ae]&&(ae=Z)}A[G]=ae,Y[ae]+=D[G]+a}I={order:K,colOf:A},y.current=I}const U=Array(p).fill(0),te=new Array(m);for(const D of I.order){const z=I.colOf[D];te[D]={col:z,top:U[z]},U[z]+=H[D]+a}x(D=>D.length===m&&D.every((z,K)=>z.col===te[K].col&&z.top===te[K].top)?D:te),q(Math.max(0,...U.map(D=>D-a)))};if(V(),typeof ResizeObserver>"u")return;const P=new ResizeObserver(V);return u.current.slice(0,m).forEach(C=>C&&P.observe(C)),()=>P.disconnect()},[m,p,a,o,s,r,b,i]);const E=`calc((100% - ${(p-1)*a}px) / ${p})`,O=_=>p<=1?"0px":`calc(${_} * (100% + ${a}px) / ${p})`;return e.jsx("div",{className:l,style:{position:"relative",height:M||void 0},children:d.map((_,T)=>{const B=j[T];return e.jsx("div",{ref:L=>u.current[T]=L,style:{position:"absolute",width:p<=1?"100%":E,left:B?O(B.col):0,top:B?B.top:0,visibility:B?"visible":"hidden"},children:_},T)})})}function Fl(t,a){let o=0,s=1/0;for(let r=0;r<t.length;r++){const i=Math.abs(a-t[r].center);i<s&&(s=i,o=r)}return o}function Ye({value:t,onChange:a,options:o,label:s,ariaLabel:r,className:i="",disabled:l=!1}){const h=c.useRef(null),d=c.useRef(null),m=c.useRef(null),p=c.useRef(!1),u=c.useRef(0);c.useEffect(()=>()=>an(u.current),[]);const f=o.findIndex(([w])=>w===t);c.useLayoutEffect(()=>{const w=h.current,k=d.current;if(!w||!k)return;const S=()=>{if(f<0){k.style.opacity="0";return}const j=w.querySelectorAll(".tp-toggle-opt")[f];j&&(k.style.opacity="1",k.style.width=`${j.offsetWidth}px`,k.style.transform=`translateX(${j.offsetLeft}px)`)};S();const N=new ResizeObserver(S);return N.observe(w),()=>N.disconnect()},[f,t,o.length]);const b=w=>{const k=m.current,S=h.current,N=d.current;if(!k||!S||!N)return;if(!k.moved){if(Math.abs(w.clientX-k.startX)<5)return;k.moved=!0,S.dataset.dragging="1"}const j=w.clientX-k.left,x=k.opts[k.opts.length-1],M=k.opts[0].left,q=x.left+x.width-k.thumbW,E=Math.max(M,Math.min(q,j-k.grab));N.style.transform=`translateX(${E}px)`,k.hover=Fl(k.opts,E+k.thumbW/2),S.style.setProperty("--px",`${j}px`),S.style.setProperty("--py",`${w.clientY-k.top}px`),S.dataset.pressing="1"},y=()=>{const w=m.current,k=h.current;if(m.current=null,window.removeEventListener("pointermove",b),window.removeEventListener("pointerup",y),!!k&&(k.dataset.pressing="0",w&&w.moved)){k.dataset.dragging="0",p.current=!0,setTimeout(()=>{p.current=!1},0);const S=o[w.hover]&&o[w.hover][0];if(S!=null&&S!==t)a(S);else{const N=k.querySelectorAll(".tp-toggle-opt")[f],j=d.current;N&&j&&(j.style.transform=`translateX(${N.offsetLeft}px)`)}}},v=w=>{if(l)return;const k=h.current,S=d.current;if(!k||!S||f<0||w.button!=null&&w.button!==0)return;const N=[...k.querySelectorAll(".tp-toggle-opt")];if(!N[f])return;const j=k.getBoundingClientRect(),x=N[f].offsetWidth,M=Math.max(0,Math.min(x,w.clientX-j.left-N[f].offsetLeft));m.current={startX:w.clientX,moved:!1,hover:f,grab:M,left:j.left,top:j.top,thumbW:x,opts:N.map(q=>({left:q.offsetLeft,width:q.offsetWidth,center:q.offsetLeft+q.offsetWidth/2}))},window.addEventListener("pointermove",b),window.addEventListener("pointerup",y)},g=e.jsxs("div",{ref:h,role:"tablist","aria-label":r||s,className:`tp-toggle tactile${l?" is-disabled":""} ${i}`,"aria-disabled":l||void 0,onPointerDown:v,children:[e.jsx("span",{ref:d,className:"tp-toggle-thumb","aria-hidden":"true"}),o.map(([w,k,S])=>e.jsx("button",{type:"button",role:"tab","aria-selected":t===w,"aria-pressed":t===w,className:"tp-toggle-opt"+(t===w?" is-on":""),disabled:l,onPointerEnter:N=>{!S||N.pointerType==="touch"||(an(u.current),u.current=ac(S,N.currentTarget.getBoundingClientRect(),"bottom"))},onPointerLeave:()=>{an(u.current),u.current=0},onClick:()=>{if(an(u.current),u.current=0,p.current){p.current=!1;return}a(w)},children:k},w))]});return s?e.jsxs("div",{children:[e.jsx($,{className:"mb-2 block",children:s}),g]}):g}function pt({value:t=[],onChange:a,suggestions:o=[],placeholder:s,ariaLabel:r,transform:i,nameCase:l=!1}){const[h,d]=c.useState(""),[m,p]=c.useState(!1),[u,f]=c.useState(0),b=c.useRef(null),y=c.useRef(null),v=E=>i?i(E):E,g=d,w=h.trim().toLowerCase(),k=o.filter(E=>!t.includes(E)&&(!w||E.toLowerCase().includes(w))).slice(0,8),S=E=>{const O=hs(String(E||"")).map(v).filter(Boolean);if(O.length){const _=[...t];for(const T of O)_.includes(T)||_.push(T);a(_)}d(""),f(0),p(!1)};c.useEffect(()=>{const E=[];for(const _ of t)for(const T of hs(_).map(v))T&&!E.includes(T)&&E.push(T);E.length===t.length&&E.every((_,T)=>_===t[T])||a(E)},[t]);const N=E=>a(t.filter((O,_)=>_!==E)),j=E=>{E.key==="Enter"||E.key===","?(E.preventDefault(),S(m&&k[u]?k[u]:h)):E.key==="Backspace"&&!h&&t.length?N(t.length-1):E.key==="ArrowDown"?(E.preventDefault(),p(!0),f(O=>Math.min(O+1,k.length-1))):E.key==="ArrowUp"?(E.preventDefault(),f(O=>Math.max(O-1,0))):E.key==="Escape"&&p(!1)},x=m&&k.length>0,{popRef:M,style:q}=qt(x,b,{matchWidth:!0,minHeight:120});return Mt(x,()=>p(!1),[b,M],{event:"pointerdown"}),e.jsxs("div",{className:"token-input",ref:b,children:[e.jsxs("div",{className:"tp-input token-field",onClick:()=>y.current&&y.current.focus(),children:[t.map((E,O)=>e.jsxs("span",{className:"token-pill",children:[E,e.jsx(ye,{label:n("common.action.remove.aria",{name:E}),children:e.jsx("button",{type:"button",className:"token-x",onClick:()=>N(O),"aria-label":n("common.action.remove.aria",{name:E}),children:"×"})})]},E)),e.jsx("input",{ref:y,className:"token-entry",autoCapitalize:l?"words":void 0,value:h,placeholder:t.length?"":s||n("common.field.token.placeholder"),"aria-label":r,autoComplete:"off",onChange:E=>{g(E.target.value),p(!0),f(0)},onFocus:()=>p(!0),onKeyDown:j,onBlur:E=>{b.current&&b.current.contains(E.relatedTarget)||M.current&&M.current.contains(E.relatedTarget)||(h.trim()?S(h):p(!1))}})]}),x&&Ue.createPortal(e.jsx("ul",{ref:M,className:"token-menu",style:q,children:k.map((E,O)=>e.jsx("li",{children:e.jsx("button",{type:"button",className:"token-opt"+(O===u?" hi":""),onMouseEnter:()=>f(O),onClick:()=>S(E),children:E})},E))}),document.body)]})}function Oe({value:t,onChange:a,options:o,ariaLabel:s,placeholder:r,className:i="",width:l,disabled:h=!1,filter:d=!1,filterPlaceholder:m}){const[p,u]=c.useState(!1),[f,b]=c.useState(0),[y,v]=c.useState(""),g=c.useRef(null),w=c.useRef(null),k=c.useRef(null),S=o.findIndex(([P])=>P===t),N=S>=0?o[S][1]:r||n("common.field.select.placeholder"),j=d?y.trim().toLowerCase():"",x=([,P,C])=>String(C??(typeof P=="string"?P:"")).toLowerCase(),M=j?o.filter(P=>x(P).includes(j)):o,q=c.useRef(null),E=c.useRef(!1),O=()=>{const P=q.current;P&&(q.current=null,window.removeEventListener("pointermove",P.move),window.removeEventListener("pointerup",P.up),window.removeEventListener("pointercancel",P.up),w.current&&(w.current.dataset.dragging="0"))},_=P=>{const C=q.current,H=w.current,R=k.current;if(!C||!H||!R)return;if(!C.moved){if(Math.abs(P.clientY-C.startY)<5)return;C.moved=!0,H.dataset.dragging="1"}const I=H.getBoundingClientRect(),U=P.clientY-I.top+H.scrollTop,te=C.opts[C.opts.length-1],D=C.opts[0].top,z=te.top+te.height-C.thumbH,K=Math.max(D,Math.min(z,U-C.grab));R.style.transform=`translateY(${K}px)`;const A=Fl(C.opts,K+C.thumbH/2);if(A!==C.hover&&(C.hover=A,b(A)),H.scrollHeight>H.clientHeight){const Y=P.clientY-I.top;Y<24?H.scrollTop-=8:Y>I.height-24&&(H.scrollTop+=8)}},T=()=>{const P=q.current;if(O(),!P||!P.moved)return;E.current=!0,setTimeout(()=>{E.current=!1},0);const C=M[P.hover];C&&(a(C[0]),u(!1))},B=P=>{const C=w.current,H=k.current;if(!C||!H||P.button!=null&&P.button!==0||P.pointerType!=="mouse"&&C.dataset.scroll==="1")return;const R=[...C.querySelectorAll(".tp-select-opt")],I=R[f]?f:0;if(!R[I])return;const U=C.getBoundingClientRect(),te=R[I].offsetHeight,D=P.clientY-U.top+C.scrollTop;q.current={startY:P.clientY,moved:!1,hover:I,grab:Math.max(0,Math.min(te,D-R[I].offsetTop)),thumbH:te,opts:R.map(z=>({top:z.offsetTop,height:z.offsetHeight,center:z.offsetTop+z.offsetHeight/2})),move:_,up:T},window.addEventListener("pointermove",_),window.addEventListener("pointerup",T),window.addEventListener("pointercancel",T)};c.useEffect(()=>{p||O()},[p]),c.useEffect(()=>O,[]),c.useEffect(()=>{p&&b(S>=0?S:0)},[p]),c.useLayoutEffect(()=>{if(!p)return;const P=w.current,C=k.current;if(!P||!C||(P.dataset.scroll=P.scrollHeight>P.clientHeight?"1":"0",q.current&&q.current.moved))return;const H=P.querySelectorAll(".tp-select-opt")[f];H&&(C.style.height=`${H.offsetHeight}px`,C.style.transform=`translateY(${H.offsetTop}px)`,C.style.opacity="1")},[p,f,M.length]),c.useEffect(()=>{p||v("")},[p]),c.useEffect(()=>{b(P=>P<M.length?P:0)},[M.length]);const{popRef:L,style:V}=qt(p,g,{matchWidth:"min",minHeight:140});return Mt(p,()=>u(!1),[g,L]),c.useEffect(()=>{if(!p)return;const P=C=>{if(C.key==="Escape")return u(!1);C.key==="ArrowDown"?(C.preventDefault(),b(H=>Math.min(M.length-1,H+1))):C.key==="ArrowUp"?(C.preventDefault(),b(H=>Math.max(0,H-1))):C.key==="Enter"&&M[f]&&(C.preventDefault(),a(M[f][0]),u(!1))};return document.addEventListener("keydown",P),()=>document.removeEventListener("keydown",P)},[p,f,M,a]),e.jsxs("div",{className:`tp-select ${i}`,ref:g,style:l?{width:l}:void 0,children:[e.jsxs("button",{type:"button",className:"tp-select-trigger tactile","aria-haspopup":"listbox","aria-expanded":p,"aria-label":s,disabled:h,onClick:()=>{if(E.current){E.current=!1;return}u(P=>!P)},children:[e.jsx("span",{className:S>=0?"":"tp-select-ph",children:N}),e.jsx("svg",{className:"tp-select-chev",width:"14",height:"14",viewBox:"0 0 16 16",fill:"none",stroke:"currentColor",strokeWidth:"1.7",strokeLinecap:"round",strokeLinejoin:"round","aria-hidden":"true",children:e.jsx("path",{d:"m4 6 4 4 4-4"})})]}),p&&Ue.createPortal(e.jsxs("div",{className:"tp-select-panel",role:"listbox",ref:P=>{w.current=P,L.current=P},onPointerDown:B,style:V,children:[e.jsx("span",{className:"tp-select-thumb",ref:k,"aria-hidden":"true"}),d&&e.jsx("input",{className:"tp-select-filter",type:"text",autoFocus:!0,value:y,placeholder:m||n("common.field.filter.placeholder"),"aria-label":m||n("common.field.filter.placeholder"),onChange:P=>v(P.target.value),onPointerDown:P=>P.stopPropagation()}),d&&M.length===0&&e.jsx("span",{className:"tp-select-empty",children:n("common.field.filter.none")}),M.map(([P,C],H)=>e.jsx("button",{type:"button",role:"option","aria-selected":P===t,className:"tp-select-opt tactile"+(H===f?" is-hi":""),onMouseEnter:()=>b(H),onClick:()=>{if(E.current){E.current=!1;return}a(P),u(!1)},children:C},P))]}),document.body)]})}function vt({open:t,title:a,body:o,confirmLabel:s,confirmDisabled:r=!1,onConfirm:i,onCancel:l}){return c.useEffect(()=>{if(!t)return;const h=d=>d.key==="Escape"&&l&&l();return document.addEventListener("keydown",h),()=>document.removeEventListener("keydown",h)},[t,l]),At(t),t?e.jsx("div",{className:"tp-scrim fixed inset-0 z-50 flex items-center justify-center px-4 py-10",onMouseDown:h=>{h.target===h.currentTarget&&l&&l()},children:e.jsxs("div",{role:"dialog","aria-modal":"true","aria-label":a,className:"hand-card hc-r2 w-full max-w-md px-6 py-6",children:[e.jsx("h2",{className:"display-title mb-2",style:{fontSize:"var(--type-ui-19)"},children:a}),o&&e.jsx("div",{className:"mb-5",style:{color:"var(--soft)",fontSize:"var(--type-ui-15)",lineHeight:1.55},children:o}),e.jsxs("div",{className:"flex justify-end gap-2",children:[e.jsx(ge,{onClick:l,children:n("common.action.cancel.label")}),e.jsx(Jt,{onClick:i,disabled:r,children:s||n("common.action.confirm.label")})]})]})}):null}const Fs=c.createContext(null);function gu(){const t=c.useRef(new Map),[a,o]=c.useState([]),s=c.useCallback((h,d)=>{d?t.current.set(h,d):t.current.delete(h),o([...t.current.keys()])},[]),r=c.useMemo(()=>({register:s}),[s]),i=c.useCallback(()=>[...t.current.values()],[]),l=c.useCallback(()=>{var h;for(const d of[...t.current.values()])(h=d.close)==null||h.call(d)},[]);return{host:r,count:a.length,collect:i,closeAll:l}}const ls=c.createContext(null);function qo(t){const a=c.useContext(ls),o=a==null?void 0:a.setBlocked;return c.useEffect(()=>{if(o)return o(t||""),()=>o(null)},[o,t]),a}function Ge({open:t=!0,onClose:a,title:o,maxWidth:s=560,saveTip:r,children:i}){const l=_e();At(t),ja(t&&!l,a);const h=c.useId(),[d,m]=c.useState(null),p=c.useMemo(()=>({formId:h,setBlocked:m}),[h]);if(c.useEffect(()=>{if(!t)return;const f=b=>b.key==="Escape"&&a&&a();return document.addEventListener("keydown",f),()=>document.removeEventListener("keydown",f)},[t,a]),c.useEffect(()=>{t||m(null)},[t]),!t)return null;const u=d===null?null:e.jsx(Pe,{icon:e.jsx(ft,{}),type:"submit",form:h,ariaLabel:n("common.action.save.label"),tooltip:d||r||n("common.action.save.label"),disabled:!!d,style:{width:34,height:34,padding:0,flexShrink:0},wrapClassName:"shrink-0"});return l?Ue.createPortal(e.jsx($n,{open:t,onClose:a,title:o,actions:u,children:e.jsx(ls.Provider,{value:p,children:i})}),document.body):Ue.createPortal(e.jsx("div",{className:"tp-scrim fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-4 py-10",onMouseDown:f=>{f.target===f.currentTarget&&a&&a()},children:e.jsxs("div",{role:"dialog","aria-modal":"true","aria-label":o,className:"hand-card hc-r2 w-full",style:{maxWidth:s,padding:"18px 20px 20px"},children:[e.jsxs("div",{className:"mb-3 flex items-center gap-2",children:[e.jsx("h2",{className:"display-title flex-1",style:{fontSize:"var(--type-ui-19)"},children:o}),u,e.jsx(Pe,{icon:e.jsx(it,{}),ariaLabel:n("common.action.close.label"),tooltip:n("common.form.close.tip"),onClick:a,style:{width:34,height:34,padding:0,flexShrink:0},wrapClassName:"shrink-0"})]}),e.jsx(ls.Provider,{value:p,children:i})]})}),document.body)}const Hl=500,bu=400,io=10,Zr=8,yu=3e3;function ye({label:t,side:a="top",className:o="",onContextMenu:s,shortcut:r,shiftKey:i=!1,children:l}){t=_e()?t:Jh(t,r,i);const h=c.useRef(null),d=c.useRef(null),m=c.useRef(null),p=c.useRef(!1),u=c.useRef(null),f=c.useRef(0),b=c.useRef(null),y=c.useRef(!1);if(c.useEffect(()=>()=>{clearTimeout(d.current),an(f.current)},[]),!t)return l;const v=/(?:^|\s)is-open(?:\s|$)/.test(o),g=()=>{var T;const _=(T=u.current)==null?void 0:T.getBoundingClientRect();return _&&_.width?_:null},w=(_=!1)=>{v||(an(f.current),f.current=ac(t,g(),a,!_))},k=()=>{an(f.current),f.current=0},S=()=>{clearTimeout(h.current),h.current=null},N=()=>{clearTimeout(d.current),d.current=null,b.current=null},j=_=>{N(),b.current={x:_.clientX,y:_.clientY},d.current=setTimeout(()=>{d.current=null,y.current&&w(!0)},bu)},x=_=>{_.pointerType==="touch"||v||(y.current=!0,j(_))},M=_=>{_.pointerType==="touch"&&(p.current=!1,m.current={x:_.clientX,y:_.clientY},S(),h.current=setTimeout(()=>{p.current=!0,!v&&wm(t,g(),a)},Hl))},q=_=>{if(_.pointerType!=="touch"){if(!d.current||!b.current)return;(Math.abs(_.clientX-b.current.x)>Zr||Math.abs(_.clientY-b.current.y)>Zr)&&j(_);return}!h.current||!m.current||(Math.abs(_.clientX-m.current.x)>io||Math.abs(_.clientY-m.current.y)>io)&&S()},E=_=>{if(!p.current){N(),k();return}p.current=!1,_.preventDefault(),_.stopPropagation()},O=_=>{var B,L;let T=!1;try{T=!!((L=(B=_.target).matches)!=null&&L.call(B,":focus-visible"))}catch{T=!1}T&&w()};return e.jsx("span",{ref:u,className:`tp-tip-wrap ${o}`,onPointerEnter:x,onPointerLeave:()=>{y.current=!1,S(),N(),k()},onPointerDown:M,onPointerMove:q,onPointerUp:S,onPointerCancel:()=>{y.current=!1,S(),N(),k()},onClickCapture:E,onFocus:O,onBlur:k,onContextMenu:_=>{_.preventDefault(),s&&(_.stopPropagation(),s(_))},children:l})}const zl=8,$l=4;function wu(t,a,o,s,r={}){const{prefer:i="below",matchWidth:l=!1,align:h="start",gap:d=$l,minHeight:m=120,margin:p=zl}=r,u=a.h-t.bottom-d-p,f=t.top-d-p,b=i!=="above",y=b?o<=u:o<=f,v=b?u>=f:f>=u,g=b?y||v:!(y||v),w=Math.max(m,g?u:f),k=Math.min(o,w),S=l==="min"?t.width:0,N=Math.max(s,S),j=l===!0?t.width:Math.min(N,a.w-p*2),x=h==="end"?t.right-j:t.left;return{top:g?t.bottom+d:Math.max(p,t.top-d-k),left:Math.max(p,Math.min(x,a.w-j-p)),width:l===!0?j:void 0,minWidth:l==="min"?t.width:void 0,maxHeight:w,down:g}}function qt(t,a,o={}){const{prefer:s="below",matchWidth:r=!1,align:i="start",gap:l=$l,minHeight:h=120,at:d=null}=o,m=c.useRef(null),[p,u]=c.useState(null);c.useLayoutEffect(()=>{if(!t){u(null);return}const b=()=>{const y=a==null?void 0:a.current,v=m.current;if(!v||!y&&!d)return;const g=d?{top:d.y,bottom:d.y,left:d.x,right:d.x,width:0}:y.getBoundingClientRect();u(wu(g,{w:window.innerWidth,h:window.innerHeight},v.scrollHeight,v.offsetWidth,{prefer:s,matchWidth:r,align:i,gap:l,minHeight:h}))};return b(),window.addEventListener("scroll",b,!0),window.addEventListener("resize",b),()=>{window.removeEventListener("scroll",b,!0),window.removeEventListener("resize",b)}},[t,a,s,r,i,l,h,d==null?void 0:d.x,d==null?void 0:d.y]);const f={position:"fixed",top:(p==null?void 0:p.top)??0,left:(p==null?void 0:p.left)??0,right:"auto",bottom:"auto",maxWidth:`calc(100vw - ${zl*2}px)`,visibility:p?void 0:"hidden",...p!=null&&p.width?{width:p.width}:null,...p!=null&&p.minWidth?{minWidth:p.minWidth}:null,...p?{maxHeight:p.maxHeight}:null};return{popRef:m,pos:p,style:f,placedAbove:p?!p.down:!1}}function Mt(t,a,o,s={}){const{onEscape:r,event:i="mousedown"}=s,l=Array.isArray(i)?i:[i];c.useEffect(()=>{if(!t)return;const h=m=>{var p;for(const u of o)if((p=u==null?void 0:u.current)!=null&&p.contains(m.target))return;a()},d=m=>{m.key==="Escape"&&(a(),r==null||r())};for(const m of l)document.addEventListener(m,h);return document.addEventListener("keydown",d),()=>{for(const m of l)document.removeEventListener(m,h);document.removeEventListener("keydown",d)}},[t,a,r,l.join(),...o])}function vu({anchor:t,title:a,pinned:o=!0,onHold:s,onLeave:r,onClose:i,children:l}){const h=_e(),d=c.useRef(null),[m,p]=c.useState(null);c.useLayoutEffect(()=>{if(h)return;const f=()=>{const b=t==null?void 0:t.current,y=d.current;if(!b||!y)return;const v=b.getBoundingClientRect(),g=window.innerWidth,w=window.innerHeight,k=y.offsetWidth,S=y.offsetHeight,N=v.bottom+12+S<=w-10,j=N?v.bottom+12:Math.max(10,v.top-12-S),x=Math.max(12,Math.min(v.left+v.width/2-k/2,g-k-12));p({top:j,left:x,below:N,caret:Math.max(14,Math.min(v.left+v.width/2-x,k-14))})};return f(),window.addEventListener("scroll",f,!0),window.addEventListener("resize",f),()=>{window.removeEventListener("scroll",f,!0),window.removeEventListener("resize",f)}},[h,t]),c.useEffect(()=>{const f=b=>b.key==="Escape"&&i();return document.addEventListener("keydown",f),()=>document.removeEventListener("keydown",f)},[i]);const u=e.jsxs(e.Fragment,{children:[e.jsx("p",{className:"info-pop-title",children:a}),e.jsx("div",{className:"info-pop-body",children:l})]});return h?Ue.createPortal(e.jsx("div",{className:"info-pop-scrim",onMouseDown:i,role:"presentation",children:e.jsxs("div",{className:"info-pop info-pop-centred hand-card hc-r2",role:"dialog","aria-label":a,onMouseDown:f=>f.stopPropagation(),children:[u,e.jsx("button",{type:"button",className:"info-pop-close tp-btn tp-btn-ghost tactile",onClick:i,children:n("common.action.got-it.label")})]})}),document.body):Ue.createPortal(e.jsxs(e.Fragment,{children:[o&&e.jsx("div",{className:"info-pop-catcher",onMouseDown:i,role:"presentation"}),e.jsxs("div",{ref:d,className:"info-pop info-pop-anchored hand-card hc-r2"+(m!=null&&m.below?" is-below":" is-above"),role:"dialog","aria-label":a,style:m?{top:m.top,left:m.left,"--caret-x":`${m.caret}px`}:{top:0,left:0,visibility:"hidden"},onPointerEnter:s,onPointerLeave:r,children:[u,e.jsx("span",{className:"info-pop-caret","aria-hidden":"true"})]})]}),document.body)}const ku=140;function Le({text:t,title:a}){const[o,s]=c.useState(!1),[r,i]=c.useState(!1),l=c.useRef(null),h=c.useRef(null),d=a||n("common.info.default.title"),m=a?n("common.info.dot.aria",{name:a}):typeof t=="string"?t:d,p=()=>{clearTimeout(h.current),h.current=null},u=()=>{var b;p(),s(!1),i(!1),(b=l.current)==null||b.blur()},f=()=>{r||(p(),h.current=setTimeout(()=>s(!1),ku))};return c.useEffect(()=>()=>clearTimeout(h.current),[]),e.jsxs(e.Fragment,{children:[e.jsx("button",{ref:l,type:"button",className:"info-dot"+(o?" is-open":""),"aria-label":m,"aria-expanded":o,onPointerEnter:b=>{b.pointerType!=="touch"&&(p(),s(!0))},onPointerLeave:b=>{b.pointerType!=="touch"&&f()},onClick:b=>{b.preventDefault(),b.stopPropagation(),r?u():(p(),s(!0),i(!0))},onFocus:b=>{var v,g;let y=!1;try{y=!!((g=(v=b.target).matches)!=null&&g.call(v,":focus-visible"))}catch{y=!1}y&&(p(),s(!0),i(!0))},children:"i"}),o&&e.jsx(vu,{anchor:l,title:d,pinned:r,onHold:p,onLeave:f,onClose:u,children:t})]})}function rn({keys:t}){return _e()||!t?null:e.jsx("span",{className:"kbd-legend","aria-hidden":"true",children:String(t).split(` ${n("common.kbd.then.label")} `).map((a,o)=>e.jsxs(c.Fragment,{children:[o>0&&e.jsx("span",{className:"kbd-then",children:n("common.kbd.then.label")}),e.jsx("kbd",{className:"kbd",children:a})]},a+o))})}function xu({open:t,onClose:a,omit:o}){return _e()||!t?null:e.jsxs(Hs,{open:t,title:n("shell.shortcuts.title"),onClose:a,children:[e.jsx("p",{className:"microcopy",style:{marginBottom:14},children:n("shell.shortcuts.intro.prose")}),e.jsx("p",{className:"microcopy",style:{marginBottom:14},children:Ie("shell.shortcuts.practice.prose",{mode:e.jsx("strong",{children:n("quiz.practice.label")}),key:e.jsx("kbd",{className:"kbd",children:n("vocab.key.shift.label")})})}),Zh(o).map(s=>e.jsxs("div",{style:{marginBottom:16},children:[e.jsx($,{className:"mb-2 block",children:s.group}),e.jsx("ul",{style:{listStyle:"none",margin:0,padding:0},children:s.items.map(r=>e.jsxs("li",{className:"kbd-row",children:[e.jsx("span",{children:r.label}),e.jsxs("span",{className:"kbd-pair",children:[e.jsx(rn,{keys:r.keys}),r.practiceKeys&&e.jsxs(e.Fragment,{children:[e.jsx("span",{className:"kbd-then",children:n("common.kbd.practice.label")}),e.jsx(rn,{keys:r.practiceKeys})]})]})]},r.id))})]},s.key))]})}function Hs({open:t,title:a,wide:o=!1,onClose:s,children:r}){const i=_e();return At(t),c.useEffect(()=>{if(!t)return;const l=h=>h.key==="Escape"&&s&&s();return document.addEventListener("keydown",l),()=>document.removeEventListener("keydown",l)},[t,s]),t?i?Ue.createPortal(e.jsx($n,{open:t,onClose:s,title:a||n("common.help.sheet.title"),children:e.jsx("div",{className:"help-sheet-body",children:r})}),document.body):Ue.createPortal(e.jsx("div",{className:"tp-scrim fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-4 py-10",onMouseDown:l=>{l.target===l.currentTarget&&s&&s()},children:e.jsxs("div",{role:"dialog","aria-modal":"true","aria-label":a||n("common.help.sheet.title"),className:"hand-card hc-r2 w-full",style:{maxWidth:o?860:520,padding:"18px 20px 20px"},children:[e.jsxs("div",{className:"mb-3 flex items-center gap-3",children:[e.jsx("h2",{className:"display-title flex-1",style:{fontSize:"var(--type-ui-19)"},children:a||n("common.help.sheet.title")}),e.jsx(Pe,{icon:e.jsx(it,{}),ariaLabel:n("common.action.close.label"),onClick:s,style:{width:34,height:34,padding:0,flexShrink:0}})]}),e.jsx("div",{className:"help-sheet-body",children:r})]})}),document.body):null}function zs({entries:t=[]}){return e.jsx("dl",{className:"help-list",children:t.map(a=>e.jsx(ju,{e:a},a.term))})}function ju({e:t}){var o;const a=Qh(t.asset);return e.jsxs("div",{className:"help-row",children:[t.icon&&e.jsx("span",{className:"help-row-icon","aria-hidden":"true",children:t.icon}),e.jsxs("div",{className:"help-row-text",children:[a&&e.jsx("div",{className:"help-row-asset is-clip",children:t.asset}),e.jsx("dt",{children:t.term}),e.jsx("dd",{children:t.what}),((o=t.how)==null?void 0:o.length)>0&&e.jsx("ul",{className:"help-how",children:t.how.map(s=>e.jsx("li",{children:s},s))}),t.asset&&!a&&e.jsx("div",{className:"help-row-asset",children:t.asset}),t.more&&e.jsxs("details",{className:"help-more",children:[e.jsx("summary",{children:n("common.help.more.label")}),e.jsx("div",{className:"help-more-body",children:t.more})]})]})]})}function Su({sections:t,active:a,railRef:o}){return e.jsx("nav",{className:"help-rail","aria-label":n("common.help.rail.aria"),ref:o,children:t.map(s=>e.jsx("a",{href:`#help-${s.id}`,className:"help-rail-item"+(s.id===a?" is-active":""),"aria-current":s.id===a?"true":void 0,children:s.title},s.id))})}function Nu({sections:t=[],active:a}){const o=c.useRef(null),s=c.useRef(null),r=_e();return c.useEffect(()=>{var l,h,d;if(!a)return;if(r){(h=(l=s.current)==null?void 0:l.querySelector(".help-rail-item.is-active"))==null||h.scrollIntoView({inline:"center",block:"nearest",behavior:"instant"});return}const i=(d=o.current)==null?void 0:d.querySelector(`#help-${a}`);i==null||i.scrollIntoView({block:"start",behavior:"instant"})},[a,t,r]),e.jsxs("div",{className:"help-guide",children:[e.jsx(Su,{sections:t,active:a,railRef:s}),e.jsx("div",{className:"help-guide-body",ref:o,children:t.map(i=>e.jsxs("section",{id:`help-${i.id}`,className:"help-section",children:[e.jsx("h3",{className:"help-section-title",children:i.title}),e.jsx(zs,{entries:i.entries})]},i.id))})]})}function Tu({title:t,entries:a=[],sections:o=null,active:s,side:r="bottom",variant:i="ring"}){const[l,h]=c.useState(!1);if(!o&&!a.length)return null;const d=i==="pill";return e.jsxs(e.Fragment,{children:[e.jsx(ye,{label:n("common.help.button.tip",{name:t}),side:r,className:l?"is-open":"",children:e.jsx("button",{type:"button",className:(d?"topbar-add-btn tactile icon-only":"help-btn tactile")+(l?" is-open":""),"aria-label":n("common.help.button.aria",{name:t}),"aria-expanded":l,onClick:()=>h(!0),children:e.jsx(Oo,{size:d?18:22})})}),e.jsx(Hs,{open:l,title:t,wide:!!o,onClose:()=>h(!1),children:o?e.jsx(Nu,{sections:o,active:s}):e.jsx(zs,{entries:a})})]})}function Fa({label:t,value:a="",display:o,placeholder:s,hint:r,multiline:i=!1,inputMode:l,maxLength:h,input:d,onSave:m,busy:p=!1,disabled:u=!1,editLabel:f,nameCase:b=!1,fieldKey:y}){const[v,g]=c.useState(!1),[w,k]=c.useState(a),S=k,N=c.useRef(null);c.useEffect(()=>{v||k(a)},[a,v]),c.useEffect(()=>{var L;v&&((L=N.current)==null||L.focus())},[v]);async function j(){if(w===a)return g(!1);try{await(m==null?void 0:m(w))!==!1&&g(!1)}catch{}}function x(){k(a),g(!1)}const M=!i&&!d,q=L=>{L.key==="Escape"?(L.preventDefault(),x()):L.key==="Enter"&&M&&(L.preventDefault(),j())},E=c.useContext(Fs),O=c.useId(),_=c.useRef(w);_.current=w;const T=v&&w!==a;c.useEffect(()=>{if(!(!(E!=null&&E.register)||!y||!T))return E.register(O,{key:y,label:t,get:()=>_.current,close:()=>g(!1)}),()=>E.register(O,null)},[E,y,T,O,t]);const B=Array.isArray(a)?a.length>0:String(a??"").trim()!=="";return e.jsxs("div",{className:"inline-field",children:[e.jsxs("div",{className:"inline-field-head",children:[e.jsx($,{children:t}),r&&e.jsx(Le,{text:r,title:t}),e.jsx("span",{className:"flex-1"}),!v&&!u&&e.jsx(Ce,{icon:e.jsx(at,{}),ariaLabel:f||n("common.action.edit.field.aria",{field:String(t).toLowerCase()}),onClick:()=>g(!0)}),v&&e.jsxs(e.Fragment,{children:[e.jsx(Ce,{icon:e.jsx(ft,{}),ariaLabel:n("common.action.save.field.aria",{field:String(t).toLowerCase()}),disabled:p,onClick:j,tooltip:n("common.action.save.label"),ok:!0}),e.jsx(Ce,{icon:e.jsx(it,{}),ariaLabel:n("common.action.cancel.label"),disabled:p,onClick:x})]})]}),v?e.jsx("div",{onKeyDown:q,children:d?d({value:w,onChange:k,ref:N}):i?e.jsx("textarea",{ref:N,className:"tp-input",rows:4,value:w,"aria-label":t,onChange:L=>S(L.target.value)}):e.jsx("input",{ref:N,className:"tp-input",value:w,inputMode:l,maxLength:h,autoComplete:"off",autoCapitalize:b?"words":void 0,"aria-label":t,onChange:L=>S(L.target.value)})}):e.jsx("div",{className:"inline-field-value"+(B?"":" is-empty"),children:B?o||String(a):s||n("common.field.inline.placeholder")})]})}const Ut={remembered:{label:"common.status.remembered.label",color:"var(--ok)",filled:!0},forgetting:{label:"common.status.forgetting.label",color:"var(--amber)",filled:!0},"probably-forgotten":{label:"common.status.probably-forgotten.label",color:"var(--error)",filled:!0},unseen:{label:"common.status.unseen.label",color:"var(--faint)",filled:!1}};function Eu(t){return t<1?n("common.half-life.hours.label",{n:Math.max(1,Math.round(t*24))}):t<14?n("common.half-life.days.label",{n:Math.round(t)}):t<60?n("common.half-life.weeks.label",{n:Math.round(t/7)}):n("common.half-life.months.label",{n:Math.round(t/30)})}const ei=7,Cu=7;function ti(t,a){if(!t)return a;const o=Date.parse(String(t).replace(" ","T")+"Z");return Number.isNaN(o)?a:(Date.now()-o)/864e5}function Au(t={}){const{reviewed:a,stability:o,last_reviewed_at:s,last_result:r,created_at:i}=t;if(r!=="forgot"&&ti(i,1/0)<Cu){const f=Ut.remembered;return{key:"remembered",...f,tip:n("common.status.tip",{name:n(f.label),detail:n("common.status.new.detail")})}}if(!a)return{key:"unseen",...Ut.unseen,tip:n(Ut.unseen.label)};const l=Math.max(Number(o)||ei,ei),h=ti(s,0),d=Math.pow(2,-h/l),m=r==="forgot"?"probably-forgotten":d>=.9?"remembered":d>=.5?"forgetting":"probably-forgotten",p=Ut[m],u=h>=l?n("common.status.due.detail"):n("common.status.half-life.detail",{span:Eu(l)});return{key:m,...p,tip:n("common.status.tip",{name:n(p.label),detail:u})}}function Wl({item:t,side:a="top"}){const o=Au(t);return e.jsx(ye,{label:o.tip,side:a,children:e.jsx("span",{tabIndex:0,className:"status-dot","aria-label":o.tip,style:{background:o.filled?o.color:"transparent",borderColor:o.color}})})}function qu(t={},a=""){return t.review_excluded?t.work_review_excluded?n("common.quiz-skip.with-work.label",{kind:a||n("unit.work.one")}):n("common.quiz-skip.alone.label"):""}function $s({item:t,parent:a="",side:o="top",quiet:s=!1}){const r=qu(t,a);if(!r)return null;const i=e.jsx("span",{className:"quiz-skip-mark","aria-label":r,tabIndex:s?void 0:0,role:s?"img":void 0,children:e.jsx(Ys,{size:13})});return s?i:e.jsx(ye,{label:r,side:o,children:i})}function Dt({kind:t,className:a="",style:o}){return e.jsx("span",{className:"ph "+a,"aria-hidden":"true",style:o,children:e.jsx("span",{className:"mono-label ph-label",children:t===void 0?n("common.badge.cover"):t})})}function lo({count:t=9}){return e.jsx("div",{className:"sprockets","aria-hidden":"true",children:Array.from({length:t},(a,o)=>e.jsx("i",{},o))})}function Ul({left:t,code:a}){return e.jsxs("div",{className:"edge-row","aria-hidden":"true",children:[e.jsx("span",{children:t||n("common.filmstrip.edge.label")}),a!=null&&e.jsxs("span",{children:[a," ▸"]})]})}function Mu({children:t}){return e.jsx("span",{className:"frame-code","aria-hidden":"true",children:t})}function Gl(){return c.useMemo(()=>11+Math.floor(Math.random()*28),[])}const cs=(t,a=0)=>`${t+a}A`,ds=Object.fromEntries(xt.map(t=>[t,"dot-"+t]));function hs(t){return String(t).split(",").map(a=>a.trim()).filter(Boolean)}function ni(t){return(t||"").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9]+/g," ").trim()}function Mo(t){const a=String(t).trim(),o=a.replace(/[^\p{L}]/gu,"");return o&&o===o.toUpperCase()?a:a.replace(/\S+/g,s=>s.charAt(0).toUpperCase()+s.slice(1).toLowerCase())}function ve({children:t}){return t?e.jsx("p",{className:"tp-error",children:t}):null}function Vt({children:t}){return e.jsx("p",{className:"tp-empty",children:t})}function Ws({path:t,title:a,onClose:o}){return ja(!0,o),c.useEffect(()=>{const s=r=>{r.key==="Escape"&&o()};return document.addEventListener("keydown",s),()=>document.removeEventListener("keydown",s)},[]),Ue.createPortal(e.jsxs("div",{className:"lightbox",role:"dialog","aria-modal":"true","aria-label":a?n("common.cover.alt",{title:a}):n("common.cover.lightbox.untitled.aria"),onClick:o,children:[e.jsx("button",{type:"button",className:"lightbox-close","aria-label":n("common.action.close.label"),onClick:o,children:e.jsx(it,{})}),e.jsx("img",{src:$e(t),alt:a?n("common.cover.alt",{title:a}):"",className:"lightbox-img",onClick:s=>s.stopPropagation()})]}),document.body)}function Ou({path:t,title:a,large:o=!1,hero:s=!1,zoomable:r=!1}){const[i,l]=c.useState(!1);if(s){if(t){const d=e.jsx("img",{src:$e(t),alt:a?n("common.cover.alt",{title:a}):"",className:"block w-full rounded-md object-cover",style:{aspectRatio:"2 / 3",border:"1px solid var(--ink-border)"}});return r?e.jsxs(e.Fragment,{children:[e.jsx(ye,{label:n("common.cover.zoom.tip"),className:"block w-full",children:e.jsx("button",{type:"button",className:"cover-zoom-btn","aria-label":a?n("common.cover.zoom.aria",{title:a}):n("common.cover.zoom.untitled.aria"),onClick:()=>l(!0),children:d})}),i&&e.jsx(Ws,{path:t,title:a,onClose:()=>l(!1)})]}):d}return e.jsx(Dt,{kind:n("common.badge.cover"),className:"w-full"})}const h=o?"h-36 w-24":"h-14 w-10";return t?e.jsx("img",{src:$e(t),alt:a?n("common.cover.alt",{title:a}):"",className:h+" shrink-0 rounded-md object-cover",style:{border:"1px solid var(--ink-border)"}}):e.jsx(Dt,{kind:o?n("common.badge.cover"):"",className:h+" shrink-0"})}function Qa({kind:t}){const a={width:15,height:15,viewBox:"0 0 16 16",fill:"none",stroke:"currentColor",strokeWidth:1.6,strokeLinecap:"round",strokeLinejoin:"round"};return t==="tiles"?e.jsxs("svg",{...a,"aria-hidden":"true",children:[e.jsx("rect",{x:"1.5",y:"1.5",width:"5.5",height:"7"}),e.jsx("rect",{x:"9",y:"1.5",width:"5.5",height:"4.5"}),e.jsx("rect",{x:"1.5",y:"10",width:"5.5",height:"4.5"}),e.jsx("rect",{x:"9",y:"7.5",width:"5.5",height:"7"})]}):t==="list"?e.jsxs("svg",{...a,"aria-hidden":"true",children:[e.jsx("line",{x1:"2",y1:"4",x2:"14",y2:"4"}),e.jsx("line",{x1:"2",y1:"8",x2:"14",y2:"8"}),e.jsx("line",{x1:"2",y1:"12",x2:"14",y2:"12"})]}):e.jsxs("svg",{...a,"aria-hidden":"true",children:[e.jsx("rect",{x:"1.5",y:"2.5",width:"13",height:"11"}),e.jsx("line",{x1:"1.5",y1:"6.5",x2:"14.5",y2:"6.5"}),e.jsx("line",{x1:"6",y1:"2.5",x2:"6",y2:"13.5"})]})}function co({value:t,onChange:a}){return e.jsx(Ye,{ariaLabel:n("common.view.toggle.aria"),value:t,onChange:a,options:[["tiles",e.jsxs(e.Fragment,{children:[e.jsx(Qa,{kind:"tiles"})," ",n("common.view.tiles.label")]})],["list",e.jsxs(e.Fragment,{children:[e.jsx(Qa,{kind:"list"})," ",n("common.view.list.label")]})],["table",e.jsxs(e.Fragment,{children:[e.jsx(Qa,{kind:"table"})," ",n("common.view.table.label")]})]]})}function Lu(t,a="asc"){const[o,s]=c.useState({col:t,dir:a});return{sort:o,toggle:l=>s(h=>h.col===l?{col:l,dir:h.dir==="asc"?"desc":"asc"}:{col:l,dir:"asc"}),apply:(l,h)=>{const d=h[o.col];if(!d)return l;const m=o.dir==="asc"?1:-1;return[...l].sort((p,u)=>{const f=d(p),b=d(u);return f<b?-m:f>b?m:0})}}}function ai({col:t,label:a,sort:o,onSort:s,className:r=""}){const i=o.col===t?o.dir==="asc"?" ▲":" ▼":"";return e.jsx("th",{className:"sortable "+r,onClick:()=>s(t),"aria-sort":o.col===t?o.dir==="asc"?"ascending":"descending":"none",children:e.jsx(ye,{label:n("common.table.sort.tip"),side:"bottom",children:e.jsxs("span",{children:[a,i]})})})}function ct(t){return"tp-filter-chip tactile"+(t?" active":"")}function Sw({options:t,onToggle:a,ariaLabel:o,className:s=""}){return e.jsx("div",{className:"flex flex-wrap items-center gap-2 "+s,role:"group","aria-label":o,children:t.map(r=>e.jsx(ye,{label:r.locked||r.hint||"",children:e.jsx("button",{type:"button",className:ct(r.on),"aria-pressed":r.on,"aria-disabled":!!r.locked,onClick:()=>{r.locked||a(r.key,!r.on)},children:r.label})},r.key))})}function _u({active:t,icon:a,keepLabel:o,label:s,tooltip:r,onClick:i,...l}){const h=e.jsx("button",{type:"button",className:ct(t)+(a&&!o?" has-btn-icon":""),"aria-pressed":!!t,onClick:i,...l,children:a?e.jsxs(e.Fragment,{children:[e.jsx("span",{className:"btn-icon",children:a}),e.jsx("span",{className:o?"btn-label-fixed":"btn-label",children:s})]}):s});return!a||o?h:e.jsx(ye,{label:r||s,children:h})}function oi({genres:t,value:a,onChange:o}){return!t||t.length===0?null:e.jsx(Oe,{ariaLabel:n("common.filters.genre.aria"),value:a,onChange:o,options:[["",n("common.filters.genre.all.label")],...t.map(s=>[s,s])]})}function Us(t){return t.series?t.series_index?`${t.series} #${t.series_index}`:t.series:""}function ho(t,a){const o=t.series||"",s=a.series||"";if(o!==s)return o?s?o.localeCompare(s):-1:1;const r=t.series_index||0,i=a.series_index||0;return r!==i?r-i:t.title.localeCompare(a.title)}function Kl(t,a){const o=t.last_read_at||"",s=a.last_read_at||"";return o!==s?s.localeCompare(o):(t.title||"").localeCompare(a.title||"")}function Rt(t,a=!1){const o=Number(t);if(!o)return"";const s=a?o<0?"common.year.circa.bce.label":"common.year.circa.ce.label":o<0?"common.year.bce.label":"common.year.ce.label";return n(s,{year:o<0?-o:o})}function hn(t){let a=String(t??"").trim();if(!a)return{year:0,circa:!1};let o=!1;const s=a.match(/^(?:circa|ca|c)\.?\s*/i);s&&s[0].length<a.length&&(o=!0,a=a.slice(s[0].length).trim());let r=!1;const i=a.match(/\s*\b(b\.?\s*c\.?(?:\s*e\.?)?|a\.?\s*d\.?|c\.?\s*e\.?)\.?\s*$/i);i&&(r=i[1].replace(/[^a-z]/gi,"").toLowerCase().startsWith("b"),a=a.slice(0,i.index).trim());const l=Number(a);return!Number.isInteger(l)||l===0?{year:0,circa:!1}:{year:r?-Math.abs(l):l,circa:o}}function nt({value:t,onChange:a,ariaLabel:o,showAll:s=!1,collapsible:r=!1,mini:i=!1,disabled:l=!1}){const h=c.useRef(null),d=s?Vr:Vr.filter(f=>!Gh(f)||f===t),m=Math.max(0,d.indexOf(t)),p=f=>{var w;const b=f.key==="ArrowRight"||f.key==="ArrowDown"?1:f.key==="ArrowLeft"||f.key==="ArrowUp"?-1:0;if(!b)return;f.preventDefault();const y=(w=h.current)==null?void 0:w.querySelectorAll("button");if(!(y!=null&&y.length))return;const v=[...y].indexOf(document.activeElement),g=(((v<0?m:v)+b)%y.length+y.length)%y.length;y[g].focus()},u=e.jsx("span",{ref:h,role:"radiogroup","aria-label":o||n("common.field.colour.label"),onKeyDown:p,className:"flex items-center gap-1.5",children:d.map((f,b)=>e.jsx(ye,{label:n("common.colour.pick.tip",{name:Mn(f)}),children:e.jsx("button",{type:"button",role:"radio","aria-checked":t===f,"aria-label":Mn(f),tabIndex:b===m?0:-1,disabled:l,onClick:()=>a(f),className:"color-dot-btn",children:e.jsx("span",{className:"color-dot "+ds[f]+(t===f?" active":"")})})},f))});return i?e.jsx(si,{value:t,offered:d,onChange:a,ariaLabel:o,disabled:l,framed:!0}):r?e.jsxs(e.Fragment,{children:[e.jsx("span",{className:"cs-full",children:u}),e.jsx("span",{className:"cs-mini",children:e.jsx(si,{value:t,offered:d,onChange:a,ariaLabel:o,disabled:l})})]}):u}function si({value:t,offered:a,onChange:o,ariaLabel:s,disabled:r=!1,framed:i=!1}){const[l,h]=c.useState(!1),d=c.useRef(null),{popRef:m,style:p}=qt(l,d,{prefer:"above",minHeight:140}),u=()=>h(!1);return Mt(l,u,[d,m],{onEscape:()=>{var f,b;return(b=(f=d.current)==null?void 0:f.querySelector("button"))==null?void 0:b.focus()}}),e.jsxs("span",{className:"cs-menu-wrap",ref:d,children:[e.jsx(ye,{label:t?n("common.colour.current.tip",{name:Mn(t)}):n("common.colour.pick.empty.tip"),children:e.jsx("button",{type:"button",className:"cs-menu-btn"+(i?" cs-menu-btn-framed tp-btn tp-btn-ghost tactile":""),"aria-haspopup":"true","aria-expanded":l,"aria-label":s,disabled:r,onClick:()=>h(f=>!f),children:i&&!t?e.jsx(ec,{}):e.jsxs(e.Fragment,{children:[e.jsx("span",{className:"color-dot "+(ds[t]||"")+(t?" active":"")}),e.jsx(uo,{open:l,size:14})]})})}),l&&Ue.createPortal(e.jsx("span",{ref:m,className:"cs-menu token-menu",role:"radiogroup","aria-label":s,style:p,children:a.map(f=>e.jsxs("button",{type:"button",role:"radio","aria-checked":t===f,className:"cs-menu-row",onClick:()=>{o(f),u()},children:[e.jsx("span",{className:"color-dot "+ds[f]+(t===f?" active":"")}),e.jsx("span",{className:"cs-menu-name",children:Mn(f)})]},f))}),document.body)]})}const Ee=24;function Pe({icon:t,label:a,ariaLabel:o,tooltip:s,tipSide:r="top",danger:i=!1,ok:l=!1,className:h="",wrapClassName:d="",onClick:m,style:p,...u}){const f=s===void 0?o:s,b=a!=null&&a!=="";return e.jsx(ye,{label:f,side:r,className:d,children:e.jsx("button",{type:"button",className:`tp-btn tp-btn-ghost tactile flex items-center justify-center rounded-full${b?" has-btn-icon":""}${i?" tp-btn-danger":""}${l?" tp-btn-ok":""} ${h}`,style:b?{height:44,flexShrink:0,...p}:{width:44,height:44,padding:0,flexShrink:0,...p},"aria-label":o,onClick:m,...u,children:b?e.jsxs(e.Fragment,{children:[e.jsx("span",{className:"btn-icon",children:t}),e.jsx("span",{className:"btn-label",children:a})]}):t})})}function Ce({icon:t,ariaLabel:a,tooltip:o,tipSide:s="top",ok:r=!1,danger:i=!1,boxed:l=!1,active:h=!1,busy:d=!1,className:m="",wrapClassName:p="",onClick:u,...f}){const b=o===void 0?a:o;return e.jsx(ye,{label:b,side:s,className:p,children:e.jsx("button",{type:"button",className:"field-icon-btn tactile"+(r?" field-icon-btn-ok":"")+(i?" field-icon-btn-danger":"")+(l?" field-icon-btn-boxed":"")+(h?" is-active":"")+(d?" is-busy":"")+(m?` ${m}`:""),"aria-label":a,onClick:u,...f,children:t})})}const we={width:Ee,height:Ee,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:1.85,strokeLinecap:"round",strokeLinejoin:"round","aria-hidden":"true"};function Zt(){return e.jsxs("svg",{...we,children:[e.jsx("path",{d:"M19 12H5"}),e.jsx("path",{d:"M12 19l-7-7 7-7"})]})}function Ht(){return e.jsx("svg",{...we,children:e.jsx("path",{d:"M22 3H2l9 9v9l4-2v-7z"})})}function rt(){return e.jsxs("svg",{...we,children:[e.jsx("path",{d:"M12 3v12"}),e.jsx("path",{d:"M7 10l5 5 5-5"}),e.jsx("path",{d:"M4 18h16"})]})}function at(){return e.jsx("svg",{...we,children:e.jsx("path",{d:"M17 3l4 4L7 19H3v-4z"})})}function Fe(){return e.jsxs("svg",{...we,children:[e.jsx("path",{d:"M3 6h18"}),e.jsx("path",{d:"M8 3V2h8v1"}),e.jsx("path",{d:"M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"}),e.jsx("path",{d:"M10 11v6"}),e.jsx("path",{d:"M14 11v6"})]})}function tt(){return e.jsxs("svg",{...we,children:[e.jsx("path",{d:"M12 5v14"}),e.jsx("path",{d:"M5 12h14"})]})}function kt(){return e.jsxs("svg",{...we,children:[e.jsx("circle",{cx:"11",cy:"11",r:"7"}),e.jsx("path",{d:"M21 21l-4.3-4.3"})]})}function ri(){return e.jsxs("svg",{...we,children:[e.jsx("circle",{cx:"11",cy:"11",r:"7"}),e.jsx("path",{d:"M21 21l-4.3-4.3"}),e.jsx("path",{d:"M4.2 11h13.6"}),e.jsx("path",{d:"M11 4.1c1.7 1.9 2.6 4.3 2.6 6.9s-.9 5-2.6 6.9c-1.7-1.9-2.6-4.3-2.6-6.9s.9-5 2.6-6.9"})]})}function Gs(){return e.jsxs("svg",{...we,children:[e.jsx("path",{d:"M6.5 4.5h11a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3h-6.2L7 20.9v-3.4h-.5a3 3 0 0 1-3-3v-7a3 3 0 0 1 3-3z"}),e.jsx("path",{d:"M8.3 14h1.9l1.2-2.6V8H7.4v3.4h1.8L8.3 14Z",fill:"currentColor",stroke:"none"}),e.jsx("path",{d:"M13.5 14h1.9l1.2-2.6V8h-4v3.4h1.8L13.5 14Z",fill:"currentColor",stroke:"none"})]})}function Ru(){return e.jsxs("svg",{width:"18",height:"18",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"1.85",strokeLinecap:"round",strokeLinejoin:"round","aria-hidden":"true",children:[e.jsx("path",{d:"M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"}),e.jsx("circle",{cx:"12",cy:"12",r:"3.2"})]})}function Du(){return e.jsxs("svg",{width:"18",height:"18",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"1.85",strokeLinecap:"round",strokeLinejoin:"round","aria-hidden":"true",children:[e.jsx("path",{d:"M9.9 5.9A9.3 9.3 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3 3.8"}),e.jsx("path",{d:"M6.3 7.7A17.6 17.6 0 0 0 2.5 12S6 18.5 12 18.5a9.4 9.4 0 0 0 3.6-.7"}),e.jsx("path",{d:"M4 4l16 16"})]})}function Iu(){return e.jsx(Qa,{kind:"tiles"})}function Vl(){return e.jsxs("svg",{...we,children:[e.jsx("circle",{cx:"12",cy:"5",r:"1.4",fill:"currentColor",stroke:"none"}),e.jsx("circle",{cx:"12",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"}),e.jsx("circle",{cx:"12",cy:"19",r:"1.4",fill:"currentColor",stroke:"none"})]})}function En(){return e.jsxs("svg",{...we,children:[e.jsx("circle",{cx:"17.5",cy:"5.5",r:"2.4"}),e.jsx("circle",{cx:"17.5",cy:"18.5",r:"2.4"}),e.jsx("circle",{cx:"6.5",cy:"12",r:"2.4"}),e.jsx("path",{d:"m8.7 10.9 6.6-3.9"}),e.jsx("path",{d:"m8.7 13.1 6.6 3.9"})]})}function la(){return e.jsxs("svg",{...we,children:[e.jsx("path",{d:"M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"}),e.jsx("path",{d:"M12 3.5v11"}),e.jsx("path",{d:"m7.5 8 4.5-4.5 4.5 4.5"})]})}function Pu(){return e.jsxs("svg",{...we,children:[e.jsx("path",{d:"M10 13.5a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 1 0-5-5l-1.5 1.5"}),e.jsx("path",{d:"M14 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 1 0 5 5l1.5-1.5"})]})}function Hn(){return e.jsxs("svg",{...we,children:[e.jsx("rect",{x:"3.5",y:"11",width:"17",height:"9.5",rx:"2.5"}),e.jsx("path",{d:"M12 3v5.6"}),e.jsx("path",{d:"m9 5.8 3 3 3-3"}),e.jsx("path",{d:"M7.5 15h9"}),e.jsx("path",{d:"M7.5 18h5"})]})}function Yl(){return e.jsxs("svg",{...we,children:[e.jsx("path",{d:"M4 7h16"}),e.jsx("path",{d:"M4 12h16"}),e.jsx("path",{d:"M4 17h12"})]})}function ft(){return e.jsx("svg",{...we,children:e.jsx("path",{d:"M5 13l4 4L19 7"})})}function it(){return e.jsx("svg",{...we,children:e.jsx("path",{d:"M6 6l12 12M18 6 6 18"})})}function Ks({size:t=18}){return e.jsxs("svg",{...we,width:t,height:t,children:[e.jsx("path",{d:"M12 7.2C10.3 5.6 7.6 5 4 5.4v12.3c3.6-.4 6.3.2 8 1.8"}),e.jsx("path",{d:"M12 7.2c1.7-1.6 4.4-2.2 8-1.8v12.3c-3.6-.4-6.3.2-8 1.8"}),e.jsx("path",{d:"M12 7.2v13.3"})]})}function Ql({size:t=18}){return e.jsx("svg",{...we,width:t,height:t,children:e.jsx("path",{d:"M7.5 4.8v14.4L19 12z",fill:"currentColor"})})}function Xl({size:t=18}){return e.jsxs("svg",{...we,width:t,height:t,children:[e.jsx("rect",{x:"3.5",y:"5",width:"17",height:"15",rx:"2.5"}),e.jsx("path",{d:"M3.5 10h17"}),e.jsx("path",{d:"M8 3.5v3"}),e.jsx("path",{d:"M16 3.5v3"})]})}function Oo({size:t=22}){return e.jsxs("svg",{...we,width:t,height:t,children:[e.jsx("circle",{cx:"12",cy:"12",r:"8.75"}),e.jsx("path",{d:"M9.4 9.5a2.6 2.6 0 1 1 3.2 2.5c-.5.15-.75.5-.75 1v.6"}),e.jsx("path",{d:"M11.85 16.6v.01"})]})}function un({size:t=Ee}){return e.jsxs("svg",{...we,width:t,height:t,children:[e.jsx("rect",{x:"3.5",y:"4",width:"17",height:"16",rx:"2.5"}),e.jsx("path",{d:"M7.5 9h9"}),e.jsx("path",{d:"M7.5 12.5h9"}),e.jsx("path",{d:"M7.5 16h5"})]})}function ca({size:t=Ee}){return e.jsxs("svg",{...we,width:t,height:t,children:[e.jsx("rect",{x:"9",y:"9",width:"11.5",height:"11.5",rx:"2.5"}),e.jsx("path",{d:"M15 6.5A2.5 2.5 0 0 0 12.5 4h-6A2.5 2.5 0 0 0 4 6.5v6A2.5 2.5 0 0 0 6.5 15"})]})}function Jl({size:t=Ee}){return e.jsxs("svg",{...we,width:t,height:t,children:[e.jsx("path",{d:"M4 10h9.5a5 5 0 0 1 0 10H8"}),e.jsx("path",{d:"m7.5 6-3.5 4 3.5 4"})]})}function uo({open:t=!1,size:a=22}){return e.jsx("svg",{...we,width:a,height:a,children:e.jsx("path",{d:t?"M6 14.5 12 8.5l6 6":"M6 9.5 12 15.5l6-6"})})}function Nw({size:t=Ee}){return e.jsxs("svg",{...we,width:t,height:t,children:[e.jsx("path",{d:"M14 3.5h6.5V10"}),e.jsx("path",{d:"M20.5 3.5 12 12"}),e.jsx("path",{d:"M18 14v4.5a2 2 0 0 1-2 2H5.5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2H10"})]})}function Bu({size:t=Ee}){return e.jsxs("svg",{...we,width:t,height:t,children:[e.jsx("path",{d:"M5 3.5v3c0 3 2.5 5.5 5.5 5.5H19"}),e.jsx("path",{d:"M5 20.5v-3c0-3 2.5-5.5 5.5-5.5"}),e.jsx("path",{d:"m15.5 8.5 3.5 3.5-3.5 3.5"})]})}function mo({size:t=Ee}){return e.jsxs("svg",{...we,width:t,height:t,children:[e.jsx("circle",{cx:"9",cy:"8",r:"3.2"}),e.jsx("path",{d:"M3.5 19a5.5 5.5 0 0 1 11 0"}),e.jsx("path",{d:"M16 5.2a3.2 3.2 0 0 1 0 6"}),e.jsx("path",{d:"M17 14.2a5.5 5.5 0 0 1 3.5 4.8"})]})}function Fu({size:t=Ee}){return e.jsxs("svg",{...we,width:t,height:t,children:[e.jsx("circle",{cx:"12",cy:"8",r:"3.6"}),e.jsx("path",{d:"M5.5 19.5a6.5 6.5 0 0 1 13 0"})]})}function Hu({size:t=Ee}){return e.jsxs("svg",{...we,width:t,height:t,children:[e.jsx("circle",{cx:"10",cy:"8",r:"3.4"}),e.jsx("path",{d:"M3.5 19.5a6.5 6.5 0 0 1 10.7-4.4"}),e.jsx("path",{d:"M18 14.5v6"}),e.jsx("path",{d:"M15 17.5h6"})]})}function zu({size:t=Ee}){return e.jsxs("svg",{...we,width:t,height:t,children:[e.jsx("circle",{cx:"8.5",cy:"7.5",r:"3.2"}),e.jsx("path",{d:"M3 18.5a5.5 5.5 0 0 1 9-4.2"}),e.jsx("path",{d:"M14 16.5h6.5"}),e.jsx("path",{d:"m18 14 2.5 2.5L18 19"})]})}function $u({size:t=Ee}){return e.jsxs("svg",{...we,width:t,height:t,children:[e.jsx("path",{d:"M10 4.5H6.5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2H10"}),e.jsx("path",{d:"M9.5 12h10"}),e.jsx("path",{d:"m16 8.5 3.5 3.5-3.5 3.5"})]})}function Wu({size:t=Ee}){return e.jsxs("svg",{...we,width:t,height:t,children:[e.jsx("circle",{cx:"8",cy:"12",r:"4"}),e.jsx("path",{d:"M12 12h8.5"}),e.jsx("path",{d:"M17 12v3.5"}),e.jsx("path",{d:"M20.5 12v2.5"})]})}function Tw({size:t=Ee}){return e.jsxs("svg",{...we,width:t,height:t,children:[e.jsx("rect",{x:"7",y:"2.5",width:"10",height:"19",rx:"2.5"}),e.jsx("path",{d:"M10.5 18.5h3"})]})}function Uu({size:t=Ee}){return e.jsxs("svg",{...we,width:t,height:t,children:[e.jsx("rect",{x:"3",y:"4.5",width:"18",height:"4",rx:"1.2"}),e.jsx("path",{d:"M4.8 8.5v10a2 2 0 0 0 2 2h10.4a2 2 0 0 0 2-2v-10"}),e.jsx("path",{d:"M10 12.5h4"})]})}function Ew({size:t=Ee}){return e.jsxs("svg",{...we,width:t,height:t,children:[e.jsx("rect",{x:"3",y:"4.5",width:"18",height:"4",rx:"1.2"}),e.jsx("path",{d:"M4.8 8.5v10a2 2 0 0 0 2 2h10.4a2 2 0 0 0 2-2v-10"}),e.jsx("path",{d:"M12 18v-6"}),e.jsx("path",{d:"m9.3 14.7 2.7-2.7 2.7 2.7"})]})}function Gu({size:t=Ee}){return e.jsxs("svg",{...we,width:t,height:t,children:[e.jsx("rect",{x:"3.5",y:"4.5",width:"17",height:"15",rx:"2.5"}),e.jsx("circle",{cx:"8.8",cy:"9.6",r:"1.6"}),e.jsx("path",{d:"m4.5 17 4.6-4.6a1.6 1.6 0 0 1 2.3 0l3 3"}),e.jsx("path",{d:"m13.7 14.2 1.9-1.9a1.6 1.6 0 0 1 2.3 0l2.1 2.1"})]})}function Ku({size:t=Ee}){return e.jsxs("svg",{...we,width:t,height:t,children:[e.jsx("path",{d:"M20.5 12a8.5 8.5 0 1 1-2.9-6.4"}),e.jsx("path",{d:"M20.5 3.5V9.2h-5.7"})]})}function Cw({size:t=Ee}){return e.jsxs("svg",{...we,width:t,height:t,children:[e.jsx("path",{d:"M6 21V3.5"}),e.jsx("path",{d:"M6 4.5h11.5l-2.6 3.8 2.6 3.8H6"})]})}function Aw({size:t=Ee}){return e.jsx("svg",{...we,width:t,height:t,children:e.jsx("path",{d:"M6.5 3.5h11v17l-5.5-4.2-5.5 4.2z"})})}function Vu({size:t=Ee}){return e.jsxs("svg",{...we,width:t,height:t,children:[e.jsx("path",{d:"M4 7V4.5h16V7"}),e.jsx("path",{d:"M12 4.5v15"}),e.jsx("path",{d:"M8.5 19.5h7"})]})}function Yu({size:t=Ee}){return e.jsxs("svg",{...we,width:t,height:t,children:[e.jsx("path",{d:"M2.5 5.5h8.5"}),e.jsx("path",{d:"M6.8 3.5v2"}),e.jsx("path",{d:"M9 5.5c0 3.7-2.4 6.8-6.5 8.3"}),e.jsx("path",{d:"M4.4 8.9c1.1 2.3 3 4 5.4 4.9"}),e.jsx("path",{d:"m12.8 20.5 4.6-10.5 4.6 10.5"}),e.jsx("path",{d:"M14.4 16.8h6"})]})}function po({size:t=Ee}){return e.jsxs("svg",{...we,width:t,height:t,children:[e.jsx("path",{d:"M3.5 12h11"}),e.jsx("path",{d:"m10.5 8 4 4-4 4"}),e.jsx("path",{d:"M19 4.5v15"})]})}function Qu({size:t=Ee}){return e.jsxs("svg",{...we,width:t,height:t,children:[e.jsx("rect",{x:"2.5",y:"9",width:"19",height:"6",rx:"1.5"}),e.jsx("path",{d:"M6.8 9v2.6"}),e.jsx("path",{d:"M10.6 9v3.8"}),e.jsx("path",{d:"M14.4 9v2.6"}),e.jsx("path",{d:"M18.2 9v3.8"})]})}function Zl({size:t=Ee}){return e.jsxs("svg",{...we,width:t,height:t,children:[e.jsx("path",{d:"M4 12.7V5.5A1.5 1.5 0 0 1 5.5 4h7.2a2 2 0 0 1 1.4.6l6 6a1.8 1.8 0 0 1 0 2.5l-6.4 6.4a1.8 1.8 0 0 1-2.5 0l-6-6a2 2 0 0 1-.6-1.4Z"}),e.jsx("circle",{cx:"8.8",cy:"8.8",r:"1.2"})]})}function Xu({size:t=Ee}){return e.jsxs("svg",{...we,width:t,height:t,children:[e.jsx("path",{d:"M4 4.5h3.5v15H4z"}),e.jsx("path",{d:"M8.8 4.5h3.5v15H8.8z"}),e.jsx("path",{d:"m14.2 5.4 3.4-.9 3.9 14.5-3.4.9z"})]})}function qw({size:t=Ee}){return e.jsxs("svg",{...we,width:t,height:t,children:[e.jsx("path",{d:"M5 5.5A2 2 0 0 1 7 3.5h6.5a2 2 0 0 1 2 2v2.2"}),e.jsx("path",{d:"M5 5.5v13a2 2 0 0 0 2 2h3.4"}),e.jsx("path",{d:"M8.5 8.6h4"}),e.jsx("path",{d:"m19.9 8.5-7.7 7.7-3.3 1 1-3.3 7.7-7.7a1.6 1.6 0 0 1 2.3 2.3Z"})]})}function Mw({size:t=Ee}){return e.jsxs("svg",{...we,width:t,height:t,children:[e.jsx("path",{d:"M3.5 6.5A2 2 0 0 1 5.5 4.5h6a2 2 0 0 1 2 2V9a2 2 0 0 1-2 2H7l-3.5 2.5V11z"}),e.jsx("path",{d:"M16 10.5h2.5a2 2 0 0 1 2 2V15a2 2 0 0 1-2 2H17l-3.5 2.5V17h-1a2 2 0 0 1-2-2v-.6"})]})}function Ju({size:t=Ee}){return e.jsxs("svg",{...we,width:t,height:t,children:[e.jsx("circle",{cx:"12",cy:"12",r:"8.5"}),e.jsx("circle",{cx:"12",cy:"12",r:"1.5"}),e.jsx("circle",{cx:"12",cy:"6.4",r:"1"}),e.jsx("circle",{cx:"17.6",cy:"12",r:"1"}),e.jsx("circle",{cx:"12",cy:"17.6",r:"1"}),e.jsx("circle",{cx:"6.4",cy:"12",r:"1"})]})}function Zu({size:t=Ee}){return e.jsxs("svg",{...we,width:t,height:t,children:[e.jsx("path",{d:"M4 11.2 12 4.5l8 6.7"}),e.jsx("path",{d:"M6 9.8V19a1 1 0 0 0 1 1h3.4v-4.6a1.6 1.6 0 0 1 3.2 0V20H17a1 1 0 0 0 1-1V9.8"})]})}function em({size:t=Ee}){return e.jsxs("svg",{...we,width:t,height:t,children:[e.jsx("rect",{x:"4.5",y:"8.5",width:"11.5",height:"10",rx:"2"}),e.jsx("path",{d:"M7.5 6.2h8A2.5 2.5 0 0 1 18 8.7v7.8"})]})}function tm({size:t=Ee}){return e.jsxs("svg",{...we,width:t,height:t,children:[e.jsx("rect",{x:"4.5",y:"11",width:"4",height:"7.5",rx:"1"}),e.jsx("rect",{x:"10",y:"5.5",width:"4",height:"13",rx:"1"}),e.jsx("rect",{x:"15.5",y:"8",width:"4",height:"10.5",rx:"1"})]})}function nm({size:t=Ee}){return e.jsxs("svg",{...we,width:t,height:t,children:[e.jsx("path",{d:"M4 8h9"}),e.jsx("path",{d:"M17 8h3"}),e.jsx("circle",{cx:"15",cy:"8",r:"2"}),e.jsx("path",{d:"M4 16h3"}),e.jsx("path",{d:"M11 16h9"}),e.jsx("circle",{cx:"9",cy:"16",r:"2"})]})}function am({size:t=Ee}){return e.jsxs("svg",{...we,width:t,height:t,children:[e.jsx("path",{d:"M5 13.5V17a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 17v-3.5"}),e.jsx("path",{d:"M12 4v9"}),e.jsx("path",{d:"m8.5 9.5 3.5 3.5 3.5-3.5"})]})}function Vs({size:t=Ee}){return e.jsx("svg",{...we,width:t,height:t,children:e.jsx("path",{d:"M12 20.2c-1.6-1.2-7.5-5-7.5-9.9A4 4 0 0 1 12 8.1a4 4 0 0 1 7.5 2.2c0 4.9-5.9 8.7-7.5 9.9Z"})})}function ec({size:t=Ee}){return e.jsx("svg",{...we,width:t,height:t,children:e.jsx("path",{d:"M12 3.4c3.6 4.2 5.6 6.9 5.6 9.4a5.6 5.6 0 1 1-11.2 0c0-2.5 2-5.2 5.6-9.4Z"})})}function om({size:t=Ee}){return e.jsxs("svg",{...we,width:t,height:t,children:[e.jsx("path",{d:"M3 7h3.5l3 4"}),e.jsx("path",{d:"M14.5 16H18"}),e.jsx("path",{d:"M3 17h3.5l7-10H18"}),e.jsx("path",{d:"M16 5l2.5 2L16 9"}),e.jsx("path",{d:"M16 14l2.5 2L16 18"})]})}function Ct({size:t=Ee}){return e.jsxs("svg",{...we,width:t,height:t,children:[e.jsx("rect",{x:"4",y:"5",width:"16",height:"14",rx:"2.5"}),e.jsx("path",{d:"M9.9 10.2a2.2 2.2 0 1 1 2.7 2.1c-.42.13-.63.42-.63.85v.5"}),e.jsx("path",{d:"M11.97 16.1v.01"})]})}function Ys({size:t=Ee}){return e.jsxs("svg",{...we,width:t,height:t,children:[e.jsx("rect",{x:"4",y:"5",width:"16",height:"14",rx:"2.5"}),e.jsx("path",{d:"m6.6 17.4 10.8-10.8"})]})}function sm({size:t=Ee}){return e.jsxs("svg",{...we,width:t,height:t,children:[e.jsx("circle",{cx:"12",cy:"9.2",r:"5.7"}),e.jsx("path",{d:"m8.4 14.2-1.4 6.3 5-2.8 5 2.8-1.4-6.3"})]})}function Qs({size:t=Ee}){return e.jsxs("svg",{...we,width:t,height:t,children:[e.jsx("path",{d:"M9.8 5h9.4"}),e.jsx("path",{d:"M9.8 12h9.4"}),e.jsx("path",{d:"M9.8 19h9.4"}),e.jsx("path",{d:"M7 5c-1.3 0-1.3 6-2.5 7 1.2 1 1.2 7 2.5 7"})]})}function pa({name:t}){switch(t){case"home":return e.jsx(Zu,{});case"quotes":return e.jsx(Gs,{});case"anthologies":return e.jsx(Qs,{});case"library":return e.jsx(Xu,{});case"movies":return e.jsx(Ju,{});case"metadata":return e.jsx(em,{});case"import":return e.jsx(am,{});case"search":return e.jsx(kt,{});case"tags":return e.jsx(Zl,{});case"stats":return e.jsx(tm,{});case"settings":return e.jsx(nm,{});case"profile":return e.jsx(Fu,{});case"users":return e.jsx(mo,{});default:return null}}const zn={...we,width:16,height:16};function rm(){return e.jsxs("svg",{...zn,children:[e.jsx("path",{d:"M12 6.6C10 5.1 7 4.8 4 5.3v12.4c3-.5 6-.2 8 1.3 2-1.5 5-1.8 8-1.3V5.3c-3-.5-6-.2-8 1.3Z"}),e.jsx("path",{d:"M12 6.6V19"})]})}function im(){return e.jsxs("svg",{...zn,children:[e.jsx("path",{d:"M3.5 20h17"}),e.jsx("path",{d:"M6 17V8"}),e.jsx("path",{d:"M10 17V6"}),e.jsx("path",{d:"M14 17V9"}),e.jsx("path",{d:"M18 17V7"})]})}function lm(){return e.jsxs("svg",{...zn,children:[e.jsx("path",{d:"M3.5 8 12 4l8.5 4-8.5 4z"}),e.jsx("path",{d:"M3.5 8v8l8.5 4 8.5-4V8"})]})}function cm(){return e.jsxs("svg",{...zn,children:[e.jsx("rect",{x:"3",y:"5",width:"18",height:"14",rx:"2"}),e.jsx("path",{d:"M7 5v14"}),e.jsx("path",{d:"M17 5v14"}),e.jsx("path",{d:"M3 12h18"})]})}function dm(){return e.jsxs("svg",{...zn,children:[e.jsx("rect",{x:"3",y:"7.5",width:"18",height:"12",rx:"2"}),e.jsx("path",{d:"m8 3.5 4 4 4-4"})]})}function hm(){return e.jsxs("svg",{...zn,children:[e.jsx("circle",{cx:"12",cy:"12",r:"8.5"}),e.jsx("path",{d:"M12 16.5v.01"}),e.jsx("path",{d:"M12 13.5v-1a2.5 2.5 0 1 0-2.5-2.5"})]})}const um={google:{name:"vocab.source.google.label",Icon:rm},openlibrary:{name:"vocab.source.openlibrary.label",Icon:im},amazon:{name:"vocab.source.amazon.label",Icon:lm},tmdb:{name:"vocab.source.tmdb.label",Icon:cm},tvdb:{name:"vocab.source.tvdb.label",Icon:dm}};function mm({source:t,detail:a,side:o="top"}){const s=um[t],r=s?s.Icon:hm,i=s?n(s.name):t||n("vocab.source.unknown.label"),l=a?n("common.source.detail.tip",{name:i,detail:a}):i;return e.jsx(ye,{label:l,side:o,children:e.jsx("span",{tabIndex:0,className:"src-mark","aria-label":n("common.source.aria",{name:l}),children:e.jsx(r,{})})})}function tc({open:t,items:a=[],anchorRef:o,at:s=null,onClose:r,returnFocusTo:i}){const{popRef:l,style:h}=qt(t,o,{align:s?"start":"end",minHeight:100,at:s}),d=r||(()=>{});if(Mt(t,d,[l,...o?[o]:[]],{onEscape:()=>{var p;return(p=i==null?void 0:i.current)==null?void 0:p.focus()}}),c.useLayoutEffect(()=>{var p,u;t&&((u=(p=l.current)==null?void 0:p.querySelector("[role=menuitem]"))==null||u.focus())},[t]),!t)return null;const m=p=>{var y,v;const u=[...((y=l.current)==null?void 0:y.querySelectorAll("[role=menuitem]"))||[]];if(!u.length)return;const f=u.indexOf(document.activeElement),b=g=>{p.preventDefault(),u[(g+u.length)%u.length].focus()};if(p.key==="ArrowDown")return b(f+1);if(p.key==="ArrowUp")return b(f-1);if(p.key==="Home")return b(0);if(p.key==="End")return b(u.length-1);p.key==="Tab"&&(p.preventDefault(),d(),(v=i==null?void 0:i.current)==null||v.focus())};return Ue.createPortal(e.jsx("div",{ref:l,className:"hand-card hc-r2 more-menu",role:"menu",style:h,onKeyDown:m,children:a.map((p,u)=>e.jsxs("button",{type:"button",role:"menuitem",className:"menu-item",style:p.danger?{color:"var(--error)"}:void 0,onClick:f=>{f.stopPropagation(),d(),p.onClick()},children:[p.icon,p.label]},p.id||u))}),document.body)}function It({items:t,icon:a,label:o,ariaLabel:s,tooltip:r,disabled:i=!1}){const[l,h]=c.useState(!1),d=c.useRef(null);return e.jsxs("div",{className:"relative",ref:d,children:[e.jsx(Pe,{icon:a||e.jsx(Vl,{}),label:o,ariaLabel:s||n("common.more.aria"),tooltip:r,disabled:i,onClick:()=>h(m=>!m)}),e.jsx(tc,{open:l&&!i,items:t,anchorRef:d,onClose:()=>h(!1),returnFocusTo:d})]})}const pm=".tp-tip-wrap, button, a, input, textarea, select, label",fm=".card-text";function Lo(t=[],{onLongPress:a}={}){const[o,s]=c.useState(null),r=c.useRef(null),i=c.useRef(null),l=c.useRef(null),h=c.useRef(!1),d=t.length>0,m=typeof a=="function",p=d||m,u=()=>{i.current&&clearTimeout(i.current),i.current=null,l.current=null},f=()=>s(null),b=q=>{var O;const E=(O=q==null?void 0:q.closest)==null?void 0:O.call(q,pm);return!!E&&E!==r.current},y=q=>{var E;return!!((E=q==null?void 0:q.closest)!=null&&E.call(q,fm))},v=q=>{var _,T;const E=typeof window<"u"?(_=window.getSelection)==null?void 0:_.call(window):null;if(!E||E.isCollapsed||E.rangeCount===0)return!1;const O=E.anchorNode;return!!(O&&((T=q==null?void 0:q.contains)!=null&&T.call(q,O)))},g=()=>{var E,O;const q=typeof window<"u"?(E=window.getSelection)==null?void 0:E.call(window):null;q&&!q.isCollapsed&&((O=q.removeAllRanges)==null||O.call(q))},x=p?{ref:r,onContextMenu:q=>{!d||b(q.target)||v(r.current)||(q.preventDefault(),s({x:q.clientX,y:q.clientY}))},onPointerDown:q=>{if(!p||q.pointerType!=="touch"||b(q.target)||m&&y(q.target))return;h.current=!1,u(),l.current={x:q.clientX,y:q.clientY};const{clientX:E,clientY:O}=q;i.current=setTimeout(()=>{h.current=!0,g(),m?a({x:E,y:O}):s({x:E,y:O})},Hl)},onPointerMove:q=>{!i.current||!l.current||(Math.abs(q.clientX-l.current.x)>io||Math.abs(q.clientY-l.current.y)>io)&&u()},onPointerUp:u,onPointerCancel:u,onClickCapture:q=>{var E,O;return(O=(E=q.target)==null?void 0:E.closest)!=null&&O.call(E,"[role=menu]")?!0:h.current?(h.current=!1,q.preventDefault(),q.stopPropagation(),!0):!1},onKeyDown:q=>{var _,T;if(!d||!(q.key==="ContextMenu"||q.shiftKey&&q.key==="F10"))return;q.preventDefault();const O=(T=(_=r.current)==null?void 0:_.getBoundingClientRect)==null?void 0:T.call(_);s(O?{x:O.left+12,y:O.top+12}:{x:0,y:0})}}:{ref:r},M=d?e.jsx(tc,{open:!!o,at:o,items:t,onClose:f,returnFocusTo:r}):null;return At(!!o),{cardProps:x,menuClass:p?"card-menu-host"+(o?" is-menu-target":""):"",menu:M,open:!!o,close:f}}function Xs({picked:t,onChange:a,label:o}){return e.jsxs("label",{className:"card-pick",onClick:s=>s.stopPropagation(),children:[e.jsx("input",{type:"checkbox",checked:t,"aria-label":n(t?"common.action.deselect.aria":"common.action.select.aria",{name:o||n("common.select.target.fallback")}),onChange:a}),e.jsx("span",{className:"card-pick-mark","aria-hidden":"true",children:e.jsx(ft,{})})]})}function Js({onCopy:t,onShare:a,onPractise:o,onEdit:s,onDelete:r,noun:i}){const l=i||n("unit.row.one");return e.jsxs("span",{className:"flex items-center justify-end gap-1",children:[t&&e.jsx(Ce,{icon:e.jsx(ca,{}),ariaLabel:n("common.action.copy.label"),onClick:t,tooltip:n("common.action.copy.row.tip",{noun:l})}),o&&e.jsx(Ce,{icon:e.jsx(Ct,{}),ariaLabel:n("common.action.practise.label"),onClick:o,tooltip:n("common.action.practise.row.tip",{noun:l})}),a&&e.jsx(Ce,{icon:e.jsx(En,{}),ariaLabel:n("common.action.share.label"),onClick:a,tooltip:n("common.action.share.row.tip",{noun:l})}),s&&e.jsx(Ce,{icon:e.jsx(at,{}),ariaLabel:n("common.action.edit.label"),onClick:s,tooltip:n("common.action.edit.row.tip",{noun:l})}),r&&e.jsx(Ce,{icon:e.jsx(Fe,{}),ariaLabel:n("common.action.delete.label"),onClick:r,tooltip:n("common.action.delete.row.tip",{noun:l}),danger:!0})]})}function Zs({onClick:t,label:a,tooltip:o,disabled:s=!1,className:r=""}){const i=a||n("common.action.close.label");return e.jsx(Ce,{icon:e.jsx(it,{}),ariaLabel:i,onClick:t,disabled:s,tooltip:o||n("common.action.close.window.tip",{name:i}),className:r})}function fa({actions:t=[],alwaysVisible:a=!1}){return t.length?e.jsx("span",{className:"card-tools"+(a?" is-visible":""),children:t.map(o=>e.jsx(Ce,{icon:o.icon,ariaLabel:o.label,onClick:o.run,tooltip:o.tooltip||o.label,danger:!!o.danger},o.id))}):null}function ga({actions:t=[]}){return t.length?e.jsx(It,{items:t.map(a=>({...a,onClick:a.run}))}):null}function $n({open:t,onClose:a,title:o,actions:s,children:r,footer:i,dismissOnScrim:l=!0}){return ja(t,a),At(t),t?e.jsx("div",{className:"mobile-sheet",onClick:l?a:void 0,children:e.jsxs("div",{className:"mobile-sheet-card",onClick:h=>h.stopPropagation(),children:[e.jsxs("div",{className:"mobile-sheet-header",children:[e.jsx(ye,{label:n("common.sheet.close.tip"),side:"bottom",className:"shrink-0",children:e.jsx("button",{type:"button",className:"mobile-sheet-close",onClick:a,"aria-label":n("common.action.close.label"),children:e.jsx(Zt,{})})}),e.jsx("h2",{className:"mobile-sheet-title",children:o}),s||e.jsx("span",{className:"mobile-sheet-spacer"})]}),e.jsx("div",{className:"mobile-sheet-body",children:r}),i&&e.jsx("div",{className:"mobile-sheet-footer",children:i})]})}):null}function er({count:t,onReset:a,onDone:o}){return e.jsxs(e.Fragment,{children:[a&&e.jsx(Ce,{icon:e.jsx(Jl,{}),ariaLabel:n("common.filters.reset.aria"),onClick:a}),t!=null&&e.jsx("span",{className:"microcopy",children:t}),e.jsx("button",{type:"button",className:"tp-btn tp-btn-primary ml-auto",style:{minWidth:110},onClick:o,children:n("common.action.done.label")})]})}function Ow({value:t,max:a,label:o}){const s=!(a>0),r=s?0:Math.min(100,Math.round(t/a*100));return e.jsxs("div",{role:"progressbar","aria-valuemin":0,"aria-valuemax":a||void 0,"aria-valuenow":s?void 0:t,"aria-label":o||n("common.progress.aria"),children:[e.jsx("div",{className:"progress-track",children:s?e.jsx("div",{className:"progress-fill progress-indeterminate"}):e.jsx("div",{className:"progress-fill",style:{width:`${r}%`}})}),o&&e.jsx("p",{className:"microcopy mt-1",children:o})]})}const gm=1500,bm=6e3,ym=1200;let fo=null,Yt=null,nc=0;function Se(t,a){fo&&fo(t,a)}function ac(t,a,o,s=!1){if(!Yt)return 0;const r=++nc;return Yt({msg:t,rect:a||null,side:o,sticky:!0,hold:s,token:r}),r}function an(t){t&&Yt&&Yt({hide:t})}function wm(t,a,o){if(!Yt)return 0;const s=++nc;return Yt({msg:t,rect:a||null,side:o,sticky:!1,token:s}),s}function vm({msg:t,rect:a,side:o}){const s=c.useRef(null),[r,i]=c.useState(null);return c.useLayoutEffect(()=>{const l=s.current;if(!l)return;const h=9,d=8,m=window.innerWidth,p=window.innerHeight,u=l.offsetWidth,f=l.offsetHeight;if(!a){i({top:d+6,left:Math.max(d,(m-u)/2)});return}const b=a.top-h-f>=d,y=a.bottom+h+f<=p-d,g=(o==="bottom"?!y&&b:b||!y)?Math.max(d,a.top-h-f):Math.min(a.bottom+h,Math.max(d,p-f-d)),w=Math.max(d,Math.min(a.left+a.width/2-u/2,m-u-d));i({top:g,left:w})},[t,a,o]),e.jsx("div",{ref:s,className:"hint-bubble",role:"tooltip",style:r?{top:r.top,left:r.left}:{top:0,left:0,visibility:"hidden"},children:t})}function km(){const[t,a]=c.useState({msg:"",action:null,n:0}),[o,s]=c.useState({msg:"",n:0,rect:null,side:"top",sticky:!1,token:0});return c.useEffect(()=>(fo=(r,i)=>a(l=>({msg:r,action:i||null,n:l.n+1})),Yt=r=>s(i=>r.hide!=null?r.hide===i.token&&i.msg?{...i,msg:""}:i:{msg:r.msg,rect:r.rect,side:r.side||"top",sticky:r.sticky,hold:!!r.hold,token:r.token,n:i.n+1}),()=>{fo=null,Yt=null}),[]),c.useEffect(()=>{if(!t.msg)return;const r=setTimeout(()=>a(i=>({...i,msg:""})),t.action?bm:gm);return()=>clearTimeout(r)},[t]),c.useEffect(()=>{if(!o.msg||o.hold)return;const r=setTimeout(()=>s(i=>({...i,msg:""})),o.sticky?yu:ym);return()=>clearTimeout(r)},[o]),e.jsxs(e.Fragment,{children:[t.msg&&e.jsxs("div",{className:"toast",role:"status",children:[t.msg,t.action&&e.jsx("button",{type:"button",className:"toast-action",onClick:()=>{a(r=>({...r,msg:""})),t.action.onClick()},children:t.action.label})]},t.n),o.msg&&e.jsx(vm,{msg:o.msg,rect:o.rect,side:o.side},o.n)]})}const ii=Object.freeze({cast:[],chapters:[],loading:!1});function oc(t){const a=(t==null?void 0:t.kind)==="screen"||(t==null?void 0:t.type)==="movie"?"movies":"books",o=(t==null?void 0:t.id)??null,s=o==null?"":`${a}:${o}`,[r,i]=c.useState(ii);c.useEffect(()=>{if(!s){i(ii);return}let p=!1;i(f=>({...f,loading:!0}));const u=[X("GET",`/${a}/${o}/cast`)];return a==="books"&&u.push(X("GET",`/books/${o}/chapters`)),Promise.all(u).then(([f,b])=>{var v,g;if(p)return;const y=(f==null?void 0:f.ok)&&((v=f.data)==null?void 0:v.cast)||[];i({cast:y,chapters:(b==null?void 0:b.ok)&&((g=b.data)==null?void 0:g.chapters)||[],loading:!1})}),()=>{p=!0}},[s,a,o]);const l=c.useMemo(()=>{const p=new Map;for(const u of r.cast)u.character&&p.set(u.character.trim().toLowerCase(),(u.actor||"").trim());return u=>p.get(String(u||"").trim().toLowerCase())||""},[r.cast]),h=c.useMemo(()=>{const p=new Map;for(const u of r.chapters){const f=(u.name||"").trim().toLowerCase();f&&u.no&&!p.has(f)&&p.set(f,u.no)}return u=>p.get(String(u||"").trim().toLowerCase())||""},[r.chapters]),d=c.useMemo(()=>[...new Set(r.chapters.map(p=>(p.name||"").trim()).filter(Boolean))],[r.chapters]),m=c.useMemo(()=>[...new Set(r.chapters.filter(p=>p.no).map(p=>String(p.no)))],[r.chapters]);return{...r,actorFor:l,chapterNoFor:h,chapterNames:d,chapterNumbers:m}}function go({id:t,options:a}){return!a||a.length===0?null:e.jsx("datalist",{id:t,children:a.map(o=>e.jsx("option",{value:o},o))})}const xm=10,jm=5,wn=t=>String(t||"").toLowerCase().trim();function us({label:t,value:a,onChange:o,placeholder:s,cast:r=[],field:i="character",nameCase:l=!0,inputRef:h,ariaLabel:d}){const[m,p]=c.useState(!1),[u,f]=c.useState(-1),b=c.useId(),y=c.useRef(null),v=c.useRef(null),g=c.useId(),w=h||v,S=_e()?jm:xm,N=c.useMemo(()=>{const T=new Set,B=[];for(const L of r){const V=((L==null?void 0:L[i])||"").trim();!V||T.has(wn(V))||(T.add(wn(V)),B.push({name:V,other:((L==null?void 0:L[i==="character"?"actor":"character"])||"").trim()}))}return B},[r,i]),j=wn(a),x=c.useMemo(()=>N.filter(T=>(!j||wn(T.name).includes(j)||wn(T.other).includes(j))&&wn(T.name)!==j).slice(0,S),[N,j,S]),M=m&&x.length>0,{popRef:q,style:E}=qt(M,y,{matchWidth:!0,minHeight:120});Mt(M,()=>p(!1),[y,q],{event:"pointerdown"});const O=T=>{o(T),p(!1),f(-1)},_=T=>{T.key==="ArrowDown"?(T.preventDefault(),p(!0),f(B=>Math.min(B+1,x.length-1))):T.key==="ArrowUp"?(T.preventDefault(),f(B=>Math.max(B-1,-1))):T.key==="Enter"&&M&&u>=0?(T.preventDefault(),O(x[u].name)):T.key==="Escape"&&M&&(T.stopPropagation(),p(!1))};return e.jsxs("div",{className:"tp-field",ref:y,children:[t&&e.jsx($,{htmlFor:b,children:t}),e.jsx("input",{ref:w,id:b,className:"tp-input",role:"combobox",autoCapitalize:l?"words":void 0,"aria-expanded":M,"aria-autocomplete":"list","aria-controls":M?g:void 0,"aria-activedescendant":M&&u>=0?`${g}-${u}`:void 0,"aria-label":d||t,autoComplete:"off",placeholder:s,value:a||"",onChange:T=>{o(T.target.value),p(!0),f(-1)},onFocus:()=>p(!0),onKeyDown:_,onBlur:T=>{var B,L;(B=y.current)!=null&&B.contains(T.relatedTarget)||(L=q.current)!=null&&L.contains(T.relatedTarget)||p(!1)}}),M&&Ue.createPortal(e.jsx("ul",{ref:q,className:"token-menu",style:E,role:"listbox",id:g,onMouseLeave:()=>f(-1),children:x.map((T,B)=>e.jsx("li",{role:"presentation",children:e.jsxs("button",{type:"button",id:`${g}-${B}`,role:"option","aria-selected":B===u,className:"token-opt cast-opt"+(B===u?" hi":""),onMouseEnter:()=>f(B),onClick:()=>O(T.name),children:[e.jsx("span",{className:"cast-opt-name",children:T.name}),T.other&&e.jsx("span",{className:"cast-opt-other",children:T.other})]})},T.name))}),document.body)]})}function Sm(t){const a=(t||"").trim();return a?`https://images-na.ssl-images-amazon.com/images/P/${a}.01.jpg`:""}const sc=500;function Sn(t){return t&&t.w?`${t.w}×${t.h}`:""}function Ln({url:t,label:a,showRes:o=!1,compact:s=!1,className:r="w-20 shrink-0"}){const[i,l]=c.useState(!1),[h,d]=c.useState(null);if(t&&!i){const m=h&&h.w>0&&h.w<sc,p=e.jsx("img",{src:t,alt:"",loading:"lazy",onError:()=>l(!0),onLoad:o?u=>d({w:u.target.naturalWidth,h:u.target.naturalHeight}):void 0,className:"block w-full object-cover",style:{aspectRatio:"2 / 3",border:"1px solid var(--ink-border)",borderRadius:8}});return o?e.jsxs("span",{className:"relative block "+r,children:[p,Sn(h)&&e.jsx("span",{className:"cover-res-badge"+(m?" is-low":""),children:Sn(h)})]}):e.jsx("span",{className:"block "+r,children:p})}return t&&i&&!s?e.jsx("span",{className:"flex items-center justify-center px-1 text-center "+r,style:{aspectRatio:"2 / 3",border:"1px dashed var(--ink-border)",borderRadius:8},children:e.jsx($,{style:{fontSize:"var(--type-ui-9)",lineHeight:1.3},children:n("cover.preview.blocked")})}):e.jsx(Dt,{kind:a,className:r})}const rc=t=>(t||"").replace("/t/p/w342/","/t/p/original/").replace("/t_cover_small/","/t_cover_big_2x/"),li={tvdb:"vocab.source.tvdb.label",tmdb:"vocab.source.tmdb.label",igdb:"vocab.source.igdb.label",wikidata:"vocab.source.wikidata.label",google:"vocab.source.google.label",openlibrary:"vocab.source.openlibrary.label",amazon:"vocab.source.amazon.label",wikimedia:"vocab.source.wikimedia.label",fandom:"vocab.source.fandom.label"},Nn=t=>li[t]?n(li[t]):String(t||"");function ic(t){return n(t==="game"?"cover.search.game.tip":"cover.search.screen.tip")}const ot=t=>{const a=Number(String(t??"").trim());return Number.isInteger(a)&&a>0?a:0};function tr({kind:t,id:a,currentPath:o,asin:s,coverUrl:r,clearCover:i,onSetUrl:l,onClear:h,onUploaded:d,onFetchMeta:m,fetchMetaOpen:p,search:u}){const[f,b]=c.useState(!1),[y,v]=c.useState(""),[g,w]=c.useState(!1),[k,S]=c.useState(""),[N,j]=c.useState(null),[x,M]=c.useState(!1),[q,E]=c.useState(null),O=n(t==="movies"?"cover.heading.poster":"cover.heading.cover"),_=n(t==="movies"?"cover.noun.poster":"cover.noun.cover"),T=n(t==="movies"?"cover.noun.poster.plural":"cover.noun.cover.plural");async function B(){var U,te,D,z,K,A;M(!0),S(""),j(null);const C=[],H=new Set,R=(Y,G,ae="")=>{Y&&!H.has(Y)&&(H.add(Y),C.push({url:Y,source:G,thumb:ae}))};if(t==="movies"){const Y=await X("POST","/movies/lookup",{title:((u==null?void 0:u.title)||"").trim(),year:u!=null&&u.year?Number(u.year):void 0,media_type:(u==null?void 0:u.mediaType)||"movie",tmdb_id:ot(u==null?void 0:u.tmdbId)||void 0,tvdb_id:ot(u==null?void 0:u.tvdbId)||void 0,igdb_id:ot(u==null?void 0:u.igdbId)||void 0});if(!Y.ok)return M(!1),S(le(Y,n("error.lookup.failed")));for(const G of Y.data.candidates||[])R(rc(G.poster_url),Nn(G.source||"tmdb"))}else{const Y={};(U=u==null?void 0:u.isbn)!=null&&U.trim()&&(Y.isbn=u.isbn.trim()),(te=u==null?void 0:u.title)!=null&&te.trim()&&(Y.title=u.title.trim()),(D=u==null?void 0:u.author)!=null&&D.trim()&&(Y.author=u.author.trim()),(z=u==null?void 0:u.asin)!=null&&z.trim()&&(Y.asin=u.asin.trim());const G=await X("POST","/books/lookup",Y);if(!G.ok)return M(!1),S(le(G,n("error.lookup.failed")));for(const ae of G.data.candidates||[])R(ae.cover_url,Nn(ae.source==="openlibrary"||ae.source==="amazon"?ae.source:"google"));(K=u==null?void 0:u.asin)!=null&&K.trim()&&R(Sm(u.asin),Nn("amazon"))}const I=await X("POST","/images/search",{kind:t==="movies"?"poster":"cover",title:((u==null?void 0:u.title)||"").trim()||void 0,author:((u==null?void 0:u.author)||"").trim()||void 0,year:u!=null&&u.year?Number(u.year):void 0,isbn:((u==null?void 0:u.isbn)||"").trim()||void 0,asin:((u==null?void 0:u.asin)||"").trim()||void 0,media_type:t==="movies"?(u==null?void 0:u.mediaType)||"movie":void 0}).catch(()=>({ok:!1}));if(I.ok)for(const Y of((A=I.data)==null?void 0:A.images)||[])R(Y.url,Nn(Y.source),Y.thumb);M(!1),j(C)}const L=r||(!i&&o?$e(o):""),V=r&&(q==null?void 0:q.url)===r&&q.thumb?q.thumb:L;async function P(C){const H=C.target.files&&C.target.files[0];if(C.target.value="",!H)return;w(!0),S("");const R=await xa(`/${t}/${a}/cover`,H);w(!1),R.ok?(h(!0),d(R.data)):S(le(R,n("error.upload.failed")))}return e.jsxs("div",{className:"flex items-start gap-4",style:{border:"1px solid var(--line)",borderRadius:12,padding:14},children:[e.jsx(Ln,{url:V,label:O}),e.jsxs("div",{className:"min-w-0 flex-1 space-y-2",children:[e.jsx($,{className:"block",children:O}),e.jsxs("div",{className:"cover-ctl-row",children:[e.jsx(ye,{label:g?n("common.action.upload.busy"):n("cover.upload.tip",{noun:_}),children:e.jsxs("label",{className:"field-icon-btn field-icon-btn-boxed tactile"+(g?" is-busy":""),"aria-label":n("cover.upload.aria",{noun:_}),children:[e.jsx(la,{}),e.jsx("input",{type:"file",accept:"image/*",className:"hidden",onChange:P,disabled:g})]})}),m&&e.jsx(Ce,{icon:e.jsx(Hn,{}),ariaLabel:n("cover.fetch-meta.aria"),"aria-pressed":!!p,onClick:m,tooltip:n("cover.fetch-meta.tip"),boxed:!0,active:!!p}),e.jsx(Ce,{icon:e.jsx(Pu,{}),ariaLabel:n("cover.url.aria"),"aria-pressed":f,onClick:()=>b(C=>!C),tooltip:n("cover.url.tip"),boxed:!0,active:f}),e.jsx(Ce,{icon:e.jsx(kt,{}),ariaLabel:n("cover.search.aria",{nouns:T}),onClick:B,disabled:x,tooltip:t==="movies"?ic(u==null?void 0:u.mediaType):n("cover.search.books.tip"),boxed:!0,busy:x}),(o||r)&&!i&&e.jsx(Ce,{icon:e.jsx(Fe,{}),ariaLabel:n("cover.remove.aria",{noun:_}),onClick:h,boxed:!0,danger:!0})]}),f&&e.jsxs("div",{className:"flex gap-2 pt-1",children:[e.jsx("input",{className:"tp-input",placeholder:n("cover.url.placeholder"),value:y,onChange:C=>v(C.target.value)}),e.jsx(Ce,{icon:e.jsx(ft,{}),ariaLabel:n("cover.url.use.aria"),onClick:()=>{y.trim()&&l(y.trim()),b(!1),v("")},tooltip:n("cover.url.use.tip"),ok:!0,className:"shrink-0"})]}),N&&e.jsxs("div",{className:"space-y-1.5 pt-1",children:[e.jsx($,{className:"block",children:N.length?n("cover.pick.prose",{noun:_}):n("cover.pick.none",{nouns:T})}),e.jsx("div",{className:"flex flex-wrap gap-2",children:N.map(C=>e.jsx(Nm,{url:C.thumb||C.url,source:C.source,noun:_,onPick:()=>{l(C.url),E({url:C.url,thumb:C.thumb}),j(null)}},C.url))})]}),r&&e.jsx("p",{className:"microcopy",children:n("cover.pending",{noun:_})}),i&&e.jsx("p",{className:"microcopy",style:{color:"var(--error)"},children:n("cover.clearing",{noun:_})}),e.jsx(ve,{children:k})]})]})}function Nm({url:t,source:a,noun:o,onPick:s}){const[r,i]=c.useState(null),[l,h]=c.useState(!1);if(l)return null;const d=r&&r.w>0&&r.w<sc;return e.jsx(ye,{label:n("cover.pick.use",{noun:o,source:a,res:Sn(r)||n("common.state.loading")}),children:e.jsxs("button",{type:"button",className:"cover-pick"+(d?" is-low":""),"aria-label":n("cover.pick.use",{noun:o,source:a,res:Sn(r)||n("common.state.loading")}),onClick:s,children:[e.jsxs("span",{className:"relative block",children:[e.jsx("img",{src:t,alt:"",loading:"lazy",onLoad:m=>i({w:m.target.naturalWidth,h:m.target.naturalHeight}),onError:()=>h(!0)}),Sn(r)&&e.jsx("span",{className:"cover-res-badge"+(d?" is-low":""),children:Sn(r)})]}),e.jsx("span",{className:"microcopy",children:a})]})})}function Tm(t){const a=[],o=new Map;for(const s of t||[]){const r=ni(s.title),i=ni(s.author),l=r&&i?`${r}\0${i}`:null,h=l&&o.get(l);if(h){h.editions.push(s),h.cover_url||(h.cover_url=s.cover_url||"");continue}const d={rep:s,editions:[s],cover_url:s.cover_url||""};l&&o.set(l,d),a.push(d)}return a}function Ko({cover:t,title:a,sub:o,source:s,sourceDetail:r,count:i=1,expanded:l,onAdd:h,addLabel:d,busy:m=!1}){const p=d||n("cover.candidate.add.label"),u=i>1;return e.jsxs("li",{className:"sheen-raised flex items-center gap-3 rounded-xl px-3 py-2.5",style:{border:"1px solid var(--line)"},children:[e.jsx(Ln,{url:t,label:"",compact:!0,className:"w-9 shrink-0"}),e.jsxs("div",{className:"min-w-0 flex-1",children:[e.jsx("p",{className:"truncate text-sm font-semibold",title:a,children:a}),e.jsx("p",{className:"truncate text-xs",style:{color:"var(--soft)"},children:o})]}),u?e.jsx($,{style:{flex:"none",fontSize:"var(--type-ui-9)"},children:n("cover.candidate.editions",{n:i})}):e.jsx(mm,{source:s,detail:r}),e.jsx(ye,{label:n(u?"cover.candidate.show-editions":"cover.candidate.add.tip"),className:"shrink-0",children:e.jsx("button",{type:"button",className:"cand-add tactile",onClick:h,disabled:m,"aria-label":u?n("cover.candidate.choose-edition.aria",{title:a}):n("cover.candidate.add.aria",{action:p,title:a}),"aria-expanded":u?!!l:void 0,children:u?e.jsx(uo,{open:!!l}):e.jsx(tt,{})})})]})}function lc({isbn:t,title:a,author:o,asin:s,onPick:r,auto:i=!1,onClose:l}){const[h,d]=c.useState(null),[m,p]=c.useState(!1),[u,f]=c.useState("");async function b(){p(!0),f(""),d(null);const y={};if(t&&t.trim()&&(y.isbn=t.trim()),a&&a.trim()&&(y.title=a.trim()),o&&o.trim()&&(y.author=o.trim()),s&&s.trim()&&(y.asin=s.trim()),!y.isbn&&!y.title&&!y.asin)return p(!1),f(n("error.validate.lookup-fields"));const v=await X("POST","/books/lookup",y);p(!1),v.ok?d(v.data.candidates):f(le(v,n("error.lookup.failed")))}return c.useEffect(()=>{i&&b()},[]),e.jsxs("div",{className:"space-y-2",children:[i?e.jsxs("div",{className:"flex items-center justify-between gap-2",children:[e.jsx($,{className:"block",children:n(m?"cover.editions.busy":"cover.editions.prose")}),l&&e.jsx(Ce,{icon:e.jsx(it,{}),ariaLabel:n("cover.editions.close.aria"),onClick:l})]}):e.jsx(ge,{type:"button",onClick:b,disabled:m,children:n(m?"cover.editions.looking":"cover.editions.browse")}),e.jsx(ve,{children:u}),h&&h.length===0&&e.jsx("p",{className:"microcopy",children:n("cover.editions.none")}),h&&h.length>0&&e.jsx("ul",{className:"lookup-grid",children:h.map((y,v)=>e.jsxs("li",{className:"lookup-card",children:[e.jsx(ye,{label:n("cover.editions.use.tip"),children:e.jsx("button",{type:"button",className:"lookup-card-cover","aria-label":n("cover.editions.use.aria",{title:y.title}),onClick:()=>r(y),children:e.jsx(Ln,{url:y.cover_url,label:"",showRes:!0,className:"w-full"})})}),e.jsxs("div",{className:"min-w-0",children:[e.jsx("p",{className:"truncate text-sm font-semibold",title:y.title,children:y.title}),e.jsx("p",{className:"truncate text-xs",style:{color:"var(--soft)"},children:[y.author,y.published_year||null].filter(Boolean).join(" · ")}),y.series&&e.jsxs("p",{className:"truncate text-xs",style:{color:"var(--accent-ui)"},children:[y.series,y.series_index?` #${y.series_index}`:""]})]}),e.jsxs("div",{className:"flex items-center justify-between gap-2",children:[e.jsx("span",{className:"tp-chip shrink-0",style:{fontSize:"var(--type-ui-9)"},children:Nn(y.source)}),e.jsx(Ce,{icon:e.jsx(ft,{}),ariaLabel:n("cover.editions.use.aria",{title:y.title}),onClick:()=>r(y),tooltip:n("cover.editions.use.exact",{title:y.title}),ok:!0,className:"shrink-0"})]})]},v))})]})}function cc({title:t,year:a,mediaType:o="movie",tmdbId:s,tvdbId:r,onPick:i,auto:l=!1}){const[h,d]=c.useState(t||""),[m,p]=c.useState(a?String(a):""),[u,f]=c.useState(null),[b,y]=c.useState(!1),[v,g]=c.useState(""),[w,k]=c.useState(""),S=[ot(s)&&`TMDB #${ot(s)}`,ot(r)&&`TVDB #${ot(r)}`].filter(Boolean);c.useEffect(()=>{l&&((t||"").trim()||S.length)&&N()},[]);async function N(){if(!h.trim()&&!S.length)return;y(!0),g(""),f(null);const x={title:h.trim(),media_type:o};m&&(x.year=Number(m)),ot(s)&&(x.tmdb_id=ot(s)),ot(r)&&(x.tvdb_id=ot(r));const M=await X("POST","/movies/lookup",x);y(!1),M.ok?(f(M.data.candidates),k(M.data.warning||"")):(k(""),g(le(M,n("error.lookup.failed"))))}const j=x=>{x.key==="Enter"&&(x.preventDefault(),N())};return e.jsxs("div",{className:"space-y-2",children:[e.jsxs("div",{className:"flex gap-2",children:[e.jsx("input",{className:"tp-input",placeholder:n("common.field.title.label"),value:h,onChange:x=>d(x.target.value),onKeyDown:j}),e.jsx("input",{className:"tp-input w-24 shrink-0",placeholder:n("common.field.year.label"),inputMode:"numeric",value:m,onChange:x=>p(x.target.value),onKeyDown:j}),e.jsx(Ce,{icon:e.jsx(kt,{}),ariaLabel:n("cover.movie.search.aria"),onClick:N,disabled:b,tooltip:ic(o),className:"shrink-0"})]}),w&&e.jsx("p",{className:"microcopy",style:{color:"var(--error)"},children:w}),S.length>0&&e.jsx($,{className:"block",children:n("cover.movie.by-id",{ids:S.join(" · ")})}),e.jsx(ve,{children:v}),u&&u.length===0&&e.jsx("p",{className:"microcopy",children:n("cover.movie.none")}),u&&u.length>0&&e.jsx("ul",{className:"lookup-grid",children:u.map(x=>e.jsxs("li",{className:"lookup-card",children:[e.jsx(ye,{label:n("cover.movie.use.tip"),children:e.jsx("button",{type:"button",className:"lookup-card-cover","aria-label":n("cover.editions.use.aria",{title:x.title}),onClick:()=>i(x),children:e.jsx(Ln,{url:x.poster_url,label:"",showRes:!0,className:"w-full"})})}),e.jsxs("div",{className:"min-w-0",children:[e.jsx("p",{className:"truncate text-sm font-semibold",title:x.title,children:x.title}),x.release_year?e.jsx("p",{className:"truncate text-xs",style:{color:"var(--soft)"},children:x.release_year}):null]}),e.jsxs("div",{className:"flex items-center justify-between gap-2",children:[e.jsx("span",{className:"tp-chip shrink-0",style:{color:"var(--amber)",fontSize:"var(--type-ui-9)"},children:Nn(x.source||"tmdb")}),e.jsx(Ce,{icon:e.jsx(ft,{}),ariaLabel:n("cover.editions.use.aria",{title:x.title}),onClick:()=>i(x),tooltip:n("cover.editions.use.exact",{title:x.title}),ok:!0,className:"shrink-0"})]})]},`${x.source}-${x.source_id||x.tmdb_id}`))})]})}const jt=10;function Em(){const[t,a]=c.useState(()=>typeof matchMedia<"u"&&matchMedia("(prefers-reduced-motion: reduce)").matches);return c.useEffect(()=>{const o=matchMedia("(prefers-reduced-motion: reduce)"),s=()=>a(o.matches);return o.addEventListener("change",s),()=>o.removeEventListener("change",s)},[]),t}function Cm(t){const a=getComputedStyle(t),o=parseFloat(a.fontSize)||16;let s=parseFloat(a.lineHeight);return(!s||Number.isNaN(s))&&(s=o*1.5),{font:`${a.fontStyle} ${a.fontWeight} ${a.fontSize} ${a.fontFamily}`,lh:s}}function Am(t,a,o,s,r,i){const l=t,h=t+a;let d=0;if(s.cy<l?d=l-s.cy:s.cy>h&&(d=s.cy-h),d>=s.r)return[{x:0,w:o}];const m=Math.sqrt(s.r*s.r-d*d),p=s.cx-m-r,u=s.cx+m+r,f=[];return p>=i&&f.push({x:0,w:p}),o-u>=i&&f.push({x:u,w:o-u}),f}function ci(t,a,o,s,r,i,l){const d=t.prepareWithSegments(a,o);let m={segmentIndex:0,graphemeIndex:0};const p=[];let u=0;for(let f=0;f<800;f++){const b=Am(u,s,r,i,l,34);if(b.length===0){const g=t.layoutNextLine(d,m,r);if(!(g&&!(g.end.segmentIndex===m.segmentIndex&&g.end.graphemeIndex===m.graphemeIndex)))break;p.push({segs:[]}),u+=s;continue}const y=[];let v=!1;for(const g of b){const w=t.layoutNextLine(d,m,Math.max(34,g.w));if(!w||w.end.segmentIndex===m.segmentIndex&&w.end.graphemeIndex===m.graphemeIndex)break;y.push({text:w.text,x:g.x,w:g.w}),m=w.end,v=!0}if(!v)break;p.push({segs:y}),u+=s}return p}function dc({text:t,sticker:a,stickerKey:o="",quoteStyle:s,radius:r=42,gap:i=12,maxLines:l=0,pos:h=null,onMove:d,open:m,onToggle:p,className:u=""}){const f=c.useRef(null),[b,y]=c.useState(null),[v,g]=c.useState(!1),w=m!==void 0,k=w?m:v,S=()=>w?p==null?void 0:p():g(I=>!I),N=Em(),j=!!a,x=c.useRef(h),M=c.useRef(null),q=c.useRef(b),E=c.useRef(null),O=c.useRef(d);q.current=b,O.current=d,c.useEffect(()=>{g(!1),x.current=h},[t,o]),c.useEffect(()=>{E.current||(x.current=h,M.current&&M.current())},[h&&h.x,h&&h.y]),c.useLayoutEffect(()=>{const I=f.current;if(!I||N||!j||!t){y(null);return}let U=!1,te=null;async function D(){if(te||(te=await Ve(()=>import("./layout-7OQMGvZm.js"),[])),U)return;const K=I.clientWidth;if(!K)return;const A=Math.min(r,Math.floor(K/3)),{font:Y,lh:G}=Cm(I),ae=ci(te,t,Y,G,K,{cx:0,cy:0,r:0},i).length,Z=Math.max(ae*G,A*2),pe=l>0&&ae>l,ce=pe&&!k;let F,Q,ie;if(ce)F=Math.max(15,Math.round(A*.5)),Q=K-F+Math.min(jt,Math.round(F*.5)),ie=F-Math.min(jt,Math.round(F*.5));else{F=A;const ue=x.current;Q=ue&&typeof ue.x=="number"?ue.x*K:K-F,ie=ue&&typeof ue.y=="number"?ue.y*K:F,Q=Math.max(F-jt,Math.min(K-F+jt,Q)),ie=Math.max(F-jt,Math.min(Z-F+jt,ie))}const he=ci(te,t,Y,G,K,{cx:Q,cy:ie,r:F},i);U||y({lines:he,lh:G,r:F,W:K,cx:Q,cy:ie,naturalH:Z,collapsed:ce,clampable:pe})}M.current=()=>D().catch(()=>{}),D().catch(()=>{U||y(null)});const z=new ResizeObserver(()=>D().catch(()=>{}));return z.observe(I),document.fonts&&document.fonts.ready&&document.fonts.ready.then(()=>{U||D().catch(()=>{})}),()=>{U=!0,z.disconnect(),M.current=null}},[t,o,j,N,r,i,k,l]);const _=c.useCallback(I=>{const U=E.current;if(!U)return;let te=I.clientX-U.left-U.grabDx,D=I.clientY-U.top-U.grabDy;te=Math.max(U.r-jt,Math.min(U.W-U.r+jt,te)),D=Math.max(U.r-jt,Math.min(Math.max(U.r,U.naturalH-U.r+jt),D)),x.current={x:te/U.W,y:D/U.W},M.current&&M.current()},[]),T=c.useCallback(()=>{window.removeEventListener("pointermove",_),window.removeEventListener("pointerup",T);const I=f.current;I&&(I.dataset.dragging="0");const U=!!E.current;E.current=null,U&&O.current&&x.current&&O.current(x.current.x,x.current.y)},[_]),B=c.useCallback(I=>{const U=q.current;if(!O.current||!U||U.collapsed)return;I.preventDefault(),I.stopPropagation();const te=f.current,D=te.getBoundingClientRect();E.current={left:D.left,top:D.top,W:U.W,r:U.r,naturalH:U.naturalH,grabDx:I.clientX-D.left-U.cx,grabDy:I.clientY-D.top-U.cy},te.dataset.dragging="1",window.addEventListener("pointermove",_),window.addEventListener("pointerup",T)},[_,T]);c.useEffect(()=>()=>{window.removeEventListener("pointermove",_),window.removeEventListener("pointerup",T)},[_,T]);const L=b?b.r*2:r*2,V=b?b.lines:[],P=!!(b&&b.collapsed),C=P?V.slice(0,l):V,H=!!b&&b.clampable,R=!!d&&!P;return e.jsx("div",{ref:f,className:`flow card-text ${H?"clampable is-clickable":""} ${u}`.trim(),style:{position:"relative",...s},role:H?"button":void 0,tabIndex:H?0:void 0,"aria-expanded":H?k:void 0,onClick:H?S:void 0,onKeyDown:H?I=>{(I.key==="Enter"||I.key===" ")&&(I.preventDefault(),S())}:void 0,children:b?e.jsxs(e.Fragment,{children:[e.jsx("span",{className:"flow-sticker",onPointerDown:R?B:void 0,style:{position:"absolute",left:b.cx-b.r,top:b.cy-b.r,width:L,height:L,zIndex:2,cursor:R?"grab":"default",touchAction:R?"none":void 0,transition:"left .18s ease, top .18s ease, width .18s ease, height .18s ease"},title:R?n("common.sticker.drag.tip"):void 0,children:a}),e.jsx("div",{style:{height:C.length*b.lh},children:C.map((I,U)=>e.jsx("div",{style:{position:"relative",height:b.lh},children:I.segs.map((te,D)=>e.jsx("span",{className:"flow-line",style:{position:"absolute",left:Math.max(0,te.x),top:0,width:Math.max(0,te.w),height:b.lh,lineHeight:`${b.lh}px`},children:te.text||" "},D))},U))}),H&&e.jsx(Na,{open:k})]}):e.jsxs("p",{className:"flow-fallback",style:{margin:0},children:[a&&e.jsx("span",{className:"flow-sticker",style:{float:"right",width:L,height:L,marginLeft:i,marginBottom:4},children:a}),t]})})}function di(){return e.jsx("span",{className:"help-swatches","aria-hidden":"true",children:[1,2,3,4,5,6].map(t=>e.jsx("span",{className:"color-dot active",style:{background:`var(--hl-${t})`}},t))})}function qm(){const t={fill:"none",stroke:"currentColor",strokeWidth:1.2,rx:4,opacity:.5},a={fontSize:"var(--type-mono-9)",fill:"currentColor",fontFamily:"var(--font-mono)"};return e.jsxs("svg",{viewBox:"0 0 240 46",width:"240",role:"img","aria-label":n("capture.help.import.flow.aria"),children:[e.jsx("rect",{x:"1",y:"12",width:"52",height:"18",...t}),e.jsx("text",{x:"27",y:"24",...a,textAnchor:"middle",children:n("capture.help.import.flow.file.label")}),e.jsx("rect",{x:"86",y:"12",width:"68",height:"18",...t}),e.jsx("text",{x:"120",y:"24",...a,textAnchor:"middle",children:n("capture.help.import.flow.pending.label")}),e.jsx("rect",{x:"187",y:"12",width:"52",height:"18",...t}),e.jsx("text",{x:"213",y:"24",...a,textAnchor:"middle",children:n("capture.help.import.flow.library.label")}),e.jsx("path",{d:"M55 21 H84",stroke:"currentColor",strokeWidth:"1.2",opacity:"0.5"}),e.jsx("path",{d:"M78 18 l6 3 -6 3",fill:"currentColor",opacity:"0.5"}),e.jsx("path",{d:"M156 21 H185",stroke:"currentColor",strokeWidth:"1.4"}),e.jsx("path",{d:"M179 18 l6 3 -6 3",fill:"currentColor"}),e.jsx("text",{x:"170",y:"10",...a,textAnchor:"middle",opacity:"0.85",children:n("capture.help.import.flow.approve.label")})]})}const Jn=(t,a,o)=>Object.defineProperty(t,a,{get:o,enumerable:!0});function W(t,a={}){const{icon:o,asset:s,more:r=!1,how:i=0}=a,l={key:t,roles:["term","what",...Array.from({length:i},(h,d)=>`how.${d+1}`),...r?["more"]:[]]};return o&&(l.icon=o),s&&(l.asset=s),Jn(l,"term",()=>n(`${t}.term`)),Jn(l,"what",()=>n(`${t}.what`)),i&&Jn(l,"how",()=>Array.from({length:i},(h,d)=>n(`${t}.how.${d+1}`))),r&&Jn(l,"more",()=>n(`${t}.more`)),l}function Ke(t,a){const o={entries:a,titleKey:t};return Jn(o,"title",()=>n(t)),o}const hc=[W("common.help.topbar.add",{icon:e.jsx(tt,{}),more:!0}),W("common.help.topbar.search",{icon:e.jsx(kt,{})}),W("common.help.topbar.help",{icon:e.jsx(Oo,{}),more:!0}),W("common.help.topbar.avatar"),W("common.help.selecting",{how:3,more:!0}),W("common.help.favourite",{more:!0}),W("common.help.cover-menu",{more:!0}),W("common.help.skip-in-quiz",{more:!0}),W("common.help.fill-gaps",{more:!0}),W("common.help.info-dots",{more:!0})],uc=[W("common.help.installed-app",{more:!0}),W("common.help.topbar.menu",{icon:e.jsx(Yl,{}),asset:e.jsx(rs,{kind:"swipe-left"}),more:!0}),W("common.help.bottom-bar",{more:!0}),W("common.help.long-press",{asset:e.jsx(rs,{kind:"long-press"}),more:!0})],mc=[W("common.help.keyboard",{more:!0}),W("common.help.tab-strip",{more:!0}),W("common.help.hover-labels"),W("common.help.card-menu",{more:!0})],Tn={home:Ke("nav.tab.home.label",[W("home.help.greeting"),W("home.help.daily-quiz",{more:!0}),W("home.help.practice"),W("home.help.practise",{more:!0}),W("home.help.grade"),W("home.help.fix-or-tag",{more:!0}),W("home.help.language-mark",{more:!0}),W("home.help.status-dot"),W("home.help.favourites",{more:!0})]),library:Ke("nav.tab.library.label",[W("library.help.filters",{icon:e.jsx(Ht,{})}),W("library.help.translator-editor",{more:!0}),W("library.help.wishlist"),W("library.help.fold-wishlist",{more:!0}),W("library.help.shelf-state",{icon:e.jsx(Ks,{})}),W("library.help.sort",{more:!0}),W("library.help.group-by"),W("library.help.view",{icon:e.jsx(Iu,{})}),W("library.help.export",{icon:e.jsx(rt,{}),more:!0})]),movies:Ke("nav.tab.movies.label",[W("movies.help.media-types",{more:!0}),W("movies.help.filters",{icon:e.jsx(Ht,{})}),W("movies.help.actor",{more:!0}),W("movies.help.shelf-state",{more:!0}),W("movies.help.collection"),W("movies.help.sort",{more:!0}),W("movies.help.group-by"),W("movies.help.export",{icon:e.jsx(rt,{})})]),"book-detail":Ke("book.help.title",[W("book.help.details",{icon:e.jsx(un,{}),more:!0}),W("book.help.counts",{more:!0}),W("book.help.hearts"),W("book.help.state-chip"),W("book.help.add-annotation",{icon:e.jsx(tt,{})}),W("book.help.colour-category",{asset:e.jsx(di,{}),more:!0}),W("book.help.copy",{icon:e.jsx(ca,{}),more:!0}),W("book.help.share",{icon:e.jsx(En,{}),more:!0}),W("book.help.export",{icon:e.jsx(rt,{})}),W("book.help.more-menu",{icon:e.jsx(Vl,{})})]),"movie-detail":Ke("film.help.title",[W("film.help.studio",{more:!0}),W("film.help.publisher",{more:!0}),W("film.help.voice-cast",{more:!0}),W("film.help.details",{icon:e.jsx(un,{}),more:!0}),W("film.help.counts",{more:!0}),W("film.help.state-chip",{more:!0}),W("film.help.add-dialogue",{icon:e.jsx(tt,{}),more:!0}),W("film.help.cast"),W("film.help.copy",{icon:e.jsx(ca,{}),more:!0}),W("film.help.share",{icon:e.jsx(En,{}),more:!0})]),search:Ke("nav.tab.search.label",[W("search.help.exact-phrase",{more:!0}),W("search.help.box",{icon:e.jsx(kt,{})}),W("search.help.filters",{icon:e.jsx(Ht,{}),more:!0}),W("search.help.colon",{how:3,more:!0}),W("search.help.escaped-colon",{more:!0}),W("search.help.two-chips",{more:!0}),W("search.help.colour-names",{more:!0}),W("search.help.arriving-narrowed",{more:!0}),W("search.help.global-scope",{more:!0}),W("search.help.scope-chips",{more:!0}),W("search.help.sections"),W("search.help.characters",{how:1,more:!0}),W("search.help.dates",{more:!0}),W("search.help.select")]),quotes:Ke("nav.tab.quotes.label",[W("quotes.help.what-lives-here"),W("quotes.help.boards",{more:!0}),W("quotes.help.starters",{more:!0}),W("quotes.help.board-kind",{more:!0}),W("quotes.help.languages",{more:!0}),W("quotes.help.all-quotes",{more:!0}),W("quotes.help.hide-board",{more:!0}),W("quotes.help.delete-board",{more:!0}),W("quotes.help.occasion"),W("quotes.help.speaker",{more:!0}),W("quotes.help.when"),W("quotes.help.no-attribution"),W("quotes.help.speaker-credit",{more:!0}),W("quotes.help.copy",{icon:e.jsx(ca,{}),more:!0}),W("quotes.help.share",{icon:e.jsx(En,{}),more:!0}),W("quotes.help.filters",{icon:e.jsx(Ht,{}),more:!0}),W("quotes.help.group-by",{more:!0}),W("quotes.help.export",{icon:e.jsx(rt,{})})]),anthologies:Ke("nav.tab.anthologies.label",[W("anthologies.help.what-lives-here",{more:!0}),W("anthologies.help.not-a-board"),W("anthologies.help.new",{icon:e.jsx(tt,{}),more:!0}),W("anthologies.help.adding",{more:!0}),W("anthologies.help.entry-note",{more:!0}),W("anthologies.help.reorder",{more:!0}),W("anthologies.help.remove",{icon:e.jsx(Fe,{})}),W("anthologies.help.delete",{icon:e.jsx(Fe,{}),more:!0}),W("anthologies.help.export",{icon:e.jsx(rt,{}),more:!0}),W("anthologies.help.feature-switch",{more:!0})]),tags:Ke("tags.help.title",[W("tags.help.tags"),W("tags.help.style"),W("tags.help.stickers",{icon:e.jsx(la,{}),more:!0})]),metadata:Ke("nav.tab.metadata.label",[W("metadata.help.coverage"),W("metadata.help.fetch",{icon:e.jsx(Hn,{})}),W("metadata.help.reverify"),W("metadata.help.duplicates"),W("metadata.help.speakers"),W("metadata.help.people"),W("metadata.help.bulk-edit",{icon:e.jsx(at,{})})]),stats:Ke("nav.tab.stats.label",[W("stats.help.calendar",{icon:e.jsx(Xl,{}),more:!0}),W("stats.help.memory"),W("stats.help.breakdowns",{more:!0}),W("stats.help.timeline",{more:!0}),W("stats.help.superlatives"),W("stats.help.counts",{more:!0})]),staging:Ke("staging.help.title",[W("staging.help.why"),W("staging.help.bulk-fix",{icon:e.jsx(at,{})}),W("staging.help.approve")]),bin:Ke("bin.help.title",[W("bin.help.what-is-here",{more:!0}),W("bin.help.getting-here",{more:!0}),W("bin.help.row",{more:!0}),W("bin.help.restore",{icon:e.jsx(Jl,{}),more:!0}),W("bin.help.purge",{icon:e.jsx(Fe,{})}),W("bin.help.kinds",{more:!0}),W("bin.help.keep-for",{more:!0}),W("bin.help.empty-now",{icon:e.jsx(Fe,{})})]),cleanup:Ke("cleanup.help.title",[W("cleanup.help.what-is-here",{more:!0}),W("cleanup.help.no-fix",{more:!0}),W("cleanup.help.getting-here",{more:!0}),W("cleanup.help.row",{more:!0}),W("cleanup.help.filter",{icon:e.jsx(Ht,{}),more:!0}),W("cleanup.help.names",{more:!0}),W("cleanup.help.cap",{more:!0})]),settings:Ke("nav.tab.settings.label",[W("settings.help.colour-categories",{asset:e.jsx(di,{}),more:!0}),W("settings.help.appearance",{more:!0}),W("settings.help.button-labels",{more:!0}),W("settings.help.features",{more:!0}),W("settings.help.onboarding",{more:!0}),W("settings.help.users",{more:!0}),W("settings.help.metadata-sources",{more:!0}),W("settings.help.igdb",{more:!0}),W("settings.help.type",{icon:e.jsx(Vu,{}),more:!0}),W("settings.help.language-marks",{icon:e.jsx(Yu,{}),more:!0}),W("settings.help.upload-font",{more:!0}),W("settings.help.review",{more:!0}),W("settings.help.in-depth",{more:!0}),W("settings.help.credit-separators",{more:!0}),W("settings.help.devices"),W("settings.help.bin",{more:!0}),W("settings.help.cleanup",{more:!0}),W("settings.help.backup",{more:!0}),W("settings.help.backup-now",{icon:e.jsx(Uu,{}),more:!0}),W("settings.help.backup-download",{icon:e.jsx(rt,{}),more:!0}),W("settings.help.changelog",{more:!0}),W("settings.help.updates")]),profile:Ke("profile.help.title",[W("profile.help.photo",{icon:e.jsx(la,{})}),W("profile.help.display-name"),W("profile.help.switch-account",{more:!0}),W("profile.help.log-out"),W("profile.help.password",{more:!0}),W("profile.help.users",{icon:e.jsx(tt,{}),more:!0}),W("profile.help.maintenance")]),capture:Ke("capture.help.title",[W("capture.help.no-work"),W("capture.help.book"),W("capture.help.film",{more:!0}),W("capture.help.quote",{icon:e.jsx(Gs,{}),more:!0}),W("capture.help.save",{more:!0}),W("capture.help.import",{icon:e.jsx(la,{}),asset:e.jsx(qm,{}),more:!0})])};function pc(t,a=!1){const o=Tn[t];return o?{title:o.title,entries:[...o.entries,...hc,...a?uc:mc]}:null}const Mm=["home","library","book-detail","movies","movie-detail","quotes","anthologies","search","capture","staging","tags","metadata","stats","bin","cleanup","settings","profile"];function Om(t=!1){const a=Mm.filter(o=>Tn[o]).map(o=>({id:o,title:Tn[o].title,titleKey:Tn[o].titleKey,entries:Tn[o].entries}));return a.push({id:"everywhere",title:n("common.help.title"),titleKey:"common.help.title",entries:[...hc,...t?uc:mc]}),a}function _n({screen:t,side:a="bottom",variant:o="ring"}){const s=_e(),r=pc(t,s);return r?e.jsx(Tu,{title:r.title,sections:Om(s),active:Tn[t]?t:"everywhere",side:a,variant:o}):null}function fc({screen:t,open:a,onClose:o}){const s=_e(),r=pc(t,s);return!r||!a?null:e.jsx(Hs,{open:!0,title:r.title,onClose:o,children:e.jsx(zs,{entries:r.entries})})}function _o(t){return $e(t)}const Rn={comma:!0,semicolon:!0,amp:!0,and:!0};function mn(t){const a=String(t||"").trim();if(!a)return Rn;if(a.toLowerCase()==="none")return{comma:!1,semicolon:!1,amp:!1,and:!1};const o={comma:!1,semicolon:!1,amp:!1,and:!1};let s=!1;for(const r of a.split(",")){const i=r.trim().toLowerCase();i in o&&(o[i]=!0,s=!0)}return s?o:Rn}const Lm=new Set(["jr","jr.","sr","sr.","inc","inc.","ltd","ltd.","llc","llc.","co","co."]),_m=/^[0-9]+(st|nd|rd|th)?\.?$/,Rm=t=>Lm.has(t)||_m.test(t),Dm=/\s+and\s+/i,Im=/^and\s+/i,Pm=8;function Bm(t,a){if(t=t.trim(),!t)return[];if(a&&(t=t.replace(Im,"").trim(),!t))return[];const o=t.split(new RegExp(Dm.source,"gi"));if(o.length<2)return[t];if(!a){for(const s of o)if(s.trim().split(/\s+/).filter(Boolean).length<2)return[t]}return o}function Je(t,a=Rn){const o=String(t||"").trim().replace(/\s+/g," ");if(!o)return[];if(!a.comma&&!a.semicolon&&!a.amp&&!a.and)return[o];let s=!1,r=[o];const i=(m,p)=>m.flatMap(u=>u.split(p));a.comma&&o.includes(",")&&(s=!0,r=i(r,",")),a.semicolon&&o.includes(";")&&(s=!0,r=i(r,";")),a.amp&&o.includes("&")&&(s=!0,r=i(r,"&")),a.and&&(r=r.flatMap(m=>Bm(m,s)));const l=[];for(let m of r){if(m=m.trim(),!m)continue;const p=m.toLowerCase();if(!(p==="et al"||p==="et al.")){if(Rm(p)&&l.length>0){l[l.length-1]+=", "+m;continue}l.push(m)}}const h=new Set,d=[];for(const m of l){const p=m.toLowerCase();if(!h.has(p)&&(h.add(p),d.push(m),d.length===Pm))break}return d.length?d:[o]}function Qe(t){const[a,o]=c.useState({});async function s(){if(!t)return;const r=await X("GET",`/people?kind=${t}`);r.ok&&o(Object.fromEntries((r.data.people||[]).map(i=>[i.name,i])))}return c.useEffect(()=>{if(!t){o({});return}s()},[t]),{map:a,reload:s}}const Fm=20;function gc(t,a,o,s){const r=c.useRef(null);r.current===null&&(r.current=new Set),c.useEffect(()=>{var h;if(!t)return;const i=[];for(const d of a||[]){const m=String(d||"").trim();if(!(!m||r.current.has(m)||(h=o==null?void 0:o[m])!=null&&h.image_path)&&(i.push(m),i.length>=Fm))break}if(i.length===0)return;for(const d of i)r.current.add(d);let l=!0;return(async()=>{var m;let d=0;for(const p of i){if(!l)return;const u=await X("POST","/people/portrait",{kind:t,name:p});u.ok&&((m=u.data)!=null&&m.image)&&(d+=1)}l&&d&&(s==null||s())})(),()=>{l=!1}},[t,a,o])}function Ea({person:t,size:a=30}){return t!=null&&t.image_path?e.jsx("img",{src:_o(t.image_path),alt:"",style:{width:a,height:a,borderRadius:"50%",objectFit:"cover",border:"1px solid var(--ink-border)",flex:"none"}}):null}const Hm=5e3;let xn=null;function bc(t){const a=Date.now();if(xn&&xn.offset===t&&a-xn.at<Hm)return xn.promise;const o=X("GET",`/review/daily?offset=${t}`).then(s=>(s.ok||nr(),s));return xn={at:a,offset:t,promise:o},o}function nr(){xn=null}const ar=["speech","letter","essay","proverb","other"];function or(){return[["",n("vocab.quote-kind.unset.label")],...ar.map(t=>[t,Ca(t)])]}function Ca(t){const a=String(t||"");return ar.includes(a)?n(`vocab.quote-kind.${a}.label`):""}function Aa(t){return Ca(t==null?void 0:t.kind)||(t==null?void 0:t.medium)||""}const bo={annotation:{bulk:"/annotations/bulk",del:"/annotations/bulk/delete",noun:["highlight","highlights"],unit:"unit.highlight"},dialogue:{bulk:"/dialogues/bulk",del:"/dialogues/bulk/delete",noun:["film line","film lines"],unit:"unit.dialogue"},quote:{bulk:"/quotes/bulk",del:"/quotes/bulk/delete",noun:["quote","quotes"],unit:"unit.quote"},book:{bulk:"/books/bulk",del:"/books/bulk/delete",status:"/books/bulk/status",noun:["book","books"],unit:"unit.book"},movie:{bulk:"/movies/bulk",del:"/movies/bulk/delete",status:"/movies/bulk/status",noun:["title","titles"],unit:"unit.title"}},zm={book:"annotation",screen:"dialogue",utterance:"quote"};function yc(t,a){var s;const o=((s=bo[t])==null?void 0:s.noun)||["item","items"];return`delete ${a} ${a===1?o[0]:o[1]}`}const hi=15;function wc({kind:t,ids:a=[],onDone:o}){const[s,r]=c.useState(!1),i=bo[t],l=a.length;async function h(u,f){if(!i)return;r(!0);const b=await X("POST",i.bulk,{ids:a,...u});if(r(!1),!b.ok)return Se(le(b,n("error.apply.generic")));Se(f),o==null||o()}async function d(u,f){if(!(i!=null&&i.status))return;r(!0);const b=await X("POST",i.status,{ids:a,status:u});if(r(!1),!b.ok)return Se(le(b,n("error.apply.generic")));Se(f),o==null||o()}async function m(){var y,v;r(!0);const u=t==="book"?"book_ids":"movie_ids";let f=0,b=0;for(let g=0;g<a.length;g+=hi){const w=await X("POST","/metadata/fill",{[u]:a.slice(g,g+hi)});if(!w.ok)return r(!1),Se(le(w,n("error.fill.generic")));f+=((y=w.data)==null?void 0:y.fields)||0,b+=((v=w.data)==null?void 0:v.failed)||0}r(!1),Se(f===0?n(b?"common.selection.fill.toast.none-fetched":"common.selection.fill.toast.nothing-missing"):n("common.selection.fill.toast.filled",{count:f,n:f})),o==null||o()}async function p(){var b;if(!i)return;r(!0);const u=await X("POST",i.del,{ids:a,confirm:yc(t,l)});if(r(!1),!u.ok)return Se(le(u,n("error.delete.generic")));const f=(b=u.data)==null?void 0:b.trash_id;Se(n("common.toast.deleted",{count:l,n:l}),f?{label:n("common.action.undo.label"),onClick:async()=>{const y=await X("POST",`/trash/${f}/restore`);Se(y.ok?n("common.toast.restored.label"):le(y,n("error.undo.generic"))),o==null||o()}}:void 0),o==null||o()}return{busy:s,routes:i,count:l,post:h,setShelf:d,fillGaps:m,remove:p}}const $m=[{key:"author",get label(){return n("common.field.author.label")},kinds:["book"]},{key:"translator",get label(){return n("common.field.translator.label")},kinds:["book"]},{key:"editor",get label(){return n("common.field.editor.label")},kinds:["book"]},{key:"director",get label(){return n("common.field.director.label")},kinds:["movie"]},{key:"publisher",get label(){return n("common.field.publisher.label")},kinds:["movie"]},{key:"media_type",get label(){return n("common.field.media-type.label")},kinds:["movie"],required:!0,get options(){return[["movie",n("vocab.kind.movie.label")],["show",n("vocab.kind.show.label")],["game",n("vocab.kind.game.label")]]}},{key:"published_year",get label(){return n("common.field.year.label")},kinds:["book"],number:!0},{key:"release_year",get label(){return n("common.field.year.label")},kinds:["movie"],number:!0},{key:"series",get label(){return n("common.field.series.label")},kinds:["book"],title:!0},{key:"series",get label(){return n("common.field.collection.label")},kinds:["movie"],title:!0},{key:"series_index",get label(){return n("common.field.series-no.label")},kinds:["book"],number:!0},{key:"series_index",get label(){return n("common.field.collection-no.label")},kinds:["movie"],number:!0},{key:"description",get label(){return n("common.field.description.label")},long:!0}],Wm=[{key:"note",get label(){return n("common.field.note.label")},long:!0},{key:"chapter_no",get label(){return n("common.field.chapter-no.label")},kinds:["annotation"],number:!0},{key:"chapter",get label(){return n("common.field.chapter-name.label")},kinds:["annotation"]},{key:"location",get label(){return n("common.field.location.label")},kinds:["annotation"]},{key:"character",get label(){return n("common.field.character.label")},kinds:["dialogue"]},{key:"actor",get label(){return n("common.field.actor.label")},kinds:["dialogue"]},{key:"timestamp",get label(){return n("common.field.timestamp.label")},kinds:["dialogue"]},{key:"speaker",get label(){return n("common.field.speaker.label")},kinds:["quote"]},{key:"occasion",get label(){return n("common.field.occasion.label")},kinds:["quote"]},{key:"place",get label(){return n("common.field.place.label")},kinds:["quote"]},{key:"kind",get label(){return n("quotes.form.kind.label")},kinds:["quote"],get options(){return or().slice(1)}}];function Um(t){return(t==="book"||t==="movie"?$m:Wm).filter(o=>!o.kinds||o.kinds.includes(t))}function Gm(t,a){const o=[],s=new Set;for(const r of t||[]){const i=r==null?void 0:r[a];i==null||i===""||(o.push(i),s.add(String(i)))}return o.length===0?null:{rows:o.length,distinct:s.size,text:s.size===1?n("common.selection.edit.overwrite.same",{count:o.length,n:o.length,value:[...s][0]}):n("common.selection.edit.overwrite.differ",{count:o.length,n:o.length,distinct:s.size})}}function Ro(){return-new Date().getTimezoneOffset()}let vc={submitStep:!1};function Km(t){vc={submitStep:!!(t!=null&&t.srSubmit)}}const Vm=()=>vc.submitStep;function ui(t){return t.kind==="screen"?n(t.media_type==="show"?"quiz.noun.show.label":"quiz.noun.film.label"):t.kind==="utterance"?n("quiz.noun.occasion.label"):n("quiz.noun.book.label")}function Ym(t){switch(t.direction){case"source":return n("quiz.question.source.stem",{kind:ui(t)});case"quote":return n("quiz.question.quote.stem",{kind:ui(t)});case"cloze":return n("quiz.question.cloze.stem");case"cloze-mcq":return n("quiz.question.cloze-mcq.stem");case"speaker":return n("quiz.question.speaker.stem");case"author":return n("quiz.question.author.stem");default:return n("quiz.question.flip.stem")}}const ms="￼",kc=t=>(t.quote||t.note||"").includes(ms),xc=t=>kc(t)&&!(t.options||[]).length;function Qm(t){return!kc(t)&&!(t.options||[]).length}function Xm({card:t}){return e.jsxs("blockquote",{style:{borderLeft:`4px solid ${bn(t.color)||"var(--accent-ui)"}`,padding:"2px 0 2px 12px"},children:[e.jsx("p",{style:{fontFamily:"var(--font-display)",fontWeight:"var(--font-display-weight)",fontVariantCaps:"var(--font-display-caps)",textTransform:"var(--font-display-case)",fontVariantNumeric:"var(--font-display-figures)",fontStyle:"italic",fontSize:"var(--type-display-17)",lineHeight:1.5,overflowWrap:"anywhere",whiteSpace:"pre-wrap"},children:Jm(t.quote||t.note)}),t.note&&t.quote&&e.jsx(Eo,{className:"mt-2",children:t.note})]})}function Jm(t){const a=t||"";return a.includes(ms)?a.split(ms).flatMap((s,r)=>r===0?[s]:[e.jsx("span",{"aria-label":n("quiz.cloze.blank.aria"),style:{display:"inline-block",minWidth:84,borderBottom:"2px solid var(--accent-ui)",verticalAlign:"baseline"}},r),s]):a}const Zm=4;function ep({opt:t,om:a,personMaps:o,isWork:s,revealed:r,disabled:i,onPick:l,style:h,hotkey:d}){var v;const[m,p]=c.useState(!1),[u,f]=c.useState(!1),b=c.useRef(null);c.useEffect(()=>{const g=b.current;if(!g||m)return;const w=()=>f(g.scrollHeight>g.clientHeight+1);w();const k=new ResizeObserver(w);return k.observe(g),()=>k.disconnect()},[t,m]);const y=m?{}:{display:"-webkit-box",WebkitLineClamp:Zm,WebkitBoxOrient:"vertical",overflow:"hidden"};return e.jsxs("div",{className:"flex items-start gap-2",children:[e.jsx("button",{type:"button",disabled:i,onClick:l,className:"min-w-0 flex-1 text-left",style:h,children:e.jsxs("span",{className:"flex items-start gap-2.5",children:[s&&e.jsx(ps,{path:a==null?void 0:a.art}),e.jsxs("span",{className:"min-w-0 flex-1",children:[e.jsxs("span",{ref:b,style:{display:"block",...y},children:[d&&e.jsx(rn,{keys:d}),d?" ":"",t]}),!s&&(a==null?void 0:a.person)&&e.jsx("span",{className:"mt-1.5 flex",style:{fontStyle:"normal"},children:e.jsx(jc,{name:a.person,person:(v=o[a.kind])==null?void 0:v[a.person],size:18})}),r&&(a==null?void 0:a.source)&&e.jsxs("span",{className:"mt-1.5 flex items-center gap-1.5",style:{fontStyle:"normal"},children:[e.jsx(ps,{path:a.art,size:22}),e.jsx($,{style:{fontSize:"var(--type-ui-11)",color:"var(--faint)"},children:n("quiz.option.source.label",{title:a.source})})]})]})]})}),(u||m)&&e.jsx(Ce,{icon:e.jsx(Na,{open:m}),ariaLabel:n(m?"quiz.option.collapse.aria":"quiz.option.expand.aria"),"aria-expanded":m,onClick:()=>p(g=>!g),tooltip:n(m?"common.action.show-less.label":"quiz.option.expand.tip")})]})}function ps({path:t,size:a=30}){const o={flex:"0 0 auto",width:a,aspectRatio:"2 / 3",borderRadius:4,border:"1px solid var(--ink-border)",background:"var(--raised)",display:"block",objectFit:"cover"};return t?e.jsx("img",{src:$e(t),alt:"",style:o}):e.jsx("span",{style:o,"aria-hidden":"true"})}function jc({name:t,person:a,size:o=20}){return t?e.jsxs("span",{className:"inline-flex items-center gap-1.5",style:{background:"var(--raised)",border:"1px solid var(--line)",borderRadius:999,padding:"2px 9px 2px 4px",maxWidth:"100%"},children:[e.jsx(Ea,{person:a,size:o}),e.jsx("span",{className:"mono-label",style:{fontSize:"var(--type-ui-11)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"},children:t})]}):null}function mi({card:t,maps:a={}}){let o;t.kind==="screen"?o=t.actor?[{name:t.actor,kind:"actor"}]:[]:t.kind==="utterance"?o=t.speaker&&t.speaker!==t.title?[{name:t.speaker,kind:"speaker"}]:[]:o=Je(t.author,Rn).map(r=>({name:r,kind:"author"}));let s;return t.kind==="screen"?s=[n(t.media_type==="show"?"vocab.kind.show.label":"vocab.kind.movie.label"),gn(t),t.character,t.timestamp].filter(Boolean).join(" · "):t.kind==="utterance"?s=t.occasion_date||"":s=[t.character,Os(t),t.location&&n("common.locator.page.label",{n:t.location})].filter(Boolean).join(" · "),e.jsxs("div",{className:"flex items-start gap-3",children:[t.art&&e.jsx(ps,{path:t.art,size:44}),e.jsxs("div",{className:"min-w-0 flex-1",children:[e.jsx("p",{style:{fontFamily:"var(--font-display)",fontStyle:"var(--font-display-style)",fontVariantCaps:"var(--font-display-caps)",textTransform:"var(--font-display-case)",fontVariantNumeric:"var(--font-display-figures)",fontWeight:600,fontSize:"var(--type-display-19)",lineHeight:1.2},children:t.title}),o.length>0&&e.jsx("div",{className:"mt-1.5 flex flex-wrap gap-1.5",children:o.map(r=>{var i;return e.jsx(jc,{name:r.name,person:(i=a[r.kind])==null?void 0:i[r.name]},r.kind+r.name)})}),s&&e.jsx($,{className:"mt-1 block",style:{fontSize:"var(--type-ui-11)"},children:s})]})]})}const tp={book:{list:"/annotations",rows:"annotations"},screen:{list:"/dialogues",rows:"dialogues"},utterance:{list:"/quotes",rows:"utterances"}};function np(t,a){return{...t,note:a.note??t.note,quote:xc(t)?t.quote:a.quote??t.quote}}function ap({card:t,onPatch:a}){const o=tp[t.kind],[s,r]=c.useState(!1),[i,l]=c.useState(null),[h,d]=c.useState(""),[m,p]=c.useState(""),[u,f]=c.useState(""),[b,y]=c.useState(!1),[v,g]=c.useState(!1),[w,k]=c.useState("");c.useEffect(()=>{if(!s||!o)return;let N=!0;return l(null),k(""),X("GET",`${o.list}?id=${t.id}`).then(j=>{var M;if(!N)return;const x=j.ok?(((M=j.data)==null?void 0:M[o.rows])||[])[0]:null;if(!x)return k(n("error.load.quiz-card"));l(x),d(x.quote||""),p(x.note||""),f((x.tags||[]).join(", ")),y(!!x.favorite)}),()=>{N=!1}},[s,t.kind,t.id]);async function S(){if(!i||v)return;g(!0),k("");const N=await X("PUT",`${o.list}/${t.id}`,{...i,quote:h,note:m,favorite:b,tags:u.split(",").map(j=>j.trim()).filter(Boolean)}).catch(()=>({ok:!1}));if(g(!1),!N.ok)return k(le(N,n("error.save.quiz-card")));a(np(t,{quote:h,note:m})),r(!1),Se(n("common.toast.saved"))}return o?e.jsxs("div",{className:"mt-3",style:{borderTop:"1px solid var(--line)",paddingTop:10},children:[s?i==null&&!w?e.jsx($,{style:{color:"var(--faint)"},children:n("common.action.load.busy")}):e.jsxs("div",{className:"space-y-2",children:[e.jsx(xe,{label:n("common.field.quote.label"),value:h,onChange:N=>d(N.target.value)}),e.jsx(xe,{label:n("common.field.note.label"),value:m,onChange:N=>p(N.target.value)}),e.jsx(xe,{label:n("common.field.tags.label"),value:u,placeholder:n("quiz.card.tags.placeholder"),onChange:N=>f(N.target.value)}),e.jsxs("div",{className:"flex flex-wrap items-center gap-2",children:[e.jsxs("button",{type:"button",className:"tp-btn tactile inline-flex items-center gap-1.5","aria-pressed":b,style:b?{color:"var(--accent-ui)",borderColor:"var(--accent-ui)"}:void 0,onClick:()=>y(N=>!N),children:[e.jsx(Vs,{})," ",n(b?"quiz.card.favourite.on.label":"quiz.card.favourite.off.label")]}),e.jsxs("span",{className:"ml-auto flex items-center gap-2",children:[e.jsx("button",{type:"button",className:"tp-link",onClick:()=>r(!1),children:n("common.action.cancel.label")}),e.jsx("button",{type:"button",className:"tp-btn tp-btn-primary tactile",disabled:v||!i,onClick:S,children:n(v?"common.action.save.busy":"common.action.save.label")})]})]})]}):e.jsxs("button",{type:"button",className:"tp-link tp-link-icon",onClick:()=>r(!0),children:[e.jsx(at,{}),e.jsx("span",{children:n("quiz.card.fix.label")})]}),w&&e.jsx("div",{className:"mt-2",children:e.jsx(ve,{children:w})})]}):null}function sr({mode:t,cards:a,allowSkip:o,startIndex:s=0,onIndex:r,onAnswered:i,onDone:l,submitStep:h=!1}){const d=_e(),[m,p]=c.useState(s),[u,f]=c.useState(null),[b,y]=c.useState(!1),[v,g]=c.useState(null),[w,k]=c.useState(null),[S,N]=c.useState(!1),[j,x]=c.useState(""),[M,q]=c.useState(!1),[E,O]=c.useState(!1),[_,T]=c.useState(!1),B=c.useRef(null),[L,V]=c.useState(""),P=c.useRef(s),C=c.useRef(null),{map:H}=Qe("author"),{map:R}=Qe("actor"),{map:I}=Qe("director"),{map:U}=Qe("speaker"),te={author:H,actor:R,director:I,speaker:U},[D,z]=c.useState({}),K=a[m];if(!K)return null;const A=D[m]||K,Y=Qm(A),G=xc(A),ae=h&&!Y&&!G,Z=G?v!=null:ae?S:u!=null,pe=N,ce=Y||G?v!=null:Z,F=G?"cloze":Y?"flip":"mcq",Q=t==="practice";c.useEffect(()=>ql((be,{shift:ee})=>{var je,Ne;if(!_&&ee===Q){if(be==="reveal")return Y&&!b?y(!0):void 0;if(!(Y&&!b)){if(be==="grade-got")return ue("got");if(be==="grade-forgot")return ue("forgot");if(be==="focus-blank")return(je=B.current)==null?void 0:je.focus();if(be.startsWith("pick-")){const Me=Number(be.slice(5))-1;Me>=0&&Me<(((Ne=A.options)==null?void 0:Ne.length)||0)&&!Z&&de(Me)}}}},{ctx:()=>F}),[_,Y,b,G,F,Q,Z,m,A==null?void 0:A.id]);const ie=c.useRef(new Set);c.useEffect(()=>{if(!ce)return;const be=`${A.kind}:${A.id}`;if(!ie.current.has(be)){ie.current.add(be);for(const ee of A.option_meta||[])!(ee!=null&&ee.item_kind)||!(ee!=null&&ee.item_id)||ee.item_kind===A.kind&&ee.item_id===A.id||X("POST","/review/seen",{kind:ee.item_kind,id:ee.item_id}).catch(()=>{})}},[ce,A]);async function he(){if(P.current=m+1,T(!1),V(""),m+1<a.length){p(m+1),r==null||r(m+1),f(null),x(""),N(!1),y(!1),g(null),k(null),q(!1),O(!1);return}await C.current,l==null||l()}async function ue(be,ee=null){var Ae;const je=m;T(!0),V(""),nr();const Ne=X("POST","/review/answer",{kind:A.kind,id:A.id,result:be,mode:t,offset:Ro(),...ee!=null?{attempt:ee}:{}}).catch(()=>({ok:!1,status:0,data:null}));C.current=Ne;const Me=await Ne,ze=P.current===je;if(ze&&T(!1),!Me.ok){ze&&V(n("error.save.quiz-answer"));return}ze&&k(Me.data);const fe=((Ae=Me.data)==null?void 0:Ae.result)||be;ze&&ee!=null&&g(fe),i==null||i(fe,Me.data)}function re(){q(!0)}async function J(){const be=zm[A.kind];if(!be)return;if(O(!0),!(await X("POST",`/${be}s/bulk`,{ids:[A.id],review:!1}).catch(()=>({ok:!1}))).ok){O(!1),Se(n("error.setaside.generic"));return}Se(n("quiz.leech.aside.label"))}async function de(be){if(!(Z||_)){if(ae){f(be);return}f(be),await ue(be===A.answer?"got":"forgot")}}async function Te(){u==null||Z||_||(pe(!0),await ue(u===A.answer?"got":"forgot"))}async function Be(){v!=null||_||!j.trim()||await ue("forgot",j)}async function We(be){v!=null||_||(g(be),await ue(be))}const qe=A.direction==="source",ne=A.direction==="quote"||A.direction==="cloze-mcq",me=v==="got",oe=!M&&((w==null?void 0:w.leech)??A.leech);return e.jsxs("div",{className:"review-card-body",children:[e.jsxs("div",{className:"mb-2 flex items-baseline justify-between gap-3",children:[e.jsx($,{children:Ym(A)}),e.jsx("span",{className:"mono-label",style:{letterSpacing:".06em"},children:n("quiz.progress.label",{done:m+1,total:a.length})})]}),A.direction==="quote"?e.jsx(mi,{card:A,maps:te}):e.jsx(Xm,{card:A}),G&&e.jsx("div",{className:"mt-3",children:v==null?e.jsxs("form",{className:"flex items-end gap-2",onSubmit:be=>{be.preventDefault(),Be()},children:[e.jsx(xe,{label:n("quiz.cloze.field.label"),hideLabel:!0,inputRef:B,value:j,placeholder:d?n("quiz.cloze.placeholder"):n("quiz.cloze.placeholder-key",{key:Ft("focus-blank",t==="practice")}),autoFocus:!0,onChange:be=>x(be.target.value)}),e.jsx("button",{type:"submit",className:"tp-btn tp-btn-primary tactile",disabled:_||!j.trim(),children:n("quiz.cloze.check.label")})]}):e.jsxs("div",{style:{borderTop:"1px solid var(--line)",paddingTop:12},children:[e.jsx($,{style:{color:"var(--faint)"},children:n("quiz.cloze.answer.label")}),e.jsx("p",{className:"mt-1",style:{fontFamily:"var(--font-display)",fontWeight:"var(--font-display-weight)",fontVariantCaps:"var(--font-display-caps)",textTransform:"var(--font-display-case)",fontVariantNumeric:"var(--font-display-figures)",fontSize:"var(--type-display-17)",fontStyle:"italic"},children:(w==null?void 0:w.answer)||j}),(w==null?void 0:w.synonym)&&e.jsx($,{className:"mt-1 block",style:{color:"var(--faint)"},children:n("quiz.cloze.synonym.note")})]})}),Y&&e.jsx("div",{className:"mt-3",children:b?e.jsxs(e.Fragment,{children:[e.jsx("div",{style:{borderTop:"1px solid var(--line)",paddingTop:12},children:e.jsx(mi,{card:A,maps:te})}),v==null?e.jsxs("div",{className:"mt-3 flex items-center gap-2",children:[e.jsx(ye,{label:n("quiz.grade.forgot.label"),shortcut:"grade-forgot",shiftKey:t==="practice",children:e.jsxs("button",{type:"button",className:"tp-btn tactile",disabled:_,onClick:()=>We("forgot"),children:[n("quiz.grade.forgot.label")," ",e.jsx(rn,{keys:Ft("grade-forgot",t==="practice")})]})}),e.jsx(ye,{label:n("quiz.grade.got.label"),shortcut:"grade-got",shiftKey:t==="practice",children:e.jsxs("button",{type:"button",className:"tp-btn tp-btn-primary tactile",disabled:_,onClick:()=>We("got"),children:[n("quiz.grade.got.label")," ",e.jsx(rn,{keys:Ft("grade-got",t==="practice")})]})})]}):null]}):e.jsx(ye,{label:n("quiz.flip.reveal.tip"),shortcut:"reveal",shiftKey:t==="practice",children:e.jsxs("button",{type:"button",className:"tp-btn tp-btn-primary tactile",onClick:()=>y(!0),children:[n("quiz.flip.reveal.label")," ",e.jsx(rn,{keys:Ft("reveal",t==="practice")})]})})}),e.jsx("div",{className:"mt-3 flex flex-col gap-2",children:(A.options||[]).map((be,ee)=>{var Ae;const je=ee===A.answer,Ne=u===ee,Me=((Ae=A.option_meta)==null?void 0:Ae[ee])||null;let ze="var(--line)",fe="var(--raised)";return ce&&je?(ze="var(--ok)",fe="color-mix(in srgb, var(--ok) 16%, transparent)"):ce&&Ne&&!je?(ze="var(--error)",fe="color-mix(in srgb, var(--error) 12%, transparent)"):Ne&&(ze="var(--accent-ui)",fe="color-mix(in srgb, var(--accent-ui) 10%, transparent)"),e.jsx(ep,{opt:be,om:Me,personMaps:te,isWork:qe,revealed:ce,disabled:Z||_,hotkey:ee<4?Ft(`pick-${ee+1}`,t==="practice"):"",onPick:()=>de(ee),style:{minHeight:44,padding:"9px 13px",borderRadius:9,border:`1.4px solid ${ze}`,background:fe,fontFamily:ne?"var(--font-display)":"var(--font-ui)",fontStyle:ne?"italic":"normal",fontSize:"var(--type-ui-15)",lineHeight:1.4,overflowWrap:"anywhere"}},ee)})}),ce&&oe&&e.jsx("div",{className:"mt-3",style:{borderTop:"1px solid var(--line)",paddingTop:10},children:E?e.jsx($,{style:{color:"var(--faint)"},children:n("quiz.leech.aside.label")}):e.jsxs("div",{className:"flex flex-wrap items-center gap-2",children:[e.jsx($,{style:{color:"var(--faint)"},children:n("quiz.leech.count.label",{n:(w==null?void 0:w.lapse_count)??A.lapse_count,count:(w==null?void 0:w.lapse_count)??A.lapse_count})}),e.jsx("button",{type:"button",className:"tp-link",style:{marginLeft:"auto"},onClick:re,children:n("quiz.leech.keep.label")}),e.jsx("button",{type:"button",className:"tp-btn tactile",onClick:J,children:n("quiz.leech.aside.action.label")})]})}),ce&&e.jsx(ap,{card:A,onPatch:be=>z(ee=>({...ee,[m]:be}))}),ce?e.jsxs("div",{className:"mt-3 flex items-center justify-between gap-3",children:[e.jsx($,{style:{color:(Y?v==="got":G?me:u===A.answer)?"var(--ok)":"var(--error)"},children:n(Y?v==="got"?"quiz.verdict.recalled.label":"quiz.verdict.noted.label":(G?me:u===A.answer)?"quiz.verdict.correct.label":"quiz.verdict.wrong.label")}),e.jsxs("span",{className:"flex items-center gap-2.5",children:[_&&e.jsx($,{style:{color:"var(--faint)"},children:n("quiz.saving.label")}),e.jsx("button",{type:"button",className:"tp-btn tp-btn-primary tactile",onClick:he,children:n(m+1<a.length?"quiz.next.label":"quiz.finish.label")})]})]}):ae&&u!=null?e.jsxs("div",{className:"mt-3 flex items-center justify-between gap-3",children:[e.jsx($,{style:{color:"var(--faint)"},children:n("quiz.submit.hint")}),e.jsx("button",{type:"button",className:"tp-btn tp-btn-primary tactile",disabled:_,onClick:Te,children:n("quiz.submit.label")})]}):o&&!(Y&&b)?e.jsx("div",{className:"mt-3 text-right",children:e.jsx("button",{type:"button",className:"tp-link",onClick:he,children:n("quiz.skip.label")})}):null,L&&e.jsx("div",{className:"mt-2",children:e.jsx(ve,{children:L})})]},m)}function op(t){const a=new URLSearchParams;for(const o of Sc)t!=null&&t[o]&&a.set(o,String(t[o]));return a.toString()}const Sc=["book","movie","tag","color","person","anthology"];function sp({theme:t,onClose:a}){const[o,s]=c.useState(null),[r,i]=c.useState({got:0,forgot:0}),[l,h]=c.useState(!1),[d,m]=c.useState(0);c.useEffect(()=>{let u=!0;s(null),h(!1),i({got:0,forgot:0});const f=op(t);return X("GET",`/review/practice${f?`?${f}`:""}`).then(b=>{u&&s(b.ok?b.data.items||[]:[])}),()=>{u=!1}},[d,...Sc.map(u=>t==null?void 0:t[u])]);const p=o!=null&&o.length===0;return e.jsx(Ge,{open:!0,onClose:a,title:(t==null?void 0:t.label)||n("quiz.practice.label"),maxWidth:560,children:e.jsxs("div",{className:"review-card-body",children:[o==null&&e.jsx($,{style:{color:"var(--faint)"},children:n("common.action.load.busy")}),p&&e.jsxs("div",{className:"py-2 text-center",children:[e.jsx("p",{className:"tp-empty",children:n("quiz.practice.empty")}),e.jsx("button",{type:"button",className:"tp-btn tactile mt-3",onClick:a,children:n("common.action.close.label")})]}),o!=null&&o.length>0&&!l&&e.jsxs(e.Fragment,{children:[e.jsx(sr,{mode:"practice",cards:o,allowSkip:!0,submitStep:Vm(),onAnswered:u=>i(f=>({got:f.got+(u==="got"?1:0),forgot:f.forgot+(u==="forgot"?1:0)})),onDone:()=>h(!0)},d),e.jsx("div",{className:"mt-2 text-right",children:e.jsx("button",{type:"button",className:"tp-link",onClick:a,children:n("quiz.practice.end.label")})})]}),l&&e.jsxs("div",{className:"py-2 text-center",children:[e.jsx("p",{"aria-hidden":"true",style:{fontFamily:"var(--font-hand)",fontWeight:"var(--font-hand-weight)",fontStyle:"var(--font-hand-style)",fontVariantCaps:"var(--font-hand-caps)",textTransform:"var(--font-hand-case)",fontVariantNumeric:"var(--font-hand-figures)",fontSize:"var(--type-hand-26)",color:"var(--accent-ui)",transform:"rotate(-1.2deg)"},children:n("quiz.round.score.label",{done:r.got,total:r.got+r.forgot})}),e.jsx("p",{className:"mono-label mt-1 mb-3",style:{letterSpacing:".06em"},children:n("quiz.round.summary.label",{got:r.got,missed:r.forgot})}),e.jsxs("div",{className:"flex items-center justify-center gap-2",children:[e.jsx("button",{type:"button",className:"tp-btn tactile",onClick:a,children:n("common.action.done.label")}),e.jsx("button",{type:"button",className:"tp-btn tp-btn-primary tactile",onClick:()=>m(u=>u+1),children:n("quiz.round.again.label")})]})]})]})})}function qa(){const[t,a]=c.useState(null);return{practise:o=>a(o),practiceDialog:t?e.jsx(sp,{theme:t,onClose:()=>a(null)}):null}}const rr="tp-btn tp-btn-primary",Do=[["imdb","vocab.source.imdb.label",/(^|\.)imdb\.com$/i],["tmdb","vocab.source.tmdb.label",/(^|\.)themoviedb\.org$/i],["tvdb","vocab.source.tvdb.label",/(^|\.)thetvdb\.com$/i],["wikipedia","vocab.source.wikipedia.label",/(^|\.)wikipedia\.org$/i],["openlibrary","vocab.source.openlibrary.label",/(^|\.)openlibrary\.org$/i]];function Io(t){const a={},o=[];for(const s of String(t||"").split(/[\s\n]+/).filter(Boolean)){let r="";try{r=new URL(s).hostname}catch{o.push(s);continue}const i=Do.find(([,,l])=>l.test(r));i&&!a[i[0]]?a[i[0]]=s:o.push(s)}return{known:a,extra:o}}function rp(t,a){const{known:o,extra:s}=Io(t),r={...o};for(const[i,l]of Object.entries(a||{}))l&&!r[i]&&(r[i]=l);return[...Do.map(([i])=>r[i]).filter(Boolean),...s].join(`
`)}function Lw({links:t}){const{known:a}=Io(t),o=Do.filter(([s])=>a[s]);return o.length===0?e.jsx("span",{className:"microcopy",children:"—"}):e.jsx("span",{className:"flex flex-wrap items-center gap-1.5",children:o.map(([s,r])=>e.jsx("a",{className:"tp-chip tp-chip-btn",href:a[s],target:"_blank",rel:"noopener noreferrer",children:n(r)},s))})}function ir({kind:t,name:a,onOpen:o,className:s="tp-link",style:r,children:i}){return a?e.jsx("button",{type:"button",className:s,style:r,onClick:l=>{l.stopPropagation(),o({kind:t,name:a})},title:`${a} — details`,children:i||a}):null}function Ma({names:t,map:a={},size:o=24,ring:s="var(--bg)",className:r=""}){const l=(Array.isArray(t)?t:t?[t]:[]).map(h=>a==null?void 0:a[h]).filter(h=>h==null?void 0:h.image_path);return e.jsx(Tc,{paths:l.map(h=>h.image_path),size:o,ring:s,className:r})}function Nc({images:t=[],size:a=24,ring:o="var(--bg)",className:s=""}){return e.jsx(Tc,{paths:(t||[]).map(r=>r==null?void 0:r.path).filter(Boolean),size:a,ring:o,className:s})}function Tc({paths:t=[],size:a=24,ring:o="var(--bg)",className:s=""}){if(t.length===0)return null;const r=Math.round(a*.34);return e.jsx("span",{className:("inline-flex items-center "+s).trim(),style:{flex:"none"},children:t.map((i,l)=>e.jsx("span",{style:{position:"relative",marginLeft:l===0?0:-r,zIndex:t.length-l,borderRadius:"50%",boxShadow:`0 0 0 2px ${o}`,lineHeight:0},children:e.jsx(Ea,{person:{image_path:i},size:a})},i+l))})}function Po({kind:t,name:a,person:o,size:s=28,onOpen:r,nameClassName:i,nameStyle:l,className:h=""}){return a?e.jsxs("span",{className:("inline-flex items-center gap-1.5 "+h).trim(),style:{verticalAlign:"middle"},children:[e.jsx(Ea,{person:o,size:s}),e.jsx(ir,{kind:t,name:a,onOpen:r,className:i,style:l})]}):null}function pi(t){const a=r=>(r||"").trim().slice(0,4),o=a(t==null?void 0:t.born),s=a(t==null?void 0:t.died);return o&&s?n("people.lifespan.range",{born:o,died:s}):o||(s?n("people.lifespan.died",{died:s}):"")}function ip({person:t,name:a,onEdit:o,onDelete:s,onPractise:r}){const[i,l]=c.useState(!1),h=t.image_path?e.jsx(ye,{label:n("people.photo.zoom.tip"),side:"bottom",className:"person-photo-btn float-left mt-[2px] mr-[14px] mb-[8px]",children:e.jsx("button",{type:"button",onClick:()=>l(!0),"aria-label":n("people.photo.zoom.aria",{name:a}),style:{width:104,padding:0,background:"none",border:"none",cursor:"zoom-in"},children:e.jsx("img",{src:_o(t.image_path),alt:a,style:{display:"block",width:"100%",aspectRatio:"7 / 9",objectFit:"cover",borderRadius:8,border:"1px solid var(--ink-border)"}})})}):e.jsx("div",{style:{float:"left",width:104,margin:"2px 14px 8px 0"},children:e.jsx(Dt,{kind:"",style:{width:"100%",aspectRatio:"7 / 9"}})});return e.jsxs("div",{className:"space-y-3",children:[e.jsxs("div",{style:{overflow:"hidden"},children:[" ",h,e.jsxs("div",{className:"min-w-0 space-y-1.5",children:[pi(t)&&e.jsx($,{className:"block",children:pi(t)}),t.bio&&e.jsx(is,{text:t.bio,lines:5}),t.links&&e.jsxs("div",{className:"space-y-1",children:[e.jsx($,{className:"block",style:{color:"var(--faint)"},children:n("people.links.heading")}),e.jsx(lp,{links:t.links})]}),t.source&&t.source!=="manual"&&e.jsx($,{className:"block",style:{color:"var(--faint)"},children:n("people.source.via",{source:t.source})})]})]}),i&&e.jsx(Ws,{path:t.image_path,title:a,onClose:()=>l(!1)}),e.jsxs("div",{className:"flex flex-wrap items-center justify-end gap-2",style:{borderTop:"1px solid var(--line)",paddingTop:12},children:[e.jsxs(ge,{onClick:r,className:"mr-auto inline-flex items-center gap-1.5",children:[e.jsx(Ct,{})," ",n("common.action.practise.label")]}),e.jsxs(ge,{onClick:s,className:"inline-flex items-center gap-1.5",style:{color:"var(--error)",borderColor:"color-mix(in srgb, var(--error) 55%, transparent)"},children:[e.jsx(Fe,{})," ",n("common.action.delete.label")]}),e.jsxs("button",{className:rr+" inline-flex items-center gap-1.5",onClick:o,children:[e.jsx(at,{})," ",n("common.action.edit.label")]})]})]})}function lp({links:t}){const{known:a,extra:o}=Io(t),s=Do.filter(([r])=>a[r]);return s.length===0&&o.length===0?e.jsx("span",{className:"microcopy",children:"—"}):e.jsxs("span",{className:"flex flex-wrap items-center gap-1.5",children:[s.map(([r,i])=>e.jsx("a",{className:"tp-chip tp-chip-btn",href:a[r],target:"_blank",rel:"noopener noreferrer",children:n(i)},r)),o.map(r=>/^https?:\/\//i.test(r)?e.jsx("a",{className:"tp-chip tp-chip-btn",href:r,target:"_blank",rel:"noopener noreferrer",children:r.replace(/^https?:\/\/(www\.)?/,"").replace(/\/$/,"")},r):e.jsx("span",{className:"tp-chip",children:r},r))]})}function cp({kind:t,name:a,initial:o,onCancel:s,onSaved:r,onRenamed:i}){const[l,h]=c.useState((o==null?void 0:o.bio)||""),[d,m]=c.useState((o==null?void 0:o.born)||""),[p,u]=c.useState((o==null?void 0:o.died)||""),[f,b]=c.useState((o==null?void 0:o.links)||""),[y,v]=c.useState(""),[g,w]=c.useState(!1),[k,S]=c.useState(!1),[N,j]=c.useState(""),[x,M]=c.useState(a),[q,E]=c.useState(!1),[O,_]=c.useState(null),[T,B]=c.useState(!1),L=t==="author"||t==="translator"||t==="editor",P=n(L?"unit.book":t==="speaker"?"unit.quote":t==="studio"?"unit.game":"unit.film",{count:2}),H=n(L?"unit.book":t==="actor"?"unit.dialogue":t==="speaker"?"unit.quote":t==="studio"?"unit.game":"unit.film",{count:1}),R=t==="studio";async function I(){const D=x.trim();if(!D||D===a||!confirm(n("people.rename.confirm",{from:a,to:D,noun:P,entity:H})))return;E(!0),j("");const z=await X("POST","/people/rename",{kind:t,from:a,to:D});E(!1),z.ok?i&&i(D):j(le(z,n("error.rename.generic")))}async function U(){var A,Y;B(!0),j("");const D=await X("POST","/images/search",{kind:"portrait",name:a,person_id:(o==null?void 0:o.id)||0}).catch(()=>({ok:!1}));B(!1);const z=D.ok?((A=D.data)==null?void 0:A.images)||[]:[];if(!(D.ok&&Object.values(((Y=D.data)==null?void 0:Y.sources)||{}).some(Boolean))){window.open(`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(a+" "+t)}`,"_blank","noopener");return}_(z)}async function te(D){if(D.preventDefault(),D.stopPropagation(),d.trim()&&!ua(d.trim()))return j(n("error.validate.born-date"));if(p.trim()&&!ua(p.trim()))return j(n("error.validate.died-date"));S(!0),j("");const z=await X("PUT","/people",{kind:t,name:a,bio:l.trim(),born:d.trim(),died:p.trim(),links:f.trim(),source:(o==null?void 0:o.source)||"manual",source_id:(o==null?void 0:o.source_id)||"",image_url:y.trim()||void 0,clear_image:g||void 0});S(!1),z.ok?r(z.data):j(le(z,n("error.save.generic")))}return e.jsxs("form",{onSubmit:te,className:"space-y-3",children:[(o==null?void 0:o.image_path)&&!g&&e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx("img",{src:_o(o.image_path),alt:"",className:"w-16 rounded object-cover",style:{aspectRatio:"3 / 4"}}),e.jsxs("button",{type:"button",className:"tp-link tp-link-danger tp-link-icon",onClick:()=>w(!0),children:[e.jsx(Fe,{}),e.jsx("span",{children:n("people.form.photo.remove")})]})]}),e.jsxs("label",{className:"block",children:[e.jsx($,{className:"mb-1.5 block",children:n("common.field.bio.label")}),e.jsx("textarea",{className:"tp-input",rows:"4",value:l,onChange:D=>h(D.target.value)})]}),e.jsxs("div",{className:"grid gap-3 sm:grid-cols-2",children:[e.jsx(ma,{label:n(R?"people.form.founded.label":"common.field.born.label"),value:d,onChange:m,placeholder:n("people.form.born.placeholder")}),e.jsx(ma,{label:n(R?"people.form.closed.label":"common.field.died.label"),value:p,onChange:u,placeholder:n(R?"people.form.closed.placeholder":"people.form.died.placeholder")})]}),e.jsxs("div",{children:[e.jsxs("div",{className:"mb-1.5 flex items-center justify-between gap-2",children:[e.jsx($,{children:n(R?"people.form.logo-url.label":"people.form.photo-url.label")}),e.jsxs("button",{type:"button",className:"tp-link tp-link-icon",style:{fontSize:"var(--type-ui-11)"},disabled:T,onClick:U,children:[e.jsx(kt,{}),e.jsx("span",{children:n(T?"common.state.loading":"people.form.image-search")})]})]}),O&&e.jsxs("div",{className:"mb-1.5 space-y-1.5",children:[e.jsx($,{className:"block",children:O.length?n("people.form.image-pick.prose"):n("people.form.image-pick.none")}),e.jsx("div",{className:"flex flex-wrap gap-2",children:O.map(D=>e.jsxs("button",{type:"button",className:"cover-pick","aria-label":n("people.form.image-pick.use",{source:D.source}),onClick:()=>{v(D.url),w(!1),_(null)},children:[e.jsx("img",{src:D.thumb||D.url,alt:"",loading:"lazy"}),e.jsx("span",{className:"microcopy",children:D.source})]},D.url))})]}),e.jsx("input",{className:"tp-input",value:y,onChange:D=>{v(D.target.value),w(!1)},placeholder:n("people.form.image-url.placeholder")})]}),e.jsxs("label",{className:"block",children:[e.jsx($,{className:"mb-1.5 block",children:n("common.field.links.label")}),e.jsx("textarea",{className:"tp-input",rows:"3",value:f,onChange:D=>b(D.target.value),placeholder:[n("people.form.links.placeholder.1"),n("people.form.links.placeholder.2")].join(`
`)}),e.jsx("p",{className:"microcopy mt-1",children:n("people.form.links.hint")})]}),e.jsxs("div",{className:"space-y-1.5",style:{borderTop:"1px solid var(--line)",paddingTop:12},children:[e.jsx($,{children:n("people.rename.label")}),e.jsxs("div",{className:"flex flex-wrap items-center gap-2",children:[e.jsx(Nt,{style:{flex:1,minWidth:160},value:x,onChange:D=>M(D.target.value),placeholder:a}),e.jsx(ge,{type:"button",icon:e.jsx(Bu,{}),keepLabel:!0,disabled:q||!x.trim()||x.trim()===a,onClick:I,children:n(q?"people.rename.busy":"people.rename.action")})]}),e.jsx("p",{className:"microcopy",children:n(R?"people.rename.hint.org":"people.rename.hint.person",{entity:H})})]}),e.jsx(ve,{children:N}),e.jsxs("div",{className:"flex justify-end gap-2",children:[e.jsxs(ge,{type:"button",onClick:s,children:[e.jsx(it,{})," ",n("common.action.cancel.label")]}),e.jsxs("button",{className:rr+" inline-flex items-center gap-1.5",disabled:k,children:[e.jsx(ft,{})," ",n("common.action.save.label")]})]})]})}function yn({kind:t,name:a,onClose:o,onSaved:s}){At(!0);const[r,i]=c.useState(null),[l,h]=c.useState(!0),[d,m]=c.useState(!1),[p,u]=c.useState(!1),[f,b]=c.useState(""),[y,v]=c.useState(""),g=c.useRef(!1),{practise:w,practiceDialog:k}=qa();c.useEffect(()=>{let x=!1;return h(!0),X("GET",`/people?${new URLSearchParams({kind:t,name:a})}`).then(M=>{if(!x){if(h(!1),!M.ok)return v(le(M));i(M.data.exists?M.data.person:null),m(!1)}}),()=>{x=!0}},[t,a]);async function S(x,M){u(!0),b("");let q=M;if(!q){const O=await X("POST","/people/lookup",{kind:t,name:a});if(!O.ok)return u(!1),b(le(O,n("error.lookup.failed")));q=O.data.links}const E=rp(x==null?void 0:x.links,q);if(!E)return u(!1),b(n("error.lookup.none"));if(E!==((x==null?void 0:x.links)||"")){const O=await X("PUT","/people",{kind:t,name:a,bio:(x==null?void 0:x.bio)||"",born:(x==null?void 0:x.born)||"",died:(x==null?void 0:x.died)||"",links:E,source:(x==null?void 0:x.source)||"lookup",source_id:(x==null?void 0:x.source_id)||""});O.ok?(i(O.data),s&&s()):b(le(O,n("error.save.links")))}u(!1)}async function N(){const x=await X("POST","/people/portrait",{kind:t,name:a});return x.ok?(x.data.person&&x.data.person.id&&(i(x.data.person),s&&s()),{person:x.data.person,links:x.data.links}):{person:null,links:null}}c.useEffect(()=>{l||g.current||(g.current=!0,(async()=>{let x=r,M=null;if(!(x!=null&&x.image_path)||!(x!=null&&x.bio)){const q=await N();q.person&&q.person.id&&(x=q.person),q.links&&Object.keys(q.links).length>0&&(M=q.links)}Object.keys(Io(x==null?void 0:x.links).known).length===0&&await S(x,M||void 0)})())},[l,r]),c.useEffect(()=>{const x=M=>M.key==="Escape"&&o();return document.addEventListener("keydown",x),()=>document.removeEventListener("keydown",x)},[o]);async function j(){if(!r||!confirm(n("people.delete.confirm",{kind:n(`common.field.${t}.label`),name:a})))return;const x=await X("DELETE",`/people/${r.id}`);x.ok?(s&&s(),o()):v(le(x))}return e.jsxs("div",{className:"tp-scrim fixed inset-0 z-50 overflow-y-auto px-4 py-10",onMouseDown:x=>{x.target===x.currentTarget&&o()},children:[e.jsxs("div",{role:"dialog","aria-modal":"true","aria-label":a,className:"hand-card hc-r2 mx-auto w-full max-w-md px-6 py-6",children:[e.jsxs("div",{className:"mb-4 flex items-start justify-between gap-3",children:[e.jsxs("div",{className:"flex min-w-0 items-center gap-3",children:[e.jsx(Ea,{person:r,size:40}),e.jsxs("div",{className:"min-w-0",children:[e.jsx($,{children:n(`common.field.${t}.label`)}),e.jsx("h2",{className:"display-title truncate text-xl",children:a})]})]}),e.jsx(Zs,{onClick:o})]}),e.jsx(ve,{children:y}),l?e.jsx("p",{className:"microcopy",children:n("common.state.loading")}):d?e.jsx(cp,{kind:t,name:a,initial:r,onCancel:()=>m(!1),onSaved:x=>{i(x),m(!1),s&&s()},onRenamed:()=>{s&&s(),o()}}):e.jsxs("div",{className:"space-y-3",children:[r?e.jsx(ip,{person:r,name:a,onEdit:()=>m(!0),onDelete:j,onPractise:()=>w({person:a,label:a})}):e.jsxs(e.Fragment,{children:[e.jsx("p",{className:"microcopy",children:n("people.state.nothing-saved")}),e.jsx("div",{className:"flex justify-end",children:e.jsxs("button",{className:rr+" inline-flex items-center gap-1.5",onClick:()=>m(!0),children:[e.jsx(tt,{})," ",n("people.add-details")]})})]}),p&&e.jsx("p",{className:"microcopy",children:n("people.links.fetching")}),!p&&f&&e.jsx("p",{className:"microcopy",children:f}),e.jsxs("button",{className:"tp-link tp-link-icon",disabled:p,onClick:()=>S(r),children:[e.jsx(Ku,{}),e.jsx("span",{children:n("people.links.refetch")})]})]})]}),k]})}const Ec=t=>n(t==="voice"?"cast.role.voice.label":"common.field.actor.label"),Cc=20;function dp({kind:t,item:a,onCastChanged:o}){const s=t==="book"?"books":"movies",[r,i]=c.useState(null),[l,h]=c.useState("none"),[d,m]=c.useState(""),[p,u]=c.useState(""),[f,b]=c.useState(!0),[y,v]=c.useState(!1),[g,w]=c.useState(null),{map:k,reload:S}=Qe(t==="book"?"":"actor"),N=c.useMemo(()=>[...new Set((r||[]).map(T=>(T.actor||"").trim()).filter(Boolean))],[r]);gc(t==="book"?"":"actor",N,k,S);const j=c.useRef(!1),x=async(T=!1)=>{const B=await X("GET",`/${s}/${a.id}/cast`);return B.ok?(m(""),h(B.data.actor_role||"none"),i(B.data.cast||[]),T&&M(B.data.cast||[]),B.data.cast||[]):m(le(B,n("error.load.cast")))};async function M(T){var L;const B=(T||[]).filter(V=>V.character_image_url&&!V.character_image_path).slice(0,Cc);for(const V of B){const P=await X("POST",`/cast/${V.id}/image`);!P.ok||!((L=P.data)!=null&&L.character_image_path)||i(C=>(C||[]).map(H=>H.id===V.id?{...H,...P.data}:H))}}c.useEffect(()=>{if(!f)return;const T=!j.current;j.current=!0,x(T)},[f,a.id]),c.useEffect(()=>{j.current=!1},[a.id]);async function q(T,B){u("row");const L=await X("PUT",`/cast/${T}`,B);return u(""),L.ok?(m(""),o==null||o(await x()),!0):(m(le(L,n("error.save.generic"))),!1)}async function E(T){u("add");const B=await X("POST",`/${s}/${a.id}/cast`,T);return u(""),B.ok?(m(""),o==null||o(await x()),!0):(m(le(B,n("error.save.generic"))),!1)}async function O(T){u("row");const B=await X("DELETE",`/cast/${T}`);if(u(""),!B.ok)return m(le(B,n("error.delete.generic")));m(""),o==null||o(await x())}async function _(T,B){u("image");const L=await X("POST",`/cast/${T}/image`,{image_url:B});if(u(""),!L.ok)return m(le(L,n("error.load.cast-picture")));m(""),i(V=>(V||[]).map(P=>P.id===T?{...P,...L.data}:P))}return f?e.jsxs("div",{className:"space-y-2",children:[e.jsxs("div",{className:"flex flex-wrap items-center gap-2",children:[e.jsx($,{children:n("cast.heading.label")}),e.jsx(Le,{title:n("cast.info.title"),text:n("cast.info.body")}),e.jsx("span",{className:"flex-1"}),e.jsx(Ce,{icon:e.jsx(tt,{}),ariaLabel:n("cast.add.aria"),onClick:()=>v(!0),disabled:!!p}),e.jsx(Ce,{icon:e.jsx(it,{}),ariaLabel:n("common.action.close.label"),onClick:()=>b(!1)})]}),e.jsx(ve,{children:d}),r===null?e.jsx("p",{className:"microcopy",children:n("common.state.loading")}):r.length===0?e.jsx("p",{className:"microcopy",children:n("cast.empty.prose")}):e.jsx("ul",{className:"cast-list",children:r.map(T=>e.jsx(hp,{row:T,role:l,busy:!!p,actor:k[T.actor],workTitle:a.title,mediaType:t==="book"?"book":a.media_type||"movie",onSave:B=>q(T.id,B),onRemove:()=>O(T.id),onImage:B=>_(T.id,B),onOpenPerson:T.actor?()=>w({kind:"actor",name:T.actor}):null},T.id))}),y&&e.jsx(up,{role:l,busy:!!p,onCancel:()=>v(!1),onAdd:async T=>{await E(T)&&v(!1)}}),g&&e.jsx(yn,{kind:g.kind,name:g.name,onClose:()=>w(null),onSaved:()=>S()})]}):e.jsxs("div",{className:"flex flex-wrap items-center gap-2",children:[e.jsxs(ge,{type:"button",onClick:()=>b(!0),children:[e.jsx(mo,{}),e.jsx("span",{children:n("cast.open.label")})]}),e.jsx(Le,{title:n("cast.info.title"),text:n("cast.info.body")})]})}function hp({row:t,role:a,busy:o,actor:s,workTitle:r,mediaType:i,onSave:l,onRemove:h,onImage:d,onOpenPerson:m}){const[p,u]=c.useState(!1),[f,b]=c.useState(t.character||""),[y,v]=c.useState(t.actor||""),[g,w]=c.useState(!1),[k,S]=c.useState(""),[N,j]=c.useState(!1),[x,M]=c.useState(null),[q,E]=c.useState(!1),O=async()=>{await d(k.trim()),S(""),w(!1)};async function _(){var te,D;E(!0);const I=await X("POST","/images/search",{kind:"character",name:t.character||"",actor:t.actor||"",title:r||"",media_type:i||"",cast_id:t.id||0}).catch(()=>({ok:!1}));if(E(!1),!(I.ok&&Object.values(((te=I.data)==null?void 0:te.sources)||{}).some(Boolean))){window.open(`https://www.google.com/search?tbm=isch&q=${encodeURIComponent([t.character,r].filter(Boolean).join(" "))}`,"_blank","noopener");return}M(((D=I.data)==null?void 0:D.images)||[])}const T=t.character_image_path?$e(t.character_image_path):s!=null&&s.image_path?_o(s.image_path):"",B=e.jsxs("button",{type:"button",className:"cast-face-btn"+(T?"":" is-empty"),"aria-label":n("cast.picture.aria",{name:t.character||""}),"aria-expanded":g,disabled:o,onClick:()=>w(I=>!I),children:[T?e.jsx("img",{className:"cast-face",src:T,alt:""}):e.jsx("span",{className:"cast-face is-empty","aria-hidden":"true"}),e.jsx("span",{className:"cast-face-mark","aria-hidden":"true",children:e.jsx(Gu,{size:16})})]}),L=async()=>{if(!f.trim())return!1;const I={character:f.trim()};return a!=="none"&&(I.actor=y.trim()),await l(I)?(u(!1),!0):!1},V=I=>{I.key!=="Enter"||o||(I.preventDefault(),L())},P=c.useContext(Fs),C=p&&(f!==(t.character||"")||y!==(t.actor||"")),H=c.useRef(L);H.current=L,c.useEffect(()=>{if(!(P!=null&&P.register)||!C)return;const I=`cast-${t.id}`;return P.register(I,{save:()=>H.current(),close:()=>u(!1)}),()=>P.register(I,null)},[P,C,t.id]);const R=g&&e.jsxs("span",{className:"cast-row-url",children:[e.jsxs("button",{type:"button",className:"tp-link tp-link-icon",style:{fontSize:"var(--type-ui-11)"},disabled:q,onClick:_,children:[e.jsx(kt,{}),e.jsx("span",{children:n(q?"common.state.loading":"people.form.image-search")})]}),e.jsx("input",{className:"tp-input",placeholder:n("cast.picture.placeholder"),"aria-label":n("cast.picture.url.aria",{name:t.character||""}),value:k,onChange:I=>S(I.target.value),onKeyDown:I=>{I.key!=="Enter"||o||!k.trim()||(I.preventDefault(),O())}}),e.jsx(ge,{type:"button",disabled:o||!k.trim(),onClick:O,children:n("common.action.apply.label")}),x&&e.jsxs("span",{className:"cast-row-pics",children:[e.jsx("span",{className:"microcopy",children:x.length?n("cast.picture.pick.prose"):n("cast.picture.pick.none")}),e.jsx("span",{className:"flex flex-wrap gap-2",children:x.map(I=>e.jsxs("button",{type:"button",className:"cover-pick","aria-label":n("cast.picture.pick.use",{source:I.source}),disabled:o,onClick:async()=>{M(null),w(!1),await d(I.url)},children:[e.jsx("img",{src:I.thumb||I.url,alt:"",loading:"lazy"}),e.jsx("span",{className:"microcopy",children:I.source})]},I.url))})]})]});return p?e.jsxs("li",{className:"cast-row is-editing",children:[B,e.jsxs("div",{className:"cast-row-fields",children:[e.jsx(xe,{label:n("common.field.character.label"),nameCase:!0,value:f,autoFocus:!0,onChange:I=>b(I.target.value),onKeyDown:V}),a!=="none"&&e.jsx(xe,{label:Ec(a),nameCase:!0,value:y,onChange:I=>v(I.target.value),onKeyDown:V})]}),e.jsxs("div",{className:"cast-row-acts",children:[e.jsx(Ce,{icon:e.jsx(ft,{}),ariaLabel:n("common.action.save.field.aria",{field:t.character||""}),disabled:o||!f.trim(),ok:!0,onClick:L}),e.jsx(Ce,{icon:e.jsx(it,{}),ariaLabel:n("common.action.cancel.label"),disabled:o,onClick:()=>{b(t.character||""),v(t.actor||""),u(!1)}})]}),R]}):e.jsxs("li",{className:"cast-row",children:[B,e.jsxs("span",{className:"cast-names",children:[e.jsx("span",{className:"cast-character",children:e.jsx("button",{type:"button",className:"tp-link","aria-expanded":g,disabled:o,onClick:()=>w(I=>!I),children:t.character||n("cast.unnamed.label")})}),t.actor&&e.jsx("span",{className:"cast-actor",children:m?e.jsx("button",{type:"button",className:"tp-link",onClick:m,children:t.actor}):t.actor})]}),e.jsxs("span",{className:"cast-row-acts",children:[e.jsx(Ce,{icon:e.jsx(at,{}),ariaLabel:n("common.action.edit.field.aria",{field:t.character||""}),disabled:o,onClick:()=>u(!0)}),e.jsx(Ce,{icon:e.jsx(Fe,{}),ariaLabel:n("cast.remove.aria",{name:t.character||""}),disabled:o,danger:!0,onClick:()=>j(!0)})]}),N&&e.jsxs("span",{className:"cast-row-confirm",children:[e.jsx("span",{className:"microcopy",children:n("cast.remove.confirm.prose",{name:t.character||""})}),e.jsx(ge,{type:"button",disabled:o,onClick:h,children:n("common.action.remove.label")}),e.jsx(ge,{type:"button",onClick:()=>j(!1),children:n("common.action.cancel.label")})]}),R]})}function up({role:t,busy:a,onAdd:o,onCancel:s}){const[r,i]=c.useState(""),[l,h]=c.useState(""),d=()=>{if(!r.trim())return;const p={character:r.trim()};t!=="none"&&(p.actor=l.trim()),o(p)},m=p=>{p.key!=="Enter"||a||(p.preventDefault(),d())};return e.jsxs("div",{className:"cast-add",children:[e.jsxs("div",{className:"cast-row-fields",children:[e.jsx(xe,{label:n("common.field.character.label"),nameCase:!0,value:r,autoFocus:!0,onChange:p=>i(p.target.value),onKeyDown:m}),t!=="none"&&e.jsx(xe,{label:Ec(t),nameCase:!0,value:l,onChange:p=>h(p.target.value),onKeyDown:m})]}),e.jsxs("div",{className:"flex flex-wrap items-center gap-2",children:[e.jsx(ge,{type:"button",disabled:a||!r.trim(),onClick:d,children:n("common.action.add.label")}),e.jsx(ge,{type:"button",onClick:s,children:n("common.action.cancel.label")})]})]})}function mp({item:t,onFilled:a}){const[o,s]=c.useState(""),[r,i]=c.useState(""),[l,h]=c.useState(""),[d,m]=c.useState(""),[p,u]=c.useState(!1),[f,b]=c.useState(null);async function y(g){var S,N,j,x;s("tvdb"),h(""),i("");const w=await X("POST",`/movies/${t.id}/cast/tvdb`,g?{tvdb_id:g}:void 0);if(!w.ok){if(w.status===409&&!g){const M=await X("POST","/movies/lookup",{title:t.title||"",year:t.release_year||0,media_type:t.media_type||"movie"});if(s(""),!M.ok)return h(le(w,n("error.load.tvdb-cast")));b((((S=M.data)==null?void 0:S.candidates)||[]).filter(q=>q.source==="tvdb"));return}return s(""),h(le(w,n("error.load.tvdb-cast")))}s(""),b(null);const k=(((N=w.data)==null?void 0:N.cast)||[]).length;i(n("cast.fill.done.prose",{title:((j=w.data)==null?void 0:j.title)||"",n:k})),a==null||a(((x=w.data)==null?void 0:x.cast)||[])}async function v(){var k,S,N,j;s("imdb"),h(""),i("");const g=await X("POST",`/movies/${t.id}/cast/imdb`,{imdb:d.trim()});if(s(""),!g.ok)return h(le(g,n("error.load.imdb-cast")));const w=(((k=g.data)==null?void 0:k.cast)||[]).length;i(n("film.imdb.done.prose",{title:((N=(S=g.data)==null?void 0:S.title)==null?void 0:N.title)||d.trim(),n:w})),m(""),u(!1),a==null||a(((j=g.data)==null?void 0:j.cast)||[])}return e.jsxs("div",{className:"space-y-2",children:[e.jsxs("div",{className:"flex flex-wrap items-center gap-2",children:[t.media_type!=="game"&&e.jsxs(ge,{type:"button",onClick:()=>y(),disabled:!!o,children:[e.jsx(mo,{}),e.jsx("span",{children:n(o==="tvdb"?"film.imdb.busy.label":"cast.fill.tvdb.label")})]}),e.jsxs(ge,{type:"button",onClick:()=>u(g=>!g),disabled:!!o,children:[e.jsx(mo,{}),e.jsx("span",{children:n("film.imdb.open.label")})]}),e.jsx(Le,{title:n("cast.fill.info.title"),text:n("cast.fill.info.body")})]}),p&&e.jsxs("div",{className:"space-y-2",children:[e.jsx(xe,{label:n("film.imdb.link.label"),placeholder:n("film.imdb.link.placeholder"),value:d,autoFocus:!0,onChange:g=>m(g.target.value),onKeyDown:g=>{g.key!=="Enter"||o||!d.trim()||(g.preventDefault(),v())}}),e.jsx(ge,{type:"button",onClick:v,disabled:!!o||!d.trim(),children:n(o==="imdb"?"film.imdb.busy.label":"film.imdb.go.label")})]}),f&&e.jsxs("div",{className:"space-y-2",children:[e.jsx("p",{className:"microcopy",children:f.length?n("cast.fill.match.prose"):n("cast.fill.match.none")}),f.map(g=>e.jsx(ge,{type:"button",disabled:!!o,onClick:()=>y(Number(g.source_id)),children:[g.title,g.release_year||""].filter(Boolean).join(" · ")},g.source_id))]}),e.jsx(ve,{children:l}),r&&e.jsx("p",{className:"microcopy",children:r})]})}function pp(t,a,o,s){const r=c.useRef("");c.useEffect(()=>{const i=`${t}:${a}`;if(!a||r.current===i||!(o||[]).some(m=>(m==null?void 0:m.character_image_url)&&!(m!=null&&m.character_image_path)))return;let h=!0;const d="movies";return(async()=>{var f,b;const m=await X("GET",`/${d}/${a}/cast`);if(!h||!m.ok)return;const p=(((f=m.data)==null?void 0:f.cast)||[]).filter(y=>y.character_image_url&&!y.character_image_path).slice(0,Cc);let u=0;for(const y of p){if(!h)return;const v=await X("POST",`/cast/${y.id}/image`);v.ok&&((b=v.data)!=null&&b.character_image_path)&&(u+=1)}h&&(r.current=i,u&&(s==null||s()))})(),()=>{h=!1}},[t,a,o])}const fp=[{key:"title",get label(){return n("common.field.title.label")},nameCase:!0},{key:"author",get label(){return n("common.field.author.label")},nameCase:!0,get hint(){return n("book.field.author.info")}},{key:"translator",get label(){return n("common.field.translator.label")},nameCase:!0,get hint(){return n("book.field.translator.info")}},{key:"editor",get label(){return n("common.field.editor.label")},nameCase:!0,get hint(){return n("book.field.editor.info")}},{key:"published_year",get label(){return n("common.field.year.label")},kind:"year",circaKey:"published_circa"},{key:"series",get label(){return n("common.field.series.label")},nameCase:!0,get hint(){return n("book.field.series.info")}},{key:"series_index",get label(){return n("common.field.series-no.label")},kind:"number"},{key:"isbn",get label(){return n("common.field.isbn.label")},get hint(){return n("book.field.isbn.info")}},{key:"asin",get label(){return n("common.field.asin.label")},get hint(){return n("book.field.asin.info")}},{key:"genres",get label(){return n("common.field.genres.label")},kind:"tokens"},{key:"description",get label(){return n("common.field.description.label")},kind:"long"}],gp={show:{director:"common.field.creator.label"},game:{director:"common.field.studio.label",series:"common.field.series.label",series_index:"common.field.series-no.label"}};function Vo(t,a){const o=[t,""];return Object.defineProperty(o,1,{get:()=>n(a),enumerable:!0,configurable:!0}),o}const fi=[Vo("movie","vocab.kind.movie.label"),Vo("show","vocab.kind.show.label"),Vo("game","vocab.kind.game.label")];function Ac(t,a){var s;const o=(s=gp[a])==null?void 0:s[t.key];return o?n(o):t.label}function bp(t,a){return t.filter(o=>!o.media||o.media.includes(a))}const yp=[{key:"title",get label(){return n("common.field.title.label")},nameCase:!0},{key:"media_type",get label(){return n("common.field.media-type.label")},kind:"mediaType",get hint(){return n("film.field.media-type.info")}},{key:"director",get label(){return n("common.field.director.label")},nameCase:!0},{key:"publisher",get label(){return n("common.field.publisher.label")},nameCase:!0,media:["game"],get hint(){return n("film.field.publisher.info")}},{key:"release_year",get label(){return n("common.field.year.label")},kind:"year",circaKey:"release_circa"},{key:"series",get label(){return n("common.field.collection.label")},nameCase:!0,get hint(){return n("film.field.series.info")}},{key:"series_index",get label(){return n("common.field.collection-no.label")},kind:"number"},{key:"tmdb_id",get label(){return n("film.field.tmdb-id.label")},sourceKey:"vocab.source.tmdb.label",kind:"id",media:["movie","show"],get hint(){return n("film.field.tmdb-id.info")},href:t=>`https://www.themoviedb.org/${(t.media_type||"movie")==="show"?"tv":"movie"}/${t.tmdb_id}`},{key:"tvdb_id",get label(){return n("film.field.tvdb-id.label")},sourceKey:"vocab.source.tvdb.label",kind:"id",media:["movie","show"],get hint(){return n("film.field.tvdb-id.info")},href:t=>`https://thetvdb.com/dereferrer/${(t.media_type||"movie")==="show"?"series":"movie"}/${t.tvdb_id}`},{key:"imdb_id",get label(){return n("film.field.imdb-id.label")},sourceKey:"vocab.source.imdb.label",media:["movie","show"],get hint(){return n("film.field.imdb-id.info")},href:t=>`https://www.imdb.com/title/${t.imdb_id}/`},{key:"igdb_id",get label(){return n("film.field.igdb-id.label")},sourceKey:"vocab.source.igdb.label",kind:"id",media:["game"],get hint(){return n("film.field.igdb-id.info")}},{key:"genres",get label(){return n("common.field.genres.label")},kind:"tokens"},{key:"description",get label(){return n("common.field.description.label")},kind:"long"}];function wp(t,a){return t==="book"?{title:a.title,author:a.author||"",translator:a.translator||"",editor:a.editor||"",isbn:a.isbn||"",asin:a.asin||"",description:a.description||"",published_year:a.published_year||0,published_circa:!!a.published_circa,genres:a.genres||[],series:a.series||"",series_index:a.series_index||0,favorite:!!a.favorite}:{title:a.title,director:a.director||"",publisher:a.publisher||"",release_year:a.release_year||0,release_circa:!!a.release_circa,description:a.description||"",genres:a.genres||[],media_type:a.media_type||"movie",series:a.series||"",series_index:a.series_index||0,favorite:!!a.favorite,tmdb_id:a.tmdb_id||0,tvdb_id:a.tvdb_id||0,igdb_id:a.igdb_id||0,imdb_id:a.imdb_id||""}}function gi(t,a){if(t.kind==="tokens")return Array.isArray(a)?a:[];if(t.kind==="year"){const{year:o,circa:s}=hn(a);return t.circaKey?{[t.key]:o,[t.circaKey]:s}:o}return t.kind==="number"?Number(String(a).trim())||0:t.kind==="id"?ot(a):String(a??"").trim()}function vp(t,a){const o=a==null?void 0:a[t.key];return t.kind==="tokens"?o||[]:t.kind==="year"?Rt(o,t.circaKey?a==null?void 0:a[t.circaKey]:!1):t.kind==="number"||t.kind==="id"?o?String(o):"":o==null?"":String(o)}function fs(t,a){return Array.isArray(t)?t.length===0:a==="year"||a==="number"||a==="id"?!Number(t):String(t??"").trim()===""}function qc({open:t,onClose:a,kind:o,item:s,onChanged:r,onDelete:i}){const l=o==="book"?"books":"movies",h=o==="book"?"book":(s==null?void 0:s.media_type)||"movie",d=bp(o==="book"?fp:yp,h),[m,p]=c.useState("fields"),[u,f]=c.useState(null),[b,y]=c.useState(""),[v,g]=c.useState(""),[w,k]=c.useState([]);if(c.useEffect(()=>{t&&X("GET","/genres").then(T=>{T.ok&&k(T.data.genres||[])})},[t]),c.useEffect(()=>{t&&(p("fields"),f(null),g(""))},[t]),!s)return null;async function S(T,B){y(B||"save"),g("");const L=await X("PUT",`/${l}/${s.id}`,{...wp(o,s),...T});return y(""),L.ok?(r==null||r(L.data),!0):(g(le(L,n("error.save.generic"))),!1)}async function N(T,B){const L={};for(const V of T){const P=d.find(H=>H.key===V.key);if(!P)continue;const C=gi(P,V.get());Object.assign(L,C&&typeof C=="object"&&!Array.isArray(C)?C:{[P.key]:C})}if("title"in L&&!String(L.title).trim()){g(n("error.validate.title-required"));return}if(!Object.keys(L).length)return!0;if(await S(L)){B();const V=T.length;return Se(n("common.work.fields-saved.toast",{count:V,n:V})),!0}return!1}async function j(T,B){const L=gi(T,B);if(T.key==="title"&&!String(L).trim())return g(n("error.validate.title-required")),!1;const V=L&&typeof L=="object"&&!Array.isArray(L)?L:{[T.key]:L},P=await S(V);return P&&Se(n("common.work.field-saved.toast",{field:T.label.toLowerCase()})),P}function x(T){const B={title:T.title||"",author:T.author||"",isbn:T.isbn13||"",published_year:T.published_year||0,series:T.series||"",series_index:T.series_index||0,genres:T.genres||[],description:T.description||""};return q(B,T.cover_url||"")}function M(T){const B={title:T.title||"",release_year:T.release_year||0,description:T.overview||"",media_type:T.media_type||s.media_type||"movie"},L={tvdb:"tvdb_id",tmdb:"tmdb_id",igdb:"igdb_id"}[T.source||"tmdb"],V=Number(T.source==="tmdb"&&T.tmdb_id||T.source_id);return L&&Number.isInteger(V)&&V>0&&(B[L]=V),q(B,T.poster_url||"")}function q(T,B){const L=[];for(const P of d){if(!(P.key in T))continue;const C=T[P.key];if(fs(C,P.kind))continue;const H=s[P.key];(Array.isArray(C)?JSON.stringify([...C].sort())===JSON.stringify([...H||[]].sort()):String(C??"")===String(H??""))||L.push({key:P.key,label:Ac(P,h),spec:P,current:H,next:C,take:fs(H,P.kind)})}const V=s.cover_path||s.poster_path;return B&&L.push({key:"__cover",label:n(o==="book"?"common.field.cover.label":"common.field.poster.label"),art:!0,current:V?$e(V):"",next:B,take:!V}),L}async function E(T){const B=T.filter(V=>V.take);if(!B.length){p("fields");return}const L={};for(const V of B)V.key==="__cover"?L[o==="book"?"cover_url":"poster_url"]=o==="book"?V.next:rc(V.next):L[V.key]=V.next;await S(L,"merge")&&(Se(n("common.work.merge.toast",{count:B.length,n:B.length})),f(null),p("fields"))}async function O(T){y("resync"),g("");const B=await X("PUT",`/movies/${s.id}`,{source:T.source||"tmdb",source_id:T.source==="tvdb"?T.source_id:String(T.tmdb_id||T.source_id),media_type:T.media_type||s.media_type||"movie"});if(y(""),!B.ok)return g(le(B,n("error.sync.source")));r==null||r(B.data),Se(n("common.work.resync.toast")),f(null),p("fields")}const _=n(m==="merge"?"common.work.merge.title":m==="lookup"?"common.work.lookup.title":"common.work.details.title");return e.jsxs(Ge,{open:t,onClose:a,title:_,maxWidth:620,saveTip:n("common.work.details.done.tip"),children:[e.jsx(ve,{children:v}),m==="fields"&&e.jsx(kp,{kind:o,item:s,specs:d,mediaType:h,busy:b,genreSuggestions:w,onSaveField:j,onSaveAll:N,onClose:a,onCover:T=>S(T,"cover"),onChanged:r,onFetch:()=>p("lookup"),onDelete:i}),m==="lookup"&&e.jsxs("div",{className:"space-y-3",children:[e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx(Ce,{icon:e.jsx(Zt,{}),ariaLabel:n("common.work.lookup.back.aria"),onClick:()=>p("fields")}),e.jsx($,{children:n("common.work.lookup.pick.label")}),e.jsx(Le,{title:n("common.work.lookup.info.title"),text:n("common.work.lookup.info.body")})]}),o==="book"?e.jsx(lc,{auto:!0,isbn:s.isbn,title:s.title,author:s.author,asin:s.asin,onPick:T=>{f({rows:x(T),candidate:T}),p("merge")}}):e.jsx(cc,{auto:!0,title:s.title,year:s.release_year,mediaType:s.media_type||"movie",tmdbId:s.tmdb_id,tvdbId:s.tvdb_id,onPick:T=>{f({rows:M(T),candidate:T}),p("merge")}}),o!=="book"&&e.jsxs("div",{className:"space-y-2 border-t pt-3",style:{borderColor:"var(--line)"},children:[e.jsx($,{children:n("cast.fill.heading.label")}),e.jsx(mp,{item:s,onFilled:T=>r==null?void 0:r({...s,cast:T||[]})})]})]}),m==="merge"&&u&&e.jsx(xp,{kind:o,rows:u.rows,candidate:u.candidate,busy:b,onBack:()=>p("lookup"),onApply:E,onResync:o==="movie"?()=>O(u.candidate):null})]})}function kp({kind:t,item:a,specs:o,mediaType:s,busy:r,genreSuggestions:i,onSaveField:l,onSaveAll:h,onCover:d,onChanged:m,onFetch:p,onDelete:u,onClose:f}){const b=t==="book"?a.cover_path:a.poster_path,y=gu(),v=qo("");async function g(k){if(k.target!==k.currentTarget)return;k.preventDefault();const S=y.collect();for(const N of S)if(N.save&&await N.save()===!1)return;y.count&&!await h(S,y.closeAll)||f==null||f()}const w=k=>{k.key!=="Enter"||!(k.target instanceof HTMLInputElement)||k.target.form===k.currentTarget&&k.preventDefault()};return e.jsx("form",{id:v==null?void 0:v.formId,onSubmit:g,onKeyDown:w,className:"space-y-3",children:e.jsxs(Fs.Provider,{value:y.host,children:[e.jsx(tr,{kind:t==="book"?"books":"movies",id:a.id,currentPath:b||"",asin:a.asin,coverUrl:"",clearCover:!1,onSetUrl:k=>d(t==="book"?{cover_url:k}:{poster_url:k}),onClear:k=>{k!==!0&&d({clear_cover:!0})},onUploaded:k=>m==null?void 0:m(k),search:t==="book"?{isbn:a.isbn,title:a.title,author:a.author,asin:a.asin}:{title:a.title,year:a.release_year,mediaType:a.media_type||"movie",tmdbId:a.tmdb_id,tvdbId:a.tvdb_id,igdbId:a.igdb_id}}),e.jsx(dp,{kind:t,item:a,onCastChanged:k=>m==null?void 0:m({...a,cast:k||[]})}),e.jsxs("div",{className:"flex flex-wrap items-center gap-2",children:[e.jsxs(ge,{type:"button",onClick:p,disabled:!!r,children:[e.jsx(Hn,{}),e.jsx("span",{children:n("common.work.fetch.label")})]}),e.jsx(Le,{title:n("common.work.lookup.info.title"),text:n(t==="book"?"book.fetch.info.body":"film.fetch.info.body")}),e.jsx("span",{className:"flex-1"}),u&&e.jsx(Ce,{icon:e.jsx(Fe,{}),ariaLabel:n("common.work.delete.aria",{noun:n(t==="book"?"unit.book.one":"unit.title.one")}),onClick:u,danger:!0})]}),e.jsx("div",{children:o.map(k=>{var j;const S=Ac(k,s),N=vp(k,a);return k.kind==="id"?e.jsx(Fa,{fieldKey:k.key,label:S,value:N,hint:k.hint,busy:!!r,inputMode:"numeric",maxLength:12,placeholder:n("common.work.id.placeholder"),onSave:x=>l(k,x),display:k.href&&N?e.jsx(ye,{label:n("common.work.id.open.tip",{source:n(k.sourceKey)}),children:e.jsx("a",{href:k.href(a),target:"_blank",rel:"noopener noreferrer",className:"tp-link",children:n("common.work.id.display.label",{n:N})})}):void 0},k.key):k.kind==="tokens"?e.jsx(Fa,{fieldKey:k.key,label:S,value:N,display:N.join(" · "),hint:k.hint,busy:!!r,onSave:x=>l(k,x),input:({value:x,onChange:M})=>e.jsx(pt,{value:x,onChange:M,suggestions:i,placeholder:n("common.field.genres.placeholder"),ariaLabel:S,transform:Mo})},k.key):k.kind==="mediaType"?e.jsx(Fa,{fieldKey:k.key,label:S,value:N,display:((j=fi.find(([x])=>x===N))==null?void 0:j[1])||n("vocab.kind.movie.label"),hint:k.hint,busy:!!r,onSave:x=>l(k,x),input:({value:x,onChange:M})=>e.jsx("div",{className:"flex gap-2",children:fi.map(([q,E])=>e.jsx("button",{type:"button",className:"tp-filter-chip"+(x===q?" active":""),"aria-pressed":x===q,onClick:()=>M(q),children:E},q))})},k.key):e.jsx(Fa,{fieldKey:k.key,label:S,value:N,hint:k.hint,busy:!!r,nameCase:!!k.nameCase,multiline:k.kind==="long",inputMode:k.kind==="number"?"decimal":void 0,maxLength:k.kind==="year"?12:void 0,onSave:x=>l(k,x),display:k.href&&N?e.jsx(ye,{label:`Open on ${S.replace(/ id$/,"")}`,children:e.jsxs("a",{href:k.href(a),target:"_blank",rel:"noopener noreferrer",className:"tp-link",children:[String(N)," ↗"]})}):void 0},k.key)})})]})})}function xp({kind:t,rows:a,candidate:o,busy:s,onBack:r,onApply:i,onResync:l}){const[h,d]=c.useState(a);c.useEffect(()=>d(a),[a]);const m=c.useMemo(()=>h.filter(b=>b.take).length,[h]),p=b=>d(y=>y.map(v=>({...v,take:b}))),u=b=>d(y=>y.map(v=>v.key===b?{...v,take:!v.take}:v)),f=t==="book"?((o==null?void 0:o.source)||"").toUpperCase():`${((o==null?void 0:o.source)||"tmdb").toUpperCase()} #${(o==null?void 0:o.source)==="tvdb"?o==null?void 0:o.source_id:(o==null?void 0:o.tmdb_id)||(o==null?void 0:o.source_id)}`;return e.jsxs("div",{className:"space-y-3",children:[e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx(Ce,{icon:e.jsx(Zt,{}),ariaLabel:n("common.work.merge.back.aria"),onClick:r}),e.jsx($,{children:f}),e.jsx(Le,{title:n("common.work.merge.info.title"),text:n("common.work.merge.info.body")}),e.jsx("span",{className:"flex-1"}),e.jsx(Ce,{icon:e.jsx(ft,{}),ariaLabel:n("common.work.merge.all.aria"),onClick:()=>p(!0),tooltip:n("common.work.merge.all.tip")}),e.jsx(Ce,{icon:e.jsx(it,{}),ariaLabel:n("common.work.merge.none.aria"),onClick:()=>p(!1),tooltip:n("common.work.merge.none.tip")})]}),h.length===0&&e.jsx("p",{className:"microcopy",children:n("common.work.merge.empty")}),e.jsx("div",{className:"merge-list",children:h.map(b=>{var y;return e.jsx(ye,{label:n("common.work.merge.row.tip"),children:e.jsxs("button",{type:"button",className:"merge-row"+(b.take?" is-taken":""),"aria-pressed":b.take,onClick:()=>u(b.key),children:[e.jsx("span",{className:"merge-check","aria-hidden":"true",children:b.take?e.jsx(ft,{}):null}),e.jsxs("span",{className:"min-w-0 flex-1",children:[e.jsx("span",{className:"merge-label",children:b.label}),b.art?e.jsxs("span",{className:"merge-art",children:[e.jsxs("span",{className:"merge-art-side",children:[e.jsx($,{children:n("common.work.merge.yours.label")}),b.current?e.jsx(Ln,{url:b.current,label:"",className:"w-16"}):e.jsx(Dt,{kind:n("common.badge.none"),className:"w-16"})]}),e.jsxs("span",{className:"merge-art-side",children:[e.jsx($,{style:{color:"var(--accent-ui)"},children:n("common.work.merge.theirs.label")}),e.jsx(Ln,{url:b.next,label:"",className:"w-16"})]})]}):e.jsxs(e.Fragment,{children:[e.jsx("span",{className:"merge-old",children:fs(b.current,(y=b.spec)==null?void 0:y.kind)?n("common.work.merge.blank.label"):bi(b.current)}),e.jsx("span",{className:"merge-new",children:bi(b.next)})]})]})]})},b.key)})}),e.jsxs("div",{className:"flex flex-wrap items-center gap-2 pt-1",children:[e.jsx(Jt,{type:"button",disabled:!!s||m===0,onClick:()=>i(h),children:s==="merge"?n("common.action.apply.busy"):n("common.work.merge.take",{count:m,n:m})}),l&&e.jsxs(e.Fragment,{children:[e.jsx(ge,{type:"button",disabled:!!s,onClick:l,children:n(s==="resync"?"common.work.resync.busy":"common.work.resync.label")}),e.jsx(Le,{title:n("common.work.resync.info.title"),text:n("common.work.resync.info.body")})]})]})]})}function bi(t){return Array.isArray(t)?t.join(" · "):t==null?"":String(t)}const Bo=t=>$e(t),Mc="image/png,image/svg+xml,image/webp,image/gif,image/jpeg";function Oa(){const[t,a]=c.useState([]),o=c.useCallback(async()=>{const s=await X("GET","/stickers");s.ok&&a(s.data.stickers)},[]);return c.useEffect(()=>{o()},[o]),{stickers:t,reload:o}}function Oc({sticker:t}){return t?e.jsx("img",{className:"sticker-img",src:Bo(t.path),alt:t.name||n("common.sticker.image.alt"),draggable:"false","aria-hidden":"true"}):null}function Fo({value:t,onChange:a,stickers:o,reload:s}){const[r,i]=c.useState(!1),[l,h]=c.useState(""),d=c.useRef(null);async function m(p){const u=p.target.files&&p.target.files[0];if(p.target.value="",!u)return;i(!0),h("");const f=await xa("/stickers",u);if(i(!1),!f.ok)return h(le(f,n("error.upload.sticker")));await s(),a(f.data.id)}return e.jsxs("div",{className:"space-y-2",children:[e.jsxs("div",{className:"sticker-strip",children:[e.jsx("button",{type:"button",className:`sticker-opt sticker-none${t==null?" is-sel":""}`,onClick:()=>a(null),title:n("common.sticker.none.tip"),"aria-pressed":t==null,children:n("common.sticker.none.label")}),o.map(p=>e.jsx(ye,{label:p.name?n("common.sticker.use.tip",{name:p.name}):n("common.sticker.use-any.tip"),side:"top",className:"shrink-0",children:e.jsx("button",{type:"button",className:`sticker-opt${t===p.id?" is-sel":""}`,onClick:()=>a(p.id),"aria-pressed":t===p.id,children:e.jsx("img",{src:Bo(p.path),alt:p.name||n("common.sticker.image.alt")})})},p.id)),e.jsx(ye,{label:n(r?"common.action.upload.busy":"common.sticker.upload.tip"),side:"top",className:"shrink-0",children:e.jsx("button",{type:"button",className:"sticker-opt sticker-add",onClick:()=>d.current&&d.current.click(),disabled:r,children:r?"…":"＋"})}),e.jsx("input",{ref:d,type:"file",accept:Mc,hidden:!0,onChange:m})]}),e.jsx(ve,{children:l})]})}function _w({onUploaded:t}){const[a,o]=c.useState(""),[s,r]=c.useState(!1),i=c.useRef(null);async function l(h){const d=h.target.files&&h.target.files[0];if(h.target.value="",!d)return;r(!0),o("");const m=await xa("/stickers",d);if(r(!1),!m.ok)return o(le(m,n("error.upload.sticker")));t()}return e.jsxs("section",{className:"p-5",style:{border:"1.6px dashed var(--ink-border)",borderRadius:14},children:[e.jsx("p",{className:"mb-1 font-semibold",style:{color:"var(--accent-ui)"},children:n("tags.sticker.new.title")}),e.jsx("p",{className:"mb-3 text-xs",style:{color:"var(--soft)"},children:n("tags.sticker.new.body")}),e.jsx(ge,{type:"button",onClick:()=>i.current&&i.current.click(),disabled:s,children:n(s?"tags.sticker.new.upload.busy":"tags.sticker.new.upload.label")}),e.jsx("input",{ref:i,type:"file",accept:Mc,hidden:!0,onChange:l}),e.jsx(ve,{children:a})]})}function Rw({stickers:t,onChanged:a}){const[o,s]=c.useState(!1),r=t.slice(0,5);return e.jsxs("section",{className:"space-y-4",children:[e.jsx("h2",{className:"text-lg font-semibold",style:{color:"var(--ink)"},children:n("tags.sticker.section.title")}),t.length===0?e.jsx(Vt,{children:n("tags.sticker.board.empty")}):e.jsxs(e.Fragment,{children:[e.jsx("div",{className:"grid gap-3 sm:grid-cols-3 lg:grid-cols-5",children:r.map((i,l)=>e.jsx(jp,{sticker:i,index:l,onChanged:a},i.id))}),t.length>5&&e.jsx(ge,{type:"button",onClick:()=>s(i=>!i),children:o?n("tags.table.hide.label"):n("tags.sticker.table.more.label",{n:t.length-5,count:t.length-5})}),o&&e.jsx(Sp,{stickers:t,onChanged:a})]})]})}async function Lc(t,a,o,s){const r=a.trim();if(r===(t.name||""))return;const i=await X("PUT",`/stickers/${t.id}`,{name:r});i.ok?o():s(le(i,n("error.rename.generic")))}async function _c(t,a,o){const s=t.annotations+t.dialogues,r=s>0?n("tags.sticker.delete.confirm.body-used",{count:s,n:s,noun:n("unit.quote",{count:s})}):n("tags.sticker.delete.confirm.body");if(!confirm(r))return;const i=await X("DELETE",`/stickers/${t.id}`);i.ok?a():o(le(i,n("error.delete.sticker")))}function jp({sticker:t,index:a,onChanged:o}){const[s,r]=c.useState(t.name||""),[i,l]=c.useState("");return e.jsxs(Xe,{variant:a%4,className:"flex flex-col gap-2 p-3",children:[e.jsx("div",{className:"sticker-swatch",style:{height:72},children:e.jsx("img",{src:Bo(t.path),alt:t.name||n("common.sticker.image.alt")})}),e.jsx("input",{className:"tp-input",placeholder:n("common.field.name.placeholder"),maxLength:64,value:s,onChange:h=>r(h.target.value),onBlur:()=>Lc(t,s,o,l),onKeyDown:h=>{h.key==="Enter"&&(h.preventDefault(),h.currentTarget.blur())}}),e.jsx(ve,{children:i}),e.jsx("button",{className:"tp-link tp-link-danger mt-auto self-start",onClick:()=>_c(t,o,l),children:n("common.link.delete.label")})]})}function Sp({stickers:t,onChanged:a}){const{sort:o,toggle:s,apply:r}=Lu("name","asc"),[i,l]=c.useState(""),h=r(t,{name:d=>(d.name||"").toLowerCase(),uses:d=>d.annotations+d.dialogues});return e.jsxs(e.Fragment,{children:[e.jsx(ve,{children:i}),e.jsx("div",{className:"ann-table-wrap",style:{maxHeight:420,overflowY:"auto"},children:e.jsxs("table",{className:"ann-table",children:[e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsx("th",{style:{width:52}}),e.jsx(ai,{col:"name",label:n("common.field.name.label"),sort:o,onSort:s}),e.jsx(ai,{col:"uses",label:n("tags.table.uses.label"),sort:o,onSort:s}),e.jsx("th",{})]})}),e.jsx("tbody",{children:h.map(d=>e.jsx(Np,{sticker:d,onChanged:a,setError:l},d.id))})]})})]})}function Np({sticker:t,onChanged:a,setError:o}){const[s,r]=c.useState(t.name||"");return e.jsxs("tr",{children:[e.jsx("td",{children:e.jsx("span",{className:"sticker-swatch",style:{height:34,width:34,padding:3,display:"inline-flex"},children:e.jsx("img",{src:Bo(t.path),alt:t.name||n("common.sticker.image.alt")})})}),e.jsx("td",{children:e.jsx("input",{className:"tp-input",placeholder:n("common.field.name.placeholder"),maxLength:64,value:s,onChange:i=>r(i.target.value),onBlur:()=>Lc(t,s,a,o),onKeyDown:i=>{i.key==="Enter"&&(i.preventDefault(),i.currentTarget.blur())}})}),e.jsx("td",{className:"col-mono",children:t.annotations+t.dialogues}),e.jsx("td",{className:"col-actions",children:e.jsx(Js,{noun:n("unit.sticker.one"),onDelete:()=>_c(t,a,o)})})]})}const La=[{key:"display",prop:"--font-display",label:"vocab.font-role.display.label",what:"vocab.font-role.display.what",sample:"vocab.font-role.display.sample",italic:!0},{key:"ui",prop:"--font-ui",label:"vocab.font-role.ui.label",what:"vocab.font-role.ui.what",sample:"vocab.font-role.ui.sample"},{key:"mono",prop:"--font-mono",label:"vocab.font-role.mono.label",what:"vocab.font-role.mono.what",sample:"vocab.font-role.mono.sample"},{key:"hand",prop:"--font-hand",label:"vocab.font-role.hand.label",what:"vocab.font-role.hand.what",sample:"vocab.font-role.hand.sample"},{key:"bengali",prop:"--font-bengali",label:"vocab.font-role.bengali.label",what:"vocab.font-role.bengali.what",sample:"vocab.font-role.bengali.sample",script:"bengali"},{key:"devanagari",prop:"--font-devanagari",label:"vocab.font-role.devanagari.label",what:"vocab.font-role.devanagari.what",sample:"vocab.font-role.devanagari.sample",script:"devanagari"}],Tp={display:[{id:"newsreader",name:"vocab.face.newsreader.name",family:"Newsreader",note:"vocab.face.newsreader.note"},{id:"source-serif-4",name:"vocab.face.source-serif-4.name",family:"Source Serif 4",note:"vocab.face.source-serif-4.note"},{id:"literata",name:"vocab.face.literata.name",family:"Literata",note:"vocab.face.literata.note"}],ui:[{id:"hanken-grotesk",name:"vocab.face.hanken-grotesk.name",family:"Hanken Grotesk",note:"vocab.face.hanken-grotesk.note"},{id:"inter",name:"vocab.face.inter.name",family:"Inter",note:"vocab.face.inter.note"},{id:"public-sans",name:"vocab.face.public-sans.name",family:"Public Sans",note:"vocab.face.public-sans.note"}],mono:[{id:"ibm-plex-mono",name:"vocab.face.ibm-plex-mono.name",family:"IBM Plex Mono",note:"vocab.face.ibm-plex-mono.note"},{id:"jetbrains-mono",name:"vocab.face.jetbrains-mono.name",family:"JetBrains Mono",note:"vocab.face.jetbrains-mono.note"},{id:"source-code-pro",name:"vocab.face.source-code-pro.name",family:"Source Code Pro",note:"vocab.face.source-code-pro.note"}],hand:[{id:"caveat",name:"vocab.face.caveat.name",family:"Caveat",note:"vocab.face.caveat.note"},{id:"kalam",name:"vocab.face.kalam.name",family:"Kalam",note:"vocab.face.kalam.note"},{id:"gloria-hallelujah",name:"vocab.face.gloria-hallelujah.name",family:"Gloria Hallelujah",note:"vocab.face.gloria-hallelujah.note"}],bengali:[{id:"noto-serif-bengali",name:"vocab.face.noto-serif-bengali.name",family:"Noto Serif Bengali",note:"vocab.face.noto-serif-bengali.note"},{id:"hind-siliguri",name:"vocab.face.hind-siliguri.name",family:"Hind Siliguri",note:"vocab.face.hind-siliguri.note"},{id:"tiro-bangla",name:"vocab.face.tiro-bangla.name",family:"Tiro Bangla",note:"vocab.face.tiro-bangla.note"}],devanagari:[{id:"noto-serif-devanagari",name:"vocab.face.noto-serif-devanagari.name",family:"Noto Serif Devanagari",note:"vocab.face.noto-serif-devanagari.note"},{id:"hind",name:"vocab.face.hind.name",family:"Hind",note:"vocab.face.hind.note"},{id:"tiro-devanagari-hindi",name:"vocab.face.tiro-devanagari-hindi.name",family:"Tiro Devanagari Hindi",note:"vocab.face.tiro-devanagari-hindi.note"}]},lr=[{id:"bold",label:"vocab.font-style.bold.label",css:{fontWeight:"700"}},{id:"italic",label:"vocab.font-style.italic.label",css:{fontStyle:"italic"}},{id:"smallcaps",label:"vocab.font-style.smallcaps.label",css:{fontVariantCaps:"small-caps"},needsCase:!0},{id:"allcaps",label:"vocab.font-style.allcaps.label",css:{textTransform:"uppercase"},needsCase:!0},{id:"figures",label:"vocab.font-style.figures.label",css:{fontVariantNumeric:"tabular-nums"}}];function Dw(t){const a=La.find(o=>o.key===t);return lr.filter(o=>!(o.needsCase&&(a!=null&&a.script)))}const Rc=t=>Tp[t]||[];function Ep(t,a){const o=Rc(t);return o.find(s=>s.id===a)||qp(a)||o[0]}let yo=[];const Cp=t=>`TippaniUpload${t}`,Iw=()=>yo.slice();async function Ap(t){yo=(t||[]).map(a=>({...a,family:Cp(a.id)})),!(typeof document>"u"||!document.fonts||typeof FontFace>"u")&&await Promise.all(yo.map(async a=>{try{const o=new FontFace(a.family,`url(/api/fonts/${a.id}/file)`);await o.load(),document.fonts.add(o)}catch{}}))}function qp(t){const a=/^upload:(\d+)$/.exec(String(t||""));if(!a)return null;const o=yo.find(s=>String(s.id)===a[1]);return o?{id:t,name:o.name,family:o.family,note:"vocab.face.upload.note"}:null}const yi={bengali:"অআইঈউকখগঘঙ",devanagari:"अआइईउकखगघङ",latin:"Hamburgefonstiv"};function Mp(t){return yi[t]||yi.latin}function Op(t,a){var h,d;if(typeof document>"u")return null;const o=(d=(h=document.createElement("canvas")).getContext)==null?void 0:d.call(h,"2d");if(!o||typeof o.measureText!="function")return null;const s=Mp(a),r=m=>(o.font=`40px ${m}`,o.measureText(s).width),i=r("monospace"),l=r(`"${t}", monospace`);return!i||!l?null:Math.abs(l-i)>.5}function Pw(t,a){const o=La.find(s=>s.key===a);return Op(t,(o==null?void 0:o.script)||"latin")}let gs={},Xa={};const Lp=La.map(t=>t.key),Dc=t=>"font"+t[0].toUpperCase()+t.slice(1),_p=t=>Dc(t)+"Style";function Cn(t){return Ep(t,gs[t])}function Rp(t){return Xa[t]||[]}function Dp(t){const a=i=>`'${i.family}'`,o=a(Cn(t)),s=a(Cn("bengali")),r=a(Cn("devanagari"));switch(t){case"display":return`${o}, ${s}, ${r}, Georgia, 'Times New Roman', serif`;case"ui":return`${o}, ${s}, ${r}, system-ui, sans-serif`;case"mono":return`${o}, ${s}, ${r}, ui-monospace, 'Cascadia Mono', monospace`;case"hand":return`${o}, ${s}, ${r}, 'Segoe Script', cursive`;default:return`${o}, serif`}}function wi(t){gs={},Xa={};for(const o of Lp)gs[o]=String((t==null?void 0:t[Dc(o)])||"").trim(),Xa[o]=Ip(t==null?void 0:t[_p(o)]);const a=document.documentElement;for(const o of La){a.style.setProperty(o.prop,Dp(o.key));const s=new Set(Xa[o.key]),r=i=>s.has(i);a.style.setProperty(`${o.prop}-weight`,r("bold")?"700":"inherit"),a.style.setProperty(`${o.prop}-style`,r("italic")?"italic":"inherit"),a.style.setProperty(`${o.prop}-caps`,r("smallcaps")?"small-caps":"inherit"),a.style.setProperty(`${o.prop}-case`,r("allcaps")?"uppercase":"inherit"),a.style.setProperty(`${o.prop}-figures`,r("figures")?"tabular-nums":"inherit")}}function Ip(t){const a=new Set(lr.map(o=>o.id));return String(t||"").split(",").map(o=>o.trim().toLowerCase()).filter(o=>a.has(o))}function Bw(t){const a=new Set(t||[]);return lr.filter(o=>a.has(o.id)).map(o=>o.id).join(",")}function Fw(){return La.map(t=>({...t,faces:Rc(t.key),chosen:Cn(t.key),styles:Rp(t.key)}))}const Ha=2,za=640;let De=Ic();function Ic(){const t=d=>Cn(d).family,a=t("display"),o=t("mono"),s=t("hand"),r=t("bengali"),i=t("devanagari"),l=`"${a}", "${r}", "${i}", Georgia, serif`,h=`"${o}", ui-monospace, monospace`;return{quote:`italic 400 27px ${l}`,translation:`400 21px ${l}`,attrBold:`600 15px ${l}`,attrItalic:`italic 400 15px ${l}`,attrPlain:`400 15px ${l}`,meta:`500 11.5px ${h}`,note:`400 22px "${s}", "${r}", "${i}", cursive`,tag:`600 11px ${h}`,foot:`600 14px ${l}`,credit:`500 11px ${h}`,bengali:`400 12px "${r}", serif`}}const Pp=/[\u0980-\u09FF]/,Bp=/[\u0900-\u097F]/;function Fp(t){if(typeof document>"u"||!document.fonts||!document.fonts.load)return Promise.resolve();De=Ic();const a=i=>Cn(i).family,o=[`italic 27px "${a("display")}"`,`600 15px "${a("display")}"`,`italic 15px "${a("display")}"`,`600 14px "${a("display")}"`,`500 12px "${a("mono")}"`,`600 11px "${a("mono")}"`,`500 11px "${a("mono")}"`],s=t===void 0;(s||t.hand)&&o.push(`22px "${a("hand")}"`);const r=s?"":String(t.text||"");return(s||Pp.test(r))&&o.push(`12px "${a("bengali")}"`),(s||Bp.test(r))&&o.push(`12px "${a("devanagari")}"`),Promise.all(o.map(i=>(r?document.fonts.load(i,r):document.fonts.load(i)).catch(()=>{}))).then(()=>{})}function cr(){const t=typeof document<"u"?document.documentElement:null,a=t?getComputedStyle(t):null,o=(s,r)=>(a?a.getPropertyValue(s).trim():"")||r;return{dark:t?t.dataset.theme==="dark":!1,materialSet:t&&t.dataset.matSet||"",bg:o("--bg","#F4EDDE"),cardTop:o("--card-top","#FFFFFC"),cardBottom:o("--card-bottom","#FCF8ED"),ink:o("--ink","#221C16"),soft:o("--soft","#6A5F50"),faint:o("--faint","#8A7C68"),line:o("--line","#E4DAC7"),amber:o("--amber","#BE8A4E"),accent:o("--accent","#B4482D"),inkBorder:o("--ink-border","rgba(41,38,29,.6)")}}function vn(t,a){let o=String(t).trim().replace("#","");o.length===3&&(o=o.split("").map(r=>r+r).join(""));const s=parseInt(o,16);return Number.isNaN(s)||o.length!==6?`rgba(180,72,45,${a})`:`rgba(${s>>16&255}, ${s>>8&255}, ${s&255}, ${a})`}function Lt(t,a,o,s,r,i){const l=Math.max(0,Math.min(i,s/2,r/2));t.beginPath(),t.moveTo(a+l,o),t.arcTo(a+s,o,a+s,o+r,l),t.arcTo(a+s,o+r,a,o+r,l),t.arcTo(a,o+r,a,o,l),t.arcTo(a,o,a+s,o,l),t.closePath()}const Hp="#B4482D",zp="#D8613D",vi="#F4EDDE";function $p(t,a,o,s,r){const i=s/256,l=d=>a+(d-21.43)*i,h=d=>o+(d-23.37)*i;t.save(),t.fillStyle=r?zp:Hp,Lt(t,l(21.43),h(23.37),213.14*i,178.04*i,44.51*i),t.fill(),t.beginPath(),t.moveTo(l(84),h(190)),t.lineTo(l(128),h(190)),t.lineTo(l(78),h(229)),t.closePath(),t.fill(),t.fillStyle=vi,t.strokeStyle=vi,t.lineWidth=13*i,t.lineCap="round";for(const d of[72,152])t.beginPath(),t.arc(l(d),h(128),31*i,0,Math.PI*2),t.fill(),t.beginPath(),t.moveTo(l(d+13),h(104)),t.lineTo(l(d+6),h(74)),t.stroke();for(const d of[45.39,82.72,120.05,157.38])Lt(t,l(197.24),h(d),22*i,22*i,6.8*i),t.fill();t.restore()}function Kn(t,a,o){const s=[];for(const h of a)String(h.text).split(`
`).forEach((m,p)=>{p>0&&s.push({br:!0});for(const u of m.split(/(\s+)/))u!==""&&s.push({text:u,font:h.font,space:/^\s+$/.test(u)})});const r=[];let i=[],l=0;for(const h of s){if(h.br){r.push(i),i=[],l=0;continue}t.font=h.font;const d=t.measureText(h.text).width;if(h.space){if(l===0)continue;i.push({text:h.text,font:h.font,w:d}),l+=d;continue}if(d>o){i.length&&(r.push(i),i=[],l=0);let m=h.text;for(;m.length;){let p=1;for(;p<m.length&&t.measureText(m.slice(0,p+1)).width<=o;)p++;const u=m.slice(0,p);r.push([{text:u,font:h.font,w:t.measureText(u).width}]),m=m.slice(p)}continue}if(l>0&&l+d>o){for(;i.length&&i[i.length-1].space===void 0&&/^\s+$/.test(i[i.length-1].text);)l-=i.pop().w;r.push(i),i=[],l=0}i.push({text:h.text,font:h.font,w:d}),l+=d}return i.length&&r.push(i),r}const An=new Map,Zn=new Map;function Wp(t){return t?Zn.has(t)?Promise.resolve(Zn.get(t)):new Promise(a=>{const o=new Image;o.onload=()=>{Zn.set(t,o),a(o)},o.onerror=()=>{Zn.set(t,null),a(null)},o.src=t}):Promise.resolve(null)}function Up(t){return t&&Zn.get(t)||null}function Gp(t){const a=(t||[]).filter(o=>o&&!An.has(o));return a.length?Promise.all(a.map(o=>new Promise(s=>{const r=new Image;r.onload=()=>{An.set(o,r),s()},r.onerror=()=>{An.set(o,null),s()},r.src=o}))).then(()=>{}):Promise.resolve()}function Pc(t,a,o,s,r,i){const l=a.width/a.height,h=r/i;let d,m,p,u;l>h?(m=a.height,d=m*h,p=(a.width-d)/2,u=0):(d=a.width,m=d/h,p=0,u=(a.height-m)/2),t.drawImage(a,p,u,d,m,o,s,r,i)}const Kp=.46,Vp=.5,Yp=.88,ki=.55,Qp=.3,Xp=5,Jp=.52,Zp=.5,ef=4,tf=.7,nf=3,xi=6;function Vn(t){return Math.max(ef,Math.round(t*Zp/xi)*xi)}function af(t,a,o,s,r){if(typeof document>"u")return null;const i=document.createElement("canvas");i.width=Math.max(1,Math.ceil(t)),i.height=Math.max(1,Math.ceil(a));const l=i.getContext("2d");if(!l)return null;r(l),l.globalCompositeOperation="source-in",l.fillStyle=s,l.fillRect(0,0,i.width,i.height),l.globalCompositeOperation="source-over";const h=document.createElement("canvas");h.width=i.width,h.height=i.height;const d=h.getContext("2d");if(!d)return null;const m=`blur(${o}px)`;let p=!1;try{d.filter=m,p=d.filter===m}catch{p=!1}return d.drawImage(i,0,0),p&&(d.filter="none"),h}function of(t,a){return a?{ink:t.ink,soft:t.ink,faint:t.ink}:{ink:t.ink,soft:t.soft,faint:t.faint}}let ji=new WeakMap;const sf=6;function Si(t,a,o,s,r,i,l){if(!t||!a||!o)return null;const h=`${l||""}|${Math.ceil(a)}x${Math.ceil(o)}|${s}|${r||""}|${i||""}`;let d=ji.get(t);if(d){const f=d.get(h);if(f)return f}else d=new Map,ji.set(t,d);const m=document.createElement("canvas");m.width=Math.ceil(a),m.height=Math.ceil(o);const p=m.getContext("2d");if(!p)return null;if(Pc(p,t,0,0,m.width,m.height),r){p.globalCompositeOperation="color";const f=p.globalCompositeOperation==="color";f||(p.globalCompositeOperation="source-atop"),p.globalAlpha=f?ki:ki*.6,p.fillStyle=r,p.fillRect(0,0,m.width,m.height),p.globalAlpha=1}i&&(p.globalCompositeOperation="source-over",p.globalAlpha=Qp,p.fillStyle=i,p.fillRect(0,0,m.width,m.height),p.globalAlpha=1);const u=s==="up"?p.createLinearGradient(0,m.height,0,0):s==="right"?p.createLinearGradient(0,0,m.width,0):p.createLinearGradient(m.width,0,0,0);return u.addColorStop(0,"rgba(0,0,0,0)"),u.addColorStop(1-Yp,"rgba(0,0,0,0)"),u.addColorStop(.34,"rgba(0,0,0,0.55)"),u.addColorStop(.62,"rgba(0,0,0,0.86)"),u.addColorStop(1,"rgba(0,0,0,1)"),p.globalCompositeOperation="destination-out",p.fillStyle=u,p.fillRect(0,0,m.width,m.height),d.size>=sf&&d.delete(d.keys().next().value),d.set(h,m),m}function rf(t,a,o){const s=a.quote&&t.quote?t.quote:"",r=a.translation&&t.translation?t.translation:"",i=(t.attribution||[]).filter(u=>a[u.id]&&u.value).map(u=>({text:u.value,emphasis:u.emphasis})),l=(t.meta||[]).filter(u=>a[u.id]&&u.value).map(u=>u.phrase?n(u.phrase,{value:u.value}):u.value),h=a.tags&&t.tags?t.tags:[],d=a.note&&t.note?t.note:"",p=!t.facesFor||a[t.facesFor]?t.faces||[]:[];return{quote:s,translation:r,attribution:i,meta:l,tags:h,note:d,faces:p,facesFor:t.facesFor||null,swap:!!t.swap&&p.length>0,colorHex:o||null,portrait:!!t.portrait&&p.length>0}}const Ni=38,Ti=23,Ei=19,Ci=28,Ai=28,$a=24,qi=10,Yn=7,Mi=34,Yo=20,lf=(229.3-23.37)/256,cf=14*.7,tn=34,df=5;function Ot(t,a=15){const o=/(\d+(?:\.\d+)?)px/.exec(String(t));return o?Number(o[1]):a}const hf=new Set(["author","speaker"]);function uf(t){return hf.has(t||"author")}function Oi(t,a,o,s,r,i,l){l&&(t.letterSpacing=l),t.fillStyle=i,t.textBaseline="alphabetic",a.forEach((h,d)=>{let m=o;const p=s+r*d+r*.76;for(const u of h)t.font=u.font,t.fillText(u.text,m,p),m+=u.w}),l&&(t.letterSpacing="0px")}function mf(t,a,o){var V,P;const s=t.getContext("2d"),r=22,i=34,l=r,h=za-r*2,d=!!a.colorHex&&!a.portrait,m=l+i+(d?8:0),p=h-i*2-(d?8:0),u=!!a.portrait&&!!((V=a.faces)!=null&&V.length),f=of(o,u),b=[],y=C=>{C.height>0&&b.push(C)};let v=0;if(a.quote){const C=Kn(s,[{text:`“${a.quote}”`,font:De.quote}],p);v=C.length*Ni,y({kind:"text",lines:C,lh:Ni,color:f.ink,px:Ot(De.quote),gap:0,height:v})}if(a.translation){const C=Kn(s,[{text:a.translation,font:De.translation}],p);y({kind:"text",lines:C,lh:Ai,color:f.soft,px:Ot(De.translation),gap:12,height:C.length*Ai})}const g=!a.portrait&&((P=a.faces)!=null&&P.length)?(a.swap?[...a.faces].reverse():a.faces).slice(0,df):[],w=g.length?tn+(g.length-1)*(tn-Math.round(tn*.34)):0,k=uf(a.facesFor),S=g.length&&k?g:null,N=g.length&&!k?g:null,j=10;if(a.attribution.length){const C=[];a.attribution.forEach((z,K)=>{C.push({text:K===0?"— ":", ",font:De.attrPlain});const A=z.emphasis==="bold"?De.attrBold:z.emphasis==="italic"?De.attrItalic:De.attrPlain;C.push({text:z.text,font:A})});let H=null,R=0,I=0,U=C;S&&(H="— ",s.font=De.attrPlain,R=s.measureText(H).width,I=R+w+j,U=C.slice(1));const te=Kn(s,U,p-I),D=te.length*Ti;y({kind:"text",lines:te,lh:Ti,color:f.soft,px:Ot(De.attrPlain),gap:14,textH:D,lead:I,pre:H,preFont:De.attrPlain,faceX:R,leadFaces:S,height:Math.max(D,S?tn:0)})}const x=a.meta.join("  ·  ").toUpperCase();if(x){const C=N?w+j:0;s.letterSpacing="1px";const H=Kn(s,[{text:x,font:De.meta}],p-C);s.letterSpacing="0px";const R=H.length*Ei;y({kind:"text",lines:H,lh:Ei,color:f.soft,px:Ot(De.meta),ls:"1px",gap:6,textH:R,lead:C,leadFaces:N,height:Math.max(R,C?tn:0)})}if(a.note){const C=Kn(s,[{text:a.note,font:De.note}],p-12);y({kind:"note",lines:C,lh:Ci,color:f.ink,px:Ot(De.note),gap:20,height:C.length*Ci})}if(a.tags.length){const C=[];let H=[],R=0;for(const I of a.tags){s.font=De.tag;const U=s.measureText(I).width+qi*2;H.length&&R+U>p&&(C.push(H),H=[],R=0),H.push({text:I,w:U}),R+=U+Yn}H.length&&C.push(H),y({kind:"tags",rows:C,px:Ot(De.tag),gap:18,height:C.length*($a+Yn)-Yn})}let M=0;b.forEach((C,H)=>{M+=(H?C.gap:0)+C.height});const q=i*2+M+20+Mi,E=Math.ceil(q+r*2);t.width=za*Ha,t.height=E*Ha,s.scale(Ha,Ha),s.fillStyle=o.bg,s.fillRect(0,0,za,E);const O=s.createLinearGradient(0,r,0,q+r);O.addColorStop(0,o.cardTop),O.addColorStop(1,o.cardBottom);const _=14;s.save(),s.shadowColor="rgba(0,0,0,0.28)",s.shadowBlur=26,s.shadowOffsetY=12,Lt(s,l,r,h,q,_),s.fillStyle=O,s.fill(),s.restore();const T=o.tile&&o.tile.img;if(T&&typeof s.createPattern=="function"){s.save(),Lt(s,l,r,h,q,_),s.clip();for(const[C,H]of[[o.tile.coarse,"source-over"],[o.tile.fine,"overlay"]]){const R=s.createPattern(T,"repeat");if(!R)break;const I=C/(T.width||C);typeof R.setTransform=="function"&&typeof DOMMatrix=="function"&&R.setTransform(new DOMMatrix([I,0,0,I,0,0])),s.globalAlpha=o.tile.strength,s.globalCompositeOperation=H,s.fillStyle=R,s.fillRect(l,r,h,q)}s.globalAlpha=1,s.globalCompositeOperation="source-over",s.restore()}if(Lt(s,l,r,h,q,_),s.lineWidth=1.5,s.strokeStyle=o.inkBorder,s.stroke(),u){const C=a.faces;if(s.save(),Lt(s,l,r,h,q,_),s.clip(),s.globalAlpha=Vp,C.length>2){const H=(a.swap?[...C].reverse():C).slice(0,Xp),R=Math.round(q*Jp),I=r+q-R,U=Math.ceil(h/H.length);H.forEach((te,D)=>{const z=l+D*U,K=D===H.length-1?l+h-z:U,A=Si(An.get(te.url),K,R,"up",a.colorHex,o.cardTop,te.url);A&&s.drawImage(A,z,I,K,R)})}else{const H=Math.round(h*Kp),R=q,I=[{fade:"right",x:l},{fade:"left",x:l+h-H}];I.forEach((U,te)=>{const D=a.swap?C[I.length-1-te]:C[te];if(!D)return;const z=Si(An.get(D.url),H,R,U.fade,a.colorHex,o.cardTop,D.url);z&&s.drawImage(z,U.x,r,H,R)})}s.restore()}d&&v>0&&(s.fillStyle=a.colorHex,Lt(s,l+i-2,r+i,6,v,3),s.fill());const B=(C,H,R,I)=>{const U=tn,te=Math.round(U*.34);for(let D=H.length-1;D>=0;D--){const z=R+D*(U-te),K=z+U/2,A=I+U/2,Y=An.get(H[D].url);C.save(),C.beginPath(),C.arc(K,A,U/2,0,Math.PI*2),C.closePath(),C.clip(),Y?Pc(C,Y,z,I,U,U):(C.fillStyle=vn(o.ink,.08),C.fillRect(z,I,U,U)),C.restore(),C.beginPath(),C.arc(K,A,U/2,0,Math.PI*2),C.lineWidth=3,C.strokeStyle=o.cardTop,C.stroke(),C.beginPath(),C.arc(K,A,U/2-.5,0,Math.PI*2),C.lineWidth=1,C.strokeStyle=vn(o.ink,.22),C.stroke()}},L=(C,H)=>{let R=r+i;b.forEach((A,Y)=>{if(Y&&(R+=A.gap),H!==null&&Vn(A.px)!==H){R+=A.height;return}if(A.kind==="text"){const G=R+(A.height-(A.textH??A.height))/2;A.leadFaces&&B(C,A.leadFaces,m+(A.faceX||0),R+(A.height-tn)/2),A.pre&&(C.font=A.preFont,C.fillStyle=A.color,C.textBaseline="alphabetic",C.fillText(A.pre,m,G+A.lh*.76)),Oi(C,A.lines,m+(A.lead||0),G,A.lh,A.color,A.ls)}else A.kind==="note"?(C.fillStyle=o.accent,C.fillRect(m,R+4,3,A.lh*.62),Oi(C,A.lines,m+12,R,A.lh,A.color,null)):A.kind==="tags"&&(C.font=De.tag,C.textBaseline="middle",A.rows.forEach((G,ae)=>{const Z=R+ae*($a+Yn);let pe=m;for(const ce of G)Lt(C,pe,Z,ce.w,$a,7),C.fillStyle=o.cardTop,C.fill(),C.fillStyle=vn(o.accent,.3),C.fill(),C.lineWidth=1,C.strokeStyle=vn(o.accent,.55),C.stroke(),C.fillStyle=f.ink,C.fillText(ce.text,pe+qi,Z+$a/2+1),pe+=ce.w+Yn}),C.textBaseline="alphabetic");R+=A.height});const I=r+q-i-Mi+10,U=Vn(Ot(De.credit));if(H!==null&&H!==U)return;C.strokeStyle=vn(o.ink,.12),C.lineWidth=1,C.beginPath(),C.moveTo(m,I),C.lineTo(m+p,I),C.stroke();const te=I+21,D=Yo*lf;$p(C,m,te-cf/2-D/2,Yo,o.dark);let z=m+Yo+7;C.fillStyle=f.faint,C.textBaseline="alphabetic",C.font=De.credit;const K=n("share.image.footer.credit.label");C.fillText(K,z,te),z+=C.measureText(K).width+6,C.font=De.foot,C.fillText("tippani",z,te),z+=C.measureText("tippani").width+8,C.font=De.bengali,C.fillText("টিপ্পনী",z,te)};if(u){const C=[...new Set(b.map(H=>Vn(H.px)))];C.includes(Vn(Ot(De.credit)))||C.push(Vn(Ot(De.credit)));for(const H of C){const R=af(za,E,H,vn(o.cardTop,1),I=>L(I,H));if(R){s.save(),Lt(s,l,r,h,q,_),s.clip(),s.shadowColor="rgba(0,0,0,0)",s.shadowBlur=0,s.shadowOffsetX=0,s.shadowOffsetY=0,s.globalAlpha=tf;for(let I=0;I<nf;I++)s.drawImage(R,0,0);s.globalAlpha=1,s.restore()}}}L(s,null),s.shadowColor="rgba(0,0,0,0)",s.shadowBlur=0,s.shadowOffsetX=0,s.shadowOffsetY=0,s.filter="none"}function dr(t,a,o){return!t||!a?[]:Je(t,o||Rn).map(s=>a[s]).filter(s=>s&&s.image_path).map(s=>({name:s.name,url:$e(s.image_path)}))}function Bc(t){return(t||[]).filter(a=>a&&a.path).map(a=>({name:a.name,url:$e(a.path)}))}const pf=()=>[["light",n("share.image.theme.light.label")],["dark",n("share.image.theme.dark.label")]],ff=()=>Object.keys(Et).map(t=>[t,n(_h[t])]);function gf(){return cr().dark?"dark":"light"}function bf(){const t=cr().materialSet;return Et[t]?t:Fn}function yf(t,a){const o=String(t||""),s=o==="dark"||o.endsWith("-dark"),r=kl(a,"card");return{...zh(s,cr().accent),materialSet:Et[a]?a:Fn,tile:{...r,img:Up(r.url)}}}const wf="tp-btn tp-btn-primary",Qo=[{id:"whatsapp",get name(){return n("share.format.whatsapp.name")},get logic(){return n("share.format.whatsapp.what")},get hint(){return n("share.format.whatsapp.hint")}},{id:"plaintext",get name(){return n("share.format.plaintext.name")},get logic(){return n("share.format.plaintext.what")},get hint(){return n("share.format.plaintext.hint")}},{id:"markdown",get name(){return n("share.format.markdown.name")},get logic(){return n("share.format.markdown.what")},get hint(){return n("share.format.markdown.hint")}},{id:"reddit",get name(){return n("share.format.reddit.name")},get logic(){return n("share.format.reddit.what")},get hint(){return n("share.format.reddit.hint")}}],vf=()=>n("share.format.image.what");function Fc({quote:t,note:a,translation:o,author:s,title:r,published:i,chapter:l,location:h,character:d,date:m,tags:p,color:u,people:f,seps:b,characterImages:y}){return{quote:t||"",translation:o||"",color:u||"",faces:dr(s,f,b),facesFor:"author",characterFaces:Bc(y),attribution:[{id:"author",label:n("share.field.author.label"),value:s||"",emphasis:"bold"},{id:"work",label:n("share.field.work.book.label"),value:r||"",emphasis:"italic"},{id:"published",label:n("share.field.published.label"),value:i?String(i):""}],meta:[{id:"character",label:n("share.field.character.label"),value:d||""},{id:"chapter",label:n("share.field.chapter.label"),value:l?n("share.credit.chapter.phrase",{n:l}):""},{id:"location",label:n("share.field.location.label"),value:h?n("share.credit.location.phrase",{n:h}):""},{id:"noted",label:n("share.field.noted.label"),value:m||""}],tags:p||[],note:a||""}}function Hc({quote:t,note:a,translation:o,title:s,year:r,character:i,actor:l,timestamp:h,episode:d,tags:m,color:p,tmdbId:u,tvdbId:f,people:b,seps:y,characterImages:v}){return{quote:t||"",translation:o||"",faces:dr(l,b,y),facesFor:"actor",characterFaces:Bc(v),attribution:[{id:"work",label:n("share.field.work.film.label"),value:s||"",emphasis:"italic"},{id:"year",label:n("share.field.released.label"),value:r?String(r):""},{id:"tmdb",label:n("share.field.tmdb.label"),value:u?n("share.credit.tmdb.phrase",{code:u}):""},{id:"tvdb",label:n("share.field.tvdb.label"),value:f?n("share.credit.tvdb.phrase",{code:f}):""}],meta:[{id:"character",label:n("share.field.character.label"),value:i||""},{id:"actor",label:n("share.field.actor.label"),value:l||"",emphasis:"bold",phrase:"share.credit.actor.phrase"},{id:"episode",label:n("share.field.episode.label"),value:d||""},{id:"timestamp",label:n("share.field.time.label"),value:h||""}],tags:m||[],note:a||"",color:p||""}}function zc({quote:t,translation:a,note:o,category:s,language:r,speaker:i,occasion:l,when:h,place:d,medium:m,date:p,tags:u,color:f,people:b,seps:y}){return{quote:t||"",translation:a||"",color:f||"",faces:dr(i,b,y),facesFor:"speaker",attribution:[{id:"speaker",label:n("share.field.speaker.label"),value:i||"",emphasis:"bold"},{id:"occasion",label:n("share.field.occasion.label"),value:l||"",emphasis:"italic"},{id:"when",label:n("share.field.when.label"),value:h||""}],meta:[{id:"proverb",label:n("share.field.proverb.label"),value:s==="proverb"&&r?r:"",phrase:"share.field.proverb.legend"},{id:"place",label:n("share.field.place.label"),value:d||""},{id:"medium",label:n("share.field.medium.label"),value:m||""},{id:"noted",label:n("share.field.noted.label"),value:p||""}],tags:u||[],note:o||""}}const kf=new Set(["location","noted"]);function $c(t){const a=[];t.quote&&a.push({id:"quote",label:n("share.field.quote.label")}),t.translation&&a.push({id:"translation",label:n("share.field.translation.label")});for(const o of t.attribution||[])o.value&&a.push({id:o.id,label:o.label});for(const o of t.meta||[])o.value&&a.push({id:o.id,label:o.label});return t.tags&&t.tags.length&&a.push({id:"tags",label:n("share.field.tags.label")}),t.note&&a.push({id:"note",label:n("share.field.note.label")}),a}function Wc(t){return Object.fromEntries($c(t).map(a=>[a.id,!kf.has(a.id)]))}async function ba(t){const a=await gl(Uc(t,Wc(t),"plaintext"));return Se(n(a?"common.toast.copied":"error.copy.generic")),a}function xf(t,a){return a==="markdown"||a==="reddit"?`*${t}*`:a==="whatsapp"?`_${t}_`:t}function jf(t,a){return a==="markdown"||a==="reddit"?`**${t}**`:a==="whatsapp"?`*${t}*`:t}function Li(t,a,o){return a==="bold"?jf(t,o):a==="italic"?xf(t,o):t}function _i(t,a){return a==="plaintext"?n("share.text.quote.phrase",{value:t}):t.split(`
`).map(o=>`> ${o}`).join(`
`)}function Sf(t){const a=String(t).trim().replace(/\s+/g,"");return a?"#"+a:""}function Uc(t,a,o){const s=[];a.quote&&t.quote&&s.push(_i(t.quote,o)),a.translation&&t.translation&&s.push(_i(t.translation,o));const r=[];for(const l of t.attribution||[])a[l.id]&&l.value&&r.push(Li(l.value,l.emphasis,o));r.length&&s.push(n("share.text.attribution.phrase",{value:r.join(", ")}));const i=[];for(const l of t.meta||[])if(a[l.id]&&l.value){const h=Li(l.value,l.emphasis,o);i.push(l.phrase?n(l.phrase,{value:h}):h)}if(i.length&&s.push(i.join(" · ")),a.note&&t.note&&s.push(t.note),a.tags&&t.tags&&t.tags.length){const l=t.tags.map(Sf).filter(Boolean).join(" ");l&&s.push(l)}return s.join(`

`)}const Nf=[{re:/`([^`]+)`/,el:(t,a)=>e.jsx("code",{className:"share-code",children:t[1]},a)},{re:/\*\*([^*]+)\*\*/,el:(t,a,o)=>e.jsx("strong",{children:ut(t[1],o)},a)},{re:/__([^_]+)__/,el:(t,a,o)=>e.jsx("strong",{children:ut(t[1],o)},a)},{re:/~~([^~]+)~~/,el:(t,a,o)=>e.jsx("s",{children:ut(t[1],o)},a)},{re:/\*([^*\n]+)\*/,el:(t,a,o)=>e.jsx("em",{children:ut(t[1],o)},a)},{re:/(^|[^A-Za-z0-9])_([^_\n]+)_(?![A-Za-z0-9])/,lead:1,el:(t,a,o)=>e.jsx("em",{children:ut(t[2],o)},a)},{re:/\[([^\]]+)\]\(([^)\s]+)\)/,el:(t,a)=>e.jsx("a",{className:"share-link",children:t[1]},a)}],Tf=[{re:/```([^`]+)```/,el:(t,a)=>e.jsx("code",{className:"share-code",children:t[1]},a)},{re:/`([^`]+)`/,el:(t,a)=>e.jsx("code",{className:"share-code",children:t[1]},a)},{re:/\*([^*\n]+)\*/,el:(t,a,o)=>e.jsx("strong",{children:ut(t[1],o)},a)},{re:/_([^_\n]+)_/,el:(t,a,o)=>e.jsx("em",{children:ut(t[1],o)},a)},{re:/~([^~\n]+)~/,el:(t,a,o)=>e.jsx("s",{children:ut(t[1],o)},a)}];function Ef(t){return t==="whatsapp"?Tf:t==="markdown"||t==="reddit"?Nf:null}function ut(t,a){if(!a)return[t];const o=[];let s=t,r=0,i=0;for(;s.length&&i++<2e3;){let l=null;for(const m of a){const p=m.re.exec(s);p&&(!l||p.index<l.m.index)&&(l={p:m,m:p})}if(!l){o.push(s);break}const h=l.p.lead&&l.m[l.p.lead]||"",d=l.m.index+h.length;d>0&&o.push(s.slice(0,d)),o.push(l.p.el(l.m,"i"+r++,a)),s=s.slice(l.m.index+l.m[0].length)}return o}function Ri(t,a,o){const s=t.split(`
`);return s.map((r,i)=>e.jsxs("span",{children:[ut(r,a),i<s.length-1&&e.jsx("br",{})]},`${o}-${i}`))}function Cf(t,a,o,s){const r=t.split(`
`),i=r.filter(l=>l.trim()!=="");if(a!=="plaintext"&&i.length&&i.every(l=>/^>\s?/.test(l))){const l=r.map(h=>h.replace(/^>\s?/,"")).join(`
`);return e.jsx("blockquote",{className:"share-quote",children:Ri(l,o,`q${s}`)},s)}if((a==="markdown"||a==="reddit")&&r.length===1){const l=t.match(/^(#{1,6})\s+(.*)$/);if(l){const d=`h${Math.min(l[1].length+2,6)}`;return e.jsx(d,{className:"share-h",children:ut(l[2],o)},s)}}return a!=="plaintext"&&i.length&&i.every(l=>/^[-*+]\s+/.test(l))?e.jsx("ul",{className:"share-ul",children:i.map((l,h)=>e.jsx("li",{children:ut(l.replace(/^[-*+]\s+/,""),o)},h))},s):a!=="plaintext"&&i.length&&i.every(l=>/^\d+[.)]\s+/.test(l))?e.jsx("ol",{className:"share-ol",children:i.map((l,h)=>e.jsx("li",{children:ut(l.replace(/^\d+[.)]\s+/,""),o)},h))},s):e.jsx("p",{className:"share-p",children:Ri(t,o,`p${s}`)},s)}function Af(t,a){const o=Ef(a);return t.split(/\n{2,}/).map((r,i)=>Cf(r,a,o,i))}function qf({share:t,selected:a,onShared:o,actionRef:s}){var P;const r=c.useRef(null),i=_e(),[l,h]=c.useState(!1),[d,m]=c.useState(!1),[p,u]=c.useState(""),[f,b]=He("tippani:shareImageTheme",gf()),[y,v]=He("tippani:shareImageMaterial",bf()),[g,w]=He("tippani:sharePortrait",!1),k=(t.faces||[]).length>0||(t.characterFaces||[]).length>0,[S,N]=He("tippani:shareFaceKind","actor"),j=t.characterFaces||[],x=j.length>0&&(t.faces||[]).length>0,M=S==="character"&&j.length>0?j:t.faces||[],[q,E]=He("tippani:shareSwapSides",!1),[O,_]=He("tippani:shareImageTint",!1),T=!!t.color;c.useEffect(()=>{let C=!1;const H=()=>{const R=r.current;if(!(!R||C))try{const I=O&&t.color?Uh(t.color):null;mf(R,rf({...t,faces:M,portrait:g&&k,swap:q},a,I),yf(f,y)),u("")}catch{u(n("error.render.image"))}};return g&&k||H(),Promise.all([Fp({text:[t.quote,t.translation,t.note,...(t.attribution||[]).map(R=>(R==null?void 0:R.text)||"")].filter(Boolean).join(" "),hand:!!t.note}),Gp(M.map(R=>R.url)),Wp(kl(y,"card").url)]).then(H),window.addEventListener("tippani:theme",H),()=>{C=!0,window.removeEventListener("tippani:theme",H)}},[t,a,f,y,g,k,q,O,S]);async function B(){const C=r.current;if(!C)return;const H=await new Promise(U=>C.toBlob(U,"image/png"));if(!H)return u(n("error.render.image"));if(i&&navigator.canShare&&navigator.share){const U=new File([H],"tippani-quote.png",{type:"image/png"});if(navigator.canShare({files:[U]}))try{await navigator.share({files:[U]}),o==null||o();return}catch(te){if((te==null?void 0:te.name)==="AbortError")return}}if(i)try{const U=new FormData;U.append("file",H,"tippani-quote.png");const te=await fetch(wt("/share/image"),{method:"POST",body:U});if(te.ok){const{url:D}=await te.json(),z=document.createElement("a");z.href=wt(D),z.download="tippani-quote.png",document.body.appendChild(z),z.click(),z.remove(),o==null||o();return}}catch{}const R=URL.createObjectURL(H),I=document.createElement("a");I.href=R,I.download="tippani-quote.png",document.body.appendChild(I),I.click(),I.remove(),setTimeout(()=>URL.revokeObjectURL(R),6e4),o==null||o()}s&&(s.current=B);const L=typeof window<"u"&&typeof window.ClipboardItem<"u"&&!!((P=navigator.clipboard)!=null&&P.write);async function V(){const C=r.current;if(!(!C||!L)){m(!0);try{const H=await new Promise(R=>C.toBlob(R,"image/png"));await navigator.clipboard.write([new window.ClipboardItem({"image/png":H})]),h(!0),setTimeout(()=>h(!1),1600),o==null||o()}catch{u(n("share.image.copy.unsupported.error"))}finally{m(!1)}}}return e.jsxs("div",{children:[e.jsxs("div",{className:"mb-2 flex flex-wrap items-center gap-2",children:[e.jsx($,{children:n("share.image.theme.label")}),e.jsx(Oe,{ariaLabel:n("share.image.theme.aria"),value:f,onChange:b,options:pf()}),e.jsx(Le,{title:n("share.image.theme.info.title"),text:n("share.image.theme.info.body")})]}),e.jsxs("div",{className:"mb-2 flex flex-wrap items-center gap-2",children:[e.jsx($,{children:n("share.image.material.label")}),e.jsx(Oe,{ariaLabel:n("share.image.material.aria"),value:y,onChange:v,options:ff()})]}),x&&e.jsxs("div",{className:"mb-2 flex flex-wrap items-center gap-2",children:[e.jsx($,{children:n("share.image.facekind.label")}),e.jsx(Ye,{ariaLabel:n("share.image.facekind.aria"),value:S,onChange:N,options:[["actor",n("share.image.facekind.actor.label")],["character",n("share.image.facekind.character.label")]]}),e.jsx(Le,{title:n("share.image.facekind.info.title"),text:n("share.image.facekind.info.body")})]}),k&&e.jsxs("div",{className:"mb-2 flex flex-wrap items-center gap-2",children:[e.jsx($,{children:n("share.image.portrait.label")}),e.jsx(Ye,{ariaLabel:n("share.image.portrait.aria"),value:g?"backdrop":"chip",onChange:C=>w(C==="backdrop"),options:[["chip",n("share.image.portrait.chip.label")],["backdrop",n("share.image.portrait.backdrop.label")]]}),e.jsx(Le,{title:n("share.image.portrait.info.title"),text:n("share.image.portrait.info.body")})]}),k&&e.jsxs("div",{className:"mb-2 flex flex-wrap items-center gap-2",children:[e.jsx($,{children:n("share.image.sides.label")}),e.jsx(Ye,{ariaLabel:n("share.image.sides.aria"),value:q?"swapped":"as-credited",onChange:C=>E(C==="swapped"),options:[["as-credited",n("share.image.sides.as-credited.label")],["swapped",n("share.image.sides.swap.label")]]}),e.jsx(Le,{title:n("share.image.sides.info.title"),text:n("share.image.sides.info.body")})]}),T&&e.jsxs("div",{className:"mb-2 flex flex-wrap items-center gap-2",children:[e.jsx($,{children:n("common.mono.colour.label")}),e.jsx(Ye,{ariaLabel:n("share.image.colour.aria"),value:O?"on":"off",onChange:C=>_(C==="on"),options:[["off",n("common.toggle.off.label")],["on",n("common.toggle.on.label")]]}),e.jsx(Le,{title:n("share.image.colour.info.title"),text:n("share.image.colour.info.body")})]}),e.jsx($,{className:"mb-1.5 block",children:n("share.preview.label")}),e.jsx("div",{className:"share-image-preview",children:e.jsx("canvas",{ref:r,className:"share-image-canvas","aria-label":n("share.image.preview.aria")})}),p&&e.jsx("p",{className:"microcopy mt-2",style:{color:"var(--error)"},children:p}),L&&e.jsx("div",{className:"mt-4 flex flex-wrap items-center justify-end gap-2",children:e.jsx(ge,{onClick:V,disabled:d,children:n(l?"common.action.copy.done.label":"share.image.copy.label")})})]})}function Ho({share:t,seen:a,onClose:o}){At(!0);const[s,r]=c.useState("image"),i=c.useMemo(()=>$c(t),[t]),[l,h]=c.useState(()=>Wc(t)),[d,m]=c.useState(""),[p,u]=c.useState(!1),f=_e(),b=c.useRef(null),y=c.useRef(!1),v=()=>{y.current||qs||!(a!=null&&a.id)||(y.current=!0,X("POST","/review/seen",{kind:a.kind,id:a.id}))},g=Qo.find(j=>j.id===s)||Qo[0],w=s==="image",k=[["image",n("share.format.image.name")],...Qo.map(j=>[j.id,j.name])];c.useEffect(()=>{m(Uc(t,l,s)),u(!1)},[t,l,s]),c.useEffect(()=>{const j=x=>x.key==="Escape"&&o();return document.addEventListener("keydown",j),()=>document.removeEventListener("keydown",j)},[o]);async function S(){await gl(d)&&(u(!0),setTimeout(()=>u(!1),1600),v())}const N=c.useMemo(()=>Af(d,s),[d,s]);return e.jsx("div",{className:"tp-scrim fixed inset-0 z-50 overflow-y-auto px-4 py-10",onMouseDown:j=>{j.target===j.currentTarget&&o()},children:e.jsxs("div",{role:"dialog","aria-modal":"true","aria-label":n("share.dialog.aria"),className:"hand-card hc-r2 mx-auto w-full max-w-3xl px-6 py-6",children:[e.jsxs("div",{className:"mb-4 flex items-start justify-between gap-3",children:[e.jsx("h2",{className:"display-title text-xl",children:n("share.dialog.title")}),e.jsxs("span",{className:"flex items-center gap-1",children:[w&&e.jsx(Ce,{icon:e.jsx(En,{}),ariaLabel:n("share.image.share.aria"),onClick:()=>{var j;return(j=b.current)==null?void 0:j.call(b)},tooltip:n("share.image.share.tip")}),e.jsx(Zs,{onClick:o})]})]}),e.jsxs("div",{className:"mb-4 flex flex-wrap items-center gap-3",children:[e.jsx($,{children:n("share.format.label")}),f?e.jsx("select",{className:"tp-input","aria-label":n("share.format.aria"),value:s,onChange:j=>r(j.target.value),children:k.map(([j,x])=>e.jsx("option",{value:j,children:x},j))}):e.jsx("div",{className:"share-format-toggle",children:e.jsx(Ye,{ariaLabel:n("share.format.aria"),value:s,onChange:r,options:k})}),e.jsx(Le,{title:w?n("share.format.image.name"):g.name,text:w?vf():e.jsxs(e.Fragment,{children:[g.logic,e.jsx("code",{className:"share-hint mt-2",children:g.hint})]})})]}),i.length>0&&e.jsxs("div",{className:"mb-4",children:[e.jsx($,{className:"mb-2 block",children:n("share.include.label")}),e.jsx("div",{className:"flex flex-wrap gap-x-4 gap-y-2",children:i.map(j=>e.jsxs("label",{className:"flex items-center gap-2",style:{cursor:"pointer"},children:[e.jsx("input",{type:"checkbox",checked:!!l[j.id],onChange:x=>h(M=>({...M,[j.id]:x.target.checked}))}),e.jsx("span",{className:"microcopy",children:j.label})]},j.id))})]}),w?e.jsx(qf,{share:t,selected:l,onShared:v,actionRef:b}):e.jsxs("div",{className:"grid gap-4 sm:grid-cols-2",children:[e.jsxs("div",{children:[e.jsx($,{className:"mb-1.5 block",children:n("share.text.label")}),e.jsx("textarea",{className:"tp-input share-source",rows:"11",value:d,onChange:j=>m(j.target.value),"aria-label":n("share.text.aria")})]}),e.jsxs("div",{children:[e.jsx($,{className:"mb-1.5 block",children:n("share.preview.label")}),e.jsx("div",{className:"share-preview","aria-live":"polite",children:d.trim()?N:e.jsx("p",{className:"microcopy",children:n("share.preview.empty")})})]})]}),!w&&e.jsx("div",{className:"mt-5 flex items-center justify-end gap-2",children:e.jsx("button",{className:wf,onClick:S,children:n(p?"common.action.copy.done.label":"common.action.copy.label")})})]})})}async function Wn(t,{label:a,reload:o}={}){var l;const s=a||n("common.toast.deleted.label"),r=await X("DELETE",t);if(!r.ok)return r;const i=(l=r.data)==null?void 0:l.trash_id;return i?(Se(s,{label:n("common.action.undo.label"),onClick:async()=>{const h=await X("POST",`/trash/${i}/restore`);if(!h.ok)return Se(le(h,n("error.undo.generic")));Se(n("common.toast.restored.label")),o==null||o()}}),r):(Se(s),r)}const zt="row",et="overflow",Mf=t=>n(t==="book"?"common.subject.book.label":t==="movie"?"common.subject.movie.label":"common.subject.quote.label");function _a(t,a,o={}){const s=hr(t),r=Mf(t);return[{id:"copy",label:n("common.action.copy.label"),where:zt,icon:e.jsx(ca,{}),tooltip:n("common.action.copy.tip",{subject:r}),available:!s&&!!o.copy,run:()=>o.copy(a)},{id:"share",label:n("common.action.share.label"),where:zt,icon:e.jsx(En,{}),tooltip:n("common.action.share.tip",{subject:r}),available:!s&&!!o.share,run:()=>o.share(a)},{id:"fill",label:n("common.action.fill.label"),where:et,icon:e.jsx(Hn,{}),tooltip:n("common.action.fill.tip"),available:s&&!!o.fillGaps,run:()=>o.fillGaps(a)},{id:"practise",label:n("common.action.practise.label"),where:et,icon:e.jsx(Ct,{}),tooltip:n("common.action.practise.tip",{subject:r}),single:!0,available:s&&!!o.practise,run:()=>o.practise(a)},{id:"review",label:n(o.excluded?"common.action.review.add.label":"common.action.review.skip.label"),where:et,icon:o.excluded?e.jsx(Ct,{}):e.jsx(Ys,{}),tooltip:n(o.excluded?"common.action.review.add.tip":"common.action.review.skip.tip"),available:!!o.setReview,run:()=>o.setReview(a,!!o.excluded)},{id:"edit",label:n("common.action.edit.label"),where:et,icon:e.jsx(at,{}),tooltip:n("common.action.edit.tip",{subject:r}),single:!0,available:!!o.edit,run:()=>o.edit(a)},{id:"favourite",label:n(o.favourited?"common.action.favourite.menu.off.label":"common.action.favourite.menu.on.label"),where:et,icon:e.jsx(Vs,{}),tooltip:n("common.action.favourite.tip",{subject:r}),available:!s&&!!o.favourite,run:()=>o.favourite(a)},{id:"board",label:n("common.action.board.label"),where:et,icon:e.jsx(po,{}),tooltip:n("common.action.board.tip"),available:!!o.setBoard,run:()=>o.setBoard(a)},{id:"delete",label:n("common.action.delete.label"),where:et,icon:e.jsx(Fe,{}),tooltip:n("common.action.delete.tip",{subject:r}),danger:!0,available:!!o.remove,run:()=>o.remove(a)}].filter(l=>l.available)}const Dn=t=>t.filter(a=>a.where===zt),In=t=>t.filter(a=>a.where===et),Wa="",Of="tags",Lf="fields",_f="colour",Rf="sticker",Df="shelf",If="board",Pf="anthology",Bf="confirm",hr=t=>t==="book"||t==="movie";function Ff(t,a,o={}){const s=hr(t),r=a.length===1;return[{id:"colour",label:n("common.action.colour.label"),where:zt,icon:e.jsx(ec,{}),form:_f,available:!s&&!!o.setColour,run:l=>o.setColour(a,l)},{id:"add-tags",label:n("common.action.add-tags.label"),where:et,icon:e.jsx(Zl,{}),form:Of,available:!s&&!!o.addTags,run:l=>o.addTags(a,l)},{id:"sticker",label:n("common.action.seal.label"),where:et,icon:e.jsx(sm,{}),form:Rf,available:!s&&!!o.setSticker,run:l=>o.setSticker(a,l)},{id:"favourite",label:n("common.action.favourite.menu.on.label"),where:zt,icon:e.jsx(Vs,{}),form:Wa,available:!s&&!!o.favourite,run:()=>o.favourite(a)},{id:"fill",label:n("common.action.fill.label"),where:zt,icon:e.jsx(Hn,{}),form:Wa,available:s&&!!o.fillGaps,run:()=>o.fillGaps(a)},{id:"shelf",label:n("common.action.shelf.label"),where:zt,icon:e.jsx(po,{}),form:Df,available:s&&!!o.setShelf,run:l=>o.setShelf(a,l)},{id:"board",label:n("common.action.board.label"),where:et,icon:e.jsx(po,{}),form:If,available:!!o.setBoard,run:l=>o.setBoard(a,l)},{id:"anthology",label:n("common.action.anthology.label"),where:et,icon:e.jsx(Qs,{}),form:Pf,available:!s&&!!o.addToAnthology,run:l=>o.addToAnthology(a,l)},{id:"set-fields",label:n("common.action.set-fields.label"),where:et,icon:e.jsx(un,{}),form:Lf,available:!!o.setFields&&!r,run:l=>o.setFields(a,l)},{id:"review",label:n(o.excluded?"common.action.review.add.label":"common.action.review.skip.label"),where:zt,icon:o.excluded?e.jsx(Ct,{}):e.jsx(Ys,{}),form:Wa,available:!!o.setReview,run:()=>o.setReview(a,!!o.excluded)},{id:"edit",label:n("common.action.edit.label"),where:et,icon:e.jsx(at,{}),form:Wa,available:!!o.edit&&r,run:()=>o.edit(a[0])},{id:"delete",label:n("common.action.delete.label"),where:et,icon:e.jsx(Fe,{}),form:Bf,danger:!0,available:!!o.remove,run:l=>o.remove(a,l)}].filter(l=>l.available)}function Ra(t=[]){const[a,o]=c.useState(null),[s,r]=c.useState(()=>new Set),[i,l]=c.useState(!1),h=c.useRef(null),d=t.join(","),m=c.useMemo(()=>t,[d]);c.useEffect(()=>{r(v=>{if(v.size===0)return v;const g=new Set(m);let w=!1;const k=new Set;for(const S of v)g.has(S)?k.add(S):w=!0;return w?k:v})},[m]);const p=c.useCallback(()=>{r(new Set),o(null),l(!1),h.current=null},[]),u=c.useCallback(()=>{r(new Set),h.current=null},[]),f=c.useCallback((v,g)=>{l(!0),o(w=>w&&g&&w!==g?(r(new Set([v])),h.current=v,g):(r(k=>{const S=new Set(k);return S.has(v)?S.delete(v):S.add(v),S}),h.current=v,w||g||null))},[]),b=c.useCallback((v,g)=>{const w=h.current;if(w==null||w===v)return f(v,g);const k=m.indexOf(w),S=m.indexOf(v);if(k<0||S<0)return f(v,g);const[N,j]=k<S?[k,S]:[S,k];l(!0),o(g||null),r(x=>{const M=new Set(x);for(let q=N;q<=j;q++)M.add(m[q]);return M}),h.current=v},[m,f]),y=c.useCallback(v=>{l(!0),o(v||null),r(new Set(m))},[m]);return{kind:a,selected:s,ids:[...s],count:s.size,total:m.length,allSelected:m.length>0&&s.size>=m.length,open:i,active:i,any:s.size>0,isSelected:v=>s.has(v),toggle:f,extendTo:b,selectAll:y,deselectAll:u,dismiss:p,clear:p}}function ur(t,{active:a}){return t.shiftKey?"extend":t.metaKey||t.ctrlKey||a?"toggle":"open"}function mr(t,a,o){if(!t)return[];const s=[{id:"select",label:n(t.isSelected(a)?"common.selection.menu.deselect.label":"common.selection.menu.select.label"),onClick:()=>t.toggle(a,o)}];return t.total>1&&s.push(t.allSelected?{id:"deselect-all",label:n("common.selection.menu.deselect-all.label"),onClick:()=>t.deselectAll()}:{id:"select-all",label:n("common.selection.menu.select-all.label",{count:t.total,n:t.total}),onClick:()=>t.selectAll(o)}),s}const pr=[{name:"tag",vocab:"tags",combine:"and"},{name:"colour",vocab:"colours",combine:"or"},{name:"author",vocab:"authors",combine:"or"},{name:"speaker",vocab:"speakers",combine:"or"},{name:"actor",vocab:"actors",combine:"or"},{name:"character",vocab:"characters",combine:"or"},{name:"director",vocab:"directors",combine:"or"},{name:"genre",vocab:"genres",combine:"and"},{name:"series",vocab:"series",combine:"or"},{name:"shelf",vocab:"shelves",combine:"or"},{name:"year",vocab:"year",combine:"or"},{name:"favourite",vocab:"yesno",combine:"or",exclusive:!0},{name:"note",vocab:"yesno",combine:"or",exclusive:!0},{name:"wishlist",vocab:"yesno",combine:"or",exclusive:!0},{name:"book",vocab:"books",combine:"or"},{name:"movie",vocab:"movies",combine:"or"},{name:"added_from",vocab:null,combine:"or",typed:!1,exclusive:!0},{name:"added_to",vocab:null,combine:"or",typed:!1,exclusive:!0}],Hf=new Set(["colours","books","movies"]);pr.map(t=>t.name);const Gc=pr.filter(t=>t.typed!==!1).map(t=>t.name);function Kc(t){const a=String(t||"").toLowerCase();return pr.find(o=>o.name===a)||null}const Di=new RegExp(`(?:^|\\s)(${Gc.join("|")})(\\\\?):`,"gi"),zf=new RegExp(`(^|\\s)(${Gc.join("|")})\\\\:`,"gi");function $f(t){return String(t||"").replace(zf,"$1$2:")}function Wf(t){const a=String(t||"");let o=null;Di.lastIndex=0;let s;for(;(s=Di.exec(a))!==null;)s[2]!=="\\"&&(o=s);if(!o)return null;const r=o.index+o[0].length-o[1].length-1;return{field:o[1].toLowerCase(),value:a.slice(o.index+o[0].length),start:r}}function Uf(t,a){return a?String(t||"").slice(0,a.start).replace(/\s+$/,""):t}const Hw=5,Gf=50;function zw(t,a){const o=Wf(t),s=o?Qf(Vf(o.field,a,o.value),o.value,Gf):[],r=o&&s.length>0?o:null;return{draft:o,options:s,live:r,freeText:$f(r?Uf(t,r):t)}}const Kf=()=>[{value:"yes",label:n("vocab.yesno.yes.label")},{value:"no",label:n("vocab.yesno.no.label")}];function Vf(t,a={},o=""){const s=Kc(t);if(!s||!s.vocab)return[];if(s.vocab==="yesno")return Kf();if(s.vocab==="year"){const i=String(o||"").trim();return/^-?\d{1,4}$/.test(i)?[{value:i,label:i}]:[]}const r=a[s.vocab]||[];return Hf.has(s.vocab)?r.map(i=>({value:String(i.key),label:i.name||i.key})):r.map(i=>({value:i,label:i}))}function Yf(t,a){let o=Br(a,t);for(const s of t.split(/\s+/)){const r=Br(a,s);r<o&&(o=r)}return o}function Qf(t,a,o=8){const s=Fr(a);if(!s)return t.slice(0,o);const r=wh(s.length),i=[];for(const l of t){const h=Fr(l.label);let d=-1,m=0;if(h.startsWith(s)||h.split(/\s+/).some(p=>p.startsWith(s)))d=0;else if(h.includes(s))d=1;else if(r>0){const p=Yf(h,s);p<=r&&(d=2,m=p)}d>=0&&i.push({o:l,rank:d,dist:m})}return i.sort((l,h)=>l.rank-h.rank||l.dist-h.dist),i.slice(0,o).map(l=>l.o)}function $w(t,a){return{field:t,value:a.value,label:a.label??a.value}}function Ww(t){return`${t.field}:${t.label}`}function Xf(t,a){return t.field===a.field&&t.value===a.value}function Uw(t,a){if(t.some(s=>Xf(s,a)))return t;const o=Kc(a.field);return o&&o.exclusive?Ze(t,a.field,a.value):[...t,a]}function Gw(t,a){return t.filter((o,s)=>s!==a)}function Jf(t=[]){return t.map(a=>[a.field,a.value])}let Vc=[];function Qt(t){Vc=Array.isArray(t)?t:[]}function Zf(){return Vc}const eg=["tagged","noted","media"];function Yc(t=[]){return t.filter(a=>!eg.includes(a.field))}function st(t,a){const o=(t||[]).find(s=>s.field===a);return o?o.value:""}function Qc(t,a){return(t||[]).filter(o=>o.field===a).map(o=>o.value)}function Ze(t,a,o){const s=(t||[]).filter(h=>h.field!==a);if(!o)return s;const r=(t||[]).findIndex(h=>h.field===a),i={field:a,value:o,label:o};if(r<0)return[...s,i];const l=[...t||[]].filter(h=>h.field!==a);return l.splice(r,0,i),l}function Xc(t,a,o){const s=(o||[]).filter(Boolean),r=(t||[]).findIndex(h=>h.field===a),i=(t||[]).filter(h=>h.field!==a),l=s.map(h=>({field:a,value:h,label:h}));return r<0?[...i,...l]:(i.splice(r,0,...l),i)}function Jc(t,a,o){return a?{field:t==="movie"?"movie":"book",value:String(a),label:o||`#${a}`}:null}function Kw({q:t="",scope:a="all",chips:o=[]}={}){const s=new URLSearchParams,r=String(t||"").trim();r&&s.set("q",r),s.set("scope",a);for(const[i,l]of Jf(o))s.append(i,l);return s.toString()}const tg=120,ng=2e4,ag=8e3,Xo=t=>({kind:t.kind,item_id:t.item_id}),og=(t,a)=>t.kind===a.kind&&t.item_id===a.item_id,Ii={annotation:"book",dialogue:"screen",quote:"utterance"};function Zc(){const[t,a]=c.useState(null),[o,s]=c.useState(""),r=c.useCallback(async()=>{const i=await X("GET","/anthologies");if(!i.ok)return s(le(i,n("error.load.anthologies")));a(i.data.anthologies||[]),s("")},[]);return c.useEffect(()=>{r()},[r]),{rows:t,error:o,reload:r}}const ed=t=>wt(`/anthologies/${t}/export`),Pi=[{key:"hide_credit",hide:!0,label:"anthologies.form.fields.credit.label"},{key:"hide_source",hide:!0,label:"anthologies.form.fields.source.label"},{key:"show_locator",hide:!1,label:"anthologies.form.fields.locator.label"},{key:"show_date",hide:!1,label:"anthologies.form.fields.date.label"},{key:"hide_commentary",hide:!0,label:"anthologies.form.fields.commentary.label"},{key:"hide_colour",hide:!0,label:"anthologies.form.fields.colour.label"}],sg=(t,a)=>t.hide?!a[t.key]:!!a[t.key],rg=(t,a)=>t.hide?!a:a;function td({initial:t,onSubmit:a,onCancel:o,submitLabel:s=n("common.action.save.label")}){const[r,i]=c.useState((t==null?void 0:t.title)||""),[l,h]=c.useState((t==null?void 0:t.intro)||""),[d,m]=c.useState(()=>{const v={};for(const g of Pi)v[g.key]=!!(t!=null&&t[g.key]);return v}),[p,u]=c.useState(""),[f,b]=c.useState(!1);async function y(v){if(v.preventDefault(),!r.trim())return u(n("error.validate.anthology-title-required"));b(!0);const g=await a({title:r.trim(),intro:l,...d});b(!1),g&&u(g)}return e.jsxs("form",{onSubmit:y,className:"space-y-4",children:[e.jsx(xe,{label:n("common.field.title.label"),value:r,maxLength:tg,placeholder:n("anthologies.form.title.placeholder"),onChange:v=>i(v.target.value)}),e.jsxs("label",{className:"tp-field",children:[e.jsx($,{children:n("anthologies.form.intro.label")}),e.jsx("textarea",{className:"tp-input",rows:5,value:l,maxLength:ng,placeholder:n("anthologies.form.intro.placeholder"),onChange:v=>h(v.target.value)})]}),e.jsxs("div",{className:"tp-field",children:[e.jsx($,{children:n("anthologies.form.fields.label")}),e.jsx("p",{className:"microcopy mt-0.5 mb-2",children:n("anthologies.form.fields.hint")}),e.jsx("div",{className:"space-y-2.5",children:Pi.map(v=>e.jsxs("div",{className:"flex items-center justify-between gap-3",children:[e.jsx($,{children:n(v.label)}),e.jsx(Ye,{ariaLabel:n(v.label),value:sg(v,d)?"on":"off",onChange:g=>m(w=>({...w,[v.key]:rg(v,g==="on")})),options:[["off",n("common.action.hide.label")],["on",n("common.action.show.label")]]})]},v.key))})]}),e.jsx(ve,{children:p}),e.jsxs("div",{className:"flex items-center justify-end gap-2",children:[e.jsx(ge,{type:"button",onClick:o,children:n("common.action.cancel.label")}),e.jsx("button",{type:"submit",className:"tp-btn tp-btn-primary tactile",disabled:f,children:f?n("common.action.save.busy"):s})]})]})}function ig({entry:t,onSave:a,onCancel:o}){const[s,r]=c.useState(t.note||""),[i,l]=c.useState(""),[h,d]=c.useState(!1);async function m(){d(!0);const p=await a(t,s);d(!1),p&&l(p)}return e.jsx(Ge,{open:!0,title:n("anthologies.entry.note.title"),onClose:o,children:e.jsxs("div",{className:"space-y-3",children:[e.jsx("p",{className:"microcopy",children:n("anthologies.entry.note.body")}),e.jsxs("label",{className:"tp-field",children:[e.jsx($,{children:n("common.field.note.label")}),e.jsx("textarea",{className:"tp-input",rows:5,value:s,maxLength:ag,placeholder:n("anthologies.entry.note.placeholder"),onChange:p=>r(p.target.value)})]}),e.jsx(ve,{children:i}),e.jsxs("div",{className:"flex items-center justify-end gap-2",children:[e.jsx(ge,{type:"button",onClick:o,children:n("common.action.cancel.label")}),e.jsx("button",{type:"button",className:"tp-btn tp-btn-primary tactile",disabled:h,onClick:m,children:n(h?"common.action.save.busy":"common.action.save.label")})]})]})})}function nd({anthology:t,onDone:a,onCancel:o}){const[s,r]=c.useState("");async function i(){const l=await X("DELETE",`/anthologies/${t.id}`);if(!l.ok)return r(le(l,n("error.delete.anthology")));Se(n("anthologies.toast.deleted")),await a()}return e.jsx(vt,{open:!0,title:n("anthologies.delete.confirm.title",{title:t.title}),confirmLabel:n("common.action.delete.label"),onConfirm:i,onCancel:o,body:e.jsxs("div",{className:"space-y-2",children:[e.jsx("p",{children:n("anthologies.delete.confirm.body",{count:t.entries,n:t.entries,noun:n("unit.entry",{count:t.entries})})}),e.jsx("p",{className:"microcopy",children:n("anthologies.delete.confirm.note")}),e.jsx(ve,{children:s})]})})}function lg({row:t,onOpen:a,onEdit:o,onDelete:s}){return e.jsxs("div",{className:"board-tile",children:[e.jsxs("button",{type:"button",className:"board-tile-face",onClick:()=>a(t.id),children:[e.jsx("span",{className:"board-tile-name",children:t.title}),e.jsx("span",{className:"board-tile-count",children:n("common.count.phrase",{n:t.entries,noun:n("unit.entry",{count:t.entries})})}),t.intro&&e.jsx("span",{className:"microcopy anthology-tile-intro",children:t.intro})]}),e.jsx("span",{className:"board-tile-tools",children:e.jsx(It,{items:[{id:"edit",icon:e.jsx(at,{}),label:n("common.action.edit.label"),onClick:()=>o(t)},{id:"export",icon:e.jsx(rt,{}),label:n("common.action.export.label"),onClick:()=>{window.location.href=ed(t.id)}},{id:"delete",icon:e.jsx(Fe,{}),label:n("common.action.delete.label"),danger:!0,onClick:()=>s(t)}]})})]})}function cg({rows:t,reload:a,onOpen:o}){const[s,r]=c.useState(null),[i,l]=c.useState(null),[h,d]=c.useState("");async function m(u){const f=s==="new",b=await X(f?"POST":"PUT",f?"/anthologies":`/anthologies/${s.id}`,u);return b.ok?(r(null),await a(),null):le(b,n("error.save.anthology"))}const p=(t||[]).length;return e.jsxs("section",{children:[e.jsx(Gt,{title:n("nav.tab.anthologies.label"),counts:n("common.count.phrase",{n:p,noun:n("unit.anthology",{count:p})}),right:e.jsx(ge,{icon:e.jsx(tt,{}),onClick:()=>r("new"),children:n("anthologies.list.new.label")})}),e.jsx(ve,{children:h}),e.jsx("div",{className:"board-grid",children:(t||[]).map(u=>e.jsx(lg,{row:u,onOpen:o,onEdit:r,onDelete:l},u.id))}),t!=null&&t.length===0&&e.jsx(bt,{className:"mt-4",children:e.jsx("p",{className:"microcopy",children:Ie("anthologies.list.empty",{em1:e.jsx("b",{children:n("anthologies.list.new.label")},"em1"),em2:e.jsx("b",{children:n("common.action.anthology.label")},"em2")})})}),s&&e.jsx(Ge,{open:!0,title:n(s==="new"?"anthologies.form.new.title":"anthologies.form.edit.title"),onClose:()=>r(null),children:e.jsx(td,{initial:s==="new"?null:s,onSubmit:m,onCancel:()=>r(null),submitLabel:n(s==="new"?"common.action.create.label":"common.action.save.label")})}),i&&e.jsx(nd,{anthology:i,onCancel:()=>l(null),onDone:async()=>{l(null),d(""),await a()}})]})}function Bi(t){return[t.locator,Ca(t.quote_kind)].filter(Boolean).join(" · ")}function dg({entry:t,fields:a={},first:o,last:s,onNote:r,onMove:i,onRemove:l,onOpenBook:h,onOpenMovie:d}){const m=t.work_id&&t.kind==="book"?h:t.work_id&&t.kind==="screen"?d:null;return e.jsx(bt,{className:"mt-3",children:e.jsxs("div",{className:"flex items-start justify-between gap-2",children:[e.jsxs("div",{className:"min-w-0 flex-1",children:[!a.hide_commentary&&t.note&&e.jsx("p",{className:"anthology-prose",children:t.note}),e.jsx("blockquote",{className:"anthology-quote",style:{"--entry-color":a.hide_colour?"var(--line)":bn(t.color)},children:t.quote}),(!a.hide_credit||!a.hide_source)&&e.jsx("p",{className:"microcopy mt-1.5",children:a.hide_source?n("anthologies.entry.credit.label",{credit:t.credit||n("anthologies.entry.unattributed.label")}):a.hide_credit?Ie("anthologies.entry.source.label",{source:m?e.jsx("button",{type:"button",className:"tp-link",onClick:()=>m(t.work_id),children:t.source},"source"):t.source}):Ie(t.source?"anthologies.entry.credit-source.label":"anthologies.entry.credit.label",{credit:t.credit||n("anthologies.entry.unattributed.label"),source:m?e.jsx("button",{type:"button",className:"tp-link",onClick:()=>m(t.work_id),children:t.source},"source"):t.source})}),a.show_locator&&Bi(t)||a.show_date&&t.date?e.jsx("p",{className:"microcopy mt-1 opacity-80",children:[a.show_locator?Bi(t):"",a.show_date?t.date:""].filter(Boolean).join(" · ")}):null,t.quote_note&&e.jsx("p",{className:"microcopy mt-1 opacity-80",children:t.quote_note})]}),e.jsx(It,{ariaLabel:n("anthologies.entry.more.aria"),items:[{id:"note",icon:e.jsx(at,{}),label:n(t.note?"anthologies.entry.note.edit.label":"anthologies.entry.note.add.label"),onClick:()=>r(t)},...o?[]:[{id:"up",icon:e.jsx(uo,{open:!0}),label:n("common.action.move-up.label"),onClick:()=>i(t,"up")}],...s?[]:[{id:"down",icon:e.jsx(uo,{}),label:n("common.action.move-down.label"),onClick:()=>i(t,"down")}],{id:"remove",icon:e.jsx(Fe,{}),label:n("common.action.remove.label"),danger:!0,onClick:()=>l(t)}]})]})})}function hg({id:t,onClose:a,onDeleted:o,onOpenBook:s,onOpenMovie:r}){const[i,l]=c.useState(null),[h,d]=c.useState(null),[m,p]=c.useState(""),[u,f]=c.useState(!1),[b,y]=c.useState(!1),[v,g]=c.useState(null),{practise:w,practiceDialog:k}=qa(),S=c.useCallback(async()=>{const E=await X("GET",`/anthologies/${t}`);if(!E.ok)return p(le(E,n("error.open.anthology")));l(E.data.anthology||null),d(E.data.entries||[]),p("")},[t]);c.useEffect(()=>{S()},[S]);async function N(E){const O=await X("PUT",`/anthologies/${t}`,E);return O.ok?(f(!1),await S(),null):le(O,n("error.save.anthology"))}async function j(E,O){const _=await X("PUT",`/anthologies/${t}/entries`,{...Xo(E),note:O});return _.ok?(g(null),await S(),null):le(_,n("error.save.note"))}async function x(E){const O=await X("DELETE",`/anthologies/${t}/entries/${E.kind}/${E.item_id}`);if(!O.ok)return p(le(O,n("error.remove.entry")));Se(n("anthologies.toast.entry-removed")),await S()}async function M(E,O){const _=h||[],T=_.findIndex(V=>og(V,E));if(T<0)return;const B=O==="up"?_[T-2]||null:_[T+1];if(O==="up"&&T===0||O==="down"&&!B)return;const L=await X("POST",`/anthologies/${t}/order`,{...Xo(E),after:B?Xo(B):null});if(!L.ok)return p(le(L,n("error.move.entry")));await S()}const q=h||[];return e.jsxs("section",{className:"anthology-read",children:[e.jsx("div",{className:"mb-3",children:e.jsx(ge,{icon:e.jsx(Zt,{}),onClick:a,children:n("anthologies.read.back.label")})}),e.jsx(Gt,{title:(i==null?void 0:i.title)||n("anthologies.read.title.fallback"),counts:h?n("common.count.phrase",{n:q.length,noun:n("unit.entry",{count:q.length})}):"",right:e.jsxs("span",{className:"flex items-center gap-2",children:[e.jsx(ge,{icon:e.jsx(Ct,{}),onClick:()=>w({anthology:t,label:(i==null?void 0:i.title)||n("anthologies.read.title.fallback")}),disabled:!i||q.length===0,children:n("common.action.practise.label")}),e.jsx(ge,{icon:e.jsx(at,{}),onClick:()=>f(!0),disabled:!i,children:n("common.action.edit.label")}),e.jsx(ge,{icon:e.jsx(rt,{}),onClick:()=>{window.location.href=ed(t)},children:n("common.action.export.label")}),e.jsx(ge,{icon:e.jsx(Fe,{}),onClick:()=>y(!0),disabled:!i,children:n("common.action.delete.label")})]})}),e.jsx(ve,{children:m}),(i==null?void 0:i.intro)&&e.jsx(bt,{className:"mt-2",children:e.jsx("p",{className:"anthology-prose",children:i.intro})}),q.map((E,O)=>e.jsx(dg,{entry:E,fields:i||{},first:O===0,last:O===q.length-1,onNote:g,onMove:M,onRemove:x,onOpenBook:s,onOpenMovie:r},`${E.kind}:${E.item_id}`)),h!=null&&q.length===0&&e.jsx(bt,{className:"mt-3",children:e.jsx("p",{className:"microcopy",children:Ie("anthologies.read.empty",{em1:e.jsx("b",{children:n("common.action.anthology.label")},"em1")})})}),u&&i&&e.jsx(Ge,{open:!0,title:n("anthologies.form.edit.title"),onClose:()=>f(!1),children:e.jsx(td,{initial:i,onSubmit:N,onCancel:()=>f(!1),submitLabel:n("common.action.save.label")})}),v&&e.jsx(ig,{entry:v,onSave:j,onCancel:()=>g(null)}),k,b&&i&&e.jsx(nd,{anthology:i,onCancel:()=>y(!1),onDone:async()=>{y(!1),await o()}})]})}function ug({count:t,busy:a,onApply:o,onClose:s}){const{rows:r,error:i}=Zc(),l=r||[],[h,d]=c.useState(""),m=h===""?null:Number(h);return e.jsx(Ge,{open:!0,onClose:s,title:n("common.anthology.add.title",{count:t,n:t}),children:e.jsxs("div",{className:"space-y-3",children:[e.jsx("p",{className:"microcopy",children:n("common.anthology.add.body",{count:t,n:t})}),r!=null&&l.length===0?e.jsx(ve,{children:n("common.anthology.add.empty")}):e.jsx(Oe,{label:n("common.field.anthology.label"),value:h,onChange:d,options:l.map(p=>[String(p.id),p.title]),placeholder:n("common.anthology.add.select.placeholder")}),e.jsx(ve,{children:i}),e.jsx(ge,{icon:e.jsx(Qs,{}),onClick:()=>o(m),disabled:a||m==null,children:n("common.action.add.label")})]})})}function mg({openId:t=null,onOpen:a,onClose:o,onOpenBook:s,onOpenMovie:r}){const{rows:i,error:l,reload:h}=Zc();return t==null?e.jsxs(e.Fragment,{children:[e.jsx(ve,{children:l}),e.jsx(cg,{rows:i,reload:h,onOpen:a})]}):e.jsx(hg,{id:t,onClose:o,onDeleted:async()=>{await h(),o==null||o()},onOpenBook:s,onOpenMovie:r},String(t))}const fr=[{name:"English",glyphs:["A","a","E","W"]},{name:"Mandarin",glyphs:["字","文","中","話"]},{name:"Hindi",glyphs:["अ","क","ह","न"]},{name:"Spanish",glyphs:["ñ","Ñ","á","¡"]},{name:"French",glyphs:["É","é","à","ç"]},{name:"Arabic",glyphs:["ع","ض","ا","ق"]},{name:"Bengali",glyphs:["অ","আ","ক","ব"]},{name:"Portuguese",glyphs:["ã","Ã","ç","õ"]},{name:"Russian",glyphs:["Ж","Я","Д","Б"]},{name:"Urdu",glyphs:["ی","ے","ں","ھ"]}].map(t=>({...t,glyph:t.glyphs[0]})),pg=4,Fi=8,ad=40,Pt=t=>String(t||"").trim().toLowerCase(),Ja=t=>[...String(t||"")].length,Ua=t=>String(t||"").replace(/[\u0000-\u001F\u007F]/g,"").trim();let Tt={};function od(t){if(typeof t=="string"){const r=Ua(t);return r?{mark:r,customs:[],name:""}:null}if(!t||typeof t!="object"||Array.isArray(t))return null;const a=Ua(t.m),o=Ua(t.n),s=[];for(const r of Array.isArray(t.c)?t.c:[]){const i=Ua(r);if(i&&Ja(i)<=Fi&&!s.includes(i)&&s.push(i),s.length>=pg)break}return!a&&!o&&s.length===0?null:{mark:Ja(a)<=Fi?a:"",customs:s,name:Ja(o)<=ad?o:""}}function fg(t){Tt={};const a=String((t==null?void 0:t.languageMarks)||"").trim();if(a)try{const o=JSON.parse(a);if(o&&typeof o=="object"&&!Array.isArray(o))for(const[s,r]of Object.entries(o)){const i=Pt(s),l=od(r);i&&l&&(Tt[i]=l)}}catch{Tt={}}}const gr=t=>fr.find(a=>Pt(a.name)===t);function Vw(t=[]){const a=new Map;for(const o of fr)a.set(Pt(o.name),o.name);for(const o of[...Object.keys(Tt),...t.map(Pt)])o&&!a.has(o)&&a.set(o,o);return[...a.entries()].map(([o,s])=>{const r=Tt[o]||{mark:"",customs:[],name:""},i=gr(o);return{key:o,canonical:s,name:r.name||s,renamed:!!r.name,glyph:(i==null?void 0:i.glyph)||"",glyphs:(i==null?void 0:i.glyphs)||[],mark:r.mark,customs:r.customs,added:!i,resolved:r.mark||(i==null?void 0:i.glyph)||""}})}function Yw(t){const a={};for(const[o,s]of Object.entries(t||{})){const r=Pt(o);if(!r||Ja(r)>ad)continue;const i=od(typeof s=="string"?s:{m:s==null?void 0:s.mark,c:s==null?void 0:s.customs,n:s==null?void 0:s.name});if(!i)continue;const l={};i.mark&&(l.m=i.mark),i.customs.length&&(l.c=i.customs),i.name&&(!gr(r)||Pt(i.name)!==r)&&(l.n=i.name),Object.keys(l).length&&(a[r]=l)}return Object.keys(a).length?JSON.stringify(a):""}const Qw=()=>{const t={};for(const[a,o]of Object.entries(Tt))t[a]={mark:o.mark,customs:[...o.customs],name:o.name};return t};function br(t=[]){const a=Array.isArray(t)?t:[t];for(const o of a){const s=gr(Pt(o));if(s)return s.glyph}return""}function gg(t=[]){var o;const a=Array.isArray(t)?t:[t];for(const s of a){const r=Pt(s);if(r&&(o=Tt[r])!=null&&o.mark)return Tt[r].mark}return br(a)}function bg(t=[]){var o;const a=Array.isArray(t)?t:[t];for(const s of a){const r=Pt(s);if(r)return(o=Tt[r])!=null&&o.name?Tt[r].name:String(s).trim()}return""}function yg({languages:t,size:a=20,ring:o="var(--card)",className:s=""}){const r=gg(t);if(!r)return null;const i=bg(t);return e.jsx("span",{className:s,title:i,"aria-label":i?n("common.language-mark.aria",{name:i}):void 0,style:{display:"inline-flex",alignItems:"center",justifyContent:"center",width:a,height:a,borderRadius:"50%",background:"var(--raised)",border:"1px solid var(--ink-border)",boxShadow:`0 0 0 1.5px ${o}`,fontSize:Math.round(a*.58),lineHeight:1,verticalAlign:"middle",flex:"none",fontFamily:"var(--font-ui)",fontWeight:"var(--font-ui-weight)",fontStyle:"var(--font-ui-style)",fontVariantCaps:"var(--font-ui-caps)",textTransform:"var(--font-ui-case)",fontVariantNumeric:"var(--font-ui-figures)"},children:r})}const wg=["yellow","blue","pink","orange","green","purple"],vg=[{key:"proverbs",get name(){return n("quotes.starter.proverbs.name")},color:"green",kind:"proverb",get description(){return n("quotes.starter.proverbs.description")}},{key:"speeches",get name(){return n("quotes.starter.speeches.name")},color:"blue",kind:"speech",get description(){return n("quotes.starter.speeches.description")}},{key:"others",get name(){return n("quotes.starter.others.name")},color:"yellow",kind:"plain",get description(){return n("quotes.starter.others.description")}}],sd="all";function rd(){const[t,a]=c.useState(null),[o,s]=c.useState(0),[r,i]=c.useState(""),l=c.useCallback(async()=>{const h=await X("GET","/boards");if(!h.ok)return i(le(h));a(h.data.boards||[]),s(h.data.total||0),i("")},[]);return c.useEffect(()=>{l()},[l]),{boards:t,total:o,error:r,reload:l}}function kg({board:t}){const a=t.kind==="proverb"?br(t.languages||[]):"",o="board-tile-img is-empty board-cover board-cover-"+(t.kind||"plain");return t.kind==="speech"?e.jsx("span",{className:o,"aria-hidden":"true",children:e.jsxs("svg",{viewBox:"0 0 90 60",className:"board-cover-art",role:"presentation",focusable:"false",children:[e.jsx("rect",{x:"14",y:"12",width:"10",height:"19",rx:"5",fill:"currentColor"}),e.jsx("path",{d:"M9.5 26.5a9.5 9.5 0 0 0 19 0",fill:"none",stroke:"currentColor",strokeWidth:"2.4",strokeLinecap:"round"}),e.jsx("path",{d:"M19 36v9",fill:"none",stroke:"currentColor",strokeWidth:"2.4",strokeLinecap:"round"}),e.jsx("path",{d:"M12.5 45.5h13",fill:"none",stroke:"currentColor",strokeWidth:"2.4",strokeLinecap:"round"}),e.jsxs("g",{fill:"currentColor",opacity:"0.45",children:[e.jsx("circle",{cx:"49",cy:"30",r:"3.6"}),e.jsx("path",{d:"M43 45c0-3.6 2.7-6.3 6-6.3s6 2.7 6 6.3z"}),e.jsx("circle",{cx:"63",cy:"29",r:"3.4"}),e.jsx("path",{d:"M57.4 45c0-3.4 2.5-6 5.6-6s5.6 2.6 5.6 6z"}),e.jsx("circle",{cx:"76",cy:"30",r:"3.2"}),e.jsx("path",{d:"M70.8 45c0-3.2 2.3-5.7 5.2-5.7s5.2 2.5 5.2 5.7z"})]}),e.jsxs("g",{fill:"currentColor",opacity:"0.85",children:[e.jsx("circle",{cx:"56",cy:"38",r:"4.2"}),e.jsx("path",{d:"M49 55c0-4 3.1-7.2 7-7.2s7 3.2 7 7.2z"}),e.jsx("circle",{cx:"70.5",cy:"38.5",r:"4"}),e.jsx("path",{d:"M64 55c0-3.8 2.9-6.8 6.5-6.8s6.5 3 6.5 6.8z"})]})]})}):a?e.jsx("span",{className:o,"aria-hidden":"true",children:e.jsx("span",{className:"board-cover-glyph",children:a})}):e.jsx("span",{className:o,"aria-hidden":"true",children:e.jsx(Gs,{})})}function id({count:t,busy:a,currentBoardID:o=null,onApply:s,onClose:r}){const{boards:i}=rd(),l=i||[],[h,d]=c.useState(o==null?"":String(o)),m=h===""?null:Number(h);return e.jsx(Ge,{open:!0,onClose:r,title:n("common.board.move.title",{count:t,n:t}),children:e.jsxs("div",{className:"space-y-3",children:[e.jsx("p",{className:"microcopy",children:n("common.board.move.body",{count:t,n:t})}),l.length===0?e.jsx(ve,{children:n("common.board.move.empty")}):e.jsx(Oe,{label:n("common.field.board.label"),value:h,onChange:d,options:l.map(p=>[String(p.id),p.name]),placeholder:n("common.board.move.select.placeholder")}),e.jsx(ge,{onClick:()=>s(m),disabled:a||m==null||m===o,children:n("common.action.move.label")})]})})}function xg({initial:t,onSubmit:a,onCancel:o,submitLabel:s=n("common.action.save.label"),existingNames:r=[]}){const[i,l]=c.useState((t==null?void 0:t.name)||""),[h,d]=c.useState((t==null?void 0:t.description)||""),[m,p]=c.useState((t==null?void 0:t.color)||"yellow"),[u,f]=c.useState((t==null?void 0:t.image_path)||""),[b,y]=c.useState((t==null?void 0:t.kind)||"plain"),[v,g]=c.useState((t==null?void 0:t.languages)||[]),[w,k]=c.useState(""),[S,N]=c.useState(""),[j,x]=c.useState(!1),M=new Set(r.map(L=>L.trim().toLowerCase())),q=i.trim()!==""&&i.trim().toLowerCase()!==((t==null?void 0:t.name)||"").toLowerCase()&&M.has(i.trim().toLowerCase());function E(L){l(L.name),p(L.color),y(L.kind),d(V=>V.trim()?V:L.description)}function O(L){g(V=>V.some(P=>P.toLowerCase()===L.toLowerCase())?V.filter(P=>P.toLowerCase()!==L.toLowerCase()):[...V,L])}function _(){const L=w.trim();L&&(v.some(V=>V.toLowerCase()===L.toLowerCase())||g([...v,L]),k(""))}async function T(L){var H,R,I;const V=(H=L.target.files)==null?void 0:H[0];if(!V||!(t!=null&&t.id))return;x(!0);const P=new FormData;P.append("file",V);const C=await fl(`/boards/${t.id}/cover`,P);if(x(!1),!C.ok)return N(le(C,n("error.upload.generic")));f(((R=C.data)==null?void 0:R.image_path)||((I=C.data)==null?void 0:I.path)||u),Se(n("quotes.board.toast.picture-saved"))}async function B(L){if(L.preventDefault(),!i.trim())return N(n("error.validate.board-name-required"));x(!0);const V=await a({name:i.trim(),description:h,color:m,image_path:u,kind:b,languages:v});x(!1),V&&N(V)}return e.jsxs("form",{onSubmit:B,className:"space-y-4",children:[e.jsx(xe,{label:n("common.field.name.label"),value:i,placeholder:n("quotes.board.form.name.placeholder"),onChange:L=>l(L.target.value)}),q&&e.jsx("p",{className:"microcopy",children:n("quotes.board.form.clash.error")}),e.jsxs("div",{children:[e.jsx($,{className:"mb-1.5 block",children:n("quotes.board.form.kind.label")}),t!=null&&t.id?e.jsx(Ye,{ariaLabel:n("quotes.board.form.kind.aria"),value:b,onChange:y,options:[["plain",n("quotes.board.kind.plain.label")],["proverb",n("quotes.board.kind.proverb.label")]]}):e.jsxs(e.Fragment,{children:[e.jsx("div",{className:"flex flex-wrap items-center gap-2",children:vg.map(L=>e.jsxs("button",{type:"button","aria-pressed":i.trim().toLowerCase()===L.name.toLowerCase(),onClick:()=>E(L),className:"tp-filter-chip tactile"+(i.trim().toLowerCase()===L.name.toLowerCase()?" active":""),children:[L.name,M.has(L.name.toLowerCase())?" ✓":""]},L.key))}),e.jsx("p",{className:"microcopy mt-1.5",children:n("quotes.board.form.starters.hint")})]})]}),b==="proverb"&&e.jsxs("div",{children:[e.jsx($,{className:"mb-1.5 block",children:n("quotes.board.form.languages.label")}),e.jsx("div",{className:"flex flex-wrap items-center gap-2",children:[...new Set([...fr.map(L=>L.name),...v])].map(L=>{const V=v.some(C=>C.toLowerCase()===L.toLowerCase()),P=br([L]);return e.jsxs("button",{type:"button","aria-pressed":V,onClick:()=>O(L),className:"tp-filter-chip tactile"+(V?" active":""),children:[P&&e.jsx("span",{"aria-hidden":"true",style:{marginRight:5,opacity:.75},children:P}),L]},L)})}),e.jsxs("div",{className:"flex items-end gap-2 mt-2",children:[e.jsx(xe,{label:n("quotes.board.form.language.label"),value:w,placeholder:n("quotes.board.form.language.placeholder"),onChange:L=>k(L.target.value),onKeyDown:L=>{L.key==="Enter"&&(L.preventDefault(),_())}}),e.jsx(ge,{type:"button",onClick:_,children:n("common.action.add.label")})]}),e.jsx("p",{className:"microcopy mt-1.5",children:n("quotes.board.form.languages.hint")})]}),e.jsxs("div",{children:[e.jsx($,{className:"mb-1.5 block",children:n("quotes.board.form.colour.label")}),e.jsx("div",{className:"flex flex-wrap items-center gap-2",children:wg.map(L=>e.jsx("button",{type:"button","aria-label":L,"aria-pressed":m===L,onClick:()=>p(L),className:"board-swatch"+(m===L?" is-on":""),style:{background:bn(L)}},L))})]}),e.jsxs("label",{className:"tp-field",children:[e.jsx($,{children:n("quotes.board.form.description.label")}),e.jsx("textarea",{className:"tp-input",rows:2,value:h,placeholder:n("quotes.board.form.description.placeholder"),onChange:L=>d(L.target.value)})]}),t!=null&&t.id?e.jsxs("div",{className:"flex items-center gap-3",children:[u?e.jsx("img",{src:$e(u),alt:"",className:"board-form-img"}):e.jsx("span",{className:"board-form-img is-empty","aria-hidden":"true"}),e.jsxs("label",{className:"tp-btn tp-btn-ghost tactile",style:{cursor:"pointer"},children:[e.jsx(la,{}),e.jsx("span",{className:"btn-label",children:n("quotes.board.form.picture.label")}),e.jsx("input",{type:"file",accept:"image/*",className:"hidden",onChange:T,disabled:j})]}),u&&e.jsx(ge,{type:"button",onClick:()=>f(""),children:n("common.action.remove.label")})]}):null,e.jsx(ve,{children:S}),e.jsxs("div",{className:"flex items-center justify-end gap-2",children:[e.jsx(ge,{type:"button",onClick:o,children:n("common.action.cancel.label")}),e.jsx("button",{type:"submit",className:"tp-btn tp-btn-primary tactile",disabled:j,children:j?n("common.action.save.busy"):s})]})]})}function jg({board:t,boards:a,onDone:o,onCancel:s}){var u;const r=(a||[]).filter(f=>f.id!==t.id),[i,l]=c.useState((u=r[0])!=null&&u.id?String(r[0].id):""),[h,d]=c.useState(""),m=t.quotes>0;if(m&&r.length===0)return e.jsx(vt,{open:!0,title:n("quotes.board.delete.confirm.title",{name:t.name}),confirmLabel:n("common.action.delete.label"),confirmDisabled:!0,onCancel:s,body:e.jsx("p",{children:n("quotes.board.delete.only.body",{count:t.quotes,n:t.quotes,noun:n("unit.quote",{count:t.quotes})})})});async function p(){const f=m?{move_to:Number(i)}:{},b=await X("DELETE",`/boards/${t.id}`,f);if(!b.ok)return d(le(b,n("error.delete.board")));Se(n("quotes.board.toast.deleted")),await o()}return e.jsx(vt,{open:!0,title:n("quotes.board.delete.confirm.title",{name:t.name}),confirmLabel:n("common.action.delete.label"),onConfirm:p,onCancel:s,body:e.jsxs("div",{className:"space-y-3",children:[m?e.jsxs(e.Fragment,{children:[e.jsx("p",{children:n("quotes.board.delete.holds.body",{count:t.quotes,n:t.quotes})}),e.jsx(Oe,{ariaLabel:n("quotes.board.delete.move.aria"),value:i,onChange:l,options:r.map(f=>[String(f.id),f.name])})]}):e.jsx("p",{children:n("quotes.board.delete.empty.body")}),e.jsx(ve,{children:h})]})})}function Sg({board:t,onOpen:a,onEdit:o,onDelete:s,onToggleHidden:r}){return e.jsxs("div",{className:"board-tile"+(t.hidden?" is-hidden-board":""),style:{"--board-color":bn(t.color)},children:[e.jsxs("button",{type:"button",className:"board-tile-face",onClick:()=>a(t.id),children:[t.image_path?e.jsx("img",{src:$e(t.image_path),alt:"",className:"board-tile-img"}):e.jsx(kg,{board:t}),e.jsx("span",{className:"board-tile-name",children:t.name}),e.jsx("span",{className:"board-tile-count",children:n("common.count.phrase",{n:t.quotes,noun:n("unit.quote",{count:t.quotes})})})]}),e.jsx("span",{className:"board-tile-tools",children:e.jsx(It,{items:[{icon:e.jsx(at,{}),label:n("common.action.edit.label"),onClick:()=>o(t)},{icon:t.hidden?e.jsx(Ru,{}):e.jsx(Du,{}),label:n(t.hidden?"common.action.show.label":"common.action.hide.label"),onClick:()=>r(t)},{icon:e.jsx(Fe,{}),label:n("common.action.delete.label"),danger:!0,onClick:()=>s(t)}]})})]})}function Ng({boards:t,total:a,reload:o,onOpen:s}){const[r,i]=c.useState(!1),[l,h]=c.useState(null),[d,m]=c.useState(null),[p,u]=c.useState(""),f=(t||[]).filter(g=>r||!g.hidden),b=(t||[]).filter(g=>g.hidden).length;async function y(g){const w=l==="new",k=await X(w?"POST":"PUT",w?"/boards":`/boards/${l.id}`,g);return k.ok?(h(null),await o(),null):le(k,n("error.save.board"))}async function v(g){const w=await X("PUT",`/boards/${g.id}`,{name:g.name,description:g.description,color:g.color,image_path:g.image_path,hidden:!g.hidden,kind:g.kind,languages:g.languages});if(!w.ok)return u(le(w));await o()}return e.jsxs("section",{children:[e.jsx(Gt,{title:n("nav.tab.quotes.label"),counts:n("common.count.phrase",{n:(t||[]).length,noun:n("unit.board",{count:(t||[]).length})}),right:e.jsxs("span",{className:"flex items-center gap-2",children:[b>0&&e.jsx(Ye,{ariaLabel:n("quotes.board.hidden.aria"),value:r?"on":"off",onChange:g=>i(g==="on"),options:[["off",n("quotes.board.hidden.inuse.label")],["on",n("quotes.board.hidden.all.label",{n:(t||[]).length})]]}),e.jsx(ge,{icon:e.jsx(tt,{}),onClick:()=>h("new"),children:n("quotes.board.new.label")})]})}),e.jsx(ve,{children:p}),e.jsxs("div",{className:"board-grid",children:[e.jsxs("button",{type:"button",className:"board-tile board-tile-all",onClick:()=>s(sd),children:[e.jsx("span",{className:"board-tile-name",children:n("quotes.board.all.label")}),e.jsx("span",{className:"board-tile-count",children:n("common.count.phrase",{n:a,noun:n("unit.quote",{count:a})})})]}),f.map(g=>e.jsx(Sg,{board:g,onOpen:s,onEdit:h,onDelete:m,onToggleHidden:v},g.id))]}),t!=null&&t.length===0&&e.jsx(bt,{className:"mt-4",children:e.jsx("p",{className:"microcopy",children:Ie("quotes.board.list.empty",{em1:e.jsx("b",{children:n("quotes.board.new.label")},"em1")})})}),l&&e.jsx(Ge,{open:!0,title:n(l==="new"?"quotes.board.form.new.title":"quotes.board.form.edit.title"),onClose:()=>h(null),children:e.jsx(xg,{initial:l==="new"?null:l,onSubmit:y,onCancel:()=>h(null),submitLabel:n(l==="new"?"common.action.create.label":"common.action.save.label"),existingNames:(t||[]).map(g=>g.name)})}),d&&e.jsx(jg,{board:d,boards:t,onCancel:()=>m(null),onDone:async()=>{m(null),await o()}})]})}const Tg=60,ld=24;function Xt(t,a,o=Tg){const[s,r]=c.useState(o),i=c.useRef(null);c.useEffect(()=>{r(o)},[a,o]);const l=s<t;return c.useEffect(()=>{if(!l)return;if(typeof IntersectionObserver!="function"){r(t);return}const h=i.current;if(!h)return;const d=new IntersectionObserver(m=>{m.some(p=>p.isIntersecting)&&r(p=>Math.min(t,p+o))},{rootMargin:"600px"});return d.observe(h),()=>d.disconnect()},[l,t,o]),{count:Math.min(s,t),more:l,sentinel:i}}const dt={book:"reading",movie:"watching",show:"watching",game:"playing"},qn={book:5,movie:2,show:5,game:3};function cd(t,a={}){return dt[Pn(t,a)]}function ya(t,a){return a.status===cd(t,a)}function Eg(t,a){return a.status?a.status:(t==="book"?a.annotation_count||0:a.dialogue_count||0)===0?"wishlist":null}function Pn(t,a){if(t==="book")return"book";const o=a.media_type||"movie";return o==="show"?"show":o==="game"?"game":"movie"}function dd(t){return n(t==="game"?"common.field.studio.label":t==="show"?"common.field.creator.label":"common.field.director.label")}function Cg(t){return n(t==="game"?"common.badge.studio":t==="show"?"common.badge.created-by":"common.badge.director")}function Ag(t){return t==="game"?"studio":"director"}function qg(t){return t?Math.floor(t/10)*10:null}function yr(t,a,o={}){const{credit:s=()=>"",year:r=()=>null,genres:i=()=>[],series:l=g=>g.series,facet:h=()=>"",splitCredit:d=!1,seps:m,creditResidual:p=n("common.group.unknown-credit.label"),facetResidual:u=()=>n("common.group.none.label"),sortMembers:f}=o,b=new Map,y=(g,w,k,S={})=>{let N=b.get(g);N||(N={key:g,label:w,items:[],residual:!!S.residual,order:S.order},b.set(g,N)),N.items.push(k)};for(const g of t)if(a==="series"){const w=l(g);w?y(w,w,g):y("~none",n("common.group.no-series.label"),g,{residual:!0})}else if(a==="author"){const w=s(g),k=d?Je(w,m):w?[w]:[];k.length?k.forEach(S=>y(S,S,g)):y("~none",p,g,{residual:!0})}else if(a==="decade"){const w=qg(r(g));w!=null?y(String(w),n("common.group.decade.label",{year:w}),g,{order:w}):y("~none",n("common.group.unknown-year.label"),g,{residual:!0})}else if(a==="genre"){const w=i(g);w.length?w.forEach(k=>y(k,k,g)):y("~none",n("common.group.no-genre.label"),g,{residual:!0})}else{const w=h(g,a);w?y(w,w,g):y("~none",u(a),g,{residual:!0})}const v=[...b.values()];if(v.sort((g,w)=>g.residual!==w.residual?g.residual?1:-1:a==="decade"?(w.order??0)-(g.order??0):a==="genre"&&w.items.length-g.items.length||g.label.localeCompare(w.label)),f)for(const g of v)g.residual||(g.items=f(g.items,a));return v}function hd(t,a,o){return a==="wishlist"?t.filter(s=>o(s)===0):a==="annotated"?t.filter(s=>o(s)>0):t}function ud(t,a){const o=t.filter(s=>ya(a,s));return o.length===0||o.length===t.length?t:[...o,...t.filter(s=>!ya(a,s))]}function md(t,a){return!a||a.length===0?t:t.filter(o=>a.includes(o.status||"none"))}function pd({open:t,items:a,cap:o,noun:s,nounPlural:r=`${s}s`,verb:i,pastLabel:l,onRelease:h,onProceed:d,onCancel:m,busyId:p,error:u}){return e.jsx(vt,{open:t,title:n("common.work.cap.confirm.title",{verb:i,n:a.length}),confirmLabel:n("common.work.cap.confirm.action.label"),onCancel:m,onConfirm:d,body:e.jsxs(e.Fragment,{children:[e.jsx("p",{children:n("common.work.cap.confirm.body",{n:o,count:o,noun:o===1?s:r})}),e.jsx("ul",{className:"mt-3 space-y-1",children:a.map(f=>e.jsxs("li",{className:"flex items-center gap-3",children:[e.jsxs("span",{className:"min-w-0 flex-1",children:[e.jsx("span",{className:"block truncate",style:{color:"var(--ink)"},children:f.title}),f.meta&&e.jsx("span",{className:"block truncate",style:{fontSize:"var(--type-ui-13)",color:"var(--faint)"},children:f.meta})]}),e.jsx("button",{type:"button",className:"tp-chip tp-chip-btn shrink-0",disabled:p===f.id,onClick:()=>h(f),children:p===f.id?n("common.action.save.busy"):l})]},f.id))}),e.jsx(ve,{children:u})]})})}function fd({open:t,title:a,label:o,value:s,onChange:r,onConfirm:i,onCancel:l,confirmLabel:h,error:d}){return e.jsx(vt,{open:t,title:a,confirmLabel:h||n("common.action.save.label"),onCancel:l,onConfirm:i,body:e.jsxs(e.Fragment,{children:[e.jsx(ma,{label:o,value:s,onChange:r,hint:n("common.work.shelf-date.hint")}),e.jsx(ve,{children:d})]})})}function Mg(t,a={}){return t==="book"?"page":(a.media_type||"movie")==="show"?"episode":""}function Hi(t,a){const o=Math.max(2,String(a).length);return`${String(t).padStart(o,"0")}/${String(a).padStart(o,"0")}`}function Og(t){if(!t||!t.pos_unit||!t.pos_total)return"";if(t.pos_unit==="episode"){const a=n("common.position.episode.label",{a:Hi(t.pos||0,t.pos_total)});return t.season_total?n("common.position.episode-season.label",{a,b:Hi(t.season||1,t.season_total)}):a}return n("common.position.page.label",{a:t.pos||0,b:t.pos_total})}function Lg({kind:t,status:a,progress:o=0,pos:s}){const r=Og(s);return e.jsxs("span",{style:{display:"block",minWidth:168,maxWidth:260},children:[e.jsx(Ps,{state:a,kind:t,progress:o,radius:3}),e.jsx("span",{style:{display:"block",marginTop:3,fontFamily:"var(--font-mono)",fontWeight:"var(--font-mono-weight)",fontStyle:"var(--font-mono-style)",fontVariantCaps:"var(--font-mono-caps)",textTransform:"var(--font-mono-case)",fontVariantNumeric:"var(--font-mono-figures)",fontSize:"var(--type-mono-11)",letterSpacing:".06em",color:"var(--faint)"},children:r||`${o}%`})]})}function _g({kind:t,unit:a,status:o,progress:s,pos:r,busy:i,onSave:l}){const h=(r==null?void 0:r.pos_unit)===a&&a!=="",[d,m]=c.useState(h?"unit":"pct"),[p,u]=c.useState(String(s||0)),[f,b]=c.useState(String((r==null?void 0:r.pos)||"")),[y,v]=c.useState(String((r==null?void 0:r.pos_total)||"")),[g,w]=c.useState(String((r==null?void 0:r.season)||"")),[k,S]=c.useState(String((r==null?void 0:r.season_total)||"")),N=_=>Math.max(0,Number(_||0)),j=(_,T=5)=>_.replace(/\D/g,"").slice(0,T),x=a==="episode",M=d==="unit"&&N(f)>0&&N(y)===0,q=d==="unit"&&N(y)>0?Math.round((x&&N(k)>0?(Math.max(1,N(g))-1+N(f)/N(y))/N(k):N(f)/N(y))*100):Math.min(100,N(p)),E=()=>{if(d==="pct")return l({progress:Math.min(100,N(p))});M||l({pos_unit:a,pos:N(f),pos_total:N(y),...x?{season:N(g),season_total:N(k)}:{}})},O=(_,T,B,L)=>e.jsxs("label",{style:{display:"inline-flex",alignItems:"center",gap:5},children:[e.jsx("span",{style:{fontSize:"var(--type-ui-13)",color:"var(--soft)"},children:_}),e.jsx("input",{className:"tp-input",inputMode:"numeric",style:{width:58},"aria-label":_,value:T,onChange:V=>B(j(V.target.value,L))})]});return e.jsxs("div",{style:{padding:"4px 6px 8px"},children:[e.jsx($,{className:"mb-1.5 block",children:n("common.progress.editor.title")}),a!==""&&e.jsx("div",{className:"mb-2",children:e.jsx(Ye,{ariaLabel:n("common.progress.unit.aria"),value:d,onChange:m,options:[["pct",n("common.progress.unit.percent.label")],["unit",n(x?"common.progress.unit.episodes.label":"common.progress.unit.pages.label")]]})}),d==="pct"?e.jsx("div",{className:"flex items-center gap-2",children:O(n("common.progress.unit.percent.label"),p,u,3)}):e.jsxs("div",{className:"flex flex-wrap items-center gap-x-3 gap-y-2",children:[x&&O(n("common.progress.field.season.label"),g,w,3),x&&O(n("common.progress.field.of.label"),k,S,3),O(n(x?"common.progress.field.episode.label":"common.progress.field.page.label"),f,b,5),O(n("common.progress.field.of.label"),y,v,5)]}),M&&e.jsx("span",{style:{display:"block",marginTop:5,fontSize:"var(--type-ui-12)",color:"var(--error)"},children:n(x?"error.validate.episodes-total":"error.validate.pages-total")}),e.jsxs("div",{className:"mt-2 flex items-center gap-2",children:[e.jsx("span",{className:"flex-1",children:e.jsx(Ps,{state:o,kind:t,progress:q,radius:3})}),e.jsxs("span",{style:{fontFamily:"var(--font-mono)",fontWeight:"var(--font-mono-weight)",fontStyle:"var(--font-mono-style)",fontVariantCaps:"var(--font-mono-caps)",textTransform:"var(--font-mono-case)",fontVariantNumeric:"var(--font-mono-figures)",fontSize:"var(--type-mono-11)",color:"var(--faint)"},children:[q,"%"]}),e.jsx("button",{type:"button",className:"tp-chip tp-chip-btn",disabled:i||M,onClick:E,children:n("common.action.set.label")})]})]})}function Rg({kind:t,workId:a,reads:o=[],onChanged:s}){const[r,i]=c.useState(null),[l,h]=c.useState(!1),[d,m]=c.useState(""),p=t==="movie"?"movies":"books";async function u(f,b,y){h(!0),m("");const v=await X(f,b,y);return h(!1),v.ok?(i(null),s==null||s(),!0):(m(le(v,n(t==="movie"?"error.save.watch":"error.save.read"))),!1)}return e.jsxs("div",{className:"read-log-wrap",children:[e.jsx("ul",{className:"read-log",children:o.map((f,b)=>e.jsxs("li",{children:[e.jsx("span",{className:"read-n",children:b+1}),r===f.id?e.jsx(zi,{initial:f,busy:l,onCancel:()=>i(null),onSave:y=>u("PUT",`/reads/${f.id}`,y),onDelete:()=>u("DELETE",`/reads/${f.id}`)}):e.jsxs(e.Fragment,{children:[e.jsxs("span",{children:[f.outcome==="open"?n("common.read-log.range.open.label",{a:sn(f.started_at)||n("common.read-log.unknown.label")}):n("common.read-log.range.label",{a:sn(f.started_at)||n("common.read-log.unknown.label"),b:sn(f.finished_at)||n("common.read-log.unknown.label")}),f.outcome==="abandoned"&&e.jsx("span",{className:"read-open",children:n("common.read-log.abandoned.label")})]}),f.outcome==="open"?e.jsx("span",{className:"read-hint",children:n("common.read-log.open.hint")}):e.jsx("button",{type:"button",className:"read-edit",onClick:()=>i(f.id),children:n("common.read-log.edit.label")})]})]},f.id??b))}),r==="new"?e.jsx(zi,{initial:{started_at:"",finished_at:"",outcome:"finished"},busy:l,onCancel:()=>i(null),onSave:f=>u("POST",`/${p}/${a}/reads`,f)}):e.jsx("button",{type:"button",className:"read-add",onClick:()=>i("new"),children:n(t==="movie"?"common.read-log.add.film.label":"common.read-log.add.book.label")}),d&&e.jsx("p",{className:"tp-error",children:d})]})}function zi({initial:t,busy:a,onCancel:o,onSave:s,onDelete:r}){const[i,l]=c.useState(t.started_at||""),[h,d]=c.useState(t.finished_at||""),[m,p]=c.useState(t.outcome==="abandoned"?"abandoned":"finished");return e.jsxs("span",{className:"read-form",children:[e.jsx("input",{className:"tp-input read-date",value:i,onChange:u=>l(u.target.value),placeholder:n("common.read-log.started.placeholder"),"aria-label":n("common.field.started.label")}),e.jsx("input",{className:"tp-input read-date",value:h,onChange:u=>d(u.target.value),placeholder:n("common.read-log.finished.placeholder"),"aria-label":n("common.field.finished.label")}),e.jsxs("select",{className:"tp-input read-outcome",value:m,onChange:u=>p(u.target.value),"aria-label":n("common.field.outcome.label"),children:[e.jsx("option",{value:"finished",children:n("common.read-log.outcome.finished.label")}),e.jsx("option",{value:"abandoned",children:n("common.read-log.outcome.abandoned.label")})]}),e.jsx("button",{type:"button",className:"read-edit",disabled:a,onClick:()=>s({started_at:i.trim(),finished_at:h.trim(),outcome:m}),children:n("common.read-log.save.label")}),e.jsx("button",{type:"button",className:"read-edit",disabled:a,onClick:o,children:n("common.read-log.cancel.label")}),r&&e.jsx("button",{type:"button",className:"read-edit read-danger",disabled:a,onClick:r,children:n("common.read-log.delete.label")})]})}function gd({kind:t,item:a={},status:o,progress:s=0,pos:r,reads:i=[],wishlist:l,onSelect:h,onProgress:d,onReadsChanged:m,busy:p}){const u=cd(t,a),f=Mg(t,a),b=o==="completed"?[u,""]:[u,"paused","abandoned","completed",""].filter(g=>g!==o),y=i.filter(g=>g.outcome==="finished").length,v=o||(l?"wishlist":null);return v?v==="wishlist"?e.jsx(Ba,{state:"wishlist",label:n("common.shelf.wishlist.book.label"),tip:n("common.shelf.wishlist.tip"),children:g=>e.jsxs(e.Fragment,{children:[e.jsx("p",{style:{padding:"4px 6px 8px",fontSize:"var(--type-ui-13)",lineHeight:1.5,color:"var(--soft)"},children:n("common.shelf.wishlist.explainer.prose")}),Jo(t,a,o,b,p,g,h)]})}):e.jsxs(e.Fragment,{children:[e.jsx(Ba,{state:v,label:_t(v,t),tip:n("common.shelf.change.tip"),children:g=>e.jsxs(e.Fragment,{children:[o===u&&e.jsx(_g,{kind:t,unit:f,status:o,progress:s,pos:r,busy:p,onSave:d}),Jo(t,a,o,b,p,g,h)]})}),e.jsx(Ba,{state:v,label:n("common.shelf.reads.label",{n:y}),tip:n("common.shelf.read-log.tip"),children:e.jsx(Rg,{kind:t,workId:a.id,reads:i,onChanged:m})}),(o===u||o==="paused")&&e.jsx("span",{className:"shelf-track",children:e.jsx(Lg,{kind:t,status:o,progress:s,pos:r})})]}):e.jsx(Ba,{state:"",label:n("common.shelf.shelve.label"),children:g=>Jo(t,a,o,b,p,g,h)})}function Jo(t,a,o,s,r,i,l){return s.map(h=>e.jsxs("button",{type:"button",role:"menuitem",className:"menu-item",disabled:r,onClick:()=>{i(),l(h)},children:[e.jsx("span",{"aria-hidden":"true",style:{width:8,height:8,borderRadius:2,flex:"none",background:h?gt[h].color:"transparent",border:h?"none":"1px solid var(--line)"}}),ln(t,o,h,a)]},h||"none"))}function ln(t,a,o,s={}){const r=Pn(t,s),i=r==="book";switch(o){case"playing":return n(a==="completed"?"common.shelf.move.playing.again.label":a==="paused"?"common.shelf.move.playing.resume.label":"common.shelf.move.playing.start.label");case"reading":case"watching":return n(a==="completed"?i?"common.shelf.move.reading.again.book.label":"common.shelf.move.reading.again.film.label":a==="paused"?i?"common.shelf.move.reading.resume.book.label":"common.shelf.move.reading.resume.film.label":i?"common.shelf.move.reading.start.book.label":"common.shelf.move.reading.start.film.label");case"paused":return n("common.shelf.move.paused.label");case"abandoned":return n("common.shelf.move.abandoned.label");case"completed":return n(r==="game"?"common.shelf.move.completed.played.label":i?"common.shelf.move.completed.book.label":"common.shelf.move.completed.film.label");default:return n("common.shelf.move.clear.label")}}function wr(t,{fav:a,color:o,tag:s}={}){return!!(a&&"favorite"in t||o&&"color"in t||s&&"tags"in t)}function vr({kind:t,item:a,index:o=0,onOpen:s,people:r={},seps:i,selection:l,selectKind:h=t,onChanged:d,onEdit:m}){const p=t==="book",u=!p&&(a.media_type||"movie")==="show",f=p?a.author:a.director,b=p?a.cover_path:a.poster_path,y=p?a.published_year:a.release_year,v=p?a.annotation_count||0:a.dialogue_count||0,g=Eg(t,a),w=b?e.jsx("img",{src:$e(b),alt:n(p?"common.cover.alt":"common.poster.alt",{title:a.title}),loading:"lazy",decoding:"async",className:"block aspect-[2/3] w-full object-cover"}):e.jsx(Dt,{kind:n(p?"common.badge.cover":"common.badge.poster"),className:p?"w-full rounded-none border-0":"w-full"}),k=!!(l!=null&&l.isSelected(a.id)),S=wc({kind:t,ids:[a.id],onDone:d}),[N,j]=c.useState(!1),{practise:x,practiceDialog:M}=qa(),q=_a(t,a,{fillGaps:d?()=>S.fillGaps():void 0,setReview:d?(P,C)=>S.post({review:C},C?n("common.selection.toast.back-in-quiz"):n("common.selection.toast.skipping",{n:1,count:1})):void 0,excluded:!!a.review_excluded,edit:m?()=>m(a.id):void 0,remove:d?()=>j(!0):void 0,practise:()=>x({[t==="book"?"book":"movie"]:a.id,label:a.title})}),E=[...mr(l,a.id,h),...q.map(P=>({...P,onClick:P.run}))],{cardProps:O,menuClass:_,menu:T}=Lo(E,l?{onLongPress:()=>l.toggle(a.id,h)}:void 0),B=P=>{var H;if((H=O.onClickCapture)!=null&&H.call(O,P))return;if(!l)return s(a.id);const C=ur(P,l);if(C==="open")return s(a.id);P.preventDefault(),C==="extend"?l.extendTo(a.id,h):l.toggle(a.id,h)},L=e.jsxs("button",{type:"button",onClick:B,className:`cover-tile block w-full text-left ${_}`,title:a.title,...O,onClickCapture:void 0,children:[e.jsxs(Xe,{variant:o%4,className:`relative overflow-hidden cover-lift${k?" is-picked":""}`,children:[w,g&&e.jsx(Ps,{state:g,kind:t,progress:a.progress}),u&&e.jsx("span",{className:"tp-chip tp-scrim-deep absolute left-1.5 top-1.5",style:{fontSize:"var(--type-ui-9)",color:"var(--on-scrim)",borderColor:"transparent"},children:"SHOW"}),ya(t,a)&&e.jsx(mu,{kind:Pn(t,a),stacked:u}),a.favorite&&e.jsx(hu,{})]}),e.jsx("p",{className:"mt-2.5 truncate",style:{fontFamily:"var(--font-display)",fontStyle:"var(--font-display-style)",fontVariantCaps:"var(--font-display-caps)",textTransform:"var(--font-display-case)",fontVariantNumeric:"var(--font-display-figures)",fontWeight:600,fontSize:"var(--type-display-15)",color:"var(--ink)"},children:a.title}),e.jsxs("div",{className:"flex items-center gap-1.5",children:[e.jsx(Ma,{names:Je(f,i),map:r,size:24,ring:"var(--bg)"}),e.jsx("p",{className:"min-w-0 truncate text-[13px]",style:{color:"var(--soft)"},children:[f,y||null].filter(Boolean).join(" · ")||" "})]}),a.series&&e.jsx("p",{className:"truncate text-[12px]",style:{color:"var(--faint)",fontStyle:"italic"},children:Us(a)}),e.jsxs("div",{className:"mt-0.5 flex items-center gap-2",children:[p?e.jsx($,{style:{color:"var(--accent-ui)"},children:n("common.work-card.count.quote",{count:v,n:v})}):e.jsx("span",{style:{fontFamily:"var(--font-mono)",fontWeight:"var(--font-mono-weight)",fontStyle:"var(--font-mono-style)",fontVariantCaps:"var(--font-mono-caps)",textTransform:"var(--font-mono-case)",fontVariantNumeric:"var(--font-mono-figures)",fontSize:"var(--type-mono-12)",color:"var(--amber)"},children:n("common.work-card.count.dialogue",{count:v,n:v})}),e.jsx($s,{item:a,quiet:!0})]})]}),V=e.jsx(vt,{open:N,title:n("common.work.delete.confirm.title",{title:a.title}),body:e.jsx("p",{className:"microcopy",children:v>0?n("common.work.delete.confirm.body",{count:v,n:v}):n("common.work.delete.confirm.body.empty")}),confirmLabel:n("common.work.delete.confirm.action.label"),onConfirm:()=>{j(!1),S.remove()},onCancel:()=>j(!1)});return l?e.jsxs("div",{className:`work-tile${l.active?" is-selecting":""}`,children:[L,e.jsx(Xs,{picked:k,label:p?"this book":u?"this show":"this film",onChange:()=>l.toggle(a.id,h)}),T,V,M]}):e.jsxs(e.Fragment,{children:[L,T,V,M]})}const Dg={1:["span 2 / span 2"],2:["span 2 / span 1","span 2 / span 1"],3:["span 2 / span 1","span 1 / span 1","span 1 / span 1"]};function Ig({kind:t="book",items:a=[],onOpen:o}){const s=t==="book",r=a.length,i=a.slice(0,4).map(h=>s?h.cover_path:h.poster_path),l=Dg[i.length]||[];return e.jsxs("button",{type:"button",onClick:o,className:"cover-tile block w-full text-left",title:n("common.wishlist-folder.tip",{n:r}),children:[e.jsxs(Xe,{variant:0,className:"relative overflow-hidden cover-lift",children:[e.jsx("span",{className:"wish-collage","aria-hidden":"true",children:i.map((h,d)=>e.jsx("span",{className:"wish-cell",style:{gridArea:l[d]},children:h?e.jsx("img",{src:$e(h),alt:""}):null},d))}),e.jsx("span",{className:"wish-folder-tag tp-scrim-deep",children:n("common.shelf.wishlist.book.label")})]}),e.jsx("p",{className:"mt-2.5 truncate",style:{fontFamily:"var(--font-display)",fontStyle:"var(--font-display-style)",fontVariantCaps:"var(--font-display-caps)",textTransform:"var(--font-display-case)",fontVariantNumeric:"var(--font-display-figures)",fontWeight:600,fontSize:"var(--type-display-15)",color:"var(--ink)"},children:n("common.shelf.wishlist.book.label")}),e.jsx("div",{className:"flex items-center gap-1.5",children:e.jsx("p",{className:"min-w-0 truncate text-[13px]",style:{color:"var(--soft)"},children:n("common.wishlist-folder.subtitle.label")})}),e.jsx("div",{className:"mt-0.5 flex items-center gap-2",children:s?e.jsx($,{style:{color:"var(--accent-ui)"},children:n("common.count.phrase",{n:r,noun:n("unit.book",{count:r})})}):e.jsx("span",{style:{fontFamily:"var(--font-mono)",fontWeight:"var(--font-mono-weight)",fontStyle:"var(--font-mono-style)",fontVariantCaps:"var(--font-mono-caps)",textTransform:"var(--font-mono-case)",fontVariantNumeric:"var(--font-mono-figures)",fontSize:"var(--type-mono-12)",color:"var(--amber)"},children:n("common.count.phrase",{n:r,noun:n("unit.title",{count:r})})})})]})}function kr({label:t,count:a,noun:o,nounPlural:s,person:r,onOpenPerson:i}){const l=o||n("unit.item.one"),h=s||(o?`${o}s`:n("unit.item.other"));return e.jsxs("div",{className:"mb-4 flex items-center gap-3",children:[r&&e.jsx(Ea,{person:r,size:34}),i?e.jsx(ye,{label:n("common.person.open.tip"),className:"min-w-0",children:e.jsx("button",{type:"button",className:"display-title truncate",style:{fontSize:"var(--type-ui-19)",background:"none",border:"none",padding:0,cursor:"pointer",textAlign:"left"},onClick:i,children:t})}):e.jsx("h3",{className:"display-title truncate",style:{fontSize:"var(--type-ui-19)"},children:t}),e.jsx($,{style:{color:"var(--accent-ui)"},children:n("common.count.phrase",{n:a,noun:a===1?l:h})}),e.jsx("span",{className:"h-px flex-1",style:{background:"var(--line)"}})]})}function xr({onClose:t,title:a,meta:o,actions:s}){return e.jsx("div",{className:"mobile-sticky-bar",children:e.jsxs("div",{className:"mobile-detail-bar",children:[e.jsx(ye,{label:n("common.detail.back.tip"),side:"bottom",className:"shrink-0",children:e.jsx("button",{type:"button",className:"tp-btn tp-btn-ghost tactile flex items-center justify-center rounded-full",style:{width:44,height:44,padding:0,flexShrink:0},onClick:t,"aria-label":n("common.action.back.label"),children:e.jsx(Zt,{})})}),e.jsxs("div",{className:"min-w-0 flex-1",children:[e.jsx("div",{className:"mobile-detail-title",children:a}),o&&e.jsx("div",{className:"mobile-detail-meta",children:o})]}),e.jsx("div",{className:"mobile-detail-actions",children:s})]})})}function bd(t=[]){let a=0,o=0,s=0;for(const r of t)r.favorite&&a++,(r.note||"").trim()&&o++,(r.tags||[]).length>0&&s++;return{total:t.length,favourites:a,noted:o,tagged:s}}function Pg(t,a){if(!t)return t;const o=(s,r)=>Math.max(0,s-(r?1:0));return{total:Math.max(0,t.total-1),favourites:o(t.favourites,a==null?void 0:a.favorite),noted:o(t.noted,((a==null?void 0:a.note)||"").trim()),tagged:o(t.tagged,((a==null?void 0:a.tags)||[]).length>0)}}function yd({counts:t,noun:a,tone:o="accent"}){if(!t)return null;const s=a||[n("unit.quote.one"),n("unit.quote.other")],{total:r=0,favourites:i=0,noted:l=0,tagged:h=0}=t,d=[r===0?n("common.hero.counts.empty.label",{noun:s[1]}):n("common.count.phrase",{n:r,noun:r===1?s[0]:s[1]}),i>0&&n("common.hero.counts.favourites",{count:i,n:i}),l>0&&n("common.hero.counts.noted.label",{n:l}),h>0&&n("common.hero.counts.tagged.label",{n:h})].filter(Boolean);return e.jsx("div",{className:`hero-counts${o==="amber"?" hero-counts-amber":""}`,children:d.map((m,p)=>e.jsxs("span",{children:[p>0&&e.jsx("span",{"aria-hidden":"true",className:"hero-counts-sep",children:"·"}),e.jsx("span",{className:p===0?"hero-counts-total":void 0,children:m})]},p))})}function wd({cover:t,shadow:a="drop-shadow(0 12px 22px rgba(0,0,0,.4))",title:o,titleSize:s="var(--type-display-26)",titleStyle:r,meta:i,counts:l,favorite:h,onFavorite:d,tags:m,genres:p=[],description:u,actions:f}){return _e()?e.jsxs("div",{className:"work-hero-m",children:[e.jsxs("div",{className:"work-hero-m-top",children:[e.jsx("div",{className:"work-hero-m-cover",children:t}),e.jsxs("div",{className:"min-w-0 flex-1",children:[e.jsx("h1",{className:"display-title",style:{fontSize:"var(--type-ui-22)",lineHeight:1.2,...r},children:o}),i&&e.jsx("div",{className:"mt-1.5",children:i}),l&&e.jsx("div",{className:"mt-1.5",children:l})]})]}),(m||d)&&e.jsxs("div",{className:"work-hero-m-shelf",children:[e.jsx(On,{value:!!h,onChange:d}),m]}),p.length>0&&e.jsx("div",{className:"flex flex-wrap gap-1.5",children:p.map(y=>e.jsx("span",{className:"tp-chip",children:y},y))}),e.jsx(is,{text:u}),f&&e.jsx("div",{className:"flex flex-wrap gap-2",children:f})]}):e.jsxs("div",{style:{display:"flow-root"},children:[f&&e.jsx("div",{className:"flex flex-wrap justify-end gap-2",style:{float:"right",marginLeft:20,marginBottom:10},children:f}),e.jsx("div",{className:"w-36 sm:w-44",style:{float:"left",marginRight:24,marginBottom:14,filter:a},children:t}),e.jsx("h1",{className:"display-title",style:{fontSize:s,...r},children:o}),i&&e.jsx("div",{className:"mt-2.5",children:i}),l&&e.jsx("div",{className:"mt-2",children:l}),e.jsxs("div",{className:"mt-2.5 flex flex-wrap items-center gap-3",children:[e.jsx(On,{value:!!h,onChange:d}),m]}),p.length>0&&e.jsx("div",{className:"mt-2.5 flex flex-wrap gap-1.5",children:p.map(y=>e.jsx("span",{className:"tp-chip",children:y},y))}),e.jsx("div",{className:"mt-2.5",children:e.jsx(is,{text:u})})]})}function jr({mobile:t,title:a,counts:o,error:s,onBack:r,onExport:i,headerAside:l,loaded:h,hasItems:d,shownCount:m,emptyText:p,noMatchText:u,genres:f=[],genre:b,setGenre:y,fav:v,setFav:g,tagged:w,setTagged:k,noted:S,setNoted:N,wish:j,setWish:x,states:M=[],setStates:q,kind:E="book",activeStates:O=[dt[E]],noun:_=n("unit.book.one"),nounPlural:T=_===n("unit.book.one")?n("unit.book.other"):`${_}s`,seriesNoun:B=n("common.filters.series.noun.one"),seriesNounPlural:L=B===n("common.filters.series.noun.one")?n("common.filters.series.noun.other"):`${B}s`,seriesNames:V=[],series:P,setSeries:C,creditNames:H=[],credit:R,setCredit:I,creditNoun:U=n("common.filters.credit.noun.one"),creditNounPlural:te=U===n("common.filters.credit.noun.one")?n("common.filters.credit.noun.other"):`${U}s`,sort:D,setSort:z,sortOptions:K=[],leading:A,trailing:Y,leadingMobile:G,trailingMobile:ae,onReset:Z,children:pe,exportDialog:ce,extraModals:F}){const[Q,ie]=c.useState(!1),he=!!y,ue=!!x,re=!!q,J=!!C&&(V||[]).length>0,de=!!I&&(H||[]).length>0,Te=!!z&&(K||[]).length>0,Be=e.jsxs(e.Fragment,{children:[g&&e.jsx(ye,{label:n("common.filters.favourites.tip"),children:e.jsx("button",{onClick:()=>g(!v),className:ct(v),children:n("common.filters.favourites.label")})}),k&&e.jsx(ye,{label:n("common.filters.tagged.tip",{noun:T}),children:e.jsx("button",{onClick:()=>k(!w),className:ct(w),children:n("common.filters.tagged.label")})}),N&&e.jsx(ye,{label:n("common.filters.noted.tip",{noun:T}),children:e.jsx("button",{onClick:()=>N(!S),className:ct(S),children:n("common.filters.noted.label")})})]}),We=[["",n("common.filters.wish.all.label"),n("common.filters.wish.all.tip",{noun:_})],["wishlist",n("common.filters.wish.only.label"),n("common.filters.wish.only.tip",{noun:T})],["annotated",n("common.filters.wish.annotated.label"),n("common.filters.wish.annotated.tip",{noun:T})]].map(([ee,je,Ne])=>e.jsx(ye,{label:Ne,children:e.jsx("button",{className:ct(j===ee),onClick:()=>x(ee),children:je})},ee||"all")),qe=e.jsx(cu,{ariaLabel:n("common.filters.shelf.aria"),allLabel:n("common.filters.shelf.all.label"),values:M,onChange:q,options:[...O.map(ee=>[ee,_t(ee,E),gt[ee].color]),["paused",n(gt.paused.book),gt.paused.color],["abandoned",n(gt.abandoned.book),gt.abandoned.color],["completed",n(gt.completed.book),gt.completed.color],["none",n("common.filters.shelf.none.label"),"transparent"]]}),ne=J&&e.jsx(Oe,{ariaLabel:n("common.filters.by.aria",{field:B}),value:P,onChange:C,options:[["",n("common.filters.all.label",{field:L})],...V.map(ee=>[ee,ee])]}),me=de&&e.jsx(Oe,{ariaLabel:n("common.filters.by.aria",{field:U}),value:R,onChange:I,options:[["",n("common.filters.all.label",{field:te})],...H.map(ee=>[ee,ee])]}),oe=Te&&e.jsx(Oe,{ariaLabel:n("common.filters.sort.aria"),value:D,onChange:z,options:K}),be=e.jsxs(e.Fragment,{children:[e.jsx(Pe,{icon:e.jsx(Ht,{}),label:n("common.filters.label"),ariaLabel:n("common.filters.label"),onClick:()=>ie(ee=>!ee)}),e.jsx(It,{items:[{icon:e.jsx(rt,{}),label:n("common.action.export.label"),onClick:i}]})]});return e.jsxs("section",{children:[t&&r?e.jsx(xr,{onClose:r,title:a,meta:o,actions:be}):e.jsx("div",{className:t?"mobile-sticky-bar":"",children:e.jsx(Gt,{title:a,counts:o,right:e.jsxs(e.Fragment,{children:[t&&e.jsx("div",{className:"flex items-center gap-2",children:be}),!t&&l,!t&&!qs&&e.jsx(Pe,{icon:e.jsx(rt,{}),label:n("common.action.export.label"),ariaLabel:n("common.action.export.label"),onClick:i,tooltip:n("common.action.export.shown.tip")})]})})}),e.jsx(ve,{children:s}),d&&!t&&e.jsxs("div",{className:"filter-row mb-5",children:[he?e.jsx(oi,{genres:f,value:b,onChange:y}):e.jsx("span",{}),e.jsxs("div",{className:"ml-auto flex shrink-0 items-center gap-2",children:[A,ue&&We,Be,re&&qe,me,ne,Y,Te&&e.jsxs("label",{className:"flex items-center gap-2",children:[e.jsx($,{children:n("common.filters.sort.label")}),oe]})]})]}),t&&e.jsx($n,{open:Q,onClose:()=>ie(!1),title:n("common.filters.label"),footer:e.jsx(er,{count:h?n("common.filters.shown.label",{n:m}):"",onReset:Z,onDone:()=>ie(!1)}),children:e.jsxs("div",{className:"space-y-5",children:[he&&e.jsxs("div",{children:[e.jsx($,{className:"mb-2 block",children:n("common.filters.genre.label")}),e.jsx(oi,{genres:f,value:b,onChange:y})]}),G,ue&&e.jsxs("div",{children:[e.jsx($,{className:"mb-2 block",children:n("common.filters.wish.label")}),e.jsx("div",{className:"flex flex-wrap items-center gap-2",children:We})]}),e.jsxs("div",{children:[e.jsx($,{className:"mb-2 block",children:n("common.filters.only.label")}),e.jsx("div",{className:"flex flex-wrap items-center gap-2",children:Be})]}),re&&e.jsxs("div",{children:[e.jsx($,{className:"mb-2 block",children:n("common.filters.shelf.label")}),qe]}),J&&e.jsxs("div",{children:[e.jsx($,{className:"mb-2 block",children:B}),ne]}),de&&e.jsxs("div",{children:[e.jsx($,{className:"mb-2 block",children:U}),me]}),ae,Te&&e.jsxs("div",{children:[e.jsx($,{className:"mb-2 block",children:n("common.filters.sort.label")}),oe]})]})}),h&&!d&&e.jsx(Vt,{children:p}),d&&m===0&&e.jsx(Vt,{children:u}),m>0&&pe,F,ce]})}const Bg=(t,a=[])=>{const s=a.length>0&&a.every(r=>Pn(t,r)==="game")?"playing":t==="movie"?"watching":"reading";return[["",n("common.selection.shelf.clear.label")],[s,_t(s,t)],["paused",_t("paused",t)],["abandoned",_t("abandoned",t)],["completed",_t("completed",t)]]};function Da({selection:t,rows:a=[],onDone:o,tagSuggestions:s=[],onEdit:r}){const[i,l]=c.useState(!1),[h,d]=c.useState(""),[m,p]=c.useState(!1),[u,f]=c.useState(!1),[b,y]=c.useState(!1),[v,g]=c.useState(!1),[w,k]=c.useState(!1),{kind:S,ids:N,count:j}=t,x=t.open??j>0,M=wc({kind:S,ids:N,onDone:o}),q=M.busy,E=i||m||u||b||v||w;if(c.useEffect(()=>{if(!x||E)return;const G=ae=>{var Z;ae.key==="Escape"&&(ae.stopPropagation(),(Z=t.dismiss)==null||Z.call(t))};return document.addEventListener("keydown",G),()=>document.removeEventListener("keydown",G)},[x,E,t]),!x||!S||!bo[S])return null;const O=bo[S],_=G=>n(O.unit,{count:G}),T=hr(S),B=j===0,L=a.filter(G=>t.isSelected(G.id)),V=L.length>0&&L.every(G=>G.review_excluded),P=yc(S,j),C=Ff(S,N,{setColour:T?void 0:(G,ae)=>M.post({color:ae},n("common.selection.toast.recoloured",{n:j,count:j})),addTags:T?void 0:(G,ae)=>M.post({add_tags:ae},n("common.selection.toast.tagged",{n:j,count:j})),setSticker:T?void 0:((G,ae)=>M.post({sticker_id:ae??0},ae==null?n("common.selection.toast.seals-removed"):n("common.selection.toast.sealed",{n:j,count:j}))),favourite:T?void 0:()=>M.post({favorite:!0},n("common.selection.toast.favourited",{n:j,count:j})),setBoard:S==="quote"?(G,ae)=>M.post({board_id:ae},n("common.selection.toast.moved",{n:j,count:j})):void 0,addToAnthology:Ii[S]?(G,ae)=>z(ae):void 0,fillGaps:T?M.fillGaps:void 0,setFields:(G,ae)=>M.post(ae,n("common.selection.toast.fields-set",{n:j,count:j})),setShelf:T?(G,ae)=>M.setShelf(ae,n("common.selection.toast.moved",{n:j,count:j})):void 0,edit:r?G=>r(G):void 0,excluded:V,setReview:(G,ae)=>M.post({review:ae},ae?n("common.selection.toast.back-in-quiz"):n("common.selection.toast.skipping",{n:j,count:j})),remove:()=>K()}),H=Object.fromEntries(C.map(G=>[G.id,G])),R=G=>{f(!1),H["add-tags"].run(G)},I=G=>{p(!1),H.sticker.run(G)},U=G=>{y(!1),H.board.run(G)},te=G=>{g(!1),H.anthology.run(G)},D=G=>{k(!1),H["set-fields"].run(G)};async function z(G){var F,Q;const ae=N.map(ie=>({kind:Ii[S],item_id:ie})),Z=await X("POST",`/anthologies/${G}/entries`,{items:ae});if(!Z.ok)return Se(le(Z,n("error.add.generic")));const pe=((F=Z.data)==null?void 0:F.added)??0,ce=((Q=Z.data)==null?void 0:Q.skipped)??0;Se(ce?n("common.selection.toast.gathered-some",{n:pe,count:pe,skipped:ce}):n("common.selection.toast.gathered",{n:pe,count:pe}))}async function K(){l(!1),d(""),await M.remove()}const A={"add-tags":()=>f(!0),sticker:()=>p(!0),board:()=>y(!0),anthology:()=>g(!0),"set-fields":()=>k(!0),delete:()=>l(!0)},Y=In(C).map(G=>({...G,onClick:A[G.id]||(()=>G.run())}));return e.jsxs("div",{className:"selection-bar",children:[e.jsx(Pe,{icon:e.jsx("span",{className:"selection-count",children:j}),label:n("common.selection.deselect-all.label"),ariaLabel:B?n("common.selection.none.aria",{noun:_(0)}):n("common.selection.count.aria",{n:j,count:j,noun:_(j)}),tooltip:B?n("common.selection.none.aria",{noun:_(0)}):n("common.selection.count.tip",{n:j,count:j,noun:_(j)}),disabled:q||B,onClick:()=>{var G;return(G=t.deselectAll)==null?void 0:G.call(t)}}),Dn(C).map(G=>G.id==="colour"?e.jsx("span",{className:"shrink-0","aria-disabled":B||void 0,children:e.jsx(nt,{mini:!0,disabled:B||q,value:"",onChange:ae=>G.run(ae),ariaLabel:n("common.selection.colour.aria",{n:j,count:j})})},G.id):G.id==="shelf"?e.jsx(It,{icon:G.icon,label:G.label,ariaLabel:n("common.selection.shelf.aria",{n:j,count:j}),tooltip:n("common.selection.shelf.tip"),disabled:B||q,items:Bg(S,L).map(([ae,Z])=>({id:ae||"clear",label:Z,onClick:()=>G.run(ae)}))},G.id):e.jsx(Pe,{icon:G.icon,label:G.label,ariaLabel:G.label,tooltip:G.id==="fill"&&q?n("common.action.fetch.busy"):G.label,disabled:B||q,onClick:()=>G.run()},G.id)),Y.length>0&&e.jsx(It,{items:Y,ariaLabel:n("common.selection.more.aria",{n:j,count:j}),tooltip:n("common.selection.more.tip"),disabled:B||q}),e.jsx(Ce,{icon:e.jsx(it,{}),ariaLabel:n("common.selection.dismiss.aria"),onClick:()=>{var G;return(G=t.dismiss)==null?void 0:G.call(t)},wrapClassName:"ml-auto"}),u&&e.jsx(Fg,{count:j,busy:q,suggestions:s,onApply:R,onClose:()=>f(!1)}),m&&e.jsx(Hg,{count:j,busy:q,onApply:I,onClose:()=>p(!1)}),b&&e.jsx(id,{count:j,busy:q,onApply:U,onClose:()=>y(!1)}),v&&e.jsx(ug,{count:j,busy:q,onApply:te,onClose:()=>g(!1)}),w&&e.jsx(zg,{kind:S,count:j,rows:L,busy:q,onApply:D,onClose:()=>k(!1)}),e.jsx(vt,{open:i,title:n("common.selection.delete.confirm.title",{n:j,count:j,noun:_(j)}),body:e.jsxs("div",{className:"space-y-2",children:[e.jsx("p",{className:"microcopy",children:Ie(T?"common.selection.delete.confirm.body.work":"common.selection.delete.confirm.body.quote",{phrase:e.jsx("b",{children:P},"phrase")})}),e.jsx("input",{className:"tp-input",autoFocus:!0,value:h,placeholder:P,"aria-label":n("common.selection.delete.confirm.phrase.aria"),onChange:G=>d(G.target.value)})]}),confirmLabel:n("common.selection.delete.confirm.action.label"),confirmDisabled:h.trim().toLowerCase()!==P,onConfirm:()=>H.delete.run(),onCancel:()=>{l(!1),d("")}})]})}function Fg({count:t,busy:a,suggestions:o,onApply:s,onClose:r}){const[i,l]=c.useState([]),h=i.map(d=>d.trim()).filter(Boolean);return e.jsx(Ge,{open:!0,onClose:r,title:n("common.selection.tags.title",{n:t,count:t}),children:e.jsxs("div",{className:"space-y-3",children:[e.jsx("p",{className:"microcopy",children:n("common.selection.tags.body",{n:t,count:t})}),e.jsx(pt,{value:i,onChange:l,suggestions:o,placeholder:n("common.selection.tags.placeholder"),ariaLabel:n("common.selection.tags.input.aria")}),e.jsx(ge,{onClick:()=>s(h),disabled:a||h.length===0,children:n("common.action.add-tags.label")})]})})}function Hg({count:t,busy:a,onApply:o,onClose:s}){const[r,i]=c.useState(null),{stickers:l,reload:h}=Oa();return e.jsx(Ge,{open:!0,onClose:s,title:n("common.selection.seal.title",{n:t,count:t}),children:e.jsxs("div",{className:"space-y-3",children:[e.jsx("p",{className:"microcopy",children:n("common.selection.seal.body")}),e.jsx(Fo,{value:r,onChange:i,stickers:l,reload:h}),e.jsx(ge,{onClick:()=>o(r),disabled:a,children:n("common.action.apply.label")})]})})}function zg({kind:t,count:a,rows:o,busy:s,onApply:r,onClose:i}){var g;const l=Um(t),[h,d]=c.useState(((g=l[0])==null?void 0:g.key)||""),[m,p]=c.useState(""),u=l.find(w=>w.key===h),f=!(u!=null&&u.required),b=!String(m).trim(),y=u?Gm(o,h):null,v=()=>r({[h]:u!=null&&u.number?Number(m)||0:String(m).trim()});return e.jsx(Ge,{open:!0,onClose:i,title:n("common.selection.edit.title",{n:a,count:a}),children:e.jsxs("div",{className:"space-y-3",children:[e.jsx("p",{className:"microcopy",children:n("common.selection.edit.body",{n:a,count:a})}),e.jsxs("div",{className:"flex flex-wrap items-center gap-2",children:[e.jsx($,{children:n("common.selection.edit.field.label")}),e.jsx(Oe,{ariaLabel:n("common.selection.edit.field.aria"),value:h,onChange:w=>{d(w),p("")},options:l.map(w=>[w.key,w.label])})]}),u!=null&&u.options?e.jsxs("div",{className:"flex flex-wrap items-center gap-2",children:[e.jsx($,{children:u.label}),e.jsx(Oe,{ariaLabel:n("common.selection.edit.value.aria"),value:m,onChange:p,options:f?[["",n("common.selection.edit.value.none.label")],...u.options]:u.options})]}):u!=null&&u.long?e.jsxs("label",{className:"tp-field",children:[e.jsx($,{children:u.label}),e.jsx("textarea",{className:"tp-input",rows:"4","aria-label":n("common.selection.edit.value.aria"),value:m,onChange:w=>p(w.target.value)})]}):e.jsx(xe,{label:(u==null?void 0:u.label)||"",nameCase:!(u!=null&&u.number),inputMode:u!=null&&u.number?"numeric":void 0,value:m,autoFocus:!0,onChange:w=>p(w.target.value)}),y&&e.jsx("p",{className:"tp-warn",children:y.text}),f&&b&&e.jsx("p",{className:"microcopy",children:n("common.selection.edit.clear.hint")}),e.jsx(ge,{onClick:v,disabled:s||!u||!f&&b,children:n("common.action.apply.label")})]})})}const vd="tp-btn tp-btn-primary",bs={fontFamily:"var(--font-display)",fontWeight:"var(--font-display-weight)",fontVariantCaps:"var(--font-display-caps)",textTransform:"var(--font-display-case)",fontVariantNumeric:"var(--font-display-figures)",fontStyle:"italic",fontSize:"var(--type-display-17)",lineHeight:1.55};function $g({openId:t,onOpen:a,onClose:o,onOpenMovie:s,creditSeparators:r,onAdd:i,onSearch:l,dataNonce:h}){return t?e.jsx(Vg,{id:t,onClose:o,creditSeparators:r,onAdd:i,dataNonce:h,onSearch:l}):e.jsx(Kg,{onOpen:a,onOpenMovie:s,creditSeparators:r,dataNonce:h})}const $i=()=>[["none",n("library.group.none.label")],["series",n("library.group.series.label")],["author",n("library.group.author.label")],["decade",n("library.group.decade.label")],["genre",n("library.group.genre.label")]],wo=(t,a)=>n("common.count.phrase",{n:t,noun:n(a,{count:t})});function Wg(t){return t.replace(/\S+/g,a=>a[0].toUpperCase()+a.slice(1).toLowerCase())}function Za(t){const a=[];for(const o of t.genres||[])for(const s of String(o).split(",")){const r=Wg(s.trim());r&&!a.includes(r)&&a.push(r)}return a}function Ug(t){return{title:t.title,author:t.author||"",translator:t.translator||"",editor:t.editor||"",isbn:t.isbn||"",asin:t.asin||"",description:t.description||"",published_year:t.published_year||0,genres:t.genres||[],series:t.series||"",series_index:t.series_index||0,favorite:!!t.favorite}}async function Gg(t,a){const o=await X("PUT",`/books/${t}/status`,a);return o.ok?"":le(o,n("error.save.generic"))}function Wi({books:t,coverSize:a,onOpen:o,authorMap:s={},seps:r,selection:i,leadingTile:l,onChanged:h,onEdit:d}){const m=Xt(t.length,t);return e.jsxs("ul",{className:"grid gap-x-6 gap-y-9",style:{gridTemplateColumns:`repeat(auto-fill, minmax(${a}px, 1fr))`},children:[l&&e.jsx("li",{children:l}),t.slice(0,m.count).map((p,u)=>e.jsx("li",{children:e.jsx(vr,{kind:"book",item:p,index:u,onOpen:o,people:s,seps:r,selection:i,onChanged:h,onEdit:d})},p.id)),m.more&&e.jsx("li",{ref:m.sentinel,"aria-hidden":"true",className:"h-px"})]})}function Kg({onOpen:t,onOpenMovie:a,creditSeparators:o,dataNonce:s}){const[r,i]=c.useState(null),[l,h]=c.useState([]),d=c.useMemo(()=>({genre:st(l,"genre"),series:st(l,"series"),fav:st(l,"favourite")==="yes",tagged:st(l,"tagged")==="yes",noted:st(l,"noted")==="yes",wish:{yes:"wishlist",no:"annotated"}[st(l,"wishlist")]||"",states:Qc(l,"shelf")}),[l]),{genre:m,series:p,fav:u,tagged:f,noted:b,wish:y,states:v}=d,g=J=>h(de=>Ze(de,"genre",J)),w=J=>h(de=>Ze(de,"series",J)),k=J=>h(de=>Ze(de,"favourite",J?"yes":"")),S=J=>h(de=>Ze(de,"tagged",J?"yes":"")),N=J=>h(de=>Ze(de,"noted",J?"yes":"")),j=J=>h(de=>Ze(de,"wishlist",J==="wishlist"?"yes":J==="annotated"?"no":"")),x=J=>h(de=>Xc(de,"shelf",J)),[M,q]=He("tippani:books:wishFolder",!1),[E,O]=c.useState("recent"),[_,T]=c.useState("none"),[B,L]=c.useState(!1),[V,P]=c.useState(""),[C]=Pl("tippani:size:books",165),H=_e(),R=Qe("author"),[I,U]=c.useState(null);c.useEffect(()=>(Qt(Yc(l)),()=>Qt([])),[l]);async function te(){const J=await X("GET","/books");J.ok?i(J.data.books):P(le(J))}c.useEffect(()=>{te()},[s]);const D=c.useMemo(()=>{const J=new Map;for(const de of r||[])for(const Te of Za(de))J.set(Te,(J.get(Te)||0)+1);return[...J.keys()].sort((de,Te)=>J.get(Te)-J.get(de)||de.localeCompare(Te))},[r]),z=c.useMemo(()=>{const J=new Set;for(const de of r||[])de.series&&J.add(de.series);return[...J].sort()},[r]),K=c.useMemo(()=>{let J=r||[];return m&&(J=J.filter(de=>Za(de).includes(m))),p&&(J=J.filter(de=>(de.series||"")===p)),u&&(J=J.filter(de=>de.favorite)),f&&(J=J.filter(de=>(de.tagged_count||0)>0)),b&&(J=J.filter(de=>(de.noted_count||0)>0)),J=md(J,v),J=hd(J,y,de=>de.annotation_count||0),E==="recent"?ud(J,"book"):(J=[...J],E==="title"?J.sort((de,Te)=>de.title.localeCompare(Te.title)):E==="author"?J.sort((de,Te)=>(de.author||"").localeCompare(Te.author||"")):E==="series"?J.sort(ho):E==="read"&&J.sort(Kl),J)},[r,m,p,u,f,b,v,y,E]),A=M&&y===""&&_==="none",Y=J=>(J.annotation_count||0)===0,G=c.useMemo(()=>A?K.filter(Y):[],[A,K]),ae=c.useMemo(()=>A?K.filter(J=>!Y(J)):K,[A,K]),Z=Ra(ae.map(J=>J.id)),pe=()=>{Z.clear(),te()},[ce,F]=c.useState(null),Q=c.useMemo(()=>mn(o),[o]),ie=e.jsx(_u,{active:M,label:n("library.filters.fold-wishlist.label"),tooltip:n("library.filters.fold-wishlist.tip"),onClick:()=>q(J=>!J)}),he=c.useMemo(()=>_==="none"?null:yr(K,_,{credit:J=>J.author,splitCredit:!0,creditResidual:n("library.group.residual.author.label"),year:J=>J.published_year,genres:Za,series:J=>J.series,seps:Q,sortMembers:(J,de)=>de==="series"?[...J].sort(ho):J}),[K,_,Q]),ue=Xt(he?he.length:0,he,12),re=(r||[]).reduce((J,de)=>J+(de.annotation_count||0),0);return e.jsxs(jr,{mobile:H,title:n("nav.tab.library.label"),counts:r?n("library.header.counts",{a:n("common.count.phrase",{n:r.length,noun:n("unit.book",{count:r.length})}),b:n("common.count.phrase",{n:re,noun:n("unit.quote",{count:re})})}):"",error:V,onExport:()=>L(!0),headerAside:e.jsx($,{className:"hidden sm:inline",children:n("library.header.lookup.label")}),loaded:r!=null,hasItems:!!(r&&r.length>0),shownCount:K.length,emptyText:n("library.board.empty"),noMatchText:n("library.board.nomatch"),genres:D,genre:m,setGenre:g,fav:u,setFav:k,tagged:f,setTagged:S,noted:b,setNoted:N,wish:y,setWish:j,states:v,setStates:x,kind:"book",noun:n("unit.book.one"),nounPlural:n("unit.book.other"),seriesNames:z,series:p,setSeries:w,sort:E,setSort:O,sortOptions:[["recent",n("library.sort.recent.label")],["title",n("library.sort.title.label")],["author",n("library.sort.author.label")],["series",n("library.sort.series.label")],["read",n("library.sort.read.label")]],trailing:e.jsxs(e.Fragment,{children:[ie,e.jsxs("label",{className:"flex items-center gap-2",children:[e.jsx($,{children:n("common.mono.group.label")}),e.jsx(Oe,{ariaLabel:n("common.filters.group.aria"),value:_,onChange:T,options:$i()})]})]}),trailingMobile:e.jsxs(e.Fragment,{children:[e.jsx("div",{children:ie}),e.jsxs("div",{children:[e.jsx($,{className:"mb-2 block",children:"group"}),e.jsx(Oe,{ariaLabel:n("common.filters.group.aria"),value:_,onChange:T,options:$i()})]})]}),onReset:()=>{h([]),T("none"),O("recent")},exportDialog:e.jsx(vt,{open:B,title:n("library.export.confirm.title"),body:e.jsxs(e.Fragment,{children:[n("library.export.confirm.body",{a:wo(K.length,"unit.book"),b:wo(K.reduce((J,de)=>J+(de.annotation_count||0),0),"unit.quote")}),"be exported as a single Markdown file (re-importable into Tippani)."]}),confirmLabel:n("common.action.export.label"),onCancel:()=>L(!1),onConfirm:async()=>{L(!1),await Ms("/export/books",{ids:K.map(J=>J.id)},"tippani-books.md")}}),extraModals:e.jsxs(e.Fragment,{children:[I&&e.jsx(yn,{kind:I.kind,name:I.name,onClose:()=>U(null),onSaved:R.reload}),ce!=null&&e.jsx(Yg,{kind:"books",id:ce,title:n("book.form.edit.title"),onDone:()=>{F(null),pe()},onCancel:()=>F(null)})]}),children:[Z.open&&e.jsx(Da,{selection:Z,rows:ae,onDone:pe,onEdit:F}),he?e.jsxs("div",{className:"space-y-10",children:[he.slice(0,ue.count).map(J=>{const de=_==="author"&&!J.residual;return e.jsxs("section",{children:[e.jsx(kr,{label:J.label,count:J.items.length,noun:n("unit.book.one"),nounPlural:n("unit.book.other"),person:de?R.map[J.label]:null,onOpenPerson:de?()=>U({kind:"author",name:J.label}):void 0}),e.jsx(Wi,{books:J.items,coverSize:C,onOpen:t,authorMap:R.map,seps:Q,selection:Z,onChanged:pe,onEdit:F})]},J.key)}),ue.more&&e.jsx("div",{ref:ue.sentinel,"aria-hidden":"true",className:"h-px"})]}):e.jsx(Wi,{books:ae,coverSize:C,onOpen:t,authorMap:R.map,seps:Q,selection:Z,onChanged:pe,onEdit:F,leadingTile:G.length>0?e.jsx(Ig,{kind:"book",items:G,onOpen:()=>j("wishlist")}):null})]})}function kd(t){const a=t.replace(/[-\s]/g,"");return/^(\d{9}[\dXx]|\d{13})$/.test(a)}function xd({onAdded:t,formId:a,title:o,setTitle:s,onBusy:r}){const[i,l]=c.useState(""),[h,d]=c.useState(""),[m,p]=c.useState(""),[u,f]=c.useState("");async function b(y){if(y.preventDefault(),!o.trim())return f(n("error.validate.title-required.lower"));let v,g;if(h.trim()){const k=hn(h);if(!k.year)return f(n("error.validate.year"));v=k.year,g=k.circa}r==null||r(!0),f("");const w=await X("POST","/books",{title:o.trim(),author:i.trim()||void 0,isbn:m.trim()||void 0,published_year:v,published_circa:g});r==null||r(!1),w.ok?t(w.data):f(le(w,n("error.add.book")))}return e.jsxs("form",{id:a,onSubmit:b,className:"space-y-3",children:[e.jsx(xe,{label:n("common.field.title.label"),nameCase:!0,value:o,autoFocus:!0,onChange:y=>s(y.target.value)}),e.jsx(xe,{label:n("common.field.author.label"),nameCase:!0,value:i,onChange:y=>l(y.target.value)}),e.jsxs("div",{className:"grid gap-3 sm:grid-cols-2",children:[e.jsx(xe,{label:n("common.field.year.label"),inputMode:"numeric",value:h,maxLength:4,onChange:y=>d(y.target.value.replace(/\D/g,"").slice(0,4))}),e.jsx(xe,{label:n("common.field.isbn.label"),value:m,onChange:y=>p(y.target.value)})]}),e.jsx(ve,{children:u}),!o.trim()&&e.jsx("p",{className:"microcopy",style:{color:"var(--faint)"},children:n("book.form.missing.hint")})]})}function Vg({id:t,onClose:a,creditSeparators:o,onAdd:s,onSearch:r,dataNonce:i}){const{practise:l,practiceDialog:h}=qa(),[d,m]=c.useState(null),[p,u]=c.useState(!1),[f,b]=c.useState(!1),[y,v]=c.useState(""),[g,w]=c.useState(null),[k,S]=c.useState(!1),[N,j]=c.useState(null),x=(N==null?void 0:N.total)??null,[M,q]=c.useState(null),[E,O]=c.useState(null),[_,T]=c.useState(null),[B,L]=c.useState(""),[V,P]=c.useState(!1),{map:C}=Qe("author"),{map:H}=Qe("translator"),{map:R}=Qe("editor"),I=Rs(),U=_e();async function te(){const Q=await X("GET",`/books/${t}`);Q.ok?m(Q.data):v(le(Q))}c.useEffect(()=>{m(null),u(!1),j(null),te()},[t]),c.useEffect(()=>(Qt(d?[Jc("book",d.id,d.title)]:[]),()=>Qt([])),[d]);async function D(Q,ie){P(!0);const he={status:Q,progress:(d==null?void 0:d.progress)||0,pos_unit:(d==null?void 0:d.pos_unit)||"",pos:(d==null?void 0:d.pos)||0,pos_total:(d==null?void 0:d.pos_total)||0};Q===dt.book?he.started_at=ie||"":(Q==="completed"||Q==="abandoned")&&(he.finished_at=ie||"");const ue=await X("PUT",`/books/${t}/status`,he);P(!1),ue.ok?m(ue.data):v(le(ue,n("error.save.generic")))}async function z(Q){if(d){if(Q===dt.book&&d.status!=="paused"){const ie=await X("GET","/books");if(!ie.ok)return v(le(ie));const he=(ie.data.books||[]).filter(ue=>ya("book",ue)&&ue.id!==d.id);if(he.length>=qn.book){L(""),O(he);return}}if(Q===""||Q==="paused")return D(Q,"");q({status:Q,date:Wt()})}}async function K(Q){T(Q.id);const ie=await Gg(Q.id,{status:"completed",finished_at:Wt()});if(T(null),ie)return L(ie);const he=E.filter(ue=>ue.id!==Q.id);if(he.length<qn.book){O(null),q({status:dt.book,date:Wt()});return}O(he)}async function A(Q){P(!0);const ie=await X("PUT",`/books/${t}/status`,{status:d.status,...Q});P(!1),ie.ok?m(ie.data):v(le(ie,n("error.save.generic")))}async function Y(){if(!confirm(`Delete "${d.title}" and all its annotations?`))return;const Q=await Wn(`/books/${t}`,{label:n("book.toast.deleted")});Q.ok?a():v(le(Q))}async function G(Q){const ie=await X("PUT",`/books/${t}`,{...Ug(d),...Q});ie.ok?m(ie.data):v(le(ie,n("error.save.generic")))}const ae=(Q,ie,he)=>Je(ie||"",mn(o)).map(ue=>e.jsx(Po,{kind:Q,name:ue,person:he[ue],size:28,onOpen:w},`${Q}-${ue}`)),Z=(Q,ie,he,ue)=>{const re=ae(Q,he,ue);return re.length===0?null:e.jsxs("span",{className:"inline-flex items-center gap-1.5",children:[e.jsx($,{style:{color:"var(--faint)"},children:ie}),re]},Q)},pe=d?[...ae("author",d.author,C),Z("translator",n("book.credit.translator.label"),d.translator,H),Z("editor",n("book.credit.editor.label"),d.editor,R),Rt(d.published_year,d.published_circa)||null,Us(d)||null].filter(Boolean):[],ce=d?d.title||n("book.title.fallback"):"",F=d&&d.author?d.author:"";return e.jsxs("section",{ref:I,className:"reveal space-y-6 md:pt-4","data-screen-label":"book-detail",children:[U&&e.jsx(xr,{onClose:a,title:ce,meta:F,actions:e.jsxs(e.Fragment,{children:[e.jsx(Pe,{icon:e.jsx(Ht,{}),label:n("common.action.filter.label"),ariaLabel:n("book.filter.aria"),onClick:()=>S(!0)}),e.jsx(Pe,{icon:e.jsx(tt,{}),label:n("common.action.capture.label"),ariaLabel:n("book.capture.aria"),onClick:()=>s==null?void 0:s("quote",{type:"book",id:t})}),e.jsx(It,{items:[{icon:e.jsx(Ks,{size:24}),label:ln("book",(d==null?void 0:d.status)||"",dt.book,d||{}),onClick:()=>z(dt.book)},{icon:e.jsx(rt,{}),label:n("book.export.label"),onClick:()=>{d&&(window.location.href=`/api/books/${d.id}/export`)}},{icon:e.jsx(kt,{}),label:n("nav.tab.search.label"),onClick:()=>r==null?void 0:r()},{icon:e.jsx(Ct,{}),label:n("book.practise.menu.label"),onClick:()=>d&&l({book:d.id,label:d.title})},{icon:e.jsx(un,{}),label:n("common.work.details.title"),onClick:()=>u(!0)},{icon:e.jsx(Oo,{size:24}),label:n("shell.help.menu.label"),onClick:()=>b(!0)},{icon:e.jsx(Fe,{}),label:n("common.action.delete.label"),onClick:Y,danger:!0}]})]})}),!U&&e.jsx("button",{className:"mono-label",style:{background:"none",border:"none",cursor:"pointer",padding:"6px 0"},onClick:a,children:"← Library"}),e.jsx(ve,{children:y}),d&&e.jsx("div",{children:e.jsx(wd,{cover:e.jsx(Ou,{path:d.cover_path,title:d.title,hero:!0,zoomable:!0}),shadow:"drop-shadow(0 12px 22px rgba(0,0,0,.34))",title:d.title,titleSize:"var(--type-display-26)",titleStyle:{lineHeight:1.15},meta:pe.length>0&&e.jsx("div",{className:"mono-label",style:{display:"flex",flexWrap:"wrap",alignItems:"center",rowGap:2,fontSize:"var(--type-ui-12)"},children:pe.map((Q,ie)=>e.jsxs("span",{style:{display:"inline-flex",alignItems:"center"},children:[ie>0&&e.jsx("span",{"aria-hidden":"true",style:{margin:"0 8px"},children:"·"}),Q]},ie))}),counts:e.jsx(yd,{counts:N,noun:[n("unit.quote.one"),n("unit.quote.other")]}),favorite:d.favorite,onFavorite:Q=>G({favorite:Q}),tags:e.jsx(gd,{kind:"book",item:d,status:d.status,progress:d.progress,pos:d,reads:d.reads,onReadsChanged:te,wishlist:x===0,busy:V,onSelect:z,onProgress:A}),genres:Za(d),description:d.description,actions:U?null:e.jsxs(e.Fragment,{children:[e.jsx(ge,{onClick:()=>z(dt.book),disabled:V,children:ln("book",d.status||"",dt.book,d)}),e.jsx(Pe,{icon:e.jsx(rt,{}),label:n("common.action.export.label"),ariaLabel:n("book.export.aria"),onClick:()=>window.location.href=`/api/books/${d.id}/export`,tooltip:n("book.export.tip")}),e.jsx(Pe,{icon:e.jsx(Ct,{}),label:n("common.action.practise.label"),ariaLabel:n("book.practise.aria"),onClick:()=>l({book:d.id,label:d.title}),tooltip:n("book.practise.tip")}),e.jsx(Pe,{icon:e.jsx(un,{}),label:n("common.work.details.title"),ariaLabel:n("common.work.details.title"),onClick:()=>u(!0),tooltip:n("book.details.tip")}),e.jsx(Pe,{icon:e.jsx(Fe,{}),label:n("common.action.delete.label"),ariaLabel:n("book.delete.aria"),onClick:Y,danger:!0,tooltip:n("book.delete.tip")})]})})}),d&&e.jsx(qc,{open:p,onClose:()=>u(!1),kind:"book",item:d,onChanged:m,onDelete:Y}),e.jsx(pd,{open:!!E,items:(E||[]).map(Q=>({id:Q.id,title:Q.title,meta:[Q.author,Rt(Q.published_year,Q.published_circa)||null].filter(Boolean).join(" · ")})),cap:qn.book,noun:n("unit.book.one"),nounPlural:n("unit.book.other"),verb:n("common.shelf.reading.book.label"),pastLabel:n("book.shelf.cap.past.label"),busyId:_,error:B,onRelease:K,onCancel:()=>O(null),onProceed:()=>{O(null),q({status:dt.book,date:Wt()})}}),e.jsx(fd,{open:!!M,title:M?ln("book",(d==null?void 0:d.status)||"",M.status,d||{}):"",label:n((M==null?void 0:M.status)===dt.book?"book.shelf.started.label":(M==null?void 0:M.status)==="abandoned"?"book.shelf.abandoned.label":"book.shelf.finished.label"),value:(M==null?void 0:M.date)||"",onChange:Q=>q(ie=>ie&&{...ie,date:Q}),onCancel:()=>q(null),onConfirm:()=>{const Q=M;q(null),D(Q.status,Q.date)}}),d&&e.jsx(tb,{bookId:d.id,book:d,authorMap:C,seps:mn(o),onStats:j,mobileFilterOpen:k,onMobileFilterOpen:S,onAdd:s,dataNonce:i}),g&&e.jsx(yn,{kind:g.kind,name:g.name,onClose:()=>w(null)}),h,e.jsx(fc,{screen:"book-detail",open:f,onClose:()=>b(!1)})]})}function Yg({kind:t,id:a,title:o,onDone:s,onCancel:r}){const[i,l]=c.useState(null),[h,d]=c.useState("");return c.useEffect(()=>{l(null),d(""),X("GET",`/${t}/${a}`).then(m=>m.ok?l(m.data):d(le(m)))},[t,a]),e.jsx(Ge,{open:!0,onClose:r,title:o,children:h?e.jsx(ve,{children:h}):i?e.jsx(jd,{book:i,onSaved:s,onCancel:r}):e.jsx("p",{className:"microcopy",children:"loading…"})})}function jd({book:t,onSaved:a,onCancel:o}){const[s,r]=c.useState(t.title||""),[i,l]=c.useState(t.author||""),[h,d]=c.useState(t.translator||""),[m,p]=c.useState(t.editor||""),[u,f]=c.useState(t.isbn||""),[b,y]=c.useState(t.asin||""),[v,g]=c.useState(Rt(t.published_year,t.published_circa)),[w,k]=c.useState(t.genres||[]),[S,N]=c.useState([]);c.useEffect(()=>{X("GET","/genres").then(A=>{A.ok&&N(A.data.genres||[])})},[]);const[j,x]=c.useState(t.series||""),[M,q]=c.useState(t.series_index?String(t.series_index):""),[E,O]=c.useState(t.description||""),[_,T]=c.useState(t.cover_path||""),[B,L]=c.useState(""),[V,P]=c.useState(!1),[C,H]=c.useState(""),[R,I]=c.useState(!1),U=(A,Y)=>String(A).trim()?A:Y||A;function te(A,Y=!1){const G=Z=>Z!=null&&String(Z).trim()!=="",ae=Y?(Z,pe)=>G(pe)?pe:Z:U;r(Z=>ae(Z,A.title)),l(Z=>ae(Z,A.author)),f(Z=>ae(Z,A.isbn13)),g(Z=>ae(Z,A.published_year?String(A.published_year):"")),O(Z=>ae(Z,A.description)),k(Z=>Y?A.genres&&A.genres.length?A.genres:Z:Z.length?Z:A.genres||[]),x(Z=>ae(Z,A.series)),q(Z=>ae(Z,A.series_index?String(A.series_index):"")),A.cover_url&&(Y||!_&&!B)&&(L(A.cover_url),P(!1))}const[D,z]=c.useState(!1);async function K(A){if(A.preventDefault(),!s.trim())return H(n("error.validate.title-required.lower"));let Y,G;if(v.trim()){const Z=hn(v);if(!Z.year)return H(n("error.validate.year"));Y=Z.year,G=Z.circa}I(!0),H("");const ae=await X("PUT",`/books/${t.id}`,{title:s.trim(),author:i.trim(),translator:h.trim(),editor:m.trim(),isbn:u.trim(),asin:b.trim(),published_year:Y,published_circa:G,genres:w,series:j.trim(),series_index:Number(M)||0,description:E.trim(),favorite:!!t.favorite,cover_url:B||void 0,clear_cover:V||void 0});I(!1),ae.ok?a():H(le(ae,n("error.save.generic")))}return e.jsxs("form",{onSubmit:K,className:"space-y-3",children:[e.jsx(tr,{kind:"books",id:t.id,currentPath:_,asin:b,coverUrl:B,clearCover:V,onSetUrl:A=>{L(A),P(!1)},onClear:A=>{A===!0?(L(""),P(!1)):(P(!0),L(""))},onUploaded:A=>T(A.cover_path||""),onFetchMeta:()=>z(A=>!A),fetchMetaOpen:D,search:{isbn:u,title:s,author:i,asin:b}}),D&&e.jsx(lc,{auto:!0,isbn:u,title:s,author:i,asin:b,onPick:A=>{te(A,!0),z(!1)},onClose:()=>z(!1)}),e.jsxs("div",{className:"grid gap-3 sm:grid-cols-2",children:[e.jsx(xe,{label:n("common.field.title.label"),nameCase:!0,value:s,onChange:A=>r(A.target.value)}),e.jsx(xe,{label:n("common.field.author.label"),nameCase:!0,value:i,onChange:A=>l(A.target.value)}),e.jsx(xe,{label:n("common.field.translator.label"),nameCase:!0,placeholder:n("book.form.translator.placeholder"),value:h,onChange:A=>d(A.target.value)}),e.jsx(xe,{label:n("common.field.editor.label"),nameCase:!0,placeholder:n("book.form.editor.placeholder"),value:m,onChange:A=>p(A.target.value)}),e.jsx(xe,{label:n("common.field.isbn.label"),value:u,onChange:A=>f(A.target.value)}),e.jsx(xe,{label:n("common.field.asin.label"),value:b,onChange:A=>y(A.target.value)}),e.jsx(xe,{label:n("common.field.year.label"),inputMode:"numeric",value:v,maxLength:4,onChange:A=>g(A.target.value.replace(/\D/g,"").slice(0,4))})]}),e.jsxs("label",{className:"block",children:[e.jsx($,{className:"mb-1.5 block",children:n("common.field.genres.label")}),e.jsx(pt,{value:w,onChange:k,suggestions:S,placeholder:n("common.field.genres.placeholder"),ariaLabel:n("common.field.genres.label"),transform:Mo})]}),e.jsxs("div",{className:"grid gap-3 sm:grid-cols-[1fr_auto]",children:[e.jsx(xe,{label:n("common.field.series.label"),nameCase:!0,placeholder:n("book.form.series.placeholder"),value:j,onChange:A=>x(A.target.value)}),e.jsx(xe,{label:n("common.field.series-no.label"),inputMode:"decimal",placeholder:n("book.form.series-no.placeholder"),value:M,onChange:A=>q(A.target.value)})]}),e.jsxs("label",{className:"block",children:[e.jsx($,{className:"mb-1.5 block",children:n("common.field.description.label")}),e.jsx("textarea",{className:"tp-input",rows:"4",value:E,onChange:A=>O(A.target.value)})]}),e.jsx(ve,{children:C}),e.jsxs("div",{className:"flex gap-2",children:[e.jsx("button",{className:vd,disabled:R||!s.trim(),children:"Save"}),e.jsx(ge,{type:"button",onClick:o,children:"Cancel"})]})]})}function Sr(t){return{quote:t.quote||"",note:t.note||"",chapter:t.chapter||"",chapter_no:t.chapter_no||0,location:t.location||"",character:t.character||"",translation:t.translation||"",color:t.color||"yellow",tags:t.tags||[],favorite:!!t.favorite,sticker_id:t.sticker_id??null,sticker_x:t.sticker_x??null,sticker_y:t.sticker_y??null}}function Bn(t){return t.noted_at||t.created_at||""}function pn(t){if(!t)return"";const a=new Date(String(t).replace(" ","T"));return Number.isNaN(a.getTime())?"":a.toLocaleDateString(void 0,{year:"numeric",month:"short",day:"numeric"})}function Qg(t){const a=String(t.location||"").match(/\d+/);return a?parseInt(a[0],10):-1}function Xg({acts:t,a,color:o,onColor:s,patch:r,actionsAlwaysVisible:i}){return e.jsxs("div",{className:"mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 pt-1.5",children:[e.jsx(On,{value:!!a.favorite,onChange:l=>r(a,{favorite:l})}),e.jsx(fa,{actions:Dn(t),alwaysVisible:i}),e.jsx("span",{className:"card-colors shrink-0"+(i?" is-visible":""),children:e.jsx(nt,{value:o,onChange:s,ariaLabel:n("common.colour.category.aria"),collapsible:!0})}),e.jsx("span",{className:"ml-auto flex items-center",children:e.jsx(ga,{actions:In(t)})})]})}function vo({a:t,variant:a,tagMap:o,stickerMap:s={},stickers:r=[],reloadStickers:i,editing:l,setEditingId:h,save:d,patch:m,remove:p,onCopy:u,onShare:f,quoteLines:b=6,tagSuggestions:y=[],actionsAlwaysVisible:v=!1,editInline:g=!1,expanded:w,onToggleExpand:k,meta:S,form:N=zo,selection:j,selectKind:x="annotation",onMoveBoard:M}){const q=t.sticker_id!=null?s[t.sticker_id]:null,E=typeof k=="function",O=pn(Bn(t)),[_,T]=c.useState(null);c.useEffect(()=>{T(null)},[t.color]);const B=_||t.color,L=async z=>{z!==B&&(T(z),await m(t,{color:z})===!1&&T(null))},V=S===void 0?[t.character,dn(t)&&n("common.locator.chapter.label",{name:dn(t)}),t.location&&n("common.locator.page.short.label",{n:t.location}),O].filter(Boolean).join(" · "):S,P=e.jsx(N,{initial:t,onSubmit:z=>d(t.id,z),onCancel:()=>h(null),submitLabel:n("common.action.save.label"),tagSuggestions:y,stickers:r,reloadStickers:i,bookId:t.book_id??null}),C=_a("annotation",t,{copy:u,share:f,edit:z=>h(z.id),favourite:z=>m(z,{favorite:!z.favorite}),favourited:!!t.favorite,setBoard:M,remove:p}),H=[...mr(j,t.id,x),...C.map(z=>({...z,onClick:z.run}))],{cardProps:R,menuClass:I,menu:U}=Lo(H,j?{onLongPress:()=>j.toggle(t.id,x)}:void 0),te=!!(j!=null&&j.isSelected(t.id)),D=j?z=>{const K=ur(z,j);K!=="open"&&(z.preventDefault(),z.stopPropagation(),K==="extend"?j.extendTo(t.id,x):j.toggle(t.id,x))}:void 0;return g&&l?e.jsx(Xe,{variant:a,colorBar:B,className:"px-5 py-4",children:P}):e.jsxs(Xe,{variant:a,colorBar:B,className:`px-5 py-4 ${I}${te?" is-picked":""}${j!=null&&j.active?" is-selecting":""}`,...R,onClickCapture:z=>{var K;(K=R.onClickCapture)!=null&&K.call(R,z)||D==null||D(z)},children:[j&&e.jsx(Xs,{picked:te,label:n("common.quote.pick.label"),onChange:()=>j.toggle(t.id,x)}),!g&&e.jsx(Ge,{open:l,onClose:()=>h(null),title:n("common.quote.edit.title"),children:P}),e.jsxs("div",{className:"space-y-2",children:[t.quote&&(q?e.jsx(dc,{text:t.quote,quoteStyle:bs,stickerKey:`s${q.id}`,maxLines:b,pos:t.sticker_x!=null?{x:t.sticker_x,y:t.sticker_y}:null,onMove:(z,K)=>m(t,{sticker_x:z,sticker_y:K}),sticker:e.jsx(Oc,{sticker:q}),open:E?!!w:void 0,onToggle:E?k:void 0}):e.jsx(Co,{text:t.quote,lines:b,style:bs,open:E?!!w:void 0,onToggle:E?k:void 0})),e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx(Wl,{item:t}),e.jsx($s,{item:t,parent:x==="annotation"?"book":""}),V&&e.jsx($,{className:"block",children:V})]}),t.translation&&e.jsx(Dl,{children:t.translation}),t.note&&e.jsx(Eo,{children:t.note}),t.tags&&t.tags.length>0&&e.jsx("div",{className:"flex flex-wrap gap-2 pt-1",children:t.tags.map(z=>{const K=o[z];return e.jsx(Sa,{color:K==null?void 0:K.color,style:K==null?void 0:K.style,children:z},z)})}),e.jsx(Xg,{acts:C,a:t,color:B,onColor:L,patch:m,actionsAlwaysVisible:v})]}),U]})}const Jg=[{key:"quote",get label(){return n("book.table.quote.label")}},{key:"chapter",get label(){return n("book.table.chapter.label")}},{key:"location",get label(){return n("book.table.location.label")}},{key:"date",get label(){return n("book.table.date.label")}},{key:"favorite",get label(){return n("book.table.favourite.label")}}];function Zg({rows:t,tagMap:a,stickers:o=[],reloadStickers:s,sort:r,onSort:i,editingId:l,setEditingId:h,save:d,remove:m,onCopy:p,onShare:u}){const f=y=>r.col===y?r.dir==="asc"?" ▲":" ▼":"",b=t.find(y=>y.id===l);return e.jsxs("div",{className:"ann-table-wrap",children:[e.jsxs("table",{className:"ann-table",children:[e.jsx("thead",{children:e.jsxs("tr",{children:[Jg.map(y=>e.jsx("th",{className:"sortable",onClick:()=>i(y.key),"aria-sort":r.col===y.key?r.dir==="asc"?"ascending":"descending":"none",children:e.jsxs(ye,{label:n("book.table.sort.tip"),side:"bottom",children:[y.label,f(y.key)]})},y.key)),e.jsx("th",{})]})}),e.jsx("tbody",{children:t.map(y=>e.jsxs("tr",{children:[e.jsxs("td",{className:"col-quote",children:[e.jsx(Co,{text:y.quote||y.note,lines:2,style:bs}),y.tags&&y.tags.length>0&&e.jsx("div",{className:"mt-1.5 flex flex-wrap gap-1.5",children:y.tags.map(v=>{const g=a[v];return e.jsx(Sa,{color:g==null?void 0:g.color,style:g==null?void 0:g.style,children:v},v)})})]}),e.jsx("td",{className:"col-mono",children:dn(y)||"—"}),e.jsx("td",{className:"col-mono",children:y.location||"—"}),e.jsx("td",{className:"col-mono",children:pn(Bn(y))||"—"}),e.jsx("td",{className:"col-center",children:y.favorite?"♥":"—"}),e.jsx("td",{className:"col-actions",children:e.jsx(Js,{noun:n("unit.quote.one"),nounPlural:n("unit.quote.other"),onCopy:p&&(()=>p(y)),onShare:u&&(()=>u(y)),onEdit:()=>h(y.id),onDelete:()=>m(y)})})]},y.id))})]}),e.jsx(Ge,{open:!!b,onClose:()=>h(null),title:n("common.quote.edit.title"),children:b&&e.jsx(zo,{initial:b,onSubmit:y=>d(b.id,y),onCancel:()=>h(null),submitLabel:n("common.action.save.label"),tagSuggestions:Object.keys(a),stickers:o,reloadStickers:s,bookId:b.book_id??null})})]})}function eb(t,a){if(!a.length||!t||!t.length)return t;const o=new Set(a),s=[];for(const r of a){const i=t.find(l=>l.id===r);i&&s.push(i)}return s.length?[...s,...t.filter(r=>!o.has(r.id))]:t}function tb({bookId:t,book:a,authorMap:o={},seps:s,onStats:r,mobileFilterOpen:i,onMobileFilterOpen:l,onAdd:h,dataNonce:d}){const[m,p]=c.useState(null),[u,f]=c.useState([]),[b,y]=c.useState(null),[v,g]=c.useState(""),[w,k]=c.useState(""),[S,N]=c.useState(!1),[j,x]=c.useState(null),[M,q]=c.useState(null),[E,O]=c.useState(null),[_,T]=c.useState(""),[B,L]=He("tippani:annview","tiles"),[V,P]=c.useState({col:"default",dir:"asc"}),[C,H]=c.useState([]),R=c.useRef(0),I=_e(),U=c.useRef(!0);c.useEffect(()=>{if(U.current){U.current=!1;return}J(null),Be(),Te()},[d]),c.useEffect(()=>{E&&(r==null||r(E))},[E]);const{stickers:te,reload:D}=Oa(),z=!!(v||w||S),K=c.useMemo(()=>Object.fromEntries(u.map(ee=>[ee.name,ee])),[u]),A=c.useMemo(()=>Object.fromEntries(te.map(ee=>[ee.id,ee])),[te]);function Y(ee){H([]),P(je=>je.col===ee?{col:ee,dir:je.dir==="asc"?"desc":"asc"}:{col:ee,dir:"asc"})}const G=c.useMemo(()=>{const ee=m?[...m]:[];if(B!=="table"||V.col==="default")return ee;const je=V.dir==="asc"?1:-1,Ne=Me=>{switch(V.col){case"quote":return(Me.quote||Me.note||"").toLowerCase();case"chapter":return Me.chapter_no?Me.chapter_no:(Me.chapter||"").toLowerCase();case"location":return Qg(Me);case"date":return Bn(Me);case"favorite":return Me.favorite?1:0;default:return 0}};return ee.sort((Me,ze)=>{const fe=Ne(Me),Ae=Ne(ze);return fe<Ae?-je:fe>Ae?je:Me.id-ze.id}),ee},[m,B,V]),ae=c.useMemo(()=>eb(G,C),[G,C]),Z=Ra(ae.map(ee=>ee.id)),pe=()=>{Z.clear(),Be()},ce=To(_l),F=c.useMemo(()=>!C.length||!m?0:C.filter(ee=>m.some(je=>je.id===ee)).length,[C,m]),Q=Xt(ae.length,ae,ld),ie=c.useMemo(()=>ae.slice(0,Math.max(Q.count,F)),[ae,Q.count,F]),he=(a==null?void 0:a.id)||t||1,ue=c.useMemo(()=>Bs(ae.length,Ta(he)),[ae.length,he]),[re,J]=c.useState(null),de=c.useCallback(ee=>J(je=>je===ee?null:ee),[]);c.useEffect(()=>{re!=null&&m&&!m.some(ee=>ee.id===re)&&J(null)},[m,re]),c.useEffect(()=>{J(null)},[ce]);async function Te(){const ee=await X("GET","/tags");ee.ok&&f(ee.data.tags)}async function Be(){const ee=++R.current,je=new URLSearchParams({book_id:t});v&&je.set("color",v),w&&je.set("tag",w),S&&je.set("favorite","1");const Ne=await X("GET",`/annotations?${je}`);ee===R.current&&(Ne.ok?(p(Ne.data.annotations),!v&&!w&&!S&&(q(Ne.data.annotations.length),O(bd(Ne.data.annotations)))):T(le(Ne)))}c.useEffect(()=>{J(null),Be()},[t,v,w,S]),c.useEffect(()=>{Te()},[t]);async function We(ee,je){const Ne=await X("PUT",`/annotations/${ee}`,je);return Ne.ok?(x(null),Be(),Te(),null):le(Ne,n("error.save.annotation"))}async function qe(ee){if(!confirm(n("book.quotes.delete.confirm")))return;const je=await Wn(`/annotations/${ee.id}`,{reload:Be});je.ok?(q(Ne=>Ne==null?Ne:Ne-1),O(Ne=>Pg(Ne,ee)),J(null),Be()):T(le(je))}async function ne(ee,je){const Ne=await X("PUT",`/annotations/${ee.id}`,{...Sr(ee),...je});return Ne.ok?(T(""),wr(je,{fav:S,color:v,tag:w})?Be():p(Me=>(Me||[]).map(ze=>ze.id===ee.id?{...ze,...Ne.data}:ze)),!0):(T(le(Ne,n("error.save.annotation"))),!1)}const me=ee=>Fc({quote:ee.quote,note:ee.note,translation:ee.translation,author:a==null?void 0:a.author,title:a==null?void 0:a.title,published:a==null?void 0:a.published_year,chapter:dn(ee),location:ee.location,character:ee.character,date:pn(Bn(ee)),tags:ee.tags,color:ee.color,people:o,seps:s,characterImages:ee.character_images}),oe=ee=>ba(me(ee)),be=m?z&&M!=null?n("book.quotes.counts.shown",{a:wo(M,"unit.quote"),n:m.length}):wo(m.length,"unit.quote"):"";return e.jsxs("div",{className:"space-y-4",children:[I&&e.jsx($n,{open:i,onClose:()=>l==null?void 0:l(!1),title:n("book.quotes.filter.title"),footer:e.jsx(er,{count:be,onReset:()=>{g(""),k(""),N(!1)},onDone:()=>l==null?void 0:l(!1)}),children:e.jsxs("div",{className:"space-y-5",children:[e.jsxs("div",{children:[e.jsx($,{className:"mb-2 block",children:"color"}),e.jsx(nt,{value:v,onChange:ee=>g(ee===v?"":ee)})]}),u.length>0&&e.jsxs("div",{children:[e.jsx($,{className:"mb-2 block",children:"tag"}),e.jsx(Oe,{ariaLabel:n("common.filters.tag.aria"),value:w,onChange:k,options:[["",n("common.filters.tag.all.label")],...u.map(ee=>[ee.name,ee.name])]})]}),e.jsxs("div",{children:[e.jsx($,{className:"mb-2 block",children:"show only"}),e.jsx("div",{className:"flex flex-wrap items-center gap-2",children:e.jsx("button",{onClick:()=>N(!S),className:ct(S),title:n("common.favourite.filter.tip"),children:"♥ favourites"})})]}),e.jsxs("div",{children:[e.jsx($,{className:"mb-2 block",children:"view"}),e.jsx(co,{value:B,onChange:L})]})]})}),!I&&e.jsxs("div",{className:"flex flex-wrap items-center gap-3",children:[e.jsx($,{children:n("book.quotes.filter.label")}),e.jsx(nt,{value:v,onChange:ee=>g(ee===v?"":ee)}),u.length>0&&e.jsx(Oe,{ariaLabel:n("common.filters.tag.aria"),value:w,onChange:k,options:[["",n("common.filters.tag.all.label")],...u.map(ee=>[ee.name,ee.name])]}),e.jsx("button",{onClick:()=>N(!S),className:ct(S),title:n("common.favourite.filter.tip"),children:"♥ favourites"}),e.jsxs("span",{className:"ml-auto flex items-center gap-3 view-toggle-row",children:[e.jsx($,{children:be}),e.jsx(co,{value:B,onChange:L}),e.jsx(ge,{onClick:()=>h==null?void 0:h("quote",{type:"book",id:t}),children:n("book.quotes.capture.label")})]})]}),e.jsx(ve,{children:_}),m&&m.length===0&&e.jsx(Vt,{children:n(z?"book.quotes.nomatch":"book.quotes.empty")}),Z.open&&e.jsx(Da,{selection:Z,rows:ae,onDone:pe,tagSuggestions:Object.keys(K),onEdit:x}),m&&m.length>0&&B==="table"&&e.jsx(Zg,{rows:ae,tagMap:K,stickers:te,reloadStickers:D,sort:V,onSort:Y,editingId:j,setEditingId:x,save:We,remove:qe,onCopy:oe,onShare:y}),m&&m.length>0&&B==="list"&&e.jsxs("div",{className:"space-y-4",children:[ie.map((ee,je)=>e.jsx(vo,{a:ee,variant:je%4,tagMap:K,stickerMap:A,stickers:te,reloadStickers:D,editing:j===ee.id,setEditingId:x,save:We,patch:ne,remove:qe,onCopy:oe,onShare:y,quoteLines:5,tagSuggestions:Object.keys(K),selection:Z},ee.id)),Q.more&&e.jsx("div",{ref:Q.sentinel,"aria-hidden":"true",className:"h-px"})]}),m&&m.length>0&&B==="tiles"&&e.jsxs(e.Fragment,{children:[e.jsx(Ao,{columns:ce,gap:16,seed:he,pinnedCount:F,lockOrder:re!=null,order:"source",children:ie.map((ee,je)=>e.jsx(vo,{a:ee,variant:je%4,tagMap:K,stickerMap:A,stickers:te,reloadStickers:D,editing:j===ee.id,setEditingId:x,save:We,patch:ne,remove:qe,onCopy:oe,onShare:y,quoteLines:ue[je],tagSuggestions:Object.keys(K),expanded:re===ee.id,onToggleExpand:()=>de(ee.id),selection:Z},ee.id))}),Q.more&&e.jsx("div",{ref:Q.sentinel,"aria-hidden":"true",className:"h-px"})]}),b&&e.jsx(Ho,{share:me(b),seen:{kind:"book",id:b.id},onClose:()=>y(null)})]})}function zo({initial:t,onSubmit:a,onCancel:o,submitLabel:s,tagSuggestions:r=[],stickers:i=[],reloadStickers:l,bookId:h=null}){const[d,m]=c.useState((t==null?void 0:t.quote)||""),[p,u]=c.useState((t==null?void 0:t.note)||""),[f,b]=c.useState((t==null?void 0:t.translation)||""),[y,v]=c.useState((t==null?void 0:t.chapter)||""),[g,w]=c.useState(t!=null&&t.chapter_no?String(t.chapter_no):""),[k,S]=c.useState((t==null?void 0:t.location)||""),[N,j]=c.useState((t==null?void 0:t.character)||""),[x,M]=c.useState((t==null?void 0:t.color)||"yellow"),[q,E]=c.useState((t==null?void 0:t.tags)||[]),[O,_]=c.useState((t==null?void 0:t.sticker_id)??null),[T,B]=c.useState(""),[L,V]=c.useState(!1),P=oc(h?{kind:"book",id:h}:null),C=`ann-${h||0}`,H=!d.trim()&&!p.trim()?n("error.validate.quote-or-note"):"",R=qo(L?n("common.action.save.busy"):H);async function I(U){if(U.preventDefault(),H)return B(H.toLowerCase());V(!0),B("");const te=await a({quote:d.trim(),note:p.trim(),translation:f.trim(),chapter:y.trim(),chapter_no:Number(g.trim())||0,location:k.trim(),character:N.trim(),color:x,tags:q,favorite:!!(t!=null&&t.favorite),sticker_id:O,sticker_x:(t==null?void 0:t.sticker_x)??null,sticker_y:(t==null?void 0:t.sticker_y)??null});if(V(!1),te)return B(te);t||(m(""),u(""),b(""),v(""),S(""),j(""),M("yellow"),E([]),_(null))}return e.jsxs("form",{id:R==null?void 0:R.formId,onSubmit:I,className:"ann-form space-y-3",children:[e.jsxs("label",{className:"block",children:[e.jsx($,{className:"mb-1.5 block",children:n("common.field.quote.label")}),e.jsx("textarea",{className:"tp-input",rows:"3",value:d,onChange:U=>m(U.target.value)})]}),e.jsxs("label",{className:"block",children:[e.jsx($,{className:"mb-1.5 block",children:n("common.field.translation.label")}),e.jsx("textarea",{className:"tp-input",rows:"2",placeholder:n("common.field.translation.placeholder"),value:f,onChange:U=>b(U.target.value)})]}),e.jsxs("label",{className:"block",children:[e.jsx($,{className:"mb-1.5 block",children:n("common.field.note.label")}),e.jsx("textarea",{className:"tp-input",rows:"2",value:p,onChange:U=>u(U.target.value)})]}),e.jsxs("div",{className:"cl-grid",children:[e.jsx(xe,{label:n("common.field.chapter-no.label"),inputMode:"decimal",placeholder:n("book.quote.form.chapter-no.placeholder"),value:g,list:P.chapterNumbers.length?`${C}-chno`:void 0,onChange:U=>w(U.target.value.replace(/[^\d.]/g,"").slice(0,7))}),e.jsx(xe,{label:n("common.field.chapter-name.label"),value:y,list:P.chapterNames.length?`${C}-chname`:void 0,onChange:U=>{const te=U.target.value,D=P.chapterNoFor(te);v(te),D&&!String(g).trim()&&w(String(D))}}),e.jsx(go,{id:`${C}-chno`,options:P.chapterNumbers}),e.jsx(go,{id:`${C}-chname`,options:P.chapterNames})]}),e.jsxs("div",{className:"cl-grid",children:[e.jsx(xe,{label:n("common.field.location.label"),placeholder:n("book.quote.form.location.placeholder"),value:k,onChange:U=>S(U.target.value)}),e.jsx(us,{label:n("common.field.character.label"),placeholder:n("book.quote.form.character.placeholder"),value:N,onChange:j,cast:P.cast})]}),e.jsxs("label",{className:"block",children:[e.jsx($,{className:"mb-1.5 block",children:n("common.field.tags.label")}),e.jsx(pt,{value:q,onChange:E,suggestions:r,placeholder:n("common.field.tags.placeholder"),ariaLabel:n("common.field.tags.label")})]}),e.jsxs("div",{className:"block",children:[e.jsx($,{className:"mb-1.5 block",children:n("common.field.sticker.label")}),e.jsx(Fo,{value:O,onChange:_,stickers:i,reload:l})]}),e.jsxs("div",{className:"flex flex-wrap items-center gap-3 pt-1",children:[e.jsx($,{children:n("common.mono.colour.label")}),e.jsx(nt,{value:x,onChange:M}),!R&&e.jsxs("div",{className:"ml-auto flex gap-2",children:[o&&e.jsx(ge,{type:"button",onClick:o,children:n("common.action.cancel.label")}),e.jsx("button",{className:vd,disabled:L||!!H,title:H||void 0,children:s})]})]}),e.jsx(ve,{children:T})]})}const Sd=Object.freeze(Object.defineProperty({__proto__:null,AnnotationCard:vo,AnnotationForm:zo,EditBook:jd,ManualTab:xd,annDate:Bn,annotationState:Sr,default:$g,fmtDate:pn,isIsbn:kd},Symbol.toStringTag,{value:"Module"})),Ui={movie:{one:"unit.film.one",other:"unit.film.other",past:"film.shelf.cap.past.label"},show:{one:"unit.show.one",other:"unit.show.other",past:"film.shelf.cap.past.label"},game:{one:"unit.game.one",other:"unit.game.other",past:"common.shelf.move.completed.played.label"}};function nb({openId:t,onOpen:a,onClose:o,creditSeparators:s,onAdd:r,onSearch:i,dataNonce:l}){return t?e.jsx(db,{id:t,onClose:o,creditSeparators:s,onAdd:r,dataNonce:l,onSearch:i}):e.jsx(lb,{onOpen:a,creditSeparators:s,dataNonce:l})}function ko({className:t="",children:a,...o}){const s=Rs();return e.jsx("div",{ref:s,className:"reveal "+t,...o,children:a})}function ab({group:t,coverSize:a,onOpen:o,directorMap:s,creditSeps:r,selection:i,afterBulk:l,setEditWork:h}){const d=Xt(t.items.length,t.items);return e.jsxs("section",{children:[e.jsx(kr,{label:t.label,count:t.items.length,noun:n("unit.title.one"),nounPlural:n("unit.title.other")}),e.jsxs("div",{className:"grid gap-x-5 gap-y-8",style:{gridTemplateColumns:`repeat(auto-fill, minmax(${a}px, 1fr))`},children:[t.items.slice(0,d.count).map(m=>e.jsx(vr,{kind:"movie",item:m,onOpen:o,people:s,seps:r,selection:i,onChanged:l,onEdit:h},m.id)),d.more&&e.jsx("div",{ref:d.sentinel,"aria-hidden":"true",className:"h-px"})]})]})}const ob=[["none","movies.group.none.label"],["series","movies.group.series.label"],["author","movies.group.author.label"],["decade","movies.group.decade.label"],["genre","movies.group.genre.label"]],Gi=()=>ob.map(([t,a])=>[t,n(a)]),Ki=(t,a)=>n("common.count.phrase",{n:t,noun:n(a,{count:t})}),Nr={fontFamily:"var(--font-mono)",fontStyle:"var(--font-mono-style)",fontVariantCaps:"var(--font-mono-caps)",fontVariantNumeric:"var(--font-mono-figures)",fontSize:"var(--type-mono-12)",fontWeight:500,letterSpacing:".12em",textTransform:"uppercase",color:"var(--amber)"};function sb({path:t,title:a,className:o="",zoomable:s=!1}){const[r,i]=c.useState(!1);if(t){const l=e.jsx("img",{src:$e(t),alt:a?`Poster of ${a}`:"",className:"block w-full object-cover "+o,style:{aspectRatio:"2 / 3",border:"1px solid var(--line)",borderRadius:8}});return s?e.jsxs(e.Fragment,{children:[e.jsx(ye,{label:n("movies.poster.open.tip"),className:"w-full",children:e.jsx("button",{type:"button",className:"cover-zoom-btn","aria-label":a?n("movies.poster.fullscreen.aria",{title:a}):n("movies.poster.fullscreen.plain.aria"),onClick:()=>i(!0),children:l})}),r&&e.jsx(Ws,{path:t,title:a,onClose:()=>i(!1)})]}):l}return e.jsx(Dt,{kind:n("common.badge.poster"),className:"w-full "+o})}function rb(t){return{title:t.title,director:t.director||"",publisher:t.publisher||"",release_year:t.release_year||0,description:t.description||"",genres:t.genres||[],media_type:t.media_type||"movie",series:t.series||"",series_index:t.series_index||0,favorite:!!t.favorite,imdb_id:t.imdb_id||""}}async function ib(t,a){const o=await X("PUT",`/movies/${t}/status`,a);return o.ok?"":le(o,n("error.save.generic"))}function lb({onOpen:t,creditSeparators:a,dataNonce:o}){var qe;const[s,r]=c.useState(null),{map:i}=Qe("director"),l=c.useMemo(()=>mn(a),[a]),[h,d]=c.useState(null),[m,p]=c.useState([]),[u,f]=c.useState("none"),b=c.useMemo(()=>({mediaType:st(m,"media"),genre:st(m,"genre"),series:st(m,"series"),fav:st(m,"favourite")==="yes",tagged:st(m,"tagged")==="yes",noted:st(m,"noted")==="yes",actor:st(m,"actor"),wish:{yes:"wishlist",no:"annotated"}[st(m,"wishlist")]||"",states:Qc(m,"shelf")}),[m]),{mediaType:y,genre:v,series:g,fav:w,tagged:k,noted:S,actor:N,wish:j,states:x}=b,M=ne=>p(me=>Ze(me,"media",ne)),q=ne=>p(me=>Ze(me,"genre",ne)),E=ne=>p(me=>Ze(me,"series",ne)),O=ne=>p(me=>Ze(me,"actor",ne)),_=ne=>p(me=>Ze(me,"favourite",ne?"yes":"")),T=ne=>p(me=>Ze(me,"tagged",ne?"yes":"")),B=ne=>p(me=>Ze(me,"noted",ne?"yes":"")),L=ne=>p(me=>Ze(me,"wishlist",ne==="wishlist"?"yes":ne==="annotated"?"no":"")),V=ne=>p(me=>Xc(me,"shelf",ne)),[P,C]=c.useState("recent"),[H,R]=c.useState(!1),[I,U]=c.useState(""),[te]=Pl("tippani:size:movies",150),D=_e();c.useEffect(()=>(Qt(Yc(m)),()=>Qt([])),[m]);async function z(){const ne=await X("GET","/movies");ne.ok?r(ne.data.movies):U(le(ne))}c.useEffect(()=>{z()},[o]),c.useEffect(()=>{X("GET","/metadata/status").then(ne=>{ne.ok&&d(ne.data)})},[]);const K=(qe=h==null?void 0:h.tmdb)==null?void 0:qe.source,A=(s||[]).some(ne=>(ne.media_type||"movie")==="show"),Y=(s||[]).some(ne=>ne.media_type==="game"),G=c.useMemo(()=>{const ne=[["",n("movies.filters.media.all.label")],["movie",n("movies.filters.media.movie.label")]];return A&&ne.push(["show",n("movies.filters.media.show.label")]),Y&&ne.push(["game",n("movies.filters.media.game.label")]),ne},[A,Y]),ae=A||Y,Z=c.useMemo(()=>{const ne=new Map;for(const me of s||[])for(const oe of me.genres||[])ne.set(oe,(ne.get(oe)||0)+1);return[...ne.keys()].sort((me,oe)=>ne.get(oe)-ne.get(me)||me.localeCompare(oe))},[s]),pe=c.useMemo(()=>{const ne=new Set;for(const me of s||[])me.series&&ne.add(me.series);return[...ne].sort()},[s]),ce=c.useMemo(()=>{const ne=new Set;for(const me of s||[])for(const oe of me.actors||[])for(const be of Je(oe,l))ne.add(be);return[...ne].sort((me,oe)=>me.localeCompare(oe))},[s,l]),F=c.useMemo(()=>{let ne=s||[];return y&&(ne=ne.filter(me=>(me.media_type||"movie")===y)),v&&(ne=ne.filter(me=>(me.genres||[]).includes(v))),g&&(ne=ne.filter(me=>(me.series||"")===g)),N&&(ne=ne.filter(me=>(me.actors||[]).some(oe=>Je(oe,l).includes(N)))),w&&(ne=ne.filter(me=>me.favorite)),k&&(ne=ne.filter(me=>(me.tagged_count||0)>0)),S&&(ne=ne.filter(me=>(me.noted_count||0)>0)),ne=md(ne,x),ne=hd(ne,j,me=>me.dialogue_count||0),P==="recent"?ud(ne,"movie"):(ne=[...ne],P==="title"?ne.sort((me,oe)=>me.title.localeCompare(oe.title)):P==="year"?ne.sort((me,oe)=>(oe.release_year||0)-(me.release_year||0)):P==="series"?ne.sort(ho):P==="read"&&ne.sort(Kl),ne)},[s,y,v,g,w,k,S,N,x,j,P,l]),Q=Ra(F.map(ne=>ne.id)),ie=()=>{Q.clear(),z()},[he,ue]=c.useState(null),re=c.useMemo(()=>u==="none"?null:yr(F,u,{credit:ne=>ne.director,splitCredit:!0,creditResidual:n("movies.group.residual.director.label"),year:ne=>ne.release_year,genres:ne=>ne.genres||[],series:ne=>ne.series,seps:l,sortMembers:(ne,me)=>me==="series"?[...ne].sort(ho):ne}),[F,u,l]),J=Xt(F.length,F),de=Xt(re?re.length:0,re,12),Te=s?s.length:0,Be=s?s.reduce((ne,me)=>ne+(me.dialogue_count||0),0):0,We=s?n("movies.header.counts",{a:Ki(Te,"unit.title"),b:Ki(Be,"unit.dialogue")}):null;return e.jsxs(jr,{mobile:D,title:n("movies.header.title"),counts:We,error:I,onExport:()=>R(!0),headerAside:e.jsx($,{className:"hidden sm:inline",children:n(K==="none"?"movies.header.nokey.label":"movies.header.lookup.label")}),loaded:s!=null,hasItems:!!(s&&s.length>0),shownCount:F.length,emptyText:n("movies.board.empty"),noMatchText:n("movies.board.nomatch"),genres:Z,genre:v,setGenre:q,fav:w,setFav:_,tagged:k,setTagged:T,noted:S,setNoted:B,wish:j,setWish:L,states:x,setStates:V,kind:"movie",noun:n("unit.title.one"),nounPlural:n("unit.title.other"),seriesNames:pe,series:g,setSeries:E,sort:P,setSort:C,creditNames:ce,credit:N,setCredit:O,creditNoun:n("unit.actor.one"),creditNounPlural:n("unit.actor.other"),seriesNoun:n("unit.collection.one"),seriesNounPlural:n("unit.collection.other"),sortOptions:[["recent",n("movies.sort.recent.label")],["title",n("movies.sort.title.label")],["year",n("movies.sort.year.label")],["series",n("movies.sort.series.label")],["read",n("movies.sort.read.label")]],activeStates:Y?["watching","playing"]:["watching"],leading:ae&&G.map(([ne,me])=>e.jsx("button",{className:ct(y===ne),onClick:()=>M(ne),children:me},ne)),leadingMobile:ae&&e.jsxs("div",{children:[e.jsx($,{className:"mb-2 block",children:"type"}),e.jsx("div",{className:"flex flex-wrap items-center gap-2",children:G.map(([ne,me])=>e.jsx("button",{className:ct(y===ne),onClick:()=>M(ne),children:me},ne))})]}),trailing:e.jsxs("label",{className:"flex items-center gap-2",children:[e.jsx($,{children:n("common.mono.group.label")}),e.jsx(Oe,{ariaLabel:n("common.filters.group.aria"),value:u,onChange:f,options:Gi()})]}),trailingMobile:e.jsxs("div",{children:[e.jsx($,{className:"mb-2 block",children:"group"}),e.jsx(Oe,{ariaLabel:n("common.filters.group.aria"),value:u,onChange:f,options:Gi()})]}),onReset:()=>{p([]),f("none"),C("recent")},exportDialog:e.jsx(vt,{open:H,title:n("movies.export.confirm.title"),body:(()=>{const ne=F.filter(ee=>(ee.media_type||"movie")==="show").length,me=F.filter(ee=>ee.media_type==="game").length,oe=F.length-ne-me,be=[oe>0&&n("movies.export.count.movies",{count:oe,n:oe}),ne>0&&n("movies.export.count.shows",{count:ne,n:ne}),me>0&&n("movies.export.count.games",{count:me,n:me})].filter(Boolean);return n("movies.export.confirm.body",{a:be.join(" · ")||n("movies.export.count.none")})})(),confirmLabel:n("common.action.export.label"),onCancel:()=>R(!1),onConfirm:async()=>{R(!1),await Ms("/export/movies",{ids:F.map(ne=>ne.id)},"tippani-titles.md")}}),children:[Q.open&&e.jsx(Da,{selection:Q,rows:F,onDone:ie,onEdit:ue}),he!=null&&e.jsx(hb,{kind:"movies",id:he,title:n("film.form.edit.title"),onDone:()=>{ue(null),ie()},onCancel:()=>ue(null)}),re?e.jsxs("div",{className:"space-y-10",children:[re.slice(0,de.count).map(ne=>e.jsx(ab,{group:ne,coverSize:te,onOpen:t,directorMap:i,creditSeps:l,selection:Q,afterBulk:ie,setEditWork:ue},ne.key)),de.more&&e.jsx("div",{ref:de.sentinel,"aria-hidden":"true",className:"h-px"})]}):e.jsxs(ko,{className:"grid gap-x-5 gap-y-8",style:{gridTemplateColumns:`repeat(auto-fill, minmax(${te}px, 1fr))`},children:[F.slice(0,J.count).map(ne=>e.jsx(vr,{kind:"movie",item:ne,onOpen:t,people:i,seps:l,selection:Q,onChanged:ie,onEdit:ue},ne.id)),J.more&&e.jsx("div",{ref:J.sentinel,"aria-hidden":"true",className:"h-px"})]})]})}function Tr(t){return`#${t.source==="tvdb"?t.source_id:t.tmdb_id||t.source_id}`}function cb(t){return`${(t.source||"tmdb").toUpperCase()} ${Tr(t)}`}function ys(t,a){return{source:t.source||"tmdb",source_id:t.source==="tvdb"?t.source_id:String(t.tmdb_id||t.source_id),media_type:t.media_type||a}}function Nd({confirm:t,busy:a,onEnrich:o,onAddSeparate:s,onCancel:r}){return e.jsxs("div",{className:"hand-card hc-r1 space-y-3 p-4",style:{borderLeft:"4px solid var(--amber, var(--accent))"},children:[e.jsxs("p",{className:"text-sm",children:["You already have a title named ",e.jsxs("b",{children:["“",t.cand.title,"”"]}),". Enrich it with this metadata (keeps its dialogues), or add “",t.cand.title,"” as a separate title."]}),e.jsx("ul",{className:"space-y-2",children:t.existing.map(i=>e.jsxs("li",{className:"flex items-center gap-3 rounded-xl px-3 py-2",style:{border:"1px solid var(--line)"},children:[e.jsxs("div",{className:"min-w-0 flex-1",children:[e.jsxs("p",{className:"truncate text-sm font-semibold",children:[i.title,i.release_year?e.jsx("span",{className:"ml-2 font-normal",style:{color:"var(--soft)"},children:i.release_year}):null]}),e.jsx("p",{className:"truncate text-xs",style:{color:"var(--faint)"},children:[n("movies.duplicate.dialogues",{count:i.dialogue_count,n:i.dialogue_count}),n(i.has_poster?"movies.duplicate.poster.yes":"movies.duplicate.poster.no")].join(" · ")})]}),e.jsx(ge,{icon:e.jsx(Hn,{}),type:"button",className:"shrink-0",disabled:a,onClick:()=>o(i.id),children:n("movies.duplicate.enrich.label")})]},i.id))}),e.jsxs("div",{className:"flex flex-wrap gap-2",children:[e.jsx("button",{type:"button",className:"tp-btn tp-btn-primary",disabled:a,onClick:s,children:n("movies.duplicate.separate.label")}),e.jsx(ge,{type:"button",disabled:a,onClick:r,children:n("common.action.cancel.label")})]})]})}function Td({mediaType:t,setMediaType:a,title:o,setTitle:s,onAdded:r,formId:i,onBusy:l}){const[h,d]=c.useState(""),[m,p]=c.useState(""),[u,f]=c.useState(""),[b,y]=c.useState([]),[v,g]=c.useState([]);c.useEffect(()=>{X("GET","/genres").then(_=>{_.ok&&g(_.data.genres||[])})},[]);const[w,k]=c.useState(""),[S,N]=c.useState(""),[j,x]=c.useState(""),[M,q]=c.useState(""),E=t==="game";async function O(_){if(_.preventDefault(),!o.trim())return q(n("error.validate.title-required.lower"));l==null||l(!0),q("");const T=await X("POST","/movies",{title:o.trim(),media_type:t,director:h.trim()||void 0,publisher:E?m.trim():void 0,release_year:u?hn(u).year:void 0,release_circa:u?hn(u).circa:void 0,genres:b,series:w.trim()||void 0,series_index:Number(S)||0,description:j.trim()||void 0});l==null||l(!1),T.ok?r(T.data):q(le(T,n("error.add.title")))}return e.jsxs("form",{id:i,onSubmit:O,className:"space-y-2.5",children:[e.jsxs("div",{className:"grid gap-2.5 sm:grid-cols-2",children:[e.jsx(Nt,{placeholder:n("film.form.title.placeholder"),value:o,onChange:_=>s(_.target.value)}),e.jsx(Nt,{placeholder:dd(t),value:h,onChange:_=>d(_.target.value)}),E&&e.jsx(Nt,{placeholder:n("film.form.publisher.placeholder"),value:m,onChange:_=>p(_.target.value)}),e.jsx("input",{className:"tp-input",placeholder:n("film.form.year.placeholder"),inputMode:"numeric",value:u,maxLength:4,onChange:_=>f(_.target.value.replace(/\D/g,"").slice(0,4))}),e.jsx(pt,{value:b,onChange:y,suggestions:v,placeholder:n("common.field.genres.placeholder"),ariaLabel:n("common.field.genres.label"),transform:Mo}),e.jsx(Nt,{placeholder:n("film.form.series.placeholder"),value:w,onChange:_=>k(_.target.value)}),e.jsx("input",{className:"tp-input",placeholder:n("film.form.series-no.placeholder"),inputMode:"decimal",value:S,onChange:_=>N(_.target.value)})]}),e.jsx("textarea",{className:"tp-input",rows:"3",placeholder:n("film.form.description.placeholder"),value:j,onChange:_=>x(_.target.value)}),e.jsx(ve,{children:M}),!o.trim()&&e.jsx("p",{className:"microcopy",style:{color:"var(--faint)"},children:n("film.form.missing.hint")})]})}function Ed({value:t,onChange:a}){return e.jsx(Ye,{ariaLabel:n("film.form.media.aria"),value:t,onChange:a,options:[["movie",n("film.form.media.movie.label")],["show",n("vocab.kind.show.label")],["game",n("vocab.kind.game.label")]]})}function db({id:t,onClose:a,creditSeparators:o,onAdd:s,onSearch:r,dataNonce:i}){const{practise:l,practiceDialog:h}=qa(),[d,m]=c.useState(null),[p,u]=c.useState(!1),[f,b]=c.useState(!1),[y,v]=c.useState(""),[g,w]=c.useState(!1),[k,S]=c.useState(null),[N,j]=c.useState(null),x=(N==null?void 0:N.total)??null,[M,q]=c.useState(null),[E,O]=c.useState(null),[_,T]=c.useState(null),[B,L]=c.useState(""),[V,P]=c.useState(!1),C=(d==null?void 0:d.media_type)||"movie",H=Ag(C),{map:R}=Qe(H),I=_e(),U=c.useMemo(()=>mn(o),[o]);async function te(){const re=await X("GET",`/movies/${t}`);re.ok?m(re.data):v(le(re))}c.useEffect(()=>{m(null),u(!1),j(null),te()},[t]),c.useEffect(()=>(Qt(d?[Jc("movie",d.id,d.title)]:[]),()=>Qt([])),[d]);const D=d?Pn("movie",d):"movie",z=dt[D],K=Ui[D]||Ui.movie;async function A(re,J){P(!0);const de={status:re,progress:(d==null?void 0:d.progress)||0,pos_unit:(d==null?void 0:d.pos_unit)||"",pos:(d==null?void 0:d.pos)||0,pos_total:(d==null?void 0:d.pos_total)||0,season:(d==null?void 0:d.season)||0,season_total:(d==null?void 0:d.season_total)||0};re===z?de.started_at=J||"":(re==="completed"||re==="abandoned")&&(de.finished_at=J||"");const Te=await X("PUT",`/movies/${t}/status`,de);P(!1),Te.ok?m(Te.data):v(le(Te,n("error.save.generic")))}async function Y(re){if(d){if(re===z&&d.status!=="paused"){const J=await X("GET","/movies");if(!J.ok)return v(le(J));const de=(J.data.movies||[]).filter(Te=>ya("movie",Te)&&Te.id!==d.id&&Pn("movie",Te)===D);if(de.length>=qn[D]){L(""),O(de);return}}if(re===""||re==="paused")return A(re,"");q({status:re,date:Wt()})}}async function G(re){T(re.id);const J=await ib(re.id,{status:"completed",finished_at:Wt()});if(T(null),J)return L(J);const de=E.filter(Te=>Te.id!==re.id);if(de.length<qn[D]){O(null),q({status:z,date:Wt()});return}O(de)}async function ae(re){P(!0);const J=await X("PUT",`/movies/${t}/status`,{status:d.status,...re});P(!1),J.ok?m(J.data):v(le(J,n("error.save.generic")))}async function Z(){if(!confirm(`Delete "${d.title}" and all its dialogues?`))return;const re=await Wn(`/movies/${t}`,{label:n("film.toast.deleted")});re.ok?a():v(le(re))}async function pe(re){const J=await X("PUT",`/movies/${t}`,{...rb(d),...re});J.ok?m(J.data):v(le(J,n("error.save.generic")))}d&&d.media_type;const ce=d!=null&&d.director?Je(d.director,U):[],F=ce.length>0?e.jsxs("span",{style:{display:"inline-flex",alignItems:"center",flexWrap:"wrap",columnGap:6,rowGap:2},children:[e.jsx("span",{children:Cg(C)}),ce.map((re,J)=>e.jsxs(c.Fragment,{children:[J>0&&e.jsx("span",{"aria-hidden":"true",style:{marginLeft:-2},children:","}),e.jsx(Po,{kind:H,name:re,person:R[re],size:28,onOpen:S,nameClassName:"",nameStyle:{font:"inherit",color:"inherit",background:"none",border:"none",padding:0,cursor:"pointer",textDecoration:"underline",textUnderlineOffset:2}})]},re))]},"director"):null,Q=C==="game"&&(d!=null&&d.publisher)?e.jsx("span",{children:n("film.credit.publisher.label",{name:d.publisher})},"publisher"):null,ie=d?[F,Q,Rt(d.release_year,d.release_circa)||null,Us(d)||null].filter(Boolean):[],he=d?d.title||n("film.title.fallback"):"",ue=d&&(d.director||Rt(d.release_year,d.release_circa))||"";return e.jsxs("section",{className:"space-y-6 md:pt-5","data-screen-label":"movie-detail",children:[I&&e.jsx(xr,{onClose:a,title:he,meta:ue,actions:e.jsxs(e.Fragment,{children:[e.jsx(Pe,{icon:e.jsx(Ht,{}),label:n("common.action.filter.label"),ariaLabel:n("film.filter.aria"),onClick:()=>w(!0)}),e.jsx(Pe,{icon:e.jsx(tt,{}),label:n("common.action.capture.label"),ariaLabel:n("film.capture.aria"),onClick:()=>s==null?void 0:s("quote",{type:"movie",id:t})}),e.jsx(It,{items:[{icon:e.jsx(Ql,{size:24}),label:ln("movie",(d==null?void 0:d.status)||"",z,d||{}),onClick:()=>Y(z)},{icon:e.jsx(rt,{}),label:n("film.export.label"),onClick:()=>{d&&(window.location.href=`/api/movies/${d.id}/export`)}},{icon:e.jsx(kt,{}),label:n("nav.tab.search.label"),onClick:()=>r==null?void 0:r()},{icon:e.jsx(Ct,{}),label:n("film.practise.menu.label"),onClick:()=>d&&l({movie:d.id,label:d.title})},{icon:e.jsx(un,{}),label:n("common.work.details.title"),onClick:()=>u(!0)},{icon:e.jsx(Oo,{size:24}),label:n("shell.help.menu.label"),onClick:()=>b(!0)},{icon:e.jsx(Fe,{}),label:n("common.action.delete.label"),onClick:Z,danger:!0}]})]})}),!I&&e.jsx("button",{onClick:a,style:{background:"none",border:"none",padding:"2px 0",fontFamily:"var(--font-mono)",fontWeight:"var(--font-mono-weight)",fontStyle:"var(--font-mono-style)",fontVariantCaps:"var(--font-mono-caps)",textTransform:"var(--font-mono-case)",fontVariantNumeric:"var(--font-mono-figures)",fontSize:"var(--type-mono-12)",letterSpacing:".1em",color:"var(--soft)"},children:"← Catalogue"}),e.jsx(ve,{children:y}),d&&e.jsx(ko,{children:e.jsx(wd,{cover:e.jsx(sb,{path:d.poster_path,title:d.title,zoomable:!0}),title:d.title,titleSize:"var(--type-display-26)",meta:ie.length>0&&e.jsx("div",{style:{...Nr,display:"flex",flexWrap:"wrap",alignItems:"center",rowGap:2},children:ie.map((re,J)=>e.jsxs(c.Fragment,{children:[J>0&&e.jsx("span",{"aria-hidden":"true",style:{margin:"0 8px"},children:"·"}),re]},J))}),counts:e.jsx(yd,{counts:N,noun:[n("unit.line.one"),n("unit.line.other")],tone:"amber"}),favorite:d.favorite,onFavorite:re=>pe({favorite:re}),tags:e.jsx(gd,{kind:"movie",item:d,status:d.status,progress:d.progress,pos:d,reads:d.reads,onReadsChanged:te,wishlist:x===0,busy:V,onSelect:Y,onProgress:ae}),genres:d.genres||[],description:d.description,actions:I?null:e.jsxs(e.Fragment,{children:[e.jsx(ge,{onClick:()=>Y(z),disabled:V,children:ln("movie",d.status||"",z,d)}),e.jsx(Pe,{icon:e.jsx(rt,{}),label:n("common.action.export.label"),ariaLabel:n("film.export.aria"),onClick:()=>window.location.href=`/api/movies/${d.id}/export`,tooltip:n("film.export.tip")}),e.jsx(Pe,{icon:e.jsx(Ct,{}),label:n("common.action.practise.label"),ariaLabel:n("film.practise.aria"),onClick:()=>l({movie:d.id,label:d.title}),tooltip:n("film.practise.tip")}),e.jsx(Pe,{icon:e.jsx(un,{}),label:n("common.work.details.title"),ariaLabel:n("common.work.details.title"),onClick:()=>u(!0),tooltip:n("film.details.tip")}),e.jsx(Pe,{icon:e.jsx(Fe,{}),label:n("common.action.delete.label"),ariaLabel:n("film.delete.aria"),onClick:Z,danger:!0,tooltip:n("film.delete.tip")})]})})}),d&&e.jsx(qc,{open:p,onClose:()=>u(!1),kind:"movie",item:d,onChanged:m,onDelete:Z}),e.jsx(pd,{open:!!E,items:(E||[]).map(re=>({id:re.id,title:re.title,meta:[re.director,Rt(re.release_year,re.release_circa)||null].filter(Boolean).join(" · ")})),cap:qn[D],noun:n(K.one),nounPlural:n(K.other),verb:_t(z,"movie"),pastLabel:n(K.past),busyId:_,error:B,onRelease:G,onCancel:()=>O(null),onProceed:()=>{O(null),q({status:z,date:Wt()})}}),e.jsx(fd,{open:!!M,title:M?ln("movie",(d==null?void 0:d.status)||"",M.status,d||{}):"",label:n((M==null?void 0:M.status)===z?"film.shelf.started.label":(M==null?void 0:M.status)==="abandoned"?"film.shelf.abandoned.label":"film.shelf.finished.label"),value:(M==null?void 0:M.date)||"",onChange:re=>q(J=>J&&{...J,date:re}),onCancel:()=>q(null),onConfirm:()=>{const re=M;q(null),A(re.status,re.date)}}),d&&e.jsx(ub,{movieId:d.id,cast:d.cast||[],movie:d,creditSeps:U,onStats:j,mobileFilterOpen:g,onMobileFilterOpen:w,onAdd:s,dataNonce:i}),k&&e.jsx(yn,{kind:k.kind,name:k.name,onClose:()=>S(null)}),h,e.jsx(fc,{screen:"movie-detail",open:f,onClose:()=>b(!1)})]})}function hb({kind:t,id:a,title:o,onDone:s,onCancel:r}){const[i,l]=c.useState(null),[h,d]=c.useState("");return c.useEffect(()=>{l(null),d(""),X("GET",`/${t}/${a}`).then(m=>m.ok?l(m.data):d(le(m)))},[t,a]),e.jsx(Ge,{open:!0,onClose:r,title:o,children:h?e.jsx(ve,{children:h}):i?e.jsx(Cd,{movie:i,onSaved:s,onCancel:r}):e.jsx("p",{className:"microcopy",children:"loading…"})})}function Cd({movie:t,onSaved:a,onCancel:o}){const[s,r]=c.useState(t.title||""),[i,l]=c.useState(t.media_type||"movie"),[h,d]=c.useState(t.director||""),[m,p]=c.useState(t.publisher||""),[u,f]=c.useState(Rt(t.release_year,t.release_circa)),[b,y]=c.useState(t.genres||[]),[v,g]=c.useState([]);c.useEffect(()=>{X("GET","/genres").then(A=>{A.ok&&g(A.data.genres||[])})},[]);const[w,k]=c.useState(t.series||""),[S,N]=c.useState(t.series_index?String(t.series_index):""),[j,x]=c.useState(t.description||""),[M,q]=c.useState(t.tmdb_id?String(t.tmdb_id):""),[E,O]=c.useState(t.tvdb_id?String(t.tvdb_id):""),[_,T]=c.useState(t.poster_path||""),[B,L]=c.useState(""),[V,P]=c.useState(!1),[C,H]=c.useState(""),[R,I]=c.useState(!1),[U,te]=c.useState(!1),D=i==="game";async function z(A){if(A.preventDefault(),!s.trim())return H(n("error.validate.title-required.lower"));I(!0),H("");const Y=await X("PUT",`/movies/${t.id}`,{title:s.trim(),media_type:i,director:h.trim(),publisher:m.trim(),release_year:u?hn(u).year:void 0,release_circa:u?hn(u).circa:void 0,genres:b,series:w.trim(),series_index:Number(S)||0,description:j.trim(),favorite:!!t.favorite,tmdb_id:ot(M),tvdb_id:ot(E),poster_url:B||void 0,clear_cover:V||void 0});I(!1),Y.ok?a():H(le(Y,n("error.save.generic")))}async function K(A){I(!0),H("");const Y=await X("PUT",`/movies/${t.id}`,{source:A.source||"tmdb",source_id:A.source==="tvdb"?A.source_id:String(A.tmdb_id||A.source_id),media_type:A.media_type||i});I(!1),Y.ok?a():H(le(Y,n("error.sync.source")))}return e.jsxs("form",{onSubmit:z,className:"space-y-2.5",children:[e.jsx(tr,{kind:"movies",id:t.id,currentPath:_,coverUrl:B,clearCover:V,onSetUrl:A=>{L(A),P(!1)},onClear:A=>{A===!0?(L(""),P(!1)):(P(!0),L(""))},onUploaded:A=>T(A.poster_path||""),onFetchMeta:()=>te(A=>!A),fetchMetaOpen:U,search:{title:s,year:u,mediaType:i,tmdbId:M,tvdbId:E}}),e.jsx(Ed,{value:i,onChange:l}),U&&e.jsxs("div",{children:[e.jsx($,{className:"mb-1.5 block",children:n("film.resync.pick.label")}),e.jsx(cc,{auto:!0,title:s,year:u,mediaType:i,tmdbId:M,tvdbId:E,onPick:K})]}),e.jsxs("div",{className:"grid gap-2.5 sm:grid-cols-2",children:[e.jsx(Nt,{placeholder:n("film.form.title.placeholder"),value:s,onChange:A=>r(A.target.value)}),e.jsx(Nt,{placeholder:dd(i),value:h,onChange:A=>d(A.target.value)}),D&&e.jsx(Nt,{placeholder:n("film.form.publisher.placeholder"),value:m,onChange:A=>p(A.target.value)}),e.jsx("input",{className:"tp-input",placeholder:n("film.form.year.placeholder"),inputMode:"numeric",value:u,maxLength:4,onChange:A=>f(A.target.value.replace(/\D/g,"").slice(0,4))}),e.jsx(pt,{value:b,onChange:y,suggestions:v,placeholder:n("common.field.genres.placeholder"),ariaLabel:n("common.field.genres.label"),transform:Mo}),e.jsx(Nt,{placeholder:n("film.form.series.placeholder"),value:w,onChange:A=>k(A.target.value)}),e.jsx("input",{className:"tp-input",placeholder:n("film.form.series-no.placeholder"),inputMode:"decimal",value:S,onChange:A=>N(A.target.value)}),e.jsx("input",{className:"tp-input",placeholder:n("film.form.tmdb-id.placeholder"),inputMode:"numeric",value:M,onChange:A=>q(A.target.value.replace(/\D/g,"").slice(0,12))}),e.jsx("input",{className:"tp-input",placeholder:n("film.form.tvdb-id.placeholder"),inputMode:"numeric",value:E,onChange:A=>O(A.target.value.replace(/\D/g,"").slice(0,12))})]}),e.jsx("textarea",{className:"tp-input",rows:"4",placeholder:n("film.form.description.placeholder"),value:j,onChange:A=>x(A.target.value)}),e.jsx(ve,{children:C}),e.jsxs("div",{className:"flex gap-2",children:[e.jsx("button",{className:"tp-btn tp-btn-primary",disabled:R||!s.trim(),children:"Save"}),e.jsx(ge,{type:"button",onClick:o,children:"Cancel"})]})]})}function on(t){const a=String(t??"").trim();if(a==="")return null;const o=Number(a);return Number.isInteger(o)&&o>=0?o:null}function Er(t){return{quote:t.quote||"",note:t.note||"",color:t.color||"yellow",character:t.character||"",actor:t.actor||"",timestamp:t.timestamp||"",season:t.season??null,episode:t.episode??null,episode_name:t.episode_name||"",act:t.act||"",quest:t.quest||"",translation:t.translation||"",tags:t.tags||[],favorite:!!t.favorite,sticker_id:t.sticker_id??null,sticker_x:t.sticker_x??null,sticker_y:t.sticker_y??null}}function ub({movieId:t,cast:a,movie:o,creditSeps:s,onStats:r,mobileFilterOpen:i,onMobileFilterOpen:l,onAdd:h,dataNonce:d}){const m=(o==null?void 0:o.media_type)==="show",p=(o==null?void 0:o.media_type)==="game",[u,f]=c.useState(null),[b,y]=c.useState([]),[v,g]=c.useState(null),[w,k]=c.useState(null),[S,N]=c.useState(""),[j,x]=c.useState(!1),[M,q]=c.useState(""),[E,O]=c.useState(null),_=c.useRef(!0);c.useEffect(()=>{if(_.current){_.current=!1;return}ue(null),de(),J()},[d]);const[T,B]=c.useState(""),[L,V]=He("tippani:view:dialogues","tiles"),[P,C]=c.useState({col:m?"episode":"timestamp",dir:"asc"}),H=To(_l),R=c.useRef(0),I=Gl(),U=oe=>C(be=>be.col===oe?{col:oe,dir:be.dir==="asc"?"desc":"asc"}:{col:oe,dir:"asc"}),te=_e(),{stickers:D,reload:z}=Oa(),{map:K,reload:A}=Qe("actor");pp("movie",t,a,()=>de());const Y=c.useMemo(()=>[...new Set(a.map(oe=>(oe.actor||"").trim()).filter(Boolean))],[a]);gc("actor",Y,K,A);const G=`cast-characters-${t}`,ae=[...new Set(a.map(oe=>oe.character).filter(Boolean))],Z=Object.fromEntries(b.map(oe=>[oe.name,oe])),pe=c.useMemo(()=>Object.fromEntries(D.map(oe=>[oe.id,oe])),[D]),ce=Number(t)||1,F=c.useMemo(()=>Bs((u==null?void 0:u.length)||0,Ta(ce)),[u==null?void 0:u.length,ce]),Q=Ra((u||[]).map(oe=>oe.id)),ie=()=>{Q.clear(),de()},[he,ue]=c.useState(null),re=c.useCallback(oe=>ue(be=>be===oe?null:oe),[]);c.useEffect(()=>{he!=null&&u&&!u.some(oe=>oe.id===he)&&ue(null)},[u,he]),c.useEffect(()=>{ue(null)},[H]);async function J(){const oe=await X("GET","/tags");oe.ok&&y(oe.data.tags)}async function de(){const oe=++R.current,be=new URLSearchParams({movie_id:t});S&&be.set("tag",S),j&&be.set("favorite","1"),M&&be.set("color",M);const ee=await X("GET",`/dialogues?${be}`);oe===R.current&&(ee.ok?f(ee.data.dialogues):B(le(ee)))}c.useEffect(()=>{ue(null),de()},[t,S,j,M]),c.useEffect(()=>{J()},[t]),c.useEffect(()=>{u&&!S&&!j&&!M&&(r==null||r(bd(u)))},[u,S,j,M]);async function Te(oe,be){const ee=await X("PUT",`/dialogues/${oe}`,be);return ee.ok?(O(null),de(),J(),null):le(ee,n("error.save.dialogue"))}async function Be(oe){if(!confirm(n("film.lines.delete.confirm")))return;const be=await Wn(`/dialogues/${oe.id}`,{reload:de});be.ok?(ue(null),de()):B(le(be))}async function We(oe,be){const ee=await X("PUT",`/dialogues/${oe.id}`,{...Er(oe),...be});if(!ee.ok)return B(le(ee,n("error.save.dialogue")));B(""),wr(be,{fav:j,color:M,tag:S})?de():f(je=>(je||[]).map(Ne=>Ne.id===oe.id?{...Ne,...ee.data}:Ne))}const qe=S||j||M,ne=oe=>Hc({quote:oe.quote,note:oe.note,translation:oe.translation,color:oe.color,title:o==null?void 0:o.title,year:o==null?void 0:o.release_year,character:oe.character,actor:oe.actor,timestamp:oe.timestamp,episode:gn(oe),tags:oe.tags,tmdbId:o==null?void 0:o.tmdb_id,tvdbId:o==null?void 0:o.tvdb_id,people:K,seps:s,characterImages:oe.character_images}),me=oe=>ba(ne(oe));return e.jsxs("div",{className:"space-y-4",children:[te&&e.jsx($n,{open:i,onClose:()=>l==null?void 0:l(!1),title:n("film.lines.filter.title"),footer:e.jsx(er,{count:u?`${u.length} shown`:"",onReset:()=>{N(""),x(!1),q("")},onDone:()=>l==null?void 0:l(!1)}),children:e.jsxs("div",{className:"space-y-5",children:[e.jsxs("div",{children:[e.jsx($,{className:"mb-2 block",children:"character / tag"}),e.jsx("input",{className:"tp-input",list:ae.length>0?G:void 0,placeholder:n("film.lines.filter.placeholder"),value:S,onChange:oe=>N(oe.target.value)})]}),e.jsxs("div",{children:[e.jsx($,{className:"mb-2 block",children:"show only"}),e.jsx("div",{className:"flex flex-wrap items-center gap-2",children:e.jsx("button",{onClick:()=>x(!j),className:ct(j),title:n("common.favourite.filter.tip"),children:"♥ favourites"})})]}),e.jsxs("div",{children:[e.jsx($,{className:"mb-2 block",children:"colour"}),e.jsx(nt,{value:M,onChange:oe=>q(oe===M?"":oe)})]}),e.jsxs("div",{children:[e.jsx($,{className:"mb-2 block",children:"view"}),e.jsx(co,{value:L,onChange:V})]})]})}),!te&&e.jsxs("div",{className:"flex flex-wrap items-center gap-2",children:[e.jsxs($,{children:["Dialogues",u?` · ${u.length}`:""]}),e.jsxs("div",{className:"ml-auto flex flex-wrap items-center gap-2",children:[e.jsx("button",{onClick:()=>x(!j),className:ct(j),title:n("common.favourite.filter.tip"),children:"♥ Favourites"}),e.jsx(nt,{value:M,onChange:oe=>q(oe===M?"":oe)}),b.length>0&&e.jsx(Oe,{ariaLabel:n("common.filters.tag.aria"),value:S,onChange:N,options:[["",n("film.lines.filter.tag.all.label")],...b.map(oe=>[oe.name,oe.name])]}),e.jsx(co,{value:L,onChange:V}),e.jsx(ge,{onClick:()=>h==null?void 0:h("quote",{type:"movie",id:t}),children:n("film.lines.capture.label")})]})]}),ae.length>0&&e.jsx("datalist",{id:G,children:ae.map(oe=>e.jsx("option",{value:oe},oe))}),e.jsx(ve,{children:T}),u&&u.length===0&&e.jsx(Vt,{children:n(qe?"film.lines.nomatch":"film.lines.empty")}),Q.open&&e.jsx(Da,{selection:Q,rows:u||[],onDone:ie,tagSuggestions:Object.keys(Z),onEdit:O}),u&&u.length>0&&L==="tiles"&&e.jsx(ko,{children:e.jsx(Ao,{columns:H,gap:16,seed:ce,lockOrder:he!=null,order:"source",children:u.map((oe,be)=>e.jsx(ws,{d:oe,wrapClass:"",tagMap:Z,stickerMap:pe,stickers:D,reloadStickers:z,editing:E===oe.id,show:m,game:p,cast:a,onEdit:()=>O(oe.id),onCancelEdit:()=>O(null),onSave:ee=>Te(oe.id,ee),onPatch:ee=>We(oe,ee),onDelete:()=>Be(oe),onCopy:()=>me(oe),onShare:()=>g(oe),onOpenPerson:k,actorMap:K,seps:s,quoteLines:F[be],expanded:he===oe.id,onToggleExpand:()=>re(oe.id),selection:Q},oe.id))})}),u&&u.length>0&&L==="list"&&e.jsxs(ko,{className:"film-strip",children:[e.jsx(lo,{count:15}),e.jsx(Ul,{code:cs(I)}),u.map((oe,be)=>e.jsxs(c.Fragment,{children:[be>0&&e.jsx(mb,{code:cs(I,be)}),e.jsx(ws,{d:oe,tagMap:Z,stickerMap:pe,stickers:D,reloadStickers:z,editing:E===oe.id,show:m,game:p,cast:a,onEdit:()=>O(oe.id),onCancelEdit:()=>O(null),onSave:ee=>Te(oe.id,ee),onPatch:ee=>We(oe,ee),onDelete:()=>Be(oe),onCopy:()=>me(oe),onShare:()=>g(oe),onOpenPerson:k,actorMap:K,seps:s,quoteLines:5,selection:Q})]},oe.id)),e.jsx(lo,{count:15})]}),u&&u.length>0&&L==="table"&&e.jsx(gb,{rows:fb(u,P),tagMap:Z,stickers:D,reloadStickers:z,sort:P,onSort:U,editingId:E,setEditingId:O,save:Te,remove:Be,show:m,game:p,cast:a,actorMap:K,onCopy:me,onShare:g}),v&&e.jsx(Ho,{share:ne(v),seen:{kind:"screen",id:v.id},onClose:()=>g(null)}),w&&e.jsx(yn,{kind:w.kind,name:w.name,onClose:()=>k(null)})]})}function mb({code:t}){const a={borderTop:"1px solid color-mix(in srgb, var(--amber) 22%, transparent)"};return e.jsxs("div",{className:"mx-4 flex items-center gap-3 py-1.5","aria-hidden":"true",children:[e.jsx("span",{className:"flex-1",style:a}),e.jsx(Mu,{children:t}),e.jsx("span",{className:"flex-1",style:a})]})}const pb=t=>[{key:"quote",label:n("film.table.quote.label")},{key:"character",label:n("film.table.character.label")},t?{key:"episode",label:n("film.table.episode.label")}:null,{key:"timestamp",label:n("film.table.time.label")},{key:"favorite",label:n("film.table.favourite.label")}].filter(Boolean);function Vi(t){return[t.season??1/0,t.episode??1/0]}function fb(t,a){const o=a.dir==="asc"?1:-1;return[...t].sort((s,r)=>{switch(a.col){case"favorite":return((s.favorite?1:0)-(r.favorite?1:0))*o;case"character":return(s.character||"").localeCompare(r.character||"")*o;case"episode":{const[i,l]=Vi(s),[h,d]=Vi(r);return i!==h?(i-h)*o:l!==d?(l-d)*o:(s.timestamp||"").localeCompare(r.timestamp||"")*o}case"timestamp":return(s.timestamp||"").localeCompare(r.timestamp||"")*o;default:return(s.quote||"").localeCompare(r.quote||"")*o}})}function gb({rows:t,tagMap:a,stickers:o=[],reloadStickers:s,sort:r,onSort:i,editingId:l,setEditingId:h,save:d,remove:m,show:p=!1,game:u=!1,cast:f=[],actorMap:b={},onCopy:y,onShare:v}){const g=k=>r.col===k?r.dir==="asc"?" ▲":" ▼":"",w=t.find(k=>k.id===l);return e.jsxs("div",{className:"ann-table-wrap",children:[e.jsxs("table",{className:"ann-table",children:[e.jsx("thead",{children:e.jsxs("tr",{children:[pb(p).map(k=>e.jsx("th",{className:"sortable",onClick:()=>i(k.key),"aria-sort":r.col===k.key?r.dir==="asc"?"ascending":"descending":"none",children:e.jsx(ye,{label:n("book.table.sort.tip"),side:"bottom",children:e.jsxs("span",{children:[k.label,g(k.key)]})})},k.key)),e.jsx("th",{})]})}),e.jsx("tbody",{children:t.map(k=>{var S;return e.jsxs("tr",{children:[e.jsxs("td",{className:"col-quote",children:[e.jsx(Co,{text:k.quote,lines:2,style:{fontFamily:"var(--font-display)",fontWeight:"var(--font-display-weight)",fontVariantCaps:"var(--font-display-caps)",textTransform:"var(--font-display-case)",fontVariantNumeric:"var(--font-display-figures)",fontStyle:"italic"}}),((S=k.tags)==null?void 0:S.length)>0&&e.jsx("div",{className:"mt-1.5 flex flex-wrap gap-1.5",children:k.tags.map(N=>{const j=a[N];return e.jsx(Sa,{color:j==null?void 0:j.color,style:j==null?void 0:j.style,children:N},N)})})]}),e.jsx("td",{className:"col-mono",children:[k.character,k.actor&&`(${k.actor})`].filter(Boolean).join(" ")||"—"}),p&&e.jsx("td",{className:"col-mono",children:gn(k)||"—"}),e.jsx("td",{className:"col-mono",children:k.timestamp||"—"}),e.jsx("td",{className:"col-center",children:k.favorite?"♥":"—"}),e.jsx("td",{className:"col-actions",children:e.jsx(Js,{noun:n("unit.line.one"),nounPlural:n("unit.line.other"),onCopy:y&&(()=>y(k)),onShare:v&&(()=>v(k)),onEdit:()=>h(k.id),onDelete:()=>m(k)})})]},k.id)})})]}),e.jsx(Ge,{open:!!w,onClose:()=>h(null),title:n("common.dialogue.edit.title"),children:w&&e.jsx($o,{initial:w,onSubmit:k=>d(w.id,k),onCancel:()=>h(null),submitLabel:n("common.action.save.label"),show:p,game:u,cast:f,actorMap:b,tagSuggestions:Object.keys(a),stickers:o,reloadStickers:s})})]})}function ws({d:t,tagMap:a,stickerMap:o={},stickers:s=[],reloadStickers:r,editing:i,show:l=!1,game:h=!1,cast:d=[],onEdit:m,onCancelEdit:p,onSave:u,onPatch:f,onDelete:b,onCopy:y,onShare:v,onOpenPerson:g,actorMap:w={},seps:k,actionsAlwaysVisible:S=!1,editInline:N=!1,wrapClass:j="mx-4 my-1.5",quoteLines:x=6,expanded:M,onToggleExpand:q,selection:E,selectKind:O="dialogue"}){var G,ae;const _=["film-frame",j,"px-5 py-4"].filter(Boolean).join(" "),T=_a("dialogue",t,{copy:y&&(()=>y()),share:v&&(()=>v()),edit:m&&(()=>m()),favourite:f&&(()=>f({favorite:!t.favorite})),favourited:!!t.favorite,remove:b&&(()=>b())}),B=[...mr(E,t.id,O),...T.map(Z=>({...Z,onClick:Z.run}))],{cardProps:L,menuClass:V,menu:P}=Lo(B,E?{onLongPress:()=>E.toggle(t.id,O)}:void 0),C=!!(E!=null&&E.isSelected(t.id)),H=E?Z=>{const pe=ur(Z,E);pe!=="open"&&(Z.preventDefault(),Z.stopPropagation(),pe==="extend"?E.extendTo(t.id,O):E.toggle(t.id,O))}:void 0,R={borderLeft:`4px solid ${bn(t.color)||"var(--hl-1)"}`},I=typeof q=="function",U=e.jsx($o,{initial:t,onSubmit:u,onCancel:p,submitLabel:n("common.action.save.label"),show:l,game:h,cast:d,actorMap:w,tagSuggestions:Object.keys(a),stickers:s,reloadStickers:r});if(N&&i)return e.jsx("article",{className:_,style:R,children:U});const te=t.actor?Je(t.actor,k):[],D={font:"inherit",color:"inherit",background:"none",border:"none",padding:0,cursor:"pointer",textDecoration:"underline",textUnderlineOffset:2},z=te.length>0?e.jsxs("span",{children:[n("film.credit.actor.label")," ",te.map((Z,pe)=>e.jsxs(c.Fragment,{children:[pe>0&&", ",g?e.jsx(ir,{kind:"actor",name:Z,onOpen:g,className:"",style:D,children:Z}):Z]},Z))]},"actor"):null,K=[gn(t)||null,t.character||null,z,t.timestamp||null].filter(Boolean),A=t.sticker_id!=null?o[t.sticker_id]:null,Y={fontFamily:"var(--font-display)",fontWeight:"var(--font-display-weight)",fontStyle:"var(--font-display-style)",fontVariantCaps:"var(--font-display-caps)",textTransform:"var(--font-display-case)",fontVariantNumeric:"var(--font-display-figures)",fontSize:"var(--type-display-17)",lineHeight:1.5,color:"var(--ink)"};return e.jsxs(e.Fragment,{children:[e.jsx(Ge,{open:i,onClose:p,title:n("common.dialogue.edit.title"),children:U}),e.jsxs("article",{className:`${_} ${V}${C?" is-picked":""}${E!=null&&E.active?" is-selecting":""}`,style:R,...L,onClickCapture:Z=>{var pe;(pe=L.onClickCapture)!=null&&pe.call(L,Z)||H==null||H(Z)},children:[E&&e.jsx(Xs,{picked:C,label:n("common.dialogue.pick.label"),onChange:()=>E.toggle(t.id,O)}),t.quote&&(A?e.jsx(dc,{text:t.quote,quoteStyle:Y,stickerKey:`s${A.id}`,maxLines:x,pos:t.sticker_x!=null?{x:t.sticker_x,y:t.sticker_y}:null,onMove:(Z,pe)=>f({sticker_x:Z,sticker_y:pe}),sticker:e.jsx(Oc,{sticker:A}),open:I?!!M:void 0,onToggle:I?q:void 0}):e.jsx(Co,{text:t.quote,lines:x,style:Y,open:I?!!M:void 0,onToggle:I?q:void 0})),e.jsx("div",{className:"mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1",children:e.jsxs("span",{className:"inline-flex items-center gap-2",children:[(G=t.character_images)!=null&&G.length?e.jsx(Nc,{images:t.character_images,size:24,ring:"var(--card)"}):e.jsx(Ma,{names:te,map:w,size:24,ring:"var(--card)"}),e.jsx(Wl,{item:t}),e.jsx($s,{item:t,parent:l?"show":"film"}),e.jsx("span",{style:Nr,children:K.map((Z,pe)=>e.jsxs("span",{children:[pe>0?" · ":"",Z]},pe))})]})}),((ae=t.tags)==null?void 0:ae.length)>0&&e.jsx("div",{className:"mt-2.5 flex flex-wrap gap-2",children:t.tags.map(Z=>{const pe=a[Z];return e.jsx(Sa,{color:pe==null?void 0:pe.color,style:pe==null?void 0:pe.style,children:Z},Z)})}),t.translation&&e.jsx(Dl,{children:t.translation}),t.note&&e.jsx(Eo,{className:"mt-2",children:t.note}),e.jsxs("div",{className:"mt-1 flex flex-wrap items-center gap-x-3 gap-y-1",children:[e.jsx(On,{value:!!t.favorite,onChange:Z=>f({favorite:Z})}),e.jsx(fa,{actions:Dn(T),alwaysVisible:S}),e.jsx("span",{className:"card-colors shrink-0"+(S?" is-visible":""),children:e.jsx(nt,{collapsible:!0,value:t.color||"yellow",onChange:Z=>f({color:Z}),ariaLabel:n("common.colour.category.aria")})}),e.jsx("span",{className:"ml-auto flex items-center",children:e.jsx(ga,{actions:In(T)})})]}),P]})]})}function $o({initial:t,onSubmit:a,onCancel:o,submitLabel:s,show:r=!1,game:i=!1,cast:l=[],actorMap:h={},tagSuggestions:d=[],stickers:m=[],reloadStickers:p}){const u=c.useMemo(()=>{const ce=new Map;for(const F of l)F.character&&ce.set(F.character.trim().toLowerCase(),(F.actor||"").trim());return ce},[l]),f=c.useMemo(()=>[...new Set(l.map(ce=>ce.character).filter(Boolean))],[l]),[b,y]=c.useState((t==null?void 0:t.quote)||""),[v,g]=c.useState(()=>{if(t!=null&&t.character)return Je(t.character);if(t!=null&&t.actor&&l.length){const ce=new Map;for(const F of l)F.actor&&ce.set(F.actor.trim().toLowerCase(),F.character);return Je(t.actor).map(F=>ce.get(F.trim().toLowerCase())).filter(Boolean)}return[]}),[w,k]=c.useState((t==null?void 0:t.timestamp)||""),[S,N]=c.useState((t==null?void 0:t.act)||""),[j,x]=c.useState((t==null?void 0:t.quest)||""),[M,q]=c.useState((t==null?void 0:t.season)??""),[E,O]=c.useState((t==null?void 0:t.episode)??""),[_,T]=c.useState((t==null?void 0:t.note)||""),[B,L]=c.useState((t==null?void 0:t.translation)||""),[V,P]=c.useState((t==null?void 0:t.color)||"yellow"),[C,H]=c.useState((t==null?void 0:t.tags)||[]),[R,I]=c.useState((t==null?void 0:t.sticker_id)??null),[U,te]=c.useState(""),[D,z]=c.useState(!1),K=c.useMemo(()=>{const ce=[],F=new Set;for(const Q of v){const ie=u.get(String(Q).trim().toLowerCase());ie&&!F.has(ie.toLowerCase())&&(F.add(ie.toLowerCase()),ce.push(ie))}return ce},[v,u]),A=r||(t==null?void 0:t.season)!=null,Y=on(M),G=on(E),ae=b.trim()?A&&G!=null&&Y==null?n("error.validate.season-required"):"":n("error.validate.line-required"),Z=qo(D?n("common.action.save.busy"):ae);async function pe(ce){if(ce.preventDefault(),ae)return te(ae.toLowerCase());z(!0),te("");const F=await a({quote:b.trim(),note:_.trim(),season:A?Y:null,episode:A?G:null,character:v.map(Q=>Q.trim()).filter(Boolean).join(", "),actor:v.length?"":(t==null?void 0:t.actor)||"",timestamp:i?"":w.trim(),translation:B.trim(),episode_name:(t==null?void 0:t.episode_name)||"",act:i?S.trim():(t==null?void 0:t.act)||"",quest:i?j.trim():(t==null?void 0:t.quest)||"",color:V,tags:C,favorite:!!(t!=null&&t.favorite),sticker_id:R,sticker_x:(t==null?void 0:t.sticker_x)??null,sticker_y:(t==null?void 0:t.sticker_y)??null});if(z(!1),F)return te(F);t||(y(""),g([]),k(""),x(""),T(""),L(""),H([]),I(null))}return e.jsxs("form",{id:Z==null?void 0:Z.formId,onSubmit:pe,className:"space-y-2.5",children:[e.jsx("textarea",{className:"tp-input",rows:"3",placeholder:n("film.line.form.quote.placeholder"),value:b,onChange:ce=>y(ce.target.value)}),e.jsxs("div",{children:[e.jsx(pt,{value:v,onChange:g,suggestions:f,placeholder:n("film.line.form.characters.placeholder"),ariaLabel:n("film.line.form.characters.aria"),nameCase:!0}),K.length>0&&e.jsxs("div",{className:"mt-1.5 flex items-center gap-2",children:[e.jsx(Ma,{names:K,map:h,size:20,ring:"var(--card)"}),e.jsxs("span",{style:{...Nr,fontSize:"var(--type-ui-11)"},children:["played by ",K.join(", ")]})]})]}),i?e.jsxs("div",{className:"grid grid-cols-2 gap-2",children:[e.jsx("input",{className:"tp-input",placeholder:n("film.line.form.act.placeholder"),title:n("film.line.form.act.tip"),"aria-label":n("common.field.act.label"),value:S,onChange:ce=>N(ce.target.value)}),e.jsx("input",{className:"tp-input",placeholder:n("film.line.form.quest.placeholder"),title:n("film.line.form.quest.tip"),"aria-label":n("common.field.quest.label"),value:j,onChange:ce=>x(ce.target.value)})]}):A?e.jsxs("div",{className:"grid grid-cols-2 gap-2 sm:grid-cols-3",children:[e.jsx("input",{className:"tp-input",type:"number",min:"0",max:"999",placeholder:n("film.line.form.season.placeholder"),title:n("film.line.form.season.tip"),"aria-label":n("common.field.season.label"),value:M,onChange:ce=>q(ce.target.value)}),e.jsx("input",{className:"tp-input",type:"number",min:"0",max:"9999",placeholder:n("film.line.form.episode.placeholder"),title:n("film.line.form.episode.tip"),"aria-label":n("common.field.episode.label"),value:E,onChange:ce=>O(ce.target.value)}),e.jsx("input",{className:"tp-input col-span-2 sm:col-span-1",placeholder:n("film.line.form.timestamp.placeholder"),title:n("film.line.form.timestamp.tip"),"aria-label":n("common.field.timestamp.label"),value:w,onChange:ce=>k(ce.target.value)})]}):e.jsx("input",{className:"tp-input",placeholder:n("film.line.form.timestamp.placeholder"),title:n("film.line.form.timestamp.tip"),"aria-label":n("common.field.timestamp.label"),value:w,onChange:ce=>k(ce.target.value)}),e.jsx("textarea",{className:"tp-input",rows:"2",placeholder:n("common.field.translation.placeholder"),"aria-label":n("common.field.translation.label"),value:B,onChange:ce=>L(ce.target.value)}),e.jsx("textarea",{className:"tp-input",rows:"2",placeholder:n("common.field.note.label"),value:_,onChange:ce=>T(ce.target.value)}),e.jsx(pt,{value:C,onChange:H,suggestions:d,placeholder:n("common.field.tags.placeholder"),ariaLabel:n("common.field.tags.label")}),e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx($,{children:n("common.mono.colour.label")}),e.jsx(nt,{value:V,onChange:P,ariaLabel:n("common.colour.category.aria")})]}),e.jsxs("div",{children:[e.jsx($,{className:"mb-1.5 block",children:n("common.field.sticker.label")}),e.jsx(Fo,{value:R,onChange:I,stickers:m,reload:p})]}),!Z&&e.jsxs("div",{className:"flex items-center justify-end gap-2",children:[o&&e.jsx(ge,{type:"button",onClick:o,children:"Cancel"}),e.jsx("button",{className:"tp-btn tp-btn-primary",disabled:D||!!ae,title:ae||void 0,children:s})]}),e.jsx(ve,{children:U})]})}const Ad=Object.freeze(Object.defineProperty({__proto__:null,DialogueForm:$o,DuplicateConfirm:Nd,EditMovie:Cd,Frame:ws,ManualMovie:Td,MediaTypeToggle:Ed,candSource:cb,candSourceID:Tr,countOrNull:on,default:nb,dialogueState:Er,sourceRef:ys},Symbol.toStringTag,{value:"Module"})),bb="tp-btn tp-btn-primary";function yb({onDone:t,boardID:a}){const[o,s]=c.useState(null),[r,i]=c.useState(""),[l,h]=c.useState("");c.useEffect(()=>{X("GET","/quotes/starters").then(m=>s(m.ok?m.data.languages||[]:[]))},[]);async function d(m){i(m),h("");const p=await X("POST","/quotes/starters",{language:m,board_id:a??null});if(i(""),!p.ok)return h(le(p,n("error.add.starters")));h(p.data.added>0?n("quotes.starter.added.label",{n:p.data.added,count:p.data.added}):n("quotes.starter.already.label")),await t()}return!o||o.length===0?null:e.jsxs("div",{className:"starter-proverbs",children:[e.jsx($,{className:"block",children:n("quotes.starter.title")}),e.jsx("p",{className:"microcopy",style:{margin:"4px 0 10px"},children:n("quotes.starter.body")}),e.jsxs("div",{className:"flex flex-wrap items-center gap-2",children:[o.map(m=>e.jsx(ge,{type:"button",disabled:!!r,onClick:()=>d(m.language),children:r===m.language?n("quotes.starter.take.busy"):n("quotes.starter.take.label",{n:m.count,count:m.count,name:m.language})},m.language)),l&&e.jsx($,{style:{color:"var(--soft)"},children:l})]})]})}function Cr(t){return{quote:t.quote||"",note:t.note||"",color:t.color||"yellow",tags:t.tags||[],favorite:!!t.favorite,speaker:t.speaker||"",occasion:t.occasion||"",occasion_date:t.occasion_date||"",place:t.place||"",medium:t.medium||"",kind:t.kind||"",category:t.category||"other",language:t.language||"",translation:t.translation||"",board_id:t.board_id||null,region:t.region||"",recipient:t.recipient||"",work_title:t.work_title||"",locator:t.locator||"",occasion_circa:!!t.occasion_circa,sticker_id:t.sticker_id??null,sticker_x:t.sticker_x??null,sticker_y:t.sticker_y??null}}const wb={font:"inherit",color:"inherit",background:"none",border:"none",padding:0,cursor:"pointer",textDecoration:"underline",textUnderlineOffset:2};function qd(t,{people:a,seps:o,onOpenPerson:s,omitSpeaker:r}={}){const i=[t.occasion,sn(t.occasion_date),t.place,Aa(t),t.language].filter(Boolean);if(r)return i.join(" · ");if(!s)return[t.speaker,...i].filter(Boolean).join(" · ");const l=t.speaker?Je(t.speaker,o||Rn):[];return l.length===0&&i.length===0?"":e.jsxs(e.Fragment,{children:[l.length===0&&t.language&&e.jsx(yg,{languages:[t.language],size:20,ring:"var(--card)",className:"mr-1.5"}),l.length>0&&e.jsxs(e.Fragment,{children:[e.jsx(Ma,{names:l,map:a,size:20,ring:"var(--card)",className:"mr-1.5 align-middle"}),l.map((h,d)=>e.jsxs(c.Fragment,{children:[d>0&&", ",e.jsx(ir,{kind:"speaker",name:h,onOpen:s,className:"",style:wb})]},h))]}),l.length>0&&i.length>0&&" · ",i.join(" · ")]})}function Ar({initial:t,onSubmit:a,onCancel:o,submitLabel:s,tagSuggestions:r=[],stickers:i=[],reloadStickers:l,boards:h=[],defaultBoard:d=null}){const[m,p]=c.useState((t==null?void 0:t.quote)||""),[u,f]=c.useState((t==null?void 0:t.note)||""),[b,y]=c.useState((t==null?void 0:t.speaker)||""),[v,g]=c.useState((t==null?void 0:t.occasion)||""),[w,k]=c.useState((t==null?void 0:t.occasion_date)||""),[S,N]=c.useState((t==null?void 0:t.place)||""),[j,x]=c.useState((t==null?void 0:t.kind)||""),[M,q]=c.useState((t==null?void 0:t.category)||"other"),[E,O]=c.useState((t==null?void 0:t.board_id)??d??null),[_,T]=c.useState((t==null?void 0:t.language)||""),[B,L]=c.useState((t==null?void 0:t.region)||""),[V,P]=c.useState((t==null?void 0:t.recipient)||""),[C,H]=c.useState((t==null?void 0:t.work_title)||""),[R,I]=c.useState((t==null?void 0:t.locator)||""),[U,te]=c.useState(!!(t!=null&&t.occasion_circa)),[D,z]=c.useState((t==null?void 0:t.translation)||""),[K,A]=c.useState((t==null?void 0:t.color)||"yellow"),[Y,G]=c.useState((t==null?void 0:t.tags)||[]),[ae,Z]=c.useState((t==null?void 0:t.sticker_id)??null),[pe,ce]=c.useState(""),[F,Q]=c.useState(!1),ie=m.trim()?w&&!ua(w)?n("error.validate.date"):"":n("error.validate.quote-required"),he=qo(F?n("common.action.save.busy"):ie);async function ue(re){if(re.preventDefault(),ie)return ce(ie.toLowerCase());Q(!0),ce("");const J=await a({quote:m.trim(),note:u.trim(),speaker:b.trim(),occasion:v.trim(),occasion_date:w.trim(),place:S.trim(),medium:(t==null?void 0:t.medium)||"",kind:j,category:M,board_id:E,language:_.trim(),translation:D.trim(),region:B.trim(),recipient:V.trim(),work_title:C.trim(),locator:R.trim(),occasion_circa:U,color:K,tags:Y,favorite:!!(t!=null&&t.favorite),sticker_id:ae,sticker_x:(t==null?void 0:t.sticker_x)??null,sticker_y:(t==null?void 0:t.sticker_y)??null});if(Q(!1),J)return ce(J);t||(p(""),f(""),Z(null))}return e.jsxs("form",{id:he==null?void 0:he.formId,onSubmit:ue,className:"ann-form space-y-3",children:[e.jsxs("label",{className:"block",children:[e.jsx($,{className:"mb-1.5 block",children:n("common.field.quote.label")}),e.jsx("textarea",{className:"tp-input",rows:"3",value:m,onChange:re=>p(re.target.value)})]}),e.jsxs("label",{className:"block",children:[e.jsx($,{className:"mb-1.5 block",children:n("common.field.note.label")}),e.jsx("textarea",{className:"tp-input",rows:"2",value:u,onChange:re=>f(re.target.value)})]}),e.jsxs("div",{className:"cl-grid",children:[e.jsx(xe,{label:n("common.field.speaker.label"),nameCase:!0,placeholder:n("common.field.speaker.placeholder"),value:b,onChange:re=>y(re.target.value)}),e.jsx(xe,{label:n("common.field.occasion.label"),placeholder:n("common.field.occasion.placeholder"),value:v,onChange:re=>g(re.target.value)})]}),e.jsxs("div",{className:"cl-grid",children:[e.jsx(ma,{label:n("quotes.form.when.label"),value:w,onChange:k}),e.jsx(xe,{label:n("common.field.place.label"),placeholder:n("common.field.place.placeholder"),value:S,onChange:re=>N(re.target.value)})]}),e.jsxs("label",{className:"block",children:[e.jsx($,{className:"mb-1 block",children:n("quotes.form.kind.label")}),e.jsx(Oe,{ariaLabel:n("quotes.form.kind.label"),value:j,onChange:x,options:or()})]}),e.jsxs("label",{className:"block",children:[e.jsx($,{className:"mb-1 block",children:n("common.field.board.label")}),h.length>0&&e.jsx(Oe,{ariaLabel:n("common.field.board.label"),value:E==null?"":String(E),onChange:re=>O(re===""?null:Number(re)),options:h.map(re=>[String(re.id),re.name])})]}),e.jsx(xe,{label:n("common.field.language.label"),placeholder:n("common.field.language.placeholder"),value:_,onChange:re=>T(re.target.value)}),e.jsxs("div",{children:[e.jsx($,{className:"mb-1.5 block",children:n("quotes.form.carries.label")}),e.jsxs("div",{className:"cl-grid",children:[e.jsx(xe,{label:n("common.field.region.label"),placeholder:n("quotes.form.region.placeholder"),value:B,onChange:re=>L(re.target.value)}),e.jsx(xe,{label:n("common.field.recipient.label"),nameCase:!0,placeholder:n("quotes.form.recipient.placeholder"),value:V,onChange:re=>P(re.target.value)})]}),e.jsxs("div",{className:"cl-grid mt-3",children:[e.jsx(xe,{nameCase:!0,label:n("common.field.work-title.label"),placeholder:n("quotes.form.work-title.placeholder"),value:C,onChange:re=>H(re.target.value)}),e.jsx(xe,{label:n("common.field.locator.label"),placeholder:n("quotes.form.locator.placeholder"),value:R,onChange:re=>I(re.target.value)})]}),e.jsxs("label",{className:"mt-3 flex items-center gap-2",children:[e.jsx("input",{type:"checkbox",checked:U,onChange:re=>te(re.target.checked)}),e.jsx("span",{className:"microcopy",children:n("quotes.form.circa.label")})]})]}),e.jsxs("label",{className:"block",children:[e.jsx($,{className:"mb-1.5 block",children:n("common.field.translation.label")}),e.jsx("textarea",{className:"tp-input",rows:"2",placeholder:n("common.field.translation.placeholder"),value:D,onChange:re=>z(re.target.value)})]}),e.jsxs("label",{className:"block",children:[e.jsx($,{className:"mb-1.5 block",children:n("common.field.tags.label")}),e.jsx(pt,{value:Y,onChange:G,suggestions:r,placeholder:n("common.field.tags.placeholder"),ariaLabel:n("common.field.tags.label")})]}),e.jsxs("div",{className:"block",children:[e.jsx($,{className:"mb-1.5 block",children:n("common.field.sticker.label")}),e.jsx(Fo,{value:ae,onChange:Z,stickers:i,reload:l})]}),e.jsxs("div",{className:"flex flex-wrap items-center gap-3 pt-1",children:[e.jsx($,{children:n("common.mono.colour.label")}),e.jsx(nt,{value:K,onChange:A}),!he&&e.jsxs("div",{className:"ml-auto flex gap-2",children:[o&&e.jsx(ge,{type:"button",onClick:o,children:n("common.action.cancel.label")}),e.jsx("button",{className:bb,disabled:F||!!ie,title:ie||void 0,children:s})]})]}),e.jsx(ve,{children:pe})]})}function Md(t){const a=Number((t.occasion_date||"").slice(0,4));return Number.isInteger(a)&&a>0?a:null}const Yi=()=>[["none",n("quotes.group.none.label")],["speaker",n("quotes.group.speaker.label")],["kind",n("quotes.group.kind.label")],["place",n("quotes.group.place.label")],["decade",n("quotes.group.decade.label")]],vb={kind:"quotes.group.residual.kind.label",place:"quotes.group.residual.place.label",language:"quotes.group.residual.language.label"};function vs(t){return(t==null?void 0:t.kind)!=="proverb"?Yi():[...Yi(),["language",n("quotes.group.language.label")]]}function Od(t,a,o){return yr(t,a==="speaker"?"author":a,{credit:r=>r.speaker,splitCredit:!0,creditResidual:n("quotes.group.residual.speaker.label"),year:Md,facet:(r,i)=>i==="kind"?Ca(r.kind):r[i],facetResidual:r=>n(vb[r]||"quotes.group.residual.none.label"),seps:o})}const kb=()=>[["recent",n("quotes.sort.recent.label")],["speaker",n("quotes.sort.speaker.label")],["occasion",n("quotes.sort.occasion.label")],["said",n("quotes.sort.said.label")]];function Qi({items:t,columns:a,card:o}){const s=Xt(t.length,t,ld);return e.jsxs(e.Fragment,{children:[e.jsx(Ao,{columns:a,children:t.slice(0,s.count).map(o)}),s.more&&e.jsx("div",{ref:s.sentinel,"aria-hidden":"true",className:"h-px"})]})}function xb({creditSeparators:t,openId:a=null,onOpen:o,onClose:s}){const{boards:r,total:i,reload:l}=rd();return a==null?e.jsx(Ng,{boards:r,total:i,reload:l,onOpen:o}):e.jsx(jb,{boardId:a,boards:r,reloadBoards:l,creditSeparators:t,onClose:s},String(a))}function jb({boardId:t,boards:a,reloadBoards:o,creditSeparators:s,onClose:r}){const[i,l]=c.useState(null),[h,d]=c.useState(""),[m,p]=c.useState(null),[u,f]=c.useState(null),[b,y]=c.useState(null),[v,g]=c.useState(null),[w,k]=c.useState(!1),[S,N]=c.useState([]),[j,x]=He("tippani:quotes:color",""),[M,q]=He("tippani:quotes:fav",!1),[E,O]=He("tippani:quotes:tagged",!1),[_,T]=He("tippani:quotes:noted",!1),[B,L]=He("tippani:quotes:tag",""),[V,P]=He("tippani:quotes:speaker",""),[C,H]=He("tippani:quotes:kind",""),R=t===sd,I=(a||[]).find(se=>String(se.id)===String(t))||null,[U,te]=He("tippani:quotes:language",""),[D,z]=He("tippani:quotes:sort","recent"),[K,A]=He("tippani:quotes:group","none"),Y=K==="medium"?"kind":K,{stickers:G,reload:ae}=Oa(),{map:Z,reload:pe}=Qe("speaker"),[ce,F]=c.useState(null),Q=c.useMemo(()=>mn(s),[s]),ie=_e(),he=To(su),ue=c.useCallback(async()=>{const se=await X("GET","/quotes");se.ok?(l(se.data.utterances||[]),d("")):d(le(se))},[]);c.useEffect(()=>{ue()},[ue]),c.useEffect(()=>{X("GET","/tags").then(se=>{se.ok&&N(se.data.tags)})},[]);const re=c.useMemo(()=>Object.fromEntries(S.map(se=>[se.name,se])),[S]),J=c.useMemo(()=>Object.fromEntries(G.map(se=>[se.id,se])),[G]),de=c.useMemo(()=>R?i||[]:(i||[]).filter(se=>String(se.board_id)===String(t)),[i,R,t]),Te=c.useMemo(()=>{const se=new Set;for(const ke of de)for(const Re of Je(ke.speaker||"",Q))se.add(Re);return[...se].sort((ke,Re)=>ke.localeCompare(Re))},[de,Q]),Be=c.useMemo(()=>{const se=new Set(de.map(ke=>ke.kind).filter(Boolean));return ar.filter(ke=>se.has(ke))},[de]),We=c.useMemo(()=>{const se=new Set;for(const ke of de)ke.language&&se.add(ke.language);return[...se].sort((ke,Re)=>ke.localeCompare(Re))},[de]),qe=c.useMemo(()=>{let se=de;return j&&(se=se.filter(ke=>ke.color===j)),M&&(se=se.filter(ke=>ke.favorite)),E&&(se=se.filter(ke=>(ke.tags||[]).length>0)),_&&(se=se.filter(ke=>!!(ke.note||"").trim())),B&&(se=se.filter(ke=>(ke.tags||[]).includes(B))),V&&(se=se.filter(ke=>Je(ke.speaker||"",Q).includes(V))),C&&(se=se.filter(ke=>ke.kind===C)),U&&(se=se.filter(ke=>ke.language===U)),D==="recent"||(se=[...se],D==="speaker"?se.sort((ke,Re)=>(ke.speaker||"").localeCompare(Re.speaker||"")):D==="occasion"?se.sort((ke,Re)=>(ke.occasion||"").localeCompare(Re.occasion||"")):D==="said"&&se.sort((ke,Re)=>(ke.occasion_date||"￿").localeCompare(Re.occasion_date||"￿"))),se},[de,j,M,E,_,B,V,C,U,D,Q]),ne=vs(I).some(([se])=>se===Y)?Y:"none",me=c.useMemo(()=>ne==="none"?null:Od(qe,ne,Q),[qe,ne,Q]),oe=Xt(me?me.length:0,me,12);async function be(se,ke){const Re=await X("PUT",`/quotes/${se}`,ke);return Re.ok?(p(null),await ue(),null):le(Re,n("error.save.generic"))}async function ee(se,ke){const Re=await X("PUT",`/quotes/${se.id}`,{...Cr(se),...ke});return Re.ok?(d(""),wr(ke,{color:j})?await ue():l(Gn=>(Gn||[]).map(en=>en.id===se.id?{...en,...Re.data}:en)),!0):(d(le(Re,n("error.save.generic"))),!1)}async function je(se){if(!confirm(n("quotes.delete.confirm")))return;const ke=await Wn(`/quotes/${se.id}`,{reload:ue});ke.ok?ue():d(le(ke))}const Ne=se=>zc({quote:se.quote,translation:se.translation,note:se.note,category:se.category,language:se.language,speaker:se.speaker,occasion:se.occasion,when:sn(se.occasion_date),place:se.place,medium:Aa(se),date:pn(se.noted_at||se.created_at),tags:se.tags,color:se.color,people:Z,seps:Q}),Me=Ra(qe.map(se=>se.id)),ze=()=>{Me.clear(),ue()},fe=c.useMemo(()=>se=>e.jsx(Ar,{...se,boards:a||[],defaultBoard:R?null:Number(t)}),[a,R,t]),Ae=(se,ke)=>e.jsx(vo,{selection:Me,selectKind:"quote",a:se,variant:ke,meta:qd(se,{people:Z,seps:Q,onOpenPerson:F}),form:fe,tagMap:re,stickerMap:J,stickers:G,reloadStickers:ae,editing:m===se.id,setEditingId:p,save:be,patch:ee,remove:je,onMoveBoard:()=>y(se),onCopy:()=>ba(Ne(se)),onShare:()=>f(se),tagSuggestions:Object.keys(re),expanded:v===se.id,onToggleExpand:()=>g(v===se.id?null:se.id)},se.id),lt=e.jsx(nt,{value:j,onChange:se=>x(se===j?"":se),ariaLabel:n("quotes.filters.colour.aria")}),Un=[S.length>0&&["tag",n("common.filters.tag.aria"),B,L,[["",n("common.filters.tag.all.label")],...S.map(se=>[se.name,se.name])]],Te.length>0&&["speaker",n("quotes.filters.speaker.aria"),V,P,[["",n("quotes.filters.speaker.all.label")],...Te.map(se=>[se,se])]],Be.length>0&&["kind",n("quotes.filters.kind.aria"),C,H,[["",n("quotes.filters.kind.all.label")],...Be.map(se=>[se,Ca(se)])]],We.length>1&&["language",n("quotes.filters.language.aria"),U,te,[["",n("quotes.filters.language.all.label")],...We.map(se=>[se,se])]]].filter(Boolean),_r=e.jsx(Oe,{ariaLabel:n("common.filters.group.aria"),value:ne,onChange:A,options:vs(I)}),Jd=!R&&i!=null&&de.length===0?e.jsx(yb,{onDone:ue,boardID:Number(t)}):null;return e.jsxs(e.Fragment,{children:[!ie&&e.jsx("div",{className:"mb-3",children:e.jsx(ge,{icon:e.jsx(Zt,{}),onClick:r,children:n("quotes.board.back.label")})}),Jd,e.jsxs(jr,{mobile:ie,onBack:r,title:R?n("quotes.board.all.label"):(I==null?void 0:I.name)||n("nav.tab.quotes.label"),counts:i?n(I!=null&&I.description?"quotes.board.counts-described":"quotes.board.counts",{n:de.length,noun:n("unit.quote",{count:de.length}),description:I==null?void 0:I.description}):"",error:h,onExport:()=>k(!0),loaded:i!=null,hasItems:!!(i&&de.length>0),shownCount:qe.length,emptyText:n("quotes.board.empty"),noMatchText:n("quotes.board.nomatch"),noun:n("unit.quote.one"),nounPlural:n("unit.quote.other"),fav:M,setFav:q,tagged:E,setTagged:O,noted:_,setNoted:T,sort:D,setSort:z,sortOptions:kb(),leading:lt,leadingMobile:e.jsxs("div",{children:[e.jsx($,{className:"mb-2 block",children:n("common.mono.colour.label")}),lt]}),trailing:e.jsxs(e.Fragment,{children:[Un.map(([se,ke,Re,Gn,en])=>e.jsx(Oe,{ariaLabel:ke,value:Re,onChange:Gn,options:en},se)),e.jsxs("label",{className:"flex items-center gap-2",children:[e.jsx($,{children:n("common.mono.group.label")}),_r]})]}),trailingMobile:e.jsxs(e.Fragment,{children:[Un.map(([se,ke,Re,Gn,en])=>e.jsxs("div",{children:[e.jsx($,{className:"mb-2 block",children:n(`common.mono.${se}.label`)}),e.jsx(Oe,{ariaLabel:ke,value:Re,onChange:Gn,options:en})]},se)),e.jsxs("div",{children:[e.jsx($,{className:"mb-2 block",children:n("common.mono.group.label")}),_r]})]}),onReset:()=>{x(""),q(!1),O(!1),T(!1),L(""),P(""),setMedium(""),z("recent"),A("none")},exportDialog:e.jsx(vt,{open:w,title:n("quotes.export.confirm.title"),body:n("quotes.export.confirm.body",{count:qe.length,n:qe.length}),confirmLabel:n("common.action.export.label"),onCancel:()=>k(!1),onConfirm:async()=>{k(!1),await Ms("/export/quotes",{ids:qe.map(se=>se.id)},"tippani-quotes.md")}}),extraModals:e.jsxs(e.Fragment,{children:[u&&e.jsx(Ho,{share:Ne(u),seen:{kind:"utterance",id:u.id},onClose:()=>f(null)}),ce&&e.jsx(yn,{kind:ce.kind,name:ce.name,onClose:()=>F(null),onSaved:pe})]}),children:[Me.open&&e.jsx(Da,{selection:Me,rows:qe,onDone:ze,tagSuggestions:Object.keys(re),onEdit:p}),b&&e.jsx(id,{count:1,currentBoardID:b.board_id??null,onApply:async se=>{const ke=b;y(null);const Re=await X("POST","/quotes/bulk",{ids:[ke.id],board_id:se});if(!Re.ok)return Se(le(Re,n("error.move.generic")));Se(n("quotes.toast.moved")),await ue()},onClose:()=>y(null)}),i?me?e.jsxs("div",{className:"space-y-10",children:[me.slice(0,oe.count).map(se=>{const ke=ne==="speaker"&&!se.residual;return e.jsxs("section",{children:[e.jsx(kr,{label:se.label,count:se.items.length,noun:n("unit.quote.one"),nounPlural:n("unit.quote.other"),person:ke?Z[se.label]:null,onOpenPerson:ke?()=>F({kind:"speaker",name:se.label}):void 0}),e.jsx(Qi,{items:se.items,columns:he,card:Ae})]},se.key)}),oe.more&&e.jsx("div",{ref:oe.sentinel,"aria-hidden":"true",className:"h-px"})]}):e.jsx(Qi,{items:qe,columns:he,card:Ae}):e.jsx(Dt,{})]})]})}const Ld=Object.freeze(Object.defineProperty({__proto__:null,UtteranceForm:Ar,default:xb,groupOptionsFor:vs,groupUtterances:Od,utteranceMeta:qd,utteranceState:Cr,utteranceYear:Md},Symbol.toStringTag,{value:"Module"})),ea=[{kind:"markdown",ext:".md",accept:".md,.markdown,.txt",steps:2},{kind:"bookcision",ext:".json",accept:".json",steps:3},{kind:"hardcover-html",ext:".html",accept:".htm,.html",steps:3},{kind:"goodreads-html",ext:".html",accept:".htm,.html",steps:3},{kind:"imdb-quotes",ext:".html",accept:".htm,.html",steps:3},{kind:"kindle-notebook",ext:".html",accept:".htm,.html",steps:3},{kind:"kindle-clippings",ext:".txt",accept:".txt",steps:3,caveat:!0}],ta=t=>n(`import.source.${t}.title`),ks=t=>n(`import.source.${t}.desc`),_d=t=>Array.from({length:t.steps},(a,o)=>n(`import.source.${t.kind}.step.${o+1}`)),Sb=t=>t.caveat?n(`import.source.${t.kind}.caveat`):"";function Nb({onReviewImport:t,onStaged:a,embedded:o=!1}){const[s,r]=c.useState(null),[i,l]=c.useState(""),[h,d]=c.useState(0),[m,p]=c.useState(!1),u=Rs(),f=_e();async function b(y,v){if(m||v.length===0)return;p(!0),l(""),d(0);const g=v.map(S=>({name:S.name,pending:!0}));r([...g]);for(let S=0;S<v.length;S++){const N=await xa(`/import/${y}`,v[S]);g[S]=N.ok?{name:v[S].name,ok:!0,...N.data}:{name:v[S].name,ok:!1,error:le(N,n("error.import.failed"))},r([...g])}const k=g.filter(S=>S.ok).reduce((S,N)=>S+(N.staged||0),0);d(k),l(n("import.summary.arrow",{files:n("import.summary.files",{count:v.length,n:v.length}),quotes:n("import.summary.quotes",{count:k,n:k})})),a==null||a(),p(!1)}return e.jsxs("section",{className:"space-y-5",children:[!o&&e.jsx("div",{className:f?"mobile-sticky-bar":"",children:e.jsx(Gt,{title:n("import.title"),counts:n("import.counts")})}),f?e.jsx(Eb,{busy:m,onFiles:b}):e.jsx("div",{ref:u,className:"reveal grid gap-3 sm:grid-cols-2"+(o?"":" lg:grid-cols-4"),children:ea.map((y,v)=>e.jsx(Cb,{src:y,variant:v,color:xo[v%xo.length],busy:m,onFiles:g=>b(y.kind,g)},y.kind))}),s&&e.jsx(Ab,{results:s,summary:i,staged:h,onReviewImport:t}),e.jsx(Mb,{}),e.jsx(Tb,{})]})}function Tb(){return e.jsxs("details",{className:"px-4 py-3",style:{border:"1px dashed var(--line)",borderRadius:12,color:"var(--soft)"},children:[e.jsx("summary",{className:"mono-label cursor-pointer",style:{listStyle:"revert"},children:n("import.why-upload.summary")}),e.jsx("p",{className:"mt-2",style:{fontSize:"var(--type-ui-13)",lineHeight:1.55},children:Ie("import.why-upload.body",{emphasis:e.jsx("i",{children:n("import.why-upload.emphasis")})})})]})}const xo=["#E5C355","#7FA6C9","#D98CA6","#DF9A5B","#3F7D5A","#2F6D8F"];function Rd({muted:t,color:a,children:o}){const s=t?"var(--faint)":a||"var(--accent-ui)",r=a||"var(--accent)";return e.jsx("span",{className:"mono-label self-start",style:{color:s,border:`1.2px solid ${t?"var(--line)":`color-mix(in srgb, ${r} 55%, transparent)`}`,background:t?"transparent":`color-mix(in srgb, ${r} 13%, transparent)`,borderRadius:7,padding:"3px 8px"},children:o})}function Eb({busy:t,onFiles:a}){const[o,s]=c.useState("markdown"),[r,i]=c.useState(""),[l,h]=c.useState(!1),d=c.useRef(null),{popRef:m,style:p}=qt(l,d,{matchWidth:!0,minHeight:140});Mt(l,()=>h(!1),[d,m],{event:["mousedown","touchstart"]});const u=ea.findIndex(g=>g.kind===o),f=ea[u],b=xo[u%xo.length],y=r.trim().toLowerCase(),v=y?ea.filter(g=>`${ta(g.kind)} ${ks(g.kind)} ${g.ext}`.toLowerCase().includes(y)):ea;return e.jsxs("div",{className:"flex flex-col gap-3",children:[e.jsxs("div",{className:"relative",ref:d,children:[e.jsx("input",{type:"text",className:"tp-input",role:"combobox","aria-expanded":l,"aria-label":n("import.format.aria"),placeholder:n("import.format.search.placeholder"),value:l?r:ta(f.kind),onFocus:()=>{i(""),h(!0)},onChange:g=>{i(g.target.value),h(!0)}}),l&&Ue.createPortal(e.jsxs("div",{ref:m,className:"tp-select-panel",role:"listbox",style:p,children:[v.length===0&&e.jsx("p",{className:"microcopy px-3 py-2",children:n("import.format.none")}),v.map(g=>e.jsxs("button",{type:"button",role:"option","aria-selected":g.kind===o,className:"tp-select-opt tactile",onClick:()=>{s(g.kind),i(""),h(!1)},children:[ta(g.kind)," ",e.jsx("span",{className:"mono-label",style:{color:"var(--faint)",marginLeft:6},children:g.ext})]},g.kind))]}),document.body)]}),e.jsxs(Xe,{variant:u,colorBar:b,className:"flex flex-col gap-3 p-5",children:[e.jsx(Rd,{color:b,children:f.ext}),e.jsx("h3",{className:"text-base font-semibold",children:ta(f.kind)}),e.jsx("p",{className:"text-sm",style:{color:"var(--soft)"},children:ks(f.kind)}),e.jsx("ol",{className:"text-sm",style:{color:"var(--soft)",listStyle:"decimal",paddingLeft:20,display:"flex",flexDirection:"column",gap:6},children:_d(f).map((g,w)=>e.jsx("li",{children:g},w))}),e.jsxs("label",{className:"tp-btn tp-btn-primary w-full",style:t?{opacity:.55,cursor:"default"}:{cursor:"pointer"},children:[n("import.pick.label"),e.jsx("input",{type:"file",multiple:!0,accept:f.accept,className:"hidden",disabled:t,onChange:g=>{const w=[...g.target.files];g.target.value="",w.length>0&&a(f.kind,w)}})]})]})]})}function Cb({variant:t,src:a,busy:o,onFiles:s,color:r}){const{ext:i,accept:l}=a,h=_d(a),d=Sb(a),[m,p]=c.useState(!1),u=t%2?.7:-.7;return e.jsxs("div",{className:"relative",onDragOver:f=>{f.preventDefault(),p(!0)},onDragLeave:()=>p(!1),onDrop:f=>{f.preventDefault(),p(!1),s([...f.dataTransfer.files])},children:[e.jsx(Xe,{variant:t,colorBar:r,className:"absolute inset-0",style:{rotate:`${u}deg`,...m?{borderColor:r,background:`color-mix(in srgb, ${r} 8%, var(--card))`}:null},"aria-hidden":"true"}),e.jsxs("div",{className:"relative flex h-full flex-col gap-3 p-5",children:[e.jsx(Rd,{color:r,children:i}),e.jsxs("div",{className:"flex items-center gap-1.5",children:[e.jsx("h3",{className:"text-base font-semibold",children:ta(a.kind)}),h.length>0&&e.jsx(Le,{text:h.map((f,b)=>`${b+1}. ${f}`).join("  ")}),d&&e.jsx("span",{className:"tp-chip shrink-0",style:{color:"var(--amber)",fontSize:"var(--type-ui-9)"},children:n("import.experimental.label")})]}),e.jsx("p",{className:"text-sm",style:{color:"var(--soft)"},children:ks(a.kind)}),d&&e.jsxs("p",{className:"microcopy",style:{color:"var(--amber, var(--accent-ui))"},children:["⚠ ",d]}),e.jsxs("div",{className:"mt-auto",children:[e.jsxs("label",{className:"tp-btn tp-btn-ghost w-full",style:o?{opacity:.55,cursor:"default"}:{cursor:"pointer"},children:[n("import.choose.label"),e.jsx("input",{type:"file",multiple:!0,accept:l,className:"hidden",disabled:o,onChange:f=>{const b=[...f.target.files];f.target.value="",b.length>0&&s(b)}})]}),e.jsx("p",{className:"microcopy mt-1.5 text-center",children:n("import.drop.hint")})]})]})]})}function Ab({results:t,summary:a,staged:o,onReviewImport:s}){return e.jsxs("div",{className:"hand-card hc-r2 space-y-1.5 p-4",style:{borderLeft:"4px solid var(--accent)"},children:[a&&e.jsx("p",{className:"microcopy",style:{color:"var(--ink)"},children:a}),t.map((r,i)=>e.jsxs("div",{children:[e.jsxs("p",{className:"microcopy",children:[r.name," →"," ",r.pending?"…":r.ok?n("import.row.staged",{count:r.staged,n:r.staged}):e.jsx("span",{style:{color:"var(--error)"},children:r.error})]}),r.ok&&e.jsx(Ob,{row:r}),r.ok&&(r.works||[]).map(l=>e.jsx(qb,{work:l},l.id)),r.ok&&r.possible_duplicates&&r.possible_duplicates.length>0&&e.jsx("p",{className:"microcopy",style:{color:"var(--amber, var(--accent-ui))"},children:n("import.row.duplicate",{titles:r.possible_duplicates.map(l=>l.title).join(", ")})})]},i)),o>0&&s&&e.jsx("button",{className:"tp-btn tp-btn-primary mt-1.5",onClick:s,children:n("import.review",{count:o,n:o})}),o>0&&!s&&e.jsx("p",{className:"microcopy",style:{color:"var(--accent-ui)"},children:n("import.review.absent")})]})}function qb({work:t}){const a=n(t.kind==="book"?"unit.book":t.kind==="show"?"unit.show":"unit.film",{count:1});return e.jsxs("div",{className:"microcopy",style:{color:"var(--soft)"},children:[e.jsxs("span",{children:[t.title," (",t.staged,") →"," ",t.target_id?t.target_year?n("import.work.joins-year",{title:t.target_title||t.title,year:t.target_year}):n("import.work.joins",{title:t.target_title||t.title}):n("import.work.new",{kind:a})]}),t.ambiguous&&e.jsx("p",{style:{color:"var(--amber, var(--accent-ui))"},children:n("import.work.ambiguous",{n:t.alternatives+1,title:t.title})})]})}function Mb(){return e.jsx("p",{className:"microcopy px-4 py-3",style:{border:"1px dashed var(--line)",borderRadius:12,color:"var(--soft)"},children:Ie("import.nothing-lands.body",{queue:e.jsx("b",{children:n("staging.title")})})})}function Ob({row:t}){const a=[],o=(s,r)=>n(s,{count:r,n:r});return t.bookmarks_skipped&&a.push(o("import.clippings.bookmarks",t.bookmarks_skipped)),t.notes_merged&&a.push(o("import.clippings.notes",t.notes_merged)),t.near_duplicates&&a.push(o("import.clippings.duplicates",t.near_duplicates)),t.blocks_malformed&&a.push(o("import.clippings.malformed",t.blocks_malformed)),a.length===0?null:e.jsxs("p",{className:"microcopy",style:{color:t.blocks_malformed?"var(--amber, var(--accent-ui))":"var(--soft)"},children:[t.blocks_malformed?"⚠ ":"",a.join(" · ")]})}function Ga(t,a){const o=[t,""];return Object.defineProperty(o,1,{get:()=>n(a),enumerable:!0,configurable:!0}),o}const Lb=[Ga("book","vocab.kind.book.label"),Ga("film","vocab.kind.movie.label"),Ga("show","vocab.kind.show.label"),Ga("game","vocab.kind.game.label")],_b={book:"library",film:"movies",show:"movies",game:"movies"};function Dd(t){return Lb.filter(([a])=>(t==null?void 0:t[_b[a]])!==!1)}function Id(t){return{kind:"book",id:t.id,title:t.title,sub:t.author||"",tag:"BOOK"}}function qr(t){const a=t.media_type==="show"?"show":t.media_type==="game"?"game":"movie";return{kind:"screen",id:t.id,title:t.title,sub:t.release_year?String(t.release_year):"",media_type:a,tag:a==="show"?"SHOW":a==="game"?"GAME":"FILM"}}function Pd({initialKind:t="book",onAdded:a,onCreated:o,initialQuery:s="",hideManual:r=!1,sections:i}){const l=Dd(i),[h,d]=c.useState(()=>{var z;const D=t==="film"||t==="show"||t==="game"?t:"book";return l.some(([K])=>K===D)?D:((z=l[0])==null?void 0:z[0])||"book"}),[m,p]=c.useState(s||""),[u,f]=c.useState(""),[b,y]=c.useState(null),[v,g]=c.useState(!1),[w,k]=c.useState(""),[S,N]=c.useState(null),[j,x]=c.useState(!1),[M,q]=c.useState({movie:!1,game:!1}),[E,O]=c.useState(-1),_=h==="book",T=h==="show"?"show":h==="game"?"game":"movie",B=c.useMemo(()=>b&&_?Tm(b):null,[b,_]);c.useEffect(()=>{X("GET","/metadata/status").then(D=>{var z,K,A,Y;D.ok&&q({movie:((K=(z=D.data)==null?void 0:z.tmdb)==null?void 0:K.source)==="none",game:((Y=(A=D.data)==null?void 0:A.igdb)==null?void 0:Y.source)==="none"})})},[]);const L=!_&&(h==="game"?M.game:M.movie);function V(D){d(D),y(null),k(""),N(null),O(-1)}function P(D,z){z&&o&&o(D==="book"?Id(z):qr(z)),a==null||a(D)}c.useEffect(()=>{s&&s.trim()&&h==="book"&&C()},[]);async function C(){const D=m.trim();if(!D)return;g(!0),k(""),N(null),y(null),O(-1);let z;if(_)z=await X("POST","/books/lookup",kd(D)?{isbn:D}:{title:D});else{const K={title:D,media_type:T};u.trim()&&(K.year=Number(u)),z=await X("POST","/movies/lookup",K)}if(g(!1),z.ok)return y(z.data.candidates);if(!_&&z.status===503)return x(!0);k(le(z,n("error.lookup.failed")))}async function H(D){k("");const z=await X("POST","/books",{title:D.title,author:D.author||void 0,isbn:D.isbn13||void 0,description:D.description||void 0,published_year:D.published_year||void 0,genres:D.genres||void 0,cover_url:D.cover_url||void 0,source:D.source,source_id:D.source_id,google_id:D.google_id||void 0,openlibrary_id:D.openlibrary_id||void 0});z.ok?P("book",z.data):k(le(z,n("error.add.book")))}async function R(D,z=!1){var A;k("");const K=await X("POST","/movies",{...ys(D,T),confirm_new:z});if(K.ok)return P("film",K.data);if(K.status===409&&((A=K.data)!=null&&A.needs_confirm))return N({cand:D,existing:K.data.existing||[]});k(le(K,n("error.add.title")))}async function I(D,z){g(!0),k("");const K=await X("PUT",`/movies/${D}`,ys(z,T));if(g(!1),K.ok)return P("film",K.data);k(le(K,n("error.enrich.title")))}const U=n(_?"capture.lookup.book.placeholder":T==="show"?"capture.lookup.show.placeholder":T==="game"?"capture.lookup.game.placeholder":"capture.lookup.film.placeholder"),te=!S&&(!!w||b&&b.length===0);return e.jsxs("div",{className:"space-y-3",children:[l.length>1&&e.jsx(Ye,{ariaLabel:n("capture.lookup.kind.aria"),value:h,onChange:V,options:l}),e.jsxs("form",{onSubmit:D=>{D.preventDefault(),C()},className:"flex flex-wrap gap-2",children:[e.jsx("input",{className:"tp-input min-w-0 flex-1",style:{minWidth:180},"aria-label":U,placeholder:U,autoFocus:!0,value:m,onChange:D=>p(D.target.value)}),e.jsx("input",{className:"tp-input w-20 shrink-0",placeholder:n("capture.lookup.year.placeholder"),"aria-label":n("capture.lookup.year.aria"),inputMode:"numeric",maxLength:4,value:u,onChange:D=>f(D.target.value.replace(/\D/g,"").slice(0,4))}),e.jsx("button",{className:"tp-btn tp-btn-primary shrink-0",disabled:v,children:n(v?"capture.lookup.search.busy":"capture.lookup.search.label")})]}),L&&e.jsx("p",{className:"microcopy",style:{color:"var(--soft)"},children:n(h==="game"?"capture.lookup.nokey.game":"capture.lookup.nokey.film")}),e.jsx(ve,{children:w}),S&&e.jsx(Nd,{confirm:S,busy:v,onEnrich:D=>I(D,S.cand),onAddSeparate:()=>R(S.cand,!0),onCancel:()=>N(null)}),!S&&b&&b.length===0&&e.jsx(Vt,{children:n("capture.lookup.empty")}),!S&&b&&b.length>0&&e.jsx("ul",{className:"space-y-2.5",children:_?B.map((D,z)=>{const K=E===z,A=D.editions.length;return e.jsxs(c.Fragment,{children:[e.jsx(Ko,{cover:D.cover_url,title:D.rep.title,sub:A>1?D.rep.author:[D.rep.author,D.rep.published_year||null,D.rep.isbn13].filter(Boolean).join(" · "),source:D.rep.source,count:A,expanded:K,onAdd:()=>A>1?O(K?-1:z):H(D.rep),busy:v}),K&&e.jsx("li",{children:e.jsx("ul",{className:"ml-6 space-y-2 border-l pl-3",style:{borderColor:"var(--line)"},children:D.editions.map((Y,G)=>e.jsx(Ko,{cover:Y.cover_url,title:Y.title,sub:[Y.published_year||null,Y.isbn13].filter(Boolean).join(" · ")||n("capture.lookup.edition.none.label"),source:Y.source,onAdd:()=>H(Y),busy:v},G))})})]},z)}):b.map((D,z)=>e.jsx(Ko,{cover:D.poster_url,title:D.title,sub:[D.release_year||null].filter(Boolean).join(" · "),source:D.source,sourceDetail:Tr(D),onAdd:()=>R(D),busy:v},z))}),!r&&te&&e.jsx(ge,{onClick:()=>x(!0),children:n("capture.lookup.manual.button.label")}),!r&&e.jsx("button",{type:"button",className:"tp-link block",onClick:()=>x(!0),children:n("capture.lookup.manual.link.label")}),j&&e.jsx(Rb,{kind:h,year:u,onClose:()=>x(!1),onAdded:P})]})}const Zo="manual-add-form";function Rb({kind:t,onClose:a,onAdded:o}){At(!0);const[s,r]=c.useState(t==="show"?"show":t==="game"?"game":"movie"),[i,l]=c.useState(""),[h,d]=c.useState(!1);c.useEffect(()=>{const u=f=>{f.key==="Escape"&&a()};return document.addEventListener("keydown",u),()=>document.removeEventListener("keydown",u)},[a]);const m=n(t==="book"?"capture.manual.book.title":t==="show"?"capture.manual.show.title":t==="game"?"capture.manual.game.title":"capture.manual.film.title"),p=!h&&!!i.trim();return Ue.createPortal(e.jsx("div",{className:"tp-scrim fixed inset-0 flex items-start justify-center overflow-y-auto px-4 py-10",style:{zIndex:60},role:"dialog","aria-modal":"true","aria-label":m,onMouseDown:u=>{u.target===u.currentTarget&&a()},children:e.jsxs(Xe,{variant:1,className:"w-full max-w-lg px-6 py-6",children:[e.jsxs("div",{className:"mb-4 flex items-center gap-2",children:[e.jsx("h3",{className:"display-title flex-1 text-lg",children:m}),e.jsx(Pe,{icon:e.jsx(ft,{}),type:"submit",form:Zo,ariaLabel:n("common.action.save.label"),tooltip:n(p?"common.action.save.label":"error.validate.title-required"),disabled:!p}),e.jsx(Pe,{icon:e.jsx(it,{}),ariaLabel:n("common.action.close.label"),tooltip:n("capture.close.tip"),onClick:a})]}),t==="book"?e.jsx(xd,{formId:Zo,title:i,setTitle:l,onBusy:d,onAdded:u=>{o("book",u),a()}}):e.jsx(Td,{formId:Zo,mediaType:s,setMediaType:r,title:i,setTitle:l,onBusy:d,onAdded:u=>{o("film",u),a()}})]})}),document.body)}const Xi=8;function Ka(t,a){if(!a)return 0;const o=t.title.toLowerCase();return o.startsWith(a)?0:o.includes(a)?1:2}function Bd({works:t,value:a,onChange:o,onCreate:s}){const[r,i]=c.useState(""),[l,h]=c.useState(!1),[d,m]=c.useState(0),p=c.useRef(null),{popRef:u,style:f}=qt(l,p,{matchWidth:!0,minHeight:140});Mt(l,()=>h(!1),[p,u],{event:"pointerdown"});const b=r.trim().toLowerCase(),y=(t||[]).filter(x=>!b||x.title.toLowerCase().includes(b)||(x.sub||"").toLowerCase().includes(b)),v=y.filter(x=>x.kind==="book").sort((x,M)=>Ka(x,b)-Ka(M,b)),g=y.filter(x=>x.kind!=="book").sort((x,M)=>Ka(x,b)-Ka(M,b)),w=[];for(let x=0;w.length<Xi&&(x<v.length||x<g.length);x++)for(const M of[v,g])M[x]&&w.length<Xi&&w.push(M[x]);const k=w.length+1,S=x=>{o(x),i(""),h(!1)},N=()=>{s(r.trim()),i(""),h(!1)};function j(x){if(x.key==="ArrowDown")x.preventDefault(),l?m(M=>Math.min(M+1,k-1)):h(!0);else if(x.key==="ArrowUp")x.preventDefault(),m(M=>Math.max(M-1,0));else if(x.key==="Enter"){if(x.preventDefault(),!l)return;d<w.length?S(w[d]):N()}else x.key==="Escape"&&h(!1)}return a?e.jsxs("div",{className:"mt-1 flex flex-wrap items-center gap-2",children:[e.jsx("span",{className:"font-semibold",style:{fontFamily:"var(--font-display)",fontWeight:"var(--font-display-weight)",fontStyle:"var(--font-display-style)",fontVariantCaps:"var(--font-display-caps)",textTransform:"var(--font-display-case)",fontVariantNumeric:"var(--font-display-figures)",fontSize:"var(--type-display-17)"},children:a.title}),a.sub&&e.jsx("span",{className:"microcopy",children:a.sub}),e.jsx("span",{className:"mono-label",style:{fontSize:"var(--type-display-9)",color:a.kind==="book"?"var(--accent-ui)":"var(--amber)"},children:a.tag}),e.jsx("button",{type:"button",className:"tp-link ml-auto",onClick:()=>o(null),children:n("capture.picker.change.label")})]}):e.jsxs("div",{className:"token-input",ref:p,children:[e.jsx("input",{className:"tp-input",placeholder:n("capture.picker.placeholder"),value:r,onChange:x=>{i(x.target.value),h(!0),m(0)},onFocus:()=>h(!0),onKeyDown:j}),l&&Ue.createPortal(e.jsxs("ul",{ref:u,className:"token-menu",style:f,role:"listbox",children:[w.map((x,M)=>e.jsx("li",{children:e.jsx("button",{type:"button",className:"token-opt"+(d===M?" hi":""),onClick:()=>S(x),children:e.jsxs("span",{className:"flex items-center justify-between gap-3",children:[e.jsxs("span",{className:"truncate",children:[x.title,x.sub&&e.jsxs("span",{style:{color:"var(--soft)"},children:[" · ",x.sub]})]}),e.jsx("span",{className:"mono-label",style:{flex:"none",fontSize:"var(--type-ui-9)",color:x.kind==="book"?"var(--accent-ui)":"var(--amber)"},children:x.tag})]})})},`${x.kind}:${x.id}`)),e.jsx("li",{children:e.jsx("button",{type:"button",className:"token-opt"+(d===w.length?" hi":""),style:{color:"var(--accent-ui)",fontWeight:600},onClick:N,children:r.trim()?n("capture.picker.create.label",{title:`“${r.trim()}”`}):n("capture.picker.create.blank.label")})})]}),document.body)]})}const Db="tippani:lastCapture",Ib=1800*1e3;function Pb({initialTarget:t=null,initialStandalone:a=!1,onCaptured:o,onWorkCreated:s,onSaveState:r}){var L,V,P,C,H;At(!0);const[i,l]=c.useState(null),[h,d]=c.useState(null),[m,p]=c.useState(""),[u,f]=c.useState(!1),[b,y]=He(Db,null),[v]=c.useState(()=>{if(!b||typeof b!="object")return{color:"yellow",tags:"",targetKey:null};const R=typeof b.at=="number"&&Date.now()-b.at<Ib;return{color:b.color||"yellow",tags:b.tags||"",targetKey:R&&b.targetKey||null}}),[g,w]=c.useState({target:null,quote:"",note:"",chapter:"",chapter_no:"",location:"",character:"",timestamp:"",season:"",episode:"",episodeName:"",act:"",quest:"",tags:v.tags,color:v.color,speaker:"",occasion:"",occasionDate:"",place:"",kind:"",region:"",recipient:"",workTitle:"",locator:"",circa:!1}),[k,S]=c.useState(a);c.useEffect(()=>{S(a)},[a]),c.useEffect(()=>{Promise.all([X("GET","/books"),X("GET","/movies")]).then(([R,I])=>{const U=[];if(R.ok&&R.data)for(const te of R.data.books||[])U.push({kind:"book",id:te.id,title:te.title,sub:te.author||"",tag:n("common.badge.book")});if(I.ok&&I.data)for(const te of I.data.movies||[])U.push(qr(te));if(l(U),t){const te=t.type==="movie"?"screen":"book",D=U.find(z=>z.kind===te&&z.id===t.id);D&&w(z=>({...z,target:D}))}else if(v.targetKey){const te=U.find(D=>`${D.kind}:${D.id}`===v.targetKey);te&&w(D=>D.target?D:{...D,target:te})}})},[t==null?void 0:t.type,t==null?void 0:t.id]);const N=R=>w(I=>({...I,...R})),j=!k&&((L=g.target)==null?void 0:L.kind)==="screen",x=j&&((V=g.target)==null?void 0:V.media_type)==="show",M=j&&((P=g.target)==null?void 0:P.media_type)==="game",q=oc(k?null:g.target),E=`capture-${((C=g.target)==null?void 0:C.kind)||"none"}-${((H=g.target)==null?void 0:H.id)||0}`,O=j?q.actorFor(g.character):"";function _(R){l(I=>[R,...I||[]]),N({target:R}),d(null),s==null||s()}const T=k?g.quote.trim()?g.occasionDate&&!ua(g.occasionDate)?n("error.validate.date"):"":n("error.validate.quote-words"):g.target?j&&!g.quote.trim()?n("error.validate.line-words"):!j&&!g.quote.trim()&&!g.note.trim()?n("error.validate.quote-or-note"):x&&on(g.episode)!=null&&on(g.season)==null?n("error.validate.season-required"):"":n("error.validate.target-required");async function B(){const R=g.target;if(T)return p(T.toLowerCase());f(!0),p("");const I=g.tags.split(",").map(te=>te.trim()).filter(Boolean),U=k?await X("POST","/quotes",{quote:g.quote.trim(),note:g.note.trim(),speaker:g.speaker.trim(),occasion:g.occasion.trim(),occasion_date:g.occasionDate.trim(),place:g.place.trim(),kind:g.kind,region:g.region.trim(),recipient:g.recipient.trim(),work_title:g.workTitle.trim(),locator:g.locator.trim(),occasion_circa:g.circa,color:g.color,tags:I}):j?await X("POST","/dialogues",{movie_id:R.id,quote:g.quote.trim(),note:g.note.trim(),character:g.character.trim(),timestamp:M?"":g.timestamp.trim(),act:M?g.act.trim():"",quest:M?g.quest.trim():"",season:x?on(g.season):null,episode:x?on(g.episode):null,episode_name:x?g.episodeName.trim():"",color:g.color,tags:I}):await X("POST","/annotations",{book_id:R.id,quote:g.quote.trim(),note:g.note.trim(),chapter:g.chapter.trim(),chapter_no:Number(String(g.chapter_no).trim())||0,location:g.location.trim(),character:g.character.trim(),color:g.color,tags:I});if(f(!1),!U.ok)return p(le(U));Se(n(k?"capture.toast.quote":j?"capture.toast.dialogue":"capture.toast.annotation")),y({at:Date.now(),color:g.color,tags:g.tags,targetKey:k||!R?null:`${R.kind}:${R.id}`}),o==null||o()}return c.useEffect(()=>{r==null||r({canSave:!T&&!u,busy:u,why:T,save:B})},[T,u,g]),e.jsxs("div",{className:"flex flex-col gap-3.5",children:[e.jsxs("div",{className:"tp-field",children:[e.jsxs("div",{className:"flex items-center justify-between gap-2",children:[e.jsx($,{children:n(k?"capture.form.standalone.label":"capture.form.target.label")}),e.jsx("button",{type:"button",className:ct(k),"aria-pressed":k,onClick:()=>{S(!k),d(null),p(""),k||N({target:null})},children:n("capture.form.standalone.chip.label")})]}),!k&&e.jsx(Bd,{works:i,value:g.target,onChange:R=>{N({target:R}),R&&d(null)},onCreate:R=>{p(""),d({title:R})}})]}),h&&!g.target&&!k&&e.jsxs("div",{className:"space-y-2.5",style:{border:"1.4px dashed var(--ink-border)",borderRadius:10,padding:"10px 12px"},children:[e.jsxs("div",{className:"flex items-center justify-between gap-2",children:[e.jsx($,{children:n("capture.form.create.label")}),e.jsx("button",{type:"button",className:"tp-link",onClick:()=>d(null),children:n("capture.form.create.cancel.label")})]}),e.jsx(Pd,{initialQuery:h.title,onCreated:_})]}),e.jsxs("label",{className:"tp-field",children:[e.jsx($,{children:n("common.field.quote.label")}),e.jsx("textarea",{className:"tp-input",rows:4,placeholder:n("capture.form.quote.placeholder"),style:{fontFamily:"var(--font-display)",fontWeight:"var(--font-display-weight)",fontVariantCaps:"var(--font-display-caps)",textTransform:"var(--font-display-case)",fontVariantNumeric:"var(--font-display-figures)",fontStyle:"italic",fontSize:"var(--type-display-17)",lineHeight:1.55},value:g.quote,onChange:R=>N({quote:R.target.value})})]}),e.jsxs("label",{className:"tp-field",children:[e.jsx($,{children:n("common.field.note.label")}),e.jsx("textarea",{className:"tp-input",rows:2,placeholder:n("capture.form.note.placeholder"),value:g.note,onChange:R=>N({note:R.target.value})})]}),k?e.jsxs(e.Fragment,{children:[e.jsxs("div",{className:"grid grid-cols-2 gap-3",children:[e.jsxs("label",{className:"tp-field",children:[e.jsx($,{children:n("common.field.speaker.label")}),e.jsx("input",{className:"tp-input",placeholder:n("common.field.speaker.placeholder"),value:g.speaker,onChange:R=>N({speaker:R.target.value})})]}),e.jsxs("label",{className:"tp-field",children:[e.jsx($,{children:n("common.field.occasion.label")}),e.jsx("input",{className:"tp-input",placeholder:n("common.field.occasion.placeholder"),value:g.occasion,onChange:R=>N({occasion:R.target.value})})]})]}),e.jsxs("div",{className:"grid grid-cols-2 gap-3",children:[e.jsx(ma,{label:n("quotes.form.when.label"),value:g.occasionDate,onChange:R=>N({occasionDate:R})}),e.jsxs("label",{className:"tp-field",children:[e.jsx($,{children:n("common.field.place.label")}),e.jsx("input",{className:"tp-input",placeholder:n("common.field.place.placeholder"),value:g.place,onChange:R=>N({place:R.target.value})})]})]}),e.jsxs("label",{className:"tp-field",children:[e.jsx($,{children:n("quotes.form.kind.label")}),e.jsx(Oe,{ariaLabel:n("quotes.form.kind.label"),value:g.kind,onChange:R=>N({kind:R}),options:or()})]}),e.jsx($,{children:n("quotes.form.carries.label")}),e.jsxs("div",{className:"grid grid-cols-2 gap-3",children:[e.jsxs("label",{className:"tp-field",children:[e.jsx($,{children:n("common.field.region.label")}),e.jsx("input",{className:"tp-input",placeholder:n("quotes.form.region.placeholder"),value:g.region,onChange:R=>N({region:R.target.value})})]}),e.jsxs("label",{className:"tp-field",children:[e.jsx($,{children:n("common.field.recipient.label")}),e.jsx("input",{className:"tp-input",placeholder:n("quotes.form.recipient.placeholder"),value:g.recipient,onChange:R=>N({recipient:R.target.value})})]})]}),e.jsxs("div",{className:"grid grid-cols-2 gap-3",children:[e.jsxs("label",{className:"tp-field",children:[e.jsx($,{children:n("common.field.work-title.label")}),e.jsx("input",{className:"tp-input",placeholder:n("quotes.form.work-title.placeholder"),value:g.workTitle,onChange:R=>N({workTitle:R.target.value})})]}),e.jsxs("label",{className:"tp-field",children:[e.jsx($,{children:n("common.field.locator.label")}),e.jsx("input",{className:"tp-input",placeholder:n("quotes.form.locator.placeholder"),value:g.locator,onChange:R=>N({locator:R.target.value})})]})]}),e.jsxs("label",{className:"flex items-center gap-2",children:[e.jsx("input",{type:"checkbox",checked:g.circa,onChange:R=>N({circa:R.target.checked})}),e.jsx("span",{className:"microcopy",children:n("quotes.form.circa.label")})]})]}):j?e.jsxs(e.Fragment,{children:[e.jsxs("div",{className:"grid grid-cols-2 gap-3",children:[e.jsxs("div",{children:[e.jsx(us,{label:n("common.field.character.label"),placeholder:n("common.field.character.placeholder"),value:g.character,onChange:R=>N({character:R}),cast:q.cast}),O&&e.jsx("span",{className:"microcopy",children:n("capture.form.played-by.prose",{name:O})})]}),M?e.jsxs("label",{className:"tp-field",children:[e.jsx($,{children:n("common.field.act.label")}),e.jsx("input",{className:"tp-input",placeholder:n("capture.form.act.placeholder"),value:g.act,onChange:R=>N({act:R.target.value})})]}):e.jsxs("label",{className:"tp-field",children:[e.jsx($,{children:n("common.field.timestamp.label")}),e.jsx("input",{className:"tp-input",placeholder:n("capture.form.timestamp.placeholder"),value:g.timestamp,onChange:R=>N({timestamp:R.target.value})})]})]}),M&&e.jsxs("label",{className:"tp-field",children:[e.jsx($,{children:n("common.field.quest.label")}),e.jsx("input",{className:"tp-input",placeholder:n("capture.form.quest.placeholder"),value:g.quest,onChange:R=>N({quest:R.target.value})})]}),x&&e.jsxs(e.Fragment,{children:[e.jsxs("div",{className:"grid grid-cols-2 gap-3",children:[e.jsxs("label",{className:"tp-field",children:[e.jsx($,{children:n("common.field.season.label")}),e.jsx("input",{className:"tp-input",type:"number",min:"0",max:"999",placeholder:n("capture.form.season.placeholder"),value:g.season,onChange:R=>N({season:R.target.value})})]}),e.jsxs("label",{className:"tp-field",children:[e.jsx($,{children:n("common.field.episode.label")}),e.jsx("input",{className:"tp-input",type:"number",min:"0",max:"9999",placeholder:n("capture.form.episode.placeholder"),value:g.episode,onChange:R=>N({episode:R.target.value})})]})]}),e.jsxs("label",{className:"tp-field",children:[e.jsx($,{children:n("common.field.episode-name.label")}),e.jsx("input",{className:"tp-input",placeholder:n("capture.form.episode-name.placeholder"),value:g.episodeName,onChange:R=>N({episodeName:R.target.value})})]})]})]}):e.jsxs(e.Fragment,{children:[e.jsxs("div",{className:"grid grid-cols-2 gap-3",children:[e.jsxs("label",{className:"tp-field",children:[e.jsx($,{children:n("common.field.chapter-no.label")}),e.jsx("input",{className:"tp-input",inputMode:"decimal",list:q.chapterNumbers.length?`${E}-chno`:void 0,placeholder:n("capture.form.chapter-no.placeholder"),value:g.chapter_no,onChange:R=>N({chapter_no:R.target.value.replace(/[^\d.]/g,"").slice(0,7)})}),e.jsx(go,{id:`${E}-chno`,options:q.chapterNumbers})]}),e.jsxs("label",{className:"tp-field",children:[e.jsx($,{children:n("common.field.chapter-name.label")}),e.jsx("input",{className:"tp-input",list:q.chapterNames.length?`${E}-chname`:void 0,placeholder:n("capture.form.chapter-name.placeholder"),value:g.chapter,onChange:R=>{const I=R.target.value,U=q.chapterNoFor(I);N(U&&!String(g.chapter_no).trim()?{chapter:I,chapter_no:String(U)}:{chapter:I})}}),e.jsx(go,{id:`${E}-chname`,options:q.chapterNames})]}),e.jsxs("label",{className:"tp-field",children:[e.jsx($,{children:n("common.field.location.label")}),e.jsx("input",{className:"tp-input",placeholder:n("capture.form.location.placeholder"),value:g.location,onChange:R=>N({location:R.target.value})})]})]}),e.jsx(us,{label:n("common.field.character.label"),placeholder:n("book.quote.form.character.placeholder"),value:g.character,onChange:R=>N({character:R}),cast:q.cast})]}),e.jsxs("label",{className:"tp-field",children:[e.jsx($,{children:n("capture.form.tags.label")}),e.jsx("input",{className:"tp-input",style:{fontFamily:"var(--font-mono)",fontWeight:"var(--font-mono-weight)",fontStyle:"var(--font-mono-style)",fontVariantCaps:"var(--font-mono-caps)",textTransform:"var(--font-mono-case)",fontVariantNumeric:"var(--font-mono-figures)",fontSize:"var(--type-mono-13)"},placeholder:n("capture.form.tags.placeholder"),value:g.tags,onChange:R=>N({tags:R.target.value})})]}),e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx($,{children:n("common.mono.colour.label")}),e.jsx(nt,{value:g.color,onChange:R=>N({color:R})})]}),e.jsx(ve,{children:m}),T&&e.jsx("p",{className:"microcopy",style:{color:"var(--faint)"},children:n("capture.form.missing.hint",{reason:T})})]})}function Bb({open:t,initialSection:a="book",initialTarget:o=null,onClose:s,onAdded:r,onOpenMovie:i,onCaptured:l,onWorkCreated:h,pendingImport:d=0,onReviewImport:m,onStaged:p,sections:u}){const b=Dd(u).length>0,y=E=>E==="import"?"import":E==="quote"||E==="standalone"?"quote":b?"add":"quote",[v,g]=c.useState(y(a)),[w,k]=c.useState(null),S=_e(),N=(S?[["add",n("capture.tab.add.short.label")],["quote",n("capture.tab.quote.short.label")],["import",n("capture.tab.import.short.label")]]:[["add",n("capture.tab.add.label")],["quote",n("capture.tab.quote.label")],["import",n("capture.tab.import.label")]]).filter(([E])=>E!=="add"||b);if(c.useEffect(()=>{t&&(g(y(a)),k(null))},[t,a]),c.useEffect(()=>{v!=="quote"&&k(null)},[v]),c.useEffect(()=>{if(!t)return;const E=O=>{O.key==="Escape"&&s()};return document.addEventListener("keydown",E),()=>document.removeEventListener("keydown",E)},[t,s]),!t)return null;const j=n(v==="quote"?"capture.title.quote":v==="import"?"capture.title.import":"capture.title.add"),x=w&&e.jsx(Pe,{icon:e.jsx(ft,{}),ariaLabel:n("common.action.save.label"),tooltip:w.busy?n("common.action.save.busy"):w.canSave?n("common.action.save.label"):w.why||n("capture.save.blocked.tip"),ok:!0,disabled:!w.canSave||w.busy,onClick:()=>w.save()}),M=e.jsx(Pe,{icon:e.jsx(it,{}),ariaLabel:n("common.action.close.label"),tooltip:n("capture.close.tip"),onClick:s}),q=e.jsxs(e.Fragment,{children:[e.jsx("div",{className:"mb-5",children:e.jsx(Ye,{ariaLabel:n("capture.tabs.aria"),value:v,onChange:g,options:N})}),v==="add"&&e.jsx(Pd,{initialKind:a==="film"?"film":"book",onAdded:E=>r==null?void 0:r(E),sections:u}),v==="quote"&&e.jsx(Pb,{initialTarget:o,initialStandalone:a==="standalone",onCaptured:l,onWorkCreated:h,onSaveState:k}),v==="import"&&e.jsxs(e.Fragment,{children:[d>0&&m&&e.jsx("button",{type:"button",className:"tp-btn tp-btn-primary w-full",style:{marginBottom:12},onClick:m,children:n("capture.import.pending",{count:d,n:d})}),e.jsx(Nb,{embedded:!0,onReviewImport:m,onStaged:p})]})]});return S?Ue.createPortal(e.jsx($n,{open:!0,onClose:s,title:j,dismissOnScrim:!1,actions:e.jsxs("span",{className:"flex shrink-0 items-center",children:[e.jsx(_n,{screen:"capture"}),x]}),children:q}),document.body):e.jsx("div",{className:"tp-scrim fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-4 py-10",role:"dialog","aria-modal":"true","aria-label":n("capture.dialog.aria"),onMouseDown:E=>{E.target===E.currentTarget&&s()},children:e.jsxs(Xe,{variant:2,className:"w-full max-w-2xl px-6 py-6",children:[e.jsxs("div",{className:"mb-4 flex items-center gap-2",children:[e.jsx("h2",{className:"display-title flex-1 text-xl",children:j}),e.jsx(_n,{screen:"capture"}),x,M]}),q]})})}const Fb=["add","subtract","multiply","divide","set","reset"],Fd=t=>n(`staging.formula.op.${t}.label`),Hb=()=>Fb.map(t=>[t,Fd(t)]),zb={book:"common.badge.book",movie:"common.badge.film",show:"common.badge.show",quotes:"staging.badge.quotes"},Hd=t=>n(zb[t]||"common.badge.book"),Ji=t=>t.kind==="book"?n("unit.book",{count:1}):t.kind==="show"?n("unit.show",{count:1}):n("unit.film",{count:1});function $b({onPending:t,onOpenBook:a,onOpenMovie:o,onApproved:s}){const[r,i]=c.useState(null),[l,h]=c.useState("all"),[d,m]=c.useState(()=>new Set),[p,u]=c.useState(null),[f,b]=c.useState(null),[y,v]=c.useState(""),[g,w]=c.useState(!1),[k,S]=c.useState(""),[N,j]=c.useState(""),x=_e(),M=c.useRef(0);async function q(){const A=++M.current,Y=await X("GET","/import/staged");if(A!==M.current)return;if(!Y.ok)return v(le(Y,n("error.load.import-queue")));v(""),i(Y.data),t==null||t(Y.data.pending||0);const G=new Set((Y.data.quotes||[]).map(ae=>ae.id));m(ae=>new Set([...ae].filter(Z=>G.has(Z)))),h(ae=>ae!=="all"&&!(Y.data.batches||[]).some(Z=>String(Z.id)===String(ae))?"all":ae)}c.useEffect(()=>{q()},[]);const E=(r==null?void 0:r.batches)||[],O=(r==null?void 0:r.works)||[],_=(r==null?void 0:r.quotes)||[],T=c.useMemo(()=>l==="all"?_:_.filter(A=>String(A.batch_id)===String(l)),[_,l]),B=c.useMemo(()=>{const A=new Map;for(const Y of T)A.has(Y.staged_work_id)||A.set(Y.staged_work_id,[]),A.get(Y.staged_work_id).push(Y);return O.filter(Y=>(l==="all"||String(Y.batch_id)===String(l))&&(A.has(Y.id)||Y.quotes===0)).map(Y=>({work:Y,items:A.get(Y.id)||[]}))},[T,O,l]),L=T.map(A=>A.id),V=L.filter(A=>d.has(A)),P=V.length,C=L.length>0&&V.length===L.length,H=A=>m(Y=>{const G=new Set(Y);return G.has(A)?G.delete(A):G.add(A),G}),R=A=>m(Y=>{const G=new Set(Y),ae=A.every(Z=>G.has(Z.id));for(const Z of A)(ae?G.delete:G.add).call(G,Z.id);return G}),I=()=>m(new Set);async function U(A,Y){if(g)return;w(!0),v("");const G=await X("POST","/import/staged/bulk",{ids:V,...A});if(w(!1),!G.ok)return v(le(G,n("error.apply.edit")));S(Y||n("staging.flash.updated",{n:G.data.updated})),await q()}async function te(A){if(g)return;w(!0),v("");const Y=await X("POST","/import/staged/approve",A?{ids:A}:{all:!0});if(w(!1),!Y.ok)return v(le(Y,n("error.approve.generic")));const{added:G=0,skipped:ae=0,enriched:Z=0}=Y.data;S([n("staging.flash.approved.added",{n:G}),n("staging.flash.approved.skipped",{n:ae}),Z>0&&n("staging.flash.approved.enriched",{n:Z})].filter(Boolean).join(" · ")),I(),await q(),s==null||s(Y.data)}async function D(A){if(g)return;w(!0),v("");const Y=await X("DELETE","/import/staged",A?{ids:A}:{all:!0});if(w(!1),!Y.ok)return v(le(Y,n("error.discard.generic")));S(n("staging.flash.discarded",{n:Y.data.discarded})),I(),await q()}if(!r)return e.jsxs("section",{className:"space-y-5",children:[e.jsx(Gt,{title:n("staging.title"),counts:n("staging.state.loading")}),e.jsx(ve,{children:y})]});if(r.pending===0&&O.length===0)return e.jsxs("section",{className:"space-y-5",children:[e.jsx(Gt,{title:n("staging.title"),counts:n("staging.state.empty-counts")}),e.jsx(Vt,{children:n("staging.state.empty")})]});const z=[["all",n("staging.filter.all-files.label",{n:r.pending})],...E.map(A=>[String(A.id),n("staging.filter.batch.label",{name:A.filename||A.source,n:A.quotes})])],K=e.jsxs(e.Fragment,{children:[e.jsx($,{style:{color:"var(--faint)"},children:k}),e.jsx(ge,{disabled:g,onClick:()=>b({title:n("staging.discard-all.confirm.title"),body:n("staging.discard-all.confirm.body",{n:r.pending}),label:n("staging.discard-all.label"),run:()=>D(null)}),children:n("staging.discard-all.label")}),e.jsx("button",{className:"tp-btn tp-btn-primary",disabled:g,onClick:()=>te(null),children:r.pending>0?n("staging.approve-all.count.label",{n:r.pending}):n("staging.approve-all.label")})]});return e.jsxs("section",{className:"space-y-5",children:[e.jsx("div",{className:x?"mobile-sticky-bar":"",children:e.jsx(Gt,{title:n("staging.title"),counts:r.pending>0?n("staging.counts.quotes",{count:r.pending,n:r.pending}):n("staging.counts.works",{count:O.length,n:O.length}),right:x?null:K})}),x&&e.jsx("div",{className:"flex flex-wrap items-center gap-2",children:K}),e.jsxs("div",{className:"filter-row",children:[e.jsxs("label",{className:"flex items-center gap-2",children:[e.jsx($,{children:n("staging.filter.file.label")}),e.jsx(Oe,{ariaLabel:n("staging.filter.batch.aria"),value:l,onChange:h,options:z,width:x?void 0:260})]}),e.jsxs("label",{className:"flex items-center gap-2",style:{marginLeft:"auto"},children:[e.jsx("input",{type:"checkbox",checked:C,onChange:()=>m(C?new Set:new Set(L))}),e.jsx("span",{className:"microcopy",children:n("staging.select-all.label",{n:L.length})})]})]}),e.jsxs(ru,{n:P,onClear:I,children:[e.jsx(nt,{value:"",ariaLabel:n("staging.bulk.colour.aria"),onChange:A=>U({color:A},n("staging.flash.colour",{name:Mn(A)}))}),e.jsx(ge,{disabled:g,onClick:()=>U({favorite:!0},n("staging.flash.favourited")),children:n("staging.bulk.favourite.label")}),e.jsx(ye,{label:n("staging.bulk.unfavourite.tip"),children:e.jsx(ge,{disabled:g,onClick:()=>U({favorite:!1},n("staging.flash.unfavourited")),children:n("staging.bulk.unfavourite.label")})}),e.jsx(ge,{icon:e.jsx(at,{}),onClick:()=>j(N==="fields"?"":"fields"),children:n("staging.bulk.fields.label")}),e.jsx(ge,{icon:e.jsx(po,{}),onClick:()=>j(N==="move"?"":"move"),children:n("staging.bulk.move.label")}),e.jsx(ge,{icon:e.jsx(Qu,{}),onClick:()=>j(N==="formula"?"":"formula"),children:n("staging.bulk.locations.label")}),e.jsx("button",{className:"tp-btn tp-btn-primary",disabled:g,onClick:()=>te(V),children:n("staging.bulk.approve.label",{n:P})}),e.jsx(ge,{disabled:g,onClick:()=>b({title:n("staging.discard.confirm.title",{count:P,n:P}),body:n("staging.discard.confirm.body"),label:n("staging.discard.label"),run:()=>D(V)}),children:n("staging.discard.label")})]}),P>0&&N==="fields"&&e.jsx(Gb,{n:P,busy:g,onApply:U}),P>0&&N==="move"&&e.jsx(Kb,{n:P,busy:g,works:O,onApply:U}),P>0&&N==="formula"&&e.jsx(Vb,{n:P,busy:g,onApply:U}),e.jsx(ve,{children:y}),e.jsxs("div",{className:"space-y-8",children:[B.map(({work:A,items:Y})=>e.jsx(Wb,{work:A,items:Y,sel:d,onToggle:H,onToggleGroup:()=>R(Y),onEdit:u,onOpenBook:a,onOpenMovie:o},A.id)),B.length===0&&e.jsx(Vt,{children:n("staging.state.empty-file")})]}),e.jsx(Ge,{open:!!p,onClose:()=>u(null),title:n("staging.form.title"),children:p&&e.jsx(Yb,{quote:p,onCancel:()=>u(null),onSaved:async A=>{const Y=await X("POST","/import/staged/bulk",{ids:[p.id],...A});return Y.ok?(u(null),S(n("staging.flash.saved")),await q(),null):le(Y,n("error.save.generic"))}})}),f&&e.jsx(vt,{open:!0,title:f.title,body:f.body,confirmLabel:f.label,onCancel:()=>b(null),onConfirm:()=>{const A=f.run;b(null),A()}})]})}function Wb({work:t,items:a,sel:o,onToggle:s,onToggleGroup:r,onEdit:i,onOpenBook:l,onOpenMovie:h}){const d=a.length>0&&a.every(y=>o.has(y.id)),m=t.kind==="book",p=t.kind==="quotes",u=()=>{t.target_id&&(m?l==null||l(t.target_id):h==null||h(t.target_id))},f=t.target_title||t.title,b=t.target_year?n("staging.group.target.year.label",{title:f,year:t.target_year}):f;return e.jsxs("section",{children:[e.jsxs("div",{className:"mb-3 flex flex-wrap items-center gap-3",children:[e.jsx(ye,{label:n("staging.group.select.tip"),side:"bottom",children:e.jsx("input",{type:"checkbox",checked:d,onChange:r,"aria-label":n("staging.group.select.aria",{title:t.title})})}),e.jsx("h3",{className:"display-title truncate",style:{fontSize:"var(--type-ui-19)"},children:t.title}),e.jsx($,{style:{color:m||p?"var(--accent-ui)":"var(--amber)"},children:Hd(t.kind)}),e.jsx($,{style:{color:"var(--accent-ui)"},children:n("common.count.phrase",{n:a.length,noun:n("unit.quote",{count:a.length})})}),e.jsx("span",{className:"h-px flex-1",style:{background:"var(--line)"}})]}),e.jsxs("p",{className:"microcopy mb-3",children:[p?n("staging.group.standalone.prose"):t.target_id?e.jsxs(e.Fragment,{children:[Ie("staging.group.joins.prose",{target:e.jsx("button",{type:"button",className:"tp-link",onClick:u,children:b},"target")}),t.pinned&&e.jsxs("span",{style:{color:"var(--accent-ui)"},children:[" · ",n("staging.group.pinned.label")]})]}):n("staging.group.new.prose",{kind:Ji(t)}),t.ambiguous&&e.jsxs("span",{style:{color:"var(--amber)"},children:[" ",n("staging.group.ambiguous.warning",{n:t.alternatives+1})]})]}),a.length===0?e.jsx("p",{className:"microcopy",style:{color:"var(--faint)"},children:p?n("staging.group.empty.standalone"):n("staging.group.empty.work",{kind:Ji(t)})}):e.jsx("ul",{className:"space-y-2",children:a.map(y=>e.jsx("li",{children:e.jsx(Ub,{quote:y,selected:o.has(y.id),onToggle:()=>s(y.id),onEdit:()=>i(y)})},y.id))})]})}function Ub({quote:t,selected:a,onToggle:o,onEdit:s}){var l;const r=[dn(t),t.location,t.character,t.actor,gn(t),t.timestamp,t.speaker,t.occasion,t.occasion_date,t.place,Aa(t),t.noted_at?t.noted_at.slice(0,10):""].filter(Boolean),i=t.location&&t.location_orig&&t.location!==t.location_orig||t.timestamp&&t.timestamp_orig&&t.timestamp!==t.timestamp_orig;return e.jsxs("div",{className:"flex items-start gap-3 p-3",style:{background:a?"color-mix(in srgb, var(--accent) 7%, var(--raised))":"var(--raised)",border:`1px solid ${a?"color-mix(in srgb, var(--accent) 35%, var(--line))":"var(--line)"}`,borderRadius:8,borderLeft:`4px solid ${bn(t.color)||"var(--line)"}`},children:[e.jsx(ye,{label:n("staging.row.select.tip"),children:e.jsx("input",{type:"checkbox",checked:a,onChange:o,"aria-label":n("staging.row.select.aria"),style:{marginTop:3}})}),e.jsxs("div",{className:"min-w-0 flex-1",children:[e.jsx("p",{className:"whitespace-pre-wrap",style:{fontFamily:"var(--font-display)",fontWeight:"var(--font-display-weight)",fontVariantCaps:"var(--font-display-caps)",textTransform:"var(--font-display-case)",fontVariantNumeric:"var(--font-display-figures)",fontStyle:"italic",fontSize:"var(--type-display-15)",lineHeight:1.5},children:t.quote||t.note}),t.translation&&e.jsx("p",{className:"microcopy mt-1",children:n("staging.row.translation.label",{text:t.translation})}),t.quote&&t.note&&e.jsx("p",{className:"microcopy mt-1",children:n("staging.row.note.label",{note:t.note})}),(r.length>0||((l=t.tags)==null?void 0:l.length)>0||t.favorite)&&e.jsxs("div",{className:"mt-1.5 flex flex-wrap items-center gap-2",children:[r.map((h,d)=>e.jsx($,{style:{color:"var(--faint)"},children:h},d)),i&&e.jsx($,{style:{color:"var(--accent-ui)"},title:n("staging.row.shifted.tip"),children:n("staging.row.shifted.label")}),t.favorite&&e.jsx("span",{style:{color:"var(--accent)"},children:"♥"}),(t.tags||[]).map(h=>e.jsx(Sa,{children:h},h))]})]}),e.jsx(Ce,{icon:e.jsx(at,{}),ariaLabel:n("common.action.edit.label"),onClick:s,tooltip:n("common.action.edit.row.tip",{noun:n("unit.quote",{count:1})}),className:"shrink-0"})]})}function Gb({n:t,busy:a,onApply:o}){const[s,r]=c.useState({}),[i,l]=c.useState({}),[h,d]=c.useState([]),[m,p]=c.useState([]),u=[["chapter_no","common.field.chapter-no.label"],["chapter","common.field.chapter-name.label"],["location","common.field.location.label"],["character","common.field.character.label"],["actor","common.field.actor.label"],["season","common.field.season.label"],["episode","common.field.episode.label"],["timestamp","common.field.timestamp.label"]];function f(){const b={};for(const[y]of u)s[y]&&(b[y]=(i[y]||"").trim());h.length&&(b.add_tags=h),m.length&&(b.remove_tags=m),Object.keys(b).length!==0&&o(b,n("staging.flash.edited",{n:t}))}return e.jsxs(Mr,{title:n("staging.fields.panel.title",{n:t}),children:[u.map(([b,y])=>e.jsxs("label",{className:"flex flex-wrap items-center gap-2",children:[e.jsx("input",{type:"checkbox",checked:!!s[b],onChange:v=>r({...s,[b]:v.target.checked})}),e.jsx("span",{className:"microcopy",style:{minWidth:76},children:n(y)}),e.jsx("input",{className:"tp-input w-auto flex-1",placeholder:n("staging.fields.set.placeholder",{field:n(y).toLowerCase()}),disabled:!s[b],value:i[b]||"",onChange:v=>l({...i,[b]:v.target.value})})]},b)),e.jsxs("div",{className:"grid gap-2 sm:grid-cols-2",children:[e.jsxs("label",{className:"tp-field",children:[e.jsx($,{children:n("common.action.add-tags.label")}),e.jsx(pt,{value:h,onChange:d,placeholder:n("common.field.tags.placeholder"),ariaLabel:n("staging.fields.add-tags.aria")})]}),e.jsxs("label",{className:"tp-field",children:[e.jsxs($,{children:[n("staging.fields.remove-tags.label")," ",e.jsx(Le,{text:n("staging.fields.remove-tags.info")})]}),e.jsx(pt,{value:m,onChange:p,placeholder:n("staging.fields.remove-tags.placeholder"),ariaLabel:n("staging.fields.remove-tags.aria")})]})]}),e.jsx("button",{className:"tp-btn tp-btn-primary",disabled:a,onClick:f,children:n("staging.fields.apply.label",{n:t})})]})}function Kb({n:t,busy:a,works:o,onApply:s}){const[r,i]=c.useState([]),[l,h]=c.useState(null),[d,m]=c.useState("");c.useEffect(()=>{Promise.all([X("GET","/books"),X("GET","/movies")]).then(([u,f])=>{const b=[];u.ok&&b.push(...(u.data.books||[]).map(Id)),f.ok&&b.push(...(f.data.movies||[]).map(qr)),i(b)})},[]);const p=[["",n("staging.move.group.placeholder")],...o.filter(u=>u.kind!=="quotes").map(u=>[String(u.id),n("staging.move.group.option",{title:u.title,badge:Hd(u.kind),n:u.quotes})])];return e.jsxs(Mr,{title:n("staging.move.panel.title",{n:t}),children:[e.jsxs("div",{children:[e.jsxs($,{className:"block",children:[n("staging.move.library.label")," ",e.jsx(Le,{text:n("staging.move.library.info")})]}),e.jsx(Bd,{works:r,value:l,onChange:h}),e.jsx("button",{className:"tp-btn tp-btn-primary mt-2",disabled:a||!l,onClick:()=>s({retarget:{kind:l.kind==="book"?"book":"movie",id:l.id}},n("staging.flash.moved",{n:t,title:l.title})),children:l?n("staging.move.button.label",{title:l.title}):n("staging.move.button.none.label")})]}),e.jsxs("div",{className:"flex flex-wrap items-end gap-2",children:[e.jsxs("label",{className:"tp-field",style:{flex:1,minWidth:220},children:[e.jsx($,{children:n("staging.move.merge.label")}),e.jsx(Oe,{ariaLabel:n("staging.move.group.aria"),value:d,onChange:m,options:p})]}),e.jsx("button",{className:"tp-btn tp-btn-primary",disabled:a||!d,onClick:()=>s({retarget:{staged_work_id:Number(d)}},n("staging.flash.merged",{n:t})),children:n("staging.move.merge.button.label")})]})]})}function Vb({n:t,busy:a,onApply:o}){const[s,r]=c.useState("location"),[i,l]=c.useState("subtract"),[h,d]=c.useState(""),[m,p]=c.useState(""),u=["add","subtract","multiply","divide"].includes(i);function f(){const b={field:s,op:i};if(u){const y=Number(h);if(!Number.isFinite(y)||i==="divide"&&y===0)return;b.value=y}i==="set"&&(b.text=m.trim()),o({formula:b},n("staging.flash.formula",{op:Fd(i),n:t}))}return e.jsxs(Mr,{title:n("staging.formula.panel.title",{n:t}),children:[e.jsxs("div",{className:"flex flex-wrap items-end gap-2",children:[e.jsxs("label",{className:"tp-field",children:[e.jsx($,{children:n("staging.formula.field.label")}),e.jsx(Oe,{ariaLabel:n("staging.formula.field.aria"),value:s,onChange:r,options:[["location",n("common.field.location.label")],["timestamp",n("common.field.timestamp.label")]]})]}),e.jsxs("label",{className:"tp-field",children:[e.jsx($,{children:n("staging.formula.op.label")}),e.jsx(Oe,{ariaLabel:n("staging.formula.op.label"),value:i,onChange:l,options:Hb()})]}),u&&e.jsx("div",{style:{maxWidth:110},children:e.jsx(xe,{label:n("staging.formula.by.label"),type:"number",step:"any",placeholder:n("staging.formula.by.placeholder"),value:h,onChange:b=>d(b.target.value)})}),i==="set"&&e.jsx("div",{style:{maxWidth:160},children:e.jsx(xe,{label:n("staging.formula.to.label"),placeholder:n("staging.formula.to.placeholder"),value:m,onChange:b=>p(b.target.value)})}),e.jsx("button",{className:"tp-btn tp-btn-primary",disabled:a,onClick:f,children:n("common.action.apply.label")})]}),e.jsx("p",{className:"microcopy",children:Ie("staging.formula.prose",{from:e.jsx("b",{children:n("staging.formula.example.page-from")},"from"),to:e.jsx("b",{children:n("staging.formula.example.page-to")},"to"),range:e.jsx("b",{children:n("staging.formula.example.range")},"range"),clock:e.jsx("b",{children:n("staging.formula.example.clock")},"clock"),reset:e.jsx("b",{children:n("staging.formula.example.reset")},"reset")})})]})}function Mr({title:t,children:a}){return e.jsxs("div",{className:"space-y-2.5 rounded-xl p-3",style:{border:"1px solid var(--line)",background:"var(--raised)"},children:[e.jsx($,{className:"block",children:t}),a]})}function Yb({quote:t,onSaved:a,onCancel:o}){const[s,r]=c.useState({chapter:t.chapter||"",chapter_no:t.chapter_no?String(t.chapter_no):"",location:t.location||"",character:t.character||"",actor:t.actor||"",season:t.season??"",episode:t.episode??"",timestamp:t.timestamp||"",color:t.color||"yellow",favorite:!!t.favorite}),[i,l]=c.useState(t.tags||[]),[h,d]=c.useState(""),[m,p]=c.useState(!1),u=b=>y=>r({...s,[b]:y.target.value});async function f(){p(!0),d("");const b=(t.tags||[]).filter(g=>!i.some(w=>w.toLowerCase()===g.toLowerCase())),y={add_tags:i,remove_tags:b};for(const[g,w]of[["chapter",t.chapter||""],["chapter_no",t.chapter_no?String(t.chapter_no):""],["location",t.location||""],["character",t.character||""],["actor",t.actor||""],["season",String(t.season??"")],["episode",String(t.episode??"")],["timestamp",t.timestamp||""]])s[g]!==w&&(y[g]=s[g]);s.color!==(t.color||"yellow")&&(y.color=s.color),s.favorite!==!!t.favorite&&(y.favorite=s.favorite);const v=await a(y);p(!1),v&&d(v)}return e.jsxs("div",{className:"space-y-4",children:[e.jsx("p",{className:"whitespace-pre-wrap",style:{fontFamily:"var(--font-display)",fontWeight:"var(--font-display-weight)",fontVariantCaps:"var(--font-display-caps)",textTransform:"var(--font-display-case)",fontVariantNumeric:"var(--font-display-figures)",fontStyle:"italic",fontSize:"var(--type-display-17)"},children:n("staging.form.quoted",{text:t.quote||t.note})}),e.jsx("p",{className:"microcopy",children:n("staging.form.locators.prose")}),e.jsxs("div",{className:"grid gap-3 sm:grid-cols-2",children:[e.jsx(xe,{label:n("common.field.chapter-no.label"),inputMode:"decimal",placeholder:n("staging.form.chapter-no.placeholder"),value:s.chapter_no,onChange:u("chapter_no")}),e.jsx(xe,{label:n("common.field.chapter-name.label"),placeholder:n("staging.form.chapter.placeholder"),value:s.chapter,onChange:u("chapter")}),e.jsx(xe,{label:n("common.field.location.label"),placeholder:n("staging.form.location.placeholder"),value:s.location,onChange:u("location")}),e.jsx(xe,{label:n("common.field.character.label"),nameCase:!0,placeholder:n("staging.form.character.placeholder"),value:s.character,onChange:u("character")}),e.jsx(xe,{label:n("common.field.actor.label"),nameCase:!0,placeholder:n("staging.form.actor.placeholder"),value:s.actor,onChange:u("actor")}),e.jsx(xe,{label:n("common.field.season.label"),placeholder:n("staging.form.season.placeholder"),value:s.season,onChange:u("season")}),e.jsx(xe,{label:n("common.field.episode.label"),placeholder:n("staging.form.episode.placeholder"),value:s.episode,onChange:u("episode")}),e.jsx(xe,{label:n("common.field.timestamp.label"),placeholder:n("staging.form.timestamp.placeholder"),value:s.timestamp,onChange:u("timestamp")})]}),e.jsxs("div",{className:"flex flex-wrap items-center gap-4",children:[e.jsxs("label",{className:"tp-field",children:[e.jsx($,{children:n("common.field.colour.label")}),e.jsx(nt,{value:s.color,onChange:b=>r({...s,color:b})})]}),e.jsxs("label",{className:"tp-field",children:[e.jsx($,{children:n("common.field.favourite.label")}),e.jsx(On,{value:s.favorite,onChange:b=>r({...s,favorite:b})})]})]}),e.jsxs("label",{className:"tp-field",children:[e.jsx($,{children:n("common.field.tags.label")}),e.jsx(pt,{value:i,onChange:l,placeholder:n("common.field.tags.placeholder"),ariaLabel:n("common.field.tags.label"),transform:b=>hs(b)[0]||b})]}),e.jsx(ve,{children:h}),e.jsxs("div",{className:"flex flex-wrap items-center gap-2",children:[e.jsx("button",{className:"tp-btn tp-btn-primary",disabled:m,onClick:f,children:n("common.action.save.label")}),e.jsx(ge,{onClick:o,disabled:m,children:n("common.action.cancel.label")})]})]})}function zd({pending:t,onOpen:a}){return t?e.jsxs(Xe,{variant:1,colorBar:"var(--accent-ui)",className:"flex flex-wrap items-center gap-3 p-4",children:[e.jsx($,{style:{color:"var(--accent-ui)"},children:n("staging.card.label")}),e.jsx("p",{className:"text-sm",style:{color:"var(--soft)"},children:n("staging.card.body",{count:t,n:t})}),e.jsx("button",{className:"tp-btn tp-btn-primary ml-auto",onClick:a,children:n("staging.card.review.label",{n:t})})]}):null}const Qb=Object.freeze(Object.defineProperty({__proto__:null,PendingImportCard:zd,default:$b},Symbol.toStringTag,{value:"Module"}));function Xb({states:t,help:a,onToggleHelp:o,adaptive:s}){if(!t||t.total===0)return null;const r=[["remembered",t.remembered],["forgetting",t.forgetting],["probably-forgotten",t.probably_forgotten],["unseen",t.unseen]];return e.jsxs("div",{style:{borderTop:"1px solid var(--line)",paddingTop:10},className:"mt-3",children:[e.jsxs("div",{className:"flex flex-wrap items-center gap-x-3 gap-y-1.5",children:[e.jsx("span",{className:"mono-label",style:{color:"var(--faint)"},children:n("home.states.title")}),r.map(([i,l])=>e.jsxs("span",{className:"mono-label inline-flex items-center gap-1.5",style:{fontSize:"var(--type-ui-11)",opacity:l?1:.45},children:[e.jsx("span",{"aria-hidden":"true",style:{width:8,height:8,borderRadius:999,border:`1.5px solid ${Ut[i].color}`,background:Ut[i].filled?Ut[i].color:"transparent"}}),e.jsx("span",{style:{fontWeight:600},children:l})," ",n(Ut[i].label).toLowerCase()]},i)),e.jsx("button",{type:"button",className:"tp-link",style:{fontSize:"var(--type-ui-11)",marginLeft:"auto"},onClick:o,children:n("home.states.help.label")})]}),a&&e.jsx("p",{className:"microcopy mt-2",style:{lineHeight:1.6},children:Ie(s?"home.states.help.adaptive.prose":"home.states.help.ladder.prose",{curve:e.jsx("a",{href:"https://en.wikipedia.org/wiki/Forgetting_curve",target:"_blank",rel:"noopener noreferrer",className:"tp-link",children:n("home.states.help.curve.label")},"curve"),spaced:e.jsx("a",{href:"https://en.wikipedia.org/wiki/Spaced_repetition",target:"_blank",rel:"noopener noreferrer",className:"tp-link",children:n("home.states.help.spaced.label")},"spaced"),remembered:e.jsx("strong",{children:n("home.states.help.remembered.label")},"remembered"),forgetting:e.jsx("strong",{children:n("home.states.help.forgetting.label")},"forgetting"),forgotten:e.jsx("strong",{children:n("home.states.help.forgotten.label")},"forgotten")})})]})}function Jb({onPending:t,states:a,onStates:o,adaptive:s,submitStep:r}){const[i,l]=c.useState(null),[h,d]=c.useState("loading"),[m,p]=c.useState({got:0,forgot:0}),[u,f]=c.useState(!1);c.useEffect(()=>{bc(Ro()).then(v=>{if(!v.ok)return d("error");l(v.data),p({got:v.data.got_today||0,forgot:v.data.forgot_today||0}),o==null||o(v.data.states);const g=(v.data.items||[]).length;t(g),d(g?"active":"done")})},[]);function b(v,g){p(w=>({got:w.got+(v==="got"?1:0),forgot:w.forgot+(v==="forgot"?1:0)})),g&&typeof g.remaining=="number"&&t(g.remaining),g!=null&&g.states&&(o==null||o(g.states))}const y=(i==null?void 0:i.streak)||0;return e.jsxs(Xe,{variant:0,style:{padding:"16px 18px 14px"},children:[e.jsxs("div",{className:"mb-2.5 flex items-baseline justify-between gap-3",children:[e.jsx($,{style:{color:"var(--accent-ui)"},children:n("home.daily.title")}),y>0&&e.jsx("span",{className:"mono-label",style:{letterSpacing:".06em"},children:n("home.daily.streak.label",{n:y,count:y})})]}),h==="error"?e.jsx("p",{className:"microcopy py-6 text-center",style:{color:"var(--error)"},children:n("home.daily.error")}):h==="loading"?e.jsx("p",{className:"microcopy py-6 text-center",children:n("home.daily.loading")}):h==="active"?e.jsx(sr,{mode:"daily",cards:i.items,allowSkip:!1,submitStep:r,onAnswered:b,onDone:()=>d("done")}):e.jsxs("div",{className:"review-card-body py-4 text-center",style:{padding:"18px 6px 12px"},children:[e.jsx("p",{"aria-hidden":"true",style:{fontFamily:"var(--font-hand)",fontWeight:"var(--font-hand-weight)",fontStyle:"var(--font-hand-style)",fontVariantCaps:"var(--font-hand-caps)",textTransform:"var(--font-hand-case)",fontVariantNumeric:"var(--font-hand-figures)",fontSize:"var(--type-hand-26)",color:"var(--accent-ui)",transform:"rotate(-1.2deg)"},children:n(m.got||m.forgot?"home.daily.done.label":"home.daily.empty.label")}),e.jsx("p",{className:"mono-label mt-1",style:{letterSpacing:".06em"},children:m.got||m.forgot?n("home.daily.done.summary",{got:m.got,missed:m.forgot}):n("home.daily.empty.summary")})]}),a&&e.jsx(Xb,{states:a,help:u,onToggleHelp:()=>f(v=>!v),adaptive:s})]})}function Zb({onStates:t,userId:a,submitStep:o}){var S;const[s,r]=He(`tippani:practice:session:${a??"me"}`,null),[i,l]=c.useState((S=s==null?void 0:s.cards)!=null&&S.length?"active":"idle"),[h,d]=c.useState(null),[m,p]=c.useState({got:0,forgot:0}),[u,f]=c.useState(!1),b=(s==null?void 0:s.cards)||[];function y(){X("GET",`/review/scores?offset=${Ro()}`).then(N=>{N.ok&&d(N.data.practice)})}c.useEffect(()=>{y()},[]);async function v(){f(!0);const N=await X("GET","/review/practice");f(!1);const j=N.ok?N.data.items||[]:[];if(!j.length)return Se(n("error.load.practice"));r({cards:j,i:0,got:0,forgot:0}),l("active")}function g(){p({got:(s==null?void 0:s.got)||0,forgot:(s==null?void 0:s.forgot)||0}),y(),r(null),l("done")}function w(N,j){r(x=>x&&{...x,got:x.got+(N==="got"?1:0),forgot:x.forgot+(N==="forgot"?1:0)}),j!=null&&j.states&&(t==null||t(j.states))}async function k(){await X("DELETE","/review/practice"),y(),Se(n("home.practice.toast.reset"))}return e.jsxs(Xe,{variant:3,style:{padding:"16px 18px 14px"},children:[e.jsxs("div",{className:"mb-2.5 flex items-center justify-between gap-3",children:[e.jsxs("span",{className:"flex items-center gap-1.5",children:[e.jsx($,{style:{color:"var(--accent-ui)"},children:n("home.practice.title")}),e.jsx(Le,{title:n("home.practice.info.title"),text:n("home.practice.info.body")})]}),i==="active"&&e.jsx("span",{className:"mono-label",style:{letterSpacing:".06em"},children:n("home.practice.unlimited.label")})]}),i==="idle"&&e.jsx("div",{className:"review-card-body",children:e.jsxs("div",{className:"flex flex-wrap items-center gap-3",children:[e.jsx("button",{type:"button",className:"tp-btn tp-btn-primary tactile",disabled:u,onClick:v,children:n(u?"home.practice.start.busy":"home.practice.start.label")}),h&&h.answered>0&&e.jsxs(e.Fragment,{children:[e.jsx($,{style:{fontSize:"var(--type-ui-11)"},children:n("home.practice.score.label",{n:h.answered,count:h.answered,percent:Math.round(h.accuracy*100)})}),e.jsx(Ce,{icon:e.jsx(Fe,{}),ariaLabel:n("home.practice.reset.aria"),onClick:k,tooltip:n("home.practice.reset.tip")})]})]})}),i==="active"&&b.length>0&&e.jsxs(e.Fragment,{children:[e.jsx(sr,{mode:"practice",cards:b,allowSkip:!0,submitStep:o,startIndex:Math.min((s==null?void 0:s.i)||0,b.length-1),onIndex:N=>r(j=>j&&{...j,i:N}),onAnswered:w,onDone:g}),e.jsx("div",{className:"mt-2 text-right",children:e.jsx("button",{type:"button",className:"tp-link",onClick:g,children:n("home.practice.end.label")})})]}),i==="done"&&e.jsxs("div",{className:"review-card-body py-2 text-center",children:[e.jsx("p",{"aria-hidden":"true",style:{fontFamily:"var(--font-hand)",fontWeight:"var(--font-hand-weight)",fontStyle:"var(--font-hand-style)",fontVariantCaps:"var(--font-hand-caps)",textTransform:"var(--font-hand-case)",fontVariantNumeric:"var(--font-hand-figures)",fontSize:"var(--type-hand-26)",color:"var(--accent-ui)",transform:"rotate(-1.2deg)"},children:n("quiz.round.score.label",{done:m.got,total:m.got+m.forgot})}),e.jsx("p",{className:"mono-label mt-1 mb-3",style:{letterSpacing:".06em"},children:n("home.practice.round.summary",{got:m.got,missed:m.forgot})}),e.jsx("button",{type:"button",className:"tp-btn tp-btn-primary tactile",disabled:u,onClick:v,children:n("quiz.round.again.label")})]})]})}const ey=4;function Zi(t){const a=[t.book_title,t.character,Os(t),t.location&&n("common.locator.page.label",{n:t.location})].filter(Boolean).join(" · ");return{key:`book:${t.id}`,kind:"book",color:t.color,text:t.quote||t.note,note:t.quote?t.note:"",tags:t.tags||[],source:[t.book_title,t.book_author].filter(Boolean).join(" · "),meta:a,createdAt:t.created_at,openLabel:n("home.favourites.open.book.aria"),workId:t.book_id,raw:t}}function el(t,a){const o=a[t.movie_id]||{},s=(o.media_type||"movie")==="show";return{key:`screen:${t.id}`,kind:"screen",media:n(s?"common.badge.show":"common.badge.film"),color:t.color,text:t.quote||t.note,note:t.quote?t.note:"",tags:t.tags||[],source:[o.title,t.character].filter(Boolean).join(" · "),meta:[o.title,gn(t),t.character,t.timestamp].filter(Boolean).join(" · "),createdAt:t.created_at,openLabel:n(s?"home.favourites.open.show.aria":"home.favourites.open.film.aria"),workId:t.movie_id,raw:t,movie:o}}function tl(t){const a=[t.occasion,sn(t.occasion_date),t.place,Aa(t)].filter(Boolean);return{key:`quote:${t.id}`,kind:"quote",color:t.color,text:t.quote||t.note,note:t.quote?t.note:"",tags:t.tags||[],source:[t.speaker,t.occasion].filter(Boolean).join(" · "),meta:a.join(" · "),createdAt:t.created_at,openLabel:n("home.favourites.open.quotes.aria"),raw:t}}const $t={book:{actionKind:"annotation",label:()=>n("common.badge.book"),labelColor:"var(--accent-ui)",path:"/annotations",state:Sr,form:zo,get editTitle(){return n("home.favourites.edit.annotation.title")},get confirm(){return n("home.favourites.delete.annotation.confirm")},personKind:"author",credit:t=>t.raw.book_author,shareKind:"book",quoted:!0,openIcon:"library"},screen:{actionKind:"dialogue",label:t=>t.media,labelColor:"var(--amber)",path:"/dialogues",state:Er,form:$o,get editTitle(){return n("home.favourites.edit.dialogue.title")},get confirm(){return n("home.favourites.delete.dialogue.confirm")},personKind:"actor",credit:t=>t.raw.actor,shareKind:"screen",quoted:!1,openIcon:"movies"},quote:{actionKind:"quote",label:()=>n("common.badge.quote"),labelColor:"var(--accent-ui)",path:"/quotes",state:Cr,form:Ar,get editTitle(){return n("home.favourites.edit.quote.title")},get confirm(){return n("home.favourites.delete.quote.confirm")},personKind:"speaker",credit:t=>t.raw.speaker,openIcon:"quotes",shareKind:"utterance",quoted:!0}};function ty({user:t,stats:a,onOpenBook:o,onOpenMovie:s,onGoLibrary:r,onGoMovies:i,onGoQuotes:l,onPending:h,pendingImport:d,onReviewImport:m}){var ae,Z,pe,ce;const[p,u]=c.useState([]),f=To([[1400,3],[640,2]]),[b,y]=c.useState(ey),[v,g]=c.useState(null),[w,k]=c.useState(null),[S,N]=c.useState(null),[j,x]=c.useState([]),{map:M}=Qe("author"),{map:q}=Qe("actor"),{map:E}=Qe("speaker"),[O,_]=c.useState(null),T=mn((ae=t==null?void 0:t.preferences)==null?void 0:ae.creditSeparators),[B,L]=c.useState(null),{stickers:V,reload:P}=Oa(),C=c.useMemo(()=>Oh(t==null?void 0:t.username),[t==null?void 0:t.username]),H=c.useMemo(()=>Lh(),[]),R=c.useMemo(()=>Math.random()*4294967295>>>0,[]);function I(){Promise.all([X("GET","/annotations?favorite=1&limit=200"),X("GET","/dialogues?favorite=1"),X("GET","/quotes?favorite=1"),X("GET","/movies")]).then(([F,Q,ie,he])=>{const ue={};if(he.ok&&he.data)for(const J of he.data.movies||[])ue[J.id]=J;const re=[];if(F.ok&&F.data)for(const J of F.data.annotations||[])re.push(Zi(J));if(Q.ok&&Q.data)for(const J of Q.data.dialogues||[])re.push(el(J,ue));if(ie.ok&&ie.data)for(const J of ie.data.utterances||[])re.push(tl(J));u(fu(re,R))}).catch(F=>{console.error("favourites load failed",F)})}c.useEffect(()=>{I(),X("GET","/tags").then(F=>{F.ok&&F.data&&x((F.data.tags||[]).map(Q=>Q.name))})},[]);const U=c.useMemo(()=>Bs(p.length,Ta(R)),[p.length,R]),te=F=>$t[F.kind].path;async function D(F,Q){const ie=await X("PUT",`${te(F)}/${F.raw.id}`,Q);return ie.ok?(k(null),I(),null):le(ie,n("error.save.generic"))}async function z(F,Q){const ie=$t[F.kind].state,he=await X("PUT",`${te(F)}/${F.raw.id}`,{...ie(F.raw),...Q});if(!he.ok)return Se(le(he,n("error.save.generic"))),!1;I()}async function K(F){if(!confirm($t[F.kind].confirm))return;const Q=await Wn(`${te(F)}/${F.raw.id}`,{reload:I});if(!Q.ok)return Se(le(Q,n("error.delete.generic")));v===F.key&&g(null),w===F.key&&k(null),I()}const A=async F=>{const Q=await X("GET",`${$t[F.kind].path}?id=${F.id}`);if(!Q.ok||!Q.data)return null;const ie=(Q.data.annotations||Q.data.dialogues||Q.data.utterances||[])[0];return ie?F.kind==="book"?Zi(ie):F.kind==="quote"?tl(ie):el(ie,{[ie.movie_id]:{title:F.title,media_type:F.media_type,release_year:F.year||null}}):null},Y={copy:async F=>{const Q=await A(F);if(!Q)return Se(n("error.generic"));ba(G(Q))},share:async F=>{const Q=await A(F);if(!Q)return Se(n("error.generic"));N(Q)},favourite:async(F,Q)=>{const ie=await A(F);return ie?z(ie,{favorite:Q}):(Se(n("error.generic")),!1)}},G=F=>{var Q,ie;return F.kind==="book"?Fc({quote:F.raw.quote,note:F.raw.note,translation:F.raw.translation,author:F.raw.book_author,title:F.raw.book_title,chapter:dn(F.raw),location:F.raw.location,character:F.raw.character,date:pn(Bn(F.raw)),tags:F.raw.tags,color:F.raw.color,people:M,characterImages:F.raw.character_images}):F.kind==="quote"?zc({quote:F.raw.quote,translation:F.raw.translation,note:F.raw.note,category:F.raw.category,language:F.raw.language,speaker:F.raw.speaker,occasion:F.raw.occasion,when:sn(F.raw.occasion_date),place:F.raw.place,medium:Aa(F.raw),date:pn(F.raw.noted_at||F.raw.created_at),tags:F.raw.tags,color:F.raw.color,people:E,seps:T}):Hc({quote:F.raw.quote,note:F.raw.note,translation:F.raw.translation,title:(Q=F.movie)==null?void 0:Q.title,year:(ie=F.movie)==null?void 0:ie.release_year,character:F.raw.character,actor:F.raw.actor,timestamp:F.raw.timestamp,episode:gn(F.raw),tags:F.raw.tags,color:F.raw.color,people:q,characterImages:F.raw.character_images})};return e.jsxs("div",{className:"home-col flex flex-col gap-4 pt-4","data-screen-label":"home-body",children:[e.jsx("div",{className:"px-0.5",children:e.jsxs("div",{className:"min-w-0",children:[e.jsx($,{children:H}),e.jsx("h1",{className:"mt-0.5",style:{fontFamily:"var(--font-display)",fontStyle:"var(--font-display-style)",fontVariantCaps:"var(--font-display-caps)",textTransform:"var(--font-display-case)",fontVariantNumeric:"var(--font-display-figures)",fontWeight:600,fontSize:"var(--type-display-26)",letterSpacing:"-0.01em",lineHeight:1.15},children:C})]})}),e.jsx(zd,{pending:d,onOpen:m}),e.jsx(Jb,{onPending:h,states:B,onStates:L,adaptive:!!((Z=t==null?void 0:t.preferences)!=null&&Z.srAdaptive),submitStep:!!((pe=t==null?void 0:t.preferences)!=null&&pe.srSubmit)}),e.jsx(Zb,{onStates:L,userId:t==null?void 0:t.id,submitStep:!!((ce=t==null?void 0:t.preferences)!=null&&ce.srSubmit)}),(r||i)&&e.jsxs("div",{className:r&&i?"grid grid-cols-2 gap-2.5":"",children:[r&&e.jsx(ye,{label:n("home.tile.library.tip"),className:"flex items-stretch",children:e.jsxs(Xe,{variant:1,className:"cursor-pointer w-full",style:{padding:"13px 15px"},onClick:r,role:"button",tabIndex:0,children:[e.jsx("p",{style:{fontFamily:"var(--font-display)",fontStyle:"var(--font-display-style)",fontVariantCaps:"var(--font-display-caps)",textTransform:"var(--font-display-case)",fontVariantNumeric:"var(--font-display-figures)",fontWeight:600,fontSize:"var(--type-display-26)"},children:a?a.books:"–"}),e.jsx($,{style:{fontSize:"var(--type-display-11)"},children:n("home.tile.library.counts",{n:a?a.annotations:"–"})})]})}),i&&e.jsx(ye,{label:n("home.tile.movies.tip"),className:"flex items-stretch",children:e.jsxs(Xe,{variant:2,className:"cursor-pointer w-full",style:{padding:"13px 15px"},onClick:i,role:"button",tabIndex:0,children:[e.jsx("p",{style:{fontFamily:"var(--font-display)",fontStyle:"var(--font-display-style)",fontVariantCaps:"var(--font-display-caps)",textTransform:"var(--font-display-case)",fontVariantNumeric:"var(--font-display-figures)",fontWeight:600,fontSize:"var(--type-display-26)"},children:a?a.movies:"–"}),e.jsx($,{style:{fontSize:"var(--type-display-11)",color:"var(--amber)"},children:n("home.tile.movies.counts",{n:a?a.dialogues:"–"})})]})})]}),e.jsx(ay,{onOpenBook:o,onOpenMovie:s,onGoQuotes:l,people:{author:M,actor:q,speaker:E},seps:T,onOpenPerson:_,actions:Y}),p.length>0&&e.jsxs("section",{children:[e.jsxs("div",{className:"mb-2.5 flex items-center gap-3",children:[e.jsx("h2",{style:{fontFamily:"var(--font-display)",fontStyle:"var(--font-display-style)",fontVariantCaps:"var(--font-display-caps)",textTransform:"var(--font-display-case)",fontVariantNumeric:"var(--font-display-figures)",fontWeight:600,fontSize:"var(--type-display-19)"},children:n("home.favourites.title")}),e.jsx("span",{"aria-hidden":"true",className:"h-px flex-1",style:{background:"var(--line)"}}),e.jsx($,{children:n("home.favourites.count.label",{n:p.length})})]}),e.jsx(Ao,{columns:f,gap:10,order:"source",children:p.slice(0,b).map((F,Q)=>e.jsx(ny,{f:F,variant:Q+1,clampLines:U[Q]||3,open:v===F.key,editing:w===F.key,onToggle:()=>{k(null),g(ie=>ie===F.key?null:F.key)},onOpen:F.kind==="book"?()=>o(F.workId):F.kind==="screen"?()=>s(F.workId):l?()=>l():null,speakerMap:E,onEditStart:()=>k(F.key),onEditCancel:()=>k(null),onSave:ie=>D(F,ie),onPatch:ie=>z(F,ie),onDelete:()=>K(F),onCopy:()=>ba(G(F)),onShare:()=>N(F),tagSuggestions:j,stickers:V,reloadStickers:P,authorMap:M,actorMap:q,seps:T,onOpenPerson:_},F.key))}),b<p.length&&e.jsx("div",{className:"mt-3 text-center",children:e.jsx(ge,{onClick:()=>y(F=>F+8),children:n("home.favourites.more.label",{n:p.length-b})})})]}),S&&e.jsx(Ho,{share:G(S),seen:{kind:$t[S.kind].shareKind,id:S.raw.id},onClose:()=>N(null)}),O&&e.jsx(yn,{kind:O.kind,name:O.name,onClose:()=>_(null)})]})}function ny({f:t,variant:a,clampLines:o=3,open:s,editing:r,onToggle:i,onOpen:l,onEditStart:h,onEditCancel:d,onSave:m,onPatch:p,onDelete:u,onCopy:f,onShare:b,tagSuggestions:y,stickers:v,reloadStickers:g,authorMap:w={},actorMap:k={},speakerMap:S={},seps:N,onOpenPerson:j}){var U,te,D,z;const x=$t[t.kind],M=_a(x.actionKind,t,{copy:f&&(()=>f()),share:b&&(()=>b()),edit:h&&(()=>h()),favourite:p&&(()=>{var K;return p({favorite:!((K=t.raw)!=null&&K.favorite)})}),favourited:!!((U=t.raw)!=null&&U.favorite),remove:u&&(()=>u())}),{cardProps:q,menuClass:E,menu:O}=Lo(M.map(K=>({...K,onClick:K.run}))),_=t.kind==="book",T=Je(x.credit(t),N),B={author:w,actor:k,speaker:S}[x.personKind]||{},L=T.join(" · ");let V=t.source,P=t.meta;if(_){const K=Os(t.raw),A=t.raw.location?n("common.locator.page.label",{n:t.raw.location}):"";V=[t.raw.book_title,L].filter(Boolean).join(" · "),P=[t.raw.book_title,K,A].filter(Boolean).join(" · ")}const[C,H]=c.useState(null);c.useEffect(()=>{H(null)},[t.color]);const R=C||t.color||"yellow",I=async K=>{K!==R&&(H(K),await p({color:K})===!1&&H(null))};return e.jsxs(Xe,{variant:a,colorBar:R,className:E,style:{padding:"12px 15px"},...q,children:[e.jsx(Ge,{open:r,onClose:d,title:x.editTitle,maxWidth:520,children:e.jsx(x.form,{initial:t.raw,onSubmit:m,onCancel:d,submitLabel:n("common.action.save.label"),show:((te=t.movie)==null?void 0:te.media_type)==="show",tagSuggestions:y,stickers:v,reloadStickers:g})}),e.jsxs(e.Fragment,{children:[e.jsx(ye,{label:n(s?"home.favourites.collapse.tip":"quiz.option.expand.tip"),className:"flex w-full",children:e.jsxs("button",{type:"button",className:"clampable is-clickable block w-full text-left",style:{background:"none",border:"none",padding:0},onClick:i,"aria-expanded":s,children:[e.jsx($,{className:"mb-1.5 block",style:{fontSize:"var(--type-ui-9)",color:x.labelColor},children:x.label(t)}),e.jsx("p",{style:{fontFamily:"var(--font-display)",fontWeight:"var(--font-display-weight)",fontVariantCaps:"var(--font-display-caps)",textTransform:"var(--font-display-case)",fontVariantNumeric:"var(--font-display-figures)",fontStyle:"italic",fontSize:"var(--type-display-15)",lineHeight:1.5,margin:0,whiteSpace:"pre-wrap",...s?{}:{display:"-webkit-box",WebkitLineClamp:o,WebkitBoxOrient:"vertical",overflow:"hidden"}},children:x.quoted?`“${t.text}”`:t.text}),e.jsxs("span",{className:"mt-1.5 flex items-center gap-1.5",children:[!s&&((z=(D=t.raw)==null?void 0:D.character_images)!=null&&z.length?e.jsx(Nc,{images:t.raw.character_images,size:18,ring:"var(--card)"}):e.jsx(Ma,{names:T,map:B,size:18,ring:"var(--card)"})),e.jsx($,{style:{fontSize:"var(--type-ui-11)"},children:s?P:V})]}),e.jsx(Na,{open:s})]})}),!s&&e.jsxs("div",{className:"mt-1 flex items-center gap-x-3",children:[e.jsx(fa,{actions:Dn(M)}),e.jsx("span",{className:"ml-auto flex items-center",children:e.jsx(ga,{actions:In(M)})})]}),s&&e.jsxs("div",{className:"mt-2.5 space-y-2",children:[t.note&&e.jsx(Eo,{children:t.note}),T.length>0&&e.jsx("div",{className:"flex flex-wrap items-center gap-x-3 gap-y-1",children:T.map(K=>e.jsx(Po,{kind:x.personKind,name:K,person:B[K],size:24,onOpen:j},K))}),t.tags&&t.tags.length>0&&e.jsx("div",{className:"flex flex-wrap gap-1.5",children:t.tags.map(K=>e.jsx("span",{className:"tp-chip",children:K},K))}),e.jsxs("div",{className:"flex flex-wrap items-center gap-x-3 gap-y-1 pt-1",children:[t.openLabel&&l&&e.jsx(Pe,{icon:e.jsx(pa,{name:$t[t.kind].openIcon}),ariaLabel:t.openLabel,onClick:l,className:"shrink-0"}),e.jsx(On,{value:!!t.raw.favorite,onChange:K=>p({favorite:K})}),e.jsx(fa,{actions:Dn(M),alwaysVisible:!0}),e.jsx("span",{className:"card-colors is-visible shrink-0",children:e.jsx(nt,{collapsible:!0,value:R,onChange:I,ariaLabel:n("common.colour.category.aria")})}),e.jsx("span",{className:"ml-auto flex items-center",children:e.jsx(ga,{actions:In(M)})})]})]})]}),O]})}function ay({onOpenBook:t,onOpenMovie:a,onGoQuotes:o,people:s,seps:r,onOpenPerson:i,actions:l}){const[h,d]=c.useState(null),[m,p]=c.useState(!1),[u,f]=c.useState([]);c.useEffect(()=>{let g=!1;return X("GET","/on-this-day").then(w=>{var k;!g&&w.ok&&f(((k=w.data)==null?void 0:k.quotes)||[])}),()=>{g=!0}},[]);const b=async()=>{var w;p(!0);const g=await X("GET","/shuffle");p(!1),g.ok&&d(((w=g.data)==null?void 0:w.quote)||null)},y=g=>g.kind==="book"&&g.work_id?()=>t==null?void 0:t(g.work_id):g.kind==="screen"&&g.work_id?()=>a==null?void 0:a(g.work_id):o?()=>o():null,v=e.jsx(ye,{label:n("home.shuffle.tip"),children:e.jsx(ge,{icon:e.jsx(om,{}),keepLabel:!0,onClick:b,disabled:m,children:n("home.shuffle.label")})});return u.length?e.jsxs("section",{className:"space-y-3",children:[u.length>0&&e.jsxs(e.Fragment,{children:[e.jsx($,{className:"block",children:n("home.onthisday.title",{n:u.length})}),e.jsx("div",{className:"space-y-2",children:u.slice(0,3).map(g=>e.jsx(ts,{q:g,onOpen:y(g),people:s,seps:r,onOpenPerson:i,actions:l},`${g.kind}${g.id}`))})]}),e.jsxs("div",{className:"flex items-center gap-3",children:[v,e.jsx("span",{className:"h-px flex-1",style:{background:"var(--line)"}})]}),h&&e.jsx(ts,{q:h,onOpen:y(h),people:s,seps:r,onOpenPerson:i,actions:l})]}):e.jsxs("section",{className:"space-y-3",children:[e.jsx("div",{className:"flex justify-center",children:v}),h&&e.jsx(ts,{q:h,onOpen:y(h),people:s,seps:r,onOpenPerson:i,actions:l})]})}const es={movie:"common.badge.film",show:"common.badge.show",game:"common.badge.game",book:"common.badge.book",quote:"common.badge.quote"};function ts({q:t,onOpen:a,people:o={},seps:s,onOpenPerson:r,actions:i}){const l=$t[t.kind],[h,d]=c.useState(!!t.favorite),[m,p]=c.useState(!1);c.useEffect(()=>{d(!!t.favorite)},[t]);const u=Je(t.credit,s),f=o[l.personKind]||{},b=Rt(t.year),y=[t.title,b,t.character].filter(Boolean).join(" · "),v=i?_a(l.actionKind,t,{copy:()=>i.copy(t),share:()=>i.share(t),favourite:async()=>{m||(p(!0),d(k=>!k),await i.favourite(t,!h)===!1&&d(k=>!k),p(!1))},favourited:h}):[],g=n(`home.favourites.open.${t.kind==="book"?"book":t.kind==="quote"?"quotes":t.media_type==="show"?"show":"film"}.aria`),w=t.cover_path?e.jsx("img",{src:$e(t.cover_path),alt:"",className:"block w-14 object-cover",style:{aspectRatio:"2 / 3",borderRadius:6,border:"1px solid var(--ink-border)"}}):e.jsx(Dt,{kind:n(es[t.media_type]||"common.badge.cover"),className:"w-14",style:{aspectRatio:"2 / 3",borderRadius:6}});return e.jsx(Xe,{colorBar:t.color||"yellow",style:{padding:"12px 15px"},children:e.jsxs("div",{className:"flex gap-3.5",children:[e.jsx("div",{className:"shrink-0",children:a?e.jsx(ye,{label:g,children:e.jsx("button",{type:"button",onClick:a,"aria-label":g,style:{background:"none",border:"none",padding:0,cursor:"pointer"},children:w})}):w}),e.jsxs("div",{className:"min-w-0 flex-1",children:[e.jsx($,{className:"mb-1 block",style:{fontSize:"var(--type-ui-9)",color:l.labelColor},children:n(es[t.media_type]||es[t.kind])}),e.jsx("button",{type:"button",onClick:a||void 0,className:`block w-full text-left${a?"":" cursor-default"}`,style:{background:"none",border:"none",padding:0},tabIndex:a?0:-1,children:e.jsx("p",{style:{fontFamily:"var(--font-display)",fontStyle:"italic",fontSize:"var(--type-display-15)",lineHeight:1.55,margin:0,whiteSpace:"pre-wrap"},children:l.quoted?`“${t.quote}”`:t.quote})}),e.jsx($,{className:"mt-1.5 block",style:{fontSize:"var(--type-ui-11)"},children:y}),u.length>0&&e.jsx("div",{className:"mt-2 flex flex-wrap items-center gap-x-3 gap-y-1",children:u.map(k=>e.jsx(Po,{kind:l.personKind,name:k,person:f[k],size:22,onOpen:r},k))}),t.tags&&t.tags.length>0&&e.jsx("div",{className:"mt-2 flex flex-wrap gap-1.5",children:t.tags.map(k=>e.jsx("span",{className:"tp-chip",children:k},k))}),v.length>0&&e.jsxs("div",{className:"mt-2 flex items-center gap-x-3",children:[e.jsx(fa,{actions:Dn(v)}),e.jsx("span",{className:"ml-auto flex items-center",children:e.jsx(ga,{actions:In(v)})})]})]})]})})}const oy=[9,11,12,13,15,17,19,22,26,30],sy=[75,100,125,150,175,200],ry=100,wa=["display","ui","mono","hand"],$d=t=>"size"+t[0].toUpperCase()+t.slice(1);function Wd(t){const a=Number(t);return sy.includes(a)?a:ry}function iy(t){const a={};for(const o of wa)a[o]=Wd(t==null?void 0:t[$d(o)]);return a}const ly=(t,a)=>Math.round(t*a/100);function Xw(t){const a=t[wa[0]];return wa.every(o=>t[o]===a)?a:0}function Jw(t){const a={};for(const o of wa)a[$d(o)]=Wd(t);return a}function cy(t){const a=iy(t),o={};for(const s of wa)for(const r of oy)o[`--type-${s}-${r}`]=`${ly(r,a[s])}px`;return o}function dy(t){if(typeof document>"u")return;const a=document.documentElement,o=cy(t);for(const s in o)a.style.setProperty(s,o[s])}const ns=["greeting.epigraph.1","greeting.epigraph.2","greeting.epigraph.3","greeting.epigraph.4","greeting.epigraph.5","greeting.epigraph.6","greeting.epigraph.7","greeting.epigraph.8","greeting.epigraph.9","greeting.epigraph.10"];function hy(t=Math.random){return n(ns[Math.floor(t()*ns.length)%ns.length])}function uy({titleKey:t,info:a=!1,onPick:o,width:s=230}){ul();const r=mh(),i=ph();function l(h){As(h),o==null||o(h)}return e.jsxs("div",{children:[e.jsxs("div",{className:"mb-2 flex items-center gap-1.5",children:[e.jsx($,{children:n(t)}),a&&e.jsx(Le,{title:n("settings.language.info.title"),text:n("settings.language.info.body")})]}),e.jsx(Oe,{ariaLabel:n("locale.picker.aria"),value:ao(),onChange:l,width:s,options:r.map(h=>[h.code,n("locale.picker.coverage",{name:h.name,percent:h.percent})])}),i&&e.jsx("p",{className:"microcopy mt-2",children:n("settings.language.missing",{code:i,name:os(ao())})})]})}const my=["search","quotes","anthologies","tags","metadata","stats","settings","staging","bin","cleanup"],py=[["home","nav.tab.home.label","nav.tab.home.tip"],["library","nav.tab.library.label","nav.tab.library.tip"],["movies","nav.tab.movies.label","nav.tab.movies.tip"],["quotes","nav.tab.quotes.label","nav.tab.quotes.tip"],["anthologies","nav.tab.anthologies.label","nav.tab.anthologies.tip"]],fy=[["tags","nav.tab.tags.label","nav.tab.tags.tip"],["metadata","nav.tab.metadata.label","nav.tab.metadata.tip"],["stats","nav.tab.stats.label","nav.tab.stats.tip"],["settings","nav.tab.settings.label","nav.tab.settings.tip"]],gy=[["search","nav.tab.search.label"],["home","nav.tab.home.label"],["library","nav.tab.library.label"],["movies","nav.tab.movies.label"],["quotes","nav.tab.quotes.label"],["anthologies","nav.tab.anthologies.label"],null,["tags","nav.tab.tags.label"],["metadata","nav.tab.metadata.label"],["stats","nav.tab.stats.label"],["settings","nav.tab.settings.label"]],by=[["home","nav.tab.home.label","nav.bottom.home.aria"],["library","nav.tab.library.label","nav.bottom.library.aria"],["movies","nav.tab.movies.label","nav.bottom.movies.aria"],["quotes","nav.tab.quotes.label","nav.bottom.quotes.aria"],["anthologies","nav.tab.anthologies.label","nav.bottom.anthologies.aria"]],xs=[{tab:"library",label:"nav.tab.library.label",pref:"hideLibrary",what:"nav.section.library.what"},{tab:"movies",label:"nav.tab.movies.label",pref:"hideCatalogue",what:"nav.section.movies.what"},{tab:"quotes",label:"nav.tab.quotes.label",pref:"hideQuotes",what:"nav.section.quotes.what"},{tab:"anthologies",label:"nav.tab.anthologies.label",pref:"showAnthologies",off:!0,what:"nav.section.anthologies.what"}];function Ud(t){const a={};let o=!1;for(const s of xs)a[s.tab]=s.off?!!(t!=null&&t[s.pref]):!(t!=null&&t[s.pref]),a[s.tab]&&!s.off&&(o=!0);return o||(a[xs[0].tab]=!0),a}function jo(t,a){const o=[];for(const s of t){if(s===null){o.length&&o[o.length-1]!==null&&o.push(null);continue}a&&a[s[0]]===!1||o.push(s)}for(;o.length&&o[o.length-1]===null;)o.pop();return o}function Bt(t){if(!t)return null;const a=Number(t);return Number.isInteger(a)&&a>0?a:null}function nl(t){const[a,o]=t.replace(/\/+$/,"").split("/").filter(Boolean);return a?a==="books"&&Bt(o)?{tab:"library",detail:{type:"book",id:Bt(o)}}:(a==="catalogue"||a==="movies")&&Bt(o)?{tab:"movies",detail:{type:"movie",id:Bt(o)}}:a==="library"?{tab:"library",detail:null}:a==="books"?{tab:"library",detail:null}:a==="quotes"&&o==="all"?{tab:"quotes",detail:{type:"board",id:"all"}}:a==="quotes"&&Bt(o)?{tab:"quotes",detail:{type:"board",id:Bt(o)}}:a==="anthologies"&&Bt(o)?{tab:"anthologies",detail:{type:"anthology",id:Bt(o)}}:a==="movies"||a==="catalogue"?{tab:"movies",detail:null}:a==="import"?{tab:"import",detail:null}:a==="capture"?{tab:"capture",detail:null}:a==="pending"?{tab:"staging",detail:null}:my.includes(a)?{tab:a,detail:null}:{tab:"home",detail:null}:{tab:"home",detail:null}}function nn(t,a){return(a==null?void 0:a.type)==="book"?`/books/${a.id}`:(a==null?void 0:a.type)==="movie"?`/catalogue/${a.id}`:(a==null?void 0:a.type)==="board"?`/quotes/${a.id}`:(a==null?void 0:a.type)==="anthology"?`/anthologies/${a.id}`:t==="home"?"/":t==="library"?"/library":t==="movies"?"/catalogue":t==="staging"?"/pending":`/${t}`}function yy(t,a){return(a==null?void 0:a.type)==="book"?"book-detail":(a==null?void 0:a.type)==="movie"?"movie-detail":t}function wy(t,a){return a?"quote":t==="movies"?"film":t==="quotes"?"standalone":"book"}function vy(t,a){return t==="library"||(a==null?void 0:a.type)==="book"?"books":t==="movies"||(a==null?void 0:a.type)==="movie"?"movies":t==="quotes"?"quotes":"all"}const Or=()=>{var t;return Number((t=window.history.state)==null?void 0:t.tpDepth)||0},ky=()=>Or()>0;function xy(t){window.history.replaceState({...window.history.state,tpDepth:Or()},"",t)}function jy(t){return t===window.location.pathname?!1:(window.history.pushState({tpDepth:Or()+1},"",t),!0)}function Sy(t){return ky()?(window.history.back(),!0):(t!==window.location.pathname&&window.history.replaceState({tpDepth:0},"",t),!1)}const va=8,mt=20,Ny=10,Gd=20,Ty=/^[\x20-\x7e]*$/;function Kd(t,{min:a,max:o,stem:s}){const r=String(t||"");return r.length<a?n(`${s}.min`,{n:a}):r.length>o?n(`${s}.max`,{n:o}):Ty.test(r)?"":n(`${s}.charset`)}function Lr(t){return Kd(t,{min:va,max:mt,stem:"error.validate.password"})}function Zw(t){return Kd(t,{min:Ny,max:Gd,stem:"error.validate.passphrase"})}const Ey="TPBK",Cy=2,na=36,Vd=256,Ay=60,qy=na+Vd+2*(2+Ay);async function My(t){try{const a=new Uint8Array(await t.slice(0,qy).arrayBuffer());if(a.length<na)return{key:"none"};if(String.fromCharCode(a[0],a[1],a[2],a[3])!==Ey)return{key:"none"};if(a[4]!==Cy)return{key:"unknown"};const s=a[5];if(s===2)return{key:"passphrase"};if(s!==1)return{key:"unknown"};const r=a[34]<<8|a[35];if(r>Vd)return{key:"unknown"};const i=new TextDecoder().decode(a.subarray(na,na+r)),l=na+r;if(a.length<l+2)return{key:"password",account:i};const h=a[l]<<8|a[l+1],d=l+2+h;if(a.length<d+2)return{key:"password",account:i};const m=a[d]<<8|a[d+1];return{key:"password",account:i,recoverable:m>0}}catch{return{key:"unknown"}}}const Oy=40;function Wo({children:t}){return e.jsx($,{className:"mb-1.5 block",children:t})}function Ly({user:t,onUser:a}){const[o,s]=c.useState(!1),[r,i]=c.useState("");async function l(d){var u;const m=d.target.files&&d.target.files[0];if(d.target.value="",!m)return;s(!0),i("");const p=await xa("/auth/me/avatar",m);s(!1),p.ok?a({avatar_path:p.data.avatar_path}):i(((u=p.data)==null?void 0:u.error)||n("error.upload.failed"))}async function h(){const d=await X("DELETE","/auth/me/avatar");d.ok?a({avatar_path:""}):i(le(d,n("error.remove.photo")))}return e.jsxs("div",{className:"flex items-center gap-4",children:[e.jsx("span",{className:"user-chip",style:{width:56,height:56,fontSize:"var(--type-ui-22)"},"aria-hidden":"true",children:t.avatar_path?e.jsx("img",{src:$e(t.avatar_path),alt:""}):(t.username||"?").trim().charAt(0).toLowerCase()}),e.jsxs("div",{className:"flex flex-col gap-2",children:[e.jsxs("div",{className:"flex flex-wrap items-center gap-2",children:[e.jsxs("label",{className:"tp-btn tp-btn-primary",style:{cursor:"pointer"},children:[o?n("common.action.upload.busy"):t.avatar_path?n("account.photo.change"):n("account.photo.upload"),e.jsx("input",{type:"file",accept:"image/*",className:"hidden",onChange:l,disabled:o})]}),e.jsx(Le,{title:n("account.photo.info.title"),text:n("account.photo.info.body")}),t.avatar_path&&e.jsx(Ce,{icon:e.jsx(Fe,{}),ariaLabel:n("account.photo.remove.aria"),onClick:h,tooltip:n("account.photo.remove.tip"),danger:!0})]}),e.jsx(ve,{children:r})]})]})}function _y({user:t,onUser:a}){const[o,s]=c.useState(t.username||""),[r,i]=c.useState(!1),[l,h]=c.useState(""),[d,m]=c.useState(!1),p=o.trim()!==(t.username||"");async function u(f){if(f.preventDefault(),h(""),m(!1),!o.trim())return h(n("error.validate.name-cannot-be-blank"));i(!0);const b=await X("PUT","/auth/me",{username:o.trim()});i(!1),b.ok?(a({username:b.data.username}),s(b.data.username),m(!0)):h(le(b,n("error.save.name")))}return e.jsxs("form",{onSubmit:u,className:"space-y-2",children:[e.jsx(Wo,{children:n("account.name.label")}),e.jsxs("div",{className:"flex flex-wrap items-center gap-2",children:[e.jsx(Nt,{style:{flex:1,minWidth:160},value:o,autoComplete:"off",maxLength:Oy,onChange:f=>{s(f.target.value),m(!1)}}),e.jsx(Jt,{disabled:r||!p||!o.trim(),title:o.trim()?void 0:n("error.validate.name-required"),children:n(r?"common.action.save.busy":"account.name.save")})]}),d&&e.jsx("p",{style:{fontSize:"var(--type-ui-13)",color:"var(--soft)"},children:n("account.name.done")}),e.jsx(ve,{children:l})]})}function Ry(){const[t,a]=c.useState(""),[o,s]=c.useState(""),[r,i]=c.useState(""),[l,h]=c.useState(""),[d,m]=c.useState(!1),[p,u]=c.useState(!1),f=t?Lr(o)||(o!==r?n("error.validate.password-mismatch"):""):n("error.validate.password-current-required");async function b(y){if(y.preventDefault(),h(""),m(!1),f)return h(f);u(!0);const v=await X("POST","/auth/password",{current:t,new:o});u(!1),v.ok?(a(""),s(""),i(""),m(!0)):h(le(v,n("error.save.password")))}return e.jsxs("form",{onSubmit:b,className:"space-y-3",children:[e.jsxs("span",{className:"flex items-center gap-1.5",children:[e.jsx(Wo,{children:n("account.password.label")}),e.jsx(Le,{title:n("account.password.info.title"),text:n("account.password.info.body",{min:va,max:mt})})]}),e.jsx("input",{className:"tp-input",placeholder:n("account.password.current.placeholder"),type:"password",value:t,autoComplete:"current-password",maxLength:mt,onChange:y=>a(y.target.value)}),e.jsx("input",{className:"tp-input",placeholder:n("account.password.new.placeholder",{min:va,max:mt}),type:"password",value:o,autoComplete:"new-password",maxLength:mt,onChange:y=>s(y.target.value)}),e.jsx("input",{className:"tp-input",placeholder:n("account.password.repeat.placeholder"),type:"password",value:r,autoComplete:"new-password",maxLength:mt,onChange:y=>i(y.target.value)}),e.jsx(ve,{children:l}),d&&e.jsx("p",{style:{fontSize:"var(--type-ui-13)",color:"var(--soft)"},children:n("account.password.done")}),e.jsx(Jt,{icon:e.jsx(Wu,{}),keepLabel:!0,className:"w-full",disabled:p||!!f,title:f||void 0,children:n("account.password.submit")}),f&&o.length>0&&e.jsxs("p",{className:"microcopy",style:{color:"var(--faint)"},children:[f,"."]})]})}function Dy({me:t}){const[a,o]=c.useState(!1),[s,r]=c.useState(""),[i,l]=c.useState(""),[h,d]=c.useState(""),[m,p]=c.useState(!1),u=s.trim()===((t==null?void 0:t.username)||""),f=s.trim()?u?n("error.validate.switch-same"):i?"":n("error.validate.switch-password-required"):n("error.validate.switch-name-required");async function b(v){if(v.preventDefault(),f)return d(f);p(!0),d("");const g=await X("POST","/auth/login",{username:s.trim(),password:i});if(g.ok){window.location.href="/";return}p(!1),d(le(g,n("error.switch.account")))}const y=()=>{o(!1),r(""),l(""),d("")};return e.jsxs("div",{children:[e.jsxs("div",{className:"flex flex-wrap items-center justify-between gap-3",children:[e.jsxs("div",{className:"flex min-w-0 flex-1 items-center gap-1.5",children:[e.jsx("p",{className:"text-sm font-semibold",children:n("account.switch.title")}),e.jsx(Le,{title:n("account.switch.info.title"),text:n("account.switch.info.body")})]}),!a&&e.jsx(ge,{icon:e.jsx(zu,{}),keepLabel:!0,onClick:()=>o(!0),children:n("account.switch.action")})]}),a&&e.jsxs("form",{onSubmit:b,className:"switch-panel",children:[e.jsxs("p",{className:"switch-from",children:[e.jsx("span",{className:"user-chip",style:{width:24,height:24,fontSize:"var(--type-ui-11)"},"aria-hidden":"true",children:t!=null&&t.avatar_path?e.jsx("img",{src:$e(t.avatar_path),alt:""}):((t==null?void 0:t.username)||"?").trim().charAt(0).toLowerCase()}),e.jsx("span",{children:Ie("account.switch.leaving",{name:e.jsx("b",{children:t==null?void 0:t.username})})})]}),e.jsx(xe,{label:n("account.switch.name.label"),value:s,autoFocus:!0,autoComplete:"username",onChange:v=>{r(v.target.value),d("")}}),e.jsx(xe,{label:n("account.switch.password.label"),type:"password",value:i,autoComplete:"current-password",maxLength:mt,onChange:v=>{l(v.target.value),d("")}}),e.jsx(ve,{children:h}),e.jsxs("div",{className:"flex flex-wrap items-center gap-2",children:[e.jsx(Jt,{disabled:m||!!f,title:f||void 0,children:n(m?"account.switch.busy":"account.switch.submit")}),e.jsx(ge,{type:"button",onClick:y,children:n("common.action.cancel.label")}),f&&!h&&e.jsx("span",{className:"microcopy",style:{color:"var(--faint)"},children:f})]})]})]})}function Iy(){const[t,a]=c.useState(""),[o,s]=c.useState(""),[r,i]=c.useState(""),[l,h]=c.useState(!1),[d,m]=c.useState("");async function p(){a("reindex"),i(""),s("");const f=await X("POST","/admin/search/reindex");a(""),f.ok&&f.data.ok?s(n("account.reindex.done")):f.ok?i(n("account.reindex.partial",{failed:(f.data.failed||[]).join(", ")})):i(le(f,n("error.reindex.failed")))}async function u(){if(d!=="RESET")return;a("reset"),i(""),s("");const f=await X("POST","/admin/reset",{confirm:"RESET"});if(f.ok){window.location.href="/";return}a(""),i(le(f,n("error.reset.failed")))}return e.jsxs(bt,{pad:"p-5",children:[e.jsx(Wo,{children:n("account.maintenance.label")}),e.jsxs("div",{className:"space-y-4",children:[e.jsxs("div",{className:"flex flex-wrap items-center justify-between gap-3",children:[e.jsxs("div",{className:"flex min-w-0 flex-1 items-center gap-1.5",children:[e.jsx("p",{className:"text-sm font-semibold",children:n("account.reindex.title")}),e.jsx(Le,{title:n("account.reindex.info.title"),text:n("account.reindex.info.body")})]}),e.jsx(ge,{disabled:t==="reindex",onClick:p,children:n(t==="reindex"?"account.reindex.busy":"account.reindex.action")})]}),e.jsx("hr",{style:{border:"none",borderTop:"1px dashed var(--line)"}}),e.jsxs("div",{children:[e.jsxs("div",{className:"flex items-center gap-1.5",children:[e.jsx("p",{className:"text-sm font-semibold",style:{color:"var(--error)"},children:n("account.reset.title")}),e.jsx(Le,{title:n("account.reset.info.title"),text:n("account.reset.info.body")})]}),l?e.jsxs("div",{className:"mt-2 space-y-2",children:[e.jsx("p",{className:"microcopy",children:Ie("account.reset.confirm.prose",{word:e.jsx("b",{children:"RESET"})})}),e.jsx("input",{className:"tp-input",value:d,autoFocus:!0,placeholder:"RESET",onChange:f=>m(f.target.value)}),e.jsxs("div",{className:"flex flex-wrap gap-2",children:[e.jsx("button",{type:"button",className:"tp-btn",style:{background:"var(--error)",color:"#fff",opacity:d==="RESET"&&t!=="reset"?1:.55},disabled:d!=="RESET"||t==="reset",onClick:u,children:n(t==="reset"?"account.reset.busy":"account.reset.submit")}),e.jsx(ge,{onClick:()=>{h(!1),m("")},children:n("common.action.cancel.label")})]})]}):e.jsx(ge,{icon:e.jsx(Fe,{}),keepLabel:!0,className:"mt-2",onClick:()=>h(!0),children:n("account.reset.open")})]}),o&&e.jsx("p",{className:"microcopy",style:{color:"var(--accent-ui)"},children:o}),e.jsx(ve,{children:r})]})]})}function Py({user:t,onUser:a,logout:o}){return e.jsxs("div",{className:"space-y-5",children:[e.jsx(bt,{pad:"p-5",children:e.jsx(Ly,{user:t,onUser:a})}),e.jsx(bt,{pad:"p-5",children:e.jsx(_y,{user:t,onUser:a})}),e.jsx(bt,{pad:"p-5",children:e.jsxs("div",{className:"space-y-4",children:[e.jsx(Dy,{me:t}),e.jsx("hr",{style:{border:"none",borderTop:"1px dashed var(--line)"}}),e.jsxs("div",{className:"flex flex-wrap items-center justify-between gap-3",children:[e.jsxs("div",{className:"flex min-w-0 flex-1 items-center gap-1.5",children:[e.jsx("p",{className:"text-sm font-semibold",children:n("account.logout.title")}),e.jsx(Le,{title:n("account.logout.info.title"),text:n("account.logout.info.body")})]}),o&&e.jsx(ge,{icon:e.jsx($u,{}),keepLabel:!0,onClick:o,children:n("account.logout.action")})]})]})}),e.jsx(bt,{pad:"p-5",children:e.jsx(Ry,{})}),(t==null?void 0:t.is_admin)&&e.jsxs(bt,{pad:"p-5",children:[e.jsxs("span",{className:"flex items-center gap-1.5",children:[e.jsx(Wo,{children:n("account.users.label")}),e.jsx(Le,{title:n("account.users.info.title"),text:n("account.users.info.body")})]}),e.jsx(By,{me:t})]}),(t==null?void 0:t.is_admin)&&e.jsx(Iy,{})]})}function By({me:t}){const[a,o]=c.useState([]),[s,r]=c.useState(""),[i,l]=c.useState(""),[h,d]=c.useState(""),[m,p]=c.useState(null);async function u(){const w=await X("GET","/admin/users");w.ok?o(w.data.users):d(le(w,n("error.load.users")))}c.useEffect(()=>{u()},[]);const f=a.filter(w=>w.is_admin).length;async function b(w){w.preventDefault(),d("");const k=await X("POST","/admin/users",{username:s,password:i});k.ok?(r(""),l(""),u()):d(le(k,n("error.add.user")))}async function y(w,k){d(""),p(w.id);const S=await X("PATCH",`/admin/users/${w.id}`,{is_admin:k});p(null),S.ok?u():d(le(S,n("error.save.role")))}async function v(w){if(!confirm(n("account.users.delete.confirm",{name:w.username})))return;d("");const k=await X("DELETE",`/admin/users/${w.id}`);k.ok?u():d(le(k,n("error.delete.user")))}const g=s.trim()?Lr(i):n("error.validate.username-required-add");return e.jsxs("div",{children:[e.jsx("ul",{className:"space-y-1",children:a.map(w=>{const k=w.id===t.id,S=w.is_admin&&f<=1,N=w.is_admin?k&&!S:!0,j=!k&&!w.is_admin;return e.jsxs("li",{className:"flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2",style:{borderBottom:"1px solid var(--line)"},children:[e.jsx("span",{className:"user-chip",style:{width:30,height:30,fontSize:"var(--type-ui-13)"},"aria-hidden":"true",children:w.avatar_path?e.jsx("img",{src:$e(w.avatar_path),alt:""}):(w.username||"?").trim().charAt(0).toLowerCase()}),e.jsx("span",{style:{fontWeight:600},children:w.username}),w.is_admin&&e.jsx("span",{className:"tp-chip",style:{color:"var(--accent-ui)"},children:n("account.users.admin.chip")}),k&&e.jsx("span",{className:"mono-label",children:n("account.users.you.chip")}),e.jsxs("span",{className:"ml-auto flex items-center gap-2",children:[N?e.jsx("button",{type:"button",className:"tp-chip tp-chip-btn",disabled:m===w.id,title:w.is_admin?n("account.users.step-down.tip"):n("account.users.make-admin.tip",{name:w.username}),onClick:()=>y(w,!w.is_admin),children:w.is_admin?n("account.users.step-down"):n("account.users.make-admin")}):w.is_admin&&e.jsx("span",{className:"mono-label",style:{color:"var(--faint)"},children:n(S&&k?"account.users.only-admin":"account.users.their-own")}),j&&e.jsx(ye,{label:n("account.users.delete.tip",{name:w.username}),side:"top",children:e.jsx("button",{type:"button",onClick:()=>v(w),"aria-label":n("account.users.delete.aria",{name:w.username}),style:{background:"none",border:"none",color:"var(--error)",fontSize:"var(--type-ui-17)",padding:4,lineHeight:1,cursor:"pointer"},children:"✕"})})]})]},w.id)})}),e.jsxs("form",{onSubmit:b,className:"mt-4 flex flex-wrap items-center gap-2",children:[e.jsx("input",{className:"tp-input",style:{flex:1,minWidth:130},placeholder:n("common.field.username.placeholder"),value:s,autoComplete:"off",onChange:w=>r(w.target.value)}),e.jsx("input",{className:"tp-input",style:{flex:1,minWidth:130},placeholder:n("account.password.new.placeholder",{min:va,max:mt}),type:"password",value:i,autoComplete:"new-password",maxLength:mt,onChange:w=>l(w.target.value)}),e.jsx(Jt,{icon:e.jsx(Hu,{}),keepLabel:!0,disabled:!!g,title:g||void 0,children:n("account.users.add")})]}),g&&i.length>0&&e.jsxs("p",{className:"microcopy mt-1",style:{color:"var(--faint)"},children:[g,"."]}),e.jsx(ve,{children:h})]})}const Fy={book:{get quote(){return n("tour.demo.book.quote.prose")},get title(){return n("tour.demo.book.title")},get author(){return n("tour.demo.book.author.label")},get meta(){return n("tour.demo.book.meta.label")}},movie:{get quote(){return n("tour.demo.film.quote.prose")},get title(){return n("tour.demo.film.title")},year:1942,get character(){return n("tour.demo.film.character.label")},get actor(){return n("tour.demo.film.actor.label")},get meta(){return n("tour.demo.film.meta.label")}}},Hy=[{key:"welcome",tab:"home",get title(){return n("tour.step.welcome.title")},get body(){return n("tour.step.welcome.prose")},get more(){return n("tour.step.welcome.more")}},{key:"add",anchor:'[data-tour="add"]',get name(){return n("tour.step.add.name")},get blurb(){return n("tour.step.add.blurb")},get title(){return n("tour.step.add.title")},get body(){return Ie("tour.step.add.prose",{em1:e.jsx("b",{children:n("tour.step.add.em1.label")},"em1"),em2:e.jsx("b",{children:n("tour.step.add.em2.label")},"em2"),em3:e.jsx("b",{children:n("tour.step.add.em3.label")},"em3"),em4:e.jsx("b",{children:n("tour.step.add.em4.label")},"em4")})},get more(){return n("tour.step.add.more")}},{key:"library",tab:"library",demo:"book",get name(){return n("tour.step.library.name")},get blurb(){return n("tour.step.library.blurb")},get title(){return n("tour.step.library.title")},get body(){return n("tour.step.library.prose")},get more(){return n("tour.step.library.more")}},{key:"catalogue",tab:"movies",demo:"movie",get name(){return n("tour.step.catalogue.name")},get blurb(){return n("tour.step.catalogue.blurb")},get title(){return n("tour.step.catalogue.title")},get body(){return n("tour.step.catalogue.prose")},get more(){return n("tour.step.catalogue.more")}},{key:"share",get name(){return n("tour.step.share.name")},get blurb(){return n("tour.step.share.blurb")},get title(){return n("tour.step.share.title")},get body(){return Ie("tour.step.share.prose",{em1:e.jsx("b",{children:n("tour.step.share.em1.label")},"em1")})},get more(){return n("tour.step.share.more")}},{key:"quiz",tab:"home",get name(){return n("tour.step.quiz.name")},get blurb(){return n("tour.step.quiz.blurb")},get title(){return n("tour.step.quiz.title")},get body(){return n("tour.step.quiz.prose")},get more(){return n("tour.step.quiz.more")}},{key:"search",anchor:'[data-tour="search"]',get name(){return n("tour.step.search.name")},get blurb(){return n("tour.step.search.blurb")},get title(){return n("tour.step.search.title")},get body(){return Ie("tour.step.search.prose",{em1:e.jsx("b",{children:n("tour.step.search.em1.label")},"em1")})},get more(){return n("tour.step.search.more")}},{key:"tags",tab:"tags",get name(){return n("tour.step.tags.name")},get blurb(){return n("tour.step.tags.blurb")},get title(){return n("tour.step.tags.title")},get body(){return Ie("tour.step.tags.prose",{em1:e.jsx("b",{children:n("tour.step.tags.em1.label")},"em1")})},get more(){return n("tour.step.tags.more")}},{key:"metadata",tab:"metadata",get name(){return n("tour.step.metadata.name")},get blurb(){return n("tour.step.metadata.blurb")},get title(){return n("tour.step.metadata.title")},get body(){return Ie("tour.step.metadata.prose",{em1:e.jsx("b",{children:n("tour.step.metadata.em1.label")},"em1")})},get more(){return n("tour.step.metadata.more")}},{key:"stats",tab:"stats",get name(){return n("tour.step.stats.name")},get blurb(){return n("tour.step.stats.blurb")},get title(){return n("tour.step.stats.title")},get body(){return n("tour.step.stats.prose")},get more(){return n("tour.step.stats.more")}},{key:"appearance",tab:"settings",anchor:'[data-tour="appearance"]',get name(){return n("tour.step.appearance.name")},get blurb(){return n("tour.step.appearance.blurb")},get title(){return n("tour.step.appearance.title")},get body(){return n("tour.step.appearance.prose")}},{key:"keys",tab:"settings",anchor:'[data-tour="metadata-keys"]',admin:!0,get name(){return n("tour.step.keys.name")},get blurb(){return n("tour.step.keys.blurb")},get title(){return n("tour.step.keys.title")},get body(){return n("tour.step.keys.prose")},get more(){return n("tour.step.keys.more")}},{key:"backup",tab:"settings",anchor:'[data-tour="backup"]',admin:!0,get name(){return n("tour.step.backup.name")},get blurb(){return n("tour.step.backup.blurb")},get title(){return n("tour.step.backup.title")},get body(){return Ie("tour.step.backup.prose",{em1:e.jsx("b",{children:n("tour.step.backup.em1.label")},"em1")})},get more(){return n("tour.step.backup.more")}},{key:"account",anchor:'[data-tour="account"]',get name(){return n("tour.step.account.name")},get blurb(){return n("tour.step.account.blurb")},get title(){return n("tour.step.account.title")},get body(){return Ie("tour.step.account.prose",{em1:e.jsx("b",{children:n("tour.step.account.em1.label")},"em1")})},get more(){return n("tour.step.account.more")}},{key:"done",get title(){return n("tour.step.done.title")},get body(){return Ie("tour.step.done.prose",{em1:e.jsx("b",{children:n("tour.step.done.em1.label")},"em1"),em2:e.jsx("b",{children:n("tour.step.done.em2.label")},"em2")})}}],Yd=(t,a)=>Hy.filter(o=>(!o.admin||t)&&(!o.tab||(a==null?void 0:a[o.tab])!==!1)),ev=(t,a)=>Yd(t,a).map((o,s)=>({...o,at:s})).filter(o=>o.name);function zy(t){for(const a of document.querySelectorAll(t)){const o=a.getBoundingClientRect();if(o.width>4&&o.height>4)return a}return null}function $y({kind:t}){const a=Fy[t];return e.jsxs("figure",{className:"tour-demo",children:[e.jsx("blockquote",{style:{fontFamily:"var(--font-display)",fontWeight:"var(--font-display-weight)",fontVariantCaps:"var(--font-display-caps)",textTransform:"var(--font-display-case)",fontVariantNumeric:"var(--font-display-figures)",fontStyle:"italic",fontSize:"var(--type-display-15)",lineHeight:1.5,whiteSpace:"pre-wrap"},children:t==="book"?`“${a.quote}”`:a.quote}),e.jsx("figcaption",{className:"mt-2",style:{fontFamily:"var(--font-mono)",fontWeight:"var(--font-mono-weight)",fontStyle:"var(--font-mono-style)",fontVariantCaps:"var(--font-mono-caps)",textTransform:"var(--font-mono-case)",fontVariantNumeric:"var(--font-mono-figures)",fontSize:"var(--type-mono-11)",letterSpacing:".06em",color:"var(--faint)"},children:t==="book"?Ie("tour.demo.book.credit.label",{name:a.author,title:e.jsx("i",{children:a.title},"title"),meta:a.meta}):Ie("tour.demo.film.credit.label",{character:a.character,actor:a.actor,title:e.jsx("i",{children:a.title},"title"),year:a.year,meta:a.meta})})]})}function Wy({user:t,startStep:a=0,onNavigate:o,onPreferences:s,onClose:r}){const i=c.useMemo(()=>Ud(t.preferences),[t.preferences]),l=c.useMemo(()=>Yd(t.is_admin,i),[t.is_admin,i]),[h,d]=c.useState(()=>Math.min(Math.max(0,a),l.length-1)),m=l[h],p=_e(),[u,f]=c.useState(null),b=c.useRef(null);c.useEffect(()=>{var j;m.tab&&o(m.tab),(j=b.current)==null||j.focus({preventScroll:!0})},[h]),c.useEffect(()=>{if(f(null),!m.anchor)return;let j,x=null,M=!1;const q={t:-1,l:-1,w:-1,h:-1},E=()=>{if(!M){if((!x||!x.isConnected)&&(x=zy(m.anchor),x))try{x.scrollIntoView({block:"center"})}catch{}if(x){const O=x.getBoundingClientRect();(Math.abs(O.top-q.t)>.5||Math.abs(O.left-q.l)>.5||Math.abs(O.width-q.w)>.5||Math.abs(O.height-q.h)>.5)&&(q.t=O.top,q.l=O.left,q.w=O.width,q.h=O.height,f({top:O.top,left:O.left,width:O.width,height:O.height}))}j=requestAnimationFrame(E)}};return j=requestAnimationFrame(E),()=>{M=!0,cancelAnimationFrame(j)}},[h]);function y(j){s==null||s(j),X("PUT","/auth/me/preferences",j)}function v(){y({tour:"done",tourStep:0}),r(),Se(n("tour.toast.done"))}function g(){y({tour:"skipped",tourStep:0}),r(),Se(n("tour.toast.skipped"))}function w(){y({tour:"postponed",tourStep:h}),r(),Se(n("tour.toast.postponed"))}const k=()=>h>=l.length-1?v():d(h+1),S=()=>h>0&&d(h-1);c.useEffect(()=>{const j=x=>{x.key==="Escape"&&w()};return document.addEventListener("keydown",j),()=>document.removeEventListener("keydown",j)},[h]);const N={};if(!p){const j=window.innerWidth,x=window.innerHeight,M=Math.min(400,j-24),q=340;u?(N.left=Math.max(12,Math.min(u.left,j-M-12)),u.top+u.height+14+q<x?N.top=u.top+u.height+14:u.top-q-14>0?N.bottom=x-u.top+14:(N.top="50%",N.transform="translateY(-50%)",N.left=Math.max(12,Math.min(u.left+u.width+18,j-M-12)))):(N.left="50%",N.top="50%",N.transform="translate(-50%, -50%)")}return e.jsxs(e.Fragment,{children:[u?e.jsx("div",{className:"tour-spotlight","aria-hidden":"true",style:{top:u.top-6,left:u.left-6,width:u.width+12,height:u.height+12}}):!m.anchor&&e.jsx("div",{className:"tour-scrim","aria-hidden":"true"}),e.jsxs("section",{ref:b,tabIndex:-1,role:"dialog","aria-label":m.title,className:"tour-card hand-card p-5"+(p?" mobile":""),style:N,children:[e.jsxs("div",{className:"flex items-baseline justify-between gap-3",children:[e.jsx($,{children:n("tour.progress.label",{done:h+1,total:l.length})}),e.jsx("button",{type:"button",className:"tp-link",onClick:w,children:n("tour.later.label")})]}),e.jsxs("div",{className:"mt-1.5 flex items-center gap-1.5",children:[e.jsx("h2",{style:{fontFamily:"var(--font-ui)",fontStyle:"var(--font-ui-style)",fontVariantCaps:"var(--font-ui-caps)",textTransform:"var(--font-ui-case)",fontVariantNumeric:"var(--font-ui-figures)",fontSize:"var(--type-ui-17)",fontWeight:600},children:m.title}),m.more&&e.jsx(Le,{title:m.title,text:m.more})]}),e.jsx("div",{className:"mt-2",style:{fontSize:"var(--type-ui-13)",lineHeight:1.55,color:"var(--soft)"},children:m.body}),m.demo&&e.jsx($y,{kind:m.demo}),e.jsxs("div",{className:"mt-4 flex items-center gap-2",children:[e.jsx("button",{type:"button",className:"tp-link",onClick:g,children:n("tour.skip.label")}),e.jsx("span",{className:"flex-1"}),h>0&&e.jsx(Ce,{icon:e.jsx(Zt,{}),ariaLabel:n("tour.back.aria"),onClick:S}),e.jsx(Jt,{onClick:k,children:n(h>=l.length-1?"tour.finish.label":"tour.next.label")})]})]})]})}const Uy=c.lazy(()=>Ve(()=>Promise.resolve().then(()=>Sd),void 0)),Gy=c.lazy(()=>Ve(()=>import("./MetadataPage-BIXgnLzr.js"),__vite__mapDeps([0,1]))),Ky=c.lazy(()=>Ve(()=>Promise.resolve().then(()=>Ad),void 0)),Vy=c.lazy(()=>Ve(()=>Promise.resolve().then(()=>Ld),void 0)),Yy=c.lazy(()=>Ve(()=>import("./TagsPage-CCkms8AE.js"),__vite__mapDeps([2,1]))),Qy=c.lazy(()=>Ve(()=>import("./SearchPage-Dbcjahym.js"),__vite__mapDeps([3,1]))),Xy=c.lazy(()=>Ve(()=>Promise.resolve().then(()=>Qb),void 0)),Jy=c.lazy(()=>Ve(()=>import("./StatsPage-BSOoqMpf.js"),__vite__mapDeps([4,1]))),Zy=c.lazy(()=>Ve(()=>import("./Settings-DP8sZe-C.js"),__vite__mapDeps([5,1]))),ew=c.lazy(()=>Ve(()=>import("./BinPage-CiHLRN0U.js"),__vite__mapDeps([6,1]))),tw=c.lazy(()=>Ve(()=>import("./CleanupPage-jkblS7bv.js"),__vite__mapDeps([7,1]))),Qd={home:"go-home",library:"go-library",movies:"go-catalogue",quotes:"go-quotes",anthologies:"go-anthologies",stats:"go-stats",metadata:"go-metadata",settings:"go-settings",search:"search"};function nw(){ul();const[t,a]=c.useState(null),[o,s]=c.useState(!1),[r,i]=c.useState(null),[l,h]=c.useState(!0);c.useEffect(()=>{fetch(wt("/auth/me")).then(u=>u.ok?u.json():null).then(u=>u?a(u):fetch(wt("/auth/status")).then(f=>f.json()).then(f=>{s(f.needs_onboarding),i(f.backup||null)})).finally(()=>h(!1))},[]),c.useEffect(()=>{var u;t&&(So(t.preferences||{}),El(t.preferences||{}),As(((u=t.preferences)==null?void 0:u.locale)||""),Km(t.preferences||{}),fg(t.preferences||{}),wi(t.preferences||{}),dy(t.preferences||{}),X("GET","/fonts").then(f=>{var b;f.ok&&Ap(((b=f.data)==null?void 0:b.fonts)||[]).then(()=>wi(t.preferences||{}))}))},[t]);const d=u=>a(f=>f&&{...f,preferences:{...f.preferences,...u}}),m=u=>a(f=>f&&{...f,...u});let p=null;return l||(t?p=e.jsx(pw,{user:t,onLogout:()=>{nr(),a(null)},onPreferences:d,onUser:m}):o?p=e.jsx(ow,{onDone:a,backup:r}):p=e.jsx(sw,{onLogin:a})),e.jsxs(e.Fragment,{children:[e.jsx("div",{className:"scene-bg","aria-hidden":"true"}),qs,e.jsx(Ml,{children:p}),e.jsx(km,{}),e.jsx("div",{className:"grain-overlay","aria-hidden":"true"})]})}async function aw(){const t=await fetch(wt("/auth/me"));return t.ok?t.json():null}function Xd({header:t,action:a,cta:o,microcopy:s,film:r=!1,onSuccess:i}){const l=a!=="/auth/login",[h,d]=c.useState(""),[m,p]=c.useState(""),[u,f]=c.useState(""),[b,y]=c.useState(!1);async function v(k){k.preventDefault(),f(""),y(!0);try{const S=await fetch(wt(a),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:h,password:m})});if(S.ok){const N=await aw();if(N)return a==="/auth/login"&&Se(n("shell.login.toast.welcome",{name:N.username||n("shell.login.reader.fallback")})),i(N)}f((await S.json().catch(()=>({}))).error||n("error.generic"))}finally{y(!1)}}const g=r?iu:Jt,w=h.trim()?m?l?Lr(m):"":n("error.validate.password-required"):n("error.validate.username-required");return e.jsxs("form",{onSubmit:v,className:"hand-card w-full max-w-sm px-8 py-9",children:[e.jsx("div",{className:"mb-7 text-center",children:t}),e.jsx(xe,{label:n("common.field.username.label"),placeholder:n("common.field.username.placeholder"),value:h,autoComplete:"username",onChange:k=>d(k.target.value)}),e.jsx(xe,{label:n("common.field.password.label"),placeholder:l?n("shell.login.password.range.placeholder",{a:va,b:mt}):n("common.field.password.placeholder"),type:"password",value:m,autoComplete:l?"new-password":"current-password",maxLength:mt,onChange:k=>p(k.target.value)}),e.jsx("div",{className:"mt-3",children:e.jsx(ve,{children:u})}),e.jsx(g,{className:"mt-4 w-full",disabled:b||!!w,title:w||void 0,children:o}),w&&m.length>0&&e.jsx("p",{className:"microcopy mt-2 text-center",children:n("common.form.reason.sentence",{reason:w})}),s&&e.jsx("p",{className:"microcopy mt-5 text-center",children:s})]})}function ow({onDone:t,backup:a}){const[o,s]=c.useState(a?"server":"file"),[r,i]=c.useState(null),[l,h]=c.useState(null),[d,m]=c.useState("idle"),[p,u]=c.useState(0),[f,b]=c.useState(""),[y,v]=c.useState(""),[g,w]=c.useState(""),k=c.useRef(null);c.useEffect(()=>{So({materialSet:"manuscript",theme:"light"})},[]);const S=o==="file"?r?{...l,name:r.name}:null:a,N=(S==null?void 0:S.key)||(S?"none":"");async function j(O){i(O),b(""),h(O?await My(O):null)}const x=S?N==="passphrase"?g?"":n("error.validate.archive-passphrase-required"):N==="password"?y?"":n("error.validate.archive-password-required"):"":n(o==="file"?"error.validate.backup-file-required":"error.validate.backup-absent"),M=()=>N==="passphrase"?{passphrase:g}:N==="password"?{password:y}:{};async function q(){if(!(x||d!=="idle")){b(""),m(o==="file"?"uploading":"restoring"),u(0);try{let O;if(o==="file"){const _=new FormData;for(const[T,B]of Object.entries(M()))_.append(T,B);_.append("file",r),O=await fl("/auth/restore/upload",_,T=>{u(Math.round(T*100)),T>=1&&m("restoring")})}else O=await X("POST","/auth/restore",M());if(!O.ok)return m("idle"),b(O.data&&O.data.error||n("error.restore.failed"));Se(n("shell.restore.toast.done")),setTimeout(()=>window.location.reload(),1200)}catch{setTimeout(()=>window.location.reload(),1200)}}}const E=d==="uploading"?n("shell.restore.uploading.busy",{percent:p}):d==="restoring"?n("common.action.apply.busy"):"";return e.jsxs("main",{className:"flex min-h-screen flex-col items-center justify-center gap-4 px-4 py-10","data-screen-label":"onboarding",children:[e.jsx("div",{className:"hand-card w-full max-w-sm px-8 py-6",children:e.jsx(uy,{titleKey:"onboarding.language.title",width:230})}),e.jsx(Xd,{header:e.jsxs(e.Fragment,{children:[e.jsx("img",{src:"/mark.svg",alt:"",width:"46",height:"46",className:"mx-auto mb-3"}),e.jsx("h1",{className:"display-title text-2xl",children:n("shell.onboarding.title")}),e.jsx("p",{className:"mt-1 text-sm",style:{color:"var(--soft)"},children:n("shell.onboarding.subtitle.prose")})]}),action:"/auth/signup",cta:n("shell.onboarding.cta.label"),microcopy:n("shell.onboarding.microcopy.prose"),onSuccess:t}),e.jsxs("div",{className:"hand-card w-full max-w-sm px-8 py-6",children:[e.jsx("p",{className:"mono-label mb-2 text-center",children:n("shell.restore.title")}),e.jsx("p",{className:"mb-3 text-sm",style:{color:"var(--soft)"},children:n("shell.restore.what.prose")}),e.jsx(Ye,{ariaLabel:n("shell.restore.source.aria"),value:o,onChange:O=>{s(O),b("")},options:[["server",n("shell.restore.source.server.label")],["file",n("shell.restore.source.file.label")]]}),o==="server"&&e.jsx("p",{className:"microcopy mt-2",children:a?Ie("shell.restore.server.dated.prose",{date:e.jsx("b",{children:new Date(a.created).toLocaleString(void 0,{dateStyle:"medium",timeStyle:"short"})})}):n("shell.restore.server.empty.prose")}),o==="file"&&e.jsxs(e.Fragment,{children:[e.jsx("input",{ref:k,type:"file",accept:".tpbk,.tar.gz,.tgz,application/gzip,application/octet-stream","aria-label":n("shell.restore.file.aria"),className:"hidden",onChange:O=>{var _;return j(((_=O.target.files)==null?void 0:_[0])||null)}}),e.jsx(ge,{className:"mt-3 w-full",onClick:()=>{var O;return(O=k.current)==null?void 0:O.click()},disabled:d!=="idle",children:r?r.name:n("shell.restore.file.choose.label")})]}),N==="passphrase"&&e.jsx("div",{className:"mt-3",children:e.jsx(xe,{label:n("common.field.passphrase.label"),placeholder:n("shell.restore.passphrase.placeholder"),type:"password",value:g,maxLength:Gd,onChange:O=>{w(O.target.value),b("")}})}),N==="password"&&e.jsxs("div",{className:"mt-3",children:[e.jsx(xe,{label:S!=null&&S.account?n("shell.restore.password.named.label",{name:S.account}):n("common.field.password.label"),placeholder:n("shell.restore.password.placeholder"),type:"password",value:y,autoComplete:"current-password",maxLength:mt,onChange:O=>{v(O.target.value),b("")}}),e.jsx("p",{className:"microcopy",children:n(S!=null&&S.recoverable?"shell.restore.password.recoverable.prose":"shell.restore.password.era.prose")})]}),N==="none"&&S&&e.jsx("p",{className:"microcopy mt-2",children:n("shell.restore.unkeyed.prose")}),e.jsx(ge,{className:"mt-3 w-full",onClick:q,disabled:!!x||d!=="idle",title:x||void 0,children:E||n("common.action.restore.label")}),x&&e.jsx("p",{className:"microcopy mt-2 text-center",children:n("common.form.reason.sentence",{reason:x})}),e.jsx("div",{className:"mt-2",children:e.jsx(ve,{children:f})})]})]})}function sw({onLogin:t}){c.useEffect(()=>{So({materialSet:"film-assembly",theme:"dark"})},[]);const[a]=c.useState(hy),o=Gl();return e.jsx("main",{className:"flex min-h-screen items-center justify-center px-4 py-10","data-screen-label":"login",children:e.jsxs("div",{className:"film-strip w-full max-w-2xl",children:[e.jsx(lo,{}),e.jsx(Ul,{left:"",code:cs(o)}),e.jsx("div",{className:"flex justify-center px-6 py-8",children:e.jsx(Xd,{film:!0,header:e.jsxs(e.Fragment,{children:[e.jsx("img",{src:"/mark-dark.svg",alt:"",width:"44",height:"44",className:"mx-auto mb-3"}),e.jsx("div",{className:"wordmark",style:{fontSize:"var(--type-ui-22)"},children:n("shell.wordmark.label")}),e.jsx("p",{className:"bengali text-sm","aria-hidden":"true",children:"টিপ্পনী"}),e.jsx("p",{className:"login-epigraph",children:a})]}),action:"/auth/login",cta:n("shell.login.cta.label"),microcopy:n("shell.login.microcopy.prose"),onSuccess:t})}),e.jsx(lo,{})]})})}function al(t){return t.map(([a,o,s])=>[a,e.jsxs(e.Fragment,{children:[e.jsx(pa,{name:a})," ",e.jsx("span",{className:"tab-label",children:n(o)})]}),n(s)])}function rw({tab:t,onChange:a,sections:o}){return e.jsxs("div",{className:"topbar-nav-group",children:[e.jsx(Ye,{className:"nav-toggle",ariaLabel:n("shell.nav.primary.aria"),value:t,onChange:a,options:al(jo(py,o))}),e.jsx("span",{className:"nav-divider","aria-hidden":"true"}),e.jsx(Ye,{className:"nav-toggle",ariaLabel:n("shell.nav.tools.aria"),value:t,onChange:a,options:al(jo(fy,o))})]})}function iw(){const t=c.useRef(null),[a,o]=c.useState(!1),s=c.useRef({iconOnly:!1,fullWidth:0});return c.useEffect(()=>{var h,d;const r=t.current;if(!r)return;const i=()=>{const m=s.current;m.iconOnly?r.clientWidth>=m.fullWidth+8&&(m.iconOnly=!1,o(!1)):r.scrollWidth>r.clientWidth+1&&(m.fullWidth=r.scrollWidth,m.iconOnly=!0,o(!0))};i();const l=new ResizeObserver(i);return l.observe(r),(d=(h=document.fonts)==null?void 0:h.ready)==null||d.then(i),()=>l.disconnect()},[]),[t,a]}function js({user:t,onOpen:a}){return e.jsx(ye,{label:n("shell.account.chip.tip"),side:"bottom",className:"shrink-0",children:e.jsx("button",{className:"user-chip","data-tour":"account","aria-label":n("shell.account.chip.aria",{name:t.username}),onClick:a,children:e.jsx(cw,{user:t})})})}function lw({user:t,onUser:a,onClose:o,logout:s}){const r=_e();ja(!0,o),c.useEffect(()=>{const l=h=>{h.key==="Escape"&&o()};return document.addEventListener("keydown",l),()=>document.removeEventListener("keydown",l)},[o]);const i=e.jsx(Py,{user:t,onUser:a,logout:s});return r?e.jsxs("div",{className:"account-page",role:"dialog","aria-label":n("nav.tab.profile.label"),children:[e.jsxs("header",{className:"account-page-bar",children:[e.jsx(ye,{label:n("shell.account.back.tip"),side:"bottom",children:e.jsx("button",{type:"button",className:"mobile-topbar-btn",onClick:o,"aria-label":n("common.action.back.label"),children:e.jsx(Zt,{})})}),e.jsx("span",{className:"account-page-title",children:n("nav.tab.profile.label")}),e.jsx("span",{className:"ml-auto",children:e.jsx(_n,{screen:"profile"})})]}),e.jsx("div",{className:"account-page-body",children:i})]}):e.jsx("div",{className:"account-scrim",onMouseDown:o,children:e.jsxs("div",{className:"hand-card account-modal",role:"dialog","aria-label":n("nav.tab.profile.label"),onMouseDown:l=>l.stopPropagation(),children:[e.jsxs("div",{className:"account-modal-bar",children:[e.jsx("h2",{className:"account-modal-title",children:n("nav.tab.profile.label")}),e.jsx(_n,{screen:"profile"}),e.jsx(Zs,{onClick:o,tooltip:n("shell.account.panel.close.tip")})]}),e.jsx("div",{className:"account-modal-body",children:i})]})})}const jn=new Map;function as(t){for(jn.delete(t),jn.set(t,window.scrollY);jn.size>2;)jn.delete(jn.keys().next().value)}function cw({user:t}){return t.avatar_path?e.jsx("img",{src:$e(t.avatar_path),alt:""}):(t.username||"?").trim().charAt(0).toLowerCase()}function dw({open:t,onClose:a,tab:o,selectTab:s,onSearch:r,onAdd:i,onAccount:l,user:h,stats:d,pending:m,pendingImport:p,streak:u,update:f,logout:b,dark:y,onUser:v,sections:g}){ja(t,a);const[w,k]=c.useState(null);c.useEffect(()=>{!t||w!==null||X("GET","/metadata/library").then(E=>{if(!E.ok||!E.data)return;const O=(E.data.books||[]).filter(T=>!T.has_cover||!T.has_ids).length,_=(E.data.movies||[]).filter(T=>!T.has_poster||!T.has_cast||!T.has_source).length;k(O+_)})},[t,w]),c.useEffect(()=>{if(!t)return;const E=O=>{O.key==="Escape"&&a()};return document.addEventListener("keydown",E),()=>document.removeEventListener("keydown",E)},[t,a]),At(t);const S=c.useRef(null),N=10,j=E=>{S.current={x:E.clientX,y:E.clientY,intent:null,hit:!1}},x=E=>{const O=S.current;if(!O||O.intent==="scroll")return;const _=E.clientX-O.x,T=E.clientY-O.y;if(O.intent===null){if(Math.abs(_)<N&&Math.abs(T)<N)return;O.intent=Math.abs(_)>Math.abs(T)?"swipe":"scroll"}O.intent==="swipe"&&_<=-48&&(O.hit=!0)},M=()=>{var O;const E=(O=S.current)==null?void 0:O.hit;S.current=null,E&&a()};if(!t)return null;const q=E=>E==="home"?e.jsxs("span",{className:"drawer-badge",style:{fontSize:"var(--type-ui-9)"},children:[m>0&&e.jsx("span",{className:"review-dot","aria-hidden":"true"}),"quiz · practice"]}):E==="library"&&d?e.jsx("span",{className:"drawer-badge",children:d.books}):E==="movies"&&d?e.jsx("span",{className:"drawer-badge",children:d.movies}):E==="quotes"&&d?e.jsx("span",{className:"drawer-badge",children:d.quotes}):E==="tags"&&d?e.jsx("span",{className:"drawer-badge",children:d.tags}):E==="metadata"&&w!==null?e.jsx("span",{className:"drawer-badge",children:w>0?n("common.count.phrase",{n:w,noun:n("unit.issue",{count:w})}):n("shell.drawer.metadata.clear.label")}):E==="stats"&&u>0?e.jsx("span",{className:"drawer-badge",children:n("shell.drawer.stats.streak.label",{n:u})}):E==="settings"?e.jsx("span",{className:"drawer-badge",children:n("shell.drawer.settings.version.label",{version:h.version||"dev"})}):null;return e.jsxs(e.Fragment,{children:[e.jsx("button",{type:"button",className:"drawer-scrim","aria-label":n("shell.drawer.close.aria"),onClick:a}),e.jsxs("nav",{className:"drawer","aria-label":n("shell.nav.primary.aria"),onPointerDown:j,onPointerMove:x,onPointerUp:M,onPointerCancel:()=>{S.current=null},children:[e.jsxs("div",{className:"drawer-header",children:[e.jsx("img",{src:y?"/mark-dark.svg":"/mark.svg",alt:"",width:"34",height:"34"}),e.jsxs("div",{className:"min-w-0",children:[e.jsx("p",{style:{fontFamily:"var(--font-display)",fontStyle:"var(--font-display-style)",fontVariantCaps:"var(--font-display-caps)",textTransform:"var(--font-display-case)",fontVariantNumeric:"var(--font-display-figures)",fontWeight:600,fontSize:"var(--type-display-19)",letterSpacing:"-0.02em"},children:"tippani"}),e.jsx("p",{className:"bengali",style:{fontSize:"var(--type-display-12)",color:"var(--amber)"},"aria-hidden":"true",children:n("shell.drawer.tagline.label")})]})]}),e.jsxs("div",{className:"drawer-nav",children:[e.jsxs("button",{type:"button",className:"drawer-item drawer-add",onClick:()=>{i(),a()},children:[e.jsx(tt,{}),n("common.action.add.label"),e.jsx("span",{className:"drawer-badge",children:n("shell.drawer.add.badge.label")})]}),p>0&&e.jsxs("button",{type:"button",className:"drawer-item",onClick:()=>{s("staging"),a()},children:[e.jsx(pa,{name:"import"}),n("shell.drawer.pending.label"),e.jsx("span",{className:"drawer-badge",style:{color:"var(--accent-ui)"},children:p})]}),jo(gy,g).map((E,O)=>E===null?e.jsx("div",{className:"drawer-divider","aria-hidden":"true"},`div-${O}`):e.jsxs("button",{type:"button",className:"drawer-item"+(o===E[0]?" active":""),"aria-current":o===E[0]?"page":void 0,onClick:()=>{E[0]==="search"&&r?r():s(E[0]),a()},children:[e.jsx(pa,{name:E[0]}),n(E[1]),q(E[0]),e.jsx(rn,{keys:Ft(Qd[E[0]])})]},E[0]))]}),e.jsxs("div",{className:"drawer-footer",children:[e.jsx(js,{user:h,onOpen:()=>{l(),a()}}),e.jsxs("div",{className:"min-w-0 flex-1",children:[e.jsx("p",{style:{fontSize:"var(--type-ui-13)",fontWeight:600},children:h.username}),e.jsx("p",{className:"mono-label",style:{fontSize:"var(--type-ui-9)"},children:n(h.is_admin?"shell.drawer.role.admin.label":"shell.drawer.role.user.label")})]}),e.jsx("button",{type:"button",className:"tp-link",onClick:b,children:n("shell.drawer.logout.label")})]}),e.jsxs("div",{className:"flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 pb-3 pt-2",style:{borderTop:"1px solid var(--line)"},children:[e.jsx(ye,{label:n("shell.drawer.changelog.tip"),side:"top",children:e.jsx("a",{href:h.releases_url||"https://github.com/aaronified/tippani/releases",target:"_blank",rel:"noopener noreferrer",className:"mono-label",style:{fontSize:"var(--type-ui-11)",letterSpacing:".04em",color:"var(--faint)"},children:n("shell.drawer.changelog.label",{version:h.version||"dev"})})}),(f==null?void 0:f.update_available)&&f.notes_url&&e.jsx("a",{href:f.notes_url,target:"_blank",rel:"noopener noreferrer",className:"mono-label",style:{fontSize:"var(--type-ui-11)",fontWeight:700,color:"var(--accent-ui)"},title:n("shell.drawer.update.tip",{version:f.latest}),children:n("shell.drawer.update.label",{version:f.latest})})]})]})]})}function hw({tab:t,selectTab:a,hidden:o,sections:s}){const[r,i]=c.useState(!1),l=o&&!r;return e.jsx("nav",{className:"mobile-bottom-nav"+(l?" is-away":""),"aria-label":n("shell.nav.quick.aria"),onFocus:()=>i(!0),onBlur:()=>i(!1),children:jo(by,s).map(([h,d,m])=>{const p=t===h;return e.jsx(ye,{label:n(m),side:"top",children:e.jsxs("button",{type:"button",className:"mobile-bottom-nav-btn"+(p?" active":""),"aria-label":n(d),"aria-current":p?"page":void 0,onClick:()=>a(h),children:[e.jsx(pa,{name:h}),e.jsx("span",{className:"mobile-bottom-nav-mark","aria-hidden":"true"})]})},h)})})}const uw=[()=>Ve(()=>Promise.resolve().then(()=>Sd),void 0),()=>Ve(()=>Promise.resolve().then(()=>Ld),void 0),()=>Ve(()=>Promise.resolve().then(()=>Ad),void 0),()=>Ve(()=>import("./SearchPage-Dbcjahym.js"),__vite__mapDeps([3,1]))];function mw(){const t=()=>{for(const a of uw)a().catch(()=>{})};typeof requestIdleCallback=="function"?requestIdleCallback(t,{timeout:4e3}):setTimeout(t,1500)}function pw({user:t,onLogout:a,onPreferences:o,onUser:s}){var je,Ne,Me,ze;const r=nl(typeof window<"u"?window.location.pathname:"/"),i=r.tab==="import"||r.tab==="capture"?"home":r.tab,[l,h]=c.useState(i);c.useEffect(mw,[]);const[d,m]=c.useState(r.detail),[p,u]=c.useState(!1),[f,b]=c.useState(!1),[y,v]=He("tippani:search:global",!1),[g,w]=c.useState(!1),[k,S]=c.useState(!1),[N,j]=c.useState("book"),[x,M]=c.useState(null),q=(fe="book",Ae=null)=>{j(fe),M(Ae),w(!0)},[E,O]=c.useState(0),_=()=>O(fe=>fe+1),[T,B]=c.useState(0),[L,V]=c.useState(0),P=()=>{X("GET","/import/staged?counts=1").then(fe=>{fe.ok&&V(fe.data.pending||0)})},[C,H]=c.useState(0),[R,I]=c.useState(null),[U,te]=c.useState(null),D=au(),[z,K]=iw(),[A,Y]=c.useState(null),G=_e(),ae=ou({enabled:G,forceShow:f||g||p||!!A,resetKey:l});c.useEffect(()=>{var Ae;if((Ae=t.preferences)!=null&&Ae.tour)return;const fe=setTimeout(()=>Y({step:0}),800);return()=>clearTimeout(fe)},[]);const Z=()=>{X("GET","/stats").then(fe=>{fe.ok&&I(fe.data)})};c.useEffect(()=>{Z(),bc(Ro()).then(fe=>{fe.ok&&(B((fe.data.items||[]).length),H(fe.data.streak||0))}),P(),r.tab==="import"&&q("import"),r.tab==="capture"&&q("quote")},[]),c.useEffect(()=>{var Ae,lt;const fe=(T||0)+(L||0);try{fe>0?(Ae=navigator.setAppBadge)==null||Ae.call(navigator,fe):(lt=navigator.clearAppBadge)==null||lt.call(navigator)}catch{}},[T,L]);const pe=c.useRef({tab:l,detail:d});c.useEffect(()=>{pe.current={tab:l,detail:d}}),c.useEffect(()=>{"scrollRestoration"in window.history&&(window.history.scrollRestoration="manual")},[]),c.useEffect(()=>{const fe=()=>{const Ae=pe.current;Ae.detail||as(nn(Ae.tab,null));const lt=nl(window.location.pathname);if(lt.tab==="import"){h("home"),m(null),q("import");return}if(lt.tab==="capture"){h("home"),m(null),q("quote");return}h(lt.tab),m(lt.detail)};return window.addEventListener("popstate",fe),xy(nn(i,r.detail)),()=>window.removeEventListener("popstate",fe)},[]),c.useEffect(()=>{const fe=d?null:jn.get(nn(l,null));if(fe==null){window.scrollTo({top:0,behavior:"instant"});return}let Ae=0,lt=!1;const Un=()=>{if(!lt){if(document.documentElement.scrollHeight-window.innerHeight>=fe||Ae>40){window.scrollTo({top:fe,behavior:"instant"});return}Ae++,requestAnimationFrame(Un)}};return requestAnimationFrame(Un),()=>{lt=!0}},[l,d]);function ce(fe,Ae){d||as(nn(l,null)),h(fe),m(Ae),jy(nn(fe,Ae))}function F(fe){Sy(nn(fe,null))||(d||as(nn(l,null)),h(fe),m(null))}function Q(fe){ce(fe,null)}function ie(fe){ce("library",{type:"book",id:fe})}function he(fe){ce("movies",{type:"movie",id:fe})}function ue(fe,Ae="all"){try{localStorage.setItem("tippani:search:q",JSON.stringify(fe)),localStorage.setItem("tippani:search:scope",JSON.stringify(Ae)),localStorage.setItem("tippani:search:chips",JSON.stringify([]))}catch{}Q("search")}function re(fe,Ae=[]){try{localStorage.setItem("tippani:search:scope",JSON.stringify(fe)),localStorage.setItem("tippani:search:chips",JSON.stringify(Ae))}catch{}Q("search")}const J=()=>y?re("all"):re(vy(l,d),Zf());c.useEffect(()=>ql(fe=>{switch(fe){case"search":J();break;case"capture":q("quote");break;case"go-home":ce("home");break;case"go-library":ce("library");break;case"go-catalogue":ce("movies");break;case"go-quotes":ce("quotes");break;case"go-anthologies":ce("anthologies");break;case"go-stats":ce("stats");break;case"go-metadata":ce("metadata");break;case"go-settings":ce("settings");break;case"go-profile":u(!0);break;case"help":S(!0);break}}),[l,d,y]);const de=()=>{v(fe=>(Se(fe?"searching where you are":"searching everything"),!fe))};async function Te(){await fetch(wt("/auth/logout"),{method:"POST"}),a()}const Be=T>0&&e.jsx("span",{className:"review-dot","aria-hidden":"true"}),We=L>0&&e.jsx("span",{className:"add-badge",children:L}),qe=Ud(t.preferences),ne=new Set(xs.filter(fe=>!qe[fe.tab]).map(fe=>Qd[fe.tab]).filter(Boolean)),me=yy(l,d),oe=wy(l,d),be=(d==null?void 0:d.type)==="book"||(d==null?void 0:d.type)==="movie"?{type:d.type,id:d.id}:null,ee=n(oe==="quote"?"shell.add.quote.label":oe==="film"?"shell.add.film.label":"shell.add.work.label");return e.jsxs("div",{className:"min-h-screen"+(d?"":" has-mobile-topbar"),children:[e.jsx("header",{className:"topbar",children:e.jsxs("div",{className:"topbar-inner",children:[e.jsx(ye,{shortcut:"go-home",label:n("nav.bottom.home.aria"),side:"bottom",className:"shrink-0",children:e.jsxs("button",{type:"button",className:"brand",onClick:()=>Q("home"),children:[e.jsx("img",{src:D?"/mark-dark.svg":"/mark.svg",alt:"",width:"28",height:"28"}),e.jsx("span",{className:"wordmark",children:n("shell.wordmark.label")}),Be]})}),e.jsx("nav",{ref:z,"aria-label":n("shell.nav.primary.aria"),className:"topbar-nav"+(K?" icon-only":""),children:e.jsx(rw,{tab:l,onChange:Q,sections:qe})}),e.jsxs("div",{className:"ml-auto flex items-center gap-2.5",children:[e.jsx(ye,{side:"bottom",className:"shrink-0",label:L>0?n("shell.add.pending.tip",{n:L}):ee,children:e.jsxs("button",{type:"button",className:"topbar-add-btn tactile","data-tour":"add","aria-label":ee,onClick:()=>q(oe,be),children:[e.jsx(tt,{}),e.jsx("span",{children:n("common.action.add.label")}),We]})}),e.jsx(ye,{shortcut:"search",label:n(y?"shell.search.global.tip":"nav.tab.search.label"),side:"bottom",className:"shrink-0",onContextMenu:de,children:e.jsx("button",{type:"button",className:"topbar-add-btn tactile icon-only","data-tour":"search","data-global":y?"on":void 0,onClick:J,"aria-label":n(y?"shell.search.global.aria":"nav.tab.search.label"),children:y?e.jsx(ri,{}):e.jsx(kt,{})})}),e.jsx(_n,{screen:me,variant:"pill"}),e.jsx(js,{user:t,onOpen:()=>u(!0)})]})]})}),e.jsxs("main",{className:"container-tp",children:[!d&&e.jsxs("header",{className:"mobile-topbar",children:[e.jsx(ye,{label:n("shell.drawer.open.tip"),side:"bottom",className:"shrink-0",children:e.jsx("button",{type:"button",className:"mobile-topbar-btn","aria-label":n("shell.drawer.open.aria"),onClick:()=>b(!0),children:e.jsx(Yl,{})})}),e.jsx(ye,{shortcut:"go-home",label:n("nav.bottom.home.aria"),side:"bottom",className:"min-w-0",children:e.jsxs("button",{type:"button",className:"brand",onClick:()=>Q("home"),children:[e.jsx("img",{src:D?"/mark-dark.svg":"/mark.svg",alt:"",width:"26",height:"26"}),e.jsx("span",{className:"wordmark",children:n("shell.wordmark.label")}),Be]})}),e.jsx("span",{className:"flex-1"}),e.jsx(ye,{shortcut:"capture",label:L>0?n("shell.add.pending.tip",{n:L}):ee,side:"bottom",className:"shrink-0",children:e.jsxs("button",{type:"button",className:"mobile-topbar-btn","data-tour":"add","aria-label":ee,onClick:()=>q(oe,be),children:[e.jsx(tt,{}),We]})}),e.jsx(ye,{shortcut:"search",label:n(y?"shell.search.global.tip":"nav.tab.search.label"),side:"bottom",className:"shrink-0",children:e.jsx("button",{type:"button",className:"mobile-topbar-btn","data-tour":"search","data-global":y?"on":void 0,"aria-label":n(y?"shell.search.global.aria":"nav.tab.search.label"),onClick:J,children:y?e.jsx(ri,{}):e.jsx(kt,{})})}),e.jsx(_n,{screen:me}),e.jsx(js,{user:t,onOpen:()=>u(!0)})]}),e.jsx(Ml,{label:n("shell.error.boundary.screen.label",{name:l}),children:e.jsx("div",{className:"tab-panel",children:e.jsxs(c.Suspense,{fallback:null,children:[l==="home"&&e.jsx("div",{"data-screen-label":"home",children:e.jsx(ty,{user:t,stats:R,onOpenBook:ie,onOpenMovie:he,onGoLibrary:qe.library?()=>Q("library"):null,onGoMovies:qe.movies?()=>Q("movies"):null,onGoQuotes:qe.quotes?()=>Q("quotes"):null,onPending:B,pendingImport:L,onReviewImport:()=>Q("staging")})}),l==="library"&&e.jsx("div",{"data-screen-label":"library",children:e.jsx(Uy,{openId:(d==null?void 0:d.type)==="book"?d.id:null,onOpen:ie,onClose:()=>F("library"),onOpenMovie:he,creditSeparators:(je=t.preferences)==null?void 0:je.creditSeparators,onAdd:q,onSearch:J,dataNonce:E})}),l==="movies"&&e.jsx("div",{"data-screen-label":"movies",children:e.jsx(Ky,{openId:(d==null?void 0:d.type)==="movie"?d.id:null,onOpen:he,onClose:()=>F("movies"),creditSeparators:(Ne=t.preferences)==null?void 0:Ne.creditSeparators,onAdd:q,onSearch:J,dataNonce:E})}),l==="metadata"&&e.jsx("div",{"data-screen-label":"metadata",children:e.jsx(Gy,{user:t,onOpenBook:ie,onOpenMovie:he,onSearch:ue})}),l==="search"&&e.jsx("div",{"data-screen-label":"search",children:e.jsx(Qy,{onOpenBook:ie,onOpenMovie:he,creditSeparators:(Me=t.preferences)==null?void 0:Me.creditSeparators,sections:qe})}),l==="quotes"&&e.jsx("div",{"data-screen-label":"quotes",children:e.jsx(Vy,{openId:(d==null?void 0:d.type)==="board"?d.id:null,onOpen:fe=>ce("quotes",{type:"board",id:fe}),onClose:()=>F("quotes"),creditSeparators:(ze=t.preferences)==null?void 0:ze.creditSeparators})}),l==="anthologies"&&e.jsx("div",{"data-screen-label":"anthologies",children:e.jsx(mg,{openId:(d==null?void 0:d.type)==="anthology"?d.id:null,onOpen:fe=>ce("anthologies",{type:"anthology",id:fe}),onClose:()=>F("anthologies"),onOpenBook:ie,onOpenMovie:he})}),l==="tags"&&e.jsx("div",{"data-screen-label":"tags",children:e.jsx(Yy,{})}),l==="stats"&&e.jsx("div",{"data-screen-label":"stats",children:e.jsx(Jy,{onSearch:ue})}),l==="staging"&&e.jsx("div",{"data-screen-label":"staging",children:e.jsx(Xy,{onPending:V,onOpenBook:ie,onOpenMovie:he,onApproved:Z})}),l==="settings"&&e.jsx("div",{"data-screen-label":"settings",children:e.jsx(Zy,{user:t,onPreferences:o,update:U,onUpdateInfo:te,onStartTour:fe=>Y({step:fe}),onOpenBin:()=>ce("bin",null),onOpenCleanup:()=>ce("cleanup",null)})}),l==="bin"&&e.jsx("div",{"data-screen-label":"bin",children:e.jsx(ew,{onClose:()=>F("settings")})}),l==="cleanup"&&e.jsx("div",{"data-screen-label":"cleanup",children:e.jsx(tw,{onClose:()=>F("settings"),onOpenBook:ie,onOpenMovie:he,onOpenQuotes:()=>ce("quotes",null)})})]})})},l)]}),e.jsx(hw,{tab:l,selectTab:Q,hidden:ae,sections:qe}),e.jsx(dw,{open:f,onClose:()=>b(!1),tab:l,selectTab:Q,sections:qe,onSearch:()=>re("all"),onAdd:()=>q("book"),onAccount:()=>u(!0),user:t,stats:R,pending:T,pendingImport:L,streak:C,update:U,logout:Te,dark:D,onUser:s}),e.jsx(xu,{open:k,onClose:()=>S(!1),omit:ne}),e.jsx(Bb,{open:g,initialSection:N,initialTarget:x,pendingImport:L,sections:qe,onReviewImport:()=>{w(!1),Q("staging")},onStaged:P,onClose:()=>w(!1),onAdded:fe=>{w(!1),Z(),_();const Ae=fe==="film"?"movies":"library";qe[Ae]!==!1&&ce(Ae,null)},onCaptured:()=>{w(!1),Z(),_()},onWorkCreated:Z,onOpenMovie:he}),p&&e.jsx(lw,{user:t,onUser:s,logout:Te,onClose:()=>u(!1)}),A&&e.jsx(Wy,{user:t,startStep:A.step,onNavigate:Q,onPreferences:o,onClose:()=>Y(null)})]})}async function fw(){So({}),El({}),Hh(),As(),ao()!==ka&&await sl(ao()),bh(),ah(),pu(),Zd.createRoot(document.getElementById("root")).render(e.jsx(nw,{}))}fw();export{Lu as $,Bu as A,ru as B,Zs as C,mn as D,ve as E,Ie as F,ge as G,Xe as H,Le as I,lc as J,cc as K,rp as L,$ as M,Nt as N,hs as O,Ow as P,Ce as Q,Nw as R,jd as S,ye as T,Cd as U,Oa as V,_w as W,Rw as X,qa as Y,Ge as Z,Sa as _,_e as a,Cr as a$,ai as a0,Js as a1,qo as a2,nt as a3,xw as a4,He as a5,Qe as a6,zw as a7,Kw as a8,_u as a9,Po as aA,vo as aB,Ar as aC,ba as aD,qd as aE,ws as aF,Ho as aG,Uf as aH,Eo as aI,Nc as aJ,qu as aK,$s as aL,bn as aM,Wn as aN,zc as aO,pn as aP,Bn as aQ,Aa as aR,sn as aS,Fc as aT,dn as aU,Hc as aV,Dt as aW,jw as aX,Ff as aY,Lf as aZ,Of as a_,Ht as aa,Oe as ab,co as ac,Ww as ad,it as ae,Xf as af,Hw as ag,qt as ah,Mt as ai,Gw as aj,Uw as ak,Xu as al,qw as am,Ju as an,Mw as ao,Gs as ap,To as aq,Ao as ar,gn as as,yr as at,Ea as au,Ma as av,pr as aw,Vf as ax,Qf as ay,$w as az,Vt as b,wa as b$,Sr as b0,Er as b1,bt as b2,Ro as b3,Se as b4,Ye as b5,Ut as b6,Eu as b7,Ta as b8,Vr as b9,Vu as bA,Hh as bB,Fh as bC,gl as bD,ca as bE,Tw as bF,Yu as bG,ev as bH,Yd as bI,Cw as bJ,Aw as bK,My as bL,Zw as bM,mt as bN,Gd as bO,Wu as bP,fl as bQ,uo as bR,El as bS,So as bT,bw as bU,_h as bV,Pl as bW,iy as bX,Xw as bY,Fw as bZ,Iw as b_,Mn as ba,Wr as bb,Ct as bc,ia as bd,yw as be,Sw as bf,Uu as bg,rt as bh,wt as bi,la as bj,Jt as bk,Ew as bl,kw as bm,$h as bn,Du as bo,Ru as bp,Jl as bq,vw as br,Ud as bs,xs as bt,ww as bu,Gl as bv,Et as bw,oo as bx,cs as by,uy as bz,$n as c,$d as c0,Dc as c1,Dw as c2,_p as c3,Bw as c4,Vw as c5,pg as c6,yg as c7,xe as c8,Fi as c9,ad as ca,tt as cb,sy as cc,Jw as cd,dy as ce,wi as cf,Pw as cg,xa as ch,Qw as ci,Yw as cj,fg as ck,Ap as cl,Ny as cm,Zt as cn,vt as co,Fu as cp,$e as d,le as e,Gt as f,Pe as g,Hn as h,ft as i,X as j,Ku as k,ir as l,Lw as m,yn as n,Vl as o,Io as p,kt as q,mo as r,Nn as s,n as t,At as u,at as v,Fe as w,Je as x,ni as y,Br as z};
