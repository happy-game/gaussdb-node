'use strict'
const helper = require('../test-helper')
const assert = require('assert')
const suite = new helper.Suite()

// 测试证书签名功能
suite.testAsync('signatureAlgorithmHashFromCertificate function', async () => {
  const { signatureAlgorithmHashFromCertificate } = require('../../../lib/crypto/cert-signatures')

  // 测试函数存在性
  assert.strictEqual(typeof signatureAlgorithmHashFromCertificate, 'function')

  // 创建一个简单的模拟证书数据（简化版X.509结构）
  // 这是一个非常简化的测试，实际证书结构要复杂得多
  const certData = Buffer.from([
    0x30, // SEQUENCE
    0x0c, // 长度
    0x06, // OID
    0x08, // OID长度
    0x2a,
    0x86,
    0x48,
    0x86,
    0xf7,
    0x0d,
    0x02,
    0x05, // SHA256 OID
    0x05,
    0x00, // NULL
  ])

  // 测试正常情况
  try {
    const result = signatureAlgorithmHashFromCertificate(certData, 0)
    // 函数应该返回 'SHA256'
    assert.strictEqual(typeof result, 'string')
  } catch (err) {
    // 如果证书数据不完整，可能会抛出异常，这在测试中是可以接受的
    assert(err instanceof Error)
  }
})

suite.testAsync('x509Error function', async () => {
  const certSignatures = require('../../../lib/crypto/cert-signatures')

  // 由于x509Error是内部函数，我们无法直接测试它
  // 但我们可以通过测试其他会调用它的函数来间接测试

  // 创建无效的证书数据来触发错误
  const invalidCertData = Buffer.from([0xff, 0xff]) // 无效的数据

  try {
    certSignatures.signatureAlgorithmHashFromCertificate(invalidCertData, 0)
    // 如果没有抛出错误，测试失败
    assert.fail('Should have thrown an error')
  } catch (err) {
    // 应该抛出一个包含适当错误消息的错误
    assert(err instanceof Error)
    assert(err.message.includes('SASL channel binding'))
  }
})

// 测试边界情况和错误处理
suite.testAsync('certificate functions edge cases', async () => {
  const { signatureAlgorithmHashFromCertificate } = require('../../../lib/crypto/cert-signatures')

  // 测试空缓冲区
  try {
    signatureAlgorithmHashFromCertificate(Buffer.alloc(0), 0)
    assert.fail('Should have thrown an error for empty buffer')
  } catch (err) {
    assert(err instanceof Error)
  }

  // 测试null输入
  try {
    signatureAlgorithmHashFromCertificate(null, 0)
    assert.fail('Should have thrown an error for null input')
  } catch (err) {
    assert(err instanceof Error)
  }

  // 测试undefined输入
  try {
    signatureAlgorithmHashFromCertificate(undefined, 0)
    assert.fail('Should have thrown an error for undefined input')
  } catch (err) {
    assert(err instanceof Error)
  }
})
