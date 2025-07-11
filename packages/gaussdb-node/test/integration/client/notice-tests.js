'use strict'
const helper = require('./test-helper')
const assert = require('assert')
const suite = new helper.Suite()

// SKIP: 不支持 LISTEN/NOFITY statement
// https://github.com/HuaweiCloudDeveloper/gaussdb-drivers/blob/master-dev/diff-gaussdb-postgres.md#%E4%B8%8D%E6%94%AF%E6%8C%81-listennofity-statement

/*
suite.test('emits notify message', function (done) {
  const client = helper.client()
  client.query(
    'LISTEN boom',
    assert.calls(function () {
      const otherClient = helper.client()
      let bothEmitted = -1
      otherClient.query(
        'LISTEN boom',
        assert.calls(function () {
          assert.emits(client, 'notification', function (msg) {
            // make sure PQfreemem doesn't invalidate string pointers
            setTimeout(function () {
              assert.equal(msg.channel, 'boom')
              assert.ok(
                // 9.x and 8.x have different payloads
                msg.payload == 'omg!'  || msg.payload == '' ,
                'expected blank payload or correct payload but got ' + msg.message
              )
              client.end(++bothEmitted ? done : undefined)
            }, 100)
          })
          assert.emits(otherClient, 'notification', function (msg) {
            assert.equal(msg.channel, 'boom')
            otherClient.end(++bothEmitted ? done : undefined)
          })

          client.query("NOTIFY boom, 'omg!'", function (err, q) {
            if (err) {
              // notify not supported with payload on 8.x
              client.query('NOTIFY boom')
            }
          })
        })
      )
    })
  )
})
*/

// this test fails on travis due to their config
suite.test('emits notice message', function (done) {
  // Native bindings are no longer supported, always test
  const client = helper.client()
  const text = `
DO language plpgsql $$
BEGIN
  RAISE NOTICE 'hello, world!' USING ERRCODE = '23505', DETAIL = 'this is a test';
END
$$;
  `
  client.query('SET SESSION client_min_messages=notice', (err) => {
    assert.ifError(err)
    client.query(text, () => {
      client.end()
    })
  })
  assert.emits(client, 'notice', function (notice) {
    assert.ok(notice != null)
    // notice messages should not be error instances
    assert(notice instanceof Error === false)
    assert.strictEqual(notice.name, 'notice')
    assert.strictEqual(notice.message, 'hello, world!')
    assert.strictEqual(notice.detail, 'this is a test')
    assert.strictEqual(notice.code, '23505')
    done()
  })
})
