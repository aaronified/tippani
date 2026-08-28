#!/usr/bin/env node
// Fixture seeder for the screenshot scaffold: fills an empty Tippani account with a
// small, fixed library so the captures show populated screens instead of twelve empty
// states.
//
// WHY THIS EXISTS SEPARATELY FROM capture.mjs. A capture run must not decide what the
// data is — if seeding lived inside the capture loop, every screenshot would depend on
// the order the loop happened to run in, and a change to one fixture would silently move
// pixels on screens that have nothing to do with it. This writes the library once, up
// front, and then has no further part in the run.
//
// EVERYTHING HERE IS FIXED. No random ids, no `new Date()`, no counters that depend on
// how many times you have run it. Same server state in, same library out — which is what
// makes two capture runs comparable at all. `noted_at` values are explicit and all fall
// before capture.mjs's frozen clock (2026-01-01), so "3 months ago" style labels are
// stable rather than drifting a day per day.
//
// IT WRITES THROUGH THE PUBLIC API, not into SQLite. The same endpoints the SPA calls,
// with the same validation — a fixture the API would have rejected is a fixture that
// shows a state the app cannot actually reach, and a screenshot of an unreachable state
// audits clean while the real one is broken.
//
//   node seed.mjs --base-url http://127.0.0.1:8080
//   ./run-with-server.sh --seed --out ./out     (seeds, then captures)
//
// The account is created if the server is still on onboarding, otherwise logged into, so
// this can run before capture.mjs against the same scratch server.

import { bookCover, commonsImage, commonsPortraitURL } from './artwork.mjs'

// ---- the fixtures -----------------------------------------------------------------
//
// This block is the part to edit. The works are public-domain classics, and the art is
// real: `cover` is an Open Library cover id, `artwork` an exact Wikimedia Commons file
// title. See artwork.mjs for how they are fetched, cached, and why both are pinned
// identifiers rather than run-time searches.
//
// One fixture in each list is deliberately oversized: the long title, the long note, the
// long tag. `visual-verify`'s state table calls for a long-content capture because
// truncation bugs exist only in that state, and a library of tidy short strings is
// exactly the library that never finds one. The last book carries `nocover` for the same
// reason — a shelf with no art for a work is a state that has to render too.
//
// Statuses are spread deliberately across reading/completed/paused/abandoned and none at
// all, so the Library filters, the Stats screen and the shelf's progress bars all have
// something to show rather than one repeated value.

const TAGS = [
  { name: 'solitude', color: 'blue', style: 'sticker' },
  { name: 'the sea', color: 'green', style: 'sticker' },
  { name: 'memory', color: 'purple', style: 'sticker' },
  { name: 'first lines', color: 'orange', style: 'sticker' },
  { name: 'time', color: 'blue', style: 'sticker' },
  // The overflow case: a tag name at the long end of plausible, to catch chips that
  // assume one short word.
  { name: 'things worth reading twice', color: 'pink', style: 'sticker' },
]

