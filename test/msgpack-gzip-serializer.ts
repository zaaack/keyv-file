import { Packr, Unpackr } from 'msgpackr'
import { gzipSync, gunzipSync } from 'zlib'
const packr = new Packr({
  // 使用扩展来处理特殊类型
  moreTypes: true,
  // 处理 Date 类型
  structuredClone: false,
})

export const MsgpackGzipSerializer = {
  /**
   * 序列化并压缩数据
   * @param obj 要序列化的对象
   * @returns 压缩后的 Buffer
   */
  serialize(obj) {
    try {
      // 1. 使用 msgpack 序列化
      const packed = packr.pack(obj)

      // 2. 使用 gzip 压缩
      const compressed = gzipSync(packed, {
        level: 6, // 压缩级别 1-9，6 是平衡点
      })

      return compressed
    } catch (error) {
      throw new Error(`Serialization failed: ${error}`)
    }
  },

  /**
   * 解压并反序列化数据
   * @param buffer 压缩后的 Buffer
   * @returns 原始对象
   */
  deserialize(buffer) {
    try {
      // 1. 使用 gzip 解压
      const decompressed = gunzipSync(buffer)

      // 2. 使用 msgpack 反序列化
      const unpacked = packr.unpack(decompressed)

      return unpacked
    } catch (error) {
      throw new Error(`Deserialization failed: ${error}`)
    }
  },
}
