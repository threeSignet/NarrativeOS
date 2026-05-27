# 第七章 叙事要素系统（Narrative Elements System）

> **核心设计原则**：叙事要素系统不提供叙事裁决，只提供叙事透视。系统将文本还原为结构、关系与张力，但所有关于"该如何写"的建议，都必须经过作者的 sovereign 确认才能进入创作流程。

---

## 7.1 故事线追踪系统（Storyline Tracker）

### 7.1.1 设计哲学

百万字长篇网文通常同时运行数十条故事线——主线、支线、暗线、情感线、势力博弈线、成长线等。故事线追踪系统的核心使命是：**确保没有一条被作者倾注过心血的线，在漫长连载中被读者遗忘，甚至被作者自己遗忘。**

该系统不判断故事线的"好坏"，只回答以下问题：
- 当前有哪些活跃的故事线在运行？
- 哪些故事线已经休眠过久？
- 故事线之间的交叉点在哪里？
- 每章的叙事密度分布是否均衡？

### 7.1.2 故事线数据结构

#### 故事线本体（Storyline）

```typescript
interface Storyline {
  id: string;                          // 全局唯一标识，如 "sl-main-revenge"
  display_name: string;                 // 展示名称，如 "复仇主线"
  type: StorylineType;                  // 故事线类型
  status: StorylineStatus;              // 当前状态
  
  // 层级结构
  parent_id?: string;                   // 父故事线ID（用于子线归属）
  child_ids: string[];                  // 子故事线ID列表
  
  // 时间轴定位
  birth_chapter: number;                // 诞生章节（首次出现的章节序号）
  expected_resolution_chapter?: number;  // 预期完结章节（可动态调整）
  actual_resolution_chapter?: number;    // 实际完结章节
  
  // 叙事属性
  narrative_weight: number;             // 叙事权重 [0, 1]，主线接近1，闲笔接近0
  primary_characters: string[];         // 核心角色ID列表
  involved_factions: string[];          // 涉及势力ID列表
  
  // 关联系统
  associated_foreshadowings: string[];  // 关联的伏笔ID列表
  associated_themes: string[];          // 关联的主题ID列表
  
  // 元数据
  created_at: timestamp;
  updated_at: timestamp;
  author_notes?: string;                // 作者备注（自由文本）
}

enum StorylineType {
  MAIN = "main",           // 主线：贯穿全文的核心目标线
  SUB = "sub",             // 支线：有明确起止的次要故事线
  DARK = "dark",           // 暗线：读者尚未完全察觉的隐藏线
  EMOTIONAL = "emotional", // 情感线：角色间情感发展
  POWER = "power",         // 权谋线：势力博弈、政治斗争
  GROWTH = "growth",       // 成长线：角色能力提升或心智成熟
  WORLD = "world",         // 世界线：世界观揭示、秘密展开
  EPISODIC = "episodic",   // 单元线：单段或数章内完结的独立小线
}

enum StorylineStatus {
  ACTIVE = "active",         // 活跃：最近N章内有推进
  DORMANT = "dormant",       // 休眠：超过休眠阈值未提及
  RESOLVED = "resolved",     // 已完结：目标达成或自然终结
  ABANDONED = "abandoned",   // 已废弃：作者明确放弃
  FORESHADOWED = "foreshadowed", // 仅预埋：尚未正式展开
}
```

#### 故事线章节暴露记录（StorylineExposure）

```typescript
interface StorylineExposure {
  id: string;
  storyline_id: string;
  chapter_number: number;
  
  // 暴露度量化
  exposure_level: number;    // 本章暴露度 [0, 1]
                             // 0 = 完全未提及
                             // 0.1-0.3 = 侧面提及/背景存在
                             // 0.4-0.6 = 明确推进
                             // 0.7-0.9 = 核心焦点
                             // 1.0 = 决定性节点
  
  // 暴露方式细分
  exposure_channels: {
    direct_plot: number;     // 直接情节推进占比
    character_dialogue: number;  // 角色对话提及占比
    narration: number;       // 叙述/旁白占比
    other_character: number; // 其他角色提及占比
    atmospheric: number;     // 氛围/象征暗示占比
  };
  
  // 推进方向
  progression_direction: "forward" | "stall" | "regress" | "twist";
  progression_magnitude: number;  // 推进幅度 [0, 1]
  
  // 关联内容
  scene_ids: string[];       // 关联的场景ID列表
  character_ids: string[];   // 本章涉及的相关角色
  
  created_at: timestamp;
}
```

### 7.1.3 故事线状态追踪

#### 状态转换自动机

```
FORESHADOWED --[正式展开]--> ACTIVE
ACTIVE --[超过休眠阈值未提及]--> DORMANT
ACTIVE --[目标达成]--> RESOLVED
ACTIVE --[作者标记废弃]--> ABANDONED
DORMANT --[重新提及/推进]--> ACTIVE
DORMANT --[作者标记废弃]--> ABANDONED
```

#### 休眠判定算法

故事线从ACTIVE转入DORMANT的判定采用**动态半衰期模型**，而非固定章节数：

```typescript
function calculateDormancyThreshold(storyline: Storyline): number {
  // 基础休眠阈值（章节数）
  const baseThreshold = 15;
  
  // 根据叙事权重调整：主线更耐休眠，单元线更容易休眠
  const weightFactor = 1 + (1 - storyline.narrative_weight) * 2;
  
  // 根据已有长度调整：已连载很长的线允许更长的休眠
  const currentLength = getCurrentChapter() - storyline.birth_chapter;
  const lengthFactor = Math.min(1 + currentLength / 500, 2.0);
  
  // 根据关联伏笔数量调整：关联伏笔越多，系统越警惕其被遗忘
  const foreshadowingCount = storyline.associated_foreshadowings.length;
  const foreshadowingFactor = Math.max(1 - foreshadowingCount * 0.1, 0.5);
  
  return Math.round(baseThreshold * weightFactor * lengthFactor * foreshadowingFactor);
}
```

当一条ACTIVE故事线连续未提及的章节数超过`calculateDormancyThreshold`返回值时，谏官系统会触发`STORYLINE_DORMANT_RISK`告警。

### 7.1.4 故事线交叉检测

故事线交叉是多线叙事的核心魅力所在。系统自动检测以下交叉模式：

#### 交叉类型枚举

```typescript
enum StorylineCrossType {
  CONVERGENCE = "convergence",       // 汇聚：两条线合并为一条
  INTERSECTION = "intersection",     // 交汇：暂时相交后各自继续
  PARALLEL = "parallel",             // 并行：同时推进，相互映照
  CAUSAL = "causal",                 // 因果：一条线的进展触发另一条线
  MIRROR = "mirror",                 // 镜像：两条线呈对称/对照关系
  NESTED = "nested",                 // 嵌套：一条线完全包含在另一条线内
}
```

#### 交叉检测算法

```typescript
interface StorylineCrossing {
  id: string;
  storyline_a_id: string;
  storyline_b_id: string;
  cross_type: StorylineCrossType;
  
  // 时间定位
  detection_chapter: number;          // 检测到交叉的章节
  cross_start_chapter: number;        // 交叉起始章节
  cross_end_chapter?: number;         // 交叉结束章节（未结束则为空）
  
  // 交叉强度
  cross_intensity: number;            // 交叉强度 [0, 1]
  
  // 涉及的共享元素
  shared_characters: string[];        // 共享角色
  shared_locations: string[];         // 共享场景
  shared_themes: string[];            // 共享主题
  
  // 自动检测依据
  detection_basis: {
    same_scene: boolean;              // 是否在同一场景出现
    character_reference: boolean;     // 角色A在B线中被提及或反之
    thematic_overlap: number;         // 主题重叠度 [0, 1]
    causal_link?: string;             // 因果关联描述（如适用）
  };
  
  acknowledged: boolean;              // 作者是否已确认此交叉
}
```

**检测触发条件**（满足任意一条即生成候选交叉）：

1. **场景共现**：两条故事线在同一场景的同一章节中均有`exposure_level > 0.3`的记录
2. **角色桥接**：故事线A的核心角色在故事线B的章节中被明确提及，且叙事意义显著
3. **主题重叠**：两条故事线关联的主题集合Jaccard相似度 > 0.5
4. **因果推断**：世界引擎推演显示，故事线A的事件状态变化直接导致故事线B的触发条件满足

### 7.1.5 故事线密度分析

#### 密度矩阵

系统维护一个**故事线 × 章节**的密度矩阵，用于可视化每章的故事线分布：

```typescript
interface ChapterDensityProfile {
  chapter_number: number;
  total_word_count: number;
  
  // 各故事线暴露度
  storyline_exposures: Map<string, number>;  // storyline_id -> exposure_level
  
  // 聚合指标
  metrics: {
    active_storyline_count: number;    // 活跃故事线数量
    narrative_entropy: number;         // 叙事熵（故事线分布的混乱度）
    dominant_storyline_id?: string;    // 主导故事线（暴露度最高）
    density_balance: number;           // 密度均衡度 [0, 1]，越高越均衡
  };
}

// 叙事熵计算
function calculateNarrativeEntropy(exposures: number[]): number {
  const total = exposures.reduce((s, e) => s + e, 0);
  if (total === 0) return 0;
  
  const probabilities = exposures.map(e => e / total);
  return -probabilities.reduce((entropy, p) => {
    return p > 0 ? entropy + p * Math.log2(p) : entropy;
  }, 0);
}
```

**叙事熵的意义**：
- 熵接近0：整章几乎只推进一条故事线（适合高潮章节）
- 熵中等：多条故事线均衡推进（适合过渡章节）
- 熵过高：故事线过于碎片化，可能导致读者迷失（谏官预警）

### 7.1.6 故事线健康度评估

```typescript
interface StorylineHealthReport {
  generated_at: timestamp;
  chapter_range: [number, number];     // 评估章节范围
  
  // 整体健康指标
  overall_health_score: number;        // 综合健康分 [0, 100]
  
  // 细分指标
  indicators: {
    coverage_balance: number;          // 故事线覆盖均衡度 [0, 100]
    dormancy_risk_count: number;       // 处于休眠风险的故事线数
    orphan_foreshadowing_count: number; // 关联伏笔未被回收的故事线数
    main_progress_velocity: number;    // 主线推进速度（每章平均暴露度）
    cross_opportunity_count: number;   // 检测到但未利用的交叉机会数
  };
  
  // 逐故事线健康明细
  storyline_details: StorylineHealthDetail[];
  
  // 谏官建议（供作者参考）
  guardian_suggestions: GuardianSuggestion[];
}

interface StorylineHealthDetail {
  storyline_id: string;
  storyline_name: string;
  
  health_score: number;                // 该线健康分 [0, 100]
  
  // 状态指标
  current_status: StorylineStatus;
  chapters_since_last_exposure: number; // 距上次暴露的章节数
  
  // 趋势指标
  exposure_trend: "rising" | "stable" | "declining" | "dormant";
  recent_average_exposure: number;     // 最近10章平均暴露度
  
  // 风险标记
  risk_flags: StorylineRiskFlag[];
}

enum StorylineRiskFlag {
  OVERLONG_DORMANT = "overlong_dormant",       // 休眠时间过长
  ORPHAN_FORESHADOWING = "orphan_foreshadowing", // 有未回收伏笔
  STALLED_PROGRESS = "stalled_progress",       // 推进停滞
  UNEXPECTED_ABANDON = "unexpected_abandon",   // 有活跃角色但故事线未推进
  DENSITY_OVERLOAD = "density_overload",       // 单章暴露度过高挤压其他线
  CROSS_MISSED = "cross_missed",               // 错失交叉机会
}
```

#### 主线推进速度评估

主线推进速度采用**移动平均 + 方差分析**：

```typescript
function assessMainlineVelocity(
  mainStoryline: Storyline, 
  recentChapters: number = 50
): VelocityAssessment {
  const exposures = getRecentExposures(mainStoryline.id, recentChapters);
  
  // 计算移动平均
  const windowSize = 10;
  const movingAverages: number[] = [];
  for (let i = windowSize; i <= exposures.length; i++) {
    const window = exposures.slice(i - windowSize, i);
    const avg = window.reduce((s, e) => s + e.exposure_level, 0) / windowSize;
    movingAverages.push(avg);
  }
  
  // 计算趋势
  const firstHalfAvg = average(movingAverages.slice(0, Math.floor(movingAverages.length / 2)));
  const secondHalfAvg = average(movingAverages.slice(Math.floor(movingAverages.length / 2)));
  const trend = secondHalfAvg - firstHalfAvg;
  
  // 计算方差（波动性）
  const variance = calculateVariance(movingAverages);
  
  return {
    current_velocity: movingAverages[movingAverages.length - 1],
    trend,                          // 正数加速，负数减速
    volatility: variance,           // 越高越不稳定
    assessment: trend > 0.05 ? "accelerating" :
                trend < -0.05 ? "decelerating" : "stable",
    // 谏官：如果volatility过高，建议增加节奏稳定性
  };
}
```

### 7.1.7 与伏笔系统的联动

故事线与伏笔的联动通过以下机制实现：

```typescript
interface StorylineForeshadowingLink {
  storyline_id: string;
  foreshadowing_id: string;
  
  // 关联类型
  link_type: "depends_on" | "enables" | "resolves" | "echoes";
  
  // 依赖型关联的详细语义
  dependency_details?: {
    // 如果此伏笔不被回收，故事线将无法推进
    is_blocking: boolean;           // 是否为阻塞性依赖
    estimated_resolution_window: [number, number]; // 预期回收章节窗口
  };
  
  // 状态追踪
  status: "pending" | "partially_resolved" | "resolved";
}
```

**联动场景示例**：

1. **依赖检测**：当故事线S的推进需要伏笔F的回收时，系统追踪F的`half_life`。如果F的剩余半衰期不足而S仍在ACTIVE状态，谏官触发`FORESHADOWING_URGENCY`告警。

2. **回收确认**：当伏笔F被标记为"已回收"时，系统自动通知关联的故事线更新其`dependency_details.status`，并评估是否需要调整故事线的`expected_resolution_chapter`。

3. **narrative_potential 传递**：伏笔的`narrative_potential`值会部分传递给依赖它的故事线，用于评估该故事线未来可释放的叙事能量。

---

## 7.2 关系网演化系统（Relationship Network Evolution）

### 7.2.1 设计哲学

长篇网文中，角色关系是最具生命力的叙事要素。关系不是静态的"设定"，而是在每一次互动中不断演化的动态系统。关系网演化系统的使命是：**让作者始终清晰掌握角色间关系的当前状态、演化轨迹和未来可能。**

