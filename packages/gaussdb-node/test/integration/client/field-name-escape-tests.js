const gaussdb = require('./test-helper').gaussdb

const sql = 'SELECT 1 AS "\\\'/*", 2 AS "\\\'*/\n + process.exit(-1)] = null;\n//"'

const client = new gaussdb.Client()
client.connect()
client.query(sql, function (err, res) {
  if (err) throw err
  client.end()
})
