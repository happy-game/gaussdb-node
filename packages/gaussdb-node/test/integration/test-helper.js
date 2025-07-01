'use strict'
const helper = require('./../test-helper')
const { Client } = helper
const assert = require('assert')

// Native bindings are no longer supported
// All tests now use pure JavaScript implementation

// creates a client from cli parameters
helper.client = function (cb) {
  const client = new Client()
  client.connect(cb)
  return client
}

helper.versionGTE = function (client, testVersion, callback) {
  client.query(
    'SHOW server_version_num',
    assert.calls(function (err, result) {
      if (err) return callback(err)
      const version = parseInt(result.rows[0].server_version_num, 10)
      return callback(null, version >= testVersion)
    })
  )
}

// export parent helper stuffs
module.exports = helper
