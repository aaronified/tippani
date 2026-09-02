# টিপ্পনী — the Bengali style sheet

**This document is the decision, not a survey.** Three writers are about to put roughly
40,000 characters of Bengali into `internal/i18n/bn.txt` in parallel. The single worst
outcome is three registers in one interface, so nothing here is a suggestion. Where you
disagree with a call, mark the line (§7) and move on — do not quietly render it your way.

Read once, end to end, before writing a single line. Then keep §3 open beside you.

---

## §0. The five mechanical facts that constrain every decision below

These are properties of the file and the test suite, not opinions. Check them yourself if
you like; they are the reason several decisions in this sheet go the way they do.

1. **`bn.txt` is held to the same copy budgets as `en.txt`.**
   `web/frontend/test/locale-file.js` exports `BUILTINS = [['en', EN], ['bn', BN]]`, and
   `test/pure/help-budget.test.js` and `test/pure/infodot-copy.test.js` both walk it. A
   Bengali `.what` over 160 characters fails the suite. Hard numbers in §6.

2. **A value cannot carry a marker.** The parser splits on the **first `=`** and trims
   only whitespace, so anything you put after the `=` ships to the screen. Every note,
   doubt and length flag is therefore a **comment line above the key** (§7).

3. **Numbers arrive as Western digits and you cannot change that.**
   `i18n.js`'s `fill()` interpolates with `String(vars[name])` — no `Intl.NumberFormat`
   — so `{n}` is always `12`, never `১২`. Consequence in §3.0.

4. **Bengali has two plural categories and zero counts as `one`.**
   `new Intl.PluralRules('bn').select(0) === 'one'`. So a family with only `.other`
   written leaves both `n = 0` and `n = 1` falling back to English. Consequence in §3.0.

5. **The mono/small-caps font stack has no Indic face.**
   `src/locale.jsx` says so in its own header: the mono stack is
   `latin, ui-monospace, monospace`. Bengali in a mono slot draws in whatever the OS
   reaches for. And Bengali has no letter case, so `text-transform: uppercase` and small
   caps do nothing to it. Consequence in §6.3.

**How to check your own work before handing it in**

```
cd "D:/Code Projects/tippani/web/frontend"
npx vitest run test/pure/help-budget.test.js test/pure/infodot-copy.test.js
```

Both pass today. If either fails after your pass, the failure names the key and the
character count.

---

## §1. REGISTER

### 1.1 চলিত ভাষা. Not সাধু. Not officialese.

Write **modern colloquial standard Bengali** — the register of a well-edited Bengali
newspaper feature or a good blog, not of a circular. Concretely, this is the register that
says *করুন*, not *করিবেন*; *হয়েছে*, not *হইয়াছে*; *তার*, not *তাহার*; *এখন*, not *এক্ষণে*.

The failure mode this app is actually exposed to is not সাধু — nobody writes সাধু by
accident any more. It is **bureaucratic Bengali**: the register of a form. Its tells are
strung-together verbal nouns (*সংরক্ষণ করা হইতেছে*), *এবং* where speech says *আর*, *তথা*,
*উক্ত*, *প্রদত্ত*, *নিম্নলিখিত*, *অনুগ্রহপূর্বক*, and passive constructions with an agent
that never appears. If a sentence could be pinned to a municipal noticeboard, rewrite it.

Two positive tests you can apply to any line you have just written:

- **Would you say this out loud to a friend about this app?** If not, it is the wrong
  register.
- **Is there an `-করণ` / `-বিধান` / `-পূর্বক` in it?** Take it out.

### 1.2 Person-form: **আপনি**. Committed.

The app is a personal library, which argues for তুমি — but আপনি wins on two grounds. First,
তুমি from software to an adult reader is socially marked in Bengali in a way *you* is not
in English: it reads either as a children's app or as an impertinence from a stranger, and
this app also carries an admin, other users' accounts, and destructive confirmations, where
being talked down to is worse than being kept at a polite distance. Second, warmth in
Bengali comes from word choice and rhythm, not from the pronoun — *এখনও জেগে আছেন?* is
warm; *এখনও জেগে আছ?* is familiar, which is a different and unearned thing.

So: **আপনি throughout, and its verb forms — করুন, দেখুন, রাখুন, দেখেননি, পারেননি.**
No exceptions, including greetings and the tour.

### 1.3 But drop the pronoun. This is the single biggest fluency lever.

Bengali does not need *আপনার* the way English needs *your*, and the calque's most obvious
tell is *আপনার* in front of every noun. **Delete আপনার unless possession is the actual
point** — that is, unless the sentence contrasts your thing with somebody else's, or with
the app's.

