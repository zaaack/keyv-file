'use strict'

import * as os from 'os'
import * as fs from 'fs-extra'
import EventEmitter from 'events'
import type { KeyvStoreAdapter, StoredData } from 'keyv'
import { defaultDeserialize, defaultSerialize } from '@keyv/serialize'

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
  private _cache: Map<string, WrappedValue>
  private _lastExpire: number

  constructor(options?: Partial<Options>) {
    super()
    this.opts = Object.assign({}, defaultOpts, options)
    if (this.opts.checkFileLock) {
      this.checkFileLock()
    }
    try {
      const data = this.opts.deserialize(
        fs.readFileSync(this.opts.filename, 'utf8')
      )
      if (!Array.isArray(data.cache)) {
        const _cache = data.cache
        data.cache = []
        for (const key in _cache) {
          if (_cache.hasOwnProperty(key)) {
            data.cache.push([key, _cache[key]])
          }
        }
      }
      this._cache = new Map(data.cache)
      this._lastExpire = data.lastExpire
    } catch (e) {
      this._cache = new Map()
      this._lastExpire = Date.now()
    }
  }

  checkFileLock() {
    try {
      const lock = this.opts.filename + '.lock'
      let fd = fs.openSync(lock, 'wx')
      fs.closeSync(fd)

      process.on('SIGINT', () => {
        process.exit(0)
      })
      process.on('exit', () => {
        fs.unlinkSync(lock)
      })
    } catch (error) {
      console.error(`[keyv-file] There is another process using this file`)
      throw error
    }
  }

  public async get<Value>(key: string): Promise<StoredData<Value> | undefined> {
    try {
      const data = this._cache.get(key)
      if (!data) {
        return undefined
      } else if (this.isExpired(data)) {
        await this.delete(key)
        return undefined
      } else {
        return data.value as StoredData<Value>
      }
    } catch (error) {
      // do nothing;
    }
  }

  public async getMany<Value>(
    keys: string[]
  ): Promise<Array<StoredData<Value | undefined>>> {
    const results = await Promise.all(
      keys.map(async (key) => {
        const value = await this.get(key)
        return value as StoredData<Value | undefined>
      })
    )
    return results
  }

  public async set(key: string, value: any, ttl?: number) {
    if (ttl === 0) {
      ttl = undefined
    }
    this._cache.set(key, {
      expire: isNumber(ttl) ? Date.now() + ttl : undefined,
      value: value as any,
    })
    return this.save()
  }

  public async delete(key: string) {
    const ret = this._cache.delete(key)
    await this.save()
    return ret
  }

  public async deleteMany(keys: string[]): Promise<boolean> {
    const deletePromises: Promise<boolean>[] = keys.map((key) =>
      this.delete(key)
    )
    const results = await Promise.all(deletePromises)
    return results.every((result) => result)
  }

  public async clear() {
    this._cache = new Map()
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
    for (const key of this._cache.keys()) {
      const data = this._cache.get(key)
      if (this.isExpired(data!)) {
        this._cache.delete(key)
      }
    }
    this._lastExpire = now
  }

  private saveToDisk() {
    const cache = [] as [string, any][]
    for (const [key, val] of this._cache) {
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
    for (const [key, data] of this._cache.entries()) {
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

export class Field<T, D extends T | void = T | void> {
  constructor(
    protected kv: KeyvFile,
    protected key: string,
    protected defaults?: D
  ) {}

  get(): Promise<D>
  get(def: D): Promise<D>
  async get(def = this.defaults) {
    return (await this.kv.get(this.key)) ?? def
  }
  set(val: T, ttl?: number) {
    return this.kv.set(this.key, val, ttl)
  }
  delete() {
    return this.kv.delete(this.key)
  }
}

export function makeField<T = any, D = T>(
  kv: KeyvFile,
  key: string,
  defaults: T
): Field<T, T>
export function makeField<T = any, D extends T | void = T | void>(
  kv: KeyvFile,
  key: string,
  defaults?: D
) {
  return new Field<T, D>(kv, key, defaults)
}
