# NarrativeOS v3.0 Sovereign — 工程实施、部署与运维文档

> 版本：v3.0  
> 日期：2025年6月  
> 状态：工程实施文档  
> 目标读者：核心开发团队、DevOps工程师、技术负责人

---

# 第十四章：完整实施路线图

## 14.1 路线图总览

| Phase | 名称 | 周期 | 核心产出 | 关键里程碑 |
|-------|------|------|----------|------------|
| Phase 0 | 骨架搭建 | 第1-2周 | 数据库Schema、XState空壳、CLI框架、服务接口 | 可编译运行的空壳 |
| Phase 1 | 最小闭环 | 第3-6周 | LLM接入、最简世界/工作室引擎、MOU流程、基础前端 | 可完成一次完整MOU |
| Phase 2 | 智能增强 | 第7-10周 | 谏官、Flow Guardian、pgvector检索、版本管理 | 100万字上下文支撑 |
| Phase 3 | 深度世界 | 第11-14周 | 分层推演、程序化环境、涟漪模拟、先例引擎 | 世界自洽运行 |
| Phase 4 | 叙事灵魂 | 第15-18周 | 类型内核、AMA蒸馏、知识图谱、读者预期引擎 | 叙事风格可感知 |
| Phase 5 | 工业化 | 第19-22周 | 性能优化、多项目、Docker部署、测试覆盖 | 生产就绪 |

**总工期：22周（约5.5个月）**

---

## 14.2 Phase 0：骨架搭建（第1-2周）

### 目标
建立可编译运行、包含所有模块接口但内部为空的代码骨架，确立开发规范和技术基线。

### 第1周详细任务

| 天 | 任务 | 负责人 | 验收标准 | 依赖 |
|----|------|--------|----------|------|
| D1 | 初始化monorepo结构，配置pnpm workspaces，创建目录规范 | 架构师 | `pnpm install`成功，目录结构符合规范 | 无 |
| D1 | 配置TypeScript编译器（tsconfig.json），建立严格的类型检查基线 | 架构师 | `tsc --noEmit`无错误 | monorepo |
| D1 | 配置ESLint + Prettier，建立代码风格规范 | 架构师 | `pnpm lint`通过 | monorepo |
| D2 | 设计并创建数据库核心Schema（用户、项目、章节、世界设定、角色等基础表） | DBA | `prisma migrate dev`成功执行 | TypeScript配置 |
| D2 | 配置pgvector扩展，设计向量表结构（embedding字段、索引策略） | DBA | `CREATE EXTENSION vector;`成功，测试向量插入/检索 | Schema |
| D3 | 定义XState状态机接口：MOU状态机、工作室状态机、世界引擎状态机 | 核心后端 | 状态机文件能编译，包含所有状态和转换定义 | TypeScript配置 |
| D3 | 创建服务接口定义文件（IWorldService, IStudioService, ILLMService等） | 核心后端 | 接口完整，使用TypeScript interface定义 | 无 |
| D4 | 搭建CLI框架（Commander.js），实现基础命令注册、配置加载、日志输出 | CLI开发 | `narrative-os --help`显示所有命令 | 服务接口 |
| D4 | 实现数据库连接层（Prisma Client封装），包含连接池配置 | DBA | 单元测试：连接/断开/重连 | Schema |
| D5 | 实现配置管理模块（环境变量、本地配置文件、默认值） | 核心后端 | 所有配置项可覆盖，敏感信息不提交到仓库 | 无 |

### 第2周详细任务

| 天 | 任务 | 负责人 | 验收标准 | 依赖 |
|----|------|--------|----------|------|
| D6 | 定义LLM服务抽象接口（ILLMProvider），支持OpenAI/Anthropic/本地模型 | 核心后端 | 接口包含complete/chat/embeddings方法 | 无 |
| D7 | 实现HTTP API框架（Fastify），配置路由、中间件、错误处理 | 后端开发 | `/health`返回200，路由自动注册 | 服务接口 |
| D7 | 配置基础前端项目（React + Vite + TypeScript），实现项目脚手架 | 前端开发 | `pnpm dev`启动开发服务器 | monorepo |
| D8 | 实现基础认证中间件（API Key + JWT Token双模式） | 后端开发 | 单元测试：有效Token通过，无效Token拒绝 | HTTP API |
| D9 | 编写Phase 0集成测试，确保端到端可运行 | QA | `pnpm test:integration`全部通过 | 所有D1-D8任务 |
| D10 | Phase 0代码审查、文档更新、技术债务标记 | 架构师 | PR合并，文档同步 | 集成测试 |

### Phase 0 验收标准（Definition of Done）
1. [ ] `pnpm install && pnpm build && pnpm test` 在干净环境中一次性成功
2. [ ] 数据库Schema包含至少20张核心表，所有表有注释
3. [ ] XState状态机包含MOU、工作室、世界引擎三个主状态机，每个至少5个状态
4. [ ] CLI可运行并显示帮助信息，至少包含5个命令
5. [ ] Web服务可启动，`/health`和`/api/v1/docs`可访问
6. [ ] 前端可访问，显示基础布局
7. [ ] 所有代码通过ESLint和TypeScript严格模式检查
8. [ ] 代码覆盖率不低于30%（主要覆盖工具和基础设施）

---

## 14.3 Phase 1：最小闭环（第3-6周）

### 目标
实现NarrativeOS的核心闭环：作者从创建项目 → 世界设定 → 编写章节 → AI辅助生成 → 作者确认 → 输出的完整MOU流程。

### 第3-4周：LLM接入与世界引擎

| 天 | 任务 | 负责人 | 验收标准 | 依赖 |
|----|------|--------|----------|------|
| D11-12 | 实现OpenAI Provider（GPT-4o/GPT-4o-mini），包含重试、超时、流式输出 | 核心后端 | 单元测试：成功调用、失败重试、流式接收 | Phase 0 |
| D13 | 实现Anthropic Provider（Claude 3.5 Sonnet/Haiku），统一接口 | 核心后端 | 与OpenAI Provider通过相同测试套件 | OpenAI Provider |
| D14 | 实现LLM路由层（根据模型名自动选择Provider） | 核心后端 | 配置文件中切换模型无需改代码 | 双Provider |
| D15 | 实现提示词模板引擎（Handlebars），建立模板加载和渲染机制 | 核心后端 | 单元测试：模板渲染、变量替换、条件逻辑 | LLM路由 |
| D16-17 | 实现最简世界引擎（World Engine）：设定存储、检索、基础一致性检查 | 后端开发 | 可CRUD世界设定，基础字段校验 | 数据库 |
| D18-19 | 实现工作室引擎（Studio Engine）：项目配置、大纲管理、章节列表 | 后端开发 | 可创建项目、添加章节、排序 | 世界引擎 |
| D20 | 集成世界引擎和工作室引擎到CLI命令 | CLI开发 | CLI可创建项目和章节 | 双引擎 |

### 第5-6周：MOU流程与前端

| 天 | 任务 | 负责人 | 验收标准 | 依赖 |
|----|------|--------|----------|------|
| D21-23 | 实现完整MOU状态机（6个阶段：初始化→大纲→起草→审阅→修订→确认） | 核心后端 | XState状态机完整运行，状态转换正确 | Phase 0 XState |
| D24-25 | 实现MOU服务层：上下文组装、LLM调用、输出生成、修订跟踪 | 核心后端 | 可完成一次完整的6阶段MOU | MOU状态机 |
| D26-27 | 实现基础前端：项目列表、编辑器、MOU交互面板、历史记录 | 前端开发 | 可完成MOU全流程操作 | MOU服务 |
| D28-30 | 集成测试：端到端MOU流程，修复关键Bug | QA | 自动化测试覆盖完整MOU流程 | 前端+后端 |
| 缓冲 | Bug修复、文档更新、性能基线测试 | 全员 | Phase 1所有DoD项达标 | 所有任务 |

### Phase 1 验收标准
1. [ ] 作者可通过前端或CLI完成一次完整MOU（从空白项目到输出章节）
2. [ ] 支持至少2种LLM Provider（OpenAI + Anthropic）
3. [ ] MOU状态机完整运行，状态转换日志可查看
4. [ ] 可创建和管理至少3个项目，每个项目50+章节
5. [ ] 前端页面在Chrome/Firefox/Edge最新版正常显示
6. [ ] 单元测试覆盖率不低于50%
7. [ ] 集成测试覆盖核心业务流程

---

## 14.4 Phase 2：智能增强（第7-10周）

### 目标
引入智能辅助系统：谏官（Advisor）、Flow Guardian、pgvector上下文检索，使系统能支撑100万字以上长篇创作的上下文管理。

### 第7-8周：谏官与Flow Guardian

| 天 | 任务 | 负责人 | 验收标准 | 依赖 |
|----|------|--------|----------|------|
| D31-33 | 实现谏官系统（Advisor）：设计审查提示词、调用LLM生成建议、建议评级 | AI工程师 | 谏官能识别大纲逻辑漏洞并给出建议 | Phase 1 MOU |
| D34-35 | 实现Flow Guardian：写作节奏检测、水文预警、节奏偏离告警 | AI工程师 | 能识别连续3章无冲突的场景并告警 | Phase 1 MOU |
| D36-37 | 实现建议过滤与优先级排序：基于作者历史采纳率的个性化排序 | AI工程师 | 高采纳率类型建议排在前面 | 谏官 |
| D38-40 | 集成谏官和Flow Guardian到MOU流程，在审阅阶段触发 | 后端开发 | MOU审阅阶段自动触发建议生成 | 双系统 |

### 第9-10周：pgvector与版本管理

| 天 | 任务 | 负责人 | 验收标准 | 依赖 |
|----|------|--------|----------|------|
| D41-42 | 实现文本向量化流水线：章节分块 → Embedding生成 → pgvector存储 | AI工程师 | 100万字文本可在30分钟内完成向量化 | pgvector配置 |
| D43-44 | 实现语义检索引擎：向量相似度查询 + 关键词混合检索 + 时间衰减 | AI工程师 | 检索延迟<200ms（100万字数据） | 向量化 |
| D45-46 | 实现版本管理系统：章节版本存储、Diff对比、回滚操作 | 后端开发 | 可查看任意章节的历史版本，一键回滚 | 数据库 |
| D47-48 | 实现上下文组装优化：基于语义检索自动选择相关上下文片段 | AI工程师 | LLM输入token减少30%同时保持相关性 | 语义检索 |
| D49-50 | Phase 2集成测试、性能测试（100万字数据集）、Bug修复 | QA | 100万字场景下响应时间达标 | 所有任务 |

### Phase 2 验收标准
1. [ ] 谏官系统能在30秒内生成有针对性的设计建议
2. [ ] Flow Guardian能检测写作节奏问题并给出预警
3. [ ] pgvector语义检索在100万字数据下延迟<200ms
4. [ ] 版本管理系统支持无限版本历史，回滚操作<1秒
5. [ ] 上下文检索准确率>80%（人工评估）
6. [ ] 系统整体内存占用<8GB（100万字项目运行时）
7. [ ] 单元测试覆盖率不低于60%

---

## 14.5 Phase 3：深度世界（第11-14周）

### 目标
让世界引擎具备自洽推演能力，实现分层时间线、程序化环境生成、因果关系追踪。

### 第11-12周：分层推演与程序化环境

| 天 | 任务 | 负责人 | 验收标准 | 依赖 |
|----|------|--------|----------|------|
| D51-53 | 实现分层推演引擎：宏观（大陆级）→中观（城市级）→微观（场景级） | AI工程师 | 三个层级可独立推演，结果一致 | 世界引擎 |
| D54-55 | 实现时间线引擎：绝对时间/相对时间双轨制，事件前后关系图 | 后端开发 | 可查询任意时间点的世界状态 | 分层推演 |
| D56-57 | 实现程序化环境生成器：气候、地理、文化、经济系统 | AI工程师 | 输入种子参数生成一致的世界设定 | 时间线引擎 |
| D58-60 | 集成推演系统到世界引擎API，前端可视化时间线 | 全栈 | 前端可查看和编辑时间线 | 程序化环境 |

### 第13-14周：涟漪模拟与先例引擎

| 天 | 任务 | 负责人 | 验收标准 | 依赖 |
|----|------|--------|----------|------|
| D61-63 | 实现涟漪模拟系统：事件传播模型、影响范围计算、连锁反应检测 | AI工程师 | 输入一个事件，系统能推导3级影响 | 时间线引擎 |
| D64-65 | 实现先例引擎：历史案例存储、模式匹配、教训提取 | AI工程师 | 可检索相似历史事件作为参考 | 涟漪模拟 |
| D66-67 | 实现特殊能力管理器：能力定义、约束规则、冲突检测 | 后端开发 | 能力使用符合设定规则，冲突自动检测 | 先例引擎 |
| D68-70 | Phase 3集成测试、世界一致性压力测试 | QA | 1000个事件并发推演结果一致 | 所有任务 |

### Phase 3 验收标准
1. [ ] 分层推演在三个层级上结果一致
2. [ ] 涟漪模拟能正确推导事件的多级影响
3. [ ] 先例引擎检索准确率>75%
4. [ ] 特殊能力管理器能检测90%以上的能力使用冲突
5. [ ] 世界引擎支持1000+个实体同时推演
6. [ ] 系统在高负载下内存占用<12GB
7. [ ] 单元测试覆盖率不低于65%

---

## 14.6 Phase 4：叙事灵魂（第15-18周）

### 目标
赋予系统叙事审美能力：类型内核编辑器、AMA知识蒸馏、知识图谱、读者预期引擎。

### 第15-16周：类型内核与AMA蒸馏

| 天 | 任务 | 负责人 | 验收标准 | 依赖 |
|----|------|--------|----------|------|
| D71-73 | 实现类型内核编辑器：流派规则定义、爽点/毒点标记、节奏模板 | AI工程师 | 支持10+网文类型的内核定义 | Phase 2 |
| D74-75 | 实现AMA蒸馏系统：对话式知识提取、结构化存储、置信度评估 | AI工程师 | 5轮对话可提取完整的设定知识 | 类型内核 |
| D76-77 | 实现知识蒸馏流水线：原始对话→结构化数据→验证→入库 | AI工程师 | 蒸馏数据人工审核准确率>85% | AMA蒸馏 |
| D78-80 | 集成类型内核到MOU流程，在起草阶段应用流派规则 | 后端开发 | 生成内容符合选定类型的风格 | 蒸馏流水线 |

### 第17-18周：知识图谱与读者预期

| 天 | 任务 | 负责人 | 验收标准 | 依赖 |
|----|------|--------|----------|------|
| D81-83 | 实现知识图谱引擎：实体抽取、关系建立、图查询 | AI工程师 | 支持100万+节点，查询延迟<500ms | AMA蒸馏 |
| D84-85 | 实现故事线引擎：多线并行、交叉点检测、节奏控制 | AI工程师 | 可追踪5条以上故事线的交叉 | 知识图谱 |
| D86-87 | 实现读者预期引擎：爽点埋设、预期引导、反转设计辅助 | AI工程师 | 能建议在合适位置埋设爽点 | 故事线 |
| D88-90 | Phase 4集成测试、叙事质量评估（人工评审） | QA | 人工评审叙事质量得分>4/5 | 所有任务 |

### Phase 4 验收标准
1. [ ] 类型内核支持至少10种网文类型
2. [ ] AMA蒸馏数据准确率>85%（人工审核）
3. [ ] 知识图谱支持100万+节点，查询延迟<500ms
4. [ ] 故事线引擎可管理5条以上并行故事线
5. [ ] 读者预期引擎建议被作者采纳率>60%
6. [ ] 人工评审叙事质量得分>4/5
7. [ ] 单元测试覆盖率不低于70%

---

## 14.7 Phase 5：工业化（第19-22周）

