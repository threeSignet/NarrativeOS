# 第九章 谏官、Flow Guardian 与质量系统（完整设计）

> **文档版本**: v3.0-Sovereign-RC1  
> **适用范围**: 100万字以上长篇网文创作的作者增强系统  
> **设计原则**: 仅谏言、不代笔；仅提醒、不执行；策由官出、裁决在作者  

---

## 9.1 谏官系统（Counselor）

### 9.1.0 系统定位

谏官是 NarrativeOS v3.0 的核心质量感知模块，采用**规则引擎 + LLM 混合检查**架构，对创作内容进行多维度实时诊断。其核心职责包括：战力体系监控、人设一致性维护、伏笔追踪、节奏控制、套路检测、水文识别、预期违背评估及特殊能力合规性审查。

谏官遵循"**三策输出、作者裁决**"原则——每条问题均提供三种及以上解决方案，由作者最终决定采纳与否。系统不直接修改文本，只提供诊断与建议。

---

### 9.1.1 核心架构

```
                    ┌─────────────────────────────────────────┐
                    │          谏官主控引擎 (Counselor Core)    │
                    └─────────────────┬───────────────────────┘
                                      │
          ┌───────────────────────────┼───────────────────────────┐
          │                           │                           │
    ┌─────▼─────┐             ┌───────▼───────┐         ┌────────▼──────┐
    │  规则引擎   │             │   LLM 检查器   │         │   混合检查器   │
    │  (Rule)   │             │  (LLM Judge)  │         │  (Hybrid)    │
    └─────┬─────┘             └───────┬───────┘         └────────┬──────┘
          │                           │                           │
          └───────────────────────────┼───────────────────────────┘
                                      │
                    ┌─────────────────▼──────────────────┐
                    │      综合评估与策生成引擎            │
                    │  (Synthesis & Strategy Generator)  │
                    └─────────────────┬──────────────────┘
                                      │
                    ┌─────────────────▼──────────────────┐
                    │         谏官报告输出                 │
                    │    (Counselor Report JSON)         │
                    └────────────────────────────────────┘
```

**管线类型**：
- **独立检查项**：可并行执行（无依赖关系）
- **依赖检查项**：需串行执行（前置检查项的结果影响后续检查）
- **混合检查项**：规则引擎预筛选 + LLM 深度分析

---

### 9.1.2 完整检查项清单（20+ 项）

#### 检查项 C01：战力体系一致性

| 属性 | 详情 |
|------|------|
| **检查名称** | 战力体系一致性检查 (Power_System_Consistency) |
| **检查类型** | 混合检查（规则 + LLM） |
| **触发条件** | 新章节提交时自动触发；涉及战斗场景、境界突破、能力使用时强制触发 |
| **严重程度** | CRITICAL（境界跳跃）/ WARNING（越级战斗）/ INFO（战力微调） |

**规则检查层**：
```python
RULE_POWER_CHECK = {
    "pattern": {
        "realm_jump": r"(?:突破|晋升|达到|踏入)\s*(.+?)(?:境|层|阶|重)",
        "combat_result": r"(?:击败|击杀|战胜|碾压|秒杀)\s*(.+?)",
        "ability_usage": r"(?:使用|施展|祭出|催动)\s*(.+?)(?:术|法|技|招)",
        "power_level": r"(?:筑基|金丹|元婴|化神|合体|大乘|渡劫|天仙|金仙|太乙|大罗|准圣|圣人)",
    },
    "validation_rules": [
        "境界跳跃间隔 >= 设定最小间隔章节数",
        "越级挑战等级差 <= 设定最大等级差",
        "能力使用消耗 ∈ [已设定消耗范围]",
        "连续战斗胜率异常波动检测 (滑动窗口方差)",
    ]
}
```

**LLM 检查层 Prompt 模板**：
```
【角色设定】你是 NarrativeOS 谏官系统的战力审计官，专精于网文战力体系的合理性评估。

【输入信息】
- 当前章节内容：{chapter_text}
- 角色战力档案：{character_power_profile}  # 包含当前境界、已掌握能力、历史战斗记录
- 战力体系设定：{power_system_rules}      # 境界划分、升级规则、能力代价体系
- 前序相关章节摘要：{previous_context}    # 最近5章中涉及战力变化的摘要

【审计任务】
1. 识别本章中所有战力相关事件（突破、战斗、能力使用、道具使用）
2. 对比角色档案，判断是否存在以下异常：
   a. 境界跳跃：是否无铺垫/无代价/跳跃幅度过大
   b. 越级挑战：挑战等级差是否合理，是否有前置条件支撑
   c. 能力滥用：同一能力在短时间内使用次数是否超限
   d. 代价忽视：使用强力能力后是否忽略了应有的代价/虚弱期
   e. 战力通胀：本章战力表现是否显著高于/低于角色应有水平
3. 对每项异常给出严重程度和具体文本位置

【输出格式】
JSON数组，每项包含：
{
  "event_type": "realm_jump|combat|ability_usage|cost_ignore|power_inflation",
  "severity": "INFO|WARNING|CRITICAL",
  "location": "章节段落摘要或行号范围",
  "description": "问题描述",
  "expected": "按照设定应有的表现",
  "actual": "实际文本中的表现",
  "context_evidence": ["支撑判断的文本片段"]
}
```

**输出格式示例**：
```json
{
  "check_id": "C01",
  "check_name": "战力体系一致性",
  "results": [
    {
      "event_type": "realm_jump",
      "severity": "CRITICAL",
      "location": "第1234章 第3段",
      "description": "主角从金丹后期直接突破至元婴中期，跨越了一个完整的大境界",
      "expected": "金丹后期→元婴初期，且需有至少3章的铺垫（天材地宝、心境突破、雷劫准备）",
      "actual": "战斗中临时突破至元婴中期，无任何铺垫",
      "context_evidence": ["他感受到体内金丹碎裂，一股浩瀚力量涌出..."]
    }
  ],
  "summary": "发现1处CRITICAL：境界跳跃违规"
}
```

---

#### 检查项 C02：人设一致性

| 属性 | 详情 |
|------|------|
| **检查名称** | 人设一致性检查 (Character_Consistency) |
| **检查类型** | LLM 检查 |
| **触发条件** | 所有角色行为/对话/心理描写均触发；核心角色行为加权；高重要性场景（决策、冲突）强制触发 |
| **严重程度** | CRITICAL（核心人设崩塌）/ WARNING（行为偏差）/ INFO（细微波动） |

**LLM Prompt 模板**：
```
【角色设定】你是 NarrativeOS 谏官系统的人设审计官，负责检测角色行为是否符合已建立的性格档案。

【输入信息】
- 当前章节内容：{chapter_text}
- 角色档案库：{character_profiles}  # 每个角色包含：
  #   - core_traits: 核心性格标签（3-5个）
  #   - trait_definitions: 每个标签的定义和行为表现
  #   - historical_decisions: 历史关键决策及决策逻辑
  #   - forbidden_actions: 该角色绝对不会做的事
  #   - speech_patterns: 语言风格特征
  #   - emotional_triggers: 情绪触发点和反应模式
  #   - growth_arc: 角色成长弧线规划
- 涉及角色列表：{characters_in_chapter}
- 场景重要性评级：{scene_importance}  # 1-10

【审计任务】
1. 提取本章中每个角色的所有行为、决策、对话、心理活动
2. 逐一比对角色档案，评估一致性：
   a. 核心性格匹配度：行为是否与 core_traits 一致
   b. 决策逻辑链：决策是否有合理的动机链条
   c. 禁忌检查：是否触发了 forbidden_actions
   d. 语言风格匹配：对话是否符合 speech_patterns
   e. 情绪反应合理性：情绪反应是否符合 emotional_triggers
   f. 成长弧线偏差：行为是否偏离 growth_arc 的合理范围
3. 对核心角色（主角、关键配角）进行深度分析
4. 区分"合理成长"与"人设崩塌"——成长需有轨迹，崩塌是无迹可寻的突变

【一致性评分标准】
- 95-100: 完全 consistent，甚至深化了人设
- 85-94:  基本 consistent，有细微可优化之处
- 70-84:  存在偏差，需要评估是否属于合理成长
- 50-69:  明显偏差，可能人设受损
- 0-49:   严重偏差，人设崩塌风险

【输出格式】
{
  "character_analysis": [
    {
      "character_name": "角色名",
      "consistency_score": 0-100,
      "actions_checked": [
        {
          "action": "行为描述",
          "location": "位置",
          "expected_behavior": "基于人设预期的行为",
          "actual_behavior": "实际行为",
          "deviation_degree": "none|minor|moderate|severe",
          "explanation": "偏差原因分析，需区分合理成长与人设崩塌"
        }
      ],
      "forbidden_violations": [],
      "growth_assessment": "on_track|accelerated|stalled|regressed"
    }
  ],
  "overall_consistency": "consistent|minor_deviation|warning|critical"
}
```

---

#### 检查项 C03：伏笔追踪与回收

| 属性 | 详情 |
|------|------|
| **检查名称** | 伏笔追踪检查 (Foreshadowing_Tracker) |
| **检查类型** | 混合检查（规则 + LLM） |
| **触发条件** | 新章节提交时自动检查所有活跃伏笔状态；检测到回收信号（关键词/场景匹配）时深度分析 |
| **严重程度** | CRITICAL（关键伏笔遗忘）/ WARNING（伏笔回收质量差）/ INFO（新伏笔埋设建议） |

**规则检查层——伏笔生命周期管理**：
```python
FORESHADOWING_LIFECYCLE = {
    "states": ["PLANTED", "ACTIVATED", "RECOVERED", "EXPIRED", "FORGOTTEN"],
    "state_transitions": {
        "PLANTED": ["ACTIVATED", "EXPIRED"],
        "ACTIVATED": ["RECOVERED", "FORGOTTEN"],
        "RECOVERED": [],        # 终态
        "EXPIRED": ["FORGOTTEN"],
        "FORGOTTEN": ["RECOVERED"],  # 紧急回收
    },
    "auto_trigger_rules": {
        "PLANTED→ACTIVATED": "检测到与伏笔关键词高度匹配的文本片段",
        "ACTIVATED→RECOVERED": "LLM判定本章内容构成伏笔回收",
        "EXPIRED→FORGOTTEN": "超过最大允许回收章节数仍未回收",
    },
    "deadline_rules": {
        "critical_foreshadowing": {"max_chapters": 50, "alert_chapters": 30},
        "major_foreshadowing": {"max_chapters": 100, "alert_chapters": 60},
        "minor_foreshadowing": {"max_chapters": 200, "alert_chapters": 120},
        "running_gag": {"max_chapters": 500, "alert_chapters": 300},
    }
}
```

**LLM Prompt 模板（回收质量评估）**：
```
【角色设定】你是 NarrativeOS 谏官系统的伏笔审计官，负责追踪伏笔生命周期并评估回收质量。

【输入信息】
- 当前章节内容：{chapter_text}
- 活跃伏笔清单：{active_foreshadowings}  # 每项包含：
  #   - fs_id: 伏笔ID
  #   - original_text: 原始埋设文本
  #   - chapter_planted: 埋设章节
  #   - description: 伏笔描述
  #   - expected_recovery_type: 预期回收方式（直接回收/间接呼应/反转回收）
  #   - importance: critical|major|minor
  #   - status: PLANTED|ACTIVATED
  #   - chapters_elapsed: 已过章节数
  #   - deadline_chapter: 最晚回收章节
- 本章疑似回收匹配：{potential_matches}  # 规则引擎匹配的候选

【审计任务】
1. 对每条活跃伏笔，判断本章是否构成回收
2. 对确认为回收的伏笔，评估回收质量（1-10分）：
   a. 呼应自然度：回收是否与埋设自然呼应，不生硬
   b. 读者记忆唤醒：是否有效唤醒读者对伏笔的记忆
   c. 情感冲击力：回收是否带来预期的情感效果
   d. 逻辑自洽：回收是否与整体逻辑一致
   e. 超预期程度：是否有额外的惊喜层
3. 对临近 deadline 的未回收伏笔发出警告
4. 对过期伏笔标记为遗忘风险

【输出格式】
{
  "recovery_events": [
    {
      "fs_id": "伏笔ID",
      "recovered": true|false,
      "recovery_location": "位置",
      "recovery_quality_score": 1-10,
      "quality_breakdown": {
        "naturalness": 1-10,
        "memory_recall": 1-10,
        "emotional_impact": 1-10,
        "logical_coherence": 1-10,
        "surprise_bonus": 1-10
      },
      "assessment": "优秀/良好/合格/需改进/失败",
      "reader_predictability": "预计读者预期程度"
    }
  ],
  "alerts": [
    {
      "fs_id": "伏笔ID",
      "alert_type": "approaching_deadline|deadline_exceeded|forgotten_risk",
      "chapters_remaining": "距离deadline的章节数",
      "severity": "WARNING|CRITICAL"
    }
  ],
  "new_suggestions": [
    {
      "suggestion": "建议本章新埋设的伏笔",
      "target_recovery": "预期回收章节范围",
      "rationale": "建议理由"
    }
  ]
}
```

---

#### 检查项 C04：节奏控制

| 属性 | 详情 |
|------|------|
| **检查名称** | 节奏控制检查 (Pacing_Control) |
| **检查类型** | 混合检查（规则 + LLM） |
| **触发条件** | 每章必检；节奏异常波动（与前章差异>阈值）时深度分析 |
| **严重程度** | WARNING（节奏拖沓/过快）/ INFO（节奏微调建议） |

**规则检查层——节奏曲线量化**：
```python
PACING_METRICS = {
    "chapter_level": {
        "scene_transition_density": "场景切换次数 / 章节字数 * 1000",
        "dialogue_ratio": "对话字数 / 总字数",
        "action_ratio": "动作描写字数 / 总字数",
        "description_ratio": "环境/心理描写字数 / 总字数",
        "tension_score": "基于关键词的情感极性分析得分",
        "cliffhanger_strength": "结尾悬念强度评分（基于句法模式）",
    },
    "satisfaction_points": {
        "sp_density": "爽点数量 / 章节字数 * 10000",
        "sp_types": ["升级爽点", "打脸爽点", " reveal爽点", "情感爽点", "战斗爽点"],
        "sp_timing": "爽点出现位置分布（开头/中点/结尾的黄金比例）",
        "sp_cumulative": "连续章节爽点累积曲线",
    },
    "rhythm_patterns": {
        "expected_curve": "起承转合标准曲线",
        "actual_curve": "本章实际节奏曲线",
        "deviation_score": "两条曲线的加权欧氏距离",
    }
}
```

