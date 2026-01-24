'use strict'

/**
 * HostStatusTracker - Global singleton to track host connection states
 */

/**
 * Host status enumeration
 */
const HostStatus = {
  CONNECT_OK: 'CONNECT_OK',       // Host is reachable
  CONNECT_FAIL: 'CONNECT_FAIL',   // Host connection failed
  MASTER: 'MASTER',               // Host is a primary server
  SLAVE: 'SLAVE'                  // Host is a standby server
}

/**
 * HostStatusEntry - Stores host status with timestamp
 */
class HostStatusEntry {
  /**
   * Constructor
   * @param {string} status - Host status (from HostStatus enum)
   * @param {number} timestamp - Timestamp when status was recorded (milliseconds)
   */
  constructor(status, timestamp) {
    this.status = status
    this.timestamp = timestamp
  }

  /**
   * Check if this status entry has expired
   * @param {number} currentTime - Current timestamp in milliseconds
   * @param {number} recheckMillis - Recheck interval in milliseconds
   * @returns {boolean} True if expired
   */
  isExpired(currentTime, recheckMillis) {
    return (currentTime - this.timestamp) >= recheckMillis
  }
}

/**
 * HostStatusTracker - Singleton class for tracking host connection states
 */
class HostStatusTracker {
  constructor() {
    if (HostStatusTracker.instance) {
      return HostStatusTracker.instance
    }

    // Map: hostKey (host:port) -> HostStatusEntry
    this.statusMap = new Map()

    HostStatusTracker.instance = this
  }

  /**
   * Generate a unique key for a HostSpec
   * @param {Object} hostSpec - HostSpec object {host, port}
   * @returns {string} Unique key in format "host:port"
   * @private
   */
  _getHostKey(hostSpec) {
    return `${hostSpec.host}:${hostSpec.port}`
  }

  /**
   * Update host status
   * @param {Object} hostSpec - HostSpec object {host, port}
   * @param {string} status - Host status (from HostStatus enum)
   */
  updateHostStatus(hostSpec, status) {
    if (!hostSpec) {
      return
    }

    const hostKey = this._getHostKey(hostSpec)
    const timestamp = Date.now()
    const entry = new HostStatusEntry(status, timestamp)

    this.statusMap.set(hostKey, entry)
  }

  /**
   * Get host status
   * @param {Object} hostSpec - HostSpec object {host, port}
   * @returns {HostStatusEntry|null} Status entry or null if not found
   */
  getHostStatus(hostSpec) {
    if (!hostSpec) {
      return null
    }

    const hostKey = this._getHostKey(hostSpec)
    return this.statusMap.get(hostKey) || null
  }

  /**
   * Clear all host status (for testing purposes)
   */
  clear() {
    this.statusMap.clear()
  }
}

const instance = new HostStatusTracker()

module.exports = instance
module.exports.HostStatus = HostStatus
module.exports.HostStatusTracker = HostStatusTracker
