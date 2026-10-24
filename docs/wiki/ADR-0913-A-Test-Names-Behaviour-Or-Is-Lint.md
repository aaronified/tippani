# ADR-0913: A test names behaviour, or it is lint, or it is deleted

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

The frontend suite had 3,804 tests, most asserting wording, markup or the internals of a component, so each edit failed ten of them
without a real mistake. It was cut to the tests that name something a person sees happen, one per behaviour, keeping every
regression the owner reported. Source-reading design rules moved to `test/rules` and run as `lint:rules`, which is not counted
as tests. Tests that read documentation text were deleted.

**Why.** The sibling project fluenough made the same cut (5,165 to 469) on the owner's ruling: "there is no need for 4000+ tests.
You should only check behaviour." See [Testing](Testing.md).

**Rejected.** Cutting by coverage figure: it rewards tests that execute lines and say nothing.

See also: [ADR index](ADR-Index.md) · [Home](Home.md)
