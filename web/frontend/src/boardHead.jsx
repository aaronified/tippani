// THE BAR ABOVE EVERY BOARD OF QUOTES, AND THERE IS ONE OF IT.
//
// A book's highlights and a film's lines are the same thing, so the bar above
// them is one component, drawn once. It is deliberately small: a sort (the order
// the quotes are in, and which way), a favourites toggle, and the one verb that
// adds a quote. Grouping, views, colour categories and tags were each a second
// question a reader had to answer before the quotes were the quotes, and are not
// drawn here any more.
import { t } from './i18n.js'
import { FilterChip, IconSortAsc, IconSortDesc, MonoLabel, Select, StickerButton } from './ui.jsx'

// The sort, and its direction, as one control pair. `sort` is { col, dir }.
function SortControl({ sort, onSort, sortOptions }) {
  return (
    <>
      <label className="flex items-center gap-2">
        <MonoLabel>{t('common.filters.sort.label')}</MonoLabel>
        <Select
          ariaLabel={t('common.filters.sort.aria')}
          value={sort.col}
          onChange={(col) => onSort((cur) => ({ col, dir: cur.dir }))}
          options={sortOptions}
        />
      </label>
      <button
        type="button"
        className="board-strip-dir"
        aria-label={t(sort.dir === 'asc' ? 'board.sort.dir.asc.label' : 'board.sort.dir.desc.label')}
        onClick={() => onSort((cur) => ({ col: cur.col, dir: cur.dir === 'asc' ? 'desc' : 'asc' }))}
      >
        {sort.dir === 'asc' ? <IconSortAsc size={16} /> : <IconSortDesc size={16} />}
      </button>
    </>
  )
}

export function BoardHead({ sort, onSort, sortOptions, fav, onFav, captureLabel, onCapture }) {
  return (
    <div className="board-head">
      <div className="board-head-left">
        <FilterChip active={fav} label={t('common.filters.favourites.label')} tooltip={t('common.favourite.filter.tip')} onClick={() => onFav(!fav)} />
      </div>
      <div className="board-head-verbs">
        <SortControl sort={sort} onSort={onSort} sortOptions={sortOptions} />
        {onCapture && <StickerButton onClick={onCapture}>{captureLabel}</StickerButton>}
      </div>
    </div>
  )
}
