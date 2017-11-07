'use strict';

const msgpack = require('notepack.io')
const os = require('os')
const fs = require('fs-extra')
const Debug = require('debug')

const debug = Debug('keyv-file')

function isNumber(val) {
  return typeof val === 'number'
}

module.exports = class KeyvFile {
  constructor(opts) {
    this.ttlSupport = true
    const defaults = {
      filename: `${os.tmpdir()}/keyv-file/default-rnd-${Math.random().toString(36).slice(2)}.msgpack`,
      expiredCheckDelay: 24 * 3600 * 1000, // ms
      writeDelay: 100, // ms
      encode: msgpack.encode,
      decode: msgpack.decode
    }
    this._opts = Object.assign(defaults, opts)
    this._lastSave = Date.now()
    try {
      const data = this._opts.decode(fs.readFileSync(this._opts.filename))
      this._cache = data.cache
      this._lastExpire = data.lastExpire
    } catch (e) {
      debug(e)
      this._cache = {}
      this._lastExpire = Date.now()
    }
  }

  _isExpired(data) {
    return isNumber(data.expire) && data.expire <= Date.now()
  }

  get(key) {
    const data = this._cache[key]
    if (!data) {
      return undefined
    } else if (this._isExpired(data)) {
      this.delete(key)
      return undefined
    } else {
      return data.value
    }
  }

  keys() {
    return Object.keys(this._cache)
                 .filter(key => !this._isExpired(this._cache[key]))
  }

  set(key, value, ttl) {
    if (ttl === 0) {
      ttl = undefined
    }
    this._cache[key] = {
      value: value,
      expire: isNumber(ttl)
        ? Date.now() + ttl
        : undefined
    }
    this.save()
  }

  delete(key) {
    let ret = key in this._cache
    delete this._cache[key]
    this.save()
    return ret
  }

  clear() {
    this._cache = {}
    this._lastExpire = Date.now()
    this.save()
  }

  clearExpire() {
    const now = Date.now()
    if (now - this._lastExpire <= this._opts.expiredCheckDelay) {
      return
    }
    Object.keys(this._cache).forEach(key => {
      const data = this._cache[key]
      if (this._isExpired(data)) {
        delete this._cache[key]
      }
    })
    this._lastExpire = now
  }

  saveToDisk() {
    const data = this._opts.encode({cache: this._cache, lastExpire: this._lastExpire})
    return new Promise((resolve, reject) => {
      fs.outputFile(this._opts.filename, data, err => {
        if (err) {
          reject(err)
        } else {
          resolve()
        }
      })
    })
  }

  save() {
    this.clearExpire()
    this._saveTimer && clearTimeout(this._saveTimer)
    return new Promise((resolve, reject) => {
      this._saveTimer = setTimeout(
        () => this.saveToDisk().then(resolve, reject),
        this._opts.writeDelay
      )
    })
  }
}
