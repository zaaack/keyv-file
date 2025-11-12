const fs = require('fs')
const {KeyvFile} = require('../lib/index.js');
const { SafeFilenameEncoder } = require('../lib/safe-encoder.js');

// try {
//   const lock = './test.lock'
//   let fd = fs.openSync(lock, 'wx')
//   fs.closeSync(fd)
//   process.on('SIGINT', () => {
//     console.log('SIGINT', 0)
//     process.exit(0)
//   })
//   process.on('SIGINT', () => {
//     console.log('SIGINT', 1)
//     process.exit(1)
//   })
//   process.on('exit', (code) => {
//     console.log('exit', code)
//     fs.unlinkSync(lock)
//   })
// } catch (error) {
//   console.error(`[keyv-file] There is another process using this file`)
//   throw error
// }


const store = new KeyvFile({
  filename: `./node_modules/.cache/a-test`,
  separatedFile: true
});
async function main() {

  // await store.set('foo', 'bar')
  // console.log(await store.get('foo'))
  console.log(SafeFilenameEncoder.encode("中文"))
}

main().catch(console.error)