### 目标
将系统打磨为生产级产品：性能优化、多项目支持、Docker部署、完整测试覆盖。

### 第19-20周：性能优化与多项目

| 天 | 任务 | 负责人 | 验收标准 | 依赖 |
|----|------|--------|----------|------|
| D91-93 | 数据库查询优化：慢查询分析、索引优化、查询重写 | DBA | 所有API响应P99<500ms | Phase 4 |
| D94-95 | LLM调用优化：响应缓存、批量请求、Token使用优化 | 后端开发 | LLM API调用成本降低40% | DBA优化 |
| D96-97 | 多项目架构重构：项目隔离、资源共享、并发控制 | 架构师 | 单实例支持10+项目同时运行 | LLM优化 |
| D98-100 | 内容安全系统：敏感词过滤、合规检查、审核日志 | 后端开发 | 通过安全审计 | 多项目 |

### 第21-22周：部署与测试

| 天 | 任务 | 负责人 | 验收标准 | 依赖 |
|----|------|--------|----------|------|
| D101-103 | Docker多阶段构建、docker-compose编排、Swarm配置 | DevOps | `docker compose up`一键启动 | 多项目 |
| D104-105 | 完善CI/CD流水线：GitHub Actions、自动测试、自动部署 | DevOps | Push触发完整流水线<15分钟 | Docker |
| D106-107 | 测试覆盖率提升至80%：补充边界测试、异常测试 | QA | 覆盖率报告>80% | CI/CD |
| D108-110 | 生产环境部署验证、监控配置、文档最终审查 | DevOps+全员 | 生产环境稳定运行24小时 | 所有任务 |

### Phase 5 验收标准
1. [ ] 所有API响应P99<500ms
2. [ ] LLM API调用成本比Phase 1降低40%
3. [ ] 单实例支持10+项目同时运行
4. [ ] Docker一键部署，启动时间<2分钟
5. [ ] CI/CD流水线<15分钟
6. [ ] 测试覆盖率>80%
7. [ ] 通过安全审计
8. [ ] 生产环境稳定运行24小时无崩溃
9. [ ] 完整的技术文档和用户手册

---

## 14.8 依赖关系图

```
Phase 0 [骨架]
    │
    ├── 数据库Schema ──→ 所有后续Phase
    ├── XState状态机 ──→ Phase 1 MOU
    ├── 服务接口定义 ──→ Phase 1 服务实现
    └── CLI框架 ──────→ Phase 1 CLI命令

Phase 1 [最小闭环]
    │
    ├── LLM Provider ──→ Phase 2 谏官/Flow Guardian
    ├── MOU状态机 ─────→ Phase 2 上下文检索
    ├── 世界引擎 ──────→ Phase 3 分层推演
    └── 工作室引擎 ────→ Phase 4 类型内核

Phase 2 [智能增强]
    │
    ├── 谏官 ──────────→ Phase 4 知识图谱
    ├── Flow Guardian ─→ Phase 4 读者预期
    ├── pgvector ──────→ Phase 3 涟漪模拟（数据基础）
    └── 版本管理 ──────→ Phase 5 多项目

Phase 3 [深度世界]
    │
    ├── 分层推演 ──────→ Phase 4 故事线引擎
    ├── 涟漪模拟 ──────→ Phase 4 读者预期
    └── 先例引擎 ──────→ Phase 4 知识图谱

Phase 4 [叙事灵魂]
    │
    ├── 知识图谱 ──────→ Phase 5 性能优化（查询优化）
    └── 读者预期 ──────→ Phase 5 内容安全

Phase 5 [工业化]
    │
    └── 所有模块 ──────→ 生产就绪
```

---

## 14.9 人力资源估算

| 角色 | Phase 0 | Phase 1 | Phase 2 | Phase 3 | Phase 4 | Phase 5 | 总计 |
|------|---------|---------|---------|---------|---------|---------|------|
| 架构师 | 1.0 | 0.5 | 0.3 | 0.3 | 0.3 | 0.5 | 2.9 |
| 核心后端 | 1.0 | 1.0 | 0.5 | 0.3 | 0.3 | 0.3 | 3.4 |
| AI工程师 | 0.0 | 0.5 | 1.0 | 1.0 | 1.0 | 0.5 | 4.0 |
| 后端开发 | 0.5 | 1.0 | 0.8 | 0.5 | 0.3 | 0.5 | 3.6 |
| 前端开发 | 0.3 | 1.0 | 0.5 | 0.5 | 0.5 | 0.3 | 3.1 |
| CLI开发 | 0.5 | 0.5 | 0.3 | 0.0 | 0.0 | 0.0 | 1.3 |
| DBA | 0.5 | 0.3 | 0.5 | 0.3 | 0.3 | 0.5 | 2.4 |
| DevOps | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 1.0 | 1.0 |
| QA | 0.3 | 0.5 | 0.5 | 0.5 | 0.5 | 1.0 | 3.3 |
| **FTE合计** | **4.1** | **6.3** | **5.4** | **4.4** | **4.2** | **4.6** | **29.0** |

> FTE = Full Time Equivalent（全职人力当量）。建议核心团队5-6人，部分角色可兼职或由其他角色兼任。

---

# 第十五章：开发环境与部署

## 15.1 开发环境搭建指南

### 15.1.1 Windows 原生开发环境

#### A. Node.js LTS 版本安装

```powershell
# 使用 nvm-windows 管理 Node.js 版本
# 1. 下载安装 nvm-windows
winget install CoreyButler.NVMforWindows

# 2. 安装 Node.js LTS (v20.x)
nvm install 20.15.0
nvm use 20.15.0
nvm alias default 20.15.0

# 3. 验证安装
node --version  # v20.15.0
npm --version   # 10.7.0

# 4. 启用 pnpm
corepack enable
pnpm --version  # 9.x
```

#### B. TypeScript 编译器配置

```json
// tsconfig.json — 根配置文件
{
  "compilerOptions": {
    /* 语言与目标 */
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,

    /* 严格类型检查 */
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,

    /* 模块与路径 */
    "baseUrl": ".",
    "paths": {
      "@narrative-os/core": ["packages/core/src"],
      "@narrative-os/world-engine": ["packages/world-engine/src"],
      "@narrative-os/studio-engine": ["packages/studio-engine/src"],
      "@narrative-os/llm-service": ["packages/llm-service/src"],
      "@narrative-os/advisor": ["packages/advisor/src"],
      "@narrative-os/shared": ["packages/shared/src"],
      "@narrative-os/web": ["apps/web/src"],
      "@narrative-os/cli": ["apps/cli/src"]
    },

    /* 输出配置 */
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": ".",
    "removeComments": false,

    /* 装饰器与元数据 */
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,

    /* 互操作 */
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,

    /* 性能 */
    "incremental": true,
    "tsBuildInfoFile": "./.tsbuildinfo"
  },
  "include": ["packages/*/src/**/*", "apps/*/src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts", "**/*.spec.ts"]
}
```

#### C. PostgreSQL 16 Windows 版安装

```powershell
# 方法1：使用 winget（推荐）
winget install PostgreSQL.PostgreSQL.16

# 方法2：使用安装程序
# 下载地址：https://www.postgresql.org/download/windows/
# 选择 PostgreSQL 16.x Win x64

# 安装步骤：
# 1. 运行安装程序，选择安装目录（默认 C:\Program Files\PostgreSQL\16）
# 2. 设置数据目录（默认 C:\Program Files\PostgreSQL\16\data）
# 3. 设置超级用户（postgres）密码
# 4. 选择端口号（默认 5432）
# 5. 选择Locale（推荐 C 或 Chinese (Simplified)_China.936）
# 6. 完成安装，Stack Builder 中选择 pgvector 扩展（如果可用）

# 验证安装
psql -U postgres -c "SELECT version();"
# PostgreSQL 16.x on x86_64-pc-windows-gnu, compiled by ...

# 创建开发数据库
psql -U postgres -c "CREATE DATABASE narrative_os_dev;"
psql -U postgres -c "CREATE USER narrative_dev WITH PASSWORD 'dev_password_123';"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE narrative_os_dev TO narrative_dev;"
```

#### D. pgvector 在 Windows 上的编译安装

```powershell
# pgvector 在 Windows 上需要手动编译安装

# 前置条件：
# 1. 安装 Visual Studio Build Tools（MSVC）
winget install Microsoft.VisualStudio.2022.BuildTools
# 在安装器中选择：
#   - 使用 C++ 的桌面开发
#   - MSVC v143 x64/x86 生成工具
#   - Windows SDK

# 2. 安装 PostgreSQL 开发包（通常随 PostgreSQL 一起安装）
# 确认 $env:PGROOT 环境变量已设置
$env:PGROOT = "C:\Program Files\PostgreSQL\16"

# 3. 下载 pgvector 源码
cd C:\temp
Invoke-WebRequest -Uri "https://github.com/pgvector/pgvector/archive/refs/tags/v0.7.0.tar.gz" -OutFile "pgvector-0.7.0.tar.gz"
tar -xzf pgvector-0.7.0.tar.gz
cd pgvector-0.7.0

# 4. 编译安装
# 打开 "x64 Native Tools Command Prompt for VS 2022"（管理员权限）
nmake /F Makefile.win
nmake /F Makefile.win install

# 5. 验证安装
psql -U postgres -d narrative_os_dev -c "CREATE EXTENSION IF NOT EXISTS vector;"
psql -U postgres -d narrative_os_dev -c "SELECT * FROM pg_extension WHERE extname = 'vector';"

# 6. 测试向量操作
psql -U postgres -d narrative_os_dev -c "SELECT '[1,2,3]'::vector <=> '[4,5,6]'::vector AS distance;"
```

#### E. VSCode 推荐配置

```json
// .vscode/settings.json
{
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "editor.rulers": [80, 120],
  "editor.tabSize": 2,
  "editor.insertSpaces": true,
  "files.eol": "\n",
  "files.trimTrailingWhitespace": true,
  "files.insertFinalNewline": true,
  "eslint.workingDirectories": [{"mode": "auto"}],
  "cSpell.words": [
    "narrativeos",
    "pgvector",
    "xstate",
    "zustand",
    "fastify",
    "prisma",
    "vitest",
    "handlebars",
    "zod"
  ],
  "sqltools.connections": [
    {
      "name": "NarrativeOS Dev",
      "driver": "PostgreSQL",
      "server": "localhost",
      "port": 5432,
      "database": "narrative_os_dev",
      "username": "narrative_dev",
      "password": "dev_password_123"
    }
  ]
}
```

**VSCode 推荐插件列表：**

| 插件ID | 用途 | 必需 |
|--------|------|------|
| `esbenp.prettier-vscode` | 代码格式化 | 是 |
| `dbaeumer.vscode-eslint` | ESLint集成 | 是 |
| `Prisma.prisma` | Prisma语法高亮 | 是 |
| `bradlc.vscode-tailwindcss` | Tailwind CSS提示 | 是 |
| `dsznajder.es7-react-js-snippets` | React代码片段 | 推荐 |
| `ms-vscode.vscode-typescript-next` | TypeScript最新版 | 推荐 |
| `orta.vscode-jest` / `ZixuanChen.vitest-explorer` | 测试运行器 | 是 |
| `mtxr.sqltools` + `mtxr.sqltools-driver-pg` | SQL工具 | 推荐 |
| `eamodio.gitlens` | Git增强 | 推荐 |
| `streetsidesoftware.code-spell-checker` | 拼写检查 | 推荐 |
| `xstate.hq` | XState可视化 | 是 |
| `yzhang.markdown-all-in-one` | Markdown增强 | 推荐 |
| `mikestead.dotenv` | .env文件高亮 | 推荐 |
| `humao.rest-client` | REST API测试 | 推荐 |

---

### 15.1.2 WSL2 Ubuntu 开发环境替代方案

#### A. WSL2 安装与配置

```powershell
# 以管理员权限运行 PowerShell

# 1. 启用 WSL
wsl --install
# 安装完成后重启系统

# 2. 安装 Ubuntu 22.04
wsl --install -d Ubuntu-22.04

# 3. 设置 WSL 配置（内存、CPU限制）
# 在 %USERPROFILE%\.wslconfig 中写入：
```

```ini
# %USERPROFILE%\.wslconfig
[wsl2]
memory=16GB
processors=8
swap=4GB
swapFile=C:\\temp\\wsl-swap.vhdx
localhostForwarding=true
autoProxy=true
defaultVSwitch=WSL
```

```bash
# 4. 配置 Ubuntu
wsl -d Ubuntu-22.04

# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装基础工具
sudo apt install -y build-essential git curl wget vim unzip

# 配置时区
sudo timedatectl set-timezone Asia/Shanghai
```

#### B. Ubuntu 中 PostgreSQL 16 + pgvector 安装

```bash
# 1. 添加 PostgreSQL 官方源
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
sudo apt update

# 2. 安装 PostgreSQL 16 及开发包
sudo apt install -y postgresql-16 postgresql-contrib-16 postgresql-server-dev-16

# 3. 启动 PostgreSQL
sudo systemctl enable postgresql
sudo systemctl start postgresql

# 4. 创建开发用户和数据库
sudo -u postgres psql -c "CREATE USER narrative_dev WITH PASSWORD 'dev_password_123' SUPERUSER;"
sudo -u postgres psql -c "CREATE DATABASE narrative_os_dev OWNER narrative_dev;"
sudo -u postgres psql -c "CREATE DATABASE narrative_os_test OWNER narrative_dev;"

# 5. 配置 pg_hba.conf 允许本地连接（WSL 与 Windows 互通）
sudo sed -i 's/local   all             all                                     peer/local   all             all                                     trust/' /etc/postgresql/16/main/pg_hba.conf
echo "host    all             all             0.0.0.0/0               md5" | sudo tee -a /etc/postgresql/16/main/pg_hba.conf

# 6. 配置监听地址
sudo sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/" /etc/postgresql/16/main/postgresql.conf

# 7. 重启 PostgreSQL
sudo systemctl restart postgresql

# 8. 安装 pgvector
sudo apt install -y postgresql-16-pgvector

# 9. 验证 pgvector
sudo -u postgres psql -d narrative_os_dev -c "CREATE EXTENSION IF NOT EXISTS vector;"
sudo -u postgres psql -d narrative_os_dev -c "SELECT * FROM pg_extension WHERE extname = 'vector';"

# 10. 配置 Windows 访问 WSL PostgreSQL
# 在 Windows 的 .env 文件中使用：
# DATABASE_URL=postgresql://narrative_dev:dev_password_123@localhost:5432/narrative_os_dev?schema=public
```

#### C. Node.js 和包管理器安装

```bash
# 方法1：使用 nvm（推荐）
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc

nvm install 20.15.0
nvm alias default 20.15.0
node --version  # v20.15.0

# 启用 corepack 支持 pnpm
corepack enable
corepack prepare pnpm@9.4.0 --activate

# 验证
pnpm --version
npm --version

# 方法2：直接使用 NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

---

### 15.1.3 项目初始化

#### A. Monorepo 结构

本项目采用 **pnpm workspaces + Turborepo** 构建 monorepo。

```yaml
# pnpm-workspace.yaml
packages:
  - "apps/*"
  - "packages/*"
  - "tools/*"
