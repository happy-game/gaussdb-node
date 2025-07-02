import { Client } from 'gaussdb-node'

const client = new Client()

async function demonstrateErrorHandling() {
  try {
    await client.connect()

    // 执行查询
    const res = await client.query('SELECT $1::text as message', ['Hello world!'])
    console.log(res.rows[0].message)
  } catch (err) {
    // 处理连接或查询错误
    if (err.code === 'ECONNREFUSED') {
      console.error('✗ 无法连接到数据库服务器')
    } else if (err.code === '42P01') {
      console.error('✗ 表不存在')
    } else if (err.code === '28P01') {
      console.error('✗ 认证失败')
    } else {
      console.error('✗ 数据库错误:', err.message)
    }
  } finally {
    // 确保连接被正确关闭
    await client.end()
    console.log('✓ 连接已关闭')
  }
}

demonstrateErrorHandling()