核心原则：
- **关系即叙事**：每一次关系权重的变化都是潜在的叙事契机
- **网络效应**：单个关系的变化会通过网络传导，产生连锁反应
- **隐性显性化**：系统帮助作者发现"作者直觉中知道但未明确设定"的关系模式

### 7.2.2 角色关系图数据模型

#### 关系边（Relationship Edge）

```typescript
interface Relationship {
  id: string;
  
  // 端点
  source_id: string;                    // 源角色ID
  target_id: string;                    // 目标角色ID
  
  // 关系类型（多重类型支持）
  relation_types: RelationType[];        // 如 ["mentor", "friend"]
  
  // 核心属性（动态演化）
  properties: RelationshipProperties;
  
  // 演化历史
  evolution_log: RelationshipEvent[];   // 按时间排序的关系事件
  
  // 状态
  status: "active" | "dormant" | "severed" | "transformed";
  
  // 元数据
  created_at_chapter: number;           // 关系首次确立的章节
  last_updated_chapter: number;         // 最后更新的章节
}

interface RelationshipProperties {
  // 情感维度 [-1, 1]
  affection: number;        // 好感度：-1=憎恨，0=中立，1=深爱
  trust: number;            // 信任度：-1=完全不信任，1=绝对信任
  respect: number;          // 尊敬度
  familiarity: number;      // 熟悉度：0=陌生人，1=知根知底
  
  // 权力维度
  power_differential: number;   // 权力位差 [-1, 1]：负数=target权力更大
  dependency: number;           // 依赖度 [0, 1]：source对target的依赖程度
  
  // 义务维度
  debt: number;             // 债务值：正值=source欠target，负值=反
  obligation: number;       // 义务强度 [0, 1]：道德/情感义务的强度
  
  // 张力维度
  latent_tension: number;   // 潜在张力 [0, 1]：表面平静下的暗流
  conflict_potential: number; // 冲突潜力 [0, 1]：爆发冲突的概率评估
}

enum RelationType {
  // 情感类
  ROMANTIC = "romantic",           // 恋爱
  FRIENDSHIP = "friendship",       // 友情
  FAMILY = "family",               // 亲情
  RIVALRY = "rivalry",             // 竞争
  ENMITY = "enmity",               // 敌对
  
  // 社会类
  MENTOR = "mentor",               // 师徒
  SUBORDINATE = "subordinate",     // 上下级
  ALLIANCE = "alliance",           // 同盟
  VASSAL = "vassal",               // 主从
  
  // 功能类
  DEBTOR = "debtor",               // 债务
  INFORMATION = "information",     // 情报交换
  RIVAL_FACTION = "rival_faction", // 阵营对立
  
  // 特殊类
  SECRET_KEEPER = "secret_keeper", // 秘密共守
  FALSE_FRONT = "false_front",     // 表面关系（实际与显示不同）
  SYMMETRIC = "symmetric",         // 对称关系（双向同等）
}
```

#### 关系事件（Relationship Event）

关系的事件驱动模型确保每一次关系的质变都有叙事依据：

```typescript
interface RelationshipEvent {
  id: string;
  relationship_id: string;
  chapter_number: number;
  scene_id?: string;
  
  event_type: RelationEventType;
  
  // 事件对属性的影响（增量值）
  property_changes: Partial<RelationshipProperties>;
  
  // 事件描述
  description: string;          // 如 "A在B危急时伸出援手"
  narrative_context: string;    // 叙事背景
  
  // 事件权重（对关系的影响力）
  impact_weight: number;        // [0, 1]
  
  // 是否为转折点
  is_turning_point: boolean;    // 若为true，则此事件可能导致关系类型变化
  
  created_at: timestamp;
}

enum RelationEventType {
  BETRAYAL = "betrayal",               // 背叛
  SACRIFICE = "sacrifice",             // 牺牲/付出
  SAVE = "save",                       // 拯救
  DECEIVE = "deceive",                 // 欺骗（被发现）
  SHARE_SECRET = "share_secret",       // 共享秘密
  CONFLICT = "conflict",               // 冲突/争吵
  COOPERATE = "cooperate",             // 合作成功
  GIFT = "gift",                       // 赠予/帮助
  INSULT = "insult",                   // 侮辱/轻视
  ACKNOWLEDGE = "acknowledge",         // 认可/赞赏
  PROXIMITY = "proximity",             // 长期共处
  SEPARATION = "separation",           // 分离/疏远
  POWER_SHIFT = "power_shift",         // 权力地位变化
  EXTERNAL_PRESSURE = "external_pressure", // 外部压力
}
```

### 7.2.3 关系动态更新机制

#### 事件→属性映射引擎

不同事件类型对关系属性的影响遵循**叙事合理性约束**，而非固定数值：

```typescript
interface EventImpactTemplate {
  event_type: RelationEventType;
  
  // 对基础属性的默认影响（可在具体情境中调整）
  default_impacts: {
    affection?: [number, number];     // [最小值, 最大值]
    trust?: [number, number];
    respect?: [number, number];
    debt?: [number, number];
    obligation?: [number, number];
    latent_tension?: [number, number];
  };
  
  // 影响系数（根据上下文调节）
  context_modifiers: {
    // 例如：SACRIFICE的影响 *= (1 + 牺牲严重程度 * 0.5)
    severity_multiplier?: string;     // 计算公式表达式
    reciprocity_discount?: string;    // 如果之前有互惠行为，影响调整
    pattern_multiplier?: string;      // 如果是重复模式，影响递减/递增
  };
  
  // 可能的类型转换
  possible_type_changes: {
    condition: string;                // 条件表达式
    new_type: RelationType;
    probability: number;
  }[];
}
```

**示例：BETRAYAL事件的影响**

| 属性 | 基础影响范围 | 情境调节 |
|------|------------|---------|
| trust | [-0.8, -0.3] | 若此前trust > 0.7，额外-0.2（高信任背叛伤害更大） |
| affection | [-0.6, -0.2] | 若存在obligation > 0.5，额外-0.15（道义背叛更伤人） |
| latent_tension | [0.2, 0.5] | 转化为ENMITY类型的概率 += 0.3 |
| respect | [-0.3, 0.1] | 若背叛出于"更大的善"，可能为正 |

#### 关系衰减模型

未被激活的关系会随时间自然衰减（模拟"疏远"）：

```typescript
function applyRelationshipDecay(
  relationship: Relationship,
  chaptersElapsed: number
): RelationshipProperties {
  const props = { ...relationship.properties };
  const decayFactor = Math.exp(-0.02 * chaptersElapsed); // 每章2%衰减
  
  // 仅衰减familiarity和affection的极端值
  // trust和respect保持相对稳定（"一朝被蛇咬"效应）
  props.familiarity *= decayFactor;
  props.affection = lerp(0, props.affection, decayFactor); // 向中立衰减
  props.obligation *= decayFactor;
  
  // debt不衰减（债务不会自动消失）
  // latent_tension不衰减（嫌隙可能加深）
  
  return props;
}
```

### 7.2.4 关系网络拓扑分析

#### 网络指标计算

```typescript
interface NetworkTopologyReport {
  calculated_at: timestamp;
  chapter_number: number;
  
  // 整体网络指标
  global_metrics: {
    node_count: number;               // 角色数
    edge_count: number;               // 关系数
    density: number;                  // 网络密度 [0, 1]
    average_clustering: number;       // 平均聚类系数
    connected_components: number;     // 连通分量数
    diameter: number;                 // 网络直径（最长最短路径）
  };
  
  // 角色中心性排名
  centrality_rankings: {
    character_id: string;
    degree_centrality: number;        // 度数中心性（直接关系数）
    betweenness_centrality: number;   // 中介中心性（桥梁角色）
    closeness_centrality: number;     // 接近中心性（信息传播速度）
    eigenvector_centrality: number;   // 特征向量中心性（连接重要角色）
    PageRank: number;                 // PageRank（综合影响力）
  }[];
  
  // 社群检测
  communities: {
    community_id: string;
    member_ids: string[];
    internal_density: number;
    external_connections: number;
    dominant_relation_types: RelationType[];
  }[];
  
  // 结构洞（桥梁机会）
  structural_holes: {
    character_id: string;
    between_groups: [string, string]; // 连接哪两个社群
    constraint: number;               // 约束度（越低越自由）
    opportunity_score: number;        // 桥梁机会评分
  }[];
}
```

#### 小团体检测

系统自动识别叙事中的"小团体"（cliques），这是权谋线和阵营线的重要参考：

```typescript
interface CliqueDetectionResult {
  clique_id: string;
  member_ids: string[];             // 小团体成员
  clique_type: "faction" | "family" | "conspiracy" | "social_circle";
  
  // 内聚度
  cohesion_score: number;           // [0, 1]，内部关系密度
  
  // 内部关系特征
  internal_relations: {
    type: RelationType;
    average_weight: number;
    count: number;
  }[];
  
  // 与外部的关系
  external_ties: {
    target_character_id: string;
    average_sentiment: number;      // 对外角色的平均情感
    tie_strength: number;
  }[];
  
  // 脆弱性分析
  vulnerability: {
    weakest_internal_link: string;  // 最脆弱的内部关系ID
    separation_risk: number;        // 分裂风险 [0, 1]
  };
}
```

### 7.2.5 关系演化的数学模型

#### 信任度变化公式

信任度的演化采用**贝叶斯更新 + 情感锚定**的混合模型：

```typescript
function updateTrust(
  currentTrust: number,           // 当前信任度 [-1, 1]
  eventTrustSignal: number,        // 事件传递的信任信号 [-1, 1]
  eventWeight: number,             // 事件权重 [0, 1]
  relationshipLength: number       // 关系存续长度（章节数）
): number {
  // 情感锚定强度：关系越长，越不容易被单次事件改变
  const anchoringStrength = Math.tanh(relationshipLength / 50); // 约50章达到半饱和
  
  // 有效更新权重
  const effectiveWeight = eventWeight * (1 - 0.5 * anchoringStrength);
  
  // 贝叶斯式更新：向信号方向移动，但受先验约束
  const updatedTrust = currentTrust + effectiveWeight * (eventTrustSignal - currentTrust);
  
  // 信任的非对称性：信任崩塌比建立快
  if (eventTrustSignal < 0 && currentTrust > 0) {
    // 负面事件对高信任关系冲击更大
    const asymmetryFactor = 1 + currentTrust * 0.5;
    return clamp(updatedTrust - effectiveWeight * asymmetryFactor * 0.1, -1, 1);
  }
  
  return clamp(updatedTrust, -1, 1);
}
```

#### 权力位差计算

权力位差是一个相对概念，基于多维度评估：

```typescript
interface PowerDimension {
  name: string;                    // 如 "military", "economic", "political", "magical"
  source_score: number;            // [0, 1]
  target_score: number;
  weight: number;                  // 此维度在当前世界中的权重
}

function calculatePowerDifferential(
  dimensions: PowerDimension[],
  context: PowerContext
): number {
  let weightedDiff = 0;
  let totalWeight = 0;
  
  for (const dim of dimensions) {
    // 根据叙事上下文调整维度权重
    const adjustedWeight = dim.weight * (context.dimensionModifiers[dim.name] || 1);
    weightedDiff += (dim.source_score - dim.target_score) * adjustedWeight;
    totalWeight += adjustedWeight;
  }
  
  const rawDiff = weightedDiff / totalWeight; // [-1, 1]
  
  // 权力的非线性效应：权力差距越大，低位者对高位者的感知越极端
  // 使用sigmoid曲线模拟
  return 2 / (1 + Math.exp(-3 * rawDiff)) - 1; // 映射回[-1, 1]
}
```

### 7.2.6 关系冲突检测

#### 三角关系检测

```typescript
interface TriadicRelation {
  node_a: string;
  node_b: string;
  node_c: string;
  
  // 三条边
  edges: [Relationship, Relationship, Relationship];
  
  // 三角类型（基于符号网络理论）
  triad_type: "balanced" | "unbalanced" | "vacuous";
  
  // 不平衡三角的叙事潜力
  tension_score: number;            // [0, 1]
  
  // 可能的冲突爆发场景
  potential_conflicts: {
    trigger_condition: string;
    predicted_chapter?: number;
    involved_storylines: string[];
  }[];
}

// 三角平衡性检测
function analyzeTriadBalance(triad: TriadicRelation): TriadBalanceResult {
  const [ab, bc, ac] = triad.edges;
  
  // 将关系简化为正（友好）/负（敌对）/零（中性）
  const signAB = Math.sign(ab.properties.affection + ab.properties.trust);
  const signBC = Math.sign(bc.properties.affection + bc.properties.trust);
  const signAC = Math.sign(ac.properties.affection + ac.properties.trust);
  
  // 社会网络理论：正*正*正 = 平衡，正*负*负 = 平衡，其余为不平衡
  const product = signAB * signBC * signAC;
  
  return {
    is_balanced: product >= 0,      // >=0 视为平衡（含零边）
    balance_type: product > 0 ? "strong_balanced" : 
                  product === 0 ? "vacuous" : "unbalanced",
    narrative_tension: product < 0 ? Math.abs(product) * calculateTension(triad) : 0
  };
}
```

#### 阵营对立面自动识别

```typescript
interface FactionAlignment {
  faction_id: string;
  member_ids: string[];
  
  // 阵营立场向量（多维）
  stance_vector: Map<string, number>;  // issue -> stance [-1, 1]
  
  // 与其他阵营的关系
  inter_faction_relations: {
    other_faction_id: string;
    average_sentiment: number;        // 成员间平均情感
    conflict_intensity: number;       // 冲突强度 [0, 1]
    alliance_probability: number;     // 结盟概率（基于立场相似度）
  }[];
  
  // 内部分裂风险
  internal_fracture_risk: number;     // [0, 1]
  fracture_lines: {                   // 分裂线
    issue_dimension: string;
    split_members_a: string[];
    split_members_b: string[];
    divergence_magnitude: number;
  }[];
}
```

### 7.2.7 关系网络可视化规格

前端展示需求定义如下：

