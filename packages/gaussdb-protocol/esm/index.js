// ESM wrapper for gaussdb-protocol
import * as protocol from '../dist/index.js'

// Re-export all the properties
export const DatabaseError = protocol.DatabaseError
export const SASL = protocol.SASL
export const serialize = protocol.serialize
export const parse = protocol.parse

// Re-export the default
export default protocol
