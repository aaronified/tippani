// THE ISSUES A CONSOLE CAN FILTER TO, AS ONE ROW OF PILLS.
//
// THE OWNER'S ASK: "There should be chips at the top of the card to filter the
// characters from the top issues… The issue filters should be in work, people,
// and character screens. These will be pills, in one row. Edgemasked with
// sidescroll, if needed on a small screen."
//
// WHY A PILL AND NOT THE DROPDOWN IT REPLACES. A dropdown holds its options
// behind a press, so the reader has to open it to find out that eleven of their
// people have no photograph — and then close it, and then open it again to check
// the next one. The whole point of these consoles is that the SHAPE of the
// library's gaps should be readable at a glance: a row of pills carrying their
// own counts says "no photo 11 · no links 3 · no works 0" without a press, and
// choosing one is then a single tap rather than three.
//
// THE COUNT IS ON THE PILL AND THAT IS THE FEATURE. A filter that says only what
// it filters to is a question; a filter that says how many it would leave is an
// answer, and it is the number the reader came to the screen for.
//
// A ZERO PILL STAYS AND IS DIMMED. It is how a reader learns the filter exists at
// all, and "none of my people are missing a photo" is worth reading — it is the
// one state this screen is working towards. It is still pressable, because a
// press that lands on "nothing here" has answered the question.
//
// IT SCROLLS UNDER AN EDGE FADE RATHER THAN WRAPPING, which is the repo's
// standing rule for a row that can overflow: `Scroller` measures, so a row that
// fits wears no fade and a row that does not says so and can be dragged.
import { IconNavLibrary, IconNavQuotes, Scroller } from './ui.jsx'

// options: [{ key, label, n }] — `key` is the caller's filter token, `label` its
// words, `n` how many rows it would leave. The caller owns all three, because
// this module resolves no locale key of its own: it is drawn by three consoles
// whose issues have nothing in common but their shape.
export function IssuePills({ value, onChange, options, ariaLabel }) {
  if (!options?.length) return null
  return (
    <Scroller axis="x" className="issue-pills" role="group" aria-label={ariaLabel}>
      {options.map((o) => {
        const on = value === o.key
        return (
          <button
            key={o.key}
            type="button"
            // A FILTER IS A STATE, NOT A VERB, so it announces itself as one —
            // `aria-pressed` rather than a nameless button that happens to look
            // different. The stylesheet's `.active` is the same class every other
            // chosen chip in this app wears; `is-on` matches nothing here and is
            // the mistake the repo's own gotchas list.
            aria-pressed={on}
            className={'tp-filter-chip tactile issue-pill' + (on ? ' active' : '') + (o.n ? '' : ' is-empty')}
            onClick={() => onChange(o.key)}
          >
            <span className="issue-pill-label">{o.label}</span>
            <span className="issue-pill-count">{o.n}</span>
          </button>
        )
      })}
    </Scroller>
  )
}

// WHAT A RECORD'S ROW SAYS UNDER ITS NAME: how many works, how many quotes, and
// then the works themselves.
//
// THE OWNER'S SHAPE, verbatim: "x <work_icon> • y <quote_icon> - <work names like
// pills, with edgemask and sidescroll>". It replaces "1 work · 0 of 1 with a face
// chosen", which is a sentence about a sub-count nobody asked for, written the
// long way round.
//
// THE ICONS CARRY THE NOUNS so the numbers do not have to. Two counts and two
// words is four things to read on a line that is scanned rather than read; two
// counts and two pictures is two. The words are still there for anybody who
// cannot see the pictures — each number's own label says which it is.
//
// THE WORK NAMES ARE PILLS AND THEY SCROLL, because "never truncate a name" is
// the standing rule and a list of works is exactly where an ellipsis would land.
// The row carries the first few; the count beside the icon is what says there are
// more, and the record's own screen lists them all.
//
// A COUNT IS A DOOR WHERE THE CALLER GAVE IT ONE. The people console's works
// count opens a search for that person, which it did as a column and must go on
// doing here — moving a number is not a reason to lose what pressing it did. A
// caller that passes nothing gets plain text, never a button that goes nowhere.
//
// AND THE NAME STAYS THE NOUN EVEN THEN. A first draft used the door's own words
// as the accessible name and it read "12 Search the library for “Bulgakov”",
// which is two sentences welded at a number. `worksTip` is the hover; the name is
// what the number IS, with the verb appended as its own clause so a reader hears
// the count first and the door second.
export function RowCounts({ works, quotes, worksLabel, quotesLabel, worksTip = '', pills = [], onPill = null, onWorks = null }) {
  const worksBody = <>
    <IconNavLibrary size={13} />
    <span aria-hidden="true">{works}</span>
  </>
  const worksName = `${works} ${worksLabel}`
  return (
    <span className="row-counts">
      {onWorks
        ? <button type="button" className="row-count row-count-btn" title={worksTip || worksLabel} aria-label={worksTip ? `${worksName} — ${worksTip}` : worksName} onClick={onWorks}>{worksBody}</button>
        : <span className="row-count" title={worksLabel} aria-label={worksName}>{worksBody}</span>}
      <span className="row-count-dot" aria-hidden="true">·</span>
      <span className="row-count" title={quotesLabel} aria-label={`${quotes} ${quotesLabel}`}>
        <IconNavQuotes size={13} />
        <span aria-hidden="true">{quotes}</span>
      </span>
      {pills.length > 0 && (
        <Scroller axis="x" className="row-work-pills">
          {pills.map((p) => (
            // A PILL IS A DOOR WHERE THE CALLER GAVE IT ONE, and plain text where
            // it did not — never a button that goes nowhere, which is the rule
            // the record row already keeps for its name and its count.
            onPill
              ? <button key={p.key} type="button" className="tp-chip work-pill tactile" onClick={() => onPill(p)}>{p.title}</button>
              : <span key={p.key} className="tp-chip work-pill">{p.title}</span>
          ))}
        </Scroller>
      )}
    </span>
  )
}
