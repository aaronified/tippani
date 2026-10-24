# ADR-0566: A component used in JSX and never imported is caught by reading every capitalised tag, not every Icon

Source of truth: this wiki page.

- **Area:** [§15 Appearance as Material: Skins, Texture, Type and Colour](ADR-Index.md#area-15)
- **Status:** Accepted
- **Version:** 1.15.2

**Decided.** `icon-imports.test.js` reads every `.jsx` screen for a capitalised JSX tag that appears in no import and no local declaration. It resolves named, default and namespace imports, top-level declarations, and a component taken as a renamed prop with a default (`{ form: Form = AnnotationForm }`), and it is handed the broken shape directly so a clean tree cannot pass it for the wrong reason.

**Why it was widened.** It was scoped to `Icon*` when it was written, on the stated grounds that glyphs are the ones passed as props and buried in branches and that "the narrow rule is one nobody has to argue with". Then Settings' language-mark tray shipped `<Field>` with no import: same branch shape, same silence, same `ReferenceError` on the one click the card exists for — and the test watched it go past because the missing name did not begin with `Icon`. A test that names a class of bug and then catches one spelling of it is not catching the class.

**A rename with no default is deliberately not matched.** `key: Value = default` is legal only in a destructuring pattern, never in an object literal, so requiring the `=` is what keeps this from quietly blessing `{ icon: IconFoo }` written without an import. A bare rename would be reported as missing — which is the right direction to fail: loud, one file named, one line to fix here.

**Instead of** adding ESLint. There is no lint step in this project and adding one for a single rule is a dependency, a config and a CI job to keep the rule that a twenty-line test already keeps.

**Approved.** Mine, prompted by the crash.

<sub>1.15.2 — `web/frontend/test/rules/icon-imports.test.js` · `web/frontend/src/Settings.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