const BOOKS = [
  {
    title: 'Moby-Dick; or, The Whale', author: 'Herman Melville', published_year: 1851,
    genres: ['Fiction', 'Adventure'], language: 'English', favorite: true, cover: 10544254,
    description: 'A whaling voyage told by its only survivor.',
    status: { status: 'reading', progress: 42, started_at: '2025-11-02' },
    annotations: [
      {
        quote: 'Call me Ishmael.',
        note: 'Three words and you already know who is talking and that he wants something from you.',
        color: 'orange', tags: ['first lines'], favorite: true,
        chapter: 'Loomings', chapter_no: 1, location: 'p. 3', noted_at: '2025-11-02T08:15:00Z',
      },
      {
        quote: 'Whenever I find myself growing grim about the mouth; whenever it is a damp, drizzly November in my soul; then, I account it high time to get to sea as soon as I can.',
        note: 'The long one. Kept whole on purpose — a note that wraps to four lines is the case a card layout gets wrong.',
        color: 'blue', tags: ['solitude', 'the sea'],
        chapter: 'Loomings', chapter_no: 1, location: 'p. 3', noted_at: '2025-11-02T08:20:00Z',
      },
      {
        quote: 'It is not down on any map; true places never are.',
        color: 'green', tags: ['the sea'],
        chapter: 'The Lee Shore', chapter_no: 23, location: 'p. 117', noted_at: '2025-11-19T21:40:00Z',
      },
    ],
  },
  {
    title: 'Pride and Prejudice', author: 'Jane Austen', published_year: 1813,
    genres: ['Fiction', 'Romance'], language: 'English', cover: 14348537,
    description: 'Five sisters, an entailed estate, and a man with ten thousand a year.',
    status: { status: 'completed', progress: 100, started_at: '2025-06-01', finished_at: '2025-06-28' },
    annotations: [
      {
        quote: 'It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.',
        note: 'The whole book argues with this sentence.',
        color: 'yellow', tags: ['first lines'], favorite: true,
        chapter: 'Chapter 1', chapter_no: 1, location: 'p. 1', noted_at: '2025-06-01T19:05:00Z',
      },
      {
        quote: 'I could easily forgive his pride, if he had not mortified mine.',
        color: 'pink', tags: ['memory'],
        chapter: 'Chapter 5', chapter_no: 5, location: 'p. 18', noted_at: '2025-06-04T20:11:00Z',
      },
    ],
  },
  {
    title: 'Frankenstein; or, The Modern Prometheus', author: 'Mary Shelley', published_year: 1818,
    genres: ['Fiction', 'Gothic'], language: 'English', cover: 12356249,
    status: { status: 'completed', progress: 100, started_at: '2025-07-05', finished_at: '2025-07-21' },
    annotations: [
      {
        quote: 'Nothing is so painful to the human mind as a great and sudden change.',
        color: 'purple', tags: ['memory'], chapter: 'Chapter 23', chapter_no: 23,
        location: 'p. 201', noted_at: '2025-07-19T22:30:00Z',
      },
    ],
  },
  {
    title: 'Dracula', author: 'Bram Stoker', published_year: 1897,
    genres: ['Fiction', 'Gothic'], language: 'English', cover: 12216503,
    status: { status: 'reading', progress: 15, started_at: '2025-12-20' },
  },
  {
    title: 'Jane Eyre', author: 'Charlotte Brontë', published_year: 1847,
    genres: ['Fiction'], language: 'English', cover: 8235363, favorite: true,
    status: { status: 'completed', progress: 100, started_at: '2025-04-02', finished_at: '2025-04-30' },
    annotations: [
      {
        quote: 'I am no bird; and no net ensnares me; I am a free human being with an independent will.',
        note: 'Said out loud, to his face.',
        color: 'orange', tags: ['things worth reading twice'], favorite: true,
        chapter: 'Chapter 23', chapter_no: 23, location: 'p. 284', noted_at: '2025-04-24T20:00:00Z',
      },
    ],
  },
  {
    title: 'Wuthering Heights', author: 'Emily Brontë', published_year: 1847,
    genres: ['Fiction'], language: 'English', cover: 12818862,
    status: { status: 'abandoned', progress: 34, started_at: '2025-02-10', finished_at: '2025-03-01' },
  },
  {
    title: 'Great Expectations', author: 'Charles Dickens', published_year: 1861,
    genres: ['Fiction'], language: 'English', cover: 13322313, series: 'Dickens', series_index: 1,
    status: { status: 'completed', progress: 100, started_at: '2025-01-08', finished_at: '2025-02-02' },
  },
  {
    title: 'A Tale of Two Cities', author: 'Charles Dickens', published_year: 1859,
    genres: ['Fiction', 'Historical'], language: 'English', cover: 13301713,
    series: 'Dickens', series_index: 2,
    annotations: [
      {
        quote: 'It was the best of times, it was the worst of times.',
        color: 'yellow', tags: ['first lines'], chapter: 'Book the First', chapter_no: 1,
        location: 'p. 1', noted_at: '2025-05-11T09:00:00Z',
      },
    ],
  },
  {
    title: 'Crime and Punishment', author: 'Fyodor Dostoevsky', published_year: 1866,
    genres: ['Fiction'], language: 'English', orig_language: 'Russian', cover: 13116014,
    status: { status: 'reading', progress: 61, started_at: '2025-11-28' },
  },
  {
    title: 'War and Peace', author: 'Leo Tolstoy', published_year: 1869,
    genres: ['Fiction', 'Historical'], language: 'English', orig_language: 'Russian', cover: 12621906,
    status: { status: 'paused', progress: 12, started_at: '2025-08-20' },
  },
  {
    title: 'Anna Karenina', author: 'Leo Tolstoy', published_year: 1878,
    genres: ['Fiction'], language: 'English', orig_language: 'Russian', cover: 2560652,
  },
  {
    title: 'The Picture of Dorian Gray', author: 'Oscar Wilde', published_year: 1890,
    genres: ['Fiction', 'Gothic'], language: 'English', cover: 14314858,
    status: { status: 'completed', progress: 100, started_at: '2025-03-14', finished_at: '2025-03-22' },
    annotations: [
      {
        quote: 'The only way to get rid of a temptation is to yield to it.',
        color: 'pink', chapter: 'Chapter 2', chapter_no: 2, location: 'p. 21',
        noted_at: '2025-03-15T18:45:00Z',
      },
    ],
  },
  {
    title: 'The Adventures of Sherlock Holmes', author: 'Arthur Conan Doyle', published_year: 1892,
    genres: ['Fiction', 'Mystery'], language: 'English', cover: 6717853,
    status: { status: 'completed', progress: 100, started_at: '2025-05-02', finished_at: '2025-05-20' },
  },
  {
    title: 'Heart of Darkness', author: 'Joseph Conrad', published_year: 1899,
    genres: ['Fiction'], language: 'English', cover: 12307847,
    status: { status: 'completed', progress: 100, started_at: '2025-09-02', finished_at: '2025-09-06' },
  },
  {
    title: 'The Time Machine', author: 'H. G. Wells', published_year: 1895,
    genres: ['Fiction', 'Science Fiction'], language: 'English', cover: 9009316,
    status: { status: 'completed', progress: 100, started_at: '2025-10-05', finished_at: '2025-10-08' },
    annotations: [
      {
        quote: 'There is no difference between Time and any of the three dimensions of Space except that our consciousness moves along it.',
        color: 'blue', tags: ['time'], chapter: 'Chapter 1', chapter_no: 1,
        location: 'p. 4', noted_at: '2025-10-05T21:00:00Z',
      },
    ],
  },
  {
    title: 'Treasure Island', author: 'Robert Louis Stevenson', published_year: 1883,
    genres: ['Fiction', 'Adventure'], language: 'English', cover: 13859660,
    status: { status: 'completed', progress: 100, started_at: '2025-07-24', finished_at: '2025-07-29' },
  },
  {
    title: 'Middlemarch', author: 'George Eliot', published_year: 1871,
    genres: ['Fiction'], language: 'English', cover: 252882,
    status: { status: 'reading', progress: 8, started_at: '2025-12-27' },
  },
  {
    title: 'Madame Bovary', author: 'Gustave Flaubert', published_year: 1856,
    genres: ['Fiction'], language: 'English', orig_language: 'French', cover: 12993424,
  },
  {
    // Ancient years are a real feature of this field — it accepts 4000 BCE through
    // 3000 CE — and nothing else in the library exercises a negative one.
    title: 'The Odyssey', author: 'Homer', published_year: -700, published_circa: true,
    genres: ['Poetry'], language: 'English', orig_language: 'Ancient Greek', cover: 12474938,
    status: { status: 'paused', progress: 45, started_at: '2025-06-30' },
  },
  {
    title: 'Walden', author: 'Henry David Thoreau', published_year: 1854,
    genres: ['Nonfiction'], language: 'English', cover: 11248037,
    status: { status: 'completed', progress: 100, started_at: '2025-08-01', finished_at: '2025-08-18' },
    annotations: [
      {
        quote: 'I went to the woods because I wished to live deliberately.',
        color: 'green', tags: ['solitude'], favorite: true,
        chapter: 'Where I Lived, and What I Lived For', chapter_no: 2,
        location: 'p. 88', noted_at: '2025-08-04T07:15:00Z',
      },
    ],
  },
  {
    title: 'Gitanjali (Song Offerings)', author: 'Rabindranath Tagore', published_year: 1910,
    genres: ['Poetry'], language: 'English', orig_language: 'Bengali', cover: 8246100, favorite: true,
    status: { status: 'completed', progress: 100, started_at: '2025-10-10', finished_at: '2025-10-16' },
    annotations: [
      {
        quote: 'Where the mind is without fear and the head is held high.',
        note: 'The line everyone knows, in his own English.',
        color: 'orange', tags: ['memory', 'things worth reading twice'],
        chapter: 'XXXV', chapter_no: 35, location: 'p. 27', noted_at: '2025-10-14T18:00:00Z',
      },
    ],
  },
  {
    // The long-content fixture, and the only book with NO art: the shelf has to draw a
    // placeholder, and a title no card can fit.
    nocover: true,
    title: 'A Narrative of the Life and Uncommonly Long Voyages of a Gentleman Who Kept No Log, Being Also an Account of the Weather, the Company, and Several Opinions Not Asked For',
    author: 'A Gentleman of Leisure', published_year: 1799, published_circa: true,
    genres: ['Nonfiction', 'Travel'], language: 'English',
    description: 'Included so that every list, card, and heading in the interface is asked to render a title it cannot possibly fit, which is the only way to find out what it does about that.',
    status: { status: 'paused', progress: 8, started_at: '2025-09-14' },
    annotations: [
      {
        quote: 'I have no log to show, the days having run together in a manner I did not think to record until they were gone.',
        note: 'A long quote and a long note together, which is the worst case for any card that stacks them.',
        color: 'purple', tags: ['memory', 'things worth reading twice'],
        chapter: 'The First Part, In Which Little Happens', chapter_no: 1,
        location: 'p. 11', noted_at: '2025-09-14T11:00:00Z',
      },
    ],
  },
]

