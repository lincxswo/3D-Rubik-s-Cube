/**
 * 打乱：生成随机步骤，以及把一堆步骤"倒过来反向"当复原计划用。
 * 纯逻辑，不许引入 three。
 */

import type { Face } from './cubeState'
import { MOVES, parseMove, type Move } from './moves'

/** 打乱步数最少 1 步 */
export const MIN_SCRAMBLE_STEPS = 1
/** 打乱步数最多 30 步 */
export const MAX_SCRAMBLE_STEPS = 30
/** 默认 20 步 */
export const DEFAULT_SCRAMBLE_STEPS = 20

/**
 * 把用户填的数字夹到 1~30 之间。
 * 填了乱七八糟的东西（空、字母）就用默认的 20。
 */
export function normalizeStepCount(input: number | string): number {
  const value = typeof input === 'number' ? input : Number.parseInt(input, 10)
  if (!Number.isFinite(value)) {
    return DEFAULT_SCRAMBLE_STEPS
  }
  return Math.min(MAX_SCRAMBLE_STEPS, Math.max(MIN_SCRAMBLE_STEPS, Math.trunc(value)))
}

/**
 * 随机生成一串打乱步骤。
 * 唯一的限制（按需求）：不许连续两次转同一个面 —— 那样的打乱没有意义，还会互相抵消。
 * random 参数是为了测试能塞固定的假随机数，平时不用传。
 */
export function createScramble(
  steps: number,
  random: () => number = Math.random,
): Move[] {
  const total = normalizeStepCount(steps)
  const moves: Move[] = []
  let previousFace: Face | null = null

  for (let i = 0; i < total; i++) {
    // 从"面和上一面不同"的候选里挑，这样天然不可能连续同面
    const candidates = MOVES.filter((move) => parseMove(move).face !== previousFace)
    const picked = candidates[Math.floor(random() * candidates.length)] as Move
    moves.push(picked)
    previousFace = parseMove(picked).face
  }

  return moves
}

/** 把一个记号反过来：R 变 R'，R' 变 R */
export function invertMove(move: Move): Move {
  return (move.endsWith("'") ? move[0] : `${move}'`) as Move
}

/**
 * 倒推计划：把做过的步骤倒着排，每一步也反过来。
 * 例如打乱是 U R'，计划就是 R U' —— 走完计划正好抵消，回到复原状态。
 */
export function createRestorePlan(moves: readonly Move[]): Move[] {
  return [...moves].reverse().map(invertMove)
}
