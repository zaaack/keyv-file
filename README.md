# keyv-file [<img width="100" align="right" src="https://rawgit.com/lukechilds/keyv/master/media/logo.svg" alt="keyv">](https://github.com/lukechilds/keyv)

> File storage adapter for Keyv, using json to serialize data fast and small.

[![Build Status](https://travis-ci.org/zaaack/keyv-file.svg?branch=master)](https://travis-ci.org/zaaack/keyv-file)
[![npm](https://img.shields.io/npm/v/keyv-file.svg)](https://www.npmjs.com/package/keyv-file)

File storage adapter for [Keyv](https://github.com/lukechilds/keyv).

TTL functionality is handled internally by interval scan, don't need to panic about expired data take too much space.

## Install

```shell
npm install --save keyv keyv-file
```

## Usage

```js
const Keyv = require('keyv')
const KeyvFile = require('keyv-file')

const keyv = new Keyv({
  store: new KeyvFile()
});
// More options with default value:
const customKeyv = new Keyv({
  store: new KeyvFile({
    filename: `${os.tmpdir()}/keyv-file/default-rnd-${Math.random().toString(36).slice(2)}.json` // the file path to store the data
    expiredCheckDelay: 24 * 3600 * 1000, // ms, check and remove expired data in each ms
    writeDelay: 100, // ms, batch write to disk in a specific duration, enhance write performance.
    encode: JSON.stringify, // serialize function
    decode: JSON.parse, // deserialize function
  })
})
```

## License

MIT
