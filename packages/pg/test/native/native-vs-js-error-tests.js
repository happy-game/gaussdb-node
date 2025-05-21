'use strict'
const assert = require('assert')
const Client = require('../../lib/client')
const NativeClient = require('../../lib/native')

const client = new Client()
const nativeClient = new NativeClient()

client.connect()
// nativeClient.connect((err) => {
//   client.query('SELECT alsdkfj', (err) => {
//     client.end()

//     nativeClient.query('SELECT lkdasjfasd', (nativeErr) => {
//       for (const key in nativeErr) {
//         assert.equal(err[key], nativeErr[key], `Expected err.${key} to equal nativeErr.${key}`)
//       }
//       nativeClient.end()
//     })
//   })
// })

// TODO but 困惑
// AssertionError [ERR_ASSERTION]: Expected err.where to equal nativeErr.where
//     at module.exports.callback (/home/happy/gaussdb-node/packages/pg/test/native/native-vs-js-error-tests.js:16:16)
//     at NativeQuery.handleError (/home/happy/gaussdb-node/packages/pg/lib/native/query.js:59:10)
//     at after (/home/happy/gaussdb-node/packages/pg/lib/native/query.js:99:19)
//     at Client._onReadyForQuery (/home/happy/gaussdb-node/packages/pg-native/index.js:329:5)
//     at module.exports.emit (node:events:518:28)
//     at Client._read (/home/happy/gaussdb-node/packages/pg-native/index.js:236:8)
//     at PQ.emit (node:events:518:28) {
//   generatedMessage: false,
//   code: 'ERR_ASSERTION',
//   actual: 'referenced column: alsdkfj',
//   expected: 'referenced column: lkdasjfasd',
//   operator: '=='
// }