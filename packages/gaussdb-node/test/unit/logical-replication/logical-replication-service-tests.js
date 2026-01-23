'use strict'
const helper = require('../test-helper')
const assert = require('assert')
const LogicalReplicationService = require('../../../lib/logical-replication/logical-replication-service')

const suite = new helper.Suite()

const u64be = (hi, lo) => {
  const buf = Buffer.alloc(8)
  buf.writeUInt32BE(hi >>> 0, 0)
  buf.writeUInt32BE(lo >>> 0, 4)
  return buf
}

const u64le = (hi, lo) => {
  const buf = Buffer.alloc(8)
  buf.writeUInt32LE(lo >>> 0, 0)
  buf.writeUInt32LE(hi >>> 0, 4)
  return buf
}

const buildXLogData = (start, payload) => {
  const header = Buffer.concat([Buffer.from([0x77]), u64be(start.hi, start.lo), u64be(0, 0), u64be(0, 0)])
  return Buffer.concat([header, payload])
}

const buildKeepalive = (server, serverClockMicros, shouldRespond) => {
  const header = Buffer.concat([Buffer.from([0x6b]), u64le(server.hi, server.lo), u64le(0, 0)])
  const clock = u64le(serverClockMicros.hi, serverClockMicros.lo)
  return Buffer.concat([header, clock, Buffer.from([shouldRespond ? 1 : 0])])
}

suite.test('xlog data emits parsed message with lsn', () => {
  const service = new LogicalReplicationService({}, { acknowledge: { auto: false } })
  const plugin = {
    parse: () => 'BEGIN',
  }
  let received = null
  service.on('data', (lsn, data) => {
    received = { lsn, data }
  })
  const buffer = buildXLogData({ hi: 0, lo: 0x080bc370 }, Buffer.from('BEGIN', 'utf8'))
  service._handleCopyData(plugin, buffer)
  assert.deepStrictEqual(received, { lsn: '00000000/080BC370', data: 'BEGIN' })
})

suite.test('xlog data uses item lsn when parse returns batch', () => {
  const service = new LogicalReplicationService({}, { acknowledge: { auto: false } })
  const plugin = {
    parse: () => [{ lsn: '00000000/080BC4D0', payload: 'COMMIT' }],
  }
  let received = null
  service.on('data', (lsn, data) => {
    received = { lsn, data }
  })
  const buffer = buildXLogData({ hi: 0, lo: 0x080bc370 }, Buffer.from('batch', 'utf8'))
  service._handleCopyData(plugin, buffer)
  assert.deepStrictEqual(received, { lsn: '00000000/080BC4D0', data: { lsn: '00000000/080BC4D0', payload: 'COMMIT' } })
})

suite.test('keepalive emits heartbeat and requests acknowledge', () => {
  const service = new LogicalReplicationService({}, { acknowledge: { auto: false } })
  let heartbeat = null
  let ack = null
  service.acknowledge = (lsn, ping) => {
    ack = { lsn, ping }
    return true
  }
  service.on('heartbeat', (lsn, timestamp, shouldRespond) => {
    heartbeat = { lsn, timestamp, shouldRespond }
  })
  const buffer = buildKeepalive({ hi: 0, lo: 0x080bc370 }, { hi: 0, lo: 1000000 }, true)
  service._handleCopyData({}, buffer)
  assert.deepStrictEqual(heartbeat, {
    lsn: '00000000/080BC370',
    timestamp: 946684801000,
    shouldRespond: true,
  })
  assert.deepStrictEqual(ack, { lsn: service._lastLsn, ping: true })
})
