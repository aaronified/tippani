import { t } from './i18n.js'
import { FilterChip } from './ui.jsx'

// The filter every section of Checks' Files tab draws, in one shape: All, then one pill per
// group with how many it holds. It is the stray-marks sweep's rule row (CleanupPage), so a
// reader who has learnt one has learnt all of them. The sections used to filter four ways
// (group headings that opened, headings with no control at all, a row of chips, nothing),
// and "Corrections from the file" had one of its own.
//
// `options` is [[id, label, count]]. One group is not a choice, so a lone group draws no row.
export function BucketFilter({ options, value, onChange }) {
  if (options.length < 2) return null
  return (
    <div className="flex flex-wrap items-center gap-2" role="group">
      <FilterChip active={value === 'all'} keepLabel label={t('cleanup.filter.all.label')} onClick={() => onChange('all')} />
      {options.map(([id, label, n]) => (
        <FilterChip
          key={id}
          active={value === id}
          keepLabel
          label={`${label} ${t('cleanup.row.times', { n })}`}
          onClick={() => onChange(id)}
        />
      ))}
    </div>
  )
}

// A pill whose group has gone (the last proposal in it was answered) falls back to All rather
// than leaving a filter that can only show nothing.
export const livePill = (value, ids) => (value === 'all' || ids.includes(value) ? value : 'all')
