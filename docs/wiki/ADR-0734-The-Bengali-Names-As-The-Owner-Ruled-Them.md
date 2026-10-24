# ADR-0734: The Bengali names, as the owner ruled them

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted

Every term below was decided by the owner reading the app in Bengali, not by translating
`en.txt`. They are recorded here because a naming decision is the one kind of design choice
that a later session cannot re-derive from the code: nothing in the file says why the Library
is a গ্রন্থাগার and not a লাইব্রেরি, and a rater with a style sheet will happily argue the
loanword back in. `docs/wiki/Bengali-style.md` carries the reasoning; this is the register.

Several of these reverse an earlier ruling in the same session. The last column says so where
it happened, because the reversals are the entries most likely to be "corrected" back.

| Thing in the app | Bengali | Note |
| --- | --- | --- |
| Library | গ্রন্থাগার | was লাইব্রেরি |
| Stats | পরিসংখ্যান | was হিসেব. হিসেব survives for a *record you can count*; হিসেবে is "as" |
| Checks (the screen) | যাচাইকরণ | first ruled তথ্য বিন্যাস, then reversed |
| Metadata | মেটাডেটা | |
| Quotes (the tab) | উক্তি | |
| Appearance (the section) | রূপচর্চা | was চেহারা |
| Material (the texture dial) | নকশা | was উপাদান |
| Devices | যন্ত্রপাতি | was ডিভাইস — the loanword rule does not reach this one |
| Changelog | কী বদলেছে | was চেঞ্জলগ |
| Pending import | যাচাই বাকি ইমপোর্ট | was অপেক্ষায় ইমপোর্ট |
| **Quiz** | **অনুশীলনী** | was কুইজ, then প্রশ্নোত্তর. The exercise set as a whole |
| — its multiple-choice card | প্রশ্নোত্তর | the type where a question is asked |
| — its cloze card | শূন্যস্থান পূরণ | the other type |
| **Review** (the schedule and the deck) | **অনুশীলন** | was রিভিশন, then রুটিন |
| — the schedule itself | দিনপঞ্জি | "review schedule" is অনুশীলনের দিনপঞ্জি |
| **Practice** (the mode) | **ঝালাই** | was প্র্যাকটিস, then অনুশীলন |
| — practise (the verb on a button) | ঝালিয়ে নিন | unchanged throughout |
| Daily | দৈনিক | was রোজকার — reverses the style sheet's own "newsprint" objection |
| Optional | ঐচ্ছিক | was না দিলেও চলে; six characters against twelve, and nearly always in a placeholder |
| Fill gaps (the metadata fetch) | শূন্যস্থান পূরণ | Deliberately the same words as the cloze card. The owner was shown the collision and kept it: both controls fill in a blank, and Bengali has one phrase for that |
| the bin | ডাস্টবিন | |
| a rule (Stray marks) | নিয়ম | |
| a credit | নাম | was কৃতিত্ব, which is credit in the sense of honour |
| a work | উৎস | |
| a person | ব্যক্তি | ruled to stand; মানুষ was offered and refused |
| a film | চলচ্চিত্র | ruled to stand alongside সিনেমা |

The four quote kinds, which are never interchangeable:

| Kind | Bengali |
| --- | --- |
| The Quotes tab and what lives on its boards | উক্তি |
| A line from a book, letter, essay or speech | উদ্ধৃতি |
| A proverb | প্রবাদ |
| A line from a film, show or game | সংলাপ |

The eight Appearance textures: পাণ্ডুলিপি, চলচ্চিত্রের রিল, অফিস, ইস্কুল, তাঁতঘর,
বাঁধাইয়ের দোকান, খাদান, অলিন্দ. ইস্কুল rather than বিদ্যালয় because the formal word is
wrong for a texture named after a place; খাদান rather than পাথরখাদান, তাঁতঘর rather than
শিল্পশালা, বাঁধাইয়ের দোকান rather than বাঁধাইখানা.

**Register, and the one rule the rulings produced.** চলিত throughout, Kolkata orthography,
আপনি with the pronoun usually dropped. `একটা` not `একটি`, `এটা`/`সেটা` not `এটি`/`সেটি`,
`গুলো` not `গুলি`, `কোনও` not `কোনো`, `যে কোনও` spaced, the classifier `টা` not `টি`, `সেভ`
not `সংরক্ষণ`. **অপেক্ষা is not used of objects** — Bengali অপেক্ষা presumes someone alive
doing the waiting, so a queue is `বাকি` (still to be done) or `পড়ে থাকা` (left lying).

And the rule that governs all of the above: **a register word is the owner's call, never a
sweep's.** `দৈনিক` is why. The style sheet had reasoned its way to the opposite word and
nothing in the file could have caught it, so every find-and-replace now goes to the owner in
batches of ten — key, English, current Bengali, proposal — before it runs. Two of the batches
came back reversing the sheet.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
