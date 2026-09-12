// THE PER-WORK AND PER-BOARD CONTROL — one component, three forms.
//
// THE OWNER'S SPEC, the sentence 0073 gave a column to and this gives a way in:
// "There will be per work control over whether the cards are to show 1)
// translations above quotations, 2) quotations above translation, 3) no
// translation, 4) no quotations… the work controls will supercede the metadata
// controls."
//
// FOUR CHIPS, AND IT WAS A SLIDER. The owner asked for the slider first — "I can
// slide across the 4 options beside it" — and the argument written here for it
// was that the four form one axis, each stop showing strictly more of the
// original than the last. That reading was not wrong; it was outvoted, by the
// person using it: "What does the slider mean? Make the slider an obvious 4 point
// chooser. Sliders are for when we have a gradient, not when we have 4-5 distinct
// options!"
//
// AND THE AXIS ARGUMENT HAD A TELL NOBODY READ. The control was labelled "how
// much of the original" — a quantity's question — over four states that are not
// quantities of anything: "translation only" and "quotation only" are two
// different single texts, not two ends of one measure. A slider promises that the
// space between stops means something, and here it means nothing at all.
//
// CHIPS RATHER THAN A Toggle, which is the app's other pick-one-of-N and would
// have been the tidier-looking answer. Toggle lays its options in one segmented
// row, and it is right where the words are short (yes/no, Book/Film/Show/Game).
// These four are "translation first", "quotation first" and their two
// companions: four of those in one row at 390px either clip a word or shrink the
// type, and this repo forbids both. Chips wrap. `MEDIA_TYPES` on the work
// details panel is the same shape for the same reason.
//
// ONE COMPONENT AND NOT THREE, under this repo's own directive — a book's form, a
// film's and a board's draw the same control, so it lives in one function all
// three call. Where a screen genuinely differs it passes the fact IN, which is
// what `inherited` is for.
//
// INHERIT IS NOT A FIFTH CHIP, and this is where a work differs from a LANGUAGE
// row in Settings. There, "equal to the master" and "not set" are the same thing,
// so choosing the master's value clears the row. A work has the language rung
// between it and the master, so no single value means "follow my settings" — a
// work of Bengali quotes and one of English quotes inherit different answers. So
// the chips say which of the four, and the revert glyph says whether the work has
// an opinion at all.
import { FieldIconButton, IconRevert, MonoLabel } from './ui.jsx'
import { t } from './i18n.js'
import { TEXT_ORDERS, TEXT_ORDER_DEFAULT, TEXT_ORDER_WORD } from './textOrder.js'

export function TextOrderField({ value, onChange, inherited = TEXT_ORDER_DEFAULT }) {
  // `value` is the stored column: one of the four, or '' for inherit. A chip is
  // lit either way, so an unset control shows what this work WOULD do — the
  // inherited answer — rather than a default that might be a lie.
  const own = TEXT_ORDERS.includes(value) ? value : ''
  const showing = own || (TEXT_ORDERS.includes(inherited) ? inherited : TEXT_ORDER_DEFAULT)
  return (
    <div>
      <div className="flex items-center gap-2">
        <MonoLabel className="mb-1.5 block">{t('common.field.text-order.label')}</MonoLabel>
        {/* THE REVERT GLYPH THE SETTINGS ROWS ALREADY USE, and only when there is
            something to revert — the same condition (`row.mark || row.renamed`)
            and the same component, because "put this back" is one verb and a
            reader who has met it in Settings has met it here. */}
        {own && (
          <FieldIconButton
            icon={<IconRevert />}
            ariaLabel={t('common.field.text-order.inherit.action')}
            onClick={() => onChange('')}
            tooltip={t('common.field.text-order.inherit.action')}
          />
        )}
      </div>
      <TextOrderChoice value={showing} onChange={onChange} ariaLabel={t('common.field.text-order.label')} />
      {/* SAID ONLY WHERE IT IS NOT OBVIOUS. A chip is lit either way, so an unset
          control looks exactly like a set one — this line is what tells them
          apart, and it is the only thing the revert glyph above cannot say by
          being absent. A work WITH its own answer gets no line: the glyph is
          already there, and a sentence beside it would be the row saying one
          thing twice. */}
      {!own && <p className="microcopy mt-1.5">{t('common.field.text-order.inherit.note')}</p>}
    </div>
  )
}

// TextOrderChoice — the four, as four chips, and the ONLY drawing of them.
//
// THREE COPIES IS WHAT THIS ENDS. The same question was asked by three separate
// controls: this file's, and two more inside the language-marks panel — the master
// above the rows and one per row. All three happened to be sliders, so the drift
// was invisible; the moment one of them changed shape the app had two answers to
// one question on two screens. The repo's directive is explicit that a control
// drawn on two screens lives in one function both call.
//
// `radiogroup`, NOT four pressed buttons. MEDIA_TYPES next door uses aria-pressed,
// which says "this button is on" four times and never says the four are one
// answer — a screen reader reads no relation between them and no count. These are
// exclusive by construction, so they say so. The chip CLASS is unchanged, because
// the directive is that two things which look the same behave the same, and these
// look like every other chosen chip in the app.
export function TextOrderChoice({ value, onChange, ariaLabel }) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="flex flex-wrap gap-2">
      {TEXT_ORDERS.map((k) => {
        const on = value === k
        return (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={on}
            className={'tp-filter-chip tactile' + (on ? ' active' : '')}
            onClick={() => onChange(k)}
          >
            {t(TEXT_ORDER_WORD[k])}
          </button>
        )
      })}
    </div>
  )
}
