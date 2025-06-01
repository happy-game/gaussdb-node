import assert from 'node:assert'
import { describe, it } from 'node:test'
import { CloudflareSocket } from 'gaussdb-cloudflare'

describe('gaussdb-cloudflare', () => {
  it('should export CloudflareSocket constructor', () => {
    assert.ok(new CloudflareSocket())
  })
})
