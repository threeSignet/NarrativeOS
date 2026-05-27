# 第十二章 LLM集成策略与Prompt组装系统设计

> **文档版本**: v3.0-Sovereign  
> **适用范围**: NarrativeOS v3.0 Sovereign — 面向100万字以上长篇网文创作的作者增强系统  
> **最后更新**: 2026年5月  

---

## 目录

- 12.1 LLM调用节点完整清单（原文保留）
- 12.2 成本估算（原文保留）
- 12.3 Prompt组装保障（原文保留）
- 12.4 模型路由策略完整设计
- 12.5 Prompt版本管理系统
- 12.6 Token预算管理
- 12.7 调用管线优化
- 12.8 降级策略
- 12.9 成本控制系统详细设计
- 12.10 Prompt组装工程实现
- 12.11 完整成本模型（2025-2026年更新版）
- 12.12 响应质量监控

---

## 12.1 LLM调用节点完整清单（原文档）

| 调用点 | 调用方 | 模型档位 | 温度 | 模式 | 频次 |
|---|---|---|---|---|---|
| 可能性清单可读描述 | 世界引擎 | 重型 | 0.8 | 同步 | 每章5次 |
| 可能性叙事增强 | 世界引擎 | 重型 | 0.8 | 同步 | 每章5次 |
| NPC意图推断 | 世界引擎 | 轻型 | 0.5 | 同步 | 每章1-5次 |
| 场景感知叙事化 | 世界引擎 | 轻型 | 0.5 | 同步 | 每章1次 |
| 涟漪叙事后果 | 世界引擎 | 轻型 | 0.5 | 异步 | 每章0-10次 |
| 核聚变叙事解释 | 世界引擎 | 重型 | 0.5 | 同步 | 极低频 |
| 世界时间叙事评估 | 世界引擎 | 重型 | 0.5 | 同步 | 每卷1次 |
| 叙事价值评估 | 工作室引擎 | 轻型 | 0.3 | 同步 | 每章5次 |
| 生成Brief | 工作室引擎 | 重型 | 0.5 | 同步 | 每章1次 |
| 生成正文 | 工作室引擎 | 重型 | 0.8 | 同步 | 每章1次 |
| 修改正文 | 工作室引擎 | 重型 | 0.3 | 同步 | 按需 |
| 质量评分(x3) | 工作室引擎 | 轻型 | 0.1 | 并行 | 每章3次 |
| 谏官风险分析 | 谏官 | 轻型 | 0.3 | 同步 | 按需 |
| 谏官策略生成 | 谏官 | 轻型 | 0.5 | 同步 | 按需 |
| 召回语生成 | Flow Guardian | 轻型 | 0.8 | 同步 | 按需 |
| 固化信息提取 | 世界引擎 | 轻型 | 0.1 | 同步 | 每章1次 |
| 章节摘要生成 | 工作室引擎 | 轻型 | 0.3 | 同步 | 每章1次 |
| AMA风格蒸馏 | 工作室引擎 | 重型 | 0.3 | 多轮 | 低频 |
| 代价共情化 | 工作室引擎 | 重型 | 0.5 | 同步 | 低频 |

**每章平均总调用**: 约20-30次（其中重型6-8次，轻型15-20次），异步部分不阻塞。

---

## 12.2 成本估算（原文档）

以DeepSeek-Chat为例，重型每次约8000 in + 1000 out，轻型每次约2000 in + 500 out，每章成本约V0.08-0.10，千章约V80-100。

> **注**: 12.11节提供基于2025-2026年最新定价的完整成本模型更新。

---

## 12.3 Prompt组装保障（原文档）

- 固化时自动生成摘要
- 检索质量监控
- 作者可见上下文清单
- 可调top_k

> **注**: 12.10节提供Prompt组装保障的工程实现细节。

---

## 12.4 模型路由策略完整设计

### 12.4.1 支持的模型提供商清单

NarrativeOS v3.0 Sovereign采用**多提供商联邦架构**，支持以下模型提供商的动态接入：

#### A. 云端API提供商

| 提供商 | 接入状态 | 支持模型系列 | 推荐用途 | 地区可用性 |
|---|---|---|---|---|
| **DeepSeek** | 核心提供商 | V4-Flash, V4-Pro | 主力生产（成本最优） | 全球 |
| **OpenAI** | 一级备用 | GPT-5.5, GPT-5.4, GPT-5.4-mini, GPT-4o | 高质量输出/复杂推理 | 全球（受限地区需中转） |
| **Anthropic** | 一级备用 | Claude Opus 4.7, Sonnet 4.6, Haiku 4.5 | 长上下文/创意写作 | 全球（受限地区需中转） |
| **Google** | 二级备用 | Gemini 3.1 Pro, 2.5 Pro, 2.5 Flash | 多模态/快速响应 | 全球 |
| **阿里云** | 区域核心 | Qwen3-235B, Qwen3-72B, Qwen3-32B | 国内合规部署 | 中国大陆 |
| **SiliconFlow** | 聚合网关 | 多家模型统一接口 | 故障切换/负载均衡 | 中国大陆 |

#### B. 本地/私有化部署

| 部署方式 | 推荐模型 | 硬件需求 | 适用场景 |
|---|---|---|---|
| **vLLM + Qwen3-72B** | Qwen3-72B-AWQ/GPTQ | 2xA100 80GB 或 4xRTX 4090 | 主力本地重型任务 |
| **vLLM + Qwen3-32B** | Qwen3-32B-AWQ/GPTQ | 1xA100 40GB 或 2xRTX 4090 | 本地轻型任务 |
| **Ollama + Yi-34B** | Yi-1.5-34B-Chat | 1xRTX 4090 | 离线紧急备用 |
| **LM Studio + DeepSeek-LLM** | DeepSeek-LLM-67B-Chat | 2xA100 80GB | 数据敏感环境 |
| **llama.cpp (纯CPU)** | Qwen2.5-7B-GGUF-Q4 | 64GB RAM | 极端降级（无GPU） |

#### C. 模型档位的精确定义

**重型任务模型（Heavy Tier）**

| 优先级 | 模型 | 上下文窗口 | 特点 | 选用条件 |
|---|---|---|---|---|
| H1 | DeepSeek V4-Pro | 1M tokens | 成本极低，质量优秀 | 默认首选，在线环境 |
| H2 | Claude Sonnet 4.6 | 1M tokens | 创意写作最强，1M上下文 | 创意生成/风格蒸馏 |
| H3 | GPT-5.4 | 1M tokens | 综合能力优秀 | DeepSeek不可用时 |
| H4 | Gemini 2.5 Pro | 1M tokens | 多语言支持好 | 其他都不可用时 |
| H5 | Qwen3-235B (本地) | 128K tokens | 国内合规，数据不出境 | 私有化部署环境 |
| H6 | DeepSeek V4-Flash | 1M tokens | 速度极快，成本最低 | 低复杂度重型任务 |

**轻型任务模型（Light Tier）**

| 优先级 | 模型 | 上下文窗口 | 特点 | 选用条件 |
|---|---|---|---|---|
| L1 | DeepSeek V4-Flash | 1M tokens | 速度极快，成本极低 | 默认首选所有轻型任务 |
| L2 | Claude Haiku 4.5 | 200K tokens | 响应快，成本低 | 需要高质量轻量输出 |
| L3 | GPT-5.4 nano | 128K tokens | OpenAI生态最便宜 | 评分/分类任务 |
| L4 | Gemini 2.5 Flash-Lite | 1M tokens | 成本最低之一 | 超高频调用 |
| L5 | Qwen3-32B (本地) | 128K tokens | 本地部署，零API成本 | 私有化/高频离线 |
| L6 | GPT-4o mini | 128K tokens | 成熟稳定 | 兼容性需求 |

### 12.4.2 模型选择策略

#### 四维度路由决策矩阵

```
模型选择 = f(质量需求, 成本预算, 延迟容忍, 可用性状态)
```

**路由决策流程图**:

```
                    [调用请求到达]
                          |
                    [读取路由配置]
                          |
              +-----------+-----------+
              |                       |
        [作者指定模型?]          [自动路由]
              |                       |
         是 | 否                   |
              |                       |
        [使用指定]      +-------------+-------------+
              |         |                           |
              |    [成本优先模式]              [质量优先模式]
              |         |                           |
              |    [选择 cheapest              [选择 best_quality
              |     available]                   available]
              |         |                           |
              +---------+-------------+-------------+
                                |
                        [检查模型健康状态]
                                |
                    +-----------+-----------+
                    |                       |
              [健康?]                 [不健康]
                    |                       |
                是 |                    否 |
                    |                       |
              [直接调用]            [降级到下一优先级]
                    |                       |
                    +-----------+-----------+
                                |
                        [执行调用]
                                |
                        [记录决策日志]
```

#### 路由策略模式

| 模式 | 说明 | 适用场景 |
|---|---|---|
| **quality-first** | 总是选择质量最高的可用模型 | 正文生成、风格蒸馏、AMA |
| **cost-first** | 总是选择成本最低的可用模型 | 质量评分、摘要生成、固化提取 |
| **balanced** | 质量/成本平衡，默认策略 | 大多数调用点 |
| **speed-first** | 选择响应最快的模型 | 实时交互、召回语生成 |
| **author-pick** | 作者手动指定模型 | 特殊创作需求 |
| **auto-fallback** | 自动降级到可用模型 | 故障恢复场景 |

### 12.4.3 多模型并行的负载均衡

#### 智能负载均衡器 (Adaptive Load Balancer)

```python
class AdaptiveLoadBalancer:
    """
    NarrativeOS 智能负载均衡器
    基于实时健康、成本和延迟数据动态分配请求
    """

    # 权重配置
    WEIGHT_QUALITY = 0.35    # 质量权重
    WEIGHT_COST = 0.30       # 成本权重
    WEIGHT_LATENCY = 0.20    # 延迟权重
    WEIGHT_HEALTH = 0.15     # 健康权重

    # 负载均衡策略
    STRATEGIES = {
        'round_robin': RoundRobinStrategy(),
        'weighted_random': WeightedRandomStrategy(),
        'least_latency': LeastLatencyStrategy(),
        'least_cost': LeastCostStrategy(),
        'adaptive': AdaptiveScoringStrategy(),  # 默认
    }
```

**负载均衡决策公式**:

```
模型得分 = (quality_score * 0.35)
         + (cost_efficiency * 0.30)
         + (latency_score * 0.20)
         + (health_score * 0.15)

其中:
  quality_score = 模型在任务类型上的历史质量评分 (0-1)
  cost_efficiency = 1 / (normalized_cost) (0-1)
  latency_score = 1 / (normalized_p99_latency) (0-1)
  health_score = 成功率 * 可用性指标 (0-1)
```

#### 连接池管理

| 参数 | 重型模型 | 轻型模型 | 本地模型 |
|---|---|---|---|
| 最大并发连接 | 10 | 30 | 50 |
| 连接超时 | 120s | 30s | 60s |
| 空闲连接保持 | 300s | 120s | 600s |
| 连接预热 | 是（启动时2连接） | 是（启动时5连接） | 是（启动时5连接） |
| 请求队列长度 | 50 | 100 | 200 |
| 熔断阈值 | 错误率>50% | 错误率>50% | 错误率>80% |

### 12.4.4 API Key管理和轮换策略

#### Key Vault架构

```
+-------------------+
|   HashiCorp Vault  |  (生产环境)
|   or AWS Secrets   |
|   Manager          |
+---------+---------+
          |
+---------v---------+     +------------------+
|  Key Manager       |     |  Encrypted Local  |
|  Service           |<--->|  Store (开发环境) |
+---------+---------+     +------------------+
          |
+---------v---------+
|  Provider A Keys  |--[Key Pool A-1]-- Primary
|                   |--[Key Pool A-2]-- Secondary
|  Provider B Keys  |--[Key Pool B-1]-- Primary
|                   |--[Key Pool B-2]-- Secondary
+-------------------+
```

