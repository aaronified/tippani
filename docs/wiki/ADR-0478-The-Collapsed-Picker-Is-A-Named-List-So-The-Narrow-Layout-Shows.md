# ADR-0478: The collapsed picker is a named list, so the narrow layout shows more than the wide one

Source of truth: this wiki page.

- **Area:** [§14 Boards, Cards, Charts and Popups](ADR-Index.md#area-14)
- **Status:** Accepted
- **Version:** `web/frontend/src/index.css`

**Decided.** Below the threshold the control becomes the current colour with a chevron, opening a list of category **names**.

**Why.** The stylesheet described this a release before it happened: the rule sizing the control on a quote card reads "♥ + FOUR blobs + ⋯ must fit a ~250px column", and 1.7.1 made the categories six. Packing them closer buys one release. But since the categories carry names the reader chose, six unlabelled blobs squeezed to fit are six things nobody can tell apart — so the collapsed form is better than the cramped row would have been anyway, and the narrow layout ends up showing strictly more information than the wide one. The trigger deliberately carries no selection ring: the ring exists to pick one dot out of six, and the trigger *is* the one dot, so a ring there says "this one" to a row of one. I approved the inversion rather than treating it as a compromise.

<sub>`web/frontend/src/index.css`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
