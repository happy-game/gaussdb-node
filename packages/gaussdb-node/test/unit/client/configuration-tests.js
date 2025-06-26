'use strict'
const helper = require('./test-helper')
const { Client } = helper
const assert = require('assert')
const suite = new helper.Suite()
const test = suite.test.bind(suite)

const gaussdbuser = process.env['GAUSSUSER'] || process.env.USER
const gaussdbdatabase = process.env['GAUSSDATABASE'] || process.env.USER
const gaussdbport = process.env['GAUSSPORT'] || 5432

test('client settings', function () {
  test('defaults', function () {
    const client = new Client()
    assert.equal(client.user, gaussdbuser)
    assert.equal(client.database, gaussdbdatabase)
    assert.equal(client.port, gaussdbport)
    assert.equal(client.ssl, false)
  })

  test('custom', function () {
    const user = 'brian'
    const database = 'gaussdbjstest'
    const password = 'boom'
    const client = new Client({
      user: user,
      database: database,
      port: 321,
      password: password,
      ssl: true,
    })

    assert.equal(client.user, user)
    assert.equal(client.database, database)
    assert.equal(client.port, 321)
    assert.equal(client.password, password)
    assert.equal(client.ssl, true)
  })

  test('custom ssl default on', function () {
    const old = process.env.GAUSSSSLMODE
    process.env.GAUSSSSLMODE = 'prefer'

    const client = new Client()
    process.env.GAUSSSSLMODE = old

    assert.equal(client.ssl, true)
  })

  test('custom ssl force off', function () {
    const old = process.env.GAUSSSSLMODE
    process.env.GAUSSSSLMODE = 'prefer'

    const client = new Client({
      ssl: false,
    })
    process.env.GAUSSSSLMODE = old

    assert.equal(client.ssl, false)
  })
})

test('initializing from a config string', function () {
  test('uses connectionString property', function () {
    const client = new Client({
      connectionString: 'gaussdb://brian:pass@host1:333/databasename',
    })
    assert.equal(client.user, 'brian')
    assert.equal(client.password, 'pass')
    assert.equal(client.host, 'host1')
    assert.equal(client.port, 333)
    assert.equal(client.database, 'databasename')
  })

  test('uses the correct values from the config string', function () {
    const client = new Client('gaussdb://brian:pass@host1:333/databasename')
    assert.equal(client.user, 'brian')
    assert.equal(client.password, 'pass')
    assert.equal(client.host, 'host1')
    assert.equal(client.port, 333)
    assert.equal(client.database, 'databasename')
  })

  test('uses the correct values from the config string with space in password', function () {
    const client = new Client('gaussdb://brian:pass word@host1:333/databasename')
    assert.equal(client.user, 'brian')
    assert.equal(client.password, 'pass word')
    assert.equal(client.host, 'host1')
    assert.equal(client.port, 333)
    assert.equal(client.database, 'databasename')
  })

  test('when not including all values the defaults are used', function () {
    const client = new Client('gaussdb://host1')
    assert.equal(client.user, process.env['GAUSSUSER'] || process.env.USER)
    assert.equal(client.password, process.env['GAUSSPASSWORD'] || null)
    assert.equal(client.host, 'host1')
    assert.equal(client.port, process.env['GAUSSPORT'] || 5432)
    assert.equal(client.database, process.env['GAUSSDATABASE'] || process.env.USER)
  })

  test('when not including all values the environment variables are used', function () {
    const envUserDefined = process.env['GAUSSUSER'] !== undefined
    const envPasswordDefined = process.env['GAUSSPASSWORD'] !== undefined
    const envHostDefined = process.env['GAUSSHOST'] !== undefined
    const envPortDefined = process.env['GAUSSPORT'] !== undefined
    const envDBDefined = process.env['GAUSSDATABASE'] !== undefined

    const savedEnvUser = process.env['GAUSSUSER']
    const savedEnvPassword = process.env['GAUSSPASSWORD']
    const savedEnvHost = process.env['GAUSSHOST']
    const savedEnvPort = process.env['GAUSSPORT']
    const savedEnvDB = process.env['GAUSSDATABASE']

    process.env['GAUSSUSER'] = 'utUser1'
    process.env['GAUSSPASSWORD'] = 'utPass1'
    process.env['GAUSSHOST'] = 'utHost1'
    process.env['GAUSSPORT'] = 5464
    process.env['GAUSSDATABASE'] = 'utDB1'

    const client = new Client('gaussdb://host1')
    assert.equal(client.user, process.env['GAUSSUSER'])
    assert.equal(client.password, process.env['GAUSSPASSWORD'])
    assert.equal(client.host, 'host1')
    assert.equal(client.port, process.env['GAUSSPORT'])
    assert.equal(client.database, process.env['GAUSSDATABASE'])

    if (envUserDefined) {
      process.env['GAUSSUSER'] = savedEnvUser
    } else {
      delete process.env['GAUSSUSER']
    }

    if (envPasswordDefined) {
      process.env['GAUSSPASSWORD'] = savedEnvPassword
    } else {
      delete process.env['GAUSSPASSWORD']
    }

    if (envDBDefined) {
      process.env['GAUSSDATABASE'] = savedEnvDB
    } else {
      delete process.env['GAUSSDATABASE']
    }

    if (envHostDefined) {
      process.env['GAUSSHOST'] = savedEnvHost
    } else {
      delete process.env['GAUSSHOST']
    }

    if (envPortDefined) {
      process.env['GAUSSPORT'] = savedEnvPort
    } else {
      delete process.env['GAUSSPORT']
    }
  })
})

test('calls connect correctly on connection', function () {
  const client = new Client('/tmp')
  let usedPort = ''
  let usedHost = ''
  client.connection.connect = function (port, host) {
    usedPort = port
    usedHost = host
  }
  client.connect()
  assert.equal(usedPort, '/tmp/.s.PGSQL.' + gaussdbport)
  assert.strictEqual(usedHost, undefined)
})
