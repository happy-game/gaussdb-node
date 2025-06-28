const assert = require('assert')
const Cursor = require('../')
const gaussdb = require('gaussdb-node')

const text = 'SELECT generate_series as num FROM generate_series(0, 5)'

describe('cursor using promises', function () {
  beforeEach(function (done) {
    const client = (this.client = new gaussdb.Client())
    client.connect(done)

    this.gaussdbCursor = function (text, values) {
      return client.query(new Cursor(text, values || []))
    }
  })

  afterEach(function () {
    this.client.end()
  })

  it('resolve with result', async function () {
    const cursor = this.gaussdbCursor(text)
    const res = await cursor.read(6)
    assert.strictEqual(res.length, 6)
  })

  it('reject with error', function (done) {
    const cursor = this.gaussdbCursor('select asdfasdf')
    cursor.read(1).catch((err) => {
      assert(err)
      done()
    })
  })

  it('read multiple times', async function () {
    const cursor = this.gaussdbCursor(text)
    let res

    res = await cursor.read(2)
    assert.strictEqual(res.length, 2)

    res = await cursor.read(3)
    assert.strictEqual(res.length, 3)

    res = await cursor.read(1)
    assert.strictEqual(res.length, 1)

    res = await cursor.read(1)
    assert.strictEqual(res.length, 0)
  })
})
