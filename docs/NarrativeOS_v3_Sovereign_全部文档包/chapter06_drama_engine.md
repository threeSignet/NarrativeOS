# 第六章 工作室引擎（Studio Engine）

> *"代笔团队的不是替代作者思考，而是在作者的思维轨道上加速运行。"*

## 6.0 概述

工作室引擎是 NarrativeOS v3.0 Sovereign 的**核心生成层**，承担"代笔团队"角色——负责 Brief 生成、正文创作、修改提案、风格学习等所有与文本直接相关的任务。它是可能性清单（Possibility Manifest）与世界构建层之间的执行桥梁，将抽象的创作意图转化为具体的叙事文本。

### 6.0.1 设计哲学

1. **单次调用，最大密度**：核心正文生成为单次 LLM 调用，不依赖多轮对话或自由浏览。所有必要信息必须在调用前通过五层 Prompt 结构注入完毕。
2. **风格优先于模板**：通过 AMA（Author Model Adaptation）代理模型蒸馏，系统学习并复现作者的独特风格，而非套用通用模板。
3. **类型感知生成**：不同类型网文具有截然不同的内核特征，类型内核系统在生成流程中提供类型特定的约束与引导。
4. **信息差即张力**：读者知识图谱追踪信息流，确保信息差的精准投放——这是长篇叙事维持张力的核心机制。
5. **修改即对话**：正文修改不是覆盖，而是版本化的对话过程，保留所有修改痕迹供作者审阅。

### 6.0.2 系统架构总览

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           工作室引擎 (Studio Engine)                         │
├─────────────┬─────────────┬─────────────┬─────────────┬─────────────────────┤
│  6.1 类型   │  6.2 AMA    │  6.3 Brief  │  6.4 上下文 │  6.5 正文修改       │
│  内核系统   │  风格蒸馏   │  生成器     │  组装与生成 │  系统               │
├─────────────┼─────────────┼─────────────┼─────────────┼─────────────────────┤
│  6.6 对话   │  6.7 冲突   │  6.8 读者   │             │                     │
│  引擎       │  编排器     │  知识图谱   │             │                     │
├─────────────┴─────────────┴─────────────┴─────────────┴─────────────────────┤
│                           LLM 调用调度层                                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐  │
│  │生成Brief │ │生成正文  │ │修改正文  │ │质量评分  │ │叙事价值评估      │  │
│  │重型/0.5  │ │重型/0.8  │ │重型/0.3  │ │轻型/0.1  │ │轻型/0.3        │  │
│  │每章1次   │ │每章1次   │ │按需      │ │每章3次   │ │每章5次         │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────────────┘  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐                       │
│  │AMA蒸馏   │ │代价共情  │ │章节摘要  │ │对话生成  │                       │
│  │重型/0.3  │ │重型/0.5  │ │轻型/0.3  │ │按需      │                       │
│  │多轮/低频 │ │低频      │ │每章1次   │ │          │                       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.0.3 核心数据流

```
[可能性清单] ──→ [Brief生成器] ──→ [Brief] ──→ [审批/修订] ──→ [锁定Brief]
                                                         │
[AMA风格配置] ───────────────────────────────────────────┤
                                                         ↓
[类型内核] ──────────────────────────────────────────→ [上下文组装器]
                                                         │
[世界状态] ──→ [状态序列化] ─────────────────────────────┤
                                                         ↓
[pgvector] ←── [上下文检索] ←── [检索Query构造] ←── [锁定Brief]
   │                                                         │
   └──→ [历史摘要│设定片段│涟漪报告│场景感知细节] ───────────→ [五层Prompt组装]
                                                                     │
                                                                     ↓
[读者知识图谱] ←── [信息差计算] ←── [知识状态快照] ←───────────────────┤
                                                                     ↓
                                                              [LLM单次调用]
                                                                     │
                                                                     ↓
[输出解析] ──→ [格式验证] ──→ [正文] ──→ [质量评分/叙事价值评估] ──→ [交付]
                                              │                        │
                                              ↓                        ↓
                                       [谏官报告]              [作者审阅]
                                              │                        │
                                              ↓                        ↓
[修改指令] ──→ [修改策略选择] ──→ [局部补丁/全文重写] ←────────── [修改请求]
   ↑                                                                         │
   └─────────────────────────────────────────────────────────────────────────┘
```

---

## 6.1 类型内核系统（Genre Kernel System）

### 6.1.1 设计目标

类型内核系统解决的核心问题：**不同类型的网文遵循截然不同的叙事法则**。玄幻修真的"升级换地图"节奏与悬疑推理的"线索-误导-揭晓"结构无法共用同一套生成逻辑。类型内核为每种类型提供：

1. **节奏模板**：该类型的标准节奏曲线（如玄幻的"压抑-突破-震惊-收获"四拍子）
2. **爽点模式**：该类型读者期望的满足感触发模式
3. **禁忌清单**：该类型中会导致读者弃书的致命错误
4. **语气特征**：该类型的语言风格基线（词汇偏好、句式节奏、修辞密度）

### 6.1.2 五种类型的完整内核定义

#### A. 玄幻修真（Xuanhuan/Xianxia）

```json
{
  "genre_id": "xuanhuan_xianxia",
  "display_name": "玄幻修真",
  "version": "3.0",
  "core_philosophy": "力量即正义，成长即叙事。以主角的实力提升为核心驱动力，通过境界突破制造阶梯式爽感。",
  
  "rhythm_template": {
    "beat_structure": "四拍子循环",
    "beats": [
      {
        "name": "压抑",
        "purpose": "制造危机或限制，让读者产生'需要变强'的期待",
        "typical_length": "占章节15-25%",
        "key_elements": ["强敌出现", "资源匮乏", "境界瓶颈", "嘲讽/轻视"],
        "emotional_valence": -0.6,
        "tension_curve": "上升"
      },
      {
        "name": "突破",
        "purpose": "触发实力跃迁，释放压抑期的紧张感",
        "typical_length": "占章节10-15%",
        "key_elements": ["顿悟时刻", "破境异象", "功法晋级", "体质觉醒"],
        "emotional_valence": 0.8,
        "tension_curve": "陡升"
      },
      {
        "name": "震惊",
        "purpose": "让周围角色（和读者）见证主角实力，产生反差快感",
        "typical_length": "占章节30-40%",
        "key_elements": ["旁观者反应", "反派惊骇", "盟友振奋", "名场面形成"],
        "emotional_valence": 0.9,
        "tension_curve": "高位平台"
      },
      {
        "name": "收获",
        "purpose": "巩固成果，铺设下阶段伏笔",
        "typical_length": "占章节20-30%",
        "key_elements": ["战利品获取", "新地图线索", "势力态度转变", "新目标确立"],
        "emotional_valence": 0.5,
        "tension_curve": "缓降"
      }
    ],
    "macro_rhythm": {
      "arc_structure": "小副本→境界突破→地图切换→宗门斗争→位面飞升",
      "power_escalation_rule": "每30-50万字提升一个大境界，避免战力膨胀失控",
      "map_rotation_interval": "每80-120章更换主要地图场景"
    }
  },

  "satisfaction_patterns": [
    {
      "name": "越级挑战",
      "description": "主角以弱胜强，打破境界差距的常规认知",
      "trigger_frequency": "每20-30章一次大型越级战",
      "emotional_payoff": 0.95
    },
    {
      "name": "身份 reveal",
      "description": "隐藏身份被揭露，周围人态度180度转变",
      "trigger_frequency": "每大剧情线1-2次",
      "emotional_payoff": 0.9
    },
    {
      "name": "打脸",
      "description": "曾经轻视主角的人被事实狠狠打脸",
      "trigger_frequency": "适度，避免脸谱化",
      "emotional_payoff": 0.85
    },
    {
      "name": "宝物获取",
      "description": "获得珍稀功法、神器、灵宠等",
      "trigger_frequency": "每10-15章一次小收获",
      "emotional_payoff": 0.7
    },
    {
      "name": "师徒情深",
      "description": "与师尊之间的羁绊与回报",
      "trigger_frequency": "贯穿全篇",
      "emotional_payoff": 0.75
    }
  ],

  "taboo_list": [
    { "taboo": "战力体系崩坏", "severity": "fatal", "description": "前期需要苦修的境界后期随便突破，破坏成就感" },
    { "taboo": "反派降智", "severity": "fatal", "description": "高境界强者做出明显愚蠢决策，破坏世界真实感" },
    { "taboo": "女主花瓶化", "severity": "major", "description": "女性角色仅作为主角附属品存在，缺乏独立成长线" },
    { "taboo": "无限换皮", "severity": "major", "description": "换地图后剧情结构完全重复，只是角色名字不同" },
    { "taboo": "外挂依赖", "severity": "major", "description": "主角所有成就完全依赖金手指，无个人努力" },
    { "taboo": "境界描述同质化", "severity": "minor", "description": "每次突破描写雷同，缺乏新鲜感" },
    { "taboo": "过度解释设定", "severity": "minor", "description": "大段说明性文字打断叙事节奏" }
  ],

  "voice_characteristics": {
    "lexical_preferences": {
      "preferred_categories": ["古汉语词汇", "道教术语", "自然意象", "力量度量词"],
      "avoid_categories": ["现代口语", "科技词汇", "英文音译"],
      "signature_terms": ["道", "天", "劫", "缘", "造化", "混沌", "虚无", "周天"]
    },
    "sentence_rhythm": {
      "preferred_length": "短句为主，15-25字，战斗场景更短",
      "paragraph_structure": "3-5句一小段，对话独立成段",
      "pacing_markers": {
        "action": "用单句、断句制造速度感",
        "description": "用四字格、对偶句营造古典韵味",
        "monologue": "长句展示内心思考深度"
      }
    },
    "rhetorical_devices": {
      "preferred": ["比喻（自然意象）", "夸张（力量效果）", "对偶（功法描述）", "排比（境界罗列）"],
      "frequency": "修辞密度中等，战斗场景降低，描写场景提高"
    },
    "narrative_distance": "第三人称限知视角为主，偶尔全知视角展示天道/命运",
    "dialogue_style": "古风对白，称呼讲究辈分；强者简短有力，弱者谄媚或敬畏"
  }
}
```

#### B. 科幻未来（Sci-Fi）

```json
{
  "genre_id": "sci_fi",
  "display_name": "科幻未来",
  "version": "3.0",
  "core_philosophy": "科学即魔法，未知即恐怖。以科学概念为基础构建奇观，以人类处境为内核制造共鸣。",
  
  "rhythm_template": {
    "beat_structure": "发现问题→科学探索→危机爆发→技术解决→哲学反思",
    "beats": [
      {
        "name": "发现异常",
        "purpose": "抛出科幻钩子——无法用现有理论解释的现象",
        "typical_length": "占章节15-20%",
        "key_elements": ["异常数据", "未知信号", "技术故障", "科学谜题"],
        "emotional_valence": 0.2,
        "tension_curve": "缓升"
      },
      {
        "name": "探索求解",
        "purpose": "展示科学推理过程，满足读者智力参与感",
        "typical_length": "占章节30-40%",
        "key_elements": ["假设验证", "实验设计", "理论推导", "团队协作"],
        "emotional_valence": 0.4,
        "tension_curve": "波动上升"
      },
      {
        "name": "危机爆发",
        "purpose": "科学探索触发的意外后果，制造生存压力",
        "typical_length": "占章节20-25%",
        "key_elements": ["技术失控", "外星威胁", "资源枯竭", "伦理困境"],
        "emotional_valence": -0.7,
        "tension_curve": "陡升"
      },
      {
        "name": "突破解决",
        "purpose": "以科学/技术手段化解危机，展示人类智慧",
        "typical_length": "占章节15-20%",
        "key_elements": ["关键技术突破", "牺牲与抉择", "团队协作", "逆向工程"],
        "emotional_valence": 0.8,
        "tension_curve": "陡降后缓升"
      },
      {
        "name": "哲学回响",
        "purpose": "事件引发对科技、人性、未来的深层思考",
        "typical_length": "占章节5-10%",
        "key_elements": ["代价反思", "伦理讨论", "世界观更新", "新方向确立"],
        "emotional_valence": 0.3,
        "tension_curve": "缓降沉淀"
      }
    ],
    "macro_rhythm": {
      "arc_structure": "技术发现→社会冲击→文明危机→范式转换→新世界秩序",
      "idea_escalation_rule": "核心科幻概念每80-100万字升级一次复杂度",
      "world_expansion_interval": "每季揭示一层更大的世界观"
    }
  },

  "satisfaction_patterns": [
    {
      "name": "科学顿悟",
      "description": "主角/团队通过科学推理破解难题的'Aha!'时刻",
      "trigger_frequency": "每大剧情线2-3次",
      "emotional_payoff": 0.9
    },
    {
      "name": "技术奇观",
      "description": "宏大科技场景的震撼呈现（太空电梯、戴森球、星际舰队等）",
      "trigger_frequency": "每30-50章一次大奇观",
      "emotional_payoff": 0.85
    },
    {
      "name": "文明博弈",
      "description": "不同文明/势力间的战略对抗",
      "trigger_frequency": "主线推进",
      "emotional_payoff": 0.8
    },
    {
      "name": "人性考验",
      "description": "极端环境下人性的选择与坚守",
      "trigger_frequency": "关键节点",
      "emotional_payoff": 0.85
    }
  ],

  "taboo_list": [
    { "taboo": "科学设定自相矛盾", "severity": "fatal", "description": "核心科幻设定前后不一致，破坏世界观根基" },
    { "taboo": "用玄学解释科幻", "severity": "fatal", "description": "面对无法解释的现象用'精神力''意念'蒙混过关" },
    { "taboo": "科技无限升级无代价", "severity": "major", "description": "技术越先进越好，完全不讨论资源、伦理、副作用" },
    { "taboo": "扁平化外星文明", "severity": "major", "description": "外星文明只有一个统一意志或单一文化特征" },
    { "taboo": "大段说明性 exposition", "severity": "major", "description": "用整章篇幅解释科学设定，无叙事推进" },
    { "taboo": "角色成为设定传声筒", "severity": "minor", "description": "角色对话变成纯粹的概念解释" },
    { "taboo": "忽视尺度感", "severity": "minor", "description": "星际距离、时间跨度描写缺乏真实感" }
  ],

  "voice_characteristics": {
    "lexical_preferences": {
      "preferred_categories": ["科技术语", "工程词汇", "物理概念", "系统命名"],
      "avoid_categories": ["玄幻词汇", "过度口语化", "古汉语"],
      "signature_terms": ["矩阵", "协议", "场", "维度", "熵", "奇点", "辐射", "频率"]
    },
    "sentence_rhythm": {
      "preferred_length": "中等长度，20-35字，精确描述为主",
      "paragraph_structure": "逻辑递进式，前因后果清晰",
      "pacing_markers": {
        "technical": "使用术语链构建专业感",
        "crisis": "短句+精确数据制造紧迫感",
        "contemplative": "长句+比喻探讨哲学命题"
      }
    },
    "rhetorical_devices": {
      "preferred": ["精确类比", "数据对比", "尺度夸张", "反讽"],
      "frequency": "修辞密度偏低，依赖事实本身的震撼力"
    },
    "narrative_distance": "第三人称限知为主，硬科幻偏客观叙述，软科幻可深入内心",
    "dialogue_style": "专业术语自然融入对话；科学家对话有辩论感；日常对话简洁高效"
  }
}
```

#### C. 都市异能（Urban Fantasy/Supernatural）

```json
{
  "genre_id": "urban_supernatural",
  "display_name": "都市异能",
  "version": "3.0",
  "core_philosophy": "奇迹藏在日常之下。以现代都市为舞台，超自然力量与现实规则碰撞，制造'如果这是真的'的代入感。",
  
  "rhythm_template": {
    "beat_structure": "日常铺垫→异常入侵→隐藏战斗→善后伪装→秘密深化",
    "beats": [
      {
        "name": "日常",
        "purpose": "建立主角的普通人身份，制造反差基础",
        "typical_length": "占章节15-20%",
        "key_elements": ["工作生活", "人际关系", "经济压力", "身份伪装"],
        "emotional_valence": 0.1,
        "tension_curve": "平稳"
      },
      {
        "name": "异常入侵",
        "purpose": "超自然元素打破日常，制造危机感",
        "typical_length": "占章节15-20%",
        "key_elements": ["灵异事件", "敌人出现", "能力失控", "知情者接触"],
        "emotional_valence": -0.4,
        "tension_curve": "陡升"
      },
      {
        "name": "隐藏战斗",
        "purpose": "在普通人视线之外解决危机，维持'隐藏世界'设定",
        "typical_length": "占章节30-35%",
        "key_elements": ["结界/屏障", "记忆清除", "快速战斗", "能力展示"],
        "emotional_valence": 0.6,
        "tension_curve": "高位波动"
      },
      {
        "name": "善后伪装",
        "purpose": "回到日常但留下变化，推进人物关系",
        "typical_length": "占章节15-20%",
        "key_elements": ["解释借口", "关系进展", "新情报获取", "装备/能力提升"],
        "emotional_valence": 0.3,
        "tension_curve": "缓降"
      },
      {
        "name": "秘密深化",
        "purpose": "揭示隐藏世界的更大图景，铺设长线",
        "typical_length": "占章节5-10%",
        "key_elements": ["势力揭秘", "历史线索", "更大威胁暗示", "身份疑问"],
        "emotional_valence": 0.2,
        "tension_curve": "缓升"
      }
    ],
    "macro_rhythm": {
      "arc_structure": "觉醒→探索隐藏世界→卷入势力斗争→身世之谜→命运抉择",
      "power_reveal_rule": "能力逐步解锁，避免一开始就无敌",
      "world_layer_interval": "每60-80章揭开隐藏世界的一个新层级"
    }
  },

  "satisfaction_patterns": [
    {
      "name": "扮猪吃虎",
      "description": "表面普通人实则强大，关键时刻展现实力",
      "trigger_frequency": "每15-25章",
      "emotional_payoff": 0.9
    },
    {
      "name": "日常反差",
      "description": "超自然元素与现代生活的有趣碰撞",
      "trigger_frequency": "贯穿",
      "emotional_payoff": 0.7
    },
    {
      "name": "隐藏世界揭秘",
      "description": "逐步揭示隐藏在社会之下的超自然真相",
      "trigger_frequency": "每大剧情线",
      "emotional_payoff": 0.85
    },
    {
      "name": "双轨人生",
      "description": "平衡普通生活与超自然责任的张力",
      "trigger_frequency": "持续",
      "emotional_payoff": 0.75
    }
  ],

  "taboo_list": [
    { "taboo": "隐藏世界暴露无后果", "severity": "fatal", "description": "超自然大战在市中心进行却无人知晓/不在意，破坏设定根基" },
    { "taboo": "异能体系混乱", "severity": "fatal", "description": "能力设定前后矛盾，没有一致的规则约束" },
    { "taboo": "金手指过度便利", "severity": "major", "description": "能力获取没有代价，随意使用无限制" },
    { "taboo": "势力描写脸谱化", "severity": "major", "description": "正邪双方泾渭分明，没有灰色地带" },
    { "taboo": "忽视经济逻辑", "severity": "major", "description": "主角明明没有收入来源却能挥金如土" },
    { "taboo": "感情线喧宾夺主", "severity": "minor", "description": "异能主线推进缓慢，大量篇幅用于感情纠葛" },
    { "taboo": "现代常识错误", "severity": "minor", "description": "对现代都市生活的描写脱离实际" }
  ],

  "voice_characteristics": {
    "lexical_preferences": {
      "preferred_categories": ["现代口语", "网络用语", "品牌名", "都市地标"],
      "avoid_categories": ["古汉语", "过度书面语", "玄幻术语"],
      "signature_terms": ["灵力", "觉醒", "结界", "异常", "伪装", "事件", "组织"]
    },
    "sentence_rhythm": {
      "preferred_length": "口语化，10-25字",
      "paragraph_structure": "轻松活泼，长短交替",
      "pacing_markers": {
        "daily": "轻松节奏，幽默元素",
        "action": "短促有力，画面感强",
        "mystery": "节奏放缓，细节增多"
      }
    },
    "rhetorical_devices": {
      "preferred": ["反讽", "夸张", "对比", "吐槽"],
      "frequency": "中等偏高，符合都市轻松基调"
    },
    "narrative_distance": "第三人称限知，贴近主角内心吐槽",
    "dialogue_style": "现代口语化，有网络感；角色有鲜明的语言标签"
  }
}
```

