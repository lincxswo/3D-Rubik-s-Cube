import { describe, expect, it } from 'vitest'
import { isSolved } from './cubeState'
import type { Move } from './moves'
import { createScramble, invertMove } from './scramble'
import {
  NO_SCRAMBLE_NOTICE,
  PLAN_INVALID_NOTICE,
  PLAN_UNUSABLE_NOTICE,
  advanceState,
  beginScramble,
  createSession,
  enterRestoreMode,
  exitRestoreMode,
  isPlanStillValid,
  manualMove,
  nextStepText,
  progressText,
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

/** 做出一个"已经打乱好了"的会话（20 步，跟界面默认值一样） */
function scrambledSession(steps = 20, seed = 7): Session {
  const moves = createScramble(steps, makeRandom(seed))
  let session = beginScramble(createSession(), moves)
  for (const move of moves) {
    session = advanceState(session, move)
  }
  return session
}

describe('打乱之后的会话', () => {
  it('步骤被存下来了，计划是它的倒推，光标归零', () => {
    const session = scrambledSession(20)

    expect(session.scramble).toHaveLength(20)
    expect(session.plan).toHaveLength(20)
    expect(session.cursor).toBe(0)
    expect(session.phase).toBe('idle')

    // 计划的最后一步 = 打乱第一步的反向（倒着来）
    expect(session.plan[19]).toBe(invertMove(session.scramble[0] as Move))
    // 计划的第一步 = 打乱最后一步的反向
    expect(session.plan[0]).toBe(invertMove(session.scramble[19] as Move))
  })

  it('打乱之后魔方确实乱了，而且这份计划是有效的', () => {
    const session = scrambledSession(20)
    expect(isSolved(session.state)).toBe(false)
    expect(isPlanStillValid(session)).toBe(true)
  })
})

describe('一步一步复原', () => {
  it('走完全部 20 步，魔方复原了', () => {
    let session = enterRestoreMode(scrambledSession(20))
    const total = session.plan.length

    for (let i = 0; i < total; i++) {
      session = stepForward(session)
      expect(session.cursor).toBe(i + 1)
    }

    expect(session.cursor).toBe(20)
    expect(isSolved(session.state)).toBe(true)
    expect(progressText(session)).toBe(`第 20 / 20 步：${session.plan[19]}`)
  })

  it('上一步能一步步退回刚打乱的样子', () => {
    const scrambled = scrambledSession(20)
    let session = enterRestoreMode(scrambled)

    for (let i = 0; i < 20; i++) {
      session = stepForward(session)
    }
    expect(isSolved(session.state)).toBe(true)

    for (let i = 0; i < 20; i++) {
      session = stepBackward(session)
    }

    expect(session.cursor).toBe(0)
    // 逐格比对：和刚刚打乱完的状态完全一样
    expect(session.state.faces).toEqual(scrambled.state.faces)
  })

  it('走完最后一步之后再点下一步，什么都不会发生', () => {
    let session = enterRestoreMode(scrambledSession(5))
    for (let i = 0; i < 5; i++) {
      session = stepForward(session)
    }
    const after = stepForward(session)
    expect(after).toBe(session)
    expect(after.cursor).toBe(5)
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
  it('点一键复原只是进入复原模式，不会替你走路', () => {
    const scrambled = scrambledSession(20)
    const restoring = enterRestoreMode(scrambled)

    expect(restoring.phase).toBe('restoring')
    expect(restoring.cursor).toBe(0)
    // 魔方本身一动不动
    expect(restoring.state.faces).toEqual(scrambled.state.faces)
  })

  it('还没打乱就点一键复原，会给提示而不是乱复原', () => {
    const session = createSession()
    const result = enterRestoreMode(session)
    expect(result.phase).toBe('idle')
    expect(result.notice).toBe(NO_SCRAMBLE_NOTICE)
  })

  it('退出复原模式之后进度还留着，再点一键复原能接着走', () => {
    let session = enterRestoreMode(scrambledSession(20))
    session = stepForward(session)
    session = stepForward(session)
    session = stepForward(session)

    const exited = exitRestoreMode(session)
    expect(exited.phase).toBe('idle')
    expect(exited.cursor).toBe(3)

    const reentered = enterRestoreMode(exited)
    expect(reentered.phase).toBe('restoring')
    expect(reentered.cursor).toBe(3)
  })

  it('复原模式里重新点打乱 = 重新开始（计划换新、模式回到自由）', () => {
    const restoring = enterRestoreMode(scrambledSession(20))
    const newMoves = createScramble(30, makeRandom(99))
    const restarted = beginScramble(restoring, newMoves)

    expect(restarted.phase).toBe('idle')
    expect(restarted.cursor).toBe(0)
    expect(restarted.scramble).toHaveLength(30)
    expect(restarted.plan).toHaveLength(30)
  })
})

describe('底层容错：绕过界面强行转动', () => {
  it('复原模式下强行转动：这一步立刻生效，计划全部作废、退出复原模式、给出提示', () => {
    const before = scrambledSession(20)
    const restoring = enterRestoreMode(before)
    expect(restoring.phase).toBe('restoring')

    const forced = manualMove(restoring, 'R')

    expect(forced.phase).toBe('idle')
    expect(forced.plan).toHaveLength(0)
    expect(forced.cursor).toBe(0)
    expect(forced.notice).toBe(PLAN_INVALID_NOTICE)
    // 用户这一下真的转上去了
    expect(forced.state.faces).toEqual(applyMoves(before.state, ['R']).faces)
  })

  it('计划作废之后再点一键复原，不会给出错的复原方案，而是提示要重新打乱', () => {
    const forced = manualMove(enterRestoreMode(scrambledSession(20)), 'R')
    const retry = enterRestoreMode(forced)

    expect(retry.phase).toBe('idle')
    expect(retry.notice).toBe(PLAN_UNUSABLE_NOTICE)
  })

  it('自由模式下随手转几下，倒推计划也会失效（免得复原时越走越乱）', () => {
    const session = scrambledSession(20)
    expect(isPlanStillValid(session)).toBe(true)

    const messedUp = manualMove(session, 'R')
    expect(isPlanStillValid(messedUp)).toBe(false)

    const retry = enterRestoreMode(messedUp)
    expect(retry.phase).toBe('idle')
    expect(retry.notice).toBe(PLAN_UNUSABLE_NOTICE)
  })

  it('自由模式下正常手动转动不会弹提示', () => {
    const session = manualMove(createSession(), 'R')
    expect(session.notice).toBeNull()
    expect(session.phase).toBe('idle')
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

    session = stepForward(session)
    session = stepForward(session)
    session = stepForward(session)
    expect(nextStepText(session)).toBeNull()
  })
})
