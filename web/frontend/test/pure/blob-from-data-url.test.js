// A data: URL turned into bytes without fetch (src/api.js). The function is the observable unit
// here: it exists because a browser, under this app's CSP, refuses fetch(data:...), so what it
// must get right is the bytes and the type.
import { describe, expect, it } from 'vitest'
import { blobFromDataURL } from '../../src/api.js'

const bytesOf = async (blob) => new Uint8Array(await blob.arrayBuffer())

describe('a data: URL as a Blob', () => {
  it('decodes base64 to the same bytes, under the type it names', async () => {
    const blob = blobFromDataURL('data:image/png;base64,iVBORw0KGgo=')
    expect(blob.type).toBe('image/png')
    expect([...(await bytesOf(blob))]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  })

  it('decodes a percent-encoded body, as an SVG usually arrives', async () => {
    const blob = blobFromDataURL('data:image/svg+xml,%3Csvg%2F%3E')
    expect(blob.type).toBe('image/svg+xml')
    expect(new TextDecoder().decode(await bytesOf(blob))).toBe('<svg/>')
  })

  it('refuses something that is not a data: URL rather than returning an empty picture', () => {
    expect(() => blobFromDataURL('https://example.com/a.png')).toThrow()
    expect(() => blobFromDataURL('')).toThrow()
  })
})
