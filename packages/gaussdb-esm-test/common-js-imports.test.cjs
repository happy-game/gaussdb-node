const assert = require('node:assert')
const test = require('node:test')
const { describe, it } = test

const paths = [
  'gaussdb-node',
  'gaussdb-node/lib/index.js',
  'gaussdb-node/lib/connection-parameters.js',
  'gaussdb-protocol/dist/messages.js',
]
for (const path of paths) {
  describe(`importing ${path}`, () => {
    it('works with require', () => {
      const mod = require(path)
      assert(mod)
    })
  })
}