#### Key轮换策略

| 策略 | 说明 | 频率 |
|---|---|---|
| **自动轮换** | 定时自动切换API Key | 每24小时或按配额使用率 |
| **配额感知轮换** | 接近配额上限时自动切换 | 实时监控触发 |
| **故障驱动轮换** | 某个Key频繁失败时切换 | 事件驱动 |
| **分级Key体系** | 不同引擎使用不同Key组 | 静态配置 |

**Key配额监控**:
```python
class KeyQuotaMonitor:
    """实时配额监控与预警"""

    ALERT_THRESHOLDS = {
        'warning': 0.70,    # 70% 时预警
        'critical': 0.90,   # 90% 时紧急切换
        'exhausted': 0.98,  # 98% 时完全停用
    }

    QUOTA_CHECK_INTERVAL = 60  # 每60秒检查一次
```

---

## 12.5 Prompt版本管理系统

### 12.5.1 Prompt存储结构

#### 存储Schema设计

```yaml
# Prompt版本存储结构 (YAML/JSON)
prompt_registry:
  schema_version: "3.0"

  prompt_entry:
    prompt_id: "gen_brief_v3"           # 唯一标识符
    name: "生成Brief"                    # 人类可读名称
    call_point: "studio_engine.brief"   # 调用点绑定
    model_tier: "heavy"                 # 适用模型档位

    # 版本历史
    versions:
      - version: "3.2.1"
        status: "active"                # active | deprecated | draft
        created_at: "2026-04-15T10:30:00Z"
        author: "system"
        change_type: "patch"            # major | minor | patch
        changelog: "优化了角色一致性检查的措辞"

        # 模板内容
        template:
          engine: "handlebars"
          source_file: "./templates/studio/gen_brief_v3.2.1.hbs"
          checksum: "sha256:abc123..."

        # 模板变量定义
        variables:
          - name: "chapter_number"
            type: "integer"
            required: true
            description: "当前章节编号"
            validation: ">0"

          - name: "plot_arc"
            type: "string"
            required: true
            description: "当前情节弧线"
            max_length: 500

          - name: "character_states"
            type: "array"
            required: true
            description: "角色状态列表"
            item_schema: "character_state"

          - name: "world_context"
            type: "string"
            required: false
            description: "世界背景上下文"
            default: ""
            max_length: 8000

        # 模型参数绑定
        model_params:
          temperature: 0.5
          max_tokens: 2000
          top_p: 0.95
          presence_penalty: 0.0
          frequency_penalty: 0.1

        # 质量门控
        quality_gate:
          min_output_length: 100
          required_format: "json"
          validation_schema: "./schemas/brief_output.json"

      - version: "3.2.0"
        status: "deprecated"
        ...
```

#### 存储后端

| 存储层 | 用途 | 技术选型 |
|---|---|---|
| **版本控制层** | Prompt模板版本历史 | Git LFS |
| **运行时层** | 当前活跃Prompt缓存 | Redis (TTL=300s) |
| **持久化层** | 完整Prompt库 | PostgreSQL + S3 |
| **分发层** | 多实例同步 | Event Bus (Kafka/NATS) |

### 12.5.2 Prompt A/B测试框架

#### A/B测试架构

```
+-------------------+
|   Prompt Registry  |
|   (版本库)         |
+--------+----------+
         |
+--------v----------+     +------------------+
|  A/B Test Manager  |<--->|  Metrics Collector|
+--------+----------+     +------------------+
         |
    +----v----+----v----+
    |         |         |
 [分支A]   [分支B]   [控制组]
    |         |         |
    +----+----+----+----+
         |
+--------v----------------+
|  Statistical Evaluator  |
|  (显著性检验)            |
+------------+------------+
             |
+------------v------------+
|  Auto-promote / Rollback|
+-------------------------+
```

#### A/B测试配置

```yaml
ab_test:
  test_id: "brief_quality_2026_q2"
  prompt_id: "gen_brief"
  hypothesis: "新增角色一致性检查提示可提升Brief质量评分5%"

  branches:
    - name: "control"
      version: "3.2.0"
      traffic: 0.33

    - name: "treatment"
      version: "3.3.0-beta"
      traffic: 0.33

    - name: "treatment_v2"
      version: "3.3.1-beta"
      traffic: 0.34

  # 成功指标
  success_metrics:
    - name: "quality_score"
      type: "gauge"
      target_improvement: 0.05       # 期望提升5%
      min_sample_size: 100
      significance_level: 0.05

    - name: "token_efficiency"
      type: "gauge"
      max_degradation: 0.10         # Token效率下降不超过10%

  # 护栏指标（安全底线）
  guardrail_metrics:
    - name: "error_rate"
      max_threshold: 0.05           # 错误率不超过5%

    - name: "p99_latency"
      max_threshold: 15000          # P99延迟不超过15s

  # 自动决策
  auto_decision:
    enabled: true
    promotion_threshold: 0.95       # 置信度>95%时自动晋升
    rollback_threshold: 0.90        # 置信度<90%时自动回滚
    max_test_duration: "72h"        # 最长测试72小时
```

### 12.5.3 Prompt变更影响分析

#### 影响分析引擎

```python
class PromptImpactAnalyzer:
    """分析Prompt变更的潜在影响范围"""

    IMPACT_DIMENSIONS = [
        'call_points',       # 受影响的调用点
        'output_format',     # 输出格式变化
        'token_usage',       # Token消耗变化
        'quality_metrics',   # 质量指标影响
        'downstream_deps',   # 下游依赖
    ]

    def analyze(self, prompt_id: str, from_version: str, to_version: str) -> ImpactReport:
        """分析两个版本之间的变更影响"""
        diff = self.compute_diff(prompt_id, from_version, to_version)

        return ImpactReport(
            affected_call_points=self.find_affected_call_points(prompt_id),
            token_delta_estimate=self.estimate_token_change(diff),
            risk_level=self.compute_risk_level(diff),
            recommended_test_scope=self.recommend_test_scope(diff),
            rollback_plan=self.generate_rollback_plan(prompt_id, from_version),
        )
```

**影响等级定义**:

| 等级 | 定义 | 处理流程 |
|---|---|---|
| **P0-Critical** | 影响核心创作流程，可能导致输出格式破坏 | 需要完整回归测试，必须人工审批 |
| **P1-High** | 影响质量或成本，输出格式兼容 | A/B测试48小时，自动报告 |
| **P2-Medium** | 小幅优化，不影响兼容性 | A/B测试24小时，自动审批 |
| **P3-Low** | 注释、文档、非功能性变更 | 直接部署 |

### 12.5.4 回滚机制

#### 三层回滚策略

```
Layer 1: 内存级回滚 (ms级)
  - Redis中缓存上一版本Prompt
  - 发现异常时即时切换

Layer 2: 配置级回滚 (s级)
  - 版本标记切换 (active <-> rollback_target)
  - 无需重启服务

Layer 3: 部署级回滚 (min级)
  - 全量回退到上一个稳定版本
  - 紧急制动开关
```

**自动回滚触发条件**:

| 条件 | 阈值 | 检测窗口 |
|---|---|---|
| 错误率飙升 | >10%（基线3%） | 5分钟 |
| 平均响应质量下降 | >20% | 10分钟 |
| P99延迟超标 | >30秒 | 3分钟 |
| 输出格式错误率 | >5% | 5分钟 |
| 作者投诉触发 | N/A | 即时 |

---

## 12.6 Token预算管理

### 12.6.1 全局Token预算配置

#### 预算层级架构

```
[项目级预算]  100万字小说项目: 总Token预算 50M input / 10M output
    |
    +-- [卷级预算] 第1卷 (20万字): 10M input / 2M output
    |       |
    |       +-- [章级预算] 第1章: 50K input / 10K output
    |       +-- [章级预算] 第2章: 50K input / 10K output
    |       ...
    |
    +-- [卷级预算] 第2卷 (25万字): 12M input / 2.4M output
    ...
    |
    +-- [应急储备] 10% 缓冲
```

#### 全局配置Schema

```yaml
token_budget:
  project:
    name: "novel_2026_dragons"
    total_input_budget: 50000000    # 50M input tokens
    total_output_budget: 10000000   # 10M output tokens
    currency_budget_cny: 500.00     # 总成本预算 V500
    emergency_reserve: 0.10         # 10% 应急储备

  allocation_strategy:
    type: "proportional"           # proportional | fixed | adaptive
    chapter_base_input: 50000
    chapter_base_output: 10000
    word_count_multiplier: 1.0     # 按字数比例调整

  # 各引擎预算配额
  engine_quotas:
    world_engine:
      input_quota: 0.50            # 50% 预算
      output_quota: 0.40
    studio_engine:
      input_quota: 0.40
      output_quota: 0.50
    censor:
      input_quota: 0.05
      output_quota: 0.05
    flow_guardian:
      input_quota: 0.05
      output_quota: 0.05
```

### 12.6.2 各调用点Token配额分配

#### 精细配额表

| 调用点 | 输入配额 | 输出配额 | 硬性上限 | 软警告阈值 |
|---|---|---|---|---|
| 可能性清单可读描述 | 8K | 1K | 12K/2K | 10K/1.5K |
| 可能性叙事增强 | 8K | 1K | 12K/2K | 10K/1.5K |
| NPC意图推断 | 4K | 500 | 6K/1K | 5K/750 |
| 场景感知叙事化 | 6K | 800 | 10K/1.5K | 8K/1K |
| 涟漪叙事后果 | 3K | 500 | 5K/1K | 4K/750 |
| 核聚变叙事解释 | 15K | 3K | 25K/5K | 20K/4K |
| 世界时间叙事评估 | 20K | 5K | 32K/8K | 25K/6K |
| 叙事价值评估 | 2K | 300 | 4K/500 | 3K/400 |
| 生成Brief | 10K | 2K | 16K/4K | 13K/3K |
| **生成正文** | **12K** | **4K** | **20K/8K** | **16K/6K** |
| 修改正文 | 15K | 5K | 25K/10K | 20K/8K |
| 质量评分(x3) | 3K | 200 | 5K/500 | 4K/350 |
| 谏官风险分析 | 5K | 500 | 8K/1K | 6K/750 |
| 谏官策略生成 | 4K | 800 | 7K/1.5K | 5K/1K |
| 召回语生成 | 2K | 500 | 4K/1K | 3K/750 |
| 固化信息提取 | 8K | 1K | 12K/2K | 10K/1.5K |
| 章节摘要生成 | 6K | 800 | 10K/1.5K | 8K/1K |
| AMA风格蒸馏 | 15K | 5K | 25K/10K | 20K/8K |
| 代价共情化 | 10K | 2K | 16K/4K | 13K/3K |

### 12.6.3 超限处理策略

#### 三级超限处理

```
Level 1: 软警告 (Soft Warning)
  触发条件: 达到配额80%
  处理动作:
    - 记录日志
    - 通知作者（可选）
    - 标记该调用点为"高消耗"

Level 2: 硬截断 (Hard Truncation)
  触发条件: 达到配额100%
  处理动作:
    - 对输入进行智能压缩
    - 减少上下文长度
    - 降低top_k检索数量
    - 继续执行但记录为"受限模式"

Level 3: 强制降级 (Forced Degradation)
  触发条件: 达到配额120%
  处理动作:
    - 切换到更经济的模型
    - 使用简化版Prompt
    - 减少调用次数
    - 通知作者需要追加预算
```

#### 智能截断策略

