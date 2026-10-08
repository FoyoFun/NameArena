# 设计参考资料（外部，MIT）

本目录是主题层 v2/v3 的设计依据，随仓库提交方便后续接手。两类内容：

## design-md/ —— 视觉规范（来源：VoltAgent/awesome-design-md）

从真实品牌站提炼的 DESIGN.md 设计系统文件。视觉 v2 以 `raycast.md` 为基线适配
（近黑画布 + 表面阶梯 + 1px 发丝线 + 彩色徽章制），金色强调为项目既有身份色、保留。
其余为当时备选：`lamborghini.md`（纯黑金锐利）、`nvidia.md`（黑绿工程）、`spacex.md`（纯黑航空）、
`elevenlabs.md`（浅色，已排除）。

视觉 v3（Melvor 分块排版，决策 #58）的参照为**梅尔沃放置（Melvor Idle）网页版**：
主人提供的官方存档页（下载于本机，未随仓提交，含 game.css）+ 四张游戏截图。
取其意：蓝灰表面阶梯、卡片顶部色条、左侧分组导航、每页题头条；弃其松：卡片密度全面收紧。
图标资产为 game-icons.net 全量包（4180 个 SVG，CC BY 3.0，作者清单见包内 license.txt），
经 `scripts/gen-icons.mjs` 选用 45 个生成 `apps/web/src/icons.ts`，未随仓提交原始包。

## motion-web/ —— 动效方法论（来源：feitangyuan/motion-web）

动效工程参考文档。本次落地用到：

- `motion-tokens.md` —— 时长三档 / 缓动字典 / transform 性能分级 / reduced-motion 阶梯
- `design-slop.md` —— 动效页「AI 味」闸门（静帧先行、忌万能 fade-up、忌全页一个缓动）
- `motion-spec.md` —— 动效规格模板与验收清单
- 其余（pattern-recipes / components / page-design 等）为后续打磨储备

注意：motion-web 的案例代码（WebGL/Canvas 创意站）与本项目无关；本项目动效走
DOM + CSS（DESIGN.md 决策 #9），只借其方法论与 token。
