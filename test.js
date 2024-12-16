const fs = require('fs')
try {
  const lock = './test.lock'
  let fd = fs.openSync(lock, 'wx')
  fs.closeSync(fd)
  process.on('SIGINT', () => {
    console.log('SIGINT', 0)
    process.exit(0)
  })
  process.on('SIGINT', () => {
    console.log('SIGINT', 1)
    process.exit(1)
  })
  process.on('exit', (code) => {
    console.log('exit', code)
    fs.unlinkSync(lock)
  })
} catch (error) {
  console.error(`[keyv-file] There is another process using this file`)
  throw error
}

setInterval(() => {
}, 1000)