**LLM Prompt 模板**：
```
【角色设定】你是 NarrativeOS 谏官系统的节奏审计官，负责评估章节节奏曲线和爽点分布。

【输入信息】
- 当前章节内容：{chapter_text}
- 节奏指标数据：{pacing_metrics}  # 规则引擎计算的各项指标
- 同类型章节基准：{baseline_same_type}  # 战斗章/日常章/过渡章的基准数据
- 前序章节节奏曲线：{previous_pacing_curve}  # 最近10章

【审计任务】
1. 评估本章整体节奏是否符合"起承转合"预期：
   - 开头（0-15%）：是否有钩子，能否抓住读者
   - 发展（15-60%）：信息推进是否有层次，是否有足够的张力维持
   - 转折（60-85%）：是否有节奏加速，是否有情绪高潮
   - 结尾（85-100%）：是否有有效收尾或悬念钩子
2. 爽点分布评估：
   - 本章爽点数量和类型是否合理
   - 爽点位置是否最优
   - 爽点质量（是否有铺垫、是否有反差、是否有情感共鸣）
3. 与同类章节的对比：本章节奏是偏快还是偏慢
4. 连续章节节奏多样性：是否避免连续多章节奏雷同

【输出格式】
{
  "overall_pacing": "fast|balanced|slow|uneven",
  "curve_assessment": {
    "phase_scores": {"hook": 1-10, "development": 1-10, "turning": 1-10, "ending": 1-10},
    "curve_match_score": 1-10,
    "issues": ["节奏问题列表"]
  },
  "satisfaction_points": {
    "count": 爽点数量,
    "types": [爽点类型列表],
    "quality_score": 1-10,
    "optimal_placement": true|false,
    "recommendations": ["爽点优化建议"]
  },
  "comparison": {
    "vs_baseline": "above|on_par|below",
    "vs_previous": "accelerated|maintained|decelerated",
    "diversity_score": 1-10
  }
}
```

---

#### 检查项 C05：套路检测与反套路评估

| 属性 | 详情 |
|------|------|
| **检查名称** | 套路检测检查 (Trope_Detection) |
| **检查类型** | LLM 检查 |
| **触发条件** | 每章必检；检测到高概率套路时标记；关键场景（大高潮、重大转折）强制深度分析 |
| **严重程度** | WARNING（俗套套路）/ INFO（套路使用建议） |

**LLM Prompt 模板**：
```
【角色设定】你是 NarrativeOS 谏官系统的套路审计官，专精于网文套路的识别与反套路创新评估。

【输入信息】
- 当前章节内容：{chapter_text}
- 本章场景类型：{scene_type}  # 战斗/修炼/社交/揭秘/情感/探险
- 已知套路库匹配：{trope_matches}  # 规则引擎的初步匹配结果
- 同 genre 热门套路排行：{popular_tropes}  # 当前 genre 最常见套路

【审计任务】
1. 套路识别：
   a. 识别本章使用的所有套路（显性套路和隐性套路）
   b. 对每条套路标记使用频率（常见/偶尔/罕见）
   c. 标记套路的 genre 匹配度

2. 套路使用评估（每条套路）：
   a. 必要性：该套路是否为叙事所必需
   b. 新鲜度：在本书中是否首次使用（重复使用的套路需标记）
   c. 执行质量：套路的执行是否到位（铺垫、执行、收束）
   d. 读者疲劳度：该套路在 genre 中是否已被过度使用

3. 反套路潜力评估：
   a. 当前走向的读者可预测性（1-10，10=完全可预测）
   b. 在当前节点是否有反套路的可能性
   c. 反套路的风险评估（是否会造成叙事断裂或读者反感）
   d. 建议的轻度/中度/重度反套路方案

4. 套路组合评估：本章套路组合是否过于密集

【套路严重程度分级】
- CRITICAL：全书已使用超过3次的相同套路 / 当前 genre 最被诟病的烂俗套路
- WARNING：常见套路 + 执行质量一般 / 连续章节使用同类型套路
- INFO：套路使用合理 / 有反套路元素的常规套路

【输出格式】
{
  "detected_tropes": [
    {
      "trope_name": "套路名称",
      "trope_category": "战斗套路|修炼套路|情感套路|剧情套路",
      "frequency_in_genre": "common|uncommon|rare",
      "frequency_in_book": 在本书中出现次数,
      "usage_quality": 1-10,
      "predictability": 1-10,
      "severity": "INFO|WARNING|CRITICAL",
      "assessment": "评估说明",
      "anti_trope_opportunities": ["反套路方案1", "反套路方案2"]
    }
  ],
  "combo_assessment": {
    "trope_density": "normal|dense|overloaded",
    "combo_score": 1-10
  },
  "overall_predictability": 1-10,
  "creativity_score": 1-10
}
```

---

#### 检查项 C06：水文检测

| 属性 | 详情 |
|------|------|
| **检查名称** | 水文检测 (Filler_Detection) |
| **检查类型** | 混合检查（规则 + LLM） |
| **触发条件** | 每章必检；章节字数超过平均值1.5倍时强制触发；连续章节信息密度低时警告 |
| **严重程度** | WARNING（中度水文）/ CRITICAL（严重水文） |

**规则检查层**：
```python
FILLER_DETECTION_RULES = {
    "information_density": {
        "new_info_ratio": "新信息字数 / 总字数",
        "threshold_warning": 0.3,    # 低于30%警告
        "threshold_critical": 0.15,  # 低于15%严重
    },
    "repetition_detection": {
        "near_duplicate_sentences": "相似度>85%的句子检测",
        "repeated_descriptions": "环境/外貌描写的重复检测",
        "recap_length": "前情回顾占本章比例",
        "recap_threshold": 0.2,
    },
    "padding_patterns": {
        "excessive_descriptions": "无推进作用的过度环境描写",
        "redundant_dialogues": "无信息增量的冗余对话",
        "internal_monologue_loops": "内心独白重复同一情绪",
        "reaction_crowd": "群众反应描写过多",
        "status_panel_updates": "系统面板/属性更新过于频繁",
    },
    "word_efficiency": {
        "words_per_plot_point": "每个情节点消耗字数",
        "dialogue_efficiency": "对话中有效信息比例",
    }
}
```

**LLM Prompt 模板**：
```
【角色设定】你是 NarrativeOS 谏官系统的水文审计官，负责检测和量化章节中的水文内容。

【输入信息】
- 当前章节内容：{chapter_text}
- 规则引擎指标：{filler_metrics}
- 章节类型：{chapter_type}  # 战斗/日常/过渡/揭秘
- 本章应推进的情节点：{expected_plot_points}  # 大纲要求

【审计任务】
1. 逐段分析每段内容的信息价值：
   a. 核心推进：直接推动情节的内容
   b. 辅助支撑：服务于情节的描写/对话（氛围、人设）
   c. 可有可无：删除后对理解情节无影响的内容
   d. 纯水文：重复已知信息、无意义的填充

2. 水文类型分类统计：
   - 环境水文：无氛围/情节服务的纯写景
   - 对话水文：无信息增量的闲聊
   - 心理水文：重复同一情绪的内心独白
   - 描写水文：过度的人物/场景描写
   - 面板水文：属性/状态的重复展示
   - 群众水文：路人反应的堆砌
   - 回忆水文：已知信息的重复回顾

3. 给出压缩建议：哪些段落可以压缩/删除而不影响叙事

【输出格式】
{
  "water_score": 0-100,  # 0=无水，100=全是水
  "severity": "INFO|WARNING|CRITICAL",
  "breakdown": {
    "core_content_ratio": 0.0-1.0,
    "supportive_content_ratio": 0.0-1.0,
    "optional_content_ratio": 0.0-1.0,
    "filler_content_ratio": 0.0-1.0,
    "filler_by_type": {
      "environment": 0.0-1.0,
      "dialogue": 0.0-1.0,
      "internal_monologue": 0.0-1.0,
      "description": 0.0-1.0,
      "status_panel": 0.0-1.0,
      "crowd_reaction": 0.0-1.0,
      "recap": 0.0-1.0
    }
  },
  "compression_suggestions": [
    {
      "location": "位置",
      "original_length": "原字数",
      "suggested_length": "建议字数",
      "suggestion": "压缩建议",
      "priority": "high|medium|low"
    }
  ]
}
```

---

#### 检查项 C07：预期违背评估

| 属性 | 详情 |
|------|------|
| **检查名称** | 预期违背评估 (Expectation_Subversion) |
| **检查类型** | LLM 检查 |
| **触发条件** | 重大转折点、悬念设置、冲突升级时触发；每10章定期评估一次读者预期模型 |
| **严重程度** | INFO（预期管理建议）/ WARNING（预期过于可预测） |

**读者预期模型构建**：
```python
READER_EXPECTATION_MODEL = {
    "built_from": [
        "前序章节的剧情走向模式",
        "genre 默认期待",
        "作者已建立的叙事契约",
        "角色关系的常规发展路径",
        "已释放的信号（明示+暗示）",
    ],
    "expectation_types": {
        "plot": "情节走向预期",
        "character": "角色行为预期",
        "relationship": "关系发展预期",
        "world": "世界观揭示预期",
        "tone": "基调变化预期",
    },
    "confidence_levels": {
        "strong": "读者高度确信的预期",
        "moderate": "读者有一定预期的",
        "weak": "读者不太确定的",
    }
}
```

**LLM Prompt 模板**：
```
【角色设定】你是 NarrativeOS 谏官系统的预期管理审计官，负责评估章节的读者可预测性和意外性。

【输入信息】
- 当前章节内容：{chapter_text}
- 读者预期模型：{reader_expectations}  # 包含读者当前对剧情走向的预期
- 前序关键信号：{previous_signals}      # 作者已释放的明示/暗示信号
- Genre 默认模式：{genre_defaults}       # 该 genre 的常规叙事模式

【审计任务】
1. 构建本章的"预期走向"（如果没有意外，读者会预期发生什么）
2. 对比实际走向，分析偏离程度：
   a. 完全满足预期：读者看到了他们预期的
   b. 轻度偏离：有小惊喜但整体在预期框架内
   c. 中度偏离：核心走向不同但可接受
   d. 重度偏离：完全颠覆读者预期
   e. 背叛式偏离：违背叙事契约，可能损害信任

3. 评估每种偏离的效果预期：
   - 惊喜度（1-10）
   - 合理性（1-10）：偏离是否有足够的铺垫
   - 情感冲击力（1-10）
   - 风险度（1-10）：读者反弹的可能性

4. 对"完全满足预期"的节点，建议轻度/中度偏离方案
5. 对"背叛式偏离"发出警告，建议增加铺垫

【输出格式】
{
  "reader_expected": "描述读者基于前文会预期什么",
  "actual_outcome": "本章实际走向",
  "deviation_type": "fulfilled|mild|moderate|severe|betrayal",
  "subversion_quality": {
    "surprise": 1-10,
    "fairness": 1-10,     # 读者是否觉得"被骗"还是"被惊艳"
    "foreshadowing": 1-10,  # 偏离是否有足够的铺垫
    "emotional_impact": 1-10
  },
  "risk_assessment": {
    "backlash_probability": 0.0-1.0,
    "trust_damage": "none|minor|moderate|severe",
    "recovery_difficulty": 1-10
  },
  "recommendations": ["预期管理优化建议"]
}
```

---

#### 检查项 C08：金手指合规性

| 属性 | 详情 |
|------|------|
| **检查名称** | 金手指合规性检查 (Cheat_Mechanic_Compliance) |
| **检查类型** | 混合检查（规则 + LLM） |
| **触发条件** | 金手指使用场景必检；金手指能力描述变更时触发 |
| **严重程度** | CRITICAL（违反核心规则）/ WARNING（代价失衡）/ INFO（使用建议） |

**规则检查层**：
```python
CHEAT_MECHANIC_RULES = {
    "usage_tracking": {
        "cooldown_check": "使用间隔 >= 设定冷却时间",
        "frequency_limit": "单位章节使用次数 <= 设定上限",
        "scope_limit": "使用范围 ∈ 设定能力范围",
        "upgrade_validity": "升级路径是否符合预设成长曲线",
    },
    "cost_enforcement": {
        "immediate_cost": "即时代价是否被描述",
        "cumulative_cost": "累积代价是否达到阈值",
        "cost_consistency": "同等级使用的代价是否一致",
        "forbidden_cost_waive": "禁止免除代价的情形",
    },
    "anti_inflation": {
        "relative_advantage": "金手指优势度是否维持在设定范围",
        "challenge_validity": "是否仍有有效的挑战和困难",
        "power_creep_detection": "能力膨胀率是否超标",
    }
}
```

**LLM Prompt 模板**：
```
【角色设定】你是 NarrativeOS 谏官系统的金手指审计官，负责确保金手指系统的平衡性和可持续性。

【输入信息】
- 当前章节内容：{chapter_text}
- 金手指设定档案：{cheat_profile}  # 包含：
  #   - mechanic_type: 金手指类型（系统/传承/天赋/宝物）
  #   - abilities: 能力清单及当前等级
  #   - cost_structure: 代价体系
  #   - limitations: 限制条件
  #   - growth_curve: 成长曲线
  #   - usage_history: 使用历史记录
- 当前剧情阶段：{story_arc_phase}

【审计任务】
1. 识别本章所有金手指使用实例
2. 逐项检查：
   a. 使用合规性：是否在能力范围内使用
   b. 代价完整性：是否描述了应有的代价
   c. 冷却遵守：是否在冷却期内使用
   d. 频率控制：是否过度依赖金手指解决问题
   e. 挑战性保持：金手指是否让故事失去了紧张感
3. 长期趋势评估：
   a. 金手指优势度是否随剧情膨胀
   b. 主角自身成长是否被金手指掩盖
   c. 故事是否仍有"无法靠金手指解决"的困境

【输出格式】
{
  "usage_instances": [
    {
      "ability": "使用的金手指能力",
      "location": "位置",
      "compliance": "compliant|minor_violation|major_violation",
      "cost_paid": true|false,
      "cost_adequacy": 1-10,
      "tension_preservation": 1-10,
      "assessment": "评估说明"
    }
  ],
  "long_term_trends": {
    "advantage_inflation": 1-10,  # 1=严重膨胀，10=保持平衡
    "protagonist_growth_visibility": 1-10,
    "challenge_validity": 1-10
  },
  "balance_recommendations": ["平衡性优化建议"]
}
```