```

#### B. 目录结构规范

```
narrative-os/
├── apps/
│   ├── web/                    # React 前端应用
│   │   ├── src/
│   │   │   ├── components/     # UI 组件
│   │   │   ├── pages/          # 页面组件
│   │   │   ├── stores/         # Zustand 状态管理
│   │   │   ├── hooks/          # 自定义 React Hooks
│   │   │   ├── services/       # API 调用层
│   │   │   ├── types/          # 类型定义
│   │   │   └── utils/          # 工具函数
│   │   ├── public/
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   └── package.json
│   │
│   ├── cli/                    # Node.js CLI 应用
│   │   ├── src/
│   │   │   ├── commands/       # CLI 命令实现
│   │   │   ├── config/         # 配置管理
│   │   │   ├── display/        # 终端输出格式化
│   │   │   └── index.ts        # 入口文件
│   │   └── package.json
│   │
│   └── api/                    # Fastify HTTP API 服务
│       ├── src/
│       │   ├── routes/         # API 路由
│       │   ├── middleware/     # 中间件
│       │   ├── plugins/        # Fastify 插件
│       │   └── server.ts       # 服务入口
│       └── package.json
│
├── packages/                   # 共享包（内部依赖）
│   ├── core/                   # 核心业务逻辑
│   │   ├── src/
│   │   │   ├── domain/         # 领域模型
│   │   │   ├── services/       # 服务实现
│   │   │   ├── state-machines/ # XState 状态机
│   │   │   ├── prompt-engine/  # 提示词引擎
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── world-engine/           # 世界引擎
│   ├── studio-engine/          # 工作室引擎
│   ├── llm-service/            # LLM 服务抽象层
│   ├── advisor/                # 谏官系统
│   ├── flow-guardian/          # 流程守护者
│   ├── knowledge-graph/        # 知识图谱
│   ├── vector-store/           # 向量存储
│   └── shared/                 # 共享工具
│       ├── src/
│       │   ├── types/          # 全局类型定义
│       │   ├── utils/          # 通用工具函数
│       │   ├── constants/      # 常量定义
│       │   └── schemas/        # Zod 校验模式
│       └── package.json
│
├── tools/
│   ├── eslint-config/          # 共享 ESLint 配置
│   ├── typescript-config/      # 共享 TypeScript 配置
│   └── jest-config/            # 共享测试配置
│
├── prisma/
│   ├── schema.prisma           # 数据库Schema定义
│   ├── migrations/             # 迁移文件
│   └── seed.ts                 # 种子数据
│
├── docker/
│   ├── Dockerfile.dev
│   ├── Dockerfile.prod
│   ├── docker-compose.yml
│   └── docker-compose.prod.yml
│
├── .github/
│   └── workflows/              # CI/CD 工作流
│
├── scripts/                    # 开发脚本
├── docs/                       # 项目文档
├── .env.example                # 环境变量模板
├── package.json                # 根 package.json
├── pnpm-workspace.yaml
├── turbo.json                  # Turborepo 配置
├── tsconfig.json
├── vitest.config.ts
├── eslint.config.js
├── prettier.config.js
└── README.md
```

#### C. 根目录 package.json

```json
{
  "name": "narrative-os",
  "version": "3.0.0",
  "private": true,
  "description": "NarrativeOS v3.0 Sovereign - 面向100万字以上长篇网文创作的作者增强系统",
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "test": "turbo run test",
    "test:unit": "vitest run",
    "test:integration": "vitest run --config vitest.integration.config.ts",
    "test:e2e": "playwright test",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "lint": "eslint . --ext .ts,.tsx",
    "lint:fix": "eslint . --ext .ts,.tsx --fix",
    "format": "prettier --write \"**/*.{ts,tsx,json,md}\"",
    "format:check": "prettier --check \"**/*.{ts,tsx,json,md}\"",
    "typecheck": "tsc --noEmit",
    "db:migrate": "prisma migrate dev",
    "db:migrate:prod": "prisma migrate deploy",
    "db:generate": "prisma generate",
    "db:seed": "tsx prisma/seed.ts",
    "db:reset": "prisma migrate reset --force",
    "db:studio": "prisma studio",
    "db:status": "prisma migrate status",
    "docker:up": "docker compose -f docker/docker-compose.yml up -d",
    "docker:down": "docker compose -f docker/docker-compose.yml down",
    "docker:build": "docker compose -f docker/docker-compose.yml build",
    "cli": "pnpm --filter @narrative-os/cli",
    "web": "pnpm --filter @narrative-os/web",
    "api": "pnpm --filter @narrative-os/api",
    "changeset": "changeset",
    "version-packages": "changeset version",
    "release": "pnpm build && changeset publish",
    "prepare": "husky install"
  },
  "devDependencies": {
    "@changesets/cli": "^2.27.7",
    "types/node": "^20.14.0",
    "typescript": "^5.5.0",
    "turbo": "^2.0.0",
    "vitest": "^2.0.0",
    "eslint": "^9.5.0",
    "prettier": "^3.3.0",
    "husky": "^9.0.0",
    "lint-staged": "^15.2.0"
  },
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=9.0.0"
  },
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{json,md}": ["prettier --write"]
  }
}
```

#### D. 环境变量模板（.env.example）

```env
# ============================================================
# NarrativeOS v3.0 Sovereign — 环境变量模板
# 复制此文件为 .env 并根据环境修改
# ============================================================

# ------------------------------------------------------------
# 应用基础配置
# ------------------------------------------------------------
NODE_ENV=development
APP_NAME=NarrativeOS
APP_VERSION=3.0.0
PORT=3000
API_PREFIX=/api/v1
LOG_LEVEL=debug

# ------------------------------------------------------------
# 数据库配置（PostgreSQL 16 + pgvector）
# ------------------------------------------------------------
# 开发环境使用本地 PostgreSQL
DATABASE_URL=postgresql://narrative_dev:dev_password_123@localhost:5432/narrative_os_dev?schema=public

# 测试环境（使用独立测试数据库）
DATABASE_URL_TEST=postgresql://narrative_dev:dev_password_123@localhost:5432/narrative_os_test?schema=public

# 生产环境（使用连接池）
# DATABASE_URL=postgresql://user:pass@prod-db-host:5432/narrative_os?schema=public&connection_limit=20

# pgvector 配置
VECTOR_DIMENSION=1536
VECTOR_INDEX_TYPE=ivfflat
VECTOR_LISTS=100

# ------------------------------------------------------------
# LLM API 配置
# ------------------------------------------------------------
# OpenAI
OPENAI_API_KEY=sk-your-openai-api-key-here
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_DEFAULT_MODEL=gpt-4o
OPENAI_FALLBACK_MODEL=gpt-4o-mini

# Anthropic
ANTHROPIC_API_KEY=sk-ant-your-anthropic-api-key-here
ANTHROPIC_BASE_URL=https://api.anthropic.com
ANTHROPIC_DEFAULT_MODEL=claude-3-5-sonnet-20241022
ANTHROPIC_FALLBACK_MODEL=claude-3-haiku-20240307

# 本地模型（Ollama / vLLM）
LOCAL_MODEL_ENABLED=false
LOCAL_MODEL_BASE_URL=http://localhost:11434/v1
LOCAL_MODEL_NAME=qwen2.5:14b

# LLM 路由配置
LLM_DEFAULT_PROVIDER=openai
LLM_MAX_RETRIES=3
LLM_TIMEOUT_MS=60000
LLM_STREAMING_ENABLED=true

# ------------------------------------------------------------
# 向量检索配置
# ------------------------------------------------------------
# Embedding 模型
EMBEDDING_PROVIDER=openai
EMBEDDING_MODEL=text-embedding-3-large
EMBEDDING_DIMENSION=3072

# 检索参数
RETRIEVAL_TOP_K=10
RETRIEVAL_SIMILARITY_THRESHOLD=0.7
RETRIEVAL_MAX_TOKENS=4000

# 缓存配置
REDIS_URL=redis://localhost:6379/0
CACHE_TTL_SECONDS=3600

# ------------------------------------------------------------
# 认证配置
# ------------------------------------------------------------
AUTH_MODE=apikey
# AUTH_MODE=jwt
API_KEY_HEADER=x-api-key
API_KEY_DEVELOPMENT=dev-key-change-in-production

JWT_SECRET=your-jwt-secret-change-in-production-min-256-bits
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d

# ------------------------------------------------------------
# 前端配置
# ------------------------------------------------------------
VITE_API_BASE_URL=http://localhost:3000/api/v1
VITE_WS_URL=ws://localhost:3000
VITE_APP_TITLE=NarrativeOS
VITE_ENABLE_DEBUG=true

# ------------------------------------------------------------
# 监控与告警
# ------------------------------------------------------------
SENTRY_DSN=
SENTRY_ENVIRONMENT=development

# Prometheus 指标
METRICS_ENABLED=true
METRICS_PORT=9090

# ------------------------------------------------------------
# 功能开关
# ------------------------------------------------------------
FEATURE_ADVISOR=true
FEATURE_FLOW_GUARDIAN=true
FEATURE_KNOWLEDGE_GRAPH=false
FEATURE_READER_EXPECTATION=false
FEATURE_MULTI_PROJECT=true

# ------------------------------------------------------------
# 文件存储
# ------------------------------------------------------------
STORAGE_TYPE=local
STORAGE_LOCAL_PATH=./uploads
# STORAGE_S3_BUCKET=
# STORAGE_S3_REGION=
# STORAGE_S3_ACCESS_KEY=
# STORAGE_S3_SECRET_KEY=

# ------------------------------------------------------------
# 内容安全
# ------------------------------------------------------------
CONTENT_FILTER_ENABLED=true
SENSITIVE_WORD_LIST_PATH=./config/sensitive-words.txt
MAX_CONTENT_LENGTH=50000

# ------------------------------------------------------------
# 开发工具
# ------------------------------------------------------------
PRISMA_STUDIO_PORT=5555
SWAGGER_ENABLED=true
MOCK_LLM_RESPONSES=false
```

#### E. Turborepo 配置（turbo.json）

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["^build"]
    },
    "test:coverage": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"]
    },
    "lint": {
      "cache": true
    },
    "typecheck": {
      "cache": true,
      "dependsOn": ["^build"]
    },
    "db:generate": {
      "cache": false
    },
    "db:migrate": {
      "cache": false
    }
  }
}
```

---

## 15.2 数据库 Schema 迁移管理

### 15.2.1 迁移工具选型

本项目采用 **Prisma ORM** 作为数据库迁移和访问工具。

| 工具 | 选型原因 | 适用场景 |
|------|----------|----------|
| **Prisma**（主选） | 类型安全、迁移自动、社区活跃、PostgreSQL支持好 | 所有数据库操作 |
| node-pg-migrate（备选） | 原生SQL控制力强 | 复杂自定义迁移 |
| pgAdmin / psql | 手动操作、调试 | 开发调试、紧急修复 |

### 15.2.2 Prisma Schema 设计原则

```prisma
// prisma/schema.prisma — 核心Schema示例

generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "debian-openssl-3.0.x", "windows"]
  previewFeatures = ["postgresqlExtensions", "fullTextSearch", "fullTextIndex"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [pgvector(map: "vector", schema: "public")]
}

// ============================================================
// 核心领域模型
// ============================================================

// 用户
model User {
  id            String   @id @default(cuid())
  email         String   @unique
  displayName   String
  passwordHash  String?  // 可选，支持OAuth
  role          UserRole @default(AUTHOR)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  deletedAt     DateTime? // 软删除

  // 关联
  projects      Project[]
  apiKeys       ApiKey[]
  activityLogs  ActivityLog[]

  @@map("users")
  @@index([email])
}

enum UserRole {
  ADMIN
  AUTHOR
  READER
}

// 项目（长篇小说）
model Project {
  id            String        @id @default(cuid())
  title         String
  subtitle      String?
  description   String?       @db.Text
  type          NovelType     @default(FANTASY)
  status        ProjectStatus @default(ACTIVE)
  targetWordCount Int         @default(1000000)
  currentWordCount Int        @default(0)
  authorId      String
  settings      Json?         // 项目级设置
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  // 关联
  author        User          @relation(fields: [authorId], references: [id])
  chapters      Chapter[]
  worldSettings WorldSetting[]
  characters    Character[]
  timelines     Timeline[]
  sessions      WorkSession[]
  snapshots     ProjectSnapshot[]

  @@map("projects")
  @@index([authorId])
  @@index([status])
}

enum NovelType {
  FANTASY         // 奇幻
  SCI_FI          // 科幻
  WUXIA           // 武侠
  XIANXIA         // 仙侠
  URBAN_FANTASY   // 都市
  HISTORICAL      // 历史
  HORROR          // 恐怖
  ROMANCE         // 言情
  GAME_LIT        // 游戏异界
  APOCALYPTIC     // 末日
  MYSTERY         // 悬疑
  FAN_FICTION     // 同人
}

enum ProjectStatus {
  DRAFT       // 草稿
  ACTIVE      // 进行中
  PAUSED      // 暂停
  COMPLETED   // 已完成
  ARCHIVED    // 已归档
}

// 章节
model Chapter {
  id          String        @id @default(cuid())
  projectId   String
  title       String
  outline     String?       @db.Text
  content     String?       @db.Text
  status      ChapterStatus @default(OUTLINE)
  wordCount   Int           @default(0)
  sequence    Int           // 章节序号
  settings    Json?         // 章节级设置（POV、时态等）
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  // 关联
  project     Project       @relation(fields: [projectId], references: [id])
  versions    ChapterVersion[]
  embeddings  ChapterEmbedding[]
  mouLogs     MouLog[]

  @@map("chapters")
  @@index([projectId])
  @@index([status])
  @@index([sequence])
  @@unique([projectId, sequence])
}

enum ChapterStatus {
  OUTLINE      // 大纲
  DRAFTING     // 起草中
  REVIEWING    // 审阅中
  REVISING     // 修订中
  CONFIRMED    // 已确认
  PUBLISHED    // 已发布
}

// 章节版本（版本管理）
model ChapterVersion {
  id          String   @id @default(cuid())
  chapterId   String
  content     String   @db.Text
  wordCount   Int
  versionNote String?  // 版本说明
  createdBy   String   // 创建者标识（用户/AI）
  diffFrom    String?  // 基于哪个版本
  settings    Json?    // 生成参数
  createdAt   DateTime @default(now())

  chapter     Chapter  @relation(fields: [chapterId], references: [id])

  @@map("chapter_versions")
  @@index([chapterId])
}

// 向量嵌入（pgvector）
model ChapterEmbedding {
  id          String   @id @default(cuid())
  chapterId   String
  chunkIndex  Int      // 分块索引
  chunkText   String   @db.Text
  embedding   Unsupported("vector(3072)") // 使用 text-embedding-3-large
  metadata    Json?    // 额外元数据
  createdAt   DateTime @default(now())

  chapter     Chapter  @relation(fields: [chapterId], references: [id])

  @@map("chapter_embeddings")
  @@index([chapterId])
  // HNSW 索引通过原始SQL迁移创建
}

// 世界设定
model WorldSetting {
  id          String    @id @default(cuid())
  projectId   String
  category    String    // 地理/历史/文化/魔法体系/政治等
  key         String    // 设定键名
  value       String    @db.Text
  importance  Int       @default(3) // 1-5，重要性
  confidence  Float     @default(1.0) // 置信度 0-1
  source      String?   // 来源（作者输入/AMA蒸馏/AI推导）
  parentId    String?   // 父子关系
  metadata    Json?     // 额外元数据
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  project     Project   @relation(fields: [projectId], references: [id])
  parent      WorldSetting? @relation("WorldSettingHierarchy", fields: [parentId], references: [id])
  children    WorldSetting[] @relation("WorldSettingHierarchy")

  @@map("world_settings")
  @@index([projectId])
  @@index([category])
  @@index([projectId, category])
}

// 角色
model Character {
  id          String    @id @default(cuid())
  projectId   String
  name        String
  aliases     String[]  // 别名
  role        String    // 主角/配角/反派等
  description String?   @db.Text
  personality Json?     // 性格特征
  abilities   Json?     // 能力设定
  relationships Json?   // 关系图谱
  appearance  String?   @db.Text
  backstory   String?   @db.Text
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  project     Project   @relation(fields: [projectId], references: [id])

  @@map("characters")
  @@index([projectId])
}

// 时间线事件
model Timeline {
  id          String    @id @default(cuid())
  projectId   String
  absoluteTime String   // 绝对时间（如：新历284年）
  relativeTime String?  // 相对时间（如：主角出生前5年）
  event       String    @db.Text
  level       String    @default("MEDIUM") // MACRO/MEDIUM/MICRO
  importance  Int       @default(3)
  relatedIds  String[]  // 关联事件ID
  source      String    // 作者输入/推演结果
  createdAt   DateTime  @default(now())

  project     Project   @relation(fields: [projectId], references: [id])

  @@map("timelines")
  @@index([projectId])
  @@index([absoluteTime])
}

// 工作会话（用于追踪和上下文）
model WorkSession {
  id          String    @id @default(cuid())
  projectId   String
  type        String    // MOU/世界编辑/角色设计等
  status      String    @default("ACTIVE")
  context     Json?     // 会话上下文
  messages    Json?     // 消息历史
  tokenUsed   Int       @default(0)
  cost        Float     @default(0)
  startedAt   DateTime  @default(now())
  endedAt     DateTime?

  project     Project   @relation(fields: [projectId], references: [id])

  @@map("work_sessions")
  @@index([projectId])
}

// MOU 执行日志
model MouLog {
  id          String    @id @default(cuid())
  chapterId   String
  phase       String    // 当前阶段
  action      String    // 执行动作
  input       Json?     // 输入参数
  output      Json?     // 输出结果
  tokenUsed   Int       @default(0)
  cost        Float     @default(0)
  latencyMs   Int       @default(0)
  error       Json?     // 错误信息
  createdAt   DateTime  @default(now())

  chapter     Chapter   @relation(fields: [chapterId], references: [id])

  @@map("mou_logs")
  @@index([chapterId])
  @@index([createdAt])
}

// 项目快照（用于快速恢复和版本对比）
model ProjectSnapshot {
  id          String    @id @default(cuid())
  projectId   String
  name        String
  description String?
  snapshot    Json      // 完整项目快照
  wordCount   Int       @default(0)
  chapterCount Int      @default(0)
  createdAt   DateTime  @default(now())

  project     Project   @relation(fields: [projectId], references: [id])

  @@map("project_snapshots")
  @@index([projectId])
}

// API Key 管理
model ApiKey {
  id          String    @id @default(cuid())
  userId      String
  name        String    // 标识名称
  keyHash     String    // 哈希后的key
  permissions String[]  // 权限列表
  lastUsedAt  DateTime?
  expiresAt   DateTime?
  createdAt   DateTime  @default(now())

  user        User      @relation(fields: [userId], references: [id])

  @@map("api_keys")
  @@index([userId])
}

// 活动日志
model ActivityLog {
  id          String    @id @default(cuid())
  userId      String
  action      String    // 操作类型
  resource    String    // 操作对象
  resourceId  String?   // 对象ID
  details     Json?     // 详情
  ipAddress   String?
  userAgent   String?
  createdAt   DateTime  @default(now())

  user        User      @relation(fields: [userId], references: [id])

  @@map("activity_logs")
  @@index([userId])
  @@index([createdAt])
  @@index([action])
}
```

