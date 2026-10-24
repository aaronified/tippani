# ADR-0372: The tint defaults off, and the storage key was retired to make that true

Source of truth: this wiki page.

- **Area:** [§10 What Leaves the App: Exports, Round-Trips and the Shared Image](ADR-Index.md#area-10)
- **Status:** Accepted
- **Version:** `web/frontend/src/share.jsx`

**Decided.** Reversed. `tippani:shareImageTint` defaults to `false`, and the key is a new one. **Why I was wrong.** A colour category is a private filing decision — what *kind* of note this is to me — and the picture goes to someone who has no idea the scheme exists. To them a blue stripe or a blue face is a design choice the card is making, and a fairly loud one. The colour is worth offering and worth remembering; it is not worth assuming. The second half is the part I would have missed: `usePersistedState` writes on *mount*, so the old default had already been stamped into local storage by the first render of the panel on every device that ever opened it — flipping the literal alone would have changed the default for nobody. Retiring the key discards a value almost nobody chose, and the switch is one click away for anyone who did. Mine both times, and the second was the better call.

<sub>`web/frontend/src/share.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
