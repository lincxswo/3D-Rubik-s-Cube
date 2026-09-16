import './style.css'
import type { Move } from './core/moves'
import { createScramble, invertMove, normalizeStepCount } from './core/scramble'
import {
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
} from './core/session'
import { applyMove } from './core/turns'
import { createCubeRenderer } from './render/cubeRenderer'
import { createMoveButtons } from './ui/controls'

function requireElement<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector)
  if (element === null) {
    throw new Error(`页面上找不到 ${selector}`)
  }
  return element
}

const viewport = requireElement<HTMLDivElement>('#viewport')
const moveBar = requireElement<HTMLDivElement>('#moves')
const progressLine = requireElement<HTMLDivElement>('#progress')
const hintLine = requireElement<HTMLDivElement>('#hint')
const stepsInput = requireElement<HTMLInputElement>('#scramble-steps')
const scrambleButton = requireElement<HTMLButtonElement>('#scramble')
const resetButton = requireElement<HTMLButtonElement>('#reset')
const restoreButton = requireElement<HTMLButtonElement>('#restore')
const stepForwardButton = requireElement<HTMLButtonElement>('#step-forward')
const stepBackwardButton = requireElement<HTMLButtonElement>('#step-backward')
const exitRestoreButton = requireElement<HTMLButtonElement>('#exit-restore')

const cubeRenderer = createCubeRenderer(viewport)

let session: Session = createSession()
let busy = false
/** 正在整段播放打乱。打乱是一步一步播的，两步之间 busy 会短暂归零，
 *  光靠 busy 会让按钮闪一下变亮、可能被点到，所以再加一把"整段流程"的锁 */
let scrambling = false

/**
 * "代号"。每次有操作强行作废正在进行的事情（底层容错），代号就 +1。
 * 正在播放动画的代码醒来后会检查代号有没有变：变了就说明自己已经过期，
 * 不许再改数据 —— 这样"作废"才是真的作废，不会过一会儿又被翻回来。
 */
let generation = 0

const moveButtons = createMoveButtons(moveBar, (move) => {
  requestMove(move, 'ui')
})

cubeRenderer.render(session.state)
refreshUi()

// ---------- 界面状态：所有按钮的可用/置灰都从这里统一算出来 ----------

function refreshUi(): void {
  const restoring = session.phase === 'restoring'
  const total = session.plan.length
  // 动画播放中、或者整段打乱还没播完，都算"忙"
  const blocked = busy || scrambling

  // 复原模式下，12 个手动转动按钮全部置灰
  moveButtons.setEnabled(!blocked && !restoring)

  stepsInput.disabled = blocked
  scrambleButton.disabled = blocked
  resetButton.disabled = blocked
  restoreButton.disabled = blocked || restoring
  stepForwardButton.disabled = blocked || !restoring || session.cursor >= total
  stepBackwardButton.disabled = blocked || !restoring || session.cursor === 0
  exitRestoreButton.disabled = blocked || !restoring

  progressLine.textContent = scrambling ? '正在打乱…' : progressText(session)
  hintLine.textContent = session.notice ?? buildHint()
}

function buildHint(): string {
  if (scrambling) {
    return '正在按随机步骤打乱，转完就停'
  }
  if (session.phase === 'restoring') {
    const next = nextStepText(session)
    return next === null ? '复原模式 · 已经走完全部步骤' : `复原模式 · ${next}（用上一步/下一步慢慢看）`
  }
  if (session.history.length === 0) {
    return '魔方是复原状态：可以直接手动转，或者设好步数点"打乱"'
  }
  return `你一共动过 ${session.history.length} 步，点"一键复原"可以一步步倒回去`
}

// ---------- 转动的总入口 ----------

type MoveSource = 'ui' | 'force'

/**
 * 所有转动都从这里进。两条路：
 *   ui    —— 界面按钮点的。动画中、或正在一步步复原，一概不接受。
 *   force —— 用户绕过界面强行转动（这是需求里的"底层容错"）。
 *            哪怕正在播动画也要立刻暂停、执行用户这一步、剩下的计划全部作废。
 */
