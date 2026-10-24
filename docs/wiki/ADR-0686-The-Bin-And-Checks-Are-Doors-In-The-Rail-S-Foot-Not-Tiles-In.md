# ADR-0686: The bin and Checks are doors in the rail's foot, not tiles in Settings

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted

- **Decided** — the bin and a new **Checks** screen sit below the rule at the foot of the
  rail, each with its count. Their tiles are gone from Settings. Checks holds the two
  lists that ask something of you: the import queue and the stray-marks pass.
- **Why** — Settings is where you go to change how the app behaves, not to discover it is
  waiting on you. A queue nobody can see from the screen they are on is a queue that is
  found by accident. `routes.js` already argued that the bin is not a destination — that
  argument is about the nav strip, and the foot, below the rule, is exactly the place for
  a door that is not a place you go to read.
- **Instead of** — calling it *Review*, which is what the pack's shape suggests. Rejected
  because this app already means the daily quiz and the spaced-repetition deck by that
  word, and two meanings for one word in one app is how a rename becomes a support
  question. Also rejected: two separate foot rows, which would have made the foot four
  rows plus an account and started competing with the destinations above it.
- **The staging invariant is untouched.** An import still lands in the queue and is
  approved out of it. What changed is that a waiting one is now visible from every screen.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
