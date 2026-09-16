import { describe, expect, it } from 'vitest'
import { createSolvedState, isSolved, type Face } from './cubeState'
import { MOVES, parseMove, type Move } from './moves'
import {
  DEFAULT_SCRAMBLE_STEPS,
  MAX_SCRAMBLE_STEPS,
  MIN_SCRAMBLE_STEPS,
  createRestorePlan,
  createScramble,
  invertMove,
  normalizeStepCount,
} from './scramble'
import { applyMoves } from './turns'

/** 固定种子的随机数：测试必须每次都一样，不能用 Math.random */
function makeRandom(seed: number): () => number {
  let value = seed >>> 0
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0
    return value / 4294967296
  }
}

describe('打乱步数的限制（1~30，默认 20）', () => {
  it('三个常量就是需求说的那个范围', () => {
    expect(MIN_SCRAMBLE_STEPS).toBe(1)
    expect(MAX_SCRAMBLE_STEPS).toBe(30)
    expect(DEFAULT_SCRAMBLE_STEPS).toBe(20)
  })

  it('太小的夹到 1，太大的夹到 30，没填的用 20', () => {
    expect(normalizeStepCount(20)).toBe(20)
    expect(normalizeStepCount('20')).toBe(20)
    expect(normalizeStepCount(1)).toBe(1)
    expect(normalizeStepCount(30)).toBe(30)

    expect(normalizeStepCount(0)).toBe(1)
    expect(normalizeStepCount(-5)).toBe(1)
    expect(normalizeStepCount(31)).toBe(30)
    expect(normalizeStepCount(999)).toBe(30)

    expect(normalizeStepCount('')).toBe(DEFAULT_SCRAMBLE_STEPS)
    expect(normalizeStepCount('abc')).toBe(DEFAULT_SCRAMBLE_STEPS)

    expect(normalizeStepCount(3.7)).toBe(3)
  })
})

describe('生成打乱步骤', () => {
  it('要几步就给几步', () => {
    for (const steps of [1, 2, 20, 30]) {
      expect(createScramble(steps, makeRandom(steps))).toHaveLength(steps)
    }
  })

  it('步数超出范围时会被夹住', () => {
    expect(createScramble(999, makeRandom(1))).toHaveLength(MAX_SCRAMBLE_STEPS)
    expect(createScramble(0, makeRandom(1))).toHaveLength(MIN_SCRAMBLE_STEPS)
  })

  it('只出现 12 种合法记号', () => {
    const moves = createScramble(30, makeRandom(42))
    for (const move of moves) {
      expect(MOVES).toContain(move)
    }
  })

  it('不许连续两次转同一个面（换个种子多验几遍）', () => {
    for (const seed of [1, 7, 42, 2024, 99999]) {
      const moves = createScramble(30, makeRandom(seed))
      for (let i = 1; i < moves.length; i++) {
        const previous = parseMove(moves[i - 1] as Move).face
        const current = parseMove(moves[i] as Move).face
        expect(current).not.toBe(previous)
      }
    }
  })

  it('就算随机数一直返回 0（每次都挑第一个候选），也不会连续同面', () => {
    const moves = createScramble(30, () => 0)
    for (let i = 1; i < moves.length; i++) {
      expect(parseMove(moves[i] as Move).face).not.toBe(parseMove(moves[i - 1] as Move).face)
    }
  })

  it('同一个种子每次生成的结果一样（方便复现问题）', () => {
    expect(createScramble(20, makeRandom(123))).toEqual(createScramble(20, makeRandom(123)))
  })

  it('六个面都有机会被转到', () => {
    const faces = new Set<Face>(createScramble(30, makeRandom(2024)).map((move) => parseMove(move).face))
    expect(faces.size).toBeGreaterThan(1)
  })
})

describe('反向记号与倒推计划', () => {
  it('反向记号：R 变 R\'，R\' 变 R', () => {
    expect(invertMove('R')).toBe("R'")
    expect(invertMove("R'")).toBe('R')
  })

  it('反两次回到自己，而且结果仍然是合法记号', () => {
    for (const move of MOVES) {
      const inverted = invertMove(move)
      expect(MOVES).toContain(inverted)
      expect(invertMove(inverted)).toBe(move)
    }
  })

  it('倒推计划 = 打乱倒着排 + 每一步反过来', () => {
    expect(createRestorePlan([])).toEqual([])
    expect(createRestorePlan(['U', "R'"])).toEqual(['R', "U'"])
  })

  it('计划长度和打乱长度一样', () => {
    const scramble = createScramble(20, makeRandom(5))
    expect(createRestorePlan(scramble)).toHaveLength(20)
  })

  it('把倒推计划走完，魔方正好回到复原状态', () => {
    for (const steps of [1, 5, 20, 30]) {
      const scramble = createScramble(steps, makeRandom(steps * 31 + 7))
      const scrambledState = applyMoves(createSolvedState(), scramble)
      expect(isSolved(scrambledState)).toBe(false)

      const plan = createRestorePlan(scramble)
      expect(isSolved(applyMoves(scrambledState, plan))).toBe(true)
    }
  })
})
