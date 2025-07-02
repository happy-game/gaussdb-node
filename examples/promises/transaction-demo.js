import { Client } from 'gaussdb-node'

const client = new Client()

function demonstrateTransactionManagement() {
  console.log('事务管理演示')
  console.log('===========================')

  return client
    .connect()
    .then(() => {
      console.log('已连接到 GaussDB')
      return setupTestTables()
    })
    .then(() => basicTransactionExample())
    .then(() => rollbackExample())
    .then(() => savepointExample())
    .then(() => {
      console.log('\n事务示例完成!')
    })
    .catch((err) => {
      console.error('演示失败:', err.message)
    })
    .finally(() => {
      return client.end()
    })
}

function setupTestTables() {
  console.log('\n设置测试表...')

  return client
    .query(
      `
    CREATE TEMP TABLE accounts (
      id INTEGER PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      balance NUMERIC(10,2) NOT NULL DEFAULT 0.00
    )
  `
    )
    .then(() => {
      return client.query('INSERT INTO accounts (id, name, balance) VALUES ($1, $2, $3)', [1, 'Alice', 1000])
    })
    .then(() => {
      return client.query('INSERT INTO accounts (id, name, balance) VALUES ($1, $2, $3)', [2, 'Bob', 500])
    })
    .then(() => {
      console.log('   测试表已创建')
    })
}

function showBalances(title) {
  console.log(`   ${title}:`)
  return client.query('SELECT name, balance FROM accounts ORDER BY name').then((result) => {
    for (const row of result.rows) {
      console.log(`      ${row.name}: $${parseFloat(row.balance).toFixed(2)}`)
    }
  })
}

function basicTransactionExample() {
  console.log('\n1. 基础事务演示')
  console.log('-------------------------')

  return showBalances('转账前')
    .then(() => {
      return client.query('BEGIN')
    })
    .then(() => {
      const transferAmount = 150.0

      return client
        .query('UPDATE accounts SET balance = balance - $1 WHERE name = $2', [transferAmount, 'Alice'])
        .then(() => {
          return client.query('UPDATE accounts SET balance = balance + $1 WHERE name = $2', [transferAmount, 'Bob'])
        })
    })
    .then(() => {
      return client.query('COMMIT')
    })
    .then(() => {
      console.log('   转账完成')
      return showBalances('转账后')
    })
    .catch((err) => {
      return client.query('ROLLBACK').then(() => {
        console.error('   转账失败:', err.message)
      })
    })
}

function rollbackExample() {
  console.log('\n2. 回滚演示')
  console.log('----------------')

  return showBalances('回滚测试前')
    .then(() => {
      return client.query('BEGIN')
    })
    .then(() => {
      const invalidAmount = 2000.0
      console.log(`   尝试转账 $${invalidAmount} (超出余额)`)

      return client
        .query('UPDATE accounts SET balance = balance - $1 WHERE name = $2', [invalidAmount, 'Bob'])
        .then(() => {
          return client.query('SELECT balance FROM accounts WHERE name = $1', ['Bob'])
        })
        .then((result) => {
          if (parseFloat(result.rows[0].balance) < 0) {
            throw new Error('余额不足')
          }
          return client.query('COMMIT')
        })
    })
    .catch((err) => {
      return client.query('ROLLBACK').then(() => {
        console.log('   由于余额不足，事务已回滚')
        return showBalances('回滚后 (未更改)')
      })
    })
}

function savepointExample() {
  console.log('\n3. 保存点演示')
  console.log('-----------------')

  return showBalances('保存点测试前')
    .then(() => {
      return client.query('BEGIN')
    })
    .then(() => {
      return client
        .query('UPDATE accounts SET balance = balance - $1 WHERE name = $2', [50, 'Alice'])
        .then(() => {
          return client.query('UPDATE accounts SET balance = balance + $1 WHERE name = $2', [50, 'Bob'])
        })
        .then(() => {
          console.log('   步骤1: Alice -> Bob $50')
        })
    })
    .then(() => {
      return client.query('SAVEPOINT step1').then(() => {
        console.log('   保存点已创建')
      })
    })
    .then(() => {
      return client
        .query('UPDATE accounts SET balance = balance - $1 WHERE name = $2', [100, 'Bob'])
        .then(() => {
          return client.query('UPDATE accounts SET balance = balance + $1 WHERE name = $2', [100, 'Alice'])
        })
        .then(() => {
          console.log('   步骤2: Bob -> Alice $100')
        })
    })
    .then(() => {
      console.log('   模拟错误，回滚到保存点...')
      return client.query('ROLLBACK TO SAVEPOINT step1').then(() => {
        console.log('   已回滚到保存点 (步骤2已撤销，步骤1保留)')
      })
    })
    .then(() => {
      return client.query('COMMIT').then(() => {
        console.log('   事务已提交')
        return showBalances('保存点测试后')
      })
    })
    .catch((err) => {
      return client.query('ROLLBACK').then(() => {
        console.error('   保存点演示失败:', err.message)
      })
    })
}

demonstrateTransactionManagement()