```python
class SmartTruncator:
    """智能上下文截断器 — 保留最关键信息"""

    TRUNCATION_PRIORITIES = {
        # 按重要性从高到低排列
        'system_prompt': 0,       # 永不截断
        'user_instruction': 1,    # 永不截断
        'plot_constraints': 2,    # 高优先级
        'character_profiles': 3,  # 高优先级
        'recent_chapters': 4,     # 中优先级
        'world_building': 5,      # 中优先级
        'historical_events': 6,   # 低优先级
        'style_examples': 7,      # 低优先级
        'general_context': 8,     # 最低优先级
    }

    def truncate(self, context_segments: list[Segment], max_tokens: int) -> list[Segment]:
        """
        按优先级截断上下文段，确保最重要的信息保留
        """
        # 按优先级排序
        sorted_segments = sorted(
            context_segments,
            key=lambda s: self.TRUNCATION_PRIORITIES.get(s.type, 99)
        )

        result = []
        current_tokens = 0

        for segment in sorted_segments:
            if current_tokens + segment.token_count <= max_tokens:
                result.append(segment)
                current_tokens += segment.token_count
            elif segment.priority <= 3:  # 高优先级段尝试压缩
                compressed = self.compress(segment, max_tokens - current_tokens)
                if compressed:
                    result.append(compressed)
                    current_tokens += compressed.token_count
                # 高优先级段截断时记录警告
                self.log_truncation(segment, "high_priority_compressed")

        return result

    def compress(self, segment: Segment, max_tokens: int) -> Segment | None:
        """对单个段进行压缩（摘要化）"""
        if segment.type == 'world_building':
            return self.summarize_world(segment, max_tokens)
        elif segment.type == 'historical_events':
            return self.filter_recent(segment, max_tokens)
        elif segment.type == 'style_examples':
            return self.reduce_examples(segment, max_tokens)
        return None
```

### 12.6.4 Token使用实时监控

#### 监控Dashboard指标

| 指标 | 类型 | 采集频率 | 告警阈值 |
|---|---|---|---|
| 实时Token消耗速率 | Gauge | 每调用 | 章节预算超80% |
| 累计Token消耗 | Counter | 每调用 | 项目预算超90% |
| 单调用Token分布 | Histogram | 每调用 | P99超过配额120% |
| 模型级Token消耗 | Counter | 每分钟 | 单一模型消耗>60% |
| 引擎级Token消耗 | Counter | 每分钟 | 引擎配额超80% |
| 成本累计（CNY） | Counter | 每调用 | 日预算超100% |
| 缓存命中率 | Gauge | 每分钟 | <50% |
| 截断次数 | Counter | 每调用 | >10次/章 |

---

## 12.7 调用管线优化

### 12.7.1 并行调用的批处理策略

#### 可并行调用分组

根据12.1节的调用节点分析，以下调用可并行执行：

**并行组A: 可能性生成（每章）**
```
并行执行:
  - 可能性清单可读描述 (重型, 同步)
  - 可能性叙事增强 (重型, 同步)
  - NPC意图推断 (轻型, 同步)
依赖: 无前置依赖
耗时: max(调用1, 调用2, 调用3) 而非 三者之和
```

**并行组B: 质量评估（每章）**
```
并行执行:
  - 质量评分-维度1: 叙事连贯性 (轻型)
  - 质量评分-维度2: 角色一致性 (轻型)
  - 质量评分-维度3: 文学质量 (轻型)
依赖: 正文生成完成后
耗时: 单次评分时间（而非3次）
```

**并行组C: 谏官审查（按需）**
```
并行执行:
  - 谏官风险分析 (轻型)
  - 叙事价值评估 (轻型)
依赖: Brief生成后
```

#### 管线编排引擎

```python
class PipelineOrchestrator:
    """
    NarrativeOS 调用管线编排引擎
    将串行依赖图转换为最优执行计划
    """

    # 每章调用依赖图
    CHAPTER_PIPELINE = {
        'stage_1_world_sim': {
            'tasks': [
                'possibility_list',
                'possibility_narrative',
                'npc_intention',
                'scene_narrative',
            ],
            'parallel': True,
            'dependencies': [],
        },
        'stage_2_cascade': {
            'tasks': ['ripple_consequence'],
            'parallel': False,
            'dependencies': ['stage_1_world_sim'],
            'async': True,  # 异步执行，不阻塞主流程
        },
        'stage_3_studio_brief': {
            'tasks': ['narrative_value_assess', 'generate_brief'],
            'parallel': True,
            'dependencies': ['stage_1_world_sim'],
        },
        'stage_4_studio_body': {
            'tasks': ['generate_body'],
            'parallel': False,
            'dependencies': ['stage_3_studio_brief'],
        },
        'stage_5_quality': {
            'tasks': ['quality_score_1', 'quality_score_2', 'quality_score_3'],
            'parallel': True,
            'dependencies': ['stage_4_studio_body'],
        },
        'stage_6_finalize': {
            'tasks': ['solidify_extract', 'chapter_summary'],
            'parallel': True,
            'dependencies': ['stage_5_quality'],
        },
    }

    def execute_pipeline(self, chapter_context: ChapterContext) -> PipelineResult:
        """执行完整章节管线"""
        execution_plan = self.build_execution_plan(
            self.CHAPTER_PIPELINE,
            available_workers=self.get_worker_pool(),
        )
        return self.run_parallel(execution_plan, chapter_context)
```

### 12.7.2 异步调用的队列管理

#### 异步队列架构

```
+------------------+     +------------------+     +------------------+
|   异步任务生产    |     |   Priority Queue  |     |   Worker Pool    |
|                  |---->|                  |---->|                  |
|  - 涟漪叙事后果   |     |  1. 紧急 (P0)    |     |  Worker 1-N      |
|  - 缓存预热       |     |  2. 高 (P1)      |     |                  |
|  - 日志归档       |     |  3. 正常 (P2)    |     +------------------+
|  - 成本报表       |     |  4. 低 (P3)      |            |
+------------------+     +------------------+            v
                                                  +------------------+
                                                  |  Result Store    |
                                                  |  (降级写入)       |
                                                  +------------------+
```

#### 队列配置

```yaml
async_queue:
  # 优先级队列配置
  priorities:
    P0_urgent:
      max_wait: 0           # 立即执行
      workers: 2
      tasks: ['author_modify', 'rollback_request']

    P1_high:
      max_wait: 5s
      workers: 3
      tasks: ['brief_generation', 'body_generation']

    P2_normal:
      max_wait: 30s
      workers: 4
      tasks: ['ripple_consequence', 'quality_score']

    P3_low:
      max_wait: 300s
      workers: 1
      tasks: ['cache_warmup', 'log_archive', 'cost_report']

  # 超时配置
  timeouts:
    default: 120s
    heavy: 300s
    light: 60s
    urgent: 30s

  # 重试配置
  retry:
    max_retries: 3
    backoff: exponential    # exponential | linear | fixed
    base_delay: 1s
    max_delay: 60s
    retryable_errors:
      - 'rate_limit'
      - 'timeout'
      - 'server_error'
      - 'connection_reset'
    non_retryable_errors:
      - 'invalid_api_key'
      - 'context_too_long'
      - 'content_filtered'
```

### 12.7.3 缓存策略

#### 三级缓存架构

```
L1: 内存缓存 (进程内 dict/lru_cache)
     TTL: 60s
     容量: 1000条
     命中: ~5微秒
     存储: 相同输入的重复调用结果

L2: Redis分布式缓存
     TTL: 300s (可调节)
     容量: 100000条
     命中: ~1毫秒
     存储: 跨会话的Prompt输出

L3: 磁盘持久化缓存
     TTL: 7天
     容量: 无限制
     命中: ~10毫秒
     存储: 固化信息、章节摘要、质量评分
```

#### 可缓存调用点清单

| 调用点 | 可缓存 | 缓存键 | TTL | L1 | L2 | L3 |
|---|---|---|---|---|---|---|
| 可能性清单可读描述 | 部分 | world_state_hash | 300s | Yes | Yes | No |
| 可能性叙事增强 | 部分 | possibility_hash | 300s | Yes | Yes | No |
| NPC意图推断 | 是 | npc+context_hash | 600s | Yes | Yes | Yes |
| 场景感知叙事化 | 是 | scene_hash | 300s | Yes | Yes | No |
| 涟漪叙事后果 | 否 | — | — | — | — | — |
| 核聚变叙事解释 | 是 | fusion_params_hash | 3600s | No | Yes | Yes |
| 世界时间叙事评估 | 是 | world_snapshot_hash | 86400s | No | Yes | Yes |
| 叙事价值评估 | 是 | chapter_hash | 600s | Yes | Yes | Yes |
| 生成Brief | 否 | — | — | — | — | — |
| 生成正文 | 否 | — | — | — | — | — |
| 修改正文 | 否 | — | — | — | — | — |
| 质量评分 | 部分 | text_fingerprint | 1800s | No | Yes | Yes |
| 谏官风险分析 | 部分 | content_fingerprint | 600s | No | Yes | No |
| 谏官策略生成 | 否 | — | — | — | — | — |
| 召回语生成 | 是 | trigger_hash | 300s | Yes | Yes | No |
| 固化信息提取 | 是 | chapter_hash | 7d | No | Yes | Yes |
| 章节摘要生成 | 是 | chapter_hash | 7d | No | Yes | Yes |
| AMA风格蒸馏 | 是 | style_params_hash | 86400s | No | Yes | Yes |
| 代价共情化 | 部分 | emotion_params_hash | 1800s | No | Yes | Yes |

#### 缓存键生成策略

```python
def generate_cache_key(call_point: str, params: dict, context: dict) -> str:
    """
    生成确定性缓存键
    原则: 相同输入必须产生相同缓存键
    """
    # 提取影响输出的关键参数
    key_components = [
        call_point,
        hash_params(params, exclude=['timestamp', 'request_id']),
        hash_context(context, depth=2),  # 深度2的上下文哈希
    ]

    # 使用SHA-256生成固定长度键
    raw_key = "|".join(str(c) for c in key_components)
    return f"nos:{call_point}:{sha256(raw_key.encode()).hexdigest()[:16]}"
```

### 12.7.4 调用链路追踪

#### 分布式追踪架构

```
[章节创作请求]
    |
    +-- [span: world_engine] (trace_id: abc123)
    |       |
    |       +-- [span: possibility_list] model=deepseek-v4-pro tokens=9000 latency=2.3s
    |       +-- [span: possibility_narrative] model=deepseek-v4-pro tokens=8500 latency=2.1s
    |       +-- [span: npc_intention] model=deepseek-v4-flash tokens=2500 latency=0.8s
    |       +-- [span: scene_narrative] model=deepseek-v4-flash tokens=4800 latency=1.2s
    |       +-- [span: ripple_consequence] model=deepseek-v4-flash tokens=3500 latency=1.5s [async]
    |
    +-- [span: studio_engine]
            |
            +-- [span: narrative_value] model=deepseek-v4-flash tokens=2300 latency=0.7s
            +-- [span: generate_brief] model=deepseek-v4-pro tokens=12000 latency=4.5s
            +-- [span: generate_body] model=deepseek-v4-pro tokens=16000 latency=8.2s
            +-- [span: quality_score] (并行3次)
            |       +-- [span: coherence] tokens=3200 latency=1.1s
            |       +-- [span: consistency] tokens=3100 latency=1.0s
            |       +-- [span: literary] tokens=3000 latency=1.2s
            +-- [span: solidify_extract] tokens=9000 latency=2.8s
            +-- [span: chapter_summary] tokens=6800 latency=2.0s
```

#### 追踪数据模型