---

#### 检查项 C09：对话质量

| 属性 | 详情 |
|------|------|
| **检查名称** | 对话质量检查 (Dialogue_Quality) |
| **检查类型** | LLM 检查 |
| **触发条件** | 对话占比 > 20% 时深度分析；核心对话场景必检 |
| **严重程度** | WARNING（对话质量问题）/ INFO（优化建议） |

**LLM Prompt 模板**：
```
【角色设定】你是 NarrativeOS 谏官系统的对话审计官，评估对话质量及其在叙事中的功能。

【输入信息】
- 当前章节内容：{chapter_text}
- 对话角色关系图：{character_relationships}
- 对话场景目的：{scene_objective}

【审计任务】
1. 逐段评估每段对话的功能性：
   a. 情节推进：对话是否推动了情节发展
   b. 人物塑造：对话是否展示了角色性格
   c. 信息传递：对话是否有效传递了必要信息
   d. 氛围营造：对话是否营造了合适的氛围
   e. 关系展示：对话是否展示了角色间的关系动态
2. 对话质量评估：
   a. 自然度：对话是否像真人说话
   b. 独特性：每个角色的对话风格是否可区分
   c. 节奏感：对话节奏是否合适（长短交替、快慢结合）
   d. 潜台词：是否有言外之意
   e. 效率：是否存在冗余对话
3. 标记问题对话：
   - 说明式对话（角色说明显不应该说的话）
   - 同质对话（所有角色说话风格一样）
   - 无意义寒暄
   - 情感过度表达（角色直白说出应该暗示的情感）

【输出格式】
{
  "dialogue_segments": [
    {
      "location": "位置",
      "speakers": ["说话者"],
      "functions": {"plot": true, "character": true, "info": false, "atmosphere": true},
      "quality_scores": {"naturalness": 1-10, "distinctiveness": 1-10, "subtext": 1-10},
      "issues": ["问题类型"],
      "assessment": "优秀/良好/需改进"
    }
  ],
  "overall_scores": {
    "functional_efficiency": 1-10,
    "character_distinctiveness": 1-10,
    "naturalness": 1-10,
    "subtext_richness": 1-10
  }
}
```

---

#### 检查项 C10：环境描写质量

| 属性 | 详情 |
|------|------|
| **检查名称** | 环境描写质量检查 (Environment_Quality) |
| **检查类型** | 混合检查（规则 + LLM） |
| **触发条件** | 环境描写段落出现时触发；描写长度超过阈值时深度分析 |
| **严重程度** | INFO（优化建议）/ WARNING（服务性功能缺失） |

**LLM Prompt 模板**：
```
【角色设定】你是 NarrativeOS 谏官系统的环境审计官，评估环境描写的叙事功能。

【输入信息】
- 当前章节内容：{chapter_text}
- 当前场景功能：{scene_function}  # 战斗/抒情/过渡/悬念
- 情感目标：{emotional_target}

【审计任务】
1. 识别所有环境描写段落
2. 评估每段的服务功能：
   a. 氛围服务：是否营造了符合场景的氛围
   b. 情节服务：是否为后续情节提供了空间/条件
   c. 人设服务：是否通过环境反应了角色状态
   d. 主题服务：是否隐喻/象征了主题
   e. 节奏服务：是否控制了叙事节奏
3. 评估"如果删除这段描写"的影响程度
4. 检查五感调用丰富度（视觉/听觉/嗅觉/触觉/味觉）

【输出格式】
{
  "environment_passages": [
    {
      "location": "位置",
      "length": "字数",
      "senses_used": ["visual", "auditory", ...],
      "functions": {"atmosphere": true, "plot": false, "character": true, "theme": false},
      "removability": "essential|helpful|optional|redundant",
      "quality_score": 1-10
    }
  ],
  "overall_service_ratio": 0.0-1.0  # 有效服务描写占比
}
```

---

#### 检查项 C11：POV 一致性

| 属性 | 详情 |
|------|------|
| **检查名称** | POV 一致性检查 (POV_Consistency) |
| **检查类型** | 规则检查 |
| **触发条件** | 每章必检；POV 切换时深度验证 |
| **严重程度** | CRITICAL（非法越界）/ WARNING（POV 模糊） |

**规则检查层**：
```python
POV_RULES = {
    "pov_types": {
        "first_person": {
            "allowed_knowledge": "仅限叙述者所知",
            "forbidden": ["其他角色内心", "叙述者不在场的场景", "全知叙述"],
            "detection_pattern": r"^(我|我们)",
        },
        "third_person_limited": {
            "allowed_knowledge": "当前POV角色所知+适度的外部观察",
            "forbidden": ["非POV角色内心", "POV角色不可能知道的信息"],
        },
        "third_person_omniscient": {
            "allowed_knowledge": "全知",
            "warning_items": ["视角跳跃过于频繁", "越级感过强"],
        },
    },
    "switch_rules": {
        "chapter_boundary": "允许章间切换",
        "scene_boundary": "允许场景间切换（需分隔标记）",
        "mid_scene": "场景内切换需警告",
        "head_hopping": "同一段落切换POV = CRITICAL",
    },
    "knowledge_boundary_check": {
        "information_validation": "角色不应该知道自己不知道的事",
        "future_knowledge": "角色不应该有预知能力（除非设定允许）",
        "other_minds": "非心灵感应角色不应知他人想法",
    }
}
```

---

#### 检查项 C12：时间线一致性

| 属性 | 详情 |
|------|------|
| **检查名称** | 时间线一致性检查 (Timeline_Consistency) |
| **检查类型** | 混合检查 |
| **触发条件** | 涉及时间描述（日期、时辰、季节、时间跨度）时触发 |
| **严重程度** | CRITICAL（时间悖论）/ WARNING（时间跳跃不合理） |

**规则检查层**：
```python
TIMELINE_RULES = {
    "time_expression_extraction": {
        "absolute_time": r"(?:辰时|午时|子时|卯时|阳春三月|深秋|腊八|除夕|三年后|十日后)",
        "relative_time": r"(?:片刻|一炷香|一盏茶|半柱香|一刹那|须臾)",
        "duration": r"(?:三日|半月|一载|十年|弹指一挥间)",
        "flashback_markers": r"(?:回想|追忆|依稀记得|那年|从前)",
    },
    "consistency_checks": [
        "同一事件在不同章节中的时间描述是否一致",
        "时间跨度计算是否正确（出发日期+行程=到达日期）",
        "季节描述是否与时间线一致",
        "角色年龄增长是否与时间线一致",
        "多条并线的时间是否同步",
    ]
}
```

---

#### 检查项 C13：空间逻辑一致性

| 属性 | 详情 |
|------|------|
| **检查名称** | 空间逻辑一致性检查 (Spatial_Logic) |
| **检查类型** | 混合检查 |
| **触发条件** | 场景切换、角色移动、战斗发生时触发 |
| **严重程度** | CRITICAL（空间悖论）/ WARNING（距离/方位不合理） |

---

#### 检查项 C14：情感弧线连续性

| 属性 | 详情 |
|------|------|
| **检查名称** | 情感弧线连续性检查 (Emotional_Arc_Continuity) |
| **检查类型** | LLM 检查 |
| **触发条件** | 涉及情感变化、心理描写时触发；重大情感转折时深度分析 |
| **严重程度** | WARNING（情感突变）/ INFO（情感深化建议） |

**LLM Prompt 模板**：
```
【角色设定】你是 NarrativeOS 谏官系统的情感审计官，追踪角色情感弧线的连续性。

【输入信息】
- 当前章节内容：{chapter_text}
- 角色情感历史：{emotional_history}  # 每个角色最近10章的情感状态
- 重大情感事件记录：{emotional_events}

【审计任务】
1. 识别本章每个角色的情感变化和触发事件
2. 评估情感变化的合理性：
   a. 触发强度是否足以引起该程度的变化
   b. 变化速度是否合理（非剧烈刺激不应导致剧烈变化）
   c. 变化方向是否符合角色性格
   d. 是否有足够的情感过渡描写
3. 评估情感表达的质量：
   a. 是否展示而非讲述（show, don't tell）
   b. 情感层次是否丰富
   c. 是否有情感记忆（与历史情感的呼应）
4. 标记情感断裂（突变无因、过度反应、情感失忆）

【输出格式】
{
  "emotional_changes": [
    {
      "character": "角色名",
      "from_state": "变化前情感",
      "to_state": "变化后情感",
      "trigger": "触发事件",
      "trigger_adequacy": 1-10,  # 触发强度是否充足
      "transition_quality": 1-10,  # 过渡是否自然
      "show_vs_tell": 1-10,  # 展示vs讲述
      "issues": ["问题列表"]
    }
  ],
  "arc_assessment": {
    "continuity_score": 1-10,
    "depth_score": 1-10,
    "expressiveness_score": 1-10
  }
}
```

---

#### 检查项 C15：世界观设定一致性

| 属性 | 详情 |
|------|------|
| **检查名称** | 世界观设定一致性检查 (Worldbuilding_Consistency) |
| **检查类型** | 混合检查 |
| **触发条件** | 涉及世界观元素（规则、组织、地理、历史、文化）时触发；新设定引入时强制验证 |
| **严重程度** | CRITICAL（与已有设定直接冲突）/ WARNING（设定模糊/可能冲突） |

---

#### 检查项 C16：语言风格一致性

| 属性 | 详情 |
|------|------|
| **检查名称** | 语言风格一致性检查 (Style_Consistency) |
| **检查类型** | 混合检查 |
| **触发条件** | 每章必检；检测到风格异常波动时警告 |
| **严重程度** | INFO（风格微调建议）/ WARNING（风格明显偏离） |

**量化指标**：
```python
STYLE_METRICS = {
    "lexical": {
        "average_word_length": "平均词长",
        "vocabulary_richness": "词汇多样性（TTR）",
        "modifier_density": "修饰语密度",
        "archaism_ratio": "文言词比例",
    },
    "syntactic": {
        "average_sentence_length": "平均句长",
        "sentence_length_variance": "句长方差",
        "complex_sentence_ratio": "复句比例",
        "rhetorical_device_frequency": "修辞手法密度",
    },
    "narrative": {
        "show_vs_tell_ratio": "展示vs讲述比例",
        "pace_words_ratio": "快节奏词汇比例",
        "description_abstraction": "描写抽象度",
    },
    "baseline_deviation": "本章指标与作者基线的偏离度"
}
```

---

#### 检查项 C17：信息泄露控制

| 属性 | 详情 |
|------|------|
| **检查名称** | 信息泄露控制检查 (Information_Leak_Control) |
| **检查类型** | 混合检查 |
| **触发条件** | 每章必检；涉及敏感信息（剧透、未来事件、隐藏设定）时强制触发 |
| **严重程度** | CRITICAL（关键剧情泄露）/ WARNING（暗示性泄露） |

**信息分级体系**：
```python
INFORMATION_CLASSIFICATION = {
    "levels": {
        "L0_PUBLIC": "公开信息，可自由叙述",
        "L1_HINTABLE": "可暗示但不可明示的信息",
        "L2_SECRET": "需要特定条件才揭示的信息",
        "L3_PLOT_CRITICAL": "核心剧情转折点，绝不可泄露",
        "L4_META": "meta信息（如大纲、伏笔计划），绝对不可出现在正文中",
    },
    "leak_types": {
        "explicit_leak": "直接说出了不该说的信息",
        "implicit_leak": "暗示过于明显，读者可推断出",
        "foreshadowing_excess": "伏笔埋设过深，等于剧透",
        "meta_contamination": "作者视角泄露（如'后面的剧情会'）",
    }
}
```

---

#### 检查项 C18：冲突密度与层次

| 属性 | 详情 |
|------|------|
| **检查名称** | 冲突密度与层次检查 (Conflict_Density) |
| **检查类型** | LLM 检查 |
| **触发条件** | 每章必检；多线冲突时深度分析 |
| **严重程度** | INFO / WARNING |

**LLM Prompt 模板**：
```
【输入信息】
- 当前章节内容：{chapter_text}
- 活跃冲突清单：{active_conflicts}

【审计任务】
1. 识别本章所有冲突（外部/内部/人际/环境）
2. 评估冲突层次：
   - 主要冲突（核心矛盾）
   - 次要冲突（支线矛盾）
   - 潜在冲突（即将爆发）
3. 评估冲突密度是否适当
4. 检查冲突是否有升级/变化（静态冲突警告）
5. 评估冲突解决的质量（是否过于轻易/机械降神）

【输出格式】
{
  "conflicts": [
    {
      "conflict_id": "冲突ID",
      "type": "external|internal|interpersonal|environmental",
      "tier": "primary|secondary|latent",
      "intensity": 1-10,
      "progression": "escalating|stable|resolving|resolved",
      "quality": 1-10
    }
  ],
  "density_score": 1-10,
  "layering_score": 1-10
}
```

---

#### 检查项 C19：章节钩子有效性

| 属性 | 详情 |
|------|------|
| **检查名称** | 章节钩子有效性检查 (Hook_Effectiveness) |
| **检查类型** | LLM 检查 |
| **触发条件** | 每章必检 |
| **严重程度** | INFO / WARNING |

---

#### 检查项 C20：多线叙事平衡

| 属性 | 详情 |
|------|------|
| **检查名称** | 多线叙事平衡检查 (Multi_Plot_Balance) |
| **检查类型** | 混合检查 |
| **触发条件** | 存在多条叙事线时触发 |
| **严重程度** | WARNING（某线长期缺席）/ INFO |

---

### 9.1.3 检查管线设计

#### 管线架构

