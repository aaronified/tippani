# ADR-0662: A form inside a form, and why a portal does not save you

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 2.2.5

**Decided.** The work Details form answers a submit only when `e.target === e.currentTarget`, and `PersonForm` stops its own submit at its own form.

**The bug.** The People panel opens the person editor inline, so its `<form>` sits inside the Details `<form>`. Pressing Save on a person ran `PersonForm.submit` and then `FieldList.submit` — which closes the panel, and, with a field row open and dirty, wrote the record. `CoverPicker.jsx` had already written this rule down after the same fault ("the search bounces to the homepage"); the cast panel broke it a year later.

**THE PART THAT IS WORTH KNOWING: a portal does not fix it.** React's synthetic events bubble through the REACT tree, not the DOM tree, so rendering the modal through `createPortal` — which is what the DOM nesting problem seems to call for — leaves the submit bubbling exactly as before. The fix is either to stop it at the inner form or to ignore it at the outer. Both are here, because they fail in opposite directions: the inner one is right at the source and is one line a future modal can forget; the outer one is a rule the panel keeps for every form anybody puts inside it.

**And it was latent for a release.** Before the tick stopped being greyed, `submit` began `if (!unsaved.count) return`, so the stray submit usually did nothing. Making the tick always-enabled did not introduce the leak; it armed it.

<sub>2.2.5 — `web/frontend/src/WorkDetails.jsx` · `web/frontend/src/people.jsx` · `web/frontend/src/cast.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
