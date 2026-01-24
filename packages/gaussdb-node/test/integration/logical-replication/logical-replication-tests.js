'use strict'
const helper = require('../test-helper')
const gaussdb = helper.gaussdb
const assert = require('assert')

const suite = new helper.Suite()

const report = (label, ok) => {
  const mark = ok ? '\u2714' : '\u2716'
  console.log(`  - ${label} ${mark}`)
}

const check = (label, predicate, message) => {
  const ok = Boolean(predicate)
  report(label, ok)
  assert.ok(ok, message || label)
}

const dropReplicationSlot = async (slotName) => {
  const cleanupClient = new gaussdb.Client(helper.config)
  try {
    await cleanupClient.connect()
    await cleanupClient.query(`SELECT pg_drop_replication_slot('${slotName}')`)
  } catch (err) {
    console.warn('Failed to drop replication slot', err)
  } finally {
    await cleanupClient.end().catch(() => {})
  }
}

if (process.env.LOGICAL_REPLICATION_TEST !== '1') {
  suite.testAsync('skipping logical replication tests (missing env)', () => {})
  return
}

suite.test('logical replication - standard JSON format (no parallel)', function (done) {
  this.timeout = 20000
  const uniqueId = Date.now().toString(36)
  const tableName = `logical_replication_${uniqueId}`
  const slotName = `logical_replication_slot_${uniqueId}`
  const client = new gaussdb.Client(helper.config)
  let service = null

  const run = async () => {
    try {
      await client.connect()
      await client.query(`DROP TABLE IF EXISTS ${tableName}`)
      await client.query(`CREATE TABLE ${tableName} (id SERIAL PRIMARY KEY, name TEXT, value INT)`)

      await client.query(`SELECT * FROM pg_create_logical_replication_slot('${slotName}', 'mppdb_decoding')`)

      const res = await client.query('SELECT pg_current_xlog_location() AS lsn')
      const currentLsn = res.rows[0].lsn
      service = new gaussdb.LogicalReplicationService(helper.config, {
        acknowledge: { auto: true, timeoutSeconds: 10 },
      })
      const plugin = new gaussdb.MppdbDecodingPlugin({
        includeXids: false,
        skipEmptyXacts: true,
      })

      const messages = []
      const errors = []
      service.on('start', () => {})
      service.on('error', (err) => {
        errors.push(err)
      })
      service.on('data', (lsn, msg) => {
        messages.push({ lsn, msg })
      })

      service.subscribe(plugin, slotName, currentLsn).catch((err) => errors.push(err))
      await new Promise((resolve) => service.once('start', resolve))

      await client.query(`INSERT INTO ${tableName} (name, value) VALUES ($1, $2)`, ['alice', 100])
      await client.query(`INSERT INTO ${tableName} (name, value) VALUES ($1, $2)`, ['bob', 200])
      await client.query(`UPDATE ${tableName} SET value = $1 WHERE name = $2`, [150, 'alice'])
      await client.query(`DELETE FROM ${tableName} WHERE name = $1`, ['bob'])

      await new Promise((resolve) => setTimeout(resolve, 3000))

      if (errors.length > 0) {
        throw new Error(`Replication errors: ${errors.map((e) => e.message).join(', ')}`)
      }

      check('received replication messages', messages.length > 0, `expected messages, got ${messages.length}`)

      const msgContents = messages.map((m) => m.msg).filter((m) => typeof m === 'string')
      check(
        'BEGIN marker',
        msgContents.some((m) => m.includes('BEGIN')),
        'expected BEGIN marker'
      )
      check(
        'COMMIT marker',
        msgContents.some((m) => m.includes('COMMIT')),
        'expected COMMIT marker'
      )

      const jsonMessages = msgContents
        .filter((m) => m.startsWith('{'))
        .map((m) => {
          try {
            return JSON.parse(m)
          } catch {
            return null
          }
        })
        .filter(Boolean)

      const opTypes = new Set(jsonMessages.map((m) => m.op_type).filter(Boolean))
      check('INSERT payload', opTypes.has('INSERT'), 'expected INSERT payload')
      check('UPDATE payload', opTypes.has('UPDATE'), 'expected UPDATE payload')
      check('DELETE payload', opTypes.has('DELETE'), 'expected DELETE payload')

      const insertMsg = jsonMessages.find((m) => m.op_type === 'INSERT')
      check(
        'INSERT references table',
        insertMsg && insertMsg.table_name.includes(tableName),
        'INSERT should reference correct table'
      )
      check(
        'INSERT has columns_name',
        insertMsg && Array.isArray(insertMsg.columns_name),
        'INSERT should have columns_name array'
      )
      check(
        'INSERT has columns_val',
        insertMsg && Array.isArray(insertMsg.columns_val),
        'INSERT should have columns_val array'
      )
    } finally {
      if (service) {
        await service.stop().catch(() => {})
      }
      await client.query(`DROP TABLE IF EXISTS ${tableName}`).catch(() => {})
      await dropReplicationSlot(slotName)
      await client.end().catch(() => {})
    }
  }

  run().then(() => done(), done)
})