```
阶段一：预处理（串行）
├── 文本分词与标注
├── 角色/场景/对话边界识别
├── 时间/空间表达式提取
└── 输出：结构化标注文本

阶段二：规则引擎检查（并行）
├── C01: 战力规则预检
├── C11: POV 规则检查
├── C12: 时间线规则检查
├── C13: 空间逻辑规则检查
├── C06: 水文规则预检
├── C03: 伏笔状态规则更新
└── 输出：规则检查结果 + LLM 检查候选区域

阶段三：LLM 深度检查（并行批次）
├── 批次 A（人设/情感/对话）: C02 + C09 + C14
├── 批次 B（节奏/套路/预期）: C04 + C05 + C07
├── 批次 C（描写/风格/环境）: C10 + C16
├── 批次 D（战力/金手指）: C01-LLM + C08
├── 批次 E（伏笔/世界观/信息）: C03-LLM + C15 + C17
└── 输出：LLM 检查结果

阶段四：综合评估（串行）
├── 结果聚合与去重
├── 严重程度加权
├── 策生成
└── 输出：谏官报告
```

#### 并行策略

```python
PARALLEL_STRATEGY = {
    "max_concurrent_llm_calls": 5,
    "dependency_graph": {
        "C01": {"depends_on": [], "provides": ["power_events"]},
        "C02": {"depends_on": ["C09"], "provides": ["character_actions"]},
        "C03": {"depends_on": ["C05", "C07"], "provides": []},
        "C04": {"depends_on": [], "provides": ["pacing_curve"]},
        "C05": {"depends_on": [], "provides": ["trope_list"]},
        "C06": {"depends_on": [], "provides": ["filler_regions"]},
        "C07": {"depends_on": ["C05"], "provides": ["expectation_model"]},
        "C08": {"depends_on": ["C01"], "provides": []},
        "C09": {"depends_on": [], "provides": ["dialogue_segments"]},
        "C10": {"depends_on": [], "provides": []},
        "C11": {"depends_on": [], "provides": ["pov_violations"]},
        "C12": {"depends_on": [], "provides": ["timeline_events"]},
        "C13": {"depends_on": ["C12"], "provides": []},
        "C14": {"depends_on": ["C02"], "provides": []},
        "C15": {"depends_on": [], "provides": []},
        "C16": {"depends_on": [], "provides": []},
        "C17": {"depends_on": ["C03", "C15"], "provides": []},
    },
    "batch_execution": [
        ["C01", "C04", "C05", "C06", "C09", "C10", "C11", "C12", "C15", "C16"],  # 批次1
        ["C02", "C08", "C13"],  # 批次2（依赖批次1的部分输出）
        ["C03", "C07", "C14", "C17"],  # 批次3（依赖批次2）
    ]
}
```

---

### 9.1.4 综合评分算法

#### 多维度加权评分

```python
class CounselorScoringEngine:
    """谏官综合评分引擎"""

    # 维度权重配置（可自定义）
    DIMENSION_WEIGHTS = {
        "plot_integrity": 0.20,      # 情节完整性（战力、时间、空间、信息泄露）
        "character_integrity": 0.20, # 人物完整性（人设、情感、对话、POV）
        "narrative_craft": 0.20,     # 叙事技艺（节奏、套路、环境、风格）
        "structural_quality": 0.20,  # 结构质量（伏笔、冲突、多线、钩子）
        "technical_quality": 0.20,   # 技术质量（水文、金手指合规）
    }

    # 检查项到维度的映射
    CHECK_TO_DIMENSION = {
        "C01": "plot_integrity",
        "C02": "character_integrity",
        "C03": "structural_quality",
        "C04": "narrative_craft",
        "C05": "narrative_craft",
        "C06": "technical_quality",
        "C07": "narrative_craft",
        "C08": "technical_quality",
        "C09": "character_integrity",
        "C10": "narrative_craft",
        "C11": "character_integrity",
        "C12": "plot_integrity",
        "C13": "plot_integrity",
        "C14": "character_integrity",
        "C15": "plot_integrity",
        "C16": "narrative_craft",
        "C17": "plot_integrity",
        "C18": "structural_quality",
        "C19": "structural_quality",
        "C20": "structural_quality",
    }

    # 严重程度扣分系数
    SEVERITY_PENALTY = {
        "INFO": 0.0,       # 不扣分
        "WARNING": -0.15,  # 扣15%
        "CRITICAL": -0.40, # 扣40%
    }

    def calculate_dimension_score(self, check_results: dict) -> dict:
        """计算各维度得分"""
        dimension_scores = {dim: 1.0 for dim in self.DIMENSION_WEIGHTS}
        dimension_counts = {dim: 0 for dim in self.DIMENSION_WEIGHTS}

        for check_id, result in check_results.items():
            dim = self.CHECK_TO_DIMENSION.get(check_id)
            if not dim:
                continue

            base_score = result.get("score", 1.0)

            # 应用严重程度惩罚
            for issue in result.get("issues", []):
                severity = issue.get("severity", "INFO")
                penalty = self.SEVERITY_PENALTY.get(severity, 0)
                base_score += penalty

            dimension_scores[dim] += max(0, base_score)
            dimension_counts[dim] += 1

        # 归一化
        for dim in dimension_scores:
            if dimension_counts[dim] > 0:
                dimension_scores[dim] /= dimension_counts[dim]
            dimension_scores[dim] = max(0, min(1, dimension_scores[dim]))

        return dimension_scores

    def calculate_overall_score(self, dimension_scores: dict) -> float:
        """计算总体评分"""
        overall = sum(
            dimension_scores[dim] * weight
            for dim, weight in self.DIMENSION_WEIGHTS.items()
        )
        return max(0, min(1, overall))

    def generate_grade(self, overall_score: float) -> str:
        """生成等级"""
        if overall_score >= 0.90: return "S"
        if overall_score >= 0.80: return "A"
        if overall_score >= 0.70: return "B"
        if overall_score >= 0.60: return "C"
        if overall_score >= 0.50: return "D"
        return "F"
```

---

### 9.1.5 策一/二/三生成逻辑

#### 策生成架构

```python
class StrategyGenerator:
    """三策生成器——每条问题提供三种解决方案"""

    STRATEGY_TEMPLATES = {
        "conservative": {
            "name": "策一·保守",
            "description": "最小改动方案，保持原有思路，微调修复",
            "risk_level": "low",
            "effort_level": "low",
            "principle": "在不改变核心走向的前提下修复问题",
        },
        "balanced": {
            "name": "策二·均衡",
            "description": "中等改动方案，优化结构，提升质量",
            "risk_level": "medium",
            "effort_level": "medium",
            "principle": "在保持故事内核的同时优化叙事效果",
        },
        "creative": {
            "name": "策三·大胆",
            "description": "创新方案，反套路/深度重构",
            "risk_level": "high",
            "effort_level": "high",
            "principle": "打破常规，追求最大叙事效果（需评估风险）",
        },
    }

    def generate_strategies(self, issue: dict) -> list:
        """为单个问题生成三策"""
        prompt = f"""
【角色设定】你是 NarrativeOS 谏官系统的策生成官，为创作问题提供三档解决方案。

【问题信息】
- 检查项：{issue['check_name']} ({issue['check_id']})
- 严重程度：{issue['severity']}
- 问题描述：{issue['description']}
- 问题位置：{issue['location']}
- 当前文本：{issue.get('context', 'N/A')}
- 预期标准：{issue.get('expected', 'N/A')}

【策生成要求】

策一·保守（最小改动）：
- 改动幅度：≤10%的文本
- 目标：修复问题，不改变原有设计意图
- 适用场景：作者对当前方案基本满意，只想修复明显问题

策二·均衡（中等改动）：
- 改动幅度：10%-30%的文本
- 目标：优化问题，提升叙事效果
- 适用场景：作者希望改善质量但不想大幅重构

策三·大胆（创新重构）：
- 改动幅度：可能>30%或改变走向
- 目标：将问题转化为叙事亮点
- 适用场景：作者愿意承担风险追求突破

【输出要求】
每个策略包含：
1. strategy_name: 策略名称
2. description: 策略描述（50字内）
3. specific_actions: 具体操作步骤（3-5条）
4. expected_improvement: 预期改善效果
5. risks: 潜在风险
6. estimated_effort: 预估工作量（低/中/高）

请生成 JSON 格式输出。
"""
        # 通过 LLM 调用生成
        strategies = self.llm_generate(prompt)
        return strategies
```

---

### 9.1.6 谏官报告 JSON Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "CounselorReport",
  "description": "谏官系统完整报告 Schema",
  "type": "object",
  "required": ["report_metadata", "chapter_info", "check_results", "dimensional_scores", "overall_assessment", "strategies", "summary"],
  "properties": {
    "report_metadata": {
      "type": "object",
      "properties": {
        "report_id": {"type": "string", "description": "报告唯一标识"},
        "generated_at": {"type": "string", "format": "date-time"},
        "counselor_version": {"type": "string"},
        "llm_model": {"type": "string"},
        "processing_time_ms": {"type": "integer"}
      }
    },
    "chapter_info": {
      "type": "object",
      "properties": {
        "chapter_number": {"type": "integer"},
        "chapter_title": {"type": "string"},
        "word_count": {"type": "integer"},
        "scene_count": {"type": "integer"},
        "character_count": {"type": "integer"},
        "dialogue_ratio": {"type": "number"}
      }
    },
    "check_results": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "check_id": {"type": "string", "enum": ["C01","C02","C03","C04","C05","C06","C07","C08","C09","C10","C11","C12","C13","C14","C15","C16","C17","C18","C19","C20"]},
          "check_name": {"type": "string"},
          "check_type": {"type": "string", "enum": ["rule", "llm", "hybrid"]},
          "severity": {"type": "string", "enum": ["INFO", "WARNING", "CRITICAL"]},
          "status": {"type": "string", "enum": ["passed", "issues_found", "failed"]},
          "score": {"type": "number", "minimum": 0, "maximum": 1},
          "processing_time_ms": {"type": "integer"},
          "issues": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "issue_id": {"type": "string"},
                "severity": {"type": "string", "enum": ["INFO", "WARNING", "CRITICAL"]},
                "location": {"type": "string"},
                "description": {"type": "string"},
                "context": {"type": "string"},
                "expected": {"type": "string"},
                "actual": {"type": "string"},
                "strategies": {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "properties": {
                      "strategy_id": {"type": "string"},
                      "strategy_name": {"type": "string"},
                      "strategy_type": {"type": "string", "enum": ["conservative", "balanced", "creative"]},
                      "description": {"type": "string"},
                      "specific_actions": {"type": "array", "items": {"type": "string"}},
                      "expected_improvement": {"type": "string"},
                      "risks": {"type": "array", "items": {"type": "string"}},
                      "estimated_effort": {"type": "string", "enum": ["low", "medium", "high"]}
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    "dimensional_scores": {
      "type": "object",
      "properties": {
        "plot_integrity": {"type": "number", "minimum": 0, "maximum": 1},
        "character_integrity": {"type": "number", "minimum": 0, "maximum": 1},
        "narrative_craft": {"type": "number", "minimum": 0, "maximum": 1},
        "structural_quality": {"type": "number", "minimum": 0, "maximum": 1},
        "technical_quality": {"type": "number", "minimum": 0, "maximum": 1}
      }
    },
    "overall_assessment": {
      "type": "object",
      "properties": {
        "overall_score": {"type": "number", "minimum": 0, "maximum": 1},
        "grade": {"type": "string", "enum": ["S", "A", "B", "C", "D", "F"]},
        "critical_count": {"type": "integer"},
        "warning_count": {"type": "integer"},
        "info_count": {"type": "integer"},
        "top_concerns": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "rank": {"type": "integer"},
              "issue_id": {"type": "string"},
              "concern": {"type": "string"},
              "recommended_strategy": {"type": "string"}
            }
          }
        }
      }
    },
    "historical_trend": {
      "type": "object",
      "properties": {
        "score_trend": {"type": "string", "enum": ["improving", "stable", "declining", "volatile"]},
        "vs_last_chapter": {"type": "number"},
        "vs_average": {"type": "number"},
        "consistency_score": {"type": "number"}
      }
    },
    "summary": {
      "type": "object",
      "properties": {
        "one_line_assessment": {"type": "string", "maxLength": 100},
        "key_strengths": {"type": "array", "items": {"type": "string"}},
        "key_improvements": {"type": "array", "items": {"type": "string"}},
        "author_decision_required": {"type": "boolean"}
      }
    }
  }
}
```

---

## 9.2 Flow Guardian（心流守护）

### 9.2.0 系统定位

Flow Guardian 是 NarrativeOS v3.0 的作者状态感知模块，通过计算**心流熵值**来监测创作过程中的偏离与干扰，维护作者的创作心流。系统采用**基线净化池**机制对创作片段进行分级处理，并通过**召回语生成**在适当时机唤醒作者的创作意图。

核心原则：**仅提醒，不执行；建议而非强制；守护心流而非打断心流。**

---

### 9.2.1 心流熵值的数学定义

#### 核心公式

心流熵值（Flow Entropy, FE）是衡量创作状态偏离作者意图基线的综合指标，定义为加权偏差之和：

```
FE(t) = Σᵢ [wᵢ × Dᵢ(t)] × N(t) × E(t)
```

其中：
- `FE(t)`：时刻 `t` 的心流熵值（0 ≤ FE ≤ 1）
- `wᵢ`：第 `i` 个偏差维度的权重（Σwᵢ = 1）
- `Dᵢ(t)`：第 `i` 个维度在时刻 `t` 的归一化偏差值（0 ≤ Dᵢ ≤ 1）
- `N(t)`：噪声系数（外部环境干扰）
- `E(t)`：情绪衰减系数（作者疲劳度）

#### 偏差维度定义

```python
FLOW_ENTROPY_DIMENSIONS = {
    # === 增加熵的维度（负面偏离）===
    "content_drift": {
        "description": "内容漂移——与大纲/计划的偏离程度",
        "weight": 0.18,
        "direction": "entropy_increase",
        "measurement": "当前内容向量与大纲内容向量的余弦距离",
        "formula": "D_content = 1 - cos(V_current, V_outline)",
    },
    "style_drift": {
        "description": "风格漂移——与作者历史风格的偏离程度",
        "weight": 0.14,
        "direction": "entropy_increase",
        "measurement": "当前文本风格指标与历史基线的KL散度",
        "formula": "D_style = KL(P_current || P_baseline)",
    },
    "character_voice_loss": {
        "description": "角色声音丢失——角色语言风格同质化",
        "weight": 0.12,
        "direction": "entropy_increase",
        "measurement": "不同角色对话风格的区分度（聚类分离度）",
        "formula": "D_voice = 1 - silhouette_score(dialogue_clusters)",
    },
    "pacing_disruption": {
        "description": "节奏破坏——创作节奏异常",
        "weight": 0.10,
        "direction": "entropy_increase",
        "measurement": "本章节奏曲线与同类章节基线的偏离度",
        "formula": "D_pacing = ∫|C_actual(t) - C_baseline(t)|dt / T",
    },
    "quality_degradation": {
        "description": "质量退化——输出质量趋势下降",
        "weight": 0.08,
        "direction": "entropy_increase",
        "measurement": "谏官评分纵向对比的负向变化率",
        "formula": "D_quality = max(0, -(S_t - S_{t-1}) / S_{t-1})",
    },
    "contradiction_density": {
        "description": "矛盾密度——内部一致性问题的集中度",
        "weight": 0.12,
        "direction": "entropy_increase",
        "measurement": "单位字数内谏官检测到的矛盾数",
        "formula": "D_contra = contradictions_count / word_count × 1000",
    },
    "revision_frequency": {
        "description": "修改频率——回溯修改的频繁程度",
        "weight": 0.08,
        "direction": "entropy_increase",  # 过度修改可能是迷茫的信号
        "measurement": "回溯修改次数 / 正常推进次数",
        "formula": "D_rev = revision_count / (revision_count + forward_count)",
    },
    "repetition_pattern": {
        "description": "重复模式——内容/表达的重复倾向",
        "weight": 0.06,
        "direction": "entropy_increase",
        "measurement": "文本内部重复度 + 跨章节重复度",
        "formula": "D_repeat = (internal_repeat + cross_repeat) / 2",
    },
    "noise_input": {
        "description": "噪声输入——外部干扰信号强度",
        "weight": 0.06,
        "direction": "entropy_increase",
        "measurement": "外部修改建议采纳率的异常波动",
        "formula": "D_noise = |adoption_rate_t - mean(adoption_rate)| / std",
    },
    "uncertainty_expression": {
        "description": "不确定性表达——文本中犹豫/模糊表达的频率",
        "weight": 0.06,
        "direction": "entropy_increase",
        "measurement": "模糊词汇密度（似乎、大概、也许、也许等）",
        "formula": "D_uncertain = hedge_words_count / total_words",
    },

    # === 减少熵的维度（正向信号）===
    "creative_surge": {
        "description": "创作 surge——高质量创新内容的出现",
        "weight": 0.08,
        "direction": "entropy_decrease",  # 负贡献，降低总熵
        "measurement": "反套路得分 + 谏官创意评分",
        "formula": "D_creative = -(novelty_score + creativity_bonus) / 2",
    },
    "flow_indicators": {
        "description": "流态指标——心流正向信号",
        "weight": 0.06,
        "direction": "entropy_decrease",
        "measurement": "连续创作时长、产出速度稳定性",
        "formula": "D_flow_indicator = -(session_continuity × speed_stability)",
    },
}
```

#### 归一化与边界处理

```python
def normalize_deviation(raw_value: float, dimension: str) -> float:
    """将原始偏差值归一化到 [0, 1] 区间"""
    config = FLOW_ENTROPY_DIMENSIONS[dimension]

    # 使用历史基线的统计参数
    baseline_mean = config["historical_mean"]
    baseline_std = config["historical_std"]

    # z-score 归一化后 sigmoid
    z_score = (raw_value - baseline_mean) / max(baseline_std, 0.001)
    normalized = 1 / (1 + math.exp(-z_score))

    return min(1, max(0, normalized))