```typescript
interface NetworkVisualizationSpec {
  // 布局算法
  layout: {
    primary: "force-directed",      // 主要：力导向布局
    secondary: "hierarchical",      // 备选：层级布局（适合严格等级设定）
    tertiary: "circular",           // 备选：圆形布局（适合对等关系展示）
  };
  
  // 节点样式
  node_style: {
    size_basis: "betweenness_centrality";  // 节点大小基于中介中心性
    color_basis: "community_membership";   // 颜色基于社群归属
    border_thickness_basis: "current_chapter_presence"; // 边框厚度基于当前章节出场
    
    // 特殊标记
    highlight_active: boolean;      // 高亮当前章节涉及的角色
    highlight_changed: boolean;     // 高亮最近章节关系发生变化的角色
    show_dormancy_indicator: boolean; // 显示休眠指示器（长时间未出场的角色）
  };
  
  // 边样式
  edge_style: {
    thickness_basis: "relationship_strength";  // 边粗基于关系强度
    color_basis: "relation_type";              // 颜色基于关系类型
    opacity_basis: "recency";                  // 透明度基于最近更新时间
    
    // 动态效果
    show_recent_change_animation: boolean; // 最近变化的关系边有流动动画
    show_tension_glow: boolean;            // 高潜在张力的边发光
  };
  
  // 交互
  interactions: {
    click_node: "focus_neighborhood";        // 点击节点：聚焦邻域
    double_click_node: "show_character_panel"; // 双击：打开角色面板
    drag_node: "manual_position";             // 拖拽：手动调整位置
    hover_edge: "show_relationship_tooltip";  // 悬停边：显示关系详情
    
    // 筛选
    filter_by_relation_type: RelationType[];
    filter_by_strength_range: [number, number];
    filter_by_community: string[];
  };
  
  // 时间轴回放
  time_playback: {
    enabled: boolean;
    step_unit: "chapter";           // 按章节步进
    show_evolution_trail: boolean;  // 显示关系演化轨迹
    animation_speed: number;        // 动画速度
  };
}
```

---

## 7.3 张力引擎（Tension Engine）

### 7.3.1 设计哲学

张力是叙事的脉搏。没有张力，百万字将成为无法承受的冗长。张力引擎的使命是：**让作者对叙事节奏拥有精确的感知和调控能力。**

核心原则：
- **张力不等于冲突**：安静场景中的信息张力可能比打斗场景更强
- **张力需要呼吸**：持续高潮等于没有高潮，张弛有度才是节奏
- **张力是预期的函数**：张力 = 读者对不确定性的感知 × 对结果的在意程度

### 7.3.2 张力分类体系

```typescript
enum TensionCategory {
  // 信息张力：读者知道某些信息但角色不知道，或反之
  INFORMATION = "information",
  INFORMATION_SUBTYPES = {
    DRAMATIC_IRONY: "dramatic_irony",       // 戏剧性反讽：读者知，角色不知
    MYSTERY: "mystery",                      // 谜团：角色和读者都不知
    REVELATION_PRESSURE: "revelation_pressure", // 秘密即将被揭开的压力
  },
  
  // 情感张力：角色间情感关系的悬而未决
  EMOTIONAL = "emotional",
  EMOTIONAL_SUBTYPES = {
    ROMANTIC_UNCERTAINTY: "romantic_uncertainty",   // 恋情走向不明
    LOYALTY_TEST: "loyalty_test",                   // 忠诚考验
    MORAL_DILEMMA: "moral_dilemma",                 // 道德困境
    GRIEF_SUSPENDED: "grief_suspended",             // 悬置的悲伤
  },
  
  // 冲突张力：明确的对抗或竞争
  CONFLICT = "conflict",
  CONFLICT_SUBTYPES = {
    PHYSICAL_CONFRONTATION: "physical_confrontation",   // 肢体/战斗冲突
    VERBAL_SPARRING: "verbal_sparring",                 // 言语交锋
    POWER_STRUGGLE: "power_struggle",                   // 权力斗争
    IDEOLOGICAL_CLASH: "ideological_clash",             // 理念冲突
  },
  
  // 悬念张力：对未知结果的期待
  SUSPENSE = "suspense",
  SUSPENSE_SUBTYPES = {
    LIFE_DEATH: "life_death",                   // 生死悬念
    CLOCK_TICKING: "clock_ticking",             // 时间压力
    UNKNOWN_THREAT: "unknown_threat",           // 未知威胁
    BETRAYAL_SUSPENSE: "betrayal_suspense",     // 背叛是否暴露
  },
  
  // 元张力：超越故事本身的张力
  META = "meta",
  META_SUBTYPES = {
    NARRATIVE_UNCERTAINTY: "narrative_uncertainty",     // 故事走向不确定
    GENRE_EXPECTATION: "genre_expectation",             // 类型期待的张力
    AUTHORIAL_PROMISE: "authorial_promise",             // 作者承诺的兑现压力
  },
}
```

#### 张力来源标注

每条张力记录都必须标注其来源，以便作者理解"为什么系统认为这里有张力"：

```typescript
interface TensionSource {
  category: TensionCategory;
  subtype: string;
  
  // 来源定位
  source_type: "scene" | "character_state" | "relationship" | "plot_arc" | "foreshadowing" | "reader_knowledge";
  source_id: string;              // 对应实体的ID
  
  // 来源描述（人类可读）
  description: string;            // 如 "角色A知道真相但被迫对角色B隐瞒"
  
  // 强度计算依据
  intensity_factors: {
    factor: string;               // 如 "秘密重要性"
    weight: number;               // 此因子的权重
    value: number;                // 此因子的值
  }[];
}
```

### 7.3.3 张力值量化模型

#### 单场景张力计算

```typescript
interface SceneTension {
  scene_id: string;
  chapter_number: number;
  
  // 各类型张力分量
  tension_components: Map<TensionCategory, number>;  // [0, 1]
  
  // 综合张力
  composite_tension: number;      // [0, 1]
  
  // 张力来源
  sources: TensionSource[];
  
  // 预期走向
  projected_trajectory: "rising" | "stable" | "falling";
  
  // 峰值标记
  is_peak: boolean;               // 是否为局部峰值
  peak_type?: "climax" | "turning_point" | "mini_climax" | "false_peak";
}

// 综合张力计算（加权聚合）
function calculateCompositeTension(
  components: Map<TensionCategory, number>,
  weights: Map<TensionCategory, number>
): number {
  let weightedSum = 0;
  let totalWeight = 0;
  
  for (const [category, value] of components) {
    const weight = weights.get(category) || 1.0;
    weightedSum += value * weight;
    totalWeight += weight;
  }
  
  const rawComposite = weightedSum / totalWeight;
  
  // 非线性增强：多个维度同时有张力时，综合张力超线性增长
  const activeDimensions = Array.from(components.values()).filter(v => v > 0.3).length;
  const synergyBonus = 1 + (activeDimensions - 1) * 0.15; // 每多一个活跃维度+15%
  
  return clamp(rawComposite * Math.min(synergyBonus, 1.5), 0, 1);
}
```

#### 章节张力曲线

```typescript
interface ChapterTensionProfile {
  chapter_number: number;
  total_word_count: number;
  
  // 场景级张力序列
  scene_tensions: SceneTension[];
  
  // 章节级聚合
  aggregate: {
    average_tension: number;        // 平均张力
    peak_tension: number;           // 峰值张力
    tension_variance: number;       // 张力方差（波动程度）
    tension_range: [number, number]; // 张力范围
    
    // 节奏特征
    rhythm_pattern: string;         // 如 "rise-plateau-fall-spike"
    has_relief_moment: boolean;     // 是否有释放时刻
    relief_quality?: number;        // 释放质量 [0, 1]
  };
  
  // 与前后章的衔接
  continuity: {
    tension_drop_from_previous: number;   // 相比前一章的张力变化
    cliffhanger_strength: number;          // 章末悬念强度 [0, 1]
    continuation_tension: number;          // 延续到下一章的张力
  };
}
```

### 7.3.4 张力节奏模板

系统内置多种经过验证的张力曲线模板，供作者参考或应用：

```typescript
interface TensionRhythmTemplate {
  id: string;
  name: string;                   // 如 "经典三幕高潮"
  description: string;
  
  // 模板适用的场景类型
  applicable_scene_types: SceneType[];
  
  // 张力曲线定义（归一化时间 -> 期望张力值）
  curve: {
    time_points: number[];        // [0, 1]，场景内归一化时间点
    tension_values: number[];     // 对应期望张力值
    tolerance_band: number;       // 允许偏差范围
  };
  
  // 节奏特征
  characteristics: {
    buildup_ratio: number;        // 蓄力段占比
    peak_ratio: number;           // 峰值段占比
    release_ratio: number;        // 释放段占比
    peak_count: number;           // 峰值数量
  };
  
  // 使用统计
  usage_stats: {
    times_applied: number;
    average_author_rating: number;
    common_genres: string[];
  };
}

// 内置模板库
const BUILTIN_TEMPLATES: TensionRhythmTemplate[] = [
  {
    id: "tpl-rising-action",
    name: "递进式上升",
    description: "张力持续上升，适合铺垫章节",
    curve: {
      time_points: [0, 0.2, 0.4, 0.6, 0.8, 1.0],
      tension_values: [0.2, 0.3, 0.45, 0.6, 0.75, 0.9],
      tolerance_band: 0.1
    },
    characteristics: {
      buildup_ratio: 0.8,
      peak_ratio: 0.2,
      release_ratio: 0,
      peak_count: 1
    }
  },
  {
    id: "tpl-peak-valley-peak",
    name: "峰谷峰",
    description: "高-低-高节奏，适合反转场景",
    curve: {
      time_points: [0, 0.15, 0.35, 0.5, 0.65, 0.85, 1.0],
      tension_values: [0.6, 0.85, 0.3, 0.2, 0.7, 0.9, 0.95],
      tolerance_band: 0.08
    },
    characteristics: {
      buildup_ratio: 0.2,
      peak_ratio: 0.5,
      release_ratio: 0.3,
      peak_count: 2
    }
  },
  {
    id: "tpl-sustained",
    name: "持续高压",
    description: "全程维持高张力，适合逃生/追逐场景",
    curve: {
      time_points: [0, 0.25, 0.5, 0.75, 1.0],
      tension_values: [0.8, 0.75, 0.85, 0.8, 0.9],
      tolerance_band: 0.15
    },
    characteristics: {
      buildup_ratio: 0.1,
      peak_ratio: 0.9,
      release_ratio: 0,
      peak_count: 0
    }
  },
  {
    id: "tpl-breather",
    name: "舒缓呼吸",
    description: "低张力日常，适合过渡和人物刻画",
    curve: {
      time_points: [0, 0.25, 0.5, 0.75, 1.0],
      tension_values: [0.15, 0.2, 0.1, 0.15, 0.25],
      tolerance_band: 0.1
    },
    characteristics: {
      buildup_ratio: 0.2,
      peak_ratio: 0.1,
      release_ratio: 0.7,
      peak_count: 0
    }
  },
  {
    id: "tpl-cliffhanger",
    name: "断章钩子",
    description: "结尾急剧拉升，驱动追更",
    curve: {
      time_points: [0, 0.3, 0.6, 0.8, 0.9, 0.95, 1.0],
      tension_values: [0.4, 0.35, 0.5, 0.7, 0.85, 0.95, 1.0],
      tolerance_band: 0.05
    },
    characteristics: {
      buildup_ratio: 0.7,
      peak_ratio: 0.3,
      release_ratio: 0,
      peak_count: 1
    }
  }
];
```

### 7.3.5 张力缺口检测

```typescript
interface TensionGapAlert {
  alert_id: string;
  alert_type: "prolonged_low_tension" | "missing_release" | "tension_monotony" | "cliffhanger_fatigue";
  
  // 定位
  chapter_range: [number, number];   // 问题章节范围
  affected_storylines: string[];
  
  // 问题描述
  description: string;
  severity: "info" | "warning" | "critical";
  
  // 量化数据
  metrics: {
    average_tension: number;        // 该段平均张力
    chapters_below_threshold: number; // 低于阈值的章节数
    consecutive_low_chapters: number; // 连续低张力章节数
    expected_vs_actual_variance: number; // 与期望模板的偏差
  };
  
  // 建议
  suggestions: {
    type: "inject_tension" | "add_release" | "vary_rhythm" | "create_cliffhanger";
    description: string;
    estimated_impact: number;       // 预计效果 [0, 1]
    example_approaches: string[];   // 示例方法
  }[];
}

// 缺口检测触发器
const TENSION_GAP_TRIGGERS = {
  prolonged_low_tension: {
    // 连续N章平均张力低于阈值
    consecutive_chapters: 8,
    threshold: 0.25,
    severity: "warning"
  },
  missing_release: {
    // 持续高张力但缺少释放（读者疲劳）
    consecutive_high_chapters: 5,
    high_threshold: 0.75,
    max_release_ratio: 0.1,
    severity: "critical"
  },
  tension_monotony: {
    // 张力变化过于单调
    min_variance: 0.05,
    window_size: 10,
    severity: "warning"
  },
  cliffhanger_fatigue: {
    // 断章钩子过度使用（读者产生抗性）
    recent_cliffhangers: 4,
    window_size: 10,
    severity: "warning"
  }
};
```

### 7.3.6 张力与读者预期的关系模型

张力与读者预期是叙事的两大核心变量，它们的交互模型如下：

```typescript
interface TensionExpectationModel {
  // 核心公式
  // 叙事吸引力 = f(张力, 预期符合度, 意外度)
  // narrative_pull = tension * (expected_payoff_satisfaction + surprise_bonus)
  
  // 张力对预期的影响
  tension_to_expectation: {
    // 高张力会提高读者的预期高度
    expectation_escalation: number;   // 预期每章的提升系数
    // 如果高张力持续不释放，预期会变成焦虑/疲劳
    fatigue_threshold: number;        // 疲劳阈值（章节数）
    // 张力释放后的预期重置
    post_release_reset_factor: number; // 释放后预期重置系数
  };
  
  // 预期对张力的影响
  expectation_to_tension: {
    // 满足高预期会产生满意度（正面反馈循环）
    satisfaction_boost: number;
    // 违背预期但结果更好：惊喜感
    positive_surprise_multiplier: number;
    // 违背预期且结果更差：失望感
    negative_disappointment_multiplier: number;
    // 反复违背预期：信任度下降
    trust_erosion_rate: number;
  };
  
  // 当前状态
  current_state: {
    accumulated_tension: number;      // 累积张力（未释放部分）
    reader_expectation_height: number; // 读者当前预期高度 [0, 1]
    trust_reserve: number;            // 读者信任储备 [0, 1]
    fatigue_level: number;            // 疲劳度 [0, 1]
  };
}
```

### 7.3.7 张力峰值自动标记与叙事建议

当系统检测到张力峰值时，会自动标记并提供叙事分析：

