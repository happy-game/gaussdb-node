import assert from 'node:assert'
import { describe, it } from 'node:test'
import Pool from 'gaussdb-pool'

describe('gaussdb-pool', () => {
  it('should export Pool constructor', () => {
    assert.ok(new Pool())
  })
})
