const fs = require('fs')
try {
    const lock = './test.lock'
    let fd = fs.openSync(lock, 'wx')
    fs.closeSync(fd)
    process.on('SIGINT',() => {
        process.exit(0)
    })
    process.on('exit', () => {
        fs.unlinkSync(lock)
    })
} catch (error) {
    console.error(`[keyv-file] There is another process using this file`)
    throw error
}
