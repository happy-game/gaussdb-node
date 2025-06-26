'use strict'
const helper = require('./../test-helper')
const gaussdb = helper.gaussdb
const native = helper.args.native
const assert = require('assert')

const pool = new gaussdb.Pool()

pool.connect(
  assert.calls(function (err, client, done) {
    if (native) {
      assert(client.native)
    } else {
      assert(!client.native)
    }
    done()
    pool.end()
  })
)
