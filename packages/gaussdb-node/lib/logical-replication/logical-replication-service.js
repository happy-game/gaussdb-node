/*
 * Copyright (c) 2025 happy-game
 *
 * This source code is derived from and/or based on:
 * pg-logical-replication - Copyright (c) 2025 Kibae Shin
 *
 * Licensed under the MIT License.
 */
'use strict'
const EventEmitter = require('events').EventEmitter
const Client = require('../client')
const { BufferReader } = require('gaussdb-protocol')
const POSTGRES_EPOCH_MS = 946684800000
const MAX_UINT64 = { hi: 0x7fffffff, lo: 0xffffffff }

class LogicalReplicationService extends EventEmitter {
  constructor(clientConfig, config) {
    super()
    this._lastLsn = null
    this._lastReceive = null
    this._lastFlushed = null
    this._lastApplied = null
    this._client = null
    this._connection = null
    this._stop = true
    // Flow control (backpressure) queue
    this._messageQueue = []
    this._processing = false
    this._lastStandbyStatusUpdatedTime = 0
    this._checkStandbyStatusTimer = null
    this.clientConfig = clientConfig
    this.config = {
      acknowledge: Object.assign(
        {
          // If the value is false, acknowledge must be done manually. Default: true
          auto: true,
          // Acknowledge is performed every set time (sec). If 0, do not do it. Default: 10
          timeoutSeconds: 10,
        },
        (config && config.acknowledge) || {}
      ),
      // Flow control (backpressure) configuration.
      // When enabled, the stream will be paused until the data handler completes,
      // preventing memory overflow when processing is slower than the incoming message rate.
      flowControl: Object.assign(
        {
          // If true, pause the stream until the data handler completes. Default: false
          enabled: false,
        },
        (config && config.flowControl) || {}
      ),
    }
  }

  lastLsn() {
    return this._lastLsn || '0/00000000'
  }

  async stop() {
    this._stop = true
    // Clear flow control queue
    this._messageQueue = []
    this._processing = false
    if (this._connection) {
      this._connection.removeAllListeners()
      this._connection = null
    }
    if (this._client) {
      this._client.removeAllListeners()
      await this._client.end()
      this._client = null
    }
    this._checkStandbyStatus(false)
    return this
  }

  /**
   * @param plugin One of [MppdbDecodingPlugin, ]
   * @param slotName
   * @param uptoLsn
   */
  async subscribe(plugin, slotName, uptoLsn) {
    try {
      const [client, connection] = await this._createClient()
      this._lastLsn = uptoLsn || this._lastLsn

      // check replicationStart
      connection.once('replicationStart', () => {
        this._stop = false
        this.emit('start')
        this._checkStandbyStatus(true)
      })

      connection.on('copyData', (msg) => {
        const buffer = msg && msg.chunk ? msg.chunk : msg
        if (!buffer || buffer.length === 0) return
        this._handleCopyData(plugin, buffer)
      })
      return plugin.start(client, slotName, this._lastLsn || '0/00000000')
    } catch (e) {
      await this.stop()
      this.emit('error', e)
      throw e
    }
  }

  /**
   * OpenGauss uses a 65-byte little-endian Standby Status Update packet,
   * different from PostgreSQL's 34-byte big-endian format.
   * @param lsn
   * @param ping Request server to respond
   */
  async acknowledge(lsn, ping) {
    if (this._stop || !this._connection) return false
    const received = lsn ? parseLsn(lsn) : this._lastReceive || { hi: 0, lo: 0 }
    const flushed = this._lastFlushed || received
    const applied = this._lastApplied || received
    this._lastStandbyStatusUpdatedTime = Date.now()

    // Timestamp as microseconds since midnight 2000-01-01
    const nowMicros = (Date.now() - POSTGRES_EPOCH_MS) * 1000
    const timeHi = Math.floor(nowMicros / 0x100000000)
    const timeLo = Math.floor(nowMicros - timeHi * 0x100000000)

    const response = Buffer.alloc(65)
    let offset = 0
    response[offset++] = 0x72 // 'r'
    offset = writeUInt64LE(response, offset, MAX_UINT64) // sendTime (unused, set to max)
    offset = writeUInt64LE(response, offset, received) // Last WAL received
    offset = writeUInt64LE(response, offset, flushed) // Last WAL flushed to disk
    offset = writeUInt64LE(response, offset, MAX_UINT64) // flushTime (unused, set to max)
    offset = writeUInt64LE(response, offset, applied) // Last WAL applied
    response.writeUInt32LE(0xffffffff, offset) // applyTime lo (unused)
    offset += 4
    response.writeUInt32LE(0xffffffff, offset) // applyTime hi (unused)
    offset += 4
    offset = writeUInt64LE(response, offset, { hi: timeHi >>> 0, lo: timeLo >>> 0 }) // client timestamp
    // If 1, requests server to respond immediately - can be used to verify connectivity
    response[offset++] = ping ? 1 : received.hi === 0 && received.lo === 0 ? 1 : 0
    response.writeUInt32LE(0, offset) // xlogFlushLocation (unused)
    offset += 4
    response[offset++] = 1 // peer_role
    response[offset++] = 1 // peer_state
    response[offset++] = 1 // sender_sent_location flag
    this._connection.sendCopyFromChunk(response)
    return true
  }

  setFlushedLsn(lsn) {
    this._lastFlushed = parseLsn(lsn)
  }

  setAppliedLsn(lsn) {
    this._lastApplied = parseLsn(lsn)
  }

  async _createClient() {
    await this.stop()
    this._client = new Client(Object.assign({}, this.clientConfig, { replication: 'database' }))
    await this._client.connect()
    this._connection = this._client.connection
    this._client.on('error', (e) => this.emit('error', e))
    return [this._client, this._connection]
  }

