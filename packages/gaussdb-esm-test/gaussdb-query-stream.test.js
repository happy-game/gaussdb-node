import assert from 'node:assert'
import { describe, it } from 'node:test'
import QueryStream from 'gaussdb-query-stream'

describe('gaussdb-query-stream', () => {
  it('should export QueryStream constructor as default', () => {
    assert.ok(new QueryStream())
  })
})
