# ADR-0366: Copy falls back to a legacy path, because a plain-HTTP LAN instance has no async Clipboard API

Source of truth: this wiki page.

- **Area:** [§10 What Leaves the App: Exports, Round-Trips and the Shared Image](ADR-Index.md#area-10)
- **Status:** Accepted
- **Version:** `web/frontend/src/share.jsx`

**Decided.** `copyText` uses `navigator.clipboard` where it exists and `execCommand` where it does not. Image copy is gated on `ClipboardItem` and `navigator.clipboard.write` both being present, and the button is hidden rather than inert when they are not.

**Why.** `navigator.clipboard` is undefined on insecure origins, and a self-hosted instance on a LAN over plain HTTP is an insecure origin — which is the *default* deployment this app documents. The old path silently no-opped there, so "copy does nothing" was a real bug report from the most ordinary setup there is. Hiding the image-copy button rather than disabling it follows the same rule the portrait toggle uses: a control that cannot do its job is not a control. Mine.

<sub>`web/frontend/src/share.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
