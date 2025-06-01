import protocol, { NoticeMessage, DatabaseError } from 'gaussdb-protocol/dist/messages.js'
import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'

describe('gaussdb-protocol', () => {
  it('should export database error', () => {
    assert.ok(DatabaseError)
  })
  it('should export protocol', () => {
    assert.ok(protocol)
    assert.ok(protocol.noData)
    assert.ok(protocol.parseComplete)
    assert.ok(protocol.NoticeMessage)
  })
  it('should export NoticeMessage from file in dist folder', () => {
    assert.ok(NoticeMessage)
  })
})
