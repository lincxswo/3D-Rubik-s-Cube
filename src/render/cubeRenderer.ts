/**
 * 渲染：把 src/core 里的"魔方状态"画成 3D 画面，并负责转层动画。
 *
 * 这个文件的职责只有两个 —— 照着数据画画、把"转"这个动作演出来。
 * 它从不修改状态：想改画面，都是 core 先算好新状态，再交给这里画。
 *
 * 鼠标拖动、滚轮缩放改的是"摄像机位置"，跟魔方状态毫无关系。
 *
 * 转层动画的做法：
 *   1. 把要转的那 9 个小方块临时装进一个"空组"（相当于转盘）；
 *   2. 200 毫秒里把转盘从 0° 转到 90°；
 *   3. 转到底的那一瞬间，先把新状态的颜色刷到固定位置的小方块上，
 *      再把这些方块从转盘里放回场景、转盘归零。
 *   因为"转过去的样子"和"新状态的颜色"用的是同一套坐标，
 *   两边完全吻合，所以切换的那一瞬间看不出接缝。
 */

import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { CUBIE_POSITIONS, FACE_NORMAL, cubieStickers, layerPositions } from '../core/cubies'
import type { CubiePosition } from '../core/cubies'
import type { CubeState, Color, Face } from '../core/cubeState'
import { parseMove, type Move } from '../core/moves'

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

/** 转一次动画要多久（毫秒） */
const TURN_DURATION_MS = 200

/** BoxGeometry 的 6 个面固定按这个顺序排，按下标给它指定材质 */
const BOX_FACE_INDEX: Record<Face, number> = {
  R: 0,
  L: 1,
  U: 2,
  D: 3,
  F: 4,
  B: 5,
}

/** 正在播放的那一次转动 */
type RunningTurn = {
  group: THREE.Group
  axis: THREE.Vector3
  toAngle: number
  meshes: THREE.Mesh[]
  stateAfter: CubeState
  startTime: number
  /** 参数表示"这次转动到底转完了没有"：true 转完，false 被强行取消 */
  resolve: (completed: boolean) => void
}

export type CubeRenderer = {
  /** 把某个状态画出来。状态变了就再调一次 */
  render(state: CubeState): void
  /**
   * 播放一次转层动画；转完自动把 stateAfter 画出来。
   * 返回 true = 正常转完；返回 false = 中途被 cancelMove 打断了，这次转动不算数。
   */
  animateMove(move: Move, stateAfter: CubeState): Promise<boolean>
  /** 立刻停下正在播的转动，画面回到"转动之前"的样子（这次转动不算数） */
  cancelMove(): void
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

  // 正在播放的那一次转动（同一时刻最多一个，这就是"动画期间不接受新指令"的底气）
  let running: RunningTurn | null = null

  // 鼠标拖拽转视角、滚轮缩放，用的是 three 自带的 OrbitControls
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.enablePan = false // 只做"转角度 + 缩放"，不做平移
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

  // 6 种颜色 + 1 种内部色，所有方块共用这几份材质
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
  const meshByPosition = new Map<string, THREE.Mesh>()
  const cubies = CUBIE_POSITIONS.map((position) => {
    const materials: THREE.MeshLambertMaterial[] = Array.from({ length: 6 }, () => innerMaterial)
    const mesh = new THREE.Mesh(geometry, materials)
    mesh.position.set(position[0], position[1], position[2])
    scene.add(mesh)
    meshByPosition.set(positionKey(position), mesh)
    return { position, materials }
  })

  function render(state: CubeState): void {
    for (const cubie of cubies) {
      // 先全部涂成内部色，再把露出来的面换成对应颜色
      for (let index = 0; index < 6; index++) {
        cubie.materials[index] = innerMaterial
      }
      for (const sticker of cubieStickers(state, cubie.position)) {
        cubie.materials[BOX_FACE_INDEX[sticker.face]] = colorMaterials[sticker.color]
      }
    }
  }

  function animateMove(move: Move, stateAfter: CubeState): Promise<boolean> {
    // 如果上一次转动还在播（比如用户绕过了界面强行转动），先立刻把它停掉：
    // 画面回到转动之前，那一次转动不算数，交给这一次重新来
    cancelMove()

    const { face, direction } = parseMove(move)
    const group = new THREE.Group()
    const meshes: THREE.Mesh[] = []
    for (const position of layerPositions(face)) {
      const mesh = meshByPosition.get(positionKey(position))
      if (mesh === undefined) continue
      meshes.push(mesh)
      group.add(mesh) // 挂到临时组里（会自动从场景脱离）
    }
    scene.add(group)

    const axis = new THREE.Vector3(...FACE_NORMAL[face])
    // 从面外侧看是顺时针 = 绕外法线转 -90°（右手定则）
    const toAngle = direction === 1 ? -Math.PI / 2 : Math.PI / 2

    return new Promise<boolean>((resolve) => {
      running = {
        group,
        axis,
        toAngle,
        meshes,
        stateAfter,
        startTime: performance.now(),
        resolve,
      }
    })
  }

  function finishTurn(): void {
    if (running === null) return
    const turn = running
    running = null

    // 顺序很重要：先刷颜色，再把方块放回原位，画面才不会有跳跃感
    render(turn.stateAfter)
    releaseGroup(turn)
    turn.resolve(true)
  }

  /** 立刻取消：方块放回原位、转盘归零，但颜色保持不变（因为这次转动没有提交到状态里） */
  function cancelMove(): void {
    if (running === null) return
    const turn = running
    running = null
    releaseGroup(turn)
    turn.resolve(false)
  }

  /** 把转盘里的方块放回场景，并让转盘归零 */
  function releaseGroup(turn: RunningTurn): void {
    for (const mesh of turn.meshes) {
      scene.add(mesh)
    }
    turn.group.rotation.set(0, 0, 0)
    scene.remove(turn.group)
  }

  function advanceTurn(now: number): void {
    if (running === null) return
    const progress = Math.min(1, (now - running.startTime) / TURN_DURATION_MS)
    running.group.setRotationFromAxisAngle(running.axis, running.toAngle * easeInOut(progress))
    if (progress >= 1) {
      finishTurn()
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
    advanceTurn(performance.now())
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

  return { render, animateMove, cancelMove, dispose }
}

/** 小方块位置的查找键 */
function positionKey(position: CubiePosition): string {
  return position.join(',')
}

/** 让转动"起步慢、中间快、收尾慢"，看起来更像真的在拧 */
function easeInOut(progress: number): number {
  return progress < 0.5 ? 2 * progress * progress : 1 - (-2 * progress + 2) ** 2 / 2
}
