/**
 * 渲染：把 src/core 里的"魔方状态"画成 3D 画面。
 *
 * 这个文件的职责只有一个 —— 照着数据画画。
 * 它不认识"打乱""复原"这些概念，也从不修改状态。
 * 想让画面变，就改状态，然后重新调用 render(state)。
 *
 * 鼠标拖动、滚轮缩放改的是"摄像机的位置"，也就是你看它的角度，跟魔方状态毫无关系。
 */

import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { CUBIE_POSITIONS, cubieStickers } from '../core/cubies'
import type { CubeState, Color, Face } from '../core/cubeState'

/** 标准配色到底长什么样（魔方上那六种颜色的具体色号） */
const COLOR_HEX: Record<Color, number> = {
  white: 0xffffff,
  yellow: 0xffd500,
  red: 0xc41e3a,
  orange: 0xff5800,
  blue: 0x0051ba,
  green: 0x009e60,
}

/** 小方块内部看不见的面用深灰，像真魔方的黑塑料 */
const INNER_COLOR = 0x1b1b1b

/** 小方块边长。每一层之间距离是 1，方块做 0.94，于是每两个方块之间留 0.06 的缝 */
const CUBIE_SIZE = 0.94

/** BoxGeometry 的 6 个面固定按这个顺序排，按下标给它指定材质 */
const BOX_FACE_INDEX: Record<Face, number> = {
  R: 0,
  L: 1,
  U: 2,
  D: 3,
  F: 4,
  B: 5,
}

export type CubeRenderer = {
  /** 把某个状态画出来。状态变了就再调一次 */
  render(state: CubeState): void
  /** 收摊：停掉动画、摘掉画布、释放显存 */
  dispose(): void
}

export function createCubeRenderer(container: HTMLElement): CubeRenderer {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x101418)

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
  camera.position.set(4.6, 4.2, 6.4)

  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  container.appendChild(renderer.domElement)

  // 鼠标拖拽转视角、滚轮缩放，用的是 three 自带的 OrbitControls
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.enablePan = false // 这一步只要"转角度 + 缩放"，不要平移
  controls.minDistance = 4
  controls.maxDistance = 20
  controls.target.set(0, 0, 0)
  controls.update()

  // 灯光：环境光保证每个面都看得清，两盏方向光让立体感出来
  scene.add(new THREE.AmbientLight(0xffffff, 1.5))
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.6)
  keyLight.position.set(6, 10, 8)
  scene.add(keyLight)
  const fillLight = new THREE.DirectionalLight(0xffffff, 0.9)
  fillLight.position.set(-8, -6, -10)
  scene.add(fillLight)

  // 6 种颜色 + 1 种内部色，全部方块共用这几份材质
  const innerMaterial = new THREE.MeshLambertMaterial({ color: INNER_COLOR })
  const colorMaterials: Record<Color, THREE.MeshLambertMaterial> = {
    white: new THREE.MeshLambertMaterial({ color: COLOR_HEX.white }),
    yellow: new THREE.MeshLambertMaterial({ color: COLOR_HEX.yellow }),
    red: new THREE.MeshLambertMaterial({ color: COLOR_HEX.red }),
    orange: new THREE.MeshLambertMaterial({ color: COLOR_HEX.orange }),
    blue: new THREE.MeshLambertMaterial({ color: COLOR_HEX.blue }),
    green: new THREE.MeshLambertMaterial({ color: COLOR_HEX.green }),
  }

  // 摆出 26 个小方块
  const geometry = new THREE.BoxGeometry(CUBIE_SIZE, CUBIE_SIZE, CUBIE_SIZE)
  const cubies = CUBIE_POSITIONS.map((position) => {
    const materials = Array.from({ length: 6 }, () => innerMaterial)
    const mesh = new THREE.Mesh(geometry, materials)
    mesh.position.set(position[0], position[1], position[2])
    scene.add(mesh)
    return { position, mesh }
  })

  function render(state: CubeState): void {
    for (const cubie of cubies) {
      const materials = cubie.mesh.material
      // 先全部涂成内部色，再把露出来的面换成对应颜色
      for (let index = 0; index < 6; index++) {
        materials[index] = innerMaterial
      }
      for (const sticker of cubieStickers(state, cubie.position)) {
        materials[BOX_FACE_INDEX[sticker.face]] = colorMaterials[sticker.color]
      }
      cubie.mesh.material = materials
    }
  }

  function resize(): void {
    const width = container.clientWidth || 1
    const height = container.clientHeight || 1
    renderer.setSize(width, height)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
  }

  const resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(container)
  resize()

  renderer.setAnimationLoop(() => {
    controls.update()
    renderer.render(scene, camera)
  })

  function dispose(): void {
    renderer.setAnimationLoop(null)
    resizeObserver.disconnect()
    controls.dispose()
    geometry.dispose()
    for (const material of [innerMaterial, ...Object.values(colorMaterials)]) {
      material.dispose()
    }
    renderer.dispose()
    container.removeChild(renderer.domElement)
  }

  return { render, dispose }
}
