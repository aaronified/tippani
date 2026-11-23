// Home — the start page of the web app (ADR-0936). The two things a reader on a
// phone comes here for are Add and Search, so they are the page: a heading and
// two buttons. Nothing here fetches anything, so nothing here can fail to load.
//
// Add and Search are the same two doors the top bar and the dock carry, passed in
// by App so that every route into them stays one function.
import { t } from './i18n.js'
import { IconPlus, IconSearch } from './ui.jsx'

export default function Home({ onAdd, onSearch }) {
  return (
    <section className="home-start" aria-labelledby="home-start-title">
      <h1 id="home-start-title" className="home-start-title">{t('nav.tab.home.label')}</h1>
      <div className="home-start-actions">
        <button type="button" className="tp-btn tp-btn-primary" onClick={onAdd}>
          <IconPlus />
          {t('common.action.add.label')}
        </button>
        <button type="button" className="tp-btn" onClick={onSearch}>
          <IconSearch />
          {t('nav.tab.search.label')}
        </button>
      </div>
    </section>
  )
}
