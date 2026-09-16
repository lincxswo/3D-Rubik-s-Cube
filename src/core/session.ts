/**
 * 会话：把"魔方现在什么状态 + 这次打乱是什么 + 复原计划走到第几步 + 现在什么模式"
 * 放在一起管理。纯逻辑，不许引入 three —— 界面只是把这里的数据画出来。
 *
 * 为什么规则都写在这里？因为像"复原模式下如果用户强行转动，计划要作废"
 * 这种规则，如果写在界面代码里就没法测了。放在这里，测试可以直接验。
 */

import { createSolvedState, isSolved, type CubeState } from './cubeState'
import type { Move } from './moves'
import { createRestorePlan, invertMove } from './scramble'
import { applyMove, applyMoves } from './turns'

/** idle = 自由模式（可以手动转）；restoring = 复原模式（手动转动按钮置灰） */
export type SessionPhase = 'idle' | 'restoring'

/** 复原模式下用户强行转动时的提示（需求指定的原文） */
export const PLAN_INVALID_NOTICE = '计划已失效，请重新点一键复原'
/** 计划已经作废、没法再用倒推复原时的提示 */
export const PLAN_UNUSABLE_NOTICE = '魔方已经被手动转动过，这份倒推计划不适用了，请重新打乱再复原'
/** 还没打乱就点一键复原时的提示 */
export const NO_SCRAMBLE_NOTICE = '还没有打乱，先点"打乱"再点一键复原'

export type Session = {
  /** 魔方现在的状态 */
  readonly state: CubeState
  /** 这次打乱的步骤（按顺序存下来） */
  readonly scramble: readonly Move[]
  /** 复原计划 = 打乱步骤倒过来反向 */
  readonly plan: readonly Move[]
  /** 复原计划已经走了几步（0 ~ plan.length） */
  readonly cursor: number
  /** 现在是什么模式 */
  readonly phase: SessionPhase
  /** 要显示给用户的提示，没有就是 null */
  readonly notice: string | null
}

/** 开局：复原状态的魔方，没有打乱、没有计划 */
export function createSession(): Session {
  return {
    state: createSolvedState(),
    scramble: [],
    plan: [],
    cursor: 0,
    phase: 'idle',
    notice: null,
  }
}

/**
 * 开始一次打乱：把这次的步骤存下来，按它生成倒推计划，光标归零。
 * 如果在复原模式里又点了打乱，等于重新开始，所以模式也回到自由模式。
 */
export function beginScramble(session: Session, moves: readonly Move[]): Session {
  return {
    ...session,
    scramble: [...moves],
    plan: createRestorePlan(moves),
    cursor: 0,
    phase: 'idle',
    notice: null,
  }
}

/** 打乱动画每走一步调用：只把状态往前推，计划、光标、模式都不动 */
export function advanceState(session: Session, move: Move): Session {
  return { ...session, state: applyMove(session.state, move) }
}

/**
 * 用户手动转一步（界面正常路径）。
 * 关键规则：如果这时候正在复原模式下，说明有人绕过了界面强行转动，
 * 那就立刻把这次转动执行掉，同时把剩下的复原步骤全部作废、退出复原模式、给出提示。
 */
export function manualMove(session: Session, move: Move): Session {
  const state = applyMove(session.state, move)

  if (session.phase === 'restoring') {
    return {
      ...session,
      state,
      plan: [],
      cursor: 0,
      phase: 'idle',
      notice: PLAN_INVALID_NOTICE,
    }
  }

  return { ...session, state, notice: null }
}

/**
 * 从现在这里把剩下的计划走完，能不能正好复原？
 * 能，说明这份倒推计划还有效；不能（比如中途被手动转过），就不能拿它当复原方案。
 */
export function isPlanStillValid(session: Session): boolean {
  if (session.plan.length === 0) {
    return false
  }
  return isSolved(applyMoves(session.state, session.plan.slice(session.cursor)))
}

/**
 * 一键复原：进入复原模式。
 * 注意它只"把计划装填好"，不替用户走路 —— 一步一步走是【下一步】的事。
 */
export function enterRestoreMode(session: Session): Session {
  if (session.phase === 'restoring') {
    return session
  }
  if (session.scramble.length === 0) {
    return { ...session, notice: NO_SCRAMBLE_NOTICE }
  }
  if (!isPlanStillValid(session)) {
    return { ...session, notice: PLAN_UNUSABLE_NOTICE }
  }
  return { ...session, phase: 'restoring', notice: null }
}

/** 退出复原模式。已经走过的进度保留着，再点一次一键复原可以接着走 */
export function exitRestoreMode(session: Session): Session {
  if (session.phase === 'idle') {
    return session
  }
  return { ...session, phase: 'idle', notice: null }
}

/** 下一步：执行计划里的下一步 */
export function stepForward(session: Session): Session {
  if (session.phase !== 'restoring') {
    return session
  }
  const move = session.plan[session.cursor]
  if (move === undefined) {
    return session
  }
  return {
    ...session,
    state: applyMove(session.state, move),
    cursor: session.cursor + 1,
    notice: null,
  }
}

/** 上一步：把刚走的那一步反着走回去（不是"回放旧状态"，是真的反着转一步） */
export function stepBackward(session: Session): Session {
  if (session.phase !== 'restoring') {
    return session
  }
  const previous = session.plan[session.cursor - 1]
  if (previous === undefined) {
    return session
  }
  return {
    ...session,
    state: applyMove(session.state, invertMove(previous)),
    cursor: session.cursor - 1,
    notice: null,
  }
}

/**
 * 进度文字，例如：第 3 / 20 步：R'
 * 含义：已经走完的步数 + 刚刚走的那一步是什么。
 * 一步都还没走时显示"还没开始"。
 */
export function progressText(session: Session): string {
  const total = session.plan.length
  if (total === 0) {
    return '还没有复原计划'
  }
  if (session.cursor === 0) {
    return `第 0 / ${total} 步：还没开始`
  }
  return `第 ${session.cursor} / ${total} 步：${session.plan[session.cursor - 1]}`
}

/** 下一步要做什么，例如：下一步：R'。走完了就返回 null */
export function nextStepText(session: Session): string | null {
  const move = session.plan[session.cursor]
  if (move === undefined) {
    return null
  }
  return `下一步：${move}`
}
