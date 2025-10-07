'use strict'

import * as os from 'os'
import * as fs from 'fs'
import * as fsp from 'fs/promises'
import EventEmitter from 'events'
import type { KeyvStoreAdapter } from 'keyv'
import { defaultDeserialize, defaultSerialize } from '@keyv/serialize'
import path from 'path'
export * from './make-field'

export interface Options {
  deserialize: (val: string | Buffer) => any
  dialect: string
  /** milliseconds */
  expiredCheckDelay: number
  filename: string
  serialize: (val: any) => string | Buffer
  /** milliseconds */
  writeDelay: number
  /** create lock file and check if exists */
  checkFileLock: boolean

  /** keep cache in memory, default: true */
  keepCacheInMemory: boolean
}

export const defaultOpts: Options = {
  deserialize: defaultDeserialize,
  dialect: 'redis',
  expiredCheckDelay: 24 * 3600 * 1000, // ms
  filename: `${os.tmpdir()}/keyv-file/default.json`,
  serialize: defaultSerialize,
  writeDelay: 100, // ms
  checkFileLock: false,
  keepCacheInMemory: true,
}

function isNumber(val: any): val is number {
  return typeof val === 'number'
}
function handleIOError(e: any) {
  if (e.code === 'ENOENT') {
    return
  } else {
    console.error(e)
  }
}
export interface WrappedValue<T = any> {
  value: T
  expire?: number
}

export class KeyvFile extends EventEmitter implements KeyvStoreAdapter {
  public ttlSupport = true
  public namespace?: string
  public opts: Options
  private _data: Map<string, WrappedValue> = new Map()
  private _lastExpire = 0

  private get _lastExpireFile() {
    return this.opts.filename + '.expire'
  }

  constructor(options?: Partial<Options>) {
    super()
    this.opts = Object.assign({}, defaultOpts, options)
    if (this.opts.checkFileLock) {
      this.acquireFileLock()
    }
    if (this.opts.keepCacheInMemory) {
      this._loadDataSync()
    } else {
      try {
        this._lastExpire = Number(fs.readFileSync(this._lastExpireFile, 'utf8'))
      } catch (error) {
        handleIOError(error)
      }
    }
  }

  private _loadDataSync() {
    try {
      const data = this.opts.deserialize(fs.readFileSync(this.opts.filename, 'utf8'))
      if (!Array.isArray(data.cache)) {
        const _cache = data.cache
        data.cache = []
        for (const key in _cache) {
          if (_cache.hasOwnProperty(key)) {
            data.cache.push([key, _cache[key]])
          }
        }
      }
      this._data = new Map(data.cache)
      this._lastExpire = data.lastExpire
    } catch (e) {
      handleIOError(e)
      this._data = new Map()
      this._lastExpire = Date.now()
    }
  }

  private get _lockFile() {
    return this.opts.filename + '.lock'
  }

  acquireFileLock() {
    try {
      let fd = fs.openSync(this._lockFile, 'wx')
      fs.closeSync(fd)

      process.on('SIGINT', () => {
        this.releaseFileLock()
        process.exit(0)
      })
      process.on('exit', () => {
        this.releaseFileLock()
      })
    } catch (error) {
      console.error(`[keyv-file] There is another process using this file`)
      throw error
    }
  }

  releaseFileLock() {
    try {
      fs.unlinkSync(this._lockFile)
    } catch (e) {
      //pass
      handleIOError(e)
    }
  }

  public async get<Value>(key: string): Promise<Value | undefined> {
    if (!this.opts.keepCacheInMemory) {
      try {
        let rawData = await fsp.readFile(path.join(this.opts.filename, key), 'utf8')
        let data = await this.opts.deserialize(rawData)
        if (this.isExpired(data)) {
          await this.delete(key)
          return undefined
        }
        return data.value as Value
      } catch (e) {
        handleIOError(e)
      }
      return void 0
    }
    return this.getSync(key)
  }

  public getSync<Value>(key: string): Value | undefined {
    if (!this.opts.keepCacheInMemory) {
      throw new Error(`[keyv-file] getSync not support when opts.keepCacheInMemory is false`)
    }
    let ret: Value | undefined = void 0
    try {
      const data = this._data.get(key)
      if (!data) {
        ret = undefined
      } else if (this.isExpired(data)) {
        this.delete(key)
        ret = undefined
      } else {
        ret = data.value as Value
      }
    } catch (error) {
      // do nothing;
      handleIOError(error)
    }
    return ret
  }