def calculate_noise_coefficient(external_events: list) -> float:
    """计算噪声系数"""
    base_noise = 1.0
    for event in external_events:
        if event["type"] == "system_interruption":
            base_noise += 0.15
        elif event["type"] == "author_pause":
            base_noise += 0.10 * min(event["duration_min"] / 30, 1)
        elif event["type"] == "external_suggestion_flood":
            base_noise += 0.20
    return min(2.0, base_noise)

def calculate_emotion_decay(session_duration_min: float, pause_count: int) -> float:
    """计算情绪衰减系数——长时间创作后的质量衰减"""
    # 理想心流区间：30-120分钟
    optimal_low, optimal_high = 30, 120

    if session_duration_min < optimal_low:
        # 热身期，质量还在上升
        return 0.8 + 0.2 * (session_duration_min / optimal_low)
    elif session_duration_min <= optimal_high:
        # 心流期，最佳状态
        return 1.0 - 0.1 * (pause_count / 5)
    else:
        # 疲劳期，质量衰减
        overtime = session_duration_min - optimal_high
        fatigue = 1 - math.exp(-overtime / 60)
        return max(0.3, 1.0 - 0.6 * fatigue - 0.1 * (pause_count / 5))
```

#### 熵值分级标准

| 熵值区间 | 心流状态 | 颜色标记 |  Guardian 行为 |
|---------|---------|---------|--------------|
| 0.00 - 0.15 | 深度心流 | 💚 绿灯 | 静默守护，不打扰 |
| 0.15 - 0.30 | 稳定创作 | 💚 绿灯 | 后台记录，待机 |
| 0.30 - 0.45 | 轻微偏离 | 💛 黄灯 | 准备召回语，观察中 |
| 0.45 - 0.60 | 明显偏离 | 💛 黄灯 | 生成召回语，准备提醒 |
| 0.60 - 0.75 | 严重偏离 | 🔴 红灯 | 强制召回语，阻断继续 |
| 0.75 - 1.00 | 心流崩溃 | 🔴 红灯 | 建议暂停，提供重构支持 |

---

### 9.2.2 基线净化池

#### 净化池架构

```
┌─────────────────────────────────────────────────────────────┐
│                      基线净化池系统                           │
│                  (Baseline Purification Pool)                │
├─────────────────────┬─────────────────────┬─────────────────┤
│    绿灯池 (Green)    │    黄灯池 (Yellow)   │   红灯池 (Red)  │
│    💚 心流区         │    💛 观察区         │   🔴 废弃区     │
├─────────────────────┼─────────────────────┼─────────────────┤
│ • 自动入池           │ • 隔离观察           │ • 标记废弃      │
│ • 成为新基线         │ • 召回语触发         │ • 重试策略      │
│ • 优质片段继承       │ • 有条件恢复         │ • 知识提取      │
│ • 跨章节复用         │ • 降级/升级流动      │ • 避免再犯      │
└─────────────────────┴─────────────────────┴─────────────────┘
```

#### 绿灯池（Green Pool）

**入池条件**（满足全部）：
```python
GREEN_POOL_ENTRY_CRITERIA = {
    "flow_entropy": {"max": 0.30, "ideal_range": [0.00, 0.20]},
    "counselor_score": {"min": 0.75},  # 谏官评分 ≥ B
    "author_satisfaction": {"min": 0.70},  # 作者自评/行为信号
    "peer_comparison": {"min_percentile": 60},  # 高于历史60%的章节
    "no_critical_issues": True,  # 无 CRITICAL 级别问题
    "consistency_bonus": {"max_deviation_from_baseline": 0.25},
}
```

**池维护规则**：
```python
GREEN_POOL_MAINTENANCE = {
    "pool_size_limit": 50,  # 最大保留50个优质片段
    "ttl": "永久保留（除非作者手动删除）",
    "scoring_for_retention": "谏官综合评分 × 作者满意度 × 时间衰减",
    "time_decay": {"half_life_chapters": 100},  # 100章后半衰期
    "promotion": "绿灯片段自动成为风格基线、人设基线",
    "cross_reference": "可用于后续章节的正面范例引用",
    "eviction_policy": "当池满时，按综合评分×时间衰减淘汰最低者",
}
```

#### 黄灯池（Yellow Pool）

**入池条件**（满足任一）：
```python
YELLOW_POOL_ENTRY_CRITERIA = {
    "flow_entropy_range": [0.30, 0.60],
    "counselor_score_range": [0.50, 0.75],
    "significant_drift": {"content_drift": ">0.5 或 风格漂移 >0.4"},
    "quality_warning": "谏官 WARNING 数量 ≥ 3",
    "author_hesitation_signals": {"revision_count": "> 段落数的 3 倍"},
    "recall_triggered": True,  # 召回语已被触发过
}
```

**隔离规则**：
```python
YELLOW_POOL_ISOLATION = {
    "isolation_level": "soft",  # 软隔离，不阻止继续创作
    "monitoring_interval": "每 500 字评估一次",
    "recall_protocol": {
        "trigger": "首次入池时生成召回语",
        "cooldown": "同一章节最多触发 2 次召回",
        "escalation": "连续 3 章入黄灯 → 升级为红灯",
    },
    "annotation_requirement": "入池片段需标记偏离维度",
}
```

**恢复路径**：
```python
YELLOW_RECOVERY_PATHS = {
    "path_a_auto_recovery": {
        "condition": "连续 1000 字熵值 < 0.30 且无新问题",
        "action": "自动移回绿灯流程",
        "credit": "恢复成功的片段标记为'自纠'",
    },
    "path_b_author_override": {
        "condition": "作者明确标记'这不是偏离'",
        "action": "移入绿灯池（带作者意图注释）",
        "note": "作者意图覆盖系统判断，但记录备查",
    },
    "path_c_guided_revision": {
        "condition": "作者选择'需要建议'",
        "action": "Flow Guardian 提供针对性建议",
        "outcome": "修订后重新评估",
    },
    "path_d_degradation": {
        "condition": "熵值持续上升 >0.60 或新 CRITICAL 问题",
        "action": "降级至红灯池",
        "alert": "向作者发出明确警告",
    },
}
```

#### 红灯池（Red Pool）

**入池条件**（满足任一）：
```python
RED_POOL_ENTRY_CRITERIA = {
    "flow_entropy": {"min": 0.60},
    "counselor_score": {"max": 0.50},
    "critical_breakdown": "心流完全崩溃信号",
    "multiple_critical_issues": "CRITICAL 问题 ≥ 2",
    "author_explicit_abort": "作者主动标记放弃",
    "escalation_from_yellow": "黄灯连续 3 章未恢复",
    "contradiction_cascade": "新增矛盾触发已有矛盾的连锁反应",
}
```

**废弃处理**：
```python
RED_POOL_HANDLING = {
    "isolation_level": "hard",  # 硬隔离，建议暂停创作
    "immediate_actions": [
        "生成诊断报告（偏离分析 + 问题汇总）",
        "触发强制召回语（最高优先级）",
        "建议暂停创作（至少休息15分钟）",
    ],
    "retention_policy": {
        "retention_period": "30天",
        "purpose": "用于分析偏离模式、防止再犯",
        "accessibility": "作者可随时查看但默认折叠",
    },
}
```

**重试策略**：
```python
RED_RETRY_STRATEGIES = {
    "strategy_1_fresh_start": {
        "name": "全新出发",
        "description": "放弃当前方向，从最近绿灯点重新开始",
        "steps": [
            "定位最近的绿灯锚点",
            "保留绿灯点之前的所有内容",
            "从绿灯点重新出发，提供3个新方向",
            "附带'这次要注意'的针对性提醒",
        ],
        "success_rate_estimate": "75%",
    },
    "strategy_2_surgical_fix": {
        "name": "精准修复",
        "description": "保留大部分内容，只修复导致红灯的核心问题",
        "steps": [
            "诊断导致红灯的 TOP 1-2 问题",
            "提供精准修复方案（最小改动）",
            "修复后重新评估",
        ],
        "success_rate_estimate": "60%",
    },
    "strategy_3_deconstruction": {
        "name": "解构重组",
        "description": "将红灯片段拆解为元素，重新组合",
        "steps": [
            "提取片段中的所有有效元素（情节点、对话、描写）",
            "标记问题元素",
            "提供重组方案",
            "建议新的叙事顺序",
        ],
        "success_rate_estimate": "50%",
    },
    "strategy_4_incubation": {
        "name": "搁置孵化",
        "description": "暂时搁置，留待后续灵感",
        "steps": [
            "将片段标记为'待孵化'",
            "提取核心创意保存到创意库",
            "建议作者切换到其他章节/场景",
            "设置回顾提醒（3天后）",
        ],
        "success_rate_estimate": "40%（但长期可能更高）",
    },
}
```

---

### 9.2.3 召回语生成

#### 召回语触发条件

```python
RECALL_TRIGGER_CONDITIONS = {
    "yellow_first_entry": {
        "trigger": "首次进入黄灯池",
        "priority": "normal",
        "timing": "即时（延迟 5 秒，给作者继续的机会）",
    },
    "yellow_escalation": {
        "trigger": "黄灯池内熵值持续上升（连续 2 次评估上升）",
        "priority": "elevated",
        "timing": "即时",
    },
    "red_entry": {
        "trigger": "进入红灯池",
        "priority": "urgent",
        "timing": "即时 + 视觉高亮",
    },
    "pattern_recognition": {
        "trigger": "检测到历史偏离模式（与过去红灯片段相似）",
        "priority": "preventive",
        "timing": "在偏离发生前预警",
    },
    "author_request": {
        "trigger": "作者主动请求召回",
        "priority": "immediate",
        "timing": "即时响应",
    },
}
```

#### 召回语生成 Prompt 模板

```
【角色设定】你是 NarrativeOS Flow Guardian 的召回语生成器。你的任务是用一句开放式问题唤醒作者的创作意识，帮助作者重新聚焦。召回语必须：
- 简短（不超过30字）
- 开放式（不能是是非问题）
- 非侵入式（不命令、不指责）
- 引发思考（指向偏离的核心维度）
- 尊重作者（承认作者的创作主权）

【输入信息】
- 偏离维度：{drift_dimensions}  # 哪些维度导致了熵值上升
- 偏离程度：{drift_magnitude}
- 当前创作上下文：{recent_context}  # 最近 500 字
- 作者历史偏好：{author_preferences}  # 作者对召回语的反馈历史
- 创作阶段：{creation_phase}  # 初稿/修订/润色
- 当前心流状态：{flow_state}

