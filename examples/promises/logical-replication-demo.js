import { Client, LogicalReplicationService, MppdbDecodingPlugin } from 'gaussdb-node'

const slotName = 'demo_replication_slot'
const tableName = 'demo_replication_table'

const config = {
  host: process.env.GAUSSHOST,
  port: parseInt(process.env.GAUSSPORT),
  database: process.env.GAUSSDATABASE,
  user: process.env.GAUSSUSER,
  password: process.env.GAUSSPASSWORD,
}

function checkSlotExists(client) {
  return client
    .query('SELECT 1 FROM pg_replication_slots WHERE slot_name = $1', [slotName])
    .then((res) => res.rowCount > 0)
}

function createSlot(client) {
  return client
    .query(`SELECT * FROM pg_create_logical_replication_slot('${slotName}', 'mppdb_decoding')`)
    .then(() => console.log(`slot "${slotName}" created`))
}

function dropSlot(client) {
  return client
    .query(`SELECT pg_drop_replication_slot('${slotName}')`)
    .then(() => console.log(`slot "${slotName}" dropped`))
}

function createTable(client) {
  return client
    .query(`
      CREATE TABLE IF NOT EXISTS ${tableName} (
        id SERIAL PRIMARY KEY,
        name TEXT,
        value INT
      )
    `)
    .then(() => console.log(`table "${tableName}" created`))
}

function dropTable(client) {
  return client
    .query(`DROP TABLE IF EXISTS ${tableName}`)
    .then(() => console.log(`table "${tableName}" dropped`))
}

function performDML(client) {
  console.log('performing DML operations...')
  return client
    .query(`INSERT INTO ${tableName} (name, value) VALUES ($1, $2)`, ['alice', 100])
    .then(() => console.log('  INSERT alice'))
    .then(() => client.query(`INSERT INTO ${tableName} (name, value) VALUES ($1, $2)`, ['bob', 200]))
    .then(() => console.log('  INSERT bob'))
    .then(() => client.query(`UPDATE ${tableName} SET value = $1 WHERE name = $2`, [150, 'alice']))
    .then(() => console.log('  UPDATE alice'))
    .then(() => client.query(`DELETE FROM ${tableName} WHERE name = $1`, ['bob']))
    .then(() => console.log('  DELETE bob'))
    .then(() => console.log('DML operations completed'))
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function main() {
  let clientB = null
  let service = null
  const receivedMessages = []

  clientB = new Client(config)

  clientB
    .connect()
    .then(() => {
      console.log('client B connected')
      return createTable(clientB)
    })
    .then(() => checkSlotExists(clientB))
    .then((exists) => {
      if (!exists) {
        return createSlot(clientB)
      } else {
        console.log(`slot "${slotName}" already exists`)
      }
    })
    .then(() => {
      service = new LogicalReplicationService(config, {
        acknowledge: { auto: true, timeoutSeconds: 10 },
      })

      const plugin = new MppdbDecodingPlugin({
        includeXids: false,
        skipEmptyXacts: true,
      })

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

      service.subscribe(plugin, slotName)

      return new Promise((resolve) => service.once('start', resolve))
    })
    .then(() => performDML(clientB))
    .then(() => delay(2000))
    .then(() => {
      return service.stop().then(() => {
        service = null
        console.log('replication stopped')
        console.log(`received ${receivedMessages.length} messages`)
      })
    })
    .then(() => dropTable(clientB))
    .then(() => dropSlot(clientB))
    .catch((err) => {
      console.error('error:', err)
    })
    .finally(() => {
      const cleanup = []

      if (service) {
        cleanup.push(service.stop().catch(() => {}))
      }

      if (clientB) {
        cleanup.push(clientB.end().catch(() => {}))
      }

      return Promise.all(cleanup)
        .then(() => {
          const cleanupClient = new Client(config)
          return cleanupClient
            .connect()
            .then(() => cleanupClient.query(`DROP TABLE IF EXISTS ${tableName}`))
            .then(() => cleanupClient.query(`SELECT pg_drop_replication_slot('${slotName}')`).catch(() => {}))
            .finally(() => cleanupClient.end().catch(() => {}))
        })
        .catch(() => {})
        .then(() => console.log('cleanup done'))
    })
}

main()
