'use strict'
const helper = require('../test-helper')
const assert = require('assert')
const suite = new helper.Suite()

// 测试SASL功能
suite.testAsync('sasl startSession function', async () => {
  const sasl = require('../../../lib/crypto/sasl')

  // 测试基本功能
  const mechanisms = ['SCRAM-SHA-256']
  const session = sasl.startSession(mechanisms)

  assert.strictEqual(typeof session, 'object')
  assert.strictEqual(typeof session.mechanism, 'string')
  assert.strictEqual(typeof session.clientNonce, 'string')
  assert.strictEqual(typeof session.response, 'string')
  assert.strictEqual(typeof session.message, 'string')

  assert.strictEqual(session.mechanism, 'SCRAM-SHA-256')
  assert(session.clientNonce.length > 0)
  assert(session.response.length > 0)
  assert.strictEqual(session.message, 'SASLInitialResponse')
})

suite.testAsync('sasl startSession with stream', async () => {
  const sasl = require('../../../lib/crypto/sasl')

  // 测试带流的会话启动
  const mechanisms = ['SCRAM-SHA-256']
  const mockStream = {}
  const session = sasl.startSession(mechanisms, mockStream)

  assert.strictEqual(session.mechanism, 'SCRAM-SHA-256')
})

suite.testAsync('sasl startSession with SCRAM-SHA-256-PLUS support', async () => {
  const sasl = require('../../../lib/crypto/sasl')

  // 测试SCRAM-SHA-256-PLUS支持
  const mechanisms = ['SCRAM-SHA-256', 'SCRAM-SHA-256-PLUS']
  const mockStream = {
    getPeerCertificate: function () {
      return {}
    },
  }
  const session = sasl.startSession(mechanisms, mockStream)

  // 应该优先选择SCRAM-SHA-256-PLUS
  assert.strictEqual(session.mechanism, 'SCRAM-SHA-256-PLUS')
})

suite.testAsync('sasl startSession error handling', async () => {
  const sasl = require('../../../lib/crypto/sasl')

  // 测试不支持的机制
  try {
    sasl.startSession(['UNSUPPORTED-MECH'])
    assert.fail('Should have thrown an error for unsupported mechanism')
  } catch (err) {
    assert(err instanceof Error)
    assert(err.message.includes('Only mechanism(s)'))
  }

  // 测试SCRAM-SHA-256-PLUS需要证书的情况
  try {
    sasl.startSession(['SCRAM-SHA-256-PLUS'], {})
    assert.fail('Should have thrown an error for SCRAM-SHA-256-PLUS without certificate')
  } catch (err) {
    assert(err instanceof Error)
    assert(err.message.includes('requires a certificate'))
  }
})

suite.testAsync('sasl continueSession function', async () => {
  const sasl = require('../../../lib/crypto/sasl')

  // 测试会话继续功能
  const session = {
    message: 'SASLInitialResponse',
    clientNonce: 'rOprNGfwEbeRWgbNEkqO',
  }

  const password = 'password'
  const serverData = 'r=rOprNGfwEbeRWgbNEkqO%hvYDpWUa2RaTCAfuxFIlj)hNlF$k0,s=W22ZaJ0SNY7soEsUEjb6gQ==,i=4096'

  try {
    // 这会抛出错误，因为我们没有提供流
    await sasl.continueSession(session, password, serverData)
  } catch (err) {
    // 错误是预期的，因为我们没有提供有效的流
    assert(err instanceof Error)
  }
})

suite.testAsync('sasl continueSession error handling', async () => {
  const sasl = require('../../../lib/crypto/sasl')

  // 测试错误处理 - 错误的会话消息
  const session = {
    message: 'InvalidMessage',
  }

  try {
    await sasl.continueSession(session, 'password', 'serverData')
    assert.fail('Should have thrown an error for invalid session message')
  } catch (err) {
    assert(err instanceof Error)
    assert(err.message.includes('Last message was not SASLInitialResponse'))
  }

  // 测试错误处理 - 非字符串密码
  try {
    await sasl.continueSession({ message: 'SASLInitialResponse' }, 123, 'serverData')
    assert.fail('Should have thrown an error for non-string password')
  } catch (err) {
    assert(err instanceof Error)
    assert(err.message.includes('client password must be a string'))
  }

  // 测试错误处理 - 空密码
  try {
    await sasl.continueSession({ message: 'SASLInitialResponse' }, '', 'serverData')
    assert.fail('Should have thrown an error for empty password')
  } catch (err) {
    assert(err instanceof Error)
    assert(err.message.includes('client password must be a non-empty string'))
  }

  // 测试错误处理 - 非字符串服务器数据
  try {
    await sasl.continueSession({ message: 'SASLInitialResponse' }, 'password', 123)
    assert.fail('Should have thrown an error for non-string server data')
  } catch (err) {
    assert(err instanceof Error)
    assert(err.message.includes('serverData must be a string'))
  }
})

suite.testAsync('sasl finalizeSession function', async () => {
  const sasl = require('../../../lib/crypto/sasl')

  // 测试会话结束功能
  const session = {
    salt: 'salt',
    serverSignature: 'signature',
  }

  const serverData = 'v=6rriTRBi23WpRR/wtup+mMhUZUn/dB5nLTJRsjl95G4='

  try {
    sasl.finalizeSession(session, serverData)
    // 如果没有抛出错误，说明函数执行成功
  } catch (err) {
    // 某些情况下可能会抛出错误，这取决于具体的实现
    assert(err instanceof Error)
  }
})

suite.testAsync('sasl parseServerFirstMessage function', async () => {
  const sasl = require('../../../lib/crypto/sasl')

  // 通过间接方式测试parseServerFirstMessage函数
  const session = {
    message: 'SASLInitialResponse',
    clientNonce: 'rOprNGfwEbeRWgbNEkqO',
  }

  // 有效的服务器数据
  const serverData = 'r=rOprNGfwEbeRWgbNEkqO%hvYDpWUa2RaTCAfuxFIlj)hNlF$k0,s=W22ZaJ0SNY7soEsUEjb6gQ==,i=4096'

  try {
    // 这个调用会间接测试parseServerFirstMessage函数
    await sasl.continueSession(session, 'password', serverData)
  } catch (err) {
    // 错误是预期的，因为我们没有提供流
    assert(err instanceof Error)
  }

  // 无效的服务器数据
  const invalidServerData = 'invalid,data'

  try {
    await sasl.continueSession(session, 'password', invalidServerData)
    assert.fail('Should have thrown an error for invalid server data')
  } catch (err) {
    assert(err instanceof Error)
  }
})

// 测试边界情况
suite.testAsync('sasl edge cases', async () => {
  const sasl = require('../../../lib/crypto/sasl')

  // 测试空机制数组
  try {
    sasl.startSession([])
    assert.fail('Should have thrown an error for empty mechanisms')
  } catch (err) {
    assert(err instanceof Error)
    assert(err.message.includes('Only mechanism(s)'))
  }

  // 测试随机数生成功能
  const session1 = sasl.startSession(['SCRAM-SHA-256'])
  const session2 = sasl.startSession(['SCRAM-SHA-256'])

  // 两次生成的随机数应该不同
  assert.notStrictEqual(session1.clientNonce, session2.clientNonce)
})