function requestMove(move: Move, source: MoveSource): void {
  if (source === 'force') {
    void forceMove(move)
    return
  }
  if (busy || scrambling || session.phase === 'restoring') {
    return
  }
  void playMove(move, (current) => manualMove(current, move))
}

/**
 * 正常播一次转动动画，播完再把这一步提交到数据里。
 * commit 决定"这一步提交之后会话变成什么样"。
 */
async function playMove(move: Move, commit: (current: Session) => Session): Promise<boolean> {
  const token = generation
  busy = true
  refreshUi()

  const stateAfter = applyMove(session.state, move)
  const completed = await cubeRenderer.animateMove(move, stateAfter)

  if (token !== generation) {
    // 已经被强制作废接管了：这里什么都不做，善后交给那边
    return false
  }

  busy = false
  if (completed) {
    session = commit(session)
  }
  refreshUi()
  return completed
}

/**
 * 底层容错：用户绕过了界面强行转动。
 * 顺序是"先暂停 → 再执行用户的转动 → 计划作废、退出复原模式 → 最后把这一步演出来"。
 */
async function forceMove(move: Move): Promise<void> {
  generation += 1
  cubeRenderer.cancelMove() // 立刻暂停正在播的动画，画面回到转动前
  busy = false

  // 用户的这一步立刻生效（manualMove 会顺手作废计划、给出提示、退出复原模式）
  session = manualMove(session, move)

  const token = generation
  busy = true
  refreshUi()

  await cubeRenderer.animateMove(move, session.state)

  if (token !== generation) {
    return
  }
  busy = false
  refreshUi()
}

// ---------- 各个按钮做的事 ----------

async function runScramble(): Promise<void> {
  if (busy || scrambling) return

  const steps = normalizeStepCount(stepsInput.value)
  stepsInput.value = String(steps) // 把夹到 1~30 之后的值显示出来，让你看得见

  const moves = createScramble(steps)
  session = beginScramble(session, moves)
  scrambling = true
  refreshUi()

  // 一步步演出来，每一步转完才走下一步
  try {
    for (const move of moves) {
      const completed = await playMove(move, (current) => scrambleStep(current, move))
      if (!completed) return
    }
  } finally {
    scrambling = false
    refreshUi()
  }
}

/** 重置：一键变回初始的复原状态（不用动画，直接到位） */
function runReset(): void {
  if (busy || scrambling) return
  session = resetSession()
  cubeRenderer.render(session.state)
  refreshUi()
}

function runEnterRestore(): void {
  if (busy || scrambling) return
  session = enterRestoreMode(session)
  refreshUi()
}

function runExitRestore(): void {
  if (busy || scrambling) return
  session = exitRestoreMode(session)
  refreshUi()
}

function runStepForward(): void {
  if (busy || scrambling || session.phase !== 'restoring') return
  const move = session.plan[session.cursor]
  if (move === undefined) return
  void playMove(move, stepForward)
}

function runStepBackward(): void {
  if (busy || scrambling || session.phase !== 'restoring') return
  const previous = session.plan[session.cursor - 1]
  if (previous === undefined) return
  void playMove(invertMove(previous), stepBackward)
}

scrambleButton.addEventListener('click', () => {
  void runScramble()
})
resetButton.addEventListener('click', runReset)
restoreButton.addEventListener('click', runEnterRestore)
stepForwardButton.addEventListener('click', runStepForward)
stepBackwardButton.addEventListener('click', runStepBackward)
exitRestoreButton.addEventListener('click', runExitRestore)
stepsInput.addEventListener('change', () => {
  stepsInput.value = String(normalizeStepCount(stepsInput.value))
})

// 底层容错的入口。正常操作下界面根本点不到它（复原模式下 12 个按钮是灰的），
// 留这个口子是为了能"绕过界面"亲手验证容错：浏览器控制台里敲 cubeApi.forceMove('R')
Object.assign(window, {
  cubeApi: {
    forceMove: (move: Move) => requestMove(move, 'force'),
  },
})
