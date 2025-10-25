'use strict'
const co = require('co')
const expect = require('expect.js')

const describe = require('mocha').describe
const it = require('mocha').it
const BluebirdPromise = require('bluebird')

const Pool = require('../')

const checkType = (promise) => {
  expect(promise).to.be.a(BluebirdPromise)
  return promise.catch((e) => undefined)
}

describe('Bring your own promise', function () {
  this.timeout(10000) // 增加超时时间到10秒

  it(
    'uses supplied promise for operations',
    co.wrap(function* () {
      const pool = new Pool({ Promise: BluebirdPromise })
      const client1 = yield checkType(pool.connect())
      if (client1) client1.release()
      yield checkType(pool.query('SELECT NOW()'))
      const client2 = yield checkType(pool.connect())
      // TODO - make sure pg supports BYOP as well
      if (client2) client2.release()
      yield checkType(pool.end())
    })
  )

  it(
    'uses promises in errors',
    co.wrap(function* () {
      const pool = new Pool({
        Promise: BluebirdPromise,
        port: 48484,
        connectionTimeoutMillis: 1000,
        max: 1,
      })
      yield checkType(pool.connect())
      yield checkType(pool.query('SELECT NOW()'))
      yield checkType(pool.end())
    })
  )
})
