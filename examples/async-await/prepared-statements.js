import { Client } from 'gaussdb-node'

const client = new Client()

async function demonstratePreparedStatements() {
  try {
    await client.connect()
    console.log('创建临时表用于演示...')

    // 创建临时表
    await client.query(`
      CREATE TEMP TABLE users (
        id INTEGER PRIMARY KEY,
        name VARCHAR(100),
        email VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log('✓ 临时表创建成功')

    // 插入测试数据
    await client.query('INSERT INTO users (id, name, email) VALUES ($1, $2, $3)', [1, '张三', 'zhangsan@example.com'])
    await client.query('INSERT INTO users (id, name, email) VALUES ($1, $2, $3)', [2, '李四', 'lisi@example.com'])
    await client.query('INSERT INTO users (id, name, email) VALUES ($1, $2, $3)', [3, '王五', 'wangwu@example.com'])
    console.log('✓ 插入了 3 条测试数据')

    const queryConfig = {
      name: 'fetch-user',
      text: 'SELECT * FROM users WHERE id = $1',
      values: [1],
    }

    console.log('执行预编译语句...')
    const res = await client.query(queryConfig)
    console.log('✓ 用户信息:', res.rows[0])

    queryConfig.values = [2]
    const res2 = await client.query(queryConfig)
    console.log('✓ 另一个用户:', res2.rows[0])
  } catch (err) {
    console.error('✗ 查询失败:', err.message)
  } finally {
    await client.end()
  }
}

demonstratePreparedStatements()
