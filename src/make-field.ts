import type Keyv from "keyv"
import type KeyvFile from "."

export class Field<T, D extends T | void = T | void> {
  constructor(protected kv: KeyvFile | Keyv, protected key: string, protected defaults: D) {}

  get(): Promise<D>
  get(def: D): Promise<D>
  async get(def = this.defaults) {
    return (await this.kv.get(this.key)) ?? def
  }

  getSync(): D
  getSync(def: D): D
  getSync(def = this.defaults) {
    if ('getSync' in this.kv) {
      return this.kv.getSync<D>(this.key) ?? def
    }
    throw new Error('kv does not support getSync')
  }
  set(val: T, ttl?: number) {
    return this.kv.set(this.key, val, ttl)
  }
  delete() {
    return this.kv.delete(this.key)
  }
}

export function makeField<T = any, D = T>(
  kv: KeyvFile | Keyv,
  key: string,
  defaults: T,
): Field<T, T>
export function makeField<T = any, D extends T | void = T | void>(
  kv: KeyvFile | Keyv,
  key: string,
  defaults?: D,
) {
  return new Field(kv, key, defaults)
}
