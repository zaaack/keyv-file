import { describe, it, expect } from 'vitest'
import { SafeFilenameEncoder } from '../src/safe-encoder'

describe('SafeFilenameEncoder 中文支持', () => {
  it('应该保留中文字符', () => {
    const chineseText = '中文文件名'
    const encoded = SafeFilenameEncoder.encode(chineseText)
    expect(encoded).toBe('中文文件名')
    const decoded = SafeFilenameEncoder.decode(encoded)
    expect(decoded).toBe(chineseText)
  })

  it('应该编码特殊字符但保留中文', () => {
    const mixedText = '中文/测试:文件*名?'
    const encoded = SafeFilenameEncoder.encode(mixedText)
    const decoded = SafeFilenameEncoder.decode(encoded)
    expect(decoded).toBe(mixedText)
  })

  it('应该处理包含下划线的中文文件名', () => {
    const textWithUnderscore = '中文_测试文件'
    const encoded = SafeFilenameEncoder.encode(textWithUnderscore)
    const decoded = SafeFilenameEncoder.decode(encoded)
    expect(decoded).toBe(textWithUnderscore)
  })

  it('应该处理纯ASCII特殊字符', () => {
    const specialChars = 'test/\\:*?"<>|file'
    const encoded = SafeFilenameEncoder.encode(specialChars)
    const decoded = SafeFilenameEncoder.decode(encoded)
    expect(decoded).toBe(specialChars)
  })

  it('应该处理空字符串', () => {
    const emptyString = ''
    const encoded = SafeFilenameEncoder.encode(emptyString)
    expect(encoded).toBe('')
    const decoded = SafeFilenameEncoder.decode(encoded)
    expect(decoded).toBe(emptyString)
  })

  it('应该处理连续的特殊字符', () => {
    const consecutiveSpecial = 'test**??file'
    const encoded = SafeFilenameEncoder.encode(consecutiveSpecial)
    const decoded = SafeFilenameEncoder.decode(encoded)
    expect(decoded).toBe(consecutiveSpecial)
  })
})
