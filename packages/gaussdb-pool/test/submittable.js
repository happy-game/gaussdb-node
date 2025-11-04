'use strict'
const Cursor = require('gaussdb-cursor')
const expect = require('expect.js')
const describe = require('mocha').describe
const it = require('mocha').it

const Pool = require('../')

describe('submittable', () => {
  it('is returned from the query method', (done) => {
    const pool = new Pool()
    const cursor = new Cursor('SELECT * from generate_series(0, 1000)')
    pool.connect((err, client, release) => {
      expect(err).to.be(undefined)
      client.query(cursor)
      cursor.read(10, (err, rows) => {
        expect(err).to.be(null)
        expect(!!rows).to.be.ok()
        cursor.close(() => {
          release()
          pool.end(() => done())
        })
      })
    })
  })
})
