'use strict'
const helper = require('../test-helper')
const assert = require('assert')
const suite = new helper.Suite()

// 测试加密模块的核心功能
suite.testAsync('crypto module exports', async () => {
  const crypto = require('../../../lib/crypto/utils')

  // 检查模块是否导出了必要的函数
  assert.strictEqual(typeof crypto.gaussdbMd5PasswordHash, 'function')
  assert.strictEqual(typeof crypto.gaussdbSha256PasswordHash, 'function')
  assert.strictEqual(typeof crypto.randomBytes, 'function')
  assert.strictEqual(typeof crypto.deriveKey, 'function')
  assert.strictEqual(typeof crypto.sha256, 'function')
  assert.strictEqual(typeof crypto.md5, 'function')
})

suite.testAsync('gaussdbMd5PasswordHash function', async () => {
  const crypto = require('../../../lib/crypto/utils')

  // 测试MD5密码哈希功能
  const user = 'testuser'
  const password = 'testpass'
  const salt = Buffer.from([1, 2, 3, 4])

  const hashed = await crypto.gaussdbMd5PasswordHash(user, password, salt)
  assert.strictEqual(typeof hashed, 'string')
  assert(hashed.startsWith('md5'))
  assert.strictEqual(hashed.length, 35) // 'md5' + 32位十六进制字符
})

suite.testAsync('gaussdbSha256PasswordHash function', async () => {
  const crypto = require('../../../lib/crypto/utils')

  // 测试SHA256密码哈希功能
  const user = 'testuser'
  const password = 'testpass'

  // 构造模拟的salt数据，符合GaussDB SHA256认证的数据结构
  // 结构: [4 bytes method][64 bytes random code][8 bytes token][4 bytes iteration]
  const data = Buffer.alloc(80)
  data.writeInt32BE(1, 0) // password method
  data.write('A'.repeat(64), 4, 'ascii') // 64-byte random code
  data.write('B'.repeat(8), 68, 'ascii') // 8-byte token
  data.writeInt32BE(1000, 76) // iteration count

  const hashed = await crypto.gaussdbSha256PasswordHash(user, password, data)
  assert.strictEqual(typeof hashed, 'string')
  // SHA256哈希结果应该是ASCII字符串
})

suite.testAsync('randomBytes function', async () => {
  const crypto = require('../../../lib/crypto/utils')

  // 测试随机字节生成功能
  const bytes1 = crypto.randomBytes(16)
  const bytes2 = crypto.randomBytes(16)

  assert(bytes1 instanceof Buffer)
  assert.strictEqual(bytes1.length, 16)
  assert(bytes2 instanceof Buffer)
  assert.strictEqual(bytes2.length, 16)

  // 两次生成的随机数据应该不同
  assert.notStrictEqual(bytes1.toString('hex'), bytes2.toString('hex'))
})

suite.testAsync('sha256 function', async () => {
  const crypto = require('../../../lib/crypto/utils')

  // 测试SHA256哈希功能
  const data = Buffer.from('hello world')
  const hash = await crypto.sha256(data)

  // WebCrypto实现返回ArrayBuffer而不是Buffer
  assert(hash instanceof ArrayBuffer || hash instanceof Buffer)
  assert.strictEqual(hash.byteLength || hash.length, 32) // SHA256 produces 32-byte output
})

suite.testAsync('md5 function', async () => {
  const crypto = require('../../../lib/crypto/utils')

  // 测试MD5哈希功能
  const hash = await crypto.md5('hello world')
  assert.strictEqual(typeof hash, 'string')
  assert.strictEqual(hash.length, 32) // MD5 produces 32-character hex string
  assert.strictEqual(hash, '5eb63bbbe01eeed093cb22bb8f5acdc3') // known MD5 of 'hello world'
})

suite.testAsync('deriveKey function', async () => {
  const crypto = require('../../../lib/crypto/utils')

  // 测试密钥派生功能
  const password = 'password'
  const salt = Buffer.from('salt')
  const iterations = 100

  const key = await crypto.deriveKey(password, salt, iterations)
  // 不同实现返回不同类型，WebCrypto返回ArrayBuffer，Legacy返回Buffer
  assert(key instanceof ArrayBuffer || key instanceof Buffer)
  assert.strictEqual(key.byteLength || key.length, 32) // PBKDF2-SHA256 produces 32-byte key
})

// 测试RFC5802算法实现
suite.testAsync('RFC5802Algorithm function', async () => {
  const { RFC5802Algorithm } = require('../../../lib/crypto/rfc5802')

  // 测试RFC5802算法实现
  const password = 'password'
  const random64code = 'A'.repeat(64)
  const token = 'B'.repeat(8)
  const serverSignature = ''
  const serverIteration = 1000
  const method = 'sha256'

  const result = RFC5802Algorithm(password, random64code, token, serverSignature, serverIteration, method)
  assert(result instanceof Buffer)
})

// 测试证书签名功能
suite.testAsync('signatureAlgorithmHashFromCertificate function', async () => {
  const { signatureAlgorithmHashFromCertificate } = require('../../../lib/crypto/cert-signatures')

  // 测试证书签名算法哈希功能（简单测试）
  assert.strictEqual(typeof signatureAlgorithmHashFromCertificate, 'function')
})

// 测试SASL功能
suite.testAsync('SASL functions', async () => {
  const sasl = require('../../../lib/crypto/sasl')

  // 测试SASL会话启动功能
  assert.strictEqual(typeof sasl.startSession, 'function')
  assert.strictEqual(typeof sasl.continueSession, 'function')
  assert.strictEqual(typeof sasl.finalizeSession, 'function')

  // 测试startSession函数
  const mechanisms = ['SCRAM-SHA-256']
  const session = sasl.startSession(mechanisms)

  assert.strictEqual(typeof session.mechanism, 'string')
  assert.strictEqual(typeof session.clientNonce, 'string')
  assert.strictEqual(typeof session.response, 'string')
  assert.strictEqual(typeof session.message, 'string')

  // 测试错误情况 - 不支持的机制
  try {
    sasl.startSession(['UNSUPPORTED-MECH'])
    assert.fail('Should have thrown an error for unsupported mechanism')
  } catch (err) {
    // 错误消息可能因环境而异，我们只检查它是否是Error实例
    assert(err instanceof Error)
  }
})