#### D. 历史架空（Alternate History）

```json
{
  "genre_id": "alternate_history",
  "display_name": "历史架空",
  "version": "3.0",
  "core_philosophy": "历史的河流本可转向。以真实历史为骨架，以合理推演为血肉，让读者看见'另一种可能'。",
  
  "rhythm_template": {
    "beat_structure": "局势铺陈→矛盾激化→权谋博弈→事变爆发→格局重塑",
    "beats": [
      {
        "name": "局势铺陈",
        "purpose": "展示当前历史格局，建立政治/军事/经济版图",
        "typical_length": "占章节20-25%",
        "key_elements": ["朝堂局势", "各方势力", "民生百态", "制度描写"],
        "emotional_valence": 0.1,
        "tension_curve": "缓升"
      },
      {
        "name": "矛盾激化",
        "purpose": "多方利益冲突升级，不可调和",
        "typical_length": "占章节15-20%",
        "key_elements": ["政策冲突", "个人恩怨", "资源争夺", "理念对立"],
        "emotional_valence": -0.3,
        "tension_curve": "上升"
      },
      {
        "name": "权谋博弈",
        "purpose": "展示各方智慧较量，制造智力快感",
        "typical_length": "占章节30-35%",
        "key_elements": ["谋略布局", "信息不对称", "联盟背叛", "暗线操作"],
        "emotional_valence": 0.4,
        "tension_curve": "高位波动"
      },
      {
        "name": "事变爆发",
        "purpose": "矛盾总爆发，决定历史走向的关键事件",
        "typical_length": "占章节15-20%",
        "key_elements": ["战争", "政变", "刺杀", "天灾", "关键决策"],
        "emotional_valence": 0.7,
        "tension_curve": "陡升"
      },
      {
        "name": "格局重塑",
        "purpose": "事件后果扩散，新势力格局形成",
        "typical_length": "占章节10-15%",
        "key_elements": ["势力消长", "制度变革", "人物命运", "新篇章开启"],
        "emotional_valence": 0.3,
        "tension_curve": "缓降"
      }
    ],
    "macro_rhythm": {
      "arc_structure": "入局→站稳脚跟→小变局→大变局→改朝换代/天下大势",
      "historical_plausibility_rule": "每次蝴蝶效应必须有可追溯的因果链",
      "faction_complexity_interval": "每80-100章增加一个复杂维度"
    }
  },

  "satisfaction_patterns": [
    {
      "name": "历史名场面改写",
      "description": "以主角参与或促成的方式改写著名历史事件",
      "trigger_frequency": "每大剧情线1-2次",
      "emotional_payoff": 0.9
    },
    {
      "name": "权谋智斗",
      "description": "多方势力的智力较量与信息战",
      "trigger_frequency": "贯穿",
      "emotional_payoff": 0.85
    },
    {
      "name": "制度推演",
      "description": "新政/新制度带来的社会变化描写",
      "trigger_frequency": "中期开始每30-50章",
      "emotional_payoff": 0.75
    },
    {
      "name": "历史名人互动",
      "description": "与真实历史人物的合作或对抗",
      "trigger_frequency": "关键节点",
      "emotional_payoff": 0.8
    }
  ],

  "taboo_list": [
    { "taboo": "历史常识硬伤", "severity": "fatal", "description": "基本历史事实、制度、官职、礼仪错误" },
    { "taboo": "现代价值观强加", "severity": "fatal", "description": "主角以现代价值观要求古人，无人质疑" },
    { "taboo": "金手指过度", "severity": "major", "description": "随便发明超越时代的技术却无任何推广障碍" },
    { "taboo": "人物名字/设定雷同", "severity": "major", "description": "明显套用其他历史小说的经典设定" },
    { "taboo": "政治简单化", "severity": "major", "description": "复杂的政治斗争简化为善恶对立" },
    { "taboo": "战争描写游戏化", "severity": "minor", "description": "战争伤亡没有重量感，像打游戏" },
    { "taboo": "经济逻辑不通", "severity": "minor", "description": "钱粮军械 magically 充足，无视后勤" }
  ],

  "voice_characteristics": {
    "lexical_preferences": {
      "preferred_categories": ["历史术语", "官职名", "礼仪用语", "古语化词汇"],
      "avoid_categories": ["现代网络语", "科技词汇", "外来语"],
      "signature_terms": ["朕", "臣", "陛下", "大人", "谋", "势", "策", "天下"]
    },
    "sentence_rhythm": {
      "preferred_length": "中等偏长，20-40字，讲究韵律",
      "paragraph_structure": "层次分明，起承转合清晰",
      "pacing_markers": {
        "political": "冷静克制，信息密度高",
        "battle": "节奏加快，动词密集",
        "emotional": "节奏放缓，心理描写增多"
      }
    },
    "rhetorical_devices": {
      "preferred": ["典故引用", "对偶", "借代", "反问"],
      "frequency": "偏高，符合古典文学审美"
    },
    "narrative_distance": "第三人称全知/限知交替，大事全知，人物限知",
    "dialogue_style": "符合身份地位的说话方式；朝堂对话讲究分寸；私下对话可放松"
  }
}
```

#### E. 悬疑推理（Mystery/Thriller）

```json
{
  "genre_id": "mystery_thriller",
  "display_name": "悬疑推理",
  "version": "3.0",
  "core_philosophy": "信息即权力。通过精准控制信息披露节奏，让读者始终处于'差一点就能解开'的愉悦焦虑中。",
  
  "rhythm_template": {
    "beat_structure": "案件呈现→调查深入→伪解答→反转→真相揭露",
    "beats": [
      {
        "name": "案件呈现",
        "purpose": "抛出谜团——尸体、失踪、不可能犯罪",
        "typical_length": "占章节10-15%",
        "key_elements": ["犯罪现场", "初步线索", "嫌疑人登场", "侦探介入"],
        "emotional_valence": -0.2,
        "tension_curve": "陡升"
      },
      {
        "name": "调查深入",
        "purpose": "层层剥茧，线索累积同时误导增加",
        "typical_length": "占章节35-45%",
        "key_elements": ["取证", "问询", "线索分析", "伪线索", "关系网络"],
        "emotional_valence": 0.2,
        "tension_curve": "波动上升"
      },
      {
        "name": "伪解答",
        "purpose": "看似合理的解释，实则落入作者陷阱",
        "typical_length": "占章节10-15%",
        "key_elements": ["锁定嫌疑人", "证据链形成", "推理展示", "读者信服"],
        "emotional_valence": 0.6,
        "tension_curve": "陡降（虚假安全感）"
      },
      {
        "name": "反转",
        "purpose": "关键证据推翻伪解答，真正危机浮现",
        "typical_length": "占章节10-15%",
        "key_elements": ["矛盾发现", "新证据", "旧线索重解", "危险升级"],
        "emotional_valence": -0.5,
        "tension_curve": "陡升"
      },
      {
        "name": "真相揭露",
        "purpose": "所有线索归位，给出既意外又合理的解答",
        "typical_length": "占章节15-20%",
        "key_elements": ["完整推理", "动机揭示", "伏笔回收", "情感余韵"],
        "emotional_valence": 0.8,
        "tension_curve": "缓降沉淀"
      }
    ],
    "macro_rhythm": {
      "arc_structure": "独立案件→连环模式→幕后黑手→更大阴谋→终极对决",
      "clue_fairness_rule": "所有关键线索必须在揭晓前向读者展示过",
      "misdirection_interval": "每3-5章布置一个有效误导"
    }
  },

  "satisfaction_patterns": [
    {
      "name": "推理快感",
      "description": "读者跟随侦探推理，线索拼接的智力满足",
      "trigger_frequency": "每案1-2次大型推理展示",
      "emotional_payoff": 0.9
    },
    {
      "name": "反转震撼",
      "description": "意料之外、情理之中的真相揭露",
      "trigger_frequency": "每案1-2次核心反转",
      "emotional_payoff": 0.95
    },
    {
      "name": "伏笔回收",
      "description": "早期看似无关的细节成为关键证据",
      "trigger_frequency": "每案3-5次",
      "emotional_payoff": 0.85
    },
    {
      "name": "心理惊悚",
      "description": "揭示人性阴暗面，制造不寒而栗感",
      "trigger_frequency": "关键案件",
      "emotional_payoff": 0.8
    }
  ],

  "taboo_list": [
    { "taboo": "线索不公平", "severity": "fatal", "description": "侦探知道读者不知道的线索，破坏推理公平性" },
    { "taboo": "巧合破案", "severity": "fatal", "description": "关键证据偶然发现而非推理得出" },
    { "taboo": "凶手无铺垫", "severity": "fatal", "description": "真凶是最后几章才出现的全新角色" },
    { "taboo": "动机薄弱", "severity": "major", "description": "犯罪动机过于牵强，无法令人信服" },
    { "taboo": "推理错误", "severity": "major", "description": "核心推理存在逻辑漏洞" },
    { "taboo": "过度渲染暴力", "severity": "minor", "description": "用血腥描写替代智力层面的惊悚" },
    { "taboo": "系列疲劳", "severity": "minor", "description": "案件套路重复，缺乏新意" }
  ],

  "voice_characteristics": {
    "lexical_preferences": {
      "preferred_categories": ["精确描述", "心理词汇", "法律术语", "逻辑用语"],
      "avoid_categories": ["模糊修饰", "夸张修辞", "古风词汇"],
      "signature_terms": ["线索", "证据", "动机", "不在场证明", "嫌疑", "逻辑", "矛盾"]
    },
    "sentence_rhythm": {
      "preferred_length": "变化丰富，根据紧张度调整",
      "paragraph_structure": "信息密度高，每段承载一个事实或发现",
      "pacing_markers": {
        "investigation": "冷静客观，条理清晰",
        "suspense": "短句，留白，节奏加快",
        "revelation": "层层递进，逻辑链条清晰"
      }
    },
    "rhetorical_devices": {
      "preferred": ["伏笔", "暗示", "对比", "突降"],
      "frequency": "隐蔽使用，不为修辞而修辞"
    },
    "narrative_distance": "以侦探视角为主，必要时切换嫌疑人视角制造悬念",
    "dialogue_style": "问询对话信息密度高；嫌疑人对话各有隐藏；侦探内心独白展示推理"
  }
}
```

### 6.1.3 类型内核 JSON Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "GenreKernel",
  "type": "object",
  "required": ["genre_id", "display_name", "version", "core_philosophy", 
               "rhythm_template", "satisfaction_patterns", "taboo_list", "voice_characteristics"],
  "properties": {
    "genre_id": {
      "type": "string",
      "description": "类型唯一标识符，小写下划线格式",
      "pattern": "^[a-z][a-z0-9_]*$"
    },
    "display_name": {
      "type": "string",
      "description": "类型显示名称"
    },
    "version": {
      "type": "string",
      "description": "内核版本号",
      "pattern": "^\\d+\\.\\d+$"
    },
    "core_philosophy": {
      "type": "string",
      "description": "该类型的核心叙事哲学，一句话概括"
    },
    "rhythm_template": {
      "type": "object",
      "required": ["beat_structure", "beats", "macro_rhythm"],
      "properties": {
        "beat_structure": {
          "type": "string",
          "description": "节奏结构的人类可读描述"
        },
        "beats": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["name", "purpose", "typical_length", "key_elements", "emotional_valence", "tension_curve"],
            "properties": {
              "name": { "type": "string" },
              "purpose": { "type": "string" },
              "typical_length": { "type": "string" },
              "key_elements": {
                "type": "array",
                "items": { "type": "string" }
              },
              "emotional_valence": {
                "type": "number",
                "minimum": -1,
                "maximum": 1
              },
              "tension_curve": {
                "type": "string",
                "enum": ["上升", "陡升", "高位平台", "缓降", "陡降后缓升", "缓降沉淀", "平稳", "波动上升", "高位波动", "缓升"]
              }
            }
          }
        },
        "macro_rhythm": {
          "type": "object",
          "required": ["arc_structure"],
          "properties": {
            "arc_structure": { "type": "string" },
            "additionalProperties": true
          }
        }
      }
    },
    "satisfaction_patterns": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["name", "description", "trigger_frequency", "emotional_payoff"],
        "properties": {
          "name": { "type": "string" },
          "description": { "type": "string" },
          "trigger_frequency": { "type": "string" },
          "emotional_payoff": {
            "type": "number",
            "minimum": 0,
            "maximum": 1
          }
        }
      }
    },
    "taboo_list": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["taboo", "severity", "description"],
        "properties": {
          "taboo": { "type": "string" },
          "severity": {
            "type": "string",
            "enum": ["fatal", "major", "minor"]
          },
          "description": { "type": "string" }
        }
      }
    },
    "voice_characteristics": {
      "type": "object",
      "required": ["lexical_preferences", "sentence_rhythm", "rhetorical_devices", "narrative_distance", "dialogue_style"],
      "properties": {
        "lexical_preferences": {
          "type": "object",
          "required": ["preferred_categories", "avoid_categories"],
          "properties": {
            "preferred_categories": {
              "type": "array",
              "items": { "type": "string" }
            },
            "avoid_categories": {
              "type": "array",
              "items": { "type": "string" }
            },
            "signature_terms": {
              "type": "array",
              "items": { "type": "string" }
            }
          }
        },
        "sentence_rhythm": {
          "type": "object",
          "required": ["preferred_length", "paragraph_structure"],
          "properties": {
            "preferred_length": { "type": "string" },
            "paragraph_structure": { "type": "string" },
            "pacing_markers": {
              "type": "object",
              "additionalProperties": { "type": "string" }
            }
          }
        },
        "rhetorical_devices": {
          "type": "object",
          "required": ["preferred"],
          "properties": {
            "preferred": {
              "type": "array",
              "items": { "type": "string" }
            },
            "frequency": { "type": "string" }
          }
        },
        "narrative_distance": { "type": "string" },
        "dialogue_style": { "type": "string" }
      }
    },
    "parent_genre": {
      "type": "string",
      "description": "父类型genre_id，支持类型继承"
    },
    "hybrid_with": {
      "type": "array",
      "items": { "type": "string" },
      "description": "可混合的类型列表"
    }
  }
}
```

### 6.1.4 类型检测与切换逻辑

#### A. 自动类型检测

```python
class GenreDetector:
    """
    类型检测器：基于多维度信号自动判断当前章节所属类型
    """
    
    SIGNAL_WEIGHTS = {
        "keyword_density": 0.25,      # 类型关键词频率
        "character_archetype": 0.20,  # 角色原型匹配度
        "plot_pattern": 0.25,         # 情节模式匹配
        "setting_markers": 0.15,      # 场景标记
        "dialogue_style": 0.10,       # 对话风格
        "author_explicit": 0.05       # 作者显式标注
    }
    
    TYPE_KEYWORDS = {
        "xuanhuan_xianxia": ["修炼", "境界", "灵气", "功法", "法宝", "丹药", 
                            "宗门", "飞升", "渡劫", "灵根", "元婴", "化神"],
        "sci_fi": ["飞船", "星舰", "AI", "基因", "量子", "维度", "外星", 
                  "曲率", "曲速", "跃迁", "克隆", "赛博"],
        "urban_supernatural": ["觉醒", "异能", "灵异", "鬼魂", "驱魔", "超能力",
                              "妖怪", "都市", "隐藏", "伪装"],
        "alternate_history": ["朕", "陛下", "大人", "科举", "朝政", "兵马",
                             "天下", "江山", "朝代", "改革"],
        "mystery_thriller": ["尸体", "凶手", "线索", "不在场证明", "侦探",
                            "动机", "证据", "嫌疑", "推理", "密室"]
    }
    
    def detect(self, chapter_text: str, chapter_brief: dict, 
               previous_genre: str = None) -> GenreDetectionResult:
        """
        类型检测主流程
        
        输入：
        - chapter_text: 章节正文样本（前3000字）
        - chapter_brief: 章节Brief中的标签信息
        - previous_genre: 上一章检测到的类型
        
        输出：
        - primary_genre: 主类型
        - confidence: 置信度 (0-1)
        - secondary_genres: 副类型列表（混合类型时）
        - switch_recommendation: 是否建议切换类型
        """
        scores = {}
        
        # 1. 关键词密度评分
        for genre_id, keywords in self.TYPE_KEYWORDS.items():
            matches = sum(1 for kw in keywords if kw in chapter_text)
            scores[genre_id] = scores.get(genre_id, 0) + \
                (matches / len(keywords)) * self.SIGNAL_WEIGHTS["keyword_density"]
        
        # 2. Brief中的显式标签
        if "genre_tags" in chapter_brief:
            for tag in chapter_brief["genre_tags"]:
                if tag in scores:
                    scores[tag] += self.SIGNAL_WEIGHTS["author_explicit"]
        
        # 3. 角色原型匹配（通过角色名称和描述推断）
        # ... (实现细节省略)
        
        # 4. 平滑处理：与上一章类型保持连续性
        if previous_genre and previous_genre in scores:
            # 除非新类型得分显著高于旧类型，否则倾向保持
            max_other = max(v for k, v in scores.items() if k != previous_genre)
            if scores[previous_genre] > max_other * 0.7:
                scores[previous_genre] *= 1.2
        
        # 排序并返回
        sorted_scores = sorted(scores.items(), key=lambda x: x[1], reverse=True)
        primary = sorted_scores[0]
        
        return GenreDetectionResult(
            primary_genre=primary[0],
            confidence=min(primary[1] / 0.8, 1.0),  # 归一化
            secondary_genres=[g for g, s in sorted_scores[1:] if s > 0.3],
            switch_recommendation=previous_genre is not None and primary[0] != previous_genre
        )
```

#### B. 类型切换协议

```
类型切换触发条件（满足任一即触发）：
1. 连续3章检测置信度 < 0.6，进入"类型模糊"状态
2. 作者显式在Brief中标注类型切换
3. 可能性清单中定义了新的类型方向
4. 检测器返回 switch_recommendation = true 且置信度 > 0.75

切换流程：
1. [触发] → 2. [加载新类型内核] → 3. [平滑过渡提示生成] → 4. [写入类型切换日志]
                                                ↓
                                    [生成类型切换简报]
                                    - 新旧类型的关键差异
                                    - 语气调整建议
                                    - 读者预期管理