```yaml
trace_span:
  trace_id: "uuid"
  span_id: "uuid"
  parent_span_id: "uuid | null"

  # 调用元数据
  call_point: "string"
  engine: "world_engine | studio_engine | censor | flow_guardian"
  model_tier: "heavy | light"

  # 模型信息
  model_provider: "deepseek | openai | anthropic | google | local"
  model_name: "string"
  model_version: "string"

  # Token数据
  tokens_input: "integer"
  tokens_output: "integer"
  tokens_cached: "integer"

  # 性能数据
  latency_ms: "integer"
  queue_wait_ms: "integer"
  retry_count: "integer"

  # 成本数据
  cost_usd: "float"
  cost_cny: "float"

  # 结果质量
  quality_score: "float | null"
  cache_hit: "boolean"
  cached_result: "boolean"

  # 状态
  status: "success | error | timeout | cancelled | degraded"
  error_type: "string | null"
```


---

## 12.8 降级策略

### 12.8.1 主模型不可用时的降级链

#### 重型任务降级链

```
正常路径:
  DeepSeek V4-Pro (H1)
    |
    +-- 不可用? --> Claude Sonnet 4.6 (H2)
    |                  |
    |                  +-- 不可用? --> GPT-5.4 (H3)
    |                                     |
    |                                     +-- 不可用? --> Gemini 2.5 Pro (H4)
    |                                                        |
    |                                                        +-- 不可用? --> 
    |                                                             Qwen3-72B本地 (H5)
    |                                                                   |
    |                                                                   +-- 不可用?
    |                                                                        --> DeepSeek V4-Flash (H6)
    |                                                                             |
    |                                                                             +-- 不可用?
    |                                                                                  --> 紧急降级
    |
降级模式触发:
  - 模型返回5xx错误 >= 3次
  - 响应延迟 > 30秒 (重型) / 10秒 (轻型)
  - 模型官方公告不可用
  - 配额耗尽
  - 网络连通性问题
```

#### 轻型任务降级链

```
正常路径:
  DeepSeek V4-Flash (L1)
    |
    +-- 不可用? --> Claude Haiku 4.5 (L2)
    |                  |
    |                  +-- 不可用? --> GPT-5.4 nano (L3)
    |                                     |
    |                                     +-- 不可用? --> Gemini 2.5 Flash-Lite (L4)
    |                                                        |
    |                                                        +-- 不可用? -->
    |                                                             Qwen3-32B本地 (L5)
    |                                                                   |
    |                                                                   +-- 不可用?
    |                                                                        --> GPT-4o mini (L6)
    |                                                                             |
    |                                                                             +-- 不可用?
    |                                                                                  --> CPU降级
    |
降级检查间隔: 30秒
恢复检查: 降级后每60秒尝试恢复主模型
```

### 12.8.2 简化版Prompt（紧急模式）

#### 紧急Prompt模板

当系统处于降级模式时，自动切换为精简版Prompt以减少Token消耗和模型负载：

**重型任务紧急Prompt模板**:
```handlebars
{{! 紧急模式 - 重型任务简化模板 }}
[任务] {{task_name}}
[章节] {{chapter_number}}
[核心设定] {{core_settings}} {{! 最多2000 tokens }}
[当前情节] {{current_plot}} {{! 最多1500 tokens }}
[输出要求] {{output_requirements}}
{{#if is_emergency}}
[注意] 当前处于降级模式，请尽可能简洁高效地完成任务。
{{/if}}
```

**Token削减比例**:

| 组件 | 正常模式 | 紧急模式 | 削减比例 |
|---|---|---|---|
| 世界设定 | 4000 tokens | 2000 tokens | -50% |
| 角色档案 | 3000 tokens | 1500 tokens | -50% |
| 历史章节 | 3000 tokens | 500 tokens | -83% |
| 风格示例 | 2000 tokens | 0 tokens | -100% |
| 系统指令 | 1000 tokens | 500 tokens | -50% |
| **总计** | **~13000 tokens** | **~4500 tokens** | **-65%** |

### 12.8.3 本地模型的备用方案

#### 本地模型部署配置

```yaml
local_model_farm:
  # 主力重型本地模型
  heavy_local:
    model: "Qwen3-72B-AWQ"
    backend: "vLLM"
    gpu: "A100-80GB x2"
    quantization: "AWQ-4bit"
    max_model_len: 32768
    tensor_parallel: 2
    batch_size: 4
    enabled: false    # 默认关闭，手动启用

  # 主力轻型本地模型
  light_local:
    model: "Qwen3-32B-AWQ"
    backend: "vLLM"
    gpu: "A100-40GB x1"
    quantization: "AWQ-4bit"
    max_model_len: 32768
    tensor_parallel: 1
    batch_size: 8
    enabled: false

  # 紧急降级模型
  emergency_local:
    model: "Qwen3-7B-GPTQ"
    backend: "vLLM"
    gpu: "RTX-4090 x1"
    quantization: "GPTQ-4bit"
    max_model_len: 16384
    tensor_parallel: 1
    batch_size: 16
    enabled: false

  # 极端降级（纯CPU）
  extreme_fallback:
    model: "Qwen2.5-7B-GGUF-Q4"
    backend: "llama.cpp"
    cpu_threads: 16
    context_size: 8192
    enabled: false
    note: "仅用于紧急保存作者数据，创作质量大幅下降"
```

**本地模型vs云端质量对比**:

| 任务类型 | 云端(DeepSeek V4-Pro) | 本地(Qwen3-72B) | 质量下降 | 可用性 |
|---|---|---|---|---|
| 正文生成 | 100% | 85-90% | -10~15% | 可用 |
| Brief生成 | 100% | 85-90% | -10~15% | 可用 |
| 可能性分析 | 100% | 80-85% | -15~20% | 可用 |
| 质量评分 | 100% | 90-95% | -5~10% | 可用 |
| 风格蒸馏 | 100% | 75-80% | -20~25% | 勉强可用 |

### 12.8.4 服务降级的触发条件和恢复策略

#### 自动降级状态机

```
                    [正常状态 NORMAL]
                          |
                    [健康检查失败]
                    (连续3次，间隔30s)
                          |
                    v-----v-----v
              [降级观察 DEGRADED]
                    |
        +-----------+-----------+-----------+
        |           |           |           |
    [L1降级]    [L2降级]    [L3降级]    [L4降级]
    模型切换    Prompt简化   功能降级    系统保护
        |           |           |           |
    切换备用    启用紧急    关闭非核心    只读模式
    模型        Prompt模板  功能        数据保护
        |           |           |           |
        +-----------+-----------+-----------+
                          |
                    [降级状态 DEGRADED]
                          |
                    [恢复检查]
                    (每60s尝试主模型)
                          |
                    [主模型恢复?]
                    /           \
                  是            否
                  /               \
        [逐步恢复]          [保持降级]
              |                   |
        [等待5分钟]               |
        [恢复正常]               |
              |                   |
              +-------------------+
                          |
                    [正常状态 NORMAL]
```

#### 降级触发矩阵

| 触发条件 | 降级级别 | 影响范围 | 恢复策略 |
|---|---|---|---|
| 单一模型5xx >= 3次 | L1 | 切换到同档位备用模型 | 自动恢复，间隔60s检查 |
| 全部云端模型不可用 | L2 | 启用简化Prompt + 本地模型 | 手动确认后恢复 |
| 本地模型也不可用 | L3 | 关闭非核心功能(涟漪/蒸馏) | 网络恢复后自动恢复 |
| Token预算超150% | L3 | 强制使用 cheapest 模型 | 追加预算后恢复 |
| 磁盘空间不足 | L4 | 只读模式，禁止新章节 | 清理空间后恢复 |
| 内存不足 | L4 | 只读模式 | 重启服务后恢复 |

---

## 12.9 成本控制系统详细设计

### 12.9.1 实时成本追踪的数据模型

#### 成本数据Schema

```sql
-- 调用级成本记录 (实时写入)
CREATE TABLE llm_call_costs (
    id              BIGSERIAL PRIMARY KEY,
    trace_id        UUID NOT NULL,
    span_id         UUID NOT NULL,

    -- 时间维度
    called_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    chapter_id      INTEGER REFERENCES chapters(id),
    volume_id       INTEGER REFERENCES volumes(id),
    project_id      INTEGER REFERENCES projects(id),

    -- 调用维度
    call_point      VARCHAR(64) NOT NULL,     -- 调用点标识
    engine          VARCHAR(32) NOT NULL,     -- 调用引擎
    model_tier      VARCHAR(16) NOT NULL,     -- heavy | light

    -- 模型维度
    provider        VARCHAR(32) NOT NULL,     -- deepseek | openai | anthropic...
    model_name      VARCHAR(64) NOT NULL,
    model_version   VARCHAR(32),

    -- Token维度
    tokens_input    INTEGER NOT NULL DEFAULT 0,
    tokens_output   INTEGER NOT NULL DEFAULT 0,
    tokens_cached   INTEGER NOT NULL DEFAULT 0,   -- 缓存命中token数
    tokens_total    INTEGER GENERATED ALWAYS AS
                    (tokens_input + tokens_output) STORED,

    -- 成本维度 (多币种)
    cost_usd        DECIMAL(10,6) NOT NULL,    -- 美元成本
    cost_cny        DECIMAL(10,6) NOT NULL,    -- 人民币成本
    cost_cached_usd DECIMAL(10,6) DEFAULT 0,   -- 缓存节省的美元
    cost_cached_cny DECIMAL(10,6) DEFAULT 0,   -- 缓存节省的人民币

    -- 效率维度
    cache_hit       BOOLEAN DEFAULT FALSE,
    is_emergency    BOOLEAN DEFAULT FALSE,     -- 是否紧急降级调用
    is_async        BOOLEAN DEFAULT FALSE,

    -- 质量维度
    latency_ms      INTEGER,
    quality_score   DECIMAL(3,2),
    retry_count     INTEGER DEFAULT 0,

    -- 状态
    status          VARCHAR(16) DEFAULT 'success',

    -- 索引优化
    CONSTRAINT valid_cost CHECK (cost_usd >= 0)
);

-- 聚合索引
CREATE INDEX idx_costs_project_time ON llm_call_costs(project_id, called_at);
CREATE INDEX idx_costs_chapter ON llm_call_costs(chapter_id, call_point);
CREATE INDEX idx_costs_provider ON llm_call_costs(provider, called_at);

-- 小时级聚合表 (定时任务生成)
CREATE TABLE cost_hourly_rollup (
    id              BIGSERIAL PRIMARY KEY,
    project_id      INTEGER NOT NULL,
    volume_id       INTEGER,
    hour_bucket     TIMESTAMPTZ NOT NULL,

    provider        VARCHAR(32) NOT NULL,
    model_name      VARCHAR(64) NOT NULL,
    call_point      VARCHAR(64) NOT NULL,
    model_tier      VARCHAR(16) NOT NULL,

    call_count      INTEGER NOT NULL DEFAULT 0,
    total_input_tokens  BIGINT NOT NULL DEFAULT 0,
    total_output_tokens BIGINT NOT NULL DEFAULT 0,
    total_cost_usd  DECIMAL(12,6) NOT NULL DEFAULT 0,
    total_cost_cny  DECIMAL(12,6) NOT NULL DEFAULT 0,
    cache_hit_count INTEGER NOT NULL DEFAULT 0,
    cache_saved_usd DECIMAL(12,6) NOT NULL DEFAULT 0,

    avg_latency_ms  INTEGER,
    avg_quality     DECIMAL(3,2),

    UNIQUE(project_id, hour_bucket, provider, model_name, call_point)
);

-- 项目预算表
CREATE TABLE project_budgets (
    id              BIGSERIAL PRIMARY KEY,
    project_id      INTEGER UNIQUE NOT NULL,

    -- 预算配置
    budget_cny      DECIMAL(10,2) NOT NULL,      -- 总预算(人民币)
    budget_usd      DECIMAL(10,2),               -- 总预算(美元)
    alert_threshold DECIMAL(3,2) DEFAULT 0.80,   -- 告警阈值(80%)
    emergency_threshold DECIMAL(3,2) DEFAULT 0.95, -- 紧急阈值(95%)

    -- 实际消耗
    spent_cny       DECIMAL(10,2) DEFAULT 0,
    spent_usd       DECIMAL(10,2) DEFAULT 0,
    last_updated    TIMESTAMPTZ DEFAULT NOW(),

    -- 状态
    status          VARCHAR(16) DEFAULT 'active',
                    -- active | warning | emergency | exceeded

    created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### 12.9.2 成本告警阈值配置

#### 多级告警系统

```yaml
cost_alerts:
  # 项目级告警
  project_level:
    - name: "预算预警"
      level: "warning"
      condition: "spent / budget >= 0.80"
      channels: ["in_app", "email"]
      cooldown: "24h"
      message: "项目预算已使用80%，剩余 ¥{remaining}"

    - name: "预算紧急"
      level: "critical"
      condition: "spent / budget >= 0.95"
      channels: ["in_app", "email", "sms"]
      cooldown: "6h"
      message: "项目预算已使用95%！系统将启用强制降级模式"
      auto_action: "enable_cost_first_routing"

    - name: "预算超限"
      level: "emergency"
      condition: "spent / budget >= 1.00"
      channels: ["in_app", "email", "sms"]
      cooldown: "1h"
      message: "项目预算已超限！已切换至最低成本模式"
      auto_action: "enable_emergency_mode"

  # 章节级告警
  chapter_level:
    - name: "章节成本偏高"
      level: "info"
      condition: "chapter_cost > avg_chapter_cost * 1.5"
      channels: ["in_app"]
      message: "本章Token消耗为平均值的{ratio}倍"

  # 模型级告警
  model_level:
    - name: "模型成本异常"
      level: "warning"
      condition: "model_cost_per_1k_tokens > baseline * 1.3"
      channels: ["in_app"]
      cooldown: "12h"
      message: "{model} 单位Token成本较基线上升{ratio}"

  # 实时告警
  real_time:
    - name: "突发高消耗"
      level: "warning"
      condition: "calls_in_5min > 20 AND cost_in_5min > ¥1"
      channels: ["in_app"]
      message: "5分钟内检测到高消耗调用模式"
