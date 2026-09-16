import { describe, expect, it } from 'vitest'
import {
  CUBIE_COUNT,
  CUBIE_POSITIONS,
  cubieStickers,
  outwardFaces,
  stickerIndexFor,
  type CubiePosition,
} from './cubies'
import { FACES, SOLVED_FACE_COLOR, createSolvedState, getSticker } from './cubeState'

describe('26 个小方块', () => {
  it('正好 26 个，而且没有正中间那个看不见的方块', () => {
    expect(CUBIE_COUNT).toBe(26)
    expect(CUBIE_POSITIONS).toHaveLength(26)
    expect(CUBIE_POSITIONS).not.toContainEqual([0, 0, 0])
  })

  it('每个方块的坐标都只能是 -1、0、1', () => {
    for (const [x, y, z] of CUBIE_POSITIONS) {
      for (const value of [x, y, z]) {
        expect([-1, 0, 1]).toContain(value)
      }
    }
  })

  it('8 个角块露 3 面、12 个棱块露 2 面、6 个面心块露 1 面', () => {
    const countByOutwardFaces = new Map<number, number>()
    for (const position of CUBIE_POSITIONS) {
      const count = outwardFaces(position).length
      countByOutwardFaces.set(count, (countByOutwardFaces.get(count) ?? 0) + 1)
    }
    expect(countByOutwardFaces.get(3)).toBe(8)
    expect(countByOutwardFaces.get(2)).toBe(12)
    expect(countByOutwardFaces.get(1)).toBe(6)
  })

  it('54 格贴纸不重不漏：每个面的第 0-8 格都刚好被用到一次', () => {
    const used: string[] = []
    for (const position of CUBIE_POSITIONS) {
      for (const face of outwardFaces(position)) {
        used.push(`${face}${stickerIndexFor(position, face)}`)
      }
    }
    expect(used).toHaveLength(54)
    expect(new Set(used).size).toBe(54)

    for (const face of FACES) {
      for (let index = 0; index < 9; index++) {
        expect(used).toContain(`${face}${index}`)
      }
    }
  })

  it('复原状态下，每个方块露出来的颜色就是它贴着的那一面的颜色', () => {
    const state = createSolvedState()
    for (const position of CUBIE_POSITIONS) {
      for (const sticker of cubieStickers(state, position)) {
        expect(sticker.color).toBe(SOLVED_FACE_COLOR[sticker.face])
        expect(sticker.color).toBe(
          getSticker(state, sticker.face, stickerIndexFor(position, sticker.face)),
        )
      }
    }
  })

  it('右上前那个角块露出来的是 上/前/右 三面，颜色是 白/绿/红', () => {
    const corner: CubiePosition = [1, 1, 1]
    expect([...outwardFaces(corner)].sort()).toEqual(['F', 'R', 'U'])
    expect(cubieStickers(createSolvedState(), corner).map((s) => s.color).sort()).toEqual([
      'green',
      'red',
      'white',
    ])
  })

  it('面心块（比如上面正中间）只露一个面', () => {
    const center: CubiePosition = [0, 1, 0]
    const stickers = cubieStickers(createSolvedState(), center)
    expect(stickers).toHaveLength(1)
    expect(stickers[0]?.face).toBe('U')
    expect(stickers[0]?.color).toBe('white')
  })
})
