# 项目适配表
> 所有 foyofun-code-* skill 执行前都会参考本表。框架差异都写在这里，skill 正文保持通用。
> （2026-09-27 由 AI 依据调研预填，未确认项标注"待补"，建议主人过目修正）

## 基本信息
- 语言/引擎：TypeScript 全栈（pnpm monorepo）
- 源码根目录：apps/web/src（前端）、apps/server（后端）、packages/core（共享战斗引擎）

## UI 框架
- 框架：Vue 3 Composition API（`<script setup lang="ts">`）+ Pinia + vue-router（hash 路由）
- 生命周期方法：setup / onMounted / onUnmounted（对应 ctor/初始化/OnClose）
- 控件获取与绑定方式：模板 ref + reactive 状态绑定（无控件查找式 API）
- 事件注册/注销 API：组件 emits；跨组件经 Pinia store
- **注销是否框架兜底**：模板内 @监听随组件卸载自动清理；但 setTimeout / MutationObserver / WS 订阅必须手动成对清理（Sequencer 的 waiters、BattleLog 的 observer 均为手写清理范例）
- 定时器 API：原生 setTimeout / setInterval
- 样式方案：**单一全局 theme.css（CSS 变量）+ 少量 scoped 样式**，无 CSS 框架/预处理器（DESIGN.md 决策 #20/#21：换风格 = 重写 theme.css，组件结构不动）

## logic 层
- 模块管理器：Pinia stores（apps/web/src/stores/）
- 协议发送/接收惯例：REST（fetch 封装，具体待补）；战斗回放 = 本地 core 引擎重算，不走网络
- 事件系统 API：无全局事件总线（待确认；房间 WS 推送的消费方式待补）

## 日志
- 日志函数与格式：console.*（待确认是否有封装）

## 已知项目封装分类（供 foyofun-code-api 定向查询）
- @namearena/core：确定性战斗引擎、名字生成、状态定义（STATUS_MAP）
- battle-stage/：Sequencer 播放状态机、VFX 注册表（vfx.ts）、SKILL_EMOJI 映射

## 其他
- 配置表读取方式：packages/core/.../data/ 分层数据表（模组数值）
- 特殊约束：
  - 引擎确定性：packages/core 内禁 Math.random（表现层不受限）
  - 手机竖屏优先，≥900px 桌面增强；触控目标 ≥40px；血条 ≥10px 高、正文 ≥12px
  - 战报只存配置+种子，回放客户端重算
