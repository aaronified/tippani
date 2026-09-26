const e=`# tippani — Bengali. The format is documented at the top of en.txt beside this
# file, and the short version for a translator is in README.md.
#
# THE STYLE SHEET IS THE LAW: docs/plans/bengali-style.md — the register (চলিত
# ভাষা, আপনি with the pronoun dropped wherever Bengali would drop it), the
# orthography (Kolkata standard) and the term table, including the decision that
# matters more than the rest: a book highlight is উদ্ধৃতি like any quote, a film line is সংলাপ, a
# standalone quote is উক্তি, all three together are উদ্ধৃতি, and টিপ্পনী is the
# brand and the practice, never a countable object. Read §2 and §3 before
# changing a word in here. The v3 pass added its own decisions at the foot of
# that file, under "v3 decisions".
#
# THIS IS NOT A TRANSLATION OF en.txt. Every line was written from what the key
# DOES — the context comment above it and the code that renders it — and many
# lines say a different sentence from the English, because that is the sentence
# a Bengali speaker would use for the same job. Where the English is a bare label
# the Bengali may say what the thing is for; where the English explains, the
# Bengali explains in Bengali order, verb last. Key order, section banners and
# the context comments above each key are en.txt's, so the two files read side
# by side.
#
# NOTHING HERE DECLARES _fallback, on purpose. Bengali is not English's
# translation and English is not Bengali's fallback of last resort; both simply
# ship in the box. A key missing from here reaches a built-in because the chain
# always ends at one, not because en has been named its parent.
#
# TWO MARKERS may live in this file, both as comments ABOVE a key, never inside a
# value — the parser ships everything after the first = to the screen:
#
#   # ?? …   the writer is not sure of this line
#   # !! …   this line is too long for its cap or for the control it sits in
#
#   grep -n '^# [?!][?!]' internal/i18n/bn.txt
#
# Both are temporary. Delete the comment when the doubt is settled or the line is
# cut; a marker left behind is a false alarm somebody has to re-check.
#
# A FEW COMMENTS START WITH "bn:". They record a decision the English side has no
# reason to make — why a type specimen stays Latin, why one Bengali word serves
# two English ones — and are the only comments in here that are not en.txt's.

# How this language is labelled in the picker, in its own words.
_name = বাংলা

# ===========================================================================
# THE LANGUAGE PICKER'S OWN WORDS.
#
# First in the file because they are the first strings a translator needs: the
# row that changes the language, and the label the picker gives their own
# file. Everything after this point is the interface itself, in the order you
# meet it — the frame, then the screens, then the help panel.
# ===========================================================================

# The Settings row that changes the language, in the Appearance card.
settings.language.fallback.en.label = English
settings.language.fallback.bn.label = বাংলা
settings.language.fallback.title = ফিরে যায়
settings.language.fallback.hint = যে লাইনের অনুবাদ এখনো হয়নি, সেটা এই ভাষায় দেখাবে।

settings.language.title = ভাষা
settings.changed.count = {n}টি বদলানো
settings.rail.count.word = বদলানো
settings.section.reset.label = বিভাগ রিসেট
settings.section.reset.tip = {section}-এর প্রতিটি পছন্দ ডিফল্টে ফেরান
settings.section.reset.confirm.title = {section} রিসেট করবেন?
settings.section.reset.confirm.body = এই অংশের সব সেটিং আগের মতো হয়ে যাবে। অন্য অংশে কিছু বদলাবে না।
settings.section.reset.confirm.verb = রিসেট করুন
settings.reset.all.label = সেটিংস রিসেট
settings.reset.all.confirm.title = প্রতিটি বিভাগ রিসেট করবেন?
settings.reset.all.confirm.body.one = একটি পছন্দ ডিফল্টে ফিরে যাবে। আপনার সংগ্রহের কিছু বদলাবে না।
settings.reset.all.confirm.body.other = সেটিংসের সব জায়গা মিলিয়ে {count}টা সেটিং আগের মতো হয়ে যাবে। আপনার সংগ্রহে কিছু বদলাবে না।
settings.reset.all.confirm.verb = সবই রিসেট করুন
settings.section.theme.info.body = অ্যাপ হালকা না গাঢ় দেখাবে, কোন রং, কোন উপাদানের জমিন আর কোন অ্যাকসেন্ট রং — সব এখানে।
settings.section.lang.info.body = অ্যাপ কোন ভাষায় কথা বলবে, কোনো লাইন না থাকলে কোন ভাষায় ফিরবে, আর কোন ফন্টে লেখা দেখাবে।
settings.section.review.info.body = রোজকার কুইজ কোন উদ্ধৃতি থেকে প্রশ্ন নেবে, কটা কার্ড, কতটা কঠিন, আর কখন কোনটা আবার ফিরবে।
settings.section.sections.info.body = অ্যাপের কোন অংশগুলো রাখবেন, আর নেভিগেশনে সেগুলো কোন ক্রমে থাকবে।
settings.section.server.info.body = কোন সংস্করণ চলছে, ব্যাকআপ, আর প্রতিটা রিলিজে কী বদলেছে।

settings.section.aria = কোন সেটিংস বদলাবেন
settings.section.theme.label = থিম
settings.section.lang.label = ভাষা ও ফন্ট
settings.section.review.label = রিভিউ
settings.section.sections.label = বিভাগ
settings.section.server.label = সার্ভার
# The information dot beside that row.
settings.language.info.title = ভাষা
settings.language.info.body = ইংরেজি আর বাংলা অ্যাপেই আছে। অন্য ভাষা চাইলে data/Locales/_TEMPLATE.txt ফাইলটা fr.txt-এর মতো নামে কপি করে অনুবাদ করুন — নতুন করে বিল্ড না করেই এখানে দেখা যাবে।
# Shown under the picker when the stored language names a file that is no longer
# on disk. {code} is what was stored, {name} is the language showing instead.
settings.language.missing = {code} ভাষার ফাইলটা আর নেই — তাই {name} দেখানো হচ্ছে।
# The language chooser on the first-run screen, above the account form.
onboarding.language.title = ভাষা
# One row of the picker: the language's own name, then how complete it is.
# {name} is the language's _name, {percent} is a whole number.
locale.picker.coverage = {name} · {percent}%
# The accessible name of the picker itself, on both screens.
locale.picker.aria = ভাষা বাছুন
# Two languages whose files claim the same _name: the code tells them apart.
# Never a refusal — see localeCatalogue.
locale.picker.disambiguate = {name} ({code})
# The pseudo-locale's row in the picker. It is not a translation: it transforms
# every string that came from a locale file, so any English still hardcoded in
# the source stands out on screen untransformed.
locale.pseudo.name = সিউডো


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

nav.tab.home.label = হোম
# Hover label on the desktop strip, which collapses to icons.
nav.tab.home.tip = আজকের অনুশীলন
nav.tab.library.label = গ্রন্থাগার
nav.tab.library.tip = বইয়ের সংগ্রহ
# The films / shows / games section. Its URL is /catalogue.
nav.tab.movies.label = ক্যাটালগ
nav.tab.movies.tip = সিনেমা, শো আর গেম
nav.tab.quotes.label = উক্তি
nav.tab.quotes.tip = বই-সিনেমার বাইরের কথা
nav.tab.anthologies.label = সংকলন
nav.tab.anthologies.tip = বেছে বেছে জড়ো করা উদ্ধৃতি
nav.tab.tags.label = ট্যাগ
nav.tab.metadata.label = মেটাডেটা
nav.tab.metadata.tip = কভার, মানুষ আর ডুপ্লিকেট
nav.tab.stats.label = পরিসংখ্যান
nav.tab.stats.tip = ক্যালেন্ডার, স্মৃতি, কে কত
nav.tab.settings.label = সেটিংস
# bn: "keys" here is the API-key card, not the keyboard.
nav.tab.settings.tip = চেহারা, API চাবি, ব্যাকআপ
nav.tab.search.label = খোঁজ

# The floating phone nav is icon-only, so each row's name is read aloud rather
# than shown.
nav.bottom.home.aria = হোমে যান, আজকের অনুশীলনে

# The info-dot body under each switch in Settings → Features, saying what the
# section you are about to hide actually holds.
nav.section.library.what = বই, আর বই থেকে তুলে রাখা উদ্ধৃতিগুলো।
nav.section.movies.what = সিনেমা, শো আর গেম — আর সেখান থেকে তুলে রাখা সংলাপ।
nav.section.quotes.what = ভাষণ, চিঠি, প্রবাদ — যে কথার পিছনে কোনও বই বা সিনেমা নেই।
nav.section.anthologies.what = পড়ার ক্রমে সাজানো উদ্ধৃতি, ফাঁকে ফাঁকে নিজের কথা।

# ---------------------------------------------------------------------------
# vocab.* — the word lists that are not sentences. theme.js, fonts.js,
# languages.jsx, credits.jsx, gestures.jsx, ui.jsx's source badges.
# ---------------------------------------------------------------------------

# --- vocab.category.* — what a highlight colour slot is CALLED when the reader
# has not renamed it (Settings → Colours, the colour filters, the Stats
# breakdown). NOT stored: an untouched account holds no name at all, so these are
# presentation and translating them files nothing differently.
# Slot 1, where a quote lands when nobody picked a colour.
# bn: সাধারণ rather than ডিফল্ট — beside five Bengali category names, the loan
# read as the odd one out, and "the ordinary slot" is what this one is.
vocab.category.unset.label = সাধারণ
vocab.category.blue.label = তথ্য
vocab.category.pink.label = দ্বিমত
vocab.category.orange.label = প্রেরণা
vocab.category.green.label = মজার
vocab.category.purple.label = মেটা

# --- vocab.swatch.* — the sixteen colours the category picker offers, as a
# tooltip and an accessible name on each swatch. Colour words, nothing else.
vocab.swatch.sun.label = রোদ
vocab.swatch.amber.label = কমলা
vocab.swatch.rose.label = গোলাপি
vocab.swatch.blush.label = পেঁয়াজি
vocab.swatch.crimson.label = লাল
vocab.swatch.mauve.label = ফিকে বেগুনি
vocab.swatch.violet.label = বেগুনি
vocab.swatch.periwinkle.label = অপরাজিতা
vocab.swatch.sky.label = আকাশি
vocab.swatch.teal.label = ময়ূরকণ্ঠী
vocab.swatch.mint.label = পুদিনা
vocab.swatch.jade.label = পান্না
vocab.swatch.leaf.label = কচি পাতা
vocab.swatch.moss.label = শ্যাওলা
vocab.swatch.clay.label = মেটে
vocab.swatch.stone.label = পাথর

# --- vocab.accent.* — the four app accent colours, named inside a sentence in
# Settings → Appearance ("Use the terracotta accent"), so lower case.
vocab.accent.terracotta.label = পোড়ামাটি
vocab.accent.ochre.label = গেরুয়া
vocab.accent.olive.label = জলপাই
vocab.accent.slate.label = স্লেট

# --- vocab.font-role.* — the six jobs type does in this app, in Settings → Type.
# \`.sample\` is the specimen line, set in the face being offered, so it must be
# text this role would actually carry — not a translation of the English one.
# bn: The display, ui and hand faces are Latin-only; Bengali text in those roles
# falls through to the Bengali face (fonts.js, "the Indic faces sit inside the
# Latin stacks"). So each .what says which script the role governs, and the
# specimens for those three stay Latin — a Bengali specimen would render in the
# Bengali face and show the reader nothing about the face they are choosing.
vocab.font-role.display.label = সব ভাষা
vocab.font-role.display.aria = সব ভাষার উদ্ধৃতি
vocab.font-role.display.what = ভাষা নিজে আলাদা কিছু না বললে উদ্ধৃতি এই হরফেই লেখা হয়।
vocab.font-role.display.sample = It is a truth universally acknowledged
vocab.font-role.ui.label = ইন্টারফেস
vocab.font-role.ui.what = বোতাম, ঘর, যা যা ট্যাপ করেন — তার রোমান হরফ, আর সংখ্যা, ISBN, TMDB id-এর মতো অংশগুলো।
vocab.font-role.ui.sample = Add to quiz · Move to board · Fill gaps
vocab.font-role.mono.label = লেবেল
vocab.font-role.mono.what = ছোট হরফের লাইনগুলো — অধ্যায়-পৃষ্ঠার ঠিকানা, তারিখ, গোনাগুনতি।
# Small caps and figures, which is what this role is for. Keep it that shape.
# bn: Mixed on purpose: this is exactly what the role draws in a Bengali
# interface, and the digits are the part that changes with the face.
vocab.font-role.mono.sample = অধ্যা. 12 · পৃ. 288 · 3 উদ্ধৃতি
vocab.font-role.hand.label = নোট
vocab.font-role.hand.what = মার্জিনে লেখা আপনার নোট, আর রাউন্ড শেষের স্কোর — রোমান হরফে যেটুকু।
vocab.font-role.hand.sample = the bit about the garden
vocab.font-role.bengali.label = বাংলা
vocab.font-role.bengali.what = ইন্টারফেস যেখানেই বাংলা হরফ আঁকে — শিরোনাম, লেবেল, নাম।
# Already Bengali on the English side, and it has to stay Bengali: it is the
# specimen for the Bengali face.
vocab.font-role.bengali.sample = যে জীবন ফড়িঙের দোয়েলের
vocab.font-role.devanagari.label = দেবনাগরী
vocab.font-role.devanagari.what = ইন্টারফেস যেখানেই দেবনাগরী হরফ আঁকে — হিন্দি, মরাঠি, সংস্কৃত।
# Already Devanagari on the English side, for the same reason.
vocab.font-role.devanagari.sample = जो बीत गई सो बात गई

# --- vocab.face.* — the eighteen bundled typefaces, in Settings → Type.
# \`.name\` is the face's own name: DO NOT TRANSLATE it, though transliterating it
# into the reader's script is fine. \`.note\` is the one-line reason to pick it.
vocab.face.newsreader.name = Newsreader
vocab.face.newsreader.note = সঙ্গে যেটা আসে
vocab.face.source-serif-4.name = Source Serif 4
vocab.face.source-serif-4.note = আরও পরিষ্কার, একটু চওড়া
vocab.face.literata.name = Literata
vocab.face.literata.note = অনেকক্ষণ পড়ার জন্য তৈরি
vocab.face.hanken-grotesk.name = Hanken Grotesk
vocab.face.hanken-grotesk.note = সঙ্গে যেটা আসে
vocab.face.inter.name = Inter
vocab.face.inter.note = সাদামাটা, ছোট মাপেও স্পষ্ট
vocab.face.opendyslexic.name = OpenDyslexic
vocab.face.opendyslexic.note = ভারী পা, ডিসলেক্সিয়ার জন্য
vocab.face.public-sans.name = Public Sans
vocab.face.public-sans.note = আরও সাদামাটা, চৌকো ধাঁচ
vocab.face.ibm-plex-mono.name = IBM Plex Mono
vocab.face.ibm-plex-mono.note = সঙ্গে যেটা আসে
vocab.face.jetbrains-mono.name = JetBrains Mono
vocab.face.jetbrains-mono.note = লম্বাটে, বেশি খোলামেলা
vocab.face.source-code-pro.name = Source Code Pro
vocab.face.source-code-pro.note = শান্ত ধাঁচ
vocab.face.caveat.name = Caveat
vocab.face.caveat.note = সঙ্গে যেটা আসে
vocab.face.kalam.name = Kalam
vocab.face.kalam.note = গোলগাল — দেবনাগরীও লেখে
vocab.face.gloria-hallelujah.name = Gloria Hallelujah
vocab.face.gloria-hallelujah.note = ঢিলেঢালা, আরও আটপৌরে
vocab.face.noto-serif-bengali.name = Noto Serif Bengali
vocab.face.noto-serif-bengali.note = সঙ্গে যেটা আসে
vocab.face.hind-siliguri.name = Hind Siliguri
vocab.face.hind-siliguri.note = স্যান্স — সাদামাটা, লাইনে বড় দেখায়
vocab.face.tiro-bangla.name = Tiro Bangla
vocab.face.tiro-bangla.note = চেনা ধাঁচ; 1.15-এর আগে এটাই আসত
vocab.face.noto-serif-devanagari.name = Noto Serif Devanagari
vocab.face.noto-serif-devanagari.note = সঙ্গে যেটা আসে
vocab.face.hind.name = Hind
vocab.face.hind.note = স্যান্স — সাদামাটা, লাইনে বড় দেখায়
vocab.face.tiro-devanagari-hindi.name = Tiro Devanagari Hindi
vocab.face.tiro-devanagari-hindi.note = চেনা ধাঁচ; 1.15-এর আগে এটাই আসত
# A face the reader uploaded themselves, in the same slot as a bundled one's note.
vocab.face.upload.note = নিজের আপলোড

# --- vocab.font-style.* — the modifiers offered per role in Settings → Type.
vocab.font-style.bold.label = বোল্ড
vocab.font-style.italic.label = ইটালিক
vocab.font-style.smallcaps.label = স্মল ক্যাপস
vocab.font-style.allcaps.label = অল ক্যাপস
# \`font-variant-numeric: tabular-nums\` — figures that line up in a column.
vocab.font-style.figures.label = সারিবদ্ধ সংখ্যা

# --- vocab.gesture.* — the seven touch gestures, drawn as a hand with the word
# beside it. It names the gesture, never the instruction: "Long press", not
# "press and hold for half a second".
vocab.gesture.long-press.label = চেপে ধরা
vocab.gesture.swipe-left.label = বাঁয়ে সোয়াইপ
vocab.gesture.swipe-right.label = ডাইনে সোয়াইপ
vocab.gesture.swipe-up.label = উপরে সোয়াইপ
vocab.gesture.swipe-down.label = নিচে সোয়াইপ
vocab.gesture.pinch-in.label = পিঞ্চ ইন
vocab.gesture.pinch-out.label = পিঞ্চ আউট

# --- vocab.tag-style.* — the five shapes a tag chip can take, offered as live
# previews in TagsPage's StylePicker. TAG_STYLES in ui.jsx holds the storage
# tokens and the picker used to draw the token itself, so the chip and its
# tooltip both read the stored word.
#
# EACH NAMES ITS SHAPE, which is what makes them translatable at all: a banner
# is notched on the right, a flyout comes to a point underneath, tape has torn
# edges, a reel is round with sprockets.
# bn: Each names its SHAPE, so the flyout — a pennant notched to a point — is
# নিশান, the word a Bengali reader has for exactly that shape.
vocab.tag-style.sticker.label = স্টিকার
vocab.tag-style.banner.label = ব্যানার
vocab.tag-style.flyout.label = নিশান
vocab.tag-style.tape.label = টেপ
vocab.tag-style.reel.label = রিল

# ---------------------------------------------------------------------------
# common.action.* — THE SHARED VERBS. One key per act, however many objects it
# is performed on: 24 copies of "could not save" is 24 chances for a translator
# to phrase one failure three ways, and the same is true of every verb here.
# \`.busy\` is the transient state of the same button.
# ---------------------------------------------------------------------------

common.action.save.label = সেভ
common.action.save.busy = সেভ হচ্ছে…
# The pencil on a row whose name is already on screen. {field} is that name,
# lower-cased by the caller.
common.action.save.field.aria = {field} সেভ করুন
common.action.cancel.label = বাতিল
common.action.confirm.label = নিশ্চিত করুন
common.confirm.undoable.tag = ফেরানো যাবে
common.confirm.final.tag = ফেরানো যাবে না
common.confirm.undoable.note = এটা বিনে থাকবে, যতক্ষণ না আপনি বিন খালি করছেন — আর টোস্টে সঙ্গে সঙ্গে ফিরিয়ে আনার সুযোগ থাকবে।
common.confirm.final.note = এটা বিনে যাচ্ছে না।
common.action.delete.label = মুছুন
common.action.close.label = বন্ধ করুন
# The × on a window that sits over the screen. {name} is the word above — Close,
# or whatever the caller renamed it to.
common.action.close.window.tip = এই উইন্ডো {name}
common.action.done.label = হয়ে গেছে
common.action.add.label = যোগ করুন
common.action.edit.label = এডিট
common.action.edit.field.aria = {field} এডিট করুন
common.action.copy.label = কপি
common.action.duplicate.label = নকল করুন
common.action.duplicate.sub = সবকিছু নকল করে আরেকটা {kind}
common.action.duplicate.tip = এই উদ্ধৃতির একটা কপি খুলুন — সেভ না করা পর্যন্ত কিছুই লেখা হয় না
common.action.share.label = শেয়ার
common.action.export.label = এক্সপোর্ট
common.action.print.label = প্রিন্ট
common.action.restore.label = ফিরিয়ে আনুন
common.action.apply.label = বসান
common.action.apply.busy = বসানো হচ্ছে…
common.action.undo.label = আনডু
common.action.remove.label = সরান
# The × on a tag pill, a cover candidate, a device row, a search chip. {name} is
# whatever is being taken out, so the sentence is the same in all four places.
common.action.remove.aria = {name} সরান
# bn: Move and Remove would both be সরান; a quote is "sent" to a board — বোর্ডে পাঠান.
common.action.move.label = পাঠান
common.action.reload.label = রিলোড করুন
common.action.upload.busy = আপলোড হচ্ছে…
common.action.load.busy = লোড হচ্ছে…
common.action.fetch.busy = আনা হচ্ছে…
# The verb on a button. The named MODE is quiz.practice.label — English tells the
# two apart with an s and a c, which no other language can reproduce.
common.action.practise.label = ঝালিয়ে নিন
common.action.show.label = দেখান
common.action.hide.label = লুকান
common.action.show-less.label = কম দেখান
common.action.got-it.label = বুঝেছি
# The favourite toggle says what PRESSING it will do, not what the state is.
common.action.favourite.on.label = প্রিয়তে রাখুন
common.action.favourite.off.label = প্রিয় থেকে সরান
# The tick on a card or a row, which names what is being picked.
common.action.select.aria = {name} বাছুন
common.action.deselect.aria = বাছাই তুলুন: {name}
# What the tick calls the thing when its caller did not name it.
common.select.target.fallback = এটা

# Tooltips on a table row's action cell. {noun} is what the row holds.
common.action.copy.row.tip = এই {noun} কপি করুন
common.action.practise.row.tip = এই {noun} ঝালিয়ে নিন
common.action.share.row.tip = এই {noun} শেয়ার করুন
common.action.edit.row.tip = এই {noun} এডিট করুন
common.action.delete.row.tip = এই {noun} মুছুন

# ---------------------------------------------------------------------------
# common.* — the shared component chrome from ui.jsx and works.jsx.
# ---------------------------------------------------------------------------

# The accent strip above a selectable list. {n} is how many are ticked.
common.selection.count.one = {n}টা বাছা হয়েছে
common.selection.count.other = {n}টা বাছা হয়েছে
common.selection.clear.aria = বাছাই তুলে দিন

# --- the calendar. Three-letter month abbreviations, because they sit in a
# 3-column grid and in a one-line date; a language with no short form should use
# whatever fits that grid.
common.month.jan.label = জানু
common.month.feb.label = ফেব
common.month.mar.label = মার্চ
common.month.apr.label = এপ্রি
common.month.may.label = মে
common.month.jun.label = জুন
common.month.jul.label = জুলা
common.month.aug.label = আগ
common.month.sep.label = সেপ
common.month.oct.label = অক্টো
common.month.nov.label = নভে
common.month.dec.label = ডিসে
# A stored partial date, read back at the precision it was kept at.
common.date.month-year.label = {month} {year}
common.date.full.label = {day} {month} {year}
common.date.picker.aria = তারিখ বাছুন
common.date.picker.prev.tip = আগের তারিখগুলো দেখান
common.date.picker.prev.aria = আগের
common.date.picker.next.tip = পরের তারিখগুলো দেখান
common.date.picker.next.aria = পরের
# The heading of the year / month grid is also the way back up a level.
common.date.picker.up.tip = এক ধাপ উপরে উঠুন
common.date.picker.year-range.title = {a}–{b}
# The button that STOPS at a coarser precision — the whole point of a partial date.
common.date.picker.just-year.label = শুধু {year}
common.date.picker.just-month.label = শুধু {month} {year}
common.date.pick.tip = তারিখ বাছুন
# {field} is the name of the field being filled in.
common.date.pick.aria = {field} বাছুন
common.date.pick.field.fallback = তারিখ
# The three shapes a date may be typed in. The letters are a format, not words:
# use whichever letters stand for year, month and day in the reader's language,
# and keep the punctuation and the count of them.
common.field.date.placeholder = YYYY, YYYY-MM বা YYYY-MM-DD
common.field.date.historical.placeholder = 1890, 399 BCE, 1890-03-04
common.field.year.info.title = সাল কীভাবে লিখবেন
common.field.year.info.body = শুধু সাল লিখুন: 1890। খ্রিস্টপূর্ব হলে 380 BCE বা -380। আনুমানিক হলে বাক্সে টিক দিন, বা সামনে "c." লিখুন।
common.field.date.info.title = তারিখ কীভাবে লিখবেন
common.field.date.info.body = শুধু সাল দিলেই চলে: 1890। মাস বা দিন জানা থাকলে যোগ করুন: 1890-03 বা 1890-03-04। ক্যালেন্ডার বোতাম দিয়েও বসানো যায়।
common.field.date.historical.info.body = শুধু সাল দিলেই চলে: 399 বা 1890; খ্রিস্টপূর্ব হলে 399 BCE বা -399। মাস-দিন জানা থাকলে: 1890-03-04। আনুমানিক হলে বাক্সে টিক দিন, বা সামনে "c." লিখুন।
common.field.year.placeholder = যেমন 1920

# --- shelf states. ONE CONCEPT, TWO WORDS: a book is read and a film is
# watched, so every state carries both. A game adds a third and is spelled out
# on both sides because a game only ever lives on the catalogue side.
common.shelf.wishlist.book.label = উইশলিস্ট
common.shelf.wishlist.film.label = উইশলিস্ট
common.shelf.reading.book.label = পড়া চলছে
common.shelf.reading.film.label = দেখা চলছে
common.shelf.playing.book.label = খেলা চলছে
common.shelf.playing.film.label = খেলা চলছে
common.shelf.paused.book.label = থেমে আছে
common.shelf.paused.film.label = থেমে আছে
common.shelf.abandoned.book.label = ছেড়ে দেওয়া
common.shelf.abandoned.film.label = ছেড়ে দেওয়া
common.shelf.completed.book.label = শেষ
common.shelf.completed.film.label = শেষ
# The colour bar under a cover, read aloud. {name} is the shelf state above.
common.shelf.progress.label = {name} — {percent}%
# The badge on the artwork of something you are in the middle of. A game is
# played, and only ever lives on the catalogue side.
common.reading-badge.book.aria = এখন পড়ছেন
common.reading-badge.film.aria = এখন দেখছেন
common.reading-badge.game.aria = এখন খেলছেন
# The ♥ in the corner of a favourited cover. Not a button — the card is.
common.favourite.badge.aria = প্রিয়

# --- the fold on a long description or a long quote.
common.clamp.description.more.tip = গোটা বিবরণ দেখান
common.clamp.text.more.tip = পুরো লেখাটা দেখান

# --- shared field chrome.
common.field.token.placeholder = যোগ করুন…
common.field.select.placeholder = বাছুন…
# A typeable Select: the box at the top of the panel, and the line it shows
# when the typing matches nothing.
common.field.filter.placeholder = লিখে খুঁজুন
common.field.filter.none = কিছু মিলল না
# What a row with nothing in it says, in the inline editors on a work's page.
common.field.inline.placeholder = দেওয়া নেই
common.field.colour.label = রং
# The provenance mark on a field's row, when it can be pressed: it opens what
# each source has for that one field. See fieldOffers.jsx.
common.field.source.open.tip = এই ফিল্ড নিয়ে কে কী বলছে দেখুন

# --- the pop-up form frame.
common.form.close.tip = সেভ না করেই বন্ধ করুন
common.panel.back.aria = {title}-এ ফিরে যান

# --- the information dot.
common.info.default.title = এটা কী
# Announced by the dot itself; the popover carries the payload.
common.info.dot.aria = আরও জানুন: {name}

# --- key caps. The joining word between two keys of a chord ("G then L").
common.kbd.then.label = তারপর
# The word between the two caps of one quiz action in the shortcut sheet, where the
# daily key is followed by the Practice one. Lower case: it labels a cap, not a row.
common.kbd.practice.label = ঝালাই

# --- help, from any screen.
common.help.sheet.title = সাহায্য
common.help.rail.aria = সাহায্যের বিভাগ
# The fold on a help row, over the .more half of every entry that has one. One
# word, lower case, because it sits under the sentence it continues.
common.help.more.label = আরও
# {name} is the screen you are standing on.
common.help.button.tip = এই স্ক্রিনে কী কী আছে — {name}
common.help.button.aria = সাহায্য: {name}

# --- the memory status dot on every quote. The dot names the state and the ONE
# number that matters: how long it keeps, or that it is already owed a look.
common.status.remembered.label = মনে আছে
common.status.forgetting.label = ভুলছেন
common.status.probably-forgotten.label = সম্ভবত ভুলে গেছেন
common.status.unseen.label = এখনও অনুশীলনে ওঠেনি
# {name} is the state above, {detail} the clause after it.
common.status.tip = {name} · {detail}
common.status.new.detail = এই সপ্তাহে যোগ হয়েছে
common.status.due.detail = এখনই দেখে নেওয়ার পালা
# {span} is a compact duration from common.half-life.* below.
common.status.half-life.detail = অর্ধায়ু {span}
# A memory half-life, written as compactly as a locator: these sit in a tooltip
# and in the Stats memory card, and the unit is a single letter on purpose.
common.half-life.hours.label = {n}h
common.half-life.days.label = {n}d
common.half-life.weeks.label = {n}w
common.half-life.months.label = {n}mo

# --- the recall panel behind that dot. THE OWNER'S: "when i click on the spaced
# repetition icon in the quote cards, it should show a popup for the halflife
# status, and recall history". NOT an infodot, on the same instruction — "this is
# not an infodot, btw, so will not be restricted by the budget" — so none of this
# answers to help-budget's caps.
common.recall.title = স্মৃতি
common.recall.half-life.label = অর্ধায়ু
common.recall.due.label = পরের বার
# A quote kept out of the quiz has no next review to name, and "in 12 days" would
# be a promise nothing is going to keep.
common.recall.due.excluded = অনুশীলনীর বাইরে
common.recall.reviews.label = দেখা হয়েছে
common.recall.lapses.label = ভুল হয়েছে
common.recall.history.label = আগের উত্তরগুলো
# When the log is longer than the panel shows. {n} of {total} answers.
common.recall.history.window = মোট {total}টির শেষ {n}টি
common.recall.history.none = এখনও জিজ্ঞেস করা হয়নি
# The three answers in the past tense, because this column is a record rather
# than a button — the quiz's own words for them are quiz.grade.*.
common.recall.result.got.label = পেরেছি
common.recall.result.forgot.label = ভুলে গেছি
common.recall.result.skip.label = বাদ দিয়েছি
# Which deck the answer came from, short enough for a column.
common.recall.mode.daily.label = অনুশীলনী
common.recall.mode.practice.label = ঝালাই
# STANDS WHERE THE HALF-LIFE WOULD, on an answer that moved nothing: practice
# with counting off, or a skip. Printing the number that still stood would say
# the answer produced it.
common.recall.uncounted.label = বদলায়নি
# Once, under a history that holds one of those.
common.recall.uncounted.note = এগুলো রাখা থাকে, তবে এই উত্তরগুলোয় অর্ধায়ু বদলায় না।

# --- the number beside a slider, in the quiz panel. THE WHOLE READOUT IS ONE
# STRING rather than a number with a unit glued to it: the unit used to be written
# ' days', with a leading space no line in this file can carry, and the number does
# not come first in every language. {n} is already formatted to the slider's
# decimals; the plural form is chosen by the same value.
common.slider.multiplier.format = {n}×
common.slider.days.format.one = {n} দিন
common.slider.days.format.other = {n} দিন

# --- the struck flash card on a row the quiz will not draw. {kind} is the word
# for the work it hangs off — book, film, show.
# bn: সমেত attaches to a bare hole; {kind}-এর সঙ্গে would need a marker the frame cannot see.
common.quiz-skip.with-work.label = {kind} সমেত অনুশীলনীতে নেই
common.quiz-skip.alone.label = অনুশীলনীতে নেই

# --- covers and posters.
common.cover.alt = কভার: {title}
common.cover.lightbox.untitled.aria = কভার
common.cover.zoom.tip = কভারটা পুরো স্ক্রিনে দেখুন
common.cover.zoom.aria = পুরো স্ক্রিনে কভার দেখুন: {title}
common.cover.zoom.untitled.aria = পুরো স্ক্রিনে কভার দেখুন
# The word printed across a striped placeholder where artwork would be. It sits
# in a narrow fixed slot in small caps, so shorter is better than accurate.
common.badge.cover = কভার
common.badge.poster = পোস্টার
common.badge.none = নেই
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
# bn: The wordmark is a drawn mark, not copy. Bengali calls the app টিপ্পনী in its
# own prose (shell.onboarding.title, shell.drawer.tagline.label); the logotype
# keeps its script because changing that is a branding decision, not a translation.
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
settings.updates.version.now = আপনি {v}-এ আছেন

# --- the tiles / list / table switch.
common.view.toggle.aria = ভিউ
common.view.tiles.label = টাইল
common.view.list.label = তালিকা
common.view.table.label = টেবিল

# --- tables and filter rows.
common.table.sort.tip = এই কলাম ধরে সাজান
common.filters.label = ফিল্টার
common.filters.genre.aria = ঘরানা ধরে ফিল্টার
common.filters.genre.all.label = সব ঘরানা
common.filters.reset.label = ফিল্টার তুলে দিন
common.sheet.close.tip = এই প্যানেল বন্ধ করুন
common.more.aria = আরও অপশন
common.progress.aria = কতদূর

# --- how a year is written. FOUR MESSAGES rather than a prefix and a suffix,
# because "c." and "BCE" may need to sit on the other side of the number.
common.year.ce.label = {year}
common.year.bce.label = খ্রি.পূ. {year}
common.year.circa.ce.label = আনু. {year}
common.year.circa.bce.label = আনু. খ্রি.পূ. {year}

# --- the colour a quote is filed under.
common.colour.pick.tip = {name} বাছুন
common.colour.current.tip = রং: {name}
common.colour.pick.empty.tip = একটা রং বাছুন

# --- where a metadata row came from.
common.source.detail.tip = {name} · {detail}
common.source.aria = সূত্র: {name}
common.source.state.tip = {name} — {state}

# The mark a proverb board wears in place of a face. {name} is the language.
common.language-mark.aria = {name} ভাষায়

# ---------------------------------------------------------------------------
# vocab.source.* — the metadata suppliers. PROPER NOUNS: DO NOT TRANSLATE.
# Transliterating into the reader's script is fine; renaming is not.
# ---------------------------------------------------------------------------
# TWO PRODUCTS OF ONE COMPANY — see en.txt. Both are Latin brand names and stay so.
vocab.source.google.label = Google Books
vocab.source.google-images.label = Google Images
vocab.source.openlibrary.label = Open Library
vocab.source.wikipedia.label = Wikipedia
vocab.source.wikimedia.label = Wikimedia
vocab.source.fandom.label = Fandom
vocab.source.letterboxd.label = Letterboxd

# The floor under IGDB for games rather than a second opinion, so it is named.
vocab.source.wikidata.label = Wikidata

vocab.source.amazon.label = Amazon
vocab.source.tmdb.label = TMDB
vocab.source.tvdb.label = TheTVDB
# What a row whose supplier the app does not recognise is called.
vocab.source.manual.label = আপনি
# What a row whose supplier the app does not recognise is called.
vocab.source.unknown.label = অজানা সূত্র

# ---------------------------------------------------------------------------
# shell.* — the frame rather than a screen: App.jsx's login box, first run,
# the drawer, both top bars, the update banner, the profile panel.
# ---------------------------------------------------------------------------

# The panel a crashed screen is replaced by. The rest of the app keeps working.
shell.error.boundary.title = এই স্ক্রিনে কিছু একটা গোলমাল হয়েছে
shell.error.boundary.body = বাকি অ্যাপটা ঠিকই চলছে।
# The same line when the crashed area has a name. {name} is that name.
shell.error.boundary.named.body = {name} — বাকি অ্যাপটা ঠিকই চলছে।

# The legend for every keyboard shortcut at once, opened by \`?\`.
shell.shortcuts.title = কীবোর্ড শর্টকাট
shell.shortcuts.intro.prose = প্রতিটা শর্টকাট তার বোতামের গায়েই লেখা, তাই মুখস্থ রাখার দরকার নেই। টাইপ করার সময় শর্টকাট কাজ করে না।
# {mode} is the name of the Practice mode, in bold; {key} is a drawn key cap.
shell.shortcuts.practice.prose = অনুশীলনীর কার্ড তার প্রশ্নের ধরন অনুযায়ী শর্টকাট নেয়। {mode} মোডে সঙ্গে {key} চেপে রাখুন — দৈনিক ডেকের নম্বর পাকা থেকে যায়, তাই বাড়তি বোতামটা কম ঝুঁকির মোডেই।

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

unit.book.one = বই
unit.book.other = বই
# A film, show or game as a row of the catalogue — "title" is what the three have
# in common, and it is what the bulk bar and the wishlist folder count in.
unit.title.one = টাইটেল
unit.title.other = টাইটেল
unit.film.one = সিনেমা
unit.film.other = সিনেমা
unit.show.one = শো
unit.show.other = শো
unit.quote.one = উদ্ধৃতি
unit.quote.other = উদ্ধৃতি
unit.column.one = কলাম
unit.column.other = কলাম
# A quote saved against a book.
unit.highlight.one = উদ্ধৃতি
unit.highlight.other = উদ্ধৃতি
# A quote saved against a film or show. The stored kind is 'dialogue' and the
# WORD is "film line" — this pair composes the bulk toasts, and the typed delete
# phrase the Go server checks is built from the English of it, not from here.
# bn: One word serves both "film line" and "dialogue" — সংলাপ is what a Bengali
# calls a line from a film, and it fits every slot the two English words split.
unit.dialogue.one = সংলাপ
unit.dialogue.other = সংলাপ
unit.entry.one = এন্ট্রি
unit.entry.other = এন্ট্রি
unit.anthology.one = সংকলন
unit.anthology.other = সংকলন
unit.board.one = বোর্ড
unit.board.other = বোর্ড
unit.tag.one = ট্যাগ
unit.tag.other = ট্যাগ
unit.sticker.one = স্টিকার
unit.sticker.other = স্টিকার
unit.item.one = জিনিস
unit.item.other = জিনিস
unit.work.one = উৎস
unit.work.other = উৎস
unit.character.one = চরিত্র
unit.character.other = চরিত্র
work.people.more.one = আরও {n} জন
work.people.more.other = আরও {n} জন
unit.issue.one = সমস্যা
unit.issue.other = সমস্যা
unit.actor.one = অভিনেতা
unit.actor.other = অভিনেতা
# A row of a table, which is what a table's action cell calls the thing it acts on
# when its caller did not name it.
unit.row.one = সারি
unit.row.other = সারি

# The sentence that puts a number in front of one of the words above. ALSO
# EMITTED BY GROUP C (bulkOps.jsx composes it) — same key, same value.
common.count.phrase = {n} {noun}

# ---------------------------------------------------------------------------
# common.* continued — works.jsx: the shelf, the read log, the shared filter
# toolbar, the work tile and its delete confirm.
# ---------------------------------------------------------------------------

# --- the primary credit, whose column is one but whose word depends on the
# medium: a film has a director, a show a creator, a game a studio.
common.field.director.label = পরিচালক
common.field.creator.label = নির্মাতা
common.field.studio.label = স্টুডিও
# The same three as a small-caps badge on a card, in a narrow fixed slot.
common.badge.director = পরি.
common.badge.created-by = নির্মাতা
common.badge.studio = স্টুডিও

# --- the bucket a "group by" view puts the rows with nothing to group on.
common.group.no-series.label = সিরিজ নেই
common.group.no-genre.label = ঘরানা নেই
common.group.unknown-year.label = সাল জানা নেই
common.group.unknown-credit.label = জানা নেই
common.group.none.label = নেই
# A decade heading: 1920 becomes "1920s".
common.group.decade.label = {year}-র দশক
# The tooltip on a group heading that names a person.
common.person.open.tip = এঁর খুঁটিনাটি দেখুন

# --- the in-progress cap. Starting one more than the shelf holds asks first.
# {verb} is the in-progress word for the medium — reading, watching, playing.
# bn: {verb} arrives as the shelf chip's own words (পড়া চলছে / দেখা চলছে), so the
# frame reads "ইতিমধ্যেই 3টা পড়া চলছে" — a full Bengali sentence.
common.work.cap.confirm.title = ইতিমধ্যেই {n}টা {verb}
common.work.cap.confirm.action.label = তবু শুরু করুন
common.work.cap.confirm.body = তাকে একসঙ্গে {n}টা {noun} থাকে। নিচের একটা শেষ করুন — আজকের তারিখে শেষ বলে চিহ্নিত হবে, তারিখটা পরে তার পাতায় ঠিক করে নিতে পারেন — নয়তো এটাও শুরু করে দিন, তাক একটু বেশি ভরুক।
# The date prompt a shelf transition opens.
common.work.shelf-date.hint = যতটা ঠিকঠাক জানেন ততটাই — শুধু সাল দিলেও চলে।

# --- where you are in a work, in the units it is actually counted in. These sit
# in a narrow mono slot: E for episode, S for season, p. for page.
common.position.episode.label = E{a}
common.position.episode-season.label = {a} · S{b}
common.position.page.label = পৃ. {a}/{b}

# --- the progress editor under a work's state chip.
common.progress.editor.title = কতদূর
common.progress.unit.aria = কীসে মাপবেন
common.progress.unit.percent.label = %
common.progress.unit.pages.label = পৃষ্ঠা
common.progress.unit.episodes.label = এপিসোড
common.progress.field.season.label = সিজন
common.progress.field.episode.label = এপিসোড
common.progress.field.page.label = পৃষ্ঠা
# The word between "episode 6" and "10" — 6 OF 10.
# bn: No Bengali word sits between two numerals here; a slash is what a Bengali writes.
common.progress.field.of.label = /
common.action.set.label = রাখুন

# --- the read / watch log.
common.read-log.unknown.label = জানা নেই
# A finished read, as a date range.
common.read-log.range.label = {a} – {b}
# One still open. {a} is the date it was started.
common.read-log.range.open.label = {a} – এখনও চলছে
common.read-log.abandoned.label = (ছেড়ে দেওয়া)
# Why the open row cannot be edited here: the status control above sets it.
common.read-log.open.hint = উপর থেকে বদলায়
# The log's own small lower-case buttons. Lower case is the slot, not a mistake.
common.read-log.edit.label = এডিট
common.read-log.save.label = সেভ
common.read-log.cancel.label = বাতিল
common.read-log.delete.label = মুছুন
common.read-log.add.book.label = আগের একটা পড়া যোগ করুন
common.read-log.add.film.label = আগের একটা দেখা যোগ করুন
common.read-log.started.placeholder = 2009 বা 2009-06-14
common.read-log.finished.placeholder = 2009-06
common.read-log.outcome.finished.label = শেষ হয়েছে
common.read-log.outcome.abandoned.label = ছেড়ে দেওয়া
common.field.started.label = শুরু
common.field.finished.label = শেষ
common.field.outcome.label = কী হল
# --- the shelf chip on a work's page.
# What the chip says when the work has no shelf state yet.
# THE QUESTION A DISMISSAL ASKS when there is something to lose. Every way out
# of a panel used to be unconditional — the ✕, the scrim, Escape, the back
# gesture — so three rows opened and typed into went to one click outside it.
# Counted, because "three fields" is a different decision from "one".
common.unsaved.title = না সেভ করেই বেরোবেন?
common.unsaved.prose.one = একটা ঘরে এমন বদল আছে যা সেভ করা হয়নি। এখন বেরোলে সেটা মুছে যাবে।
common.unsaved.prose.other = {n}টা ঘরে এমন বদল আছে যা সেভ করা হয়নি। এখন বেরোলে সেগুলো মুছে যাবে।
common.unsaved.discard.label = বাদ দিন

# --- the shelf chip on a work's page.
# What the chip says when the work has no shelf state yet.
common.shelf.shelve.label = তাকে তুলুন
common.shelf.wishlist.tip = উইশলিস্টে কেন
common.shelf.wishlist.explainer.prose = এখান থেকে এখনো কোনো উদ্ধৃতি নেই, তাই ইচ্ছে-তালিকায় আছে। উদ্ধৃতি যোগ করলেই নিজে থেকে সরে যাবে। নিচে কোনো তাকে রাখা আলাদা ব্যাপার।
common.shelf.change.tip = তাকের অবস্থা বদলান
# How many times it has been finished, as a multiplier.
common.shelf.reads.label = ×{n}
# bn: The one tip serves books and films alike, so it names the ledger by what it
# records — starts and finishes — rather than by reading or watching.
common.shelf.read-log.tip = শুরু-শেষের খাতা খুলুন

# --- the shelf transitions, named by what pressing one will DO. The word follows
# the medium: a book is read, a film watched, a game played.
common.shelf.move.playing.again.label = আবার খেলুন
common.shelf.move.playing.resume.label = খেলা চালিয়ে যান
common.shelf.move.playing.start.label = খেলা শুরু
common.shelf.move.reading.again.book.label = আবার পড়ুন
common.shelf.move.reading.again.film.label = আবার দেখুন
common.shelf.move.reading.resume.book.label = আবার হাতে নিন
common.shelf.move.reading.resume.film.label = দেখা চালিয়ে যান
common.shelf.move.reading.start.book.label = পড়া শুরু
common.shelf.move.reading.start.film.label = দেখা শুরু
common.shelf.move.paused.label = থামিয়ে রাখুন
common.shelf.move.abandoned.label = ছেড়ে দিন
common.shelf.move.completed.played.label = খেলা শেষ
common.shelf.move.completed.book.label = পড়া শেষ
common.shelf.move.completed.film.label = দেখা শেষ
common.shelf.move.clear.label = তাক থেকে নামিয়ে দিন

# --- the work tile.
common.poster.alt = পোস্টার: {title}
# The count under a tile. A film's rows are called "dialogues" HERE and "film
# lines" in the bulk vocabulary (unit.dialogue) — two words for one row, and the
# tile's is the one in the narrow slot.
common.work-card.count.quote.one = {n} উদ্ধৃতি
common.work-card.count.quote.other = {n} উদ্ধৃতি
common.work-card.count.dialogue.one = {n} সংলাপ
common.work-card.count.dialogue.other = {n} সংলাপ

# --- deleting one work, from its own card. ONE TAP, not a typed phrase: the
# subject is the cover you just pressed and the bin holds it for thirty days.
common.work.delete.confirm.title = {title} মুছবেন?
common.work.delete.confirm.phrase = নিশ্চিত করতে {phrase} লিখে দিন।
common.work.delete.confirm.body.one = এটা তার {n}টা উদ্ধৃতি সমেত বিনে যাবে, একসঙ্গে একটাই জিনিস হিসেবে — ফেরালে একসঙ্গেই ফিরবে। পরের বার্তায় “আনডু” করার সুযোগ থাকে।
common.work.delete.confirm.body.other = এটা তার {n}টা উদ্ধৃতি সমেত বিনে যাবে, একসঙ্গে একটাই জিনিস হিসেবে — ফেরালে একসঙ্গেই ফিরবে। পরের বার্তায় “আনডু” করার সুযোগ থাকে।
# The same confirm for a work nothing is quoted from.
common.work.delete.confirm.body.empty = ডাস্টবিনে যাবে, পরে ফিরিয়েও আনা যাবে। নিচের বার্তায় আনডু থাকবে।
common.work.delete.confirm.action.label = মুছে দিন

# --- the wishlist folder tile: the works you have nothing from yet, in one card.
common.wishlist-folder.tip = যেগুলো থেকে এখনও কিছু তোলা হয়নি — সেই {n}টা
common.wishlist-folder.subtitle.label = এখনও কিছু তোলা হয়নি

# --- the four numbers in a work's hero. {noun} is already the plural.
common.hero.counts.empty.label = এখনও কোনও {noun} নেই
common.hero.counts.favourites.one = {n}টা প্রিয়
common.hero.counts.favourites.other = {n}টা প্রিয়
common.hero.counts.noted.label = {n}টায় নোট
common.hero.counts.tagged.label = {n}টায় ট্যাগ

common.action.back.label = ফিরে যান

# --- the shared filter toolbar. The chip carries the short word and the tooltip
# the sentence, so a chip row can lose its words on a phone and still be readable.
common.filters.favourites.label = ♥ প্রিয়
common.filters.favourites.tip = শুধু প্রিয়গুলো দেখান
common.filters.tagged.label = ট্যাগ করা
common.filters.tagged.tip = শুধু ট্যাগ করা {noun}
common.filters.noted.label = নোট আছে
common.filters.noted.tip = শুধু নোট আছে এমন {noun}
# The three-way wishlist scope. "all" ignores it, "wishlist" shows only the works
# nothing is quoted from, "annotated" hides them.
common.filters.wish.label = উইশলিস্ট
common.filters.wish.all.label = সব
common.filters.wish.all.tip = সব {noun}
common.filters.wish.only.label = উইশলিস্ট
common.filters.wish.only.tip = শুধু যেসব {noun} থেকে এখনও কিছু তোলা হয়নি
common.filters.wish.annotated.label = তোলা আছে
common.filters.wish.annotated.tip = যেসব {noun} থেকে কিছু তোলা হয়নি, লুকান
common.filters.shelf.label = তাক
common.filters.shelf.aria = তাকের অবস্থা ধরে ফিল্টার
common.filters.shelf.all.label = যে কোনও অবস্থা
common.filters.shelf.none.label = তাকে নেই
common.filters.genre.label = ঘরানা
common.filters.only.label = শুধু দেখান
common.filters.sort.label = সাজান
common.filters.sort.aria = সাজান
# {field} is the name of the column being filtered — series, collection, actor.
common.filters.by.aria = {field} ধরে ফিল্টার
common.filters.all.label = সব {field}
# What a book's group of related titles is called, and its plural. A film's is a
# "collection", passed in by the Catalogue.
common.filters.series.noun.one = সিরিজ
common.filters.series.noun.other = সিরিজ
common.filters.credit.noun.one = অভিনেতা
common.filters.credit.noun.other = অভিনেতা
# The live count in a filter sheet's footer.
common.filters.shown.label = {n}টা দেখা যাচ্ছে
common.action.export.shown.tip = যা দেখা যাচ্ছে, এক্সপোর্ট করুন

# ---------------------------------------------------------------------------
# error.* — keyed by WHAT FAILED, never by where. "could not save" had 24 copies
# before this; one key collapses them and makes every remaining distinction a
# deliberate one.
# ---------------------------------------------------------------------------
error.save.generic = সেভ করা গেল না
error.save.read = পড়ার খাতায় এটা সেভ করা গেল না
error.save.watch = দেখার খাতায় এটা সেভ করা গেল না
error.validate.partial-date = YYYY, YYYY-MM বা YYYY-MM-DD — এই তিন আকারের একটায় লিখুন
error.validate.historical-date = সাল, সাল-মাস, বা পুরো তারিখ — "399 BCE" আর "c. 40" দুটোই চলে
error.validate.episodes-total = এই সিজনে কটা এপিসোড?
error.validate.pages-total = বইটায় মোট কটা পৃষ্ঠা?

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
vocab.key.alt.mac.label = ⌥
vocab.key.alt.label = Alt

# ---------------------------------------------------------------------------
# shell.shortcut.* — the keyboard registry. Nothing is listed here that does not
# work, so every one of these is a promise printed on a button and in the legend.
# ---------------------------------------------------------------------------
shell.shortcut.group.anywhere.label = সব জায়গায়
shell.shortcut.group.go-to.label = যাতায়াত
shell.shortcut.group.mcq.label = প্রশ্নোত্তর
shell.shortcut.group.flip.label = উল্টে দেখার কার্ড
shell.shortcut.group.cloze.label = শূন্যস্থান পূরণ
shell.shortcut.group.offer.label = পাশে যা দেওয়া হচ্ছে
shell.shortcut.search.label = খোঁজ
shell.shortcut.capture.label = উদ্ধৃতি তুলে রাখুন
shell.shortcut.help.label = কীবোর্ড শর্টকাট
shell.shortcut.go-home.label = হোমে যান
shell.shortcut.go-library.label = গ্রন্থাগারে যান
shell.shortcut.go-catalogue.label = ক্যাটালগে যান
shell.shortcut.go-quotes.label = উক্তিতে যান
shell.shortcut.go-anthologies.label = সংকলনে যান
shell.shortcut.go-stats.label = পরিসংখ্যানে যান
shell.shortcut.go-metadata.label = মেটাডেটায় যান
shell.shortcut.go-profile.label = প্রোফাইল খুলুন
shell.shortcut.go-settings.label = সেটিংসে যান
shell.shortcut.pick-1.label = প্রথম উত্তরটা বাছুন
shell.shortcut.pick-2.label = দ্বিতীয়টা বাছুন
shell.shortcut.pick-3.label = তৃতীয়টা বাছুন
shell.shortcut.pick-4.label = চতুর্থটা বাছুন
shell.shortcut.reveal.label = উত্তর দেখান
shell.shortcut.grade-forgot.label = ভুলে গেছি
shell.shortcut.grade-got.label = পেরেছি
shell.shortcut.focus-blank.label = শূন্যস্থানে লিখুন
shell.shortcut.offer-accept.label = যা দেওয়া হচ্ছে সেটাই নিন

# A control's tooltip with its key appended. {name} is the tooltip, {key} the cap.
common.shortcut.suffix.label = {name} · {key}
# The Practice form of a quiz key, which asks for one extra finger.
common.shortcut.shifted.label = Shift-{key}

# ---------------------------------------------------------------------------
# undo, and the last-resort failure.
# ---------------------------------------------------------------------------
# The toast every delete answers with. Five words or fewer: it is one glance.
common.toast.deleted.label = মোছা হয়েছে
# And the one undo answers with, from both places that can undo — the toast's own
# button and the selection bar. ONE KEY, because it is one word about one act: the
# migration briefly had two (this and common.toast.restored) and a translator would
# have had to write it twice and been free to disagree with themselves.
common.toast.restored.label = ফিরিয়ে আনা হয়েছে
# The failure of an undo is error.undo.generic, with the other three verbs of the
# selection bar, further down. Kept as one family rather than split between here and
# there for the same reason.
# What errText says when the server sent no message and the caller named no
# failure. The last resort, and it should read as one.
error.generic = কিছু একটা গোলমাল হয়েছে

# The one-word wait every screen shows while a fetch is in flight.
common.state.loading = লোড হচ্ছে…

# The round sticker a quote flows around, on a board that lets you move it.
common.sticker.move.aria = সিল সরান — টেনে নিন, বা তিরচিহ্ন কী ব্যবহার করুন
common.sticker.drag.tip = টেনে সরান

# ---------------------------------------------------------------------------
# error.validate.* for the two typed secrets. ONE MESSAGE PER SECRET rather than
# one sentence with the noun dropped into the front of it: the marker on
# "password" depends on what follows it in Bengali, which a shared sentence
# cannot express.
# ---------------------------------------------------------------------------
error.validate.password.min = পাসওয়ার্ড অন্তত {n} অক্ষরের হতে হবে
error.validate.password.max = পাসওয়ার্ড বড়জোর {n} অক্ষরের হতে পারে
error.validate.password.charset = পাসওয়ার্ডে শুধু অক্ষর, সংখ্যা আর যতিচিহ্ন চলে — অ্যাকসেন্ট-দেওয়া অক্ষর নয়
error.validate.passphrase.min = পাসফ্রেজ অন্তত {n} অক্ষরের হতে হবে
error.validate.passphrase.max = পাসফ্রেজ বড়জোর {n} অক্ষরের হতে পারে
error.validate.passphrase.charset = পাসফ্রেজে শুধু অক্ষর, সংখ্যা আর যতিচিহ্ন চলে — অ্যাকসেন্ট-দেওয়া অক্ষর নয়

# ---------------------------------------------------------------------------
# shell.* continued — App.jsx. The login box, first run, restore-before-login,
# the drawer, both top bars, the update link and the profile panel frame.
# ---------------------------------------------------------------------------

# --- the demo ribbon, on the read-only GitHub Pages build only.
# {link} is a link to the repository, whose words are the key below it.
shell.demo.ribbon.prose = ডেমো · সাজানো ডেটা, শুধু দেখার · আসলটার মতো ঝকঝকে নয় — {link}
shell.demo.ribbon.link.label = নিজের সার্ভারে চালানো অ্যাপটা আরও ঝকঝকে →
shell.demo.roadmap.link.label = রোডম্যাপ →

# --- the login form, shared by first run and every visit after it.
common.field.username.label = ইউজারনেম
common.field.username.placeholder = ইউজারনেম
common.field.password.label = পাসওয়ার্ড
common.field.password.placeholder = পাসওয়ার্ড
common.field.passphrase.label = পাসফ্রেজ
# The signup form's password box, which states the rule up front. {a} is the
# shortest allowed and {b} the longest.
shell.login.password.range.placeholder = পাসওয়ার্ড ({a}–{b} অক্ষর)
shell.login.cta.label = লগ ইন
shell.login.microcopy.prose = ঢুকতে পারছেন না? অ্যাডমিন পাসওয়ার্ড বদলে দিতে পারেন
shell.password.temporary.title = নিজের পাসওয়ার্ড বেছে নিন
shell.password.temporary.prose = যে পাসওয়ার্ডে ঢুকলেন সেটা অ্যাডমিনের দেওয়া। লাইব্রেরি খুলতে এমন একটা পাসওয়ার্ড দিন যা শুধু আপনি জানেন।
# The toast on a successful login. {name} is the account's username.
shell.login.toast.welcome = ফিরে এলেন, {name}
# What the toast calls somebody whose account has no username to read.
shell.login.reader.fallback = পাঠক
shell.login.sso.cta = {name} দিয়ে লগ ইন
# A blocked button prints its reason as a sentence underneath. {reason} is one of
# the error.validate.* messages, and this key is what puts the full stop on it.
common.form.reason.sentence = {reason}।

# --- the first-run screen. The first account becomes the admin.
shell.onboarding.title = টিপ্পনীতে স্বাগত
shell.onboarding.subtitle.prose = এই প্রথম অ্যাকাউন্টটাই হবে অ্যাডমিন।
shell.onboarding.cta.label = অ্যাডমিন অ্যাকাউন্ট তৈরি করুন
shell.onboarding.microcopy.prose = একজন ইউজার তৈরি হলে এই পাতা আর দেখা যাবে না

# --- restoring a backup INSTEAD of creating an account: the moving-to-a-new-box
# path, offered on the first-run screen.
shell.restore.title = অথবা ব্যাকআপ থেকে ফিরিয়ে আনুন
shell.restore.what.prose = ভিতরের সবকিছু ফিরে আসে — অ্যাকাউন্ট, গ্রন্থাগার, সেটিংস — তারপর সেই ব্যাকআপের ইউজারনেম-পাসওয়ার্ড দিয়েই লগ ইন করবেন।
shell.restore.source.aria = কোথা থেকে ফেরাবেন
shell.restore.source.server.label = এই সার্ভার
shell.restore.source.file.label = একটা ফাইল
# {date} is when the archive this server keeps was made, in bold.
shell.restore.server.dated.prose = {date} তারিখের আর্কাইভ
shell.restore.server.empty.prose = এই সার্ভারের ব্যাকআপ ফোল্ডারে কিছু নেই
shell.restore.file.aria = ফেরানোর জন্য ব্যাকআপ ফাইল বাছুন
shell.restore.file.choose.label = ব্যাকআপ ফাইল বাছুন…
shell.restore.passphrase.placeholder = আর্কাইভের পাসফ্রেজ
# The archive was sealed with one account's password. {name} is that account.
shell.restore.password.named.label = ‘{name}’ অ্যাকাউন্টের পাসওয়ার্ড
# bn: "sealed" is encryption, and এনক্রিপ্ট is the word in everyday use for it.
shell.restore.password.placeholder = যে পাসওয়ার্ডে এনক্রিপ্ট করা হয়েছিল
shell.restore.password.recoverable.prose = আর্কাইভটা এই সার্ভারেই তৈরি হয়ে থাকলে সার্ভারের নিজের রিকভারি চাবিতেই খুলবে — তখন ওই অ্যাকাউন্টের যে কোনও পাসওয়ার্ড দিলেই চলে।
shell.restore.password.era.prose = আর্কাইভ যখন তৈরি হয়, তখন ওই অ্যাকাউন্টের যে পাসওয়ার্ড ছিল, সেটা।
shell.restore.unkeyed.prose = এই আর্কাইভ 1.4.1-এর আগের, এতে কোনও চাবি নেই
shell.restore.uploading.busy = আপলোড হচ্ছে… {percent}%
shell.restore.toast.done = ফিরিয়ে আনা হয়েছে · আবার লগ ইন করুন

# --- the two nav landmarks. The drawer already claims "Primary", so the phone's
# floating bar needs a different name or a screen reader lists two of one thing.
shell.nav.primary.aria = মূল
shell.nav.dock.aria = এই স্ক্রিনের কাজগুলো

# --- what the dock's Back key offers when it is HELD rather than pressed: the
# screens behind this one. "Go back to" rather than "Recent", because the list is
# not a history of where you have been — it is a set of destinations, and every
# row is strictly behind you.
shell.nav.back.trail.title = পেছনের স্ক্রিন

# --- the avatar chip, in both top bars and in the drawer's footer.
shell.account.chip.tip = নিজের প্রোফাইল
shell.account.chip.aria = প্রোফাইল — {name}
# The profile screen's own name. It is a route rather than a nav tab, so it has
# no strip entry — the avatar is its door.
nav.tab.profile.label = প্রোফাইল

# --- the ☰ drawer.
shell.drawer.open.tip = মেনু খুলুন
shell.drawer.open.aria = মেনু
shell.drawer.close.aria = মেনু বন্ধ করুন
# The app's name in Bengali, and what the word means. ALREADY BENGALI on the
# English side, and it stays: it is the app naming itself.
shell.drawer.tagline.label = টিপ্পনী · মার্জিনে লেখা কথা
# What the one Add row can reach, as a badge beside it.
shell.drawer.pending.label = যাচাই বাকি ইমপোর্ট
# The Metadata row's badge when the console has nothing to fix.
shell.drawer.metadata.clear.label = সব ঠিক আছে
shell.drawer.stats.streak.label = টানা {n} দিন
shell.drawer.settings.version.label = v{version}
shell.drawer.role.admin.label = অ্যাডমিন · নিজের সার্ভারে
shell.drawer.role.user.label = নিজের সার্ভারে

# --- the ＋ in both top bars, which reads the route it is standing on.
shell.add.work.label = যোগ করুন বা ইমপোর্ট করুন
shell.add.film.label = সিনেমা বা শো যোগ করুন
shell.add.quote.label = উদ্ধৃতি তুলে রাখুন
shell.dock.sections.label = বিভাগ
shell.dock.tools.label = সরঞ্জাম
shell.sheet.grip.aria = এই শিটের মাপ বদলান
shell.totop.aria = উপরে ফিরুন
# The same button when an import is waiting in the pending queue.
shell.add.pending.tip = {n}টা ইমপোর্ট দেখে নেওয়া বাকি
# --- Search, and its global mode (right-click on a desktop).
shell.crumbs.aria = আপনি কোথায় আছেন
shell.search.scope.thisbook = এই বই
shell.search.scope.thisfilm = এই চলচ্চিত্র
shell.search.scope.all = সবকিছু
shell.search.scope.key = এর মধ্যে
shell.search.scope.drop.tip = বরং সবকিছুতে খুঁজুন
shell.search.hint.within = {where} খুঁজুন — লেখক, ট্যাগ, আবছা মনে পড়া একটা লাইন…
shell.search.hint.all = সবকিছু — সব বই, চলচ্চিত্র, উদ্ধৃতি…
shell.search.hint.screen = {where} খুঁজুন — লিখলেই পর্দার জিনিস ছেঁকে আসবে
shell.search.context.leave.tip = বদলে গোটা লাইব্রেরিতে খুঁজুন
shell.search.context.leave.aria = এখন {where} খোঁজা হচ্ছে; গোটা লাইব্রেরিতে খুঁজতে চাপুন
# What each screen calls its own search, named here rather than in the screen so
# the bar and the screen cannot come to disagree about what a place is called.
shell.search.where.settings = সেটিংস
shell.search.where.works = বই আর ছবি
shell.search.where.characters = এই লাইব্রেরির চরিত্র
shell.search.where.people = এই লাইব্রেরির মানুষ
shell.search.aria.screen = {where} খুঁজুন
shell.search.aria.all = সবকিছুতে খুঁজুন

shell.search.global.aria = সব জায়গায় খুঁজুন

# The crashed-screen panel names the screen by its route key, which is not a
# translated word — keep {name} where it lands and translate the frame.
shell.error.boundary.screen.label = {name} স্ক্রিন

# ---------------------------------------------------------------------------
# error.validate.* — what a blocked button says instead of refusing after the
# click. Each is printed as a sentence by common.form.reason.sentence.
# ---------------------------------------------------------------------------
error.validate.username-required = ইউজারনেম লিখুন
error.validate.password-required = পাসওয়ার্ড লিখুন
error.validate.backup-file-required = একটা ব্যাকআপ ফাইল বাছুন
error.validate.backup-absent = এই সার্ভারে কোনও ব্যাকআপ নেই
error.validate.archive-passphrase-required = আর্কাইভের পাসফ্রেজ লিখুন
error.validate.archive-password-required = যে পাসওয়ার্ডে এনক্রিপ্ট করা হয়েছিল, সেটা লিখুন
error.restore.failed = ফিরিয়ে আনা গেল না

# ---------------------------------------------------------------------------
# settings.* — Settings.jsx. The cards migrated in this pass: multi-author
# credits, colour categories, review scope, the Type panel, language marks, the
# quiz panel, Features, button labels and Appearance.
# ---------------------------------------------------------------------------

# --- multi-author credits.
settings.credits.title = একাধিক লেখকের নাম
settings.credits.info.body = “Gaiman & Pratchett”-এর মতো একসঙ্গে লেখা নাম আপনার বাছা চিহ্ন ধরে আলাদা মানুষে ভাগ হয়। বইয়ে লেখা নাম যেমন আছে তেমনই থাকে। নাম “পদবি, নাম” ধাঁচে লিখলে কমা বন্ধ রাখুন।
settings.credits.chip.tip = এই চিহ্ন দেখলে নাম ভাগ হবে
settings.credits.off.prose = ভাগ করা বন্ধ — নামের লাইন যেমন আছে, এক জন মানুষ বলেই ধরা হবে

# --- colour categories. Renaming changes the words and never the stored value.
# Slot 1 has no name, and its dot says so instead of offering a rename.
settings.colours.fixed.tip = কিছু না বাছলে এই রং
settings.colours.fixed.info.title = এটার নাম নেই কেন
settings.colours.fixed.info.body = কোনো রং না বাছলে — ইমপোর্ট করা উদ্ধৃতিতেও — উদ্ধৃতি এখানেই যায়। এর নাম নেই, তবে রংটা বদলানো যায়।
# {name} is the category's current name.
settings.colours.recolour.tip = {name} ঘরের রং বদলান
settings.colours.name.aria = {name} ঘরের নাম
settings.colours.palette.aria = {name} ঘরের রং
settings.colours.offer.aria = এই ঘর দেখান
settings.colours.hide.aria = এই ঘর লুকান
settings.colours.offer.tip = আবার দেখান
# Two categories is the floor, so the second-to-last cannot be hidden.
settings.colours.keep-two.tip = অন্তত দুটো ঘর রাখতেই হয়
settings.colours.hide.tip = আর দেখাবেন না
settings.colours.unmake.aria = {name} মুছে দিন — অ্যাপের নিজের নাম আর রঙে ফিরে যাবে
settings.colours.unmake.tip = অ্যাপের নিজের নাম আর রঙে ফিরিয়ে দিন
settings.colours.unmake.confirm.title = {name} মুছে দেব?
settings.colours.unmake.confirm.body = এর নাম, রং আর দেখানো-লুকোনো অ্যাপের আগের মতো হয়ে যাবে। এই রঙে রাখা উদ্ধৃতি এই রঙেই থাকবে।
settings.colours.unmake.cta = মুছে দিন
settings.colours.reset.aria = এই রং আগের মতো করুন
settings.colours.reset.tip = আগের রঙে ফিরুন

# --- which quotes the quiz draws from. The chip names the SCREEN (nav.tab.*)
# and the tooltip says what that screen's quotes are.
settings.review-scope.title = যেখান থেকে নেওয়া
settings.review-scope.info.title = যেখান থেকে নেওয়া
settings.review-scope.info.body = রোজকার কুইজ আর ঝালাই কোন ধরনের উদ্ধৃতি থেকে প্রশ্ন নেবে, আলাদা আলাদা করে বাছুন। যে উদ্ধৃতিতে বক্তা বা প্রসঙ্গ নেই, আর গত এক সপ্তাহে যা রাখা হয়েছে, সেগুলো বাদ থাকে।
settings.review-scope.books.tip = বইয়ের উদ্ধৃতি
settings.review-scope.movies.tip = সিনেমা, শো আর গেমের সংলাপ
settings.review-scope.quotes.tip = ভাষণ, চিঠি, আর বাকি সব
# The last scope standing cannot be turned off, or the deck empties.
settings.review-scope.stuck.tip = ডেকের অন্তত একটা লাগবে

# --- Settings → Language and font. Four interface roles, three faces each; a
# quote's own face is per language and lives under quote-faces below.
# ভাষা ও ফন্ট পর্দার দলগুলোর নাম।
settings.lang.group.interface.title = ইন্টারফেস
settings.type.own.title = আপনার নিজের ফন্ট
settings.type.faces.title = ইন্টারফেসের ফন্ট
settings.quote-faces.title = উদ্ধৃতির ফন্ট
settings.quote-faces.link.prose = প্রতিটা ভাষার উদ্ধৃতির ফন্ট ঠিক হয় মেটাডেটা › ভাষা-তে, সেই ভাষার বাকি সেটিংসের পাশে।
settings.quote-faces.add.open = ভাষার তালিকা খুলুন
settings.type.added.title = যোগ করা ফন্ট
settings.type.added.sub = প্রতিটা নিজের চেহারাতেই দেখানো
settings.type.added.none = এখনও কিছু নেই — নিচে একটা আপলোড করুন
settings.type.add.title = একটা ফন্ট যোগ করুন
settings.type.add.sub = woff2, woff, otf বা ttf — এটা এই সার্ভারেই থাকে
settings.type.add.action = ফন্ট আপলোড করুন
settings.type.style.aria = {name}-এর স্টাইল
# WHOSE INTERFACE these faces are for. '' is the answer every UI language
# inherits; a code is that language's own. Not "English" — the inherited answer
# applies in every language, and English can overrule it like any other.
settings.type.faces.sub = {language} যে হরফে লেখা হয়। অন্য ভাষার জন্য উপরে ভাষা বদলান।
settings.type.scope.revert.aria = {name}-এর জন্য সব ভাষার ফন্টেই ফিরুন
settings.type.scope.revert.tip = সবার জন্য যেটা, সেটাতেই ফিরুন
settings.type.style.title = স্টাইল
settings.type.face.aria = {name} লেখার ফন্ট
settings.type.face.filter.placeholder = ফন্টের নাম লিখুন
settings.type.font.remove.tip = এই ফন্ট সরান
settings.type.font.remove.confirm = {name} সরাবেন? যে কাজে এটা বসানো আছে, সেখানে অ্যাপের নিজের ফন্ট ফিরে আসবে।
# Shown when an uploaded face measures as though it does not draw the script the
# role needs. A warning and not a refusal. {field} is the script's name.
settings.type.script-warning.prose = এই ফন্টে হয়তো {field} লেখা যায় না। তবু বসানো হলো — নিচের লেখায় চৌকো ঘর দেখা গেলে কারণ এটাই।
# The script a role needs when the role does not name one.
vocab.script.latin.label = রোমান

# --- Settings → Language marks. The mark a proverb board wears.
# মেটাডেটা উৎস পাতার কার্ড: দরজাটা কীসের জন্য, আর দরজার নিজের কথা।
settings.languages.glyphs.aria = {name} ভাষার লিপির অক্ষর
settings.languages.no-script.prose = {name} ভাষার জন্য কোনও লিপির অক্ষর নেই — নিচে নিজের একটা চিহ্ন দিন।
# The reader's own marks, and how many of the allowance are used. {done}/{total}.
settings.languages.mark.remove.aria = {field} থেকে {name} সরান
settings.languages.full.prose = {name} ভাষার নিজের চিহ্ন বড়জোর {n}টা — নতুন দিতে হলে একটা সরান।
settings.languages.order.title = মূলের কতটা
settings.languages.order.custom.tip = কিছু ভাষার আলাদা সেটিং আছে; এটা বদলালে সেগুলোও এর সঙ্গে মিলে যাবে।
vocab.textorder.trans-only.label = শুধু অনুবাদ
vocab.textorder.trans-first.label = আগে অনুবাদ
vocab.textorder.quote-first.label = আগে উদ্ধৃতি
vocab.textorder.quote-only.label = শুধু উদ্ধৃতি
settings.languages.remove.in-use.tip = {name} ব্যবহারে আছে — আপনার উদ্ধৃতি বা বই এই ভাষায় রয়েছে
# Renaming a language is a DISPLAY name. The stored name stays and is shown
# beside it, so "why does my Bangla board say Bengali" stays answerable.
# What this language's QUOTES are set in — every face the app ships, because the
# question is "what does my German look like" and the answer may be a sans or a
# hand. "Follows the card" is a real answer and so is an option, not a clear button.
settings.languages.face.inherit = উদ্ধৃতির ফন্ট মেনে চলে
settings.languages.face.aria = {name} ভাষার উদ্ধৃতির ফন্ট
settings.languages.add.label = ভাষা যোগ করুন
settings.languages.name.label = ভাষার নাম
settings.languages.order.all.label = সব ভাষা
settings.languages.order.own.label = নিজস্ব সেটিং
settings.languages.key.quote = উদ্ধৃতি, যেমন লেখা
settings.languages.key.trans = অনুবাদ
settings.languages.edit.aria = {name} এডিট করুন: নাম, কোড আর চিহ্ন
settings.languages.iso.label = ISO 639-3 কোড
settings.languages.iso.none = ISO কোড নেই
settings.languages.iso.link.label = কোড যুক্ত করুন
settings.languages.iso.change.label = বদলান
settings.languages.iso.clear.aria = ISO কোড সরিয়ে দিন
settings.languages.iso.search.placeholder = নাম বা কোড, যেমন Sylheti বা syl
settings.languages.iso.nomatch = ISO 639-3-এ এর সঙ্গে মেলে এমন কোনও ভাষা নেই।
settings.languages.iso.type.extinct = বিলুপ্ত
settings.languages.iso.type.ancient = প্রাচীন
settings.languages.iso.type.historical = ঐতিহাসিক
settings.languages.iso.type.constructed = কৃত্রিম
settings.languages.iso.type.macro = ভাষাগুচ্ছ
settings.languages.add.search.label = ভাষা খুঁজুন
settings.languages.add.free = কোড ছাড়াই “{name}” যোগ করুন
settings.languages.mark.title = উক্তির কার্ডে এর চিহ্ন
settings.languages.add-mark.aria = নিজের একটা চিহ্ন যোগ করুন
settings.languages.reset.label = চিহ্ন আর নাম আগের মতো করুন
settings.languages.remove.label = ভাষাটা সরান
settings.languages.remove.confirm.title = {name} সরাবেন?
settings.languages.remove.confirm.body = এর চিহ্ন, নাম আর কোড মুছে যাবে। কোনও উক্তি বদলাবে না।

# --- the quiz panel.
settings.quiz.group.deck.title = কুইজ আর তার প্রশ্ন
settings.quiz.group.schedule.title = সময়সূচি
settings.quiz.group.practice.title = অনুশীলন
settings.quiz.skipped.aside = উদ্ধৃতি ধরে ধরে
settings.quiz.per-day.label = দৈনিক ডেক
settings.quiz.in-depth.tip = গুণক আর বাঁধা সিঁড়ি
settings.quiz.panel.title = সময়সূচির পিছনের সংখ্যাগুলো
settings.quiz.tuning.changed.aside = বদলানো
# {name} is the deck — Daily quiz, or Practice.
settings.quiz.deck.title = {name} যা জিজ্ঞেস করে
settings.quiz.deck.question.aria = {question} — {name}
settings.quiz.deck.daily.info.body = রোজকার কুইজের প্রতিটা উত্তর সার্ভার মিলিয়ে দেখে, তাই নিজে নম্বর দেওয়ার ফ্লিপ কার্ড এখানে নেই।
settings.quiz.deck.practice.info.body = ঝালাই শুরু হয় ফ্লিপ কার্ড দিয়ে, তারপর বাকিগুলো মিশিয়ে। “প্র্যাকটিস গোনা হয়” চালু থাকলে ফ্লিপ কার্ড বাদ যায়, কারণ নিজে দেওয়া নম্বর কেউ যাচাই করে না।
settings.quiz.practice-counts.title = প্র্যাকটিস গোনা হয়
settings.quiz.practice-counts.aria = ঝালাইতেও দিনপঞ্জি বদলায়
settings.quiz.practice-counts.info.body = বন্ধ থাকলে ঝালাই শুধু পড়াশোনা। চালু করলে ঝালাইয়ের ঠিক উত্তরেও রোজকার কুইজের মতো পরের বার আসার ফাঁক বাড়ে।
settings.quiz.submit.title = প্রতিটা উত্তর নিশ্চিত করুন
settings.quiz.submit.aria = প্রতিটা উত্তর নিশ্চিত করুন
settings.quiz.submit.info.body = বন্ধ থাকলে ছুঁলেই উত্তর হয়ে যায়। চালু থাকলে ছুঁলে শুধু বাছা হয়, “জমা দিন” চাপলে তবে উত্তর — মত বদলানোর সুযোগ থাকে। ফ্লিপ কার্ডে কোনো তফাত নেই।
# bn: অ্যাডাপ্টিভ is the word a Bengali actually says of a thing that adjusts to you;
# the coinages (মানানসই, অভিযোজী) need decoding first.
settings.quiz.adaptive.title = অ্যাডাপ্টিভ ফাঁক
settings.quiz.adaptive.aria = অ্যাডাপ্টিভ ফাঁক
settings.quiz.adaptive.info.body = অ্যাডাপ্টিভ (শুরুর ব্যবস্থা): ঠিক উত্তরে ফাঁক আড়াই গুণ হয়, ভুলে অর্ধেক। সিঁড়ি: বাঁধা ধাপ ৭ → ৩০ → ১০০ → ৩৬৫ দিন, আর ভুল হলেই আবার ৭-এ।
settings.quiz.adaptive.ladder.label = সিঁড়ি
settings.quiz.adaptive.on.label = অ্যাডাপ্টিভ
settings.quiz.skipped.title = কখনও জিজ্ঞাসা করা হয় না
settings.quiz.skipped.none = কিছুই বাদ পড়েনি। আপনার রাখা প্রতিটি উদ্ধৃতি ডেকে আছে।
settings.quiz.skipped.word = বাদ
settings.quiz.quotes.word.one = উক্তি
settings.quiz.quotes.word.other = উক্তি
settings.quiz.works.word.one = রচনা
settings.quiz.works.word.other = রচনা
settings.quiz.skipped.in = —
settings.quiz.skipped.standalone = নিজের মতো
settings.quiz.skipped.restore-work.label = {n}টি ফেরান
settings.quiz.skipped.restore-one.aria = এটি ডেকে ফিরিয়ে দিন
settings.quiz.skipped.chosen = {n}টি বাছা
settings.quiz.skipped.clear.label = বাছাই মুছুন
settings.quiz.skipped.pick-work.aria = {title} থেকে বাদ পড়া সবকিছু বাছুন
settings.quiz.skipped.pick-one.aria = বাদ পড়া এই উদ্ধৃতিটি বাছুন

settings.quiz.start.title = নতুন লাইন শুরু হয়
settings.quiz.start.info.body = নতুন উদ্ধৃতি কোথা থেকে শুরু করবে। “দেখা হয়নি” হলে তাড়াতাড়ি আর ঘনঘন আসে; “আয়ত্ত” হলে কালেভদ্রে — আগে থেকে জানা সংগ্রহের জন্য। যেকোনোটাতেই ভুল করলে আবার ঘনঘন আসবে।
settings.quiz.start.unseen.label = দেখা হয়নি
settings.quiz.start.mastered.label = আয়ত্ত

settings.quiz.tier.title = প্রশ্ন কতটা কঠিন
settings.quiz.tier.info.body = মাঝারিই শুরুর মাত্রা। সহজে চারের বদলে দুটো, স্পষ্ট আলাদা বিকল্প; কঠিনে কথাগুলো বেশি টাইপ করতে হয়; এলোমেলোয় প্রতি কার্ডে আলাদা মাত্রা।
settings.quiz.tier.easy.label = সহজ
settings.quiz.tier.medium.label = মাঝারি
settings.quiz.tier.hard.label = কঠিন
settings.quiz.tier.random.label = এলোমেলো
settings.quiz.tier.easy.note = চারের বদলে দুটো, স্পষ্ট আলাদা বিকল্প। কাছাকাছি ভুল বিকল্পগুলো থাকে না — অথচ ওগুলো থেকেই সবচেয়ে বেশি শেখা যায়।
settings.quiz.tier.medium.note = চারটে বিকল্প, কয়েকটা কাছাকাছি; আর টাইপ করতে হয় শুধু ছোট লাইনে।
settings.quiz.tier.hard.note = বেশিরভাগই কথাগুলো টাইপ করে লিখতে হয়; নইলে চারটে বিকল্প, সবকটাই ঠিক মনে হয়।
settings.quiz.tier.random.note = প্রতি কার্ডে আলাদা মাত্রা, যাতে কোনো এক ধরনের প্রশ্নে অভ্যস্ত না হয়ে পড়েন।
settings.quiz.seen.title = চোখে পড়লে অর্ধায়ু বাড়ে
settings.quiz.seen.label = চোখে পড়লে অর্ধায়ু বাড়ে
settings.quiz.seen.info.body = কোনো উদ্ধৃতি শেয়ার করলে, প্রিয়তে রাখলে, বা রোজকার কুইজে বিকল্পের মধ্যে চোখে পড়লে পরের বার আসার ফাঁক একটু বাড়ে। ঝালাই এখানে ধরা হয় না। 1.0× দিলে এটা বন্ধ।
settings.quiz.tuning.info.body = প্রতিটা উত্তরে একটা উদ্ধৃতির ফাঁক কতটা বাড়বে বা কমবে। সীমা বাঁধা আছে, যাতে ভুল মানে একই উদ্ধৃতি নিঃশব্দে বারবার ফিরে না আসে।
settings.quiz.reset.label = আগের মতো করুন
settings.quiz.reset.tip = এই প্যানেলের সব বদল ফিরিয়ে দিন

# --- Settings → Features. Hiding a section is cosmetic: it takes away the doors.
settings.features.locked.prose = শেষ বিভাগটা থাকতেই হবে — আগে অন্য একটা চালু করুন।
settings.features.show.label = দেখান
settings.features.hide.label = লুকান

settings.features.order.title = আমাকে দেখাও, এই ক্রমে
settings.features.order.prose = সাইডবার, মেনু আর ＋ বোতামে এই ক্রমই থাকে। সবার ওপরেরটায় অ্যাপ খোলে।
settings.features.order.drag.aria = {name} সরাতে টানুন
settings.features.order.up.aria = {name} উপরে নিন
settings.features.order.down.aria = {name} নিচে নিন

# --- button labels: whether a glyph shows its words.
settings.labels.title = বোতামের লেখা
settings.labels.info.title = বোতামের লেখা
settings.labels.info.body = আইকনওয়ালা বোতামে লেখাটাও দেখাবে কি না। অটো হলে ডেস্কটপে দেখায়, ফোনে লুকায়। লুকোনো লেখা স্ক্রিন রিডার তবু পড়ে, আর মাউস রাখলে বা চেপে ধরলে প্রতিটা আইকন নিজের নাম বলে।
settings.labels.auto.label = অটো

# --- Appearance.
settings.search.none = “{q}”-এর সঙ্গে সেটিংসের কিছু মিলছে না।
settings.appearance.group.light.title = আলো আর অন্ধকার
settings.appearance.group.material.title = কী দিয়ে গড়া
settings.appearance.matset.title = উপকরণের সেট
settings.appearance.matset.hint = চারটে তল: পেছনের পাতা, প্যানেল, লেখার পাতা আর মলাট।
settings.appearance.matset.info.body = প্রতিটা সেট চারটে তলের জমিন ঠিক করে, হালকা-গাঢ় দুটোতেই চলে। অলিন্দে কোনো জমিন নেই, তাই সবচেয়ে দ্রুত।
settings.appearance.group.saved.title = আপনার নিজের থিম
settings.appearance.group.saved.aside = {cap}-এর মধ্যে {n}টি সংরক্ষিত

settings.appearance.theme.title = আপনি কোনটা দেখেন
settings.appearance.theme.hint = “সিস্টেম যেমন” বাছলে আপনার যন্ত্রের সেটিং মেনে চলে।
settings.appearance.theme.light.label = হালকা
settings.appearance.theme.dark.label = গাঢ়
settings.appearance.match.label = সিস্টেম যেমন
settings.appearance.match.aria = সিস্টেমের থিম মেনে চলুন
settings.appearance.contrast.title = কনট্রাস্ট
settings.appearance.colours.title = রং
settings.appearance.colours.hint = একটা হালকা ব্যাকগ্রাউন্ড, একটা গাঢ়, আর দুটোর একই অ্যাকসেন্ট রং। এখন পর্দায় যেটা, সেটাই বদলাচ্ছেন।
settings.appearance.colours.light.label = দিন
settings.appearance.colours.dark.label = রাত
settings.appearance.colours.accent.label = বাঁধাই
settings.appearance.colours.light.aria = দিনের জমি — {name}
settings.appearance.colours.dark.aria = রাতের জমি — {name}
settings.appearance.colours.accent.aria = বাঁধাইয়ের রং — {name}
settings.appearance.colours.light.title = দিনের জমি
settings.appearance.colours.dark.title = রাতের জমি
settings.appearance.colours.accent.title = বাঁধাইয়ের রং
settings.appearance.colours.hide.aria = বিকল্পগুলো লুকোন
settings.group.access.title = অভিগম্যতা
settings.features.covers.title = বইয়ের প্রচ্ছদ
settings.features.posters.title = ক্যাটালগের পোস্টার
settings.features.sizes.aside = শুধু এই ডিভাইসে

settings.appearance.ground.info.body = পেছনের রং তিন পরতে: পুরো পাতা, প্যানেল, আর যে কার্ডে উদ্ধৃতি থাকে। হালকা আর গাঢ় আলাদা করে ঠিক হয়; এখন যেটা পর্দায় আছে, এই সারি সেটাই বদলায়।
settings.appearance.phys.title = উপকরণ আলো নিয়ে যা করে
settings.appearance.phys.readout = {n}%
settings.appearance.phys.open.tip = কোনো উপকরণ কীভাবে আলো ধরে তা বদলান
settings.appearance.phys.info.body = আপনার সেটের চারটে উপাদান আলোয় কেমন সাড়া দেবে, প্রত্যেকটার জন্য আলাদা। পাথরে ছোট উজ্জ্বল ঝলক, পশমে ছড়ানো ম্লান আলো।
settings.appearance.phys.hard.label = কাঠিন্য
settings.appearance.phys.sss.label = ভিতর দিয়ে দীপ্তি
settings.appearance.phys.diff.label = রঙের বিস্তার
settings.appearance.phys.refl.label = ঘর প্রতিফলন
settings.appearance.phys.reset.aria = {name} কারখানার মানে ফেরান
settings.appearance.phys.none = এই সেটের কোনো খাঁজে উপকরণ নেই, তাই বদলানোর কিছু নেই।
settings.appearance.glass.title = সত্যিকারের কাচ
settings.appearance.saved.title = আপনার সংরক্ষিত চেহারা
settings.appearance.saved.hint = দুটো ব্যাকগ্রাউন্ড, অ্যাকসেন্ট রং আর উপাদান-সেট একসঙ্গে রাখা।
settings.appearance.saved.file.title = থিম ফাইল
settings.appearance.saved.file.hint = এখনকার চেহারাটা ফাইলে নিন, বা অন্য কারোটা বসিয়ে দিন।
settings.appearance.phys.open.sub = {what} — {dials}
settings.appearance.phys.count.aside.one = {n}টা ডায়াল
settings.appearance.phys.count.aside.other = {n}টা ডায়াল
settings.appearance.phys.open.label = নবগুলো খুলুন
settings.appearance.saved.info.body = দুটো ব্যাকগ্রাউন্ড, অ্যাকসেন্ট রং, উপাদান-সেট আর তার সব মাপ একসঙ্গে রাখা থাকে — এক ছোঁয়ায় চেহারা বদলানো যায়। প্রতি প্রোফাইলে চারটে পর্যন্ত।
settings.appearance.saved.none = এখনও কিছু সংরক্ষিত নেই। যা পরে আছেন তার নাম দিন, এখানে থাকবে।
settings.appearance.saved.name.placeholder = এই চেহারার নাম
settings.appearance.saved.name.aria = আপনি যা পরে আছেন তার নাম
settings.appearance.saved.save.label = এই চেহারা সংরক্ষণ
settings.appearance.saved.full = চারটিই সীমা। আরেকটি রাখতে একটি সরান।
settings.appearance.saved.remove.aria = {name} সরান
settings.appearance.saved.export.label = রপ্তানি
settings.appearance.saved.export.default = আমার চেহারা
settings.appearance.saved.import.label = আমদানি
settings.appearance.saved.import.unnamed = আমদানি করা
settings.appearance.saved.import.parse = ফাইলটি থিম হিসেবে পড়া যাচ্ছে না।
settings.appearance.saved.import.kind = এটি JSON, কিন্তু তিপ্পনীর থিম নয়।
settings.appearance.saved.import.version = থিমটি নতুন তিপ্পনীর লেখা।
settings.appearance.saved.import.shape = থিম ফাইলে কিছু নেই।
settings.appearance.glass.on.label = চালু
settings.appearance.glass.off.label = বন্ধ
settings.appearance.glass.hint = বন্ধ রাখলে যন্ত্রের ওপর চাপ কম। যন্ত্রে নড়াচড়া কমানোর সেটিং চালু থাকলে এটা সবসময় বন্ধ থাকে।
settings.appearance.glass.info.body = পেছনের জিনিস ঝাপসা না করে বাঁকিয়ে দেখায় এমন কাচ। প্রতিবার স্ক্রল করতে যন্ত্রকে খাটতে হয়, তাই শুরুতে বন্ধ।
settings.appearance.glass.dials.title = কাচ নিজে
settings.appearance.glass.clarity.label = কতটা স্বচ্ছ
settings.appearance.glass.refract.label = কতটা বাঁকায়
settings.appearance.glass.bevel.label = কিনারা কত চওড়া
settings.appearance.glass.fringe.label = ধারে রামধনু
settings.appearance.glass.gain.label = বাঁক কত খাড়া
settings.appearance.glass.blur.label = পিছনের কোমলতা
vocab.tile.paper.label = কাগজ
vocab.tile.paper-photo.label = ফোটো কাগজ
vocab.tile.cardboard.label = কার্ডবোর্ড
vocab.tile.linen.label = লিনেন
vocab.tile.cotton.label = সুতি
vocab.tile.canvas.label = ক্যানভাস
vocab.tile.denim.label = ডেনিম
vocab.tile.wool.label = উল
vocab.tile.fabric.label = কাপড়
vocab.tile.leather.label = চামড়া
vocab.tile.leather-suede.label = সুয়েড
vocab.tile.leather-pebbled.label = দানাদার চামড়া
vocab.tile.leather-tooled.label = খোদাই চামড়া
vocab.tile.wood.label = কাঠ
vocab.tile.walnut.label = আখরোট কাঠ
vocab.tile.pine.label = পাইন
vocab.tile.marble.label = মার্বেল
vocab.tile.granite.label = গ্রানাইট
vocab.tile.sandstone.label = বেলেপাথর
vocab.tile.concrete.label = কংক্রিট
vocab.tile.metal.label = ধাতু
vocab.tile.brushed.label = ব্রাশ করা ইস্পাত
vocab.tile.satin.label = সাটিন
vocab.tile.matte.label = ম্যাট
vocab.tile.rubber.label = রাবার
vocab.tile.glass.label = কাচ
vocab.tile.glass-soft.label = নরম কাচ
vocab.ground.cream.label = ক্রিম
vocab.ground.white.label = সাদা
vocab.ground.sepia.label = সেপিয়া
vocab.ground.grey.label = হালকা ধূসর
vocab.ground.night.label = রাত
vocab.ground.ink.label = কালি
vocab.ground.soot.label = কাজল
vocab.ground.tobacco.label = তামাক
settings.appearance.contrast.aria = কনট্রাস্ট
settings.appearance.contrast.more.label = বেশি
settings.appearance.contrast.hint = বেশি কনট্রাস্টে রেখাগুলো গাঢ় হয়, কাগজের দানা সরে যায়। “সিস্টেম যেমন” বাছলে যন্ত্রের সেটিং মেনে চলে।
# --- চেহারা -> উদ্ধৃতির নিজের দুটি পড়ার ডায়াল (§৬ প্রবেশগম্যতা)।
settings.appearance.quote-leading.label = উদ্ধৃতির লাইনগুলির মধ্যে ফাঁক
settings.appearance.quote-leading.aria = উদ্ধৃতির লাইনগুলোর মধ্যে ফাঁক
settings.appearance.quote-leading.tight = ঠাসা
settings.appearance.quote-leading.snug = ঘন
settings.appearance.quote-leading.normal = স্বাভাবিক
settings.appearance.quote-leading.relaxed = খোলা
settings.appearance.quote-leading.loose = ঢিলা
settings.appearance.quote-measure.label = উদ্ধৃতি কত চওড়ায় চলে
settings.appearance.quote-measure.aria = উদ্ধৃতির একটি লাইন কত লম্বা হতে পারে
settings.appearance.quote-measure.full = পুরো চওড়া
settings.appearance.quote-measure.chars = {n}টি অক্ষর
settings.appearance.quote-leading.info.body = উদ্ধৃতির লাইনগুলোর মধ্যে ফাঁক। শুধু উদ্ধৃতিতেই খাটে, অ্যাপের বাকি লেখায় নয়।
settings.appearance.quote-measure.info.body = উদ্ধৃতির এক লাইনে কটা অক্ষর ধরবে, তারপর পরের লাইনে যাবে। লম্বা লেখার জন্য ৪৫ থেকে ৭৫ পড়তে সবচেয়ে আরাম।
# --- Appearance -> Material. Seven sets, each naming what four surfaces are
# made of: the desk under everything, the furniture, the page you read, the
# binding on a cover. Independent of light/dark -- every set works in both -- so
# these are PLACES, not moods. Translate each as the room it is, not word for
# word: the English is already the room's name rather than a description.
settings.material.manuscript.label = পাণ্ডুলিপি
settings.material.film-assembly.label = চলচ্চিত্রের রিল
settings.material.office.label = অফিস
settings.material.school.label = ইস্কুল
settings.material.atelier.label = তাঁতঘর
settings.material.bindery.label = বাঁধাইয়ের দোকান
settings.material.quarry.label = খাদান
settings.material.atrium.label = অলিন্দ
# {name} is one of the vocab.accent.* words.
settings.appearance.accent.aria = {name} অ্যাকসেন্ট
settings.features.book-size.label = গ্রন্থাগারের কভারের মাপ
settings.features.film-size.label = ক্যাটালগের পোস্টারের মাপ

# The global dial. It RENORMALISES rather than multiplying: moving it writes
# itself into all four kinds (type.js).
settings.appearance.text-size.label = লেখার মাপ
settings.appearance.text-size.info.body = সব লেখা একসঙ্গে বড়-ছোট করে। তারপর “ফন্ট”-এ গিয়ে আলাদা আলাদা করে ঠিক করা যায়।
settings.type.size.factor = {n}%
# What the global dial reads when the four kinds no longer agree. An em dash,
# deliberately not a word: it is the absence of one answer, not a state.
settings.type.size.mixed = —
settings.type.size.aria = {name} লেখার মাপ

# --- yes / no, the two words every switch in the quiz panel uses.
vocab.yes.label = হ্যাঁ
vocab.no.label = না

error.delete.font = ফন্টটা সরানো গেল না
# A language may keep only so many marks of its own. {name} is the language,
# {n} the allowance.


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

# bn: The ten epigraphs are the app's thesis, written as Bengali aphorisms in the
# same clipped shape rather than translated.
greeting.epigraph.1 = মার্জিন একটা কথা দিয়ে রাখে: জবাব দেওয়ার জায়গা সবসময় থাকবে।
greeting.epigraph.2 = বই লেখকের। মার্জিন আপনার।
greeting.epigraph.3 = পাশে কিছু না লিখলে কোনও পড়াই আসলে পড়া হয় না।
greeting.epigraph.4 = যে উদ্ধৃতি আর খুঁজে পাবেন না, সেটা আসলে রাখাই হয়নি।
greeting.epigraph.5 = দুবার পড়া মানে একই কাজ দুবার নয়। একবার পড়ার বাকি অর্ধেকটা।
greeting.epigraph.6 = বাক্যটা ধরে রাখুন — বইও আপনাকে ধরে রাখবে।
greeting.epigraph.7 = তুলে রাখা বাক্যটা একটা প্রশ্ন। নোট তার উত্তর।
greeting.epigraph.8 = নিজের হাতে যা টুকে রেখেছেন, আসলে ঠিক সেটুকুই পড়েছেন।
greeting.epigraph.9 = টুকে রাখার খাতা এমন স্মৃতি, যা ধার দেওয়াও যায়।
greeting.epigraph.10 = বইয়ের একটাই অংশ আপনাকে নিয়ে — মার্জিন।

# 25 January in Egypt.
# bn: A day named after a proper noun keeps its name in Bengali script (বাস্তিল,
# ওয়েটাঙ্গি, আনজ্যাক). A day whose native name is a common-noun phrase —
# Bevrijdingsdag, Quốc Khánh, Hari Merdeka — is written as what it means, because
# a Bengali greeting says what the day IS; a string of foreign syllables says nothing.
greeting.holiday.eg.01-25.1 = শুভ বিপ্লব দিবস, {name}
# 26 January in Australia.
greeting.holiday.au.01-26.1 = শুভ অস্ট্রেলিয়া দিবস, {name}
# 26 January in India.
greeting.holiday.in.01-26.1 = শুভ প্রজাতন্ত্র দিবস, {name}
# 4 February in Sri Lanka.
greeting.holiday.lk.02-04.1 = শুভ স্বাধীনতা দিবস, {name}
# 6 February in New Zealand.
greeting.holiday.nz.02-06.1 = শুভ ওয়েটাঙ্গি দিবস, {name}
# 11 February in Japan.
greeting.holiday.jp.02-11.1 = শুভ জাতীয় প্রতিষ্ঠা দিবস, {name}
# 21 February in Bangladesh. A COMMEMORATION, not a celebration: the tone is sombre and "happy" would be wrong.
greeting.holiday.bd.02-21.1 = আজ শহিদ দিবস, {name}
greeting.holiday.bd.02-21.2 = অমর একুশে — ভাষার জন্য একটা দিন, {name}
# 22 February in Saudi Arabia.
greeting.holiday.sa.02-22.1 = শুভ প্রতিষ্ঠা দিবস, {name}
# 1 March in South Korea. A COMMEMORATION, not a celebration: the tone is sombre and "happy" would be wrong.
greeting.holiday.kr.03-01.1 = আজ কোরিয়ার স্বাধীনতা আন্দোলনের দিন, {name}
# 6 March in Ghana.
greeting.holiday.gh.03-06.1 = শুভ স্বাধীনতা দিবস, {name}
# 15 March in Hungary.
greeting.holiday.hu.03-15.1 = শুভ 1848-এর বিপ্লব দিবস, {name}
# 17 March in Ireland.
greeting.holiday.ie.03-17.1 = শুভ সেন্ট প্যাট্রিক’স ডে, {name}
# 23 March in Pakistan.
greeting.holiday.pk.03-23.1 = শুভ পাকিস্তান দিবস, {name}
# 25 March in Greece.
greeting.holiday.gr.03-25.1 = শুভ স্বাধীনতা দিবস, {name}
# 26 March in Bangladesh.
greeting.holiday.bd.03-26.1 = শুভ স্বাধীনতা দিবস, {name}
# 13 April in Thailand.
greeting.holiday.th.04-13.1 = শুভ সংক্রান — থাই নববর্ষ, {name}
# 14 April in India and Bangladesh.
greeting.holiday.in.04-14.1 = শুভ নববর্ষ, {name}
greeting.holiday.in.04-14.2 = পয়লা বৈশাখের শুভেচ্ছা, {name}
# 15 April in India.
greeting.holiday.in.04-15.1 = শুভ নববর্ষ, {name}
greeting.holiday.in.04-15.2 = পয়লা বৈশাখের শুভেচ্ছা, {name}
# 19 April in Venezuela.
greeting.holiday.ve.04-19.1 = আজ স্বাধীনতার প্রথম ডাকের দিন, {name}
# 23 April in Türkiye.
greeting.holiday.tr.04-23.1 = শুভ জাতীয় সার্বভৌমত্ব ও শিশু দিবস, {name}
# 25 April in Australia and New Zealand. A COMMEMORATION, not a celebration: the tone is sombre and "happy" would be wrong.
greeting.holiday.au.04-25.1 = আজ আনজ্যাক দিবস, {name}
# 25 April in Italy.
greeting.holiday.it.04-25.1 = শুভ মুক্তি দিবস, {name}
# 25 April in Egypt.
greeting.holiday.eg.04-25.1 = শুভ সিনাই মুক্তি দিবস, {name}
# 27 April in South Africa.
greeting.holiday.za.04-27.1 = শুভ মুক্তি দিবস, {name}
# 30 April in Vietnam.
greeting.holiday.vn.04-30.1 = শুভ পুনর্মিলন দিবস, {name}
# 3 May in Poland.
greeting.holiday.pl.05-03.1 = শুভ সংবিধান দিবস, {name}
# 3 May in Japan.
greeting.holiday.jp.05-03.1 = শুভ সংবিধান স্মরণ দিবস, {name}
# 5 May in the Netherlands.
greeting.holiday.nl.05-05.1 = শুভ মুক্তি দিবস, {name}
# 5 May in Japan.
greeting.holiday.jp.05-05.1 = শুভ শিশু দিবস, {name}
# 17 May in Norway.
greeting.holiday.no.05-17.1 = শুভ সতেরোই মে, {name}
# 25 May in Argentina.
greeting.holiday.ar.05-25.1 = শুভ মে বিপ্লব দিবস, {name}
# 1 June in Kenya.
greeting.holiday.ke.06-01.1 = শুভ মাদারাকা দিবস, {name}
# 1 June in Indonesia.
greeting.holiday.id.06-01.1 = শুভ পঞ্চশীল দিবস, {name}
# 2 June in Italy.
greeting.holiday.it.06-02.1 = শুভ প্রজাতন্ত্র দিবস, {name}
# 6 June in Sweden.
greeting.holiday.se.06-06.1 = শুভ জাতীয় দিবস, {name}
# 10 June in Portugal.
greeting.holiday.pt.06-10.1 = শুভ পর্তুগাল দিবস, {name}
# 12 June in the Philippines.
greeting.holiday.ph.06-12.1 = শুভ স্বাধীনতা দিবস, {name}
# 12 June in Nigeria.
greeting.holiday.ng.06-12.1 = শুভ গণতন্ত্র দিবস, {name}
# 16 June in South Africa. A COMMEMORATION, not a celebration: the tone is sombre and "happy" would be wrong.
greeting.holiday.za.06-16.1 = আজ যুব দিবস, {name}
# 19 June in the United States.
greeting.holiday.us.06-19.1 = শুভ জুনটিন্থ, {name}
# 28 June in Ukraine.
greeting.holiday.ua.06-28.1 = শুভ সংবিধান দিবস, {name}
# 1 July in Canada.
greeting.holiday.ca.07-01.1 = শুভ কানাডা দিবস, {name}
# 1 July in Hong Kong.
greeting.holiday.hk.07-01.1 = শুভ প্রতিষ্ঠা দিবস, {name}
# 4 July in the United States.
greeting.holiday.us.07-04.1 = শুভ চৌঠা জুলাই, {name}
greeting.holiday.us.07-04.2 = চৌঠা জুলাইয়ের শুভেচ্ছা, {name}
# 5 July in Venezuela.
greeting.holiday.ve.07-05.1 = শুভ স্বাধীনতা দিবস, {name}
# 9 July in Argentina.
greeting.holiday.ar.07-09.1 = শুভ স্বাধীনতা দিবস, {name}
# 14 July in France.
greeting.holiday.fr.07-14.1 = শুভ বাস্তিল দিবস, {name}
# 18 July in Uruguay.
greeting.holiday.uy.07-18.1 = শুভ সংবিধান দিবস, {name}
# 20 July in Colombia.
greeting.holiday.co.07-20.1 = শুভ স্বাধীনতা দিবস, {name}
# 21 July in Belgium.
greeting.holiday.be.07-21.1 = শুভ বেলজিয়ামের জাতীয় দিবস, {name}
# 23 July in Egypt.
greeting.holiday.eg.07-23.1 = শুভ বিপ্লব দিবস, {name}
# 24 July in Venezuela.
greeting.holiday.ve.07-24.1 = শুভ বলিভার দিবস, {name}
# 26 July in the Maldives.
greeting.holiday.mv.07-26.1 = শুভ স্বাধীনতা দিবস, {name}
# 28 July in Peru.
greeting.holiday.pe.07-28.1 = শুভ জাতীয় উৎসব, {name}
# 29 July in Peru.
greeting.holiday.pe.07-29.1 = আজ সেনা-কুচকাওয়াজের দিন, {name}
# 1 August in Switzerland.
greeting.holiday.ch.08-01.1 = শুভ সুইস জাতীয় দিবস, {name}
# 7 August in Colombia.
greeting.holiday.co.08-07.1 = শুভ বোয়াকার যুদ্ধ দিবস, {name}
# 9 August in Singapore.
greeting.holiday.sg.08-09.1 = শুভ জাতীয় দিবস, {name}
# 14 August in Pakistan.
greeting.holiday.pk.08-14.1 = শুভ স্বাধীনতা দিবস, {name}
# 15 August in South Korea.
greeting.holiday.kr.08-15.1 = শুভ মুক্তি দিবস, {name}
# 15 August in India.
greeting.holiday.in.08-15.1 = শুভ স্বাধীনতা দিবস, {name}
# 17 August in Indonesia.
greeting.holiday.id.08-17.1 = শুভ স্বাধীনতা দিবস, {name}
# 20 August in Hungary.
greeting.holiday.hu.08-20.1 = শুভ সেন্ট স্টিফেন’স ডে, {name}
# 24 August in Ukraine.
greeting.holiday.ua.08-24.1 = শুভ স্বাধীনতা দিবস, {name}
# 25 August in Uruguay.
greeting.holiday.uy.08-25.1 = শুভ স্বাধীনতা দিবস, {name}
# 30 August in Türkiye.
greeting.holiday.tr.08-30.1 = শুভ বিজয় দিবস, {name}
# 31 August in Malaysia.
greeting.holiday.my.08-31.1 = শুভ স্বাধীনতা দিবস, {name}
# 2 September in Vietnam.
greeting.holiday.vn.09-02.1 = শুভ জাতীয় দিবস, {name}
# 7 September in Brazil.
greeting.holiday.br.09-07.1 = শুভ স্বাধীনতা দিবস, {name}
# 16 September in Mexico.
greeting.holiday.mx.09-16.1 = শুভ স্বাধীনতা দিবস, {name}
# 16 September in Malaysia.
greeting.holiday.my.09-16.1 = শুভ মালয়েশিয়া দিবস, {name}
# 18 September in Chile.
greeting.holiday.cl.09-18.1 = শুভ জাতীয় উৎসব, {name}
# 19 September in Chile.
greeting.holiday.cl.09-19.1 = শুভ সেনা-গৌরব দিবস, {name}
# 21 September in Ghana. A COMMEMORATION, not a celebration: the tone is sombre and "happy" would be wrong.
greeting.holiday.gh.09-21.1 = আজ প্রতিষ্ঠাতা দিবস, {name}
# 23 September in Saudi Arabia.
greeting.holiday.sa.09-23.1 = শুভ সৌদি জাতীয় দিবস, {name}
# 24 September in South Africa.
greeting.holiday.za.09-24.1 = শুভ ঐতিহ্য দিবস, {name}
# 28 September in Czechia.
greeting.holiday.cz.09-28.1 = শুভ চেক রাষ্ট্র দিবস, {name}
# 30 September in Canada. A COMMEMORATION, not a celebration: the tone is sombre and "happy" would be wrong.
greeting.holiday.ca.09-30.1 = আজ সত্য ও পুনর্মিলনের জাতীয় দিবস, {name}
# 1 October in Nigeria.
greeting.holiday.ng.10-01.1 = শুভ স্বাধীনতা দিবস, {name}
# 1 October in China and Hong Kong.
greeting.holiday.cn.10-01.1 = শুভ জাতীয় দিবস, {name}
# 2 October in India. A COMMEMORATION, not a celebration: the tone is sombre and "happy" would be wrong.
greeting.holiday.in.10-02.1 = আজ গান্ধী জয়ন্তী, {name}
# 3 October in South Korea.
greeting.holiday.kr.10-03.1 = শুভ জাতীয় প্রতিষ্ঠা দিবস, {name}
# 3 October in Germany.
greeting.holiday.de.10-03.1 = শুভ জার্মান ঐক্য দিবস, {name}
# 5 October in Portugal.
greeting.holiday.pt.10-05.1 = শুভ প্রজাতন্ত্র দিবস, {name}
# 10 October in Taiwan.
greeting.holiday.tw.10-10.1 = শুভ ডাবল টেন দিবস, {name}
# 12 October in Spain.
greeting.holiday.es.10-12.1 = শুভ জাতীয় দিবস, {name}
# 20 October in Kenya.
greeting.holiday.ke.10-20.1 = শুভ মাশুজা দিবস, {name}
# 23 October in Hungary. A COMMEMORATION, not a celebration: the tone is sombre and "happy" would be wrong.
greeting.holiday.hu.10-23.1 = আজ 1956-এর বিপ্লব দিবস, {name}
# 26 October in Austria.
greeting.holiday.at.10-26.1 = শুভ জাতীয় দিবস, {name}
# 28 October in Czechia.
greeting.holiday.cz.10-28.1 = শুভ স্বাধীন চেকোস্লোভাক রাষ্ট্র দিবস, {name}
# 28 October in Greece.
greeting.holiday.gr.10-28.1 = শুভ ওহি দিবস, {name}
# 29 October in Türkiye.
greeting.holiday.tr.10-29.1 = শুভ প্রজাতন্ত্র দিবস, {name}
# 2 November in Mexico. A COMMEMORATION, not a celebration: the tone is sombre and "happy" would be wrong.
greeting.holiday.mx.11-02.1 = আজ মৃতদের স্মরণের দিন, {name}
# 3 November in the Maldives.
greeting.holiday.mv.11-03.1 = শুভ বিজয় দিবস, {name}
# 5 November in the United Kingdom.
greeting.holiday.gb.11-05.1 = মনে রাখবেন, মনে রাখবেন — পাঁচই নভেম্বর, {name}
# 6 November in Morocco.
greeting.holiday.ma.11-06.1 = শুভ সবুজ পদযাত্রা দিবস, {name}
# 11 November in France. A COMMEMORATION, not a celebration: the tone is sombre and "happy" would be wrong.
greeting.holiday.fr.11-11.1 = আজ যুদ্ধবিরতি দিবস, {name}
# 11 November in Poland.
greeting.holiday.pl.11-11.1 = শুভ স্বাধীনতা দিবস, {name}
# 11 November in Australia and Canada and the United Kingdom. A COMMEMORATION, not a celebration: the tone is sombre and "happy" would be wrong.
greeting.holiday.au.11-11.1 = আজ স্মরণ দিবস, {name}
# 11 November in the Maldives.
greeting.holiday.mv.11-11.1 = শুভ প্রজাতন্ত্র দিবস, {name}
# 11 November in the United States. A COMMEMORATION, not a celebration: the tone is sombre and "happy" would be wrong.
greeting.holiday.us.11-11.1 = আজ প্রাক্তন সৈনিকদের দিন, {name}
# 15 November in Brazil.
greeting.holiday.br.11-15.1 = শুভ প্রজাতন্ত্র দিবস, {name}
# 18 November in Morocco.
greeting.holiday.ma.11-18.1 = শুভ স্বাধীনতা দিবস, {name}
# 1 December in Romania.
greeting.holiday.ro.12-01.1 = শুভ মহান ঐক্য দিবস, {name}
# 1 December in Portugal.
greeting.holiday.pt.12-01.1 = শুভ স্বাধীনতা পুনরুদ্ধার দিবস, {name}
# 2 December in the United Arab Emirates.
greeting.holiday.ae.12-02.1 = শুভ জাতীয় দিবস, {name}
# 5 December in Thailand.
greeting.holiday.th.12-05.1 = শুভ জাতীয় দিবস, {name}
# 6 December in Spain.
greeting.holiday.es.12-06.1 = শুভ সংবিধান দিবস, {name}
# 6 December in Finland.
greeting.holiday.fi.12-06.1 = শুভ স্বাধীনতা দিবস, {name}
# 12 December in Kenya.
greeting.holiday.ke.12-12.1 = শুভ জামহুরি দিবস, {name}
# 16 December in Bangladesh.
greeting.holiday.bd.12-16.1 = শুভ বিজয় দিবস, {name}
# 17 December in Bhutan.
greeting.holiday.bt.12-17.1 = শুভ জাতীয় দিবস, {name}
# 25 December in Pakistan.
greeting.holiday.pk.12-25.1 = শুভ কায়েদে আজম দিবস, {name}
# 1 January in everywhere — no region needed.
greeting.holiday.intl.01-01.1 = শুভ নববর্ষ, {name}
greeting.holiday.intl.01-01.2 = নতুন বছর, নতুন মার্জিন, {name}
greeting.holiday.intl.01-01.3 = নতুন বছর, ফাঁকা খাতা, {name}
# 14 February in everywhere — no region needed.
greeting.holiday.intl.02-14.1 = শুভ ভ্যালেন্টাইনস ডে, {name}
greeting.holiday.intl.02-14.2 = আজ তুলে রাখার মতো কিছু পেলেন, {name}?
# 23 April in everywhere — no region needed.
greeting.holiday.intl.04-23.1 = শুভ বিশ্ব বই দিবস, {name}
greeting.holiday.intl.04-23.2 = বিশ্ব বই দিবস — সঙ্গটা ভালোই, {name}
# 31 October in everywhere — no region needed.
greeting.holiday.intl.10-31.1 = শুভ হ্যালোউইন, {name}
greeting.holiday.intl.10-31.2 = মার্জিনে আজ একটু ভূতুড়ে কিছু, {name}?
# 24 December in everywhere — no region needed.
greeting.holiday.intl.12-24.1 = বড়দিনের আগের সন্ধে, {name}
# 25 December in everywhere — no region needed.
greeting.holiday.intl.12-25.1 = শুভ বড়দিন, {name}
greeting.holiday.intl.12-25.2 = বড়দিনের শুভেচ্ছা, {name}
# 31 December in everywhere — no region needed.
greeting.holiday.intl.12-31.1 = বছরের শেষ পাতা, {name}
greeting.holiday.intl.12-31.2 = বছরটাকে বিদায় দিন, {name}

# Easter Sunday, computed rather than tabled, so it needs no region.
greeting.holiday.easter = শুভ ইস্টার, {name}
# Good Friday. A solemn day: the English deliberately avoids "happy".
greeting.holiday.good-friday = আজ গুড ফ্রাইডে — শান্ত একটা দিন, {name}
# Fourth Thursday in November, United States.
greeting.holiday.thanksgiving.us = শুভ থ্যাঙ্কসগিভিং, {name}
# Second Monday in October, Canada.
greeting.holiday.thanksgiving.ca = শুভ থ্যাঙ্কসগিভিং, {name}

# Home greeting, after midnight and before 05:00. {name} is the reader's own name.
greeting.bucket.latenight.1 = এখনও জেগে আছেন, {name}?
greeting.bucket.latenight.2 = রাত গভীর, {name}
greeting.bucket.latenight.3 = আর এক পাতা, {name}?
greeting.bucket.latenight.4 = মাঝরাতেও বাতি জ্বলছে, {name}
greeting.bucket.latenight.5 = নিঝুম রাত, {name}
# Home greeting, 05:00 to 08:00. {name} is the reader's own name.
greeting.bucket.dawn.1 = সকাল সকাল শুরু, {name}
greeting.bucket.dawn.2 = সুপ্রভাত, {name} — দুনিয়া জাগার আগেই
greeting.bucket.dawn.3 = সবে আলো ফুটেছে, {name}
greeting.bucket.dawn.4 = পাখিদের সঙ্গেই উঠে পড়েছেন, {name}
# Home greeting, 08:00 to noon. {name} is the reader's own name.
greeting.bucket.morning.1 = সুপ্রভাত, {name}
greeting.bucket.morning.2 = শুভ সকাল, {name}
greeting.bucket.morning.3 = ভালো একটা বাক্যের জন্য ভালো একটা সকাল, {name}
greeting.bucket.morning.4 = নতুন পাতা, {name}
greeting.bucket.morning.5 = সকাল হল, {name} — কী পড়লেন?
# Home greeting, noon to 17:00. {name} is the reader's own name.
greeting.bucket.afternoon.1 = দুপুরটা ভালো কাটুক, {name}
greeting.bucket.afternoon.2 = দুপুর গড়াচ্ছে, {name}
greeting.bucket.afternoon.3 = ভরদুপুর, {name} — একটা অধ্যায় হয়ে যাক
greeting.bucket.afternoon.4 = বিকেল, {name}। রাখার মতো কিছু পেলেন?
# Home greeting, 17:00 to 21:00. {name} is the reader's own name.
greeting.bucket.evening.1 = শুভ সন্ধ্যা, {name}
greeting.bucket.evening.2 = সন্ধে হল, {name}
greeting.bucket.evening.3 = সন্ধে, {name} — পড়ার সময় এল
greeting.bucket.evening.4 = এবার একটু জিরিয়ে নিন, {name}
# Home greeting, after 21:00. {name} is the reader's own name.
greeting.bucket.night.1 = শুভ রাত্রি, {name}
greeting.bucket.night.2 = রাত হল, {name}
greeting.bucket.night.3 = রাত করে একটা-দুটো বাক্য, {name}?
greeting.bucket.night.4 = রাত, {name} — আর একটা অধ্যায়

# Home greeting on a Saturday or Sunday, 05:00 to 08:00. {name} is the reader's own name.
greeting.weekend.dawn.1 = ছুটির দিনে এত সকাল, {name}
greeting.weekend.dawn.2 = ছুটির নিরিবিলি শুরু, {name}
# Home greeting on a Saturday or Sunday, 08:00 to noon. {name} is the reader's own name.
greeting.weekend.morning.1 = শুভ শনিবার, {name}
greeting.weekend.morning.2 = ছুটির সকাল, {name}
greeting.weekend.morning.3 = আলসে সকাল, {name}
greeting.weekend.morning.4 = আজ অ্যালার্ম নেই, {name}
# Home greeting on a Saturday or Sunday, noon to 17:00. {name} is the reader's own name.
greeting.weekend.afternoon.1 = ছুটির দুপুর, {name}
greeting.weekend.afternoon.2 = গোটা দুপুরটা পড়ার জন্য, {name}
greeting.weekend.afternoon.3 = ঢিলেঢালা দুপুর, {name}
# Home greeting on a Saturday or Sunday, 17:00 to 21:00. {name} is the reader's own name.
greeting.weekend.evening.1 = ছুটির সন্ধে, {name}
greeting.weekend.evening.2 = সন্ধে, {name} — সোমবার এখনও দূরে
greeting.weekend.evening.3 = আরাম করে বসুন, {name}
# Home greeting on a Saturday or Sunday, after 21:00. {name} is the reader's own name.
greeting.weekend.night.1 = ছুটির রাত, বেশ গভীর, {name}
greeting.weekend.night.2 = কাল অ্যালার্ম নেই, {name}

# Home greeting on a Sunday morning, instead of the weekend pool — "Happy
# Saturday" on a Sunday is worse than saying nothing clever at all.
greeting.sunday.1 = শুভ রবিবার, {name}
greeting.sunday.2 = রবিবারের সকাল, {name}
greeting.sunday.3 = অলস রবিবার, {name}

# What the greeting calls somebody with no display name set.
greeting.name-fallback = পাঠক
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
quiz.daily.label = দৈনিক অনুশীলনী
quiz.practice.label = ঝালাই

# The five question types. .label is the row in Settings, .hint its info dot.
quiz.question.source.label = কোন উৎস?
quiz.question.source.hint = উদ্ধৃতিটা দেখিয়ে জিজ্ঞেস করে কোথা থেকে এসেছে। কয়েকটা বিকল্প থেকে বাছতে হয়।
quiz.question.quote.label = কোন বাক্যটা?
quiz.question.quote.hint = বই বা সিনেমার নাম দেখিয়ে জিজ্ঞেস করে কোন লাইনটা ওখান থেকে। কয়েকটা বিকল্প থেকে বাছতে হয়।
quiz.question.cloze.label = শূন্যস্থান পূরণ
quiz.question.cloze.hint = একটা অংশ ফাঁকা রেখে আপনাকে টাইপ করে ভরতে বলে। সার্ভার যাচাই করে, ছোটখাটো বানান ভুল ধরে না। ঠিক হলে বেশি নম্বর, ভুলে কম ক্ষতি।
quiz.question.cloze-mcq.label = শূন্যস্থান পূরণ — বেছে নিয়ে
quiz.question.cloze-mcq.hint = একই ফাঁকা জায়গা, তবে চারটে অংশ থেকে বাছতে হয়। ভুলগুলো আপনার অন্য উদ্ধৃতি থেকে নেওয়া।
quiz.question.speaker.label = কে বলেছে?
quiz.question.speaker.hint = লাইনটা কে বলেছে জিজ্ঞেস করে — সিনেমা, শো, গেম বা বক্তৃতার উদ্ধৃতিতে। বইয়ের হাইলাইটে কখনো আসে না।
quiz.question.author.label = কে লিখেছে?
quiz.question.author.hint = শুধু বইয়ে: কে লিখেছেন জিজ্ঞেস করে। ভুল বিকল্পগুলো কাছাকাছি ধরনের বইয়ের লেখক।
quiz.question.flip.label = উল্টে নিজে বিচার
quiz.question.flip.hint = উদ্ধৃতি দেখায়, তারপর উৎস, আর আপনি বলেন জানতেন কি না। উত্তর কেউ যাচাই করে না, তাই শুধু ঝালাইয়ে আসে — আর ঝালাই গোনা হলে সেখানেও নয়।
# The two axes every question type sits on, appended to its tooltip: WHAT is
# being asked, and HOW you answer it. Two questions sharing a class are the same
# question asked two ways — which is what a flat row of chips cannot show.
quiz.class.work.label = কোন উৎস
quiz.class.quote.label = কোন উদ্ধৃতি
quiz.class.person.label = পিছনে কে
quiz.class.words.label = শব্দগুলো নিজেই
quiz.form.choose.label = চারটের একটা বাছুন
quiz.form.type.label = টাইপ করে ফেরান
quiz.form.self.label = নিজেই বিচার করুন
quiz.taxonomy.line = {klass} · {form}

# Appended to the hint of a question toggle that REFUSES to switch off,
# because it is the last one the deck could ask of a book as well as a film.
quiz.question.last-universal.info = প্রতিটা কুইজে অন্তত একটা এমন প্রশ্ন থাকা চাই যা বই আর সিনেমা দুয়েই চলে। এটাই শেষটা।

# The ten tuning sliders in Settings → Quiz. .label sits above the slider,
# .hint is its info dot. Every one of these multiplies a half-life.
quiz.tuning.grow.label = ঠিক উত্তরে বাড়ে
quiz.tuning.grow.hint = শুধু অ্যাডাপ্টিভে। ঠিক উত্তরে পরের বার আসার ফাঁক এত গুণ হয়। ২.৫ চেনা মান; বেশি দিলে কার্ড তাড়াতাড়ি দূরে সরে।
quiz.tuning.shrink.label = ভুল হলে কমে
quiz.tuning.shrink.hint = শুধু অ্যাডাপ্টিভে। ভুল হলে ফাঁক একেবারে শূন্যে না নেমে এত গুণ হয়; ০.৫ মানে অর্ধেক। ১-এর কম হতেই হবে।
quiz.tuning.cloze-grow.label = টাইপ করা উত্তরে বাড়ে
quiz.tuning.cloze-grow.hint = বিকল্প বাছার চেয়ে টাইপ করে ঠিক উত্তর দিলে কত বেশি গোনা হবে।
quiz.tuning.cloze-shrink.label = আর ভুল হলে খরচ
quiz.tuning.cloze-shrink.hint = টাইপ করা উত্তর ভুল হলে কত কম ক্ষতি। সবচেয়ে কঠিন প্রশ্নে ভুল করা মানেই ভুলে যাওয়া নয় — বিকল্প বাছতে ভুল করাটা তার চেয়ে বড় লক্ষণ।
quiz.tuning.cloze-synonym.label = সমার্থক শব্দের দাম
quiz.tuning.cloze-synonym.hint = কাছাকাছি মানের শব্দ দিলেও ঠিক ধরা হয়, আর পুরো উত্তরের এতটা অংশ পায়। ০ দিলে ঠিক ধরা হয়, কিন্তু কার্ড নড়ে না।
quiz.tuning.cloze-words.label = একাধিক শব্দের শূন্যস্থান কবে থেকে
quiz.tuning.cloze-words.hint = উদ্ধৃতি এত দিন মনে থাকার আগে ফাঁকা জায়গায় একটাই শব্দ লুকোয়; তারপর পুরো অংশও লুকোতে পারে। ১ দিলে শুরু থেকেই পুরো অংশ।
quiz.tuning.ladder-1.label = সিঁড়ির ধাপ 1
quiz.tuning.ladder-1.hint = প্রথম ধাপ, আর ভুল হলে কার্ড এখানেই ফেরে। শুধু সিঁড়ি বাছলে খাটে।
quiz.tuning.ladder-2.label = সিঁড়ির ধাপ 2
quiz.tuning.ladder-3.label = সিঁড়ির ধাপ 3
quiz.tuning.ladder-4.label = সিঁড়ির ধাপ 4
quiz.tuning.ladder-4.hint = শেষ ধাপ। ঠিক উত্তর দিয়ে যেতে থাকলে কার্ড এখানেই থাকে।

# Under the four ladder sliders when they are not in ascending order. The
# panel refuses rather than letting the server silently revert them.
quiz.tuning.ladder.error = চারটে ধাপ উপরে উঠতে হবে — প্রতিটা আগেরটার চেয়ে লম্বা।

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
vocab.yesno.yes.label = হ্যাঁ
vocab.yesno.no.label = না

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
common.toast.deleted = {n}টা মোছা হয়েছে
# Fill gaps: the three outcomes. "nothing was missing" is the GOOD case and has
# to read like one, or people learn to distrust the button.
common.selection.fill.toast.nothing-missing = কোনও ঘরই ফাঁকা ছিল না
common.selection.fill.toast.none-fetched = কিছুই আনা গেল না
# {n} counts FIELDS filled, not works — "filled 3 books" over a selection of
# forty reads as a failure where "filled 7 fields" reads as the win it is.
common.selection.fill.toast.filled = {n}টা ঘর ভরা হল

# Under one field of the bulk edit sheet, warning what setting it would destroy.
# {n} is how many rows already hold a value; {value} is that value when they all
# agree; {distinct} is how many different ones there are when they do not.
common.selection.edit.title = {n}টায় একটা ঘর বসান
common.selection.edit.body = একটা ঘর আর একটা মান বাছুন। বাছা সবকটাতে সেটাই বসবে; আর কিছু বদলাবে না।
common.selection.edit.field.label = ঘর
common.selection.edit.field.aria = কোন ঘরে বসাবেন
common.selection.edit.value.aria = যে মান বসবে
common.selection.edit.value.none.label = (কিছু না)
common.selection.edit.clear.hint = ফাঁকা রাখলে ঘরটা মুছে যাবে।
common.selection.edit.overwrite.same = যে {n}টায় আগে থেকেই “{value}” লেখা, সেগুলোও বদলে যাবে
common.selection.edit.overwrite.differ = {n}টা বদলে যাবে — এখন তাতে {distinct} রকম মান আছে

# Failures, keyed by WHAT failed rather than by where.
error.apply.generic = বসানো গেল না
error.fill.generic = শূন্যস্থান পূরণ করা গেল না
error.delete.generic = মোছা গেল না
error.undo.generic = আনডু করা গেল না

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
common.subject.book.label = এই বই
common.subject.movie.label = এই টাইটেল
common.subject.quote.label = এই উদ্ধৃতি

# The card actions. .label is the menu row, .tip the hover tooltip.
common.action.copy.tip = {subject} কপি করুন
common.action.share.tip = {subject} শেয়ার করুন
common.action.edit.tip = {subject} এডিট করুন
common.action.delete.tip = {subject} মুছুন
# Fetch only what is MISSING and touch nothing else.
common.action.fill.label = শূন্যস্থান পূরণ
common.action.fill.tip = ফাঁকা ঘরগুলো ভরান
# While it is fetching.
# A themed quiz round over one book or one title.
common.action.practise.tip = {subject} নিয়ে ঝালিয়ে নিন
# The quiz toggle, which flips to name what pressing it will do.
common.action.review.add.label = অনুশীলনীতে দিন
common.action.review.add.tip = আবার অনুশীলনীতে ফেরান
common.action.review.skip.label = অনুশীলনী থেকে বাদ দিন
common.action.review.skip.tip = অনুশীলনীর বাইরে রাখুন
# The other flipping pair: .on when the row is NOT a favourite yet, .off when
# it already is. Bengali negation is a different construction, so both are keys.
common.action.favourite.menu.on.label = প্রিয়তে রাখুন
common.action.favourite.menu.off.label = প্রিয় থেকে সরান
common.action.favourite.tip = {subject} প্রিয়তে রাখুন
# Filing a standalone quote on a different board.
common.action.board.label = বোর্ডে পাঠান
common.action.board.tip = অন্য বোর্ডে সরিয়ে রাখুন
# The bulk-only actions: recolour, tag, sticker ("seal"), shelf, anthology, and
# setting fields across several works at once.
common.action.colour.label = রং
common.action.add-tags.label = ট্যাগ যোগ করুন
# bn: The English "seal" is the sticker itself, pinned to a quote. Bengali does not
# need a second word for it — সিল is a rubber stamp — so every "seal" is স্টিকার.
common.action.seal.label = স্টিকার বসান
common.action.shelf.label = তাক
common.action.anthology.label = সংকলনে দিন
common.action.anthology.tip = {subject} সংকলনে জড়ো করুন
common.action.set-fields.label = ঘরে মান বসান

# The select controls a card's own menu puts above its actions. {n} is how many
# cards are on screen — never how many the library holds, because a filter may
# be hiding four hundred.
common.selection.menu.select.label = বাছুন
common.selection.menu.deselect.label = বাছাই তুলুন
common.selection.menu.select-all.label = {n}টাই বাছুন
common.selection.menu.deselect-all.label = সব বাছাই তুলুন

# THE SELECTION BAR. The count badge at the left empties the picks and leaves
# the bar standing; the ✕ at the right ends the mode. {noun} arrives already in
# the right form from unit.*.
common.selection.deselect-all.label = সব বাছাই তুলুন
# Spoken and hovered when nothing is picked. A bare 0 in a count reads as
# something having gone wrong, so zero is worded rather than numbered.
common.selection.none.aria = কোনও {noun} বাছা হয়নি
common.selection.count.aria = সব বাছাই তুলুন — {n} {noun} বাছা হয়েছে
common.selection.count.tip = {n} {noun} বাছা হয়েছে
common.selection.colour.aria = বাছা {n}টার রং বদলান
common.selection.shelf.aria = বাছা {n}টা তাকে তুলুন
common.selection.shelf.tip = তাকে তুলুন
# The first row of the shelf menu: take the selection off its shelf entirely.
common.selection.shelf.clear.label = তাক থেকে নামান
common.selection.more.aria = বাছা {n}টার জন্য আরও
common.selection.more.tip = আরও অপশন
common.selection.dismiss.aria = বাছাই বন্ধ করুন

# Toasts after a bulk action. {n} is how many rows were touched.
common.selection.toast.recoloured = {n}টার রং বদলাল
common.selection.toast.tagged = {n}টায় ট্যাগ বসল
common.selection.toast.sealed = {n}টায় স্টিকার বসল
common.selection.toast.seals-removed = স্টিকার উঠে গেল
common.selection.toast.fields-set.one = 1টা রেকর্ড বদলাল
common.selection.toast.fields-set.other = {n}টা রেকর্ড বদলাল
common.selection.toast.favourited = {n}টা প্রিয়তে গেল
common.selection.toast.moved = {n}টা পাঠানো হল
common.selection.toast.back-in-quiz = আবার অনুশীলনীতে
common.selection.toast.skipping = {n}টা অনুশীলনী থেকে বাদ
# Gathering into an anthology. A quote already there is SKIPPED, not an error,
# so the second form reports both numbers rather than claiming they all landed.
common.selection.toast.gathered = {n}টা জড়ো হল
common.selection.toast.gathered-some = {n}টা জড়ো হল, {skipped}টা আগেই ছিল

# The delete confirmation. The reader has to TYPE {phrase} — and {phrase} is
# still assembled in English by bulkOps.deletePhrase, because the Go server
# compares it byte for byte. Translating this sentence without the server would
# make the control impossible to satisfy.
common.selection.delete.confirm.title = {n} {noun} মুছবেন?
# bn: {phrase} is assembled in English by bulkOps.deletePhrase and compared byte
# for byte by the server, so the sentence tells the reader to type the words shown.
common.selection.delete.confirm.body.work = এগুলো সব উদ্ধৃতি সমেত বিনে যাবে — পুরো বাছাইটা একটাই জিনিস হিসেবে। নিশ্চিত করতে {phrase} লিখুন।
common.selection.delete.confirm.body.quote = পুরো বাছাইটা একটাই জিনিস হিসেবে বিনে যাবে, পরে ফেরানো যায়। নিশ্চিত করতে {phrase} লিখুন।
common.selection.delete.confirm.phrase.aria = নিশ্চিত করার কথাটা লিখুন
common.selection.delete.confirm.action.label = মুছে দিন

# The tag sheet the bar opens. Every tag is ADDED; nothing is removed.
common.selection.tags.title = {n}টায় ট্যাগ
common.selection.tags.body = এখানে যে ট্যাগ দেবেন, {n}টার সবগুলোতেই যোগ হবে। আগে থেকে যা আছে, কিছুই সরে না।
common.selection.tags.placeholder = ট্যাগ লিখুন
common.selection.tags.input.aria = বাছাই করা সবগুলোয় যে ট্যাগ যোগ হবে

# The sticker sheet. "none" is the option that takes the seal off.
common.selection.seal.title = {n}টায় স্টিকার
common.selection.seal.body = পুরো বাছাইয়ে একটাই স্টিকার। “কিছু না” বাছলে সবকটা থেকে স্টিকার সরে যায়।

error.add.generic = ওগুলো যোগ করা গেল না

# ---------------------------------------------------------------------------
# THE TAGS SCREEN (TagsPage.jsx) and THE STICKER LIBRARY (stickers.jsx)
#
# One screen holds both: the tag vocabulary at the top, the uploaded stickers
# below the rule. A "sticker" is an image; the SEAL is that image pinned into a
# quote, which the text then flows around.
# ---------------------------------------------------------------------------

# The three lower-case word links on a small card — deliberately lower case, so
# they are their own strings and not the Title Case buttons of the same name.
common.link.practise.label = ঝালিয়ে নিন
common.link.edit.label = এডিট
common.link.delete.label = মুছুন

# Under the page title. {n} tags, and a reminder that one vocabulary serves both
# sides of the library.
tags.header.counts = {n} {noun} · বই আর সিনেমায় একই ট্যাগ চলে
tags.board.empty = এখনও কোনও ট্যাগ নেই — উপরে একটা তৈরি করুন, বা কোনও উদ্ধৃতিতে ট্যাগ বসান

# The dashed add card, and the form inside it.
tags.new.title = ＋ নতুন ট্যাগ
tags.new.submit.label = ট্যাগ তৈরি করুন
tags.form.edit.title = ট্যাগ এডিট করুন
# The radio group of live chip previews, one per tag style.
tags.form.style.aria = ট্যাগের চেহারা

# The chip on a tag card: the tag's own name, then how many quotes wear it.
tags.card.chip.label = {name} · {n}

# The sortable table behind "more". {n} is how many rows are NOT in the top five.
tags.table.more.label = আরও ট্যাগ ({n})…
tags.table.hide.label = টেবিল লুকান
# How many quotes wear this tag / this sticker. A derived count, not a column.
tags.table.uses.label = ব্যবহার

# Deleting a tag. The second form is used when the tag is actually on something:
# nothing is lost but the tag itself, and saying so is what makes it safe to say
# yes to. {noun} arrives from unit.item.
tags.delete.confirm.body = “{name}” ট্যাগটা মুছবেন?
tags.delete.confirm.body-used = “{name}” ট্যাগটা মুছবেন? {n} {noun} থেকে খুলে যাবে — সেগুলো যেমন আছে থাকবে, শুধু ট্যাগটা থাকবে না।

# THE STICKER LIBRARY, lower half of the same screen.
tags.dupe.row.note = দেখে মনে হচ্ছে একই জিনিস — মিলিয়ে দিন
tags.dupe.count.label.one = {n}টা ট্যাগ দেখে মনে হচ্ছে একই
tags.dupe.count.label.other = {n}টা ট্যাগ দেখে মনে হচ্ছে একই
tags.dupe.pick.prose = কোনটা রাখবেন? বাকিগুলোর সব উদ্ধৃতি সেটাতেই চলে যাবে।
tags.dupe.keep.aria.one = {name} রাখুন, বাকিগুলো এতে মিলিয়ে দিন — {n}টা উদ্ধৃতি
tags.dupe.keep.aria.other = {name} রাখুন, বাকিগুলো এতে মিলিয়ে দিন — {n}টা উদ্ধৃতি
tags.dupe.merge.confirm.title = {name} রেখে বাকিগুলো এতে মিলিয়ে দেব?
tags.dupe.merge.confirm.body.one = {losers} চলে যাবে, আর তার {n}টা উদ্ধৃতিতে বদলে {keep} বসবে। কোনও উদ্ধৃতি ট্যাগ হারাবে না, শুধু নামটা যাবে।
tags.dupe.merge.confirm.body.other = {losers} চলে যাবে, আর তাদের {n}টা উদ্ধৃতিতে বদলে {keep} বসবে। কোনও উদ্ধৃতি ট্যাগ হারাবে না, শুধু নামগুলো যাবে।
tags.dupe.merge.cta = মিলিয়ে দিন
error.merge.tag = ট্যাগ মেলানো গেল না
tags.sticker.section.title = স্টিকার
tags.sticker.board.empty = এখনও কোনও স্টিকার নেই — উপরে একটা স্বচ্ছ PNG বা SVG আপলোড করুন
tags.sticker.new.title = ＋ নতুন স্টিকার
tags.sticker.new.body = স্বচ্ছ PNG বা SVG ছবি — যোগ বা এডিটের ফর্ম থেকে যে কোনও উদ্ধৃতিতে একটা লাগিয়ে দিন
tags.sticker.new.upload.label = স্টিকার আপলোড করুন
# The same button while the file is going up. Lower case, unlike the tooltip on
# the picker's ＋, which is common.action.upload.busy.
tags.sticker.new.upload.busy = আপলোড হচ্ছে…
tags.sticker.table.more.label = আরও স্টিকার ({n})…
# Deleting a sticker. A quote that loses its seal still works; saying so is the
# difference between a safe yes and a guess.
tags.sticker.delete.confirm.body = এই স্টিকারটা মুছবেন?
tags.sticker.delete.confirm.body-used = এই স্টিকারটা মুছবেন? {n} {noun} থেকে খুলে যাবে — সেগুলো যেমন আছে থাকবে, শুধু স্টিকারটা থাকবে না।

# THE STICKER PICKER, which appears in every add and edit form and in the
# selection bar's seal sheet — not only on the Tags screen.
# The alt text on a sticker image that has no name of its own.
common.sticker.image.alt = স্টিকার
# The first option in the strip: no seal on this quote.
common.sticker.none.label = কিছু না
common.sticker.none.tip = কোনও স্টিকার নয়
common.sticker.use.tip = “{name}” বসান
# The same tooltip for a sticker nobody has named yet.
common.sticker.use-any.tip = এই স্টিকারটা বসান
common.sticker.upload.tip = নতুন স্টিকার আপলোড করুন


# Failures.
error.upload.sticker = স্টিকার আপলোড করা গেল না
error.delete.sticker = স্টিকার মোছা গেল না
error.delete.tag = ট্যাগ মোছা গেল না
error.save.tag = ট্যাগ সেভ করা গেল না
error.create.tag = ট্যাগ তৈরি করা গেল না
error.rename.generic = নাম বদলানো গেল না
error.validate.name-required = একটা নাম দিতে হবে
error.validate.name-blank = নাম দিতে হবে

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
tour.step.welcome.title = টিপ্পনীতে স্বাগত
tour.step.welcome.prose = যে লাইনগুলো মনে রাখার মতো — বইয়ের হাইলাইট, সিনেমার সংলাপ — Tippani সেগুলো সাজিয়ে রাখে: কভার, ট্যাগ, মুহূর্তে খোঁজা আর রোজকার মনে রাখার কুইজ সমেত। এই ট্যুরে সব কিছু এক এক করে দেখানো হবে।
tour.step.welcome.more = “পরেরটা” চাপলে এগোবে, “ট্যুর বাদ দিন” চাপলে শেষ, আর “বাকিটা পরে” চাপলে যেখানে ছিলেন মনে রাখবে। উদাহরণগুলো অ্যাপেই আছে, আপনার কোনো ফাইল লাগবে না। ওপরের বারের “?” চাপলে এখনকার পর্দার প্রতিটা নিয়ন্ত্রণের মানে জানা যায়, আর সেখান থেকে ট্যুরটা আবার দেখাও যায়।

# Step "add".
tour.step.add.name = যোগ আর ইমপোর্ট
tour.step.add.blurb = ＋ বোতাম দিয়ে বই, সিনেমা আর শো যোগ করুন, উদ্ধৃতি তুলে রাখুন, বা একসঙ্গে অনেক হাইলাইট ইমপোর্ট করুন
tour.step.add.title = সবকিছুর জন্য একটাই ＋
tour.step.add.prose = সবকিছু যোগ করা হয় ＋ বোতাম দিয়ে, আর আপনি কোথায় আছেন সেই বুঝে বদলায়: গ্রন্থাগারে {em1}, ক্যাটালগে {em2}, কোনো বই বা সিনেমা খোলা থাকলে {em3}। একসঙ্গে অনেক {em4} করা সেই প্যানেলেরই একটা ট্যাব।
tour.step.add.em1.label = বই
tour.step.add.em2.label = সিনেমা বা শো
tour.step.add.em3.label = উদ্ধৃতি
tour.step.add.em4.label = ইমপোর্ট
tour.step.add.more = বই খোঁজা যায় নাম, লেখক বা ISBN দিয়ে, সিনেমা TMDB আর TheTVDB-তে — কভার আর বিবরণ নিজে থেকে ভরে যায়। আমদানি পড়তে পারে Markdown, Readest, কিন্ডল, Goodreads, Hardcover আর IMDb-র উদ্ধৃতির পাতা; সব আগে “যাচাই বাকি ইমপোর্ট”-এ জমা হয়, ওখানে অনুমোদন না দেওয়া পর্যন্ত। একই ফাইল দুবার আনলেও কিছু দ্বিগুণ হয় না।

# Step "library".
tour.step.library.name = গ্রন্থাগার — বই আর উদ্ধৃতি
tour.step.library.blurb = কভার, সিরিজ, রং, ট্যাগ আর প্রিয় — টাইল, তালিকা বা টেবিলে, যেমন খুশি ভাগ করে
tour.step.library.title = গ্রন্থাগার
tour.step.library.prose = আপনার বইগুলো, কভার আর রেখে দেওয়া সব হাইলাইট সমেত। একটা হাইলাইট দেখতে এরকম:
tour.step.library.more = প্রতিটা হাইলাইটের একটা রং, ট্যাগ, অধ্যায় আর অবস্থান, আর একটা ♥ থাকে। দেখা যায় গাদা করা কার্ডে, তালিকায় বা সারণিতে; ছাঁকা যায় ধরন, তাক, প্রিয়, ট্যাগ বা নোট দিয়ে; সাজানো যায় সিরিজ, লেখক, দশক বা ধরন ধরে।

# Step "catalogue".
tour.step.catalogue.name = ক্যাটালগ — সিনেমা আর সংলাপ
tour.step.catalogue.blurb = মনে রাখার মতো বাক্য — সঙ্গে সময়, চরিত্র, আর আপনা থেকে বসে যাওয়া অভিনেতার নাম
tour.step.catalogue.title = ক্যাটালগ
tour.step.catalogue.prose = সিনেমা আর শো-এর সংলাপও এভাবেই থাকে — প্রতিটা লাইনের সঙ্গে সময় আর চরিত্রের নাম। একটা লাইন দেখতে এরকম:
tour.step.catalogue.more = অভিনেতার নাম অভিনেতাদের তালিকা থেকে নিজেই বসে, আপনি শুধু চরিত্রের নাম লেখেন। শো-তে সিজন আর পর্বও থাকে। ট্যাগ, প্রিয়, দেখার ধরন আর সাজানো — সবই গ্রন্থাগারের মতো।

# Step "share".
tour.step.share.name = শেয়ার আর এক্সপোর্ট
tour.step.share.blurb = শেয়ার প্যানেল (WhatsApp/Markdown/ছবির কার্ড), আর Obsidian-এ খাপ খাওয়া এক্সপোর্ট
tour.step.share.title = একটা বাক্য শেয়ার করুন, গোটাটা এক্সপোর্ট
tour.step.share.prose = যে কোনও উদ্ধৃতি এক ট্যাপে শেয়ার হয় — লেখা হিসেবে, নয়তো আপনার নিজের সাজে আঁকা {em1} হিসেবে।
tour.step.share.em1.label = ছবির কার্ড
tour.step.share.more = শেয়ার করা যায় Markdown, WhatsApp, সাধারণ লেখা বা Reddit-এর ধাঁচে, কিংবা আপনার যন্ত্রেই তৈরি ছবি হিসেবে — আগেভাগে দেখে নিয়ে। একটা বই, ছেঁকে নেওয়া কয়েকটা, বা পুরো সংগ্রহ Markdown-এ রপ্তানি করা যায়, আবার ঠিকঠাক আমদানিও করা যায়।

# Step "quiz".
tour.step.quiz.name = দৈনিক অনুশীলনী আর ঝালাই
tour.step.quiz.blurb = নিজের উদ্ধৃতি নিয়ে ফাঁক রেখে পুনরাবৃত্তি — ভুলতে শুরু করলেই কার্ড আবার সামনে আসে
tour.step.quiz.title = দৈনিক অভ্যাস
tour.step.quiz.prose = হোমে রোজ আপনার নিজের উদ্ধৃতি নিয়ে ছোট একটা কুইজ — প্রতিটা ঠিক তখনই ফেরে যখন ভুলতে শুরু করবেন। দিনে দু-তিন মিনিট।
tour.step.quiz.more = প্রতিটা উদ্ধৃতির পাশে একটা বিন্দু — মনে আছে, ভুলছেন, না সম্ভবত ভুলে গেছেন — আর আপনার উত্তরেই সেটা বদলায়। ঝালাই যত খুশি, যখন খুশি থামানো যায়, নিজের আলাদা স্কোর থাকে, আর সাধারণত সময়সূচিতে হাত দেয় না। কটা কার্ড ইত্যাদি সেটিংসে ঠিক করুন।

# Step "search".
tour.step.search.name = সঙ্গে সঙ্গে খোঁজ
tour.step.search.blurb = বানান ভুল হলেও চলে — উদ্ধৃতি, বই-সিনেমা, মানুষ আর নোটের ভিতর পর্যন্ত খোঁজে
tour.step.search.title = যে কোনও বাক্য আবার খুঁজে পান
tour.step.search.prose = যা কিছু রেখেছেন, সব কিছুর মধ্যে মুহূর্তে খোঁজ — {em1}; কী মিলেছে সেই ধরে ফল সাজানো। গ্রন্থাগার বা ক্যাটালগ থেকে খুঁজলে শুধু সেই দিকেই খোঁজে।
tour.step.search.em1.label = বানান ভুল হলেও চলে
tour.step.search.more = নাম, মানুষ, ধরন, সিরিজ, উদ্ধৃতি, নোট, ট্যাগ আর সংলাপ — সবেতেই খোঁজে। একটা দশক (“1990s”) বা তারিখ (“2026-07-14”) লিখলে তখন যা রেখেছিলেন তা পাবেন। কোনো ফল খুলে শেয়ার বা সম্পাদনা করুন, বা কয়েকটা বেছে একসঙ্গে ট্যাগ দিন বা বদলান।

# Step "tags".
tour.step.tags.name = ট্যাগ আর স্টিকার
tour.step.tags.blurb = বই-সিনেমা জুড়ে এক ট্যাগ, প্রত্যেকের নিজের চেহারা; নিজের PNG/SVG স্টিকার উদ্ধৃতিতে লাগান
tour.step.tags.title = ট্যাগ আর স্টিকার
tour.step.tags.prose = ট্যাগ বই আর সিনেমা দুদিকেই চলে, প্রতিটার নিজের চেহারা। {em1} হলো আপনার নিজের ছবি, উদ্ধৃতিতে সিলমোহরের মতো সাঁটা।
tour.step.tags.em1.label = স্টিকার
tour.step.tags.more = ট্যাগ দেখতে হতে পারে স্টিকার, ব্যানার, ঝুলন্ত পতাকা, টেপ বা রিলের মতো, যেকোনো রঙে; নাম বদলালে সব উদ্ধৃতিতেই বদলায়। স্টিকার হলো আপনার আপলোড করা PNG বা SVG ফাইল; উদ্ধৃতির লেখা তার চারপাশ দিয়ে বয়ে যায়, আর কার্ডের যেকোনো জায়গায় টেনে সরানো যায়।

# Step "metadata".
tour.step.metadata.name = মেটাডেটা আর মানুষ
tour.step.metadata.blurb = কোন ঘরে কত ঘাটতি, একসঙ্গে সারাই, ডুপ্লিকেট এক করা; মানুষ — মুখের ছবি আর লিংক সমেত
tour.step.metadata.title = তাক গুছিয়ে রাখুন
tour.step.metadata.prose = সংগ্রহে কী কী নেই দেখায়, আর একসঙ্গে ঠিক করে দেয়। {em1} পান ছবি আর তথ্যসূত্রের লিংক — যেকোনো লেখক বা অভিনেতার নামে চাপুন।
tour.step.metadata.em1.label = মানুষ
tour.step.metadata.more = প্রতিটা হিসেবই একটা ছাঁকনি: “কভার নেই”-তে চাপলে শুধু সেই বইগুলো দেখাবে। তারপর বাছাইগুলো একসঙ্গে ঠিক করুন, একই জিনিসের দুটো কপি এক করুন, বক্তার নাম অভিনেতার সঙ্গে জুড়ুন, বা কিছু বদলানোর আগে উৎসের সঙ্গে আবার মিলিয়ে নিন।

# Step "stats".
tour.step.stats.name = পরিসংখ্যান
tour.step.stats.blurb = কবে কী তুলেছেন তার ক্যালেন্ডার, স্মৃতির হাল, আর লেখক/অভিনেতা/পরিচালক/ট্যাগে কে কত
tour.step.stats.title = সংখ্যায় আপনার গ্রন্থাগার
tour.step.stats.prose = কবে কী রেখেছেন তার একটা ক্যালেন্ডার, কতটা মনে আছে, আর কোন মানুষ আর ট্যাগে বারবার ফেরেন।
tour.step.stats.more = এখানে সবকিছুতেই চাপা যায়: ক্যালেন্ডারের বিন্দুতে চাপলে সেদিন যা যোগ হয়েছিল খোঁজে দেখায়, আর যেকোনো বই, মানুষ বা ট্যাগও এভাবেই খোলে।

# Step "appearance".
tour.step.appearance.name = চেহারা
tour.step.appearance.blurb = কাগজ না ফিল্ম, হালকা/গাঢ়/সিস্টেম, চারটে অ্যাকসেন্ট — প্রত্যেক ইউজারের নিজের
tour.step.appearance.title = নিজের মতো সাজিয়ে নিন
tour.step.appearance.prose = হালকা, গাঢ় বা সিস্টেম যেমন, নিজের পছন্দের রং, উপাদান-সেট আর কভারের মাপ — প্রত্যেক ব্যবহারকারীর নিজের নিজের।

# Step "keys".
# bn: An API key is a চাবি — the thing that opens a door — here and in every other
# key about them. কী would collide with the question word, and কি with the particle.
tour.step.keys.name = মেটাডেটার চাবি আর Amazon কুকি
tour.step.keys.blurb = TMDB/TheTVDB/Google Books-এর চাবি, আর ইচ্ছে হলে Amazon কুকি (অ্যাডমিন)
tour.step.keys.title = মেটাডেটার চাবি আর Amazon কুকি
tour.step.keys.prose = খোঁজার কাজ চলে উজ্জ্বল করা কার্ডের কী দিয়ে। প্রতিটা ঘর আলাদা করে সেভ হয়, আর তার তথ্য-বিন্দুতে লেখা থাকে কী কোথায় পাবেন। এখনই বসান, বা “পরেরটা” চেপে পরে যোগ করুন।
tour.step.keys.more = TMDB (সিনেমা আর শো) সাধারণত শুরু থেকেই ভাগ করা একটা কী-তে চলে। TheTVDB ঐচ্ছিক, লম্বা চলা শো-এর জন্য প্রায়ই ভালো। Google Books-এ দিনে প্রায় ১,০০০ খোঁজের বেশি হলে তবেই কী লাগে। Amazon কুকি ঐচ্ছিক। বইয়ের জন্য কোনো কী-ই লাগে না।

# Step "backup".
tour.step.backup.name = ব্যাকআপ, ফিরিয়ে আনা আর আপডেট
tour.step.backup.blurb = তারিখ-দেওয়া একটা এনক্রিপ্ট করা আর্কাইভ, এখানে বা অন্য সার্ভারে ফেরানো যায়; চাইলে তবেই হালনাগাদ (অ্যাডমিন)
tour.step.backup.title = নিশ্চিন্তে ঘুমোন
tour.step.backup.prose = এক ক্লিকে সবকিছুর একটা তারিখ-দেওয়া আর্কাইভ তৈরি হয়, আপনার পাসওয়ার্ড দিয়ে {em1}। এখানে ফেরাতে পারেন, বা অন্য Tippani-তে নিয়ে গিয়ে সেখানে।
tour.step.backup.em1.label = এনক্রিপ্ট করা
tour.step.backup.more = আর্কাইভে পাসওয়ার্ডের হ্যাশ আর API কী-ও থাকে, তাই এনক্রিপ্ট করা হয়। আপনার পাসওয়ার্ডে যেকোনো Tippani-তে খোলে, চাইলে আলাদা পাসফ্রেজও দিতে পারেন। চাবিটা কোথাও রাখা হয় না, তাই নিজে যত্নে রাখুন। হালনাগাদ খোঁজা হয় শুধু আপনি চাইলে।

# Step "account".
tour.step.account.name = প্রোফাইল আর ইউজার
tour.step.account.blurb = আপনার ছবি, নাম আর পাসওয়ার্ড, অ্যাকাউন্ট বদল, আর অ্যাডমিনের জন্য ইউজার সামলানো। প্রত্যেকের গ্রন্থাগার আলাদা
tour.step.account.title = আপনার, আর বাকি সবার
tour.step.account.prose = ছবিতে চাপলে আপনার {em1} খোলে — ছবি, নাম, পাসওয়ার্ড, অন্য অ্যাকাউন্টে যাওয়া আর লগ আউট। প্রত্যেকের সংগ্রহ আলাদা।
tour.step.account.em1.label = প্রোফাইল
tour.step.account.more = অ্যাডমিন এখান থেকেই ব্যবহারকারী যোগ করেন, সরান, অ্যাডমিন করেন। শেষ অ্যাডমিন পদ ছাড়তে পারেন না; দায়িত্ব দিতে হলে আগে অন্য কাউকে অ্যাডমিন করুন। অন্য অ্যাকাউন্টে যেতে প্রতিবারই সেই অ্যাকাউন্টের পাসওয়ার্ড লাগে।

# Step "boards" — the Quotes screen.
tour.step.boards.name = বোর্ড
tour.step.boards.blurb = যে লাইনগুলো কোনো বই বা ছবির নয়, সেগুলো বোর্ডে রাখা
tour.step.boards.title = বাকি সব জায়গার লাইন
tour.step.boards.prose = একটা ভাষণ, চিঠি, গান, প্রবাদ, বন্ধুর বলা কোনো কথা। এগুলো এখানে {em1} থাকে — লাইনটা রাখার সময়েই বোর্ড বেছে নেন।
tour.step.boards.em1.label = বোর্ডে
tour.step.boards.more = সাধারণ বোর্ডে যা খুশি রাখা যায়; প্রবাদের বোর্ডে মূল লেখার পাশে থাকে প্রতিবর্ণীকরণ আর অনুবাদ। একটা বোর্ড আলাদা করে ছাঁকা, সাজানো আর রপ্তানি করা যায়। বোর্ড মুছতে গেলে জিজ্ঞেস করে তার উদ্ধৃতিগুলোর কী হবে।

# Step "anthologies" — the Anthologies screen.
tour.step.anthologies.name = সংকলন
tour.step.anthologies.blurb = উদ্ধৃতিগুলো একটা পড়ার ক্রমে সাজানো, মাঝে আপনার নিজের কথা
tour.step.anthologies.title = এগুলো দিয়ে কিছু একটা বানান
tour.step.anthologies.prose = সংকলন কোনো তাক নয়, বরং {em1}: আপনার পছন্দের ক্রমে উদ্ধৃতি, মাঝে মাঝে আপনার নিজের কথা। কোনো বই, ট্যাগ, লেখক বা রঙের দিকে দেখিয়ে দিলে নিজেই ভরে ওঠে।
tour.step.anthologies.em1.label = লেখা
tour.step.anthologies.more = একটা উদ্ধৃতি যত খুশি সংকলনে থাকতে পারে, নিজের জায়গা থেকে সরে না। প্রতিটা অংশে কী দেখাবে বেছে নিন; নিজে ভরতে দিলে পরে খুললেই নতুন মিলগুলো অপেক্ষা করবে। Markdown বা EPUB হিসেবে রপ্তানি করুন।

# Step "filters" — the Search screen.
tour.step.filters.name = সার্চের ছাঁকনি
tour.step.filters.blurb = ফলাফলের উপর ফিল্ড-চিপ, পরিধি আর তারিখ
tour.step.filters.title = আরও ছোট করে আনুন
tour.step.filters.prose = একটা ঘরের নাম আর কোলন লিখুন — tag, author, colour — বাক্সটাই আপনার যা আছে তা সাজিয়ে দেবে। চিপ একটার পর একটা জমে, তাই {em1} ফল আরও ছোট করে; ওপরের সারি দেখায় সংগ্রহের কোন অংশে খুঁজছেন।
tour.step.filters.em1.label = দুটো চিপ
tour.step.filters.more = সত্যিকারের কোলন লিখতে হলে আগে একটা ব্যাকস্ল্যাশ দিন। রঙের নাম, তারিখ আর দশক — সবই চলে, আর ছাঁকা কোনো তাক থেকে এলে তার ছাঁকনিও সঙ্গে আসে। ফলগুলো বেছে ট্যাগ দিন, রং বদলান বা কোনো সংকলনে যোগ করুন।

# Step "bin" — the Bin screen.
tour.step.bin.name = ঝুড়ি
tour.step.bin.blurb = যা মুছেছেন, ফেরত আনা যায়, মেয়াদ শেষ না হওয়া পর্যন্ত
tour.step.bin.title = কিছুই সরাসরি বেরিয়ে যায় না
tour.step.bin.prose = মুছে ফেলা জিনিস আগে এখানে এসে থাকে — উদ্ধৃতিসহ বই, সংলাপসহ সিনেমা, বা একটা হাইলাইট — আর {em1} আবার আগের জায়গায় ফেরে।
tour.step.bin.em1.label = ফিরিয়ে আনলে
tour.step.bin.more = প্রতিটা সারি দেখায় জিনিসটা কী ছিল আর কবে মোছা হয়েছে। চাইলে এখনই একটা চিরতরে সরান, বা পুরো বিন খালি করুন; নইলে এখানে বাঁধা দিন পেরোলে নিজেই মুছে যায়।

# Step "checks" — the Checks screen.
tour.step.checks.name = যাচাইকরণ
tour.step.checks.blurb = আপনার জন্য অপেক্ষা করা দুটো তালিকা — আমদানি, আর যেসব উদ্ধৃতিতে গোলমাল আছে
tour.step.checks.title = কী কী আপনার জন্য অপেক্ষা করছে
tour.step.checks.prose = এক পর্দায় দুটো তালিকা: আমদানি করা উদ্ধৃতি যেগুলো অনুমোদনের অপেক্ষায়, আর যেসব উদ্ধৃতিতে কিছু একটা {em1} লাগছে।
tour.step.checks.em1.label = গোলমেলে
tour.step.checks.more = প্রতিটা তালিকার নিজের পর্দা আর লিংকও আছে। এখানে দেখা হয় লেখাটা ঠিক আছে কি না — মনে রাখার ব্যাপার নয়।

# Step "cleanup" — the Cleanup screen.
tour.step.cleanup.name = পরিষ্কার
tour.step.cleanup.blurb = পাতা যা ছেড়ে গেছে — পৃষ্ঠাসংখ্যা, ভাঙা হাইফেন, পাদটীকার চিহ্ন
tour.step.cleanup.title = পাতা যা ফেলে রেখে গেছে
tour.step.cleanup.prose = প্রতিটা উদ্ধৃতি পড়ে দেখে কোনটা লেখকের নয়, বরং {em1} থেকে এসেছে: ভুল করে ঢুকে পড়া পাতার নম্বর, লাইন ভাঙার হাইফেন, পাদটীকার চিহ্ন।
tour.step.cleanup.em1.label = পাতা
tour.step.cleanup.more = যা পায় শুধু তালিকা করে; নিজে থেকে কিছু বদলায় না। নিয়ম ধরে ছাঁকুন, সারি খুলে ঠিক করুন, আর সংগ্রহ খুব বড় হলে বাকিটার জন্য আবার চালান।

# Step "staging" — the imports waiting room.
tour.step.staging.name = অপেক্ষায় থাকা আমদানি
tour.step.staging.blurb = আমদানি আগে এখানে নামে, সায় পেলে তবে বেরোয়
tour.step.staging.title = না দেখে কিছু ঢোকে না
tour.step.staging.prose = যতক্ষণ না আপনি {em1}, আমদানি করা জিনিস এখানেই থাকে — তাই ভুল আমদানি সংগ্রহে ঢোকে না।
tour.step.staging.em1.label = সায় দেন
tour.step.staging.more = পুরো দলটা একসঙ্গে ঠিক করুন — কোন বই, বক্তার নাম, রং — তারপর যা চান অনুমোদন দিন, বাকিটা বাদ দিন। এখানকার কিছুই এখনো আপনার সংগ্রহে ঢোকেনি।

# Step "book" — a book's own page.
tour.step.book.name = বইয়ের নিজের পাতা
tour.step.book.blurb = তার খুঁটিনাটি, তার দাগানো অংশ, আর দুটোতেই যা করা যায়
tour.step.book.title = একটা বই সম্পর্কে সব কিছু
tour.step.book.prose = ওপরে বইয়ের তথ্য, নিচে সব হাইলাইট। এখানে ＋ চাপলে {em1} যোগ হয়, আরেকটা বই নয়।
tour.step.book.em1.label = এই বই থেকে একটা উদ্ধৃতি
tour.step.book.more = হিসেবগুলোয় চাপলে ছাঁকা যায়, ♥ দিয়ে বই বা আলাদা উদ্ধৃতি চিহ্নিত হয়, আর তাকের চিপ দেখায় বইটা পড়ছেন কি না। কপি, শেয়ার আর রপ্তানি — একটা হাইলাইটে বা কয়েকটা বেছে নিয়ে।

# Step "film" — a film's own page.
tour.step.film.name = ছবির নিজের পাতা
tour.step.film.blurb = কুশীলব, কৃতজ্ঞতা আর আপনার তুলে রাখা প্রতিটি লাইন
tour.step.film.title = একটা ছবি সম্পর্কে সব কিছু
tour.step.film.prose = স্টুডিও, প্রকাশক আর অভিনেতাদের তালিকা — যার সঙ্গে {em1} নাম মেলানো হয় — আর নিচে আপনার রাখা সব লাইন।
tour.step.film.em1.label = বক্তাদের
tour.step.film.more = নাম হিসেবে লেখা বক্তাকে অভিনেতাদের তালিকার সঙ্গে জুড়ে দেওয়া যায়, তখন তাঁর চিপে চাপলে মানুষটার পাতা খোলে। কণ্ঠশিল্পীদের তালিকা আলাদা থাকে। এখানে ＋ চাপলে এই সিনেমায় একটা লাইন যোগ হয়।

# Step "done".
tour.step.done.title = ট্যুর এই পর্যন্তই
tour.step.done.prose = এই হলো সব। যেকোনো পর্দার {em2} সেখানকার নিয়ন্ত্রণগুলো বুঝিয়ে দেয়, আর সেখানেই ট্যুরটা আবার দেখায় — ট্যুর এখন চলে {em1}। উপভোগ করুন।
tour.step.done.em1.label = এক-একটা স্ক্রিন ধরে
tour.step.done.em2.label = ?

# The tour's own chrome. {done} of {total} counts steps, and {total} varies: an
# admin sees two steps nobody else does, and a switched-off section drops its own.
tour.progress.label = {done} / {total}
# Saves your place and closes. Escape does the same thing.
tour.later.label = বাকিটা পরে
# Ends the tour for good.
tour.skip.label = ট্যুর বাদ দিন
help.tour.label.one = এই পাতাটা ঘুরিয়ে দেখান (১টি ধাপ)
help.tour.label.other = এই পাতাটা ঘুরিয়ে দেখান ({n}টি ধাপ)
tour.reenable.label = ট্যুর আবার চালু করুন
tour.toast.reenabled = ট্যুর আবার চালু হল।
tour.back.aria = আগের ধাপ
tour.next.label = পরেরটা
# The last step's Next.
tour.finish.label = শেষ করুন
# One toast per way out, so which one you took is never in doubt.
tour.toast.done = ট্যুর শেষ · প্রতিটা স্ক্রিনের ? থেকে সেই স্ক্রিনের ট্যুর দেখা যায়
tour.toast.skipped = ট্যুর বাদ · প্রতিটা স্ক্রিনের ? থেকে সেই স্ক্রিনের ট্যুর দেখা যায়
tour.toast.postponed = পরের জন্য রাখা হল · প্রতিটা স্ক্রিনের ? থেকে সেই স্ক্রিনের ট্যুর দেখা যায়

# THE BUILT-IN SAMPLE QUOTES, rendered under the Library and Catalogue steps so
# an empty library still shows what a captured quote looks like. Both are public
# domain. A LANGUAGE MAY REPLACE THEM WITH ITS OWN: the point is to show the
# shape of a kept line, and a line nobody in the room can read does not.
# Leave the titles and the names alone if you keep these two.
# bn: The book specimen is Bengali — the first song of গীতাঞ্জলি (1910), public
# domain, and known to every reader in the room. The film line stays Casablanca: a
# Bengali library of kept lines has English films in it, and no Bengali film line
# of that fame is out of copyright.
tour.demo.book.quote.prose = আমার মাথা নত করে দাও হে তোমার চরণধুলার তলে।
tour.demo.book.title = গীতাঞ্জলি
tour.demo.book.author.label = রবীন্দ্রনাথ ঠাকুর
tour.demo.book.meta.label = গান 1
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
quotes.starter.proverbs.name = প্রবাদ
quotes.starter.proverbs.description = মুখে মুখে চলে আসা, কারও নামে নয়।
quotes.starter.speeches.name = ভাষণ
quotes.starter.speeches.description = ভরা ঘরে, গলা তুলে বলা।
quotes.starter.others.name = অন্যান্য
quotes.starter.others.description = রেখে দেওয়ার মতো বাকি সব।

# The board list itself.
quotes.board.new.label = নতুন বোর্ড
quotes.board.all.label = সব উক্তি
# The toggle that folds hidden boards back in. "In use" is the default view.
quotes.board.hidden.aria = লুকোনো বোর্ড
quotes.board.hidden.inuse.label = চালু
quotes.board.hidden.all.label = সব {n}
# What a reader with no standalone quotes lands on. {em1} is the New board
# button, named again in bold so the sentence points at a real control.
quotes.board.list.loading = আপনার বোর্ডগুলো পড়া হচ্ছে…
quotes.board.list.empty = এখনো কোনো বোর্ড নেই। {em1}-এ তিনটে দিয়ে শুরু করা যায় — প্রবাদ, ভাষণ আর অন্যান্য — বা নিজের পছন্দের যেকোনো নামে। ওপরের বারের ＋ দিয়ে একটা উক্তি রাখলেও প্রথম বোর্ডটা তৈরি হয়ে যায়।

# The board form, new and editing.
quotes.board.form.new.title = নতুন বোর্ড
quotes.board.form.edit.title = বোর্ড এডিট করুন
# The example name in the empty Name box.
quotes.board.form.name.placeholder = প্রবাদ
quotes.board.form.clash.error = এই নামে একটা বোর্ড আগে থেকেই আছে।
# WHAT the board holds, which is not the same question as what it is called: a
# proverb board puts the language and the translation first on the quote form.
quotes.board.form.kind.label = কী থাকবে
quotes.board.form.kind.aria = কী থাকবে
quotes.board.kind.plain.label = উক্তি
quotes.board.kind.proverb.label = প্রবাদ
# Under the three starter chips. Pressing one fills the form in; it does not
# create anything.
quotes.board.form.starters.hint = ফর্মটা ভরে দেয়। তৈরি করার আগে যা খুশি বদলে নিন।
quotes.board.form.languages.label = ভাষা
quotes.board.form.languages.hint = উদ্ধৃতির ফর্মে বাছার জন্য থাকে, আর ভাষার ভাগগুলো এই ধরেই সাজানো হয়।
quotes.board.form.language.label = আরেকটা ভাষা
quotes.board.form.language.placeholder = তামিল, ইওরুবা…
quotes.board.form.colour.label = রং
quotes.board.form.description.label = কীসের জন্য
quotes.board.form.description.placeholder = মুখে মুখে চলে আসা, কারও নামে নয়।
# The upload control for the board's own picture.
quotes.board.form.picture.label = ছবি

quotes.board.toast.picture-saved = ছবি সেভ হয়েছে
quotes.board.toast.deleted = বোর্ড মোছা হয়েছে

# Deleting a board. {name} is the board's own name.
quotes.board.delete.confirm.title = {name} মুছবেন?
# The refusal: nowhere to put the quotes. Said plainly rather than shown as a
# disabled button with no reason. {noun} arrives from unit.quote.
quotes.board.delete.only.body = এটাই আপনার একমাত্র বোর্ড, আর এতে {n}টা {noun} আছে। আগে আরেকটা বোর্ড বানান, যাতে এগুলো কোথাও রাখা যায়।
# English inflects the VERB with the count here, not just the noun, so the two
# forms carry the whole sentence rather than substituting a noun into one.
quotes.board.delete.holds.body.one = এখানে {n}টা উক্তি রাখা আছে। সেগুলো মুছবে না, অন্য বোর্ডে চলে যাবে।
quotes.board.delete.holds.body.other = এখানে {n}টা উক্তি রাখা আছে। সেগুলো মুছবে না, অন্য বোর্ডে চলে যাবে।
quotes.board.delete.move.aria = উক্তিগুলো কোন বোর্ডে যাবে
quotes.board.delete.empty.body = এখানে কিছুই রাখা নেই।

# THE MOVE-TO-BOARD SHEET, opened from a card's ⋯ and from the selection bar,
# so common.* rather than quotes.*.
common.board.move.title.one = এই উক্তি পাঠান
common.board.move.title.other = {n}টা উক্তি পাঠান
common.board.move.body.one = কোন বোর্ডে থাকবে, শুধু সেটাই বদলায়। উক্তির আর কিছু নয়।
common.board.move.body.other = {n}টাই একটা বোর্ডে যাবে। আর কিছুই বদলায় না।
common.board.move.empty = পাঠানোর জায়গা নেই — আগে একটা বোর্ড তৈরি করুন।
common.board.move.select.placeholder = একটা বোর্ড বাছুন

# Two more shared verbs, and the pair on a board's own menu. The words say what
# pressing them DOES, so Hide is on a board that is currently visible.
common.action.create.label = তৈরি করুন


error.upload.generic = ওটা আপলোড করা গেল না
error.save.board = বোর্ডটা সেভ করা গেল না
error.delete.board = বোর্ডটা মোছা গেল না
error.validate.board-name-required = বোর্ডটার একটা নাম দিন

# ---------------------------------------------------------------------------
# ANTHOLOGIES (anthologies.jsx)
#
# Quotes gathered into a chosen READING ORDER, with the reader's own prose
# between them. Not a board (which says where a quote is filed) and not a tag
# (which says what it is about): an anthology is a piece of writing, so the
# words here are an editor's words rather than a filing system's.
# ---------------------------------------------------------------------------

anthologies.list.new.label = নতুন সংকলন
# The empty state names the way IN rather than reporting that the list is empty:
# nothing on this screen can add an entry, by design. {em1} is the New anthology
# button, {em2} the selection bar's Add to anthology.
# bn: selection bar → বাছাই-বার, the strip that appears under a ticked selection.
anthologies.list.empty = এখনো কোনো সংকলন নেই। {em1} চাপলে একটা তৈরি হয় — কিংবা যেকোনো অংশের মেনু থেকে {em2} বাছুন, সংকলনটা নিজেই তৈরি হয়ে যাবে।

# The form. A duplicate title is fine here, unlike a board, so there is no clash
# warning to write.
anthologies.form.new.title = নতুন সংকলন
anthologies.form.edit.title = সংকলন এডিট করুন
anthologies.form.title.placeholder = শোক নিয়ে
anthologies.form.intro.label = ভূমিকা
anthologies.form.intro.placeholder = এই বাক্যগুলোই কেন, আর এই ক্রমেই কেন।

# The anthology as it reads. {title} falls back to this while it is loading.
anthologies.read.title.fallback = সংকলন
anthologies.read.back.label = সব সংকলন
anthologies.read.empty = এখানে এখনো কিছু নেই। গ্রন্থাগার, ক্যাটালগ বা উক্তি থেকে কয়েকটা বেছে বাছাইয়ের বার থেকে {em1} চাপুন।

# One entry. The reader's note reads ABOVE the quote, which is the shape of every
# anthology ever printed: the editor introduces the piece, then the piece speaks.
anthologies.entry.more.aria = এই এন্ট্রির জন্য আরও
anthologies.entry.note.title = আপনার নোট
anthologies.entry.note.body = এই অংশটা এখানে কেন — সেটা। উদ্ধৃতির উপরে ছাপা হয়।
anthologies.entry.note.placeholder = এই বাক্যটা যে মোড় নেয়।
anthologies.entry.note.add.label = নোট যোগ করুন
anthologies.entry.note.edit.label = নোট এডিট করুন
# The attribution line under a quote with no credit recorded.
# bn: সংগৃহীত is what Bengali print puts under a line nobody is credited for.
anthologies.entry.unattributed.label = সংগৃহীত
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
anthologies.form.fields.label = প্রতিটা উদ্ধৃতির সঙ্গে দেখান
anthologies.form.fields.hint = যা চালু করবেন, প্রতিটা অংশের নিচে ছাপা হবে — পড়ার সময়েও, রপ্তানিতেও।
anthologies.form.fields.count = {total}-এর মধ্যে {shown}টি দেখানো হচ্ছে

anthologies.fill.title = এতে কী কী থাকবে
anthologies.fill.body = অংশগুলো কোথা থেকে আসবে বেছে নিন। এখনই যোগ হবে, আর পরে নতুন কিছু এলে সেটাও যোগ হতে পারে।
anthologies.fill.none = এখনও কিছু নয় — যেকোনো উদ্ধৃতির মেনু থেকে নিজে হাতে যোগ করতে পারেন।
anthologies.fill.set = {what}। তৈরি করার সময়েই যোগ হবে।
anthologies.fill.set.auto = {what}। তৈরি করার সময়ে যোগ হবে, আর পরেও আসতে থাকবে।
anthologies.fill.of = {what}: {value}
anthologies.fill.blocked = কোনটা, সেটা বাছুন।
anthologies.fill.pick.placeholder = লিখতে শুরু করুন
anthologies.fill.all.label = লাইব্রেরির সবকিছু
anthologies.fill.book.label = একটি বই
anthologies.fill.movie.label = একটি ছবি বা শো
anthologies.fill.tag.label = একটি ট্যাগ
anthologies.fill.author.label = একজন লেখক
anthologies.fill.colour.label = একটি রং
anthologies.fill.shelf.label = একটি তাক
anthologies.fill.favourite.label = আমার পছন্দের
anthologies.fill.dates.label = যে সময়ের মধ্যে রাখা
anthologies.fill.from.label = থেকে
anthologies.fill.to.label = পর্যন্ত
anthologies.fill.dates.both = {from} থেকে {to}-র মধ্যে রাখা
anthologies.fill.dates.from = {date} থেকে রাখা
anthologies.fill.dates.to = {date} পর্যন্ত রাখা

anthologies.eg.hide-credit = সেনেকা · লেখক
anthologies.eg.hide-source = অন দ্য শর্টনেস অফ লাইফ
anthologies.eg.show-locator = অধ্যায় ৪ · পৃ. ১১২
anthologies.eg.show-date = ৩ মার্চ ২০২৬-এ রাখা
anthologies.eg.hide-commentary = “এই লাইনটা যেখানে ঘোরে” — আপনার নোট
anthologies.eg.hide-colour = বাঁ দিকের হলুদ দাগ
anthologies.eg.author = সেনেকা
anthologies.eg.director = হৃষীকেশ মুখোপাধ্যায়
anthologies.eg.translator = সি. ডি. এন. কস্টা
anthologies.eg.editor = বেটি র‍্যাডিস
anthologies.eg.publisher = পেঙ্গুইন
anthologies.eg.year = ১৯৬৯
anthologies.eg.series = গ্রেট আইডিয়াজ
anthologies.eg.subtitle = ও অন্যান্য রচনা
anthologies.eg.isbn = 978-0-14-303795-9
anthologies.eg.pages = ১১২ পৃষ্ঠা
anthologies.eg.media-type = পেপারব্যাক
anthologies.eg.bio = রোমান স্টোয়িক, নিরোর শিক্ষক
anthologies.eg.born = জন্ম খ্রি.পূ. ৪
anthologies.eg.died = মৃত্যু ৬৫ খ্রি.
anthologies.eg.links = উইকিপিডিয়া
anthologies.eg.portrait = লাইনের পাশে তাঁর ছবি
anthologies.eg.character-portrait = লাইনের পাশে চরিত্রের মুখ
anthologies.form.fields.credit.label = কে বলেছেন
anthologies.form.fields.source.label = কোথা থেকে নেওয়া
anthologies.form.fields.locator.label = অধ্যায়, পৃষ্ঠা বা সময়
anthologies.form.fields.date.label = যেদিন তুলে রেখেছিলেন
anthologies.form.fields.commentary.label = আপনার নিজের কথা
anthologies.form.fields.colour.label = রঙের পটি
anthologies.form.fields.work.label = বই বা ছবি সম্পর্কেও দেখান
anthologies.form.fields.work.hint = প্রতিটা অংশ যে বই বা সিনেমা থেকে, তার তথ্য। শুরুতে বন্ধ; যার যেটুকু তথ্য আছে সেটুকুই দেখায়।
anthologies.form.fields.person.label = মানুষটি সম্পর্কেও দেখান
anthologies.form.fields.person.hint = লেখক, অভিনেতা বা বক্তার তথ্য। তাঁর রেকর্ড থাকলে তবেই দেখায়।
anthologies.action.epub.label = EPUB
anthologies.rule.now.label = এখন যা নিচ্ছে
anthologies.rule.now.hint = কোনো বাছাই বা খোঁজ থেকে তৈরি। নিচে একটা উৎস বাছলে এটা বদলে যাবে।
anthologies.rule.credits.note = লেখক, অভিনেতা, চরিত্র আর বক্তা মেলানো হয় উদ্ধৃতি বা তার বই-সিনেমায় লেখা নাম ধরে। যে লাইনে কারও নাম নেই, সিনেমার তালিকায় অভিনেতা থাকলেও তাঁর নামে সেটা মিলবে না।
anthologies.rule.auto.label = চালু রাখুন
anthologies.rule.auto.hint = খুললে নতুন যা মিলেছে তা গুনে দেখায় আর যোগ করতে বলে। আপনি না বললে কিছু যোগ হয় না।
anthologies.rule.preview.action = কী কী আসবে?
anthologies.rule.preview = {matched}টা মিলেছে। {added}টা যোগ হবে, {skipped}টা আগে থেকেই আছে।
anthologies.rule.capped = একবারে দুশো; বাকিটার জন্য আবার চাপুন।
anthologies.rule.filled = {added}টা যোগ হল, {skipped}টা আগে থেকেই ছিল
anthologies.rule.waiting = অপেক্ষায় থাকা {n}টা যোগ করুন
anthologies.rule.empty = রুলে মেলানোর মতো কিছু দিন।

anthologies.toast.deleted = সংকলন মোছা হয়েছে
anthologies.toast.entry-removed = এন্ট্রি সরানো হয়েছে

# Deleting one. UNUSUAL TWICE OVER: it does not go to the bin, and what is lost
# is the reader's own writing while the quotes themselves are untouched. Saying
# both halves is what makes it a question somebody can answer.
anthologies.delete.confirm.title = {title} মুছবেন?
anthologies.delete.confirm.body = ভূমিকা আর এর {n}টা {noun}-এর নোট মুছে যাবে। উদ্ধৃতিগুলো নিজেদের জায়গাতেই থাকবে।
anthologies.delete.confirm.note = এটা ডাস্টবিনে গিয়ে পড়ে থাকে না, তাই ফিরিয়ে আনারও কিছু থাকে না।

# THE ADD-TO-ANTHOLOGY SHEET, opened from the selection bar on three different
# screens, so common.* rather than anthologies.*.
common.anthology.add.title.one = এই উদ্ধৃতি যোগ করুন
common.anthology.add.title.other = {n}টা উদ্ধৃতি যোগ করুন
common.anthology.add.body.one = সংকলনের শেষে গিয়ে বসবে। উদ্ধৃতিটা নিজে যেখানে আছে, সেখানেই থাকে।
common.anthology.add.body.other = {n}টাই সংকলনের শেষে গিয়ে বসবে। উদ্ধৃতিগুলো নিজেরা যেখানে আছে, সেখানেই থাকে।
# Reachable with the Anthologies section switched OFF, which is why it names the
# switch as well as the screen — a dead end otherwise.
common.anthology.add.combo.placeholder = খুঁজুন, বা নতুন নাম লিখুন
common.anthology.add.blocked = আগে একটা সংকলনের নাম দিন।
common.anthology.add.existing = এই নামে আপনার যেটা আছে, তাতেই যাবে।
common.anthology.add.creating = “{title}” নামে নতুন একটা সংকলন তৈরি হবে।

common.anthology.gather.title = সংকলনে জড়ো করুন
common.anthology.gather.body = এই খোঁজে যা মিলবে তা সংকলনের শেষে যোগ হবে। কিছু সরে না, ক্রমও বদলায় না, আর আপনার লেখা নোটগুলো যেমন আছে থাকে।

# Reordering an entry. No drag: a drag has no keyboard equivalent, and a menu row
# is reachable by tab, by arrow key and by a thumb.
common.action.move-up.label = উপরে তুলুন
common.action.move-down.label = নিচে নামান


error.load.anthologies = সংকলনগুলো আনা গেল না
error.open.anthology = সংকলনটা খোলা গেল না
error.save.anthology = সংকলনটা সেভ করা গেল না
error.delete.anthology = সংকলনটা মোছা গেল না
error.save.note = নোটটা সেভ করা গেল না
error.remove.entry = এন্ট্রিটা সরানো গেল না
error.move.entry = এন্ট্রিটার জায়গা বদলানো গেল না
error.validate.anthology-title-required = সংকলনটার একটা নাম দিন

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
quotes.starter.title = বাছাই করা একটা সেট দিয়ে শুরু করুন
quotes.starter.body = প্রতিটায় দশটা, কারও নাম ছাড়া; যা ইংরেজিতে নয় তার সঙ্গে ইংরেজি অনুবাদ।
# {n} is how many will land, {name} the language they are in.
# bn: {name} is the language as the server names it, so it sits in brackets rather
# than inside the Bengali sentence.
quotes.starter.take.label = {n}টা যোগ করুন ({name})
quotes.starter.take.busy = যোগ হচ্ছে…
# Asking twice adds nothing, and says so rather than implying a second copy.
quotes.starter.added.label = {n}টা যোগ হয়েছে
quotes.starter.already.label = আগে থেকেই আছে

# The capture / edit form for a standalone quote.
# "When" rather than "Date": a year alone is a complete answer here.
quotes.form.when.label = কবে
# What sort of line it is — speech, letter, essay, proverb or other. Not WHERE it is filed:
# that is the board, chosen on the board itself.
quotes.form.kind.label = ধরন

# The board being read.
quotes.board.back.label = সব বোর্ড
quotes.board.empty = এই বোর্ডে এখনও কিছু নেই — উপরের বারের ＋ দিয়ে যেখান থেকে খুশি একটা বাক্য তুলে রাখুন
quotes.board.nomatch = এই ফিল্টারে কোনও উক্তি মিলল না
# Under the board title. The second form is used where the board has a
# description of its own; the separator is inside the value on purpose.
quotes.board.counts = {n} {noun}
quotes.board.counts-described = {n} {noun} · {description}

# The filters. The colour swatch row doubles as its own off switch.
quotes.filters.colour.aria = রং ধরে ফিল্টার
quotes.filters.speaker.aria = বক্তা ধরে ফিল্টার
quotes.filters.speaker.all.label = সব বক্তা
quotes.filters.kind.aria = ধরন ধরে ফিল্টার
quotes.filters.kind.all.label = সব ধরন
quotes.filters.language.aria = ভাষা ধরে ফিল্টার
quotes.filters.language.all.label = সব ভাষা

# Group by. "Quotes" here means UNGROUPED — one pile.
# bn: The ungrouped option says so — "one pile" — rather than repeating the tab's name.
quotes.group.none.label = ভাগ নেই
quotes.group.speaker.label = বক্তা
quotes.group.kind.label = ধরন
quotes.group.place.label = জায়গা
quotes.group.decade.label = দশক
# Offered on a proverb board only: on a board of speeches the field is empty on
# every row, which would be one section called "No language" holding all of it.
quotes.group.language.label = ভাষা
# The catch-all section heading, per dimension. It says WHAT IS MISSING rather
# than "None", because a proverb lands in the catch-all of every one of these.
quotes.group.residual.speaker.label = বক্তা নেই
quotes.group.residual.kind.label = ধরন দেওয়া নেই
quotes.group.residual.place.label = জায়গা নেই
quotes.group.residual.language.label = ভাষা নেই
quotes.group.residual.none.label = নেই

# Sort.
quotes.sort.recent.label = নতুন আগে
quotes.sort.speaker.label = বক্তা
quotes.sort.occasion.label = উপলক্ষ
quotes.sort.said.label = কবে বলা

quotes.delete.confirm = এই উক্তিটা মুছবেন?
quotes.toast.moved = পাঠানো হয়েছে
quotes.export.confirm.title = উক্তি এক্সপোর্ট
quotes.export.confirm.body.one = পর্দায় থাকা {n}টা উক্তি একটা Markdown ফাইলে রপ্তানি হবে, যা Tippani-তে আবার আমদানি করা যায়।
quotes.export.confirm.body.other = পর্দায় থাকা {n}টা উক্তি একটা Markdown ফাইলে রপ্তানি হবে, যা Tippani-তে আবার আমদানি করা যায়।
# The lower-case small-caps labels above a control in a filter sheet or a form.
# Their Title Case twins are common.field.*.label and are different strings.
common.mono.actions.label = কাজ

# The lower-case small-caps labels above a control in a filter sheet or a form.
# Their Title Case twins are common.field.*.label and are different strings.
common.mono.colour.label = রং
common.mono.group.label = ভাগ
common.mono.view.label = দৃশ্য
common.mono.sort.label = ক্রম
common.mono.tag.label = ট্যাগ
common.mono.speaker.label = বক্তা
common.mono.medium.label = মাধ্যম
common.mono.language.label = ভাষা

# Filter controls shared by the Library, the Catalogue and Quotes.
common.filters.tag.aria = ট্যাগ ধরে ফিল্টার
common.filters.tag.all.label = সব ট্যাগ
common.filters.group.aria = কী ধরে ভাগ

error.add.starters = ওগুলো যোগ করা গেল না
error.move.generic = পাঠানো গেল না
error.validate.quote-required = উক্তিটা লিখুন
error.validate.date = তারিখটা দেখে নিন

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
share.dialog.aria = উদ্ধৃতি শেয়ার
share.dialog.title = শেয়ার
share.format.label = ফরম্যাট
share.format.aria = শেয়ারের ফরম্যাট
share.include.label = কী কী যাবে
share.text.label = লেখা
share.text.aria = শেয়ার করার লেখা
share.preview.label = যেমন দেখাবে
share.preview.empty = কিছুই বাছা হয়নি

# THE FOUR TEXT FORMATS AND THE PICTURE. .name is the row in the format toggle
# — all four are PROPER NOUNS and must not be translated. .what says exactly
# which syntax will be produced, and .hint is a mono sample of that syntax:
# ⚠ THE .hint VALUES ARE LITERAL MARKUP. Translate the words inside them (bold,
# italic, quote, code, text, url) only if you are sure; never the punctuation.
share.format.whatsapp.name = WhatsApp
share.format.whatsapp.what = WhatsApp-এর নিজস্ব ফরম্যাট: মোটা আর বাঁকা লেখার চিহ্ন, হেডিং নেই। লিংক খালি ঠিকানা হয়েই থাকে।
# bn: The three markup hints stay Latin: they are the literal characters a reader
# types, and only the Plain hint describes a shape rather than showing syntax.
share.format.whatsapp.hint = *bold*  _italic_  ~strike~  > quote  \`\`\`code\`\`\`
share.format.plaintext.name = সাধারণ লেখা
share.format.plaintext.what = X, SMS বা যেখানে ফরম্যাট চলে না তার জন্য সাধারণ লেখা: উদ্ধৃতিচিহ্নের ভিতরে উদ্ধৃতি, নিচে — দিয়ে নামের লাইন।
share.format.plaintext.hint = মার্কআপ নেই · “…” · — লেখক, নাম · #ট্যাগ
share.format.markdown.name = Markdown
share.format.markdown.what = পুরোদস্তুর Markdown — GitHub, Obsidian, Notion আর বেশির ভাগ এডিটরে সেজে ওঠে।
share.format.markdown.hint = **bold**  *italic*  ~~strike~~  > quote  \`code\`  [text](url)
share.format.reddit.name = Reddit
share.format.reddit.what = Reddit-এর markdown (পুরনো আর নতুন দুটোতেই) — Markdown-এর মতোই, \`> \` দিয়ে উদ্ধৃতি আর [text](url) দিয়ে লিংক।
share.format.reddit.hint = **bold**  *italic*  ~~strike~~  > quote  [text](url)
# The picture has no syntax to describe, so its help says what the thing IS.
share.format.image.name = ছবি
share.format.image.what = উদ্ধৃতির একটা ছবি, আপনার বাছা সাজে এই যন্ত্রেই আঁকা — কিছুই আপলোড হয় না। যা যা চান টিক দিন, তারপর ডাউনলোড বা কপি করুন।

# THE TICK LABELS under "include" — one per part of the quote the reader can
# keep or drop. They name the same columns the forms do, but they are the
# share sheet's own words: a reader deciding what to send is asking a different
# question from a reader filling a form in.
share.field.quote.label = উদ্ধৃতি
share.field.author.label = লেখক
# The work, named the way its side names it: a book, a film or show.
share.field.work.book.label = বই
share.field.work.film.label = টাইটেল
share.field.published.label = প্রকাশের সাল
share.field.released.label = মুক্তির সাল
share.field.chapter.label = অধ্যায়
share.field.location.label = লোকেশন
# The day YOU saved the line, as against the year the work came out.
share.field.noted.label = তোলার দিন
# ⚠ Proper nouns. Do not translate.
share.field.tmdb.label = TMDB
share.field.tvdb.label = TVDB
share.field.character.label = চরিত্র
share.field.actor.label = অভিনেতা
share.field.episode.label = এপিসোড
share.field.time.label = সময়
share.field.speaker.label = বক্তা
share.field.occasion.label = উপলক্ষ
share.field.when.label = কবে
share.field.place.label = জায়গা
share.field.medium.label = ধরন
share.field.tags.label = ট্যাগ
share.field.note.label = নোট
# A proverb's English translation. Ticked by default, unlike the note: a proverb
# IS its own language plus what it says, so a share carrying only the original is
# half the quote to anybody who cannot read it.
share.field.translation.label = অনুবাদ
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
share.field.proverb.label = ধরন
share.field.proverb.legend = {value} প্রবাদ

# THE CREDIT PHRASES THEMSELVES — these go into the text somebody else reads.
share.credit.chapter.phrase = অধ্যায় {n}
# The page number. "p." is the abbreviation a printed citation uses.
share.credit.location.phrase = পৃ. {n}
share.credit.actor.phrase = অভিনয়ে {value}
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
share.image.theme.label = থিম
share.image.theme.aria = ছবির থিম
share.image.theme.info.title = ছবির থিম
share.image.theme.info.body = ছবিটা হালকা হবে না গাঢ় — শুধু ছবির জন্য, অ্যাপের থিম বদলায় না। শুরুতে আপনার এখনকার থিমই থাকে।
# The two skins. One palette per mode means the mode is the only thing that
# differs in the drawing.
share.image.theme.light.label = হালকা
share.image.theme.dark.label = গাঢ়
share.image.material.label = নকশা
share.image.material.aria = ছবির নকশা
# How a credited person appears. Offered only when somebody credited has a photo.
share.image.facekind.label = মুখ
share.image.facekind.aria = কার ছবি কার্ডে আঁকা হবে
share.image.facekind.actor.label = অভিনেতা
share.image.facekind.character.label = চরিত্র
share.image.facekind.info.title = মুখ
share.image.facekind.info.body = কার্ডে কার ছবি যাবে: অভিনেতার, না চরিত্রের। দুজনের ছবিই সংরক্ষিত থাকলে তবেই এই বিকল্প আসে।
# How a credited person appears. Offered only when somebody credited has a photo.
share.image.portrait.label = মুখের ছবি
share.image.portrait.aria = মুখের ছবি
share.image.portrait.chip.label = চিপ
share.image.portrait.backdrop.label = পটভূমি
share.image.portrait.info.title = মুখের ছবি
share.image.portrait.info.body = চিপ: নামের পাশে ছোট গোল ছবি। পটভূমি: সেই ছবিই কিনারা থেকে আবছা হয়ে ঢোকে। যাঁর নাম আছে তাঁর ছবি থাকলে তবেই দেখা যায়।
share.image.sides.label = দিক
share.image.sides.aria = কে কোন দিকে
share.image.sides.as-credited.label = নামের ক্রমে
share.image.sides.swap.label = উল্টে দিন
share.image.sides.info.title = দিক
share.image.sides.info.body = যাঁদের নাম আছে, তাঁদের কে আগে থাকবেন। চিপে কার মুখ সামনে থাকবে তা বদলায়; পটভূমিতে দুই পাশ অদলবদল হয়।
# Whether the quote's own filing colour shows in the picture. Off by default.
share.image.colour.aria = উদ্ধৃতির রং
share.image.colour.info.title = উদ্ধৃতির রং
share.image.colour.info.body = উদ্ধৃতির রংটা ছবিতে যোগ হয় — একটা ডোরা, বা পটভূমিতে হালকা আভা। শুরুতে বন্ধ থাকে।
share.image.preview.aria = উদ্ধৃতির কার্ড যেমন দেখাবে
share.image.share.aria = ছবি শেয়ার
share.image.share.tip = এই ছবিটা শেয়ার করুন
share.image.copy.label = ছবি কপি
share.image.copy.unsupported.error = এখানে ছবি কপি করা যায় না — ডাউনলোড করুন
# Drawn in the bottom-left of the picture, before the wordmark. It is what makes
# the line a CREDIT rather than a claim on the words above it.
# bn: "made with" cannot carry over: the wordmark follows this label, and a Bengali
# credit line reads forward as সৌজন্যে টিপ্পনী.
share.image.footer.credit.label = সৌজন্যে

# The two-state toggles this screen uses, and the copy button's done state.
common.toggle.on.label = চালু
common.toggle.off.label = বন্ধ
common.action.copy.done.label = কপি হয়েছে ✓
common.toast.copied = কপি হয়েছে

error.copy.generic = কপি করা গেল না
error.render.image = এই যন্ত্রপাতিতে ছবিটা আঁকা গেল না

# ---------------------------------------------------------------------------
# THE QUIZ CARD (review.jsx)
#
# One runner behind the Daily Quiz, Practice, and a themed round started from a
# work tile, a tag, a person or a colour. quiz.* is a MODE rather than a screen.
# ---------------------------------------------------------------------------

# What a card calls its own source in the question line. A standalone quote has
# no work behind it, so its source is the OCCASION it was said on.
quiz.noun.book.label = বই
quiz.noun.film.label = সিনেমা
quiz.noun.show.label = শো
quiz.noun.occasion.label = উপলক্ষ

# The prompt at the top of a card, one per question type. {kind} is a word from
# quiz.noun.* above, so in Bengali the case marker belongs on the noun, not here.
quiz.question.source.stem = এই উদ্ধৃতিটা কোন {kind} থেকে?
quiz.question.quote.stem = এই {kind} থেকে কোন উদ্ধৃতিটা?
quiz.question.cloze.stem = শূন্যস্থান পূরণ করুন
quiz.question.cloze-mcq.stem = ফাঁকে কোন শব্দগুলো বসবে?
quiz.question.speaker.stem = এটা কে বলছে?
quiz.question.author.stem = এটা কে লিখেছেন?
# A flip card, and any question type a newer server sends that this client has
# never heard of: both are answered the same way.
quiz.question.flip.stem = এটা কোথা থেকে?
# Where the card is in the round.
quiz.progress.label = {done} / {total}

# The gap the server left in a cloze quote, announced to a screen reader.
quiz.cloze.blank.aria = শূন্যস্থান
quiz.cloze.field.label = যে শব্দগুলো নেই
quiz.cloze.placeholder = শূন্যস্থানে যা বসবে, লিখুন
# The same placeholder where there is a keyboard. {key} is a key cap.
quiz.cloze.placeholder-key = শূন্যস্থানে যা বসবে, লিখুন · {key}
quiz.cloze.check.label = মিলিয়ে দেখুন
# Above the right answer, once it has been checked.
quiz.cloze.answer.label = যে শব্দগুলো ছিল
# Under the revealed words when the attempt was a close synonym rather than the
# word itself: it counted, and it earned less. See quiz.tuning.cloze-synonym.
quiz.cloze.synonym.note = সমার্থক হিসেবে গোনা হল — আসল শব্দের চেয়ে কম দামে
# Under each option of a "which quote?" card, once it has been answered: the
# work that option came out of. {title} is a book, film, show, game or occasion.
quiz.option.source.label = {title} থেকে

# A multiple-choice option that is longer than three lines.
quiz.option.expand.aria = এই উত্তরটা পুরো দেখুন
quiz.option.collapse.aria = এই উত্তরটা গুটিয়ে নিন
quiz.option.expand.tip = গোটা উদ্ধৃতিটা দেখান

# A FLIP CARD: reveal, then say whether you had it. The reveal posts nothing —
# treating it as an answer would make self-grading a button you press to make
# the card go away.
# bn: First person, like the two grades under it — the reader asks to see, then says whether they had it.
quiz.flip.reveal.label = দেখি
quiz.flip.reveal.tip = উত্তরটা দেখান
quiz.grade.forgot.label = ভুলে গেছি
quiz.grade.got.label = পেরেছি

# THE LEECH OFFER — a card forgotten over and over is costing a slot in every
# deck and giving nothing back. It is an OFFER: nothing is ever suspended
# automatically, and the card is still asked before it appears.
quiz.leech.count.label = {n} বার ভুলে গেছেন
quiz.leech.keep.label = জিজ্ঞেস করতে থাকুক
quiz.leech.aside.action.label = সরিয়ে রাখুন
quiz.leech.aside.label = অনুশীলনীর বাইরে

# The verdict after an answer. A flip card was not right or wrong — it was
# recalled or it was not, and the READER said so, which is why it gets its own
# two words rather than the marked ones.
quiz.verdict.correct.label = ঠিক
quiz.verdict.wrong.label = ঠিক হল না
quiz.verdict.recalled.label = মনে ছিল
quiz.verdict.noted.label = লিখে রাখা হল
quiz.saving.label = সেভ হচ্ছে…
quiz.next.label = পরেরটা
quiz.finish.label = শেষ করুন
# With the confirm step on: an option is chosen but nothing has been posted.
quiz.submit.hint = বদলাতে হলে অন্যটায় ট্যাপ করুন
quiz.submit.label = জমা দিন
# Practice only. It advances locally and touches neither schedule nor score.
quiz.skip.label = বাদ দিন

# Fixing a quote from inside the card, after it has been answered.
quiz.card.fix.label = ঠিক করুন বা ট্যাগ দিন
quiz.card.tags.placeholder = কমা দিয়ে আলাদা করুন
quiz.card.favourite.on.label = প্রিয়তে আছে
quiz.card.favourite.off.label = প্রিয়তে রাখুন

# A THEMED ROUND — "quiz me on this book / tag / colour / person".
# Not an error: a theme with nothing behind it is the ordinary answer for a book
# you have not quoted yet, or a colour you stopped using.
quiz.practice.empty = এখানে ঝালিয়ে নেওয়ার মতো উদ্ধৃতি নেই
quiz.practice.end.label = রাউন্ড শেষ করুন
quiz.round.score.label = {done} / {total}
quiz.round.summary.label = {got} মনে ছিল · {missed} পারেননি
quiz.round.again.label = আরেক রাউন্ড

# The page locator on a book card. Small caps in a narrow slot.
common.locator.page.label = পৃ. {n}
common.toast.saved = সেভ হয়েছে

# ⚠ NEAR-DUPLICATES OF error.save.generic ("could not save"). Kept apart because
# the shipped English used a contraction at these two sites and this pass is a
# migration rather than a copy edit — collapse them if the copy is ever revised.
error.save.quiz-card = সেভ করা গেল না
error.save.quiz-answer = সেভ করা গেল না — এই উত্তরটা দিনপঞ্জির হিসেবে ধরা হবে না
error.load.quiz-card = এই উদ্ধৃতিটা আনা গেল না
error.setaside.generic = সরিয়ে রাখা গেল না

# ---------------------------------------------------------------------------
# HOME (Home.jsx) — the daily ritual, and the two ways back into your own
# library that are neither the quiz nor a search.
# ---------------------------------------------------------------------------

# THE DAILY QUIZ CARD.
home.daily.title = দৈনিক অনুশীলনী
# {n} consecutive days with a finished deck.
home.daily.streak.label = টানা {n} দিন
home.daily.loading = আজকের কার্ড জড়ো হচ্ছে…
# A failed fetch must NOT masquerade as "all caught up".
home.daily.error = আজকের অনুশীলনী আনা গেল না — রিলোড করে আবার দেখুন
# Two different good outcomes: you finished today's deck, or there was none.
home.daily.done.label = আজকের মতো শেষ ✓
home.daily.done.summary = {got} মনে ছিল · {missed} আবার ফিরবে · কাল আবার
home.daily.empty.label = আজ কিছু বাকি নেই
home.daily.empty.summary = আরও উদ্ধৃতি জমান বা ঝালিয়ে নিন — দিনপঞ্জি তৈরি হবে

# "WHERE YOU STAND" — a count per memory status, with the explainer under it.
home.states.title = স্মৃতির হাল
home.states.help.label = এগুলো কীভাবে চলে
home.states.capacity.note = আপনার সংগ্রহ সময়সূচির চেয়ে বড় হয়ে গেছে: মোটামুটি {n}টা উদ্ধৃতি নিয়মিত ফেরানো যায়, আর আপনার আছে {total}টা। কুইজ তবু আগে সেটাই জিজ্ঞেস করে যেটা ভোলার সবচেয়ে কাছে; সেটিংসে দিনে বেশি কার্ড দিলে আরও দূর পৌঁছবে।
# THE EXPLAINER HAS TWO VERSIONS and the app shows whichever rule is actually in
# force: describing the ladder to somebody who switched it off would make the one
# piece of copy that explains the schedule the one piece that lies about it.
# {curve} and {spaced} are links to Wikipedia; {remembered} {forgetting} and
# {forgotten} are the three status words in bold, and they must match
# common.status.*.label, which is what the dots on every card say.
home.states.help.adaptive.prose = প্রতিটা উদ্ধৃতির একটা স্মৃতি-অর্ধায়ু থাকে: মনে করতে পারলে সেটা আড়াই গুণ বাড়ে, সর্বোচ্চ এক বছর; ভুলে গেলে অর্ধেক হয় — এর ভিত্তি {curve}, যার ওপর দাঁড়িয়ে {spaced}। মনে পড়ার সম্ভাবনা বেশি থাকলে উদ্ধৃতিটা {remembered}, কমতে থাকলে {forgetting}, আর অর্ধেকের নিচে নামলে {forgotten} — তখনই রোজকার কুইজ সেটা ফিরিয়ে আনে। নতুন রাখা উদ্ধৃতি প্রথম সপ্তাহ মনে-থাকা বলেই ধরা হয়। অর্ধায়ু দেখতে যেকোনো বিন্দুর ওপর মাউস রাখুন।
home.states.help.ladder.prose = প্রতিটা উদ্ধৃতির একটা স্মৃতি-অর্ধায়ু থাকে: মনে করতে পারলে সেটা বাঁধা ধাপে ওঠে — এক সপ্তাহ, তারপর ৩০, ১০০, ৩৬৫ দিন; ভুলে গেলে আবার এক সপ্তাহে নামে — এর ভিত্তি {curve}, যার ওপর দাঁড়িয়ে {spaced}। মনে পড়ার সম্ভাবনা বেশি থাকলে উদ্ধৃতিটা {remembered}, কমতে থাকলে {forgetting}, আর অর্ধেকের নিচে নামলে {forgotten} — তখনই রোজকার কুইজ সেটা ফিরিয়ে আনে। নতুন রাখা উদ্ধৃতি প্রথম সপ্তাহ মনে-থাকা বলেই ধরা হয়। অর্ধায়ু দেখতে যেকোনো বিন্দুর ওপর মাউস রাখুন।
# The two link texts inside those paragraphs.
home.states.help.curve.label = ভুলে যাওয়ার রেখা
home.states.help.spaced.label = ফাঁক রেখে পুনরাবৃত্তি
# The three status words as they read INSIDE the paragraph — lower case, bold.
home.states.help.remembered.label = মনে আছে
home.states.help.forgetting.label = ভুলছেন
home.states.help.forgotten.label = সম্ভবত ভুলে গেছেন

# THE PRACTICE CARD — unlimited, skippable, and schedule-neutral by default.
home.practice.title = ঝালাই
home.practice.info.title = ঝালাই
home.practice.info.body = পুরো সংগ্রহ থেকে যত খুশি ঝালাই; যেটা ইচ্ছে বাদ দিন। সেটিংসে না বদলালে এতে পুনরাবৃত্তির সময়সূচি নড়ে না, আর স্কোর মুছলেও শেখার ইতিহাস থেকে যায়।
home.practice.unlimited.label = যত খুশি
home.practice.start.label = ঝালাই শুরু করুন
home.practice.start.busy = লোড হচ্ছে…
# The lifetime practice score. {n} answered, {percent} of them recalled.
home.practice.score.label = {n}টা উত্তর · {percent}% মনে ছিল
home.practice.reset.aria = ঝালাইয়ের স্কোর মুছুন
home.practice.reset.tip = ঝালাইয়ের স্কোর মুছে দিন
home.practice.end.label = ঝালাই শেষ করুন
home.practice.round.summary = রাউন্ড শেষ — {got} মনে ছিল · {missed} পারেননি
home.practice.toast.reset = ঝালাইয়ের স্কোর মুছে গেল

# THE TWO COUNT TILES, which are DOORS: pressing one opens that screen.
home.tile.library.tip = গ্রন্থাগার খুলুন
home.tile.library.counts = বই · {n} উদ্ধৃতি
home.tile.movies.tip = ক্যাটালগ খুলুন
home.tile.movies.counts = সিনেমা · {n} সংলাপ

# THE FAVOURITES WALL.
home.favourites.title = প্রিয়
# Beside the heading. The ♥ is the glyph, {n} how many are on the wall.
home.favourites.count.label = ♥ {n}
home.favourites.more.label = আরও দেখুন ({n})
# The small caps kind tag on a favourite tile. SMALL CAPS IN A FIXED SLOT —
# three or four characters is all that fits, and a script with no case will
# need a shorter word rather than a translated one.
common.badge.book = বই
common.badge.film = সিনেমা
common.badge.show = শো
common.badge.game = গেম
common.badge.quote = উদ্ধৃতি
# Opening the thing a favourite came from, or the screen it lives on.
home.favourites.open.book.aria = এই বইটা খুলুন
home.favourites.open.film.aria = এই সিনেমাটা খুলুন
home.favourites.open.show.aria = এই শোটা খুলুন
home.favourites.open.game.aria = এই গেমটা খুলুন
home.favourites.open.quotes.aria = উক্তির পাতায় যান
home.favourites.collapse.tip = এই উদ্ধৃতিটা গুটিয়ে নিন

# SERENDIPITY — one line at random, and what you saved on this date in other
# years. Neither moves a schedule.
home.shuffle.label = হঠাৎ একটা
home.shuffle.tip = যে কোনও একটা বাক্য, হঠাৎ করে
home.shuffle.empty = এখনও কিছু নেই — আগে একটা হাইলাইট, সংলাপ বা উক্তি সেভ করুন
home.onthisday.title = আজকের দিনে · {n}

# The edit form a favourite tile opens in place, per kind, and its delete
# confirmation.
home.favourites.edit.annotation.title = উদ্ধৃতি এডিট করুন
home.favourites.edit.dialogue.title = সংলাপ এডিট করুন
home.favourites.edit.quote.title = উক্তি এডিট করুন
home.favourites.delete.annotation.confirm = এই উদ্ধৃতিটা মুছবেন?
home.favourites.delete.dialogue.confirm = এই সংলাপটা মুছবেন?
home.favourites.delete.quote.confirm = এই উক্তিটা মুছবেন?

# The colour swatch row on a card.
common.colour.category.aria = রঙের ঘর

error.load.practice = আগে কয়েকটা উদ্ধৃতি রাখুন

# ---------------------------------------------------------------------------
# A WORK'S OWN DETAILS PANEL (WorkDetails.jsx)
#
# One panel serves a book and a Catalogue title, and it has three views: the
# fields, a lookup, and the field-by-field comparison a match is adopted
# through. The .info values are the dots beside each field.
# ---------------------------------------------------------------------------

# The three views.
common.work.details.title = খুঁটিনাটি
# On the header ✓ while nothing has been edited. Five words.
common.work.details.done.tip = সেভ করে বন্ধ করুন
common.work.people.done.tip = হয়ে গেছে
common.work.fetch.label = মেটাডেটা আনুন
common.work.lookup.back.aria = ঘরগুলোয় ফিরুন
common.work.lookup.pick.label = মিলটা বাছুন
common.work.lookup.info.title = মেটাডেটা আনুন
common.work.lookup.info.body = এখনো কিছু বদলায়নি। একটা মিল বাছলে আপনার তথ্যের পাশে সেটা দেখাবে, তারপর যে ঘরগুলো নিতে চান সেগুলোয় টিক দিন।
# {noun} is a book or a title, from unit.*.
common.work.delete.aria = এই {noun} মুছুন

# A supplier id field: it edits like any other and reads as a link.
common.work.id.placeholder = id লিখুন, বা মেটাডেটা আনুন
# bn: {source} is a supplier's name; the marker it would take differs by name, so
# the frame stays bare and adds সাইটে.
common.work.id.open.tip = {source} সাইটে খুলুন
# The id as it reads when it is not being edited. The arrow means "opens away".
common.work.id.display.label = #{n} ↗

work.ids.label = আইডি
work.ids.edit.label = বদলান
work.ids.edit.tip = সব আইডি বদলান
work.ids.no-page.tip = {source} — খোলার মতো কোনও পাতা নেই
work.ids.save.tip = সব আইডি একসঙ্গে সেভ করুন
work.ids.save.blocked = কোনও আইডি বদলায়নি
work.ids.form.hint = এই ধরনের বই বা সিনেমা যেসব আইডি দিয়ে খোঁজা যায়। ফাঁকা থাকলে সেটা বাদ যায়।

# Saving. {field} is a field name, already lower-cased by the caller.
common.work.field-saved.toast = {field} সেভ হয়েছে
common.work.fields-saved.toast.one = 1টা ঘর সেভ হয়েছে
common.work.fields-saved.toast.other = {n}টা ঘর সেভ হয়েছে

# THE COMPARISON VIEW. Fields you have nothing in are pre-ticked; anything
# already filled starts unticked, so a match can never quietly overwrite you.
common.work.merge.back.aria = মিলগুলোয় ফিরুন
common.work.merge.info.title = কী কী রাখবেন
common.work.merge.info.body = ফাঁকা ঘরগুলোয় আগে থেকেই টিক থাকে; ভরা ঘরে টিক থাকে না — তাই আপনি টিক না দিলে আপনার লেখা কিছু বদলাবে না।
common.work.merge.all.aria = সব ঘর নিন
common.work.merge.all.tip = সবটাই নিন
common.work.merge.none.aria = কোনও ঘর নয়
common.work.merge.none.tip = কিছুই নয়
common.work.merge.empty = আপনার কাছে যা আছে, এই মিলটাও ঠিক তাই বলছে — বদলানোর কিছু নেই।
common.work.merge.row.tip = এই ঘরটা নিন
# The two columns of a comparison row: what you have, and what the match offers.
common.work.merge.yours.label = আপনার
common.work.merge.theirs.label = সূত্রের
# In the "yours" column when you have nothing there. Not "0", which is what an
# unset year actually stores.
common.work.merge.blank.label = এখনও কিছু নেই
common.work.merge.take.one = {n}টা ঘর নিন
common.work.merge.take.other = {n}টা ঘর নিন
common.work.merge.toast.one = {n}টা ঘর বদলাল
common.work.merge.toast.other = {n}টা ঘর বদলাল
# The all-in option on the Catalogue side: the CAST is the reason to reach for
# it, because a search result never carries one.
common.work.resync.label = আবার সব আনুন
common.work.resync.busy = সব আনা হচ্ছে…
common.work.resync.info.title = আবার সব আনুন
common.work.resync.info.body = এই উৎস থেকে পুরো তথ্য নতুন করে বসে — পোস্টার, অভিনেতা, ধরন, পরিচালক, বিবরণ। অভিনেতাদের তালিকা পেতে এটাই কাজের, কারণ খোঁজার ফলে সেটা আসে না।
common.work.resync.toast = সূত্র থেকে সব আবার আনা হল

# THE INFO DOT ON EACH BOOK FIELD.
book.field.author.info = এক লাইনে একাধিক লেখক লেখা যায়; মেটাডেটা › উৎস-এর বিভাজক চিহ্ন ঠিক করে কোথায় ভেঙে আলাদা মানুষ হবে।
book.field.translator.info = কে অনুবাদ করেছেন। লেখকের মতোই তাঁর নিজের পাতা হয়, এই বইয়ের পাতায় নাম থাকে — কিন্তু গ্রন্থাগারে বা উদ্ধৃতিতে নয়।
book.field.editor.info = কে সংকলন বা সম্পাদনা করেছেন — সংকলনে প্রায়ই এটাই আসল নাম। লেখকের লাইনের মতোই বিভাজক চিহ্ন খাটে।
book.field.series.info = বইটা কোন সিরিজের। গ্রন্থাগারে এই ধরে সাজানো যায়, আর পাশের নম্বর ধরে ক্রম ঠিক হয়।
book.field.isbn.info = ১০ বা ১৩ অঙ্ক, হাইফেন থাকলেও চলে; ১০ অঙ্কের ISBN ১৩ অঙ্কে রাখা হয়। বই খুঁজতে আর ভালো কভার বা বিবরণ পেতে লাগে।
book.field.subtitle.info = মলাটে শিরোনামের নিচের লাইন, যেমন "একটি উপন্যাস"। এটা এই সংস্করণের, তাই শিরোনাম থেকে আলাদা রাখা হয়।
book.field.publisher.info = আপনার কপি কারা ছেপেছে। Google Books আপনার সংস্করণ ধরে উত্তর দেয়, তাই সেটাই আগে; Open Library বইটার সব প্রকাশকের নাম দেয়।
book.field.pages.info = প্রকাশকের হিসেবে বইয়ের পাতার সংখ্যা। আপনি এখন কোন পাতায়, সেটা আলাদা — পড়ার অগ্রগতির সঙ্গে রাখা থাকে।
book.field.asin.info = Amazon-এর পণ্য-পরিচয়, যেকোনো কিন্ডল বইয়ের পাতায় থাকে। এটা থাকলে কোনো কী ছাড়াই কভার আনা যায়।
book.field.openlibrary-id.label = Open Library id
book.field.openlibrary-id.info = Open Library-র চাবি — ওদের URL-এর /works/OL…W বা /books/OL…M অংশ। এটা দিয়েই কভার আর প্রথম প্রকাশের সাল আসে। মুছতে ঘরটা ফাঁকা করুন।
book.field.google-id.label = Google Books id
book.field.google-id.info = Google Books-এর ভলিউম আইডি — URL-এ ?id=-এর পরের অংশ। এটা একটা নির্দিষ্ট সংস্করণ বোঝায়, তাই তথ্য আপনার কপির সঙ্গে মেলে। মুছতে ঘরটা ফাঁকা করুন।
book.fetch.info.body = Google Books, Open Library আর Amazon-এ খোঁজে, তারপর প্রতিটা ঘর মিলিয়ে দেখে যা চান শুধু সেটুকু নিতে দেয়।

# THE INFO DOT ON EACH CATALOGUE FIELD. A Catalogue row is a film, a show or a
# game, and the words change with the MEDIUM rather than with the screen.
film.field.media-type.info = শো-এর সংলাপে সিজন আর পর্ব থাকে; সিনেমা বা গেমে থাকে না। এটা বদলালে আগে রাখা লাইন সরে না।
film.field.publisher.info = যে সংস্থা গেমটা বাজারে এনেছে — যে স্টুডিও বানিয়েছে তারা নয়। পুরনো কোনো গেমে দুটো একই দেখালে আবার আনুন, আলাদা হয়ে যাবে।
film.field.series.info = এই সিনেমা বা শো কোন ফ্র্যাঞ্চাইজির।
film.field.tmdb-id.label = TMDB id
film.field.tmdb-id.info = TMDB-র URL-এ এই সিনেমার নম্বর। “মেটাডেটা আনুন”-এ মিল বাছলে নিজে থেকেই বসে, নয়তো লিখে দিন — একই নামের দুটো সিনেমা আইডিতেই আলাদা হয়। মুছতে ঘরটা ফাঁকা করুন।
film.field.tvdb-id.label = TheTVDB id
film.field.tvdb-id.info = TheTVDB-র আইডি, একইভাবে বসে। না দিলেও চলে, তবে লম্বা চলা শো-এর জন্য প্রায়ই এটাই ভালো।
film.field.imdb-id.label = IMDb id
film.field.imdb-id.info = IMDb-র URL-এ tt দিয়ে শুরু নম্বরটা। শুধু রেখে দেওয়ার জন্য — IMDb-র খোলা API নেই, তাই এটা দিয়ে কিছু আনা হয় না।
film.field.igdb-id.label = IGDB id
film.field.igdb-id.info = IGDB-তে এই গেমের আইডি। “মেটাডেটা আনুন”-এ মিল বাছলে নিজে থেকেই বসে, নয়তো লিখে দিন — একই নামের গেম এতেই আলাদা হয়। মুছতে ঘরটা ফাঁকা করুন।
film.fetch.info.body = TMDB আর TheTVDB-তে খোঁজে, প্রতিটা ঘর আপনার তথ্যের পাশে দেখায়। আলাদা ঘর নিতে পারেন, বা উৎস থেকে সব নতুন করে আনতে পারেন।

# THE THREE THINGS A CATALOGUE ROW CAN BE. One list, so the display and the
# picker cannot offer different sets. "movie" is the stored token; the WORD is
# Film, because that is what a reader calls it.
vocab.kind.movie.label = সিনেমা
vocab.quote-kind.unset.label = (দেওয়া নেই)
vocab.quote-kind.speech.label = ভাষণ
vocab.quote-kind.letter.label = চিঠি
vocab.quote-kind.essay.label = প্রবন্ধ
vocab.quote-kind.poem.label = কবিতা
vocab.quote-kind.song.label = গান
vocab.quote-kind.proverb.label = প্রবাদ
vocab.quote-kind.other.label = অন্যান্য
quote.attribution.letter-to = {name}-কে লেখা চিঠি
quote.attribution.essay-at = “{title}”, {locator}
quote.attribution.titled = “{title}”
quote.attribution.piece-from = {work} থেকে {name}
quote.attribution.from = {work} থেকে
quote.attribution.language-proverb = {language} প্রবাদ
vocab.kind.show.label = শো
vocab.kind.game.label = গেম

# The suppliers a work can be looked up on. ⚠ PROPER NOUNS — do not translate.
vocab.source.imdb.label = IMDb
vocab.source.igdb.label = IGDB

# Field labels this panel needs that no other screen names. A show has a
# CREATOR where a film has a director; a game has a STUDIO, and its franchise is
# a series where a film's is a collection.
common.field.publisher.label = প্রকাশক
common.field.collection.label = সিরিজ
common.field.collection-no.label = সিরিজে নম্বর
common.field.cover.label = কভার
common.field.poster.label = পোস্টার

error.sync.source = সূত্র থেকে আনা গেল না
error.validate.title-required = একটা নাম দিতে হবে

# ---------------------------------------------------------------------------
# THE ＋ SURFACE (AddSurface.jsx) — the one way into the library.
#
# Three tabs: look one up, capture a quote, import a file. capture.* is the
# screen key the route already uses for it.
# ---------------------------------------------------------------------------

# The ＋ surface's own title, per tab.
capture.title.duplicate = এই উদ্ধৃতির নকল
capture.form.duplicate.prose = প্রতিটা ঘরে আপনি যে উদ্ধৃতিতে চেপেছেন তার কপি আছে। সেভ করলে নতুন একটা লেখা হবে; মূলটা অপরিবর্তিত থাকবে।
capture.dialog.aria = গ্রন্থাগারে যোগ করুন
# The three tabs. The SHORT set is what fits a phone's three-segment slider —
# keep those to one word.
# ---- the add surface (the chooser and its doors) ---------------------------
# দরজার নামগুলো এখানে নেই — সেগুলো \`vocab.kind.*\` আর \`vocab.quote-kind.*\` থেকে আসে,
# যাতে প্যানেল আর কার্ড আলাদা কথা না বলে।
add.chooser.title = কী যোগ করছেন?
add.chooser.prose = একটা বেছে নিন, প্যানেলটা তারই ফর্ম হয়ে যাবে। যে ঘরগুলো ওই জিনিসটার দরকার, শুধু সেগুলোই থাকবে।
add.mode.work.label = একটা উৎস
add.mode.board.label = একটা বোর্ড
add.mode.anthology.label = একটা সংকলন
add.mode.quote.label = একটা উদ্ধৃতি
add.mode.import.label = ফাইল
add.mode.work.title = একটা উৎস
add.mode.board.title = একটা বোর্ড
add.mode.anthology.title = একটা সংকলন
add.mode.quote.title = একটা উদ্ধৃতি
add.mode.import.title = ফাইল
add.mode.work.which.label = কোন উৎস
add.mode.board.which.label = কোন বোর্ড
add.mode.board.new.label = নতুন বোর্ড
add.mode.board.none.prose = এখনও কোনও বোর্ড নেই — একটা বানান, উদ্ধৃতিগুলো সেখানেই জমা হবে।
add.mode.anthology.held.prose = এখান থেকে সংকলনে যোগ করা এখনও চালু হয়নি। সংকলনের নিজের পাতা থেকে যোগ করুন।
add.door.which.label = কী ধরনের উদ্ধৃতি
add.back.label = তালিকায় ফিরুন
add.back.tip = অন্য কিছু যোগ করুন
add.door.board.label = বোর্ড
add.door.annotation.label = বই থেকে
add.door.dialogue.label = পর্দা থেকে
add.door.import.label = ফাইল ফেলে দিন
add.door.board.save.label = বোর্ডটা বানান
add.form.show-all.label = সব ঘর দেখান
add.form.show-all.hide.label = কম দরকারি ঘরগুলো লুকান
add.field.speaker.said.label = যিনি বলেছেন
add.field.speaker.wrote.label = যিনি লিখেছেন
add.field.recipient.label = যাঁকে পাঠানো
add.field.locator.page.label = পাতা
add.field.locator.stanza.label = স্তবক বা লাইন
add.field.work-title.source.label = যেখান থেকে নেওয়া
add.field.work-title.title.label = নাম
add.field.work-title.collection.label = সংকলন
add.field.work-title.album.label = বই / ছবি / অ্যালবাম
add.form.timestamp-end.placeholder = যেমন 01:13:02
add.form.dlc.placeholder = যেমন Blood and Wine
add.form.source-author.placeholder = যিনি মূল লেখাটা লিখেছেন বা সম্পাদনা করেছেন
common.field.timestamp-end.label = শেষ হয়
common.field.dlc.label = ডিএলসি
common.field.source-author.label = মূল লেখক

# On the ✓ when a must-fill field is empty and nothing more specific applies.
capture.save.blocked.tip = দরকারি ঘরগুলো ভরুন
capture.close.tip = সেভ না করে বন্ধ করুন

# THE FOUR KINDS the ＋ can add. A book goes to the Library; a film, a show and
# a game all go to the Catalogue.
vocab.kind.book.label = বই
capture.lookup.kind.aria = কী যোগ করবেন
# The search box, worded for whichever kind is chosen.
capture.lookup.book.placeholder = ISBN বা বইয়ের নাম
capture.lookup.film.placeholder = সিনেমার নাম
capture.lookup.show.placeholder = শো-র নাম
capture.lookup.game.placeholder = গেমের নাম
capture.lookup.year.placeholder = সাল
capture.lookup.year.aria = সাল (ঐচ্ছিক)
capture.lookup.search.label = খুঁজুন
capture.lookup.search.busy = খোঁজা হচ্ছে…
capture.lookup.empty = কিছু মিলল না
# Where a group of printings disagree on everything but the title.
capture.lookup.edition.none.label = সংস্করণের খবর নেই
# ⚠ NAMES A SUPPLIER AND A SETTING. A game still searches WITHOUT a key — this
# says what you are getting rather than that the lookup is off.
capture.lookup.nokey.game = IGDB-র চাবি নেই — তাই Wikidata-য় খোঁজা হচ্ছে, সেখানে কভার প্রায় থাকে না। পুরো তথ্য পেতে মেটাডেটা › উৎস-এ Twitch-এর client id আর secret দিন; “নিজে হাতে যোগ করুন” সবসময় চলে।
capture.lookup.nokey.film = সিনেমা খোঁজার চাবি বসানো নেই — নিচের “নিজে হাতে যোগ করুন” সবসময়ই চলে।
# The two doors to hand entry: a real button once the lookup has let you down,
# and a link that is always there.
capture.lookup.manual.button.label = ＋ বরং নিজে হাতে যোগ করুন
capture.lookup.manual.link.label = ＋ খোঁজা থাক — নিজে হাতে যোগ করুন
# The hand-entry popup, per kind.
capture.manual.book.title = বই নিজে হাতে যোগ করুন
capture.manual.film.title = সিনেমা নিজে হাতে যোগ করুন
capture.manual.show.title = শো নিজে হাতে যোগ করুন
capture.manual.game.title = গেম নিজে হাতে যোগ করুন

# THE WORK PICKER — type to filter every book and title in the library. The
# last row quick-creates the work from whatever you typed.
capture.picker.placeholder = বই, সিনেমা আর শো-র মধ্যে খুঁজুন…
capture.picker.change.label = বদলান
# {title} is what you typed, in quotes. The second form is for an empty box.
capture.picker.create.label = ＋ {title} যোগ করুন — বই, সিনেমা বা শো
capture.picker.create.blank.label = ＋ নতুন বই, সিনেমা বা শো যোগ করুন

# THE CAPTURE FORM.
# The label above the work picker, and the chip that turns the picker off.
capture.form.create.label = নতুন বই, সিনেমা বা শো যোগ করুন
capture.form.create.cancel.label = বাতিল
capture.form.quote.placeholder = রেখে দেওয়ার মতো বাক্যটা…
capture.form.note.placeholder = মার্জিনে আপনার নোট (হাতের লেখায় দেখাবে)
capture.form.timestamp.placeholder = যেমন 01:12:40
capture.form.season.placeholder = যেমন 2
capture.form.episode.placeholder = যেমন 5
capture.form.chapter-no.placeholder = যেমন 7
capture.form.chapter-name.placeholder = ঐচ্ছিক
capture.form.location.placeholder = যেমন 142
# This field takes NAMES SEPARATED BY COMMAS rather than one tag at a time.
# Under the fields when Save is greyed: {reason} is one of the must-fill
# messages below, and this sentence completes it.
capture.form.missing.hint = {reason} — তবেই সেভ হবে।

# One toast per kind of capture, because which one landed is worth knowing.
capture.toast.annotation = উদ্ধৃতি তুলে রাখা হল
capture.toast.dialogue = সংলাপ তুলে রাখা হল
capture.toast.quote = উক্তি তুলে রাখা হল

# An import already waiting, shown on the Import tab.
capture.import.pending.one = {n}টা উদ্ধৃতি বাকি — তালিকাটা দেখে নিন
capture.import.pending.other = {n}টা উদ্ধৃতি বাকি — তালিকাটা দেখে নিন


# What must be filled before a capture can save. Each doubles as the tooltip on
# the greyed ✓, so each has to make sense on its own.
# bn: Each of these is both the greyed ✓'s tooltip and the front half of
# capture.form.missing.hint ("… — তবেই সেভ হবে।"), so each is an imperative.
error.validate.quote-words = উদ্ধৃতির কথাগুলো লিখুন
error.validate.quote-or-note = একটা উদ্ধৃতি বা একটা নোট লিখুন
error.validate.target-required = একটা বই, সিনেমা বা শো বাছুন
error.validate.season-required = এপিসোড দিলে সিজনটাও দিন

error.lookup.failed = খুঁজে পাওয়া গেল না
error.add.book = বই যোগ করা গেল না
error.add.title = টাইটেল যোগ করা গেল না
error.enrich.title = টাইটেলটার মেটাডেটা আনা গেল না

# Placeholders shared with the Quotes screen's own form.
common.field.speaker.placeholder = কে বলেছেন
common.field.character.placeholder = কে বলছে

# ---------------------------------------------------------------------------
# STATS (StatsPage.jsx)
#
# EVERYTHING NAMED ON THIS SCREEN IS A DOORWAY, not a read-out: a calendar dot,
# a breakdown row, a superlative tile and a top tag all click through to Search.
# ---------------------------------------------------------------------------

# Under the page title: how many quotes of all three kinds are kept.
stats.header.counts = {n}টা জমা আছে

# The overview tiles. "Annotations" is what the API, the database and the README
# call a book highlight; "Quotes" here is the standalone kind, the same thing the
# Quotes tab means. Naming them the same would count two different things.
stats.overview.books.label = বই
stats.overview.annotations.label = উদ্ধৃতি
stats.overview.movies.label = সিনেমা
stats.overview.dialogues.label = সংলাপ
stats.overview.quotes.label = উক্তি
stats.overview.genres.label = ঘরানা
stats.overview.tags.label = ট্যাগ
stats.overview.favourites.label = প্রিয়

# THE ACTIVITY CALENDAR. Three streams over one heatmap.
# {n} is the total for the stream, {noun} the stream's own verb below.
stats.activity.title = ক্যালেন্ডার · {n} {noun}
stats.activity.stream.aria = ক্যালেন্ডারে কী দেখাবে
stats.activity.saves.label = জমা
stats.activity.saves.noun = জমা
stats.activity.saves.empty = এখনও কিছু জমা হয়নি
stats.activity.quiz.label = অনুশীলনী
stats.activity.quiz.noun = অনুশীলন
stats.activity.quiz.empty = অনুশীলনীর কোনও উত্তর এখনও নেই
stats.activity.practice.label = ঝালাই
stats.activity.practice.noun = ঝালাই
# Practice is the one stream a reader can empty on purpose, so its empty state
# has to read as the reset having worked rather than as a chart that failed.
stats.activity.practice.empty = ঝালাইয়ের কোনও হিসেব নেই
stats.activity.practice.reset.label = ঝালাইয়ের হিসেব মুছুন
# What one day says on hover. {date} is already formatted by the device.
stats.activity.day.saves.tip = {date}: {n} {noun}
# The two review streams count ANSWERS, where the tally alone is the less
# interesting half — so they report the ratio too.
stats.activity.day.none.tip = {date}: কোনও উত্তর নেই
stats.activity.day.answers.one = {n}টা উত্তর
stats.activity.day.answers.other = {n}টা উত্তর
stats.activity.day.tally.tip = {date}: {answers}
stats.activity.day.accuracy.tip = {date}: {answers} · {percent}% ঠিক
# Appended to a day that is a doorway into Search.
stats.activity.day.search.tip = {label} — খোঁজে দেখুন
# The heatmap legend, least to most.
stats.activity.legend.less.label = কম
stats.activity.legend.more.label = বেশি

# WHERE THE WHOLE LIBRARY STANDS ON THE FORGETTING CURVE.
stats.memory.title = স্মৃতি
stats.memory.rotation.label = {total}-এর {done}টা অনুশীলনীতে ঘুরছে
stats.memory.half-life.label = গড় অর্ধায়ু
stats.memory.streak.label = দীর্ঘতম ধারা
stats.memory.streak.value = {n} দিন
stats.memory.streak.current = এখন {n}

# THE PER-KIND RECALL BREAKDOWN. A dropdown picks the dimension.
stats.breakdown.title = কে কত · {n}
stats.breakdown.kind.aria = কীসের হিসেব
stats.breakdown.authors.label = লেখক
stats.breakdown.books.label = বই
stats.breakdown.series.label = সিরিজ
stats.breakdown.films.label = সিনেমা
stats.breakdown.shows.label = শো
stats.breakdown.directors.label = পরিচালক
stats.breakdown.actors.label = অভিনেতা
# Beside Actors, never instead of it: one actor plays several characters, one
# character is played by several actors, and a book has characters and no actors.
stats.breakdown.characters.label = চরিত্র
stats.breakdown.speakers.label = বক্তা
stats.breakdown.people.label = মানুষ
# The headline above the rows. {name} is a person, a title or a series.
stats.breakdown.best.label = সবচেয়ে ভালো মনে আছে: {name} · {n}
stats.breakdown.worst.label = সবচেয়ে বেশি ভুলেছেন: {name} · {n}
# How many WORKS an entity spans — an author's books, a series' volumes.
# One status and its count, spelled out under the bar. Never colour alone.
stats.breakdown.status.label = {n} {name}
stats.breakdown.name.tip = এই নামটা খুঁজুন

# THE COLOUR CATEGORIES — the fourth theme, and the only one with no page of its
# own, which is why "quiz me on the ones I marked Disagreed" lives here.
stats.colours.title = রঙের ঘর
stats.colours.empty = এখনও কোনও উদ্ধৃতি নেই
# One magnitude row. {name} is the category as the READER named it.
stats.bar.tip = {name}: {n}
stats.bar.practise.aria = {name} ঝালিয়ে নিন
stats.bar.practise.tip = {name} নিয়ে অনুশীলনী হোক

# Top tags, and what any ranked list says when it holds nothing.
stats.top-tags.title = সবচেয়ে চলা ট্যাগ
stats.list.empty = এখনও কিছু নেই
stats.tag.tip = এই ট্যাগটা খুঁজুন

# THE TIMELINE — when the works you quote were written, and the gaps between.
stats.timeline.title = সময়রেখা
stats.timeline.counts.title = সময়রেখা · {n}
stats.timeline.scale.aria = সময়রেখার মাপ
stats.timeline.decade.label = দশক
stats.timeline.century.label = শতক
stats.timeline.year.label = সাল
# One column on hover: how many works, and how many quotes out of them.
stats.timeline.column.tip = {label}: {a}টা উৎস, {b}টা উদ্ধৃতি
# A stretch with nothing in it, {a} to {b}.
stats.timeline.gap.aria = {a} থেকে {b}: কিছু নেই
stats.timeline.gap.tick.label = {a}–{b}
stats.timeline.key.quotes.label = উদ্ধৃতি
stats.timeline.key.works.label = উৎস

# A YEAR AND A DECADE, WRITTEN THE WAY THEY ARE SAID. The "s" on a decade is an
# English plural and a BCE decade is named by the START of it as spoken — the
# 480s BCE runs from 489 to 480. These sit in narrow ticks under a chart.
# bn: The spoken short form — ৮০-র দশক — which is also the one that fits a tick.
common.year.decade.label = {year}-র দশক
common.year.decade.bce.label = খ্রি.পূ. {year}-র দশক

# THE GAP LINES. Four bands by width, four lines in each, drawn WITHOUT
# REPLACEMENT so a band is exhausted before anything repeats. THEY ARE A VOICE
# RATHER THAN A MESSAGE: dry, lower case, no full stop capital, and they are
# about the reading rather than about history. Write your own; do not translate
# these literally. Band 1 is the narrowest gap and has the least room.
stats.timeline.gap.1.1 = দীর্ঘ নীরবতা।
stats.timeline.gap.1.2 = এখান থেকে কিছু তোলা হয়নি।
stats.timeline.gap.1.3 = তাক এটুকু টপকে গেছে।
stats.timeline.gap.1.4 = এর ভিতর থেকে একটা বাক্যও নেই।
stats.timeline.gap.2.1 = লেখা তো ঢের হয়েছিল। এখানে তার একটাও নেই।
stats.timeline.gap.2.2 = এত চওড়া ফাঁকটা ইতিহাসের দোষ নয়।
stats.timeline.gap.2.3 = শতক পেরিয়ে যায়। তাক টেরও পায় না।
stats.timeline.gap.2.4 = বছর গড়িয়ে যায়। তাকের কিছু বলার নেই।
stats.timeline.gap.3.1 = ইতিহাস ঘটে গেল। আপনি তখন অন্য কিছু পড়ছিলেন।
stats.timeline.gap.3.2 = এই গোটা সময়টা কেউ না কেউ লিখে চলেছিল। আপনি তার কিছুই রাখেননি।
stats.timeline.gap.3.3 = যে সময় থেকে একটাও উদ্ধৃতি নেই, সেটাও আপনি পেরিয়েই এসেছেন।
stats.timeline.gap.3.4 = যুগটার নিজের তর্ক ছিল। তার একটাও এই তাকে ওঠেনি।
stats.timeline.gap.4.1 = উদ্ধৃতি নেই, কভার নেই, দাগ দেওয়ার মতো একটা সালও নেই — এতে যুগের কথা যত, পড়ার কথা তার চেয়ে বেশি বোঝা যায়।
stats.timeline.gap.4.2 = এই ফাঁকের চওড়াই মাপা হয় শতকে। এর কারণ মাপা হয় সন্ধেবেলাগুলোয়।
stats.timeline.gap.4.3 = এর প্রতিটা বছরে লেখক ছিল, তর্ক ছিল, আর ছিল সেই বছরের সেরা বাক্যটা। ওই বাক্যের আপনার কপিটাই নেই।
stats.timeline.gap.4.4 = এই সময়টা ফাঁকা এই জন্য নয় যে তখন কিছু লেখা হয়নি। ফাঁকা, কারণ তার কোনওটাতেই আপনার এখনও হাত পড়েনি।

# THE SUPERLATIVES — one row of tiles, each a doorway.
stats.super.title = সবচেয়ে
stats.super.most-annotated.label = সবচেয়ে বেশি উদ্ধৃতি তোলা বই
stats.super.most-quoted-work.label = সবচেয়ে বেশি সংলাপ তোলা সিনেমা/শো
stats.super.most-quoted-person.label = যাঁর কথা সবচেয়ে বেশি তুলেছেন
stats.super.most-favourited-person.label = যাঁর বাক্য সবচেয়ে বেশি প্রিয়তে
stats.super.most-quoted-decade.label = সবচেয়ে বেশি তোলা দশক
stats.super.busiest-month.label = সবচেয়ে ব্যস্ত মাস
stats.super.best-remembered.label = সবচেয়ে ভালো মনে আছে
stats.super.most-forgotten.label = সবচেয়ে বেশি ভুলেছেন
stats.super.since.label = জমানো শুরু
# The small line under a superlative tile.
stats.super.quotes.label = {n}টা উদ্ধৃতি
stats.super.saved.label = {n}টা জমা
stats.super.of.label = {done} / {total}
stats.super.title.tip = এই টাইটেলটা খুঁজুন
# "Month YYYY" — the month a busiest-month tile names.
stats.month.label = {name} {n}
# The twelve months, spelled out, for that tile. (The calendar’s x axis takes its own
# short forms from common.month.*, so nothing is sliced from these.)
vocab.month.1.label = জানুয়ারি
vocab.month.2.label = ফেব্রুয়ারি
vocab.month.3.label = মার্চ
vocab.month.4.label = এপ্রিল
vocab.month.5.label = মে
vocab.month.6.label = জুন
vocab.month.7.label = জুলাই
vocab.month.8.label = আগস্ট
vocab.month.9.label = সেপ্টেম্বর
vocab.month.10.label = অক্টোবর
vocab.month.11.label = নভেম্বর
vocab.month.12.label = ডিসেম্বর

stats.toast.practice-reset = ঝালাইয়ের হিসেব মুছে গেল
error.reset.practice = ঝালাইয়ের হিসেব মোছা গেল না
# The box itself. Note that tag: author: colour: are GRAMMAR, not copy — the box
# parses them, so they stay as they are in the placeholder too.
search.clear.label = খোঁজা মুছে দিন

# ---------------------------------------------------------------------------
# SEARCH (SearchPage.jsx)
#
# Results come back FACETED BY WHAT MATCHED and render as one section per
# facet. Every section heading is "<name> · <count>", which is one key with two
# holes so another language can punctuate it its own way.
# ---------------------------------------------------------------------------

# The box itself. Note that tag: author: colour: are GRAMMAR, not copy — the box
# parses them, so they stay as they are in the placeholder too.
search.box.placeholder = খুঁজুন, বা লিখুন tag: author: colour:…
search.box.aria = খোঁজ
search.field.and.hint = সংকীর্ণ করে
search.field.or.hint = প্রসারিত করে
# The dropdown's "show me another five" row.
search.box.more.label = আরও ({n})
# A facet already applied, as a removable pill.
search.chip.remove.tip = {field} সরান
search.chip.remove.aria = {name} সরান

# WHAT to search. "All" is everything; the rest narrow to one kind.
search.scope.all.label = সব
search.scope.all.tip = সব জায়গায় খুঁজুন
search.scope.books.label = বই
search.scope.annotations.label = উদ্ধৃতি
search.scope.movies.label = সিনেমা
search.scope.dialogues.label = সংলাপ
search.scope.quotes.label = উক্তি
# {name} is the scope, already lower-cased.
search.scope.only.tip = শুধু {name} খুঁজুন

# The filter sheet.
search.filters.label = ফিল্টার
search.filters.count.label = ফিল্টার · {n}
search.filters.tip = ট্যাগ, লেখক, চরিত্র ধরে কমিয়ে আনুন
search.filters.title = খোঁজ কমিয়ে আনুন
# Above the facet groups. tag: author: character: are the typed grammar.
search.filters.type.hint = বা বাক্সেই লিখে দিন: {em1} {em2} {em3}।
# HOW TWO VALUES OF ONE FIELD COMBINE, written down rather than discovered: two
# tags narrow, two authors widen, and a yes/no field can only be one or the other.
search.filters.combine.and = সবগুলো মিলতে হবে
search.filters.combine.or = যে কোনও একটা মিললেই চলে
search.filters.combine.exclusive = হয় এটা, নয় ওটা
search.filters.narrow.placeholder = {field} ফিল্টার করুন…
search.filters.narrow.aria = {field} ফিল্টার করুন
# On a value with no hits under the current search. Greyed, not hidden, and
# still pressable: a value that disappears leaves you doubting your own library.
search.filters.dead.tip = এই খোঁজে এটার কিছু মিলছে না
search.filters.clear.label = সব তুলে দিন

# The two empty states, which are different questions. The first is "you have
# not typed anything"; the second is "there is nothing there".
search.results.empty.prompt = লিখতে শুরু করুন — বই, উদ্ধৃতি, সিনেমা আর সংলাপে খোঁজ চলবে
# {query} names the WHOLE question — the words AND the chips — because with
# filters up, "no results for “”" would be reporting an empty search.
search.results.none = “{query}” — কিছু মিলল না
search.results.none.scope = {name} বিভাগে “{query}” মিলল না
search.results.clear.label = খোঁজ মুছুন
search.results.drop-filters.label = ফিল্টার তুলে দিন
search.results.everything.label = সব জায়গায় খুঁজুন
# The server ran a fuzzy pass because the exact query had no hits at all.
search.results.corrected = হুবহু কিছু মিলল না — “{query}” ধরে যা মিলল, তাই দেখানো হচ্ছে

# THE SECTION HEADINGS. {name} is the section, {n} its hit count.
search.section.heading = {name} · {n}
search.section.books.title = বই
search.section.movies.title = সিনেমা
search.section.annotations.title = উদ্ধৃতি
search.section.dialogues.title = সংলাপ
search.section.quotes.title = উক্তি
search.section.authors.title = লেখক
search.section.directors.title = পরিচালক
search.section.actors.title = অভিনেতা
search.section.characters.title = চরিত্র
search.section.speakers.title = বক্তা
search.section.notes.title = নোট
search.section.tags.title = ট্যাগ
search.section.genres.title = ঘরানা
# A decade section names the decade as well as the count.
search.section.decade.title = দশক · {name} · {n}
# Everything added on one day — the Stats calendar's dot target. {date} is
# already formatted by the device.
search.section.date.title = {date} তারিখে যোগ করা · {n}
# A character chip: pressing it narrows the search to everything they say.
search.character.all.tip = {name} যা যা বলে

# Group the results, the same five dimensions the Library offers.
search.group.none.label = ভাগ নেই
search.group.series.label = সিরিজ
search.group.author.label = লেখক
search.group.decade.label = দশক
search.group.genre.label = ঘরানা
# The catch-all group heading where the credit is missing.
search.group.residual.author.label = লেখক অজানা
search.group.residual.director.label = পরিচালক অজানা

# THE TABLE VIEW. Every column head names a stored field.
search.table.select-all.tip = সব সারি বাছুন
search.table.select-all.aria = সব বাছুন
search.table.select-row.tip = এই সারিটা বাছুন
search.table.select-row.aria = সারি বাছুন

# The table's inline bulk editor.
search.bulk.author.placeholder = লেখক বসান
search.bulk.director.placeholder = পরিচালক বসান
search.bulk.series.placeholder = সিরিজ বসান
search.bulk.tags.placeholder = ট্যাগ যোগ করুন (কমা দিয়ে আলাদা)
search.bulk.genres.placeholder = ঘরানা যোগ করুন (কমা দিয়ে আলাদা)
search.bulk.tags.blocked.tip = অন্তত একটা ট্যাগ লিখুন
search.bulk.fields.blocked.tip = আগে একটা ঘর ভরুন

# One search hit opened in place.
search.hit.title.fallback = উদ্ধৃতি
search.hit.open.book.label = বই খুলুন
search.hit.open.film.label = সিনেমা খুলুন
search.hit.gone = এই উদ্ধৃতিটা আর নেই
search.hit.work.tip = উৎসটা খুলুন
search.hit.work.aria = {title} খুলুন


error.search.failed = খুঁজে পাওয়া গেল না
error.bulk.failed = একসঙ্গে কাজটা করা গেল না
error.validate.tag-required = অন্তত একটা ট্যাগ লিখুন
error.validate.field-required = আগে একটা ঘর ভরুন

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
library.header.lookup.label = খোঁজা যায় ISBN বা নামে
library.board.empty = এখনও কোনও বই নেই — উপরের বারের ＋ দিয়ে একটা যোগ করুন, বা উদ্ধৃতির ফাইল ইমপোর্ট করুন
library.board.nomatch = এই ফিল্টারে কোনও বই মিলল না
# The chip that folds every unquoted book into one tile.
library.filters.fold-wishlist.label = উইশলিস্ট গুটিয়ে নিন
library.filters.fold-wishlist.tip = যেগুলো থেকে কিছু তোলেননি, সব এক টাইলে
# The catch-all group heading where a book has no author recorded.
library.group.residual.author.label = লেখক অজানা

# Sort, and group.
library.sort.recent.label = নতুন আগে
library.sort.title.label = নাম
library.sort.author.label = লেখক
library.sort.year.label = সাল
library.sort.series.label = সিরিজ
library.sort.read.label = শেষ কবে পড়া
# "Books" here means UNGROUPED — one board of them.
library.group.none.label = ভাগ নেই
library.group.series.label = সিরিজ
library.group.author.label = লেখক
library.group.decade.label = দশক
library.group.genre.label = ঘরানা

# Exporting the board.
library.export.confirm.title = গ্রন্থাগার এক্সপোর্ট
library.export.confirm.body = চোখের সামনের {a} · {b} এক্সপোর্ট হবে — প্রতি বইয়ে একটা Markdown ফাইল, এক ডাউনলোডে। টিপ্পনীতে আবার ইমপোর্ট করা যায়।

# A BOOK'S OWN PAGE.
book.title.fallback = নামহীন
book.filter.aria = উদ্ধৃতি ফিল্টার করুন
book.export.label = .md এক্সপোর্ট
book.practise.aria = এই বইটা ঝালিয়ে নিন
book.practise.menu.label = এই বইটা ঝালিয়ে নিন
book.practise.tip = এই বই নিয়ে অনুশীলনী হোক
book.details.tip = খুঁটিনাটি আর মেটাডেটা
book.toast.deleted = বই মোছা হয়েছে
# The role labels beside a second or third credit on a book's page. An
# UNLABELLED name reads as the author, so these two are always labelled.
book.credit.translator.label = অনু.
book.credit.editor.label = সম্পা.
# The kind row above a work's title, when the edition you hold is a translation:
# the language it was WRITTEN in, beside the language it is printed in. Marked,
# because two bare language names side by side say nothing about which is which.
book.hero.language.original = মূল {name}
common.hero.year.tip = {year} সালের সবকিছু
common.hero.series.tip = {name}-এর সবকিছু
# The date-confirm dialog's own word for what just happened to the shelf.
book.shelf.started.label = পড়া শুরু
book.shelf.abandoned.label = ছেড়ে দেওয়া
book.shelf.finished.label = পড়া শেষ
book.shelf.cap.past.label = পড়া শেষ

# The hand-entry and edit forms for a book.
book.form.edit.title = বই এডিট করুন
# Under the form when the ✓ in the header is greyed. A disabled icon cannot say
# why, so this line does. Its twin on the film form is film.form.missing.hint: one
# sentence per form, because the word for "title" is not the same in both.
book.form.missing.hint = সেভ করতে বইয়ের নাম লাগবে।
book.form.translator.placeholder = অনুবাদটা কার
book.form.editor.placeholder = কে সম্পাদনা করেছেন
book.form.series.placeholder = যেমন Discworld
book.form.series-no.placeholder = যেমন 5

# ONE HIGHLIGHT, as a card. This card is drawn on four screens, so common.*.
common.quote.speaker.tip = {name} বলেছেন — চরিত্রটা খুলুন
# The other chips on a line: named on it, but not the one the app has stored as
# having spoken it, so there is no record to open behind them.
common.quote.named.tip = এই লাইনে {name}-এর নাম আছে
common.quote.edit.title = উদ্ধৃতি এডিট করুন
common.quote.pick.label = এই উদ্ধৃতি
# The chapter and page locator under a highlight. ⚠ "CH." here is spelled the
# same way the Markdown export writes a chapter heading and the importer reads
# it back — see text.js. Changing it breaks the round trip.
common.locator.chapter.label = অধ্যা. {name}

# THE HIGHLIGHTS TABLE on a book's page.
book.table.quote.label = উদ্ধৃতি
book.table.chapter.label = অধ্যায়
book.table.location.label = লোকেশন
book.table.date.label = তারিখ
# The favourite column, a bare heart.
book.table.favourite.label = ♥
book.table.sort.tip = এই কলাম ধরে সাজান

# The highlights board on a book's page.
book.quotes.counts.shown = {a} · {n}টা দেখাচ্ছে
book.quotes.filter.title = উদ্ধৃতি ফিল্টার করুন
book.quotes.capture.label = ＋ একটা উদ্ধৃতি তুলে রাখুন
book.quotes.empty = এখনও কোনও উদ্ধৃতি নেই — উপরের বারের ＋ দিয়ে প্রথমটা তুলে রাখুন
book.quotes.nomatch = এই ফিল্টারে কোনও উদ্ধৃতি মিলল না
book.quotes.delete.confirm = এই উদ্ধৃতিটা মুছবেন?

# The highlight form.
book.quote.form.character.placeholder = কে বলছে — যদি কেউ বলে থাকে
book.quote.form.chapter-no.placeholder = যেমন 7
book.quote.form.location.placeholder = যেমন 1042

error.validate.title-required.lower = নাম লাগবে
error.validate.year = সালটা ঠিকঠাক লিখুন
error.save.annotation = উদ্ধৃতিটা সেভ করা গেল না

# ---------------------------------------------------------------------------
# THE CATALOGUE (Movies.jsx) — films, shows and games, and their dialogue.
#
# All three are one kind of row split by media_type, so most words here have to
# work for all three. film.* is a title's own page; movies.* is the board.
# ---------------------------------------------------------------------------

# The board. ⚠ The page title says "Movies & Shows" and predates games.
movies.header.title = সিনেমা আর শো
movies.header.counts = {a} · {b}
# Beside the title on a wide screen: whether a lookup is even possible.
movies.header.nokey.label = TMDB-র চাবি নেই — নিজে হাতে যোগ করুন
movies.header.lookup.label = খোঁজা যায় নাম + সাল দিয়ে
movies.board.empty = এখনও কোনও টাইটেল নেই — TMDB/TVDB-তে খুঁজে নিন, বা নিজে হাতে যোগ করুন।
movies.board.nomatch = এই ফিল্টারে কোনও টাইটেল মিলল না
movies.group.residual.director.label = পরিচালক অজানা

# The media-type filter above the board. Only offered for the kinds you have.
movies.filters.media.all.label = সব
movies.filters.media.movie.label = সিনেমা
movies.filters.media.show.label = শো
movies.filters.media.game.label = গেম

# Sort, and group. "Titles" means UNGROUPED; a film's franchise is a COLLECTION
# where a book's is a series.
movies.sort.recent.label = নতুন আগে
movies.sort.title.label = নাম
movies.sort.year.label = সাল
movies.sort.series.label = সিরিজ
movies.sort.read.label = শেষ কবে দেখা
movies.group.none.label = ভাগ নেই
movies.group.series.label = সিরিজ
movies.group.author.label = পরিচালক
movies.group.decade.label = দশক
movies.group.genre.label = ঘরানা

# Exporting the board. Counted PER MEDIUM, because a game tallied as a movie is
# a dialog that lies about what it is going to write.
movies.export.confirm.title = ক্যাটালগ এক্সপোর্ট
movies.export.confirm.body = চোখের সামনের {a} একটাই Markdown ফাইলে এক্সপোর্ট হবে।
movies.export.count.none = 0টা টাইটেল
movies.export.count.movies.one = {n}টা সিনেমা
movies.export.count.movies.other = {n}টা সিনেমা
movies.export.count.shows.one = {n}টা শো
movies.export.count.shows.other = {n}টা শো
movies.export.count.games.one = {n}টা গেম
movies.export.count.games.other = {n}টা গেম

# A LOOKUP THAT FOUND SOMETHING YOU ALREADY HAVE. The two ways out are named
# rather than implied: fill the gaps in what you have, or keep them apart.
movies.duplicate.poster.yes = পোস্টার আছে
movies.duplicate.poster.no = পোস্টার নেই
movies.duplicate.enrich.label = এটারই শূন্যস্থান পূরণ করুন
movies.duplicate.separate.label = আলাদা টাইটেল হিসেবে যোগ করুন

# The hand-entry and edit forms for a Catalogue title.
film.form.edit.title = টাইটেল এডিট করুন
film.form.title.placeholder = নাম (দিতেই হবে)
film.form.publisher.placeholder = প্রকাশক
film.form.year.placeholder = সাল
film.form.series.placeholder = সিরিজ
film.form.series-no.placeholder = সিরিজে নম্বর
film.form.description.placeholder = বিবরণ
film.form.tmdb-id.placeholder = TMDB id
film.form.tvdb-id.placeholder = TheTVDB id
# Under the form when the ✓ in the header is greyed. A disabled icon cannot say
# why, so this line does.
film.form.missing.hint = সেভ করতে নাম লাগবে।
# Above the picker the re-sync opens, saying what picking a row will overwrite.
film.resync.pick.label = ঠিক টাইটেলটা বাছুন — খুঁটিনাটি, কাস্ট আর পোস্টার বদলে যাবে
# The Movie | Show | Game switch. ⚠ "Movie" here, not "Film" — it is the word
# this one control has always used.
film.form.media.aria = ধরন
film.form.media.movie.label = সিনেমা

# A TITLE'S OWN PAGE.
film.title.fallback = নামহীন
film.filter.aria = সংলাপ ফিল্টার করুন
film.export.label = .md এক্সপোর্ট
film.practise.aria = এই টাইটেলটা ঝালিয়ে নিন
film.practise.menu.label = এই টাইটেলটা ঝালিয়ে নিন
film.practise.tip = এই টাইটেল নিয়ে অনুশীলনী হোক
film.details.tip = খুঁটিনাটি আর মেটাডেটা
film.toast.deleted = টাইটেল মোছা হয়েছে
# The mono credit line under a title. ⚠ SMALL CAPS IN A NARROW SLOT.
film.credit.publisher.label = প্রকা.
film.credit.actor.label = অভিনয়ে
# The date-confirm dialog's word for what just happened to the shelf.
film.shelf.started.label = দেখা শুরু
film.shelf.abandoned.label = ছেড়ে দেওয়া
film.shelf.finished.label = দেখা শেষ
film.shelf.cap.past.label = দেখা শেষ

# The dialogue board on a title's page.
film.lines.filter.title = সংলাপ ফিল্টার করুন
film.lines.filter.placeholder = চরিত্র বা ট্যাগ…
film.lines.filter.tag.all.label = সব ট্যাগ
film.lines.capture.label = ＋ একটা সংলাপ তুলে রাখুন
film.lines.select.menu.label = সংলাপ বাছাই
film.lines.counts.shown = {a} · {n}টা দেখাচ্ছে
film.lines.empty = এখনও কোনও সংলাপ নেই — উপরের বারের ＋ দিয়ে প্রথমটা তুলে রাখুন।
film.lines.nomatch = এই ফিল্টারে কোনও সংলাপ মিলল না।
film.lines.delete.confirm = এই সংলাপটা মুছবেন?

# THE DIALOGUE TABLE.
film.table.quote.label = সংলাপ
film.table.character.label = চরিত্র
film.table.episode.label = এপিসোড
film.table.time.label = সময়
film.table.favourite.label = ♥

# ONE FILM LINE, as a card. Drawn on four screens, so common.*.
common.dialogue.edit.title = সংলাপ এডিট করুন
common.dialogue.pick.label = এই সংলাপ

# The dialogue form.
film.line.form.quote.placeholder = সংলাপ (দিতেই হবে)
film.line.form.characters.placeholder = চরিত্র যোগ করুন… (কাস্ট থেকে বাছা যায়)
film.line.form.characters.aria = চরিত্র
film.line.form.season.placeholder = সিজন
film.line.form.season.tip = সিজন (না জানলে ফাঁকা রাখুন)
film.line.form.episode.placeholder = এপিসোড
film.line.form.episode.tip = এপিসোড (সিজন লাগবে)
# HH:MM:SS is a time format rather than words — keep the shape.
film.line.form.timestamp.placeholder = HH:MM:SS
film.line.form.timestamp.tip = সময়

error.validate.line-required = সংলাপটা তো লিখতেই হবে
error.save.dialogue = সংলাপ সেভ করা গেল না

# The countable nouns the Catalogue counts in.
unit.line.one = সংলাপ
unit.line.other = সংলাপ


# ---------------------------------------------------------------------------
# ONE MORE COUNTABLE NOUN, for the Catalogue's franchise filter.
# ---------------------------------------------------------------------------
unit.collection.one = সিরিজ
unit.collection.other = সিরিজ

# One more countable noun, for the studio whose credits are games.
unit.game.one = গেম
unit.game.other = গেম

bin.title = ডাস্টবিন
# What a row calls each kind, and what the chip above the list calls a pile of
# them. ONE TABLE, TWO ROLES — a row is always singular and a chip always plural
# — so these are two keys each rather than a .one/.other family, which would
# need a count neither site has. “Film or show” is one label over two media
# because the API stores 'movie' for both and no unit.* noun spans them.
# bn: Bengali takes no plural marker after a count, so most pairs are the same word twice — written out anyway, per §3.0.
bin.kind.book.label = বই
bin.kind.book.plural = বই
bin.kind.movie.label = সিনেমা বা শো
bin.kind.movie.plural = সিনেমা আর শো
bin.kind.annotation.label = উদ্ধৃতি
bin.kind.annotation.plural = উদ্ধৃতি
bin.kind.dialogue.label = সংলাপ
bin.kind.dialogue.plural = সংলাপ
bin.kind.quote.label = উক্তি
bin.kind.quote.plural = উক্তি
bin.kind.account.label = অ্যাকাউন্ট
bin.kind.account.plural = অ্যাকাউন্ট
bin.kind.merge.label = মেলানো ব্যক্তি
bin.kind.merge.plural = মেলানো
bin.kind.selection.label = একসঙ্গে মোছা
bin.kind.selection.plural = একসঙ্গে মোছা
bin.kind.charmerge.label = মেলানো চরিত্র
bin.kind.charmerge.plural = চরিত্র মেলানো
bin.kind.person.label = ব্যক্তি
bin.kind.person.plural = ব্যক্তিরা
bin.kind.character.label = চরিত্র
bin.kind.character.plural = চরিত্রসমূহ
# The retention control. The three windows are counted with the shared day
# format, so only “never” needs a word of its own.
bin.keep-for.label = কতদিন রাখবে
bin.retention.aria = ডাস্টবিন কতদিন জিনিস রাখবে
bin.retention.never.label = খালি না করা পর্যন্ত
bin.info.title = ডাস্টবিন
bin.info.body = যা মুছবেন, আগে এখানে এসে থাকে। ফিরিয়ে আনলে ঠিক আগের মতো ফেরে — উদ্ধৃতি, ট্যাগ, রং, সময়সূচি, কভার সব। “এখনই খালি করুন” চাপলে এখানকার সবকিছু চিরতরে মুছে যায়।
bin.empty-now.label = এখনই খালি করুন
# The kind filter, which appears only once there is more than one kind to tell
# apart. {kind} is a plural from the table above, lower-cased by the caller.
bin.filter.all.label = সব
bin.filter.only.tip = শুধু {kind} দেখান
bin.state.loading = ডাস্টবিন পড়া হচ্ছে…
bin.state.empty = কিছু মোছা হয়নি — যা মুছবেন, আগে এখানে এসে জমবে
bin.state.empty-kind = ডাস্টবিনে ওই ধরনের কিছু নেই
# A row. {label} is what the thing was called; the two fallbacks below stand in
# when it had no name a reader would recognise.
bin.row.untitled.label = নামহীন
# bn: The hole stays bare — a case marker on {label} would be right for one noun and wrong for the next (§5.4).
bin.row.expand.aria = {label} — ভিতরে কী আছে
bin.row.expand.fallback = এই এন্ট্রি
bin.row.this.label = এটা
bin.row.restore.aria = {label} ফিরিয়ে আনুন
bin.row.restore.tip = ফিরিয়ে আনুন
bin.row.purge.aria = {label} চিরতরে মুছুন
bin.row.purge.tip = চিরতরে মুছুন
# When it went. The year is left out when it is this one — a column of “deleted
# 1 Aug 2026” on a bin you emptied last week is noise.
bin.row.deleted.label = মুছেছেন {when}
# The pictures that went down with it and are still held. No number: the row
# says whether any survived, not how many.
bin.row.pictures.one = ছবি রাখা আছে
bin.row.pictures.other = ছবি রাখা আছে
# When it is due to go for good. A DATE, NOT A COUNTDOWN: the purge clock runs
# on server time and only while the server is up, so “gone in 3 days” is a
# promise nothing here can keep.
bin.row.expiry.due = {date} তারিখে চিরতরে যাবে
bin.row.expiry.never = ডাস্টবিন খালি না করা পর্যন্ত থাকবে
bin.row.contents.empty = ভিতরে কোনও উদ্ধৃতি নেই
# Beside the page title: how many entries, and how many quotes went with them.
bin.counts.held = {n} {noun} জমা আছে
bin.confirm.title = ডাস্টবিন খালি করবেন?
bin.confirm.body = এতে {count} আর তাদের ছবি চিরতরে মুছে যাবে। আর ফেরানো যাবে না।
bin.confirm.label = খালি করুন
bin.toast.gone.label = চলে গেছে
bin.toast.emptied.label = ডাস্টবিন খালি হয়েছে
error.restore.generic = ফিরিয়ে আনা গেল না
error.remove.generic = সরানো গেল না
error.empty.bin = খালি করা গেল না
# ---------------------------------------------------------------------------
# STRAY MARKS — CleanupPage.jsx. What a quote picked up on its way in. The page
# spans all three kinds, so §2.5's umbrella উদ্ধৃতি is the word throughout —
# never দাগ, সংলাপ or উক্তি, which belong to one screen each.
#
# NOTHING HERE IS AN INSTRUCTION. The page reports and never edits, so every
# label names what was FOUND rather than what to do about it.
# ---------------------------------------------------------------------------
checks.title = যাচাইকরণ

cleanup.title = বাড়তি চিহ্ন
# Beside the title: how many quotes were read, so “nothing found” is
# distinguishable from “nothing looked at”.
cleanup.counts.scanned = {n} {noun} পড়া হয়েছে
cleanup.info.title = বাড়তি চিহ্ন
cleanup.info.body = উদ্ধৃতি যে পাতা থেকে এসেছে, সেখানকার বাড়তি চিহ্ন খুঁজে দেয় — ফাঁকা জায়গা, পাতার নম্বর, পাদটীকার চিহ্ন। আপনি মেনে না নেওয়া পর্যন্ত কিছু বদলায় না; কিছু ধরা পড়া জিনিস আসলে লেখারই অংশ, তাই প্রতিটা দেখে নিন।
cleanup.state.loading = সব উদ্ধৃতি পড়া হচ্ছে…
cleanup.state.clean = দেখার কিছু নেই — প্রতিটা উদ্ধৃতি যেমন লেখা, তেমনই আছে
cleanup.state.clean-rule = এই নিয়মে কিছু পাওয়া যায়নি
# When the cap was reached. A silently shortened list is indistinguishable from a
# clean library, so the page says it out loud.
cleanup.state.truncated = প্রথম {count} — কয়েকটা সামলে নিয়ে বাকিগুলোর জন্য আবার দেখুন
# THE RULES, one label and one line each. The label names what was found, never
# what to do about it: nothing here fixes anything.
cleanup.rule.invisible.label = অদৃশ্য অক্ষর
cleanup.rule.invisible.body = চোখে পড়ে না এমন ফাঁকা জায়গা বা হাইফেন — HTML থেকে, দুপাশ সমান করা PDF থেকে, বা দুই লাইনে ভাঙা শব্দ থেকে।
cleanup.rule.edge-space.label = দুপ্রান্তে স্পেস
cleanup.rule.edge-space.body = উদ্ধৃতির শুরুতে বা শেষে একটা স্পেস — কার্ড সেটা লুকিয়ে রাখে, খোঁজ রাখে না।
cleanup.rule.double-space.label = জোড়া স্পেস
cleanup.rule.double-space.body = পরপর দুই বা তার বেশি ফাঁকা জায়গা — দুপাশ সমান করা লেখা থেকে, বা দাঁড়ির পরে ইচ্ছে করেই দেওয়া।
cleanup.rule.space-before-punctuation.label = যতিচিহ্নের আগে স্পেস
cleanup.rule.space-before-punctuation.body = কমা, দাঁড়ি বা বন্ধনীর ঠিক আগে একটা স্পেস। ফরাসি ভাষায় এটা ইচ্ছে করেই দেওয়া হয়।
cleanup.rule.reference-mark.label = পাদটীকার নম্বর
cleanup.rule.reference-mark.body = থেকে যাওয়া কোনো সূত্রচিহ্ন — ওপরে-তোলা সংখ্যা, বন্ধনীর মধ্যে সংখ্যা, বা শেষ শব্দের গায়ে লেগে থাকা কোনো অঙ্ক।
cleanup.rule.pronunciation.label = উচ্চারণের নির্দেশ
cleanup.rule.pronunciation.body = অভিধানের উচ্চারণের নির্দেশ, শব্দটার সঙ্গেই চলে এসেছে।
cleanup.rule.hyphen-break.label = লাইন ভাঙার হাইফেন
cleanup.rule.hyphen-break.body = দুলাইনে ভাঙা শব্দ আবার জোড়া লেগেছে, কিন্তু হাইফেনটা ভিতরে রয়ে গেছে।
cleanup.rule.repeated-punctuation.label = দুবার যতিচিহ্ন
cleanup.rule.repeated-punctuation.body = পরপর দুটো কমা, দাঁড়ি বা চিহ্ন। তিনটে ডট (…) আর জোড়া ড্যাশ বাদ থাকে।
# WHICH TEXT it was found in. Names are never scanned — see cleanup.go — so these
# three are the whole list.
cleanup.field.quote.label = উদ্ধৃতিতে
cleanup.field.note.label = নোটে
cleanup.field.translation.label = অনুবাদে
# A row. {count} is how many times the rule fired in that one field; the snippet
# beside it marks the find with guillemets, because half these rules find
# something that has no appearance at all.
cleanup.row.times = ×{n}
cleanup.row.open.tip = উদ্ধৃতিটা যেখানে আছে, সেখানে যান
cleanup.row.open.aria = {label} খুলুন
cleanup.row.no-work.label = আলাদা উক্তি
cleanup.filter.all.label = সব
error.cleanup.generic = গ্রন্থাগার পড়া গেল না

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
reverify.title = মেটাডেটা আবার মিলিয়ে দেখুন
reverify.title.fills = ফাঁকা ঘরগুলো আনুন
reverify.checking.prose = প্রতিটা বই-সিনেমা তার যুক্ত উৎসের সঙ্গে মিলিয়ে দেখা হচ্ছে — আপনি মেনে না নেওয়া পর্যন্ত কিছুই বদলাবে না।
reverify.checking.progress = দেখা হচ্ছে · {done}/{total}
# The tally across the top once the checking is done.
reverify.summary = {checked}টা দেখা হল · {changed}টায় বদল · {clean}টা আগের মতোই ঠিক
reverify.summary.skipped = {n}টা বাদ (বাঁধা id নেই)
reverify.summary.failed = {n}টা পারা গেল না
reverify.clean = যা যা দেখা হল, সব আগে থেকেই ঠিক ✓
# One item's card.
reverify.item.open.tip = কী কী বদল হবে, দেখান
reverify.item.approved = {n}/{total} মেনে নেওয়া
reverify.item.approve-all = সব মেনে নিন
reverify.item.approve-none = কিছুই না
# One field's row inside it. The two column heads are drawn in small caps.
reverify.field.approve.tip = এই বদল মেনে নিন
# bn: Bengali has no letter case, so the two small-caps column heads are ordinary words.
reverify.column.stored = যা আছে
reverify.column.fresh = যা এল
# A cast list is clamped to six; this is the tail.
reverify.value.more = আরও {n}টা
# Why an item had nothing checked, or could not be.
reverify.status.unpinned = বাঁধা id নেই
reverify.status.fetch-failed = সূত্র পর্যন্ত পৌঁছানো গেল না
reverify.status.not-found = পাওয়া গেল না
# The button, and what it says while it works.
reverify.apply.label.one = মেনে নেওয়া {n}টা বদল বসান
reverify.apply.label.other = মেনে নেওয়া {n}টা বদল বসান
reverify.apply.busy = বসানো হচ্ছে…
# One line per applied item, afterwards. {note} is the server's own reason for
# leaving an image alone.
reverify.result.applied = বসেছে
reverify.result.applied-note = বসেছে ({note})
# The toast at the end.
reverify.flash.one = আবার মিলিয়ে দেখা: {n}টা বদলেছে
reverify.flash.other = আবার মিলিয়ে দেখা: {n}টা বদলেছে
reverify.flash.failed = {n} পারা গেল না
reverify.flash.skipped.one = {n}টা ছবি বাদ
reverify.flash.skipped.other = {n}টা ছবি বাদ
error.reverify.preview = আগে থেকে দেখানো গেল না
error.reverify.apply = বসানো গেল না
error.reverify.interrupted = মিলিয়ে দেখা মাঝপথে থেমে গেছে — কানেকশন দেখে নিয়ে আবার খুলুন
error.reverify.apply-interrupted = বসানো মাঝপথে থেমে গেছে — কানেকশন দেখে আবার চেষ্টা করুন (যা বসে গেছে, বসাই থাকবে)

# ---------------------------------------------------------------------------
# ফিল্ডের প্রার্থীরা — fieldOffers.jsx. একটা ফিল্ড, আর প্রত্যেক জোগানদারের বয়ান।
# ডিটেলসের সারিতে নামের ছাপে চাপ দিলে খোলে।
offers.prose = {field} নিয়ে কে কী বলছে
# রেকর্ডে এখন যা আছে, সেই সারি। যে লিখেছিল তার ছাপ থাকে, নামের বদলে এই কথাটা।
offers.column.stored = যা আছে
offers.take.tip = এই ফিল্ডে {source}-এর বয়ান নিন
offers.taken.toast = {field} এখন {source} থেকে আসছে
offers.none.prose = এই ফিল্ড নিয়ে আর কোনও জোগানদারের আলাদা বয়ান নেই।
offers.unpinned.prose = এই রেকর্ড কোনও জোগানদারের সঙ্গে বাঁধা নেই। আগে খুঁজে নিয়ে বেঁধে ফেলুন।

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
# bn: The eight format names are proper nouns and stay as themselves (§8); “My
# Clippings” is the filename on the device. URLs, file extensions and the
# Ctrl+S / ⌘S key names are Latin for the same reason.
import.source.markdown.title = Markdown
import.source.markdown.desc = Tippani থেকে রপ্তানি করা বই বা ক্যাটালগ, কিংবা Readest-এর রপ্তানি — .json আর Markdown দুটোই পড়া যায়।
import.source.markdown.step.1 = Tippani-র রপ্তানি (বই বা ক্যাটালগ), Readest-এর রপ্তানি, বা নিজের লেখা frontmatter আর উদ্ধৃতি আমদানি করুন।
import.source.markdown.step.2 = একটা .md ফাইলে অনেক বই বা টাইটেল থাকতে পারে — প্রত্যেকটাই আসবে।

import.source.readest.title = Readest
import.source.readest.desc = Readest-এর হাইলাইট রপ্তানি — রং আর প্রতিটা হাইলাইটের তারিখও চলে আসে।
import.source.readest.step.1 = Readest-এ বইটার অ্যানোটেশন খুলে এক্সপোর্ট করুন।
import.source.readest.step.2 = .json ফাইলটা আনুন — Readest-এর Markdown এক্সপোর্টও পড়া হয়।

import.source.bookcision.title = Bookcision
import.source.bookcision.desc = Bookcision বুকমার্কলেট দিয়ে Kindle-এর উদ্ধৃতি।
import.source.bookcision.step.1 = read.amazon.com/notebook-এ গিয়ে বইয়ের Notes & Highlights খুলুন।
import.source.bookcision.step.2 = Bookcision বুকমার্কলেট চালান, তারপর Download → JSON, আর সেই ফাইলটা আনুন।
import.source.bookcision.step.3 = বুকমার্কলেট চান না? তার বদলে সেভ করা কিন্ডল নোটবুক পাতাটা আমদানি করুন — রংও থেকে যায়।

import.source.hardcover-html.title = Hardcover
import.source.hardcover-html.desc = Hardcover-এ একটা বইয়ের পড়ার জার্নালের পাতা।
import.source.hardcover-html.step.1 = নিজের জার্নালের পাতা খুলুন, যেমন hardcover.app/books/<book>/journals/@you
import.source.hardcover-html.step.2 = পাতাটা ওয়েব পেজ হিসেবে সেভ করুন, শুধু HTML (Ctrl+S / ⌘S)।
import.source.hardcover-html.step.3 = সেভ করা .html আনুন।

import.source.goodreads-html.title = Goodreads
import.source.goodreads-html.desc = বইয়ের খোলা Quotes পাতা — উদ্ধৃতির ট্যাগও সঙ্গে আসে।
import.source.goodreads-html.step.1 = বইয়ের Quotes পাতা খুলুন, যেমন goodreads.com/work/quotes/<id>-<book>
import.source.goodreads-html.step.2 = পাতাটা ওয়েব পেজ হিসেবে সেভ করুন, শুধু HTML (Ctrl+S / ⌘S)।
import.source.goodreads-html.step.3 = সেভ করা .html আনুন।

import.source.imdb-quotes.title = IMDb উদ্ধৃতি
import.source.imdb-quotes.desc = সিনেমা বা শো-র Quotes পাতা → সংলাপ (ক্যাটালগে)।
import.source.imdb-quotes.step.1 = টাইটেলের Quotes পাতা খুলুন, যেমন imdb.com/title/tt0434409/quotes
import.source.imdb-quotes.step.2 = পাতাটা ওয়েব পেজ হিসেবে সেভ করুন, শুধু HTML (Ctrl+S / ⌘S)।
import.source.imdb-quotes.step.3 = সেভ করা .html আনুন।

import.source.kindle-notebook.title = Kindle নোটবুক
import.source.kindle-notebook.desc = Kindle-এর Notes & Highlights পাতা — রং আর লোকেশন সঙ্গে আসে।
import.source.kindle-notebook.step.1 = read.amazon.com/notebook খুলে বইটা বাছুন।
import.source.kindle-notebook.step.2 = পাতাটা ওয়েব পেজ হিসেবে সেভ করুন, শুধু HTML (Ctrl+S / ⌘S)।
import.source.kindle-notebook.step.3 = সেভ করা .html আনুন।

# The filename on the device. Latin in every language, per §8.
import.source.kindle-clippings.title = My Clippings
import.source.kindle-clippings.desc = Kindle যন্ত্রপাতির নিজের ফাইল — একবারে সব বই, উদ্ধৃতি আর নোট সমেত।
import.source.kindle-clippings.step.1 = USB দিয়ে Kindle লাগান।
import.source.kindle-clippings.step.2 = যন্ত্রপাতি থেকে documents/My Clippings.txt কপি করুন।
import.source.kindle-clippings.step.3 = এটাই আনুন — ফাইলের সব বই একবারেই আসবে।
# Not keyed as .info or .hint on purpose: this is a caveat under a chip, not a
# dot's body, and it is longer than the 240 those are held to.
import.source.kindle-clippings.caveat = কিন্ডলের ক্লিপিংস ফাইলের কোনো লিখিত নিয়ম নেই, আর যন্ত্রের ভাষা অনুযায়ী বদলায় — তাই কিছু লেখা ঠিকমতো পড়া না-ও যেতে পারে। যা পড়া যায় না তা বাদ যায়, আর কটা বাদ গেল জানানো হয়।

# The honest chip beside a format that can misread a file.
import.experimental.label = পরীক্ষামূলক
# The drop target's two lines. The first is the press, the second says the box
# takes a dropped file too — not a separate control, the same one.
import.choose.label = ফাইল বাছুন — একটা বা অনেকগুলো
import.drop.hint = বা এখানে টেনে এনে ছাড়ুন
# The eight how-tos moved to the "?" (import.help.sources).

# WHEN THE BYTES DO NOT SAY. The reader's override, offered only on a file no
# parser claimed.
import.unknown.body = ফাইলটার ভিতরে কোথাও লেখা নেই এটা কী। ফরম্যাট বেছে দিন, আবার পড়া হবে।
import.read-as.label = এই ফরম্যাট হিসেবে পড়ুন…
import.read-as.aria = আপনার বেছে দেওয়া ফরম্যাট হিসেবে ফাইলটা পড়া হবে
import.read-as.placeholder = ফরম্যাট বাছুন
import.read-as.unqueued = এই ফাইল থেকে কিছুই জমা হয়নি। ওপরে একটা ধাঁচ বাছুন, বা পরে ফাইলটা আবার দিন।

# WHAT THE FILE ACTUALLY IS. Each names the door that does take it — the screen
# names are this file's own (settings.restore.title, settings.section.lang.label).
import.near-miss.backup = এটা টিপ্পনীর ব্যাকআপ — সেটিংস → ফিরিয়ে আনা দিয়ে ফেরান।
import.near-miss.zip = এক্সপোর্টের আর্কাইভ গোটাটা ইমপোর্ট হয় না — unzip করে ভিতরের ফাইলগুলো ছাড়ুন।
import.near-miss.epub = Tippani হাইলাইট রাখে, বই নয় — তার বদলে আপনার রিডার থেকে হাইলাইটগুলো রপ্তানি করুন।
import.near-miss.image = প্রচ্ছদ বসে বই বা সিনেমার নিজের পাতা থেকে।
import.near-miss.font = ফন্ট আপলোড হয় সেটিংস → ফন্ট থেকে।
import.near-miss.binary = ফাইলটা টেক্সট নয়, তাই পড়ার মতো কিছু নেই।

# The run's summary line. Two plural families rather than one sentence, because
# the file count and the quote count pluralise independently.
import.summary.files.one = {n}টা ফাইল
import.summary.files.other = {n}টা ফাইল
import.summary.quotes.one = {n}টা উদ্ধৃতি বাকি
import.summary.quotes.other = {n}টা উদ্ধৃতি বাকি
import.summary.arrow = {files} → {quotes} · গ্রন্থাগারে এখনও কিছু ঢোকেনি
# One row per file.
import.row.staged.one = {n}টা উদ্ধৃতি বাকি
import.row.staged.other = {n}টা উদ্ধৃতি বাকি
import.row.duplicate = ⚠ মনে হচ্ছে বইটা আগে থেকেই আছে: {titles} — অপেক্ষার তালিকায় উদ্ধৃতিগুলো সেখানে সরিয়ে দিন, বা আলাদা বই হিসেবে অনুমোদন দিন
# The hand-over to the queue.
import.review.one = বাকি পড়ে থাকা {n}টা উদ্ধৃতি দেখুন
import.review.other = বাকি পড়ে থাকা {n}টা উদ্ধৃতি দেখুন
import.review.absent = দেখে মেনে নিতে “যাচাই বাকি ইমপোর্ট” খুলুন

# Where one parsed work will land. Two keys rather than one with an optional
# parenthetical, so neither language has to build a bracket.
import.work.joins = আগের “{title}”-এর সঙ্গে জুড়বে
import.work.joins-year = আগের “{title}” ({year})-এর সঙ্গে জুড়বে
import.work.new = নতুন একটা {kind}
import.work.ambiguous = ⚠ “{title}” নামে আপনার {n}টা আছে — অপেক্ষার তালিকায় দেখা যাবে কোনটা বাছা হয়েছে, আর বদলানোও যাবে

# What a My Clippings.txt import dropped, and why. A best-effort parser that
# quietly returns fewer quotes than the file held is worse than one that says so.
import.clippings.bookmarks.one = {n}টা বুকমার্ক বাদ (আনার মতো লেখা নেই)
import.clippings.bookmarks.other = {n}টা বুকমার্ক বাদ (আনার মতো লেখা নেই)
import.clippings.notes.one = {n}টা নোট নিজের উদ্ধৃতির সঙ্গে জুড়েছে
import.clippings.notes.other = {n}টা নোট নিজের উদ্ধৃতির সঙ্গে জুড়েছে
import.clippings.duplicates.one = {n}টা দুবার-সেভ-করা উদ্ধৃতি এক হয়েছে
import.clippings.duplicates.other = {n}টা দুবার-সেভ-করা উদ্ধৃতি এক হয়েছে
import.clippings.malformed.one = {n}টা রেকর্ড পড়া গেল না
import.clippings.malformed.other = {n}টা রেকর্ড পড়া গেল না

# The contract of the screen, stated in place so the absence of “12 added” reads
# as intended rather than as a failure. {queue} is the queue's own name, in bold.
import.nothing-lands.body = আমদানি করা সব কিছু আপনার অনুমোদনের আগে পর্যন্ত {queue}-এ থাকে — তার আগে সংগ্রহে, খোঁজে বা কুইজে কিছুই ঢোকে না। ওখানে একসঙ্গে অধ্যায় আর অবস্থান ঠিক করুন, উদ্ধৃতি ঠিক বই-সিনেমায় সরান, তারপর অনুমোদন দিন বা বাদ দিন।
# Why imports are save-the-page-and-upload rather than paste-a-URL — a natural
# question, answered once and collapsed. {emphasis} is “on their page”, italic.
import.why-upload.summary = সেভ করা পাতা আপলোড করতে বলছি, URL দিলেই হত না?
import.why-upload.body = Amazon, IMDb বা Goodreads-এর মতো সাইট ব্রাউজারকে অন্য জায়গা থেকে তাদের পাতা আনতে দেয় না — তাই Bookcision-এর মতো বুকমার্কলেটকে {emphasis} চালাতে হয়। সার্ভার পাতা আনতে পারত, কিন্তু ব্যক্তিগত পাতার জন্য আপনার লগ-ইন লাগে, আর এভাবে পাতা ছেঁকে আনা সহজেই বিগড়ায়। নিজের ব্রাউজারে পাতাটা সেভ করে আপলোড করাই ভরসার পথ।
import.why-upload.emphasis = ওদের পাতাতেই

error.import.failed = ইমপোর্ট করা গেল না

# The queue's own name, which the import screen also puts in bold in its
# standing note. ONE KEY, so the two screens cannot disagree about what the
# place is called.
staging.title = যাচাই বাকি ইমপোর্ট

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
# bn: RESET STAYS LATIN. The reader must type the word the server compares, so
# {word} arrives as RESET and the sentence is built around it.
account.photo.upload = ছবি আপলোড করুন
account.photo.change = ছবি বদলান
account.photo.info.title = প্রোফাইলের ছবি
account.photo.info.body = ওপরের বারে, মেনুতে আর ব্যবহারকারীর তালিকায় দেখা যায়। চৌকো ছবি সবচেয়ে ভালো মানায়; ৫ MB পর্যন্ত।
account.photo.remove.aria = ছবি সরান
account.photo.remove.tip = ছবিটা সরিয়ে দিন

account.name.label = যে নাম দেখা যাবে
account.name.save = নাম সেভ করুন
account.name.done = নাম বদলে গেছে।

account.password.label = পাসওয়ার্ড বদলান
account.password.info.title = পাসওয়ার্ড বদলান
account.password.info.body = {min}–{max} অক্ষর: বর্ণ, অঙ্ক আর যতিচিহ্ন, অ্যাকসেন্ট-দেওয়া অক্ষর নয়। এটা দিয়েই ব্যাকআপ খোলে, তাই যেকোনো কম্পিউটারে টাইপ করা যায় এমন হওয়া চাই। বদলালে অন্য ব্রাউজার থেকে বেরিয়ে যাবে।
account.password.current.placeholder = এখনকার পাসওয়ার্ড
account.password.new.placeholder = নতুন পাসওয়ার্ড ({min}–{max})
account.password.repeat.placeholder = নতুন পাসওয়ার্ড আবার
account.password.done = পাসওয়ার্ড বদলে গেছে।
account.password.submit = পাসওয়ার্ড বদলান

# Switching accounts is a real re-authentication, not an impersonation.
account.switch.title = অ্যাকাউন্ট বদলান
account.switch.info.title = অ্যাকাউন্ট বদলান
account.switch.info.body = এই সার্ভারের অন্য কোনো ব্যবহারকারী হিসেবে ঢুকুন। প্রতিটা অ্যাকাউন্টের সংগ্রহ আলাদা, আর প্রতিবারই সেই অ্যাকাউন্টের পাসওয়ার্ড লাগে।
account.switch.action = বদলান
# WHO YOU ARE LEAVING — the one fact the form is about. {name} is bold.
account.switch.leaving = {name} ছেড়ে যাচ্ছেন। এই ব্রাউজার ওটা থেকে লগ আউট হয়ে যাবে।
# Real labels, not placeholders: a placeholder is gone the moment you type.
account.switch.name.label = অ্যাকাউন্টের নাম
account.switch.password.label = ওই অ্যাকাউন্টের পাসওয়ার্ড
account.switch.submit = লগ ইন
account.switch.busy = বদলানো হচ্ছে…

account.logout.title = লগ আউট
account.logout.info.title = লগ আউট
account.logout.info.body = শুধু এই ব্রাউজার থেকে বেরোয়। অন্য ব্রাউজারে লগ ইন থেকে যায়।
account.logout.action = লগ আউট

account.sso.label = সিঙ্গল সাইন-অন
account.sso.info.body = পাসওয়ার্ডের বদলে আপনার {name} অ্যাকাউন্ট দিয়ে লগ ইন করুন। যুক্ত করতে এখানে আর {name}-এ দুই জায়গাতেই লগ ইন থাকতে হয়, তাই অন্যের অ্যাকাউন্ট কেউ জুড়তে পারে না।
account.sso.linked = {name}-এর সঙ্গে যুক্ত। যেকোনোটা দিয়ে লগ ইন করা যায়।
account.sso.unlinked = যুক্ত নয়। {name} দিয়ে লগ ইন করতে যুক্ত করুন।
account.sso.link.action = {name} যুক্ত করুন
account.sso.unlink.action = বিচ্ছিন্ন করুন
account.sso.linked.flash = যুক্ত হয়েছে।
account.sso.off = এই সার্ভারে চালু করা নেই।
account.sso.off.info = সিঙ্গল সাইন-অন অপারেটর TIPPANI_OIDC_* সেটিং দিয়ে চালু করেন; README-র "Single sign-on" অংশে Authelia দিয়ে ধাপে ধাপে দেখানো আছে।
account.sso.unlink.confirm.title = {name} বিচ্ছিন্ন করবেন?
account.sso.unlink.confirm.body = লগ ইন করতে এই অ্যাকাউন্টের পাসওয়ার্ড লাগবে। {name} যে অ্যাকাউন্ট বানিয়েছে তার পাসওয়ার্ড আপনার জানা নেই — আগে অ্যাডমিনকে দিয়ে একটা বসিয়ে নিন।

account.widget.label = ড্যাশবোর্ড উইজেট
account.widget.info.body = gethomepage-এর মতো ড্যাশবোর্ড এই চাবি দিয়ে আপনার সংগ্রহের চারটে সংখ্যা দেখায়: রচনা, উদ্ধৃতি, ভুলে যাওয়া আর আয়ত্ত। এটা আর কিছু খোলে না।
account.widget.none = এখনো কোনো চাবি নেই।
account.widget.exists = একটা চাবি চালু আছে।
account.widget.once = এখনই কপি করুন — চাবিটা একবারই দেখানো হয়।
account.widget.yaml.aria = gethomepage services.yaml-এর অংশ
account.widget.copy = YAML কপি করুন
account.widget.copied = কপি হয়েছে
account.widget.make.action = চাবি বানান
account.widget.rotate.action = চাবি বদলান
account.widget.rotate.confirm.title = উইজেটের চাবি বদলাবেন?
account.widget.rotate.confirm.body = পুরনো চাবি সঙ্গে সঙ্গে অচল হবে; ড্যাশবোর্ডে নতুনটা বসান।
account.widget.revoke.action = বাতিল করুন
account.widget.field.works = রচনা
account.widget.field.quotes = উদ্ধৃতি
account.widget.field.forgot = ভুলে গেছি
account.widget.field.mastered = আয়ত্ত

account.notify.label = বিজ্ঞপ্তি
account.notify.info.body = Pushover দিয়ে আপনার ফোনে বার্তা: দিনের রিভিউ তৈরি হলে, আর বড় ইমপোর্ট, ফেচ বা ব্যাকআপ শেষ হলে। pushover.net-এ লগ ইন করলে আপনার ইউজার কি পাবেন।
account.notify.user.label = Pushover ইউজার কি
account.notify.user.placeholder = Pushover ইউজার কি
account.notify.token.label = Pushover অ্যাপ্লিকেশন টোকেন
account.notify.token.placeholder = অ্যাপ্লিকেশন টোকেন
account.notify.token.placeholder.set = অ্যাপ্লিকেশন টোকেন (রাখা আছে — বদলাতে টাইপ করুন)
account.notify.token.placeholder.server = অ্যাপ্লিকেশন টোকেন (ঐচ্ছিক — সার্ভারে একটা আছে)
account.notify.save = চাবি রাখুন
account.notify.saved = রাখা হয়েছে।
account.notify.token.clear = সার্ভারের টোকেন ব্যবহার করুন
account.notify.token.cleared = আপনার নিজের টোকেন সরানো হয়েছে।
account.notify.test.action = পরীক্ষা পাঠান
account.notify.test.sent = পাঠানো হয়েছে — ফোন দেখুন।
account.notify.event.daily.title = দিনের রিভিউ তৈরি
account.notify.event.daily.sub = দিনে একবার, ডেকে কার্ড থাকলে। সার্ভারের দৈনিক কাজ চালু থাকা চাই।
account.notify.event.import.title = বড় ইমপোর্ট
account.notify.event.import.sub = ৫০ বা তার বেশি উদ্ধৃতি রিভিউয়ের অপেক্ষায় থাকলে, আর সেগুলো যোগ হলে।
account.notify.event.fetch.title = লম্বা মেটাডেটা ফেচ
account.notify.event.fetch.sub = ২০ বা তার বেশি রচনার ফেচ শেষ হলে।
account.notify.event.backup.title = ব্যাকআপ
account.notify.event.backup.sub = ব্যাকআপ আর্কাইভ লেখা হয়ে গেলে।

account.maintenance.label = দেখভাল
account.reindex.title = খোঁজের ইনডেক্স আবার বানান
account.reindex.info.title = খোঁজের ইনডেক্স আবার বানান
account.reindex.info.body = খোঁজার সূচি নতুন করে তৈরি করে। খুঁজতে গিয়ে ভেতরের কোনো গোলমালের বার্তা এলে এটা চালান। বই, উদ্ধৃতি, সেটিংস কিছুতে হাত পড়ে না।
account.reindex.action = আবার বানান
account.reindex.busy = বানানো হচ্ছে…
account.reindex.done = খোঁজের ইনডেক্স আবার তৈরি হল — খোঁজ এখন কাজ করা উচিত।
account.reindex.partial = কিছু ইনডেক্স এত নষ্ট যে আবার বানানো গেল না ({failed})। তারপরও খোঁজ না চললে পুরো রিসেটই শেষ উপায়।

account.reset.title = সব ডেটা মুছে দিন
account.reset.info.title = সব ডেটা মুছে দিন
account.reset.info.body = সব চিরতরে মুছে যায় — প্রতিটা অ্যাকাউন্ট, বই-সিনেমা, উদ্ধৃতি, ট্যাগ, মানুষ, স্টিকার, কভার, কী আর সেটিংস — আর অ্যাপ একেবারে প্রথম দিনের মতো নতুন করে শুরু হয়। কোনো ব্যাকআপ নেওয়া হয় না। ফেরানো যায় না।
account.reset.open = সব ডেটা মুছে দিন…
account.reset.confirm.prose = সব মুছে ফেলতে চান, তা নিশ্চিত করতে {word} লিখুন:
account.reset.submit = সব মুছে নতুন করে শুরু করুন
account.reset.busy = মোছা হচ্ছে…

# The admin's list of everyone on the server. Granting is something you do to
# others; revoking is something you do only to yourself.
account.users.label = এই সার্ভারের ইউজাররা
account.users.info.title = ইউজার সামলানো
account.users.info.body = প্রত্যেক ব্যবহারকারীর সংগ্রহ আলাদা। কাউকে অ্যাডমিন করতে পারেন, কিন্তু সেই পদ ছাড়তে পারেন শুধু তিনি নিজে; শেষ অ্যাডমিন ছাড়তে পারেন না।
account.users.admin.chip = অ্যাডমিন
account.users.you.chip = আপনি
account.users.step-down = অ্যাডমিন থেকে নামুন
account.users.step-down.tip = নিজের অ্যাডমিন অধিকার ছেড়ে দিন
account.users.make-admin = অ্যাডমিন করুন
account.users.make-admin.tip = {name}-কে অ্যাডমিন করুন
account.users.only-admin = একমাত্র অ্যাডমিন
account.users.their-own = শুধু নিজেই
account.users.delete.tip = {name} আর তার গ্রন্থাগার মুছুন
account.users.delete.aria = {name} মুছুন
account.users.delete.confirm = “{name}” ইউজার আর তার গ্রন্থাগার মুছবেন?
account.users.delete.note = অ্যাকাউন্টটা বন্ধ অবস্থায় আপনার ডাস্টবিনে থাকবে, ডাস্টবিন বাকি সবকিছু যতদিন রাখে ততদিন। ফিরিয়ে আনলে পুরোটাই তার মালিকের কাছে ফেরে।
account.users.add = ইউজার যোগ করুন
# ইংরেজি ফাইলের নোট দেখুন: উপরের "নতুন পাসওয়ার্ড" বাক্সের সঙ্গে এটির নাম এক হয়ে
# যাচ্ছিল, তাই স্ক্রিন রিডারে দুটোকে আলাদা করা যেত না।
account.users.add.password.placeholder = নতুন অ্যাকাউন্টের পাসওয়ার্ড ({min}–{max})

# What went wrong, keyed by what failed.
error.validate.name-cannot-be-blank = নাম ফাঁকা রাখা যায় না
error.validate.password-current-required = এখনকার পাসওয়ার্ড দিন
error.validate.password-mismatch = নতুন দুটো পাসওয়ার্ড মিলছে না
error.validate.switch-name-required = অ্যাকাউন্টের নাম দিন
error.validate.switch-same = এই অ্যাকাউন্টেই তো আপনি আছেন
error.validate.switch-password-required = ওই অ্যাকাউন্টের পাসওয়ার্ড দিন
error.validate.username-required-add = একটা ইউজারনেম দিন
error.upload.failed = আপলোড করা গেল না
error.remove.photo = ছবি সরানো গেল না
error.save.name = নাম বদলানো গেল না
error.save.password = পাসওয়ার্ড বদলানো গেল না
error.switch.account = অ্যাকাউন্ট বদলানো গেল না
error.reindex.failed = খোঁজের ইনডেক্স আবার বানানো গেল না
error.reset.failed = ডেটাবেস মোছা গেল না
error.load.users = ইউজারদের তালিকা আনা গেল না
error.open.person = এই ব্যক্তিকে খোলা গেল না
error.add.user = ইউজার যোগ করা গেল না
error.save.role = অ্যাডমিনের ভার বদলানো গেল না
error.delete.user = ইউজার মোছা গেল না

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
people.lifespan.died = মৃ. {died}


# The edit form. Bio and Links reuse common.field.*; these are the ones this
# form words for itself.
people.form.founded.label = প্রতিষ্ঠা
people.form.closed.label = বন্ধ
people.form.image-search = ছবি খুঁজুন
# The strip of candidates the search comes back with, when this install has a
# picture source configured. Without one the button opens a web search in a tab
# instead, exactly as it always did, and none of these three are shown.
# The same strip on a cast row, where the picture is of a ROLE — an actor in
# costume — rather than of a person. Only shown when a picture source is
# configured; without one the button opens a web search in a tab as before.
cast.picture.pick.prose = একটা বেছে নিন, বা ঠিকানা বসান
cast.picture.pick.none = কিছুই এল না — অভিনেতার নাম দিয়ে দেখুন, বা ঠিকানা বসান
# কোন সরবরাহকারী কী পেল, ছবি না এলে নিচে দেখানো হয়। পাশের নোটটা সার্ভারের নিজের
# বাক্য আর সেটা যেমন আছে তেমনই দেখানো হয় — ওতে উইকির নাম আর রেকর্ডের আইডি থাকে।
cast.picture.tried.row.one = {source}: {n}টি ছবি
cast.picture.tried.row.other = {source}: {n}টি ছবি
cast.picture.pick.use = {source} থেকে এই ছবিটা নিন
# Two lines of example, joined by the code — the file format is one value per
# line, so a two-line placeholder is two keys. URLs, so unchanged in any
# language.

# The library-wide rename: the fix for two transliterations of one person.
# {noun} is the plural this person is counted in, {entity} the singular row that
# carries the credit — both from unit.*.
# bn: {noun} and {entity} arrive from unit.* and could be any of six nouns, so the holes stay bare (§5.4).
# Two keys rather than one with an it/them switch in the code: English grammar
# living in a ternary is exactly what a locale file is for.



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
cover.noun.cover = কভার
cover.noun.cover.plural = কভার
cover.noun.poster = পোস্টার
cover.noun.poster.plural = পোস্টার
# The field's own heading, drawn in small caps.
cover.heading.cover = কভার
cover.heading.poster = পোস্টার
# A remote host outside the CSP allowlist cannot paint the preview; the file is
# fetched server-side on save regardless.
cover.preview.blocked = এখানে দেখানো গেল না — সেভ করলে সার্ভার এনে নেবে

cover.upload.tip = {noun} হিসেবে ছবি আপলোড করুন
cover.upload.aria = {noun} হিসেবে ছবি আপলোড করুন
cover.fetch-meta.aria = সংস্করণ ধরে মেটাডেটা আনুন
cover.fetch-meta.tip = সংস্করণ ধরে মেটাডেটা আনুন
cover.url.aria = ছবির URL বসান
cover.url.tip = ছবির একটা URL বসান
cover.url.placeholder = https://… ছবির সরাসরি লিংক
cover.url.use.aria = এই URL-টা নিন
cover.url.use.tip = এই ছবিটা নিন
cover.search.aria = {nouns} খুঁজুন
# NAMED BY WHAT ACTUALLY ANSWERS. A game's lookup goes to IGDB, and this said
# “Search TMDB & TheTVDB” — a promise about a supplier that is never asked.
cover.search.books.tip = Google Books, Open Library আর Amazon-এ খুঁজুন
cover.search.screen.tip = TMDB আর TheTVDB-তে খুঁজুন
cover.search.game.tip = IGDB আর Wikidata-য় খুঁজুন
cover.remove.aria = {noun} সরান
cover.verb.edition.label = সংস্করণ
cover.verb.fetch.label = আনুন
cover.verb.upload.label = আপলোড
cover.verb.url.label = লিংক বসান
cover.verb.clear.label = মুছুন
cover.pick.prose = একটা {noun} বাছুন — মাপ দেখানো আছে; বড় হলে ছবি বেশি স্পষ্ট
cover.pick.none = কোনও {nouns} পাওয়া গেল না
# One candidate in the strip. {res} is its measured pixel size, or the wait.
cover.pick.use = এই {noun} নিন — {source} · {res}
cover.pending = নতুন {noun} — সেভ করলে বসবে
cover.clearing = সেভ করলে {noun} সরে যাবে
# ---------------------------------------------------------------------------
# MediaBlock — a picture, its true size, and the verbs that change it. See en.txt
# for why the floor is the server's refetch threshold and not a second opinion.
# ---------------------------------------------------------------------------
media.dims = {w}×{h} px
media.dims.tip = ছবিটার আসল পিক্সেল মাপ, লোড হওয়ার সময় মাপা
media.dims.low.tip = {floor} px-এর চেয়ে সরু — ফেচ করলে বড় ছবি বসবে
media.dims.low.side.tip = ছোট দিকটা {floor} px-এর কম — গোল করে কাটার মতো যথেষ্ট নয়
media.dims.none.tip = এখনও কোনও ছবি নেই

# One compact look-up match, shared by the Add surface and the edition picker.
cover.candidate.editions = {n}টা সংস্করণ
cover.candidate.show-editions = সংস্করণগুলো দেখান
cover.candidate.add.tip = এই মিলটা যোগ করুন
cover.candidate.add.label = যোগ করুন
cover.candidate.choose-edition.aria = {title} — কোন সংস্করণ, বাছুন
cover.candidate.add.aria = {action} {title}

# The book edition picker.
cover.editions.busy = সংস্করণ খোঁজা হচ্ছে…
cover.editions.close.aria = এই তালিকা বন্ধ করুন
cover.editions.browse = অন্য মিলগুলো দেখুন…
cover.editions.looking = খোঁজা হচ্ছে…
cover.editions.none = কিছু মিলল না — নাম বা ISBN বদলে দেখুন
cover.editions.use.aria = {title} নিন
cover.editions.use.exact = নিন: {title}

# The film / show / game picker.
cover.movie.search.aria = খুঁজুন
lookup.matches.label = মিল · {n}
lookup.again.label = আবার খুঁজুন
lookup.again.by-title.label = নাম ধরে
lookup.again.by-id.label = id ধরে
lookup.again.by-id.pinned = {ids}-এর সঙ্গে জোড়া। বদলাতে বিবরণ প্যানেলের আইডি অংশে যান।
lookup.again.by-id.none = এখনো কোনো উৎসের আইডি নেই। বিবরণ প্যানেলের আইডি অংশে একটা দিলে ঠিক রেকর্ডটাই খুঁজে পাওয়া যাবে।
lookup.again.run.label = খুঁজুন
lookup.again.run.tip = {by} দিয়ে আবার খুঁজুন
lookup.searched-by = খোঁজা হয়েছে {by} দিয়ে
lookup.searched-by.nothing = এখনও খোঁজার কিছু নেই
common.work.merge.differ = {n}টা ঘরে অমিল
common.work.merge.take.none = কিছুই টিক করা নেই
cover.movie.none = কিছু মিলল না

error.validate.lookup-fields = আগে নাম, ISBN বা ASIN দিন

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
staging.badge.quotes = উক্তি

# The three states before the list. "nothing waiting" sits in the header's counts
# slot; "nothing staged" is the empty state under it; the third is what a batch
# filter says when the file it points at has no rows left.
staging.state.loading = যাচাইয়ের তালিকা পড়া হচ্ছে…
staging.state.empty-counts = কিছু বাকি নেই
staging.state.empty = কিছুই জমা নেই — ইমপোর্ট আগে এখানেই আসে, আর আপনি সায় না দেওয়া পর্যন্ত এখানেই থাকে
staging.state.empty-file = ওই ফাইলে জমা কোনও উদ্ধৃতি নেই

# The header's counts. A batch can hold works and no quotes at all (a book
# exported with none), which is why there are two of these rather than one.
staging.counts.quotes.one = {n}টা উদ্ধৃতি বাকি
staging.counts.quotes.other = {n}টা উদ্ধৃতি বাকি
staging.counts.works.one = {n}টা উৎস বাকি, কোনও উদ্ধৃতি নেই
staging.counts.works.other = {n}টা উৎস বাকি, কোনও উদ্ধৃতি নেই

# The batch filter. It is a FILTER and not a view: the queue stays one list and
# this narrows it to the file being worked through. {name} is the uploaded
# filename, or the source's name when the file had none.
staging.filter.file.label = ফাইল

# The strip of destination covers under the file filter, and its "everything" chip.
staging.filter.work.aria = সারি কমিয়ে একটি গন্তব্যে আনুন
staging.filter.all-works.label = সবগুলো ({n}টি) উৎস
# bn: The control picks a file, so the file is what it is called; Bengali needs no word for a batch.
staging.filter.batch.aria = ইমপোর্টের ফাইল
staging.filter.all-files.label = সব ফাইল ({n})
staging.filter.batch.label = {name} · {n}
staging.select-all.label = {n}টাই বাছুন

# The two page-level actions, which end the whole queue. The count on Approve
# appears only when there is something to count, so it is two keys rather than a
# number glued onto a label.
staging.approve-all.label = সব মেনে নিন
staging.approve-all.count.label = {n}টাই মেনে নিন
staging.discard-all.label = সব ফেলে দিন
staging.discard-all.confirm.title = জমা সবকিছু ফেলে দেবেন?
staging.discard-all.confirm.body = সব ফাইলের জমা {n}টা উদ্ধৃতিই চলে যাবে। গ্রন্থাগারের কিছুতে হাত পড়বে না।

# THE BULK BAR, over the checked rows. The colour swatches, the two favourite
# buttons, the three panel toggles, and the pair that ends the selection.
staging.bulk.colour.aria = রঙের ঘর বসান
staging.bulk.favourite.label = ♥ প্রিয়
staging.bulk.unfavourite.label = ♥ সরান
staging.bulk.unfavourite.tip = প্রিয় থেকে সরান
staging.bulk.fields.label = ঘর এডিট করুন…
staging.bulk.move.label = পাঠান…
staging.bulk.locations.label = লোকেশন…
staging.bulk.approve.label = {n}টা মেনে নিন
# One word for the bulk button and for the confirm's own button, so the dialog
# cannot promise something the bar did not offer.
staging.discard.label = ফেলে দিন
staging.discard.confirm.title.one = জমা {n}টা উদ্ধৃতি ফেলে দেবেন?
staging.discard.confirm.title.other = জমা {n}টা উদ্ধৃতি ফেলে দেবেন?
staging.discard.confirm.body = গ্রন্থাগারে না ঢুকেই যাচাইয়ের তালিকা থেকে চলে যাবে।

# THE FLASH LINE beside the header — what the last bulk POST did. Every action
# funnels through one request, so these are one family rather than a toast per
# control.
staging.flash.updated = {n}টা বদলেছে
# Approving reports three numbers, and the third only when the server actually
# fetched metadata. THREE KEYS JOINED BY THE CODE rather than one value with an
# optional tail: the parser trims a value, so a file cannot carry the leading
# " · " a third fragment would need.
staging.flash.approved.added = {n}টা যোগ হয়েছে
staging.flash.approved.skipped = {n}টা বাদ
staging.flash.approved.enriched = {n}টায় মেটাডেটা এসেছে
staging.flash.discarded = {n}টা ফেলে দেওয়া হয়েছে
staging.flash.saved = সেভ হয়েছে
# {name} is the CATEGORY's name, not the stored colour token — it said
# "colour → blue" while every card on the screen said "Fact".
staging.flash.colour = → {name}
staging.flash.favourited = প্রিয়তে গেল
staging.flash.unfavourited = প্রিয় থেকে সরল
staging.flash.edited = {n}টা এডিট হয়েছে
# bn: The hole goes after a colon rather than taking -এ, so no case marker lands on a name nobody can see (§5.4).
staging.flash.moved = {n}টা পাঠানো হয়েছে: {title}
staging.flash.merged = {n}টা এক করা হয়েছে
# {op} is one of the six operation words below.
staging.flash.formula = {n}টায় {op} বসেছে

# ONE GROUP — a target work and the staged quotes going to it. The heading is the
# contract: it names where these will land if approved, so a misdetected file is
# visible before the write rather than after it.
staging.group.select.tip = গোটা গ্রুপটা বাছুন
staging.group.select.aria = জমা সব উদ্ধৃতি বাছুন: {title}
# Where the group will land, in three shapes. The standalone-quote group has no
# destination at all — it is the queue's way of holding quotes that belong to
# nothing.
staging.group.standalone.prose = → কোনও বই বা সিনেমার নয় — নিজেদের মতো উক্তি হয়ে সেভ হবে
# {target} IS A NODE — the destination's name as a link, supplied by the call
# site, because markup never goes in a locale value.
staging.group.joins.prose = → যেটা আগে থেকেই আছে, তাতেই জুড়বে: {target}
# The link's own words. Two keys rather than one with an optional parenthetical,
# so no language has to build the bracket itself.
staging.group.target.year.label = {title} ({year})
# The match was pinned by hand rather than guessed, which is worth saying.
# bn: আপনি stays: the point of the line is that this match was your choice, not the app's guess (§1.3).
staging.group.pinned.label = আপনিই বেছেছেন
# {kind} is a singular unit.* noun: book, show or film.
staging.group.new.prose = → নতুন {kind} হিসেবে যোগ হবে
# {n} is at least 2 by construction — a work is only ambiguous when a second
# title shares its name — so this needs no plural family.
staging.group.ambiguous.warning = ⚠ এই নামে {n}টা টাইটেল আছে — ঠিকটাতেই গেছে কি না দেখে নিন
# A group with no quotes left in it. An empty WORK still creates the book or
# film on approval; an empty quotes group creates nothing, because there is
# nothing to it but the quotes.
staging.group.empty.standalone = এই গ্রুপে আর কোনও উক্তি নেই
staging.group.empty.work = কোনও উদ্ধৃতি নেই — মেনে নিলে {kind}-টাই শুধু যোগ হবে

# ONE STAGED ROW. Its locators are drawn from the data; these are the words
# around them.
staging.row.select.tip = এই উদ্ধৃতিটা বাছুন
staging.row.select.aria = এই জমা উদ্ধৃতিটা বাছুন
staging.row.note.label = নোট: {note}
# WHAT THE LINE SAYS, on a staged row. Drawn above the note, the order every card
# in the app uses, and lower-cased to match its neighbour — these two are the row's
# quiet second line, not headings.
staging.row.translation.label = অনুবাদ: {text}
# The mark on a row a location formula has moved. ⚠ MONO SLOT — one short word.
staging.row.shifted.label = সরেছে
staging.row.shifted.tip = লোকেশনের ফর্মুলা এটা সরিয়েছে; আগের মতো করলে ফিরে আসবে

# THE BULK FIELD EDITOR, following the Metadata console: a blank box is ambiguous
# between "leave it" and "clear it", so the tick is what says "act on this field"
# and an empty value then genuinely clears it. The eight field names are the
# shared common.field.* labels.
staging.fields.panel.title = বাছা {n}টা এডিট করুন
# {field} is one of those eight labels, LOWER-CASED BY THE CALLER — the same
# arrangement bin.filter.only.tip uses, and the reason a field's name stays a
# single source of truth rather than being written out eight more times.
staging.fields.set.placeholder = {field} বসান (ফাঁকা = মুছে যাবে)
staging.fields.add-tags.aria = যে ট্যাগ যোগ হবে
staging.fields.remove-tags.label = ট্যাগ সরান
staging.fields.remove-tags.info = অনুমোদনের আগেই বাছা উদ্ধৃতিগুলো থেকে এই ট্যাগগুলো সরিয়ে দেয়।
staging.fields.remove-tags.placeholder = কোন ট্যাগ সরবে…
staging.fields.remove-tags.aria = যে ট্যাগ সরবে
staging.fields.apply.label = {n}টায় বসান

# RETARGETING. Book and film are interchangeable here on purpose: moving a batch
# onto the other kind is the repair for a misdetected file, and a staged row keeps
# both locator sets so the move is reversible.
staging.move.panel.title = বাছা {n}টা পাঠান
staging.move.library.label = গ্রন্থাগারের কোনও বই-সিনেমায়
staging.move.library.info = ধরন পেরিয়েও চলে — বইয়ের হাইলাইট সিনেমায় সরানো যায়, আবার ফেরানোও যায়। অনুমোদনের সময় গন্তব্যের যা দরকার সেই অবস্থান-তথ্যই নেওয়া হয়।
# The button, before and after something is picked. Two keys, so neither language
# has to build "Move to" plus a noun out of two fragments.
staging.move.button.label = পাঠান: {title}
staging.move.button.none.label = কোনও বই-সিনেমায় পাঠান
# The other half: merging into a group already in the queue. {badge} is one of
# the kind badges above.
staging.move.merge.label = বা এই তালিকারই আর কোনও গ্রুপের সঙ্গে এক করে দিন
staging.move.group.aria = জমা গ্রুপ
staging.move.group.placeholder = গ্রুপ বাছুন…
staging.move.group.option = {title} · {badge} ({n})
staging.move.merge.button.label = এক করুন

# THE LOCATION FORMULA — the reason bulk location editing needs more than a text
# box: a Kindle export numbers by location rather than by page (a division), and
# a PDF runs a few pages ahead of the print edition (a subtraction).
staging.formula.panel.title = বাছা {n}টার লোকেশন সরান
staging.formula.field.label = ঘর
staging.formula.field.aria = কোন ঘর
# The visible label and the Select's aria label are the same word, so they are
# one key rather than two chances to disagree.
staging.formula.op.label = কাজ
# The six operations. STORED TOKENS live in the code; these are the words, and
# they are resolved during render rather than at import — a table of copy at
# module scope freezes the language.
# bn: Nouns, not imperatives: the same word reads as an option in a Select and as the
# subject of staging.flash.formula. The four arithmetic words are the schoolbook ones.
staging.formula.op.add.label = যোগ
staging.formula.op.subtract.label = বিয়োগ
staging.formula.op.multiply.label = গুণ
staging.formula.op.divide.label = ভাগ
staging.formula.op.set.label = নতুন মান
staging.formula.op.reset.label = আগের মতো
# The number to shift by, and the text to set instead. Both labels sit in boxes
# 110px and 160px wide.
staging.formula.by.label = কত
staging.formula.by.placeholder = 5
staging.formula.to.label = কী
staging.formula.to.placeholder = পৃ.1
# What a formula does to the text, stated once under the controls. FIVE HOLES,
# ALL OF THEM NODES: the four worked examples and the reset operation's own name
# are drawn in bold by the call site, because markup never goes in a value. Named
# .prose rather than .info.body or .hint on purpose — it is a worked explanation
# under a control, not a popover, and it is longer than a dot's 240-character
# budget allows.
staging.formula.prose = লেখার শুধু সংখ্যাগুলো বদলায়: {from} থেকে 5 বাদ দিলে {to}, আর {range}-এর মতো রেঞ্জের দুই মাথাই সরে। সময় সেকেন্ডের হিসেবে সরে, ফেরে {clock} হয়ে। ফল শূন্যের নিচে নামে না; ভাগফল গোল হয়। {reset} প্রতিটা সারিকে ইমপোর্টের সময়ের মানে ফিরিয়ে দেয়।
# The five bold fragments. HH:MM:SS is a picture of a time format rather than
# words and stays as it is in every language.
staging.formula.example.page-from = পৃ.142
staging.formula.example.page-to = পৃ.137
staging.formula.example.range = 610-612
staging.formula.example.clock = HH:MM:SS
staging.formula.example.reset = আগের মতো

# THE PER-ROW EDITOR, for one-offs. The quote's own text is not editable here,
# because a staged row is a record of what the file said; wording is fixed after
# approval, in the normal edit form.
staging.form.title = জমা উদ্ধৃতি এডিট করুন
# The row's words, shown back as a quotation. The curly pair, as everywhere else.
staging.form.quoted = “{text}”
staging.form.locators.prose = জমা থাকা উদ্ধৃতি দুই ধরনের লোকেশনই রাখে। মেনে নেওয়ার সময় যেখানে যাচ্ছে সেখানকারটাই কাজে লাগে, তাই বই আর সিনেমার মধ্যে সরালে কিছু হারায় না।
# The eight example values. The labels above them are the shared common.field.*
# ones. Philip Marlowe and Elliott Gould are proper nouns; 01:02:03 is a picture
# of a time format.
staging.form.chapter-no.placeholder = 7
staging.form.chapter.placeholder = ঐচ্ছিক
staging.form.location.placeholder = পৃ.142
staging.form.character.placeholder = ফিলিপ মার্লো
staging.form.actor.placeholder = এলিয়ট গুল্ড
staging.form.season.placeholder = 2 (শুধু শো-র জন্য)
staging.form.episode.placeholder = 5 (সিজন লাগবে)
staging.form.timestamp.placeholder = 01:02:03

# THE HOME-SCREEN NUDGE. A half-finished import must not be forgettable, so the
# count surfaces outside the Add surface too. ⚠ THE LABEL IS A MONO SLOT, and it
# is lower case where staging.title is not — the two are different roles, not two
# spellings of one.
staging.card.label = যাচাই বাকি ইমপোর্ট
# bn: আপনার stays here: it is your approval the queue is waiting on, and that is the whole sentence (§1.3).
staging.card.body.one = ইমপোর্ট করা {n}টা উদ্ধৃতি আপনার সায় পাওয়া বাকি।
staging.card.body.other = ইমপোর্ট করা {n}টা উদ্ধৃতি আপনার সায় পাওয়া বাকি।
staging.card.review.label = {n}টা দেখে নিন

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
metadata.counts.mobile = দেখভাল

# --- the phone. A dot rather than an apology: the big filterable lists are
# desktop-only, so the screen says so.

# --- FETCH COVERS & METADATA, the admin-only run over the whole library. The
# endpoint is chunked, so the bar is a real fraction — except before the first
# chunk has reported a total, which is what the second label is for.
metadata.fetch.label = আনুন
metadata.fetch.aria = যে কভার আর মেটাডেটা নেই, আনুন
metadata.fetch.tip = ফাঁকা কভার আর মেটাডেটা ভরান
metadata.fetch.progress = কভার আর মেটাডেটা আসছে · {done}/{total}
metadata.fetch.progress.start = কভার আর মেটাডেটা আসছে…
# The tally afterwards, joined with " · ". Skipped and failed are spelled out so
# a partial run reads as intentional rather than as nothing having happened.
metadata.fetch.flash.covers.one = {n}টা কভার এসেছে বা ভালো হয়েছে
metadata.fetch.flash.covers.other = {n}টা কভার এসেছে বা ভালো হয়েছে
metadata.fetch.flash.details.one = {n}টা ঘর ভরেছে
metadata.fetch.flash.details.other = {n}টা ঘর ভরেছে
metadata.fetch.flash.skipped = {n}টা যেমন ছিল (আরও স্পষ্ট ছবির সূত্র নেই)
metadata.fetch.flash.failed = {n}টা পারা গেল না
metadata.fetch.flash.uptodate = সব আগে থেকেই ঠিক আছে

# --- the two action cards on the phone: a title, one line of what-it-does, and a
# single button. .desc AND NOT .info.body ON PURPOSE — the fetch card's sentence
# is 259 characters and the info-dot budget is 240, and cutting a true caveat to
# fit a role name is the wrong way round. Nothing measures .desc, which is the
# point; both are held to the same voice by hand.

# --- COVERAGE. Tiles on a desktop, the same numbers as plain lines on a phone.
# {group} is one of the three group names and {gaps} the run of non-zero gaps;
# the bold half is a node the code supplies, which is why the line has a hole in
# it rather than markup.
# A tile is also a filter button; {label} is the gap it would filter to.

# --- THE GAP WORDS, one set for the tiles, the two filter dropdowns and the row
# chips. The two long ones are what a ROW says, where a bare "low-res" would not
# say low-res what.
metadata.gap.flagged.label = সমস্যা আছে
metadata.gap.all.label = সব
metadata.gap.no-cover.label = কভার নেই
metadata.gap.no-poster.label = পোস্টার নেই
metadata.gap.low-res.label = ঝাপসা
metadata.gap.low-res-cover.label = ঝাপসা কভার
metadata.gap.low-res-poster.label = ঝাপসা পোস্টার
metadata.gap.no-author.label = লেখক নেই
metadata.gap.no-series.label = সিরিজ নেই
metadata.gap.no-year.label = সাল নেই
metadata.gap.no-genre.label = ঘরানা নেই
metadata.gap.no-source.label = সূত্র নেই
metadata.gap.no-people.label = কেউ নেই
metadata.gap.no-synopsis.label = সারাংশ নেই
metadata.gap.ok.label = সম্পূর্ণ
metadata.gap.no-cast.label = কাস্ট নেই
metadata.gap.no-director.label = পরিচালক নেই
metadata.gap.no-actor.label = অভিনেতা নেই
metadata.issues.title = যা কিছু বাকি আছে
metadata.issues.none = কিছুই বাকি নেই।
metadata.issue.aria = কোন সমস্যা
metadata.issue.all.label = সব
metadata.issue.no-links.label = লিংক নেই
metadata.issue.no-photo.label = ছবি নেই
metadata.issue.no-works.label = কোনও কাজে নেই
metadata.issue.no-quotes.label = উদ্ধৃতি নেই
metadata.issue.no-face.label = মুখের ছবি নেই
metadata.row.works.label = কাজ
metadata.row.quotes.label = উদ্ধৃতি
metadata.issue.people-thin.label = ছবি বা লিংক নেই এমন ব্যক্তি
metadata.issue.people-dup.label = একই ব্যক্তি হতে পারে এমন নাম
metadata.issue.chars-dup.label = একই চরিত্র হতে পারে এমন নাম
# And a row with nothing missing at all.
metadata.row.complete = পুরো ✓
metadata.row.nocover.aria = প্রচ্ছদ নেই
metadata.row.noposter.aria = পোস্টার নেই

# --- THE CATALOGUE, books and films and shows in one list. The type dropdown's
# other three rows are unit.book / unit.film / unit.show — the app's own nouns,
# not a second set for one screen.
metadata.catalogue.type.all.label = সব ধরন
metadata.catalogue.filter.aria = কোন সমস্যা
# The trailing word on a console's filter row: "3 works shown".
metadata.shown.word = দেখানো হচ্ছে
# THE SECTIONS. This screen was one long scroll of six consoles stacked on top
# of each other — a catalogue, duplicates, people, characters, a speaker remap —
# so finding one meant scrolling past the other five, and nothing said how many
# there were. Each kind of metadata is its own place now.
metadata.section.works.info.body = সব বই, সিনেমা, শো আর গেম — কোনটাতে কী নেই সেই হিসেবে। একটা সমস্যা বাছলে শুধু সেগুলো তালিকায় থাকে, তারপর একসঙ্গে সবার কাজ সেরে ফেলুন।
metadata.section.people.info.body = লেখক, অভিনেতা, পরিচালক, স্টুডিও আর প্রকাশকের ছবি ও তথ্যসূত্রের লিংক। “আনুন” চাপলে যা নেই তা ভরে, যা আছে তা হালনাগাদ হয়।
metadata.section.characters.info.body = প্রতিটা চরিত্র — বই আর তার রূপান্তরে একই চরিত্র একটা রেকর্ডে। একই নামের দুজন নিজে থেকে মেলানো হয় না, এখানে দেখে নিন।
metadata.section.languages.info.body = আপনার উদ্ধৃতিগুলো কোন কোন ভাষায়, আর প্রতিটা কীভাবে চিহ্নিত। উদ্ধৃতির ভাষাই ঠিক করে লেখা কোন দিক থেকে পড়া হবে।
metadata.section.categories.info.body = রং বলে উদ্ধৃতিটা কী ধরনের নোট, ট্যাগ বলে সেটা কী নিয়ে, আর স্টিকার হলো উদ্ধৃতিতে লাগানোর চিহ্ন। রঙের নাম বদলালে শুধু দেখানো নামটাই বদলায়; রপ্তানিতে আসল মান যেমন ছিল থাকে।
metadata.section.sources.info.body = আনা তথ্য কোথা থেকে আসে। যে উৎসের চাবি লাগে, চাবি না দেওয়া পর্যন্ত সেটা বাদ থাকে।
metadata.section.works.label = বই ও ছবি
metadata.section.people.label = মানুষ
metadata.section.characters.label = চরিত্র
metadata.section.sources.label = উৎস
metadata.section.languages.label = ভাষা
metadata.section.categories.label = শ্রেণি
metadata.categories.colours.title = রং
metadata.section.aria = কোন মেটাডেটা নিয়ে কাজ
metadata.rail.count.word = মনোযোগ দরকার
metadata.search.placeholder = খুঁজুন…
metadata.catalogue.nomatch = কিছুই মিলল না।
metadata.select-all.label = যা দেখাচ্ছে, সব বাছুন

# --- the bulk bar over a selection. Bulk edit is books-only, so its button says
# so; the actors one greys out when nothing selected has a cast to fill from.
metadata.bulk.open.label = বই একসঙ্গে এডিট করুন…
metadata.bulk.close.label = একসঙ্গে এডিট বন্ধ করুন
metadata.actors.fill.label = কাস্ট থেকে অভিনেতা ভরান
metadata.actors.fill.disabled.tip = বাছা টাইটেলগুলোর কোনওটায়ই কাস্ট নেই — ভরানোর কিছু নেই
metadata.reverify.open.label = আবার মিলিয়ে দেখুন…
metadata.fills.open.label = ফাঁকা ঘরগুলো আনুন…
# What each bulk action asks and reports. The failed tail hangs off whichever ran.
metadata.delete.confirm.one = {n}টা জিনিস আর তার সব উদ্ধৃতি ও সংলাপ মুছবেন?
metadata.delete.confirm.other = {n}টা জিনিস আর তার সব উদ্ধৃতি ও সংলাপ মুছবেন?
metadata.delete.flash.one = {n}টা মোছা হয়েছে
metadata.delete.flash.other = {n}টা মোছা হয়েছে
metadata.bulk.failed.suffix = , {n}টা পারা গেল না
metadata.bulk.flash.one = {n}টা বই বদলেছে
metadata.bulk.flash.other = {n}টা বই বদলেছে
# {actors} and {titles} arrive already counted, which is the only way one
# sentence can carry two counts without a plural rule per pair.
metadata.actors.flash = {titles} জুড়ে {actors} ভরেছে

# --- one row of either list: the tick, the three buttons, the counts. The edit
# and look-up buttons are TOGGLES, so each carries a second word for the state it
# is already in — a latched glyph says which, and the tooltip says what. {noun} is
# the app's own word for the row, book or title.
metadata.row.select.tip = এই {noun} বাছুন
metadata.row.edit.close.label = এডিটর বন্ধ করুন
metadata.row.lookup.close.label = খোঁজা বন্ধ করুন
metadata.row.lookup.tip = সূত্রে খুঁজে দেখুন
metadata.row.open.tip = এই {noun} খুলুন
metadata.row.select.aria = {name} বাছুন
metadata.row.edit.aria = {name} সম্পাদনা করুন
metadata.row.edit.close.aria = {name}-এর সম্পাদক বন্ধ করুন
metadata.row.lookup.aria = {name} খুঁজে দেখুন
metadata.row.lookup.close.aria = {name}-এর খোঁজা বন্ধ করুন
metadata.row.open.aria = {name} খুলুন
# A film's own count. NOT unit.dialogue, which now reads "film line": this row has
# always counted "dialogues", and migrating keys is not the place to rename a
# thing.
metadata.count.dialogues.one = {n}টা সংলাপ
metadata.count.dialogues.other = {n}টা সংলাপ

# --- BULK EDIT, books only. The three row labels are common.field.author,
# common.field.series and the genres line below; these are the placeholders that
# say what filling one will do. "#" is a symbol rather than a word (§8) and is the
# same in every language.
metadata.bulk.title = বাছা {n}টা একসঙ্গে এডিট করুন
metadata.bulk.author.placeholder = লেখক বসান (ফাঁকা = মুছে যাবে)
metadata.bulk.series.placeholder = সিরিজ বসান (ফাঁকা = মুছে যাবে)
metadata.bulk.series-no.placeholder = #
metadata.bulk.genres.label = ঘরানা যোগ করুন
metadata.bulk.genres.placeholder = কমা দিয়ে আলাদা — যোগ হবে, আগেরগুলো থাকবে
metadata.bulk.apply.label = {n}টায় বসান

# --- DUPLICATE WORKS. One copy imported and one added by hand is the case this
# finds, and it is as common for a film as for a book; merging moves the quotes
# onto the copy you keep. Each kind is compared only against its own.
metadata.duplicates.title = একই রচনা দুবার
metadata.duplicates.info.body = যে বই-সিনেমার নাম আর স্রষ্টা প্রায় মিলে যায়, সেগুলো খুঁজে দেয়। বই শুধু বইয়ের সঙ্গে, সিনেমা শুধু সিনেমার সঙ্গে মেলানো হয়। একত্র করলে সব উদ্ধৃতি যেটা রাখবেন তাতে চলে যায়, বাকিগুলো মুছে যায়।
metadata.duplicates.groups.one = {n}টা গ্রুপ
metadata.duplicates.groups.other = {n}টা গ্রুপ
metadata.duplicates.scan.label = একই রচনা খুঁজুন
metadata.duplicates.rescan.aria = ডুপ্লিকেট আবার খুঁজুন
metadata.duplicates.rescan.tip = আবার খুঁজুন
metadata.duplicates.none = কোনও ডুপ্লিকেট পাওয়া গেল না ✓
# The keeper, and the confirm before the others go. BOTH HALVES of that sentence
# have to agree with the count, so each form is written whole rather than as a
# shared head and a tail.
metadata.duplicates.keep.label = এটা থাকবে
metadata.duplicates.merge.label = যেটা থাকবে, তাতে এক করুন
metadata.duplicates.merge.confirm.one = {n}টা বই যেটা রাখছেন তার সঙ্গে এক করবেন? এর উদ্ধৃতিগুলো সেখানে চলে যাবে, অন্য কপিটা মুছে যাবে।
metadata.duplicates.merge.confirm.other = {n}টা বই যেটা রাখছেন তার সঙ্গে এক করবেন? এগুলোর উদ্ধৃতি সেখানে চলে যাবে, বাকি কপিগুলো মুছে যাবে।
metadata.duplicates.merge.flash.one = {n}টা বই এক হয়েছে
metadata.duplicates.merge.flash.other = {n}টা বই এক হয়েছে

# --- SPEAKER & CHARACTER REMAP, one title at a time. RICK, Rick Blaine and
# Bogart are one man; this maps each label onto a real cast member and fills the
# actor in on every line. The three names in the dot are a PERSON and a ROLE, so
# they stay as themselves in every language (§8).
metadata.speakers.title = বক্তা আর চরিত্রের নাম মেলানো
# bn: RICK, Rick Blaine, Bogart — a role and a person, so they stay Latin (§8).
metadata.speakers.info.body = আমদানি করা সংলাপে বক্তার নাম উৎস যেমন লিখেছে তেমনই থাকে — RICK, Rick Blaine, Bogart। প্রতিটা নাম একজন অভিনেতার সঙ্গে জুড়ে দিলে সব লাইনে অভিনেতার নাম বসে যায়। আগে সিনেমাটার অভিনেতাদের তালিকা আনুন।
metadata.speakers.pick.placeholder = — একটা টাইটেল বাছুন —
# The year beside a title in the picker. A wrapper, so the digits stay Western
# and the brackets stay brackets.
metadata.speakers.option.year = ({year})
metadata.speakers.nocast = ⚠ এই টাইটেলে এখনও কাস্ট নেই — আগে উপরে খুঁজে দেখুন, তারপর ফিরে এসে মেলান।
metadata.speakers.loading = এই টাইটেলের কাস্ট ও বক্তারা পড়া হচ্ছে…
metadata.speakers.nolabels = এই টাইটেলের সংলাপে বক্তার কোনও লেবেল নেই।
metadata.speakers.map.label = বক্তার লেবেল → কাস্ট
metadata.speakers.apply.label = নামগুলো বদলে দিন
metadata.speakers.apply.disabled.tip = অন্তত একটা জোড়া বাছুন
metadata.speakers.remapped.flash = {n}টা মেলানো হল
metadata.speakers.refilled.flash.one = , {n}টায় অভিনেতা বসেছে
metadata.speakers.refilled.flash.other = , {n}টায় অভিনেতা বসেছে
# One label's row: what it maps onto, or nothing, or a name you type yourself.
metadata.remap.row.aria = {name} পুনঃনির্ধারণ
metadata.remap.keep.label = যেমন আছে তেমনই
metadata.remap.nocharacter.label = (চরিত্র নেই)
metadata.remap.cast.option = {character} — {actor}
metadata.remap.custom.label = নিজে লিখুন…
metadata.characters.action.merge.aria = {name}-কে আরেকটা চরিত্রের সঙ্গে মেলান
metadata.characters.action.delete.aria = {name}-কে মুছুন
metadata.characters.delete.confirm.title = {name}-কে মুছবেন?
metadata.characters.delete.confirm.body = এটা বিনে যাবে, পরে ফেরানো যায়। বই-সিনেমায় চরিত্রের জায়গাগুলো থেকে যাবে, তবে আর কোনো রেকর্ডের সঙ্গে জোড়া থাকবে না।
metadata.characters.delete.done = {name} ঝুড়িতে গেল
metadata.characters.empty = এখনও কোনও চরিত্র নেই। চলচ্চিত্রের কাস্টের সঙ্গে আসে, নয়তো কোনও কাজে যোগ করুন।
metadata.characters.work.aria = কোন সৃষ্টি
metadata.characters.work.all.label = সব সৃষ্টি
metadata.characters.work.filter.placeholder = সৃষ্টি খুঁজুন

# --- PEOPLE. Every author, actor, director, studio and speaker the library
# mentions, with a portrait and reference links.
# The five toggles. Studios are their own row rather than folded in with
# directors: the two share one stored column and are told apart only by media
# type, so listing them together would offer a studio for renaming as a director.
metadata.people.kind.author.label = লেখক
metadata.people.kind.all.label = সব ভূমিকা
metadata.people.kind.actor.label = অভিনেতা
metadata.people.kind.director.label = পরিচালক
metadata.people.kind.studio.label = স্টুডিও
metadata.people.kind.publisher.label = প্রকাশক
metadata.people.kind.speaker.label = বক্তা
metadata.people.fetch.label = যা নেই, আনুন
metadata.people.fetch.count.label = যা নেই, আনুন ({n})
metadata.people.fetch.progress = ছবি আর লিংক আসছে · {done}/{total}
metadata.people.fetch.flash = মানুষ: {ok}টা এসেছে · {failed}টা পারা গেল না
# The first thing that went wrong, bracketed after the tally. The joining space
# is in the code, because the parser trims a value's ends.
metadata.people.fetch.flash.reason = ({error})
metadata.people.reverify.label = সেভ করাগুলো আবার মিলিয়ে দেখুন
metadata.people.reverify.tip = সব রাখা মানুষকে উৎসের সঙ্গে আবার মিলিয়ে দেখুন। কিছু সেভ হওয়ার আগে বদলগুলো আপনি দেখে নেবেন।
# The hole is bare and the dash carries the sense, so no marker lands on {noun}
# (§5.4). Both forms alike: Bengali has no verb agreement to change here.
# What an empty list says. FIVE, one per toggle: the studio line is new, because
# the table this replaces had four rows and a studio list with nothing in it drew
# an empty state with nothing in it.
metadata.people.empty.author = গ্রন্থাগারে এখনও কোনও লেখক নেই
metadata.people.empty.actor = কোনও সংলাপে এখনও অভিনেতার নাম নেই
metadata.people.empty.director = কোনও সিনেমায় এখনও পরিচালকের নাম নেই
metadata.people.empty.studio = কোনও গেমে এখনও স্টুডিওর নাম নেই
metadata.people.empty.publisher = লাইব্রেরির কোথাও এখনও প্রকাশকের নাম নেই
metadata.people.empty.speaker = এখনও কেউ কিছু বলেননি
metadata.people.empty.all = গ্রন্থাগারে এখনও কেউ নেই
metadata.people.column.roles = ভূমিকা
metadata.people.also = আরও {names}
metadata.people.portrait.aria = {name}-এর ছবি
metadata.people.search.tip = গ্রন্থাগারে “{name}” খুঁজুন
# ONE GLYPH, two words: fetch and refetch are the same act — go and get this
# person's photo and links — and the word flips only because the row already has
# some of it.
metadata.people.row.fetch.label = আনুন
metadata.people.row.refetch.label = আবার আনুন
metadata.people.row.fetch.busy = আনা হচ্ছে…
metadata.people.row.fetch.aria = {name}-এর ছবি ও লিংক আনুন
metadata.people.action.delete.aria = {name}-কে মুছুন
metadata.people.delete.confirm.title = {name}-কে মুছবেন?
metadata.people.delete.confirm.body = এটা বিনে যাবে, পরে ফেরানো যায়। কোনো বই-সিনেমায় এঁর নাম নেই, তাই সেগুলোয় কিছু বদলায় না — শুধু ছবি, জীবনকাল, নোট আর লিংক সরে যায়।
metadata.people.delete.done = {name} বিনে আছে
metadata.people.row.fetch.busy.aria = {name}-এর ছবি ও লিংক আনা হচ্ছে
metadata.people.row.refetch.aria = {name}-এর ছবি ও লিংক আবার আনুন
metadata.people.row.error = {name}: {error}
# Near-duplicate spellings of one person, offered as a one-click merge. Same
# glyph and same act as the book merge above, and it rewrites names across the
# library either way.
metadata.people.dups.count = সম্ভবত ডুপ্লিকেট ({n})
metadata.people.dup.title = সম্ভবত ডুপ্লিকেট — কোন বানানটা রাখবেন?
# bn: রেখে rather than a marker on the hole: “{name}”-এ would be wrong for half the names that land there (§5.4).
metadata.people.merge.label = “{name}” রেখে এক করুন
metadata.people.merge.busy = এক করা হচ্ছে…

# ---------------------------------------------------------------------------
# settings.* (part two) — the nine cards Settings.jsx still held in English:
# Updates, the release log, Onboarding, Devices, the bin tile, Backup, the
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
settings.card.info.title = এটা কী

# --- the quiz card's own heading, which was the last literal left on it.

# --- Features: the heading beside the dot that was already keyed.

# --- the four credit separators. The CHIP draws the bare symbol — the character
# the splitter matches — and this is the name a screen reader reads instead. It
# used to read the stored token out raw.
# bn: The chip draws the bare symbol; these are what a screen reader says instead.
settings.credits.sep.comma.aria = কমা
settings.credits.sep.semicolon.aria = সেমিকোলন
settings.credits.sep.amp.aria = অ্যান্ড চিহ্ন
settings.credits.sep.and.aria = “and” শব্দটা

# --- Language marks: the standing paragraph above the rows. The rest of this
# panel was migrated earlier; this line was missed.

# The specimen inside the little callout — a line of the app's own display face
# doing its job, not a pangram. Write one a reader of this language would keep.
settings.appearance.preset.specimen.label = মার্জিন, লেখার চেয়েও চওড়া…

# ---------------------------------------------------------------------------
# UPDATES (admin only). Checked on demand, never in the background.
# ---------------------------------------------------------------------------
settings.updates.title = আপডেট
settings.updates.version.label = ভার্সন
settings.updates.releases.tip = GitHub-এ রিলিজ নোট
settings.updates.released.label = প্রকাশিত
settings.updates.released.unknown.label = প্রকাশের তারিখ নেই
# The roadmap line. {roadmap} is the link — markup never goes in a value.
# bn: {roadmap} is a link node; it sits after a colon rather than taking a case marker (§5.4).
settings.updates.roadmap.prose = সামনে কী আসছে আর কোন কোন বাগ আগে থেকেই জানা, সব {roadmap}-এ আছে — বাগ জানানোর আগে একবার দেখে নিন। অনুরোধ বা বাগ জানানোও ওখান থেকেই।
settings.updates.roadmap.link.label = রোডম্যাপ ↗
settings.updates.restarting.prose = হালনাগাদ হচ্ছে, আবার চালু হচ্ছে — Tippani ফিরলেই পাতাটা নিজে থেকে রিলোড হবে…
settings.updates.check.label = আপডেট আছে কি না দেখুন
settings.updates.check.busy = দেখা হচ্ছে…
settings.updates.channel.title = রিলিজের ধারা
settings.updates.channel.aria = কোন ধারার রিলিজ অনুসরণ করা হবে
settings.updates.channel.info.body = স্থিতিশীল: শুধু তৈরি হওয়া রিলিজ। প্রি-রিলিজ: পরীক্ষামূলক বিল্ডও — নতুন, কিন্তু বিগড়ানোর সম্ভাবনা বেশি। কোনোটাই নিজে থেকে ইনস্টল হয় না।
settings.updates.channel.stable.label = স্থিতিশীল
settings.updates.channel.prerelease.label = প্রি-রিলিজ
settings.updates.channel.implied.prerelease.prose = আপনি প্রি-রিলিজ চালাচ্ছেন, তাই আপনাআপনি প্রি-রিলিজই আসবে। শুধু তৈরি রিলিজ পেতে স্থিতিশীল বাছুন।
settings.updates.channel.implied.stable.prose = রিলিজ-করা বিল্ডের স্বাভাবিক ধারা — রিলিজ ক্যান্ডিডেটও দেখতে চাইলে বদলান
# A mono label: one short word or symbol pair, whatever the language.
settings.updates.current.label = ✓ আপ টু ডেট
settings.updates.unreachable.prose = GitHub-এ পৌঁছানো গেল না ({error}) — কানেকশন দেখে আবার চেষ্টা করুন
# {version} is the release that is available and arrives as a bold node;
# {current} is the build you are on.
settings.updates.available.prose = {version} এসে গেছে (আপনি চালাচ্ছেন {current})।
settings.updates.notes.label = রিলিজ নোট ↗
# {word} is the literal UPDATE the server compares byte for byte. It arrives as
# a bold node and is never translated.
settings.updates.confirm.prose = {version} নামিয়ে কন্টেনার রিস্টার্ট করতে {word} লিখুন:
settings.updates.apply.label = এখনই আপডেট করে রিস্টার্ট করুন
settings.updates.now.label = এখনই আপডেট
settings.updates.apply.busy = নতুন ইমেজ নামানো হচ্ছে — কয়েক মিনিট লাগতে পারে…
settings.updates.failed.prose = আপডেট শুরুই হল না — কন্টেনারের লগ দেখুন, বা নিচের মতো নিজে হাতে করুন
settings.updates.manual.prose = এক ক্লিকে হালনাগাদের জন্য Docker socket মাউন্ট করা, বা একটা socket proxy লাগে (README দেখুন)। নিজে হালনাগাদ করতে হোস্টে চালান:
settings.updates.copy.label = কপি
settings.updates.toast.reload = একটু পরে পাতাটা রিলোড করুন
settings.updates.toast.same = Tippani আবার চালু হলো, কিন্তু পুরনো বিল্ডেই — নতুন ইমেজ এখনো প্রকাশ হয়নি। কয়েক মিনিট পরে আবার চেষ্টা করুন।
settings.updates.toast.copied = কমান্ড কপি হয়েছে

# ---------------------------------------------------------------------------
# THE RELEASE LOG — the release history out of the binary itself, on Server.
# ---------------------------------------------------------------------------
settings.changelog.title = কী কী বদলেছে
settings.changelog.empty.prose = দেখানোর মতো কোনো রিলিজ নেই — এই বিল্ডটি কোনো রিলিজের বাইরে তৈরি।
settings.changelog.more.label = পুরো তালিকা পড়ুন (আরও {n}টি)
settings.changelog.fold.label = তালিকা গুটিয়ে নিন
# Which release you are actually running, marked on its own row.
settings.changelog.running.label = চলছে
settings.changelog.unlisted.prose = আপনি {version} চালাচ্ছেন, যা তালিকার কোনো রিলিজ নয় — আলাদা করে বানানো বিল্ড।

# ---------------------------------------------------------------------------
# ONBOARDING — the guided tour's home.
# ---------------------------------------------------------------------------
# The Resume button carries its own step count, which is why it keeps its words.

# ---------------------------------------------------------------------------
# DEVICES — pair a phone with this account, and unpair it again.
# ---------------------------------------------------------------------------
settings.devices.title = যন্ত্রপাতি
settings.devices.info.body = অ্যান্ড্রয়েড অ্যাপকে এই অ্যাকাউন্টের সঙ্গে জোড়ে। এখান থেকে আনপেয়ার না করা পর্যন্ত ফোন জোড়া থাকে — পাসওয়ার্ড বদলালেও বেরোয় না।
settings.devices.paired.count = {n}টা পেয়ার করা
settings.devices.code.label = পেয়ারিং কোড
settings.devices.code.info.title = পেয়ারিং কোড
settings.devices.code.info.body = পাঁচ মিনিটের মধ্যে অ্যাপে কোডটা দিন। একবারই কাজ করে; আরেকটা যন্ত্রের জন্য নতুন করে পেয়ারিং শুরু করুন।
settings.devices.code.copy.aria = পেয়ারিং কোড কপি করুন
settings.devices.code.copy.tip = কোড কপি করুন
settings.devices.code.done.aria = পেয়ারিং শেষ
settings.devices.pair.label = যন্ত্রপাতি পেয়ার করুন
settings.devices.revoke-all.aria = সব যন্ত্রপাতি আনপেয়ার করুন
settings.devices.revoke-all.confirm = সব যন্ত্রপাতি আনপেয়ার করবেন? প্রত্যেকটা এখনই কাজ করা বন্ধ করে দেবে।
# {name} is the device's own name, as the phone reported it.
settings.devices.revoke.aria = {name} আনপেয়ার করুন
settings.devices.revoke.confirm = “{name}” আনপেয়ার করবেন? এখনই কাজ করা বন্ধ করে দেবে।
settings.devices.last-seen.label = শেষ দেখা {when}
settings.devices.never.label = কখনও ব্যবহার হয়নি
settings.devices.empty.prose = এখনও কোনও যন্ত্রপাতি পেয়ার করা হয়নি।
settings.devices.toast.unpaired = যন্ত্রপাতি আনপেয়ার হল
settings.devices.toast.all-unpaired = সব যন্ত্রপাতি আনপেয়ার হল



# ---------------------------------------------------------------------------
# BACKUP (admin only) — one dated, encrypted archive, and the prompt that seals
# it. The restore half is settings.restore.* below.
# ---------------------------------------------------------------------------
settings.backup.title = ব্যাকআপ আর ফিরিয়ে আনা
# The prompt's own name, and the button inside it. One act, one word.
settings.backup.prompt.title = ব্যাকআপ নিন
settings.backup.info.body = সবকিছুর একটা তারিখ-দেওয়া, এনক্রিপ্ট করা আর্কাইভ, আপনার পাসওয়ার্ড বা পাসফ্রেজ দিয়ে তালাবন্ধ। অন্য কোথাও খুলতে সেই পাসওয়ার্ডই লাগবে; পাসফ্রেজ হারালে আর ফেরানো যায় না। রিস্টোর করলে এখানকার সবকিছু বদলে যায়।
settings.backup.what.prose = আর্কাইভে সব ব্যবহারকারী, সংগ্রহ, পাসওয়ার্ডের হ্যাশ আর API কী থাকে, তাই সার্ভার ছাড়ার আগেই এনক্রিপ্ট করা হয়। চাবিটা যত্নে রাখুন — অন্য কোথাও খুলতে ওটাই লাগবে।
settings.backup.password.prose = এই পাসওয়ার্ডে যেকোনো Tippani-তে আর্কাইভ খোলে। এই সার্ভারে আপনার এখনকার পাসওয়ার্ডেও সবসময় খোলে, বদলানোর পরেও।
settings.backup.passphrase.label = পাসফ্রেজ · {min}–{max} অক্ষর
settings.backup.passphrase.prose = কোনও অ্যাকাউন্টের সঙ্গে বাঁধা নয় — আর ফেরানোরও পথ নেই। হারালে আর্কাইভও গেল।
settings.backup.use-passphrase.label = বদলে আলাদা একটা পাসফ্রেজ দিন
settings.backup.use-password.label = বদলে নিজের অ্যাকাউন্টের পাসওয়ার্ডই নিন
settings.backup.make.label = ব্যাকআপ নিন
settings.backup.now.label = এখনই ব্যাকআপ নিন
settings.backup.now.busy = ব্যাকআপ হচ্ছে…
settings.backup.download.label = শেষটা ডাউনলোড করুন
# {when} arrives as a bold node; {size} is a byte count in MB or KB, which are
# symbols rather than words.
settings.backup.last.prose = শেষ ব্যাকআপ: {when} · {size} · পরেরটা না হওয়া পর্যন্ত এই সার্ভারে থাকে
settings.backup.empty.prose = এই সার্ভারে এখনও কোনও ব্যাকআপ নেই
# A mono label above the source picker, whose own words are shell.restore.*.
settings.backup.restore-from.label = কোথা থেকে
# What the chosen archive will ask for, said before you commit to it.
settings.backup.asks.passphrase = এর পাসফ্রেজ চাইবে
settings.backup.asks.password = আপনার পাসওয়ার্ড চাইবে
# bn: The marker sits on অ্যাকাউন্টের, never on the hole (§5.4).
settings.backup.asks.password.named = তৈরির সময় ‘{name}’ অ্যাকাউন্টের যে পাসওয়ার্ড ছিল, সেটা চাইবে
# The same, for an archive whose header names nobody. This used to read
# "the password ‘it’ had" — a pronoun assembled in code.
settings.backup.asks.password.era = যে পাসওয়ার্ডে এনক্রিপ্ট করা হয়েছিল, সেটা চাইবে
settings.backup.asks.unknown = পড়া যাচ্ছে না, বা নতুন কোনও টিপ্পনীর লেখা
settings.backup.asks.unkeyed = 1.4.1-এর আগের · চাবি নেই, RESTORE লিখতে বলবে
settings.backup.server.empty.prose = এখানে এখনও কিছুই রাখা নেই
settings.backup.file.choose.label = ফাইল বাছুন…
settings.backup.file.replace.label = অন্য ফাইল বাছুন…
settings.backup.file.none.label = কোনও ফাইল বাছা হয়নি
settings.backup.file.chosen.label = {name} · {size}
settings.backup.restore.label = ফিরিয়ে আনুন…
settings.backup.toast.created = ব্যাকআপ তৈরি হল
settings.backup.toast.restored = ফিরিয়ে আনা হল · লগ আউট হচ্ছে

# ---------------------------------------------------------------------------
# THE RESTORE PROMPT — one dialog, asking for exactly what the chosen archive's
# own header needs. The consequence line lives here rather than on the card,
# because this is the moment it applies.
# ---------------------------------------------------------------------------
settings.restore.title = ফিরিয়ে আনা
# TWO WHOLE SENTENCES, not one with a hole in it: the date clause lands in the
# middle of the warning, and a value cannot begin with the space that would
# need — the parser trims both halves.
settings.restore.warn.prose = এই সার্ভারের সবকিছু বদলে যাবে — সব ব্যবহারকারী, সংগ্রহ আর সেটিং — আর সবাই লগ আউট হবেন। এখনকার তথ্যের একটা কপি ফেরানোর জন্য সার্ভারে রেখে দেওয়া হয়।
settings.restore.warn.dated.prose = এই সার্ভারের সবকিছু {date}-এর ব্যাকআপ দিয়ে বদলে যাবে — সব ব্যবহারকারী, সংগ্রহ আর সেটিং — আর সবাই লগ আউট হবেন। এখনকার তথ্যের একটা কপি ফেরানোর জন্য রাখা থাকে।
# The account password, as against a passphrase — which is why it is not just
# common.field.password.label.
# bn: আপনার stays: the contrast with a passphrase is the point of the label (§1.3).
settings.restore.password.label = আপনার পাসওয়ার্ড
settings.safety.why.prose = প্রথমে এই সার্ভারে এখন যা আছে তার একটা কপি ডাউনলোড করুন। অন্য ব্যাকআপের মতোই এটা সিল করা থাকে, আর এখানে রাখা হয় না।
settings.safety.done.prose = কপি ডাউনলোড হয়েছে। নতুন ডেটা ঠিক আছে কিনা নিশ্চিত না হওয়া পর্যন্ত এটা রেখে দিন।
settings.safety.action = আগে একটা ব্যাকআপ ডাউনলোড করুন
settings.safety.busy = কপি তৈরি হচ্ছে…
settings.safety.first.reason = আগে একটা ব্যাকআপ ডাউনলোড করুন
settings.safety.password.label = কপি সিল করার জন্য আপনার পাসওয়ার্ড
settings.safety.passphrase.label = কপি সিল করার জন্য পাসফ্রেজ
settings.restore.password.recoverable.prose = এই আর্কাইভ এই সার্ভারেরই তৈরি, তাই আপনার এখনকার পাসওয়ার্ডেই খুলবে।
settings.restore.password.named.prose = অন্য সার্ভারে ‘{name}’-এর তৈরি, তাই তখন ওই অ্যাকাউন্টের যে পাসওয়ার্ড ছিল সেটাই লাগবে।
settings.restore.password.era.prose = অন্য সার্ভারে তৈরি, তাই তৈরির সময় যে পাসওয়ার্ড ছিল সেটাই লাগবে।
# A pre-1.4.1 archive carries no key at all, so the typed word stands for it.
# RESTORE is compared byte for byte and stays Latin in every language.
settings.restore.confirm.label = RESTORE লিখুন
settings.restore.confirm.prose = এই আর্কাইভ 1.4.1-এর আগের, এতে কোনো চাবি নেই — তাই শব্দটা টাইপ করলেই নিশ্চিত হবে।
# The close on both prompts: backing out of a form is not the same as closing a
# window you were only reading.
settings.prompt.close.tip = বাতিল করে বন্ধ করুন

# ---------------------------------------------------------------------------
# THE METADATA CARD — the status chips, and the key fields under them.
# ---------------------------------------------------------------------------
# FAULTS ONLY. A chip here is something to act on, and the ones that merely
# reported a working state — the built-in key behind TMDB and behind TheTVDB,
# and the count of titles still pinned to the source that used to be default —
# went on the owner's ruling that the card carries no callouts. What is left is
# a lookup that failed and a film source with no key at all, which will 503.
settings.metadata.books.failing.label = খোঁজ আটকে যাচ্ছে
settings.metadata.tmdb.none.label = চাবি নেই
settings.metadata.last-error.prose = শেষ গোলমাল: {error}
# THE OPEN-ENDED HALF OF THE FAULT LIST — see en.txt. {source} is a proper noun and
# {area} one of the four words below.
settings.metadata.fault.failing.label = {source} {area} আটকে যাচ্ছে
settings.metadata.fault.empty.label = {source} {area} কিছুই পাচ্ছে না
# {why} is the source's own words and is NOT translated — see en.txt.
settings.metadata.fault.why.prose = {source}: {why}
settings.metadata.area.books.label = বইয়ে
settings.metadata.area.films.label = সিনেমায়
settings.metadata.area.games.label = গেমে
settings.metadata.area.pictures.label = ছবিতে
# Half an IGDB pair fails at the Twitch token exchange, which arrives as a
# lookup failure — so the missing half is named. {half} is one of the nouns
# below, not a sentence.
settings.metadata.igdb.half.prose = IGDB-র দুটো অংশই লাগে — {half} এখনো ফাঁকা, তাই গেম খোঁজা কাজ করবে না।

# --- a key field's NAME: the supplier, then the noun beside it. The supplier is
# a proper noun and comes from vocab.source.*; only the noun is copy. Seven
# hardcoded labels became this plus five words.
settings.keys.field.label = {source} {noun}
settings.keys.noun.key = চাবি
# "client id" and "secret" are the field names on Twitch's own console — field
# identifiers, so they appear as themselves (see metadata.help.igdb).
# bn: The field names on Twitch's own console appear as themselves (§8).
settings.keys.noun.client-id = client id
settings.keys.noun.secret = secret
settings.keys.noun.cookie = কুকি
settings.keys.noun.domain = ডোমেন
# The subscriber number a free TheTVDB key logs in with. Their own site calls it
# a PIN, so it appears as itself.
settings.keys.noun.pin = PIN

settings.keys.google.hint = ঐচ্ছিক; দিনে মোটামুটি ১,০০০-এর বেশি খোঁজ হলে তবেই লাগে। console.cloud.google.com → Books API চালু করুন → একটা কী তৈরি করুন।
settings.keys.google.placeholder = Google Books API চাবি — ঐচ্ছিক
settings.keys.tmdb.hint = সিনেমা আর শো-এর জন্য, TheTVDB-র পরে চেষ্টা হয়। themoviedb.org → Settings → API → বিনামূল্যের v3 কী (v4 টোকেনেও চলে)। অ্যাপের ভেতরের ভাগ করা কী-র বদলে এটা খাটে।
settings.keys.tmdb.placeholder = TMDB v3 চাবি বা v4 টোকেন — সঙ্গে আসাটাকে সরিয়ে দেয়
settings.keys.tvdb.hint = সিনেমা আর শো-এর জন্য প্রথমেই এটা চেষ্টা হয়; চরিত্রের ছবি শুধু এখানেই মেলে। thetvdb.com → Dashboard → API keys। বিনামূল্যের কী হলে নিচের পিনও লাগবে।
settings.keys.tvdb-pin.hint = শুধু বিনামূল্যের TheTVDB কী-র জন্য — পিন ছাড়া ওটা কাজ করে না। thetvdb.com → আপনার অ্যাকাউন্ট → Subscriber PIN।
settings.keys.tvdb-pin.placeholder = TheTVDB subscriber PIN — শুধু বিনা পয়সার চাবির জন্য
settings.keys.tvdb.placeholder = TheTVDB v4 API চাবি — ঐচ্ছিক
settings.keys.igdb-id.hint = শুধু গেমের জন্য; IGDB-তে ঢুকতে হয় Twitch দিয়ে। dev.twitch.tv/console → Register Your Application → client ID কপি করুন। নিচের সিক্রেটও লাগবে।
settings.keys.igdb-id.placeholder = Twitch client id — গেমের জন্য লাগে
settings.keys.igdb-secret.hint = একই Twitch অ্যাপ্লিকেশন থেকে: “New Secret” চাপুন। একবারই দেখায়।
settings.keys.igdb-secret.placeholder = Twitch client secret — গেমের জন্য লাগে
# ⚠ .caveat AND NOT .hint, DELIBERATELY. This one runs to 440 characters and the
# 240-character dot budget measures .hint in both languages. It is a security
# warning with a procedure in it — fragile, against Amazon's terms, grants
# account access, and here is where the header is — and no clause in it can be
# dropped to fit a cap, so it is named for what it is instead. Keep it that way.
# bn: .caveat and not .hint — 440 characters of security warning with a procedure in it; nothing can be cut to reach the dot budget.
settings.keys.amazon-cookie.caveat = ঐচ্ছিক — ASIN থাকলেই কভার আসে। কুকি দিলে বিবরণ আর ধরনও আসে, তবে এটা সহজে বিগড়ায়, Amazon-এর নিয়মের বাইরে, আর এতে আপনার অ্যাকাউন্টে ঢোকা যায়; তাই শুধু লেখা যায়, আর কখনো দেখানো হয় না। পেতে হলে Amazon-এ লগ-ইন করে DevTools (F12) → Network খুলুন, যেকোনো amazon অনুরোধ বেছে পুরো "cookie:" হেডারটা কপি করুন।
settings.keys.amazon-cookie.placeholder = Amazon সেশন কুকি — ঐচ্ছিক
# THE SUFFIX, NOT THE HOST — see en.txt for why. The field takes a whole URL
# all the same and keeps only this part.
settings.keys.amazon-domain.hint = আপনার বই কোন Amazon দোকানের — amazon-এর পরের অংশটা, যেমন com, de বা com.au।
# A domain to type, not a word to read.
settings.keys.amazon-domain.placeholder = com
# THE HEADING IS SHORT AND THE ARIA IS WHOLE — see en.txt.
settings.keys.google-scrape.title = গুগল ছবির ফল
settings.keys.google-scrape.aria = গুগল ছবির ফল সরাসরি পড়া হবে
settings.keys.google-scrape.info.body = অন্য কোনো উৎসে ছবি না মিললে তবেই এটা কাজে লাগে। কী লাগে না, কিন্তু অনুরোধ যায় এই সার্ভার থেকে — Google আটকালে বা সীমা বসালে এখানকার সবার অসুবিধা হবে। শুরুতে বন্ধ থাকে।

# --- the row's own controls. A secret is write-only, so "stored" is the whole of
# what can be reported about one; a non-secret shows its value instead.
settings.keys.unset.label = দেওয়া নেই
settings.keys.need.bundled.label = সঙ্গেই আছে
settings.keys.need.required.label = লাগবে
settings.keys.need.optional.label = ইচ্ছেমতো
settings.keys.legend.label = চিহ্ন যা বলে
settings.keys.card.title = কি ও পরিচয়পত্র
metadata.work.goto.label = রচনাটিতে যান
metadata.work.goto.aria = {title}-এ যান
settings.keys.card.info = খোঁজার উৎসগুলোর API কী। এগুলো সার্ভারে থাকে, সব অ্যাকাউন্টের জন্য একই — তাই শুধু অ্যাডমিন দেখতে বা বদলাতে পারেন।
settings.keys.saved.tip = সেভ আছে

settings.sources.group.title = অ্যাপ কাদের জিজ্ঞেস করতে পারে
settings.sources.records.aside = যত রেকর্ড এসেছে
settings.sources.need-key.prose.one = {count}টির জন্য আগে একটা কী লাগবে, তবেই জিজ্ঞেস করা যাবে
settings.sources.need-key.prose.other = {count}টির জন্য আগে কী লাগবে, তবেই জিজ্ঞেস করা যাবে
settings.sources.records.tip.one = আপনার লাইব্রেরির {count}টি ঘর {source} থেকে এসেছে
settings.sources.records.tip.other = আপনার লাইব্রেরির {count}টি ঘর {source} থেকে এসেছে
settings.sources.records.none.tip = {source} থেকে এখনও কিছু আসেনি
settings.sources.test.aria = {source}-কে একটা পরীক্ষামূলক প্রশ্ন করুন
settings.sources.test.tip = {source}-এর কাছে নিশ্চিত থাকা একটা জিনিস চেয়ে দেখা হবে, আর যা আসবে তা জানানো হবে
settings.sources.test-all.label = সব উৎস পরীক্ষা করুন
settings.sources.test-all.tip = যে উৎসগুলো কী নেয়, প্রত্যেককে জিজ্ঞেস করা হবে
settings.sources.testing.label = জিজ্ঞেস করা হচ্ছে…
settings.sources.answered.label = উত্তর এসেছে · {n}টি পাওয়া গেছে
settings.sources.empty.label = উত্তর এসেছে · কিছু পাওয়া যায়নি
settings.sources.failed.label = উত্তর আসেনি
settings.sources.untried.label = এখনও কেউ জিজ্ঞেস করেনি
# {name} is a whole field name — "Google Books key" — and goes in unaltered.
# These two replaced "Add a google books key", lower-cased in code.
settings.keys.add.aria = {name} দিন
settings.keys.replace.aria = {name} বদলান
settings.keys.save.blank.tip = ফাঁকা রেখে সেভ করলে চাবিটা মুছে যাবে
settings.keys.toast.cleared = মুছে গেল

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
error.load.import-queue = ইমপোর্টের যাচাইয়ের তালিকা পড়া গেল না
error.load.bin = রিসাইকল বিন পড়া গেল না
error.load.stats = আপনার পরিসংখ্যান লোড করা গেল না
error.load.favourites = আপনার পছন্দের লেখাগুলো পড়া গেল না
error.load.recall = এই উদ্ধৃতির উত্তরগুলো পড়া গেল না
error.load.shuffle = একটা বাক্য আনা গেল না
error.apply.edit = এডিট বসানো গেল না
error.approve.generic = মেনে নেওয়া গেল না
error.discard.generic = ফেলে দেওয়া গেল না
common.field.favourite.label = প্রিয়

# --- from metadata ---
# Re-fetching covers and metadata across the whole library (POST /covers/refetch).
error.refetch.covers = কভার আবার আনা গেল না
# The duplicate-title scan (GET /metadata/duplicates).
error.scan.duplicates = ডুপ্লিকেট খুঁজে পাওয়া গেল না
# Merging, both kinds: two books into one, and two spellings of one person into
# one name. One act, one error.
error.merge.failed = এক করা গেল না
# The speaker remap will not run with nothing mapped. {action} is the name of the
# button that DOES work with nothing mapped, so the button is named once.
error.validate.mapping-required = অন্তত একটা জোড়া বাছুন, নয়তো “{action}” ব্যবহার করুন।

# The four countable people-nouns beside the existing unit.actor. The Metadata
# screen counts all five ("3 authors still need photos or links"); the studio row
# is the one that was silently missing before.
unit.author.one = লেখক
unit.author.other = লেখক
unit.director.one = পরিচালক
unit.director.other = পরিচালক
unit.studio.one = স্টুডিও
unit.studio.other = স্টুডিও
unit.publisher.one = প্রকাশক
unit.publisher.other = প্রকাশক
unit.speaker.one = বক্তা
unit.speaker.other = বক্তা
unit.person.one = জন
unit.person.other = জন

# --- from settings ---
# The toast that follows a backup offers the copy. "Export" is the neighbouring
# verb and is a different act — this one hands you a file the server already has.
common.action.download.label = ডাউনলোড

# Updates.
error.check.updates = আপডেট আছে কি না দেখা গেল না
error.update.start = আপডেট শুরুই হল না
# A clipboard write the browser refused — the command is still on screen.
error.copy.manual = কপি করা গেল না — নিজে সিলেক্ট করে কপি করুন
error.load.changelog = “কী বদলেছে” আনা গেল না

# Devices.
error.load.devices = যন্ত্রপাতির তালিকা আনা গেল না
error.pair.device = পেয়ারিং শুরু করা গেল না
error.revoke.device = যন্ত্রপাতিটা আনপেয়ার করা গেল না
error.revoke.devices = যন্ত্রপাতি আনপেয়ার করা গেল না

# Backup and restore. "data intact" is the load-bearing half: a restore that
# failed changed nothing.
error.backup.failed = ব্যাকআপ হল না
error.restore.intact = ফিরিয়ে আনা গেল না — ডেটা যেমন ছিল তেমনই আছে

# An uploaded typeface the server would not take.
error.upload.font = ফন্টটা আপলোড করা গেল না

# The third validate reason the restore prompt needs. The other two already
# exist (error.validate.password-required, error.validate.archive-passphrase-
# required) and are reused. RESTORE is compared byte for byte and stays Latin.
error.validate.restore-word = নিশ্চিত করতে RESTORE লিখুন

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
common.field.title.label = নাম
common.field.subtitle.label = উপশিরোনাম
common.field.people.label = মানুষ
common.field.author.label = লেখক
common.field.translator.label = অনুবাদক
common.field.editor.label = সম্পাদক
common.field.year.label = সাল
common.field.text-order.label = কোন লেখাটি আগে
common.field.text-order.inherit.action = আমার সেটিংস অনুসরণ করো
common.field.text-order.inherit.note = এই ভাষার জন্য তোমার সেটিংস অনুসরণ করা হচ্ছে।
common.field.year.circa.label = সালটা আন্দাজ
common.field.pages.label = পৃষ্ঠা
common.field.series.label = সিরিজ
common.field.series-no.label = সিরিজে নম্বর
common.field.isbn.label = ISBN
common.field.asin.label = ASIN
common.field.genres.label = ঘরানা
common.field.genres.placeholder = ঘরানা যোগ করুন…
common.field.description.label = বিবরণ
common.field.note.label = নোট
common.field.tags.label = ট্যাগ
common.field.tags.placeholder = ট্যাগ যোগ করুন…
common.field.quote.label = উদ্ধৃতি
common.field.chapter-no.label = অধ্যায় নম্বর
common.field.chapter-name.label = অধ্যায়ের নাম
common.field.chapter-no.offer = অধ্যায় {no}?
common.field.chapter-name.offer = “{name}”?
common.field.location.label = লোকেশন
common.field.character.label = চরিত্র
common.field.actor.label = অভিনেতা
common.field.timestamp.label = সময়
common.field.season.label = সিজন
common.field.episode.label = এপিসোড
common.field.episode-name.label = এপিসোডের নাম
common.field.act.label = অঙ্ক
common.field.quest.label = কোয়েস্ট
common.field.speaker.label = বক্তা
common.field.occasion.label = উপলক্ষ
common.field.occasion.placeholder = একটা ভাষণ, একটা চিঠি…
common.field.place.label = জায়গা
common.field.place.placeholder = কোথায়
common.field.region.label = অঞ্চল
common.field.recipient.label = প্রাপক
common.field.work-title.label = উৎসের নাম
common.field.locator.label = পৃষ্ঠা
common.field.language.label = ভাষা
common.field.language.placeholder = বাংলা, হিন্দি…
common.field.orig-language.label = মূল ভাষা
common.field.translation.label = অনুবাদ
common.field.translation.placeholder = ইংরেজিতে এর মানে
common.field.media-type.label = ধরন
common.field.name.label = নাম
common.field.name.placeholder = নাম…
common.field.tag.label = ট্যাগ
common.field.style.label = স্টাইল
# --- the fields a re-verify diff can name that nothing else in the app has a
# word for. The other fifteen it reports — title, author, description, year,
# series, isbn, genres, cover, poster, director — already have their label
# above; these are the six a person carries and the three identifiers.
common.field.cast.label = কাস্ট
common.field.portrait.label = মুখের ছবি
common.field.bio.label = জীবনী
common.field.born.label = জন্ম
common.field.died.label = মৃত্যু
common.field.links.label = লিংক
common.field.identity.label = পরিচয়
# Identifiers, which appear as themselves in every language.
common.field.tmdb-id.label = TMDB id
common.field.tvdb-id.label = TheTVDB id

common.field.board.label = বোর্ড
capture.board.default.label = আপনার ডিফল্ট বোর্ড
common.field.anthology.label = সংকলন
common.field.sticker.label = স্টিকার

# The shell's ? — reached from a work page's own ⋯ menu as well as the top bar.
shell.help.menu.label = এই স্ক্রিনে কী আছে
shell.screen.menu.aria = এই স্ক্রিনে যা যা করা যায়
shell.screen.menu.tip = এই স্ক্রিনের কাজগুলো

# ---------------------------------------------------------------------------
# THE LAST FEW, found by sweeping the twenty-five files for a literal still
# sitting in a label, a title or a placeholder prop.
# ---------------------------------------------------------------------------
# The ♥ filter chip, on the Library board and the Catalogue board.
common.favourite.filter.tip = শুধু প্রিয়

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
# allowed to overflow. See test/rules/help-budget.test.js. Nothing here
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


home.help.daily-quiz.term = দৈনিক অনুশীলনী
home.help.daily-quiz.what = আপনার নিজের উদ্ধৃতি নিয়ে ছোট একটা কুইজ — প্রতিটা কার্ড ঠিক তখনই ফেরে যখন ভুলতে শুরু করবেন।
home.help.daily-quiz.more = উত্তর দিলে ওই উদ্ধৃতির স্মৃতির অর্ধায়ু বদলে যায়।

# The named mode beside the Daily Quiz — unlimited and off the schedule.
home.help.practice.term = ঝালাই
home.help.practice.what = যত খুশি কুইজ-ঝালাই, যেটা ইচ্ছে বাদ দিয়ে এগোনো যায়। নিজের আলাদা স্কোর থাকে, আর সেটিংসে না বদলালে সময়সূচিতে হাত দেয় না।

# The verb on a button: a round about one book, person or tag.
home.help.practise.term = ঝালিয়ে নিন
home.help.practise.what = একটা জিনিস নিয়েই এক রাউন্ড।
home.help.practise.more = বই বা সিনেমার মেনুতে, কারও পাতায়, ট্যাগের পাশে আর পরিসংখ্যানের রঙের সারিতে পাবেন। এখনকার পর্দার ওপরেই খোলে, শেষে সেখানেই ফেরায়। রোজকার কুইজ কোনো বিষয় ধরে ছাঁকা যায় না, কারণ সেটা সময়সূচি মেনে চলে।

# The three grading buttons on a quiz card.
home.help.grade.term = দেখি / পেরেছি / ভুলে গেছি
home.help.grade.what = ফ্লিপ কার্ডে উত্তর দেখতে উল্টে দিন, তারপর সৎভাবে বলুন জানতেন কি না। সৎ উত্তরেই সময়সূচি ঠিক থাকে।

# The edit link on an already-answered quiz card.
home.help.fix-or-tag.term = ঠিক করুন বা ট্যাগ দিন
home.help.fix-or-tag.what = উত্তর দেওয়ার পর: কুইজ না ছেড়েই বানান ঠিক করুন, ট্যাগ বদলান বা ♥ দিন।

# The letter or flag a proverb card leads with instead of a face.
home.help.language-mark.term = ভাষার চিহ্ন
home.help.language-mark.what = প্রবাদে কারও নাম থাকে না, তাই তার কার্ডে মুখের বদলে ভাষাটা দেখায়।
home.help.language-mark.more = শুরুতে থাকে ভাষাটার লিপির একটা অক্ষর; মেটাডেটা › ভাষা-য় গিয়ে বদলানো যায়। পতাকা নিজে থেকে বসে না, কারণ ভাষা আর দেশ এক নয়।

# The memory dot every quote card wears.
home.help.status-dot.term = স্মৃতির চিহ্ন
home.help.status-dot.what = একটা বলয়, কতটা বাকি আছে দেখায়: মনে আছে, ভুলছেন, সম্ভবত ভুলে গেছেন, না এখনও অনুশীলনে ওঠেনি। অর্ধায়ু দেখতে ছুঁয়ে দিন।

home.help.favourites.term = প্রিয়
home.help.favourites.what = যে লাইনগুলোয় ♥ দিয়েছেন — হাইলাইট, সংলাপ আর উক্তি একসঙ্গে, প্রতিবার এলোমেলো করে সাজানো।
home.help.favourites.more = একটা খুললে সব সাধারণ কাজ পাবেন — ♥, কপি, শেয়ার, রং আর ⋯ — সঙ্গে একটা বোতাম, যা উদ্ধৃতিটার নিজের জায়গায় নিয়ে যায়।

# ---------------------------------------------------------------------------
# library.help.* — the "?" panel’s section for Library.
# ---------------------------------------------------------------------------

# Heading: aliases nav.tab.library.label, so the screen has ONE name. Nothing to add here.

library.help.filters.term = ফিল্টার
library.help.filters.what = ঘরানা, উইশলিস্ট, প্রিয়, ট্যাগ আছে, নোট আছে, তাকের অবস্থা, সিরিজ আর সাজানো। ফোনে গোটা স্ক্রিন জোড়া প্যানেলে খোলে, সঙ্গে চলতি ফলের সংখ্যা।

library.help.translator-editor.term = অনুবাদক · সম্পাদক
library.help.translator-editor.what = বই যাঁদের হাতে তৈরি, বাকি দুজন।
library.help.translator-editor.more = লেখকের মতোই এঁদেরও নিজের পাতা আছে, আর একই মানুষ এক বইয়ের লেখক, আরেকটার অনুবাদক হতে পারেন। নাম ওঠে শুধু বইয়ের পাতায়, অনু. আর সম্পা. চিহ্ন দিয়ে।

# The chip that scopes the board to books with nothing quoted from them.
library.help.wishlist.term = উইশলিস্ট / তোলা আছে
library.help.wishlist.what = যে বই থেকে এখনও কিছু তোলা হয়নি, সেটাই উইশলিস্ট। সব দেখুন, শুধু সেগুলো দেখুন, বা সেগুলো লুকিয়ে দেখুন আসলে কোনগুলো থেকে তুলেছেন।

library.help.fold-wishlist.term = উইশলিস্ট গুটিয়ে নিন
library.help.fold-wishlist.what = যে বইগুলো থেকে এখনও কিছু তোলেননি, সেগুলো গ্রন্থাগারের সামনে একটা টাইলে জড়ো করে — গায়ে প্রথম চারটে কভার।
library.help.fold-wishlist.more = খুললে উইশলিস্টই দেখায়; কোনও বই থেকে উদ্ধৃতি রাখলে সেটা নিজেই বেরিয়ে যায়। শুরুতে বন্ধ থাকে। গ্রন্থাগার ভাগ করা না থাকলে তবেই খাটে।

library.help.shelf-state.term = তাকের অবস্থা
library.help.shelf-state.what = পড়া চলছে, থেমে আছে, ছেড়ে দেওয়া, শেষ — প্রতিটা কভারের নিচের রঙিন পটিটাই। বইয়ের পাতার চিপ থেকে বসান।

library.help.sort.term = সাজান
library.help.sort.what = নতুন আগে, নাম, লেখক, সাল, সিরিজ, বা শেষ কবে পড়া — শেষ করুন বা না করুন, শেষবার পড়ার তারিখ।
library.help.sort.more = যে বইয়ের পড়ার হিসেব নেই, সেগুলো শেষে, বর্ণানুক্রমে। সাল ধরে সাজালে সাল-না-জানা বইও তাই হয়, আর খ্রিস্টপূর্ব ৩৮০ আসে ১৮৯০-এর আগে।

library.help.group-by.term = ভাগ
library.help.group-by.what = সিরিজ, লেখক, দশক বা ঘরানা ধরে বোর্ডটাকে ভাগে ভাগে দেখুন।

# The masonry / list / table switch.
library.help.view.term = ভিউ
library.help.view.what = ঠাসা টাইল, সাদামাটা তালিকা, বা সাজানো যায় এমন টেবিল।

library.help.export.term = এক্সপোর্ট
library.help.export.what = চোখের সামনে যা আছে, Markdown হয়ে এক্সপোর্ট হয় — আবার ইমপোর্ট করলে ঠিকঠাক ফেরে। একটা তাক চাইলে আগে ফিল্টার করে নিন।
library.help.export.more = লেখার আগে জিজ্ঞেস করে, আর যে সংখ্যাটা বলে, ঠিক ততগুলোই পাবেন।

# ---------------------------------------------------------------------------
# movies.help.* — the "?" panel’s section for Catalogue.
# ---------------------------------------------------------------------------

# Heading: aliases nav.tab.movies.label, so the screen has ONE name. Nothing to add here.

# The chips that narrow the catalogue to one of the three media.
movies.help.media-types.term = সিনেমা / শো / গেম
movies.help.media-types.what = সিনেমা, শো আর গেম সবই এখানে; চিপ দিয়ে একটায় নামুন। শো-র সংলাপে সিজন আর এপিসোড থাকে; গেমের নামের পাশে থাকে স্টুডিও।
movies.help.media-types.more = ক্যাটালগে সেই ধরনের কিছু ঢুকলে তবেই চিপটা দেখা যায়।

movies.help.filters.term = ফিল্টার
movies.help.filters.what = ঘরানা, উইশলিস্ট, প্রিয়, ট্যাগ আছে, নোট আছে, তাকের অবস্থা, অভিনেতা, সিরিজ আর সাজানো — ফোনে গোটা স্ক্রিন জোড়া প্যানেলে।

# The filter that narrows the board to one person’s quoted lines.
movies.help.actor.term = অভিনেতা
movies.help.actor.what = শুধু সেই টাইটেলগুলো দেখায়, যেখান থেকে এই মানুষটির বলা কোনও সংলাপ রেখেছেন।
movies.help.actor.more = গোটা কাস্ট নয়, শুধু যাঁদের সংলাপ রেখেছেন তাঁদের নাম আসে। ফিল্টার চালু রেখে খোঁজ টিপলে ওই অভিনেতার সংলাপগুলো টাইটেল ধরে সাজানো দেখায়।

movies.help.shelf-state.term = তাকের অবস্থা
movies.help.shelf-state.what = দেখা চলছে, থেমে আছে, ছেড়ে দেওয়া, দেখা শেষ — প্রতিটা পোস্টারের নিচের রঙিন পটিটাই।
movies.help.shelf-state.more = গেমের বেলায় লেখা থাকে খেলা চলছে আর খেলা শেষ; একটা গেম যোগ করলেই দুটো দেখা যায়।

movies.help.collection.term = সিরিজ
movies.help.collection.what = এক সুতোয় বাঁধা টাইটেলের দল — গ্রন্থাগারের সিরিজেরই সিনেমার দিক।

movies.help.sort.term = সাজান
movies.help.sort.what = নতুন আগে, নাম, সাল, সিরিজ, বা শেষ কবে দেখা — শেষ করুন বা না করুন, শেষবার দেখার তারিখ।
movies.help.sort.more = দেখার খাতায় যেগুলোর কিছু লেখা নেই, সেগুলো শেষে বসে, বর্ণানুক্রমে।

movies.help.group-by.term = ভাগ
movies.help.group-by.what = সিরিজ, পরিচালক, দশক বা ঘরানা ধরে বোর্ডটাকে ভাগে ভাগে দেখুন।

movies.help.export.term = এক্সপোর্ট
movies.help.export.what = চোখের সামনের টাইটেল আর তাদের সংলাপ Markdown হয়ে এক্সপোর্ট হয় — আগে সংখ্যাটা জানিয়ে জিজ্ঞেস করে।

# ---------------------------------------------------------------------------
# book.help.* — the "?" panel’s section for Book.
# ---------------------------------------------------------------------------

# The help panel’s heading on a book’s own page. Not the media-type word — the name of the screen.
book.help.title = বই

book.help.details.term = খুঁটিনাটি
book.help.details.what = রাখা সব তথ্য — নাম, লেখক, সাল, সিরিজ, ISBN, ASIN, ধরন, বিবরণ, কভার।
book.help.details.more = পেনসিল চেপে যেকোনো ঘর বদলান, বা নতুন করে মেটাডেটা এনে বেছে নিন কী নেবেন। কয়েকটা ঘর একসঙ্গে খুলে ওপরের ✓ চাপলে সব একবারে সেভ হয় — একটা একটা করে সেভ করার চেয়ে এটাই নিরাপদ।

# The quote tallies under the author.
book.help.counts.term = সংখ্যা
book.help.counts.what = লেখকের নিচে: বইটায় কটা উদ্ধৃতি, আর তার কটা প্রিয়, কটায় নোট আছে, কটায় ট্যাগ।
book.help.counts.more = ভাগগুলো শূন্যের বেশি হলে তবেই দেখায়। পুরো বই ধরেই গোনা হয়, ছাঁকনিতে কী দেখাচ্ছে তা ধরে নয়।

book.help.hearts.term = হার্ট
book.help.hearts.what = বইটাকে প্রিয় করে রাখুন। প্রত্যেক ইউজারের নিজের আলাদা।

# The reading-state control: start, pause, abandon, finish.
book.help.state-chip.term = অবস্থার চিপ
book.help.state-chip.what = তাক: শুরু, বিরতি, ছেড়ে দেওয়া বা শেষ — আর পড়ার সময় কোন পাতায় বা কত শতাংশে আছেন। শেষ হওয়া বইয়ে কতবার আবার পড়লেন তার হিসেব থাকে।

book.help.add-annotation.term = উদ্ধৃতি যোগ করুন
book.help.add-annotation.what = একটা হাইলাইট রাখুন: উদ্ধৃতি, চাইলে একটা নোট, অধ্যায় আর অবস্থান, রং আর ট্যাগ।

book.help.colour-category.term = রঙের ঘর
book.help.colour-category.what = প্রতিটা উদ্ধৃতি-কার্ডের বাঁদিকের দাগ। ট্যাগ বলে উদ্ধৃতিটা কী নিয়ে; রং বলে সেটা কী ধরনের নোট।
book.help.colour-category.more = রংগুলোর নাম ঠিক হয় মেটাডেটা › রং-এ, আর সব জায়গায় সেই নামই দেখায়। কোনো রং না বাছলে উদ্ধৃতি প্রথম রংটা পায়, তাই সেটার কোনো নাম নেই।

book.help.copy.term = কপি
book.help.copy.what = উদ্ধৃতি আর তার উৎসের নাম সাধারণ লেখা হিসেবে কপি হয়, কোনো সাজসজ্জা ছাড়া।
book.help.copy.more = শেয়ারের সাধারণ-লেখা ধাঁচে যা লেখা হয় তা-ই, তবে পাতা বা সময়, আর রাখার তারিখ বাদে।

book.help.share.term = শেয়ার
book.help.share.what = লাইনটার ছবি দিয়ে খোলে; চাইলে কথাগুলো Markdown, WhatsApp, সাধারণ লেখা বা Reddit-এর ধাঁচে শেয়ার করুন।
book.help.share.more = ছবিটা আপনার যন্ত্রেই তৈরি হয়, কোথাও আপলোড হয় না। কিনারা থেকে আবছা হয়ে ঢোকা লেখকের ছবি থাকতে পারে, উদ্ধৃতির রঙে রাঙানো; লেখকের নাম বন্ধ করলে ছবিটাও সরে যায়।

book.help.export.term = .md এক্সপোর্ট
book.help.export.what = এই বই আর তার সব উদ্ধৃতি, Markdown হয়ে।

# The ⋯ that carries the phone-only actions.
book.help.more-menu.term = আরও (⋯)
book.help.more-menu.what = ফোনে তাকের কাজ, এক্সপোর্ট, খুঁটিনাটি আর মুছে ফেলা — সব এখানে থাকে।

# ---------------------------------------------------------------------------
# film.help.* — the "?" panel’s section for Film, show or game.
# ---------------------------------------------------------------------------

# The help panel’s heading on a film, show or game page — one screen serves all three.
film.help.title = সিনেমা, শো বা গেম

# The credit slot a game uses where a film credits its director.
film.help.studio.term = স্টুডিও
film.help.studio.what = গেমে পরিচালকের জায়গায় থাকে স্টুডিও, মুখের বদলে তার লোগো।
film.help.studio.more = গেম আনলে IGDB থেকে নির্মাতার নাম নেওয়া হয়। না থাকলে জায়গাটা ফাঁকা থাকে।

film.help.publisher.term = প্রকাশক
film.help.publisher.what = যে সংস্থা গেমটা বাজারে এনেছে — প্রায়ই যারা বানিয়েছে তারা নয়। Mass Effect এনেছে EA, বানিয়েছে BioWare।
film.help.publisher.more = স্টুডিওর পরে PUB. হিসেবে সাধারণ নাম হয়ে থাকে। পুরনো কোনো গেমে প্রকাশককে স্টুডিও দেখালে “মেটাডেটা আনুন” থেকে আবার আনুন। সিনেমা আর শো-তে দেখায় না।

film.help.voice-cast.term = কণ্ঠশিল্পী
film.help.voice-cast.what = Wikidata থেকে আনা, তবে প্রায়ই অসম্পূর্ণ।
film.help.voice-cast.more = যে গেমের কোনো নাম পাওয়া যায় না তাতে জায়গাটা ফাঁকা থাকে, নিজেই লিখে নিতে পারেন। অভিনেতাদের ছবির জন্য কোনো কী লাগে না।

film.help.details.term = খুঁটিনাটি
film.help.details.what = রাখা সব তথ্য — নাম, পরিচালক বা নির্মাতা, সাল, সংগ্রহ, আইডি, ধরন, বিবরণ, পোস্টার।
film.help.details.more = একটা একটা করে ঘর বদলান, বা কয়েকটা খুলে ✓ চেপে একসঙ্গে সেভ করুন। উৎস থেকে নতুন করে এনে বেছে নিন কী নেবেন। TMDB আর TheTVDB-র আইডি নিজে লিখেও দেওয়া যায়, পরের খোঁজে সেটাই খাটে; IMDb আইডি শুধু রেখে দেওয়ার জন্য।

# The dialogue tallies under the credit.
film.help.counts.term = সংখ্যা
film.help.counts.what = নামের নিচে: কটা লাইন, আর তার কটা প্রিয়, কটায় নোট আছে, কটায় ট্যাগ।
film.help.counts.more = ভাগগুলো শূন্যের বেশি হলে তবেই দেখায়, আর পুরো সিনেমা ধরেই গোনা হয় — ছাঁকনিতে কী দেখাচ্ছে তা ধরে নয়।

# The watching-state control: start, pause, abandon, finish.
film.help.state-chip.term = অবস্থার চিপ
film.help.state-chip.what = তাক: দেখা শুরু, থামান, ছেড়ে দিন, শেষ করুন — সঙ্গে আবার দেখার ×N হিসেব।
film.help.state-chip.more = গেমে দেখার বদলে খেলার কথা বলে, আর দুটোর বদলে তিনটে একসঙ্গে চলতে পারে।

film.help.add-dialogue.term = সংলাপ যোগ করুন
film.help.add-dialogue.what = সময় আর চরিত্রসহ একটা লাইন; অভিনেতার নাম তালিকা থেকে নিজেই বসে। শো-তে সিজন আর পর্বও দিতে হয়।
film.help.add-dialogue.more = গেমের সংলাপ সময় দিয়ে নয়, তার অঙ্ক আর কোয়েস্ট দিয়ে চিহ্নিত হয়।

film.help.cast.term = কাস্ট
film.help.cast.what = মেটাডেটা আনলে ভরে যায়, আর নতুন লাইনে অভিনেতার নাম এখান থেকেই বসে।

film.help.copy.term = কপি
film.help.copy.what = উদ্ধৃতি আর তার উৎসের নাম সাধারণ লেখা হিসেবে কপি হয়, কোনো সাজসজ্জা ছাড়া।
film.help.copy.more = শেয়ারের সাধারণ-লেখা ধাঁচে যা লেখা হয় তা-ই, তবে সময় আর রাখার তারিখ বাদে।

film.help.share.term = শেয়ার
film.help.share.what = লাইনটার ছবি দিয়ে খোলে; চাইলে কথাগুলো Markdown, WhatsApp, সাধারণ লেখা বা Reddit-এর ধাঁচে শেয়ার করুন।
film.help.share.more = ছবিতে কিনারা থেকে আবছা হয়ে ঢোকা অভিনেতার ছবি থাকতে পারে, উদ্ধৃতির রঙে রাঙানো। দুজন অভিনেতা থাকলে দুজন দুই পাশে।

# ---------------------------------------------------------------------------
# search.help.* — the "?" panel’s section for Search.
# ---------------------------------------------------------------------------

# Heading: aliases nav.tab.search.label, so the screen has ONE name. Nothing to add here.

search.help.exact-phrase.term = হুবহু এই কথাগুলো
search.help.exact-phrase.what = কথাগুলো উদ্ধৃতিচিহ্নের মধ্যে রাখুন — “to be or not to be” — তাহলে ঠিক ওই বাক্যাংশটাই খুঁজবে।
search.help.exact-phrase.more = উদ্ধৃতিচিহ্নের বাইরের কথাগুলো আলগাভাবেই মেলে। চিহ্ন বন্ধ না করলেও অসুবিধা নেই; সেই কথাগুলোও তখন আলগাভাবে মেলে।

# The search input itself.
search.help.box.term = খোঁজার ঘর
search.help.box.what = বানান একটু ভুল হলেও চলে, আর ফল আসে সঙ্গে সঙ্গে। শেষ খোঁজটা মনে রাখে।

search.help.filters.term = ফিল্টার
search.help.filters.what = আপনার সংগ্রহে যত ঘর আর মান আছে, টাইপ না করেই বাছা যায় — আর দ্বিতীয়টা বাছলে ফল কমবে না বাড়বে, তাও দেখায়।
search.help.filters.more = কোনো মান বাছলে টাইপ করলে যে চিপ হতো সেটাই হয়। প্রতিটা মানের পাশে লেখা থাকে এখন বাছলে কটা ফল মিলবে; ০ হলে ধূসর হয়ে যায়, লুকোয় না।

# The field:value grammar and its dropdown.
search.help.colon.term = কোলন কী করে
search.help.colon.what = একটা ঘরের নাম আর কোলন লিখুন, আপনার সংগ্রহে যা যা মান আছে তার একটা তালিকা আসবে।
search.help.colon.how.1 = tag: author: colour: speaker: actor: character: director: genre: series: shelf:
search.help.colon.how.2 = year: favourite: note: wishlist: book: movie: — একসঙ্গে পাঁচটা দেখায়, বাকিগুলো “আরও”-তে।
search.help.colon.how.3 = একটা বাছলে সেটা নিচে চিপ হয়ে যায়, বাক্স আবার ফাঁকা লেখার জন্য।
search.help.colon.more = টাইপ করতে করতে তালিকা ছোট হয়, বানান ভুলও ধরে না। শুধু চিপ দিয়েও খোঁজা যায়। বাক্স ফাঁকা থাকলে Backspace চাপলে শেষ চিপটা সরে যায়।

# Escaping a colon with a backslash so the word stays plain text.
search.help.escaped-colon.term = শব্দটাই যখন বোঝাতে চান
search.help.escaped-colon.what = কোলনের আগে ব্যাকস্ল্যাশ দিন — note\\: to self — তাহলে সাধারণ লেখা হিসেবে খোঁজা হবে। শুধু ওই কোলনটাই এর আওতায়।

# Whether a second chip of one field narrows or widens.
search.help.two-chips.term = এক ঘরের দুটো চিপ
search.help.two-chips.what = দুটো ট্যাগে খোঁজ ছোট হয়: tag:stoicism tag:death দুটোই যার গায়ে, সেই উদ্ধৃতিগুলোই আনে।
search.help.two-chips.more = একটা উদ্ধৃতির একটাই রং, তাই দুটো রং মানে দুটোর যেকোনো একটা। তাক, সিরিজ, সাল বা নামের বেলাতেও তাই — দ্বিতীয়টা বাছা মানে “অথবা”।

# A colour chip carries the reader’s own name for the slot.
search.help.colour-names.term = রং, তার নিজের নামে
search.help.colour-names.what = রঙের চিপে আপনার দেওয়া নামটাই চলে — colour:doubt, colour:blue নয়।

# Searching from an already-filtered board.
search.help.arriving-narrowed.term = ছাঁকা অবস্থায় এসে পড়া
search.help.arriving-narrowed.what = ছাঁকা কোনো তাক থেকে খুঁজলে সেই তাকেই খোঁজে; তার ছাঁকনিগুলো চিপ হয়ে সঙ্গে আসে।
search.help.arriving-narrowed.more = প্রতিটা চিপ সরানো যায়, তাই ফল বাড়াতে এক ক্লিকই যথেষ্ট। ছাঁকনির প্যানেল আর এই চিপগুলো সবসময় মিলে থাকে।

# Right-clicking the search button to make every search global.
search.help.global-scope.term = কাচের গায়ে পৃথিবী
search.help.global-scope.what = খোঁজার বোতামে ডান-ক্লিক করলে প্রতিটা খোঁজ সবকিছুতে হয়; আতশকাচের ওপর ছোট একটা গ্লোব দেখায় যে চালু আছে।
search.help.global-scope.more = বন্ধ করতে আবার ডান-ক্লিক করুন। মেনুর “খোঁজ” সবসময় সবকিছুতেই খোঁজে।

# The row of chips that says where to look.
search.help.scope-chips.term = কোথায় খুঁজবে
search.help.scope-chips.what = কোথায় খুঁজবেন: সবকিছুতে, না শুধু বই, হাইলাইট, সিনেমা, সংলাপ বা উক্তিতে।

# The headings results are grouped under.
search.help.sections.term = বিভাগ
search.help.sections.what = কী মিলেছে সেই ধরে ফল সাজানো: বই, সিনেমা, মানুষ, চরিত্র, হাইলাইট, সংলাপ, নোট, ট্যাগ, ধরন।

# The results section that gathers one character’s lines.
search.help.characters.term = চরিত্র
search.help.characters.what = কোনো চরিত্রের লাইনগুলো তার নামের নিচে একসঙ্গে থাকে, সিনেমা ধরে ছড়িয়ে থাকে না।
search.help.characters.how.1 = নামে ট্যাপ করুন; খোঁজ ওই চরিত্রে নেমে আসে।
search.help.characters.more = সিনেমা, শো, গেম — সবেতেই চলে।

# Searching a decade or a capture date.
search.help.dates.term = তারিখ আর দশক
search.help.dates.what = একটা দশক ("1990s", "90s", "380s BCE") লিখলে সেই সময়ের বই-সিনেমা পাবেন; একটা তারিখ ("2026-07-14") লিখলে সেদিন যা রেখেছিলেন তা।

search.help.select.term = বাছুন
search.help.select.what = কয়েকটা ফলে টিক দিন, তারপর একসঙ্গে ট্যাগ দিন বা কোনও ঘর এডিট করুন।

# ---------------------------------------------------------------------------
# quotes.help.* — the "?" panel’s section for Quotes.
# ---------------------------------------------------------------------------

# Heading: aliases nav.tab.quotes.label, so the screen has ONE name. Nothing to add here.

# What the Quotes screen is for.
quotes.help.what-lives-here.term = এখানে কী থাকে
quotes.help.what-lives-here.what = যে কথা কোনো বই বা সিনেমার নয়: ভাষণ, চিঠি, সাক্ষাৎকার, গান, প্রবাদ, বন্ধুর বলা কোনো কথা।

quotes.help.boards.term = বোর্ড
quotes.help.boards.what = গ্রন্থাগার যেমন বইয়ের তালিকা দেখায়, এই পর্দা তেমনি বোর্ডের তালিকা দেখায় — পড়তে একটা খুলুন।
quotes.help.boards.more = যত খুশি বোর্ড বানান — নাম, রং, বিবরণ, ছবি সব নিজের মতো। শুরুর তিনটেও সাধারণ বোর্ড, নাম বদলানো বা মোছা যায়।

# The three boards New board offers to fill the form in from.
quotes.help.starters.term = তিনটের একটা থেকে শুরু
quotes.help.starters.what = “নতুন বোর্ড” প্রবাদ, ভাষণ আর অন্যান্য — এই তিনটে সামনে রাখে।
quotes.help.starters.more = একটা চাপলে ফর্ম ভরে যায় — নাম, রং আর ধরন — তৈরি করার আগে বদলে নিতে পারেন। একই নাম দুবার দেওয়া যায় না।

# The ordinary-or-proverbs setting on a board.
quotes.help.board-kind.term = কী থাকবে
quotes.help.board-kind.what = বোর্ডে থাকে সাধারণ উক্তি, নয়তো প্রবাদ।
quotes.help.board-kind.more = প্রবাদের বোর্ডে আগে থাকে ভাষা আর অনুবাদ।

# The language short-list a proverb board offers its quote form.
quotes.help.languages.term = প্রবাদের বোর্ডে ভাষা
quotes.help.languages.what = এই বোর্ডের উক্তির ফর্মে যে ভাষাগুলো বাছার জন্য থাকে, যাতে বারবার লিখতে না হয়। পরে বদলানো যায়।
quotes.help.languages.more = যেকোনো ভাষা চলে। ভাষা ধরে সাজালে বোর্ডটা ভাষা অনুযায়ী ভাগ হয়ে দেখায়; কিছু সরে না।

# The pinned row above the boards.
quotes.help.all-quotes.term = সব উক্তি
quotes.help.all-quotes.what = বোর্ডগুলোর ওপরে আটকানো: আপনার সব উক্তি, যে বোর্ডেই থাকুক।
quotes.help.all-quotes.more = এর নাম বদলানো, লুকানো বা মুছে ফেলা যায় না।

quotes.help.hide-board.term = বোর্ড লুকানো
quotes.help.hide-board.what = উক্তিগুলোয় হাত না দিয়েই বোর্ডটা তালিকা থেকে লুকোয় — সেগুলো “সব উক্তি”, খোঁজ আর কুইজে থেকে যায়।
quotes.help.hide-board.more = আপনি না লুকোলে বোর্ড লুকোয় না; ফাঁকা বোর্ডও দেখা যায়।

quotes.help.delete-board.term = বোর্ড মুছে ফেলা
quotes.help.delete-board.what = জিজ্ঞেস করে উক্তিগুলো কোথায় যাবে, আর আপনি না বলা পর্যন্ত এগোয় না।
quotes.help.delete-board.more = বোর্ড মুছলে তার উক্তি কখনো মোছে না; সেগুলো কোথায় যাবে আপনিই বাছেন। ফাঁকা বোর্ড জিজ্ঞেস না করেই মোছে। একমাত্র বোর্ডে উক্তি থাকলে সেটা মোছা যায় না।

quotes.help.occasion.term = উপলক্ষ
quotes.help.occasion.what = কথাগুলো কোথায় বলা হয়েছিল। একই কথা দুটো আলাদা উপলক্ষে বলা হলে সেগুলো দুটো আলাদা উক্তি।

quotes.help.speaker.term = বক্তা
quotes.help.speaker.what = কে বলেছেন। বইয়ের লেখকের জায়গায় থাকে, কুইজে এই নিয়েই প্রশ্ন আসে, আর ছবি ও পরিচিতিও রাখা যায়।
quotes.help.speaker.more = নাম-বিভাজক চিহ্ন দিয়ে আলাদা করা দুটো নাম মানে দুজন বক্তা।

# The partial-date field on a standalone quote.
quotes.help.when.term = কবে
quotes.help.when.what = আংশিক তারিখ — শুধু সাল দিলেই চলে।

# Saving a quote with nobody to credit.
quotes.help.no-attribution.term = নাম ছাড়া উক্তি
quotes.help.no-attribution.what = রাখতে কোনো অসুবিধা নেই; শুধু কুইজে আসে না, কারণ মনে করার মতো কিছু থাকে না।

# The name under a line, which opens the person.
quotes.help.speaker-credit.term = বক্তার নাম
quotes.help.speaker-credit.what = লাইনের নিচের নামে চাপলে সেই মানুষটার পাতা খোলে, পাশে তাঁর ছবি।
quotes.help.speaker-credit.more = দুজনের নামে থাকা বাক্যে দুটো মুখ আর দুটো দরজা।

quotes.help.copy.term = কপি
quotes.help.copy.what = উক্তি আর বক্তার নাম সাধারণ লেখা হিসেবে কপি হয়, কোনো সাজসজ্জা ছাড়া।
quotes.help.copy.more = শেয়ারের সাধারণ-লেখা ধাঁচে যা লেখা হয় তা-ই, রাখার তারিখ বাদে।

quotes.help.share.term = শেয়ার
quotes.help.share.what = উক্তির ছবি দিয়ে খোলে; চাইলে কথাগুলো Markdown, WhatsApp, সাধারণ লেখা বা Reddit-এর ধাঁচে শেয়ার করুন।
quotes.help.share.more = ছবিতে কিনারা থেকে আবছা হয়ে ঢোকা বক্তার ছবি থাকতে পারে, উক্তির রঙে রাঙানো। দুজন বক্তা থাকলে দুজন দুই পাশে।

quotes.help.filters.term = ফিল্টার
quotes.help.filters.what = রং, প্রিয়, ট্যাগ আছে, নোট আছে — তারপর ট্যাগ, বক্তা, ধরন বা ভাষা; আপনি যা রেখেছেন তা থেকেই তৈরি।
quotes.help.filters.more = ফোনে গোটা স্ক্রিন জোড়া প্যানেলে খোলে, সঙ্গে চলতি ফলের সংখ্যা।

quotes.help.group-by.term = ভাগ
quotes.help.group-by.what = বক্তা, ধরন, জায়গা বা দশক ধরে বোর্ড ভাগে ভাগে দেখুন।
quotes.help.group-by.more = যে উক্তিতে ঘরটা ফাঁকা, সেগুলো একটা আলাদা দলে যায় — কী নেই সেই নামে।

quotes.help.export.term = এক্সপোর্ট
quotes.help.export.what = পর্দায় থাকা উক্তিগুলো Markdown-এ রপ্তানি হয়, আবার ঠিকঠাক আমদানিও করা যায়। আগে কটা যাবে তা জানিয়ে নিশ্চিত করে।

# ---------------------------------------------------------------------------
# anthologies.help.* — the "?" panel’s section for Anthologies.
# ---------------------------------------------------------------------------

# Heading: aliases nav.tab.anthologies.label, so the screen has ONE name. Nothing to add here.

# What an anthology is for.
anthologies.help.what-lives-here.term = এখানে কী থাকে
anthologies.help.what-lives-here.what = আপনার পছন্দের ক্রমে সাজানো উদ্ধৃতি, মাঝে মাঝে আপনার নিজের কথা — একটা লেখা, কোনো তাক নয়।
anthologies.help.what-lives-here.more = বইয়ের হাইলাইট, সিনেমার সংলাপ আর উক্তি পাশাপাশি থাকে। একটা লাইন যত খুশি সংকলনে থাকতে পারে।

# How an anthology differs from a board and from a tag.
anthologies.help.not-a-board.term = বোর্ডও নয়, ট্যাগও নয়
anthologies.help.not-a-board.what = বোর্ড হলো উদ্ধৃতি কোথায় রাখা, ট্যাগ হলো সেটা কী নিয়ে। সংকলন হলো আপনার বাছা একটা ক্রম, আর একটা উদ্ধৃতি অনেক সংকলনে থাকতে পারে।

anthologies.help.new.term = নতুন সংকলন
anthologies.help.new.what = একটা নাম আর একটা ভূমিকা। দুটো সংকলনের নাম একই হতে পারে।
anthologies.help.new.more = ভূমিকায় লিখুন কেন এই লাইনগুলো, আর কেন এই ক্রমে। অনুচ্ছেদের মাঝের ফাঁকা লাইন থেকে যায়।

# How quotes get in — from another screen’s selection bar.
anthologies.help.adding.term = উদ্ধৃতি যোগ করা
anthologies.help.adding.what = বই, সিনেমা বা উক্তি বেছে নিয়ে বাছাইয়ের বার থেকে “সংকলনে দিন” চাপুন। কোনও বই বা সিনেমা বাছলে তার উদ্ধৃতিগুলো যোগ হয়।
anthologies.help.adding.more = শেষে, একই ক্রমে যোগ হয়। আগে থেকে থাকা উদ্ধৃতি বাদ যায়, আর বার্তায় জানায় কটা যোগ হলো।

# The paragraph the reader writes above one gathered quote.
anthologies.help.entry-note.term = এন্ট্রিতে আপনার নোট
anthologies.help.entry-note.what = একটা অংশের আগে তার ভূমিকার অনুচ্ছেদ, উদ্ধৃতির ওপরে দেখায়।
anthologies.help.entry-note.more = প্রতিটা নোট আলাদা করে সেভ হয়; সরাতে বাক্সটা ফাঁকা করুন। উদ্ধৃতির নিজের নোট থেকে এটা আলাদা।

# The Move up / Move down pair in an entry’s ⋯ menu.
anthologies.help.reorder.term = উপরে তুলুন / নিচে নামান
anthologies.help.reorder.what = কোনো অংশের ⋯ মেনু থেকে সেটা ওপরে বা নিচে সরান।
anthologies.help.reorder.more = কিবোর্ডেও চলে, ফোনেও। শেষ অংশে “নিচে নামান” থাকে না।

# Taking one passage out of this anthology.
anthologies.help.remove.term = সরান
anthologies.help.remove.what = অংশটা আর তার ওপর আপনার নোট এই সংকলন থেকে সরে যায়। উদ্ধৃতিটা যেমন ছিল থাকে।

anthologies.help.delete.term = সংকলন মুছে ফেলা
anthologies.help.delete.what = ভূমিকা আর সব অংশের নোট মুছে যায়। উদ্ধৃতিগুলো নিজেদের জায়গাতেই থাকে।
anthologies.help.delete.more = এটা বিনে যায় না, তাই আগে জিজ্ঞেস করে। হারায় শুধু আপনার লেখা, উদ্ধৃতি কখনো নয়।

anthologies.help.export.term = এক্সপোর্ট
anthologies.help.export.what = পুরো সংকলন Markdown বা EPUB হিসেবে: আগে ভূমিকা, তারপর প্রতিটা অংশ — ওপরে আপনার নোট, নিচে উৎসের নাম।

# Turning the whole section off in Settings → Features.
anthologies.help.feature-switch.term = বন্ধ করে দেওয়া
anthologies.help.feature-switch.what = সেটিংস → বিভাগ। শুরুতে বন্ধ থাকে।
anthologies.help.feature-switch.more = বন্ধ করলে শুধু ট্যাবটা সরে যায়। সংকলনগুলো থাকে, লিংক দিয়ে খোলাও যায়, আর আবার চালু করলে সব ফিরে আসে।

# ---------------------------------------------------------------------------
# tags.help.* — the "?" panel’s section for Tags & stickers.
# ---------------------------------------------------------------------------

# The help panel’s heading on the Tags screen. Longer than the tab’s own word, which is just “Tags”.
tags.help.title = ট্যাগ আর স্টিকার

tags.help.tags.term = ট্যাগ
tags.help.tags.what = বই হোক বা সিনেমা, একই ট্যাগ দুটোতেই চলে। এখানে একটার নাম বদলালে প্রতিটা উদ্ধৃতিতেই বদলে যায়।

# How a tag draws on a quote card: sticker, banner, flyout, tape or reel.
tags.help.style.term = ট্যাগের স্টাইল
tags.help.style.what = স্টিকার, ব্যানার, নিশান, টেপ বা রিল — উদ্ধৃতির কার্ডে ট্যাগটা কীভাবে আঁকা হবে।

tags.help.stickers.term = স্টিকার
tags.help.stickers.what = শুরুতে একটা হার্ট, একটা তারা আর তিনটে মুখ — আর আপনার আপলোড করা যে কোনও স্বচ্ছ PNG বা SVG।
tags.help.stickers.more = উদ্ধৃতিতে একটা সেঁটে টেনে জায়গামতো বসান; লেখা তার চারপাশ দিয়ে বইবে। অ্যাপের সঙ্গে আসা স্টিকারগুলোও অন্যগুলোর মতোই নাম বদলানো বা মোছা যায়।

# ---------------------------------------------------------------------------
# metadata.help.* — the "?" panel’s section for Metadata.
# ---------------------------------------------------------------------------

# Heading: aliases nav.tab.metadata.label, so the screen has ONE name. Nothing to add here.

# The tiles counting what each field is missing.

metadata.help.fetch.term = কভার আর মেটাডেটা আনুন
metadata.help.fetch.what = পুরো সংগ্রহে যা নেই তা ভরে — কভার, পোস্টার, লেখক, বিবরণ, সাল, ধরন। যা আছে তা কখনো বদলায় না।

metadata.help.reverify.term = আবার মিলিয়ে দেখুন
metadata.help.reverify.what = উৎসের সঙ্গে জোড়া বই-সিনেমা আবার মিলিয়ে দেখে, আর প্রতিটা প্রস্তাবিত বদল বসানোর আগে দেখায়।

metadata.help.duplicates.term = ডুপ্লিকেট
metadata.help.duplicates.what = প্রায় একই রকম বই-সিনেমা খুঁজে এক করে, উদ্ধৃতিগুলো যেটা রাখছেন তাতে সরিয়ে দেয়।

# The tool that remaps a character label across a title’s dialogue.
metadata.help.speakers.term = বক্তা
metadata.help.speakers.what = একটা সিনেমার সব সংলাপে বক্তার নামকে অভিনেতাদের তালিকার কারও সঙ্গে জোড়ে, আর অভিনেতার নামও বসিয়ে দিতে পারে।

metadata.help.people.term = মানুষ
metadata.help.people.what = লেখক, অভিনেতা, পরিচালক, স্টুডিও আর প্রকাশক — উৎস থেকে আনা ছবি আর তথ্যসূত্রের লিংকসহ।

metadata.help.bulk-edit.term = একসঙ্গে এডিট
metadata.help.bulk-edit.what = বাছা প্রতিটা সারিতে একসঙ্গে একটা লেখক, সিরিজ বা কয়েকটা ঘরানা বসিয়ে দেয়।

# ---------------------------------------------------------------------------
# stats.help.* — the "?" panel’s section for Stats.
# ---------------------------------------------------------------------------

# Heading: aliases nav.tab.stats.label, so the screen has ONE name. Nothing to add here.

stats.help.calendar.term = ক্যালেন্ডার
stats.help.calendar.what = যেদিন কিছু তুলে রেখেছেন সেদিনে একটা ডট। একটা দিনে ট্যাপ করলে সেদিনের তোলা জিনিসগুলোই খোঁজে খুলে যায়।
stats.help.calendar.more = অনুশীলনী বা ঝালাইয়ে বদলালে উত্তর গোনে — প্রতিটা দিনে কটা উত্তর দিয়েছেন আর কটা ঠিক, দুটোই দেখায়। ঝালাইয়ের স্কোর রিসেট করলে সেই হিসেব মুছে যায়।

stats.help.memory.term = স্মৃতি
stats.help.memory.what = অনুশীলনী থেকে: কটা উদ্ধৃতি মনে আছে, কটা ভুলছেন, কটা সম্ভবত ভুলে গেছেন, আর টানা কদিন চলছে।

# The most-quoted lists: authors, speakers, actors, directors, tags.
stats.help.breakdowns.term = কে কত
stats.help.breakdowns.what = গ্রন্থাগার যাঁদের উপর ভর করে — লেখক, বক্তা, অভিনেতা, পরিচালক আর ট্যাগ — সঙ্গে মানুষ: যে যত ভূমিকায় থাকুন, এক জনের এক সারি।
stats.help.breakdowns.more = প্রতিটাই একটা দরজা — ট্যাপ করলে উৎসগুলোয় পৌঁছে যাবেন।

# When the works are FROM, by decade, century or year.
stats.help.timeline.term = সময়রেখা
stats.help.timeline.what = উৎসগুলো কোন সময়ের, আপনি কবে তুলে রেখেছিলেন তা নয়।
stats.help.timeline.more = দশক, শতক বা সাল ধরে দেখুন।

stats.help.superlatives.term = সবচেয়ে
stats.help.superlatives.what = সবচেয়ে বেশি উদ্ধৃতি তোলা বই, সবচেয়ে বেশি সংলাপ তোলা সিনেমা, যাঁর কথা সবচেয়ে বেশি রাখেন, সবচেয়ে ব্যস্ত মাস, আর যিনি বারবার হাত ফসকান।

# The header totals, one per kind of quote.
stats.help.counts.term = সংখ্যা
stats.help.counts.what = তিন রকম আলাদা করে গোনা: বইয়ের উদ্ধৃতি, সিনেমা আর শোয়ের সংলাপ, আর কোনও উৎসেরই নয় এমন উক্তি।
stats.help.counts.more = উপরের মোট সংখ্যাটা এই তিনটে যোগ করলে যা হয়।

# ---------------------------------------------------------------------------
# staging.help.* — the "?" panel’s section for Pending import.
# ---------------------------------------------------------------------------

# The help panel’s heading on the import staging screen.
staging.help.title = যাচাই বাকি ইমপোর্ট

# Why an import waits here instead of landing in the library.
staging.help.why.term = যাচাই ছাড়া কিছু ঢোকে না
staging.help.why.what = গ্রন্থাগারে কিছু পৌঁছনোর আগে ইমপোর্ট এখানে আপনার অনুমোদনের অপেক্ষায় থাকে।

staging.help.bulk-fix.term = একসঙ্গে ঠিক করুন
staging.help.bulk-fix.what = অনেক সারিতে একসঙ্গে অধ্যায় আর লোকেশন শুধরে নিন, বা উদ্ধৃতিগুলো ঠিক বই বা সিনেমার নিচে সরিয়ে দিন।

# The Approve / discard pair.
staging.help.approve.term = মেনে নিন / ফেলে দিন
staging.help.approve.what = মেনে নিলে উদ্ধৃতিগুলো গ্রন্থাগারে ঢুকে যায়; ফেলে দিলে যায় না। একই ফাইল আবার ইমপোর্ট করলে কিছু দুবার হয় না।

# ---------------------------------------------------------------------------
# bin.help.* — the "?" panel’s section for The bin.
# ---------------------------------------------------------------------------

# The help panel’s heading on the bin screen.
bin.help.title = ডাস্টবিন

# What waits in the bin.
bin.help.what-is-here.term = এখানে কী আছে
bin.help.what-is-here.what = যা মোছেন সব আগে এখানে এসে থাকে — উদ্ধৃতিসহ বই, সংলাপসহ সিনেমা, বা একটা হাইলাইট।
bin.help.what-is-here.more = মুছে ফেলা অ্যাকাউন্টও পুরোটা থাকে, যে অ্যাডমিন মুছেছেন তাঁর বিনে।

# How the bin is reached — the Settings tile, and nothing else.

# What one row of the bin tells you.
bin.help.row.term = একটা সারি
bin.help.row.what = জিনিসটা কী ছিল, তার নাম, কবে মোছা হয়েছে, কটা উদ্ধৃতি সঙ্গে গেছে, ছবিটা রাখা আছে কি না, আর কবে চিরতরে মুছে যাবে।
bin.help.row.more = ভেতরের লাইনগুলো পড়তে সারিটা খুলুন। এখানে শুধু ফিরিয়ে আনা বা চিরতরে মোছা যায়।

bin.help.restore.term = ফিরিয়ে আনুন
bin.help.restore.what = গোটা এন্ট্রিটা একবারেই ফিরিয়ে দেয়, ঠিক আগের মতো — উদ্ধৃতি, ট্যাগ, রং, সময়সূচি, কভার সব।

# Throwing one entry away now, with no undo.
bin.help.purge.term = চিরতরে মুছুন
bin.help.purge.what = সেই জিনিসটা আর তার ছবি এখনই চিরতরে মুছে দেয়। আর ফেরানো যায় না।

# The chips that show one kind of deleted thing at a time.
bin.help.kinds.term = ধরন
bin.help.kinds.what = বিনে একাধিক ধরনের জিনিস থাকলে চিপ দিয়ে এক এক ধরন আলাদা করে দেখা যায়।

# How long a deleted thing waits before it goes for good.
bin.help.keep-for.term = কতদিন রাখবে
bin.help.keep-for.what = 7, 30 বা 90 দিন, নয়তো নিজে খালি না করা পর্যন্ত।
bin.help.keep-for.more = সার্ভার চালু থাকলে তবেই সময় গোনা চলে, তাই প্রতিটা সারিতে কদিন বাকি না লিখে কবে মুছবে সেই তারিখ লেখা থাকে। “খালি না করা পর্যন্ত” বাছলে আপনি নিজে বিন খালি না করলে কিছুই মোছে না।

# Emptying the whole bin.
bin.help.empty-now.term = এখনই খালি করুন
bin.help.empty-now.what = সব জিনিস আর তাদের ছবি মুছে দেয়। আগে জিজ্ঞেস করে, আর ফেরানো যায় না।

# ---------------------------------------------------------------------------
# cleanup.help.* — the "?" panel’s section for Stray marks.
# ---------------------------------------------------------------------------

# The help panel’s heading on the stray-marks screen.
cleanup.help.title = বাড়তি চিহ্ন
# What the page is for.
checks.help.what-is-here.term = এখানে কী আছে
checks.help.what-is-here.what = আপনার দেখা বাকি দুটো তালিকা, এক স্ক্রিনে: ফাইল থেকে ইমপোর্ট করা উদ্ধৃতি, আর যেগুলোয় কিছু একটা খটকা লাগছে।
checks.help.what-is-here.more = সাইডবার আর ☰ মেনুর সংখ্যা জানিয়ে দেয় কিছু অপেক্ষায় আছে কি না; সেগুলো সামলানো হয় এই স্ক্রিনে।
checks.help.imports.term = ইমপোর্ট যাচাই করা বাকি
checks.help.imports.what = ইমপোর্ট করা কিছুই সোজা গ্রন্থাগারে যায় না। এখানে এসে নামে, আর আপনি মেনে না নেওয়া পর্যন্ত যত দিন খুশি বসে থাকে।
checks.help.imports.more = গোটা ব্যাচ, একটা উৎস বা এক-একটা সারি মেনে নিন — তার আগে যা খুশি এডিট করুন।
checks.help.marks.term = চিহ্ন দেখে নিন
checks.help.marks.what = যে উদ্ধৃতিতে লেখকের নয়, পাতার নিজের কিছু রয়ে গেছে — পাদটীকার নম্বর, সফট হাইফেন, জোড়া স্পেস।
checks.help.marks.more = কার্ডে এগুলো দেখা যায় না, কিন্তু খোঁজের ইনডেক্সে থেকে যায় — তাই চোখের সামনের কথাও খুঁজে না পাওয়া যেতে পারে। এখানকার সারি শুধু উৎসটা খোলে, উদ্ধৃতি এডিট করবেন সেখানে।

# What the page is for.
cleanup.help.what-is-here.term = এখানে কী আছে
cleanup.help.what-is-here.what = প্রতিটা উদ্ধৃতি একবার পড়ে দেখা, কোনটা লেখকের নয় বরং পাতা থেকে এসে পড়েছে বলে মনে হয়।
cleanup.help.what-is-here.more = ই-বুক, PDF বা ওয়েব পাতা থেকে কপি করা লেখায় পাদটীকার চিহ্ন, উচ্চারণের নির্দেশ, দুবার ফাঁকা বা লুকোনো হাইফেন চলে আসতে পারে। কার্ডে এগুলো দেখা যায় না, কিন্তু খোঁজে প্রভাব ফেলে — তাই চোখের সামনে থাকা বাক্যাংশও কখনো খুঁজে পাওয়া যায় না।

# The one thing it deliberately does not do.

# How the page is reached.

# A row, and the marked snippet in it.
cleanup.help.row.term = একটা সারি
cleanup.help.row.what = কী পাওয়া গেছে, কোথায়, কতবার, আর আশেপাশের কথাসহ ধরা পড়া অংশটা চিহ্নিত করে।
cleanup.help.row.more = ধরা পড়া অংশ »এভাবে« চিহ্নিত থাকে, তাতে অদৃশ্য অক্ষরও দেখা যায়। উদ্ধৃতি বদলাতে সারির বই-সিনেমাটা খুলুন।

# The rule filter.
cleanup.help.filter.term = ফিল্টার
cleanup.help.filter.what = যে নিয়মে কিছু ধরা পড়েছে তার জন্য একটা করে চিপ, যাতে এক এক ধরন ধরে এগোতে পারেন।

# Names, and why they are left out.
cleanup.help.names.term = যা পড়া হয় না
cleanup.help.names.what = নাম নয়, গদ্যই — উদ্ধৃতি, নোট, একলা উক্তির অনুবাদ।
cleanup.help.names.more = চরিত্র, অভিনেতা আর বক্তার নাম বাদ থাকে: “R2-D2” নিয়মের চোখে পাদটীকার মতো দেখায়, কিন্তু ভুল নয়।

# The cap.
cleanup.help.cap.term = লম্বা তালিকা
cleanup.help.cap.what = একসঙ্গে সর্বোচ্চ পাঁচশোটা উদ্ধৃতি দেখায়; আগেভাগে থামলে পাতায় সেটা জানিয়ে দেয়।
cleanup.help.cap.more = কয়েকটা ঠিক করে বাকিগুলোর জন্য আবার দেখুন।

# ---------------------------------------------------------------------------
# settings.help.* — the "?" panel’s section for Settings.
# ---------------------------------------------------------------------------

# Heading: aliases nav.tab.settings.label, so the screen has ONE name. Nothing to add here.

# The names of the six highlight colours.
metadata.help.colour-categories.term = রঙের ঘর
metadata.help.colour-categories.what = হাইলাইটের রংগুলোর নাম। যেকোনোটার নাম বদলানো যায়।
metadata.help.colour-categories.more = নাম বদলালে শুধু দেখানো নামটাই বদলায়; ভেতরের রং একই থাকে, তাই রপ্তানি-আমদানিতে তফাত হয় না। কোনো রং লুকোলে বাছার তালিকা থেকে সরে যায়, কিন্তু যেসব উদ্ধৃতিতে সেটা আছে সেগুলোতে হাত পড়ে না।

settings.help.appearance.term = চেহারা
settings.help.appearance.what = হালকা না গাঢ়, রং, উপাদান-সেট, কাচ আর কভারের মাপ। প্রত্যেক ব্যবহারকারীর নিজের নিজের।
settings.help.appearance.more = আপনার সিস্টেমে বেশি কনট্রাস্ট বা কম স্বচ্ছতা চাওয়া থাকলে Tippani সব জমিন সরিয়ে দেয়, রং আর বিন্যাস যেমন ছিল রাখে।

# Whether a control with a glyph also shows its words.
settings.help.button-labels.term = বোতামের লেখা
settings.help.button-labels.what = আইকনওয়ালা বোতামে লেখাও দেখাবে কি না। অটো হলে ডেস্কটপে দেখায়, ফোনে লুকায়।
settings.help.button-labels.more = বোতামের সঙ্গে ফিল্টার চিপেও খাটে। লুকোনো লেখা স্ক্রিন রিডার তবু পড়ে, আর মাউস রাখলে বা চেপে ধরলে প্রতিটা আইকন নিজের নাম বলে। মূল কাজের বোতাম আর মোছার নিশ্চিতকরণে লেখা সবসময় থাকে।

# Which sections of the app are switched on.
settings.help.features.term = বিভাগ
settings.help.features.what = অ্যাপের কোন বিভাগগুলো চোখের সামনে চান — গ্রন্থাগার, ক্যাটালগ, উক্তি।
settings.help.features.more = কোনোটা বন্ধ করলে তার ট্যাব, হোমের টাইল, খোঁজার ফিল্টার আর ＋-এর বিকল্প সরে যায়। কিছু মোছে না: বই, সিনেমা, উদ্ধৃতি সব থাকে, কুইজেও আসে, আর লিংক দিয়ে খোলাও যায়।

# The guided tour card.


metadata.help.metadata-sources.term = মেটাডেটার সূত্র
metadata.help.metadata-sources.what = খোঁজ যে API চাবিগুলোর উপর চলে।
metadata.help.metadata-sources.more = প্রতিটা কী আলাদা করে সেভ হয়। রাখা কী আর কখনো দেখানো হয় না; মুছতে ঘরটা ফাঁকা রেখে সেভ করুন।

# The two IGDB fields, which only work as a pair.
metadata.help.igdb.term = IGDB client id আর secret
metadata.help.igdb.what = গেমের জন্য দুটো চাবি। IGDB-তে Twitch দিয়ে ঢুকতে হয়, তাই দুটোই লাগে।
metadata.help.igdb.more = dev.twitch.tv/console-এ একটা অ্যাপ রেজিস্টার করে client ID নিন, তারপর “New Secret” চেপে অন্য অংশটা। গেমের জন্য অ্যাপের ভেতরে কোনো কী নেই।

# The typography section — the faces the app draws with, not a media type.
settings.help.type.term = ফন্ট
settings.help.type.what = অ্যাপ যত ফন্ট ব্যবহার করে, প্রতিটা নিজের কাজ করে দেখায়।
settings.help.type.more = প্রতিটার দুটো বিকল্প অ্যাপের সঙ্গেই আছে — কিছু ডাউনলোড হয় না। বোল্ড, ইটালিক, স্মল ক্যাপস, বড় হাতের অক্ষর আর সংখ্যার ধাঁচ প্রতিটা ফন্টের আলাদা।

# The mark a proverb card leads with in place of a face.
metadata.help.language-marks.term = ভাষার চিহ্ন
metadata.help.language-marks.what = প্রবাদে কারও নাম থাকে না, তাই তার কার্ডে মুখের বদলে ভাষার চিহ্ন দেখায়।
metadata.help.language-marks.more = শুরুতে থাকে ভাষাটার নিজের লিপির একটা অক্ষর। পতাকাও বাছা যায়, তবে নিজে থেকে বসে না — ভাষা আর দেশ এক জিনিস নয়। টাইপ করা যায় এমন যেকোনো কিছুই চিহ্ন হতে পারে।

settings.help.upload-font.term = ফন্ট আপলোড
settings.help.upload-font.what = অ্যাপের ফন্টগুলোর পাশে নিজের ফন্ট যোগ করুন। এটা আপনার সার্ভারে থাকে, আর শুধু ব্রাউজারই পড়ে।
settings.help.upload-font.more = ফন্টটা ওই সারির লিপি লিখতে পারে কি না Tippani দেখে নেয়, না পারলে সতর্ক করে — নইলে সেই লিপির উদ্ধৃতি চৌকো ঘর হয়ে যায়। এটা শুধু সতর্কবার্তা; ফন্ট তবু বসে।

settings.help.review.term = অনুশীলন
settings.help.review.what = দিনে কটা কার্ড, কোন ধরনের উদ্ধৃতি থেকে প্রশ্ন, আর প্রশ্ন ও সময়সূচি কীভাবে চলবে।
settings.help.review.more = তিন ধরনের উদ্ধৃতি আলাদা আলাদা করে বাছা যায়। বক্তা বা প্রসঙ্গহীন উদ্ধৃতি, আর গত এক সপ্তাহে রাখা উদ্ধৃতি সবসময় বাদ থাকে।

# The folded second half of the Review card.
settings.help.in-depth.term = কুইজ আর তার প্রশ্ন
settings.help.in-depth.what = প্রতিটা কুইজে কোন কোন প্রশ্ন আসবে, সঙ্গে অ্যাডাপ্টিভ ফাঁক, উত্তর নিশ্চিত করার ধাপ, আর কোনো উদ্ধৃতি চোখে পড়লে কতটা গোনা হবে।
settings.help.in-depth.more = “আগের মতো করুন” চাপলে সবগুলোই ফিরে যায়। কোনো ডেক একেবারে প্রশ্নহীন হতে পারে না।

# Which characters split one author line into two people.
metadata.help.credit-separators.term = একাধিক লেখকের নাম
metadata.help.credit-separators.what = কোন চিহ্ন দেখে “Gaiman & Pratchett” দুজন আলাদা মানুষ হবে।
metadata.help.credit-separators.more = বইয়ে লেখা নাম কখনো বদলায় না, তাই যখন খুশি এটা বদলানো যায়।


# The Settings tile that opens the bin.

settings.help.backup.term = ব্যাকআপ আর ফিরিয়ে আনা
settings.help.backup.what = শুধু অ্যাডমিন: সবকিছুর একটা তারিখ-দেওয়া, এনক্রিপ্ট করা আর্কাইভ — এখানেই ফেরানো যায়, অন্য Tippani-তেও।
settings.help.backup.more = যে সার্ভারে তৈরি, সেখানে আপনার এখনকার পাসওয়ার্ডেই খোলে। অন্য কোথাও লাগে তৈরির সময়ের পাসওয়ার্ড। পাসফ্রেজ দেওয়া আর্কাইভ পাসফ্রেজ ছাড়া কোনোভাবেই খোলা যায় না।

# The button that makes the archive.
settings.help.backup-now.term = এখনই ব্যাকআপ নিন
settings.help.backup-now.what = আর্কাইভটা বানিয়ে এখানেই, সার্ভারেই রেখে দেয় — যখন দরকার, ফিরিয়ে আনার জন্য তৈরি।
settings.help.backup-now.more = চাইলে নিশ্চিতকরণ বার্তা থেকেই ডাউনলোড করা যায়।

# The link that hands over the archive already on the server.
settings.help.backup-download.term = শেষটা ডাউনলোড করুন
settings.help.backup-download.what = সার্ভারে রাখা আর্কাইভটা ডাউনলোড করে। এটা সাধারণ লিংক, তাই “Save link as”-ও চলে।
settings.help.backup-download.more = সবচেয়ে নতুন আর্কাইভটাই শুধু রাখা হয় — নতুন ব্যাকআপ নিলে সেটা আগেরটার জায়গা নেয়।

settings.help.changelog.term = কী বদলেছে
settings.help.changelog.what = প্রতিটা রিলিজের কথা, নতুনটা আগে — অ্যাপের ভেতরেই আছে, তাই ইন্টারনেট ছাড়াও দেখা যায়।
settings.help.changelog.more = শুধু নতুনটা খোলা থাকে; বাকিগুলো ভাঁজ করা। আপনি যেটা চালাচ্ছেন সেটা চিহ্নিত করা থাকে। আপনার চেয়ে নতুন সংস্করণের জন্য নম্বরটায় চাপলে রিলিজের পাতা খোলে।

settings.help.updates.term = আপডেট
settings.help.updates.what = শুধু অ্যাডমিনের জন্য, চাইলে তখনই দেখে নেয় — পিছনে চুপিচুপি কখনও নয়।

# ---------------------------------------------------------------------------
# profile.help.* — the "?" panel’s section for Profile.
# ---------------------------------------------------------------------------

# The help panel’s heading on the profile panel.
profile.help.title = প্রোফাইল

profile.help.photo.term = ছবি
profile.help.photo.what = উপরের বারে আপনার ছবিটা। চৌকো ছবি সবচেয়ে ভালো বসে।

profile.help.display-name.term = যে নাম দেখা যাবে
profile.help.display-name.what = শুভেচ্ছা আর ইউজার-তালিকা আপনাকে যে নামে ডাকবে।

profile.help.switch-account.term = অ্যাকাউন্ট বদলান
profile.help.switch-account.what = এই সার্ভারের অন্য কোনও ইউজার হয়ে লগ ইন করুন।
profile.help.switch-account.more = অ্যাডমিন হলেও প্রতিবার ওই অ্যাকাউন্টের পাসওয়ার্ড চায়, আর প্রতিটা অ্যাকাউন্টের গ্রন্থাগার আলাদা। ফর্মে লেখা থাকে কোন অ্যাকাউন্ট ছেড়ে যাচ্ছেন।

profile.help.log-out.term = লগ আউট
profile.help.log-out.what = শুধু এই ব্রাউজার থেকে লগ আউট হয়। অন্য ব্রাউজারে লগ ইন থেকে যায়।

profile.help.password.term = পাসওয়ার্ড
profile.help.password.what = 8–20টা অক্ষর — ইংরেজি বর্ণ, অঙ্ক আর যতিচিহ্ন; é-র মতো চিহ্নওয়ালা অক্ষর নয়।
profile.help.password.more = পাসওয়ার্ড দিয়েই ব্যাকআপ খোলে, তাই যেকোনো মেশিনে টাইপ করা যাওয়া চাই। বদলালে অন্য ব্রাউজার থেকে লগ আউট হয়, আর এই সার্ভারের বানানো সব আর্কাইভ এখনকার পাসওয়ার্ডেই খোলে।

# The admin-only user list, on the profile panel.
profile.help.users.term = এই সার্ভারের ইউজাররা
profile.help.users.what = শুধু অ্যাডমিনের জন্য: অ্যাকাউন্ট যোগ করুন, অ্যাডমিনের ভার দিন বা ফিরিয়ে নিন, বা একটা অ্যাকাউন্ট তার গোটা গ্রন্থাগার সমেত মুছে দিন।
profile.help.users.more = ভার হাতবদল করতে হলে আগে অন্য কাউকে অ্যাডমিন করুন, তারপর নিজেরটা ফিরিয়ে নিন।

# The admin-only rebuild-index and reset-instance pair.
profile.help.maintenance.term = দেখভাল
profile.help.maintenance.what = শুধু অ্যাডমিনের জন্য: খোঁজ কাজ না করলে ইনডেক্স আবার বানান, বা পুরো সার্ভার মুছে প্রথম দিনের অবস্থায় ফেরান।

# ---------------------------------------------------------------------------
# capture.help.* — the "?" panel’s section for Add & capture.
# ---------------------------------------------------------------------------

# The help panel’s heading on the ＋ surface.
capture.help.title = যোগ আর তুলে রাখা

# The ＋’s option for a line that belongs to no book and no film. Its term is the chip’s own lower-case wording.
capture.help.no-work.term = বই বা সিনেমা নয়
capture.help.no-work.what = বাক্যটা একাই সেভ হয় — অধ্যায়-পৃষ্ঠার বদলে কে বলেছেন আর কোন উপলক্ষে, তা নিয়ে। দেখা যাবে উক্তির স্ক্রিনে।

# The ＋’s book tab.
capture.help.book.term = বই
capture.help.book.what = নাম, লেখক বা ISBN দিয়ে খুঁজে নিন — কভার আর খুঁটিনাটি সঙ্গেই আসে। API চাবি থাক বা না থাক, হাতে যোগ করা সবসময় চলে।

# The ＋’s film-or-show tab.
capture.help.film.term = সিনেমা বা শো
capture.help.film.what = নাম আর সাল দিয়ে TMDB আর TheTVDB-তে খোঁজা হয় — বা খুঁটিনাটিতে লেখা নির্দিষ্ট TMDB/TheTVDB id দিয়ে।
capture.help.film.more = একটা মিল বাছলেই পোস্টার, কাস্ট আর খুঁটিনাটি চলে আসে।

# The ＋’s capture-a-quote tab.
capture.help.quote.term = উদ্ধৃতি তুলে রাখুন
capture.help.quote.what = যে স্ক্রিনে ছিলেন সেটা না ছেড়েই, আপনার কাছে থাকা যে কোনও উৎসের নামে একটা বাক্য।
capture.help.quote.more = বই বা সিনেমার পাতা থেকে খুললে উৎসটা আগেই বসানো থাকে।

# The ✓ in the form’s title bar.
capture.help.save.term = সেভ (✓)
capture.help.save.what = এটা উপরের বারে থাকে, তাই ফোনে নিচে না নেমেই হাত পাবেন।
capture.help.save.more = দরকারি ঘরগুলো ভরা না হওয়া পর্যন্ত ধূসর হয়ে থাকে, আর কোনটা বাকি সেটাও বলে দেয়।


# ---------------------------------------------------------------------------
# import.help.* — the "?" panel’s section for Import, which is a MODE of the ＋
# surface rather than a screen of its own. It was one row inside capture.help
# until the eight formats and their step-lists needed somewhere to live.
# ---------------------------------------------------------------------------

# The help panel’s heading on the ＋ surface’s import mode.
import.help.title = ইমপোর্ট

# The one upload well, which is also the drop target.
import.help.drop.term = আপলোডের ঘর
import.help.drop.what = ফাইল এখানে ছেড়ে দিন, বা চেপে বেছে নিন। যত খুশি দিন; প্রতিটা আলাদা করে পড়া হয়।

# That there is no format to choose: the server sniffs the bytes.
import.help.detect.term = ফরম্যাট নিজেই বুঝে নেয়
import.help.detect.what = ধাঁচ বাছার দরকার নেই; ভেতরের লেখা দেখেই প্রতিটা ফাইল চেনা যায়।
import.help.detect.more = ভুল চিনলে সারিতেই “এই ফরম্যাট হিসেবে পড়ুন…” আসে, অন্য ধাঁচ হিসেবে আবার পড়ার জন্য। সঙ্গে সঙ্গে করে নিন — ভুলভাবে পড়া ফাইল থেকে কিছুই জমা হয় না।

# Where everything lands, and the diagram under it.
import.help.pending.term = যাচাই বাকি ইমপোর্ট
import.help.pending.what = আপলোড করলেই কিছু গ্রন্থাগারে ঢোকে না। প্রতিটা লাইন “যাচাইকরণ”-এ থাকে, আপনার অনুমোদনের অপেক্ষায়।
import.help.pending.more = অপেক্ষায় থাকা লাইন বদলানো যায় — অধ্যায়, চরিত্র, সময় আর ভাষা। আমদানিকারী যা আন্দাজ করেছে তা ঠিক করার এটাই সবচেয়ে সহজ সময়।

# The accessible name of the little diagram in the Pending entry — a screen reader reads this instead of the three boxes.
import.help.flow.aria = ফাইল আগে যাচাই বাকি ইমপোর্টে যায়, আপনি মেনে নিলে তবেই গ্রন্থাগারে পৌঁছয়
# The three boxes of that diagram, in order, then the arrow between the last two. Each sits in a fixed 52-68px box in a mono face, so a long word will not fit — abbreviate rather than overflow.
import.help.flow.file.label = ফাইল
import.help.flow.pending.label = যাচাই
import.help.flow.library.label = গ্রন্থাগার
import.help.flow.approve.label = মেনে নিন

# The list under this row is drawn from the importer’s own table — the eight rows, their extensions and their steps are import.source.* below.
import.help.sources.term = ফাইলগুলো কোথায় পাবেন
import.help.sources.what = প্রতিটায় লেখা আছে কী সেভ করবেন আর কোথা থেকে। ফাইলের এক্সটেনশন শুধু একটা ইঙ্গিত, বাঁধা নিয়ম নয়।

# ---------------------------------------------------------------------------
# common.help.* — the shell’s own rows, appended to EVERY screen’s panel, and
# its heading in the whole-guide rail.
# ---------------------------------------------------------------------------

# The last section of the guide: the controls that are on every screen.
common.help.title = সবখানে

# --- On every screen, both shells ---

# The ＋ in the top bar.
common.help.topbar.add.term = যোগ করুন (＋)
common.help.topbar.add.what = আপনি যেখানে আছেন সেই বুঝে যোগ করে: গ্রন্থাগারে বই, ক্যাটালগে সিনেমা বা শো, কোনো বই-সিনেমা খোলা থাকলে উদ্ধৃতি।
common.help.topbar.add.more = খোঁজা, রাখা আর আমদানি একটাই প্যানেলের তিনটে ট্যাব, আর একটা ব্যাজ দেখায় কটা আমদানি অপেক্ষায়। পরেরটা রাখার সময় আগের রং আর ট্যাগ থেকে যায়, আধ ঘণ্টা পর্যন্ত একই বই-সিনেমাও; লেখাটা কখনো থেকে যায় না।

# The magnifier in the top bar.
common.help.topbar.search.term = খোঁজ
common.help.topbar.search.what = নাম, মানুষ, উদ্ধৃতি, নোট, ট্যাগ আর ধরন — সবেতে খোঁজে, বানান ভুল হলেও চলে। গ্রন্থাগার বা ক্যাটালগ থেকে খুঁজলে শুধু সেই দিকেই।

# The ? in the top bar — the button that opens this panel.
common.help.topbar.help.term = সাহায্য (?)
common.help.topbar.help.what = এই তালিকা: এখনকার পর্দার নিয়ন্ত্রণগুলো, সঙ্গে ওপরের বারেরগুলো।

# The avatar chip at the end of the top bar.
# bn: “Avatar” লোকে মুখে বলে না; চিপটা যা খোলে সেই নামেই — profile.help.photo.what-এর “উপরের বারে আপনার ছবিটা”-র সঙ্গে মিলিয়ে।
common.help.topbar.avatar.term = প্রোফাইল চিপ
common.help.topbar.avatar.what = আপনার প্রোফাইল খোলে: ছবি, নাম, পাসওয়ার্ড, অন্য অ্যাকাউন্টে যাওয়া আর লগ আউট — আর অ্যাডমিনের জন্য ব্যবহারকারী সামলানো ও উদ্ধারের সরঞ্জাম।

# Multi-select and the bar it opens.
common.help.selecting.term = একসঙ্গে কয়েকটা বাছা
common.help.selecting.what = একসঙ্গে অনেকগুলো কার্ডে কাজ করুন — উদ্ধৃতি, বই, সিনেমা, শো সবেতেই।
common.help.selecting.how.1 = কার্ডের কোণে টিক দিন, Ctrl চেপে ক্লিক করুন, বা তার নিজের মেনু থেকে “বাছুন”।
common.help.selecting.how.2 = Shift চেপে ক্লিক করলে মাঝের সবগুলো বাছা হয়। “সব বাছুন” শুধু পর্দায় যা আছে সেগুলোই নেয়।
common.help.selecting.how.3 = একটা বার আসে, তাতে তিনটে কাজ; বাকিগুলো ⋯-এর ভেতরে। কোনোটা চেপে ধরলে নাম দেখায়।
common.help.selecting.more = উদ্ধৃতির জন্য: রং, ♥ আর কুইজ বারেই; ট্যাগ, স্টিকার, অন্য বোর্ডে সরানো আর মোছা ⋯-এর ভেতরে। বই-সিনেমার জন্য: ফাঁক ভরা, তাকে সরানো, কুইজ, আর মোছা ⋯-এর ভেতরে। ঠিক একটা বাছলে “এডিট” আসে। মুছতে গেলে নিশ্চিত করতে বলে, আর সব একটাই জিনিস হিসেবে বিনে যায়, একবারেই ফেরানো যায়।

# Favouriting one quote from its own menu.
common.help.favourite.term = একটাকে প্রিয় করা
common.help.favourite.what = উদ্ধৃতিতে ডান-ক্লিক করুন (ফোনে চেপে ধরুন), “এডিট” আর “মুছুন”-এর পাশেই “প্রিয়” পাবেন।
common.help.favourite.more = কার্ডের ♥ একই কাজ করে, তবে মাউস রাখলে তবেই দেখায় — তাই ফোনে মেনু থেকেই করুন। আগে থেকে প্রিয় হলে লেখা থাকে “প্রিয় থেকে সরান”।

# The right-click menu on a book, film or show cover.
common.help.cover-menu.term = কভারের নিজের মেনু
common.help.cover-menu.what = কোনো বই, সিনেমা বা শো-তে ডান-ক্লিক করুন (ফোনে চেপে ধরুন): বাছুন, শূন্যস্থান পূরণ, কুইজ, এডিট আর মুছুন পাবেন।
common.help.cover-menu.more = বাছাইয়ের বারের কাজগুলোই, একটা জিনিসের জন্য। মোছার আগে জিজ্ঞেস করে, কটা উদ্ধৃতি সঙ্গে যাবে বলে দেয়, আর ফেরানোর সুযোগ থাকে।

# The selection-bar toggle that takes things out of the Daily Quiz.
common.help.skip-in-quiz.term = অনুশীলনী থেকে বাদ দিন
common.help.skip-in-quiz.what = যা রেখেছেন কিন্তু কুইজে চান না, তার জন্য — উদ্ধৃতি হিসেবে রাখা কোনো তালিকা, পাতার নম্বরে ভরা কোনো নির্দেশিকা।
common.help.skip-in-quiz.more = সেগুলো বেছে “অনুশীলনী থেকে বাদ দিন” চাপুন; কিছুই মোছে না। কোনো বইয়ে করলে পরে যোগ করা হাইলাইটও বাদ থাকে। আগে থেকে বাদ থাকলে বোতামে লেখা থাকে “অনুশীলনীতে দিন”।

# The selection-bar action that fetches only the EMPTY fields.
common.help.fill-gaps.term = শূন্যস্থান পূরণ
common.help.fill-gaps.what = বাছা বই, সিনেমা বা শো-এর জন্য: মেটাডেটা এনে শুধু ফাঁকা ঘরগুলো ভরে।
common.help.fill-gaps.more = আপনার ভরা কিছুতেই হাত পড়ে না, তাই আগে দেখানোর দরকার হয় না। সব তফাত মিলিয়ে দেখতে চাইলে মেটাডেটার “আবার মিলিয়ে দেখুন” ব্যবহার করুন।

# The circled i beside a control.
common.help.info-dots.term = ইনফো ডট
common.help.info-dots.what = কোনো নিয়ন্ত্রণের পাশের ছোট গোল “i” সেটার মানে বুঝিয়ে দেয়।
common.help.info-dots.more = ডেস্কটপে মাউস রাখলে খোলে, ক্লিক করলে খোলা থাকে। ফোনে ছুঁয়ে দিন।

# --- Phone only — the drawer, the bottom bar, the hold ---

# Tippani added to a phone’s home screen.
common.help.installed-app.term = ফোনে বসানো অ্যাপ
common.help.installed-app.what = Tippani হোম স্ক্রিনে যোগ করুন, তারপর আইকন চেপে ধরলে পাবেন উদ্ধৃতি রাখা, রোজকার কুইজ আর যাচাই বাকি ইমপোর্ট।
common.help.installed-app.more = কোনো .md, My Clippings.txt বা Bookcision .json ফাইল খুললে সোজা আমদানিতে চলে আসে। আইকনের ব্যাজ দেখায় কটা কার্ড বাকি আর কটা আমদানি অপেক্ষায় — অ্যাপ খুললে হালনাগাদ হয়।

# The ☰ drawer button, phone only.
common.help.topbar.menu.term = মেনু (☰)
common.help.topbar.menu.what = ড্রয়ার: সব স্ক্রিন, নিজের প্রোফাইল, আর যাচাই বাকি ইমপোর্টের তালিকা।
common.help.topbar.menu.more = এখানকার “যোগ” আর “খোঁজ” সবসময় ফাঁকা থেকে শুরু হয়, আপনি যে পাতা থেকেই আসুন। বন্ধ করতে বাঁদিকে সরান বা বাইরে ছুঁয়ে দিন।

# The floating phone nav.
common.help.bottom-bar.term = নিচের বার
common.help.bottom-bar.what = মূল পর্দাগুলো, বুড়ো আঙুলের নাগালে — সেটিংসে যেগুলো চালু রেখেছেন।
common.help.bottom-bar.more = খোঁজ থাকে ওপরের বারে। নিচে স্ক্রল করলে বারটা লুকোয়, ওপরে স্ক্রল করলে ফিরে আসে।

# What holding a finger down does.
common.help.long-press.term = চেপে ধরা
common.help.long-press.what = কী হবে, তা নির্ভর করে আঙুলের নিচে কী আছে তার উপর।
common.help.long-press.more = তাকের কার্ডে চেপে ধরলে কার্ডটা বাছা হয়; যেখানে বাছার কিছু নেই, সেখানে কার্ডের মেনু খোলে। কোনো বোতামে চেপে ধরলে না চেপেই তার নাম দেখায়। উদ্ধৃতির লেখায় চেপে ধরলে ফোনে লেখা বাছা যায়।

# --- Pointer devices only — the tab strip, hover, the keyboard ---

# The shortcuts, and the sheet ? opens.
common.help.keyboard.term = কীবোর্ড
common.help.keyboard.what = পুরো তালিকার জন্য ? চাপুন। / চাপলে খোঁজ, N চাপলে উদ্ধৃতি রাখা, আর G-এর পর H, L, C, Q বা S চাপলে যথাক্রমে হোম, গ্রন্থাগার, ক্যাটালগ, উদ্ধৃতি বা পরিসংখ্যান।
common.help.keyboard.more = কুইজে 1 আর 2 দিয়ে নম্বর, আর Space দিয়ে ফ্লিপ কার্ড ওল্টানো। প্রতিটা শর্টকাট তার বোতামেও লেখা থাকে।

# The always-visible desktop tab strip that stands in for the drawer.
common.help.tab-strip.term = ট্যাব-সারি
common.help.tab-strip.what = সব পর্দা, সবসময় ওপরের বারে: আগে যেগুলো ব্যবহার করেন, তারপর সরঞ্জামগুলো।
common.help.tab-strip.more = কোন কোন পর্দা থাকবে তা সেটিংসে ঠিক হয়। জায়গা কম পড়লে শুধু আইকন দেখায়, মাউস রাখলে প্রতিটা নিজের নাম বলে।

# The bubble a glyph-only control shows on hover.
common.help.hover-labels.term = হোভার লেবেল
common.help.hover-labels.what = শুধু আইকনওয়ালা প্রতিটা নিয়ন্ত্রণে মাউস রাখলে বা Tab দিয়ে পৌঁছলে ছোট একটা বুদবুদে নাম দেখায়।

# The right-click menu on a quote card.
common.help.card-menu.term = কার্ডে ডান-ক্লিক
common.help.card-menu.what = উদ্ধৃতির কার্ডে ডান-ক্লিক করলে যেখানে চাপলেন সেখানেই মেনু খোলে: কপি, শেয়ার, সম্পাদনা, মোছা।
common.help.card-menu.more = কিবোর্ডে Shift+F10 বা Menu চাবি দিয়েও খোলে; Escape দিয়ে বন্ধ। কার্ডের লেখা বাছা থাকলে তখন ব্রাউজারের নিজের মেনু খোলে।

# ---------------------------------------------------------------------------
# The capture surface's per-kind locator boxes (1.17.0). A game is placed by its
# act and its quest and has no timestamp at all — the server clears one on a game's
# line — so the form asks for the pair the medium actually has. The episode's name
# is the same locator as its number, said in words.
capture.form.act.placeholder = যেমন দ্বিতীয় অঙ্ক
capture.form.quest.placeholder = যেমন কায়ের মোরেনের যুদ্ধ
capture.form.episode-name.placeholder = যেমন দ্য রেইনস অফ ক্যাসটামিয়ার
# The actor the chosen character implies, from the work's own cast. Read-only: the
# server derives the stored actor, so this says the character matched a real row.
capture.form.played-by.prose = অভিনয়ে {name}

# The one on-demand IMDb pass (1.17.0) — a cast for the works whose structured
# source has none, which is most games. It asks for a LINK rather than searching,
# because a title search is how a cast lands on the wrong work, and it reports the
# title it attached because that is the only check against exactly that.
film.imdb.open.label = IMDb থেকে কাস্ট
film.imdb.link.label = IMDb লিংক বা id
film.imdb.link.placeholder = imdb.com/title/tt1073668/
film.imdb.go.label = কাস্ট আনুন
film.imdb.busy.label = আনা হচ্ছে…
film.imdb.done.prose = {title} — এখন কাস্টে {n} জন।
cast.open.label = মানুষ
cast.heading.label = মানুষ
cast.strip.heading.label = অভিনয়ে · {n}
cast.strip.heading.none.label = অভিনয়ে · কেউ নেই
cast.strip.edit.label = বদলান
cast.strip.edit.tip = এই তালিকায় যোগ করুন, আনুন বা ঠিক করুন
cast.delete.returns.note = এই বই বা সিনেমার আপনার উদ্ধৃতিতে এখনো এঁদের নাম আছে, তাই তালিকায় ফিরে এসেছেন। সরাতে হলে সেই লাইনগুলো বদলান।
cast.role.voice.label = কণ্ঠশিল্পী
cast.add.aria = একটা চরিত্র যোগ করুন
cast.empty.prose = এখনও কোনও কাস্ট জমা নেই। সূত্র থেকে আনুন, বা একটা চরিত্র নিজে যোগ করুন।
cast.unnamed.label = (নাম নেই)
cast.source.corrected.note = আপনার সংশোধন করা
cast.picture.aria = {name}-এর ছবি
cast.picture.url.aria = {name}-এর ছবির URL
cast.picture.placeholder = https://… ছবির URL
cast.remove.aria = {name}-কে সরান
cast.remove.confirm.prose = {name}-কে সরাবেন?
cast.fill.heading.label = শুধু কাস্ট
cast.fill.tvdb.label = TheTVDB থেকে কাস্ট
cast.fill.done.prose = {title} — এখন কাস্টে {n} জন।
cast.fill.match.prose = এই শিরোনামটা TheTVDB-তে এখনো মেলানো হয়নি। ঠিক রেকর্ডটা বাছলে অভিনেতাদের তালিকা আর চরিত্রের ছবিও সঙ্গে আসবে:
cast.fill.match.none = TheTVDB-তে এই নামে কিছু মেলেনি। আইডি জানা থাকলে বিবরণে লিখে দিন।
cast.fill.info.title = কাস্ট আনা
cast.fill.info.body = TheTVDB-তে চরিত্রের ছবি থাকে, তবে আগে শিরোনামটা ওখানে মেলাতে হয়। IMDb-তে গেমও পাওয়া যায়, আর আপনি যে পাতা দেবেন সেটা পড়ে। আপনার লেখা নাম কখনো বদলায় না।
cast.info.title = মানুষদের কথা
cast.info.body = এই বই বা সিনেমার চরিত্ররা আর কে কোন চরিত্রে। চরিত্রের ছবি এখানেই বসে; অভিনেতার ছবি তাঁর সব কাজে এক, তাই সেটা তাঁর নিজের পাতায় বদলাতে হয়।
error.load.imdb-cast = ওই IMDb টাইটেলটা পড়া গেল না।
error.load.cast = কাস্ট লোড করা গেল না
error.load.cast-picture = ছবিটা আনা গেল না
error.load.tvdb-cast = TheTVDB থেকে কাস্ট পড়া গেল না।
# ---- প্রস্তাবের উত্তর (2.2.1) ----------------------------------------------
# See the English block. মূল কথা: কী বদলাবে তা আগে দেখা যায়, আর বাতিল করলে লেখায়
# হাত পড়ে না।
cleanup.bucket.heading = দেখান

# ---- answering a finding (2.2.1) -------------------------------------------
# The page reported and fixed nothing; it now offers the rewrite and remembers a
# refusal. The copy's job is to make accepting safe: the reader must know what will
# change before they press, and know that ignoring changes nothing at all.
cleanup.bucket.open.label = উত্তর বাকি
cleanup.bucket.ignored.label = বাতিল ({n})
cleanup.rescan.label = আবার দেখুন
cleanup.accept.label = মেনে নিন
cleanup.ignore.label = বাতিল করুন
cleanup.ignore.tip = এটা আর দেখানো হবে না। উদ্ধৃতিতে হাত পড়ে না।
cleanup.restore.label = আবার দেখান
cleanup.select-all.label = {n}টাই বাছুন
cleanup.row.pick.aria = এই {rule} খোঁজটি বাছুন
cleanup.bulk.accept.label = {n}টি মানুন
cleanup.bulk.ignore.label = এগুলি বাদ দিন
cleanup.bulk.restore.label = এগুলি আবার দেখান
cleanup.state.none-ignored = এখনও কিছু বাতিল করা হয়নি। বাতিল করা প্রস্তাব এখানে জমা থাকে, আর নতুন করে দেখানো হয় না।
cleanup.toast.applied = {n}টা শুধরে দেওয়া হল
cleanup.toast.stale = {n}টা আগেই বদলে গিয়েছিল, তাই ওগুলোয় কিছু করা হয়নি
cleanup.toast.duplicate = {n}টা শুধরালে আপনার রাখা অন্য একটা উদ্ধৃতির সঙ্গে হুবহু মিলে যেত, তাই ওগুলো যেমন ছিল তেমনই রাখা হল
cleanup.toast.ignored = {n}টা বাতিল
cleanup.toast.restored = {n}টা আবার তালিকায়

# A game's line, in the form it is corrected in (2.2.1). A game has no runtime, so
# where a film's line has a timestamp a game's has an act and a quest — the two the
# dedupe hash is keyed by, since a bark reused in two quests is two quotes.
film.line.form.act.placeholder = অঙ্ক
film.line.form.act.tip = সংলাপটা কোন অঙ্ক বা অধ্যায়ে — যা খুশি লেখা যায়, তাই “প্রস্তাবনা”-ও একটা উত্তর।
film.line.form.quest.placeholder = কোয়েস্ট
film.line.form.quest.tip = লাইনটা কোন কোয়েস্ট বা মিশনের। একই লাইন দুটো কোয়েস্টে আলাদা করে রাখা যায়।

# What a kind of standalone quote carries (0047's five, on screen at last in 2.2.1).
# Grouped under one heading because the kind lives on the board and not on the quote,
# so the form cannot know which of them applies — and because the alternative,
# boxes appearing and disappearing under a Select, hides a field somebody has filled.
quotes.form.region.placeholder = সিলেট, কলকাতা…
quotes.form.recipient.placeholder = কাকে লেখা
quotes.form.work-title.placeholder = কোন প্রবন্ধ বা নিবন্ধ থেকে
quotes.form.locator.placeholder = পৃষ্ঠা, অনুচ্ছেদ, লাইন
quotes.form.circa.label = তারিখটা আন্দাজ
identity.person.title = ব্যক্তি
identity.character.title = চরিত্র
identity.person.saved = রেকর্ডে সেভ হল
identity.character.saved = রেকর্ডে সেভ হল
identity.credit.saved = {title}-এ সেভ হল
identity.scope.work.title = এই কাজে
identity.credit.as.on = {as} নামে
identity.scope.library.body = এই ব্যক্তি যা যা কাজে আছেন, আর যে যে বানানে তাঁকে পাওয়া যায়।
identity.scope.library.character = এই চরিত্র যে যে কাজে আছে, আর যে যে বানানে তাকে পাওয়া যায়।
identity.person.portrait.none = এখনও কোনও ছবি নেই। খুঁজে নিন, নয়তো একটা ঠিকানা বসান।
identity.person.portrait.aria = {name}-এর ছবি
identity.person.portrait.url.aria = {name}-এর ছবির ঠিকানা
identity.person.portrait.clear.label = ছবিটা সরান
identity.character.appearances.title.one = {n}টা কাজে আছে
identity.character.appearances.title.other = {n}টা কাজে আছে
identity.works.add.label = কাজ যোগ করুন
# The five character/people screens (task 16). Register: চলিত, per
# docs/plans/bengali-style.md. Batch-1 rulings applied — আসল নাম (canonical),
# তালিকার নাম (sort name), কাজ (work), পরিচয় (identity). A Bengali classifier
# does not inflect for number, so .one and .other carry the same string; that is
# the same shape identity.character.appearances.title.* already has.
identity.crumb.book.one = {n}টা বই
identity.crumb.book.other = {n}টা বই
identity.crumb.film.one = {n}টা ছবি
identity.crumb.film.other = {n}টা ছবি
identity.crumb.show.one = {n}টা সিরিজ
identity.crumb.show.other = {n}টা সিরিজ
identity.crumb.game.one = {n}টা গেম
identity.crumb.game.other = {n}টা গেম
identity.crumb.works.one = {n}টা কাজ
identity.crumb.works.other = {n}টা কাজ
identity.crumb.badge.book = বই
identity.crumb.badge.film = ছবি
identity.crumb.badge.show = সিরিজ
identity.crumb.badge.game = গেম
identity.portrait.px = {w}×{h}px
identity.portrait.zoom.aria = {name}-এর ছবি পুরো স্ক্রিনে দেখুন
identity.portrait.small = {n}px-এর কম
identity.portrait.soft = কম কনট্রাস্ট
identity.portrait.ratio = {a}:{b}, ছেঁটে বসানো
identity.portrait.global = রেকর্ডের নিজের ছবি

identity.picture.fetch.label = খুঁজে আনুন
identity.picture.fetch.tip = সোর্সগুলোতে আরও ভালো ছবি আছে কিনা দেখুন
identity.picture.upload.label = আপলোড
identity.picture.upload.tip = এই মেশিনের একটা ফাইল
identity.picture.upload.aria = {name}-এর জন্য ছবির ফাইল বাছুন
identity.picture.paste.label = URL বসান
identity.picture.paste.tip = ওয়েব থেকে, ঠিকানা দিয়ে
identity.picture.promote.label = পরিচয়ের ছবি করে দিন
identity.picture.promote.tip = সব জায়গায় এইটাই চলুক
identity.picture.promote.ask.title = এই ছবিটাই পরিচয়ের ছবি করে দেব?
identity.picture.promote.ask.body = যে কাজগুলো নিজের ছবি বসায়নি, সবখানে এটাই চরিত্রটার ছবি হবে। এই কাজের নিজের ছবি যেমন আছে তেমনই থাকবে।
identity.picture.promote.ask.verb = হ্যাঁ, সব জায়গায় বসান
identity.portrait.from.identity = চরিত্রের নিজের ছবি
identity.portrait.from.actor = {name}-এর ছবি
identity.portrait.from.none = এই চরিত্রের ছবি নেই
# ---- প্যাকের স্থানীয় চরিত্র-পর্দা (char-book, char-film, char-game) ----
# একটা কাজের ভিতর থেকে দেখা একটা চরিত্র। এখানে যা আছে তা এই কাজেরই সত্য, অন্য
# কোনো কাজের নয়; পরিচয়ের নিজের সত্য থাকে বিশ্বজনীন পর্দায়, এক ধাপ দূরে।

identity.crumb.in = {title}-এ
identity.portrait.local = এই কাজের নিজের ছবি

identity.row.called.label = এখানে ডাকা হয়
identity.row.credited.label = কৃতিত্ব দেওয়া হয়েছে

identity.facts.part = ভূমিকা
identity.facts.first = প্রথম আসে
identity.facts.age = এখানে বয়স
identity.facts.none = দেওয়া হয়নি

identity.row.note.for = {name}-এর ক্রেডিটের নোট

# আর পরিধি প্রতি পর্দায় আলাদা, ক্যাপশন নয়। চারটে পর্দাতেই একই দুটো শব্দ —
# উদ্ধৃতি, প্রিয় — তাতেই সংখ্যাগুলো মেলানো যায়; কোন পরিধিতে গোনা হয়েছে সেটা
# টুলটিপ বলে।
identity.count.favourites.tip.character = সব কাজ মিলিয়ে এই চরিত্রের প্রিয় লাইনগুলো খুঁজুন
identity.count.favourites.tip.person = এই মানুষটার বলা সব প্রিয় লাইন
identity.count.favourites.tip.work = এই কাজের প্রিয় লাইনগুলো খুঁজুন
identity.count.quotes.tip.character = সব কাজ মিলিয়ে এই চরিত্রের বলা লাইন খুঁজুন
identity.count.quotes.tip.person = এই মানুষটার বলা সব লাইন
identity.count.quotes.tip.work = এই কাজের লাইনগুলো খুঁজুন
identity.count.quotes.one = উদ্ধৃতি
identity.count.quotes.other = উদ্ধৃতি
identity.count.favourites.one = প্রিয়
identity.count.favourites.other = প্রিয়
identity.count.favourites.tip = এই কাজে এই চরিত্রের প্রিয় লাইনগুলো খুঁজুন
identity.count.quotes.tip = এই কাজে এই চরিত্রের বলা লাইন খুঁজুন

identity.row.global.label = বিশ্বজনীন রেকর্ড খুলুন
identity.row.global.sub = সব কাজ জুড়ে

# --- giving a work-level character a SECOND work (the owner's item 3). The label
# names the door; the sub names the consequence, which is the half the owner
# asked about — "that will get added to the global-character (which should in
# turn enable global character for the character as well)". It is one credit
# either way: the global screen is a consequence of the count, not a flag.
identity.row.add-work.label = আরও একটা কাজেও আছেন
identity.row.add-work.sub = দুটোতেই একই চরিত্র, আর নিজের আলাদা পাতাও পাবে
identity.badge.global = বিশ্বজনীন

identity.section.remove.label = সরান
identity.row.unlink.label.book = এই বই থেকে সরান
identity.row.unlink.label.film = এই ছবি থেকে সরান
identity.row.unlink.label.show = এই ধারাবাহিক থেকে সরান
identity.row.unlink.label.game = এই খেলা থেকে সরান
identity.row.unlink.sub.book = অন্য কাজে চরিত্রটা থাকে
identity.row.unlink.sub.cast = অন্য কাজে চরিত্রটা থাকে
identity.picker.blocked = আগে কিছু লিখুন
identity.picker.save.tip = শুধু এই একটা ঘর লেখে
identity.picker.person.label = কে
identity.picker.person.placeholder = নাম খুঁজুন বা লিখুন
identity.picker.person.new = “{name}” নতুন — সেভ করলে যোগ হয়ে যাবেন
identity.picker.lang.other = বা একটা ভাষা লিখুন
identity.picker.lang.suggestions = English · हिन्दी · বাংলা · 日本語 · Français
identity.local.names.hint = এক লাইনে একটা নাম। প্রথমটা উদ্ধৃতি আর নামের তালিকায় দেখায়; বাকিগুলো অন্য বানান, খুঁজলে পাওয়া যাবে।
identity.local.names.placeholder = যে নামটা ছাপা হবে\\nআরেকটা বানান
identity.row.local-desc.label = এই কাজে ইনি কে
identity.row.local-desc.sub = শুধু এই কাজে
identity.row.local-desc.none = নেই
identity.local.names.saved = নাম সেভ হয়েছে — প্রথম লাইনটা ছাপা হবে
identity.credit.add.blocked = আগে অভিনেতার নাম দিন
# ---- অভিনেতার ব্লক, char-film আর char-game-এ -----------------------
identity.section.actorby = অভিনয়ে
identity.section.voiceby = কণ্ঠে
identity.seg.played = অভিনয়ে
identity.seg.voiced = কণ্ঠে
identity.section.dubbedby = ডাবিংয়ে
identity.credit.unnamed = এখনও নাম দেওয়া হয়নি
identity.credit.no-performer = কেউ অভিনয় করেননি
identity.credit.add.dub.lang.label = কোন ভাষায় ডাব
identity.credit.add.save.label = ক্রেডিট যোগ করুন
identity.credit.add.save.tip = এই কাজে এই চরিত্রের আরও একজন অভিনেতা যোগ করে। ভাষা দিলে সেটা ডাবিং ক্রেডিট হয়ে যায়।
identity.credit.add.performer = আরও একজন অভিনেতা যোগ করুন
identity.credit.add.voice = আরও একটা কণ্ঠ যোগ করুন
identity.credit.add.dub = ডাবিংয়ের কৃতিত্ব যোগ করুন
identity.credit.pick.tip = কে সেটা বদলান
identity.credit.open.tip = তাঁর রেকর্ড খুলুন
identity.credit.unnamed.tip = এই কৃতিত্বে এখনও কারও নাম নেই
identity.credit.note.tip = এই কাস্টিংয়ে বিশেষ কী আছে
identity.credit.remove.tip = এই কৃতিত্ব সরিয়ে দিন
# ---- people-work, প্যাকে যে পর্দা আঁকা নেই -------------------------



identity.section.identity.label = পরিচয়
identity.section.identity.note = সব কাজে পৌঁছয়।
identity.section.person.label = মানুষটি
identity.section.company.label = সংস্থাটি
identity.section.links.label = লিংক
identity.section.works.label.one = কাজ · {n}
identity.section.works.label.other = কাজ · {n}
identity.section.itself.label.character = পরিচয়টা নিজেই
identity.section.itself.label.person = এই মানুষটি
identity.section.itself.label.company = এই সংস্থাটি
# রেকর্ডের নামগুলো একটাই ঘরে — সার্ভার বরাবর গোটা সেটই নেয়, আর প্রথম খালি-নয় লাইনটাই
# ছাপা নাম হয়।
identity.row.canonical.hint = এক লাইনে একটা নাম। প্রথমটা সব জায়গায় দেখায়; বাকিগুলো অন্য বানান, খুঁজলে পাওয়া যাবে। বদলালে সব বই-সিনেমাতেই বদলাবে।
identity.row.canonical.saved = নাম সেভ হয়েছে — প্রথম লাইনটা ছাপা হবে
identity.row.canonical.label = আসল নাম
identity.row.canonical.alone = রেকর্ডে এই একটাই বানান
identity.row.name.label = নাম
identity.row.sort.label = তালিকার নাম
identity.row.sort.none = নামের মতোই
identity.row.sort.sub.character = তালিকায় এটা কোথায় বসবে
identity.row.sort.sub.person = তালিকায় এঁর নাম কোথায় বসবে
identity.row.sort.sub.company = তালিকায় এর নাম কোথায় বসবে
identity.row.born.none = লেখা নেই
identity.row.born.sub.character = গল্পের ভিতরের, যদি কোনও কাজ বলে থাকে
identity.row.link.add.label = লিংক যোগ
identity.row.link.add.tip = এই রেকর্ডের একটা ঠিকানা পেস্ট করুন
# ---- প্রদানকারীর আইডি থেকে লিঙ্ক যোগ করা ----------------------------------
identity.link.id.title = লিঙ্ক যোগ করুন
identity.link.id.provider.label = কোন সাইট
identity.link.id.field.label = আইডি
identity.link.id.field.label.url = ঠিকানা
identity.link.id.provider.custom = যেকোনো ঠিকানা
identity.link.id.save.tip = এই লিঙ্কটা যোগ করুন
identity.link.id.save.blocked = আগে আইডি লিখুন
identity.link.id.save.blocked.url = আগে ঠিকানাটা পেস্ট করুন
identity.link.id.save.wrong = এটা {site}-এর আইডি নয়
identity.link.id.example.label = যেমন
identity.link.id.hint.custom = ওয়েবের যেকোনো পাতা। নিচের কোনো সাইটের ঠিকানা পেস্ট করলে সেটা নিজেই সেখানে বসে যাবে।
identity.link.id.hint.imdb = nm, তারপর সাত বা আটটা সংখ্যা
identity.link.id.hint.tmdb = শুধু সংখ্যা
identity.link.id.hint.tvdb = সংখ্যা, বা ঠিকানায় নামটা যেভাবে লেখা
identity.link.id.hint.amazon = দশটা অক্ষর-সংখ্যা — লেখক-স্টোরের ASIN
identity.link.id.hint.igdb = ঠিকানায় নামটা যেভাবে লেখা
identity.link.id.example.custom = en.wikipedia.org/wiki/Rajesh_Khanna
identity.link.id.example.imdb = imdb.com/name/nm0000123/ → nm0000123
identity.link.id.example.tmdb = themoviedb.org/person/10859-ryan-reynolds → 10859
identity.link.id.example.tvdb = thetvdb.com/people/rajesh-khanna → rajesh-khanna
identity.link.id.example.amazon = amazon.com/stores/author/B001H6TVXK → B001H6TVXK
identity.link.id.example.igdb = igdb.com/companies/electronic-arts → electronic-arts

identity.section.performers.title = অভিনয়ে · {n}
identity.performers.unlinked.tip = এই অভিনেতার কোনো রেকর্ড এখনও নেই
identity.strip.order.hint = মুক্তির ক্রমে সাজানো।
identity.tile.face.played = {name} — {actor}-এর অভিনয়ে
identity.row.merge.label.character = আরেকটা চরিত্রের সঙ্গে জুড়ে দিন
identity.row.merge.sub.character = দুটো পরিচয় এক হয়ে যায়; কাজের রেকর্ড যেমন ছিল তেমনই আসে
identity.row.merge.label.person = আরেকজনের সঙ্গে জুড়ে দিন
identity.row.merge.label.company = আরেকটা সংস্থার সঙ্গে জুড়ে দিন
identity.row.merge.sub.person = তাঁর নাম আর বানানগুলো এক রেকর্ডে চলে আসে
identity.row.merge.sub.company = এর নাম আর বানানগুলো এক রেকর্ডে চলে আসে
identity.row.remove-all.label = সব কাজ থেকে সরান
identity.row.remove-all.sub = একটা করে কাজ

identity.choose.work.hint = এখানে একাধিক জিনিস আছে। কোনটা চান?
identity.choose.work.sub = কাজটার নিজের পাতা
identity.choose.work.unreachable = এই স্ক্রিন থেকে কাজটায় ফেরার কোনো পথ নেই
identity.choose.local.sub = এই চরিত্র, এই কাজটা যেভাবে তাকে দেখায়
identity.choose.actor.sub = অভিনেতার নিজের রেকর্ড
identity.choose.global.sub = সব কাজ মিলিয়ে চরিত্রটা
identity.choose.roles.hint = এতে এঁর একাধিক চরিত্র আছে। কোনটা চান?
identity.choose.role.sub = চরিত্রটা, এই কাজটা যেভাবে তাকে দেখায়
identity.remove-all.ask.title = এতে চরিত্রটা সব কাজ থেকেই সরে যাবে
identity.remove-all.ask.body = একসঙ্গে সব খোলা যায় না: প্রতিটা কাজ নিজে খুলে দিন। প্রতিটা কাজের রেকর্ড, উদ্ধৃতি আর ছবি থেকেই যাবে।
identity.remove-all.unlink.sub = এই কাজটা খুলে দিন
identity.row.delete.label.person = এই মানুষটিকে মুছুন
identity.row.delete.label.company = এই সংস্থাটিকে মুছুন
identity.row.delete.sub.person = নামগুলো যায়; কাজ আর চরিত্র থাকে
identity.row.delete.sub.company = নামগুলো যায়; কাজগুলো থাকে
identity.works.add.character.tip = এই চরিত্র আছে এমন একটা কাজ যোগ করুন
identity.works.add.person.tip = এঁর নাম আছে এমন একটা কাজ যোগ করুন
identity.works.add.company.tip = এর নাম আছে এমন একটা কাজ যোগ করুন
identity.alias.title = অন্য বানান
identity.alias.body = এর যে কোনও বানানে নাম এলে নতুন রেকর্ড না হয়ে এখানেই আসে। এই বানানগুলো কোথাও দেখানো হয় না।
identity.alias.none = অন্য কোনও বানান নেই।
identity.alias.add.label = যোগ করুন
identity.alias.add.placeholder = আরেকটা বানান…
identity.alias.remove.aria = {alias} বানানটা সরান
identity.alias.split.label = আলাদা করুন
identity.alias.split.tip = এই বানানটাকে আলাদা রেকর্ড দিন। কাজগুলো এখানেই থাকবে।
identity.alias.split.done = {alias} এখন নিজের রেকর্ড পেল। এর কাজগুলো যেখানে ছিল সেখানেই আছে।
identity.merge.title = আরেকটা রেকর্ড এতে মেলান
identity.merge.body = একই মানুষের দুটো রেকর্ড এক হয়ে যাবে; থাকবে {name}।
identity.merge.body.company = একই সংস্থার দুটো রেকর্ড এক হয়ে যাবে; থাকবে {name}।
identity.merge.search.placeholder = অন্য রেকর্ডটা খুঁজুন…
identity.merge.search.into = {name}-এর সঙ্গে যে রেকর্ড মেলাবেন…
identity.merge.confirm.title = {name}-কে {into}-এ মেলাবেন?
identity.merge.confirm.body = {name} মিশে যাবে {into}-এ। এর নামে যা আছে সব ওখানে চলে যাবে, আর নামটা বানান হিসেবে থেকে যাবে, যাতে পরের ইমপোর্টে আবার নতুন রেকর্ড না হয়।
identity.merge.confirm.covers = কোনও প্রচ্ছদ বদলাবে না। প্রতিটা কাজ আজ যে নাম ছাপে, তা-ই ছাপবে।
identity.merge.confirm.undo = বিন থেকে ফেরাতে পারবেন, যতদিন বিন বাকি সবকিছু রাখে।
identity.merge.confirm.action = মিলিয়ে দিন
identity.merge.done = {name} এখন {into}-এর অংশ
identity.field.sort = যেভাবে সাজে
identity.field.born = জন্ম
identity.field.died = মৃত্যু
identity.field.note = আপনার নোট
identity.field.description = বিবরণ
identity.merge.body.character = একই চরিত্রের দুটো রেকর্ড এক হয়ে যাবে; থাকবে {name}।
identity.character.promote.clear.label = ছবিটা সরিয়ে দিন
identity.character.promote.done = এখন থেকে {title}-এর ছবিটাই এই চরিত্রের চেহারা
identity.character.promote.cleared = চরিত্রটার নিজের কোনও ছবি আর নেই
identity.character.works.add.label = কোনও কাজে যোগ করুন
identity.character.works.add.placeholder = বই বা ছবি খুঁজুন…
identity.character.works.add.none = কিছু মিলল না, নয়তো যা মেলে তার সবগুলোতেই এরা আছে।
identity.character.works.add.actor.label = অভিনয়ে (শুধু ছবি ও সিরিজে)
identity.character.works.add.actor.placeholder = জানা না থাকলে খালি রাখুন
identity.character.works.add.done = {title}-এ যোগ হল
identity.character.works.remove.done = {title} থেকে সরানো হল
identity.character.drop.title.one = {title}-এর {n}টা উদ্ধৃতিতে এখনও {name}-এর নাম আছে
identity.character.drop.title.other = {title}-এর {n}টা উদ্ধৃতিতে এখনও {name}-এর নাম আছে
identity.character.drop.body.one = এই কাজের একটা উদ্ধৃতিতে চরিত্রটার নাম আছে, তাই কাজটা খুললেই সে কাস্টে ফিরে আসে। আগে উদ্ধৃতির বক্তা বদলান।
identity.character.drop.body.other = এই কাজের কয়েকটা উদ্ধৃতিতে চরিত্রটার নাম আছে, তাই কাজটা খুললেই সে কাস্টে ফিরে আসে। আগে ওই উদ্ধৃতিগুলোর বক্তা বদলান।
identity.character.drop.replace.label = বদলে এইটা লেখা হোক
identity.character.drop.replace.placeholder = অন্য চরিত্র…
identity.character.drop.replace.action = নাম বদলে সরিয়ে দিন
identity.character.drop.clear.action.one = নয়তো উদ্ধৃতিটা বক্তা ছাড়াই থাক
identity.character.drop.clear.action.other = নয়তো উদ্ধৃতিগুলো বক্তা ছাড়াই থাক
unit.role.author = লেখক
unit.role.translator = অনুবাদক
unit.role.editor = সম্পাদক
unit.role.director = পরিচালক
unit.role.actor = অভিনেতা
unit.role.studio = স্টুডিও
unit.role.publisher = প্রকাশক
unit.role.speaker = বক্তা
# A work's links out (0062). See workLinks.jsx.
links.web.label = একটা ওয়েবপেজ
links.empty = এখনো কোনো লিংক নেই। এই রেকর্ডের কোনো পাতা, বা যেকোনো ওয়েব ঠিকানা যোগ করুন।
links.paste.label = লিংক যোগ করুন
links.name.label = কী নামে ডাকবেন (ঐচ্ছিক)
links.name.placeholder = ওঁর প্রবন্ধ
# The derived list at the top of the add panel: the pages this record's own
# pinned ids can already address. Absent when there are none left to add.
links.suggest.heading = এই রেকর্ডের যে পাতাগুলো আছে
links.suggest.or = নয়তো একটা বসান
links.suggest.tip = এই রেকর্ডের {name} পাতাটা যোগ করুন
links.paste.placeholder = imdb.com/title/tt0084787
links.paste.hint = যেকোনো ঠিকানা বসান। যোগ করার আগেই দেখাবে সেটা কী হিসেবে পড়া হচ্ছে।
links.reading = {name} হিসেবে পড়া হচ্ছে — {host}
links.reading.none = এটা এখনও কোনও ঠিকানা নয়।
links.already = এটা ইতিমধ্যেই এই রেকর্ডে আছে।
links.add.aria = এই লিংকটা যোগ করুন
links.remove.aria = {name} লিংকটা সরান
# Ordering, grouping and filtering ANY board of quotes — a book's highlights and
# a film's, a show's or a game's lines alike. One vocabulary, because one control
# draws all of them: see boardHead.jsx. The dimensions are named for themselves
# (chapter, character, episode, act, quest), so no two kinds collide and a kind
# offers only the ones workKinds.js says it has.
board.category.any.label = যে কোনও শ্রেণি
board.columns.label = কলাম
board.columns.auto.label = আপনা-আপনি
board.group.aria = উদ্ধৃতি সাজান
board.group.none.label = কিছু না
board.group.chapter.label = অধ্যায় অনুযায়ী
board.group.color.label = শ্রেণি অনুযায়ী
board.group.tag.label = ট্যাগ অনুযায়ী
board.group.date.label = যোগ করার তারিখ অনুযায়ী
board.group.chapter.numbered.label = অধ্যায় {n}
board.group.chapter.named.label = অধ্যা. {n}: {name}
board.group.chapter.none.label = অধ্যায় নেই
board.group.tag.none.label = ট্যাগ নেই
board.group.date.none.label = তারিখ নেই
board.sort.default.label = সাম্প্রতিক
board.sort.date.label = যোগ করার তারিখ
board.sort.chapter.label = অধ্যায়
board.sort.location.label = অবস্থান
board.sort.length.label = দৈর্ঘ্য
board.sort.category.label = শ্রেণি
board.sort.dir.label = ক্রম
board.sort.dir.asc.label = ছোট থেকে বড়
board.sort.dir.desc.label = বড় থেকে ছোট
board.sort.menu.label = সাজানো
board.group.character.label = চরিত্র অনুযায়ী
board.group.episode.label = এপিসোড অনুযায়ী
board.group.act.label = অঙ্ক অনুযায়ী
board.group.quest.label = কোয়েস্ট অনুযায়ী
board.sort.character.label = চরিত্র
board.sort.episode.label = এপিসোড
board.sort.timestamp.label = সময়
board.sort.act.label = অঙ্ক
board.sort.quest.label = কোয়েস্ট
board.group.character.none.label = চরিত্র নেই
board.group.episode.numbered.label = এপিসোড {n}
board.group.episode.seasoned.label = সি{s} · এ{n}
board.group.episode.none.label = এপিসোড নেই
board.group.act.none.label = অঙ্ক নেই
board.group.quest.none.label = কোয়েস্ট নেই
board.strip.shown.label = {total}টার মধ্যে {n}টা দেখানো হচ্ছে
book.select.menu.label = উদ্ধৃতি বাছাই

# ---- PRUNE: the saved records nothing points at ---------------------------
# bn: "orphan" has no good Bengali for a record — অনাথ is for a child. পড়ে থাকা
# is the owner's own word for a thing left lying (v3.7), so the button says what
# it clears rather than naming a category.
metadata.prune.count.label = {n}টা সরান
metadata.prune.tip = কোনও কাজ যাদের দিকে তাকায় না, সেই মানুষ আর চরিত্রদের ঝুড়িতে পাঠায়
metadata.prune.confirm.title = {n}টা রেকর্ড সরাবেন?
metadata.prune.confirm.body = আপনার সংগ্রহে কোথাও এঁদের উল্লেখ নেই। এঁরা বিনে যাবেন, সেখান থেকে যে কাউকে ফেরাতে পারেন।
metadata.prune.confirm.people.one = {n} জন মানুষ
metadata.prune.confirm.people.other = {n} জন মানুষ
metadata.prune.confirm.characters.one = {n}টা চরিত্র
metadata.prune.confirm.characters.other = {n}টা চরিত্র
metadata.prune.confirm.cta = সরান
metadata.prune.toast.one = {n}টা রেকর্ড সরানো হল — ডাস্টবিনে আছে
metadata.prune.toast.other = {n}টা রেকর্ড সরানো হল — ডাস্টবিনে আছে
error.prune = সরানো গেল না

# ---- a bin entry's works, and the face an identity entry took ------------
`;export{e as default};
