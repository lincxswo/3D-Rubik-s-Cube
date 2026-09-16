import { describe, expect, it } from 'vitest'
import {
  FACE_NORMAL,
  cubieStickers,
  faceFromNormal,
  rotateClockwise,
  type CubiePosition,
} from './cubies'
import {
  COLORS,
  FACES,
  STICKERS_PER_FACE,
  countByColor,
  createSolvedState,
  getSticker,
  isSolved,
  type Color,
  type CubeState,
  type Face,
} from './cubeState'
import { MOVES, parseMove, type Move } from './moves'
import { applyMove } from './turns'

/** 看某个小方块朝外的某一面是什么颜色 */
function colorAt(state: CubeState, position: CubiePosition, face: Face): Color | undefined {
  return cubieStickers(state, position).find((sticker) => sticker.face === face)?.color
}

/** 54 格逐格比对两个状态 */
function expectSameState(actual: CubeState, expected: CubeState): void {
  for (const face of FACES) {
    for (let index = 0; index < STICKERS_PER_FACE; index++) {
      expect(getSticker(actual, face, index)).toBe(getSticker(expected, face, index))
    }
  }
}

/** 固定种子的随机数：测试必须每次都一样，不能用 Math.random */
function makeRandom(seed: number): () => number {
  let value = seed >>> 0
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0
    return value / 4294967296
  }
}

describe('转动记号', () => {
  it('一共 12 个，顺序就是按钮的顺序', () => {
    expect(MOVES).toHaveLength(12)
    expect([...MOVES]).toEqual([
      'U',
      "U'",
      'D',
      "D'",
      'L',
      "L'",
      'R',
      "R'",
      'F',
      "F'",
      'B',
      "B'",
    ])
  })

  it('不带撇是顺时针，带撇是逆时针', () => {
    expect(parseMove('R')).toEqual({ face: 'R', direction: 1 })
    expect(parseMove("R'")).toEqual({ face: 'R', direction: -1 })
  })
})

describe('顺时针方向的约定（最怕搞反的地方）', () => {
  // 顺时针转某个面之后，"前面"这个方向会指向哪儿：
  // U 上面前→左、D 下面顺时针→右、R 右面→上、L 左面→下、F 前面→右、B 后面→左
  const frontGoesTo: Record<Face, Face> = {
    U: 'L',
    D: 'R',
    R: 'U',
    L: 'D',
    F: 'R',
    B: 'L',
  }

  it('每个面顺时针转 90° 时，方向的搬运都和"从外面看是顺时针"一致', () => {
    for (const face of FACES) {
      // 拿"前面"做参照；如果转的正好是前后轴，前面这个方向在轴上转不动，
      // 就改用"上面"做参照
      const reference: CubiePosition = FACE_NORMAL[face][2] === 0 ? [0, 0, 1] : [0, 1, 0]
      expect(faceFromNormal(rotateClockwise(reference, face))).toBe(frontGoesTo[face])
    }
  })

  it('顺时针转上面：前面最上边那排绿色跑到左面，右面最上边那排红色跑到前面', () => {
    const after = applyMove(createSolvedState(), 'U')

    for (const z of [-1, 0, 1]) {
      expect(colorAt(after, [-1, 1, z], 'L')).toBe('green')
    }
    for (const x of [-1, 0, 1]) {
      expect(colorAt(after, [x, 1, 1], 'F')).toBe('red')
    }
    // 上面的中心没动，还是白色
    expect(colorAt(after, [0, 1, 0], 'U')).toBe('white')
  })

  it('转的那一面自己的 9 格也在转', () => {
    const afterR = applyMove(createSolvedState(), 'R')
    // R 顺时针把前面最右边那一列（绿色）转到上面去
    expect(colorAt(afterR, [1, 1, 0], 'U')).toBe('green')

    // 再顺时针转上面，那一格应该从"右"转到"前"
    const afterRU = applyMove(afterR, 'U')
    expect(colorAt(afterRU, [0, 1, 1], 'U')).toBe('green')
  })
})

describe('转一层', () => {
  it('同一个面转 4 次，回到原状态（顺时针、逆时针各验 6 个面）', () => {
    const solved = createSolvedState()

    for (const face of FACES) {
      let clockwise: CubeState = solved
      for (let i = 0; i < 4; i++) {
        clockwise = applyMove(clockwise, face)
      }
      expectSameState(clockwise, solved)

      let counterClockwise: CubeState = solved
      for (let i = 0; i < 4; i++) {
        counterClockwise = applyMove(counterClockwise, `${face}'`)
      }
      expectSameState(counterClockwise, solved)
    }
  })

  it("转一次 R，再转一次 R'，逐格比对和初始状态完全一样", () => {
    const solved = createSolvedState()
    const afterR = applyMove(solved, 'R')

    // 先确认 R 真的把魔方弄乱了，否则下面那句"和初始状态一样"可能是白通过
    expect(isSolved(afterR)).toBe(false)

    expectSameState(applyMove(afterR, "R'"), solved)
  })

  it('随便转一次，每种颜色还是 9 格', () => {
    for (const face of FACES) {
      const counts = countByColor(applyMove(createSolvedState(), face))
      for (const color of COLORS) {
        expect(counts[color]).toBe(9)
      }
    }
  })

  it('随机转 1000 次后，每种颜色仍然刚好 9 格', () => {
    const random = makeRandom(20240607)
    let state = createSolvedState()

    for (let i = 0; i < 1000; i++) {
      const move = MOVES[Math.floor(random() * MOVES.length)] as Move
      state = applyMove(state, move)

      // 每转一次都检查一遍，这样万一某一步出问题能马上定位
      const counts = countByColor(state)
      for (const color of COLORS) {
        expect(counts[color]).toBe(9)
      }
    }

    // 1000 次随机之后不可能碰巧复原
    expect(isSolved(state)).toBe(false)
  })

  it('转动只产生新状态，不会改坏传进去的旧状态（动画期间还要用它）', () => {
    const solved = createSolvedState()
    const after = applyMove(solved, 'R')

    expect(after).not.toBe(solved)
    expectSameState(solved, createSolvedState())
  })
})
