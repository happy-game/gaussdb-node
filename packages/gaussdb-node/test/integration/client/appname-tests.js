'use strict'
const helper = require('./test-helper')
const Client = helper.Client
const assert = require('assert')

const suite = new helper.Suite()

const conInfo = helper.config

function getConInfo(override) {
  return Object.assign({}, conInfo, override)
}

function getAppName(conf, cb) {
  const client = new Client(conf)
  client.connect(
    assert.success(function () {
      client.query(
        'SHOW application_name',
        assert.success(function (res) {
          const appName = res.rows[0].application_name
          cb(appName)
          client.end()
        })
      )
    })
  )
}

// Determine default application_name based on database type
// GaussDB defaults to 'dn_6002', OpenGauss defaults to empty string
const getDefaultAppName = () => {
  // Check environment variable to determine database type
  const dbType = process.env.DB_TYPE || process.env.GAUSS_TYPE || 'gaussdb'
  return dbType.toLowerCase() === 'opengauss' ? '' : 'dn_6002'
}

suite.test('No default appliation_name ', function (done) {
  const expectedAppName = getDefaultAppName()
  getAppName({}, function (res) {
    assert.strictEqual(res, expectedAppName)
    done()
  })
})

suite.test('fallback_application_name is used', function (done) {
  const fbAppName = 'this is my app'
  const conf = getConInfo({
    fallback_application_name: fbAppName,
  })
  getAppName(conf, function (res) {
    assert.strictEqual(res, fbAppName)
    done()
  })
})

suite.test('application_name is used', function (done) {
  const appName = 'some wired !@#$% application_name'
  const conf = getConInfo({
    application_name: appName,
  })
  getAppName(conf, function (res) {
    assert.strictEqual(res, appName)
    done()
  })
})

suite.test('application_name has precedence over fallback_application_name', function (done) {
  const appName = 'some wired !@#$% application_name'
  const fbAppName = 'some other strange $$test$$ appname'
  const conf = getConInfo({
    application_name: appName,
    fallback_application_name: fbAppName,
  })
  getAppName(conf, function (res) {
    assert.strictEqual(res, appName)
    done()
  })
})

suite.test('application_name from connection string', function (done) {
  const appName = 'my app'
  const conParams = require('../../../lib/connection-parameters')
  let conf
  if (process.argv[2]) {
    conf = new conParams(process.argv[2] + '?application_name=' + appName)
  } else {
    conf = 'gaussdb://?application_name=' + appName
  }
  getAppName(conf, function (res) {
    assert.strictEqual(res, appName)
    done()
  })
})
