# 名字大乱斗（NameArena）

输入任意名字，生成属于这个名字的角色——属性、能力、性格全部由名字唯一决定。组一支队伍，去挑战别人的队伍、闯 PVE 强敌，或者把朋友们拉进竞技场电子斗蛐蛐。全自动战斗，你只负责观战和押注。

> 一个给小圈子（朋友群）玩的网页游戏。开箱即用，单进程部署，无需数据库服务。

## 玩法速览

- **取名实验室**：输入名字即时预览角色。同名永远生成同一个角色——名字就是存档。力量/智慧/体力/精神/敏捷/幸运六维完全随机分布，尾数和超高属性会触发专属条件能力；全 50 的中庸名字也会触发「中庸之道」。
- **组队**：每支队伍 1~3 人（PVE 最多 6 人），允许重名、允许多打少。
- **竞技**：
  - **挑战数据池**：打别人用过的队伍，对方不在线也能打；
  - **我的队伍互斗**：自己左右手互搏；
  - **PVE 讨伐**：组队讨伐固定强敌（普通 / 困难 / 地狱）。
- **观战**：全自动回合制战斗，带飘字、技能特效、阵营配色战报，可一键复制文字战报贴到聊天群。
- **历史与天梯**：所有战斗只存「配置 + 种子」，随时点开本地重演；每个名字的全服胜率自动记账——天梯就是挖名字的藏宝图。

## 核心设定

| 设定 | 说明 |
|---|---|
| 名字即存档 | 角色由 `hash(名字 + 生成域 + 版本)` 唯一确定，永不改变 |
| 没有废角色 | 低属性自动获得补偿能力、六维图案触发彩蛋能力、随机能力保底必得 |
| 属性不代表强弱 | 伪预算能力抽取 + 条件克制 + 战斗随机性，全 50 的中庸角色也能打 |
| 性格系统 | 激进 / 保守 / 搞事 / 沉稳，只调倾向永不废人（任何性格都不会拒绝攻击） |
| 确定性战斗 | 战斗是纯函数：同配置 + 同种子 = 同结果。服务器只存配置和种子，回放零成本 |
| 节目效果可调 | 集火概率、AI 失手率、行动顺序抖动都是显式参数（见下方调参） |

## 快速开始

要求：Node.js ≥ 20、pnpm ≥ 9（`npm i -g pnpm` 或 corepack enable）。**Docker 部署则无需本机 Node 环境，见下方「部署」节。**

```bash
pnpm install
pnpm seed        # 首次运行：写入示例队伍，让竞技场一开始就有东西可打
pnpm dev:server  # API 服务 → http://localhost:8787
pnpm dev:web     # 前端页面 → http://localhost:5173
```

浏览器打开 http://localhost:5173 即可。首次进入会自动注册匿名身份（昵称#编号）。

## 部署

### Docker（推荐）

```bash
git clone https://github.com/FoyoFun/NameArena.git
cd NameArena
docker compose up -d --build
```

单容器单端口：页面 + API 全在 `8787`，数据存于命名卷 `namearena-data`（SQLite 单文件）。`restart: unless-stopped` 保证随宿主机自启。容器启动时自动执行幂等的 seed（已有数据则跳过）。

常用操作：

```bash
docker compose logs -f                          # 看日志
docker compose down                             # 停止（数据保留在卷中）
docker compose up -d --build                    # 更新代码后重建
docker cp ./data-backup/. namearena:/app/apps/server/data/   # 恢复备份的数据
docker cp namearena:/app/apps/server/data ./data-backup      # 备份数据
```

> 国内拉取 `node:22-slim` 超时时：`docker pull docker.m.daocloud.io/library/node:22-slim && docker tag docker.m.daocloud.io/library/node:22-slim node:22-slim`，Dockerfile 里的 `FROM node:22-slim` 会直接使用本地镜像。依赖安装阶段已配置 npmmirror 源与原生编译兜底。

### 裸机部署

```bash
pnpm install
pnpm build       # 构建前端到 apps/web/dist
pnpm seed        # 可选：写入示例队伍
pnpm start       # 生产模式，监听 0.0.0.0:8787
```

数据全部存放在 `apps/server/data/namearena.db`（SQLite 单文件），备份这个文件就是备份全部状态；删掉它再执行 `pnpm seed` 即可重置世界。

### 配合 frp 内网穿透（手机流量访问）

服务只监听 8787 一个端口。在**部署机**的 frpc 配置中加一段：

```ini
[[proxies]]
name = "namearena"
type = "tcp"
localIP = "127.0.0.1"   # frpc 与服务同机时；若 frpc 是容器且与 namearena 同一 docker 网络，填容器名 "namearena"
localPort = 8787
remotePort = 8787       # frp 服务器上对外暴露的端口
```

重载 frpc 后，手机流量访问 `http://frp服务器地址:8787` 即可。需要 HTTPS/域名时在 frp 服务器侧配置，或用 Caddy/Nginx 反代 8787（前端为 hash 路由，无需额外配置）。

## 定制指南

所有游戏内容都是数据或独立文件，改完保存即生效（引擎会自动使用新内容）。**改任何数值后建议跑一遍批量模拟**，确认胜率分布符合预期。