  public async getMany<Value>(keys: string[]): Promise<Array<Value | undefined>> {
    if (!this.opts.keepCacheInMemory) {
      return Promise.all(keys.map((key) => this.get<Value>(key)))
    }
    return keys.map((key) => this.getSync(key))
  }
  /**
   * Note: `await kv.set()` will wait <options.writeDelay> millseconds to save to disk, it would be slow. Please remove `await` if you find performance issues.
   * @param key
   * @param value
   * @param ttl
   * @returns
   */
  public async set(key: string, value: any, ttl?: number) {
    if (ttl === 0) {
      ttl = undefined
    }
    value = {
      expire: isNumber(ttl) ? Date.now() + ttl : undefined,
      value: value as any,
    }
    if (!this.opts.keepCacheInMemory) {
      try {
        this.clearExpire()
        await fsp.mkdir(this.opts.filename, {
          recursive: true,
        })
        await fsp.writeFile(path.join(this.opts.filename, key), this.opts.serialize(value))
      } catch (e) {
        handleIOError(e)
      }
      return
    }
    this._data.set(key, value)
    return this.save()
  }

  public async delete(key: string) {
    if (!this.opts.keepCacheInMemory) {
      try {
        await fsp.unlink(path.join(this.opts.filename, key))
      } catch (e) {
        handleIOError(e)
        return false
      }
      return true
    }
    const ret = this._data.delete(key)
    await this.save()
    return ret
  }

  public async deleteMany(keys: string[]): Promise<boolean> {
    if (!this.opts.keepCacheInMemory) {
      let ret = await Promise.all(keys.map((key) => this.delete(key)))
      return ret.every(r=>r)
    }
    let res = keys.every((key) => this._data.delete(key))
    await this.save()
    return res
  }

  public async clear() {
    if (!this.opts.keepCacheInMemory) {
      await fsp.rm(this.opts.filename, {
        recursive: true,
      })
      return true
    }
    this._data = new Map()
    this._lastExpire = Date.now()
    return this.save()
  }

  public async has(key: string): Promise<boolean> {
    const value = await this.get(key)
    return value !== undefined
  }

  private isExpired(data: WrappedValue) {
    return isNumber(data.expire) && data.expire <= Date.now()
  }

  private clearExpire() {
    const now = Date.now()
    if (now - this._lastExpire <= this.opts.expiredCheckDelay) {
      return
    }
    this._lastExpire = now
    if (!this.opts.keepCacheInMemory) {
      fsp
        .readdir(this.opts.filename)
        .then((keys) => {
          for (const key of keys) {
            this.get(key)
          }
        })
        .catch(handleIOError)
      fsp
       .writeFile(this._lastExpireFile, this._lastExpire.toString())
       .catch(handleIOError)
      return
    }
    for (const key of this._data.keys()) {
      const data = this._data.get(key)
      if (this.isExpired(data!)) {
        this._data.delete(key)
      }
    }
  }

  private async saveToDisk() {
    const cache = [] as [string, any][]
    for (const [key, val] of this._data) {
      cache.push([key, val])
    }
    const data = this.opts.serialize({
      cache,
      lastExpire: this._lastExpire,
    })
    await fsp.mkdir(path.dirname(this.opts.filename), {
      recursive: true,
    })
    return fsp.writeFile(this.opts.filename, data)
  }

  private _savePromise?: Promise<any>

  private save() {
    this.clearExpire()
    if (this._savePromise) {
      return this._savePromise
    }
    this._savePromise = new Promise<void>((resolve, reject) => {
      setTimeout(() => {
        this.saveToDisk()
          .then(resolve, reject)
          .finally(() => {
            this._savePromise = void 0
          })
      }, this.opts.writeDelay)
    })
    return this._savePromise
  }

  public disconnect(): Promise<void> {
    return Promise.resolve()
  }

  public async *iterator(namespace?: string) {
    if (!this.opts.keepCacheInMemory) {
      let keys = await fsp.readdir(this.opts.filename)
      for (const key of keys) {
        try {
          let rawData = await fsp.readFile(path.join(this.opts.filename, key), 'utf8')
          let data = await this.opts.deserialize(rawData)
          if (!namespace || key.includes(namespace)) {
            yield [key, data.value]
          }
        } catch (error) {
          handleIOError(error)
        }
      }
      return
    }
    for (const [key, data] of this._data.entries()) {
      if (key === undefined) {
        continue
      }
      // Filter by namespace if provided
      if (!namespace || key.includes(namespace)) {
        yield [key, data.value]
      }
    }
  }
}

export default KeyvFile
