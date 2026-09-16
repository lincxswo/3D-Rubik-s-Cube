/**
 * 页面上的 12 个转动按钮。
 * 按钮是从 core/moves.ts 那份记号清单自动生成的，
 * 所以"按钮有哪些"和"代码支持哪些转法"永远是同一份数据，不会对不上。
 *
 * 关于"置灰"的做法（重要）：
 * 这里没有用浏览器的 disabled 属性，而是用"置灰外观 + 点击被上层拒绝"。
 * 原因是真 disabled 的按钮连鼠标悬停都不响应，那样就没法做到
 * "任何时候悬停都能高亮对应的面"（包括动画播放中和复原模式下）。
 * 视觉和点击效果与禁用一致，但悬停高亮始终有效。
 */

import { MOVES, parseMove, type Move } from '../core/moves'
import type { Face } from '../core/cubeState'

export type MoveButtonHandlers = {
  /** 点了某个转动按钮 */
  onMove: (move: Move) => void
  /** 鼠标移入/移出转动按钮：移入给"哪个面"，移开给 null */
  onHoverFace: (face: Face | null) => void
}

export type MoveButtons = {
  /** 现在能不能点。不能点就置灰（点击会被上层忽略，但悬停高亮仍然有效） */
  setEnabled(enabled: boolean): void
}

/** 不能点的时候加这个类，样式上表现为置灰 */
const BLOCKED_CLASS = 'is-blocked'

export function createMoveButtons(
  container: HTMLElement,
  handlers: MoveButtonHandlers,
): MoveButtons {
  const buttons = MOVES.map((move) => {
    // 字母直接对应面：R 和 R' 都指向 R 面。
    // 解析用的是 core 里同一份记号规则，不在这里另写一份映射表。
    const face = parseMove(move).face

    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = move

    button.addEventListener('click', () => {
      handlers.onMove(move)
    })
    button.addEventListener('mouseenter', () => {
      handlers.onHoverFace(face)
    })
    button.addEventListener('mouseleave', () => {
      handlers.onHoverFace(null)
    })

    container.appendChild(button)
    return button
  })

  // 兜底：鼠标从某个按钮直接滑出整个按钮区时，也要把高亮清掉
  container.addEventListener('mouseleave', () => {
    handlers.onHoverFace(null)
  })

  return {
    setEnabled(enabled: boolean): void {
      for (const button of buttons) {
        button.classList.toggle(BLOCKED_CLASS, !enabled)
        button.setAttribute('aria-disabled', String(!enabled))
      }
    },
  }
}
