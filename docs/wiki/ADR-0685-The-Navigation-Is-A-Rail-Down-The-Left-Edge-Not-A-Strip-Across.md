# ADR-0685: The navigation is a rail down the left edge, not a strip across the top

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted

- **Decided** — nine destinations in a fixed column: 236px with words at 1180+, 68px of
  glyphs above 769, and nothing at all on a phone, which keeps its drawer and bottom bar.
  The brand, the destinations and the account live there; the top bar keeps the controls
  that act on the screen you are looking at.
- **Why** — a tab strip spends the top of every page on navigation, and the top of a page
  is where the thing you came to read starts. The rail takes width nothing was using and
  gives every screen its first inch back. It also has room for a number against each
  destination, which the strip never did.
- **Instead of** — keeping the strip and restyling it. Rejected because the layout the
  design pack draws for a work assumes a rail; building the screens inside the old frame
  would have meant drawing each of them twice.
- **The rail is `position: fixed` beside a normally-scrolling page**, and NOT the
  prototype's fixed-height app shell with independently scrolling columns. This app
  scrolls the window, and that is wired into scroll restoration, the sticky page bars and
  `useHideOnScrollDown`; a fixed rail is the same picture with none of that rewritten.
  The work-detail screen may still own real internal scrollers without the shell changing.
- **769px and not the pack's 700.** The pack calls anything under 700 a phone; this app
  has drawn that line at 768 since it had a mobile shell, and everything else agrees with
  it. At 700 the rail, the phone's top bar and the floating bottom nav all showed at once.
- **Approved** — mine, from a batched decision list, with a render of every width reviewed
  before anything was committed.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
