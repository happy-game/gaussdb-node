import { Client } from 'gaussdb-node'

const client = new Client()

async function demonstrateTransactionManagement() {
  console.log('事务管理演示')
  console.log('===========================')

  try {
    await client.connect()
    console.log('已连接到 GaussDB')

    await setupTestTables()
    await basicTransactionExample()
    await rollbackExample()
    await savepointExample()

    console.log('\n事务示例完成!')
  } catch (err) {
    console.error('演示失败:', err.message)
  } finally {
    await client.end()
  }
}

async function setupTestTables() {
  console.log('\n设置测试表...')

  await client.query(`
    CREATE TEMP TABLE accounts (
      id INTEGER PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      balance NUMERIC(10,2) NOT NULL DEFAULT 0.00
    )
  `)

  await client.query('INSERT INTO accounts (id, name, balance) VALUES ($1, $2, $3)', [1, 'Alice', 1000])
  await client.query('INSERT INTO accounts (id, name, balance) VALUES ($1, $2, $3)', [2, 'Bob', 500])

  console.log('   测试表已创建')
}

async function showBalances(title) {
  console.log(`   ${title}:`)
  const result = await client.query('SELECT name, balance FROM accounts ORDER BY name')
  for (const row of result.rows) {
    console.log(`      ${row.name}: $${parseFloat(row.balance).toFixed(2)}`)
  }
}

async function basicTransactionExample() {
  console.log('\n1. 基础事务演示')
  console.log('-------------------------')
  await showBalances('转账前')

  try {
    await client.query('BEGIN')

    const transferAmount = 150.0

    await client.query('UPDATE accounts SET balance = balance - $1 WHERE name = $2', [transferAmount, 'Alice'])
    await client.query('UPDATE accounts SET balance = balance + $1 WHERE name = $2', [transferAmount, 'Bob'])

    await client.query('COMMIT')
    console.log('   转账完成')
    await showBalances('转账后')
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('   转账失败:', err.message)
  }
}

async function rollbackExample() {
  console.log('\n2. 回滚演示')
  console.log('----------------')
  await showBalances('回滚测试前')

  try {
    await client.query('BEGIN')

    const invalidAmount = 2000.0
    console.log(`   尝试转账 $${invalidAmount} (超出余额)`)

    await client.query('UPDATE accounts SET balance = balance - $1 WHERE name = $2', [invalidAmount, 'Bob'])

    const result = await client.query('SELECT balance FROM accounts WHERE name = $1', ['Bob'])
    if (parseFloat(result.rows[0].balance) < 0) {
      throw new Error('余额不足')
    }

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    console.log('   由于余额不足，事务已回滚')
    await showBalances('回滚后 (未更改)')
  }
}

async function savepointExample() {
  console.log('\n3. 保存点演示')
  console.log('-----------------')
  await showBalances('保存点测试前')

  try {
    await client.query('BEGIN')

    await client.query('UPDATE accounts SET balance = balance - $1 WHERE name = $2', [50, 'Alice'])
    await client.query('UPDATE accounts SET balance = balance + $1 WHERE name = $2', [50, 'Bob'])
    console.log('   步骤1: Alice -> Bob $50')

    await client.query('SAVEPOINT step1')
    console.log('   保存点已创建')

    await client.query('UPDATE accounts SET balance = balance - $1 WHERE name = $2', [100, 'Bob'])
    await client.query('UPDATE accounts SET balance = balance + $1 WHERE name = $2', [100, 'Alice'])
    console.log('   步骤2: Bob -> Alice $100')

    console.log('   模拟错误，回滚到保存点...')
    await client.query('ROLLBACK TO SAVEPOINT step1')
    console.log('   已回滚到保存点 (步骤2已撤销，步骤1保留)')

    await client.query('COMMIT')
    console.log('   事务已提交')
    await showBalances('保存点测试后')
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('   保存点演示失败:', err.message)
  }
}

demonstrateTransactionManagement()
