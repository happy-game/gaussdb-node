import { Client } from 'gaussdb-node'
import QueryStream from 'gaussdb-query-stream'

const client = new Client()

async function demonstrateStreamingQueries() {
  try {
    await client.connect()
    console.log('创建临时表用于演示...')

    // 创建临时表
    await client.query(`
      CREATE TEMP TABLE large_table (
        id INTEGER PRIMARY KEY,
        name VARCHAR(100),
        email VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log('✓ 临时表创建成功')

    // 插入大量测试数据
    console.log('插入测试数据...')
    for (let i = 1; i <= 500; i++) {
      await client.query('INSERT INTO large_table (id, name, email) VALUES ($1, $2, $3)', [
        i,
        `用户${i}`,
        `user${i}@example.com`,
      ])
    }
    console.log('✓ 插入了 500 条测试数据')

    console.log('开始流式查询...')
    const query = new QueryStream('SELECT * FROM large_table ORDER BY created_at')
    const stream = client.query(query)

    let rowCount = 0

    stream.on('data', (row) => {
      rowCount++
      if (rowCount % 100 === 0 || rowCount <= 5) {
        console.log(`处理第 ${rowCount} 行: ${row.name} (${row.email})`)
      }

      // 处理每一行数据
      // 这里可以进行数据转换、验证等操作
    })

    stream.on('end', () => {
      console.log(`✓ 流式查询完成，总共处理 ${rowCount} 行`)
    })

    stream.on('error', (err) => {
      console.error('✗ 流式查询错误:', err.message)
    })

    // 等待流结束
    await new Promise((resolve, reject) => {
      stream.on('end', resolve)
      stream.on('error', reject)
    })
  } catch (err) {
    console.error('✗ 查询失败:', err.message)
  } finally {
    await client.end()
  }
}

demonstrateStreamingQueries()
