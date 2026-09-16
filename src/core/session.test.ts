import { describe, expect, it } from 'vitest'
import { createSolvedState, isSolved } from './cubeState'
import { MOVES, type Move } from './moves'
import { createScramble, invertMove } from './scramble'
import {
  ALREADY_SOLVED_NOTICE,
  PLAN_INVALID_NOTICE,
  RESET_NOTICE,
  beginScramble,
  createSession,
  enterRestoreMode,
  exitRestoreMode,
  manualMove,
  nextStepText,
  progressText,
  resetSession,
  scrambleStep,
  stepBackward,
  stepForward,
  type Session,
} from './session'
import { applyMoves } from './turns'

/** 固定种子的随机数：测试必须每次都一样，不能用 Math.random */
function makeRandom(seed: number): () => number {
  let value = seed >>> 0
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0
    return value / 4294967296
  }
}

function randomMove(random: () => number): Move {
  return MOVES[Math.floor(random() * MOVES.length)] as Move
}

/**
 * 最核心的一条不变式，几乎每个测试都会顺手验一下：
 * 把操作记录里的步骤从"复原状态"依次走一遍，必须等于当前状态。
 * 这条一破，说明记录和画面已经对不上了，复原必然错。
 */
function expectHistoryMatchesState(session: Session): void {
  expect(applyMoves(createSolvedState(), session.history).faces).toEqual(session.state.faces)
}

/** 做出一个"已经打乱好了"的会话（默认 20 步，跟界面默认值一样） */
function scrambledSession(steps = 20, seed = 7): Session {
  const moves = createScramble(steps, makeRandom(seed))
  let session = beginScramble(createSession(), moves)
  for (const move of moves) {
    session = scrambleStep(session, move)
  }
  return session
}

/** 一路点下一步直到走完 */
function walkToEnd(session: Session): Session {
  let current = session
  while (current.cursor < current.plan.length) {
    current = stepForward(current)
    expectHistoryMatchesState(current)
  }
  return current
}

describe('打乱之后的会话', () => {
  it('打乱步骤被单独存下来了，同时每一步都进了操作记录', () => {
    const session = scrambledSession(20)

    expect(session.scramble).toHaveLength(20)
    expect(session.history).toHaveLength(20)
    expect(session.cursor).toBe(0)
    expect(session.phase).toBe('idle')
    expect(isSolved(session.state)).toBe(false)
    expectHistoryMatchesState(session)
  })

  it('再次打乱不会丢掉之前的操作记录（这是以前死循环的根源）', () => {
    let session = createSession()
    session = manualMove(session, 'R')
    session = manualMove(session, "U'")

    const moves = createScramble(5, makeRandom(2))
    session = beginScramble(session, moves)
    for (const move of moves) {
      session = scrambleStep(session, move)
    }

    // 2 步手动 + 5 步打乱，全都留着
    expect(session.history).toHaveLength(7)
    expect(session.scramble).toHaveLength(5)
    expectHistoryMatchesState(session)
  })
})

describe('一键复原', () => {
  it('只是按操作记录算好计划并进入复原模式，不会替你走路', () => {
    const scrambled = scrambledSession(20)
    const restoring = enterRestoreMode(scrambled)

    expect(restoring.phase).toBe('restoring')
    expect(restoring.cursor).toBe(0)
    expect(restoring.plan).toHaveLength(20)
    // 魔方本身一动不动
    expect(restoring.state.faces).toEqual(scrambled.state.faces)
  })

  it('魔方本来就是复原状态时，给出提示而不是乱复原', () => {
    const result = enterRestoreMode(createSession())
    expect(result.phase).toBe('idle')
    expect(result.notice).toBe(ALREADY_SOLVED_NOTICE)
  })

  it('【回归】手动转过之后再打乱，依然能一路复原（以前这里会死循环）', () => {
    let session = createSession()
    session = manualMove(session, 'R')
    session = manualMove(session, "U'")
    expectHistoryMatchesState(session)

    const moves = createScramble(8, makeRandom(3))
    session = beginScramble(session, moves)
    for (const move of moves) {
      session = scrambleStep(session, move)
    }
    expectHistoryMatchesState(session)

    // 以前这里会提示"这份倒推计划不适用了"，然后不管重新打乱多少次都回不到复原
    session = enterRestoreMode(session)
    expect(session.phase).toBe('restoring')
    expect(session.plan).toHaveLength(10) // 2 步手动 + 8 步打乱，全都要还回去

    session = walkToEnd(session)
    expect(isSolved(session.state)).toBe(true)
    expect(session.history).toHaveLength(0)
  })

  it('【回归】中途退出复原模式、再手动转几下，照样能一路复原', () => {
    let session = enterRestoreMode(scrambledSession(10))
    session = stepForward(session)
    session = stepForward(session)
    session = exitRestoreMode(session)
    session = manualMove(session, 'F')
    session = manualMove(session, "L'")

    session = enterRestoreMode(session)
    expect(session.phase).toBe('restoring')

    session = walkToEnd(session)
    expect(isSolved(session.state)).toBe(true)
  })
})