// Films, television and games share one table and one screen; `media_type` is what tells
// them apart, and the interface labels the same column "director" or "creator" from it.
// All three are represented because a catalogue of nothing but films never exercises the
// show-only and game-only fields.
const CATALOGUE = [
  {
    title: 'Citizen Kane', director: 'Orson Welles', release_year: 1941, media_type: 'movie',
    genres: ['Drama'], artwork: 'File:Citizen Kane poster, 1941 (Style A).jpg', favorite: true,
    description: 'A reporter chases the meaning of a dying man’s last word.',
    status: { status: 'completed', progress: 100, started_at: '2025-08-03', finished_at: '2025-08-03' },
    dialogues: [
      { quote: 'Rosebud.', character: 'Charles Foster Kane', actor: 'Orson Welles', timestamp: '00:01:32', color: 'yellow', tags: ['memory'], favorite: true, noted_at: '2025-08-03T22:10:00Z' },
      { quote: 'You know, Mr. Bernstein, if I hadn’t been very rich, I might have been a really great man.', character: 'Charles Foster Kane', actor: 'Orson Welles', timestamp: '01:12:04', color: 'blue', noted_at: '2025-08-03T22:40:00Z' },
    ],
  },
  {
    title: 'Casablanca', director: 'Michael Curtiz', release_year: 1942, media_type: 'movie',
    genres: ['Drama', 'Romance'], artwork: 'File:CasablancaPoster-Gold.jpg',
    status: { status: 'completed', progress: 100, started_at: '2025-02-14', finished_at: '2025-02-14' },
    dialogues: [
      { quote: 'Here’s looking at you, kid.', character: 'Rick Blaine', actor: 'Humphrey Bogart', timestamp: '01:38:20', color: 'pink', tags: ['memory'], favorite: true, noted_at: '2025-02-14T23:05:00Z' },
    ],
  },
  {
    title: 'Metropolis', director: 'Fritz Lang', release_year: 1927, media_type: 'movie',
    genres: ['Science Fiction'], artwork: 'File:Boris Bilinski (1900-1948) Plakat für den Film Metropolis (3).jpg',
    status: { status: 'completed', progress: 100, started_at: '2025-03-08', finished_at: '2025-03-08' },
    dialogues: [
      { quote: 'The mediator between head and hands must be the heart.', character: 'Intertitle', timestamp: '02:26:40', color: 'orange', noted_at: '2025-03-08T21:30:00Z' },
    ],
  },
  {
    title: 'The Cabinet of Dr. Caligari', director: 'Robert Wiene', release_year: 1920, media_type: 'movie',
    genres: ['Horror'], artwork: 'File:The Cabinet of Doctor Caligari Movie poster.jpg',
    status: { status: 'completed', progress: 100, started_at: '2025-10-31', finished_at: '2025-10-31' },
  },
  {
    title: 'Modern Times', director: 'Charles Chaplin', release_year: 1936, media_type: 'movie',
    genres: ['Comedy'], artwork: 'File:Modern Times poster.jpg',
    status: { status: 'completed', progress: 100, started_at: '2025-04-11', finished_at: '2025-04-11' },
  },
  {
    title: 'City Lights', director: 'Charles Chaplin', release_year: 1931, media_type: 'movie',
    genres: ['Comedy', 'Romance'], artwork: 'File:City Lights (1931 theatrical poster).jpg', favorite: true,
    status: { status: 'completed', progress: 100, started_at: '2025-04-12', finished_at: '2025-04-12' },
    dialogues: [
      { quote: 'You can see now?', character: 'Intertitle', timestamp: '01:21:10', color: 'green', tags: ['memory'], noted_at: '2025-04-12T20:50:00Z' },
    ],
  },
  {
    title: 'The General', director: 'Buster Keaton', release_year: 1926, media_type: 'movie',
    genres: ['Comedy'], artwork: 'File:The general movie poster.jpg',
    status: { status: 'watching', progress: 40, started_at: '2025-12-18' },
  },
  {
    title: 'It’s a Wonderful Life', director: 'Frank Capra', release_year: 1946, media_type: 'movie',
    genres: ['Drama'], artwork: 'File:Its-a-Wonderful-Life-1.png',
    status: { status: 'completed', progress: 100, started_at: '2025-12-24', finished_at: '2025-12-24' },
  },
  {
    title: 'Sunset Boulevard', director: 'Billy Wilder', release_year: 1950, media_type: 'movie',
    genres: ['Drama'], artwork: 'File:Sunset Boulevard (1950 poster).jpg',
    status: { status: 'completed', progress: 100, started_at: '2025-09-19', finished_at: '2025-09-19' },
    dialogues: [
      { quote: 'I am big. It’s the pictures that got small.', character: 'Norma Desmond', actor: 'Gloria Swanson', timestamp: '00:22:15', color: 'purple', favorite: true, noted_at: '2025-09-19T22:00:00Z' },
    ],
  },
  {
    title: 'Night of the Living Dead', director: 'George A. Romero', release_year: 1968, media_type: 'movie',
    genres: ['Horror'], artwork: 'File:Night Of The Living Dead (1968) - Poster.jpg',
    status: { status: 'abandoned', progress: 25, started_at: '2025-10-29', finished_at: '2025-10-29' },
  },
  {
    title: 'His Girl Friday', director: 'Howard Hawks', release_year: 1940, media_type: 'movie',
    genres: ['Comedy'], artwork: 'File:His Girl Friday (1940 poster) crop.jpg',
  },
  {
    title: 'The Third Man', director: 'Carol Reed', release_year: 1949, media_type: 'movie',
    genres: ['Thriller'], artwork: 'File:The Third Man (1949 American theatrical poster).jpg',
    status: { status: 'completed', progress: 100, started_at: '2025-11-08', finished_at: '2025-11-08' },
    dialogues: [
      { quote: 'I never knew the old Vienna before the war.', character: 'Narrator', timestamp: '00:00:40', color: 'blue', noted_at: '2025-11-08T21:15:00Z' },
    ],
  },
  {
    title: 'Rashomon', director: 'Akira Kurosawa', release_year: 1950, media_type: 'movie',
    genres: ['Drama'], artwork: 'File:Rashomon poster 2.jpg',
    status: { status: 'completed', progress: 100, started_at: '2025-06-12', finished_at: '2025-06-12' },
  },
  {
    title: 'Gone with the Wind', director: 'Victor Fleming', release_year: 1939, media_type: 'movie',
    genres: ['Drama', 'Historical'], artwork: 'File:Poster - Gone With the Wind 01.jpg',
    status: { status: 'paused', progress: 20, started_at: '2025-11-30' },
  },
  {
    title: 'Battleship Potemkin', director: 'Sergei Eisenstein', release_year: 1925, media_type: 'movie',
    genres: ['Drama', 'Historical'], artwork: 'File:Vintage Potemkin.jpg',
    status: { status: 'completed', progress: 100, started_at: '2025-05-27', finished_at: '2025-05-27' },
  },
  {
    title: 'The Gold Rush', director: 'Charles Chaplin', release_year: 1925, media_type: 'movie',
    genres: ['Comedy'], artwork: 'File:Gold rush poster.jpg',
  },
  // ---- television ----
  {
    title: 'Dragnet', director: 'Jack Webb', release_year: 1951, media_type: 'show',
    genres: ['Crime'], artwork: 'File:Jack Webb Harry Morgan Dragnet 1968.JPG',
    description: 'Police procedural, told flat and on the record.',
    status: { status: 'watching', progress: 30, started_at: '2025-12-10' },
    dialogues: [
      { quote: 'Just the facts, ma’am.', character: 'Joe Friday', actor: 'Jack Webb', episode_name: 'The Big Bar', timestamp: '00:18:22', color: 'green', tags: ['memory'], noted_at: '2025-12-10T20:05:00Z' },
    ],
  },
  {
    title: 'The Cisco Kid', director: 'Various', release_year: 1950, media_type: 'show',
    genres: ['Western'], artwork: 'File:Cisco Kid and Diablo photo 1950s.jpg',
    status: { status: 'completed', progress: 100, started_at: '2025-07-01', finished_at: '2025-07-15' },
  },
  {
    title: 'The Adventures of Ozzie and Harriet', director: 'Ozzie Nelson', release_year: 1952,
    media_type: 'show', genres: ['Comedy'], artwork: 'File:Adv of Ozzie and Harriet Nelson Family 1952.jpg',
  },
  {
    title: 'The Colgate Comedy Hour', director: 'Various', release_year: 1950, media_type: 'show',
    genres: ['Comedy'], artwork: 'File:Abbott 1951 colgate comedy hour.jpg',
    status: { status: 'paused', progress: 55, started_at: '2025-09-08' },
  },
  // ---- games ----
  {
    title: 'Pong', director: 'Allan Alcorn', release_year: 1972, media_type: 'game',
    genres: ['Arcade'], artwork: 'File:Pong Flyer.jpg',
    description: 'Two paddles, one square, and the start of an industry.',
    status: { status: 'completed', progress: 100, started_at: '2025-01-20', finished_at: '2025-01-20' },
  },
  {
    title: 'Computer Space', director: 'Nolan Bushnell', release_year: 1971, media_type: 'game',
    genres: ['Arcade'], artwork: 'File:Computer Space (1971) - Promotional flyer (cropped).jpg',
  },
]

