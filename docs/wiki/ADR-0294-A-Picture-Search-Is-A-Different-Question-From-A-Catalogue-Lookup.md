# ADR-0294: A picture search is a different question from a catalogue lookup, and gets its own route

Source of truth: this wiki page.

- **Area:** [§8 The Review Loop](ADR-Index.md#area-8)
- **Status:** Accepted

**Decided.** `POST /images/search {kind, …}` answers with `{images: [{url, thumb, source}], sources: {…}}` for the three things the app puts a picture on — a book's cover, a screen work's poster, a person's portrait. Three suppliers, none of them required: **Amazon's image CDN by ISBN-10 or ASIN**, which is keyless and probed with a HEAD before a candidate is offered; **Google Programmable Search** in image mode, which needs the reader's own key *and* engine id; and **Amazon's search page**, behind the session cookie that is already the opt-in for scraping. A supplier that fails contributes nothing and is not an error.

**Why it is not part of `/books/lookup`.** That route answers with RECORDS — title, author, year, blurb — and its candidates are things a work can BE. Art is a different question with different suppliers and a different failure mode, and folding image hits into a candidate list would put rows in the metadata picker that cannot be adopted as a record. The three pickers were also each answering it differently: a book's read whatever art the catalogue returned, a film's the same, and a person's had no answer at all.

**THE PREVIEW AND THE FILE ARE TWO URLS, and that is forced by the CSP.** `img-src` is an allowlist that matches `metadata.coverHosts`, and a web image search returns pictures from hosts that cannot be enumerated in advance — that set is the web. So a hit carries `thumb` (the supplier's own thumbnail host, which CAN be allowlisted — `*.gstatic.com` is the one host added) for the page to draw, and `url` (the original) for the server to fetch once the reader picks it, where no CSP applies. The picker keeps drawing the thumbnail for the pending pick until the save replaces both with a stored file. Rejected: relaxing `img-src` to `https:`, which trades a deliberate allowlist for a convenience; and proxying previews through our own host, which is a new fetch surface for something the reader has not chosen yet.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
