/*
 * Copyright (c) 2025 happy-game
 *
 * This source code is derived from and/or based on:
 * pg-logical-replication - Copyright (c) 2025 Kibae Shin
 *
 * Licensed under the MIT License.
 */
'use strict'

const { BufferReader } = require('gaussdb-protocol')

const SLOT_OPTION_KEYS = [
  'includeXids',
  'skipEmptyXacts',
  'includeTimestamp',
  'onlyLocal',
  'forceBinary',
  'whiteTableList',
  'parallelDecodeNum',
  'decodeStyle',
  'sendingBatch',
  'standbyConnection',
  'parallelQueueSize',
  'maxTxnInMemory',
  'maxReorderbufferInMemory',
  'senderTimeout',
]

const STRING_OPTION_KEYS = ['whiteTableList', 'decodeStyle']

/**
 * Plugin for parsing mppdb_decoding logical replication output from OpenGauss/GaussDB.
 * Supports text ('t'), JSON ('j'), and binary ('b') decode styles.
 */
class MppdbDecodingPlugin {
  constructor(options) {
    this.options = options || {}
  }

  get name() {
    return 'mppdb_decoding'
  }

  /**
   * @param client GaussDB client connection
   * @param slotName Replication slot name
   * @param lastLsn LSN to start replication from
   */
  async start(client, slotName, lastLsn) {
    const options = this._buildSlotOptions()
    let sql = `START_REPLICATION SLOT "${slotName}" LOGICAL ${lastLsn}`
    if (options.length > 0) {
      sql += ` (${options.join(' , ')})`
    }
    return client.query({ text: sql, queryMode: 'simple' })
  }

  parse(buffer) {
    const decodeStyle = this._decodeStyle()
    if (decodeStyle === 'b') {
      return this._parseBinary(buffer)
    }
    return this._parseText(buffer, decodeStyle)
  }

  _decodeStyle() {
    const slotOptions = this.options.slotOptions || {}
    return this.options.decodeStyle || this.options['decode-style'] || slotOptions['decode-style'] || 't'
  }

  _sendingBatch() {
    const slotOptions = this.options.slotOptions || {}
    const value = this.options.sendingBatch || this.options['sending-batch'] || slotOptions['sending-batch']
    if (value === undefined) return false
    if (typeof value === 'string') return value === '1' || value.toLowerCase() === 'true'
    return Boolean(value)
  }

  _payloadEndian() {
    const value = this.options.payloadEndian || this.options['payload-endian']
    return value === 'le' ? 'le' : 'be'
  }

  _buildSlotOptions() {
    const slotOptions = Object.assign({}, this.options.slotOptions || {})
    for (const key of SLOT_OPTION_KEYS) {
      if (this.options[key] !== undefined) {
        slotOptions[dashCase(key)] = this.options[key]
      }
    }

    const options = []
    for (const [key, value] of Object.entries(slotOptions)) {
      const strValue = formatSlotValue(key, value)
      options.push(`"${key}" '${escapeLiteral(strValue)}'`)
    }
    return options
  }

  // Batch format: uint32 len, uint64 lsn, payload bytes (len), repeat until len=0.
  _parseText(buffer, decodeStyle) {
    if (!this._sendingBatch()) {
      const text = buffer.toString('utf8')
      if (decodeStyle === 'j') {
        return tryParseJson(text)
      }
      return text
    }

    const reader = new BufferReader(0, this._payloadEndian())
    reader.setBuffer(0, buffer)
    const items = []
    while (reader.remaining() >= 4) {
      const len = reader.uint32()
      if (len === 0) break
      const lsnParts = reader.uint64Parts()
      const payload = reader.bytes(len).toString('utf8')
      const data = decodeStyle === 'j' ? tryParseJson(payload) : payload
      items.push({ lsn: formatLsn(lsnParts.hi, lsnParts.lo), payload: data })
    }
    return items
  }

  // Binary record tags: B=BEGIN, C=COMMIT, I=INSERT, U=UPDATE, D=DELETE
  _parseBinary(buffer) {
    const reader = new BufferReader(0, this._payloadEndian())
    reader.setBuffer(0, buffer)
    const items = []

    while (reader.remaining() >= 4) {
      const len = reader.uint32()
      if (len === 0) break

      const lsnParts = reader.uint64Parts()
      const recordBuf = reader.bytes(len)
      // Length excludes the statement separator (P/F), which follows the record.
      const separator = reader.remaining() > 0 ? reader.byte() : null

      const record = parseBinaryRecord(recordBuf, this._payloadEndian())
      items.push({
        lsn: formatLsn(lsnParts.hi, lsnParts.lo),
        batchEnd: separator === 0x46,
        record,
      })
    }

    return items
  }
}

