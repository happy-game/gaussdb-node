import gaussdb from 'gaussdb-node'

export default function (name, cb) {
  describe(name, function () {
    const client = new gaussdb.Client()

    before(function (done) {
      client.connect(done)
    })

    cb(client)

    after(function (done) {
      client.end()
      client.on('end', done)
    })
  })
}