平滑过渡策略：
- 切换后前3章使用"过渡模式"：保持旧类型30%的语气特征
- 节奏模板采用加权混合：new_weight = min(chapter_idx_since_switch / 3, 1.0)
- 禁忌清单取并集（新旧类型的禁忌都遵守）

类型切换日志格式：
{
  "switch_id": "uuid",
  "chapter_number": 125,
  "trigger": "detector_confidence|author_explicit|manifest_change",
  "from_genre": "xuanhuan_xianxia",
  "to_genre": "sci_fi",
  "confidence": 0.82,
  "transition_brief": "过渡简报内容",
  "smoothing_chapters": 3,
  "timestamp": "2025-01-15T10:30:00Z"
}
```

#### C. 混合类型支持

```
混合类型定义：
- 主类型决定节奏模板和禁忌清单
- 副类型仅影响爽点模式和语气特征的部分维度
- 最多支持2个副类型

混合优先级：
1. 主类型的节奏模板（100%权重）
2. 爽点模式：主类型60% + 副类型各20%
3. 语气特征：主类型70% + 副类型各15%
4. 禁忌清单：所有类型的并集

示例混合配置：
{
  "primary": "urban_supernatural",
  "secondary": ["mystery_thriller"],
  "blend_weights": {
    "rhythm": {"urban_supernatural": 1.0},
    "satisfaction": {"urban_supernatural": 0.6, "mystery_thriller": 0.4},
    "voice": {"urban_supernatural": 0.7, "mystery_thriller": 0.3},
    "taboo": "union"
  }
}
```

---

## 6.2 AMA 代理模型蒸馏（Author Model Adaptation）

### 6.2.1 设计目标

AMA 是 NarrativeOS 的**风格学习子系统**。其核心问题：**如何让 LLM 生成的文本读起来像作者本人写的？**

传统方案（少样本示例、风格描述词）在长篇章创作中存在根本缺陷：
- 少样本示例容量有限，无法捕捉作者风格的全部维度
- 风格描述词过于抽象，难以转化为具体的生成指导
- 作者风格是动态演进的，静态配置无法跟随

AMA 的解决思路：**通过多轮蒸馏对话，将作者风格转化为结构化的风格配置文件，在生成时作为五层Prompt中风格层的输入。**

### 6.2.2 风格向量定义

风格是作者文本的"指纹"，AMA 将其解构为 **7 个维度、28 个子维度** 的风格向量：

```json
{
  "style_vector_schema": {
    "version": "3.0",
    "dimensions": [
      {
        "id": "sentence_structure",
        "name": "句式结构",
        "weight": 0.20,
        "sub_dimensions": [
          {
            "id": "avg_sentence_length",
            "name": "平均句长",
            "type": "continuous",
            "range": [5, 80],
            "unit": "字/句",
            "description": "作者平均每个句子的字数，短句偏快节奏，长句偏沉稳"
          },
          {
            "id": "sentence_length_variance",
            "name": "句长变异度",
            "type": "continuous",
            "range": [0, 1],
            "description": "句长变化的剧烈程度，高变异度制造节奏感"
          },
          {
            "id": "short_sentence_ratio",
            "name": "短句占比",
            "type": "continuous",
            "range": [0, 1],
            "description": "15字以下句子的占比"
          },
          {
            "id": "paragraph_avg_sentences",
            "name": "段均句数",
            "type": "continuous",
            "range": [1, 15],
            "unit": "句/段",
            "description": "平均每段包含的句子数"
          },
          {
            "id": "complex_sentence_ratio",
            "name": "复句占比",
            "type": "continuous",
            "range": [0, 1],
            "description": "包含多个分句的复杂句子占比"
          }
        ]
      },
      {
        "id": "vocabulary_profile",
        "name": "词汇画像",
        "weight": 0.20,
        "sub_dimensions": [
          {
            "id": "lexical_diversity",
            "name": "词汇多样性",
            "type": "continuous",
            "range": [0, 1],
            "description": "TTR（Type-Token Ratio），高值表示词汇丰富"
          },
          {
            "id": "archaism_ratio",
            "name": "古语使用率",
            "type": "continuous",
            "range": [0, 1],
            "description": "古典词汇占总词汇的比例"
          },
          {
            "id": "modern_slang_ratio",
            "name": "现代口语率",
            "type": "continuous",
            "range": [0, 1],
            "description": "现代口语/网络用语的使用比例"
          },
          {
            "id": "sensory_word_ratio",
            "name": "感官词密度",
            "type": "continuous",
            "range": [0, 1],
            "description": "视觉/听觉/触觉/嗅觉/味觉词汇的密度"
          },
          {
            "id": "signature_words",
            "name": "标志性词汇",
            "type": "list",
            "description": "作者高频使用的特色词汇列表（top 50）"
          }
        ]
      },
      {
        "id": "rhetoric_pattern",
        "name": "修辞模式",
        "weight": 0.15,
        "sub_dimensions": [
          {
            "id": "metaphor_density",
            "name": "比喻密度",
            "type": "continuous",
            "range": [0, 1],
            "description": "明喻、暗喻、借喻的使用频率"
          },
          {
            "id": "metaphor_preference",
            "name": "比喻偏好域",
            "type": "categorical",
            "options": ["自然意象", "战争意象", "生活意象", "神话意象", "科技意象"],
            "description": "作者偏好的比喻来源域"
          },
          {
            "id": "hyperbole_ratio",
            "name": "夸张程度",
            "type": "continuous",
            "range": [0, 1],
            "description": "夸张修辞的使用强度"
          },
          {
            "id": "parallelism_ratio",
            "name": "排偶使用率",
            "type": "continuous",
            "range": [0, 1],
            "description": "排比、对偶等平行结构的使用比例"
          }
        ]
      },
      {
        "id": "pacing_rhythm",
        "name": "节奏韵律",
        "weight": 0.15,
        "sub_dimensions": [
          {
            "id": "info_density",
            "name": "信息密度",
            "type": "continuous",
            "range": [0, 1],
            "description": "单位字数内承载的叙事信息量"
          },
          {
            "id": "action_description_ratio",
            "name": "动静比",
            "type": "continuous",
            "range": [0, 1],
            "description": "动作描写与静态描写的比例"
          },
          {
            "id": "scene_transition_pace",
            "name": "场景切换节奏",
            "type": "categorical",
            "options": ["快速切换", "平缓过渡", "慢镜头", "意识流"],
            "description": "场景之间的切换方式"
          },
          {
            "id": "tension_curve_style",
            "name": "张力曲线风格",
            "type": "categorical",
            "options": ["阶梯式", "波浪式", "悬崖式", "渐进式"],
            "description": "章节内张力变化的典型模式"
          }
        ]
      },
      {
        "id": "narrative_voice",
        "name": "叙事声音",
        "weight": 0.15,
        "sub_dimensions": [
          {
            "id": "narrative_distance",
            "name": "叙事距离",
            "type": "categorical",
            "options": ["客观疏远", "有限知情", "深度共情", "全知全能"],
            "description": "叙述者与故事世界的距离"
          },
          {
            "id": "irony_usage",
            "name": "反讽使用度",
            "type": "continuous",
            "range": [0, 1],
            "description": "反讽、调侃、黑色幽默的使用程度"
          },
          {
            "id": "introspection_depth",
            "name": "内省深度",
            "type": "continuous",
            "range": [0, 1],
            "description": "心理描写和内心独白的深度与频率"
          },
          {
            "id": "show_tell_balance",
            "name": "show/tell平衡",
            "type": "continuous",
            "range": [0, 1],
            "description": "0=纯show（展示），1=纯tell（讲述）"
          }
        ]
      },
      {
        "id": "dialogue_style",
        "name": "对话风格",
        "weight": 0.10,
        "sub_dimensions": [
          {
            "id": "dialogue_ratio",
            "name": "对话占比",
            "type": "continuous",
            "range": [0, 1],
            "description": "对话在正文中的占比"
          },
          {
            "id": "dialogue_tag_style",
            "name": "对话标签风格",
            "type": "categorical",
            "options": ["简洁said式", "动作替代式", "丰富副词式", "混合式"],
            "description": "如何标注说话人"
          },
          {
            "id": "dialogue_sentence_length",
            "name": "对话句长",
            "type": "continuous",
            "range": [5, 50],
            "unit": "字/句",
            "description": "对话句子的平均长度"
          },
          {
            "id": "subtext_density",
            "name": "潜台词密度",
            "type": "continuous",
            "range": [0, 1],
            "description": "对话中言外之意/话里有话的程度"
          }
        ]
      },
      {
        "id": "genre_flavor",
        "name": "类型风味",
        "weight": 0.05,
        "sub_dimensions": [
          {
            "id": "primary_genre_affinity",
            "name": "主类型亲和度",
            "type": "categorical",
            "options": ["xuanhuan", "sci_fi", "urban", "history", "mystery", "romance", "military"],
            "description": "作者风格最契合的类型"
          },
          {
            "id": "worldbuilding_density",
            "name": "世界观铺设密度",
            "type": "continuous",
            "range": [0, 1],
            "description": "设定解释和世界观描写的密度"
          },
          {
            "id": "humor_style",
            "name": "幽默风格",
            "type": "categorical",
            "options": ["无", "冷幽默", "吐槽", "讽刺", "夸张", "黑色"],
            "description": "作者的幽默表达方式"
          }
        ]
      }
    ],
    "derived_metrics": {
      "style_fingerprint": "SHA256(标准化风格向量)",
      "consistency_score": "跨章节风格向量的平均相似度",
      "evolution_rate": "风格向量随时间的变化速度"
    }
  }
}
```

### 6.2.3 风格学习算法

#### A. 学习流程概览

```
阶段一：样本采集
├── 输入：作者已完成的章节正文（最少3章，推荐20+章）
├── 处理：按章节分块，过滤纯对话/纯描写等极端样本
└── 输出：标准化样本集

阶段二：多轮蒸馏
├── 轮次1：句式与词汇维度提取
├── 轮次2：修辞与节奏维度提取
├── 轮次3：叙事声音与对话风格提取
├── 轮次4：类型风味校准
└── 轮次5：综合整合与一致性校验

阶段三：配置生成
├── 风格向量 → 标准化数值
├── 风格描述 → 自然语言风格指南
├── 示例库 → top 20 代表性段落
└── 约束规则 → 必须遵守/避免清单

阶段四：质量验证
├── 生成测试段落（5段）
├── 作者盲评（像不像？1-10分）
├── 分数 < 7 → 回到阶段二增加样本
└── 分数 >= 7 → 锁定配置
```

#### B. 蒸馏 Prompt 模板（多轮对话结构）

**轮次1：句式与词汇**

```
[SYSTEM]
你是 NarrativeOS 的风格分析师。你的任务是从作者的文本样本中提取精确的风格特征。
分析原则：
- 只报告实际观察到的模式，不做主观评价
- 所有数值必须基于文本统计，不得猜测
- 使用精确的文学术语描述
- 区分"常见模式"（>50%出现）和"偶尔模式"（20-50%）

输出必须严格遵循指定的 JSON 格式。

[USER]
请分析以下文本样本的【句式结构】和【词汇画像】维度。

样本（共{sample_count}段，来自{work_title}第{chapter_range}章）：
---
{text_samples}
---

请输出以下 JSON 格式：
{
  "sentence_structure": {
    "avg_sentence_length": {"value": 数值, "unit": "字", "confidence": "high|medium|low"},
    "sentence_length_variance": {"value": 0-1, "pattern_description": "描述"},
    "short_sentence_ratio": {"value": 0-1},
    "paragraph_avg_sentences": {"value": 数值},
    "complex_sentence_ratio": {"value": 0-1},
    "distinctive_patterns": [
      {"pattern": "模式描述", "frequency": "常见|偶尔", "example": "原文例句"}
    ]
  },
  "vocabulary_profile": {
    "lexical_diversity": {"value": 0-1, "note": "说明"},
    "archaism_ratio": {"value": 0-1},
    "modern_slang_ratio": {"value": 0-1},
    "sensory_word_ratio": {"value": 0-1},
    "sensory_distribution": {"visual": 0-1, "auditory": 0-1, "tactile": 0-1, "olfactory": 0-1, "gustatory": 0-1},
    "signature_words": ["高频特色词1", "高频特色词2", ...],
    "distinctive_phrases": ["标志性短语1", ...],
    "word_choice_notes": "关于用词选择的总体描述"
  }
}
```

**轮次2：修辞与节奏**

```
[USER]
基于同一组样本，请分析【修辞模式】和【节奏韵律】维度。

{
  "rhetoric_pattern": {
    "metaphor_density": {"value": 0-1, "examples": [{"metaphor": "原文比喻句", "type": "明喻|暗喻|借喻"}]},
    "metaphor_preference": {"primary_domain": "偏好域", "examples": ["例句"]},
    "hyperbole_ratio": {"value": 0-1},
    "parallelism_ratio": {"value": 0-1, "examples": ["排偶例句"]},
    "other_devices": [{"device": "修辞手法", "frequency": "常见|偶尔", "example": "例句"}]
  },
  "pacing_rhythm": {
    "info_density": {"value": 0-1, "description": "信息密度描述"},
    "action_description_ratio": {"value": 0-1},
    "scene_transition_pace": {"style": "快速切换|平缓过渡|慢镜头|意识流", "examples": ["场景切换例句"]},
    "tension_curve_style": {"pattern": "阶梯式|波浪式|悬崖式|渐进式", "evidence": "证据描述"},
    "rhythm_notes": "关于整体节奏特征的总体描述"
  }
}
```

**轮次3：叙事声音与对话**

```
[USER]
继续分析【叙事声音】和【对话风格】维度。

{
  "narrative_voice": {
    "narrative_distance": {"style": "客观疏远|有限知情|深度共情|全知全能", "evidence": "证据"},
    "irony_usage": {"value": 0-1, "examples": ["反讽例句"]},
    "introspection_depth": {"value": 0-1, "sample": "典型内心独白片段"},
    "show_tell_balance": {"value": 0-1, "description": "show与tell的平衡描述"},
    "narrative_quirks": ["叙事特色1", "叙事特色2"]
  },
  "dialogue_style": {
    "dialogue_ratio": {"value": 0-1},
    "dialogue_tag_style": {"style": "简洁said式|动作替代式|丰富副词式|混合式", "examples": ["对话标注例句"]},
    "dialogue_sentence_length": {"avg": 数值, "range": "最短-最长"},
    "subtext_density": {"value": 0-1, "examples": [{"surface": "表面意思", "subtext": "潜台词"}]},
    "dialogue_distinctive_features": ["对话特色1", "对话特色2"]
  }
}
```

**轮次4：综合校准**

```
[USER]
请基于前3轮的分析结果，进行综合校准并输出【类型风味】维度和总体评估。

前序分析摘要：
{summary_of_previous_rounds}

请输出：
{
  "genre_flavor": {
    "primary_genre_affinity": "最契合的类型",
    "worldbuilding_density": {"value": 0-1},
    "humor_style": "无|冷幽默|吐槽|讽刺|夸张|黑色",
    "genre_hybrid_notes": "如果存在类型混合特征，请说明"
  },
  "overall_assessment": {
    "style_signature": "用3-5句话概括作者的风格签名",
    "most_distinctive_features": ["最独特的特征1", "最独特的特征2", "最独特的特征3"],
    "consistency_level": "高|中|低",
    "notable_variations": "作者风格在不同情境下的变化模式"
  }
}
```

**轮次5：风格指南生成**

```
[USER]
请将所有分析结果转化为一段【生成用风格指南】——这段指南将直接用于指导 AI 生成作者风格的文本。

风格指南要求：
1. 以第二人称"你应该"的指令式语气编写
2. 具体可执行，避免抽象形容词（不用"优美的"，用"使用四字格的排比句描写自然景物"）
3. 包含正面指令（应该做什么）和负面约束（不应该做什么）
4. 长度控制在800-1200字
5. 附带3-5个代表性示例段落

前序完整分析：
{complete_analysis_json}

