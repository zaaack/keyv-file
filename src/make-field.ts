import type Keyv from 'keyv'
import type KeyvFile from './index'

export class Field<T, D extends T | void = T | void> {
  constructor(
    protected kv: KeyvFile | Keyv | Map<string, any>,
    protected key: string,
    protected defaults: D,
  ) {}

  get(): Promise<D>
  get(def: D): Promise<D>
  async get(def = this.defaults) {
    return (await this.kv.get(this.key)) ?? def
  }

  getSync(): D
  getSync(def: D): D
  getSync(def = this.defaults) {
    if (this.kv instanceof Map) {
      return this.kv.get(this.key) ?? def
    } else if ('getSync' in this.kv) {
      return this.kv.getSync<D>(this.key) ?? def
    }
    throw new Error('kv does not support getSync')
  }

  // setSync(def:T) {
  //   if ('setSync' in this.kv) {
  //     return this.kv.setSync(this.key, def) ?? def
  //   }
  //   throw new Error('kv does not support getSync')
  // }
  /**
   * Note: `await kv.someFiled.set()` will wait <options.writeDelay> millseconds to save to disk, it would be slow. Please remove `await` if you find performance issues.
   * @param value
   * @param ttl
   * @returns
   */
  set(val: T, ttl?: number) {
    return this.kv.set(this.key, val, ttl)
  }
  delete() {
    return this.kv.delete(this.key)
  }
}

export function makeField<T = any, D = T>(
  kv: KeyvFile | Keyv | Map<string, any>,
  key: string,
  defaults: T,
): Field<T, T>
export function makeField<T = any, D extends T | void = T | void>(
  kv: KeyvFile | Keyv | Map<string, any>,
  key: string,
  defaults?: D,
) {
  return new Field(kv, key, defaults)
}
