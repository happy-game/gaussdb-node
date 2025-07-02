import { Pool } from 'gaussdb-node'

const pool = new Pool({
  user: process.env.GAUSSUSER || 'user',
  host: process.env.GAUSSHOST || 'localhost',
  database: process.env.GAUSSDATABASE || 'data',
  password: process.env.GAUSSPASSWORD || 'openGauss@123',
  port: parseInt(process.env.GAUSSPORT) || 5432,
  max: 10,
  idleTimeoutMillis: 30000,
})

pool.on('error', (err) => {
  console.error('✗ 连接池意外错误:', err)
  process.exit(-1)
})

async function useConnectionPool() {
  try {
    // 创建临时表
    await pool.query(`
      CREATE TEMP TABLE IF NOT EXISTS temp_users (
        id INTEGER,
        name VARCHAR(100),
        email VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    console.log('✓ 临时表创建成功')

    // 插入测试数据
    await pool.query(`
      INSERT INTO temp_users (id, name, email) VALUES 
      (1, '张三', 'zhangsan@example.com'),
      (2, '李四', 'lisi@example.com'),
      (3, '王五', 'wangwu@example.com')
    `)
    console.log('✓ 测试数据插入成功')

    // 查询数据
    const userRes = await pool.query('SELECT COUNT(*) as user_count FROM temp_users')
    console.log('✓ 临时表用户数量:', userRes.rows[0].user_count)

    // 查询当前时间
    const timeRes = await pool.query('SELECT NOW() as current_time')
    console.log('✓ 当前时间:', timeRes.rows[0].current_time)
  } catch (err) {
    console.error('✗ 查询失败:', err.message)
  } finally {
    await pool.end()
    console.log('✓ 连接池已关闭')
  }
}

useConnectionPool()
