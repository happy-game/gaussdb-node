'use strict'
const helper = require('./test-helper')
const gaussdb = helper.gaussdb
const assert = require('assert')
const { Client } = helper

const suite = new helper.Suite()

// clear process.env
const realEnv = {}
for (const key in process.env) {
  realEnv[key] = process.env[key]
  if (!key.indexOf('GAUSS')) delete process.env[key]
}

suite.test('default values are used in new clients', function () {
  assert.same(gaussdb.defaults, {
    user: process.env.USER,
    database: undefined,
    password: null,
    port: 5432,
    rows: 0,
    max: 10,
    binary: false,
    idleTimeoutMillis: 30000,
    client_encoding: '',
    ssl: false,
    application_name: undefined,
    fallback_application_name: undefined,
    parseInputDatesAsUTC: false,
  })

  const client = new gaussdb.Client()
  assert.same(client, {
    user: process.env.USER,
    password: null,
    port: 5432,
    database: process.env.USER,
  })
})

suite.test('modified values are passed to created clients', function () {
  gaussdb.defaults.user = 'boom'
  gaussdb.defaults.password = 'zap'
  gaussdb.defaults.host = 'blam'
  gaussdb.defaults.port = 1234
  gaussdb.defaults.database = 'pow'

  const client = new Client()
  assert.same(client, {
    user: 'boom',
    password: 'zap',
    host: 'blam',
    port: 1234,
    database: 'pow',
  })
})

suite.test('database defaults to user when user is non-default', () => {
  {
    gaussdb.defaults.database = undefined

    const client = new Client({
      user: 'foo',
    })

    assert.strictEqual(client.database, 'foo')
  }

  {
    gaussdb.defaults.database = 'bar'

    const client = new Client({
      user: 'foo',
    })

    assert.strictEqual(client.database, 'bar')
  }
})

suite.test('cleanup', () => {
  // restore process.env
  for (const key in realEnv) {
    process.env[key] = realEnv[key]
  }
})
