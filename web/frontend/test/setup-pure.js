// Setup for the `pure` project — the node environment, no jsdom.
//
// One shim, and it exists for a specific reason rather than as a general
// convenience: theme.js calls window.matchMedia at MODULE scope, not inside a
// function —
//
//   const media = window.matchMedia('(prefers-color-scheme: dark)')
//   media.addEventListener('change', ...)
//
// — so it throws on import, before any test body runs. share.jsx imports
// theme.js, so buildShareText and every other genuinely pure function in that
// file is unreachable without this. The alternative was running those tests
// under jsdom, which is a lot of machinery to load a palette lookup table.
//
// Deliberately minimal: matchMedia and nothing else. If a test needs more of
// the DOM than this, it is a component test and belongs in test/dom.

if (typeof globalThis.window === 'undefined') {
  const noopMedia = {
    matches: false,
    media: '',
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  }
  globalThis.window = {
    matchMedia: (media) => ({ ...noopMedia, media }),
  }
}
