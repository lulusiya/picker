# vite-plugin-picker

[![CI](https://github.com/lulusiya/picker/actions/workflows/ci.yml/badge.svg)](https://github.com/lulusiya/picker/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/vite-plugin-picker.svg)](https://www.npmjs.com/package/vite-plugin-picker)
[![node](https://img.shields.io/node/v/vite-plugin-picker.svg)](https://www.npmjs.com/package/vite-plugin-picker)
[![license](https://img.shields.io/github/license/lulusiya/picker.svg)](./LICENSE)

**简体中文** | [English](./README.en.md)

在 Vue 3、React 或 Preact 的 Vite 开发页面中按住 `Alt` 移动鼠标，高亮对应 DOM；按住 `Alt` 点击后显示源码绝对路径、行列、组件名和 DOM 层级，并生成可直接交给 AI 的提示词。

![Hold `Alt` to highlight an element, `Alt`-click to get its source location and component chain](./docs/demo.gif)

## 安装

```bash
npm install -D vite-plugin-picker
```

## 使用

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import picker from 'vite-plugin-picker'

export default defineConfig({
  plugins: [picker(), react()],
})
```

Vue 3 项目：

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import picker from 'vite-plugin-picker'

export default defineConfig({
  plugins: [picker(), vue()],
})
```

插件仅在 Vite dev server 中运行，不会进入生产构建。默认支持 Vue 3 `.vue` SFC、`.jsx` 和 `.tsx`。

```ts
picker({
  include: /\.(?:vue|[jt]sx)$/,
  stateDir: '.picker', // 落盘目录；false 关闭；默认 '.picker'
  targets: ['pi', 'codex'], // “发送给”面板选项；默认 []（仅广播）
})
```

## 操作

1. 启动 Vite 开发服务器；页面右下角出现绿色的“Picker 已启用”徽标即表示插件运行成功。
2. 按住 `Alt` 并移动鼠标选择元素。
3. 保持 `Alt` 按下并点击元素。
4. 在元素右下方的小卡片中填写修改要求，点击“复制”把 Prompt 与带行列号的 `src`、表示组件层级关系的 `range` 写入剪贴板。
5. 点“暂存”可把当前元素与要求存进右下角的“暂存夹”，继续选择其他元素；暂存夹支持勾选后批量复制或删除，也可原地编辑每条要求。
6. 点“推送”（或在输入框按 `Enter`，`Shift+Enter` 换行）可把当前选取与修改要求立即推送给所选目标的会话。

## 交给 AI（文件桥）

除了复制到剪贴板，插件还会把选中的元素写到你项目根目录下的 `.picker/`（可用 `stateDir` 改）：

- `.picker/picks.jsonl` — 追加式日志，每行一个 JSON，包含递增 `seq`、`file`/`line`/`column`、组件层级 `chain`、元素 `range`、`targets`，以及填写了修改要求时的 `instruction` 与组好的 `prompt`。
- `.picker/last-pick.md` — **广播（选“全部”）** 时更新的可读快照。
- `.picker/inbox/<agent>.md` — 指定目标时更新的可读快照。
- `.picker/push.json` — 最近一次的推送请求（`once` 时间戳、`target` 目标）。

绝对路径只在本地 Vite 服务内按短 ID 解析，浏览器不会拿到完整路径。建议把 `.picker/` 加入 `.gitignore`（本仓库已忽略）。

> ⚠️ 写文件只是“放在那里”，**不会自动进入任何对话**。必须有一个读取方去拉。

## 让 Agent 读到它（关键）

文件桥是被动的。要在对话里看到选取内容，需要 agent 侧主动读。两种方式：

**1. 手动（零配置，任何 agent 都行）**——在对话里直接说：

> 读一下 `.picker/inbox/pi.md`（或 `.picker/last-pick.md`），按里面的修改要求改代码。

**2. 自动注入（推荐）**——给 agent 装一个钩子，在提交提示时自动读入。包自带 `picker-hook`，任何有 prompt 钩子的 agent 都能用：

```bash
picker-hook --agent claude              # 输出纯文本，Claude Code 会加入上下文
picker-hook --agent codex               # Codex 的 UserPromptSubmit 同样接受纯文本
picker-hook --agent codex --format codex  # 或者用显式的 hookSpecificOutput JSON
```

它保证 **永远以 0 退出**（非 0 会直接拒绝用户在 Claude Code / Codex 里的提示），没有新内容时**什么都不输出**，同一条选取每个 agent 只投递一次。每个 agent 有独立游标，路由给 `codex` 不会消耗掉 `claude` 的那份。

**完整配置（Claude Code / Codex / Pi / MCP，含 Codex 的钩子信任步骤）见 [docs/agents.md](./docs/agents.md)。**

Pi 另外内置了一个扩展 `.pi/extensions/picker-inbox.ts`，支持真正的推送：

| 方式 | 触发 | 行为 |
|---|---|---|
| 拉取 | 你给 Pi 发消息 | 注入最新一条（默认） |
| 推送 | 浏览器点“推送” / 按 `Enter`，或 Pi 按 `ctrl+alt+p` / 输入 `/picker` | 立即注入当前选取 |

Pi 监听 `before_agent_start`，装好后用 `/reload`（或重启 Pi）加载。

> 区别在于：Pi 是**真推送**（轮询 `push.json`，不等你打字就注入）；钩子型 agent 只能在生命周期事件上注入，所以推送的选取会在你**下一次提交提示时**到达。

## 多 agent 路由

浏览器和终端之间没有关联，插件无法自动判断该发给哪个 agent。做法是**显式指定目标**：配置 `targets` 后，选取面板会出现“发送给”选择器，选中某个 agent，这次选取就会额外写入该 agent 的收件箱文件。

```ts
picker({ targets: ['pi', 'codex'] }) // 面板出现 [全部] [pi] [codex]
```

- 选“全部”（默认）→ 只写 `.picker/last-pick.md`。
- 选某个 agent → 只写 `.picker/inbox/<name>.md`（不会污染广播快照）。

每个 agent 在自己的提示词里约定读取自己的收件箱，例如：

> 你是 codex。需要时读 `.picker/inbox/codex.md`，按里面的修改要求改代码。

```
.picker/
├─ picks.jsonl        # 全量日志（每条含 targets 字段）
├─ last-pick.md       # 广播（选“全部”）
├─ push.json          # 推送请求（once / target）
└─ inbox/
   ├─ pi.md           # 发给 pi 的最新一条
   └─ codex.md        # 发给 codex 的最新一条
```

收件箱是“最新一条”语义：同一个 agent 连续两条未读会覆盖前一条；要严格不丢，读全量 `picks.jsonl` 并按 `targets` 过滤。目标名由 `[a-z0-9_-]` 白名单校验，防止路径穿越，且服务端只接受 `targets` 里配置过的名字。

## MCP Server

文件桥之外，包还带一个 MCP server，任何支持 MCP 的客户端（Claude Code、Cursor、Cline 等）都能通过工具拉取选取。

```bash
npm i -D @modelcontextprotocol/sdk zod
```

在客户端的 MCP 配置里加：

```json
{
  "mcpServers": {
    "picker": {
      "command": "npx",
      "args": ["picker-mcp", "--agent", "codex"]
    }
  }
}
```

可用工具：

- `get_new_picks` — 自上次调用以来的新选取（按会话记游标，不会重复）
- `get_last_pick` — 最近一次选取
- `list_picks({ limit })` — 最近的选取列表

`--agent <name>`（或 `PICKER_AGENT`）决定接收哪些定向选取，广播始终接收；`--root <dir>`（或 `PICKER_ROOT`）指定项目根，默认 `process.cwd()`。`@modelcontextprotocol/sdk` 与 `zod` 是可选 peer 依赖，不用 MCP 就不必安装。

## 当前范围

- Vue 3 Single File Components（template 中的原生 DOM 元素）
- React/Preact 风格 JSX、TSX
- 同一页面中的普通 DOM
- 本地 Vite 开发服务器

iframe 和 closed Shadow DOM 暂未支持。Vue 动态组件自身不会被注入属性，但其渲染出的原生 DOM 可以通过组件模板定位。

## 安全性

浏览器 DOM 只包含短定位 ID，绝对路径只在本地 Vite 服务内按 ID 查询。

`/__picker/*` 端点没有鉴权，请把 dev server 绑定在 localhost；详见 [SECURITY.md](./SECURITY.md)。

## License

[MIT](./LICENSE)
