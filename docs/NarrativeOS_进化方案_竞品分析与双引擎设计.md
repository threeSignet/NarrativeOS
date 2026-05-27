# NarrativeOS 深度进化方案：竞品分析与双引擎架构设计

> 分析日期：2026-05-21
> 竞品来源：B站视频 BV1cJQFBwE3b（AI小说写作助手演示）
> 目标项目：C:\Users\10652\Documents\person\NarrativeOS

---

## 目录

1. [竞品全景分析](#一竞品全景分析)
2. [NarrativeOS 现有能力盘点](#二narrativeos-现有能力盘点)
3. [双维度对比矩阵](#三双维度对比矩阵)
4. [核心差距与补强方案](#四核心差距与补强方案)
5. [双引擎架构深度设计](#五双引擎架构深度设计)
6. [功能模块详细设计](#六功能模块详细设计)
7. [实施路线图](#七实施路线图)
8. [风险与建议](#八风险与建议)

---

## 一、竞品全景分析

### 1.1 项目概述

从B站视频帧提取的竞品（以下简称"竞品A"）是一款面向网文作者的AI小说写作助手，采用**桌面端应用**形态，界面风格为深色主题，三栏布局（项目树/编辑区/AI面板），整体定位是**AI辅助生成 + 作者精细化编辑**的混合工作流。

### 1.2 竞品A完整功能树

```
AI小说写作助手
├── 项目层
│   ├── 项目列表管理
│   ├── 新建项目向导（世界观 → 角色 → 大纲）
│   └── 导出功能
│
├── 世界观设定（世界面板）
│   ├── 基础设定
│   │   ├── 故事核心（故事题材、主题标签）
│   │   └── 世界背景
│   ├── 地理地图
│   │   ├── 地图可视化（支持地点标注、势力范围）
│   │   └── 地点详情编辑
│   ├── 势力阵营
│   │   ├── 势力列表
│   │   └── 势力关系
│   ├── 货币体系
│   │   └── 货币种类与汇率设定
│   ├── 力量体系
│   │   └── 等级/境界划分
│   ├── 功法体系
│   │   └── 功法/技能库
│   ├── 物品列表
│   │   └── 道具/装备管理
│   ├── 特殊设定
│   │   └── 自定义规则/禁忌
│   ├── 大纲设定
│   │   ├── 多卷结构（卷名、章节范围）
│   │   └── 章节列表（100章/卷）
│   ├── 情节脉络
│   │   ├── 结构模式（五幕式、三幕式、英雄之旅、起承转合、序破急）
│   │   └── 每幕的章节范围 + 内容摘要 + 核心事件 + 冲突升级 + 情感基调
│   └── 伏笔管理
│       ├── 伏笔列表（已埋设/待呼应/已回收）
│       ├── AI生成伏笔（指定章节范围、类型、埋设模式）
│       ├── AI完善伏笔（补充关联剧情）
│       └── 伏笔 ↔ 章节自动关联
│
├── 角色管理（角色面板）
│   ├── 角色列表（主角/配角/反派分类）
│   ├── 角色卡片
│   │   ├── 基础信息（姓名、性别、年龄、身份、外貌、性格、口头禅）
│   │   ├── 角色属性（境界/等级、力量值等）
│   │   ├── 人际关系（与谁有关联、关系类型）
│   │   └── 人物小传（人生经历、核心意义）
│   ├── AI生成角色（从人设生成完整角色卡）
│   ├── AI完善角色（补充缺失字段）
│   └── 人物关系图（可视化网络图）
│
├── 章节编辑（编辑器核心）
│   ├── 项目树（左侧大纲列表）
│   │   ├── 卷/章层级
│   │   ├── 字数统计（每章实时字数）
│   │   └── 完成状态标记
│   ├── 编辑器
│   │   ├── 富文本编辑（行号显示、字数统计）
│   │   ├── 实体高亮（角色名、物品名、地名等自动着色）
│   │   ├── 实体悬浮卡片（hover显示角色信息）
│   │   ├── 便签功能（行内批注）
│   │   └── 查找替换
│   ├── AI完善面板（编辑器右侧）
│   │   ├── 单节点/批量模式
│   │   ├── 对比模式（原文 vs AI修改）
│   │   ├── 完善深度（基础完善 / 详细完善）
│   │   ├── 风格模板（战斗场景加强、情感催化、悬念加强、世界观展开、角色深化、爽点强化）
│   │   ├── 自定义要求输入
│   │   └── 智能引入伏笔开关
│   └── 章节信息面板
│       ├── 基本信息（章节标题、目标字数）
│       ├── 情绪节奏（情绪控制点：紧张度、欢乐度等强度滑块）
│       ├── 关联数据（出场角色、关键物品、功法、伏笔）
│       └── 状态标签
│
├── AI助手面板（编辑器右侧常驻面板）
│   ├── 智能续写（根据上下文续写内容）
│   ├── 文字润色（提升文笔）
│   ├── 对话优化（改善对话自然度）
│   ├── 剧情发展（推进情节）
│   ├── 逻辑修正（修复剧情bug）
│   ├── 文段展开（扩展简略段落）
│   ├── 自定义要求输入
│   └── 高频词分析 + 去AI味润色
│
├── AI生成工作流
│   ├── 初始构建（创建项目时）
│   │   ├── AI生成世界观设定
│   │   ├── AI生成角色设定
│   │   └── AI生成金手指设定
│   ├── 大纲生成
│   │   ├── 大纲模式（粗纲，100章概览）
│   │   ├── 细纲模式（每章详细情节）
│   │   ├── 单卷生成 / 批量全卷
│   │   ├── 字数规划（自动分配每章字数）
│   │   ├── 叙事节奏控制（快/中/慢）
│   │   ├── 内容侧重（战斗场景、对话互动、心理描写、环境渲染、剧情推进、感情线、日常描写、悬念铺设）
│   │   └── 额外要求输入
│   ├── 正文生成
│   │   ├── 批量生成（选择多章一次性生成）
│   │   ├── 单章生成
│   │   ├── 写作风格（硬核写实、轻松幽默、热血燃向、细腻文艺、暗黑压抑、诙谐吐槽）
│   │   ├── 内容侧重（同大纲）
│   │   ├── 节奏控制（快节奏/中节奏/慢节奏）
│   │   ├── 自由写作模式（不严格按字数生成）
│   │   └── 额外要求输入
│   └── 章节完善
│       ├── AI完善单章
│       └── AI完善多章
│
├── 记忆与一致性系统
│   ├── 历史年表（时间线事件管理）
│   ├── 时间线（可视化剧情时间轴）
│   ├── 已经历事件线（每章自动提取重要事件保存到记忆库）
│   │   ├── 章节标题关联
│   │   ├── 事件摘要（重大事件、重要物品、人物羁绊）
│   │   ├── 变化记录（心理变化、能力变化、状态变化）
│   │   ├── 重要人物摘要
│   │   └── 重要备注
│   └── 上下文记忆注入（AI生成时自动携带全部设定）
│       └── 当前模型 + Token用量显示（如 5,016/256,000 tokens 2%）
│
├── 工具箱
│   ├── 语音校对（TTS朗读正文，用于发现语病）
│   ├── 数据统计
│   └── 高频词分析
│
├── 规则管理（设置层）
│   ├── 规则列表
│   ├── 应用场景绑定（AI对话/生成章节/生成正文/生成大纲/完善角色/续写/润色/去AI味/伏笔/世界观/情节构建/章节分析...）
│   ├── 规则内容（自定义Prompt注入）
│   └── 启用开关
│
└── 系统设置
    ├── 模型选择（Seed 2.0 Pro / DeepSeek-Chat 等）
    └── Token资源监控
```

### 1.3 竞品A核心技术亮点

| 亮点 | 说明 |
|------|------|
| **自动上下文注入** | 每次AI调用自动携带全部世界观、角色、大纲、已写章节摘要，确保一致性 |
| **Token用量可视化** | 实时显示当前上下文占用的Token数和比例（如 5,016/256,000 tokens 2%） |
| **实体高亮系统** | 正文中角色名、物品名、地名等自动着色，hover显示详细信息卡片 |
| **情绪节奏控制** | 每章可设置情绪控制点（紧张度、欢乐度等），用滑块调节强度 |
| **已经历事件线** | 每写完一章自动提取关键事件、物品、人物羁绊保存到记忆库，解决AI遗忘问题 |
| **伏笔自动关联** | 创建/完善伏笔时自动关联到指定章节范围，AI写作时会自动调用 |
| **规则管理** | 可为每个AI功能添加自定义规则（去AI味规则、对话规则、润色规则等） |
| **情节脉络结构** | 支持五幕式/三幕式/英雄之旅等经典叙事结构，AI严格围绕结构写作 |
| **智能引入伏笔** | 完善章节时可开关"智能引入伏笔"，AI会自动植入相关伏笔 |
| **去AI味润色** | 专门的去AI味功能，配合高频词分析，过滤AI写作痕迹 |
| **语音校对** | TTS朗读正文，帮助发现语病和不通顺的地方 |
| **便签批注** | 行内便签功能，记录写作灵感 |

---

## 二、NarrativeOS 现有能力盘点

### 2.1 架构优势（竞品A不具备）

| 能力 | 说明 |
|------|------|
| **TDD全流程** | 从Story测试开始，每个Epic都有对应的测试用例 |
| **MOU状态机** | 严谨的作者-AI协作协议，所有AI行为产生提案等待作者裁决 |
| **LLM编排架构** | Vercel AI SDK 适配，支持多模型切换和降级 |
| **世界子引擎** | 20+领域引擎（地理、历史、社交、经济等），专业领域查询 |
| **谏官系统** | 自动化风控，章节提交前检查一致性风险 |
| **Flow Guardian** | 检测作者是否偏离Story测试 |
| **SSE流式生成** | 实时推送生成过程，非阻塞式体验 |
| **Retcon原子更新** | 章节解冻 → 重新绑定 → 重新验证 → 重新冻结的完整工作流 |
| **关系网查询** | 跨实体关系图谱查询 |
| **神谕查询** | 自然语言 → 跨引擎检索 |
| **幂等性设计** | 所有写操作支持Idempotency-Key |
| **Zod Schema校验** | 全链路类型安全 |
| **gRPC/HTTP双协议** | 服务间通信灵活 |

### 2.2 现有功能模块

```
NarrativeOS
├── 界面层
│   ├── 项目列表
│   ├── 驾驶舱（Cockpit）—— 三栏布局
│   │   ├── 左：方案区（SchemePanel）
│   │   ├── 中：编辑区（Editor）
│   │   └── 右：面板区（CommandPanel + HistoryPanel + ToolboxPanel + DebugPanel + Canvas）
│   ├── 频道切换（4个频道）
│   └── 全局帮助
│
├── 协调层（Orchestrator）
│   ├── 请求路由
│   ├── 状态机（MOU + 第5轮设计）
│   ├── LLM网关（Vercel AI SDK）
│   ├── 工具调度
│   └── 事件广播
│
├── Agent层（5个Agent）
│   ├── WorldAgent —— 世界一致性
│   ├── StudioAgent —— 创意工作室
│   ├── CensorAgent —— 审查者
│   ├── GuardAgent —— 守护进程
│   └── Shell封装（ShellContext → ShellInput → ShellOutput）
│
├── 服务层
│   ├── 世界子引擎（20+领域）
│   ├── 章节服务（固化/解冻）
│   ├── 谏官服务（风险检测）
│   ├── 关系图谱服务
│   ├── 时间线服务
│   ├── Oracle查询服务
│   └── Prompt构建服务
│
└── 数据层（Drizzle ORM + SQLite）
    ├── Project Repository
    ├── Entity Repository
    ├── Chapter Repository
    └── Relationship Repository
```

### 2.3 竞品A有而NarrativeOS缺少的功能

| # | 缺失功能 | 重要性 | 竞品实现方式 |
|---|---------|--------|-------------|
| 1 | **Token用量可视化** | ⭐⭐⭐⭐⭐ | 每次AI调用显示上下文Token占用比例 |
| 2 | **实体高亮与悬浮卡片** | ⭐⭐⭐⭐⭐ | 正文中自动识别并着色角色/物品/地名 |
| 3 | **情绪节奏控制点** | ⭐⭐⭐⭐⭐ | 每章可设置紧张度/欢乐度等情绪滑块 |
| 4 | **已经历事件线（自动记忆提取）** | ⭐⭐⭐⭐⭐ | 写完一章自动提取关键事件保存 |
| 5 | **伏笔管理系统** | ⭐⭐⭐⭐⭐ | 伏笔创建/完善/回收 + 章节自动关联 |
| 6 | **情节脉络结构模板** | ⭐⭐⭐⭐⭐ | 五幕式/三幕式/英雄之旅等 |
| 7 | **规则管理（自定义Prompt注入）** | ⭐⭐⭐⭐⭐ | 按功能绑定自定义规则 |
| 8 | **去AI味润色** | ⭐⭐⭐⭐⭐ | 专门的去AI味 + 高频词分析 |
| 9 | **语音校对（TTS）** | ⭐⭐⭐⭐ | 朗读正文发现语病 |
| 10 | **便签批注** | ⭐⭐⭐⭐ | 行内便签记录灵感 |
| 11 | **人物关系图可视化** | ⭐⭐⭐⭐ | 网络图展示人物关系 |
| 12 | **AI续写/润色/对话/发展/修正/展开** | ⭐⭐⭐⭐⭐ | 编辑器常驻AI助手面板 |
| 13 | **AI完善面板（单节点/批量/对比/深度/风格）** | ⭐⭐⭐⭐⭐ | 右侧完善面板 |
| 14 | **地图可视化** | ⭐⭐⭐⭐ | 地点标注 + 势力范围 |
| 15 | **写作风格选择** | ⭐⭐⭐⭐ | 硬核写实/轻松幽默/热血燃向等6种 |
| 16 | **内容侧重选择** | ⭐⭐⭐⭐ | 战斗场景/对话互动/心理描写等8种 |
| 17 | **叙事节奏控制** | ⭐⭐⭐⭐ | 快/中/慢节奏 |
| 18 | **自由写作模式** | ⭐⭐⭐ | 不按字数严格限制 |
| 19 | **大纲模式 vs 细纲模式** | ⭐⭐⭐⭐ | 粗纲/细纲切换 |
| 20 | **历史年表** | ⭐⭐⭐ | 时间线事件管理 |
| 21 | **时间线可视化** | ⭐⭐⭐ | 剧情时间轴 |
| 22 | **AI完善角色** | ⭐⭐⭐⭐ | 自动补充角色卡缺失字段 |
| 23 | **AI生成金手指** | ⭐⭐⭐ | 金手指设定生成 |
| 24 | **智能引入伏笔开关** | ⭐⭐⭐⭐⭐ | 完善章节时自动植入伏笔 |
| 25 | **批量生成 vs 单章生成** | ⭐⭐⭐⭐ | 灵活选择 |
| 26 | **多模型支持** | ⭐⭐⭐⭐⭐ | Seed/DeepSeek/Claude/GPT等 |

---

## 三、双维度对比矩阵

### 3.1 架构维度对比

| 维度 | 竞品A | NarrativeOS | 评价 |
|------|-------|-------------|------|
| 架构方法论 | 未明确 | TDD + Clean Architecture + 领域驱动 | NarrativeOS胜 |
| 状态机 | 无（直接生成） | MOU协议（严谨提案-裁决流程） | NarrativeOS胜 |
| LLM编排 | 单模型调用 | 多模型适配 + 降级策略 | NarrativeOS胜 |
| 世界引擎 | 数据库查询 | 20+领域专业引擎 | NarrativeOS胜 |
| 风控系统 | 无 | 谏官 + Flow Guardian | NarrativeOS胜 |
| 数据层 | 未知 | Drizzle ORM + Zod校验 | NarrativeOS胜 |
| 通信协议 | 未知 | SSE + WebSocket + REST + gRPC | NarrativeOS胜 |
| 幂等性 | 未知 | 完整Idempotency-Key机制 | NarrativeOS胜 |
| 作者控制权 | 生成后手动修改 | 提案-裁决模式（作者始终把关） | NarrativeOS胜 |

### 3.2 功能维度对比

| 维度 | 竞品A | NarrativeOS | 评价 |
|------|-------|-------------|------|
| 世界观设定 | ⭐⭐⭐⭐⭐ 12个子模块 | ⭐⭐⭐ 基础实体管理 | 竞品A胜 |
| 角色管理 | ⭐⭐⭐⭐⭐ 完整角色卡 + 关系图 | ⭐⭐⭐ 基础Entity | 竞品A胜 |
| 大纲管理 | ⭐⭐⭐⭐⭐ 多卷 + 情绪控制 + 脉络 | ⭐⭐⭐ 基础章节树 | 竞品A胜 |
| 编辑器体验 | ⭐⭐⭐⭐⭐ 实体高亮 + 便签 + 悬浮卡片 | ⭐⭐ 基础编辑器 | 竞品A胜 |
| AI助手面板 | ⭐⭐⭐⭐⭐ 6大功能常驻 | ❌ 无 | 竞品A胜 |
| AI完善面板 | ⭐⭐⭐⭐⭐ 深度/风格/对比 | ❌ 无 | 竞品A胜 |
| 记忆一致性 | ⭐⭐⭐⭐⭐ 自动提取 + 事件线 | ⭐⭐⭐⭐ 上下文注入 | 各有优劣 |
| 伏笔管理 | ⭐⭐⭐⭐⭐ 完整系统 | ❌ 无 | 竞品A胜 |
| 去AI味 | ⭐⭐⭐⭐⭐ 专门功能 + 规则 | ❌ 无 | 竞品A胜 |
| 语音校对 | ⭐⭐⭐⭐ TTS朗读 | ❌ 无 | 竞品A胜 |
| 规则管理 | ⭐⭐⭐⭐⭐ 按功能绑定规则 | ❌ 无 | 竞品A胜 |
| 地图可视化 | ⭐⭐⭐⭐ 地点标注 + 势力 | ❌ 无 | 竞品A胜 |
| 多模型支持 | ⭐⭐⭐⭐ 2-3个模型 | ⭐⭐⭐⭐⭐ 多模型 + 降级 | NarrativeOS胜 |
| 流式生成 | ⭐⭐⭐ 有但简单 | ⭐⭐⭐⭐⭐ SSE完整实现 | NarrativeOS胜 |
| 批量生成 | ⭐⭐⭐⭐⭐ 批量/单章灵活 | ❌ 无 | 竞品A胜 |
| 写作风格 | ⭐⭐⭐⭐⭐ 6种风格 | ❌ 无 | 竞品A胜 |

### 3.3 综合评估

- **架构层面**：NarrativeOS完胜，工程化程度、可维护性、扩展性远超竞品
- **功能层面**：竞品A完胜，功能丰富度、作者体验、AI集成深度远超NarrativeOS
- **核心差距**：NarrativeOS缺的是**面向作者的功能层**，架构层已经很优秀

**结论：NarrativeOS需要"功能大补课"，在保持架构优势的同时，把竞品A的所有核心功能都吸收进来，并在此基础上超越。**

---

## 四、核心差距与补强方案

### 4.1 第一优先级（必做，直接影响写作体验）

#### P1-1: 编辑器AI助手面板

**现状**：NarrativeOS编辑器只有基础编辑功能，没有任何AI辅助。

**目标**：在编辑器右侧常驻AI助手面板，提供以下功能：

| 功能 | 触发方式 | 说明 |
|------|---------|------|
| 智能续写 | 光标处触发 | 根据上文续写下一段 |
| 文字润色 | 选中文本后触发 | 提升文笔，改善表达 |
| 对话优化 | 选中文本后触发 | 让对话更自然、更符合角色性格 |
| 剧情发展 | 光标处触发 | 推进当前情节 |
| 逻辑修正 | 选中文本后触发 | 发现并修复剧情逻辑问题 |
| 文段展开 | 选中文本后触发 | 将简略段落扩展丰富 |

**设计要点**：
- 所有操作产生Proposal，走MOU状态机，作者裁决后应用
- 支持自定义要求输入（附加Prompt）
- 支持快捷键触发（如 Ctrl+Shift+C 续写）

#### P1-2: Token用量可视化

**现状**：NarrativeOS没有上下文Token监控。

**目标**：每次AI调用时在UI上显示：
```
上下文占用: 5,016 / 256,000 tokens (2%)
当前模型: Claude-4
资源状态: 充足 / 紧张 / 不足
```

**技术方案**：
- 在PromptBuilder服务中集成tiktoken计算
- 每次构建Prompt时计算Token数
- 在SSE流开始时推送token_info事件
- UI层在AI面板顶部显示进度条

#### P1-3: 实体高亮与悬浮卡片

**现状**：编辑器是纯文本，没有实体识别。

**目标**：
1. **实体高亮**：正文中自动识别角色名、物品名、地名、功法名等，用不同颜色标注
2. **悬浮卡片**：鼠标hover实体时显示卡片，包含：
   - 实体类型图标
   - 实体名称
   - 关键属性摘要（如角色：境界、身份）
   - 快速编辑入口
3. **点击跳转**：点击实体可直接打开对应设定面板

**技术方案**：
- 编辑器使用Monaco Editor或TipTap + 自定义Decoration
- 从World子引擎获取实体列表，构建正则匹配规则
- 悬浮卡片用Popover组件实现
- 需要实时同步实体列表变化

#### P1-4: 情绪节奏控制点

**现状**：NarrativeOS没有章节级别的情绪控制。

**目标**：每章可设置情绪控制点：
- 情绪类型：紧张度、欢乐度、悲伤度、愤怒度、期待度、恐怖度、温馨度、爽感度
- 强度滑块：0-10
- 位置标记：在章节内的具体位置（段落级别）
- AI生成时读取这些控制点，调整写作情绪

**设计要点**：
- 在Chapter元数据中新增emotion_points字段
- 编辑器支持在段落旁添加情绪标记（小色块）
- AI生成Prompt中注入情绪控制指令

#### P1-5: AI完善面板（编辑器右侧）

**现状**：NarrativeOS没有章节完善的专门面板。

**目标**：提供完整的AI完善功能：

| 功能 | 说明 |
|------|------|
| 单节点/批量 | 完善当前章节或批量选择多章 |
| 对比模式 | 原文 vs AI修改，差异高亮 |
| 完善深度 | 基础完善（细节/角色/情绪）/ 详细完善（全部字段） |
| 风格模板 | 战斗场景加强、情感催化、悬念加强、世界观展开、角色深化、爽点强化、矛盾激化 |
| 自定义要求 | 额外Prompt输入 |
| 智能引入伏笔 | 开关：AI自动植入相关伏笔 |

**技术方案**：
- 新增StudioAgent的`enhance`能力
- 走MOU流程：生成完善提案 → 作者对比 → 裁决
- 对比视图使用diff算法

### 4.2 第二优先级（重要，提升专业度）

#### P2-1: 伏笔管理系统

**目标**：
- 伏笔列表：已埋设 / 待呼应 / 已回收
- AI生成伏笔：
  - 输入：描述想要的伏笔（如"设计一个关于主角身世的伏笔"）
  - 指定类型：商业伏笔 / 物品伏笔 / 线索伏笔 / 人物伏笔
  - 指定重要度：低/中/高/极高
  - 埋设模式：AI自动选择 / 手动指定章节范围
  - 指定埋设章节和回收章节
- AI完善伏笔：补充关联剧情、完善提示词
- 伏笔自动关联：创建/完善伏笔时自动关联到章节

**数据模型**：
```typescript
interface Foreshadowing {
  id: string;
  title: string;
  description: string;
  type: 'commercial' | 'item' | 'clue' | 'character' | 'plot';
  importance: 'low' | 'medium' | 'high' | 'critical';
  status: 'planted' | 'pending' | 'resolved';
  plantChapters: string[];  // 埋设章节
  resolveChapters: string[]; // 回收章节
  relatedEntities: string[]; // 关联实体
  aiGenerated: boolean;
  customRules: string[]; // 绑定的规则
}
```

#### P2-2: 规则管理系统

**目标**：
- 全局规则管理面板
- 每条规则包含：标题、内容（Prompt）、应用场景（多选）、启用开关
- 应用场景覆盖所有AI功能：AI对话/生成章节/生成正文/生成大纲/完善角色/续写/润色/去AI味/伏笔/世界观/情节构建/章节分析
- AI执行时优先注入绑定的规则

**技术方案**：
- 新增Rule模型
- PromptBuilder服务在构建Prompt时查询当前功能绑定的规则
- 按顺序注入到system prompt中

#### P2-3: 已经历事件线（自动记忆提取）

**目标**：
- 每写完一章，AI自动提取：
  - 重大事件摘要（50字以内）
  - 变化记录：心理变化、能力变化、状态变化
  - 重要人物摘要（本章出现的重要人物及其行为）
  - 重要物品/功法/地点的出现记录
  - 备注
- 所有提取内容保存到"已经历事件线"数据库
- 后续AI生成时自动携带这些记忆

**技术方案**：
- 新增MemoryExtraction服务
- 章节commit后触发自动提取（异步）
- 使用LLM调用进行提取，Prompt模板化
- 提取结果存入experienced_events表
- PromptBuilder自动查询并注入

#### P2-4: 去AI味润色

**目标**：
- 专门的"去AI味"功能
- 配合高频词分析，找出AI常用词汇
- 一键替换或建议替换
- 支持导入自定义去AI味规则

**技术方案**：
- 新增DeAIWriting服务
- 维护AI高频词库（"首先"、"然而"、"值得注意的是"等）
- LLM润色 + 规则替换双管齐下
- 走MOU流程

#### P2-5: 人物关系图可视化

**目标**：
- 网络图展示所有角色关系
- 节点大小表示戏份权重
- 边的粗细表示关系强度
- 支持点击跳转角色详情
- 支持力导向布局

**技术方案**：
- 使用D3.js或Cytoscape.js
- 从Relationship服务获取数据
- 在Canvas面板或独立页面展示

### 4.3 第三优先级（增强体验）

#### P3-1: 地图可视化

- 上传/生成地图底图
- 地点标注（可拖拽）
- 势力范围着色
- 地点详情弹窗
- 与地理子引擎联动

#### P3-2: 语音校对（TTS）

- 使用浏览器TTS API或Edge TTS
- 支持选择章节朗读
- 支持调速
- 朗读时高亮当前句子

#### P3-3: 便签批注

- 行内便签（类似Google Docs评论）
- 便签列表视图
- 与AI助手联动（可针对便签内容请求AI帮助）

#### P3-4: 情节脉络结构模板

- 五幕式、三幕式、英雄之旅、起承转合、序破急
- 选择模板后自动填充结构框架
- AI严格围绕结构生成大纲

#### P3-5: 写作风格与内容侧重

- 写作风格：硬核写实、轻松幽默、热血燃向、细腻文艺、暗黑压抑、诙谐吐槽
- 内容侧重：战斗场景、对话互动、心理描写、环境渲染、剧情推进、感情线、日常描写、悬念铺设（可多选）
- 这些选项在生成大纲和正文时都可配置

#### P3-6: 历史年表与时间线

- 年表编辑（时间、事件、关联实体）
- 可视化时间轴
- 与章节自动关联

---

## 五、双引擎架构深度设计

### 5.1 什么是"双引擎"

竞品A实际上已经是"双引擎"思路：
1. **创作引擎**：负责生成大纲、生成正文、完善内容
2. **规则/记忆引擎**：负责维护一致性、注入上下文、执行规则

NarrativeOS的"双引擎"应该更强大：

### 5.2 NarrativeOS双引擎架构

```
┌─────────────────────────────────────────────────────────────┐
│                     作者层（Human Layer）                      │
│  驾驶舱 → 编辑器 → 方案面板 → 命令面板 → 历史面板 → 调试面板   │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   创作引擎      │  │   协调引擎       │  │   规则引擎      │
│  (Creative)     │  │  (Orchestrator)  │  │   (Rules)       │
├─────────────────┤  ├─────────────────┤  ├─────────────────┤
│ • 大纲生成      │  │ • 状态机         │  │ • 规则存储       │
│ • 正文生成      │  │ • 路由分发       │  │ • 规则绑定       │
│ • 续写          │  │ • LLM网关        │  │ • 规则注入       │
│ • 润色          │  │ • 事件广播       │  │ • 高频词库       │
│ • 对话优化      │  │ • 会话管理       │  │ • 去AI味规则     │
│ • 剧情发展      │  │ • 负载均衡       │  │ • 风格规则       │
│ • 逻辑修正      │  │ • 降级策略       │  │ • 对话规则       │
│ • 文段展开      │  │ • Token监控      │  │ • 用户自定义     │
│ • 角色生成      │  │ • 多模型调度     │  │                 │
│ • 世界观生成    │  │ • 上下文组装     │  │                 │
│ • 完善章节      │  │                 │  │                 │
│ • 完善角色      │  │                 │  │                 │
│ • 完善伏笔      │  │                 │  │                 │
│ • 去AI味        │  │                 │  │                 │
│ • 语音合成      │  │                 │  │                 │
└─────────────────┘  └─────────────────┘  └─────────────────┘
              │               │               │
              └───────────────┼───────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     世界引擎层（World Layer）                  │
│  地理引擎 / 历史引擎 / 社交引擎 / 经济引擎 / 文化引擎 ...     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     记忆引擎层（Memory Layer）                 │
│  已经历事件线 / 伏笔记忆 / 角色状态 / 时间线 / 关系图谱         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     数据层（Data Layer）                       │
│  SQLite + Drizzle ORM + Zod Schema                          │
└─────────────────────────────────────────────────────────────┘
```

### 5.3 双引擎联动机制

#### 5.3.1 创作引擎 ↔ 规则引擎 联动

```
作者触发"生成正文"
    │
    ▼
协调引擎接收请求
    │
    ├─→ 查询规则引擎：当前功能（generate_chapter）绑定了哪些规则？
    │       │
    │       └─→ 返回：去AI味规则v2 + 对话规则 + 风格规则（热血燃向）
    │
    ├─→ 查询记忆引擎：需要注入哪些上下文？
    │       │
    │       └─→ 返回：世界观摘要 + 角色卡×5 + 前3章摘要 + 已埋设伏笔×3 + 情绪控制点
    │
    ├─→ 组装完整Prompt（规则 + 上下文 + 作者输入）
    │
    ├─→ 创作引擎调用LLM生成
    │       │
    │       └─→ 流式返回内容（SSE）
    │
    ├─→ 生成完成后，规则引擎进行"后处理"
    │       │
    │       ├─→ 去AI味检测：发现"然而"×5，"值得注意的是"×2
    │       ├─→ 标记建议替换
    │       └─→ 返回润色建议
    │
    └─→ 生成Proposal → MOU状态机 → 等待作者裁决
```

#### 5.3.2 创作引擎 ↔ 记忆引擎 联动

```
作者写完第5章并提交（commit）
    │
    ▼
章节服务执行commit
    │
    ├─→ 触发记忆引擎：提取本章关键信息
    │       │
    │       ├─→ 提取事件："主角获得第一个客户订单"
    │       ├─→ 提取变化：心理变化"信心增强"、能力变化"营销技巧提升"
    │       ├─→ 提取人物："苏婉桐帮忙整理模板"
    │       ├─→ 提取物品："志愿填报数据表"
    │       └─→ 保存到experienced_events表
    │
    ├─→ 更新角色状态（苏婉桐关系值+10）
    │
    └─→ 检查伏笔：本章是否呼应了已埋设伏笔？
            │
            └─→ 是 → 更新伏笔状态为"已回收"
```

#### 5.3.3 创作引擎 ↔ 世界引擎 联动

```
作者写"林渊使用玄天剑法击败了魔教长老"
    │
    ▼
实体高亮系统识别"玄天剑法"和"魔教长老"
    │
    ├─→ 查询世界引擎：玄天剑法是否已注册？
    │       │
    │       ├─→ 是 → 显示等级/描述
    │       └─→ 否 → 标记"未注册实体"，建议作者补充设定
    │
    ├─→ 查询世界引擎：魔教长老在当前章节时间点的境界是？
    │       │
    │       └─→ 返回：金丹后期
    │
    └─→ 谏官系统检查：林渊当前境界是否能击败金丹后期？
            │
            ├─→ 否 → 生成风险Proposal："战力体系崩坏风险"
            └─→ 作者裁决
```

### 5.4 多模型调度策略

NarrativeOS应该支持多种模型，根据不同任务选择最佳模型：

| 任务类型 | 推荐模型 | 理由 |
|---------|---------|------|
| 大纲生成 | DeepSeek-V3 / Claude-4 | 需要强逻辑和创意 |
| 正文生成 | Seed 2.0 Pro / Claude-4 | 需要强写作能力 |
| 续写 | 轻量级模型（快）| 需要低延迟 |
| 润色 | Claude-4 / GPT-5 | 需要细腻的文笔 |
| 去AI味 | 专用模型 | 需要模式识别 |
| 逻辑修正 | Claude-4 | 需要强推理 |
| 记忆提取 | 轻量级模型 | 结构化提取，成本低 |
| 风险检测 | Claude-4 | 需要综合分析 |

**降级策略**：
- 主模型超时（60s）→ 降级到备用模型
- Token超出 → 精简上下文后重试
- 模型不可用 → 排队等待或切换模型

---

## 六、功能模块详细设计

### 6.1 模块一：编辑器AI助手面板

#### 6.1.1 UI布局

```
┌────────────────────────────────────────┬─────────────────┐
│                                        │  AI助手面板      │
│           编辑器（中间）                  │ ┌─────────────┐ │
│                                        │ │ 智能续写 ▶   │ │
│  第5章 苏晚桐的帮忙                      │ ├─────────────┤ │
│  ─────────────────                      │ │ 文字润色 ✎   │ │
│  傍晚的风裹着老城区油炸串的香气...        │ ├─────────────┤ │
│  [林渊] 捏着刚分到的八百块[现金]...      │ │ 对话优化 💬  │ │
│                                        │ ├─────────────┤ │
│                                        │ │ 剧情发展 ➤   │ │
│                                        │ ├─────────────┤ │
│                                        │ │ 逻辑修正 🛠   │ │
│                                        │ ├─────────────┤ │
│                                        │ │ 文段展开 ⬇   │ │
│                                        │ ├─────────────┤ │
│                                        │ │             │ │
│                                        │ │ 自定义要求：  │ │
│                                        │ │ ┌─────────┐ │ │
│                                        │ │ │ 输入额外 │ │ │
│                                        │ │ │ 要求...  │ │ │
│                                        │ │ └─────────┘ │ │
│                                        │ │             │ │
│                                        │ │ [开始生成]  │ │
│                                        │ └─────────────┘ │
│                                        │                  │
│                                        │ Token: 3,024/128K│
│                                        │ 模型: Claude-4   │
└────────────────────────────────────────┴─────────────────┘
```

#### 6.1.2 功能详细规格

**智能续写**
- 触发：光标位于文末 / 快捷键 Ctrl+Shift+C
- 流程：
  1. 获取光标前2000字上下文
  2. 查询记忆引擎：最近3章摘要 + 已埋设伏笔
  3. 查询情绪控制点：当前章节目标情绪
  4. 组装Prompt（含规则注入）
  5. LLM生成续写内容（500-1000字）
  6. 生成Proposal，diff预览
  7. 作者裁决（接受/修改/拒绝）

**文字润色**
- 触发：选中文本后点击
- 选项：
  - 轻微润色（保留原意，改善表达）
  - 深度润色（提升文学性）
  - 风格转换（切换到指定风格）
- 支持对比视图（原文/修改后）

**对话优化**
- 触发：选中对话段落
- 功能：
  - 让对话更符合角色性格
  - 增加潜台词
  - 改善节奏感
  - 消除重复感

**剧情发展**
- 触发：光标处
- 功能：
  - 根据当前情节推进到下一个情节点
  - 自动调用大纲服务获取下一目标
  - 确保与大纲一致

**逻辑修正**
- 触发：选中文本
- 功能：
  - 检查时间线一致性
  - 检查战力体系一致性
  - 检查人物行为合理性
  - 标记问题并提供修改建议

**文段展开**
- 触发：选中简略段落
- 功能：
  - 扩写细节描写
  - 增加环境渲染
  - 增加心理活动
  - 指定展开方向

### 6.2 模块二：AI完善面板

#### 6.2.1 UI布局

```
┌────────────────────────────────────────┬─────────────────┐
│                                        │  AI完善面板      │
│           编辑器                        │ ┌─────────────┐ │
│                                        │ │ 单节点 / 批量│ │
│                                        │ ├─────────────┤ │
│                                        │ │ 对比 ▶       │ │
│                                        │ ├─────────────┤ │
│                                        │ │ 完善深度：    │ │
│                                        │ │ ○ 基础完善   │ │
│                                        │ │ ● 详细完善   │ │
│                                        │ ├─────────────┤ │
│                                        │ │ 风格模板：    │ │
│                                        │ │ □ 战斗场景加强│ │
│                                        │ │ □ 情感催化   │ │
│                                        │ │ □ 悬念加强   │ │
│                                        │ │ □ 世界观展开 │ │
│                                        │ │ □ 角色深化   │ │
│                                        │ │ □ 爽点强化   │ │
│                                        │ │ □ 矛盾激化   │ │
│                                        │ ├─────────────┤ │
│                                        │ │ 自定义要求   │ │
│                                        │ │ ┌─────────┐ │ │
│                                        │ │ │         │ │ │
│                                        │ │ └─────────┘ │ │
│                                        │ ├─────────────┤ │
│                                        │ │ 智能引入伏笔 │ │
│                                        │ │ [开关]       │ │
│                                        │ ├─────────────┤ │
│                                        │ │ [开始完善]   │ │
│                                        │ └─────────────┘ │
└────────────────────────────────────────┴─────────────────┘
```

#### 6.2.2 完善深度定义

| 深度 | 修改范围 |
|------|---------|
| 基础完善 | 修正错别字、优化语句通顺度、统一标点 |
| 详细完善 | 基础 + 深化描写、强化情绪、优化节奏、引入伏笔 |

#### 6.2.3 风格模板Prompt注入

每个风格模板对应一段Prompt注入：

```
【战斗场景加强】
强化战斗动作描写，增加感官细节（视觉、听觉、触觉），
突出战斗的紧张感和冲击力，合理运用打击感词汇。

【情感催化】
深化人物内心活动描写，增加情感层次，
通过细节动作和神态传递情绪，营造共鸣感。

【悬念加强】
在关键节点设置悬念钩子，控制信息披露节奏，
增加伏笔和暗示，提升读者好奇心。

【世界观展开】
自然融入世界设定元素（地理、文化、规则），
通过角色互动展现世界观，避免生硬说明。

【角色深化】
突出角色个性特征，通过对话和行为展现性格，
增加角色内心冲突和成长弧光。

【爽点强化】
强化成就感、反转、打脸等爽文元素，
控制爽点释放节奏，铺垫充分。

【矛盾激化】
增加冲突张力，升级矛盾冲突，
通过外部压力和内部挣扎推动剧情。
```

### 6.3 模块三：Token用量可视化

#### 6.3.1 数据流

```
PromptBuilder.build()
    │
    ├─→ 使用tiktoken计算system prompt tokens
    ├─→ 计算context tokens（世界观 + 角色 + 大纲 + 记忆）
    ├─→ 计算user input tokens
    ├─→ 计算预估output tokens
    │
    └─→ 返回：{
        totalContextTokens: 5016,
        modelMaxTokens: 256000,
        usagePercent: 2,
        breakdown: {
          worldContext: 1200,
          characterContext: 800,
          outlineContext: 600,
          memoryContext: 1500,
          userInput: 916
        }
      }
```

#### 6.3.2 UI设计

```
┌─────────────────────────────────────────────────┐
│ Token: 5,016 / 256,000 (2%)  [========          ]│
│ 模型: Claude-4  │  资源: 充足 ✓                  │
│ 明细: 世界观1,200 + 角色800 + 大纲600 + 记忆1,500 │
└─────────────────────────────────────────────────┘
```

### 6.4 模块四：实体高亮系统

#### 6.4.1 技术实现

```typescript
// EntityHighlighter 服务
class EntityHighlighter {
  private entityPatterns: Map<EntityType, RegExp>;
  
  constructor(worldEngine: WorldEngine) {
    // 从世界引擎获取所有实体名称，构建正则
    this.buildPatterns(worldEngine.getAllEntities());
  }
  
  buildPatterns(entities: Entity[]) {
    for (const entity of entities) {
      const pattern = new RegExp(
        `(?<!\\w)${escapeRegExp(entity.name)}(?!\\w)`,
        'g'
      );
      this.entityPatterns.set(entity.type, pattern);
    }
  }
  
  highlight(text: string): Decoration[] {
    const decorations: Decoration[] = [];
    for (const [type, pattern] of this.entityPatterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        decorations.push({
          start: match.index!,
          end: match.index! + match[0].length,
          type,
          color: ENTITY_COLORS[type],
          entityId: this.getEntityId(match[0])
        });
      }
    }
    return decorations;
  }
}
```

#### 6.4.2 颜色方案

| 实体类型 | 颜色 | 示例 |
|---------|------|------|
| 角色 | #FF6B6B（红） | 林渊 |
| 物品 | #4ECDC4（青） | 玄天剑 |
| 地点 | #95E1D3（绿） | 青云宗 |
| 功法 | #F38181（粉） | 玄天剑法 |
| 势力 | #AA96DA（紫） | 魔教 |
| 货币 | #FCBAD3（浅粉） | 灵石 |

### 6.5 模块五：伏笔管理系统

#### 6.5.1 数据模型

```typescript
// 新增表：foreshadowings
const foreshadowings = sqliteTable('foreshadowings', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  type: text('type', { enum: ['commercial', 'item', 'clue', 'character', 'plot'] }).notNull(),
  importance: text('importance', { enum: ['low', 'medium', 'high', 'critical'] }).notNull(),
  status: text('status', { enum: ['planned', 'planted', 'pending', 'resolved'] }).notNull().default('planned'),
  plantChapterIds: text('plant_chapter_ids'), // JSON array
  resolveChapterIds: text('resolve_chapter_ids'), // JSON array
  relatedEntityIds: text('related_entity_ids'), // JSON array
  customRules: text('custom_rules'), // JSON array
  aiGenerated: integer('ai_generated', { mode: 'boolean' }).default(false),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
});

// 新增表：chapter_foreshadowing_links
const chapterForeshadowingLinks = sqliteTable('chapter_foreshadowing_links', {
  id: text('id').primaryKey(),
  chapterId: text('chapter_id').notNull(),
  foreshadowingId: text('foreshadowing_id').notNull(),
  linkType: text('link_type', { enum: ['plant', 'reference', 'resolve'] }).notNull(),
  createdAt: text('created_at').notNull()
});
```

#### 6.5.2 AI生成伏笔流程

```
作者输入："设计一个关于主角身世的伏笔"
    │
    ▼
收集上下文：
    ├─→ 当前世界观设定
    ├─→ 主角角色卡
    ├─→ 已埋设伏笔列表（避免重复）
    └─→ 目标章节范围
    │
    ▼
LLM生成：
    ├─→ 伏笔标题
    ├─→ 伏笔描述
    ├─→ 建议类型
    ├─→ 建议重要度
    ├─→ 建议埋设章节
    └─→ 建议回收章节
    │
    ▼
生成Proposal → 作者裁决
    │
    ▼
作者接受 → 创建伏笔记录 + 自动关联章节
```

### 6.6 模块六：规则管理系统

#### 6.6.1 数据模型

```typescript
// 新增表：rules
const rules = sqliteTable('rules', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  title: text('title').notNull(),
  content: text('content').notNull(), // Prompt内容
  scenarios: text('scenarios').notNull(), // JSON array of scenario IDs
  priority: integer('priority').default(100), // 规则优先级，数字越小越优先
  isEnabled: integer('is_enabled', { mode: 'boolean' }).default(true),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
});

// 应用场景枚举
const RuleScenario = {
  AI_DIALOGUE: 'ai_dialogue',
  GENERATE_CHAPTER: 'generate_chapter',
  GENERATE_CONTENT: 'generate_content',
  GENERATE_OUTLINE: 'generate_outline',
  ENHANCE_CHARACTER: 'enhance_character',
  CONTINUE_WRITING: 'continue_writing',
  POLISH: 'polish',
  DEAI_WRITING: 'deai_writing',
  FORESHADOWING: 'foreshadowing',
  GENERATE_WORLD: 'generate_world',
  PLOT_BUILDING: 'plot_building',
  CHAPTER_ANALYSIS: 'chapter_analysis'
} as const;
```

#### 6.6.2 Prompt注入流程

```
PromptBuilder.build(scenario: RuleScenario)
    │
    ├─→ 查询rules表：
    │       SELECT * FROM rules 
    │       WHERE projectId = ? 
    │         AND isEnabled = true 
    │         AND scenarios LIKE '%${scenario}%'
    │       ORDER BY priority ASC
    │
    ├─→ 将规则内容按优先级注入system prompt
    │       "【自定义规则】\n"
    │       + rules.map(r => r.content).join('\n\n')
    │
    └─→ 返回完整Prompt
```

### 6.7 模块七：已经历事件线

#### 6.7.1 自动提取Prompt

```
你是一位专业的编辑助手。请从以下小说章节中提取关键信息，按指定格式输出。

章节内容：
{chapter_content}

当前角色状态（提取前）：
{character_states}

已埋设伏笔：
{active_foreshadowings}

请提取以下内容：
1. 已经历事件线（本章发生的重大事件，50字以内）
2. 变化记录：
   - 心理变化：主角/重要角色的心理变化
   - 能力变化：境界提升、能力觉醒等
   - 状态变化：伤势、契约、烙印等
3. 重要人物摘要（本章出现的重要人物及其关键行为）
4. 重要物品/功法/地点出现记录
5. 是否呼应了已埋设伏笔？如果是，指出伏笔ID

输出JSON格式。
```

#### 6.7.2 数据结构

```typescript
interface ExperiencedEvent {
  id: string;
  chapterId: string;
  chapterTitle: string;
  eventSummary: string; // 50字以内
  changes: {
    psychological: string[];
    ability: string[];
    status: string[];
  };
  importantCharacters: {
    characterId: string;
    characterName: string;
    action: string;
  }[];
  importantItems: string[];
  importantLocations: string[];
  resolvedForeshadowingIds: string[];
  createdAt: string;
}
```

### 6.8 模块八：去AI味润色

#### 6.8.1 AI高频词库（初始）

```typescript
const AI_COMMON_PHRASES = [
  // 过渡词
  "首先", "其次", "再次", "最后", "总之", "综上所述",
  "然而", "但是", "不过", "可是", "虽然", "尽管",
  "值得注意的是", "值得一提的是", "令人惊讶的是",
  "不得不说", "毫无疑问", "毋庸置疑",
  
  // 空洞修饰
  "非常", "特别", "极其", "格外", "相当", "颇为",
  "深深地", "缓缓地", "轻轻地", "默默地",
  
  // 模式化表达
  "就在这时", "突然之间", "说时迟那时快",
  "只见", "但见", "但见那", "只见那",
  "没错", "是的", "确实",
  
  // 解释性插入
  "原来", "显然", "显然地", "显然的", "很明显",
  "说白了", "换句话说", "换言之",
  
  // 情感标签化
  "心中一凛", "心中一震", "心中一动",
  "瞳孔一缩", "眼皮一跳", "心头一紧",
  "不禁", "不由得", "忍不住",
  
  // 其他
  "似乎在", "仿佛在", "好像在",
  "某种程度", "某种程度上", "某种程度上来说",
];
```

#### 6.8.2 去AI味流程

```
输入：待润色文本
    │
    ├─→ 阶段1：高频词检测
    │       扫描文本，标记AI高频词出现位置和次数
    │       生成高频词报告
    │
    ├─→ 阶段2：LLM润色
    │       Prompt：
    │       "请润色以下文本，要求：
    │        1. 去除AI写作痕迹，让文字更自然
    │        2. 避免使用：然而、值得注意的是、首先/其次/最后等过渡词
    │        3. 减少'非常'、'特别'等空洞修饰词
    │        4. 避免'心中一凛'、'瞳孔一缩'等模式化表达
    │        5. 增加具体细节，减少抽象概括
    │        6. 保持原意和文风"
    │
    ├─→ 阶段3：规则替换
    │       应用用户自定义去AI味规则
    │
    └─→ 输出：润色后文本 + 修改报告（改了什么、为什么）
```

### 6.9 模块九：语音校对（TTS）

#### 6.9.1 技术方案

```typescript
class TTSService {
  private synth: SpeechSynthesis;
  private utterance: SpeechSynthesisUtterance | null = null;
  
  constructor() {
    this.synth = window.speechSynthesis;
  }
  
  async speak(text: string, options: TTSOptions): Promise<void> {
    // 文本分段（避免过长）
    const segments = this.segmentText(text, 200);
    
    for (const segment of segments) {
      this.utterance = new SpeechSynthesisUtterance(segment);
      this.utterance.rate = options.speed || 1.0;
      this.utterance.pitch = options.pitch || 1.0;
      this.utterance.lang = 'zh-CN';
      
      // 选择中文语音
      const voices = this.synth.getVoices();
      const zhVoice = voices.find(v => v.lang.includes('zh'));
      if (zhVoice) this.utterance.voice = zhVoice;
      
      await this.speakSegment(this.utterance);
    }
  }
  
  private segmentText(text: string, maxLength: number): string[] {
    // 按句子分割，每段不超过maxLength
    const sentences = text.split(/([。！？.!?\n]+)/);
    const segments: string[] = [];
    let current = '';
    
    for (let i = 0; i < sentences.length; i += 2) {
      const sentence = sentences[i] + (sentences[i + 1] || '');
      if ((current + sentence).length > maxLength && current) {
        segments.push(current);
        current = sentence;
      } else {
        current += sentence;
      }
    }
    if (current) segments.push(current);
    return segments;
  }
}
```

#### 6.9.2 UI设计

```
┌─────────────────────────────────┐
│ 语音校对                         │
├─────────────────────────────────┤
│ 朗读范围：                        │
│ ○ 当前章节  ● 选中段落  ○ 全文   │
├─────────────────────────────────┤
│ 语速：[慢]=====[正常]=====[快]   │
├─────────────────────────────────┤
│ 当前朗读：第5章 第3段            │
│ "林渊捏着刚分到的八百块现金..."  │
│              [=========>    ]    │
├─────────────────────────────────┤
│ [暂停]  [停止]  [下一段]         │
└─────────────────────────────────┘
```

### 6.10 模块十：多模型支持与切换

#### 6.10.1 模型配置

```typescript
interface ModelConfig {
  id: string;
  name: string;
  provider: 'openai' | 'anthropic' | 'deepseek' | 'seed' | 'local';
  modelId: string; // API model identifier
  maxTokens: number;
  temperature: number;
  capabilities: ModelCapability[];
  isDefault: boolean;
  isEnabled: boolean;
  apiKey?: string; // 加密存储
  baseUrl?: string;
}

interface ModelCapability {
  type: 'outline' | 'content' | 'polish' | 'continue' | 'logic' | 'memory' | 'chat';
  score: number; // 1-10，该模型在此任务上的评分
}
```

#### 6.10.2 模型选择策略

```typescript
class ModelRouter {
  selectModel(task: TaskType, preference?: string): ModelConfig {
    const candidates = this.getEnabledModels();
    
    // 1. 用户指定优先
    if (preference) {
      const preferred = candidates.find(m => m.id === preference);
      if (preferred) return preferred;
    }
    
    // 2. 按任务类型匹配能力评分
    const scored = candidates.map(m => ({
      model: m,
      score: m.capabilities.find(c => c.type === task)?.score || 5
    }));
    
    // 3. 选择评分最高的
    scored.sort((a, b) => b.score - a.score);
    return scored[0].model;
  }
  
  async invokeWithFallback(
    task: TaskType,
    prompt: string,
    options?: { preferredModel?: string; timeout?: number }
  ): Promise<string> {
    const primary = this.selectModel(task, options?.preferredModel);
    
    try {
      return await this.callModel(primary, prompt, options?.timeout);
    } catch (error) {
      // 降级到下一个最佳模型
      const fallback = this.selectModel(task, undefined, { exclude: [primary.id] });
      return await this.callModel(fallback, prompt);
    }
  }
}
```

---

## 七、实施路线图

### Phase 1：核心体验（2-3个月）

**目标**：让NarrativeOS达到竞品A的基础体验水平

| 周次 | 任务 | 负责人 | 产出 |
|------|------|--------|------|
| W1-2 | 编辑器AI助手面板 | 前端+Agent | 续写/润色/对话/发展/修正/展开 |
| W2-3 | Token用量可视化 | 后端+前端 | PromptBuilder集成tiktoken |
| W3-4 | 实体高亮系统 | 前端 | Monaco/TipTap Decoration系统 |
| W4-5 | AI完善面板 | 前端+StudioAgent | 完善/对比/风格模板 |
| W5-6 | 情绪节奏控制 | 前端+数据层 | Chapter新增emotion_points |
| W6-8 | 多模型支持 | 后端 | ModelRouter + 配置面板 |

### Phase 2：专业功能（2-3个月）

**目标**：在专业功能上超越竞品A

| 周次 | 任务 | 产出 |
|------|------|------|
| W9-10 | 伏笔管理系统 | 完整CRUD + AI生成/完善 |
| W10-12 | 规则管理系统 | 规则CRUD + Prompt注入 |
| W11-13 | 已经历事件线 | 自动提取 + 记忆库 |
| W12-14 | 去AI味润色 | 高频词库 + LLM润色 |
| W13-15 | 人物关系图 | D3.js可视化 |

### Phase 3：增强体验（1-2个月）

| 周次 | 任务 | 产出 |
|------|------|------|
| W16-17 | 地图可视化 | 地点标注 + 势力范围 |
| W17-18 | 语音校对 | TTS朗读 + 高亮同步 |
| W18-19 | 便签批注 | 行内评论系统 |
| W19-20 | 情节脉络模板 | 五幕式/三幕式/英雄之旅 |

### Phase 4：双引擎联动优化（1-2个月）

| 周次 | 任务 | 产出 |
|------|------|------|
| W21-22 | 创作引擎 ↔ 规则引擎深度联动 | 按场景自动绑定规则 |
| W22-23 | 创作引擎 ↔ 记忆引擎深度联动 | 智能上下文裁剪 |
| W23-24 | 世界引擎 ↔ 实体高亮联动 | 实时同步 |
| W24-25 | 性能优化 + 压力测试 | 百章级项目流畅运行 |

---

## 八、风险与建议

### 8.1 技术风险

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| Token成本过高 | 长项目上下文占用过大 | 智能上下文裁剪 + 分层摘要 |
| 编辑器性能 | 实体高亮在十万字文档上卡顿 | 虚拟滚动 + 增量渲染 |
| LLM响应延迟 | 作者体验差 | SSE流式 + 降级策略 |
| 数据一致性 | 多引擎联动出现状态不一致 | 事务 + 最终一致性 |

### 8.2 产品风险

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 功能过载 | 界面复杂度过高 | 渐进式披露 + 新手引导 |
| AI幻觉 | 生成内容与设定矛盾 | 谏官系统 + 作者裁决 |
| 作者依赖AI | 失去创作主动权 | MOU协议确保作者始终把关 |

### 8.3 关键建议

1. **保持架构优势**：不要为了功能而牺牲架构，所有新功能必须走TDD
2. **渐进式发布**：不要等全部做完再发布，Phase 1完成即可发版
3. **作者体验优先**：每个功能都要问自己"作者每天会用几次"
4. **MOU原则不变**：即使AI助手面板的功能，也要走提案-裁决流程
5. **Token意识**：让每个作者都意识到Token消耗，培养节约习惯
6. **规则驱动**：尽早建立规则系统，让作者可以自定义AI行为

---

## 附录

### A. 竞品A的AI功能完整列表

从视频帧提取的所有AI功能：
- AI生成世界观设定
- AI生成角色设定
- AI生成金手指
- AI生成大纲（大纲模式/细纲模式）
- AI生成章节正文（批量/单章）
- AI完善大纲
- AI完善章节（单节点/批量）
- AI续写
- AI文字润色
- AI对话优化
- AI剧情发展
- AI逻辑修正
- AI文段展开
- AI去AI味润色
- AI生成角色
- AI完善角色
- AI生成伏笔
- AI完善伏笔
- AI完善世界观
- AI情节构建
- AI章节分析
- AI对话（通用）

### B. 需要新增的数据表

```sql
-- 伏笔表
CREATE TABLE foreshadowings (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('commercial','item','clue','character','plot')),
  importance TEXT NOT NULL CHECK(importance IN ('low','medium','high','critical')),
  status TEXT NOT NULL DEFAULT 'planned' CHECK(status IN ('planned','planted','pending','resolved')),
  plant_chapter_ids TEXT, -- JSON
  resolve_chapter_ids TEXT, -- JSON
  related_entity_ids TEXT, -- JSON
  custom_rules TEXT, -- JSON
  ai_generated INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 章节-伏笔关联表
CREATE TABLE chapter_foreshadowing_links (
  id TEXT PRIMARY KEY,
  chapter_id TEXT NOT NULL,
  foreshadowing_id TEXT NOT NULL,
  link_type TEXT NOT NULL CHECK(link_type IN ('plant','reference','resolve')),
  created_at TEXT NOT NULL
);

-- 规则表
CREATE TABLE rules (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  scenarios TEXT NOT NULL, -- JSON array
  priority INTEGER DEFAULT 100,
  is_enabled INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 已经历事件表
CREATE TABLE experienced_events (
  id TEXT PRIMARY KEY,
  chapter_id TEXT NOT NULL,
  chapter_title TEXT NOT NULL,
  event_summary TEXT NOT NULL,
  changes TEXT NOT NULL, -- JSON
  important_characters TEXT NOT NULL, -- JSON
  important_items TEXT NOT NULL, -- JSON
  important_locations TEXT NOT NULL, -- JSON
  resolved_foreshadowing_ids TEXT, -- JSON
  created_at TEXT NOT NULL
);

-- 情绪控制点表
CREATE TABLE emotion_points (
  id TEXT PRIMARY KEY,
  chapter_id TEXT NOT NULL,
  emotion_type TEXT NOT NULL CHECK(emotion_type IN ('tension','joy','sadness','anger','anticipation','horror','warmth','satisfaction')),
  intensity INTEGER NOT NULL CHECK(intensity BETWEEN 0 AND 10),
  position INTEGER NOT NULL, -- 段落位置
  created_at TEXT NOT NULL
);

-- 模型配置表
CREATE TABLE model_configs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  provider TEXT NOT NULL,
  model_id TEXT NOT NULL,
  max_tokens INTEGER NOT NULL,
  temperature REAL NOT NULL,
  capabilities TEXT NOT NULL, -- JSON
  is_default INTEGER DEFAULT 0,
  is_enabled INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### C. Prompt模板汇总

```
【系统级Prompt模板】

1. 大纲生成Prompt
"你是一位专业网络小说大纲设计师。
世界观设定：{world_context}
角色设定：{character_context}
情节脉络：{plot_structure}
目标：生成第{volume}卷大纲，共{chapter_count}章，总字数{total_words}。
模式：{mode}（大纲模式=粗纲，细纲模式=详细情节）
叙事节奏：{pace}
内容侧重：{content_focus}
自定义要求：{custom_requirements}

要求：
- 每章包含：标题、核心事件、情绪走向、字数分配
- 严格遵循情节脉络结构
- 埋设伏笔预留空间
- 确保角色行为符合人设"

2. 正文生成Prompt
"你是一位专业网络小说作家。
前文摘要：{previous_chapters_summary}
当前章节大纲：{chapter_outline}
出场角色：{character_cards}
已埋设伏笔（需呼应）：{active_foreshadowings}
世界设定（相关部分）：{relevant_world_context}
情绪控制点：{emotion_points}
写作风格：{writing_style}
内容侧重：{content_focus}
节奏控制：{pace}
自定义规则：{custom_rules}

要求：
- 生成第{chapter_number}章正文，目标字数{target_words}
- 开头承接上文，结尾留有悬念或过渡
- 自然融入世界观设定，不生硬说明
- 对话符合角色性格
- 描写有画面感，避免空洞修饰"

3. 记忆提取Prompt（见6.7.1）
4. 去AI味Prompt（见6.8.2）
5. 伏笔生成Prompt（见6.5.2）
```

---

> 文档前半段结束。但以上分析存在与 NarrativeOS 当前真实状态偏差的地方（数据层、引擎名称、路由结构均与 2026-05-21 的代码基线不一致）。**下面九、十、十一、十二、十三、十四 六章是 2026-05-21 在阅读了完整代码库后做的"校准 + 深化"**，是最终结论部分，请以这里为准。

---

## 九、现状校准：2026-05-21 真实代码基线

前述章节里把"Agent 层 5 Agent / SQLite / 三栏驾驶舱"等内容写成了 NarrativeOS 的现状，**这与代码库的真实情况不符**。这里逐条更正，作为后续设计的真理源。

### 9.1 引擎层真实结构（不是 4 个 Agent，而是 4 个工程化引擎包 + 1 个编排包）

| 包 | 路径 | 真实定位 |
|----|----|----|
| **studio-engine** | `packages/studio-engine` | **目前最厚**：五层 Prompt 装配 → Brief 生成 → 正文生成 → 谏官打分 → 修订；25+ API；含 DramaContextLoader 已注入 Drama 数据 |
| **world-engine** | `packages/world-engine` | **最分散**：14 个子领域（combat / rules / causality / foreshadowing / knowledge / geography / faction / character / timeline / impact / retcon / simulation 等），70+ API，含 archivist（章节抽取）+ world-simulator（落库 + 提案）|
| **drama-engine** | `packages/drama-engine` | 冲突 / 张力曲线 / 节拍模型；3 套节拍方案（save_the_cat / three_act / genre_template）；`commitConflictAdvance` 只落库不传播 |
| **mou-orchestrator** | `packages/mou-orchestrator` | **薄编排层（章程要求 <5%）**：XState v5 主状态机 + 3 台子机（studio/world/oracle）+ FlowGuardian + sovereignty-guard |
| **llm** | `packages/llm` | 已具备 4 个 Provider（DeepSeek / OpenAI / Anthropic / Mock）+ Cache + CostTracker + Router |

**关键事实**：mou-orchestrator 的 `EngineCaller` 接口（`mou-machine.ts:127-130`）**只持有 `{worldShell, studioShell}`，dramaEngine 没有作为同级公民出现**，drama 数据是 Studio 在 Prompt 装配阶段透传的——**这是当前架构的最大缺口**，详见第十一章重新设计。

### 9.2 数据层真实情况（不是 SQLite，是 PostgreSQL + pgvector）

| 层 | 实际 | 文档前半段误写 |
|----|----|----|
| 数据库 | **PostgreSQL 16 + pgvector**（Docker） | "SQLite" |
| ORM | Drizzle ORM | ✓（一致）|
| 队列 | Redis 7.2 + BullMQ | 未提 |
| 对象存储 | MinIO | 未提 |
| 表数量 | **39 张表，按 10 个域分文件**（`packages/database/src/schema/{core,world,narrative,behavior,knowledge,system,studio,counsel,drama,frontend-support}.ts`）| "Project/Entity/Chapter/Relationship 4 个 Repository" 过度简化 |
| 向量化 | `embeddings.embedding vector(1536)`，11 种 source_type | 未提 |

### 9.3 已经存在但没人用的"死资产"（升级的低成本切入点）

这几项是"已建表、已写代码、但前端/业务都没接入"，**只要补一个写入管线或一个 UI 就能上线**：

| 死资产 | 路径 | 状态 | 升级成本 |
|----|----|----|----|
| **`styleSnapshots` 风格指纹表** | `packages/database/src/schema/studio.ts:103` | 表建好了，无业务写入也无读取 | ★ |
| **`embeddings` 向量表 + `vector-search-routes.ts` 查询端** | `apps/server/src/api/vector-search-routes.ts` | 查询路由存在；**无自动嵌入写入管线**，archivist 不写 embedding | ★★ |
| **`narrative-advisor.ts` 世界顾问输出** | `packages/world-engine/src/simulation/narrative-advisor.ts` | 有单测；**没有任何前端页面消费它的建议** | ★ |
| **`devagent_01-05` 五份设计文档** | `NarrativeOS_v3_Sovereign_全部文档包/devagent_*.md` | 已被 CLAUDE.md 第 65 行宣告"由 Claude Code 担任"，但遥测/路由/进化能力空白 | ★★★ |

### 9.4 已经存在并跑得很好的"被忽视的强项"

竞品 A 完全没有的能力，NarrativeOS **代码里已经有**，前半段没强调够：

1. **`sovereignty-guard.ts` 主权宪法守门代码已落地**（`packages/mou-orchestrator/src/sovereignty-guard.ts:47-228`）—— 7 个守门断言、11 类 AUTHOR_APPROVE 事件、6 条写路径已注入 proposal-guard 中间件。竞品 A 没有"作者裁决"机制。
2. **`proposals` 表 + ProposalsPage + ProposalDetailPage + SealVerdict.tsx**（钤印 UI）—— 完整的"提案-准/驳/议"链路已上线。
3. **冲突 / 张力曲线 / 节拍**（`drama-engine`）—— 竞品 A 完全没有"叙事节拍学"概念，它的"情绪控制台"是手填的标签，NarrativeOS 是算法生成的节拍轨。
4. **`archivist + world-simulator + ripple-propagator` 世界模拟闭环**（P11.11' 已完成）—— 章节固化后自动抽取实体变更 + 涟漪传播 + 风险提案。竞品 A 完全没有这种闭环。
5. **39 张表 + 10 个域 schema** —— 竞品 A 的世界设定全是 JSON 文本字段，NarrativeOS 是结构化关系数据。

### 9.5 前端真实路由（37 页面，不是"三栏驾驶舱"）

`apps/web/src/App.tsx:39-95` 共 **37 个页面**，分四个堂口：

- **入口 + 项目门厅（5）**：Universe / NewProject / Courtyard / Cockpit / Dashboard / GenreKernel
- **谏官堂（Studio 引擎）`/oracle/:projectId/*`（9）**：OracleDesk / ChapterReader / BriefWorkshop / QualityDashboard / Risks / TensionDashboard / PossibilitiesWorkshop / RetconWorkflow / Outline
- **星图阁（World 引擎）`/world/:projectId/*`（13）**：WorldMap / WorldDashboard / Entities / EntityDetail / Events / EventDetail / Foreshadowings / Timeline / OracleQuery / Storylines / RelationshipNetwork / WorldRules / WorldBible / AbilityManager
- **钦天台 + 提案 + 全局（6）**：Observatory / Proposals / ProposalDetail / Mou / Search / KeysHelp / Settings

**结构性缺口**：CockpitPage 只是 17 个 QuickLink 的导航 hub，**没有任何页面把谏官堂 + 星图阁 + drama 同屏显示**。作者要在两棵树之间反复跳。

### 9.6 视觉系统：司天监位面已落地

`apps/web/tailwind.config.js` + `index.css` 已实装深靛 `#0c1226` / 朱砂 `#c8412c` / 紫金 `#c9a55c` / 牙白 `#ece5d2` 令牌 + 宋体 + 星图与噪点 SVG 背景层；布局组件 `apps/web/src/layout/` 含 ImperialShell / TopBar / BottomBar / Copilot / CommandPalette；钤印组件 `SealVerdict.tsx` 已上线。**前半段没提到这是 NarrativeOS 的视觉护城河**——竞品 A 是通用的"AI 工具深色主题"，没有任何文化身份。

---

## 十、双引擎/多引擎能力深度重新定义（核心章节）

### 10.1 "双引擎"在 NarrativeOS 语境下的正确定义

前半段把"双引擎"解释为"创作引擎 + 规则引擎"，**这是错的**。NarrativeOS 的真正多引擎是：

> **Drama / Studio / World 三引擎对等公民 + MOU 编排 + LLM 网关 + 守门宪法**

其中"双引擎联动"特指竞品 A 拼命补的两件事：

- **左脑（World）**：世界一致性、长程记忆、实体状态、伏笔追踪、关系图
- **右脑（Studio）**：当下章节的 Brief 装配、正文生成、修订、风格

Drama 是**贯穿两脑的脊柱**（章节级冲突推进、张力曲线节拍）。

**竞品 A 的"双引擎"实际等价于"Studio + 一个被压成 JSON 文本字段的 World"。NarrativeOS 的优势是 World 是结构化关系数据 + 14 个子领域算法。**所以"双引擎联动"在 NarrativeOS 必须达到的目标，比竞品 A 高一个数量级：**不只是 World 把数据塞给 Studio，而是 World 能反过来对 Studio 的输出做语义级一致性裁决**。

### 10.2 三引擎联动协议（提议落入代码的契约）

#### 10.2.1 当前联动现状（单向、单点）

```
[作者] → [POST /api/projects/:id/action]
         → MOU mouMachine
            → studioShell.generateBrief()
                  ↓ 调 dramaContextLoader 读 drama 数据
                  ↓ 调 worldRepository 读实体/伏笔
            ← Brief
         → 作者裁决
            → studioShell.generateContent()
                  ↓ 同上读取
            ← 正文
         → 作者裁决
            → 章节固化
                  ↓ archivist 抽取
                  ↓ world-simulator 落库 + 生成警报提案
```

**问题**：
1. Drama 没有作为 EngineCaller 公民，drama 数据是 Studio 透传——**Drama 引擎完全无法对 Studio 输出说"不"**。
2. World 的 simulator 只在 commit 后跑，**生成阶段 World 完全沉默**——只是被读取的字典。
3. 三引擎间没有事件总线，只有 DB + 共享 schema。
4. 风格指纹表 `styleSnapshots` 没人写也没人读，**Studio 的"风格"完全靠 AMA profile 的静态 JSON**。

#### 10.2.2 重新设计：三引擎对等 + 三阶段协议

每次"生成章节正文"都走 **5 个阶段、3 引擎对等参与、所有节点经 sovereignty-guard**：

```
┌──────────────────────────────────────────────────────────────┐
│           阶段 0 · Compose（编排层装配上下文）                  │
│  MOU.compose:                                                 │
│    parallel:                                                  │
│      - World.queryNarrativeContext(chapterId)                 │
│          → 返回 entities[] / activeForeshadowings[] /         │
│             pendingRipples[] / relationshipDeltas[]           │
│      - Drama.queryDramaContext(chapterId)                     │
│          → 返回 activeConflicts[] / tensionCurvePoint /       │
│             beatPlan / expectedClimaxAt                       │
│      - Studio.queryStyleContext(projectId, chapterId)         │
│          → 返回 amaProfile / nearestStyleSnapshot /           │
│             recentChapterEndings[]                            │
│    merge → NarrativeContext（统一容器）                        │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│           阶段 1 · Brief（Studio 主导，三引擎旁观）              │
│  Studio.generateBrief(NarrativeContext)                       │
│    → BriefDraft（章节蓝图：开场/冲突/转折/结尾/伏笔触点）        │
│  Drama.assertBeatAlignment(BriefDraft)                        │
│    → ok / warn { 偏离预定节拍模型 }                            │
│  World.assertContinuity(BriefDraft)                           │
│    → ok / risks[]（角色境界倒退/伏笔时空错位/物品丢失等）      │
│  → Proposal(brief.draft) → 作者裁决                            │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│           阶段 2 · Content（Studio 流式生成）                   │
│  Studio.generateContent(approvedBrief)                        │
│    SSE 流式输出                                                │
│  实时旁路（每 N 段触发一次）：                                  │
│    - Drama.streamTensionGauge(partialContent)                 │
│       → 给前端推 tension 实时刻度，作者可见                     │
│    - World.streamEntityRecognition(partialContent)            │
│       → 给编辑器推实体高亮 + 未注册实体告警                     │
│  → ContentDraft                                               │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│           阶段 3 · Score（三引擎并行评分，谏官 LLM 加权）         │
│  parallel:                                                    │
│    - Studio.scoreLanguage(ContentDraft)        → 语言分        │
│    - Drama.scoreBeatCompliance(ContentDraft)   → 节奏分        │
│    - World.scoreContinuity(ContentDraft)       → 一致性分      │
│    - LLMCensor.scoreSemantic(ContentDraft)     → 语义分        │
│  → CompositeScore + 各引擎修订建议[]                            │
│  → Proposal(score + suggestions) → 作者裁决                    │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│           阶段 4 · Commit（落库 + 三引擎反向更新）               │
│  作者 APPROVE_FINAL                                            │
│    → World.archivist.extract(ContentFinal) →                   │
│       worldSimulator.apply() → relationshipDeltas /            │
│       entityStateChanges / foreshadowingResolutions            │
│    → Drama.commitConflictAdvance + commitBeats +               │
│       writeTensionPoint                                        │
│    → Studio.writeStyleSnapshot(ContentFinal) →                 │
│       让 styleSnapshots 表活起来！                              │
│    → 触发 embedding 异步管线：                                  │
│       chapter_content / chapter_summary 写入 pgvector          │
└──────────────────────────────────────────────────────────────┘
```

**这套协议的关键创新点**：

1. **Drama 升格为 EngineCaller 公民**：`EngineCaller = { worldShell, studioShell, dramaShell }`，三家都能被 MOU 调用、都能输出 Proposal、都能被 sovereignty-guard 守门。
2. **World 从"被读字典"升级为"实时裁决者"**：阶段 1 / 3 的 `assertContinuity` 与 `scoreContinuity` 让 World 能对 Studio 输出说"不"。
3. **Drama 从"prompt 透传内容"升级为"独立旁观流"**：阶段 2 的 `streamTensionGauge` 让作者实时看到张力曲线在动。
4. **styleSnapshots 表激活**：阶段 4 的 `writeStyleSnapshot` 把每次定稿章节的语言特征采样存档，下次 Brief 生成时通过 `queryStyleContext` 拉出"最近 3 章的风格特征向量"反向钳制 Studio。
5. **embeddings 写入管线补齐**：commit 后异步 chunk + embed + upsert，RAG 才能真用起来。

#### 10.2.3 类型契约（落到 `packages/shared-types`）

```typescript
// 新增：packages/shared-types/src/engine-protocol.ts

export interface NarrativeContext {
  chapterId: string;
  projectId: string;
  world: {
    entities: EntitySnapshot[];
    activeForeshadowings: ForeshadowingRef[];
    pendingRipples: RippleRef[];
    relationshipDeltas: RelationshipDelta[];
    relevantLocations: LocationRef[];
    timelineWindow: TimelineWindow;
  };
  drama: {
    activeConflicts: ConflictRef[];
    tensionCurvePoint: TensionPoint;
    beatPlan: BeatPlan;
    expectedClimaxAt: number; // 段落位置
    beatModel: 'save_the_cat' | 'three_act' | 'genre_template';
  };
  studio: {
    amaProfile: AMAProfile;
    nearestStyleSnapshot: StyleSnapshot | null;
    recentChapterEndings: string[];
    chapterTargetWords: number;
    writingStyle: WritingStylePreset;
    contentFocus: ContentFocusFlags;
  };
  rules: AppliedRule[];          // 来自 rule 管理系统的注入
  emotionPoints: EmotionPoint[]; // 章节情绪控制点
}

export interface EngineAssertion {
  engine: 'drama' | 'world' | 'studio';
  level: 'info' | 'warn' | 'risk' | 'block';
  code: string;        // e.g. CONTINUITY.CHARACTER_REALM_REGRESS
  message: string;
  fixHint?: string;
  affectedSpan?: { start: number; end: number };
}

export interface EngineScore {
  engine: 'drama' | 'world' | 'studio' | 'censor';
  dimension: string;   // e.g. beat_compliance / language_quality
  score: number;       // 0..100
  details: { rubric: string; score: number }[];
  suggestions: RevisionSuggestion[];
}

export interface NarrativeBus {
  /** 注入到 MOU EngineCaller 的总线，三引擎都 publish/subscribe 同一份 */
  emit<E extends keyof NarrativeBusEvents>(type: E, payload: NarrativeBusEvents[E]): void;
  on<E extends keyof NarrativeBusEvents>(type: E, fn: (p: NarrativeBusEvents[E]) => void): void;
}

export interface NarrativeBusEvents {
  'compose.requested':         { chapterId: string };
  'compose.completed':         { context: NarrativeContext };
  'brief.drafted':             { brief: BriefDraft };
  'brief.asserted':            { assertions: EngineAssertion[] };
  'content.streaming':         { delta: string; offset: number };
  'content.tension.update':    { tension: number; offset: number };
  'content.entity.detected':   { entityId: string; offset: number; isRegistered: boolean };
  'content.completed':         { content: ContentDraft };
  'score.completed':           { scores: EngineScore[]; suggestions: RevisionSuggestion[] };
  'commit.persisted':          { chapterVersionId: string; deltas: WorldDelta[] };
  'commit.style.snapshotted':  { styleSnapshotId: string };
  'commit.embeddings.queued':  { jobId: string; chunkCount: number };
}
```

### 10.3 引擎间通信：从"直接 import"升级为"NarrativeBus"

当前现状是 server 端直接 new 各个引擎类、互相 import，**没有事件总线**。升级方案：

```
┌────────────────────────────────────────────┐
│      NarrativeBus（进程内 EventEmitter）     │
│  + 可选 Redis pub/sub 旁路（用于 WS 广播）   │
└────────────────────────────────────────────┘
          ↑          ↑          ↑
     StudioShell  DramaShell  WorldShell
          ↑          ↑          ↑
        MouMachine（EngineCaller 注入 bus）
```

- 进程内通信走 EventEmitter（零延迟）。
- 需要推送到前端的事件（content.tension.update / content.entity.detected）通过 Redis pub/sub 旁路到 socket.io 广播。
- 所有事件都打到 `auditLogs` 表，作为 DevAgent 接班的数据源（见 14.4）。

---

## 十一、Studio 引擎专项强化（对齐竞品 A 的"日常体验密度"）

竞品 A 把作者每天会用 100 次的小功能做得极致——这正是 NarrativeOS 工程化优势之外**最大的体验短板**。

### 11.1 Studio 必补 8 件套（按 ROI 排序）

| # | 功能 | 落地点 | 落地动作 |
|---|------|------|------|
| 1 | **AI 助手面板**（续写/润色/对话/发展/修正/展开 6 件） | `apps/web/src/components/CopilotPanel.tsx` 已有壳，6 个 action 缺实现 | 新增 `studio-engine/src/copilot/{continue,polish,dialogue,advance,fix,expand}.ts`，全部走 MouMachine 的 sub-flow 产 Proposal |
| 2 | **章节完善面板**（深度/风格模板/智能引入伏笔/对比） | 当前 `BriefWorkshopPage` 是 brief 入口，缺"已写章节完善"入口 | 新增 `EnhanceChapterPage`，复用 brief-generator 但 mode=enhance |
| 3 | **去 AI 味润色** | 完全缺 | 新增 `studio-engine/src/dehumidify/{phrase-bank,scanner,rewriter}.ts`，配 `AI_COMMON_PHRASES` 词库（见 6.8.1）+ LLM rewrite + 规则替换 |
| 4 | **风格指纹活化** | `styleSnapshots` 表已建未用 | commit 时调 `studio-engine/src/style/{snapshotter,fingerprint-extractor}.ts`，Brief 时通过 `queryStyleContext` 反注入 |
| 5 | **规则管理系统**（用户自定义 Prompt 注入） | 完全缺 | 新增 `rules` 表 + `apps/web/src/pages/RulesPage.tsx` + `PromptBuilder` 按 scenario 拉取注入 |
| 6 | **Token 用量可视化** | 完全缺 | `packages/llm` 已有 `estimateTokenCount`，在 SSE 流前推 `token_info` 事件，CopilotPanel 顶部展示 |
| 7 | **写作风格 6 选 1 + 内容侧重 8 选 N + 节奏 3 选 1** | 完全缺 | 加到 Brief 表单（`BriefWorkshopPage`），存入 `briefs.preferences` JSONB；prompt builder 注入对应模板段 |
| 8 | **AI 助手对话框（通用提问 + 工具调用）** | 完全缺 | 复用 `CopilotPanel` 加 chat mode，挂 `studio-engine/src/assistant/chat.ts`，工具调用 NarrativeBus |

### 11.2 现有 StudioShell 的精修点

`packages/studio-engine/src/shell/studio-shell.ts:22-31` 当前每次 `loadContext` 都全量 `list*ByProject`——**项目大了一定卡**。改为：

```typescript
// 改前：
const [project, chapter, entities, foreshadowings, ...] = await Promise.all([
  list*ByProject(projectId)   // 全量
]);

// 改后：
const [project, chapter, entities, foreshadowings, ...] = await Promise.all([
  // 1. 走 World.queryNarrativeContext(chapterId) 拿"和本章相关的"
  // 2. 走 pgvector 语义检索"近 N 章里和当前 brief 相关的段落"
  // 3. 走 styleSnapshot.queryNearest(projectId, chapterIndex)
]);
```

把"全量加载"改为"语义相关加载 + 近邻风格"，这一步让 RAG 真正落地，也让长项目（500+ 章）可用。

---

## 十二、World 引擎专项强化（把"被读字典"升格为"活的世界"）

### 12.1 14 个子领域目前的健康度

| 子领域 | 文件 | 状态 |
|----|----|----|
| combat（战力/装备/突破/状态） | `combat/*` | 🟢 完整 |
| rules（境界/物理/能力） | `rules/*` | 🟢 完整 |
| causality（事件/链/涟漪/成本） | `causality/*` | 🟢 完整，含 LLM cost 评估 |
| foreshadowing（追踪/密度分析） | `foreshadowing/*` | 🟢 完整 |
| knowledge（信息图/传播） | `knowledge/*` | 🟡 接口好，UI 没接 |
| geography（地理/路径） | `geography/*` | 🟡 算法好，无可视化 |
| faction（势力/外交 tick） | `faction/*` | 🟡 算法好，UI 没接 |
| character（动机/关系状态机） | `character/*` | 🟡 单测有，未接 |
| timeline（时间线引擎） | `timeline/*` | 🟢 完整 |
| impact（影响域分析） | `impact/*` | 🟢 完整 |
| retcon（追溯协调器） | `retcon/*` | 🟢 完整，UI 已接 |
| simulation/archivist | `simulation/archivist.ts` | 🟢 完整，commit 后自动跑 |
| simulation/world-simulator | `simulation/world-simulator.ts` | 🟢 完整 |
| simulation/narrative-advisor | `simulation/narrative-advisor.ts` | 🔴 **有单测、无人消费** |

### 12.2 World 必补 5 件套

1. **NarrativeAdvisor 接入 UI**：在 `CockpitPage` 加 "世界顾问建议" 卡，展示 advisor 实时输出的剧情走向建议。
2. **knowledge/info-graph 接入实体高亮**：编辑器实体高亮 hover 卡，调用 info-graph 取"该实体当前作者已透露的信息 vs 隐藏信息"，标信息差。
3. **geography 接入地图可视化**：D3 / Leaflet 渲染地理引擎的 path-finding 路径与势力范围。
4. **faction 接入势力关系图**：Cytoscape 渲染 faction-engine 的 diplomacy tick。
5. **embeddings 写入管线**：commit 后异步 chunk 章节正文 + summary，写入 `embeddings` 表（11 种 source_type 中的 `chapter_content` / `chapter_summary`）。

---

## 十三、决策矩阵：在原架构升级 vs 推倒重来

用户原话："我甚至不惜一切代价，重新开发新的 AI 小说项目"——这值得用一个明确决策回答。

### 13.1 五维评估

| 维度 | 在原架构升级 | 推倒重来 |
|----|----|----|
| **沉没成本** | 已有 ~50k 行 TS + 39 表 schema + 司天监视觉 + 第一公理代码 + 724 测试 green | 全部归零 |
| **重新设计自由度** | 受限于 MOU/sovereignty-guard 已定 API | 可按 10.2.2 协议从零开始最佳实践 |
| **达到竞品 A 体验所需时长** | **8–14 周**（按本文路线图）| **6–9 个月**（从零搭框架）|
| **超越竞品 A 所需时长** | **+8–12 周** 增量（drama+world 升格 + 闭环）| **6–9 个月 + 增量** = 9–12 个月 |
| **风险** | 中（架构重构有阵痛）| 高（推倒重来项目大多失败，且现有架构其实很好）|

### 13.2 明确建议

**强烈推荐：在原架构升级，不要推倒重来。** 理由：

1. NarrativeOS 的架构优势（PostgreSQL+pgvector / 39 表关系数据 / sovereignty-guard / drama 节拍 / world 模拟闭环 / 司天监视觉 / 第一公理）**没有任何竞品有**。推倒重来意味着重新实现这些，但你大概率会复刻同样的设计——因为它们是对的。
2. 竞品 A 看起来体验好，但它的"世界设定"全是 JSON 文本字段——NarrativeOS 是结构化关系。底层结构差异是不可逆的，你推倒重来不可能选竞品 A 的底层结构，那等于把自己降级。
3. 缺的不是架构，是"作者每天会用 100 次的高频小功能 + 三引擎对等联动协议"。这两块全是**叠加式工作**，不需要破坏现有结构。
4. 第十章设计的"三引擎联动协议"完全可以落到现有 MouMachine + Shell 体系——`EngineCaller` 接口加一个 dramaShell 字段，NarrativeBus 加一个 EventEmitter，工作量按周计，不是按月计。

**唯一可考虑的"局部推倒"**：
- 前端 Cockpit 的"三栏并排工作台"：当前 CockpitPage 是 QuickLink hub，这一块**确实应该重做成"Studio 编辑器 + World 状态侧栏 + Drama 张力顶栏"的同屏 Living Workspace**。但这只是一个页面级重写，不是项目级推倒。

---

## 十四、与 NarrativeOS 实际 Phase 编号对齐的真实路线图

前半段路线图用了 W1-W25 的虚构周次，没对齐 `dev_plan_01_roadmap.md` 的 P/G/P' 体系。这里给一份**可以直接落进 `docs/iterations/index.md` 的真实编号路线**。

### 14.1 当前 Phase 现状（来自 HEARTBEAT.md 2026-05-21）

- `lastPhaseCompleted`: G5 修复幽灵 migration
- `currentPhase`: G5 治理层收尾（已完成）
- `nextStep`: **进入 P1' 写作主面板 + 持续审查后端流程并对齐设计文档**
- `testStatus`: green 724/724
- 设计补齐层 P0'–P9' 11 行表中 P1'–P9' 尚未启动

### 14.2 升级路线落到 P/G/P' 编号

#### Phase P1'：写作主面板（HEARTBEAT 已指明，3–4 周）

- P1'.a CopilotPanel 6 个 action（续写/润色/对话/发展/修正/展开）
- P1'.b Token 用量可视化（PromptBuilder 集成 estimateTokenCount + SSE token_info 事件 + UI）
- P1'.c 实体高亮系统（Tiptap Decoration + World 实体名 trie）
- P1'.d 章节信息侧栏（出场角色/物品/伏笔/情绪点）

**验收**：作者在 ChapterReader / Editor 页面能完成 80% 的日常写作动作，不需要离开页面。

#### Phase P2'：Drama Engine MVP 升格（4–5 周，可与 P1' 并行）

- P2'.a `EngineCaller` 加入 `dramaShell`，`mou-orchestrator/src/sovereignty-guard.ts` 加 drama 守门断言
- P2'.b `mou-machine.ts` 阶段 0 加 `parallel { world, drama, studio }.queryContext()` 装配 NarrativeContext
- P2'.c TensionDashboardPage 升级为"实时旁观流"，订阅 `content.tension.update`
- P2'.d 冲突看板 ConflictBoardPage + 节拍轨 BeatTimelinePage（前端从 0 到 1）
- P2'.e Drama 的 `assertBeatAlignment` 接入 Brief 阶段（向作者展示"偏离节拍"告警）

**验收**：drama-engine 从"被 Studio 透传"升格为"对等公民"，前端可见。

#### Phase P3'：Chapter Brief + Retcon 强化（3–4 周）

- P3'.a Brief 表单加写作风格（6 选 1）/ 内容侧重（8 选 N）/ 节奏（3 选 1）/ 自定义要求
- P3'.b 章节完善面板 EnhanceChapterPage（深度/风格模板/智能引入伏笔/对比 diff）
- P3'.c Retcon 工作流再升级：影响域可视化（World.impact 接 D3）

#### Phase P4'：谏官 LLM 5→20 校验项（4–5 周）

- P4'.a 把当前 `quality/scorer.ts` 的 5 个评分扩到 20 个（语言/节奏/一致性/伏笔密度/对话占比/感官细节/...）
- P4'.b 阶段 3 的 `EngineScore` 协议落地（三引擎并行评分 + 加权合并）
- P4'.c 评分报告 UI 改造（QualityDashboardPage 增加雷达图）

#### Phase P5'：规则管理 + 去 AI 味（3–4 周）

- P5'.a `rules` 表 + RulesPage + PromptBuilder 注入
- P5'.b 去 AI 味 dehumidify 模块（phrase-bank + scanner + rewriter）
- P5'.c 高频词分析报告（章节级 / 项目级）

#### Phase P6'：风格指纹活化 + 长程记忆（3–4 周）

- P6'.a commit 时 `styleSnapshotter.snapshot()` 激活 `styleSnapshots` 表
- P6'.b `queryStyleContext` 在 Brief 时反向注入"近 N 章风格特征"
- P6'.c Embedding 写入管线（commit 后异步 chunk + embed + upsert）
- P6'.d ChapterReader 加"近似段落"侧栏（pgvector 检索）

#### Phase P7'：World 14 子领域全面接入 UI（4–6 周）

- P7'.a NarrativeAdvisor → Cockpit 卡片
- P7'.b geography → 地图可视化（Leaflet）
- P7'.c faction → 势力关系图（Cytoscape）
- P7'.d character → 角色动机视图
- P7'.e info-graph → 实体悬浮卡的信息差标注

#### Phase P8'：Observability + DevAgent 接班（3–4 周）

- P8'.a OTel + Trace（一次章节生成 → N 个 LLM 调用 → 引擎调度的完整 trace）
- P8'.b 把 NarrativeBus 全事件落到 `auditLogs`，作为"DevAgent 知识库"原料
- P8'.c Claude Code 担任 DevAgent 的工作流文档化（哪些信号触发哪些行为）

#### Phase P9'：Cockpit 三栏 Living Workspace 重写（4–5 周，可放最后）

- P9'.a Cockpit 从 QuickLink hub 改为：左 World 状态侧栏 / 中 Editor / 右 Studio Copilot / 顶 Drama 张力轨
- P9'.b CommandPalette 支持跨引擎指令（"插入伏笔"、"切换章节"、"对照风格"等）
- P9'.c 司天监视觉系统完成"赤心朱批"批注 UI + 聚珍仿宋长篇阅读字号

### 14.3 时间盘点

按 1 人 Claude Code 协作执行：

| 阶段 | 工时估算 | 累计 |
|----|----|----|
| P1' | 3–4 周 | 4 周 |
| P2' | 4–5 周（并行 P1' 后 2 周）| 7 周 |
| P3' | 3–4 周 | 11 周 |
| P4' | 4–5 周 | 16 周 |
| P5' | 3–4 周 | 20 周 |
| P6' | 3–4 周 | 24 周 |
| P7' | 4–6 周 | 30 周 |
| P8' | 3–4 周 | 34 周 |
| P9' | 4–5 周 | **39 周（≈9 个月）**|

**关键里程碑**：P1' 完成（4 周）即可达到竞品 A 80% 的日常体验；P3' 完成（11 周）即可全面超越竞品 A 在专业度上；P9' 完成（39 周）NarrativeOS 完整形态成型。

### 14.4 此刻立刻能动手的 7 天破冰清单

如果你今天就想看到进展，按这个顺序做：

| 天 | 动作 | 文件 |
|---|------|------|
| D1 | 在 `packages/shared-types` 加 `engine-protocol.ts`（10.2.3 类型契约） | 新建 |
| D2 | 在 `packages/mou-orchestrator` 的 `EngineCaller` 加 `dramaShell` 字段；`server.ts` 装配 dramaShell | `mou-machine.ts:127` + `apps/server/src/server.ts:73` |
| D3 | 在 `studio-engine` 新建 `copilot/continue.ts` 实现智能续写（最简版，调 llm.chat） | 新建 |
| D4 | 在 `apps/web` 的 `CopilotPanel.tsx` 接入续写按钮 + SSE 流 | 改 CopilotPanel |
| D5 | 在 `packages/llm` 把 `estimateTokenCount` 暴露到 SSE 流前缀事件 `token_info` | `packages/llm/src/index.ts` |
| D6 | 在 CopilotPanel 顶部画 Token 进度条 | UI |
| D7 | Commit + 写 review，更新 HEARTBEAT.md 进入 P1' | `docs/reviews/p1prime-week1-review.md` |

**7 天结束**：作者第一次能在编辑器里点击"智能续写"看到 Token 进度条和流式输出——这就是竞品 A 最核心的"日常体验"被复刻的第一刀。

---

## 十五、终极结论

1. **不要推倒重来。** NarrativeOS 的工程地基（PostgreSQL+pgvector、39 表 schema、sovereignty-guard、drama 节拍学、world 模拟闭环、司天监视觉、第一公理代码）在中文 AI 小说工具里**是唯一的**，推倒就是降级。
2. **真正的差距是"作者每天会用 100 次的小功能" + "三引擎对等联动协议" + "前端 Living Workspace"。** 前者按 11.1 八件套补齐；中者按 10.2 协议落地；后者放到 P9' 重写 CockpitPage。
3. **"双引擎"在 NarrativeOS 必须重新定义为三引擎对等公民**：Drama 升格、World 升格为实时裁决者、Studio 主导生成、MOU 编排、sovereignty-guard 守门、NarrativeBus 串场。
4. **激活两份"死资产"是最高 ROI 的两刀**：`styleSnapshots`（让风格活）+ `embeddings` 写入管线（让 RAG 真用）。
5. **路线图按 P1'–P9' 走，4 周达到竞品 A 80% 体验，11 周全面超越竞品 A，39 周完整形态。** 比推倒重来快 3 倍以上，且不丢任何已有资产。
6. **如果只能做一件事**：执行 14.4 的 7 天破冰清单 D1–D7，作者立刻能感受到"我的项目变成了 AI 小说助手 + 工程化护城河"。

---

> **真正的文档结束。** 第九至十五章是 2026-05-21 在阅读完整代码库后做的校准与深化，所有具体文件路径、行号、表名均与代码基线一致，可直接作为开发任务的输入。第一至八章保留作为原始竞品分析参考，但与代码基线冲突处以本章为准。