```typescript
interface TensionPeakAnnotation {
  peak_id: string;
  scene_id: string;
  chapter_number: number;
  
  // 峰值特征
  peak_characteristics: {
    tension_value: number;
    relative_to_chapter: number;    // 相对于章节其他场景的张力比值
    relative_to_recent: number;     // 相对于最近20章峰值的位置
    category_breakdown: Map<TensionCategory, number>;
  };
  
  // 自动分类
  peak_classification: {
    type: "climax" | "mini_climax" | "turning_point" | "false_peak" | "unresolved_spike";
    confidence: number;
    reasoning: string;
  };
  
  // 叙事建议
  narrative_suggestions: {
    // 如果是高潮
    climax_guidance?: {
      recommended_buildup_length: number;      // 建议前铺垫长度
      emotional_payoff_opportunities: string[]; // 情感回报机会点
      aftermath_recommendation: string;         // 余波处理建议
    };
    
    // 如果是转折点
    turning_point_guidance?: {
      setup_evaluation: string;               // 铺垫充分性评估
      foreshadowing_links: string[];          // 可关联的伏笔
      consequence_branches: ConsequenceBranch[]; // 后果分支推演
    };
    
    // 如果是未解决的突兀峰值
    unresolved_guidance?: {
      concern: string;                        // 为什么这可能有问题
      smoothing_suggestions: string[];        // 平滑化建议
    };
  };
  
  // 与伏笔/先例的关联
  linked_foreshadowings: string[];
  linked_precedents: string[];
}
```


---

## 7.4 主题符号引擎（Thematic Symbol Engine）

### 7.4.1 设计哲学

主题是叙事的灵魂，符号是主题的肉身。在百万字级作品中，主题不是被"说出"的，而是通过反复出现的符号、意象、情境和选择在读者无意识中累积而成的。主题符号引擎的使命是：**让作者对自己正在表达的主题拥有元认知，确保主题的深度和一致性。**

核心原则：
- **主题不是说教**：主题是角色选择的总和，不是旁白中的格言
- **符号即重复**：符号的力量来自在变化中的重复
- **对立产生深度**：主题的张力来自对立面的博弈

### 7.4.2 主题的定义与管理

#### 主题本体（Theme）

```typescript
interface Theme {
  id: string;
  display_name: string;             // 如 "权力的腐蚀"
  short_description: string;        // 一句话描述
  
  // 主题层级
  level: "core" | "secondary" | "tertiary";
  
  // 主题对立面
  antithesis?: string;              // 对立主题ID，如 "权力的工具性"
  
  // 主题维度（一个主题可沿多个维度展开）
  dimensions: ThemeDimension[];
  
  // 叙事表达模式
  expression_modes: ThemeExpressionMode[];
  
  // 演化目标
  evolution_target: {
    intended_arc: "deepening" | "complication" | "reversal" | "synthesis";
    target_depth: number;           // 目标深度 [1, 10]
    current_depth_estimate: number; // 当前估计深度
  };
  
  // 关联
  related_themes: string[];         // 关联主题ID
  primary_storylines: string[];     // 主要承载此主题的故事线
  
  // 状态
  status: "developing" | "mature" | "resolved" | "abandoned";
  
  created_at: timestamp;
  updated_at: timestamp;
}

interface ThemeDimension {
  name: string;                     // 如 "个人层面", "社会层面", "哲学层面"
  description: string;
  
  // 此维度的展开程度
  development_level: number;        // [0, 1]
  
  // 承载此维度的角色
  carrier_characters: string[];
  
  // 关键场景
  key_scenes: string[];
}

interface ThemeExpressionMode {
  mode_type: "character_choice" | "symbolic_imagery" | "dialogue" | 
             "narrative_structure" | "recurring_motif" | "contrast" | "irony";
  
  description: string;              // 如 "通过主角面对权力诱惑时的选择"
  
  // 此表达模式的使用频率
  usage_frequency: number;          // 每百章出现次数
  
  // 效果评估
  effectiveness_score: number;      // [0, 1]
}
```

#### 主题层级体系

```typescript
interface ThemeHierarchy {
  // 核心主题（1-3个）
  core_themes: Theme[];             // 贯穿全文的核心命题
  
  // 次要主题（3-8个）
  secondary_themes: Theme[];        // 重要但非核心的主题
  
  // 三级主题（不定数量）
  tertiary_themes: Theme[];         // 局部性、探索性的主题
  
  // 主题间关系
  theme_relations: ThemeRelation[];
}

interface ThemeRelation {
  source_theme_id: string;
  target_theme_id: string;
  relation_type: "antithesis" | "complement" | "cause_effect" | "parallel" | "nested";
  
  // 关系强度
  strength: number;                 // [0, 1]
  
  // 关系描述
  description: string;
  
  // 在叙事中共同出现的频率
  co_occurrence_frequency: number;
}
```

### 7.4.3 符号（Motif）的追踪

#### 符号本体（Motif）

```typescript
interface Motif {
  id: string;
  display_name: string;             // 如 "破碎的镜子"
  motif_type: MotifType;
  
  // 符号描述
  description: string;              // 详细描述此符号
  
  // 关联主题
  associated_themes: string[];      // 关联的主题ID
  
  // 出现记录
  occurrences: MotifOccurrence[];
  
  // 累积统计
  statistics: {
    total_occurrences: number;
    first_chapter: number;
    last_chapter: number;
    chapter_span: number;           // 跨度章节数
    average_interval: number;       // 平均出现间隔
    
    // 演化指标
    frequency_trend: "increasing" | "stable" | "decreasing";
    meaning_complexity_trend: "deepening" | "stable" | "simplifying";
  };
  
  // 符号语义演化
  semantic_evolution: MotifSemanticStage[];
}

enum MotifType {
  // 视觉意象
  OBJECT = "object",                 // 物体（如：破碎的镜子、红色的花）
  SETTING_ELEMENT = "setting_element", // 场景元素（如：雨夜的街道、悬崖）
  COLOR = "color",                   // 色彩（如：血色、苍白）
  LIGHTING = "lighting",             // 光线（如：黄昏、阴影）
  
  // 动作/行为
  ACTION = "action",                 // 重复动作（如：握拳、回头望）
  RITUAL = "ritual",                 // 仪式（如：每日的祈祷、特定问候）
  
  // 语言
  PHRASE = "phrase",                 // 反复出现的短语
  DIALOGUE_PATTERN = "dialogue_pattern", // 对话模式（如：某人总在告别时说同样的话）
  NARRATIVE_VOICE = "narrative_voice",   // 叙事声音特征
  
  // 结构
  STRUCTURAL_PATTERN = "structural_pattern", // 结构模式（如：每十章一次的倒叙）
  CHAPTER_RHYTHM = "chapter_rhythm",         // 章节节奏特征
  
  // 角色相关
  CHARACTER_TRAIT = "character_trait",       // 角色特征（如：某人总在紧张时摸戒指）
  COSTUME = "costume",               // 服饰变化
  
  // 听觉/其他感官
  SOUND = "sound",                   // 声音（如：钟声、脚步声）
  SMELL = "smell",                   // 气味（如：雨后的土腥味）
  TEXTURE = "texture",               // 质感（如：冰冷的金属）
}

interface MotifOccurrence {
  id: string;
  motif_id: string;
  chapter_number: number;
  scene_id: string;
  
  // 出现方式
  manifestation: string;            // 具体表现文本
  manifestation_type: "explicit" | "implicit" | "ironic"; // 显式/隐式/反讽
  
  // 上下文
  narrative_context: string;        // 叙事上下文
  associated_characters: string[];  // 相关角色
  associated_storyline: string;     // 所属故事线
  
  // 语义深度（此出现的意义层次）
  semantic_depth: number;           // [1, 5]，1=纯装饰，5=核心象征
  
  // 与主题的直接关联度
  theme_relevance: number;          // [0, 1]
}

interface MotifSemanticStage {
  stage_order: number;
  chapter_range: [number, number];
  
  // 此阶段的语义
  primary_meaning: string;          // 主要含义
  secondary_meanings: string[];     // 次要含义
  
  // 语义深度
  depth_level: number;              // [1, 5]
  
  // 触发语义转变的关键事件
  transition_trigger?: string;      // 描述触发转变的事件
}
```

#### 符号自动发现

系统通过以下模式自动发现潜在的符号：

```typescript
interface MotifDiscoveryRule {
  rule_id: string;
  rule_type: "frequency" | "pattern" | "contrast" | "authorial_emphasis";
  
  // 检测条件
  conditions: {
    min_occurrences: number;        // 最少出现次数
    min_chapter_span: number;       // 最少跨度章节数
    max_average_interval: number;   // 最大平均间隔
    min_narrative_significance: number; // 最小叙事显著性
  };
  
  // 检测方法
  detection_method: string;         // 如 "NLP共现分析", "意象聚类"
  
  // 置信度
  confidence_threshold: number;
}

// 符号发现触发规则
const MOTIF_DISCOVERY_RULES: MotifDiscoveryRule[] = [
  {
    rule_id: "rule-freq-3",
    rule_type: "frequency",
    conditions: {
      min_occurrences: 3,
      min_chapter_span: 20,
      max_average_interval: 50,
      min_narrative_significance: 0.3
    },
    detection_method: "高频意象检测：识别在文本中反复出现的名词+形容词组合",
    confidence_threshold: 0.6
  },
  {
    rule_id: "rule-pattern-struct",
    rule_type: "pattern",
    conditions: {
      min_occurrences: 2,
      min_chapter_span: 30,
      max_average_interval: 100,
      min_narrative_significance: 0.5
    },
    detection_method: "结构模式检测：识别重复出现的叙事结构或场景编排模式",
    confidence_threshold: 0.7
  },
  {
    rule_id: "rule-contrast",
    rule_type: "contrast",
    conditions: {
      min_occurrences: 2,
      min_chapter_span: 10,
      max_average_interval: 100,
      min_narrative_significance: 0.4
    },
    detection_method: "对比检测：识别作者刻意安排的对照/对比模式",
    confidence_threshold: 0.65
  },
  {
    rule_id: "rule-emphasis",
    rule_type: "authorial_emphasis",
    conditions: {
      min_occurrences: 2,
      min_chapter_span: 5,
      max_average_interval: 50,
      min_narrative_significance: 0.6
    },
    detection_method: "作者强调检测：通过异常详尽的描写或异常位置（章节首尾）识别被强调的元素",
    confidence_threshold: 0.75
  }
];
```

### 7.4.4 主题-符号映射关系

```typescript
interface ThemeMotifMapping {
  mapping_id: string;
  theme_id: string;
  motif_id: string;
  
  // 映射类型
  mapping_type: "direct" | "metaphorical" | "ironic" | "structural";
  // direct: 符号直接代表主题（如：破碎的镜子 = 自我认知的瓦解）
  // metaphorical: 隐喻关系（如：枯萎的花 = 逝去的青春）
  // ironic: 反讽关系（如：喜庆的红灯笼 = 虚假繁荣）
  // structural: 结构映射（如：倒叙结构 = 记忆的主题）
  
  // 映射强度
  strength: number;                 // [0, 1]
  
  // 映射描述
  description: string;              // 如 "破碎的镜子作为权力腐蚀的隐喻"
  
  // 映射的历史演化
  evolution_history: {
    chapter: number;
    strength_change: number;        // 强度变化
    context: string;
  }[];
}
```

### 7.4.5 主题深化评估

主题深化评估回答的核心问题：**主题是否随着故事推进而变得更加深刻和复杂？**

```typescript
interface ThemeDepthAssessment {
  theme_id: string;
  assessed_at_chapter: number;
  
  // 深度时间序列
  depth_timeline: {
    chapter: number;
    depth_score: number;            // [1, 10]
    depth_dimensions: {
      intellectual_complexity: number;  // 智识复杂度：主题涉及的思辨层次
      emotional_resonance: number;      // 情感共鸣度
      moral_ambiguity: number;          // 道德模糊度（非黑即白=低，灰色地带=高）
      interconnection_density: number;  // 与其他主题/线的交织密度
    };
  }[];
  
  // 深化轨迹
  deepening_trajectory: {
    slope: number;                    // 深度变化斜率
    acceleration: number;             // 加速度（二阶导数）
    pattern: "steady" | "stepwise" | "plateau_spike" | "oscillating";
  };
  
  // 与目标对比
  target_gap: number;                 // 当前深度与目标深度的差距
  on_track: boolean;                  // 是否按预期轨迹发展
  
  // 谏官评估
  guardian_assessment: {
    risk_level: "none" | "low" | "medium" | "high";
    concerns: string[];               // 如 "主题深化速度过慢"
    opportunities: string[];          // 如 "角色X的抉择可深化主题"
  };
}
```

#### 深度评分算法

```typescript
function calculateThemeDepth(
  theme: Theme,
  chapterRange: [number, number]
): ThemeDepthScore {
  const occurrences = getThemeOccurrences(theme.id, chapterRange);
  
  // 1. 智识复杂度：主题表达的层次数
  const intellectualComplexity = calculateIntellectualComplexity(occurrences);
  // 评估标准：简单对立(1-3) -> 多重矛盾(4-6) -> 存在性追问(7-10)
  
  // 2. 情感共鸣度：读者的情感卷入程度
  const emotionalResonance = calculateEmotionalResonance(occurrences);
  // 评估标准：概念性提及(1-3) -> 角色共情(4-6) -> 读者自我投射(7-10)
  
  // 3. 道德模糊度：主题的灰色地带程度
  const moralAmbiguity = calculateMoralAmbiguity(occurrences);
  // 评估标准：明确价值判断(1-3) -> 多方有理(4-6) -> 无解困境(7-10)
  
  // 4. 交织密度：与其他叙事要素的关联度
  const interconnectionDensity = calculateInterconnectionDensity(theme, chapterRange);
  // 评估标准：孤立存在(1-3) -> 部分关联(4-6) -> 全面交织(7-10)
  
  // 综合深度
  const depthScore = (
    intellectualComplexity * 0.25 +
    emotionalResonance * 0.3 +
    moralAmbiguity * 0.25 +
    interconnectionDensity * 0.2
  );
  
  return {
    total_depth: depthScore,
    dimensions: {
      intellectual_complexity: intellectualComplexity,
      emotional_resonance: emotionalResonance,
      moral_ambiguity: moralAmbiguity,
      interconnection_density: interconnectionDensity
    }
  };
}
```

### 7.4.6 主题一致性检测

```typescript
interface ThemeConsistencyReport {
  generated_at: timestamp;
  chapter_range: [number, number];
  
  // 一致性评估
  consistency_score: number;          // [0, 100]
  
  // 检测到的冲突
  conflicts: ThemeConflict[];
  
  // 各主题的一致性
  theme_consistencies: {
    theme_id: string;
    internal_consistency: number;     // 内部一致性 [0, 1]
    narrative_alignment: number;      // 与叙事行动的一致性 [0, 1]
    violation_count: number;
  }[];
}

interface ThemeConflict {
  conflict_id: string;
  conflict_type: "internal_contradiction" | "narrative_misalignment" | "thematic_drift";
  
  // 涉及的主题
  involved_themes: string[];
  
  // 冲突定位
  location: {
    chapter: number;
    scene_id: string;
    description: string;
  };
  
  // 冲突描述
  description: string;                // 如 "角色A的选择与'自由意志'主题相矛盾"
  
  // 严重程度
  severity: "minor" | "moderate" | "major" | "critical";
  
  // 可能的解释
  possible_explanations: string[];    // 如 "可能是作者刻意的反讽"
  
  // 建议
  suggestions: {
    type: "adjust_narrative" | "reframe_theme" | "acknowledge_tension";
    description: string;
  }[];
}
```

