// THE MARKETPLACE, AS THE TWO LETTERS THAT DIFFER.
//
// THE OWNER: "for amazon domain, just use the in, com, au, etc., not the full url.
// that takes space." Every marketplace host is `www.amazon.` plus a suffix, so the
// prefix is eleven identical characters on every install — and this row already had
// the worst width on the card, its own note recording the label breaking mid-word
// into "AMA / ZON / DOM / AIN".
//
// THE COLUMN STILL HOLDS A HOST. `FetchAmazonBook` builds `https://<domain>/dp/<asin>`
// and defaults to `www.amazon.com`, so the screen speaks suffixes and the wire keeps
// speaking hosts — one transform in one place rather than a data change reaching the
// server and every existing install's stored value.
import { describe, expect, it } from 'vitest'

import { amazonHost, amazonSuffix } from '../../src/MetadataSources.jsx'

describe('what the field shows', () => {
  it('reduces a stored host to its suffix', () => {
    expect(amazonSuffix('www.amazon.in')).toBe('in')
    expect(amazonSuffix('www.amazon.com')).toBe('com')
    expect(amazonSuffix('www.amazon.com.au')).toBe('com.au')
  })

  it('and shows nothing for a marketplace nobody has set', () => {
    expect(amazonSuffix('')).toBe('')
    expect(amazonSuffix(null)).toBe('')
    expect(amazonSuffix('   ')).toBe('')
  })
})

describe('what the field accepts', () => {
  // A READER WHO HAS COPIED THEIR ADDRESS BAR SHOULD NOT BE TOLD OFF. All four of
  // these name one marketplace, and the same forgiveness the IMDb id field already
  // extends for the same reason.
  it('takes the suffix, the bare domain, the host or a pasted URL', () => {
    for (const typed of ['in', 'amazon.in', 'www.amazon.in', 'https://www.amazon.in/']) {
      expect(amazonHost(typed), `${typed} did not resolve`).toBe('www.amazon.in')
    }
  })

  it('is case- and space-forgiving, because a paste carries both', () => {
    expect(amazonHost('  WWW.AMAZON.IN  ')).toBe('www.amazon.in')
  })

  it('a multi-part suffix survives the round trip', () => {
    expect(amazonHost('com.au')).toBe('www.amazon.com.au')
    expect(amazonSuffix(amazonHost('com.au'))).toBe('com.au')
  })

  // CLEARING IT IS A REAL ACTION — the field is optional, and emptying it has to
  // store '' rather than the string "www.amazon.", which would resolve to nothing
  // and be a host the server would then try to fetch from.
  it('clears to nothing rather than to a bare prefix', () => {
    expect(amazonHost('')).toBe('')
    expect(amazonHost('   ')).toBe('')
  })
})