请输出：
{
  "style_guide_markdown": "# 风格指南\n\n## 句式\n...",
  "representative_samples": [
    {"context": "上下文说明", "text": "代表性段落", "why_representative": "代表性原因"}
  ],
  "must_follow_rules": ["必须遵守的规则1", "必须遵守的规则2"],
  "must_avoid_rules": ["必须避免的模式1", "必须避免的模式2"]
}
```

### 6.2.4 风格配置文件存储格式

```json
{
  "ama_config": {
    "config_id": "ama_cfg_001",
    "author_id": "author_uuid",
    "work_id": "work_uuid",
    "version": 5,
    "created_at": "2025-01-10T08:00:00Z",
    "updated_at": "2025-01-15T14:30:00Z",
    
    "distillation_meta": {
      "source_chapters": [1, 2, 3, 5, 8, 12, 15, 20, 25, 30],
      "total_sample_words": 125000,
      "distillation_rounds": 5,
      "author_blind_score": 8.2,
      "confidence_level": "high"
    },
    
    "style_vector": {
      "sentence_structure": {
        "avg_sentence_length": 22.5,
        "sentence_length_variance": 0.65,
        "short_sentence_ratio": 0.35,
        "paragraph_avg_sentences": 4.2,
        "complex_sentence_ratio": 0.28
      },
      "vocabulary_profile": {
        "lexical_diversity": 0.72,
        "archaism_ratio": 0.45,
        "modern_slang_ratio": 0.08,
        "sensory_word_ratio": 0.38,
        "signature_words": ["造化", "虚无", "周天", "混沌", "道韵"]
      },
      "rhetoric_pattern": {
        "metaphor_density": 0.42,
        "metaphor_preference": "自然意象",
        "hyperbole_ratio": 0.35,
        "parallelism_ratio": 0.55
      },
      "pacing_rhythm": {
        "info_density": 0.60,
        "action_description_ratio": 0.65,
        "scene_transition_pace": "平缓过渡",
        "tension_curve_style": "波浪式"
      },
      "narrative_voice": {
        "narrative_distance": "深度共情",
        "irony_usage": 0.25,
        "introspection_depth": 0.70,
        "show_tell_balance": 0.35
      },
      "dialogue_style": {
        "dialogue_ratio": 0.30,
        "dialogue_tag_style": "动作替代式",
        "dialogue_sentence_length": 18.5,
        "subtext_density": 0.40
      },
      "genre_flavor": {
        "primary_genre_affinity": "xuanhuan",
        "worldbuilding_density": 0.55,
        "humor_style": "冷幽默"
      }
    },
    
    "style_guide_markdown": "# 风格指南\n\n## 句式结构\n...",
    
    "representative_samples": [
      {
        "sample_id": "s001",
        "context": "战斗场景",
        "text": "剑光一闪...",
        "embedding": [0.12, -0.05, ...]
      }
    ],
    
    "generation_constraints": {
      "must_follow": [
        "描写自然景物时使用四字格排比",
        "对话使用动作替代对话标签",
        "战斗场景每段不超过5句"
      ],
      "must_avoid": [
        "现代网络用语",
        "直接叙述角色情绪（应通过动作/神态展示）",
        "超过40字的长句"
      ]
    },
    
    "evolution_log": [
      {
        "version": 1,
        "trigger": "initial_distillation",
        "changed_dimensions": ["all"],
        "author_score": 6.5,
        "timestamp": "2025-01-10T08:00:00Z"
      },
      {
        "version": 5,
        "trigger": "new_chapters_20_30",
        "changed_dimensions": ["narrative_voice.introspection_depth", "dialogue_style.subtext_density"],
        "author_score": 8.2,
        "timestamp": "2025-01-15T14:30:00Z"
      }
    ]
  }
}
```

### 6.2.5 风格一致性的量化评估

```python
class StyleConsistencyEvaluator:
    """
    风格一致性评估器：量化评估生成文本与作者风格配置的匹配度
    """
    
    DIMENSION_WEIGHTS = {
        "sentence_structure": 0.20,
        "vocabulary_profile": 0.20,
        "rhetoric_pattern": 0.15,
        "pacing_rhythm": 0.15,
        "narrative_voice": 0.15,
        "dialogue_style": 0.10,
        "genre_flavor": 0.05
    }
    
    def evaluate(self, generated_text: str, style_config: AMAConfig) -> StyleScore:
        """
        评估生成文本的风格匹配度
        
        返回综合分数和各维度明细
        """
        scores = {}
        
        # 1. 句式结构匹配度
        scores["sentence_structure"] = self._eval_sentence_structure(
            generated_text, style_config.style_vector.sentence_structure
        )
        
        # 2. 词汇画像匹配度
        scores["vocabulary_profile"] = self._eval_vocabulary(
            generated_text, style_config.style_vector.vocabulary_profile
        )
        
        # 3. 修辞模式匹配度
        scores["rhetoric_pattern"] = self._eval_rhetoric(
            generated_text, style_config.style_vector.rhetoric_pattern
        )
        
        # 4. 节奏韵律匹配度
        scores["pacing_rhythm"] = self._eval_pacing(
            generated_text, style_config.style_vector.pacing_rhythm
        )
        
        # 5. 叙事声音匹配度
        scores["narrative_voice"] = self._eval_narrative_voice(
            generated_text, style_config.style_vector.narrative_voice
        )
        
        # 6. 对话风格匹配度
        scores["dialogue_style"] = self._eval_dialogue(
            generated_text, style_config.style_vector.dialogue_style
        )
        
        # 7. 类型风味匹配度
        scores["genre_flavor"] = self._eval_genre_flavor(
            generated_text, style_config.style_vector.genre_flavor
        )
        
        # 加权综合
        total_score = sum(
            scores[dim] * weight 
            for dim, weight in self.DIMENSION_WEIGHTS.items()
        )
        
        return StyleScore(
            total=min(total_score, 1.0),
            dimensions=scores,
            passed=total_score >= 0.70,  # 70分及格线
            weak_dimensions=[d for d, s in scores.items() if s < 0.60]
        )
    
    def _eval_sentence_structure(self, text: str, target: dict) -> float:
        """句式结构匹配度计算"""
        # 实际实现：分句→统计句长分布→计算分布相似度（KL散度或余弦相似）
        sentences = self._segment_sentences(text)
        actual_lengths = [len(s) for s in sentences]
        
        avg_length_score = 1.0 - min(
            abs(np.mean(actual_lengths) - target["avg_sentence_length"]) / target["avg_sentence_length"],
            1.0
        )
        
        variance_score = 1.0 - min(
            abs(np.std(actual_lengths) / np.mean(actual_lengths) - target["sentence_length_variance"]),
            1.0
        )
        
        return (avg_length_score * 0.5 + variance_score * 0.3 + 
                self._short_sentence_ratio_score(actual_lengths, target) * 0.2)
```

### 6.2.6 风格更新触发条件

```
AMA 配置不是静态的，作者风格会自然演进。更新触发条件：

1. 定时更新：每完成30章自动触发增量蒸馏
2. 分数下降：连续5章风格评分 < 0.65，触发诊断蒸馏
3. 作者主动：作者在审阅界面点击"更新风格配置"
4. 重大转折： Brief 中标注"风格转型期"
5. 新作品：开始新作品时，基于旧作品配置 + 新样本重新蒸馏

增量蒸馏策略：
- 保留已有配置中稳定的部分（变化 < 10%）
- 只重新蒸馏变化的维度
- 新增样本权重 = 旧样本权重 × 0.3（新样本优先）
```

---

## 6.3 Brief 生成器

### 6.3.1 设计目标

Brief 是每一章的**创作蓝图**，是可能性清单到正文生成的关键中间层。它将抽象的故事方向转化为具体的、可执行的写作指令。

Brief 的设计原则：
1. **作者可审阅**：Brief 必须人类可读、可修改、可拒绝
2. **信息完备**：Brief 必须包含生成正文所需的一切关键决策
3. **不替代创作**：Brief 定义"写什么"，不规定"怎么写"——"怎么写"留给正文生成
4. **可追踪溯源**：Brief 的每个元素都能追溯到可能性清单的某个分支

### 6.3.2 Brief 的完整 JSON Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "ChapterBrief",
  "type": "object",
  "required": ["brief_id", "chapter_number", "status", "narrative_core", 
               "scene_breakdown", "character_directives", "emotional_arc"],
  "properties": {
    "brief_id": {
      "type": "string",
      "description": "Brief唯一标识符"
    },
    "chapter_number": {
      "type": "integer",
      "description": "章节序号"
    },
    "version": {
      "type": "integer",
      "description": "Brief版本号",
      "minimum": 1
    },
    "status": {
      "type": "string",
      "enum": ["draft", "pending_approval", "approved", "locked", "rejected"],
      "description": "Brief状态"
    },
    
    "generation_meta": {
      "type": "object",
      "properties": {
        "generated_at": {"type": "string", "format": "date-time"},
        "model": {"type": "string"},
        "temperature": {"type": "number"},
        "source_manifest_version": {"type": "string"},
        "possibility_branches": {
          "type": "array",
          "items": {"type": "string"},
          "description": "引用的可能性清单分支ID"
        }
      }
    },
    
    "narrative_core": {
      "type": "object",
      "description": "叙事核心——本章必须完成的主要叙事任务",
      "required": ["chapter_purpose", "plot_progression", "key_events"],
      "properties": {
        "chapter_purpose": {
          "type": "string",
          "description": "本章存在的叙事理由（1-2句话）"
        },
        "plot_progression": {
          "type": "object",
          "properties": {
            "advances_main_plot": {"type": "boolean"},
            "main_plot_milestone": {"type": "string"},
            "subplot_weaving": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "subplot_id": {"type": "string"},
                  "advancement": {"type": "string"},
                  "threads_introduced": {"type": "integer", "minimum": 0},
                  "threads_resolved": {"type": "integer", "minimum": 0}
                }
              }
            }
          }
        },
        "key_events": {
          "type": "array",
          "description": "本章必须包含的关键事件列表",
          "items": {
            "type": "object",
            "required": ["event_id", "event_type", "description", "narrative_weight"],
            "properties": {
              "event_id": {"type": "string"},
              "event_type": {
                "type": "string",
                "enum": ["turning_point", "revelation", "conflict", "emotional_moment", 
                         "worldbuilding", "character_development", "setup", "callback"]
              },
              "description": {"type": "string"},
              "narrative_weight": {
                "type": "integer",
                "minimum": 1,
                "maximum": 10,
                "description": "叙事重要性（1=轻微提及，10=核心转折）"
              },
              "must_appear_before": {
                "type": "string",
                "description": "必须在哪个事件之前发生"
              },
              "emotional_valence": {
                "type": "number",
                "minimum": -1,
                "maximum": 1
              }
            }
          }
        },
        "information_management": {
          "type": "object",
          "description": "本章的信息披露计划",
          "properties": {
            "reader_learns": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "knowledge_id": {"type": "string"},
                  "description": {"type": "string"},
                  "disclosure_method": {
                    "type": "string",
                    "enum": ["direct", "implied", "dialogue", "observation", "flashback", "document"]
                  }
                }
              }
            },
            "reader_misled": {
              "type": "array",
              "description": "故意让读者产生误解的信息",
              "items": {
                "type": "object",
                "properties": {
                  "misleading_impression": {"type": "string"},
                  "truth": {"type": "string"},
                  "will_be_corrected_in_chapter": {"type": "integer"}
                }
              }
            },
            "dramatic_irony": {
              "type": "array",
              "description": "读者知道但角色不知道的信息（戏剧反讽）",
              "items": {
                "type": "object",
                "properties": {
                  "reader_knows": {"type": "string"},
                  "character_unaware": {"type": "string"},
                  "irony_type": {"type": "string", "enum": ["suspense", "tragedy", "humor"]}
                }
              }
            }
          }
        }
      }
    },
    
    "scene_breakdown": {
      "type": "array",
      "description": "场景分解——本章的所有场景列表",
      "items": {
        "type": "object",
        "required": ["scene_id", "scene_order", "setting", "purpose", "mood"],
        "properties": {
          "scene_id": {"type": "string"},
          "scene_order": {"type": "integer"},
          "setting": {
            "type": "object",
            "properties": {
              "location_id": {"type": "string"},
              "location_name": {"type": "string"},
              "time_of_day": {"type": "string"},
              "atmosphere": {"type": "string"}
            }
          },
          "purpose": {
            "type": "string",
            "description": "本场景的叙事功能"
          },
          "mood": {
            "type": "string",
            "description": "场景基调"
          },
          "characters_present": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "character_id": {"type": "string"},
                "role_in_scene": {
                  "type": "string",
                  "enum": ["protagonist", "antagonist", "supporting", "observer", "catalyst"]
                },
                "scene_goal": {"type": "string"},
                "emotional_state": {"type": "string"}
              }
            }
          },
          "beat_breakdown": {
            "type": "array",
            "description": "场景内的节拍分解",
            "items": {
              "type": "object",
              "properties": {
                "beat_order": {"type": "integer"},
                "beat_type": {
                  "type": "string",
                  "enum": ["action", "dialogue", "description", "internal", "transition"]
                },
                "content_hint": {"type": "string"},
                "estimated_words": {"type": "integer"}
              }
            }
          },
          "estimated_word_count": {
            "type": "integer",
            "description": "预估字数"
          },
          "transitions": {
            "type": "object",
            "properties": {
              "from_scene": {"type": "string"},
              "to_scene": {"type": "string"},
              "transition_type": {
                "type": "string",
                "enum": ["hard_cut", "fade", "match_cut", "time_jump", "space_jump"]
              }
            }
          }
        }
      }
    },
    
    "character_directives": {
      "type": "object",
      "description": "角色指令——本章各角色的行为指导",
      "properties": {
        "character_arcs": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "character_id": {"type": "string"},
              "arc_direction": {
                "type": "string",
                "enum": ["growth", "decline", "revelation", "testing", "maintenance"]
              },
              "key_moment": {"type": "string"},
              "must_display_traits": {"type": "array", "items": {"type": "string"}},
              "must_avoid_traits": {"type": "array", "items": {"type": "string"}}
            }
          }
        },
        "relationship_dynamics": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "relationship_id": {"type": "string"},
              "characters": {"type": "array", "items": {"type": "string"}},
              "current_state": {"type": "string"},
              "state_change": {"type": "string"},
              "tension_level": {"type": "integer", "minimum": 0, "maximum": 10}
            }
          }
        }
      }
    },
    
    "emotional_arc": {
      "type": "object",
      "description": "情感弧线设计",
      "required": ["target_curve", "key_emotional_beats"],
      "properties": {
        "target_curve": {
          "type": "array",
          "description": "情感-紧张度坐标序列（0-10）",
          "items": {
            "type": "object",
            "properties": {
              "position_percent": {"type": "number", "minimum": 0, "maximum": 100},
              "emotional_intensity": {"type": "number", "minimum": 0, "maximum": 10},
              "tension_level": {"type": "number", "minimum": 0, "maximum": 10}
            }
          }
        },
        "key_emotional_beats": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "position": {"type": "string", "description": "位置标识（如'场景2中段'）"},
              "emotion_type": {"type": "string"},
              "intensity": {"type": "integer", "minimum": 1, "maximum": 10},
              "delivery_method": {
                "type": "string",
                "enum": ["action", "dialogue", "internal_monologue", "imagery", "revelation"]
              }
            }
          }
        }
      }
    },
    
    "technical_requirements": {
      "type": "object",
      "description": "技术要求",
      "properties": {
        "target_word_count": {"type": "integer"},
        "pov_character": {"type": "string"},
        "pov_type": {
          "type": "string",
          "enum": ["first_person", "third_person_limited", "third_person_omniscient"]
        },
        "tense": {
          "type": "string",
          "enum": ["past", "present"]
        },
        "special_formatting": {
          "type": "array",
          "items": {"type": "string"}
        },
        "genre_kernel_id": {"type": "string"},
        "satisfaction_patterns_to_hit": {
          "type": "array",
          "items": {"type": "string"}
        },
        "taboos_to_avoid": {
          "type": "array",
          "items": {"type": "string"}
        }
      }
    },
    
    "continuity_requirements": {
      "type": "object",
      "description": "连续性要求——与前章的衔接",
      "properties": {
        "must_resolve": {
          "type": "array",
          "description": "必须回应的前章悬念",
          "items": {"type": "string"}
        },
        "must_foreshadow": {
          "type": "array",
          "description": "必须为后续章节铺设的伏笔",
          "items": {"type": "string"}
        },
        "must_maintain": {
          "type": "array",
          "description": "必须保持连续性的元素",
          "items": {
            "type": "object",
            "properties": {
              "element_type": {"type": "string"},
              "element_id": {"type": "string"},
              "current_state": {"type": "string"}
            }
          }
        }
      }
    },
    
    "author_notes": {
      "type": "string",
      "description": "作者的额外备注（如'这章我特别想写...'）"
    },
    
    "approval_history": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "version": {"type": "integer"},
          "action": {"type": "string", "enum": ["submit", "approve", "reject", "revise"]},
          "actor": {"type": "string", "enum": ["system", "author"]},
          "timestamp": {"type": "string", "format": "date-time"},
          "notes": {"type": "string"}
        }
      }
    }
  }
}
```

### 6.3.3 Brief 生成的完整 Prompt 模板

```
[SYSTEM]
你是 NarrativeOS 的 Brief 生成器。你的任务是根据可能性清单和已有上下文，为下一章生成详细的创作简报（Brief）。

核心原则：
1. Brief 是"导演分镜"而非"剧本"——定义场景、情绪、节奏，但不写具体句子
2. 每个叙事决策必须有明确的目的性
3. 信息释放必须精确计划（读者知道什么、不知道什么、误以为是什么）
4. 角色行为必须符合其性格弧线和当前状态
5. 尊重类型内核的节奏模板和禁忌清单

你必须输出符合指定 JSON Schema 的 Brief。

[USER]
请为《{work_title}》第 {chapter_number} 章生成 Brief。

## 可能性清单（当前激活的分支）
{manifest_active_branches}

## 上一章摘要
{previous_chapter_summary}

## 当前故事状态
- 主线进度：{main_plot_progress}
- 活跃支线：{active_subplots}
- 待解决悬念：{open_hooks}

## 角色状态快照
{character_status_snapshot}

## 世界状态
{world_state_summary}

## 读者当前知识状态
{reader_knowledge_state}

## 类型内核
{genre_kernel_summary}

## 作者特别要求
{author_special_requests}

## 输出要求
请生成完整的 ChapterBrief JSON，确保：
1. narrative_core.chapter_purpose 明确回答"为什么要有这一章"
2. key_events 按叙事权重排序，每个事件有明确的类型标注
3. scene_breakdown 的场景数合理（{expected_scenes}个场景），每个场景有 mood 和 purpose
4. emotional_arc 包含至少5个情感坐标点
5. information_management 精确到具体知识点

目标字数：{target_word_count}
视角人物：{pov_character}

[少样本示例]
以下是一个优秀 Brief 的示例（来自另一部作品，仅供参考结构）：

{n few_shot_example}
```

### 6.3.4 Brief 与可能性清单的映射关系

```
映射规则：

1. 主线推进 ←→ manifest.main_arc.active_branch
   - Brief.narrative_core.plot_progression.advances_main_plot = true
   - Brief.narrative_core.plot_progression.main_plot_milestone = manifest 中的里程碑描述

2. 支线编织 ←→ manifest.subplots[].status == "active"
   - Brief.narrative_core.plot_progression.subplot_weaving 逐项对应
   - 每个活跃支线在本章的推进量由支线权重决定

3. 关键事件 ←→ manifest.possibility_nodes[].probability > 0.5
   - 高概率可能性节点转化为 Brief.key_events
   - 事件类型由节点属性映射

4. 角色指令 ←→ manifest.character_arcs[]
   - Brief.character_directives.character_arcs 映射自角色弧线的当前阶段
   - must_display_traits 来自角色当前弧线的"展示要求"

5. 信息披露 ←→ manifest.information_schedule[]
   - Brief.information_management 直接映射自信息时间表
   - disclosure_method 由信息性质决定

6. 情感弧线 ←→ manifest.emotional_trajectory[]
   - Brief.emotional_arc 映射自情感轨迹的当前段

7. 连续性 ←→ world_state.chapter_{n-1}.open_threads
   - Brief.continuity_requirements.must_resolve 来自未闭合线程
   - Brief.continuity_requirements.must_foreshadow 来自未来激活的可能性

映射验证：
生成后，系统自动检查 Brief 中的所有叙事元素是否都能在 manifest 中找到来源。
任何无法溯源的元素标记为"系统创意"，在作者审阅时特别标注。
```

### 6.3.5 Brief 审批流程的数据流

```
生成 → 审阅 → 锁定 → 使用

1. [生成] LLM 生成 Brief JSON
   ↓
2. [结构验证] JSON Schema 校验
   ↓ 不通过
   [错误报告] → 回到步骤1，附带错误信息
   ↓ 通过
3. [映射验证] 检查与 manifest 的一致性
   ↓ 不一致
   [警告标注] → 仍可提交审阅，但标注差异
   ↓ 一致/有警告
4. [提交审阅] Brief 进入作者审阅队列
   ↓
5. [作者决策]
   ├── [批准] → 状态=locked → 可用于正文生成
   ├── [修改] → 作者编辑 → 版本+1 → 回到步骤3
   ├── [拒绝] → 状态=rejected → 附带反馈 → 回到步骤1
   └── [跳过] → 本章不使用 Brief 生成（手动模式）
   ↓ locked
6. [版本锁定] 生成后的正文与 Brief 版本绑定
   ↓
7. [溯源追踪] 正文生成时所有决策可追溯到此 Brief

审批界面展示内容：
- Brief 的结构化摘要（非原始 JSON）
- 与上一章的衔接关系图
- 情感弧线可视化曲线
- 场景时间线
- 与 manifest 的映射关系
- "系统创意"标注（如有）
```


---

## 6.4 上下文组装与正文生成（核心系统）

### 6.4.1 设计概述

上下文组装与正文生成是工作室引擎的**心脏**。它接收已锁定的 Brief、AMA 风格配置、类型内核、世界状态，通过五层 Prompt 结构组装成一次 LLM 调用的完整输入，输出章节正文。

核心设计约束：
1. **单次调用**：不依赖多轮对话，所有信息一次性注入
2. **信息密度最大化**：在 context window 的限制内，装载最高价值的信息
3. **分层优先级**：每层信息有明确的优先级和截断策略
4. **输出可控**：通过格式规范和解析验证确保输出可用

### 6.4.2 五层 Prompt 结构总览

