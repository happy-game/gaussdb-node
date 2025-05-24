'use strict'
const crypto = require('crypto')

/**
 * RFC5802 algorithm implementation
 * reference: https://github.com/jackc/pgx/commit/3d247719df5910a2adcf935a5038efa26fde58e2#diff-e7952278d2dec72dcda153feed6236482904c063027f34c6474302b112e3d1c9
 *
 * @param {string} password - Password
 * @param {string} random64code - 64-bit random code
 * @param {string} token - 8-bit token
 * @param {string} serverSignature - Server signature (unused)
 * @param {number} serverIteration - Server iteration count
 * @param {string} method - Hash method (sha256)
 * @returns {Buffer} - Result byte array
 */
function RFC5802Algorithm(password, random64code, token, serverSignature, serverIteration, method) {
  const k = generateKFromPBKDF2(password, random64code, serverIteration)
  const serverKey = getKeyFromHmac(k, Buffer.from('Sever Key'))
  const clientKey = getKeyFromHmac(k, Buffer.from('Client Key'))

  let storedKey
  if (method.toLowerCase() === 'sha256') {
    storedKey = getSha256(clientKey)
  } else {
    throw new Error('Only sha256 method is supported')
  }

  const tokenByte = hexStringToBytes(token)
  const clientSignature = getKeyFromHmac(serverKey, tokenByte)

  if (serverSignature && serverSignature !== bytesToHexString(clientSignature)) {
    return Buffer.from('')
  }

  const hmacResult = getKeyFromHmac(storedKey, tokenByte)
  const h = xorBetweenPassword(hmacResult, clientKey, clientKey.length)

  return bytesToHex(h)
}

/**
 * Generate key using PBKDF2
 *
 * @param {string} password - Password
 * @param {string} random64code - 64-bit random code
 * @param {number} serverIteration - Server iteration count
 * @returns {Buffer} - Generated key
 */
function generateKFromPBKDF2(password, random64code, serverIteration) {
  const random32code = hexStringToBytes(random64code)
  return crypto.pbkdf2Sync(password, random32code, serverIteration, 32, 'sha1')
}

/**
 * Convert hex string to byte array
 *
 * @param {string} hexString - Hex string
 * @returns {Buffer} - Byte array
 */
function hexStringToBytes(hexString) {
  if (hexString === '') {
    return Buffer.from('')
  }

  const upperString = hexString.toUpperCase()
  const bytesLen = Math.floor(upperString.length / 2)
  const array = Buffer.alloc(bytesLen)

  for (let i = 0; i < bytesLen; i++) {
    const pos = i * 2
    array[i] = (charToByte(upperString.charAt(pos)) << 4) | charToByte(upperString.charAt(pos + 1))
  }

  return array
}

/**
 * Convert hex character to byte
 *
 * @param {string} c - Hex character
 * @returns {number} - Byte value
 */
function charToByte(c) {
  return '0123456789ABCDEF'.indexOf(c)
}

/**
 * Convert byte array to hex string
 *
 * @param {Buffer} src - Byte array
 * @returns {string} - Hex string
 */
function bytesToHexString(src) {
  let s = ''
  for (let i = 0; i < src.length; i++) {
    const v = src[i] & 0xff
    const hv = v.toString(16)
    if (hv.length < 2) {
      s += '0' + hv
    } else {
      s += hv
    }
  }
  return s
}

/**
 * Calculate HMAC with key and data
 *
 * @param {Buffer} key - Key
 * @param {Buffer} data - Data
 * @returns {Buffer} - HMAC result
 */
function getKeyFromHmac(key, data) {
  const hmac = crypto.createHmac('sha256', key)
  hmac.update(data)
  return hmac.digest()
}

/**
 * Calculate SHA256 hash
 *
 * @param {Buffer} message - Message
 * @returns {Buffer} - SHA256 hash
 */
function getSha256(message) {
  const hash = crypto.createHash('sha256')
  hash.update(message)
  return hash.digest()
}

/**
 * Perform XOR operation on two passwords
 *
 * @param {Buffer} password1 - First password
 * @param {Buffer} password2 - Second password
 * @param {number} length - Length
 * @returns {Buffer} - XOR result
 */
function xorBetweenPassword(password1, password2, length) {
  const array = Buffer.alloc(length)
  for (let i = 0; i < length; i++) {
    array[i] = password1[i] ^ password2[i]
  }
  return array
}

/**
 * Convert byte array to hex bytes
 *
 * @param {Buffer} bytes - Byte array
 * @returns {Buffer} - Hex bytes
 */
function bytesToHex(bytes) {
  const lookup = Buffer.from('0123456789abcdef')
  const result = Buffer.alloc(bytes.length * 2)
  let pos = 0

  for (let i = 0; i < bytes.length; i++) {
    const c = bytes[i] & 0xff
    const j = c >> 4
    result[pos] = lookup[j]
    pos++
    const k = c & 0xf
    result[pos] = lookup[k]
    pos++
  }

  return result
}

module.exports = { RFC5802Algorithm }
