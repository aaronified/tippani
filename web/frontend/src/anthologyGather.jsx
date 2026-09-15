// Getting a passage INTO an anthology — the picker, the request, and the list
// they both read.
//
// WHY THIS IS NOT IN anthologies.jsx, which is where it started and where the rest
// of the feature still lives. The search screen has to reach this dialog (a reader
// asks a question and wants the answer kept), and `anthologies.jsx` imports
// `SearchBox` FROM `SearchPage.jsx` — deliberately, so that a rule is written in
// the same box a search is. Importing the dialog back out of `anthologies.jsx`
// would close that edge into a cycle, and an import cycle's failure is not a build
// error but a binding that is `undefined` for as long as it takes one of the two
// modules to finish evaluating — which is to say, intermittently, at runtime, on
// whichever screen happened to load first.
//
// So the four things every gathering surface needs sit here, importing nothing
// that could point back: the vocabulary map, the list hook, the request, and the
// dialog. `anthologies.jsx` reads them from here like everybody else.
import { useCallback, useEffect, useState } from 'react'

import { errText, json } from './api.js'
import { searchQueryString, workSeedChip } from './facets.js'
import { t } from './i18n.js'
// THE BOX THAT FINDS ONE OR MAKES ONE. Free text with suggestions rather than a
// picker, which is what lets one control answer "which anthology" and "a new one
// called this" — see AddToAnthologyDialog.
import { SuggestCombo } from './suggest.jsx'
import { ErrorText, FormModal, MonoLabel, Toggle, toast, useFormHost } from './ui.jsx'

// ANTHOLOGY_KIND maps a SELECTION's kind to the entry vocabulary. Two vocabularies
// for the same three things, and both are load-bearing: the selection bar speaks
// annotation / dialogue / quote (the tables), the anthology routes speak book /
// screen / utterance (the item_reviews vocabulary). Exported so a surface can ask
// whether what it is holding is gatherable at all rather than guessing.
//
// A WORK IS NOT IN IT, AND THAT IS THE SERVER'S RULE RATHER THAN A GAP HERE:
// `quoteOwned` accepts book, screen and utterance and returns false for anything
// else, so a book or a film cannot BE an entry. A work's menu gathers the passages
// it holds — see workRule below.
export const ANTHOLOGY_KIND = { annotation: 'book', dialogue: 'screen', quote: 'utterance' }

// useAnthologies is the list plus its reload, in one place, because four things
// need it: the list screen, the picker, a work's menu and the reading view's way
// back to a fresh count.
//
// `rows` starts null and becomes an array, so an empty state can be gated on
// "loaded AND empty" rather than flashing "nothing here yet" while the request is
// still out.
export function useAnthologies() {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const reload = useCallback(async () => {
    const r = await json('GET', '/anthologies')
    if (!r.ok) return setError(errText(r, t('error.load.anthologies')))
    setRows(r.data.anthologies || [])
    setError('')
  }, [])
  useEffect(() => {
    reload()
  }, [reload])
  return { rows, error, reload }
}

// gatherInto — EVERY WAY INTO AN ANTHOLOGY, IN ONE FUNCTION.
//
// The repo's directive, in the owner's words: "similar things should act
// similarly", and a control drawn on two screens has one behaviour living in one
// function "not in a line each, which is how one of them goes on being right while
// the other quietly stops". Four surfaces now ask this question — the selection
// bar, a work's menu, an annotation's menu and the search screen — and the answer
// has three moving parts (make it if it is new, add what is in hand, remember the
// query if asked). Three of those surfaces getting two parts right each is exactly
// the failure the directive describes.
//
// `target` IS `{ id }` OR `{ title }`, which is what the picker returns. Creating
// on `{ title }` is a second call and not a server change: POST /anthologies takes
// no rule (see its handler), so a rule is always the fill that follows — and the
// fill endpoint needs an id, so a new anthology has to land first whichever route
// asked for it.
//
// THE ORDER MATTERS AND IS NOT ARBITRARY. Entries in hand go in BEFORE the rule
// runs, so a reader who gathered five passages and also asked to keep it fed gets
// their five in the order they chose them and the query's matches after — rather
// than the query's order with theirs buried in it. A fill never removes and never
// reorders (anthology_fill.go says so), so this is stable.
export async function gatherInto(target, { items = [], rule = '', auto = false } = {}) {
  let id = target?.id
  if (!id) {
    const made = await json('POST', '/anthologies', { title: target?.title, intro: '' })
    if (!made.ok) return { ok: false, error: errText(made, t('error.add.generic')) }
    id = made.data?.id
  }
  let added = 0
  let skipped = 0
  if (items.length) {
    const r = await json('POST', `/anthologies/${id}/entries`, { items })
    if (!r.ok) return { ok: false, id, error: errText(r, t('error.add.generic')) }
    added += r.data?.added ?? 0
    skipped += r.data?.skipped ?? 0
  }
  if (rule) {
    const r = await json('POST', `/anthologies/${id}/fill`, { rule, auto })
    if (!r.ok) return { ok: false, id, error: errText(r, t('error.add.generic')) }
    added += r.data?.added ?? 0
    skipped += r.data?.skipped ?? 0
  }
  return { ok: true, id, added, skipped }
}

