import { Client } from 'gaussdb-node'

const client = new Client({
  user: process.env.GAUSSUSER || 'user',
  host: process.env.GAUSSHOST || 'localhost',
  database: process.env.GAUSSDATABASE || 'data',
  password: process.env.GAUSSPASSWORD || 'openGauss@123',
  port: parseInt(process.env.GAUSSPORT) || 5432,
})

async function connectWithConfig() {
  try {
    await client.connect()
    console.log('✓ 连接成功!')

    const res = await client.query('SELECT NOW() as current_time')
    console.log('当前时间:', res.rows[0].current_time)
  } catch (err) {
    console.error('✗ 连接失败:', err.message)
  } finally {
    await client.end()
  }
}

connectWithConfig()