【召回语模板库】

内容漂移类：
- "这个方向和你最初的设想，最大的不同在哪里？"
- "如果主角此刻做出相反的选择，故事会走向哪里？"
- "你最想让读者在这一章感受到什么？"

风格漂移类：
- "这段话如果是三天前的你来写，会有哪些不同？"
- "你想让这段文字传递怎样的情绪质感？"

角色声音丢失类：
- "如果让这个角色用一句话表达此刻，他会怎么说？"
- "此刻他内心最真实的声音是什么？"

节奏破坏类：
- "在这个节奏点上，读者的呼吸应该是怎样的？"
- "如果你只能保留这一段的核心，它会是什么？"

质量退化类：
- "这一段的哪个细节是你最不想删掉的？"
- "如果给这段文字一个颜色，它会是什么颜色？"

【输出要求】
生成 3 条候选召回语，每条附带：
1. text: 召回语文本
2. target_dimension: 针对的偏离维度
3. tone: 语气（温和/中性/紧迫）
4. estimated_effectiveness: 预估效果（基于历史数据）

JSON 格式输出。
```

#### 召回语示例

| 场景 | 召回语 | 目标维度 |
|------|--------|---------|
| 内容漂移 | "你最初想让读者在这里感受到什么？" | content_drift |
| 风格漂移 | "此刻的文字，是你最想写的那种感觉吗？" | style_drift |
| 角色同质化 | "如果这个角色现在只说真话，他会说什么？" | character_voice_loss |
| 节奏过快 | "在这里，你愿意让读者停留多久？" | pacing_disruption |
| 疲劳信号 | "如果现在停笔，你最想回来写完的是哪一句？" | emotion_decay |
| 矛盾累积 | "此刻主角心里最矛盾的是什么？" | contradiction_density |

---

### 9.2.4 Flow Guardian 状态机

```
                    ┌──────────────┐
                    │   [休眠态]    │◄─────────────────┐
                    │   DORMANT    │                   │
                    └──────┬───────┘                   │
                           │ 作者开始创作               │
                           ▼                          │
                    ┌──────────────┐     作者离开      │
           ┌───────►│   [监听态]    │─────────────────┘
           │        │  LISTENING   │
           │        └──────┬───────┘
           │               │ 熵值首次计算
           │               ▼
           │        ┌──────────────┐     持续绿灯      │
           │        │   [守护态]    │◄────────────────┐
           │        │  GUARDING    │                 │
           │        └──────┬───────┘                 │
           │               │ 熵值 crossing 0.30      │
           │               ▼                         │
           │        ┌──────────────┐     自动恢复     │
           │        │   [召回态]    │─────────────────┘
           │        │  RECALLING   │
           │        └──────┬───────┘
           │               │ 熵值 crossing 0.60 或连续3章黄灯
           │               ▼
           │        ┌──────────────┐     修复成功
           │        │   [干预态]    │────────────────┐
           │        │ INTERVENING  │                │
           │        └──────┬───────┘                │
           │               │ 作者明确放弃            │
           │               ▼                        │
           │        ┌──────────────┐                │
           └────────┤   [暂停态]    │────────────────┘
                    │   PAUSED     │◄───────────────┘
                    └──────────────┘   作者重新开始
```

#### 状态转换详细规则

```python
FLOW_GUARDIAN_STATES = {
    "DORMANT": {
        "description": "系统休眠，等待作者激活",
        "activation": "作者打开编辑器 / 检测到创作活动",
        "behaviors": ["不消耗计算资源", "保持历史数据加载"],
        "transitions": {"LISTENING": "author_activity_detected"},
    },
    "LISTENING": {
        "description": "监听创作活动，尚未计算熵值",
        "activation": "首次创作活动后的观察期",
        "behaviors": ["收集初始数据", "建立基线"],
        "duration": "至少 500 字或 5 分钟",
        "transitions": {
            "GUARDING": "sufficient_data_collected",
            "DORMANT": "author_inactive_for_10min",
        },
    },
    "GUARDING": {
        "description": "正常守护，绿灯状态",
        "activation": "熵值 < 0.30",
        "behaviors": [
            "每 1000 字计算一次熵值",
            "后台更新基线",
            "记录绿灯片段",
            "不打扰作者",
        ],
        "transitions": {
            "RECALLING": "entropy_crosses_0.30",
            "DORMANT": "author_inactive_for_15min",
        },
    },
    "RECALLING": {
        "description": "召回态，黄灯状态",
        "activation": "0.30 ≤ 熵值 < 0.60",
        "behaviors": [
            "缩短评估间隔至每 500 字",
            "生成并显示召回语",
            "记录偏离模式",
            "同一章节最多 2 次召回",
        ],
        "transitions": {
            "GUARDING": "entropy_drops_below_0.30",
            "INTERVENING": "entropy_crosses_0.60",
            "DORMANT": "author_inactive_for_10min",
        },
    },
    "INTERVENING": {
        "description": "干预态，红灯状态",
        "activation": "熵值 ≥ 0.60",
        "behaviors": [
            "生成诊断报告",
            "显示最高优先级召回语",
            "提供重试策略选择",
            "建议暂停",
        ],
        "transitions": {
            "GUARDING": "fix_successful_entropy_drops",
            "PAUSED": "author_explicit_pause",
            "DORMANT": "author_inactive_for_20min",
        },
    },
    "PAUSED": {
        "description": "暂停态",
        "activation": "作者主动暂停或系统建议暂停被接受",
        "behaviors": [
            "保留当前状态快照",
            "生成暂停时反思提示",
            "设置回顾提醒",
        ],
        "transitions": {
            "LISTENING": "author_returns",
            "DORMANT": "pause_exceeds_24h",
        },
    },
}
```

---

### 9.2.5 作者决策模式与响应策略

```python
AUTHOR_DECISION_MODES = {
    "mode_autonomous": {
        "name": "自主模式",
        "description": "作者主导，系统最小干预",
        "flow_guardian_behavior": {
            "recall_frequency": "最低（仅红灯时触发）",
            "recall_persistence": "不重复触发",
            "suggestion_detail": "极简",
            "override_respect": "最高——作者覆盖几乎不被质疑",
        },
        "best_for": "经验丰富、风格稳定的作者",
    },
    "mode_collaborative": {
        "name": "协作模式",
        "description": "平衡互动，系统适度建议",
        "flow_guardian_behavior": {
            "recall_frequency": "标准（黄灯和红灯都触发）",
            "recall_persistence": "最多重复1次",
            "suggestion_detail": "标准——三策完整",
            "override_respect": "标准——记录但不质疑",
        },
        "best_for": "大多数作者，默认模式",
    },
    "mode_guided": {
        "name": "引导模式",
        "description": "系统主动，适合探索期",
        "flow_guardian_behavior": {
            "recall_frequency": "较高（接近阈值即预警）",
            "recall_persistence": "可重复2次",
            "suggestion_detail": "详细——含分析和示例",
            "override_respect": "较低——会追问确认",
        },
        "best_for": "新手作者、探索新风格的作者",
    },
    "mode_stealth": {
        "name": "隐身模式",
        "description": "后台记录，完全不打扰",
        "flow_guardian_behavior": {
            "recall_frequency": "零",
            "recall_persistence": "无",
            "suggestion_detail": "仅生成报告，不实时推送",
            "override_respect": "绝对",
        },
        "best_for": "心流敏感型作者、冲刺阶段",
    },
}
```

---

## 9.3 内容安全过滤器

### 9.3.0 系统定位

内容安全过滤器是 NarrativeOS v3.0 的合规保障模块，确保创作内容符合平台规范与法律法规。采用**关键词正则实时拦截 + 模糊匹配 + 人工终审**的三层架构。

核心原则：**自动拦截在前，人工裁决在后；宁可误判不错放；误判有申诉通道。**

---

### 9.3.1 关键词库分类体系

```python
KEYWORD_LIBRARY = {
    "category_A_political": {
        "name": "政治敏感",
        "severity": "CRITICAL",
        "subcategories": {
            "A1_leadership": {
                "name": "现任/前任领导人相关",
                "match_type": "exact + fuzzy",
                "examples": ["特定姓名", "特定称谓组合"],
                "action": "强制拦截 + 人工复核",
            },
            "A2_political_system": {
                "name": "政治体制攻击",
                "match_type": "semantic + keyword",
                "patterns": ["攻击社会主义制度", "煽动颠覆"],
                "action": "强制拦截",
            },
            "A3_separatism": {
                "name": "分裂主义",
                "match_type": "keyword + context",
                "patterns": ["台独", "藏独", "疆独", "港独"],
                "action": "强制拦截",
            },
            "A4_historical_distortion": {
                "name": "历史虚无主义",
                "match_type": "semantic",
                "patterns": ["歪曲党史", "否定革命"],
                "action": "标记 + 人工复核",
            },
            "A5_terrorism": {
                "name": "恐怖主义关联",
                "match_type": "keyword",
                "action": "强制拦截",
            },
        },
    },
    "category_B_pornographic": {
        "name": "色情内容",
        "severity": "CRITICAL",
        "subcategories": {
            "B1_explicit_sexual": {
                "name": "直接性描写",
                "match_type": "keyword + regex",
                "action": "强制拦截",
            },
            "B2_implicit_erotic": {
                "name": "暗示性色情",
                "match_type": "context_model",
                "action": "标记 + AI评分",
            },
            "B3_minor_related": {
                "name": "未成年相关",
                "match_type": "keyword + semantic",
                "action": "强制拦截（零容忍）",
            },
        },
    },
    "category_C_violence": {
        "name": "暴力血腥",
        "severity": "WARNING",
        "subcategories": {
            "C1_extreme_violence": {
                "name": "极端暴力描写",
                "match_type": "keyword + intensity",
                "threshold": " gratuitous_violence_score > 0.8",
                "action": "标记 + 分级处理",
            },
            "C2_self_harm": {
                "name": "自残/自杀",
                "match_type": "keyword",
                "action": "标记 + 人工复核",
            },
            "C3_gore": {
                "name": "过度血腥",
                "match_type": "keyword_density",
                "threshold": "gore_keyword_density > 0.5%",
                "action": "标记",
            },
        },
    },
    "category_D_discrimination": {
        "name": "歧视性内容",
        "severity": "WARNING",
        "subcategories": {
            "D1_racial": {"name": "种族歧视", "action": "强制拦截"},
            "D2_religious": {"name": "宗教歧视", "action": "强制拦截"},
            "D3_gender": {"name": "性别歧视", "action": "标记 + 复核"},
            "D4_regional": {"name": "地域歧视", "action": "标记 + 复核"},
            "D5_disability": {"name": "残障歧视", "action": "标记 + 复核"},
        },
    },
    "category_E_illegal": {
        "name": "违法犯罪",
        "severity": "CRITICAL",
        "subcategories": {
            "E1_drug": {"name": "毒品", "action": "强制拦截"},
            "E2_gambling": {"name": "赌博", "action": "标记（区分描写与教唆）"},
            "E3_fraud": {"name": "诈骗", "action": "标记（区分描写与教唆）"},
            "E4_organized_crime": {"name": "黑社会/有组织犯罪", "action": "标记 + 分级"},
        },
    },
    "category_F_platform": {
        "name": "平台规范",
        "severity": "INFO",
        "subcategories": {
            "F1_external_links": {"name": "外部链接", "action": "自动标记"},
            "F2_contact_info": {"name": "联系方式", "action": "自动标记"},
            "F3_commercial_promotion": {"name": "商业推广", "action": "标记"},
            "F4_plagiarism": {"name": "抄袭嫌疑", "action": "查重 + 标记"},
        },
    },
}
```

---

### 9.3.2 正则表达式编写规范

```python
REGEX_SPECIFICATION = {
    "basic_patterns": {
        "exact_match": r"关键词",  # 精确匹配
        "word_boundary": r"\b关键词\b",  # 词边界匹配
        "case_insensitive": r"(?i)关键词",  # 不区分大小写
        "multi_variant": r"关键词1|关键词2|关键词3",  # 多关键词
    },
    "advanced_patterns": {
        "interleaved": r"关[\s\p{P}]*键[\s\p{P}]*词",  # 间隔字符
        "phonetic_similar": r"[关观官冠][键健建剑]词",  # 形近字
        "split_by_symbol": r"关.?键.?词",  # 中间有任意字符
        "homophone": r"(gongchandang|gcd|g\s*c\s*d)",  # 拼音匹配
        "leet_speak": r"k3yw0rd",  # 变形匹配
        "reversed": r"词键关",  # 反向（适用于短词）
    },
    "context_aware": {
        "window_size": 50,  # 上下文窗口50字
        "positive_indicators": ["讽刺", "批判", "反面教材"],  # 减轻处罚信号
        "negative_indicators": ["赞美", "推崇", "效仿"],  # 加重处罚信号
    },
    "performance_rules": {
        "max_regex_length": 1000,  # 单个正则最大长度
        "compilation_caching": True,  # 编译缓存
        "priority_order": "CRITICAL > WARNING > INFO",  # 匹配优先级
        "early_termination": True,  # 命中CRITICAL立即停止
    },
}
```

---

### 9.3.3 模糊匹配算法

#### 同音字/形近字替换检测

```python
class FuzzyMatcher:
    """模糊匹配引擎——检测拼音绕过和形近字替换"""

    # 同音字映射表（常用绕过模式）
    HOMOPHONE_MAP = {
        "zhi": ["之", "支", "只", "汁", "芝", "枝", "知", "织", "肢", "脂"],
        "shi": ["十", "时", "实", "识", "石", "拾", "蚀", "食"],
        "li": ["力", "立", "丽", "利", "历", "厉", "励"],
        "du": ["度", "渡", "镀", "肚", "赌", "堵"],
        # ... 更多拼音映射
    }

    # 形近字映射表
    VISUALLY_SIMILAR = {
        "党": ["黨", "乚", "凵"],
        "国": ["囯", "囶", "圀"],
        "政": ["攊", "撎"],
        "府": ["庘"],
        # ... 更多形近字
    }

    def detect_pinyin_circumvention(self, text: str) -> list:
        """检测拼音绕过"""
        findings = []
        # 提取文本中的拼音模式
        pinyin_pattern = r'[a-z]+\d?'
        pinyin_segments = re.findall(pinyin_pattern, text)

        for segment in pinyin_segments:
            if segment in HOMOPHONE_MAP:
                # 检查周围上下文是否构成敏感词
                context = self.extract_context(text, segment)
                risk_score = self.assess_pinyin_risk(segment, context)
                if risk_score > 0.5:
                    findings.append({
                        "type": "pinyin_circumvention",
                        "matched": segment,
                        "risk_score": risk_score,
                        "suggested_original": self.reconstruct_from_pinyin(segment, context),
                    })
        return findings

    def detect_visual_substitution(self, text: str) -> list:
        """检测形近字替换"""
        findings = []
        for char in text:
            for original, substitutes in VISUALLY_SIMILAR.items():
                if char in substitutes:
                    context = self.extract_context(text, char)
                    findings.append({
                        "type": "visual_substitution",
                        "matched": char,
                        "original": original,
                        "context": context,
                    })
        return findings

    def similarity_score(self, text1: str, text2: str) -> float:
        """计算两段文本的相似度（综合字符、拼音、字形）"""
        char_sim = self.character_similarity(text1, text2)
        pinyin_sim = self.pinyin_similarity(text1, text2)
        visual_sim = self.visual_similarity(text1, text2)

        # 加权综合
        return 0.5 * char_sim + 0.3 * pinyin_sim + 0.2 * visual_sim

    def calculate_edit_distance_with_homophones(self, s1: str, s2: str) -> float:
        """考虑同音字的编辑距离"""
        # 动态规划 + 同音字替换成本
        m, n = len(s1), len(s2)
        dp = [[0] * (n + 1) for _ in range(m + 1)]

        for i in range(m + 1):
            dp[i][0] = i
        for j in range(n + 1):
            dp[0][j] = j

        for i in range(1, m + 1):
            for j in range(1, n + 1):
                if s1[i-1] == s2[j-1]:
                    dp[i][j] = dp[i-1][j-1]
                elif self.are_homophones(s1[i-1], s2[j-1]):
                    dp[i][j] = dp[i-1][j-1] + 0.3  # 同音字替换成本低
                elif self.are_visually_similar(s1[i-1], s2[j-1]):
                    dp[i][j] = dp[i-1][j-1] + 0.5  # 形近字替换成本中等
                else:
                    dp[i][j] = min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]) + 1

        return dp[m][n] / max(m, n)
