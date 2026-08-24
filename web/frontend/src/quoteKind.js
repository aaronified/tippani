// What kind of thing a standalone quote is (0053), and the one place its words
// live.
//
// IT REPLACED A FREE-TEXT BOX. 0026 gave the table `medium` — "radio, speech,
// letter, interview, song" — and the form offered it as something you typed into.
// The Quotes board GROUPS by it, and grouping on a hand-typed field produces one
// shelf per spelling: "Speech", "speech", "a speech" and "Speech (radio)" are four
// shelves holding one kind of thing, and nothing in the interface can tell you
// they are the same. A fixed list is what that field was reaching for.
//
// ITS OWN MODULE, because five screens need the words and none of them should
// import another screen to get them: the form, the card's meta line, the board's
// grouping, the bulk editor and the share payload. It imports i18n and nothing
// else, so it cannot be the far end of a cycle.
//
// '' IS ONE OF THE VALUES and it is the default — "nobody has said". 'other' is a
// decision, and a default pretending to be one is a lie the interface then reports
// as a fact. So the list below starts with the empty answer, spelled in words, and
// the column's CHECK agrees (0053).

import { t } from './i18n.js'

// The five, in the order the form offers them: the three commonest first, then
// proverb, then the residual. Machine values on the wire, always — the words are
// this module's business and the server never sends prose.
export const QUOTE_KINDS = ['speech', 'letter', 'essay', 'proverb', 'other']

// quoteKindOptions is [value, label] pairs for a Select, with the unset answer at
// the top. A getter is not needed here because every caller calls the function at
// render time, which is after a locale has been applied.
export function quoteKindOptions() {
  return [['', t('vocab.quote-kind.unset.label')], ...QUOTE_KINDS.map((k) => [k, quoteKindLabel(k)])]
}

// quoteKindLabel is the word for one value, and '' for the unset one — not the
// words "not set". A card's meta line joins what it is given with " · ", so a
// label here would put "not set" on every card that has not been filed.
export function quoteKindLabel(kind) {
  const k = String(kind || '')
  return QUOTE_KINDS.includes(k) ? t(`vocab.quote-kind.${k}.label`) : ''
}

// quoteKindMeta is what a CARD shows, which is not always the kind.
//
// A quote whose kind nobody has set may still carry the old free-text `medium`,
// because 0053 kept that column and its values: the one-time pass folded across
// the ones that matched one of the five words and left the rest exactly where they
// were. Showing the leftover is what makes it visible as work to do — a reader who
// typed "radio" sees "radio" until they file it, rather than watching the field
// they filled in disappear from every card in the release that replaced it.
export function quoteKindMeta(u) {
  return quoteKindLabel(u?.kind) || (u?.medium || '')
}
