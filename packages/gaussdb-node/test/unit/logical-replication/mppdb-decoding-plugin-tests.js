'use strict'
const helper = require('../test-helper')
const assert = require('assert')
const MppdbDecodingPlugin = require('../../../lib/logical-replication/mppdb-decoding-plugin')

const suite = new helper.Suite()

const u16be = (value) => {
  const buf = Buffer.alloc(2)
  buf.writeUInt16BE(value, 0)
  return buf
}

const u32be = (value) => {
  const buf = Buffer.alloc(4)
  buf.writeUInt32BE(value >>> 0, 0)
  return buf
}

const u64be = (hi, lo) => {
  const buf = Buffer.alloc(8)
  buf.writeUInt32BE(hi >>> 0, 0)
  buf.writeUInt32BE(lo >>> 0, 4)
  return buf
}

const buildTextBatch = (items) => {
  const chunks = []
  for (const item of items) {
    const payload = Buffer.from(item.payload, 'utf8')
    chunks.push(u32be(payload.length))
    chunks.push(u64be(item.lsn.hi, item.lsn.lo))
    chunks.push(payload)
  }
  chunks.push(u32be(0))
  return Buffer.concat(chunks)
}

const buildDmlRecord = (tag, schema, table, tuples) => {
  const chunks = [Buffer.from(tag)]
  chunks.push(u16be(schema.length), Buffer.from(schema, 'utf8'))
  chunks.push(u16be(table.length), Buffer.from(table, 'utf8'))
  for (const tuple of tuples) {
    const kind = tuple.kind === 'old' ? 0x4f : 0x4e
    chunks.push(Buffer.from([kind]))
    chunks.push(u16be(tuple.columns.length))
    for (const column of tuple.columns) {
      const name = Buffer.from(column.name, 'utf8')
      chunks.push(u16be(name.length), name)
      chunks.push(u32be(column.typeOid))
      if (column.value === null) {
        chunks.push(u32be(0xffffffff))
      } else {
        const value = Buffer.from(column.value, 'utf8')
        chunks.push(u32be(value.length), value)
      }
    }
  }
  return Buffer.concat(chunks)
}

const buildBinaryBatch = (records) => {
  const chunks = []
  for (const record of records) {
    chunks.push(u32be(record.buffer.length))
    chunks.push(u64be(record.lsn.hi, record.lsn.lo))
    chunks.push(record.buffer)
    chunks.push(Buffer.from([record.separator]))
  }
  chunks.push(u32be(0))
  return Buffer.concat(chunks)
}

suite.test('parse text without batch returns raw string', () => {
  const plugin = new MppdbDecodingPlugin()
  const result = plugin.parse(Buffer.from('BEGIN', 'utf8'))
  assert.strictEqual(result, 'BEGIN')
})

suite.test('parse text batch decodes JSON payloads', () => {
  const plugin = new MppdbDecodingPlugin({ sendingBatch: true, decodeStyle: 'j' })
  const buffer = buildTextBatch([
    {
      lsn: { hi: 0, lo: 0x080bc370 },
      payload: '{"op_type":"INSERT","table_name":"public.demo_replication_table"}',
    },
    {
      lsn: { hi: 0, lo: 0x080bc4d0 },
      payload: 'BEGIN CSN: 3285',
    },
  ])
  const result = plugin.parse(buffer)
  assert.strictEqual(result.length, 2)
  assert.deepStrictEqual(result[0], {
    lsn: '00000000/080BC370',
    payload: { op_type: 'INSERT', table_name: 'public.demo_replication_table' },
  })
  assert.deepStrictEqual(result[1], { lsn: '00000000/080BC4D0', payload: 'BEGIN CSN: 3285' })
})

suite.test('parse binary batch records and tuples', () => {
  const plugin = new MppdbDecodingPlugin({ decodeStyle: 'b' })
  const begin = Buffer.concat([Buffer.from('B'), u64be(0, 3301), u64be(0, 0x080d8b30)])
  const insert = buildDmlRecord('I', 'public', 'demo_replication_table', [
    {
      kind: 'new',
      columns: [
        { name: 'id', typeOid: 23, value: '6' },
        { name: 'name', typeOid: 25, value: "'alice'" },
        { name: 'value', typeOid: 23, value: '100' },
      ],
    },
  ])
  const commit = Buffer.from('C')
  const buffer = buildBinaryBatch([
    { lsn: { hi: 0, lo: 0x080d8b30 }, buffer: begin, separator: 0x50 },
    { lsn: { hi: 0, lo: 0x080d8b30 }, buffer: insert, separator: 0x50 },
    { lsn: { hi: 0, lo: 0x080d8c30 }, buffer: commit, separator: 0x46 },
  ])
  const result = plugin.parse(buffer)
  assert.strictEqual(result.length, 3)
  assert.deepStrictEqual(result[0], {
    lsn: '00000000/080D8B30',
    batchEnd: false,
    record: { tag: 'begin', csn: 3301, firstLsn: '00000000/080D8B30' },
  })
  assert.strictEqual(result[1].record.tag, 'insert')
  assert.strictEqual(result[1].record.schema, 'public')
  assert.strictEqual(result[1].record.table, 'demo_replication_table')
  assert.deepStrictEqual(result[1].record.tuples[0].columns, [
    { name: 'id', typeOid: 23, value: '6' },
    { name: 'name', typeOid: 25, value: "'alice'" },
    { name: 'value', typeOid: 23, value: '100' },
  ])
  assert.deepStrictEqual(result[2], { lsn: '00000000/080D8C30', batchEnd: true, record: { tag: 'commit' } })
})

suite.test('parse binary rejects unknown tuple tags', () => {
  const plugin = new MppdbDecodingPlugin({ decodeStyle: 'b' })
  const invalid = Buffer.concat([
    Buffer.from('I'),
    u16be(6),
    Buffer.from('public'),
    u16be(5),
    Buffer.from('table'),
    Buffer.from('F'),
  ])
  const buffer = buildBinaryBatch([{ lsn: { hi: 0, lo: 0x080d8468 }, buffer: invalid, separator: 0x46 }])
  assert.throws(
    () => plugin.parse(buffer),
    (err) => err && /unknown tuple tag: F/.test(err.message)
  )
})
