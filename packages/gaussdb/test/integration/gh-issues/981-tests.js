'use strict'
const helper = require('./../test-helper')

//native bindings are only installed for native tests
if (!helper.args.native) {
  return
}

const assert = require('assert')
const gaussdb = require('../../../lib')
const native = require('../../../lib').native

const JsClient = require('../../../lib/client')
const NativeClient = require('../../../lib/native')

assert(gaussdb.Client === JsClient)
assert(native.Client === NativeClient)

const jsPool = new gaussdb.Pool()
const nativePool = new native.Pool()

const suite = new helper.Suite()
suite.test('js pool returns js client', (cb) => {
  jsPool.connect(function (err, client, done) {
    assert(client instanceof JsClient)
    done()
    jsPool.end(cb)
  })
})

suite.test('native pool returns native client', (cb) => {
  nativePool.connect(function (err, client, done) {
    assert(client instanceof NativeClient)
    done()
    nativePool.end(cb)
  })
})