```

### 12.9.3 月度/项目预算管理

#### 预算管理流程

```
[项目创建]
    |
    v
[设定预算上限] --> [推荐预算计算]
    |                    |
    |              基于: - 预估章节数
    |                    - 每章平均调用
    |                    - 模型选择
    |                    - 预留10-20%
    v
[预算审批] (作者确认)
    |
    v
[实时消耗追踪] <------ [每章结算]
    |                         |
    v                         v
[预算状态看板]          [自动报警]
    |                         |
    v                         v
[预算追加流程] <------ [预警通知]
    |
    v
[历史成本归档]
```

#### 项目预算模板

| 项目规模 | 预估章节数 | 每章Token | 推荐预算(DeepSeek为主) | 推荐预算(多云) |
|---|---|---|---|---|
| 短篇小说 (10万字) | 50章 | ~30K | ¥50-80 | ¥100-200 |
| 中篇小说 (50万字) | 200章 | ~30K | ¥200-350 | ¥500-800 |
| **长篇小说 (100万字)** | **500章** | **~30K** | **¥500-800** | **¥1200-2000** |
| 超长篇小说 (300万字) | 1200章 | ~30K | ¥1200-2000 | ¥3000-5000 |

### 12.9.4 成本优化策略

#### 四维度成本优化

```yaml
cost_optimization:
  # 1. 缓存优化 (预计节省30-50%)
  cache_optimization:
    enabled: true
    strategies:
      - name: "Prompt前缀缓存"
        description: "将系统Prompt和固定上下文放在请求开头以利用缓存"
        expected_savings: "20-30%"
      - name: "世界状态缓存"
        description: "相同世界状态下重复调用的结果缓存"
        expected_savings: "10-15%"
      - name: "摘要缓存"
        description: "已生成摘要的缓存复用"
        expected_savings: "5-10%"

  # 2. 批处理优化 (预计节省0-15%)
  batch_optimization:
    enabled: true
    strategies:
      - name: "并行调用合并"
        description: "将独立调用并行执行减少等待"
        expected_savings: "0% (时间节省)"
      - name: "质量评分并行"
        description: "3个质量维度并行评分"
        expected_savings: "0% (时间节省)"
      - name: "云端批处理API"
        description: "使用OpenAI/Anthropic Batch API(50%折扣)"
        expected_savings: "15-20% (仅限异步任务)"

  # 3. 模型降级优化 (预计节省40-60%)
  model_downgrade:
    enabled: true
    strategies:
      - name: "智能路由"
        description: "按任务复杂度选择最经济的模型"
        expected_savings: "30-40%"
      - name: "重型降级为轻型"
        description: "低复杂度重型任务降级处理"
        expected_savings: "10-15%"
      - name: "紧急降级链"
        description: "故障时自动降级到最经济模型"
        expected_savings: "仅在故障时生效"

  # 4. Token效率优化 (预计节省20-30%)
  token_efficiency:
    enabled: true
    strategies:
      - name: "智能上下文压缩"
        description: "自动移除低相关性上下文"
        expected_savings: "15-20%"
      - name: "输出Token限制"
        description: "设置合理的max_tokens避免浪费"
        expected_savings: "5-10%"
      - name: "Prompt压缩"
        description: "使用更精炼的Prompt表达"
        expected_savings: "5-10%"
```

### 12.9.5 成本报表生成

#### 报表类型

| 报表 | 频率 | 内容 | 受众 |
|---|---|---|---|
| **实时看板** | 实时 | 当前消耗、预算剩余、趋势 | 作者 |
| **章节成本报告** | 每章 | 该章Token消耗、成本明细 | 作者 |
| **日报** | 每日 | 日消耗、模型分布、优化效果 | 作者 |
| **周报** | 每周 | 周趋势、预算进度、异常分析 | 作者/管理员 |
| **项目决算** | 项目结束 | 总消耗、成本构成、优化成果 | 作者 |

#### 报表数据示例

```yaml
chapter_cost_report:
  chapter_id: 127
  chapter_title: "第127章：龙脊山脉的决战"

  summary:
    total_calls: 24
    total_input_tokens: 48500
    total_output_tokens: 8200
    total_cost_cny: "¥0.095"
    cache_hit_rate: "35%"
    cache_savings_cny: "¥0.018"

  breakdown_by_call_point:
    - call_point: "可能性清单可读描述"
      calls: 5
      input_tokens: 40000
      output_tokens: 5000
      cost_cny: "¥0.042"

    - call_point: "生成正文"
      calls: 1
      input_tokens: 12000
      output_tokens: 4000
      cost_cny: "¥0.028"

  breakdown_by_model:
    - model: "deepseek-v4-pro"
      calls: 8
      cost_cny: "¥0.068"
      percent: "72%"

    - model: "deepseek-v4-flash"
      calls: 16
      cost_cny: "¥0.027"
      percent: "28%"

  optimization_suggestions:
    - "本章可能性清单调用5次，建议检查是否可缓存部分结果"
    - "缓存命中率35%，低于项目平均50%，建议检查上下文稳定性"

  running_total:
    chapters_completed: 127
    total_cost_cny: "¥12.08"
    budget_remaining_cny: "¥187.92"
    budget_percent_used: "6.0%"
```

---

## 12.10 Prompt组装工程实现

### 12.10.1 模板引擎选择

#### 模板引擎对比

| 引擎 | 性能 | 功能丰富度 | 安全性 | 学习曲线 | 推荐度 | 选用理由 |
|---|---|---|---|---|---|---|
| **Handlebars** | 高 | 中 | 高（默认HTML转义） | 低 | **首选** | 语法简洁，安全性好，与JavaScript生态兼容 |
| Jinja2 | 中 | 高 | 中 | 中 | 备选 | Python原生，功能强大但过于复杂 |
| Mustache | 高 | 低 | 高 | 低 | 备选 | 逻辑极简，但不适合复杂条件 |
| 自定义引擎 | 极高 | 按需 | 极高 | 高 | 不推荐 | 维护成本高 |

**最终选型: Handlebars** (通过 `handlebars-rust` 或 `handlebars` Node.js 绑定)

#### Handlebars适配层

```typescript
// NarrativeOS Prompt模板引擎适配层
class PromptTemplateEngine {
    private engine: Handlebars;

    constructor() {
        this.engine = Handlebars.create();
        this.registerHelpers();
        this.registerSecurityPolicies();
    }

    // 注册NarrativeOS专用辅助函数
    private registerHelpers(): void {
        // 角色信息格式化
        this.engine.registerHelper('character_card', (character: Character) => {
            return `[${character.name}]\n` +
                   `身份: ${character.identity}\n` +
                   `性格: ${character.personality.join(', ')}\n` +
                   `当前状态: ${character.current_state}\n`;
        });

        // 上下文智能截断
        this.engine.registerHelper('truncated_context', (
            context: string,
            maxTokens: number
        ) => {
            return smartTruncate(context, maxTokens);
        });

        // 时间线格式化
        this.engine.registerHelper('timeline', (events: TimelineEvent[]) => {
            return events
                .sort((a, b) => a.timestamp - b.timestamp)
                .map(e => `- ${e.time}: ${e.description}`)
                .join('\n');
        });

        // 条件渲染辅助
        this.engine.registerHelper('if_emergency', function(options) {
            return isEmergencyMode() ? options.fn(this) : options.inverse(this);
        });
    }

    // 安全策略注册
    private registerSecurityPolicies(): void {
        // 强制HTML转义（防止Prompt注入）
        this.engine.registerHelper('safe', (value: string) => {
            // 标记为"已验证安全"，跳过转义
            return new Handlebars.SafeString(value);
        });
    }

    render(templateId: string, variables: TemplateVariables): RenderResult {
        const template = this.loadTemplate(templateId);
        const validatedVars = this.validateAndSanitize(variables);
        const rendered = template(validatedVars);
        const tokenCount = this.countTokens(rendered);

        return {
            rendered,
            tokenCount,
            templateId,
            version: this.getTemplateVersion(templateId),
        };
    }
}
```

### 12.10.2 变量注入的安全检查（防止Prompt注入攻击）

#### 安全过滤管道

```
[变量输入]
    |
    v
[类型检查] --> 类型不匹配? --> 类型转换或拒绝
    |
    v
[长度检查] --> 超限? --> 智能截断
    |
    v
[注入检测] --> 检测到注入? --> 清洗或拒绝
    |
    v
[特殊字符转义] --> 转义控制字符
    |
    v
[格式验证] --> 格式不匹配? --> 修正或拒绝
    |
    v
[安全输出]
```

#### 注入检测规则

```typescript
class PromptInjectionDetector {
    // 高风险模式（直接拒绝）
    HIGH_RISK_PATTERNS = [
        /ignore\s+(previous|above|earlier)/i,
        /forget\s+(your|the)\s+(instructions?|rules?|prompt)/i,
        /you\s+are\s+now\s+/i,
        /new\s+(instructions?|role|persona)/i,
        /system\s*:\s*/i,
        /\[system\]/i,
        /<system>/i,
        /\{\{system\}\}/i,
        /ignore\s+all\s+(prior|previous)/i,
        /disregard\s+(the|your)\s+instructions?/i,
    ];

