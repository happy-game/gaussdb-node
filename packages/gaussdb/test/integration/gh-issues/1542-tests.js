'use strict'
const helper = require('./../test-helper')
const assert = require('assert')

const suite = new helper.Suite()

suite.testAsync('BoundPool can be subclassed', async () => {
  const Pool = helper.gaussdb.Pool
  class SubPool extends Pool {}
  const subPool = new SubPool()
  const client = await subPool.connect()
  client.release()
  await subPool.end()
  assert(subPool instanceof helper.gaussdb.Pool)
})

suite.test('calling pg.Pool without new throws', () => {
  const Pool = helper.gaussdb.Pool
  assert.throws(() => {
    Pool()
  })
})
