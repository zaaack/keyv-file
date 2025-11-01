/**
 * 跨平台安全文件名编解码器
 * 基于 encodeURIComponent 实现
 */

export const SafeFilenameEncoder = {
  // 编码：将特殊字符转换为安全的文件名
  encode(str: string) {
    return encodeURIComponent(str)
      .replace(/_/g, '%5F')
      .replace(/!/g, '%21')
      .replace(/~/g, '%7E')
      .replace(/\*/g, '%2A')
      .replace(/'/g, '%27')
      .replace(/\(/g, '%28')
      .replace(/\)/g, '%29')
      .replace(/\./g, '%2E')
      .replace(/%/g, '_') // 最后把 % 替换为 _
  },

  // 解码：还原原始字符串
  decode(str: string) {
    return decodeURIComponent(str.replace(/_/g, '%'))
  },
}
