import { Client } from 'gaussdb-node'

const client = new Client()

function main() {
  client
    .connect()
    .then(() => {
      console.log('✓ 连接成功')
      return client.query('SELECT $1::text as message', ['Hello world!'])
    })
    .then((res) => {
      console.log(res.rows[0].message) // Hello world!
    })
    .catch((err) => {
      console.error('✗ 错误:', err.message)
    })
    .finally(() => {
      return client.end().then(() => {
        console.log('✓ 连接已关闭')
      })
    })
}

main()