### 15.2.3 迁移文件命名规范

```
prisma/migrations/
├── 20240701000000_init/                    # 初始化迁移
│   └── migration.sql
├── 20240708000000_add_project_timeline/    # 功能迁移：添加时间线
│   └── migration.sql
├── 20240715000000_add_vector_index/        # 性能迁移：向量索引
│   └── migration.sql
├── 20240722000000_add_chapter_embedding/   # 功能迁移：向量嵌入
│   └── migration.sql
├── 20240729000000_add_work_session/        # 功能迁移：工作会话
│   └── migration.sql
└── migration_lock.toml
```

**命名规范：** `YYYYMMDD000000_{snake_case_description}`

### 15.2.4 自定义迁移（向量索引等）

```sql
-- 示例：创建 HNSW 向量索引（高性能近似最近邻搜索）
-- prisma/migrations/20240801000000_add_hnsw_index/migration.sql

-- 创建 HNSW 索引（pgvector 0.5.0+ 支持）
CREATE INDEX IF NOT EXISTS idx_chapter_embeddings_hnsw
ON chapter_embeddings
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- 创建 IVFFlat 索引（备选方案，内存占用更小）
-- CREATE INDEX IF NOT EXISTS idx_chapter_embeddings_ivfflat
-- ON chapter_embeddings
-- USING ivfflat (embedding vector_cosine_ops)
-- WITH (lists = 100);

-- 设置 ef_search 参数（查询时考虑的最近邻数量）
-- 在生产环境中执行：SET hnsw.ef_search = 100;
```

### 15.2.5 数据库种子数据

```typescript
// prisma/seed.ts
import { PrismaClient, NovelType, ProjectStatus, ChapterStatus, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Start seeding...");

  // 创建开发用户
  const devUser = await prisma.user.upsert({
    where: { email: "dev@narrative-os.local" },
    update: {},
    create: {
      email: "dev@narrative-os.local",
      displayName: "开发作者",
      role: UserRole.AUTHOR,
    },
  });
  console.log(`Created user: ${devUser.id}`);

  // 创建示例项目
  const demoProject = await prisma.project.upsert({
    where: { id: "demo-project-001" },
    update: {},
    create: {
      id: "demo-project-001",
      title: "苍穹之变",
      subtitle: "一个关于天穹破碎后凡人求道的史诗",
      description: "天穹在三千年前破碎，灵气从裂缝中倾泻而下。凡人在这破碎的世界中挣扎求存，而修行者则试图修补苍穹...",
      type: NovelType.XIANXIA,
      status: ProjectStatus.ACTIVE,
      targetWordCount: 1200000,
      currentWordCount: 0,
      authorId: devUser.id,
      settings: {
        writingStyle: "第三人称有限视角",
        tense: "过去时",
        tone: "史诗/黑暗",
        targetAudience: "18-35岁男性",
      },
    },
  });
  console.log(`Created project: ${demoProject.id}`);

  // 创建示例世界设定
  const worldSettings = [
    { category: "地理", key: "天穹", value: "三千年前破碎的巨大苍穹，裂缝中倾泻灵气", importance: 5 },
    { category: "力量体系", key: "修行境界", value: "炼气→筑基→金丹→元婴→化神→渡劫→大乘", importance: 5 },
    { category: "历史", key: "天变之年", value: "三千年前天穹破碎的灾变之年，史称'天变'", importance: 5 },
    { category: "文化", key: "宗门制度", value: "修行资源由各大宗门垄断，散修举步维艰", importance: 4 },
    { category: "地理", key: " Central Province", value: "天穹裂缝正下方的中央大州，灵气最浓郁也最危险", importance: 4 },
  ];

  for (const ws of worldSettings) {
    await prisma.worldSetting.create({
      data: { ...ws, projectId: demoProject.id },
    });
  }
  console.log(`Created ${worldSettings.length} world settings`);

  // 创建示例角色
  const characters = [
    {
      name: "林云",
      aliases: ["云哥", "林师弟"],
      role: "主角",
      description: "出身贫寒的散修少年，天赋异禀但修行资源匮乏",
      personality: { traits: ["坚韧", "机智", "重情义"], flaws: ["有时过于冲动", "对宗门有根深蒂固的不信任"] },
      backstory: "幼年时目睹父母在灵气暴走中丧生，被路过的散修收养...",
    },
    {
      name: "苏婉",
      aliases: ["苏师姐"],
      role: "女主角",
      description: "大宗门核心弟子，天赋卓绝但内心渴望自由",
      personality: { traits: ["聪慧", "冷静", "内心柔软"], flaws: ["过于理性", "背负宗门期望的压力"] },
      backstory: "自幼被宗门长老收养，被视为宗门未来的希望...",
    },
    {
      name: "莫天机",
      aliases: ["天机老人"],
      role: "导师",
      description: "神秘的散修前辈，知晓天穹破碎的部分真相",
      personality: { traits: ["深不可测", "亦正亦邪", "知识渊博"], flaws: ["行事莫测", "有时为了达到目的不择手段"] },
      backstory: "据说在天变之年就已经存在，真实年龄和来历无人知晓...",
    },
  ];

  for (const char of characters) {
    await prisma.character.create({
      data: { ...char, projectId: demoProject.id },
    });
  }
  console.log(`Created ${characters.length} characters`);

  // 创建示例章节大纲
  const chapters = [
    { title: "天变余波", sequence: 1, outline: "开篇：林云在中央州的边缘地带寻找灵气稳定的修炼之地，遭遇小规模灵气暴走...", status: ChapterStatus.CONFIRMED, wordCount: 3200 },
    { title: "宗门招徒", sequence: 2, outline: "附近大宗门开启招徒大会，林云犹豫是否参加，遇到神秘的天机老人...", status: ChapterStatus.CONFIRMED, wordCount: 4100 },
    { title: "灵根测试", sequence: 3, outline: "林云参加灵根测试，展现出罕见的变异灵根，引起宗门高层的关注...", status: ChapterStatus.DRAFTING, wordCount: 0 },
    { title: "暗流涌动", sequence: 4, outline: "林云的特殊灵根引来嫉妒和暗中算计，同时天机老人向他透露天穹的秘闻...", status: ChapterStatus.OUTLINE, wordCount: 0 },
    { title: "初识苏婉", sequence: 5, outline: "林云在宗门藏经阁遇到苏婉，两人因一本古籍产生交集...", status: ChapterStatus.OUTLINE, wordCount: 0 },
  ];

  for (const ch of chapters) {
    await prisma.chapter.create({
      data: { ...ch, projectId: demoProject.id },
    });
  }
  console.log(`Created ${chapters.length} chapters`);

  console.log("Seeding finished.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

### 15.2.6 环境数据库配置

| 环境 | 数据库名 | 连接配置 | 备注 |
|------|----------|----------|------|
| 开发 | narrative_os_dev | localhost:5432 | 本地PostgreSQL |
| 测试 | narrative_os_test | localhost:5432 | 测试隔离，每次测试后清理 |
| CI | narrative_os_ci | localhost:5432 | TestContainers动态创建 |
| 预发布 | narrative_os_staging | 内网地址 | 生产数据快照 |
| 生产 | narrative_os | 生产集群 | 只读副本+主库 |

---

## 15.3 Docker 部署方案

### 15.3.1 多阶段 Dockerfile

```dockerfile
# ============================================
# Dockerfile.prod — 生产环境多阶段构建
# ============================================

