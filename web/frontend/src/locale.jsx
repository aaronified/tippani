// The one control that changes the language.
//
// The mechanism is in i18n.js — the parser, the chain, coverage, the pseudo-locale
// — and this is the only thing in the app that writes to it. Kept out of ui.jsx
// deliberately: a control that owns a preference and can PUT it is not a visual
// primitive, and LabelDensity (the closest analogue) is not in there either. Kept
// out of Settings.jsx too, because the FIRST-RUN screen needs the same control
// before any account exists, and a first-run screen reaching into the settings
// tree for its language row reads backwards.
//
// TYPOGRAPHY: NOTHING NEW WAS INVENTED, and nothing needed to be. fonts.js already
// composes the display, ui and hand stacks as `latin, bengali, devanagari, …`, so
// no Bengali codepoint ever stops at the Latin face and every Bengali string in
// this picker — every string in the app, once the migration lands — already renders
// in whichever Bengali face the reader chose in Settings → Type. Choosing a
// language therefore carries its script's typography for free, which is the
// cheapest possible version of what was asked for.
//
// ONE GAP, NAMED RATHER THAN QUIETLY FIXED: the MONO stack is
// `latin, ui-monospace, monospace` with no Indic face in it, so a mono-label — and
// the row title below is one, following LabelDensity — falls through to whatever
// the operating system reaches for. Adding `bengali, devanagari` to that stack is a
// one-line change in fonts.js and is a change to the type system, which is not
// this pass's to make. See the report.

import { useLocale, applyLocale, localeActive, localeCatalogue, localeMissing, localeName, t } from "./i18n.js";
import { InfoDot, MonoLabel, Select } from "./ui.jsx";

// LanguagePicker — the Settings row and the first-run row, one component.
//
// `titleKey` rather than a title, because the two sites are two strings: a
// translator may well want a different word above an account form than beside a
// switch in a settings card, and a shared key would take that choice away.
//
// `onPick` is the EXTRA a site does, not the whole of it. Applying the choice is
// this component's job and happens either way — the first-run screen has no
// session to save to, and the Settings row does — so the applier is here and the
// PUT is the caller's.
export function LanguagePicker({ titleKey, info = false, onPick, width = 230 }) {
  // Subscribed rather than read once: the coverage numbers and the selected row
  // change when GET /locales lands, which happens after the first paint and for
  // no reason this component would otherwise re-render for.
  useLocale();
  const list = localeCatalogue();
  const missing = localeMissing();

  function pick(code) {
    applyLocale(code);
    onPick?.(code);
  }

  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5">
        <MonoLabel>{t(titleKey)}</MonoLabel>
        {info && <InfoDot title={t("settings.language.info.title")} text={t("settings.language.info.body")} />}
      </div>
      <Select
        ariaLabel={t("locale.picker.aria")}
        value={localeActive()}
        onChange={pick}
        width={width}
        // COVERAGE BESIDE EVERY NAME, design §7 — including the two that ship in
        // the box, which is the point of showing it at all. No language is
        // second-class, so none of them gets to omit the number.
        options={list.map((l) => [l.code, t("locale.picker.coverage", { name: l.name, percent: l.percent })])}
      />
      {/* Design §4: an unrecognised preference renders a built-in rather than
          blanking the interface. That leaves the reader looking at a language they
          did not choose with nothing on screen to say why, so this says it. */}
      {missing && (
        <p className="microcopy mt-2">
          {t("settings.language.missing", { code: missing, name: localeName(localeActive()) })}
        </p>
      )}
    </div>
  );
}
