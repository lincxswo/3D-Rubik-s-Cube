import { describe, expect, it } from 'vitest'
import { Scene } from 'three'

describe('项目自检', () => {
  it('测试框架能跑：1 + 1 = 2', () => {
    expect(1 + 1).toBe(2)
  })

  it('three.js 能加载：可以创建一个场景', () => {
    expect(new Scene()).toBeInstanceOf(Scene)
  })
})