// Standalone quotes — the third kind, which belongs to no book and no film.
const QUOTES = [
  {
    quote: 'The best time to plant a tree was twenty years ago. The second best time is now.',
    color: 'green', tags: ['things worth reading twice', 'time'],
    speaker: 'Anonymous', kind: 'proverb', noted_at: '2025-10-01T07:30:00Z',
  },
  {
    quote: 'Where the mind is without fear and the head is held high.',
    note: 'From Gitanjali. Kept with its original beside it so the translation field is not empty in the captures.',
    color: 'orange', tags: ['memory'], favorite: true,
    speaker: 'Rabindranath Tagore', kind: 'essay', place: 'Bengal', occasion_date: '1910',
    language: 'Bengali', translation: 'Where the mind is without fear and the head is held high.',
    noted_at: '2025-10-14T18:00:00Z',
  },
  {
    quote: 'I have nothing to declare except my genius.',
    color: 'pink', speaker: 'Oscar Wilde', kind: 'other', place: 'New York',
    occasion: 'At customs', occasion_date: '1882', noted_at: '2025-10-20T12:00:00Z',
  },
  {
    quote: 'We are what we repeatedly do. Excellence, then, is not an act, but a habit.',
    color: 'blue', tags: ['things worth reading twice'], speaker: 'Will Durant',
    kind: 'essay', occasion_date: '1926', noted_at: '2025-11-05T09:20:00Z',
  },
  {
    quote: 'Ask not what your country can do for you — ask what you can do for your country.',
    color: 'purple', tags: ['memory'], speaker: 'John F. Kennedy', kind: 'speech',
    occasion: 'Inaugural address', occasion_date: '1961-01-20', place: 'Washington, D.C.',
    noted_at: '2025-11-21T16:00:00Z',
  },
]