describe('一步一步复原', () => {
  it('走完全部 20 步，魔方复原，而且操作记录被清空', () => {
    let session = enterRestoreMode(scrambledSession(20))

    for (let i = 0; i < 20; i++) {
      session = stepForward(session)
      expect(session.cursor).toBe(i + 1)
      expectHistoryMatchesState(session)
    }

    expect(isSolved(session.state)).toBe(true)
    // 每一步都是"还掉记录里的一步"，所以走完记录自然就空了
    expect(session.history).toHaveLength(0)
    expect(progressText(session)).toBe(`第 20 / 20 步：${session.plan[19]}`)
  })

  it('上一步能一步步退回刚打乱的样子，操作记录也跟着长回来', () => {
    const scrambled = scrambledSession(20)
    let session = walkToEnd(enterRestoreMode(scrambled))
    expect(session.history).toHaveLength(0)

    for (let i = 0; i < 20; i++) {
      session = stepBackward(session)
      expectHistoryMatchesState(session)
    }

    expect(session.cursor).toBe(0)
    expect(session.history).toHaveLength(20)
    // 逐格比对：和刚刚打乱完的状态完全一样
    expect(session.state.faces).toEqual(scrambled.state.faces)
  })

  it('走完最后一步之后再点下一步，什么都不会发生', () => {
    let session = enterRestoreMode(scrambledSession(5))
    for (let i = 0; i < 5; i++) {
      session = stepForward(session)
    }
    expect(stepForward(session)).toBe(session)
  })

  it('在第 0 步点上一步，什么都不会发生', () => {
    const session = enterRestoreMode(scrambledSession(5))
    expect(stepBackward(session)).toBe(session)
  })

  it('不在复原模式时，上一步/下一步都不起作用', () => {
    const session = scrambledSession(5)
    expect(stepForward(session)).toBe(session)
    expect(stepBackward(session)).toBe(session)
  })
})

describe('复原模式', () => {
  it('退出之后进度还留着，再点一键复原能接着走', () => {
    let session = enterRestoreMode(scrambledSession(20))
    session = stepForward(session)
    session = stepForward(session)
    session = stepForward(session)

    const exited = exitRestoreMode(session)
    expect(exited.phase).toBe('idle')
    expect(exited.cursor).toBe(3)

    const reentered = enterRestoreMode(exited)
    expect(reentered.phase).toBe('restoring')
    expect(reentered.cursor).toBe(0)
    // 重新算出来的计划 = 剩下的 17 步
    expect(reentered.plan).toHaveLength(17)

    const finished = walkToEnd(reentered)
    expect(isSolved(finished.state)).toBe(true)
  })

  it('复原模式里重新点打乱：退出复原模式，旧记录留着、新打乱接着记', () => {
    let session = enterRestoreMode(scrambledSession(20))
    session = stepForward(session)

    const newMoves = createScramble(5, makeRandom(99))
    session = beginScramble(session, newMoves)
    for (const move of newMoves) {
      session = scrambleStep(session, move)
    }

    expect(session.phase).toBe('idle')
    expect(session.cursor).toBe(0)
    expect(session.scramble).toHaveLength(5)
    expect(session.history).toHaveLength(24) // 还差 19 步 + 新打乱 5 步
    expectHistoryMatchesState(session)
  })
})

