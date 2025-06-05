'use strict'
const helper = require('./test-helper')
const assert = require('assert')
const suite = new helper.Suite()

// allow skipping of this test via env var for
// local testing when you don't have SSL set up
if (process.env.GAUSSTESTNOSSL) {
  return
}

suite.test('can connect with ssl', function () {
  const config = {
    ...helper.config,
    ssl: {
      rejectUnauthorized: false,
    },
  }
  const client = new helper.gaussdb.Client(config)
  client.connect(
    assert.success(function () {
      client.query(
        'SELECT NOW()',
        assert.success(function () {
          client.end()
        })
      )
    })
  )
})
