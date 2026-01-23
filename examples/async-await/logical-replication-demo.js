import { Client, LogicalReplicationService, MppdbDecodingPlugin } from 'gaussdb-node'

const slotName = 'demo_replication_slot'
const tableName = 'demo_replication_table'

// Connection config from environment variables or defaults
const config = {
  host: process.env.GAUSSHOST,
  port: parseInt(process.env.GAUSSPORT),
  database: process.env.GAUSSDATABASE,
  user: process.env.GAUSSUSER,
  password: process.env.GAUSSPASSWORD,
}

async function checkSlotExists(client) {
  const res = await client.query(
    `SELECT 1 FROM pg_replication_slots WHERE slot_name = $1`,
    [slotName]
  )
  return res.rowCount > 0
}

async function createSlot(client) {
  await client.query(
    `SELECT * FROM pg_create_logical_replication_slot('${slotName}', 'mppdb_decoding')`
  )
  console.log(`slot "${slotName}" created`)
}

async function dropSlot(client) {
  await client.query(`SELECT pg_drop_replication_slot('${slotName}')`)
  console.log(`slot "${slotName}" dropped`)
}

async function createTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS ${tableName} (
      id SERIAL PRIMARY KEY,
      name TEXT,
      value INT
    )
  `)
  console.log(`table "${tableName}" created`)
}

async function dropTable(client) {
  await client.query(`DROP TABLE IF EXISTS ${tableName}`)
  console.log(`table "${tableName}" dropped`)
}

async function performDML(client) {
  console.log('performing DML operations...')

  await client.query(`INSERT INTO ${tableName} (name, value) VALUES ($1, $2)`, ['alice', 100])
  console.log('  INSERT alice')

  await client.query(`INSERT INTO ${tableName} (name, value) VALUES ($1, $2)`, ['bob', 200])
  console.log('  INSERT bob')

  await client.query(`UPDATE ${tableName} SET value = $1 WHERE name = $2`, [150, 'alice'])
  console.log('  UPDATE alice')

  await client.query(`DELETE FROM ${tableName} WHERE name = $1`, ['bob'])
  console.log('  DELETE bob')

  console.log('DML operations completed')
}

async function main() {
  let clientB = null
  let service = null

  try {
    clientB = new Client(config)
    await clientB.connect()
    console.log('client B connected')

    // setup: create table and slot if needed
    await createTable(clientB)

    const slotExists = await checkSlotExists(clientB)
    if (!slotExists) {
      await createSlot(clientB)
    } else {
      console.log(`slot "${slotName}" already exists`)
    }

    // start replication service (client A uses config, not Client instance)
    service = new LogicalReplicationService(config, {
      acknowledge: { auto: true, timeoutSeconds: 10 },
    })

    const plugin = new MppdbDecodingPlugin({
      includeXids: false,
      skipEmptyXacts: true,
    })

    const receivedMessages = []

    service.on('start', () => {
      console.log('replication started')
    })

    service.on('data', (lsn, msg) => {
      console.log('[data]', lsn, msg)
      receivedMessages.push(msg)
    })

    service.on('error', (err) => {
      console.error('[error]', err)
    })

    // start replication in background
    service.subscribe(plugin, slotName)

    // wait for replication to start
    await new Promise((resolve) => service.once('start', resolve))

    // perform DML operations (client B)
    await performDML(clientB)

    // wait a bit for replication to catch up
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // stop replication first
    await service.stop()
    service = null
    console.log('replication stopped')

    console.log(`received ${receivedMessages.length} messages`)

    // cleanup while clientB is still connected
    await dropTable(clientB)
    await dropSlot(clientB)
  } catch (err) {
    console.error('error:', err)
  } finally {
    // stop service if still running
    if (service) {
      try {
        await service.stop()
      } catch (err) {
        // ignore
      }
    }

    // cleanup with a new connection if needed
    if (clientB) {
      try {
        await clientB.end()
      } catch (err) {
        // ignore
      }
    }

    // ensure cleanup with fresh connection
    const cleanupClient = new Client(config)
    try {
      await cleanupClient.connect()
      await cleanupClient.query(`DROP TABLE IF EXISTS ${tableName}`)
      await cleanupClient.query(`SELECT pg_drop_replication_slot('${slotName}')`).catch(() => {})
    } catch (err) {
      // ignore cleanup errors
    } finally {
      await cleanupClient.end().catch(() => {})
    }

    console.log('cleanup done')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