suite.test('logical replication - parallel JSON format (decodeStyle: j)', function (done) {
  this.timeout = 20000
  const uniqueId = Date.now().toString(36)
  const tableName = `logical_replication_${uniqueId}`
  const slotName = `logical_replication_slot_${uniqueId}`
  const client = new gaussdb.Client(helper.config)
  let service = null

  const run = async () => {
    try {
      await client.connect()
      await client.query(`DROP TABLE IF EXISTS ${tableName}`)
      await client.query(`CREATE TABLE ${tableName} (id SERIAL PRIMARY KEY, name TEXT, value INT)`)

      await client.query(`SELECT * FROM pg_create_logical_replication_slot('${slotName}', 'mppdb_decoding')`)

      const res = await client.query('SELECT pg_current_xlog_location() AS lsn')
      const currentLsn = res.rows[0].lsn
      service = new gaussdb.LogicalReplicationService(helper.config, {
        acknowledge: { auto: true, timeoutSeconds: 10 },
      })
      const plugin = new gaussdb.MppdbDecodingPlugin({
        includeXids: false,
        skipEmptyXacts: true,
        parallelDecodeNum: 2,
        decodeStyle: 'j',
      })

      const messages = []
      const errors = []
      service.on('start', () => {})
      service.on('error', (err) => {
        errors.push(err)
      })
      service.on('data', (lsn, msg) => {
        messages.push({ lsn, msg })
      })

      service.subscribe(plugin, slotName, currentLsn).catch((err) => errors.push(err))
      await new Promise((resolve) => service.once('start', resolve))

      await client.query(`INSERT INTO ${tableName} (name, value) VALUES ($1, $2)`, ['alice', 100])
      await client.query(`INSERT INTO ${tableName} (name, value) VALUES ($1, $2)`, ['bob', 200])
      await client.query(`UPDATE ${tableName} SET value = $1 WHERE name = $2`, [150, 'alice'])
      await client.query(`DELETE FROM ${tableName} WHERE name = $1`, ['bob'])

      await new Promise((resolve) => setTimeout(resolve, 3000))

      if (errors.length > 0) {
        throw new Error(`Replication errors: ${errors.map((e) => e.message).join(', ')}`)
      }

      check('received replication messages', messages.length > 0, `expected messages, got ${messages.length}`)

      const msgContents = messages.map((m) => m.msg).filter((m) => typeof m === 'string' || typeof m === 'object')

      const beginMessages = msgContents.filter((m) => {
        if (typeof m === 'string') return m.includes('BEGIN CSN')
        return false
      })
      check('BEGIN CSN markers', beginMessages.length > 0, 'expected BEGIN CSN markers')

      const commitMessages = msgContents.filter((m) => {
        if (typeof m === 'string') return m === 'commit'
        return false
      })
      check('commit markers', commitMessages.length > 0, 'expected commit markers')

      const dmlMessages = msgContents.filter((m) => typeof m === 'object' && m.table_name && m.op_type)
      const opTypes = new Set(dmlMessages.map((m) => m.op_type))
      check('INSERT payload', opTypes.has('INSERT'), 'expected INSERT payload')
      check('UPDATE payload', opTypes.has('UPDATE'), 'expected UPDATE payload')
      check('DELETE payload', opTypes.has('DELETE'), 'expected DELETE payload')
    } finally {
      if (service) {
        await service.stop().catch(() => {})
      }
      await client.query(`DROP TABLE IF EXISTS ${tableName}`).catch(() => {})
      await dropReplicationSlot(slotName)
      await client.end().catch(() => {})
    }
  }

  run().then(() => done(), done)
})

