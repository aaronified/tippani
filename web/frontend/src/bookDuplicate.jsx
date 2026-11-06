import { t } from './i18n.js'
import { GhostButton, NameScroll } from './ui.jsx'

// BookDuplicateConfirm — a book with this title is already in the library. The server held the add
// (409 + needs_confirm) and sent the look-alikes; adding again is a decision, because a second
// edition is legitimate, so it is asked rather than assumed. A film's dialog offers to enrich the
// existing row; a book has nothing to enrich from a typed title, so the choices are the two that are
// real: add it anyway, or stop.
export function BookDuplicateConfirm({ title, existing, busy, onAddSeparate, onCancel }) {
  return (
    <div className="hand-card hc-r1 book-duplicate" data-testid="book-duplicate">
      <p className="text-sm">{t('books.duplicate.lead', { title })}</p>
      <ul className="book-duplicate-list">
        {existing.map((e) => (
          <li key={e.id} className="book-duplicate-row">
            <NameScroll as="p" className="text-sm font-semibold">{e.title}</NameScroll>
            {e.author ? (
              <p className="book-duplicate-author">{e.author}</p>
            ) : null}
          </li>
        ))}
      </ul>
      <div className="book-duplicate-actions">
        <button type="button" className="tp-btn tp-btn-primary" disabled={busy} onClick={onAddSeparate}>
          {t('books.duplicate.separate.label')}
        </button>
        <GhostButton type="button" disabled={busy} onClick={onCancel}>
          {t('common.action.cancel.label')}
        </GhostButton>
      </div>
    </div>
  )
}
