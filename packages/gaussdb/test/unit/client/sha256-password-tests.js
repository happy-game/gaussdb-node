'use strict'
const helper = require('./test-helper')
const BufferList = require('../../buffer-list')
const crypto = require('../../../lib/crypto/utils')
const assert = require('assert')
const suite = new helper.Suite()
const test = suite.test.bind(suite)

test('sha256 authentication', async function () {
  const client = helper.createClient()
  client.password = '!'
  // Mock SHA256 authentication data following the format expected by gaussdbSha256PasswordHash, similar to the MD5 test
  // Structure: [4 bytes method][64 bytes random code][8 bytes token][4 bytes iteration]
  const data = Buffer.alloc(80)
  data.writeInt32BE(1, 0) // password method. in fact this data is not used in the hashing
  data.write('A'.repeat(64), 4, 'ascii') // 64-byte random code
  data.write('B'.repeat(8), 68, 'ascii') // 8-byte token
  data.writeInt32BE(1000, 76) // iteration count

  await client.connection.emit('authenticationSHA256Password', { data: data })

  setTimeout(() =>
    test('responds', function () {
      assert.lengthIs(client.connection.stream.packets, 1)
      test('should have correct encrypted data', async function () {
        const hashedPassword = await crypto.gaussdbSha256PasswordHash(client.user, client.password, data)
        assert.equalBuffers(
          client.connection.stream.packets[0],
          new BufferList().addCString(hashedPassword).join(true, 'p')
        )
      })
    })
  )
})

test('sha256 authentication with empty password', async function () {
  const client = helper.createClient()
  client.password = ''
  const data = Buffer.alloc(80)
  data.writeInt32BE(1, 0)
  data.write('A'.repeat(64), 4, 'ascii')
  data.write('B'.repeat(8), 68, 'ascii')
  data.writeInt32BE(1000, 76)

  await client.connection.emit('authenticationSHA256Password', { data: data })

  setTimeout(() =>
    test('responds with empty password', function () {
      assert.lengthIs(client.connection.stream.packets, 1)
      test('should have correct encrypted data for empty password', async function () {
        const hashedPassword = await crypto.gaussdbSha256PasswordHash(client.user, client.password, data)
        assert.equalBuffers(
          client.connection.stream.packets[0],
          new BufferList().addCString(hashedPassword).join(true, 'p')
        )
      })
    })
  )
})

test('sha256 authentication with utf-8 password', async function () {
  const client = helper.createClient()
  client.password = 'test_password_123'
  const data = Buffer.alloc(80)
  data.writeInt32BE(1, 0)
  data.write('A'.repeat(64), 4, 'ascii')
  data.write('B'.repeat(8), 68, 'ascii')
  data.writeInt32BE(1000, 76)

  await client.connection.emit('authenticationSHA256Password', { data: data })

  setTimeout(() =>
    test('responds with utf-8 password', function () {
      assert.lengthIs(client.connection.stream.packets, 1)
      test('should have correct encrypted data for utf-8 password', async function () {
        const hashedPassword = await crypto.gaussdbSha256PasswordHash(client.user, client.password, data)
        assert.equalBuffers(
          client.connection.stream.packets[0],
          new BufferList().addCString(hashedPassword).join(true, 'p')
        )
      })
    })
  )
})
