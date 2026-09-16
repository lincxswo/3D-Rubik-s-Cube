/**
 * 鼠标悬停在转动按钮上时，画面该怎么区别对待每一格贴纸。
 *
 * 这里只有规则、不含 three：它只回答"这一格现在该发光、该变暗、还是正常"，
 * 具体用哪份材质去画是 cubeRenderer 的事。
 * 单独放一个文件的好处是：这条规则能直接被测试验证（不用起 3D 环境）。
 *
 * 为什么不是单纯"把那一层调亮"？因为白色的面已经在亮度天花板上了，
 * 再加光还是白，看不出任何变化。所以这里的做法是"指到的那层发光，其余压暗"，
 * 这样白色的面也能一眼看出来。
 */

import { isInLayer, type CubiePosition } from '../core/cubies'
import type { Face } from '../core/cubeState'

/** 小方块的边长。每层之间的距离是 1（CUBIE_SPACING），方块做 0.94，于是方块之间留 0.06 的缝 */
export const CUBIE_SIZE = 0.94

/** 每个小方块占的格位（层与层之间的距离） */
export const CUBIE_SPACING = 1

/**
 * 高亮描边用的立方体边长。
 * 必须比方块本身大一点（不然线条和方块表面重叠、会打架），
 * 又必须比格位小（不然相邻两个方块的描边会互相插进去、糊成一团）。
 */
export const OUTLINE_SIZE = 0.98

/** normal = 正常颜色；glow = 被指到的那一层，轻微发光；dim = 其余层，轻微压暗 */
export type StickerHighlight = 'normal' | 'glow' | 'dim'

/**
 * 这一格贴纸现在该怎么画。
 * 参数 highlightedFace 是"鼠标现在指着哪个面"，移开鼠标就是 null。
 *
 * 注意这是个纯函数：同样的输入永远得到同样的输出。
 * 所以"换一个按钮高亮"不需要先清理旧状态 —— 不可能留下痕迹。
 */
export function stickerHighlight(
  position: CubiePosition,
  highlightedFace: Face | null,
): StickerHighlight {
  if (highlightedFace === null) {
    return 'normal'
  }
  return isInLayer(position, highlightedFace) ? 'glow' : 'dim'
}
