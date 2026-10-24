# ADR-0699: Splitting an alias back out gives a record and moves nothing

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** Unreleased

- **Decided** — `POST /people/id/{id}/split {alias}` makes a new record carrying that
  spelling and leaves every work where it is.
- **Why nothing moves.** The alias says *this spelling finds that record*; it does not say
  which works were credited under it, and the credit rows do not remember. Guessing —
  taking every work whose `credit_as` matches the alias — would be right often enough to be
  trusted and wrong often enough to move somebody's books to a person they never wrote for.
  So the split is the smallest true act: the spelling stops resolving here and starts
  resolving to a record of its own, and the reader moves the works themselves.

<sub>Unreleased — `internal/store/identity.go` (SplitPersonAlias) · `internal/httpapi/identity_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
