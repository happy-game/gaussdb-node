'use strict'
const helper = require('./test-helper')
const Query = helper.gaussdb.Query
const DatabaseError = helper.gaussdb.DatabaseError
const assert = require('assert')
const { Client } = helper
const suite = new helper.Suite()

suite.test('error during query execution', function () {
  const client = new Client(helper.args)
  client.connect(
    assert.success(function () {
      const queryText = 'select pg_sleep(10)'
      const sleepQuery = new Query(queryText)
      let pidColName = 'procpid'
      let queryColName = 'current_query'
      helper.versionGTE(
        client,
        90200,
        assert.success(function (isGreater) {
          if (isGreater) {
            pidColName = 'pid'
            queryColName = 'query'
          }
          const query1 = client.query(
            sleepQuery,
            assert.calls(function (err, result) {
              assert(err)
              client.end()
            })
          )
          //ensure query1 does not emit an 'end' event
          //because it was killed and received an error
          //https://github.com/brianc/node-postgres/issues/547
          query1.on('end', function () {
            assert.fail('Query with an error should not emit "end" event')
          })
          setTimeout(function () {
            const client2 = new Client(helper.args)
            client2.connect(
              assert.success(function () {
                const killIdleQuery = `SELECT ${pidColName}, (SELECT pg_cancel_backend(${pidColName})) AS killed FROM pg_stat_activity WHERE ${queryColName} LIKE $1`
                client2.query(
                  killIdleQuery,
                  [queryText],
                  assert.calls(function (err, res) {
                    assert.ifError(err)
                    assert(res.rows.length > 0)
                    client2.end()
                    assert.emits(client2, 'end')
                  })
                )
              })
            )
          }, 300)
        })
      )
    })
  )
})

suite.test('9.3 column error fields', function () {
  const client = new Client(helper.args)
  client.connect(
    assert.success(function () {
      helper.versionGTE(
        client,
        90300,
        assert.success(function (isGreater) {
          if (!isGreater) {
            return client.end()
          }

          client.query('CREATE TEMP TABLE column_err_test(a int NOT NULL)')
          client.query('INSERT INTO column_err_test(a) VALUES (NULL)', function (err) {
            assert(err instanceof DatabaseError)
            assert.equal(err.severity, 'ERROR')
            assert.equal(err.code, '23502')
            assert.equal(err.table, 'column_err_test')
            assert.equal(err.column, 'a')
            return client.end()
          })
        })
      )
    })
  )
})

suite.test('9.3 constraint error fields', function () {
  const client = new Client(helper.args)
  client.connect(
    assert.success(function () {
      helper.versionGTE(
        client,
        90300,
        assert.success(function (isGreater) {
          if (!isGreater) {
            console.log('skip 9.3 error field on older versions of postgres')
            return client.end()
          }

          client.query('CREATE TEMP TABLE constraint_err_test(a int PRIMARY KEY)')
          client.query('INSERT INTO constraint_err_test(a) VALUES (1)')
          client.query('INSERT INTO constraint_err_test(a) VALUES (1)', function (err) {
            assert(err instanceof DatabaseError)
            assert.equal(err.severity, 'ERROR')
            assert.equal(err.code, '23505')
            assert.equal(err.table, 'constraint_err_test')
            assert.equal(err.constraint, 'constraint_err_test_pkey')
            return client.end()
          })
        })
      )
    })
  )
})
