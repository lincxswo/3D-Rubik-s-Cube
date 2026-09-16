import './style.css'
import { createSolvedState } from './core/cubeState'
import { createCubeRenderer } from './render/cubeRenderer'

const container = document.querySelector<HTMLDivElement>('#app')
if (container === null) {
  throw new Error('页面上找不到 #app 容器')
}

// 现在先摆一个已复原的魔方。
// 以后的打乱、复原、一步步转，都只是换掉传给 render 的 state。
const state = createSolvedState()

const cubeRenderer = createCubeRenderer(container)
cubeRenderer.render(state)