// ---- people ------------------------------------------------------------------------
//
// Per-name enrichment (bio, dates, portrait) for names the library already references as
// free text. Nothing here creates a work; a person is matched to one by exact NAME, so
// `name` below has to agree character for character with the `author` on the book and the
// `speaker` on the quote, or the row is enrichment nobody sees.
//
// WHY THIS EXISTS AT ALL: the share image's portrait backdrop is drawn from a credited
// person's photo, and without one seeded, every capture of the share sheet showed the
// no-portrait case — the one path where the feature is invisible. Tagore is the fixture
// because he is already BOTH kinds in this file: the author of Gitanjali and the speaker
// of a standalone quote. One row therefore covers the two `facesFor` paths the card has
// (`author`, hanging off the attribution line; `speaker`, doing the same for an utterance)
// and leaves only the film's `actor` path unseeded.
//
// `kinds` is a list because a role is not part of a person's identity — the same human
// writes and speaks, and saving them twice under two roles is the pre-0027 shape that
// left one of the two with a blank portrait. The upsert files each role against the one
// row.
const PEOPLE = [
  {
    name: 'Rabindranath Tagore',
    kinds: ['author', 'speaker'],
    bio: 'Bengali poet, essayist and composer; the first non-European awarded the Nobel Prize in Literature, in 1913, largely for his own English Gitanjali.',
    born: '1861-05-07',
    died: '1941-08-07',
    links: 'https://en.wikipedia.org/wiki/Rabindranath_Tagore',
    source: 'wikidata',
    source_id: 'Q7241',
    // The 1909 studio portrait: public domain, high contrast, and a face rather than a
    // crowd — which is what a backdrop needs, since half of it is faded out by design.
    portrait: 'File:Rabindranath Tagore in 1909.jpg',
  },
]

