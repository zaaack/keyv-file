'use strict'

import * as os from 'os'
import * as fs from 'fs-extra'
import EventEmitter from 'events'
import type { Keyv, KeyvStoreAdapter, StoredData } from 'keyv'
import { defaultDeserialize, defaultSerialize } from '@keyv/serialize'
export * from './make-field'

export interface Options {
  deserialize: (val: string) => any
  dialect: string
  /** milliseconds */
  expiredCheckDelay: number
  filename: string
  serialize: (val: any) => string
  /** milliseconds */
  writeDelay: number
  /** create lock file and check if exists */
  checkFileLock: boolean
}

export const defaultOpts: Options = {
  deserialize: defaultDeserialize,
  dialect: 'redis',
  expiredCheckDelay: 24 * 3600 * 1000, // ms
  filename: `${os.tmpdir()}/keyv-file/default.json`,
  serialize: defaultSerialize,
  writeDelay: 100, // ms
  checkFileLock: false,
}

function isNumber(val: any): val is number {
  return typeof val === 'number'
}

export interface WrappedValue<T = any> {
  value: T
  expire?: number
}

export class KeyvFile extends EventEmitter implements KeyvStoreAdapter {
  public ttlSupport = true
  public namespace?: string
  public opts: Options
  private _data: Map<string, WrappedValue>
  private _lastExpire: number

  constructor(options?: Partial<Options>) {
    super()
    this.opts = Object.assign({}, defaultOpts, options)
    if (this.opts.checkFileLock) {
      this.acquireFileLock()
    }
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
    } catch {
      //pass
    }
  }

  public async get<Value>(key: string): Promise<StoredData<Value> | undefined> {
    return Promise.resolve(this.getSync(key))
  }

  public getSync<Value>(key: string): Value | undefined {
    try {
      const data = this._data.get(key)
      if (!data) {
        return undefined
      } else if (this.isExpired(data)) {
        this.delete(key)
        return undefined
      } else {
        return data.value as Value
      }
    } catch (error) {
      // do nothing;
    }
  }

  public async getMany<Value>(keys: string[]): Promise<Array<StoredData<Value | undefined>>> {
    const results = await Promise.all(
      keys.map(async (key) => {
        const value = await this.get(key)
        return value as StoredData<Value | undefined>
      }),
    )
    return results
  }

  public async set(key: string, value: any, ttl?: number) {
    if (ttl === 0) {
      ttl = undefined
    }
    this._data.set(key, {
      expire: isNumber(ttl) ? Date.now() + ttl : undefined,
      value: value as any,
    })
    return this.save()
  }

  public async delete(key: string) {
    const ret = this._data.delete(key)
    await this.save()
    return ret
  }

  public async deleteMany(keys: string[]): Promise<boolean> {
    const deletePromises: Promise<boolean>[] = keys.map((key) => this.delete(key))
    const results = await Promise.all(deletePromises)
    return results.every((result) => result)
  }

  public async clear() {
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
    for (const key of this._data.keys()) {
      const data = this._data.get(key)
      if (this.isExpired(data!)) {
        this._data.delete(key)
      }
    }
    this._lastExpire = now
  }

  private saveToDisk() {
    const cache = [] as [string, any][]
    for (const [key, val] of this._data) {
      cache.push([key, val])
    }
    const data = this.opts.serialize({
      cache,
      lastExpire: this._lastExpire,
    })
    return new Promise<void>((resolve, reject) => {
      fs.outputFile(this.opts.filename, data, (err) => {
        if (err) {
          reject(err)
        } else {
          resolve()
        }
      })
    })
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
