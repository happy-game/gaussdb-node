import { Client } from 'gaussdb-node'

const client = new Client()

function demonstrateParameterizedQueries() {
  client
    .connect()
    .then(() => {
      console.log('创建临时表用于演示...')
      // 创建临时表
      return client.query(`
        CREATE TEMP TABLE users (
          id INTEGER PRIMARY KEY,
          name VARCHAR(100),
          email VARCHAR(100),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `)
    })
    .then(() => {
      console.log('✓ 临时表创建成功')

      // ✓ 安全的参数化查询
      const userId = 123
      const userName = "John O'Doe"

      const insertQuery = 'INSERT INTO users(id, name, email) VALUES($1, $2, $3) RETURNING *'
      const insertValues = [userId, userName, 'john@example.com']

      return client.query(insertQuery, insertValues)
    })
    .then((insertResult) => {
      console.log('✓ 插入用户:', insertResult.rows[0])

      const userName = "John O'Doe"
      const selectQuery = 'SELECT * FROM users WHERE name = $1'
      const selectValues = [userName]

      return client.query(selectQuery, selectValues)
    })
    .then((selectResult) => {
      console.log('✓ 查询结果:', selectResult.rows)

      // ✗ 危险：不要这样做（SQL注入风险）
      // const badQuery = `SELECT * FROM users WHERE name = '${userName}'`
    })
    .catch((err) => {
      console.error('✗ 查询失败:', err.message)
    })
    .finally(() => {
      return client.end()
    })
}

demonstrateParameterizedQueries()