const ANTHOLOGIES = [
  { tag: 'first lines', title: 'Openings', intro: 'First lines, collected because a first line is a promise the rest of the book has to keep.' },
  { tag: 'the sea', title: 'The Sea', intro: '' },
  { tag: 'things worth reading twice', title: 'Worth Reading Twice', intro: '' },
]

// What ends up in the bin, so the Bin screen is not empty. These are created and then
// deleted — the app's delete is a move to trash, which is exactly the state wanted.
const BIN_QUOTES = [
  { quote: 'A line saved in haste and thought better of.', color: 'yellow', speaker: 'Nobody', kind: 'other', noted_at: '2025-09-01T10:00:00Z' },
  { quote: 'Another one, so the bin has more than a single row to lay out.', color: 'blue', speaker: 'Nobody', kind: 'other', noted_at: '2025-09-02T10:00:00Z' },
]

// ---- machinery --------------------------------------------------------------------

function parseArgs(argv) {
  const out = {
    baseUrl: 'http://127.0.0.1:8080',
    username: 'screenshot-bot',
    password: 'screenshot-bot-pw', // must match capture.mjs; 8..20 chars, see its note
    force: false,
    artwork: true,
    quiet: false,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const next = () => argv[++i]
    if (a === '--base-url') out.baseUrl = next()
    else if (a === '--username') out.username = next()
    else if (a === '--password') out.password = next()
    else if (a === '--force') out.force = true
    else if (a === '--no-artwork') out.artwork = false
    else if (a === '--quiet') out.quiet = true
    else if (a === '--help') {
      console.log(`Usage: node seed.mjs [flags]

  --base-url <url>   Tippani server to seed (default http://127.0.0.1:8080)
  --username <name>  account to create/log in as (default screenshot-bot)
  --password <pass>  password for that account (default screenshot-bot-pw; 8-20 chars)
  --force            seed even if the account already holds a library
  --no-artwork       skip covers and posters (no network needed)
  --quiet            only print the summary
`)
      process.exit(0)
    } else {
      console.error(`unknown flag: ${a} (--help for usage)`)
      process.exit(1)
    }
  }
  return out
}

// One cookie jar for the process. The session arrives as a Set-Cookie on login/signup
// and every later call has to carry it; the name is read off the response rather than
// hardcoded, so renaming the cookie server-side does not silently unauthenticate this.
const jar = new Map()

function rememberCookies(res) {
  for (const line of res.headers.getSetCookie?.() ?? []) {
    const [pair] = line.split(';')
    const eq = pair.indexOf('=')
    if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim())
  }
}

const cookieHeader = () => [...jar].map(([k, v]) => `${k}=${v}`).join('; ')

let baseUrl = ''

