'use strict'
const helper = require('./test-helper')
const assert = require('assert')
const suite = new helper.Suite()

// TODO
// suite.test('can connect with ssl', function () {
//   const config = {
//     ...helper.config,
//     ssl: {
//       rejectUnauthorized: false,
//     },
//   }
//   const client = new helper.pg.Client(config)
//   client.connect(
//     assert.success(function () {
//       client.query(
//         'SELECT NOW()',
//         assert.success(function () {
//           client.end()
//         })
//       )
//     })
//   )
// })

// ssl-tests.js
//   can connect with ssl ✔
// Error: The server does not support SSL connections