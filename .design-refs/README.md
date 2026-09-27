# 设计参考资料（外部，MIT）

本目录是主题层 v2 的设计依据，随仓库提交方便后续接手。两类内容：

## design-md/ —— 视觉规范（来源：VoltAgent/awesome-design-md）

从真实品牌站提炼的 DESIGN.md 设计系统文件。本次视觉 v2 以 `raycast.md` 为基线适配
（近黑画布 + 表面阶梯 + 1px 发丝线 + 彩色徽章制），金色强调为项目既有身份色、保留。
其余为当时备选：`lamborghini.md`（纯黑金锐利）、`nvidia.md`（黑绿工程）、`spacex.md`（纯黑航空）、
`elevenlabs.md`（浅色，已排除）。

## motion-web/ —— 动效方法论（来源：feitangyuan/motion-web）

动效工程参考文档。本次落地用到：

- `motion-tokens.md` —— 时长三档 / 缓动字典 / transform 性能分级 / reduced-motion 阶梯
- `design-slop.md` —— 动效页「AI 味」闸门（静帧先行、忌万能 fade-up、忌全页一个缓动）
- `motion-spec.md` —— 动效规格模板与验收清单
- 其余（pattern-recipes / components / page-design 等）为后续打磨储备

注意：motion-web 的案例代码（WebGL/Canvas 创意站）与本项目无关；本项目动效走
DOM + CSS（DESIGN.md 决策 #9），只借其方法论与 token。
