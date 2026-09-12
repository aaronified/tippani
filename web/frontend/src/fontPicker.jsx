// THE DROPDOWN OF FACES, and it is one function because there are now three
// places that ask the same question.
//
// Settings' Type card asks it per ROLE, for the app's own words. The same card
// asks it again per UI LANGUAGE, because the owner's spec says every language a
// translation file adds gets a full picker of its own. And the language table asks
// it per QUOTE LANGUAGE — "I may want my german to have serifs, but not english".
// Three surfaces, one control: the repo's directive is that a control drawn on two
// screens lives in one function both call, rather than in a line each, which is how
// one of them goes on being right while the other quietly stops.
//
// EVERY OPTION IS DRAWN IN ITS OWN FACE, which is the only question the list is
// asked. A list of type names set in one typeface answers nothing.
import { Select } from './ui.jsx'
import { t } from './i18n.js'
import { uploadedFonts } from './fonts.js'

// faceOptions — a face list as Select's [value, label, search] triples.
//
// A LABEL MAY BE A NODE, which is what lets the specimen BE the option; the third
// element is what typing searches, since the label itself is an element.
//
// YOUR OWN FACES ARE OFFERED EVERYWHERE, because only you know what you uploaded
// one for — the script check on the Type card is what tells you whether it suits
// the place you put it.
export function faceOptions(faces, uploads = uploadedFonts()) {
  return [
    ...faces.map((f) => [
      f.id,
      <span key={f.id} style={{ fontFamily: `'${f.family}'` }}>{t(f.name)}</span>,
      t(f.name),
    ]),
    ...uploads.map((f) => [
      f.token,
      <span key={f.token} style={{ fontFamily: `'${f.family}'` }}>{f.name}</span>,
      f.name,
    ]),
  ]
}

// FaceSelect draws that list.
//
// `inheritLabel` IS THE ABSENCE OF A CHOICE, and it is an option rather than a
// separate control. A quote language with no face of its own follows the card, and
// a UI language with none follows the answer every language inherits — both are
// real answers a reader has to be able to choose AGAIN after choosing a face, so
// they belong in the same list rather than behind a clear button beside it.
// Passing no `inheritLabel` leaves the list as faces only, which is what a role
// row wants: a role always has a face.
export function FaceSelect({ faces, value, onChange, ariaLabel, inheritLabel = '', uploads, width = 228 }) {
  const options = faceOptions(faces, uploads)
  if (inheritLabel) options.unshift(['', inheritLabel, inheritLabel])
  return (
    <Select
      filter
      width={width}
      value={value || ''}
      ariaLabel={ariaLabel}
      filterPlaceholder={t('settings.type.face.filter.placeholder')}
      onChange={onChange}
      options={options}
    />
  )
}
