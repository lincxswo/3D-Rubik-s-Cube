/**
 * 转层：魔方真正"动"起来的地方（纯数据，不许引入 three）。
 *
 * 规矩：applyMove 不修改传进来的状态，而是返回一个"新状态"。
 * 为什么？动画播放的那 200 毫秒里，画面显示的是旧状态；
 * 动画结束才换成新状态。两个状态必须同时存在，所以不能改旧的。
 *
 * 转动的算法：把这一层每个小方块的位置、以及它每一面朝外的方向，
 * 一起绕着这根轴转 90°，颜色跟着搬过去。位置和朝向是成对搬的，
 * 所以不会出现"颜色留在原地"这种脏数据。
 */

import {
  FACE_NORMAL,
  cubieStickers,
  faceFromNormal,
  layerPositions,
  rotateClockwise,
  stickerIndexFor,
} from './cubies'
import { FACES, type Color, type CubeState, type Face } from './cubeState'
import { parseMove, type Move } from './moves'

/** 走一步棋（转一次），返回新状态 */
export function applyMove(state: CubeState, move: Move): CubeState {
  const { face, direction } = parseMove(move)
  // 逆时针 90° 就是顺时针转 3 次（结果一样，但只需要写一套逻辑）
  const times = direction === 1 ? 1 : 3
  let result = state
  for (let i = 0; i < times; i++) {
    result = turnClockwise(result, face)
  }
  return result
}

/** 把某一面顺时针拧 90° */
function turnClockwise(state: CubeState, axis: Face): CubeState {
  const faces = {} as Record<Face, Color[]>
  for (const face of FACES) {
    // 先把原来的颜色抄一份，没被动到的格子就保持原样
    faces[face] = [...state.faces[face]]
  }

  for (const position of layerPositions(axis)) {
    const target = rotateClockwise(position, axis)
    for (const sticker of cubieStickers(state, position)) {
      const targetFace = faceFromNormal(rotateClockwise(FACE_NORMAL[sticker.face], axis))
      faces[targetFace][stickerIndexFor(target, targetFace)] = sticker.color
    }
  }

  return { faces }
}
