'use strict'
const helper = require('./test-helper')
const gaussdb = helper.gaussdb
const assert = require('assert')

const suite = new helper.Suite()
suite.test('connecting to invalid port', (cb) => {
  const pool = new gaussdb.Pool({ port: 13801 })
  pool.connect().catch((e) => cb())
})

suite.test('errors emitted on checked-out clients', (cb) => {
  // make pool hold 2 clients
  const pool = new gaussdb.Pool({ max: 2 })
  // get first client
  pool.connect(
    assert.success(function (client, done) {
      client.query('SELECT NOW()', function () {
        pool.connect(
          assert.success(function (client2, done2) {
            helper.versionGTE(
              client2,
              90200,
              assert.success(function (isGreater) {
                let killIdleQuery =
                  'SELECT pid, (SELECT pg_terminate_backend(pid)) AS killed FROM pg_stat_activity WHERE state = $1'
                let params = ['idle']
                if (!isGreater) {
                  killIdleQuery =
                    'SELECT procpid, (SELECT pg_terminate_backend(procpid)) AS killed FROM pg_stat_activity WHERE current_query LIKE $1'
                  params = ['%IDLE%']
                }

                client.once('error', (err) => {
                  client.on('error', (err) => {})
                  done(err)
                  cb()
                })

                // kill the connection from client
                client2.query(
                  killIdleQuery,
                  params,
                  assert.success(function (res) {
                    // check to make sure client connection actually was killed
                    // return client2 to the pool
                    done2()
                    pool.end()
                  })
                )
              })
            )
          })
        )
      })
    })
  )
})

suite.test('connection-level errors cause queued queries to fail', (cb) => {
  const pool = new gaussdb.Pool()
  pool.connect(
    assert.success((client, done) => {
      client.query(
        'SELECT pg_terminate_backend(pg_backend_pid())',
        assert.calls((err) => {
          assert.equal(err.code, '57P01')
        })
      )

      client.once(
        'error',
        assert.calls((err) => {
          client.on('error', (err) => {})
        })
      )

      client.query(
        'SELECT 1',
        assert.calls((err) => {
          assert.equal(err.message, 'Connection terminated unexpectedly')

          done(err)
          pool.end()
          cb()
        })
      )
    })
  )
})

suite.test('connection-level errors cause future queries to fail', (cb) => {
  const pool = new gaussdb.Pool()
  pool.connect(
    assert.success((client, done) => {
      client.query(
        'SELECT pg_terminate_backend(pg_backend_pid())',
        assert.calls((err) => {
          assert.equal(err.code, '57P01')
        })
      )

      client.once(
        'error',
        assert.calls((err) => {
          client.on('error', (err) => {})
          client.query(
            'SELECT 1',
            assert.calls((err) => {
              assert.equal(err.message, 'Client has encountered a connection error and is not queryable')

              done(err)
              pool.end()
              cb()
            })
          )
        })
      )
    })
  )
})

suite.test('handles socket error during pool.query and destroys it immediately', (cb) => {
  const pool = new gaussdb.Pool({ max: 1 })

  pool.query('SELECT pg_sleep(10)', [], (err) => {
    assert.equal(err.message, 'network issue')
    assert.equal(stream.destroyed, true)
    cb()
  })

  const stream = pool._clients[0].connection.stream
  setTimeout(() => {
    stream.emit('error', new Error('network issue'))
  }, 100)
})
