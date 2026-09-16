import { describe, expect, it } from 'vitest'
import { CUBIE_POSITIONS, isInLayer, layerPositions, type CubiePosition } from '../core/cubies'
import { FACES, type Face } from '../core/cubeState'
import { MOVES, parseMove } from '../core/moves'
import {
  CUBIE_SIZE,
  CUBIE_SPACING,
  OUTLINE_SIZE,
  stickerHighlight,
  type StickerHighlight,
} from './highlight'

/** 把位置变成好比较的字符串 */
function key(position: CubiePosition): string {
  return position.join(',')
}

function positionsWithShade(face: Face | null, shade: StickerHighlight): CubiePosition[] {
  return CUBIE_POSITIONS.filter((position) => stickerHighlight(position, face) === shade)
}

describe('按钮 ↔ 魔方面 的对应关系', () => {
  it('12 个按钮正好覆盖 6 个面，每个面两个按钮（顺时针 + 逆时针）', () => {
    const faces = MOVES.map((move) => parseMove(move).face)

    expect(faces).toHaveLength(12)
    expect(new Set(faces).size).toBe(6)
    for (const face of FACES) {
      expect(faces.filter((candidate) => candidate === face)).toHaveLength(2)
    }
  })

  it('带撇的按钮和不带撇的指向同一个面（R 和 R\' 都是右面）', () => {
    for (const face of FACES) {
      expect(parseMove(face).face).toBe(face)
      expect(parseMove(`${face}'`).face).toBe(face)
    }
  })
})

describe('悬停高亮的画面规则', () => {
  it('没悬停时所有小方块都是正常颜色（所以移开鼠标不可能留痕迹）', () => {
    for (const position of CUBIE_POSITIONS) {
      expect(stickerHighlight(position, null)).toBe('normal')
    }
  })

  it('悬停某个面时：正好 9 个小方块发光，其余 17 个变暗', () => {
    for (const face of FACES) {
      const glowing = positionsWithShade(face, 'glow')
      const dimmed = positionsWithShade(face, 'dim')

      expect(glowing).toHaveLength(9)
      expect(dimmed).toHaveLength(17)
      expect(new Set(glowing.map(key)).size).toBe(9)
      // 一个方块只能有一种状态，不能既发光又变暗
      expect(new Set([...glowing, ...dimmed].map(key)).size).toBe(26)
    }
  })

  it('发光的那 9 个，正好就是转动这个面时会跟着动的那一层', () => {
    for (const face of FACES) {
      const glowing = positionsWithShade(face, 'glow').map(key)
      const layer = layerPositions(face).map(key)
      expect(glowing).toEqual(layer)
    }
  })

  it('从 U 切到 R 之后，U 那一层里不再发光的部分立刻回到变暗（不残留）', () => {
    const overlapping = new Set(layerPositions('R').map(key))

    for (const position of layerPositions('U')) {
      const shade = stickerHighlight(position, 'R')
      if (overlapping.has(key(position))) {
        // 这个棱块同时在 U 层和 R 层里，悬停 R 时它照样发光，这是对的
        expect(shade).toBe('glow')
      } else {
        // 其余原本因为 U 而发光的，必须已经灭了
        expect(shade).toBe('dim')
      }
    }
  })

  it('连续快速划过多个面，画面只反映最后停下的那个面（不残留）', () => {
    const hovered: Face[] = ['U', 'R', 'F', 'L', 'D', 'B', 'R', 'U']

    // 界面每划过一次按钮，都会拿"当前指着的面"整体重算一遍
    let assignment = new Map<string, StickerHighlight>()
    for (const face of hovered) {
      assignment = new Map(CUBIE_POSITIONS.map((position) => [key(position), stickerHighlight(position, face)]))
    }

    // 最后停在 U 上：此刻发光的必须正好是 U 那一层，一步都不能多
    const glowingNow = [...assignment.entries()]
      .filter(([, shade]) => shade === 'glow')
      .map(([position]) => position)
      .sort()
    expect(glowingNow).toEqual(layerPositions('U').map(key).sort())

    // 移开鼠标：26 个方块全部回到正常颜色
    const afterLeave = CUBIE_POSITIONS.map((position) => stickerHighlight(position, null))
    expect(afterLeave.every((shade) => shade === 'normal')).toBe(true)
  })

  it('isInLayer 和 layerPositions 说的是同一件事', () => {
    for (const face of FACES) {
      const byLayer = layerPositions(face).map(key)
      const byCheck = CUBIE_POSITIONS.filter((position) => isInLayer(position, face)).map(key)
      expect(byCheck).toEqual(byLayer)
    }
  })
})

describe('描边和发光必须是同一批方块', () => {
  it('发光的那 9 个正好就是描边会画上去的那 9 个（两者不可能对不上）', () => {
    for (const face of FACES) {
      const glowing = positionsWithShade(face, 'glow')
      const outlined = CUBIE_POSITIONS.filter((position) => isInLayer(position, face))
      expect(outlined).toEqual(glowing)
    }
  })

  it('描边尺寸：比方块大（不打架）、比格位小（不插进邻居）', () => {
    expect(OUTLINE_SIZE).toBeGreaterThan(CUBIE_SIZE)
    expect(OUTLINE_SIZE).toBeLessThan(CUBIE_SPACING)
  })
})
