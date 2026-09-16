/**
 * 26 个小方块各自摆在哪、哪一面朝外 —— 纯数学，同样不许引入 three。
 *
 * 坐标系：x 向右、y 向上、z 向前（朝屏幕外）。
 * 每个小方块的坐标都从 {-1, 0, 1} 里取：
 *   x = 1 在最右一层，x = -1 在最左一层，x = 0 在中间一层（y、z 同理）。
 * 3 x 3 x 3 = 27 个位置，去掉正中间那个 (0,0,0)，剩下 26 个。
 *
 * 6 个面和方向一一对应（和 cubeState 里的 6 个面同名）：
 *   U 朝上(+y)  D 朝下(-y)  R 朝右(+x)  L 朝左(-x)  F 朝前(+z)  B 朝后(-z)
 */

import { FACES, getSticker, type Color, type CubeState, type Face } from './cubeState'

/** 小方块的位置：x、y、z 三个数，取值只能是 -1、0、1 */
export type CubiePosition = readonly [x: number, y: number, z: number]

/** 一共 26 个小方块（3x3x3 去掉正中间看不见的那个） */
export const CUBIE_COUNT = 26

/** 每个面朝向哪一边 */
export const FACE_NORMAL: Readonly<Record<Face, CubiePosition>> = {
  U: [0, 1, 0],
  D: [0, -1, 0],
  R: [1, 0, 0],
  L: [-1, 0, 0],
  F: [0, 0, 1],
  B: [0, 0, -1],
}

const LAYER_COORDS = [-1, 0, 1] as const

/** 26 个小方块的位置列表（不含正中间的 (0,0,0)） */
export const CUBIE_POSITIONS: readonly CubiePosition[] = (() => {
  const positions: CubiePosition[] = []
  for (const x of LAYER_COORDS) {
    for (const y of LAYER_COORDS) {
      for (const z of LAYER_COORDS) {
        if (x === 0 && y === 0 && z === 0) continue
        positions.push([x, y, z])
      }
    }
  }
  return positions
})()

/**
 * 这个小方块哪几个面是露在外面的。
 * 判断方法：它正好贴在这一面的最外层，才算朝外
 *   —— 角块露出 3 面，棱块 2 面，每面正中间那块只露 1 面。
 */
export function outwardFaces(position: CubiePosition): Face[] {
  const [x, y, z] = position
  return FACES.filter((face) => {
    const [nx, ny, nz] = FACE_NORMAL[face]
    return x * nx + y * ny + z * nz === 1
  })
}

/**
 * 小方块朝外的某一面，对应 cubeState 里那个面的第几格（0-8）。
 * 规则就是文件开头说的"站在那个面外面正对着看，从左上到右下编号"。
 */
export function stickerIndexFor(position: CubiePosition, face: Face): number {
  const [x, y, z] = position
  switch (face) {
    case 'U':
      return (z + 1) * 3 + (x + 1)
    case 'D':
      return (1 - z) * 3 + (x + 1)
    case 'F':
      return (1 - y) * 3 + (x + 1)
    case 'B':
      return (1 - y) * 3 + (1 - x)
    case 'R':
      return (1 - y) * 3 + (1 - z)
    case 'L':
      return (1 - y) * 3 + (z + 1)
  }
  throw new Error(`不认识的面：${face}`)
}

/** 把"方向"翻译回"面"（例如 [1,0,0] 就是 R 面） */
export function faceFromNormal(normal: CubiePosition): Face {
  const face = FACES.find((candidate) => {
    const [nx, ny, nz] = FACE_NORMAL[candidate]
    return nx === normal[0] && ny === normal[1] && nz === normal[2]
  })
  if (face === undefined) {
    throw new Error(`这个方向不对应任何一面：${normal.join(',')}`)
  }
  return face
}

/**
 * 把某个方向绕着一个面转 90°：站在那个面外面看是顺时针。
 *
 * 为什么这么算：从外面看是顺时针，按右手定则就是绕着外法线转 -90°，
 * 写成公式就是 v' = n(n·v) - n×v（n 是那个面的外法线）。
 * 这一条数学既用来转"魔方数据"，也用来转"画面里的方块"，所以两边永远一致。
 */
export function rotateClockwise(vector: CubiePosition, axis: Face): CubiePosition {
  const [x, y, z] = vector
  const [nx, ny, nz] = FACE_NORMAL[axis]
  const crossX = ny * z - nz * y
  const crossY = nz * x - nx * z
  const crossZ = nx * y - ny * x
  const dot = nx * x + ny * y + nz * z
  return [dot * nx - crossX, dot * ny - crossY, dot * nz - crossZ]
}

/** 这个小方块是不是在"转某一面时会跟着动"的那一层里 */
export function isInLayer(position: CubiePosition, face: Face): boolean {
  const [nx, ny, nz] = FACE_NORMAL[face]
  return position[0] * nx + position[1] * ny + position[2] * nz === 1
}

/** 转某一面时，会跟着动的那 9 个小方块的位置 */
export function layerPositions(face: Face): CubiePosition[] {
  return CUBIE_POSITIONS.filter((position) => isInLayer(position, face))
}

/** 一个小方块露在外面的某一面，该是什么颜色 */
export type CubieSticker = {
  readonly face: Face
  readonly color: Color
}

/**
 * 把"状态"翻译成"每个小方块露出来的每一面是什么颜色"。
 * 画图的人只认这个结果，不需要懂状态里的编号规则。
 */
export function cubieStickers(state: CubeState, position: CubiePosition): CubieSticker[] {
  return outwardFaces(position).map((face) => ({
    face,
    color: getSticker(state, face, stickerIndexFor(position, face)),
  }))
}