```
┌─────────────────────────────────────────────────────────────────┐
│                    五层 Prompt 结构（从底到顶）                    │
├─────────────────────────────────────────────────────────────────┤
│  Layer 5: 指令层 (Instruction Layer)                            │
│  ├─ 具体的写作指令                                              │
│  ├─ 场景类型特定的指令变体                                      │
│  ├─ 输出格式规范                                                │
│  └─ 质量检查清单                                                │
│  优先级: ★★★★★ (绝不可截断)                                    │
├─────────────────────────────────────────────────────────────────┤
│  Layer 4: 状态层 (State Layer)                                  │
│  ├─ 当前世界状态的叙事化呈现                                    │
│  ├─ 角色状态快照                                                │
│  ├─ 待解决悬念列表                                              │
│  └─ 活跃伏笔追踪                                                │
│  优先级: ★★★★★ (绝不可截断)                                    │
├─────────────────────────────────────────────────────────────────┤
│  Layer 3: 上下文层 (Context Layer)                              │
│  ├─ pgvector 检索的历史摘要                                     │
│  ├─ 设定片段                                                    │
│  ├─ 涟漪报告                                                    │
│  └─ 场景感知细节                                                │
│  优先级: ★★★★☆ (可按相似度截断)                                │
├─────────────────────────────────────────────────────────────────┤
│  Layer 2: 约束层 (Constraint Layer)                             │
│  ├─ 长度约束                                                    │
│  ├─ 视角约束 (POV)                                             │
│  ├─ 时态约束                                                    │
│  ├─ 节奏标记                                                    │
│  ├─ 类型内核约束                                                │
│  └─ 禁忌清单                                                    │
│  优先级: ★★★★★ (绝不可截断)                                    │
├─────────────────────────────────────────────────────────────────┤
│  Layer 1: 风格层 (Style Layer)                                  │
│  ├─ AMA 风格指南文本                                            │
│  ├─ 风格向量数值化指令                                          │
│  ├─ 代表性示例段落                                              │
│  └─ 类型语气基线                                                │
│  优先级: ★★★☆☆ (可压缩为摘要)                                  │
└─────────────────────────────────────────────────────────────────┘
```

**为什么按这个顺序排列？**

Prompt 越靠后（越靠近用户消息），对 LLM 的注意力影响越大。指令层和状态层放在最上层确保它们被严格遵循；风格层放在最底层作为"背景色"渗透全文，即使被压缩也不会影响核心执行。

### 6.4.3 风格层（Style Layer）详细设计

#### A. 作用说明

风格层定义"文本应该读起来像什么"。它是 AMA 配置的自然语言化呈现，将抽象的风格向量转化为 LLM 可理解并执行的指令。

风格层的设计理念：**不是告诉模型"写得好"，而是告诉模型"这样写"**——具体、可操作的指令。

#### B. 完整模板

```
===== 风格层（LAYER 1: STYLE） =====

[写作风格指令]

## 基本语气
你是一位擅长{genre_name}风格的中文网络文学作者。
你的写作风格遵循以下特征：

{style_guide_markdown}

## 句式参数
- 平均句长：{avg_sentence_length}字（目标范围±20%）
- 短句占比：{short_sentence_ratio}（15字以下为短句）
- 复句占比：{complex_sentence_ratio}
- 段均句数：{paragraph_avg_sentences}句
- 句长变化：{sentence_length_variance_description}

## 词汇偏好
- 词汇多样性：{lexical_diversity_description}
- 古语使用率：{archaism_ratio}
- 感官词密度：{sensory_word_ratio}
- 标志性词汇（高频使用）：{signature_words}
- 避免词汇：{words_to_avoid}

## 修辞指引
- 比喻密度：{metaphor_density}
- 比喻偏好域：{metaphor_preference}
- 排偶使用率：{parallelism_ratio}
- 夸张程度：{hyperbole_ratio}

## 叙事声音
- 叙事距离：{narrative_distance}
- 反讽使用：{irony_usage}
- 内省深度：{introspection_depth}
- Show/Tell平衡：{show_tell_balance}

## 对话风格
- 对话占比：{dialogue_ratio}
- 对话句长：{dialogue_sentence_length}字
- 对话标签风格：{dialogue_tag_style}
- 潜台词密度：{subtext_density}

## 代表性示例
以下是你风格的参考示例（仅参考风格，不参考内容）：
{representative_samples}

## 类型语气基线
本作品属于{genre_display_name}类型，语言基调：
{genre_voice_characteristics}
```

#### C. 风格向量到文本指令的转换

```python
class StyleVectorToPrompt:
    """
    将量化风格向量转换为自然语言指令
    """
    
    # 转换规则库
    SENTENCE_LENGTH_DESCRIPTIONS = {
        (0, 12): "极短句为主，节奏极快，如利刃切割",
        (12, 18): "短句为主，明快有力，适合动作场景",
        (18, 25): "中等句长，舒展流畅，兼顾节奏与描写",
        (25, 35): "偏长句，沉稳细致，适合心理和环境描写",
        (35, 50): "长句为主，复杂缜密，信息密度高",
        (50, 80): "特长句，需要读者细细品味"
    }
    
    ARCHAISM_DESCRIPTIONS = {
        (0, 0.1): "几乎不使用古语，纯现代白话",
        (0.1, 0.3): "偶尔点缀古语，增添文雅气质",
        (0.3, 0.5): "较常使用古语，行文有古典韵味",
        (0.5, 0.7): "大量使用古语，文风古朴典雅",
        (0.7, 1.0): "几乎纯古语写作，仿古文体"
    }
    
    def convert(self, style_vector: dict, genre_kernel: dict) -> str:
        """风格向量 → 文本指令"""
        parts = []
        
        # 句长描述
        avg_len = style_vector["sentence_structure"]["avg_sentence_length"]
        parts.append(self._describe_sentence_length(avg_len))
        
        # 古语使用
        arch = style_vector["vocabulary_profile"]["archaism_ratio"]
        parts.append(self._describe_archaism(arch))
        
        # 叙事距离
        dist = style_vector["narrative_voice"]["narrative_distance"]
        parts.append(self._describe_narrative_distance(dist))
        
        # ... 其他维度
        
        return "\n".join(parts)
    
    def _describe_sentence_length(self, value: float) -> str:
        for (lo, hi), desc in self.SENTENCE_LENGTH_DESCRIPTIONS.items():
            if lo <= value < hi:
                return f"句长风格：{desc}（目标平均{value}字）"
        return f"句长风格：混合（目标平均{value}字）"
```

#### D. 风格层的压缩策略

当 token 预算紧张时，风格层的压缩优先级：

```
完整风格层 → 压缩版本优先级：
1. 保留：style_guide_markdown（最高优先级，作者的"写作声音"）
2. 保留：generation_constraints（必须遵守/避免）
3. 压缩：代表性示例 → 只保留1个最具代表性的
4. 压缩：风格向量数值 → 只保留与类型基线差异大的维度
5. 压缩：类型语气基线 → 简要版
6. 删除：详细的维度说明 → 依赖模型对风格指南的理解
```

### 6.4.4 约束层（Constraint Layer）详细设计

#### A. 作用说明

约束层定义"什么可以做、什么必须做、什么不能做"。它是生成文本的**硬边界**，违反约束等同于输出不合格。

#### B. 完整约束类型列表

```
===== 约束层（LAYER 2: CONSTRAINTS） =====

[写作约束]

## 1. 长度约束
- 目标总字数：{target_word_count}字（允许偏差：±10%）
- 最少字数：{min_word_count}
- 最多字数：{max_word_count}
- 各场景字数分配：{scene_word_allocation}

## 2. 视角约束（POV）
- 叙事视角：{pov_type}
- 视角人物：{pov_character}
- 限知程度：{knowledge_limitation}
- 禁止越界：不得描述视角人物不知道的信息，除非有特殊叙事安排

## 3. 时态约束
- 叙事时态：{tense}
- 时态一致性：全文保持同一时态

## 4. 节奏约束
- 本章节奏模板：{rhythm_template_name}
- 节拍结构：{beat_structure}
- 情感-紧张度曲线：{emotional_tension_curve}
- 关键节奏标记：
  {position_15%}: {mood_at_15}
  {position_40%}: {mood_at_40}
  {position_70%}: {mood_at_70}
  {position_90%}: {mood_at_90}

## 5. 类型内核约束
- 激活类型：{genre_display_name}
- 必须触发的爽点模式：{satisfaction_patterns_to_hit}
- 绝对禁忌（fatal）：{fatal_taboos}
- 主要禁忌（major）：{major_taboos}
- 次要禁忌（minor）：{minor_taboos}
- 语气基线：{voice_baseline_summary}

## 6. 角色行为约束
- 各角色必须展示的性格特征：{required_traits}
- 各角色不得违背的性格底线：{character_constraints}

## 7. 信息约束
- 必须让读者获得的信息：{must_reveal}
- 不得提前泄露的信息：{must_conceal}
- 读者已知但角色未知的信息（戏剧反讽）：{dramatic_irony_setup}

## 8. 连续性约束
- 必须回应的前章悬念：{hooks_to_resolve}
- 必须为后续铺设的伏笔：{foreshadowing_required}
- 必须保持连续的状态：{continuity_checks}

## 9. 格式约束
- 段落格式：中文段落，段首不缩进，段间空一行
- 对话格式："对话内容，"角色动作或神态，"继续对话。"
- 场景分隔：使用 *** 分隔不同场景
- 章节标题格式：第{chapter_number}章 {chapter_title}

## 10. 质量约束
- 禁止：作者插入式评论或元叙事
- 禁止：直接复制粘贴前文段落
- 禁止：角色突然获得未铺垫的知识或能力
- 要求：每个场景都有明确的叙事功能
- 要求：对话推动情节或揭示性格，而非纯粹寒暄
```

#### C. 约束优先级矩阵

| 约束类型 | 优先级 | 违反后果 | 检测方式 |
|---------|--------|---------|---------|
| 类型禁忌(fatal) | P0 | 章节作废 | 关键词匹配+人工审核 |
| POV约束 | P0 | 叙事混乱 | 人称一致性检查 |
| 长度约束 | P1 | 排版异常 | 字数统计 |
| 爽点模式 | P1 | 读者不满 | 事件匹配检查 |
| 节奏约束 | P1 | 阅读体验差 | 情感曲线比对 |
| 连续性约束 | P1 | 剧情bug | 状态一致性检查 |
| 信息约束 | P1 | 剧透或叙事失当 | 知识图谱比对 |
| 格式约束 | P2 | 排版问题 | 正则匹配 |
| 次要禁忌 | P2 | 质感下降 | 关键词检测 |

### 6.4.5 上下文层（Context Layer）详细设计

#### A. 作用说明

上下文层提供**历史信息**和**设定参考**，确保生成的正文与已有内容保持连贯和一致。这是唯一一层可以通过截断来控制长度的层。

#### B. pgvector 检索的完整策略

```python
class ContextRetrievalEngine:
    """
    上下文检索引擎：从 pgvector 数据库中检索最相关的上下文信息
    """
    
    # 检索配置
    RETRIEVAL_CONFIG = {
        "historical_summaries": {
            "collection": "chapter_summaries",
            "embedding_model": "text-embedding-3-large",
            "top_k": 5,
            "similarity_threshold": 0.65,
            "recency_bias": True,          # 最近章节加权
            "recency_weight_factor": 1.3,  # 最近章节的权重乘数
            "query_sources": ["brief", "key_events", "character_moments"]
        },
        "setting_fragments": {
            "collection": "world_settings",
            "embedding_model": "text-embedding-3-large",
            "top_k": 8,
            "similarity_threshold": 0.60,
            "category_boost": {            # 按设定类别的加权
                "location": 1.2,
                "faction": 1.1,
                "magic_system": 1.15,
                "history": 1.0,
                "culture": 0.9
            }
        },
        "ripple_reports": {
            "collection": "ripple_effects",
            "embedding_model": "text-embedding-3-large",
            "top_k": 5,
            "similarity_threshold": 0.55,
            "time_decay": True,            # 时间衰减
            "decay_half_life_chapters": 20 # 20章半衰期
        },
        "scene_sensory_details": {
            "collection": "scene_details",
            "embedding_model": "text-embedding-3-large",
            "top_k": 6,
            "similarity_threshold": 0.58,
            "sensory_modalities": ["visual", "auditory", "tactile", "olfactory", "atmospheric"]
        }
    }
    
    def retrieve(self, brief: ChapterBrief, chapter_number: int) -> ContextBundle:
        """
        主检索函数
        
        策略：
        1. 构造多源检索 query
        2. 对各 collection 分别检索
        3. 混合排序
        4. 截断到预算
        """
        # Step 1: 构造检索 query
        queries = self._construct_queries(brief)
        
        # Step 2: 多路并行检索
        results = {}
        for source, config in self.RETRIEVAL_CONFIG.items():
            query_embedding = self._embed(queries[source])
            raw_results = self._pgvector_search(
                collection=config["collection"],
                query_vector=query_embedding,
                top_k=config["top_k"] * 2,  # 先多取，后精排
                similarity_threshold=config["similarity_threshold"]
            )
            
            # 应用各类加权策略
            if config.get("recency_bias"):
                raw_results = self._apply_recency_bias(
                    raw_results, chapter_number, config["recency_weight_factor"]
                )
            if config.get("time_decay"):
                raw_results = self._apply_time_decay(
                    raw_results, chapter_number, config["decay_half_life_chapters"]
                )
            if "category_boost" in config:
                raw_results = self._apply_category_boost(
                    raw_results, config["category_boost"]
                )
            
            # 精排取 top_k
            results[source] = sorted(raw_results, key=lambda x: x.score, reverse=True)[:config["top_k"]]
        
        # Step 3: 组装上下文包
        return ContextBundle(
            historical_summaries=results["historical_summaries"],
            setting_fragments=results["setting_fragments"],
            ripple_reports=results["ripple_reports"],
            scene_details=results["scene_sensory_details"]
        )
    
    def _construct_queries(self, brief: ChapterBrief) -> dict:
        """
        为不同检索源构造专门的查询
        """
        queries = {}
        
        # 历史摘要检索 query：基于本章 Brief 的关键要素
        brief_elements = []
        for event in brief["narrative_core"]["key_events"]:
            brief_elements.append(event["description"])
        for scene in brief["scene_breakdown"]:
            brief_elements.append(scene["purpose"])
            brief_elements.append(scene["setting"].get("location_name", ""))
        queries["historical_summaries"] = " ".join(brief_elements)
        
        # 设定检索 query：场景地点 + 涉及势力 + 能力体系
        setting_elements = []
        for scene in brief["scene_breakdown"]:
            setting_elements.append(scene["setting"].get("location_name", ""))
        for char_dir in brief.get("character_directives", {}).get("character_arcs", []):
            setting_elements.append(char_dir["character_id"])
        queries["setting_fragments"] = " ".join(setting_elements)
        
        # 涟漪报告检索 query：角色 + 事件影响
        ripple_elements = []
        for event in brief["narrative_core"]["key_events"]:
            ripple_elements.append(event["description"])
        queries["ripple_reports"] = " ".join(ripple_elements)
        
        # 场景感知细节检索 query：场景 mood + 地点 + 氛围
        scene_elements = []
        for scene in brief["scene_breakdown"]:
            scene_elements.append(scene.get("mood", ""))
            scene_elements.append(scene["setting"].get("atmosphere", ""))
        queries["scene_sensory_details"] = " ".join(scene_elements)
        
        return queries
```

#### C. 混合检索权重

```
最终排序分数 = 语义相似度 × 0.5 + 时间相关性 × 0.25 + 类型相关性 × 0.15 + 作者标注 × 0.10

各因子说明：
- 语义相似度：向量检索的原始余弦相似度
- 时间相关性：
  * 最近5章：权重 × 1.3
  * 5-15章：权重 × 1.1
  * 15-50章：权重 × 1.0
  * 50章以上：权重 × 0.7
- 类型相关性：检索结果与本章类型的匹配度
- 作者标注：作者手动标注为"重要"的上下文 × 1.5

截断规则：
1. 首先按相似度阈值过滤（低于阈值的丢弃）
2. 然后按加权分数排序
3. 最后按 token 预算截断
4. 确保每类上下文至少保留2条（即使分数较低）
```

#### D. 上下文层模板

```
===== 上下文层（LAYER 3: CONTEXT） =====

[历史参考]
以下是与本章最相关的历史章节摘要：

{for each historical_summary in context.historical_summaries}
--- 第{chapter_num}章摘要（相关度：{score}）---
{summary_text}
关键事件：{key_events}
涉及角色：{characters}
---
{end for}

[设定参考]
以下是与本章场景相关的设定信息：

{for each setting in context.setting_fragments}
--- {setting.category}: {setting.title} ---
{setting.content}
---
{end for}

[因果涟漪]
以下历史事件可能在本章产生影响：

{for each ripple in context.ripple_reports}
--- 源事件：{ripple.source_event} ---
影响描述：{ripple.effect_description}
预期在本章的表现：{ripple.expected_manifestation}
涉及角色：{ripple.affected_characters}
---
{end for}

[场景感知参考]
以下是与本章场景氛围相关的细节描写参考：

{for each detail in context.scene_details}
--- {detail.scene_type}: {detail.location} ---
{detail.sensory_description}
---
{end for}
```

### 6.4.6 状态层（State Layer）详细设计

#### A. 作用说明

状态层提供**当前世界状态的叙事化快照**——生成本章时必须知道的"现在发生了什么"。不同于上下文层的历史回顾，状态层关注的是"此刻"。

#### B. 需要注入的状态类型

```
状态层信息分类：

1. 角色状态快照
   - 每个在场角色的当前位置、情绪状态、目标、秘密
   - 角色之间的关系状态（友好/敌对/暧昧/猜忌等）
   - 角色当前持有的关键物品/信息

2. 地点状态
   - 本章涉及地点的当前状态（谁在、发生了什么、氛围如何）
   - 地点的历史/重要性简述

3. 势力状态
   - 各势力当前对本章涉及事件的立场
   - 势力间的力量对比

4. 待解决悬念
   - 当前所有未闭合的叙事线程
   - 每个悬念的"年龄"（从第几章开始悬置）
   - 每个悬念的紧迫度

5. 活跃伏笔
   - 已铺设但尚未回收的伏笔列表
   - 每个伏笔的预计回收章节
   - 本章可以自然提及的伏笔

6. 时间状态
   - 故事当前时间点（距离关键事件的时间）
   - 本章的时间跨度预期

7. 环境状态
   - 天气/季节/特殊天象
   - 社会氛围（紧张/欢庆/恐慌等）
```

#### C. 状态序列化格式