### 调整属性与战斗数值

| 想改什么 | 文件 |
|---|---|
| 六维→战斗属性的换算（力量加多少攻击…） | `packages/core/src/mods/normal/data/stat-weights.ts` |
| 六维随机分布（出高属性的概率、区间） | `packages/core/src/mods/normal/data/stat-distribution.ts` |
| 战斗公式（伤害/命中/暴击/回合上限/集火概率/AI 手气…） | `packages/core/src/mods/normal/data/formulas.ts` |

每项都带注释说明含义与联动关系。常用旋钮：`targetFocusBias`（集火概率，越小越乱）、`aiTopK`（AI 选技名单调度）、`roundJitter`（行动顺序抖动）、`stopLambda`（角色能力越多越难抽的曲线）。

验证工具：

```bash
pnpm sim -- 张三 李四 王五 --vs 赵六 钱七 孙八 -n 300   # 两队批量对打，输出胜率分布
pnpm sim -- 孙悟空 猪八戒 --pve slime-king -n 100      # PVE 批量模拟
pnpm diag                                             # 战斗事件流不变量扫描（数值回归体检）
pnpm test                                             # 引擎单元测试
```

### 增加一个技能

每个能力一个文件。复制 `packages/core/src/mods/normal/abilities/heavy-slash.ts` 改造：

```ts
import { defineAbility } from './define';

export default defineAbility({
  id: 'my-skill',            // 全局唯一
  name: '我的技能',
  kind: 'active',            // active=主动 | passive=被动
  cost: 3,                   // 伪预算权值：越强越容易终止随机抽取
  weight: 1,                 // 抽取权重
  stackable: false,
  desc: '造成 200% 物理伤害。',
  tags: ['attack'],          // AI 分类：attack | heal | buff | control
  active: {
    mpCost: 12,
    cooldown: 1,
    target: 'enemy',         // enemy | allEnemies | ally | allAllies | self
    effects: [{ type: 'damage', kind: 'phys', scale: 2.0 }],
  },
  vfx: 'slash',              // 战斗特效 id（见 battle-stage/vfx.ts 注册表）
});
```

然后在 `abilities/index.ts` 的列表里加一行。被动的属性加成用 `passiveStatMods`，机制类能力（连动、改消耗、复活…）用 `hooks`，参考 `double-action.ts`、`hp-overcharge.ts`、`phoenix.ts`。

### 增加条件能力 / 六维图案彩蛋

在 `data/conditional-rules.ts` 加一条规则（区间命中、顺子、六维极差等匹配器已内置），并给 `grant` 指向的能力建文件。示例：`zhongyong.ts`（中庸之道）、`straight-five.ts`（顺子）。

### 增加 PVE Boss

在 `data/bosses.ts` 加一行：固定六维 + 从现有能力表选配技能组 + 性格。数值用 `pnpm sim --pve` 校准。

### 增加一个全新模组

模组 = 数值体系 + 战斗规则 + 敌方来源的完整体。参考 `mods/normal/`：

1. 新建 `mods/<你的模组>/`，实现 `engine` 定义的 `Mod` 接口（属性元数据 `stats`、生成函数 `generateCharacter`、规则集 `rules`、人数约束 `team`）；
2. 战斗主循环由你书写，引擎提供状态容器 / 种子随机 / 事件发射（回合制参考 `normal/rules/ruleset.ts`；将来做 ATB 只需换这个循环）；
3. 在 `mods/index.ts` 注册。同一玩法想分 PVP/PVE 两个入口，照 `normal` 的做法：一个规则包派生两个注册实例（生成域 `genKey` 相同则同名同角色）。

### 战报文案

战斗日志支持轻量标记（渲染为配色战报，不用则纯文本）：`@单位uid@` 名字徽章、`+…+` 增益绿、`~…~` 减益红、`#…#` 属性词黄。

## 架构一览

TypeScript 全栈 pnpm monorepo：

- `packages/core`——确定性战斗引擎与全部模组内容（纯函数，前后端共享，禁止 Math.random）；
- `apps/server`——Fastify：身份 / 队伍 / 数据池 / 战斗裁判 / 天梯，SQLite 存储（Drizzle ORM）；
- `apps/web`——Vue 3：取名 / 组队 / 竞技 / 观战播放器 / 历史 / 天梯；战斗表现由通用播放器按事件流渲染。

设计原则与完整决策记录见 [DESIGN.md](./DESIGN.md)（模组契约：框架管"名字→种子"与"事件→表现"，模组管"种子→角色"与"怎么打仗、要什么表现"）。

## 常见问题

- **改了数值老角色会变吗？** 会。属性由种子决定，改分布表/权重/公式都会重roll。若要保护已挖掘的名字，请在改动时递增 `NORMAL_GEN_VERSION` 并自行评估。
- **pnpm install 提示忽略构建脚本？** 仓库已配置 `onlyBuiltDependencies`（better-sqlite3 等原生依赖），正常执行 `pnpm install` 即可；若提示交互确认，选择允许即可。
- **想清空战绩重来？** 停服 → 删除 `apps/server/data/` → `pnpm seed`。
