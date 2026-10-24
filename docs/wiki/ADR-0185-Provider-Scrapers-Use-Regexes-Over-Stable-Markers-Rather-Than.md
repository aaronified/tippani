# ADR-0185: Provider scrapers use regexes over stable markers rather than adding an HTML parser

Source of truth: this wiki page.

- **Area:** [§6 People, Credits and Metadata Providers](ADR-Index.md#area-6)
- **Status:** Accepted

**Decided.** Hardcover's journal page is read by scanning between the `data-page` attribute's delimiters and decoding the JSON inside. Amazon's product page is read by three regexes over `og:title`, `og:image` and `og:description`.

**Why.** Both targets have a stable marker that carries everything needed, so a full parse buys nothing and costs a dependency — the plan holds Go direct deps at four, and a parser would be a fifth for two best-effort code paths. The `og:` tags in particular are the part of an Amazon page least likely to move, precisely because they exist for other people's crawlers. Both are explicitly fragile-proof rather than robust: an unreadable page returns an explanatory error rather than partial garbage, because half-scraped metadata written into a library is worse than none. I approved the regex approach with the fragility written down instead of denied.

<sub>`internal/importer/hardcover.go` · `internal/metadata/amazon.go` · `docs/wiki/Design-decisions.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
