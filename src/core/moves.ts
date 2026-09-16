/**
 * 转动记号：和魔方圈子里通用的写法完全一致。
 *   U / D / L / R / F / B  = 转哪一面（上/下/左/右/前/后）
 *   不带撇   = 顺时针
 *   带一个撇 = 逆时针
 * 例如 U 是上面顺时针，U' 是上面逆时针。
 *
 * "顺时针"的定义：站在那个面的外面正对着它看，顺时针。
 */

import type { Face } from './cubeState'

/** 12 种转法。数组顺序 = 页面上按钮从左到右的顺序 */
export const MOVES = [
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
] as const

export type Move = (typeof MOVES)[number]

/** 把记号拆开：转哪一面 + 顺时针还是逆时针（1 = 顺时针，-1 = 逆时针） */
export function parseMove(move: Move): { face: Face; direction: 1 | -1 } {
  const face = move[0] as Face
  const direction: 1 | -1 = move.length === 1 ? 1 : -1
  return { face, direction }
}
