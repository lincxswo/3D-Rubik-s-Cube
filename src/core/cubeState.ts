/**
 * 魔方"状态"—— 这里只存数据，一行 three 的代码都不许出现（画图是 src/render 的事）。
 *
 * 表示方法：把魔方看成 6 个面，每个面 3x3 = 9 格贴纸，一共 54 格。
 * 每格只记一个颜色，不记任何 3D 坐标。
 *
 * 每个面 9 格的编号方式（假设你站在这个面外面正对着它看）：
 *   0 1 2      0 = 左上   4 = 正中间   8 = 右下
 *   3 4 5
 *   6 7 8
 */

/** 6 个面：U 上、D 下、F 前、B 后、R 右、L 左 */
export const FACES = ['U', 'D', 'F', 'B', 'R', 'L'] as const
export type Face = (typeof FACES)[number]

/** 6 种颜色 */
export const COLORS = ['white', 'yellow', 'red', 'orange', 'blue', 'green'] as const
export type Color = (typeof COLORS)[number]

/** 每个面的格数（3x3） */
export const STICKERS_PER_FACE = 9

/** 贴纸总格数：6 个面 x 9 格 = 54 */
export const STICKER_COUNT = FACES.length * STICKERS_PER_FACE

/**
 * 复原状态下每个面是什么颜色（标准配色）：
 * 白上、黄下、绿前、蓝后、红右、橙左。
 * 也就是相对的两个面互为"对色"：白对黄、红对橙、蓝对绿。
 */
export const SOLVED_FACE_COLOR: Readonly<Record<Face, Color>> = {
  U: 'white',
  D: 'yellow',
  F: 'green',
  B: 'blue',
  R: 'red',
  L: 'orange',
}

/** 一个魔方的状态：6 个面，每面 9 个颜色 */
export type CubeState = {
  readonly faces: Readonly<Record<Face, readonly Color[]>>
}

/** 造一个"已复原"的魔方 */
export function createSolvedState(): CubeState {
  const faces = {} as Record<Face, readonly Color[]>
  for (const face of FACES) {
    const color = SOLVED_FACE_COLOR[face]
    faces[face] = Array.from({ length: STICKERS_PER_FACE }, () => color)
  }
  return { faces }
}

/** 读某一面第 index 格（0-8）的颜色 */
export function getSticker(state: CubeState, face: Face, index: number): Color {
  const color = state.faces[face][index]
  if (color === undefined) {
    throw new Error(`没有这一格：面 ${face}，第 ${index} 格`)
  }
  return color
}

/** 数一数每种颜色各有多少格（复原状态下每种应该都是 9 格） */
export function countByColor(state: CubeState): Record<Color, number> {
  const counts = {} as Record<Color, number>
  for (const color of COLORS) {
    counts[color] = 0
  }
  for (const face of FACES) {
    for (const color of state.faces[face]) {
      counts[color] += 1
    }
  }
  return counts
}

/** 判断是否已复原：每个面的 9 格都是同一个颜色 */
export function isSolved(state: CubeState): boolean {
  return FACES.every((face) => {
    const stickers = state.faces[face]
    return stickers.every((color) => color === stickers[0])
  })
}