```python
class StateSerializer:
    """
    将结构化状态数据序列化为叙事化的自然语言描述
    """
    
    def serialize(self, world_state: WorldState, brief: ChapterBrief) -> str:
        """世界状态 → 叙事化文本"""
        parts = []
        
        # 1. 角色状态
        parts.append("## 角色当前状态")
        for char_state in world_state.characters:
            if char_state.character_id in brief.characters_involved:
                parts.append(self._serialize_character(char_state))
        
        # 2. 地点状态
        parts.append("\n## 场景地点状态")
        for scene in brief.scene_breakdown:
            location_state = world_state.get_location(scene.setting.location_id)
            if location_state:
                parts.append(self._serialize_location(location_state))
        
        # 3. 待解决悬念
        parts.append("\n## 待解决悬念")
        for hook in world_state.open_hooks:
            parts.append(f"- [{hook.urgency}] {hook.description}（自第{hook.since_chapter}章起）")
        
        # 4. 活跃伏笔
        parts.append("\n## 活跃伏笔")
        for foreshadow in world_state.active_foreshadowing:
            if foreshadow.can_mention_in_chapter(brief.chapter_number):
                parts.append(f"- {foreshadow.description}（预计第{foreshadow.estimated_payoff_chapter}章回收）")
        
        # 5. 时间状态
        parts.append(f"\n## 时间")
        parts.append(f"故事当前时间点：{world_state.current_story_time}")
        parts.append(f"本章预计时间跨度：{brief.estimated_time_span}")
        
        return "\n".join(parts)
    
    def _serialize_character(self, char_state: CharacterState) -> str:
        """角色状态 → 自然语言描述"""
        lines = [
            f"### {char_state.name}",
            f"- 当前位置：{char_state.current_location}",
            f"- 情绪状态：{char_state.emotional_state}",
            f"- 当前目标：{char_state.current_goal}",
            f"- 隐藏的秘密：{char_state.known_secrets if char_state.known_secrets else '无'}",
            f"- 持有物品：{', '.join(char_state.inventory) if char_state.inventory else '无特殊物品'}",
        ]
        
        # 关系状态
        if char_state.relationships:
            lines.append("- 关键关系：")
            for rel in char_state.relationships:
                lines.append(f"  * 与{rel.target_name}：{rel.dynamic_description}")
        
        return "\n".join(lines)
```

#### D. 状态层模板

```
===== 状态层（LAYER 4: STATE） =====

[当前世界状态快照]
（本章开始时，故事世界的即时状态）

## 角色当前状态
{serialized_character_states}

## 场景地点状态
{serialized_location_states}

## 待解决悬念
{open_hooks}

## 活跃伏笔（本章可自然提及）
{active_foreshadowing}

## 时间
{time_state}

[本章状态变化预期]
（本章结束时，以下状态应该发生的变化）
{expected_state_changes}
```

### 6.4.7 指令层（Instruction Layer）详细设计

#### A. 作用说明

指令层是五层 Prompt 的"驾驶室"——直接告诉 LLM **具体怎么写这一章**。它是与当前章节最紧密相关的指令。

#### B. 不同场景类型的指令变体

**通用指令模板：**

```
===== 指令层（LAYER 5: INSTRUCTION） =====

[写作指令]

## 本章任务
请为《{work_title}》撰写第 {chapter_number} 章。

## 本章核心目的
{chapter_purpose}

## 场景清单
{for each scene in scene_breakdown}
### 场景{scene.scene_order}: {scene.setting.location_name}
- 叙事功能：{scene.purpose}
- 基调：{scene.mood}
- 在场角色：{scene.characters_present}
- 预估字数：{scene.estimated_word_count}
- 节拍安排：
{for beat in scene.beat_breakdown}
  {beat.beat_order}. [{beat.beat_type}] {beat.content_hint}（~{beat.estimated_words}字）
{end for}
{end for}

## 情感弧线要求
{emotional_arc_guidance}

## 必须包含的关键事件
{key_events_checklist}

## 信息释放计划
{information_schedule}

## 对话要求
- 本章对话占比目标：{target_dialogue_ratio}
- 关键对话场景：{key_dialogue_moments}
- 对话必须推动：{dialogue_objectives}

## 写作提示
1. 开场的3句话决定读者是否继续——请精心设计hook
2. 每个场景结束时留下微悬念或期待
3. 动作场景用短句、感官词汇
4. 对话中通过潜台词展示角色关系
5. 本章结尾必须包含一个让人想翻页的元素

## 输出格式
```
第{chapter_number}章 {chapter_title}

[正文开始]
（按场景顺序书写，场景间用 *** 分隔）

[正文结束]
```

## 质量自查清单
写作完成后，请检查：
- [ ] 视角始终保持在{pov_character}的限知范围内
- [ ] 没有违反任何fatal或major级别的禁忌
- [ ] 所有key_events都有体现
- [ ] 字数在{min_word_count}-{max_word_count}范围内
- [ ] 情感弧线符合设计要求
- [ ] 对话推动情节而非纯粹寒暄
- [ ] 场景过渡自然流畅
```

**场景类型变体：**

```python
SCENE_TYPE_VARIANTS = {
    "action_combat": {
        "additional_instructions": """
## 战斗场景特别指令
- 战斗节奏：快节奏，短句为主，每句不超过20字
- 感官细节：优先视觉和听觉，穿插触觉
- 心理描写：战斗中穿插角色的判断和紧迫感
- 环境互动：角色利用环境元素，增加场面丰富度
- 禁止：大段招式名称背诵、战力数值报菜名
- 重点：展示而非告知（不要"他很强大"，要"地面在他脚下龟裂"）
"""
    },
    "dialogue_heavy": {
        "additional_instructions": """
## 对话主导场景特别指令
- 对话占比：本章70%以上应为对话
- 潜台词要求：每段重要对话至少有一层言外之意
- 角色声音差异化：每个角色的说话方式独特可辨识
- 信息密度：对话中自然嵌入信息，避免"信息倾倒"
- 节奏变化：对话中穿插动作和反应，避免"话筒架对话"
- 禁止：角色之间解释彼此已知的信息（除非有戏剧性目的）
"""
    },
    "introspection": {
        "additional_instructions": """
## 内心戏场景特别指令
- 内省深度：深入主角内心，展现真实想法与表面行为的差距
- 意识流：允许半意识流的写作风格，但保持可读性
- 记忆穿插：通过当前事件触发相关回忆
- 情感层次：展现情感的复杂性，避免单一情绪
- 节奏：放缓，给读者沉浸的时间
- 禁止：说教式内心独白、过度理性的分析
"""
    },
    "mystery_unraveling": {
        "additional_instructions": """
## 悬疑揭晓场景特别指令
- 推理节奏：线索逐步展示，每一步推理都有依据
- 公平性：所有关键线索在此前都已向读者展示
- 反讽设置：读者知道而角色不知道的信息要有戏剧效果
- 震惊处理：揭晓时给读者（和角色）反应时间
- 后果展示：真相揭露后立即展示连锁反应
- 禁止：突然出现的证据、依赖巧合的推理
"""
    },
    "worldbuilding_revelation": {
        "additional_instructions": """
## 世界观揭示场景特别指令
- 信息包装：设定信息通过角色互动或事件自然展示
- 分层揭示：一次只揭示一小部分，保持神秘感
- 角色反应：通过角色的理解和反应来锚定新信息的重要性
- 与情节结合：设定揭示必须与当前情节直接相关
- 禁止：大段无叙事的说明文字、角色解释已知信息
"""
    },
    "emotional_climax": {
        "additional_instructions": """
## 情感高潮场景特别指令
- 情感浓度：高——但不煽情
- 铺垫认可：承认此前积累的情感势能
- 具体细节：用具体动作和细节传递情感，而非形容词
- 留白：关键情感时刻后用简短句子制造余韵
- 多角色：展示不同角色对同一事件的不同情感反应
- 禁止：过度解释情感、用"他突然明白"等偷懒手法
"""
    }
}
```

### 6.4.8 Prompt 组装流程

#### A. 完整组装流程

```python
class FiveLayerPromptAssembler:
    """
    五层Prompt组装器
    """
    
    def assemble(self, 
                 brief: ChapterBrief,
                 ama_config: AMAConfig,
                 genre_kernel: GenreKernel,
                 world_state: WorldState,
                 context_bundle: ContextBundle) -> str:
        """
        组装完整的五层Prompt
        """
        
        # Layer 1: 风格层
        style_layer = self._build_style_layer(ama_config, genre_kernel)
        
        # Layer 2: 约束层
        constraint_layer = self._build_constraint_layer(brief, genre_kernel)
        
        # Layer 3: 上下文层
        context_layer = self._build_context_layer(context_bundle)
        
        # Layer 4: 状态层
        state_layer = self._build_state_layer(world_state, brief)
        
        # Layer 5: 指令层
        instruction_layer = self._build_instruction_layer(brief)
        
        # Token 预算分配和截断
        layers = {
            "style": style_layer,
            "constraint": constraint_layer,
            "context": context_layer,
            "state": state_layer,
            "instruction": instruction_layer
        }
        
        truncated = self._apply_token_budget(layers)
        
        # 最终组装
        return self._finalize(truncated)
    
    def _apply_token_budget(self, layers: dict) -> dict:
        """
        Token 预算分配与截断
        """
        # 总预算 = context_window - output_reserve - safety_margin
        # 假设 128K context，预留 32K 输出 + 4K 安全余量
        TOTAL_BUDGET = 128000 - 32000 - 4000  # = 92000 tokens
        
        # 基础分配比例
        allocation = {
            "instruction": 0.15,   # ~13800 tokens — 绝不可截断
            "state": 0.15,         # ~13800 tokens — 绝不可截断
            "constraint": 0.15,    # ~13800 tokens — 绝不可截断
            "context": 0.30,       # ~27600 tokens — 可按相似度截断
            "style": 0.25          # ~23000 tokens — 可压缩
        }
        
        result = {}
        remaining_budget = TOTAL_BUDGET
        
        # 第一轮：不可截断层全量分配
        for layer_name in ["instruction", "state", "constraint"]:
            tokens = self._estimate_tokens(layers[layer_name])
            max_tokens = int(TOTAL_BUDGET * allocation[layer_name])
            assigned = min(tokens, max_tokens)
            result[layer_name] = self._truncate_to(layers[layer_name], assigned)
            remaining_budget -= assigned
        
        # 第二轮：上下文层分配
        context_tokens = min(
            self._estimate_tokens(layers["context"]),
            int(TOTAL_BUDGET * allocation["context"]),
            remaining_budget * 0.6
        )
        result["context"] = self._smart_truncate_context(
            layers["context"], context_tokens
        )
        remaining_budget -= context_tokens
        
        # 第三轮：风格层（剩余预算）
        result["style"] = self._compress_style(
            layers["style"], remaining_budget
        )
        
        return result
```

#### B. Token 预算分配策略

| 层级 | 基础比例 | 可截断？ | 截断策略 | 最低保留 |
|------|---------|---------|---------|---------|
| 指令层 | 15% | ❌ 不可 | 无 | 100% |
| 状态层 | 15% | ❌ 不可 | 无 | 100% |
| 约束层 | 15% | ❌ 不可 | 仅次要约束可删除 | 90% |
| 上下文层 | 30% | ✅ 可截断 | 按相似度+时间权重丢弃 | 40% |
| 风格层 | 25% | ✅ 可压缩 | 摘要化、减少示例 | 30% |

### 6.4.9 输出解析与格式验证

```python
class OutputParser:
    """
    正文输出解析器
    """
    
    def parse(self, llm_output: str, brief: ChapterBrief) -> ParsedChapter:
        """
        解析LLM输出，提取结构化正文
        """
        # Step 1: 格式验证
        validation = self._validate_format(llm_output)
        if not validation.passed:
            raise FormatError(validation.errors)
        
        # Step 2: 提取章节标题
        chapter_title = self._extract_title(llm_output)
        
        # Step 3: 场景分割
        scenes = self._split_scenes(llm_output)
        
        # Step 4: 基础统计
        stats = self._compute_stats(llm_output)
        
        # Step 5: 约束验证
        constraint_check = self._verify_constraints(llm_output, brief, stats)
        
        return ParsedChapter(
            raw_text=llm_output,
            chapter_number=brief.chapter_number,
            chapter_title=chapter_title,
            scenes=scenes,
            statistics=stats,
            constraint_check=constraint_check
        )
    
    def _validate_format(self, text: str) -> FormatValidation:
        """格式验证"""
        errors = []
        
        # 检查是否有章节标题
        if not re.search(r'第\d+章', text):
            errors.append("缺少章节标题")
        
        # 检查场景分隔符
        if '***' not in text and len(self._detect_scene_breaks(text)) > 1:
            errors.append("多场景但缺少 *** 分隔符")
        
        # 检查非法内容
        if re.search(r'（注：|【作者|（本章完|（未完待续', text):
            errors.append("包含元叙事/作者注释")
        
        # 检查POV一致性
        pov_violations = self._check_pov_consistency(text)
        if pov_violations:
            errors.append(f"POV越界: {pov_violations}")
        
        return FormatValidation(
            passed=len(errors) == 0,
            errors=errors
        )
    
    def _compute_stats(self, text: str) -> ChapterStats:
        """计算统计信息"""
        return ChapterStats(
            total_chars=len(text),
            total_words=self._count_chinese_words(text),
            paragraph_count=text.count('\n\n') + 1,
            dialogue_lines=len(re.findall(r'["""][^"""]+["""]', text)),
            scene_count=text.count('***') + 1,
            avg_paragraph_length=...,
            estimated_reading_time_minutes=self._count_chinese_words(text) / 500
        )
```

---

## 6.5 正文修改系统

### 6.5.1 设计目标

正文修改系统是工作室引擎的**"编辑团队"**。它接收谏官报告（Censor Report）或作者的直接修改指令，对正文进行精准修改。

核心设计原则：
1. **最小侵入**：只做必要的修改，保留原文风格
2. **版本化**：所有修改产生新版本，保留完整修改历史
3. **可追溯**：每个修改都有明确的原因和来源
4. **作者终审**：修改结果必须经过作者确认

### 6.5.2 修改指令的类型分类

```json
{
  "modification_types": {
    "local_fix": {
      "description": "局部修改：针对特定段落或句子的精确修改",
      "subtypes": [
        {
          "id": "word_choice",
          "name": "用词替换",
          "description": "替换不合适的词汇",
          "scope": "单句",
          "example": "将'非常漂亮'改为具体的描写"
        },
        {
          "id": "sentence_restructure",
          "name": "句式重构",
          "description": "改写不通顺或不符合风格的句子",
          "scope": "1-3句",
          "example": "将两个短句合并为复合句以匹配风格"
        },
        {
          "id": "fact_correction",
          "name": "事实修正",
          "description": "修正与设定矛盾的事实",
          "scope": "单句到单段",
          "example": "角色称呼错误、地点描述矛盾等"
        },
        {
          "id": "tone_adjustment",
          "name": "语气微调",
          "description": "调整段落的情感色彩",
          "scope": "单段",
          "example": "将过于平淡的描写增加紧张感"
        }
      ]
    },
    
    "global_adjustment": {
      "description": "全局调整：影响整章或多个场景的修改",
      "subtypes": [
        {
          "id": "rhythm_rebalance",
          "name": "节奏重调",
          "description": "调整章节内某部分的节奏快慢",
          "scope": "整章或大半章",
          "example": "前半段过于拖沓，需要压缩"
        },
        {
          "id": "emotional_arc_fix",
          "name": "情感弧线修正",
          "description": "调整不符合设计的情感曲线",
          "scope": "整章",
          "example": "高潮点情感强度不足"
        },
        {
          "id": "information_reordering",
          "name": "信息重排",
          "description": "调整信息披露的顺序",
          "scope": "整章",
          "example": "某线索揭示过早/过晚"
        },
        {
          "id": "scene_expansion",
          "name": "场景扩写",
          "description": "将过于简略的场景详细化",
          "scope": "单场景",
          "example": "战斗场景需要更详细的动作描写"
        },
        {
          "id": "scene_compression",
          "name": "场景压缩",
          "description": "将过于冗长的场景精简",
          "scope": "单场景",
          "example": "过渡场景需要加快"
        }
      ]
    },
    
    "style_correction": {
      "description": "风格修正：让文本更符合作者风格",
      "subtypes": [
        {
          "id": "style_realignment",
          "name": "风格对齐",
          "description": "用作者风格重写不符合的段落",
          "scope": "1-多段",
          "example": "某段读起来像通用网文，需要注入个人风格"
        },
        {
          "id": "voice_consistency",
          "name": "声音统一",
          "description": "统一全章的叙事声音",
          "scope": "整章",
          "example": "部分段落叙事距离不统一"
        },
        {
          "id": "dialogue_polish",
          "name": "对话打磨",
          "description": "使对话更符合角色声音",
          "scope": "涉及对话的段落",
          "example": "角色A说话方式像角色B"
        }
      ]
    },
    
    "logic_repair": {
      "description": "逻辑修复：修正叙事逻辑问题",
      "subtypes": [
        {
          "id": "plot_hole_fix",
          "name": "剧情漏洞修复",
          "description": "修补叙事逻辑中的漏洞",
          "scope": "可变",
          "example": "角色不可能知道某信息却知道了"
        },
        {
          "id": "continuity_fix",
          "name": "连续性修复",
          "description": "修正与前章矛盾的地方",
          "scope": "局部",
          "example": "角色位置与前章不一致"
        },
        {
          "id": "causality_fix",
          "name": "因果修复",
          "description": "确保因果关系合理",
          "scope": "局部到全局",
          "example": "某事件缺乏足够的触发理由"
        },
        {
          "id": "character_consistency",
          "name": "角色一致性修复",
          "description": "修正角色行为性格不一致",
          "scope": "局部",
          "example": "某角色做出了不符合其性格的决定"
        }
      ]
    },
    
    "structural_change": {
      "description": "结构变更：对章节结构的重大调整",
      "subtypes": [
        {
          "id": "scene_reordering",
          "name": "场景重排",
          "description": "改变场景顺序",
          "scope": "整章",
          "example": "某场景提前效果更好"
        },
        {
          "id": "scene_addition",
          "name": "场景新增",
          "description": "新增Brief中没有的场景",
          "scope": "整章",
          "example": "需要一个新的过渡场景"
        },
        {
          "id": "scene_deletion",
          "name": "场景删除",
          "description": "删除不必要的场景",
          "scope": "整章",
          "example": "某场景对叙事无贡献"
        },
        {
          "id": "full_rewrite",
          "name": "全文重写",
          "description": "整章推翻重写",
          "scope": "整章",
          "example": "方向性错误需要重新开始"
        }
      ]
    }
  }
}
```

### 6.5.3 修改策略选择逻辑

