# ADR-0676: The route was right and nothing was asking

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 2.2.8; one request 3.1.0

**Decided.** A work page asks for the portraits it is about to draw. Since 3.1.0 it asks in one request, `POST /{books|movies}/{id}/cast/art` (`useCastArt`), which also carries the character art; the server fetches both serially under the caps below, within about forty-five seconds, and answers how many of each arrived.

**The second time this exact shape has been found**, and the first was 2.2.3's
`useCharacterArt`: `POST /cast/{id}/image` had been written so "a client may call this for
every chip it is about to draw" and no client ever did. `POST /people/portrait` is the
same story — it resolves an actor's headshot from the cast row the library already holds,
and its only caller was PersonModal's own effect, which runs when you open ONE person.
Twenty credits meant twenty panels opened by hand.

**A ROUTE WITH NO CALLER PASSES EVERY CHECK IN THIS REPO.** Its handler tests pass, `go
vet` is silent, the registry entry is present. That is now twice, so it is a pattern and
not an accident: when a fetch is written "for a client to call", the commit that writes it
must contain the client.

**Three restraints, each invisible when broken.** Serial and capped at twenty, so a
self-hosted box does not open twenty outbound connections because somebody opened a film.
Asked once per name per mount, tracked in a ref rather than inferred from the map — the
obvious version re-asks on every render for the people with no findable portrait, which is
most minor credits, for ever. And `onFilled` only when something arrived, because a reload
that changes nothing is a request and a re-render, and that is how a quiet loop starts.

**3.1.0 moved the loop onto the server, and the restraints split between the two.**
`usePortraitFill`, `useCharacterArt` and the cast panel's `fillImages` were three loops in the
browser, a request per picture — twenty roles and twenty actors were forty outbound fetches
the moment a film opened, each its own record, and a parent's refetch part-way cut a loop
short. Serial and capped at twenty is the server's now. Asked once per name per mount, and
`onFilled` only when something arrived, stay the page's, and one request is in flight per
work, so the film board and the Details panel on one page join the same one and both hear
its answer.

**Deliberately not wired to authors and directors yet.** An author resolves through Open
Library, one outbound lookup each; firing twenty of those when a shelf opens is a
different decision from this one and should be made on its own.

<sub>2.2.8; one request 3.1.0 — `web/frontend/src/cast.jsx` · `web/frontend/src/Movies.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