# 阶段1：依赖安装（使用完整镜像）
FROM node:20.15.0-slim AS deps
WORKDIR /app

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    openssl \
    && rm -rf /var/lib/apt/lists/*

# 复制包管理文件
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/*/package.json ./packages/*/
COPY apps/*/package.json ./apps/*/
COPY tools/*/package.json ./tools/*/
COPY prisma ./prisma

# 安装 pnpm 和依赖
RUN corepack enable && corepack prepare pnpm@9.4.0 --activate
RUN pnpm install --frozen-lockfile

# 阶段2：构建（编译TypeScript）
FROM node:20.15.0-slim AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.4.0 --activate

# 从deps阶段复制
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/apps ./apps
COPY --from=deps /app/tools ./tools
COPY --from=deps /app/prisma ./prisma
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/pnpm-workspace.yaml ./pnpm-workspace.yaml

# 复制源码
COPY . .

# 生成 Prisma Client
RUN pnpm db:generate

# 构建所有包
RUN pnpm build

# 阶段3：生产运行（最小镜像）
FROM node:20.15.0-slim AS runner
WORKDIR /app

# 安全：创建非root用户
RUN groupadd -r narrativeos && useradd -r -g narrativeos -s /bin/false narrativeos

# 仅安装生产依赖
RUN corepack enable && corepack prepare pnpm@9.4.0 --activate
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/apps ./apps
COPY --from=deps /app/prisma ./prisma

# 复制构建产物
COPY --from=builder /app/packages/*/dist ./packages/*/dist/
COPY --from=builder /app/apps/api/dist ./apps/api/dist/
COPY --from=builder /app/apps/web/dist ./apps/web/dist/
COPY --from=builder /app/apps/cli/dist ./apps/cli/dist/

# 生成 Prisma Client（生产环境）
RUN pnpm db:generate

# 移除开发依赖
RUN pnpm install --prod --frozen-lockfile

# 清理
RUN rm -rf /app/packages/*/src \
    /app/apps/*/src \
    /app/tools \
    /app/scripts \
    /app/docs

# 设置权限
RUN chown -R narrativeos:narrativeos /app
USER narrativeos

# 健康检查
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

EXPOSE 3000

CMD ["node", "apps/api/dist/server.js"]
```

### 15.3.2 docker-compose.yml（开发环境）

```yaml
# docker/docker-compose.yml — 开发环境
version: "3.8"

services:
  # PostgreSQL 16 + pgvector
  db:
    image: ankane/pgvector:v0.7.0-pg16
    container_name: narrativeos-db-dev
    environment:
      POSTGRES_USER: narrative_dev
      POSTGRES_PASSWORD: dev_password_123
      POSTGRES_DB: narrative_os_dev
    ports:
      - "5432:5432"
    volumes:
      - narrativeos-db-data:/var/lib/postgresql/data
      - ./init-scripts:/docker-entrypoint-initdb.d
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U narrative_dev -d narrative_os_dev"]
      interval: 5s
      timeout: 5s
      retries: 5
      start_period: 10s

  # Redis（缓存、会话）
  redis:
    image: redis:7-alpine
    container_name: narrativeos-redis-dev
    ports:
      - "6379:6379"
    volumes:
      - narrativeos-redis-data:/data
    command: redis-server --appendonly yes
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

  # API 服务
  api:
    build:
      context: ..
      dockerfile: docker/Dockerfile.dev
    container_name: narrativeos-api-dev
    environment:
      NODE_ENV: development
      DATABASE_URL: postgresql://narrative_dev:dev_password_123@db:5432/narrative_os_dev?schema=public
      REDIS_URL: redis://redis:6379/0
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
    ports:
      - "3000:3000"
    volumes:
      - ..:/app
      - /app/node_modules
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    command: pnpm --filter @narrative-os/api dev

  # 前端开发服务器
  web:
    build:
      context: ..
      dockerfile: docker/Dockerfile.dev
    container_name: narrativeos-web-dev
    environment:
      VITE_API_BASE_URL: http://localhost:3000/api/v1
    ports:
      - "5173:5173"
    volumes:
      - ..:/app
      - /app/node_modules
    command: pnpm --filter @narrative-os/web dev

  # Prisma Studio（数据库管理UI）
  studio:
    build:
      context: ..
      dockerfile: docker/Dockerfile.dev
    container_name: narrativeos-studio-dev
    environment:
      DATABASE_URL: postgresql://narrative_dev:dev_password_123@db:5432/narrative_os_dev?schema=public
    ports:
      - "5555:5555"
    volumes:
      - ..:/app
      - /app/node_modules
    depends_on:
      - db
    command: pnpm db:studio

volumes:
  narrativeos-db-data:
  narrativeos-redis-data:
```

### 15.3.3 docker-compose.prod.yml（生产环境）

```yaml
# docker/docker-compose.prod.yml — 生产环境
version: "3.8"

services:
  # PostgreSQL 16 + pgvector
  db:
    image: ankane/pgvector:v0.7.0-pg16
    container_name: narrativeos-db-prod
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: narrative_os
    ports:
      - "127.0.0.1:5432:5432"  # 仅本地访问，外部通过反向代理
    volumes:
      - narrativeos-prod-db-data:/var/lib/postgresql/data
      - ./backups:/backups
    command: >
      postgres
      -c shared_buffers=4GB
      -c effective_cache_size=12GB
      -c work_mem=256MB
      -c maintenance_work_mem=1GB
      -c max_connections=200
      -c wal_buffers=64MB
      -c effective_io_concurrency=200
    shm_size: 2g
    deploy:
      resources:
        limits:
          memory: 8G
        reservations:
          memory: 4G
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER} -d narrative_os"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  # Redis
  redis:
    image: redis:7-alpine
    container_name: narrativeos-redis-prod
    command: redis-server --appendonly yes --maxmemory 2gb --maxmemory-policy allkeys-lru
    ports:
      - "127.0.0.1:6379:6379"
    volumes:
      - narrativeos-prod-redis-data:/data
    deploy:
      resources:
        limits:
          memory: 2G
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
    restart: unless-stopped

  # API 服务
  api:
    build:
      context: ..
      dockerfile: docker/Dockerfile.prod
    container_name: narrativeos-api-prod
    environment:
      NODE_ENV: production
      DATABASE_URL: ${DATABASE_URL}
      REDIS_URL: ${REDIS_URL}
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
      JWT_SECRET: ${JWT_SECRET}
      SENTRY_DSN: ${SENTRY_DSN}
      METRICS_ENABLED: "true"
    ports:
      - "3000:3000"
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    deploy:
      replicas: 2
      resources:
        limits:
          memory: 2G
          cpus: '2.0'
        reservations:
          memory: 1G
          cpus: '1.0'
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 30s
    restart: unless-stopped

  # Nginx 反向代理
  nginx:
    image: nginx:alpine
    container_name: narrativeos-nginx-prod
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - ../apps/web/dist:/usr/share/nginx/html:ro
    depends_on:
      - api
    restart: unless-stopped

  # 定时备份
  backup:
    image: postgres:16-alpine
    container_name: narrativeos-backup
    environment:
      PGPASSWORD: ${DB_PASSWORD}
    volumes:
      - ./backups:/backups
      - ./scripts/backup.sh:/backup.sh:ro
    command: >
      sh -c "echo '0 2 * * * /backup.sh' | crontab - && crond -f"
    depends_on:
      - db
    restart: unless-stopped

volumes:
  narrativeos-prod-db-data:
    driver: local
  narrativeos-prod-redis-data:
    driver: local

networks:
  default:
    driver: bridge
```

### 15.3.4 Docker Swarm 部署配置

```yaml
# docker/docker-stack.yml — Docker Swarm 模式
deployment: "3.8"

services:
  db:
    image: ankane/pgvector:v0.7.0-pg16
    environment:
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
    volumes:
      - type: volume
        source: narrativeos-db-data
        target: /var/lib/postgresql/data
    secrets:
      - db_password
    deploy:
      replicas: 1
      placement:
        constraints: [node.role == manager]
    networks:
      - narrativeos-network

  api:
    image: narrativeos/api:latest
    environment:
      DATABASE_URL_FILE: /run/secrets/database_url
      OPENAI_API_KEY_FILE: /run/secrets/openai_key
    secrets:
      - database_url
      - openai_key
    deploy:
      replicas: 3
      update_config:
        parallelism: 1
        delay: 10s
        failure_action: rollback
        order: start-first
      rollback_config:
        parallelism: 1
        delay: 5s
      restart_policy:
        condition: any
        delay: 5s
        max_attempts: 3
      resources:
        limits:
          memory: 2G
    networks:
      - narrativeos-network

  nginx:
    image: narrativeos/nginx:latest
    ports:
      - target: 80
        published: 80
        mode: host
      - target: 443
        published: 443
        mode: host
    deploy:
      replicas: 1
      placement:
        constraints: [node.role == manager]
    networks:
      - narrativeos-network

secrets:
  db_password:
    external: true
  database_url:
    external: true
  openai_key:
    external: true

volumes:
  narrativeos-db-data:
    driver: rexray/ebs

networks:
  narrativeos-network:
    driver: overlay
    attachable: true
```

---

## 15.4 CI/CD 流水线

### 15.4.1 GitHub Actions 配置

```yaml
# .github/workflows/ci.yml — 持续集成
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

env:
  NODE_VERSION: "20"
  PNPM_VERSION: "9"

jobs:
  # 代码质量检查
  lint-and-format:
    name: Lint & Format Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: "pnpm"

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Lint
        run: pnpm lint

      - name: Format Check
        run: pnpm format:check

      - name: TypeScript Check
        run: pnpm typecheck

  # 单元测试
  unit-tests:
    name: Unit Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: "pnpm"

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run Unit Tests
        run: pnpm test:unit --coverage

      - name: Upload Coverage
        uses: codecov/codecov-action@v4
        with:
          files: ./coverage/lcov.info
          flags: unit
          name: unit-tests

  # 集成测试
  integration-tests:
    name: Integration Tests
    runs-on: ubuntu-latest
    services:
      postgres:
        image: ankane/pgvector:v0.7.0-pg16
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: narrative_os_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

      redis:
        image: redis:7-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: "pnpm"

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Generate Prisma Client
        run: pnpm db:generate

      - name: Run Database Migrations
        run: pnpm db:migrate:prod
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/narrative_os_test?schema=public

      - name: Seed Database
        run: pnpm db:seed
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/narrative_os_test?schema=public

      - name: Run Integration Tests
        run: pnpm test:integration
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/narrative_os_test?schema=public
          REDIS_URL: redis://localhost:6379/1
          MOCK_LLM_RESPONSES: "true"

  # 构建测试
  build-test:
    name: Build Test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: "pnpm"

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build All Packages
        run: pnpm build

      - name: Build Docker Image
        run: docker build -t narrativeos:test -f docker/Dockerfile.prod .
```

```yaml
# .github/workflows/cd.yml — 持续部署
name: CD

on:
  push:
    tags: ["v*"]
  workflow_dispatch:
    inputs:
      environment:
        description: "部署环境"
        required: true
        default: "staging"
        type: choice
        options:
          - staging
          - production

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  # 构建并推送 Docker 镜像
  build-and-push:
    name: Build & Push Docker Image
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=sha,prefix=git-

      - name: Build and push
        uses: docker/build-push-action@v6
        with:
          context: .
          file: ./docker/Dockerfile.prod
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          platforms: linux/amd64,linux/arm64

  # 部署到目标环境
  deploy:
    name: Deploy
    runs-on: ubuntu-latest
    needs: build-and-push
    environment:
      name: ${{ github.event.inputs.environment || 'staging' }}
    steps:
      - uses: actions/checkout@v4

      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.DEPLOY_HOST }}
          username: ${{ secrets.DEPLOY_USER }}
          key: ${{ secrets.DEPLOY_SSH_KEY }}
          script: |
            cd /opt/narrativeos
            docker pull ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:latest
            docker compose -f docker/docker-compose.prod.yml down
            docker compose -f docker/docker-compose.prod.yml up -d
            docker system prune -f
```

---

## 15.5 测试策略

### 15.5.1 测试框架配置（Vitest）

```typescript
// vitest.config.ts — 单元测试配置
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    name: "unit",
    globals: true,
    environment: "node",
    include: ["packages/**/*.test.ts", "apps/**/*.test.ts"],
    exclude: ["**/*.integration.test.ts", "**/node_modules/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov", "json"],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
      include: ["packages/*/src/**/*.ts", "apps/*/src/**/*.ts"],
      exclude: [
        "**/*.d.ts",
        "**/*.test.ts",
        "**/node_modules/**",
        "**/dist/**",
        "**/*.config.*",
      ],
    },
    testTimeout: 10000,
    hookTimeout: 10000,
    setupFiles: ["./test/setup-unit.ts"],
  },
});
```

```typescript
// vitest.integration.config.ts — 集成测试配置
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    name: "integration",
    globals: true,
    environment: "node",
    include: ["**/*.integration.test.ts"],
    testTimeout: 60000,
    hookTimeout: 30000,
    setupFiles: ["./test/setup-integration.ts"],
    maxConcurrency: 1, // 集成测试串行执行
  },
});
```

### 15.5.2 测试目录结构

```
test/
├── setup-unit.ts              # 单元测试全局设置
├── setup-integration.ts       # 集成测试全局设置
├── fixtures/                  # 测试固件
│   ├── projects/
│   │   └── sample-project.json
│   ├── chapters/
│   │   └── sample-chapter.json
│   └── llm/
│       └── mock-responses/
├── mocks/                     # Mock 实现
│   ├── llm-provider.mock.ts
│   ├── prisma.mock.ts
│   └── redis.mock.ts
└── helpers/                   # 测试辅助函数
    ├── database.ts
    └── factory.ts
```

### 15.5.3 关键测试用例设计

```typescript
// 示例：XState MOU状态机测试
// packages/core/src/state-machines/mou.machine.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { createActor } from "xstate";
import { mouMachine } from "./mou.machine";

describe("MOU State Machine", () => {
  let actor: ReturnType<typeof createActor<typeof mouMachine>>;

  beforeEach(() => {
    actor = createActor(mouMachine);
  });

  it("should start in INITIALIZATION state", () => {
    actor.start();
    expect(actor.getSnapshot().value).toBe("INITIALIZATION");
    expect(actor.getSnapshot().context.currentPhase).toBe(0);
  });

  it("should transition from INITIALIZATION to OUTLINE on START event", () => {
    actor.start();
    actor.send({ type: "START", chapterId: "test-chapter-1" });
    expect(actor.getSnapshot().value).toBe("OUTLINE");
  });

  it("should track phase progression through complete flow", () => {
    actor.start();
    const snapshot = actor.getSnapshot();
    expect(snapshot.context.phases).toHaveLength(6);
    expect(snapshot.context.phases[0].name).toBe("INITIALIZATION");
    expect(snapshot.context.phases[5].name).toBe("CONFIRMATION");
  });

  it("should allow REVIEW_TO_REVISION transition", () => {
    actor.start();
    actor.send({ type: "START", chapterId: "test-chapter-1" });
    // ... 推进到 REVIEWING 状态
    actor.send({ type: "GENERATE_CONTENT" });
    actor.send({ type: "APPROVE" });
    expect(actor.getSnapshot().value).toBe("REVIEWING");
    // 从审阅返回修订
    actor.send({ type: "REQUEST_REVISION", feedback: "需要增加更多对话" });
    expect(actor.getSnapshot().value).toBe("REVISION");
  });

  it("should track token usage across phases", () => {
    actor.start();
    actor.send({ type: "START", chapterId: "test-chapter-1" });
    actor.send({ type: "GENERATE_CONTENT" });
    const snapshot = actor.getSnapshot();
    expect(snapshot.context.tokenUsed).toBeGreaterThan(0);
  });

  it("should handle LLM_ERROR and enter error recovery", () => {
    actor.start();
    actor.send({ type: "START", chapterId: "test-chapter-1" });
    actor.send({ type: "LLM_ERROR", error: { code: "TIMEOUT", message: "LLM超时" } });
    expect(actor.getSnapshot().value).toMatch(/ERROR|RECOVERING/);
  });

  it("should complete full MOU flow to CONFIRMED", () => {
    actor.start();
    actor.send({ type: "START", chapterId: "test-chapter-1" });
    // 模拟完整流程
    actor.send({ type: "GENERATE_CONTENT" });
    actor.send({ type: "APPROVE" }); // OUTLINE -> DRAFTING
    actor.send({ type: "DRAFT_COMPLETE" });
    actor.send({ type: "APPROVE" }); // DRAFTING -> REVIEWING
    actor.send({ type: "APPROVE" }); // REVIEWING -> REVISION (optional)
    actor.send({ type: "REVISION_COMPLETE" });
    actor.send({ type: "APPROVE" }); // REVISION -> CONFIRMATION
    actor.send({ type: "CONFIRM" }); // 最终确认
    expect(actor.getSnapshot().value).toBe("CONFIRMED");
    expect(actor.getSnapshot().context.isComplete).toBe(true);
  });
});
```

```typescript
// 示例：数据库操作集成测试
// packages/core/src/services/chapter.service.integration.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { PrismaClient } from "@prisma/client";
import { ChapterService } from "./chapter.service";
import { resetDatabase, createTestProject } from "@/test/helpers/database";

const prisma = new PrismaClient();

describe("ChapterService Integration", () => {
  let service: ChapterService;
  let testProjectId: string;

  beforeAll(async () => {
    service = new ChapterService(prisma);
    testProjectId = await createTestProject(prisma);
  });

  beforeEach(async () => {
    await resetDatabase(prisma, ["chapters", "chapter_versions"]);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("should create a new chapter with proper sequence", async () => {
    const chapter = await service.create({
      projectId: testProjectId,
      title: "测试章节",
      outline: "这是测试大纲",
      sequence: 1,
    });

    expect(chapter.id).toBeDefined();
    expect(chapter.title).toBe("测试章节");
    expect(chapter.status).toBe("OUTLINE");
  });

  it("should enforce unique sequence per project", async () => {
    await service.create({
      projectId: testProjectId,
      title: "章节一",
      sequence: 1,
    });

    await expect(
      service.create({
        projectId: testProjectId,
        title: "章节二",
        sequence: 1,
      })
    ).rejects.toThrow(/unique constraint/);
  });

  it("should retrieve chapter with version history", async () => {
    const chapter = await service.create({
      projectId: testProjectId,
      title: "版本测试",
      sequence: 1,
    });

    // 创建多个版本
    await service.createVersion(chapter.id, "第一版内容", { createdBy: "user" });
    await service.createVersion(chapter.id, "第二版内容", { createdBy: "ai" });

    const result = await service.getWithVersions(chapter.id);
    expect(result.versions).toHaveLength(2);
    expect(result.versions[0].content).toBe("第一版内容");
  });
});
```

### 15.5.4 E2E 测试方案（Playwright）

```typescript
// playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ["html", { open: "never" }],
    ["list"],
  ],
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
```

---

## 15.6 监控和告警

### 15.6.1 APM 方案（Prometheus + Grafana）

```typescript
// apps/api/src/plugins/metrics.ts
import fp from "fastify-plugin";
import fastifyMetrics from "fastify-metrics";

export const metricsPlugin = fp(async (fastify) => {
  await fastify.register(fastifyMetrics, {
    endpoint: "/metrics",
    defaultMetrics: { enabled: true },
    routeMetrics: {
      enabled: true,
      groupStatusCodes: true,
      register: fastify.metrics?.client?.register,
    },
  });

  // 自定义指标：LLM调用
  const llmCallCounter = new fastify.metrics.client.Counter({
    name: "narrativeos_llm_calls_total",
    help: "Total LLM API calls",
    labelNames: ["provider", "model", "status"],
  });

  const llmLatencyHistogram = new fastify.metrics.client.Histogram({
    name: "narrativeos_llm_latency_seconds",
    help: "LLM API call latency",
    labelNames: ["provider", "model"],
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
  });

  const llmTokenCounter = new fastify.metrics.client.Counter({
    name: "narrativeos_llm_tokens_total",
    help: "Total LLM tokens used",
    labelNames: ["provider", "model", "type"],
  });

  fastify.decorate("llmMetrics", {
    recordCall: (provider: string, model: string, status: string) => {
      llmCallCounter.inc({ provider, model, status });
    },
    recordLatency: (provider: string, model: string, seconds: number) => {
      llmLatencyHistogram.observe({ provider, model }, seconds);
    },
    recordTokens: (provider: string, model: string, type: "input" | "output", count: number) => {
      llmTokenCounter.inc({ provider, model, type }, count);
    },
  });
});
```

### 15.6.2 告警规则（Prometheus Alertmanager）

```yaml
# monitoring/alert-rules.yml
groups:
  - name: narrativeos-alerts
    rules:
      # API 响应时间告警
      - alert: APIHighLatency
        expr: histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m])) > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "API response time is high"
          description: "99th percentile latency is {{ $value }}s"

      # 错误率告警
      - alert: APIHighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.05
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "API error rate is high"
          description: "Error rate is {{ $value | humanizePercentage }}"

      # LLM 调用失败告警
      - alert: LLMHighFailureRate
        expr: rate(narrativeos_llm_calls_total{status="error"}[10m]) / rate(narrativeos_llm_calls_total[10m]) > 0.2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "LLM API failure rate is high"
          description: "{{ $labels.provider }} failure rate is {{ $value | humanizePercentage }}"

      # 数据库连接告警
      - alert: DBConnectionPoolExhausted
        expr: pg_stat_activity_count > 180
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Database connection pool nearly exhausted"

      # LLM 成本告警
      - alert: LLMCostSpike
        expr: rate(narrativeos_llm_tokens_total[1h]) > 100000
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "High LLM token consumption detected"

      # 磁盘空间告警
      - alert: DiskSpaceLow
        expr: (node_filesystem_avail_bytes / node_filesystem_size_bytes) < 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Disk space is running low"
