# ADR-0585: The manual update command became one idempotent line

Source of truth: this wiki page.

- **Area:** [§16 Serving and Running It: HTTP Surface, Logging, TLS and Updates](ADR-Index.md#area-16)
- **Status:** Accepted
- **Version:** 0.6.2

**Decided.** The command shown in Settings → Updates was `docker compose pull && docker compose up -d`, and it is now `docker compose up -d --pull always --force-recreate` — one step that always re-pulls the tag and always recreates the container. The two-step form depended on `up -d` deciding a recreate was warranted, which is a judgement about the compose config rather than about the image, so it could complete without doing the thing the operator ran it for. One line that is unconditional is better than two that are conditional, especially in a copy-paste box. I approved the change; the reasoning recorded at the time is exactly the clause "one step that always re-pulls the tag and recreates the container", and I am not going to dress it up further.

**Instead of.** The two-step form, or `docker compose pull && up -d --force-recreate`, which is still two steps.

**Reversal.** Yes, of the 0.6.0 command.

<sub>0.6.2 — `README.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
