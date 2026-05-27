# NarrativeOS 深度分析 TodoList

## 一、基础设施层
- [x] package.json / pnpm-workspace.yaml / .env.example
- [ ] docker-compose.yml / start-server.ps1

## 二、数据层 (packages/database)
- [x] schema.ts — 全量表结构
- [x] index.ts — 连接池与 Drizzle ORM 初始化
- [x] drizzle.config.ts — 迁移配置
- [x] migrations snapshot

## 三、LLM 客户端 (packages/llm-client)
- [x] types.ts — 类型定义
- [x] models.ts — 模型配置表
- [x] client.ts — 路由分发器
- [x] providers/openai-compatible.ts — DeepSeek / OpenAI / 硅基流动
- [x] providers/anthropic-compatible.ts — Anthropic 端点
- [x] cost.ts — DeepSeek v4 定价
- [x] tokenizer.ts — 分词器

## 四、Agent 引擎层 (packages/agents) — 核心主动式架构
- [x] types.ts — Agent 领域类型
- [x] base.ts — 抽象基类（并发锁、流式/非流式双模式、降级）
- [x] registry.ts — Agent 注册表（工厂模式解耦）
- [x] orchestrator.ts — 提案 staging → approve → 设定锁定
- [x] scheduler.ts — 主动式调度引擎
- [x] engine-config.ts — 引擎配置
- [x] event-bus.ts — 事件总线
- [x] world-context.ts — 世界观上下文管理
- [x] agents/*.ts — 各具体 Agent 实现
- [x] handlers/*.ts — 后端请求处理器

## 五、Companion 层 (packages/companion)
- [x] types.ts / agent.ts / registry.ts / schema-mapper.ts

## 六、后端路由层 (apps/server)
- [x] index.ts — Hono 主入口 + 中间件挂载
- [x] ws-bus.ts — WebSocket 事件总线
- [x] routes/projects.ts — 项目 CRUD
- [x] routes/sessions.ts — 会话 + SSE
- [x] routes/hatch.ts — 设定集孵化（7+ HTTP 接口）
- [x] routes/outline.ts — 大纲引擎（新）
- [x] routes/brainstorm.ts — 创意脑暴（新）
- [x] routes/companion.ts — Companion 接口（新）
- [x] routes/llm-logs.ts — 审计日志
- [x] services/chat.ts — LLM 懒加载 + 错误降级

## 七、前端层 (apps/web)
- [x] vite.config.ts / main.tsx / index.css — 工程配置
- [x] api/client.ts — 前端 HTTP 客户端
- [x] stores/*.ts — 所有 Zustand 状态管理
- [x] pages/*.tsx — 页面级组件
- [x] components/editor/*.tsx — 编辑器组件
- [x] components/project/*.tsx — 项目组件
- [x] components/ui/*.tsx — UI 基础组件
- [x] hooks/useAutoScroll.ts — 自定义 Hook
- [x] utils/entityConfig.ts — 实体配置

## 八、数据流转全景图
- [ ] 从项目创建 → Agent 孵化 → 提案审批 → 设定入库 → 大纲生成 → 章节大纲 的完整链路
- [ ] 多引擎协作：HatchingEngine + OutlineEngine + CompanionEngine
- [ ] 流式数据：SSE + WebSocket 双通道
- [ ] 事件总线：后端跨模块通信机制

## 九、综合报告撰写
- [ ] 架构全景图
- [ ] 各引擎职责与交互
- [ ] 数据流转时序
- [ ] 已知问题与改进建议