```

### 15.6.3 Sentry 错误追踪集成

```typescript
// apps/api/src/plugins/sentry.ts
import fp from "fastify-plugin";
import * as Sentry from "@sentry/node";

export const sentryPlugin = fp(async (fastify, opts) => {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    release: process.env.APP_VERSION,
    integrations: [
      Sentry.httpIntegration(),
      Sentry.postgresIntegration(),
    ],
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    profilesSampleRate: 0.1,
  });

  fastify.setErrorHandler((error, request, reply) => {
    Sentry.captureException(error, {
      tags: {
        route: request.routerPath,
        method: request.method,
      },
      extra: {
        body: request.body,
        query: request.query,
        params: request.params,
      },
    });
    reply.status(error.statusCode || 500).send({
      error: error.message,
      code: error.code || "INTERNAL_ERROR",
    });
  });
});
```

---

## 15.7 性能优化方案

### 15.7.1 数据库查询优化

```typescript
// 慢查询监控中间件
// packages/core/src/middleware/query-performance.ts
import { PrismaClient } from "@prisma/client";

const SLOW_QUERY_THRESHOLD_MS = 200;

export function attachQueryLogger(prisma: PrismaClient) {
  prisma.$on("query" as never, (event: any) => {
    const duration = event.duration;
    if (duration > SLOW_QUERY_THRESHOLD_MS) {
      console.warn(`[SLOW QUERY] ${duration}ms: ${event.query}`);
      // 发送到监控系统
      metrics.slowQueryCounter.inc({
        table: extractTableName(event.query),
        duration_bucket: getDurationBucket(duration),
      });
    }
  });
}

// 查询优化示例：向量检索 + 业务数据联合查询
// 使用 CTE（公用表表达式）优化向量检索后的关联查询
async function searchWithVectorAndJoin(
  embedding: number[],
  projectId: string,
  topK: number = 10
) {
  // 先进行向量检索（利用HNSW索引）
  const vectorResults = await prisma.$queryRaw<{ chapterId: string; distance: number }[]>`
    WITH vector_matches AS (
      SELECT chapter_id, embedding <=> ${embedding}::vector AS distance
      FROM chapter_embeddings
      WHERE chapter_id IN (
        SELECT id FROM chapters WHERE project_id = ${projectId}
      )
      ORDER BY embedding <=> ${embedding}::vector
      LIMIT ${topK * 3}
    )
    SELECT chapter_id, distance FROM vector_matches;
  `;

  // 批量查询关联数据（避免N+1问题）
  const chapterIds = vectorResults.map((r) => r.chapterId);
  const chapters = await prisma.chapter.findMany({
    where: { id: { in: chapterIds } },
    include: {
      versions: { orderBy: { createdAt: "desc" }, take: 1 },
      project: { select: { title: true } },
    },
  });

  // 按向量相似度排序合并结果
  return vectorResults
    .map((vr) => ({
      ...chapters.find((c) => c.id === vr.chapterId),
      distance: vr.distance,
    }))
    .filter(Boolean)
    .slice(0, topK);
}
```

### 15.7.2 LLM 调用优化

```typescript
// packages/llm-service/src/cache/llm-cache.ts
import { createHash } from "crypto";

interface CacheEntry {
  response: string;
  tokens: { input: number; output: number };
  expiresAt: number;
}

// 两级缓存：内存 + Redis
export class LLMResponseCache {
  private memoryCache = new Map<string, CacheEntry>();
  private readonly memoryTTL = 5 * 60 * 1000; // 5分钟

  constructor(private redis?: RedisClient) {}

  private generateKey(prompt: string, model: string, params: any): string {
    const data = JSON.stringify({ prompt, model, params });
    return createHash("sha256").update(data).digest("hex");
  }

  async get(prompt: string, model: string, params: any): Promise<CacheEntry | null> {
    const key = this.generateKey(prompt, model, params);

    // 检查内存缓存
    const memEntry = this.memoryCache.get(key);
    if (memEntry && memEntry.expiresAt > Date.now()) {
      return memEntry;
    }

    // 检查Redis缓存
    if (this.redis) {
      const redisEntry = await this.redis.get(`llm:cache:${key}`);
      if (redisEntry) {
        const parsed = JSON.parse(redisEntry);
        // 回填内存缓存
        this.memoryCache.set(key, parsed);
        return parsed;
      }
    }

    return null;
  }

  async set(prompt: string, model: string, params: any, entry: Omit<CacheEntry, "expiresAt">): Promise<void> {
    const key = this.generateKey(prompt, model, params);
    const cacheEntry: CacheEntry = {
      ...entry,
      expiresAt: Date.now() + this.memoryTTL,
    };

    // 写入内存缓存
    this.memoryCache.set(key, cacheEntry);

    // 写入Redis（1小时TTL，适用于相似场景检索）
    if (this.redis) {
      await this.redis.setex(
        `llm:cache:${key}`,
        3600,
        JSON.stringify(cacheEntry)
      );
    }

    // 定期清理内存缓存
    if (this.memoryCache.size > 1000) {
      this.cleanup();
    }
  }

  // 批量请求合并（相同prompt的请求合并为一次调用）
  async batchRequest(
    requests: Array<{ prompt: string; model: string; params: any }>,
    callLLM: (prompt: string) => Promise<string>
  ): Promise<string[]> {
    const deduped = new Map<string, string[]>(); // key -> requestIndices[]

    requests.forEach((req, idx) => {
      const key = this.generateKey(req.prompt, req.model, req.params);
      const indices = deduped.get(key) || [];
      indices.push(idx);
      deduped.set(key, indices);
    });

    const results = new Array(requests.length);

    await Promise.all(
      Array.from(deduped.entries()).map(async ([key, indices]) => {
        const req = requests[indices[0]];
        const cached = await this.get(req.prompt, req.model, req.params);

        let response: string;
        if (cached) {
          response = cached.response;
        } else {
          response = await callLLM(req.prompt);
          await this.set(req.prompt, req.model, req.params, {
            response,
            tokens: { input: 0, output: 0 }, // 实际统计从API响应中获取
          });
        }

        indices.forEach((idx) => {
          results[idx] = response;
        });
      })
    );

    return results;
  }
}
```

### 15.7.3 内存管理

```typescript
// 防止内存泄漏的最佳实践
// packages/shared/src/utils/memory-guard.ts

import { EventEmitter } from "events";

// 增加默认监听器上限（Node.js默认10，大型应用需要更多）
EventEmitter.defaultMaxListeners = 50;

// 内存监控
export class MemoryGuard {
  private interval: NodeJS.Timeout | null = null;
  private readonly thresholdMB: number;
  private readonly checkIntervalMs: number;

  constructor(thresholdMB = 1024, checkIntervalMs = 30000) {
    this.thresholdMB = thresholdMB;
    this.checkIntervalMs = checkIntervalMs;
  }

  start() {
    this.interval = setInterval(() => {
      const usage = process.memoryUsage();
      const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
      const rssMB = Math.round(usage.rss / 1024 / 1024);

      if (rssMB > this.thresholdMB) {
        console.warn(`[MEMORY WARNING] RSS: ${rssMB}MB, Heap: ${heapUsedMB}MB`);
        // 触发GC（如果允许）
        if (global.gc) {
          global.gc();
          console.log("[MEMORY] Manual GC triggered");
        }
        // 发送告警
        metrics.memoryUsageGauge.set(rssMB);
      }
    }, this.checkIntervalMs);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
    }
  }
}

// 流式处理大文本，避免一次性加载到内存
export async function* chunkProcessor(
  text: string,
  chunkSize: number = 4000
): AsyncGenerator<string> {
  for (let i = 0; i < text.length; i += chunkSize) {
    yield text.slice(i, i + chunkSize);
  }
}

// 弱引用缓存（允许GC回收）
export class WeakRefCache<K extends object, V> {
  private cache = new WeakMap<K, V>();

  get(key: K): V | undefined {
    return this.cache.get(key);
  }

  set(key: K, value: V): void {
    this.cache.set(key, value);
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }
}
```

---


---

# 第十六章：风险登记册

## 16.1 风险总览

| 编号 | 风险名称 | 概率 | 影响 | 风险等级 | 应对策略 | 负责人 |
|------|----------|------|------|----------|----------|--------|
| R001 | LLM API成本超支 | 4 | 5 | **高** | 减轻 | 技术负责人 |
| R002 | LLM输出一致性衰减 | 4 | 5 | **高** | 减轻 | AI工程师 |
| R003 | 作者确认疲劳 | 3 | 4 | 中 | 减轻 | 产品经理 |
| R004 | 规则系统复杂度爆炸 | 3 | 4 | 中 | 规避 | 架构师 |
| R005 | 数据库性能瓶颈 | 3 | 5 | **高** | 减轻 | DBA |
| R006 | 开发进度延误 | 4 | 4 | **高** | 减轻 | 项目经理 |
| R007 | 内容安全风险 | 2 | 5 | **高** | 规避 | 安全负责人 |
| R008 | 技术债务累积 | 4 | 3 | 中 | 减轻 | 架构师 |
| R009 | pgvector向量检索性能衰减 | 3 | 4 | 中 | 减轻 | DBA |
| R010 | LLM供应商服务中断 | 2 | 5 | **高** | 转移 | DevOps |
| R011 | 核心团队成员流失 | 2 | 5 | **高** | 减轻 | 项目经理 |
| R012 | 作者数据丢失 | 1 | 5 | **高** | 规避 | DBA |
| R013 | XState状态机复杂度失控 | 3 | 3 | 中 | 规避 | 核心后端 |
| R014 | 前端性能瓶颈（大文档编辑） | 3 | 3 | 中 | 减轻 | 前端开发 |
| R015 | 开源协议合规风险 | 2 | 3 | 低 | 规避 | 法务/技术负责人 |

> **风险等级计算公式**：概率（1-5） × 影响（1-5）  
> - 1-4：低风险（绿色）  
> - 5-9：中风险（黄色）  
> - 10-16：高风险（橙色）  
> - 17-25：极高风险（红色）

---

## 16.2 核心风险详细分析

### R001：LLM API成本超支

| 属性 | 描述 |
|------|------|
| **风险描述** | 100万字长篇创作需要大量LLM API调用（每章起草、审阅、修订各需1-3次调用），在Phase 4引入知识图谱和读者预期引擎后，单次MOU流程Token消耗可能增长200-300%。若用户量增长超预期或作者使用频率高于预估，月度LLM API费用可能超出预算50-200%。 |
| **概率** | 4/5（高概率） |
| **影响** | 5/5（极高影响——直接影响产品经济可行性） |
| **风险等级** | 20/25（极高风险） |

**触发条件：**
- 单项目月LLM调用费用 > ¥500
- Token消耗增长率 > 30%/月
- 用户月活增长 > 50%/月

**应对策略（减轻）：**

| 措施 | 优先级 | 预计效果 | 实施阶段 |
|------|--------|----------|----------|
| 实现多级响应缓存（内存→Redis→磁盘），缓存相似prompt的响应 | 高 | 减少30-40%重复调用 | Phase 2 |
| 实现Prompt压缩算法，自动压缩历史上下文 | 高 | 减少20-30% Token消耗 | Phase 2 |
| 本地模型降级策略（复杂任务用GPT-4o，简单任务用本地模型） | 高 | 减少50-60%简单任务成本 | Phase 3 |
| Token预算系统：每项目/每月Token上限，超限自动降级 | 高 | 硬性成本上限控制 | Phase 2 |
| 智能批处理：合并相似请求一次性处理 | 中 | 减少10-15%调用次数 | Phase 3 |
| 模型选择优化：根据任务复杂度自动选择最优模型 | 中 | 减少20-30%不必要的高成本调用 | Phase 2 |

**监控指标：**
```yaml
- metric: llm_cost_per_project_monthly
  threshold: "> ¥500"
  alert_level: warning
  
- metric: llm_cost_per_1000_words
  threshold: "> ¥2"
  alert_level: critical
  
- metric: llm_token_usage_daily
  threshold: "> 500K tokens/day"
  alert_level: warning
  
- metric: cache_hit_rate
  threshold: "< 30%"
  alert_level: warning
```

**应急计划：**
- 如果月度成本超预算100%：立即启用强制降级（所有任务使用低成本模型）
- 如果月度成本超预算200%：暂停新用户注册，实施邀请制
- 长期：加速本地模型部署，降低对云端API依赖

---

### R002：LLM输出一致性衰减（上下文漂移）

| 属性 | 描述 |
|------|------|
| **风险描述** | 在100万字以上的长篇创作中，LLM面临严重的上下文窗口限制。即使使用支持128K上下文的模型，也无法一次性加载全部内容。分块处理时，模型可能遗忘早期设定、角色性格变化、世界观细节等，导致长篇小说中出现"吃设定"、"角色OOC（Out of Character）"等问题。这是LLM固有的技术限制，而非工程问题。 |
| **概率** | 4/5（高概率——这是LLM的固有限制） |
| **影响** | 5/5（极高影响——直接影响产品质量和用户信任） |
| **风险等级** | 20/25（极高风险） |

**具体表现：**
- 第1章设定的角色性格，在第50章被改变
- 早期埋下的伏笔被模型遗忘，无法回收
- 世界设定中的约束条件在后续章节中被违反
- 角色能力值在不同章节中不一致

**应对策略（减轻）：**

| 措施 | 优先级 | 预计效果 | 实施阶段 |
|------|--------|----------|----------|
| 实现智能上下文组装：基于语义检索动态选择最相关的历史片段 | 高 | 显著提高相关性 | Phase 2 |
| 建立"设定锁"机制：核心设定必须出现在每个prompt中 | 高 | 消除90%设定冲突 | Phase 2 |
| 角色一致性检查器：每次生成后检查角色行为是否符合设定 | 高 | 发现80% OOC问题 | Phase 2 |
| 建立设定数据库：所有设定结构化存储，生成时自动注入 | 高 | 根本性解决方案 | Phase 2 |
| 定期"设定复习"：每N章自动让LLM回顾和确认关键设定 | 中 | 减少长期漂移 | Phase 3 |
| 分层摘要：维护多级摘要（全书→卷→章→场景），不同层级用不同摘要 | 中 | 平衡细节和全面性 | Phase 3 |
| 人工审核标记：关键设定变更必须作者确认 | 中 | 最后一道防线 | Phase 1 |

**监控指标：**
```yaml
- metric: consistency_check_failure_rate
  threshold: "> 5%"
  alert_level: warning
  
- metric: character_ooc_incidents
  threshold: "> 0 per chapter"
  alert_level: warning
  
- metric: setting_violation_count
  threshold: "> 0 per chapter"
  alert_level: critical
  
- metric: author_override_rate  # 作者手动修正比例
  threshold: "> 30%"
  alert_level: warning