```python
class ModificationStrategySelector:
    """
    修改策略选择器
    """
    
    STRATEGY_MATRIX = {
        # (修改类型, 影响范围) → 策略
        ("word_choice", "single_sentence"): "local_patch",
        ("fact_correction", "single_paragraph"): "local_patch",
        ("tone_adjustment", "single_paragraph"): "local_patch",
        ("sentence_restructure", "1-3_sentences"): "local_patch",
        
        ("rhythm_rebalance", "chapter"): "selective_rewrite",
        ("emotional_arc_fix", "chapter"): "selective_rewrite",
        ("scene_expansion", "single_scene"): "selective_rewrite",
        ("scene_compression", "single_scene"): "selective_rewrite",
        
        ("style_realignment", "multi_paragraph"): "style_pass",
        ("voice_consistency", "chapter"): "style_pass",
        ("dialogue_polish", "dialogue_sections"): "style_pass",
        
        ("plot_hole_fix", "variable"): "contextual_rewrite",
        ("continuity_fix", "local"): "local_patch",
        ("causality_fix", "local_to_global"): "contextual_rewrite",
        ("character_consistency", "local"): "local_patch",
        
        ("scene_reordering", "chapter"): "structural_edit",
        ("scene_addition", "chapter"): "structural_edit",
        ("scene_deletion", "chapter"): "structural_edit",
        ("full_rewrite", "chapter"): "full_rewrite",
    }
    
    def select_strategy(self, modification_request: ModRequest) -> ModStrategy:
        """
        根据修改请求选择最优策略
        """
        mod_type = modification_request.type
        scope = modification_request.scope
        
        # 基础策略查找
        strategy_key = (mod_type, scope)
        base_strategy = self.STRATEGY_MATRIX.get(strategy_key, "contextual_rewrite")
        
        # 根据修改量调整策略
        affected_ratio = modification_request.affected_text_ratio
        
        if affected_ratio > 0.7:
            # 如果影响超过70%，升级为全文重写
            return ModStrategy.FULL_REWRITE
        elif affected_ratio > 0.4 and base_strategy != "full_rewrite":
            # 如果影响40-70%，升级为选择性重写
            return ModStrategy.SELECTIVE_REWRITE
        
        return ModStrategy(base_strategy)

class ModStrategy(Enum):
    """修改策略枚举"""
    LOCAL_PATCH = "local_patch"           # 局部补丁：只改特定段落
    SELECTIVE_REWRITE = "selective_rewrite"  # 选择性重写：重写部分场景
    STYLE_PASS = "style_pass"             # 风格统一：以风格为导向的全章润色
    CONTEXTUAL_REWRITE = "contextual_rewrite"  # 上下文重写：考虑上下文的部分重写
    STRUCTURAL_EDIT = "structural_edit"   # 结构编辑：场景增删改顺序
    FULL_REWRITE = "full_rewrite"         # 全文重写：整章重新生成
```

### 6.5.4 修改 Prompt 模板

**局部补丁策略：**

```
[SYSTEM]
你是 NarrativeOS 的正文修改器。你的任务是对指定段落进行精准修改。

修改原则：
1. 只做指定的修改，不改无关内容
2. 保持原有的风格和语气
3. 修改后的文本必须与上下文自然衔接
4. 输出格式：只输出修改后的段落，不输出解释

[USER]
请对以下段落进行修改：

## 修改指令
{modification_instruction}

## 修改原因
{modification_reason}

## 参考风格
{style_guide_relevant_section}

## 原文段落
```
{original_paragraph}
```

## 上下文（前）
{preceding_context}

## 上下文（后）
{following_context}

## 输出要求
- 只输出修改后的段落文本
- 不要添加任何解释或元评论
- 确保与前后文衔接自然
```

**选择性重写策略：**

```
[USER]
请重写《{work_title}》第{chapter_number}章的以下部分：

## 重写范围
{scene_description}

## 重写原因
{rewrite_reason}

## 需要保留的内容
{elements_to_preserve}

## 需要修改的内容
{elements_to_change}

## 本章其他场景（供参考上下文）
{other_scenes_summary}

## 风格指南
{style_guide}

## 约束
- 目标字数：{target_word_count}
- 必须包含的关键事件：{required_events}
- 不得改变的信息：{fixed_facts}

## 原文（供参考）
{original_scene_text}

请输出重写后的完整文本。
```

### 6.5.5 Diff 追踪机制

```json
{
  "diff_tracking": {
    "diff_id": "diff_001",
    "chapter_number": 15,
    "base_version": "v1.0",
    "modified_version": "v1.1",
    "modification_source": "author_direct|advisor_report|style_check",
    
    "diff_hunks": [
      {
        "hunk_id": "h001",
        "type": "modified",
        "location": "场景2，第3-5段",
        "original_text": "原文...",
        "modified_text": "修改后...",
        "modification_type": "style_realignment",
        "reason": "风格不匹配：该段过于直白，不符合作者show-don't-tell的风格",
        "source": "advisor_report_style_check",
        "author_approved": true,
        "token_delta": +15
      },
      {
        "hunk_id": "h002",
        "type": "deleted",
        "location": "场景3，整段",
        "original_text": "被删除的段落...",
        "modified_text": "",
        "modification_type": "scene_compression",
        "reason": "过度描写打断了节奏",
        "source": "author_direct",
        "author_approved": true,
        "token_delta": -120
      },
      {
        "hunk_id": "h003",
        "type": "added",
        "location": "场景1后",
        "original_text": "",
        "modified_text": "新增的过渡段落...",
        "modification_type": "continuity_fix",
        "reason": "场景1到场景2的跳跃过于突兀，需要过渡",
        "source": "advisor_report_continuity",
        "author_approved": true,
        "token_delta": +85
      }
    ],
    
    "statistics": {
      "total_hunks": 3,
      "modified": 1,
      "added": 1,
      "deleted": 1,
      "total_token_delta": -20,
      "lines_changed": 25
    },
    
    "rollback_info": {
      "can_rollback": true,
      "base_version_stored": true,
      "rollback_command": "rollback_diff(diff_id='diff_001')"
    }
  }
}
```

---

## 6.6 对话引擎

### 6.6.1 设计目标

对话引擎是工作室引擎的**专用对话生成器**。当 Brief 中某场景以对话为主导时，对话引擎接管该场景的文本生成。

核心设计原则：
1. **角色声音区分**：每个角色必须有独特的说话方式
2. **潜台词优先**：好的对话不说出它想表达的东西
3. **动作即标点**：用动作替代对话标签
4. **信息自然流动**：对话承载叙事功能而非单纯交流

### 6.6.2 对话生成 Prompt 模板

```
[SYSTEM]
你是对话写作专家。你写的对话读起来像人在真实说话，而非"朗读台词"。

核心原则：
1. 每个角色的对话风格独特可辨识
2. 对话中自然嵌入动作和神态
3. 重要的不只是说了什么，还有没说什么
4. 对话推动情节或揭示性格
5. 避免"话筒架对话"（两个角色站着不动互相说台词）

[USER]
请为以下场景创作对话：

## 场景信息
- 地点：{location}
- 时间：{time}
- 氛围：{atmosphere}
- 场景目的：{scene_purpose}

## 参与角色
{for each character in characters}
### {character.name}
- 身份：{character.role}
- 性格特征：{character.traits}
- 当前情绪：{character.emotional_state}
- 目标（在这次对话中想达到什么）：{character.dialogue_goal}
- 隐藏的真实想法：{character.hidden_thought}
- 语言风格：{character.speech_pattern}
  * 常用词汇：{character.signature_words}
  * 句长偏好：{character.sentence_length_pref}
  * 语气：{character.tone}
  * 口头禅/标志性表达：{character.catchphrases}
  * 特殊习惯：{character.speech_quirks}
{end for}

## 对话需要完成的叙事任务
{narrative_tasks}

## 对话需要传递的信息
{information_to_convey}

## 潜台词要求
{subtext_requirements}

## 节奏要求
- 对话篇幅：{target_dialogue_word_count}字
- 情感走向：{emotional_trajectory}
- 紧张度变化：{tension_curve}

## 格式要求
- 对话中穿插动作和神态描写
- 避免使用"他说""她说"等简单对话标签
- 每段对话不超过3句（除非角色在长篇大论）
- 对话之间用空行分隔

请输出对话文本。
```

### 6.6.3 对话质量约束

```python
DIALOGUE_CONSTRAINTS = {
    # 每句对话字数限制
    "max_words_per_line": {
        "default": 35,
        "monologue": 120,      # 长篇独白例外
        "shout": 15,           # 大喊时短促
        "whisper": 25         # 低语时简短
    },
    
    # 对话推进要求
    "progression_rules": [
        "每3-5轮对话必须有一次'推进'（新信息、态度变化、冲突升级）",
        "对话不能原地打转（重复已知信息）",
        "每个角色的发言必须有其目的性",
        "对话结尾必须有'钩子'（未回答的问题、突然的沉默、新决定）"
    ],
    
    # 对话标签约束
    "tag_constraints": {
        "prefer_action_tags": True,      # 优先用动作代替said
        "action_tag_ratio": 0.7,         # 70%的对话标注用动作
        "said_variation_limit": 5,       # said的替换词最多5种
        "forbidden_tags": ["高兴地", "悲伤地", "愤怒地", "简单地说"],  # 禁止纯粹副词标签
        "max_adverbs_per_scene": 2       # 每场景最多2个副词修饰的said
    },
    
    # 沉默和留白
    "silence_and_pauses": {
        "require_pauses": True,           # 要求有停顿
        "min_pauses_per_scene": 1,        # 每场景至少1处停顿
        "pause_types": ["沉默", "欲言又止", "转移话题", "动作替代回答", "突然中断"]
    }
}
```

### 6.6.4 多角色对话切换提示

```
## 多角色对话管理

### 角色切换标记
当3个及以上角色同时对话时，使用以下策略：

1. **"锚定"策略**：保持视角角色为中心，其他角色的对话通过视角角色的观察和反应来呈现
2. **"轮流"策略**：明确谁在对谁说话，避免读者混淆
3. **"打断"策略**：允许角色打断彼此，制造真实感

### 标记方式
- 每段对话开头明确是谁说的（通过动作或简短标注）
- 如果对话超过3轮，每隔3轮插入一次"场景描述"（谁在做什么、表情如何）
- 角色超过4人时，将大对话分解为2-3人小组对话

### 群体对话模板
```
角色A动作+发言。

角色B反应+回应。角色C听到后插嘴。角色B转向C反驳。

（视角角色观察到：角色D一直保持沉默，手指敲打着桌面）

角色D突然开口...
```
```

### 6.6.5 潜台词和言外之意的注入方法

```python
class SubtextInjector:
    """
    潜台词注入器：在对话中嵌入言外之意
    """
    
    SUBTEXT_TECHNIQUES = {
        "evasion": {
            "description": "回避直接回答",
            "pattern": "当角色被问到关键问题时，转移话题、回答另一个问题、或沉默",
            "example": "'你知道他是谁吗？' '……今天天气不错。'"
        },
        "double_meaning": {
            "description": "表面说一件事，实际指另一件事",
            "pattern": "选择与当前情境有双重解读空间的词汇",
            "example": "'这条路不好走。'（既指实际道路，也指人生选择）"
        },
        "ironic_undertone": {
            "description": "语气与内容不符",
            "pattern": "用轻松语气说严肃内容，或用严肃语气说轻松内容",
            "example": "'太好了，真是太好了。'（配以咬牙切齿的动作）"
        },
        "implication_by_omission": {
            "description": "通过不说什么来表达",
            "pattern": "角色刻意回避某个话题，读者注意到这个回避",
            "example": "角色详细回答了所有问题，唯独跳过了关于'那天'的一切"
        },
        "power_dynamics": {
            "description": "通过对话结构展示权力关系",
            "pattern": "谁打断谁、谁沉默等待、谁改变话题",
            "example": "地位高的人用短句，地位低的人用长句解释；地位高的人可以直接改变话题"
        },
        "emotional_bleed": {
            "description": "角色情绪通过对话外溢",
            "pattern": "对话内容平静，但伴随的动作/神态泄露真实情绪",
            "example": "'我没事。'她说，同时把茶杯捏出了一道裂纹。"
        }
    }
    
    def inject_subtext(self, dialogue: str, subtext_plan: dict) -> str:
        """
        为对话注入潜台词
        
        输入：
        - dialogue: 初步对话文本
        - subtext_plan: 潜台词计划（在哪段对话注入什么潜台词）
        
        输出：
        - 带有潜台词的对话文本
        """
        # 实际实现中，这个函数通常作为对话生成Prompt的一部分
        # 在Prompt中指示"在这段对话中使用回避策略"
        pass
```

---

## 6.7 冲突编排器

### 6.7.1 设计目标

冲突编排器是工作室引擎的**冲突场景专用生成器**。无论是武力对决、智力博弈还是权力斗争，冲突编排器确保冲突场景具有张力、节奏感和叙事功能。

核心设计原则：
1. **冲突不只是打架**：冲突是角色目标的对立，武力只是表达方式之一
2. **升级曲线**：冲突必须有逐步升级的过程，不能一步到位
3. **代价与后果**：每次冲突都有代价，不是免费的
4. **角色通过冲突展示性格**：冲突是角色塑造的放大器

### 6.7.2 冲突类型的分类体系

```json
{
  "conflict_types": {
    "physical_combat": {
      "display_name": "武力冲突",
      "description": "以武力手段解决目标对立",
      "subtypes": [
        {
          "id": "duel",
          "name": "单挑对决",
          "characteristics": ["一对一", "技能展示", "心理博弈", "实力差距"] ,
          "rhythm": "试探→交锋→压制→逆转→决胜"
        },
        {
          "id": "group_battle",
          "name": "群战",
          "characteristics": ["多对多", "场面描写", "团队协作", "混战"],
          "rhythm": "阵型→接触→混乱→局部突破→整体溃败/逆转"
        },
        {
          "id": "ambush",
          "name": "伏击/偷袭",
          "characteristics": ["信息不对称", "突袭优势", "快速解决或持久缠斗"],
          "rhythm": "潜伏→爆发→压制→反制→解决"
        },
        {
          "id": "siege",
          "name": "攻防战",
          "characteristics": ["阵地", "持久战", "资源消耗", "战术博弈"],
          "rhythm": "对峙→试探攻击→全面进攻→胶着→突破口→结束"
        },
        {
          "id": "chase",
          "name": "追逐战",
          "characteristics": ["移动中", "环境利用", "速度/耐力比拼"],
          "rhythm": "发现→追击→干扰→加速→拦截→捕获/逃脱"
        }
      ]
    },
    
    "intellectual_gambit": {
      "display_name": "智力博弈",
      "description": "以智谋、策略、推理为手段的冲突",
      "subtypes": [
        {
          "id": "deduction_battle",
          "name": "推理对决",
          "characteristics": ["线索分析", "逻辑推演", "真相揭示"],
          "rhythm": "谜面→线索收集→假设→验证→推翻→新假设→真相"
        },
        {
          "id": "negotiation",
          "name": "谈判博弈",
          "characteristics": ["筹码交换", "底牌隐藏", "心理战", "信息优势"],
          "rhythm": "立场宣示→试探→出价→反出价→威胁→妥协/破裂"
        },
        {
          "id": "scheme_counterscheme",
          "name": "谋略交锋",
          "characteristics": ["布局", "计中计", "信息不对称", "时机把控"],
          "rhythm": "布局→执行→对手反应→第二层布局→最终揭晓"
        },
        {
          "id": "social_maneuvering",
          "name": "社交博弈",
          "characteristics": ["面子", "暗示", "联盟", "舆论"],
          "rhythm": "试探→结盟/对立→暗斗→摊牌→格局改变"
        }
      ]
    },
    
    "emotional_conflict": {
      "display_name": "情感冲突",
      "description": "以情感对立为核心的冲突",
      "subtypes": [
        {
          "id": "confrontation",
          "name": "情感对峙",
          "characteristics": ["情感爆发", "真相揭露", "关系重塑"],
          "rhythm": "压抑→触发→爆发→摊牌→后果"
        },
        {
          "id": "betrayal",
          "name": "背叛揭示",
          "characteristics": ["信任崩塌", "双重身份", "情感冲击"],
          "rhythm": "正常→怀疑→证据→确认→崩塌→抉择"
        },
        {
          "id": "sacrifice_dilemma",
          "name": "牺牲抉择",
          "characteristics": ["两难", "代价", "价值观考验"],
          "rhythm": "困境→权衡→抉择→执行→代价→承受"
        },
        {
          "id": "rivalry",
          "name": "竞争对抗",
          "characteristics": ["长期对抗", "互有胜负", "相互成长"],
          "rhythm": "初遇→较量→互有胜负→升级→高潮→结局"
        }
      ]
    },
    
    "power_struggle": {
      "display_name": "权力斗争",
      "description": "以权力、地位、控制权为目标的冲突",
      "subtypes": [
        {
          "id": "political_intrigue",
          "name": "政治权谋",
          "characteristics": ["多方博弈", "利益交换", "背地操作", "明暗双线"],
          "rhythm": "局势→结盟→暗斗→摊牌→新格局"
        },
        {
          "id": "succession_conflict",
          "name": "继承权争夺",
          "characteristics": ["合法性", "支持者", "血统/能力之争"],
          "rhythm": "平静→挑战→站队→冲突→裁决"
        },
        {
          "id": "ideological_clash",
          "name": "理念冲突",
          "characteristics": ["价值观对立", "不可调和", "没有简单的对错"],
          "rhythm": "分歧→辩论→激化→行动→后果"
        }
      ]
    },
    
    "survival_conflict": {
      "display_name": "生存冲突",
      "description": "以生存为直接目标的冲突",
      "subtypes": [
        {
          "id": "environmental",
          "name": "环境对抗",
          "characteristics": ["自然灾害", "极端环境", "资源匮乏"],
          "rhythm": "平静→危机→应对→恶化→突破→生存"
        },
        {
          "id": "escape",
          "name": "逃亡",
          "characteristics": ["追捕者", "极限体力", "策略逃亡"],
          "rhythm": "被发现→逃跑→阻碍→绝路→转机→逃脱"
        }
      ]
    }
  }
}
```

### 6.7.3 冲突节奏的模板

```
所有冲突场景遵循统一的四阶段节奏：

阶段1：升级 (Escalation)
├── 目的：建立冲突，让读者理解为什么打/斗/争
├── 长度：占冲突场景的 15-20%
├── 关键元素：
│   ├── 目标对立明确化
│   ├── 筹码/代价展示
│   ├── 情绪/气氛升温
│   └── 各角色准备/就位
└── 写作要点：不能太长，要尽快进入实质对抗

阶段2：交锋 (Engagement)
├── 目的：核心对抗，展示双方的实力和策略
├── 长度：占冲突场景的 50-60%
├── 关键元素：
│   ├── 多轮次对抗（至少3个回合）
│   ├── 双方各有得失
│   ├── 中间有"转折点"（形势似乎要倒向一方）
│   ├── 展示角色的独特能力/风格
│   └── 穿插角色的心理活动
└── 写作要点：要有起伏，不能一面倒

阶段3：高潮 (Climax)
├── 目的：决定胜负/结果的关键时刻
├── 长度：占冲突场景的 10-15%
├── 关键元素：
│   ├── 胜负手/关键决策
│   ├── 意外因素介入（或蓄谋已久的底牌揭开）
│   ├── 情感浓度最高
│   └── 结果不可逆转
└── 写作要点：要给读者"屏住呼吸"的感觉

阶段4：收束 (Resolution)
├── 目的：展示后果，铺设后续
├── 长度：占冲突场景的 15-20%
├── 关键元素：
│   ├── 胜负结果
│   ├── 代价展示（即使是赢家也有代价）
│   ├── 观众/旁观者的反应
│   ├── 新局势的确立
│   └── 后续伏笔
└── 写作要点：不能戛然而止，要让读者感受结果的重量
```

### 6.7.4 冲突场景 Prompt 模板

