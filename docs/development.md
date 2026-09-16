# 开发环境与工具

> ⚠️ **这份文档和项目代码无关。**
> 这里写的是"这台电脑上用什么工具、装在哪儿、有什么坑"。
> 项目代码里**一个字都没有引用**下面这些路径——换一台电脑、按本文最后的步骤装好，项目照样跑。
> 这就是把"环境"和"项目"分开写的原因：写项目文档时不要把工具路径混进代码说明里。

---

## 1. 三条（其实是四条）命令

| 命令 | 干什么 | 什么时候用 |
| --- | --- | --- |
| `npm run dev` | 启动开发服务器，改代码浏览器自动刷新 | 平时开发、看效果。地址 http://localhost:5173/ |
| `npm test` | 跑一遍全部测试（`vitest run`） | **每做完一小步都要跑**，见 [testing.md](./testing.md) |
| `npm run build` | 类型检查 + 打包出可上线的静态文件（输出到 `dist/`） | 想发布时 |
| `npm run preview` | 本地预览打包结果（脚手架自带） | 想确认打包产物正常时 |

## 2. 装了哪些依赖，各自干什么

**运行依赖（`dependencies`，发布出去要给用户下载的）：**

| 包 | 作用 |
| --- | --- |
| `three` | 3D 引擎。画魔方、灯光、材质、动画全靠它。**只有 `src/render/` 能用它** |

**开发依赖（`devDependencies`，只在开发/构建时用，不会进最终产物）：**

| 包 | 作用 |
| --- | --- |
| `vite` | 开发服务器 + 打包工具，还负责把 TypeScript 转成浏览器能懂的代码 |
| `typescript` | TypeScript 编译器，负责类型检查（`npm run build` 的第一步） |
| `vitest` | 测试框架 |
| `@types/three` | three 的**类型说明书**（只有类型定义、没有运行代码）。装了它，编辑器能自动补全，`npm run build` 的类型检查才通得过 |

> 注意 `three` 这个版本（0.186）**自己不带类型说明**，所以必须有 `@types/three`。
> 没有它，`npm run dev` 和 `npm test` 照样能跑，但 `npm run build` 会因类型缺失报错。

## 3. 本机环境（这台电脑上的路径，**不属于项目**）

| 东西 | 位置 | 说明 |
| --- | --- | --- |
| **项目代码** | `C:\Users\1\Desktop\develop\useAI\workSpace\3dRubiksCube` | 就是本项目，可以随便搬走 |
| node / npm | `C:\Users\1\Desktop\develop\useAI\AI\nodeJS\`（含 `node.exe`、`npm.ps1`） | 运行项目的工具，装在项目外面 |
| npm 下载缓存 | `C:\Users\1\AppData\Local\npm-cache\` | 下载过的包都存这儿，删了不影响项目 |
| 第三方库实体 | 项目内的 `node_modules/` | 从缓存解出来的依赖，**不是我们写的代码**，不进版本库 |
| 版本存档 | 项目内的 `.git/` | 由使用者自己维护 |

工具链版本（写文档时）：Node.js v24.19.0、npm 11.17.0、Vite 8.3.0、Vitest 5.0.1、TypeScript 6.0.x、three 0.186.0。

## 4. 已知的坑（踩过，记下来省得再查）

1. **本机的 `npm` PowerShell 包装脚本有 bug。**
   以管道方式调用时（`npm ... | Out-String`）会报 `$LASTEXITCODE cannot be retrieved`。
   这是包装脚本自己的问题，**不影响命令结果**。绕过的办法是别用管道，或直接用 `node` 调用 npm 的核心脚本。

2. **受限运行环境里需要授权。**
   这类"沙箱"环境默认禁止联网和子进程通信：装包（要联网）和跑测试（Vitest 要子进程）都会被拒。
   **在普通终端里自己跑不需要任何授权**，这只是自动化助手环境特有的限制。

3. **Vitest 默认的子进程池在受限环境里会 `spawn EPERM`。**
   现象是 `Failed to start forks worker`。这是"子进程不能用管道通信"导致的，不是代码问题。

4. **Vite 开发服务器在 Windows 上可能突然崩掉。**
   报 `EBUSY: resource busy or locked, watch '...\.index.html.xxxx.tmpdir\index.html.tmp'`。
   原因：Vite 监视文件时，正好有人在写被监视的文件（尤其是 `index.html`），Windows 文件锁就冲突了。
   处理：**直接重新 `npm run dev` 即可**，不影响代码，也不会留下垃圾文件。

5. **普通线条画不出粗细。**
   three 的 `LineBasicMaterial.linewidth` 在大多数浏览器（尤其 Windows）上是**被忽略的**，永远只有 1 像素。
   要画粗线必须用 three 自带的 `LineSegments2 + LineMaterial`（本项目悬停描边就是这么做的）。

6. **`ReplaceFileW EIO` 写文件失败。**
   在开发服务器开着的时候写它正在监视的文件，Windows 会拒绝替换。停掉服务器再写，或重试一次即可。

## 5. 换一台电脑怎么把项目跑起来

```bash
# 1. 装好 Node.js（本项目在 v24 上验证过）
node -v

# 2. 进入项目目录，安装依赖（读 package.json / package-lock.json）
npm install

# 3. 跑测试，确认环境没问题（应该 76 条全过）
npm test

# 4. 启动开发服务器，浏览器打开 http://localhost:5173/
npm run dev
```

只要 `package.json` 和 `package-lock.json` 在，装出来的依赖版本就一致，跟原来那台电脑的路径毫无关系。

## 6. 浏览器要求

需要支持 **WebGL** 的现代浏览器（Chrome / Edge / Firefox / Safari 的近几年版本都可以）。
打不开画面时，先看浏览器控制台有没有 WebGL 相关报错。

---

## `AGENTS.md` 的现状

项目根目录的 `AGENTS.md` **当前是 0 字节（空文件）**。

它的原本用途是"给 AI 助手的协作规矩"，内容包括：

- 每次只做一小步，做完汇报改了哪些文件；
- 每做完一步必须写测试并跑 `npm test`；
- 测试不过就停下来报告，不要自己接着乱改；
- 用大白话解释改了什么（面向看不懂代码的使用者）；
- 不要动 git，存档由使用者自己做；
- 想加没提过的功能，先问。

这些内容目前没有落在这份文档体系的任何位置（`README.md` 里只保留了功能与约定的部分）。
**需要决定**：是把这些协作规矩恢复回 `AGENTS.md`，还是整理进 `docs/` 里单独一份？