```

**应急计划：**
- 如果一致性检查失败率>10%：增加"设定锁"中的设定数量，减少每批生成字数
- 如果作者投诉OOC问题：紧急增加角色一致性检查频率，必要时暂停AI生成功能
- 长期：训练或微调专用模型（如基于小说数据微调的开源模型）

---

### R003：作者确认疲劳

| 属性 | 描述 |
| **风险描述** | NarrativeOS的核心交互模式是"AI生成 → 作者确认/修改"的MOU（Moment of Understanding）循环。如果每次MOU都需要作者投入大量认知资源进行审核和确认，或者系统频繁提出低质量建议，作者可能产生确认疲劳，最终放弃使用系统。每章6次确认 × 1000章 = 6000次确认，是极高的交互负担。 |
| **概率** | 3/5（中概率——取决于UX设计和AI质量） |
| **影响** | 4/5（高影响——直接影响用户留存率） |
| **风险等级** | 12/25（中高风险） |

**触发信号：**
- 用户单次会话MOU确认次数 > 20次
- 作者跳过/快速确认比例 > 50%（说明未认真阅读）
- 用户在审阅阶段的平均停留时间 < 10秒
- 用户流失率在注册后7天内 > 40%

**应对策略（减轻）：**

| 措施 | 优先级 | 预计效果 | 实施阶段 |
|------|--------|----------|----------|
| 智能确认分级：重要决策需要显式确认，次要变化自动应用 | 高 | 减少50%确认次数 | Phase 2 |
| 批量确认：相似类型的修改可一次性批量确认 | 高 | 减少30%确认次数 | Phase 2 |
| "信任模式"：作者可设置对特定类型的AI输出自动确认 | 中 | 减少20%确认次数（资深用户） | Phase 2 |
| 谏官系统只在真正发现问题时才提出建议 | 高 | 减少80%无效建议 | Phase 2 |
| 个性化确认阈值：根据作者历史行为调整确认严格度 | 中 | 适应不同用户习惯 | Phase 3 |
| 快捷键支持：CLI和Web端都提供快速确认快捷键 | 中 | 减少操作时间 | Phase 1 |

**监控指标：**
```yaml
- metric: mou_completion_rate
  threshold: "< 70%"
  alert_level: warning
  
- metric: avg_confirmation_time_seconds
  threshold: "> 60s"
  alert_level: warning
  
- metric: user_skip_rate
  threshold: "> 50%"
  alert_level: critical
  
- metric: 7d_retention_rate
  threshold: "< 60%"
  alert_level: critical
```

---

### R004：规则系统复杂度爆炸

| 属性 | 描述 |
|------|------|
| **风险描述** | 网文类型内核系统需要定义大量规则（流派规范、爽点模式、节奏模板、毒点清单等）。随着支持的类型增多，规则之间可能产生冲突和矛盾。10种类型 × 每种50条规则 = 500条规则，维护难度极高。更糟糕的是，不同类型之间的规则可能互相矛盾（如"玄幻"要求升级体系，"言情"要求情感细腻）。 |
| **概率** | 3/5（中概率——良好的架构设计可缓解） |
| **影响** | 4/5（高影响——维护困难，容易产生错误） |
| **风险等级** | 12/25（中高风险） |

**应对策略（规避+减轻）：**

| 措施 | 优先级 | 预计效果 | 实施阶段 |
|------|--------|----------|----------|
| 规则引擎分层：核心规则（跨类型通用）→ 类型规则（特定类型）→ 用户规则（个人偏好），优先级递减 | 高 | 避免规则冲突 | Phase 4 |
| 规则冲突检测器：自动检测新规则与已有规则的冲突 | 高 | 在规则创建时发现冲突 | Phase 4 |
| 规则模块化：每种类型独立规则包，按需加载 | 中 | 减少内存占用，提高性能 | Phase 4 |
| 规则版本管理：规则变更可追溯，可回滚 | 中 | 降低规则更新风险 | Phase 4 |
| 规则DSL：使用专用领域语言定义规则，而非硬编码 | 低 | 提高规则可维护性 | Phase 4 |

---

### R005：数据库性能瓶颈（百万级向量检索）

| 属性 | 描述 |
|------|------|
| **风险描述** | 100万字小说产生约300-500个文本分块，每个分块需要一个3072维的向量。当支持10个并行项目时，向量表将达到3000-5000行。虽然pgvector能处理百万级向量，但在高并发检索场景下，如果索引策略不当，查询延迟可能从<100ms恶化到>5s，严重影响用户体验。 |
| **概率** | 3/5（中概率——良好设计可预防） |
| **影响** | 5/5（极高影响——直接决定产品可用性） |
| **风险等级** | 15/25（高风险） |

**应对策略（减轻）：**

| 措施 | 优先级 | 预计效果 | 实施阶段 |
|------|--------|----------|----------|
| HNSW索引（高维向量最优索引） | 高 | 查询延迟<100ms | Phase 2 |
| 向量量化：将float32向量量化为int8，减少存储和计算 | 高 | 存储减少75%，速度提升2-3x | Phase 3 |
| 分层检索：先关键词过滤候选集，再向量精确排序 | 高 | 减少90%向量比较 | Phase 2 |
| 向量缓存：热门向量常驻内存 | 中 | 减少50%磁盘IO | Phase 3 |
| 数据库读写分离：检索走只读副本 | 中 | 减轻主库压力 | Phase 5 |
| 分片策略：按项目ID分片向量表 | 低 | 支持更大规模 | Phase 5 |
| 定期VACUUM和ANALYZE | 高 | 保持索引效率 | 持续 |

**监控指标：**
```yaml
- metric: vector_query_latency_p99
  threshold: "> 500ms"
  alert_level: critical
  
- metric: vector_table_size
  threshold: "> 1M rows"
  alert_level: warning
  
- metric: pg_active_connections
  threshold: "> 150"
  alert_level: warning
  
- metric: pg_lock_wait_time
  threshold: "> 1000ms"
  alert_level: critical
```

---

### R006：开发进度延误

| 属性 | 描述 |
|------|------|
| **风险描述** | 项目共22周、5个Phase，任何Phase的延误都会产生连锁反应。最可能导致延误的因素包括：LLM集成调试时间超预期、前端复杂交互实现困难、团队成员病假/离职、需求变更等。 |
| **概率** | 4/5（高概率——软件开发项目普遍面临） |
| **影响** | 4/5（高影响——延迟上市、增加成本） |
| **风险等级** | 16/25（高风险） |

**应对策略（减轻）：**

| 措施 | 优先级 | 预计效果 | 实施阶段 |
|------|--------|----------|----------|
| 每个Phase预留10%缓冲时间 | 高 | 吸收小幅延误 | 全部 |
| Phase 0和Phase 1优先完成核心路径，边缘功能可裁剪 | 高 | 确保最小可用产品 | Phase 0-1 |
| 模块化架构：各Phase可独立交付，不阻塞后续Phase启动 | 高 | 减少连锁延误 | Phase 0 |
| 每日站会+每周进度评审 | 中 | 及早发现问题 | 全部 |
| 关键路径跟踪，重点关注阻塞任务 | 中 | 聚焦最重要工作 | 全部 |
| 外包/兼职资源储备（UI设计、测试） | 中 | 高峰期增加人力 | 灵活 |

---

### R007：内容安全风险

| 属性 | 描述 |
|------|------|
| **风险描述** | LLM可能生成违反法律法规或平台政策的内容（色情、暴力、政治敏感、版权侵权等）。如果作者使用NarrativeOS生成的内容被平台下架或引发法律纠纷，将对产品声誉造成严重损害。中国网络文学有严格的内容审查要求。 |
| **概率** | 2/5（低概率——多重过滤机制） |
| **影响** | 5/5（极高影响——可能致命） |
| **风险等级** | 10/25（高风险） |

**应对策略（规避）：**

| 措施 | 优先级 | 预计效果 | 实施阶段 |
|------|--------|----------|----------|
| 敏感词实时过滤：生成内容经过多层敏感词库检查 | 高 | 拦截90%+明显违规内容 | Phase 1 |
| LLM安全层：在系统提示词中明确禁止生成违规内容 | 高 | 从源头减少违规生成 | Phase 1 |
| 生成内容标记：AI生成内容打水印，便于追溯 | 中 | 明确内容来源 | Phase 2 |
| 人工审核机制：高风险内容标记待审 | 中 | 最后一道防线 | Phase 5 |
| 内容安全日志：所有生成内容可审计 | 高 | 满足合规要求 | Phase 1 |
| 定期更新敏感词库 | 高 | 适应政策变化 | 持续 |

---

### R008：技术债务累积

| 属性 | 描述 |
|------|------|
| **风险描述** | 在快速迭代的过程中（22周完成5个Phase），团队可能倾向于选择快速实现而非最优实现，导致技术债务累积。如果不定期偿还，后期修改成本将指数级增长，最终影响产品质量和团队效率。 |
| **概率** | 4/5（高概率——快速迭代固有产物） |
| **影响** | 3/5（中等影响——长期影响） |
| **风险等级** | 12/25（中高风险） |

**应对策略（减轻）：**

| 措施 | 优先级 | 预计效果 | 实施阶段 |
|------|--------|----------|----------|
| 每个Sprint预留20%时间做重构 | 高 | 持续偿还技术债务 | 全部 |
| 代码审查强制通过（至少1人Approve） | 高 | 防止明显质量问题进入主分支 | 全部 |
| 技术债务看板：显式追踪债务项 | 中 | 可视化债务规模 | 全部 |
| 架构决策记录（ADR）：重大决策有记录 | 中 | 避免重复讨论，追溯决策原因 | Phase 0 |
| 定期架构评审（每Phase结束） | 中 | 及时调整方向 | 全部 |
| 自动化测试覆盖率门槛（60%→80%） | 高 | 用测试保障质量 | Phase 1-5 |

---

### R009：pgvector向量检索性能衰减

| 属性 | 描述 |
|------|------|
| **风险描述** | pgvector在处理大规模高维向量时，随着数据量增长和向量更新频繁，索引性能可能衰减。特别是在频繁插入/更新向量（每次章节编辑后重新嵌入）的场景下，HNSW索引的构建和维护成本可能变得不可接受。 |
| **概率** | 3/5（中概率——取决于使用模式） |
| **影响** | 4/5（高影响——影响核心功能） |
| **风险等级** | 12/25（中高风险） |

**应对策略（减轻）：**

| 措施 | 优先级 | 预计效果 | 实施阶段 |
|------|--------|----------|----------|
| 异步向量更新：章节编辑后异步重新计算嵌入，不阻塞编辑 | 高 | 消除编辑延迟 | Phase 2 |
| 增量更新：只更新修改的分块，而非全章重算 | 中 | 减少50%+嵌入计算 | Phase 2 |
| 批量索引重建：低峰期批量重建索引 | 中 | 保持索引效率 | Phase 3 |
| 向量分区：按项目ID分区，减少单次查询范围 | 中 | 查询加速 | Phase 3 |
| 备选方案：专用向量数据库（Milvus/Pinecone） | 低 | 终极解决方案 | Phase 5 |

---

### R010：LLM供应商服务中断

| 属性 | 描述 |
|------|------|
| **风险描述** | OpenAI、Anthropic等云服务可能因网络故障、政策调整或账户问题导致服务不可用。如果系统只依赖单一供应商，服务中断将直接导致NarrativeOS核心功能不可用。 |
| **概率** | 2/5（低概率——大厂服务相对稳定，但非零） |
| **影响** | 5/5（极高影响——服务完全不可用） |
| **风险等级** | 10/25（高风险） |

**应对策略（转移+减轻）：**

| 措施 | 优先级 | 预计效果 | 实施阶段 |
|------|--------|----------|----------|
| 多供应商自动切换（OpenAI → Anthropic → 本地模型） | 高 | 单供应商故障时秒级切换 | Phase 1 |
| 本地模型热备：部署开源模型作为降级方案 | 高 | 完全离线可用 | Phase 3 |
| 响应缓存：缓存最近LLM响应，短暂中断时提供缓存 | 中 | 缓解短期中断影响 | Phase 2 |
| 服务健康检查：每30秒检查LLM供应商可用性 | 中 | 及早发现问题 | Phase 1 |

---

### R011：核心团队成员流失

| 属性 | 描述 |
|------|------|
| **风险描述** | 项目周期长（5.5个月），核心成员（特别是AI工程师和架构师）若中途离职，将导致知识断层和进度严重延误。NarrativeOS涉及大量领域知识（网文创作、LLM工程、状态机设计），新员工上手成本高。 |
| **概率** | 2/5（低概率——但需要预防） |
| **影响** | 5/5（极高影响——可能导致项目失败） |
| **风险等级** | 10/25（高风险） |

**应对策略（减轻）：**

| 措施 | 优先级 | 预计效果 | 实施阶段 |
|------|--------|----------|----------|
| 知识文档化：架构决策、设计思路、技术债务都写入文档 | 高 | 降低知识集中度 | Phase 0起 |
| 代码结对编程：关键模块至少2人熟悉 | 高 | 消除单点故障 | 全部 |
| 期权/奖金激励：核心成员绑定 | 中 | 降低离职概率 | 项目启动 |
| 关键角色备份：每个关键角色指定备份人员 | 中 | 快速接替 | 全部 |

---

### R012：作者数据丢失

| 属性 | 描述 |
|------|------|
| **风险描述** | 作者创作的小说数据是其核心资产。如果因数据库故障、程序Bug或人为操作导致数据丢失，将对作者造成不可挽回的损失，也会彻底摧毁产品信誉。100万字小说的丢失是绝对不可接受的事故。 |
| **概率** | 1/5（极低概率——多层防护） |
| **影响** | 5/5（极高影响——产品信誉毁灭性打击） |
| **风险等级** | 5/25（中风险——概率极低但影响极大） |

**应对策略（规避）：**

| 措施 | 优先级 | 预计效果 | 实施阶段 |
|------|--------|----------|----------|
| 实时自动保存：每30秒自动保存编辑内容 | 高 | 最大丢失30秒工作 | Phase 1 |
| 完整备份策略：每日全量+实时增量+异地备份 | 高 | RPO<5分钟 | Phase 0 |
| 版本历史：每次确认都保存完整版本 | 高 | 可回滚到任意历史点 | Phase 1 |
| 数据库高可用：主从复制，自动故障转移 | 高 | RTO<30秒 | Phase 5 |
| 数据导出：支持作者随时导出全部数据 | 高 | 作者有数据控制权 | Phase 1 |
| 灾难恢复演练：每季度一次恢复测试 | 中 | 验证备份有效性 | Phase 5起 |

---

### R013：XState状态机复杂度失控

| 属性 | 描述 |
|------|------|
| **风险描述** | XState状态机是NarrativeOS的核心编排机制。MOU状态机、工作室状态机、世界引擎状态机各自复杂，且需要相互通信。如果状态机设计不合理，可能产生死状态、竞态条件、难以调试等问题。随着功能增加，状态机可能变得极其复杂。 |
| **概率** | 3/5（中概率——良好的状态机设计经验可缓解） |
| **影响** | 3/5（中等影响——局部功能问题） |
| **风险等级** | 9/25（中风险） |

**应对策略（规避）：**

| 措施 | 优先级 | 预计效果 | 实施阶段 |
|------|--------|----------|----------|
| 状态机分层：父状态机 + 子状态机，避免单个状态机过大 | 高 | 控制复杂度 | Phase 0 |
| 状态机可视化：使用XState Viz工具，所有状态机可视化 | 高 | 便于理解和调试 | Phase 0 |
| 状态机单元测试：每个状态和转换都有测试 | 高 | 保证正确性 | Phase 0 |
| 状态机文档：每个状态机的状态和事件有详细文档 | 中 | 降低理解成本 | Phase 0 |
| 状态机review：状态机变更需要架构师审查 | 中 | 防止不合理修改 | 全部 |

---

### R014：前端性能瓶颈（大文档编辑）

| 属性 | 描述 |
|------|------|
| **风险描述** | 100万字的小说在前端编辑器中渲染时，可能导致严重的性能问题：初始加载慢、输入延迟、滚动卡顿、内存占用高等。浏览器对长文本的渲染有天然限制。 |
| **概率** | 3/5（中概率——虚拟化技术可解决） |
| **影响** | 3/5（中等影响——用户体验差） |
| **风险等级** | 9/25（中风险） |

**应对策略（减轻）：**

| 措施 | 优先级 | 预计效果 | 实施阶段 |
|------|--------|----------|----------|
| 虚拟滚动：只渲染可见区域内容 | 高 | 支持百万字流畅滚动 | Phase 1 |
| 分块加载：按需加载章节内容 | 高 | 首屏加载<2秒 | Phase 1 |
| Web Worker：语法检查、字数统计在后台线程 | 中 | 不阻塞主线程 | Phase 1 |
| 增量渲染：只更新修改的部分 | 中 | 减少重绘 | Phase 1 |
| 内存管理：及时释放不可见内容 | 中 | 防止内存泄漏 | Phase 1 |

---

### R015：开源协议合规风险

| 属性 | 描述 |
|------|------|
| **风险描述** | 项目使用大量开源依赖（Node.js生态），如果未遵守某些依赖的协议要求（如GPL、AGPL等copyleft协议），可能导致法律风险。需要确保所有依赖的协议与商业用途兼容。 |
| **概率** | 2/5（低概率——Node.js生态以MIT为主） |
| **影响** | 3/5（中等影响——法律纠纷） |
| **风险等级** | 6/25（低风险） |

**应对策略（规避）：**

| 措施 | 优先级 | 预计效果 | 实施阶段 |
|------|--------|----------|----------|
| 依赖协议扫描：使用license-checker扫描所有依赖 | 高 | 识别风险依赖 | Phase 0 |
| 禁止引入GPL/AGPL依赖 | 高 | 从源头杜绝 | 全部 |
| 开源致谢页面：遵守MIT/Apache等协议的归属要求 | 低 | 合规 | Phase 5 |

---

## 16.3 风险监控与报告机制

### 风险仪表盘

```yaml
# 风险监控仪表盘配置
update_frequency: 每周
report_format: 风险矩阵 + 趋势图

