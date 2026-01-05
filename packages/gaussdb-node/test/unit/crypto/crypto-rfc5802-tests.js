'use strict'
const helper = require('../test-helper')
const assert = require('assert')
const suite = new helper.Suite()

// 测试RFC5802算法的详细实现
suite.testAsync('RFC5802Algorithm basic functionality', async () => {
  const { RFC5802Algorithm } = require('../../../lib/crypto/rfc5802')

  // 测试基本功能
  const password = 'password'
  const random64code = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef' // 64字符
  const token = 'abcd1234' // 8字符
  const serverSignature = ''
  const serverIteration = 4096
  const method = 'sha256'

  const result = RFC5802Algorithm(password, random64code, token, serverSignature, serverIteration, method)
  assert(result instanceof Buffer)
  assert(result.length > 0)
})

suite.testAsync('RFC5802Algorithm with empty password', async () => {
  const { RFC5802Algorithm } = require('../../../lib/crypto/rfc5802')

  // 测试空密码
  const password = ''
  const random64code = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
  const token = 'abcd1234'
  const serverSignature = ''
  const serverIteration = 4096
  const method = 'sha256'

  const result = RFC5802Algorithm(password, random64code, token, serverSignature, serverIteration, method)
  assert(result instanceof Buffer)
  assert(result.length > 0)
})

suite.testAsync('RFC5802Algorithm with special characters', async () => {
  const { RFC5802Algorithm } = require('../../../lib/crypto/rfc5802')

  // 测试特殊字符密码
  const password = 'p@ssw0rd!#$%'
  const random64code = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
  const token = 'abcd1234'
  const serverSignature = ''
  const serverIteration = 4096
  const method = 'sha256'

  const result = RFC5802Algorithm(password, random64code, token, serverSignature, serverIteration, method)
  assert(result instanceof Buffer)
  assert(result.length > 0)
})

suite.testAsync('RFC5802Algorithm with server signature validation', async () => {
  const { RFC5802Algorithm } = require('../../../lib/crypto/rfc5802')

  // 测试服务器签名验证
  const password = 'password'
  const random64code = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
  const token = 'abcd1234'
  const serverSignature = 'invalid_signature'
  const serverIteration = 4096
  const method = 'sha256'

  const result = RFC5802Algorithm(password, random64code, token, serverSignature, serverIteration, method)
  assert(result instanceof Buffer)
  assert.strictEqual(result.length, 0) // 应该返回空缓冲区，因为签名不匹配
})

suite.testAsync('RFC5802Algorithm with different methods', async () => {
  const { RFC5802Algorithm } = require('../../../lib/crypto/rfc5802')

  // 测试SHA256方法
  const password = 'password'
  const random64code = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
  const token = 'abcd1234'
  const serverSignature = ''
  const serverIteration = 4096
  const method = 'sha256'

  const result = RFC5802Algorithm(password, random64code, token, serverSignature, serverIteration, method)
  assert(result instanceof Buffer)

  // 测试不支持的方法
  try {
    RFC5802Algorithm(password, random64code, token, serverSignature, serverIteration, 'md5')
    assert.fail('Should have thrown an error for unsupported method')
  } catch (err) {
    assert.strictEqual(err.message, 'Only sha256 method is supported')
  }
})
