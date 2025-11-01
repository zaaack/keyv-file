'use strict'

import * as os from 'os'
import * as fs from 'fs'
import * as fsp from 'fs/promises'
import EventEmitter from 'events'
import type { KeyvStoreAdapter } from 'keyv'
import { defaultDeserialize, defaultSerialize } from '@keyv/serialize'
import path from 'path'
import { handleIOError, SeparatedFileHelper } from './separated-file-store'
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

  /**
   * default: false
   * if true, will store key values in seperated file as `opts.filename+key`
   */
  separatedFile: boolean
}

export const defaultOpts: Options = {
  deserialize: defaultDeserialize,
  dialect: 'redis',
  expiredCheckDelay: 24 * 3600 * 1000, // ms
  filename: `${os.tmpdir()}/keyv-file/default.json`,
  serialize: defaultSerialize,
  writeDelay: 100, // ms
  checkFileLock: false,
  separatedFile: false,
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
  private _data: Map<string, WrappedValue> = new Map()
  private _lastExpire = 0

  private _separated: SeparatedFileHelper
  constructor(options?: Partial<Options>) {
    super()
    this.opts = Object.assign({}, defaultOpts, options)
    this._separated = new SeparatedFileHelper(this.opts)
    if (this.opts.checkFileLock) {
      this.acquireFileLock()
    }
    if (this.opts.separatedFile) {
      this._lastExpire = this._separated.getLastExpire()
    } else {
      this._loadDataSync()
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
    if (this.opts.separatedFile) {
      return this._separated.lockFile
    }
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
    if (this.opts.separatedFile) {
      let data = await this._separated.get(key)
      return this._getWithExpire(key, data)
    }
    return this.getSync(key)
  }

  public getSync<Value>(key: string): Value | undefined {
    if (this.opts.separatedFile) {
      let data = this._separated.getSync(key)
      return this._getWithExpire(key, data)
    }
    let ret: Value | undefined = void 0
    try {
      const data = this._data.get(key)
      return this._getWithExpire(key, data)
    } catch (error) {
      handleIOError(error)
    }
    return ret
  }

  public async getMany<Value>(keys: string[]): Promise<Array<Value | undefined>> {
    if (this.opts.separatedFile) {
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
    this.clearExpire()

    if (this.opts.separatedFile) {
      return this._separated.set(key, value)
    }
    this._data.set(key, value)
    return this.save()
  }

  public async delete(key: string) {
    if (this.opts.separatedFile) {
      return this._separated.delete(key)
    }
    const ret = this._data.delete(key)
    await this.save()
    return ret
  }

  public async deleteMany(keys: string[]): Promise<boolean> {
    if (this.opts.separatedFile) {
      let ret = await Promise.all(keys.map((key) => this.delete(key)))
      return ret.every((r) => r)
    }
    let res = keys.every((key) => this._data.delete(key))
    await this.save()
    return res
  }

  public async clear() {
    if (this.opts.separatedFile) {
      await this._separated.clear()
      this._lastExpire = 0
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

  private _getWithExpire(key: string, data?: WrappedValue) {
    if (!data) {
      return
    }
    if (this.isExpired(data)) {
      this.delete(key)
      return
    }
    return data.value
  }

  private clearExpire() {
    const now = Date.now()
    if (now - this._lastExpire <= this.opts.expiredCheckDelay) {
      return
    }
    this._lastExpire = now
    if (this.opts.separatedFile) {
      this._separated.clearExpire((key) => this.get(key))
      return
    }
    for (const key of this._data.keys()) {
      const data = this._data.get(key)
      this._getWithExpire(key, data)
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
    let entries = this.opts.separatedFile ? await this._separated.entries() : this._data.entries()
    for (const [key, data] of entries) {
      if (key === undefined || data === undefined) {
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