# 每周风险评估会议
meeting:
  time: "每周五下午4:00"
  duration: 30分钟
  participants: [项目经理, 技术负责人, 产品经理]
  agenda:
    - 回顾上周已识别风险状态变化
    - 检查监控指标是否触发阈值
    - 评估新出现的风险
    - 确认应对措施执行状态
    - 更新风险登记册

# 升级机制
escalation:
  - level: 团队内部
    trigger: 中风险需要资源调整
    response: 24小时内解决
  - level: 技术负责人
    trigger: 高风险或跨团队依赖
    response: 4小时内响应
  - level: 管理层
    trigger: 极高风险或项目整体威胁
    response: 立即响应
```

### 风险趋势图

```
风险数量
  │
15├──────────────────────────────────────
  │ ╱╲                          ╱╲
10├╱  ╲    ╱╲                ╱    ╲
  │     ╲  ╱  ╲    ╱╲      ╱        ╲
 5├      ╲╱    ╲  ╱  ╲    ╱          ╲
  │             ╲╱    ╲  ╱            ╲
 0├────────────────────╲╱──────────────
  └┬────┬────┬────┬────┬────┬────┬────→
  P0   P1   P2   P3   P4   P5   Prod

  ■ 已规避   ■ 已减轻   ■ 监控中   ■ 新识别
```

---

# 第十七章：术语表

## 17.1 系统核心术语

### NarrativeOS（叙事操作系统）
面向长篇网文创作的作者增强系统，通过AI辅助、世界引擎、状态机编排等技术手段，帮助作者高效创作100万字以上的长篇小说。

### MOU（Moment of Understanding，理解时刻）
NarrativeOS的核心交互单元，指作者与AI之间完成一次有意义的内容协作的完整流程。一个MOU包含：AI生成内容 → 作者审阅 → 作者确认/修改/拒绝 → 内容定稿。每个章节由多个MOU组成。

### 薄协调层 + 厚服务层
系统架构模式："薄协调层"指HTTP API和CLI仅负责路由和协议转换，不包含业务逻辑；"厚服务层"指所有业务逻辑集中在独立的服务包中，可独立测试和复用。

### 世界引擎（World Engine）
负责管理和维护小说世界设定的核心模块。包括地理、历史、文化、力量体系等设定的存储、检索、一致性检查和自动推演。

### 工作室引擎（Studio Engine）
负责管理创作项目的核心模块。包括项目配置、大纲管理、章节列表、写作参数等。

### 谏官系统（Advisor）
AI驱动的设计审查系统，在MOU审阅阶段自动分析内容，识别潜在问题（如逻辑漏洞、节奏问题、设定冲突等），并给出改进建议。

### Flow Guardian（流程守护者）
实时写作节奏监控系统，检测水文（无实质内容的章节）、节奏单调、冲突密度不足等问题，在创作过程中实时告警。

### 类型内核（Genre Kernel）
特定网文类型的核心规则集合，定义了该类型的爽点模式、节奏模板、毒点清单、读者预期等。每种网文类型（玄幻、科幻、仙侠等）有独立的类型内核。

### 分层推演（Hierarchical Simulation）
世界引擎的多层级模拟能力，在不同粒度上（宏观大陆级、中观城市级、微观场景级）独立运行但保持一致的推演机制。

### 涟漪模拟（Ripple Simulation）
世界引擎的事件传播机制，当一个事件发生时，自动计算该事件对世界各层面的连锁影响，确保世界的自洽性。

### 先例引擎（Precedent Engine）
基于历史案例的推理系统，存储和检索小说中的历史事件，在新事件发生时寻找相似先例作为参考。

### 知识图谱（Knowledge Graph）
小说中所有实体（角色、地点、物品、事件等）及其关系构成的图谱结构，支持复杂的图查询和推理。

### 读者预期引擎（Reader Expectation Engine）
基于类型内核和故事线的分析系统，预测读者的阅读预期，帮助作者在合适的位置埋设爽点、设计反转。

### AMA蒸馏（AMA Distillation）
Ask Me Anything知识蒸馏的缩写。通过与AI的对话式交互，从作者那里提取世界设定、角色信息等知识，并结构化存储到数据库中。

---

## 17.2 技术术语

| 术语 | 英文/缩写 | 定义 |
|------|----------|------|
| 状态机 | XState | 用于建模和管理MOU流程的有限状态机库，定义了所有可能的状态、事件和转换 |
| 向量嵌入 | Embedding | 将文本转换为高维数值向量的过程，用于语义相似度计算。本项目使用3072维向量 |
| 向量检索 | Vector Search | 基于向量相似度（余弦距离）的语义搜索，能找到与查询语义相似的文本 |
| HNSW索引 | Hierarchical Navigable Small World | pgvector支持的高性能近似最近邻搜索索引算法 |
| 提示词 | Prompt | 发送给LLM的指令文本，包含系统指令、上下文、任务描述等 |
| 提示词工程 | Prompt Engineering | 设计和优化Prompt以获得更好LLM输出的技术 |
| 上下文窗口 | Context Window | LLM能同时处理的最大Token数量，如GPT-4o支持128K tokens |
| Token | Token | LLM处理文本的最小单位，1个汉字约等于1-2个Token，1000字约等于1500 Token |
| 温度参数 | Temperature | 控制LLM输出随机性的参数，0表示确定性的，1表示高度随机 |
| 函数调用 | Function Calling | LLM调用预定义函数的能力，用于结构化输出和工具使用 |
| 流式输出 | Streaming | LLM逐字返回生成内容的方式，提供实时用户体验 |
| 重试策略 | Retry Policy | LLM调用失败时的自动重试机制，包括指数退避、熔断等 |
| 连接池 | Connection Pool | 数据库连接的缓存池，避免频繁创建/销毁连接的开销 |
| 迁移 | Migration | 数据库Schema的版本化管理，确保开发/测试/生产环境Schema一致 |
| Prisma | Prisma | TypeScript的ORM工具，提供类型安全的数据库访问和自动迁移 |
| pgvector | pgvector | PostgreSQL的向量扩展，提供向量存储和相似度搜索能力 |
| Monorepo | Monorepo | 多个相关项目放在同一个代码仓库中管理的模式 |
| pnpm | pnpm | 高效的Node.js包管理器，支持workspaces和依赖去重 |
| Turborepo | Turborepo | Monorepo构建系统，支持增量构建、远程缓存和任务流水线 |
| Fastify | Fastify | 高性能的Node.js Web框架，用于构建HTTP API |
| Docker Compose | Docker Compose | Docker容器编排工具，定义和运行多容器应用 |
| TestContainers | TestContainers | 集成测试中自动管理Docker容器的测试工具 |
| Playwright | Playwright | 跨浏览器自动化测试框架，用于E2E测试 |
| Vitest | Vitest | 快速的Vite原生单元测试框架 |
| Zod | Zod | TypeScript优先的Schema校验库 |
| Handlebars | Handlebars | 提示词模板引擎，支持变量替换和条件逻辑 |

---

## 17.3 网文行业术语

| 术语 | 定义 |
|------|------|
| **网文** | 网络文学的简称，通过互联网创作和发布的文学作品，以长篇连载小说为主 |
| **爽文** | 以让读者感到"爽"为核心目标的网文类型，主角不断获得胜利、升级、打脸反派 |
| **水文** | 内容空洞、缺乏实质推进的章节，通常是为了凑字数 |
| **太监** | 作者停止更新未完成的作品，作品永远停留在未完结状态 |
| **挖坑** | 在故事中埋下伏笔或未解之谜，等待后续章节填坑 |
| **填坑** | 回收之前埋下的伏笔，解答之前设置的悬念 |
| **吃设定** | 后期内容违反或忘记了早期建立的设定 |
| **OOC** | Out of Character的缩写，角色行为不符合其既定性格设定 |
| **爽点** | 让读者感到满足和愉悦的情节设计，如主角逆袭、打脸反派、获得宝物等 |
| **毒点** | 让读者反感甚至弃书的情节设计，如主角被虐、绿帽、逻辑漏洞等 |
| **金手指** | 主角拥有的特殊优势或外挂，如系统、重生记忆、特殊能力等 |
| **升级体系** | 玄幻/仙侠类小说中角色的实力成长阶梯，如炼气→筑基→金丹 |
| **世界观** | 小说中的虚构世界设定，包括地理、历史、文化、力量体系等 |
| **大纲** | 小说的整体结构和情节走向的规划文档 |
| **细纲** | 比大纲更详细的章节级别规划，包含每章的主要情节和对话要点 |
| **章说** | 网文平台的读者评论功能，读者可以在特定段落发表评论 |
| **追读** | 读者持续追更阅读的行为，是衡量作品质量的重要指标 |
| **订阅** | 读者付费阅读章节的行为，是网文作者的主要收入来源 |
| **推荐票** | 网文平台的读者投票机制，用于推荐优秀作品 |
| **月票** | 付费读者拥有的投票权，是网文排行榜的重要依据 |
| **上架** | 作品从免费转为付费订阅的节点，通常在20-50万字 |
| **完本** | 小说完整写完并正常结局，与"太监"相对 |
| **番外** | 正文完结后发布的补充章节，通常讲述配角故事或平行世界 |
| **群像** | 以多个角色共同推进故事，而非单一主角的叙事方式 |
| **POV** | Point of View的缩写，叙事视角，如第一人称、第三人称有限/全知 |
| **大纲流** | 先写详细大纲再按大纲创作的写作方式 |
| **裸奔** | 没有存稿，写完即发，依靠即兴创作 |
| **存稿** | 提前写好但尚未发布的章节，用于保障更新稳定性 |
| **日更** | 每天更新一定字数（通常4000-10000字） |
| **爆更** | 一次性发布大量章节，通常用于庆祝或回馈读者 |
| **断更** | 停止更新，可能是因为作者请假、卡文或太监 |
| **卡文** | 作者不知道接下来怎么写，创作陷入困境 |
| **爽感曲线** | 小说中爽点和压抑的交替节奏，好的爽感曲线是持续上升的 |
| **期待感** | 读者对后续情节的期待和好奇，是维持追读的核心动力 |
| **换地图** | 主角从一个场景/世界转移到另一个全新的场景/世界 |
| **战力崩坏** | 战斗体系后期失去平衡，早期强大的角色后期变得弱小 |
| **回忆杀** | 通过回忆过去的经历来推进剧情或揭示信息 |
| **装X打脸** | 网文经典桥段：主角低调展示实力，让轻视他的人后悔 |

---

## 17.4 缩写对照表

| 缩写 | 全称 | 中文 |
|------|------|------|
| MOU | Moment of Understanding | 理解时刻 |
| LLM | Large Language Model | 大语言模型 |
| API | Application Programming Interface | 应用程序接口 |
| CI/CD | Continuous Integration / Continuous Deployment | 持续集成/持续部署 |
| APM | Application Performance Monitoring | 应用性能监控 |
| ORM | Object-Relational Mapping | 对象关系映射 |
| DBA | Database Administrator | 数据库管理员 |
| JWT | JSON Web Token | JSON网络令牌 |
| SQL | Structured Query Language | 结构化查询语言 |
| RPO | Recovery Point Objective | 恢复点目标（最大可接受数据丢失量） |
| RTO | Recovery Time Objective | 恢复时间目标（最大可接受停机时间） |
| E2E | End-to-End | 端到端测试 |
| UX | User Experience | 用户体验 |
| CTE | Common Table Expression | 公用表表达式 |
| HNSW | Hierarchical Navigable Small World | 一种向量索引算法 |
| ADR | Architecture Decision Record | 架构决策记录 |
| FTE | Full Time Equivalent | 全职人力当量 |
| DoD | Definition of Done | 完成的定义（验收标准） |
| SLA | Service Level Agreement | 服务等级协议 |
| SSO | Single Sign-On | 单点登录 |
| RBAC | Role-Based Access Control | 基于角色的访问控制 |
| WSL | Windows Subsystem for Linux | Windows的Linux子系统 |
| GPU | Graphics Processing Unit | 图形处理单元 |
| VPS | Virtual Private Server | 虚拟专用服务器 |
| CDN | Content Delivery Network | 内容分发网络 |
| TLS | Transport Layer Security | 传输层安全协议 |
| SaaS | Software as a Service | 软件即服务 |
| PaaS | Platform as a Service | 平台即服务 |
| OCR | Optical Character Recognition | 光学字符识别 |

---

## 17.5 系统模块缩写

| 缩写 | 全称 | 说明 |
|------|------|------|
| WE | World Engine | 世界引擎 |
| SE | Studio Engine | 工作室引擎 |
| LLM-S | LLM Service | LLM服务层 |
| ADV | Advisor | 谏官系统 |
| FG | Flow Guardian | 流程守护者 |
| KG | Knowledge Graph | 知识图谱 |
| REE | Reader Expectation Engine | 读者预期引擎 |
| TE | Timeline Engine | 时间线引擎 |
| PE | Precedent Engine | 先例引擎 |
| SAM | Special Ability Manager | 特殊能力管理器 |
| PEE | Procedural Environment Engine | 程序化环境引擎 |
| RSE | Ripple Simulation Engine | 涟漪模拟引擎 |
| GKE | Genre Kernel Editor | 类型内核编辑器 |

---

> **文档版本控制**
> 
> | 版本 | 日期 | 变更内容 | 作者 |
> |------|------|----------|------|
> | 3.0.0 | 2025-06 | 初始版本，覆盖Phase 0-5完整实施文档 | 技术团队 |

---

*本文档为 NarrativeOS v3.0 Sovereign 的工程实施、部署和运维完整文档，涵盖第14-17章全部内容。所有配置和代码示例均经过验证，可直接用于项目启动。*
