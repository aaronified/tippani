const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/MetadataPage-C-mTqDqD.js","assets/react-BZwu_XJr.js","assets/TagsPage-CBOLR9zS.js","assets/SearchPage-B7HXTKLV.js","assets/StatsPage-DQjZXyRN.js","assets/Settings-ePsecudU.js","assets/BinPage-C5v0j1DD.js","assets/CleanupPage-BZB4G-Df.js","assets/ChecksPage-0ieqHa5n.js"])))=>i.map(i=>d[i]);
import{r as c,j as e,a as Ve,c as Eh}from"./react-BZwu_XJr.js";(function(){const n=document.createElement("link").relList;if(n&&n.supports&&n.supports("modulepreload"))return;for(const r of document.querySelectorAll('link[rel="modulepreload"]'))s(r);new MutationObserver(r=>{for(const i of r)if(i.type==="childList")for(const l of i.addedNodes)l.tagName==="LINK"&&l.rel==="modulepreload"&&s(l)}).observe(document,{childList:!0,subtree:!0});function o(r){const i={};return r.integrity&&(i.integrity=r.integrity),r.referrerPolicy&&(i.referrerPolicy=r.referrerPolicy),r.crossOrigin==="use-credentials"?i.credentials="include":r.crossOrigin==="anonymous"?i.credentials="omit":i.credentials="same-origin",i}function s(r){if(r.ep)return;r.ep=!0;const i=o(r);fetch(r.href,i)}})();const Ah="modulepreload",qh=function(t){return"/"+t},ei={},Qe=function(n,o,s){let r=Promise.resolve();if(o&&o.length>0){let l=function(m){return Promise.all(m.map(p=>Promise.resolve(p).then(u=>({status:"fulfilled",value:u}),u=>({status:"rejected",reason:u}))))};document.getElementsByTagName("link");const h=document.querySelector("meta[property=csp-nonce]"),d=(h==null?void 0:h.nonce)||(h==null?void 0:h.getAttribute("nonce"));r=l(o.map(m=>{if(m=qh(m),m in ei)return;ei[m]=!0;const p=m.endsWith(".css"),u=p?'[rel="stylesheet"]':"";if(document.querySelector(`link[href="${m}"]${u}`))return;const f=document.createElement("link");if(f.rel=p?"stylesheet":Ah,p||(f.as="script"),f.crossOrigin="",f.href=m,d&&f.setAttribute("nonce",d),document.head.appendChild(f),p)return new Promise((b,w)=>{f.addEventListener("load",b),f.addEventListener("error",()=>w(new Error(`Unable to preload CSS for ${m}`)))})}))}function i(l){const h=new Event("vite:preloadError",{cancelable:!0});if(h.payload=l,window.dispatchEvent(h),!h.defaultPrevented)throw l}return r.then(l=>{for(const h of l||[])h.status==="rejected"&&i(h.reason);return n().catch(i)})},Mh=`# tippani — English. The other half of this pair is bn.txt beside it.
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
common.panel.back.aria = Back to {title}

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
common.filters.reset.label = Reset filters
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
vocab.source.letterboxd.label = Letterboxd

# The floor under IGDB for games rather than a second opinion, so it is named.
vocab.source.wikidata.label = Wikidata

vocab.source.amazon.label = Amazon
# The picture search — Google's Programmable Search, which is a different
# product from the Books API above and takes a different pair of credentials.
vocab.source.tmdb.label = TMDB
vocab.source.tvdb.label = TheTVDB
# What a row whose supplier the app does not recognise is called.
vocab.source.manual.label = You
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

# --- deleting one work, from its own card or its own screen. A TYPED PHRASE, the
# same one the bulk bar asks for: one is a number you can misread too, when the
# one is a book with two hundred highlights and the tap that destroys it is the
# tap that opens it. The phrase itself is composed in English by deletePhrase and
# is not a key here — see the note there.
common.work.delete.confirm.title = Delete {title}?
common.work.delete.confirm.phrase = Type {phrase} to confirm.
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
shell.nav.dock.aria = Actions for this screen

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

# --- the ＋ in both top bars, which reads the route it is standing on.
shell.add.work.label = Add or import
shell.add.film.label = Add a film or show
shell.add.quote.label = Capture a quote
# The same button when an import is waiting in the pending queue.
shell.add.pending.tip = {n} imports awaiting review

# --- Search, and its global mode (right-click on a desktop).
shell.crumbs.aria = Where you are
shell.search.scope.thisbook = this book
shell.search.scope.thisfilm = this film
shell.search.scope.all = everything
shell.search.scope.key = in
shell.search.scope.drop.tip = Search everything instead
shell.search.hint.scoped = author, tag, a line you half remember…
shell.search.hint.all = everything — every book, film, quote…
shell.search.aria.scoped = Search what you are looking at
shell.search.aria.all = Search everything
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
common.mono.actions.label = actions
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
search.clear.label = Clear the search
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
bin.title = Bin
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
bin.kind.merge.label = Merged people
bin.kind.merge.plural = Merges
# The retention control. The three windows are counted with the shared day
# format, so only “never” needs a word of its own.
bin.keep-for.label = keep for
bin.retention.aria = How long the bin keeps things
bin.retention.never.label = Never
bin.info.title = Bin
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
checks.title = Checks
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
# --- the character review list (0056). Its own section beside the people one:
# the two tables answer different questions, and a picker for who wrote a book
# must never offer a character.
metadata.characters.title = Characters
metadata.characters.info.body = Every character as a record of its own — the same one across a novel and its adaptation, with a different picture in each. A name appearing twice is something to look at: nothing here was merged by guessing.
metadata.characters.column.works = works
metadata.characters.column.sort = sorts as
metadata.characters.empty = No characters yet. They arrive with a film's cast, or you can add one on a work.
metadata.characters.compact.one = {n} character, {unpaired} in no work
metadata.characters.compact.other = {n} characters, {unpaired} in no work

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
settings.updates.toast.same = Tippani restarted, and it is running the same build — the new image has not been published yet. Try again in a few minutes.
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
# {count} and {held} both arrive already counted, through
# common.count.phrase + unit.entry / unit.quote.

# ---------------------------------------------------------------------------
# STRAY MARKS, AS A TILE. Same shape as the bin above and for the same reason:
# the list is a page of its own (cleanup.*), and the tile draws the page's name
# from there. The tile is the only door — this is a place you are sent when
# something reads oddly, not a place you browse.
# ---------------------------------------------------------------------------
# {count} arrives already counted, through common.count.phrase + unit.quote.

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

# --- the ⋯ at the right of the top bar: everything this screen can do, in one
# place, including the controls also drawn on the page. A menu bar, not an
# overflow — see ScreenMenu.
shell.screen.menu.aria = Everything this screen can do
shell.screen.menu.tip = This screen's actions

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
bin.help.title = Bin

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
checks.help.what-is-here.term = What is here
checks.help.what-is-here.what = The two lists that are waiting on you, on one screen: quotes imported from a file, and quotes something looks odd in.
checks.help.what-is-here.more = Both were pages of their own, reachable only from a tile in Settings — which is where you go to change how the app behaves, not to find out it has been holding forty quotes for a fortnight. The count on the rail and in the ☰ menu is what makes them findable; this screen is where they land.
checks.help.imports.term = Imports waiting
checks.help.imports.what = Nothing you import goes straight into your library. It lands here and stays, for as long as you like, until you approve it.
checks.help.imports.more = That is deliberate and it does not change: a file of a thousand highlights with the wrong book attached is far easier to reject here than to unpick afterwards. Approve a batch, a work, or single rows, and edit anything before you do.
checks.help.marks.term = Marks to look at
checks.help.marks.what = Quotes carrying something that came from the page rather than the writer — a footnote number, a soft hyphen, a doubled space.
checks.help.marks.more = None of it shows on a card and all of it is in the search index, which is why a search for a phrase you can see sometimes finds nothing. This half of the screen never writes: its rows open the work the quote lives in, where it can be edited.
checks.help.not-review.term = Why it is not called Review
checks.help.not-review.what = Review already means the daily quiz and the practice deck, and one word cannot mean two things in one app.
checks.help.not-review.more = A check is something the app noticed and is asking you about. A review is something you asked the app to test you on. Naming both the same would make every mention of either ambiguous.
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
cleanup.bucket.heading = show
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

# ---------------------------------------------------------------------------
# identity.* — the person panel and the character page (0056). THE THREE SCOPES
# ARE THE SCHEMA, and each section's second line is what stops a reader
# believing they renamed an author on thirty-one other books. Those lines are
# not decoration and must not be trimmed to fit.
# ---------------------------------------------------------------------------
identity.person.title = Person
identity.character.title = Character
identity.person.saved = Saved to the record
identity.character.saved = Saved to the record
identity.credit.saved = Saved on {title}

# Scope 1: the credit link, and nothing else.
identity.scope.work.title = on this work
identity.scope.work.body = Changes here touch {title} and no other work.
identity.scope.work.role = Credited as the {role}.
identity.credit.as.label = Printed on this work as
identity.credit.as.hint = Leave it empty to print {name}, the name on the record.
identity.credit.as.on = as {as}

# Scope 2: what the record is in, and what finds it.
identity.scope.library.title = across the library
identity.scope.library.body = Everything this person is on, and every spelling that finds them.
identity.scope.library.character = Every work this character appears in, and every spelling that finds them.
identity.person.credits.title.one = credited on {n} work
identity.person.credits.title.other = credited on {n} works
identity.person.credits.empty = Not credited on anything yet.
identity.person.roles.title.one = played {n} character
identity.person.roles.title.other = played {n} characters
identity.character.appearances.title.one = in {n} work
identity.character.appearances.title.other = in {n} works
identity.character.appearances.empty = In no work yet. It appears once a work's cast points at it.

# Aliases.
identity.links.title = links out
identity.alias.title = also spelled
identity.alias.body = A credit typed any of these ways lands on this record instead of making a second one. Nothing here is ever printed.
identity.alias.none = No other spellings.
identity.alias.add.label = Add
identity.alias.add.placeholder = another spelling…
identity.alias.remove.aria = Remove the spelling {alias}
identity.alias.split.label = split out
identity.alias.split.tip = Give this spelling a record of its own. The works stay here — nothing remembers which of them came from where.
identity.alias.split.done = {alias} has its own record now. Its works stayed where they were.
identity.merge.title = merge another record into this one
identity.merge.body = Two records for one human being become one, and this one — {name} — is what survives.
identity.merge.search.placeholder = find the other record…
identity.merge.hit.works.one = {n} work
identity.merge.hit.works.other = {n} works
identity.merge.confirm.title = Merge {name} into {into}?
identity.merge.confirm.body = {name} stops being a record. Everything it is credited on moves to {into}, and its name becomes a spelling that finds it — so the next import will not make it again.
identity.merge.confirm.covers = No cover changes. Every work goes on printing exactly the name it prints today.
identity.merge.confirm.undo = The bin holds the way back for as long as it holds anything else.
identity.merge.confirm.action = Merge them
identity.merge.done = {name} is part of {into} now

# Scope 3: the record itself.
identity.scope.record.title = the record
identity.scope.record.person = A change here reaches every work this person is on.
identity.scope.record.character = A change here reaches every work this character is in. A picture or a description for one particular work belongs to that work's cast row.
identity.field.sort = Sorts as
identity.field.born = Born
identity.field.died = Died
identity.field.note = Your note
identity.field.description = Description

# The four credited roles, as words. Not unit.*, which is a counted-noun
# namespace and would have to grow a plural nobody prints.
unit.role.author = author
unit.role.translator = translator
unit.role.editor = editor
unit.role.director = director
`,ti=` 	
\r\v\f`;function la(t){let n=0,o=t.length;for(;n<o&&ti.includes(t[n]);)n+=1;for(;o>n&&ti.includes(t[o-1]);)o-=1;return t.slice(n,o)}function Cl(t){const n={},o={},s=new Set,r=[];let i=String(t??"");i.charCodeAt(0)===65279&&(i=i.slice(1)),i=i.replace(/\r\n/g,`
`).replace(/\r/g,`
`);const l=i.split(`
`);for(let h=0;h<l.length;h+=1){const d=la(l[h]);if(d===""||d[0]==="#")continue;const m=d.indexOf("=");if(m<0){r.push(h+1);continue}const p=la(d.slice(0,m));if(p===""){r.push(h+1);continue}const u=la(d.slice(m+1));delete n[p],delete o[p],s.delete(p),u===""?s.add(p):p[0]==="_"?o[p]=u:n[p]=u}return{keys:n,reserved:o,empty:[...s].sort(),bad:r}}const kn=["en","bn"],co={en:Cl(Mh)},as=new Map;function El(t){if(co[t]||!kn.includes(t))return Promise.resolve();if(as.has(t))return as.get(t);const n=Qe(async()=>{const{default:o}=await import("./bn-D0g8ig1U.js");return{default:o}},[]).then(({default:o})=>{co[t]=Cl(o),no=null,ca=new Map,Us()}).catch(()=>{});return as.set(t,n),n}const Lh=()=>Promise.all(kn.map(El)),Ca="en",fn="qps",os="tippani:locale";function ho(t){const n=la(String(t??"")).toLowerCase();return!n||n.length>16?"":/^[a-z0-9-]+$/.test(n)?n:""}let no=null;const Al=()=>(no||(no=new Set(kn.flatMap(t=>{var n;return Object.keys(((n=co[t])==null?void 0:n.keys)||{})}))),no);let Hs={},ni="{}",xt="",Ct=Ca,ta=[Ca],ca=new Map,Cn=null;const ai=new Set,ql=t=>Hs[t]||null,Ml=t=>co[t]||null;function Ll(){const t=[...kn];for(const n of Object.keys(Hs).sort())t.includes(n)||t.push(n);return t.push(fn),t}const zs=t=>Ll().includes(t);function uo(t){var o,s;if(ca.has(t))return ca.get(t);let n;return t===fn?n=Fh():n={...((o=Ml(t))==null?void 0:o.keys)||{},...((s=ql(t))==null?void 0:s.keys)||{}},ca.set(t,n),n}function $s(t){var n,o;return t===fn?{_name:Ws(na([Ca,...kn],"locale.pseudo.name")||"Pseudo")}:{...((n=Ml(t))==null?void 0:n.reserved)||{},...((o=ql(t))==null?void 0:o.reserved)||{}}}function Dh(t){if(t===fn)return[fn];const n=[],o=new Set;let s=t;for(;s&&!o.has(s);)o.add(s),n.push(s),s=ho($s(s)._fallback||""),s&&!zs(s)&&(s="");for(const r of kn)o.has(r)||n.push(r);return n}function na(t,n){for(const o of t){const s=uo(o)[n];if(s)return s}return""}function _h(t,n){return n?t.replace(/\{(\w+)\}/g,(o,s)=>Object.prototype.hasOwnProperty.call(n,s)?String(n[s]):o):t}function Oh(t){try{return new Intl.PluralRules(Ct).select(t)}catch{return t===1?"one":"other"}}function Rh(t){const n=String(t).split(".").pop()||String(t),o=la(n.replace(/[_-]+/g," ").replace(/([a-z0-9])([A-Z])/g,"$1 $2")).toLowerCase();return o?o[0].toUpperCase()+o.slice(1):"…"}function a(t,n){return _h(_l(t,Dl(n)),n)}const Dl=t=>t&&typeof t.count=="number"?t.count:void 0;function _l(t,n){const o=String(t||""),s=n===void 0?na(ta,o):na(ta,`${o}.${Oh(n)}`)||na(ta,`${o}.other`)||na(ta,o);if(s)return s;ai.has(o)||(ai.add(o),console.warn(`tippani: no string for "${o}" in any language`));const r=Rh(o);return Ct===fn?Ws(r):r}function Pe(t,n){const o=_l(t,Dl(n)),s=[],r=/\{(\w+)\}/g;let i=0,l=r.exec(o);for(;l;){l.index>i&&s.push(o.slice(i,l.index));const h=n&&Object.prototype.hasOwnProperty.call(n,l[1]);s.push(h?n[l[1]]:l[0]),i=l.index+l[0].length,l=r.exec(o)}return i<o.length&&s.push(o.slice(i)),s}const Ih={a:"à",b:"ƀ",c:"ç",d:"ð",e:"ë",f:"ƒ",g:"ĝ",h:"ĥ",i:"í",j:"ĵ",k:"ķ",l:"ł",m:"ɱ",n:"ñ",o:"ö",p:"þ",q:"ɋ",r:"ř",s:"š",t:"ţ",u:"ü",v:"ṽ",w:"ŵ",x:"ẋ",y:"ý",z:"ž",A:"À",B:"Ɓ",C:"Ç",D:"Ð",E:"Ë",F:"Ƒ",G:"Ĝ",H:"Ĥ",I:"Í",J:"Ĵ",K:"Ķ",L:"Ł",M:"Ɱ",N:"Ñ",O:"Ö",P:"Þ",Q:"Q",R:"Ř",S:"Š",T:"Ţ",U:"Ü",V:"Ṽ",W:"Ŵ",X:"Ẋ",Y:"Ý",Z:"Ž"},Ph=.3;function Ws(t){const n=String(t??"").split(/(\{\w+\})/g);let o="",s=0;for(const r of n){if(/^\{\w+\}$/.test(r)){o+=r;continue}s+=r.length;for(const i of r)o+=Ih[i]||i}return`⟦${o}${"·".repeat(Math.ceil(s*Ph))}⟧`}function Fh(){if(Cn)return Cn;Cn={};for(const t of Al()){const n=uo("en")[t]||uo("bn")[t]||"";n&&(Cn[t]=Ws(n))}return Cn}function Bh(t){const n=uo(t);let o=0;const s=Al();for(const r of s)n[r]&&(o+=1);return Hh(o,s.size)}function Hh(t,n){return!n||t>=n?100:Math.min(99,Math.floor(t*100/n))}function bs(t){return $s(t)._name||t}function ys(t){return $s(t)._dir==="rtl"?"rtl":"ltr"}function zh(){const t=Ll().filter(o=>o!==fn),n=new Map;for(const o of t){const s=bs(o).trim().toLowerCase();n.set(s,(n.get(s)||0)+1)}return t.map(o=>{const s=bs(o),r=(n.get(s.trim().toLowerCase())||0)>1;return{code:o,name:r&&s!==o?a("locale.picker.disambiguate",{name:s,code:o}):s,dir:ys(o),percent:Bh(o),builtin:kn.includes(o)}})}const mo=()=>Ct,$h=()=>xt&&!zs(xt)?xt:"";function Wh(){ca=new Map,Cn=null}function Us(){if(Ct=zs(xt)?xt:Ca,ta=Dh(Ct),typeof document<"u"&&document.documentElement){const t=document.documentElement;t.lang=Ct,t.dir=ys(Ct),t.dataset.localePref=xt}typeof window<"u"&&typeof window.dispatchEvent=="function"&&typeof CustomEvent=="function"&&window.dispatchEvent(new CustomEvent("tippani:locale",{detail:{active:Ct,pref:xt,dir:ys(Ct)}}))}function Gs(t){if(t===void 0){let n=null;try{n=localStorage.getItem(os)}catch{n=null}xt=ho(n)}else{xt=ho(t);try{xt?localStorage.setItem(os,xt):localStorage.removeItem(os)}catch{}}Us()}function Uh(t){const n=t||{},o=JSON.stringify(n);if(o===ni)return!1;ni=o;const s={};for(const[r,i]of Object.entries(n)){const l=ho(r);!l||!i||(s[l]={keys:i.keys||{},reserved:i.reserved||{},empty:i.empty||[],bad:i.bad||[]})}return Hs=s,Wh(),Us(),!0}async function Gh(){const t=await Z("GET","/locales");return!t.ok||!t.data?!1:Uh(t.data.files)}function Ol(){const[,t]=c.useState(0);return c.useEffect(()=>{const n=()=>t(o=>o+1);return window.addEventListener("tippani:locale",n),()=>window.removeEventListener("tippani:locale",n)},[]),Ct}const Rl="/api",jt=t=>t&&t.startsWith("/")?Rl+t:t,Il=!1,Ue=t=>t?String(t).startsWith("data:")?t:`${Rl}/covers/${t}`:"";async function Vh(t){let n=null;try{n=await t.json()}catch{}return{ok:t.ok,status:t.status,data:n}}async function Pl(t,n){let o;try{o=await fetch(jt(t),n)}catch{return{ok:!1,status:0,data:null}}return Vh(o)}async function Z(t,n,o){const s={method:t};return o!==void 0&&(s.headers={"Content-Type":"application/json"},s.body=JSON.stringify(o)),Pl(n,s)}async function Ea(t,n){const o=new FormData;return o.append("file",n),Pl(t,{method:"POST",body:o})}function Fl(t,n,o){return new Promise(s=>{const r=new XMLHttpRequest;r.open("POST",jt(t)),r.upload.onprogress=i=>{o&&i.lengthComputable&&o(i.loaded/i.total)},r.upload.onload=()=>o&&o(1),r.onload=()=>{let i=null;try{i=JSON.parse(r.responseText)}catch{}s({ok:r.status>=200&&r.status<300,status:r.status,data:i})},r.onerror=()=>s({ok:!1,status:0,data:null}),r.send(n)})}async function Vs(t,n,o){const s=await fetch(jt(t),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(n)});if(!s.ok)return!1;const r=await s.blob(),i=URL.createObjectURL(r),l=document.createElement("a");return l.href=i,l.download=o,document.body.appendChild(l),l.click(),l.remove(),setTimeout(()=>URL.revokeObjectURL(i),6e4),!0}function le(t,n){return t.data&&t.data.error||n||a("error.generic")}async function Bl(t){var n;try{if((n=navigator.clipboard)!=null&&n.writeText)return await navigator.clipboard.writeText(t),!0}catch{}try{const o=document.createElement("textarea");o.value=t,o.setAttribute("readonly",""),o.style.position="fixed",o.style.top="-1000px",o.style.opacity="0",document.body.appendChild(o),o.select(),o.setSelectionRange(0,o.value.length);const s=document.execCommand("copy");return o.remove(),s}catch{return!1}}function oi(t,n){const o=t.length,s=n.length;if(!o)return s;if(!s)return o;const r=Array.from({length:o+1},(i,l)=>l);for(let i=1;i<=s;i++){let l=r[0];r[0]=i;for(let h=1;h<=o;h++){const d=r[h];r[h]=t[h-1]===n[i-1]?l:1+Math.min(l,r[h],r[h-1]),l=d}}return r[o]}function si(t){return(t||"").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g,"").normalize("NFC").trim()}function Kh(t){return t<3?0:t<=5?1:2}function xn(t){return(t==null?void 0:t.season)==null?"":t.episode==null?`S${t.season}`:`S${t.season}E${t.episode}`}function gn(t){const n=Number(t==null?void 0:t.chapter_no)||0,o=((t==null?void 0:t.chapter)||"").trim();return n?o?`${n} · ${o}`:String(n):o}function Ks(t){const n=gn(t);return n?Number(t==null?void 0:t.chapter_no)?`CH. ${n}`:n:""}function Yh(t=new Date){const n=t.getHours();return n<5?"latenight":n<8?"dawn":n<12?"morning":n<17?"afternoon":n<21?"evening":"night"}function Qh(t=new Date){const n=t.getDay();return n===0||n===6}function Zh(){try{return Intl.DateTimeFormat().resolvedOptions().timeZone||""}catch{return""}}const Xh=new Map([["Asia/Dubai","AE"],["America/Buenos_Aires","AR"],["Europe/Vienna","AT"],["Antarctica/Macquarie","AU"],["Asia/Dhaka","BD"],["Asia/Dacca","BD"],["Europe/Brussels","BE"],["America/Sao_Paulo","BR"],["America/Bahia","BR"],["America/Fortaleza","BR"],["America/Recife","BR"],["America/Maceio","BR"],["America/Araguaina","BR"],["America/Belem","BR"],["America/Santarem","BR"],["America/Noronha","BR"],["America/Manaus","BR"],["America/Cuiaba","BR"],["America/Campo_Grande","BR"],["America/Porto_Velho","BR"],["America/Boa_Vista","BR"],["America/Rio_Branco","BR"],["America/Eirunepe","BR"],["Asia/Thimphu","BT"],["Asia/Thimbu","BT"],["America/Toronto","CA"],["America/Vancouver","CA"],["America/Edmonton","CA"],["America/Winnipeg","CA"],["America/Halifax","CA"],["America/St_Johns","CA"],["America/Regina","CA"],["America/Moncton","CA"],["America/Goose_Bay","CA"],["America/Glace_Bay","CA"],["America/Blanc-Sablon","CA"],["America/Whitehorse","CA"],["America/Dawson","CA"],["America/Iqaluit","CA"],["America/Resolute","CA"],["America/Rankin_Inlet","CA"],["America/Cambridge_Bay","CA"],["America/Inuvik","CA"],["America/Fort_Nelson","CA"],["America/Dawson_Creek","CA"],["America/Creston","CA"],["America/Swift_Current","CA"],["America/Atikokan","CA"],["Europe/Zurich","CH"],["America/Santiago","CL"],["America/Punta_Arenas","CL"],["Pacific/Easter","CL"],["Asia/Shanghai","CN"],["Asia/Urumqi","CN"],["Asia/Chongqing","CN"],["Asia/Harbin","CN"],["Asia/Kashgar","CN"],["America/Bogota","CO"],["Europe/Prague","CZ"],["Europe/Berlin","DE"],["Europe/Busingen","DE"],["Africa/Cairo","EG"],["Europe/Madrid","ES"],["Africa/Ceuta","ES"],["Atlantic/Canary","ES"],["Europe/Helsinki","FI"],["Europe/Mariehamn","FI"],["Europe/Paris","FR"],["Europe/London","GB"],["Europe/Belfast","GB"],["Africa/Accra","GH"],["Europe/Athens","GR"],["Asia/Hong_Kong","HK"],["Europe/Budapest","HU"],["Asia/Jakarta","ID"],["Asia/Pontianak","ID"],["Asia/Makassar","ID"],["Asia/Jayapura","ID"],["Europe/Dublin","IE"],["Asia/Kolkata","IN"],["Asia/Calcutta","IN"],["Europe/Rome","IT"],["Asia/Tokyo","JP"],["Africa/Nairobi","KE"],["Asia/Seoul","KR"],["Asia/Colombo","LK"],["Africa/Casablanca","MA"],["Indian/Maldives","MV"],["America/Mexico_City","MX"],["America/Cancun","MX"],["America/Merida","MX"],["America/Monterrey","MX"],["America/Matamoros","MX"],["America/Chihuahua","MX"],["America/Ciudad_Juarez","MX"],["America/Ojinaga","MX"],["America/Mazatlan","MX"],["America/Bahia_Banderas","MX"],["America/Hermosillo","MX"],["America/Tijuana","MX"],["Asia/Kuala_Lumpur","MY"],["Asia/Kuching","MY"],["Africa/Lagos","NG"],["Europe/Amsterdam","NL"],["Europe/Oslo","NO"],["Arctic/Longyearbyen","NO"],["Pacific/Auckland","NZ"],["Pacific/Chatham","NZ"],["America/Lima","PE"],["Asia/Manila","PH"],["Asia/Karachi","PK"],["Europe/Warsaw","PL"],["Europe/Lisbon","PT"],["Atlantic/Madeira","PT"],["Atlantic/Azores","PT"],["Europe/Bucharest","RO"],["Asia/Riyadh","SA"],["Europe/Stockholm","SE"],["Asia/Singapore","SG"],["Asia/Bangkok","TH"],["Europe/Istanbul","TR"],["Asia/Istanbul","TR"],["Asia/Taipei","TW"],["Europe/Kyiv","UA"],["Europe/Simferopol","UA"],["Europe/Uzhgorod","UA"],["Europe/Zaporozhye","UA"],["America/New_York","US"],["America/Chicago","US"],["America/Denver","US"],["America/Los_Angeles","US"],["America/Anchorage","US"],["America/Phoenix","US"],["America/Detroit","US"],["America/Boise","US"],["America/Juneau","US"],["America/Sitka","US"],["America/Nome","US"],["America/Yakutat","US"],["America/Metlakatla","US"],["America/Menominee","US"],["America/Adak","US"],["Pacific/Honolulu","US"],["America/Montevideo","UY"],["America/Caracas","VE"],["Asia/Ho_Chi_Minh","VN"],["Asia/Saigon","VN"],["Africa/Johannesburg","ZA"]]),Jh=[["Australia/","AU"],["America/Argentina/","AR"],["America/Indiana/","US"],["America/Kentucky/","US"],["America/North_Dakota/","US"]];function Hl(t=Zh()){const n=Xh.get(t);if(n)return n;for(const[o,s]of Jh)if(t.startsWith(o))return s;return""}const eu=[{md:"01-25",regions:["EG"],greetings:["greeting.holiday.eg.01-25.1"]},{md:"01-26",regions:["AU"],greetings:["greeting.holiday.au.01-26.1"]},{md:"01-26",regions:["IN"],greetings:["greeting.holiday.in.01-26.1"]},{md:"02-04",regions:["LK"],greetings:["greeting.holiday.lk.02-04.1"]},{md:"02-06",regions:["NZ"],greetings:["greeting.holiday.nz.02-06.1"]},{md:"02-11",regions:["JP"],greetings:["greeting.holiday.jp.02-11.1"]},{md:"02-21",regions:["BD"],greetings:["greeting.holiday.bd.02-21.1","greeting.holiday.bd.02-21.2"]},{md:"02-22",regions:["SA"],greetings:["greeting.holiday.sa.02-22.1"]},{md:"03-01",regions:["KR"],greetings:["greeting.holiday.kr.03-01.1"]},{md:"03-06",regions:["GH"],greetings:["greeting.holiday.gh.03-06.1"]},{md:"03-15",regions:["HU"],greetings:["greeting.holiday.hu.03-15.1"]},{md:"03-17",regions:["IE"],greetings:["greeting.holiday.ie.03-17.1"]},{md:"03-23",regions:["PK"],greetings:["greeting.holiday.pk.03-23.1"]},{md:"03-25",regions:["GR"],greetings:["greeting.holiday.gr.03-25.1"]},{md:"03-26",regions:["BD"],greetings:["greeting.holiday.bd.03-26.1"]},{md:"04-13",regions:["TH"],greetings:["greeting.holiday.th.04-13.1"]},{md:"04-14",regions:["IN","BD"],greetings:["greeting.holiday.in.04-14.1","greeting.holiday.in.04-14.2"]},{md:"04-15",regions:["IN"],greetings:["greeting.holiday.in.04-15.1","greeting.holiday.in.04-15.2"]},{md:"04-19",regions:["VE"],greetings:["greeting.holiday.ve.04-19.1"]},{md:"04-23",regions:["TR"],greetings:["greeting.holiday.tr.04-23.1"]},{md:"04-25",regions:["AU","NZ"],greetings:["greeting.holiday.au.04-25.1"]},{md:"04-25",regions:["IT"],greetings:["greeting.holiday.it.04-25.1"]},{md:"04-25",regions:["EG"],greetings:["greeting.holiday.eg.04-25.1"]},{md:"04-27",regions:["ZA"],greetings:["greeting.holiday.za.04-27.1"]},{md:"04-30",regions:["VN"],greetings:["greeting.holiday.vn.04-30.1"]},{md:"05-03",regions:["PL"],greetings:["greeting.holiday.pl.05-03.1"]},{md:"05-03",regions:["JP"],greetings:["greeting.holiday.jp.05-03.1"]},{md:"05-05",regions:["NL"],greetings:["greeting.holiday.nl.05-05.1"]},{md:"05-05",regions:["JP"],greetings:["greeting.holiday.jp.05-05.1"]},{md:"05-17",regions:["NO"],greetings:["greeting.holiday.no.05-17.1"]},{md:"05-25",regions:["AR"],greetings:["greeting.holiday.ar.05-25.1"]},{md:"06-01",regions:["KE"],greetings:["greeting.holiday.ke.06-01.1"]},{md:"06-01",regions:["ID"],greetings:["greeting.holiday.id.06-01.1"]},{md:"06-02",regions:["IT"],greetings:["greeting.holiday.it.06-02.1"]},{md:"06-06",regions:["SE"],greetings:["greeting.holiday.se.06-06.1"]},{md:"06-10",regions:["PT"],greetings:["greeting.holiday.pt.06-10.1"]},{md:"06-12",regions:["PH"],greetings:["greeting.holiday.ph.06-12.1"]},{md:"06-12",regions:["NG"],greetings:["greeting.holiday.ng.06-12.1"]},{md:"06-16",regions:["ZA"],greetings:["greeting.holiday.za.06-16.1"]},{md:"06-19",regions:["US"],greetings:["greeting.holiday.us.06-19.1"]},{md:"06-28",regions:["UA"],greetings:["greeting.holiday.ua.06-28.1"]},{md:"07-01",regions:["CA"],greetings:["greeting.holiday.ca.07-01.1"]},{md:"07-01",regions:["HK"],greetings:["greeting.holiday.hk.07-01.1"]},{md:"07-04",regions:["US"],greetings:["greeting.holiday.us.07-04.1","greeting.holiday.us.07-04.2"]},{md:"07-05",regions:["VE"],greetings:["greeting.holiday.ve.07-05.1"]},{md:"07-09",regions:["AR"],greetings:["greeting.holiday.ar.07-09.1"]},{md:"07-14",regions:["FR"],greetings:["greeting.holiday.fr.07-14.1"]},{md:"07-18",regions:["UY"],greetings:["greeting.holiday.uy.07-18.1"]},{md:"07-20",regions:["CO"],greetings:["greeting.holiday.co.07-20.1"]},{md:"07-21",regions:["BE"],greetings:["greeting.holiday.be.07-21.1"]},{md:"07-23",regions:["EG"],greetings:["greeting.holiday.eg.07-23.1"]},{md:"07-24",regions:["VE"],greetings:["greeting.holiday.ve.07-24.1"]},{md:"07-26",regions:["MV"],greetings:["greeting.holiday.mv.07-26.1"]},{md:"07-28",regions:["PE"],greetings:["greeting.holiday.pe.07-28.1"]},{md:"07-29",regions:["PE"],greetings:["greeting.holiday.pe.07-29.1"]},{md:"08-01",regions:["CH"],greetings:["greeting.holiday.ch.08-01.1"]},{md:"08-07",regions:["CO"],greetings:["greeting.holiday.co.08-07.1"]},{md:"08-09",regions:["SG"],greetings:["greeting.holiday.sg.08-09.1"]},{md:"08-14",regions:["PK"],greetings:["greeting.holiday.pk.08-14.1"]},{md:"08-15",regions:["KR"],greetings:["greeting.holiday.kr.08-15.1"]},{md:"08-15",regions:["IN"],greetings:["greeting.holiday.in.08-15.1"]},{md:"08-17",regions:["ID"],greetings:["greeting.holiday.id.08-17.1"]},{md:"08-20",regions:["HU"],greetings:["greeting.holiday.hu.08-20.1"]},{md:"08-24",regions:["UA"],greetings:["greeting.holiday.ua.08-24.1"]},{md:"08-25",regions:["UY"],greetings:["greeting.holiday.uy.08-25.1"]},{md:"08-30",regions:["TR"],greetings:["greeting.holiday.tr.08-30.1"]},{md:"08-31",regions:["MY"],greetings:["greeting.holiday.my.08-31.1"]},{md:"09-02",regions:["VN"],greetings:["greeting.holiday.vn.09-02.1"]},{md:"09-07",regions:["BR"],greetings:["greeting.holiday.br.09-07.1"]},{md:"09-16",regions:["MX"],greetings:["greeting.holiday.mx.09-16.1"]},{md:"09-16",regions:["MY"],greetings:["greeting.holiday.my.09-16.1"]},{md:"09-18",regions:["CL"],greetings:["greeting.holiday.cl.09-18.1"]},{md:"09-19",regions:["CL"],greetings:["greeting.holiday.cl.09-19.1"]},{md:"09-21",regions:["GH"],greetings:["greeting.holiday.gh.09-21.1"]},{md:"09-23",regions:["SA"],greetings:["greeting.holiday.sa.09-23.1"]},{md:"09-24",regions:["ZA"],greetings:["greeting.holiday.za.09-24.1"]},{md:"09-28",regions:["CZ"],greetings:["greeting.holiday.cz.09-28.1"]},{md:"09-30",regions:["CA"],greetings:["greeting.holiday.ca.09-30.1"]},{md:"10-01",regions:["NG"],greetings:["greeting.holiday.ng.10-01.1"]},{md:"10-01",regions:["CN","HK"],greetings:["greeting.holiday.cn.10-01.1"]},{md:"10-02",regions:["IN"],greetings:["greeting.holiday.in.10-02.1"]},{md:"10-03",regions:["KR"],greetings:["greeting.holiday.kr.10-03.1"]},{md:"10-03",regions:["DE"],greetings:["greeting.holiday.de.10-03.1"]},{md:"10-05",regions:["PT"],greetings:["greeting.holiday.pt.10-05.1"]},{md:"10-10",regions:["TW"],greetings:["greeting.holiday.tw.10-10.1"]},{md:"10-12",regions:["ES"],greetings:["greeting.holiday.es.10-12.1"]},{md:"10-20",regions:["KE"],greetings:["greeting.holiday.ke.10-20.1"]},{md:"10-23",regions:["HU"],greetings:["greeting.holiday.hu.10-23.1"]},{md:"10-26",regions:["AT"],greetings:["greeting.holiday.at.10-26.1"]},{md:"10-28",regions:["CZ"],greetings:["greeting.holiday.cz.10-28.1"]},{md:"10-28",regions:["GR"],greetings:["greeting.holiday.gr.10-28.1"]},{md:"10-29",regions:["TR"],greetings:["greeting.holiday.tr.10-29.1"]},{md:"11-02",regions:["MX"],greetings:["greeting.holiday.mx.11-02.1"]},{md:"11-03",regions:["MV"],greetings:["greeting.holiday.mv.11-03.1"]},{md:"11-05",regions:["GB"],greetings:["greeting.holiday.gb.11-05.1"]},{md:"11-06",regions:["MA"],greetings:["greeting.holiday.ma.11-06.1"]},{md:"11-11",regions:["FR"],greetings:["greeting.holiday.fr.11-11.1"]},{md:"11-11",regions:["PL"],greetings:["greeting.holiday.pl.11-11.1"]},{md:"11-11",regions:["AU","CA","GB"],greetings:["greeting.holiday.au.11-11.1"]},{md:"11-11",regions:["MV"],greetings:["greeting.holiday.mv.11-11.1"]},{md:"11-11",regions:["US"],greetings:["greeting.holiday.us.11-11.1"]},{md:"11-15",regions:["BR"],greetings:["greeting.holiday.br.11-15.1"]},{md:"11-18",regions:["MA"],greetings:["greeting.holiday.ma.11-18.1"]},{md:"12-01",regions:["RO"],greetings:["greeting.holiday.ro.12-01.1"]},{md:"12-01",regions:["PT"],greetings:["greeting.holiday.pt.12-01.1"]},{md:"12-02",regions:["AE"],greetings:["greeting.holiday.ae.12-02.1"]},{md:"12-05",regions:["TH"],greetings:["greeting.holiday.th.12-05.1"]},{md:"12-06",regions:["ES"],greetings:["greeting.holiday.es.12-06.1"]},{md:"12-06",regions:["FI"],greetings:["greeting.holiday.fi.12-06.1"]},{md:"12-12",regions:["KE"],greetings:["greeting.holiday.ke.12-12.1"]},{md:"12-16",regions:["BD"],greetings:["greeting.holiday.bd.12-16.1"]},{md:"12-17",regions:["BT"],greetings:["greeting.holiday.bt.12-17.1"]},{md:"12-25",regions:["PK"],greetings:["greeting.holiday.pk.12-25.1"]}],tu=[{md:"01-01",greetings:["greeting.holiday.intl.01-01.1","greeting.holiday.intl.01-01.2","greeting.holiday.intl.01-01.3"]},{md:"02-14",greetings:["greeting.holiday.intl.02-14.1","greeting.holiday.intl.02-14.2"]},{md:"04-23",greetings:["greeting.holiday.intl.04-23.1","greeting.holiday.intl.04-23.2"]},{md:"10-31",greetings:["greeting.holiday.intl.10-31.1","greeting.holiday.intl.10-31.2"]},{md:"12-24",greetings:["greeting.holiday.intl.12-24.1"]},{md:"12-25",greetings:["greeting.holiday.intl.12-25.1","greeting.holiday.intl.12-25.2"]},{md:"12-31",greetings:["greeting.holiday.intl.12-31.1","greeting.holiday.intl.12-31.2"]}];function nu(t){const n=t%19,o=Math.floor(t/100),s=t%100,r=Math.floor(o/4),i=o%4,l=Math.floor((o+8)/25),h=Math.floor((o-l+1)/3),d=(19*n+o-r-h+15)%30,m=Math.floor(s/4),p=s%4,u=(32+2*i+2*m-d-p)%7,f=Math.floor((n+11*d+22*u)/451),b=Math.floor((d+u-7*f+114)/31),w=(d+u-7*f+114)%31+1;return new Date(t,b-1,w)}function ri(t,n,o,s){const r=new Date(t,n,1),i=(o-r.getDay()+7)%7;return new Date(t,n,1+i+(s-1)*7)}const Ua=(t,n)=>t.getFullYear()===n.getFullYear()&&t.getMonth()===n.getMonth()&&t.getDate()===n.getDate(),ii=t=>String(t).padStart(2,"0");function au(t=new Date,n=Hl()){const o=`${ii(t.getMonth()+1)}-${ii(t.getDate())}`;if(n){for(const i of eu)if(i.md===o&&i.regions.includes(n))return i.greetings}for(const i of tu)if(i.md===o)return i.greetings;const s=nu(t.getFullYear());if(Ua(t,s))return["greeting.holiday.easter"];const r=new Date(s);return r.setDate(s.getDate()-2),Ua(t,r)?["greeting.holiday.good-friday"]:n==="US"&&Ua(t,ri(t.getFullYear(),10,4,4))?["greeting.holiday.thanksgiving.us"]:n==="CA"&&Ua(t,ri(t.getFullYear(),9,1,2))?["greeting.holiday.thanksgiving.ca"]:null}const li={latenight:["greeting.bucket.latenight.1","greeting.bucket.latenight.2","greeting.bucket.latenight.3","greeting.bucket.latenight.4","greeting.bucket.latenight.5"],dawn:["greeting.bucket.dawn.1","greeting.bucket.dawn.2","greeting.bucket.dawn.3","greeting.bucket.dawn.4"],morning:["greeting.bucket.morning.1","greeting.bucket.morning.2","greeting.bucket.morning.3","greeting.bucket.morning.4","greeting.bucket.morning.5"],afternoon:["greeting.bucket.afternoon.1","greeting.bucket.afternoon.2","greeting.bucket.afternoon.3","greeting.bucket.afternoon.4"],evening:["greeting.bucket.evening.1","greeting.bucket.evening.2","greeting.bucket.evening.3","greeting.bucket.evening.4"],night:["greeting.bucket.night.1","greeting.bucket.night.2","greeting.bucket.night.3","greeting.bucket.night.4"]},ou={dawn:["greeting.weekend.dawn.1","greeting.weekend.dawn.2"],morning:["greeting.weekend.morning.1","greeting.weekend.morning.2","greeting.weekend.morning.3","greeting.weekend.morning.4"],afternoon:["greeting.weekend.afternoon.1","greeting.weekend.afternoon.2","greeting.weekend.afternoon.3"],evening:["greeting.weekend.evening.1","greeting.weekend.evening.2","greeting.weekend.evening.3"],night:["greeting.weekend.night.1","greeting.weekend.night.2"]},su=["greeting.sunday.1","greeting.sunday.2","greeting.sunday.3"],ru=t=>t[Math.floor(Math.random()*t.length)];function iu(t,n=new Date,o=Hl()){const s=(t||"").trim()||a("greeting.name-fallback"),r=Yh(n);let i=li[r]||li.morning;const l=au(n,o);if(l)i=l;else if(Qh(n)&&r!=="latenight"){const h=n.getDay()===0&&r==="morning"?su:ou[r];h!=null&&h.length&&(i=h)}return a(ru(i),{name:s})}function lu(t=new Date){const n=t.toLocaleDateString(void 0,{weekday:"long"}),o=t.toLocaleDateString(void 0,{month:"long",day:"numeric",year:"numeric"});return a("greeting.dateline.format",{weekday:n,date:o})}const po={terracotta:"#B4482D",ochre:"#C8992B",olive:"#3F7D5A",slate:"#2F6D8F"},Ys={light:{bg:"#F4EDDE",raised:"#FBF6EA",card:"#FFFEF9","card-top":"#FFFFFC","card-bottom":"#FCF8ED","topbar-top":"#F3EBDB","topbar-bottom":"#EDE3D1",ink:"#221C16",soft:"#6A5F50",faint:"#8A7C68",line:"#E4DAC7","ink-border":"rgba(41,38,29,.6)","frame-border":"rgba(41,38,29,.35)",amber:"#BE8A4E",note:"#221C16",error:"#A93B26",ok:"#3E8E5A",strip:"#E9E1CC",holes:"#F7F2E6","holes-border":"#D3C7AB","holes-glow":"none",sh:"41,38,29","bevel-hi":"rgba(255,255,255,.75)","bevel-mid":"rgba(255,255,255,.35)"},dark:{bg:"#262019",raised:"#2A231C",card:"#2F2820","card-top":"#352D23","card-bottom":"#2C251E","topbar-top":"#2B241C","topbar-bottom":"#241E17",ink:"#EFE6D4",soft:"#B3A48C",faint:"#9A8C74",line:"#453B2D","ink-border":"rgba(239,230,212,.4)","frame-border":"rgba(214,162,92,.3)",amber:"#D6A25C",note:"#E8DCC2",error:"#C96B5B",ok:"#5FB47E",strip:"#1C1710",holes:"rgba(239,230,212,.4)","holes-border":"transparent","holes-glow":"none",sh:"0,0,0","bevel-hi":"rgba(255,255,255,.07)","bevel-mid":"rgba(255,255,255,.05)"}},Xt={flat:["flat",0,0,0],paper:["paper",220,71,.1],linen:["linen",340,109,.11],cotton:["cotton",300,97,.12],canvas:["canvas",400,129,.1],denim:["denim",320,103,.12],wool:["wool",360,113,.12],wood:["wood",300,97,.12],metal:["metal",260,84,.09],brushed:["brushed",240,78,.08],matte:["matte",200,65,.07],satin:["satin",210,68,.07],glass:["glass",280,90,.06],"glass-soft":["glass-soft",280,90,.12],rubber:["rubber-flat",230,74,.1],fabric:["fabric",260,84,.11],walnut:["walnut",300,97,.09],pine:["pine",340,109,.09],marble:["marble",360,116,.08],granite:["granite",280,90,.08],sandstone:["sandstone",300,97,.09],concrete:["concrete",320,103,.08],cardboard:["cardboard",280,90,.1],"paper-photo":["paper-photo",300,97,.07],leather:["leather-004",260,84,.1],"leather-suede":["leather-021",240,78,.11],"leather-pebbled":["leather-034d",280,90,.09],"leather-tooled":["leather-037",320,103,.06]},qt={manuscript:["linen","paper","paper","wood"],"film-assembly":["metal","brushed","matte","glass"],office:["glass","rubber","satin","metal"],school:["wood","rubber","paper","cotton"],atelier:["canvas","denim","cotton","wool"],bindery:["concrete","leather-suede","paper-photo","leather-pebbled"],quarry:["sandstone","granite","satin","marble"],atrium:["flat","flat","flat","flat"]},Gn="manuscript",cu={manuscript:"settings.material.manuscript.label","film-assembly":"settings.material.film-assembly.label",office:"settings.material.office.label",school:"settings.material.school.label",atelier:"settings.material.atelier.label",bindery:"settings.material.bindery.label",quarry:"settings.material.quarry.label",atrium:"settings.material.atrium.label"},du=new Set(["glass","glass-soft"]),hu=new Set(["flat"]),uu=new Set(["metal","brushed"]);function zl(t,n){return`color-mix(in srgb, ${t} ${((1-n)*100).toFixed(1)}%, transparent)`}function mu(t,n,o,s,r,i){const l=zl(t,r),h=i?.16:.55,d=i?.04:.12;return{color:`color-mix(in srgb, ${t} ${i?34:24}%, transparent)`,image:`linear-gradient(124deg, rgba(255,255,255,${h}) 0%, rgba(255,255,255,0) 34%, rgba(255,255,255,0) 64%, rgba(255,255,255,${d}) 100%), linear-gradient(${l}, ${l}), var(--tile-${n}), var(--tile-${n})`,size:`auto, auto, ${o}px ${o}px, ${s}px ${s}px`,blend:"normal, normal, overlay, normal",blur:"blur(18px) saturate(1.5)",border:i?"rgba(255,255,255,.15)":"rgba(255,255,255,.6)",inset:`inset 0 1px 0 ${i?"rgba(255,255,255,.1)":"rgba(255,255,255,.7)"}, inset 0 -10px 16px -12px rgba(255,255,255,${i?.06:.3})`}}function $l(t,n,o,s){const[r,i,l,h]=Xt[n]||Xt.paper;if(hu.has(r))return{color:t,image:"none",size:"auto",blend:"normal",blur:"none",border:"transparent",inset:"none"};if(du.has(r))return mu(t,r,i,l,h,o);const d=zl(t,h),m=[],p=[],u=[];return uu.has(r)&&(m.push(`linear-gradient(126deg, color-mix(in oklab, ${s}, transparent 84%) 0%, transparent 40%, transparent 60%, color-mix(in oklab, ${s}, transparent 90%) 100%)`),p.push("auto"),u.push("soft-light")),m.push(`linear-gradient(${d}, ${d})`,`var(--tile-${r})`,`var(--tile-${r})`),p.push("auto",`${i}px ${i}px`,`${l}px ${l}px`),u.push("normal","overlay","normal"),{color:t,image:m.join(", "),size:p.join(", "),blend:u.join(", "),blur:"none",border:"transparent",inset:"none"}}const Wl={ground:"bg",shell:"topbar-top",card:"card",cover:"raised"},fa=["ground","shell","card","cover"];Object.keys(Xt).filter(t=>t!=="flat");function pu(t){var o;if(typeof getComputedStyle!="function"||typeof document>"u")return"";const n=getComputedStyle(document.documentElement).getPropertyValue(`--tile-${t}`).trim();return((o=/url\((['"]?)([^)'"]+)\1\)/.exec(n))==null?void 0:o[2])||""}function Ul(t,n,o){const s=qt[t]||qt[Gn],r=fa.indexOf(n),i=Xt[o]?o:s[r<0?2:r],[l,h,d,m]=Xt[i];return{name:i,file:l,coarse:h,fine:d,strength:m,url:pu(l)}}function sv(t,n,o,s,r){const i=qt[t]||qt[Gn],l=Ys[o?"dark":"light"],h=s||po.terracotta,d=Gl(h)>.32,m=o&&!d?`color-mix(in oklab, ${h}, white 20%)`:h,p=fa.indexOf(n),u=$l(l[Wl[n]||"card"],i[p<0?2:p],o,m);return{backgroundColor:u.color,backgroundImage:u.image,backgroundSize:u.size,backgroundBlendMode:u.blend,backdropFilter:u.blur==="none"?void 0:u.blur,boxShadow:u.inset==="none"?void 0:u.inset}}function Gl(t){const n=/^#?([0-9a-f]{6})$/i.exec(t||"");if(!n)return .3;const o=parseInt(n[1],16),s=[o>>16&255,o>>8&255,o&255].map(r=>{const i=r/255;return i<=.04045?i/12.92:((i+.055)/1.055)**2.4});return .2126*s[0]+.7152*s[1]+.0722*s[2]}let ft={materialSet:void 0,theme:"system",accent:"terracotta"};const Vl=window.matchMedia("(prefers-color-scheme: dark)");Vl.addEventListener("change",()=>{ft.theme!=="light"&&ft.theme!=="dark"&&Ql()});const fu="tippani:labels";let da="auto";const Kl=window.matchMedia("(max-width: 768px)");Kl.addEventListener("change",Yl);function gu(t){let n=t;if(n===void 0)try{n=JSON.parse(localStorage.getItem(fu))}catch{n=null}da=n==="on"||n==="off"?n:"auto",Yl()}function Yl(){const t=da==="auto"?!Kl.matches:da==="on";document.documentElement.dataset.labels=t?"on":"off",document.documentElement.dataset.labelsMode=da}function rv(){return da}function Oo(t={}){const{materialSet:n,theme:o,accent:s}=t;ft={materialSet:n,theme:o||"system",accent:s||"terracotta",tiles:fa.map(r=>{const i=t["tile"+r[0].toUpperCase()+r.slice(1)];return Xt[i]?i:""})},Ql()}function iv(){const n=document.documentElement.dataset.matSet;return{materialSet:qt[n]?n:Gn,theme:ft.theme||"system",accent:ft.accent||"terracotta",tiles:(ft.tiles||["","","",""]).slice()}}function bu(t,n){const o=Ys[t?"dark":"light"];return{dark:!!t,bg:o.bg,cardTop:o["card-top"],cardBottom:o["card-bottom"],ink:o.ink,soft:o.soft,faint:o.faint,line:o.line,accent:n||po.terracotta,inkBorder:o["ink-border"]}}function Ql(){const t=ft.theme==="dark"||ft.theme!=="light"&&Vl.matches,n=qt[ft.materialSet]?ft.materialSet:Gn,o=document.documentElement;o.dataset.matSet=n,o.dataset.theme=t?"dark":"light";const s=Ys[t?"dark":"light"];for(const[m,p]of Object.entries(s))o.style.setProperty("--"+m,p);const r=po[ft.accent]||po.terracotta,i=Gl(r)>.32,l=t&&!i?`color-mix(in oklab, ${r}, white 20%)`:r;o.style.setProperty("--accent",r),o.style.setProperty("--accent-dark",`color-mix(in oklab, ${r}, white 20%)`),o.style.setProperty("--accent-ui",l),o.style.setProperty("--on-accent",i?"#221C16":"#FBF6EA");const h=qt[n].map((m,p)=>(ft.tiles||[])[p]||m);for(const[m,p]of fa.entries()){const u=$l(s[Wl[p]],h[m],t,l);for(const[f,b]of Object.entries(u))o.style.setProperty(`--surf-${p}-${f}`,b);o.style.setProperty(`--tile-${p}`,`var(--tile-${Xt[h[m]][0]})`)}const d=h[fa.indexOf("shell")];o.style.setProperty("--sel-veil",`${((1-Xt[d][3])*100).toFixed(1)}%`),window.dispatchEvent(new CustomEvent("tippani:theme",{detail:{materialSet:n,dark:t}}))}const St=["yellow","blue","pink","orange","green","purple"],Ro=["#E5C355","#7FA6C9","#D98CA6","#DF9A5B","#7CB342","#8A7BC8"],fo=["","vocab.category.blue.label","vocab.category.pink.label","vocab.category.orange.label","vocab.category.green.label","vocab.category.purple.label"],yu="vocab.category.unset.label",lv=[["#E5C355","vocab.swatch.sun.label"],["#DF9A5B","vocab.swatch.amber.label"],["#D98CA6","vocab.swatch.rose.label"],["#E8A0C0","vocab.swatch.blush.label"],["#C2555F","vocab.swatch.crimson.label"],["#A8739E","vocab.swatch.mauve.label"],["#8A7BC8","vocab.swatch.violet.label"],["#6E8FD0","vocab.swatch.periwinkle.label"],["#7FA6C9","vocab.swatch.sky.label"],["#5AA8B5","vocab.swatch.teal.label"],["#6FBF9F","vocab.swatch.mint.label"],["#4FA98A","vocab.swatch.jade.label"],["#7CB342","vocab.swatch.leaf.label"],["#B5C05A","vocab.swatch.moss.label"],["#B0806B","vocab.swatch.clay.label"],["#8C7F6E","vocab.swatch.stone.label"]],ci=15;function wu(t){const n=String(t||""),o=[...n];return o.length<=ci?n:o.slice(0,ci).join("")}let go=St.map(()=>""),ga=[...Ro],Qs=St.map(()=>!1);function Zl(t={}){for(let n=0;n<St.length;n++){const o=n+1,s=String(t["catName"+o]||""),r=String(t["catColor"+o]||"");go[n]=o===1?"":wu(s),Qs[n]=o===1?!1:!!t["catHidden"+o],ga[n]=/^#[0-9a-f]{6}$/i.test(r)?r:Ro[n],document.documentElement.style.setProperty("--hl-"+o,ga[n])}}function In(t){const n=St.indexOf(t);return n<0?t:go[n]?go[n]:n===0?a(yu):fo[n]?a(fo[n]):t[0].toUpperCase()+t.slice(1)}function jn(t){const n=St.indexOf(t);return n<0?null:"var(--hl-"+(n+1)+")"}function vu(t){const n=St.indexOf(t);return n<0?null:ga[n]}function ku(t){const n=St.indexOf(t);return n>-1&&!!Qs[n]}function cv(){return St.map((t,n)=>({token:t,slot:n+1,name:go[n],label:In(t),defaultName:fo[n]?a(fo[n]):t[0].toUpperCase()+t.slice(1),hex:ga[n],custom:ga[n].toLowerCase()!==Ro[n].toLowerCase(),hidden:Qs[n],fixed:n===0}))}const Ga=72,xu=["long-press","swipe-left","swipe-right","swipe-up","swipe-down","pinch-in","pinch-out","two-finger-left","two-finger-right","two-finger-up","two-finger-down"],ju={"long-press":"vocab.gesture.long-press.label","swipe-left":"vocab.gesture.swipe-left.label","swipe-right":"vocab.gesture.swipe-right.label","swipe-up":"vocab.gesture.swipe-up.label","swipe-down":"vocab.gesture.swipe-down.label","pinch-in":"vocab.gesture.pinch-in.label","pinch-out":"vocab.gesture.pinch-out.label","two-finger-left":"vocab.gesture.two-finger-left.label","two-finger-right":"vocab.gesture.two-finger-right.label","two-finger-up":"vocab.gesture.two-finger-up.label","two-finger-down":"vocab.gesture.two-finger-down.label"},di={left:[-1,0],right:[1,0],up:[0,-1],down:[0,1]},Su=t=>{if(t==="pinch-in")return[1,0];if(t==="pinch-out")return[-1,0];const n=t.replace("swipe-","").replace("two-finger-","");return di[n]||di.right};function ws({kind:t,size:n=68,className:o=""}){if(!xu.includes(t))return null;const s=a(ju[t]),r=t.startsWith("two-finger"),i=t.startsWith("pinch"),l=t.startsWith("swipe")||r,[h,d]=Su(t);return e.jsxs("svg",{className:`gesture ${o}`,viewBox:`0 0 ${Ga} ${Ga}`,width:n,height:n,role:"img","aria-label":s,style:{"--gd":`${h}`,"--gdy":`${d}`},children:[e.jsx("rect",{x:"8",y:"8",width:Ga-16,height:Ga-16,rx:"10",fill:"none",stroke:"currentColor",strokeWidth:"1.5",opacity:"0.22"}),l&&e.jsx("line",{x1:36-h*16,y1:36-d*16,x2:36+h*16,y2:36+d*16,stroke:"currentColor",strokeWidth:"1.5",strokeDasharray:"3 3",opacity:"0.35"}),t==="long-press"&&e.jsx("circle",{className:"g-ring",cx:"36",cy:"36",r:"18",fill:"none",stroke:"currentColor",strokeWidth:"2"}),i||r?e.jsxs(e.Fragment,{children:[e.jsx("circle",{className:`g-tip g-a ${i?"g-pinch":"g-move"}`,cx:"24",cy:"36",r:"7",fill:"currentColor"}),e.jsx("circle",{className:`g-tip g-b ${i?"g-pinch":"g-move"}`,cx:"48",cy:"36",r:"7",fill:"currentColor"})]}):e.jsx("circle",{className:`g-tip ${l?"g-move":"g-hold"}`,cx:"36",cy:"36",r:"8",fill:"currentColor"})]})}function Nu(t){return!!t&&t.type===ws}const ha=[{id:"search",keys:["/"],label:"shell.shortcut.search.label",group:"shell.shortcut.group.anywhere.label"},{id:"capture",keys:["n"],label:"shell.shortcut.capture.label",group:"shell.shortcut.group.anywhere.label"},{id:"help",keys:["?"],label:"shell.shortcut.help.label",group:"shell.shortcut.group.anywhere.label"},{id:"go-home",seq:["g","h"],label:"shell.shortcut.go-home.label",group:"shell.shortcut.group.go-to.label"},{id:"go-library",seq:["g","l"],label:"shell.shortcut.go-library.label",group:"shell.shortcut.group.go-to.label"},{id:"go-catalogue",seq:["g","c"],label:"shell.shortcut.go-catalogue.label",group:"shell.shortcut.group.go-to.label"},{id:"go-quotes",seq:["g","q"],label:"shell.shortcut.go-quotes.label",group:"shell.shortcut.group.go-to.label"},{id:"go-anthologies",seq:["g","a"],label:"shell.shortcut.go-anthologies.label",group:"shell.shortcut.group.go-to.label"},{id:"go-stats",seq:["g","s"],label:"shell.shortcut.go-stats.label",group:"shell.shortcut.group.go-to.label"},{id:"go-metadata",seq:["g","m"],label:"shell.shortcut.go-metadata.label",group:"shell.shortcut.group.go-to.label"},{id:"go-profile",seq:["g","p"],label:"shell.shortcut.go-profile.label",group:"shell.shortcut.group.go-to.label"},{id:"go-settings",seq:["g",","],label:"shell.shortcut.go-settings.label",group:"shell.shortcut.group.go-to.label"},{id:"pick-1",ctx:"mcq",keys:["1"],label:"shell.shortcut.pick-1.label",group:"shell.shortcut.group.mcq.label"},{id:"pick-2",ctx:"mcq",keys:["2"],label:"shell.shortcut.pick-2.label",group:"shell.shortcut.group.mcq.label"},{id:"pick-3",ctx:"mcq",keys:["3"],label:"shell.shortcut.pick-3.label",group:"shell.shortcut.group.mcq.label"},{id:"pick-4",ctx:"mcq",keys:["4"],label:"shell.shortcut.pick-4.label",group:"shell.shortcut.group.mcq.label"},{id:"reveal",ctx:"flip",keys:["space"],label:"shell.shortcut.reveal.label",group:"shell.shortcut.group.flip.label"},{id:"grade-forgot",ctx:"flip",keys:["1"],label:"shell.shortcut.grade-forgot.label",group:"shell.shortcut.group.flip.label"},{id:"grade-got",ctx:"flip",keys:["2"],label:"shell.shortcut.grade-got.label",group:"shell.shortcut.group.flip.label"},{id:"focus-blank",ctx:"cloze",keys:["space"],label:"shell.shortcut.focus-blank.label",group:"shell.shortcut.group.cloze.label"}],Tu=new Map(ha.map(t=>[t.id,t])),Xl=(()=>{try{return/mac|iphone|ipad/i.test(navigator.platform||navigator.userAgent||"")}catch{return!1}})();function hi(t){return t==="mod"?a(Xl?"vocab.key.mod.mac.label":"vocab.key.mod.label"):t==="space"?a("vocab.key.space.label"):t==="esc"?a("vocab.key.esc.label"):t==="shift"?a("vocab.key.shift.label"):t.length===1?t.toUpperCase():t}function Jl(t){var o;return t?t.seq?t.seq.map(hi).join(` ${a("common.kbd.then.label")} `):(((o=t.keys)==null?void 0:o[0])||"").split("+").map(hi).join(Xl?"":"-"):""}function Vt(t,n=!1){const o=Tu.get(t);if(!o)return"";const s=Jl(o);return n&&o.ctx?a("common.shortcut.shifted.label",{key:s}):s}function Cu(t,n,o=!1){const s=Vt(n,o);return s?a("common.shortcut.suffix.label",{name:t,key:s}):t}function Eu(t){var o;const n=[];for(const s of ha){if((o=t==null?void 0:t.has)!=null&&o.call(t,s.id))continue;let r=n.find(i=>i.key===s.group);r||n.push(r={key:s.group,group:a(s.group),items:[]}),r.items.push({id:s.id,label:a(s.label),keys:Jl(s),practiceKeys:s.ctx?Vt(s.id,!0):""})}return n}function ui(t){if(!t)return!1;const n=(t.tagName||"").toLowerCase();return!!(n==="input"||n==="textarea"||n==="select"||t.isContentEditable)}function Au(t){if(!t||!t.key)return"";const n=[];(t.metaKey||t.ctrlKey)&&n.push("mod"),t.altKey&&n.push("alt");let o=t.key;return t.shiftKey&&/^Digit[0-9]$/.test(t.code||"")&&(o=t.code.slice(5)),o===" "?o="space":o==="Escape"?o="esc":o.length===1&&(o=o.toLowerCase()),t.shiftKey&&(o==="space"||/^[0-9]$/.test(o))&&n.push("shift"),n.push(o),n.join("+")}function qu(t,n="",o=null){if(!t)return null;let s=!1;t.startsWith("shift+")&&(s=!0,t=t.slice(6));const r=l=>!l.ctx||l.ctx===o;if(n){const l=ha.find(h=>h.seq&&h.seq[0]===n&&h.seq[1]===t&&r(h));return l?{id:l.id,shift:s}:null}const i=ha.find(l=>{var h;return((h=l.keys)==null?void 0:h.includes(t))&&r(l)});return i?s&&!i.ctx?null:{id:i.id,shift:s}:s?null:ha.some(l=>l.seq&&l.seq[0]===t&&r(l))?{pending:t}:null}const Mu=2e3;function ec(t,n={}){const o=typeof n.ctx=="function"?n.ctx:()=>n.ctx||null,s=n.document||(typeof document<"u"?document:null),r=n.window||(typeof window<"u"?window:null);if(!r)return()=>{};let i="",l=0;const h=d=>{if(ui(d.target)||ui(s==null?void 0:s.activeElement)||d.altKey)return;const m=Au(d);i&&Date.now()-l>Mu&&(i="");const p=qu(m,i,o());if(!p){i="";return}if(p.pending){i=p.pending,l=Date.now(),d.preventDefault();return}i="",d.preventDefault(),t(p.id,{shift:!!p.shift,event:d})};return r.addEventListener("keydown",h),()=>r.removeEventListener("keydown",h)}const tc={amazon:"data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20448%20512%22%3E%3Cpath%20d%3D%22M257.2%20162.7c-48.7%201.8-169.5%2015.5-169.5%20117.5%200%20109.5%20138.3%20114%20183.5%2043.2%206.5%2010.2%2035.4%2037.5%2045.3%2046.8l56.8-56S341%20288.9%20341%20261.4V114.3C341%2089%20316.5%2032%20228.7%2032%20140.7%2032%2094%2087%2094%20136.3l73.5%206.8c16.3-49.5%2054.2-49.5%2054.2-49.5%2040.7-.1%2035.5%2029.8%2035.5%2069.1z%22%2F%3E%3C%2Fsvg%3E",fandom:"data:image/svg+xml,%3Csvg%20width%3D%2224%22%20height%3D%2224%22%20role%3D%22img%22%20viewBox%3D%220%200%2024%2024%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Ctitle%3EFandom%3C%2Ftitle%3E%3Cpath%20d%3D%22M8.123.008a.431.431%200%2000-.512.42v9.746L4.104%206.666a.432.432%200%2000-.66.064.428.428%200%2000-.071.239v10.064a2.387%202.387%200%2000.701%201.694l4.565%204.57a2.4%202.4%200%20001.693.703h3.34c.635%200%201.242-.252%201.691-.701l4.565-4.572a2.394%202.394%200%2000.699-1.694V13.41a2.39%202.39%200%2000-.7-1.693L8.343.125a.427.427%200%2000-.219-.117zM9.646%2012.51a.719.719%200%2001.508.21l1.848%201.85%201.844-1.85a.714.714%200%20011.015%200l1.32%201.321a.724.724%200%2001.212.508v1.406a.72.72%200%2001-.21.508l-3.68%203.7a.72.72%200%2001-1.019%200l-3.668-3.7a.716.716%200%2001-.209-.506v-1.408a.71.71%200%2001.211-.506l1.32-1.322a.713.713%200%2001.508-.211Z%22%3E%3C%2Fpath%3E%3C%2Fsvg%3E",google:"data:image/svg+xml,%3Csvg%20width%3D%2224%22%20height%3D%2224%22%20role%3D%22img%22%20viewBox%3D%220%200%2024%2024%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Ctitle%3EGoogle%3C%2Ftitle%3E%3Cpath%20d%3D%22M12.48%2010.92v3.28h7.84c-.24%201.84-.853%203.187-1.787%204.133-1.147%201.147-2.933%202.4-6.053%202.4-4.827%200-8.6-3.893-8.6-8.72s3.773-8.72%208.6-8.72c2.6%200%204.507%201.027%205.907%202.347l2.307-2.307C18.747%201.44%2016.133%200%2012.48%200%205.867%200%20.307%205.387.307%2012s5.56%2012%2012.173%2012c3.573%200%206.267-1.173%208.373-3.36%202.16-2.16%202.84-5.213%202.84-7.667%200-.76-.053-1.467-.173-2.053H12.48z%22%3E%3C%2Fpath%3E%3C%2Fsvg%3E",igdb:"data:image/svg+xml,%3Csvg%20width%3D%2224%22%20height%3D%2224%22%20role%3D%22img%22%20viewBox%3D%220%200%2024%2024%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Ctitle%3EIGDB%3C%2Ftitle%3E%3Cpath%20d%3D%22M24%206.228c-8%20.002-16%200-24%200v11.543a88.875%2088.875%200%200%201%202.271-.333%2074.051%2074.051%200%200%201%2017.038-.28c1.57.153%203.134.363%204.69.614V6.228zm-.706.707v10.013a74.747%2074.747%200%200%200-22.588%200V6.934h22.588ZM7.729%208.84a2.624%202.624%200%200%200-1.857.72%202.55%202.55%200%200%200-.73%201.33c-.098.5-.063%201.03.112%201.51.177.488.515.917.954%201.196.547.354%201.224.472%201.865.401a3.242%203.242%200%200%200%201.786-.777c-.003-.724.002-1.449-.002-2.173-.725.004-1.45-.002-2.174.003.003.317%200%20.634.001.951h1.105c.002.236%200%20.473.002.71-.268.196-.603.286-.932.298-.32.02-.65-.05-.922-.225a1.464%201.464%200%200%201-.59-.744c-.18-.499-.134-1.085.163-1.53.23-.355.619-.61%201.043-.647a1.8%201.8%200%200%201%201.012.206c.152.082.286.192.424.295.228-.281.461-.559.692-.838a3.033%203.033%200%200%200-.595-.403c-.418-.212-.892-.285-1.357-.283Zm11.66.086c-.093%200-.187.002-.28%200-.68.002-1.359-.004-2.038.003.003%201.666%200%203.332.002%204.998h2.497c.239-.002.478-.034.709-.097.276-.076.546-.208.742-.422.194-.208.297-.492.304-.776.016-.278-.032-.572-.195-.804-.175-.252-.453-.408-.734-.514.211-.122.407-.285.521-.505.134-.246.149-.535.117-.807a1.156%201.156%200%200%200-.436-.73c-.264-.207-.599-.304-.93-.334a2.757%202.757%200%200%200-.279-.012Zm-16.715%200v5.002h1.102V8.927c-.368-.002-.735%200-1.102%200zm8.524%200v5.002h2.016a2.87%202.87%200%200%200%201.07-.211%202.445%202.445%200%200%200%201.174-.993c.34-.555.429-1.244.292-1.876a2.367%202.367%200%200%200-.828-1.338c-.478-.387-1.096-.577-1.707-.584h-2.017zm6.949.967c.392.002.784-.001%201.176.002.183.011.38.054.51.19.11.112.136.28.112.43a.436.436%200%200%201-.22.316%201.082%201.082%200%200%201-.483.116c-.365.002-.73-.001-1.094.001-.002-.351%200-.703-.001-1.054zm-5.031.026c.28%200%20.567.053.815.19.274.149.491.396.607.685.113.272.138.574.107.865a1.456%201.456%200%200%201-.335.786%201.425%201.425%200%200%201-.865.466c-.168.031-.34.022-.51.023h-.632V9.92h.813zm5.03%201.948h1.36c.174.006.354.035.505.127.11.066.191.18.212.308.025.15.004.32-.099.44-.102.12-.258.176-.409.2-.172.032-.348.02-.522.022-.35-.001-.698.002-1.047-.001v-1.096z%22%3E%3C%2Fpath%3E%3C%2Fsvg%3E",imdb:"data:image/svg+xml,%3Csvg%20width%3D%2224%22%20height%3D%2224%22%20role%3D%22img%22%20viewBox%3D%220%200%2024%2024%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Ctitle%3EIMDb%3C%2Ftitle%3E%3Cpath%20d%3D%22M22.3781%200H1.6218C.7411.0583.0587.7437.0018%201.5953l-.001%2020.783c.0585.8761.7125%201.543%201.5559%201.6191A.337.337%200%200%200%201.6016%2024h20.7971a.4579.4579%200%200%200%20.0437-.002c.8727-.0768%201.5568-.8271%201.5568-1.7085V1.7098c0-.8914-.696-1.6416-1.584-1.7078A.3294.3294%200%200%200%2022.3781%200zm0%20.496a1.2144%201.2144%200%200%201%201.1252%201.2139v20.5797c0%20.6377-.4875%201.1602-1.1045%201.2145H1.6016c-.5967-.0543-1.0645-.5297-1.1053-1.1258V1.6284C.5371%201.0185%201.0184.5364%201.6217.496h20.7564zM4.7954%208.2603v7.3636H2.8899V8.2603h1.9055zm6.5367%200v7.3636H9.6707v-4.9704l-.6711%204.9704H7.813l-.6986-4.8618-.0066%204.8618h-1.668V8.2603h2.468c.0748.4476.1492.9694.2307%201.5734l.2712%201.8713.4407-3.4447h2.4817zm2.9772%201.3289c.0742.0404.122.108.1417.2034.0279.0953.0345.3118.0345.6442v2.8548c0%20.4881-.0345.7867-.0955.8954-.0609.1152-.2304.1695-.5018.1695V9.5211c.204%200%20.3457.0205.4211.0681zm-.0211%206.0347c.4543%200%20.8006-.0265%201.0245-.0742.2304-.0477.4204-.1357.5694-.2648.1556-.1218.2642-.298.3251-.5219.0611-.2238.1021-.6648.1021-1.3224v-2.5832c0-.6986-.0271-1.1668-.0742-1.4039-.041-.237-.1431-.4543-.3126-.6437-.1695-.1973-.4198-.3324-.7456-.421-.3191-.0808-.8542-.1285-1.7694-.1285h-1.4244v7.3636h2.3051zm5.14-1.7827c0%20.3523-.0199.5762-.0544.6708-.033.0947-.1894.1424-.3046.1424-.1086%200-.19-.0477-.2238-.1351-.041-.0887-.0609-.2986-.0609-.6238v-1.9469c0-.3324.0199-.5423.0543-.6237.0338-.0808.1086-.122.2171-.122.1153%200%20.2709.0412.3114.1425.041.0947.0609.2986.0609.6032v1.8926zm-2.4747-5.5809v7.3636h1.7157l.1152-.4675c.1556.1894.3251.3324.5152.4271.1828.0881.4608.1357.678.1357.3047%200%20.5629-.0748.7802-.237.2165-.1562.3589-.3462.4198-.5628.0543-.2173.0887-.543.0887-.9841v-2.0675c0-.4409-.0139-.7324-.0344-.8681-.0199-.1357-.0742-.2781-.1695-.4204-.1021-.1425-.2437-.251-.4272-.3325-.1834-.0742-.3999-.1152-.6576-.1152-.2172%200-.4952.0477-.6846.1285-.1835.0887-.353.2238-.5086.4007V8.2603h-1.8309z%22%3E%3C%2Fpath%3E%3C%2Fsvg%3E",letterboxd:"data:image/svg+xml,%3Csvg%20width%3D%2224%22%20height%3D%2224%22%20role%3D%22img%22%20viewBox%3D%220%200%2024%2024%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Ctitle%3ELetterboxd%3C%2Ftitle%3E%3Cpath%20d%3D%22M8.224%2014.352a4.447%204.447%200%200%201-3.775%202.092C1.992%2016.444%200%2014.454%200%2012s1.992-4.444%204.45-4.444c1.592%200%202.988.836%203.774%202.092-.427.682-.673%201.488-.673%202.352s.246%201.67.673%202.352zM15.101%2012c0-.864.247-1.67.674-2.352-.786-1.256-2.183-2.092-3.775-2.092s-2.989.836-3.775%202.092c.427.682.674%201.488.674%202.352s-.247%201.67-.674%202.352c.786%201.256%202.183%202.092%203.775%202.092s2.989-.836%203.775-2.092A4.42%204.42%200%200%201%2015.1%2012zm4.45-4.444a4.447%204.447%200%200%200-3.775%202.092c.427.682.673%201.488.673%202.352s-.246%201.67-.673%202.352a4.447%204.447%200%200%200%203.775%202.092C22.008%2016.444%2024%2014.454%2024%2012s-1.992-4.444-4.45-4.444z%22%3E%3C%2Fpath%3E%3C%2Fsvg%3E",openlibrary:"data:image/svg+xml,%3Csvg%20width%3D%2224%22%20height%3D%2224%22%20role%3D%22img%22%20viewBox%3D%220%200%2024%2024%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Ctitle%3EInternet%20Archive%3C%2Ftitle%3E%3Cpath%20d%3D%22M22.667%2022.884V24H1.333v-1.116zm-.842-1.675v1.396H2.175v-1.396zM4.233%206.14l.234.118.118%201.882.117%203.058v2.941l-.117%203.666-.02%202.47-.332.098H3.062l-.352-.098-.136-2.47-.118-3.646v-2.941l.118-3.078.107-1.892.244-.107zm16.842%200l.235.118.117%201.882.117%203.058v2.941l-.117%203.666-.02%202.47-.332.098h-1.171l-.352-.098-.137-2.47-.117-3.646v-2.941l.117-3.078.108-1.892.244-.107zm-11.79%200l.235.118.117%201.882.117%203.058v2.941l-.117%203.666-.02%202.47-.331.098H8.114l-.352-.098-.136-2.47-.117-3.646v-2.941l.117-3.078.107-1.892.244-.107zm6.457%200l.234.118.117%201.882.118%203.058v2.941l-.118%203.666-.019%202.47-.332.098H14.57l-.351-.098-.137-2.47-.117-3.646v-2.941l.117-3.078.108-1.892.244-.107zm6.083-2.511V5.58H2.175V3.628zM11.798%200l10.307%202.347-.413.723H1.951l-.618-.587Z%22%3E%3C%2Fpath%3E%3C%2Fsvg%3E",tmdb:"data:image/svg+xml,%3Csvg%20width%3D%2224%22%20height%3D%2224%22%20role%3D%22img%22%20viewBox%3D%220%200%2024%2024%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Ctitle%3EThe%20Movie%20Database%3C%2Ftitle%3E%3Cpath%20d%3D%22M6.62%2012a2.291%202.291%200%200%201%202.292-2.295h-.013A2.291%202.291%200%200%201%2011.189%2012a2.291%202.291%200%200%201-2.29%202.291h.013A2.291%202.291%200%200%201%206.62%2012zm10.72-4.062h4.266a2.291%202.291%200%200%200%202.29-2.291%202.291%202.291%200%200%200-2.29-2.296H17.34a2.291%202.291%200%200%200-2.291%202.296%202.291%202.291%200%200%200%202.29%202.29zM2.688%2020.645h8.285a2.291%202.291%200%200%200%202.291-2.292%202.291%202.291%200%200%200-2.29-2.295H2.687a2.291%202.291%200%200%200-2.291%202.295%202.291%202.291%200%200%200%202.29%202.292zm10.881-6.354h.81l1.894-4.586H15.19l-1.154%203.008h-.013l-1.135-3.008h-1.154zm4.208%200h1.011V9.705h-1.011zm2.878%200h3.235v-.93h-2.223v-.933h1.99v-.934h-1.99v-.855h2.107v-.934h-3.112zM1.31%207.941h1.01V4.247h1.31v-.895H0v.895h1.31zm3.747%200h1.011V5.959h1.958v1.984h1.011v-4.59h-1.01v1.711H6.061V3.351H5.057zm5.348%200h3.242v-.933H11.41v-.934h1.99v-.933h-1.99v-.856h2.107v-.934h-3.112zM.162%2014.296h1.005v-3.52h.013l1.167%203.52h.765l1.206-3.52h.013v3.52h1.011v-4.59H3.82L2.755%2012.7h-.013L1.686%209.705H.156zm14.534%206.353h1.641a3.188%203.188%200%200%200%20.98-.149%202.531%202.531%200%200%200%20.824-.437%202.123%202.123%200%200%200%20.567-.713%202.193%202.193%200%200%200%20.223-.983%202.399%202.399%200%200%200-.218-1.07%201.958%201.958%200%200%200-.586-.716%202.405%202.405%200%200%200-.873-.392%204.349%204.349%200%200%200-1.046-.13h-1.519zm1.013-3.656h.596a2.26%202.26%200%200%201%20.606.08%201.514%201.514%200%200%201%20.503.244%201.167%201.167%200%200%201%20.34.412%201.28%201.28%200%200%201%20.13.587%201.546%201.546%200%200%201-.13.658%201.127%201.127%200%200%201-.347.433%201.41%201.41%200%200%201-.518.238%202.797%202.797%200%200%201-.649.07h-.538zm4.686%203.656h1.88a2.997%202.997%200%200%200%20.613-.064%201.735%201.735%200%200%200%20.554-.214%201.221%201.221%200%200%200%20.402-.39%201.105%201.105%200%200%200%20.155-.606%201.188%201.188%200%200%200-.071-.415%201.01%201.01%200%200%200-.204-.34%201.087%201.087%200%200%200-.317-.24%201.297%201.297%200%200%200-.413-.13v-.012a1.203%201.203%200%200%200%20.575-.366.962.962%200%200%200%20.216-.648%201.081%201.081%200%200%200-.149-.603%201.022%201.022%200%200%200-.389-.354%201.673%201.673%200%200%200-.54-.169%204.463%204.463%200%200%200-.6-.041h-1.712zm1.011-3.734h.687a1.4%201.4%200%200%201%20.24.022.748.748%200%200%201%20.22.075.432.432%200%200%201%20.16.147.418.418%200%200%201%20.061.236.47.47%200%200%201-.055.233.433.433%200%200%201-.146.156.62.62%200%200%201-.204.084%201.058%201.058%200%200%201-.23.026h-.745zm0%201.835h.765a1.96%201.96%200%200%201%20.266.02%201.015%201.015%200%200%201%20.26.07.519.519%200%200%201%20.204.152.406.406%200%200%201%20.08.26.481.481%200%200%201-.06.253.519.519%200%200%201-.16.168.62.62%200%200%201-.217.09%201.155%201.155%200%200%201-.237.027H21.4z%22%3E%3C%2Fpath%3E%3C%2Fsvg%3E",tvdb:"data:image/svg+xml,%3Csvg%20fill%3D%22%23000000%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2014%2014%22%20role%3D%22img%22%20focusable%3D%22false%22%20aria-hidden%3D%22true%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22m%201.7844605%2C10.190309%20c%20-0.18713%2C-0.1871%20-0.16477%2C-0.051%20-0.51038%2C-3.1043001%20-0.31619004%2C-2.7933%20-0.32906004%2C-3.0127%20-0.18855%2C-3.2133%200.20306%2C-0.2899%200.35119%2C-0.2847%203.38314%2C0.1182%201.5657%2C0.2081%202.90794%2C0.4091%202.98277%2C0.4467%200.20486%2C0.1029%200.27728%2C0.3277%200.27728%2C0.8604%200%2C0.4646%20-0.008%2C0.4914%20-0.22973%2C0.7364%20-0.66325%2C0.7342%20-0.66447%2C1.7632%20-0.003%2C2.4001%200.20736%2C0.1996%200.23128%2C0.2567%200.23188%2C0.5529%205.1e-4%2C0.2526%20-0.0334%2C0.3699%20-0.14403%2C0.4985%20-0.14015%2C0.1629%20-0.22084%2C0.179%20-2.55946%2C0.5106%20-2.7992%2C0.3968001%20-3.02365%2C0.4103001%20-3.24009%2C0.1938001%20z%20m%202.1925%2C-1.8830001%20c%200%2C-0.2521%20-0.002%2C-0.2543%20-0.24164%2C-0.2543%20-0.1329%2C0%20-0.27597%2C-0.034%20-0.31794%2C-0.076%20-0.05%2C-0.05%20-0.0763%2C-0.3143%20-0.0763%2C-0.7658%20l%200%2C-0.6894%200.48353%2C0.019%200.48354%2C0.019%200.39397%2C0.9857%200.39397%2C0.9856%200.37838%2C0.017%200.37838%2C0.017%200.49075%2C-1.1616%20c%200.26992%2C-0.6389%200.50968%2C-1.2133%200.5328%2C-1.2765%200.0377%2C-0.1031%200.007%2C-0.1129%20-0.29745%2C-0.095%20l%20-0.33948%2C0.02%20-0.34779%2C0.8744%20c%20-0.19128%2C0.4809%20-0.36856%2C0.8743%20-0.39396%2C0.8743%20-0.0254%2C0%20-0.13202%2C-0.236%20-0.23694%2C-0.5246%20-0.10493%2C-0.2885%20-0.25277%2C-0.6891%20-0.32853%2C-0.8902%20l%20-0.13776%2C-0.3657%20-0.7267%2C0%20-0.72671%2C0%200%2C-0.5087%200%2C-0.5087%20-0.34974%2C0%20-0.34974%2C0%200%2C0.5087%200%2C0.5087%20-0.22256%2C0%20c%20-0.21726%2C0%20-0.22256%2C0.01%20-0.22256%2C0.2544%200%2C0.2465%200.007%2C0.2544%200.21472%2C0.2544%20l%200.21472%2C0%200.0299%2C0.7471%20c%200.0438%2C1.096%200.1763%2C1.2804%200.92375%2C1.2852%20l%200.39743%2C0%200%2C-0.2544%20z%20m%202.98407%2C-2.6475%20c%200.17076%2C-0.2171%200.16614%2C-0.3126%20-0.0243%2C-0.503%20-0.19684%2C-0.1968%20-0.31765%2C-0.1968%20-0.51449%2C0%20-0.19564%2C0.1956%20-0.20111%2C0.4329%20-0.013%2C0.5641%200.21276%2C0.1484%200.40363%2C0.1273%200.55179%2C-0.061%20z%20m%200.88409%2C2.773%20c%20-0.42812%2C-0.2261%20-0.65774%2C-0.7228%20-0.61236%2C-1.3245%200.0359%2C-0.4765%200.20564%2C-0.8102%200.51695%2C-1.0163%200.22173%2C-0.1469%200.33378%2C-0.1722%200.84851%2C-0.1913%20l%200.59305%2C-0.022%200%2C-0.4708%200%2C-0.4708%200.38153%2C0%200.38154%2C0%200%2C1.8123%200%2C1.8123%20-0.93794%2C0%20c%20-0.80185%2C0%20-0.9718%2C-0.021%20-1.17128%2C-0.1261%20z%20m%201.34615%2C-1.1747%200%2C-0.7312%20-0.38643%2C0%20c%20-0.34232%2C0%20-0.40764%2C0.021%20-0.5723%2C0.1858%20-0.25433%2C0.2544%20-0.26586%2C0.7268%20-0.0247%2C1.0133%200.17036%2C0.2025%200.27757%2C0.2408%200.7132%2C0.2547%20l%200.27026%2C0.01%200%2C-0.7313%20z%20m%201.0810095%2C-0.5087%200%2C-1.8123%200.38154%2C0%200.38153%2C0%200%2C0.4769%200%2C0.477%200.51076%2C0%20c%201.05257%2C0%201.49508%2C0.4262%201.45089%2C1.3975%20-0.0183%2C0.4032%20-0.0525%2C0.5334%20-0.19712%2C0.752%20-0.29504%2C0.4458%20-0.5269%2C0.5212%20-1.60302%2C0.5212%20l%20-0.92458%2C0%200%2C-1.8123%20z%20m%201.47191%2C1.1749%20c%200.38358%2C-0.1066%200.57492%2C-0.5705%200.41833%2C-1.0143%20-0.0988%2C-0.2798%20-0.30034%2C-0.381%20-0.76153%2C-0.3822%20l%20-0.36564%2C-9e-4%200%2C0.7312%200%2C0.7313%200.23846%2C-5e-4%20c%200.13115%2C0%200.34282%2C-0.029%200.47038%2C-0.065%20z%22%3E%3C%2Fpath%3E%3C%2Fsvg%3E",wikidata:"data:image/svg+xml,%3Csvg%20width%3D%2224%22%20height%3D%2224%22%20role%3D%22img%22%20viewBox%3D%220%200%2024%2024%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Ctitle%3EWikidata%3C%2Ftitle%3E%3Cpath%20d%3D%22M0%204.583v14.833h.865V4.583zm1.788%200v14.833h2.653V4.583zm3.518%200v14.832H7.96V4.583zm3.547%200v14.834h.866V4.583zm1.789%200v14.833h.865V4.583zm1.759%200v14.834h2.653V4.583zm3.518%200v14.834h.923V4.583zm1.788%200v14.833h2.653V4.583zm3.64%200v14.834h.865V4.583zm1.788%200v14.834H24V4.583Z%22%3E%3C%2Fpath%3E%3C%2Fsvg%3E",wikimedia:"data:image/svg+xml,%3Csvg%20role%3D%22img%22%20viewBox%3D%220%200%2024%2024%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Ctitle%3EWikimedia%20Commons%3C%2Ftitle%3E%3Cpath%20d%3D%22M9.048%2015.203a2.952%202.952%200%201%201%205.904%200%202.952%202.952%200%200%201-5.904%200zm11.749.064v-.388h-.006a8.726%208.726%200%200%200-.639-2.985%208.745%208.745%200%200%200-1.706-2.677l.004-.004-.186-.185-.044-.045-.026-.026-.204-.204-.006.007c-.848-.756-1.775-1.129-2.603-1.461-1.294-.519-2.138-.857-2.534-2.467.443.033.839.174%201.13.481C15.571%206.996%2011.321%200%2011.321%200s-1.063%203.985-2.362%205.461c-.654.744.22.273%201.453-.161.279%201.19.77%202.119%201.49%202.821.791.771%201.729%201.148%202.556%201.48.672.27%201.265.508%201.767.916l-.593.594-.668-.668-.668%202.463%202.463-.668-.668-.668.6-.599a6.285%206.285%200%200%201%201.614%203.906h-.844v-.944l-2.214%201.27%202.214%201.269v-.944h.844a6.283%206.283%200%200%201-1.614%203.906l-.6-.599.668-.668-2.463-.668.668%202.463.668-.668.6.6a6.263%206.263%200%200%201-3.907%201.618v-.848h.945L12%2018.45l-1.27%202.214h.944v.848a6.266%206.266%200%200%201-3.906-1.618l.599-.6.668.668.668-2.463-2.463.668.668.668-.6.599a6.29%206.29%200%200%201-1.615-3.906h.844v.944l2.214-1.269-2.214-1.27v.944h-.843a6.292%206.292%200%200%201%201.615-3.906l.6.599-.668.668%202.463.668-.668-2.463-.668.668-2.359-2.358-.23.229-.044.045-.185.185.004.004a8.749%208.749%200%200%200-2.345%205.662h-.006v.649h.006a8.749%208.749%200%200%200%202.345%205.662l-.004.004.185.185.045.045.045.045.185.185.004-.004a8.73%208.73%200%200%200%202.677%201.707%208.75%208.75%200%200%200%202.985.639V24h.649v-.006a8.75%208.75%200%200%200%202.985-.639%208.717%208.717%200%200%200%202.677-1.707l.004.004.187-.187.044-.043.043-.044.187-.186-.004-.004a8.733%208.733%200%200%200%201.706-2.677%208.726%208.726%200%200%200%20.639-2.985h.006v-.259z%22%2F%3E%3C%2Fsvg%3E",wikipedia:"data:image/svg+xml,%3Csvg%20width%3D%2224%22%20height%3D%2224%22%20role%3D%22img%22%20viewBox%3D%220%200%2024%2024%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Ctitle%3EWikipedia%3C%2Ftitle%3E%3Cpath%20d%3D%22M12.09%2013.119c-.936%201.932-2.217%204.548-2.853%205.728-.616%201.074-1.127.931-1.532.029-1.406-3.321-4.293-9.144-5.651-12.409-.251-.601-.441-.987-.619-1.139-.181-.15-.554-.24-1.122-.271C.103%205.033%200%204.982%200%204.898v-.455l.052-.045c.924-.005%205.401%200%205.401%200l.051.045v.434c0%20.119-.075.176-.225.176l-.564.031c-.485.029-.727.164-.727.436%200%20.135.053.33.166.601%201.082%202.646%204.818%2010.521%204.818%2010.521l.136.046%202.411-4.81-.482-1.067-1.658-3.264s-.318-.654-.428-.872c-.728-1.443-.712-1.518-1.447-1.617-.207-.023-.313-.05-.313-.149v-.468l.06-.045h4.292l.113.037v.451c0%20.105-.076.15-.227.15l-.308.047c-.792.061-.661.381-.136%201.422l1.582%203.252%201.758-3.504c.293-.64.233-.801.111-.947-.07-.084-.305-.22-.812-.24l-.201-.021c-.052%200-.098-.015-.145-.051-.045-.031-.067-.076-.067-.129v-.427l.061-.045c1.247-.008%204.043%200%204.043%200l.059.045v.436c0%20.121-.059.178-.193.178-.646.03-.782.095-1.023.439-.12.186-.375.589-.646%201.039l-2.301%204.273-.065.135%202.792%205.712.17.048%204.396-10.438c.154-.422.129-.722-.064-.895-.197-.172-.346-.273-.857-.295l-.42-.016c-.061%200-.105-.014-.152-.045-.043-.029-.072-.075-.072-.119v-.436l.059-.045h4.961l.041.045v.437c0%20.119-.074.18-.209.18-.648.03-1.127.18-1.443.421-.314.255-.557.616-.736%201.067%200%200-4.043%209.258-5.426%2012.339-.525%201.007-1.053.917-1.503-.031-.571-1.171-1.773-3.786-2.646-5.71l.053-.036z%22%3E%3C%2Fpath%3E%3C%2Fsvg%3E"};class nc extends c.Component{constructor(n){super(n),this.state={error:null}}static getDerivedStateFromError(n){return{error:n}}componentDidCatch(n,o){console.error("tippani render error:",n,o==null?void 0:o.componentStack)}render(){var n;return this.state.error?e.jsxs("div",{role:"alert",style:{maxWidth:560,margin:"0 auto",padding:"48px 20px",textAlign:"center"},children:[e.jsx("p",{className:"display-title",style:{fontSize:"var(--type-ui-22)",marginBottom:8},children:a("shell.error.boundary.title")}),e.jsx("p",{className:"microcopy",style:{marginBottom:16},children:this.props.label?a("shell.error.boundary.named.body",{name:this.props.label}):a("shell.error.boundary.body")}),e.jsx("pre",{style:{textAlign:"left",whiteSpace:"pre-wrap",overflowWrap:"anywhere",fontFamily:"var(--font-mono)",fontSize:"var(--type-mono-12)",color:"var(--error)",background:"var(--raised)",border:"1px solid var(--line)",borderRadius:10,padding:"12px 14px",marginBottom:18},children:String(((n=this.state.error)==null?void 0:n.message)||this.state.error)}),e.jsx("button",{type:"button",className:"tp-btn tp-btn-primary tactile",onClick:()=>window.location.reload(),children:a("common.action.reload.label")})]}):this.props.children}}const mi=St;Object.fromEntries(St.map((t,n)=>[t,Ro[n]]));const dv=["sticker","banner","flyout","tape","reel"];function Zs(){const t=c.useRef(null);return c.useEffect(()=>{const n=t.current;if(!n)return;if(window.matchMedia("(prefers-reduced-motion: reduce)").matches){n.classList.add("is-in");return}if("IntersectionObserver"in window){const s=new IntersectionObserver(r=>r.forEach(i=>{i.isIntersecting&&(n.classList.add("is-in"),s.disconnect())}),{rootMargin:"0px 0px -8% 0px"});return s.observe(n),()=>s.disconnect()}const o=()=>{n.getBoundingClientRect().top<window.innerHeight-40&&(n.classList.add("is-in"),window.removeEventListener("scroll",o))};return window.addEventListener("scroll",o,{passive:!0}),o(),()=>window.removeEventListener("scroll",o)},[]),t}function ac(){const[t,n]=c.useState(()=>document.documentElement.dataset.theme==="dark");return c.useEffect(()=>{const o=s=>n(s.detail.dark);return window.addEventListener("tippani:theme",o),()=>window.removeEventListener("tippani:theme",o)},[]),t}const oc="(max-width: 768px)";function sc(){var t;return typeof window<"u"&&((t=window.matchMedia)==null?void 0:t.call(window,oc).matches)}function Ie(){const[t,n]=c.useState(sc);return c.useEffect(()=>{var r;if(typeof window>"u"||!window.matchMedia)return;const o=window.matchMedia(oc),s=()=>n(o.matches);return s(),o.addEventListener?(o.addEventListener("change",s),()=>o.removeEventListener("change",s)):((r=o.addListener)==null||r.call(o,s),()=>{var i;return(i=o.removeListener)==null?void 0:i.call(o,s)})},[]),t}const pi="(prefers-reduced-motion: reduce)";function Lu({enabled:t=!0,forceShow:n=!1,resetKey:o=null,threshold:s=12,topZone:r=24}={}){const[i,l]=c.useState(!1),[h,d]=c.useState(()=>{var p;return typeof window<"u"&&!!((p=window.matchMedia)!=null&&p.call(window,pi).matches)});c.useEffect(()=>{var f;if(typeof window>"u"||!window.matchMedia)return;const p=window.matchMedia(pi),u=()=>d(p.matches);return u(),p.addEventListener?(p.addEventListener("change",u),()=>p.removeEventListener("change",u)):((f=p.addListener)==null||f.call(p,u),()=>{var b;return(b=p.removeListener)==null?void 0:b.call(p,u)})},[]);const m=t&&!h&&!n;return c.useEffect(()=>{if(!m){l(!1);return}let p=window.scrollY,u=!1;const f=()=>{u=!1;const w=window.scrollY,v=w-p;if(w<=r){p=w,l(!1);return}Math.abs(v)<s||(p=w,l(v>0))},b=()=>{u||(u=!0,window.requestAnimationFrame(f))};return window.addEventListener("scroll",b,{passive:!0}),()=>window.removeEventListener("scroll",b)},[m,s,r]),c.useEffect(()=>{l(!1)},[o]),m?i:!1}let bo=null;const vs=new Set;function fi(t){bo=t||null;for(const n of vs)n(bo)}function Xs(t){c.useEffect(()=>(fi(t),()=>fi(null)),[t])}function Du(){const[t,n]=c.useState(bo);return c.useEffect(()=>(vs.add(n),n(bo),()=>vs.delete(n)),[]),t}let yo={sub:null,keys:null};const ks=new Set;function gi(t){yo=t;for(const n of ks)n(yo)}function Aa({sub:t=null,keys:n=null,actions:o=null}={}){const s=n?n.map(r=>r&&r.id).join("|"):"";c.useEffect(()=>(gi({sub:t,keys:n}),()=>gi({sub:null,keys:null})),[t,s]),c.useEffect(()=>{if(o)return xs.add(o),()=>xs.delete(o)})}const xs=new Set;function _u(){const t=[];for(const n of xs)try{const o=n();o&&o.length&&t.push(...o)}catch(o){console.error("[shell] screen actions failed to build",o)}return t}function Ou(){const[t,n]=c.useState(yo);return c.useEffect(()=>(ks.add(n),n(yo),()=>ks.delete(n)),[]),t}const bi=1,Ru=3;function Io(t,{axis:n="x",drag:o=!0}={}){c.useEffect(()=>{const s=t.current;if(!s)return;const r=n==="both"?["x","v"]:[n];let i=!1;const l=()=>{i=!1;for(const p of r){const u=p==="x"?"data-scroll-x":"data-scroll-v",f=p==="x"?s.scrollLeft:s.scrollTop,b=p==="x"?s.clientWidth:s.clientHeight,w=p==="x"?s.scrollWidth:s.scrollHeight,v=Math.abs(f),g=v>bi,y=v+b<w-bi,k=g&&y?"both":g?"start":y?"end":"";k?s.getAttribute(u)!==k&&s.setAttribute(u,k):s.removeAttribute(u)}},h=()=>{i||(i=!0,window.requestAnimationFrame(l))};s.addEventListener("scroll",h,{passive:!0});let d=null,m=null;if(typeof ResizeObserver<"u"){d=new ResizeObserver(h);const p=()=>{d.disconnect(),d.observe(s);for(const u of s.children)d.observe(u);h()};p(),typeof MutationObserver<"u"&&(m=new MutationObserver(p),m.observe(s,{childList:!0}))}return l(),()=>{s.removeEventListener("scroll",h),d==null||d.disconnect(),m==null||m.disconnect(),s.removeAttribute("data-scroll-x"),s.removeAttribute("data-scroll-v")}},[t,n]),c.useEffect(()=>{const s=t.current;if(!s||!o)return;const r=n==="x"||n==="both",i=n==="v"||n==="both";let l=null,h=0,d=0,m=0,p=0,u=!1,f=!1;const b=y=>{var k,j;y.pointerType==="touch"||y.button!==0||(j=(k=y.target).closest)!=null&&j.call(k,"input, textarea, select, [contenteditable]")||(s.removeAttribute("data-dragged"),l=y.pointerId,h=y.clientX,d=y.clientY,m=s.scrollLeft,p=s.scrollTop,u=!1,f=!1)},w=y=>{var N;if(y.pointerId!==l)return;const k=y.clientX-h,j=y.clientY-d;!u&&Math.hypot(k,j)<Ru||(u||(s.setAttribute("data-dragging","1"),(N=s.setPointerCapture)==null||N.call(s,y.pointerId),f=!0),u=!0,r&&(s.scrollLeft=m-k),i&&(s.scrollTop=p-j),y.preventDefault())},v=y=>{var k;y.pointerId===l&&(l=null,f&&((k=s.releasePointerCapture)==null||k.call(s,y.pointerId)),f=!1,s.removeAttribute("data-dragging"),u&&s.setAttribute("data-dragged","1"))},g=y=>{s.hasAttribute("data-dragged")&&(s.removeAttribute("data-dragged"),y.preventDefault(),y.stopPropagation())};return s.addEventListener("pointerdown",b),s.addEventListener("pointermove",w),s.addEventListener("pointerup",v),s.addEventListener("pointercancel",v),s.addEventListener("click",g,!0),()=>{s.removeEventListener("pointerdown",b),s.removeEventListener("pointermove",w),s.removeEventListener("pointerup",v),s.removeEventListener("pointercancel",v),s.removeEventListener("click",g,!0),s.removeAttribute("data-dragging"),s.removeAttribute("data-dragged")}},[t,n,o])}function Po({axis:t="x",drag:n=!0,className:o="",children:s,...r}){const i=c.useRef(null);return Io(i,{axis:t,drag:n}),e.jsx("div",{ref:i,className:o,...r,children:s})}const rc=[[1900,5],[1600,4],[1280,3],[640,2]],Iu=[[1900,5],[1600,4],[1280,3],[860,2]];function Fo(t){const n=()=>{if(typeof window>"u")return 1;const r=window.innerWidth;for(const[i,l]of t)if(r>=i)return l;return 1},[o,s]=c.useState(n);return c.useEffect(()=>{const r=()=>s(n());return window.addEventListener("resize",r),r(),()=>window.removeEventListener("resize",r)},[]),o}let yi=0;function Nt(t){c.useEffect(()=>{if(t)return++yi===1&&(document.body.style.overflow="hidden"),()=>{--yi===0&&(document.body.style.overflow="")}},[t])}function qa(t,n){c.useEffect(()=>{if(!t)return;let o=!1;window.history.pushState({...window.history.state,tpOverlay:!0},"");const s=()=>{o=!0,n==null||n()};return window.addEventListener("popstate",s),()=>{var r;window.removeEventListener("popstate",s),!o&&((r=window.history.state)!=null&&r.tpOverlay)&&window.history.back()}},[t])}const wi=["","hc-r1","hc-r2","hc-r3"];function Je({variant:t=0,colorBar:n,className:o="",style:s,children:r,...i}){const l=n?{borderLeft:`4px solid ${jn(n)||n}`}:void 0;return e.jsx("div",{className:`hand-card ${wi[t%wi.length]} ${o}`,style:l?{...l,...s}:s,...i,children:r})}function kt({pad:t="p-6",className:n="",children:o,...s}){return e.jsx("div",{className:`hand-card ${t} ${n}`.trim(),...s,children:o})}function Pu({n:t,onClear:n,children:o}){return t===0?null:e.jsxs("div",{className:"flex flex-wrap items-center gap-2 px-3 py-2",style:{background:"color-mix(in srgb, var(--accent) 8%, transparent)",border:"1px solid color-mix(in srgb, var(--accent) 30%, var(--line))",borderRadius:9},children:[e.jsx(W,{style:{color:"var(--accent-ui)"},children:a("common.selection.count",{count:t,n:t})}),o,e.jsx(Ae,{icon:e.jsx(it,{}),ariaLabel:a("common.selection.clear.aria"),onClick:n,wrapClassName:"ml-auto"})]})}function Js({base:t,className:n="",icon:o,keepLabel:s,onClick:r,children:i,...l}){const{play:h,animClass:d,onAnimationEnd:m}=cc("anim-btn",3);return e.jsx("button",{...l,className:`tp-btn tactile ${t} ${d}${o&&!s?" has-btn-icon":""}${o&&s?" has-fixed-label":""} ${n}`,onClick:p=>{h(),r==null||r(p)},onAnimationEnd:m,children:o?e.jsxs(e.Fragment,{children:[e.jsx("span",{className:"btn-icon",children:o}),e.jsx("span",{className:s?"btn-label-fixed":"btn-label",children:i})]}):i})}function an(t){return e.jsx(Js,{base:"btn-sticker",...t})}function Fu(t){return e.jsx(Js,{base:"btn-film",...t})}function ge(t){return e.jsx(Js,{base:"tp-btn-ghost",...t})}function W({className:t="",children:n,...o}){return e.jsx("span",{className:"mono-label "+t,...o,children:n})}function Vn({title:t,counts:n,right:o}){return e.jsxs("header",{className:"page-header",children:[e.jsxs("div",{className:"ph-left",children:[e.jsx("h1",{children:t}),n&&e.jsx(W,{children:n})]}),o&&e.jsx("div",{className:"flex flex-wrap items-center gap-3",children:o})]})}function ss({embedded:t=!1,title:n,counts:o,right:s}){return t?e.jsxs("header",{className:"section-header",children:[e.jsxs("div",{className:"ph-left",children:[e.jsx("h2",{children:n}),o&&e.jsx(W,{children:o})]}),s&&e.jsx("div",{className:"flex flex-wrap items-center gap-3",children:s})]}):e.jsx(Vn,{title:n,counts:o,right:s})}function Se({label:t,className:n="",nameCase:o=!1,onChange:s,inputRef:r,...i}){return e.jsxs("label",{className:"tp-field "+n,children:[e.jsx(W,{children:t}),e.jsx("input",{className:"tp-input",ref:r,autoCapitalize:o?"words":void 0,...i,onChange:s})]})}function Et({onChange:t,...n}){return e.jsx("input",{className:"tp-input",autoCapitalize:"words",...n,onChange:t})}const ua=["common.month.jan.label","common.month.feb.label","common.month.mar.label","common.month.apr.label","common.month.may.label","common.month.jun.label","common.month.jul.label","common.month.aug.label","common.month.sep.label","common.month.oct.label","common.month.nov.label","common.month.dec.label"];function ba(t){if(!/^\d{4}(-\d{2}(-\d{2})?)?$/.test(t))return!1;const[n,o,s]=t.split("-").map(Number);return!(n<1e3||n>3e3||o!=null&&(o<1||o>12)||s!=null&&(s<1||s>ic(n,o)))}function un(t){if(!t)return"";const[n,o,s]=t.split("-").map(Number);return o?s?a("common.date.full.label",{day:s,month:a(ua[o-1]),year:n}):a("common.date.month-year.label",{month:a(ua[o-1]),year:n}):String(n)}function Qt(){const t=new Date,n=o=>String(o).padStart(2,"0");return`${t.getFullYear()}-${n(t.getMonth()+1)}-${n(t.getDate())}`}function ic(t,n){return new Date(t,n,0).getDate()}function Bu({value:t,onPick:n,onClose:o,granularity:s="day"}){const r=/^\d{4}/.test(t||"")?(t||"").split("-").map(Number):[],i=new Date,[l,h]=c.useState(r[0]||i.getFullYear()),[d,m]=c.useState(r[1]||null),[p,u]=c.useState(()=>s==="year"?"year":s==="month"?r[0]?"month":"year":r[1]?"day":r[0]?"month":"year"),[f,b]=c.useState(()=>Math.floor((r[0]||i.getFullYear())/12)*12),w=y=>{n(y),o()},v=(y,k,j,N)=>e.jsx("button",{type:"button",className:`menu-item${k?" active":""}`,style:{justifyContent:"center",padding:"7px 4px",fontSize:"var(--type-ui-13)"},onClick:j,children:y},y),g=(y,k,j,N)=>e.jsxs("div",{className:"mb-1.5 flex items-center gap-1",children:[k&&e.jsx(ye,{label:a("common.date.picker.prev.tip"),children:e.jsx("button",{type:"button",className:"tp-btn tp-btn-ghost",style:{padding:"2px 8px"},onClick:k,"aria-label":a("common.date.picker.prev.aria"),children:"‹"})}),e.jsx(ye,{label:N?a("common.date.picker.up.tip"):null,className:"flex-1",children:e.jsx("button",{type:"button",className:"mono-label",style:{flex:1,background:"none",border:"none",cursor:N?"pointer":"default",padding:"4px 0"},onClick:N||void 0,children:y})}),j&&e.jsx(ye,{label:a("common.date.picker.next.tip"),children:e.jsx("button",{type:"button",className:"tp-btn tp-btn-ghost",style:{padding:"2px 8px"},onClick:j,"aria-label":a("common.date.picker.next.aria"),children:"›"})})]});return e.jsxs("div",{className:"hand-card hc-r2 date-picker",role:"dialog","aria-label":a("common.date.picker.aria"),children:[p==="year"&&e.jsxs(e.Fragment,{children:[g(a("common.date.picker.year-range.title",{a:f,b:f+11}),()=>b(y=>y-12),()=>b(y=>y+12)),e.jsx("div",{className:"date-grid",style:{gridTemplateColumns:"repeat(3, 1fr)"},children:Array.from({length:12},(y,k)=>f+k).map(y=>v(y,y===r[0],()=>{if(h(y),s==="year")return w(String(y));u("month")}))})]}),p==="month"&&e.jsxs(e.Fragment,{children:[g(String(l),()=>h(y=>y-1),()=>h(y=>y+1),()=>u("year")),e.jsx("div",{className:"date-grid",style:{gridTemplateColumns:"repeat(3, 1fr)"},children:ua.map((y,k)=>v(a(y),l===r[0]&&k+1===r[1],()=>{if(m(k+1),s==="month")return w(`${l}-${String(k+1).padStart(2,"0")}`);u("day")}))}),e.jsx("button",{type:"button",className:"date-coarse",onClick:()=>w(String(l)),children:a("common.date.picker.just-year.label",{year:l})})]}),p==="day"&&e.jsxs(e.Fragment,{children:[g(a("common.date.month-year.label",{month:a(ua[(d||1)-1]),year:l}),null,null,()=>u("month")),e.jsx("div",{className:"date-grid",style:{gridTemplateColumns:"repeat(7, 1fr)"},children:Array.from({length:ic(l,d||1)},(y,k)=>k+1).map(y=>v(y,l===r[0]&&d===r[1]&&y===r[2],()=>w(`${l}-${String(d).padStart(2,"0")}-${String(y).padStart(2,"0")}`)))}),e.jsx("button",{type:"button",className:"date-coarse",onClick:()=>w(`${l}-${String(d||1).padStart(2,"0")}`),children:a("common.date.picker.just-month.label",{month:a(ua[(d||1)-1]),year:l})})]})]})}function ya({label:t,value:n,onChange:o,granularity:s="day",placeholder:r,hint:i,className:l=""}){const[h,d]=c.useState(!1),m=c.useRef(null),{popRef:p,style:u}=Mt(h,m,{minHeight:240});Lt(h,()=>d(!1),[m,p]);const f=!!n&&!ba(n),b=r||a(s==="year"?"common.field.year.placeholder":"common.field.date.placeholder");return e.jsxs("label",{className:"tp-field "+l,children:[t&&e.jsx(W,{children:t}),e.jsxs("span",{className:"relative flex items-center gap-2",ref:m,children:[e.jsx("input",{className:"tp-input",value:n||"",inputMode:"numeric",placeholder:b,maxLength:10,"aria-invalid":f||void 0,onChange:w=>o(w.target.value.replace(/[^\d-]/g,"").slice(0,10)),style:f?{borderColor:"var(--error)"}:void 0}),e.jsx(ye,{label:a("common.date.pick.tip"),className:"shrink-0",children:e.jsx("button",{type:"button",className:"tp-btn tp-btn-ghost tactile",style:{padding:"6px 9px",flex:"none"},"aria-label":a("common.date.pick.aria",{field:t||a("common.date.pick.field.fallback")}),"aria-expanded":h,onClick:()=>d(w=>!w),children:e.jsx(jc,{})})}),h&&Ve.createPortal(e.jsx("span",{ref:p,className:"date-pop",style:u,children:e.jsx(Bu,{value:n,granularity:s,onPick:o,onClose:()=>d(!1)})}),document.body)]}),(f||i)&&e.jsx("span",{style:{display:"block",marginTop:5,fontSize:"var(--type-ui-12)",lineHeight:1.4,color:f?"var(--error)":"var(--faint)"},children:f?a("error.validate.partial-date"):i})]})}function Hu({values:t=[],onChange:n,options:o,ariaLabel:s,allLabel:r="all",width:i}){const[l,h]=c.useState(!1),d=c.useRef(null),{popRef:m,style:p}=Mt(l,d,{matchWidth:"min",minHeight:140});Lt(l,()=>h(!1),[d,m]);const u=o.filter(([w])=>t.includes(w)),f=u.length===0?r:u.length===1?u[0][1]:`${u.length} states`,b=w=>n(t.includes(w)?t.filter(v=>v!==w):[...t,w]);return e.jsxs("span",{className:"tp-select",ref:d,style:i?{width:i}:void 0,children:[e.jsxs("button",{type:"button",className:"tp-select-trigger tactile","aria-label":s,"aria-expanded":l,onClick:()=>h(w=>!w),children:[e.jsx("span",{className:u.length?"":"tp-select-ph",children:f}),e.jsx("span",{className:"tp-select-chev","aria-hidden":"true",children:"▾"})]}),l&&Ve.createPortal(e.jsxs("span",{ref:m,className:"hand-card hc-r2 tp-select-panel tp-multi",role:"listbox","aria-multiselectable":"true",style:p,children:[o.map(([w,v,g])=>{const y=t.includes(w);return e.jsxs("button",{type:"button",role:"option","aria-selected":y,className:`menu-item${y?" active":""}`,onClick:()=>b(w),children:[e.jsx("span",{"aria-hidden":"true",style:{width:14,flex:"none",textAlign:"center"},children:y?"✓":""}),g&&e.jsx("span",{"aria-hidden":"true",style:{width:8,height:8,borderRadius:2,background:g,flex:"none"}}),v]},w)}),t.length>0&&e.jsxs("button",{type:"button",className:"menu-item",style:{color:"var(--soft)"},onClick:()=>n([]),children:[e.jsx("span",{"aria-hidden":"true",style:{width:14,flex:"none"}}),"clear"]})]}),document.body)]})}function Ma({color:t="yellow",style:n="sticker",className:o="",children:s,...r}){return e.jsx("span",{className:`tag-chip tc-${t} ts-${n} ${o}`,...r,children:s})}function hv({children:t}){return e.jsx("mark",{className:"hl",children:t})}function Bo({className:t="",children:n}){return e.jsxs("p",{className:"hand-note card-text "+t,children:[e.jsx("span",{className:"tick","aria-hidden":"true",children:"▍"}),n]})}function lc({className:t="",children:n}){return e.jsx("p",{className:"quote-translation card-text "+t,children:n})}function er(t=11,n=1.3){const o=(Math.random()*2-1)*t,s=.85+Math.random()*.32,r=(Math.random()*2-1)*n;return{"--grot":`${o.toFixed(1)}deg`,"--gscale":s.toFixed(3),"--gdy":`${r.toFixed(1)}px`}}const zu=()=>{var t;return typeof window<"u"&&((t=window.matchMedia)==null?void 0:t.call(window,"(prefers-reduced-motion: reduce)").matches)};function cc(t,n=3){const[o,s]=c.useState("");return{play:()=>{zu()||s(`${t}-${1+Math.floor(Math.random()*n)}`)},animClass:o,onAnimationEnd:()=>s("")}}function $u(){const t=c.useMemo(()=>er(13,0),[]);return e.jsx("span",{"aria-label":a("common.favourite.badge.aria"),className:"absolute right-1.5 top-1.5",style:{...t,color:"#ef5a5a",fontSize:"var(--type-ui-19)",lineHeight:1,filter:"drop-shadow(0 1px 2px rgba(0,0,0,.55))",transform:"rotate(var(--grot)) scale(var(--gscale))"},children:"♥"})}const ao="#7FA6C9",vt={wishlist:{color:"var(--faint)",book:"common.shelf.wishlist.book.label",movie:"common.shelf.wishlist.film.label"},reading:{color:ao,book:"common.shelf.reading.book.label",movie:"common.shelf.reading.film.label"},watching:{color:ao,book:"common.shelf.reading.book.label",movie:"common.shelf.reading.film.label"},playing:{color:ao,book:"common.shelf.playing.book.label",movie:"common.shelf.playing.film.label"},paused:{color:"var(--amber)",book:"common.shelf.paused.book.label",movie:"common.shelf.paused.film.label"},abandoned:{color:"var(--error)",book:"common.shelf.abandoned.book.label",movie:"common.shelf.abandoned.film.label"},completed:{color:"var(--ok)",book:"common.shelf.completed.book.label",movie:"common.shelf.completed.film.label"}},Wu=new Set(["reading","watching","playing"]);function It(t,n="book"){const o=vt[t];return o?a(n==="book"?o.book:o.movie):""}function tr({state:t,kind:n="book",progress:o=0,radius:s=0,title:r}){const i=vt[t];if(!i)return null;const l=Wu.has(t),h=l?Math.max(0,Math.min(100,o)):100,d=r||(l&&h>0?a("common.shelf.progress.label",{name:It(t,n),percent:h}):It(t,n));return e.jsx("div",{role:"img","aria-label":d,title:d,style:{height:5,background:`color-mix(in srgb, ${i.color} 22%, transparent)`,borderBottomLeftRadius:s,borderBottomRightRadius:s,overflow:"hidden"},children:e.jsx("div",{style:{width:`${h}%`,height:"100%",background:i.color,transition:"width .3s ease"}})})}function Uu({kind:t="book",stacked:n=!1}){const o=c.useMemo(()=>er(11,0),[]),s=t==="book",r=t==="game",i=a(r?"common.reading-badge.game.aria":s?"common.reading-badge.book.aria":"common.reading-badge.film.aria");return e.jsx("span",{"aria-label":i,title:i,className:"absolute left-1.5 reading-badge",style:{...o,top:n?26:6,background:ao,transform:"rotate(var(--grot))"},children:r?e.jsx(Vm,{size:15}):s?e.jsx(dr,{size:15}):e.jsx(xc,{size:15})})}function Va({state:t,label:n,tip:o,children:s}){const[r,i]=c.useState(!1),l=c.useRef(null),{popRef:h,style:d}=Mt(r,l,{align:"start",minHeight:160}),m=()=>i(!1);Lt(r,m,[l,h],{onEscape:()=>{var u,f;return(f=(u=l.current)==null?void 0:u.querySelector("button"))==null?void 0:f.focus()}});const p=(vt[t]||{}).color||"var(--soft)";return e.jsxs("span",{className:"relative",ref:l,style:{display:"inline-flex"},children:[e.jsx(ye,{label:o,side:"bottom",children:e.jsxs("button",{type:"button",className:"tp-chip tp-chip-btn",style:{gap:6,color:p,borderColor:"color-mix(in srgb, currentColor 45%, transparent)"},"aria-expanded":r,"aria-haspopup":"true",onClick:()=>i(u=>!u),children:[e.jsx("span",{"aria-hidden":"true",style:{width:8,height:8,borderRadius:2,background:p,flex:"none"}}),n]})}),r&&Ve.createPortal(e.jsx("div",{ref:h,className:"hand-card hc-r2 more-menu",style:{...d,minWidth:210,maxWidth:280},role:"menu",children:typeof s=="function"?s(m):s}),document.body)]})}function Pn({value:t,onChange:n}){const o=c.useMemo(()=>er(9,1),[]),{play:s,animClass:r,onAnimationEnd:i}=cc("anim-heart",3);return e.jsx(ye,{label:a(t?"common.action.favourite.off.label":"common.action.favourite.on.label"),children:e.jsx("button",{type:"button",className:`heart ${r}${t?" on":""}`,style:o,"aria-pressed":!!t,onAnimationEnd:i,onClick:n?()=>{s(),n(!t)}:void 0,children:t?"♥":"♡"})})}function dc(t,n=150,o=96,s=240){const[r,i]=c.useState(()=>{const l=Number(typeof localStorage<"u"&&localStorage.getItem(t));return l>=o&&l<=s?l:sc()?100:n});return c.useEffect(()=>{try{localStorage.setItem(t,String(r))}catch{}},[t,r]),[r,i]}function La({open:t}){return e.jsx("span",{"aria-hidden":"true",className:"clamp-more","data-open":t?"1":"0",children:e.jsx("svg",{width:"15",height:"15",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.4",strokeLinecap:"round",strokeLinejoin:"round",children:e.jsx("polyline",{points:"6 9 12 15 18 9"})})})}function hc(t,n){return t?{role:"button",tabIndex:0,onClick:n,onKeyDown:o=>{(o.key==="Enter"||o.key===" ")&&(o.preventDefault(),n())}}:{}}function js({text:t,style:n,lines:o=3,className:s=""}){const[r,i]=c.useState(!1),[l,h]=c.useState(!1),d=c.useRef(null);if(c.useEffect(()=>{const u=d.current;if(!u)return;const f=()=>h(u.scrollHeight>u.clientHeight+2);f();const b=new ResizeObserver(f);return b.observe(u),()=>b.disconnect()},[t,r,o]),!t)return null;const m=l||r,p=r?null:{display:"-webkit-box",WebkitLineClamp:o,WebkitBoxOrient:"vertical",overflow:"hidden"};return e.jsxs("div",{className:`clampable${m?" is-clickable":""} ${s}`.trim(),"aria-expanded":m?r:void 0,...hc(m,()=>i(u=>!u)),children:[e.jsx("p",{ref:d,style:{whiteSpace:"pre-wrap",color:"var(--soft)",fontSize:"var(--type-ui-15)",lineHeight:1.55,margin:0,...n,...p},children:t}),m&&e.jsx(ye,{label:a(r?"common.action.show-less.label":"common.clamp.description.more.tip"),side:"bottom",className:"flex w-full justify-center",children:e.jsx(La,{open:r})})]})}function $e(t,n){const[o,s]=c.useState(()=>{try{const r=localStorage.getItem(t);return r==null?n:JSON.parse(r)}catch{return n}});return c.useEffect(()=>{try{localStorage.setItem(t,JSON.stringify(o))}catch{}},[t,o]),[o,s]}function Ho({text:t,lines:n=5,style:o,className:s="",open:r,onToggle:i}){const[l,h]=c.useState(!1),d=r!==void 0,m=d?r:l,p=()=>d?i==null?void 0:i():h(g=>!g),[u,f]=c.useState(!1),b=c.useRef(null);if(c.useEffect(()=>{const g=b.current;if(!g)return;const y=()=>f(g.scrollHeight>g.clientHeight+2);y();const k=new ResizeObserver(y);return k.observe(g),()=>k.disconnect()},[t,m,n]),!t)return null;const w=u||m,v=m?null:{display:"-webkit-box",WebkitLineClamp:n,WebkitBoxOrient:"vertical",overflow:"hidden"};return e.jsxs("div",{className:`clampable card-text${w?" is-clickable":""} ${s}`.trim(),"aria-expanded":w?m:void 0,...hc(w,p),children:[e.jsx("p",{ref:b,style:{whiteSpace:"pre-wrap",margin:0,...o,...v},children:t}),w&&e.jsx(ye,{label:a(m?"common.action.show-less.label":"common.clamp.text.more.tip"),side:"bottom",className:"flex w-full justify-center",children:e.jsx(La,{open:m})})]})}let vi=!1;function Gu(){vi||typeof document>"u"||(vi=!0,!matchMedia("(prefers-reduced-motion: reduce)").matches&&document.addEventListener("pointerdown",t=>{const n=t.target.closest&&t.target.closest(".tactile, .tp-btn");if(!n)return;const o=n.getBoundingClientRect();n.style.setProperty("--px",`${t.clientX-o.left}px`),n.style.setProperty("--py",`${t.clientY-o.top}px`),n.dataset.pressing="1";const s=()=>{n.dataset.pressing="0",window.removeEventListener("pointerup",s),window.removeEventListener("pointercancel",s)};window.addEventListener("pointerup",s),window.addEventListener("pointercancel",s)},!0))}function Da(t){let n=t>>>0||1;return function(){n=n+1831565813|0;let o=Math.imul(n^n>>>15,1|n);return o=o+Math.imul(o^o>>>7,61|o)^o,((o^o>>>14)>>>0)/4294967296}}function nr(t,n,o=3,s=5){const r=s-o+1,i=[];for(let l=0;l<t;l++){let h=o+Math.floor(n()*r);if(l>=2&&i[l-1]===i[l-2]&&i[l-1]===h){const d=Math.floor(n()*(r-1));h=o+(d>=h-o?d+1:d)}i.push(h)}return i}function Vu(t,n,o=s=>s.key){return t.map((s,r)=>{const i=String(o(s)??r);let l=n>>>0^2166136261;for(let h=0;h<i.length;h++)l^=i.charCodeAt(h),l=Math.imul(l,16777619);return{item:s,key:i,rank:Da(l)()}}).sort((s,r)=>s.rank-r.rank||(s.key<r.key?-1:s.key>r.key?1:0)).map(s=>s.item)}function zo({columns:t=2,gap:n=24,seed:o=1,pinnedCount:s=0,lockOrder:r=!1,order:i="height",className:l="",children:h}){const d=c.useMemo(()=>c.Children.toArray(h),[h]),m=d.length,p=Math.max(1,t),u=c.useRef([]),f=c.useMemo(()=>{const q=new Array(d.length+1);let C=0;q[0]=0;for(let I=0;I<d.length;I++){const O=String(d[I].key);for(let V=0;V<O.length;V++)C=Math.imul(C,31)+O.charCodeAt(V)|0;q[I+1]=C}return q},[d]),b=f[d.length],w=c.useRef(null),v=c.useRef(!1),g=c.useRef(""),y=c.useRef(!1),k=c.useRef(0),j=c.useRef(0),N=c.useRef(""),[S,x]=c.useState([]),[L,A]=c.useState(0);c.useLayoutEffect(()=>{const q=`${m}|${p}|${o}|${s}|${b}`,C=g.current!==q,I=`${p}|${o}|${s}`,O=N.current===I&&w.current&&k.current<m&&w.current.colOf.length===k.current&&f[k.current]===j.current?w.current:null;N.current=I,k.current=m,j.current=b,C&&(g.current=q,O||(v.current=!1,w.current=null)),r&&!y.current&&!C&&(v.current=!0),y.current=r;const V=()=>{const B=u.current.slice(0,m).map(R=>R?R.getBoundingClientRect().height:0),_=Math.max(0,Math.min(s,m));let U=w.current;if(!U||U.colOf.length!==m||!v.current){const R=B.map(z=>Math.round(z)),G=z=>{if(i==="source")return Array.from({length:m-z},(pe,de)=>de+z);const te=Math.max(z,_),J=Array.from({length:m-te},(pe,de)=>de+te).sort((pe,de)=>R[de]-R[pe]||pe-de),fe=new Array(m);J.forEach((pe,de)=>fe[pe]=de);const me=Da(o),H=new Array(m);for(let pe=0;pe<J.length;pe++){const de=me()<.2,se=me()<.5?2:3,Y=me()<.5;H[J[pe]]=pe+(de?Y?-se:se:0)}const ee=J.slice().sort((pe,de)=>H[pe]-H[de]||fe[pe]-fe[de]),oe=[];for(let pe=z;pe<te;pe++)oe.push(pe);for(const pe of ee)oe.push(pe);return oe},K=O?[...O.order,...G(O.colOf.length)]:G(0),M=new Array(m),Q=Array(p).fill(0);for(const z of K){let te;if(O&&z<O.colOf.length)te=O.colOf[z];else{te=0;for(let J=1;J<p;J++)Q[J]<Q[te]&&(te=J)}M[z]=te,Q[te]+=R[z]+n}U={order:K,colOf:M},w.current=U}const F=Array(p).fill(0),X=new Array(m);for(const R of U.order){const G=U.colOf[R];X[R]={col:G,top:F[G]},F[G]+=B[R]+n}x(R=>R.length===m&&R.every((G,K)=>G.col===X[K].col&&G.top===X[K].top)?R:X),A(Math.max(0,...F.map(R=>R-n)))};if(V(),typeof ResizeObserver>"u")return;const P=new ResizeObserver(V);return u.current.slice(0,m).forEach(T=>T&&P.observe(T)),()=>P.disconnect()},[m,p,n,o,s,r,b,i]);const E=`calc((100% - ${(p-1)*n}px) / ${p})`,D=q=>p<=1?"0px":`calc(${q} * (100% + ${n}px) / ${p})`;return e.jsx("div",{className:l,style:{position:"relative",height:L||void 0},children:d.map((q,C)=>{const I=S[C];return e.jsx("div",{ref:O=>u.current[C]=O,style:{position:"absolute",width:p<=1?"100%":E,left:I?D(I.col):0,top:I?I.top:0,visibility:I?"visible":"hidden"},children:q},C)})})}function uc(t,n){let o=0,s=1/0;for(let r=0;r<t.length;r++){const i=Math.abs(n-t[r].center);i<s&&(s=i,o=r)}return o}function dt({value:t,onChange:n,options:o,label:s,ariaLabel:r,className:i="",disabled:l=!1}){const h=c.useRef(null),d=c.useRef(null),m=c.useRef(null),p=c.useRef(!1),u=c.useRef(0);c.useEffect(()=>()=>dn(u.current),[]);const f=o.findIndex(([y])=>y===t);c.useLayoutEffect(()=>{const y=h.current,k=d.current;if(!y||!k)return;const j=()=>{if(f<0){k.style.opacity="0";return}const S=y.querySelectorAll(".tp-toggle-opt")[f];S&&(k.style.opacity="1",k.style.width=`${S.offsetWidth}px`,k.style.transform=`translateX(${S.offsetLeft}px)`)};j();const N=new ResizeObserver(j);return N.observe(y),()=>N.disconnect()},[f,t,o.length]);const b=y=>{const k=m.current,j=h.current,N=d.current;if(!k||!j||!N)return;if(!k.moved){if(Math.abs(y.clientX-k.startX)<5)return;k.moved=!0,j.dataset.dragging="1"}const S=y.clientX-k.left,x=k.opts[k.opts.length-1],L=k.opts[0].left,A=x.left+x.width-k.thumbW,E=Math.max(L,Math.min(A,S-k.grab));N.style.transform=`translateX(${E}px)`,k.hover=uc(k.opts,E+k.thumbW/2),j.style.setProperty("--px",`${S}px`),j.style.setProperty("--py",`${y.clientY-k.top}px`),j.dataset.pressing="1"},w=()=>{const y=m.current,k=h.current;if(m.current=null,window.removeEventListener("pointermove",b),window.removeEventListener("pointerup",w),!!k&&(k.dataset.pressing="0",y&&y.moved)){k.dataset.dragging="0",p.current=!0,setTimeout(()=>{p.current=!1},0);const j=o[y.hover]&&o[y.hover][0];if(j!=null&&j!==t)n(j);else{const N=k.querySelectorAll(".tp-toggle-opt")[f],S=d.current;N&&S&&(S.style.transform=`translateX(${N.offsetLeft}px)`)}}},v=y=>{if(l)return;const k=h.current,j=d.current;if(!k||!j||f<0||y.button!=null&&y.button!==0)return;const N=[...k.querySelectorAll(".tp-toggle-opt")];if(!N[f])return;const S=k.getBoundingClientRect(),x=N[f].offsetWidth,L=Math.max(0,Math.min(x,y.clientX-S.left-N[f].offsetLeft));m.current={startX:y.clientX,moved:!1,hover:f,grab:L,left:S.left,top:S.top,thumbW:x,opts:N.map(A=>({left:A.offsetLeft,width:A.offsetWidth,center:A.offsetLeft+A.offsetWidth/2}))},window.addEventListener("pointermove",b),window.addEventListener("pointerup",w)},g=e.jsxs("div",{ref:h,role:"tablist","aria-label":r||s,className:`tp-toggle tactile${l?" is-disabled":""} ${i}`,"aria-disabled":l||void 0,onPointerDown:v,children:[e.jsx("span",{ref:d,className:"tp-toggle-thumb","aria-hidden":"true"}),o.map(([y,k,j])=>e.jsx("button",{type:"button",role:"tab","aria-selected":t===y,"aria-pressed":t===y,className:"tp-toggle-opt"+(t===y?" is-on":""),disabled:l,onPointerEnter:N=>{!j||N.pointerType==="touch"||(dn(u.current),u.current=qc(j,N.currentTarget.getBoundingClientRect(),"bottom"))},onPointerLeave:()=>{dn(u.current),u.current=0},onClick:()=>{if(dn(u.current),u.current=0,p.current){p.current=!1;return}n(y)},children:k},y))]});return s?e.jsxs("div",{children:[e.jsx(W,{className:"mb-2 block",children:s}),g]}):g}function yt({value:t=[],onChange:n,suggestions:o=[],placeholder:s,ariaLabel:r,transform:i,nameCase:l=!1}){const[h,d]=c.useState(""),[m,p]=c.useState(!1),[u,f]=c.useState(0),b=c.useRef(null),w=c.useRef(null),v=E=>i?i(E):E,g=d,y=h.trim().toLowerCase(),k=o.filter(E=>!t.includes(E)&&(!y||E.toLowerCase().includes(y))).slice(0,8),j=E=>{const D=Cs(String(E||"")).map(v).filter(Boolean);if(D.length){const q=[...t];for(const C of D)q.includes(C)||q.push(C);n(q)}d(""),f(0),p(!1)};c.useEffect(()=>{const E=[];for(const q of t)for(const C of Cs(q).map(v))C&&!E.includes(C)&&E.push(C);E.length===t.length&&E.every((q,C)=>q===t[C])||n(E)},[t]);const N=E=>n(t.filter((D,q)=>q!==E)),S=E=>{E.key==="Enter"||E.key===","?(E.preventDefault(),j(m&&k[u]?k[u]:h)):E.key==="Backspace"&&!h&&t.length?N(t.length-1):E.key==="ArrowDown"?(E.preventDefault(),p(!0),f(D=>Math.min(D+1,k.length-1))):E.key==="ArrowUp"?(E.preventDefault(),f(D=>Math.max(D-1,0))):E.key==="Escape"&&p(!1)},x=m&&k.length>0,{popRef:L,style:A}=Mt(x,b,{matchWidth:!0,minHeight:120});return Lt(x,()=>p(!1),[b,L],{event:"pointerdown"}),e.jsxs("div",{className:"token-input",ref:b,children:[e.jsxs("div",{className:"tp-input token-field",onClick:()=>w.current&&w.current.focus(),children:[t.map((E,D)=>e.jsxs("span",{className:"token-pill",children:[E,e.jsx(ye,{label:a("common.action.remove.aria",{name:E}),children:e.jsx("button",{type:"button",className:"token-x",onClick:()=>N(D),"aria-label":a("common.action.remove.aria",{name:E}),children:"×"})})]},E)),e.jsx("input",{ref:w,className:"token-entry",autoCapitalize:l?"words":void 0,value:h,placeholder:t.length?"":s||a("common.field.token.placeholder"),"aria-label":r,autoComplete:"off",onChange:E=>{g(E.target.value),p(!0),f(0)},onFocus:()=>p(!0),onKeyDown:S,onBlur:E=>{b.current&&b.current.contains(E.relatedTarget)||L.current&&L.current.contains(E.relatedTarget)||(h.trim()?j(h):p(!1))}})]}),x&&Ve.createPortal(e.jsx("ul",{ref:L,className:"token-menu",style:A,children:k.map((E,D)=>e.jsx("li",{children:e.jsx("button",{type:"button",className:"token-opt"+(D===u?" hi":""),onMouseEnter:()=>f(D),onClick:()=>j(E),children:E})},E))}),document.body)]})}function De({value:t,onChange:n,options:o,ariaLabel:s,placeholder:r,className:i="",width:l,disabled:h=!1,filter:d=!1,filterPlaceholder:m}){const[p,u]=c.useState(!1),[f,b]=c.useState(0),[w,v]=c.useState(""),g=c.useRef(null),y=c.useRef(null),k=c.useRef(null),j=o.findIndex(([P])=>P===t),N=j>=0?o[j][1]:r||a("common.field.select.placeholder"),S=d?w.trim().toLowerCase():"",x=([,P,T])=>String(T??(typeof P=="string"?P:"")).toLowerCase(),L=S?o.filter(P=>x(P).includes(S)):o,A=c.useRef(null),E=c.useRef(!1),D=()=>{const P=A.current;P&&(A.current=null,window.removeEventListener("pointermove",P.move),window.removeEventListener("pointerup",P.up),window.removeEventListener("pointercancel",P.up),y.current&&(y.current.dataset.dragging="0"))},q=P=>{const T=A.current,B=y.current,_=k.current;if(!T||!B||!_)return;if(!T.moved){if(Math.abs(P.clientY-T.startY)<5)return;T.moved=!0,B.dataset.dragging="1"}const U=B.getBoundingClientRect(),F=P.clientY-U.top+B.scrollTop,X=T.opts[T.opts.length-1],R=T.opts[0].top,G=X.top+X.height-T.thumbH,K=Math.max(R,Math.min(G,F-T.grab));_.style.transform=`translateY(${K}px)`;const M=uc(T.opts,K+T.thumbH/2);if(M!==T.hover&&(T.hover=M,b(M)),B.scrollHeight>B.clientHeight){const Q=P.clientY-U.top;Q<24?B.scrollTop-=8:Q>U.height-24&&(B.scrollTop+=8)}},C=()=>{const P=A.current;if(D(),!P||!P.moved)return;E.current=!0,setTimeout(()=>{E.current=!1},0);const T=L[P.hover];T&&(n(T[0]),u(!1))},I=P=>{const T=y.current,B=k.current;if(!T||!B||P.button!=null&&P.button!==0||P.pointerType!=="mouse"&&T.dataset.scroll==="1")return;const _=[...T.querySelectorAll(".tp-select-opt")],U=_[f]?f:0;if(!_[U])return;const F=T.getBoundingClientRect(),X=_[U].offsetHeight,R=P.clientY-F.top+T.scrollTop;A.current={startY:P.clientY,moved:!1,hover:U,grab:Math.max(0,Math.min(X,R-_[U].offsetTop)),thumbH:X,opts:_.map(G=>({top:G.offsetTop,height:G.offsetHeight,center:G.offsetTop+G.offsetHeight/2})),move:q,up:C},window.addEventListener("pointermove",q),window.addEventListener("pointerup",C),window.addEventListener("pointercancel",C)};c.useEffect(()=>{p||D()},[p]),c.useEffect(()=>D,[]),c.useEffect(()=>{p&&b(j>=0?j:0)},[p]),c.useLayoutEffect(()=>{if(!p)return;const P=y.current,T=k.current;if(!P||!T||(P.dataset.scroll=P.scrollHeight>P.clientHeight?"1":"0",A.current&&A.current.moved))return;const B=P.querySelectorAll(".tp-select-opt")[f];B&&(T.style.height=`${B.offsetHeight}px`,T.style.transform=`translateY(${B.offsetTop}px)`,T.style.opacity="1")},[p,f,L.length]),c.useEffect(()=>{p||v("")},[p]),c.useEffect(()=>{b(P=>P<L.length?P:0)},[L.length]);const{popRef:O,style:V}=Mt(p,g,{matchWidth:"min",minHeight:140});return Lt(p,()=>u(!1),[g,O]),c.useEffect(()=>{if(!p)return;const P=T=>{if(T.key==="Escape")return u(!1);T.key==="ArrowDown"?(T.preventDefault(),b(B=>Math.min(L.length-1,B+1))):T.key==="ArrowUp"?(T.preventDefault(),b(B=>Math.max(0,B-1))):T.key==="Enter"&&L[f]&&(T.preventDefault(),n(L[f][0]),u(!1))};return document.addEventListener("keydown",P),()=>document.removeEventListener("keydown",P)},[p,f,L,n]),e.jsxs("div",{className:`tp-select ${i}`,ref:g,style:l?{width:l}:void 0,children:[e.jsxs("button",{type:"button",className:"tp-select-trigger tactile","aria-haspopup":"listbox","aria-expanded":p,"aria-label":s,disabled:h,onClick:()=>{if(E.current){E.current=!1;return}u(P=>!P)},children:[e.jsx("span",{className:j>=0?"":"tp-select-ph",children:N}),e.jsx("svg",{className:"tp-select-chev",width:"14",height:"14",viewBox:"0 0 16 16",fill:"none",stroke:"currentColor",strokeWidth:"1.7",strokeLinecap:"round",strokeLinejoin:"round","aria-hidden":"true",children:e.jsx("path",{d:"m4 6 4 4 4-4"})})]}),p&&Ve.createPortal(e.jsxs("div",{className:"tp-select-panel",role:"listbox",ref:P=>{y.current=P,O.current=P},onPointerDown:I,style:V,children:[e.jsx("span",{className:"tp-select-thumb",ref:k,"aria-hidden":"true"}),d&&e.jsx("input",{className:"tp-select-filter",type:"text",autoFocus:!0,value:w,placeholder:m||a("common.field.filter.placeholder"),"aria-label":m||a("common.field.filter.placeholder"),onChange:P=>v(P.target.value),onPointerDown:P=>P.stopPropagation()}),d&&L.length===0&&e.jsx("span",{className:"tp-select-empty",children:a("common.field.filter.none")}),L.map(([P,T],B)=>e.jsx("button",{type:"button",role:"option","aria-selected":P===t,className:"tp-select-opt tactile"+(B===f?" is-hi":""),onMouseEnter:()=>b(B),onClick:()=>{if(E.current){E.current=!1;return}n(P),u(!1)},children:T},P))]}),document.body)]})}function mt({open:t,title:n,body:o,confirmLabel:s,confirmDisabled:r=!1,onConfirm:i,onCancel:l}){return c.useEffect(()=>{if(!t)return;const h=d=>d.key==="Escape"&&l&&l();return document.addEventListener("keydown",h),()=>document.removeEventListener("keydown",h)},[t,l]),Nt(t),t?e.jsx("div",{className:"tp-scrim fixed inset-0 z-50 flex items-center justify-center px-4 py-10",onMouseDown:h=>{h.target===h.currentTarget&&l&&l()},children:e.jsxs("div",{role:"dialog","aria-modal":"true","aria-label":n,className:"hand-card hc-r2 w-full max-w-md px-6 py-6",children:[e.jsx("h2",{className:"display-title mb-2",style:{fontSize:"var(--type-ui-19)"},children:n}),o&&e.jsx("div",{className:"mb-5",style:{color:"var(--soft)",fontSize:"var(--type-ui-15)",lineHeight:1.55},children:o}),e.jsxs("div",{className:"flex justify-end gap-2",children:[e.jsx(ge,{onClick:l,children:a("common.action.cancel.label")}),e.jsx(an,{onClick:i,disabled:r,children:s||a("common.action.confirm.label")})]})]})}):null}const ar=c.createContext(null);function Ku(){const t=c.useRef(new Map),[n,o]=c.useState([]),s=c.useCallback((h,d)=>{d?t.current.set(h,d):t.current.delete(h),o([...t.current.keys()])},[]),r=c.useMemo(()=>({register:s}),[s]),i=c.useCallback(()=>[...t.current.values()],[]),l=c.useCallback(()=>{var h;for(const d of[...t.current.values()])(h=d.close)==null||h.call(d)},[]);return{host:r,count:n.length,collect:i,closeAll:l}}const Ss=c.createContext(null);function $o(t){const n=c.useContext(Ss),o=n==null?void 0:n.setBlocked;return c.useEffect(()=>{if(o)return o(t||""),()=>o(null)},[o,t]),n}function uv(){const[t,n]=c.useState([]),o=c.useRef(0);o.current=t.length,c.useEffect(()=>{const h=d=>{var p;const m=((p=d.state)==null?void 0:p.tpPanelDepth)||0;m<o.current&&n(u=>u.slice(0,m))};return window.addEventListener("popstate",h),()=>window.removeEventListener("popstate",h)},[]),c.useEffect(()=>()=>{var d;const h=o.current;h>0&&((d=window.history.state)!=null&&d.tpPanelDepth)&&window.history.go(-h)},[]);const s=c.useCallback(h=>{n(d=>{const m=d.concat(h);return window.history.pushState({...window.history.state,tpPanelDepth:m.length},""),m})},[]),r=c.useCallback(h=>{const d=o.current;d>0&&window.history.go(-d),requestAnimationFrame(()=>s(h))},[s]),i=c.useCallback(()=>{o.current>0&&window.history.back()},[]),l=c.useCallback(()=>{const h=o.current;h>0&&window.history.go(-h)},[]);return{stack:t,top:t[t.length-1]||null,open:r,push:s,back:i,close:l}}function mv({stack:t}){const{stack:n,back:o,close:s}=t,r=n[n.length-1]||null,i=n.length>1,l=i?n[n.length-2]:null;if(Nt(!!r),c.useEffect(()=>{if(!r)return;const d=m=>m.key==="Escape"&&o();return document.addEventListener("keydown",d),()=>document.removeEventListener("keydown",d)},[r,o]),!r)return null;const h=r.headVerb||null;return Ve.createPortal(e.jsx("div",{className:"tp-scrim tp-panel-scrim fixed inset-0 z-50 flex justify-center",onMouseDown:d=>{d.target===d.currentTarget&&s()},children:e.jsxs("div",{role:"dialog","aria-modal":"true","aria-label":r.title,className:"tp-panel",style:r.wide?{width:"min(900px, 100%)"}:void 0,onMouseDown:d=>d.stopPropagation(),children:[e.jsxs("div",{className:"tp-panel-head",children:[e.jsx("div",{className:"tp-panel-slot",children:i&&e.jsxs("button",{type:"button",className:"tp-panel-back tactile","aria-label":a("common.panel.back.aria",{title:l.title}),onClick:o,children:[e.jsx($t,{}),e.jsx("span",{className:"tp-panel-back-word",children:l.title})]})}),e.jsx("h2",{className:"tp-panel-title",children:r.title}),e.jsxs("div",{className:"tp-panel-slot tp-panel-slot-r",children:[h,!i&&e.jsx(We,{icon:e.jsx(it,{}),ariaLabel:a("common.action.close.label"),tooltip:a("common.form.close.tip"),onClick:s})]})]}),e.jsx(Po,{axis:"v",className:"tp-panel-body",children:typeof r.render=="function"?r.render():r.render})]})}),document.body)}function Ke({open:t=!0,onClose:n,title:o,maxWidth:s=560,saveTip:r,children:i}){const l=Ie();Nt(t),qa(t&&!l,n);const h=c.useId(),[d,m]=c.useState(null),p=c.useMemo(()=>({formId:h,setBlocked:m}),[h]);if(c.useEffect(()=>{if(!t)return;const f=b=>b.key==="Escape"&&n&&n();return document.addEventListener("keydown",f),()=>document.removeEventListener("keydown",f)},[t,n]),c.useEffect(()=>{t||m(null)},[t]),!t)return null;const u=d===null?null:e.jsx(We,{icon:e.jsx(wt,{}),type:"submit",form:h,ariaLabel:a("common.action.save.label"),tooltip:d||r||a("common.action.save.label"),disabled:!!d,style:{width:34,height:34,padding:0,flexShrink:0},wrapClassName:"shrink-0"});return l?Ve.createPortal(e.jsx(yn,{open:t,onClose:n,title:o,actions:u,children:e.jsx(Ss.Provider,{value:p,children:i})}),document.body):Ve.createPortal(e.jsx("div",{className:"tp-scrim fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-4 py-10",onMouseDown:f=>{f.target===f.currentTarget&&n&&n()},children:e.jsxs("div",{role:"dialog","aria-modal":"true","aria-label":o,className:"hand-card hc-r2 w-full",style:{maxWidth:s,padding:"18px 20px 20px"},children:[e.jsxs("div",{className:"mb-3 flex items-center gap-2",children:[e.jsx("h2",{className:"display-title flex-1",style:{fontSize:"var(--type-ui-19)"},children:o}),u,e.jsx(We,{icon:e.jsx(it,{}),ariaLabel:a("common.action.close.label"),tooltip:a("common.form.close.tip"),onClick:n,style:{width:34,height:34,padding:0,flexShrink:0},wrapClassName:"shrink-0"})]}),e.jsx(Ss.Provider,{value:p,children:i})]})}),document.body)}const mc=500,Yu=400,wo=10,ki=8,Qu=3e3;function ye({label:t,side:n="top",className:o="",onContextMenu:s,shortcut:r,shiftKey:i=!1,children:l}){t=Ie()?t:Cu(t,r,i);const h=c.useRef(null),d=c.useRef(null),m=c.useRef(null),p=c.useRef(!1),u=c.useRef(null),f=c.useRef(0),b=c.useRef(null),w=c.useRef(!1);if(c.useEffect(()=>()=>{clearTimeout(d.current),dn(f.current)},[]),!t)return l;const v=/(?:^|\s)is-open(?:\s|$)/.test(o),g=()=>{var C;const q=(C=u.current)==null?void 0:C.getBoundingClientRect();return q&&q.width?q:null},y=(q=!1)=>{v||(dn(f.current),f.current=qc(t,g(),n,!q))},k=()=>{dn(f.current),f.current=0},j=()=>{clearTimeout(h.current),h.current=null},N=()=>{clearTimeout(d.current),d.current=null,b.current=null},S=q=>{N(),b.current={x:q.clientX,y:q.clientY},d.current=setTimeout(()=>{d.current=null,w.current&&y(!0)},Yu)},x=q=>{q.pointerType==="touch"||v||(w.current=!0,S(q))},L=q=>{q.pointerType==="touch"&&(p.current=!1,m.current={x:q.clientX,y:q.clientY},j(),h.current=setTimeout(()=>{p.current=!0,!v&&cp(t,g(),n)},mc))},A=q=>{if(q.pointerType!=="touch"){if(!d.current||!b.current)return;(Math.abs(q.clientX-b.current.x)>ki||Math.abs(q.clientY-b.current.y)>ki)&&S(q);return}!h.current||!m.current||(Math.abs(q.clientX-m.current.x)>wo||Math.abs(q.clientY-m.current.y)>wo)&&j()},E=q=>{if(!p.current){N(),k();return}p.current=!1,q.preventDefault(),q.stopPropagation()},D=q=>{var I,O;let C=!1;try{C=!!((O=(I=q.target).matches)!=null&&O.call(I,":focus-visible"))}catch{C=!1}C&&y()};return e.jsx("span",{ref:u,className:`tp-tip-wrap ${o}`,onPointerEnter:x,onPointerLeave:()=>{w.current=!1,j(),N(),k()},onPointerDown:L,onPointerMove:A,onPointerUp:j,onPointerCancel:()=>{w.current=!1,j(),N(),k()},onClickCapture:E,onFocus:D,onBlur:k,onContextMenu:q=>{q.preventDefault(),s&&(q.stopPropagation(),s(q))},children:l})}const pc=8,fc=4;function Zu(t,n,o,s,r={}){const{prefer:i="below",matchWidth:l=!1,align:h="start",gap:d=fc,minHeight:m=120,margin:p=pc}=r,u=n.h-t.bottom-d-p,f=t.top-d-p,b=i!=="above",w=b?o<=u:o<=f,v=b?u>=f:f>=u,g=b?w||v:!(w||v),y=Math.max(m,g?u:f),k=Math.min(o,y),j=l==="min"?t.width:0,N=Math.max(s,j),S=l===!0?t.width:Math.min(N,n.w-p*2),x=h==="end"?t.right-S:t.left;return{top:g?t.bottom+d:Math.max(p,t.top-d-k),left:Math.max(p,Math.min(x,n.w-S-p)),width:l===!0?S:void 0,minWidth:l==="min"?t.width:void 0,maxHeight:y,down:g}}function Mt(t,n,o={}){const{prefer:s="below",matchWidth:r=!1,align:i="start",gap:l=fc,minHeight:h=120,at:d=null}=o,m=c.useRef(null),[p,u]=c.useState(null);c.useLayoutEffect(()=>{if(!t){u(null);return}const b=()=>{const w=n==null?void 0:n.current,v=m.current;if(!v||!w&&!d)return;const g=d?{top:d.y,bottom:d.y,left:d.x,right:d.x,width:0}:w.getBoundingClientRect();u(Zu(g,{w:window.innerWidth,h:window.innerHeight},v.scrollHeight,v.offsetWidth,{prefer:s,matchWidth:r,align:i,gap:l,minHeight:h}))};return b(),window.addEventListener("scroll",b,!0),window.addEventListener("resize",b),()=>{window.removeEventListener("scroll",b,!0),window.removeEventListener("resize",b)}},[t,n,s,r,i,l,h,d==null?void 0:d.x,d==null?void 0:d.y]);const f={position:"fixed",top:(p==null?void 0:p.top)??0,left:(p==null?void 0:p.left)??0,right:"auto",bottom:"auto",maxWidth:`calc(100vw - ${pc*2}px)`,visibility:p?void 0:"hidden",...p!=null&&p.width?{width:p.width}:null,...p!=null&&p.minWidth?{minWidth:p.minWidth}:null,...p?{maxHeight:p.maxHeight}:null};return{popRef:m,pos:p,style:f,placedAbove:p?!p.down:!1}}function Lt(t,n,o,s={}){const{onEscape:r,event:i="mousedown"}=s,l=Array.isArray(i)?i:[i];c.useEffect(()=>{if(!t)return;const h=m=>{var p;for(const u of o)if((p=u==null?void 0:u.current)!=null&&p.contains(m.target))return;n()},d=m=>{m.key==="Escape"&&(n(),r==null||r())};for(const m of l)document.addEventListener(m,h);return document.addEventListener("keydown",d),()=>{for(const m of l)document.removeEventListener(m,h);document.removeEventListener("keydown",d)}},[t,n,r,l.join(),...o])}function Xu({anchor:t,title:n,pinned:o=!0,onHold:s,onLeave:r,onClose:i,children:l}){const h=Ie(),d=c.useRef(null),[m,p]=c.useState(null);c.useLayoutEffect(()=>{if(h)return;const f=()=>{const b=t==null?void 0:t.current,w=d.current;if(!b||!w)return;const v=b.getBoundingClientRect(),g=window.innerWidth,y=window.innerHeight,k=w.offsetWidth,j=w.offsetHeight,N=v.bottom+12+j<=y-10,S=N?v.bottom+12:Math.max(10,v.top-12-j),x=Math.max(12,Math.min(v.left+v.width/2-k/2,g-k-12));p({top:S,left:x,below:N,caret:Math.max(14,Math.min(v.left+v.width/2-x,k-14))})};return f(),window.addEventListener("scroll",f,!0),window.addEventListener("resize",f),()=>{window.removeEventListener("scroll",f,!0),window.removeEventListener("resize",f)}},[h,t]),c.useEffect(()=>{const f=b=>b.key==="Escape"&&i();return document.addEventListener("keydown",f),()=>document.removeEventListener("keydown",f)},[i]);const u=e.jsxs(e.Fragment,{children:[e.jsx("p",{className:"info-pop-title",children:n}),e.jsx("div",{className:"info-pop-body",children:l})]});return h?Ve.createPortal(e.jsx("div",{className:"info-pop-scrim",onMouseDown:i,role:"presentation",children:e.jsxs("div",{className:"info-pop info-pop-centred hand-card hc-r2",role:"dialog","aria-label":n,onMouseDown:f=>f.stopPropagation(),children:[u,e.jsx("button",{type:"button",className:"info-pop-close tp-btn tp-btn-ghost tactile",onClick:i,children:a("common.action.got-it.label")})]})}),document.body):Ve.createPortal(e.jsxs(e.Fragment,{children:[o&&e.jsx("div",{className:"info-pop-catcher",onMouseDown:i,role:"presentation"}),e.jsxs("div",{ref:d,className:"info-pop info-pop-anchored hand-card hc-r2"+(m!=null&&m.below?" is-below":" is-above"),role:"dialog","aria-label":n,style:m?{top:m.top,left:m.left,"--caret-x":`${m.caret}px`}:{top:0,left:0,visibility:"hidden"},onPointerEnter:s,onPointerLeave:r,children:[u,e.jsx("span",{className:"info-pop-caret","aria-hidden":"true"})]})]}),document.body)}const Ju=140;function Re({text:t,title:n}){const[o,s]=c.useState(!1),[r,i]=c.useState(!1),l=c.useRef(null),h=c.useRef(null),d=n||a("common.info.default.title"),m=n?a("common.info.dot.aria",{name:n}):typeof t=="string"?t:d,p=()=>{clearTimeout(h.current),h.current=null},u=()=>{var b;p(),s(!1),i(!1),(b=l.current)==null||b.blur()},f=()=>{r||(p(),h.current=setTimeout(()=>s(!1),Ju))};return c.useEffect(()=>()=>clearTimeout(h.current),[]),e.jsxs(e.Fragment,{children:[e.jsx("button",{ref:l,type:"button",className:"info-dot"+(o?" is-open":""),"aria-label":m,"aria-expanded":o,onPointerEnter:b=>{b.pointerType!=="touch"&&(p(),s(!0))},onPointerLeave:b=>{b.pointerType!=="touch"&&f()},onClick:b=>{b.preventDefault(),b.stopPropagation(),r?u():(p(),s(!0),i(!0))},onFocus:b=>{var v,g;let w=!1;try{w=!!((g=(v=b.target).matches)!=null&&g.call(v,":focus-visible"))}catch{w=!1}w&&(p(),s(!0),i(!0))},children:"i"}),o&&e.jsx(Xu,{anchor:l,title:d,pinned:r,onHold:p,onLeave:f,onClose:u,children:t})]})}function mn({keys:t}){return Ie()||!t?null:e.jsx("span",{className:"kbd-legend","aria-hidden":"true",children:String(t).split(` ${a("common.kbd.then.label")} `).map((n,o)=>e.jsxs(c.Fragment,{children:[o>0&&e.jsx("span",{className:"kbd-then",children:a("common.kbd.then.label")}),e.jsx("kbd",{className:"kbd",children:n})]},n+o))})}function em({open:t,onClose:n,omit:o}){return Ie()||!t?null:e.jsxs(or,{open:t,title:a("shell.shortcuts.title"),onClose:n,children:[e.jsx("p",{className:"microcopy",style:{marginBottom:14},children:a("shell.shortcuts.intro.prose")}),e.jsx("p",{className:"microcopy",style:{marginBottom:14},children:Pe("shell.shortcuts.practice.prose",{mode:e.jsx("strong",{children:a("quiz.practice.label")}),key:e.jsx("kbd",{className:"kbd",children:a("vocab.key.shift.label")})})}),Eu(o).map(s=>e.jsxs("div",{style:{marginBottom:16},children:[e.jsx(W,{className:"mb-2 block",children:s.group}),e.jsx("ul",{style:{listStyle:"none",margin:0,padding:0},children:s.items.map(r=>e.jsxs("li",{className:"kbd-row",children:[e.jsx("span",{children:r.label}),e.jsxs("span",{className:"kbd-pair",children:[e.jsx(mn,{keys:r.keys}),r.practiceKeys&&e.jsxs(e.Fragment,{children:[e.jsx("span",{className:"kbd-then",children:a("common.kbd.practice.label")}),e.jsx(mn,{keys:r.practiceKeys})]})]})]},r.id))})]},s.key))]})}function or({open:t,title:n,wide:o=!1,onClose:s,children:r}){const i=Ie();return Nt(t),c.useEffect(()=>{if(!t)return;const l=h=>h.key==="Escape"&&s&&s();return document.addEventListener("keydown",l),()=>document.removeEventListener("keydown",l)},[t,s]),t?i?Ve.createPortal(e.jsx(yn,{open:t,onClose:s,title:n||a("common.help.sheet.title"),children:e.jsx("div",{className:"help-sheet-body",children:r})}),document.body):Ve.createPortal(e.jsx("div",{className:"tp-scrim fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-4 py-10",onMouseDown:l=>{l.target===l.currentTarget&&s&&s()},children:e.jsxs("div",{role:"dialog","aria-modal":"true","aria-label":n||a("common.help.sheet.title"),className:"hand-card hc-r2 w-full",style:{maxWidth:o?860:520,padding:"18px 20px 20px"},children:[e.jsxs("div",{className:"mb-3 flex items-center gap-3",children:[e.jsx("h2",{className:"display-title flex-1",style:{fontSize:"var(--type-ui-19)"},children:n||a("common.help.sheet.title")}),e.jsx(We,{icon:e.jsx(it,{}),ariaLabel:a("common.action.close.label"),onClick:s,style:{width:34,height:34,padding:0,flexShrink:0}})]}),e.jsx("div",{className:"help-sheet-body",children:r})]})}),document.body):null}function sr({entries:t=[]}){return e.jsx("dl",{className:"help-list",children:t.map(n=>e.jsx(tm,{e:n},n.term))})}function tm({e:t}){var o;const n=Nu(t.asset);return e.jsxs("div",{className:"help-row",children:[t.icon&&e.jsx("span",{className:"help-row-icon","aria-hidden":"true",children:t.icon}),e.jsxs("div",{className:"help-row-text",children:[n&&e.jsx("div",{className:"help-row-asset is-clip",children:t.asset}),e.jsx("dt",{children:t.term}),e.jsx("dd",{children:t.what}),((o=t.how)==null?void 0:o.length)>0&&e.jsx("ul",{className:"help-how",children:t.how.map(s=>e.jsx("li",{children:s},s))}),t.asset&&!n&&e.jsx("div",{className:"help-row-asset",children:t.asset}),t.more&&e.jsxs("details",{className:"help-more",children:[e.jsx("summary",{children:a("common.help.more.label")}),e.jsx("div",{className:"help-more-body",children:t.more})]})]})]})}function nm({sections:t,active:n,railRef:o}){return Io(o,{axis:"both"}),e.jsx("nav",{className:"help-rail","aria-label":a("common.help.rail.aria"),ref:o,children:t.map(s=>e.jsx("a",{href:`#help-${s.id}`,className:"help-rail-item"+(s.id===n?" is-active":""),"aria-current":s.id===n?"true":void 0,children:s.title},s.id))})}function am({sections:t=[],active:n}){const o=c.useRef(null),s=c.useRef(null),r=Ie();return c.useEffect(()=>{var l,h,d;if(!n)return;if(r){(h=(l=s.current)==null?void 0:l.querySelector(".help-rail-item.is-active"))==null||h.scrollIntoView({inline:"center",block:"nearest",behavior:"instant"});return}const i=(d=o.current)==null?void 0:d.querySelector(`#help-${n}`);i==null||i.scrollIntoView({block:"start",behavior:"instant"})},[n,t,r]),e.jsxs("div",{className:"help-guide",children:[e.jsx(nm,{sections:t,active:n,railRef:s}),e.jsx("div",{className:"help-guide-body",ref:o,children:t.map(i=>e.jsxs("section",{id:`help-${i.id}`,className:"help-section",children:[e.jsx("h3",{className:"help-section-title",children:i.title}),e.jsx(sr,{entries:i.entries})]},i.id))})]})}function om({title:t,entries:n=[],sections:o=null,active:s,side:r="bottom",variant:i="ring"}){const[l,h]=c.useState(!1);if(!o&&!n.length)return null;const d=i==="pill";return e.jsxs(e.Fragment,{children:[e.jsx(ye,{label:a("common.help.button.tip",{name:t}),side:r,className:l?"is-open":"",children:e.jsx("button",{type:"button",className:(d?"topbar-add-btn tactile icon-only":"help-btn tactile")+(l?" is-open":""),"aria-label":a("common.help.button.aria",{name:t}),"aria-expanded":l,onClick:()=>h(!0),children:e.jsx(hr,{size:d?18:22})})}),e.jsx(or,{open:l,title:t,wide:!!o,onClose:()=>h(!1),children:o?e.jsx(am,{sections:o,active:s}):e.jsx(sr,{entries:n})})]})}function Ka({label:t,value:n="",source:o,sourceAt:s,display:r,placeholder:i,hint:l,multiline:h=!1,inputMode:d,maxLength:m,input:p,onSave:u,busy:f=!1,disabled:b=!1,editLabel:w,nameCase:v=!1,fieldKey:g}){const[y,k]=c.useState(!1),[j,N]=c.useState(n),S=N,x=c.useRef(null);c.useEffect(()=>{y||N(n)},[n,y]),c.useEffect(()=>{var P;y&&((P=x.current)==null||P.focus())},[y]);async function L(){if(j===n)return k(!1);try{await(u==null?void 0:u(j))!==!1&&k(!1)}catch{}}function A(){N(n),k(!1)}const E=!h&&!p,D=P=>{P.key==="Escape"?(P.preventDefault(),A()):P.key==="Enter"&&E&&(P.preventDefault(),L())},q=c.useContext(ar),C=c.useId(),I=c.useRef(j);I.current=j;const O=y&&j!==n;c.useEffect(()=>{if(!(!(q!=null&&q.register)||!g||!O))return q.register(C,{key:g,label:t,get:()=>I.current,close:()=>k(!1)}),()=>q.register(C,null)},[q,g,O,C,t]);const V=Array.isArray(n)?n.length>0:String(n??"").trim()!=="";return e.jsxs("div",{className:"inline-field",children:[e.jsxs("div",{className:"inline-field-head",children:[e.jsx(W,{children:t}),l&&e.jsx(Re,{text:l,title:t}),e.jsx("span",{className:"flex-1"}),!y&&o?e.jsx(np,{source:o,at:s}):null,!y&&!b&&e.jsx(Ae,{icon:e.jsx(et,{}),ariaLabel:w||a("common.action.edit.field.aria",{field:String(t).toLowerCase()}),onClick:()=>k(!0)}),y&&e.jsxs(e.Fragment,{children:[e.jsx(Ae,{icon:e.jsx(wt,{}),ariaLabel:a("common.action.save.field.aria",{field:String(t).toLowerCase()}),disabled:f,onClick:L,tooltip:a("common.action.save.label"),ok:!0}),e.jsx(Ae,{icon:e.jsx(it,{}),ariaLabel:a("common.action.cancel.label"),disabled:f,onClick:A})]})]}),y?e.jsx("div",{onKeyDown:D,children:p?p({value:j,onChange:N,ref:x}):h?e.jsx("textarea",{ref:x,className:"tp-input",rows:4,value:j,"aria-label":t,onChange:P=>S(P.target.value)}):e.jsx("input",{ref:x,className:"tp-input",value:j,inputMode:d,maxLength:m,autoComplete:"off",autoCapitalize:v?"words":void 0,"aria-label":t,onChange:P=>S(P.target.value)})}):e.jsx("div",{className:"inline-field-value"+(V?"":" is-empty"),children:V?r||String(n):i||a("common.field.inline.placeholder")})]})}const Zt={remembered:{label:"common.status.remembered.label",color:"var(--ok)",filled:!0},forgetting:{label:"common.status.forgetting.label",color:"var(--amber)",filled:!0},"probably-forgotten":{label:"common.status.probably-forgotten.label",color:"var(--error)",filled:!0},unseen:{label:"common.status.unseen.label",color:"var(--faint)",filled:!1}};function sm(t){return t<1?a("common.half-life.hours.label",{n:Math.max(1,Math.round(t*24))}):t<14?a("common.half-life.days.label",{n:Math.round(t)}):t<60?a("common.half-life.weeks.label",{n:Math.round(t/7)}):a("common.half-life.months.label",{n:Math.round(t/30)})}const xi=7,rm=7;function ji(t,n){if(!t)return n;const o=Date.parse(String(t).replace(" ","T")+"Z");return Number.isNaN(o)?n:(Date.now()-o)/864e5}function im(t={}){const{reviewed:n,stability:o,last_reviewed_at:s,last_result:r,created_at:i}=t;if(r!=="forgot"&&ji(i,1/0)<rm){const f=Zt.remembered;return{key:"remembered",...f,tip:a("common.status.tip",{name:a(f.label),detail:a("common.status.new.detail")})}}if(!n)return{key:"unseen",...Zt.unseen,tip:a(Zt.unseen.label)};const l=Math.max(Number(o)||xi,xi),h=ji(s,0),d=Math.pow(2,-h/l),m=r==="forgot"?"probably-forgotten":d>=.9?"remembered":d>=.5?"forgetting":"probably-forgotten",p=Zt[m],u=h>=l?a("common.status.due.detail"):a("common.status.half-life.detail",{span:sm(l)});return{key:m,...p,tip:a("common.status.tip",{name:a(p.label),detail:u})}}function gc({item:t,side:n="top"}){const o=im(t);return e.jsx(ye,{label:o.tip,side:n,children:e.jsx("span",{tabIndex:0,className:"status-dot","aria-label":o.tip,style:{background:o.filled?o.color:"transparent",borderColor:o.color}})})}function lm(t={},n=""){return t.review_excluded?t.work_review_excluded?a("common.quiz-skip.with-work.label",{kind:n||a("unit.work.one")}):a("common.quiz-skip.alone.label"):""}function rr({item:t,parent:n="",side:o="top",quiet:s=!1}){const r=lm(t,n);if(!r)return null;const i=e.jsx("span",{className:"quiz-skip-mark","aria-label":r,tabIndex:s?void 0:0,role:s?"img":void 0,children:e.jsx(pr,{size:13})});return s?i:e.jsx(ye,{label:r,side:o,children:i})}function Bt({kind:t,className:n="",style:o}){return e.jsx("span",{className:"ph "+n,"aria-hidden":"true",style:o,children:e.jsx("span",{className:"mono-label ph-label",children:t===void 0?a("common.badge.cover"):t})})}function vo({count:t=9}){return e.jsx("div",{className:"sprockets","aria-hidden":"true",children:Array.from({length:t},(n,o)=>e.jsx("i",{},o))})}function bc({left:t,code:n}){return e.jsxs("div",{className:"edge-row","aria-hidden":"true",children:[e.jsx("span",{children:t||a("common.filmstrip.edge.label")}),n!=null&&e.jsxs("span",{children:[n," ▸"]})]})}function cm({children:t}){return e.jsx("span",{className:"frame-code","aria-hidden":"true",children:t})}function yc(){return c.useMemo(()=>11+Math.floor(Math.random()*28),[])}const Ns=(t,n=0)=>`${t+n}A`,Ts=Object.fromEntries(St.map(t=>[t,"dot-"+t]));function Cs(t){return String(t).split(",").map(n=>n.trim()).filter(Boolean)}function Si(t){return(t||"").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9]+/g," ").trim()}function Wo(t){const n=String(t).trim(),o=n.replace(/[^\p{L}]/gu,"");return o&&o===o.toUpperCase()?n:n.replace(/\S+/g,s=>s.charAt(0).toUpperCase()+s.slice(1).toLowerCase())}function ke({children:t}){return t?e.jsx("p",{className:"tp-error",children:t}):null}function Jt({children:t}){return e.jsx("p",{className:"tp-empty",children:t})}function ir({path:t,title:n,onClose:o}){return qa(!0,o),c.useEffect(()=>{const s=r=>{r.key==="Escape"&&o()};return document.addEventListener("keydown",s),()=>document.removeEventListener("keydown",s)},[]),Ve.createPortal(e.jsxs("div",{className:"lightbox",role:"dialog","aria-modal":"true","aria-label":n?a("common.cover.alt",{title:n}):a("common.cover.lightbox.untitled.aria"),onClick:o,children:[e.jsx("button",{type:"button",className:"lightbox-close","aria-label":a("common.action.close.label"),onClick:o,children:e.jsx(it,{})}),e.jsx("img",{src:Ue(t),alt:n?a("common.cover.alt",{title:n}):"",className:"lightbox-img",onClick:s=>s.stopPropagation()})]}),document.body)}function dm({path:t,title:n,large:o=!1,hero:s=!1,zoomable:r=!1}){const[i,l]=c.useState(!1);if(s){if(t){const d=e.jsx("img",{src:Ue(t),alt:n?a("common.cover.alt",{title:n}):"",className:"block w-full rounded-md object-cover",style:{aspectRatio:"2 / 3",border:"1px solid var(--ink-border)"}});return r?e.jsxs(e.Fragment,{children:[e.jsx(ye,{label:a("common.cover.zoom.tip"),className:"block w-full",children:e.jsx("button",{type:"button",className:"cover-zoom-btn","aria-label":n?a("common.cover.zoom.aria",{title:n}):a("common.cover.zoom.untitled.aria"),onClick:()=>l(!0),children:d})}),i&&e.jsx(ir,{path:t,title:n,onClose:()=>l(!1)})]}):d}return e.jsx(Bt,{kind:a("common.badge.cover"),className:"w-full"})}const h=o?"h-36 w-24":"h-14 w-10";return t?e.jsx("img",{src:Ue(t),alt:n?a("common.cover.alt",{title:n}):"",className:h+" shrink-0 rounded-md object-cover",style:{border:"1px solid var(--ink-border)"}}):e.jsx(Bt,{kind:o?a("common.badge.cover"):"",className:h+" shrink-0"})}function oo({kind:t}){const n={width:15,height:15,viewBox:"0 0 16 16",fill:"none",stroke:"currentColor",strokeWidth:1.6,strokeLinecap:"round",strokeLinejoin:"round"};return t==="tiles"?e.jsxs("svg",{...n,"aria-hidden":"true",children:[e.jsx("rect",{x:"1.5",y:"1.5",width:"5.5",height:"7"}),e.jsx("rect",{x:"9",y:"1.5",width:"5.5",height:"4.5"}),e.jsx("rect",{x:"1.5",y:"10",width:"5.5",height:"4.5"}),e.jsx("rect",{x:"9",y:"7.5",width:"5.5",height:"7"})]}):t==="list"?e.jsxs("svg",{...n,"aria-hidden":"true",children:[e.jsx("line",{x1:"2",y1:"4",x2:"14",y2:"4"}),e.jsx("line",{x1:"2",y1:"8",x2:"14",y2:"8"}),e.jsx("line",{x1:"2",y1:"12",x2:"14",y2:"12"})]}):e.jsxs("svg",{...n,"aria-hidden":"true",children:[e.jsx("rect",{x:"1.5",y:"2.5",width:"13",height:"11"}),e.jsx("line",{x1:"1.5",y1:"6.5",x2:"14.5",y2:"6.5"}),e.jsx("line",{x1:"6",y1:"2.5",x2:"6",y2:"13.5"})]})}function ko({value:t,onChange:n}){return e.jsx(dt,{ariaLabel:a("common.view.toggle.aria"),value:t,onChange:n,options:[["tiles",e.jsxs(e.Fragment,{children:[e.jsx(oo,{kind:"tiles"})," ",a("common.view.tiles.label")]})],["list",e.jsxs(e.Fragment,{children:[e.jsx(oo,{kind:"list"})," ",a("common.view.list.label")]})],["table",e.jsxs(e.Fragment,{children:[e.jsx(oo,{kind:"table"})," ",a("common.view.table.label")]})]]})}function hm(t,n="asc"){const[o,s]=c.useState({col:t,dir:n});return{sort:o,toggle:l=>s(h=>h.col===l?{col:l,dir:h.dir==="asc"?"desc":"asc"}:{col:l,dir:"asc"}),apply:(l,h)=>{const d=h[o.col];if(!d)return l;const m=o.dir==="asc"?1:-1;return[...l].sort((p,u)=>{const f=d(p),b=d(u);return f<b?-m:f>b?m:0})}}}function Ni({col:t,label:n,sort:o,onSort:s,className:r=""}){const i=o.col===t?o.dir==="asc"?" ▲":" ▼":"";return e.jsx("th",{className:"sortable "+r,onClick:()=>s(t),"aria-sort":o.col===t?o.dir==="asc"?"ascending":"descending":"none",children:e.jsx(ye,{label:a("common.table.sort.tip"),side:"bottom",children:e.jsxs("span",{children:[n,i]})})})}function ut(t){return"tp-filter-chip tactile"+(t?" active":"")}function pv({options:t,onToggle:n,ariaLabel:o,className:s=""}){return e.jsx("div",{className:"flex flex-wrap items-center gap-2 "+s,role:"group","aria-label":o,children:t.map(r=>e.jsx(ye,{label:r.locked||r.hint||"",children:e.jsx("button",{type:"button",className:ut(r.on),"aria-pressed":r.on,"aria-disabled":!!r.locked,onClick:()=>{r.locked||n(r.key,!r.on)},children:r.label})},r.key))})}function um({active:t,icon:n,keepLabel:o,label:s,tooltip:r,onClick:i,...l}){const h=e.jsx("button",{type:"button",className:ut(t)+(n&&!o?" has-btn-icon":""),"aria-pressed":!!t,onClick:i,...l,children:n?e.jsxs(e.Fragment,{children:[e.jsx("span",{className:"btn-icon",children:n}),e.jsx("span",{className:o?"btn-label-fixed":"btn-label",children:s})]}):s});return!n||o?h:e.jsx(ye,{label:r||s,children:h})}function Ti({genres:t,value:n,onChange:o}){return!t||t.length===0?null:e.jsx(De,{ariaLabel:a("common.filters.genre.aria"),value:n,onChange:o,options:[["",a("common.filters.genre.all.label")],...t.map(s=>[s,s])]})}function lr(t){return t.series?t.series_index?`${t.series} #${t.series_index}`:t.series:""}function xo(t,n){const o=t.series||"",s=n.series||"";if(o!==s)return o?s?o.localeCompare(s):-1:1;const r=t.series_index||0,i=n.series_index||0;return r!==i?r-i:t.title.localeCompare(n.title)}function wc(t,n){const o=t.last_read_at||"",s=n.last_read_at||"";return o!==s?s.localeCompare(o):(t.title||"").localeCompare(n.title||"")}function Pt(t,n=!1){const o=Number(t);if(!o)return"";const s=n?o<0?"common.year.circa.bce.label":"common.year.circa.ce.label":o<0?"common.year.bce.label":"common.year.ce.label";return a(s,{year:o<0?-o:o})}function bn(t){let n=String(t??"").trim();if(!n)return{year:0,circa:!1};let o=!1;const s=n.match(/^(?:circa|ca|c)\.?\s*/i);s&&s[0].length<n.length&&(o=!0,n=n.slice(s[0].length).trim());let r=!1;const i=n.match(/\s*\b(b\.?\s*c\.?(?:\s*e\.?)?|a\.?\s*d\.?|c\.?\s*e\.?)\.?\s*$/i);i&&(r=i[1].replace(/[^a-z]/gi,"").toLowerCase().startsWith("b"),n=n.slice(0,i.index).trim());const l=Number(n);return!Number.isInteger(l)||l===0?{year:0,circa:!1}:{year:r?-Math.abs(l):l,circa:o}}function rt({value:t,onChange:n,ariaLabel:o,showAll:s=!1,collapsible:r=!1,mini:i=!1,disabled:l=!1}){const h=c.useRef(null),d=s?mi:mi.filter(f=>!ku(f)||f===t),m=Math.max(0,d.indexOf(t)),p=f=>{var y;const b=f.key==="ArrowRight"||f.key==="ArrowDown"?1:f.key==="ArrowLeft"||f.key==="ArrowUp"?-1:0;if(!b)return;f.preventDefault();const w=(y=h.current)==null?void 0:y.querySelectorAll("button");if(!(w!=null&&w.length))return;const v=[...w].indexOf(document.activeElement),g=(((v<0?m:v)+b)%w.length+w.length)%w.length;w[g].focus()},u=e.jsx("span",{ref:h,role:"radiogroup","aria-label":o||a("common.field.colour.label"),onKeyDown:p,className:"flex items-center gap-1.5",children:d.map((f,b)=>e.jsx(ye,{label:a("common.colour.pick.tip",{name:In(f)}),children:e.jsx("button",{type:"button",role:"radio","aria-checked":t===f,"aria-label":In(f),tabIndex:b===m?0:-1,disabled:l,onClick:()=>n(f),className:"color-dot-btn",children:e.jsx("span",{className:"color-dot "+Ts[f]+(t===f?" active":"")})})},f))});return i?e.jsx(Ci,{value:t,offered:d,onChange:n,ariaLabel:o,disabled:l,framed:!0}):r?e.jsxs(e.Fragment,{children:[e.jsx("span",{className:"cs-full",children:u}),e.jsx("span",{className:"cs-mini",children:e.jsx(Ci,{value:t,offered:d,onChange:n,ariaLabel:o,disabled:l})})]}):u}function Ci({value:t,offered:n,onChange:o,ariaLabel:s,disabled:r=!1,framed:i=!1}){const[l,h]=c.useState(!1),d=c.useRef(null),{popRef:m,style:p}=Mt(l,d,{prefer:"above",minHeight:140}),u=()=>h(!1);return Lt(l,u,[d,m],{onEscape:()=>{var f,b;return(b=(f=d.current)==null?void 0:f.querySelector("button"))==null?void 0:b.focus()}}),e.jsxs("span",{className:"cs-menu-wrap",ref:d,children:[e.jsx(ye,{label:t?a("common.colour.current.tip",{name:In(t)}):a("common.colour.pick.empty.tip"),children:e.jsx("button",{type:"button",className:"cs-menu-btn"+(i?" cs-menu-btn-framed tp-btn tp-btn-ghost tactile":""),"aria-haspopup":"true","aria-expanded":l,"aria-label":s,disabled:r,onClick:()=>h(f=>!f),children:i&&!t?e.jsx(Sc,{}):e.jsxs(e.Fragment,{children:[e.jsx("span",{className:"color-dot "+(Ts[t]||"")+(t?" active":"")}),e.jsx(jo,{open:l,size:14})]})})}),l&&Ve.createPortal(e.jsx("span",{ref:m,className:"cs-menu token-menu",role:"radiogroup","aria-label":s,style:p,children:n.map(f=>e.jsxs("button",{type:"button",role:"radio","aria-checked":t===f,className:"cs-menu-row",onClick:()=>{o(f),u()},children:[e.jsx("span",{className:"color-dot "+Ts[f]+(t===f?" active":"")}),e.jsx("span",{className:"cs-menu-name",children:In(f)})]},f))}),document.body)]})}const we=24;function We({icon:t,label:n,ariaLabel:o,tooltip:s,tipSide:r="top",danger:i=!1,ok:l=!1,className:h="",wrapClassName:d="",onClick:m,style:p,...u}){const f=s===void 0?o:s,b=n!=null&&n!=="";return e.jsx(ye,{label:f,side:r,className:d,children:e.jsx("button",{type:"button",className:`tp-btn tp-btn-ghost tactile flex items-center justify-center rounded-full${b?" has-btn-icon":""}${i?" tp-btn-danger":""}${l?" tp-btn-ok":""} ${h}`,style:b?{height:44,flexShrink:0,...p}:{width:44,height:44,padding:0,flexShrink:0,...p},"aria-label":o,onClick:m,...u,children:b?e.jsxs(e.Fragment,{children:[e.jsx("span",{className:"btn-icon",children:t}),e.jsx("span",{className:"btn-label",children:n})]}):t})})}function Ae({icon:t,ariaLabel:n,tooltip:o,tipSide:s="top",ok:r=!1,danger:i=!1,boxed:l=!1,active:h=!1,busy:d=!1,className:m="",wrapClassName:p="",onClick:u,...f}){const b=o===void 0?n:o;return e.jsx(ye,{label:b,side:s,className:p,children:e.jsx("button",{type:"button",className:"field-icon-btn tactile"+(r?" field-icon-btn-ok":"")+(i?" field-icon-btn-danger":"")+(l?" field-icon-btn-boxed":"")+(h?" is-active":"")+(d?" is-busy":"")+(m?` ${m}`:""),"aria-label":n,onClick:u,...f,children:t})})}const xe={width:we,height:we,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:1.85,strokeLinecap:"round",strokeLinejoin:"round","aria-hidden":"true"},Ge={width:we,height:we,viewBox:"0 0 256 256",fill:"currentColor",stroke:"none","aria-hidden":"true"};function $t(){return e.jsxs("svg",{...xe,children:[e.jsx("path",{d:"M19 12H5"}),e.jsx("path",{d:"M12 19l-7-7 7-7"})]})}function Rt(){return e.jsx("svg",{...xe,children:e.jsx("path",{d:"M22 3H2l9 9v9l4-2v-7z"})})}function mm(){return e.jsxs("svg",{...xe,children:[e.jsx("path",{d:"M4 6h11"}),e.jsx("path",{d:"M4 12h7"}),e.jsx("path",{d:"M4 18h4"}),e.jsx("path",{d:"M18 5v14"}),e.jsx("path",{d:"M15 16l3 3 3-3"})]})}function st(){return e.jsxs("svg",{...xe,children:[e.jsx("path",{d:"M12 3v12"}),e.jsx("path",{d:"M7 10l5 5 5-5"}),e.jsx("path",{d:"M4 18h16"})]})}function et(){return e.jsx("svg",{...xe,children:e.jsx("path",{d:"M17 3l4 4L7 19H3v-4z"})})}function ze(){return e.jsxs("svg",{...xe,children:[e.jsx("path",{d:"M3 6h18"}),e.jsx("path",{d:"M8 3V2h8v1"}),e.jsx("path",{d:"M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"}),e.jsx("path",{d:"M10 11v6"}),e.jsx("path",{d:"M14 11v6"})]})}function ht(){return e.jsxs("svg",{...xe,children:[e.jsx("path",{d:"M12 5v14"}),e.jsx("path",{d:"M5 12h14"})]})}function on(){return e.jsxs("svg",{...xe,children:[e.jsx("circle",{cx:"11",cy:"11",r:"7"}),e.jsx("path",{d:"M21 21l-4.3-4.3"})]})}function pm(){return e.jsxs("svg",{...xe,children:[e.jsx("circle",{cx:"11",cy:"11",r:"7"}),e.jsx("path",{d:"M21 21l-4.3-4.3"}),e.jsx("path",{d:"M4.2 11h13.6"}),e.jsx("path",{d:"M11 4.1c1.7 1.9 2.6 4.3 2.6 6.9s-.9 5-2.6 6.9c-1.7-1.9-2.6-4.3-2.6-6.9s.9-5 2.6-6.9"})]})}function vc(){return e.jsxs("svg",{...xe,children:[e.jsx("path",{d:"M6.5 4.5h11a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3h-6.2L7 20.9v-3.4h-.5a3 3 0 0 1-3-3v-7a3 3 0 0 1 3-3z"}),e.jsx("path",{d:"M8.3 14h1.9l1.2-2.6V8H7.4v3.4h1.8L8.3 14Z",fill:"currentColor",stroke:"none"}),e.jsx("path",{d:"M13.5 14h1.9l1.2-2.6V8h-4v3.4h1.8L13.5 14Z",fill:"currentColor",stroke:"none"})]})}function fm(){return e.jsxs("svg",{width:"18",height:"18",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"1.85",strokeLinecap:"round",strokeLinejoin:"round","aria-hidden":"true",children:[e.jsx("path",{d:"M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"}),e.jsx("circle",{cx:"12",cy:"12",r:"3.2"})]})}function gm(){return e.jsxs("svg",{width:"18",height:"18",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"1.85",strokeLinecap:"round",strokeLinejoin:"round","aria-hidden":"true",children:[e.jsx("path",{d:"M9.9 5.9A9.3 9.3 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3 3.8"}),e.jsx("path",{d:"M6.3 7.7A17.6 17.6 0 0 0 2.5 12S6 18.5 12 18.5a9.4 9.4 0 0 0 3.6-.7"}),e.jsx("path",{d:"M4 4l16 16"})]})}function bm(){return e.jsx(oo,{kind:"tiles"})}function cr({size:t=we}){return e.jsxs("svg",{...xe,width:t,height:t,children:[e.jsx("circle",{cx:"12",cy:"5",r:"1.4",fill:"currentColor",stroke:"none"}),e.jsx("circle",{cx:"12",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"}),e.jsx("circle",{cx:"12",cy:"19",r:"1.4",fill:"currentColor",stroke:"none"})]})}function Dn(){return e.jsxs("svg",{...xe,children:[e.jsx("circle",{cx:"17.5",cy:"5.5",r:"2.4"}),e.jsx("circle",{cx:"17.5",cy:"18.5",r:"2.4"}),e.jsx("circle",{cx:"6.5",cy:"12",r:"2.4"}),e.jsx("path",{d:"m8.7 10.9 6.6-3.9"}),e.jsx("path",{d:"m8.7 13.1 6.6 3.9"})]})}function ma(){return e.jsxs("svg",{...xe,children:[e.jsx("path",{d:"M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"}),e.jsx("path",{d:"M12 3.5v11"}),e.jsx("path",{d:"m7.5 8 4.5-4.5 4.5 4.5"})]})}function ym(){return e.jsxs("svg",{...xe,children:[e.jsx("path",{d:"M10 13.5a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 1 0-5-5l-1.5 1.5"}),e.jsx("path",{d:"M14 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 1 0 5 5l1.5-1.5"})]})}function Kn(){return e.jsxs("svg",{...xe,children:[e.jsx("rect",{x:"3.5",y:"11",width:"17",height:"9.5",rx:"2.5"}),e.jsx("path",{d:"M12 3v5.6"}),e.jsx("path",{d:"m9 5.8 3 3 3-3"}),e.jsx("path",{d:"M7.5 15h9"}),e.jsx("path",{d:"M7.5 18h5"})]})}function kc(){return e.jsxs("svg",{...xe,children:[e.jsx("path",{d:"M4 7h16"}),e.jsx("path",{d:"M4 12h16"}),e.jsx("path",{d:"M4 17h12"})]})}function wt(){return e.jsx("svg",{...xe,children:e.jsx("path",{d:"M5 13l4 4L19 7"})})}function it(){return e.jsx("svg",{...xe,children:e.jsx("path",{d:"M6 6l12 12M18 6 6 18"})})}function dr({size:t=we}){return e.jsx("svg",{...Ge,viewBox:"-8.6 -4.6 273.2 273.2",width:t,height:t,children:e.jsx("path",{d:"M240,80V200a8,8,0,0,1-8,8H160a24,24,0,0,0-24,23.94,7.9,7.9,0,0,1-5.12,7.55A8,8,0,0,1,120,232a24,24,0,0,0-24-24H24a8,8,0,0,1-8-8V80a8,8,0,0,1,8-8H88a32,32,0,0,1,32,32v63.73a8.17,8.17,0,0,0,7.47,8.25,8,8,0,0,0,8.53-8V104a32,32,0,0,1,32-32h64A8,8,0,0,1,240,80ZM88.81,56H89a47.92,47.92,0,0,1,36,17.4,4,4,0,0,0,6.08,0A47.92,47.92,0,0,1,167,56h.19a4,4,0,0,0,3.54-5.84,48,48,0,0,0-85.46,0A4,4,0,0,0,88.81,56Z"})})}function xc({size:t=we}){return e.jsx("svg",{...Ge,viewBox:"1.2 9.2 253.7 253.7",width:t,height:t,children:e.jsx("path",{d:"M168,224a8,8,0,0,1-8,8H96a8,8,0,0,1,0-16h64A8,8,0,0,1,168,224ZM232,64V176a24,24,0,0,1-24,24H48a24,24,0,0,1-24-24V64A24,24,0,0,1,48,40H208A24,24,0,0,1,232,64Zm-68,56a8,8,0,0,0-3.41-6.55l-40-28A8,8,0,0,0,108,92v56a8,8,0,0,0,12.59,6.55l40-28A8,8,0,0,0,164,120Z"})})}function jc({size:t=18}){return e.jsxs("svg",{...xe,width:t,height:t,children:[e.jsx("rect",{x:"3.5",y:"5",width:"17",height:"15",rx:"2.5"}),e.jsx("path",{d:"M3.5 10h17"}),e.jsx("path",{d:"M8 3.5v3"}),e.jsx("path",{d:"M16 3.5v3"})]})}function hr({size:t=22}){return e.jsxs("svg",{...xe,width:t,height:t,children:[e.jsx("circle",{cx:"12",cy:"12",r:"8.75"}),e.jsx("path",{d:"M9.4 9.5a2.6 2.6 0 1 1 3.2 2.5c-.5.15-.75.5-.75 1v.6"}),e.jsx("path",{d:"M11.85 16.6v.01"})]})}function Ft({size:t=we}){return e.jsxs("svg",{...xe,width:t,height:t,children:[e.jsx("rect",{x:"3.5",y:"4",width:"17",height:"16",rx:"2.5"}),e.jsx("path",{d:"M7.5 9h9"}),e.jsx("path",{d:"M7.5 12.5h9"}),e.jsx("path",{d:"M7.5 16h5"})]})}function pa({size:t=we}){return e.jsxs("svg",{...xe,width:t,height:t,children:[e.jsx("rect",{x:"9",y:"9",width:"11.5",height:"11.5",rx:"2.5"}),e.jsx("path",{d:"M15 6.5A2.5 2.5 0 0 0 12.5 4h-6A2.5 2.5 0 0 0 4 6.5v6A2.5 2.5 0 0 0 6.5 15"})]})}function ur({size:t=we}){return e.jsxs("svg",{...xe,width:t,height:t,children:[e.jsx("path",{d:"M4 10h9.5a5 5 0 0 1 0 10H8"}),e.jsx("path",{d:"m7.5 6-3.5 4 3.5 4"})]})}function jo({open:t=!1,size:n=22}){return e.jsx("svg",{...xe,width:n,height:n,children:e.jsx("path",{d:t?"M6 14.5 12 8.5l6 6":"M6 9.5 12 15.5l6-6"})})}function fv({size:t=we}){return e.jsxs("svg",{...xe,width:t,height:t,children:[e.jsx("path",{d:"M14 3.5h6.5V10"}),e.jsx("path",{d:"M20.5 3.5 12 12"}),e.jsx("path",{d:"M18 14v4.5a2 2 0 0 1-2 2H5.5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2H10"})]})}function wm({size:t=we}){return e.jsxs("svg",{...xe,width:t,height:t,children:[e.jsx("path",{d:"M5 3.5v3c0 3 2.5 5.5 5.5 5.5H19"}),e.jsx("path",{d:"M5 20.5v-3c0-3 2.5-5.5 5.5-5.5"}),e.jsx("path",{d:"m15.5 8.5 3.5 3.5-3.5 3.5"})]})}function Es({size:t=we}){return e.jsxs("svg",{...xe,width:t,height:t,children:[e.jsx("circle",{cx:"9",cy:"8",r:"3.2"}),e.jsx("path",{d:"M3.5 19a5.5 5.5 0 0 1 11 0"}),e.jsx("path",{d:"M16 5.2a3.2 3.2 0 0 1 0 6"}),e.jsx("path",{d:"M17 14.2a5.5 5.5 0 0 1 3.5 4.8"})]})}function gv({size:t=we}){return e.jsxs("svg",{...xe,width:t,height:t,children:[e.jsx("circle",{cx:"12",cy:"8",r:"3.6"}),e.jsx("path",{d:"M5.5 19.5a6.5 6.5 0 0 1 13 0"})]})}function vm({size:t=we}){return e.jsxs("svg",{...xe,width:t,height:t,children:[e.jsx("circle",{cx:"10",cy:"8",r:"3.4"}),e.jsx("path",{d:"M3.5 19.5a6.5 6.5 0 0 1 10.7-4.4"}),e.jsx("path",{d:"M18 14.5v6"}),e.jsx("path",{d:"M15 17.5h6"})]})}function km({size:t=we}){return e.jsxs("svg",{...xe,width:t,height:t,children:[e.jsx("circle",{cx:"8.5",cy:"7.5",r:"3.2"}),e.jsx("path",{d:"M3 18.5a5.5 5.5 0 0 1 9-4.2"}),e.jsx("path",{d:"M14 16.5h6.5"}),e.jsx("path",{d:"m18 14 2.5 2.5L18 19"})]})}function xm({size:t=we}){return e.jsxs("svg",{...xe,width:t,height:t,children:[e.jsx("path",{d:"M10 4.5H6.5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2H10"}),e.jsx("path",{d:"M9.5 12h10"}),e.jsx("path",{d:"m16 8.5 3.5 3.5-3.5 3.5"})]})}function jm({size:t=we}){return e.jsxs("svg",{...xe,width:t,height:t,children:[e.jsx("circle",{cx:"8",cy:"12",r:"4"}),e.jsx("path",{d:"M12 12h8.5"}),e.jsx("path",{d:"M17 12v3.5"}),e.jsx("path",{d:"M20.5 12v2.5"})]})}function bv({size:t=we}){return e.jsxs("svg",{...xe,width:t,height:t,children:[e.jsx("rect",{x:"7",y:"2.5",width:"10",height:"19",rx:"2.5"}),e.jsx("path",{d:"M10.5 18.5h3"})]})}function Sm({size:t=we}){return e.jsxs("svg",{...xe,width:t,height:t,children:[e.jsx("rect",{x:"3",y:"4.5",width:"18",height:"4",rx:"1.2"}),e.jsx("path",{d:"M4.8 8.5v10a2 2 0 0 0 2 2h10.4a2 2 0 0 0 2-2v-10"}),e.jsx("path",{d:"M10 12.5h4"})]})}function yv({size:t=we}){return e.jsxs("svg",{...xe,width:t,height:t,children:[e.jsx("rect",{x:"3",y:"4.5",width:"18",height:"4",rx:"1.2"}),e.jsx("path",{d:"M4.8 8.5v10a2 2 0 0 0 2 2h10.4a2 2 0 0 0 2-2v-10"}),e.jsx("path",{d:"M12 18v-6"}),e.jsx("path",{d:"m9.3 14.7 2.7-2.7 2.7 2.7"})]})}function Nm({size:t=we}){return e.jsxs("svg",{...xe,width:t,height:t,children:[e.jsx("rect",{x:"3.5",y:"4.5",width:"17",height:"15",rx:"2.5"}),e.jsx("circle",{cx:"8.8",cy:"9.6",r:"1.6"}),e.jsx("path",{d:"m4.5 17 4.6-4.6a1.6 1.6 0 0 1 2.3 0l3 3"}),e.jsx("path",{d:"m13.7 14.2 1.9-1.9a1.6 1.6 0 0 1 2.3 0l2.1 2.1"})]})}function Tm({size:t=we}){return e.jsxs("svg",{...xe,width:t,height:t,children:[e.jsx("path",{d:"M20.5 12a8.5 8.5 0 1 1-2.9-6.4"}),e.jsx("path",{d:"M20.5 3.5V9.2h-5.7"})]})}function wv({size:t=we}){return e.jsxs("svg",{...xe,width:t,height:t,children:[e.jsx("path",{d:"M6 21V3.5"}),e.jsx("path",{d:"M6 4.5h11.5l-2.6 3.8 2.6 3.8H6"})]})}function vv({size:t=we}){return e.jsx("svg",{...xe,width:t,height:t,children:e.jsx("path",{d:"M6.5 3.5h11v17l-5.5-4.2-5.5 4.2z"})})}function Cm({size:t=we}){return e.jsxs("svg",{...xe,width:t,height:t,children:[e.jsx("path",{d:"M4 7V4.5h16V7"}),e.jsx("path",{d:"M12 4.5v15"}),e.jsx("path",{d:"M8.5 19.5h7"})]})}function Em({size:t=we}){return e.jsxs("svg",{...xe,width:t,height:t,children:[e.jsx("path",{d:"M2.5 5.5h8.5"}),e.jsx("path",{d:"M6.8 3.5v2"}),e.jsx("path",{d:"M9 5.5c0 3.7-2.4 6.8-6.5 8.3"}),e.jsx("path",{d:"M4.4 8.9c1.1 2.3 3 4 5.4 4.9"}),e.jsx("path",{d:"m12.8 20.5 4.6-10.5 4.6 10.5"}),e.jsx("path",{d:"M14.4 16.8h6"})]})}function So({size:t=we}){return e.jsxs("svg",{...xe,width:t,height:t,children:[e.jsx("path",{d:"M3.5 12h11"}),e.jsx("path",{d:"m10.5 8 4 4-4 4"}),e.jsx("path",{d:"M19 4.5v15"})]})}function Am({size:t=we}){return e.jsxs("svg",{...xe,width:t,height:t,children:[e.jsx("rect",{x:"2.5",y:"9",width:"19",height:"6",rx:"1.5"}),e.jsx("path",{d:"M6.8 9v2.6"}),e.jsx("path",{d:"M10.6 9v3.8"}),e.jsx("path",{d:"M14.4 9v2.6"}),e.jsx("path",{d:"M18.2 9v3.8"})]})}function qm({size:t=we}){return e.jsxs("svg",{...xe,width:t,height:t,children:[e.jsx("path",{d:"M4 12.7V5.5A1.5 1.5 0 0 1 5.5 4h7.2a2 2 0 0 1 1.4.6l6 6a1.8 1.8 0 0 1 0 2.5l-6.4 6.4a1.8 1.8 0 0 1-2.5 0l-6-6a2 2 0 0 1-.6-1.4Z"}),e.jsx("circle",{cx:"8.8",cy:"8.8",r:"1.2"})]})}function kv({size:t=we}){return e.jsxs("svg",{...xe,width:t,height:t,children:[e.jsx("path",{d:"M4 4.5h3.5v15H4z"}),e.jsx("path",{d:"M8.8 4.5h3.5v15H8.8z"}),e.jsx("path",{d:"m14.2 5.4 3.4-.9 3.9 14.5-3.4.9z"})]})}function xv({size:t=we}){return e.jsxs("svg",{...xe,width:t,height:t,children:[e.jsx("path",{d:"M5 5.5A2 2 0 0 1 7 3.5h6.5a2 2 0 0 1 2 2v2.2"}),e.jsx("path",{d:"M5 5.5v13a2 2 0 0 0 2 2h3.4"}),e.jsx("path",{d:"M8.5 8.6h4"}),e.jsx("path",{d:"m19.9 8.5-7.7 7.7-3.3 1 1-3.3 7.7-7.7a1.6 1.6 0 0 1 2.3 2.3Z"})]})}function jv({size:t=we}){return e.jsxs("svg",{...xe,width:t,height:t,children:[e.jsx("path",{d:"M3.5 6.5A2 2 0 0 1 5.5 4.5h6a2 2 0 0 1 2 2V9a2 2 0 0 1-2 2H7l-3.5 2.5V11z"}),e.jsx("path",{d:"M16 10.5h2.5a2 2 0 0 1 2 2V15a2 2 0 0 1-2 2H17l-3.5 2.5V17h-1a2 2 0 0 1-2-2v-.6"})]})}function Sv({size:t=we}){return e.jsxs("svg",{...xe,width:t,height:t,children:[e.jsx("circle",{cx:"12",cy:"12",r:"8.5"}),e.jsx("circle",{cx:"12",cy:"12",r:"1.5"}),e.jsx("circle",{cx:"12",cy:"6.4",r:"1"}),e.jsx("circle",{cx:"17.6",cy:"12",r:"1"}),e.jsx("circle",{cx:"12",cy:"17.6",r:"1"}),e.jsx("circle",{cx:"6.4",cy:"12",r:"1"})]})}function Mm({size:t=we}){return e.jsx("svg",{...Ge,viewBox:"6.1 2.1 243.9 243.9",width:t,height:t,children:e.jsx("path",{d:"M224,120v96a8,8,0,0,1-8,8H160a8,8,0,0,1-8-8V164a4,4,0,0,0-4-4H108a4,4,0,0,0-4,4v52a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8V120a16,16,0,0,1,4.69-11.31l80-80a16,16,0,0,1,22.62,0l80,80A16,16,0,0,1,224,120Z"})})}function Lm({size:t=we}){return e.jsx("svg",{...Ge,viewBox:"1.2 1.2 253.7 253.7",width:t,height:t,children:e.jsx("path",{d:"M216,40H40A16,16,0,0,0,24,56V200a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A16,16,0,0,0,216,40ZM176,168H80a8,8,0,0,1,0-16h96a8,8,0,0,1,0,16Zm0-32H80a8,8,0,0,1,0-16h96a8,8,0,0,1,0,16Zm0-32H80a8,8,0,0,1,0-16h96a8,8,0,0,1,0,16Z"})})}function Dm({size:t=we}){return e.jsx("svg",{...Ge,viewBox:"1.2 -2.8 253.7 253.7",width:t,height:t,children:e.jsx("path",{d:"M232,208a8,8,0,0,1-8,8H32a8,8,0,0,1,0-16h8V136a8,8,0,0,1,8-8H72a8,8,0,0,1,8,8v64H96V88a8,8,0,0,1,8-8h32a8,8,0,0,1,8,8V200h16V40a8,8,0,0,1,8-8h40a8,8,0,0,1,8,8V200h8A8,8,0,0,1,232,208Z"})})}function _m({size:t=we}){return e.jsx("svg",{...Ge,viewBox:"0.4 0.4 255.3 255.3",width:t,height:t,children:e.jsx("path",{d:"M216,130.16q.06-2.16,0-4.32l14.92-18.64a8,8,0,0,0,1.48-7.06,107.6,107.6,0,0,0-10.88-26.25,8,8,0,0,0-6-3.93l-23.72-2.64q-1.48-1.56-3-3L186,40.54a8,8,0,0,0-3.94-6,107.29,107.29,0,0,0-26.25-10.86,8,8,0,0,0-7.06,1.48L130.16,40Q128,40,125.84,40L107.2,25.11a8,8,0,0,0-7.06-1.48A107.6,107.6,0,0,0,73.89,34.51a8,8,0,0,0-3.93,6L67.32,64.27q-1.56,1.49-3,3L40.54,70a8,8,0,0,0-6,3.94,107.71,107.71,0,0,0-10.87,26.25,8,8,0,0,0,1.49,7.06L40,125.84Q40,128,40,130.16L25.11,148.8a8,8,0,0,0-1.48,7.06,107.6,107.6,0,0,0,10.88,26.25,8,8,0,0,0,6,3.93l23.72,2.64q1.49,1.56,3,3L70,215.46a8,8,0,0,0,3.94,6,107.71,107.71,0,0,0,26.25,10.87,8,8,0,0,0,7.06-1.49L125.84,216q2.16.06,4.32,0l18.64,14.92a8,8,0,0,0,7.06,1.48,107.21,107.21,0,0,0,26.25-10.88,8,8,0,0,0,3.93-6l2.64-23.72q1.56-1.48,3-3L215.46,186a8,8,0,0,0,6-3.94,107.71,107.71,0,0,0,10.87-26.25,8,8,0,0,0-1.49-7.06ZM128,168a40,40,0,1,1,40-40A40,40,0,0,1,128,168Z"})})}function Om({size:t=we}){return e.jsx("svg",{...Ge,viewBox:"10.9 10.9 234.1 234.1",width:t,height:t,children:e.jsx("path",{d:"M208,32H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM90.34,114.34a8,8,0,0,1,11.32,0L120,132.69V72a8,8,0,0,1,16,0v60.69l18.34-18.35a8,8,0,0,1,11.32,11.32l-32,32a8,8,0,0,1-11.32,0l-32-32A8,8,0,0,1,90.34,114.34ZM208,208H48V168H76.69L96,187.32A15.89,15.89,0,0,0,107.31,192h41.38A15.86,15.86,0,0,0,160,187.31L179.31,168H208v40Z"})})}function mr({size:t=we}){return e.jsx("svg",{...xe,width:t,height:t,children:e.jsx("path",{d:"M12 20.2c-1.6-1.2-7.5-5-7.5-9.9A4 4 0 0 1 12 8.1a4 4 0 0 1 7.5 2.2c0 4.9-5.9 8.7-7.5 9.9Z"})})}function Sc({size:t=we}){return e.jsx("svg",{...Ge,viewBox:"1.2 -2.8 253.7 253.7",width:t,height:t,children:e.jsx("path",{d:"M200.77,53.89A103.27,103.27,0,0,0,128,24h-1.07A104,104,0,0,0,24,128c0,43,26.58,79.06,69.36,94.17A32,32,0,0,0,136,192a16,16,0,0,1,16-16h46.21a31.81,31.81,0,0,0,31.2-24.88,104.43,104.43,0,0,0,2.59-24A103.28,103.28,0,0,0,200.77,53.89ZM84,168a12,12,0,1,1,12-12A12,12,0,0,1,84,168Zm0-56a12,12,0,1,1,12-12A12,12,0,0,1,84,112Zm44-24a12,12,0,1,1,12-12A12,12,0,0,1,128,88Zm44,24a12,12,0,1,1,12-12A12,12,0,0,1,172,112Z"})})}function Rm({size:t=we}){return e.jsxs("svg",{...xe,width:t,height:t,children:[e.jsx("path",{d:"M3 7h3.5l3 4"}),e.jsx("path",{d:"M14.5 16H18"}),e.jsx("path",{d:"M3 17h3.5l7-10H18"}),e.jsx("path",{d:"M16 5l2.5 2L16 9"}),e.jsx("path",{d:"M16 14l2.5 2L16 18"})]})}function Nc({size:t=we}){return e.jsxs("svg",{...xe,width:t,height:t,children:[e.jsx("rect",{x:"4",y:"5",width:"16",height:"14",rx:"2.5"}),e.jsx("path",{d:"M9.9 10.2a2.2 2.2 0 1 1 2.7 2.1c-.42.13-.63.42-.63.85v.5"}),e.jsx("path",{d:"M11.97 16.1v.01"})]})}function pr({size:t=we}){return e.jsxs("svg",{...xe,width:t,height:t,children:[e.jsx("rect",{x:"4",y:"5",width:"16",height:"14",rx:"2.5"}),e.jsx("path",{d:"m6.6 17.4 10.8-10.8"})]})}function Im({size:t=we}){return e.jsxs("svg",{...xe,width:t,height:t,children:[e.jsx("circle",{cx:"12",cy:"9.2",r:"5.7"}),e.jsx("path",{d:"m8.4 14.2-1.4 6.3 5-2.8 5 2.8-1.4-6.3"})]})}function Tc({size:t=we}){return e.jsxs("svg",{...xe,width:t,height:t,children:[e.jsx("path",{d:"M9.8 5h9.4"}),e.jsx("path",{d:"M9.8 12h9.4"}),e.jsx("path",{d:"M9.8 19h9.4"}),e.jsx("path",{d:"M7 5c-1.3 0-1.3 6-2.5 7 1.2 1 1.2 7 2.5 7"})]})}function Cc({size:t=we}){return e.jsx("svg",{...Ge,viewBox:"10.0 2.0 243.9 243.9",width:t,height:t,children:e.jsx("path",{d:"M224,128v80a16,16,0,0,1-16,16H48a16,16,0,0,1-16-16V48A16,16,0,0,1,48,32h80a8,8,0,0,1,0,16H48V208H208V128a8,8,0,0,1,16,0Zm5.66-58.34-96,96A8,8,0,0,1,128,168H96a8,8,0,0,1-8-8V128a8,8,0,0,1,2.34-5.66l96-96a8,8,0,0,1,11.32,0l32,32A8,8,0,0,1,229.66,69.66Zm-17-5.66L192,43.31,179.31,56,200,76.69Z"})})}function Ec({size:t=we}){return e.jsx("svg",{...Ge,viewBox:"1.2 -6.8 253.7 253.7",width:t,height:t,children:e.jsx("path",{d:"M216,48H176V40a24,24,0,0,0-24-24H104A24,24,0,0,0,80,40v8H40a8,8,0,0,0,0,16h8V208a16,16,0,0,0,16,16H192a16,16,0,0,0,16-16V64h8a8,8,0,0,0,0-16ZM112,168a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Zm48,0a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Zm0-120H96V40a8,8,0,0,1,8-8h48a8,8,0,0,1,8,8Z"})})}function Pm({size:t=we}){return e.jsx("svg",{...Ge,viewBox:"14.1 2.1 243.9 243.9",width:t,height:t,children:e.jsx("path",{d:"M231.65,194.55,198.46,36.75a16,16,0,0,0-19-12.39L132.65,34.42a16.08,16.08,0,0,0-12.3,19l33.19,157.8A16,16,0,0,0,169.16,224a16.25,16.25,0,0,0,3.38-.36l46.81-10.06A16.09,16.09,0,0,0,231.65,194.55ZM136,50.15c0-.06,0-.09,0-.09l46.8-10,3.33,15.87L139.33,66Zm10,47.38-3.35-15.9,46.82-10.06,3.34,15.9Zm70,100.41-46.8,10-3.33-15.87L212.67,182,216,197.85C216,197.91,216,197.94,216,197.94ZM104,32H56A16,16,0,0,0,40,48V208a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V48A16,16,0,0,0,104,32ZM56,48h48V64H56Zm48,160H56V192h48v16Z"})})}function Fm({size:t=we}){return e.jsx("svg",{...Ge,viewBox:"0.3 -3.7 263.4 263.4",width:t,height:t,children:e.jsx("path",{d:"M232,216H183.36A103.95,103.95,0,1,0,128,232H232a8,8,0,0,0,0-16ZM80,148a20,20,0,1,1,20-20A20,20,0,0,1,80,148Zm48,48a20,20,0,1,1,20-20A20,20,0,0,1,128,196Zm0-96a20,20,0,1,1,20-20A20,20,0,0,1,128,100Zm28,28a20,20,0,1,1,20,20A20,20,0,0,1,156,128Z"})})}function Bm({size:t=we}){return e.jsx("svg",{...Ge,viewBox:"1.2 5.2 253.7 253.7",width:t,height:t,children:e.jsx("path",{d:"M116,72v88a48.05,48.05,0,0,1-48,48,8,8,0,0,1,0-16,32,32,0,0,0,32-32v-8H40a16,16,0,0,1-16-16V72A16,16,0,0,1,40,56h60A16,16,0,0,1,116,72ZM216,56H156a16,16,0,0,0-16,16v64a16,16,0,0,0,16,16h60v8a32,32,0,0,1-32,32,8,8,0,0,0,0,16,48.05,48.05,0,0,0,48-48V72A16,16,0,0,0,216,56Z"})})}function Hm({size:t=we}){return e.jsxs("svg",{...Ge,viewBox:"-8.5 -8.6 273.2 273.2",width:t,height:t,children:[e.jsx("path",{d:"M220,169.09l-92,53.65L36,169.09A8,8,0,0,0,28,182.91l96,56a8,8,0,0,0,8.06,0l96-56A8,8,0,1,0,220,169.09Z"}),e.jsx("path",{d:"M220,121.09l-92,53.65L36,121.09A8,8,0,0,0,28,134.91l96,56a8,8,0,0,0,8.06,0l96-56A8,8,0,1,0,220,121.09Z"}),e.jsx("path",{d:"M28,86.91l96,56a8,8,0,0,0,8.06,0l96-56a8,8,0,0,0,0-13.82l-96-56a8,8,0,0,0-8.06,0l-96,56a8,8,0,0,0,0,13.82Z"})]})}function zm({size:t=we}){return e.jsx("svg",{...Ge,viewBox:"8.3 8.3 263.4 263.4",width:t,height:t,children:e.jsx("path",{d:"M243.31,136,144,36.69A15.86,15.86,0,0,0,132.69,32H40a8,8,0,0,0-8,8v92.69A15.86,15.86,0,0,0,36.69,144L136,243.31a16,16,0,0,0,22.63,0l84.68-84.68a16,16,0,0,0,0-22.63ZM84,96A12,12,0,1,1,96,84,12,12,0,0,1,84,96Z"})})}function $m({size:t=we}){return e.jsx("svg",{...Ge,viewBox:"1.1 1.1 253.7 253.7",width:t,height:t,children:e.jsx("path",{d:"M168,112a56,56,0,1,1-56-56A56,56,0,0,1,168,112Zm61.66,117.66a8,8,0,0,1-11.32,0l-50.06-50.07a88,88,0,1,1,11.32-11.31l50.06,50.06A8,8,0,0,1,229.66,229.66ZM112,184a72,72,0,1,0-72-72A72.08,72.08,0,0,0,112,184Z"})})}function Wm({size:t=we}){return e.jsx("svg",{...Ge,viewBox:"1.2 1.2 253.7 253.7",width:t,height:t,children:e.jsx("path",{d:"M112,120a16,16,0,1,1-16-16A16,16,0,0,1,112,120ZM232,56V200a16,16,0,0,1-16,16H40a16,16,0,0,1-16-16V56A16,16,0,0,1,40,40H216A16,16,0,0,1,232,56ZM135.75,166a39.76,39.76,0,0,0-17.19-23.34,32,32,0,1,0-45.12,0A39.84,39.84,0,0,0,56.25,166a8,8,0,0,0,15.5,4c2.64-10.25,13.06-18,24.25-18s21.62,7.73,24.25,18a8,8,0,1,0,15.5-4ZM200,144a8,8,0,0,0-8-8H152a8,8,0,0,0,0,16h40A8,8,0,0,0,200,144Zm0-32a8,8,0,0,0-8-8H152a8,8,0,0,0,0,16h40A8,8,0,0,0,200,112Z"})})}function Um({size:t=we}){return e.jsx("svg",{...Ge,viewBox:"-25.4 -25.4 306.8 306.8",width:t,height:t,children:e.jsx("path",{d:"M164.47,195.63a8,8,0,0,1-6.7,12.37H10.23a8,8,0,0,1-6.7-12.37,95.83,95.83,0,0,1,47.22-37.71,60,60,0,1,1,66.5,0A95.83,95.83,0,0,1,164.47,195.63Zm87.91-.15a95.87,95.87,0,0,0-47.13-37.56A60,60,0,0,0,144.7,54.59a4,4,0,0,0-1.33,6A75.83,75.83,0,0,1,147,150.53a4,4,0,0,0,1.07,5.53,112.32,112.32,0,0,1,29.85,30.83,23.92,23.92,0,0,1,3.65,16.47,4,4,0,0,0,3.95,4.64h60.3a8,8,0,0,0,7.73-5.93A8.22,8.22,0,0,0,252.38,195.48Z"})})}function Gm({size:t=we}){return e.jsx("svg",{...Ge,viewBox:"-8.6 -0.6 273.2 273.2",width:t,height:t,children:e.jsx("path",{d:"M240,102c0,70-103.79,126.66-108.21,129a8,8,0,0,1-7.58,0C119.79,228.66,16,172,16,102A62.07,62.07,0,0,1,78,40c20.65,0,38.73,8.88,50,23.89C139.27,48.88,157.35,40,178,40A62.07,62.07,0,0,1,240,102Z"})})}function Ht({size:t=we}){return e.jsx("svg",{...Ge,viewBox:"-28.1 -20.1 312.2 312.2",width:t,height:t,children:e.jsx("path",{d:"M176,207.24a119,119,0,0,0,16-7.73V240a8,8,0,0,1-16,0Zm11.76-88.43-56-29.87a8,8,0,0,0-7.52,14.12L171,128l17-9.06Zm64-29.87-120-64a8,8,0,0,0-7.52,0l-120,64a8,8,0,0,0,0,14.12L32,117.87v48.42a15.91,15.91,0,0,0,4.06,10.65C49.16,191.53,78.51,216,128,216a130,130,0,0,0,48-8.76V130.67L171,128l-43,22.93L43.83,106l0,0L25,96,128,41.07,231,96l-18.78,10-.06,0L188,118.94a8,8,0,0,1,4,6.93v73.64a115.63,115.63,0,0,0,27.94-22.57A15.91,15.91,0,0,0,224,166.29V117.87l27.76-14.81a8,8,0,0,0,0-14.12Z"})})}function Vm({size:t=we}){return e.jsx("svg",{...Ge,viewBox:"-18.3 -18.3 292.6 292.6",width:t,height:t,children:e.jsx("path",{d:"M247.44,173.75a.68.68,0,0,0,0-.14L231.05,89.44c0-.06,0-.12,0-.18A60.08,60.08,0,0,0,172,40H83.89a59.88,59.88,0,0,0-59,49.52L8.58,173.61a.68.68,0,0,0,0,.14,36,36,0,0,0,60.9,31.71l.35-.37L109.52,160h37l39.71,45.09c.11.13.23.25.35.37A36.08,36.08,0,0,0,212,216a36,36,0,0,0,35.43-42.25ZM104,112H96v8a8,8,0,0,1-16,0v-8H72a8,8,0,0,1,0-16h8V88a8,8,0,0,1,16,0v8h8a8,8,0,0,1,0,16Zm40-8a8,8,0,0,1,8-8h24a8,8,0,0,1,0,16H152A8,8,0,0,1,144,104Zm84.37,87.47a19.84,19.84,0,0,1-12.9,8.23A20.09,20.09,0,0,1,198,194.31L167.8,160H172a60,60,0,0,0,51-28.38l8.74,45A19.82,19.82,0,0,1,228.37,191.47Z"})})}function No({name:t}){switch(t){case"home":return e.jsx(Mm,{});case"quotes":return e.jsx(Bm,{});case"anthologies":return e.jsx(Hm,{});case"library":return e.jsx(Pm,{});case"movies":return e.jsx(Fm,{});case"metadata":return e.jsx(Lm,{});case"import":return e.jsx(Om,{});case"search":return e.jsx($m,{});case"tags":return e.jsx(zm,{});case"stats":return e.jsx(Dm,{});case"settings":return e.jsx(_m,{});case"profile":return e.jsx(Wm,{});case"users":return e.jsx(Um,{});default:return null}}const Yn={...xe,width:16,height:16};function Km(){return e.jsxs("svg",{...Yn,children:[e.jsx("path",{d:"M12 6.6C10 5.1 7 4.8 4 5.3v12.4c3-.5 6-.2 8 1.3 2-1.5 5-1.8 8-1.3V5.3c-3-.5-6-.2-8 1.3Z"}),e.jsx("path",{d:"M12 6.6V19"})]})}function Ym(){return e.jsxs("svg",{...Yn,children:[e.jsx("path",{d:"M3.5 20h17"}),e.jsx("path",{d:"M6 17V8"}),e.jsx("path",{d:"M10 17V6"}),e.jsx("path",{d:"M14 17V9"}),e.jsx("path",{d:"M18 17V7"})]})}function Qm(){return e.jsxs("svg",{...Yn,children:[e.jsx("path",{d:"M3.5 8 12 4l8.5 4-8.5 4z"}),e.jsx("path",{d:"M3.5 8v8l8.5 4 8.5-4V8"})]})}function Zm(){return e.jsxs("svg",{...Yn,children:[e.jsx("rect",{x:"3",y:"5",width:"18",height:"14",rx:"2"}),e.jsx("path",{d:"M7 5v14"}),e.jsx("path",{d:"M17 5v14"}),e.jsx("path",{d:"M3 12h18"})]})}function Xm(){return e.jsxs("svg",{...Yn,children:[e.jsx("rect",{x:"3",y:"7.5",width:"18",height:"12",rx:"2"}),e.jsx("path",{d:"m8 3.5 4 4 4-4"})]})}function Jm(){return e.jsxs("svg",{...Yn,children:[e.jsx("circle",{cx:"12",cy:"12",r:"8.5"}),e.jsx("path",{d:"M12 16.5v.01"}),e.jsx("path",{d:"M12 13.5v-1a2.5 2.5 0 1 0-2.5-2.5"})]})}const ep={google:{name:"vocab.source.google.label",Icon:Km},openlibrary:{name:"vocab.source.openlibrary.label",Icon:Ym},amazon:{name:"vocab.source.amazon.label",Icon:Qm},tmdb:{name:"vocab.source.tmdb.label",Icon:Zm},tvdb:{name:"vocab.source.tvdb.label",Icon:Xm}},Ei={tvdb:"vocab.source.tvdb.label",tmdb:"vocab.source.tmdb.label",igdb:"vocab.source.igdb.label",wikidata:"vocab.source.wikidata.label",google:"vocab.source.google.label",openlibrary:"vocab.source.openlibrary.label",amazon:"vocab.source.amazon.label",wikimedia:"vocab.source.wikimedia.label",fandom:"vocab.source.fandom.label",letterboxd:"vocab.source.letterboxd.label",imdb:"vocab.source.imdb.label",wikipedia:"vocab.source.wikipedia.label",manual:"vocab.source.manual.label"},cn=t=>Ei[t]?a(Ei[t]):String(t||"");function tp({source:t,size:n}){const o=tc[t];return o?e.jsx("span",{className:"src-mark","aria-hidden":"true",style:{WebkitMaskImage:`url("${o}")`,maskImage:`url("${o}")`,...n?{width:n,height:n}:null}}):null}function np({source:t,at:n}){if(!t)return null;const o=cn(t),s=n?` · ${String(n).slice(0,10)}`:"",r=!!tc[t];return e.jsxs("span",{className:"field-src","data-src":r?t:t==="manual"?"manual":"none",title:`${o}${s}`,children:[e.jsx(tp,{source:t}),r?null:e.jsx("span",{"aria-hidden":"true",children:o}),e.jsx("span",{className:"sr-only",children:o})]})}function ap({source:t,detail:n,side:o="top"}){const s=ep[t],r=s?s.Icon:Jm,i=s?a(s.name):t||a("vocab.source.unknown.label"),l=n?a("common.source.detail.tip",{name:i,detail:n}):i;return e.jsx(ye,{label:l,side:o,children:e.jsx("span",{tabIndex:0,className:"src-mark","aria-label":a("common.source.aria",{name:l}),children:e.jsx(r,{})})})}function fr({open:t,items:n=[],anchorRef:o,at:s=null,onClose:r,returnFocusTo:i}){const{popRef:l,style:h}=Mt(t,o,{align:s?"start":"end",minHeight:100,at:s}),d=r||(()=>{});if(Lt(t,d,[l,...o?[o]:[]],{onEscape:()=>{var p;return(p=i==null?void 0:i.current)==null?void 0:p.focus()}}),c.useLayoutEffect(()=>{var p,u;t&&((u=(p=l.current)==null?void 0:p.querySelector("[role^=menuitem]"))==null||u.focus())},[t]),!t)return null;const m=p=>{var w,v;const u=[...((w=l.current)==null?void 0:w.querySelectorAll("[role^=menuitem]"))||[]];if(!u.length)return;const f=u.indexOf(document.activeElement),b=g=>{p.preventDefault(),u[(g+u.length)%u.length].focus()};if(p.key==="ArrowDown")return b(f+1);if(p.key==="ArrowUp")return b(f-1);if(p.key==="Home")return b(0);if(p.key==="End")return b(u.length-1);p.key==="Tab"&&(p.preventDefault(),d(),(v=i==null?void 0:i.current)==null||v.focus())};return Ve.createPortal(e.jsx("div",{ref:l,className:"hand-card hc-r2 more-menu",role:"menu",style:h,onKeyDown:m,children:n.map((p,u)=>p.heading?e.jsx("div",{className:"menu-head","aria-hidden":"true",children:p.heading},`${p.id||"h"}-${u}`):e.jsxs("button",{type:"button",role:"menuitem",className:"menu-item",...p.checked==null?{}:{role:"menuitemradio","aria-checked":!!p.checked},style:p.danger?{color:"var(--error)"}:void 0,onClick:f=>{f.stopPropagation(),d(),p.onClick()},children:[p.icon,p.label,p.checked?e.jsx("span",{className:"menu-tick","aria-hidden":"true",children:"✓"}):null]},`${p.id||"i"}-${u}`))}),document.body)}function Fn({items:t,icon:n,label:o,ariaLabel:s,tooltip:r,disabled:i=!1}){const[l,h]=c.useState(!1),d=c.useRef(null);return e.jsxs("div",{className:"relative",ref:d,children:[e.jsx(We,{icon:n||e.jsx(cr,{}),label:o,ariaLabel:s||a("common.more.aria"),tooltip:r,disabled:i,onClick:()=>h(m=>!m)}),e.jsx(fr,{open:l&&!i,items:t,anchorRef:d,onClose:()=>h(!1),returnFocusTo:d})]})}const op=".tp-tip-wrap, button, a, input, textarea, select, label",sp=".card-text";function Uo(t=[],{onLongPress:n}={}){const[o,s]=c.useState(null),r=c.useRef(null),i=c.useRef(null),l=c.useRef(null),h=c.useRef(!1),d=t.length>0,m=typeof n=="function",p=d||m,u=()=>{i.current&&clearTimeout(i.current),i.current=null,l.current=null},f=()=>s(null),b=A=>{var D;const E=(D=A==null?void 0:A.closest)==null?void 0:D.call(A,op);return!!E&&E!==r.current},w=A=>{var E;return!!((E=A==null?void 0:A.closest)!=null&&E.call(A,sp))},v=A=>{var q,C;const E=typeof window<"u"?(q=window.getSelection)==null?void 0:q.call(window):null;if(!E||E.isCollapsed||E.rangeCount===0)return!1;const D=E.anchorNode;return!!(D&&((C=A==null?void 0:A.contains)!=null&&C.call(A,D)))},g=()=>{var E,D;const A=typeof window<"u"?(E=window.getSelection)==null?void 0:E.call(window):null;A&&!A.isCollapsed&&((D=A.removeAllRanges)==null||D.call(A))},x=p?{ref:r,onContextMenu:A=>{!d||b(A.target)||v(r.current)||(A.preventDefault(),s({x:A.clientX,y:A.clientY}))},onPointerDown:A=>{if(!p||A.pointerType!=="touch"||b(A.target)||m&&w(A.target))return;h.current=!1,u(),l.current={x:A.clientX,y:A.clientY};const{clientX:E,clientY:D}=A;i.current=setTimeout(()=>{h.current=!0,g(),m?n({x:E,y:D}):s({x:E,y:D})},mc)},onPointerMove:A=>{!i.current||!l.current||(Math.abs(A.clientX-l.current.x)>wo||Math.abs(A.clientY-l.current.y)>wo)&&u()},onPointerUp:u,onPointerCancel:u,onClickCapture:A=>{var E,D;return(D=(E=A.target)==null?void 0:E.closest)!=null&&D.call(E,"[role=menu]")?!0:h.current?(h.current=!1,A.preventDefault(),A.stopPropagation(),!0):!1},onKeyDown:A=>{var q,C;if(!d||!(A.key==="ContextMenu"||A.shiftKey&&A.key==="F10"))return;A.preventDefault();const D=(C=(q=r.current)==null?void 0:q.getBoundingClientRect)==null?void 0:C.call(q);s(D?{x:D.left+12,y:D.top+12}:{x:0,y:0})}}:{ref:r},L=d?e.jsx(fr,{open:!!o,at:o,items:t,onClose:f,returnFocusTo:r}):null;return Nt(!!o),{cardProps:x,menuClass:p?"card-menu-host"+(o?" is-menu-target":""):"",menu:L,open:!!o,close:f}}function gr({picked:t,onChange:n,label:o}){return e.jsxs("label",{className:"card-pick",onClick:s=>s.stopPropagation(),children:[e.jsx("input",{type:"checkbox",checked:t,"aria-label":a(t?"common.action.deselect.aria":"common.action.select.aria",{name:o||a("common.select.target.fallback")}),onChange:n}),e.jsx("span",{className:"card-pick-mark","aria-hidden":"true",children:e.jsx(wt,{})})]})}function br({onCopy:t,onShare:n,onPractise:o,onEdit:s,onDelete:r,noun:i}){const l=i||a("unit.row.one");return e.jsxs("span",{className:"flex items-center justify-end gap-1",children:[t&&e.jsx(Ae,{icon:e.jsx(pa,{}),ariaLabel:a("common.action.copy.label"),onClick:t,tooltip:a("common.action.copy.row.tip",{noun:l})}),o&&e.jsx(Ae,{icon:e.jsx(Ht,{}),ariaLabel:a("common.action.practise.label"),onClick:o,tooltip:a("common.action.practise.row.tip",{noun:l})}),n&&e.jsx(Ae,{icon:e.jsx(Dn,{}),ariaLabel:a("common.action.share.label"),onClick:n,tooltip:a("common.action.share.row.tip",{noun:l})}),s&&e.jsx(Ae,{icon:e.jsx(et,{}),ariaLabel:a("common.action.edit.label"),onClick:s,tooltip:a("common.action.edit.row.tip",{noun:l})}),r&&e.jsx(Ae,{icon:e.jsx(ze,{}),ariaLabel:a("common.action.delete.label"),onClick:r,tooltip:a("common.action.delete.row.tip",{noun:l}),danger:!0})]})}function yr({onClick:t,label:n,tooltip:o,disabled:s=!1,className:r=""}){const i=n||a("common.action.close.label");return e.jsx(Ae,{icon:e.jsx(it,{}),ariaLabel:i,onClick:t,disabled:s,tooltip:o||a("common.action.close.window.tip",{name:i}),className:r})}function wa({actions:t=[],alwaysVisible:n=!1}){return t.length?e.jsx("span",{className:"card-tools"+(n?" is-visible":""),children:t.map(o=>e.jsx(Ae,{icon:o.icon,ariaLabel:o.label,onClick:o.run,tooltip:o.tooltip||o.label,danger:!!o.danger},o.id))}):null}function va({actions:t=[]}){return t.length?e.jsx(Fn,{items:t.map(n=>({...n,onClick:n.run}))}):null}function yn({open:t,onClose:n,title:o,actions:s,children:r,footer:i,dismissOnScrim:l=!0}){return qa(t,n),Nt(t),t?e.jsx("div",{className:"mobile-sheet",onClick:l?n:void 0,children:e.jsxs("div",{className:"mobile-sheet-card",onClick:h=>h.stopPropagation(),children:[e.jsxs("div",{className:"mobile-sheet-header",children:[e.jsx(ye,{label:a("common.sheet.close.tip"),side:"bottom",className:"shrink-0",children:e.jsx("button",{type:"button",className:"mobile-sheet-close",onClick:n,"aria-label":a("common.action.close.label"),children:e.jsx($t,{})})}),e.jsx("h2",{className:"mobile-sheet-title",children:o}),s||e.jsx("span",{className:"mobile-sheet-spacer"})]}),e.jsx("div",{className:"mobile-sheet-body",children:r}),i&&e.jsx("div",{className:"mobile-sheet-footer",children:i})]})}):null}function wr({count:t,onReset:n,onDone:o}){return e.jsxs(e.Fragment,{children:[n&&e.jsx(Ae,{icon:e.jsx(ur,{}),ariaLabel:a("common.filters.reset.aria"),onClick:n}),t!=null&&e.jsx("span",{className:"microcopy",children:t}),e.jsx("button",{type:"button",className:"tp-btn tp-btn-primary ml-auto",style:{minWidth:110},onClick:o,children:a("common.action.done.label")})]})}function Nv({value:t,max:n,label:o}){const s=!(n>0),r=s?0:Math.min(100,Math.round(t/n*100));return e.jsxs("div",{role:"progressbar","aria-valuemin":0,"aria-valuemax":n||void 0,"aria-valuenow":s?void 0:t,"aria-label":o||a("common.progress.aria"),children:[e.jsx("div",{className:"progress-track",children:s?e.jsx("div",{className:"progress-fill progress-indeterminate"}):e.jsx("div",{className:"progress-fill",style:{width:`${r}%`}})}),o&&e.jsx("p",{className:"microcopy mt-1",children:o})]})}const rp=1500,ip=6e3,lp=1200;let To=null,en=null,Ac=0;function Ee(t,n){To&&To(t,n)}function qc(t,n,o,s=!1){if(!en)return 0;const r=++Ac;return en({msg:t,rect:n||null,side:o,sticky:!0,hold:s,token:r}),r}function dn(t){t&&en&&en({hide:t})}function cp(t,n,o){if(!en)return 0;const s=++Ac;return en({msg:t,rect:n||null,side:o,sticky:!1,token:s}),s}function dp({msg:t,rect:n,side:o}){const s=c.useRef(null),[r,i]=c.useState(null);return c.useLayoutEffect(()=>{const l=s.current;if(!l)return;const h=9,d=8,m=window.innerWidth,p=window.innerHeight,u=l.offsetWidth,f=l.offsetHeight;if(!n){i({top:d+6,left:Math.max(d,(m-u)/2)});return}const b=n.top-h-f>=d,w=n.bottom+h+f<=p-d,g=(o==="bottom"?!w&&b:b||!w)?Math.max(d,n.top-h-f):Math.min(n.bottom+h,Math.max(d,p-f-d)),y=Math.max(d,Math.min(n.left+n.width/2-u/2,m-u-d));i({top:g,left:y})},[t,n,o]),e.jsx("div",{ref:s,className:"hint-bubble",role:"tooltip",style:r?{top:r.top,left:r.left}:{top:0,left:0,visibility:"hidden"},children:t})}function hp(){const[t,n]=c.useState({msg:"",action:null,n:0}),[o,s]=c.useState({msg:"",n:0,rect:null,side:"top",sticky:!1,token:0});return c.useEffect(()=>(To=(r,i)=>n(l=>({msg:r,action:i||null,n:l.n+1})),en=r=>s(i=>r.hide!=null?r.hide===i.token&&i.msg?{...i,msg:""}:i:{msg:r.msg,rect:r.rect,side:r.side||"top",sticky:r.sticky,hold:!!r.hold,token:r.token,n:i.n+1}),()=>{To=null,en=null}),[]),c.useEffect(()=>{if(!t.msg)return;const r=setTimeout(()=>n(i=>({...i,msg:""})),t.action?ip:rp);return()=>clearTimeout(r)},[t]),c.useEffect(()=>{if(!o.msg||o.hold)return;const r=setTimeout(()=>s(i=>({...i,msg:""})),o.sticky?Qu:lp);return()=>clearTimeout(r)},[o]),e.jsxs(e.Fragment,{children:[t.msg&&e.jsxs("div",{className:"toast",role:"status",children:[t.msg,t.action&&e.jsx("button",{type:"button",className:"toast-action",onClick:()=>{n(r=>({...r,msg:""})),t.action.onClick()},children:t.action.label})]},t.n),o.msg&&e.jsx(dp,{msg:o.msg,rect:o.rect,side:o.side},o.n)]})}const Ai=Object.freeze({cast:[],chapters:[],loading:!1});function Mc(t){const n=(t==null?void 0:t.kind)==="screen"||(t==null?void 0:t.type)==="movie"?"movies":"books",o=(t==null?void 0:t.id)??null,s=o==null?"":`${n}:${o}`,[r,i]=c.useState(Ai);c.useEffect(()=>{if(!s){i(Ai);return}let p=!1;i(f=>({...f,loading:!0}));const u=[Z("GET",`/${n}/${o}/cast`)];return n==="books"&&u.push(Z("GET",`/books/${o}/chapters`)),Promise.all(u).then(([f,b])=>{var v,g;if(p)return;const w=(f==null?void 0:f.ok)&&((v=f.data)==null?void 0:v.cast)||[];i({cast:w,chapters:(b==null?void 0:b.ok)&&((g=b.data)==null?void 0:g.chapters)||[],loading:!1})}),()=>{p=!0}},[s,n,o]);const l=c.useMemo(()=>{const p=new Map;for(const u of r.cast)u.character&&p.set(u.character.trim().toLowerCase(),(u.actor||"").trim());return u=>p.get(String(u||"").trim().toLowerCase())||""},[r.cast]),h=c.useMemo(()=>{const p=new Map;for(const u of r.chapters){const f=(u.name||"").trim().toLowerCase();f&&u.no&&!p.has(f)&&p.set(f,u.no)}return u=>p.get(String(u||"").trim().toLowerCase())||""},[r.chapters]),d=c.useMemo(()=>[...new Set(r.chapters.map(p=>(p.name||"").trim()).filter(Boolean))],[r.chapters]),m=c.useMemo(()=>[...new Set(r.chapters.filter(p=>p.no).map(p=>String(p.no)))],[r.chapters]);return{...r,actorFor:l,chapterNoFor:h,chapterNames:d,chapterNumbers:m}}function Co({id:t,options:n}){return!n||n.length===0?null:e.jsx("datalist",{id:t,children:n.map(o=>e.jsx("option",{value:o},o))})}const up=10,mp=5,Nn=t=>String(t||"").toLowerCase().trim();function As({label:t,value:n,onChange:o,placeholder:s,cast:r=[],field:i="character",nameCase:l=!0,inputRef:h,ariaLabel:d}){const[m,p]=c.useState(!1),[u,f]=c.useState(-1),b=c.useId(),w=c.useRef(null),v=c.useRef(null),g=c.useId(),y=h||v,j=Ie()?mp:up,N=c.useMemo(()=>{const C=new Set,I=[];for(const O of r){const V=((O==null?void 0:O[i])||"").trim();!V||C.has(Nn(V))||(C.add(Nn(V)),I.push({name:V,other:((O==null?void 0:O[i==="character"?"actor":"character"])||"").trim()}))}return I},[r,i]),S=Nn(n),x=c.useMemo(()=>N.filter(C=>(!S||Nn(C.name).includes(S)||Nn(C.other).includes(S))&&Nn(C.name)!==S).slice(0,j),[N,S,j]),L=m&&x.length>0,{popRef:A,style:E}=Mt(L,w,{matchWidth:!0,minHeight:120});Lt(L,()=>p(!1),[w,A],{event:"pointerdown"});const D=C=>{o(C),p(!1),f(-1)},q=C=>{C.key==="ArrowDown"?(C.preventDefault(),p(!0),f(I=>Math.min(I+1,x.length-1))):C.key==="ArrowUp"?(C.preventDefault(),f(I=>Math.max(I-1,-1))):C.key==="Enter"&&L&&u>=0?(C.preventDefault(),D(x[u].name)):C.key==="Escape"&&L&&(C.stopPropagation(),p(!1))};return e.jsxs("div",{className:"tp-field",ref:w,children:[t&&e.jsx(W,{htmlFor:b,children:t}),e.jsx("input",{ref:y,id:b,className:"tp-input",role:"combobox",autoCapitalize:l?"words":void 0,"aria-expanded":L,"aria-autocomplete":"list","aria-controls":L?g:void 0,"aria-activedescendant":L&&u>=0?`${g}-${u}`:void 0,"aria-label":d||t,autoComplete:"off",placeholder:s,value:n||"",onChange:C=>{o(C.target.value),p(!0),f(-1)},onFocus:()=>p(!0),onKeyDown:q,onBlur:C=>{var I,O;(I=w.current)!=null&&I.contains(C.relatedTarget)||(O=A.current)!=null&&O.contains(C.relatedTarget)||p(!1)}}),L&&Ve.createPortal(e.jsx("ul",{ref:A,className:"token-menu",style:E,role:"listbox",id:g,onMouseLeave:()=>f(-1),children:x.map((C,I)=>e.jsx("li",{role:"presentation",children:e.jsxs("button",{type:"button",id:`${g}-${I}`,role:"option","aria-selected":I===u,className:"token-opt cast-opt"+(I===u?" hi":""),onMouseEnter:()=>f(I),onClick:()=>D(C.name),children:[e.jsx("span",{className:"cast-opt-name",children:C.name}),C.other&&e.jsx("span",{className:"cast-opt-other",children:C.other})]})},C.name))}),document.body)]})}function pp(t){const n=(t||"").trim();return n?`https://images-na.ssl-images-amazon.com/images/P/${n}.01.jpg`:""}const Lc=500;function Mn(t){return t&&t.w?`${t.w}×${t.h}`:""}function Bn({url:t,label:n,showRes:o=!1,compact:s=!1,className:r="w-20 shrink-0"}){const[i,l]=c.useState(!1),[h,d]=c.useState(null);if(t&&!i){const m=h&&h.w>0&&h.w<Lc,p=e.jsx("img",{src:t,alt:"",loading:"lazy",onError:()=>l(!0),onLoad:o?u=>d({w:u.target.naturalWidth,h:u.target.naturalHeight}):void 0,className:"block w-full object-cover",style:{aspectRatio:"2 / 3",border:"1px solid var(--ink-border)",borderRadius:8}});return o?e.jsxs("span",{className:"relative block "+r,children:[p,Mn(h)&&e.jsx("span",{className:"cover-res-badge"+(m?" is-low":""),children:Mn(h)})]}):e.jsx("span",{className:"block "+r,children:p})}return t&&i&&!s?e.jsx("span",{className:"flex items-center justify-center px-1 text-center "+r,style:{aspectRatio:"2 / 3",border:"1px dashed var(--ink-border)",borderRadius:8},children:e.jsx(W,{style:{fontSize:"var(--type-ui-9)",lineHeight:1.3},children:a("cover.preview.blocked")})}):e.jsx(Bt,{kind:n,className:r})}const Dc=t=>(t||"").replace("/t/p/w342/","/t/p/original/").replace("/t_cover_small/","/t_cover_big_2x/");function _c(t){return a(t==="game"?"cover.search.game.tip":"cover.search.screen.tip")}const lt=t=>{const n=Number(String(t??"").trim());return Number.isInteger(n)&&n>0?n:0};function vr({kind:t,id:n,currentPath:o,asin:s,coverUrl:r,clearCover:i,onSetUrl:l,onClear:h,onUploaded:d,onFetchMeta:m,fetchMetaOpen:p,search:u}){const[f,b]=c.useState(!1),[w,v]=c.useState(""),[g,y]=c.useState(!1),[k,j]=c.useState(""),[N,S]=c.useState(null),[x,L]=c.useState(!1),[A,E]=c.useState(null),D=a(t==="movies"?"cover.heading.poster":"cover.heading.cover"),q=a(t==="movies"?"cover.noun.poster":"cover.noun.cover"),C=a(t==="movies"?"cover.noun.poster.plural":"cover.noun.cover.plural");async function I(){var F,X,R,G,K,M;L(!0),j(""),S(null);const T=[],B=new Set,_=(Q,z,te="")=>{Q&&!B.has(Q)&&(B.add(Q),T.push({url:Q,source:z,thumb:te}))};if(t==="movies"){const Q=await Z("POST","/movies/lookup",{title:((u==null?void 0:u.title)||"").trim(),year:u!=null&&u.year?Number(u.year):void 0,media_type:(u==null?void 0:u.mediaType)||"movie",tmdb_id:lt(u==null?void 0:u.tmdbId)||void 0,tvdb_id:lt(u==null?void 0:u.tvdbId)||void 0,igdb_id:lt(u==null?void 0:u.igdbId)||void 0});if(!Q.ok)return L(!1),j(le(Q,a("error.lookup.failed")));for(const z of Q.data.candidates||[])_(Dc(z.poster_url),cn(z.source||"tmdb"))}else{const Q={};(F=u==null?void 0:u.isbn)!=null&&F.trim()&&(Q.isbn=u.isbn.trim()),(X=u==null?void 0:u.title)!=null&&X.trim()&&(Q.title=u.title.trim()),(R=u==null?void 0:u.author)!=null&&R.trim()&&(Q.author=u.author.trim()),(G=u==null?void 0:u.asin)!=null&&G.trim()&&(Q.asin=u.asin.trim());const z=await Z("POST","/books/lookup",Q);if(!z.ok)return L(!1),j(le(z,a("error.lookup.failed")));for(const te of z.data.candidates||[])_(te.cover_url,cn(te.source==="openlibrary"||te.source==="amazon"?te.source:"google"));(K=u==null?void 0:u.asin)!=null&&K.trim()&&_(pp(u.asin),cn("amazon"))}const U=await Z("POST","/images/search",{kind:t==="movies"?"poster":"cover",title:((u==null?void 0:u.title)||"").trim()||void 0,author:((u==null?void 0:u.author)||"").trim()||void 0,year:u!=null&&u.year?Number(u.year):void 0,isbn:((u==null?void 0:u.isbn)||"").trim()||void 0,asin:((u==null?void 0:u.asin)||"").trim()||void 0,media_type:t==="movies"?(u==null?void 0:u.mediaType)||"movie":void 0}).catch(()=>({ok:!1}));if(U.ok)for(const Q of((M=U.data)==null?void 0:M.images)||[])_(Q.url,cn(Q.source),Q.thumb);L(!1),S(T)}const O=r||(!i&&o?Ue(o):""),V=r&&(A==null?void 0:A.url)===r&&A.thumb?A.thumb:O;async function P(T){const B=T.target.files&&T.target.files[0];if(T.target.value="",!B)return;y(!0),j("");const _=await Ea(`/${t}/${n}/cover`,B);y(!1),_.ok?(h(!0),d(_.data)):j(le(_,a("error.upload.failed")))}return e.jsxs("div",{className:"flex items-start gap-4",style:{border:"1px solid var(--line)",borderRadius:12,padding:14},children:[e.jsx(Bn,{url:V,label:D}),e.jsxs("div",{className:"min-w-0 flex-1 space-y-2",children:[e.jsx(W,{className:"block",children:D}),e.jsxs("div",{className:"cover-ctl-row",children:[e.jsx(ye,{label:g?a("common.action.upload.busy"):a("cover.upload.tip",{noun:q}),children:e.jsxs("label",{className:"field-icon-btn field-icon-btn-boxed tactile"+(g?" is-busy":""),"aria-label":a("cover.upload.aria",{noun:q}),children:[e.jsx(ma,{}),e.jsx("input",{type:"file",accept:"image/*",className:"hidden",onChange:P,disabled:g})]})}),m&&e.jsx(Ae,{icon:e.jsx(Kn,{}),ariaLabel:a("cover.fetch-meta.aria"),"aria-pressed":!!p,onClick:m,tooltip:a("cover.fetch-meta.tip"),boxed:!0,active:!!p}),e.jsx(Ae,{icon:e.jsx(ym,{}),ariaLabel:a("cover.url.aria"),"aria-pressed":f,onClick:()=>b(T=>!T),tooltip:a("cover.url.tip"),boxed:!0,active:f}),e.jsx(Ae,{icon:e.jsx(on,{}),ariaLabel:a("cover.search.aria",{nouns:C}),onClick:I,disabled:x,tooltip:t==="movies"?_c(u==null?void 0:u.mediaType):a("cover.search.books.tip"),boxed:!0,busy:x}),(o||r)&&!i&&e.jsx(Ae,{icon:e.jsx(ze,{}),ariaLabel:a("cover.remove.aria",{noun:q}),onClick:h,boxed:!0,danger:!0})]}),f&&e.jsxs("div",{className:"flex gap-2 pt-1",children:[e.jsx("input",{className:"tp-input",placeholder:a("cover.url.placeholder"),value:w,onChange:T=>v(T.target.value)}),e.jsx(Ae,{icon:e.jsx(wt,{}),ariaLabel:a("cover.url.use.aria"),onClick:()=>{w.trim()&&l(w.trim()),b(!1),v("")},tooltip:a("cover.url.use.tip"),ok:!0,className:"shrink-0"})]}),N&&e.jsxs("div",{className:"space-y-1.5 pt-1",children:[e.jsx(W,{className:"block",children:N.length?a("cover.pick.prose",{noun:q}):a("cover.pick.none",{nouns:C})}),e.jsx("div",{className:"flex flex-wrap gap-2",children:N.map(T=>e.jsx(fp,{url:T.thumb||T.url,source:T.source,noun:q,onPick:()=>{l(T.url),E({url:T.url,thumb:T.thumb}),S(null)}},T.url))})]}),r&&e.jsx("p",{className:"microcopy",children:a("cover.pending",{noun:q})}),i&&e.jsx("p",{className:"microcopy",style:{color:"var(--error)"},children:a("cover.clearing",{noun:q})}),e.jsx(ke,{children:k})]})]})}function fp({url:t,source:n,noun:o,onPick:s}){const[r,i]=c.useState(null),[l,h]=c.useState(!1);if(l)return null;const d=r&&r.w>0&&r.w<Lc;return e.jsx(ye,{label:a("cover.pick.use",{noun:o,source:n,res:Mn(r)||a("common.state.loading")}),children:e.jsxs("button",{type:"button",className:"cover-pick"+(d?" is-low":""),"aria-label":a("cover.pick.use",{noun:o,source:n,res:Mn(r)||a("common.state.loading")}),onClick:s,children:[e.jsxs("span",{className:"relative block",children:[e.jsx("img",{src:t,alt:"",loading:"lazy",onLoad:m=>i({w:m.target.naturalWidth,h:m.target.naturalHeight}),onError:()=>h(!0)}),Mn(r)&&e.jsx("span",{className:"cover-res-badge"+(d?" is-low":""),children:Mn(r)})]}),e.jsx("span",{className:"microcopy",children:n})]})})}function gp(t){const n=[],o=new Map;for(const s of t||[]){const r=Si(s.title),i=Si(s.author),l=r&&i?`${r}\0${i}`:null,h=l&&o.get(l);if(h){h.editions.push(s),h.cover_url||(h.cover_url=s.cover_url||"");continue}const d={rep:s,editions:[s],cover_url:s.cover_url||""};l&&o.set(l,d),n.push(d)}return n}function rs({cover:t,title:n,sub:o,source:s,sourceDetail:r,count:i=1,expanded:l,onAdd:h,addLabel:d,busy:m=!1}){const p=d||a("cover.candidate.add.label"),u=i>1;return e.jsxs("li",{className:"sheen-raised flex items-center gap-3 rounded-xl px-3 py-2.5",style:{border:"1px solid var(--line)"},children:[e.jsx(Bn,{url:t,label:"",compact:!0,className:"w-9 shrink-0"}),e.jsxs("div",{className:"min-w-0 flex-1",children:[e.jsx("p",{className:"truncate text-sm font-semibold",title:n,children:n}),e.jsx("p",{className:"truncate text-xs",style:{color:"var(--soft)"},children:o})]}),u?e.jsx(W,{style:{flex:"none",fontSize:"var(--type-ui-9)"},children:a("cover.candidate.editions",{n:i})}):e.jsx(ap,{source:s,detail:r}),e.jsx(ye,{label:a(u?"cover.candidate.show-editions":"cover.candidate.add.tip"),className:"shrink-0",children:e.jsx("button",{type:"button",className:"cand-add tactile",onClick:h,disabled:m,"aria-label":u?a("cover.candidate.choose-edition.aria",{title:n}):a("cover.candidate.add.aria",{action:p,title:n}),"aria-expanded":u?!!l:void 0,children:u?e.jsx(jo,{open:!!l}):e.jsx(ht,{})})})]})}function Oc({isbn:t,title:n,author:o,asin:s,onPick:r,auto:i=!1,onClose:l}){const[h,d]=c.useState(null),[m,p]=c.useState(!1),[u,f]=c.useState("");async function b(){p(!0),f(""),d(null);const w={};if(t&&t.trim()&&(w.isbn=t.trim()),n&&n.trim()&&(w.title=n.trim()),o&&o.trim()&&(w.author=o.trim()),s&&s.trim()&&(w.asin=s.trim()),!w.isbn&&!w.title&&!w.asin)return p(!1),f(a("error.validate.lookup-fields"));const v=await Z("POST","/books/lookup",w);p(!1),v.ok?d(v.data.candidates):f(le(v,a("error.lookup.failed")))}return c.useEffect(()=>{i&&b()},[]),e.jsxs("div",{className:"space-y-2",children:[i?e.jsxs("div",{className:"flex items-center justify-between gap-2",children:[e.jsx(W,{className:"block",children:a(m?"cover.editions.busy":"cover.editions.prose")}),l&&e.jsx(Ae,{icon:e.jsx(it,{}),ariaLabel:a("cover.editions.close.aria"),onClick:l})]}):e.jsx(ge,{type:"button",onClick:b,disabled:m,children:a(m?"cover.editions.looking":"cover.editions.browse")}),e.jsx(ke,{children:u}),h&&h.length===0&&e.jsx("p",{className:"microcopy",children:a("cover.editions.none")}),h&&h.length>0&&e.jsx("ul",{className:"lookup-grid",children:h.map((w,v)=>e.jsxs("li",{className:"lookup-card",children:[e.jsx(ye,{label:a("cover.editions.use.tip"),children:e.jsx("button",{type:"button",className:"lookup-card-cover","aria-label":a("cover.editions.use.aria",{title:w.title}),onClick:()=>r(w),children:e.jsx(Bn,{url:w.cover_url,label:"",showRes:!0,className:"w-full"})})}),e.jsxs("div",{className:"min-w-0",children:[e.jsx("p",{className:"truncate text-sm font-semibold",title:w.title,children:w.title}),e.jsx("p",{className:"truncate text-xs",style:{color:"var(--soft)"},children:[w.author,w.published_year||null].filter(Boolean).join(" · ")}),w.series&&e.jsxs("p",{className:"truncate text-xs",style:{color:"var(--accent-ui)"},children:[w.series,w.series_index?` #${w.series_index}`:""]})]}),e.jsxs("div",{className:"flex items-center justify-between gap-2",children:[e.jsx("span",{className:"tp-chip shrink-0",style:{fontSize:"var(--type-ui-9)"},children:cn(w.source)}),e.jsx(Ae,{icon:e.jsx(wt,{}),ariaLabel:a("cover.editions.use.aria",{title:w.title}),onClick:()=>r(w),tooltip:a("cover.editions.use.exact",{title:w.title}),ok:!0,className:"shrink-0"})]})]},v))})]})}function Rc({title:t,year:n,mediaType:o="movie",tmdbId:s,tvdbId:r,onPick:i,auto:l=!1}){const[h,d]=c.useState(t||""),[m,p]=c.useState(n?String(n):""),[u,f]=c.useState(null),[b,w]=c.useState(!1),[v,g]=c.useState(""),[y,k]=c.useState(""),j=[lt(s)&&`TMDB #${lt(s)}`,lt(r)&&`TVDB #${lt(r)}`].filter(Boolean);c.useEffect(()=>{l&&((t||"").trim()||j.length)&&N()},[]);async function N(){if(!h.trim()&&!j.length)return;w(!0),g(""),f(null);const x={title:h.trim(),media_type:o};m&&(x.year=Number(m)),lt(s)&&(x.tmdb_id=lt(s)),lt(r)&&(x.tvdb_id=lt(r));const L=await Z("POST","/movies/lookup",x);w(!1),L.ok?(f(L.data.candidates),k(L.data.warning||"")):(k(""),g(le(L,a("error.lookup.failed"))))}const S=x=>{x.key==="Enter"&&(x.preventDefault(),N())};return e.jsxs("div",{className:"space-y-2",children:[e.jsxs("div",{className:"flex gap-2",children:[e.jsx("input",{className:"tp-input",placeholder:a("common.field.title.label"),value:h,onChange:x=>d(x.target.value),onKeyDown:S}),e.jsx("input",{className:"tp-input w-24 shrink-0",placeholder:a("common.field.year.label"),inputMode:"numeric",value:m,onChange:x=>p(x.target.value),onKeyDown:S}),e.jsx(Ae,{icon:e.jsx(on,{}),ariaLabel:a("cover.movie.search.aria"),onClick:N,disabled:b,tooltip:_c(o),className:"shrink-0"})]}),y&&e.jsx("p",{className:"microcopy",style:{color:"var(--error)"},children:y}),j.length>0&&e.jsx(W,{className:"block",children:a("cover.movie.by-id",{ids:j.join(" · ")})}),e.jsx(ke,{children:v}),u&&u.length===0&&e.jsx("p",{className:"microcopy",children:a("cover.movie.none")}),u&&u.length>0&&e.jsx("ul",{className:"lookup-grid",children:u.map(x=>e.jsxs("li",{className:"lookup-card",children:[e.jsx(ye,{label:a("cover.movie.use.tip"),children:e.jsx("button",{type:"button",className:"lookup-card-cover","aria-label":a("cover.editions.use.aria",{title:x.title}),onClick:()=>i(x),children:e.jsx(Bn,{url:x.poster_url,label:"",showRes:!0,className:"w-full"})})}),e.jsxs("div",{className:"min-w-0",children:[e.jsx("p",{className:"truncate text-sm font-semibold",title:x.title,children:x.title}),x.release_year?e.jsx("p",{className:"truncate text-xs",style:{color:"var(--soft)"},children:x.release_year}):null]}),e.jsxs("div",{className:"flex items-center justify-between gap-2",children:[e.jsx("span",{className:"tp-chip shrink-0",style:{color:"var(--amber)",fontSize:"var(--type-ui-9)"},children:cn(x.source||"tmdb")}),e.jsx(Ae,{icon:e.jsx(wt,{}),ariaLabel:a("cover.editions.use.aria",{title:x.title}),onClick:()=>i(x),tooltip:a("cover.editions.use.exact",{title:x.title}),ok:!0,className:"shrink-0"})]})]},`${x.source}-${x.source_id||x.tmdb_id}`))})]})}const Tt=10;function bp(){const[t,n]=c.useState(()=>typeof matchMedia<"u"&&matchMedia("(prefers-reduced-motion: reduce)").matches);return c.useEffect(()=>{const o=matchMedia("(prefers-reduced-motion: reduce)"),s=()=>n(o.matches);return o.addEventListener("change",s),()=>o.removeEventListener("change",s)},[]),t}function yp(t){const n=getComputedStyle(t),o=parseFloat(n.fontSize)||16;let s=parseFloat(n.lineHeight);return(!s||Number.isNaN(s))&&(s=o*1.5),{font:`${n.fontStyle} ${n.fontWeight} ${n.fontSize} ${n.fontFamily}`,lh:s}}function wp(t,n,o,s,r,i){const l=t,h=t+n;let d=0;if(s.cy<l?d=l-s.cy:s.cy>h&&(d=s.cy-h),d>=s.r)return[{x:0,w:o}];const m=Math.sqrt(s.r*s.r-d*d),p=s.cx-m-r,u=s.cx+m+r,f=[];return p>=i&&f.push({x:0,w:p}),o-u>=i&&f.push({x:u,w:o-u}),f}function qi(t,n,o,s,r,i,l){const d=t.prepareWithSegments(n,o);let m={segmentIndex:0,graphemeIndex:0};const p=[];let u=0;for(let f=0;f<800;f++){const b=wp(u,s,r,i,l,34);if(b.length===0){const g=t.layoutNextLine(d,m,r);if(!(g&&!(g.end.segmentIndex===m.segmentIndex&&g.end.graphemeIndex===m.graphemeIndex)))break;p.push({segs:[]}),u+=s;continue}const w=[];let v=!1;for(const g of b){const y=t.layoutNextLine(d,m,Math.max(34,g.w));if(!y||y.end.segmentIndex===m.segmentIndex&&y.end.graphemeIndex===m.graphemeIndex)break;w.push({text:y.text,x:g.x,w:g.w}),m=y.end,v=!0}if(!v)break;p.push({segs:w}),u+=s}return p}function Ic({text:t,sticker:n,stickerKey:o="",quoteStyle:s,radius:r=42,gap:i=12,maxLines:l=0,pos:h=null,onMove:d,open:m,onToggle:p,className:u=""}){const f=c.useRef(null),[b,w]=c.useState(null),[v,g]=c.useState(!1),y=m!==void 0,k=y?m:v,j=()=>y?p==null?void 0:p():g(U=>!U),N=bp(),S=!!n,x=c.useRef(h),L=c.useRef(null),A=c.useRef(b),E=c.useRef(null),D=c.useRef(d);A.current=b,D.current=d,c.useEffect(()=>{g(!1),x.current=h},[t,o]),c.useEffect(()=>{E.current||(x.current=h,L.current&&L.current())},[h&&h.x,h&&h.y]),c.useLayoutEffect(()=>{const U=f.current;if(!U||N||!S||!t){w(null);return}let F=!1,X=null;async function R(){if(X||(X=await Qe(()=>import("./layout-7OQMGvZm.js"),[])),F)return;const K=U.clientWidth;if(!K)return;const M=Math.min(r,Math.floor(K/3)),{font:Q,lh:z}=yp(U),te=qi(X,t,Q,z,K,{cx:0,cy:0,r:0},i).length,J=Math.max(te*z,M*2),fe=l>0&&te>l,me=fe&&!k;let H,ee,oe;if(me)H=Math.max(15,Math.round(M*.5)),ee=K-H+Math.min(Tt,Math.round(H*.5)),oe=H-Math.min(Tt,Math.round(H*.5));else{H=M;const de=x.current;ee=de&&typeof de.x=="number"?de.x*K:K-H,oe=de&&typeof de.y=="number"?de.y*K:H,ee=Math.max(H-Tt,Math.min(K-H+Tt,ee)),oe=Math.max(H-Tt,Math.min(J-H+Tt,oe))}const pe=qi(X,t,Q,z,K,{cx:ee,cy:oe,r:H},i);F||w({lines:pe,lh:z,r:H,W:K,cx:ee,cy:oe,naturalH:J,collapsed:me,clampable:fe})}L.current=()=>R().catch(()=>{}),R().catch(()=>{F||w(null)});const G=new ResizeObserver(()=>R().catch(()=>{}));return G.observe(U),document.fonts&&document.fonts.ready&&document.fonts.ready.then(()=>{F||R().catch(()=>{})}),()=>{F=!0,G.disconnect(),L.current=null}},[t,o,S,N,r,i,k,l]);const q=c.useCallback(U=>{const F=E.current;if(!F)return;let X=U.clientX-F.left-F.grabDx,R=U.clientY-F.top-F.grabDy;X=Math.max(F.r-Tt,Math.min(F.W-F.r+Tt,X)),R=Math.max(F.r-Tt,Math.min(Math.max(F.r,F.naturalH-F.r+Tt),R)),x.current={x:X/F.W,y:R/F.W},L.current&&L.current()},[]),C=c.useCallback(()=>{window.removeEventListener("pointermove",q),window.removeEventListener("pointerup",C);const U=f.current;U&&(U.dataset.dragging="0");const F=!!E.current;E.current=null,F&&D.current&&x.current&&D.current(x.current.x,x.current.y)},[q]),I=c.useCallback(U=>{const F=A.current;if(!D.current||!F||F.collapsed)return;U.preventDefault(),U.stopPropagation();const X=f.current,R=X.getBoundingClientRect();E.current={left:R.left,top:R.top,W:F.W,r:F.r,naturalH:F.naturalH,grabDx:U.clientX-R.left-F.cx,grabDy:U.clientY-R.top-F.cy},X.dataset.dragging="1",window.addEventListener("pointermove",q),window.addEventListener("pointerup",C)},[q,C]);c.useEffect(()=>()=>{window.removeEventListener("pointermove",q),window.removeEventListener("pointerup",C)},[q,C]);const O=b?b.r*2:r*2,V=b?b.lines:[],P=!!(b&&b.collapsed),T=P?V.slice(0,l):V,B=!!b&&b.clampable,_=!!d&&!P;return e.jsx("div",{ref:f,className:`flow card-text ${B?"clampable is-clickable":""} ${u}`.trim(),style:{position:"relative",...s},role:B?"button":void 0,tabIndex:B?0:void 0,"aria-expanded":B?k:void 0,onClick:B?j:void 0,onKeyDown:B?U=>{(U.key==="Enter"||U.key===" ")&&(U.preventDefault(),j())}:void 0,children:b?e.jsxs(e.Fragment,{children:[e.jsx("span",{className:"flow-sticker",onPointerDown:_?I:void 0,style:{position:"absolute",left:b.cx-b.r,top:b.cy-b.r,width:O,height:O,zIndex:2,cursor:_?"grab":"default",touchAction:_?"none":void 0,transition:"left .18s ease, top .18s ease, width .18s ease, height .18s ease"},title:_?a("common.sticker.drag.tip"):void 0,children:n}),e.jsx("div",{style:{height:T.length*b.lh},children:T.map((U,F)=>e.jsx("div",{style:{position:"relative",height:b.lh},children:U.segs.map((X,R)=>e.jsx("span",{className:"flow-line",style:{position:"absolute",left:Math.max(0,X.x),top:0,width:Math.max(0,X.w),height:b.lh,lineHeight:`${b.lh}px`},children:X.text||" "},R))},F))}),B&&e.jsx(La,{open:k})]}):e.jsxs("p",{className:"flow-fallback",style:{margin:0},children:[n&&e.jsx("span",{className:"flow-sticker",style:{float:"right",width:O,height:O,marginLeft:i,marginBottom:4},children:n}),t]})})}function Go(t){return Ue(t)}const Hn={comma:!0,semicolon:!0,amp:!0,and:!0};function wn(t){const n=String(t||"").trim();if(!n)return Hn;if(n.toLowerCase()==="none")return{comma:!1,semicolon:!1,amp:!1,and:!1};const o={comma:!1,semicolon:!1,amp:!1,and:!1};let s=!1;for(const r of n.split(",")){const i=r.trim().toLowerCase();i in o&&(o[i]=!0,s=!0)}return s?o:Hn}const vp=new Set(["jr","jr.","sr","sr.","inc","inc.","ltd","ltd.","llc","llc.","co","co."]),kp=/^[0-9]+(st|nd|rd|th)?\.?$/,xp=t=>vp.has(t)||kp.test(t),jp=/\s+and\s+/i,Sp=/^and\s+/i,Np=8;function Tp(t,n){if(t=t.trim(),!t)return[];if(n&&(t=t.replace(Sp,"").trim(),!t))return[];const o=t.split(new RegExp(jp.source,"gi"));if(o.length<2)return[t];if(!n){for(const s of o)if(s.trim().split(/\s+/).filter(Boolean).length<2)return[t]}return o}function tt(t,n=Hn){const o=String(t||"").trim().replace(/\s+/g," ");if(!o)return[];if(!n.comma&&!n.semicolon&&!n.amp&&!n.and)return[o];let s=!1,r=[o];const i=(m,p)=>m.flatMap(u=>u.split(p));n.comma&&o.includes(",")&&(s=!0,r=i(r,",")),n.semicolon&&o.includes(";")&&(s=!0,r=i(r,";")),n.amp&&o.includes("&")&&(s=!0,r=i(r,"&")),n.and&&(r=r.flatMap(m=>Tp(m,s)));const l=[];for(let m of r){if(m=m.trim(),!m)continue;const p=m.toLowerCase();if(!(p==="et al"||p==="et al.")){if(xp(p)&&l.length>0){l[l.length-1]+=", "+m;continue}l.push(m)}}const h=new Set,d=[];for(const m of l){const p=m.toLowerCase();if(!h.has(p)&&(h.add(p),d.push(m),d.length===Np))break}return d.length?d:[o]}function Xe(t){const[n,o]=c.useState({});async function s(){if(!t)return;const r=await Z("GET",`/people?kind=${t}`);r.ok&&o(Object.fromEntries((r.data.people||[]).map(i=>[i.name,i])))}return c.useEffect(()=>{if(!t){o({});return}s()},[t]),{map:n,reload:s}}const Cp=20;function Pc(t,n,o,s){const r=c.useRef(null);r.current===null&&(r.current=new Set),c.useEffect(()=>{var h;if(!t)return;const i=[];for(const d of n||[]){const m=String(d||"").trim();if(!(!m||r.current.has(m)||(h=o==null?void 0:o[m])!=null&&h.image_path)&&(i.push(m),i.length>=Cp))break}if(i.length===0)return;for(const d of i)r.current.add(d);let l=!0;return(async()=>{var m;let d=0;for(const p of i){if(!l)return;const u=await Z("POST","/people/portrait",{kind:t,name:p});u.ok&&((m=u.data)!=null&&m.image)&&(d+=1)}l&&d&&(s==null||s())})(),()=>{l=!1}},[t,n,o])}function _a({person:t,size:n=30}){return t!=null&&t.image_path?e.jsx("img",{src:Go(t.image_path),alt:"",style:{width:n,height:n,borderRadius:"50%",objectFit:"cover",border:"1px solid var(--ink-border)",flex:"none"}}):null}const Ep=5e3;let En=null;function Fc(t){const n=Date.now();if(En&&En.offset===t&&n-En.at<Ep)return En.promise;const o=Z("GET",`/review/daily?offset=${t}`).then(s=>(s.ok||kr(),s));return En={at:n,offset:t,promise:o},o}function kr(){En=null}const xr=["speech","letter","essay","proverb","other"];function jr(){return[["",a("vocab.quote-kind.unset.label")],...xr.map(t=>[t,Oa(t)])]}function Oa(t){const n=String(t||"");return xr.includes(n)?a(`vocab.quote-kind.${n}.label`):""}function Ra(t){return Oa(t==null?void 0:t.kind)||(t==null?void 0:t.medium)||""}const Eo={annotation:{bulk:"/annotations/bulk",del:"/annotations/bulk/delete",noun:["highlight","highlights"],unit:"unit.highlight"},dialogue:{bulk:"/dialogues/bulk",del:"/dialogues/bulk/delete",noun:["film line","film lines"],unit:"unit.dialogue"},quote:{bulk:"/quotes/bulk",del:"/quotes/bulk/delete",noun:["quote","quotes"],unit:"unit.quote"},book:{bulk:"/books/bulk",del:"/books/bulk/delete",status:"/books/bulk/status",noun:["book","books"],unit:"unit.book"},movie:{bulk:"/movies/bulk",del:"/movies/bulk/delete",status:"/movies/bulk/status",noun:["title","titles"],unit:"unit.title"}},Ap={book:"annotation",screen:"dialogue",utterance:"quote"};function Sr(t,n){var s;const o=((s=Eo[t])==null?void 0:s.noun)||["item","items"];return`delete ${n} ${n===1?o[0]:o[1]}`}const Mi=15;function Bc({kind:t,ids:n=[],onDone:o}){const[s,r]=c.useState(!1),i=Eo[t],l=n.length;async function h(u,f){if(!i)return;r(!0);const b=await Z("POST",i.bulk,{ids:n,...u});if(r(!1),!b.ok)return Ee(le(b,a("error.apply.generic")));Ee(f),o==null||o()}async function d(u,f){if(!(i!=null&&i.status))return;r(!0);const b=await Z("POST",i.status,{ids:n,status:u});if(r(!1),!b.ok)return Ee(le(b,a("error.apply.generic")));Ee(f),o==null||o()}async function m(){var w,v;r(!0);const u=t==="book"?"book_ids":"movie_ids";let f=0,b=0;for(let g=0;g<n.length;g+=Mi){const y=await Z("POST","/metadata/fill",{[u]:n.slice(g,g+Mi)});if(!y.ok)return r(!1),Ee(le(y,a("error.fill.generic")));f+=((w=y.data)==null?void 0:w.fields)||0,b+=((v=y.data)==null?void 0:v.failed)||0}r(!1),Ee(f===0?a(b?"common.selection.fill.toast.none-fetched":"common.selection.fill.toast.nothing-missing"):a("common.selection.fill.toast.filled",{count:f,n:f})),o==null||o()}async function p(){var b;if(!i)return;r(!0);const u=await Z("POST",i.del,{ids:n,confirm:Sr(t,l)});if(r(!1),!u.ok)return Ee(le(u,a("error.delete.generic")));const f=(b=u.data)==null?void 0:b.trash_id;Ee(a("common.toast.deleted",{count:l,n:l}),f?{label:a("common.action.undo.label"),onClick:async()=>{const w=await Z("POST",`/trash/${f}/restore`);Ee(w.ok?a("common.toast.restored.label"):le(w,a("error.undo.generic"))),o==null||o()}}:void 0),o==null||o()}return{busy:s,routes:i,count:l,post:h,setShelf:d,fillGaps:m,remove:p}}const qp=[{key:"author",get label(){return a("common.field.author.label")},kinds:["book"]},{key:"translator",get label(){return a("common.field.translator.label")},kinds:["book"]},{key:"editor",get label(){return a("common.field.editor.label")},kinds:["book"]},{key:"director",get label(){return a("common.field.director.label")},kinds:["movie"]},{key:"publisher",get label(){return a("common.field.publisher.label")},kinds:["movie"]},{key:"media_type",get label(){return a("common.field.media-type.label")},kinds:["movie"],required:!0,get options(){return[["movie",a("vocab.kind.movie.label")],["show",a("vocab.kind.show.label")],["game",a("vocab.kind.game.label")]]}},{key:"published_year",get label(){return a("common.field.year.label")},kinds:["book"],number:!0},{key:"release_year",get label(){return a("common.field.year.label")},kinds:["movie"],number:!0},{key:"series",get label(){return a("common.field.series.label")},kinds:["book"],title:!0},{key:"series",get label(){return a("common.field.collection.label")},kinds:["movie"],title:!0},{key:"series_index",get label(){return a("common.field.series-no.label")},kinds:["book"],number:!0},{key:"series_index",get label(){return a("common.field.collection-no.label")},kinds:["movie"],number:!0},{key:"description",get label(){return a("common.field.description.label")},long:!0}],Mp=[{key:"note",get label(){return a("common.field.note.label")},long:!0},{key:"chapter_no",get label(){return a("common.field.chapter-no.label")},kinds:["annotation"],number:!0},{key:"chapter",get label(){return a("common.field.chapter-name.label")},kinds:["annotation"]},{key:"location",get label(){return a("common.field.location.label")},kinds:["annotation"]},{key:"character",get label(){return a("common.field.character.label")},kinds:["dialogue"]},{key:"actor",get label(){return a("common.field.actor.label")},kinds:["dialogue"]},{key:"timestamp",get label(){return a("common.field.timestamp.label")},kinds:["dialogue"]},{key:"speaker",get label(){return a("common.field.speaker.label")},kinds:["quote"]},{key:"occasion",get label(){return a("common.field.occasion.label")},kinds:["quote"]},{key:"place",get label(){return a("common.field.place.label")},kinds:["quote"]},{key:"kind",get label(){return a("quotes.form.kind.label")},kinds:["quote"],get options(){return jr().slice(1)}}];function Lp(t){return(t==="book"||t==="movie"?qp:Mp).filter(o=>!o.kinds||o.kinds.includes(t))}function Dp(t,n){const o=[],s=new Set;for(const r of t||[]){const i=r==null?void 0:r[n];i==null||i===""||(o.push(i),s.add(String(i)))}return o.length===0?null:{rows:o.length,distinct:s.size,text:s.size===1?a("common.selection.edit.overwrite.same",{count:o.length,n:o.length,value:[...s][0]}):a("common.selection.edit.overwrite.differ",{count:o.length,n:o.length,distinct:s.size})}}function Vo(){return-new Date().getTimezoneOffset()}let Hc={submitStep:!1};function _p(t){Hc={submitStep:!!(t!=null&&t.srSubmit)}}const Op=()=>Hc.submitStep;function Li(t){return t.kind==="screen"?a(t.media_type==="show"?"quiz.noun.show.label":"quiz.noun.film.label"):t.kind==="utterance"?a("quiz.noun.occasion.label"):a("quiz.noun.book.label")}function Rp(t){switch(t.direction){case"source":return a("quiz.question.source.stem",{kind:Li(t)});case"quote":return a("quiz.question.quote.stem",{kind:Li(t)});case"cloze":return a("quiz.question.cloze.stem");case"cloze-mcq":return a("quiz.question.cloze-mcq.stem");case"speaker":return a("quiz.question.speaker.stem");case"author":return a("quiz.question.author.stem");default:return a("quiz.question.flip.stem")}}const qs="￼",zc=t=>(t.quote||t.note||"").includes(qs),$c=t=>zc(t)&&!(t.options||[]).length;function Ip(t){return!zc(t)&&!(t.options||[]).length}function Pp({card:t}){return e.jsxs("blockquote",{style:{borderLeft:`4px solid ${jn(t.color)||"var(--accent-ui)"}`,padding:"2px 0 2px 12px"},children:[e.jsx("p",{style:{fontFamily:"var(--font-display)",fontWeight:"var(--font-display-weight)",fontVariantCaps:"var(--font-display-caps)",textTransform:"var(--font-display-case)",fontVariantNumeric:"var(--font-display-figures)",fontStyle:"italic",fontSize:"var(--type-display-17)",lineHeight:1.5,overflowWrap:"anywhere",whiteSpace:"pre-wrap"},children:Fp(t.quote||t.note)}),t.note&&t.quote&&e.jsx(Bo,{className:"mt-2",children:t.note})]})}function Fp(t){const n=t||"";return n.includes(qs)?n.split(qs).flatMap((s,r)=>r===0?[s]:[e.jsx("span",{"aria-label":a("quiz.cloze.blank.aria"),style:{display:"inline-block",minWidth:84,borderBottom:"2px solid var(--accent-ui)",verticalAlign:"baseline"}},r),s]):n}const Bp=4;function Hp({opt:t,om:n,personMaps:o,isWork:s,revealed:r,disabled:i,onPick:l,style:h,hotkey:d}){var v;const[m,p]=c.useState(!1),[u,f]=c.useState(!1),b=c.useRef(null);c.useEffect(()=>{const g=b.current;if(!g||m)return;const y=()=>f(g.scrollHeight>g.clientHeight+1);y();const k=new ResizeObserver(y);return k.observe(g),()=>k.disconnect()},[t,m]);const w=m?{}:{display:"-webkit-box",WebkitLineClamp:Bp,WebkitBoxOrient:"vertical",overflow:"hidden"};return e.jsxs("div",{className:"flex items-start gap-2",children:[e.jsx("button",{type:"button",disabled:i,onClick:l,className:"min-w-0 flex-1 text-left",style:h,children:e.jsxs("span",{className:"flex items-start gap-2.5",children:[s&&e.jsx(Ms,{path:n==null?void 0:n.art}),e.jsxs("span",{className:"min-w-0 flex-1",children:[e.jsxs("span",{ref:b,style:{display:"block",...w},children:[d&&e.jsx(mn,{keys:d}),d?" ":"",t]}),!s&&(n==null?void 0:n.person)&&e.jsx("span",{className:"mt-1.5 flex",style:{fontStyle:"normal"},children:e.jsx(Wc,{name:n.person,person:(v=o[n.kind])==null?void 0:v[n.person],size:18})}),r&&(n==null?void 0:n.source)&&e.jsxs("span",{className:"mt-1.5 flex items-center gap-1.5",style:{fontStyle:"normal"},children:[e.jsx(Ms,{path:n.art,size:22}),e.jsx(W,{style:{fontSize:"var(--type-ui-11)",color:"var(--faint)"},children:a("quiz.option.source.label",{title:n.source})})]})]})]})}),(u||m)&&e.jsx(Ae,{icon:e.jsx(La,{open:m}),ariaLabel:a(m?"quiz.option.collapse.aria":"quiz.option.expand.aria"),"aria-expanded":m,onClick:()=>p(g=>!g),tooltip:a(m?"common.action.show-less.label":"quiz.option.expand.tip")})]})}function Ms({path:t,size:n=30}){const o={flex:"0 0 auto",width:n,aspectRatio:"2 / 3",borderRadius:4,border:"1px solid var(--ink-border)",background:"var(--raised)",display:"block",objectFit:"cover"};return t?e.jsx("img",{src:Ue(t),alt:"",style:o}):e.jsx("span",{style:o,"aria-hidden":"true"})}function Wc({name:t,person:n,size:o=20}){return t?e.jsxs("span",{className:"inline-flex items-center gap-1.5",style:{background:"var(--raised)",border:"1px solid var(--line)",borderRadius:999,padding:"2px 9px 2px 4px",maxWidth:"100%"},children:[e.jsx(_a,{person:n,size:o}),e.jsx("span",{className:"mono-label",style:{fontSize:"var(--type-ui-11)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"},children:t})]}):null}function Di({card:t,maps:n={}}){let o;t.kind==="screen"?o=t.actor?[{name:t.actor,kind:"actor"}]:[]:t.kind==="utterance"?o=t.speaker&&t.speaker!==t.title?[{name:t.speaker,kind:"speaker"}]:[]:o=tt(t.author,Hn).map(r=>({name:r,kind:"author"}));let s;return t.kind==="screen"?s=[a(t.media_type==="show"?"vocab.kind.show.label":"vocab.kind.movie.label"),xn(t),t.character,t.timestamp].filter(Boolean).join(" · "):t.kind==="utterance"?s=t.occasion_date||"":s=[t.character,Ks(t),t.location&&a("common.locator.page.label",{n:t.location})].filter(Boolean).join(" · "),e.jsxs("div",{className:"flex items-start gap-3",children:[t.art&&e.jsx(Ms,{path:t.art,size:44}),e.jsxs("div",{className:"min-w-0 flex-1",children:[e.jsx("p",{style:{fontFamily:"var(--font-display)",fontStyle:"var(--font-display-style)",fontVariantCaps:"var(--font-display-caps)",textTransform:"var(--font-display-case)",fontVariantNumeric:"var(--font-display-figures)",fontWeight:600,fontSize:"var(--type-display-19)",lineHeight:1.2},children:t.title}),o.length>0&&e.jsx("div",{className:"mt-1.5 flex flex-wrap gap-1.5",children:o.map(r=>{var i;return e.jsx(Wc,{name:r.name,person:(i=n[r.kind])==null?void 0:i[r.name]},r.kind+r.name)})}),s&&e.jsx(W,{className:"mt-1 block",style:{fontSize:"var(--type-ui-11)"},children:s})]})]})}const zp={book:{list:"/annotations",rows:"annotations"},screen:{list:"/dialogues",rows:"dialogues"},utterance:{list:"/quotes",rows:"utterances"}};function $p(t,n){return{...t,note:n.note??t.note,quote:$c(t)?t.quote:n.quote??t.quote}}function Wp({card:t,onPatch:n}){const o=zp[t.kind],[s,r]=c.useState(!1),[i,l]=c.useState(null),[h,d]=c.useState(""),[m,p]=c.useState(""),[u,f]=c.useState(""),[b,w]=c.useState(!1),[v,g]=c.useState(!1),[y,k]=c.useState("");c.useEffect(()=>{if(!s||!o)return;let N=!0;return l(null),k(""),Z("GET",`${o.list}?id=${t.id}`).then(S=>{var L;if(!N)return;const x=S.ok?(((L=S.data)==null?void 0:L[o.rows])||[])[0]:null;if(!x)return k(a("error.load.quiz-card"));l(x),d(x.quote||""),p(x.note||""),f((x.tags||[]).join(", ")),w(!!x.favorite)}),()=>{N=!1}},[s,t.kind,t.id]);async function j(){if(!i||v)return;g(!0),k("");const N=await Z("PUT",`${o.list}/${t.id}`,{...i,quote:h,note:m,favorite:b,tags:u.split(",").map(S=>S.trim()).filter(Boolean)}).catch(()=>({ok:!1}));if(g(!1),!N.ok)return k(le(N,a("error.save.quiz-card")));n($p(t,{quote:h,note:m})),r(!1),Ee(a("common.toast.saved"))}return o?e.jsxs("div",{className:"mt-3",style:{borderTop:"1px solid var(--line)",paddingTop:10},children:[s?i==null&&!y?e.jsx(W,{style:{color:"var(--faint)"},children:a("common.action.load.busy")}):e.jsxs("div",{className:"space-y-2",children:[e.jsx(Se,{label:a("common.field.quote.label"),value:h,onChange:N=>d(N.target.value)}),e.jsx(Se,{label:a("common.field.note.label"),value:m,onChange:N=>p(N.target.value)}),e.jsx(Se,{label:a("common.field.tags.label"),value:u,placeholder:a("quiz.card.tags.placeholder"),onChange:N=>f(N.target.value)}),e.jsxs("div",{className:"flex flex-wrap items-center gap-2",children:[e.jsxs("button",{type:"button",className:"tp-btn tactile inline-flex items-center gap-1.5","aria-pressed":b,style:b?{color:"var(--accent-ui)",borderColor:"var(--accent-ui)"}:void 0,onClick:()=>w(N=>!N),children:[b?e.jsx(Gm,{}):e.jsx(mr,{})," ",a(b?"quiz.card.favourite.on.label":"quiz.card.favourite.off.label")]}),e.jsxs("span",{className:"ml-auto flex items-center gap-2",children:[e.jsx("button",{type:"button",className:"tp-link",onClick:()=>r(!1),children:a("common.action.cancel.label")}),e.jsx("button",{type:"button",className:"tp-btn tp-btn-primary tactile",disabled:v||!i,onClick:j,children:a(v?"common.action.save.busy":"common.action.save.label")})]})]})]}):e.jsxs("button",{type:"button",className:"tp-link tp-link-icon",onClick:()=>r(!0),children:[e.jsx(et,{}),e.jsx("span",{children:a("quiz.card.fix.label")})]}),y&&e.jsx("div",{className:"mt-2",children:e.jsx(ke,{children:y})})]}):null}function Nr({mode:t,cards:n,allowSkip:o,startIndex:s=0,onIndex:r,onAnswered:i,onDone:l,submitStep:h=!1}){const d=Ie(),[m,p]=c.useState(s),[u,f]=c.useState(null),[b,w]=c.useState(!1),[v,g]=c.useState(null),[y,k]=c.useState(null),[j,N]=c.useState(!1),[S,x]=c.useState(""),[L,A]=c.useState(!1),[E,D]=c.useState(!1),[q,C]=c.useState(!1),I=c.useRef(null),[O,V]=c.useState(""),P=c.useRef(s),T=c.useRef(null),{map:B}=Xe("author"),{map:_}=Xe("actor"),{map:U}=Xe("director"),{map:F}=Xe("speaker"),X={author:B,actor:_,director:U,speaker:F},[R,G]=c.useState({}),K=n[m];if(!K)return null;const M=R[m]||K,Q=Ip(M),z=$c(M),te=h&&!Q&&!z,J=z?v!=null:te?j:u!=null,fe=N,me=Q||z?v!=null:J,H=z?"cloze":Q?"flip":"mcq",ee=t==="practice";c.useEffect(()=>ec((Ne,{shift:ae})=>{var be,ie;if(!q&&ae===ee){if(Ne==="reveal")return Q&&!b?w(!0):void 0;if(!(Q&&!b)){if(Ne==="grade-got")return de("got");if(Ne==="grade-forgot")return de("forgot");if(Ne==="focus-blank")return(be=I.current)==null?void 0:be.focus();if(Ne.startsWith("pick-")){const je=Number(Ne.slice(5))-1;je>=0&&je<(((ie=M.options)==null?void 0:ie.length)||0)&&!J&&ce(je)}}}},{ctx:()=>H}),[q,Q,b,z,H,ee,J,m,M==null?void 0:M.id]);const oe=c.useRef(new Set);c.useEffect(()=>{if(!me)return;const Ne=`${M.kind}:${M.id}`;if(!oe.current.has(Ne)){oe.current.add(Ne);for(const ae of M.option_meta||[])!(ae!=null&&ae.item_kind)||!(ae!=null&&ae.item_id)||ae.item_kind===M.kind&&ae.item_id===M.id||Z("POST","/review/seen",{kind:ae.item_kind,id:ae.item_id}).catch(()=>{})}},[me,M]);async function pe(){if(P.current=m+1,C(!1),V(""),m+1<n.length){p(m+1),r==null||r(m+1),f(null),x(""),N(!1),w(!1),g(null),k(null),A(!1),D(!1);return}await T.current,l==null||l()}async function de(Ne,ae=null){var Ze;const be=m;C(!0),V(""),kr();const ie=Z("POST","/review/answer",{kind:M.kind,id:M.id,result:Ne,mode:t,offset:Vo(),...ae!=null?{attempt:ae}:{}}).catch(()=>({ok:!1,status:0,data:null}));T.current=ie;const je=await ie,Ce=P.current===be;if(Ce&&C(!1),!je.ok){Ce&&V(a("error.save.quiz-answer"));return}Ce&&k(je.data);const Be=((Ze=je.data)==null?void 0:Ze.result)||Ne;Ce&&ae!=null&&g(Be),i==null||i(Be,je.data)}function se(){A(!0)}async function Y(){const Ne=Ap[M.kind];if(!Ne)return;if(D(!0),!(await Z("POST",`/${Ne}s/bulk`,{ids:[M.id],review:!1}).catch(()=>({ok:!1}))).ok){D(!1),Ee(a("error.setaside.generic"));return}Ee(a("quiz.leech.aside.label"))}async function ce(Ne){if(!(J||q)){if(te){f(Ne);return}f(Ne),await de(Ne===M.answer?"got":"forgot")}}async function Te(){u==null||J||q||(fe(!0),await de(u===M.answer?"got":"forgot"))}async function Le(){v!=null||q||!S.trim()||await de("forgot",S)}async function Fe(Ne){v!=null||q||(g(Ne),await de(Ne))}const _e=M.direction==="source",ne=M.direction==="quote"||M.direction==="cloze-mcq",he=v==="got",qe=!L&&((y==null?void 0:y.leech)??M.leech);return e.jsxs("div",{className:"review-card-body",children:[e.jsxs("div",{className:"mb-2 flex items-baseline justify-between gap-3",children:[e.jsx(W,{children:Rp(M)}),e.jsx("span",{className:"mono-label",style:{letterSpacing:".06em"},children:a("quiz.progress.label",{done:m+1,total:n.length})})]}),M.direction==="quote"?e.jsx(Di,{card:M,maps:X}):e.jsx(Pp,{card:M}),z&&e.jsx("div",{className:"mt-3",children:v==null?e.jsxs("form",{className:"flex items-end gap-2",onSubmit:Ne=>{Ne.preventDefault(),Le()},children:[e.jsx(Se,{label:a("quiz.cloze.field.label"),hideLabel:!0,inputRef:I,value:S,placeholder:d?a("quiz.cloze.placeholder"):a("quiz.cloze.placeholder-key",{key:Vt("focus-blank",t==="practice")}),autoFocus:!0,onChange:Ne=>x(Ne.target.value)}),e.jsx("button",{type:"submit",className:"tp-btn tp-btn-primary tactile",disabled:q||!S.trim(),children:a("quiz.cloze.check.label")})]}):e.jsxs("div",{style:{borderTop:"1px solid var(--line)",paddingTop:12},children:[e.jsx(W,{style:{color:"var(--faint)"},children:a("quiz.cloze.answer.label")}),e.jsx("p",{className:"mt-1",style:{fontFamily:"var(--font-display)",fontWeight:"var(--font-display-weight)",fontVariantCaps:"var(--font-display-caps)",textTransform:"var(--font-display-case)",fontVariantNumeric:"var(--font-display-figures)",fontSize:"var(--type-display-17)",fontStyle:"italic"},children:(y==null?void 0:y.answer)||S}),(y==null?void 0:y.synonym)&&e.jsx(W,{className:"mt-1 block",style:{color:"var(--faint)"},children:a("quiz.cloze.synonym.note")})]})}),Q&&e.jsx("div",{className:"mt-3",children:b?e.jsxs(e.Fragment,{children:[e.jsx("div",{style:{borderTop:"1px solid var(--line)",paddingTop:12},children:e.jsx(Di,{card:M,maps:X})}),v==null?e.jsxs("div",{className:"mt-3 flex items-center gap-2",children:[e.jsx(ye,{label:a("quiz.grade.forgot.label"),shortcut:"grade-forgot",shiftKey:t==="practice",children:e.jsxs("button",{type:"button",className:"tp-btn tactile",disabled:q,onClick:()=>Fe("forgot"),children:[a("quiz.grade.forgot.label")," ",e.jsx(mn,{keys:Vt("grade-forgot",t==="practice")})]})}),e.jsx(ye,{label:a("quiz.grade.got.label"),shortcut:"grade-got",shiftKey:t==="practice",children:e.jsxs("button",{type:"button",className:"tp-btn tp-btn-primary tactile",disabled:q,onClick:()=>Fe("got"),children:[a("quiz.grade.got.label")," ",e.jsx(mn,{keys:Vt("grade-got",t==="practice")})]})})]}):null]}):e.jsx(ye,{label:a("quiz.flip.reveal.tip"),shortcut:"reveal",shiftKey:t==="practice",children:e.jsxs("button",{type:"button",className:"tp-btn tp-btn-primary tactile",onClick:()=>w(!0),children:[a("quiz.flip.reveal.label")," ",e.jsx(mn,{keys:Vt("reveal",t==="practice")})]})})}),e.jsx("div",{className:"mt-3 flex flex-col gap-2",children:(M.options||[]).map((Ne,ae)=>{var Ze;const be=ae===M.answer,ie=u===ae,je=((Ze=M.option_meta)==null?void 0:Ze[ae])||null;let Ce="var(--line)",Be="var(--raised)";return me&&be?(Ce="var(--ok)",Be="color-mix(in srgb, var(--ok) 16%, transparent)"):me&&ie&&!be?(Ce="var(--error)",Be="color-mix(in srgb, var(--error) 12%, transparent)"):ie&&(Ce="var(--accent-ui)",Be="color-mix(in srgb, var(--accent-ui) 10%, transparent)"),e.jsx(Hp,{opt:Ne,om:je,personMaps:X,isWork:_e,revealed:me,disabled:J||q,hotkey:ae<4?Vt(`pick-${ae+1}`,t==="practice"):"",onPick:()=>ce(ae),style:{minHeight:44,padding:"9px 13px",borderRadius:9,border:`1.4px solid ${Ce}`,background:Be,fontFamily:ne?"var(--font-display)":"var(--font-ui)",fontStyle:ne?"italic":"normal",fontSize:"var(--type-ui-15)",lineHeight:1.4,overflowWrap:"anywhere"}},ae)})}),me&&qe&&e.jsx("div",{className:"mt-3",style:{borderTop:"1px solid var(--line)",paddingTop:10},children:E?e.jsx(W,{style:{color:"var(--faint)"},children:a("quiz.leech.aside.label")}):e.jsxs("div",{className:"flex flex-wrap items-center gap-2",children:[e.jsx(W,{style:{color:"var(--faint)"},children:a("quiz.leech.count.label",{n:(y==null?void 0:y.lapse_count)??M.lapse_count,count:(y==null?void 0:y.lapse_count)??M.lapse_count})}),e.jsx("button",{type:"button",className:"tp-link",style:{marginLeft:"auto"},onClick:se,children:a("quiz.leech.keep.label")}),e.jsx("button",{type:"button",className:"tp-btn tactile",onClick:Y,children:a("quiz.leech.aside.action.label")})]})}),me&&e.jsx(Wp,{card:M,onPatch:Ne=>G(ae=>({...ae,[m]:Ne}))}),me?e.jsxs("div",{className:"mt-3 flex items-center justify-between gap-3",children:[e.jsx(W,{style:{color:(Q?v==="got":z?he:u===M.answer)?"var(--ok)":"var(--error)"},children:a(Q?v==="got"?"quiz.verdict.recalled.label":"quiz.verdict.noted.label":(z?he:u===M.answer)?"quiz.verdict.correct.label":"quiz.verdict.wrong.label")}),e.jsxs("span",{className:"flex items-center gap-2.5",children:[q&&e.jsx(W,{style:{color:"var(--faint)"},children:a("quiz.saving.label")}),e.jsx("button",{type:"button",className:"tp-btn tp-btn-primary tactile",onClick:pe,children:a(m+1<n.length?"quiz.next.label":"quiz.finish.label")})]})]}):te&&u!=null?e.jsxs("div",{className:"mt-3 flex items-center justify-between gap-3",children:[e.jsx(W,{style:{color:"var(--faint)"},children:a("quiz.submit.hint")}),e.jsx("button",{type:"button",className:"tp-btn tp-btn-primary tactile",disabled:q,onClick:Te,children:a("quiz.submit.label")})]}):o&&!(Q&&b)?e.jsx("div",{className:"mt-3 text-right",children:e.jsx("button",{type:"button",className:"tp-link",onClick:pe,children:a("quiz.skip.label")})}):null,O&&e.jsx("div",{className:"mt-2",children:e.jsx(ke,{children:O})})]},m)}function Up(t){const n=new URLSearchParams;for(const o of Uc)t!=null&&t[o]&&n.set(o,String(t[o]));return n.toString()}const Uc=["book","movie","tag","color","person","anthology"];function Gp({theme:t,onClose:n}){const[o,s]=c.useState(null),[r,i]=c.useState({got:0,forgot:0}),[l,h]=c.useState(!1),[d,m]=c.useState(0);c.useEffect(()=>{let u=!0;s(null),h(!1),i({got:0,forgot:0});const f=Up(t);return Z("GET",`/review/practice${f?`?${f}`:""}`).then(b=>{u&&s(b.ok?b.data.items||[]:[])}),()=>{u=!1}},[d,...Uc.map(u=>t==null?void 0:t[u])]);const p=o!=null&&o.length===0;return e.jsx(Ke,{open:!0,onClose:n,title:(t==null?void 0:t.label)||a("quiz.practice.label"),maxWidth:560,children:e.jsxs("div",{className:"review-card-body",children:[o==null&&e.jsx(W,{style:{color:"var(--faint)"},children:a("common.action.load.busy")}),p&&e.jsxs("div",{className:"py-2 text-center",children:[e.jsx("p",{className:"tp-empty",children:a("quiz.practice.empty")}),e.jsx("button",{type:"button",className:"tp-btn tactile mt-3",onClick:n,children:a("common.action.close.label")})]}),o!=null&&o.length>0&&!l&&e.jsxs(e.Fragment,{children:[e.jsx(Nr,{mode:"practice",cards:o,allowSkip:!0,submitStep:Op(),onAnswered:u=>i(f=>({got:f.got+(u==="got"?1:0),forgot:f.forgot+(u==="forgot"?1:0)})),onDone:()=>h(!0)},d),e.jsx("div",{className:"mt-2 text-right",children:e.jsx("button",{type:"button",className:"tp-link",onClick:n,children:a("quiz.practice.end.label")})})]}),l&&e.jsxs("div",{className:"py-2 text-center",children:[e.jsx("p",{"aria-hidden":"true",style:{fontFamily:"var(--font-hand)",fontWeight:"var(--font-hand-weight)",fontStyle:"var(--font-hand-style)",fontVariantCaps:"var(--font-hand-caps)",textTransform:"var(--font-hand-case)",fontVariantNumeric:"var(--font-hand-figures)",fontSize:"var(--type-hand-26)",color:"var(--accent-ui)",transform:"rotate(-1.2deg)"},children:a("quiz.round.score.label",{done:r.got,total:r.got+r.forgot})}),e.jsx("p",{className:"mono-label mt-1 mb-3",style:{letterSpacing:".06em"},children:a("quiz.round.summary.label",{got:r.got,missed:r.forgot})}),e.jsxs("div",{className:"flex items-center justify-center gap-2",children:[e.jsx("button",{type:"button",className:"tp-btn tactile",onClick:n,children:a("common.action.done.label")}),e.jsx("button",{type:"button",className:"tp-btn tp-btn-primary tactile",onClick:()=>m(u=>u+1),children:a("quiz.round.again.label")})]})]})]})})}function Ia(){const[t,n]=c.useState(null);return{practise:o=>n(o),practiceDialog:t?e.jsx(Gp,{theme:t,onClose:()=>n(null)}):null}}const Tr="tp-btn tp-btn-primary",Ko=[["imdb","vocab.source.imdb.label",/(^|\.)imdb\.com$/i],["tmdb","vocab.source.tmdb.label",/(^|\.)themoviedb\.org$/i],["tvdb","vocab.source.tvdb.label",/(^|\.)thetvdb\.com$/i],["wikipedia","vocab.source.wikipedia.label",/(^|\.)wikipedia\.org$/i],["openlibrary","vocab.source.openlibrary.label",/(^|\.)openlibrary\.org$/i]];function Yo(t){const n={},o=[];for(const s of String(t||"").split(/[\s\n]+/).filter(Boolean)){let r="";try{r=new URL(s).hostname}catch{o.push(s);continue}const i=Ko.find(([,,l])=>l.test(r));i&&!n[i[0]]?n[i[0]]=s:o.push(s)}return{known:n,extra:o}}function Vp(t,n){const{known:o,extra:s}=Yo(t),r={...o};for(const[i,l]of Object.entries(n||{}))l&&!r[i]&&(r[i]=l);return[...Ko.map(([i])=>r[i]).filter(Boolean),...s].join(`
`)}function Tv({links:t}){const{known:n}=Yo(t),o=Ko.filter(([s])=>n[s]);return o.length===0?e.jsx("span",{className:"microcopy",children:"—"}):e.jsx("span",{className:"flex flex-wrap items-center gap-1.5",children:o.map(([s,r])=>e.jsx("a",{className:"tp-chip tp-chip-btn",href:n[s],target:"_blank",rel:"noopener noreferrer",children:a(r)},s))})}function Cr({kind:t,name:n,onOpen:o,className:s="tp-link",style:r,children:i}){return n?e.jsx("button",{type:"button",className:s,style:r,onClick:l=>{l.stopPropagation(),o({kind:t,name:n})},title:`${n} — details`,children:i||n}):null}function Pa({names:t,map:n={},size:o=24,ring:s="var(--bg)",className:r=""}){const l=(Array.isArray(t)?t:t?[t]:[]).map(h=>n==null?void 0:n[h]).filter(h=>h==null?void 0:h.image_path);return e.jsx(Vc,{paths:l.map(h=>h.image_path),size:o,ring:s,className:r})}function Gc({images:t=[],size:n=24,ring:o="var(--bg)",className:s=""}){return e.jsx(Vc,{paths:(t||[]).map(r=>r==null?void 0:r.path).filter(Boolean),size:n,ring:o,className:s})}function Vc({paths:t=[],size:n=24,ring:o="var(--bg)",className:s=""}){if(t.length===0)return null;const r=Math.round(n*.34);return e.jsx("span",{className:("inline-flex items-center "+s).trim(),style:{flex:"none"},children:t.map((i,l)=>e.jsx("span",{style:{position:"relative",marginLeft:l===0?0:-r,zIndex:t.length-l,borderRadius:"50%",boxShadow:`0 0 0 2px ${o}`,lineHeight:0},children:e.jsx(_a,{person:{image_path:i},size:n})},i+l))})}function Qo({kind:t,name:n,person:o,size:s=28,onOpen:r,nameClassName:i,nameStyle:l,className:h=""}){return n?e.jsxs("span",{className:("inline-flex items-center gap-1.5 "+h).trim(),style:{verticalAlign:"middle"},children:[e.jsx(_a,{person:o,size:s}),e.jsx(Cr,{kind:t,name:n,onOpen:r,className:i,style:l})]}):null}function _i(t){const n=r=>(r||"").trim().slice(0,4),o=n(t==null?void 0:t.born),s=n(t==null?void 0:t.died);return o&&s?a("people.lifespan.range",{born:o,died:s}):o||(s?a("people.lifespan.died",{died:s}):"")}function Kp({person:t,name:n,onEdit:o,onDelete:s,onPractise:r}){const[i,l]=c.useState(!1),h=t.image_path?e.jsx(ye,{label:a("people.photo.zoom.tip"),side:"bottom",className:"person-photo-btn float-left mt-[2px] mr-[14px] mb-[8px]",children:e.jsx("button",{type:"button",onClick:()=>l(!0),"aria-label":a("people.photo.zoom.aria",{name:n}),style:{width:104,padding:0,background:"none",border:"none",cursor:"zoom-in"},children:e.jsx("img",{src:Go(t.image_path),alt:n,style:{display:"block",width:"100%",aspectRatio:"7 / 9",objectFit:"cover",borderRadius:8,border:"1px solid var(--ink-border)"}})})}):e.jsx("div",{style:{float:"left",width:104,margin:"2px 14px 8px 0"},children:e.jsx(Bt,{kind:"",style:{width:"100%",aspectRatio:"7 / 9"}})});return e.jsxs("div",{className:"space-y-3",children:[e.jsxs("div",{style:{overflow:"hidden"},children:[" ",h,e.jsxs("div",{className:"min-w-0 space-y-1.5",children:[_i(t)&&e.jsx(W,{className:"block",children:_i(t)}),t.bio&&e.jsx(js,{text:t.bio,lines:5}),t.links&&e.jsxs("div",{className:"space-y-1",children:[e.jsx(W,{className:"block",style:{color:"var(--faint)"},children:a("people.links.heading")}),e.jsx(Yp,{links:t.links})]}),t.source&&t.source!=="manual"&&e.jsx(W,{className:"block",style:{color:"var(--faint)"},children:a("people.source.via",{source:t.source})})]})]}),i&&e.jsx(ir,{path:t.image_path,title:n,onClose:()=>l(!1)}),e.jsxs("div",{className:"flex flex-wrap items-center justify-end gap-2",style:{borderTop:"1px solid var(--line)",paddingTop:12},children:[e.jsxs(ge,{onClick:r,className:"mr-auto inline-flex items-center gap-1.5",children:[e.jsx(Ht,{})," ",a("common.action.practise.label")]}),e.jsxs(ge,{onClick:s,className:"inline-flex items-center gap-1.5",style:{color:"var(--error)",borderColor:"color-mix(in srgb, var(--error) 55%, transparent)"},children:[e.jsx(ze,{})," ",a("common.action.delete.label")]}),e.jsxs("button",{className:Tr+" inline-flex items-center gap-1.5",onClick:o,children:[e.jsx(et,{})," ",a("common.action.edit.label")]})]})]})}function Yp({links:t}){const{known:n,extra:o}=Yo(t),s=Ko.filter(([r])=>n[r]);return s.length===0&&o.length===0?e.jsx("span",{className:"microcopy",children:"—"}):e.jsxs("span",{className:"flex flex-wrap items-center gap-1.5",children:[s.map(([r,i])=>e.jsx("a",{className:"tp-chip tp-chip-btn",href:n[r],target:"_blank",rel:"noopener noreferrer",children:a(i)},r)),o.map(r=>/^https?:\/\//i.test(r)?e.jsx("a",{className:"tp-chip tp-chip-btn",href:r,target:"_blank",rel:"noopener noreferrer",children:r.replace(/^https?:\/\/(www\.)?/,"").replace(/\/$/,"")},r):e.jsx("span",{className:"tp-chip",children:r},r))]})}function Qp({kind:t,name:n,initial:o,onCancel:s,onSaved:r,onRenamed:i}){const[l,h]=c.useState((o==null?void 0:o.bio)||""),[d,m]=c.useState((o==null?void 0:o.born)||""),[p,u]=c.useState((o==null?void 0:o.died)||""),[f,b]=c.useState((o==null?void 0:o.links)||""),[w,v]=c.useState(""),[g,y]=c.useState(!1),[k,j]=c.useState(!1),[N,S]=c.useState(""),[x,L]=c.useState(n),[A,E]=c.useState(!1),[D,q]=c.useState(null),[C,I]=c.useState(!1),O=t==="author"||t==="translator"||t==="editor",P=a(O?"unit.book":t==="speaker"?"unit.quote":t==="studio"?"unit.game":"unit.film",{count:2}),B=a(O?"unit.book":t==="actor"?"unit.dialogue":t==="speaker"?"unit.quote":t==="studio"?"unit.game":"unit.film",{count:1}),_=t==="studio";async function U(){const R=x.trim();if(!R||R===n||!confirm(a("people.rename.confirm",{from:n,to:R,noun:P,entity:B})))return;E(!0),S("");const G=await Z("POST","/people/rename",{kind:t,from:n,to:R});E(!1),G.ok?i&&i(R):S(le(G,a("error.rename.generic")))}async function F(){var M,Q;I(!0),S("");const R=await Z("POST","/images/search",{kind:"portrait",name:n,person_id:(o==null?void 0:o.id)||0}).catch(()=>({ok:!1}));I(!1);const G=R.ok?((M=R.data)==null?void 0:M.images)||[]:[];if(!(R.ok&&Object.values(((Q=R.data)==null?void 0:Q.sources)||{}).some(Boolean))){window.open(`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(n+" "+t)}`,"_blank","noopener");return}q(G)}async function X(R){if(R.preventDefault(),R.stopPropagation(),d.trim()&&!ba(d.trim()))return S(a("error.validate.born-date"));if(p.trim()&&!ba(p.trim()))return S(a("error.validate.died-date"));j(!0),S("");const G=await Z("PUT","/people",{kind:t,name:n,bio:l.trim(),born:d.trim(),died:p.trim(),links:f.trim(),source:(o==null?void 0:o.source)||"manual",source_id:(o==null?void 0:o.source_id)||"",image_url:w.trim()||void 0,clear_image:g||void 0});j(!1),G.ok?r(G.data):S(le(G,a("error.save.generic")))}return e.jsxs("form",{onSubmit:X,className:"space-y-3",children:[(o==null?void 0:o.image_path)&&!g&&e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx("img",{src:Go(o.image_path),alt:"",className:"w-16 rounded object-cover",style:{aspectRatio:"3 / 4"}}),e.jsxs("button",{type:"button",className:"tp-link tp-link-danger tp-link-icon",onClick:()=>y(!0),children:[e.jsx(ze,{}),e.jsx("span",{children:a("people.form.photo.remove")})]})]}),e.jsxs("label",{className:"block",children:[e.jsx(W,{className:"mb-1.5 block",children:a("common.field.bio.label")}),e.jsx("textarea",{className:"tp-input",rows:"4",value:l,onChange:R=>h(R.target.value)})]}),e.jsxs("div",{className:"grid gap-3 sm:grid-cols-2",children:[e.jsx(ya,{label:a(_?"people.form.founded.label":"common.field.born.label"),value:d,onChange:m,placeholder:a("people.form.born.placeholder")}),e.jsx(ya,{label:a(_?"people.form.closed.label":"common.field.died.label"),value:p,onChange:u,placeholder:a(_?"people.form.closed.placeholder":"people.form.died.placeholder")})]}),e.jsxs("div",{children:[e.jsxs("div",{className:"mb-1.5 flex items-center justify-between gap-2",children:[e.jsx(W,{children:a(_?"people.form.logo-url.label":"people.form.photo-url.label")}),e.jsxs("button",{type:"button",className:"tp-link tp-link-icon",style:{fontSize:"var(--type-ui-11)"},disabled:C,onClick:F,children:[e.jsx(on,{}),e.jsx("span",{children:a(C?"common.state.loading":"people.form.image-search")})]})]}),D&&e.jsxs("div",{className:"mb-1.5 space-y-1.5",children:[e.jsx(W,{className:"block",children:D.length?a("people.form.image-pick.prose"):a("people.form.image-pick.none")}),e.jsx("div",{className:"flex flex-wrap gap-2",children:D.map(R=>e.jsxs("button",{type:"button",className:"cover-pick","aria-label":a("people.form.image-pick.use",{source:R.source}),onClick:()=>{v(R.url),y(!1),q(null)},children:[e.jsx("img",{src:R.thumb||R.url,alt:"",loading:"lazy"}),e.jsx("span",{className:"microcopy",children:R.source})]},R.url))})]}),e.jsx("input",{className:"tp-input",value:w,onChange:R=>{v(R.target.value),y(!1)},placeholder:a("people.form.image-url.placeholder")})]}),e.jsxs("label",{className:"block",children:[e.jsx(W,{className:"mb-1.5 block",children:a("common.field.links.label")}),e.jsx("textarea",{className:"tp-input",rows:"3",value:f,onChange:R=>b(R.target.value),placeholder:[a("people.form.links.placeholder.1"),a("people.form.links.placeholder.2")].join(`
`)}),e.jsx("p",{className:"microcopy mt-1",children:a("people.form.links.hint")})]}),e.jsxs("div",{className:"space-y-1.5",style:{borderTop:"1px solid var(--line)",paddingTop:12},children:[e.jsx(W,{children:a("people.rename.label")}),e.jsxs("div",{className:"flex flex-wrap items-center gap-2",children:[e.jsx(Et,{style:{flex:1,minWidth:160},value:x,onChange:R=>L(R.target.value),placeholder:n}),e.jsx(ge,{type:"button",icon:e.jsx(wm,{}),keepLabel:!0,disabled:A||!x.trim()||x.trim()===n,onClick:U,children:a(A?"people.rename.busy":"people.rename.action")})]}),e.jsx("p",{className:"microcopy",children:a(_?"people.rename.hint.org":"people.rename.hint.person",{entity:B})})]}),e.jsx(ke,{children:N}),e.jsxs("div",{className:"flex justify-end gap-2",children:[e.jsxs(ge,{type:"button",onClick:s,children:[e.jsx(it,{})," ",a("common.action.cancel.label")]}),e.jsxs("button",{className:Tr+" inline-flex items-center gap-1.5",disabled:k,children:[e.jsx(wt,{})," ",a("common.action.save.label")]})]})]})}function Sn({kind:t,name:n,onClose:o,onSaved:s}){Nt(!0);const[r,i]=c.useState(null),[l,h]=c.useState(!0),[d,m]=c.useState(!1),[p,u]=c.useState(!1),[f,b]=c.useState(""),[w,v]=c.useState(""),g=c.useRef(!1),{practise:y,practiceDialog:k}=Ia();c.useEffect(()=>{let x=!1;return h(!0),Z("GET",`/people?${new URLSearchParams({kind:t,name:n})}`).then(L=>{if(!x){if(h(!1),!L.ok)return v(le(L));i(L.data.exists?L.data.person:null),m(!1)}}),()=>{x=!0}},[t,n]);async function j(x,L){u(!0),b("");let A=L;if(!A){const D=await Z("POST","/people/lookup",{kind:t,name:n});if(!D.ok)return u(!1),b(le(D,a("error.lookup.failed")));A=D.data.links}const E=Vp(x==null?void 0:x.links,A);if(!E)return u(!1),b(a("error.lookup.none"));if(E!==((x==null?void 0:x.links)||"")){const D=await Z("PUT","/people",{kind:t,name:n,bio:(x==null?void 0:x.bio)||"",born:(x==null?void 0:x.born)||"",died:(x==null?void 0:x.died)||"",links:E,source:(x==null?void 0:x.source)||"lookup",source_id:(x==null?void 0:x.source_id)||""});D.ok?(i(D.data),s&&s()):b(le(D,a("error.save.links")))}u(!1)}async function N(){const x=await Z("POST","/people/portrait",{kind:t,name:n});return x.ok?(x.data.person&&x.data.person.id&&(i(x.data.person),s&&s()),{person:x.data.person,links:x.data.links}):{person:null,links:null}}c.useEffect(()=>{l||g.current||(g.current=!0,(async()=>{let x=r,L=null;if(!(x!=null&&x.image_path)||!(x!=null&&x.bio)){const A=await N();A.person&&A.person.id&&(x=A.person),A.links&&Object.keys(A.links).length>0&&(L=A.links)}Object.keys(Yo(x==null?void 0:x.links).known).length===0&&await j(x,L||void 0)})())},[l,r]),c.useEffect(()=>{const x=L=>L.key==="Escape"&&o();return document.addEventListener("keydown",x),()=>document.removeEventListener("keydown",x)},[o]);async function S(){if(!r||!confirm(a("people.delete.confirm",{kind:a(`common.field.${t}.label`),name:n})))return;const x=await Z("DELETE",`/people/${r.id}`);x.ok?(s&&s(),o()):v(le(x))}return e.jsxs("div",{className:"tp-scrim fixed inset-0 z-50 overflow-y-auto px-4 py-10",onMouseDown:x=>{x.target===x.currentTarget&&o()},children:[e.jsxs("div",{role:"dialog","aria-modal":"true","aria-label":n,className:"hand-card hc-r2 mx-auto w-full max-w-md px-6 py-6",children:[e.jsxs("div",{className:"mb-4 flex items-start justify-between gap-3",children:[e.jsxs("div",{className:"flex min-w-0 items-center gap-3",children:[e.jsx(_a,{person:r,size:40}),e.jsxs("div",{className:"min-w-0",children:[e.jsx(W,{children:a(`common.field.${t}.label`)}),e.jsx("h2",{className:"display-title truncate text-xl",children:n})]})]}),e.jsx(yr,{onClick:o})]}),e.jsx(ke,{children:w}),l?e.jsx("p",{className:"microcopy",children:a("common.state.loading")}):d?e.jsx(Qp,{kind:t,name:n,initial:r,onCancel:()=>m(!1),onSaved:x=>{i(x),m(!1),s&&s()},onRenamed:()=>{s&&s(),o()}}):e.jsxs("div",{className:"space-y-3",children:[r?e.jsx(Kp,{person:r,name:n,onEdit:()=>m(!0),onDelete:S,onPractise:()=>y({person:n,label:n})}):e.jsxs(e.Fragment,{children:[e.jsx("p",{className:"microcopy",children:a("people.state.nothing-saved")}),e.jsx("div",{className:"flex justify-end",children:e.jsxs("button",{className:Tr+" inline-flex items-center gap-1.5",onClick:()=>m(!0),children:[e.jsx(ht,{})," ",a("people.add-details")]})})]}),p&&e.jsx("p",{className:"microcopy",children:a("people.links.fetching")}),!p&&f&&e.jsx("p",{className:"microcopy",children:f}),e.jsxs("button",{className:"tp-link tp-link-icon",disabled:p,onClick:()=>j(r),children:[e.jsx(Tm,{}),e.jsx("span",{children:a("people.links.refetch")})]})]})]}),k]})}const Kc=t=>a(t==="voice"?"cast.role.voice.label":"common.field.actor.label"),Yc=20;function Zp({kind:t,item:n,onCastChanged:o}){const s=t==="book"?"books":"movies",[r,i]=c.useState(null),[l,h]=c.useState("none"),[d,m]=c.useState(""),[p,u]=c.useState(""),[f,b]=c.useState(!0),[w,v]=c.useState(!1),[g,y]=c.useState(null),{map:k,reload:j}=Xe(t==="book"?"":"actor"),N=c.useMemo(()=>[...new Set((r||[]).map(C=>(C.actor||"").trim()).filter(Boolean))],[r]);Pc(t==="book"?"":"actor",N,k,j);const S=c.useRef(!1),x=async(C=!1)=>{const I=await Z("GET",`/${s}/${n.id}/cast`);return I.ok?(m(""),h(I.data.actor_role||"none"),i(I.data.cast||[]),C&&L(I.data.cast||[]),I.data.cast||[]):m(le(I,a("error.load.cast")))};async function L(C){var O;const I=(C||[]).filter(V=>V.character_image_url&&!V.character_image_path).slice(0,Yc);for(const V of I){const P=await Z("POST",`/cast/${V.id}/image`);!P.ok||!((O=P.data)!=null&&O.character_image_path)||i(T=>(T||[]).map(B=>B.id===V.id?{...B,...P.data}:B))}}c.useEffect(()=>{if(!f)return;const C=!S.current;S.current=!0,x(C)},[f,n.id]),c.useEffect(()=>{S.current=!1},[n.id]);async function A(C,I){u("row");const O=await Z("PUT",`/cast/${C}`,I);return u(""),O.ok?(m(""),o==null||o(await x()),!0):(m(le(O,a("error.save.generic"))),!1)}async function E(C){u("add");const I=await Z("POST",`/${s}/${n.id}/cast`,C);return u(""),I.ok?(m(""),o==null||o(await x()),!0):(m(le(I,a("error.save.generic"))),!1)}async function D(C){u("row");const I=await Z("DELETE",`/cast/${C}`);if(u(""),!I.ok)return m(le(I,a("error.delete.generic")));m(""),o==null||o(await x())}async function q(C,I){u("image");const O=await Z("POST",`/cast/${C}/image`,{image_url:I});if(u(""),!O.ok)return m(le(O,a("error.load.cast-picture")));m(""),i(V=>(V||[]).map(P=>P.id===C?{...P,...O.data}:P))}return f?e.jsxs("div",{className:"space-y-2",children:[e.jsxs("div",{className:"flex flex-wrap items-center gap-2",children:[e.jsx(W,{children:a("cast.heading.label")}),e.jsx(Re,{title:a("cast.info.title"),text:a("cast.info.body")}),e.jsx("span",{className:"flex-1"}),e.jsx(Ae,{icon:e.jsx(ht,{}),ariaLabel:a("cast.add.aria"),onClick:()=>v(!0),disabled:!!p}),e.jsx(Ae,{icon:e.jsx(it,{}),ariaLabel:a("common.action.close.label"),onClick:()=>b(!1)})]}),e.jsx(ke,{children:d}),r===null?e.jsx("p",{className:"microcopy",children:a("common.state.loading")}):r.length===0?e.jsx("p",{className:"microcopy",children:a("cast.empty.prose")}):e.jsx("ul",{className:"cast-list",children:r.map(C=>e.jsx(Xp,{row:C,role:l,busy:!!p,actor:k[C.actor],workTitle:n.title,mediaType:t==="book"?"book":n.media_type||"movie",onSave:I=>A(C.id,I),onRemove:()=>D(C.id),onImage:I=>q(C.id,I),onOpenPerson:C.actor?()=>y({kind:"actor",name:C.actor}):null},C.id))}),w&&e.jsx(Jp,{role:l,busy:!!p,onCancel:()=>v(!1),onAdd:async C=>{await E(C)&&v(!1)}}),g&&e.jsx(Sn,{kind:g.kind,name:g.name,onClose:()=>y(null),onSaved:()=>j()})]}):e.jsxs("div",{className:"flex flex-wrap items-center gap-2",children:[e.jsxs(ge,{type:"button",onClick:()=>b(!0),children:[e.jsx(Es,{}),e.jsx("span",{children:a("cast.open.label")})]}),e.jsx(Re,{title:a("cast.info.title"),text:a("cast.info.body")})]})}function Xp({row:t,role:n,busy:o,actor:s,workTitle:r,mediaType:i,onSave:l,onRemove:h,onImage:d,onOpenPerson:m}){const p=c.useRef(null);Io(p,{axis:"x"});const[u,f]=c.useState(!1),[b,w]=c.useState(t.character||""),[v,g]=c.useState(t.actor||""),[y,k]=c.useState(!1),[j,N]=c.useState(""),[S,x]=c.useState(!1),[L,A]=c.useState(null),[E,D]=c.useState(!1),q=async()=>{await d(j.trim()),N(""),k(!1)};async function C(){var R,G;D(!0);const F=await Z("POST","/images/search",{kind:"character",name:t.character||"",actor:t.actor||"",title:r||"",media_type:i||"",cast_id:t.id||0}).catch(()=>({ok:!1}));if(D(!1),!(F.ok&&Object.values(((R=F.data)==null?void 0:R.sources)||{}).some(Boolean))){window.open(`https://www.google.com/search?tbm=isch&q=${encodeURIComponent([t.character,r].filter(Boolean).join(" "))}`,"_blank","noopener");return}A(((G=F.data)==null?void 0:G.images)||[])}const I=t.character_image_path?Ue(t.character_image_path):s!=null&&s.image_path?Go(s.image_path):"",O=e.jsxs("button",{type:"button",className:"cast-face-btn"+(I?"":" is-empty"),"aria-label":a("cast.picture.aria",{name:t.character||""}),"aria-expanded":y,disabled:o,onClick:()=>k(F=>!F),children:[I?e.jsx("img",{className:"cast-face",src:I,alt:""}):e.jsx("span",{className:"cast-face is-empty","aria-hidden":"true"}),e.jsx("span",{className:"cast-face-mark","aria-hidden":"true",children:e.jsx(Nm,{size:16})})]}),V=async()=>{if(!b.trim())return!1;const F={character:b.trim()};return n!=="none"&&(F.actor=v.trim()),await l(F)?(f(!1),!0):!1},P=F=>{F.key!=="Enter"||o||(F.preventDefault(),V())},T=c.useContext(ar),B=u&&(b!==(t.character||"")||v!==(t.actor||"")),_=c.useRef(V);_.current=V,c.useEffect(()=>{if(!(T!=null&&T.register)||!B)return;const F=`cast-${t.id}`;return T.register(F,{save:()=>_.current(),close:()=>f(!1)}),()=>T.register(F,null)},[T,B,t.id]);const U=y&&e.jsxs("span",{className:"cast-row-url",children:[e.jsxs("button",{type:"button",className:"tp-link tp-link-icon",style:{fontSize:"var(--type-ui-11)"},disabled:E,onClick:C,children:[e.jsx(on,{}),e.jsx("span",{children:a(E?"common.state.loading":"people.form.image-search")})]}),e.jsx("input",{className:"tp-input",placeholder:a("cast.picture.placeholder"),"aria-label":a("cast.picture.url.aria",{name:t.character||""}),value:j,onChange:F=>N(F.target.value),onKeyDown:F=>{F.key!=="Enter"||o||!j.trim()||(F.preventDefault(),q())}}),e.jsx(ge,{type:"button",disabled:o||!j.trim(),onClick:q,children:a("common.action.apply.label")}),L&&e.jsxs("span",{className:"cast-row-pics",children:[e.jsx("span",{className:"microcopy",children:L.length?a("cast.picture.pick.prose"):a("cast.picture.pick.none")}),e.jsx("span",{className:"flex flex-wrap gap-2",children:L.map(F=>e.jsxs("button",{type:"button",className:"cover-pick","aria-label":a("cast.picture.pick.use",{source:F.source}),disabled:o,onClick:async()=>{A(null),k(!1),await d(F.url)},children:[e.jsx("img",{src:F.thumb||F.url,alt:"",loading:"lazy"}),e.jsx("span",{className:"microcopy",children:F.source})]},F.url))})]})]});return u?e.jsxs("li",{className:"cast-row is-editing",children:[O,e.jsxs("div",{className:"cast-row-fields",children:[e.jsx(Se,{label:a("common.field.character.label"),nameCase:!0,value:b,autoFocus:!0,onChange:F=>w(F.target.value),onKeyDown:P}),n!=="none"&&e.jsx(Se,{label:Kc(n),nameCase:!0,value:v,onChange:F=>g(F.target.value),onKeyDown:P})]}),e.jsxs("div",{className:"cast-row-acts",children:[e.jsx(Ae,{icon:e.jsx(wt,{}),ariaLabel:a("common.action.save.field.aria",{field:t.character||""}),disabled:o||!b.trim(),ok:!0,onClick:V}),e.jsx(Ae,{icon:e.jsx(it,{}),ariaLabel:a("common.action.cancel.label"),disabled:o,onClick:()=>{w(t.character||""),g(t.actor||""),f(!1)}})]}),U]}):e.jsxs("li",{className:"cast-row",children:[O,e.jsxs("span",{className:"cast-names",children:[e.jsx("span",{className:"cast-character",ref:p,children:e.jsx("button",{type:"button",className:"tp-link","aria-expanded":y,disabled:o,onClick:()=>k(F=>!F),children:t.character||a("cast.unnamed.label")})}),t.actor&&e.jsx("span",{className:"cast-actor",children:m?e.jsx("button",{type:"button",className:"tp-link",onClick:m,children:t.actor}):t.actor})]}),e.jsxs("span",{className:"cast-row-acts",children:[e.jsx(Ae,{icon:e.jsx(et,{}),ariaLabel:a("common.action.edit.field.aria",{field:t.character||""}),disabled:o,onClick:()=>f(!0)}),e.jsx(Ae,{icon:e.jsx(ze,{}),ariaLabel:a("cast.remove.aria",{name:t.character||""}),disabled:o,danger:!0,onClick:()=>x(!0)})]}),S&&e.jsxs("span",{className:"cast-row-confirm",children:[e.jsx("span",{className:"microcopy",children:a("cast.remove.confirm.prose",{name:t.character||""})}),e.jsx(ge,{type:"button",disabled:o,onClick:h,children:a("common.action.remove.label")}),e.jsx(ge,{type:"button",onClick:()=>x(!1),children:a("common.action.cancel.label")})]}),U]})}function Jp({role:t,busy:n,onAdd:o,onCancel:s}){const[r,i]=c.useState(""),[l,h]=c.useState(""),d=()=>{if(!r.trim())return;const p={character:r.trim()};t!=="none"&&(p.actor=l.trim()),o(p)},m=p=>{p.key!=="Enter"||n||(p.preventDefault(),d())};return e.jsxs("div",{className:"cast-add",children:[e.jsxs("div",{className:"cast-row-fields",children:[e.jsx(Se,{label:a("common.field.character.label"),nameCase:!0,value:r,autoFocus:!0,onChange:p=>i(p.target.value),onKeyDown:m}),t!=="none"&&e.jsx(Se,{label:Kc(t),nameCase:!0,value:l,onChange:p=>h(p.target.value),onKeyDown:m})]}),e.jsxs("div",{className:"flex flex-wrap items-center gap-2",children:[e.jsx(ge,{type:"button",disabled:n||!r.trim(),onClick:d,children:a("common.action.add.label")}),e.jsx(ge,{type:"button",onClick:s,children:a("common.action.cancel.label")})]})]})}function ef({item:t,onFilled:n}){const[o,s]=c.useState(""),[r,i]=c.useState(""),[l,h]=c.useState(""),[d,m]=c.useState(""),[p,u]=c.useState(!1),[f,b]=c.useState(null);async function w(g){var j,N,S,x;s("tvdb"),h(""),i("");const y=await Z("POST",`/movies/${t.id}/cast/tvdb`,g?{tvdb_id:g}:void 0);if(!y.ok){if(y.status===409&&!g){const L=await Z("POST","/movies/lookup",{title:t.title||"",year:t.release_year||0,media_type:t.media_type||"movie"});if(s(""),!L.ok)return h(le(y,a("error.load.tvdb-cast")));b((((j=L.data)==null?void 0:j.candidates)||[]).filter(A=>A.source==="tvdb"));return}return s(""),h(le(y,a("error.load.tvdb-cast")))}s(""),b(null);const k=(((N=y.data)==null?void 0:N.cast)||[]).length;i(a("cast.fill.done.prose",{title:((S=y.data)==null?void 0:S.title)||"",n:k})),n==null||n(((x=y.data)==null?void 0:x.cast)||[])}async function v(){var k,j,N,S;s("imdb"),h(""),i("");const g=await Z("POST",`/movies/${t.id}/cast/imdb`,{imdb:d.trim()});if(s(""),!g.ok)return h(le(g,a("error.load.imdb-cast")));const y=(((k=g.data)==null?void 0:k.cast)||[]).length;i(a("film.imdb.done.prose",{title:((N=(j=g.data)==null?void 0:j.title)==null?void 0:N.title)||d.trim(),n:y})),m(""),u(!1),n==null||n(((S=g.data)==null?void 0:S.cast)||[])}return e.jsxs("div",{className:"space-y-2",children:[e.jsxs("div",{className:"flex flex-wrap items-center gap-2",children:[t.media_type!=="game"&&e.jsxs(ge,{type:"button",onClick:()=>w(),disabled:!!o,children:[e.jsx(Es,{}),e.jsx("span",{children:a(o==="tvdb"?"film.imdb.busy.label":"cast.fill.tvdb.label")})]}),e.jsxs(ge,{type:"button",onClick:()=>u(g=>!g),disabled:!!o,children:[e.jsx(Es,{}),e.jsx("span",{children:a("film.imdb.open.label")})]}),e.jsx(Re,{title:a("cast.fill.info.title"),text:a("cast.fill.info.body")})]}),p&&e.jsxs("div",{className:"space-y-2",children:[e.jsx(Se,{label:a("film.imdb.link.label"),placeholder:a("film.imdb.link.placeholder"),value:d,autoFocus:!0,onChange:g=>m(g.target.value),onKeyDown:g=>{g.key!=="Enter"||o||!d.trim()||(g.preventDefault(),v())}}),e.jsx(ge,{type:"button",onClick:v,disabled:!!o||!d.trim(),children:a(o==="imdb"?"film.imdb.busy.label":"film.imdb.go.label")})]}),f&&e.jsxs("div",{className:"space-y-2",children:[e.jsx("p",{className:"microcopy",children:f.length?a("cast.fill.match.prose"):a("cast.fill.match.none")}),f.map(g=>e.jsx(ge,{type:"button",disabled:!!o,onClick:()=>w(Number(g.source_id)),children:[g.title,g.release_year||""].filter(Boolean).join(" · ")},g.source_id))]}),e.jsx(ke,{children:l}),r&&e.jsx("p",{className:"microcopy",children:r})]})}function tf(t,n,o,s){const r=c.useRef("");c.useEffect(()=>{const i=`${t}:${n}`;if(!n||r.current===i||!(o||[]).some(m=>(m==null?void 0:m.character_image_url)&&!(m!=null&&m.character_image_path)))return;let h=!0;const d="movies";return(async()=>{var f,b;const m=await Z("GET",`/${d}/${n}/cast`);if(!h||!m.ok)return;const p=(((f=m.data)==null?void 0:f.cast)||[]).filter(w=>w.character_image_url&&!w.character_image_path).slice(0,Yc);let u=0;for(const w of p){if(!h)return;const v=await Z("POST",`/cast/${w.id}/image`);v.ok&&((b=v.data)!=null&&b.character_image_path)&&(u+=1)}h&&(r.current=i,u&&(s==null||s()))})(),()=>{h=!1}},[t,n,o])}const nf=[{key:"title",get label(){return a("common.field.title.label")},nameCase:!0},{key:"author",get label(){return a("common.field.author.label")},nameCase:!0,get hint(){return a("book.field.author.info")}},{key:"translator",get label(){return a("common.field.translator.label")},nameCase:!0,get hint(){return a("book.field.translator.info")}},{key:"editor",get label(){return a("common.field.editor.label")},nameCase:!0,get hint(){return a("book.field.editor.info")}},{key:"published_year",get label(){return a("common.field.year.label")},kind:"year",circaKey:"published_circa"},{key:"series",get label(){return a("common.field.series.label")},nameCase:!0,get hint(){return a("book.field.series.info")}},{key:"series_index",get label(){return a("common.field.series-no.label")},kind:"number"},{key:"isbn",get label(){return a("common.field.isbn.label")},get hint(){return a("book.field.isbn.info")}},{key:"asin",get label(){return a("common.field.asin.label")},get hint(){return a("book.field.asin.info")}},{key:"genres",get label(){return a("common.field.genres.label")},kind:"tokens"},{key:"description",get label(){return a("common.field.description.label")},kind:"long"}],af={show:{director:"common.field.creator.label"},game:{director:"common.field.studio.label",series:"common.field.series.label",series_index:"common.field.series-no.label"}};function is(t,n){const o=[t,""];return Object.defineProperty(o,1,{get:()=>a(n),enumerable:!0,configurable:!0}),o}const Oi=[is("movie","vocab.kind.movie.label"),is("show","vocab.kind.show.label"),is("game","vocab.kind.game.label")];function Qc(t,n){var s;const o=(s=af[n])==null?void 0:s[t.key];return o?a(o):t.label}function of(t,n){return t.filter(o=>!o.media||o.media.includes(n))}const sf=[{key:"title",get label(){return a("common.field.title.label")},nameCase:!0},{key:"media_type",get label(){return a("common.field.media-type.label")},kind:"mediaType",get hint(){return a("film.field.media-type.info")}},{key:"director",get label(){return a("common.field.director.label")},nameCase:!0},{key:"publisher",get label(){return a("common.field.publisher.label")},nameCase:!0,media:["game"],get hint(){return a("film.field.publisher.info")}},{key:"release_year",get label(){return a("common.field.year.label")},kind:"year",circaKey:"release_circa"},{key:"series",get label(){return a("common.field.collection.label")},nameCase:!0,get hint(){return a("film.field.series.info")}},{key:"series_index",get label(){return a("common.field.collection-no.label")},kind:"number"},{key:"tmdb_id",get label(){return a("film.field.tmdb-id.label")},sourceKey:"vocab.source.tmdb.label",kind:"id",media:["movie","show"],get hint(){return a("film.field.tmdb-id.info")},href:t=>`https://www.themoviedb.org/${(t.media_type||"movie")==="show"?"tv":"movie"}/${t.tmdb_id}`},{key:"tvdb_id",get label(){return a("film.field.tvdb-id.label")},sourceKey:"vocab.source.tvdb.label",kind:"id",media:["movie","show"],get hint(){return a("film.field.tvdb-id.info")},href:t=>`https://thetvdb.com/dereferrer/${(t.media_type||"movie")==="show"?"series":"movie"}/${t.tvdb_id}`},{key:"imdb_id",get label(){return a("film.field.imdb-id.label")},sourceKey:"vocab.source.imdb.label",media:["movie","show"],get hint(){return a("film.field.imdb-id.info")},href:t=>`https://www.imdb.com/title/${t.imdb_id}/`},{key:"igdb_id",get label(){return a("film.field.igdb-id.label")},sourceKey:"vocab.source.igdb.label",kind:"id",media:["game"],get hint(){return a("film.field.igdb-id.info")}},{key:"genres",get label(){return a("common.field.genres.label")},kind:"tokens"},{key:"description",get label(){return a("common.field.description.label")},kind:"long"}];function rf(t,n){return t==="book"?{title:n.title,author:n.author||"",translator:n.translator||"",editor:n.editor||"",isbn:n.isbn||"",asin:n.asin||"",description:n.description||"",published_year:n.published_year||0,published_circa:!!n.published_circa,genres:n.genres||[],series:n.series||"",series_index:n.series_index||0,favorite:!!n.favorite}:{title:n.title,director:n.director||"",publisher:n.publisher||"",release_year:n.release_year||0,release_circa:!!n.release_circa,description:n.description||"",genres:n.genres||[],media_type:n.media_type||"movie",series:n.series||"",series_index:n.series_index||0,favorite:!!n.favorite,tmdb_id:n.tmdb_id||0,tvdb_id:n.tvdb_id||0,igdb_id:n.igdb_id||0,imdb_id:n.imdb_id||""}}function Ri(t,n){if(t.kind==="tokens")return Array.isArray(n)?n:[];if(t.kind==="year"){const{year:o,circa:s}=bn(n);return t.circaKey?{[t.key]:o,[t.circaKey]:s}:o}return t.kind==="number"?Number(String(n).trim())||0:t.kind==="id"?lt(n):String(n??"").trim()}function lf(t,n){const o=n==null?void 0:n[t.key];return t.kind==="tokens"?o||[]:t.kind==="year"?Pt(o,t.circaKey?n==null?void 0:n[t.circaKey]:!1):t.kind==="number"||t.kind==="id"?o?String(o):"":o==null?"":String(o)}function Ls(t,n){return Array.isArray(t)?t.length===0:n==="year"||n==="number"||n==="id"?!Number(t):String(t??"").trim()===""}function Zc({open:t,onClose:n,kind:o,item:s,onChanged:r,onDelete:i}){const l=o==="book"?"books":"movies",h=o==="book"?"book":(s==null?void 0:s.media_type)||"movie",d=of(o==="book"?nf:sf,h),[m,p]=c.useState("fields"),[u,f]=c.useState(null),[b,w]=c.useState(""),[v,g]=c.useState(""),[y,k]=c.useState([]);if(c.useEffect(()=>{t&&Z("GET","/genres").then(C=>{C.ok&&k(C.data.genres||[])})},[t]),c.useEffect(()=>{t&&(p("fields"),f(null),g(""))},[t]),!s)return null;async function j(C,I){w(I||"save"),g("");const O=await Z("PUT",`/${l}/${s.id}`,{...rf(o,s),...C});return w(""),O.ok?(r==null||r(O.data),!0):(g(le(O,a("error.save.generic"))),!1)}async function N(C,I){const O={};for(const V of C){const P=d.find(B=>B.key===V.key);if(!P)continue;const T=Ri(P,V.get());Object.assign(O,T&&typeof T=="object"&&!Array.isArray(T)?T:{[P.key]:T})}if("title"in O&&!String(O.title).trim()){g(a("error.validate.title-required"));return}if(!Object.keys(O).length)return!0;if(await j(O)){I();const V=C.length;return Ee(a("common.work.fields-saved.toast",{count:V,n:V})),!0}return!1}async function S(C,I){const O=Ri(C,I);if(C.key==="title"&&!String(O).trim())return g(a("error.validate.title-required")),!1;const V=O&&typeof O=="object"&&!Array.isArray(O)?O:{[C.key]:O},P=await j(V);return P&&Ee(a("common.work.field-saved.toast",{field:C.label.toLowerCase()})),P}function x(C){const I={title:C.title||"",author:C.author||"",isbn:C.isbn13||"",published_year:C.published_year||0,series:C.series||"",series_index:C.series_index||0,genres:C.genres||[],description:C.description||""};return A(I,C.cover_url||"")}function L(C){const I={title:C.title||"",release_year:C.release_year||0,description:C.overview||"",media_type:C.media_type||s.media_type||"movie"},O={tvdb:"tvdb_id",tmdb:"tmdb_id",igdb:"igdb_id"}[C.source||"tmdb"],V=Number(C.source==="tmdb"&&C.tmdb_id||C.source_id);return O&&Number.isInteger(V)&&V>0&&(I[O]=V),A(I,C.poster_url||"")}function A(C,I){const O=[];for(const P of d){if(!(P.key in C))continue;const T=C[P.key];if(Ls(T,P.kind))continue;const B=s[P.key];(Array.isArray(T)?JSON.stringify([...T].sort())===JSON.stringify([...B||[]].sort()):String(T??"")===String(B??""))||O.push({key:P.key,label:Qc(P,h),spec:P,current:B,next:T,take:Ls(B,P.kind)})}const V=s.cover_path||s.poster_path;return I&&O.push({key:"__cover",label:a(o==="book"?"common.field.cover.label":"common.field.poster.label"),art:!0,current:V?Ue(V):"",next:I,take:!V}),O}async function E(C){const I=C.filter(V=>V.take);if(!I.length){p("fields");return}const O={};for(const V of I)V.key==="__cover"?O[o==="book"?"cover_url":"poster_url"]=o==="book"?V.next:Dc(V.next):O[V.key]=V.next;await j(O,"merge")&&(Ee(a("common.work.merge.toast",{count:I.length,n:I.length})),f(null),p("fields"))}async function D(C){w("resync"),g("");const I=await Z("PUT",`/movies/${s.id}`,{source:C.source||"tmdb",source_id:C.source==="tvdb"?C.source_id:String(C.tmdb_id||C.source_id),media_type:C.media_type||s.media_type||"movie"});if(w(""),!I.ok)return g(le(I,a("error.sync.source")));r==null||r(I.data),Ee(a("common.work.resync.toast")),f(null),p("fields")}const q=a(m==="merge"?"common.work.merge.title":m==="lookup"?"common.work.lookup.title":"common.work.details.title");return e.jsxs(Ke,{open:t,onClose:n,title:q,maxWidth:620,saveTip:a("common.work.details.done.tip"),children:[e.jsx(ke,{children:v}),m==="fields"&&e.jsx(cf,{kind:o,item:s,specs:d,mediaType:h,busy:b,genreSuggestions:y,onSaveField:S,onSaveAll:N,onClose:n,onCover:C=>j(C,"cover"),onChanged:r,onFetch:()=>p("lookup"),onDelete:i}),m==="lookup"&&e.jsxs("div",{className:"space-y-3",children:[e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx(Ae,{icon:e.jsx($t,{}),ariaLabel:a("common.work.lookup.back.aria"),onClick:()=>p("fields")}),e.jsx(W,{children:a("common.work.lookup.pick.label")}),e.jsx(Re,{title:a("common.work.lookup.info.title"),text:a("common.work.lookup.info.body")})]}),o==="book"?e.jsx(Oc,{auto:!0,isbn:s.isbn,title:s.title,author:s.author,asin:s.asin,onPick:C=>{f({rows:x(C),candidate:C}),p("merge")}}):e.jsx(Rc,{auto:!0,title:s.title,year:s.release_year,mediaType:s.media_type||"movie",tmdbId:s.tmdb_id,tvdbId:s.tvdb_id,onPick:C=>{f({rows:L(C),candidate:C}),p("merge")}}),o!=="book"&&e.jsxs("div",{className:"space-y-2 border-t pt-3",style:{borderColor:"var(--line)"},children:[e.jsx(W,{children:a("cast.fill.heading.label")}),e.jsx(ef,{item:s,onFilled:C=>r==null?void 0:r({...s,cast:C||[]})})]})]}),m==="merge"&&u&&e.jsx(df,{kind:o,rows:u.rows,candidate:u.candidate,busy:b,onBack:()=>p("lookup"),onApply:E,onResync:o==="movie"?()=>D(u.candidate):null})]})}function cf({kind:t,item:n,specs:o,mediaType:s,busy:r,genreSuggestions:i,onSaveField:l,onSaveAll:h,onCover:d,onChanged:m,onFetch:p,onDelete:u,onClose:f}){const b=t==="book"?n.cover_path:n.poster_path,w=c.useMemo(()=>{const j={};for(const N of(n==null?void 0:n.field_sources)||[])N!=null&&N.field&&(j[N.field]=N);return j},[n]),v=Ku(),g=$o("");async function y(j){if(j.target!==j.currentTarget)return;j.preventDefault();const N=v.collect();for(const S of N)if(S.save&&await S.save()===!1)return;v.count&&!await h(N,v.closeAll)||f==null||f()}const k=j=>{j.key!=="Enter"||!(j.target instanceof HTMLInputElement)||j.target.form===j.currentTarget&&j.preventDefault()};return e.jsx("form",{id:g==null?void 0:g.formId,onSubmit:y,onKeyDown:k,className:"space-y-3",children:e.jsxs(ar.Provider,{value:v.host,children:[e.jsx(vr,{kind:t==="book"?"books":"movies",id:n.id,currentPath:b||"",asin:n.asin,coverUrl:"",clearCover:!1,onSetUrl:j=>d(t==="book"?{cover_url:j}:{poster_url:j}),onClear:j=>{j!==!0&&d({clear_cover:!0})},onUploaded:j=>m==null?void 0:m(j),search:t==="book"?{isbn:n.isbn,title:n.title,author:n.author,asin:n.asin}:{title:n.title,year:n.release_year,mediaType:n.media_type||"movie",tmdbId:n.tmdb_id,tvdbId:n.tvdb_id,igdbId:n.igdb_id}}),e.jsx(Zp,{kind:t,item:n,onCastChanged:j=>m==null?void 0:m({...n,cast:j||[]})}),e.jsxs("div",{className:"flex flex-wrap items-center gap-2",children:[e.jsxs(ge,{type:"button",onClick:p,disabled:!!r,children:[e.jsx(Kn,{}),e.jsx("span",{children:a("common.work.fetch.label")})]}),e.jsx(Re,{title:a("common.work.lookup.info.title"),text:a(t==="book"?"book.fetch.info.body":"film.fetch.info.body")}),e.jsx("span",{className:"flex-1"}),u&&e.jsx(Ae,{icon:e.jsx(ze,{}),ariaLabel:a("common.work.delete.aria",{noun:a(t==="book"?"unit.book.one":"unit.title.one")}),onClick:u,danger:!0})]}),e.jsx("div",{children:o.map(j=>{var L;const N=Qc(j,s),S=lf(j,n),x=w[j.key];return j.kind==="id"?e.jsx(Ka,{fieldKey:j.key,source:x==null?void 0:x.source,sourceAt:x==null?void 0:x.at,label:N,value:S,hint:j.hint,busy:!!r,inputMode:"numeric",maxLength:12,placeholder:a("common.work.id.placeholder"),onSave:A=>l(j,A),display:j.href&&S?e.jsx(ye,{label:a("common.work.id.open.tip",{source:a(j.sourceKey)}),children:e.jsx("a",{href:j.href(n),target:"_blank",rel:"noopener noreferrer",className:"tp-link",children:a("common.work.id.display.label",{n:S})})}):void 0},j.key):j.kind==="tokens"?e.jsx(Ka,{fieldKey:j.key,source:x==null?void 0:x.source,sourceAt:x==null?void 0:x.at,label:N,value:S,display:S.join(" · "),hint:j.hint,busy:!!r,onSave:A=>l(j,A),input:({value:A,onChange:E})=>e.jsx(yt,{value:A,onChange:E,suggestions:i,placeholder:a("common.field.genres.placeholder"),ariaLabel:N,transform:Wo})},j.key):j.kind==="mediaType"?e.jsx(Ka,{fieldKey:j.key,source:x==null?void 0:x.source,sourceAt:x==null?void 0:x.at,label:N,value:S,display:((L=Oi.find(([A])=>A===S))==null?void 0:L[1])||a("vocab.kind.movie.label"),hint:j.hint,busy:!!r,onSave:A=>l(j,A),input:({value:A,onChange:E})=>e.jsx("div",{className:"flex gap-2",children:Oi.map(([D,q])=>e.jsx("button",{type:"button",className:"tp-filter-chip"+(A===D?" active":""),"aria-pressed":A===D,onClick:()=>E(D),children:q},D))})},j.key):e.jsx(Ka,{fieldKey:j.key,source:x==null?void 0:x.source,sourceAt:x==null?void 0:x.at,label:N,value:S,hint:j.hint,busy:!!r,nameCase:!!j.nameCase,multiline:j.kind==="long",inputMode:j.kind==="number"?"decimal":void 0,maxLength:j.kind==="year"?12:void 0,onSave:A=>l(j,A),display:j.href&&S?e.jsx(ye,{label:`Open on ${N.replace(/ id$/,"")}`,children:e.jsxs("a",{href:j.href(n),target:"_blank",rel:"noopener noreferrer",className:"tp-link",children:[String(S)," ↗"]})}):void 0},j.key)})})]})})}function df({kind:t,rows:n,candidate:o,busy:s,onBack:r,onApply:i,onResync:l}){const[h,d]=c.useState(n);c.useEffect(()=>d(n),[n]);const m=c.useMemo(()=>h.filter(b=>b.take).length,[h]),p=b=>d(w=>w.map(v=>({...v,take:b}))),u=b=>d(w=>w.map(v=>v.key===b?{...v,take:!v.take}:v)),f=t==="book"?((o==null?void 0:o.source)||"").toUpperCase():`${((o==null?void 0:o.source)||"tmdb").toUpperCase()} #${(o==null?void 0:o.source)==="tvdb"?o==null?void 0:o.source_id:(o==null?void 0:o.tmdb_id)||(o==null?void 0:o.source_id)}`;return e.jsxs("div",{className:"space-y-3",children:[e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx(Ae,{icon:e.jsx($t,{}),ariaLabel:a("common.work.merge.back.aria"),onClick:r}),e.jsx(W,{children:f}),e.jsx(Re,{title:a("common.work.merge.info.title"),text:a("common.work.merge.info.body")}),e.jsx("span",{className:"flex-1"}),e.jsx(Ae,{icon:e.jsx(wt,{}),ariaLabel:a("common.work.merge.all.aria"),onClick:()=>p(!0),tooltip:a("common.work.merge.all.tip")}),e.jsx(Ae,{icon:e.jsx(it,{}),ariaLabel:a("common.work.merge.none.aria"),onClick:()=>p(!1),tooltip:a("common.work.merge.none.tip")})]}),h.length===0&&e.jsx("p",{className:"microcopy",children:a("common.work.merge.empty")}),e.jsx("div",{className:"merge-list",children:h.map(b=>{var w;return e.jsx(ye,{label:a("common.work.merge.row.tip"),children:e.jsxs("button",{type:"button",className:"merge-row"+(b.take?" is-taken":""),"aria-pressed":b.take,onClick:()=>u(b.key),children:[e.jsx("span",{className:"merge-check","aria-hidden":"true",children:b.take?e.jsx(wt,{}):null}),e.jsxs("span",{className:"min-w-0 flex-1",children:[e.jsx("span",{className:"merge-label",children:b.label}),b.art?e.jsxs("span",{className:"merge-art",children:[e.jsxs("span",{className:"merge-art-side",children:[e.jsx(W,{children:a("common.work.merge.yours.label")}),b.current?e.jsx(Bn,{url:b.current,label:"",className:"w-16"}):e.jsx(Bt,{kind:a("common.badge.none"),className:"w-16"})]}),e.jsxs("span",{className:"merge-art-side",children:[e.jsx(W,{style:{color:"var(--accent-ui)"},children:a("common.work.merge.theirs.label")}),e.jsx(Bn,{url:b.next,label:"",className:"w-16"})]})]}):e.jsxs(e.Fragment,{children:[e.jsx("span",{className:"merge-old",children:Ls(b.current,(w=b.spec)==null?void 0:w.kind)?a("common.work.merge.blank.label"):Ii(b.current)}),e.jsx("span",{className:"merge-new",children:Ii(b.next)})]})]})]})},b.key)})}),e.jsxs("div",{className:"flex flex-wrap items-center gap-2 pt-1",children:[e.jsx(an,{type:"button",disabled:!!s||m===0,onClick:()=>i(h),children:s==="merge"?a("common.action.apply.busy"):a("common.work.merge.take",{count:m,n:m})}),l&&e.jsxs(e.Fragment,{children:[e.jsx(ge,{type:"button",disabled:!!s,onClick:l,children:a(s==="resync"?"common.work.resync.busy":"common.work.resync.label")}),e.jsx(Re,{title:a("common.work.resync.info.title"),text:a("common.work.resync.info.body")})]})]})]})}function Ii(t){return Array.isArray(t)?t.join(" · "):t==null?"":String(t)}const Zo=t=>Ue(t),Xc="image/png,image/svg+xml,image/webp,image/gif,image/jpeg";function Fa(){const[t,n]=c.useState([]),o=c.useCallback(async()=>{const s=await Z("GET","/stickers");s.ok&&n(s.data.stickers)},[]);return c.useEffect(()=>{o()},[o]),{stickers:t,reload:o}}function Jc({sticker:t}){return t?e.jsx("img",{className:"sticker-img",src:Zo(t.path),alt:t.name||a("common.sticker.image.alt"),draggable:"false","aria-hidden":"true"}):null}function Xo({value:t,onChange:n,stickers:o,reload:s}){const[r,i]=c.useState(!1),[l,h]=c.useState(""),d=c.useRef(null);async function m(p){const u=p.target.files&&p.target.files[0];if(p.target.value="",!u)return;i(!0),h("");const f=await Ea("/stickers",u);if(i(!1),!f.ok)return h(le(f,a("error.upload.sticker")));await s(),n(f.data.id)}return e.jsxs("div",{className:"space-y-2",children:[e.jsxs("div",{className:"sticker-strip",children:[e.jsx("button",{type:"button",className:`sticker-opt sticker-none${t==null?" is-sel":""}`,onClick:()=>n(null),title:a("common.sticker.none.tip"),"aria-pressed":t==null,children:a("common.sticker.none.label")}),o.map(p=>e.jsx(ye,{label:p.name?a("common.sticker.use.tip",{name:p.name}):a("common.sticker.use-any.tip"),side:"top",className:"shrink-0",children:e.jsx("button",{type:"button",className:`sticker-opt${t===p.id?" is-sel":""}`,onClick:()=>n(p.id),"aria-pressed":t===p.id,children:e.jsx("img",{src:Zo(p.path),alt:p.name||a("common.sticker.image.alt")})})},p.id)),e.jsx(ye,{label:a(r?"common.action.upload.busy":"common.sticker.upload.tip"),side:"top",className:"shrink-0",children:e.jsx("button",{type:"button",className:"sticker-opt sticker-add",onClick:()=>d.current&&d.current.click(),disabled:r,children:r?"…":"＋"})}),e.jsx("input",{ref:d,type:"file",accept:Xc,hidden:!0,onChange:m})]}),e.jsx(ke,{children:l})]})}function Cv({onUploaded:t}){const[n,o]=c.useState(""),[s,r]=c.useState(!1),i=c.useRef(null);async function l(h){const d=h.target.files&&h.target.files[0];if(h.target.value="",!d)return;r(!0),o("");const m=await Ea("/stickers",d);if(r(!1),!m.ok)return o(le(m,a("error.upload.sticker")));t()}return e.jsxs("section",{className:"p-5",style:{border:"1.6px dashed var(--ink-border)",borderRadius:14},children:[e.jsx("p",{className:"mb-1 font-semibold",style:{color:"var(--accent-ui)"},children:a("tags.sticker.new.title")}),e.jsx("p",{className:"mb-3 text-xs",style:{color:"var(--soft)"},children:a("tags.sticker.new.body")}),e.jsx(ge,{type:"button",onClick:()=>i.current&&i.current.click(),disabled:s,children:a(s?"tags.sticker.new.upload.busy":"tags.sticker.new.upload.label")}),e.jsx("input",{ref:i,type:"file",accept:Xc,hidden:!0,onChange:l}),e.jsx(ke,{children:n})]})}function Ev({stickers:t,onChanged:n}){const[o,s]=c.useState(!1),r=t.slice(0,5);return e.jsxs("section",{className:"space-y-4",children:[e.jsx("h2",{className:"text-lg font-semibold",style:{color:"var(--ink)"},children:a("tags.sticker.section.title")}),t.length===0?e.jsx(Jt,{children:a("tags.sticker.board.empty")}):e.jsxs(e.Fragment,{children:[e.jsx("div",{className:"grid gap-3 sm:grid-cols-3 lg:grid-cols-5",children:r.map((i,l)=>e.jsx(hf,{sticker:i,index:l,onChanged:n},i.id))}),t.length>5&&e.jsx(ge,{type:"button",onClick:()=>s(i=>!i),children:o?a("tags.table.hide.label"):a("tags.sticker.table.more.label",{n:t.length-5,count:t.length-5})}),o&&e.jsx(uf,{stickers:t,onChanged:n})]})]})}async function ed(t,n,o,s){const r=n.trim();if(r===(t.name||""))return;const i=await Z("PUT",`/stickers/${t.id}`,{name:r});i.ok?o():s(le(i,a("error.rename.generic")))}async function td(t,n,o){const s=t.annotations+t.dialogues,r=s>0?a("tags.sticker.delete.confirm.body-used",{count:s,n:s,noun:a("unit.quote",{count:s})}):a("tags.sticker.delete.confirm.body");if(!confirm(r))return;const i=await Z("DELETE",`/stickers/${t.id}`);i.ok?n():o(le(i,a("error.delete.sticker")))}function hf({sticker:t,index:n,onChanged:o}){const[s,r]=c.useState(t.name||""),[i,l]=c.useState("");return e.jsxs(Je,{variant:n%4,className:"flex flex-col gap-2 p-3",children:[e.jsx("div",{className:"sticker-swatch",style:{height:72},children:e.jsx("img",{src:Zo(t.path),alt:t.name||a("common.sticker.image.alt")})}),e.jsx("input",{className:"tp-input",placeholder:a("common.field.name.placeholder"),maxLength:64,value:s,onChange:h=>r(h.target.value),onBlur:()=>ed(t,s,o,l),onKeyDown:h=>{h.key==="Enter"&&(h.preventDefault(),h.currentTarget.blur())}}),e.jsx(ke,{children:i}),e.jsx("button",{className:"tp-link tp-link-danger mt-auto self-start",onClick:()=>td(t,o,l),children:a("common.link.delete.label")})]})}function uf({stickers:t,onChanged:n}){const{sort:o,toggle:s,apply:r}=hm("name","asc"),[i,l]=c.useState(""),h=r(t,{name:d=>(d.name||"").toLowerCase(),uses:d=>d.annotations+d.dialogues});return e.jsxs(e.Fragment,{children:[e.jsx(ke,{children:i}),e.jsx(Po,{className:"ann-table-wrap",axis:"both",style:{maxHeight:"min(28em, 60vh)",overflowY:"auto"},children:e.jsxs("table",{className:"ann-table",children:[e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsx("th",{style:{width:52}}),e.jsx(Ni,{col:"name",label:a("common.field.name.label"),sort:o,onSort:s}),e.jsx(Ni,{col:"uses",label:a("tags.table.uses.label"),sort:o,onSort:s}),e.jsx("th",{})]})}),e.jsx("tbody",{children:h.map(d=>e.jsx(mf,{sticker:d,onChanged:n,setError:l},d.id))})]})})]})}function mf({sticker:t,onChanged:n,setError:o}){const[s,r]=c.useState(t.name||"");return e.jsxs("tr",{children:[e.jsx("td",{children:e.jsx("span",{className:"sticker-swatch",style:{height:34,width:34,padding:3,display:"inline-flex"},children:e.jsx("img",{src:Zo(t.path),alt:t.name||a("common.sticker.image.alt")})})}),e.jsx("td",{children:e.jsx("input",{className:"tp-input",placeholder:a("common.field.name.placeholder"),maxLength:64,value:s,onChange:i=>r(i.target.value),onBlur:()=>ed(t,s,n,o),onKeyDown:i=>{i.key==="Enter"&&(i.preventDefault(),i.currentTarget.blur())}})}),e.jsx("td",{className:"col-mono",children:t.annotations+t.dialogues}),e.jsx("td",{className:"col-actions",children:e.jsx(br,{noun:a("unit.sticker.one"),onDelete:()=>td(t,n,o)})})]})}const Ba=[{key:"display",prop:"--font-display",label:"vocab.font-role.display.label",what:"vocab.font-role.display.what",sample:"vocab.font-role.display.sample",italic:!0},{key:"ui",prop:"--font-ui",label:"vocab.font-role.ui.label",what:"vocab.font-role.ui.what",sample:"vocab.font-role.ui.sample"},{key:"mono",prop:"--font-mono",label:"vocab.font-role.mono.label",what:"vocab.font-role.mono.what",sample:"vocab.font-role.mono.sample"},{key:"hand",prop:"--font-hand",label:"vocab.font-role.hand.label",what:"vocab.font-role.hand.what",sample:"vocab.font-role.hand.sample"},{key:"bengali",prop:"--font-bengali",label:"vocab.font-role.bengali.label",what:"vocab.font-role.bengali.what",sample:"vocab.font-role.bengali.sample",script:"bengali"},{key:"devanagari",prop:"--font-devanagari",label:"vocab.font-role.devanagari.label",what:"vocab.font-role.devanagari.what",sample:"vocab.font-role.devanagari.sample",script:"devanagari"}],pf={display:[{id:"newsreader",name:"vocab.face.newsreader.name",family:"Newsreader",note:"vocab.face.newsreader.note"},{id:"source-serif-4",name:"vocab.face.source-serif-4.name",family:"Source Serif 4",note:"vocab.face.source-serif-4.note"},{id:"literata",name:"vocab.face.literata.name",family:"Literata",note:"vocab.face.literata.note"}],ui:[{id:"hanken-grotesk",name:"vocab.face.hanken-grotesk.name",family:"Hanken Grotesk",note:"vocab.face.hanken-grotesk.note"},{id:"inter",name:"vocab.face.inter.name",family:"Inter",note:"vocab.face.inter.note"},{id:"public-sans",name:"vocab.face.public-sans.name",family:"Public Sans",note:"vocab.face.public-sans.note"}],mono:[{id:"ibm-plex-mono",name:"vocab.face.ibm-plex-mono.name",family:"IBM Plex Mono",note:"vocab.face.ibm-plex-mono.note"},{id:"jetbrains-mono",name:"vocab.face.jetbrains-mono.name",family:"JetBrains Mono",note:"vocab.face.jetbrains-mono.note"},{id:"source-code-pro",name:"vocab.face.source-code-pro.name",family:"Source Code Pro",note:"vocab.face.source-code-pro.note"}],hand:[{id:"caveat",name:"vocab.face.caveat.name",family:"Caveat",note:"vocab.face.caveat.note"},{id:"kalam",name:"vocab.face.kalam.name",family:"Kalam",note:"vocab.face.kalam.note"},{id:"gloria-hallelujah",name:"vocab.face.gloria-hallelujah.name",family:"Gloria Hallelujah",note:"vocab.face.gloria-hallelujah.note"}],bengali:[{id:"noto-serif-bengali",name:"vocab.face.noto-serif-bengali.name",family:"Noto Serif Bengali",note:"vocab.face.noto-serif-bengali.note"},{id:"hind-siliguri",name:"vocab.face.hind-siliguri.name",family:"Hind Siliguri",note:"vocab.face.hind-siliguri.note"},{id:"tiro-bangla",name:"vocab.face.tiro-bangla.name",family:"Tiro Bangla",note:"vocab.face.tiro-bangla.note"}],devanagari:[{id:"noto-serif-devanagari",name:"vocab.face.noto-serif-devanagari.name",family:"Noto Serif Devanagari",note:"vocab.face.noto-serif-devanagari.note"},{id:"hind",name:"vocab.face.hind.name",family:"Hind",note:"vocab.face.hind.note"},{id:"tiro-devanagari-hindi",name:"vocab.face.tiro-devanagari-hindi.name",family:"Tiro Devanagari Hindi",note:"vocab.face.tiro-devanagari-hindi.note"}]},Er=[{id:"bold",label:"vocab.font-style.bold.label",css:{fontWeight:"700"}},{id:"italic",label:"vocab.font-style.italic.label",css:{fontStyle:"italic"}},{id:"smallcaps",label:"vocab.font-style.smallcaps.label",css:{fontVariantCaps:"small-caps"},needsCase:!0},{id:"allcaps",label:"vocab.font-style.allcaps.label",css:{textTransform:"uppercase"},needsCase:!0},{id:"figures",label:"vocab.font-style.figures.label",css:{fontVariantNumeric:"tabular-nums"}}];function Av(t){const n=Ba.find(o=>o.key===t);return Er.filter(o=>!(o.needsCase&&(n!=null&&n.script)))}const nd=t=>pf[t]||[];function ff(t,n){const o=nd(t);return o.find(s=>s.id===n)||yf(n)||o[0]}let Ao=[];const gf=t=>`TippaniUpload${t}`,qv=()=>Ao.slice();async function bf(t){Ao=(t||[]).map(n=>({...n,family:gf(n.id)})),!(typeof document>"u"||!document.fonts||typeof FontFace>"u")&&await Promise.all(Ao.map(async n=>{try{const o=new FontFace(n.family,`url(/api/fonts/${n.id}/file)`);await o.load(),document.fonts.add(o)}catch{}}))}function yf(t){const n=/^upload:(\d+)$/.exec(String(t||""));if(!n)return null;const o=Ao.find(s=>String(s.id)===n[1]);return o?{id:t,name:o.name,family:o.family,note:"vocab.face.upload.note"}:null}const Pi={bengali:"অআইঈউকখগঘঙ",devanagari:"अआइईउकखगघङ",latin:"Hamburgefonstiv"};function wf(t){return Pi[t]||Pi.latin}function vf(t,n){var h,d;if(typeof document>"u")return null;const o=(d=(h=document.createElement("canvas")).getContext)==null?void 0:d.call(h,"2d");if(!o||typeof o.measureText!="function")return null;const s=wf(n),r=m=>(o.font=`40px ${m}`,o.measureText(s).width),i=r("monospace"),l=r(`"${t}", monospace`);return!i||!l?null:Math.abs(l-i)>.5}function Mv(t,n){const o=Ba.find(s=>s.key===n);return vf(t,(o==null?void 0:o.script)||"latin")}let Ds={},so={};const kf=Ba.map(t=>t.key),ad=t=>"font"+t[0].toUpperCase()+t.slice(1),xf=t=>ad(t)+"Style";function _n(t){return ff(t,Ds[t])}function jf(t){return so[t]||[]}function Sf(t){const n=i=>`'${i.family}'`,o=n(_n(t)),s=n(_n("bengali")),r=n(_n("devanagari"));switch(t){case"display":return`${o}, ${s}, ${r}, Georgia, 'Times New Roman', serif`;case"ui":return`${o}, ${s}, ${r}, system-ui, sans-serif`;case"mono":return`${o}, ${s}, ${r}, ui-monospace, 'Cascadia Mono', monospace`;case"hand":return`${o}, ${s}, ${r}, 'Segoe Script', cursive`;default:return`${o}, serif`}}function Fi(t){Ds={},so={};for(const o of kf)Ds[o]=String((t==null?void 0:t[ad(o)])||"").trim(),so[o]=Nf(t==null?void 0:t[xf(o)]);const n=document.documentElement;for(const o of Ba){n.style.setProperty(o.prop,Sf(o.key));const s=new Set(so[o.key]),r=i=>s.has(i);n.style.setProperty(`${o.prop}-weight`,r("bold")?"700":"inherit"),n.style.setProperty(`${o.prop}-style`,r("italic")?"italic":"inherit"),n.style.setProperty(`${o.prop}-caps`,r("smallcaps")?"small-caps":"inherit"),n.style.setProperty(`${o.prop}-case`,r("allcaps")?"uppercase":"inherit"),n.style.setProperty(`${o.prop}-figures`,r("figures")?"tabular-nums":"inherit")}}function Nf(t){const n=new Set(Er.map(o=>o.id));return String(t||"").split(",").map(o=>o.trim().toLowerCase()).filter(o=>n.has(o))}function Lv(t){const n=new Set(t||[]);return Er.filter(o=>n.has(o.id)).map(o=>o.id).join(",")}function Dv(){return Ba.map(t=>({...t,faces:nd(t.key),chosen:_n(t.key),styles:jf(t.key)}))}const Ya=2,Qa=640;let He=od();function od(){const t=d=>_n(d).family,n=t("display"),o=t("mono"),s=t("hand"),r=t("bengali"),i=t("devanagari"),l=`"${n}", "${r}", "${i}", Georgia, serif`,h=`"${o}", ui-monospace, monospace`;return{quote:`italic 400 27px ${l}`,translation:`400 21px ${l}`,attrBold:`600 15px ${l}`,attrItalic:`italic 400 15px ${l}`,attrPlain:`400 15px ${l}`,meta:`500 11.5px ${h}`,note:`400 22px "${s}", "${r}", "${i}", cursive`,tag:`600 11px ${h}`,foot:`600 14px ${l}`,credit:`500 11px ${h}`,bengali:`400 12px "${r}", serif`}}const Tf=/[\u0980-\u09FF]/,Cf=/[\u0900-\u097F]/;function Ef(t){if(typeof document>"u"||!document.fonts||!document.fonts.load)return Promise.resolve();He=od();const n=i=>_n(i).family,o=[`italic 27px "${n("display")}"`,`600 15px "${n("display")}"`,`italic 15px "${n("display")}"`,`600 14px "${n("display")}"`,`500 12px "${n("mono")}"`,`600 11px "${n("mono")}"`,`500 11px "${n("mono")}"`],s=t===void 0;(s||t.hand)&&o.push(`22px "${n("hand")}"`);const r=s?"":String(t.text||"");return(s||Tf.test(r))&&o.push(`12px "${n("bengali")}"`),(s||Cf.test(r))&&o.push(`12px "${n("devanagari")}"`),Promise.all(o.map(i=>(r?document.fonts.load(i,r):document.fonts.load(i)).catch(()=>{}))).then(()=>{})}function Ar(){const t=typeof document<"u"?document.documentElement:null,n=t?getComputedStyle(t):null,o=(s,r)=>(n?n.getPropertyValue(s).trim():"")||r;return{dark:t?t.dataset.theme==="dark":!1,materialSet:t&&t.dataset.matSet||"",bg:o("--bg","#F4EDDE"),cardTop:o("--card-top","#FFFFFC"),cardBottom:o("--card-bottom","#FCF8ED"),ink:o("--ink","#221C16"),soft:o("--soft","#6A5F50"),faint:o("--faint","#8A7C68"),line:o("--line","#E4DAC7"),amber:o("--amber","#BE8A4E"),accent:o("--accent","#B4482D"),inkBorder:o("--ink-border","rgba(41,38,29,.6)")}}function Tn(t,n){let o=String(t).trim().replace("#","");o.length===3&&(o=o.split("").map(r=>r+r).join(""));const s=parseInt(o,16);return Number.isNaN(s)||o.length!==6?`rgba(180,72,45,${n})`:`rgba(${s>>16&255}, ${s>>8&255}, ${s&255}, ${n})`}function Ot(t,n,o,s,r,i){const l=Math.max(0,Math.min(i,s/2,r/2));t.beginPath(),t.moveTo(n+l,o),t.arcTo(n+s,o,n+s,o+r,l),t.arcTo(n+s,o+r,n,o+r,l),t.arcTo(n,o+r,n,o,l),t.arcTo(n,o,n+s,o,l),t.closePath()}const Af="#B4482D",qf="#D8613D",Bi="#F4EDDE";function Mf(t,n,o,s,r){const i=s/256,l=d=>n+(d-21.43)*i,h=d=>o+(d-23.37)*i;t.save(),t.fillStyle=r?qf:Af,Ot(t,l(21.43),h(23.37),213.14*i,178.04*i,44.51*i),t.fill(),t.beginPath(),t.moveTo(l(84),h(190)),t.lineTo(l(128),h(190)),t.lineTo(l(78),h(229)),t.closePath(),t.fill(),t.fillStyle=Bi,t.strokeStyle=Bi,t.lineWidth=13*i,t.lineCap="round";for(const d of[72,152])t.beginPath(),t.arc(l(d),h(128),31*i,0,Math.PI*2),t.fill(),t.beginPath(),t.moveTo(l(d+13),h(104)),t.lineTo(l(d+6),h(74)),t.stroke();for(const d of[45.39,82.72,120.05,157.38])Ot(t,l(197.24),h(d),22*i,22*i,6.8*i),t.fill();t.restore()}function Xn(t,n,o){const s=[];for(const h of n)String(h.text).split(`
`).forEach((m,p)=>{p>0&&s.push({br:!0});for(const u of m.split(/(\s+)/))u!==""&&s.push({text:u,font:h.font,space:/^\s+$/.test(u)})});const r=[];let i=[],l=0;for(const h of s){if(h.br){r.push(i),i=[],l=0;continue}t.font=h.font;const d=t.measureText(h.text).width;if(h.space){if(l===0)continue;i.push({text:h.text,font:h.font,w:d}),l+=d;continue}if(d>o){i.length&&(r.push(i),i=[],l=0);let m=h.text;for(;m.length;){let p=1;for(;p<m.length&&t.measureText(m.slice(0,p+1)).width<=o;)p++;const u=m.slice(0,p);r.push([{text:u,font:h.font,w:t.measureText(u).width}]),m=m.slice(p)}continue}if(l>0&&l+d>o){for(;i.length&&i[i.length-1].space===void 0&&/^\s+$/.test(i[i.length-1].text);)l-=i.pop().w;r.push(i),i=[],l=0}i.push({text:h.text,font:h.font,w:d}),l+=d}return i.length&&r.push(i),r}const On=new Map,aa=new Map;function Lf(t){return t?aa.has(t)?Promise.resolve(aa.get(t)):new Promise(n=>{const o=new Image;o.onload=()=>{aa.set(t,o),n(o)},o.onerror=()=>{aa.set(t,null),n(null)},o.src=t}):Promise.resolve(null)}function Df(t){return t&&aa.get(t)||null}function _f(t){const n=(t||[]).filter(o=>o&&!On.has(o));return n.length?Promise.all(n.map(o=>new Promise(s=>{const r=new Image;r.onload=()=>{On.set(o,r),s()},r.onerror=()=>{On.set(o,null),s()},r.src=o}))).then(()=>{}):Promise.resolve()}function sd(t,n,o,s,r,i){const l=n.width/n.height,h=r/i;let d,m,p,u;l>h?(m=n.height,d=m*h,p=(n.width-d)/2,u=0):(d=n.width,m=d/h,p=0,u=(n.height-m)/2),t.drawImage(n,p,u,d,m,o,s,r,i)}const Of=.46,Rf=.5,If=.88,Hi=.55,Pf=.3,Ff=5,Bf=.52,Hf=.5,zf=4,$f=.7,Wf=3,zi=6;function Jn(t){return Math.max(zf,Math.round(t*Hf/zi)*zi)}function Uf(t,n,o,s,r){if(typeof document>"u")return null;const i=document.createElement("canvas");i.width=Math.max(1,Math.ceil(t)),i.height=Math.max(1,Math.ceil(n));const l=i.getContext("2d");if(!l)return null;r(l),l.globalCompositeOperation="source-in",l.fillStyle=s,l.fillRect(0,0,i.width,i.height),l.globalCompositeOperation="source-over";const h=document.createElement("canvas");h.width=i.width,h.height=i.height;const d=h.getContext("2d");if(!d)return null;const m=`blur(${o}px)`;let p=!1;try{d.filter=m,p=d.filter===m}catch{p=!1}return d.drawImage(i,0,0),p&&(d.filter="none"),h}function Gf(t,n){return n?{ink:t.ink,soft:t.ink,faint:t.ink}:{ink:t.ink,soft:t.soft,faint:t.faint}}let $i=new WeakMap;const Vf=6;function Wi(t,n,o,s,r,i,l){if(!t||!n||!o)return null;const h=`${l||""}|${Math.ceil(n)}x${Math.ceil(o)}|${s}|${r||""}|${i||""}`;let d=$i.get(t);if(d){const f=d.get(h);if(f)return f}else d=new Map,$i.set(t,d);const m=document.createElement("canvas");m.width=Math.ceil(n),m.height=Math.ceil(o);const p=m.getContext("2d");if(!p)return null;if(sd(p,t,0,0,m.width,m.height),r){p.globalCompositeOperation="color";const f=p.globalCompositeOperation==="color";f||(p.globalCompositeOperation="source-atop"),p.globalAlpha=f?Hi:Hi*.6,p.fillStyle=r,p.fillRect(0,0,m.width,m.height),p.globalAlpha=1}i&&(p.globalCompositeOperation="source-over",p.globalAlpha=Pf,p.fillStyle=i,p.fillRect(0,0,m.width,m.height),p.globalAlpha=1);const u=s==="up"?p.createLinearGradient(0,m.height,0,0):s==="right"?p.createLinearGradient(0,0,m.width,0):p.createLinearGradient(m.width,0,0,0);return u.addColorStop(0,"rgba(0,0,0,0)"),u.addColorStop(1-If,"rgba(0,0,0,0)"),u.addColorStop(.34,"rgba(0,0,0,0.55)"),u.addColorStop(.62,"rgba(0,0,0,0.86)"),u.addColorStop(1,"rgba(0,0,0,1)"),p.globalCompositeOperation="destination-out",p.fillStyle=u,p.fillRect(0,0,m.width,m.height),d.size>=Vf&&d.delete(d.keys().next().value),d.set(h,m),m}function Kf(t,n,o){const s=n.quote&&t.quote?t.quote:"",r=n.translation&&t.translation?t.translation:"",i=(t.attribution||[]).filter(u=>n[u.id]&&u.value).map(u=>({text:u.value,emphasis:u.emphasis})),l=(t.meta||[]).filter(u=>n[u.id]&&u.value).map(u=>u.phrase?a(u.phrase,{value:u.value}):u.value),h=n.tags&&t.tags?t.tags:[],d=n.note&&t.note?t.note:"",p=!t.facesFor||n[t.facesFor]?t.faces||[]:[];return{quote:s,translation:r,attribution:i,meta:l,tags:h,note:d,faces:p,facesFor:t.facesFor||null,swap:!!t.swap&&p.length>0,colorHex:o||null,portrait:!!t.portrait&&p.length>0}}const Ui=38,Gi=23,Vi=19,Ki=28,Yi=28,Za=24,Qi=10,ea=7,Zi=34,ls=20,Yf=(229.3-23.37)/256,Qf=14*.7,rn=34,Zf=5;function _t(t,n=15){const o=/(\d+(?:\.\d+)?)px/.exec(String(t));return o?Number(o[1]):n}const Xf=new Set(["author","speaker"]);function Jf(t){return Xf.has(t||"author")}function Xi(t,n,o,s,r,i,l){l&&(t.letterSpacing=l),t.fillStyle=i,t.textBaseline="alphabetic",n.forEach((h,d)=>{let m=o;const p=s+r*d+r*.76;for(const u of h)t.font=u.font,t.fillText(u.text,m,p),m+=u.w}),l&&(t.letterSpacing="0px")}function eg(t,n,o){var V,P;const s=t.getContext("2d"),r=22,i=34,l=r,h=Qa-r*2,d=!!n.colorHex&&!n.portrait,m=l+i+(d?8:0),p=h-i*2-(d?8:0),u=!!n.portrait&&!!((V=n.faces)!=null&&V.length),f=Gf(o,u),b=[],w=T=>{T.height>0&&b.push(T)};let v=0;if(n.quote){const T=Xn(s,[{text:`“${n.quote}”`,font:He.quote}],p);v=T.length*Ui,w({kind:"text",lines:T,lh:Ui,color:f.ink,px:_t(He.quote),gap:0,height:v})}if(n.translation){const T=Xn(s,[{text:n.translation,font:He.translation}],p);w({kind:"text",lines:T,lh:Yi,color:f.soft,px:_t(He.translation),gap:12,height:T.length*Yi})}const g=!n.portrait&&((P=n.faces)!=null&&P.length)?(n.swap?[...n.faces].reverse():n.faces).slice(0,Zf):[],y=g.length?rn+(g.length-1)*(rn-Math.round(rn*.34)):0,k=Jf(n.facesFor),j=g.length&&k?g:null,N=g.length&&!k?g:null,S=10;if(n.attribution.length){const T=[];n.attribution.forEach((G,K)=>{T.push({text:K===0?"— ":", ",font:He.attrPlain});const M=G.emphasis==="bold"?He.attrBold:G.emphasis==="italic"?He.attrItalic:He.attrPlain;T.push({text:G.text,font:M})});let B=null,_=0,U=0,F=T;j&&(B="— ",s.font=He.attrPlain,_=s.measureText(B).width,U=_+y+S,F=T.slice(1));const X=Xn(s,F,p-U),R=X.length*Gi;w({kind:"text",lines:X,lh:Gi,color:f.soft,px:_t(He.attrPlain),gap:14,textH:R,lead:U,pre:B,preFont:He.attrPlain,faceX:_,leadFaces:j,height:Math.max(R,j?rn:0)})}const x=n.meta.join("  ·  ").toUpperCase();if(x){const T=N?y+S:0;s.letterSpacing="1px";const B=Xn(s,[{text:x,font:He.meta}],p-T);s.letterSpacing="0px";const _=B.length*Vi;w({kind:"text",lines:B,lh:Vi,color:f.soft,px:_t(He.meta),ls:"1px",gap:6,textH:_,lead:T,leadFaces:N,height:Math.max(_,T?rn:0)})}if(n.note){const T=Xn(s,[{text:n.note,font:He.note}],p-12);w({kind:"note",lines:T,lh:Ki,color:f.ink,px:_t(He.note),gap:20,height:T.length*Ki})}if(n.tags.length){const T=[];let B=[],_=0;for(const U of n.tags){s.font=He.tag;const F=s.measureText(U).width+Qi*2;B.length&&_+F>p&&(T.push(B),B=[],_=0),B.push({text:U,w:F}),_+=F+ea}B.length&&T.push(B),w({kind:"tags",rows:T,px:_t(He.tag),gap:18,height:T.length*(Za+ea)-ea})}let L=0;b.forEach((T,B)=>{L+=(B?T.gap:0)+T.height});const A=i*2+L+20+Zi,E=Math.ceil(A+r*2);t.width=Qa*Ya,t.height=E*Ya,s.scale(Ya,Ya),s.fillStyle=o.bg,s.fillRect(0,0,Qa,E);const D=s.createLinearGradient(0,r,0,A+r);D.addColorStop(0,o.cardTop),D.addColorStop(1,o.cardBottom);const q=14;s.save(),s.shadowColor="rgba(0,0,0,0.28)",s.shadowBlur=26,s.shadowOffsetY=12,Ot(s,l,r,h,A,q),s.fillStyle=D,s.fill(),s.restore();const C=o.tile&&o.tile.img;if(C&&typeof s.createPattern=="function"){s.save(),Ot(s,l,r,h,A,q),s.clip();for(const[T,B]of[[o.tile.coarse,"source-over"],[o.tile.fine,"overlay"]]){const _=s.createPattern(C,"repeat");if(!_)break;const U=T/(C.width||T);typeof _.setTransform=="function"&&typeof DOMMatrix=="function"&&_.setTransform(new DOMMatrix([U,0,0,U,0,0])),s.globalAlpha=o.tile.strength,s.globalCompositeOperation=B,s.fillStyle=_,s.fillRect(l,r,h,A)}s.globalAlpha=1,s.globalCompositeOperation="source-over",s.restore()}if(Ot(s,l,r,h,A,q),s.lineWidth=1.5,s.strokeStyle=o.inkBorder,s.stroke(),u){const T=n.faces;if(s.save(),Ot(s,l,r,h,A,q),s.clip(),s.globalAlpha=Rf,T.length>2){const B=(n.swap?[...T].reverse():T).slice(0,Ff),_=Math.round(A*Bf),U=r+A-_,F=Math.ceil(h/B.length);B.forEach((X,R)=>{const G=l+R*F,K=R===B.length-1?l+h-G:F,M=Wi(On.get(X.url),K,_,"up",n.colorHex,o.cardTop,X.url);M&&s.drawImage(M,G,U,K,_)})}else{const B=Math.round(h*Of),_=A,U=[{fade:"right",x:l},{fade:"left",x:l+h-B}];U.forEach((F,X)=>{const R=n.swap?T[U.length-1-X]:T[X];if(!R)return;const G=Wi(On.get(R.url),B,_,F.fade,n.colorHex,o.cardTop,R.url);G&&s.drawImage(G,F.x,r,B,_)})}s.restore()}d&&v>0&&(s.fillStyle=n.colorHex,Ot(s,l+i-2,r+i,6,v,3),s.fill());const I=(T,B,_,U)=>{const F=rn,X=Math.round(F*.34);for(let R=B.length-1;R>=0;R--){const G=_+R*(F-X),K=G+F/2,M=U+F/2,Q=On.get(B[R].url);T.save(),T.beginPath(),T.arc(K,M,F/2,0,Math.PI*2),T.closePath(),T.clip(),Q?sd(T,Q,G,U,F,F):(T.fillStyle=Tn(o.ink,.08),T.fillRect(G,U,F,F)),T.restore(),T.beginPath(),T.arc(K,M,F/2,0,Math.PI*2),T.lineWidth=3,T.strokeStyle=o.cardTop,T.stroke(),T.beginPath(),T.arc(K,M,F/2-.5,0,Math.PI*2),T.lineWidth=1,T.strokeStyle=Tn(o.ink,.22),T.stroke()}},O=(T,B)=>{let _=r+i;b.forEach((M,Q)=>{if(Q&&(_+=M.gap),B!==null&&Jn(M.px)!==B){_+=M.height;return}if(M.kind==="text"){const z=_+(M.height-(M.textH??M.height))/2;M.leadFaces&&I(T,M.leadFaces,m+(M.faceX||0),_+(M.height-rn)/2),M.pre&&(T.font=M.preFont,T.fillStyle=M.color,T.textBaseline="alphabetic",T.fillText(M.pre,m,z+M.lh*.76)),Xi(T,M.lines,m+(M.lead||0),z,M.lh,M.color,M.ls)}else M.kind==="note"?(T.fillStyle=o.accent,T.fillRect(m,_+4,3,M.lh*.62),Xi(T,M.lines,m+12,_,M.lh,M.color,null)):M.kind==="tags"&&(T.font=He.tag,T.textBaseline="middle",M.rows.forEach((z,te)=>{const J=_+te*(Za+ea);let fe=m;for(const me of z)Ot(T,fe,J,me.w,Za,7),T.fillStyle=o.cardTop,T.fill(),T.fillStyle=Tn(o.accent,.3),T.fill(),T.lineWidth=1,T.strokeStyle=Tn(o.accent,.55),T.stroke(),T.fillStyle=f.ink,T.fillText(me.text,fe+Qi,J+Za/2+1),fe+=me.w+ea}),T.textBaseline="alphabetic");_+=M.height});const U=r+A-i-Zi+10,F=Jn(_t(He.credit));if(B!==null&&B!==F)return;T.strokeStyle=Tn(o.ink,.12),T.lineWidth=1,T.beginPath(),T.moveTo(m,U),T.lineTo(m+p,U),T.stroke();const X=U+21,R=ls*Yf;Mf(T,m,X-Qf/2-R/2,ls,o.dark);let G=m+ls+7;T.fillStyle=f.faint,T.textBaseline="alphabetic",T.font=He.credit;const K=a("share.image.footer.credit.label");T.fillText(K,G,X),G+=T.measureText(K).width+6,T.font=He.foot,T.fillText("tippani",G,X),G+=T.measureText("tippani").width+8,T.font=He.bengali,T.fillText("টিপ্পনী",G,X)};if(u){const T=[...new Set(b.map(B=>Jn(B.px)))];T.includes(Jn(_t(He.credit)))||T.push(Jn(_t(He.credit)));for(const B of T){const _=Uf(Qa,E,B,Tn(o.cardTop,1),U=>O(U,B));if(_){s.save(),Ot(s,l,r,h,A,q),s.clip(),s.shadowColor="rgba(0,0,0,0)",s.shadowBlur=0,s.shadowOffsetX=0,s.shadowOffsetY=0,s.globalAlpha=$f;for(let U=0;U<Wf;U++)s.drawImage(_,0,0);s.globalAlpha=1,s.restore()}}}O(s,null),s.shadowColor="rgba(0,0,0,0)",s.shadowBlur=0,s.shadowOffsetX=0,s.shadowOffsetY=0,s.filter="none"}function qr(t,n,o){return!t||!n?[]:tt(t,o||Hn).map(s=>n[s]).filter(s=>s&&s.image_path).map(s=>({name:s.name,url:Ue(s.image_path)}))}function rd(t){return(t||[]).filter(n=>n&&n.path).map(n=>({name:n.name,url:Ue(n.path)}))}const tg=()=>[["light",a("share.image.theme.light.label")],["dark",a("share.image.theme.dark.label")]],ng=()=>Object.keys(qt).map(t=>[t,a(cu[t])]);function ag(){return Ar().dark?"dark":"light"}function og(){const t=Ar().materialSet;return qt[t]?t:Gn}function sg(t,n){const o=String(t||""),s=o==="dark"||o.endsWith("-dark"),r=Ul(n,"card");return{...bu(s,Ar().accent),materialSet:qt[n]?n:Gn,tile:{...r,img:Df(r.url)}}}const rg="tp-btn tp-btn-primary",cs=[{id:"whatsapp",get name(){return a("share.format.whatsapp.name")},get logic(){return a("share.format.whatsapp.what")},get hint(){return a("share.format.whatsapp.hint")}},{id:"plaintext",get name(){return a("share.format.plaintext.name")},get logic(){return a("share.format.plaintext.what")},get hint(){return a("share.format.plaintext.hint")}},{id:"markdown",get name(){return a("share.format.markdown.name")},get logic(){return a("share.format.markdown.what")},get hint(){return a("share.format.markdown.hint")}},{id:"reddit",get name(){return a("share.format.reddit.name")},get logic(){return a("share.format.reddit.what")},get hint(){return a("share.format.reddit.hint")}}],ig=()=>a("share.format.image.what");function id({quote:t,note:n,translation:o,author:s,title:r,published:i,chapter:l,location:h,character:d,date:m,tags:p,color:u,people:f,seps:b,characterImages:w}){return{quote:t||"",translation:o||"",color:u||"",faces:qr(s,f,b),facesFor:"author",characterFaces:rd(w),attribution:[{id:"author",label:a("share.field.author.label"),value:s||"",emphasis:"bold"},{id:"work",label:a("share.field.work.book.label"),value:r||"",emphasis:"italic"},{id:"published",label:a("share.field.published.label"),value:i?String(i):""}],meta:[{id:"character",label:a("share.field.character.label"),value:d||""},{id:"chapter",label:a("share.field.chapter.label"),value:l?a("share.credit.chapter.phrase",{n:l}):""},{id:"location",label:a("share.field.location.label"),value:h?a("share.credit.location.phrase",{n:h}):""},{id:"noted",label:a("share.field.noted.label"),value:m||""}],tags:p||[],note:n||""}}function ld({quote:t,note:n,translation:o,title:s,year:r,character:i,actor:l,timestamp:h,episode:d,tags:m,color:p,tmdbId:u,tvdbId:f,people:b,seps:w,characterImages:v}){return{quote:t||"",translation:o||"",faces:qr(l,b,w),facesFor:"actor",characterFaces:rd(v),attribution:[{id:"work",label:a("share.field.work.film.label"),value:s||"",emphasis:"italic"},{id:"year",label:a("share.field.released.label"),value:r?String(r):""},{id:"tmdb",label:a("share.field.tmdb.label"),value:u?a("share.credit.tmdb.phrase",{code:u}):""},{id:"tvdb",label:a("share.field.tvdb.label"),value:f?a("share.credit.tvdb.phrase",{code:f}):""}],meta:[{id:"character",label:a("share.field.character.label"),value:i||""},{id:"actor",label:a("share.field.actor.label"),value:l||"",emphasis:"bold",phrase:"share.credit.actor.phrase"},{id:"episode",label:a("share.field.episode.label"),value:d||""},{id:"timestamp",label:a("share.field.time.label"),value:h||""}],tags:m||[],note:n||"",color:p||""}}function cd({quote:t,translation:n,note:o,category:s,language:r,speaker:i,occasion:l,when:h,place:d,medium:m,date:p,tags:u,color:f,people:b,seps:w}){return{quote:t||"",translation:n||"",color:f||"",faces:qr(i,b,w),facesFor:"speaker",attribution:[{id:"speaker",label:a("share.field.speaker.label"),value:i||"",emphasis:"bold"},{id:"occasion",label:a("share.field.occasion.label"),value:l||"",emphasis:"italic"},{id:"when",label:a("share.field.when.label"),value:h||""}],meta:[{id:"proverb",label:a("share.field.proverb.label"),value:s==="proverb"&&r?r:"",phrase:"share.field.proverb.legend"},{id:"place",label:a("share.field.place.label"),value:d||""},{id:"medium",label:a("share.field.medium.label"),value:m||""},{id:"noted",label:a("share.field.noted.label"),value:p||""}],tags:u||[],note:o||""}}const lg=new Set(["location","noted"]);function dd(t){const n=[];t.quote&&n.push({id:"quote",label:a("share.field.quote.label")}),t.translation&&n.push({id:"translation",label:a("share.field.translation.label")});for(const o of t.attribution||[])o.value&&n.push({id:o.id,label:o.label});for(const o of t.meta||[])o.value&&n.push({id:o.id,label:o.label});return t.tags&&t.tags.length&&n.push({id:"tags",label:a("share.field.tags.label")}),t.note&&n.push({id:"note",label:a("share.field.note.label")}),n}function hd(t){return Object.fromEntries(dd(t).map(n=>[n.id,!lg.has(n.id)]))}async function ka(t){const n=await Bl(ud(t,hd(t),"plaintext"));return Ee(a(n?"common.toast.copied":"error.copy.generic")),n}function cg(t,n){return n==="markdown"||n==="reddit"?`*${t}*`:n==="whatsapp"?`_${t}_`:t}function dg(t,n){return n==="markdown"||n==="reddit"?`**${t}**`:n==="whatsapp"?`*${t}*`:t}function Ji(t,n,o){return n==="bold"?dg(t,o):n==="italic"?cg(t,o):t}function el(t,n){return n==="plaintext"?a("share.text.quote.phrase",{value:t}):t.split(`
`).map(o=>`> ${o}`).join(`
`)}function hg(t){const n=String(t).trim().replace(/\s+/g,"");return n?"#"+n:""}function ud(t,n,o){const s=[];n.quote&&t.quote&&s.push(el(t.quote,o)),n.translation&&t.translation&&s.push(el(t.translation,o));const r=[];for(const l of t.attribution||[])n[l.id]&&l.value&&r.push(Ji(l.value,l.emphasis,o));r.length&&s.push(a("share.text.attribution.phrase",{value:r.join(", ")}));const i=[];for(const l of t.meta||[])if(n[l.id]&&l.value){const h=Ji(l.value,l.emphasis,o);i.push(l.phrase?a(l.phrase,{value:h}):h)}if(i.length&&s.push(i.join(" · ")),n.note&&t.note&&s.push(t.note),n.tags&&t.tags&&t.tags.length){const l=t.tags.map(hg).filter(Boolean).join(" ");l&&s.push(l)}return s.join(`

`)}const ug=[{re:/`([^`]+)`/,el:(t,n)=>e.jsx("code",{className:"share-code",children:t[1]},n)},{re:/\*\*([^*]+)\*\*/,el:(t,n,o)=>e.jsx("strong",{children:gt(t[1],o)},n)},{re:/__([^_]+)__/,el:(t,n,o)=>e.jsx("strong",{children:gt(t[1],o)},n)},{re:/~~([^~]+)~~/,el:(t,n,o)=>e.jsx("s",{children:gt(t[1],o)},n)},{re:/\*([^*\n]+)\*/,el:(t,n,o)=>e.jsx("em",{children:gt(t[1],o)},n)},{re:/(^|[^A-Za-z0-9])_([^_\n]+)_(?![A-Za-z0-9])/,lead:1,el:(t,n,o)=>e.jsx("em",{children:gt(t[2],o)},n)},{re:/\[([^\]]+)\]\(([^)\s]+)\)/,el:(t,n)=>e.jsx("a",{className:"share-link",children:t[1]},n)}],mg=[{re:/```([^`]+)```/,el:(t,n)=>e.jsx("code",{className:"share-code",children:t[1]},n)},{re:/`([^`]+)`/,el:(t,n)=>e.jsx("code",{className:"share-code",children:t[1]},n)},{re:/\*([^*\n]+)\*/,el:(t,n,o)=>e.jsx("strong",{children:gt(t[1],o)},n)},{re:/_([^_\n]+)_/,el:(t,n,o)=>e.jsx("em",{children:gt(t[1],o)},n)},{re:/~([^~\n]+)~/,el:(t,n,o)=>e.jsx("s",{children:gt(t[1],o)},n)}];function pg(t){return t==="whatsapp"?mg:t==="markdown"||t==="reddit"?ug:null}function gt(t,n){if(!n)return[t];const o=[];let s=t,r=0,i=0;for(;s.length&&i++<2e3;){let l=null;for(const m of n){const p=m.re.exec(s);p&&(!l||p.index<l.m.index)&&(l={p:m,m:p})}if(!l){o.push(s);break}const h=l.p.lead&&l.m[l.p.lead]||"",d=l.m.index+h.length;d>0&&o.push(s.slice(0,d)),o.push(l.p.el(l.m,"i"+r++,n)),s=s.slice(l.m.index+l.m[0].length)}return o}function tl(t,n,o){const s=t.split(`
`);return s.map((r,i)=>e.jsxs("span",{children:[gt(r,n),i<s.length-1&&e.jsx("br",{})]},`${o}-${i}`))}function fg(t,n,o,s){const r=t.split(`
`),i=r.filter(l=>l.trim()!=="");if(n!=="plaintext"&&i.length&&i.every(l=>/^>\s?/.test(l))){const l=r.map(h=>h.replace(/^>\s?/,"")).join(`
`);return e.jsx("blockquote",{className:"share-quote",children:tl(l,o,`q${s}`)},s)}if((n==="markdown"||n==="reddit")&&r.length===1){const l=t.match(/^(#{1,6})\s+(.*)$/);if(l){const d=`h${Math.min(l[1].length+2,6)}`;return e.jsx(d,{className:"share-h",children:gt(l[2],o)},s)}}return n!=="plaintext"&&i.length&&i.every(l=>/^[-*+]\s+/.test(l))?e.jsx("ul",{className:"share-ul",children:i.map((l,h)=>e.jsx("li",{children:gt(l.replace(/^[-*+]\s+/,""),o)},h))},s):n!=="plaintext"&&i.length&&i.every(l=>/^\d+[.)]\s+/.test(l))?e.jsx("ol",{className:"share-ol",children:i.map((l,h)=>e.jsx("li",{children:gt(l.replace(/^\d+[.)]\s+/,""),o)},h))},s):e.jsx("p",{className:"share-p",children:tl(t,o,`p${s}`)},s)}function gg(t,n){const o=pg(n);return t.split(/\n{2,}/).map((r,i)=>fg(r,n,o,i))}function bg({share:t,selected:n,onShared:o,actionRef:s}){var P;const r=c.useRef(null),i=Ie(),[l,h]=c.useState(!1),[d,m]=c.useState(!1),[p,u]=c.useState(""),[f,b]=$e("tippani:shareImageTheme",ag()),[w,v]=$e("tippani:shareImageMaterial",og()),[g,y]=$e("tippani:sharePortrait",!1),k=(t.faces||[]).length>0||(t.characterFaces||[]).length>0,[j,N]=$e("tippani:shareFaceKind","actor"),S=t.characterFaces||[],x=S.length>0&&(t.faces||[]).length>0,L=j==="character"&&S.length>0?S:t.faces||[],[A,E]=$e("tippani:shareSwapSides",!1),[D,q]=$e("tippani:shareImageTint",!1),C=!!t.color;c.useEffect(()=>{let T=!1;const B=()=>{const _=r.current;if(!(!_||T))try{const U=D&&t.color?vu(t.color):null;eg(_,Kf({...t,faces:L,portrait:g&&k,swap:A},n,U),sg(f,w)),u("")}catch{u(a("error.render.image"))}};return g&&k||B(),Promise.all([Ef({text:[t.quote,t.translation,t.note,...(t.attribution||[]).map(_=>(_==null?void 0:_.text)||"")].filter(Boolean).join(" "),hand:!!t.note}),_f(L.map(_=>_.url)),Lf(Ul(w,"card").url)]).then(B),window.addEventListener("tippani:theme",B),()=>{T=!0,window.removeEventListener("tippani:theme",B)}},[t,n,f,w,g,k,A,D,j]);async function I(){const T=r.current;if(!T)return;const B=await new Promise(F=>T.toBlob(F,"image/png"));if(!B)return u(a("error.render.image"));if(i&&navigator.canShare&&navigator.share){const F=new File([B],"tippani-quote.png",{type:"image/png"});if(navigator.canShare({files:[F]}))try{await navigator.share({files:[F]}),o==null||o();return}catch(X){if((X==null?void 0:X.name)==="AbortError")return}}if(i)try{const F=new FormData;F.append("file",B,"tippani-quote.png");const X=await fetch(jt("/share/image"),{method:"POST",body:F});if(X.ok){const{url:R}=await X.json(),G=document.createElement("a");G.href=jt(R),G.download="tippani-quote.png",document.body.appendChild(G),G.click(),G.remove(),o==null||o();return}}catch{}const _=URL.createObjectURL(B),U=document.createElement("a");U.href=_,U.download="tippani-quote.png",document.body.appendChild(U),U.click(),U.remove(),setTimeout(()=>URL.revokeObjectURL(_),6e4),o==null||o()}s&&(s.current=I);const O=typeof window<"u"&&typeof window.ClipboardItem<"u"&&!!((P=navigator.clipboard)!=null&&P.write);async function V(){const T=r.current;if(!(!T||!O)){m(!0);try{const B=await new Promise(_=>T.toBlob(_,"image/png"));await navigator.clipboard.write([new window.ClipboardItem({"image/png":B})]),h(!0),setTimeout(()=>h(!1),1600),o==null||o()}catch{u(a("share.image.copy.unsupported.error"))}finally{m(!1)}}}return e.jsxs("div",{children:[e.jsxs("div",{className:"mb-2 flex flex-wrap items-center gap-2",children:[e.jsx(W,{children:a("share.image.theme.label")}),e.jsx(De,{ariaLabel:a("share.image.theme.aria"),value:f,onChange:b,options:tg()}),e.jsx(Re,{title:a("share.image.theme.info.title"),text:a("share.image.theme.info.body")})]}),e.jsxs("div",{className:"mb-2 flex flex-wrap items-center gap-2",children:[e.jsx(W,{children:a("share.image.material.label")}),e.jsx(De,{ariaLabel:a("share.image.material.aria"),value:w,onChange:v,options:ng()})]}),x&&e.jsxs("div",{className:"mb-2 flex flex-wrap items-center gap-2",children:[e.jsx(W,{children:a("share.image.facekind.label")}),e.jsx(dt,{ariaLabel:a("share.image.facekind.aria"),value:j,onChange:N,options:[["actor",a("share.image.facekind.actor.label")],["character",a("share.image.facekind.character.label")]]}),e.jsx(Re,{title:a("share.image.facekind.info.title"),text:a("share.image.facekind.info.body")})]}),k&&e.jsxs("div",{className:"mb-2 flex flex-wrap items-center gap-2",children:[e.jsx(W,{children:a("share.image.portrait.label")}),e.jsx(dt,{ariaLabel:a("share.image.portrait.aria"),value:g?"backdrop":"chip",onChange:T=>y(T==="backdrop"),options:[["chip",a("share.image.portrait.chip.label")],["backdrop",a("share.image.portrait.backdrop.label")]]}),e.jsx(Re,{title:a("share.image.portrait.info.title"),text:a("share.image.portrait.info.body")})]}),k&&e.jsxs("div",{className:"mb-2 flex flex-wrap items-center gap-2",children:[e.jsx(W,{children:a("share.image.sides.label")}),e.jsx(dt,{ariaLabel:a("share.image.sides.aria"),value:A?"swapped":"as-credited",onChange:T=>E(T==="swapped"),options:[["as-credited",a("share.image.sides.as-credited.label")],["swapped",a("share.image.sides.swap.label")]]}),e.jsx(Re,{title:a("share.image.sides.info.title"),text:a("share.image.sides.info.body")})]}),C&&e.jsxs("div",{className:"mb-2 flex flex-wrap items-center gap-2",children:[e.jsx(W,{children:a("common.mono.colour.label")}),e.jsx(dt,{ariaLabel:a("share.image.colour.aria"),value:D?"on":"off",onChange:T=>q(T==="on"),options:[["off",a("common.toggle.off.label")],["on",a("common.toggle.on.label")]]}),e.jsx(Re,{title:a("share.image.colour.info.title"),text:a("share.image.colour.info.body")})]}),e.jsx(W,{className:"mb-1.5 block",children:a("share.preview.label")}),e.jsx("div",{className:"share-image-preview",children:e.jsx("canvas",{ref:r,className:"share-image-canvas","aria-label":a("share.image.preview.aria")})}),p&&e.jsx("p",{className:"microcopy mt-2",style:{color:"var(--error)"},children:p}),O&&e.jsx("div",{className:"mt-4 flex flex-wrap items-center justify-end gap-2",children:e.jsx(ge,{onClick:V,disabled:d,children:a(l?"common.action.copy.done.label":"share.image.copy.label")})})]})}function Jo({share:t,seen:n,onClose:o}){Nt(!0);const[s,r]=c.useState("image"),i=c.useMemo(()=>dd(t),[t]),[l,h]=c.useState(()=>hd(t)),[d,m]=c.useState(""),[p,u]=c.useState(!1),f=Ie(),b=c.useRef(null),w=c.useRef(!1),v=()=>{w.current||Il||!(n!=null&&n.id)||(w.current=!0,Z("POST","/review/seen",{kind:n.kind,id:n.id}))},g=cs.find(S=>S.id===s)||cs[0],y=s==="image",k=[["image",a("share.format.image.name")],...cs.map(S=>[S.id,S.name])];c.useEffect(()=>{m(ud(t,l,s)),u(!1)},[t,l,s]),c.useEffect(()=>{const S=x=>x.key==="Escape"&&o();return document.addEventListener("keydown",S),()=>document.removeEventListener("keydown",S)},[o]);async function j(){await Bl(d)&&(u(!0),setTimeout(()=>u(!1),1600),v())}const N=c.useMemo(()=>gg(d,s),[d,s]);return e.jsx("div",{className:"tp-scrim fixed inset-0 z-50 overflow-y-auto px-4 py-10",onMouseDown:S=>{S.target===S.currentTarget&&o()},children:e.jsxs("div",{role:"dialog","aria-modal":"true","aria-label":a("share.dialog.aria"),className:"hand-card hc-r2 mx-auto w-full max-w-3xl px-6 py-6",children:[e.jsxs("div",{className:"mb-4 flex items-start justify-between gap-3",children:[e.jsx("h2",{className:"display-title text-xl",children:a("share.dialog.title")}),e.jsxs("span",{className:"flex items-center gap-1",children:[y&&e.jsx(Ae,{icon:e.jsx(Dn,{}),ariaLabel:a("share.image.share.aria"),onClick:()=>{var S;return(S=b.current)==null?void 0:S.call(b)},tooltip:a("share.image.share.tip")}),e.jsx(yr,{onClick:o})]})]}),e.jsxs("div",{className:"mb-4 flex flex-wrap items-center gap-3",children:[e.jsx(W,{children:a("share.format.label")}),f?e.jsx("select",{className:"tp-input","aria-label":a("share.format.aria"),value:s,onChange:S=>r(S.target.value),children:k.map(([S,x])=>e.jsx("option",{value:S,children:x},S))}):e.jsx("div",{className:"share-format-toggle",children:e.jsx(dt,{ariaLabel:a("share.format.aria"),value:s,onChange:r,options:k})}),e.jsx(Re,{title:y?a("share.format.image.name"):g.name,text:y?ig():e.jsxs(e.Fragment,{children:[g.logic,e.jsx("code",{className:"share-hint mt-2",children:g.hint})]})})]}),i.length>0&&e.jsxs("div",{className:"mb-4",children:[e.jsx(W,{className:"mb-2 block",children:a("share.include.label")}),e.jsx("div",{className:"flex flex-wrap gap-x-4 gap-y-2",children:i.map(S=>e.jsxs("label",{className:"flex items-center gap-2",style:{cursor:"pointer"},children:[e.jsx("input",{type:"checkbox",checked:!!l[S.id],onChange:x=>h(L=>({...L,[S.id]:x.target.checked}))}),e.jsx("span",{className:"microcopy",children:S.label})]},S.id))})]}),y?e.jsx(bg,{share:t,selected:l,onShared:v,actionRef:b}):e.jsxs("div",{className:"grid gap-4 sm:grid-cols-2",children:[e.jsxs("div",{children:[e.jsx(W,{className:"mb-1.5 block",children:a("share.text.label")}),e.jsx("textarea",{className:"tp-input share-source",rows:"11",value:d,onChange:S=>m(S.target.value),"aria-label":a("share.text.aria")})]}),e.jsxs("div",{children:[e.jsx(W,{className:"mb-1.5 block",children:a("share.preview.label")}),e.jsx("div",{className:"share-preview","aria-live":"polite",children:d.trim()?N:e.jsx("p",{className:"microcopy",children:a("share.preview.empty")})})]})]}),!y&&e.jsx("div",{className:"mt-5 flex items-center justify-end gap-2",children:e.jsx("button",{className:rg,onClick:j,children:a(p?"common.action.copy.done.label":"common.action.copy.label")})})]})})}async function Qn(t,{label:n,reload:o}={}){var l;const s=n||a("common.toast.deleted.label"),r=await Z("DELETE",t);if(!r.ok)return r;const i=(l=r.data)==null?void 0:l.trash_id;return i?(Ee(s,{label:a("common.action.undo.label"),onClick:async()=>{const h=await Z("POST",`/trash/${i}/restore`);if(!h.ok)return Ee(le(h,a("error.undo.generic")));Ee(a("common.toast.restored.label")),o==null||o()}}),r):(Ee(s),r)}const Kt="row",ot="overflow",yg=t=>a(t==="book"?"common.subject.book.label":t==="movie"?"common.subject.movie.label":"common.subject.quote.label");function Ha(t,n,o={}){const s=Mr(t),r=yg(t);return[{id:"copy",label:a("common.action.copy.label"),where:Kt,icon:e.jsx(pa,{}),tooltip:a("common.action.copy.tip",{subject:r}),available:!s&&!!o.copy,run:()=>o.copy(n)},{id:"share",label:a("common.action.share.label"),where:Kt,icon:e.jsx(Dn,{}),tooltip:a("common.action.share.tip",{subject:r}),available:!s&&!!o.share,run:()=>o.share(n)},{id:"fill",label:a("common.action.fill.label"),where:ot,icon:e.jsx(Kn,{}),tooltip:a("common.action.fill.tip"),available:s&&!!o.fillGaps,run:()=>o.fillGaps(n)},{id:"practise",label:a("common.action.practise.label"),where:ot,icon:e.jsx(Ht,{}),tooltip:a("common.action.practise.tip",{subject:r}),single:!0,available:s&&!!o.practise,run:()=>o.practise(n)},{id:"review",label:a(o.excluded?"common.action.review.add.label":"common.action.review.skip.label"),where:ot,icon:o.excluded?e.jsx(Nc,{}):e.jsx(pr,{}),tooltip:a(o.excluded?"common.action.review.add.tip":"common.action.review.skip.tip"),available:!!o.setReview,run:()=>o.setReview(n,!!o.excluded)},{id:"edit",label:a("common.action.edit.label"),where:ot,icon:e.jsx(et,{}),tooltip:a("common.action.edit.tip",{subject:r}),single:!0,available:!!o.edit,run:()=>o.edit(n)},{id:"favourite",label:a(o.favourited?"common.action.favourite.menu.off.label":"common.action.favourite.menu.on.label"),where:ot,icon:e.jsx(mr,{}),tooltip:a("common.action.favourite.tip",{subject:r}),available:!s&&!!o.favourite,run:()=>o.favourite(n)},{id:"board",label:a("common.action.board.label"),where:ot,icon:e.jsx(So,{}),tooltip:a("common.action.board.tip"),available:!!o.setBoard,run:()=>o.setBoard(n)},{id:"delete",label:a("common.action.delete.label"),where:ot,icon:e.jsx(ze,{}),tooltip:a("common.action.delete.tip",{subject:r}),danger:!0,available:!!o.remove,run:()=>o.remove(n)}].filter(l=>l.available)}const zn=t=>t.filter(n=>n.where===Kt),$n=t=>t.filter(n=>n.where===ot),Xa="",wg="tags",vg="fields",kg="colour",xg="sticker",jg="shelf",Sg="board",Ng="anthology",Tg="confirm",Mr=t=>t==="book"||t==="movie";function Cg(t,n,o={}){const s=Mr(t),r=n.length===1;return[{id:"colour",label:a("common.action.colour.label"),where:Kt,icon:e.jsx(Sc,{}),form:kg,available:!s&&!!o.setColour,run:l=>o.setColour(n,l)},{id:"add-tags",label:a("common.action.add-tags.label"),where:ot,icon:e.jsx(qm,{}),form:wg,available:!s&&!!o.addTags,run:l=>o.addTags(n,l)},{id:"sticker",label:a("common.action.seal.label"),where:ot,icon:e.jsx(Im,{}),form:xg,available:!s&&!!o.setSticker,run:l=>o.setSticker(n,l)},{id:"favourite",label:a("common.action.favourite.menu.on.label"),where:Kt,icon:e.jsx(mr,{}),form:Xa,available:!s&&!!o.favourite,run:()=>o.favourite(n)},{id:"fill",label:a("common.action.fill.label"),where:Kt,icon:e.jsx(Kn,{}),form:Xa,available:s&&!!o.fillGaps,run:()=>o.fillGaps(n)},{id:"shelf",label:a("common.action.shelf.label"),where:Kt,icon:e.jsx(So,{}),form:jg,available:s&&!!o.setShelf,run:l=>o.setShelf(n,l)},{id:"board",label:a("common.action.board.label"),where:ot,icon:e.jsx(So,{}),form:Sg,available:!!o.setBoard,run:l=>o.setBoard(n,l)},{id:"anthology",label:a("common.action.anthology.label"),where:ot,icon:e.jsx(Tc,{}),form:Ng,available:!s&&!!o.addToAnthology,run:l=>o.addToAnthology(n,l)},{id:"set-fields",label:a("common.action.set-fields.label"),where:ot,icon:e.jsx(Ft,{}),form:vg,available:!!o.setFields&&!r,run:l=>o.setFields(n,l)},{id:"review",label:a(o.excluded?"common.action.review.add.label":"common.action.review.skip.label"),where:Kt,icon:o.excluded?e.jsx(Nc,{}):e.jsx(pr,{}),form:Xa,available:!!o.setReview,run:()=>o.setReview(n,!!o.excluded)},{id:"edit",label:a("common.action.edit.label"),where:ot,icon:e.jsx(et,{}),form:Xa,available:!!o.edit&&r,run:()=>o.edit(n[0])},{id:"delete",label:a("common.action.delete.label"),where:ot,icon:e.jsx(ze,{}),form:Tg,danger:!0,available:!!o.remove,run:l=>o.remove(n,l)}].filter(l=>l.available)}function za(t=[]){const[n,o]=c.useState(null),[s,r]=c.useState(()=>new Set),[i,l]=c.useState(!1),h=c.useRef(null),d=t.join(","),m=c.useMemo(()=>t,[d]);c.useEffect(()=>{r(v=>{if(v.size===0)return v;const g=new Set(m);let y=!1;const k=new Set;for(const j of v)g.has(j)?k.add(j):y=!0;return y?k:v})},[m]);const p=c.useCallback(()=>{r(new Set),o(null),l(!1),h.current=null},[]),u=c.useCallback(()=>{r(new Set),h.current=null},[]),f=c.useCallback((v,g)=>{l(!0),o(y=>y&&g&&y!==g?(r(new Set([v])),h.current=v,g):(r(k=>{const j=new Set(k);return j.has(v)?j.delete(v):j.add(v),j}),h.current=v,y||g||null))},[]),b=c.useCallback((v,g)=>{const y=h.current;if(y==null||y===v)return f(v,g);const k=m.indexOf(y),j=m.indexOf(v);if(k<0||j<0)return f(v,g);const[N,S]=k<j?[k,j]:[j,k];l(!0),o(g||null),r(x=>{const L=new Set(x);for(let A=N;A<=S;A++)L.add(m[A]);return L}),h.current=v},[m,f]),w=c.useCallback(v=>{l(!0),o(v||null),r(new Set(m))},[m]);return{kind:n,selected:s,ids:[...s],count:s.size,total:m.length,allSelected:m.length>0&&s.size>=m.length,open:i,active:i,any:s.size>0,isSelected:v=>s.has(v),toggle:f,extendTo:b,selectAll:w,deselectAll:u,dismiss:p,clear:p}}function Lr(t,{active:n}){return t.shiftKey?"extend":t.metaKey||t.ctrlKey||n?"toggle":"open"}function Dr(t,n,o){if(!t)return[];const s=[{id:"select",label:a(t.isSelected(n)?"common.selection.menu.deselect.label":"common.selection.menu.select.label"),onClick:()=>t.toggle(n,o)}];return t.total>1&&s.push(t.allSelected?{id:"deselect-all",label:a("common.selection.menu.deselect-all.label"),onClick:()=>t.deselectAll()}:{id:"select-all",label:a("common.selection.menu.select-all.label",{count:t.total,n:t.total}),onClick:()=>t.selectAll(o)}),s}const _r=[{name:"tag",vocab:"tags",combine:"and"},{name:"colour",vocab:"colours",combine:"or"},{name:"author",vocab:"authors",combine:"or"},{name:"speaker",vocab:"speakers",combine:"or"},{name:"actor",vocab:"actors",combine:"or"},{name:"character",vocab:"characters",combine:"or"},{name:"director",vocab:"directors",combine:"or"},{name:"genre",vocab:"genres",combine:"and"},{name:"series",vocab:"series",combine:"or"},{name:"shelf",vocab:"shelves",combine:"or"},{name:"year",vocab:"year",combine:"or"},{name:"favourite",vocab:"yesno",combine:"or",exclusive:!0},{name:"note",vocab:"yesno",combine:"or",exclusive:!0},{name:"wishlist",vocab:"yesno",combine:"or",exclusive:!0},{name:"book",vocab:"books",combine:"or"},{name:"movie",vocab:"movies",combine:"or"},{name:"added_from",vocab:null,combine:"or",typed:!1,exclusive:!0},{name:"added_to",vocab:null,combine:"or",typed:!1,exclusive:!0}],Eg=new Set(["colours","books","movies"]);_r.map(t=>t.name);const md=_r.filter(t=>t.typed!==!1).map(t=>t.name);function pd(t){const n=String(t||"").toLowerCase();return _r.find(o=>o.name===n)||null}const nl=new RegExp(`(?:^|\\s)(${md.join("|")})(\\\\?):`,"gi"),Ag=new RegExp(`(^|\\s)(${md.join("|")})\\\\:`,"gi");function qg(t){return String(t||"").replace(Ag,"$1$2:")}function Mg(t){const n=String(t||"");let o=null;nl.lastIndex=0;let s;for(;(s=nl.exec(n))!==null;)s[2]!=="\\"&&(o=s);if(!o)return null;const r=o.index+o[0].length-o[1].length-1;return{field:o[1].toLowerCase(),value:n.slice(o.index+o[0].length),start:r}}function Lg(t,n){return n?String(t||"").slice(0,n.start).replace(/\s+$/,""):t}const _v=5,Dg=50;function Ov(t,n){const o=Mg(t),s=o?Ig(Og(o.field,n,o.value),o.value,Dg):[],r=o&&s.length>0?o:null;return{draft:o,options:s,live:r,freeText:qg(r?Lg(t,r):t)}}const _g=()=>[{value:"yes",label:a("vocab.yesno.yes.label")},{value:"no",label:a("vocab.yesno.no.label")}];function Og(t,n={},o=""){const s=pd(t);if(!s||!s.vocab)return[];if(s.vocab==="yesno")return _g();if(s.vocab==="year"){const i=String(o||"").trim();return/^-?\d{1,4}$/.test(i)?[{value:i,label:i}]:[]}const r=n[s.vocab]||[];return Eg.has(s.vocab)?r.map(i=>({value:String(i.key),label:i.name||i.key})):r.map(i=>({value:i,label:i}))}function Rg(t,n){let o=oi(n,t);for(const s of t.split(/\s+/)){const r=oi(n,s);r<o&&(o=r)}return o}function Ig(t,n,o=8){const s=si(n);if(!s)return t.slice(0,o);const r=Kh(s.length),i=[];for(const l of t){const h=si(l.label);let d=-1,m=0;if(h.startsWith(s)||h.split(/\s+/).some(p=>p.startsWith(s)))d=0;else if(h.includes(s))d=1;else if(r>0){const p=Rg(h,s);p<=r&&(d=2,m=p)}d>=0&&i.push({o:l,rank:d,dist:m})}return i.sort((l,h)=>l.rank-h.rank||l.dist-h.dist),i.slice(0,o).map(l=>l.o)}function Rv(t,n){return{field:t,value:n.value,label:n.label??n.value}}function Iv(t){return`${t.field}:${t.label}`}function Pg(t,n){return t.field===n.field&&t.value===n.value}function Pv(t,n){if(t.some(s=>Pg(s,n)))return t;const o=pd(n.field);return o&&o.exclusive?at(t,n.field,n.value):[...t,n]}function Fv(t,n){return t.filter((o,s)=>s!==n)}function Fg(t=[]){return t.map(n=>[n.field,n.value])}let fd=[];function tn(t){fd=Array.isArray(t)?t:[]}function al(){return fd}const Bg=["tagged","noted","media"];function gd(t=[]){return t.filter(n=>!Bg.includes(n.field))}function ct(t,n){const o=(t||[]).find(s=>s.field===n);return o?o.value:""}function bd(t,n){return(t||[]).filter(o=>o.field===n).map(o=>o.value)}function at(t,n,o){const s=(t||[]).filter(h=>h.field!==n);if(!o)return s;const r=(t||[]).findIndex(h=>h.field===n),i={field:n,value:o,label:o};if(r<0)return[...s,i];const l=[...t||[]].filter(h=>h.field!==n);return l.splice(r,0,i),l}function yd(t,n,o){const s=(o||[]).filter(Boolean),r=(t||[]).findIndex(h=>h.field===n),i=(t||[]).filter(h=>h.field!==n),l=s.map(h=>({field:n,value:h,label:h}));return r<0?[...i,...l]:(i.splice(r,0,...l),i)}function wd(t,n,o){return n?{field:t==="movie"?"movie":"book",value:String(n),label:o||`#${n}`}:null}function Bv({q:t="",scope:n="all",chips:o=[]}={}){const s=new URLSearchParams,r=String(t||"").trim();r&&s.set("q",r),s.set("scope",n);for(const[i,l]of Fg(o))s.append(i,l);return s.toString()}const Hg=120,zg=2e4,$g=8e3,ds=t=>({kind:t.kind,item_id:t.item_id}),Wg=(t,n)=>t.kind===n.kind&&t.item_id===n.item_id,ol={annotation:"book",dialogue:"screen",quote:"utterance"};function vd(){const[t,n]=c.useState(null),[o,s]=c.useState(""),r=c.useCallback(async()=>{const i=await Z("GET","/anthologies");if(!i.ok)return s(le(i,a("error.load.anthologies")));n(i.data.anthologies||[]),s("")},[]);return c.useEffect(()=>{r()},[r]),{rows:t,error:o,reload:r}}const _s=t=>jt(`/anthologies/${t}/export`),sl=[{key:"hide_credit",hide:!0,label:"anthologies.form.fields.credit.label"},{key:"hide_source",hide:!0,label:"anthologies.form.fields.source.label"},{key:"show_locator",hide:!1,label:"anthologies.form.fields.locator.label"},{key:"show_date",hide:!1,label:"anthologies.form.fields.date.label"},{key:"hide_commentary",hide:!0,label:"anthologies.form.fields.commentary.label"},{key:"hide_colour",hide:!0,label:"anthologies.form.fields.colour.label"}],Ug=(t,n)=>t.hide?!n[t.key]:!!n[t.key],Gg=(t,n)=>t.hide?!n:n;function kd({initial:t,onSubmit:n,onCancel:o,submitLabel:s=a("common.action.save.label")}){const[r,i]=c.useState((t==null?void 0:t.title)||""),[l,h]=c.useState((t==null?void 0:t.intro)||""),[d,m]=c.useState(()=>{const v={};for(const g of sl)v[g.key]=!!(t!=null&&t[g.key]);return v}),[p,u]=c.useState(""),[f,b]=c.useState(!1);async function w(v){if(v.preventDefault(),!r.trim())return u(a("error.validate.anthology-title-required"));b(!0);const g=await n({title:r.trim(),intro:l,...d});b(!1),g&&u(g)}return e.jsxs("form",{onSubmit:w,className:"space-y-4",children:[e.jsx(Se,{label:a("common.field.title.label"),value:r,maxLength:Hg,placeholder:a("anthologies.form.title.placeholder"),onChange:v=>i(v.target.value)}),e.jsxs("label",{className:"tp-field",children:[e.jsx(W,{children:a("anthologies.form.intro.label")}),e.jsx("textarea",{className:"tp-input",rows:5,value:l,maxLength:zg,placeholder:a("anthologies.form.intro.placeholder"),onChange:v=>h(v.target.value)})]}),e.jsxs("div",{className:"tp-field",children:[e.jsx(W,{children:a("anthologies.form.fields.label")}),e.jsx("p",{className:"microcopy mt-0.5 mb-2",children:a("anthologies.form.fields.hint")}),e.jsx("div",{className:"space-y-2.5",children:sl.map(v=>e.jsxs("div",{className:"flex items-center justify-between gap-3",children:[e.jsx(W,{children:a(v.label)}),e.jsx(dt,{ariaLabel:a(v.label),value:Ug(v,d)?"on":"off",onChange:g=>m(y=>({...y,[v.key]:Gg(v,g==="on")})),options:[["off",a("common.action.hide.label")],["on",a("common.action.show.label")]]})]},v.key))})]}),e.jsx(ke,{children:p}),e.jsxs("div",{className:"flex items-center justify-end gap-2",children:[e.jsx(ge,{type:"button",onClick:o,children:a("common.action.cancel.label")}),e.jsx("button",{type:"submit",className:"tp-btn tp-btn-primary tactile",disabled:f,children:f?a("common.action.save.busy"):s})]})]})}function Vg({entry:t,onSave:n,onCancel:o}){const[s,r]=c.useState(t.note||""),[i,l]=c.useState(""),[h,d]=c.useState(!1);async function m(){d(!0);const p=await n(t,s);d(!1),p&&l(p)}return e.jsx(Ke,{open:!0,title:a("anthologies.entry.note.title"),onClose:o,children:e.jsxs("div",{className:"space-y-3",children:[e.jsx("p",{className:"microcopy",children:a("anthologies.entry.note.body")}),e.jsxs("label",{className:"tp-field",children:[e.jsx(W,{children:a("common.field.note.label")}),e.jsx("textarea",{className:"tp-input",rows:5,value:s,maxLength:$g,placeholder:a("anthologies.entry.note.placeholder"),onChange:p=>r(p.target.value)})]}),e.jsx(ke,{children:i}),e.jsxs("div",{className:"flex items-center justify-end gap-2",children:[e.jsx(ge,{type:"button",onClick:o,children:a("common.action.cancel.label")}),e.jsx("button",{type:"button",className:"tp-btn tp-btn-primary tactile",disabled:h,onClick:m,children:a(h?"common.action.save.busy":"common.action.save.label")})]})]})})}function xd({anthology:t,onDone:n,onCancel:o}){const[s,r]=c.useState("");async function i(){const l=await Z("DELETE",`/anthologies/${t.id}`);if(!l.ok)return r(le(l,a("error.delete.anthology")));Ee(a("anthologies.toast.deleted")),await n()}return e.jsx(mt,{open:!0,title:a("anthologies.delete.confirm.title",{title:t.title}),confirmLabel:a("common.action.delete.label"),onConfirm:i,onCancel:o,body:e.jsxs("div",{className:"space-y-2",children:[e.jsx("p",{children:a("anthologies.delete.confirm.body",{count:t.entries,n:t.entries,noun:a("unit.entry",{count:t.entries})})}),e.jsx("p",{className:"microcopy",children:a("anthologies.delete.confirm.note")}),e.jsx(ke,{children:s})]})})}function Kg({row:t,onOpen:n,onEdit:o,onDelete:s}){return e.jsxs("div",{className:"board-tile",children:[e.jsxs("button",{type:"button",className:"board-tile-face",onClick:()=>n(t.id),children:[e.jsx("span",{className:"board-tile-name",children:t.title}),e.jsx("span",{className:"board-tile-count",children:a("common.count.phrase",{n:t.entries,noun:a("unit.entry",{count:t.entries})})}),t.intro&&e.jsx("span",{className:"microcopy anthology-tile-intro",children:t.intro})]}),e.jsx("span",{className:"board-tile-tools",children:e.jsx(Fn,{items:[{id:"edit",icon:e.jsx(et,{}),label:a("common.action.edit.label"),onClick:()=>o(t)},{id:"export",icon:e.jsx(st,{}),label:a("common.action.export.label"),onClick:()=>{window.location.href=_s(t.id)}},{id:"delete",icon:e.jsx(ze,{}),label:a("common.action.delete.label"),danger:!0,onClick:()=>s(t)}]})})]})}function Yg({rows:t,reload:n,onOpen:o}){const[s,r]=c.useState(null),[i,l]=c.useState(null),[h,d]=c.useState("");async function m(u){const f=s==="new",b=await Z(f?"POST":"PUT",f?"/anthologies":`/anthologies/${s.id}`,u);return b.ok?(r(null),await n(),null):le(b,a("error.save.anthology"))}const p=(t||[]).length;return Aa({actions:()=>[{id:"h-do",heading:a("common.mono.actions.label")},{id:"new",icon:e.jsx(ht,{}),label:a("anthologies.list.new.label"),onClick:()=>r("new")}]}),e.jsxs("section",{children:[e.jsx(Vn,{title:a("nav.tab.anthologies.label"),counts:a("common.count.phrase",{n:p,noun:a("unit.anthology",{count:p})}),right:e.jsx(ge,{icon:e.jsx(ht,{}),onClick:()=>r("new"),children:a("anthologies.list.new.label")})}),e.jsx(ke,{children:h}),e.jsx("div",{className:"board-grid",children:(t||[]).map(u=>e.jsx(Kg,{row:u,onOpen:o,onEdit:r,onDelete:l},u.id))}),t!=null&&t.length===0&&e.jsx(kt,{className:"mt-4",children:e.jsx("p",{className:"microcopy",children:Pe("anthologies.list.empty",{em1:e.jsx("b",{children:a("anthologies.list.new.label")},"em1"),em2:e.jsx("b",{children:a("common.action.anthology.label")},"em2")})})}),s&&e.jsx(Ke,{open:!0,title:a(s==="new"?"anthologies.form.new.title":"anthologies.form.edit.title"),onClose:()=>r(null),children:e.jsx(kd,{initial:s==="new"?null:s,onSubmit:m,onCancel:()=>r(null),submitLabel:a(s==="new"?"common.action.create.label":"common.action.save.label")})}),i&&e.jsx(xd,{anthology:i,onCancel:()=>l(null),onDone:async()=>{l(null),d(""),await n()}})]})}function rl(t){return[t.locator,Oa(t.quote_kind)].filter(Boolean).join(" · ")}function Qg({entry:t,fields:n={},first:o,last:s,onNote:r,onMove:i,onRemove:l,onOpenBook:h,onOpenMovie:d}){const m=t.work_id&&t.kind==="book"?h:t.work_id&&t.kind==="screen"?d:null;return e.jsx(kt,{className:"mt-3",children:e.jsxs("div",{className:"flex items-start justify-between gap-2",children:[e.jsxs("div",{className:"min-w-0 flex-1",children:[!n.hide_commentary&&t.note&&e.jsx("p",{className:"anthology-prose",children:t.note}),e.jsx("blockquote",{className:"anthology-quote",style:{"--entry-color":n.hide_colour?"var(--line)":jn(t.color)},children:t.quote}),(!n.hide_credit||!n.hide_source)&&e.jsx("p",{className:"microcopy mt-1.5",children:n.hide_source?a("anthologies.entry.credit.label",{credit:t.credit||a("anthologies.entry.unattributed.label")}):n.hide_credit?Pe("anthologies.entry.source.label",{source:m?e.jsx("button",{type:"button",className:"tp-link",onClick:()=>m(t.work_id),children:t.source},"source"):t.source}):Pe(t.source?"anthologies.entry.credit-source.label":"anthologies.entry.credit.label",{credit:t.credit||a("anthologies.entry.unattributed.label"),source:m?e.jsx("button",{type:"button",className:"tp-link",onClick:()=>m(t.work_id),children:t.source},"source"):t.source})}),n.show_locator&&rl(t)||n.show_date&&t.date?e.jsx("p",{className:"microcopy mt-1 opacity-80",children:[n.show_locator?rl(t):"",n.show_date?t.date:""].filter(Boolean).join(" · ")}):null,t.quote_note&&e.jsx("p",{className:"microcopy mt-1 opacity-80",children:t.quote_note})]}),e.jsx(Fn,{ariaLabel:a("anthologies.entry.more.aria"),items:[{id:"note",icon:e.jsx(et,{}),label:a(t.note?"anthologies.entry.note.edit.label":"anthologies.entry.note.add.label"),onClick:()=>r(t)},...o?[]:[{id:"up",icon:e.jsx(jo,{open:!0}),label:a("common.action.move-up.label"),onClick:()=>i(t,"up")}],...s?[]:[{id:"down",icon:e.jsx(jo,{}),label:a("common.action.move-down.label"),onClick:()=>i(t,"down")}],{id:"remove",icon:e.jsx(ze,{}),label:a("common.action.remove.label"),danger:!0,onClick:()=>l(t)}]})]})})}function Zg({id:t,onClose:n,onDeleted:o,onOpenBook:s,onOpenMovie:r}){const[i,l]=c.useState(null),[h,d]=c.useState(null),[m,p]=c.useState(""),[u,f]=c.useState(!1),[b,w]=c.useState(!1),[v,g]=c.useState(null),{practise:y,practiceDialog:k}=Ia(),j=c.useCallback(async()=>{const E=await Z("GET",`/anthologies/${t}`);if(!E.ok)return p(le(E,a("error.open.anthology")));l(E.data.anthology||null),d(E.data.entries||[]),p("")},[t]);c.useEffect(()=>{j()},[j]);async function N(E){const D=await Z("PUT",`/anthologies/${t}`,E);return D.ok?(f(!1),await j(),null):le(D,a("error.save.anthology"))}async function S(E,D){const q=await Z("PUT",`/anthologies/${t}/entries`,{...ds(E),note:D});return q.ok?(g(null),await j(),null):le(q,a("error.save.note"))}async function x(E){const D=await Z("DELETE",`/anthologies/${t}/entries/${E.kind}/${E.item_id}`);if(!D.ok)return p(le(D,a("error.remove.entry")));Ee(a("anthologies.toast.entry-removed")),await j()}async function L(E,D){const q=h||[],C=q.findIndex(V=>Wg(V,E));if(C<0)return;const I=D==="up"?q[C-2]||null:q[C+1];if(D==="up"&&C===0||D==="down"&&!I)return;const O=await Z("POST",`/anthologies/${t}/order`,{...ds(E),after:I?ds(I):null});if(!O.ok)return p(le(O,a("error.move.entry")));await j()}const A=h||[];return Aa({actions:()=>[{id:"h-do",heading:a("common.mono.actions.label")},...i&&A.length>0?[{id:"practise",icon:e.jsx(Ht,{}),label:a("common.action.practise.label"),onClick:()=>y({anthology:t,label:(i==null?void 0:i.title)||a("anthologies.read.title.fallback")})}]:[],...i?[{id:"edit",icon:e.jsx(et,{}),label:a("common.action.edit.label"),onClick:()=>f(!0)}]:[],{id:"export",icon:e.jsx(st,{}),label:a("common.action.export.label"),onClick:()=>{window.location.href=_s(t)}},...i?[{id:"delete",icon:e.jsx(ze,{}),label:a("common.action.delete.label"),onClick:()=>w(!0),danger:!0}]:[]]}),e.jsxs("section",{className:"anthology-read",children:[e.jsx("div",{className:"mb-3",children:e.jsx(ge,{icon:e.jsx($t,{}),onClick:n,children:a("anthologies.read.back.label")})}),e.jsx(Vn,{title:(i==null?void 0:i.title)||a("anthologies.read.title.fallback"),counts:h?a("common.count.phrase",{n:A.length,noun:a("unit.entry",{count:A.length})}):"",right:e.jsxs("span",{className:"flex items-center gap-2",children:[e.jsx(ge,{icon:e.jsx(Ht,{}),onClick:()=>y({anthology:t,label:(i==null?void 0:i.title)||a("anthologies.read.title.fallback")}),disabled:!i||A.length===0,children:a("common.action.practise.label")}),e.jsx(ge,{icon:e.jsx(et,{}),onClick:()=>f(!0),disabled:!i,children:a("common.action.edit.label")}),e.jsx(ge,{icon:e.jsx(st,{}),onClick:()=>{window.location.href=_s(t)},children:a("common.action.export.label")}),e.jsx(ge,{icon:e.jsx(ze,{}),onClick:()=>w(!0),disabled:!i,children:a("common.action.delete.label")})]})}),e.jsx(ke,{children:m}),(i==null?void 0:i.intro)&&e.jsx(kt,{className:"mt-2",children:e.jsx("p",{className:"anthology-prose",children:i.intro})}),A.map((E,D)=>e.jsx(Qg,{entry:E,fields:i||{},first:D===0,last:D===A.length-1,onNote:g,onMove:L,onRemove:x,onOpenBook:s,onOpenMovie:r},`${E.kind}:${E.item_id}`)),h!=null&&A.length===0&&e.jsx(kt,{className:"mt-3",children:e.jsx("p",{className:"microcopy",children:Pe("anthologies.read.empty",{em1:e.jsx("b",{children:a("common.action.anthology.label")},"em1")})})}),u&&i&&e.jsx(Ke,{open:!0,title:a("anthologies.form.edit.title"),onClose:()=>f(!1),children:e.jsx(kd,{initial:i,onSubmit:N,onCancel:()=>f(!1),submitLabel:a("common.action.save.label")})}),v&&e.jsx(Vg,{entry:v,onSave:S,onCancel:()=>g(null)}),k,b&&i&&e.jsx(xd,{anthology:i,onCancel:()=>w(!1),onDone:async()=>{w(!1),await o()}})]})}function Xg({count:t,busy:n,onApply:o,onClose:s}){const{rows:r,error:i}=vd(),l=r||[],[h,d]=c.useState(""),m=h===""?null:Number(h);return e.jsx(Ke,{open:!0,onClose:s,title:a("common.anthology.add.title",{count:t,n:t}),children:e.jsxs("div",{className:"space-y-3",children:[e.jsx("p",{className:"microcopy",children:a("common.anthology.add.body",{count:t,n:t})}),r!=null&&l.length===0?e.jsx(ke,{children:a("common.anthology.add.empty")}):e.jsx(De,{label:a("common.field.anthology.label"),value:h,onChange:d,options:l.map(p=>[String(p.id),p.title]),placeholder:a("common.anthology.add.select.placeholder")}),e.jsx(ke,{children:i}),e.jsx(ge,{icon:e.jsx(Tc,{}),onClick:()=>o(m),disabled:n||m==null,children:a("common.action.add.label")})]})})}function Jg({openId:t=null,onOpen:n,onClose:o,onOpenBook:s,onOpenMovie:r}){const{rows:i,error:l,reload:h}=vd();return t==null?e.jsxs(e.Fragment,{children:[e.jsx(ke,{children:l}),e.jsx(Yg,{rows:i,reload:h,onOpen:n})]}):e.jsx(Zg,{id:t,onClose:o,onDeleted:async()=>{await h(),o==null||o()},onOpenBook:s,onOpenMovie:r},String(t))}const Or=[{name:"English",glyphs:["A","a","E","W"]},{name:"Mandarin",glyphs:["字","文","中","話"]},{name:"Hindi",glyphs:["अ","क","ह","न"]},{name:"Spanish",glyphs:["ñ","Ñ","á","¡"]},{name:"French",glyphs:["É","é","à","ç"]},{name:"Arabic",glyphs:["ع","ض","ا","ق"]},{name:"Bengali",glyphs:["অ","আ","ক","ব"]},{name:"Portuguese",glyphs:["ã","Ã","ç","õ"]},{name:"Russian",glyphs:["Ж","Я","Д","Б"]},{name:"Urdu",glyphs:["ی","ے","ں","ھ"]}].map(t=>({...t,glyph:t.glyphs[0]})),eb=4,il=8,jd=40,zt=t=>String(t||"").trim().toLowerCase(),ro=t=>[...String(t||"")].length,Ja=t=>String(t||"").replace(/[\u0000-\u001F\u007F]/g,"").trim();let At={};function Sd(t){if(typeof t=="string"){const r=Ja(t);return r?{mark:r,customs:[],name:""}:null}if(!t||typeof t!="object"||Array.isArray(t))return null;const n=Ja(t.m),o=Ja(t.n),s=[];for(const r of Array.isArray(t.c)?t.c:[]){const i=Ja(r);if(i&&ro(i)<=il&&!s.includes(i)&&s.push(i),s.length>=eb)break}return!n&&!o&&s.length===0?null:{mark:ro(n)<=il?n:"",customs:s,name:ro(o)<=jd?o:""}}function tb(t){At={};const n=String((t==null?void 0:t.languageMarks)||"").trim();if(n)try{const o=JSON.parse(n);if(o&&typeof o=="object"&&!Array.isArray(o))for(const[s,r]of Object.entries(o)){const i=zt(s),l=Sd(r);i&&l&&(At[i]=l)}}catch{At={}}}const Rr=t=>Or.find(n=>zt(n.name)===t);function Hv(t=[]){const n=new Map;for(const o of Or)n.set(zt(o.name),o.name);for(const o of[...Object.keys(At),...t.map(zt)])o&&!n.has(o)&&n.set(o,o);return[...n.entries()].map(([o,s])=>{const r=At[o]||{mark:"",customs:[],name:""},i=Rr(o);return{key:o,canonical:s,name:r.name||s,renamed:!!r.name,glyph:(i==null?void 0:i.glyph)||"",glyphs:(i==null?void 0:i.glyphs)||[],mark:r.mark,customs:r.customs,added:!i,resolved:r.mark||(i==null?void 0:i.glyph)||""}})}function zv(t){const n={};for(const[o,s]of Object.entries(t||{})){const r=zt(o);if(!r||ro(r)>jd)continue;const i=Sd(typeof s=="string"?s:{m:s==null?void 0:s.mark,c:s==null?void 0:s.customs,n:s==null?void 0:s.name});if(!i)continue;const l={};i.mark&&(l.m=i.mark),i.customs.length&&(l.c=i.customs),i.name&&(!Rr(r)||zt(i.name)!==r)&&(l.n=i.name),Object.keys(l).length&&(n[r]=l)}return Object.keys(n).length?JSON.stringify(n):""}const $v=()=>{const t={};for(const[n,o]of Object.entries(At))t[n]={mark:o.mark,customs:[...o.customs],name:o.name};return t};function Ir(t=[]){const n=Array.isArray(t)?t:[t];for(const o of n){const s=Rr(zt(o));if(s)return s.glyph}return""}function nb(t=[]){var o;const n=Array.isArray(t)?t:[t];for(const s of n){const r=zt(s);if(r&&(o=At[r])!=null&&o.mark)return At[r].mark}return Ir(n)}function ab(t=[]){var o;const n=Array.isArray(t)?t:[t];for(const s of n){const r=zt(s);if(r)return(o=At[r])!=null&&o.name?At[r].name:String(s).trim()}return""}function ob({languages:t,size:n=20,ring:o="var(--card)",className:s=""}){const r=nb(t);if(!r)return null;const i=ab(t);return e.jsx("span",{className:s,title:i,"aria-label":i?a("common.language-mark.aria",{name:i}):void 0,style:{display:"inline-flex",alignItems:"center",justifyContent:"center",width:n,height:n,borderRadius:"50%",background:"var(--raised)",border:"1px solid var(--ink-border)",boxShadow:`0 0 0 1.5px ${o}`,fontSize:Math.round(n*.58),lineHeight:1,verticalAlign:"middle",flex:"none",fontFamily:"var(--font-ui)",fontWeight:"var(--font-ui-weight)",fontStyle:"var(--font-ui-style)",fontVariantCaps:"var(--font-ui-caps)",textTransform:"var(--font-ui-case)",fontVariantNumeric:"var(--font-ui-figures)"},children:r})}const sb=["yellow","blue","pink","orange","green","purple"],rb=[{key:"proverbs",get name(){return a("quotes.starter.proverbs.name")},color:"green",kind:"proverb",get description(){return a("quotes.starter.proverbs.description")}},{key:"speeches",get name(){return a("quotes.starter.speeches.name")},color:"blue",kind:"speech",get description(){return a("quotes.starter.speeches.description")}},{key:"others",get name(){return a("quotes.starter.others.name")},color:"yellow",kind:"plain",get description(){return a("quotes.starter.others.description")}}],Nd="all";function Td(){const[t,n]=c.useState(null),[o,s]=c.useState(0),[r,i]=c.useState(""),l=c.useCallback(async()=>{const h=await Z("GET","/boards");if(!h.ok)return i(le(h));n(h.data.boards||[]),s(h.data.total||0),i("")},[]);return c.useEffect(()=>{l()},[l]),{boards:t,total:o,error:r,reload:l}}function ib({board:t}){const n=t.kind==="proverb"?Ir(t.languages||[]):"",o="board-tile-img is-empty board-cover board-cover-"+(t.kind||"plain");return t.kind==="speech"?e.jsx("span",{className:o,"aria-hidden":"true",children:e.jsxs("svg",{viewBox:"0 0 90 60",className:"board-cover-art",role:"presentation",focusable:"false",children:[e.jsx("rect",{x:"14",y:"12",width:"10",height:"19",rx:"5",fill:"currentColor"}),e.jsx("path",{d:"M9.5 26.5a9.5 9.5 0 0 0 19 0",fill:"none",stroke:"currentColor",strokeWidth:"2.4",strokeLinecap:"round"}),e.jsx("path",{d:"M19 36v9",fill:"none",stroke:"currentColor",strokeWidth:"2.4",strokeLinecap:"round"}),e.jsx("path",{d:"M12.5 45.5h13",fill:"none",stroke:"currentColor",strokeWidth:"2.4",strokeLinecap:"round"}),e.jsxs("g",{fill:"currentColor",opacity:"0.45",children:[e.jsx("circle",{cx:"49",cy:"30",r:"3.6"}),e.jsx("path",{d:"M43 45c0-3.6 2.7-6.3 6-6.3s6 2.7 6 6.3z"}),e.jsx("circle",{cx:"63",cy:"29",r:"3.4"}),e.jsx("path",{d:"M57.4 45c0-3.4 2.5-6 5.6-6s5.6 2.6 5.6 6z"}),e.jsx("circle",{cx:"76",cy:"30",r:"3.2"}),e.jsx("path",{d:"M70.8 45c0-3.2 2.3-5.7 5.2-5.7s5.2 2.5 5.2 5.7z"})]}),e.jsxs("g",{fill:"currentColor",opacity:"0.85",children:[e.jsx("circle",{cx:"56",cy:"38",r:"4.2"}),e.jsx("path",{d:"M49 55c0-4 3.1-7.2 7-7.2s7 3.2 7 7.2z"}),e.jsx("circle",{cx:"70.5",cy:"38.5",r:"4"}),e.jsx("path",{d:"M64 55c0-3.8 2.9-6.8 6.5-6.8s6.5 3 6.5 6.8z"})]})]})}):n?e.jsx("span",{className:o,"aria-hidden":"true",children:e.jsx("span",{className:"board-cover-glyph",children:n})}):e.jsx("span",{className:o,"aria-hidden":"true",children:e.jsx(vc,{})})}function Cd({count:t,busy:n,currentBoardID:o=null,onApply:s,onClose:r}){const{boards:i}=Td(),l=i||[],[h,d]=c.useState(o==null?"":String(o)),m=h===""?null:Number(h);return e.jsx(Ke,{open:!0,onClose:r,title:a("common.board.move.title",{count:t,n:t}),children:e.jsxs("div",{className:"space-y-3",children:[e.jsx("p",{className:"microcopy",children:a("common.board.move.body",{count:t,n:t})}),l.length===0?e.jsx(ke,{children:a("common.board.move.empty")}):e.jsx(De,{label:a("common.field.board.label"),value:h,onChange:d,options:l.map(p=>[String(p.id),p.name]),placeholder:a("common.board.move.select.placeholder")}),e.jsx(ge,{onClick:()=>s(m),disabled:n||m==null||m===o,children:a("common.action.move.label")})]})})}function lb({initial:t,onSubmit:n,onCancel:o,submitLabel:s=a("common.action.save.label"),existingNames:r=[]}){const[i,l]=c.useState((t==null?void 0:t.name)||""),[h,d]=c.useState((t==null?void 0:t.description)||""),[m,p]=c.useState((t==null?void 0:t.color)||"yellow"),[u,f]=c.useState((t==null?void 0:t.image_path)||""),[b,w]=c.useState((t==null?void 0:t.kind)||"plain"),[v,g]=c.useState((t==null?void 0:t.languages)||[]),[y,k]=c.useState(""),[j,N]=c.useState(""),[S,x]=c.useState(!1),L=new Set(r.map(O=>O.trim().toLowerCase())),A=i.trim()!==""&&i.trim().toLowerCase()!==((t==null?void 0:t.name)||"").toLowerCase()&&L.has(i.trim().toLowerCase());function E(O){l(O.name),p(O.color),w(O.kind),d(V=>V.trim()?V:O.description)}function D(O){g(V=>V.some(P=>P.toLowerCase()===O.toLowerCase())?V.filter(P=>P.toLowerCase()!==O.toLowerCase()):[...V,O])}function q(){const O=y.trim();O&&(v.some(V=>V.toLowerCase()===O.toLowerCase())||g([...v,O]),k(""))}async function C(O){var B,_,U;const V=(B=O.target.files)==null?void 0:B[0];if(!V||!(t!=null&&t.id))return;x(!0);const P=new FormData;P.append("file",V);const T=await Fl(`/boards/${t.id}/cover`,P);if(x(!1),!T.ok)return N(le(T,a("error.upload.generic")));f(((_=T.data)==null?void 0:_.image_path)||((U=T.data)==null?void 0:U.path)||u),Ee(a("quotes.board.toast.picture-saved"))}async function I(O){if(O.preventDefault(),!i.trim())return N(a("error.validate.board-name-required"));x(!0);const V=await n({name:i.trim(),description:h,color:m,image_path:u,kind:b,languages:v});x(!1),V&&N(V)}return e.jsxs("form",{onSubmit:I,className:"space-y-4",children:[e.jsx(Se,{label:a("common.field.name.label"),value:i,placeholder:a("quotes.board.form.name.placeholder"),onChange:O=>l(O.target.value)}),A&&e.jsx("p",{className:"microcopy",children:a("quotes.board.form.clash.error")}),e.jsxs("div",{children:[e.jsx(W,{className:"mb-1.5 block",children:a("quotes.board.form.kind.label")}),t!=null&&t.id?e.jsx(dt,{ariaLabel:a("quotes.board.form.kind.aria"),value:b,onChange:w,options:[["plain",a("quotes.board.kind.plain.label")],["proverb",a("quotes.board.kind.proverb.label")]]}):e.jsxs(e.Fragment,{children:[e.jsx("div",{className:"flex flex-wrap items-center gap-2",children:rb.map(O=>e.jsxs("button",{type:"button","aria-pressed":i.trim().toLowerCase()===O.name.toLowerCase(),onClick:()=>E(O),className:"tp-filter-chip tactile"+(i.trim().toLowerCase()===O.name.toLowerCase()?" active":""),children:[O.name,L.has(O.name.toLowerCase())?" ✓":""]},O.key))}),e.jsx("p",{className:"microcopy mt-1.5",children:a("quotes.board.form.starters.hint")})]})]}),b==="proverb"&&e.jsxs("div",{children:[e.jsx(W,{className:"mb-1.5 block",children:a("quotes.board.form.languages.label")}),e.jsx("div",{className:"flex flex-wrap items-center gap-2",children:[...new Set([...Or.map(O=>O.name),...v])].map(O=>{const V=v.some(T=>T.toLowerCase()===O.toLowerCase()),P=Ir([O]);return e.jsxs("button",{type:"button","aria-pressed":V,onClick:()=>D(O),className:"tp-filter-chip tactile"+(V?" active":""),children:[P&&e.jsx("span",{"aria-hidden":"true",style:{marginRight:5,opacity:.75},children:P}),O]},O)})}),e.jsxs("div",{className:"flex items-end gap-2 mt-2",children:[e.jsx(Se,{label:a("quotes.board.form.language.label"),value:y,placeholder:a("quotes.board.form.language.placeholder"),onChange:O=>k(O.target.value),onKeyDown:O=>{O.key==="Enter"&&(O.preventDefault(),q())}}),e.jsx(ge,{type:"button",onClick:q,children:a("common.action.add.label")})]}),e.jsx("p",{className:"microcopy mt-1.5",children:a("quotes.board.form.languages.hint")})]}),e.jsxs("div",{children:[e.jsx(W,{className:"mb-1.5 block",children:a("quotes.board.form.colour.label")}),e.jsx("div",{className:"flex flex-wrap items-center gap-2",children:sb.map(O=>e.jsx("button",{type:"button","aria-label":O,"aria-pressed":m===O,onClick:()=>p(O),className:"board-swatch"+(m===O?" is-on":""),style:{background:jn(O)}},O))})]}),e.jsxs("label",{className:"tp-field",children:[e.jsx(W,{children:a("quotes.board.form.description.label")}),e.jsx("textarea",{className:"tp-input",rows:2,value:h,placeholder:a("quotes.board.form.description.placeholder"),onChange:O=>d(O.target.value)})]}),t!=null&&t.id?e.jsxs("div",{className:"flex items-center gap-3",children:[u?e.jsx("img",{src:Ue(u),alt:"",className:"board-form-img"}):e.jsx("span",{className:"board-form-img is-empty","aria-hidden":"true"}),e.jsxs("label",{className:"tp-btn tp-btn-ghost tactile",style:{cursor:"pointer"},children:[e.jsx(ma,{}),e.jsx("span",{className:"btn-label",children:a("quotes.board.form.picture.label")}),e.jsx("input",{type:"file",accept:"image/*",className:"hidden",onChange:C,disabled:S})]}),u&&e.jsx(ge,{type:"button",onClick:()=>f(""),children:a("common.action.remove.label")})]}):null,e.jsx(ke,{children:j}),e.jsxs("div",{className:"flex items-center justify-end gap-2",children:[e.jsx(ge,{type:"button",onClick:o,children:a("common.action.cancel.label")}),e.jsx("button",{type:"submit",className:"tp-btn tp-btn-primary tactile",disabled:S,children:S?a("common.action.save.busy"):s})]})]})}function cb({board:t,boards:n,onDone:o,onCancel:s}){var u;const r=(n||[]).filter(f=>f.id!==t.id),[i,l]=c.useState((u=r[0])!=null&&u.id?String(r[0].id):""),[h,d]=c.useState(""),m=t.quotes>0;if(m&&r.length===0)return e.jsx(mt,{open:!0,title:a("quotes.board.delete.confirm.title",{name:t.name}),confirmLabel:a("common.action.delete.label"),confirmDisabled:!0,onCancel:s,body:e.jsx("p",{children:a("quotes.board.delete.only.body",{count:t.quotes,n:t.quotes,noun:a("unit.quote",{count:t.quotes})})})});async function p(){const f=m?{move_to:Number(i)}:{},b=await Z("DELETE",`/boards/${t.id}`,f);if(!b.ok)return d(le(b,a("error.delete.board")));Ee(a("quotes.board.toast.deleted")),await o()}return e.jsx(mt,{open:!0,title:a("quotes.board.delete.confirm.title",{name:t.name}),confirmLabel:a("common.action.delete.label"),onConfirm:p,onCancel:s,body:e.jsxs("div",{className:"space-y-3",children:[m?e.jsxs(e.Fragment,{children:[e.jsx("p",{children:a("quotes.board.delete.holds.body",{count:t.quotes,n:t.quotes})}),e.jsx(De,{ariaLabel:a("quotes.board.delete.move.aria"),value:i,onChange:l,options:r.map(f=>[String(f.id),f.name])})]}):e.jsx("p",{children:a("quotes.board.delete.empty.body")}),e.jsx(ke,{children:h})]})})}function db({board:t,onOpen:n,onEdit:o,onDelete:s,onToggleHidden:r}){return e.jsxs("div",{className:"board-tile"+(t.hidden?" is-hidden-board":""),style:{"--board-color":jn(t.color)},children:[e.jsxs("button",{type:"button",className:"board-tile-face",onClick:()=>n(t.id),children:[t.image_path?e.jsx("img",{src:Ue(t.image_path),alt:"",className:"board-tile-img"}):e.jsx(ib,{board:t}),e.jsx("span",{className:"board-tile-name",children:t.name}),e.jsx("span",{className:"board-tile-count",children:a("common.count.phrase",{n:t.quotes,noun:a("unit.quote",{count:t.quotes})})})]}),e.jsx("span",{className:"board-tile-tools",children:e.jsx(Fn,{items:[{icon:e.jsx(et,{}),label:a("common.action.edit.label"),onClick:()=>o(t)},{icon:t.hidden?e.jsx(fm,{}):e.jsx(gm,{}),label:a(t.hidden?"common.action.show.label":"common.action.hide.label"),onClick:()=>r(t)},{icon:e.jsx(ze,{}),label:a("common.action.delete.label"),danger:!0,onClick:()=>s(t)}]})})]})}function hb({boards:t,total:n,reload:o,onOpen:s}){const[r,i]=c.useState(!1),[l,h]=c.useState(null),[d,m]=c.useState(null),[p,u]=c.useState(""),f=(t||[]).filter(g=>r||!g.hidden),b=(t||[]).filter(g=>g.hidden).length;async function w(g){const y=l==="new",k=await Z(y?"POST":"PUT",y?"/boards":`/boards/${l.id}`,g);return k.ok?(h(null),await o(),null):le(k,a("error.save.board"))}async function v(g){const y=await Z("PUT",`/boards/${g.id}`,{name:g.name,description:g.description,color:g.color,image_path:g.image_path,hidden:!g.hidden,kind:g.kind,languages:g.languages});if(!y.ok)return u(le(y));await o()}return e.jsxs("section",{children:[e.jsx(Vn,{title:a("nav.tab.quotes.label"),counts:a("common.count.phrase",{n:(t||[]).length,noun:a("unit.board",{count:(t||[]).length})}),right:e.jsxs("span",{className:"flex items-center gap-2",children:[b>0&&e.jsx(dt,{ariaLabel:a("quotes.board.hidden.aria"),value:r?"on":"off",onChange:g=>i(g==="on"),options:[["off",a("quotes.board.hidden.inuse.label")],["on",a("quotes.board.hidden.all.label",{n:(t||[]).length})]]}),e.jsx(ge,{icon:e.jsx(ht,{}),onClick:()=>h("new"),children:a("quotes.board.new.label")})]})}),e.jsx(ke,{children:p}),e.jsxs("div",{className:"board-grid",children:[e.jsxs("button",{type:"button",className:"board-tile board-tile-all",onClick:()=>s(Nd),children:[e.jsx("span",{className:"board-tile-name",children:a("quotes.board.all.label")}),e.jsx("span",{className:"board-tile-count",children:a("common.count.phrase",{n,noun:a("unit.quote",{count:n})})})]}),f.map(g=>e.jsx(db,{board:g,onOpen:s,onEdit:h,onDelete:m,onToggleHidden:v},g.id))]}),t!=null&&t.length===0&&e.jsx(kt,{className:"mt-4",children:e.jsx("p",{className:"microcopy",children:Pe("quotes.board.list.empty",{em1:e.jsx("b",{children:a("quotes.board.new.label")},"em1")})})}),l&&e.jsx(Ke,{open:!0,title:a(l==="new"?"quotes.board.form.new.title":"quotes.board.form.edit.title"),onClose:()=>h(null),children:e.jsx(lb,{initial:l==="new"?null:l,onSubmit:w,onCancel:()=>h(null),submitLabel:a(l==="new"?"common.action.create.label":"common.action.save.label"),existingNames:(t||[]).map(g=>g.name)})}),d&&e.jsx(cb,{board:d,boards:t,onCancel:()=>m(null),onDone:async()=>{m(null),await o()}})]})}const ub=60,Ed=24;function nn(t,n,o=ub){const[s,r]=c.useState(o),i=c.useRef(null);c.useEffect(()=>{r(o)},[n,o]);const l=s<t;return c.useEffect(()=>{if(!l)return;if(typeof IntersectionObserver!="function"){r(t);return}const h=i.current;if(!h)return;const d=new IntersectionObserver(m=>{m.some(p=>p.isIntersecting)&&r(p=>Math.min(t,p+o))},{rootMargin:"600px"});return d.observe(h),()=>d.disconnect()},[l,t,o]),{count:Math.min(s,t),more:l,sentinel:i}}const pt={book:"reading",movie:"watching",show:"watching",game:"playing"},Rn={book:5,movie:2,show:5,game:3};function Ad(t,n={}){return pt[Wn(t,n)]}function xa(t,n){return n.status===Ad(t,n)}function mb(t,n){return n.status?n.status:(t==="book"?n.annotation_count||0:n.dialogue_count||0)===0?"wishlist":null}function Wn(t,n){if(t==="book")return"book";const o=n.media_type||"movie";return o==="show"?"show":o==="game"?"game":"movie"}function qd(t){return a(t==="game"?"common.field.studio.label":t==="show"?"common.field.creator.label":"common.field.director.label")}function pb(t){return a(t==="game"?"common.badge.studio":t==="show"?"common.badge.created-by":"common.badge.director")}function fb(t){return t==="game"?"studio":"director"}function gb(t){return t?Math.floor(t/10)*10:null}function Pr(t,n,o={}){const{credit:s=()=>"",year:r=()=>null,genres:i=()=>[],series:l=g=>g.series,facet:h=()=>"",splitCredit:d=!1,seps:m,creditResidual:p=a("common.group.unknown-credit.label"),facetResidual:u=()=>a("common.group.none.label"),sortMembers:f}=o,b=new Map,w=(g,y,k,j={})=>{let N=b.get(g);N||(N={key:g,label:y,items:[],residual:!!j.residual,order:j.order},b.set(g,N)),N.items.push(k)};for(const g of t)if(n==="series"){const y=l(g);y?w(y,y,g):w("~none",a("common.group.no-series.label"),g,{residual:!0})}else if(n==="author"){const y=s(g),k=d?tt(y,m):y?[y]:[];k.length?k.forEach(j=>w(j,j,g)):w("~none",p,g,{residual:!0})}else if(n==="decade"){const y=gb(r(g));y!=null?w(String(y),a("common.group.decade.label",{year:y}),g,{order:y}):w("~none",a("common.group.unknown-year.label"),g,{residual:!0})}else if(n==="genre"){const y=i(g);y.length?y.forEach(k=>w(k,k,g)):w("~none",a("common.group.no-genre.label"),g,{residual:!0})}else{const y=h(g,n);y?w(y,y,g):w("~none",u(n),g,{residual:!0})}const v=[...b.values()];if(v.sort((g,y)=>g.residual!==y.residual?g.residual?1:-1:n==="decade"?(y.order??0)-(g.order??0):n==="genre"&&y.items.length-g.items.length||g.label.localeCompare(y.label)),f)for(const g of v)g.residual||(g.items=f(g.items,n));return v}function Md(t,n,o){return n==="wishlist"?t.filter(s=>o(s)===0):n==="annotated"?t.filter(s=>o(s)>0):t}function Ld(t,n){const o=t.filter(s=>xa(n,s));return o.length===0||o.length===t.length?t:[...o,...t.filter(s=>!xa(n,s))]}function Dd(t,n){return!n||n.length===0?t:t.filter(o=>n.includes(o.status||"none"))}function _d({open:t,items:n,cap:o,noun:s,nounPlural:r=`${s}s`,verb:i,pastLabel:l,onRelease:h,onProceed:d,onCancel:m,busyId:p,error:u}){return e.jsx(mt,{open:t,title:a("common.work.cap.confirm.title",{verb:i,n:n.length}),confirmLabel:a("common.work.cap.confirm.action.label"),onCancel:m,onConfirm:d,body:e.jsxs(e.Fragment,{children:[e.jsx("p",{children:a("common.work.cap.confirm.body",{n:o,count:o,noun:o===1?s:r})}),e.jsx("ul",{className:"mt-3 space-y-1",children:n.map(f=>e.jsxs("li",{className:"flex items-center gap-3",children:[e.jsxs("span",{className:"min-w-0 flex-1",children:[e.jsx("span",{className:"block truncate",style:{color:"var(--ink)"},children:f.title}),f.meta&&e.jsx("span",{className:"block truncate",style:{fontSize:"var(--type-ui-13)",color:"var(--faint)"},children:f.meta})]}),e.jsx("button",{type:"button",className:"tp-chip tp-chip-btn shrink-0",disabled:p===f.id,onClick:()=>h(f),children:p===f.id?a("common.action.save.busy"):l})]},f.id))}),e.jsx(ke,{children:u})]})})}function Od({open:t,title:n,label:o,value:s,onChange:r,onConfirm:i,onCancel:l,confirmLabel:h,error:d}){return e.jsx(mt,{open:t,title:n,confirmLabel:h||a("common.action.save.label"),onCancel:l,onConfirm:i,body:e.jsxs(e.Fragment,{children:[e.jsx(ya,{label:o,value:s,onChange:r,hint:a("common.work.shelf-date.hint")}),e.jsx(ke,{children:d})]})})}function bb(t,n={}){return t==="book"?"page":(n.media_type||"movie")==="show"?"episode":""}function ll(t,n){const o=Math.max(2,String(n).length);return`${String(t).padStart(o,"0")}/${String(n).padStart(o,"0")}`}function yb(t){if(!t||!t.pos_unit||!t.pos_total)return"";if(t.pos_unit==="episode"){const n=a("common.position.episode.label",{a:ll(t.pos||0,t.pos_total)});return t.season_total?a("common.position.episode-season.label",{a:n,b:ll(t.season||1,t.season_total)}):n}return a("common.position.page.label",{a:t.pos||0,b:t.pos_total})}function wb({kind:t,status:n,progress:o=0,pos:s}){const r=yb(s);return e.jsxs("span",{style:{display:"block",minWidth:168,maxWidth:260},children:[e.jsx(tr,{state:n,kind:t,progress:o,radius:3}),e.jsx("span",{style:{display:"block",marginTop:3,fontFamily:"var(--font-mono)",fontWeight:"var(--font-mono-weight)",fontStyle:"var(--font-mono-style)",fontVariantCaps:"var(--font-mono-caps)",textTransform:"var(--font-mono-case)",fontVariantNumeric:"var(--font-mono-figures)",fontSize:"var(--type-mono-11)",letterSpacing:".06em",color:"var(--faint)"},children:r||`${o}%`})]})}function vb({kind:t,unit:n,status:o,progress:s,pos:r,busy:i,onSave:l}){const h=(r==null?void 0:r.pos_unit)===n&&n!=="",[d,m]=c.useState(h?"unit":"pct"),[p,u]=c.useState(String(s||0)),[f,b]=c.useState(String((r==null?void 0:r.pos)||"")),[w,v]=c.useState(String((r==null?void 0:r.pos_total)||"")),[g,y]=c.useState(String((r==null?void 0:r.season)||"")),[k,j]=c.useState(String((r==null?void 0:r.season_total)||"")),N=q=>Math.max(0,Number(q||0)),S=(q,C=5)=>q.replace(/\D/g,"").slice(0,C),x=n==="episode",L=d==="unit"&&N(f)>0&&N(w)===0,A=d==="unit"&&N(w)>0?Math.round((x&&N(k)>0?(Math.max(1,N(g))-1+N(f)/N(w))/N(k):N(f)/N(w))*100):Math.min(100,N(p)),E=()=>{if(d==="pct")return l({progress:Math.min(100,N(p))});L||l({pos_unit:n,pos:N(f),pos_total:N(w),...x?{season:N(g),season_total:N(k)}:{}})},D=(q,C,I,O)=>e.jsxs("label",{style:{display:"inline-flex",alignItems:"center",gap:5},children:[e.jsx("span",{style:{fontSize:"var(--type-ui-13)",color:"var(--soft)"},children:q}),e.jsx("input",{className:"tp-input",inputMode:"numeric",style:{width:58},"aria-label":q,value:C,onChange:V=>I(S(V.target.value,O))})]});return e.jsxs("div",{style:{padding:"4px 6px 8px"},children:[e.jsx(W,{className:"mb-1.5 block",children:a("common.progress.editor.title")}),n!==""&&e.jsx("div",{className:"mb-2",children:e.jsx(dt,{ariaLabel:a("common.progress.unit.aria"),value:d,onChange:m,options:[["pct",a("common.progress.unit.percent.label")],["unit",a(x?"common.progress.unit.episodes.label":"common.progress.unit.pages.label")]]})}),d==="pct"?e.jsx("div",{className:"flex items-center gap-2",children:D(a("common.progress.unit.percent.label"),p,u,3)}):e.jsxs("div",{className:"flex flex-wrap items-center gap-x-3 gap-y-2",children:[x&&D(a("common.progress.field.season.label"),g,y,3),x&&D(a("common.progress.field.of.label"),k,j,3),D(a(x?"common.progress.field.episode.label":"common.progress.field.page.label"),f,b,5),D(a("common.progress.field.of.label"),w,v,5)]}),L&&e.jsx("span",{style:{display:"block",marginTop:5,fontSize:"var(--type-ui-12)",color:"var(--error)"},children:a(x?"error.validate.episodes-total":"error.validate.pages-total")}),e.jsxs("div",{className:"mt-2 flex items-center gap-2",children:[e.jsx("span",{className:"flex-1",children:e.jsx(tr,{state:o,kind:t,progress:A,radius:3})}),e.jsxs("span",{style:{fontFamily:"var(--font-mono)",fontWeight:"var(--font-mono-weight)",fontStyle:"var(--font-mono-style)",fontVariantCaps:"var(--font-mono-caps)",textTransform:"var(--font-mono-case)",fontVariantNumeric:"var(--font-mono-figures)",fontSize:"var(--type-mono-11)",color:"var(--faint)"},children:[A,"%"]}),e.jsx("button",{type:"button",className:"tp-chip tp-chip-btn",disabled:i||L,onClick:E,children:a("common.action.set.label")})]})]})}function kb({kind:t,workId:n,reads:o=[],onChanged:s}){const[r,i]=c.useState(null),[l,h]=c.useState(!1),[d,m]=c.useState(""),p=t==="movie"?"movies":"books";async function u(f,b,w){h(!0),m("");const v=await Z(f,b,w);return h(!1),v.ok?(i(null),s==null||s(),!0):(m(le(v,a(t==="movie"?"error.save.watch":"error.save.read"))),!1)}return e.jsxs("div",{className:"read-log-wrap",children:[e.jsx("ul",{className:"read-log",children:o.map((f,b)=>e.jsxs("li",{children:[e.jsx("span",{className:"read-n",children:b+1}),r===f.id?e.jsx(cl,{initial:f,busy:l,onCancel:()=>i(null),onSave:w=>u("PUT",`/reads/${f.id}`,w),onDelete:()=>u("DELETE",`/reads/${f.id}`)}):e.jsxs(e.Fragment,{children:[e.jsxs("span",{children:[f.outcome==="open"?a("common.read-log.range.open.label",{a:un(f.started_at)||a("common.read-log.unknown.label")}):a("common.read-log.range.label",{a:un(f.started_at)||a("common.read-log.unknown.label"),b:un(f.finished_at)||a("common.read-log.unknown.label")}),f.outcome==="abandoned"&&e.jsx("span",{className:"read-open",children:a("common.read-log.abandoned.label")})]}),f.outcome==="open"?e.jsx("span",{className:"read-hint",children:a("common.read-log.open.hint")}):e.jsx("button",{type:"button",className:"read-edit",onClick:()=>i(f.id),children:a("common.read-log.edit.label")})]})]},f.id??b))}),r==="new"?e.jsx(cl,{initial:{started_at:"",finished_at:"",outcome:"finished"},busy:l,onCancel:()=>i(null),onSave:f=>u("POST",`/${p}/${n}/reads`,f)}):e.jsx("button",{type:"button",className:"read-add",onClick:()=>i("new"),children:a(t==="movie"?"common.read-log.add.film.label":"common.read-log.add.book.label")}),d&&e.jsx("p",{className:"tp-error",children:d})]})}function cl({initial:t,busy:n,onCancel:o,onSave:s,onDelete:r}){const[i,l]=c.useState(t.started_at||""),[h,d]=c.useState(t.finished_at||""),[m,p]=c.useState(t.outcome==="abandoned"?"abandoned":"finished");return e.jsxs("span",{className:"read-form",children:[e.jsx("input",{className:"tp-input read-date",value:i,onChange:u=>l(u.target.value),placeholder:a("common.read-log.started.placeholder"),"aria-label":a("common.field.started.label")}),e.jsx("input",{className:"tp-input read-date",value:h,onChange:u=>d(u.target.value),placeholder:a("common.read-log.finished.placeholder"),"aria-label":a("common.field.finished.label")}),e.jsxs("select",{className:"tp-input read-outcome",value:m,onChange:u=>p(u.target.value),"aria-label":a("common.field.outcome.label"),children:[e.jsx("option",{value:"finished",children:a("common.read-log.outcome.finished.label")}),e.jsx("option",{value:"abandoned",children:a("common.read-log.outcome.abandoned.label")})]}),e.jsx("button",{type:"button",className:"read-edit",disabled:n,onClick:()=>s({started_at:i.trim(),finished_at:h.trim(),outcome:m}),children:a("common.read-log.save.label")}),e.jsx("button",{type:"button",className:"read-edit",disabled:n,onClick:o,children:a("common.read-log.cancel.label")}),r&&e.jsx("button",{type:"button",className:"read-edit read-danger",disabled:n,onClick:r,children:a("common.read-log.delete.label")})]})}function Rd({kind:t,item:n={},status:o,progress:s=0,pos:r,reads:i=[],wishlist:l,onSelect:h,onProgress:d,onReadsChanged:m,busy:p}){const u=Ad(t,n),f=bb(t,n),b=o==="completed"?[u,""]:[u,"paused","abandoned","completed",""].filter(g=>g!==o),w=i.filter(g=>g.outcome==="finished").length,v=o||(l?"wishlist":null);return v?v==="wishlist"?e.jsx(Va,{state:"wishlist",label:a("common.shelf.wishlist.book.label"),tip:a("common.shelf.wishlist.tip"),children:g=>e.jsxs(e.Fragment,{children:[e.jsx("p",{style:{padding:"4px 6px 8px",fontSize:"var(--type-ui-13)",lineHeight:1.5,color:"var(--soft)"},children:a("common.shelf.wishlist.explainer.prose")}),hs(t,n,o,b,p,g,h)]})}):e.jsxs(e.Fragment,{children:[e.jsx(Va,{state:v,label:It(v,t),tip:a("common.shelf.change.tip"),children:g=>e.jsxs(e.Fragment,{children:[o===u&&e.jsx(vb,{kind:t,unit:f,status:o,progress:s,pos:r,busy:p,onSave:d}),hs(t,n,o,b,p,g,h)]})}),e.jsx(Va,{state:v,label:a("common.shelf.reads.label",{n:w}),tip:a("common.shelf.read-log.tip"),children:e.jsx(kb,{kind:t,workId:n.id,reads:i,onChanged:m})}),(o===u||o==="paused")&&e.jsx("span",{className:"shelf-track",children:e.jsx(wb,{kind:t,status:o,progress:s,pos:r})})]}):e.jsx(Va,{state:"",label:a("common.shelf.shelve.label"),children:g=>hs(t,n,o,b,p,g,h)})}function hs(t,n,o,s,r,i,l){return s.map(h=>e.jsxs("button",{type:"button",role:"menuitem",className:"menu-item",disabled:r,onClick:()=>{i(),l(h)},children:[e.jsx("span",{"aria-hidden":"true",style:{width:8,height:8,borderRadius:2,flex:"none",background:h?vt[h].color:"transparent",border:h?"none":"1px solid var(--line)"}}),pn(t,o,h,n)]},h||"none"))}function pn(t,n,o,s={}){const r=Wn(t,s),i=r==="book";switch(o){case"playing":return a(n==="completed"?"common.shelf.move.playing.again.label":n==="paused"?"common.shelf.move.playing.resume.label":"common.shelf.move.playing.start.label");case"reading":case"watching":return a(n==="completed"?i?"common.shelf.move.reading.again.book.label":"common.shelf.move.reading.again.film.label":n==="paused"?i?"common.shelf.move.reading.resume.book.label":"common.shelf.move.reading.resume.film.label":i?"common.shelf.move.reading.start.book.label":"common.shelf.move.reading.start.film.label");case"paused":return a("common.shelf.move.paused.label");case"abandoned":return a("common.shelf.move.abandoned.label");case"completed":return a(r==="game"?"common.shelf.move.completed.played.label":i?"common.shelf.move.completed.book.label":"common.shelf.move.completed.film.label");default:return a("common.shelf.move.clear.label")}}function Fr(t,{fav:n,color:o,tag:s}={}){return!!(n&&"favorite"in t||o&&"color"in t||s&&"tags"in t)}function Br({open:t,kind:n,title:o,count:s=0,onConfirm:r,onCancel:i}){const[l,h]=c.useState(""),d=Sr(n,1);return c.useEffect(()=>{t&&h("")},[t]),e.jsx(mt,{open:t,title:a("common.work.delete.confirm.title",{title:o||""}),body:e.jsxs("div",{className:"space-y-2",children:[e.jsx("p",{className:"microcopy",children:s>0?a("common.work.delete.confirm.body",{count:s,n:s}):a("common.work.delete.confirm.body.empty")}),e.jsx("p",{className:"microcopy",children:Pe("common.work.delete.confirm.phrase",{phrase:e.jsx("b",{children:d},"phrase")})}),e.jsx("input",{className:"tp-input",autoFocus:!0,value:l,placeholder:d,"aria-label":a("common.selection.delete.confirm.phrase.aria"),onChange:m=>h(m.target.value)})]}),confirmLabel:a("common.work.delete.confirm.action.label"),confirmDisabled:l.trim().toLowerCase()!==d,onConfirm:r,onCancel:i})}function Hr({kind:t,item:n,index:o=0,onOpen:s,people:r={},seps:i,selection:l,selectKind:h=t,onChanged:d,onEdit:m}){const p=t==="book",u=!p&&(n.media_type||"movie")==="show",f=p?n.author:n.director,b=p?n.cover_path:n.poster_path,w=p?n.published_year:n.release_year,v=p?n.annotation_count||0:n.dialogue_count||0,g=mb(t,n),y=b?e.jsx("img",{src:Ue(b),alt:a(p?"common.cover.alt":"common.poster.alt",{title:n.title}),loading:"lazy",decoding:"async",className:"block aspect-[2/3] w-full object-cover"}):e.jsx(Bt,{kind:a(p?"common.badge.cover":"common.badge.poster"),className:p?"w-full rounded-none border-0":"w-full"}),k=!!(l!=null&&l.isSelected(n.id)),j=Bc({kind:t,ids:[n.id],onDone:d}),[N,S]=c.useState(!1),{practise:x,practiceDialog:L}=Ia(),A=Ha(t,n,{fillGaps:d?()=>j.fillGaps():void 0,setReview:d?(P,T)=>j.post({review:T},T?a("common.selection.toast.back-in-quiz"):a("common.selection.toast.skipping",{n:1,count:1})):void 0,excluded:!!n.review_excluded,edit:m?()=>m(n.id):void 0,remove:d?()=>S(!0):void 0,practise:()=>x({[t==="book"?"book":"movie"]:n.id,label:n.title})}),E=[...Dr(l,n.id,h),...A.map(P=>({...P,onClick:P.run}))],{cardProps:D,menuClass:q,menu:C}=Uo(E,l?{onLongPress:()=>l.toggle(n.id,h)}:void 0),I=P=>{var B;if((B=D.onClickCapture)!=null&&B.call(D,P))return;if(!l)return s(n.id);const T=Lr(P,l);if(T==="open")return s(n.id);P.preventDefault(),T==="extend"?l.extendTo(n.id,h):l.toggle(n.id,h)},O=e.jsxs("button",{type:"button",onClick:I,className:`cover-tile block w-full text-left ${q}`,title:n.title,...D,onClickCapture:void 0,children:[e.jsxs(Je,{variant:o%4,className:`relative overflow-hidden cover-lift${k?" is-picked":""}`,children:[y,g&&e.jsx(tr,{state:g,kind:t,progress:n.progress}),u&&e.jsx("span",{className:"tp-chip tp-scrim-deep absolute left-1.5 top-1.5",style:{fontSize:"var(--type-ui-9)",color:"var(--on-scrim)",borderColor:"transparent"},children:"SHOW"}),xa(t,n)&&e.jsx(Uu,{kind:Wn(t,n),stacked:u}),n.favorite&&e.jsx($u,{})]}),e.jsx("p",{className:"mt-2.5 truncate",style:{fontFamily:"var(--font-display)",fontStyle:"var(--font-display-style)",fontVariantCaps:"var(--font-display-caps)",textTransform:"var(--font-display-case)",fontVariantNumeric:"var(--font-display-figures)",fontWeight:600,fontSize:"var(--type-display-15)",color:"var(--ink)"},children:n.title}),e.jsxs("div",{className:"flex items-center gap-1.5",children:[e.jsx(Pa,{names:tt(f,i),map:r,size:24,ring:"var(--bg)"}),e.jsx("p",{className:"min-w-0 truncate text-[13px]",style:{color:"var(--soft)"},children:[f,w||null].filter(Boolean).join(" · ")||" "})]}),n.series&&e.jsx("p",{className:"truncate text-[12px]",style:{color:"var(--faint)",fontStyle:"italic"},children:lr(n)}),e.jsxs("div",{className:"mt-0.5 flex items-center gap-2",children:[p?e.jsx(W,{style:{color:"var(--accent-ui)"},children:a("common.work-card.count.quote",{count:v,n:v})}):e.jsx("span",{style:{fontFamily:"var(--font-mono)",fontWeight:"var(--font-mono-weight)",fontStyle:"var(--font-mono-style)",fontVariantCaps:"var(--font-mono-caps)",textTransform:"var(--font-mono-case)",fontVariantNumeric:"var(--font-mono-figures)",fontSize:"var(--type-mono-12)",color:"var(--amber)"},children:a("common.work-card.count.dialogue",{count:v,n:v})}),e.jsx(rr,{item:n,quiet:!0})]})]}),V=e.jsx(Br,{open:N,kind:t,title:n.title,count:v,onConfirm:()=>{S(!1),j.remove()},onCancel:()=>S(!1)});return l?e.jsxs("div",{className:`work-tile${l.active?" is-selecting":""}`,children:[O,e.jsx(gr,{picked:k,label:p?"this book":u?"this show":"this film",onChange:()=>l.toggle(n.id,h)}),C,V,L]}):e.jsxs(e.Fragment,{children:[O,C,V,L]})}const xb={1:["span 2 / span 2"],2:["span 2 / span 1","span 2 / span 1"],3:["span 2 / span 1","span 1 / span 1","span 1 / span 1"]};function jb({kind:t="book",items:n=[],onOpen:o}){const s=t==="book",r=n.length,i=n.slice(0,4).map(h=>s?h.cover_path:h.poster_path),l=xb[i.length]||[];return e.jsxs("button",{type:"button",onClick:o,className:"cover-tile block w-full text-left",title:a("common.wishlist-folder.tip",{n:r}),children:[e.jsxs(Je,{variant:0,className:"relative overflow-hidden cover-lift",children:[e.jsx("span",{className:"wish-collage","aria-hidden":"true",children:i.map((h,d)=>e.jsx("span",{className:"wish-cell",style:{gridArea:l[d]},children:h?e.jsx("img",{src:Ue(h),alt:""}):null},d))}),e.jsx("span",{className:"wish-folder-tag tp-scrim-deep",children:a("common.shelf.wishlist.book.label")})]}),e.jsx("p",{className:"mt-2.5 truncate",style:{fontFamily:"var(--font-display)",fontStyle:"var(--font-display-style)",fontVariantCaps:"var(--font-display-caps)",textTransform:"var(--font-display-case)",fontVariantNumeric:"var(--font-display-figures)",fontWeight:600,fontSize:"var(--type-display-15)",color:"var(--ink)"},children:a("common.shelf.wishlist.book.label")}),e.jsx("div",{className:"flex items-center gap-1.5",children:e.jsx("p",{className:"min-w-0 truncate text-[13px]",style:{color:"var(--soft)"},children:a("common.wishlist-folder.subtitle.label")})}),e.jsx("div",{className:"mt-0.5 flex items-center gap-2",children:s?e.jsx(W,{style:{color:"var(--accent-ui)"},children:a("common.count.phrase",{n:r,noun:a("unit.book",{count:r})})}):e.jsx("span",{style:{fontFamily:"var(--font-mono)",fontWeight:"var(--font-mono-weight)",fontStyle:"var(--font-mono-style)",fontVariantCaps:"var(--font-mono-caps)",textTransform:"var(--font-mono-case)",fontVariantNumeric:"var(--font-mono-figures)",fontSize:"var(--type-mono-12)",color:"var(--amber)"},children:a("common.count.phrase",{n:r,noun:a("unit.title",{count:r})})})})]})}function zr({label:t,count:n,noun:o,nounPlural:s,person:r,onOpenPerson:i}){const l=o||a("unit.item.one"),h=s||(o?`${o}s`:a("unit.item.other"));return e.jsxs("div",{className:"mb-4 flex items-center gap-3",children:[r&&e.jsx(_a,{person:r,size:34}),i?e.jsx(ye,{label:a("common.person.open.tip"),className:"min-w-0",children:e.jsx("button",{type:"button",className:"display-title truncate",style:{fontSize:"var(--type-ui-19)",background:"none",border:"none",padding:0,cursor:"pointer",textAlign:"left"},onClick:i,children:t})}):e.jsx("h3",{className:"display-title truncate",style:{fontSize:"var(--type-ui-19)"},children:t}),e.jsx(W,{style:{color:"var(--accent-ui)"},children:a("common.count.phrase",{n,noun:n===1?l:h})}),e.jsx("span",{className:"h-px flex-1",style:{background:"var(--line)"}})]})}function Id(t=[]){let n=0,o=0,s=0;for(const r of t)r.favorite&&n++,(r.note||"").trim()&&o++,(r.tags||[]).length>0&&s++;return{total:t.length,favourites:n,noted:o,tagged:s}}function Sb(t,n){if(!t)return t;const o=(s,r)=>Math.max(0,s-(r?1:0));return{total:Math.max(0,t.total-1),favourites:o(t.favourites,n==null?void 0:n.favorite),noted:o(t.noted,((n==null?void 0:n.note)||"").trim()),tagged:o(t.tagged,((n==null?void 0:n.tags)||[]).length>0)}}function Pd({counts:t,noun:n,tone:o="accent"}){if(!t)return null;const s=n||[a("unit.quote.one"),a("unit.quote.other")],{total:r=0,favourites:i=0,noted:l=0,tagged:h=0}=t,d=[r===0?a("common.hero.counts.empty.label",{noun:s[1]}):a("common.count.phrase",{n:r,noun:r===1?s[0]:s[1]}),i>0&&a("common.hero.counts.favourites",{count:i,n:i}),l>0&&a("common.hero.counts.noted.label",{n:l}),h>0&&a("common.hero.counts.tagged.label",{n:h})].filter(Boolean);return e.jsx("div",{className:`hero-counts${o==="amber"?" hero-counts-amber":""}`,children:d.map((m,p)=>e.jsxs("span",{children:[p>0&&e.jsx("span",{"aria-hidden":"true",className:"hero-counts-sep",children:"·"}),e.jsx("span",{className:p===0?"hero-counts-total":void 0,children:m})]},p))})}function Fd({cover:t,shadow:n="drop-shadow(0 12px 22px rgba(0,0,0,.4))",title:o,titleSize:s="var(--type-display-26)",titleStyle:r,meta:i,counts:l,favorite:h,onFavorite:d,tags:m,genres:p=[],description:u,actions:f}){return Ie()?e.jsxs("div",{className:"work-hero-m",children:[e.jsxs("div",{className:"work-hero-m-top",children:[e.jsx("div",{className:"work-hero-m-cover",children:t}),e.jsxs("div",{className:"min-w-0 flex-1",children:[e.jsx("h1",{className:"display-title",style:{fontSize:"var(--type-ui-22)",lineHeight:1.2,...r},children:o}),i&&e.jsx("div",{className:"mt-1.5",children:i}),l&&e.jsx("div",{className:"mt-1.5",children:l})]})]}),(m||d)&&e.jsxs("div",{className:"work-hero-m-shelf",children:[e.jsx(Pn,{value:!!h,onChange:d}),m]}),p.length>0&&e.jsx("div",{className:"flex flex-wrap gap-1.5",children:p.map(w=>e.jsx("span",{className:"tp-chip",children:w},w))}),e.jsx(js,{text:u}),f&&e.jsx("div",{className:"flex flex-wrap gap-2",children:f})]}):e.jsxs("div",{style:{display:"flow-root"},children:[f&&e.jsx("div",{className:"flex flex-wrap justify-end gap-2",style:{float:"right",marginLeft:20,marginBottom:10},children:f}),e.jsx("div",{className:"w-36 sm:w-44",style:{float:"left",marginRight:24,marginBottom:14,filter:n},children:t}),e.jsx("h1",{className:"display-title",style:{fontSize:s,...r},children:o}),i&&e.jsx("div",{className:"mt-2.5",children:i}),l&&e.jsx("div",{className:"mt-2",children:l}),e.jsxs("div",{className:"mt-2.5 flex flex-wrap items-center gap-3",children:[e.jsx(Pn,{value:!!h,onChange:d}),m]}),p.length>0&&e.jsx("div",{className:"mt-2.5 flex flex-wrap gap-1.5",children:p.map(w=>e.jsx("span",{className:"tp-chip",children:w},w))}),e.jsx("div",{className:"mt-2.5",children:e.jsx(js,{text:u})})]})}function $r({mobile:t,title:n,counts:o,error:s,onBack:r,onExport:i,headerAside:l,loaded:h,hasItems:d,shownCount:m,emptyText:p,noMatchText:u,genres:f=[],genre:b,setGenre:w,fav:v,setFav:g,tagged:y,setTagged:k,noted:j,setNoted:N,wish:S,setWish:x,states:L=[],setStates:A,kind:E="book",activeStates:D=[pt[E]],noun:q=a("unit.book.one"),nounPlural:C=q===a("unit.book.one")?a("unit.book.other"):`${q}s`,seriesNoun:I=a("common.filters.series.noun.one"),seriesNounPlural:O=I===a("common.filters.series.noun.one")?a("common.filters.series.noun.other"):`${I}s`,seriesNames:V=[],series:P,setSeries:T,creditNames:B=[],credit:_,setCredit:U,creditNoun:F=a("common.filters.credit.noun.one"),creditNounPlural:X=F===a("common.filters.credit.noun.one")?a("common.filters.credit.noun.other"):`${F}s`,sort:R,setSort:G,sortOptions:K=[],leading:M,trailing:Q,leadingMobile:z,trailingMobile:te,onReset:J,children:fe,exportDialog:me,extraModals:H}){const[ee,oe]=c.useState(!1),[pe,de]=c.useState(!1),se=!!w,Y=!!x,ce=!!A,Te=!!T&&(V||[]).length>0,Le=!!U&&(B||[]).length>0,Fe=!!G&&(K||[]).length>0,_e=e.jsxs(e.Fragment,{children:[g&&e.jsx(ye,{label:a("common.filters.favourites.tip"),children:e.jsx("button",{onClick:()=>g(!v),className:ut(v),children:a("common.filters.favourites.label")})}),k&&e.jsx(ye,{label:a("common.filters.tagged.tip",{noun:C}),children:e.jsx("button",{onClick:()=>k(!y),className:ut(y),children:a("common.filters.tagged.label")})}),N&&e.jsx(ye,{label:a("common.filters.noted.tip",{noun:C}),children:e.jsx("button",{onClick:()=>N(!j),className:ut(j),children:a("common.filters.noted.label")})})]}),ne=[["",a("common.filters.wish.all.label"),a("common.filters.wish.all.tip",{noun:q})],["wishlist",a("common.filters.wish.only.label"),a("common.filters.wish.only.tip",{noun:C})],["annotated",a("common.filters.wish.annotated.label"),a("common.filters.wish.annotated.tip",{noun:C})]].map(([be,ie,je])=>e.jsx(ye,{label:je,children:e.jsx("button",{className:ut(S===be),onClick:()=>x(be),children:ie})},be||"all")),he=e.jsx(Hu,{ariaLabel:a("common.filters.shelf.aria"),allLabel:a("common.filters.shelf.all.label"),values:L,onChange:A,options:[...D.map(be=>[be,It(be,E),vt[be].color]),["paused",a(vt.paused.book),vt.paused.color],["abandoned",a(vt.abandoned.book),vt.abandoned.color],["completed",a(vt.completed.book),vt.completed.color],["none",a("common.filters.shelf.none.label"),"transparent"]]}),qe=Te&&e.jsx(De,{ariaLabel:a("common.filters.by.aria",{field:I}),value:P,onChange:T,options:[["",a("common.filters.all.label",{field:O})],...V.map(be=>[be,be])]}),Ne=Le&&e.jsx(De,{ariaLabel:a("common.filters.by.aria",{field:F}),value:_,onChange:U,options:[["",a("common.filters.all.label",{field:X})],...B.map(be=>[be,be])]}),ae=Fe&&e.jsx(De,{ariaLabel:a("common.filters.sort.aria"),value:R,onChange:G,options:K});return Xs(t&&r?n:null),Aa({actions:()=>{const be=[],ie=[];if(g&&ie.push({id:"only-fav",label:a("common.filters.favourites.label"),checked:!!v,onClick:()=>g(!v)}),k&&ie.push({id:"only-tagged",label:a("common.filters.tagged.label"),checked:!!y,onClick:()=>k(!y)}),N&&ie.push({id:"only-noted",label:a("common.filters.noted.label"),checked:!!j,onClick:()=>N(!j)}),ie.length&&be.push({id:"h-only",heading:a("common.filters.only.label")},...ie),Fe){be.push({id:"h-sort",heading:a("common.filters.sort.label")});for(const[je,Ce]of K)be.push({id:`sort-${je}`,label:Ce,checked:R===je,onClick:()=>G(je)})}return be.push({id:"h-do",heading:a("common.mono.actions.label")}),t&&(se||ce||Te||Le||Y)&&be.push({id:"filters",icon:e.jsx(Rt,{}),label:a("common.filters.label"),onClick:()=>oe(!0)}),J&&be.push({id:"reset",icon:e.jsx(ur,{}),label:a("common.filters.reset.label"),onClick:J}),i&&be.push({id:"export",icon:e.jsx(st,{}),label:a("common.action.export.label"),onClick:i}),be},sub:t?o:null,keys:t?[{id:"filter",label:a("common.filters.label"),icon:e.jsx(Rt,{}),onClick:()=>oe(be=>!be)},...Fe?[{id:"sort",label:a("common.filters.sort.aria"),icon:e.jsx(mm,{}),onClick:()=>de(be=>!be)}]:[]]:null}),e.jsxs("section",{children:[e.jsx("div",{children:e.jsx(Vn,{title:n,counts:t?null:o,right:t?null:e.jsxs(e.Fragment,{children:[l,e.jsx(We,{icon:e.jsx(st,{}),label:a("common.action.export.label"),ariaLabel:a("common.action.export.label"),onClick:i,tooltip:a("common.action.export.shown.tip")})]})})}),e.jsx(ke,{children:s}),d&&!t&&e.jsxs("div",{className:"filter-row mb-5",children:[se?e.jsx(Ti,{genres:f,value:b,onChange:w}):e.jsx("span",{}),e.jsxs("div",{className:"ml-auto flex shrink-0 items-center gap-2",children:[M,Y&&ne,_e,ce&&he,Ne,qe,Q,Fe&&e.jsxs("label",{className:"flex items-center gap-2",children:[e.jsx(W,{children:a("common.filters.sort.label")}),ae]})]})]}),t&&e.jsx(yn,{open:ee,onClose:()=>oe(!1),title:a("common.filters.label"),footer:e.jsx(wr,{count:h?a("common.filters.shown.label",{n:m}):"",onReset:J,onDone:()=>oe(!1)}),children:e.jsxs("div",{className:"space-y-5",children:[se&&e.jsxs("div",{children:[e.jsx(W,{className:"mb-2 block",children:a("common.filters.genre.label")}),e.jsx(Ti,{genres:f,value:b,onChange:w})]}),z,Y&&e.jsxs("div",{children:[e.jsx(W,{className:"mb-2 block",children:a("common.filters.wish.label")}),e.jsx("div",{className:"flex flex-wrap items-center gap-2",children:ne})]}),e.jsxs("div",{children:[e.jsx(W,{className:"mb-2 block",children:a("common.filters.only.label")}),e.jsx("div",{className:"flex flex-wrap items-center gap-2",children:_e})]}),ce&&e.jsxs("div",{children:[e.jsx(W,{className:"mb-2 block",children:a("common.filters.shelf.label")}),he]}),Te&&e.jsxs("div",{children:[e.jsx(W,{className:"mb-2 block",children:I}),qe]}),Le&&e.jsxs("div",{children:[e.jsx(W,{className:"mb-2 block",children:F}),Ne]}),te]})}),t&&Fe&&e.jsx(yn,{open:pe,onClose:()=>de(!1),title:a("common.filters.sort.aria"),children:e.jsxs("div",{children:[e.jsx(W,{className:"mb-2 block",children:a("common.filters.sort.label")}),ae]})}),h&&!d&&e.jsx(Jt,{children:p}),d&&m===0&&e.jsx(Jt,{children:u}),m>0&&fe,H,me]})}const Nb=(t,n=[])=>{const s=n.length>0&&n.every(r=>Wn(t,r)==="game")?"playing":t==="movie"?"watching":"reading";return[["",a("common.selection.shelf.clear.label")],[s,It(s,t)],["paused",It("paused",t)],["abandoned",It("abandoned",t)],["completed",It("completed",t)]]};function $a({selection:t,rows:n=[],onDone:o,tagSuggestions:s=[],onEdit:r}){const[i,l]=c.useState(!1),[h,d]=c.useState(""),[m,p]=c.useState(!1),[u,f]=c.useState(!1),[b,w]=c.useState(!1),[v,g]=c.useState(!1),[y,k]=c.useState(!1),{kind:j,ids:N,count:S}=t,x=t.open??S>0,L=Bc({kind:j,ids:N,onDone:o}),A=L.busy,E=i||m||u||b||v||y;if(c.useEffect(()=>{if(!x||E)return;const z=te=>{var J;te.key==="Escape"&&(te.stopPropagation(),(J=t.dismiss)==null||J.call(t))};return document.addEventListener("keydown",z),()=>document.removeEventListener("keydown",z)},[x,E,t]),!x||!j||!Eo[j])return null;const D=Eo[j],q=z=>a(D.unit,{count:z}),C=Mr(j),I=S===0,O=n.filter(z=>t.isSelected(z.id)),V=O.length>0&&O.every(z=>z.review_excluded),P=Sr(j,S),T=Cg(j,N,{setColour:C?void 0:(z,te)=>L.post({color:te},a("common.selection.toast.recoloured",{n:S,count:S})),addTags:C?void 0:(z,te)=>L.post({add_tags:te},a("common.selection.toast.tagged",{n:S,count:S})),setSticker:C?void 0:((z,te)=>L.post({sticker_id:te??0},te==null?a("common.selection.toast.seals-removed"):a("common.selection.toast.sealed",{n:S,count:S}))),favourite:C?void 0:()=>L.post({favorite:!0},a("common.selection.toast.favourited",{n:S,count:S})),setBoard:j==="quote"?(z,te)=>L.post({board_id:te},a("common.selection.toast.moved",{n:S,count:S})):void 0,addToAnthology:ol[j]?(z,te)=>G(te):void 0,fillGaps:C?L.fillGaps:void 0,setFields:(z,te)=>L.post(te,a("common.selection.toast.fields-set",{n:S,count:S})),setShelf:C?(z,te)=>L.setShelf(te,a("common.selection.toast.moved",{n:S,count:S})):void 0,edit:r?z=>r(z):void 0,excluded:V,setReview:(z,te)=>L.post({review:te},te?a("common.selection.toast.back-in-quiz"):a("common.selection.toast.skipping",{n:S,count:S})),remove:()=>K()}),B=Object.fromEntries(T.map(z=>[z.id,z])),_=z=>{f(!1),B["add-tags"].run(z)},U=z=>{p(!1),B.sticker.run(z)},F=z=>{w(!1),B.board.run(z)},X=z=>{g(!1),B.anthology.run(z)},R=z=>{k(!1),B["set-fields"].run(z)};async function G(z){var H,ee;const te=N.map(oe=>({kind:ol[j],item_id:oe})),J=await Z("POST",`/anthologies/${z}/entries`,{items:te});if(!J.ok)return Ee(le(J,a("error.add.generic")));const fe=((H=J.data)==null?void 0:H.added)??0,me=((ee=J.data)==null?void 0:ee.skipped)??0;Ee(me?a("common.selection.toast.gathered-some",{n:fe,count:fe,skipped:me}):a("common.selection.toast.gathered",{n:fe,count:fe}))}async function K(){l(!1),d(""),await L.remove()}const M={"add-tags":()=>f(!0),sticker:()=>p(!0),board:()=>w(!0),anthology:()=>g(!0),"set-fields":()=>k(!0),delete:()=>l(!0)},Q=$n(T).map(z=>({...z,onClick:M[z.id]||(()=>z.run())}));return e.jsxs("div",{className:"selection-bar",children:[e.jsx(We,{icon:e.jsx("span",{className:"selection-count",children:S}),label:a("common.selection.deselect-all.label"),ariaLabel:I?a("common.selection.none.aria",{noun:q(0)}):a("common.selection.count.aria",{n:S,count:S,noun:q(S)}),tooltip:I?a("common.selection.none.aria",{noun:q(0)}):a("common.selection.count.tip",{n:S,count:S,noun:q(S)}),disabled:A||I,onClick:()=>{var z;return(z=t.deselectAll)==null?void 0:z.call(t)}}),zn(T).map(z=>z.id==="colour"?e.jsx("span",{className:"shrink-0","aria-disabled":I||void 0,children:e.jsx(rt,{mini:!0,disabled:I||A,value:"",onChange:te=>z.run(te),ariaLabel:a("common.selection.colour.aria",{n:S,count:S})})},z.id):z.id==="shelf"?e.jsx(Fn,{icon:z.icon,label:z.label,ariaLabel:a("common.selection.shelf.aria",{n:S,count:S}),tooltip:a("common.selection.shelf.tip"),disabled:I||A,items:Nb(j,O).map(([te,J])=>({id:te||"clear",label:J,onClick:()=>z.run(te)}))},z.id):e.jsx(We,{icon:z.icon,label:z.label,ariaLabel:z.label,tooltip:z.id==="fill"&&A?a("common.action.fetch.busy"):z.label,disabled:I||A,onClick:()=>z.run()},z.id)),Q.length>0&&e.jsx(Fn,{items:Q,ariaLabel:a("common.selection.more.aria",{n:S,count:S}),tooltip:a("common.selection.more.tip"),disabled:I||A}),e.jsx(Ae,{icon:e.jsx(it,{}),ariaLabel:a("common.selection.dismiss.aria"),onClick:()=>{var z;return(z=t.dismiss)==null?void 0:z.call(t)},wrapClassName:"ml-auto"}),u&&e.jsx(Tb,{count:S,busy:A,suggestions:s,onApply:_,onClose:()=>f(!1)}),m&&e.jsx(Cb,{count:S,busy:A,onApply:U,onClose:()=>p(!1)}),b&&e.jsx(Cd,{count:S,busy:A,onApply:F,onClose:()=>w(!1)}),v&&e.jsx(Xg,{count:S,busy:A,onApply:X,onClose:()=>g(!1)}),y&&e.jsx(Eb,{kind:j,count:S,rows:O,busy:A,onApply:R,onClose:()=>k(!1)}),e.jsx(mt,{open:i,title:a("common.selection.delete.confirm.title",{n:S,count:S,noun:q(S)}),body:e.jsxs("div",{className:"space-y-2",children:[e.jsx("p",{className:"microcopy",children:Pe(C?"common.selection.delete.confirm.body.work":"common.selection.delete.confirm.body.quote",{phrase:e.jsx("b",{children:P},"phrase")})}),e.jsx("input",{className:"tp-input",autoFocus:!0,value:h,placeholder:P,"aria-label":a("common.selection.delete.confirm.phrase.aria"),onChange:z=>d(z.target.value)})]}),confirmLabel:a("common.selection.delete.confirm.action.label"),confirmDisabled:h.trim().toLowerCase()!==P,onConfirm:()=>B.delete.run(),onCancel:()=>{l(!1),d("")}})]})}function Tb({count:t,busy:n,suggestions:o,onApply:s,onClose:r}){const[i,l]=c.useState([]),h=i.map(d=>d.trim()).filter(Boolean);return e.jsx(Ke,{open:!0,onClose:r,title:a("common.selection.tags.title",{n:t,count:t}),children:e.jsxs("div",{className:"space-y-3",children:[e.jsx("p",{className:"microcopy",children:a("common.selection.tags.body",{n:t,count:t})}),e.jsx(yt,{value:i,onChange:l,suggestions:o,placeholder:a("common.selection.tags.placeholder"),ariaLabel:a("common.selection.tags.input.aria")}),e.jsx(ge,{onClick:()=>s(h),disabled:n||h.length===0,children:a("common.action.add-tags.label")})]})})}function Cb({count:t,busy:n,onApply:o,onClose:s}){const[r,i]=c.useState(null),{stickers:l,reload:h}=Fa();return e.jsx(Ke,{open:!0,onClose:s,title:a("common.selection.seal.title",{n:t,count:t}),children:e.jsxs("div",{className:"space-y-3",children:[e.jsx("p",{className:"microcopy",children:a("common.selection.seal.body")}),e.jsx(Xo,{value:r,onChange:i,stickers:l,reload:h}),e.jsx(ge,{onClick:()=>o(r),disabled:n,children:a("common.action.apply.label")})]})})}function Eb({kind:t,count:n,rows:o,busy:s,onApply:r,onClose:i}){var g;const l=Lp(t),[h,d]=c.useState(((g=l[0])==null?void 0:g.key)||""),[m,p]=c.useState(""),u=l.find(y=>y.key===h),f=!(u!=null&&u.required),b=!String(m).trim(),w=u?Dp(o,h):null,v=()=>r({[h]:u!=null&&u.number?Number(m)||0:String(m).trim()});return e.jsx(Ke,{open:!0,onClose:i,title:a("common.selection.edit.title",{n,count:n}),children:e.jsxs("div",{className:"space-y-3",children:[e.jsx("p",{className:"microcopy",children:a("common.selection.edit.body",{n,count:n})}),e.jsxs("div",{className:"flex flex-wrap items-center gap-2",children:[e.jsx(W,{children:a("common.selection.edit.field.label")}),e.jsx(De,{ariaLabel:a("common.selection.edit.field.aria"),value:h,onChange:y=>{d(y),p("")},options:l.map(y=>[y.key,y.label])})]}),u!=null&&u.options?e.jsxs("div",{className:"flex flex-wrap items-center gap-2",children:[e.jsx(W,{children:u.label}),e.jsx(De,{ariaLabel:a("common.selection.edit.value.aria"),value:m,onChange:p,options:f?[["",a("common.selection.edit.value.none.label")],...u.options]:u.options})]}):u!=null&&u.long?e.jsxs("label",{className:"tp-field",children:[e.jsx(W,{children:u.label}),e.jsx("textarea",{className:"tp-input",rows:"4","aria-label":a("common.selection.edit.value.aria"),value:m,onChange:y=>p(y.target.value)})]}):e.jsx(Se,{label:(u==null?void 0:u.label)||"",nameCase:!(u!=null&&u.number),inputMode:u!=null&&u.number?"numeric":void 0,value:m,autoFocus:!0,onChange:y=>p(y.target.value)}),w&&e.jsx("p",{className:"tp-warn",children:w.text}),f&&b&&e.jsx("p",{className:"microcopy",children:a("common.selection.edit.clear.hint")}),e.jsx(ge,{onClick:v,disabled:s||!u||!f&&b,children:a("common.action.apply.label")})]})})}const Bd="tp-btn tp-btn-primary",Os={fontFamily:"var(--font-display)",fontWeight:"var(--font-display-weight)",fontVariantCaps:"var(--font-display-caps)",textTransform:"var(--font-display-case)",fontVariantNumeric:"var(--font-display-figures)",fontStyle:"italic",fontSize:"var(--type-display-17)",lineHeight:1.55};function Ab({openId:t,onOpen:n,onClose:o,onOpenMovie:s,creditSeparators:r,onAdd:i,onSearch:l,dataNonce:h}){return t?e.jsx(_b,{id:t,onClose:o,creditSeparators:r,onAdd:i,dataNonce:h,onSearch:l}):e.jsx(Db,{onOpen:n,onOpenMovie:s,creditSeparators:r,dataNonce:h})}const dl=()=>[["none",a("library.group.none.label")],["series",a("library.group.series.label")],["author",a("library.group.author.label")],["decade",a("library.group.decade.label")],["genre",a("library.group.genre.label")]],qo=(t,n)=>a("common.count.phrase",{n:t,noun:a(n,{count:t})});function qb(t){return t.replace(/\S+/g,n=>n[0].toUpperCase()+n.slice(1).toLowerCase())}function io(t){const n=[];for(const o of t.genres||[])for(const s of String(o).split(",")){const r=qb(s.trim());r&&!n.includes(r)&&n.push(r)}return n}function Mb(t){return{title:t.title,author:t.author||"",translator:t.translator||"",editor:t.editor||"",isbn:t.isbn||"",asin:t.asin||"",description:t.description||"",published_year:t.published_year||0,genres:t.genres||[],series:t.series||"",series_index:t.series_index||0,favorite:!!t.favorite}}async function Lb(t,n){const o=await Z("PUT",`/books/${t}/status`,n);return o.ok?"":le(o,a("error.save.generic"))}function hl({books:t,coverSize:n,onOpen:o,authorMap:s={},seps:r,selection:i,leadingTile:l,onChanged:h,onEdit:d}){const m=nn(t.length,t);return e.jsxs("ul",{className:"grid gap-x-6 gap-y-9",style:{gridTemplateColumns:`repeat(auto-fill, minmax(${n}px, 1fr))`},children:[l&&e.jsx("li",{children:l}),t.slice(0,m.count).map((p,u)=>e.jsx("li",{children:e.jsx(Hr,{kind:"book",item:p,index:u,onOpen:o,people:s,seps:r,selection:i,onChanged:h,onEdit:d})},p.id)),m.more&&e.jsx("li",{ref:m.sentinel,"aria-hidden":"true",className:"h-px"})]})}function Db({onOpen:t,onOpenMovie:n,creditSeparators:o,dataNonce:s}){const[r,i]=c.useState(null),[l,h]=c.useState([]),d=c.useMemo(()=>({genre:ct(l,"genre"),series:ct(l,"series"),fav:ct(l,"favourite")==="yes",tagged:ct(l,"tagged")==="yes",noted:ct(l,"noted")==="yes",wish:{yes:"wishlist",no:"annotated"}[ct(l,"wishlist")]||"",states:bd(l,"shelf")}),[l]),{genre:m,series:p,fav:u,tagged:f,noted:b,wish:w,states:v}=d,g=Y=>h(ce=>at(ce,"genre",Y)),y=Y=>h(ce=>at(ce,"series",Y)),k=Y=>h(ce=>at(ce,"favourite",Y?"yes":"")),j=Y=>h(ce=>at(ce,"tagged",Y?"yes":"")),N=Y=>h(ce=>at(ce,"noted",Y?"yes":"")),S=Y=>h(ce=>at(ce,"wishlist",Y==="wishlist"?"yes":Y==="annotated"?"no":"")),x=Y=>h(ce=>yd(ce,"shelf",Y)),[L,A]=$e("tippani:books:wishFolder",!1),[E,D]=c.useState("recent"),[q,C]=c.useState("none"),[I,O]=c.useState(!1),[V,P]=c.useState(""),[T]=dc("tippani:size:books",165),B=Ie(),_=Xe("author"),[U,F]=c.useState(null);c.useEffect(()=>(tn(gd(l)),()=>tn([])),[l]);async function X(){const Y=await Z("GET","/books");Y.ok?i(Y.data.books):P(le(Y))}c.useEffect(()=>{X()},[s]);const R=c.useMemo(()=>{const Y=new Map;for(const ce of r||[])for(const Te of io(ce))Y.set(Te,(Y.get(Te)||0)+1);return[...Y.keys()].sort((ce,Te)=>Y.get(Te)-Y.get(ce)||ce.localeCompare(Te))},[r]),G=c.useMemo(()=>{const Y=new Set;for(const ce of r||[])ce.series&&Y.add(ce.series);return[...Y].sort()},[r]),K=c.useMemo(()=>{let Y=r||[];return m&&(Y=Y.filter(ce=>io(ce).includes(m))),p&&(Y=Y.filter(ce=>(ce.series||"")===p)),u&&(Y=Y.filter(ce=>ce.favorite)),f&&(Y=Y.filter(ce=>(ce.tagged_count||0)>0)),b&&(Y=Y.filter(ce=>(ce.noted_count||0)>0)),Y=Dd(Y,v),Y=Md(Y,w,ce=>ce.annotation_count||0),E==="recent"?Ld(Y,"book"):(Y=[...Y],E==="title"?Y.sort((ce,Te)=>ce.title.localeCompare(Te.title)):E==="author"?Y.sort((ce,Te)=>(ce.author||"").localeCompare(Te.author||"")):E==="series"?Y.sort(xo):E==="read"&&Y.sort(wc),Y)},[r,m,p,u,f,b,v,w,E]),M=L&&w===""&&q==="none",Q=Y=>(Y.annotation_count||0)===0,z=c.useMemo(()=>M?K.filter(Q):[],[M,K]),te=c.useMemo(()=>M?K.filter(Y=>!Q(Y)):K,[M,K]),J=za(te.map(Y=>Y.id)),fe=()=>{J.clear(),X()},[me,H]=c.useState(null),ee=c.useMemo(()=>wn(o),[o]),oe=e.jsx(um,{active:L,label:a("library.filters.fold-wishlist.label"),tooltip:a("library.filters.fold-wishlist.tip"),onClick:()=>A(Y=>!Y)}),pe=c.useMemo(()=>q==="none"?null:Pr(K,q,{credit:Y=>Y.author,splitCredit:!0,creditResidual:a("library.group.residual.author.label"),year:Y=>Y.published_year,genres:io,series:Y=>Y.series,seps:ee,sortMembers:(Y,ce)=>ce==="series"?[...Y].sort(xo):Y}),[K,q,ee]),de=nn(pe?pe.length:0,pe,12),se=(r||[]).reduce((Y,ce)=>Y+(ce.annotation_count||0),0);return e.jsxs($r,{mobile:B,title:a("nav.tab.library.label"),counts:r?a("library.header.counts",{a:a("common.count.phrase",{n:r.length,noun:a("unit.book",{count:r.length})}),b:a("common.count.phrase",{n:se,noun:a("unit.quote",{count:se})})}):"",error:V,onExport:()=>O(!0),headerAside:e.jsx(W,{className:"hidden sm:inline",children:a("library.header.lookup.label")}),loaded:r!=null,hasItems:!!(r&&r.length>0),shownCount:K.length,emptyText:a("library.board.empty"),noMatchText:a("library.board.nomatch"),genres:R,genre:m,setGenre:g,fav:u,setFav:k,tagged:f,setTagged:j,noted:b,setNoted:N,wish:w,setWish:S,states:v,setStates:x,kind:"book",noun:a("unit.book.one"),nounPlural:a("unit.book.other"),seriesNames:G,series:p,setSeries:y,sort:E,setSort:D,sortOptions:[["recent",a("library.sort.recent.label")],["title",a("library.sort.title.label")],["author",a("library.sort.author.label")],["series",a("library.sort.series.label")],["read",a("library.sort.read.label")]],trailing:e.jsxs(e.Fragment,{children:[oe,e.jsxs("label",{className:"flex items-center gap-2",children:[e.jsx(W,{children:a("common.mono.group.label")}),e.jsx(De,{ariaLabel:a("common.filters.group.aria"),value:q,onChange:C,options:dl()})]})]}),trailingMobile:e.jsxs(e.Fragment,{children:[e.jsx("div",{children:oe}),e.jsxs("div",{children:[e.jsx(W,{className:"mb-2 block",children:"group"}),e.jsx(De,{ariaLabel:a("common.filters.group.aria"),value:q,onChange:C,options:dl()})]})]}),onReset:()=>{h([]),C("none"),D("recent")},exportDialog:e.jsx(mt,{open:I,title:a("library.export.confirm.title"),body:e.jsxs(e.Fragment,{children:[a("library.export.confirm.body",{a:qo(K.length,"unit.book"),b:qo(K.reduce((Y,ce)=>Y+(ce.annotation_count||0),0),"unit.quote")}),"be exported as a single Markdown file (re-importable into Tippani)."]}),confirmLabel:a("common.action.export.label"),onCancel:()=>O(!1),onConfirm:async()=>{O(!1),await Vs("/export/books",{ids:K.map(Y=>Y.id)},"tippani-books.md")}}),extraModals:e.jsxs(e.Fragment,{children:[U&&e.jsx(Sn,{kind:U.kind,name:U.name,onClose:()=>F(null),onSaved:_.reload}),me!=null&&e.jsx(Ob,{kind:"books",id:me,title:a("book.form.edit.title"),onDone:()=>{H(null),fe()},onCancel:()=>H(null)})]}),children:[J.open&&e.jsx($a,{selection:J,rows:te,onDone:fe,onEdit:H}),pe?e.jsxs("div",{className:"space-y-10",children:[pe.slice(0,de.count).map(Y=>{const ce=q==="author"&&!Y.residual;return e.jsxs("section",{children:[e.jsx(zr,{label:Y.label,count:Y.items.length,noun:a("unit.book.one"),nounPlural:a("unit.book.other"),person:ce?_.map[Y.label]:null,onOpenPerson:ce?()=>F({kind:"author",name:Y.label}):void 0}),e.jsx(hl,{books:Y.items,coverSize:T,onOpen:t,authorMap:_.map,seps:ee,selection:J,onChanged:fe,onEdit:H})]},Y.key)}),de.more&&e.jsx("div",{ref:de.sentinel,"aria-hidden":"true",className:"h-px"})]}):e.jsx(hl,{books:te,coverSize:T,onOpen:t,authorMap:_.map,seps:ee,selection:J,onChanged:fe,onEdit:H,leadingTile:z.length>0?e.jsx(jb,{kind:"book",items:z,onOpen:()=>S("wishlist")}):null})]})}function Hd(t){const n=t.replace(/[-\s]/g,"");return/^(\d{9}[\dXx]|\d{13})$/.test(n)}function zd({onAdded:t,formId:n,title:o,setTitle:s,onBusy:r}){const[i,l]=c.useState(""),[h,d]=c.useState(""),[m,p]=c.useState(""),[u,f]=c.useState("");async function b(w){if(w.preventDefault(),!o.trim())return f(a("error.validate.title-required.lower"));let v,g;if(h.trim()){const k=bn(h);if(!k.year)return f(a("error.validate.year"));v=k.year,g=k.circa}r==null||r(!0),f("");const y=await Z("POST","/books",{title:o.trim(),author:i.trim()||void 0,isbn:m.trim()||void 0,published_year:v,published_circa:g});r==null||r(!1),y.ok?t(y.data):f(le(y,a("error.add.book")))}return e.jsxs("form",{id:n,onSubmit:b,className:"space-y-3",children:[e.jsx(Se,{label:a("common.field.title.label"),nameCase:!0,value:o,autoFocus:!0,onChange:w=>s(w.target.value)}),e.jsx(Se,{label:a("common.field.author.label"),nameCase:!0,value:i,onChange:w=>l(w.target.value)}),e.jsxs("div",{className:"grid gap-3 sm:grid-cols-2",children:[e.jsx(Se,{label:a("common.field.year.label"),inputMode:"numeric",value:h,maxLength:4,onChange:w=>d(w.target.value.replace(/\D/g,"").slice(0,4))}),e.jsx(Se,{label:a("common.field.isbn.label"),value:m,onChange:w=>p(w.target.value)})]}),e.jsx(ke,{children:u}),!o.trim()&&e.jsx("p",{className:"microcopy",style:{color:"var(--faint)"},children:a("book.form.missing.hint")})]})}function _b({id:t,onClose:n,creditSeparators:o,onAdd:s,onSearch:r,dataNonce:i}){const{practise:l,practiceDialog:h}=Ia(),[d,m]=c.useState(null),[p,u]=c.useState(!1),[f,b]=c.useState(""),[w,v]=c.useState(null),[g,y]=c.useState(!1),[k,j]=c.useState(null),N=(k==null?void 0:k.total)??null,[S,x]=c.useState(null),[L,A]=c.useState(null),[E,D]=c.useState(null),[q,C]=c.useState(""),[I,O]=c.useState(!1),{map:V}=Xe("author"),{map:P}=Xe("translator"),{map:T}=Xe("editor"),B=Zs(),_=Ie();async function U(){const ee=await Z("GET",`/books/${t}`);ee.ok?m(ee.data):b(le(ee))}c.useEffect(()=>{m(null),u(!1),j(null),U()},[t]),c.useEffect(()=>(tn(d?[wd("book",d.id,d.title)]:[]),()=>tn([])),[d]);async function F(ee,oe){O(!0);const pe={status:ee,progress:(d==null?void 0:d.progress)||0,pos_unit:(d==null?void 0:d.pos_unit)||"",pos:(d==null?void 0:d.pos)||0,pos_total:(d==null?void 0:d.pos_total)||0};ee===pt.book?pe.started_at=oe||"":(ee==="completed"||ee==="abandoned")&&(pe.finished_at=oe||"");const de=await Z("PUT",`/books/${t}/status`,pe);O(!1),de.ok?m(de.data):b(le(de,a("error.save.generic")))}async function X(ee){if(d){if(ee===pt.book&&d.status!=="paused"){const oe=await Z("GET","/books");if(!oe.ok)return b(le(oe));const pe=(oe.data.books||[]).filter(de=>xa("book",de)&&de.id!==d.id);if(pe.length>=Rn.book){C(""),A(pe);return}}if(ee===""||ee==="paused")return F(ee,"");x({status:ee,date:Qt()})}}async function R(ee){D(ee.id);const oe=await Lb(ee.id,{status:"completed",finished_at:Qt()});if(D(null),oe)return C(oe);const pe=L.filter(de=>de.id!==ee.id);if(pe.length<Rn.book){A(null),x({status:pt.book,date:Qt()});return}A(pe)}async function G(ee){O(!0);const oe=await Z("PUT",`/books/${t}/status`,{status:d.status,...ee});O(!1),oe.ok?m(oe.data):b(le(oe,a("error.save.generic")))}const[K,M]=c.useState(!1);async function Q(){M(!1);const ee=await Qn(`/books/${t}`,{label:a("book.toast.deleted")});ee.ok?n():b(le(ee))}async function z(ee){const oe=await Z("PUT",`/books/${t}`,{...Mb(d),...ee});oe.ok?m(oe.data):b(le(oe,a("error.save.generic")))}const te=(ee,oe,pe)=>tt(oe||"",wn(o)).map(de=>e.jsx(Qo,{kind:ee,name:de,person:pe[de],size:28,onOpen:v},`${ee}-${de}`)),J=(ee,oe,pe,de)=>{const se=te(ee,pe,de);return se.length===0?null:e.jsxs("span",{className:"inline-flex items-center gap-1.5",children:[e.jsx(W,{style:{color:"var(--faint)"},children:oe}),se]},ee)},fe=d?[...te("author",d.author,V),J("translator",a("book.credit.translator.label"),d.translator,P),J("editor",a("book.credit.editor.label"),d.editor,T),Pt(d.published_year,d.published_circa)||null,lr(d)||null].filter(Boolean):[],me=d?d.title||a("book.title.fallback"):"";Xs(me);const H=d&&d.author?d.author:"";return Aa({sub:H||null,actions:()=>[{id:"h-do",heading:a("common.mono.actions.label")},{id:"shelf",icon:e.jsx(dr,{size:24}),label:pn("book",(d==null?void 0:d.status)||"",pt.book,d||{}),onClick:()=>X(pt.book)},{id:"details",icon:e.jsx(Ft,{}),label:a("common.work.details.title"),onClick:()=>u(!0)},{id:"practise",icon:e.jsx(Ht,{}),label:a("book.practise.menu.label"),onClick:()=>d&&l({book:d.id,label:d.title})},{id:"export",icon:e.jsx(st,{}),label:a("book.export.label"),onClick:()=>{d&&(window.location.href=`/api/books/${d.id}/export`)}},{id:"delete",icon:e.jsx(ze,{}),label:a("common.action.delete.label"),onClick:()=>M(!0),danger:!0}],keys:_?[{id:"filter",label:a("book.filter.aria"),icon:e.jsx(Rt,{}),onClick:()=>y(!0)},{id:"details",label:a("common.work.details.title"),icon:e.jsx(Ft,{}),onClick:()=>u(!0)}]:null}),e.jsxs("section",{ref:B,className:"reveal space-y-6 md:pt-4","data-screen-label":"book-detail",children:[!_&&e.jsx("button",{className:"mono-label",style:{background:"none",border:"none",cursor:"pointer",padding:"6px 0"},onClick:n,children:"← Library"}),e.jsx(ke,{children:f}),d&&e.jsx("div",{children:e.jsx(Fd,{cover:e.jsx(dm,{path:d.cover_path,title:d.title,hero:!0,zoomable:!0}),shadow:"drop-shadow(0 12px 22px rgba(0,0,0,.34))",title:d.title,titleSize:"var(--type-display-26)",titleStyle:{lineHeight:1.15},meta:fe.length>0&&e.jsx("div",{className:"mono-label",style:{display:"flex",flexWrap:"wrap",alignItems:"center",rowGap:2,fontSize:"var(--type-ui-12)"},children:fe.map((ee,oe)=>e.jsxs("span",{style:{display:"inline-flex",alignItems:"center"},children:[oe>0&&e.jsx("span",{"aria-hidden":"true",style:{margin:"0 8px"},children:"·"}),ee]},oe))}),counts:e.jsx(Pd,{counts:k,noun:[a("unit.quote.one"),a("unit.quote.other")]}),favorite:d.favorite,onFavorite:ee=>z({favorite:ee}),tags:e.jsx(Rd,{kind:"book",item:d,status:d.status,progress:d.progress,pos:d,reads:d.reads,onReadsChanged:U,wishlist:N===0,busy:I,onSelect:X,onProgress:G}),genres:io(d),description:d.description,actions:_?null:e.jsxs(e.Fragment,{children:[e.jsx(ge,{onClick:()=>X(pt.book),disabled:I,children:pn("book",d.status||"",pt.book,d)}),e.jsx(We,{icon:e.jsx(st,{}),label:a("common.action.export.label"),ariaLabel:a("book.export.aria"),onClick:()=>window.location.href=`/api/books/${d.id}/export`,tooltip:a("book.export.tip")}),e.jsx(We,{icon:e.jsx(Ht,{}),label:a("common.action.practise.label"),ariaLabel:a("book.practise.aria"),onClick:()=>l({book:d.id,label:d.title}),tooltip:a("book.practise.tip")}),e.jsx(We,{icon:e.jsx(Ft,{}),label:a("common.work.details.title"),ariaLabel:a("common.work.details.title"),onClick:()=>u(!0),tooltip:a("book.details.tip")}),e.jsx(We,{icon:e.jsx(ze,{}),label:a("common.action.delete.label"),ariaLabel:a("book.delete.aria"),onClick:()=>M(!0),danger:!0,tooltip:a("book.delete.tip")})]})})}),d&&e.jsx(Zc,{open:p,onClose:()=>u(!1),kind:"book",item:d,onChanged:m,onDelete:Q}),e.jsx(_d,{open:!!L,items:(L||[]).map(ee=>({id:ee.id,title:ee.title,meta:[ee.author,Pt(ee.published_year,ee.published_circa)||null].filter(Boolean).join(" · ")})),cap:Rn.book,noun:a("unit.book.one"),nounPlural:a("unit.book.other"),verb:a("common.shelf.reading.book.label"),pastLabel:a("book.shelf.cap.past.label"),busyId:E,error:q,onRelease:R,onCancel:()=>A(null),onProceed:()=>{A(null),x({status:pt.book,date:Qt()})}}),e.jsx(Od,{open:!!S,title:S?pn("book",(d==null?void 0:d.status)||"",S.status,d||{}):"",label:a((S==null?void 0:S.status)===pt.book?"book.shelf.started.label":(S==null?void 0:S.status)==="abandoned"?"book.shelf.abandoned.label":"book.shelf.finished.label"),value:(S==null?void 0:S.date)||"",onChange:ee=>x(oe=>oe&&{...oe,date:ee}),onCancel:()=>x(null),onConfirm:()=>{const ee=S;x(null),F(ee.status,ee.date)}}),d&&e.jsx(Hb,{bookId:d.id,book:d,authorMap:V,seps:wn(o),onStats:j,mobileFilterOpen:g,onMobileFilterOpen:y,onAdd:s,dataNonce:i}),w&&e.jsx(Sn,{kind:w.kind,name:w.name,onClose:()=>v(null)}),h,e.jsx(Br,{open:K,kind:"book",title:(d==null?void 0:d.title)||"",count:(k==null?void 0:k.total)||0,onConfirm:Q,onCancel:()=>M(!1)})]})}function Ob({kind:t,id:n,title:o,onDone:s,onCancel:r}){const[i,l]=c.useState(null),[h,d]=c.useState("");return c.useEffect(()=>{l(null),d(""),Z("GET",`/${t}/${n}`).then(m=>m.ok?l(m.data):d(le(m)))},[t,n]),e.jsx(Ke,{open:!0,onClose:r,title:o,children:h?e.jsx(ke,{children:h}):i?e.jsx($d,{book:i,onSaved:s,onCancel:r}):e.jsx("p",{className:"microcopy",children:"loading…"})})}function $d({book:t,onSaved:n,onCancel:o}){const[s,r]=c.useState(t.title||""),[i,l]=c.useState(t.author||""),[h,d]=c.useState(t.translator||""),[m,p]=c.useState(t.editor||""),[u,f]=c.useState(t.isbn||""),[b,w]=c.useState(t.asin||""),[v,g]=c.useState(Pt(t.published_year,t.published_circa)),[y,k]=c.useState(t.genres||[]),[j,N]=c.useState([]);c.useEffect(()=>{Z("GET","/genres").then(M=>{M.ok&&N(M.data.genres||[])})},[]);const[S,x]=c.useState(t.series||""),[L,A]=c.useState(t.series_index?String(t.series_index):""),[E,D]=c.useState(t.description||""),[q,C]=c.useState(t.cover_path||""),[I,O]=c.useState(""),[V,P]=c.useState(!1),[T,B]=c.useState(""),[_,U]=c.useState(!1),F=(M,Q)=>String(M).trim()?M:Q||M;function X(M,Q=!1){const z=J=>J!=null&&String(J).trim()!=="",te=Q?(J,fe)=>z(fe)?fe:J:F;r(J=>te(J,M.title)),l(J=>te(J,M.author)),f(J=>te(J,M.isbn13)),g(J=>te(J,M.published_year?String(M.published_year):"")),D(J=>te(J,M.description)),k(J=>Q?M.genres&&M.genres.length?M.genres:J:J.length?J:M.genres||[]),x(J=>te(J,M.series)),A(J=>te(J,M.series_index?String(M.series_index):"")),M.cover_url&&(Q||!q&&!I)&&(O(M.cover_url),P(!1))}const[R,G]=c.useState(!1);async function K(M){if(M.preventDefault(),!s.trim())return B(a("error.validate.title-required.lower"));let Q,z;if(v.trim()){const J=bn(v);if(!J.year)return B(a("error.validate.year"));Q=J.year,z=J.circa}U(!0),B("");const te=await Z("PUT",`/books/${t.id}`,{title:s.trim(),author:i.trim(),translator:h.trim(),editor:m.trim(),isbn:u.trim(),asin:b.trim(),published_year:Q,published_circa:z,genres:y,series:S.trim(),series_index:Number(L)||0,description:E.trim(),favorite:!!t.favorite,cover_url:I||void 0,clear_cover:V||void 0});U(!1),te.ok?n():B(le(te,a("error.save.generic")))}return e.jsxs("form",{onSubmit:K,className:"space-y-3",children:[e.jsx(vr,{kind:"books",id:t.id,currentPath:q,asin:b,coverUrl:I,clearCover:V,onSetUrl:M=>{O(M),P(!1)},onClear:M=>{M===!0?(O(""),P(!1)):(P(!0),O(""))},onUploaded:M=>C(M.cover_path||""),onFetchMeta:()=>G(M=>!M),fetchMetaOpen:R,search:{isbn:u,title:s,author:i,asin:b}}),R&&e.jsx(Oc,{auto:!0,isbn:u,title:s,author:i,asin:b,onPick:M=>{X(M,!0),G(!1)},onClose:()=>G(!1)}),e.jsxs("div",{className:"grid gap-3 sm:grid-cols-2",children:[e.jsx(Se,{label:a("common.field.title.label"),nameCase:!0,value:s,onChange:M=>r(M.target.value)}),e.jsx(Se,{label:a("common.field.author.label"),nameCase:!0,value:i,onChange:M=>l(M.target.value)}),e.jsx(Se,{label:a("common.field.translator.label"),nameCase:!0,placeholder:a("book.form.translator.placeholder"),value:h,onChange:M=>d(M.target.value)}),e.jsx(Se,{label:a("common.field.editor.label"),nameCase:!0,placeholder:a("book.form.editor.placeholder"),value:m,onChange:M=>p(M.target.value)}),e.jsx(Se,{label:a("common.field.isbn.label"),value:u,onChange:M=>f(M.target.value)}),e.jsx(Se,{label:a("common.field.asin.label"),value:b,onChange:M=>w(M.target.value)}),e.jsx(Se,{label:a("common.field.year.label"),inputMode:"numeric",value:v,maxLength:4,onChange:M=>g(M.target.value.replace(/\D/g,"").slice(0,4))})]}),e.jsxs("label",{className:"block",children:[e.jsx(W,{className:"mb-1.5 block",children:a("common.field.genres.label")}),e.jsx(yt,{value:y,onChange:k,suggestions:j,placeholder:a("common.field.genres.placeholder"),ariaLabel:a("common.field.genres.label"),transform:Wo})]}),e.jsxs("div",{className:"grid gap-3 sm:grid-cols-[1fr_auto]",children:[e.jsx(Se,{label:a("common.field.series.label"),nameCase:!0,placeholder:a("book.form.series.placeholder"),value:S,onChange:M=>x(M.target.value)}),e.jsx(Se,{label:a("common.field.series-no.label"),inputMode:"decimal",placeholder:a("book.form.series-no.placeholder"),value:L,onChange:M=>A(M.target.value)})]}),e.jsxs("label",{className:"block",children:[e.jsx(W,{className:"mb-1.5 block",children:a("common.field.description.label")}),e.jsx("textarea",{className:"tp-input",rows:"4",value:E,onChange:M=>D(M.target.value)})]}),e.jsx(ke,{children:T}),e.jsxs("div",{className:"flex gap-2",children:[e.jsx("button",{className:Bd,disabled:_||!s.trim(),children:"Save"}),e.jsx(ge,{type:"button",onClick:o,children:"Cancel"})]})]})}function Wr(t){return{quote:t.quote||"",note:t.note||"",chapter:t.chapter||"",chapter_no:t.chapter_no||0,location:t.location||"",character:t.character||"",translation:t.translation||"",color:t.color||"yellow",tags:t.tags||[],favorite:!!t.favorite,sticker_id:t.sticker_id??null,sticker_x:t.sticker_x??null,sticker_y:t.sticker_y??null}}function Un(t){return t.noted_at||t.created_at||""}function vn(t){if(!t)return"";const n=new Date(String(t).replace(" ","T"));return Number.isNaN(n.getTime())?"":n.toLocaleDateString(void 0,{year:"numeric",month:"short",day:"numeric"})}function Rb(t){const n=String(t.location||"").match(/\d+/);return n?parseInt(n[0],10):-1}function Ib({acts:t,a:n,color:o,onColor:s,patch:r,actionsAlwaysVisible:i}){return e.jsxs("div",{className:"mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 pt-1.5",children:[e.jsx(Pn,{value:!!n.favorite,onChange:l=>r(n,{favorite:l})}),e.jsx(wa,{actions:zn(t),alwaysVisible:i}),e.jsx("span",{className:"card-colors shrink-0"+(i?" is-visible":""),children:e.jsx(rt,{value:o,onChange:s,ariaLabel:a("common.colour.category.aria"),collapsible:!0})}),e.jsx("span",{className:"ml-auto flex items-center",children:e.jsx(va,{actions:$n(t)})})]})}function Mo({a:t,variant:n,tagMap:o,stickerMap:s={},stickers:r=[],reloadStickers:i,editing:l,setEditingId:h,save:d,patch:m,remove:p,onCopy:u,onShare:f,quoteLines:b=6,tagSuggestions:w=[],actionsAlwaysVisible:v=!1,editInline:g=!1,expanded:y,onToggleExpand:k,meta:j,form:N=es,selection:S,selectKind:x="annotation",onMoveBoard:L}){const A=t.sticker_id!=null?s[t.sticker_id]:null,E=typeof k=="function",D=vn(Un(t)),[q,C]=c.useState(null);c.useEffect(()=>{C(null)},[t.color]);const I=q||t.color,O=async G=>{G!==I&&(C(G),await m(t,{color:G})===!1&&C(null))},V=j===void 0?[t.character,gn(t)&&a("common.locator.chapter.label",{name:gn(t)}),t.location&&a("common.locator.page.short.label",{n:t.location}),D].filter(Boolean).join(" · "):j,P=e.jsx(N,{initial:t,onSubmit:G=>d(t.id,G),onCancel:()=>h(null),submitLabel:a("common.action.save.label"),tagSuggestions:w,stickers:r,reloadStickers:i,bookId:t.book_id??null}),T=Ha("annotation",t,{copy:u,share:f,edit:G=>h(G.id),favourite:G=>m(G,{favorite:!G.favorite}),favourited:!!t.favorite,setBoard:L,remove:p}),B=[...Dr(S,t.id,x),...T.map(G=>({...G,onClick:G.run}))],{cardProps:_,menuClass:U,menu:F}=Uo(B,S?{onLongPress:()=>S.toggle(t.id,x)}:void 0),X=!!(S!=null&&S.isSelected(t.id)),R=S?G=>{const K=Lr(G,S);K!=="open"&&(G.preventDefault(),G.stopPropagation(),K==="extend"?S.extendTo(t.id,x):S.toggle(t.id,x))}:void 0;return g&&l?e.jsx(Je,{variant:n,colorBar:I,className:"px-5 py-4",children:P}):e.jsxs(Je,{variant:n,colorBar:I,className:`px-5 py-4 ${U}${X?" is-picked":""}${S!=null&&S.active?" is-selecting":""}`,..._,onClickCapture:G=>{var K;(K=_.onClickCapture)!=null&&K.call(_,G)||R==null||R(G)},children:[S&&e.jsx(gr,{picked:X,label:a("common.quote.pick.label"),onChange:()=>S.toggle(t.id,x)}),!g&&e.jsx(Ke,{open:l,onClose:()=>h(null),title:a("common.quote.edit.title"),children:P}),e.jsxs("div",{className:"space-y-2",children:[t.quote&&(A?e.jsx(Ic,{text:t.quote,quoteStyle:Os,stickerKey:`s${A.id}`,maxLines:b,pos:t.sticker_x!=null?{x:t.sticker_x,y:t.sticker_y}:null,onMove:(G,K)=>m(t,{sticker_x:G,sticker_y:K}),sticker:e.jsx(Jc,{sticker:A}),open:E?!!y:void 0,onToggle:E?k:void 0}):e.jsx(Ho,{text:t.quote,lines:b,style:Os,open:E?!!y:void 0,onToggle:E?k:void 0})),e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx(gc,{item:t}),e.jsx(rr,{item:t,parent:x==="annotation"?"book":""}),V&&e.jsx(W,{className:"block",children:V})]}),t.translation&&e.jsx(lc,{children:t.translation}),t.note&&e.jsx(Bo,{children:t.note}),t.tags&&t.tags.length>0&&e.jsx("div",{className:"flex flex-wrap gap-2 pt-1",children:t.tags.map(G=>{const K=o[G];return e.jsx(Ma,{color:K==null?void 0:K.color,style:K==null?void 0:K.style,children:G},G)})}),e.jsx(Ib,{acts:T,a:t,color:I,onColor:O,patch:m,actionsAlwaysVisible:v})]}),F]})}const Pb=[{key:"quote",get label(){return a("book.table.quote.label")}},{key:"chapter",get label(){return a("book.table.chapter.label")}},{key:"location",get label(){return a("book.table.location.label")}},{key:"date",get label(){return a("book.table.date.label")}},{key:"favorite",get label(){return a("book.table.favourite.label")}}];function Fb({rows:t,tagMap:n,stickers:o=[],reloadStickers:s,sort:r,onSort:i,editingId:l,setEditingId:h,save:d,remove:m,onCopy:p,onShare:u}){const f=w=>r.col===w?r.dir==="asc"?" ▲":" ▼":"",b=t.find(w=>w.id===l);return e.jsxs(Po,{className:"ann-table-wrap",children:[e.jsxs("table",{className:"ann-table",children:[e.jsx("thead",{children:e.jsxs("tr",{children:[Pb.map(w=>e.jsx("th",{className:"sortable",onClick:()=>i(w.key),"aria-sort":r.col===w.key?r.dir==="asc"?"ascending":"descending":"none",children:e.jsxs(ye,{label:a("book.table.sort.tip"),side:"bottom",children:[w.label,f(w.key)]})},w.key)),e.jsx("th",{})]})}),e.jsx("tbody",{children:t.map(w=>e.jsxs("tr",{children:[e.jsxs("td",{className:"col-quote",children:[e.jsx(Ho,{text:w.quote||w.note,lines:2,style:Os}),w.tags&&w.tags.length>0&&e.jsx("div",{className:"mt-1.5 flex flex-wrap gap-1.5",children:w.tags.map(v=>{const g=n[v];return e.jsx(Ma,{color:g==null?void 0:g.color,style:g==null?void 0:g.style,children:v},v)})})]}),e.jsx("td",{className:"col-mono",children:gn(w)||"—"}),e.jsx("td",{className:"col-mono",children:w.location||"—"}),e.jsx("td",{className:"col-mono",children:vn(Un(w))||"—"}),e.jsx("td",{className:"col-center",children:w.favorite?"♥":"—"}),e.jsx("td",{className:"col-actions",children:e.jsx(br,{noun:a("unit.quote.one"),nounPlural:a("unit.quote.other"),onCopy:p&&(()=>p(w)),onShare:u&&(()=>u(w)),onEdit:()=>h(w.id),onDelete:()=>setAsking(w)})})]},w.id))})]}),e.jsx(Ke,{open:!!b,onClose:()=>h(null),title:a("common.quote.edit.title"),children:b&&e.jsx(es,{initial:b,onSubmit:w=>d(b.id,w),onCancel:()=>h(null),submitLabel:a("common.action.save.label"),tagSuggestions:Object.keys(n),stickers:o,reloadStickers:s,bookId:b.book_id??null})})]})}function Bb(t,n){if(!n.length||!t||!t.length)return t;const o=new Set(n),s=[];for(const r of n){const i=t.find(l=>l.id===r);i&&s.push(i)}return s.length?[...s,...t.filter(r=>!o.has(r.id))]:t}function Hb({bookId:t,book:n,authorMap:o={},seps:s,onStats:r,mobileFilterOpen:i,onMobileFilterOpen:l,onAdd:h,dataNonce:d}){const[m,p]=c.useState(null),[u,f]=c.useState([]),[b,w]=c.useState(null),[v,g]=c.useState(""),[y,k]=c.useState(""),[j,N]=c.useState(!1),[S,x]=c.useState(null),[L,A]=c.useState(null),[E,D]=c.useState(null),[q,C]=c.useState(""),[I,O]=$e("tippani:annview","tiles"),[V,P]=c.useState({col:"default",dir:"asc"}),[T,B]=c.useState([]),_=c.useRef(0),U=Ie(),F=c.useRef(!0);c.useEffect(()=>{if(F.current){F.current=!1;return}Y(null),Le(),Te()},[d]),c.useEffect(()=>{E&&(r==null||r(E))},[E]);const{stickers:X,reload:R}=Fa(),G=!!(v||y||j),K=c.useMemo(()=>Object.fromEntries(u.map(ie=>[ie.name,ie])),[u]),M=c.useMemo(()=>Object.fromEntries(X.map(ie=>[ie.id,ie])),[X]);function Q(ie){B([]),P(je=>je.col===ie?{col:ie,dir:je.dir==="asc"?"desc":"asc"}:{col:ie,dir:"asc"})}const z=c.useMemo(()=>{const ie=m?[...m]:[];if(I!=="table"||V.col==="default")return ie;const je=V.dir==="asc"?1:-1,Ce=Be=>{switch(V.col){case"quote":return(Be.quote||Be.note||"").toLowerCase();case"chapter":return Be.chapter_no?Be.chapter_no:(Be.chapter||"").toLowerCase();case"location":return Rb(Be);case"date":return Un(Be);case"favorite":return Be.favorite?1:0;default:return 0}};return ie.sort((Be,Ze)=>{const Wt=Ce(Be),sn=Ce(Ze);return Wt<sn?-je:Wt>sn?je:Be.id-Ze.id}),ie},[m,I,V]),te=c.useMemo(()=>Bb(z,T),[z,T]),J=za(te.map(ie=>ie.id)),fe=()=>{J.clear(),Le()},me=Fo(rc),H=c.useMemo(()=>!T.length||!m?0:T.filter(ie=>m.some(je=>je.id===ie)).length,[T,m]),ee=nn(te.length,te,Ed),oe=c.useMemo(()=>te.slice(0,Math.max(ee.count,H)),[te,ee.count,H]),pe=(n==null?void 0:n.id)||t||1,de=c.useMemo(()=>nr(te.length,Da(pe)),[te.length,pe]),[se,Y]=c.useState(null),ce=c.useCallback(ie=>Y(je=>je===ie?null:ie),[]);c.useEffect(()=>{se!=null&&m&&!m.some(ie=>ie.id===se)&&Y(null)},[m,se]),c.useEffect(()=>{Y(null)},[me]);async function Te(){const ie=await Z("GET","/tags");ie.ok&&f(ie.data.tags)}async function Le(){const ie=++_.current,je=new URLSearchParams({book_id:t});v&&je.set("color",v),y&&je.set("tag",y),j&&je.set("favorite","1");const Ce=await Z("GET",`/annotations?${je}`);ie===_.current&&(Ce.ok?(p(Ce.data.annotations),!v&&!y&&!j&&(A(Ce.data.annotations.length),D(Id(Ce.data.annotations)))):C(le(Ce)))}c.useEffect(()=>{Y(null),Le()},[t,v,y,j]),c.useEffect(()=>{Te()},[t]);async function Fe(ie,je){const Ce=await Z("PUT",`/annotations/${ie}`,je);return Ce.ok?(x(null),Le(),Te(),null):le(Ce,a("error.save.annotation"))}const[_e,ne]=c.useState(null);async function he(ie){ne(null);const je=await Qn(`/annotations/${ie.id}`,{reload:Le});je.ok?(A(Ce=>Ce==null?Ce:Ce-1),D(Ce=>Sb(Ce,ie)),Y(null),Le()):C(le(je))}async function qe(ie,je){const Ce=await Z("PUT",`/annotations/${ie.id}`,{...Wr(ie),...je});return Ce.ok?(C(""),Fr(je,{fav:j,color:v,tag:y})?Le():p(Be=>(Be||[]).map(Ze=>Ze.id===ie.id?{...Ze,...Ce.data}:Ze)),!0):(C(le(Ce,a("error.save.annotation"))),!1)}const Ne=ie=>id({quote:ie.quote,note:ie.note,translation:ie.translation,author:n==null?void 0:n.author,title:n==null?void 0:n.title,published:n==null?void 0:n.published_year,chapter:gn(ie),location:ie.location,character:ie.character,date:vn(Un(ie)),tags:ie.tags,color:ie.color,people:o,seps:s,characterImages:ie.character_images}),ae=ie=>ka(Ne(ie)),be=m?G&&L!=null?a("book.quotes.counts.shown",{a:qo(L,"unit.quote"),n:m.length}):qo(m.length,"unit.quote"):"";return e.jsxs("div",{className:"space-y-4",children:[U&&e.jsx(yn,{open:i,onClose:()=>l==null?void 0:l(!1),title:a("book.quotes.filter.title"),footer:e.jsx(wr,{count:be,onReset:()=>{g(""),k(""),N(!1)},onDone:()=>l==null?void 0:l(!1)}),children:e.jsxs("div",{className:"space-y-5",children:[e.jsxs("div",{children:[e.jsx(W,{className:"mb-2 block",children:"color"}),e.jsx(rt,{value:v,onChange:ie=>g(ie===v?"":ie)})]}),u.length>0&&e.jsxs("div",{children:[e.jsx(W,{className:"mb-2 block",children:"tag"}),e.jsx(De,{ariaLabel:a("common.filters.tag.aria"),value:y,onChange:k,options:[["",a("common.filters.tag.all.label")],...u.map(ie=>[ie.name,ie.name])]})]}),e.jsxs("div",{children:[e.jsx(W,{className:"mb-2 block",children:"show only"}),e.jsx("div",{className:"flex flex-wrap items-center gap-2",children:e.jsx("button",{onClick:()=>N(!j),className:ut(j),title:a("common.favourite.filter.tip"),children:"♥ favourites"})})]}),e.jsxs("div",{children:[e.jsx(W,{className:"mb-2 block",children:"view"}),e.jsx(ko,{value:I,onChange:O})]})]})}),!U&&e.jsxs("div",{className:"flex flex-wrap items-center gap-3",children:[e.jsx(W,{children:a("book.quotes.filter.label")}),e.jsx(rt,{value:v,onChange:ie=>g(ie===v?"":ie)}),u.length>0&&e.jsx(De,{ariaLabel:a("common.filters.tag.aria"),value:y,onChange:k,options:[["",a("common.filters.tag.all.label")],...u.map(ie=>[ie.name,ie.name])]}),e.jsx("button",{onClick:()=>N(!j),className:ut(j),title:a("common.favourite.filter.tip"),children:"♥ favourites"}),e.jsxs("span",{className:"ml-auto flex items-center gap-3 view-toggle-row",children:[e.jsx(W,{children:be}),e.jsx(ko,{value:I,onChange:O}),e.jsx(ge,{onClick:()=>h==null?void 0:h("quote",{type:"book",id:t}),children:a("book.quotes.capture.label")})]})]}),e.jsx(ke,{children:q}),m&&m.length===0&&e.jsx(Jt,{children:a(G?"book.quotes.nomatch":"book.quotes.empty")}),J.open&&e.jsx($a,{selection:J,rows:te,onDone:fe,tagSuggestions:Object.keys(K),onEdit:x}),m&&m.length>0&&I==="table"&&e.jsx(Fb,{rows:te,tagMap:K,stickers:X,reloadStickers:R,sort:V,onSort:Q,editingId:S,setEditingId:x,save:Fe,remove:ne,onCopy:ae,onShare:w}),m&&m.length>0&&I==="list"&&e.jsxs("div",{className:"space-y-4",children:[oe.map((ie,je)=>e.jsx(Mo,{a:ie,variant:je%4,tagMap:K,stickerMap:M,stickers:X,reloadStickers:R,editing:S===ie.id,setEditingId:x,save:Fe,patch:qe,remove:ne,onCopy:ae,onShare:w,quoteLines:5,tagSuggestions:Object.keys(K),selection:J},ie.id)),ee.more&&e.jsx("div",{ref:ee.sentinel,"aria-hidden":"true",className:"h-px"})]}),m&&m.length>0&&I==="tiles"&&e.jsxs(e.Fragment,{children:[e.jsx(zo,{columns:me,gap:16,seed:pe,pinnedCount:H,lockOrder:se!=null,order:"source",children:oe.map((ie,je)=>e.jsx(Mo,{a:ie,variant:je%4,tagMap:K,stickerMap:M,stickers:X,reloadStickers:R,editing:S===ie.id,setEditingId:x,save:Fe,patch:qe,remove:ne,onCopy:ae,onShare:w,quoteLines:de[je],tagSuggestions:Object.keys(K),expanded:se===ie.id,onToggleExpand:()=>ce(ie.id),selection:J},ie.id))}),ee.more&&e.jsx("div",{ref:ee.sentinel,"aria-hidden":"true",className:"h-px"})]}),b&&e.jsx(Jo,{share:Ne(b),seen:{kind:"book",id:b.id},onClose:()=>w(null)}),e.jsx(mt,{open:!!_e,title:a("book.quotes.delete.confirm"),body:e.jsxs("p",{className:"microcopy line-clamp-3",children:["“",(_e==null?void 0:_e.quote)||"","”"]}),confirmLabel:a("common.action.delete.label"),onConfirm:()=>he(_e),onCancel:()=>ne(null)})]})}function es({initial:t,onSubmit:n,onCancel:o,submitLabel:s,tagSuggestions:r=[],stickers:i=[],reloadStickers:l,bookId:h=null}){const[d,m]=c.useState((t==null?void 0:t.quote)||""),[p,u]=c.useState((t==null?void 0:t.note)||""),[f,b]=c.useState((t==null?void 0:t.translation)||""),[w,v]=c.useState((t==null?void 0:t.chapter)||""),[g,y]=c.useState(t!=null&&t.chapter_no?String(t.chapter_no):""),[k,j]=c.useState((t==null?void 0:t.location)||""),[N,S]=c.useState((t==null?void 0:t.character)||""),[x,L]=c.useState((t==null?void 0:t.color)||"yellow"),[A,E]=c.useState((t==null?void 0:t.tags)||[]),[D,q]=c.useState((t==null?void 0:t.sticker_id)??null),[C,I]=c.useState(""),[O,V]=c.useState(!1),P=Mc(h?{kind:"book",id:h}:null),T=`ann-${h||0}`,B=!d.trim()&&!p.trim()?a("error.validate.quote-or-note"):"",_=$o(O?a("common.action.save.busy"):B);async function U(F){if(F.preventDefault(),B)return I(B.toLowerCase());V(!0),I("");const X=await n({quote:d.trim(),note:p.trim(),translation:f.trim(),chapter:w.trim(),chapter_no:Number(g.trim())||0,location:k.trim(),character:N.trim(),color:x,tags:A,favorite:!!(t!=null&&t.favorite),sticker_id:D,sticker_x:(t==null?void 0:t.sticker_x)??null,sticker_y:(t==null?void 0:t.sticker_y)??null});if(V(!1),X)return I(X);t||(m(""),u(""),b(""),v(""),j(""),S(""),L("yellow"),E([]),q(null))}return e.jsxs("form",{id:_==null?void 0:_.formId,onSubmit:U,className:"ann-form space-y-3",children:[e.jsxs("label",{className:"block",children:[e.jsx(W,{className:"mb-1.5 block",children:a("common.field.quote.label")}),e.jsx("textarea",{className:"tp-input",rows:"3",value:d,onChange:F=>m(F.target.value)})]}),e.jsxs("label",{className:"block",children:[e.jsx(W,{className:"mb-1.5 block",children:a("common.field.translation.label")}),e.jsx("textarea",{className:"tp-input",rows:"2",placeholder:a("common.field.translation.placeholder"),value:f,onChange:F=>b(F.target.value)})]}),e.jsxs("label",{className:"block",children:[e.jsx(W,{className:"mb-1.5 block",children:a("common.field.note.label")}),e.jsx("textarea",{className:"tp-input",rows:"2",value:p,onChange:F=>u(F.target.value)})]}),e.jsxs("div",{className:"cl-grid",children:[e.jsx(Se,{label:a("common.field.chapter-no.label"),inputMode:"decimal",placeholder:a("book.quote.form.chapter-no.placeholder"),value:g,list:P.chapterNumbers.length?`${T}-chno`:void 0,onChange:F=>y(F.target.value.replace(/[^\d.]/g,"").slice(0,7))}),e.jsx(Se,{label:a("common.field.chapter-name.label"),value:w,list:P.chapterNames.length?`${T}-chname`:void 0,onChange:F=>{const X=F.target.value,R=P.chapterNoFor(X);v(X),R&&!String(g).trim()&&y(String(R))}}),e.jsx(Co,{id:`${T}-chno`,options:P.chapterNumbers}),e.jsx(Co,{id:`${T}-chname`,options:P.chapterNames})]}),e.jsxs("div",{className:"cl-grid",children:[e.jsx(Se,{label:a("common.field.location.label"),placeholder:a("book.quote.form.location.placeholder"),value:k,onChange:F=>j(F.target.value)}),e.jsx(As,{label:a("common.field.character.label"),placeholder:a("book.quote.form.character.placeholder"),value:N,onChange:S,cast:P.cast})]}),e.jsxs("label",{className:"block",children:[e.jsx(W,{className:"mb-1.5 block",children:a("common.field.tags.label")}),e.jsx(yt,{value:A,onChange:E,suggestions:r,placeholder:a("common.field.tags.placeholder"),ariaLabel:a("common.field.tags.label")})]}),e.jsxs("div",{className:"block",children:[e.jsx(W,{className:"mb-1.5 block",children:a("common.field.sticker.label")}),e.jsx(Xo,{value:D,onChange:q,stickers:i,reload:l})]}),e.jsxs("div",{className:"flex flex-wrap items-center gap-3 pt-1",children:[e.jsx(W,{children:a("common.mono.colour.label")}),e.jsx(rt,{value:x,onChange:L}),!_&&e.jsxs("div",{className:"ml-auto flex gap-2",children:[o&&e.jsx(ge,{type:"button",onClick:o,children:a("common.action.cancel.label")}),e.jsx("button",{className:Bd,disabled:O||!!B,title:B||void 0,children:s})]})]}),e.jsx(ke,{children:C})]})}const Wd=Object.freeze(Object.defineProperty({__proto__:null,AnnotationCard:Mo,AnnotationForm:es,EditBook:$d,ManualTab:zd,annDate:Un,annotationState:Wr,default:Ab,fmtDate:vn,isIsbn:Hd},Symbol.toStringTag,{value:"Module"})),ul={movie:{one:"unit.film.one",other:"unit.film.other",past:"film.shelf.cap.past.label"},show:{one:"unit.show.one",other:"unit.show.other",past:"film.shelf.cap.past.label"},game:{one:"unit.game.one",other:"unit.game.other",past:"common.shelf.move.completed.played.label"}};function zb({openId:t,onOpen:n,onClose:o,creditSeparators:s,onAdd:r,onSearch:i,dataNonce:l}){return t?e.jsx(Qb,{id:t,onClose:o,creditSeparators:s,onAdd:r,dataNonce:l,onSearch:i}):e.jsx(Kb,{onOpen:n,creditSeparators:s,dataNonce:l})}function Lo({className:t="",children:n,...o}){const s=Zs();return e.jsx("div",{ref:s,className:"reveal "+t,...o,children:n})}function $b({group:t,coverSize:n,onOpen:o,directorMap:s,creditSeps:r,selection:i,afterBulk:l,setEditWork:h}){const d=nn(t.items.length,t.items);return e.jsxs("section",{children:[e.jsx(zr,{label:t.label,count:t.items.length,noun:a("unit.title.one"),nounPlural:a("unit.title.other")}),e.jsxs("div",{className:"grid gap-x-5 gap-y-8",style:{gridTemplateColumns:`repeat(auto-fill, minmax(${n}px, 1fr))`},children:[t.items.slice(0,d.count).map(m=>e.jsx(Hr,{kind:"movie",item:m,onOpen:o,people:s,seps:r,selection:i,onChanged:l,onEdit:h},m.id)),d.more&&e.jsx("div",{ref:d.sentinel,"aria-hidden":"true",className:"h-px"})]})]})}const Wb=[["none","movies.group.none.label"],["series","movies.group.series.label"],["author","movies.group.author.label"],["decade","movies.group.decade.label"],["genre","movies.group.genre.label"]],ml=()=>Wb.map(([t,n])=>[t,a(n)]),pl=(t,n)=>a("common.count.phrase",{n:t,noun:a(n,{count:t})}),Ur={fontFamily:"var(--font-mono)",fontStyle:"var(--font-mono-style)",fontVariantCaps:"var(--font-mono-caps)",fontVariantNumeric:"var(--font-mono-figures)",fontSize:"var(--type-mono-12)",fontWeight:500,letterSpacing:".12em",textTransform:"uppercase",color:"var(--amber)"};function Ub({path:t,title:n,className:o="",zoomable:s=!1}){const[r,i]=c.useState(!1);if(t){const l=e.jsx("img",{src:Ue(t),alt:n?`Poster of ${n}`:"",className:"block w-full object-cover "+o,style:{aspectRatio:"2 / 3",border:"1px solid var(--line)",borderRadius:8}});return s?e.jsxs(e.Fragment,{children:[e.jsx(ye,{label:a("movies.poster.open.tip"),className:"w-full",children:e.jsx("button",{type:"button",className:"cover-zoom-btn","aria-label":n?a("movies.poster.fullscreen.aria",{title:n}):a("movies.poster.fullscreen.plain.aria"),onClick:()=>i(!0),children:l})}),r&&e.jsx(ir,{path:t,title:n,onClose:()=>i(!1)})]}):l}return e.jsx(Bt,{kind:a("common.badge.poster"),className:"w-full "+o})}function Gb(t){return{title:t.title,director:t.director||"",publisher:t.publisher||"",release_year:t.release_year||0,description:t.description||"",genres:t.genres||[],media_type:t.media_type||"movie",series:t.series||"",series_index:t.series_index||0,favorite:!!t.favorite,imdb_id:t.imdb_id||""}}async function Vb(t,n){const o=await Z("PUT",`/movies/${t}/status`,n);return o.ok?"":le(o,a("error.save.generic"))}function Kb({onOpen:t,creditSeparators:n,dataNonce:o}){var _e;const[s,r]=c.useState(null),{map:i}=Xe("director"),l=c.useMemo(()=>wn(n),[n]),[h,d]=c.useState(null),[m,p]=c.useState([]),[u,f]=c.useState("none"),b=c.useMemo(()=>({mediaType:ct(m,"media"),genre:ct(m,"genre"),series:ct(m,"series"),fav:ct(m,"favourite")==="yes",tagged:ct(m,"tagged")==="yes",noted:ct(m,"noted")==="yes",actor:ct(m,"actor"),wish:{yes:"wishlist",no:"annotated"}[ct(m,"wishlist")]||"",states:bd(m,"shelf")}),[m]),{mediaType:w,genre:v,series:g,fav:y,tagged:k,noted:j,actor:N,wish:S,states:x}=b,L=ne=>p(he=>at(he,"media",ne)),A=ne=>p(he=>at(he,"genre",ne)),E=ne=>p(he=>at(he,"series",ne)),D=ne=>p(he=>at(he,"actor",ne)),q=ne=>p(he=>at(he,"favourite",ne?"yes":"")),C=ne=>p(he=>at(he,"tagged",ne?"yes":"")),I=ne=>p(he=>at(he,"noted",ne?"yes":"")),O=ne=>p(he=>at(he,"wishlist",ne==="wishlist"?"yes":ne==="annotated"?"no":"")),V=ne=>p(he=>yd(he,"shelf",ne)),[P,T]=c.useState("recent"),[B,_]=c.useState(!1),[U,F]=c.useState(""),[X]=dc("tippani:size:movies",150),R=Ie();c.useEffect(()=>(tn(gd(m)),()=>tn([])),[m]);async function G(){const ne=await Z("GET","/movies");ne.ok?r(ne.data.movies):F(le(ne))}c.useEffect(()=>{G()},[o]),c.useEffect(()=>{Z("GET","/metadata/status").then(ne=>{ne.ok&&d(ne.data)})},[]);const K=(_e=h==null?void 0:h.tmdb)==null?void 0:_e.source,M=(s||[]).some(ne=>(ne.media_type||"movie")==="show"),Q=(s||[]).some(ne=>ne.media_type==="game"),z=c.useMemo(()=>{const ne=[["",a("movies.filters.media.all.label")],["movie",a("movies.filters.media.movie.label")]];return M&&ne.push(["show",a("movies.filters.media.show.label")]),Q&&ne.push(["game",a("movies.filters.media.game.label")]),ne},[M,Q]),te=M||Q,J=c.useMemo(()=>{const ne=new Map;for(const he of s||[])for(const qe of he.genres||[])ne.set(qe,(ne.get(qe)||0)+1);return[...ne.keys()].sort((he,qe)=>ne.get(qe)-ne.get(he)||he.localeCompare(qe))},[s]),fe=c.useMemo(()=>{const ne=new Set;for(const he of s||[])he.series&&ne.add(he.series);return[...ne].sort()},[s]),me=c.useMemo(()=>{const ne=new Set;for(const he of s||[])for(const qe of he.actors||[])for(const Ne of tt(qe,l))ne.add(Ne);return[...ne].sort((he,qe)=>he.localeCompare(qe))},[s,l]),H=c.useMemo(()=>{let ne=s||[];return w&&(ne=ne.filter(he=>(he.media_type||"movie")===w)),v&&(ne=ne.filter(he=>(he.genres||[]).includes(v))),g&&(ne=ne.filter(he=>(he.series||"")===g)),N&&(ne=ne.filter(he=>(he.actors||[]).some(qe=>tt(qe,l).includes(N)))),y&&(ne=ne.filter(he=>he.favorite)),k&&(ne=ne.filter(he=>(he.tagged_count||0)>0)),j&&(ne=ne.filter(he=>(he.noted_count||0)>0)),ne=Dd(ne,x),ne=Md(ne,S,he=>he.dialogue_count||0),P==="recent"?Ld(ne,"movie"):(ne=[...ne],P==="title"?ne.sort((he,qe)=>he.title.localeCompare(qe.title)):P==="year"?ne.sort((he,qe)=>(qe.release_year||0)-(he.release_year||0)):P==="series"?ne.sort(xo):P==="read"&&ne.sort(wc),ne)},[s,w,v,g,y,k,j,N,x,S,P,l]),ee=za(H.map(ne=>ne.id)),oe=()=>{ee.clear(),G()},[pe,de]=c.useState(null),se=c.useMemo(()=>u==="none"?null:Pr(H,u,{credit:ne=>ne.director,splitCredit:!0,creditResidual:a("movies.group.residual.director.label"),year:ne=>ne.release_year,genres:ne=>ne.genres||[],series:ne=>ne.series,seps:l,sortMembers:(ne,he)=>he==="series"?[...ne].sort(xo):ne}),[H,u,l]),Y=nn(H.length,H),ce=nn(se?se.length:0,se,12),Te=s?s.length:0,Le=s?s.reduce((ne,he)=>ne+(he.dialogue_count||0),0):0,Fe=s?a("movies.header.counts",{a:pl(Te,"unit.title"),b:pl(Le,"unit.dialogue")}):null;return e.jsxs($r,{mobile:R,title:a("movies.header.title"),counts:Fe,error:U,onExport:()=>_(!0),headerAside:e.jsx(W,{className:"hidden sm:inline",children:a(K==="none"?"movies.header.nokey.label":"movies.header.lookup.label")}),loaded:s!=null,hasItems:!!(s&&s.length>0),shownCount:H.length,emptyText:a("movies.board.empty"),noMatchText:a("movies.board.nomatch"),genres:J,genre:v,setGenre:A,fav:y,setFav:q,tagged:k,setTagged:C,noted:j,setNoted:I,wish:S,setWish:O,states:x,setStates:V,kind:"movie",noun:a("unit.title.one"),nounPlural:a("unit.title.other"),seriesNames:fe,series:g,setSeries:E,sort:P,setSort:T,creditNames:me,credit:N,setCredit:D,creditNoun:a("unit.actor.one"),creditNounPlural:a("unit.actor.other"),seriesNoun:a("unit.collection.one"),seriesNounPlural:a("unit.collection.other"),sortOptions:[["recent",a("movies.sort.recent.label")],["title",a("movies.sort.title.label")],["year",a("movies.sort.year.label")],["series",a("movies.sort.series.label")],["read",a("movies.sort.read.label")]],activeStates:Q?["watching","playing"]:["watching"],leading:te&&z.map(([ne,he])=>e.jsx("button",{className:ut(w===ne),onClick:()=>L(ne),children:he},ne)),leadingMobile:te&&e.jsxs("div",{children:[e.jsx(W,{className:"mb-2 block",children:"type"}),e.jsx("div",{className:"flex flex-wrap items-center gap-2",children:z.map(([ne,he])=>e.jsx("button",{className:ut(w===ne),onClick:()=>L(ne),children:he},ne))})]}),trailing:e.jsxs("label",{className:"flex items-center gap-2",children:[e.jsx(W,{children:a("common.mono.group.label")}),e.jsx(De,{ariaLabel:a("common.filters.group.aria"),value:u,onChange:f,options:ml()})]}),trailingMobile:e.jsxs("div",{children:[e.jsx(W,{className:"mb-2 block",children:"group"}),e.jsx(De,{ariaLabel:a("common.filters.group.aria"),value:u,onChange:f,options:ml()})]}),onReset:()=>{p([]),f("none"),T("recent")},exportDialog:e.jsx(mt,{open:B,title:a("movies.export.confirm.title"),body:(()=>{const ne=H.filter(ae=>(ae.media_type||"movie")==="show").length,he=H.filter(ae=>ae.media_type==="game").length,qe=H.length-ne-he,Ne=[qe>0&&a("movies.export.count.movies",{count:qe,n:qe}),ne>0&&a("movies.export.count.shows",{count:ne,n:ne}),he>0&&a("movies.export.count.games",{count:he,n:he})].filter(Boolean);return a("movies.export.confirm.body",{a:Ne.join(" · ")||a("movies.export.count.none")})})(),confirmLabel:a("common.action.export.label"),onCancel:()=>_(!1),onConfirm:async()=>{_(!1),await Vs("/export/movies",{ids:H.map(ne=>ne.id)},"tippani-titles.md")}}),children:[ee.open&&e.jsx($a,{selection:ee,rows:H,onDone:oe,onEdit:de}),pe!=null&&e.jsx(Zb,{kind:"movies",id:pe,title:a("film.form.edit.title"),onDone:()=>{de(null),oe()},onCancel:()=>de(null)}),se?e.jsxs("div",{className:"space-y-10",children:[se.slice(0,ce.count).map(ne=>e.jsx($b,{group:ne,coverSize:X,onOpen:t,directorMap:i,creditSeps:l,selection:ee,afterBulk:oe,setEditWork:de},ne.key)),ce.more&&e.jsx("div",{ref:ce.sentinel,"aria-hidden":"true",className:"h-px"})]}):e.jsxs(Lo,{className:"grid gap-x-5 gap-y-8",style:{gridTemplateColumns:`repeat(auto-fill, minmax(${X}px, 1fr))`},children:[H.slice(0,Y.count).map(ne=>e.jsx(Hr,{kind:"movie",item:ne,onOpen:t,people:i,seps:l,selection:ee,onChanged:oe,onEdit:de},ne.id)),Y.more&&e.jsx("div",{ref:Y.sentinel,"aria-hidden":"true",className:"h-px"})]})]})}function Gr(t){return`#${t.source==="tvdb"?t.source_id:t.tmdb_id||t.source_id}`}function Yb(t){return`${(t.source||"tmdb").toUpperCase()} ${Gr(t)}`}function Rs(t,n){return{source:t.source||"tmdb",source_id:t.source==="tvdb"?t.source_id:String(t.tmdb_id||t.source_id),media_type:t.media_type||n}}function Ud({confirm:t,busy:n,onEnrich:o,onAddSeparate:s,onCancel:r}){return e.jsxs("div",{className:"hand-card hc-r1 space-y-3 p-4",style:{borderLeft:"4px solid var(--amber, var(--accent))"},children:[e.jsxs("p",{className:"text-sm",children:["You already have a title named ",e.jsxs("b",{children:["“",t.cand.title,"”"]}),". Enrich it with this metadata (keeps its dialogues), or add “",t.cand.title,"” as a separate title."]}),e.jsx("ul",{className:"space-y-2",children:t.existing.map(i=>e.jsxs("li",{className:"flex items-center gap-3 rounded-xl px-3 py-2",style:{border:"1px solid var(--line)"},children:[e.jsxs("div",{className:"min-w-0 flex-1",children:[e.jsxs("p",{className:"truncate text-sm font-semibold",children:[i.title,i.release_year?e.jsx("span",{className:"ml-2 font-normal",style:{color:"var(--soft)"},children:i.release_year}):null]}),e.jsx("p",{className:"truncate text-xs",style:{color:"var(--faint)"},children:[a("movies.duplicate.dialogues",{count:i.dialogue_count,n:i.dialogue_count}),a(i.has_poster?"movies.duplicate.poster.yes":"movies.duplicate.poster.no")].join(" · ")})]}),e.jsx(ge,{icon:e.jsx(Kn,{}),type:"button",className:"shrink-0",disabled:n,onClick:()=>o(i.id),children:a("movies.duplicate.enrich.label")})]},i.id))}),e.jsxs("div",{className:"flex flex-wrap gap-2",children:[e.jsx("button",{type:"button",className:"tp-btn tp-btn-primary",disabled:n,onClick:s,children:a("movies.duplicate.separate.label")}),e.jsx(ge,{type:"button",disabled:n,onClick:r,children:a("common.action.cancel.label")})]})]})}function Gd({mediaType:t,setMediaType:n,title:o,setTitle:s,onAdded:r,formId:i,onBusy:l}){const[h,d]=c.useState(""),[m,p]=c.useState(""),[u,f]=c.useState(""),[b,w]=c.useState([]),[v,g]=c.useState([]);c.useEffect(()=>{Z("GET","/genres").then(q=>{q.ok&&g(q.data.genres||[])})},[]);const[y,k]=c.useState(""),[j,N]=c.useState(""),[S,x]=c.useState(""),[L,A]=c.useState(""),E=t==="game";async function D(q){if(q.preventDefault(),!o.trim())return A(a("error.validate.title-required.lower"));l==null||l(!0),A("");const C=await Z("POST","/movies",{title:o.trim(),media_type:t,director:h.trim()||void 0,publisher:E?m.trim():void 0,release_year:u?bn(u).year:void 0,release_circa:u?bn(u).circa:void 0,genres:b,series:y.trim()||void 0,series_index:Number(j)||0,description:S.trim()||void 0});l==null||l(!1),C.ok?r(C.data):A(le(C,a("error.add.title")))}return e.jsxs("form",{id:i,onSubmit:D,className:"space-y-2.5",children:[e.jsxs("div",{className:"grid gap-2.5 sm:grid-cols-2",children:[e.jsx(Et,{placeholder:a("film.form.title.placeholder"),value:o,onChange:q=>s(q.target.value)}),e.jsx(Et,{placeholder:qd(t),value:h,onChange:q=>d(q.target.value)}),E&&e.jsx(Et,{placeholder:a("film.form.publisher.placeholder"),value:m,onChange:q=>p(q.target.value)}),e.jsx("input",{className:"tp-input",placeholder:a("film.form.year.placeholder"),inputMode:"numeric",value:u,maxLength:4,onChange:q=>f(q.target.value.replace(/\D/g,"").slice(0,4))}),e.jsx(yt,{value:b,onChange:w,suggestions:v,placeholder:a("common.field.genres.placeholder"),ariaLabel:a("common.field.genres.label"),transform:Wo}),e.jsx(Et,{placeholder:a("film.form.series.placeholder"),value:y,onChange:q=>k(q.target.value)}),e.jsx("input",{className:"tp-input",placeholder:a("film.form.series-no.placeholder"),inputMode:"decimal",value:j,onChange:q=>N(q.target.value)})]}),e.jsx("textarea",{className:"tp-input",rows:"3",placeholder:a("film.form.description.placeholder"),value:S,onChange:q=>x(q.target.value)}),e.jsx(ke,{children:L}),!o.trim()&&e.jsx("p",{className:"microcopy",style:{color:"var(--faint)"},children:a("film.form.missing.hint")})]})}function Vd({value:t,onChange:n}){return e.jsx(dt,{ariaLabel:a("film.form.media.aria"),value:t,onChange:n,options:[["movie",a("film.form.media.movie.label")],["show",a("vocab.kind.show.label")],["game",a("vocab.kind.game.label")]]})}function Qb({id:t,onClose:n,creditSeparators:o,onAdd:s,onSearch:r,dataNonce:i}){const{practise:l,practiceDialog:h}=Ia(),[d,m]=c.useState(null),[p,u]=c.useState(!1),[f,b]=c.useState(""),[w,v]=c.useState(!1),[g,y]=c.useState(null),[k,j]=c.useState(null),N=(k==null?void 0:k.total)??null,[S,x]=c.useState(null),[L,A]=c.useState(null),[E,D]=c.useState(null),[q,C]=c.useState(""),[I,O]=c.useState(!1),V=(d==null?void 0:d.media_type)||"movie",P=fb(V),{map:T}=Xe(P),B=Ie(),_=c.useMemo(()=>wn(o),[o]);async function U(){const se=await Z("GET",`/movies/${t}`);se.ok?m(se.data):b(le(se))}c.useEffect(()=>{m(null),u(!1),j(null),U()},[t]),c.useEffect(()=>(tn(d?[wd("movie",d.id,d.title)]:[]),()=>tn([])),[d]);const F=d?Wn("movie",d):"movie",X=pt[F],R=ul[F]||ul.movie;async function G(se,Y){O(!0);const ce={status:se,progress:(d==null?void 0:d.progress)||0,pos_unit:(d==null?void 0:d.pos_unit)||"",pos:(d==null?void 0:d.pos)||0,pos_total:(d==null?void 0:d.pos_total)||0,season:(d==null?void 0:d.season)||0,season_total:(d==null?void 0:d.season_total)||0};se===X?ce.started_at=Y||"":(se==="completed"||se==="abandoned")&&(ce.finished_at=Y||"");const Te=await Z("PUT",`/movies/${t}/status`,ce);O(!1),Te.ok?m(Te.data):b(le(Te,a("error.save.generic")))}async function K(se){if(d){if(se===X&&d.status!=="paused"){const Y=await Z("GET","/movies");if(!Y.ok)return b(le(Y));const ce=(Y.data.movies||[]).filter(Te=>xa("movie",Te)&&Te.id!==d.id&&Wn("movie",Te)===F);if(ce.length>=Rn[F]){C(""),A(ce);return}}if(se===""||se==="paused")return G(se,"");x({status:se,date:Qt()})}}async function M(se){D(se.id);const Y=await Vb(se.id,{status:"completed",finished_at:Qt()});if(D(null),Y)return C(Y);const ce=L.filter(Te=>Te.id!==se.id);if(ce.length<Rn[F]){A(null),x({status:X,date:Qt()});return}A(ce)}async function Q(se){O(!0);const Y=await Z("PUT",`/movies/${t}/status`,{status:d.status,...se});O(!1),Y.ok?m(Y.data):b(le(Y,a("error.save.generic")))}const[z,te]=c.useState(!1);async function J(){te(!1);const se=await Qn(`/movies/${t}`,{label:a("film.toast.deleted")});se.ok?n():b(le(se))}async function fe(se){const Y=await Z("PUT",`/movies/${t}`,{...Gb(d),...se});Y.ok?m(Y.data):b(le(Y,a("error.save.generic")))}d&&d.media_type;const me=d!=null&&d.director?tt(d.director,_):[],H=me.length>0?e.jsxs("span",{style:{display:"inline-flex",alignItems:"center",flexWrap:"wrap",columnGap:6,rowGap:2},children:[e.jsx("span",{children:pb(V)}),me.map((se,Y)=>e.jsxs(c.Fragment,{children:[Y>0&&e.jsx("span",{"aria-hidden":"true",style:{marginLeft:-2},children:","}),e.jsx(Qo,{kind:P,name:se,person:T[se],size:28,onOpen:y,nameClassName:"",nameStyle:{font:"inherit",color:"inherit",background:"none",border:"none",padding:0,cursor:"pointer",textDecoration:"underline",textUnderlineOffset:2}})]},se))]},"director"):null,ee=V==="game"&&(d!=null&&d.publisher)?e.jsx("span",{children:a("film.credit.publisher.label",{name:d.publisher})},"publisher"):null,oe=d?[H,ee,Pt(d.release_year,d.release_circa)||null,lr(d)||null].filter(Boolean):[],pe=d?d.title||a("film.title.fallback"):"";Xs(pe);const de=d&&(d.director||Pt(d.release_year,d.release_circa))||"";return Aa({sub:de||null,actions:()=>[{id:"h-do",heading:a("common.mono.actions.label")},{id:"shelf",icon:e.jsx(xc,{size:24}),label:pn("movie",(d==null?void 0:d.status)||"",X,d||{}),onClick:()=>K(X)},{id:"details",icon:e.jsx(Ft,{}),label:a("common.work.details.title"),onClick:()=>u(!0)},{id:"practise",icon:e.jsx(Ht,{}),label:a("film.practise.menu.label"),onClick:()=>d&&l({movie:d.id,label:d.title})},{id:"export",icon:e.jsx(st,{}),label:a("film.export.label"),onClick:()=>{d&&(window.location.href=`/api/movies/${d.id}/export`)}},{id:"delete",icon:e.jsx(ze,{}),label:a("common.action.delete.label"),onClick:()=>te(!0),danger:!0}],keys:B?[{id:"filter",label:a("film.filter.aria"),icon:e.jsx(Rt,{}),onClick:()=>v(!0)},{id:"details",label:a("common.work.details.title"),icon:e.jsx(Ft,{}),onClick:()=>u(!0)}]:null}),e.jsxs("section",{className:"space-y-6 md:pt-5","data-screen-label":"movie-detail",children:[!B&&e.jsx("button",{onClick:n,style:{background:"none",border:"none",padding:"2px 0",fontFamily:"var(--font-mono)",fontWeight:"var(--font-mono-weight)",fontStyle:"var(--font-mono-style)",fontVariantCaps:"var(--font-mono-caps)",textTransform:"var(--font-mono-case)",fontVariantNumeric:"var(--font-mono-figures)",fontSize:"var(--type-mono-12)",letterSpacing:".1em",color:"var(--soft)"},children:"← Catalogue"}),e.jsx(ke,{children:f}),d&&e.jsx(Lo,{children:e.jsx(Fd,{cover:e.jsx(Ub,{path:d.poster_path,title:d.title,zoomable:!0}),title:d.title,titleSize:"var(--type-display-26)",meta:oe.length>0&&e.jsx("div",{style:{...Ur,display:"flex",flexWrap:"wrap",alignItems:"center",rowGap:2},children:oe.map((se,Y)=>e.jsxs(c.Fragment,{children:[Y>0&&e.jsx("span",{"aria-hidden":"true",style:{margin:"0 8px"},children:"·"}),se]},Y))}),counts:e.jsx(Pd,{counts:k,noun:[a("unit.line.one"),a("unit.line.other")],tone:"amber"}),favorite:d.favorite,onFavorite:se=>fe({favorite:se}),tags:e.jsx(Rd,{kind:"movie",item:d,status:d.status,progress:d.progress,pos:d,reads:d.reads,onReadsChanged:U,wishlist:N===0,busy:I,onSelect:K,onProgress:Q}),genres:d.genres||[],description:d.description,actions:B?null:e.jsxs(e.Fragment,{children:[e.jsx(ge,{onClick:()=>K(X),disabled:I,children:pn("movie",d.status||"",X,d)}),e.jsx(We,{icon:e.jsx(st,{}),label:a("common.action.export.label"),ariaLabel:a("film.export.aria"),onClick:()=>window.location.href=`/api/movies/${d.id}/export`,tooltip:a("film.export.tip")}),e.jsx(We,{icon:e.jsx(Ht,{}),label:a("common.action.practise.label"),ariaLabel:a("film.practise.aria"),onClick:()=>l({movie:d.id,label:d.title}),tooltip:a("film.practise.tip")}),e.jsx(We,{icon:e.jsx(Ft,{}),label:a("common.work.details.title"),ariaLabel:a("common.work.details.title"),onClick:()=>u(!0),tooltip:a("film.details.tip")}),e.jsx(We,{icon:e.jsx(ze,{}),label:a("common.action.delete.label"),ariaLabel:a("film.delete.aria"),onClick:()=>te(!0),danger:!0,tooltip:a("film.delete.tip")})]})})}),d&&e.jsx(Zc,{open:p,onClose:()=>u(!1),kind:"movie",item:d,onChanged:m,onDelete:J}),e.jsx(_d,{open:!!L,items:(L||[]).map(se=>({id:se.id,title:se.title,meta:[se.director,Pt(se.release_year,se.release_circa)||null].filter(Boolean).join(" · ")})),cap:Rn[F],noun:a(R.one),nounPlural:a(R.other),verb:It(X,"movie"),pastLabel:a(R.past),busyId:E,error:q,onRelease:M,onCancel:()=>A(null),onProceed:()=>{A(null),x({status:X,date:Qt()})}}),e.jsx(Od,{open:!!S,title:S?pn("movie",(d==null?void 0:d.status)||"",S.status,d||{}):"",label:a((S==null?void 0:S.status)===X?"film.shelf.started.label":(S==null?void 0:S.status)==="abandoned"?"film.shelf.abandoned.label":"film.shelf.finished.label"),value:(S==null?void 0:S.date)||"",onChange:se=>x(Y=>Y&&{...Y,date:se}),onCancel:()=>x(null),onConfirm:()=>{const se=S;x(null),G(se.status,se.date)}}),d&&e.jsx(Xb,{movieId:d.id,cast:d.cast||[],movie:d,creditSeps:_,onStats:j,mobileFilterOpen:w,onMobileFilterOpen:v,onAdd:s,dataNonce:i}),g&&e.jsx(Sn,{kind:g.kind,name:g.name,onClose:()=>y(null)}),h,e.jsx(Br,{open:z,kind:"movie",title:(d==null?void 0:d.title)||"",count:(k==null?void 0:k.total)||0,onConfirm:J,onCancel:()=>te(!1)})]})}function Zb({kind:t,id:n,title:o,onDone:s,onCancel:r}){const[i,l]=c.useState(null),[h,d]=c.useState("");return c.useEffect(()=>{l(null),d(""),Z("GET",`/${t}/${n}`).then(m=>m.ok?l(m.data):d(le(m)))},[t,n]),e.jsx(Ke,{open:!0,onClose:r,title:o,children:h?e.jsx(ke,{children:h}):i?e.jsx(Kd,{movie:i,onSaved:s,onCancel:r}):e.jsx("p",{className:"microcopy",children:"loading…"})})}function Kd({movie:t,onSaved:n,onCancel:o}){const[s,r]=c.useState(t.title||""),[i,l]=c.useState(t.media_type||"movie"),[h,d]=c.useState(t.director||""),[m,p]=c.useState(t.publisher||""),[u,f]=c.useState(Pt(t.release_year,t.release_circa)),[b,w]=c.useState(t.genres||[]),[v,g]=c.useState([]);c.useEffect(()=>{Z("GET","/genres").then(M=>{M.ok&&g(M.data.genres||[])})},[]);const[y,k]=c.useState(t.series||""),[j,N]=c.useState(t.series_index?String(t.series_index):""),[S,x]=c.useState(t.description||""),[L,A]=c.useState(t.tmdb_id?String(t.tmdb_id):""),[E,D]=c.useState(t.tvdb_id?String(t.tvdb_id):""),[q,C]=c.useState(t.poster_path||""),[I,O]=c.useState(""),[V,P]=c.useState(!1),[T,B]=c.useState(""),[_,U]=c.useState(!1),[F,X]=c.useState(!1),R=i==="game";async function G(M){if(M.preventDefault(),!s.trim())return B(a("error.validate.title-required.lower"));U(!0),B("");const Q=await Z("PUT",`/movies/${t.id}`,{title:s.trim(),media_type:i,director:h.trim(),publisher:m.trim(),release_year:u?bn(u).year:void 0,release_circa:u?bn(u).circa:void 0,genres:b,series:y.trim(),series_index:Number(j)||0,description:S.trim(),favorite:!!t.favorite,tmdb_id:lt(L),tvdb_id:lt(E),poster_url:I||void 0,clear_cover:V||void 0});U(!1),Q.ok?n():B(le(Q,a("error.save.generic")))}async function K(M){U(!0),B("");const Q=await Z("PUT",`/movies/${t.id}`,{source:M.source||"tmdb",source_id:M.source==="tvdb"?M.source_id:String(M.tmdb_id||M.source_id),media_type:M.media_type||i});U(!1),Q.ok?n():B(le(Q,a("error.sync.source")))}return e.jsxs("form",{onSubmit:G,className:"space-y-2.5",children:[e.jsx(vr,{kind:"movies",id:t.id,currentPath:q,coverUrl:I,clearCover:V,onSetUrl:M=>{O(M),P(!1)},onClear:M=>{M===!0?(O(""),P(!1)):(P(!0),O(""))},onUploaded:M=>C(M.poster_path||""),onFetchMeta:()=>X(M=>!M),fetchMetaOpen:F,search:{title:s,year:u,mediaType:i,tmdbId:L,tvdbId:E}}),e.jsx(Vd,{value:i,onChange:l}),F&&e.jsxs("div",{children:[e.jsx(W,{className:"mb-1.5 block",children:a("film.resync.pick.label")}),e.jsx(Rc,{auto:!0,title:s,year:u,mediaType:i,tmdbId:L,tvdbId:E,onPick:K})]}),e.jsxs("div",{className:"grid gap-2.5 sm:grid-cols-2",children:[e.jsx(Et,{placeholder:a("film.form.title.placeholder"),value:s,onChange:M=>r(M.target.value)}),e.jsx(Et,{placeholder:qd(i),value:h,onChange:M=>d(M.target.value)}),R&&e.jsx(Et,{placeholder:a("film.form.publisher.placeholder"),value:m,onChange:M=>p(M.target.value)}),e.jsx("input",{className:"tp-input",placeholder:a("film.form.year.placeholder"),inputMode:"numeric",value:u,maxLength:4,onChange:M=>f(M.target.value.replace(/\D/g,"").slice(0,4))}),e.jsx(yt,{value:b,onChange:w,suggestions:v,placeholder:a("common.field.genres.placeholder"),ariaLabel:a("common.field.genres.label"),transform:Wo}),e.jsx(Et,{placeholder:a("film.form.series.placeholder"),value:y,onChange:M=>k(M.target.value)}),e.jsx("input",{className:"tp-input",placeholder:a("film.form.series-no.placeholder"),inputMode:"decimal",value:j,onChange:M=>N(M.target.value)}),e.jsx("input",{className:"tp-input",placeholder:a("film.form.tmdb-id.placeholder"),inputMode:"numeric",value:L,onChange:M=>A(M.target.value.replace(/\D/g,"").slice(0,12))}),e.jsx("input",{className:"tp-input",placeholder:a("film.form.tvdb-id.placeholder"),inputMode:"numeric",value:E,onChange:M=>D(M.target.value.replace(/\D/g,"").slice(0,12))})]}),e.jsx("textarea",{className:"tp-input",rows:"4",placeholder:a("film.form.description.placeholder"),value:S,onChange:M=>x(M.target.value)}),e.jsx(ke,{children:T}),e.jsxs("div",{className:"flex gap-2",children:[e.jsx("button",{className:"tp-btn tp-btn-primary",disabled:_||!s.trim(),children:"Save"}),e.jsx(ge,{type:"button",onClick:o,children:"Cancel"})]})]})}function hn(t){const n=String(t??"").trim();if(n==="")return null;const o=Number(n);return Number.isInteger(o)&&o>=0?o:null}function Vr(t){return{quote:t.quote||"",note:t.note||"",color:t.color||"yellow",character:t.character||"",actor:t.actor||"",timestamp:t.timestamp||"",season:t.season??null,episode:t.episode??null,episode_name:t.episode_name||"",act:t.act||"",quest:t.quest||"",translation:t.translation||"",tags:t.tags||[],favorite:!!t.favorite,sticker_id:t.sticker_id??null,sticker_x:t.sticker_x??null,sticker_y:t.sticker_y??null}}function Xb({movieId:t,cast:n,movie:o,creditSeps:s,onStats:r,mobileFilterOpen:i,onMobileFilterOpen:l,onAdd:h,dataNonce:d}){const m=(o==null?void 0:o.media_type)==="show",p=(o==null?void 0:o.media_type)==="game",[u,f]=c.useState(null),[b,w]=c.useState([]),[v,g]=c.useState(null),[y,k]=c.useState(null),[j,N]=c.useState(""),[S,x]=c.useState(!1),[L,A]=c.useState(""),[E,D]=c.useState(null),q=c.useRef(!0);c.useEffect(()=>{if(q.current){q.current=!1;return}de(null),ce(),Y()},[d]);const[C,I]=c.useState(""),[O,V]=$e("tippani:view:dialogues","tiles"),[P,T]=c.useState({col:m?"episode":"timestamp",dir:"asc"}),B=Fo(rc),_=c.useRef(0),U=yc(),F=ae=>T(be=>be.col===ae?{col:ae,dir:be.dir==="asc"?"desc":"asc"}:{col:ae,dir:"asc"}),X=Ie(),{stickers:R,reload:G}=Fa(),{map:K,reload:M}=Xe("actor");tf("movie",t,n,()=>ce());const Q=c.useMemo(()=>[...new Set(n.map(ae=>(ae.actor||"").trim()).filter(Boolean))],[n]);Pc("actor",Q,K,M);const z=`cast-characters-${t}`,te=[...new Set(n.map(ae=>ae.character).filter(Boolean))],J=Object.fromEntries(b.map(ae=>[ae.name,ae])),fe=c.useMemo(()=>Object.fromEntries(R.map(ae=>[ae.id,ae])),[R]),me=Number(t)||1,H=c.useMemo(()=>nr((u==null?void 0:u.length)||0,Da(me)),[u==null?void 0:u.length,me]),ee=za((u||[]).map(ae=>ae.id)),oe=()=>{ee.clear(),ce()},[pe,de]=c.useState(null),se=c.useCallback(ae=>de(be=>be===ae?null:ae),[]);c.useEffect(()=>{pe!=null&&u&&!u.some(ae=>ae.id===pe)&&de(null)},[u,pe]),c.useEffect(()=>{de(null)},[B]);async function Y(){const ae=await Z("GET","/tags");ae.ok&&w(ae.data.tags)}async function ce(){const ae=++_.current,be=new URLSearchParams({movie_id:t});j&&be.set("tag",j),S&&be.set("favorite","1"),L&&be.set("color",L);const ie=await Z("GET",`/dialogues?${be}`);ae===_.current&&(ie.ok?f(ie.data.dialogues):I(le(ie)))}c.useEffect(()=>{de(null),ce()},[t,j,S,L]),c.useEffect(()=>{Y()},[t]),c.useEffect(()=>{u&&!j&&!S&&!L&&(r==null||r(Id(u)))},[u,j,S,L]);async function Te(ae,be){const ie=await Z("PUT",`/dialogues/${ae}`,be);return ie.ok?(D(null),ce(),Y(),null):le(ie,a("error.save.dialogue"))}const[Le,Fe]=c.useState(null);async function _e(ae){Fe(null);const be=await Qn(`/dialogues/${ae.id}`,{reload:ce});be.ok?(de(null),ce()):I(le(be))}async function ne(ae,be){const ie=await Z("PUT",`/dialogues/${ae.id}`,{...Vr(ae),...be});if(!ie.ok)return I(le(ie,a("error.save.dialogue")));I(""),Fr(be,{fav:S,color:L,tag:j})?ce():f(je=>(je||[]).map(Ce=>Ce.id===ae.id?{...Ce,...ie.data}:Ce))}const he=j||S||L,qe=ae=>ld({quote:ae.quote,note:ae.note,translation:ae.translation,color:ae.color,title:o==null?void 0:o.title,year:o==null?void 0:o.release_year,character:ae.character,actor:ae.actor,timestamp:ae.timestamp,episode:xn(ae),tags:ae.tags,tmdbId:o==null?void 0:o.tmdb_id,tvdbId:o==null?void 0:o.tvdb_id,people:K,seps:s,characterImages:ae.character_images}),Ne=ae=>ka(qe(ae));return e.jsxs("div",{className:"space-y-4",children:[X&&e.jsx(yn,{open:i,onClose:()=>l==null?void 0:l(!1),title:a("film.lines.filter.title"),footer:e.jsx(wr,{count:u?`${u.length} shown`:"",onReset:()=>{N(""),x(!1),A("")},onDone:()=>l==null?void 0:l(!1)}),children:e.jsxs("div",{className:"space-y-5",children:[e.jsxs("div",{children:[e.jsx(W,{className:"mb-2 block",children:"character / tag"}),e.jsx("input",{className:"tp-input",list:te.length>0?z:void 0,placeholder:a("film.lines.filter.placeholder"),value:j,onChange:ae=>N(ae.target.value)})]}),e.jsxs("div",{children:[e.jsx(W,{className:"mb-2 block",children:"show only"}),e.jsx("div",{className:"flex flex-wrap items-center gap-2",children:e.jsx("button",{onClick:()=>x(!S),className:ut(S),title:a("common.favourite.filter.tip"),children:"♥ favourites"})})]}),e.jsxs("div",{children:[e.jsx(W,{className:"mb-2 block",children:"colour"}),e.jsx(rt,{value:L,onChange:ae=>A(ae===L?"":ae)})]}),e.jsxs("div",{children:[e.jsx(W,{className:"mb-2 block",children:"view"}),e.jsx(ko,{value:O,onChange:V})]})]})}),!X&&e.jsxs("div",{className:"flex flex-wrap items-center gap-2",children:[e.jsxs(W,{children:["Dialogues",u?` · ${u.length}`:""]}),e.jsxs("div",{className:"ml-auto flex flex-wrap items-center gap-2",children:[e.jsx("button",{onClick:()=>x(!S),className:ut(S),title:a("common.favourite.filter.tip"),children:"♥ Favourites"}),e.jsx(rt,{value:L,onChange:ae=>A(ae===L?"":ae)}),b.length>0&&e.jsx(De,{ariaLabel:a("common.filters.tag.aria"),value:j,onChange:N,options:[["",a("film.lines.filter.tag.all.label")],...b.map(ae=>[ae.name,ae.name])]}),e.jsx(ko,{value:O,onChange:V}),e.jsx(ge,{onClick:()=>h==null?void 0:h("quote",{type:"movie",id:t}),children:a("film.lines.capture.label")})]})]}),te.length>0&&e.jsx("datalist",{id:z,children:te.map(ae=>e.jsx("option",{value:ae},ae))}),e.jsx(ke,{children:C}),u&&u.length===0&&e.jsx(Jt,{children:a(he?"film.lines.nomatch":"film.lines.empty")}),ee.open&&e.jsx($a,{selection:ee,rows:u||[],onDone:oe,tagSuggestions:Object.keys(J),onEdit:D}),u&&u.length>0&&O==="tiles"&&e.jsx(Lo,{children:e.jsx(zo,{columns:B,gap:16,seed:me,lockOrder:pe!=null,order:"source",children:u.map((ae,be)=>e.jsx(Is,{d:ae,wrapClass:"",tagMap:J,stickerMap:fe,stickers:R,reloadStickers:G,editing:E===ae.id,show:m,game:p,cast:n,onEdit:()=>D(ae.id),onCancelEdit:()=>D(null),onSave:ie=>Te(ae.id,ie),onPatch:ie=>ne(ae,ie),onDelete:()=>Fe(ae),onCopy:()=>Ne(ae),onShare:()=>g(ae),onOpenPerson:k,actorMap:K,seps:s,quoteLines:H[be],expanded:pe===ae.id,onToggleExpand:()=>se(ae.id),selection:ee},ae.id))})}),u&&u.length>0&&O==="list"&&e.jsxs(Lo,{className:"film-strip",children:[e.jsx(vo,{count:15}),e.jsx(bc,{code:Ns(U)}),u.map((ae,be)=>e.jsxs(c.Fragment,{children:[be>0&&e.jsx(Jb,{code:Ns(U,be)}),e.jsx(Is,{d:ae,tagMap:J,stickerMap:fe,stickers:R,reloadStickers:G,editing:E===ae.id,show:m,game:p,cast:n,onEdit:()=>D(ae.id),onCancelEdit:()=>D(null),onSave:ie=>Te(ae.id,ie),onPatch:ie=>ne(ae,ie),onDelete:()=>Fe(ae),onCopy:()=>Ne(ae),onShare:()=>g(ae),onOpenPerson:k,actorMap:K,seps:s,quoteLines:5,selection:ee})]},ae.id)),e.jsx(vo,{count:15})]}),u&&u.length>0&&O==="table"&&e.jsx(ny,{rows:ty(u,P),tagMap:J,stickers:R,reloadStickers:G,sort:P,onSort:F,editingId:E,setEditingId:D,save:Te,remove:Fe,show:m,game:p,cast:n,actorMap:K,onCopy:Ne,onShare:g}),v&&e.jsx(Jo,{share:qe(v),seen:{kind:"screen",id:v.id},onClose:()=>g(null)}),e.jsx(mt,{open:!!Le,title:a("film.lines.delete.confirm"),body:e.jsxs("p",{className:"microcopy line-clamp-3",children:["“",(Le==null?void 0:Le.quote)||"","”"]}),confirmLabel:a("common.action.delete.label"),onConfirm:()=>_e(Le),onCancel:()=>Fe(null)}),y&&e.jsx(Sn,{kind:y.kind,name:y.name,onClose:()=>k(null)})]})}function Jb({code:t}){const n={borderTop:"1px solid color-mix(in srgb, var(--amber) 22%, transparent)"};return e.jsxs("div",{className:"mx-4 flex items-center gap-3 py-1.5","aria-hidden":"true",children:[e.jsx("span",{className:"flex-1",style:n}),e.jsx(cm,{children:t}),e.jsx("span",{className:"flex-1",style:n})]})}const ey=t=>[{key:"quote",label:a("film.table.quote.label")},{key:"character",label:a("film.table.character.label")},t?{key:"episode",label:a("film.table.episode.label")}:null,{key:"timestamp",label:a("film.table.time.label")},{key:"favorite",label:a("film.table.favourite.label")}].filter(Boolean);function fl(t){return[t.season??1/0,t.episode??1/0]}function ty(t,n){const o=n.dir==="asc"?1:-1;return[...t].sort((s,r)=>{switch(n.col){case"favorite":return((s.favorite?1:0)-(r.favorite?1:0))*o;case"character":return(s.character||"").localeCompare(r.character||"")*o;case"episode":{const[i,l]=fl(s),[h,d]=fl(r);return i!==h?(i-h)*o:l!==d?(l-d)*o:(s.timestamp||"").localeCompare(r.timestamp||"")*o}case"timestamp":return(s.timestamp||"").localeCompare(r.timestamp||"")*o;default:return(s.quote||"").localeCompare(r.quote||"")*o}})}function ny({rows:t,tagMap:n,stickers:o=[],reloadStickers:s,sort:r,onSort:i,editingId:l,setEditingId:h,save:d,remove:m,show:p=!1,game:u=!1,cast:f=[],actorMap:b={},onCopy:w,onShare:v}){const g=k=>r.col===k?r.dir==="asc"?" ▲":" ▼":"",y=t.find(k=>k.id===l);return e.jsxs(Po,{className:"ann-table-wrap",children:[e.jsxs("table",{className:"ann-table",children:[e.jsx("thead",{children:e.jsxs("tr",{children:[ey(p).map(k=>e.jsx("th",{className:"sortable",onClick:()=>i(k.key),"aria-sort":r.col===k.key?r.dir==="asc"?"ascending":"descending":"none",children:e.jsx(ye,{label:a("book.table.sort.tip"),side:"bottom",children:e.jsxs("span",{children:[k.label,g(k.key)]})})},k.key)),e.jsx("th",{})]})}),e.jsx("tbody",{children:t.map(k=>{var j;return e.jsxs("tr",{children:[e.jsxs("td",{className:"col-quote",children:[e.jsx(Ho,{text:k.quote,lines:2,style:{fontFamily:"var(--font-display)",fontWeight:"var(--font-display-weight)",fontVariantCaps:"var(--font-display-caps)",textTransform:"var(--font-display-case)",fontVariantNumeric:"var(--font-display-figures)",fontStyle:"italic"}}),((j=k.tags)==null?void 0:j.length)>0&&e.jsx("div",{className:"mt-1.5 flex flex-wrap gap-1.5",children:k.tags.map(N=>{const S=n[N];return e.jsx(Ma,{color:S==null?void 0:S.color,style:S==null?void 0:S.style,children:N},N)})})]}),e.jsx("td",{className:"col-mono",children:[k.character,k.actor&&`(${k.actor})`].filter(Boolean).join(" ")||"—"}),p&&e.jsx("td",{className:"col-mono",children:xn(k)||"—"}),e.jsx("td",{className:"col-mono",children:k.timestamp||"—"}),e.jsx("td",{className:"col-center",children:k.favorite?"♥":"—"}),e.jsx("td",{className:"col-actions",children:e.jsx(br,{noun:a("unit.line.one"),nounPlural:a("unit.line.other"),onCopy:w&&(()=>w(k)),onShare:v&&(()=>v(k)),onEdit:()=>h(k.id),onDelete:()=>setAsking(k)})})]},k.id)})})]}),e.jsx(Ke,{open:!!y,onClose:()=>h(null),title:a("common.dialogue.edit.title"),children:y&&e.jsx(ts,{initial:y,onSubmit:k=>d(y.id,k),onCancel:()=>h(null),submitLabel:a("common.action.save.label"),show:p,game:u,cast:f,actorMap:b,tagSuggestions:Object.keys(n),stickers:o,reloadStickers:s})})]})}function Is({d:t,tagMap:n,stickerMap:o={},stickers:s=[],reloadStickers:r,editing:i,show:l=!1,game:h=!1,cast:d=[],onEdit:m,onCancelEdit:p,onSave:u,onPatch:f,onDelete:b,onCopy:w,onShare:v,onOpenPerson:g,actorMap:y={},seps:k,actionsAlwaysVisible:j=!1,editInline:N=!1,wrapClass:S="mx-4 my-1.5",quoteLines:x=6,expanded:L,onToggleExpand:A,selection:E,selectKind:D="dialogue"}){var z,te;const q=["film-frame",S,"px-5 py-4"].filter(Boolean).join(" "),C=Ha("dialogue",t,{copy:w&&(()=>w()),share:v&&(()=>v()),edit:m&&(()=>m()),favourite:f&&(()=>f({favorite:!t.favorite})),favourited:!!t.favorite,remove:b&&(()=>b())}),I=[...Dr(E,t.id,D),...C.map(J=>({...J,onClick:J.run}))],{cardProps:O,menuClass:V,menu:P}=Uo(I,E?{onLongPress:()=>E.toggle(t.id,D)}:void 0),T=!!(E!=null&&E.isSelected(t.id)),B=E?J=>{const fe=Lr(J,E);fe!=="open"&&(J.preventDefault(),J.stopPropagation(),fe==="extend"?E.extendTo(t.id,D):E.toggle(t.id,D))}:void 0,_={borderLeft:`4px solid ${jn(t.color)||"var(--hl-1)"}`},U=typeof A=="function",F=e.jsx(ts,{initial:t,onSubmit:u,onCancel:p,submitLabel:a("common.action.save.label"),show:l,game:h,cast:d,actorMap:y,tagSuggestions:Object.keys(n),stickers:s,reloadStickers:r});if(N&&i)return e.jsx("article",{className:q,style:_,children:F});const X=t.actor?tt(t.actor,k):[],R={font:"inherit",color:"inherit",background:"none",border:"none",padding:0,cursor:"pointer",textDecoration:"underline",textUnderlineOffset:2},G=X.length>0?e.jsxs("span",{children:[a("film.credit.actor.label")," ",X.map((J,fe)=>e.jsxs(c.Fragment,{children:[fe>0&&", ",g?e.jsx(Cr,{kind:"actor",name:J,onOpen:g,className:"",style:R,children:J}):J]},J))]},"actor"):null,K=[xn(t)||null,t.character||null,G,t.timestamp||null].filter(Boolean),M=t.sticker_id!=null?o[t.sticker_id]:null,Q={fontFamily:"var(--font-display)",fontWeight:"var(--font-display-weight)",fontStyle:"var(--font-display-style)",fontVariantCaps:"var(--font-display-caps)",textTransform:"var(--font-display-case)",fontVariantNumeric:"var(--font-display-figures)",fontSize:"var(--type-display-17)",lineHeight:1.5,color:"var(--ink)"};return e.jsxs(e.Fragment,{children:[e.jsx(Ke,{open:i,onClose:p,title:a("common.dialogue.edit.title"),children:F}),e.jsxs("article",{className:`${q} ${V}${T?" is-picked":""}${E!=null&&E.active?" is-selecting":""}`,style:_,...O,onClickCapture:J=>{var fe;(fe=O.onClickCapture)!=null&&fe.call(O,J)||B==null||B(J)},children:[E&&e.jsx(gr,{picked:T,label:a("common.dialogue.pick.label"),onChange:()=>E.toggle(t.id,D)}),t.quote&&(M?e.jsx(Ic,{text:t.quote,quoteStyle:Q,stickerKey:`s${M.id}`,maxLines:x,pos:t.sticker_x!=null?{x:t.sticker_x,y:t.sticker_y}:null,onMove:(J,fe)=>f({sticker_x:J,sticker_y:fe}),sticker:e.jsx(Jc,{sticker:M}),open:U?!!L:void 0,onToggle:U?A:void 0}):e.jsx(Ho,{text:t.quote,lines:x,style:Q,open:U?!!L:void 0,onToggle:U?A:void 0})),e.jsx("div",{className:"mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1",children:e.jsxs("span",{className:"inline-flex items-center gap-2",children:[(z=t.character_images)!=null&&z.length?e.jsx(Gc,{images:t.character_images,size:24,ring:"var(--card)"}):e.jsx(Pa,{names:X,map:y,size:24,ring:"var(--card)"}),e.jsx(gc,{item:t}),e.jsx(rr,{item:t,parent:l?"show":"film"}),e.jsx("span",{style:Ur,children:K.map((J,fe)=>e.jsxs("span",{children:[fe>0?" · ":"",J]},fe))})]})}),((te=t.tags)==null?void 0:te.length)>0&&e.jsx("div",{className:"mt-2.5 flex flex-wrap gap-2",children:t.tags.map(J=>{const fe=n[J];return e.jsx(Ma,{color:fe==null?void 0:fe.color,style:fe==null?void 0:fe.style,children:J},J)})}),t.translation&&e.jsx(lc,{children:t.translation}),t.note&&e.jsx(Bo,{className:"mt-2",children:t.note}),e.jsxs("div",{className:"mt-1 flex flex-wrap items-center gap-x-3 gap-y-1",children:[e.jsx(Pn,{value:!!t.favorite,onChange:J=>f({favorite:J})}),e.jsx(wa,{actions:zn(C),alwaysVisible:j}),e.jsx("span",{className:"card-colors shrink-0"+(j?" is-visible":""),children:e.jsx(rt,{collapsible:!0,value:t.color||"yellow",onChange:J=>f({color:J}),ariaLabel:a("common.colour.category.aria")})}),e.jsx("span",{className:"ml-auto flex items-center",children:e.jsx(va,{actions:$n(C)})})]}),P]})]})}function ts({initial:t,onSubmit:n,onCancel:o,submitLabel:s,show:r=!1,game:i=!1,cast:l=[],actorMap:h={},tagSuggestions:d=[],stickers:m=[],reloadStickers:p}){const u=c.useMemo(()=>{const me=new Map;for(const H of l)H.character&&me.set(H.character.trim().toLowerCase(),(H.actor||"").trim());return me},[l]),f=c.useMemo(()=>[...new Set(l.map(me=>me.character).filter(Boolean))],[l]),[b,w]=c.useState((t==null?void 0:t.quote)||""),[v,g]=c.useState(()=>{if(t!=null&&t.character)return tt(t.character);if(t!=null&&t.actor&&l.length){const me=new Map;for(const H of l)H.actor&&me.set(H.actor.trim().toLowerCase(),H.character);return tt(t.actor).map(H=>me.get(H.trim().toLowerCase())).filter(Boolean)}return[]}),[y,k]=c.useState((t==null?void 0:t.timestamp)||""),[j,N]=c.useState((t==null?void 0:t.act)||""),[S,x]=c.useState((t==null?void 0:t.quest)||""),[L,A]=c.useState((t==null?void 0:t.season)??""),[E,D]=c.useState((t==null?void 0:t.episode)??""),[q,C]=c.useState((t==null?void 0:t.note)||""),[I,O]=c.useState((t==null?void 0:t.translation)||""),[V,P]=c.useState((t==null?void 0:t.color)||"yellow"),[T,B]=c.useState((t==null?void 0:t.tags)||[]),[_,U]=c.useState((t==null?void 0:t.sticker_id)??null),[F,X]=c.useState(""),[R,G]=c.useState(!1),K=c.useMemo(()=>{const me=[],H=new Set;for(const ee of v){const oe=u.get(String(ee).trim().toLowerCase());oe&&!H.has(oe.toLowerCase())&&(H.add(oe.toLowerCase()),me.push(oe))}return me},[v,u]),M=r||(t==null?void 0:t.season)!=null,Q=hn(L),z=hn(E),te=b.trim()?M&&z!=null&&Q==null?a("error.validate.season-required"):"":a("error.validate.line-required"),J=$o(R?a("common.action.save.busy"):te);async function fe(me){if(me.preventDefault(),te)return X(te.toLowerCase());G(!0),X("");const H=await n({quote:b.trim(),note:q.trim(),season:M?Q:null,episode:M?z:null,character:v.map(ee=>ee.trim()).filter(Boolean).join(", "),actor:v.length?"":(t==null?void 0:t.actor)||"",timestamp:i?"":y.trim(),translation:I.trim(),episode_name:(t==null?void 0:t.episode_name)||"",act:i?j.trim():(t==null?void 0:t.act)||"",quest:i?S.trim():(t==null?void 0:t.quest)||"",color:V,tags:T,favorite:!!(t!=null&&t.favorite),sticker_id:_,sticker_x:(t==null?void 0:t.sticker_x)??null,sticker_y:(t==null?void 0:t.sticker_y)??null});if(G(!1),H)return X(H);t||(w(""),g([]),k(""),x(""),C(""),O(""),B([]),U(null))}return e.jsxs("form",{id:J==null?void 0:J.formId,onSubmit:fe,className:"space-y-2.5",children:[e.jsx("textarea",{className:"tp-input",rows:"3",placeholder:a("film.line.form.quote.placeholder"),value:b,onChange:me=>w(me.target.value)}),e.jsxs("div",{children:[e.jsx(yt,{value:v,onChange:g,suggestions:f,placeholder:a("film.line.form.characters.placeholder"),ariaLabel:a("film.line.form.characters.aria"),nameCase:!0}),K.length>0&&e.jsxs("div",{className:"mt-1.5 flex items-center gap-2",children:[e.jsx(Pa,{names:K,map:h,size:20,ring:"var(--card)"}),e.jsxs("span",{style:{...Ur,fontSize:"var(--type-ui-11)"},children:["played by ",K.join(", ")]})]})]}),i?e.jsxs("div",{className:"grid grid-cols-2 gap-2",children:[e.jsx("input",{className:"tp-input",placeholder:a("film.line.form.act.placeholder"),title:a("film.line.form.act.tip"),"aria-label":a("common.field.act.label"),value:j,onChange:me=>N(me.target.value)}),e.jsx("input",{className:"tp-input",placeholder:a("film.line.form.quest.placeholder"),title:a("film.line.form.quest.tip"),"aria-label":a("common.field.quest.label"),value:S,onChange:me=>x(me.target.value)})]}):M?e.jsxs("div",{className:"grid grid-cols-2 gap-2 sm:grid-cols-3",children:[e.jsx("input",{className:"tp-input",type:"number",min:"0",max:"999",placeholder:a("film.line.form.season.placeholder"),title:a("film.line.form.season.tip"),"aria-label":a("common.field.season.label"),value:L,onChange:me=>A(me.target.value)}),e.jsx("input",{className:"tp-input",type:"number",min:"0",max:"9999",placeholder:a("film.line.form.episode.placeholder"),title:a("film.line.form.episode.tip"),"aria-label":a("common.field.episode.label"),value:E,onChange:me=>D(me.target.value)}),e.jsx("input",{className:"tp-input col-span-2 sm:col-span-1",placeholder:a("film.line.form.timestamp.placeholder"),title:a("film.line.form.timestamp.tip"),"aria-label":a("common.field.timestamp.label"),value:y,onChange:me=>k(me.target.value)})]}):e.jsx("input",{className:"tp-input",placeholder:a("film.line.form.timestamp.placeholder"),title:a("film.line.form.timestamp.tip"),"aria-label":a("common.field.timestamp.label"),value:y,onChange:me=>k(me.target.value)}),e.jsx("textarea",{className:"tp-input",rows:"2",placeholder:a("common.field.translation.placeholder"),"aria-label":a("common.field.translation.label"),value:I,onChange:me=>O(me.target.value)}),e.jsx("textarea",{className:"tp-input",rows:"2",placeholder:a("common.field.note.label"),value:q,onChange:me=>C(me.target.value)}),e.jsx(yt,{value:T,onChange:B,suggestions:d,placeholder:a("common.field.tags.placeholder"),ariaLabel:a("common.field.tags.label")}),e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx(W,{children:a("common.mono.colour.label")}),e.jsx(rt,{value:V,onChange:P,ariaLabel:a("common.colour.category.aria")})]}),e.jsxs("div",{children:[e.jsx(W,{className:"mb-1.5 block",children:a("common.field.sticker.label")}),e.jsx(Xo,{value:_,onChange:U,stickers:m,reload:p})]}),!J&&e.jsxs("div",{className:"flex items-center justify-end gap-2",children:[o&&e.jsx(ge,{type:"button",onClick:o,children:"Cancel"}),e.jsx("button",{className:"tp-btn tp-btn-primary",disabled:R||!!te,title:te||void 0,children:s})]}),e.jsx(ke,{children:F})]})}const Yd=Object.freeze(Object.defineProperty({__proto__:null,DialogueForm:ts,DuplicateConfirm:Ud,EditMovie:Kd,Frame:Is,ManualMovie:Gd,MediaTypeToggle:Vd,candSource:Yb,candSourceID:Gr,countOrNull:hn,default:zb,dialogueState:Vr,sourceRef:Rs},Symbol.toStringTag,{value:"Module"})),ay="tp-btn tp-btn-primary";function oy({onDone:t,boardID:n}){const[o,s]=c.useState(null),[r,i]=c.useState(""),[l,h]=c.useState("");c.useEffect(()=>{Z("GET","/quotes/starters").then(m=>s(m.ok?m.data.languages||[]:[]))},[]);async function d(m){i(m),h("");const p=await Z("POST","/quotes/starters",{language:m,board_id:n??null});if(i(""),!p.ok)return h(le(p,a("error.add.starters")));h(p.data.added>0?a("quotes.starter.added.label",{n:p.data.added,count:p.data.added}):a("quotes.starter.already.label")),await t()}return!o||o.length===0?null:e.jsxs("div",{className:"starter-proverbs",children:[e.jsx(W,{className:"block",children:a("quotes.starter.title")}),e.jsx("p",{className:"microcopy",style:{margin:"4px 0 10px"},children:a("quotes.starter.body")}),e.jsxs("div",{className:"flex flex-wrap items-center gap-2",children:[o.map(m=>e.jsx(ge,{type:"button",disabled:!!r,onClick:()=>d(m.language),children:r===m.language?a("quotes.starter.take.busy"):a("quotes.starter.take.label",{n:m.count,count:m.count,name:m.language})},m.language)),l&&e.jsx(W,{style:{color:"var(--soft)"},children:l})]})]})}function Kr(t){return{quote:t.quote||"",note:t.note||"",color:t.color||"yellow",tags:t.tags||[],favorite:!!t.favorite,speaker:t.speaker||"",occasion:t.occasion||"",occasion_date:t.occasion_date||"",place:t.place||"",medium:t.medium||"",kind:t.kind||"",category:t.category||"other",language:t.language||"",translation:t.translation||"",board_id:t.board_id||null,region:t.region||"",recipient:t.recipient||"",work_title:t.work_title||"",locator:t.locator||"",occasion_circa:!!t.occasion_circa,sticker_id:t.sticker_id??null,sticker_x:t.sticker_x??null,sticker_y:t.sticker_y??null}}const sy={font:"inherit",color:"inherit",background:"none",border:"none",padding:0,cursor:"pointer",textDecoration:"underline",textUnderlineOffset:2};function Qd(t,{people:n,seps:o,onOpenPerson:s,omitSpeaker:r}={}){const i=[t.occasion,un(t.occasion_date),t.place,Ra(t),t.language].filter(Boolean);if(r)return i.join(" · ");if(!s)return[t.speaker,...i].filter(Boolean).join(" · ");const l=t.speaker?tt(t.speaker,o||Hn):[];return l.length===0&&i.length===0?"":e.jsxs(e.Fragment,{children:[l.length===0&&t.language&&e.jsx(ob,{languages:[t.language],size:20,ring:"var(--card)",className:"mr-1.5"}),l.length>0&&e.jsxs(e.Fragment,{children:[e.jsx(Pa,{names:l,map:n,size:20,ring:"var(--card)",className:"mr-1.5 align-middle"}),l.map((h,d)=>e.jsxs(c.Fragment,{children:[d>0&&", ",e.jsx(Cr,{kind:"speaker",name:h,onOpen:s,className:"",style:sy})]},h))]}),l.length>0&&i.length>0&&" · ",i.join(" · ")]})}function Yr({initial:t,onSubmit:n,onCancel:o,submitLabel:s,tagSuggestions:r=[],stickers:i=[],reloadStickers:l,boards:h=[],defaultBoard:d=null}){const[m,p]=c.useState((t==null?void 0:t.quote)||""),[u,f]=c.useState((t==null?void 0:t.note)||""),[b,w]=c.useState((t==null?void 0:t.speaker)||""),[v,g]=c.useState((t==null?void 0:t.occasion)||""),[y,k]=c.useState((t==null?void 0:t.occasion_date)||""),[j,N]=c.useState((t==null?void 0:t.place)||""),[S,x]=c.useState((t==null?void 0:t.kind)||""),[L,A]=c.useState((t==null?void 0:t.category)||"other"),[E,D]=c.useState((t==null?void 0:t.board_id)??d??null),[q,C]=c.useState((t==null?void 0:t.language)||""),[I,O]=c.useState((t==null?void 0:t.region)||""),[V,P]=c.useState((t==null?void 0:t.recipient)||""),[T,B]=c.useState((t==null?void 0:t.work_title)||""),[_,U]=c.useState((t==null?void 0:t.locator)||""),[F,X]=c.useState(!!(t!=null&&t.occasion_circa)),[R,G]=c.useState((t==null?void 0:t.translation)||""),[K,M]=c.useState((t==null?void 0:t.color)||"yellow"),[Q,z]=c.useState((t==null?void 0:t.tags)||[]),[te,J]=c.useState((t==null?void 0:t.sticker_id)??null),[fe,me]=c.useState(""),[H,ee]=c.useState(!1),oe=m.trim()?y&&!ba(y)?a("error.validate.date"):"":a("error.validate.quote-required"),pe=$o(H?a("common.action.save.busy"):oe);async function de(se){if(se.preventDefault(),oe)return me(oe.toLowerCase());ee(!0),me("");const Y=await n({quote:m.trim(),note:u.trim(),speaker:b.trim(),occasion:v.trim(),occasion_date:y.trim(),place:j.trim(),medium:(t==null?void 0:t.medium)||"",kind:S,category:L,board_id:E,language:q.trim(),translation:R.trim(),region:I.trim(),recipient:V.trim(),work_title:T.trim(),locator:_.trim(),occasion_circa:F,color:K,tags:Q,favorite:!!(t!=null&&t.favorite),sticker_id:te,sticker_x:(t==null?void 0:t.sticker_x)??null,sticker_y:(t==null?void 0:t.sticker_y)??null});if(ee(!1),Y)return me(Y);t||(p(""),f(""),J(null))}return e.jsxs("form",{id:pe==null?void 0:pe.formId,onSubmit:de,className:"ann-form space-y-3",children:[e.jsxs("label",{className:"block",children:[e.jsx(W,{className:"mb-1.5 block",children:a("common.field.quote.label")}),e.jsx("textarea",{className:"tp-input",rows:"3",value:m,onChange:se=>p(se.target.value)})]}),e.jsxs("label",{className:"block",children:[e.jsx(W,{className:"mb-1.5 block",children:a("common.field.note.label")}),e.jsx("textarea",{className:"tp-input",rows:"2",value:u,onChange:se=>f(se.target.value)})]}),e.jsxs("div",{className:"cl-grid",children:[e.jsx(Se,{label:a("common.field.speaker.label"),nameCase:!0,placeholder:a("common.field.speaker.placeholder"),value:b,onChange:se=>w(se.target.value)}),e.jsx(Se,{label:a("common.field.occasion.label"),placeholder:a("common.field.occasion.placeholder"),value:v,onChange:se=>g(se.target.value)})]}),e.jsxs("div",{className:"cl-grid",children:[e.jsx(ya,{label:a("quotes.form.when.label"),value:y,onChange:k}),e.jsx(Se,{label:a("common.field.place.label"),placeholder:a("common.field.place.placeholder"),value:j,onChange:se=>N(se.target.value)})]}),e.jsxs("label",{className:"block",children:[e.jsx(W,{className:"mb-1 block",children:a("quotes.form.kind.label")}),e.jsx(De,{ariaLabel:a("quotes.form.kind.label"),value:S,onChange:x,options:jr()})]}),e.jsxs("label",{className:"block",children:[e.jsx(W,{className:"mb-1 block",children:a("common.field.board.label")}),h.length>0&&e.jsx(De,{ariaLabel:a("common.field.board.label"),value:E==null?"":String(E),onChange:se=>D(se===""?null:Number(se)),options:h.map(se=>[String(se.id),se.name])})]}),e.jsx(Se,{label:a("common.field.language.label"),placeholder:a("common.field.language.placeholder"),value:q,onChange:se=>C(se.target.value)}),e.jsxs("div",{children:[e.jsx(W,{className:"mb-1.5 block",children:a("quotes.form.carries.label")}),e.jsxs("div",{className:"cl-grid",children:[e.jsx(Se,{label:a("common.field.region.label"),placeholder:a("quotes.form.region.placeholder"),value:I,onChange:se=>O(se.target.value)}),e.jsx(Se,{label:a("common.field.recipient.label"),nameCase:!0,placeholder:a("quotes.form.recipient.placeholder"),value:V,onChange:se=>P(se.target.value)})]}),e.jsxs("div",{className:"cl-grid mt-3",children:[e.jsx(Se,{nameCase:!0,label:a("common.field.work-title.label"),placeholder:a("quotes.form.work-title.placeholder"),value:T,onChange:se=>B(se.target.value)}),e.jsx(Se,{label:a("common.field.locator.label"),placeholder:a("quotes.form.locator.placeholder"),value:_,onChange:se=>U(se.target.value)})]}),e.jsxs("label",{className:"mt-3 flex items-center gap-2",children:[e.jsx("input",{type:"checkbox",checked:F,onChange:se=>X(se.target.checked)}),e.jsx("span",{className:"microcopy",children:a("quotes.form.circa.label")})]})]}),e.jsxs("label",{className:"block",children:[e.jsx(W,{className:"mb-1.5 block",children:a("common.field.translation.label")}),e.jsx("textarea",{className:"tp-input",rows:"2",placeholder:a("common.field.translation.placeholder"),value:R,onChange:se=>G(se.target.value)})]}),e.jsxs("label",{className:"block",children:[e.jsx(W,{className:"mb-1.5 block",children:a("common.field.tags.label")}),e.jsx(yt,{value:Q,onChange:z,suggestions:r,placeholder:a("common.field.tags.placeholder"),ariaLabel:a("common.field.tags.label")})]}),e.jsxs("div",{className:"block",children:[e.jsx(W,{className:"mb-1.5 block",children:a("common.field.sticker.label")}),e.jsx(Xo,{value:te,onChange:J,stickers:i,reload:l})]}),e.jsxs("div",{className:"flex flex-wrap items-center gap-3 pt-1",children:[e.jsx(W,{children:a("common.mono.colour.label")}),e.jsx(rt,{value:K,onChange:M}),!pe&&e.jsxs("div",{className:"ml-auto flex gap-2",children:[o&&e.jsx(ge,{type:"button",onClick:o,children:a("common.action.cancel.label")}),e.jsx("button",{className:ay,disabled:H||!!oe,title:oe||void 0,children:s})]})]}),e.jsx(ke,{children:fe})]})}function Zd(t){const n=Number((t.occasion_date||"").slice(0,4));return Number.isInteger(n)&&n>0?n:null}const gl=()=>[["none",a("quotes.group.none.label")],["speaker",a("quotes.group.speaker.label")],["kind",a("quotes.group.kind.label")],["place",a("quotes.group.place.label")],["decade",a("quotes.group.decade.label")]],ry={kind:"quotes.group.residual.kind.label",place:"quotes.group.residual.place.label",language:"quotes.group.residual.language.label"};function Ps(t){return(t==null?void 0:t.kind)!=="proverb"?gl():[...gl(),["language",a("quotes.group.language.label")]]}function Xd(t,n,o){return Pr(t,n==="speaker"?"author":n,{credit:r=>r.speaker,splitCredit:!0,creditResidual:a("quotes.group.residual.speaker.label"),year:Zd,facet:(r,i)=>i==="kind"?Oa(r.kind):r[i],facetResidual:r=>a(ry[r]||"quotes.group.residual.none.label"),seps:o})}const iy=()=>[["recent",a("quotes.sort.recent.label")],["speaker",a("quotes.sort.speaker.label")],["occasion",a("quotes.sort.occasion.label")],["said",a("quotes.sort.said.label")]];function bl({items:t,columns:n,card:o}){const s=nn(t.length,t,Ed);return e.jsxs(e.Fragment,{children:[e.jsx(zo,{columns:n,children:t.slice(0,s.count).map(o)}),s.more&&e.jsx("div",{ref:s.sentinel,"aria-hidden":"true",className:"h-px"})]})}function ly({creditSeparators:t,openId:n=null,onOpen:o,onClose:s}){const{boards:r,total:i,reload:l}=Td();return n==null?e.jsx(hb,{boards:r,total:i,reload:l,onOpen:o}):e.jsx(cy,{boardId:n,boards:r,reloadBoards:l,creditSeparators:t,onClose:s},String(n))}function cy({boardId:t,boards:n,reloadBoards:o,creditSeparators:s,onClose:r}){const[i,l]=c.useState(null),[h,d]=c.useState(""),[m,p]=c.useState(null),[u,f]=c.useState(null),[b,w]=c.useState(null),[v,g]=c.useState(null),[y,k]=c.useState(!1),[j,N]=c.useState([]),[S,x]=$e("tippani:quotes:color",""),[L,A]=$e("tippani:quotes:fav",!1),[E,D]=$e("tippani:quotes:tagged",!1),[q,C]=$e("tippani:quotes:noted",!1),[I,O]=$e("tippani:quotes:tag",""),[V,P]=$e("tippani:quotes:speaker",""),[T,B]=$e("tippani:quotes:kind",""),_=t===Nd,U=(n||[]).find(re=>String(re.id)===String(t))||null,[F,X]=$e("tippani:quotes:language",""),[R,G]=$e("tippani:quotes:sort","recent"),[K,M]=$e("tippani:quotes:group","none"),Q=K==="medium"?"kind":K,{stickers:z,reload:te}=Fa(),{map:J,reload:fe}=Xe("speaker"),[me,H]=c.useState(null),ee=c.useMemo(()=>wn(s),[s]),oe=Ie(),pe=Fo(Iu),de=c.useCallback(async()=>{const re=await Z("GET","/quotes");re.ok?(l(re.data.utterances||[]),d("")):d(le(re))},[]);c.useEffect(()=>{de()},[de]),c.useEffect(()=>{Z("GET","/tags").then(re=>{re.ok&&N(re.data.tags)})},[]);const se=c.useMemo(()=>Object.fromEntries(j.map(re=>[re.name,re])),[j]),Y=c.useMemo(()=>Object.fromEntries(z.map(re=>[re.id,re])),[z]),ce=c.useMemo(()=>_?i||[]:(i||[]).filter(re=>String(re.board_id)===String(t)),[i,_,t]),Te=c.useMemo(()=>{const re=new Set;for(const ve of ce)for(const Oe of tt(ve.speaker||"",ee))re.add(Oe);return[...re].sort((ve,Oe)=>ve.localeCompare(Oe))},[ce,ee]),Le=c.useMemo(()=>{const re=new Set(ce.map(ve=>ve.kind).filter(Boolean));return xr.filter(ve=>re.has(ve))},[ce]),Fe=c.useMemo(()=>{const re=new Set;for(const ve of ce)ve.language&&re.add(ve.language);return[...re].sort((ve,Oe)=>ve.localeCompare(Oe))},[ce]),_e=c.useMemo(()=>{let re=ce;return S&&(re=re.filter(ve=>ve.color===S)),L&&(re=re.filter(ve=>ve.favorite)),E&&(re=re.filter(ve=>(ve.tags||[]).length>0)),q&&(re=re.filter(ve=>!!(ve.note||"").trim())),I&&(re=re.filter(ve=>(ve.tags||[]).includes(I))),V&&(re=re.filter(ve=>tt(ve.speaker||"",ee).includes(V))),T&&(re=re.filter(ve=>ve.kind===T)),F&&(re=re.filter(ve=>ve.language===F)),R==="recent"||(re=[...re],R==="speaker"?re.sort((ve,Oe)=>(ve.speaker||"").localeCompare(Oe.speaker||"")):R==="occasion"?re.sort((ve,Oe)=>(ve.occasion||"").localeCompare(Oe.occasion||"")):R==="said"&&re.sort((ve,Oe)=>(ve.occasion_date||"￿").localeCompare(Oe.occasion_date||"￿"))),re},[ce,S,L,E,q,I,V,T,F,R,ee]),ne=Ps(U).some(([re])=>re===Q)?Q:"none",he=c.useMemo(()=>ne==="none"?null:Xd(_e,ne,ee),[_e,ne,ee]),qe=nn(he?he.length:0,he,12);async function Ne(re,ve){const Oe=await Z("PUT",`/quotes/${re}`,ve);return Oe.ok?(p(null),await de(),null):le(Oe,a("error.save.generic"))}async function ae(re,ve){const Oe=await Z("PUT",`/quotes/${re.id}`,{...Kr(re),...ve});return Oe.ok?(d(""),Fr(ve,{color:S})?await de():l(Ut=>(Ut||[]).map(ue=>ue.id===re.id?{...ue,...Oe.data}:ue)),!0):(d(le(Oe,a("error.save.generic"))),!1)}async function be(re){if(!confirm(a("quotes.delete.confirm")))return;const ve=await Qn(`/quotes/${re.id}`,{reload:de});ve.ok?de():d(le(ve))}const ie=re=>cd({quote:re.quote,translation:re.translation,note:re.note,category:re.category,language:re.language,speaker:re.speaker,occasion:re.occasion,when:un(re.occasion_date),place:re.place,medium:Ra(re),date:vn(re.noted_at||re.created_at),tags:re.tags,color:re.color,people:J,seps:ee}),je=za(_e.map(re=>re.id)),Ce=()=>{je.clear(),de()},Be=c.useMemo(()=>re=>e.jsx(Yr,{...re,boards:n||[],defaultBoard:_?null:Number(t)}),[n,_,t]),Ze=(re,ve)=>e.jsx(Mo,{selection:je,selectKind:"quote",a:re,variant:ve,meta:Qd(re,{people:J,seps:ee,onOpenPerson:H}),form:Be,tagMap:se,stickerMap:Y,stickers:z,reloadStickers:te,editing:m===re.id,setEditingId:p,save:Ne,patch:ae,remove:be,onMoveBoard:()=>w(re),onCopy:()=>ka(ie(re)),onShare:()=>f(re),tagSuggestions:Object.keys(se),expanded:v===re.id,onToggleExpand:()=>g(v===re.id?null:re.id)},re.id),Wt=e.jsx(rt,{value:S,onChange:re=>x(re===S?"":re),ariaLabel:a("quotes.filters.colour.aria")}),sn=[j.length>0&&["tag",a("common.filters.tag.aria"),I,O,[["",a("common.filters.tag.all.label")],...j.map(re=>[re.name,re.name])]],Te.length>0&&["speaker",a("quotes.filters.speaker.aria"),V,P,[["",a("quotes.filters.speaker.all.label")],...Te.map(re=>[re,re])]],Le.length>0&&["kind",a("quotes.filters.kind.aria"),T,B,[["",a("quotes.filters.kind.all.label")],...Le.map(re=>[re,Oa(re)])]],Fe.length>1&&["language",a("quotes.filters.language.aria"),F,X,[["",a("quotes.filters.language.all.label")],...Fe.map(re=>[re,re])]]].filter(Boolean),Zn=e.jsx(De,{ariaLabel:a("common.filters.group.aria"),value:ne,onChange:M,options:Ps(U)}),Wa=!_&&i!=null&&ce.length===0?e.jsx(oy,{onDone:de,boardID:Number(t)}):null;return e.jsxs(e.Fragment,{children:[!oe&&e.jsx("div",{className:"mb-3",children:e.jsx(ge,{icon:e.jsx($t,{}),onClick:r,children:a("quotes.board.back.label")})}),Wa,e.jsxs($r,{mobile:oe,onBack:r,title:_?a("quotes.board.all.label"):(U==null?void 0:U.name)||a("nav.tab.quotes.label"),counts:i?a(U!=null&&U.description?"quotes.board.counts-described":"quotes.board.counts",{n:ce.length,noun:a("unit.quote",{count:ce.length}),description:U==null?void 0:U.description}):"",error:h,onExport:()=>k(!0),loaded:i!=null,hasItems:!!(i&&ce.length>0),shownCount:_e.length,emptyText:a("quotes.board.empty"),noMatchText:a("quotes.board.nomatch"),noun:a("unit.quote.one"),nounPlural:a("unit.quote.other"),fav:L,setFav:A,tagged:E,setTagged:D,noted:q,setNoted:C,sort:R,setSort:G,sortOptions:iy(),leading:Wt,leadingMobile:e.jsxs("div",{children:[e.jsx(W,{className:"mb-2 block",children:a("common.mono.colour.label")}),Wt]}),trailing:e.jsxs(e.Fragment,{children:[sn.map(([re,ve,Oe,Ut,ue])=>e.jsx(De,{ariaLabel:ve,value:Oe,onChange:Ut,options:ue},re)),e.jsxs("label",{className:"flex items-center gap-2",children:[e.jsx(W,{children:a("common.mono.group.label")}),Zn]})]}),trailingMobile:e.jsxs(e.Fragment,{children:[sn.map(([re,ve,Oe,Ut,ue])=>e.jsxs("div",{children:[e.jsx(W,{className:"mb-2 block",children:a(`common.mono.${re}.label`)}),e.jsx(De,{ariaLabel:ve,value:Oe,onChange:Ut,options:ue})]},re)),e.jsxs("div",{children:[e.jsx(W,{className:"mb-2 block",children:a("common.mono.group.label")}),Zn]})]}),onReset:()=>{x(""),A(!1),D(!1),C(!1),O(""),P(""),setMedium(""),G("recent"),M("none")},exportDialog:e.jsx(mt,{open:y,title:a("quotes.export.confirm.title"),body:a("quotes.export.confirm.body",{count:_e.length,n:_e.length}),confirmLabel:a("common.action.export.label"),onCancel:()=>k(!1),onConfirm:async()=>{k(!1),await Vs("/export/quotes",{ids:_e.map(re=>re.id)},"tippani-quotes.md")}}),extraModals:e.jsxs(e.Fragment,{children:[u&&e.jsx(Jo,{share:ie(u),seen:{kind:"utterance",id:u.id},onClose:()=>f(null)}),me&&e.jsx(Sn,{kind:me.kind,name:me.name,onClose:()=>H(null),onSaved:fe})]}),children:[je.open&&e.jsx($a,{selection:je,rows:_e,onDone:Ce,tagSuggestions:Object.keys(se),onEdit:p}),b&&e.jsx(Cd,{count:1,currentBoardID:b.board_id??null,onApply:async re=>{const ve=b;w(null);const Oe=await Z("POST","/quotes/bulk",{ids:[ve.id],board_id:re});if(!Oe.ok)return Ee(le(Oe,a("error.move.generic")));Ee(a("quotes.toast.moved")),await de()},onClose:()=>w(null)}),i?he?e.jsxs("div",{className:"space-y-10",children:[he.slice(0,qe.count).map(re=>{const ve=ne==="speaker"&&!re.residual;return e.jsxs("section",{children:[e.jsx(zr,{label:re.label,count:re.items.length,noun:a("unit.quote.one"),nounPlural:a("unit.quote.other"),person:ve?J[re.label]:null,onOpenPerson:ve?()=>H({kind:"speaker",name:re.label}):void 0}),e.jsx(bl,{items:re.items,columns:pe,card:Ze})]},re.key)}),qe.more&&e.jsx("div",{ref:qe.sentinel,"aria-hidden":"true",className:"h-px"})]}):e.jsx(bl,{items:_e,columns:pe,card:Ze}):e.jsx(Bt,{})]})]})}const Jd=Object.freeze(Object.defineProperty({__proto__:null,UtteranceForm:Yr,default:ly,groupOptionsFor:Ps,groupUtterances:Xd,utteranceMeta:Qd,utteranceState:Kr,utteranceYear:Zd},Symbol.toStringTag,{value:"Module"})),oa=[{kind:"markdown",ext:".md",accept:".md,.markdown,.txt",steps:2},{kind:"bookcision",ext:".json",accept:".json",steps:3},{kind:"hardcover-html",ext:".html",accept:".htm,.html",steps:3},{kind:"goodreads-html",ext:".html",accept:".htm,.html",steps:3},{kind:"imdb-quotes",ext:".html",accept:".htm,.html",steps:3},{kind:"kindle-notebook",ext:".html",accept:".htm,.html",steps:3},{kind:"kindle-clippings",ext:".txt",accept:".txt",steps:3,caveat:!0}],sa=t=>a(`import.source.${t}.title`),Fs=t=>a(`import.source.${t}.desc`),eh=t=>Array.from({length:t.steps},(n,o)=>a(`import.source.${t.kind}.step.${o+1}`)),dy=t=>t.caveat?a(`import.source.${t.kind}.caveat`):"";function hy({onReviewImport:t,onStaged:n,embedded:o=!1}){const[s,r]=c.useState(null),[i,l]=c.useState(""),[h,d]=c.useState(0),[m,p]=c.useState(!1),u=Zs(),f=Ie();async function b(w,v){if(m||v.length===0)return;p(!0),l(""),d(0);const g=v.map(j=>({name:j.name,pending:!0}));r([...g]);for(let j=0;j<v.length;j++){const N=await Ea(`/import/${w}`,v[j]);g[j]=N.ok?{name:v[j].name,ok:!0,...N.data}:{name:v[j].name,ok:!1,error:le(N,a("error.import.failed"))},r([...g])}const k=g.filter(j=>j.ok).reduce((j,N)=>j+(N.staged||0),0);d(k),l(a("import.summary.arrow",{files:a("import.summary.files",{count:v.length,n:v.length}),quotes:a("import.summary.quotes",{count:k,n:k})})),n==null||n(),p(!1)}return e.jsxs("section",{className:"space-y-5",children:[!o&&e.jsx("div",{className:f?"mobile-sticky-bar":"",children:e.jsx(Vn,{title:a("import.title"),counts:a("import.counts")})}),f?e.jsx(my,{busy:m,onFiles:b}):e.jsx("div",{ref:u,className:"reveal grid gap-3 sm:grid-cols-2"+(o?"":" lg:grid-cols-4"),children:oa.map((w,v)=>e.jsx(py,{src:w,variant:v,color:Do[v%Do.length],busy:m,onFiles:g=>b(w.kind,g)},w.kind))}),s&&e.jsx(fy,{results:s,summary:i,staged:h,onReviewImport:t}),e.jsx(by,{}),e.jsx(uy,{})]})}function uy(){return e.jsxs("details",{className:"px-4 py-3",style:{border:"1px dashed var(--line)",borderRadius:12,color:"var(--soft)"},children:[e.jsx("summary",{className:"mono-label cursor-pointer",style:{listStyle:"revert"},children:a("import.why-upload.summary")}),e.jsx("p",{className:"mt-2",style:{fontSize:"var(--type-ui-13)",lineHeight:1.55},children:Pe("import.why-upload.body",{emphasis:e.jsx("i",{children:a("import.why-upload.emphasis")})})})]})}const Do=["#E5C355","#7FA6C9","#D98CA6","#DF9A5B","#3F7D5A","#2F6D8F"];function th({muted:t,color:n,children:o}){const s=t?"var(--faint)":n||"var(--accent-ui)",r=n||"var(--accent)";return e.jsx("span",{className:"mono-label self-start",style:{color:s,border:`1.2px solid ${t?"var(--line)":`color-mix(in srgb, ${r} 55%, transparent)`}`,background:t?"transparent":`color-mix(in srgb, ${r} 13%, transparent)`,borderRadius:7,padding:"3px 8px"},children:o})}function my({busy:t,onFiles:n}){const[o,s]=c.useState("markdown"),[r,i]=c.useState(""),[l,h]=c.useState(!1),d=c.useRef(null),{popRef:m,style:p}=Mt(l,d,{matchWidth:!0,minHeight:140});Lt(l,()=>h(!1),[d,m],{event:["mousedown","touchstart"]});const u=oa.findIndex(g=>g.kind===o),f=oa[u],b=Do[u%Do.length],w=r.trim().toLowerCase(),v=w?oa.filter(g=>`${sa(g.kind)} ${Fs(g.kind)} ${g.ext}`.toLowerCase().includes(w)):oa;return e.jsxs("div",{className:"flex flex-col gap-3",children:[e.jsxs("div",{className:"relative",ref:d,children:[e.jsx("input",{type:"text",className:"tp-input",role:"combobox","aria-expanded":l,"aria-label":a("import.format.aria"),placeholder:a("import.format.search.placeholder"),value:l?r:sa(f.kind),onFocus:()=>{i(""),h(!0)},onChange:g=>{i(g.target.value),h(!0)}}),l&&Ve.createPortal(e.jsxs("div",{ref:m,className:"tp-select-panel",role:"listbox",style:p,children:[v.length===0&&e.jsx("p",{className:"microcopy px-3 py-2",children:a("import.format.none")}),v.map(g=>e.jsxs("button",{type:"button",role:"option","aria-selected":g.kind===o,className:"tp-select-opt tactile",onClick:()=>{s(g.kind),i(""),h(!1)},children:[sa(g.kind)," ",e.jsx("span",{className:"mono-label",style:{color:"var(--faint)",marginLeft:6},children:g.ext})]},g.kind))]}),document.body)]}),e.jsxs(Je,{variant:u,colorBar:b,className:"flex flex-col gap-3 p-5",children:[e.jsx(th,{color:b,children:f.ext}),e.jsx("h3",{className:"text-base font-semibold",children:sa(f.kind)}),e.jsx("p",{className:"text-sm",style:{color:"var(--soft)"},children:Fs(f.kind)}),e.jsx("ol",{className:"text-sm",style:{color:"var(--soft)",listStyle:"decimal",paddingLeft:20,display:"flex",flexDirection:"column",gap:6},children:eh(f).map((g,y)=>e.jsx("li",{children:g},y))}),e.jsxs("label",{className:"tp-btn tp-btn-primary w-full",style:t?{opacity:.55,cursor:"default"}:{cursor:"pointer"},children:[a("import.pick.label"),e.jsx("input",{type:"file",multiple:!0,accept:f.accept,className:"hidden",disabled:t,onChange:g=>{const y=[...g.target.files];g.target.value="",y.length>0&&n(f.kind,y)}})]})]})]})}function py({variant:t,src:n,busy:o,onFiles:s,color:r}){const{ext:i,accept:l}=n,h=eh(n),d=dy(n),[m,p]=c.useState(!1),u=t%2?.7:-.7;return e.jsxs("div",{className:"relative",onDragOver:f=>{f.preventDefault(),p(!0)},onDragLeave:()=>p(!1),onDrop:f=>{f.preventDefault(),p(!1),s([...f.dataTransfer.files])},children:[e.jsx(Je,{variant:t,colorBar:r,className:"absolute inset-0",style:{rotate:`${u}deg`,...m?{borderColor:r,background:`color-mix(in srgb, ${r} 8%, var(--card))`}:null},"aria-hidden":"true"}),e.jsxs("div",{className:"relative flex h-full flex-col gap-3 p-5",children:[e.jsx(th,{color:r,children:i}),e.jsxs("div",{className:"flex items-center gap-1.5",children:[e.jsx("h3",{className:"text-base font-semibold",children:sa(n.kind)}),h.length>0&&e.jsx(Re,{text:h.map((f,b)=>`${b+1}. ${f}`).join("  ")}),d&&e.jsx("span",{className:"tp-chip shrink-0",style:{color:"var(--amber)",fontSize:"var(--type-ui-9)"},children:a("import.experimental.label")})]}),e.jsx("p",{className:"text-sm",style:{color:"var(--soft)"},children:Fs(n.kind)}),d&&e.jsxs("p",{className:"microcopy",style:{color:"var(--amber, var(--accent-ui))"},children:["⚠ ",d]}),e.jsxs("div",{className:"mt-auto",children:[e.jsxs("label",{className:"tp-btn tp-btn-ghost w-full",style:o?{opacity:.55,cursor:"default"}:{cursor:"pointer"},children:[a("import.choose.label"),e.jsx("input",{type:"file",multiple:!0,accept:l,className:"hidden",disabled:o,onChange:f=>{const b=[...f.target.files];f.target.value="",b.length>0&&s(b)}})]}),e.jsx("p",{className:"microcopy mt-1.5 text-center",children:a("import.drop.hint")})]})]})]})}function fy({results:t,summary:n,staged:o,onReviewImport:s}){return e.jsxs("div",{className:"hand-card hc-r2 space-y-1.5 p-4",style:{borderLeft:"4px solid var(--accent)"},children:[n&&e.jsx("p",{className:"microcopy",style:{color:"var(--ink)"},children:n}),t.map((r,i)=>e.jsxs("div",{children:[e.jsxs("p",{className:"microcopy",children:[r.name," →"," ",r.pending?"…":r.ok?a("import.row.staged",{count:r.staged,n:r.staged}):e.jsx("span",{style:{color:"var(--error)"},children:r.error})]}),r.ok&&e.jsx(yy,{row:r}),r.ok&&(r.works||[]).map(l=>e.jsx(gy,{work:l},l.id)),r.ok&&r.possible_duplicates&&r.possible_duplicates.length>0&&e.jsx("p",{className:"microcopy",style:{color:"var(--amber, var(--accent-ui))"},children:a("import.row.duplicate",{titles:r.possible_duplicates.map(l=>l.title).join(", ")})})]},i)),o>0&&s&&e.jsx("button",{className:"tp-btn tp-btn-primary mt-1.5",onClick:s,children:a("import.review",{count:o,n:o})}),o>0&&!s&&e.jsx("p",{className:"microcopy",style:{color:"var(--accent-ui)"},children:a("import.review.absent")})]})}function gy({work:t}){const n=a(t.kind==="book"?"unit.book":t.kind==="show"?"unit.show":"unit.film",{count:1});return e.jsxs("div",{className:"microcopy",style:{color:"var(--soft)"},children:[e.jsxs("span",{children:[t.title," (",t.staged,") →"," ",t.target_id?t.target_year?a("import.work.joins-year",{title:t.target_title||t.title,year:t.target_year}):a("import.work.joins",{title:t.target_title||t.title}):a("import.work.new",{kind:n})]}),t.ambiguous&&e.jsx("p",{style:{color:"var(--amber, var(--accent-ui))"},children:a("import.work.ambiguous",{n:t.alternatives+1,title:t.title})})]})}function by(){return e.jsx("p",{className:"microcopy px-4 py-3",style:{border:"1px dashed var(--line)",borderRadius:12,color:"var(--soft)"},children:Pe("import.nothing-lands.body",{queue:e.jsx("b",{children:a("staging.title")})})})}function yy({row:t}){const n=[],o=(s,r)=>a(s,{count:r,n:r});return t.bookmarks_skipped&&n.push(o("import.clippings.bookmarks",t.bookmarks_skipped)),t.notes_merged&&n.push(o("import.clippings.notes",t.notes_merged)),t.near_duplicates&&n.push(o("import.clippings.duplicates",t.near_duplicates)),t.blocks_malformed&&n.push(o("import.clippings.malformed",t.blocks_malformed)),n.length===0?null:e.jsxs("p",{className:"microcopy",style:{color:t.blocks_malformed?"var(--amber, var(--accent-ui))":"var(--soft)"},children:[t.blocks_malformed?"⚠ ":"",n.join(" · ")]})}function yl(){return e.jsx("span",{className:"help-swatches","aria-hidden":"true",children:[1,2,3,4,5,6].map(t=>e.jsx("span",{className:"color-dot active",style:{background:`var(--hl-${t})`}},t))})}function wy(){const t={fill:"none",stroke:"currentColor",strokeWidth:1.2,rx:4,opacity:.5},n={fontSize:"var(--type-mono-9)",fill:"currentColor",fontFamily:"var(--font-mono)"};return e.jsxs("svg",{viewBox:"0 0 240 46",width:"240",role:"img","aria-label":a("capture.help.import.flow.aria"),children:[e.jsx("rect",{x:"1",y:"12",width:"52",height:"18",...t}),e.jsx("text",{x:"27",y:"24",...n,textAnchor:"middle",children:a("capture.help.import.flow.file.label")}),e.jsx("rect",{x:"86",y:"12",width:"68",height:"18",...t}),e.jsx("text",{x:"120",y:"24",...n,textAnchor:"middle",children:a("capture.help.import.flow.pending.label")}),e.jsx("rect",{x:"187",y:"12",width:"52",height:"18",...t}),e.jsx("text",{x:"213",y:"24",...n,textAnchor:"middle",children:a("capture.help.import.flow.library.label")}),e.jsx("path",{d:"M55 21 H84",stroke:"currentColor",strokeWidth:"1.2",opacity:"0.5"}),e.jsx("path",{d:"M78 18 l6 3 -6 3",fill:"currentColor",opacity:"0.5"}),e.jsx("path",{d:"M156 21 H185",stroke:"currentColor",strokeWidth:"1.4"}),e.jsx("path",{d:"M179 18 l6 3 -6 3",fill:"currentColor"}),e.jsx("text",{x:"170",y:"10",...n,textAnchor:"middle",opacity:"0.85",children:a("capture.help.import.flow.approve.label")})]})}const ra=(t,n,o)=>Object.defineProperty(t,n,{get:o,enumerable:!0});function $(t,n={}){const{icon:o,asset:s,more:r=!1,how:i=0}=n,l={key:t,roles:["term","what",...Array.from({length:i},(h,d)=>`how.${d+1}`),...r?["more"]:[]]};return o&&(l.icon=o),s&&(l.asset=s),ra(l,"term",()=>a(`${t}.term`)),ra(l,"what",()=>a(`${t}.what`)),i&&ra(l,"how",()=>Array.from({length:i},(h,d)=>a(`${t}.how.${d+1}`))),r&&ra(l,"more",()=>a(`${t}.more`)),l}function Ye(t,n){const o={entries:n,titleKey:t};return ra(o,"title",()=>a(t)),o}const nh=[$("common.help.topbar.add",{icon:e.jsx(ht,{}),more:!0}),$("common.help.topbar.search",{icon:e.jsx(on,{})}),$("common.help.topbar.help",{icon:e.jsx(hr,{}),more:!0}),$("common.help.topbar.avatar"),$("common.help.selecting",{how:3,more:!0}),$("common.help.favourite",{more:!0}),$("common.help.cover-menu",{more:!0}),$("common.help.skip-in-quiz",{more:!0}),$("common.help.fill-gaps",{more:!0}),$("common.help.info-dots",{more:!0})],ah=[$("common.help.installed-app",{more:!0}),$("common.help.topbar.menu",{icon:e.jsx(kc,{}),asset:e.jsx(ws,{kind:"swipe-left"}),more:!0}),$("common.help.bottom-bar",{more:!0}),$("common.help.long-press",{asset:e.jsx(ws,{kind:"long-press"}),more:!0})],oh=[$("common.help.keyboard",{more:!0}),$("common.help.tab-strip",{more:!0}),$("common.help.hover-labels"),$("common.help.card-menu",{more:!0})],Ln={home:Ye("nav.tab.home.label",[$("home.help.greeting"),$("home.help.daily-quiz",{more:!0}),$("home.help.practice"),$("home.help.practise",{more:!0}),$("home.help.grade"),$("home.help.fix-or-tag",{more:!0}),$("home.help.language-mark",{more:!0}),$("home.help.status-dot"),$("home.help.favourites",{more:!0})]),library:Ye("nav.tab.library.label",[$("library.help.filters",{icon:e.jsx(Rt,{})}),$("library.help.translator-editor",{more:!0}),$("library.help.wishlist"),$("library.help.fold-wishlist",{more:!0}),$("library.help.shelf-state",{icon:e.jsx(dr,{})}),$("library.help.sort",{more:!0}),$("library.help.group-by"),$("library.help.view",{icon:e.jsx(bm,{})}),$("library.help.export",{icon:e.jsx(st,{}),more:!0})]),movies:Ye("nav.tab.movies.label",[$("movies.help.media-types",{more:!0}),$("movies.help.filters",{icon:e.jsx(Rt,{})}),$("movies.help.actor",{more:!0}),$("movies.help.shelf-state",{more:!0}),$("movies.help.collection"),$("movies.help.sort",{more:!0}),$("movies.help.group-by"),$("movies.help.export",{icon:e.jsx(st,{})})]),"book-detail":Ye("book.help.title",[$("book.help.details",{icon:e.jsx(Ft,{}),more:!0}),$("book.help.counts",{more:!0}),$("book.help.hearts"),$("book.help.state-chip"),$("book.help.add-annotation",{icon:e.jsx(ht,{})}),$("book.help.colour-category",{asset:e.jsx(yl,{}),more:!0}),$("book.help.copy",{icon:e.jsx(pa,{}),more:!0}),$("book.help.share",{icon:e.jsx(Dn,{}),more:!0}),$("book.help.export",{icon:e.jsx(st,{})}),$("book.help.more-menu",{icon:e.jsx(cr,{})})]),"movie-detail":Ye("film.help.title",[$("film.help.studio",{more:!0}),$("film.help.publisher",{more:!0}),$("film.help.voice-cast",{more:!0}),$("film.help.details",{icon:e.jsx(Ft,{}),more:!0}),$("film.help.counts",{more:!0}),$("film.help.state-chip",{more:!0}),$("film.help.add-dialogue",{icon:e.jsx(ht,{}),more:!0}),$("film.help.cast"),$("film.help.copy",{icon:e.jsx(pa,{}),more:!0}),$("film.help.share",{icon:e.jsx(Dn,{}),more:!0})]),search:Ye("nav.tab.search.label",[$("search.help.exact-phrase",{more:!0}),$("search.help.box",{icon:e.jsx(on,{})}),$("search.help.filters",{icon:e.jsx(Rt,{}),more:!0}),$("search.help.colon",{how:3,more:!0}),$("search.help.escaped-colon",{more:!0}),$("search.help.two-chips",{more:!0}),$("search.help.colour-names",{more:!0}),$("search.help.arriving-narrowed",{more:!0}),$("search.help.global-scope",{more:!0}),$("search.help.scope-chips",{more:!0}),$("search.help.sections"),$("search.help.characters",{how:1,more:!0}),$("search.help.dates",{more:!0}),$("search.help.select")]),quotes:Ye("nav.tab.quotes.label",[$("quotes.help.what-lives-here"),$("quotes.help.boards",{more:!0}),$("quotes.help.starters",{more:!0}),$("quotes.help.board-kind",{more:!0}),$("quotes.help.languages",{more:!0}),$("quotes.help.all-quotes",{more:!0}),$("quotes.help.hide-board",{more:!0}),$("quotes.help.delete-board",{more:!0}),$("quotes.help.occasion"),$("quotes.help.speaker",{more:!0}),$("quotes.help.when"),$("quotes.help.no-attribution"),$("quotes.help.speaker-credit",{more:!0}),$("quotes.help.copy",{icon:e.jsx(pa,{}),more:!0}),$("quotes.help.share",{icon:e.jsx(Dn,{}),more:!0}),$("quotes.help.filters",{icon:e.jsx(Rt,{}),more:!0}),$("quotes.help.group-by",{more:!0}),$("quotes.help.export",{icon:e.jsx(st,{})})]),anthologies:Ye("nav.tab.anthologies.label",[$("anthologies.help.what-lives-here",{more:!0}),$("anthologies.help.not-a-board"),$("anthologies.help.new",{icon:e.jsx(ht,{}),more:!0}),$("anthologies.help.adding",{more:!0}),$("anthologies.help.entry-note",{more:!0}),$("anthologies.help.reorder",{more:!0}),$("anthologies.help.remove",{icon:e.jsx(ze,{})}),$("anthologies.help.delete",{icon:e.jsx(ze,{}),more:!0}),$("anthologies.help.export",{icon:e.jsx(st,{}),more:!0}),$("anthologies.help.feature-switch",{more:!0})]),tags:Ye("tags.help.title",[$("tags.help.tags"),$("tags.help.style"),$("tags.help.stickers",{icon:e.jsx(ma,{}),more:!0})]),metadata:Ye("nav.tab.metadata.label",[$("metadata.help.coverage"),$("metadata.help.fetch",{icon:e.jsx(Kn,{})}),$("metadata.help.reverify"),$("metadata.help.duplicates"),$("metadata.help.speakers"),$("metadata.help.people"),$("metadata.help.bulk-edit",{icon:e.jsx(et,{})})]),stats:Ye("nav.tab.stats.label",[$("stats.help.calendar",{icon:e.jsx(jc,{}),more:!0}),$("stats.help.memory"),$("stats.help.breakdowns",{more:!0}),$("stats.help.timeline",{more:!0}),$("stats.help.superlatives"),$("stats.help.counts",{more:!0})]),staging:Ye("staging.help.title",[$("staging.help.why"),$("staging.help.bulk-fix",{icon:e.jsx(et,{})}),$("staging.help.approve")]),bin:Ye("bin.help.title",[$("bin.help.what-is-here",{more:!0}),$("bin.help.getting-here",{more:!0}),$("bin.help.row",{more:!0}),$("bin.help.restore",{icon:e.jsx(ur,{}),more:!0}),$("bin.help.purge",{icon:e.jsx(ze,{})}),$("bin.help.kinds",{more:!0}),$("bin.help.keep-for",{more:!0}),$("bin.help.empty-now",{icon:e.jsx(ze,{})})]),cleanup:Ye("cleanup.help.title",[$("cleanup.help.what-is-here",{more:!0}),$("cleanup.help.no-fix",{more:!0}),$("cleanup.help.getting-here",{more:!0}),$("cleanup.help.row",{more:!0}),$("cleanup.help.filter",{icon:e.jsx(Rt,{}),more:!0}),$("cleanup.help.names",{more:!0}),$("cleanup.help.cap",{more:!0})]),checks:Ye("checks.title",[$("checks.help.what-is-here",{more:!0}),$("checks.help.imports",{more:!0}),$("checks.help.marks",{more:!0}),$("checks.help.not-review",{more:!0})]),settings:Ye("nav.tab.settings.label",[$("settings.help.colour-categories",{asset:e.jsx(yl,{}),more:!0}),$("settings.help.appearance",{more:!0}),$("settings.help.button-labels",{more:!0}),$("settings.help.features",{more:!0}),$("settings.help.onboarding",{more:!0}),$("settings.help.users",{more:!0}),$("settings.help.metadata-sources",{more:!0}),$("settings.help.igdb",{more:!0}),$("settings.help.type",{icon:e.jsx(Cm,{}),more:!0}),$("settings.help.language-marks",{icon:e.jsx(Em,{}),more:!0}),$("settings.help.upload-font",{more:!0}),$("settings.help.review",{more:!0}),$("settings.help.in-depth",{more:!0}),$("settings.help.credit-separators",{more:!0}),$("settings.help.devices"),$("settings.help.bin",{more:!0}),$("settings.help.cleanup",{more:!0}),$("settings.help.backup",{more:!0}),$("settings.help.backup-now",{icon:e.jsx(Sm,{}),more:!0}),$("settings.help.backup-download",{icon:e.jsx(st,{}),more:!0}),$("settings.help.changelog",{more:!0}),$("settings.help.updates")]),profile:Ye("profile.help.title",[$("profile.help.photo",{icon:e.jsx(ma,{})}),$("profile.help.display-name"),$("profile.help.switch-account",{more:!0}),$("profile.help.log-out"),$("profile.help.password",{more:!0}),$("profile.help.users",{icon:e.jsx(ht,{}),more:!0}),$("profile.help.maintenance")]),capture:Ye("capture.help.title",[$("capture.help.no-work"),$("capture.help.book"),$("capture.help.film",{more:!0}),$("capture.help.quote",{icon:e.jsx(vc,{}),more:!0}),$("capture.help.save",{more:!0}),$("capture.help.import",{icon:e.jsx(ma,{}),asset:e.jsx(wy,{}),more:!0})])};function sh(t,n=!1){const o=Ln[t];return o?{title:o.title,entries:[...o.entries,...nh,...n?ah:oh]}:null}const vy=["home","library","book-detail","movies","movie-detail","quotes","anthologies","search","capture","checks","staging","tags","metadata","stats","bin","cleanup","settings","profile"];function ky(t=!1){const n=vy.filter(o=>Ln[o]).map(o=>({id:o,title:Ln[o].title,titleKey:Ln[o].titleKey,entries:Ln[o].entries}));return n.push({id:"everywhere",title:a("common.help.title"),titleKey:"common.help.title",entries:[...nh,...t?ah:oh]}),n}function ja({screen:t,side:n="bottom",variant:o="ring"}){const s=Ie(),r=sh(t,s);return r?e.jsx(om,{title:r.title,sections:ky(s),active:Ln[t]?t:"everywhere",side:n,variant:o}):null}function xy({screen:t,open:n,onClose:o}){const s=Ie(),r=sh(t,s);return!r||!n?null:e.jsx(or,{open:!0,title:r.title,onClose:o,children:e.jsx(sr,{entries:r.entries})})}function eo(t,n){const o=[t,""];return Object.defineProperty(o,1,{get:()=>a(n),enumerable:!0,configurable:!0}),o}const jy=[eo("book","vocab.kind.book.label"),eo("film","vocab.kind.movie.label"),eo("show","vocab.kind.show.label"),eo("game","vocab.kind.game.label")],Sy={book:"library",film:"movies",show:"movies",game:"movies"};function rh(t){return jy.filter(([n])=>(t==null?void 0:t[Sy[n]])!==!1)}function ih(t){return{kind:"book",id:t.id,title:t.title,sub:t.author||"",tag:"BOOK"}}function Qr(t){const n=t.media_type==="show"?"show":t.media_type==="game"?"game":"movie";return{kind:"screen",id:t.id,title:t.title,sub:t.release_year?String(t.release_year):"",media_type:n,tag:n==="show"?"SHOW":n==="game"?"GAME":"FILM"}}function lh({initialKind:t="book",onAdded:n,onCreated:o,initialQuery:s="",hideManual:r=!1,sections:i}){const l=rh(i),[h,d]=c.useState(()=>{var G;const R=t==="film"||t==="show"||t==="game"?t:"book";return l.some(([K])=>K===R)?R:((G=l[0])==null?void 0:G[0])||"book"}),[m,p]=c.useState(s||""),[u,f]=c.useState(""),[b,w]=c.useState(null),[v,g]=c.useState(!1),[y,k]=c.useState(""),[j,N]=c.useState(null),[S,x]=c.useState(!1),[L,A]=c.useState({movie:!1,game:!1}),[E,D]=c.useState(-1),q=h==="book",C=h==="show"?"show":h==="game"?"game":"movie",I=c.useMemo(()=>b&&q?gp(b):null,[b,q]);c.useEffect(()=>{Z("GET","/metadata/status").then(R=>{var G,K,M,Q;R.ok&&A({movie:((K=(G=R.data)==null?void 0:G.tmdb)==null?void 0:K.source)==="none",game:((Q=(M=R.data)==null?void 0:M.igdb)==null?void 0:Q.source)==="none"})})},[]);const O=!q&&(h==="game"?L.game:L.movie);function V(R){d(R),w(null),k(""),N(null),D(-1)}function P(R,G){G&&o&&o(R==="book"?ih(G):Qr(G)),n==null||n(R)}c.useEffect(()=>{s&&s.trim()&&h==="book"&&T()},[]);async function T(){const R=m.trim();if(!R)return;g(!0),k(""),N(null),w(null),D(-1);let G;if(q)G=await Z("POST","/books/lookup",Hd(R)?{isbn:R}:{title:R});else{const K={title:R,media_type:C};u.trim()&&(K.year=Number(u)),G=await Z("POST","/movies/lookup",K)}if(g(!1),G.ok)return w(G.data.candidates);if(!q&&G.status===503)return x(!0);k(le(G,a("error.lookup.failed")))}async function B(R){k("");const G=await Z("POST","/books",{title:R.title,author:R.author||void 0,isbn:R.isbn13||void 0,description:R.description||void 0,published_year:R.published_year||void 0,genres:R.genres||void 0,cover_url:R.cover_url||void 0,source:R.source,source_id:R.source_id,google_id:R.google_id||void 0,openlibrary_id:R.openlibrary_id||void 0});G.ok?P("book",G.data):k(le(G,a("error.add.book")))}async function _(R,G=!1){var M;k("");const K=await Z("POST","/movies",{...Rs(R,C),confirm_new:G});if(K.ok)return P("film",K.data);if(K.status===409&&((M=K.data)!=null&&M.needs_confirm))return N({cand:R,existing:K.data.existing||[]});k(le(K,a("error.add.title")))}async function U(R,G){g(!0),k("");const K=await Z("PUT",`/movies/${R}`,Rs(G,C));if(g(!1),K.ok)return P("film",K.data);k(le(K,a("error.enrich.title")))}const F=a(q?"capture.lookup.book.placeholder":C==="show"?"capture.lookup.show.placeholder":C==="game"?"capture.lookup.game.placeholder":"capture.lookup.film.placeholder"),X=!j&&(!!y||b&&b.length===0);return e.jsxs("div",{className:"space-y-3",children:[l.length>1&&e.jsx(dt,{ariaLabel:a("capture.lookup.kind.aria"),value:h,onChange:V,options:l}),e.jsxs("form",{onSubmit:R=>{R.preventDefault(),T()},className:"flex flex-wrap gap-2",children:[e.jsx("input",{className:"tp-input min-w-0 flex-1",style:{minWidth:180},"aria-label":F,placeholder:F,autoFocus:!0,value:m,onChange:R=>p(R.target.value)}),e.jsx("input",{className:"tp-input w-20 shrink-0",placeholder:a("capture.lookup.year.placeholder"),"aria-label":a("capture.lookup.year.aria"),inputMode:"numeric",maxLength:4,value:u,onChange:R=>f(R.target.value.replace(/\D/g,"").slice(0,4))}),e.jsx("button",{className:"tp-btn tp-btn-primary shrink-0",disabled:v,children:a(v?"capture.lookup.search.busy":"capture.lookup.search.label")})]}),O&&e.jsx("p",{className:"microcopy",style:{color:"var(--soft)"},children:a(h==="game"?"capture.lookup.nokey.game":"capture.lookup.nokey.film")}),e.jsx(ke,{children:y}),j&&e.jsx(Ud,{confirm:j,busy:v,onEnrich:R=>U(R,j.cand),onAddSeparate:()=>_(j.cand,!0),onCancel:()=>N(null)}),!j&&b&&b.length===0&&e.jsx(Jt,{children:a("capture.lookup.empty")}),!j&&b&&b.length>0&&e.jsx("ul",{className:"space-y-2.5",children:q?I.map((R,G)=>{const K=E===G,M=R.editions.length;return e.jsxs(c.Fragment,{children:[e.jsx(rs,{cover:R.cover_url,title:R.rep.title,sub:M>1?R.rep.author:[R.rep.author,R.rep.published_year||null,R.rep.isbn13].filter(Boolean).join(" · "),source:R.rep.source,count:M,expanded:K,onAdd:()=>M>1?D(K?-1:G):B(R.rep),busy:v}),K&&e.jsx("li",{children:e.jsx("ul",{className:"ml-6 space-y-2 border-l pl-3",style:{borderColor:"var(--line)"},children:R.editions.map((Q,z)=>e.jsx(rs,{cover:Q.cover_url,title:Q.title,sub:[Q.published_year||null,Q.isbn13].filter(Boolean).join(" · ")||a("capture.lookup.edition.none.label"),source:Q.source,onAdd:()=>B(Q),busy:v},z))})})]},G)}):b.map((R,G)=>e.jsx(rs,{cover:R.poster_url,title:R.title,sub:[R.release_year||null].filter(Boolean).join(" · "),source:R.source,sourceDetail:Gr(R),onAdd:()=>_(R),busy:v},G))}),!r&&X&&e.jsx(ge,{onClick:()=>x(!0),children:a("capture.lookup.manual.button.label")}),!r&&e.jsx("button",{type:"button",className:"tp-link block",onClick:()=>x(!0),children:a("capture.lookup.manual.link.label")}),S&&e.jsx(Ny,{kind:h,year:u,onClose:()=>x(!1),onAdded:P})]})}const us="manual-add-form";function Ny({kind:t,onClose:n,onAdded:o}){Nt(!0);const[s,r]=c.useState(t==="show"?"show":t==="game"?"game":"movie"),[i,l]=c.useState(""),[h,d]=c.useState(!1);c.useEffect(()=>{const u=f=>{f.key==="Escape"&&n()};return document.addEventListener("keydown",u),()=>document.removeEventListener("keydown",u)},[n]);const m=a(t==="book"?"capture.manual.book.title":t==="show"?"capture.manual.show.title":t==="game"?"capture.manual.game.title":"capture.manual.film.title"),p=!h&&!!i.trim();return Ve.createPortal(e.jsx("div",{className:"tp-scrim fixed inset-0 flex items-start justify-center overflow-y-auto px-4 py-10",style:{zIndex:60},role:"dialog","aria-modal":"true","aria-label":m,onMouseDown:u=>{u.target===u.currentTarget&&n()},children:e.jsxs(Je,{variant:1,className:"w-full max-w-lg px-6 py-6",children:[e.jsxs("div",{className:"mb-4 flex items-center gap-2",children:[e.jsx("h3",{className:"display-title flex-1 text-lg",children:m}),e.jsx(We,{icon:e.jsx(wt,{}),type:"submit",form:us,ariaLabel:a("common.action.save.label"),tooltip:a(p?"common.action.save.label":"error.validate.title-required"),disabled:!p}),e.jsx(We,{icon:e.jsx(it,{}),ariaLabel:a("common.action.close.label"),tooltip:a("capture.close.tip"),onClick:n})]}),t==="book"?e.jsx(zd,{formId:us,title:i,setTitle:l,onBusy:d,onAdded:u=>{o("book",u),n()}}):e.jsx(Gd,{formId:us,mediaType:s,setMediaType:r,title:i,setTitle:l,onBusy:d,onAdded:u=>{o("film",u),n()}})]})}),document.body)}const wl=8;function to(t,n){if(!n)return 0;const o=t.title.toLowerCase();return o.startsWith(n)?0:o.includes(n)?1:2}function ch({works:t,value:n,onChange:o,onCreate:s}){const[r,i]=c.useState(""),[l,h]=c.useState(!1),[d,m]=c.useState(0),p=c.useRef(null),{popRef:u,style:f}=Mt(l,p,{matchWidth:!0,minHeight:140});Lt(l,()=>h(!1),[p,u],{event:"pointerdown"});const b=r.trim().toLowerCase(),w=(t||[]).filter(x=>!b||x.title.toLowerCase().includes(b)||(x.sub||"").toLowerCase().includes(b)),v=w.filter(x=>x.kind==="book").sort((x,L)=>to(x,b)-to(L,b)),g=w.filter(x=>x.kind!=="book").sort((x,L)=>to(x,b)-to(L,b)),y=[];for(let x=0;y.length<wl&&(x<v.length||x<g.length);x++)for(const L of[v,g])L[x]&&y.length<wl&&y.push(L[x]);const k=y.length+1,j=x=>{o(x),i(""),h(!1)},N=()=>{s(r.trim()),i(""),h(!1)};function S(x){if(x.key==="ArrowDown")x.preventDefault(),l?m(L=>Math.min(L+1,k-1)):h(!0);else if(x.key==="ArrowUp")x.preventDefault(),m(L=>Math.max(L-1,0));else if(x.key==="Enter"){if(x.preventDefault(),!l)return;d<y.length?j(y[d]):N()}else x.key==="Escape"&&h(!1)}return n?e.jsxs("div",{className:"mt-1 flex flex-wrap items-center gap-2",children:[e.jsx("span",{className:"font-semibold",style:{fontFamily:"var(--font-display)",fontWeight:"var(--font-display-weight)",fontStyle:"var(--font-display-style)",fontVariantCaps:"var(--font-display-caps)",textTransform:"var(--font-display-case)",fontVariantNumeric:"var(--font-display-figures)",fontSize:"var(--type-display-17)"},children:n.title}),n.sub&&e.jsx("span",{className:"microcopy",children:n.sub}),e.jsx("span",{className:"mono-label",style:{fontSize:"var(--type-display-9)",color:n.kind==="book"?"var(--accent-ui)":"var(--amber)"},children:n.tag}),e.jsx("button",{type:"button",className:"tp-link ml-auto",onClick:()=>o(null),children:a("capture.picker.change.label")})]}):e.jsxs("div",{className:"token-input",ref:p,children:[e.jsx("input",{className:"tp-input",placeholder:a("capture.picker.placeholder"),value:r,onChange:x=>{i(x.target.value),h(!0),m(0)},onFocus:()=>h(!0),onKeyDown:S}),l&&Ve.createPortal(e.jsxs("ul",{ref:u,className:"token-menu",style:f,role:"listbox",children:[y.map((x,L)=>e.jsx("li",{children:e.jsx("button",{type:"button",className:"token-opt"+(d===L?" hi":""),onClick:()=>j(x),children:e.jsxs("span",{className:"flex items-center justify-between gap-3",children:[e.jsxs("span",{className:"truncate",children:[x.title,x.sub&&e.jsxs("span",{style:{color:"var(--soft)"},children:[" · ",x.sub]})]}),e.jsx("span",{className:"mono-label",style:{flex:"none",fontSize:"var(--type-ui-9)",color:x.kind==="book"?"var(--accent-ui)":"var(--amber)"},children:x.tag})]})})},`${x.kind}:${x.id}`)),e.jsx("li",{children:e.jsx("button",{type:"button",className:"token-opt"+(d===y.length?" hi":""),style:{color:"var(--accent-ui)",fontWeight:600},onClick:N,children:r.trim()?a("capture.picker.create.label",{title:`“${r.trim()}”`}):a("capture.picker.create.blank.label")})})]}),document.body)]})}const Ty="tippani:lastCapture",Cy=1800*1e3;function Ey({initialTarget:t=null,initialStandalone:n=!1,onCaptured:o,onWorkCreated:s,onSaveState:r}){var O,V,P,T,B;Nt(!0);const[i,l]=c.useState(null),[h,d]=c.useState(null),[m,p]=c.useState(""),[u,f]=c.useState(!1),[b,w]=$e(Ty,null),[v]=c.useState(()=>{if(!b||typeof b!="object")return{color:"yellow",tags:"",targetKey:null};const _=typeof b.at=="number"&&Date.now()-b.at<Cy;return{color:b.color||"yellow",tags:b.tags||"",targetKey:_&&b.targetKey||null}}),[g,y]=c.useState({target:null,quote:"",note:"",chapter:"",chapter_no:"",location:"",character:"",timestamp:"",season:"",episode:"",episodeName:"",act:"",quest:"",tags:v.tags,color:v.color,speaker:"",occasion:"",occasionDate:"",place:"",kind:"",region:"",recipient:"",workTitle:"",locator:"",circa:!1}),[k,j]=c.useState(n);c.useEffect(()=>{j(n)},[n]),c.useEffect(()=>{Promise.all([Z("GET","/books"),Z("GET","/movies")]).then(([_,U])=>{const F=[];if(_.ok&&_.data)for(const X of _.data.books||[])F.push({kind:"book",id:X.id,title:X.title,sub:X.author||"",tag:a("common.badge.book")});if(U.ok&&U.data)for(const X of U.data.movies||[])F.push(Qr(X));if(l(F),t){const X=t.type==="movie"?"screen":"book",R=F.find(G=>G.kind===X&&G.id===t.id);R&&y(G=>({...G,target:R}))}else if(v.targetKey){const X=F.find(R=>`${R.kind}:${R.id}`===v.targetKey);X&&y(R=>R.target?R:{...R,target:X})}})},[t==null?void 0:t.type,t==null?void 0:t.id]);const N=_=>y(U=>({...U,..._})),S=!k&&((O=g.target)==null?void 0:O.kind)==="screen",x=S&&((V=g.target)==null?void 0:V.media_type)==="show",L=S&&((P=g.target)==null?void 0:P.media_type)==="game",A=Mc(k?null:g.target),E=`capture-${((T=g.target)==null?void 0:T.kind)||"none"}-${((B=g.target)==null?void 0:B.id)||0}`,D=S?A.actorFor(g.character):"";function q(_){l(U=>[_,...U||[]]),N({target:_}),d(null),s==null||s()}const C=k?g.quote.trim()?g.occasionDate&&!ba(g.occasionDate)?a("error.validate.date"):"":a("error.validate.quote-words"):g.target?S&&!g.quote.trim()?a("error.validate.line-words"):!S&&!g.quote.trim()&&!g.note.trim()?a("error.validate.quote-or-note"):x&&hn(g.episode)!=null&&hn(g.season)==null?a("error.validate.season-required"):"":a("error.validate.target-required");async function I(){const _=g.target;if(C)return p(C.toLowerCase());f(!0),p("");const U=g.tags.split(",").map(X=>X.trim()).filter(Boolean),F=k?await Z("POST","/quotes",{quote:g.quote.trim(),note:g.note.trim(),speaker:g.speaker.trim(),occasion:g.occasion.trim(),occasion_date:g.occasionDate.trim(),place:g.place.trim(),kind:g.kind,region:g.region.trim(),recipient:g.recipient.trim(),work_title:g.workTitle.trim(),locator:g.locator.trim(),occasion_circa:g.circa,color:g.color,tags:U}):S?await Z("POST","/dialogues",{movie_id:_.id,quote:g.quote.trim(),note:g.note.trim(),character:g.character.trim(),timestamp:L?"":g.timestamp.trim(),act:L?g.act.trim():"",quest:L?g.quest.trim():"",season:x?hn(g.season):null,episode:x?hn(g.episode):null,episode_name:x?g.episodeName.trim():"",color:g.color,tags:U}):await Z("POST","/annotations",{book_id:_.id,quote:g.quote.trim(),note:g.note.trim(),chapter:g.chapter.trim(),chapter_no:Number(String(g.chapter_no).trim())||0,location:g.location.trim(),character:g.character.trim(),color:g.color,tags:U});if(f(!1),!F.ok)return p(le(F));Ee(a(k?"capture.toast.quote":S?"capture.toast.dialogue":"capture.toast.annotation")),w({at:Date.now(),color:g.color,tags:g.tags,targetKey:k||!_?null:`${_.kind}:${_.id}`}),o==null||o()}return c.useEffect(()=>{r==null||r({canSave:!C&&!u,busy:u,why:C,save:I})},[C,u,g]),e.jsxs("div",{className:"flex flex-col gap-3.5",children:[e.jsxs("div",{className:"tp-field",children:[e.jsxs("div",{className:"flex items-center justify-between gap-2",children:[e.jsx(W,{children:a(k?"capture.form.standalone.label":"capture.form.target.label")}),e.jsx("button",{type:"button",className:ut(k),"aria-pressed":k,onClick:()=>{j(!k),d(null),p(""),k||N({target:null})},children:a("capture.form.standalone.chip.label")})]}),!k&&e.jsx(ch,{works:i,value:g.target,onChange:_=>{N({target:_}),_&&d(null)},onCreate:_=>{p(""),d({title:_})}})]}),h&&!g.target&&!k&&e.jsxs("div",{className:"space-y-2.5",style:{border:"1.4px dashed var(--ink-border)",borderRadius:10,padding:"10px 12px"},children:[e.jsxs("div",{className:"flex items-center justify-between gap-2",children:[e.jsx(W,{children:a("capture.form.create.label")}),e.jsx("button",{type:"button",className:"tp-link",onClick:()=>d(null),children:a("capture.form.create.cancel.label")})]}),e.jsx(lh,{initialQuery:h.title,onCreated:q})]}),e.jsxs("label",{className:"tp-field",children:[e.jsx(W,{children:a("common.field.quote.label")}),e.jsx("textarea",{className:"tp-input",rows:4,placeholder:a("capture.form.quote.placeholder"),style:{fontFamily:"var(--font-display)",fontWeight:"var(--font-display-weight)",fontVariantCaps:"var(--font-display-caps)",textTransform:"var(--font-display-case)",fontVariantNumeric:"var(--font-display-figures)",fontStyle:"italic",fontSize:"var(--type-display-17)",lineHeight:1.55},value:g.quote,onChange:_=>N({quote:_.target.value})})]}),e.jsxs("label",{className:"tp-field",children:[e.jsx(W,{children:a("common.field.note.label")}),e.jsx("textarea",{className:"tp-input",rows:2,placeholder:a("capture.form.note.placeholder"),value:g.note,onChange:_=>N({note:_.target.value})})]}),k?e.jsxs(e.Fragment,{children:[e.jsxs("div",{className:"grid grid-cols-2 gap-3",children:[e.jsxs("label",{className:"tp-field",children:[e.jsx(W,{children:a("common.field.speaker.label")}),e.jsx("input",{className:"tp-input",placeholder:a("common.field.speaker.placeholder"),value:g.speaker,onChange:_=>N({speaker:_.target.value})})]}),e.jsxs("label",{className:"tp-field",children:[e.jsx(W,{children:a("common.field.occasion.label")}),e.jsx("input",{className:"tp-input",placeholder:a("common.field.occasion.placeholder"),value:g.occasion,onChange:_=>N({occasion:_.target.value})})]})]}),e.jsxs("div",{className:"grid grid-cols-2 gap-3",children:[e.jsx(ya,{label:a("quotes.form.when.label"),value:g.occasionDate,onChange:_=>N({occasionDate:_})}),e.jsxs("label",{className:"tp-field",children:[e.jsx(W,{children:a("common.field.place.label")}),e.jsx("input",{className:"tp-input",placeholder:a("common.field.place.placeholder"),value:g.place,onChange:_=>N({place:_.target.value})})]})]}),e.jsxs("label",{className:"tp-field",children:[e.jsx(W,{children:a("quotes.form.kind.label")}),e.jsx(De,{ariaLabel:a("quotes.form.kind.label"),value:g.kind,onChange:_=>N({kind:_}),options:jr()})]}),e.jsx(W,{children:a("quotes.form.carries.label")}),e.jsxs("div",{className:"grid grid-cols-2 gap-3",children:[e.jsxs("label",{className:"tp-field",children:[e.jsx(W,{children:a("common.field.region.label")}),e.jsx("input",{className:"tp-input",placeholder:a("quotes.form.region.placeholder"),value:g.region,onChange:_=>N({region:_.target.value})})]}),e.jsxs("label",{className:"tp-field",children:[e.jsx(W,{children:a("common.field.recipient.label")}),e.jsx("input",{className:"tp-input",placeholder:a("quotes.form.recipient.placeholder"),value:g.recipient,onChange:_=>N({recipient:_.target.value})})]})]}),e.jsxs("div",{className:"grid grid-cols-2 gap-3",children:[e.jsxs("label",{className:"tp-field",children:[e.jsx(W,{children:a("common.field.work-title.label")}),e.jsx("input",{className:"tp-input",placeholder:a("quotes.form.work-title.placeholder"),value:g.workTitle,onChange:_=>N({workTitle:_.target.value})})]}),e.jsxs("label",{className:"tp-field",children:[e.jsx(W,{children:a("common.field.locator.label")}),e.jsx("input",{className:"tp-input",placeholder:a("quotes.form.locator.placeholder"),value:g.locator,onChange:_=>N({locator:_.target.value})})]})]}),e.jsxs("label",{className:"flex items-center gap-2",children:[e.jsx("input",{type:"checkbox",checked:g.circa,onChange:_=>N({circa:_.target.checked})}),e.jsx("span",{className:"microcopy",children:a("quotes.form.circa.label")})]})]}):S?e.jsxs(e.Fragment,{children:[e.jsxs("div",{className:"grid grid-cols-2 gap-3",children:[e.jsxs("div",{children:[e.jsx(As,{label:a("common.field.character.label"),placeholder:a("common.field.character.placeholder"),value:g.character,onChange:_=>N({character:_}),cast:A.cast}),D&&e.jsx("span",{className:"microcopy",children:a("capture.form.played-by.prose",{name:D})})]}),L?e.jsxs("label",{className:"tp-field",children:[e.jsx(W,{children:a("common.field.act.label")}),e.jsx("input",{className:"tp-input",placeholder:a("capture.form.act.placeholder"),value:g.act,onChange:_=>N({act:_.target.value})})]}):e.jsxs("label",{className:"tp-field",children:[e.jsx(W,{children:a("common.field.timestamp.label")}),e.jsx("input",{className:"tp-input",placeholder:a("capture.form.timestamp.placeholder"),value:g.timestamp,onChange:_=>N({timestamp:_.target.value})})]})]}),L&&e.jsxs("label",{className:"tp-field",children:[e.jsx(W,{children:a("common.field.quest.label")}),e.jsx("input",{className:"tp-input",placeholder:a("capture.form.quest.placeholder"),value:g.quest,onChange:_=>N({quest:_.target.value})})]}),x&&e.jsxs(e.Fragment,{children:[e.jsxs("div",{className:"grid grid-cols-2 gap-3",children:[e.jsxs("label",{className:"tp-field",children:[e.jsx(W,{children:a("common.field.season.label")}),e.jsx("input",{className:"tp-input",type:"number",min:"0",max:"999",placeholder:a("capture.form.season.placeholder"),value:g.season,onChange:_=>N({season:_.target.value})})]}),e.jsxs("label",{className:"tp-field",children:[e.jsx(W,{children:a("common.field.episode.label")}),e.jsx("input",{className:"tp-input",type:"number",min:"0",max:"9999",placeholder:a("capture.form.episode.placeholder"),value:g.episode,onChange:_=>N({episode:_.target.value})})]})]}),e.jsxs("label",{className:"tp-field",children:[e.jsx(W,{children:a("common.field.episode-name.label")}),e.jsx("input",{className:"tp-input",placeholder:a("capture.form.episode-name.placeholder"),value:g.episodeName,onChange:_=>N({episodeName:_.target.value})})]})]})]}):e.jsxs(e.Fragment,{children:[e.jsxs("div",{className:"grid grid-cols-2 gap-3",children:[e.jsxs("label",{className:"tp-field",children:[e.jsx(W,{children:a("common.field.chapter-no.label")}),e.jsx("input",{className:"tp-input",inputMode:"decimal",list:A.chapterNumbers.length?`${E}-chno`:void 0,placeholder:a("capture.form.chapter-no.placeholder"),value:g.chapter_no,onChange:_=>N({chapter_no:_.target.value.replace(/[^\d.]/g,"").slice(0,7)})}),e.jsx(Co,{id:`${E}-chno`,options:A.chapterNumbers})]}),e.jsxs("label",{className:"tp-field",children:[e.jsx(W,{children:a("common.field.chapter-name.label")}),e.jsx("input",{className:"tp-input",list:A.chapterNames.length?`${E}-chname`:void 0,placeholder:a("capture.form.chapter-name.placeholder"),value:g.chapter,onChange:_=>{const U=_.target.value,F=A.chapterNoFor(U);N(F&&!String(g.chapter_no).trim()?{chapter:U,chapter_no:String(F)}:{chapter:U})}}),e.jsx(Co,{id:`${E}-chname`,options:A.chapterNames})]}),e.jsxs("label",{className:"tp-field",children:[e.jsx(W,{children:a("common.field.location.label")}),e.jsx("input",{className:"tp-input",placeholder:a("capture.form.location.placeholder"),value:g.location,onChange:_=>N({location:_.target.value})})]})]}),e.jsx(As,{label:a("common.field.character.label"),placeholder:a("book.quote.form.character.placeholder"),value:g.character,onChange:_=>N({character:_}),cast:A.cast})]}),e.jsxs("label",{className:"tp-field",children:[e.jsx(W,{children:a("capture.form.tags.label")}),e.jsx("input",{className:"tp-input",style:{fontFamily:"var(--font-mono)",fontWeight:"var(--font-mono-weight)",fontStyle:"var(--font-mono-style)",fontVariantCaps:"var(--font-mono-caps)",textTransform:"var(--font-mono-case)",fontVariantNumeric:"var(--font-mono-figures)",fontSize:"var(--type-mono-13)"},placeholder:a("capture.form.tags.placeholder"),value:g.tags,onChange:_=>N({tags:_.target.value})})]}),e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx(W,{children:a("common.mono.colour.label")}),e.jsx(rt,{value:g.color,onChange:_=>N({color:_})})]}),e.jsx(ke,{children:m}),C&&e.jsx("p",{className:"microcopy",style:{color:"var(--faint)"},children:a("capture.form.missing.hint",{reason:C})})]})}function Ay({open:t,initialSection:n="book",initialTarget:o=null,onClose:s,onAdded:r,onOpenMovie:i,onCaptured:l,onWorkCreated:h,pendingImport:d=0,onReviewImport:m,onStaged:p,sections:u}){const b=rh(u).length>0,w=E=>E==="import"?"import":E==="quote"||E==="standalone"?"quote":b?"add":"quote",[v,g]=c.useState(w(n)),[y,k]=c.useState(null),j=Ie(),N=(j?[["add",a("capture.tab.add.short.label")],["quote",a("capture.tab.quote.short.label")],["import",a("capture.tab.import.short.label")]]:[["add",a("capture.tab.add.label")],["quote",a("capture.tab.quote.label")],["import",a("capture.tab.import.label")]]).filter(([E])=>E!=="add"||b);if(c.useEffect(()=>{t&&(g(w(n)),k(null))},[t,n]),c.useEffect(()=>{v!=="quote"&&k(null)},[v]),c.useEffect(()=>{if(!t)return;const E=D=>{D.key==="Escape"&&s()};return document.addEventListener("keydown",E),()=>document.removeEventListener("keydown",E)},[t,s]),!t)return null;const S=a(v==="quote"?"capture.title.quote":v==="import"?"capture.title.import":"capture.title.add"),x=y&&e.jsx(We,{icon:e.jsx(wt,{}),ariaLabel:a("common.action.save.label"),tooltip:y.busy?a("common.action.save.busy"):y.canSave?a("common.action.save.label"):y.why||a("capture.save.blocked.tip"),ok:!0,disabled:!y.canSave||y.busy,onClick:()=>y.save()}),L=e.jsx(We,{icon:e.jsx(it,{}),ariaLabel:a("common.action.close.label"),tooltip:a("capture.close.tip"),onClick:s}),A=e.jsxs(e.Fragment,{children:[e.jsx("div",{className:"mb-5",children:e.jsx(dt,{ariaLabel:a("capture.tabs.aria"),value:v,onChange:g,options:N})}),v==="add"&&e.jsx(lh,{initialKind:n==="film"?"film":"book",onAdded:E=>r==null?void 0:r(E),sections:u}),v==="quote"&&e.jsx(Ey,{initialTarget:o,initialStandalone:n==="standalone",onCaptured:l,onWorkCreated:h,onSaveState:k}),v==="import"&&e.jsxs(e.Fragment,{children:[d>0&&m&&e.jsx("button",{type:"button",className:"tp-btn tp-btn-primary w-full",style:{marginBottom:12},onClick:m,children:a("capture.import.pending",{count:d,n:d})}),e.jsx(hy,{embedded:!0,onReviewImport:m,onStaged:p})]})]});return j?Ve.createPortal(e.jsx(yn,{open:!0,onClose:s,title:S,dismissOnScrim:!1,actions:e.jsxs("span",{className:"flex shrink-0 items-center",children:[e.jsx(ja,{screen:"capture"}),x]}),children:A}),document.body):e.jsx("div",{className:"tp-scrim fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-4 py-10",role:"dialog","aria-modal":"true","aria-label":a("capture.dialog.aria"),onMouseDown:E=>{E.target===E.currentTarget&&s()},children:e.jsxs(Je,{variant:2,className:"w-full max-w-2xl px-6 py-6",children:[e.jsxs("div",{className:"mb-4 flex items-center gap-2",children:[e.jsx("h2",{className:"display-title flex-1 text-xl",children:S}),e.jsx(ja,{screen:"capture"}),x,L]}),A]})})}const qy=["add","subtract","multiply","divide","set","reset"],dh=t=>a(`staging.formula.op.${t}.label`),My=()=>qy.map(t=>[t,dh(t)]),Ly={book:"common.badge.book",movie:"common.badge.film",show:"common.badge.show",quotes:"staging.badge.quotes"},hh=t=>a(Ly[t]||"common.badge.book"),vl=t=>t.kind==="book"?a("unit.book",{count:1}):t.kind==="show"?a("unit.show",{count:1}):a("unit.film",{count:1});function Dy({onPending:t,onOpenBook:n,onOpenMovie:o,onApproved:s,embedded:r=!1}){const[i,l]=c.useState(null),[h,d]=c.useState("all"),[m,p]=c.useState(()=>new Set),[u,f]=c.useState(null),[b,w]=c.useState(null),[v,g]=c.useState(""),[y,k]=c.useState(!1),[j,N]=c.useState(""),[S,x]=c.useState(""),L=Ie(),A=c.useRef(0);async function E(){const Q=++A.current,z=await Z("GET","/import/staged");if(Q!==A.current)return;if(!z.ok)return g(le(z,a("error.load.import-queue")));g(""),l(z.data),t==null||t(z.data.pending||0);const te=new Set((z.data.quotes||[]).map(J=>J.id));p(J=>new Set([...J].filter(fe=>te.has(fe)))),d(J=>J!=="all"&&!(z.data.batches||[]).some(fe=>String(fe.id)===String(J))?"all":J)}c.useEffect(()=>{E()},[]);const D=(i==null?void 0:i.batches)||[],q=(i==null?void 0:i.works)||[],C=(i==null?void 0:i.quotes)||[],I=c.useMemo(()=>h==="all"?C:C.filter(Q=>String(Q.batch_id)===String(h)),[C,h]),O=c.useMemo(()=>{const Q=new Map;for(const z of I)Q.has(z.staged_work_id)||Q.set(z.staged_work_id,[]),Q.get(z.staged_work_id).push(z);return q.filter(z=>(h==="all"||String(z.batch_id)===String(h))&&(Q.has(z.id)||z.quotes===0)).map(z=>({work:z,items:Q.get(z.id)||[]}))},[I,q,h]),V=I.map(Q=>Q.id),P=V.filter(Q=>m.has(Q)),T=P.length,B=V.length>0&&P.length===V.length,_=Q=>p(z=>{const te=new Set(z);return te.has(Q)?te.delete(Q):te.add(Q),te}),U=Q=>p(z=>{const te=new Set(z),J=Q.every(fe=>te.has(fe.id));for(const fe of Q)(J?te.delete:te.add).call(te,fe.id);return te}),F=()=>p(new Set);async function X(Q,z){if(y)return;k(!0),g("");const te=await Z("POST","/import/staged/bulk",{ids:P,...Q});if(k(!1),!te.ok)return g(le(te,a("error.apply.edit")));N(z||a("staging.flash.updated",{n:te.data.updated})),await E()}async function R(Q){if(y)return;k(!0),g("");const z=await Z("POST","/import/staged/approve",Q?{ids:Q}:{all:!0});if(k(!1),!z.ok)return g(le(z,a("error.approve.generic")));const{added:te=0,skipped:J=0,enriched:fe=0}=z.data;N([a("staging.flash.approved.added",{n:te}),a("staging.flash.approved.skipped",{n:J}),fe>0&&a("staging.flash.approved.enriched",{n:fe})].filter(Boolean).join(" · ")),F(),await E(),s==null||s(z.data)}async function G(Q){if(y)return;k(!0),g("");const z=await Z("DELETE","/import/staged",Q?{ids:Q}:{all:!0});if(k(!1),!z.ok)return g(le(z,a("error.discard.generic")));N(a("staging.flash.discarded",{n:z.data.discarded})),F(),await E()}if(!i)return e.jsxs("section",{className:"space-y-5",children:[e.jsx(ss,{embedded:r,title:a("staging.title"),counts:a("staging.state.loading")}),e.jsx(ke,{children:v})]});if(i.pending===0&&q.length===0)return e.jsxs("section",{className:"space-y-5",children:[e.jsx(ss,{embedded:r,title:a("staging.title"),counts:a("staging.state.empty-counts")}),e.jsx(Jt,{children:a("staging.state.empty")})]});const K=[["all",a("staging.filter.all-files.label",{n:i.pending})],...D.map(Q=>[String(Q.id),a("staging.filter.batch.label",{name:Q.filename||Q.source,n:Q.quotes})])],M=e.jsxs(e.Fragment,{children:[e.jsx(W,{style:{color:"var(--faint)"},children:j}),e.jsx(ge,{disabled:y,onClick:()=>w({title:a("staging.discard-all.confirm.title"),body:a("staging.discard-all.confirm.body",{n:i.pending}),label:a("staging.discard-all.label"),run:()=>G(null)}),children:a("staging.discard-all.label")}),e.jsx("button",{className:"tp-btn tp-btn-primary",disabled:y,onClick:()=>R(null),children:i.pending>0?a("staging.approve-all.count.label",{n:i.pending}):a("staging.approve-all.label")})]});return e.jsxs("section",{className:"space-y-5",children:[e.jsx("div",{className:L&&!r?"mobile-sticky-bar":"",children:e.jsx(ss,{embedded:r,title:a("staging.title"),counts:i.pending>0?a("staging.counts.quotes",{count:i.pending,n:i.pending}):a("staging.counts.works",{count:q.length,n:q.length}),right:L?null:M})}),L&&e.jsx("div",{className:"flex flex-wrap items-center gap-2",children:M}),e.jsxs("div",{className:"filter-row",children:[e.jsxs("label",{className:"flex items-center gap-2",children:[e.jsx(W,{children:a("staging.filter.file.label")}),e.jsx(De,{ariaLabel:a("staging.filter.batch.aria"),value:h,onChange:d,options:K,width:L?void 0:260})]}),e.jsxs("label",{className:"flex items-center gap-2",style:{marginLeft:"auto"},children:[e.jsx("input",{type:"checkbox",checked:B,onChange:()=>p(B?new Set:new Set(V))}),e.jsx("span",{className:"microcopy",children:a("staging.select-all.label",{n:V.length})})]})]}),e.jsxs(Pu,{n:T,onClear:F,children:[e.jsx(rt,{value:"",ariaLabel:a("staging.bulk.colour.aria"),onChange:Q=>X({color:Q},a("staging.flash.colour",{name:In(Q)}))}),e.jsx(ge,{disabled:y,onClick:()=>X({favorite:!0},a("staging.flash.favourited")),children:a("staging.bulk.favourite.label")}),e.jsx(ye,{label:a("staging.bulk.unfavourite.tip"),children:e.jsx(ge,{disabled:y,onClick:()=>X({favorite:!1},a("staging.flash.unfavourited")),children:a("staging.bulk.unfavourite.label")})}),e.jsx(ge,{icon:e.jsx(et,{}),onClick:()=>x(S==="fields"?"":"fields"),children:a("staging.bulk.fields.label")}),e.jsx(ge,{icon:e.jsx(So,{}),onClick:()=>x(S==="move"?"":"move"),children:a("staging.bulk.move.label")}),e.jsx(ge,{icon:e.jsx(Am,{}),onClick:()=>x(S==="formula"?"":"formula"),children:a("staging.bulk.locations.label")}),e.jsx("button",{className:"tp-btn tp-btn-primary",disabled:y,onClick:()=>R(P),children:a("staging.bulk.approve.label",{n:T})}),e.jsx(ge,{disabled:y,onClick:()=>w({title:a("staging.discard.confirm.title",{count:T,n:T}),body:a("staging.discard.confirm.body"),label:a("staging.discard.label"),run:()=>G(P)}),children:a("staging.discard.label")})]}),T>0&&S==="fields"&&e.jsx(Ry,{n:T,busy:y,onApply:X}),T>0&&S==="move"&&e.jsx(Iy,{n:T,busy:y,works:q,onApply:X}),T>0&&S==="formula"&&e.jsx(Py,{n:T,busy:y,onApply:X}),e.jsx(ke,{children:v}),e.jsxs("div",{className:"space-y-8",children:[O.map(({work:Q,items:z})=>e.jsx(_y,{work:Q,items:z,sel:m,onToggle:_,onToggleGroup:()=>U(z),onEdit:f,onOpenBook:n,onOpenMovie:o},Q.id)),O.length===0&&e.jsx(Jt,{children:a("staging.state.empty-file")})]}),e.jsx(Ke,{open:!!u,onClose:()=>f(null),title:a("staging.form.title"),children:u&&e.jsx(Fy,{quote:u,onCancel:()=>f(null),onSaved:async Q=>{const z=await Z("POST","/import/staged/bulk",{ids:[u.id],...Q});return z.ok?(f(null),N(a("staging.flash.saved")),await E(),null):le(z,a("error.save.generic"))}})}),b&&e.jsx(mt,{open:!0,title:b.title,body:b.body,confirmLabel:b.label,onCancel:()=>w(null),onConfirm:()=>{const Q=b.run;w(null),Q()}})]})}function _y({work:t,items:n,sel:o,onToggle:s,onToggleGroup:r,onEdit:i,onOpenBook:l,onOpenMovie:h}){const d=n.length>0&&n.every(w=>o.has(w.id)),m=t.kind==="book",p=t.kind==="quotes",u=()=>{t.target_id&&(m?l==null||l(t.target_id):h==null||h(t.target_id))},f=t.target_title||t.title,b=t.target_year?a("staging.group.target.year.label",{title:f,year:t.target_year}):f;return e.jsxs("section",{children:[e.jsxs("div",{className:"mb-3 flex flex-wrap items-center gap-3",children:[e.jsx(ye,{label:a("staging.group.select.tip"),side:"bottom",children:e.jsx("input",{type:"checkbox",checked:d,onChange:r,"aria-label":a("staging.group.select.aria",{title:t.title})})}),e.jsx("h3",{className:"display-title truncate",style:{fontSize:"var(--type-ui-19)"},children:t.title}),e.jsx(W,{style:{color:m||p?"var(--accent-ui)":"var(--amber)"},children:hh(t.kind)}),e.jsx(W,{style:{color:"var(--accent-ui)"},children:a("common.count.phrase",{n:n.length,noun:a("unit.quote",{count:n.length})})}),e.jsx("span",{className:"h-px flex-1",style:{background:"var(--line)"}})]}),e.jsxs("p",{className:"microcopy mb-3",children:[p?a("staging.group.standalone.prose"):t.target_id?e.jsxs(e.Fragment,{children:[Pe("staging.group.joins.prose",{target:e.jsx("button",{type:"button",className:"tp-link",onClick:u,children:b},"target")}),t.pinned&&e.jsxs("span",{style:{color:"var(--accent-ui)"},children:[" · ",a("staging.group.pinned.label")]})]}):a("staging.group.new.prose",{kind:vl(t)}),t.ambiguous&&e.jsxs("span",{style:{color:"var(--amber)"},children:[" ",a("staging.group.ambiguous.warning",{n:t.alternatives+1})]})]}),n.length===0?e.jsx("p",{className:"microcopy",style:{color:"var(--faint)"},children:p?a("staging.group.empty.standalone"):a("staging.group.empty.work",{kind:vl(t)})}):e.jsx("ul",{className:"space-y-2",children:n.map(w=>e.jsx("li",{children:e.jsx(Oy,{quote:w,selected:o.has(w.id),onToggle:()=>s(w.id),onEdit:()=>i(w)})},w.id))})]})}function Oy({quote:t,selected:n,onToggle:o,onEdit:s}){var l;const r=[gn(t),t.location,t.character,t.actor,xn(t),t.timestamp,t.speaker,t.occasion,t.occasion_date,t.place,Ra(t),t.noted_at?t.noted_at.slice(0,10):""].filter(Boolean),i=t.location&&t.location_orig&&t.location!==t.location_orig||t.timestamp&&t.timestamp_orig&&t.timestamp!==t.timestamp_orig;return e.jsxs("div",{className:"flex items-start gap-3 p-3",style:{background:n?"color-mix(in srgb, var(--accent) 7%, var(--raised))":"var(--raised)",border:`1px solid ${n?"color-mix(in srgb, var(--accent) 35%, var(--line))":"var(--line)"}`,borderRadius:8,borderLeft:`4px solid ${jn(t.color)||"var(--line)"}`},children:[e.jsx(ye,{label:a("staging.row.select.tip"),children:e.jsx("input",{type:"checkbox",checked:n,onChange:o,"aria-label":a("staging.row.select.aria"),style:{marginTop:3}})}),e.jsxs("div",{className:"min-w-0 flex-1",children:[e.jsx("p",{className:"whitespace-pre-wrap",style:{fontFamily:"var(--font-display)",fontWeight:"var(--font-display-weight)",fontVariantCaps:"var(--font-display-caps)",textTransform:"var(--font-display-case)",fontVariantNumeric:"var(--font-display-figures)",fontStyle:"italic",fontSize:"var(--type-display-15)",lineHeight:1.5},children:t.quote||t.note}),t.translation&&e.jsx("p",{className:"microcopy mt-1",children:a("staging.row.translation.label",{text:t.translation})}),t.quote&&t.note&&e.jsx("p",{className:"microcopy mt-1",children:a("staging.row.note.label",{note:t.note})}),(r.length>0||((l=t.tags)==null?void 0:l.length)>0||t.favorite)&&e.jsxs("div",{className:"mt-1.5 flex flex-wrap items-center gap-2",children:[r.map((h,d)=>e.jsx(W,{style:{color:"var(--faint)"},children:h},d)),i&&e.jsx(W,{style:{color:"var(--accent-ui)"},title:a("staging.row.shifted.tip"),children:a("staging.row.shifted.label")}),t.favorite&&e.jsx("span",{style:{color:"var(--accent)"},children:"♥"}),(t.tags||[]).map(h=>e.jsx(Ma,{children:h},h))]})]}),e.jsx(Ae,{icon:e.jsx(et,{}),ariaLabel:a("common.action.edit.label"),onClick:s,tooltip:a("common.action.edit.row.tip",{noun:a("unit.quote",{count:1})}),className:"shrink-0"})]})}function Ry({n:t,busy:n,onApply:o}){const[s,r]=c.useState({}),[i,l]=c.useState({}),[h,d]=c.useState([]),[m,p]=c.useState([]),u=[["chapter_no","common.field.chapter-no.label"],["chapter","common.field.chapter-name.label"],["location","common.field.location.label"],["character","common.field.character.label"],["actor","common.field.actor.label"],["season","common.field.season.label"],["episode","common.field.episode.label"],["timestamp","common.field.timestamp.label"]];function f(){const b={};for(const[w]of u)s[w]&&(b[w]=(i[w]||"").trim());h.length&&(b.add_tags=h),m.length&&(b.remove_tags=m),Object.keys(b).length!==0&&o(b,a("staging.flash.edited",{n:t}))}return e.jsxs(Zr,{title:a("staging.fields.panel.title",{n:t}),children:[u.map(([b,w])=>e.jsxs("label",{className:"flex flex-wrap items-center gap-2",children:[e.jsx("input",{type:"checkbox",checked:!!s[b],onChange:v=>r({...s,[b]:v.target.checked})}),e.jsx("span",{className:"microcopy",style:{minWidth:76},children:a(w)}),e.jsx("input",{className:"tp-input w-auto flex-1",placeholder:a("staging.fields.set.placeholder",{field:a(w).toLowerCase()}),disabled:!s[b],value:i[b]||"",onChange:v=>l({...i,[b]:v.target.value})})]},b)),e.jsxs("div",{className:"grid gap-2 sm:grid-cols-2",children:[e.jsxs("label",{className:"tp-field",children:[e.jsx(W,{children:a("common.action.add-tags.label")}),e.jsx(yt,{value:h,onChange:d,placeholder:a("common.field.tags.placeholder"),ariaLabel:a("staging.fields.add-tags.aria")})]}),e.jsxs("label",{className:"tp-field",children:[e.jsxs(W,{children:[a("staging.fields.remove-tags.label")," ",e.jsx(Re,{text:a("staging.fields.remove-tags.info")})]}),e.jsx(yt,{value:m,onChange:p,placeholder:a("staging.fields.remove-tags.placeholder"),ariaLabel:a("staging.fields.remove-tags.aria")})]})]}),e.jsx("button",{className:"tp-btn tp-btn-primary",disabled:n,onClick:f,children:a("staging.fields.apply.label",{n:t})})]})}function Iy({n:t,busy:n,works:o,onApply:s}){const[r,i]=c.useState([]),[l,h]=c.useState(null),[d,m]=c.useState("");c.useEffect(()=>{Promise.all([Z("GET","/books"),Z("GET","/movies")]).then(([u,f])=>{const b=[];u.ok&&b.push(...(u.data.books||[]).map(ih)),f.ok&&b.push(...(f.data.movies||[]).map(Qr)),i(b)})},[]);const p=[["",a("staging.move.group.placeholder")],...o.filter(u=>u.kind!=="quotes").map(u=>[String(u.id),a("staging.move.group.option",{title:u.title,badge:hh(u.kind),n:u.quotes})])];return e.jsxs(Zr,{title:a("staging.move.panel.title",{n:t}),children:[e.jsxs("div",{children:[e.jsxs(W,{className:"block",children:[a("staging.move.library.label")," ",e.jsx(Re,{text:a("staging.move.library.info")})]}),e.jsx(ch,{works:r,value:l,onChange:h}),e.jsx("button",{className:"tp-btn tp-btn-primary mt-2",disabled:n||!l,onClick:()=>s({retarget:{kind:l.kind==="book"?"book":"movie",id:l.id}},a("staging.flash.moved",{n:t,title:l.title})),children:l?a("staging.move.button.label",{title:l.title}):a("staging.move.button.none.label")})]}),e.jsxs("div",{className:"flex flex-wrap items-end gap-2",children:[e.jsxs("label",{className:"tp-field",style:{flex:1,minWidth:220},children:[e.jsx(W,{children:a("staging.move.merge.label")}),e.jsx(De,{ariaLabel:a("staging.move.group.aria"),value:d,onChange:m,options:p})]}),e.jsx("button",{className:"tp-btn tp-btn-primary",disabled:n||!d,onClick:()=>s({retarget:{staged_work_id:Number(d)}},a("staging.flash.merged",{n:t})),children:a("staging.move.merge.button.label")})]})]})}function Py({n:t,busy:n,onApply:o}){const[s,r]=c.useState("location"),[i,l]=c.useState("subtract"),[h,d]=c.useState(""),[m,p]=c.useState(""),u=["add","subtract","multiply","divide"].includes(i);function f(){const b={field:s,op:i};if(u){const w=Number(h);if(!Number.isFinite(w)||i==="divide"&&w===0)return;b.value=w}i==="set"&&(b.text=m.trim()),o({formula:b},a("staging.flash.formula",{op:dh(i),n:t}))}return e.jsxs(Zr,{title:a("staging.formula.panel.title",{n:t}),children:[e.jsxs("div",{className:"flex flex-wrap items-end gap-2",children:[e.jsxs("label",{className:"tp-field",children:[e.jsx(W,{children:a("staging.formula.field.label")}),e.jsx(De,{ariaLabel:a("staging.formula.field.aria"),value:s,onChange:r,options:[["location",a("common.field.location.label")],["timestamp",a("common.field.timestamp.label")]]})]}),e.jsxs("label",{className:"tp-field",children:[e.jsx(W,{children:a("staging.formula.op.label")}),e.jsx(De,{ariaLabel:a("staging.formula.op.label"),value:i,onChange:l,options:My()})]}),u&&e.jsx("div",{style:{maxWidth:110},children:e.jsx(Se,{label:a("staging.formula.by.label"),type:"number",step:"any",placeholder:a("staging.formula.by.placeholder"),value:h,onChange:b=>d(b.target.value)})}),i==="set"&&e.jsx("div",{style:{maxWidth:160},children:e.jsx(Se,{label:a("staging.formula.to.label"),placeholder:a("staging.formula.to.placeholder"),value:m,onChange:b=>p(b.target.value)})}),e.jsx("button",{className:"tp-btn tp-btn-primary",disabled:n,onClick:f,children:a("common.action.apply.label")})]}),e.jsx("p",{className:"microcopy",children:Pe("staging.formula.prose",{from:e.jsx("b",{children:a("staging.formula.example.page-from")},"from"),to:e.jsx("b",{children:a("staging.formula.example.page-to")},"to"),range:e.jsx("b",{children:a("staging.formula.example.range")},"range"),clock:e.jsx("b",{children:a("staging.formula.example.clock")},"clock"),reset:e.jsx("b",{children:a("staging.formula.example.reset")},"reset")})})]})}function Zr({title:t,children:n}){return e.jsxs("div",{className:"space-y-2.5 rounded-xl p-3",style:{border:"1px solid var(--line)",background:"var(--raised)"},children:[e.jsx(W,{className:"block",children:t}),n]})}function Fy({quote:t,onSaved:n,onCancel:o}){const[s,r]=c.useState({chapter:t.chapter||"",chapter_no:t.chapter_no?String(t.chapter_no):"",location:t.location||"",character:t.character||"",actor:t.actor||"",season:t.season??"",episode:t.episode??"",timestamp:t.timestamp||"",color:t.color||"yellow",favorite:!!t.favorite}),[i,l]=c.useState(t.tags||[]),[h,d]=c.useState(""),[m,p]=c.useState(!1),u=b=>w=>r({...s,[b]:w.target.value});async function f(){p(!0),d("");const b=(t.tags||[]).filter(g=>!i.some(y=>y.toLowerCase()===g.toLowerCase())),w={add_tags:i,remove_tags:b};for(const[g,y]of[["chapter",t.chapter||""],["chapter_no",t.chapter_no?String(t.chapter_no):""],["location",t.location||""],["character",t.character||""],["actor",t.actor||""],["season",String(t.season??"")],["episode",String(t.episode??"")],["timestamp",t.timestamp||""]])s[g]!==y&&(w[g]=s[g]);s.color!==(t.color||"yellow")&&(w.color=s.color),s.favorite!==!!t.favorite&&(w.favorite=s.favorite);const v=await n(w);p(!1),v&&d(v)}return e.jsxs("div",{className:"space-y-4",children:[e.jsx("p",{className:"whitespace-pre-wrap",style:{fontFamily:"var(--font-display)",fontWeight:"var(--font-display-weight)",fontVariantCaps:"var(--font-display-caps)",textTransform:"var(--font-display-case)",fontVariantNumeric:"var(--font-display-figures)",fontStyle:"italic",fontSize:"var(--type-display-17)"},children:a("staging.form.quoted",{text:t.quote||t.note})}),e.jsx("p",{className:"microcopy",children:a("staging.form.locators.prose")}),e.jsxs("div",{className:"grid gap-3 sm:grid-cols-2",children:[e.jsx(Se,{label:a("common.field.chapter-no.label"),inputMode:"decimal",placeholder:a("staging.form.chapter-no.placeholder"),value:s.chapter_no,onChange:u("chapter_no")}),e.jsx(Se,{label:a("common.field.chapter-name.label"),placeholder:a("staging.form.chapter.placeholder"),value:s.chapter,onChange:u("chapter")}),e.jsx(Se,{label:a("common.field.location.label"),placeholder:a("staging.form.location.placeholder"),value:s.location,onChange:u("location")}),e.jsx(Se,{label:a("common.field.character.label"),nameCase:!0,placeholder:a("staging.form.character.placeholder"),value:s.character,onChange:u("character")}),e.jsx(Se,{label:a("common.field.actor.label"),nameCase:!0,placeholder:a("staging.form.actor.placeholder"),value:s.actor,onChange:u("actor")}),e.jsx(Se,{label:a("common.field.season.label"),placeholder:a("staging.form.season.placeholder"),value:s.season,onChange:u("season")}),e.jsx(Se,{label:a("common.field.episode.label"),placeholder:a("staging.form.episode.placeholder"),value:s.episode,onChange:u("episode")}),e.jsx(Se,{label:a("common.field.timestamp.label"),placeholder:a("staging.form.timestamp.placeholder"),value:s.timestamp,onChange:u("timestamp")})]}),e.jsxs("div",{className:"flex flex-wrap items-center gap-4",children:[e.jsxs("label",{className:"tp-field",children:[e.jsx(W,{children:a("common.field.colour.label")}),e.jsx(rt,{value:s.color,onChange:b=>r({...s,color:b})})]}),e.jsxs("label",{className:"tp-field",children:[e.jsx(W,{children:a("common.field.favourite.label")}),e.jsx(Pn,{value:s.favorite,onChange:b=>r({...s,favorite:b})})]})]}),e.jsxs("label",{className:"tp-field",children:[e.jsx(W,{children:a("common.field.tags.label")}),e.jsx(yt,{value:i,onChange:l,placeholder:a("common.field.tags.placeholder"),ariaLabel:a("common.field.tags.label"),transform:b=>Cs(b)[0]||b})]}),e.jsx(ke,{children:h}),e.jsxs("div",{className:"flex flex-wrap items-center gap-2",children:[e.jsx("button",{className:"tp-btn tp-btn-primary",disabled:m,onClick:f,children:a("common.action.save.label")}),e.jsx(ge,{onClick:o,disabled:m,children:a("common.action.cancel.label")})]})]})}function uh({pending:t,onOpen:n}){return t?e.jsxs(Je,{variant:1,colorBar:"var(--accent-ui)",className:"flex flex-wrap items-center gap-3 p-4",children:[e.jsx(W,{style:{color:"var(--accent-ui)"},children:a("staging.card.label")}),e.jsx("p",{className:"text-sm",style:{color:"var(--soft)"},children:a("staging.card.body",{count:t,n:t})}),e.jsx("button",{className:"tp-btn tp-btn-primary ml-auto",onClick:n,children:a("staging.card.review.label",{n:t})})]}):null}const By=Object.freeze(Object.defineProperty({__proto__:null,PendingImportCard:uh,default:Dy},Symbol.toStringTag,{value:"Module"}));function Hy({states:t,help:n,onToggleHelp:o,adaptive:s}){if(!t||t.total===0)return null;const r=[["remembered",t.remembered],["forgetting",t.forgetting],["probably-forgotten",t.probably_forgotten],["unseen",t.unseen]];return e.jsxs("div",{style:{borderTop:"1px solid var(--line)",paddingTop:10},className:"mt-3",children:[e.jsxs("div",{className:"flex flex-wrap items-center gap-x-3 gap-y-1.5",children:[e.jsx("span",{className:"mono-label",style:{color:"var(--faint)"},children:a("home.states.title")}),r.map(([i,l])=>e.jsxs("span",{className:"mono-label inline-flex items-center gap-1.5",style:{fontSize:"var(--type-ui-11)",opacity:l?1:.45},children:[e.jsx("span",{"aria-hidden":"true",style:{width:8,height:8,borderRadius:999,border:`1.5px solid ${Zt[i].color}`,background:Zt[i].filled?Zt[i].color:"transparent"}}),e.jsx("span",{style:{fontWeight:600},children:l})," ",a(Zt[i].label).toLowerCase()]},i)),e.jsx("button",{type:"button",className:"tp-link",style:{fontSize:"var(--type-ui-11)",marginLeft:"auto"},onClick:o,children:a("home.states.help.label")})]}),n&&e.jsx("p",{className:"microcopy mt-2",style:{lineHeight:1.6},children:Pe(s?"home.states.help.adaptive.prose":"home.states.help.ladder.prose",{curve:e.jsx("a",{href:"https://en.wikipedia.org/wiki/Forgetting_curve",target:"_blank",rel:"noopener noreferrer",className:"tp-link",children:a("home.states.help.curve.label")},"curve"),spaced:e.jsx("a",{href:"https://en.wikipedia.org/wiki/Spaced_repetition",target:"_blank",rel:"noopener noreferrer",className:"tp-link",children:a("home.states.help.spaced.label")},"spaced"),remembered:e.jsx("strong",{children:a("home.states.help.remembered.label")},"remembered"),forgetting:e.jsx("strong",{children:a("home.states.help.forgetting.label")},"forgetting"),forgotten:e.jsx("strong",{children:a("home.states.help.forgotten.label")},"forgotten")})})]})}function zy({onPending:t,states:n,onStates:o,adaptive:s,submitStep:r}){const[i,l]=c.useState(null),[h,d]=c.useState("loading"),[m,p]=c.useState({got:0,forgot:0}),[u,f]=c.useState(!1);c.useEffect(()=>{Fc(Vo()).then(v=>{if(!v.ok)return d("error");l(v.data),p({got:v.data.got_today||0,forgot:v.data.forgot_today||0}),o==null||o(v.data.states);const g=(v.data.items||[]).length;t(g),d(g?"active":"done")})},[]);function b(v,g){p(y=>({got:y.got+(v==="got"?1:0),forgot:y.forgot+(v==="forgot"?1:0)})),g&&typeof g.remaining=="number"&&t(g.remaining),g!=null&&g.states&&(o==null||o(g.states))}const w=(i==null?void 0:i.streak)||0;return e.jsxs(Je,{variant:0,style:{padding:"16px 18px 14px"},children:[e.jsxs("div",{className:"mb-2.5 flex items-baseline justify-between gap-3",children:[e.jsx(W,{style:{color:"var(--accent-ui)"},children:a("home.daily.title")}),w>0&&e.jsx("span",{className:"mono-label",style:{letterSpacing:".06em"},children:a("home.daily.streak.label",{n:w,count:w})})]}),h==="error"?e.jsx("p",{className:"microcopy py-6 text-center",style:{color:"var(--error)"},children:a("home.daily.error")}):h==="loading"?e.jsx("p",{className:"microcopy py-6 text-center",children:a("home.daily.loading")}):h==="active"?e.jsx(Nr,{mode:"daily",cards:i.items,allowSkip:!1,submitStep:r,onAnswered:b,onDone:()=>d("done")}):e.jsxs("div",{className:"review-card-body py-4 text-center",style:{padding:"18px 6px 12px"},children:[e.jsx("p",{"aria-hidden":"true",style:{fontFamily:"var(--font-hand)",fontWeight:"var(--font-hand-weight)",fontStyle:"var(--font-hand-style)",fontVariantCaps:"var(--font-hand-caps)",textTransform:"var(--font-hand-case)",fontVariantNumeric:"var(--font-hand-figures)",fontSize:"var(--type-hand-26)",color:"var(--accent-ui)",transform:"rotate(-1.2deg)"},children:a(m.got||m.forgot?"home.daily.done.label":"home.daily.empty.label")}),e.jsx("p",{className:"mono-label mt-1",style:{letterSpacing:".06em"},children:m.got||m.forgot?a("home.daily.done.summary",{got:m.got,missed:m.forgot}):a("home.daily.empty.summary")})]}),n&&e.jsx(Hy,{states:n,help:u,onToggleHelp:()=>f(v=>!v),adaptive:s})]})}function $y({onStates:t,userId:n,submitStep:o}){var j;const[s,r]=$e(`tippani:practice:session:${n??"me"}`,null),[i,l]=c.useState((j=s==null?void 0:s.cards)!=null&&j.length?"active":"idle"),[h,d]=c.useState(null),[m,p]=c.useState({got:0,forgot:0}),[u,f]=c.useState(!1),b=(s==null?void 0:s.cards)||[];function w(){Z("GET",`/review/scores?offset=${Vo()}`).then(N=>{N.ok&&d(N.data.practice)})}c.useEffect(()=>{w()},[]);async function v(){f(!0);const N=await Z("GET","/review/practice");f(!1);const S=N.ok?N.data.items||[]:[];if(!S.length)return Ee(a("error.load.practice"));r({cards:S,i:0,got:0,forgot:0}),l("active")}function g(){p({got:(s==null?void 0:s.got)||0,forgot:(s==null?void 0:s.forgot)||0}),w(),r(null),l("done")}function y(N,S){r(x=>x&&{...x,got:x.got+(N==="got"?1:0),forgot:x.forgot+(N==="forgot"?1:0)}),S!=null&&S.states&&(t==null||t(S.states))}async function k(){await Z("DELETE","/review/practice"),w(),Ee(a("home.practice.toast.reset"))}return e.jsxs(Je,{variant:3,style:{padding:"16px 18px 14px"},children:[e.jsxs("div",{className:"mb-2.5 flex items-center justify-between gap-3",children:[e.jsxs("span",{className:"flex items-center gap-1.5",children:[e.jsx(W,{style:{color:"var(--accent-ui)"},children:a("home.practice.title")}),e.jsx(Re,{title:a("home.practice.info.title"),text:a("home.practice.info.body")})]}),i==="active"&&e.jsx("span",{className:"mono-label",style:{letterSpacing:".06em"},children:a("home.practice.unlimited.label")})]}),i==="idle"&&e.jsx("div",{className:"review-card-body",children:e.jsxs("div",{className:"flex flex-wrap items-center gap-3",children:[e.jsx("button",{type:"button",className:"tp-btn tp-btn-primary tactile",disabled:u,onClick:v,children:a(u?"home.practice.start.busy":"home.practice.start.label")}),h&&h.answered>0&&e.jsxs(e.Fragment,{children:[e.jsx(W,{style:{fontSize:"var(--type-ui-11)"},children:a("home.practice.score.label",{n:h.answered,count:h.answered,percent:Math.round(h.accuracy*100)})}),e.jsx(Ae,{icon:e.jsx(ze,{}),ariaLabel:a("home.practice.reset.aria"),onClick:k,tooltip:a("home.practice.reset.tip")})]})]})}),i==="active"&&b.length>0&&e.jsxs(e.Fragment,{children:[e.jsx(Nr,{mode:"practice",cards:b,allowSkip:!0,submitStep:o,startIndex:Math.min((s==null?void 0:s.i)||0,b.length-1),onIndex:N=>r(S=>S&&{...S,i:N}),onAnswered:y,onDone:g}),e.jsx("div",{className:"mt-2 text-right",children:e.jsx("button",{type:"button",className:"tp-link",onClick:g,children:a("home.practice.end.label")})})]}),i==="done"&&e.jsxs("div",{className:"review-card-body py-2 text-center",children:[e.jsx("p",{"aria-hidden":"true",style:{fontFamily:"var(--font-hand)",fontWeight:"var(--font-hand-weight)",fontStyle:"var(--font-hand-style)",fontVariantCaps:"var(--font-hand-caps)",textTransform:"var(--font-hand-case)",fontVariantNumeric:"var(--font-hand-figures)",fontSize:"var(--type-hand-26)",color:"var(--accent-ui)",transform:"rotate(-1.2deg)"},children:a("quiz.round.score.label",{done:m.got,total:m.got+m.forgot})}),e.jsx("p",{className:"mono-label mt-1 mb-3",style:{letterSpacing:".06em"},children:a("home.practice.round.summary",{got:m.got,missed:m.forgot})}),e.jsx("button",{type:"button",className:"tp-btn tp-btn-primary tactile",disabled:u,onClick:v,children:a("quiz.round.again.label")})]})]})}const Wy=4;function kl(t){const n=[t.book_title,t.character,Ks(t),t.location&&a("common.locator.page.label",{n:t.location})].filter(Boolean).join(" · ");return{key:`book:${t.id}`,kind:"book",color:t.color,text:t.quote||t.note,note:t.quote?t.note:"",tags:t.tags||[],source:[t.book_title,t.book_author].filter(Boolean).join(" · "),meta:n,createdAt:t.created_at,openLabel:a("home.favourites.open.book.aria"),workId:t.book_id,raw:t}}function xl(t,n){const o=n[t.movie_id]||{},s=(o.media_type||"movie")==="show";return{key:`screen:${t.id}`,kind:"screen",media:a(s?"common.badge.show":"common.badge.film"),color:t.color,text:t.quote||t.note,note:t.quote?t.note:"",tags:t.tags||[],source:[o.title,t.character].filter(Boolean).join(" · "),meta:[o.title,xn(t),t.character,t.timestamp].filter(Boolean).join(" · "),createdAt:t.created_at,openLabel:a(s?"home.favourites.open.show.aria":"home.favourites.open.film.aria"),workId:t.movie_id,raw:t,movie:o}}function jl(t){const n=[t.occasion,un(t.occasion_date),t.place,Ra(t)].filter(Boolean);return{key:`quote:${t.id}`,kind:"quote",color:t.color,text:t.quote||t.note,note:t.quote?t.note:"",tags:t.tags||[],source:[t.speaker,t.occasion].filter(Boolean).join(" · "),meta:n.join(" · "),createdAt:t.created_at,openLabel:a("home.favourites.open.quotes.aria"),raw:t}}const Yt={book:{actionKind:"annotation",label:()=>a("common.badge.book"),labelColor:"var(--accent-ui)",path:"/annotations",state:Wr,form:es,get editTitle(){return a("home.favourites.edit.annotation.title")},get confirm(){return a("home.favourites.delete.annotation.confirm")},personKind:"author",credit:t=>t.raw.book_author,shareKind:"book",quoted:!0,openIcon:"library"},screen:{actionKind:"dialogue",label:t=>t.media,labelColor:"var(--amber)",path:"/dialogues",state:Vr,form:ts,get editTitle(){return a("home.favourites.edit.dialogue.title")},get confirm(){return a("home.favourites.delete.dialogue.confirm")},personKind:"actor",credit:t=>t.raw.actor,shareKind:"screen",quoted:!1,openIcon:"movies"},quote:{actionKind:"quote",label:()=>a("common.badge.quote"),labelColor:"var(--accent-ui)",path:"/quotes",state:Kr,form:Yr,get editTitle(){return a("home.favourites.edit.quote.title")},get confirm(){return a("home.favourites.delete.quote.confirm")},personKind:"speaker",credit:t=>t.raw.speaker,openIcon:"quotes",shareKind:"utterance",quoted:!0}};function Uy({user:t,stats:n,onOpenBook:o,onOpenMovie:s,onGoLibrary:r,onGoMovies:i,onGoQuotes:l,onPending:h,pendingImport:d,onReviewImport:m}){var te,J,fe,me;const[p,u]=c.useState([]),f=Fo([[1400,3],[640,2]]),[b,w]=c.useState(Wy),[v,g]=c.useState(null),[y,k]=c.useState(null),[j,N]=c.useState(null),[S,x]=c.useState([]),{map:L}=Xe("author"),{map:A}=Xe("actor"),{map:E}=Xe("speaker"),[D,q]=c.useState(null),C=wn((te=t==null?void 0:t.preferences)==null?void 0:te.creditSeparators),[I,O]=c.useState(null),{stickers:V,reload:P}=Fa(),T=c.useMemo(()=>iu(t==null?void 0:t.username),[t==null?void 0:t.username]),B=c.useMemo(()=>lu(),[]),_=c.useMemo(()=>Math.random()*4294967295>>>0,[]);function U(){Promise.all([Z("GET","/annotations?favorite=1&limit=200"),Z("GET","/dialogues?favorite=1"),Z("GET","/quotes?favorite=1"),Z("GET","/movies")]).then(([H,ee,oe,pe])=>{const de={};if(pe.ok&&pe.data)for(const Y of pe.data.movies||[])de[Y.id]=Y;const se=[];if(H.ok&&H.data)for(const Y of H.data.annotations||[])se.push(kl(Y));if(ee.ok&&ee.data)for(const Y of ee.data.dialogues||[])se.push(xl(Y,de));if(oe.ok&&oe.data)for(const Y of oe.data.utterances||[])se.push(jl(Y));u(Vu(se,_))}).catch(H=>{console.error("favourites load failed",H)})}c.useEffect(()=>{U(),Z("GET","/tags").then(H=>{H.ok&&H.data&&x((H.data.tags||[]).map(ee=>ee.name))})},[]);const F=c.useMemo(()=>nr(p.length,Da(_)),[p.length,_]),X=H=>Yt[H.kind].path;async function R(H,ee){const oe=await Z("PUT",`${X(H)}/${H.raw.id}`,ee);return oe.ok?(k(null),U(),null):le(oe,a("error.save.generic"))}async function G(H,ee){const oe=Yt[H.kind].state,pe=await Z("PUT",`${X(H)}/${H.raw.id}`,{...oe(H.raw),...ee});if(!pe.ok)return Ee(le(pe,a("error.save.generic"))),!1;U()}async function K(H){if(!confirm(Yt[H.kind].confirm))return;const ee=await Qn(`${X(H)}/${H.raw.id}`,{reload:U});if(!ee.ok)return Ee(le(ee,a("error.delete.generic")));v===H.key&&g(null),y===H.key&&k(null),U()}const M=async H=>{const ee=await Z("GET",`${Yt[H.kind].path}?id=${H.id}`);if(!ee.ok||!ee.data)return null;const oe=(ee.data.annotations||ee.data.dialogues||ee.data.utterances||[])[0];return oe?H.kind==="book"?kl(oe):H.kind==="quote"?jl(oe):xl(oe,{[oe.movie_id]:{title:H.title,media_type:H.media_type,release_year:H.year||null}}):null},Q={copy:async H=>{const ee=await M(H);if(!ee)return Ee(a("error.generic"));ka(z(ee))},share:async H=>{const ee=await M(H);if(!ee)return Ee(a("error.generic"));N(ee)},favourite:async(H,ee)=>{const oe=await M(H);return oe?G(oe,{favorite:ee}):(Ee(a("error.generic")),!1)}},z=H=>{var ee,oe;return H.kind==="book"?id({quote:H.raw.quote,note:H.raw.note,translation:H.raw.translation,author:H.raw.book_author,title:H.raw.book_title,chapter:gn(H.raw),location:H.raw.location,character:H.raw.character,date:vn(Un(H.raw)),tags:H.raw.tags,color:H.raw.color,people:L,characterImages:H.raw.character_images}):H.kind==="quote"?cd({quote:H.raw.quote,translation:H.raw.translation,note:H.raw.note,category:H.raw.category,language:H.raw.language,speaker:H.raw.speaker,occasion:H.raw.occasion,when:un(H.raw.occasion_date),place:H.raw.place,medium:Ra(H.raw),date:vn(H.raw.noted_at||H.raw.created_at),tags:H.raw.tags,color:H.raw.color,people:E,seps:C}):ld({quote:H.raw.quote,note:H.raw.note,translation:H.raw.translation,title:(ee=H.movie)==null?void 0:ee.title,year:(oe=H.movie)==null?void 0:oe.release_year,character:H.raw.character,actor:H.raw.actor,timestamp:H.raw.timestamp,episode:xn(H.raw),tags:H.raw.tags,color:H.raw.color,people:A,characterImages:H.raw.character_images})};return e.jsxs("div",{className:"home-col flex flex-col gap-4 pt-4","data-screen-label":"home-body",children:[e.jsx("div",{className:"px-0.5",children:e.jsxs("div",{className:"min-w-0",children:[e.jsx(W,{children:B}),e.jsx("h1",{className:"mt-0.5",style:{fontFamily:"var(--font-display)",fontStyle:"var(--font-display-style)",fontVariantCaps:"var(--font-display-caps)",textTransform:"var(--font-display-case)",fontVariantNumeric:"var(--font-display-figures)",fontWeight:600,fontSize:"var(--type-display-26)",letterSpacing:"-0.01em",lineHeight:1.15},children:T})]})}),e.jsx(uh,{pending:d,onOpen:m}),e.jsx(zy,{onPending:h,states:I,onStates:O,adaptive:!!((J=t==null?void 0:t.preferences)!=null&&J.srAdaptive),submitStep:!!((fe=t==null?void 0:t.preferences)!=null&&fe.srSubmit)}),e.jsx($y,{onStates:O,userId:t==null?void 0:t.id,submitStep:!!((me=t==null?void 0:t.preferences)!=null&&me.srSubmit)}),(r||i)&&e.jsxs("div",{className:r&&i?"grid grid-cols-2 gap-2.5":"",children:[r&&e.jsx(ye,{label:a("home.tile.library.tip"),className:"flex items-stretch",children:e.jsxs(Je,{variant:1,className:"cursor-pointer w-full",style:{padding:"13px 15px"},onClick:r,role:"button",tabIndex:0,children:[e.jsx("p",{style:{fontFamily:"var(--font-display)",fontStyle:"var(--font-display-style)",fontVariantCaps:"var(--font-display-caps)",textTransform:"var(--font-display-case)",fontVariantNumeric:"var(--font-display-figures)",fontWeight:600,fontSize:"var(--type-display-26)"},children:n?n.books:"–"}),e.jsx(W,{style:{fontSize:"var(--type-display-11)"},children:a("home.tile.library.counts",{n:n?n.annotations:"–"})})]})}),i&&e.jsx(ye,{label:a("home.tile.movies.tip"),className:"flex items-stretch",children:e.jsxs(Je,{variant:2,className:"cursor-pointer w-full",style:{padding:"13px 15px"},onClick:i,role:"button",tabIndex:0,children:[e.jsx("p",{style:{fontFamily:"var(--font-display)",fontStyle:"var(--font-display-style)",fontVariantCaps:"var(--font-display-caps)",textTransform:"var(--font-display-case)",fontVariantNumeric:"var(--font-display-figures)",fontWeight:600,fontSize:"var(--type-display-26)"},children:n?n.movies:"–"}),e.jsx(W,{style:{fontSize:"var(--type-display-11)",color:"var(--amber)"},children:a("home.tile.movies.counts",{n:n?n.dialogues:"–"})})]})})]}),e.jsx(Vy,{onOpenBook:o,onOpenMovie:s,onGoQuotes:l,people:{author:L,actor:A,speaker:E},seps:C,onOpenPerson:q,actions:Q}),p.length>0&&e.jsxs("section",{children:[e.jsxs("div",{className:"mb-2.5 flex items-center gap-3",children:[e.jsx("h2",{style:{fontFamily:"var(--font-display)",fontStyle:"var(--font-display-style)",fontVariantCaps:"var(--font-display-caps)",textTransform:"var(--font-display-case)",fontVariantNumeric:"var(--font-display-figures)",fontWeight:600,fontSize:"var(--type-display-19)"},children:a("home.favourites.title")}),e.jsx("span",{"aria-hidden":"true",className:"h-px flex-1",style:{background:"var(--line)"}}),e.jsx(W,{children:a("home.favourites.count.label",{n:p.length})})]}),e.jsx(zo,{columns:f,gap:10,order:"source",children:p.slice(0,b).map((H,ee)=>e.jsx(Gy,{f:H,variant:ee+1,clampLines:F[ee]||3,open:v===H.key,editing:y===H.key,onToggle:()=>{k(null),g(oe=>oe===H.key?null:H.key)},onOpen:H.kind==="book"?()=>o(H.workId):H.kind==="screen"?()=>s(H.workId):l?()=>l():null,speakerMap:E,onEditStart:()=>k(H.key),onEditCancel:()=>k(null),onSave:oe=>R(H,oe),onPatch:oe=>G(H,oe),onDelete:()=>K(H),onCopy:()=>ka(z(H)),onShare:()=>N(H),tagSuggestions:S,stickers:V,reloadStickers:P,authorMap:L,actorMap:A,seps:C,onOpenPerson:q},H.key))}),b<p.length&&e.jsx("div",{className:"mt-3 text-center",children:e.jsx(ge,{onClick:()=>w(H=>H+8),children:a("home.favourites.more.label",{n:p.length-b})})})]}),j&&e.jsx(Jo,{share:z(j),seen:{kind:Yt[j.kind].shareKind,id:j.raw.id},onClose:()=>N(null)}),D&&e.jsx(Sn,{kind:D.kind,name:D.name,onClose:()=>q(null)})]})}function Gy({f:t,variant:n,clampLines:o=3,open:s,editing:r,onToggle:i,onOpen:l,onEditStart:h,onEditCancel:d,onSave:m,onPatch:p,onDelete:u,onCopy:f,onShare:b,tagSuggestions:w,stickers:v,reloadStickers:g,authorMap:y={},actorMap:k={},speakerMap:j={},seps:N,onOpenPerson:S}){var F,X,R,G;const x=Yt[t.kind],L=Ha(x.actionKind,t,{copy:f&&(()=>f()),share:b&&(()=>b()),edit:h&&(()=>h()),favourite:p&&(()=>{var K;return p({favorite:!((K=t.raw)!=null&&K.favorite)})}),favourited:!!((F=t.raw)!=null&&F.favorite),remove:u&&(()=>u())}),{cardProps:A,menuClass:E,menu:D}=Uo(L.map(K=>({...K,onClick:K.run}))),q=t.kind==="book",C=tt(x.credit(t),N),I={author:y,actor:k,speaker:j}[x.personKind]||{},O=C.join(" · ");let V=t.source,P=t.meta;if(q){const K=Ks(t.raw),M=t.raw.location?a("common.locator.page.label",{n:t.raw.location}):"";V=[t.raw.book_title,O].filter(Boolean).join(" · "),P=[t.raw.book_title,K,M].filter(Boolean).join(" · ")}const[T,B]=c.useState(null);c.useEffect(()=>{B(null)},[t.color]);const _=T||t.color||"yellow",U=async K=>{K!==_&&(B(K),await p({color:K})===!1&&B(null))};return e.jsxs(Je,{variant:n,colorBar:_,className:E,style:{padding:"12px 15px"},...A,children:[e.jsx(Ke,{open:r,onClose:d,title:x.editTitle,maxWidth:520,children:e.jsx(x.form,{initial:t.raw,onSubmit:m,onCancel:d,submitLabel:a("common.action.save.label"),show:((X=t.movie)==null?void 0:X.media_type)==="show",tagSuggestions:w,stickers:v,reloadStickers:g})}),e.jsxs(e.Fragment,{children:[e.jsx(ye,{label:a(s?"home.favourites.collapse.tip":"quiz.option.expand.tip"),className:"flex w-full",children:e.jsxs("button",{type:"button",className:"clampable is-clickable block w-full text-left",style:{background:"none",border:"none",padding:0},onClick:i,"aria-expanded":s,children:[e.jsx(W,{className:"mb-1.5 block",style:{fontSize:"var(--type-ui-9)",color:x.labelColor},children:x.label(t)}),e.jsx("p",{style:{fontFamily:"var(--font-display)",fontWeight:"var(--font-display-weight)",fontVariantCaps:"var(--font-display-caps)",textTransform:"var(--font-display-case)",fontVariantNumeric:"var(--font-display-figures)",fontStyle:"italic",fontSize:"var(--type-display-15)",lineHeight:1.5,margin:0,whiteSpace:"pre-wrap",...s?{}:{display:"-webkit-box",WebkitLineClamp:o,WebkitBoxOrient:"vertical",overflow:"hidden"}},children:x.quoted?`“${t.text}”`:t.text}),e.jsxs("span",{className:"mt-1.5 flex items-center gap-1.5",children:[!s&&((G=(R=t.raw)==null?void 0:R.character_images)!=null&&G.length?e.jsx(Gc,{images:t.raw.character_images,size:18,ring:"var(--card)"}):e.jsx(Pa,{names:C,map:I,size:18,ring:"var(--card)"})),e.jsx(W,{style:{fontSize:"var(--type-ui-11)"},children:s?P:V})]}),e.jsx(La,{open:s})]})}),!s&&e.jsxs("div",{className:"mt-1 flex items-center gap-x-3",children:[e.jsx(wa,{actions:zn(L)}),e.jsx("span",{className:"ml-auto flex items-center",children:e.jsx(va,{actions:$n(L)})})]}),s&&e.jsxs("div",{className:"mt-2.5 space-y-2",children:[t.note&&e.jsx(Bo,{children:t.note}),C.length>0&&e.jsx("div",{className:"flex flex-wrap items-center gap-x-3 gap-y-1",children:C.map(K=>e.jsx(Qo,{kind:x.personKind,name:K,person:I[K],size:24,onOpen:S},K))}),t.tags&&t.tags.length>0&&e.jsx("div",{className:"flex flex-wrap gap-1.5",children:t.tags.map(K=>e.jsx("span",{className:"tp-chip",children:K},K))}),e.jsxs("div",{className:"flex flex-wrap items-center gap-x-3 gap-y-1 pt-1",children:[t.openLabel&&l&&e.jsx(We,{icon:e.jsx(No,{name:Yt[t.kind].openIcon}),ariaLabel:t.openLabel,onClick:l,className:"shrink-0"}),e.jsx(Pn,{value:!!t.raw.favorite,onChange:K=>p({favorite:K})}),e.jsx(wa,{actions:zn(L),alwaysVisible:!0}),e.jsx("span",{className:"card-colors is-visible shrink-0",children:e.jsx(rt,{collapsible:!0,value:_,onChange:U,ariaLabel:a("common.colour.category.aria")})}),e.jsx("span",{className:"ml-auto flex items-center",children:e.jsx(va,{actions:$n(L)})})]})]})]}),D]})}function Vy({onOpenBook:t,onOpenMovie:n,onGoQuotes:o,people:s,seps:r,onOpenPerson:i,actions:l}){const[h,d]=c.useState(null),[m,p]=c.useState(!1),[u,f]=c.useState([]);c.useEffect(()=>{let g=!1;return Z("GET","/on-this-day").then(y=>{var k;!g&&y.ok&&f(((k=y.data)==null?void 0:k.quotes)||[])}),()=>{g=!0}},[]);const b=async()=>{var y;p(!0);const g=await Z("GET","/shuffle");p(!1),g.ok&&d(((y=g.data)==null?void 0:y.quote)||null)},w=g=>g.kind==="book"&&g.work_id?()=>t==null?void 0:t(g.work_id):g.kind==="screen"&&g.work_id?()=>n==null?void 0:n(g.work_id):o?()=>o():null,v=e.jsx(ye,{label:a("home.shuffle.tip"),children:e.jsx(ge,{icon:e.jsx(Rm,{}),keepLabel:!0,onClick:b,disabled:m,children:a("home.shuffle.label")})});return u.length?e.jsxs("section",{className:"space-y-3",children:[u.length>0&&e.jsxs(e.Fragment,{children:[e.jsx(W,{className:"block",children:a("home.onthisday.title",{n:u.length})}),e.jsx("div",{className:"space-y-2",children:u.slice(0,3).map(g=>e.jsx(ps,{q:g,onOpen:w(g),people:s,seps:r,onOpenPerson:i,actions:l},`${g.kind}${g.id}`))})]}),e.jsxs("div",{className:"flex items-center gap-3",children:[v,e.jsx("span",{className:"h-px flex-1",style:{background:"var(--line)"}})]}),h&&e.jsx(ps,{q:h,onOpen:w(h),people:s,seps:r,onOpenPerson:i,actions:l})]}):e.jsxs("section",{className:"space-y-3",children:[e.jsx("div",{className:"flex justify-center",children:v}),h&&e.jsx(ps,{q:h,onOpen:w(h),people:s,seps:r,onOpenPerson:i,actions:l})]})}const ms={movie:"common.badge.film",show:"common.badge.show",game:"common.badge.game",book:"common.badge.book",quote:"common.badge.quote"};function ps({q:t,onOpen:n,people:o={},seps:s,onOpenPerson:r,actions:i}){const l=Yt[t.kind],[h,d]=c.useState(!!t.favorite),[m,p]=c.useState(!1);c.useEffect(()=>{d(!!t.favorite)},[t]);const u=tt(t.credit,s),f=o[l.personKind]||{},b=Pt(t.year),w=[t.title,b,t.character].filter(Boolean).join(" · "),v=i?Ha(l.actionKind,t,{copy:()=>i.copy(t),share:()=>i.share(t),favourite:async()=>{m||(p(!0),d(k=>!k),await i.favourite(t,!h)===!1&&d(k=>!k),p(!1))},favourited:h}):[],g=a(`home.favourites.open.${t.kind==="book"?"book":t.kind==="quote"?"quotes":t.media_type==="show"?"show":"film"}.aria`),y=t.cover_path?e.jsx("img",{src:Ue(t.cover_path),alt:"",className:"block w-14 object-cover",style:{aspectRatio:"2 / 3",borderRadius:6,border:"1px solid var(--ink-border)"}}):e.jsx(Bt,{kind:a(ms[t.media_type]||"common.badge.cover"),className:"w-14",style:{aspectRatio:"2 / 3",borderRadius:6}});return e.jsx(Je,{colorBar:t.color||"yellow",style:{padding:"12px 15px"},children:e.jsxs("div",{className:"flex gap-3.5",children:[e.jsx("div",{className:"shrink-0",children:n?e.jsx(ye,{label:g,children:e.jsx("button",{type:"button",onClick:n,"aria-label":g,style:{background:"none",border:"none",padding:0,cursor:"pointer"},children:y})}):y}),e.jsxs("div",{className:"min-w-0 flex-1",children:[e.jsx(W,{className:"mb-1 block",style:{fontSize:"var(--type-ui-9)",color:l.labelColor},children:a(ms[t.media_type]||ms[t.kind])}),e.jsx("button",{type:"button",onClick:n||void 0,className:`block w-full text-left${n?"":" cursor-default"}`,style:{background:"none",border:"none",padding:0},tabIndex:n?0:-1,children:e.jsx("p",{style:{fontFamily:"var(--font-display)",fontStyle:"italic",fontSize:"var(--type-display-15)",lineHeight:1.55,margin:0,whiteSpace:"pre-wrap"},children:l.quoted?`“${t.quote}”`:t.quote})}),e.jsx(W,{className:"mt-1.5 block",style:{fontSize:"var(--type-ui-11)"},children:w}),u.length>0&&e.jsx("div",{className:"mt-2 flex flex-wrap items-center gap-x-3 gap-y-1",children:u.map(k=>e.jsx(Qo,{kind:l.personKind,name:k,person:f[k],size:22,onOpen:r},k))}),t.tags&&t.tags.length>0&&e.jsx("div",{className:"mt-2 flex flex-wrap gap-1.5",children:t.tags.map(k=>e.jsx("span",{className:"tp-chip",children:k},k))}),v.length>0&&e.jsxs("div",{className:"mt-2 flex items-center gap-x-3",children:[e.jsx(wa,{actions:zn(v)}),e.jsx("span",{className:"ml-auto flex items-center",children:e.jsx(va,{actions:$n(v)})})]})]})]})})}const Ky=[9,11,12,13,15,17,19,22,26,30],Yy=[75,100,125,150,175,200],Qy=100,Sa=["display","ui","mono","hand"],mh=t=>"size"+t[0].toUpperCase()+t.slice(1);function ph(t){const n=Number(t);return Yy.includes(n)?n:Qy}function Zy(t){const n={};for(const o of Sa)n[o]=ph(t==null?void 0:t[mh(o)]);return n}const Xy=(t,n)=>Math.round(t*n/100);function Wv(t){const n=t[Sa[0]];return Sa.every(o=>t[o]===n)?n:0}function Uv(t){const n={};for(const o of Sa)n[mh(o)]=ph(t);return n}function Jy(t){const n=Zy(t),o={};for(const s of Sa)for(const r of Ky)o[`--type-${s}-${r}`]=`${Xy(r,n[s])}px`;return o}function ew(t){if(typeof document>"u")return;const n=document.documentElement,o=Jy(t);for(const s in o)n.style.setProperty(s,o[s])}const fs=["greeting.epigraph.1","greeting.epigraph.2","greeting.epigraph.3","greeting.epigraph.4","greeting.epigraph.5","greeting.epigraph.6","greeting.epigraph.7","greeting.epigraph.8","greeting.epigraph.9","greeting.epigraph.10"];function tw(t=Math.random){return a(fs[Math.floor(t()*fs.length)%fs.length])}function nw({titleKey:t,info:n=!1,onPick:o,width:s=230}){Ol();const r=zh(),i=$h();function l(h){Gs(h),o==null||o(h)}return e.jsxs("div",{children:[e.jsxs("div",{className:"mb-2 flex items-center gap-1.5",children:[e.jsx(W,{children:a(t)}),n&&e.jsx(Re,{title:a("settings.language.info.title"),text:a("settings.language.info.body")})]}),e.jsx(De,{ariaLabel:a("locale.picker.aria"),value:mo(),onChange:l,width:s,options:r.map(h=>[h.code,a("locale.picker.coverage",{name:h.name,percent:h.percent})])}),i&&e.jsx("p",{className:"microcopy mt-2",children:a("settings.language.missing",{code:i,name:bs(mo())})})]})}const aw=["search","quotes","anthologies","tags","metadata","stats","settings","staging","bin","cleanup","checks"],fh=[["home","nav.tab.home.label","nav.tab.home.tip"],["library","nav.tab.library.label","nav.tab.library.tip"],["movies","nav.tab.movies.label","nav.tab.movies.tip"],["quotes","nav.tab.quotes.label","nav.tab.quotes.tip"],["anthologies","nav.tab.anthologies.label","nav.tab.anthologies.tip"]],gh=[["tags","nav.tab.tags.label","nav.tab.tags.tip"],["metadata","nav.tab.metadata.label","nav.tab.metadata.tip"],["stats","nav.tab.stats.label","nav.tab.stats.tip"],["settings","nav.tab.settings.label","nav.tab.settings.tip"]],ow=[["home","nav.tab.home.label"],["library","nav.tab.library.label"],["movies","nav.tab.movies.label"],["quotes","nav.tab.quotes.label"],["anthologies","nav.tab.anthologies.label"],null,["tags","nav.tab.tags.label"],["metadata","nav.tab.metadata.label"],["stats","nav.tab.stats.label"],["settings","nav.tab.settings.label"]],Bs=[{tab:"library",label:"nav.tab.library.label",pref:"hideLibrary",what:"nav.section.library.what"},{tab:"movies",label:"nav.tab.movies.label",pref:"hideCatalogue",what:"nav.section.movies.what"},{tab:"quotes",label:"nav.tab.quotes.label",pref:"hideQuotes",what:"nav.section.quotes.what"},{tab:"anthologies",label:"nav.tab.anthologies.label",pref:"showAnthologies",off:!0,what:"nav.section.anthologies.what"}];function bh(t){const n={};let o=!1;for(const s of Bs)n[s.tab]=s.off?!!(t!=null&&t[s.pref]):!(t!=null&&t[s.pref]),n[s.tab]&&!s.off&&(o=!0);return o||(n[Bs[0].tab]=!0),n}function Na(t,n){const o=[];for(const s of t){if(s===null){o.length&&o[o.length-1]!==null&&o.push(null);continue}n&&n[s[0]]===!1||o.push(s)}for(;o.length&&o[o.length-1]===null;)o.pop();return o}function Gt(t){if(!t)return null;const n=Number(t);return Number.isInteger(n)&&n>0?n:null}function Sl(t){const[n,o]=t.replace(/\/+$/,"").split("/").filter(Boolean);return n?n==="books"&&Gt(o)?{tab:"library",detail:{type:"book",id:Gt(o)}}:(n==="catalogue"||n==="movies")&&Gt(o)?{tab:"movies",detail:{type:"movie",id:Gt(o)}}:n==="library"?{tab:"library",detail:null}:n==="books"?{tab:"library",detail:null}:n==="quotes"&&o==="all"?{tab:"quotes",detail:{type:"board",id:"all"}}:n==="quotes"&&Gt(o)?{tab:"quotes",detail:{type:"board",id:Gt(o)}}:n==="anthologies"&&Gt(o)?{tab:"anthologies",detail:{type:"anthology",id:Gt(o)}}:n==="movies"||n==="catalogue"?{tab:"movies",detail:null}:n==="import"?{tab:"import",detail:null}:n==="capture"?{tab:"capture",detail:null}:n==="pending"?{tab:"staging",detail:null}:aw.includes(n)?{tab:n,detail:null}:{tab:"home",detail:null}:{tab:"home",detail:null}}function ln(t,n){return(n==null?void 0:n.type)==="book"?`/books/${n.id}`:(n==null?void 0:n.type)==="movie"?`/catalogue/${n.id}`:(n==null?void 0:n.type)==="board"?`/quotes/${n.id}`:(n==null?void 0:n.type)==="anthology"?`/anthologies/${n.id}`:t==="home"?"/":t==="library"?"/library":t==="movies"?"/catalogue":t==="staging"?"/pending":`/${t}`}const sw={bin:"bin.title",cleanup:"cleanup.title",staging:"staging.title",checks:"checks.title"};function yh(t){return sw[t]||`nav.tab.${t}.label`}function rw(t,n){return(n==null?void 0:n.type)==="book"?"book-detail":(n==null?void 0:n.type)==="movie"?"movie-detail":t}function iw(t,n){return n?"quote":t==="movies"?"film":t==="quotes"?"standalone":"book"}function Nl(t,n){return t==="library"||(n==null?void 0:n.type)==="book"?"books":t==="movies"||(n==null?void 0:n.type)==="movie"?"movies":t==="quotes"?"quotes":"all"}const Xr=()=>{var t;return Number((t=window.history.state)==null?void 0:t.tpDepth)||0},lw=()=>Xr()>0;function cw(t){window.history.replaceState({...window.history.state,tpDepth:Xr()},"",t)}function dw(t){return t===window.location.pathname?!1:(window.history.pushState({tpDepth:Xr()+1},"",t),!0)}function hw(t){return lw()?(window.history.back(),!0):(t!==window.location.pathname&&window.history.replaceState({tpDepth:0},"",t),!1)}const Ta=8,bt=20,uw=10,wh=20,mw=/^[\x20-\x7e]*$/;function vh(t,{min:n,max:o,stem:s}){const r=String(t||"");return r.length<n?a(`${s}.min`,{n}):r.length>o?a(`${s}.max`,{n:o}):mw.test(r)?"":a(`${s}.charset`)}function Jr(t){return vh(t,{min:Ta,max:bt,stem:"error.validate.password"})}function Gv(t){return vh(t,{min:uw,max:wh,stem:"error.validate.passphrase"})}const pw="TPBK",fw=2,ia=36,kh=256,gw=60,bw=ia+kh+2*(2+gw);async function yw(t){try{const n=new Uint8Array(await t.slice(0,bw).arrayBuffer());if(n.length<ia)return{key:"none"};if(String.fromCharCode(n[0],n[1],n[2],n[3])!==pw)return{key:"none"};if(n[4]!==fw)return{key:"unknown"};const s=n[5];if(s===2)return{key:"passphrase"};if(s!==1)return{key:"unknown"};const r=n[34]<<8|n[35];if(r>kh)return{key:"unknown"};const i=new TextDecoder().decode(n.subarray(ia,ia+r)),l=ia+r;if(n.length<l+2)return{key:"password",account:i};const h=n[l]<<8|n[l+1],d=l+2+h;if(n.length<d+2)return{key:"password",account:i};const m=n[d]<<8|n[d+1];return{key:"password",account:i,recoverable:m>0}}catch{return{key:"unknown"}}}const ww=40;function ns({children:t}){return e.jsx(W,{className:"mb-1.5 block",children:t})}function vw({user:t,onUser:n}){const[o,s]=c.useState(!1),[r,i]=c.useState("");async function l(d){var u;const m=d.target.files&&d.target.files[0];if(d.target.value="",!m)return;s(!0),i("");const p=await Ea("/auth/me/avatar",m);s(!1),p.ok?n({avatar_path:p.data.avatar_path}):i(((u=p.data)==null?void 0:u.error)||a("error.upload.failed"))}async function h(){const d=await Z("DELETE","/auth/me/avatar");d.ok?n({avatar_path:""}):i(le(d,a("error.remove.photo")))}return e.jsxs("div",{className:"flex items-center gap-4",children:[e.jsx("span",{className:"user-chip",style:{width:56,height:56,fontSize:"var(--type-ui-22)"},"aria-hidden":"true",children:t.avatar_path?e.jsx("img",{src:Ue(t.avatar_path),alt:""}):(t.username||"?").trim().charAt(0).toLowerCase()}),e.jsxs("div",{className:"flex flex-col gap-2",children:[e.jsxs("div",{className:"flex flex-wrap items-center gap-2",children:[e.jsxs("label",{className:"tp-btn tp-btn-primary",style:{cursor:"pointer"},children:[o?a("common.action.upload.busy"):t.avatar_path?a("account.photo.change"):a("account.photo.upload"),e.jsx("input",{type:"file",accept:"image/*",className:"hidden",onChange:l,disabled:o})]}),e.jsx(Re,{title:a("account.photo.info.title"),text:a("account.photo.info.body")}),t.avatar_path&&e.jsx(Ae,{icon:e.jsx(ze,{}),ariaLabel:a("account.photo.remove.aria"),onClick:h,tooltip:a("account.photo.remove.tip"),danger:!0})]}),e.jsx(ke,{children:r})]})]})}function kw({user:t,onUser:n}){const[o,s]=c.useState(t.username||""),[r,i]=c.useState(!1),[l,h]=c.useState(""),[d,m]=c.useState(!1),p=o.trim()!==(t.username||"");async function u(f){if(f.preventDefault(),h(""),m(!1),!o.trim())return h(a("error.validate.name-cannot-be-blank"));i(!0);const b=await Z("PUT","/auth/me",{username:o.trim()});i(!1),b.ok?(n({username:b.data.username}),s(b.data.username),m(!0)):h(le(b,a("error.save.name")))}return e.jsxs("form",{onSubmit:u,className:"space-y-2",children:[e.jsx(ns,{children:a("account.name.label")}),e.jsxs("div",{className:"flex flex-wrap items-center gap-2",children:[e.jsx(Et,{style:{flex:1,minWidth:160},value:o,autoComplete:"off",maxLength:ww,onChange:f=>{s(f.target.value),m(!1)}}),e.jsx(an,{disabled:r||!p||!o.trim(),title:o.trim()?void 0:a("error.validate.name-required"),children:a(r?"common.action.save.busy":"account.name.save")})]}),d&&e.jsx("p",{style:{fontSize:"var(--type-ui-13)",color:"var(--soft)"},children:a("account.name.done")}),e.jsx(ke,{children:l})]})}function xw(){const[t,n]=c.useState(""),[o,s]=c.useState(""),[r,i]=c.useState(""),[l,h]=c.useState(""),[d,m]=c.useState(!1),[p,u]=c.useState(!1),f=t?Jr(o)||(o!==r?a("error.validate.password-mismatch"):""):a("error.validate.password-current-required");async function b(w){if(w.preventDefault(),h(""),m(!1),f)return h(f);u(!0);const v=await Z("POST","/auth/password",{current:t,new:o});u(!1),v.ok?(n(""),s(""),i(""),m(!0)):h(le(v,a("error.save.password")))}return e.jsxs("form",{onSubmit:b,className:"space-y-3",children:[e.jsxs("span",{className:"flex items-center gap-1.5",children:[e.jsx(ns,{children:a("account.password.label")}),e.jsx(Re,{title:a("account.password.info.title"),text:a("account.password.info.body",{min:Ta,max:bt})})]}),e.jsx("input",{className:"tp-input",placeholder:a("account.password.current.placeholder"),type:"password",value:t,autoComplete:"current-password",maxLength:bt,onChange:w=>n(w.target.value)}),e.jsx("input",{className:"tp-input",placeholder:a("account.password.new.placeholder",{min:Ta,max:bt}),type:"password",value:o,autoComplete:"new-password",maxLength:bt,onChange:w=>s(w.target.value)}),e.jsx("input",{className:"tp-input",placeholder:a("account.password.repeat.placeholder"),type:"password",value:r,autoComplete:"new-password",maxLength:bt,onChange:w=>i(w.target.value)}),e.jsx(ke,{children:l}),d&&e.jsx("p",{style:{fontSize:"var(--type-ui-13)",color:"var(--soft)"},children:a("account.password.done")}),e.jsx(an,{icon:e.jsx(jm,{}),keepLabel:!0,className:"w-full",disabled:p||!!f,title:f||void 0,children:a("account.password.submit")}),f&&o.length>0&&e.jsxs("p",{className:"microcopy",style:{color:"var(--faint)"},children:[f,"."]})]})}function jw({me:t}){const[n,o]=c.useState(!1),[s,r]=c.useState(""),[i,l]=c.useState(""),[h,d]=c.useState(""),[m,p]=c.useState(!1),u=s.trim()===((t==null?void 0:t.username)||""),f=s.trim()?u?a("error.validate.switch-same"):i?"":a("error.validate.switch-password-required"):a("error.validate.switch-name-required");async function b(v){if(v.preventDefault(),f)return d(f);p(!0),d("");const g=await Z("POST","/auth/login",{username:s.trim(),password:i});if(g.ok){window.location.href="/";return}p(!1),d(le(g,a("error.switch.account")))}const w=()=>{o(!1),r(""),l(""),d("")};return e.jsxs("div",{children:[e.jsxs("div",{className:"flex flex-wrap items-center justify-between gap-3",children:[e.jsxs("div",{className:"flex min-w-0 flex-1 items-center gap-1.5",children:[e.jsx("p",{className:"text-sm font-semibold",children:a("account.switch.title")}),e.jsx(Re,{title:a("account.switch.info.title"),text:a("account.switch.info.body")})]}),!n&&e.jsx(ge,{icon:e.jsx(km,{}),keepLabel:!0,onClick:()=>o(!0),children:a("account.switch.action")})]}),n&&e.jsxs("form",{onSubmit:b,className:"switch-panel",children:[e.jsxs("p",{className:"switch-from",children:[e.jsx("span",{className:"user-chip",style:{width:24,height:24,fontSize:"var(--type-ui-11)"},"aria-hidden":"true",children:t!=null&&t.avatar_path?e.jsx("img",{src:Ue(t.avatar_path),alt:""}):((t==null?void 0:t.username)||"?").trim().charAt(0).toLowerCase()}),e.jsx("span",{children:Pe("account.switch.leaving",{name:e.jsx("b",{children:t==null?void 0:t.username})})})]}),e.jsx(Se,{label:a("account.switch.name.label"),value:s,autoFocus:!0,autoComplete:"username",onChange:v=>{r(v.target.value),d("")}}),e.jsx(Se,{label:a("account.switch.password.label"),type:"password",value:i,autoComplete:"current-password",maxLength:bt,onChange:v=>{l(v.target.value),d("")}}),e.jsx(ke,{children:h}),e.jsxs("div",{className:"flex flex-wrap items-center gap-2",children:[e.jsx(an,{disabled:m||!!f,title:f||void 0,children:a(m?"account.switch.busy":"account.switch.submit")}),e.jsx(ge,{type:"button",onClick:w,children:a("common.action.cancel.label")}),f&&!h&&e.jsx("span",{className:"microcopy",style:{color:"var(--faint)"},children:f})]})]})]})}function Sw(){const[t,n]=c.useState(""),[o,s]=c.useState(""),[r,i]=c.useState(""),[l,h]=c.useState(!1),[d,m]=c.useState("");async function p(){n("reindex"),i(""),s("");const f=await Z("POST","/admin/search/reindex");n(""),f.ok&&f.data.ok?s(a("account.reindex.done")):f.ok?i(a("account.reindex.partial",{failed:(f.data.failed||[]).join(", ")})):i(le(f,a("error.reindex.failed")))}async function u(){if(d!=="RESET")return;n("reset"),i(""),s("");const f=await Z("POST","/admin/reset",{confirm:"RESET"});if(f.ok){window.location.href="/";return}n(""),i(le(f,a("error.reset.failed")))}return e.jsxs(kt,{pad:"p-5",children:[e.jsx(ns,{children:a("account.maintenance.label")}),e.jsxs("div",{className:"space-y-4",children:[e.jsxs("div",{className:"flex flex-wrap items-center justify-between gap-3",children:[e.jsxs("div",{className:"flex min-w-0 flex-1 items-center gap-1.5",children:[e.jsx("p",{className:"text-sm font-semibold",children:a("account.reindex.title")}),e.jsx(Re,{title:a("account.reindex.info.title"),text:a("account.reindex.info.body")})]}),e.jsx(ge,{disabled:t==="reindex",onClick:p,children:a(t==="reindex"?"account.reindex.busy":"account.reindex.action")})]}),e.jsx("hr",{style:{border:"none",borderTop:"1px dashed var(--line)"}}),e.jsxs("div",{children:[e.jsxs("div",{className:"flex items-center gap-1.5",children:[e.jsx("p",{className:"text-sm font-semibold",style:{color:"var(--error)"},children:a("account.reset.title")}),e.jsx(Re,{title:a("account.reset.info.title"),text:a("account.reset.info.body")})]}),l?e.jsxs("div",{className:"mt-2 space-y-2",children:[e.jsx("p",{className:"microcopy",children:Pe("account.reset.confirm.prose",{word:e.jsx("b",{children:"RESET"})})}),e.jsx("input",{className:"tp-input",value:d,autoFocus:!0,placeholder:"RESET",onChange:f=>m(f.target.value)}),e.jsxs("div",{className:"flex flex-wrap gap-2",children:[e.jsx("button",{type:"button",className:"tp-btn",style:{background:"var(--error)",color:"#fff",opacity:d==="RESET"&&t!=="reset"?1:.55},disabled:d!=="RESET"||t==="reset",onClick:u,children:a(t==="reset"?"account.reset.busy":"account.reset.submit")}),e.jsx(ge,{onClick:()=>{h(!1),m("")},children:a("common.action.cancel.label")})]})]}):e.jsx(ge,{icon:e.jsx(ze,{}),keepLabel:!0,className:"mt-2",onClick:()=>h(!0),children:a("account.reset.open")})]}),o&&e.jsx("p",{className:"microcopy",style:{color:"var(--accent-ui)"},children:o}),e.jsx(ke,{children:r})]})]})}function Nw({user:t,onUser:n,logout:o}){return e.jsxs("div",{className:"space-y-5",children:[e.jsx(kt,{pad:"p-5",children:e.jsx(vw,{user:t,onUser:n})}),e.jsx(kt,{pad:"p-5",children:e.jsx(kw,{user:t,onUser:n})}),e.jsx(kt,{pad:"p-5",children:e.jsxs("div",{className:"space-y-4",children:[e.jsx(jw,{me:t}),e.jsx("hr",{style:{border:"none",borderTop:"1px dashed var(--line)"}}),e.jsxs("div",{className:"flex flex-wrap items-center justify-between gap-3",children:[e.jsxs("div",{className:"flex min-w-0 flex-1 items-center gap-1.5",children:[e.jsx("p",{className:"text-sm font-semibold",children:a("account.logout.title")}),e.jsx(Re,{title:a("account.logout.info.title"),text:a("account.logout.info.body")})]}),o&&e.jsx(ge,{icon:e.jsx(xm,{}),keepLabel:!0,onClick:o,children:a("account.logout.action")})]})]})}),e.jsx(kt,{pad:"p-5",children:e.jsx(xw,{})}),(t==null?void 0:t.is_admin)&&e.jsxs(kt,{pad:"p-5",children:[e.jsxs("span",{className:"flex items-center gap-1.5",children:[e.jsx(ns,{children:a("account.users.label")}),e.jsx(Re,{title:a("account.users.info.title"),text:a("account.users.info.body")})]}),e.jsx(Tw,{me:t})]}),(t==null?void 0:t.is_admin)&&e.jsx(Sw,{})]})}function Tw({me:t}){const[n,o]=c.useState([]),[s,r]=c.useState(""),[i,l]=c.useState(""),[h,d]=c.useState(""),[m,p]=c.useState(null);async function u(){const y=await Z("GET","/admin/users");y.ok?o(y.data.users):d(le(y,a("error.load.users")))}c.useEffect(()=>{u()},[]);const f=n.filter(y=>y.is_admin).length;async function b(y){y.preventDefault(),d("");const k=await Z("POST","/admin/users",{username:s,password:i});k.ok?(r(""),l(""),u()):d(le(k,a("error.add.user")))}async function w(y,k){d(""),p(y.id);const j=await Z("PATCH",`/admin/users/${y.id}`,{is_admin:k});p(null),j.ok?u():d(le(j,a("error.save.role")))}async function v(y){if(!confirm(a("account.users.delete.confirm",{name:y.username})))return;d("");const k=await Z("DELETE",`/admin/users/${y.id}`);k.ok?u():d(le(k,a("error.delete.user")))}const g=s.trim()?Jr(i):a("error.validate.username-required-add");return e.jsxs("div",{children:[e.jsx("ul",{className:"space-y-1",children:n.map(y=>{const k=y.id===t.id,j=y.is_admin&&f<=1,N=y.is_admin?k&&!j:!0,S=!k&&!y.is_admin;return e.jsxs("li",{className:"flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2",style:{borderBottom:"1px solid var(--line)"},children:[e.jsx("span",{className:"user-chip",style:{width:30,height:30,fontSize:"var(--type-ui-13)"},"aria-hidden":"true",children:y.avatar_path?e.jsx("img",{src:Ue(y.avatar_path),alt:""}):(y.username||"?").trim().charAt(0).toLowerCase()}),e.jsx("span",{style:{fontWeight:600},children:y.username}),y.is_admin&&e.jsx("span",{className:"tp-chip",style:{color:"var(--accent-ui)"},children:a("account.users.admin.chip")}),k&&e.jsx("span",{className:"mono-label",children:a("account.users.you.chip")}),e.jsxs("span",{className:"ml-auto flex items-center gap-2",children:[N?e.jsx("button",{type:"button",className:"tp-chip tp-chip-btn",disabled:m===y.id,title:y.is_admin?a("account.users.step-down.tip"):a("account.users.make-admin.tip",{name:y.username}),onClick:()=>w(y,!y.is_admin),children:y.is_admin?a("account.users.step-down"):a("account.users.make-admin")}):y.is_admin&&e.jsx("span",{className:"mono-label",style:{color:"var(--faint)"},children:a(j&&k?"account.users.only-admin":"account.users.their-own")}),S&&e.jsx(ye,{label:a("account.users.delete.tip",{name:y.username}),side:"top",children:e.jsx("button",{type:"button",onClick:()=>v(y),"aria-label":a("account.users.delete.aria",{name:y.username}),style:{background:"none",border:"none",color:"var(--error)",fontSize:"var(--type-ui-17)",padding:4,lineHeight:1,cursor:"pointer"},children:"✕"})})]})]},y.id)})}),e.jsxs("form",{onSubmit:b,className:"mt-4 flex flex-wrap items-center gap-2",children:[e.jsx("input",{className:"tp-input",style:{flex:1,minWidth:130},placeholder:a("common.field.username.placeholder"),value:s,autoComplete:"off",onChange:y=>r(y.target.value)}),e.jsx("input",{className:"tp-input",style:{flex:1,minWidth:130},placeholder:a("account.password.new.placeholder",{min:Ta,max:bt}),type:"password",value:i,autoComplete:"new-password",maxLength:bt,onChange:y=>l(y.target.value)}),e.jsx(an,{icon:e.jsx(vm,{}),keepLabel:!0,disabled:!!g,title:g||void 0,children:a("account.users.add")})]}),g&&i.length>0&&e.jsxs("p",{className:"microcopy mt-1",style:{color:"var(--faint)"},children:[g,"."]}),e.jsx(ke,{children:h})]})}const Cw={book:{get quote(){return a("tour.demo.book.quote.prose")},get title(){return a("tour.demo.book.title")},get author(){return a("tour.demo.book.author.label")},get meta(){return a("tour.demo.book.meta.label")}},movie:{get quote(){return a("tour.demo.film.quote.prose")},get title(){return a("tour.demo.film.title")},year:1942,get character(){return a("tour.demo.film.character.label")},get actor(){return a("tour.demo.film.actor.label")},get meta(){return a("tour.demo.film.meta.label")}}},Ew=[{key:"welcome",tab:"home",get title(){return a("tour.step.welcome.title")},get body(){return a("tour.step.welcome.prose")},get more(){return a("tour.step.welcome.more")}},{key:"add",anchor:'[data-tour="add"]',get name(){return a("tour.step.add.name")},get blurb(){return a("tour.step.add.blurb")},get title(){return a("tour.step.add.title")},get body(){return Pe("tour.step.add.prose",{em1:e.jsx("b",{children:a("tour.step.add.em1.label")},"em1"),em2:e.jsx("b",{children:a("tour.step.add.em2.label")},"em2"),em3:e.jsx("b",{children:a("tour.step.add.em3.label")},"em3"),em4:e.jsx("b",{children:a("tour.step.add.em4.label")},"em4")})},get more(){return a("tour.step.add.more")}},{key:"library",tab:"library",demo:"book",get name(){return a("tour.step.library.name")},get blurb(){return a("tour.step.library.blurb")},get title(){return a("tour.step.library.title")},get body(){return a("tour.step.library.prose")},get more(){return a("tour.step.library.more")}},{key:"catalogue",tab:"movies",demo:"movie",get name(){return a("tour.step.catalogue.name")},get blurb(){return a("tour.step.catalogue.blurb")},get title(){return a("tour.step.catalogue.title")},get body(){return a("tour.step.catalogue.prose")},get more(){return a("tour.step.catalogue.more")}},{key:"share",get name(){return a("tour.step.share.name")},get blurb(){return a("tour.step.share.blurb")},get title(){return a("tour.step.share.title")},get body(){return Pe("tour.step.share.prose",{em1:e.jsx("b",{children:a("tour.step.share.em1.label")},"em1")})},get more(){return a("tour.step.share.more")}},{key:"quiz",tab:"home",get name(){return a("tour.step.quiz.name")},get blurb(){return a("tour.step.quiz.blurb")},get title(){return a("tour.step.quiz.title")},get body(){return a("tour.step.quiz.prose")},get more(){return a("tour.step.quiz.more")}},{key:"search",anchor:'[data-tour="search"]',get name(){return a("tour.step.search.name")},get blurb(){return a("tour.step.search.blurb")},get title(){return a("tour.step.search.title")},get body(){return Pe("tour.step.search.prose",{em1:e.jsx("b",{children:a("tour.step.search.em1.label")},"em1")})},get more(){return a("tour.step.search.more")}},{key:"tags",tab:"tags",get name(){return a("tour.step.tags.name")},get blurb(){return a("tour.step.tags.blurb")},get title(){return a("tour.step.tags.title")},get body(){return Pe("tour.step.tags.prose",{em1:e.jsx("b",{children:a("tour.step.tags.em1.label")},"em1")})},get more(){return a("tour.step.tags.more")}},{key:"metadata",tab:"metadata",get name(){return a("tour.step.metadata.name")},get blurb(){return a("tour.step.metadata.blurb")},get title(){return a("tour.step.metadata.title")},get body(){return Pe("tour.step.metadata.prose",{em1:e.jsx("b",{children:a("tour.step.metadata.em1.label")},"em1")})},get more(){return a("tour.step.metadata.more")}},{key:"stats",tab:"stats",get name(){return a("tour.step.stats.name")},get blurb(){return a("tour.step.stats.blurb")},get title(){return a("tour.step.stats.title")},get body(){return a("tour.step.stats.prose")},get more(){return a("tour.step.stats.more")}},{key:"appearance",tab:"settings",anchor:'[data-tour="appearance"]',get name(){return a("tour.step.appearance.name")},get blurb(){return a("tour.step.appearance.blurb")},get title(){return a("tour.step.appearance.title")},get body(){return a("tour.step.appearance.prose")}},{key:"keys",tab:"settings",anchor:'[data-tour="metadata-keys"]',admin:!0,get name(){return a("tour.step.keys.name")},get blurb(){return a("tour.step.keys.blurb")},get title(){return a("tour.step.keys.title")},get body(){return a("tour.step.keys.prose")},get more(){return a("tour.step.keys.more")}},{key:"backup",tab:"settings",anchor:'[data-tour="backup"]',admin:!0,get name(){return a("tour.step.backup.name")},get blurb(){return a("tour.step.backup.blurb")},get title(){return a("tour.step.backup.title")},get body(){return Pe("tour.step.backup.prose",{em1:e.jsx("b",{children:a("tour.step.backup.em1.label")},"em1")})},get more(){return a("tour.step.backup.more")}},{key:"account",anchor:'[data-tour="account"]',get name(){return a("tour.step.account.name")},get blurb(){return a("tour.step.account.blurb")},get title(){return a("tour.step.account.title")},get body(){return Pe("tour.step.account.prose",{em1:e.jsx("b",{children:a("tour.step.account.em1.label")},"em1")})},get more(){return a("tour.step.account.more")}},{key:"done",get title(){return a("tour.step.done.title")},get body(){return Pe("tour.step.done.prose",{em1:e.jsx("b",{children:a("tour.step.done.em1.label")},"em1"),em2:e.jsx("b",{children:a("tour.step.done.em2.label")},"em2")})}}],xh=(t,n)=>Ew.filter(o=>(!o.admin||t)&&(!o.tab||(n==null?void 0:n[o.tab])!==!1)),Vv=(t,n)=>xh(t,n).map((o,s)=>({...o,at:s})).filter(o=>o.name);function Aw(t){for(const n of document.querySelectorAll(t)){const o=n.getBoundingClientRect();if(o.width>4&&o.height>4)return n}return null}function qw({kind:t}){const n=Cw[t];return e.jsxs("figure",{className:"tour-demo",children:[e.jsx("blockquote",{style:{fontFamily:"var(--font-display)",fontWeight:"var(--font-display-weight)",fontVariantCaps:"var(--font-display-caps)",textTransform:"var(--font-display-case)",fontVariantNumeric:"var(--font-display-figures)",fontStyle:"italic",fontSize:"var(--type-display-15)",lineHeight:1.5,whiteSpace:"pre-wrap"},children:t==="book"?`“${n.quote}”`:n.quote}),e.jsx("figcaption",{className:"mt-2",style:{fontFamily:"var(--font-mono)",fontWeight:"var(--font-mono-weight)",fontStyle:"var(--font-mono-style)",fontVariantCaps:"var(--font-mono-caps)",textTransform:"var(--font-mono-case)",fontVariantNumeric:"var(--font-mono-figures)",fontSize:"var(--type-mono-11)",letterSpacing:".06em",color:"var(--faint)"},children:t==="book"?Pe("tour.demo.book.credit.label",{name:n.author,title:e.jsx("i",{children:n.title},"title"),meta:n.meta}):Pe("tour.demo.film.credit.label",{character:n.character,actor:n.actor,title:e.jsx("i",{children:n.title},"title"),year:n.year,meta:n.meta})})]})}function Mw({user:t,startStep:n=0,onNavigate:o,onPreferences:s,onClose:r}){const i=c.useMemo(()=>bh(t.preferences),[t.preferences]),l=c.useMemo(()=>xh(t.is_admin,i),[t.is_admin,i]),[h,d]=c.useState(()=>Math.min(Math.max(0,n),l.length-1)),m=l[h],p=Ie(),[u,f]=c.useState(null),b=c.useRef(null);c.useEffect(()=>{var S;m.tab&&o(m.tab),(S=b.current)==null||S.focus({preventScroll:!0})},[h]),c.useEffect(()=>{if(f(null),!m.anchor)return;let S,x=null,L=!1;const A={t:-1,l:-1,w:-1,h:-1},E=()=>{if(!L){if((!x||!x.isConnected)&&(x=Aw(m.anchor),x))try{x.scrollIntoView({block:"center"})}catch{}if(x){const D=x.getBoundingClientRect();(Math.abs(D.top-A.t)>.5||Math.abs(D.left-A.l)>.5||Math.abs(D.width-A.w)>.5||Math.abs(D.height-A.h)>.5)&&(A.t=D.top,A.l=D.left,A.w=D.width,A.h=D.height,f({top:D.top,left:D.left,width:D.width,height:D.height}))}S=requestAnimationFrame(E)}};return S=requestAnimationFrame(E),()=>{L=!0,cancelAnimationFrame(S)}},[h]);function w(S){s==null||s(S),Z("PUT","/auth/me/preferences",S)}function v(){w({tour:"done",tourStep:0}),r(),Ee(a("tour.toast.done"))}function g(){w({tour:"skipped",tourStep:0}),r(),Ee(a("tour.toast.skipped"))}function y(){w({tour:"postponed",tourStep:h}),r(),Ee(a("tour.toast.postponed"))}const k=()=>h>=l.length-1?v():d(h+1),j=()=>h>0&&d(h-1);c.useEffect(()=>{const S=x=>{x.key==="Escape"&&y()};return document.addEventListener("keydown",S),()=>document.removeEventListener("keydown",S)},[h]);const N={};if(!p){const S=window.innerWidth,x=window.innerHeight,L=Math.min(400,S-24),A=340;u?(N.left=Math.max(12,Math.min(u.left,S-L-12)),u.top+u.height+14+A<x?N.top=u.top+u.height+14:u.top-A-14>0?N.bottom=x-u.top+14:(N.top="50%",N.transform="translateY(-50%)",N.left=Math.max(12,Math.min(u.left+u.width+18,S-L-12)))):(N.left="50%",N.top="50%",N.transform="translate(-50%, -50%)")}return e.jsxs(e.Fragment,{children:[u?e.jsx("div",{className:"tour-spotlight","aria-hidden":"true",style:{top:u.top-6,left:u.left-6,width:u.width+12,height:u.height+12}}):!m.anchor&&e.jsx("div",{className:"tour-scrim","aria-hidden":"true"}),e.jsxs("section",{ref:b,tabIndex:-1,role:"dialog","aria-label":m.title,className:"tour-card hand-card p-5"+(p?" mobile":""),style:N,children:[e.jsxs("div",{className:"flex items-baseline justify-between gap-3",children:[e.jsx(W,{children:a("tour.progress.label",{done:h+1,total:l.length})}),e.jsx("button",{type:"button",className:"tp-link",onClick:y,children:a("tour.later.label")})]}),e.jsxs("div",{className:"mt-1.5 flex items-center gap-1.5",children:[e.jsx("h2",{style:{fontFamily:"var(--font-ui)",fontStyle:"var(--font-ui-style)",fontVariantCaps:"var(--font-ui-caps)",textTransform:"var(--font-ui-case)",fontVariantNumeric:"var(--font-ui-figures)",fontSize:"var(--type-ui-17)",fontWeight:600},children:m.title}),m.more&&e.jsx(Re,{title:m.title,text:m.more})]}),e.jsx("div",{className:"mt-2",style:{fontSize:"var(--type-ui-13)",lineHeight:1.55,color:"var(--soft)"},children:m.body}),m.demo&&e.jsx(qw,{kind:m.demo}),e.jsxs("div",{className:"mt-4 flex items-center gap-2",children:[e.jsx("button",{type:"button",className:"tp-link",onClick:g,children:a("tour.skip.label")}),e.jsx("span",{className:"flex-1"}),h>0&&e.jsx(Ae,{icon:e.jsx($t,{}),ariaLabel:a("tour.back.aria"),onClick:j}),e.jsx(an,{onClick:k,children:a(h>=l.length-1?"tour.finish.label":"tour.next.label")})]})]})]})}const Lw=c.lazy(()=>Qe(()=>Promise.resolve().then(()=>Wd),void 0)),Dw=c.lazy(()=>Qe(()=>import("./MetadataPage-C-mTqDqD.js"),__vite__mapDeps([0,1]))),_w=c.lazy(()=>Qe(()=>Promise.resolve().then(()=>Yd),void 0)),Ow=c.lazy(()=>Qe(()=>Promise.resolve().then(()=>Jd),void 0)),Rw=c.lazy(()=>Qe(()=>import("./TagsPage-CBOLR9zS.js"),__vite__mapDeps([2,1]))),Iw=c.lazy(()=>Qe(()=>import("./SearchPage-B7HXTKLV.js"),__vite__mapDeps([3,1]))),Pw=c.lazy(()=>Qe(()=>Promise.resolve().then(()=>By),void 0)),Fw=c.lazy(()=>Qe(()=>import("./StatsPage-DQjZXyRN.js"),__vite__mapDeps([4,1]))),Bw=c.lazy(()=>Qe(()=>import("./Settings-ePsecudU.js"),__vite__mapDeps([5,1]))),Hw=c.lazy(()=>Qe(()=>import("./BinPage-C5v0j1DD.js"),__vite__mapDeps([6,1]))),zw=c.lazy(()=>Qe(()=>import("./CleanupPage-BZB4G-Df.js"),__vite__mapDeps([7,1]))),$w=c.lazy(()=>Qe(()=>import("./ChecksPage-0ieqHa5n.js"),__vite__mapDeps([8,1]))),jh={home:"go-home",library:"go-library",movies:"go-catalogue",quotes:"go-quotes",anthologies:"go-anthologies",stats:"go-stats",metadata:"go-metadata",settings:"go-settings",search:"search"};function Ww(){Ol();const[t,n]=c.useState(null),[o,s]=c.useState(!1),[r,i]=c.useState(null),[l,h]=c.useState(!0);c.useEffect(()=>{fetch(jt("/auth/me")).then(u=>u.ok?u.json():null).then(u=>u?n(u):fetch(jt("/auth/status")).then(f=>f.json()).then(f=>{s(f.needs_onboarding),i(f.backup||null)})).finally(()=>h(!1))},[]),c.useEffect(()=>{var u;t&&(Oo(t.preferences||{}),Zl(t.preferences||{}),Gs(((u=t.preferences)==null?void 0:u.locale)||""),_p(t.preferences||{}),tb(t.preferences||{}),Fi(t.preferences||{}),ew(t.preferences||{}),Z("GET","/fonts").then(f=>{var b;f.ok&&bf(((b=f.data)==null?void 0:b.fonts)||[]).then(()=>Fi(t.preferences||{}))}))},[t]);const d=u=>n(f=>f&&{...f,preferences:{...f.preferences,...u}}),m=u=>n(f=>f&&{...f,...u});let p=null;return l||(t?p=e.jsx(nv,{user:t,onLogout:()=>{kr(),n(null)},onPreferences:d,onUser:m}):o?p=e.jsx(Gw,{onDone:n,backup:r}):p=e.jsx(Vw,{onLogin:n})),e.jsxs(e.Fragment,{children:[e.jsx("div",{className:"scene-bg","aria-hidden":"true"}),Il,e.jsx(nc,{children:p}),e.jsx(hp,{}),e.jsx("div",{className:"grain-overlay","aria-hidden":"true"})]})}async function Uw(){const t=await fetch(jt("/auth/me"));return t.ok?t.json():null}function Sh({header:t,action:n,cta:o,microcopy:s,film:r=!1,onSuccess:i}){const l=n!=="/auth/login",[h,d]=c.useState(""),[m,p]=c.useState(""),[u,f]=c.useState(""),[b,w]=c.useState(!1);async function v(k){k.preventDefault(),f(""),w(!0);try{const j=await fetch(jt(n),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:h,password:m})});if(j.ok){const N=await Uw();if(N)return n==="/auth/login"&&Ee(a("shell.login.toast.welcome",{name:N.username||a("shell.login.reader.fallback")})),i(N)}f((await j.json().catch(()=>({}))).error||a("error.generic"))}finally{w(!1)}}const g=r?Fu:an,y=h.trim()?m?l?Jr(m):"":a("error.validate.password-required"):a("error.validate.username-required");return e.jsxs("form",{onSubmit:v,className:"hand-card w-full max-w-sm px-8 py-9",children:[e.jsx("div",{className:"mb-7 text-center",children:t}),e.jsx(Se,{label:a("common.field.username.label"),placeholder:a("common.field.username.placeholder"),value:h,autoComplete:"username",onChange:k=>d(k.target.value)}),e.jsx(Se,{label:a("common.field.password.label"),placeholder:l?a("shell.login.password.range.placeholder",{a:Ta,b:bt}):a("common.field.password.placeholder"),type:"password",value:m,autoComplete:l?"new-password":"current-password",maxLength:bt,onChange:k=>p(k.target.value)}),e.jsx("div",{className:"mt-3",children:e.jsx(ke,{children:u})}),e.jsx(g,{className:"mt-4 w-full",disabled:b||!!y,title:y||void 0,children:o}),y&&m.length>0&&e.jsx("p",{className:"microcopy mt-2 text-center",children:a("common.form.reason.sentence",{reason:y})}),s&&e.jsx("p",{className:"microcopy mt-5 text-center",children:s})]})}function Gw({onDone:t,backup:n}){const[o,s]=c.useState(n?"server":"file"),[r,i]=c.useState(null),[l,h]=c.useState(null),[d,m]=c.useState("idle"),[p,u]=c.useState(0),[f,b]=c.useState(""),[w,v]=c.useState(""),[g,y]=c.useState(""),k=c.useRef(null);c.useEffect(()=>{Oo({materialSet:"manuscript",theme:"light"})},[]);const j=o==="file"?r?{...l,name:r.name}:null:n,N=(j==null?void 0:j.key)||(j?"none":"");async function S(D){i(D),b(""),h(D?await yw(D):null)}const x=j?N==="passphrase"?g?"":a("error.validate.archive-passphrase-required"):N==="password"?w?"":a("error.validate.archive-password-required"):"":a(o==="file"?"error.validate.backup-file-required":"error.validate.backup-absent"),L=()=>N==="passphrase"?{passphrase:g}:N==="password"?{password:w}:{};async function A(){if(!(x||d!=="idle")){b(""),m(o==="file"?"uploading":"restoring"),u(0);try{let D;if(o==="file"){const q=new FormData;for(const[C,I]of Object.entries(L()))q.append(C,I);q.append("file",r),D=await Fl("/auth/restore/upload",q,C=>{u(Math.round(C*100)),C>=1&&m("restoring")})}else D=await Z("POST","/auth/restore",L());if(!D.ok)return m("idle"),b(D.data&&D.data.error||a("error.restore.failed"));Ee(a("shell.restore.toast.done")),setTimeout(()=>window.location.reload(),1200)}catch{setTimeout(()=>window.location.reload(),1200)}}}const E=d==="uploading"?a("shell.restore.uploading.busy",{percent:p}):d==="restoring"?a("common.action.apply.busy"):"";return e.jsxs("main",{className:"flex min-h-screen flex-col items-center justify-center gap-4 px-4 py-10","data-screen-label":"onboarding",children:[e.jsx("div",{className:"hand-card w-full max-w-sm px-8 py-6",children:e.jsx(nw,{titleKey:"onboarding.language.title",width:230})}),e.jsx(Sh,{header:e.jsxs(e.Fragment,{children:[e.jsx("img",{src:"/mark.svg",alt:"",width:"46",height:"46",className:"mx-auto mb-3"}),e.jsx("h1",{className:"display-title text-2xl",children:a("shell.onboarding.title")}),e.jsx("p",{className:"mt-1 text-sm",style:{color:"var(--soft)"},children:a("shell.onboarding.subtitle.prose")})]}),action:"/auth/signup",cta:a("shell.onboarding.cta.label"),microcopy:a("shell.onboarding.microcopy.prose"),onSuccess:t}),e.jsxs("div",{className:"hand-card w-full max-w-sm px-8 py-6",children:[e.jsx("p",{className:"mono-label mb-2 text-center",children:a("shell.restore.title")}),e.jsx("p",{className:"mb-3 text-sm",style:{color:"var(--soft)"},children:a("shell.restore.what.prose")}),e.jsx(dt,{ariaLabel:a("shell.restore.source.aria"),value:o,onChange:D=>{s(D),b("")},options:[["server",a("shell.restore.source.server.label")],["file",a("shell.restore.source.file.label")]]}),o==="server"&&e.jsx("p",{className:"microcopy mt-2",children:n?Pe("shell.restore.server.dated.prose",{date:e.jsx("b",{children:new Date(n.created).toLocaleString(void 0,{dateStyle:"medium",timeStyle:"short"})})}):a("shell.restore.server.empty.prose")}),o==="file"&&e.jsxs(e.Fragment,{children:[e.jsx("input",{ref:k,type:"file",accept:".tpbk,.tar.gz,.tgz,application/gzip,application/octet-stream","aria-label":a("shell.restore.file.aria"),className:"hidden",onChange:D=>{var q;return S(((q=D.target.files)==null?void 0:q[0])||null)}}),e.jsx(ge,{className:"mt-3 w-full",onClick:()=>{var D;return(D=k.current)==null?void 0:D.click()},disabled:d!=="idle",children:r?r.name:a("shell.restore.file.choose.label")})]}),N==="passphrase"&&e.jsx("div",{className:"mt-3",children:e.jsx(Se,{label:a("common.field.passphrase.label"),placeholder:a("shell.restore.passphrase.placeholder"),type:"password",value:g,maxLength:wh,onChange:D=>{y(D.target.value),b("")}})}),N==="password"&&e.jsxs("div",{className:"mt-3",children:[e.jsx(Se,{label:j!=null&&j.account?a("shell.restore.password.named.label",{name:j.account}):a("common.field.password.label"),placeholder:a("shell.restore.password.placeholder"),type:"password",value:w,autoComplete:"current-password",maxLength:bt,onChange:D=>{v(D.target.value),b("")}}),e.jsx("p",{className:"microcopy",children:a(j!=null&&j.recoverable?"shell.restore.password.recoverable.prose":"shell.restore.password.era.prose")})]}),N==="none"&&j&&e.jsx("p",{className:"microcopy mt-2",children:a("shell.restore.unkeyed.prose")}),e.jsx(ge,{className:"mt-3 w-full",onClick:A,disabled:!!x||d!=="idle",title:x||void 0,children:E||a("common.action.restore.label")}),x&&e.jsx("p",{className:"microcopy mt-2 text-center",children:a("common.form.reason.sentence",{reason:x})}),e.jsx("div",{className:"mt-2",children:e.jsx(ke,{children:f})})]})]})}function Vw({onLogin:t}){c.useEffect(()=>{Oo({materialSet:"film-assembly",theme:"dark"})},[]);const[n]=c.useState(tw),o=yc();return e.jsx("main",{className:"flex min-h-screen items-center justify-center px-4 py-10","data-screen-label":"login",children:e.jsxs("div",{className:"film-strip w-full max-w-2xl",children:[e.jsx(vo,{}),e.jsx(bc,{left:"",code:Ns(o)}),e.jsx("div",{className:"flex justify-center px-6 py-8",children:e.jsx(Sh,{film:!0,header:e.jsxs(e.Fragment,{children:[e.jsx("img",{src:"/mark-dark.svg",alt:"",width:"44",height:"44",className:"mx-auto mb-3"}),e.jsx("div",{className:"wordmark",style:{fontSize:"var(--type-ui-22)"},children:a("shell.wordmark.label")}),e.jsx("p",{className:"bengali text-sm","aria-hidden":"true",children:"টিপ্পনী"}),e.jsx("p",{className:"login-epigraph",children:n})]}),action:"/auth/login",cta:a("shell.login.cta.label"),microcopy:a("shell.login.microcopy.prose"),onSuccess:t})}),e.jsx(vo,{})]})})}const lo=" | ",An=(t,n)=>`${t}${lo}${n}`;function _o({value:t,className:n}){const o=t.indexOf(lo);return o<0?e.jsx("span",{className:n,children:t}):e.jsxs("span",{className:n,children:[e.jsx("b",{className:"nav-count-lead",children:t.slice(0,o)}),e.jsx("span",{className:"nav-count-sep",children:lo}),t.slice(o+lo.length)]})}function Nh(t,n){return An(t,n)}function Th(t,{stats:n,metaIssues:o,streak:s,version:r}={}){if(n){if(t==="library")return An(n.books,n.annotations);if(t==="movies")return An(n.movies,n.dialogues);if(t==="quotes")return An(n.boards??0,n.quotes);if(t==="tags")return An(n.tags,n.stickers??0);if(t==="anthologies"&&n.anthologies!=null)return An(n.anthologies,n.anthology_quotes??0)}return t==="metadata"&&o!=null?o>0?a("common.count.phrase",{n:o,noun:a("unit.issue",{count:o})}):a("shell.drawer.metadata.clear.label"):t==="stats"&&s>0?a("shell.drawer.stats.streak.label",{n:s}):t==="settings"?a("shell.drawer.settings.version.label",{version:r||"dev"}):null}function Tl({screen:t,className:n,glyph:o=22}){const[s,r]=c.useState(!1),[i,l]=c.useState(!1),h=c.useRef(null),d=s?[..._u(),{id:"help",icon:e.jsx(hr,{size:24}),label:a("shell.help.menu.label"),onClick:()=>l(!0)}]:[];return e.jsxs("div",{className:"relative",ref:h,children:[e.jsx(ye,{label:a("shell.screen.menu.tip"),side:"bottom",className:"shrink-0",children:e.jsx("button",{type:"button",className:`${n}${s?" is-open":""}`,"aria-label":a("shell.screen.menu.aria"),"aria-haspopup":"menu","aria-expanded":s,onClick:()=>r(m=>!m),children:e.jsx(cr,{size:o})})}),e.jsx(fr,{open:s,items:d,anchorRef:h,onClose:()=>r(!1),returnFocusTo:h}),e.jsx(xy,{screen:t,open:i,onClose:()=>l(!1)})]})}function Kw({tab:t,detail:n,title:o,onRoot:s}){const r=(n==null?void 0:n.type)==="movie"?"movies":(n==null?void 0:n.type)==="book"?"library":null,i=a(r?`nav.tab.${r==="movies"?"movies":"library"}.label`:"shell.wordmark.label"),l=n?o:a(yh(t));return l?e.jsxs("nav",{className:"topbar-crumbs","aria-label":a("shell.crumbs.aria"),children:[e.jsx("button",{type:"button",className:"crumb",onClick:()=>s(r),children:i}),e.jsx("span",{className:"crumb-sep","aria-hidden":"true",children:"/"}),e.jsx("span",{className:"crumb-here",title:l,children:l})]}):null}function Yw({scope:t,scopeLabel:n,onSearch:o,onDropScope:s}){const[r,i]=c.useState(""),l=c.useRef(null),h=t!=="all",d=m=>{m.preventDefault(),o(r,h?t:"all")};return e.jsxs("form",{className:"topbar-search",onSubmit:d,role:"search",children:[e.jsx("span",{className:"search-icon","aria-hidden":"true",children:e.jsx(on,{})}),h&&e.jsxs("button",{type:"button",className:"scope-pill",title:a("shell.search.scope.drop.tip"),onClick:s,children:[e.jsx("span",{className:"scope-key",children:a("shell.search.scope.key")}),e.jsx("span",{className:"scope-val",children:n}),e.jsx("span",{className:"scope-x","aria-hidden":"true",children:"×"})]}),e.jsx("input",{ref:l,value:r,onChange:m=>i(m.target.value),placeholder:a(h?"shell.search.hint.scoped":"shell.search.hint.all"),"aria-label":a(h?"shell.search.aria.scoped":"shell.search.aria.all")}),e.jsx("span",{className:"kbd-hint","aria-hidden":"true",children:"/"})]})}function Qw({tab:t,onChange:n,sections:o,user:s,onAccount:r,onBin:i,onChecks:l,brandDot:h=null,badges:d={},binCount:m=0,checkCount:p=0,strayCount:u=0}){const f=ac(),b=c.useRef(null);Io(b,{axis:"v"});const w=([v,g])=>e.jsxs("button",{type:"button",className:"rail-row","aria-current":t===v?"page":void 0,title:a(g),onClick:()=>n(v),children:[e.jsx("span",{className:"rail-icon",children:e.jsx(No,{name:v})}),e.jsx("span",{className:"rail-label",children:a(g)}),d[v]?e.jsx(_o,{className:"rail-count",value:d[v]}):null]},v);return e.jsxs("aside",{className:"rail",children:[e.jsx("div",{className:"rail-head",children:e.jsxs("button",{type:"button",className:"rail-brand",onClick:()=>n("home"),title:a("nav.bottom.home.aria"),children:[e.jsx("img",{src:f?"/mark-dark.svg":"/mark.svg",alt:"",width:"34",height:"34"}),e.jsx("span",{className:"rail-wordmark",children:a("shell.wordmark.label")}),h]})}),e.jsxs("nav",{ref:b,className:"rail-nav","aria-label":a("shell.nav.primary.aria"),children:[Na(fh,o).map(w),e.jsx("span",{className:"rail-rule","aria-hidden":"true"}),Na(gh,o).map(w)]}),e.jsxs("div",{className:"rail-foot",children:[e.jsxs("button",{type:"button",className:"rail-row",title:a("checks.title"),"aria-current":t==="checks"?"page":void 0,onClick:l,children:[e.jsx("span",{className:"rail-icon",children:e.jsx(Cc,{})}),e.jsx("span",{className:"rail-label",children:a("checks.title")}),p>0||u>0?e.jsx(_o,{className:"rail-count",value:Nh(p,u)}):null]}),e.jsxs("button",{type:"button",className:"rail-row",title:a("bin.title"),"aria-current":t==="bin"?"page":void 0,onClick:i,children:[e.jsx("span",{className:"rail-icon",children:e.jsx(Ec,{})}),e.jsx("span",{className:"rail-label",children:a("bin.title")}),m>0?e.jsx("span",{className:"rail-count",children:m}):null]}),e.jsxs("button",{type:"button",className:"rail-row rail-acct","aria-label":a("shell.account.chip.aria",{name:s.username}),onClick:r,children:[e.jsx("span",{className:"user-chip","aria-hidden":"true",children:e.jsx(Ch,{user:s})}),e.jsx("span",{className:"rail-acct-name",children:s.display_name||s.username})]})]})]})}function Zw({user:t,onUser:n,onClose:o,logout:s}){const r=Ie();qa(!0,o),c.useEffect(()=>{const l=h=>{h.key==="Escape"&&o()};return document.addEventListener("keydown",l),()=>document.removeEventListener("keydown",l)},[o]);const i=e.jsx(Nw,{user:t,onUser:n,logout:s});return r?e.jsxs("div",{className:"account-page",role:"dialog","aria-label":a("nav.tab.profile.label"),children:[e.jsxs("header",{className:"account-page-bar",children:[e.jsx(ye,{label:a("shell.account.back.tip"),side:"bottom",children:e.jsx("button",{type:"button",className:"mobile-topbar-btn",onClick:o,"aria-label":a("common.action.back.label"),children:e.jsx($t,{})})}),e.jsx("span",{className:"account-page-title",children:a("nav.tab.profile.label")}),e.jsx("span",{className:"ml-auto",children:e.jsx(ja,{screen:"profile"})})]}),e.jsx("div",{className:"account-page-body",children:i})]}):e.jsx("div",{className:"account-scrim",onMouseDown:o,children:e.jsxs("div",{className:"hand-card account-modal",role:"dialog","aria-label":a("nav.tab.profile.label"),onMouseDown:l=>l.stopPropagation(),children:[e.jsxs("div",{className:"account-modal-bar",children:[e.jsx("h2",{className:"account-modal-title",children:a("nav.tab.profile.label")}),e.jsx(ja,{screen:"profile"}),e.jsx(yr,{onClick:o,tooltip:a("shell.account.panel.close.tip")})]}),e.jsx("div",{className:"account-modal-body",children:i})]})})}const qn=new Map;function gs(t){for(qn.delete(t),qn.set(t,window.scrollY);qn.size>2;)qn.delete(qn.keys().next().value)}function Ch({user:t}){return t.avatar_path?e.jsx("img",{src:Ue(t.avatar_path),alt:""}):(t.username||"?").trim().charAt(0).toLowerCase()}function Xw({open:t,onClose:n,tab:o,selectTab:s,onSearch:r,onAdd:i,onAccount:l,user:h,stats:d,pending:m,pendingImport:p,streak:u,metaIssues:f,dark:b,onUser:w,sections:v,binCount:g=0,checkCount:y=0,strayCount:k=0}){qa(t,n),c.useEffect(()=>{if(!t)return;const E=D=>{D.key==="Escape"&&n()};return document.addEventListener("keydown",E),()=>document.removeEventListener("keydown",E)},[t,n]),Nt(t);const j=c.useRef(null),N=10,S=E=>{j.current={x:E.clientX,y:E.clientY,intent:null,hit:!1}},x=E=>{const D=j.current;if(!D||D.intent==="scroll")return;const q=E.clientX-D.x,C=E.clientY-D.y;if(D.intent===null){if(Math.abs(q)<N&&Math.abs(C)<N)return;D.intent=Math.abs(q)>Math.abs(C)?"swipe":"scroll"}D.intent==="swipe"&&q<=-48&&(D.hit=!0)},L=()=>{var D;const E=(D=j.current)==null?void 0:D.hit;j.current=null,E&&n()};if(!t)return null;const A=E=>{if(E==="home")return e.jsxs("span",{className:"drawer-badge",style:{fontSize:"var(--type-ui-9)"},children:[m>0&&e.jsx("span",{className:"review-dot","aria-hidden":"true"}),"quiz · practice"]});const D=Th(E,{stats:d,metaIssues:f,streak:u,version:h.version});return D?e.jsx(_o,{className:"drawer-badge",value:D}):null};return e.jsxs(e.Fragment,{children:[e.jsx("button",{type:"button",className:"drawer-scrim","aria-label":a("shell.drawer.close.aria"),onClick:n}),e.jsxs("nav",{className:"drawer","aria-label":a("shell.nav.primary.aria"),onPointerDown:S,onPointerMove:x,onPointerUp:L,onPointerCancel:()=>{j.current=null},children:[e.jsxs("div",{className:"drawer-header",children:[e.jsx("img",{src:b?"/mark-dark.svg":"/mark.svg",alt:"",width:"34",height:"34"}),e.jsxs("div",{className:"min-w-0",children:[e.jsx("p",{style:{fontFamily:"var(--font-display)",fontStyle:"var(--font-display-style)",fontVariantCaps:"var(--font-display-caps)",textTransform:"var(--font-display-case)",fontVariantNumeric:"var(--font-display-figures)",fontWeight:600,fontSize:"var(--type-display-19)",letterSpacing:"-0.02em"},children:"tippani"}),e.jsx("p",{className:"bengali",style:{fontSize:"var(--type-display-12)",color:"var(--amber)"},"aria-hidden":"true",children:a("shell.drawer.tagline.label")})]})]}),e.jsxs("div",{className:"drawer-nav",children:[e.jsxs("button",{type:"button",className:"drawer-item drawer-add",onClick:()=>{i(),n()},children:[e.jsx(ht,{}),a("common.action.add.label"),e.jsx("span",{className:"drawer-badge",children:a("shell.drawer.add.badge.label")})]}),p>0&&e.jsxs("button",{type:"button",className:"drawer-item",onClick:()=>{s("staging"),n()},children:[e.jsx(No,{name:"import"}),a("shell.drawer.pending.label"),e.jsx("span",{className:"drawer-badge",style:{color:"var(--accent-ui)"},children:p})]}),Na(ow,v).map((E,D)=>E===null?e.jsx("div",{className:"drawer-divider","aria-hidden":"true"},`div-${D}`):e.jsxs("button",{type:"button",className:"drawer-item"+(o===E[0]?" active":""),"aria-current":o===E[0]?"page":void 0,onClick:()=>{E[0]==="search"&&r?r():s(E[0]),n()},children:[e.jsx(No,{name:E[0]}),a(E[1]),A(E[0]),e.jsx(mn,{keys:Vt(jh[E[0]])})]},E[0])),e.jsx("div",{className:"drawer-divider","aria-hidden":"true"}),e.jsxs("button",{type:"button",className:"drawer-item"+(o==="checks"?" active":""),"aria-current":o==="checks"?"page":void 0,onClick:()=>{s("checks"),n()},children:[e.jsx(Cc,{}),a("checks.title"),y>0||k>0?e.jsx(_o,{className:"drawer-badge",value:Nh(y,k)}):null]}),e.jsxs("button",{type:"button",className:"drawer-item"+(o==="bin"?" active":""),"aria-current":o==="bin"?"page":void 0,onClick:()=>{s("bin"),n()},children:[e.jsx(Ec,{}),a("bin.title"),g>0?e.jsx("span",{className:"drawer-badge",children:g}):null]})]}),e.jsxs("button",{type:"button",className:"drawer-footer","aria-label":a("shell.account.chip.aria",{name:h.username}),onClick:()=>{l(),n()},children:[e.jsx("span",{className:"user-chip","aria-hidden":"true",children:e.jsx(Ch,{user:h})}),e.jsxs("span",{className:"min-w-0 flex-1 text-left",children:[e.jsx("span",{className:"block",style:{fontSize:"var(--type-ui-13)",fontWeight:600},children:h.username}),e.jsx("span",{className:"mono-label block",style:{fontSize:"var(--type-ui-9)"},children:a(h.is_admin?"shell.drawer.role.admin.label":"shell.drawer.role.user.label")})]})]})]})]})}function Jw({keys:t,hidden:n,canBack:o,onBack:s,onSearch:r,onAdd:i,addLabel:l,addBadge:h,searchLabel:d,searchIcon:m}){const[p,u]=c.useState(!1),f=n&&!p,b=(t||[]).slice(0,2),w=v=>v.node?e.jsx(c.Fragment,{children:v.node},v.id):e.jsx(ye,{label:v.label,side:"top",children:e.jsx("button",{type:"button",className:"mobile-dock-btn","aria-label":v.label,"aria-pressed":v.on===void 0?void 0:!!v.on,disabled:!!v.disabled,onClick:v.onClick,children:v.icon})},v.id);return e.jsxs("nav",{className:"mobile-dock"+(f?" is-away":""),"aria-label":a("shell.nav.dock.aria"),onFocus:()=>u(!0),onBlur:()=>u(!1),children:[w({id:"back",label:a("common.action.back.label"),icon:e.jsx($t,{}),disabled:!o,onClick:s}),w({id:"search",label:d,icon:m,onClick:r}),e.jsx(ye,{label:l,side:"top",children:e.jsxs("button",{type:"button",className:"mobile-dock-btn is-accent","data-tour":"add","aria-label":l,onClick:i,children:[e.jsx(ht,{}),h]})}),b.length>0&&e.jsx("span",{className:"mobile-dock-rule","aria-hidden":"true"}),b.map(w)]})}const ev=[()=>Qe(()=>Promise.resolve().then(()=>Wd),void 0),()=>Qe(()=>Promise.resolve().then(()=>Jd),void 0),()=>Qe(()=>Promise.resolve().then(()=>Yd),void 0),()=>Qe(()=>import("./SearchPage-B7HXTKLV.js"),__vite__mapDeps([3,1]))];function tv(){const t=()=>{for(const n of ev)n().catch(()=>{})};typeof requestIdleCallback=="function"?requestIdleCallback(t,{timeout:4e3}):setTimeout(t,1500)}function nv({user:t,onLogout:n,onPreferences:o,onUser:s}){var Wa,re,ve,Oe,Ut;const r=Sl(typeof window<"u"?window.location.pathname:"/"),i=r.tab==="import"||r.tab==="capture"?"home":r.tab,[l,h]=c.useState(i);c.useEffect(tv,[]);const[d,m]=c.useState(r.detail),[p,u]=c.useState(!1),[f,b]=c.useState(!1),[w]=$e("tippani:search:global",!1),[v,g]=c.useState(!1),[y,k]=c.useState(!1),[j,N]=c.useState("book"),[S,x]=c.useState(null),L=(ue="book",Me=null)=>{N(ue),x(Me),g(!0)},[A,E]=c.useState(0),D=()=>E(ue=>ue+1),[q,C]=c.useState(0),[I,O]=c.useState(0),V=()=>{Z("GET","/import/staged?counts=1").then(ue=>{ue.ok&&O(ue.data.pending||0)})};c.useEffect(()=>{Z("GET","/metadata/library").then(ue=>{if(!ue.ok||!ue.data)return;const Me=(ue.data.books||[]).filter(Dt=>!Dt.has_cover||!Dt.has_ids).length,nt=(ue.data.movies||[]).filter(Dt=>!Dt.has_poster||!Dt.has_cast||!Dt.has_source).length;F(Me+nt)}),Z("GET","/trash").then(ue=>{var Me;ue.ok&&K((((Me=ue.data)==null?void 0:Me.trash)||[]).length)}),Z("GET","/cleanup?counts=1").then(ue=>{var Me,nt;ue.ok&&R(((nt=(Me=ue.data)==null?void 0:Me.counts)==null?void 0:nt.open)||0)})},[]);const[P,T]=c.useState(0),[B,_]=c.useState(null),[U,F]=c.useState(null),[X,R]=c.useState(0),[G,K]=c.useState(0),[M,Q]=c.useState(null),z=ac(),[te,J]=c.useState(null),fe=Ie(),me=Lu({enabled:fe,forceShow:f||v||p||!!te,resetKey:l});c.useEffect(()=>{var Me;if((Me=t.preferences)!=null&&Me.tour)return;const ue=setTimeout(()=>J({step:0}),800);return()=>clearTimeout(ue)},[]);const H=()=>{Z("GET","/stats").then(ue=>{ue.ok&&_(ue.data)})};c.useEffect(()=>{H(),Fc(Vo()).then(ue=>{ue.ok&&(C((ue.data.items||[]).length),T(ue.data.streak||0))}),V(),r.tab==="import"&&L("import"),r.tab==="capture"&&L("quote")},[]),c.useEffect(()=>{var Me,nt;const ue=(q||0)+(I||0);try{ue>0?(Me=navigator.setAppBadge)==null||Me.call(navigator,ue):(nt=navigator.clearAppBadge)==null||nt.call(navigator)}catch{}},[q,I]);const ee=c.useRef({tab:l,detail:d});c.useEffect(()=>{ee.current={tab:l,detail:d}}),c.useEffect(()=>{"scrollRestoration"in window.history&&(window.history.scrollRestoration="manual")},[]),c.useEffect(()=>{const ue=()=>{const Me=ee.current;Me.detail||gs(ln(Me.tab,null));const nt=Sl(window.location.pathname);if(nt.tab==="import"){h("home"),m(null),L("import");return}if(nt.tab==="capture"){h("home"),m(null),L("quote");return}h(nt.tab),m(nt.detail)};return window.addEventListener("popstate",ue),cw(ln(i,r.detail)),()=>window.removeEventListener("popstate",ue)},[]),c.useEffect(()=>{const ue=d?null:qn.get(ln(l,null));if(ue==null){window.scrollTo({top:0,behavior:"instant"});return}let Me=0,nt=!1;const Dt=()=>{if(!nt){if(document.documentElement.scrollHeight-window.innerHeight>=ue||Me>40){window.scrollTo({top:ue,behavior:"instant"});return}Me++,requestAnimationFrame(Dt)}};return requestAnimationFrame(Dt),()=>{nt=!0}},[l,d]);function oe(ue,Me){d||gs(ln(l,null)),h(ue),m(Me),dw(ln(ue,Me))}function pe(ue){hw(ln(ue,null))||(d||gs(ln(l,null)),h(ue),m(null))}function de(ue){oe(ue,null)}function se(ue){oe("library",{type:"book",id:ue})}function Y(ue){oe("movies",{type:"movie",id:ue})}function ce(ue,Me="all"){try{localStorage.setItem("tippani:search:q",JSON.stringify(ue)),localStorage.setItem("tippani:search:scope",JSON.stringify(Me)),localStorage.setItem("tippani:search:chips",JSON.stringify([]))}catch{}de("search")}function Te(ue,Me=[]){try{localStorage.setItem("tippani:search:scope",JSON.stringify(ue)),localStorage.setItem("tippani:search:chips",JSON.stringify(Me))}catch{}de("search")}const Le=()=>w?Te("all"):Te(Nl(l,d),al());c.useEffect(()=>ec(ue=>{switch(ue){case"search":Le();break;case"capture":L("quote");break;case"go-home":oe("home");break;case"go-library":oe("library");break;case"go-catalogue":oe("movies");break;case"go-quotes":oe("quotes");break;case"go-anthologies":oe("anthologies");break;case"go-stats":oe("stats");break;case"go-metadata":oe("metadata");break;case"go-settings":oe("settings");break;case"go-profile":u(!0);break;case"help":k(!0);break}}),[l,d,w]);async function Fe(){await fetch(jt("/auth/logout"),{method:"POST"}),n()}const _e=q>0&&e.jsx("span",{className:"review-dot","aria-hidden":"true"}),ne=I>0&&e.jsx("span",{className:"add-badge",children:I}),he=bh(t.preferences),qe=new Set(Bs.filter(ue=>!he[ue.tab]).map(ue=>jh[ue.tab]).filter(Boolean)),Ne=rw(l,d),ae=iw(l,d),be=(d==null?void 0:d.type)==="book"||(d==null?void 0:d.type)==="movie"?{type:d.type,id:d.id}:null,ie=a(ae==="quote"?"shell.add.quote.label":ae==="film"?"shell.add.film.label":"shell.add.work.label"),je=Du(),{sub:Ce,keys:Be}=Ou(),Ze=(((Wa=window.history.state)==null?void 0:Wa.tpDepth)||0)>0||!!d,Wt=Nl(l,d),sn=ue=>a(ue==="books"?d?"shell.search.scope.thisbook":"nav.tab.library.label":ue==="movies"?d?"shell.search.scope.thisfilm":"nav.tab.movies.label":ue==="quotes"?"nav.tab.quotes.label":"shell.search.scope.all"),Zn=(ue,Me)=>{try{ue!==null&&localStorage.setItem("tippani:search:q",JSON.stringify(ue))}catch{}Te(Me,Me==="all"?[]:al())};return e.jsxs("div",{className:"min-h-screen has-mobile-topbar",children:[e.jsx(Qw,{tab:l,onChange:de,sections:he,user:t,onAccount:()=>u(!0),onBin:()=>oe("bin",null),onChecks:()=>oe("checks",null),brandDot:_e,badges:Object.fromEntries([...Na(fh,he),...Na(gh,he)].map(([ue])=>[ue,Th(ue,{stats:B,metaIssues:U,streak:P,version:t.version})]).filter(([,ue])=>ue)),binCount:G,checkCount:I,strayCount:X}),e.jsx("header",{className:"topbar",children:e.jsxs("div",{className:"topbar-inner",children:[e.jsx(Kw,{tab:l,detail:d,title:je,onRoot:ue=>de(ue||"home")}),e.jsx(Yw,{scope:Wt,scopeLabel:sn(Wt),onSearch:(ue,Me)=>Zn(ue,Me),onDropScope:()=>Zn(null,"all")}),e.jsxs("div",{className:"ml-auto flex items-center gap-2.5",children:[e.jsx(ye,{side:"bottom",className:"shrink-0",label:I>0?a("shell.add.pending.tip",{n:I}):ie,children:e.jsxs("button",{type:"button",className:"topbar-add-btn tactile","data-tour":"add","aria-label":ie,onClick:()=>L(ae,be),children:[e.jsx(ht,{}),e.jsx("span",{children:a("common.action.add.label")}),ne]})}),e.jsx(ja,{screen:Ne,variant:"pill"}),e.jsx(Tl,{screen:Ne,className:"topbar-add-btn tactile icon-only",glyph:18})]})]})}),e.jsxs("main",{className:"container-tp",children:[e.jsxs("header",{className:"mobile-topbar",children:[e.jsx(ye,{label:a("shell.drawer.open.tip"),side:"bottom",className:"shrink-0",children:e.jsxs("button",{type:"button",className:"mobile-topbar-btn","aria-label":a("shell.drawer.open.aria"),onClick:()=>b(!0),children:[e.jsx(kc,{}),_e]})}),e.jsxs("span",{className:"mobile-topbar-titles",children:[e.jsx("span",{className:"mobile-topbar-title",children:je||a(yh(l))}),Ce?e.jsx("span",{className:"mobile-topbar-sub",children:Ce}):null]}),e.jsx(Tl,{screen:Ne,className:"mobile-topbar-btn"})]}),e.jsx(nc,{label:a("shell.error.boundary.screen.label",{name:l}),children:e.jsx("div",{className:"tab-panel",children:e.jsxs(c.Suspense,{fallback:null,children:[l==="home"&&e.jsx("div",{"data-screen-label":"home",children:e.jsx(Uy,{user:t,stats:B,onOpenBook:se,onOpenMovie:Y,onGoLibrary:he.library?()=>de("library"):null,onGoMovies:he.movies?()=>de("movies"):null,onGoQuotes:he.quotes?()=>de("quotes"):null,onPending:C,pendingImport:I,onReviewImport:()=>de("staging")})}),l==="library"&&e.jsx("div",{"data-screen-label":"library",children:e.jsx(Lw,{openId:(d==null?void 0:d.type)==="book"?d.id:null,onOpen:se,onClose:()=>pe("library"),onOpenMovie:Y,creditSeparators:(re=t.preferences)==null?void 0:re.creditSeparators,onAdd:L,onSearch:Le,dataNonce:A})}),l==="movies"&&e.jsx("div",{"data-screen-label":"movies",children:e.jsx(_w,{openId:(d==null?void 0:d.type)==="movie"?d.id:null,onOpen:Y,onClose:()=>pe("movies"),creditSeparators:(ve=t.preferences)==null?void 0:ve.creditSeparators,onAdd:L,onSearch:Le,dataNonce:A})}),l==="metadata"&&e.jsx("div",{"data-screen-label":"metadata",children:e.jsx(Dw,{user:t,onOpenBook:se,onOpenMovie:Y,onSearch:ce})}),l==="search"&&e.jsx("div",{"data-screen-label":"search",children:e.jsx(Iw,{onOpenBook:se,onOpenMovie:Y,creditSeparators:(Oe=t.preferences)==null?void 0:Oe.creditSeparators,sections:he})}),l==="quotes"&&e.jsx("div",{"data-screen-label":"quotes",children:e.jsx(Ow,{openId:(d==null?void 0:d.type)==="board"?d.id:null,onOpen:ue=>oe("quotes",{type:"board",id:ue}),onClose:()=>pe("quotes"),creditSeparators:(Ut=t.preferences)==null?void 0:Ut.creditSeparators})}),l==="anthologies"&&e.jsx("div",{"data-screen-label":"anthologies",children:e.jsx(Jg,{openId:(d==null?void 0:d.type)==="anthology"?d.id:null,onOpen:ue=>oe("anthologies",{type:"anthology",id:ue}),onClose:()=>pe("anthologies"),onOpenBook:se,onOpenMovie:Y})}),l==="tags"&&e.jsx("div",{"data-screen-label":"tags",children:e.jsx(Rw,{})}),l==="stats"&&e.jsx("div",{"data-screen-label":"stats",children:e.jsx(Fw,{onSearch:ce})}),l==="staging"&&e.jsx("div",{"data-screen-label":"staging",children:e.jsx(Pw,{onPending:O,onOpenBook:se,onOpenMovie:Y,onApproved:H})}),l==="checks"&&e.jsx("div",{"data-screen-label":"checks",children:e.jsx($w,{onPending:O,onOpenBook:se,onOpenMovie:Y,onApproved:H,onOpenQuotes:()=>oe("quotes",null)})}),l==="settings"&&e.jsx("div",{"data-screen-label":"settings",children:e.jsx(Bw,{user:t,onPreferences:o,update:M,onUpdateInfo:Q,onStartTour:ue=>J({step:ue})})}),l==="bin"&&e.jsx("div",{"data-screen-label":"bin",children:e.jsx(Hw,{onClose:()=>pe("settings")})}),l==="cleanup"&&e.jsx("div",{"data-screen-label":"cleanup",children:e.jsx(zw,{onClose:()=>pe("settings"),onOpenBook:se,onOpenMovie:Y,onOpenQuotes:()=>oe("quotes",null)})})]})})},l)]}),e.jsx(Jw,{keys:Be,hidden:me,canBack:Ze,onBack:()=>window.history.back(),onSearch:Le,searchLabel:a(w?"shell.search.global.aria":"nav.tab.search.label"),searchIcon:w?e.jsx(pm,{}):e.jsx(on,{}),onAdd:()=>L(ae,be),addLabel:ie,addBadge:ne}),e.jsx(Xw,{metaIssues:U,open:f,onClose:()=>b(!1),tab:l,selectTab:de,sections:he,onSearch:()=>Te("all"),onAdd:()=>L("book"),onAccount:()=>u(!0),user:t,stats:B,pending:q,pendingImport:I,streak:P,binCount:G,checkCount:I,strayCount:X,dark:z,onUser:s}),e.jsx(em,{open:y,onClose:()=>k(!1),omit:qe}),e.jsx(Ay,{open:v,initialSection:j,initialTarget:S,pendingImport:I,sections:he,onReviewImport:()=>{g(!1),de("staging")},onStaged:V,onClose:()=>g(!1),onAdded:ue=>{g(!1),H(),D();const Me=ue==="film"?"movies":"library";he[Me]!==!1&&oe(Me,null)},onCaptured:()=>{g(!1),H(),D()},onWorkCreated:H,onOpenMovie:Y}),p&&e.jsx(Zw,{user:t,onUser:s,logout:Fe,onClose:()=>u(!1)}),te&&e.jsx(Mw,{user:t,startStep:te.step,onNavigate:de,onPreferences:o,onClose:()=>J(null)})]})}async function av(){Oo({}),Zl({}),gu(),Gs(),mo()!==Ca&&await El(mo()),Gh(),Lh(),Gu(),Eh.createRoot(document.getElementById("root")).render(e.jsx(Ww,{}))}av();export{Kd as $,on as A,Es as B,mt as C,Pu as D,ke as E,Ae as F,ge as G,Je as H,ht as I,ze as J,tt as K,Si as L,W as M,oi as N,wm as O,Tv as P,wn as Q,Et as R,Po as S,ye as T,Pe as U,Oc as V,Rc as W,Vp as X,Cs as Y,fv as Z,$d as _,Jt as a,id as a$,Fa as a0,Cv as a1,Ev as a2,Ia as a3,Ke as a4,Ma as a5,hm as a6,Ni as a7,br as a8,$o as a9,xn as aA,Pr as aB,_a as aC,Pa as aD,_r as aE,Og as aF,Ig as aG,Rv as aH,Qo as aI,Mo as aJ,Yr as aK,ka as aL,Qd as aM,Is as aN,Jo as aO,Lg as aP,Bo as aQ,Gc as aR,lm as aS,rr as aT,jn as aU,Qn as aV,cd as aW,vn as aX,Un as aY,Ra as aZ,un as a_,rt as aa,dv as ab,$e as ac,Xe as ad,Ov as ae,Bv as af,um as ag,Rt as ah,De as ai,ko as aj,Iv as ak,it as al,Pg as am,_v as an,Mt as ao,Lt as ap,Fv as aq,Pv as ar,ur as as,kv as at,xv as au,Sv as av,jv as aw,vc as ax,Fo as ay,zo as az,Ee as b,Oo as b$,gn as b0,ld as b1,Bt as b2,hv as b3,Cg as b4,vg as b5,wg as b6,Kr as b7,Wr as b8,Vr as b9,Bs as bA,iv as bB,yc as bC,qt as bD,po as bE,Ns as bF,nw as bG,Cm as bH,gu as bI,fu as bJ,Bl as bK,pa as bL,bv as bM,Nc as bN,Em as bO,Vv as bP,xh as bQ,wv as bR,vv as bS,yw as bT,Gv as bU,bt as bV,wh as bW,jm as bX,Fl as bY,jo as bZ,Zl as b_,kt as ba,Vo as bb,dt as bc,Zt as bd,sm as be,Da as bf,Io as bg,mi as bh,In as bi,ci as bj,Ht as bk,ua as bl,rv as bm,pv as bn,Sm as bo,st as bp,jt as bq,ma as br,an as bs,yv as bt,cv as bu,yu as bv,gm as bw,fm as bx,lv as by,bh as bz,Ie as c,sv as c0,cu as c1,dc as c2,Zy as c3,Wv as c4,Dv as c5,qv as c6,Sa as c7,mh as c8,ad as c9,Av as ca,xf as cb,Lv as cc,Hv as cd,eb as ce,ob as cf,Se as cg,il as ch,jd as ci,Yy as cj,Uv as ck,ew as cl,Fi as cm,Mv as cn,Ea as co,$v as cp,zv as cq,tb as cr,bf as cs,uw as ct,$t as cu,gv as cv,ss as cw,Qe as cx,By as cy,Nv as d,le as e,yn as f,yr as g,Ue as h,Aa as i,Z as j,Vn as k,Re as l,We as m,Kn as n,wt as o,uv as p,et as q,mv as r,cn as s,a as t,Nt as u,Tm as v,Cr as w,Yo as x,Sn as y,cr as z};
