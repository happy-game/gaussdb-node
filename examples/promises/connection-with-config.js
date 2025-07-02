import { Client } from 'gaussdb-node'

// 使用配置对象连接数据库
const client = new Client({
  user: process.env.GAUSSUSER || 'user',
  host: process.env.GAUSSHOST || 'localhost',
  database: process.env.GAUSSDATABASE || 'data',
  password: process.env.GAUSSPASSWORD || 'openGauss@123',
  port: parseInt(process.env.GAUSSPORT) || 5432,
})

function connectWithConfig() {
  client
    .connect()
    .then(() => {
      console.log('✓ 连接成功!')
      return client.query('SELECT NOW() as current_time')
    })
    .then((res) => {
      console.log('当前时间:', res.rows[0].current_time)
    })
    .catch((err) => {
      console.error('✗ 连接失败:', err.message)
    })
    .finally(() => {
      return client.end()
    })
}

connectWithConfig()
