import assert from 'node:assert'
import { describe, it } from 'node:test'
import Cursor from 'gaussdb-cursor'

describe('gaussdb-cursor', () => {
  it('should export Cursor constructor as default', () => {
    assert.ok(new Cursor())
  })
})
