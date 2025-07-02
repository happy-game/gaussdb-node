import { Client } from 'gaussdb-node'

const client = new Client()

async function demonstrateParameterizedQueries() {
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

    // ✓ 安全的参数化查询
    const userId = 123
    const userName = "John O'Doe"

    const insertQuery = 'INSERT INTO users(id, name, email) VALUES($1, $2, $3) RETURNING *'
    const insertValues = [userId, userName, 'john@example.com']

    const insertResult = await client.query(insertQuery, insertValues)
    console.log('✓ 插入用户:', insertResult.rows[0])

    const selectQuery = 'SELECT * FROM users WHERE name = $1'
    const selectValues = [userName]

    const selectResult = await client.query(selectQuery, selectValues)
    console.log('✓ 查询结果:', selectResult.rows)
  } catch (err) {
    console.error('✗ 查询失败:', err.message)
  } finally {
    await client.end()
  }
}

demonstrateParameterizedQueries()
