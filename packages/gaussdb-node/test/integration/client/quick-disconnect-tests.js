'use strict'
// test for issue #320
//
const helper = require('./test-helper')

const client = new helper.gaussdb.Client(helper.config)
client.connect()
client.end()
