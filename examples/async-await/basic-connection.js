import { Client } from 'gaussdb-node'

const client = new Client()

async function main() {
  try {
    await client.connect()
    console.log('✓ 连接成功')

    const res = await client.query('SELECT $1::text as message', ['Hello world!'])
    console.log(res.rows[0].message) // Hello world!
  } catch (err) {
    console.error('✗ 错误:', err.message)
  } finally {
    await client.end()
    console.log('✓ 连接已关闭')
  }
}

main()
