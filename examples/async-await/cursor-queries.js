import { Client } from 'gaussdb-node'
import Cursor from 'gaussdb-cursor'

const client = new Client()

async function demonstrateCursorQueries() {
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

    // 插入测试数据
    console.log('插入测试数据...')
    for (let i = 1; i <= 1000; i++) {
      await client.query('INSERT INTO large_table (id, name, email) VALUES ($1, $2, $3)', [
        i,
        `用户${i}`,
        `user${i}@example.com`,
      ])
    }
    console.log('✓ 插入了 1000 条测试数据')

    console.log('创建游标查询大数据集...')
    const query = 'SELECT * FROM large_table ORDER BY id'
    const cursor = client.query(new Cursor(query))

    let totalRows = 0
    let batch

    // 批量读取数据，每次100行
    while ((batch = await cursor.read(100)).length > 0) {
      totalRows += batch.length
      console.log(`✓ 处理了 ${batch.length} 行，总计 ${totalRows} 行`)

      // 处理每一行数据
      batch.forEach((row) => {
        // 处理每行数据，显示前5行作为示例
        if (row.id <= 5) {
          console.log(`  行 ${row.id}: ${row.name} - ${row.email}`)
        }
      })
    }

    await cursor.close()
    console.log(`✓ 游标查询完成，总共处理 ${totalRows} 行`)
  } catch (err) {
    console.error('✗ 游标查询失败:', err.message)
  } finally {
    await client.end()
  }
}

demonstrateCursorQueries()
