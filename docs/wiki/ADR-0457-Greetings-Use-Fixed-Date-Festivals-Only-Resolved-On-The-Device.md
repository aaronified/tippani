# ADR-0457: Greetings use fixed-date festivals only, resolved on the device, with no user-extension escape hatch

Source of truth: this wiki page.

- **Area:** [§13 Controls, Labels, Icons and Help](ADR-Index.md#area-13)
- **Status:** Accepted
- **Version:** post-1.4.0

**Decided.** A date earns a place only if it falls on the same Gregorian month and day every year forever, or can be computed exactly from a stated rule (Easter's computus; "the fourth Thursday in November"). Nothing lunar, lunisolar, moon-sighted or decreed annually — no Diwali, Holi, Eid, Lunar New Year, Vesak or Rosh Hashanah. Everything resolves from the device's own clock, date and IANA zone; nothing is asked of the server and there is no network call.

**Why.** Moving festivals differ by year and several differ by country within the same year, so a table of them written from memory would be confidently wrong, and a wrong festival greeting is worse than no greeting. The list was then adversarially re-checked, which turned up: days anchored to a living monarch move on succession (the Netherlands' King's Day has been 31 Aug, 30 Apr and 27 Apr; Thailand's moved from 5 Dec to 28 Jul), England's St George's Day is transferred around Easter and no IANA zone can express "England" anyway, and Africa/Addis_Ababa is a tzdb *Link* to Africa/Nairobi so a canonicalising platform reports Ethiopian devices as Kenyan — Ethiopia is absent rather than mislabelled. Fixed national days that commemorate the dead carry a "Marking …" line instead of "Happy", and Taiwan's 228 and Rizal Day were dropped entirely for the same reason.

**Instead of.** A user-extensible list — refused explicitly. An empty "add your own dates here" is an invitation to break the rule later.

**Approved.** My call throughout, and refusing the escape hatch is the part I approved hardest: it is the polite-looking option that quietly makes the rule optional.

<sub>post-1.4.0 — `web/frontend/src/greetings.js`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
