import { Client } from 'gaussdb-node'

const client = new Client()

function demonstratePreparedStatements() {
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
      // 插入测试数据
      return client.query('INSERT INTO users (id, name, email) VALUES ($1, $2, $3)', [
        1,
        '张三',
        'zhangsan@example.com',
      ])
    })
    .then(() => {
      return client.query('INSERT INTO users (id, name, email) VALUES ($1, $2, $3)', [2, '李四', 'lisi@example.com'])
    })
    .then(() => {
      return client.query('INSERT INTO users (id, name, email) VALUES ($1, $2, $3)', [3, '王五', 'wangwu@example.com'])
    })
    .then(() => {
      console.log('✓ 插入了 3 条测试数据')

      // 预编译语句提高性能
      const queryConfig = {
        name: 'fetch-user',
        text: 'SELECT * FROM users WHERE id = $1',
        values: [1],
      }

      console.log('执行预编译语句...')
      return client.query(queryConfig)
    })
    .then((res) => {
      console.log('✓ 用户信息:', res.rows[0])

      // 再次使用相同的预编译语句
      const queryConfig = {
        name: 'fetch-user',
        text: 'SELECT * FROM users WHERE id = $1',
        values: [2],
      }
      return client.query(queryConfig)
    })
    .then((res2) => {
      console.log('✓ 另一个用户:', res2.rows[0])
    })
    .catch((err) => {
      console.error('✗ 查询失败:', err.message)
    })
    .finally(() => {
      return client.end()
    })
}

demonstratePreparedStatements()
