// SIX DEFAULT PORTRAITS, PICKED BY NAME — handoff §1.8, and the reason it is six
// rather than one: a list of ninety people wearing a single silhouette reads as
// one person repeated, and the face is the fastest thing in a row to recognise.
//
// HASHED, NOT RANDOM. The same person must wear the same face on a chip, in the
// People table, in the media block and on a share image; a face that changes
// between two screens is a face nobody can learn. So the choice is a pure
// function of the name and nothing else — no state, no counter, no id, because an
// id is not stable across the merge that folds two records into one.
//
// THE NAME, NEVER THE CREDIT-AS. `person-instructions.md` draws that line: a
// translator credited as "A. Das" on one book and "Arani Das" on another is one
// person, and a face that changed between the two would say they were two.
//
// A MASK, NOT AN <img>. These are inline paths filled with `currentColor`, which
// the sites below set to `--faint`: they take the theme in both modes, they scale
// with the box, and they can never be mistaken for an uploaded photograph — which
// a grey JPEG of a silhouette eventually is.

// fnv1a over code POINTS rather than code units, and over the raw lower-cased
// name rather than normName: normName strips everything outside [a-z0-9], so
// every Bengali name in the library would fold to the empty string and wear the
// same face — which is the exact failure the six exist to prevent.
function fnv1a(s) {
  let h = 0x811c9dc5
  for (const ch of s) {
    h ^= ch.codePointAt(0)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h
}

export const SILHOUETTE_COUNT = 6

// silhouetteIndex is exported for the tests and for anything that needs the same
// face outside React — the share-image canvas draws its own.
export function silhouetteIndex(name) {
  const key = (name || '').trim().toLowerCase()
  if (!key) return 0
  return fnv1a(key) % SILHOUETTE_COUNT
}

// Each face is head-and-shoulders inside a 48-square, meeting the bottom edge so
// the shape fills a circular crop as well as a rectangular one. They differ by
// OUTLINE — hair, jaw, shoulder width — because at 15px a silhouette is nothing
// but its outline, and two that differ only in an interior detail are one face.
const FACES = [
  // 1. Bare head, even shoulders — the neutral one.
  <>
    <circle cx="24" cy="17.5" r="9" />
    <path d="M6 48c0-9.9 8.1-18 18-18s18 8.1 18 18z" />
  </>,
  // 2. Long hair, falling past the jaw; narrower shoulders under it.
  <>
    <path d="M24 5c-7.2 0-13 5.8-13 13v13.5c0 1.4 1.1 2.5 2.5 2.5H16a10.5 10.5 0 0 0 16 0h2.5c1.4 0 2.5-1.1 2.5-2.5V18c0-7.2-5.8-13-13-13z" />
    <path d="M8 48c0-8.8 7.2-16 16-16s16 7.2 16 16z" />
  </>,
  // 3. Hair gathered up — the silhouette's one piece of headwear that is not a hat.
  <>
    <circle cx="24" cy="7.5" r="4.5" />
    <circle cx="24" cy="19" r="9" />
    <path d="M7 48c0-9.4 7.6-17 17-17s17 7.6 17 17z" />
  </>,
  // 4. Cropped hair, square jaw, broad shoulders.
  <>
    <path d="M15 15a9 9 0 0 1 18 0v5.5a9 9 0 0 1-18 0z" />
    <path d="M5 48c0-9.9 8.5-18 19-18s19 8.1 19 18z" />
  </>,
  // 5. A long, bearded face on wide shoulders.
  <>
    <path d="M24 6a10 10 0 0 0-10 10v5.5c0 5.6 4.5 10.5 10 10.5s10-4.9 10-10.5V16A10 10 0 0 0 24 6z" />
    <path d="M4 48c0-10.5 9-19 20-19s20 8.5 20 19z" />
  </>,
  // 6. A cap, and the narrow shoulders that go with a smaller frame.
  <>
    <path d="M13.5 16.5a10.5 10.5 0 0 1 21 0c0 .8-.7 1.5-1.5 1.5H15c-.8 0-1.5-.7-1.5-1.5z" />
    <circle cx="24" cy="21" r="8" />
    <path d="M10 48c0-7.7 6.3-14 14-14s14 6.3 14 14z" />
  </>,
]

// Silhouette fills whatever box it is given: the sites that draw it size the box,
// because a face is 15px on a chip and 44px in a media block and the shape is the
// same shape at both.
export function Silhouette({ name, className }) {
  return (
    <svg
      className={('tp-silhouette ' + (className || '')).trim()}
      viewBox="0 0 48 48"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      {FACES[silhouetteIndex(name)]}
    </svg>
  )
}
