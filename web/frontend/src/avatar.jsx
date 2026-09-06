// The account chip's picture — one component, for the four places one is drawn.
//
// FOUR COPIES OF ONE VERB is what this replaces: the top bar, the drawer, the
// profile card, the account switcher and the admin list each wrote the same
// three lines, and the round that taught every face in the app to ask whether
// its picture arrived had to edit each of them separately. The repo's directive
// is explicit about that shape — "A control drawn by one component on two
// screens has ONE behaviour, and it lives in one function that both screens
// call — not in a line each, which is how one of them goes on being right while
// the other quietly stops."
//
// ITS OWN FILE, because of where `Face` lives. `App.jsx` already imports
// `Account.jsx`, so `Account.jsx` importing back from it is a cycle; and `Face`
// is in `characterRows.jsx`, which imports `ui.jsx`, so `ui.jsx` cannot hold this
// either. A leaf module both screens can reach is the only shape with no cycle
// in it.
//
// A LETTER, NOT A SILHOUETTE. An account is not a person in the library — the six
// hashed faces are for records, and the initial is what this chip has always
// drawn. What the chip may NOT do is treat a stored path as a picture: an avatar
// whose file has gone drew the browser's torn page inside a 24px squircle, which
// is the owner's report one screen over.
import { coverImgURL } from './api.js'
import { Face } from './characterRows.jsx'

export function UserAvatar({ user, onBroken }) {
  const who = user || {}
  return (
    <Face
      src={who.avatar_path}
      url={coverImgURL}
      name={who.username || ''}
      // `display: contents`, so the chip goes on centring one character exactly
      // as it did — the slot adds no box between them.
      className="face-slot"
      fallback={<>{(who.username || '?').trim().charAt(0).toLowerCase()}</>}
      // A SCREEN MAY NEED TO KNOW, not to decide. The profile card offers
      // "Change photo" and a Remove key off the stored path, so an avatar whose
      // file has gone was offering to remove a picture that is not there.
      onBroken={onBroken}
    />
  )
}
