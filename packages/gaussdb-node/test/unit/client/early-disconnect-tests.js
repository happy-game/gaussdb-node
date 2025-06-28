'use strict'
require('./test-helper')
const net = require('net')
const gaussdb = require('../../../lib/index.js')
const assert = require('assert')

/* console.log() messages show up in `make test` output. TODO: fix it. */
const server = net.createServer(function (c) {
  c.destroy()
  server.close()
})

server.listen(7777, function () {
  const client = new gaussdb.Client('gaussdb://localhost:7777')
  client.connect(
    assert.calls(function (err) {
      assert(err)
    })
  )
})
