# ADR-0887: A bullet that was a control character and the digit 2

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

`.cl-entry::before` had `content: "<U+0082>2"` — an invisible C1 control followed by a
literal 2, which is `content: "\2022 "` with its backslash lost. Seventy releases of the
changelog were marked with a tofu box and a numeral, reading as a list that starts at two
and never counts up.

**IT SURVIVED BECAUSE NOTHING CAN SEE GENERATED CONTENT.** It is not in the DOM, so no
test in this repo can assert on it; at `var(--faint)` on a dense log a numeral two is
plausible until somebody reads the declaration or looks closely at a capture. The capture
sweep found it by doing the second. The trailing space in the replacement is part of the
escape, not part of the bullet: CSS ends a unicode escape at the first non-hex character
or at one space, which it then swallows.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
