'use strict'
const helper = require('./../test-helper')
const gaussdb = helper.gaussdb
const suite = new helper.Suite()
const { native } = helper.args
const assert = require('assert')

/**
 * This test only executes if the env variables SHA256_TEST_PGUSER and
 * SHA256_TEST_PGPASSWORD are defined. You can override additional values
 * for the host, port and database with other SHA256_TEST_ prefixed vars.
 * If the variables are not defined the test will be skipped.
 *
 * SQL to create test role:
 *
 *     SET password_encryption_type = 2;
 *     CREATE ROLE sha256_test login password 'test4@scram';
 *
 * Add the following entries to pg_hba.conf:
 *
 *     host   all   sha256_test   ::1/128    sha256
 *     host   all   sha256_test   0.0.0.0/0   sha256
 *
 * Then run this file with after exporting:
 *
 *     SHA256_TEST_PGUSER=sha256_test
 *     SHA256_TEST_PGPASSWORD=test4@scram
 */

// Base config for SHA256 tests
const config = {
  user: process.env.SHA256_TEST_PGUSER,
  password: process.env.SHA256_TEST_PGPASSWORD,
  host: process.env.SHA256_TEST_PGHOST || 'localhost',
  port: process.env.SHA256_TEST_PGPORT || 5432,
  database: process.env.SHA256_TEST_PGDATABASE || 'ci_db_test',
}

if (native) {
  suite.testAsync('skipping SHA256 tests (on native)', () => {})
  return
}
if (!config.user || !config.password) {
  suite.testAsync('skipping SHA256 tests (missing env)', () => {})
  return
}

suite.testAsync('can connect using sha256 password authentication', async () => {
  const client = new gaussdb.Client(config)
  let usingSha256 = false
  client.connection.once('authenticationSHA256Password', () => {
    usingSha256 = true
  })
  await client.connect()
  assert.ok(usingSha256, 'Should be using SHA256 for authentication')

  // Test basic query execution
  const { rows } = await client.query('SELECT NOW()')
  assert.strictEqual(rows.length, 1)

  await client.end()
})

suite.testAsync('sha256 authentication fails when password is wrong', async () => {
  const client = new gaussdb.Client({
    ...config,
    password: config.password + 'append-something-to-make-it-bad',
  })
  let usingSha256 = false
  client.connection.once('authenticationSHA256Password', () => {
    usingSha256 = true
  })
  await assert.rejects(
    () => client.connect(),
    {
      code: '28P01',
    },
    'Error code should be for a password error'
  )
  assert.ok(usingSha256, 'Should be using SHA256 for authentication')
})

suite.testAsync('sha256 authentication fails when password is empty', async () => {
  const client = new gaussdb.Client({
    ...config,
    // use a password function to simulate empty password
    password: () => '',
  })
  let usingSha256 = false
  client.connection.once('authenticationSHA256Password', () => {
    usingSha256 = true
  })
  await assert.rejects(
    () => client.connect(),
    (err) => {
      // Should fail with authentication error
      return err.code === '28P01' || err.message.includes('password')
    },
    'Should fail with password-related error'
  )
  assert.ok(usingSha256, 'Should be using SHA256 for authentication')
})
