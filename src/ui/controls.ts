/**
 * 页面上的 12 个转动按钮。
 * 按钮是从 core/moves.ts 那份记号清单自动生成的，
 * 所以"按钮有哪些"和"代码支持哪些转法"永远是同一份数据，不会对不上。
 */

import { MOVES, type Move } from '../core/moves'

export type MoveButtons = {
  /** 动画播放期间把按钮禁掉，让"这段时间不接受新指令"看得见 */
  setEnabled(enabled: boolean): void
}

export function createMoveButtons(
  container: HTMLElement,
  onMove: (move: Move) => void,
): MoveButtons {
  const buttons = MOVES.map((move) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = move
    button.addEventListener('click', () => {
      onMove(move)
    })
    container.appendChild(button)
    return button
  })

  return {
    setEnabled(enabled: boolean): void {
      for (const button of buttons) {
        button.disabled = !enabled
      }
    },
  }
}
