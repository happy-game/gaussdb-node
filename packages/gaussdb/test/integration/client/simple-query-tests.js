'use strict'
const helper = require('./test-helper')
const Query = helper.gaussdb.Query
const assert = require('assert')
const suite = new helper.Suite()
const test = suite.test.bind(suite)

// before running this test make sure you run the script create-test-tables
test('simple query interface', function () {
  const client = helper.client()

  const query = client.query(new Query('select name from person order by name collate "C"'))

  client.on('drain', client.end.bind(client))

  const rows = []
  query.on('row', function (row, result) {
    assert.ok(result)
    rows.push(row['name'])
  })
  query.once('row', function (row) {
    test('Can iterate through columns', function () {
      const columnCount = Object.keys(row).length
      if ('length' in row) {
        assert.lengthIs(
          row,
          columnCount,
          'Iterating through the columns gives a different length from calling .length.'
        )
      }
    })
  })

  assert.emits(query, 'end', function () {
    test('returned right number of rows', function () {
      assert.lengthIs(rows, 26)
    })
    test('row ordering', function () {
      assert.equal(rows[0], 'Aaron')
      assert.equal(rows[25], 'Zanzabar')
    })
  })
})

test('prepared statements do not mutate params', function () {
  const client = helper.client()

  const params = [1]

  const query = client.query(new Query('select name from person where $1 = 1 order by name collate "C"', params))

  assert.deepEqual(params, [1])

  client.on('drain', client.end.bind(client))

  const rows = []
  query.on('row', function (row, result) {
    assert.ok(result)
    rows.push(row)
  })

  query.on('end', function (result) {
    assert.lengthIs(rows, 26, 'result returned wrong number of rows')
    assert.lengthIs(rows, result.rowCount)
    assert.equal(rows[0].name, 'Aaron')
    assert.equal(rows[25].name, 'Zanzabar')
  })
})

// SKIP: 不支持 临时表Serial
// https://github.com/HuaweiCloudDeveloper/gaussdb-drivers/blob/master-dev/diff-gaussdb-postgres.md#%E4%B8%8D%E6%94%AF%E6%8C%81-%E4%B8%B4%E6%97%B6%E8%A1%A8serial

/*
test('multiple simple queries', function () {
  const client = helper.client()
  client.query({ text: "create temp table bang(id serial, name varchar(5));insert into bang(name) VALUES('boom');" })
  client.query("insert into bang(name) VALUES ('yes');")
  const query = client.query(new Query('select name from bang'))
  assert.emits(query, 'row', function (row) {
    assert.equal(row['name'], 'boom')
    assert.emits(query, 'row', function (row) {
      assert.equal(row['name'], 'yes')
    })
  })
  client.on('drain', client.end.bind(client))
})
*/

test('multiple select statements', function () {
  const client = helper.client()
  client.query(
    'create temp table boom(age integer); insert into boom(age) values(1); insert into boom(age) values(2); insert into boom(age) values(3)'
  )
  client.query({ text: "create temp table bang(name varchar(5)); insert into bang(name) values('zoom');" })
  const result = client.query(new Query({ text: 'select age from boom where age < 2; select name from bang' }))
  assert.emits(result, 'row', function (row) {
    assert.strictEqual(row['age'], 1)
    assert.emits(result, 'row', function (row) {
      assert.strictEqual(row['name'], 'zoom')
    })
  })
  client.on('drain', client.end.bind(client))
})