```

---

### 9.3.4 格式自动检查

```python
FORMAT_CHECK_RULES = {
    "punctuation": {
        "paired_symbols": {
            "check": True,
            "pairs": {
                "「": "」",
                "『": "』",
                "（": "）",
                "【": "】",
                "《": "》",
                "\"": "\"",
                "'": "'",
            },
            "error_action": "标记未闭合的引号/括号",
        },
        "spacing_rules": {
            "after_punctuation": "标点符号后应有空格或换行",
            "around_em_dash": "破折号前后不加空格",
            "ellipsis_format": "省略号使用……而非...",
        },
        "prohibited_patterns": [
            r"!!+",        # 多余感叹号
            r"\?\?+",       # 多余问号
            r"，，+",       # 重复逗号
            r"。。+",       # 重复句号
            r"[,.!?。！？][,.!?。！？]+",  # 连续标点
        ],
    },
    "paragraph": {
        "max_paragraph_length": 300,  # 段落最长300字
        "min_paragraph_length": 10,   # 段落最短10字
        "dialogue_separation": "对话应独立成段",
        "scene_transition": "场景切换应有分隔标记",
        "chapter_structure": {
            "min_word_count": 2000,
            "max_word_count": 5000,
            "expected_sections": ["开头钩子", "主体发展", "结尾"],
        },
    },
    "dialogue_format": {
        "quotation_marks": "使用「」或 "" 标记对话",
        "speaker_identification": "对话应有说话人标识（除非上下文明确）",
        "dialogue_tag_rules": {
            "allowed_tags": ["说", "道", "问", "答", "喊", "低声", "笑"],
            "prohibited_tags": ["严肃地说", "开心地说"],  # 应展示而非讲述
            "tag_position": "可在前/中/后",
        },
    },
    "narrative_format": {
        "pov_markers": "POV切换应有标记",
        "time_markers": "时间跳跃应有明确标识",
        "flashback_format": "回忆应有格式区分（如缩进、字体）",
    },
}
```

---

### 9.3.5 安全过滤 API 设计

```python
# API 端点规范
SECURITY_FILTER_API = {
    "endpoint": "/api/v3/security/filter",
    "method": "POST",
    "request_schema": {
        "content": {"type": "string", "required": True, "max_length": 100000},
        "content_type": {"type": "string", "enum": ["chapter", "comment", "metadata"]},
        "context": {
            "type": "object",
            "properties": {
                "chapter_number": {"type": "integer"},
                "genre": {"type": "string"},
                "author_id": {"type": "string"},
                "previous_chapters_summary": {"type": "string"},
            }
        },
        "filter_level": {
            "type": "string",
            "enum": ["strict", "standard", "relaxed"],
            "default": "standard",
        },
    },
    "response_schema": {
        "status": {"type": "string", "enum": ["pass", "flagged", "blocked"]},
        "overall_risk_score": {"type": "number", "minimum": 0, "maximum": 1},
        "findings": {
            "type": "array",
            "items": {
                "category": {"type": "string"},
                "severity": {"type": "string", "enum": ["INFO", "WARNING", "CRITICAL"]},
                "location": {"type": "string"},
                "matched_text": {"type": "string"},
                "matched_pattern": {"type": "string"},
                "confidence": {"type": "number"},
                "suggestion": {"type": "string"},
            }
        },
        "filter_metadata": {
            "processing_time_ms": {"type": "integer"},
            "rules_checked": {"type": "integer"},
            "model_version": {"type": "string"},
        },
    },
    "error_responses": {
        "400": "请求格式错误",
        "413": "内容过长",
        "429": "请求频率超限",
        "500": "服务器内部错误",
    }
}
```

---

### 9.3.6 误判申诉机制

```python
APPEAL_SYSTEM = {
    "appeal_triggers": [
        "作者对拦截结果提出异议",
        "同一规则连续误判 ≥ 3 次",
        "规则更新后的历史误判回溯",
    ],
    "appeal_workflow": {
        "step_1_submit": {
            "required_fields": [
                "被拦截内容",
                "拦截规则ID",
                "申诉理由",
                "上下文说明（文学意图）",
            ],
            "submission_channel": ["系统内申诉", "邮件", "客服"],
            "auto_response": "24小时内自动确认收到",
        },
        "step_2_review": {
            "reviewer": "人工审核团队 + LLM辅助分析",
            "review_criteria": [
                "上下文是否改变语义",
                "是否属于正当文学表达",
                "是否符合genre惯例",
                "是否涉及教育/批判目的",
            ],
            "review_time_sla": "72小时",
        },
        "step_3_resolution": {
            "outcomes": {
                "upheld": {
                    "description": "拦截维持",
                    "action": "通知作者 + 提供修改建议",
                    "escalation": "可申请二次申诉",
                },
                "overturned": {
                    "description": "拦截撤销",
                    "action": "内容放行 + 规则标记待优化",
                    "credit": "作者申诉成功率+1",
                },
                "partial": {
                    "description": "部分撤销",
                    "action": "放行部分内容 + 保留部分拦截",
                },
            },
        },
        "step_4_learning": {
            "false_positive_record": "记录误判案例",
            "rule_optimization": "定期用误判案例优化规则",
            "author_whitelist": "高信誉作者可降低拦截严格度",
        },
    },
    "author_reputation_system": {
        "reputation_score": 0.0-1.0,  # 基于历史行为
        "factors": {
            "appeal_success_rate": "申诉成功率",
            "content_quality_history": "历史内容质量",
            "violation_history": "违规历史",
            "account_age": "账号年龄",
        },
        "privileges": {
            "reputation > 0.9": "可使用 relaxed 过滤级别",
            "reputation > 0.7": "申诉优先处理",
            "reputation > 0.5": "标准权限",
            "reputation < 0.3": "strict 过滤级别",
        },
    },
}
```

---

## 9.4 质量评分体系

### 9.4.0 体系概述

NarrativeOS v3.0 采用**五维质量评分模型**，对创作内容进行多维度量化评估。评分体系支持**纵向对比**（与历史章节对比）和**趋势分析**，并引入独特的**直觉分（intuition_score）** 来捕捉难以量化的创作质感。

---

### 9.4.1 五维评分模型

```python
QUALITY_SCORING_MODEL = {
    "dimensions": {
        "D1_language": {
            "name": "语言维度",
            "weight": 0.20,
            "sub_metrics": {
                "vocabulary_richness": {
                    "name": "词汇丰富度",
                    "weight": 0.20,
                    "measurement": "TTR (Type-Token Ratio) + 高级词汇占比",
                    "calculation": "unique_words / total_words × lexical_diversity_bonus",
                },
                "sentence_craft": {
                    "name": "句式技艺",
                    "weight": 0.20,
                    "measurement": "句长变化率 + 复句比例 + 修辞密度",
                    "calculation": "variance(sentence_lengths) × complex_ratio × rhetoric_density",
                },
                "narrative_voice": {
                    "name": "叙事声音",
                    "weight": 0.25,
                    "measurement": "展示vs讲述比例 + 叙事距离控制",
                    "calculation": "show_tell_ratio × narrative_distance_score",
                },
                "dialogue_quality": {
                    "name": "对话质量",
                    "weight": 0.20,
                    "measurement": "功能性对话占比 + 角色区分度",
                    "calculation": "functional_dialogue_ratio × voice_distinctiveness",
                },
                "description_efficacy": {
                    "name": "描写效能",
                    "weight": 0.15,
                    "measurement": "服务性描写占比 + 五感丰富度",
                    "calculation": "serviceable_description_ratio × sensory_richness",
                },
            },
        },
        "D2_plot": {
            "name": "情节维度",
            "weight": 0.25,
            "sub_metrics": {
                "structural_integrity": {
                    "name": "结构完整性",
                    "weight": 0.25,
                    "measurement": "起承转合完整性 + 逻辑链闭合率",
                },
                "pacing_quality": {
                    "name": "节奏质量",
                    "weight": 0.25,
                    "measurement": "节奏曲线拟合度 + 爽点分布优化度",
                },
                "conflict_dynamics": {
                    "name": "冲突动力",
                    "weight": 0.25,
                    "measurement": "冲突密度 + 升级频率 + 解决质量",
                },
                "satisfaction_density": {
                    "name": "爽点密度",
                    "weight": 0.25,
                    "measurement": "爽点数量/万字 + 爽点质量评分",
                },
            },
        },
        "D3_character": {
            "name": "人物维度",
            "weight": 0.25,
            "sub_metrics": {
                "consistency": {
                    "name": "人设一致性",
                    "weight": 0.30,
                    "measurement": "行为-人设匹配度 + 决策逻辑链完整性",
                },
                "depth": {
                    "name": "人物深度",
                    "weight": 0.25,
                    "measurement": "内心层次丰富度 + 动机复杂性",
                },
                "growth": {
                    "name": "人物成长",
                    "weight": 0.25,
                    "measurement": "成长弧线连续性 + 变化合理性",
                },
                "relationship_network": {
                    "name": "关系网络",
                    "weight": 0.20,
                    "measurement": "关系动态丰富度 + 关系变化合理性",
                },
            },
        },
        "D4_worldbuilding": {
            "name": "世界观维度",
            "weight": 0.15,
            "sub_metrics": {
                "consistency": {
                    "name": "设定一致性",
                    "weight": 0.35,
                    "measurement": "设定冲突数 + 逻辑自洽性",
                },
                "depth": {
                    "name": "世界深度",
                    "weight": 0.35,
                    "measurement": "设定层次数 + 细节密度",
                },
                "integration": {
                    "name": "融合度",
                    "weight": 0.30,
                    "measurement": "设定与情节的融合度 + 信息自然释放度",
                },
            },
        },
        "D5_rhythm": {
            "name": "节奏维度",
            "weight": 0.15,
            "sub_metrics": {
                "chapter_rhythm": {
                    "name": "章内节奏",
                    "weight": 0.40,
                    "measurement": "节奏曲线与标准曲线拟合度",
                },
                "cross_chapter_rhythm": {
                    "name": "跨章节奏",
                    "weight": 0.35,
                    "measurement": "连续章节节奏多样性 + 高潮间隔优化度",
                },
                "micro_rhythm": {
                    "name": "微观节奏",
                    "weight": 0.25,
                    "measurement": "段落长度变化 + 句长韵律 + 快慢交替",
                },
            },
        },
    }
}
```

#### 权重配置

```python
WEIGHT_PRESETS = {
    "preset_default": {
        "D1_language": 0.20,
        "D2_plot": 0.25,
        "D3_character": 0.25,
        "D4_worldbuilding": 0.15,
        "D5_rhythm": 0.15,
    },
    "preset_character_focused": {
        "description": "人物驱动型作品（言情、群像）",
        "D1_language": 0.20,
        "D2_plot": 0.15,
        "D3_character": 0.35,
        "D4_worldbuilding": 0.10,
        "D5_rhythm": 0.20,
    },
    "preset_plot_focused": {
        "description": "情节驱动型作品（悬疑、无限流）",
        "D1_language": 0.15,
        "D2_plot": 0.35,
        "D3_character": 0.20,
        "D4_worldbuilding": 0.10,
        "D5_rhythm": 0.20,
    },
    "preset_world_focused": {
        "description": "世界观驱动型作品（奇幻、科幻）",
        "D1_language": 0.15,
        "D2_plot": 0.20,
        "D3_character": 0.20,
        "D4_worldbuilding": 0.30,
        "D5_rhythm": 0.15,
    },
    "preset_literary": {
        "description": "文学性作品",
        "D1_language": 0.30,
        "D2_plot": 0.15,
        "D3_character": 0.25,
        "D4_worldbuilding": 0.15,
        "D5_rhythm": 0.15,
    },
}
```

---

### 9.4.2 评分与历史章节的纵向对比

```python
class LongitudinalQualityAnalyzer:
    """纵向质量分析器——与历史章节对比"""

    def __init__(self, chapter_history: list):
        self.history = chapter_history  # 历史章节评分数据
        self.baseline = self._calculate_baseline()

    def _calculate_baseline(self) -> dict:
        """计算作者个人基线（最近20章加权平均）"""
        recent = self.history[-20:]
        weights = [0.95 ** i for i in range(len(recent))]  # 指数衰减
        weights = [w / sum(weights) for w in weights]

        baseline = {}
        for dim in ["D1_language", "D2_plot", "D3_character", "D4_worldbuilding", "D5_rhythm"]:
            scores = [ch.get(dim, 0.5) for ch in recent]
            baseline[dim] = sum(s * w for s, w in zip(scores, weights))

        return baseline

    def compare_with_history(self, current_chapter: dict) -> dict:
        """当前章节与历史对比"""
        comparison = {}
        for dim, baseline_score in self.baseline.items():
            current_score = current_chapter.get(dim, 0)
            comparison[dim] = {
                "current": current_score,
                "baseline": baseline_score,
                "delta": current_score - baseline_score,
                "delta_percent": (current_score - baseline_score) / baseline_score * 100,
                "percentile": self._calculate_percentile(dim, current_score),
                "assessment": self._assess_deviation(current_score - baseline_score),
            }
        return comparison

    def _calculate_percentile(self, dimension: str, score: float) -> float:
        """计算在历史章节中的百分位"""
        historical_scores = [ch.get(dimension, 0) for ch in self.history]
        below = sum(1 for s in historical_scores if s < score)
        return below / len(historical_scores) * 100

    def _assess_deviation(self, delta: float) -> str:
        """评估偏离程度"""
        if delta > 0.15: return "significantly_above_baseline"
        if delta > 0.05: return "above_baseline"
        if delta > -0.05: return "on_baseline"
        if delta > -0.15: return "below_baseline"
        return "significantly_below_baseline"

    def detect_quality_trend(self, window_size: int = 10) -> dict:
        """检测质量趋势"""
        if len(self.history) < window_size:
            return {"status": "insufficient_data"}

        recent = self.history[-window_size:]
        overall_scores = [ch.get("overall", 0.5) for ch in recent]

        # 线性回归计算趋势
        x = list(range(window_size))
        slope, intercept, r_value, _, _ = linregress(x, overall_scores)

        return {
            "status": "analyzed",
            "trend_direction": "improving" if slope > 0.01 else "declining" if slope < -0.01 else "stable",
            "trend_slope": slope,
            "trend_strength": abs(r_value),  # R² 的平方根
            "predicted_next": slope * window_size + intercept,
            "recommendation": self._trend_recommendation(slope, r_value),
        }

    def _trend_recommendation(self, slope: float, r_value: float) -> str:
        """基于趋势给出建议"""
        if slope < -0.02 and r_value > 0.7:
            return "质量呈明显下降趋势，建议回顾最近创作状态，考虑暂停调整"
        elif slope < -0.01:
            return "质量有轻微下降，建议关注谏官的 WARNING 级别提示"
        elif slope > 0.02 and r_value > 0.7:
            return "质量呈稳定上升趋势，当前创作状态良好，可保持"
        elif slope > 0.01:
            return "质量有改善迹象，建议继续保持当前创作方式"
        else:
            return "质量稳定，无明显趋势"