**检测规则示例**：

1. **内部矛盾检测**：如果主题T在某场景中表现为"牺牲是崇高的"，在另一场景中表现为"牺牲是愚蠢的"，且两次表现都非反讽语境，则标记为内部矛盾。

2. **叙事错位检测**：如果核心主题是"正义终将胜利"，但主角通过明显不正义的手段获胜且未受质疑，则标记为叙事错位。

3. **主题漂移检测**：如果主题T在前200章的平均语义向量为V1，在最近50章的平均语义向量为V2，且cosine_similarity(V1, V2) < 0.5，则标记为主题漂移。

### 7.4.7 主题矩阵

主题矩阵展示不同角色和故事线与各主题的关联度，是主题分布的全景图：

```typescript
interface ThematicMatrix {
  // 维度
  themes: Theme[];                  // 列：主题
  rows: ThematicMatrixRow[];        // 行：角色或故事线
  
  // 矩阵值
  cells: Map<string, ThematicCell>;  // key: "row_id:theme_id"
  
  // 聚合统计
  aggregates: {
    theme_coverage: Map<string, number>;    // 每个主题被多少行承载
    row_thematic_load: Map<string, number>;  // 每行承载多少主题
    thematic_density: number;               // 整体主题密度
  };
  
  // 视觉化建议
  visualization: {
    recommended_color_scheme: string;
    clustering_suggestion: string;    // 如 "按势力聚类可揭示阵营主题对立"
  };
}

interface ThematicMatrixRow {
  row_id: string;
  row_type: "character" | "storyline" | "faction";
  display_name: string;
}

interface ThematicCell {
  row_id: string;
  theme_id: string;
  
  // 关联强度
  relevance_score: number;            // [0, 1]
  
  // 关联方式
  association_modes: {
    mode: string;                     // 如 "主动选择", "被动承受", "象征承载"
    strength: number;
    evidence_count: number;           // 支持证据数
  }[];
  
  // 角色对此主题的认知状态（仅角色行）
  character_awareness?: "unaware" | "struggling" | "embracing" | "rejecting" | "transcended";
  
  // 主题在此行中的演化阶段
  evolution_stage: "introduction" | "exploration" | "crisis" | "resolution";
}
```

---

## 7.5 读者预期演化系统（Reader Expectation Evolution System）

### 7.5.1 设计哲学

读者预期是叙事中最微妙也最关键的变量。网文的"爽感"很大程度上来源于预期管理——在"猜到了"和"没想到"之间找到最佳平衡点。读者预期演化系统的使命是：**让作者拥有读者视角的元认知，精确管理"满足-惊喜-满足"的循环。**

核心原则：
- **预期基于模式**：读者预期来自套路识别和前因推断
- **信任是货币**：反复违背预期会耗尽读者的信任储备
- **满足是责任**：核心预期必须被满足，否则读者感到被背叛
- **惊喜是礼物**：非核心预期的打破能带来愉悦的意外

### 7.5.2 读者预期模型

#### 预期树（Expectation Tree）

预期树是基于前文发展和套路库构建的读者可能预期集合：

```typescript
interface ExpectationTree {
  tree_id: string;
  rooted_at_chapter: number;        // 此树基于哪一章建立
  
  // 根节点
  root: ExpectationNode;
  
  // 树元数据
  metadata: {
    generation_basis: string[];     // 生成依据：如 ["前文发展", "套路匹配", "角色动机"]
    confidence_level: number;       // 整体置信度 [0, 1]
    relevance_to_current: number;   // 与当前叙事的关联度
  };
}

interface ExpectationNode {
  node_id: string;
  parent_id?: string;
  
  // 预期内容
  expectation: {
    type: "plot_development" | "character_action" | "relationship_change" | 
          "revelation" | "emotional_payoff" | "conflict_resolution";
    description: string;            // 如 "主角将在下一章发现真相"
    expected_probability: number;   // [0, 1]，读者认为此事发生的概率
  };
  
  // 分支
  children: ExpectationNode[];      // 此预期之后的进一步分支
  
  // 节点属性
  attributes: {
    branching_probability: number;  // [0, 1]，此分支的发生概率评估
    emotional_valence: number;      // [-1, 1]，正面/负面预期
    strength: number;               // [0, 1]，预期的强度（确定性）
    source_type: "trope" | "foreshadowing" | "character_logic" | "genre_convention" | "causal_inference";
    source_reference?: string;      // 来源引用
  };
  
  // 与实际的对比（在后续章节中填充）
  actual_outcome?: {
    fulfilled: boolean;             // 是否被满足
    deviation_degree: number;       // [0, 1]，偏离程度
    reader_satisfaction_estimate: number; // 预计读者满意度
  };
}
```

#### 套路库（Trope Library）

套路库是预期模型的核心知识基础：

```typescript
interface Trope {
  id: string;
  name: string;                     // 如 "扮猪吃老虎"
  description: string;              // 详细描述
  
  // 分类
  categories: TropeCategory[];
  genres: string[];                 // 适用的类型/流派
  
  // 触发条件
  trigger_conditions: {
    narrative_setup: string[];      // 叙事设置条件
    character_archetypes: string[]; // 涉及的角色原型
    emotional_prerequisites: string[]; // 情感先决条件
  };
  
  // 典型发展路径
  typical_progression: TropeStage[];
  
  // 变体
  variants: {
    name: string;
    description: string;
    deviation_from_standard: number; // [0, 1]
  }[];
  
  // 读者预期强度
  reader_expectation_strength: number; // [0, 1]，此套路的读者预期强度
  
  // 满足方式
  payoff_types: {
    type: "direct" | "subverted" | "double_subverted" | "averted";
    description: string;
    satisfaction_curve: number[];   // 不同处理方式对应的满意度
  }[];
}

interface TropeStage {
  stage_order: number;
  name: string;                     // 如 "铺垫期", "爆发期", "收获期"
  description: string;
  typical_duration: [number, number]; // 章节数范围
  reader_emotional_state: string;   // 读者的典型情绪状态
}
```

#### 基于前文的发展推演

```typescript
interface CausalExpectationInference {
  inference_id: string;
  base_chapter: number;
  
  // 推演前提
  premises: {
    character_states: Map<string, CharacterState>; // 角色状态
    active_plot_threads: string[];   // 活跃的情节线
    unresolved_tensions: string[];   // 未解决的张力
  };
  
  // 推演结论
  conclusions: {
    expected_event: string;
    probability: number;
    confidence: number;
    timeline_estimate: [number, number]; // 预计发生章节范围
    
    // 推演链
    inference_chain: string[];       // 推理步骤
  }[];
  
  // 推演方法
  inference_method: "deductive" | "analogical" | "probabilistic";
}
```

### 7.5.3 预期违背的检测和评估

#### 预期-实际对比

```typescript
interface ExpectationViolation {
  violation_id: string;
  detected_at_chapter: number;
  
  // 被违背的预期
  violated_expectation: {
    expectation_id: string;
    description: string;
    original_probability: number;
    source_type: string;
  };
  
  // 实际发生
  actual_outcome: {
    description: string;
    deviation_type: "reversal" | "delay" | "escalation" | "omission" | "substitution";
  };
  
  // 违背评估
  assessment: {
    // 违背力度
    violation_strength: number;       // [0, 1]
    
    // 是否为"好的意外"
    is_positive_surprise: boolean;
    surprise_quality: number;         // [0, 1]
    
    // 读者反应预测
    predicted_reader_reaction: "delighted" | "satisfied" | "neutral" | "confused" | "disappointed" | "betrayed";
    reaction_confidence: number;
    
    // 风险评估
    trust_cost: number;               // [0, 1]，此违背对读者信任储备的消耗
    payoff_potential: number;         // [0, 1]，后续回报潜力
  };
  
  // 谏官建议
  guardian_advice: {
    concern_level: "none" | "low" | "medium" | "high";
    advice: string;
    mitigation_strategies?: string[];
  };
}
```

#### 违背质量评估框架

不是所有预期违背都是好的。系统采用以下框架评估：

```typescript
function assessViolationQuality(
  violation: ExpectationViolation,
  context: NarrativeContext
): ViolationQuality {
  const factors = {
    // 1. 铺垫充分度：好的意外应该有伏笔
    foreshadowing_strength: calculateForeshadowingStrength(violation),
    
    // 2. 回顾合理性：发生后回顾应觉得合理
    retrospective_plausibility: assessRetrospectivePlausibility(violation),
    
    // 3. 情感影响：是否产生了更强的情感效果
    emotional_impact: estimateEmotionalImpact(violation),
    
    // 4. 叙事价值：是否推动了更有价值的叙事方向
    narrative_value: assessNarrativeValue(violation),
    
    // 5. 信任成本：对读者信任的消耗
    trust_cost: calculateTrustCost(violation, context.trust_reserve),
    
    // 6. 回收承诺：是否建立了更有趣的预期
    new_expectation_potential: assessNewExpectationPotential(violation)
  };
  
  // 综合质量评分
  const qualityScore = (
    factors.foreshadowing_strength * 0.2 +
    factors.retrospective_plausibility * 0.2 +
    factors.emotional_impact * 0.2 +
    factors.narrative_value * 0.15 +
    (1 - factors.trust_cost) * 0.15 +
    factors.new_expectation_potential * 0.1
  );
  
  return {
    overall_quality: qualityScore,
    factors,
    verdict: qualityScore > 0.7 ? "excellent_surprise" :
             qualityScore > 0.5 ? "good_twist" :
             qualityScore > 0.3 ? "risky_but_interesting" :
             "potentially_harmful"
  };
}
```

### 7.5.4 预期管理策略

#### 满足 vs 打破的决策框架

```typescript
interface ExpectationManagementDecision {
  decision_id: string;
  context_chapter: number;
  
  // 当前面临的预期
  active_expectations: {
    expectation: ExpectationNode;
    fulfill_cost: number;           // 满足此预期的叙事成本
    break_cost: number;             // 打破此预期的信任成本
    fulfillment_satisfaction: number; // 满足带来的满意度
    break_surprise_value: number;   // 打破带来的惊喜值
  }[];
  
  // 策略建议
  recommended_strategy: ExpectationStrategy;
  
  // 策略理由
  strategy_rationale: string;
  
  // 具体操作建议
  implementation: {
    primary_action: string;
    foreshadowing_needed?: string[];  // 如需转折，需要哪些铺垫
    payoff_setup?: string;            // 如何建立新的预期
  };
}

interface ExpectationStrategy {
  type: "fulfill" | "subvert" | "exceed" | "delay" | "redirect" | "compound";
  
  // 策略详情
  description: string;
  
  // 预期效果
  expected_effect: {
    immediate_satisfaction: number;   // 即时满意度
    trust_impact: number;             // 信任储备影响
    anticipation_building: number;    // 后续期待感建设
  };
}

// 策略类型说明：
// fulfill: 直接满足预期（兑现承诺）
// subvert: 反转型打破（好的意外，需充分铺垫）
// exceed: 超越预期（给得比读者期望更多）
// delay: 延迟满足（吊胃口，但需确保最终值得等待）
// redirect: 转移预期（读者想要A，给B但B更好）
// compound: 复合满足（满足表层预期的同时设置深层转折）
```

#### 信任储备管理

```typescript
interface ReaderTrustReserve {
  // 信任储备是预期管理的核心约束
  current_reserve: number;            // [0, 1]
  
  // 收支记录
  transactions: TrustTransaction[];
  
  // 阈值
  thresholds: {
    critical_low: 0.2;                // 低于此值，读者可能弃书
    caution_zone: 0.4;                // 低于此值，谏官发出警告
    healthy: 0.6;                     // 健康水平
    abundant: 0.8;                    // 充裕，可承受大胆操作
  };
  
  // 影响因素
  influencing_factors: {
    promise_fulfillment_rate: number; // 承诺兑现率
    unexpected_quality_average: number; // 意外的平均质量
    narrative_consistency: number;    // 叙事一致性
    character_integrity: number;      // 角色行为一致性
  };
}

interface TrustTransaction {
  id: string;
  chapter: number;
  
  // 变化量（正数=存入，负数=消耗）
  amount: number;
  
  // 变化原因
  reason: string;
  transaction_type: 
    | "promise_fulfilled"      // 兑现承诺（+）
    | "promise_broken"         // 违背承诺（--）
    | "pleasant_surprise"      // 愉快意外（+）
    | "unpleasant_surprise"    // 不愉快意外（-）
    | "satisfying_payoff"      // 满意回报（+）
    | "frustrating_delay"      // 令人沮丧的延迟（-）
    | "quality_consistency"    // 质量稳定（+）
    | "quality_drop";          // 质量下滑（-）
}
```

### 7.5.5 读者情绪模拟

#### 情绪曲线模型

```typescript
interface ReaderEmotionSimulation {
  simulation_id: string;
  chapter_number: number;
  
  // 基础情绪维度（基于PAD模型：愉悦度-唤醒度-支配度）
  pad_state: {
    pleasure: number;                 // [-1, 1]，愉悦度
    arousal: number;                  // [0, 1]，唤醒度/兴奋度
    dominance: number;                // [-1, 1]，支配感（掌控/无力）
  };
  
  // 细分情绪
  discrete_emotions: {
    emotion: ReaderEmotion;
    intensity: number;                // [0, 1]
    trigger: string;                  // 触发源
  }[];
  
  // 时间维度
  temporal_dynamics: {
    anticipation: number;             // [0, 1]，期待感
    engagement: number;               // [0, 1]，投入度
    immersion: number;                // [0, 1]，沉浸度
    
    // 追更特有指标
    chapter_end_urgency: number;      // [0, 1]，章末紧迫感
    next_chapter_desire: number;      // [0, 1]，想看下章的欲望
  };
}

enum ReaderEmotion {
  // 积极情绪
  JOY = "joy",
  EXCITEMENT = "excitement",
  SATISFACTION = "satisfaction",
  RELIEF = "relief",
  HOPE = "hope",
  ADMIRATION = "admiration",
  AMUSEMENT = "amusement",
  
  // 消极情绪（叙事中有价值的）
  TENSION = "tension",
  ANXIETY = "anxiety",
  SADNESS = "sadness",
  ANGER = "anger",
  FEAR = "fear",
  FRUSTRATION = "frustration",
  SYMPATHY = "sympathy",
  
  // 元叙事情绪
  CURIOSITY = "curiosity",
  SURPRISE = "surprise",
  CONFUSION = "confusion",
  SUSPICION = "suspicion",
  NOSTALGIA = "nostalgia",
}
```

