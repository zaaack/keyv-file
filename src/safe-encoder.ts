/**
 * 跨平台安全文件名编解码器
 * 基于 encodeURIComponent 实现
 */
export const SafeFilenameEncoder = {
  // 编码：将特殊字符转换为安全的文件名
  encode(str: string) {
    return str.replace(/./g, (_)=>{
      const code = _.charCodeAt(0)
      if (code < 0x20 || code > 0x7E) {
        return _
      }
      // 非字母数字字符需要转义
      return '%' + _.charCodeAt(0).toString(16).padStart(2, '0')
    }).replace(/%/g, '_') // 最后把 % 替换为 _
  },

  // 解码：还原原始字符串
  decode(str: string) {
    return decodeURIComponent(str.replace(/_/g, '%'))
  },
}