// gatheredToast — what happened, in the two sentences the selection bar already
// used. Here rather than there because three surfaces now report the same result
// and a duplicate is a duplicate.
//
// A DUPLICATE IS A SKIP AND NOT AN ERROR — the server ignores a passage already in
// the anthology — so this reports what the response says rather than assuming the
// whole lot landed. "5 added" over a gathering where two were already there is the
// kind of small lie that makes somebody stop trusting the count.
export function gatheredPhrase({ added = 0, skipped = 0 }) {
  // Two whole sentences rather than one plus an optional clause: the clause does
  // not necessarily come last in another language.
  return skipped
    ? t('common.selection.toast.gathered-some', { n: added, count: added, skipped })
    : t('common.selection.toast.gathered', { n: added, count: added })
}

// workRule — the query that means "the passages in this work".
//
// A BOOK CANNOT BE AN ENTRY, so a work's menu has to mean something else, and the
// owner chose which: it gathers the passages the work has now AND offers to keep
// the anthology fed as more are highlighted. Both halves are this one string —
// `gatherInto` fills from it immediately, and the auto switch is what makes the
// same string keep working afterwards.
//
// IT IS A CHIP AND NOT A HAND-BUILT PARAMETER, so the rule a work produces is
// spelled by the same grammar the search bar writes and can be pasted into it. The
// chip SENDS THE ID rather than the title, because two editions and the film of the
// book can share a name and only an id says which one was meant — see workSeedChip.
export const workRule = (kind, id) =>
  searchQueryString({ scope: 'all', chips: [workSeedChip(kind, id, '')].filter(Boolean) })

// useGatherDoor — the state, the dialog and the reporting, for any surface with
// something to gather.
//
// ONE HOOK AND NOT A COPY PER CARD. Four card kinds can open this now (a
// highlight, a film line, a standalone quote, a work) and each of them already
// owns a menu, an edit form and a dialog or two — so "just add the three lines" is
// four copies of the same three lines, which is exactly the shape the repo's
// directive names: "a control drawn by one component on two screens has ONE
// behaviour, and it lives in one function that both screens call — not in a line
// each, which is how one of them goes on being right while the other quietly
// stops".
//
// `open` TAKES WHAT TO GATHER — `{ items }` for passages in hand, `{ rule }` for a
// query — and the caller renders `node` beside its own dialogs.
export function useGatherDoor() {
  const [pending, setPending] = useState(null)
  const open = useCallback((what) => setPending(what || {}), [])
  const close = useCallback(() => setPending(null), [])
  const node = pending ? (
    <AddToAnthologyDialog
      count={pending.count ?? (pending.items || []).length}
      rule={pending.rule || ''}
      onApply={async (target, { auto }) => {
        setPending(null)
        const r = await gatherInto(target, { items: pending.items || [], rule: pending.rule || '', auto })
        toast(r.ok ? gatheredPhrase(r) : r.error)
      }}
      onClose={close}
    />
  ) : null
  return { open, node }
}