#### 情绪驱动因子

```typescript
interface EmotionDriver {
  driver_id: string;
  driver_type: EmotionDriverType;
  
  // 影响的情绪
  affected_emotions: {
    emotion: ReaderEmotion;
    impact_weight: number;            // 此驱动对该情绪的影响权重
    direction: "increase" | "decrease";
  }[];
  
  // 当前强度
  current_intensity: number;          // [0, 1]
  
  // 衰减参数
  decay: {
    half_life_chapters: number;       // 半衰期（章节数）
    decay_pattern: "exponential" | "linear" | "step";
  };
}

enum EmotionDriverType {
  // 悬念驱动
  UNRESOLVED_MYSTERY = "unresolved_mystery",
  PENDING_CONFRONTATION = "pending_confrontation",
  THREAT_LOOMING = "threat_looming",
  
  // 关系驱动
  ROMANTIC_TENSION = "romantic_tension",
  FRIENDSHIP_TEST = "friendship_test",
  BETRAYAL_RISK = "betrayal_risk",
  
  // 目标驱动
  GOAL_PROGRESS = "goal_progress",
  OBSTACLE_ENCOUNTERED = "obstacle_encountered",
  VICTORY_IMMINENT = "victory_imminent",
  
  // 认同驱动
  CHARACTER_SYMPATHY = "character_sympathy",
  UNDERDOG_CHEER = "underdog_cheer",
  CHARACTER_GROWTH = "character_growth",
  
  // 审美驱动
  WORLDBUILDING_WONDER = "worldbuilding_wonder",
  PROSE_APPRECIATION = "prose_appreciation",
  PLOT_CRAFT_ADMIRATION = "plot_craft_admiration",
}
```

### 7.5.6 追更欲的量化模型

追更欲（"下一章效应"）是网文最核心的指标之一。

```typescript
interface CliffhangerDesireModel {
  // 追更欲 = f(悬念强度, 情绪峰值, 预期回报, 节奏模式, 信任储备)
  
  // 核心公式
  // desire = (suspense_intensity * 0.3 + emotional_peak * 0.25 + expected_payoff * 0.25 + rhythm_momentum * 0.2) * trust_multiplier
  
  // 各分量
  components: {
    suspense_intensity: number;       // [0, 1]，未解决悬念的强度
    emotional_peak: number;           // [0, 1]，本章情绪峰值
    expected_payoff: number;          // [0, 1]，读者预期的下章回报
    rhythm_momentum: number;          // [0, 1]，节奏动量（连续多章的上升趋势）
  };
  
  // 信任调节
  trust_multiplier: number;           // [0.5, 1.5]，信任储备的调节作用
  
  // 追更欲综合值
  composite_desire: number;           // [0, 1]
  
  // 追更欲分类
  desire_category: "urgent" | "strong" | "moderate" | "mild" | "weak";
  
  // 构成追更欲的具体因子
  contributing_factors: {
    factor: string;
    contribution_score: number;
  }[];
}
```

#### 追更欲驱动因子详解

```typescript
interface NextChapterDriveFactor {
  factor_id: string;
  factor_name: string;
  
  // 此因子对追更欲的贡献
  base_contribution: number;          // [0, 1]
  
  // 调节参数
  modifiers: {
    // 新鲜感调节：同类钩子反复使用，效果递减
    novelty_modifier: number;         // [0.3, 1.0]
    
    // 信任调节：信任储备低时，追更欲公式不同
    trust_sensitivity: number;        // 信任对此因子的敏感度
    
    // 时机调节：在叙事节奏中的最佳使用时机
    timing_optimal_window: [number, number]; // 章节进度百分比
    timing_penalty: number;           // 非最佳时机的惩罚系数
  };
  
  // 效果衰减（同一因子重复使用）
  fatigue_model: {
    uses_in_recent_20_chapters: number;
    fatigue_factor: number;           // [0.3, 1.0]
    recovery_rate: number;            // 每章恢复率
  };
}

// 追更欲驱动因子库
const NEXT_CHAPTER_DRIVE_FACTORS: NextChapterDriveFactor[] = [
  {
    factor_id: "dcf-1",
    factor_name: "直接悬念",
    base_contribution: 0.9,
    description: "明确的未解决事件（角色处于危险中、秘密即将暴露等）",
    modifiers: {
      novelty_modifier: 1.0,
      trust_sensitivity: 0.3,
      timing_optimal_window: [0.85, 1.0],
      timing_penalty: 0.6
    },
    fatigue_model: {
      uses_in_recent_20_chapters: 0,
      fatigue_factor: 1.0,
      recovery_rate: 0.1
    }
  },
  {
    factor_id: "dcf-2",
    factor_name: "情感悬念",
    base_contribution: 0.85,
    description: "情感关系的悬而未决（告白、道歉、原谅等）",
    modifiers: {
      novelty_modifier: 0.9,
      trust_sensitivity: 0.5,
      timing_optimal_window: [0.8, 1.0],
      timing_penalty: 0.5
    },
    fatigue_model: {
      uses_in_recent_20_chapters: 0,
      fatigue_factor: 1.0,
      recovery_rate: 0.08
    }
  },
  {
    factor_id: "dcf-3",
    factor_name: "揭示预告",
    base_contribution: 0.8,
    description: "重要信息即将在下章揭示的预告",
    modifiers: {
      novelty_modifier: 0.85,
      trust_sensitivity: 0.4,
      timing_optimal_window: [0.7, 1.0],
      timing_penalty: 0.4
    },
    fatigue_model: {
      uses_in_recent_20_chapters: 0,
      fatigue_factor: 1.0,
      recovery_rate: 0.15
    }
  },
  {
    factor_id: "dcf-4",
    factor_name: "冲突升级",
    base_contribution: 0.75,
    description: "冲突在章末升级，下章必有爆发",
    modifiers: {
      novelty_modifier: 0.8,
      trust_sensitivity: 0.3,
      timing_optimal_window: [0.75, 1.0],
      timing_penalty: 0.5
    },
    fatigue_model: {
      uses_in_recent_20_chapters: 0,
      fatigue_factor: 1.0,
      recovery_rate: 0.12
    }
  },
  {
    factor_id: "dcf-5",
    factor_name: "时间压力",
    base_contribution: 0.7,
    description: "倒计时开始，紧迫感驱动",
    modifiers: {
      novelty_modifier: 0.75,
      trust_sensitivity: 0.2,
      timing_optimal_window: [0.5, 1.0],
      timing_penalty: 0.3
    },
    fatigue_model: {
      uses_in_recent_20_chapters: 0,
      fatigue_factor: 1.0,
      recovery_rate: 0.2
    }
  },
  {
    factor_id: "dcf-6",
    factor_name: "角色命运",
    base_contribution: 0.85,
    description: "读者关心的角色命运悬而未决",
    modifiers: {
      novelty_modifier: 0.95,
      trust_sensitivity: 0.6,
      timing_optimal_window: [0.8, 1.0],
      timing_penalty: 0.4
    },
    fatigue_model: {
      uses_in_recent_20_chapters: 0,
      fatigue_factor: 1.0,
      recovery_rate: 0.05
    }
  },
  {
    factor_id: "dcf-7",
    factor_name: "目标达成前夕",
    base_contribution: 0.65,
    description: "长期目标即将达成的临门一脚",
    modifiers: {
      novelty_modifier: 0.7,
      trust_sensitivity: 0.5,
      timing_optimal_window: [0.9, 1.0],
      timing_penalty: 0.7
    },
    fatigue_model: {
      uses_in_recent_20_chapters: 0,
      fatigue_factor: 1.0,
      recovery_rate: 0.1
    }
  }
];
```

### 7.5.7 读者反馈的模拟评分

系统模拟读者对每章的满意度评分，为作者提供参考：

```typescript
interface SimulatedReaderFeedback {
  feedback_id: string;
  chapter_number: number;
  
  // 综合评分
  overall_score: number;              // [0, 10]
  
  // 维度评分
  dimensional_scores: {
    plot_progression: number;         // 剧情推进 [0, 10]
    character_moment: number;         // 角色表现 [0, 10]
    emotional_impact: number;         // 情感冲击 [0, 10]
    worldbuilding: number;            // 世界展开 [0, 10]
    prose_quality: number;            // 文字质量 [0, 10]
    tension_management: number;       // 张力管理 [0, 10]
    satisfaction: number;             // 满足感 [0, 10]
    anticipation: number;             // 期待感 [0, 10]
  };
  
  // 模拟读者评论
  simulated_comments: SimulatedComment[];
  
  // 与同类型章节的对比
  comparative_ranking: {
    percentile_in_story: number;      // 在全故事中的百分位
    percentile_in_genre: number;      // 在同类型作品中的百分位（基于类型基准）
  };
  
  // 趋势
  trend: "improving" | "stable" | "declining" | "volatile";
  trend_confidence: number;
}

interface SimulatedComment {
  comment_type: "praise" | "criticism" | "question" | "prediction" | "emotional";
  content: string;                    // 模拟评论内容
  confidence: number;                 // 生成此评论的置信度
  sentiment_polarity: number;         // [-1, 1]
  
  // 来源依据
  basis: {
    narrative_element: string;        // 基于哪个叙事元素
    expected_reader_segment: string;  // 预期哪类读者会这样评论
  };
}
```

#### 评分计算模型

```typescript
function calculateChapterScore(
  chapter: Chapter,
  context: NarrativeContext
): SimulatedReaderFeedback {
  // 1. 剧情推进分
  const plotScore = assessPlotProgression(chapter, context);
  // 依据：活跃故事线的推进度、关键事件的发生、目标达成进度
  
  // 2. 角色表现分
  const characterScore = assessCharacterMoment(chapter, context);
  // 依据：核心角色的高光时刻、角色成长体现、角色选择的意义
  
  // 3. 情感冲击分
  const emotionalScore = assessEmotionalImpact(chapter, context);
  // 依据：情绪曲线强度、情感共鸣点、泪点/燃点的密度
  
  // 4. 世界展开分
  const worldbuildingScore = assessWorldbuilding(chapter, context);
  // 依据：新信息的揭示质量、世界观深度、设定与叙事的融合度
  
  // 5. 张力管理分
  const tensionScore = assessTensionManagement(chapter, context);
  // 依据：张力曲线质量、节奏变化、高潮/释放的平衡
  
  // 6. 满足感分
  const satisfactionScore = assessSatisfaction(chapter, context);
  // 依据：预期满足度、回报/延迟比、情感兑现
  
  // 7. 期待感分
  const anticipationScore = assessAnticipation(chapter, context);
  // 依据：追更欲模型输出、新预期的建立质量
  
  // 综合评分（加权平均）
  const overall = (
    plotScore * 0.2 +
    characterScore * 0.2 +
    emotionalScore * 0.15 +
    worldbuildingScore * 0.1 +
    tensionScore * 0.15 +
    satisfactionScore * 0.1 +
    anticipationScore * 0.1
  );
  
  return {
    overall_score: overall,
    dimensional_scores: {
      plot_progression: plotScore,
      character_moment: characterScore,
      emotional_impact: emotionalScore,
      worldbuilding: worldbuildingScore,
      prose_quality: estimateProseQuality(chapter), // 系统不评价文字质量，提供估计占位
      tension_management: tensionScore,
      satisfaction: satisfactionScore,
      anticipation: anticipationScore
    },
    // ... 其他字段
  };
}
```

---

## 7.6 子系统间协作关系与数据流

### 7.6.1 系统间协作总览

五个叙事要素子系统不是孤立运行的，它们通过数据流和事件机制紧密协作：

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     叙事要素系统协作关系图                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────┐     故事线承载      ┌──────────────┐                 │
│  │  故事线追踪   │◄─────────────────►│  主题符号引擎  │                 │
│  │  Storyline   │     主题深化路径    │   Theme      │                 │
│  │   Tracker    │                     │   Symbol     │                 │
│  └──────┬───────┘                     └──────┬───────┘                 │
│         │                                      │                        │
│         │ 故事线涉及角色                        │ 符号在关系中出现        │
│         ▼                                      ▼                        │
│  ┌──────────────┐     关系影响张力     ┌──────────────┐                 │
│  │  关系网演化   │◄──────────────────►│   张力引擎    │                 │
│  │Relationship  │     冲突产生张力     │   Tension    │                 │
│  │  Network     │                     │   Engine     │                 │
│  │  Evolution   │◄──────────────────┐└──────┬───────┘                 │
│  └──────┬───────┘                   │        │                         │
│         │                           │        │ 张力驱动预期            │
│         │ 关系影响读者预期           │        ▼                         │
│         │                           │ ┌──────────────┐                 │
│         ▼                           │ │ 读者预期演化  │                 │
│  ┌────────────────────────────────┐ │ │ Expectation  │                 │
│  │        读者知识图谱             │◄┘ │  Evolution   │                 │
│  │    Reader Knowledge Graph      │   └──────────────┘                 │
│  └────────────────────────────────┘                                     │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                        外部接口                                  │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │   │
│  │  │ 世界引擎  │  │ 工作室引擎 │  │   谏官    │  │ Flow Guardian │  │   │
│  │  │ World    │  │ Studio   │  │ Guardian │  │              │  │   │
│  │  │ Engine   │  │ Engine   │  │          │  │              │  │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

### 7.6.2 数据流定义

#### 数据流 1：故事线追踪 → 主题符号引擎

```typescript
interface StorylineToThemeDataFlow {
  flow_id: "sl-theme-001";
  direction: "storyline_tracker -> theme_symbol_engine";
  
  // 传输数据
  payload: {
    // 故事线提供的主题承载信息
    storyline_theme_bearing: {
      storyline_id: string;
      theme_associations: {
        theme_id: string;
        bearing_type: "primary" | "secondary" | "background";
        chapter_exposure: Map<number, number>; // 每章的暴露度
      }[];
    }[];
    
    // 故事线交叉点的主题交织机会
    cross_theme_opportunities: {
      crossing_id: string;
      storyline_ids: string[];
      potential_theme_synthesis: string[]; // 可能产生主题合成的主题ID
      chapter_number: number;
    }[];
  };
  
  // 触发条件
  trigger: "chapter_processed" | "storyline_crossing_detected" | "manual_request";
  
  // 使用目的
  purpose: "更新主题矩阵中的故事线承载关系，识别主题交织机会";
}
```