| English | Wrong | Right |
| --- | --- | --- |
| Your books | আপনার বই | বই |
| Open your book library | আপনার বইয়ের লাইব্রেরি খুলুন | বইয়ের লাইব্রেরি খুলুন |
| Everything you delete waits here | আপনি যা কিছু মুছে ফেলেন সব এখানে থাকে | মুছে ফেলা সবকিছু এখানে থাকে |
| Every user keeps their own | প্রত্যেক ইউজার তার নিজের রাখে | প্রত্যেক ইউজারের নিজের আলাদা |
| **Your** margin notes | আপনার মার্জিনের নোট | **আপনার** মার্জিনের নোট *(keep — contrasted with the author's book)* |

Same rule for *এটি / এটা / তা* standing in for an English *it*. Bengali drops the subject
when it is obvious; an *এটি* at the head of a clause is almost always a translated *It*.

### 1.4 Orthography: Kolkata standard, and here are the specific forms

Three writers will otherwise disagree about a dozen spellings, and the diff will look like
three people. Use these:

- **কোনও** (not কোনো, কোন), **এখনও** (not এখনো), **হয়নি** (not হয় নি), **কিছুই**
- **-গুলো** for the plural, not -গুলি (গুলি is a shade formal for this register)
- **হিসেব** (not হিসাব), **উপলক্ষ** (not উপলক্ষ্য), **রং** (not রঙ, except in compounds: রঙের, রঙিন)
- **সবচেয়ে** (not সর্বাধিক), **আর** (not এবং) as the everyday "and"; keep এবং for a
  formal list of three or more
- **টা vs টি:** *টা* on a definite noun in prose — বইটা, কার্ডটা, লাইনটা. *টি* after a
  numeral in a count — ১২টি বই. Human nouns take *জন* — ৩ জন লেখক.
- **Sentence end: দাঁড়ি `।`** in every prose sentence. A Latin full stop after Bengali
  reads as an untranslated remnant. `?` and `!` stay as they are. **No `।` on a label, a
  chip, a placeholder or a hint that the English leaves unpunctuated.** The key
  `common.form.reason.sentence = {reason}.` exists solely to put the stop on — in Bengali
  it becomes `{reason}।`
- **Quotation marks:** the curly pair `“ ”`, as `en.txt` uses. Em dash `—` is available and
  Bengali takes it well; see §5.3 for when to break it into a sentence instead.

---

## §2. THE THREE DOMAIN TERMS

This is the decision that matters more than every other decision in this document combined.
The app distinguishes three things that English lazily calls "quotes", and Bengali can
distinguish them better than English does.

### 2.1 First: what happens to টিপ্পনী

**টিপ্পনী is the brand and the practice. It is never a countable object in the interface.**

টিপ্পনী already means *a marginal annotation* — which is exactly what a book highlight is —
so using it for the object collides head-on with the app's own name: *টিপ্পনীতে ১২টি
টিপ্পনী* is unusable. The word therefore keeps one job and one job only:

- The product name, in Bengali script: **টিপ্পনী**. Write it this way in Bengali copy, never
  as `tippani` in Latin. (`common.filmstrip.edge.label = TIPPANI · SAFETY FILM` is
  artwork, not copy — see §8.)
- The *practice*, in the epigraphs and the tour, where the app talks about what it is for:
  *মার্জিনের টিপ্পনী*. Uncountable, no classifier, no plural.

Nothing else. Not the object, not the field, not the count.

### 2.2 A book HIGHLIGHT (the app's "annotation") → **দাগ**

**Reasoning.** দাগ is what a Bengali reader literally does to a book — *বইয়ে দাগ দেওয়া* —
and the app's object is precisely the metonymy English performs with *highlight*: the mark
stands for the line it marks. It is short (3 code units, 2 clusters), it fits every narrow
slot, it gives a free verb (*দাগানো*, *দাগ দেওয়া*), it maps onto the thing the reader
actually sees (a coloured bar), and *রঙের দাগ* / *দাগের রং* falls out naturally for the
colour category. It is a long-naturalised everyday word, not a Sanskritic coinage, and it
cannot be confused with টিপ্পনী.

**Rejected:** হাইলাইট (an avoidable loan — §4), উদ্ধৃতাংশ and রেখাঙ্কন (decode-me
coinages), পঙ্‌ক্তি (a line of *verse*; wrong for prose and for a note), টীকা (collides
with টিপ্পনী's own sense).

**The stain objection, answered:** yes, দাগ also means a stain. In every place this word
appears it is inside a book's own screen, next to a colour and a chapter, after a numeral.
Context disposes of it, exactly as it does in English, where *highlight* also means the
best bit of a football match.

### 2.3 A film LINE (the app's "dialogue") → **সংলাপ**

**Reasoning.** This one is simply correct. সংলাপ is the ordinary Bengali word for film
dialogue — Bengali film writing and everyday film talk both use it, it is countable
(*৩টি সংলাপ*), and it needs no gloss. Note that `en.txt` deliberately runs two English
words for one row — *film line* in the bulk vocabulary and *dialogue* on the tile — because
neither English word fits both slots. **Bengali needs only one: সংলাপ serves both**, and
`unit.dialogue.*` and `common.work-card.count.dialogue.*` get the same word. That is a
simplification, not a loss.

**Rejected:** ডায়ালগ (avoidable loan), কথা (too broad), বুলি (pejorative).

### 2.4 A STANDALONE QUOTE (an utterance) → **উক্তি**

**Reasoning.** উক্তি is *a thing someone said* — the word Bengali already uses for an
attributed saying (*রবীন্দ্রনাথের উক্তি*). That is exactly this object: words with a
speaker and an occasion and no work behind them. It sits perfectly with the two fields the
app pairs it with, বক্তা and উপলক্ষ.

**Rejected:** বাণী (scriptural / pronouncement — too grand, and faintly comic on a line a
friend said), কোট (lazy loan), বচন (proverbial only).

### 2.5 And the umbrella: **উদ্ধৃতি**

English overloads *quote* to mean both the third kind and all three kinds at once —
`stats.help.counts` says so out loud: *"annotations from books, dialogues from films, quotes
from no work at all"*, and then `nav.tab.quotes` and `quotes.board.all` use the same word
for the screen. Bengali splits it and is clearer for it:

| Concept | Bengali | Where |
| --- | --- | --- |
| All three kinds, as one class | **উদ্ধৃতি** | `unit.quote`, quote cards, anthologies, search, stats totals |
| A book highlight | **দাগ** | Library, a book's page, `unit.highlight` |
| A film / show / game line | **সংলাপ** | Catalogue, a title's page, `unit.dialogue` |
| A standalone utterance | **উক্তি** | the Quotes tab, boards, `nav.tab.quotes` |
| The practice, and the app | **টিপ্পনী** | brand, epigraphs, tour |

**The rule for choosing, with no thinking required:** if the English string is on a screen
that holds only one kind (a book's page, a title's page, a board), use that kind's word. If
the string is shared across screens or counts all three, use **উদ্ধৃতি**. The `nav.quotes`
tab and everything on a board is **উক্তি**; `quotes.board.all.label = All quotes` is
**সব উক্তি**, because a board only ever holds উক্তি.

উদ্ধৃতি and উক্তি share a root, and that is deliberate: উদ্ধৃতি is *something quoted from
somewhere*, উক্তি is *something said by someone*. They are visually distinct enough at a
glance (5 clusters against 3) that no reader will confuse them, and semantically close
enough that neither feels like a different subject.

---

## §3. THE TERM TABLE

**This table is binding.** If a word is in here, that is the word. If you need a term that
is not in here, add a row at the bottom of this file under `## Additions` with your choice
and one line of reason, and mark the key with `# ?? ` (§7) so the owner sees it once rather
than three times.

### 3.0 Four rules that apply to the whole table before any single word does

- **Digits are Western: `12`, `1920`, `01:15:00`, `978-…`.** Never ০-৯. `{n}` arrives from
  JavaScript as `12` (§0.3), so a Bengali digit in a static string would put two number
  systems in one line. This applies to years, page numbers, ISBNs, timestamps, versions and
  counts alike.
- **Both plural forms, always, and usually identical.** Bengali takes no plural marker after
  a numeral, so `unit.book.one` and `unit.book.other` are **both `বই`**. Write both anyway:
  `n = 0` resolves to `one` in Bengali (§0.4), and an unwritten form silently falls back to
  English. The same goes for every `*.one` / `*.other` sentence pair — write the same
  Bengali twice rather than leaving one out.
- **`common.count.phrase = {n} {noun}` stays bare — no classifier.** A count slot in Bengali
  is legitimately written *12 বই*, and a shared phrase cannot carry both টি (objects) and জন
  (people). Where a *sentence* needs a classifier, the writer of that sentence supplies it:
  *এখানে 12টা উক্তি রাখা আছে।*
- **The classifier is টা, and জন for people (v3).** 12টা, দুটো, তিনটে, কটা — spelled without
  an apostrophe, as today’s print spells them. টি is the newsprint register this sheet keeps out,
  and the earlier passes had mixed the two on one screen.
- **A shared key gets one word.** The whole point of `common.*` is that the add form, the
  bulk bar, the table head and the export heading spell a thing the same way. If a shared
  key's Bengali does not fit one of its sites, mark it `# ?? ` — do not fork it.

### 3.1 The objects

| English | Bengali | Note |
| --- | --- | --- |
| book | বই | |
| film, movie | সিনেমা | **Never চলচ্চিত্র** — that is the newsprint register this sheet exists to keep out |
| show (TV) | শো | ধারাবাহিক means a daily soap; সিরিজ is reserved for the next row. 2 clusters, which the `SHOW` badge slot needs |
| game | গেম | খেলা would mean a match |
| title (a catalogue row) | টাইটেল | No Bengali word spans film + show + game; this is the gap-filling loan §4 allows |
| work (the thing a quote came from) | উৎস | The app's own quiz calls it "the source" — *কোন উৎস থেকে* |
| series / collection / franchise | সিরিজ | **One word for both** — `en.txt` itself says a collection is "the film side of the Library's series". *হ্যারি পটার সিরিজ* is what a Bengali says |
| quote (all three kinds) | উদ্ধৃতি | §2.5 |
| highlight / annotation | দাগ | §2.2 |
| dialogue / film line | সংলাপ | §2.3 |
| standalone quote | উক্তি | §2.4 |
| note (the reader's own) | নোট | টীকা and টিপ্পনী are both barred (§2.1); নোট is what a Bengali says |
| tag | ট্যাগ | |
| sticker | স্টিকার | |
| seal (a sticker pinned to a quote) | স্টিকার | v3: one word for the file and the pinned copy — সিল read as a rubber stamp, and the reader pins "a sticker" |
| board | বোর্ড | |
| anthology | সংকলন | The exact Bengali word for a curated gathering of writings. Do not use সংকলন for anything else |
| entry (of an anthology, of the bin) | এন্ট্রি | |
| shelf | তাক | |
| cover | কভার | প্রচ্ছদ is not wrong, but কভার keeps the কভার/পোস্টার pair in one register |
| poster | পোস্টার | |
| picture / image (the share format) | ছবি | |
| portrait (a person's photo) | মুখের ছবি | Distinguished from ছবি because the share sheet shows both at once |
| bin | বিন | |
| proverb | প্রবাদ | |
| speech | ভাষণ | |
| letter (correspondence) | চিঠি | |

### 3.2 People

| English | Bengali | Note |
| --- | --- | --- |
| author | লেখক | |
| translator | অনুবাদক | |
| editor (of a book) | সম্পাদক | |
| speaker | বক্তা | |
| character | চরিত্র | |
| actor | অভিনেতা | |
| director | পরিচালক | |
| creator (of a show) | নির্মাতা | |
| studio | স্টুডিও | |
| publisher | প্রকাশক | |
| people (the Metadata / Stats section) | মানুষ | ব্যক্তি is a form-filling word; মানুষ is warm and right for a screen of portraits |
| user | ইউজার | **Not ব্যবহারকারী** — nobody says it outside software (§4) |
| admin | অ্যাডমিন | |
| reader (the name fallback) | পাঠক | `greeting.name-fallback`, `shell.login.reader.fallback` |

### 3.3 Fields and locators

| English | Bengali | Note |
| --- | --- | --- |
| title (of a book/film) | নাম | The field, not the catalogue row — that is টাইটেল above |
| year | সাল | A calendar year. Use বছর only for a duration ("2 years") |
| decade | দশক | |
| century | শতক | |
| date | তারিখ | |
| genre | ঘরানা | The Bengali word film and music criticism actually uses. **Not জেনার, not ধরন** (which is taken) |
| type (media type) | ধরন | |
| chapter | অধ্যায় | Narrow slot: **অধ্যা.** |
| page | পৃষ্ঠা | Narrow slot: **পৃ.** |
| location (the Kindle locator) | লোকেশন | |
| timestamp / time | সময় | One Bengali word for the app's two English ones |
| season | সিজন | |
| episode | এপিসোড | |
| occasion | উপলক্ষ | |
| place | জায়গা | |
| medium | মাধ্যম | |
| language | ভাষা | |
| translation | অনুবাদ | |
| description | বিবরণ | |
| colour | রং | |
| colour category (the six named slots) | রঙের ঘর | ঘর = a slot, a pigeonhole. Where the English says just "category" meaning this, write **রং** |
| ISBN / ASIN / TMDB id | ISBN / ASIN / TMDB id | §8 — never transliterated |

### 3.4 Actions

The button-grammar rule is in §5.4. These are the words.

| English | Bengali | Note |
| --- | --- | --- |
| save | সেভ | Busy: **সেভ হচ্ছে…** |
| cancel | বাতিল | |
| delete | মুছুন | **Not ডিলিট** — মুছুন is universal and shorter |
| remove | সরান | Distinct from মুছুন: সরান takes it off, মুছুন destroys it |
| restore (bin and backup alike) | ফিরিয়ে আনুন | One word for both, since `common.action.restore.label` serves both |
| undo | আনডু | |
| edit | এডিট | **Not সম্পাদনা** — that is what you do to a newspaper |
| add | যোগ করুন | |
| create | তৈরি করুন | |
| apply | বসান | Busy: **বসানো হচ্ছে…** |
| copy | কপি | Done state: **কপি হয়েছে ✓** |
| share | শেয়ার | |
| export | এক্সপোর্ট | |
| import | ইমপোর্ট | |
| upload | আপলোড | |
| download | ডাউনলোড | |
| search (noun / the tab) | খোঁজ | **Not সার্চ** — Bengalis genuinely say *বইটা খুঁজছি* (§4's test) |
| search (verb) | খুঁজুন | |
| filter (noun and verb) | ফিল্টার / ফিল্টার করুন | Nobody "ছাঁকে" a book list; this loan passes §4's test |
| sort | সাজান | |
| group by | ভাগ | *কী দিয়ে ভাগ করা হবে* |
| select / deselect | বাছুন / বাছাই তুলুন | **Not নির্বাচন করুন** (bureaucratic) |
| show / hide | দেখান / লুকান | v3: the one-word imperative on a button; লুকিয়ে রাখুন only where a sentence means "keep it hidden" |
| close | বন্ধ করুন | |
| confirm | নিশ্চিত করুন | |
| done (the button that closes a step) | হয়ে গেছে | v3: শেষ is the shelf state (§3.6); a button that says "I am finished here" says হয়ে গেছে |
| got it | বুঝেছি | |
| fetch (metadata) | আনুন | *মেটাডেটা আনুন* |
| fill gaps | ফাঁক ভরান | |
| re-verify | আবার মিলিয়ে দেখুন | |
| merge | এক করুন | |
| re-sync | আবার সব আনুন | |
| capture (a quote) | তুলে রাখুন | *তুলে রাখা* is exactly the Bengali for copying a line out and keeping it. This is the best word in the sheet — use it |
| approve / discard | মেনে নিন / ফেলে দিন | |
| skip | বাদ দিন | |
| reveal | দেখান | |
| move up / move down | উপরে তুলুন / নিচে নামান | |
| shelve | তাকে তুলুন | |
| reload | রিলোড করুন | v3: the word a Bengali says at a browser |
| log out / sign in | লগ আউট / লগ ইন | |
| reset | আগের মতো করুন | **Not রিসেট করুন** where "back to defaults" is meant |

### 3.5 The quiz and the memory model

| English | Bengali | Note |
| --- | --- | --- |
| quiz | কুইজ | |
| Daily quiz | রোজকার কুইজ | **Not দৈনিক** (newsprint) |
| Practice (the named mode) | প্র্যাকটিস | A proper noun for a mode |
| practise (the verb on a button) | ঝালিয়ে নিন | **Bengali wins here.** `en.txt` says the Practice/Practise split is one "no other language can reproduce" — Bengali reproduces it exactly, with a noun for the mode and a native verb for the act |
| review (the schedule, the deck) | রিভিশন | What every Bengali student calls precisely this |
| deck | ডেক | |
| card | কার্ড | |
| streak | টানা | *টানা 12 দিন* |
| score | স্কোর | |
| half-life | অর্ধায়ু | In prose: *স্মৃতির অর্ধায়ু*. School-science Bengali, and short |
| forgetting curve | ভুলে যাওয়ার রেখা | **Not বিস্মৃতি বক্ররেখা** (a textbook decoding exercise) |
| spaced repetition | ফাঁক রেখে পুনরাবৃত্তি | |
| remembered | মনে আছে | |
| forgetting | ভুলছেন | |
| probably forgotten | সম্ভবত ভুলে গেছেন | |
| not yet reviewed | এখনও রিভিশন হয়নি | |
| Got it / Forgot (the grades) | পেরেছি / ভুলে গেছি | **First person** — these are your own answers |
| Multiple choice | বহুনির্বাচনী | The school word every Bengali knows |
| Fill in the blank | শূন্যস্থান পূরণ | The exam-paper phrase. Deliberately different from ফাঁক ভরান (metadata) so the two never read as one feature |
| Flip and self-mark | উল্টে নিজে বিচার | |
| Who said this? | কে বলেছে? | |
| Name the source | কোন উৎস? | |
| Pick the quote | কোন লাইনটা? | |
| due now | এখনই দরকার | |
| set it aside | সরিয়ে রাখুন | |

**Whose fact is it?** A shelf state describes the *book* (§3.6 — পড়া চলছে). A memory state
describes *you* (ভুলছেন). A grade is *your own answer* (পেরেছি). Keep the person inside each
family consistent; do not mix them.

### 3.6 Shelf states and progress

Third person, about the work — because a chip labels the book, not the reader, and six chips
in three persons is exactly the drift this sheet exists to prevent.

| English | Bengali | Note |
| --- | --- | --- |
| Wishlist | উইশলিস্ট | |
| Reading / Watching / Playing | পড়া চলছে / দেখা চলছে / খেলা চলছে | The app forks these by medium; so does Bengali |
| Paused | থেমে আছে | |
| Abandoned | ছেড়ে দেওয়া | |
| Completed | শেষ | |
| Mark as read / watched / played | পড়া শেষ / দেখা শেষ / খেলা শেষ | |
| Read it again / Watch it again | আবার পড়ুন / আবার দেখুন | |
| Pick it back up / Carry on watching | আবার ধরুন / দেখা চালান | |
| Give up on it | ছেড়ে দিন | |
| progress | কতদূর | *কতদূর পড়েছেন* — the native phrase, and short |
| read log / watch log | পড়ার খাতা / দেখার খাতা | খাতা = a ledger. **Not হিসেব**, which is the Stats tab |
| still going | চলছে | |
| ×N re-reads | ×{n} | §8 — a symbol |

### 3.7 Screens, chrome and gestures

| English | Bengali | Note |
| --- | --- | --- |
| Home | হোম | |
| Library | লাইব্রেরি | |
| Catalogue | ক্যাটালগ | |
| Quotes (the tab) | উক্তি | §2.5 — the tab holds only standalone quotes |
| Anthologies | সংকলন | |
| Tags | ট্যাগ | |
| Metadata | মেটাডেটা | |
| Stats | হিসেব | Warm and native for a screen of counts |
| Settings | সেটিংস | |
| Profile | প্রোফাইল |  |
| Account | অ্যাকাউন্ট | |
| Search (the tab) | খোঁজ | |
| Pending import | অপেক্ষায় ইমপোর্ট | |
| The bin | বিন | |
| Activity (the calendar) | ক্যালেন্ডার | v3: the help panel had always called the same grid *Calendar*; heading, tab tip and help term now say one word. রোজনামচা was lovely and nobody looked for it |
| Memory | স্মৃতি | |
| Breakdown | কে কত | Deliberately non-literal: the section is "the authors and tags your library leans on", and this is how a Bengali subhead says it. `breakdown kind` → *কীসের হিসেব* |
| Superlatives | সবচেয়ে | |
| Timeline | সময়রেখা | |
| Coverage | ঘাটতি | One word for "how many are missing each field" |
| Duplicates | ডুপ্লিকেট | |
| Feature (a section switch) | ফিচার | |
| Section | বিভাগ | |
| Screen | স্ক্রিন | |
| Tab | ট্যাব | |
| Tab strip | ট্যাব-সারি | |
| Top bar / bottom bar | উপরের বার / নিচের বার | |
| Drawer | ড্রয়ার | |
| Chip | চিপ | |
| Sheet (a full-screen surface) | প্যানেল | |
| Toast (in prose only) | বার্তা | Never a label; it appears inside sentences like "The toast offers an Undo" → *নিচের বার্তায় আনডু থাকবে* |
| View (tiles / list / table) | ভিউ | |
| Tiles / List / Table | টাইল / তালিকা / টেবিল | |
| Info dot | ইনফো ডট | v3: ডট wherever a dot is meant. ফুটকি is homely and dated — nobody under sixty says it about a screen |
| Status dot | স্মৃতির ডট | |
| Hover label | হোভার লেবেল | |
| Keyboard shortcut | কীবোর্ড শর্টকাট | |
| Long press | চেপে ধরা | |
| Swipe left / up | বাঁয়ে সোয়াইপ / উপরে সোয়াইপ | |
| Pinch in / out | পিঞ্চ ইন / পিঞ্চ আউট | A borrowed gesture keeps its borrowed name |
| Two fingers left | দুই আঙুলে বাঁয়ে | |
| Theme | থিম | |
| Light / Dark | হালকা / গাঢ় | |
| Match system | সিস্টেম যেমন | |
| Accent | অ্যাকসেন্ট | |
| Type (the typography card) | ফন্ট | v3: the card’s title is the thing it sets. হরফ stays for a *script* or letterform in prose — রোমান হরফে, বাংলা হরফ |
| Font | ফন্ট | |
| Backup / restore | ব্যাকআপ / ফিরিয়ে আনা | |
| Password / passphrase / username | পাসওয়ার্ড / পাসফ্রেজ / ইউজারনেম | |
| Source (a metadata supplier) | সূত্র | *সূত্র: গুগল বুকস* — how Bengali journalism cites. Distinct from উৎস (the work) |
| Favourite | প্রিয় | **Not ফেভারিট.** *♥ প্রিয়* |
| Margin | মার্জিন | The epigraphs live here |
| Tour / Onboarding | ট্যুর / প্রথম পরিচয় | |

That is 130 rows. If your word is not among them, §3's opening paragraph tells you what to do.

---

## §4. THE LOANWORD RULE

### 4.1 The rule, in one test

> **Would a Bengali speaker use this Bengali word for this act or thing in conversation,
> away from a screen?**
>
> **Yes → use the Bengali word.** **No → use the loan, in Bengali script.**

That is the whole rule, and it decides the awkward cases correctly. *খোঁজা* passes — a
Bengali says *বইটা খুঁজছি*. *ছাঁকা* fails — nobody sieves a book list, so **ফিল্টার**.
*মুছে ফেলা* passes — so **মুছুন**, not ডিলিট. *ব্যবহারকারী* fails — it exists only inside
translated software, so **ইউজার**.

The test is asymmetric on purpose, and both directions matter:

- **An over-Sanskritised coinage is the worse failure**, because the reader has to decode it
  before they can act. *বিস্মৃতি বক্ররেখা* costs a beat of thought; *ভুলে যাওয়ার রেখা* costs
  none. If a word would need a gloss, it is the wrong word.
- **An unnecessary loan is the lazier failure.** It costs nothing to read but it throws away
  a word the reader already owns, and three writers reaching for loans will reach for
  different ones.

**Never leave a loan in Latin script.** কভার, not cover. The only Latin in `bn.txt` is the
never-translate list in §8.

### 4.2 Ten that stay as loans, in Bengali script

| Loan | Why the Bengali would be wrong |
| --- | --- |
| কভার / পোস্টার | পোস্টার has no Bengali at all, and splitting the pair across registers is worse than borrowing both |
| ট্যাগ | চিহ্ন / আখ্যা are both something else; ট্যাগ is what people say |
| ফাইল | নথি is an office file, not a `.md` |
| ইমপোর্ট / এক্সপোর্ট | আমদানি / রপ্তানি are trade words. Comic here |
| সেটিংস | বিন্যাস / সংস্থাপন are decode-me words |
| কুইজ | পরীক্ষা is an exam, and this is not one |
| ইউজার | ব্যবহারকারী exists only in translated software |
| এডিট | সম্পাদনা is what you do to a newspaper |
| সিনেমা | চলচ্চিত্র is the register of a government film-board notice |
| ফিল্টার | Nobody strains a list. This is a borrowed control and it keeps its borrowed name |

Also loans, on the same reasoning: বোর্ড, স্টিকার, সিল, নোট, সেভ, কপি, শেয়ার, আপলোড,
ডাউনলোড, মেটাডেটা, ব্যাকআপ, পাসওয়ার্ড, অ্যাকাউন্ট, অ্যাডমিন, আনডু, বিন, ডেক, কার্ড, স্কোর,
চিপ, ভিউ, টাইল, টেবিল, ফন্ট, থিম, সিজন, এপিসোড, লোকেশন, শো, সিরিজ, গেম, টাইটেল, স্টুডিও,
ট্যুর, প্র্যাকটিস, রিভিশন, ক্যালেন্ডার, ড্রয়ার, প্যানেল, সোয়াইপ, পিঞ্চ, ডুপ্লিকেট।

### 4.3 Ten that get real Bengali, and the loan that is barred

| English | Bengali | The barred loan | Why |
| --- | --- | --- | --- |
| search | খোঁজ / খুঁজুন | ~~সার্চ~~ | *খোঁজা* is core everyday Bengali for looking for a thing |
| favourite | প্রিয় | ~~ফেভারিট~~ | প্রিয় is warmer, shorter and exact |
| delete | মুছুন | ~~ডিলিট~~ | *মুছে ফেলা* is what you do to writing |
| page | পৃষ্ঠা (পৃ.) | ~~পেজ~~ | Every Bengali book prints পৃ. |
| chapter | অধ্যায় | ~~চ্যাপ্টার~~ | Ditto |
| author / actor / director | লেখক / অভিনেতা / পরিচালক | ~~অথর / অ্যাক্টর / ডিরেক্টর~~ | All three are ordinary Bengali; the loans are film-magazine slang |
| genre | ঘরানা | ~~জেনার~~ | ঘরানা is what Bengali criticism uses |
| colour | রং | ~~কালার~~ | |
| shelf | তাক | ~~শেলফ~~ | |
| anthology | সংকলন | ~~অ্যান্থোলজি~~ | সংকলন is exactly this and nothing else |
| progress | কতদূর | ~~প্রোগ্রেস~~ | *কতদূর পড়েছেন* — the native phrasing, and it fits the slot |

### 4.4 Ten coinages named so nobody reinvents them

These are what a dictionary or a machine will hand you. Each is barred, with what to write
instead:

~~চলচ্চিত্র~~ → সিনেমা · ~~ব্যবহারকারী~~ → ইউজার · ~~সংরক্ষণ করুন~~ → সেভ ·
~~সম্পাদনা~~ → এডিট · ~~অনুসন্ধান~~ → খোঁজ · ~~পরিসংখ্যান~~ → হিসেব ·
~~রেখাঙ্কন / আলোকপাত~~ → দাগ · ~~নির্বাচন করুন~~ → বাছুন · ~~অপসারণ করুন~~ → সরান ·
~~প্রদর্শন করুন~~ → দেখান · ~~বিন্যাস~~ → সাজান · ~~বিস্মৃতি বক্ররেখা~~ → ভুলে যাওয়ার রেখা ·
~~পুনরুদ্ধার করুন~~ → ফিরিয়ে আনুন · ~~অনুগ্রহপূর্বক~~ → (delete it; Bengali UI does not say please)

---

## §5. SENTENCE STRATEGY

### 5.1 The four moves, before the examples

Bengali is SOV and postpositional. A clause order carried from English is the clearest
possible tell that a line was translated, and it is also what breaks the length budget
(§6). Four moves fix almost everything:

1. **The verb goes last.** So an English sentence whose punchline is at the end must be
   *restructured*, not re-ordered — because in Bengali the end of the sentence is reserved
   for the verb, not for the point.
2. **Prepositions become postpositions, after the noun.** *with its quotes* → *তার
   উদ্ধৃতি নিয়ে*. Never string *সহ* through a sentence the way English strings *with*.
3. **Relative clauses take the যে…সে correlative, at the front.** English hangs a
   qualifying clause off the back of a noun (*every book you have nothing from yet*);
   Bengali puts the যে-clause first and picks it up with সে/সেটা. A trailing participle
   chain (*এখনও কিছু রাখা হয়নি এমন প্রতিটি বই*) is the calque's signature.
4. **Break an em-dash appositive into its own short sentence** when the second half carries
   a new verb. Bengali takes the dash fine, but a dash plus a full second predicate reads
   as two sentences with the stop missing.

### 5.2 Three worked examples

Each is a real string from `internal/i18n/en.txt`. Lengths are `String.length`, which is
what `help-budget.test.js` measures; `.what` is capped at 160.

---

**A. `home.help.daily-quiz.what`** — 145 characters of English

> A short multiple-choice round over your own quotes, scheduled on the forgetting curve —
> each card comes back right as you would start to lose it.

*Calque — **165 characters, and it fails the test:***

> আপনার নিজের উদ্ধৃতিগুলির উপর একটি সংক্ষিপ্ত বহুনির্বাচনী রাউন্ড, বিস্মৃতি বক্ররেখার উপর নির্ধারিত — প্রতিটি কার্ড ঠিক তখনই ফিরে আসে যখন আপনি এটিকে হারাতে শুরু করবেন।

*Written in Bengali — **118 characters:***

> নিজের উদ্ধৃতি নিয়ে ছোট একটা রাউন্ড — উত্তর বেছে নেওয়ার ধাঁচে। ভুলতে শুরু করার ঠিক মুখেই কার্ডটা আবার সামনে এসে পড়ে।

*What moved:* **আপনার** dropped (§1.3). **-গুলির** dropped — no plural marker after a mass
reference. **উপর** dropped twice; the calque's *উদ্ধৃতিগুলির উপর* is a literal *over*, and
Bengali says *নিয়ে*. **নির্ধারিত** — a hanging passive participle with no agent — deleted
entirely, and the scheduling fact moved into the second sentence where it belongs.
**বিস্মৃতি বক্ররেখা** would have needed decoding, and the sentence does not actually need
the term: the *behaviour* is the point, and the term itself is a linked label elsewhere
(`home.states.help.curve.label`). **যখন…করবেন** — a trailing English *as*-clause — became
a front-loaded *ভুলতে শুরু করার ঠিক মুখেই*, and the verb went to the end.

---

**B. `bin.help.what-is-here.what`** — 120 characters of English

> Everything you delete waits here first — a book with all its quotes, a film with its
> lines, or one highlight on its own.

*Calque — 142 characters:*

> আপনি যা কিছু মুছে ফেলেন সবকিছু প্রথমে এখানে অপেক্ষা করে — তার সমস্ত উদ্ধৃতি সহ একটি বই, তার লাইনসমূহ সহ একটি চলচ্চিত্র, অথবা একা একটি হাইলাইট।

*Written in Bengali — 106 characters:*

> মুছে ফেলা সবকিছু আগে এখানেই জমা থাকে — গোটা বই তার সব দাগ নিয়ে, সিনেমা তার সংলাপ নিয়ে, বা শুধু একটা দাগ।

*What moved:* **আপনি যা কিছু…** — a whole English relative clause — collapsed into the
participle *মুছে ফেলা*, which is how Bengali says it in three syllables. **অপেক্ষা করে** is
a calque of *waits*; Bengali says *জমা থাকে* of a thing being held somewhere. **সহ** twice →
**নিয়ে** twice, after the noun (§5.1.2). **-সমূহ** deleted. **চলচ্চিত্র → সিনেমা**,
**হাইলাইট → দাগ** (§3, §4). **একা একটি হাইলাইট** was word-level nonsense; *শুধু একটা দাগ*
is the meaning. And *এখানেই* — the emphatic *-ই* — carries the English *first* without a
word for it.

---

**C. `settings.features.intro.prose`** — 114 characters of English

> Turn off what you do not keep, and on what you have not tried yet. This changes what you
> see, never what you have.

*Calque — 136 characters:*

> আপনি যা রাখেন না তা বন্ধ করুন, এবং যা আপনি এখনও চেষ্টা করেননি তা চালু করুন। এটি আপনি যা দেখেন তা পরিবর্তন করে, আপনার যা আছে তা কখনও নয়।

*Written in Bengali — 106 characters:*

> যেটা কাজে লাগে না, বন্ধ করে দিন; যেটা এখনও দেখেননি, চালু করুন। এতে চোখের সামনেরটা বদলায়, জমানো কিছুই নয়।

*What moved:* the English's parallel is *turn off X, and on Y* — a gapped construction
Bengali cannot gap. So it becomes a true **যেটা…, verb; যেটা…, verb** parallel with a
semicolon, which is stronger in Bengali than in English. **এটি** at the head of the second
sentence — the giveaway translated *This* — became *এতে*. **পরিবর্তন করে → বদলায়**: one
Bengali verb for an English light-verb phrase, and this trade is available almost every
time you see `-করে`. **আপনার যা আছে তা কখনও নয়** → *জমানো কিছুই নয়*: the app's own idea is
*what you have collected*, and Bengali has a participle for it.

### 5.3 Punctuation, in the same spirit

- The em dash survives where it introduces an appositive list (example B). It does **not**
  survive where the second half is a full clause with its own verb (example A) — that
  becomes a দাঁড়ি and a new sentence.
- A semicolon is stronger in Bengali than in English for a two-part parallel (example C).
  Use it.
- `en.txt` allows a `.what` at most two sentences. The test's sentence-counter looks for a
  capital letter after a stop, so **it cannot see Bengali at all** — the check is honestly
  inert for you. Hold yourself to two sentences anyway; the cap in §6 is the only thing
  that will catch you otherwise.
- Info dots (`*.info.body`) are capped at 240 characters and at four sentences. The same
  counter, the same blindness. Three sentences, please.

### 5.4 Button and label grammar — decided

**A button is an action word, not a sentence.** Use the bare form where Bengali has one
(সেভ, বাতিল, কপি, শেয়ার, ইমপোর্ট, এক্সপোর্ট, ফিল্টার, খোঁজ, এডিট); use the polite
imperative **-উন / -ন** where Bengali has no natural bare noun (মুছুন, দেখুন, বাছুন,
আনুন, সাজান, বসান).

The test for which: **would a Bengali speaker say this word alone, in answer to "what does
this button do?"** If yes, it stands alone. If not, it takes করুন / -উন.

Everything else takes the imperative in full: hints, confirms, empty states, help
sentences, tooltips that are instructions rather than names.

Three more label rules:

- **A tooltip names the control or says what pressing it will do — it never describes the
  current state.** `en.txt` is explicit about the favourite toggle: it says *Add to
  favourites*, not *Not a favourite*. So: **প্রিয়তে রাখুন** / **প্রিয় থেকে সরান**.
- **`{noun}`, `{name}`, `{field}` and `{subject}` are dropped into a frame by the caller.**
  Bengali case markers attach to the noun, and you cannot see the noun. So write the frame
  so it needs no marker on the hole: *{noun} মুছুন* works; *{noun}কে মুছুন* will produce
  *বইকে মুছুন* and *উক্তিকে মুছুন* and one of them will be wrong. Keep the hole bare.
- **Five words or fewer on every label** (house rule). A করুন-compound counts as one word.

### 5.5 The set-pieces that are written, not translated

Four blocks in `en.txt` are voice, not information. Translating them word by word will
produce something limp. Re-write them as Bengali, keeping the *shape* and the length.

- **`greeting.epigraph.1–10`** — ten aphorisms about margins. These are the app's thesis.
  Write ten Bengali aphorisms that say the same ten things, in the same clipped shape. This
  is where **মার্জিন** and **টিপ্পনী** (the practice, §2.1) belong.
- **`greeting.bucket.*`, `greeting.weekend.*`, `greeting.sunday.*`** — time-of-day
  greetings with `{name}`. Keep them short and keep আপনি: *এখনও জেগে আছেন, {name}?*
- **`greeting.holiday.*`** — about 130 of them. **Do not translate a day's name; write the
  Bengali frame around it.** *Happy X* → **শুভ {day}**; *Marking X* → **আজ {day}**. Days
  that already have Bengali names get them: অমর একুশে, শহিদ দিবস, স্বাধীনতা দিবস, বিজয়
  দিবস, প্রজাতন্ত্র দিবস, গান্ধী জয়ন্তী, পয়লা বৈশাখ. Every other country's day is
  **transliterated into Bengali script**, not translated: বাস্তিল দিবস, ওয়েটাঙ্গি দিবস.
  Two lines in `en.txt` are already Bengali (`bd.02-21.2`, `in.04-14.1`) — keep them
  verbatim.
- **`stats.timeline.gap.*`** — fifteen wry one-liners about empty centuries, in four length
  tiers. Re-write, do not translate; keep the tier's length and the dry tone. They end in a
  দাঁড়ি like any Bengali sentence, and Bengali has no lower case to preserve.

---

## §6. LENGTH DISCIPLINE

### 6.1 The measured facts

Measured against real strings from this file:

- **Written in Bengali, a sentence runs about 0.8× the English by `String.length`, and
  about 0.55× by visible letters.** Bengali packs a syllable into a cluster where English
  spends two or three letters, so a well-written Bengali line is *shorter on screen* than
  the English it replaces. You have room.
- **A calque runs about 1.35× the good Bengali version** — 1.28×, 1.34× and 1.40× on the
  three examples in §5.2. **This is the point:** the budget is not tight, and if you are
  fighting it you have not written a Bengali sentence, you have translated an English one.
  Example A's calque failed the 160 cap; its Bengali cleared it by 42 characters.
- A Bengali cluster is about **1.6 code units**, so `String.length` overcounts Bengali
  relative to what the eye sees. Never estimate by eye when you are near a cap.

### 6.2 The caps, and where they are enforced

`web/frontend/test/pure/help-budget.test.js`, run over `bn.txt` as well as `en.txt`:

| Role | Cap (`String.length`) | Also |
| --- | --- | --- |
| `*.help.*.what` | **160** | at most 2 sentences |
| `*.help.*.how.N` | **120** | at most 3 lines, numbered 1..N with no gap |
| `*.help.*.more` | **420** | |
| `*.info.body` | **240** | at most 3 sentences (`infodot-copy.test.js`) |

`.what` may never be left out while `.more` is written — an entry whose visible half is its
own heading fails.

### 6.3 Controls, and the slots that will not stretch

**The rule for a label that must fit a control: it may not exceed the English's *visible
letter count*.** Count clusters, not code units — Bengali will usually come in well under.
Where it cannot, the shorter word wins over the more accurate one; `en.txt` says so itself
about the badges.

Named slots, with the decision made for you:

| Slot | English | Bengali | Rule |
| --- | --- | --- | --- |
| `common.badge.cover / poster / none` | COVER / POSTER / NONE | কভার / পোস্টার / নেই | ≤ 4 clusters. Small caps do nothing to Bengali; that is expected, not a bug |
| `common.badge.book / film / show / quote` | BOOK / FILM / SHOW / QUOTE | বই / সিনেমা / শো / উদ্ধৃতি | |
| `common.badge.director / created-by / studio` | DIR. / CREATED BY / STUDIO | পরি. / নির্মাতা / স্টুডিও | |
| `common.month.jan…dec` | Jan…Dec | জানু ফেব মার্চ এপ্রি মে জুন জুলা আগ সেপ অক্টো নভে ডিসে | ≤ 4 clusters; they sit in a 3-column grid |
| `common.locator.chapter` | CH. {name} | অধ্যা. {name} | |
| `common.locator.page` | P. {n} | পৃ. {n} | |
| `common.position.episode / episode-season` | E{a} / {a} · S{b} | **unchanged** | §8 — a one-letter code beside a Western digit is a symbol, not a word |
| `common.half-life.*` | {n}h {n}d {n}w {n}mo | **unchanged** | Same reasoning |
| `common.slider.multiplier` / `shelf.reads` | {n}× / ×{n} | **unchanged** | |
| `capture.help.import.flow.*` | file / pending / library / approve | ফাইল / অপেক্ষায় / লাইব্রেরি / মেনে নিন | Fixed 52–68px mono boxes. **Abbreviate rather than overflow** — and see §0.5: these draw in an OS fallback face |
| `common.progress.unit.*` | % / pages / episodes | % / পৃষ্ঠা / এপিসোড | |
| `common.mono.*` | colour, group, tag, speaker… | রং, ভাগ, ট্যাগ, বক্তা… | One word each; mono slot |

**Mono slots are the one place Bengali is at a disadvantage** (§0.5), so treat every mono
label as a hard budget: one word, as short as the sense allows, and if the Bengali needs two
words the slot is the reason to find a shorter one.

### 6.4 When you cannot get inside a cap

In order:

1. Cut the qualifier the English put in and Bengali does not need — *আপনার*, *একটি*,
   *এটি*, *-গুলো*, *সমস্ত*.
2. Replace a `-করে` light-verb phrase with the single Bengali verb (*পরিবর্তন করে* →
   *বদলায়*).
3. Move the second half into `.more` if the entry has one.
4. Only then mark it `# !! ` (§7) and leave the long line in. **Do not truncate to a
   fragment that no longer says the thing** — a half sentence inside the cap is worse than
   a full one over it, and the owner would rather see the flag.

---

## §7. THE MARKING CONVENTION

Markers are **comment lines directly above the key**, never inside the value — §0.2: the
parser ships everything after the first `=` to the screen, so an inline marker would appear
in the interface.

Two markers, both greppable, both distinct at a glance:

```
# ?? not sure "সিল" reads as a seal rather than a rubber stamp
common.action.seal.label = সিল

# !! 178 — could not get it under 160 without dropping the schedule fact
home.help.daily-quiz.what = …
```

- **`# ?? ` — I am not sure of this line.** Wording, term choice, register, whether a shared
  key can carry one Bengali word. Say what you are unsure of in one clause. If your doubt is
  about a *term*, also add the row to `## Additions` at the foot of this file so the other
  two writers see the same question once.
- **`# !! ` — this line is too long.** Give the character count first, then one clause on
  what you would have to lose to fit it. Use it for a control label that will not fit its
  slot as well as for a budget failure — the owner cannot see slot overflow from the file.

Both markers are **temporary**. Delete the comment when the doubt is resolved or the line is
cut; a marker left behind after the fix is a false alarm the owner has to re-check.

The owner scans for these first:

```
grep -n '^# [?!][?!]' internal/i18n/bn.txt
```

So put nothing else in a comment starting `# ?` or `# !`. Genuine translator context —
the notes that explain where a string appears — is copied down from `en.txt` verbatim, in
`en.txt`'s own order, as the README asks; those comments start with a capital or a dash and
will not collide.

---

## §8. NEVER TRANSLATE THESE

Not a style preference — each of these breaks something.

1. **`{phrase}` in the bulk delete confirms.** `src/bulkOps.jsx`'s `deletePhrase()` builds
   an **English** string (`delete 3 books`) because the **Go server compares it byte for
   byte**. Write the Bengali sentence so the reader understands they must type the words
   shown, and never gloss or translate the phrase itself: *নিশ্চিত করতে {phrase} লিখে
   দিন।* The file's own comment says translating it means changing both sides in one
   commit, which is not this pass.
2. **`common.filmstrip.edge.label = TIPPANI · SAFETY FILM`** — branding artwork. `en.txt`
   says DO NOT TRANSLATE. Leave it.
3. **`vocab.source.*`** — Google Books, Open Library, Amazon, TMDB, TheTVDB, IMDb, IGDB.
   Proper nouns. Transliteration is permitted; renaming is not. `vocab.source.unknown.label`
   *is* translated: **অজানা সূত্র**.
4. **`vocab.face.*.name`** — the eighteen typeface names. Transliteration permitted, and
   the `.note` beside each one *is* translated.
5. **The two script specimens** — `vocab.font-role.bengali.sample` (already Bengali; keep it
   verbatim) and `vocab.font-role.devanagari.sample` (must stay Devanagari). Every other
   `.sample` should be **replaced with a line this role would really carry in Bengali**, not
   translated — that is what a specimen is for.
6. **`vocab.key.*`** — ⌘, Ctrl, Space, Esc, Shift. The reader is looking at a keyboard, and
   the keyboard is in Latin. Same for every shortcut letter in `shell.shortcut.*`: `/`,
   `N`, `?`, `G then H/L/C/Q/S`, `1`, `2`. **`common.kbd.then.label` is a word and does
   translate: তারপর.**
7. **`common.field.date.placeholder = YYYY, YYYY-MM or YYYY-MM-DD`** — keep it Latin. The
   field accepts Western digits and hyphens, so the placeholder is a *picture of what to
   type*; বববব-মম-দদ would describe it in a script the field will never contain. Same for
   `film.line.form.timestamp.placeholder = HH:MM:SS`.
8. **Field identifiers as words** — ISBN, ASIN, TMDB id, TheTVDB id, IMDb id, IGDB id,
   API, PNG, SVG, `.md`, JSON, Markdown, Obsidian, WhatsApp, Reddit, Kindle, Goodreads,
   Docker, LAN, URL. All appear as themselves.
9. **Version numbers and dates** — `v{version}`, `1.17.0`, `2026-07-14`.
10. **The search grammar tokens.** `search.help.colon.how.1` and `.how.2` list the field
    prefixes the box accepts: `tag: author: colour: speaker: actor: character: director:
    genre: series: shelf: year: favourite: note: wishlist: book: movie:`. **The parser
    accepts these English words. Leave every one of them exactly as it is** — a Bengali
    reader typing *ট্যাগ:* would get nothing. The *prose* around them is translated; the
    tokens are not. The same goes for `note\:` in `search.help.escaped-colon.more`.

---

## §9. Working order

1. Copy `en.txt`'s structure into `bn.txt`: **same key order, same section banners, same
   context comments**, as the README asks — so the two files read side by side.
   The `_TEMPLATE.txt` the app writes into `data/Locales/` lists every key with the English as a comment, which
   is the mechanical way to see what is still missing.
2. Fill values. **An empty value counts as absent**, so a key you have not reached costs you
   nothing but coverage — the picker reports the real percentage and no test fails for
   incompleteness.
3. Never add a key `en.txt` does not have, and never delete one it does.
4. Before handing in: run the two budget tests (§0), then
   `grep -n '^# [?!][?!]' internal/i18n/bn.txt` and read your own flags back. If a flag no
   longer applies, delete it.

---

## Additions

*(Writers: append a row here for any term not in §3. English | your Bengali | one line of
reason. Then mark the key `# ?? `.)*

### From writer 1 (the shell and the controls)

| English | Bengali | Reason |
| --- | --- | --- |
| move (to a board, to a shelf) | পাঠান | §3.4 gives *remove* → সরান, so Move cannot also be সরান. *বোর্ডে পাঠান* is what a Bengali says |
| set (the small commit button in the progress editor) | দিন | *apply* is already বসান; this button just puts a number in |
| window (a pop-up over the screen) | উইন্ডো | §3.7 has প্যানেল for a full-screen sheet; a floating window is not that |
| item | জিনিস | The generic countable. আইটেম is an avoidable loan |
| issue (a metadata console finding) | সমস্যা | |
| row (of a table) | সারি | |
| outcome (finished / abandoned) | পরিণতি | The read log's third column |
| interface (the font role) | ইন্টারফেস | Marked `# ?? ` — a mouthful, but the role's name |
| default (colour slot 1's name) | সাধারণ | v3 settled the `# ?? `: beside five Bengali category names the loan read as the odd one out, and "the ordinary slot" is what this one is |
| flip card | উল্টানো কার্ড | §3.5 has *flip and self-mark* → উল্টে নিজে বিচার; the card itself needed a noun |
| adaptive (the interval mode) | অ্যাডাপ্টিভ | v3: the loan is the word the reader has met in every app that has the feature; card title *অ্যাডাপ্টিভ ফাঁক* |
| ladder (the 7 → 30 → 100 interval ladder) | সিঁড়ি | The metaphor is the same one in Bengali |
| appearance (the Settings card) | চেহারা | |
| help (the sheet) | সাহায্য | |
| style (the font-modifier card, a tag’s drawing style) | স্টাইল | v3. ধাঁচ survives only in the typeface notes, where it means a face’s look (*চৌকো ধাঁচ*) |
| auto | অটো | |
| tools (the second nav landmark) | সরঞ্জাম | |
| unit (progress unit) | একক | |
| BCE / circa | খ্রি.পূ. / আনু. | Both go BEFORE the year in Bengali, which is why en.txt keys all four year shapes |
| tabular figures (the English said "lining" until v3) | সারিবদ্ধ সংখ্যা | Says what `tabular-nums` does rather than naming the feature — which is why the Bengali did not have to change when the English was corrected |
| Latin (the script) | লাতিন | |

### From the migration of the eight unreached files

| English | Bengali | Reason |
| --- | --- | --- |
| flyout (a tag chip shape) | নিশান | The shape is a pennant, notched to a point underneath. ফ্লাইআউট is a loan that means nothing away from a screen; v3 kept নিশান |
| banner (a tag chip shape) | ব্যানার | A horizontal strip notched on the right; the loan is what a Bengali says for a strip that hangs |

### From the last three screens (StagingPage, MetadataPage, Settings)

The pass that closed the migration. Every row here is marked `# ?? ` at its key
except where noted.

| English | Bengali | Reason |
| --- | --- | --- |
| queue (the list of things waiting) | অপেক্ষার তালিকা | §3.7 has *Pending import* → অপেক্ষায় ইমপোর্ট but no word for the queue itself. Shortened to তালিকা where the header already says the rest. **Note it now does two jobs** — তালিকা is also §3.7's *List view* |
| staged (held in the pending queue) | জমা | §5.2's own worked example uses *জমা থাকে* for a thing being held somewhere, which is exactly this state |
| field (a form box or table column) | ঘর | v3: ঘর is what a Bengali calls a box on a form. রঙের ঘর keeps its own row, and the two never meet in one sentence |
| group (a cluster of rows) | গ্রুপ | Passes §4.1's conversation test outright. বিভাগ is §3.7's *Section*, and দল — which one agent reached for independently — also means a team or a party, which is misleading about two copies of one book. **One word, used by both screens** |
| formula (the location arithmetic) | ফর্মুলা | সূত্র is taken for a metadata source (§3.7) |
| operation (an arithmetic op in a Select) | কাজ | প্রক্রিয়া is the noticeboard register §1.1 keeps out, and the slot is mono, so one short word |
| range (a page span like 610-612) | রেঞ্জ | পরিসর is a shade formal for a page span |
| enriched (metadata fetched on approval) | মেটাডেটা পেয়েছে | No single Bengali verb; the phrase says what actually happened |
| un-♥ (the compact unfavourite button) | ♥ সরান | The English is itself a coinage; Bengali says *take the ♥ off* |
| maintenance | দেখভাল | রক্ষণাবেক্ষণ is exactly the noticeboard register §1.1 exists to keep out |
| console (a screen you work AT) | কনসোল | §3.7 has স্ক্রিন and প্যানেল, neither of which is this |
| detail (one filled metadata field) | তথ্য | The fetch tally counts *details filled*; খুঁটিনাটি is a mass noun and will not take টি |
| run (the button on a phone action card) | চালান | §3.4 has no row for it |
| flagged (a row with at least one gap) | সমস্যা আছে | Leans on *issue* → সমস্যা above; দাগানো would collide with দাগ (a highlight) |
| low-res | ঝাপসা | The homely word for a soft picture, two clusters, fits the mono tile where কম রেজলিউশন cannot |
| cast | কাস্ট | **Not marked** — `bn.txt` already said কাস্ট twice before this pass (`common.work.resync.info.body`, `film.fetch.info.body`). `common.field.cast.label` briefly said অভিনেতারা, a third word for one thing; corrected to match |
| editor (the form inside a console row) | এডিটর | §3.4 gives *edit* → এডিট but no noun for the form |
| look up (ask the sources about one row) | খুঁজে দেখুন | Distinct from খোঁজ (the Search tab) and from আনুন (*fetch*): this one only looks |
| remap (re-point a speaker at a cast member) | বদল | নতুন করে বসানো is accurate and unusable on a heading |
| mapping (one label paired with one member) | জোড়া | Also used by `error.validate.mapping-required` |
| reference page (an external page about a person) | তথ্যসূত্রের পাতা | v3: says what the link is for; পরিচিতির পাতা loses that these are external |
| amp (the & chip's spoken name) | অ্যান্ড চিহ্ন | অ্যাম্পারস্যান্ড is unreadable in a chip's aria and names a glyph nobody says aloud |
| and (the “and” chip's spoken name) | “and” শব্দ | The chip draws the English word the splitter actually matches (§8), so the Latin stays and only the frame around it is Bengali |
| roadmap | রোডম্যাপ | পরিকল্পনা is form-Bengali; রোডম্যাপ is what people say about a project's plan |
| pairing code | পেয়ারিং কোড | v3, with pair / unpair → *পেয়ার করুন / আনপেয়ার করুন*: the phone’s own Bluetooth screen taught the reader these words |

### From the stray-marks pass (`cleanup.*`)

Eight rule names and the page they sit on. All eight had to be nameable in a chip, so the
constraint was length as much as sense.

| English | Bengali | Reason |
| --- | --- | --- |
| stray marks (the screen) | বাড়তি চিহ্ন | v3: the marks are *extra* rather than untidy — বাড়তি says what the page finds. অবাঞ্ছিত is form-Bengali |
| footnote | পাদটীকা | A school word every reader owns, and the only Bengali for it. Not টীকা alone, which §2.2 keeps clear of টিপ্পনী |
| punctuation | যতিচিহ্ন | Also a school word. চিহ্ন alone is any mark at all |
| space (the typographic one) | স্পেস | v3: *জোড়া স্পেস*, *নো-ব্রেক স্পেস* — the key on the keyboard is what the reader knows. ফাঁক stays for the spaced-repetition interval |
| hyphen | হাইফেন | §4's gap-filling loan: Bengali has no everyday word for the mark, and যোজক চিহ্ন needs a gloss |
| pronunciation gloss | উচ্চারণের নির্দেশ | *উচ্চারণ* is everyday; the *নির্দেশ* is what makes it a dictionary's note rather than the act of speaking |
| invisible (of a character) | অদৃশ্য | Everyday, and exactly the point: the character is there and cannot be seen |
| dot (of an ellipsis) | ডট | The rule's copy names three dots rather than borrowing “ellipsis”, which nobody says. v3: ডট, like every other dot |

**Already in `bn.txt` from an earlier pass and therefore NOT marked**, listed only so
nobody re-decides them: Updates আপডেট · Changelog চেঞ্জলগ · version ভার্সন · release
রিলিজ · cookie কুকি. **Changed in v3:** API key and archive key are both **চাবি** (কি was a homonym of the question particle, and the two keys are one idea) · pair / unpair **পেয়ার করুন / আনপেয়ার করুন**.

---

## v3 decisions

The third pass (2.2.x) rewrote **every** line of `bn.txt` — 3,385 keys — from a per-key
dossier: the English, the context comment above it, the source line that renders it and
its budget. Its brief was that the app should read as if it had been written in Bengali
first, in **the written Bengali of today**. Everything above still holds — চলিত, আপনি with
the pronoun dropped, Kolkata orthography, দাগ / সংলাপ / উক্তি / উদ্ধৃতি, টিপ্পনী reserved.
What follows is what the pass added or changed, so nobody re-decides it.

### v3.1 The loanword rule, sharpened

§4 said a loan passes when a Bengali would say it in conversation. The earlier passes still
reached for a coined native word where the loan is what people actually write today. v3
rules the other way, and these are now binding:

| Say | Not | Where |
| --- | --- | --- |
| ডিভাইস | যন্ত্র | the phone, the paired device, "this device" |
| ট্যাপ করুন / ট্যাপ | ছুঁলে, টোকা দিন, চাপুন (for a touchscreen) | every touch instruction. চেপে ধরুন stays for long-press; চাপুন stays for a keyboard key |
| এনক্রিপ্ট করা | তালাবন্ধ, সাংকেতিক | backups, the recovery key |
| ডট | ফুটকি | the info dot, the memory dot, the calendar’s day, an ellipsis |
| ফন্ট | হরফ (as the card or the file) | the Type card, uploads, the face list. হরফ = a script or letterform in prose |
| স্টাইল | ধাঁচ | the font-modifier card, a tag’s drawing style |
| ফরম্যাট | ধাঁচ | the share sheet’s Markdown / WhatsApp / plain / Reddit / image formats |
| সাধারণ লেখা | সাদা টেক্সট, সাদা লেখা | the plain-text format |
| পটভূমি | ব্যাকড্রপ | the portrait behind a shared image |
| রিলোড করুন / রিস্টার্ট | আবার লোড করুন | the browser, the server |
| লিংক | লিঙ্ক | spelling — the one today’s print uses |
| স্ক্রিন | পর্দা | a screen of the app (§3.7 already said so; the older values had not caught up) |
| সিলেক্ট করা | বেছে নেওয়া | selecting *text* in an ebook or a browser. বাছুন stays for selecting cards |
| ইনডেক্স | সূচি | the search index |
| পেয়ার / আনপেয়ার | জুড়ুন / খুলে নিন | the Android app and this account |
| কনট্রাস্ট, টেক্সচার, কন্ট্রোল, রুটিন, কোয়েস্ট, স্পেস, হাইফেন | বৈসাদৃশ্য, বুনোট, নিয়ন্ত্রণ, সময়সূচি, অভিযান, ফাঁক, যোজক | as themselves |

Spelling that goes with it: **দুটো, তিনটে, কটা** — no apostrophe (দু’ / ক’ is a
generation older); **কোনও, এখনও, হয়নি, -গুলো, হিসেব, রং / রঙের, সবচেয়ে** as §1 already had them.

### v3.2 One word per thing

Six writers had left two or three Bengali words for one English one. These are now single:

| English | Bengali | Retired |
| --- | --- | --- |
| key (API key, recovery key) | চাবি | কি |
| seal | স্টিকার | সিল |
| Done (the button) | হয়ে গেছে | শেষ, ঠিক আছে |
| Hide | লুকান | লুকিয়ে রাখুন |
| Default (colour slot 1) | সাধারণ | ডিফল্ট |
| Adaptive | অ্যাডাপ্টিভ | মানানসই |
| Stray marks | বাড়তি চিহ্ন | এলোমেলো চিহ্ন |
| Coverage | ঘাটতি | — |
| field (a form box) | ঘর | ফিল্ড |
| Activity / the calendar | ক্যালেন্ডার | রোজনামচা |
| toast (in prose) | বার্তা | — |
| queue | অপেক্ষার তালিকা | — |
| schedule (the review schedule) | রুটিন | সময়সূচি |
| progress | কতদূর | — |

### v3.3 New terms

| English | Bengali | Reason |
| --- | --- | --- |
| Bio | জীবনী | The person page’s paragraph |
| Identity (the person page’s links block) | পরিচয় | |
| portrait | মুখের ছবি | Unchanged, and now used everywhere the English says portrait |
| reference pages | তথ্যসূত্রের পাতা | Says what they are for |
| preview | যেমন দেখাবে | A phrase, because প্রিভিউ names a feature and this names what the reader sees |
| Plain (the share format) | সাধারণ লেখা | |
| Backdrop | পটভূমি | |
| Show me (the flip card’s reveal) | দেখি | First person, like the grades (§3.5) |
| Shuffle (a random quote) | হঠাৎ একটা | Says what happens rather than naming the mechanism |
| Recent (the sort) | নতুন আগে | *newest first*, which is what the sort does |
| ungrouped | ভাগ নেই | |
| Quest (a game’s locator) | কোয়েস্ট | The gamer’s own word; অভিযান is an expedition |
| in rotation (a quote the quiz draws) | কুইজে ঘুরছে | |
| unattributed | সংগৃহীত | The word Bengali anthologies print under a line with no author |
| optional (a placeholder) | — ঐচ্ছিক | In prose: *না দিলেও চলে* |
| decade | {year}-র দশক | *1990-র দশক*; the English "1990s" has no Bengali shape |
| holidays | proper-noun days transliterated (বাস্তিল, ওয়েটাঙ্গি, আনজ্যাক); common-noun names by meaning (*শুভ স্বাধীনতা দিবস*) | A greeting is read aloud in the reader’s head |

### v3.4 Specimens and demo copy

- **The tour’s demo book** is গীতাঞ্জলি, song 1 — *আমার মাথা নত করে দাও হে তোমার চরণধুলার তলে।*
  (রবীন্দ্রনাথ ঠাকুর, meta *গান 1*). A Bengali reader’s first sight of a highlight should be a
  line they know. **The demo film stays Casablanca**, in English: a film line is a quotation
  too, and translating it would show the reader something the app never does.
- **Font-role samples**: the display, ui and hand roles show Latin, because those faces are
  Latin-only and Bengali in them falls through to the Bengali face (§8.5, `fonts.js`); the
  mono sample mixes both, because a locator line does.
- **Swatch names** are the colours a Bengali names things by, not translations of the hex:
  রোদ, কমলা, গোলাপি, পেঁয়াজি, লাল, ফিকে বেগুনি, বেগুনি, অপরাজিতা, আকাশি, ময়ূরকণ্ঠী, পুদিনা,
  পান্না, কচি পাতা, শ্যাওলা, মেটে, পাথর. Accents: পোড়ামাটি, গেরুয়া, জলপাই, স্লেট.

### v3.5 The file itself

- `bn.txt` says in its header that it is **not a translation of `en.txt`**, declares no
  `_fallback` (both languages ship in the box; neither is the other’s floor), and keeps
  `en.txt`’s key order, banners and context comments so the two read side by side.
- Comments starting **`# bn:`** record a decision the English side has no reason to make —
  why a specimen stays Latin, why one Bengali word serves two English ones. They are the
  only comments in the file that are not `en.txt`’s. The `# ??` / `# !!` markers of §7 are
  still the convention for doubt and overflow; v3 hands in none.
- The checks of `docs/plans/multilingual.md` were run again over the result: 0 সাধু markers,
  0 তুমি outside the Tagore line, 0 Bengali digits, 0 placeholder mismatches, every
  `.help.*` and `.info.body` inside its budget.
