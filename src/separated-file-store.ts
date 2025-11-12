import path from 'path'

import * as os from 'os'
import * as fs from 'fs'
import * as fsp from 'fs/promises'
import type { Options, WrappedValue } from './index'
import { SafeFilenameEncoder } from './safe-encoder'

export function handleIOError(e: any) {
  if (e.code === 'ENOENT') {
    return
  } else {
    console.error(e)
  }
}
export class SeparatedFileHelper {
  get lockFile() {
    return path.join(this.opts.filename, '.lock')
  }
  private get _lastExpireFile() {
    return path.join(this.opts.filename, '.lastExpire')
  }
  constructor(private opts: Options) {
  }

  getLastExpire() {
    try {
      return Number(fs.readFileSync(this._lastExpireFile, 'utf8'))
    } catch (error) {
      handleIOError(error)
    }
    return 0
  }

  setLastExpire(expire: number) {
    try {
      fsp.writeFile(this._lastExpireFile, expire.toString())
    } catch (error) {
      handleIOError(error)
    }
  }

  async get<T>(key: string) {
    try {
      let rawData = await fsp.readFile(this._getKey(key))
      let data = this.opts.deserialize(rawData) as WrappedValue<T>
      return data
    } catch (error) {
      handleIOError(error)
    }
  }
  /**
   * 根据键获取文件内容
   * @param key - 文件键名，同时也是文件名
   * @returns 返回一个Promise，解析为文件内容
   */
  getSync(key: string) {
    try {
      let rawData = fs.readFileSync(this._getKey(key))
      let data = this.opts.deserialize(rawData) as WrappedValue<any>
      return data
    } catch (error) {
      handleIOError(error)
    }
  }

  private _getKey(key: string) {
    return path.join(this.opts.filename, SafeFilenameEncoder.encode(key))
  }

  async set<T>(key: string, value: WrappedValue<T>) {
    try {
      let rawData = this.opts.serialize(value)
      await fsp.mkdir(this.opts.filename, {
        recursive: true,
      })
      await fsp.writeFile(this._getKey(key), rawData)
    } catch (e) {
      handleIOError(e)
    }
  }
  async delete(key: string) {
    try {
      await fsp.unlink(this._getKey(key))
      return true
    } catch (e) {
      handleIOError(e)
      return false
    }
  }

  async clear() {
    await fsp.rm(this.opts.filename, {
      recursive: true,
      force: true,
    })
  }

  async clearExpire(clearExpire: (key: string) => void) {
    try {
      let keys = await fsp.readdir(this.opts.filename)
      for (const key of keys) {
        clearExpire(key)
      }
      await fsp.writeFile(this._lastExpireFile, Date.now().toString())
    } catch (error) {
      handleIOError(error)
    }
  }

  async entries() {
    return fsp.readdir(this.opts.filename).then((keys) => {
      return Promise.all(
        keys.map(async (key) => {
          key = SafeFilenameEncoder.decode(key)
          return [key, await this.get(key)] as const
        }),
      )
    })
  }
}
