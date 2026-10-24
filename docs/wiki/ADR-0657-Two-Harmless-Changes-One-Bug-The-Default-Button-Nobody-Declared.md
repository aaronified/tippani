# ADR-0657: Two harmless changes, one bug: the default button nobody declared

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 2.2.4

**Decided.** The work Details panel's `<form>` swallows Enter from any `<input>`, and the People panel's own boxes act on it.

**How it happened, because the shape is the point.** 2.2.3 made the header ✓ always-enabled (it was greyed with "Nothing to save" almost all the time, which is its own entry above). Separately, 2.2.3 put the new People panel inside that form. Neither is wrong. Together they are: `type="submit" form={formId}` makes the ✓ the form's DEFAULT BUTTON, and HTML implicitly submits a form on Enter in a text input **when it has one**. A form whose default button is disabled is not implicitly submitted — so the greying had been suppressing this, invisibly, for every input the panel has ever contained.

**Nothing could have caught it.** jsdom does not implement implicit submission at all, so the browser behaviour under test simply does not exist in the test environment. Both commits were covered; the tests that covered them are still correct.

**So the test asserts the MECHANISM rather than the outcome**: that the keydown's default is prevented before it can reach the form. One case appends a bare `<input>` to the form and presses Enter — the case that fails the day somebody narrows the guard to the controls they remembered.

**The guard is on the form and not on the controls**, which is the opposite of where the bug was introduced. A box added to this panel next year inherits it. Textareas are exempt: they take a newline and never implicitly submit.

<sub>2.2.4 — `web/frontend/src/WorkDetails.jsx` · `web/frontend/src/cast.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
