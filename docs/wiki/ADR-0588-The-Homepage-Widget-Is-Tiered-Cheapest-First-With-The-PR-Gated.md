# ADR-0588: The Homepage widget is tiered cheapest-first, with the PR gated upstream

Source of truth: this wiki page.

- **Area:** [§16 Serving and Running It: HTTP Surface, Logging, TLS and Updates](ADR-Index.md#area-16)
- **Status:** Accepted
- **Version:** planned

**Decided.** The dashboard widget is planned in three tiers, cheapest first. Tier one documents what already works: the unauthenticated `/healthz` means any dashboard can ping Tippani today, so a "Dashboards" page with a ready-to-paste `services.yaml` snippet and the optional `homepage.*` compose labels costs nothing and lands first. Tier two is Homepage's `customapi` widget, which renders live counts with zero upstream code — but its requests come from the Homepage *server* with no session cookie, so it rides on the per-user API tokens and needs a slim read-only stats surface accepting `Authorization: Bearer`. That is the real deliverable. Tier three is a native first-party widget, a PR into `gethomepage/homepage`, and it is gated on upstream rules rather than on my readiness: the widget must target a feature-request discussion with at least 20 up-votes, and widgets for projects under about a year old get declined. So the discussion opens early to accumulate votes and the PR waits for 2027, consuming the exact endpoint tier two already built. I approved the tiering, and the honest part is tier three's gate — the schedule belongs to someone else's project, and pretending otherwise would put a deliverable on the roadmap that I cannot deliver.

**Instead of.** Going straight to the native widget, which would be submitted into a decline.

<sub>planned — [homepage widget](Roadmap.md#homepage-widget) — `docs/roadmap.html`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
