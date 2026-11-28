# ADR-0938: Astryx is dropped; the spike was not worth what it cost

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted
- **The owner, 28 November 2026:** "Ok, forget astryx then. Not gaining much there."

**What was decided.** The web pages are not rebuilt on Astryx, and not standardised on it either. The plan that was written for it, `Plan-Astryx-Redesign`, is deleted, and the next server release no longer waits for it. The web strip ([ADR-0936](ADR-0936-The-Web-App-Is-The-iPhone-Client-And-Is-Stripped-To-Eight-Jobs.md)) stands as it is.

**Why.** On 27 November the owner asked for the redesign first, then narrowed it on 28 November to standardisation with every screen unchanged. Measuring that narrower job showed little to gain for what it costs:

| | Gzipped JS and CSS |
|---|---|
| The web build at the strip's tip | about 600 KB |
| The spike's two Theme pages, Astryx and nothing else | about 825 KB |

Astryx alone cost more than the whole application, before any screen used it, and the spike had already shown clipping at large text and no Bengali in its own strings (31 locales shipped, none Bengali). A job whose success is "everything looks the same" cannot pay for itself in a bigger bundle: the only visible change would be the cost. Hand-written elements are real (228 buttons, 77 inputs, 18 dialogs) but most pass through the shared layer in `ui.jsx` already.

**Not changed.** The spike branch `claude/astryx-spike` was an experiment and was never merged. It existed only in the session that made it and is not kept.

**Rejected.** Standardising on a smaller component set (the floor is the runtime and styling layer, not the components); keeping the plan as a deferred item (a plan nobody will build in a place whose promise is "this is coming" is the staleness the plans index exists to prevent).
