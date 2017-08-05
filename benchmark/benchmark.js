const Benchmark = require('benchmark')
const msgpack = require('notepack.io')
const async = false
const suitOptions = {
  onCycle(event) {
    console.log(String(event.target))
  },
  onComplete () {
    console.log('Fastest is ' + this.filter('fastest').map('name'))
    console.log('\n')
  },
  onStart(bench) {
    console.log('Start Suit:', bench.currentTarget.name)
  },
  onError(err) {
    console.error(err)
  },
}

;['small', 'medium', 'large'].forEach(size => {
  const data = require(`./sample-${size}.json`)
  let encodedByJson
  let encodedByMsgpack
  // add tests
  new Benchmark.Suite(`sample-${size}`, suitOptions)
    .add('JSON encode', function() {
      encodedByJson = JSON.stringify(data)
    })
    .add('notepack.io encode', function() {
      encodedByMsgpack = msgpack.encode(data)
    })
    .add('JSON decode', function () {
      JSON.parse(encodedByJson)
    })
    .add('notepack.io decode', function () {
      msgpack.decode(encodedByMsgpack)
    })
    // run async
    .run({ async })
})
