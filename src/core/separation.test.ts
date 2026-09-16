import { describe, expect, it } from 'vitest'

/**
 * 把"状态和渲染分开"这条规矩变成测试。
 * 以后往 src/core 里加文件时，只要一不小心引入了 three（或者反过来去引用渲染代码），
 * 这个测试就会红，提醒你越界了。
 *
 * 这里用 Vite 自带的 import.meta.glob 把 src/core 下所有 .ts 的源码当纯文本读进来，
 * 好处是不需要 Node 的文件系统类型定义，也多装一个依赖。
 */

const SRC_FILE = /\.ts$/
const TEST_FILE = /\.test\.ts$/

const coreSources = import.meta.glob('./*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const coreFiles = Object.entries(coreSources).filter(
  ([path]) => SRC_FILE.test(path) && !TEST_FILE.test(path),
)

describe('core 与渲染的分工', () => {
  it('src/core 里确实有文件（防止这个测试被写空）', () => {
    expect(coreFiles.length).toBeGreaterThan(0)
  })

  it('src/core 里的文件不许引入 three，也不许引用渲染代码', () => {
    for (const [path, source] of coreFiles) {
      expect(source, path).not.toMatch(/from\s+['"]three/)
      expect(source).not.toMatch(/require\(\s*['"]three/)
      expect(source).not.toMatch(/from\s+['"][^'"]*\/render\//)
    }
  })
})