```
[SYSTEM]
你是 NarrativeOS 的冲突编排器。你擅长创作张力十足、节奏精准的冲突场景。

核心原则：
1. 冲突是角色性格的放大镜——通过战斗/博弈方式展示角色本质
2. 节奏比场面更重要——读者感受的是紧张感，不是招式清单
3. 代价让胜利有意义——没有代价的胜利是廉价的
4. 意外但不要突兀——转折有铺垫，读者回想时说"原来如此"

[USER]
请创作一个{conflict_type_display}冲突场景。

## 冲突基本信息
- 冲突类型：{conflict_subtype_name}
- 节奏模板：{rhythm_template}
- 预估字数：{estimated_word_count}
- 场景位置：{scene_position_in_chapter}

## 对抗双方
{for each side in sides}
### {side.name}
- 角色：{side.character_names}
- 目标：{side.objective}
- 优势：{side.advantages}
- 劣势/弱点：{side.weaknesses}
- 隐藏底牌：{side.hidden_cards}
- 不能输的理由：{side.stakes}
- 实力评估：{side.power_level}
{end for}

## 冲突进程要求
### 阶段1：升级（~{escalation_words}字）
{escalation_requirements}

### 阶段2：交锋（~{engagement_words}字）
{engagement_requirements}
- 回合设计要求：
{round_design}

### 阶段3：高潮（~{climax_words}字）
{climax_requirements}

### 阶段4：收束（~{resolution_words}字）
{resolution_requirements}

## 特殊要求
- 必须展示的角色特质：{traits_to_showcase}
- 必须埋下的伏笔：{foreshadowing_to_plant}
- 必须揭示的信息：{revelations}

## 战力平衡参考
{power_balance_reference}

## 风格约束
{style_constraints}

请输出完整的冲突场景文本。
```

### 6.7.5 战力平衡校验的集成

```python
class PowerBalanceChecker:
    """
    战力平衡校验器：确保冲突结果符合战力设定
    """
    
    def __init__(self, world_state: WorldState):
        self.world_state = world_state
    
    def check_combat(self, combat_text: str, combatants: list) -> BalanceCheckResult:
        """
        校验战斗场景是否符合战力设定
        """
        issues = []
        
        for i, combatant in enumerate(combatants):
            # 获取角色当前战力
            actual_power = self.world_state.get_character_power(combatant.character_id)
            
            # 检查文本中的战力表现
            displayed_power = self._estimate_displayed_power(combat_text, combatant.name)
            
            # 战力偏差检测
            if displayed_power > actual_power * 1.5:
                issues.append(PowerIssue(
                    severity="major",
                    description=f"{combatant.name}的表现（{displayed_power}）远超设定战力（{actual_power}）",
                    suggestion="降低该角色的战斗表现，或提前铺垫战力提升"
                ))
            elif displayed_power < actual_power * 0.5:
                issues.append(PowerIssue(
                    severity="minor",
                    description=f"{combatant.name}的表现（{displayed_power})明显低于设定战力（{actual_power}）",
                    suggestion="如无特殊原因（受伤、放水等），应提升表现"
                ))
        
        # 检查战斗结果是否合理
        winner = self._identify_winner(combat_text)
        if winner:
            winner_power = self.world_state.get_character_power(winner.character_id)
            loser = [c for c in combatants if c != winner][0]
            loser_power = self.world_state.get_character_power(loser.character_id)
            
            # 弱者胜强者必须有合理解释
            if winner_power < loser_power * 0.7:
                justification = self._find_justification(combat_text, winner, loser)
                if not justification:
                    issues.append(PowerIssue(
                        severity="fatal",
                        description=f"弱者（{winner.name}, 战力{winner_power}）战胜了强者（{loser.name}, 战力{loser_power}），但没有合理的解释",
                        suggestion="添加战力逆转的合理解释（环境、策略、底牌、状态差异等）"
                    ))
        
        return BalanceCheckResult(
            passed=len([i for i in issues if i.severity == "fatal"]) == 0,
            issues=issues
        )
    
    def _estimate_displayed_power(self, text: str, character_name: str) -> float:
        """
        从文本中估算角色的战力表现
        基于描述的力量/速度/技巧等关键词
        """
        # 实现：在文本中找到角色相关的描写段落
        # 统计战力相关的描述词（强大、迅捷、碾压、不敌等）
        # 返回一个相对的战力估值
        pass
```

---

## 6.8 读者知识图谱

### 6.8.1 设计目标

读者知识图谱（Reader Knowledge Graph, RKG）是工作室引擎的**信息管理系统**。它追踪读者在故事中的每一个时间点"知道什么、不知道什么、以为是什么"，是管理信息差、制造悬念和戏剧反讽的核心工具。

核心设计原则：
1. **信息差即张力**：读者和角色之间的信息差异是叙事张力的主要来源
2. **精确追踪**：每个知识点的状态精确到章节级别
3. **公平性**：推理类信息必须在揭晓前向读者展示
4. **动态更新**：知识状态随叙事推进实时更新

### 6.8.2 知识的分类体系

```json
{
  "knowledge_classification": {
    "fact_knowledge": {
      "description": "事实知识——关于世界、角色、事件的客观事实",
      "subtypes": [
        {
          "id": "world_fact",
          "name": "世界事实",
          "examples": ["这个世界的战力体系", "某个地点的地理特征", "某个组织的历史"]
        },
        {
          "id": "character_fact",
          "name": "角色事实",
          "examples": ["角色的真实身份", "角色的过去经历", "角色的隐藏能力"]
        },
        {
          "id": "event_fact",
          "name": "事件事实",
          "examples": ["某事件的真实经过", "某事件的真实幕后黑手", "某事件的真实后果"]
        }
      ]
    },
    
    "relationship_knowledge": {
      "description": "关系知识——关于角色之间、势力之间的关系",
      "subtypes": [
        {
          "id": "character_relationship",
          "name": "角色关系",
          "examples": ["A其实是B的兄弟", "C是D安插的卧底", "E暗恋F"]
        },
        {
          "id": "faction_relationship",
          "name": "势力关系",
          "examples": ["X势力暗中支持Y势力", "Z势力其实是W势力的分支"]
        },
        {
          "id": "causal_relationship",
          "name": "因果关系",
          "examples": ["事件A导致了事件B", "C的出现是D策划的"]
        }
      ]
    },
    
    "speculative_knowledge": {
      "description": "推测知识——基于已有信息的合理推测",
      "subtypes": [
        {
          "id": "character_motive",
          "name": "动机推测",
          "examples": ["A之所以这样做，可能是因为...", "B的真实目的是..."]
        },
        {
          "id": "plot_prediction",
          "name": "剧情预测",
          "examples": ["接下来可能会发生...", "C可能会在关键时刻..."]
        },
        {
          "id": "mystery_hypothesis",
          "name": "谜团假设",
          "examples": ["真凶可能是...", "那个神秘人其实是..."]
        }
      ]
    }
  }
}
```

### 6.8.3 知识状态的追踪机制

```json
{
  "knowledge_states": {
    "known": {
      "description": "读者确信自己知道的知识",
      "characteristics": ["在正文中明确展示过", "没有矛盾信息"],
      "narrative_effect": "可以作为读者理解后续情节的基础"
    },
    "unknown": {
      "description": "读者完全不知道的知识",
      "characteristics": ["从未在正文中提及", "角色可能知道也可能不知道"],
      "narrative_effect": "潜在的揭示素材"
    },
    "misunderstood": {
      "description": "读者知道但理解错误的信息",
      "characteristics": [ "在正文中展示过", "展示方式有误导性", "与真相矛盾"],
      "narrative_effect": "反转的基础——读者发现'原来不是这样'的震惊感"
    },
    "suspected": {
      "description": "读者有疑虑但没有确证的知识",
      "characteristics": ["有线索但不充分", "读者可能猜对也可能猜错"],
      "narrative_effect": "悬疑感的来源"
    },
    "partially_known": {
      "description": "读者知道一部分但不完整的知识",
      "characteristics": ["信息碎片化", "缺失关键部分"],
      "narrative_effect": "读者会试图拼凑完整图景"
    },
    "forgotten": {
      "description": "曾经在早期展示过但读者可能已经遗忘的知识",
      "characteristics": ["在很前面的章节展示", "之后未再提及"],
      "narrative_effect": "回收伏笔时的'Aha!'时刻"
    }
  }
}
```

#### 知识条目数据结构

```json
{
  "knowledge_item": {
    "item_id": "ki_001",
    "content": "主角其实是失踪多年的皇子",
    "classification": {
      "primary_type": "character_fact",
      "subtype": "character_identity"
    },
    "state_tracking": [
      {
        "chapter": 1,
        "reader_state": "unknown",
        "relevant_characters": ["protagonist"],
        "note": "此时读者对主角身份一无所知"
      },
      {
        "chapter": 15,
        "reader_state": "suspected",
        "trigger": "主角展示了只有皇室才有的特殊能力",
        "note": "读者开始怀疑主角身份不凡"
      },
      {
        "chapter": 35,
        "reader_state": "partially_known",
        "trigger": "有人认出主角的玉佩是宫中物品",
        "note": "读者知道主角与皇室有关，但不确定具体关系"
      },
      {
        "chapter": 80,
        "reader_state": "known",
        "trigger": "主角身世正式揭晓",
        "note": "读者确认主角是失踪的皇子"
      }
    ],
    "dramatic_irony_config": {
      "enabled": true,
      "irony_periods": [
        {
          "start_chapter": 35,
          "end_chapter": 80,
          "type": "reader_knows_character_doesnt",
          "description": "读者知道主角与皇室有关，但主角自己不知道",
          "effect": "读者期待主角发现真相时的反应"
        }
      ]
    },
    "foreshadowing_schedule": [
      {
        "chapter": 8,
        "method": "subtle_hint",
        "content": "描写主角对皇宫有特殊的感觉"
      },
      {
        "chapter": 22,
        "method": "symbolic_detail",
        "content": "主角的胎记形状与皇室图腾相似"
      }
    ],
    "reveal_plan": {
      "target_chapter": 80,
      "reveal_method": "dramatic_confrontation",
      "reveal_style": "通过反派之口揭露，主角被迫面对"
    }
  }
}
```

### 6.8.4 信息差管理的算法

```python
class InformationGapManager:
    """
    信息差管理器
    """
    
    def compute_gaps(self, chapter_number: int) -> InformationGapReport:
        """
        计算指定章节的信息差状况
        
        返回的信息差类型：
        1. reader_over_character: 读者知道但角色不知道（戏剧反讽）
        2. character_over_reader: 角色知道但读者不知道（悬疑）
        3. mutual_unknown: 读者和角色都不知道（共同探索）
        4. mutual_misunderstanding: 读者和角色都理解错误（最大反转）
        5. selective_knowledge: 部分角色知道，部分不知道，读者知道谁知道（张力）
        """
        
        report = InformationGapReport(chapter=chapter_number)
        
        for item in self.knowledge_base.get_all_items():
            current_state = item.get_state_at(chapter_number)
            
            # 计算读者与每个角色的信息差
            for character in self.world_state.characters:
                char_knows = character.knows(item.item_id, chapter_number)
                
                if current_state == "known" and char_knows == False:
                    # 读者知道，角色不知道 → 戏剧反讽
                    report.add_gap(InformationGap(
                        type="reader_over_character",
                        knowledge=item,
                        character=character,
                        narrative_value=self._score_dramatic_irony(item, character)
                    ))
                    
                elif current_state == "unknown" and char_knows == True:
                    # 角色知道，读者不知道 → 悬疑
                    report.add_gap(InformationGap(
                        type="character_over_reader",
                        knowledge=item,
                        character=character,
                        narrative_value=self._score_suspense_potential(item, character)
                    ))
                    
                elif current_state == "unknown" and char_knows == False:
                    # 都不知道 → 共同探索
                    report.add_gap(InformationGap(
                        type="mutual_unknown",
                        knowledge=item,
                        character=character,
                        narrative_value=self._score_discovery_potential(item)
                    ))
                    
                elif current_state == "misunderstood" and char_knows == True:
                    # 读者误解，角色知道真相 → 真相揭露的震撼
                    report.add_gap(InformationGap(
                        type="character_over_misreader",
                        knowledge=item,
                        character=character,
                        narrative_value=self._score_revelation_impact(item, character)
                    ))
        
        # 按叙事价值排序
        report.sort_by_narrative_value()
        return report
    
    def recommend_disclosure(self, chapter_number: int, 
                            target_gap_type: str = None) -> list[DisclosureRecommendation]:
        """
        推荐本章应该披露/利用的信息差
        """
        report = self.compute_gaps(chapter_number)
        recommendations = []
        
        # 获取高价值的信息差
        high_value_gaps = [g for g in report.gaps if g.narrative_value > 0.7]
        
        # 根据本章Brief匹配合适的披露时机
        for gap in high_value_gaps:
            if target_gap_type and gap.type != target_gap_type:
                continue
                
            rec = DisclosureRecommendation(
                knowledge=gap.knowledge,
                gap_type=gap.type,
                recommendation=self._generate_disclosure_strategy(gap, chapter_number),
                urgency=self._compute_urgency(gap, chapter_number),
                confidence=0.85
            )
            recommendations.append(rec)
        
        return sorted(recommendations, key=lambda x: x.urgency, reverse=True)[:5]
    
    def _score_dramatic_irony(self, item: KnowledgeItem, character: Character) -> float:
        """
        评估戏剧反讽的叙事价值
        
        因素：
        - 信息的重要性（越重要越高）
        - 角色知道真相后的潜在反应强度
        - 读者等待揭晓的耐心（太久的反讽会疲惫）
        """
        importance = item.importance_score  # 0-1
        reaction_potential = character.reaction_intensity_if_revealed(item)  # 0-1
        freshness = max(0, 1 - (self.current_chapter - item.last_state_change) / 50)  # 0-1
        
        return (importance * 0.4 + reaction_potential * 0.35 + freshness * 0.25)
```

### 6.8.5 知识更新触发条件

```python
class KnowledgeUpdateTrigger:
    """
    知识更新触发器
    
    以下事件会触发读者知识状态的更新：
    """
    
    TRIGGERS = {
        # 触发条件 → 执行的操作
        "chapter_generation_complete": {
            "description": "每章正文生成完成后",
            "action": "扫描本章正文，识别新披露的信息",
            "workflow": [
                "1. 提取本章中所有'事实陈述'",
                "2. 与已有知识库比对",
                "3. 新事实 → 添加到知识库，状态=known",
                "4. 与已有事实矛盾 → 标记为潜在误解或更新",
                "5. 角色对话中提到的信息 → 根据披露方式确定读者是否获得",
                "6. 生成知识更新报告"
            ]
        },
        
        "author_explicit_reveal": {
            "description": "作者明确标注某信息在本章揭晓",
            "action": "更新对应知识条目的状态为known",
            "priority": "immediate"
        },
        
        "misdirection_detection": {
            "description": "系统检测到文本中的误导性描述",
            "action": "创建或更新misunderstood状态的知识条目",
            "detection_method": "对比文本中的叙述与事实库，标记叙事与事实的不一致"
        },
        
        "foreshadowing_planted": {
            "description": "在本章中埋下伏笔",
            "action": "创建新的知识条目，状态=forgotten（等待未来回收）",
            "note": "伏笔对应的真正信息可能要到几十章后才揭晓"
        },
        
        "callback_activated": {
            "description": "本章回收了之前的伏笔",
            "action": "将对应知识条目的状态从forgotten更新为known",
            "special": "同时标记callback关系，用于分析叙事结构"
        },
        
        "reader_feedback": {
            "description": "作者反馈读者对某信息的理解状态",
            "action": "人工校正对应知识条目的读者状态",
            "examples": ["读者说：'我早就猜到了' → suspected→known"]
        }
    }
```

### 6.8.6 RKG 与 Brief 的集成

```
每章 Brief 生成时，RKG 提供以下输入：

1. reader_knowledge_state → Brief.information_management
   - 当前读者的完整知识快照
   - 每个知识点的读者确信度

2. recommended_disclosures → Brief.key_events
   - 建议在本章揭晓的高价值信息
   - 每个推荐的叙事理由和预期效果

3. dramatic_irony_opportunities → Brief.scene_breakdown
   - 可以在场景中利用的戏剧反讽
   - 哪些角色不知道读者知道的信息

4. foreshadowing_opportunities → Brief.continuity_requirements
   - 可以自然铺设伏笔的位置
   - 哪些未来揭晓的信息需要提前铺垫

5. information_fairness_check → Brief.technical_requirements
   - 推理类信息的公平性检查
   - 确保所有揭晓的关键信息在此前都有线索

每章正文生成后，RKG 的更新流程：
1. 解析正文中的信息释放
2. 更新各知识条目的读者状态
3. 检测新的误解或误导
4. 记录伏笔铺设和回收
5. 生成本章的知识更新日志
```

---

## 6.9 附录

### 6.9.1 LLM 调用节点汇总

| 调用节点 | 类型 | Temperature | 频率 | 输入 | 输出 |
|---------|------|-------------|------|------|------|
| 生成 Brief | 重型 | 0.5 | 每章1次 | 可能性清单 + 前文摘要 + 世界状态 | Brief JSON |
| 生成正文 | 重型 | 0.8 | 每章1次 | 五层Prompt | 章节正文 |
| 修改正文 | 重型 | 0.3 | 按需 | 修改指令 + 原文 + 上下文 | 修改后文本 |
| 质量评分 | 轻型 | 0.1 | 每章3次并行 | 正文段落 | 质量分数 + 评语 |
| 叙事价值评估 | 轻型 | 0.3 | 每章5次 | 正文 + Brief | 叙事价值分 + 建议 |
| AMA 风格蒸馏 | 重型 | 0.3 | 多轮，低频 | 作者历史正文 | 风格配置文件 |
| 代价共情化 | 重型 | 0.5 | 低频 | 情节决策 + 角色状态 | 情感影响评估 |
| 章节摘要生成 | 轻型 | 0.3 | 每章1次 | 正文 | 结构化摘要 |
| 对话生成 | 重型 | 0.7 | 按需 | 对话场景参数 | 对话文本 |
| 冲突编排 | 重型 | 0.7 | 按需 | 冲突参数 | 冲突场景文本 |

### 6.9.2 Token 预算参考表

| 层级 | 典型Token数 | 可压缩最低 | 压缩策略 |
|------|-----------|-----------|---------|
| 风格层 | 2000-3000 | 800 | 摘要化风格指南 |
| 约束层 | 1500-2500 | 1200 | 删除次要约束 |
| 上下文层 | 4000-8000 | 1500 | 按相似度截断 |
| 状态层 | 2000-4000 | 1500 | 精简角色描述 |
| 指令层 | 1500-2500 | 1200 | 简化示例 |
| **总计** | **11000-20000** | **6200** | — |

### 6.9.3 关键设计决策记录

| 决策 | 方案 | 原因 |
|------|------|------|
| 五层顺序 | 风格→约束→上下文→状态→指令 | LLM注意力衰减，越重要越靠后 |
| 单次调用 | 不采用多轮 | 降低延迟、提高确定性 |
| 风格层可压缩 | 允许压缩为摘要 | 风格是"软约束"，压缩后仍有效果 |
| 上下文层用向量检索 | pgvector top-k | 精确匹配相关信息，避免信息过载 |
| 修改版本化 | 所有修改保留历史 | 可追溯、可回滚、可审计 |
| 对话独立引擎 | 专门的Prompt模板 | 对话有特殊要求，通用Prompt难以覆盖 |
| 冲突独立引擎 | 专门的节奏模板 | 冲突的节奏控制需要专业知识 |
| RKG独立追踪 | 不依赖Brief中的信息描述 | 信息状态变化太快，需要专门系统 |

---

> **文档版本**：v3.0  
> **最后更新**：2025年1月  
> **文档状态**：正式发布  
> **负责模块**：Studio Engine / 工作室引擎