    // 中风险模式（需要清洗）
    MEDIUM_RISK_PATTERNS = [
        /```\s*\w*\s*$/m,  // 未闭合的代码块
        /<\s*\w+[^>]*>$/,    // 未闭合的HTML标签
        /\{\{\s*\w+\s*$/,    // 未闭合的模板表达式
    ];

    // 清洗规则
    SANITIZATION_RULES = [
        { pattern: /[\x00-\x08\x0B\x0C\x0E-\x1F]/g, replacement: '' },
        { pattern: /\{\{/g, replacement: '&#123;&#123;' },
        { pattern: /\}\}/g, replacement: '&#125;&#125;' },
    ];

    detect(input: string): SecurityScanResult {
        const highRisk = this.HIGH_RISK_PATTERNS.some(p => p.test(input));
        const mediumRisk = this.MEDIUM_RISK_PATTERNS.some(p => p.test(input));

        if (highRisk) {
            return {
                level: 'blocked',
                action: 'reject',
                reason: '检测到高风险Prompt注入模式',
            };
        }

        if (mediumRisk) {
            return {
                level: 'suspicious',
                action: 'sanitize',
                sanitized: this.sanitize(input),
            };
        }

        return { level: 'safe', action: 'pass' };
    }

    sanitize(input: string): string {
        return this.SANITIZATION_RULES.reduce(
            (text, rule) => text.replace(rule.pattern, rule.replacement),
            input
        );
    }
}
```

#### 变量验证Schema示例

```typescript
const BriefPromptVariables = z.object({
    chapter_number: z.number().int().positive().max(9999),
    plot_arc: z.string().min(1).max(2000)
        .transform(s => sanitizeInput(s)),
    character_states: z.array(z.object({
        name: z.string().max(100),
        emotion: z.string().max(200),
        location: z.string().max(200),
    })).max(20),
    world_context: z.string().max(8000)
        .transform(s => sanitizeInput(s))
        .optional()
        .default(''),
    previous_chapter_summary: z.string().max(3000)
        .transform(s => sanitizeInput(s)),
});
```

### 12.10.3 上下文组装的质量保障

#### 相关性检查

```python
class ContextRelevanceChecker:
    """检查上下文片段与当前任务的相关性"""

    RELEVANCE_DIMENSIONS = [
        'temporal',      # 时间相关性（越近越相关）
        'character',     # 角色相关性（涉及相同角色）
        'location',      # 地点相关性
        'thematic',      # 主题相关性
        'causal',        # 因果相关性（前因后果）
    ]

    def score_relevance(
        self,
        context_segment: ContextSegment,
        current_task: TaskDescription
    ) -> RelevanceScore:
        scores = {}

        # 时间相关性: 距离当前章节越近越重要
        chapter_distance = abs(
            current_task.chapter_number - context_segment.source_chapter
        )
        scores['temporal'] = max(0, 1.0 - chapter_distance * 0.05)

        # 角色相关性: 共享角色数量
        shared_chars = set(current_task.characters) & set(context_segment.characters)
        scores['character'] = min(1.0, len(shared_chars) * 0.3)

        # 地点相关性
        scores['location'] = 1.0 if current_task.location == context_segment.location else 0.3

        # 主题相关性 (通过embedding相似度)
        scores['thematic'] = self.compute_embedding_similarity(
            current_task.theme_vector,
            context_segment.theme_vector
        )

        # 加权总分
        total_score = sum(
            scores[dim] * weight
            for dim, weight in self.RELEVANCE_WEIGHTS.items()
        )

        return RelevanceScore(
            dimensions=scores,
            total=total_score,
            threshold=self.RELEVANCE_THRESHOLD  # 低于阈值则过滤
        )
```

#### 去重策略

```python
class ContextDeduplicator:
    """上下文去重处理器"""

    def deduplicate(self, segments: list[ContextSegment]) -> list[ContextSegment]:
        """多层次去重"""
        # Layer 1: 精确去重 (完全相同的内容)
        unique = self._exact_dedup(segments)

        # Layer 2: 语义去重 (意思相同但表述不同)
        unique = self._semantic_dedup(unique, threshold=0.92)

        # Layer 3: 包含去重 (一个片段完全包含在另一个中)
        unique = self._containment_dedup(unique)

        return unique

    def _exact_dedup(self, segments: list[ContextSegment]) -> list[ContextSegment]:
        seen = set()
        result = []
        for seg in segments:
            content_hash = hash(seg.content.strip().lower())
            if content_hash not in seen:
                seen.add(content_hash)
                result.append(seg)
        return result

    def _semantic_dedup(
        self,
        segments: list[ContextSegment],
        threshold: float
    ) -> list[ContextSegment]:
        """使用embedding相似度去重"""
        if len(segments) <= 1:
            return segments

        embeddings = self.embedder.encode([s.content for s in segments])
        similarity_matrix = cosine_similarity(embeddings)

        to_remove = set()
        for i in range(len(segments)):
            if i in to_remove:
                continue
            for j in range(i + 1, len(segments)):
                if similarity_matrix[i][j] > threshold:
                    # 保留信息更丰富的那个
                    if len(segments[i].content) >= len(segments[j].content):
                        to_remove.add(j)
                    else:
                        to_remove.add(i)
                        break

        return [s for i, s in enumerate(segments) if i not in to_remove]
```

#### 智能截断策略

```python
class SmartTruncator:
    """基于相关性和重要性的智能截断"""

    def truncate_context(
        self,
        segments: list[ContextSegment],
        max_tokens: int,
        task_type: str
    ) -> list[ContextSegment]:
        """
        智能截断流程:
        1. 按相关性排序
        2. 保留高优先级段
        3. 对低优先级段进行压缩摘要
        4. 必要时完全丢弃最低优先级段
        """
        # 按优先级分组
        high = [s for s in segments if s.priority == 'high']
        medium = [s for s in segments if s.priority == 'medium']
        low = [s for s in segments if s.priority == 'low']

        result = []
        used_tokens = 0

        # 保留所有高优先级段
        for seg in high:
            if used_tokens + seg.token_count <= max_tokens:
                result.append(seg)
                used_tokens += seg.token_count

        # 对中优先级段进行尝试性保留
        for seg in medium:
            if used_tokens + seg.token_count <= max_tokens * 0.9:
                result.append(seg)
                used_tokens += seg.token_count
            else:
                # 尝试压缩
                compressed = self.compress_segment(seg, max_tokens - used_tokens)
                if compressed:
                    result.append(compressed)
                    used_tokens += compressed.token_count

        # 低优先级段只在有剩余空间时保留
        remaining = max_tokens - used_tokens
        if remaining > 500:
            for seg in low:
                summary = self.summarize_segment(seg, max_tokens=remaining // len(low))
                if summary:
                    result.append(summary)

        return result
```

### 12.10.4 输出解析的容错处理

#### 输出解析管道

```python
class OutputParser:
    """LLM输出解析器（带多层容错）"""

    def parse(self, raw_output: str, expected_format: str) -> ParseResult:
        """
        解析流程:
        1. 尝试标准解析
        2. 失败则尝试修复解析
        3. 再失败则尝试LLM辅助修复
        4. 最终失败返回部分结果 + 错误标记
        """
        # 第一层: 标准解析
        result = self._try_standard_parse(raw_output, expected_format)
        if result.success:
            return result

        # 第二层: 启发式修复
        result = self._try_heuristic_fix(raw_output, expected_format)
        if result.success:
            self.log_recovery("heuristic_fix", raw_output)
            return result

        # 第三层: LLM辅助修复（仅重型任务）
        if self.allow_llm_recovery:
            result = self._try_llm_recovery(raw_output, expected_format)
            if result.success:
                self.log_recovery("llm_recovery", raw_output)
                return result

        # 第四层: 返回最佳尽力结果
        return self._best_effort_parse(raw_output, expected_format)

    def _try_heuristic_fix(self, raw: str, fmt: str) -> ParseResult:
        """启发式修复常见格式错误"""
        fixes = [
            # 修复未闭合的JSON
            lambda s: s + '}' if s.count('{') > s.count('}') else s,
            # 修复多余的逗号
            lambda s: re.sub(r',(\s*[}\]])', r'\1', s),
            # 修复单引号JSON
            lambda s: s.replace("'", '"'),
            # 提取JSON块（从markdown代码块中）
            lambda s: re.search(r'```(?:json)?\s*(.*?)\s*```', s, re.DOTALL)
                      .group(1) if re.search(r'```', s) else s,
            # 修复缺失的引号
            lambda s: re.sub(r'([{,]\s*)(\w+)(\s*:)', r'\1"\2"\3', s),
        ]

        for fix in fixes:
            try:
                fixed = fix(raw)
                result = self._try_standard_parse(fixed, fmt)
                if result.success:
                    return result
            except Exception:
                continue

        return ParseResult(success=False)