#### 数据流 2：关系网演化 → 张力引擎

```typescript
interface RelationshipToTensionDataFlow {
  flow_id: "rel-tension-001";
  direction: "relationship_network -> tension_engine";
  
  payload: {
    // 关系变化产生的张力
    relationship_tension_sources: {
      relationship_id: string;
      source_character: string;
      target_character: string;
      
      tension_generation: {
        tension_type: TensionCategory;
        tension_value: number;
        trigger_event: string;        // 触发张力的事件
        chapter_number: number;
      }[];
    }[];
    
    // 网络拓扑张力（结构性张力源）
    network_topology_tensions: {
      tension_type: "structural_hole" | "unbalanced_triad" | "faction_rift";
      involved_characters: string[];
      structural_tension_score: number;
      narrative_potential: string;    // 叙事潜力描述
    }[];
    
    // 冲突预测
    predicted_conflicts: {
      predicted_type: string;
      involved_characters: string[];
      probability: number;
      estimated_chapter?: number;
      tension_contribution: number;   // 预计贡献的张力值
    }[];
  };
  
  trigger: "relationship_updated" | "topology_changed" | "chapter_processed";
  purpose: "将关系变化转化为张力源，识别结构性张力";
}
```

#### 数据流 3：张力引擎 → 读者预期演化

```typescript
interface TensionToExpectationDataFlow {
  flow_id: "tension-exp-001";
  direction: "tension_engine -> expectation_evolution";
  
  payload: {
    // 当前张力状态对预期的影响
    tension_state: {
      current_chapter: number;
      active_tension_sources: {
        source_id: string;
        category: TensionCategory;
        intensity: number;
        unresolved: boolean;
      }[];
      
      // 累积未释放张力
      accumulated_tension: number;
      tension_trajectory: "rising" | "stable" | "falling";
    };
    
    // 张力释放/升级对预期的塑造
    tension_expectation_shaping: {
      // 高未释放张力 → 读者预期"必须释放"
      release_expectation_pressure: number;
      
      // 张力上升趋势 → 读者预期"更大的事件"
      escalation_expectation: number;
      
      // 张力模式识别 → 套路匹配
      pattern_matched_tropes: {
        trope_id: string;
        match_confidence: number;
        expected_progression: string;
      }[];
    };
    
    // 张力缺口信息
    tension_gap_info?: {
      gap_type: string;
      affected_chapters: number[];
      reader_fatigue_risk: number;
    };
  };
  
  trigger: "tension_updated" | "tension_peak_detected" | "tension_gap_alert";
  purpose: "将张力状态转化为预期模型输入，识别套路匹配机会";
}
```

#### 数据流 4：读者预期演化 → 故事线追踪

```typescript
interface ExpectationToStorylineDataFlow {
  flow_id: "exp-sl-001";
  direction: "expectation_evolution -> storyline_tracker";
  
  payload: {
    // 读者预期对故事线发展的反馈
    reader_expectation_feedback: {
      storyline_id: string;
      
      // 读者对此线的预期状态
      expectation_state: {
        expected_next_direction: string;
        expected_timing: [number, number]; // 章节范围
        expectation_strength: number;
      };
      
      // 满足/打破建议
      strategy_suggestion: "fulfill" | "delay" | "subvert" | "compound";
      
      // 如果延迟，读者的耐心预测
      reader_patience_estimate: number; // [0, 1]
    }[];
    
    // 预期树中的分支机会（多线叙事的节奏建议）
    branching_opportunities: {
      current_focus_storyline: string;
      recommended_next_storyline?: string; // 建议切换到的故事线
      switch_reason: string;
      estimated_reader_refreshment: number; // 切换带来的新鲜感
    }[];
  };
  
  trigger: "expectation_tree_updated" | "chapter_end_analysis" | "pattern_matched";
  purpose: "将读者预期反馈到故事线管理，优化多线节奏";
}
```

#### 数据流 5：主题符号引擎 → 读者预期演化

```typescript
interface ThemeToExpectationDataFlow {
  flow_id: "theme-exp-001";
  direction: "theme_symbol_engine -> expectation_evolution";
  
  payload: {
    // 主题深化对预期的影响
    theme_expectations: {
      theme_id: string;
      
      // 读者基于主题发展形成的预期
      reader_theme_expectations: {
        expectation: string;          // 如 "主题将向更黑暗的方向发展"
        basis: "symbol_progression" | "character_arc" | "narrative_pattern";
        confidence: number;
      }[];
      
      // 主题承诺（作者通过主题建立的预期）
      thematic_promises: {
        promise: string;              // 如 "自由意志主题最终将得到回答"
        establishment_chapters: number[];
        fulfillment_status: "unfulfilled" | "partially_fulfilled" | "fulfilled";
      }[];
    }[];
    
    // 符号出现的预期管理
    symbol_expectations: {
      motif_id: string;
      next_expected_occurrence: {
        chapter_range: [number, number];
        expected_manifestation: string; // 预期的表现形式
        emotional_setup_needed: string[]; // 需要的情感铺垫
      };
    }[];
  };
  
  trigger: "theme_depth_updated" | "motif_occurrence_added" | "thematic_promise_identified";
  purpose: "将主题发展纳入预期管理，确保主题承诺的兑现";
}
```

#### 数据流 6：关系网演化 → 故事线追踪

```typescript
interface RelationshipToStorylineDataFlow {
  flow_id: "rel-sl-001";
  direction: "relationship_network -> storyline_tracker";
  
  payload: {
    // 关系变化对故事线的影响
    relationship_storyline_impacts: {
      relationship_id: string;
      
      // 此关系变化影响了哪些故事线
      impacted_storylines: {
        storyline_id: string;
        impact_type: "catalyst" | "obstacle" | "pivot" | "enrichment";
        impact_description: string;
        estimated_exposure_change: number; // 预计的暴露度变化
      }[];
    }[];
    
    // 新关系线可能引发的新故事线
    new_storyline_seeds: {
      seed_id: string;
      originating_relationship: string;
      proposed_storyline_type: StorylineType;
      narrative_potential: number;    // [0, 1]
      suggested_characters: string[];
    }[];
    
    // 关系网络的健康度对故事线的反馈
    network_health_feedback: {
      overall_network_health: number; // [0, 1]
      isolated_storylines: string[];  // 孤立的故事线（与其他线无关系连接）
      overconnected_storylines: string[]; // 过度连接的故事线
    };
  };
  
  trigger: "relationship_changed" | "clique_detected" | "network_topology_changed";
  purpose: "将关系演化反馈到故事线管理，发现新故事线种子";
}
```

### 7.6.3 与外部系统的接口

#### 与世界引擎的接口

```typescript
interface WorldEngineInterface {
  // 世界引擎 → 叙事要素系统
  incoming: {
    // 世界状态变化通知
    world_state_changes: {
      change_type: "power_shift" | "faction_restructure" | "secret_revealed" | "resource_change";
      change_description: string;
      affected_entities: string[];    // 受影响的实体ID
      narrative_implications: string[]; // 叙事含义
    }[];
    
    // 可能性推演结果
    possibility_projections: {
      projection_id: string;
      from_state: WorldState;
      possible_outcomes: {
        outcome_description: string;
        probability: number;
        involved_characters: string[];
        tension_impact: number;
      }[];
    };
  };
  
  // 叙事要素系统 → 世界引擎
  outgoing: {
    // 叙事需要的世界状态查询
    state_queries: {
      query_id: string;
      query_type: "character_power" | "faction_relation" | "resource_availability" | "secret_status";
      subject_id: string;
      context: string;
    }[];
    
    // 叙事推演请求
    narrative_projection_requests: {
      request_id: string;
      premise: string;                // 如 "如果角色A在 chapter 500 背叛角色B"
      projection_depth: number;       // 推演深度（章节数）
      focus: "relationship" | "power" | "faction" | "personal";
    }[];
  };
}
```

#### 与谏官系统的接口

```typescript
interface GuardianInterface {
  // 谏官 ← 叙事要素系统（风险上报）
  risk_reports: {
    // 故事线风险
    storyline_risks: {
      risk_type: "dormancy" | "orphan_foreshadowing" | "stalled_main" | "density_overload";
      storyline_id: string;
      severity: "info" | "warning" | "critical";
      description: string;
      recommended_action: string;
    }[];
    
    // 关系网络风险
    relationship_risks: {
      risk_type: "unresolved_tension" | "abrupt_change" | "isolation" | "over_complexity";
      relationship_id?: string;
      characters_involved: string[];
      severity: "info" | "warning" | "critical";
      description: string;
    }[];
    
    // 张力风险
    tension_risks: {
      risk_type: "prolonged_low" | "missing_release" | "fatigue" | "monotony";
      chapter_range: [number, number];
      severity: "info" | "warning" | "critical";
      description: string;
    }[];
    
    // 主题风险
    theme_risks: {
      risk_type: "drift" | "contradiction" | "shallowing" | "abandonment";
      theme_id: string;
      severity: "info" | "warning" | "critical";
      description: string;
    }[];
    
    // 预期管理风险
    expectation_risks: {
      risk_type: "trust_depletion" | "promise_unfulfilled" | "pattern_fatigue" | "surprise_quality_decline";
      severity: "info" | "warning" | "critical";
      description: string;
      trust_reserve_impact?: number;
    }[];
  };
  
  // 谏官 → 叙事要素系统（处置反馈）
  guardian_feedback: {
    risk_id: string;
    author_decision: "acknowledged" | "dismissed" | "deferred" | "action_taken";
    author_action?: string;
    system_adjustment: string;        // 系统根据作者决定进行的调整
  };
}
```

#### 与工作室引擎的接口

```typescript
interface StudioEngineInterface {
  // 叙事要素系统 → 工作室引擎（创作Brief支持）
  brief_support: {
    // 故事线上下文
    storyline_context: {
      active_storylines: {
        storyline_id: string;
        current_status: StorylineStatus;
        recommended_next_exposure: number;
        key_events_needed: string[];
      }[];
    };
    
    // 关系上下文
    relationship_context: {
      relationships_needing_resolution: string[];
      tension_peaks_approaching: string[];
      character_dynamic_suggestions: string[];
    };
    
    // 张力指导
    tension_guidance: {
      recommended_tension_curve: number[];  // 建议的张力曲线
      rhythm_template_suggestion: string;
      peak_placement_opportunities: number[];
    };
    
    // 主题指导
    theme_guidance: {
      themes_needing_development: string[];
      symbol_opportunities: {
        motif_id: string;
        suggested_context: string;
        expected_depth_contribution: number;
      }[];
    };
    
    // 预期管理指导
    expectation_guidance: {
      current_expectation_state: ExpectationTree;
      recommended_strategy: ExpectationStrategy;
      trust_reserve_status: number;
    };
  };
  
  // 工作室引擎 → 叙事要素系统（创作结果反馈）
  creation_feedback: {
    chapter_number: number;
    
    // 实际创作与系统建议的对比
    actual_vs_recommended: {
      storyline_exposure: Map<string, number>; // 实际故事线暴露度
      tension_actual: number[];                 // 实际张力曲线
      theme_presence: Map<string, number>;     // 实际主题出现度
    };
    
    // 作者的创作选择（用于学习）
    authorial_choices: {
      choice_type: string;
      system_suggestion: string;
      author_choice: string;
      rationale?: string;
    }[];
  };
}
```

#### 与Flow Guardian的接口

```typescript
interface FlowGuardianInterface {
  // 叙事要素系统 → Flow Guardian（心流状态支持）
  flow_support: {
    // 当前叙事节奏状态
    narrative_rhythm_state: {
      current_tension_level: number;
      tension_trend: "rising" | "stable" | "falling";
      storyline_entropy: number;
      reader_engagement_estimate: number;
    };
    
    // 心流支持建议
    flow_optimization_suggestions: {
      suggestion_type: "increase_tension" | "add_variety" | "deepen_theme" | "resolve_subplot";
      description: string;
      estimated_flow_impact: number;  // 对心流的预计影响
    }[];
    
    // 中断风险预警
    flow_disruption_risks: {
      risk_type: "monotony" | "over_complexity" | "unresolved_tension_overflow" | "expectation_mismatch";
      risk_level: number;
      description: string;
    }[];
  };
  
  // Flow Guardian → 叙事要素系统（心流反馈）
  flow_feedback: {
    current_flow_state: {
      flow_score: number;             // [0, 1]
      author_engagement: number;      // 作者投入度
      creative_momentum: number;      // 创作动量
    };
    
    // 心流状态对叙事要素系统的调节
    flow_adjustments: {
      tension_target_adjustment: number;    // 张力目标的动态调整
      complexity_ceiling_adjustment: number; // 复杂度上限调整
      suggestion_priority_shift: string[];   // 建议优先级调整
    };
  };
}
```

### 7.6.4 事件总线

子系统间通过事件总线进行异步通信：

```typescript
interface NarrativeElementEvent {
  event_id: string;
  event_type: NarrativeElementEventType;
  timestamp: timestamp;
  
  // 事件来源
  source_system: "storyline_tracker" | "relationship_network" | "tension_engine" | 
                  "theme_symbol" | "expectation_evolution";
  
  // 事件负载
  payload: Record<string, any>;
  
  // 传播策略
  propagation: {
    target_systems: string[];       // 目标子系统
    priority: "high" | "normal" | "low";
    synchronous: boolean;           // 是否同步处理
  };
}

type NarrativeElementEventType =
  // 故事线事件
  | "STORYLINE_CREATED"
  | "STORYLINE_STATUS_CHANGED"
  | "STORYLINE_CROSSING_DETECTED"
  | "STORYLINE_EXPOSURE_UPDATED"
  | "STORYLINE_HEALTH_ALERT"
  
  // 关系事件
  | "RELATIONSHIP_CREATED"
  | "RELATIONSHIP_CHANGED"
  | "RELATIONSHIP_EVENT_LOGGED"
  | "CLIQUE_DETECTED"
  | "STRUCTURAL_HOLE_FOUND"
  | "TRIAD_IMBALANCE_DETECTED"
  
  // 张力事件
  | "TENSION_PEAK_DETECTED"
  | "TENSION_GAP_ALERT"
  | "TENSION_STATE_CHANGED"
  | "RHYTHM_TEMPLATE_MATCHED"
  | "CLIFFHANGER_OPPORTUNITY"
  
  // 主题事件
  | "THEME_DEPTH_CHANGED"
  | "MOTIF_DISCOVERED"
  | "MOTIF_OCCURRENCE_ADDED"
  | "THEME_CONFLICT_DETECTED"
  | "THEMATIC_PROMISE_MADE"
  | "THEMATIC_PROMISE_FULFILLED"
  
  // 预期事件
  | "EXPECTATION_TREE_UPDATED"
  | "EXPECTATION_VIOLATED"
  | "TROPE_MATCHED"
  | "TRUST_RESERVE_CHANGED"
  | "READER_EMOTION_PEAK"
  | "NEXT_CHAPTER_DESIRE_UPDATED"
  
  // 周期事件
  | "CHAPTER_PROCESSED"
  | "HEALTH_CHECK_COMPLETED"
  | "REPORT_GENERATED";

// 事件总线配置
const EVENT_BUS_CONFIG = {
  // 事件处理保证
  delivery_guarantee: "at_least_once",
  
  // 优先级队列
  priority_queues: {
    high: ["STORYLINE_HEALTH_ALERT", "TENSION_GAP_ALERT", "TRUST_RESERVE_CHANGED"],
    normal: ["STORYLINE_CROSSING_DETECTED", "TENSION_PEAK_DETECTED", "MOTIF_DISCOVERED"],
    low: ["EXPECTATION_TREE_UPDATED", "RHYTHM_TEMPLATE_MATCHED"]
  },
  
  // 事件保留策略
  retention: {
    high_priority_days: 30,
    normal_priority_days: 14,
    low_priority_days: 7
  },
  
  // 批处理
  batch_processing: {
    enabled: true,
    batch_size: 10,
    batch_timeout_ms: 1000
  }
};
```