function parseBinaryRecord(buffer, endian) {
  const reader = new BufferReader(0, endian)
  reader.setBuffer(0, buffer)
  const tagByte = reader.byte()
  const tag = String.fromCharCode(tagByte)

  switch (tag) {
    case 'B':
      return parseBegin(reader)
    case 'C':
      return parseCommit(reader)
    case 'I':
      return parseDml(reader, 'insert')
    case 'U':
      return parseDml(reader, 'update')
    case 'D':
      return parseDml(reader, 'delete')
    default:
      throw new Error(`unknown mppdb_decoding tag: ${tag}`)
  }
}

function parseBegin(reader) {
  const csn = uint64ToNumberOrString(reader.uint64Parts())
  const firstLsnParts = reader.uint64Parts()
  const info = {
    tag: 'begin',
    csn,
    firstLsn: formatLsn(firstLsnParts.hi, firstLsnParts.lo),
  }
  return Object.assign(info, parseOptionalTxnFields(reader))
}

function parseCommit(reader) {
  const info = { tag: 'commit' }
  return Object.assign(info, parseOptionalTxnFields(reader))
}

// Optional fields: 0x58='X' for xid, 0x54='T' for timestamp
function parseOptionalTxnFields(reader) {
  const info = {}
  while (reader.remaining() > 0) {
    const next = reader.peekByte()
    if (next === 0x58) {
      // 'X' for xid
      reader.byte()
      info.xid = uint64ToNumberOrString(reader.uint64Parts())
      continue
    }
    if (next === 0x54) {
      // 'T' for timestamp
      reader.byte()
      const tsLen = reader.uint32()
      info.timestamp = reader.string(tsLen)
      continue
    }
    break
  }
  return info
}

// Tuple types: 0x4e='N' for new, 0x4f='O' for old
function parseDml(reader, tag) {
  const schemaLen = reader.uint16()
  const schema = reader.string(schemaLen)
  const tableLen = reader.uint16()
  const table = reader.string(tableLen)

  const tuples = []
  while (reader.remaining() > 0) {
    const tupleType = reader.byte()
    if (tupleType !== 0x4e && tupleType !== 0x4f) {
      throw new Error(`unknown tuple tag: ${String.fromCharCode(tupleType)}`)
    }
    const tuple = {
      kind: tupleType === 0x4e ? 'new' : 'old',
      columns: [],
    }

    const attrCount = reader.uint16()
    for (let i = 0; i < attrCount; i += 1) {
      const nameLen = reader.uint16()
      const name = reader.string(nameLen)
      const typeOid = reader.uint32()
      const valueLen = reader.uint32()
      let value = null
      // 0xFFFFFFFF indicates NULL, 0 indicates empty string.
      if (valueLen !== 0xffffffff) {
        value = reader.string(valueLen)
      }
      tuple.columns.push({ name, typeOid, value })
    }

    tuples.push(tuple)
  }

  return { tag, schema, table, tuples }
}

function tryParseJson(text) {
  try {
    return JSON.parse(text)
  } catch (e) {
    return text
  }
}

function formatSlotValue(key, value) {
  if (typeof value === 'boolean') {
    return value ? '1' : '0'
  }
  if (STRING_OPTION_KEYS.includes(key)) {
    return value == null ? '' : String(value)
  }
  return value == null ? '' : String(value)
}

function escapeLiteral(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

function dashCase(str) {
  return (str || '').replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())
}

function pad8(value) {
  const hex = (value >>> 0).toString(16).toUpperCase()
  return ('00000000' + hex).slice(-8)
}

function formatLsn(hi, lo) {
  return `${pad8(hi)}/${pad8(lo)}`
}

function uint64ToNumberOrString(parts) {
  const hi = parts.hi >>> 0
  const lo = parts.lo >>> 0
  if (hi <= 0x1fffff) {
    return hi * 0x100000000 + lo
  }
  return `0x${pad8(hi)}${pad8(lo)}`
}

module.exports = MppdbDecodingPlugin
