# ADR-0687: The top bar holds where you are and how to leave

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted

- **Decided** — a breadcrumb (`root / leaf`, the leaf capped at `34ch`), a search field
  carrying the current scope as a dismissable pill, and help. The magnifier key is gone.
- **Why** — the rail took the brand and the tabs and left an empty strip. What a bar is
  actually good for is the pair the pack puts back: where you are, and how to leave.
- **Dropping the scope pill IS global search** — same field, no pill, everything in
  range. So the `×` lives on the scope rather than beside it as a second "search
  everywhere" verb: one control, and its presence or absence is the whole state. That
  replaces the globe and the hidden right-click that toggled `tippani:search:global`.
- **The phone keeps the magnifier and the preference**, because it has no room for a
  field. Two models for one feature, and defensible: a scope you can drop on every search
  is a preference you no longer need to set, and only the wide frame can offer that.
- **`useCrumb` / `useCrumbTitle`** — a publish/subscribe in the shape `toast` already
  uses, because the shell draws the crumb and the screen knows the title three components
  apart. **Instead of** threading a prop from Shell through Library into BookDetail: that
  puts a shell concern in two screens' signatures and the Catalogue needs the identical
  pair, so the price is paid twice for one string.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