---

## 7.7 统一数据结构与TypeScript接口汇总

### 7.7.1 命名空间总览

```typescript
// 所有叙事要素系统的类型定义统一放在 NarrativeElements 命名空间下
namespace NarrativeElements {
  // 7.1 故事线追踪
  export namespace StorylineTracker {
    export interface Storyline { /* ... */ }
    export interface StorylineExposure { /* ... */ }
    export interface StorylineCrossing { /* ... */ }
    export interface ChapterDensityProfile { /* ... */ }
    export interface StorylineHealthReport { /* ... */ }
    export interface StorylineHealthDetail { /* ... */ }
    export interface StorylineForeshadowingLink { /* ... */ }
    
    export enum StorylineType { /* ... */ }
    export enum StorylineStatus { /* ... */ }
    export enum StorylineCrossType { /* ... */ }
    export enum StorylineRiskFlag { /* ... */ }
  }
  
  // 7.2 关系网演化
  export namespace RelationshipNetwork {
    export interface Relationship { /* ... */ }
    export interface RelationshipProperties { /* ... */ }
    export interface RelationshipEvent { /* ... */ }
    export interface NetworkTopologyReport { /* ... */ }
    export interface CliqueDetectionResult { /* ... */ }
    export interface TriadicRelation { /* ... */ }
    export interface FactionAlignment { /* ... */ }
    export interface NetworkVisualizationSpec { /* ... */ }
    
    export enum RelationType { /* ... */ }
    export enum RelationEventType { /* ... */ }
  }
  
  // 7.3 张力引擎
  export namespace TensionEngine {
    export interface SceneTension { /* ... */ }
    export interface ChapterTensionProfile { /* ... */ }
    export interface TensionRhythmTemplate { /* ... */ }
    export interface TensionGapAlert { /* ... */ }
    export interface TensionExpectationModel { /* ... */ }
    export interface TensionPeakAnnotation { /* ... */ }
    export interface TensionSource { /* ... */ }
    
    export enum TensionCategory { /* ... */ }
  }
  
  // 7.4 主题符号引擎
  export namespace ThemeSymbolEngine {
    export interface Theme { /* ... */ }
    export interface Motif { /* ... */ }
    export interface MotifOccurrence { /* ... */ }
    export interface ThemeMotifMapping { /* ... */ }
    export interface ThemeDepthAssessment { /* ... */ }
    export interface ThemeConsistencyReport { /* ... */ }
    export interface ThematicMatrix { /* ... */ }
    export interface ThemeHierarchy { /* ... */ }
    
    export enum MotifType { /* ... */ }
  }
  
  // 7.5 读者预期演化
  export namespace ExpectationEvolution {
    export interface ExpectationTree { /* ... */ }
    export interface ExpectationNode { /* ... */ }
    export interface ExpectationViolation { /* ... */ }
    export interface ExpectationManagementDecision { /* ... */ }
    export interface ExpectationStrategy { /* ... */ }
    export interface ReaderTrustReserve { /* ... */ }
    export interface ReaderEmotionSimulation { /* ... */ }
    export interface SimulatedReaderFeedback { /* ... */ }
    export interface CliffhangerDesireModel { /* ... */ }
    
    export enum ReaderEmotion { /* ... */ }
    export enum EmotionDriverType { /* ... */ }
  }
  
  // 7.6 子系统接口
  export namespace SystemInterfaces {
    export interface StorylineToThemeDataFlow { /* ... */ }
    export interface RelationshipToTensionDataFlow { /* ... */ }
    export interface TensionToExpectationDataFlow { /* ... */ }
    export interface ExpectationToStorylineDataFlow { /* ... */ }
    export interface ThemeToExpectationDataFlow { /* ... */ }
    export interface RelationshipToStorylineDataFlow { /* ... */ }
    export interface WorldEngineInterface { /* ... */ }
    export interface GuardianInterface { /* ... */ }
    export interface StudioEngineInterface { /* ... */ }
    export interface FlowGuardianInterface { /* ... */ }
    export interface NarrativeElementEvent { /* ... */ }
  }
}
```

### 7.7.2 数据库表结构汇总

#### foreshadowings 表（伏笔）

```sql
CREATE TABLE foreshadowings (
  id VARCHAR(36) PRIMARY KEY,
  display_name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- 时间定位
  planted_chapter INT NOT NULL,
  target_resolution_chapter INT,
  actual_resolution_chapter INT,
  
  -- 叙事能量
  narrative_potential DECIMAL(3,2) NOT NULL DEFAULT 0.5, -- [0, 1]
  half_life INT NOT NULL DEFAULT 30, -- 章节数
  
  -- 关联
  planted_by_scene_id VARCHAR(36),
  resonance_themes JSON, -- ["theme_id_1", "theme_id_2"]
  associated_storylines JSON, -- ["storyline_id_1"]
  
  -- 状态
  status ENUM('planted', 'growing', 'ripe', 'resolved', 'withered') DEFAULT 'planted',
  
  -- 元数据
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  author_notes TEXT
);
```

#### precedents 表（先例）

```sql
CREATE TABLE precedents (
  id VARCHAR(36) PRIMARY KEY,
  display_name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- 触发条件
  trigger_conditions JSON NOT NULL, -- [{"type": "event", "description": "..."}]
  
  -- 叙事能量
  narrative_potential DECIMAL(3,2) NOT NULL DEFAULT 0.5,
  half_life INT NOT NULL DEFAULT 50,
  
  -- 来源
  created_from_oracle_id VARCHAR(36), -- 来源预言ID
  created_from_foreshadowing_id VARCHAR(36), -- 可能由伏笔转化
  
  -- 状态
  status ENUM('active', 'triggered', 'resolved', 'expired') DEFAULT 'active',
  
  -- 关联
  affected_storylines JSON,
  affected_characters JSON,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

#### relationships 表（关系）

```sql
CREATE TABLE relationships (
  id VARCHAR(36) PRIMARY KEY,
  source_id VARCHAR(36) NOT NULL, -- 角色ID
  target_id VARCHAR(36) NOT NULL, -- 角色ID
  
  -- 关系类型
  relation_types JSON NOT NULL, -- ["friendship", "mentor"]
  
  -- 属性（JSON存储动态演化属性）
  properties JSON NOT NULL DEFAULT '{
    "affection": 0,
    "trust": 0,
    "respect": 0,
    "familiarity": 0,
    "power_differential": 0,
    "dependency": 0,
    "debt": 0,
    "obligation": 0,
    "latent_tension": 0,
    "conflict_potential": 0
  }',
  
  -- 状态
  status ENUM('active', 'dormant', 'severed', 'transformed') DEFAULT 'active',
  
  -- 时间轴
  created_at_chapter INT NOT NULL,
  last_updated_chapter INT NOT NULL,
  
  -- 元数据
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- 唯一约束
  UNIQUE KEY unique_relationship (source_id, target_id),
  INDEX idx_source (source_id),
  INDEX idx_target (target_id)
);
```

#### relationship_events 表（关系事件）

```sql
CREATE TABLE relationship_events (
  id VARCHAR(36) PRIMARY KEY,
  relationship_id VARCHAR(36) NOT NULL,
  chapter_number INT NOT NULL,
  scene_id VARCHAR(36),
  
  event_type VARCHAR(50) NOT NULL,
  description TEXT,
  narrative_context TEXT,
  
  -- 属性变化
  property_changes JSON, -- {"trust": -0.3, "affection": -0.2}
  
  impact_weight DECIMAL(3,2) DEFAULT 0.5,
  is_turning_point BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_relationship (relationship_id),
  INDEX idx_chapter (chapter_number)
);
```

#### reader_knowledge_graph 表（读者知识图谱）

```sql
CREATE TABLE reader_knowledge_graph (
  id VARCHAR(36) PRIMARY KEY,
  entity_type ENUM('character', 'faction', 'location', 'event', 'secret', 'item') NOT NULL,
  entity_id VARCHAR(36) NOT NULL,
  
  -- 三个认知层次
  character_knowledge JSON, -- 角色知道什么 [{"character_id": "x", "knowledge_level": 0.8, "since_chapter": 10}]
  reader_knowledge JSON,    -- 读者知道什么 {"level": 0.9, "since_chapter": 5, "certainty": "confirmed"}
  authorial_intent JSON,    -- 作者意图 {"planned_revelation_chapter": 100, "importance": "critical"}
  
  -- 认知差（系统自动计算）
  knowledge_gaps JSON, -- [{"between": "reader_vs_character_A", "gap_type": "dramatic_irony", "tension_value": 0.8}]
  
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_entity (entity_type, entity_id)
);
```

### 7.7.3 配置项汇总

```typescript
interface NarrativeElementsConfig {
  // 故事线追踪配置
  storyline: {
    dormancy_base_threshold: number;          // 基础休眠阈值（章节数），默认15
    dormancy_weight_factor_multiplier: number; // 权重因子乘数，默认2
    dormancy_length_factor_cap: number;       // 长度因子上限，默认2
    dormancy_foreshadowing_factor_base: number; // 伏笔因子基础值，默认1
    dormancy_foreshadowing_factor_per_item: number; // 每个伏笔的减量，默认0.1
    
    cross_detection_same_scene_threshold: number; // 场景共现检测阈值，默认0.3
    cross_detection_theme_jaccard_threshold: number; // 主题Jaccard阈值，默认0.5
    
    health_check_interval: number;            // 健康检查间隔（章节数），默认10
  };
  
  // 关系网配置
  relationship: {
    decay_rate: number;                       // 关系衰减率，默认0.02
    trust_anchoring_half_life: number;        // 信任锚定半衰期（章节数），默认50
    trust_asymmetry_factor: number;           // 信任非对称因子，默认0.5
    power_differential_sigmoid_steepness: number; // 权力sigmoid陡度，默认3
    
    topology_analysis_interval: number;       // 拓扑分析间隔，默认5
    clique_detection_min_size: number;        // 小团体最小规模，默认3
  };
  
  // 张力引擎配置
  tension: {
    default_weights: Map<TensionCategory, number>; // 各类张力的默认权重
    synergy_bonus_per_dimension: number;      // 每多一维的协同加成，默认0.15
    synergy_bonus_cap: number;                // 协同加成上限，默认1.5
    
    gap_prolonged_low_consecutive: number;    // 低张力持续章节数阈值，默认8
    gap_prolonged_low_threshold: number;      // 低张力阈值，默认0.25
    gap_missing_release_consecutive_high: number; // 高张力持续章节数阈值，默认5
    gap_missing_release_high_threshold: number; // 高张力阈值，默认0.75
    
    peak_classification_confidence_threshold: number; // 峰值分类置信度阈值，默认0.7
  };
  
  // 主题符号配置
  theme: {
    motif_discovery_min_occurrences: number;  // 符号发现最少出现次数，默认3
    motif_discovery_min_chapter_span: number; // 符号发现最小跨度，默认20
    motif_discovery_confidence_threshold: number; // 符号发现置信度阈值，默认0.6
    
    theme_drift_similarity_threshold: number; // 主题漂移相似度阈值，默认0.5
    consistency_check_interval: number;       // 一致性检查间隔，默认10
    
    depth_dimensions_weights: {               // 深度维度权重
      intellectual_complexity: number;
      emotional_resonance: number;
      moral_ambiguity: number;
      interconnection_density: number;
    };
  };
  
  // 读者预期配置
  expectation: {
    trust_reserve_initial: number;            // 初始信任储备，默认0.7
    trust_reserve_critical_low: number;       // 信任储备临界低值，默认0.2
    trust_reserve_caution_zone: number;       // 信任储备警戒值，默认0.4
    
    expectation_tree_max_depth: number;       // 预期树最大深度，默认5
    expectation_tree_branching_factor: number; // 预期树分支因子，默认3
    
    fatigue_window_size: number;              // 疲劳窗口大小（章节数），默认20
    fatigue_recovery_rate: number;            // 疲劳恢复率（每章），默认0.1
    
    simulated_reader_segments: string[];      // 模拟读者群体类型
  };
  
  // 事件总线配置
  event_bus: {
    delivery_guarantee: "at_least_once" | "exactly_once";
    batch_size: number;
    batch_timeout_ms: number;
    retention_days_high: number;
    retention_days_normal: number;
    retention_days_low: number;
  };
}
```

---

## 7.8 总结

叙事要素系统是 NarrativeOS v3.0 Sovereign 的核心认知层。它不创造叙事，而是为作者提供叙事的"X光透视"——让作者看清自己正在编织的故事结构中每一根线的走向、每一个结的位置、每一处张力的分布。

五个子系统形成一个完整的叙事认知闭环：

1. **故事线追踪**回答"什么在发生"——宏观结构
2. **关系网演化**回答"谁在发生什么"——中观人际
3. **张力引擎**回答"感受如何"——微观节奏
4. **主题符号引擎**回答"意味着什么"——深层意义
5. **读者预期演化**回答"读者怎么想"——受众视角

这些子系统通过定义明确的数据流和事件总线相互协作，同时通过标准接口与世界引擎、工作室引擎、谏官和Flow Guardian交互。所有输出都是**建议性**的——系统在检测到风险时发出警报，在发现机会时提供建议，但最终的叙事决策权始终属于作者。

因为在这个系统中，作者不在引擎内部。**作者在引擎之上。**
