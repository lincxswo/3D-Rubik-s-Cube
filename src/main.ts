import './style.css'
import { createSolvedState, type CubeState } from './core/cubeState'
import { applyMove } from './core/turns'
import type { Move } from './core/moves'
import { createCubeRenderer } from './render/cubeRenderer'
import { createMoveButtons } from './ui/controls'

const viewport = document.querySelector<HTMLDivElement>('#viewport')
const moveBar = document.querySelector<HTMLDivElement>('#moves')
if (viewport === null || moveBar === null) {
  throw new Error('页面结构不对：找不到 #viewport 或 #moves')
}

let state: CubeState = createSolvedState()

const cubeRenderer = createCubeRenderer(viewport)
cubeRenderer.render(state)

// 动画播放期间不接受新的转动指令
let busy = false

const buttons = createMoveButtons(moveBar, (move) => {
  void play(move)
})

async function play(move: Move): Promise<void> {
  if (busy) return
  busy = true
  buttons.setEnabled(false)

  // 先算好"转完之后的状态"，动画演完再把它换成当前状态
  const next = applyMove(state, move)
  await cubeRenderer.animateMove(move, next)
  state = next

  busy = false
  buttons.setEnabled(true)
}
