'use strict';

import * as os from 'os'
import * as fs from 'fs-extra'
import Debug from 'debug'

const debug = Debug('keyv-file')

function isNumber(val: any): val is number {
  return typeof val === 'number'
}
export interface Data<V> {
  expire?: number
  value: V
}

export const defaultOpts = {
  filename: `${os.tmpdir()}/keyv-file/default-rnd-${Math.random().toString(36).slice(2)}.json`,
  expiredCheckDelay: 24 * 3600 * 1000, // ms
  writeDelay: 100, // ms
  encode: JSON.stringify as any as (val: any) => any,
  decode: JSON.parse as any as (val: any) => any,
}

export class KeyvFile<K, V> {
  ttlSupport = true
  private _opts = defaultOpts
  private _lastSave = Date.now()
  private _cache: Map<K, Data<V>>
  private _lastExpire: number
  private _saveTimer?: NodeJS.Timer

  constructor(opts?: Partial<typeof defaultOpts>) {
    this._opts = {
      ...this._opts,
      ...opts,
    }
    try {
      const data = this._opts.decode(fs.readFileSync(this._opts.filename, 'utf8'))
      if (!Array.isArray(data.cache)) {
        const _cache = data.cache
        data.cache = []
        for (const key in _cache) {
          data.cache.push([key, _cache[key]])
        }
      }
      this._cache = new Map(data.cache)
      this._lastExpire = data.lastExpire
    } catch (e) {
      debug(e)
      this._cache = new Map()
      this._lastExpire = Date.now()
    }
  }

  _isExpired(data: Data<V>) {
    return isNumber(data.expire) && data.expire <= Date.now()
  }

  get(key: K, defaults: V): V
  get(key: K): V | undefined
  get(key: K, defaults?: V): V | undefined {
    const data = this._cache.get(key)
    if (!data) {
      return defaults
    } else if (this._isExpired(data)) {
      this.delete(key)
      return defaults
    } else {
      return data.value
    }
  }

  has(key: K) {
    return typeof this.get(key) !== 'undefined'
  }

  keys() {
    let keys = [] as K[]
    for (const key of this._cache.keys()) {
      if (!this._isExpired(this._cache.get(key)!)) {
        keys.push(key)
      }
    }
    return keys
  }
  /**
   *
   * @param key
   * @param value
   * @param ttl time-to-live, seconds
   */
  set(key: K, value: V, ttl?: number) {
    if (ttl === 0) {
      ttl = undefined
    }
    this._cache.set(key, {
      value: value,
      expire: isNumber(ttl)
        ? Date.now() + ttl
        : undefined
    })
    this.save()
  }

  delete(key: K) {
    let ret = this._cache.delete(key)
    this.save()
    return ret
  }

  clear() {
    this._cache = new Map()
    this._lastExpire = Date.now()
    this.save()
  }

  clearExpire() {
    const now = Date.now()
    if (now - this._lastExpire <= this._opts.expiredCheckDelay) {
      return
    }
    for (const key of this._cache.keys()) {
      const data = this._cache.get(key)
      if (this._isExpired(data!)) {
        this._cache.delete(key)
      }
    }
    this._lastExpire = now
  }

  saveToDisk() {
    const cache = [] as [K, Data<V>][]
    for (const [key, val] of this._cache) {
      cache.push([key, val])
    }
    const data = this._opts.encode({
      cache,
      lastExpire: this._lastExpire,
    })
    return new Promise<void>((resolve, reject) => {
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
    return new Promise<void>((resolve, reject) => {
      this._saveTimer = setTimeout(
        () => this.saveToDisk().then(resolve, reject),
        this._opts.writeDelay
      )
    })
  }
}
export default KeyvFile
module.exports = KeyvFile
module.exports.default = KeyvFile
