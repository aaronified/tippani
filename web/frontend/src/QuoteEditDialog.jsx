import { lazy, Suspense, useEffect, useState } from 'react'
import { errText, json } from './api.js'
import { t } from './i18n.js'
import { FormModal, toast } from './ui.jsx'

// The edit form of one quote, opened from a screen that is not the quote's own.
//
// Checks lists a quote because something in it needs a look, and the fix is usually a
// word in the text, so the row opens the SAME form the work's page does rather than a
// smaller one that has to be kept in step with it. It is the review card's arrangement
// (review.jsx): the list endpoints already carry the exact row an edit form wants, so
// `?id=` asks for one, and the save is the same full-state PUT every other edit makes.
//
// The three forms are loaded when one is wanted. Library, Movies and Quotes are large
// screens, and the Checks page is open for a long time without anyone editing a quote.
const AnnotationForm = lazy(() => import('./Library.jsx').then((m) => ({ default: m.AnnotationForm })))
const DialogueForm = lazy(() => import('./Movies.jsx').then((m) => ({ default: m.DialogueForm })))
const UtteranceForm = lazy(() => import('./Quotes.jsx').then((m) => ({ default: m.UtteranceForm })))

// `kind` is the sweep's word (book | screen | quote), the same one the rows carry.
const KINDS = {
  book: { list: '/annotations', rows: 'annotations', title: 'common.quote.edit.title' },
  screen: { list: '/dialogues', rows: 'dialogues', title: 'common.dialogue.edit.title' },
  quote: { list: '/quotes', rows: 'utterances', title: 'common.quote.edit.title' },
}

export default function QuoteEditDialog({ kind, id, onClose, onSaved }) {
  const spec = KINDS[kind]
  const [row, setRow] = useState(null) // the full row; null while loading
  const [boards, setBoards] = useState([])

  useEffect(() => {
    let live = true
    json('GET', `${spec.list}?id=${id}`).then((r) => {
      if (!live) return
      const found = r.ok ? (r.data?.[spec.rows] || [])[0] : null
      if (!found) {
        toast(errText(r, t('error.load.quiz-card')))
        return onClose()
      }
      setRow(found)
    })
    // A standalone quote is filed on a board, and the form offers the others.
    if (kind === 'quote') json('GET', '/boards').then((r) => live && r.ok && setBoards(r.data?.boards || []))
    return () => {
      live = false
    }
  }, [kind, id])

  // The form shows the string this returns under its fields, so a refusal stays beside
  // what was typed instead of becoming a toast over a closed dialog.
  async function save(fields) {
    const r = await json('PUT', `${spec.list}/${id}`, fields)
    if (!r.ok) return errText(r, t('error.save.annotation'))
    toast(t('common.toast.saved'))
    onSaved()
    return null
  }

  if (!row) return null
  const form = { initial: row, onSubmit: save, onCancel: onClose, submitLabel: t('common.action.save.label') }
  return (
    // dirty={1}: the tick is the form's save, as on the signature sheet. The forms hold their
    // own draft, so the dialog cannot count what changed, and one is the honest floor.
    <FormModal open onClose={onClose} title={t(spec.title)} dirty={1}>
      <Suspense fallback={null}>
        {kind === 'book' && <AnnotationForm {...form} />}
        {kind === 'screen' && <DialogueForm {...form} />}
        {kind === 'quote' && <UtteranceForm {...form} boards={boards} />}
      </Suspense>
    </FormModal>
  )
}