  _handleCopyData(plugin, buffer) {
    const tag = buffer[0]
    if (tag !== 0x77 && tag !== 0x6b) {
      return
    }
    if (tag === 0x77) {
      // XLogData: OpenGauss uses big-endian LSN in header (same as PostgreSQL)
      const reader = new BufferReader(1, 'be')
      reader.setBuffer(1, buffer)
      const start = reader.uint64Parts()
      const lsn = formatLsn(start.hi, start.lo)
      this._updateLastReceive(start)
      const parsed = plugin.parse(buffer.slice(25))
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          const itemLsn = item && item.lsn ? item.lsn : lsn
          this._enqueue(itemLsn, item)
        }
      } else {
        this._enqueue(lsn, parsed)
      }
    }
    if (tag === 0x6b) {
      // Primary keepalive message: OpenGauss uses little-endian and includes extra server mode/state fields
      const reader = new BufferReader(1, 'le')
      reader.setBuffer(1, buffer)
      const server = reader.uint64Parts()
      if (!this._lastReceive || compareLsn(server, this._lastReceive) > 0) {
        this._updateLastReceive(server)
      }
      reader.setBuffer(17, buffer)
      const serverClock = reader.uint64Parts()
      const timestamp = serverClockToTimestamp(serverClock)
      const shouldRespond = buffer[25] === 1
      this.emit('heartbeat', formatLsn(server.hi, server.lo), timestamp, shouldRespond)
      if (shouldRespond) {
        this.acknowledge(this._lastLsn, true)
      }
    }
  }

  async _acknowledge(lsn) {
    if (!this.config.acknowledge.auto) return
    this.emit('acknowledge', lsn)
    await this.acknowledge(lsn)
  }

  _enqueue(lsn, data) {
    this._lastLsn = lsn
    this._updateLastReceive(parseLsn(lsn))
    if (!this.config.flowControl.enabled) {
      this.emit('data', lsn, data)
      this._acknowledge(lsn)
      return
    }
    this._messageQueue.push({ lsn, data })
    this._processQueue()
  }

  /**
   * Process messages in the queue sequentially with backpressure support.
   * Pauses the stream while processing and resumes when the queue is empty.
   */
  _processQueue() {
    if (this._processing || this._stop) return
    this._processing = true

    // Pause the stream to prevent buffer overflow
    if (this._connection && this._connection.stream && this._connection.stream.pause) {
      this._connection.stream.pause()
    }

    const processNext = async () => {
      while (this._messageQueue.length > 0 && !this._stop) {
        const message = this._messageQueue.shift()
        try {
          // Wait for all listeners to complete (supports async handlers)
          await this._emitAsync('data', message.lsn, message.data)
          await this._acknowledge(message.lsn)
        } catch (e) {
          this.emit('error', e)
        }
      }
      this._processing = false

      // Resume the stream when queue is empty
      if (!this._stop && this._connection && this._connection.stream && this._connection.stream.resume) {
        this._connection.stream.resume()
      }
    }
    processNext()
  }

  async _emitAsync(event, ...args) {
    const listeners = this.listeners(event)
    for (const listener of listeners) {
      await listener(...args)
    }
  }

  _checkStandbyStatus(enable) {
    if (this._checkStandbyStatusTimer) {
      clearInterval(this._checkStandbyStatusTimer)
      this._checkStandbyStatusTimer = null
    }
    if (this.config.acknowledge.timeoutSeconds > 0 && enable) {
      this._checkStandbyStatusTimer = setInterval(async () => {
        if (this._stop) return
        if (
          this._lastLsn &&
          Date.now() - this._lastStandbyStatusUpdatedTime > this.config.acknowledge.timeoutSeconds * 1000
        ) {
          await this.acknowledge(this._lastLsn)
        }
      }, 1000)
    }
  }

  _updateLastReceive(parts) {
    this._lastReceive = { hi: parts.hi >>> 0, lo: parts.lo >>> 0 }
    this._lastLsn = formatLsn(this._lastReceive.hi, this._lastReceive.lo)
  }
}

function writeUInt64LE(buffer, offset, parts) {
  buffer.writeUInt32LE(parts.lo >>> 0, offset)
  buffer.writeUInt32LE(parts.hi >>> 0, offset + 4)
  return offset + 8
}

function parseLsn(lsn) {
  if (!lsn) return { hi: 0, lo: 0 }
  const parts = String(lsn).split('/')
  if (parts.length !== 2) return { hi: 0, lo: 0 }
  const hi = parseInt(parts[0], 16)
  const lo = parseInt(parts[1], 16)
  return { hi: hi >>> 0, lo: lo >>> 0 }
}

function pad8(value) {
  const hex = (value >>> 0).toString(16).toUpperCase()
  return ('00000000' + hex).slice(-8)
}

function formatLsn(hi, lo) {
  return `${pad8(hi)}/${pad8(lo)}`
}

function compareLsn(a, b) {
  if (a.hi !== b.hi) return a.hi > b.hi ? 1 : -1
  if (a.lo === b.lo) return 0
  return a.lo > b.lo ? 1 : -1
}

function serverClockToTimestamp(parts) {
  const micros = uint64ToNumberOrString(parts)
  if (typeof micros !== 'number') return null
  return Math.floor(micros / 1000) + POSTGRES_EPOCH_MS
}

function uint64ToNumberOrString(parts) {
  const hi = parts.hi >>> 0
  const lo = parts.lo >>> 0
  if (hi <= 0x1fffff) {
    return hi * 0x100000000 + lo
  }
  return `0x${pad8(hi)}${pad8(lo)}`
}

module.exports = LogicalReplicationService
