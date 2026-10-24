# ADR-0899: People's role is a dropdown, and a desktop record's chips print in full

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

**Filters.** *"use similar ways. defects will be filtered via chips, type will be via
dropdown."* Works already had a type dropdown and Characters a work dropdown, each followed by
defect chips. People had role chips on a desk and a dropdown on a phone: one control in two
shapes, and a second row of chips that meant something different from the first. It is a
dropdown at every width, and its "All" became "all roles" to match "all types".

**Chips at full width.** The work chips on a desktop two-line record had kept a 14ch cap,
meant for rows that share their line, so "Sunset Boulev…" sat beside 900px of empty row. That
went against the owner's earlier *"utilise the full width"*. The cap lifts on `.record-row-lg`
from 769px up, and the row scrolls under its fade.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
