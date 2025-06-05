const nodeCrypto = require('crypto')
const { RFC5802Algorithm } = require('./rfc5802')

module.exports = {
  gaussdbMd5PasswordHash,
  gaussdbSha256PasswordHash,
  randomBytes,
  deriveKey,
  sha256,
  hashByName,
  hmacSha256,
  md5,
}

/**
 * The Web Crypto API - grabbed from the Node.js library or the global
 * @type Crypto
 */
// eslint-disable-next-line no-undef
const webCrypto = nodeCrypto.webcrypto || globalThis.crypto
/**
 * The SubtleCrypto API for low level crypto operations.
 * @type SubtleCrypto
 */
const subtleCrypto = webCrypto.subtle
const textEncoder = new TextEncoder()

/**
 *
 * @param {*} length
 * @returns
 */
function randomBytes(length) {
  return webCrypto.getRandomValues(Buffer.alloc(length))
}

async function md5(string) {
  try {
    return nodeCrypto.createHash('md5').update(string, 'utf-8').digest('hex')
  } catch (e) {
    // `createHash()` failed so we are probably not in Node.js, use the WebCrypto API instead.
    // Note that the MD5 algorithm on WebCrypto is not available in Node.js.
    // This is why we cannot just use WebCrypto in all environments.
    const data = typeof string === 'string' ? textEncoder.encode(string) : string
    const hash = await subtleCrypto.digest('MD5', data)
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  }
}

// See AuthenticationMD5Password at https://www.postgresql.org/docs/current/static/protocol-flow.html
async function gaussdbMd5PasswordHash(user, password, salt) {
  const inner = await md5(password + user)
  const outer = await md5(Buffer.concat([Buffer.from(inner), salt]))
  return 'md5' + outer
}

async function gaussdbSha256PasswordHash(user, password, data) {
  // Constants for data structure parsing
  const PASSWORD_METHOD_OFFSET = 0
  const PASSWORD_METHOD_SIZE = 4
  const RANDOM_CODE_SIZE = 64
  const TOKEN_SIZE = 8
  const ITERATION_SIZE = 4

  const dataBuffer = Buffer.from(data)
  // Password method is stored at the beginning but not used in this implementation
  // We ignore the stored method as we're using SHA256 here
  dataBuffer.readInt32BE(PASSWORD_METHOD_OFFSET)

  // Extract 64-byte random code starting from offset 4
  const randomCode = dataBuffer.slice(PASSWORD_METHOD_SIZE, PASSWORD_METHOD_SIZE + RANDOM_CODE_SIZE).toString('ascii')

  // Extract 8-byte token after the random code
  const tokenOffset = PASSWORD_METHOD_SIZE + RANDOM_CODE_SIZE
  const token = dataBuffer.slice(tokenOffset, tokenOffset + TOKEN_SIZE).toString('ascii')

  // Extract server iteration count from the last 4 bytes
  const serverIteration = dataBuffer.readInt32BE(dataBuffer.length - ITERATION_SIZE)

  // Generate the hash using RFC5802 algorithm
  const hashResult = RFC5802Algorithm(password, randomCode, token, '', serverIteration, 'sha256')

  return Buffer.from(hashResult, 'hex').toString('ascii')
}

/**
 * Create a SHA-256 digest of the given data
 * @param {Buffer} data
 */
async function sha256(text) {
  return await subtleCrypto.digest('SHA-256', text)
}

async function hashByName(hashName, text) {
  return await subtleCrypto.digest(hashName, text)
}

/**
 * Sign the message with the given key
 * @param {ArrayBuffer} keyBuffer
 * @param {string} msg
 */
async function hmacSha256(keyBuffer, msg) {
  const key = await subtleCrypto.importKey('raw', keyBuffer, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return await subtleCrypto.sign('HMAC', key, textEncoder.encode(msg))
}

/**
 * Derive a key from the password and salt
 * @param {string} password
 * @param {Uint8Array} salt
 * @param {number} iterations
 */
async function deriveKey(password, salt, iterations) {
  const key = await subtleCrypto.importKey('raw', textEncoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  const params = { name: 'PBKDF2', hash: 'SHA-256', salt: salt, iterations: iterations }
  return await subtleCrypto.deriveBits(params, key, 32 * 8, ['deriveBits'])
}