// api() is the only place that talks to the server, so the failure message has one shape
// and every non-2xx is loud. A seeder that half-worked and said nothing is worse than one
// that failed: the captures would come out of a library nobody can describe.
async function api(method, path, body) {
  const res = await fetch(baseUrl + '/api' + path, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(jar.size ? { Cookie: cookieHeader() } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  rememberCookies(res)
  const text = await res.text()
  if (!res.ok) {
    let detail = text.slice(0, 300)
    try {
      detail = JSON.parse(text).error ?? detail
    } catch {
      /* not JSON; the raw body is the better message */
    }
    throw new Error(`${method} ${path} -> ${res.status}: ${detail}`)
  }
  return text ? JSON.parse(text) : null
}

// Multipart, for the endpoints that take a file rather than JSON — the two cover uploads
// and the staging import. Kept apart from api() because it must NOT set Content-Type:
// fetch has to write the multipart boundary itself, and an explicit header here produces
// a body the server cannot parse.
async function upload(path, filename, content, type) {
  const form = new FormData()
  form.append('file', new Blob([content], { type }), filename)
  const res = await fetch(baseUrl + '/api' + path, {
    method: 'POST',
    headers: jar.size ? { Cookie: cookieHeader() } : {},
    body: form,
  })
  rememberCookies(res)
  const text = await res.text()
  if (!res.ok) throw new Error(`POST ${path} -> ${res.status}: ${text.slice(0, 200)}`)
  return text ? JSON.parse(text) : null
}

async function ensureAccount(opts, log) {
  const status = await api('GET', '/auth/status')
  // needs_onboarding means no admin exists yet, so this is a scratch server and the
  // account has to be made before it can be used. Anything else means the account is
  // expected to exist already.
  if (status?.needs_onboarding) {
    await api('POST', '/auth/signup', { username: opts.username, password: opts.password })
    log(`signed up   ${opts.username}`)
    return
  }
  await api('POST', '/auth/login', { username: opts.username, password: opts.password })
  log(`logged in   ${opts.username}`)
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  baseUrl = opts.baseUrl.replace(/\/$/, '')
  const log = opts.quiet ? () => {} : (m) => console.log(m)
  const counts = {}
  const bump = (k, n = 1) => (counts[k] = (counts[k] ?? 0) + n)
  const artFailures = []

  await ensureAccount(opts, log)

  // Refuse to seed twice. Running this over an already-seeded account would double every
  // list and quietly change every screenshot that has a count on it, and the second run
  // would look like it worked.
  const existing = await api('GET', '/books')
  const held = Array.isArray(existing) ? existing.length : (existing?.books?.length ?? 0)
  if (held > 0 && !opts.force) {
    console.error(`account already holds ${held} book(s) — refusing to seed on top of it. Use --force, or point at a fresh data dir.`)
    process.exit(2)
  }

  // art() fetches one image and attaches it. A failure is recorded against that work and
  // the run continues: one unreachable poster is a work without art, which the interface
  // has to handle anyway — not a reason to abandon a library that is otherwise correct.
  async function art(kind, id, label, fetcher) {
    if (!opts.artwork) return
    try {
      const img = await fetcher()
      await upload(`/${kind}/${id}/cover`, img.filename, img.data, 'image/jpeg')
      bump(img.cached ? 'art (cached)' : 'art (fetched)')
    } catch (err) {
      artFailures.push(`${label} — ${err.message}`)
    }
  }

  // Tags first: a quote that names a tag which does not exist yet gets one created
  // implicitly with default styling, and then the explicit colours below would never be
  // applied — the chips would all come out the same colour, which is a screenshot that
  // shows a feature not working when it works.
  for (const t of TAGS) {
    await api('POST', '/tags', t)
    bump('tags')
  }
  log(`tags        ${counts.tags}`)

  // Anthology entries are referenced by REVIEW KIND, not by the endpoint that created
  // them: an annotation is a "book", a dialogue is a "screen", a standalone quote is an
  // "utterance" (internal/httpapi/review_handlers.go, validReviewKind). Sending the
  // endpoint's own noun instead is a 400 — one list of kinds, shared by review,
  // anthologies and the bulk bar, so they cannot drift apart.
  const quoteIds = [] // {kind, item_id, tags}
  let firstBookId = null

  for (const b of BOOKS) {
    const { status, annotations, cover, nocover, ...body } = b
    const created = await api('POST', '/books', body)
    firstBookId ??= created.id
    bump('books')
    if (status) await api('PUT', `/books/${created.id}/status`, status)
    if (cover && !nocover) await art('books', created.id, b.title.slice(0, 44), () => bookCover(cover))
    for (const a of annotations ?? []) {
      const row = await api('POST', '/annotations', { book_id: created.id, ...a })
      quoteIds.push({ kind: 'book', item_id: row.id, tags: a.tags ?? [] })
      bump('annotations')
    }
  }
  log(`books       ${counts.books} (+${counts.annotations ?? 0} annotations)`)

  for (const m of CATALOGUE) {
    const { status, dialogues, artwork, ...body } = m
    const created = await api('POST', '/movies', body)
    bump(m.media_type === 'game' ? 'games' : m.media_type === 'show' ? 'shows' : 'films')
    if (status) await api('PUT', `/movies/${created.id}/status`, status)
    if (artwork) await art('movies', created.id, m.title.slice(0, 44), () => commonsImage(artwork))
    for (const d of dialogues ?? []) {
      const row = await api('POST', '/dialogues', { movie_id: created.id, ...d })
      quoteIds.push({ kind: 'screen', item_id: row.id, tags: d.tags ?? [] })
      bump('dialogues')
    }
  }
  log(`catalogue   ${counts.films ?? 0} films, ${counts.shows ?? 0} shows, ${counts.games ?? 0} games (+${counts.dialogues ?? 0} dialogues)`)

  for (const q of QUOTES) {
    const row = await api('POST', '/quotes', q)
    quoteIds.push({ kind: 'utterance', item_id: row.id, tags: q.tags ?? [] })
    bump('quotes')
  }
  log(`quotes      ${counts.quotes}`)

  // People, AFTER the works that name them. A person row is enrichment matched by name,
  // so seeding it first would work and prove nothing — the interesting assertion is that
  // the name on the row and the name on the book are the same string, and that only bites
  // once both exist.
  //
  // The portrait is the one fixture image the server fetches rather than this script:
  // see commonsPortraitURL in artwork.mjs for why it cannot be uploaded as bytes. That
  // makes it the one image with no disk cache, and the failure is handled the same way
  // every other missing artwork is — recorded against the name, never fatal. A person
  // without a photo is a real row; the share card just falls back to the no-portrait
  // layout, which is what it did before this fixture existed.
  for (const p of PEOPLE) {
    const { kinds, portrait, ...body } = p
    let image_url = ''
    if (opts.artwork && portrait) {
      try {
        image_url = await commonsPortraitURL(portrait)
      } catch (err) {
        artFailures.push(`${p.name} (portrait) — ${err.message}`)
      }
    }
    // One PUT per role. The endpoint takes a single `kind` and files it against the row
    // it upserts, so two roles are two calls — and the image only rides the first, since
    // sending it twice would have the server fetch and store the same photograph again
    // and leave the first copy orphaned in the covers directory.
    for (const [i, kind] of kinds.entries()) {
      await api('PUT', '/people', { kind, ...body, ...(i === 0 && image_url ? { image_url } : {}) })
    }
    bump('people')
    if (image_url) bump('portraits')
  }
  log(`people      ${counts.people}${counts.portraits ? ` (+${counts.portraits} portraits)` : ''}`)

  // Anthologies get real entries, chosen by tag rather than by position, so adding a
  // fixture above does not silently change which quotes an anthology holds.
  for (const a of ANTHOLOGIES) {
    const { tag, ...body } = a
    const created = await api('POST', '/anthologies', body)
    bump('anthologies')
    const items = quoteIds.filter((q) => q.tags.includes(tag)).map(({ kind, item_id }) => ({ kind, item_id }))
    if (items.length) {
      await api('POST', `/anthologies/${created.id}/entries`, { items })
      bump('anthology entries', items.length)
    }
  }
  log(`anthologies ${counts.anthologies} (+${counts['anthology entries'] ?? 0} entries)`)

  // The bin. Created then deleted, because delete is a move to trash and there is no
  // other way to reach that state honestly.
  for (const q of BIN_QUOTES) {
    const row = await api('POST', '/quotes', q)
    await api('DELETE', `/quotes/${row.id}`)
    bump('binned')
  }
  log(`bin         ${counts.binned}`)

  // The staging queue, by round-tripping the app's own export back through import.
  // Hand-writing a Markdown fixture here would mean maintaining a second copy of a
  // format the importer owns, and the first change to it would fail as a parse error
  // that looks like a seeding bug. An import stages rather than writing to the library
  // (the staging invariant in CLAUDE.md), so this leaves rows awaiting approval —
  // exactly what the Staging screen is for.
  try {
    const md = await fetch(`${baseUrl}/api/books/${firstBookId}/export`, { headers: { Cookie: cookieHeader() } })
    if (!md.ok) throw new Error(`export -> ${md.status}`)
    const staged = await upload('/import/markdown', 'seeded-book.md', await md.text(), 'text/markdown')
    bump('staged', staged?.staged ?? staged?.count ?? 1)
    log(`staging     ${counts.staged}`)
  } catch (err) {
    // Reported, never swallowed: a Staging screenshot of an empty queue is a legitimate
    // capture, but only if the run says that is what it is.
    console.error(`staging     NOT SEEDED (${err.message}) — the Staging screen will capture empty`)
  }

  const total = Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(', ')
  console.log(`\nSEEDED ${total}`)
  if (artFailures.length) {
    console.log(`\n${artFailures.length} work(s) have no art:`)
    for (const f of artFailures) console.log(`  ${f}`)
  }
}

main().catch((err) => {
  console.error(`\nseed failed: ${err.message}`)
  process.exit(1)
})
