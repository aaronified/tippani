# ADR-0360: "Export all" was renamed, because all three screens export the filtered view

Source of truth: this wiki page.

- **Area:** [§10 What Leaves the App: Exports, Round-Trips and the Shared Image](ADR-Index.md#area-10)
- **Status:** Accepted

**Decided.** The button no longer says *Export all* and the help no longer says "the whole library".

**Why.** All three list screens post the filtered view, and the confirmation dialog has always said "N in view" — so the button and the help were the last survivors of a whole-collection export they had already replaced. A control that describes an older version of itself is worse than an unlabelled one, because it is believed. Mine, and it is a one-word fix recorded here because the failure mode — copy outliving behaviour — is the one I keep having to catch.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
