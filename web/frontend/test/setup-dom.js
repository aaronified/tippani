// Setup for the `dom` project — jsdom plus the browser APIs jsdom does not have.
//
// Everything below is here because something in the app calls it unguarded, or
// because jsdom's answer is technically valid and practically useless. The
// second category is the dangerous one: a stub that returns zeros does not
// crash, it just makes the component compute the wrong thing quietly, which is
// exactly the failure mode a test suite is supposed to remove.

import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'

// ---- matchMedia: jsdom has none, and theme.js calls it at import time ----
if (!window.matchMedia) {
  window.matchMedia = (media) => ({
    matches: false,
    media,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  })
}

// ---- ResizeObserver: unguarded in ExpandableDescription, ExpandableText and
// Toggle's thumb placement, so its absence is a throw, not a degradation. ----
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

// ---- IntersectionObserver: useReveal guards on it and falls back to a rect
// read, so this is about testing the path that actually ships. ----
if (!globalThis.IntersectionObserver) {
  globalThis.IntersectionObserver = class {
    constructor(cb) {
      this._cb = cb
    }
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return []
    }
  }
}

// ---- getBoundingClientRect: jsdom returns all zeros for everything.
//
// That is not a crash, which is the problem. Masonry measures card heights and
// drops each onto the shortest column — with every height 0 the whole board
// packs into column 0. Tooltip's box() returns null when width is 0, so the
// bubble never positions and never opens. Both look like passing tests.
//
// A single non-zero box is not a layout engine, but it is enough for the
// "did this measure at all" branches to take the same path they take in a
// browser. Anything that genuinely depends on real geometry is a Playwright
// test, not a jsdom one. ----
const DEFAULT_RECT = { x: 0, y: 0, top: 0, left: 0, right: 200, bottom: 40, width: 200, height: 40 }
Element.prototype.getBoundingClientRect = function () {
  return { ...DEFAULT_RECT, toJSON: () => DEFAULT_RECT }
}

// ---- scrollIntoView / scrollTo: not implemented; the tour and scroll memory
// call them and jsdom logs a "not implemented" error per call. ----
Element.prototype.scrollIntoView = function () {}
window.scrollTo = () => {}

// ---- Object URLs: createObjectURL THROWS in jsdom. downloadPost and the
// share-image download both go through it. ----
if (!URL.createObjectURL) URL.createObjectURL = () => 'blob:test'
if (!URL.revokeObjectURL) URL.revokeObjectURL = () => {}

// ---- Image: jsdom never fires onload or onerror without a resource loader, so
// loadFaceImages awaits a promise that never settles and the test hangs rather
// than fails. Resolve on the next tick instead. ----
class TestImage {
  constructor() {
    this.naturalWidth = 100
    this.naturalHeight = 100
    setTimeout(() => this.onload?.(), 0)
  }
  set src(v) {
    this._src = v
  }
  get src() {
    return this._src
  }
}
globalThis.Image = TestImage

// ---- Per-test isolation.
//
// localStorage is never cleared on logout in the app (deliberately — the
// practice deck survives a reload), so it is certainly not cleared between
// tests. Several modules also hold module-level mutable state that outlives a
// render: the tactile wiring flag, the body-scroll-lock counter, the face cache
// and the scroll-memory LRU. Anything not reachable from here gets reset by the
// test that cares, via vi.resetModules(). ----
beforeEach(() => {
  localStorage.clear()
  document.body.style.overflow = ''
  document.documentElement.removeAttribute('data-theme')
  document.documentElement.removeAttribute('data-aesthetic')
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.useRealTimers()
})