describe('底层容错：绕过界面强行转动', () => {
  it('复原模式下强行转动：这一步立刻生效、计划作废、退出复原模式、给出提示', () => {
    const before = scrambledSession(20)
    const forced = manualMove(enterRestoreMode(before), 'R')

    expect(forced.phase).toBe('idle')
    expect(forced.plan).toHaveLength(0)
    expect(forced.cursor).toBe(0)
    expect(forced.notice).toBe(PLAN_INVALID_NOTICE)
    // 用户这一下真的转上去了
    expect(forced.state.faces).toEqual(applyMoves(before.state, ['R']).faces)
    // 而且这一步被记进了操作记录，所以以后还能倒推掉
    expect(forced.history).toHaveLength(21)
    expectHistoryMatchesState(forced)
  })

  it('【重点】作废之后重新点一键复原，会算出一份新的、真的能复原的计划', () => {
    let session = manualMove(enterRestoreMode(scrambledSession(20)), 'R')
    expect(session.notice).toBe(PLAN_INVALID_NOTICE)

    session = enterRestoreMode(session)
    expect(session.phase).toBe('restoring')
    expect(session.notice).toBeNull()
    expect(session.plan).toHaveLength(21) // 20 步打乱 + 用户强行那一下

    session = walkToEnd(session)
    expect(isSolved(session.state)).toBe(true)
  })

  it('自由模式下正常手动转动不会弹提示', () => {
    const session = manualMove(createSession(), 'R')
    expect(session.notice).toBeNull()
    expect(session.phase).toBe('idle')
  })

  it('手动转回复原状态时，操作记录自动清空', () => {
    let session = manualMove(createSession(), 'R')
    expect(session.history).toHaveLength(1)

    session = manualMove(session, "R'")
    expect(isSolved(session.state)).toBe(true)
    expect(session.history).toHaveLength(0)
  })
})

describe('重置', () => {
  it('一键回到初始复原状态，操作记录和计划一起清空', () => {
    let session = scrambledSession(20)
    session = manualMove(session, 'R')
    session = stepForward(enterRestoreMode(session))

    const reset = resetSession()

    expect(isSolved(reset.state)).toBe(true)
    expect(reset.history).toHaveLength(0)
    expect(reset.plan).toHaveLength(0)
    expect(reset.scramble).toHaveLength(0)
    expect(reset.cursor).toBe(0)
    expect(reset.phase).toBe('idle')
    expect(reset.notice).toBe(RESET_NOTICE)

    // 原来那个会话不受影响（重置是产生一个新会话，不是改旧的）
    expect(isSolved(session.state)).toBe(false)
  })

  it('重置之后一切照旧能玩：打乱 → 复原', () => {
    let session = resetSession()
    const moves = createScramble(6, makeRandom(11))
    session = beginScramble(session, moves)
    for (const move of moves) {
      session = scrambleStep(session, move)
    }

    session = enterRestoreMode(session)
    session = walkToEnd(session)
    expect(isSolved(session.state)).toBe(true)
  })
})

describe('进度文字', () => {
  it('格式是 "第 3 / 20 步：R\'"', () => {
    let session = enterRestoreMode(scrambledSession(20))
    expect(progressText(session)).toBe('第 0 / 20 步：还没开始')

    session = stepForward(session)
    session = stepForward(session)
    session = stepForward(session)

    expect(progressText(session)).toBe(`第 3 / 20 步：${session.plan[2]}`)
    expect(progressText(session)).toMatch(/^第 3 \/ 20 步：[UDLRFB]'?$/)
  })

  it('没有计划的时候明说没有计划', () => {
    expect(progressText(createSession())).toBe('还没有复原计划')
  })

  it('下一步提示：没走完时给下一步，走完了给 null', () => {
    let session = enterRestoreMode(scrambledSession(3))
    expect(nextStepText(session)).toBe(`下一步：${session.plan[0]}`)

    session = walkToEnd(session)
    expect(nextStepText(session)).toBeNull()
  })

  it('计划的每一步都等于操作记录里对应那一步的反向', () => {
    const scrambled = scrambledSession(20)
    const restoring = enterRestoreMode(scrambled)

    for (let i = 0; i < restoring.plan.length; i++) {
      const historyMove = scrambled.history[scrambled.history.length - 1 - i] as Move
      expect(restoring.plan[i]).toBe(invertMove(historyMove))
    }
  })
})

describe('随机乱操作压力测试', () => {
  it('乱来 400 次：操作记录和魔方状态永远对得上，而且随时都能一键复原', () => {
    const random = makeRandom(20240607)
    let session = createSession()

    for (let i = 0; i < 400; i++) {
      const dice = random()
      if (dice < 0.35) {
        session = manualMove(session, randomMove(random)) // 手动乱转
      } else if (dice < 0.6) {
        const moves = createScramble(1, random)
        session = scrambleStep(session, moves[0] as Move) // 一步打乱
      } else if (dice < 0.85) {
        session = stepForward(enterRestoreMode(session)) // 复原模式走一步
      } else {
        session = resetSession() // 重置
      }

      // 不管怎么折腾，这一条必须永远成立
      expectHistoryMatchesState(session)
    }

    // 折腾完，一键复原必须真的能走回复原
    session = enterRestoreMode(session)
    session = walkToEnd(session)
    expect(isSolved(session.state)).toBe(true)
    expect(session.history).toHaveLength(0)
  })
})