suite.test('logical replication - parallel text format (decodeStyle: t)', function (done) {
  this.timeout = 20000
  const uniqueId = Date.now().toString(36)
  const tableName = `logical_replication_${uniqueId}`
  const slotName = `logical_replication_slot_${uniqueId}`
  const client = new gaussdb.Client(helper.config)
  let service = null

  const run = async () => {
    try {
      await client.connect()
      await client.query(`DROP TABLE IF EXISTS ${tableName}`)
      await client.query(`CREATE TABLE ${tableName} (id SERIAL PRIMARY KEY, name TEXT, value INT)`)

      await client.query(`SELECT * FROM pg_create_logical_replication_slot('${slotName}', 'mppdb_decoding')`)

      const res = await client.query('SELECT pg_current_xlog_location() AS lsn')
      const currentLsn = res.rows[0].lsn
      service = new gaussdb.LogicalReplicationService(helper.config, {
        acknowledge: { auto: true, timeoutSeconds: 10 },
      })
      const plugin = new gaussdb.MppdbDecodingPlugin({
        includeXids: false,
        skipEmptyXacts: true,
        parallelDecodeNum: 2,
        decodeStyle: 't',
      })

      const messages = []
      const errors = []
      service.on('start', () => {})
      service.on('error', (err) => {
        errors.push(err)
      })
      service.on('data', (lsn, msg) => {
        messages.push({ lsn, msg })
      })

      service.subscribe(plugin, slotName, currentLsn).catch((err) => errors.push(err))
      await new Promise((resolve) => service.once('start', resolve))

      await client.query(`INSERT INTO ${tableName} (name, value) VALUES ($1, $2)`, ['alice', 100])
      await client.query(`INSERT INTO ${tableName} (name, value) VALUES ($1, $2)`, ['bob', 200])
      await client.query(`UPDATE ${tableName} SET value = $1 WHERE name = $2`, [150, 'alice'])
      await client.query(`DELETE FROM ${tableName} WHERE name = $1`, ['bob'])

      await new Promise((resolve) => setTimeout(resolve, 3000))

      if (errors.length > 0) {
        throw new Error(`Replication errors: ${errors.map((e) => e.message).join(', ')}`)
      }

      check('received replication messages', messages.length > 0, `expected messages, got ${messages.length}`)

      const msgContents = messages.map((m) => m.msg).filter((m) => typeof m === 'string')

      const beginMessages = msgContents.filter((m) => m.includes('BEGIN CSN'))
      check('BEGIN CSN markers', beginMessages.length > 0, 'expected BEGIN CSN markers')

      const commitMessages = msgContents.filter((m) => m === 'commit')
      check('commit markers', commitMessages.length > 0, 'expected commit markers')

      const insertMessages = msgContents.filter((m) => m.includes('INSERT:'))
      check('INSERT messages', insertMessages.length >= 2, 'expected INSERT messages')

      const updateMessages = msgContents.filter((m) => m.includes('UPDATE:'))
      check('UPDATE messages', updateMessages.length >= 1, 'expected UPDATE messages')

      const deleteMessages = msgContents.filter((m) => m.includes('DELETE:'))
      check('DELETE messages', deleteMessages.length >= 1, 'expected DELETE messages')

      const sampleInsert = insertMessages[0]
      check(
        'INSERT shows id column type',
        sampleInsert && sampleInsert.includes('id[integer]'),
        'INSERT should show column types'
      )
      check(
        'INSERT shows name column type',
        sampleInsert && sampleInsert.includes('name[text]'),
        'INSERT should show column types'
      )
    } finally {
      if (service) {
        await service.stop().catch(() => {})
      }
      await client.query(`DROP TABLE IF EXISTS ${tableName}`).catch(() => {})
      await dropReplicationSlot(slotName)
      await client.end().catch(() => {})
    }
  }

  run().then(() => done(), done)
})