    def _try_llm_recovery(self, raw: str, fmt: str) -> ParseResult:
        """使用LLM修复解析失败"""
        recovery_prompt = f"""
The following text was supposed to be valid {fmt} but failed to parse.
Please fix the formatting and return ONLY the corrected {fmt}.

Text to fix:
{raw[:2000]}

Return only the fixed {fmt}, no explanations.
"""
        # 使用轻型模型进行修复
        fixed = self.light_model_call(recovery_prompt, max_tokens=2000)
        return self._try_standard_parse(fixed, fmt)
```

---

## 12.11 完整成本模型（2025-2026年更新版）

### 12.11.1 各模型提供商最新定价

> **数据来源时间**: 2026年5月  
> **货币**: USD/M tokens (百万Token)，除非特别标注  
> **缓存价格**: 缓存写入/命中价格  

#### A. DeepSeek 定价

| 模型 | 输入 ($/M) | 缓存写入 ($/M) | 缓存命中 ($/M) | 输出 ($/M) | 上下文 | 备注 |
|---|---|---|---|---|---|---|
| **DeepSeek V4-Pro** | **$0.435** (75%折扣期) | — | **$0.003625** | **$0.87** | 1M | 折扣至2026-05-31 |
| DeepSeek V4-Pro (原价) | $1.74 | — | $0.0145 | $3.48 | 1M | 折扣期结束后 |
| **DeepSeek V4-Flash** | **$0.14** | — | **$0.0028** | **$0.28** | 1M | 日常主力 |

#### B. OpenAI 定价

| 模型 | 输入 ($/M) | 缓存命中 ($/M) | 输出 ($/M) | 上下文 | 适用场景 |
|---|---|---|---|---|---|
| **GPT-5.5** | $5.00 | $0.50 | $30.00 | 1M | 顶级推理 |
| **GPT-5.4** | $2.50 | $0.25 | $15.00 | 1M | 旗舰主力 |
| **GPT-5.4 mini** | $0.75 | $0.075 | $4.50 | 400K | 轻量任务 |
| **GPT-5.4 nano** | $0.20 | $0.02 | $1.25 | 128K | 超轻量 |
| GPT-5 | $1.25 | — | $10.00 | 400K | 上一代旗舰 |
| GPT-4o | $2.50 | — | $10.00 | 128K | 多模态 |
| GPT-4o mini | $0.15 | — | $0.60 | 128K | 经济型 |
| **Batch折扣** | **-50%** | — | **-50%** | — | 异步批处理 |

#### C. Anthropic Claude 定价

| 模型 | 输入 ($/M) | 缓存写入 ($/M) | 缓存命中 ($/M) | 输出 ($/M) | 上下文 | 适用场景 |
|---|---|---|---|---|---|---|
| **Claude Opus 4.7** | $5.00 | $6.25 | $0.50 | $25.00 | 1M | 顶级创意/推理 |
| Claude Opus 4.6 | $5.00 | $6.25 | $0.50 | $25.00 | 1M | 上一代旗舰 |
| **Claude Sonnet 4.6** | $3.00 | $3.75 | $0.30 | $15.00 | 1M | 平衡主力 |
| Claude Sonnet 4.5 | $3.00 | $3.75 | $0.30 | $15.00 | 200K/1M | 上一代 |
| **Claude Haiku 4.5** | $1.00 | $1.25 | $0.10 | $5.00 | 200K | 极速轻量 |
| Claude Haiku 3 | $0.25 | $0.30 | $0.03 | $1.25 | 200K | 经济型 |
| **Batch折扣** | **-50%** | — | — | **-50%** | — | 异步批处理 |

#### D. Google Gemini 定价

| 模型 | 输入 ($/M) | 缓存命中 ($/M) | 输出 ($/M) | 上下文 | 适用场景 |
|---|---|---|---|---|---|
| **Gemini 3.1 Pro** | $2.00 (<=200K) / $4.00 (>200K) | $0.125 | $12.00 / $18.00 | 1M | 旗舰 |
| **Gemini 2.5 Pro** | $1.25 (<=200K) / $2.50 (>200K) | $0.125 | $10.00 / $15.00 | 1M | 主力 |
| Gemini 2.5 Flash | $0.30 | — | $2.50 | 1M | 轻量 |
| **Gemini 2.5 Flash-Lite** | **$0.10** | — | **$0.40** | 1M | 超经济 |
| **Context Caching** | — | $0.125-$0.25 | — | — | 90%节省 |

#### E. 汇率与折扣说明

| 项目 | 数值 |
|---|---|
| USD-CNY汇率（参考） | 1 USD ≈ 7.2 CNY |
| DeepSeek缓存命中折扣 | 约98% (缓存命中几乎免费) |
| OpenAI缓存命中折扣 | 90% (输入价格x0.1) |
| Anthropic缓存命中折扣 | 90% (输入价格x0.1) |
| Google缓存命中折扣 | 90% (输入价格x0.1) |
| 批量API折扣 | 50% (OpenAI/Anthropic) |

### 12.11.2 不同使用场景的成本对比

#### 重型任务单调用成本对比

以"生成正文"调用为例: 12K input + 4K output

| 模型 | 输入成本 | 输出成本 | 单次总成本(USD) | 单次总成本(CNY) | 相对成本 |
|---|---|---|---|---|---|
| **DeepSeek V4-Pro** | **$0.00522** | **$0.00348** | **$0.00870** | **~¥0.063** | **100% (基线)** |
| DeepSeek V4-Flash | $0.00168 | $0.00112 | $0.00280 | ~¥0.020 | 32% |
| Claude Sonnet 4.6 | $0.03600 | $0.06000 | $0.09600 | ~¥0.691 | 1103% |
| Claude Opus 4.7 | $0.06000 | $0.10000 | $0.16000 | ~¥1.152 | 1839% |
| GPT-5.4 | $0.03000 | $0.06000 | $0.09000 | ~¥0.648 | 1034% |
| GPT-5.4 mini | $0.00900 | $0.01800 | $0.02700 | ~¥0.194 | 310% |
| Gemini 2.5 Pro | $0.01500 | $0.04000 | $0.05500 | ~¥0.396 | 632% |
| Gemini 3.1 Pro | $0.02400 | $0.04800 | $0.07200 | ~¥0.518 | 828% |

#### 轻型任务单调用成本对比

以"叙事价值评估"调用为例: 2K input + 300 output

| 模型 | 输入成本 | 输出成本 | 单次总成本(USD) | 单次总成本(CNY) | 相对成本 |
|---|---|---|---|---|---|
| **DeepSeek V4-Flash** | **$0.00028** | **$0.000084** | **$0.000364** | **~¥0.0026** | **100% (基线)** |
| Claude Haiku 4.5 | $0.00200 | $0.00150 | $0.00350 | ~¥0.025 | 962% |
| GPT-5.4 nano | $0.00040 | $0.000375 | $0.000775 | ~¥0.0056 | 213% |
| GPT-4o mini | $0.00030 | $0.00018 | $0.00048 | ~¥0.0035 | 132% |
| Gemini 2.5 Flash-Lite | $0.00020 | $0.00012 | $0.00032 | ~¥0.0023 | 88% |

### 12.11.3 100万字小说的总成本预估

#### 基本假设

| 参数 | 数值 | 说明 |
|---|---|---|
| 总字数 | 1,000,000字 | 中文 |
| 平均章节字数 | 3,000字 | 含正文 |
| 总章节数 | ~333章 | |
| 每章平均调用 | 25次 | 重型7次 + 轻型18次 |
| 重型调用平均Token | 10K in + 2K out | |
| 轻型调用平均Token | 3K in + 500 out | |
| 缓存命中率 | 35% | 保守估计 |
| 汇率 | 1 USD = 7.2 CNY | |

#### 方案A: DeepSeek全量方案（推荐）

| 项目 | 计算 | Token总量 | 成本(USD) | 成本(CNY) |
|---|---|---|---|---|
| 重型调用 | 333章 x 7次 x 12K in | 27.97M input | $12.16 | ¥87.55 |
| 重型输出 | 333章 x 7次 x 2K out | 4.66M output | $4.05 | ¥29.16 |
| 轻型调用 | 333章 x 18次 x 3K in | 17.98M input | $2.52 | ¥18.14 |
| 轻型输出 | 333章 x 18次 x 0.5K out | 3.00M output | $0.84 | ¥6.05 |
| **小计(无缓存)** | | **53.61M** | **$19.57** | **¥140.90** |
| 缓存节省(35%) | | -18.76M | -$4.50 | -¥32.40 |
| **总计** | | | **~$15.07** | **~¥108.50** |

#### 方案B: 多云混合方案（质量优先）

| 项目 | 计算 | 成本(USD) | 成本(CNY) |
|---|---|---|---|
| 重型: DeepSeek V4-Pro (60%) | 333 x 7 x 60% | $7.30 | ¥52.56 |
| 重型: Claude Sonnet 4.6 (30%) | 正文生成等关键任务 | $19.25 | ¥138.60 |
| 重型: GPT-5.4 (10%) | 备用 | $3.20 | ¥23.04 |
| 轻型: DeepSeek V4-Flash (70%) | 日常轻型 | $1.76 | ¥12.67 |
| 轻型: Claude Haiku 4.5 (20%) | 质量要求较高的轻型 | $12.96 | ¥93.31 |
| 轻型: GPT-4o mini (10%) | 备用 | $0.19 | ¥1.37 |
| 缓存节省(30%) | | -$13.37 | -¥96.26 |
| **总计** | | **~$31.29** | **~¥225.29** |

#### 方案C: 本地部署方案（数据敏感）

| 项目 | 计算 | 成本 |
|---|---|---|
| 硬件成本摊销 | A100 2台，3年摊销 | ~¥300/月 |
| 电力成本 | 2kW x 24h x 30天 | ~¥350/月 |
| 维护成本 | 人力分摊 | ~¥200/月 |
| 月度总成本 | | ~¥850/月 |
| **100万字项目(3个月)** | | **~¥2,550** |
| **每章成本** | | **~¥7.66** |

> 注: 本地部署适合数据敏感场景，单位成本较高但无API调用限制

### 12.11.4 成本优化后的预估

#### 优化措施效果

| 优化措施 | 预计节省 | 实际节省(方案A) |
|---|---|---|
| Prompt缓存(35%命中) | 30-50% | ~32% |
| 智能上下文压缩 | 15-20% | ~15% |
| 模型智能路由 | 10-20% | ~12% |
| 异步批处理 | 5-10% | ~8% |
| 精简Prompt设计 | 5-10% | ~5% |
| **合计优化** | | **~72%** |

#### 优化后成本

| 方案 | 优化前(CNY) | 优化后(CNY) | 每章成本 | 每千字成本 |
|---|---|---|---|---|
| **A: DeepSeek全量** | ¥140.90 | **~¥85-100** | **~¥0.27** | **~¥0.09** |
| B: 多云混合 | ¥300+ | ~¥150-180 | ~¥0.47 | ~¥0.16 |
| C: 本地部署 | ¥2,550 | ¥2,550 | ~¥7.66 | ~¥2.55 |

**结论**: 对于100万字长篇网文创作，使用DeepSeek全量方案+全套优化措施，**总成本可控制在 ¥85-100 之间**，每章成本约¥0.27，每千字约¥0.09，是极具性价比的选择。

---

## 12.12 响应质量监控

### 12.12.1 响应格式的自动验证

#### 输出Schema验证系统

```typescript
interface OutputValidator {
    // 验证输出是否符合预期格式
    validate(rawOutput: string, schema: OutputSchema): ValidationResult;
}

// 各调用点的输出Schema定义
const OUTPUT_SCHEMAS: Record<string, OutputSchema> = {
    'possibility_list': {
        type: 'json',
        required_fields: ['possibilities'],
        field_types: {
            'possibilities': 'array',
            'possibilities.*.description': 'string',
            'possibilities.*.probability': 'number',
            'possibilities.*.consequences': 'array',
        },
        constraints: {
            'possibilities.length': { min: 1, max: 10 },
            'possibilities.*.probability': { min: 0, max: 1 },
        },
    },

    'generate_brief': {
        type: 'json',
        required_fields: ['scene_description', 'plot_direction', 'character_actions'],
        field_types: {
            'scene_description': 'string',
            'plot_direction': 'string',
            'character_actions': 'array',
            'emotional_beats': 'array',
        },
        constraints: {
            'scene_description.length': { min: 50, max: 1000 },
            'character_actions.length': { min: 1, max: 20 },
        },
    },

    'generate_body': {
        type: 'markdown',
        required_elements: ['章节标题', '正文段落'],
        constraints: {
            'min_length': 1500,      // 最少1500字
            'max_length': 10000,     // 最多10000字
            'paragraph_count': { min: 3, max: 50 },
            'has_dialogue': true,    // 必须包含对话
        },
    },

    'quality_score': {
        type: 'json',
        required_fields: ['score', 'dimensions'],
        field_types: {
            'score': 'number',
            'dimensions.coherence': 'number',
            'dimensions.consistency': 'number',
            'dimensions.literary': 'number',
        },
        constraints: {
            'score': { min: 0, max: 100 },
            'dimensions.*': { min: 0, max: 100 },
        },
    },
};
```

### 12.12.2 质量异常检测

#### 异常检测规则引擎

```python
class QualityAnomalyDetector:
    """LLM输出质量异常检测器"""

    ANOMALY_RULES = {
        # 输出过短检测
        'output_too_short': {
            'description': '输出长度远低于预期',
            'check': lambda output, ctx: len(output) < ctx.expected_length * 0.5,
            'severity': 'high',
            'action': 'retry',
        },

        # 输出过长检测
        'output_too_long': {
            'description': '输出长度远超预期',
            'check': lambda output, ctx: len(output) > ctx.expected_length * 2,
            'severity': 'medium',
            'action': 'truncate_and_warn',
        },

        # 格式错误检测
        'format_error': {
            'description': '输出不符合预期格式',
            'check': lambda output, ctx: not ctx.schema.validate(output).valid,
            'severity': 'critical',
            'action': 'retry_with_recovery',
        },

        # 内容偏离检测
        'content_drift': {
            'description': '输出内容与预期主题偏离',
            'check': self.check_content_drift,
            'severity': 'high',
            'action': 'retry',
        },

        # 重复内容检测
        'repetition': {
            'description': '输出中存在大量重复',
            'check': lambda output, ctx: self.detect_repetition(output) > 0.3,
            'severity': 'medium',
            'action': 'retry',
        },

        # 语言混杂检测
        'language_mix': {
            'description': '输出中混杂多种语言',
            'check': lambda output, ctx: self.detect_language_mix(output),
            'severity': 'medium',
            'action': 'retry',
        },

        # 拒绝回答检测
        'refusal': {
            'description': '模型拒绝生成内容',
            'check': lambda output, ctx: self.detect_refusal(output),
            'severity': 'critical',
            'action': 'retry_with_different_model',
        },

        # 低质量标记检测
        'low_quality_markers': {
            'description': '输出包含低质量标记',
            'check': lambda output, ctx: self.detect_quality_markers(output),
            'severity': 'medium',
            'action': 'retry',
        },
    }