```

---

### 9.4.3 质量趋势分析

```python
QUALITY_TREND_ANALYSIS = {
    "trend_types": {
        "upward_consistent": {
            "pattern": "连续 5+ 章得分上升",
            "interpretation": "创作状态良好，技能在提升",
            "action": "记录成功因素，建议保持",
        },
        "upward_volatile": {
            "pattern": "总体上升但波动大",
            "interpretation": "有潜力但稳定性不足",
            "action": "分析波动原因，寻找稳定因素",
        },
        "flat_stable": {
            "pattern": "得分稳定在同一水平",
            "interpretation": "进入平台期",
            "action": "建议尝试新的叙事技巧突破",
        },
        "downward_consistent": {
            "pattern": "连续 5+ 章得分下降",
            "interpretation": "创作状态下滑，可能疲劳或遇到瓶颈",
            "action": "强烈建议暂停休息，回顾大纲",
        },
        "downward_volatile": {
            "pattern": "总体下降但偶有好章节",
            "interpretation": "状态不稳定，有好的时候但难以持续",
            "action": "分析高分章节的成功因素",
        },
        "cyclical": {
            "pattern": "周期性波动（如战斗章高日常章低）",
            "interpretation": "类型依赖型质量分布",
            "action": "加强弱势类型的创作技巧",
        },
        "sudden_drop": {
            "pattern": "单章突然大幅下降",
            "interpretation": "可能遇到特定困难或外部干扰",
            "action": "检查该章的具体问题，是否为暂时性",
        },
    },
    "visualization": {
        "time_series_plot": "章节-得分折线图 + 趋势线 + 基线",
        "dimension_radar": "五维雷达图（当前 vs 基线 vs 目标）",
        "heatmap": "章节×维度热力图",
    },
}
```

---

### 9.4.4 直觉分（intuition_score）

直觉分是一种难以用规则精确量化、但能反映创作"质感"的综合评分。它捕捉那些数据指标无法完全覆盖的微妙品质。

```python
INTUITION_SCORING = {
    "definition": """
        直觉分是对创作中"难以言说但读者能感受"的质感的量化评估。
        它衡量的是：一个普通读者读完这一章后，凭直觉会给出的
        "好看程度"评分——不考虑技术完美度，只考虑整体感受。
    """,

    "components": {
        "C1_x_factor": {
            "name": "X因子",
            "weight": 0.25,
            "description": "超越技术指标的惊喜感",
            "measurement": "LLM评估——本章是否有让人'哇'的时刻",
            "prompt": "
                阅读本章后，用一个词描述你的第一反应。
                然后评分（1-10）：这一章是否有一种'说不出来的好看'？
                这种'好看'是否超越了技术指标（节奏、结构等）的叠加？
            ",
        },
        "C2_emotional_resonance": {
            "name": "情感共鸣力",
            "weight": 0.25,
            "description": "是否能引发读者的情感反应",
            "measurement": "LLM评估——情感描写的感染力",
            "indicators": [
                "读者是否会为主角的成功而开心",
                "读者是否会为角色的困境而担忧",
                "读者是否会产生'我也经历过'的共鸣",
                "读完是否有一种情绪余韵",
            ],
        },
        "C3_memorability": {
            "name": "记忆度",
            "weight": 0.20,
            "description": "章节内容的可记忆程度",
            "measurement": "LLM评估——24小时后读者能记住多少",
            "prompt": "
                如果读者在24小时后只能记住这一章的一个场景或一句话，
                最可能是什么？这个记忆点的强度如何（1-10）？
            ",
        },
        "C4_reread_value": {
            "name": "重读价值",
            "weight": 0.15,
            "description": "是否值得重读",
            "measurement": "LLM评估——重读时的新发现",
            "prompt": "
                这一章重读时，读者是否会发现新的细节、新的层次？
                是否存在'原来如此'的伏笔呼应？
                重读价值评分（1-10）：
            ",
        },
        "C5_author_voice": {
            "name": "作者声音",
            "weight": 0.15,
            "description": "独特的作者印记",
            "measurement": "LLM评估——风格的独特性和辨识度",
            "prompt": "
                这一章的文字是否带有强烈的个人风格？
                如果遮住作者名字，读者是否仍能认出这是谁写的？
                辨识度评分（1-10）：
            ",
        },
    },

    "calculation": {
        "primary_method": "LLM_direct_assessment",
        "calibration": "用历史高分/低分章节校准LLM评分尺度",
        "normalization": "将LLM原始评分映射到0-1区间",
        "formula": "intuition_score = Σ(component_score × weight) × calibration_factor",
    },

    "usage": {
        "not_for_ranking": "直觉分不用于章节排名（主观性强）",
        "for_awareness": "直觉分用于帮助作者感知'质感'",
        "for_inspiration": "高直觉分的章节分析其成功因素",
        "combined_with_technical": "直觉分 × 技术分 = 综合'好看度'",
    },
}
```

#### 直觉分计算示例

```python
def calculate_intuition_score(chapter_text: str, context: dict) -> dict:
    """计算直觉分"""

    # 构建评估 prompt
    prompt = f"""
【角色设定】你是一位有20年阅读经验的资深网文读者。你擅长凭直觉判断一章内容
是否"好看"——不是从技术角度，而是从纯粹的阅读体验角度。

【阅读任务】
请阅读以下章节内容，然后从5个维度给出你的直觉评分（1-10）：

1. X因子：这一章是否有一种"说不出来的好看"？是否有让你惊喜的地方？
2. 情感共鸣：你是否被这一章打动？是否产生了情感反应？
3. 记忆度：24小时后，你最可能记住这一章的什么？
4. 重读价值：这一章是否值得重读？重读是否会有新发现？
5. 作者声音：文字是否有强烈的个人风格和辨识度？

【章节内容】
{chapter_text[:5000]}  # 取前5000字作为样本

【输出格式】
{{
  "x_factor": {{"score": 1-10, "reasoning": "一句话理由"}},
  "emotional_resonance": {{"score": 1-10, "reasoning": "..."}},
  "memorability": {{"score": 1-10, "reasoning": "...", "most_likely_memory": "最可能被记住的点"}},
  "reread_value": {{"score": 1-10, "reasoning": "..."}},
  "author_voice": {{"score": 1-10, "reasoning": "..."}}
}}
"""

    response = llm.evaluate(prompt)

    # 加权计算
    weights = INTUITION_SCORING["components"]
    total = (
        response["x_factor"]["score"] * weights["C1_x_factor"]["weight"] +
        response["emotional_resonance"]["score"] * weights["C2_emotional_resonance"]["weight"] +
        response["memorability"]["score"] * weights["C3_memorability"]["weight"] +
        response["reread_value"]["score"] * weights["C4_reread_value"]["weight"] +
        response["author_voice"]["score"] * weights["C5_author_voice"]["weight"]
    ) / 10  # 归一化到0-1

    return {
        "intuition_score": round(total, 3),
        "component_breakdown": response,
        "interpretation": interpret_intuition_score(total),
    }

def interpret_intuition_score(score: float) -> str:
    if score >= 0.85: return "极具感染力，有望成经典章节"
    if score >= 0.70: return "质感优秀，读者会记住"
    if score >= 0.55: return "质感良好，有亮点也有可提升之处"
    if score >= 0.40: return "质感一般，技术过关但缺少灵魂"
    return "质感不足，建议注入更多情感和个人风格"
```

---

## 9.5 系统集成与运行流程

### 9.5.1 完整运行流程

```
作者提交章节
    │
    ▼
┌─────────────────────────────────────┐
│  阶段1：内容安全过滤器（实时）         │
│  ├── 关键词正则拦截（< 100ms）        │
│  ├── 模糊匹配检测（< 200ms）          │
│  └── 格式自动检查（< 50ms）           │
│  结果：PASS / FLAGGED / BLOCKED      │
└─────────────────────────────────────┘
    │
    ▼ 安全通过
┌─────────────────────────────────────┐
│  阶段2：谏官检查管线                  │
│  ├── 规则引擎并行检查（< 500ms）      │
│  ├── LLM 深度检查批次执行            │
│  │   ├── 批次A：人设+情感+对话       │
│   │   ├── 批次B：节奏+套路+预期      │
│   │   ├── 批次C：描写+风格+环境      │
│   │   ├── 批次D：战力+金手指         │
│   │   └── 批次E：伏笔+世界观+信息    │
│  └── 综合评估与策生成                │
│  结果：谏官报告 JSON                 │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│  阶段3：Flow Guardian 守护           │
│  ├── 心流熵值计算                    │
│  ├── 基线净化池状态更新              │
│  ├── 召回语生成（如需要）            │
│  └── 状态机转换                      │
│  结果：守护状态 + 召回语（如有）      │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│  阶段4：质量评分                      │
│  ├── 五维评分计算                    │
│  ├── 纵向对比分析                    │
│  ├── 趋势更新                        │
│  └── 直觉分计算                      │
│  结果：质量评分报告                   │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│  阶段5：报告聚合与输出                │
│  ├── 谏官报告（三策 + 评分）          │
│  ├── Flow Guardian 状态通知          │
│  ├── 质量趋势可视化                   │
│  └── 作者裁决界面                    │
│  结果：统一仪表板                     │
└─────────────────────────────────────┘
    │
    ▼
作者裁决（采纳/忽略/修改策）
    │
    ▼
反馈学习（系统自优化）
```

### 9.5.2 性能指标

| 指标 | 目标值 | 说明 |
|------|--------|------|
| 安全过滤延迟 | < 350ms | 单章（5000字）的完整安全检查 |
| 谏官规则检查 | < 500ms | 20项规则检查并行完成 |
| 谏官LLM检查 | < 10s | 5个批次的LLM检查（可缓存） |
| 策生成延迟 | < 5s | 每条问题的三策生成 |
| 熵值计算 | < 100ms | 实时熵值更新 |
| 召回语生成 | < 2s | 触发后2秒内显示 |
| 质量评分 | < 3s | 五维评分 + 直觉分 |
| 全流程 | < 30s | 从提交到完整报告 |

---

## 9.6 附录

### 附录A：术语表

| 术语 | 定义 |
|------|------|
| 谏官 | NarrativeOS 质量诊断模块，负责多维度内容检查 |
| 策一/二/三 | 针对每条问题的保守/均衡/大胆三档解决方案 |
| 心流熵值 | 衡量创作状态偏离基线的综合指标 |
| 基线净化池 | 对创作片段进行分级（绿/黄/红）管理的机制 |
| 召回语 | Flow Guardian 在心流偏离时生成的唤醒提示 |
| 直觉分 | 超越技术指标的"质感"评分 |
| 爽点密度 | 单位字数内满足读者期待的叙事节点数量 |
| 战力通胀 | 角色实力无节制增长导致平衡性破坏 |
| 水文 | 无实质信息推进的填充内容 |
| 伏笔回收 | 前期埋设的线索在后续得到呼应 |

### 附录B：版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| v3.0-RC1 | 2024 | 初始完整设计文档 |

### 附录C：参考文档

- NarrativeOS v3.0 架构总览
- 网文创作质量评估研究
- 心流理论（Csikszentmihalyi）
- 内容安全合规标准
