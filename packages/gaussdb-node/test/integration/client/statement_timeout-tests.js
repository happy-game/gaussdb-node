'use strict'
const helper = require('./test-helper')
const Client = helper.Client

const assert = require('assert')
const suite = new helper.Suite()

const conInfo = helper.config

function getConInfo(override) {
  return Object.assign({}, conInfo, override)
}

function getStatementTimeout(conf, cb) {
  const client = new Client(conf)
  client.connect(
    assert.success(function () {
      client.query(
        'SHOW statement_timeout',
        assert.success(function (res) {
          const statementTimeout = res.rows[0].statement_timeout
          cb(statementTimeout)
          client.end()
        })
      )
    })
  )
}

// Native bindings are no longer supported
suite.test('No default statement_timeout ', function (done) {
  getConInfo()
  getStatementTimeout({}, function (res) {
    assert.strictEqual(res, '0') // 0 = no timeout
    done()
  })
})

suite.test('statement_timeout integer is used', function (done) {
  const conf = getConInfo({
    statement_timeout: 3000,
  })
  getStatementTimeout(conf, function (res) {
    assert.strictEqual(res, '3s')
    done()
  })
})

suite.test('statement_timeout float is used', function (done) {
  const conf = getConInfo({
    statement_timeout: 3000.7,
  })
  getStatementTimeout(conf, function (res) {
    assert.strictEqual(res, '3s')
    done()
  })
})

suite.test('statement_timeout string is used', function (done) {
  const conf = getConInfo({
    statement_timeout: '3000',
  })
  getStatementTimeout(conf, function (res) {
    assert.strictEqual(res, '3s')
    done()
  })
})

suite.test('statement_timeout actually cancels long running queries', function (done) {
  const conf = getConInfo({
    statement_timeout: '10', // 10ms to keep tests running fast
  })
  const client = new Client(conf)
  client.connect(
    assert.success(function () {
      client.query('SELECT pg_sleep( 1 )', function (error) {
        client.end()
        assert.strictEqual(error.code, '57014') // query_cancelled
        done()
      })
    })
  )
})
