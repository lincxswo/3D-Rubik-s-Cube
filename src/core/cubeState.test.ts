import { describe, expect, it } from 'vitest'
import {
  COLORS,
  FACES,
  SOLVED_FACE_COLOR,
  STICKERS_PER_FACE,
  STICKER_COUNT,
  countByColor,
  createSolvedState,
  getSticker,
  isSolved,
  type CubeState,
} from './cubeState'

describe('魔方状态', () => {
  it('刚造出来的魔方是"已复原"的', () => {
    expect(isSolved(createSolvedState())).toBe(true)
  })

  it('每种颜色刚好 9 格', () => {
    const counts = countByColor(createSolvedState())
    for (const color of COLORS) {
      expect(counts[color]).toBe(9)
    }
  })

  it('一共 54 格：6 个面，每面 9 格', () => {
    const state = createSolvedState()
    expect(FACES).toHaveLength(6)
    expect(STICKERS_PER_FACE).toBe(9)
    expect(STICKER_COUNT).toBe(54)

    let total = 0
    for (const face of FACES) {
      expect(state.faces[face]).toHaveLength(STICKERS_PER_FACE)
      total += state.faces[face].length
    }
    expect(total).toBe(STICKER_COUNT)
  })

  it('每一面都是纯色，并且用的是标准配色（白上、黄下、绿前、蓝后、红右、橙左）', () => {
    const state = createSolvedState()
    for (const face of FACES) {
      for (let index = 0; index < STICKERS_PER_FACE; index++) {
        expect(getSticker(state, face, index)).toBe(SOLVED_FACE_COLOR[face])
      }
    }
  })

  it('对色关系正确：白对黄、红对橙、蓝对绿', () => {
    const { U, D, F, B, R, L } = SOLVED_FACE_COLOR
    expect([U, D].sort()).toEqual(['white', 'yellow'])
    expect([R, L].sort()).toEqual(['orange', 'red'])
    expect([F, B].sort()).toEqual(['blue', 'green'])
  })

  it('只要有格子颜色不对，就不再是已复原', () => {
    const solved = createSolvedState()
    const dirty: CubeState = {
      faces: { ...solved.faces, U: ['red', ...solved.faces.U.slice(1)] },
    }
    expect(isSolved(dirty)).toBe(false)
  })

  it('颜色种类不合法时，读格子会报错', () => {
    const state = createSolvedState()
    expect(() => getSticker(state, 'U', 99)).toThrow()
  })
})