// A COMBOBOX AND NOT A `Select`, which is the whole of what changed here and the
// reason this dialog is now reachable from three more places.
//
// `Select` is a closed list, so this could only ever put a passage into an
// anthology that already existed — and with none it drew an error naming a screen
// the reader had to go to, make one on, and come back from, having lost the
// selection that brought them here. `SuggestCombo` is free text with suggestions
// and is explicitly "not a picker: nothing is ever restricted to the pool" (see
// suggest.jsx), so the name you type IS the create path and the list under it is
// the find path. One box, both answers, which is what the owner asked for.
//
// THE MATCH IS BY FOLDED NAME, so typing the name of one you already have picks it
// rather than making a second with the same title. Two anthologies may share a
// title (the form's own header says so), but that is a thing you do deliberately
// from the anthologies screen, never a thing a picker should do to you because of
// your capitalisation.
//
// `rule` IS OPTIONAL AND IS WHAT THE SEARCH AND A WORK HAND IN. Where it is given
// the dialog also offers to keep the anthology fed from that same query — the 0075
// machinery, reached at last from the two places a reader actually has a question
// in front of them rather than only from an anthology they already made.
export function AddToAnthologyDialog({ count = 0, busy, rule = '', onApply, onClose }) {
  const { rows, error } = useAnthologies()
  const list = rows || []
  const [name, setName] = useState('')
  const [auto, setAuto] = useState(false)
  const typed = name.trim()
  const match = list.find((a) => String(a.title || '').trim().toLowerCase() === typed.toLowerCase())
  // `{ id }` for one that exists, `{ title }` for one that does not. The caller
  // creates it — see gatherInto — because only the caller knows what to do with the
  // anthology once it is there.
  const target = typed ? (match ? { id: match.id } : { title: typed }) : null
  return (
    <FormModal
      open
      onClose={onClose}
      title={rule ? t('common.anthology.gather.title') : t('common.anthology.add.title', { count, n: count })}
      maxWidth={460}
      // The pair, and the count is one because this press changes one thing: which
      // anthology these passages are in.
      dirty={target ? 1 : 0}
      closeDanger
    >
      <AnthologyPickerForm
        list={list}
        name={name}
        setName={setName}
        typed={typed}
        match={match}
        target={target}
        rule={rule}
        auto={auto}
        setAuto={setAuto}
        count={count}
        busy={busy}
        error={error}
        onApply={() => onApply(target, { auto })}
      />
    </FormModal>
  )
}

// The body, SEPARATE for the reason identityPicker.jsx states: `useFormHost` reads
// the context `FormModal` puts around its CHILDREN, so calling it in the component
// that renders the modal registers with whatever surface is further out, and this
// dialog would draw no ✓ at all.
function AnthologyPickerForm({ list, name, setName, typed, match, target, rule, auto, setAuto, count, busy, error, onApply }) {
  const blocked = busy ? t('common.action.save.busy') : target ? '' : t('common.anthology.add.blocked')
  const host = useFormHost(blocked)
  return (
    <form
      id={host?.formId}
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (!blocked) onApply()
      }}
    >
      <p className="microcopy">
        {rule ? t('common.anthology.gather.body') : t('common.anthology.add.body', { count, n: count })}
      </p>
      <SuggestCombo
        label={t('common.field.anthology.label')}
        value={name}
        onChange={setName}
        placeholder={t('common.anthology.add.combo.placeholder')}
        options={list.map((a) => ({ name: a.title }))}
      />
      {/* WHICH OF THE TWO THIS PRESS WILL DO, said before it happens rather than in
          a toast afterwards. A reader who typed a name one letter off an existing
          anthology is about to make a second one, and this line is the only place
          that can tell them while it is still cheap to fix. */}
      {typed && (
        <p className="microcopy opacity-80">
          {match ? t('common.anthology.add.existing') : t('common.anthology.add.creating', { title: typed })}
        </p>
      )}
      {rule && (
        <div className="flex items-center justify-between gap-3">
          <span className="min-w-0">
            <MonoLabel>{t('anthologies.rule.auto.label')}</MonoLabel>
            <p className="microcopy mt-0.5">{t('anthologies.rule.auto.hint')}</p>
          </span>
          <Toggle
            ariaLabel={t('anthologies.rule.auto.label')}
            value={auto ? 'on' : 'off'}
            onChange={(v) => setAuto(v === 'on')}
            options={[['off', t('common.toggle.off.label')], ['on', t('common.toggle.on.label')]]}
          />
        </div>
      )}
      <ErrorText>{error}</ErrorText>
    </form>
  )
}
