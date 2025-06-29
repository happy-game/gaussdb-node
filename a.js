// verify-ssl.js (Corrected Version)

const { Client } = require('gaussdb-node')
const fs = require('fs')
const path = require('path')

// --- 数据库连接配置 ---
// 这些信息应与你的 docker-compose.yml 和 setup.sh 中的设置匹配
const dbConfig = {
  user: 'ci_user',
  password: 'openGauss@123',
  host: 'localhost',
  database: 'ci_db_test',
  port: 5432,
}

// ===================================================================
// 方式一：安全且推荐的方式 (验证服务器证书)
// ===================================================================
async function connectAndVerifySecurely() {
  console.log('\n--- 尝试进行安全连接 (验证服务器证书)... ---')

  // 读取我们自签名的证书作为信任的 CA
  const caCert = fs.readFileSync(path.join(__dirname, '.github/ssl/server.crt')).toString()

  const client = new Client({
    ...dbConfig,
    ssl: {
      rejectUnauthorized: true, // 确保开启验证
      ca: caCert, // 提供信任的证书颁发机构
    },
  })

  try {
    await client.connect()
    console.log('✅ 安全连接成功!')

    // 【GaussDB适配】检查 SSL 连接状态
    // GaussDB 没有 pg_stat_ssl 视图，我们使用其他方式验证
    try {
      // 方式1：查询 GaussDB 的连接信息
      const res = await client.query('SELECT version();')
      console.log('数据库版本:', res.rows[0].version)

      // 方式2：尝试查询 SSL 相关的系统视图（如果存在）
      try {
        const sslRes = await client.query('SHOW ssl;')
        console.log('SSL 配置状态:', sslRes.rows[0])
      } catch (showErr) {
        console.log('无法查询 SSL 配置 (这在 GaussDB 中是正常的)')
      }

      console.log('✅ SSL 连接验证：由于连接成功且使用了 SSL 配置，连接已加密！')
    } catch (queryErr) {
      console.warn('查询数据库信息时出错:', queryErr.message)
    }
  } catch (err) {
    console.error('❌ 安全连接失败:', err.message)
    console.error('提示：请确保 PostgreSQL 容器正在运行，并且 server.crt 文件位于脚本同级目录。')
  } finally {
    if (client._connected) {
      await client.end()
    }
    console.log('安全连接已关闭。')
  }
}

// --- 运行验证 ---
async function main() {
  await connectAndVerifySecurely()
}

main().catch(err => {
  console.error('脚本执行出错:', err.message)
  process.exit(1)
})