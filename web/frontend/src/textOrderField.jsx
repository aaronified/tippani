// THE PER-WORK AND PER-BOARD CONTROL — one component, three forms.
//
// THE OWNER'S SPEC, the sentence 0073 gave a column to and this gives a way in:
// "There will be per work control over whether the cards are to show 1)
// translations above quotations, 2) quotations above translation, 3) no
// translation, 4) no quotations… the work controls will supercede the metadata
// controls."
//
// A SLIDER, BECAUSE THE FOUR ARE ONE AXIS. Each stop shows strictly more of the
// original than the last, which is why the owner asked for one in Settings ("I
// can slide across the 4 options beside it") and why the same shape is right
// here: a reader who has met the control once has met it everywhere.
//
// ONE COMPONENT AND NOT THREE, under this repo's own directive — a book's form, a
// film's and a board's draw the same control, so it lives in one function all
// three call. Where a screen genuinely differs it passes the fact IN, which is
// what `inherited` is for.
//
// INHERIT NEEDS ITS OWN WAY BACK, and this is where a work differs from a
// LANGUAGE row in Settings. There, "equal to the master" and "not set" are the
// same thing, so moving the slider onto the master's value clears the row and no
// reset is needed. A work has the language rung between it and the master, so
// there is no single value that means "follow my settings" — a work of Bengali
// quotes and one of English quotes inherit different answers. So the slider says
// which of the four, and a separate control says whether the work has an opinion
// at all.
//
// NOT A FIFTH STOP ON THE SLIDER. Inherit is not more or less of the original
// than the four; putting it on the axis would break the one property that makes
// the axis a slider.
import { FieldIconButton, IconRevert, MonoLabel, Slider } from './ui.jsx'
import { t } from './i18n.js'
import { TEXT_ORDERS, TEXT_ORDER_DEFAULT, TEXT_ORDER_WORD } from './textOrder.js'

export function TextOrderField({ value, onChange, inherited = TEXT_ORDER_DEFAULT }) {
  // `value` is the stored column: one of the four, or '' for inherit. The slider
  // has to sit somewhere either way, so an unset control shows what this work
  // WOULD do — the inherited answer — rather than a default that might be a lie.
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
      <Slider
        label={t('common.field.text-order.label')}
        hideLabel
        min={0}
        max={TEXT_ORDERS.length - 1}
        step={1}
        value={TEXT_ORDERS.indexOf(showing)}
        readout={t(TEXT_ORDER_WORD[showing])}
        onCommit={(at) => onChange(TEXT_ORDERS[at] || '')}
      />
      {/* SAID ONLY WHERE IT IS NOT OBVIOUS. A slider always sits somewhere, so an
          unset control looks exactly like a set one — this line is what tells
          them apart, and it is the only thing the revert glyph above cannot say
          by being absent. A work WITH its own answer gets no line: the glyph is
          already there, and a sentence beside it would be the row saying one
          thing twice. */}
      {!own && <p className="microcopy mt-1.5">{t('common.field.text-order.inherit.note')}</p>}
    </div>
  )
}
