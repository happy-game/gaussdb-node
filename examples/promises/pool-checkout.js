import { Pool } from 'gaussdb-node'

const pool = new Pool()

function demonstratePoolCheckout() {
  pool
    .connect()
    .then((client) => {
      console.log('✓ 获取到连接')
      console.log('创建临时表用于演示...')

      // 创建临时表
      return client
        .query(
          `
          CREATE TEMP TABLE users (
            id INTEGER PRIMARY KEY,
            name VARCHAR(100),
            email VARCHAR(100),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `
        )
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
          return client.query('INSERT INTO users (id, name, email) VALUES ($1, $2, $3)', [
            2,
            '李四',
            'lisi@example.com',
          ])
        })
        .then(() => {
          return client.query('INSERT INTO users (id, name, email) VALUES ($1, $2, $3)', [
            3,
            '王五',
            'wangwu@example.com',
          ])
        })
        .then(() => {
          console.log('✓ 插入了 3 条测试数据')

          // 开始事务
          return client.query('BEGIN')
        })
        .then(() => {
          return client.query('SELECT COUNT(*) FROM users')
        })
        .then((res1) => {
          console.log('用户总数:', res1.rows[0].count)
          return client.query('SELECT NOW() as time')
        })
        .then((res2) => {
          console.log('查询时间:', res2.rows[0].time)
          // 提交事务
          return client.query('COMMIT')
        })
        .then(() => {
          console.log('✓ 事务提交成功')
        })
        .catch((err) => {
          console.error('✗ 查询失败:', err)
          return client.query('ROLLBACK')
        })
        .finally(() => {
          // 释放连接回池中
          client.release()
          console.log('✓ 连接已释放')
        })
    })
    .then(() => {
      return pool.end()
    })
}

demonstratePoolCheckout()
