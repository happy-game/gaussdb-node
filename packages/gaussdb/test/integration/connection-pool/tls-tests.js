'use strict'

const fs = require('fs')

const helper = require('./test-helper')
const gaussdb = helper.gaussdb

const suite = new helper.Suite()

if (process.env.GAUSS_CLIENT_CERT_TEST) {
  suite.testAsync('client certificate', async () => {
    const pool = new gaussdb.Pool({
      ssl: {
        ca: fs.readFileSync(process.env.GAUSSSSLROOTCERT),
        cert: fs.readFileSync(process.env.GAUSSSSLCERT),
        key: fs.readFileSync(process.env.GAUSSSSLKEY),
      },
    })

    await pool.query('SELECT 1')
    await pool.end()
  })
}