suite.test('logical replication - binary format (parallel, no decodeStyle)', function (done) {
  this.timeout = 20000
  const uniqueId = Date.now().toString(36)
  const tableName = `logical_replication_${uniqueId}`
  const slotName = `logical_replication_slot_${uniqueId}`
  const client = new gaussdb.Client(helper.config)
  let service = null

  const run = async () => {
    try {
      await client.connect()
      await client.query(`DROP TABLE IF EXISTS ${tableName}`)
      await client.query(`CREATE TABLE ${tableName} (id SERIAL PRIMARY KEY, name TEXT, value INT)`)

      await client.query(`SELECT * FROM pg_create_logical_replication_slot('${slotName}', 'mppdb_decoding')`)

      const res = await client.query('SELECT pg_current_xlog_location() AS lsn')
      const currentLsn = res.rows[0].lsn
      service = new gaussdb.LogicalReplicationService(helper.config, {
        acknowledge: { auto: true, timeoutSeconds: 10 },
      })
      const plugin = new gaussdb.MppdbDecodingPlugin({
        includeXids: false,
        skipEmptyXacts: true,
        parallelDecodeNum: 2,
      })

      const messages = []
      const errors = []
      service.on('start', () => {})
      service.on('error', (err) => {
        errors.push(err)
      })
      service.on('data', (lsn, msg) => {
        messages.push({ lsn, msg })
      })

      service.subscribe(plugin, slotName, currentLsn).catch((err) => errors.push(err))
      await new Promise((resolve) => service.once('start', resolve))

      await client.query(`INSERT INTO ${tableName} (name, value) VALUES ($1, $2)`, ['alice', 100])
      await client.query(`INSERT INTO ${tableName} (name, value) VALUES ($1, $2)`, ['bob', 200])
      await client.query(`UPDATE ${tableName} SET value = $1 WHERE name = $2`, [150, 'alice'])
      await client.query(`DELETE FROM ${tableName} WHERE name = $1`, ['bob'])

      await new Promise((resolve) => setTimeout(resolve, 3000))

      if (errors.length > 0) {
        throw new Error(`Replication errors: ${errors.map((e) => e.message).join(', ')}`)
      }

      check('received replication messages', messages.length > 0, `expected messages, got ${messages.length}`)

      const msgContents = messages.map((m) => m.msg).filter((m) => typeof m === 'string')
      const allMessages = msgContents.join('')

      check('BEGIN marker (B)', allMessages.includes('B'), 'expected BEGIN marker (B)')
      check('COMMIT marker (C)', allMessages.includes('C'), 'expected COMMIT marker (C)')
      check('INSERT marker (I)', allMessages.includes('I'), 'expected INSERT marker (I)')
      check('UPDATE marker (U)', allMessages.includes('U'), 'expected UPDATE marker (U)')
      check('DELETE marker (D)', allMessages.includes('D'), 'expected DELETE marker (D)')

      check(
        'table name in binary messages',
        msgContents.some((m) => m.includes(tableName)),
        'expected table name in binary messages'
      )
    } finally {
      if (service) {
        await service.stop().catch(() => {})
      }
      await client.query(`DROP TABLE IF EXISTS ${tableName}`).catch(() => {})
      await dropReplicationSlot(slotName)
      await client.end().catch(() => {})
    }
  }

  run().then(() => done(), done)
})
