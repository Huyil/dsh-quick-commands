# dsh-quick-commands

Session 面板里的快捷指令：智能体用 `quick_commands` 工具定义「按钮名 + 命令行指令」。**每个会话独立**——指令只属于定义它的那个 Session。**点左侧直接运行**（在会话工作目录执行，运行后自动展开一次显示结果）；**点右侧箭头才展开**，展开后显示简介、指令本身（右上角复制按钮）与最近一次运行结果（退出码 + 输出）；箭头左侧的 ✎ 按钮可重命名。收起时只显示标题与两个按钮。

## 面

1. **工具 `quick_commands`**（智能体调用）
   - `action: list | add | update | remove`
   - `label`：按钮名；`command`：命令行指令本身；`description`：可选 tooltip
   - `id`：update/remove 必填；add 省略时由 label 生成
2. **Session 面板分区「快捷指令」**（`conversation.session.panel.section`，order 150）
   - 每行：左侧点击 = 运行该命令（POST `/quick-commands/run`，运行后自动展开一次）；✎ = 重命名（POST `/quick-commands/update`）；右侧箭头 = 展开/收起；展开区 = 简介 + 指令代码框（右上角复制）+ 最近一次运行结果
   - 没有指令时整个分区不显示
3. **读取路由** `GET /quick-commands/api?session=<id>` → `{ ok, commands }`（浏览器半边用，按会话取）
4. **运行路由** `POST /quick-commands/run` `{ session, id }` → `{ ok, exitCode, stdout, stderr, … }`（只接受该会话已定义的 id，不接受任意命令行）

## 存储

`$DSH_HOME/quick-commands.json`（默认 `~/.dsh/quick-commands.json`），可用插件配置 `storeFile` 覆盖：

```json
{ "version": 2, "sessions": { "session-<id>": [{ "id": "open-d-drive", "label": "打开 D 盘", "command": "explorer.exe D:\\", "description": "…" }] } }
```

旧版（v1 全局 `commands`）读取时移入 `defaults`，不再服务任何会话。

## 运行沙箱

一键运行不经过 Agent 回合，因此没有权限预设可用；由插件配置 `sandboxMode` 决定（默认 `danger-full-access`，与默认预设一致）。`workspace-write` 需要宿主机有可用沙箱后端（bubblewrap / Landlock / sandbox-exec / Windows ACL）。

## 装配

profile 已写入 `dependencies`（link）+ `dsh.profile.bundles`；也可 `dev_inject_plugin` 免重启试跑。

## 构建

```sh
DSH_CHECKOUT=/path/to/deepseek-harness bash scripts/build.sh   # host: tsc → lib/
npx tsdown                                                      # client: lib/client.js
```
