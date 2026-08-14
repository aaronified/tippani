// The default locale, pinned — the other half of the reproducibility TZ already had.
//
// WHY THIS EXISTS. Several places in the app format a date through
// `toLocaleDateString(undefined, …)`, and the undefined is deliberate and correct: a
// date should be written the way the READER writes dates, not the way the author of
// the app does. The same property makes the rendered string a function of whichever
// machine the test happens to run on, and the CI runner is not anybody's laptop.
//
// This is not hypothetical. 1.11.2's CI went red on four assertions reading
// `deleted 1 Aug`, because the runner resolved en-US and rendered `deleted Aug 1`.
// The identical assertion had passed the day before, and that is the tell: nothing
// was holding it, so the runner's default moving was enough to break it. A test that
// passes because of where it ran is not passing.
//
// WHY NOT AN ENV VAR, which is how TZ is done one file over. Because it does not
// work. ICU reads LANG / LC_ALL on Linux and ignores them on Windows, so pinning
// that way fixes CI and leaves the authoring machine disagreeing — the same bug
// facing the other way, and harder to see because CI would be the green one.
// Verified rather than assumed: with LANG and LC_ALL both set to en-US.UTF-8,
// `Intl.DateTimeFormat().resolvedOptions().locale` still answers en-IN on Windows.
//
// So the default is replaced where the default is actually READ. An explicit locale
// is passed through untouched — `toLocaleDateString('en-US', …)` still means en-US,
// so a test that wants to prove locale-specific behaviour still can — and only
// `undefined` resolves to LOCALE.
//
// WHAT THIS DOES NOT COVER, said plainly so nobody assumes otherwise: code that
// constructs `Intl.DateTimeFormat()` itself rather than going through Date. The app
// has exactly one such call — greetings.js reads `.resolvedOptions().timeZone` — and
// it asks about the zone, which TZ already pins, so it is unaffected either way.

// en-GB, because the repository writes British English throughout — colour,
// favourite, catalogue — and its fixtures read as a British library. The point is
// far less WHICH locale than that it is one locale, everywhere, stated once.
export const LOCALE = 'en-GB'

// The three Date methods that render a date for a human, and the one String method
// that orders a list for one. All four take an optional locale and all four fall
// back to the host when it is absent, which is the whole problem.
const DATE_METHODS = ['toLocaleDateString', 'toLocaleTimeString', 'toLocaleString']

export function pinLocale(locale = LOCALE) {
  for (const name of DATE_METHODS) {
    const original = Date.prototype[name]
    // Idempotent: the dom and pure setups both call this, and a double-wrap would
    // still work but would leave two layers to reason about if it ever misbehaves.
    if (original.__localePinned) continue
    const wrapped = function (locales, options) {
      return original.call(this, locales ?? locale, options)
    }
    wrapped.__localePinned = true
    Date.prototype[name] = wrapped
  }

  // localeCompare decides the ORDER of every by-title and by-author list in the app.
  // Collation differs between locales for accents, case and punctuation, so a sort
  // assertion over anything but plain ASCII is host-dependent in exactly the same
  // way a formatted date is — it has simply not bitten yet, because the fixtures are
  // ASCII. Pinned here so it cannot.
  const compare = String.prototype.localeCompare
  if (!compare.__localePinned) {
    const wrapped = function (that, locales, options) {
      return compare.call(this, that, locales ?? locale, options)
    }
    wrapped.__localePinned = true
    String.prototype.localeCompare = wrapped
  }
}
