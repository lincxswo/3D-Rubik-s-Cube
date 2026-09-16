/**
 * 会话：把"魔方现在什么状态 + 从上次复原以来你做过的每一步 + 复原计划走到第几步 + 什么模式"
 * 放在一起管理。纯逻辑，不许引入 three —— 界面只是把这里的数据画出来。
 *
 * 为什么规则都写在这里？因为像"复原模式下用户强行转动，计划要作废"这种规则，
 * 写在界面代码里就没法测了；放在这里，测试可以直接验。
 *
 * ===== 按实测反馈改过的地方（重要）=====
 * 以前只存"这次的打乱步骤"，复原计划 = 打乱的倒推。这个做法有个致命前提：
 * 打乱之前魔方必须是复原的。只要手动转过一下，打乱前就不是复原状态了，
 * 那时候无论重新打乱多少次，倒推计划都回不到复原 —— 死循环。
 *
 * 现在改成记录"从上次复原以来真正做过的每一步"（打乱的、手动转的，全都记）。
 * 复原计划 = 把这份记录从后往前、每一步反过来。于是：
 *   - 不管中间怎么折腾，一键复原永远能走回复原；
 *   - 复原成功时操作记录自然就空了（每复原一步就是"还掉记录里的最后一步"），
 *     不需要额外写清理逻辑。
 *
 * 不变式（测试里会一直验它）：
 *   把 history 里的步骤从复原状态依次走一遍，必然等于当前的 state。
 */

import { createSolvedState, isSolved, type CubeState } from './cubeState'
import type { Move } from './moves'
import { createRestorePlan, invertMove } from './scramble'
import { applyMove } from './turns'

/** idle = 自由模式（可以手动转）；restoring = 复原模式（手动转动按钮置灰） */
export type SessionPhase = 'idle' | 'restoring'

/** 复原模式下用户强行转动时的提示（需求指定的原文） */
export const PLAN_INVALID_NOTICE = '计划已失效，请重新点一键复原'
/** 魔方本来就是复原状态、没什么可倒推时的提示 */
export const ALREADY_SOLVED_NOTICE = '魔方已经是复原状态，不需要复原'
/** 重置之后的提示 */
export const RESET_NOTICE = '已重置到初始的复原状态'

export type Session = {
  /** 魔方现在的状态 */
  readonly state: CubeState
  /**
   * 从上次复原/重置以来，真正做过的每一步（按顺序）。
   * 复原就是把这份记录从后往前一步步还回去。
   */
  readonly history: readonly Move[]
  /** 最近一次打乱的步骤（单独存一份，以后要显示"打乱序列"时用得上） */
  readonly scramble: readonly Move[]
  /** 本次复原的计划：进复原模式时按 history 算出来的快照（用来显示总步数） */
  readonly plan: readonly Move[]
  /** 复原计划已经走了几步（0 ~ plan.length） */
  readonly cursor: number
  /** 现在是什么模式 */
  readonly phase: SessionPhase
  /** 要显示给用户的提示，没有就是 null */
  readonly notice: string | null
}

/** 开局：复原状态的魔方，没有操作记录、没有计划 */
export function createSession(): Session {
  return {
    state: createSolvedState(),
    history: [],
    scramble: [],
    plan: [],
    cursor: 0,
    phase: 'idle',
    notice: null,
  }
}

/** 重置：一键变回初始的复原状态（操作记录一起清空，等于重新开局） */
export function resetSession(): Session {
  return { ...createSession(), notice: RESET_NOTICE }
}

/**
 * 状态往前走一步，并把这一步记进操作记录。
 * 如果这一步正好把魔方弄回了复原状态，记录直接清空 ——
 * 记录的意义只是"离复原还差哪些步"，已经是复原状态就没必要留着了。
 */
function withMove(session: Session, move: Move): Session {
  const state = applyMove(session.state, move)
  if (isSolved(state)) {
    return { ...session, state, history: [] }
  }
  return { ...session, state, history: [...session.history, move] }
}

/**
 * 开始一次打乱：把这次的步骤单独存一份，并把上一次的复原计划清掉。
 * 注意：操作记录不清空！如果魔方现在不是复原状态，那些历史操作也必须留着，
 * 否则以后就再也倒推不回复原了（这正是以前那个死循环的根源）。
 */
export function beginScramble(session: Session, moves: readonly Move[]): Session {
  return {
    ...session,
    scramble: [...moves],
    plan: [],
    cursor: 0,
    phase: 'idle',
    notice: null,
  }
}

/** 打乱动画每走完一步调用：把状态往前推，并记进操作记录 */
export function scrambleStep(session: Session, move: Move): Session {
  return withMove(session, move)
}

/**
 * 用户手动转一步（界面正常路径）。
 * 关键规则：如果这时候正在复原模式下，说明有人绕过了界面强行转动，
 * 那就立刻把这次转动执行掉，同时把剩下的复原步骤作废、退出复原模式、给出提示。
 * （注意：作废的只是"这一次的计划"，操作记录里留着这一步，
 *   所以重新点一键复原时能算出一份新的、正确的计划。）
 */
export function manualMove(session: Session, move: Move): Session {
  const applied = withMove(session, move)

  if (session.phase === 'restoring') {
    return {
      ...applied,
      plan: [],
      cursor: 0,
      phase: 'idle',
      notice: PLAN_INVALID_NOTICE,
    }
  }

  return { ...applied, notice: null }
}

/**
 * 一键复原：按"从上次复原以来的全部操作"算一份倒推计划，进入复原模式。
 * 它只把计划装填好，不替用户走路 —— 一步一步走是【下一步】的事。
 * 因为计划是按真实操作记录算的，所以永远有效，不会再出现"计划不适用"的死路。
 */
export function enterRestoreMode(session: Session): Session {
  if (session.history.length === 0) {
    return { ...session, plan: [], cursor: 0, phase: 'idle', notice: ALREADY_SOLVED_NOTICE }
  }
  return {
    ...session,
    plan: createRestorePlan(session.history),
    cursor: 0,
    phase: 'restoring',
    notice: null,
  }
}

/** 退出复原模式。已经走过的进度保留着，再点一次一键复原可以接着走 */
export function exitRestoreMode(session: Session): Session {
  if (session.phase === 'idle') {
    return session
  }
  return { ...session, phase: 'idle', notice: null }
}

/**
 * 下一步：把操作记录里的最后一步"还掉"（反着做一次），并从记录里去掉它。
 * 走完最后一步时记录自然变空 —— 这就是"复原成功即清空操作记录"。
 */
export function stepForward(session: Session): Session {
  if (session.phase !== 'restoring') {
    return session
  }
  const pending = session.history[session.history.length - 1]
  if (pending === undefined) {
    return session
  }
  return {
    ...session,
    state: applyMove(session.state, invertMove(pending)),
    history: session.history.slice(0, -1),
    cursor: session.cursor + 1,
    notice: null,
  }
}

/**
 * 上一步：把刚还掉的那一步重新做回去（并重新记回操作记录）。
 * 不是"回放旧状态"，是真的反着转回去，所以来回点也不会出错。
 */
export function stepBackward(session: Session): Session {
  if (session.phase !== 'restoring') {
    return session
  }
  const planned = session.plan[session.cursor - 1]
  if (planned === undefined) {
    return session
  }
  return {
    ...withMove(session, invertMove(planned)),
    cursor: session.cursor - 1,
    notice: null,
  }
}

/**
 * 进度文字，例如：第 3 / 20 步：R'
 * 含义：已经走完的步数 + 刚刚走的那一步是什么。一步都没走时显示"还没开始"。
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