    def detect_repetition(self, text: str) -> float:
        """检测文本重复率 (0-1)"""
        lines = text.split('\n')
        if len(lines) < 3:
            return 0.0

        # 检测连续重复
        repeated = sum(1 for i in range(len(lines)-1)
                      if lines[i] == lines[i+1])

        # 检测n-gram重复
        words = text.split()
        ngrams = Counter(tuple(words[i:i+4]) for i in range(len(words)-3))
        most_common = ngrams.most_common(1)
        ngram_repeat_ratio = most_common[0][1] / len(words) if most_common else 0

        return max(repeated / len(lines), ngram_repeat_ratio)

    def detect_content_drift(
        self,
        output: str,
        expected_topics: list[str]
    ) -> bool:
        """检测内容是否偏离预期主题"""
        output_embedding = self.embedder.encode(output)
        topic_embeddings = [self.embedder.encode(t) for t in expected_topics]

        similarities = [
            cosine_similarity(output_embedding, te)
            for te in topic_embeddings
        ]

        # 如果与所有预期主题的相似度都低于阈值，认为偏离
        return all(s < 0.4 for s in similarities)

    def detect_refusal(self, output: str) -> bool:
        """检测模型是否拒绝回答"""
        refusal_patterns = [
            r"i('m| am) sorry",
            r"i cannot",
            r"i can't",
            r"i'm unable to",
            r"i apologize",
            r"as an ai",
            r"i cannot fulfill",
            r"抱歉",
            r"对不起",
            r"我无法",
            r"我不能",
        ]
        output_lower = output.lower()[:500]  # 只检查开头
        return any(re.search(p, output_lower) for p in refusal_patterns)
```

### 12.12.3 自动重试条件

#### 重试策略配置

```yaml
retry_policies:
  # 按异常类型配置重试
  by_anomaly_type:
    output_too_short:
      max_retries: 2
      backoff: exponential
      base_delay: 2s
      temperature_increase: 0.1    # 每次重试温度+0.1
      model_switch: true           # 允许切换模型

    format_error:
      max_retries: 3
      backoff: linear
      base_delay: 1s
      use_recovery_parser: true    # 使用修复解析器
      model_switch: true

    content_drift:
      max_retries: 2
      backoff: fixed
      base_delay: 3s
      temperature_decrease: 0.1    # 降低温度以增加一致性
      model_switch: false

    repetition:
      max_retries: 2
      backoff: exponential
      base_delay: 1s
      temperature_increase: 0.2    # 提高温度增加多样性
      model_switch: true

    refusal:
      max_retries: 1
      model_switch: true
      switch_to_model: "claude-sonnet-4.6"  # 切换到更合作的模型

  # 全局重试限制
  global_limits:
    max_retries_per_call: 3
    max_retries_per_chapter: 10
    max_model_switches: 2
    circuit_breaker_threshold: 5    # 连续5次失败触发熔断

  # 熔断器配置
  circuit_breaker:
    failure_threshold: 5
    recovery_timeout: 60s
    half_open_max_calls: 2
```

### 12.12.4 质量趋势报告

#### 质量监控Dashboard

| 指标 | 类型 | 计算方式 | 告警阈值 |
|---|---|---|---|
| 章节平均质量评分 | Gauge | 3个维度加权平均 | < 60分 |
| 格式验证通过率 | Gauge | 成功验证/总调用 | < 95% |
| 异常检测触发率 | Gauge | 异常调用/总调用 | > 10% |
| 平均重试次数 | Gauge | 总重试/总调用 | > 0.5 |
| 模型切换频率 | Gauge | 切换次数/总调用 | > 5% |
| 内容偏离率 | Gauge | 偏离检测/总调用 | > 5% |
| 拒绝回答率 | Gauge | 拒绝/总调用 | > 1% |
| P50输出长度 | Gauge | 中位数长度 | 偏离基线30% |
| 缓存命中率 | Gauge | 命中/总调用 | < 30% |

#### 质量趋势周报模板

```yaml
quality_weekly_report:
  period: "2026-04-28 至 2026-05-05"
  project: "novel_2026_dragons"

  summary:
    chapters_completed: 23
    total_llm_calls: 575
    avg_quality_score: 78.5
    format_validation_rate: "98.2%"
    anomaly_trigger_rate: "4.5%"
    avg_retry_count: 0.23

  quality_trend:
    - dimension: "叙事连贯性"
      current_week: 82.1
      previous_week: 80.5
      trend: "+1.6"
    - dimension: "角色一致性"
      current_week: 75.3
      previous_week: 76.8
      trend: "-1.5"
      note: "角色一致性下降，建议检查角色设定Prompt"
    - dimension: "文学质量"
      current_week: 78.1
      previous_week: 77.9
      trend: "+0.2"

  anomaly_breakdown:
    - type: "format_error"
      count: 12
      percentage: "2.1%"
      most_affected: "生成Brief"
    - type: "output_too_short"
      count: 8
      percentage: "1.4%"
      most_affected: "生成正文"
    - type: "repetition"
      count: 6
      percentage: "1.0%"
      most_affected: "可能性叙事增强"

  recommendations:
    - "角色一致性评分下降，建议review character_states Prompt模板"
    - "生成Brief的格式错误率偏高，建议加强输出格式约束"
    - "整体质量趋势良好，叙事连贯性持续改善"

  model_performance:
    - model: "deepseek-v4-pro"
      calls: 161
      avg_quality: 79.2
      avg_latency: 3.2s
      cost_per_call: "$0.008"
    - model: "deepseek-v4-flash"
      calls: 414
      avg_quality: 76.1
      avg_latency: 1.1s
      cost_per_call: "$0.0005"
```

---

## 附录

### 附录A: 调用节点参数速查表

| 调用点 | 推荐模型 | 温度 | max_tokens | 超时 | 重试 |
|---|---|---|---|---|---|
| 可能性清单可读描述 | V4-Pro | 0.8 | 2000 | 15s | 2 |
| 可能性叙事增强 | V4-Pro | 0.8 | 2000 | 15s | 2 |
| NPC意图推断 | V4-Flash | 0.5 | 1000 | 10s | 2 |
| 场景感知叙事化 | V4-Flash | 0.5 | 1500 | 10s | 2 |
| 涟漪叙事后果 | V4-Flash | 0.5 | 1000 | 30s | 1(异步) |
| 核聚变叙事解释 | V4-Pro | 0.5 | 3000 | 30s | 2 |
| 世界时间叙事评估 | V4-Pro | 0.5 | 5000 | 45s | 2 |
| 叙事价值评估 | V4-Flash | 0.3 | 500 | 8s | 2 |
| 生成Brief | V4-Pro | 0.5 | 3000 | 20s | 3 |
| 生成正文 | V4-Pro | 0.8 | 8000 | 60s | 3 |
| 修改正文 | V4-Pro | 0.3 | 8000 | 60s | 3 |
| 质量评分 | V4-Flash | 0.1 | 300 | 8s | 2 |
| 谏官风险分析 | V4-Flash | 0.3 | 1000 | 10s | 2 |
| 谏官策略生成 | V4-Flash | 0.5 | 1500 | 10s | 2 |
| 召回语生成 | V4-Flash | 0.8 | 1000 | 8s | 1 |
| 固化信息提取 | V4-Flash | 0.1 | 1500 | 10s | 2 |
| 章节摘要生成 | V4-Flash | 0.3 | 1000 | 10s | 2 |
| AMA风格蒸馏 | V4-Pro/Claude | 0.3 | 5000 | 45s | 2 |
| 代价共情化 | V4-Pro/Claude | 0.5 | 3000 | 20s | 2 |

### 附录B: API错误码映射

| 错误码 | 说明 | 重试策略 | 降级动作 |
|---|---|---|---|
| 429 | 速率限制 | 指数退避(1s,2s,4s,8s) | 切换Key/模型 |
| 500 | 服务器内部错误 | 3次重试，间隔2s | 切换模型 |
| 502 | 网关错误 | 3次重试，间隔3s | 切换提供商 |
| 503 | 服务不可用 | 5次重试，间隔5s | 启用本地模型 |
| 504 | 网关超时 | 2次重试，间隔10s | 切换模型 |
| 400 | 请求格式错误 | 不重试 | 修复请求参数 |
| 401 | API Key无效 | 不重试 | 切换Key |
| 403 | 权限不足/内容过滤 | 不重试 | 返回错误给作者 |
| 408 | 请求超时 | 2次重试 | 增加超时时间 |
| 413 | 请求体过大 | 不重试 | 截断上下文 |

### 附录C: 配置文件示例

```yaml
# narrativeos-llm-config.yaml
llm_integration:
  version: "3.0"

  # 模型路由配置
  routing:
    default_strategy: "balanced"
    providers:
      deepseek:
        enabled: true
        base_url: "https://api.deepseek.com"
        models:
          - name: "deepseek-v4-pro"
            tier: "heavy"
            priority: 1
          - name: "deepseek-v4-flash"
            tier: "light"
            priority: 1
        api_keys:
          - key: "${DEEPSEEK_KEY_1}"
            quota_limit: 100000000    # 100M tokens
          - key: "${DEEPSEEK_KEY_2}"
            quota_limit: 50000000

      anthropic:
        enabled: true
        base_url: "https://api.anthropic.com"
        models:
          - name: "claude-sonnet-4.6"
            tier: "heavy"
            priority: 2
          - name: "claude-haiku-4.5"
            tier: "light"
            priority: 2

      openai:
        enabled: true
        base_url: "https://api.openai.com"
        models:
          - name: "gpt-5.4"
            tier: "heavy"
            priority: 3
          - name: "gpt-5.4-nano"
            tier: "light"
            priority: 3

    fallback_chain:
      heavy: ["deepseek-v4-pro", "claude-sonnet-4.6", "gpt-5.4", "deepseek-v4-flash"]
      light: ["deepseek-v4-flash", "claude-haiku-4.5", "gpt-5.4-nano", "gpt-4o-mini"]

  # Token预算
  token_budget:
    project_budget_cny: 500
    alert_threshold: 0.80
    emergency_threshold: 0.95
    chapter_base_input: 50000
    chapter_base_output: 10000

  # 缓存配置
  cache:
    l1_ttl: 60
    l2_ttl: 300
    l3_ttl: 604800
    max_l1_size: 1000
    max_l2_size: 100000

  # 降级配置
  degradation:
    health_check_interval: 30
    recovery_check_interval: 60
    timeout_heavy: 30
    timeout_light: 10
    emergency_prompt_reduction: 0.65

  # 质量监控
  quality:
    anomaly_check_enabled: true
    auto_retry_enabled: true
    max_retries: 3
    circuit_breaker_threshold: 5

  # 成本追踪
  cost_tracking:
    enabled: true
    granularity: "per_call"    # per_call | hourly | daily
    report_frequency: "daily"
```

### 附录D: 版本变更记录

| 版本 | 日期 | 变更内容 | 作者 |
|---|---|---|---|
| 3.0.0 | 2026-05-01 | 初始版本，完整重写第十二章 | 系统架构组 |
| 3.0.1 | 2026-05-15 | 更新DeepSeek V4定价(折扣期) | 系统架构组 |
| 3.0.2 | 2026-05-20 | 补充Gemini 3.1 Pro定价 | 系统架构组 |

---

> **文档结束**  
> NarrativeOS v3.0 Sovereign — LLM集成策略与Prompt组装系统设计  
> 本文档为系统内部设计文档，仅供开发团队参考
