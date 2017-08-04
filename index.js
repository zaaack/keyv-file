'use strict';

const msgpack = require('msgpack-lite')
const os = require('os')
const fs = require('fs-extra')
const Debug = require('debug')

const debug = Debug('keyv-file')

module.exports = class KeyvFile {
  constructor(opts) {
    this.ttlSupport = true
    const defaults = {
      filename: `${os.tmpdir()}/keyv-file/default-rnd-${Math.random().toString(36).slice(2)}.msgpack`,
      expiredCheckDelay: 24 * 3600 * 1000, // ms
      writeDiskDelay: 100, // ms
    }
    this._opts = Object.assign(defaults, opts)
    this._lastSave = Date.now()
    try {
      const {cache, lastExpire} = msgpack.decode(fs.readFileSync(this._opts.filename))
      this._cache = cache
      this._lastExpire = lastExpire
    } catch (e) {
      debug(e)
      this._cache = {}
      this._lastExpire = Date.now()
    }
  }
  get(key) {
    const data = this._cache[key]
    if (!data) {
      return undefined
    } else if (data.expire !== null && data.expire < Date.now()) {
      this.delete(key)
      return undefined
    } else {
      return data.value
    }
	}

	set(key, value, ttl = null) {
    this._cache[key] = {
      value,
      expire: ttl !== null ? Date.now() + ttl : null,
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
    if (now - this._lastExpire < this._opts.expiredCheckDelay) {
      return
    }
    Object.keys(this._cache).forEach(key => {
      const data = this._cache[key]
      if (data.expire !== null && data.expire > now) {
        this.delete(key)
      }
    })
    this._lastExpire = now
  }

  saveToDisk() {
    const data = msgpack.encode({
      cache: this._cache,
      lastExpire: this._lastExpire,
    })
    fs.outputFile(this._opts.filename, data, err => {
      if (err) {
        throw err
      }
    })
  }

  save() {
    this._saveTimer && clearTimeout(this._saveTimer)
    this._saveTimer = setTimeout(
      () => this.saveToDisk(),
      this._opts.writeDiskDelay
    )
  }
}
