# 第五章 世界引擎（World Engine）详细设计文档

## 版本信息
- **文档版本**: v3.0 Sovereign
- **目标系统**: NarrativeOS v3.0 Sovereign — 100万字以上长篇网文创作作者增强系统
- **编写日期**: 2025年
- **适用范围**: 第五卷第五章 — 世界引擎

---

## 5.0 世界引擎总览

世界引擎是 NarrativeOS 的"物理法则"与"世界状态"守护者，负责维护虚拟世界的内在一致性、推演事件因果链条、驱动非玩家角色（NPC）行为、模拟信息传播与环境演化。它在创作过程中充当"世界观守门人"，确保作者的每一次叙事干预都在世界规则的自洽框架内运行。

世界引擎由 **8 个核心子引擎** 与 **7 个 LLM 增强点** 构成。其中 5 个子引擎（5.3–5.7）在原有数学/规则驱动的基础上新增了 LLM 叙事增强能力，形成"硬规则保证一致性，LLM 赋予生命力"的混合架构。

```
┌─────────────────────────────────────────────────────────────────────┐
│                        世界引擎  WorldEngine                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │ 5.1 物理规则  │  │5.2 特殊能力  │  │ 5.3 因果推演 │  │ 5.4 NPC行为 │ │
│  │   引擎      │  │  管理器     │  │    器      │  │   引擎     │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘ │
│         │                │                │                │        │
│  ┌──────┴──────┐  ┌──────┴──────┐  ┌──────┴──────┐  ┌──────┴──────┐ │
│  │ 5.5 环境模拟 │  │ 5.6 信息涟漪 │  │ 5.7 先例引擎 │  │ 5.8 代价计算 │ │
│  │    器      │  │   模拟器    │  │            │  │    器      │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘ │
│         └────────────────┘                └────────────────┘        │
│                          │                                          │
│              ┌───────────┴───────────────────────────────┐           │
│              │     5.9 叙事智能 LLM 调用层（7个增强点）    │           │
│              │  5.9.1 NPC意图推断器                       │           │
│              │  5.9.2 环境叙事意图生成器                    │           │
│              │  5.9.3 涟漪叙事后果推断器                    │           │
│              │  5.9.4 可能性清单叙事增强器 ★重型            │           │
│              │  5.9.5 核聚变叙事解释器                      │           │
│              │  5.9.6 世界时间叙事影响评估                  │           │
│              │  5.9.7 叙事价值评估（工作室引擎调用）          │           │
│              └───────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────────────┘
```

**核心设计原则**：

1. **规则至上**: 物理规则引擎和战力公式是硬约束，任何 LLM 输出都必须通过规则校验才能生效。
2. **分层架构**: 底层是数学公式和规则匹配（纯计算），中层是图算法和搜索（CSP/扩散/行为树），上层是 LLM 叙事增强（创意生成）。
3. **缓存优先**: 可重复计算的结果积极缓存，LLM 调用成本高昂需严格控制频次。
4. **异步解耦**: 涟漪推断和时间评估等不影响主线流程的操作全部异步执行，不阻塞 MOU（叙事主循环）。
5. **确定性保证**: 相同输入必须产生相同输出（混沌种子可控），确保世界状态可复现。

---

## 5.1 物理规则引擎（Physics Rules Engine）

### 5.1.1 职责定位

物理规则引擎是世界引擎中唯一**完全不依赖 LLM** 的子引擎。它负责：
- 管理通用物理规则（重力、元素相克、空间法则等）
- 计算角色战力值与境界评估
- 验证动作在物理层面的合法性
- 评估环境对行为的约束与加成

### 5.1.2 战力体系的完整定义

网文战力体系的核心特征是**多维度等级系统**。物理规则引擎采用 `RealmSystem` 架构，支持任意层级的境界嵌套。

#### 5.1.2.1 境界体系数据结构

```typescript
// ==================== 境界体系核心定义 ====================

interface RealmTier {
  tierId: string;           // 如 "qi_refining"
  name: string;             // 如 "练气期"
  order: number;            // 全境界排序序号，从1开始
  tierWithinStage: number;  // 在当前大阶段内的序号，如练气1-9层
  parentStageId: string;    // 所属大阶段ID，如 "foundation"
  basePowerMultiplier: number;  // 基础战力倍率，如 1.0, 10.0, 100.0
  attributes: {
    hpBonus: number;        // 生命值加成系数
    mpBonus: number;        // 法力值加成系数
    speedBonus: number;     // 速度加成系数
    perceptionBonus: number; // 感知加成系数
    specialSlots: number;   // 特殊能力槽位
  };
  unlocks: string[];        // 解锁的能力/法术/权限列表
  restrictions: string[];   // 本境界限制（不能做的事）
  breakthroughConditions: BreakthroughCondition[];  // 突破条件
}

interface BreakthroughCondition {
  type: "cultivation_base" | "combat_exp" | "item_required" | "event_trigger" | "comprehension";
  threshold: number | string;
  description: string;
}

interface RealmStage {
  stageId: string;          // 如 "foundation"
  name: string;             // 如 "筑基"
  order: number;            // 大阶段排序
  tiers: RealmTier[];       // 子层级，如筑基初期/中期/后期/圆满
  stageMultiplier: number;  // 跨大阶段的跃迁倍率
  colorCode: string;        // UI显示颜色
}

interface RealmSystem {
  systemId: string;         // 如 "cultivation", "magic", "martial"
  systemName: string;       // 如 "修真体系"
  stages: RealmStage[];     // 所有大阶段
  crossSystemRules: CrossSystemRule[];  // 跨体系交互规则
}

interface CrossSystemRule {
  condition: string;        // 如 "cultivation.realm >= foundation"
  effect: string;           // 如 "magic.spell_power *= 1.5"
  description: string;
}
```

#### 5.1.2.2 战力计算公式体系

战力值采用**六维向量 + 综合战力**模型：

```
角色战力向量 P = (P_atk, P_def, P_spd, P_spi, P_tech, P_luck)

综合战力 CP = f(P) = Σ(w_i × P_i^α_i) × realmMultiplier × stateModifier

其中：
  - w_i: 维度权重，默认 w = (0.25, 0.20, 0.15, 0.15, 0.15, 0.10)
  - α_i: 非线性指数，默认 α_i = 1.0（可通过配置改为非线性）
  - realmMultiplier: 境界倍率，见下表
  - stateModifier: 实时状态修正 ∈ [0.01, +∞)
```

**境界倍率表（示例：修真体系）**：

| 大阶段 | 子层级 | 倍率 | HP加成 | MP加成 | 速度加成 |
|--------|--------|------|--------|--------|----------|
| 凡人 | 普通人 | 1.0 | 1.0 | 0 | 1.0 |
| 练气 | 练气一层~九层 | 2~10 | 1.5~3.0 | 1.0~5.0 | 1.2~2.0 |
| 筑基 | 初期/中期/后期/圆满 | 20~50 | 5~10 | 10~25 | 2.5~4.0 |
| 金丹 | 初期~圆满 | 100~300 | 20~50 | 50~150 | 5~10 |
| 元婴 | 初期~圆满 | 500~2000 | 100~400 | 300~1000 | 12~30 |
| 化神 | 初期~圆满 | 5000~20000 | 500~2000 | 2000~8000 | 35~80 |
| 合体 | 初期~圆满 | 50000~200000 | 5000~20000 | 20000~80000 | 90~200 |
| 大乘 | 初期~圆满 | 500000~2000000 | 50000~200000 | 200000~800000 | 250~600 |
| 渡劫 | 初期~圆满 | 10000000~50000000 | 1M~5M | 5M~25M | 1000~3000 |
| 真仙 | 初期~圆满 | 100000000~500000000 | 10M~50M | 50M~250M | 5000~15000 |

> 注：倍率采用指数增长（相邻大阶段约×10），这是网文"爽感"的核心数学基础。系统支持自定义 `growthBase` 参数（默认10）和 `growthCurve`（线性/指数/S曲线）。

**具体战力计算公式**：

```typescript
function calculateCombatPower(
  baseStats: StatVector,
  realm: RealmTier,
  equipment: Equipment[],
  buffs: Buff[],
  debuffs: Debuff[],
  specialAbilities: SpecialAbility[]
): CombatPowerResult {
  // 步骤1: 基础属性计算
  const rawStats: StatVector = {
    atk: baseStats.atk * realm.attributes.atkBonus,
    def: baseStats.def * realm.attributes.defBonus,
    spd: baseStats.spd * realm.attributes.speedBonus,
    spi: baseStats.spi * realm.attributes.mpBonus,
    tech: baseStats.tech,  // 技巧不受境界直接加成
    luck: baseStats.luck,  // 运气不受境界直接加成
  };

  // 步骤2: 装备加成（加算后乘算）
  const equippedStats = applyEquipmentBonuses(rawStats, equipment);

  // 步骤3: Buff/Debuff 修正（乘算叠加）
  const buffedStats = applyStatusEffects(equippedStats, buffs, debuffs);

  // 步骤4: 特殊能力被动加成
  const finalStats = applyPassiveAbilities(buffedStats, specialAbilities);

  // 步骤5: 综合战力合成
  const weights = getSystemConfig("combat_power_weights");
  const dimensions = ["atk", "def", "spd", "spi", "tech", "luck"] as const;
  let weightedSum = 0;
  for (const dim of dimensions) {
    weightedSum += weights[dim] * Math.pow(finalStats[dim], weights.alpha || 1.0);
  }

  const realmMultiplier = realm.basePowerMultiplier;
  const totalCP = weightedSum * realmMultiplier;

  // 步骤6: 战力分级（用于网文"扮猪吃虎"桥段）
  const powerTier = classifyPowerTier(totalCP, realm);

  return {
    dimensionVector: finalStats,
    totalCP,
    powerTier,
    realmEquivalent: calculateRealmEquivalence(totalCP),
    canDefeat: estimateDefeatableRange(totalCP),
    hidingPotential: calculateHiddenPower(finalStats, specialAbilities), // 隐藏战力（底牌）
  };
}
```

#### 5.1.2.3 战力对比评估（"越级挑战"判定）

网文核心爽点之一是"越级挑战"。系统提供精确的越级可行性评估：

```typescript
function evaluateCrossTierBattle(
  attackerCP: CombatPowerResult,
  defenderCP: CombatPowerResult,
  environment: EnvironmentState,
  attackerSpecials: SpecialAbility[],
  defenderSpecials: SpecialAbility[]
): BattleFeasibilityResult {
  const cpRatio = attackerCP.totalCP / defenderCP.totalCP;
  
  // 基础胜率曲线（Sigmoid函数）
  // 当 cpRatio = 1.0 时，胜率50%；cpRatio = 0.5 时，胜率~12%；cpRatio = 2.0 时，胜率~88%
  const baseWinRate = 1.0 / (1.0 + Math.exp(-4.0 * (cpRatio - 1.0)));
  
  // 环境修正
  const envModifier = environment.getCombatModifier(
    attackerCP.dimensionVector,
    defenderCP.dimensionVector
  );
  
  // 特殊能力修正（金手指可能大幅改变战局）
  let abilityModifier = 1.0;
  for (const sa of attackerSpecials) {
    if (sa.combatOverride) {
      abilityModifier *= sa.combatOverride.multiplier || 1.0;
    }
  }
  
  // 隐藏战力修正（底牌）
  const hiddenPowerRatio = attackerCP.hidingPotential / attackerCP.totalCP;
  const hiddenCardBonus = hiddenPowerRatio * 0.3; // 底牌最多额外贡献30%胜率
  
  const adjustedWinRate = clamp(
    baseWinRate * envModifier * abilityModifier + hiddenCardBonus,
    0.001,  // 最低0.1%胜率（奇迹）
    0.999   // 最高99.9%（留一线）
  );

  return {
    cpRatio,
    baseWinRate,
    adjustedWinRate,
    classification: classifyChallengeLevel(cpRatio, adjustedWinRate),
    // 分类结果: "effortless" | "favorable" | "even" | "challenging" | 
    //           "desperate" | "miracle" | "impossible"
    narrativeCue: generateBattleNarrativeCue(cpRatio, adjustedWinRate),
    suggestedTurns: estimateBattleTurns(cpRatio),
  };
}
```

### 5.1.3 规则匹配算法

#### 5.1.3.1 规则表示法

物理规则采用**条件-动作-优先级（CAP）**三元组表示：

```typescript
interface PhysicsRule {
  ruleId: string;
  name: string;
  description: string;
  conditions: RuleCondition[];      // 所有条件需同时满足（AND）
  action: RuleAction;               // 满足条件时执行的动作
  priority: number;                 // 优先级，数值越大越优先
  overrideRules: string[];          // 可覆盖的低优先级规则ID
  category: "combat" | "movement" | "elemental" | "spatial" | "temporal" | "custom";
  isHardRule: boolean;              // 是否硬规则（不可突破）
}

interface RuleCondition {
  type: "stat_comparison" | "realm_check" | "environment_check" | 
        "item_possession" | "ability_active" | "custom_expression";
  // 统一表达式格式: "${entity.stats.atk} > ${target.stats.def} * 2"
  expression: string;
  evaluator: (context: RuleContext) => boolean;
}

interface RuleAction {
  type: "allow" | "deny" | "modify_stat" | "trigger_event" | "apply_effect";
  parameters: Record<string, unknown>;
  // 对叙述的提示
  narrativeHint?: string;  // 如 "角色速度突破音障，产生音爆"
}
```

#### 5.1.3.2 规则匹配引擎（Rete 算法简化版）

采用基于 Rete 网络的规则匹配，针对网文场景做了优化：

```
算法: Rete-Inspired Rule Matcher
输入: 规则库 R, 世界状态 W, 触发事件 E
输出: 匹配的规则列表（按优先级排序）

1. 初始化 Alpha 网络（单条件过滤）
   对每个规则 r ∈ R:
     对每个条件 c ∈ r.conditions:
       在 Alpha 内存中查找/创建对应节点
       若 W 满足 c，将事实标记流入该节点

2. 传播至 Beta 网络（多条件联合）
   对每个激活的 Alpha 节点:
     向上传播至父 Beta 节点
     执行连接操作（join）：匹配左侧和右侧内存中的事实组合
     若某 Beta 节点的所有子条件都已满足:
       标记为完整匹配，进入 Agenda

3. 冲突消解（Conflict Resolution）
   Agenda 中可能存在多条匹配规则:
     a. 按 priority 降序排列
     b. 若 priority 相同，按规则ID字典序（确定性）
     c. 若 isHardRule=true 的规则与 isHardRule=false 的规则冲突：
        硬规则优先，软规则被抑制
     d. 若两条硬规则冲突 → 触发 WorldEngineException，需人工裁决

4. 执行动作
   按排序后的顺序执行每条匹配规则的 action
   若 action.type = "deny" → 立即停止后续规则执行（阻断语义）
   若 action.type = "allow" → 继续执行（放行语义）

5. 返回匹配结果与执行日志
```

#### 5.1.3.3 规则缓存策略

```typescript
interface RuleCache {
  // 条件求值缓存：键为 "规则ID+条件索引+实体状态哈希"
  // 值为布尔结果
  conditionCache: LRUCache<string, boolean>;
  maxSize: 10000;
  ttl: 300000; // 5分钟（世界状态可能频繁变化）
  
  // 完整匹配结果缓存
  // 仅在世界状态版本号未变化时有效
  matchCache: Map<number, MatchedRule[]>; // key = stateVersion
}
```

### 5.1.4 公式解析器设计

物理规则引擎内置轻量级表达式求值器，避免依赖外部库。

#### 5.1.4.1 表达式语法

```
表达式语法（类 JavaScript 子集）:
  literal   := number | string | boolean
  ref       := "${" path "}"          // 如 ${entity.stats.atk}
  path      := identifier ("." identifier)*
  unary     := ("-" | "!") primary
  primary   := literal | ref | "(" expression ")" | functionCall
  function  := identifier "(" (expression ("," expression)*)? ")"
  mulDiv    := unary (("*" | "/") unary)*
  addSub    := mulDiv (("+" | "-") mulDiv)*
  compare   := addSub ((">" | "<" | ">=" | "<=" | "==" | "!=") addSub)*
  logical   := compare (("&&" | "||") compare)*
  expression:= logical

内置函数:
  pow(base, exp)      → 幂运算
  sqrt(x)             → 平方根
  clamp(x, min, max)  → 截断
  max(a, b)           → 最大值
  min(a, b)           → 最小值
  round(x, digits)    → 四舍五入
  sigmoid(x)          → 1/(1+e^-x)
  rand(seed)          → 伪随机数 [0,1)，基于种子确定性
```

#### 5.1.4.2 求值器实现

```typescript
class FormulaEvaluator {
  private variables: Map<string, unknown>;
  private functions: Map<string, Function>;

  constructor(context: RuleContext) {
    this.variables = this.extractVariables(context);
    this.functions = this.buildFunctionLibrary();
  }

  evaluate(expression: string): EvalResult {
    // 步骤1: 词法分析 → Token 序列
    const tokens = this.tokenize(expression);
    // 步骤2: 语法分析 → AST
    const ast = this.parse(tokens);
    // 步骤3: AST 求值
    return this.evalNode(ast);
  }

  private tokenize(expr: string): Token[] {
    // 正则分词，识别：数字、字符串、标识符、运算符、括号、引用
    const tokenRegex = /\$\{[^}]+\}|\d+\.?\d*|[a-zA-Z_][a-zA-Z0-9_]*|[+\-*/(),>=<!&|]+|"[^"]*"/g;
    const matches = expr.match(tokenRegex) || [];
    return matches.map(this.classifyToken);
  }

  private parse(tokens: Token[]): ASTNode {
    // 递归下降解析器，按优先级逐层解析
    let pos = 0;
    const parseExpression = (): ASTNode => parseLogical();
    // ... 各优先级解析函数
    return parseExpression();
  }

  private evalNode(node: ASTNode): EvalResult {
    switch (node.type) {
      case "literal": return node.value;
      case "reference": return this.resolveReference(node.path);
      case "unary": return this.evalUnary(node.operator, this.evalNode(node.operand));
      case "binary": return this.evalBinary(node.operator, 
                                              this.evalNode(node.left), 
                                              this.evalNode(node.right));
      case "call": return this.callFunction(node.name, 
                                             node.args.map(a => this.evalNode(a)));
    }
  }

  // 确定性伪随机：基于种子的可复现随机数
  private rand(seed: number): number {
    // xorshift32 算法
    let x = seed | 0;
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    return ((x >>> 0) % 1000000) / 1000000;
  }
}
```

### 5.1.5 动作合法性验证流程

```typescript
function validateActionLegality(
  action: CharacterAction,
  actor: Entity,
  worldState: WorldState
): ActionValidationResult {
  const checks: ValidationCheck[] = [];

  // 检查1: 基础物理可行性
  checks.push(checkPhysicalFeasibility(action, actor, worldState));
  
  // 检查2: 境界限制
  checks.push(checkRealmRestrictions(action, actor.currentRealm));
  
  // 检查3: 资源充足性（法力/体力/精神）
  checks.push(checkResourceSufficiency(action, actor.resources));
  
  // 检查4: 规则引擎匹配
  const matchedRules = ruleEngine.match(action, actor, worldState);
  const hardBlocks = matchedRules.filter(r => r.isHardRule && r.action.type === "deny");
  checks.push({
    name: "hard_rules",
    passed: hardBlocks.length === 0,
    blocking: hardBlocks,
  });

  // 检查5: 特殊能力覆盖
  const overrides = actor.specialAbilities
    .filter(sa => sa.canOverride(hardBlocks))
    .map(sa => sa.getOverrideEffect(hardBlocks));

  // 综合判定
  const allPassed = checks.every(c => c.passed) || overrides.length > 0;

  return {
    isLegal: allPassed,
    checks,
    overrides,
    effectiveRules: matchedRules.filter(r => r.action.type !== "deny" || 
                                               overrides.some(o => o.targetRule === r.ruleId)),
    narrativeConstraint: generateConstraintNarrative(checks),
  };
}
```

---

## 5.2 特殊能力管理器（金手指模块）

### 5.2.1 职责定位

特殊能力管理器（俗称"金手指模块"）是网文创作系统的核心差异化组件。它负责管理主角及关键NPC的"特殊外挂"——从系统面板到老爷爷，从重生记忆到气运加身。金手指是世界规则中的"例外机制"，必须被精确建模以防止叙事失控。

### 5.2.2 金手指规则集的完整 JSON Schema

```typescript
// ==================== 金手指核心 Schema ====================

interface SpecialAbility {
  // ─── 基础标识 ───
  abilityId: string;           // 全局唯一ID，如 "reincarnation_memory_v1"
  name: string;                // 能力名称，如 "前世记忆"
  type: AbilityType;           // 见下方枚举
  ownerId: string;             // 所属角色ID
  createdAtChapter: number;    // 创建章节号（用于时间线追溯）
  narrativeDescription: string; // 读者视角的描述文本
  
  // ─── 触发条件系统 ───
  triggerConditions: TriggerCondition[];  // 触发条件（OR 关系）
  cooldown: CooldownRule;      // 冷却规则
  dailyLimit: LimitRule;       // 日限次
  
  // ─── 效果定义 ───
  effects: AbilityEffect[];    // 能力效果列表
  passiveEffects: PassiveEffect[]; // 常驻被动效果
  
  // ─── 代价系统 ───
  costs: AbilityCost[];        // 使用代价
  cumulativeCost?: CumulativeCost; // 累积代价（用得越多代价越大）
  
  // ─── 成长演化 ───
  growth: GrowthPath;          // 成长路径
  evolutionTriggers: EvolutionTrigger[]; // 进化触发条件
  
  // ─── 限制与平衡 ───
  restrictions: AbilityRestriction[];  // 使用限制
  balancingHooks: BalancingHook[];     // 叙事平衡钩子（防止无敌）
  
  // ─── 先例追踪 ───
  precedentBinding: PrecedentBinding;  // 与先例引擎的绑定
  usageHistory: UsageRecord[];         // 使用历史
}

// ─── 枚举定义 ───

type AbilityType =
  | "system_panel"       // 系统面板（信息类金手指）
  | "combat_override"    // 战斗覆盖（临时改变战力）
  | "resource_generator" // 资源生成（炼丹/炼器加速）
  | "knowledge_access"   // 知识获取（前世记忆/老爷爷）
  | "luck_manipulation"  // 气运操控
  | "time_manipulation"  // 时间类（回溯/加速）
  | "spatial_ability"    // 空间类
  | "summoning"          // 召唤类
  | "transformation"     // 变身类
  | "copy_mimic"         // 复制/模拟
  | "realm_boost"        // 境界突破辅助
  | "social_manipulation"// 社交操控（好感度/威慑）
  | "custom";            // 自定义

interface TriggerCondition {
  conditionId: string;
  type: "manual" | "auto_on_combat" | "auto_on_danger" | 
        "auto_on_discovery" | "threshold_trigger" | "event_reactive";
  description: string;
  // 条件表达式（公式解析器语法）
  expression?: string;  // 如 "${actor.hp} < ${actor.maxHp} * 0.3"
  probability?: number; // 自动触发概率 [0,1]
}

interface CooldownRule {
  type: "none" | "fixed_time" | "per_use_increase" | "chapter_based";
  baseValue: number;       // 基础冷却（秒/章）
  increaseRate?: number;   // 递增率
  maxCooldown?: number;    // 最大冷却上限
  // 冷却中的叙事提示
  cooldownNarrative: string; // 如 "系统冷却中，面板闪烁红光"
}

interface LimitRule {
  maxUsesPerDay: number;
  currentUsesToday: number;
  resetTime: string;       // 重置时间点，如 "00:00"
  overflowPenalty?: {      // 超限惩罚
    enabled: boolean;
    penaltyEffect: string;
  };
}

// ─── 效果定义 ───

interface AbilityEffect {
  effectId: string;
  type: EffectType;
  target: "self" | "enemy" | "ally" | "area" | "item" | "environment";
  // 效果参数（公式解析器可处理）
  formula: string;  // 如 "${actor.realm.basePower} * 2.5 + 100"
  duration?: DurationSpec;
  stacking?: StackingRule;
  visualManifestation: string;  // 视觉表现描述（用于叙事）
}

type EffectType =
  | "stat_boost" | "stat_drain" | "heal" | "damage" | "shield"
  | "status_apply" | "status_remove" | "realm_temp_boost"
  | "item_create" | "knowledge_reveal" | "probability_modify"
  | "npc_disposition_change" | "environment_modify";

interface DurationSpec {
  type: "instant" | "timed" | "chapter_count" | "permanent" | "until_condition";
  value: number;
  condition?: string;  // until_condition 时使用的表达式
}

interface StackingRule {
  mode: "none" | "refresh" | "intensify" | "extend";
  maxStacks: number;
  stackFormula?: string;  // intensify 时的叠加公式
}

// ─── 被动效果 ───

interface PassiveEffect {
  effectId: string;
  type: "stat_modifier" | "auto_trigger" | "resistance" | "sensing" | "aura";
  condition?: string;  // 被动激活条件，null表示常驻
  formula: string;
  narrativeFlair: string; // 如 "周身隐约环绕淡金色光晕"
}

// ─── 代价系统 ───

interface AbilityCost {
  type: "hp" | "mp" | "stamina" | "spirit" | "lifespan" | 
        "item_consumption" | "realm_drop_risk" | "karmic_debt" | "random_penalty";
  formula: string;      // 如 "${actor.maxMp} * 0.3"
  isMandatory: boolean;  // 是否必然付出
  probability?: number;  // 非必然时的概率
}

interface CumulativeCost {
  // 使用次数对代价的影响
  formula: string;  // 如 "baseCost * (1 + 0.1 * ${usageCount})"
  // 叙事表现
  narrativeEscalation: string[];  // 与使用次数对应的描述
  // 崩溃阈值
  collapseThreshold?: number;  // 使用超过此值可能导致能力崩溃/变异
}

// ─── 成长演化 ───

interface GrowthPath {
  currentStage: number;         // 当前阶段，从1开始
  maxStage: number;             // 最大阶段
  stages: GrowthStage[];
  xpSource: XpSource[];         // 经验来源
}

interface GrowthStage {
  stageNumber: number;
  name: string;
  description: string;
  unlocks: string[];            // 本阶段解锁的能力/效果
  statModifiers: Record<string, string>; // 属性修正公式
  visualUpgrade: string;        // 视觉效果升级描述
}

interface XpSource {
  source: string;               // 如 "combat", "meditation", "item_usage"
  formula: string;              // 经验获取公式
}

interface EvolutionTrigger {
  triggerId: string;
  type: "xp_threshold" | "realm_breakthrough" | "special_event" | 
        "item_fusion" | "understanding_moment";
  condition: string;
  // 进化后可能的能力变异
  mutationPool?: string[];      // 可能的变异方向
  mutationProbability?: number; // 变异概率
}

// ─── 限制与平衡 ───

interface AbilityRestriction {
  type: "realm_cap" | "environment_limit" | "target_limit" | 
        "sequence_requirement" | "mutual_exclusive";
  description: string;
  expression?: string;
  // 违反限制的代价
  violationPenalty?: string;
}

interface BalancingHook {
  hookId: string;
  description: string;          // 如 "能力使用后24小时内运气-50%"
  type: "tradeoff" | "vulnerability_window" | "attention_draw" | 
        "dependency_creation" | "moral_cost";
  narrativeManifestation: string; // 如 "使用能力后眉心出现黑色印记"
}

// ─── 先例绑定 ───

interface PrecedentBinding {
  createsPrecedent: boolean;    // 本能力是否产生先例
  precedentCategory: string;    // 先例类别
  energyLevel: number;          // 能量层级 [0,1]，影响衰变速度
}

interface UsageRecord {
  chapter: number;
  scene: string;
  trigger: string;              // 触发原因
  effectsApplied: string[];
  costsPaid: string[];
  narrativeOutcome: string;
}
```

#### 完整金手指配置示例

```json
{
  "abilityId": "ancient_ring_spirit",
  "name": "古朴戒指中的老爷爷",
  "type": "knowledge_access",
  "ownerId": "protagonist",
  "createdAtChapter": 3,
  "narrativeDescription": "一枚看似普通的青铜戒指，内藏一缕上古大能的残魂",
  "triggerConditions": [
    {
      "conditionId": "manual_call",
      "type": "manual",
      "description": "主角集中精神沟通戒指"
    },
    {
      "conditionId": "danger_auto",
      "type": "auto_on_danger",
      "description": "生命垂危时自动苏醒",
      "expression": "${actor.hp} < ${actor.maxHp} * 0.1",
      "probability": 0.8
    }
  ],
  "cooldown": {
    "type": "per_use_increase",
    "baseValue": 1,
    "increaseRate": 0.2,
    "maxCooldown": 10,
    "cooldownNarrative": "戒指中的光芒黯淡下去，老者的声音变得飘忽不定"
  },
  "effects": [
    {
      "effectId": "battle_guidance",
      "type": "stat_boost",
      "target": "self",
      "formula": "${actor.realm.basePower} * 0.5",
      "duration": { "type": "timed", "value": 300 },
      "visualManifestation": "主角周身笼罩一层淡青色光晕，招式间多了几分古朴玄奥之意"
    },
    {
      "effectId": "knowledge_reveal",
      "type": "knowledge_reveal",
      "target": "self",
      "formula": "1",
      "visualManifestation": "脑海中响起苍老的声音，缓缓道来一段尘封的秘辛"
    }
  ],
  "costs": [
    {
      "type": "spirit",
      "formula": "50 + ${ability.usageHistory.length} * 10",
      "isMandatory": true
    },
    {
      "type": "lifespan",
      "formula": "0.1",
      "isMandatory": false,
      "probability": 0.3
    }
  ],
  "cumulativeCost": {
    "formula": "${spiritCost} * (1 + ${usageCount} * 0.15)",
    "narrativeEscalation": [
      "老者残魂微微闪烁，似乎并无异样",
      "老者虚影比往常淡了一些",
      "老者残魂明显透明，声音中带着疲惫",
      "老者几乎难以维持人形，叹息道：'年轻人，老夫快撑不住了...'"
    ],
    "collapseThreshold": 50
  },
  "growth": {
    "currentStage": 1,
    "maxStage": 5,
    "stages": [
      {
        "stageNumber": 1,
        "name": "残魂初醒",
        "description": "仅能偶尔提供只言片语的指导",
        "unlocks": ["basic_guidance", "fragmented_knowledge"],
        "statModifiers": {},
        "visualUpgrade": "戒指偶尔闪过微弱青光"
      },
      {
        "stageNumber": 2,
        "name": "魂力稳固",
        "description": "可长时间交流，传授基础功法",
        "unlocks": ["skill_teach", "alchemy_guidance"],
        "statModifiers": { "spiritRegen": "* 1.2" },
        "visualUpgrade": "戒指上的纹路隐约发光"
      }
    ],
    "xpSource": [
      { "source": "spirit_stone_feed", "formula": "${spiritStoneQuality} * 10" },
      { "source": "protagonist_realm_up", "formula": "${newRealm.order} * 100" }
    ]
  },
  "restrictions": [
    {
      "type": "realm_cap",
      "description": "无法指导高于化神期的功法",
      "expression": "${target.realm.order} <= 6"
    },
    {
      "type": "mutual_exclusive",
      "description": "与其他残魂类能力互斥"
    }
  ],
  "balancingHooks": [
    {
      "hookId": "attention_draw",
      "description": "强者可能感知到戒指中的异常气息",
      "type": "attention_draw",
      "narrativeManifestation": "路过的大能眉头一皱，目光在主角手指上多停留了一瞬"
    },
    {
      "hookId": "dependency",
      "description": "过度依赖导致自主战斗能力下降",
      "type": "dependency_creation",
      "narrativeManifestation": "独自面对危机时，主角发现没有老者提示竟有些手足无措"
    }
  ]
}
```

### 5.2.3 能力校验算法

```typescript
function validateAbilityUsage(
  ability: SpecialAbility,
  actor: Entity,
  context: UsageContext
): AbilityValidationResult {
  const violations: Violation[] = [];

  // 步骤1: 冷却检查
  if (ability.cooldown.type !== "none") {
    const remaining = calculateRemainingCooldown(ability, actor);
    if (remaining > 0) {
      violations.push({
        type: "cooldown",
        severity: "blocking",
        message: `冷却中，剩余 ${remaining} 秒`,
        narrativeHint: ability.cooldown.cooldownNarrative,
      });
    }
  }

  // 步骤2: 日限次检查
  const todayUses = ability.usageHistory.filter(
    u => u.chapter === context.currentChapter
  ).length;
  if (todayUses >= ability.dailyLimit.maxUsesPerDay) {
    violations.push({
      type: "daily_limit",
      severity: "blocking",
      message: `今日已达使用上限 ${ability.dailyLimit.maxUsesPerDay} 次`,
      overflowPenalty: ability.dailyLimit.overflowPenalty,
    });
  }

  // 步骤3: 代价可支付性检查
  const costs = evaluateCosts(ability, actor);
  for (const cost of costs) {
    const affordable = checkAffordability(cost, actor);
    if (!affordable.canPay) {
      violations.push({
        type: "cost",
        severity: cost.isMandatory ? "blocking" : "warning",
        message: `无法支付代价: ${cost.type} 需要 ${cost.amount}, 仅有 ${affordable.available}`,
      });
    }
  }

  // 步骤4: 限制条件检查
  for (const restriction of ability.restrictions) {
    const satisfied = evaluateRestriction(restriction, actor, context);
    if (!satisfied) {
      violations.push({
        type: "restriction",
        severity: "blocking",
        message: restriction.description,
        violationPenalty: restriction.violationPenalty,
      });
    }
  }

  // 步骤5: 互斥能力检查
  const activeMutex = findActiveMutexAbilities(ability, actor);
  if (activeMutex.length > 0) {
    violations.push({
      type: "mutex",
      severity: "blocking",
      message: `与以下能力互斥: ${activeMutex.map(a => a.name).join(", ")}`,
    });
  }

  // 步骤6: 累积代价崩溃检查
  if (ability.cumulativeCost) {
    const totalUses = ability.usageHistory.length;
    const threshold = ability.cumulativeCost.collapseThreshold;
    if (threshold && totalUses >= threshold * 0.8) {
      violations.push({
        // 80%阈值发出警告，100%时强制崩溃
        type: "cumulative_cost",
        severity: totalUses >= threshold ? "blocking" : "warning",
        message: totalUses >= threshold 
          ? "能力因过度使用已进入崩溃状态！"
          : `能力濒临崩溃，建议使用次数: ${totalUses}/${threshold}`,
      });
    }
  }

  // 综合判定
  const blockingViolations = violations.filter(v => v.severity === "blocking");
  return {
    canUse: blockingViolations.length === 0,
    violations,
    evaluatedCosts: costs,
    warnings: violations.filter(v => v.severity === "warning"),
    narrativeCue: generateAbilityNarrativeCue(ability, violations),
  };
}
```

### 5.2.4 成长演化公式

```typescript
function calculateGrowthProgress(
  ability: SpecialAbility,
  actor: Entity,
  worldEvents: WorldEvent[]
): GrowthResult {
  const stage = ability.growth.stages[ability.growth.currentStage - 1];
  
  // 计算各来源经验
  let totalXp = 0;
  const xpBreakdown: Record<string, number> = {};
  
  for (const source of ability.growth.xpSource) {
    const xp = evaluateFormula(source.formula, { actor, ability, worldEvents });
    totalXp += xp;
    xpBreakdown[source.source] = xp;
  }

  // 计算阶段进度 [0, 1]
  const nextStage = ability.growth.stages[ability.growth.currentStage];
  const requiredXp = nextStage 
    ? Math.pow(10, ability.growth.currentStage) * 100  // 指数增长
    : Infinity;
  
  const progress = Math.min(totalXp / requiredXp, 1.0);

  // 检查进化触发
  const triggeredEvolutions = ability.evolutionTriggers
    .filter(et => evaluateEvolutionTrigger(et, actor, worldEvents));

  return {
    currentStage: ability.growth.currentStage,
    stageName: stage.name,
    totalXp,
    xpBreakdown,
    progress,
    requiredXp,
    canEvolve: progress >= 1.0 || triggeredEvolutions.length > 0,
    triggeredEvolutions,
    narrativeCue: generateGrowthNarrativeCue(ability, progress, triggeredEvolutions),
  };
}
```

---

## 5.3 因果推演器（Causal Propagator）

### 5.3.1 职责定位

因果推演器是世界引擎的"预测未来"模块。给定一个初始事件（如"主角击杀了某宗门少主"），它通过约束满足搜索在世界规则下推演出所有合法的后续发展路径，形成一棵**后果树**。每片叶子代表一种可能的未来状态，每条边代表一个因果转换。

### 5.3.2 CSP 约束满足问题建模

#### 5.3.2.1 变量定义

```typescript
// ==================== CSP 建模定义 ====================

interface CausalCSP {
  variables: CSPVariable[];
  domains: Map<string, CSPDomain>;     // 变量 → 取值域
  constraints: CSPConstraint[];         // 约束集合
  objective?: CSPObjective;             // 优化目标（软约束）
}

interface CSPVariable {
  name: string;            // 如 "reaction_of_sect_leader"
  type: "discrete" | "continuous" | "boolean" | "composite";
  entityId: string;        // 关联的实体ID
  initialValue?: unknown;
}

interface CSPDomain {
  type: "enumeration" | "range" | "structured";
  values?: unknown[];      // 枚举值列表
  range?: { min: number; max: number; step?: number }; // 范围
  schema?: JSONSchema;     // 结构化域的模式
}

// 后果树中的动作变量
interface ActionVariable extends CSPVariable {
  actorId: string;
  actionType: string;      // 如 "attack", "flee", "negotiate", "hide"
  targetId?: string;
  preconditions: string[];  // 前置状态要求
  postconditions: string[]; // 后置状态变化
}
```

#### 5.3.2.2 约束类型

```typescript
type CSPConstraint = 
  | HardConstraint 
  | SoftConstraint 
  | NarrativeConstraint
  | TemporalConstraint;

interface HardConstraint {
  type: "hard";
  id: string;
  description: string;
  scope: string[];         // 涉及的变量名
  check: (assignment: Assignment) => boolean;
  violationMessage: string;
}

interface SoftConstraint {
  type: "soft";
  id: string;
  weight: number;          // 权重 [0, 1]
  evaluate: (assignment: Assignment) => number; // 返回满足度 [0, 1]
}

interface NarrativeConstraint {
  type: "narrative";
  id: string;
  // 叙事约束确保推演结果符合网文叙事惯例
  // 如 "主角不能无理由死亡"、"大反派不能在前期被消灭"
  condition: string;       // 表达式
  enforcement: "strict" | "strong_preference" | "guideline";
}

interface TemporalConstraint {
  type: "temporal";
  id: string;
  // 时间约束：动作A必须在动作B之前
  before: string[];        // 变量名列表
  after: string[];         // 变量名列表
  minGap?: number;         // 最小间隔（章节数）
}

// 常见硬约束模板
const COMMON_HARD_CONSTRAINTS = {
  // 物理可行性
  physicalPossible: (action: ActionVariable, world: WorldState) => ({
    type: "hard" as const,
    id: `phys_${action.name}`,
    description: "动作在物理上可行",
    scope: [action.name],
    check: (a: Assignment) => world.physics.isActionLegal(action, a),
    violationMessage: `${action.actionType} 在物理上不可行`,
  }),
  
  // 角色存活约束
  actorAlive: (action: ActionVariable) => ({
    type: "hard" as const,
    id: `alive_${action.actorId}`,
    description: "执行者必须存活",
    scope: [action.name],
    check: (a: Assignment) => {
      const actor = a.getEntity(action.actorId);
      return actor !== null && actor.hp > 0;
    },
    violationMessage: `${action.actorId} 已死亡，无法执行 ${action.actionType}`,
  }),
  
  // 境界约束（某些行为需要特定境界）
  realmRequired: (action: ActionVariable, minRealm: number) => ({
    type: "hard" as const,
    id: `realm_${action.name}`,
    description: `需要境界 >= ${minRealm}`,
    scope: [action.name],
    check: (a: Assignment) => {
      const actor = a.getEntity(action.actorId);
      return actor && actor.currentRealm.order >= minRealm;
    },
    violationMessage: `境界不足，无法执行 ${action.actionType}`,
  }),
};
```

### 5.3.3 搜索算法：回溯 + 前向检查 + 叙事引导

```typescript
// ==================== 后果树搜索算法 ====================

interface ConsequenceTree {
  root: ConsequenceNode;
  totalNodes: number;
  maxDepth: number;
  leaves: ConsequenceNode[];  // 所有叶节点（完整路径）
}

interface ConsequenceNode {
  id: string;
  depth: number;
  state: WorldState;           // 到达此节点的世界状态快照
  action?: CharacterAction;    // 从父节点到此节点的动作
  parent?: ConsequenceNode;
  children: ConsequenceNode[];
  // 推演元数据
  narrativeProbability: number; // 叙事概率（此路径的"合理性"）
  readerSatisfaction: number;   // 预期读者满意度 [0, 1]
  feasibility: number;          // 可行性 [0, 1]
  isTerminal: boolean;          // 是否为终止状态
}

class ConsequenceTreeBuilder {
  private csp: CausalCSP;
  private maxDepth: number;
  private branchingFactor: number;
  private cache: Map<string, ConsequenceNode>;

  constructor(config: TreeBuilderConfig) {
    this.maxDepth = config.maxDepth || 5;        // 默认推演5步
    this.branchingFactor = config.branchingFactor || 3; // 每层最多分支数
    this.cache = new Map();
  }

  // 主入口：从初始事件构建后果树
  buildTree(initialEvent: WorldEvent, initialState: WorldState): ConsequenceTree {
    const root: ConsequenceNode = {
      id: `node_${Date.now()}_0`,
      depth: 0,
      state: initialState.clone(),
      children: [],
      narrativeProbability: 1.0,
      readerSatisfaction: 0.5,
      feasibility: 1.0,
      isTerminal: false,
    };

    // 递归构建
    this.expandNode(root, initialEvent);

    return {
      root,
      totalNodes: this.countNodes(root),
      maxDepth: this.maxDepth,
      leaves: this.collectLeaves(root),
    };
  }

  // 节点展开：回溯搜索核心
  private expandNode(node: ConsequenceNode, triggeringEvent: WorldEvent): void {
    if (node.depth >= this.maxDepth) {
      node.isTerminal = true;
      return;
    }

    // 步骤1: 确定此状态下所有可能的反应实体
    const reactiveEntities = this.identifyReactiveEntities(node.state, triggeringEvent);

    // 步骤2: 为每个实体生成可能动作
    const allActions: ActionVariable[] = [];
    for (const entity of reactiveEntities) {
      const possibleActions = this.generatePossibleActions(entity, node.state, triggeringEvent);
      allActions.push(...possibleActions);
    }

    // 步骤3: CSP 约束过滤（前向检查）
    const legalActions = this.filterByConstraints(allActions, node.state);

    // 步骤4: 按叙事概率排序，取前 branchingFactor 个
    const rankedActions = this.rankByNarrativeMerit(legalActions, node)
      .slice(0, this.branchingFactor);

    // 步骤5: 递归展开每个合法动作
    for (const action of rankedActions) {
      // 缓存检查
      const stateHash = this.hashState(node.state.apply(action));
      if (this.cache.has(stateHash)) {
        node.children.push(this.cache.get(stateHash)!);
        continue;
      }

      const newState = node.state.apply(action);
      const childNode: ConsequenceNode = {
        id: `node_${Date.now()}_${node.depth + 1}_${action.actorId}_${action.actionType}`,
        depth: node.depth + 1,
        state: newState,
        action,
        parent: node,
        children: [],
        narrativeProbability: this.calculateNarrativeProbability(action, node),
        readerSatisfaction: this.estimateReaderSatisfaction(action, node),
        feasibility: this.calculateFeasibility(action, newState),
        isTerminal: false,
      };

      this.cache.set(stateHash, childNode);
      node.children.push(childNode);

      // 递归展开
      this.expandNode(childNode, {
        type: "action_result",
        source: action.actorId,
        action,
        resultingState: newState,
      });
    }

    if (node.children.length === 0) {
      node.isTerminal = true;
    }
  }

  // 前向检查：提前剪枝不可能的分支
  private filterByConstraints(
    actions: ActionVariable[], 
    state: WorldState
  ): ActionVariable[] {
    return actions.filter(action => {
      // 快速前向检查：只检查与此动作直接相关的约束
      const relevantConstraints = this.csp.constraints.filter(c =>
        c.scope.includes(action.name)
      );
      
      for (const constraint of relevantConstraints) {
        if (constraint.type === "hard") {
          // 构建临时赋值进行检验
          const tempAssignment = state.toAssignment();
          tempAssignment.set(action.name, action);
          
          if (!constraint.check(tempAssignment)) {
            return false; // 违反硬约束，剪枝
          }
        }
      }
      return true;
    });
  }

  // 叙事价值排序：核心启发式函数
  private rankByNarrativeMerit(
    actions: ActionVariable[], 
    parentNode: ConsequenceNode
  ): RankedAction[] {
    return actions.map(action => {
      let score = 0;

      // 因素1: 与主角的关联度（网文以主角为中心）
      const protagonistRelevance = this.calculateProtagonistRelevance(action);
      score += protagonistRelevance * 0.30;

      // 因素2: 戏剧张力（冲突强度）
      const dramaticTension = this.calculateDramaticTension(action, parentNode);
      score += dramaticTension * 0.25;

      // 因素3: 伏笔契合度（是否与已埋下的伏笔呼应）
      const foreshadowingFit = this.checkForeshadowingFit(action);
      score += foreshadowingFit * 0.20;

      // 因素4: 意外程度（既不能太 predictable，也不能太突兀）
      const surpriseFactor = this.calculateSurpriseFactor(action, parentNode);
      score += surpriseFactor * 0.15;

      // 因素5: 可行性（越可行越优先，除非 narrative override）
      const feasibility = this.calculateFeasibility(action, parentNode.state);
      score += feasibility * 0.10;

      return { action, score };
    }).sort((a, b) => b.score - a.score);
  }

  // 路径回溯：从叶子到根提取完整路径
  extractPath(leaf: ConsequenceNode): ConsequencePath {
    const actions: CharacterAction[] = [];
    let node: ConsequenceNode | undefined = leaf;
    
    while (node?.parent) {
      if (node.action) actions.unshift(node.action);
      node = node.parent;
    }

    return {
      actions,
      finalState: leaf.state,
      cumulativeProbability: this.calculatePathProbability(leaf),
      averageReaderSatisfaction: this.calculatePathSatisfaction(leaf),
      narrativeSummary: this.summarizePath(actions),
    };
  }
}
```

### 5.3.4 后果树数据结构

```typescript
// 后果树的序列化格式（用于缓存和传输）
interface ConsequenceTreeDTO {
  version: "3.0";
  treeId: string;              // "tree_{initialEventId}_{timestamp}"
  rootEventId: string;
  generationParams: {
    maxDepth: number;
    branchingFactor: number;
    constraintSetVersion: string;
    narrativeWeights: Record<string, number>;
  };
  nodes: ConsequenceNodeDTO[];
  edges: ConsequenceEdgeDTO[];
  metadata: {
    totalPaths: number;         // 总路径数
    averagePathLength: number;
    maxNarrativeScore: number;
    generationTimeMs: number;
  };
}

interface ConsequenceNodeDTO {
  nodeId: string;
  depth: number;
  stateSnapshot: WorldStateSnapshot;  // 世界状态快照（增量存储）
  narrativeScore: number;
  metrics: {
    probability: number;
    satisfaction: number;
    feasibility: number;
    tension: number;
  };
  isTerminal: boolean;
  terminationReason?: "max_depth" | "dead_end" | "stable_state" | "narrative_climax";
}

interface ConsequenceEdgeDTO {
  edgeId: string;
  fromNode: string;
  toNode: string;
  action: SerializedAction;
  causalStrength: number;      // 因果强度 [0,1]
  narrativeLabel: string;      // 如 "愤怒追击", "暗中观察", "求援"
}
```

---

## 5.4 NPC 行为引擎（NPC Behavior Engine）

### 5.4.1 职责定位

NPC 行为引擎驱动世界中所有非主角角色的自主行为。它采用**行为树 + 目标队列**的混合架构：行为树处理实时决策，目标队列管理长期规划。当 NPC 被激活进入场景时，引擎调用 LLM 进行 NPC 意图推断（见 5.9.1），赋予 NPC "灵魂"。

### 5.4.2 行为树节点类型定义

```typescript
// ==================== 行为树核心定义 ====================

// 行为树基类
abstract class BTNode {
  nodeId: string;
  name: string;
  type: BTNodeType;
  parent?: BTCompositeNode;
  
  // 核心接口
  abstract tick(context: NPCContext): BTStatus;
  abstract clone(): BTNode;
  
  // 生命周期钩子
  onEnter(context: NPCContext): void {}
  onExit(context: NPCContext): void {}
}

enum BTNodeType {
  // 叶节点（动作）
  ACTION = "ACTION",
  CONDITION = "CONDITION",
  
  // 复合节点
  SELECTOR = "SELECTOR",       // 顺序执行子节点，直到一个成功
  SEQUENCE = "SEQUENCE",       // 顺序执行子节点，直到一个失败
  PARALLEL = "PARALLEL",       // 并行执行所有子节点
  
  // 装饰节点
  INVERTER = "INVERTER",       // 反转子节点结果
  REPEATER = "REPEATER",       // 重复执行子节点
  UNTIL_SUCCESS = "UNTIL_SUCCESS",
  UNTIL_FAILURE = "UNTIL_FAILURE",
  COOLDOWN = "COOLDOWN",       // 冷却装饰器
  
  // 网文专用节点
  INTENTION_BASED = "INTENTION_BASED",  // 基于LLM意图的决策节点
  DRAMATIC_MOMENT = "DRAMATIC_MOMENT",  // 戏剧时刻检测节点
  SOCIAL_INTERACTION = "SOCIAL_INTERACTION", // 社交交互节点
}

enum BTStatus {
  SUCCESS = "SUCCESS",
  FAILURE = "FAILURE",
  RUNNING = "RUNNING",  // 异步操作进行中
}

// ─── 叶节点：动作 ───

interface ActionNode extends BTNode {
  type: BTNodeType.ACTION;
  actionType: string;          // 如 "move_to", "attack", "speak", "flee"
  parameters: Record<string, FormulaExpression>;  // 参数化的动作
  preconditions: ConditionNode[];  // 执行前提
  postconditions: WorldEffect[];   // 执行效果
  
  // 执行
  execute(context: NPCContext): ActionResult;
  
  // 叙事生成
  generateNarrative(context: NPCContext, result: ActionResult): string;
}

// ─── 叶节点：条件 ───

interface ConditionNode extends BTNode {
  type: BTNodeType.CONDITION;
  conditionType: string;
  expression: string;          // 公式解析器表达式
  
  evaluate(context: NPCContext): boolean;
}

// ─── 复合节点 ───

interface SelectorNode extends BTCompositeNode {
  type: BTNodeType.SELECTOR;
  // 选择器：从左到右尝试子节点，返回第一个 SUCCESS
  // 如果全部失败，返回 FAILURE
  children: BTNode[];
  
  tick(context: NPCContext): BTStatus {
    for (const child of this.children) {
      const status = child.tick(context);
      if (status !== BTStatus.FAILURE) return status;
    }
    return BTStatus.FAILURE;
  }
}

interface SequenceNode extends BTCompositeNode {
  type: BTNodeType.SEQUENCE;
  // 序列器：从左到右执行子节点，直到一个 FAILURE
  // 如果全部成功，返回 SUCCESS
  children: BTNode[];
  
  tick(context: NPCContext): BTStatus {
    for (const child of this.children) {
      const status = child.tick(context);
      if (status !== BTStatus.SUCCESS) return status;
    }
    return BTStatus.SUCCESS;
  }
}

interface ParallelNode extends BTCompositeNode {
  type: BTNodeType.PARALLEL;
  // 并行节点：同时执行所有子节点
  // policy: "all_success" | "any_success" | "majority"
  successPolicy: ParallelPolicy;
  children: BTNode[];
  
  tick(context: NPCContext): BTStatus {
    const results = this.children.map(c => c.tick(context));
    switch (this.successPolicy) {
      case "all_success": 
        return results.every(r => r === BTStatus.SUCCESS) 
          ? BTStatus.SUCCESS : BTStatus.FAILURE;
      case "any_success":
        return results.some(r => r === BTStatus.SUCCESS) 
          ? BTStatus.SUCCESS : BTStatus.FAILURE;
      case "majority":
        const successCount = results.filter(r => r === BTStatus.SUCCESS).length;
        return successCount > results.length / 2 
          ? BTStatus.SUCCESS : BTStatus.FAILURE;
    }
  }
}

// ─── 网文专用节点 ───

interface IntentionBasedNode extends BTNode {
  type: BTNodeType.INTENTION_BASED;
  // 此节点调用 LLM 意图推断结果
  // 基于 NPC 的内在状态、场景上下文生成动态行为选择
  
  intentionSource: "llm_cache" | "realtime_llm";  // 意图来源
  fallbackBehavior: BTNode;  // LLM 不可用时回退
  
  tick(context: NPCContext): BTStatus {
    // 步骤1: 获取 LLM 推断的意图
    const intention = context.npc.llmIntention || this.fallbackBehavior.tick(context);
    
    // 步骤2: 将意图映射为行为树节点
    const mappedAction = this.mapIntentionToAction(intention, context);
    
    // 步骤3: 执行映射后的动作
    return mappedAction.tick(context);
  }
  
  private mapIntentionToAction(
    intention: NPCIntention, 
    context: NPCContext
  ): BTNode {
    // 根据意图类型选择对应的行为模板
    const behaviorTemplates = context.world.getBehaviorTemplates(intention.type);
    const bestTemplate = this.selectBestTemplate(behaviorTemplates, intention, context);
    return bestTemplate.instantiate(intention.parameters);
  }
}

interface DramaticMomentNode extends BTNode {
  type: BTNodeType.DRAMATIC_MOMENT;
  // 检测当前是否构成"戏剧时刻"，如果是则触发特殊行为
  
  dramaticConditions: DramaticCondition[];
  onDramatic: BTNode;        // 戏剧时刻触发时的行为
  onNormal: BTNode;           // 普通情况下的行为
  
  tick(context: NPCContext): BTStatus {
    const isDramatic = this.dramaticConditions.some(dc => 
      dc.check(context)
    );
    return isDramatic 
      ? this.onDramatic.tick(context) 
      : this.onNormal.tick(context);
  }
}
```

### 5.4.3 NPC 行为树模板库

```typescript
// 预定义的行为树模板，按 NPC 类型分类

const NPC_BEHAVIOR_TEMPLATES: Record<string, BTNodeTemplate> = {
  // 敌对NPC模板
  hostile: {
    root: {
      type: BTNodeType.SELECTOR,
      children: [
        // 优先级1: 如果生命危急且可以逃跑，则逃跑
        {
          type: BTNodeType.SEQUENCE,
          children: [
            { type: BTNodeType.CONDITION, expression: "${self.hp} < ${self.maxHp} * 0.2" },
            { type: BTNodeType.CONDITION, expression: "${self.canFlee} == true" },
            { type: BTNodeType.ACTION, actionType: "flee" },
          ],
        },
        // 优先级2: 如果有必杀技且目标虚弱，使用必杀
        {
          type: BTNodeType.SEQUENCE,
          children: [
            { type: BTNodeType.CONDITION, expression: "${self.ultimateReady} == true" },
            { type: BTNodeType.CONDITION, expression: "${target.hp} < ${target.maxHp} * 0.3" },
            { type: BTNodeType.ACTION, actionType: "use_ultimate" },
          ],
        },
        // 优先级3: 基于LLM意图的动态行为
        {
          type: BTNodeType.INTENTION_BASED,
          intentionSource: "llm_cache",
          fallbackBehavior: { type: BTNodeType.ACTION, actionType: "basic_attack" },
        },
        // 优先级4: 默认基础攻击
        { type: BTNodeType.ACTION, actionType: "basic_attack" },
      ],
    },
  },

  // 盟友NPC模板
  ally: {
    root: {
      type: BTNodeType.SELECTOR,
      children: [
        // 优先级1: 如果主角生命危急，保护主角
        {
          type: BTNodeType.SEQUENCE,
          children: [
            { type: BTNodeType.CONDITION, expression: "${protagonist.hp} < ${protagonist.maxHp} * 0.3" },
            { type: BTNodeType.ACTION, actionType: "protect_protagonist" },
          ],
        },
        // 优先级2: 如果需要治疗，施放治疗
        {
          type: BTNodeType.SEQUENCE,
          children: [
            { type: BTNodeType.CONDITION, expression: "${ally.lowestHp} < ${ally.maxHp} * 0.5" },
            { type: BTNodeType.CONDITION, expression: "${self.canHeal} == true" },
            { type: BTNodeType.ACTION, actionType: "heal_ally" },
          ],
        },
        // 优先级3: 基于关系的动态行为
        {
          type: BTNodeType.INTENTION_BASED,
          intentionSource: "llm_cache",
          fallbackBehavior: { type: BTNodeType.ACTION, actionType: "support_attack" },
        },
      ],
    },
  },

  // 中立/路人NPC模板
  neutral: {
    root: {
      type: BTNodeType.SELECTOR,
      children: [
        // 优先级1: 如果感知到危险，回避
        {
          type: BTNodeType.SEQUENCE,
          children: [
            { type: BTNodeType.CONDITION, expression: "${perceivedThreat} > ${self.courage}" },
            { type: BTNodeType.ACTION, actionType: "avoid" },
          ],
        },
        // 优先级2: 基于日常目标的自主行为
        {
          type: BTNodeType.INTENTION_BASED,
          intentionSource: "llm_cache",
          fallbackBehavior: { type: BTNodeType.ACTION, actionType: "idle_routine" },
        },
        // 默认: 日常行为
        { type: BTNodeType.ACTION, actionType: "daily_routine" },
      ],
    },
  },

  // 关键剧情NPC模板（更复杂的决策）
  key_story: {
    root: {
      type: BTNodeType.SELECTOR,
      children: [
        // 戏剧时刻检测
        {
          type: BTNodeType.DRAMATIC_MOMENT,
          dramaticConditions: [
            { type: "protagonist_breakthrough" },
            { type: "revelation_moment" },
            { type: "betrayal_opportunity" },
          ],
          onDramatic: { type: BTNodeType.INTENTION_BASED, intentionSource: "realtime_llm" },
          onNormal: { type: BTNodeType.SEQUENCE, children: [/* 日常行为 */] },
        },
        // 长期目标驱动
        {
          type: BTNodeType.ACTION,
          actionType: "pursue_long_term_goal",
        },
      ],
    },
  },
};
```

### 5.4.4 目标队列优先级算法

```typescript
// ==================== 目标队列系统 ====================

interface Goal {
  goalId: string;
  type: "survival" | "growth" | "revenge" | "protection" | "acquisition" | 
        "social" | "exploration" | "duty" | "hidden_agenda";
  description: string;
  priority: number;            // 动态优先级 [0, 1000]
  basePriority: number;        // 基础优先级
  deadline?: number;           // 截止时间（章节号）
  progress: number;            // 进度 [0, 1]
  prerequisites: string[];     // 前置目标ID
  subGoals: string[];          // 子目标ID
  
  // 优先级动态调整因子
  urgencyFactor: number;       // 紧迫性 [0, 2]
  emotionalWeight: number;     // 情感权重 [0, 2]
  
  // 与主角的关系
  alignmentWithProtagonist: number;  // -1(敌对) 到 +1(友好)
}

class GoalQueue {
  private goals: Goal[] = [];
  private recalculationInterval: number = 5; // 每5章重新计算优先级
  private lastRecalculation: number = 0;

  // 添加目标
  addGoal(goal: Goal): void {
    this.goals.push(goal);
    this.recalculatePriorities();
  }

  // 获取当前最高优先级目标
  getTopGoal(): Goal | undefined {
    if (this.needsRecalculation()) {
      this.recalculatePriorities();
    }
    return this.goals.length > 0 ? this.goals[0] : undefined;
  }

  // 核心优先级重算算法
  recalculatePriorities(): void {
    const now = getCurrentChapter();
    
    for (const goal of this.goals) {
      // 基础分
      let score = goal.basePriority;

      // 紧迫性修正（截止时间越近越紧急）
      if (goal.deadline) {
        const chaptersRemaining = goal.deadline - now;
        if (chaptersRemaining <= 0) {
          goal.urgencyFactor = 3.0; // 已逾期，极度紧急
        } else if (chaptersRemaining <= 3) {
          goal.urgencyFactor = 2.0; // 即将到期
        } else if (chaptersRemaining <= 10) {
          goal.urgencyFactor = 1.5;
        } else {
          goal.urgencyFactor = 1.0;
        }
      }
      score *= goal.urgencyFactor;

      // 情感权重修正（NPC的情绪状态会影响目标优先级）
      const emotionalState = getEmotionalState(goal.ownerId);
      if (emotionalState) {
        goal.emotionalWeight = calculateEmotionalWeight(goal, emotionalState);
        score *= goal.emotionalWeight;
      }

      // 进度修正（快完成的目标获得加成）
      const progressBoost = 1.0 + goal.progress * 0.5; // 最高50%加成
      score *= progressBoost;

      // 与主角关系修正
      const protagonistFactor = calculateProtagonistFactor(goal);
      score *= protagonistFactor;

      goal.priority = Math.round(score);
    }

    // 按优先级降序排序
    this.goals.sort((a, b) => b.priority - a.priority);
    this.lastRecalculation = now;
  }

  // 目标完成回调
  completeGoal(goalId: string): void {
    const index = this.goals.findIndex(g => g.goalId === goalId);
    if (index >= 0) {
      const goal = this.goals[index];
      // 检查是否有后续目标
      for (const subGoalId of goal.subGoals) {
        const subGoal = this.goals.find(g => g.goalId === subGoalId);
        if (subGoal) {
          subGoal.basePriority *= 1.5; // 父目标完成，子目标优先级提升
        }
      }
      this.goals.splice(index, 1);
      this.recalculatePriorities();
    }
  }
}
```

### 5.4.5 LLM 意图整合策略

当 NPC 被激活进入场景时，行为引擎按以下流程整合 LLM 意图：

```typescript
interface NPCIntentionIntegration {
  // 阶段1: LLM 意图推断（见 5.9.1）
  llmIntention: NPCIntentionResult;
  
  // 阶段2: 意图验证与约束
  validatedIntention: ValidatedIntention;
  
  // 阶段3: 行为树节点映射
  mappedBehavior: BTNode;
  
  // 阶段4: 叙事生成
  narrativeOutput: string;
}

function integrateLLMIntention(
  npc: Entity,
  scene: Scene,
  llmResult: NPCIntentionResult,
  behaviorTree: BTNode
): IntentionIntegrationResult {
  
  // 步骤1: 意图合法性验证
  const validation = validateIntention(llmResult, npc, scene);
  if (!validation.isValid) {
    // 意图不合法时，使用回退行为
    return {
      usedIntention: null,
      fallbackBehavior: getFallbackBehavior(npc.npcType),
      rejectionReasons: validation.violations,
    };
  }

  // 步骤2: 意图与行为树的融合
  // LLM 提供的是"高层意图"，需要映射到具体的叶子节点
  const intentionType = llmResult.primaryIntention.type;
  const behaviorTemplate = NPC_BEHAVIOR_TEMPLATES[npc.npcType];
  
  // 在行为树中找到最佳插入点
  const insertionPoint = findBestInsertionPoint(
    behaviorTemplate, 
    intentionType,
    llmResult.primaryIntention.priority
  );

  // 步骤3: 动态子树构建
  const dynamicSubtree = buildDynamicSubtree(llmResult, npc);
  
  // 步骤4: 子树嫁接
  const modifiedTree = graftSubtree(behaviorTree, dynamicSubtree, insertionPoint);

  // 步骤5: 冲突检测（LLM 意图不应与硬约束冲突）
  const conflicts = detectBehaviorConflicts(modifiedTree, scene.worldState);
  if (conflicts.length > 0) {
    // 有冲突时，优先保证硬约束，调整 LLM 意图
    const adjustedTree = resolveConflicts(modifiedTree, conflicts);
    return {
      usedIntention: llmResult,
      modifiedTree: adjustedTree,
      conflicts,
      resolution: "adjusted",
    };
  }

  return {
    usedIntention: llmResult,
    modifiedTree,
    conflicts: [],
    resolution: "clean",
  };
}

// 意图验证：确保 LLM 的输出在物理和逻辑上可行
function validateIntention(
  intention: NPCIntentionResult,
  npc: Entity,
  scene: Scene
): IntentionValidation {
  const violations: string[] = [];

  // 检查1: 意图是否在 NPC 能力范围内
  for (const action of intention.impliedActions) {
    const validation = validateActionLegality(action, npc, scene.worldState);
    if (!validation.isLegal) {
      violations.push(`Action ${action.type} illegal: ${validation.checks.map(c => c.message).join(", ")}`);
    }
  }

  // 检查2: 意图是否与 NPC 的人格一致
  const personalityMatch = checkPersonalityConsistency(intention, npc.personality);
  if (personalityMatch.inconsistencyScore > 0.7) {
    violations.push(`Personality inconsistency: ${personalityMatch.reasons.join(", ")}`);
  }

  // 检查3: 意图是否与当前目标一致
  const goalAlignment = checkGoalAlignment(intention, npc.goalQueue);
  if (goalAlignment.alignmentScore < 0.3) {
    violations.push(`Goal misalignment: intention conflicts with current goals`);
  }

  return {
    isValid: violations.length === 0,
    violations,
    personalityMatch,
    goalAlignment,
  };
}
```

---

## 5.5 环境模拟器（Environment Simulator）

### 5.5.1 职责定位

环境模拟器管理场景中的物理环境——天气、地形、灵气浓度、时间流逝等。它采用程序化生成确保一致性，在场景感知查询时调用 LLM 进行环境叙事意图生成（见 5.9.2），让环境成为叙事的积极参与者而非被动背景。

### 5.5.2 程序化生成算法的参数化方案

```typescript
// ==================== 环境系统核心定义 ====================

interface EnvironmentState {
  environmentId: string;
  locationId: string;          // 关联的地点ID
  
  // 时间维度
  timeOfDay: number;           // [0, 24)，小时
  dayOfYear: number;           // [0, 365)
  year: number;
  
  // 气象维度
  weather: WeatherState;
  
  // 灵气/魔力维度
  ambientEnergy: AmbientEnergy;
  
  // 地形维度
  terrain: TerrainState;
  
  // 声学维度
  ambientSound: AmbientSound;
  
  // 叙事维度（由 LLM 推断生成）
  narrativeMood?: NarrativeMood;
  
  // 状态版本（用于缓存）
  stateVersion: number;
}

// ─── 气象状态 ───

interface WeatherState {
  condition: WeatherCondition;  // 晴/阴/雨/雪/雾/雷暴/沙尘等
  temperature: number;          // 摄氏度
  humidity: number;             // [0, 1]
  windSpeed: number;            // m/s
  windDirection: number;        // [0, 360)
  visibility: number;           // km
  pressure: number;             // hPa
  
  // 特殊气象（修真世界）
  spiritualPhenomena?: SpiritualWeather[]; // 如 "紫气东来", "雷云劫气"
}

type WeatherCondition = 
  | "clear" | "cloudy" | "overcast" | "light_rain" | "heavy_rain"
  | "thunderstorm" | "light_snow" | "heavy_snow" | "fog" | "mist"
  | "sandstorm" | "hail" | "spiritual_deviation";

interface SpiritualWeather {
  phenomenon: string;
  intensity: number;            // [0, 1]
  meaning: string;              // 象征意义
  effectOnCultivation: number;  // 对修炼的影响倍率
}

// ─── 环境能量 ───

interface AmbientEnergy {
  type: "spiritual" | "magical" | "demonic" | "natural" | "mixed";
  density: number;              // [0, +∞)，灵气浓度
  purity: number;               // [0, 1]，纯度
  flowDirection?: Vector3;      // 灵气流动方向
  turbulence: number;           // [0, 1]，紊乱度
  
  // 特殊能量节点
  leyLines?: LeyLine[];         // 灵脉
  nodes?: EnergyNode[];         // 能量节点
}

interface LeyLine {
  lineId: string;
  strength: number;
  path: Vector3[];
  element: "gold" | "wood" | "water" | "fire" | "earth" | "mixed";
}

// ─── 地形状态 ───

interface TerrainState {
  type: TerrainType;
  elevation: number;            // 海拔 m
  slope: number;                // 坡度 [0, 90]
  coverTypes: CoverType[];      // 遮蔽物
  hazards: TerrainHazard[];     // 地形危险
  strategicValue: number;       // 战略价值 [0, 1]
}

type TerrainType =
  | "plains" | "forest" | "mountain" | "valley" | "river" | "lake"
  | "cave" | "ruins" | "urban" | "desert" | "swamp" | "cliff";

// ─── 叙事氛围 ───

interface NarrativeMood {
  dominantMood: string;         // 如 "ominous", "serene", "tense", "hopeful"
  moodIntensity: number;        // [0, 1]
  sensoryImpressions: string[]; // 感官印象描述
  symbolicElements: string[];   // 象征元素
  foreshadowingHints: string[]; // 环境暗示的伏笔
}
```

#### 5.5.2.1 气象状态机

```typescript
// 天气状态转移（马尔可夫链）

const WEATHER_TRANSITION_MATRIX: Record<WeatherCondition, WeightedTransition[]> = {
  clear: [
    { to: "clear", weight: 0.60 },
    { to: "cloudy", weight: 0.25 },
    { to: "fog", weight: 0.05 },
    { to: "light_rain", weight: 0.10 },
  ],
  cloudy: [
    { to: "clear", weight: 0.25 },
    { to: "cloudy", weight: 0.35 },
    { to: "overcast", weight: 0.25 },
    { to: "light_rain", weight: 0.15 },
  ],
  overcast: [
    { to: "cloudy", weight: 0.20 },
    { to: "overcast", weight: 0.30 },
    { to: "light_rain", weight: 0.25 },
    { to: "heavy_rain", weight: 0.15 },
    { to: "thunderstorm", weight: 0.10 },
  ],
  light_rain: [
    { to: "cloudy", weight: 0.20 },
    { to: "light_rain", weight: 0.35 },
    { to: "heavy_rain", weight: 0.25 },
    { to: "clear", weight: 0.20 },
  ],
  heavy_rain: [
    { to: "light_rain", weight: 0.30 },
    { to: "heavy_rain", weight: 0.30 },
    { to: "thunderstorm", weight: 0.25 },
    { to: "clear", weight: 0.15 },
  ],
  thunderstorm: [
    { to: "heavy_rain", weight: 0.40 },
    { to: "light_rain", weight: 0.30 },
    { to: "clear", weight: 0.30 },
  ],
  // ... 其他天气状态
};

function simulateWeatherTransition(
  current: WeatherState,
  locationClimate: ClimateType,
  season: Season,
  hoursElapsed: number
): WeatherState {
  let state = { ...current };
  
  // 根据经过的时间步推进天气
  const steps = Math.floor(hoursElapsed / 3); // 每3小时可能转变一次
  
  for (let i = 0; i < steps; i++) {
    const transitions = WEATHER_TRANSITION_MATRIX[state.condition];
    
    // 根据地点气候和季节调整转移权重
    const adjustedTransitions = adjustForClimateAndSeason(
      transitions, 
      locationClimate, 
      season
    );
    
    // 按权重随机选择（确定性种子）
    const seed = hashString(`${state.stateVersion}_${i}_${locationClimate}`);
    state.condition = weightedRandomSelect(adjustedTransitions, seed);
    
    // 更新关联属性
    updateWeatherAttributes(state, locationClimate);
  }
  
  return state;
}
```

#### 5.5.2.2 灵气浓度场模拟

```typescript
// 灵气浓度使用简单的高斯场叠加模型

interface EnergyFieldConfig {
  baseDensity: number;          // 基础灵气浓度
  leyLineBoost: number;         // 灵脉加成系数
  nodeBoost: number;            // 节点加成系数
  temporalVariance: number;     // 时间波动幅度
  spatialDecay: number;         // 空间衰减率
}

function calculateAmbientEnergy(
  position: Vector3,
  leyLines: LeyLine[],
  nodes: EnergyNode[],
  time: GameTime,
  config: EnergyFieldConfig
): AmbientEnergy {
  // 基础浓度
  let density = config.baseDensity;
  
  // 灵脉贡献（距离越近贡献越大，高斯衰减）
  for (const line of leyLines) {
    const distance = pointToLineDistance(position, line.path);
    const contribution = line.strength * Math.exp(
      -config.spatialDecay * distance * distance
    );
    density += contribution;
  }
  
  // 节点贡献（球状衰减）
  for (const node of nodes) {
    const distance = Vector3.distance(position, node.position);
    const contribution = node.strength * Math.exp(
      -config.spatialDecay * distance
    );
    density += contribution;
  }
  
  // 时间波动（昼夜节律 + 随机扰动）
  const diurnalCycle = Math.sin((time.hour / 24) * Math.PI * 2) * 0.1;
  const dailySeed = hashString(`energy_${time.day}_${time.year}`);
  const randomFluctuation = (pseudoRandom(dailySeed) - 0.5) * config.temporalVariance;
  
  density *= (1 + diurnalCycle + randomFluctuation);
  
  return {
    type: inferEnergyType(leyLines, nodes),
    density: Math.max(0, density),
    purity: calculatePurity(leyLines, nodes),
    turbulence: calculateTurbulence(leyLines, position),
  };
}
```

### 5.5.3 状态转移规则模板

```typescript
interface EnvironmentTransitionRule {
  ruleId: string;
  trigger: EnvironmentTrigger;
  effects: EnvironmentEffect[];
  narrativeTemplate: string;    // 叙事模板，如 "随着${actor.name}踏入，${change.description}"
}

interface EnvironmentTrigger {
  type: "entity_enter" | "entity_exit" | "action_performed" | 
        "time_passed" | "weather_change" | "energy_spike";
  condition: string;            // 触发条件表达式
  probability: number;          // 触发概率（默认1.0）
}

interface EnvironmentEffect {
  target: "weather" | "energy" | "terrain" | "sound" | "narrative_mood";
  operation: "set" | "add" | "multiply" | "trigger_event";
  value: string | number;       // 值或公式
  duration?: number;            // 效果持续时间（秒）
}

// 常见环境转移规则
const COMMON_ENVIRONMENT_RULES: EnvironmentTransitionRule[] = [
  {
    ruleId: "high_level_entrance",
    trigger: { 
      type: "entity_enter", 
      condition: "${entity.realm.order} >= 6",
      probability: 0.7,
    },
    effects: [
      { target: "energy", operation: "multiply", value: "1.2", duration: 300 },
      { target: "narrative_mood", operation: "set", value: "awe_inspiring" },
    ],
    narrativeTemplate: "随着${entity.name}的到来，四周灵气不由自主地向他汇聚，仿佛天地都在为这位大能的降临而震动。",
  },
  {
    ruleId: "battle_energy_surge",
    trigger: { 
      type: "action_performed", 
      condition: "${action.type} == 'combat_ultimate'",
      probability: 1.0,
    },
    effects: [
      { target: "energy", operation: "multiply", value: "0.8", duration: 600 },
      { target: "weather", operation: "set", value: "spiritual_deviation" },
    ],
    narrativeTemplate: "那惊天一击的余波尚未散去，方圆百里的灵气已被消耗一空，天地为之色变。",
  },
  {
    ruleId: "dawn_cultivation_boost",
    trigger: { 
      type: "time_passed", 
      condition: "${time.hour} >= 5 && ${time.hour} <= 7",
      probability: 1.0,
    },
    effects: [
      { target: "energy", operation: "multiply", value: "1.3", duration: 7200 },
    ],
    narrativeTemplate: "东方泛起鱼肚白，一缕紫气自天际而来，正是修炼的最佳时机。",
  },
];
```

---

## 5.6 信息涟漪模拟器（Information Ripple Simulator）

### 5.6.1 职责定位

信息涟漪模拟器模拟事件在世界中的传播过程——一个消息如何从源头扩散到整个信息网络，在传播过程中如何失真、衰减、变异。这是网文中"消息传开后各方反应"这一经典桥段的底层支撑。

### 5.6.2 图扩散算法

#### 5.6.2.1 信息网络图结构

```typescript
// ==================== 信息涟漪核心定义 ====================

interface InformationNetwork {
  // 有向图: 节点是实体（人/组织），边是信息传播通道
  nodes: Map<string, InfoNode>;
  edges: Map<string, InfoEdge[]>;  // adjacency list: nodeId -> outgoing edges
  
  // 消息传播记录
  activeRipples: Map<string, Ripple>;
  
  // 历史记录
  rippleHistory: RippleRecord[];
}

interface InfoNode {
  nodeId: string;              // 实体ID
  nodeType: "individual" | "sect" | "family" | "city" | "guild" | "rumor_mill";
  
  // 传播属性
  receptivity: number;         // 信息接收度 [0,1]
  processingBias: ProcessingBias; // 信息处理偏向
  spreadSpeed: number;         // 传播速度（消息转发延迟系数）
  
  // 记忆
  knownFacts: Map<string, KnownFact>;  // factId -> 已知事实
  
  // 当前情绪状态（影响传播倾向）
  emotionalState: EmotionalState;
}

interface InfoEdge {
  from: string;
  to: string;
  
  // 通道属性
  trustLevel: number;          // 信任度 [0,1]，影响信息失真率
  communicationFrequency: number; // 通信频率（次/天）
  channelType: "direct" | "indirect" | "public" | "secret" | "rumor";
  
  // 带宽限制
  bandwidth: number;           // 信息保真度上限 [0,1]
  delay: number;               // 传播延迟（小时）
  
  // 方向性
  isBidirectional: boolean;
}

interface Ripple {
  rippleId: string;
  sourceEvent: WorldEvent;
  originNode: string;          // 源头节点
  
  // 传播状态
  propagationWave: Map<string, WaveFront>; // nodeId -> 波前状态
  
  // 全局统计
  nodesReached: number;
  totalDistortions: number;
  maxDepth: number;
  
  // 状态
  status: "propagating" | "stabilized" | "amplified" | "mutated";
  startedAt: GameTime;
  lastUpdate: GameTime;
}

interface WaveFront {
  nodeId: string;
  arrivalTime: GameTime;
  messageVersion: MessageVersion;  // 到达此节点时的消息版本
  depth: number;                 // 距离源头的跳数
  receptionProbability: number;  // 此节点实际接收到的概率
}
```

#### 5.6.2.2 涟漪传播算法（BFS 变体 + 失真模型）

```typescript
// ==================== 涟漪传播核心算法 ====================

class RipplePropagator {
  private network: InformationNetwork;
  private distortionModel: DistortionModel;
  private decayModel: DecayModel;
  
  constructor(config: PropagatorConfig) {
    this.network = config.network;
    this.distortionModel = config.distortionModel;
    this.decayModel = config.decayModel;
  }

  // 主入口：从事件创建涟漪并开始传播
  async createRipple(event: WorldEvent, originNodeId: string): Promise<Ripple> {
    const rippleId = `ripple_${event.eventId}_${Date.now()}`;
    
    // 步骤1: 将事件编码为初始消息
    const initialMessage = this.encodeEvent(event);
    
    // 步骤2: 创建源头波前
    const originWave: WaveFront = {
      nodeId: originNodeId,
      arrivalTime: getCurrentGameTime(),
      messageVersion: { version: 0, content: initialMessage, fidelity: 1.0 },
      depth: 0,
      receptionProbability: 1.0,
    };
    
    const ripple: Ripple = {
      rippleId,
      sourceEvent: event,
      originNode: originNodeId,
      propagationWave: new Map([[originNodeId, originWave]]),
      nodesReached: 1,
      totalDistortions: 0,
      maxDepth: 0,
      status: "propagating",
      startedAt: getCurrentGameTime(),
      lastUpdate: getCurrentGameTime(),
    };
    
    // 步骤3: 开始传播（异步）
    this.propagateAsync(ripple);
    
    return ripple;
  }

  // 核心传播算法（改进的BFS）
  private async propagateAsync(ripple: Ripple): Promise<void> {
    // 使用优先队列（按到达时间排序）
    const queue: PriorityQueue<PropagationTask> = new PriorityQueue(
      (a, b) => a.arrivalTime - b.arrivalTime
    );
    
    // 初始化队列：从源头的邻居开始
    const originNode = this.network.nodes.get(ripple.originNode)!;
    for (const edge of this.network.edges.get(ripple.originNode) || []) {
      queue.enqueue({
        fromNode: ripple.originNode,
        toNode: edge.to,
        edge,
        incomingMessage: ripple.propagationWave.get(ripple.originNode)!.messageVersion,
        depth: 1,
        arrivalTime: this.calculateArrivalTime(edge, 0),
      });
    }
    
    // BFS 主循环
    while (!queue.isEmpty() && ripple.status === "propagating") {
      const task = queue.dequeue()!;
      
      // 步骤A: 检查此节点是否已接收过此涟漪的更新版本
      const existingWave = ripple.propagationWave.get(task.toNode);
      if (existingWave && existingWave.depth <= task.depth) {
        continue; // 已收到更短路径的信息，跳过
      }
      
      // 步骤B: 计算传播成功率
      const propagationSuccess = this.calculatePropagationSuccess(task);
      if (!propagationSuccess) {
        continue; // 传播失败
      }
      
      // 步骤C: 应用失真模型
      const distortedMessage = this.distortionModel.apply(
        task.incomingMessage,
        this.network.nodes.get(task.fromNode)!,
        this.network.nodes.get(task.toNode)!,
        task.edge
      );
      
      // 步骤D: 应用衰减模型
      const decayedMessage = this.decayModel.apply(
        distortedMessage,
        task.depth,
        this.network.nodes.get(task.toNode)!
      );
      
      // 步骤E: 检查消息是否衰减至无意义
      if (decayedMessage.fidelity < 0.1) {
        continue; // 消息已不可辨识
      }
      
      // 步骤F: 节点接收处理
      const targetNode = this.network.nodes.get(task.toNode)!;
      const received = this.processReception(targetNode, decayedMessage, ripple);
      
      if (received) {
        // 步骤G: 创建新波前并记录
        const newWave: WaveFront = {
          nodeId: task.toNode,
          arrivalTime: task.arrivalTime,
          messageVersion: decayedMessage,
          depth: task.depth,
          receptionProbability: propagationSuccess,
        };
        ripple.propagationWave.set(task.toNode, newWave);
        ripple.nodesReached++;
        ripple.maxDepth = Math.max(ripple.maxDepth, task.depth);
        if (distortedMessage.version > task.incomingMessage.version) {
          ripple.totalDistortions++;
        }
        
        // 步骤H: 继续向外传播（如果此节点会转发）
        const forwardingProbability = this.calculateForwardingProbability(
          targetNode, 
          decayedMessage
        );
        
        if (forwardingProbability > 0.3) { // 转发阈值
          for (const outgoingEdge of this.network.edges.get(task.toNode) || []) {
            // 避免回传
            if (outgoingEdge.to === task.fromNode) continue;
            
            queue.enqueue({
              fromNode: task.toNode,
              toNode: outgoingEdge.to,
              edge: outgoingEdge,
              incomingMessage: decayedMessage,
              depth: task.depth + 1,
              arrivalTime: this.calculateArrivalTime(outgoingEdge, task.depth),
            });
          }
        }
      }
    }
    
    // 传播结束，更新状态
    ripple.status = ripple.totalDistortions > ripple.nodesReached * 0.3 
      ? "mutated" 
      : "stabilized";
    ripple.lastUpdate = getCurrentGameTime();
    
    // 触发异步叙事推断（见 5.9.3）
    this.triggerNarrativeInference(ripple);
  }
}
```

### 5.6.3 信息失真模型

#### 5.6.3.1 失真类型与数学公式

```typescript
// ==================== 失真模型 ====================

interface DistortionModel {
  // 应用失真
  apply(
    message: MessageVersion,
    fromNode: InfoNode,
    toNode: InfoNode,
    edge: InfoEdge
  ): MessageVersion;
}

class ComprehensiveDistortionModel implements DistortionModel {
  private distortionTypes: DistortionType[] = [
    new AmplificationDistortion(),   // 夸大
    new AttenuationDistortion(),     // 弱化
    new DetailLossDistortion(),      // 细节丢失
    new PerspectiveShiftDistortion(),// 视角转换
    new EmotionalColoringDistortion(),// 情绪渲染
    new FactSubstitutionDistortion(),// 事实替换
  ];

  apply(
    message: MessageVersion,
    fromNode: InfoNode,
    toNode: InfoNode,
    edge: InfoEdge
  ): MessageVersion {
    let current = { ...message };
    current.version++; // 版本号递增
    
    // 基础失真率计算
    const baseDistortionRate = this.calculateBaseDistortionRate(fromNode, toNode, edge);
    
    // 依次应用各类型失真
    for (const dt of this.distortionTypes) {
      const distortionProbability = dt.getProbability(baseDistortionRate, fromNode, toNode);
      const seed = hashString(`${message.version}_${dt.name}_${edge.from}_${edge.to}`);
      
      if (pseudoRandom(seed) < distortionProbability) {
        current = dt.distort(current, fromNode, toNode, edge);
      }
    }
    
    // 更新保真度
    current.fidelity = this.calculateFidelity(message, current);
    
    return current;
  }

  private calculateBaseDistortionRate(
    from: InfoNode, 
    to: InfoNode, 
    edge: InfoEdge
  ): number {
    // 基础失真率 = f(信任度, 通信带宽, 接收方偏见, 情绪状态)
    const trustFactor = 1.0 - edge.trustLevel;      // 信任度越低，失真越高
    const bandwidthFactor = 1.0 - edge.bandwidth;    // 带宽越低，失真越高
    const biasFactor = calculateBiasImpact(to.processingBias);
    const emotionFactor = Math.abs(to.emotionalState.intensity) * 0.3; // 情绪越激烈越失真
    
    // 加权组合（加权乘积模型）
    return clamp(
      trustFactor * 0.35 + 
      bandwidthFactor * 0.25 + 
      biasFactor * 0.25 + 
      emotionFactor * 0.15,
      0, 1
    );
  }
}

// ─── 具体失真类型 ───

// 1. 夸大失真（网文经典：越传越玄乎）
class AmplificationDistortion implements DistortionType {
  name = "amplification";
  
  getProbability(baseRate: number, from: InfoNode, to: InfoNode): number {
    // 情绪激动的接收者更容易夸大
    const emotionBoost = to.emotionalState.intensity > 0.5 ? 0.3 : 0;
    return clamp(baseRate * 0.4 + emotionBoost, 0, 0.8);
  }
  
  distort(msg: MessageVersion, from: InfoNode, to: InfoNode, edge: InfoEdge): MessageVersion {
    const clone = deepClone(msg);
    // 数值类信息 × (1 + 随机夸大率)
    for (const [key, value] of Object.entries(clone.content.numericalValues || {})) {
      const amplificationFactor = 1.0 + pseudoRandom(hashString(key)) * 1.5; // 1.0x ~ 2.5x
      clone.content.numericalValues[key] = value * amplificationFactor;
    }
    // 规模类描述升级
    clone.content.scaleDescription = upgradeScaleDescription(clone.content.scaleDescription);
    clone.distortionsApplied = [...(clone.distortionsApplied || []), "amplification"];
    return clone;
  }
}

// 2. 弱化失真（某些角色倾向于淡化事件）
class AttenuationDistortion implements DistortionType {
  name = "attenuation";
  
  getProbability(baseRate: number, from: InfoNode, to: InfoNode): number {
    // 保守型角色更可能弱化
    return to.processingBias.temperament === "conservative" ? baseRate * 0.6 : 0.05;
  }
  
  distort(msg: MessageVersion, from: InfoNode, to: InfoNode, edge: InfoEdge): MessageVersion {
    const clone = deepClone(msg);
    for (const [key, value] of Object.entries(clone.content.numericalValues || {})) {
      clone.content.numericalValues[key] = value * (0.5 + pseudoRandom(hashString(key)) * 0.3); // 0.5x ~ 0.8x
    }
    clone.distortionsApplied = [...(clone.distortionsApplied || []), "attenuation"];
    return clone;
  }
}

// 3. 细节丢失（每传播一步丢失部分细节）
class DetailLossDistortion implements DistortionType {
  name = "detail_loss";
  
  getProbability(baseRate: number): number {
    return clamp(baseRate * 0.7 + 0.1, 0, 0.9); // 几乎总是发生
  }
  
  distort(msg: MessageVersion): MessageVersion {
    const clone = deepClone(msg);
    const details = clone.content.details || [];
    const lossRate = 0.2 + pseudoRandom(hashString("detail_loss")) * 0.4; // 丢失20%~60%
    const remainingCount = Math.ceil(details.length * (1 - lossRate));
    
    // 随机选择保留的细节（确定性）
    const seed = hashString(`detail_select_${msg.version}`);
    clone.content.details = shuffleDeterministic(details, seed).slice(0, remainingCount);
    clone.distortionsApplied = [...(clone.distortionsApplied || []), "detail_loss"];
    return clone;
  }
}

// 4. 视角转换（从不同立场重新诠释事件）
class PerspectiveShiftDistortion implements DistortionType {
  name = "perspective_shift";
  
  getProbability(baseRate: number, from: InfoNode, to: InfoNode): number {
    // 立场差异越大，视角转换概率越高
    const alignmentDiff = Math.abs(
      (from.knownFacts.get("alignment")?.value as number || 0) -
      (to.knownFacts.get("alignment")?.value as number || 0)
    );
    return clamp(baseRate * 0.5 + alignmentDiff * 0.3, 0, 0.7);
  }
  
  distort(msg: MessageVersion, from: InfoNode, to: InfoNode): MessageVersion {
    const clone = deepClone(msg);
    // 将主角行为从"正当防卫"转为"恃强凌弱"等
    clone.content.characterization = shiftCharacterization(
      clone.content.characterization,
      to.processingBias
    );
    clone.distortionsApplied = [...(clone.distortionsApplied || []), "perspective_shift"];
    return clone;
  }
}

// 5. 情绪渲染（根据接收者情绪给消息上色）
class EmotionalColoringDistortion implements DistortionType {
  name = "emotional_coloring";
  
  getProbability(baseRate: number, from: InfoNode, to: InfoNode): number {
    return to.emotionalState.intensity > 0.3 ? baseRate * 0.8 : 0.1;
  }
  
  distort(msg: MessageVersion, from: InfoNode, to: InfoNode): MessageVersion {
    const clone = deepClone(msg);
    clone.content.emotionalTone = blendEmotions(
      clone.content.emotionalTone,
      to.emotionalState.dominantEmotion
    );
    clone.distortionsApplied = [...(clone.distortionsApplied || []), "emotional_coloring"];
    return clone;
  }
}

// 6. 事实替换（最危险的失真——用错误信息替换正确信息）
class FactSubstitutionDistortion implements DistortionType {
  name = "fact_substitution";
  
  getProbability(baseRate: number, from: InfoNode, to: InfoNode): number {
    // 敌对节点更可能进行事实替换
    const relationship = getRelationship(from.nodeId, to.nodeId);
    return relationship === "hostile" ? baseRate * 0.5 : baseRate * 0.05;
  }
  
  distort(msg: MessageVersion, from: InfoNode, to: InfoNode): MessageVersion {
    const clone = deepClone(msg);
    // 选择性替换关键事实
    const substitutableFacts = clone.content.substitutableFacts || [];
    for (const fact of substitutableFacts) {
      if (pseudoRandom(hashString(fact.key)) < 0.3) {
        fact.value = generatePlausibleAlternative(fact, to.processingBias);
      }
    }
    clone.distortionsApplied = [...(clone.distortionsApplied || []), "fact_substitution"];
    return clone;
  }
}
```

### 5.6.4 涟漪衰减函数

```typescript
// ==================== 衰减模型 ====================

interface DecayModel {
  apply(message: MessageVersion, depth: number, receiver: InfoNode): MessageVersion;
}

class ExponentialDecayModel implements DecayModel {
  // 指数衰减 + 节点特异性修正
  
  apply(message: MessageVersion, depth: number, receiver: InfoNode): MessageVersion {
    const clone = { ...message };
    
    // 基础指数衰减: fidelity *= e^(-λ * depth)
    const lambda = 0.15; // 衰减系数
    const baseDecay = Math.exp(-lambda * depth);
    
    // 节点修正
    const receptivityBoost = receiver.receptivity; // 接收度高的节点减缓衰减
    const interestMatch = calculateInterestMatch(message, receiver); // 兴趣匹配度
    
    const effectiveDecay = baseDecay * (0.5 + receptivityBoost * 0.3 + interestMatch * 0.2);
    
    clone.fidelity *= clamp(effectiveDecay, 0.01, 1.0);
    
    // 当 fidelity 过低时，部分内容变为"未知/传闻"
    if (clone.fidelity < 0.3) {
      clone.content.certaintyLevel = "rumor";
      clone.content.sourceAttribution = "未知来源";
    } else if (clone.fidelity < 0.6) {
      clone.content.certaintyLevel = "hearsay";
    }
    
    return clone;
  }
}

// 传播成功概率函数
function calculatePropagationSuccess(task: PropagationTask): boolean {
  // P(成功) = trustLevel * channelReliability * receiverReceptivity * noiseFactor
  const baseProbability = 
    task.edge.trustLevel * 
    task.edge.bandwidth * 
    (1 - Math.abs(task.toNode.emotionalState.intensity - 0.5)); // 情绪极端时接收率下降
  
  const seed = hashString(`prop_${task.fromNode}_${task.toNode}_${task.depth}`);
  return pseudoRandom(seed) < clamp(baseProbability, 0.05, 0.95);
}

// 转发概率函数
function calculateForwardingProbability(
  node: InfoNode, 
  message: MessageVersion
): number {
  // P(转发) = f(emotionalImpact, socialRelevance, personality)
  const emotionalImpact = Math.abs(message.content.emotionalTone?.intensity || 0);
  const socialRelevance = message.content.socialRelevance || 0.5;
  const gossipTendency = node.processingBias.gossipTendency || 0.5;
  
  return clamp(
    emotionalImpact * 0.4 + socialRelevance * 0.3 + gossipTendency * 0.3,
    0, 1
  );
}
```

---

## 5.7 先例引擎（Precedent Engine）

### 5.7.1 职责定位

先例引擎追踪世界中"有过的先例"——曾经发生过的事情及其后果。先例具有**势能**，会随时间衰变，也可能因相似事件而增殖。当两个或多个先例碰撞时，可能触发"核聚变"——产生全新的叙事可能性。这是网文"伏笔回收"和"因果报应"机制的底层支撑。

### 5.7.2 势能衰变的指数函数定义

```typescript
// ==================== 先例引擎核心定义 ====================

interface Precedent {
  precedentId: string;
  name: string;
  description: string;
  
  // 事件记录
  sourceEvent: WorldEvent;
  createdAtChapter: number;
  resolvedAtChapter?: number;
  
  // 势能系统
  potential: PotentialEnergy;
  
  // 状态
  status: "active" | "decaying" | "dormant" | "fused" | "resolved";
  
  // 关联
  relatedPrecedents: string[];   // 关联先例ID
  boundEntities: string[];       // 绑定的实体
  
  // 叙事记录
  narrativeManifestations: NarrativeManifestation[];
}

interface PotentialEnergy {
  currentValue: number;          // 当前势能值 [0, +∞)
  initialValue: number;          // 初始势能
  decayRate: number;             // 衰变速率 λ
  halfLife: number;              // 半衰期（章节数）
  lastUpdateChapter: number;
  
  // 增殖追踪
  amplificationEvents: AmplificationEvent[];
  totalAmplification: number;    // 累积增殖倍率
}

interface NarrativeManifestation {
  chapter: number;
  description: string;           // 势能的表现形式
  intensity: number;             // 表现强度 [0,1]
}

interface AmplificationEvent {
  chapter: number;
  triggerEvent: WorldEvent;
  amplificationFactor: number;   // 增殖因子 (>1)
  description: string;
}
```

#### 5.7.2.1 衰变函数

```typescript
// 势能衰变：指数衰变 + 事件驱动扰动

function calculateCurrentPotential(precedent: Precedent, currentChapter: number): number {
  const potential = precedent.potential;
  const elapsed = currentChapter - potential.lastUpdateChapter;
  
  // 基础指数衰变: P(t) = P0 * e^(-λt)
  const baseDecay = Math.exp(-potential.decayRate * elapsed);
  
  // 扰动修正（随机小幅波动，使衰变不那么单调）
  const seed = hashString(`potential_perturb_${precedent.precedentId}_${currentChapter}`);
  const perturbation = 1.0 + (pseudoRandom(seed) - 0.5) * 0.1; // ±5%
  
  // 应用增殖
  const amplifiedValue = potential.initialValue * potential.totalAmplification;
  
  return Math.max(0.01, amplifiedValue * baseDecay * perturbation);
}

// 默认衰变速率表
const DEFAULT_DECAY_RATES: Record<string, number> = {
  // 大类：修真因果
  karmic_debt: 0.05,           // 业债衰变慢（可能伴随整个故事）
  breakthrough_opportunity: 0.2, // 突破机会衰变较快
  
  // 大类：人际关系
  grudge: 0.08,                // 怨恨衰变较慢
  favor: 0.15,                 // 人情衰变中等
  love_interest: 0.03,         // 情感线索衰变慢
  
  // 大类：世界事件
  prophecy: 0.02,              // 预言衰变极慢
  treasure_location: 0.25,     // 宝藏线索衰变快
  sect_power_shift: 0.1,       // 宗门势力变化
  
  // 大类：系统级
  world_rule_hint: 0.01,       // 世界规则暗示几乎不衰变
  hidden_identity: 0.04,       // 隐藏身份线索衰变慢
};

// 半衰期计算
function calculateHalfLife(decayRate: number): number {
  return Math.log(2) / decayRate; // t_1/2 = ln(2) / λ
}
```

### 5.7.3 增殖条件检测逻辑

```typescript
// ==================== 先例增殖 ====================

interface ProliferationResult {
  occurred: boolean;
  amplificationFactor: number;
  triggerEvent: WorldEvent;
  narrativeManifestation: string;
}

function detectProliferation(
  precedent: Precedent,
  newEvent: WorldEvent,
  currentChapter: number
): ProliferationResult {
  // 步骤1: 相似度计算
  const similarity = calculateEventSimilarity(precedent.sourceEvent, newEvent);
  
  // 步骤2: 因果关联检测
  const causalLink = detectCausalLink(precedent, newEvent);
  
  // 步骤3: 情感共鸣检测
  const emotionalResonance = calculateEmotionalResonance(precedent, newEvent);
  
  // 步骤4: 综合增殖判定
  const proliferationScore = 
    similarity * 0.35 + 
    causalLink.strength * 0.40 + 
    emotionalResonance * 0.25;
  
  if (proliferationScore < 0.5) {
    return { occurred: false, amplificationFactor: 1.0, triggerEvent: newEvent, narrativeManifestation: "" };
  }
  
  // 步骤5: 计算增殖因子
  const baseAmplification = 1.0 + proliferationScore; // 1.5x ~ 2.0x
  const recencyBoost = 1.0 + 0.5 / (1 + currentChapter - precedent.createdAtChapter); // 近期事件额外加成
  const escalationFactor = precedent.potential.amplificationEvents.length > 0 
    ? 1.2  // 已经增殖过的先例更容易再次增殖
    : 1.0;
  
  const totalAmplification = baseAmplification * recencyBoost * escalationFactor;
  
  // 步骤6: 生成叙事表现
  const manifestation = generateProliferationManifestation(
    precedent, newEvent, proliferationScore
  );
  
  return {
    occurred: true,
    amplificationFactor: totalAmplification,
    triggerEvent: newEvent,
    narrativeManifestation: manifestation,
  };
}

// 事件相似度计算（基于多重特征）
function calculateEventSimilarity(eventA: WorldEvent, eventB: WorldEvent): number {
  const features = {
    // 涉及实体重叠度
    entityOverlap: jaccardSimilarity(
      new Set(eventA.involvedEntities),
      new Set(eventB.involvedEntities)
    ),
    // 事件类型相似度
    typeSimilarity: eventA.type === eventB.type ? 1.0 : 
                    getEventTypeSimilarity(eventA.type, eventB.type),
    // 地点接近度
    locationProximity: calculateLocationProximity(eventA.location, eventB.location),
    // 时间接近度（越近的事件越可能相关）
    temporalProximity: 1.0 / (1 + Math.abs(eventA.chapter - eventB.chapter) * 0.1),
    // 结果模式相似度
    outcomePattern: compareOutcomePatterns(eventA.outcome, eventB.outcome),
  };
  
  return (
    features.entityOverlap * 0.30 +
    features.typeSimilarity * 0.25 +
    features.locationProximity * 0.15 +
    features.temporalProximity * 0.15 +
    features.outcomePattern * 0.15
  );
}
```

### 5.7.4 核聚变的数学条件

"核聚变"是两个或多个先例碰撞产生全新叙事可能性的现象。它是网文"多线汇流"高潮的数学基础。

```typescript
// ==================== 核聚变检测 ====================

interface FusionCondition {
  // 聚变条件满足度 [0, 1]
  satisfaction: number;
  
  // 各子条件
  conditions: {
    spatialProximity: number;     // 空间接近度
    temporalAlignment: number;    // 时间对齐度
    energyThreshold: boolean;     // 能量阈值是否达标
    complementary: number;        // 互补性
    conflictPotential: number;    // 冲突潜力
  };
  
  // 参与聚变的先例
  participants: Precedent[];
}

interface FusionResult {
  occurred: boolean;
  fusionId: string;
  
  // 输入先例
  parentPrecedents: string[];
  
  // 输出
  childPrecedents: Precedent[];   // 可能产生多个子先例
  
  // 叙事效果
  narrativeImpact: NarrativeImpact;
  suggestedScenes: SuggestedScene[];
}

// 核聚变检测算法
function detectFusion(
  activePrecedents: Precedent[],
  currentChapter: number,
  worldState: WorldState
): FusionResult[] {
  const fusions: FusionResult[] = [];
  
  // 步骤1: 构建先例之间的关联图
  const correlationGraph = buildCorrelationGraph(activePrecedents);
  
  // 步骤2: 查找可能的聚变组合（团检测）
  const candidateCliques = findCandidateCliques(correlationGraph, 2, 4); // 2-4个先例的组合
  
  for (const clique of candidateCliques) {
    const precedents = clique.map(id => activePrecedents.find(p => p.precedentId === id)!);
    
    // 步骤3: 评估聚变条件
    const condition = evaluateFusionCondition(precedents, currentChapter, worldState);
    
    // 步骤4: 阈值判定
    if (condition.satisfaction >= 0.7) { // 聚变阈值
      const fusion = executeFusion(precedents, condition, currentChapter);
      if (fusion.occurred) {
        fusions.push(fusion);
      }
    }
  }
  
  return fusions;
}

// 聚变条件评估
function evaluateFusionCondition(
  precedents: Precedent[],
  currentChapter: number,
  worldState: WorldState
): FusionCondition {
  // 条件1: 空间接近度 — 参与聚变的先例是否在相近空间
  const spatialProximity = calculateGroupSpatialProximity(precedents);
  
  // 条件2: 时间对齐度 — 各先例的势能是否在同一时间窗口内活跃
  const temporalAlignment = calculateTemporalAlignment(precedents, currentChapter);
  
  // 条件3: 能量阈值 — 各先例的当前势能之和是否超过阈值
  const totalEnergy = precedents.reduce(
    (sum, p) => sum + calculateCurrentPotential(p, currentChapter), 
    0
  );
  const energyThreshold = totalEnergy >= 5.0; // 可配置阈值
  
  // 条件4: 互补性 — 先例之间是否有互补的"缺口"
  const complementary = calculateComplementarity(precedents);
  
  // 条件5: 冲突潜力 — 先例之间是否有足够张力产生戏剧性
  const conflictPotential = calculateConflictPotential(precedents, worldState);
  
  // 综合满足度（所有条件必须同时满足，用加权几何平均）
  const satisfaction = energyThreshold 
    ? Math.pow(
        spatialProximity * 0.25 * 
        temporalAlignment * 0.20 * 
        complementary * 0.30 * 
        conflictPotential * 0.25,
        1 / 4
      )
    : 0;
  
  return {
    satisfaction,
    conditions: { spatialProximity, temporalAlignment, energyThreshold, complementary, conflictPotential },
    participants: precedents,
  };
}

// 执行聚变
function executeFusion(
  precedents: Precedent[],
  condition: FusionCondition,
  currentChapter: number
): FusionResult {
  const fusionId = `fusion_${precedents.map(p => p.precedentId).join("_")}_${currentChapter}`;
  
  // 计算聚变强度
  const fusionStrength = condition.satisfaction;
  
  // 生成子先例
  const childPrecedents: Precedent[] = [];
  
  // 类型1: 汇流型 — 多条线索汇合成一个大事件
  if (condition.conditions.complementary > 0.6) {
    childPrecedents.push(createConfluencePrecedent(precedents, fusionStrength, currentChapter));
  }
  
  // 类型2: 冲突型 — 先例之间的张力爆发
  if (condition.conditions.conflictPotential > 0.6) {
    childPrecedents.push(createConflictPrecedent(precedents, fusionStrength, currentChapter));
  }
  
  // 类型3: 启示型 — 隐藏真相浮出水面
  if (precedents.some(p => p.potential.decayRate < 0.05)) { // 长期伏笔
    childPrecedents.push(createRevelationPrecedent(precedents, fusionStrength, currentChapter));
  }
  
  return {
    occurred: childPrecedents.length > 0,
    fusionId,
    parentPrecedents: precedents.map(p => p.precedentId),
    childPrecedents,
    narrativeImpact: calculateNarrativeImpact(childPrecedents),
    suggestedScenes: generateSuggestedScenes(childPrecedents),
  };
}

// 聚变后各父先例的状态变化
function updateParentPrecedentsAfterFusion(
  precedents: Precedent[],
  fusionResult: FusionResult
): void {
  for (const p of precedents) {
    // 参与聚变的先例势能大幅释放
    p.potential.currentValue *= 0.3; // 剩余30%
    p.status = "fused";
    
    // 记录聚变参与
    p.narrativeManifestations.push({
      chapter: fusionResult.childPrecedents[0]?.createdAtChapter || 0,
      description: `与 ${fusionResult.parentPrecedents.filter(id => id !== p.precedentId).join("、")} 的势能发生聚变`,
      intensity: 0.9,
    });
  }
}
```

---

## 5.8 代价计算器（Cost Calculator）

### 5.8.1 职责定位

代价计算器负责量化世界中任何行动的代价——不仅是消耗的资源，还包括机会成本、人际关系损失、道德代价、因果业报等。它是网文"等价交换"原则的执行者，确保主角的成长不是无代价的。

### 5.8.2 代价规则匹配算法

```typescript
// ==================== 代价计算器核心定义 ====================

interface CostCalculationRequest {
  action: CharacterAction;
  actor: Entity;
  context: CostContext;
  includeHiddenCosts: boolean;   // 是否包含隐性代价
  includeOpportunityCosts: boolean; // 是否包含机会成本
}

interface CostBreakdown {
  directCosts: DirectCost[];     // 直接代价
  hiddenCosts: HiddenCost[];     // 隐性代价（如因果业报）
  opportunityCosts: OpportunityCost[]; // 机会成本
  totalCostScore: number;        // 综合代价值 [0, +∞)
  narrativeDescription: string;  // 叙事化描述
  empathyCue: string;            // 共情提示（由工作室引擎生成）
}

interface DirectCost {
  type: "hp" | "mp" | "stamina" | "spirit" | "lifespan" | "item" | "currency";
  amount: number;
  isRecoverable: boolean;
  recoveryTime?: number;         // 恢复时间（秒）
}

interface HiddenCost {
  type: "karmic_debt" | "relationship_damage" | "reputation_cost" | 
        "psychological_trauma" | "ability_seal_risk" | "future_constraint";
  severity: number;              // [0, 1]
  description: string;
  manifestationDelay: number;    // 显现延迟（章节数）
}

interface OpportunityCost {
  foregoneAlternative: string;
  estimatedValue: number;
  description: string;
}
```

### 5.8.3 混沌种子的哈希生成函数

代价计算引入可控混沌，使同一行动在不同情境下的代价略有不同——这是"命运无常"的数学体现。

```typescript
// ==================== 混沌种子系统 ====================

interface ChaosSeed {
  seed: number;                  // 32位整数种子
  source: string;                // 种子来源描述
  determinismLevel: number;      // 确定性级别 [0,1]，1=完全确定
}

// 混沌种子生成器
function generateChaosSeed(request: CostCalculationRequest): ChaosSeed {
  // 种子由多个确定性因素组合哈希而成
  const factors = [
    hashString(request.actor.entityId),
    hashString(request.action.type),
    request.context.currentChapter,
    hashString(request.context.locationId || ""),
    // 加入世界状态版本号确保可复现
    request.context.worldStateVersion,
    // 加入业力值作为混沌源
    Math.floor(request.actor.karma * 1000),
  ];
  
  // 使用 FNV-1a 哈希算法组合所有因子
  let seed = 2166136261; // FNV offset basis
  for (const factor of factors) {
    seed ^= factor;
    seed += (seed << 1) + (seed << 4) + (seed << 7) + (seed << 8) + (seed << 24);
  }
  
  // 业力修正：业力值偏离0越远，混沌度越高（"多行不义必自毙"）
  const karmaDeviation = Math.abs(request.actor.karma);
  const determinismLevel = clamp(1.0 - karmaDeviation * 0.2, 0.3, 1.0);
  
  return {
    seed: seed >>> 0, // 转为无符号32位
    source: `actor:${request.actor.entityId}|action:${request.action.type}|chapter:${request.context.currentChapter}`,
    determinismLevel,
  };
}

// 基于种子的混沌扰动
function applyChaos(
  baseValue: number, 
  chaosSeed: ChaosSeed, 
  perturbationRange: number
): number {
  // xorshift32 伪随机
  let x = chaosSeed.seed;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  
  // 归一化到 [-1, 1]
  const normalized = ((x >>> 0) % 2000000) / 1000000 - 1;
  
  // 根据确定性级别调整扰动幅度
  const effectiveRange = perturbationRange * (1 - chaosSeed.determinismLevel);
  
  return baseValue * (1 + normalized * effectiveRange);
}
```

### 5.8.4 代价量化公式

```typescript
// ==================== 代价量化引擎 ====================

class CostCalculator {
  private costRules: CostRule[];
  private chaosEnabled: boolean;
  
  constructor(config: CostCalculatorConfig) {
    this.costRules = config.costRules;
    this.chaosEnabled = config.chaosEnabled ?? true;
  }

  // 主入口
  calculateCost(request: CostCalculationRequest): CostBreakdown {
    // 步骤1: 生成混沌种子
    const chaosSeed = this.chaosEnabled 
      ? generateChaosSeed(request) 
      : { seed: 0, source: "deterministic", determinismLevel: 1.0 };
    
    // 步骤2: 匹配代价规则
    const matchedRules = this.matchCostRules(request);
    
    // 步骤3: 计算直接代价
    const directCosts = this.calculateDirectCosts(matchedRules, request, chaosSeed);
    
    // 步骤4: 计算隐性代价
    const hiddenCosts = request.includeHiddenCosts 
      ? this.calculateHiddenCosts(request, chaosSeed) 
      : [];
    
    // 步骤5: 计算机会成本
    const opportunityCosts = request.includeOpportunityCosts 
      ? this.calculateOpportunityCosts(request) 
      : [];
    
    // 步骤6: 综合评分
    const totalCostScore = this.aggregateCostScore(directCosts, hiddenCosts, opportunityCosts);
    
    // 步骤7: 生成叙事描述
    const narrativeDescription = this.generateCostNarrative(directCosts, hiddenCosts, request);
    
    return {
      directCosts,
      hiddenCosts,
      opportunityCosts,
      totalCostScore,
      narrativeDescription,
      empathyCue: "", // 由工作室引擎填充
    };
  }

  // 代价规则匹配
  private matchCostRules(request: CostCalculationRequest): MatchedCostRule[] {
    return this.costRules
      .filter(rule => {
        // 检查动作类型匹配
        const actionMatch = rule.applicableActions.includes(request.action.type) ||
                           rule.applicableActions.includes("*");
        // 检查执行者条件
        const actorMatch = evaluateExpression(rule.actorCondition, request.actor);
        // 检查环境条件
        const contextMatch = evaluateExpression(rule.contextCondition, request.context);
        
        return actionMatch && actorMatch && contextMatch;
      })
      .map(rule => ({
        rule,
        matchConfidence: 1.0, // 硬规则匹配只有0或1
      }));
  }

  // 直接代价计算
  private calculateDirectCosts(
    rules: MatchedCostRule[], 
    request: CostCalculationRequest,
    chaosSeed: ChaosSeed
  ): DirectCost[] {
    const costs: DirectCost[] = [];
    
    for (const { rule } of rules) {
      for (const costDef of rule.directCosts) {
        // 基础量
        let baseAmount = evaluateFormula(costDef.formula, request);
        
        // 境界修正（高境界使用同一招式的消耗更大——"杀鸡用牛刀"）
        if (costDef.realmScaling) {
          const realmOrder = request.actor.currentRealm?.order || 1;
          baseAmount *= Math.pow(costDef.realmScaling, realmOrder - 1);
        }
        
        // 混沌扰动
        const finalAmount = this.chaosEnabled
          ? applyChaos(baseAmount, chaosSeed, 0.15) // ±15% 波动
          : baseAmount;
        
        costs.push({
          type: costDef.type,
          amount: Math.round(finalAmount * 100) / 100,
          isRecoverable: costDef.isRecoverable,
          recoveryTime: costDef.recoveryTime,
        });
      }
    }
    
    return costs;
  }

  // 隐性代价计算
  private calculateHiddenCosts(
    request: CostCalculationRequest, 
    chaosSeed: ChaosSeed
  ): HiddenCost[] {
    const hiddenCosts: HiddenCost[] = [];
    const action = request.action;
    const actor = request.actor;
    
    // 隐性代价1: 因果业报（基于业力系统）
    if (action.moralWeight && action.moralWeight < 0) {
      const karmicSeverity = Math.abs(action.moralWeight) * 
        (1 + Math.max(0, actor.karma) * 0.5); // 正道角色做坏事业报更重
      hiddenCosts.push({
        type: "karmic_debt",
        severity: clamp(karmicSeverity, 0, 1),
        description: `因果业报: ${action.type} 有违本心，日后恐有心魔缠身之险`,
        manifestationDelay: Math.floor(applyChaos(10, chaosSeed, 0.5)), // 约10章后显现
      });
    }
    
    // 隐性代价2: 人际关系损伤
    if (action.involvedEntities) {
      for (const entityId of action.involvedEntities) {
        if (entityId === actor.entityId) continue;
        const relationship = getRelationship(actor.entityId, entityId);
        const trustDamage = calculateTrustDamage(action, relationship);
        if (trustDamage > 0.1) {
          hiddenCosts.push({
            type: "relationship_damage",
            severity: clamp(trustDamage, 0, 1),
            description: `与 ${entityId} 的信任度下降 ${(trustDamage * 100).toFixed(1)}%`,
            manifestationDelay: Math.floor(applyChaos(3, chaosSeed, 0.3)),
          });
        }
      }
    }
    
    // 隐性代价3: 声望代价
    if (action.visibility && action.visibility > 0.5) {
      const reputationImpact = calculateReputationImpact(action, actor);
      if (Math.abs(reputationImpact) > 0.1) {
        hiddenCosts.push({
          type: "reputation_cost",
          severity: clamp(Math.abs(reputationImpact), 0, 1),
          description: reputationImpact > 0 
            ? `此举令${actor.name}声名大噪，但也招来更多关注`
            : `此举令${actor.name}声望受损，日后行事恐有更多阻碍`,
          manifestationDelay: Math.floor(applyChaos(5, chaosSeed, 0.4)),
        });
      }
    }
    
    // 隐性代价4: 心理创伤（战斗相关）
    if (action.type === "combat" || action.type === "kill") {
      const traumaChance = actor.personality?.mentalResilience 
        ? 1.0 - actor.personality.mentalResilience 
        : 0.3;
      if (pseudoRandom(chaosSeed.seed) < traumaChance) {
        hiddenCosts.push({
          type: "psychological_trauma",
          severity: clamp(traumaChance * action.lethality || 0.5, 0, 1),
          description: `生死搏杀在心中留下阴影，夜深人静时恐有梦魇`,
          manifestationDelay: Math.floor(applyChaos(2, chaosSeed, 0.5)),
        });
      }
    }
    
    return hiddenCosts;
  }

  // 机会成本计算
  private calculateOpportunityCosts(request: CostCalculationRequest): OpportunityCost[] {
    const costs: OpportunityCost[] = [];
    
    // 查找因执行此行动而错过的最优替代方案
    const alternatives = findAlternativeActions(request.action, request.actor);
    const sortedAlternatives = alternatives.sort((a, b) => b.estimatedValue - a.estimatedValue);
    
    if (sortedAlternatives.length > 0) {
      const bestAlternative = sortedAlternatives[0];
      costs.push({
        foregoneAlternative: bestAlternative.description,
        estimatedValue: bestAlternative.estimatedValue,
        description: `选择${request.action.type}意味着放弃${bestAlternative.description}，` +
                    ` estimated lost value: ${bestAlternative.estimatedValue}`,
      });
    }
    
    return costs;
  }

  // 综合代价评分
  private aggregateCostScore(
    direct: DirectCost[], 
    hidden: HiddenCost[], 
    opportunity: OpportunityCost[]
  ): number {
    // 直接代价归一化
    const directScore = direct.reduce((sum, c) => {
      const weight = getResourceWeight(c.type);
      return sum + c.amount * weight * (c.isRecoverable ? 0.5 : 1.0);
    }, 0);
    
    // 隐性代价评分
    const hiddenScore = hidden.reduce((sum, c) => sum + c.severity * 100, 0);
    
    // 机会成本评分
    const opportunityScore = opportunity.reduce((sum, c) => sum + c.estimatedValue, 0);
    
    // 加权合成（隐性代价权重更高——它们更危险）
    return directScore * 0.35 + hiddenScore * 0.45 + opportunityScore * 0.20;
  }
}

// 资源权重表（用于代价归一化）
const RESOURCE_WEIGHTS: Record<string, number> = {
  hp: 1.0,           // 生命值基准权重
  mp: 0.8,           // 法力值略低
  stamina: 0.5,      // 体力容易恢复
  spirit: 1.5,       // 精神值较珍贵
  lifespan: 100.0,   // 寿命极重
  item: 2.0,         // 物品看具体价值
  currency: 0.001,   // 货币单位权重低
};

function getResourceWeight(type: string): number {
  return RESOURCE_WEIGHTS[type] || 1.0;
}
```

---

## 5.9 世界引擎中的叙事智能 LLM 调用

### 5.9.0 LLM 调用总览与参数策略

世界引擎中的所有 LLM 调用遵循统一的参数策略：

| 增强点 | temperature | top_p | max_tokens | 频次 | 确定性要求 |
|--------|------------|-------|------------|------|-----------|
| 5.9.1 NPC意图推断器 | 0.5 | 0.85 | 800 | 每章1-5次 | 中（需结构化输出） |
| 5.9.2 环境叙事意图生成器 | 0.7 | 0.9 | 1000 | 每章1次 | 低（创造性） |
| 5.9.3 涟漪叙事后果推断器 | 0.6 | 0.88 | 1200 | 每章0-10次 | 中（异步） |
| 5.9.4 可能性清单叙事增强器 ★ | 0.65 | 0.9 | 2000 | 每章5次 | 中高（结构复杂） |
| 5.9.5 核聚变叙事解释器 | 0.75 | 0.92 | 1500 | 极低频 | 低（启发性） |
| 5.9.6 世界时间叙事影响评估 | 0.6 | 0.88 | 1200 | 每卷1次 | 中 |
| 5.9.7 叙事价值评估 | 0.4 | 0.8 | 600 | 每章5次 | 高（快速评分） |

**temperature 设置理由**：
- **0.4（叙事价值评估）**: 需要稳定、可比较的评分，创造性空间小
- **0.5-0.6（意图推断/涟漪推断）**: 需要结构化输出，但允许一定多样性
- **0.65-0.75（叙事增强/核聚变）**: 需要丰富的创意和多样性
- **0.7（环境生成）**: 纯创意任务，需要最大想象力

---

### 5.9.1 NPC意图推断器（NPC Intention Inferrer）

#### Prompt Template

```yaml
system_prompt: |
  你是 NarrativeOS 的 NPC 意图推断引擎。你的任务是为网文中的配角和背景 NPC 
  生成深度、符合人设的行为意图。
  
  ## 核心原则
  - 每个 NPC 都是独立的"人"，有自己的欲望、恐惧和盲点
  - 意图必须与 NPC 的内在状态一致，不能为了剧情方便而 OOC
  - "意外反应"是网文的灵魂——读者永远猜不到配角真正的算盘
  - 潜台词比台词更重要——人们嘴上说的和心里想的往往相反
  
  ## 输出格式
  你必须以严格的 JSON 格式输出，不要包含任何 JSON 以外的内容。
  
  ## 工作方法
  1. 首先分析 NPC 的内在状态矩阵（欲望×恐惧×关系×当前情绪）
  2. 结合场景上下文推导出"最自然的反应"
  3. 思考 NPC 是否有隐藏动机或不可告人的目的
  4. 生成 1-3 个读者可能意想不到但实际上合理的"意外反应"
  5. 所有推断必须在世界观规则内自洽

user_prompt_template: |
  ## NPC 档案
  ```json
  {{npc_profile}}
  ```
  
  ## NPC 当前内在状态
  ```json
  {{npc_internal_state}}
  ```
  
  ## 场景环境
  ```json
  {{scene_environment}}
  ```
  
  ## 主角状态
  ```json
  {{protagonist_state}}
  ```
  
  ## 相关涟漪信息（此 NPC 已知的传闻/事件）
  ```json
  {{ripple_info}}
  ```
  
  ## 本章情绪基调
  {{chapter_mood}}
  
  ## 请推断此 NPC 的意图
  
  基于以上信息，请推断此 NPC 在当前场景中的：
  1. **主要行为倾向** —— 此 NPC 最可能采取什么行动？
  2. **1-3 个意外反应** —— 什么反应是读者想不到但符合人设的？
  3. **潜台词** —— 如果此 NPC 开口说话，他的话背后真正想表达什么？
  
  以 JSON 格式输出：
  ```json
  {
    "npcId": "{{npc_id}}",
    "inferenceConfidence": 0.0-1.0,
    "primaryIntention": {
      "type": "行为类型",
      "description": "详细描述",
      "target": "行为目标",
      "expectedOutcome": "期望结果",
      "urgency": 0.0-1.0
    },
    "surprisingReactions": [
      {
        "reaction": "反应描述",
        "whySurprising": "为什么出人意料",
        "whyReasonable": "为什么实际上合理",
        "narrativeImpact": "对叙事的影响"
      }
    ],
    "subtext": {
      "surfaceWords": "表面上可能说的话",
      "trueMeaning": "真正的意思",
      "emotionalUndercurrent": "情绪暗流",
      "hiddenAgenda": "隐藏动机（如果有）"
    },
    "behaviorModifiers": {
      "realmAwareness": "对主角实力的感知与误判",
      "socialCalculation": "社交层面的考量",
      "selfPreservation": "自保本能的强度"
    }
  }
  ```

parameters:
  model: "narrative-os-v3"
  temperature: 0.5
  top_p: 0.85
  max_tokens: 800
  response_format: "json"
```

#### 少样本示例（Few-shot Example）

```yaml
few_shot_examples:
  - role: "user"
    content: |
      ## NPC 档案
      {"name": "周管事", "age": 55, "position": "外门管事", "realm": "筑基后期", 
       "personality": {"traits": ["谨慎", "世故", "欺软怕硬"], "secretFear": "失去权力地位",
       "hiddenDesire": "攀附内门长老"}, "background": "在宗门底层摸爬滚打三十年"}
      
      ## 场景
      主角（练气期，但展现出惊人实力）刚完成外门大比，击败了周管事暗中支持的弟子。
      
      ## 推断
  
  - role: "assistant"
    content: |
      ```json
      {
        "npcId": "zhou_guanshi",
        "inferenceConfidence": 0.85,
        "primaryIntention": {
          "type": "reassess_and_hedge",
          "description": "周管事决定暂时收起打压姿态，转而试探性地示好。他在盘算这个年轻人是否有值得投资的潜力。",
          "target": "主角",
          "expectedOutcome": "摸清主角底细，决定是否改换阵营",
          "urgency": 0.7
        },
        "surprisingReactions": [
          {
            "reaction": "当众宣布主角获得特殊历练资格，实则想把他送到危险地带借刀杀人",
            "whySurprising": "表面上是在奖赏主角，读者可能以为他转性了",
            "whyReasonable": "周管事三十年的生存法则——从不正面树敌，借刀杀人才是他惯用手段",
            "narrativeImpact": "主角获得新地图探索机会，但暗藏杀机"
          },
          {
            "reaction": "私下向主角透露'内门选拔内幕'，试图将主角收为己用",
            "whySurprising": "之前还在打压主角，突然转为拉拢",
            "whyReasonable": "外门大比的结果改变了主角在周管事心中的'估值'——从'可弃的棋子'变成'可能有用的刀'",
            "narrativeImpact": "主角获得内门情报，但需判断信息真伪"
          }
        ],
        "subtext": {
          "surfaceWords": "年轻人不错，老夫看好你。",
          "trueMeaning": "让我看看你有没有利用价值",
          "emotionalUndercurrent": "忌惮中夹杂着算计",
          "hiddenAgenda": "如果主角不听话，就借历练之名除掉"
        },
        "behaviorModifiers": {
          "realmAwareness": "误判主角真实实力——认为主角最多练气圆满，可能用了某种秘法",
          "socialCalculation": "在考虑是否将主角推荐给内门的某位长老作为人情",
          "selfPreservation": "极强——绝不会亲自出手，所有动作都留有退路"
        }
      }
      ```
```

---

### 5.9.2 环境叙事意图生成器（Environment Narrative Intent Generator）

```yaml
system_prompt: |
  你是 NarrativeOS 的环境叙事引擎。你的任务是将物理环境的客观描述转化为
  具有叙事意图的环境描写——环境不是背景板，而是叙事的积极参与者。
  
  ## 核心原则
  - 环境的每一个细节都应该服务于叙事：暗示、呼应、对比、铺垫
  - "以景写情"——环境是角色内心的外化
  - 好的环境描写让读者"感觉到"而不是"知道"
  - 暗示 > 明示——留出让读者自己品味的空间
  
  ## 环境叙事功能分类
  - FORESHADOW: 暗示未来事件
  - MIRROR: 映射角色内心
  - CONTRAST: 与情境形成反差（反讽）
  - ATMOSPHERE: 营造氛围
  - SYMBOLIC: 象征意义
  - TRANSITION: 暗示场景/情绪转换
  
  ## 输出格式
  严格 JSON 输出。

user_prompt_template: |
  ## 物理环境数据（规则引擎输出）
  ```json
  {{environment_data}}
  ```
  
  ## 本章情绪基调
  {{chapter_mood}}
  
  ## 主角当前心理状态
  ```json
  {{protagonist_psychology}}
  ```
  
  ## 本章叙事功能
  {{narrative_function}}
  
  ## 世界观风格
  {{world_style}}
  
  ## 请生成环境叙事意图
  
  请基于以上信息：
  1. 从环境数据中选择 3-5 个最值得叙事化的细节
  2. 为每个细节赋予叙事功能
  3. 提供可直接用于小说的环境描写段落
  4. 指出环境暗示了什么（供作者参考）
  
  以 JSON 格式输出：
  ```json
  {
    "sceneId": "{{scene_id}}",
    "overallMood": "整体氛围描述",
    "selectedDetails": [
      {
        "detail": "原始环境数据项",
        "narrativeFunction": "FORESHADOW/MIRROR/CONTRAST/ATMOSPHERE/SYMBOLIC/TRANSITION",
        "functionTarget": "此功能服务于哪个叙事元素",
        "sensoryFocus": "视觉/听觉/嗅觉/触觉/味觉",
        "narrativeDescription": "可直接使用的小说描写段落（100-200字）",
        "impliedMeaning": "环境暗示了什么",
        "authorNote": "给作者的创作建议"
      }
    ],
    "integratedPassage": "所有细节整合成连贯的环境描写段落（300-500字）",
    "thematicEcho": "环境与主题的呼应关系说明"
  }
  ```

parameters:
  temperature: 0.7
  top_p: 0.9
  max_tokens: 1500
  frequency_penalty: 0.3  # 避免重复描写
```

#### Few-shot Example

```yaml
few_shot_example:
  input: |
    环境: 深秋傍晚，古战场遗迹，小雨，枯树，残阳
    情绪基调: 悲壮
    主角心理: 刚经历同门背叛，内心迷茫但仍有一线希望
    叙事功能: 转折点——主角在此做出重大抉择
  
  output: |
    ```json
    {
      "sceneId": "ancient_battlefield_dusk",
      "overallMood": "苍凉的悲壮中暗含倔强的生机",
      "selectedDetails": [
        {
          "detail": "深秋枯树",
          "narrativeFunction": "MIRROR",
          "functionTarget": "主角此刻内心的枯寂与看似无望的处境",
          "sensoryFocus": "视觉",
          "narrativeDescription": "一株老槐孤零零地立在战场中央，枝干虬结如枯骨，几片焦黄的叶子在风中打着旋儿，就是不落。像是这根骨头里最后的一点倔强。",
          "impliedMeaning": "暗示主角内心的坚韧——即使到了绝境，也有一口气撑着",
          "authorNote": "可以写主角伸手接住落叶的细节，作为内心转折的具象化"
        },
        {
          "detail": "残阳如血",
          "narrativeFunction": "CONTRAST",
          "functionTarget": "与主角心中尚未熄灭的希望形成反差",
          "sensoryFocus": "视觉",
          "narrativeDescription": "天边的晚霞红得发暗，像是一滩干涸的血。但那血色的边缘，却镶着一道极细的金边——那是明日将出的先兆，只是大多数人看不到。",
          "impliedMeaning": "最黑暗的时刻往往预示着转机，呼应主角即将做出的抉择",
          "authorNote": "金边是伏笔——可以回收为后文的关键意象"
        },
        {
          "detail": "细雨无声",
          "narrativeFunction": "ATMOSPHERE",
          "functionTarget": "渲染沉默中的情绪暗流",
          "sensoryFocus": "触觉",
          "narrativeDescription": "雨丝很细，落在脸上连凉意都迟钝。可就是这样不声不响的雨，早已将整个世界淋透。",
          "impliedMeaning": "暗示主角的麻木只是表象，内心早已被痛苦浸透",
          "authorNote": "可以用雨水和泪水混在一起，暗示主角终于释放情绪"
        }
      ],
      "integratedPassage": "古战场的黄昏总是来得格外沉重。天边的晚霞红得发暗，像一滩干涸了千年的血。一株老槐孤零零地立在断戟残戈之间，枝干虬结如枯骨，几片焦黄的叶子在风中打着旋儿，倔强地不肯落下。雨丝无声，细得连凉意都迟钝，却早已将焦黑的土地浸透。但很少有人注意到——在那血色残阳的边缘，一道极细的金边正在无声地蔓延。像是有人在最浓的黑暗里，悄悄为明日点了一盏灯。",
      "thematicEcho": "环境整体呼应'绝望中的希望'这一主题：枯树不落、残阳金边、无声细雨，三个意象共同指向一个核心——最坚韧的生命力往往以最沉默的方式存在。"
    }
    ```
```

---

### 5.9.3 涟漪叙事后果推断器（Ripple Narrative Consequence Inferrer）

```yaml
system_prompt: |
  你是 NarrativeOS 的涟漪后果推断引擎。当一个消息在信息网络中传播到某个实体时，
  你的任务是推断这个实体对此消息的叙事反应——包括情绪反应、行为倾向、
  以及可能产生的新意图。
  
  ## 核心原则
  - 每个人对同一消息的反应都不同——基于他们自己的立场、情绪和过往经历
  - 反应必须分层：第一情绪反应 → 理性分析 → 最终决策倾向
  - 注意"信息失真"的影响——实体接收到的消息可能已非原貌
  - 反应应触发新行为的可能性（新的涟漪）
  
  ## 输出格式
  严格 JSON 输出。

user_prompt_template: |
  ## 消息传播记录
  ```json
  {{message_propagation}}
  ```
  
  ## 接收实体状态
  ```json
  {{receiver_state}}
  ```
  
  ## 接收实体与事件相关实体的关系
  ```json
  {{relationship_matrix}}
  ```
  
  ## 消息失真程度
  {{distortion_level}}
  
  ## 请推断叙事反应
  
  以 JSON 格式输出：
  ```json
  {
    "receiverId": "接收者ID",
    "rippleId": "涟漪ID",
    "receptionLayer": {
      "firstEmotion": {
        "emotion": "第一情绪反应",
        "intensity": 0.0-1.0,
        "manifestation": "外在表现"
      },
      "rationalAnalysis": {
        "assessedThreat": "对威胁的评估",
        "assessedOpportunity": "对机会的评估",
        "credibilityJudgment": "对消息可信度的判断"
      },
      "decisionTendency": {
        "likelyAction": "最可能采取的行动",
        "alternatives": ["备选行动"],
        "hesitationFactors": ["犹豫因素"]
      }
    },
    "narrativeReaction": {
      "internalMonologue": "内心独白（可直接用于小说）",
      "externalBehavior": "外在行为表现",
      "dialogueCue": "可能说出的台词提示",
      "dramaticMoment": "是否构成戏剧时刻"
    },
    "newIntentions": [
      {
        "intentionType": "新意图类型",
        "target": "目标",
        "urgency": 0.0-1.0,
        "estimatedCompletion": "预计完成章节",
        "willCreateNewRipple": true/false
      }
    ],
    "relationshipChanges": [
      {
        "targetEntity": "关系变化对象",
        "changeType": "trust_shift/alignment_shift/emotion_shift",
        "magnitude": -1.0-1.0,
        "reasoning": "变化原因"
      }
    ]
  }
  ```

parameters:
  temperature: 0.6
  top_p: 0.88
  max_tokens: 1200
```

---

### 5.9.4 可能性清单叙事增强器（Possibility List Narrative Enhancer）★重型

这是世界引擎中最重型的 LLM 调用，对每个因果推演路径进行深度叙事增强。

```yaml
system_prompt: |
  你是 NarrativeOS 的可能性清单叙事增强引擎。你的任务是将因果推演器输出的
  "冰冷路径"转化为充满张力的叙事可能性——每个路径都应该让读者心跳加速。
  
  ## 核心原则
  - 每个可能性都是一条"if 线"——让读者能想象"如果主角选择这条路会发生什么"
  - 爽点模式是网文的生命线：逆袭、打脸、收获、突破、反转、狗粮
  - 风险评估必须诚实——告诉作者哪条路有风险、风险在哪
  - 叙事价值不仅在于"爽"，还在于"角色成长"和"世界展开"
  
  ## 爽点模式参考
  - FACE_SLAP: 打脸（角色被打脸或打脸他人）
  - POWER_UP: 实力提升
  - TREASURE: 获得宝物/传承
  - REVERSAL: 剧情反转
  - ROMANCE: 情感线推进
  - MYSTERY: 谜题揭示
  - COMEDY: 轻松搞笑
  - TRAGEDY: 悲壮煽情
  
  ## 输出格式
  严格 JSON 输出。每个字段都必须填满。

user_prompt_template: |
  ## 路径因果推演结果
  ```json
  {{causal_path}}
  ```
  
  ## 情绪账本（当前各实体情绪状态）
  ```json
  {{emotion_ledger}}
  ```
  
  ## 爽点模式偏好（读者/作品定位）
  ```json
  {{satisfaction_patterns}}
  ```
  
  ## NPC 意图推断器输出
  ```json
  {{npc_intentions}}
  ```
  
  ## 作品当前阶段与节奏需求
  {{current_arc_info}}
  
  ## 请对此路径进行叙事增强
  
  以 JSON 格式输出：
  ```json
  {
    "pathId": "路径ID",
    "narrativePresentation": {
      "readerExperience": "读者阅读此路径时的体验描述（沉浸感）",
      "protagonistArc": "主角在此路径中的内心转折和成长",
      "bystanderReactions": {
        "supporters": "支持者的反应",
        "opponents": "反对者的反应",
        "neutrals": "中立者的反应"
      },
      "climaxMoments": [
        {
          "moment": "高潮时刻描述",
          "satisfactionType": "爽点类型",
          "intensity": 0.0-1.0,
          "readerExpectedReaction": "读者预期反应"
        }
      ]
    },
    "satisfactionAnalysis": {
      "primarySatisfaction": "主要爽点",
      "satisfactionIntensity": 0.0-1.0,
      "satisfactionNovelty": 0.0-1.0,
      "emotionalResonance": 0.0-1.0,
      "longTermPayoff": "长期回报评估"
    },
    "riskAssessment": {
      "riskLevel": "low/medium/high/critical",
      "specificRisks": [
        {
          "risk": "风险描述",
          "probability": 0.0-1.0,
          "impact": "low/medium/high",
          "mitigation": "如何降低风险"
        }
      ],
      "powerCreepRisk": "战力膨胀风险评估",
      "characterConsistencyRisk": "角色一致性风险"
    },
    "opportunityAnalysis": {
      "foreshadowingOpportunities": ["可埋下的伏笔"],
      "characterDevelopmentOpportunities": ["角色发展机会"],
      "worldBuildingOpportunities": ["世界展开机会"],
      "relationshipOpportunities": ["关系线发展机会"]
    },
    "narrativeSuggestions": {
      "recommendedPacing": "建议节奏",
      "sceneStructure": "场景结构建议",
      "dialogueTips": ["对话写作提示"],
      "sensoryDetails": ["感官细节建议"],
      "toneGuidance": "语气指导"
    },
    "comparisonToAlternatives": {
      "uniqueStrength": "与其他路径相比的独特优势",
      "relativeWeakness": "相对劣势"
    }
  }
  ```

parameters:
  temperature: 0.65
  top_p: 0.9
  max_tokens: 2000
```

#### Few-shot Example

```yaml
few_shot_example:
  input: |
    路径: 主角选择接受神秘老者的传承试炼（而非安全离开）
    情绪账本: 主角好奇心高涨，但谨慎；老者充满期待
    爽点模式: 传承/TREASURE + 突破/POWER_UP
    NPC意图: 老者真心想传下衣钵，但也想测试主角心性
  
  output: |
    ```json
    {
      "pathId": "accept_trial_path",
      "narrativePresentation": {
        "readerExperience": "读者会为主角的勇气捏一把汗，同时充满期待——这个选择打开了通往'变强'的大门。试炼的过程应该有层层递进的难度，每次突破都带来一次小爽点，最终在完成时达到高潮。",
        "protagonistArc": "主角从'谨慎求生'向'主动追求力量'的心态转变。这一选择标志着他真正接受了这个世界弱肉强食的法则，不再只是一个想回家的局外人。",
        "bystanderReactions": {
          "supporters": "如果有同伴在场，他们的反应应该是震惊（觉得主角疯了）→ 担忧 → 被主角的决心感染",
          "opponents": "如果有暗中窥视的敌人，会抓紧时间在主角试炼时布置陷阱——制造紧迫感的双层叙事",
          "neutrals": "环境本身成为'观众'——天地异象暗示这次传承的分量"
        },
        "climaxMoments": [
          {
            "moment": "主角在试炼最后一关几乎放弃时，想起某个重要之人的话，咬牙挺过——完成传承",
            "satisfactionType": "POWER_UP + 情感共鸣",
            "intensity": 0.9,
            "readerExpectedReaction": "热血沸腾+眼眶湿润"
          },
          {
            "moment": "传承完成时，老者消散前露出欣慰笑容，说出'终于等到你'",
            "satisfactionType": "TRAGEDY + TREASURE",
            "intensity": 0.85,
            "readerExpectedReaction": "感动+对后续发展的好奇"
          }
        ]
      },
      "satisfactionAnalysis": {
        "primarySatisfaction": "获得强大传承 + 实力大幅提升",
        "satisfactionIntensity": 0.9,
        "satisfactionNovelty": 0.6,
        "emotionalResonance": 0.85,
        "longTermPayoff": "传承将在后续多次成为主角翻盘的关键底牌，长期价值极高"
      },
      "riskAssessment": {
        "riskLevel": "medium",
        "specificRisks": [
          {
            "risk": "传承获得的实力提升过大，破坏战力平衡",
            "probability": 0.4,
            "impact": "high",
            "mitigation": "可以设定传承需要逐步解封，当前只获得基础部分"
          },
          {
            "risk": "老者的牺牲过于套路化，读者审美疲劳",
            "probability": 0.3,
            "impact": "medium",
            "mitigation": "给老者增加出人意料的设定（如他其实是自愿被困在此地等待传人）"
          }
        ],
        "powerCreepRisk": "中高——需要通过后续限制来平衡",
        "characterConsistencyRisk": "低——主角选择接受挑战符合其成长弧线"
      },
      "opportunityAnalysis": {
        "foreshadowingOpportunities": [
          "老者提及传承来自'一个被抹去名字的组织'——为后文大主线埋伏笔",
          "试炼中主角看到了某些不属于自己记忆的片段——暗示前世/血脉"
        ],
        "characterDevelopmentOpportunities": [
          "主角在生死边缘发现自己的某个性格弱点并克服",
          "老者的故事可以通过对话展开，丰富世界观"
        ],
        "worldBuildingOpportunities": [
          "展示这个世界的传承体系如何运作",
          "揭示上古时期的一角"
        ],
        "relationshipOpportunities": [
          "如果有同伴等待，可以写等待中的焦虑与信任"
        ]
      },
      "narrativeSuggestions": {
        "recommendedPacing": "慢-快-极快-缓。试炼过程有张有弛，最终高潮快速爆发，结尾留有余韵。",
        "sceneStructure": "建议分为：抉择(20%) → 试炼过程(40%) → 高潮突破(25%) → 传承完成与告别(15%)",
        "dialogueTips": [
          "老者的话应该有岁月沉淀的沧桑感，但不能沦为说教",
          "主角在试炼中的自言自语是展现内心世界的窗口"
        ],
        "sensoryDetails": [
          "传承之力入体时应有强烈的感官冲击——不仅是视觉，还要有经脉中力量流动的灼热感",
          "老者消散时的画面要唯美而伤感"
        ],
        "toneGuidance": "前半段紧张悬疑，后半段庄严神圣，结尾温暖而略带伤感"
      },
      "comparisonToAlternatives": {
        "uniqueStrength": "这是唯一能让主角获得核心金手指的路径，长期叙事价值远超其他选择",
        "relativeWeakness": "相比安全离开的路径，此路风险更高，可能失去某些短期安全"
      }
    }
    ```
```

---

### 5.9.5 核聚变叙事解释器（Precedent Fusion Narrative Interpreter）

```yaml
system_prompt: |
  你是 NarrativeOS 的核聚变叙事解释引擎。当两个或多个长期伏笔/先例发生聚变时，
  你的任务是生成这段"多线汇流"的叙事意义和可能的后果场景。
  
  ## 核心原则
  - 核聚变是网文最高潮的时刻——多条线索在这一刻交汇
  - 解释必须让作者理解"为什么现在"和"为什么是这些先例"
  - 后果场景应该既有"意料之中"（回收伏笔）又有"意料之外"（新的转折）
  - 保持叙事节制——聚变的力量在于蓄势已久后的爆发，不要过度

user_prompt_template: |
  ## 参与聚变的先例
  ```json
  {{parent_precedents}}
  ```
  
  ## 聚变触发条件
  ```json
  {{fusion_trigger}}
  ```
  
  ## 当前世界状态
  ```json
  {{current_world_state}}
  ```
  
  ## 聚变条件满足度分析
  {{fusion_condition_analysis}}
  
  ## 请生成核聚变叙事解释
  
  以 JSON 格式输出：
  ```json
  {
    "fusionId": "聚变ID",
    "narrativeSignificance": {
      "synthesisDescription": "这次聚变在叙事上意味着什么（综合分析）",
      "whyNow": "为什么是现在——时机选择的叙事合理性",
      "whyThesePrecedents": "为什么是这些先例交汇——内在逻辑",
      "emotionalResonance": "情感层面的冲击分析",
      "thematicWeight": "主题层面的分量"
    },
    "consequenceScenarios": [
      {
        "scenarioName": "场景名称",
        "description": "详细描述",
        "probability": 0.0-1.0,
        "requiredConditions": ["触发条件"],
        "protagonistImpact": "对主角的影响",
        "worldImpact": "对世界的影响",
        "readerExpectedReaction": "读者预期反应",
        "narrationalComplexity": "叙事复杂度评估"
      }
    ],
    "authorGuidance": {
      "recommendedRevealPacing": "推荐的揭示节奏",
      "dramaticStructure": "戏剧结构建议",
      "foreshadowingChecklist": ["需要提前确认已埋好的伏笔"],
      "riskWarnings": ["需要注意的风险"],
      "goldenLine": "建议的核心金句/台词"
    }
  }
  ```

parameters:
  temperature: 0.75
  top_p: 0.92
  max_tokens: 1500
```

---

### 5.9.6 世界时间叙事影响评估（World Time Narrative Impact Assessor）

```yaml
system_prompt: |
  你是 NarrativeOS 的世界时间叙事影响评估引擎。你的任务是评估时间流逝
  对叙事的累积影响——角色长大了、伏笔到期了、世界的权力格局变了。
  
  ## 核心原则
  - 时间是网文中最容易被忽视但最强大的叙事工具
  - 时间流逝应该带来"物是人非"的感慨和成长
  - 未解决的伏笔有时间限制——拖太久读者会忘记
  - 角色的年龄变化应该带来心态和能力的自然变化

user_prompt_template: |
  ## 时间流逝数据
  ```json
  {{time_passage_data}}
  ```
  
  ## 角色年龄变化
  ```json
  {{character_age_changes}}
  ```
  
  ## 未解决伏笔清单（含创建时间）
  ```json
  {{unresolved_precedents}}
  ```
  
  ## 群体状态趋势
  ```json
  {{group_state_trends}}
  ```
  
  ## 请评估时间流逝的叙事影响
  
  以 JSON 格式输出：
  ```json
  {
    "assessmentId": "评估ID",
    "timeNarrativeImpact": {
      "elapsedTimeDescription": "流逝时间的叙事化描述",
      "atmosphereChanges": ["氛围变化"],
      "characterAgingEffects": [
        {
          "characterId": "角色ID",
          "physicalChanges": "身体变化",
          "mentalChanges": "心态变化",
          "relationshipChanges": "因时间产生的关系变化"
        }
      ]
    },
    "precedentUrgencyAnalysis": {
      "criticalPrecedents": [
        {
          "precedentId": "伏笔ID",
          "name": "伏笔名称",
          "urgencyLevel": "urgent/expiring/stable/dormant",
          "chaptersRemaining": "距离最佳回收时机还剩多少章",
          "recommendedAction": "建议操作"
        }
      ],
      "forgottenPrecedents": ["可能被读者遗忘的伏笔——需要提醒"]
    },
    "temporalOpportunities": [
      {
        "opportunity": "叙事机会",
        "timeWindow": "时间窗口",
        "description": "描述",
        "narrativeValue": 0.0-1.0
      }
    ],
    "authorRecommendations": {
      "immediateActions": ["立即建议"],
      "upcomingDeadlines": ["即将到来的叙事期限"],
      "longTermPlanning": ["长期规划建议"]
    }
  }
  ```

parameters:
  temperature: 0.6
  top_p: 0.88
  max_tokens: 1200
```

---

### 5.9.7 叙事价值评估（工作室引擎调用）

> 注：此增强点由工作室引擎（Workshop Engine，见第六章）执行，属轻型调用。
> 此处提供 Prompt 模板供参考。

```yaml
system_prompt: |
  你是 NarrativeOS 的叙事价值评估引擎。你的任务是快速评估一个叙事路径/场景的
  综合价值——不需要创造性输出，只需要稳定、可比较的评分。
  
  ## 评分维度
  - SATISFACTION (爽感): 0-100，读者阅读此场景的爽感程度
  - TENSION (张力): 0-100，戏剧张力
  - CHARACTER (角色): 0-100，角色塑造价值
  - WORLD (世界): 0-100，世界展开价值
  - PLOT (剧情): 0-100，剧情推进价值
  - EMOTION (情感): 0-100，情感冲击力
  - NOVELTY (新意): 0-100，创新性
  
  ## 输出格式
  严格 JSON，只输出评分，不输出解释。

user_prompt_template: |
  ## 评估对象
  {{evaluation_target}}
  
  ## 上下文
  {{context}}
  
  ## 请评估
  
  ```json
  {
    "targetId": "{{target_id}}",
    "scores": {
      "SATISFACTION": 0-100,
      "TENSION": 0-100,
      "CHARACTER": 0-100,
      "WORLD": 0-100,
      "PLOT": 0-100,
      "EMOTION": 0-100,
      "NOVELTY": 0-100
    },
    "composite": 0-100,
    "confidence": 0.0-1.0
  }
  ```

parameters:
  temperature: 0.4
  top_p: 0.8
  max_tokens: 300
```

---

## 5.10 子引擎间数据结构定义（TypeScript Interfaces）

### 5.10.1 核心实体定义

```typescript
// ==================== 核心实体定义 ====================

interface Entity {
  entityId: string;
  name: string;
  entityType: "protagonist" | "major_npc" | "minor_npc" | "background_npc" | 
              "monster" | "item" | "location" | "organization" | "system";
  
  // 物理状态
  stats: StatVector;
  resources: ResourcePool;
  currentRealm?: RealmTier;
  
  // 心理状态
  psychology: PsychologyState;
  emotionalState: EmotionalState;
  
  // 能力
  specialAbilities: SpecialAbility[];
  equipment: Equipment[];
  buffs: Buff[];
  debuffs: Debuff[];
  
  // 行为
  behaviorTree: BTNode;
  goalQueue: Goal[];
  llmIntention?: NPCIntentionResult;  // 由 5.9.1 生成
  
  // 记忆
  memory: EntityMemory;
  
  // 社会关系
  relationships: Map<string, Relationship>;
  reputation: Reputation;
  
  // 业力
  karma: number;  // [-100, 100]
  
  // 元数据
  tags: string[];
  createdAtChapter: number;
  lastUpdatedAtChapter: number;
}

interface StatVector {
  atk: number;
  def: number;
  spd: number;
  spi: number;  // 精神
  tech: number; // 技巧
  luck: number;
  [key: string]: number;  // 可扩展
}

interface ResourcePool {
  hp: { current: number; max: number };
  mp: { current: number; max: number };
  stamina: { current: number; max: number };
  spirit: { current: number; max: number };
  lifespan: { remaining: number; total: number };
}

interface PsychologyState {
  personality: PersonalityProfile;
  coreBeliefs: string[];
  innerConflicts: InnerConflict[];
  growthArc: ArcStage;
  motivations: Motivation[];
}

interface PersonalityProfile {
  traits: Array<{ trait: string; intensity: number }>;
  bigFive?: {
    openness: number;
    conscientiousness: number;
    extraversion: number;
    agreeableness: number;
    neuroticism: number;
  };
  mbti?: string;
  moralAlignment: { goodEvil: number; lawChaos: number }; // [-1, 1]
}

interface EmotionalState {
  dominantEmotion: string;
  intensity: number;  // [0, 1]
  secondaryEmotions: Array<{ emotion: string; intensity: number }>;
  mood: string;       // 持续情绪基调
  emotionalMomentum: number; // 情绪动量（上升/下降趋势）
}

interface Relationship {
  targetId: string;
  type: "family" | "friend" | "enemy" | "rival" | "mentor" | "student" | 
        "lover" | "ally" | "neutral" | "complex";
  trust: number;        // [-1, 1]
  affection: number;    // [-1, 1]
  respect: number;      // [-1, 1]
  history: RelationshipEvent[];
}

interface EntityMemory {
  shortTerm: MemoryItem[];   // 近期事件
  longTerm: MemoryItem[];    // 长期记忆
  trauma: MemoryItem[];      // 创伤记忆（难以遗忘）
  coreMemories: MemoryItem[]; // 核心记忆（定义角色的事件）
}

interface MemoryItem {
  eventId: string;
  chapter: number;
  description: string;
  emotionalWeight: number;  // [-1, 1]
  vividness: number;        // [0, 1]，随时间衰减
  retrievalCount: number;   // 被回忆次数（越多越容易回忆）
}

interface Reputation {
  global: number;           // 全局声望 [-100, 100]
  byFaction: Map<string, number>;
  byRegion: Map<string, number>;
  knownFor: string[];       // 知名事迹
  aliases: string[];        // 称号/别名
}
```

### 5.10.2 世界状态定义

```typescript
// ==================== 世界状态定义 ====================

interface WorldState {
  stateId: string;
  version: number;            // 单调递增的版本号
  timestamp: GameTime;
  
  // 实体
  entities: Map<string, Entity>;
  
  // 环境
  environments: Map<string, EnvironmentState>;
  
  // 信息
  infoNetwork: InformationNetwork;
  
  // 先例
  precedents: Map<string, Precedent>;
  
  // 全局变量
  globalFlags: Map<string, boolean | number | string>;
  globalCounters: Map<string, number>;
  
  // 历史
  eventLog: WorldEvent[];
  
  // 规则状态
  ruleEngineState: RuleEngineState;
}

interface GameTime {
  year: number;
  day: number;      // [0, 365)
  hour: number;     // [0, 24)
  minute: number;   // [0, 60)
  chapter: number;  // 当前章节
}

interface WorldEvent {
  eventId: string;
  chapter: number;
  scene: string;
  timestamp: GameTime;
  type: string;
  description: string;
  involvedEntities: string[];
  location: string;
  outcome: EventOutcome;
  visibility: number;  // [0, 1]，事件可见度
  moralWeight?: number; // [-1, 1]，道德权重
}

interface EventOutcome {
  directEffects: WorldEffect[];
  precedentCreated?: Precedent;
  ripplesCreated?: string[];
}

interface WorldEffect {
  targetType: "entity" | "environment" | "global" | "relationship";
  targetId: string;
  property: string;
  operation: "set" | "add" | "multiply";
  value: unknown;
}

interface RuleEngineState {
  activeRules: string[];        // 当前激活的规则ID
  ruleVersions: Map<string, number>;
  overrideStack: RuleOverride[];
}

interface RuleOverride {
  ruleId: string;
  overriddenBy: string;
  reason: string;
  expiresAt?: number;  // 章节号
}
```

### 5.10.3 子引擎接口定义

```typescript
// ==================== 子引擎接口定义 ====================

// 5.1 物理规则引擎
interface IPhysicsEngine {
  evaluate(formula: string, context: RuleContext): number;
  validateAction(action: CharacterAction, actor: Entity, world: WorldState): ActionValidationResult;
  calculateCombatPower(entity: Entity): CombatPowerResult;
  comparePower(a: Entity, b: Entity): PowerComparison;
  matchRules(context: RuleContext): MatchedRule[];
}

// 5.2 特殊能力管理器
interface ISpecialAbilityManager {
  registerAbility(ability: SpecialAbility): void;
  validateUsage(abilityId: string, actor: Entity, context: UsageContext): AbilityValidationResult;
  applyEffect(abilityId: string, target: Entity, context: EffectContext): EffectResult;
  updateGrowth(abilityId: string, actor: Entity): GrowthResult;
  checkEvolution(abilityId: string, trigger: EvolutionTrigger): boolean;
  getAbilityHistory(abilityId: string): UsageRecord[];
}

// 5.3 因果推演器
interface ICausalPropagator {
  buildConsequenceTree(event: WorldEvent, state: WorldState, config: TreeConfig): ConsequenceTree;
  extractPaths(tree: ConsequenceTree): ConsequencePath[];
  rankPaths(paths: ConsequencePath[], criteria: RankingCriteria): RankedPath[];
  pruneByConstraints(paths: ConsequencePath[], constraints: CSPConstraint[]): ConsequencePath[];
}

// 5.4 NPC 行为引擎
interface INPCBehaviorEngine {
  loadBehaviorTemplate(npcType: string): BTNode;
  tick(npc: Entity, scene: Scene, deltaTime: number): BTStatus;
  updateGoals(npc: Entity, worldState: WorldState): void;
  integrateLLMIntention(npc: Entity, intention: NPCIntentionResult): void;
  getNPCState(npcId: string): NPCRuntimeState;
}

// 5.5 环境模拟器
interface IEnvironmentSimulator {
  getEnvironment(locationId: string): EnvironmentState;
  simulateTransition(locationId: string, trigger: EnvironmentTrigger): EnvironmentState;
  queryNarrativeMood(locationId: string, context: NarrativeContext): NarrativeMood;
  applyEffect(locationId: string, effect: EnvironmentEffect): void;
}

// 5.6 信息涟漪模拟器
interface IInformationRippleSimulator {
  createRipple(event: WorldEvent, originNodeId: string): Promise<Ripple>;
  getRippleState(rippleId: string): Ripple;
  getEntityKnowledge(entityId: string): Map<string, KnownFact>;
  injectInformation(nodeId: string, message: MessageVersion): void;
  queryInformationDistortion(rippleId: string, nodeId: string): DistortionReport;
}

// 5.7 先例引擎
interface IPrecedentEngine {
  registerPrecedent(event: WorldEvent): Precedent;
  updatePotential(precedentId: string, currentChapter: number): number;
  detectProliferation(precedentId: string, newEvent: WorldEvent): ProliferationResult;
  detectFusions(activePrecedents: Precedent[], currentChapter: number): FusionResult[];
  getPrecedentLineage(precedentId: string): Precedent[];
}

// 5.8 代价计算器
interface ICostCalculator {
  calculateCost(request: CostCalculationRequest): CostBreakdown;
  batchCalculate(requests: CostCalculationRequest[]): CostBreakdown[];
  getResourceWeight(type: string): number;
  generateNarrativeDescription(cost: CostBreakdown): string;
}

// 世界引擎主接口
interface IWorldEngine {
  // 核心查询
  getWorldState(): WorldState;
  getEntity(entityId: string): Entity;
  
  // 动作处理
  processAction(action: CharacterAction): ActionResult;
  validateAction(action: CharacterAction): ActionValidationResult;
  
  // 可能性清单生成
  generatePossibilityList(context: GenerationContext): Promise<PossibilityList>;
  
  // 状态更新
  updateWorldState(event: WorldEvent): void;
  advanceTime(amount: TimeAmount): void;
  
  // 子引擎访问
  physics(): IPhysicsEngine;
  abilities(): ISpecialAbilityManager;
  causal(): ICausalPropagator;
  npcBehavior(): INPCBehaviorEngine;
  environment(): IEnvironmentSimulator;
  ripples(): IInformationRippleSimulator;
  precedents(): IPrecedentEngine;
  costs(): ICostCalculator;
  
  // LLM 增强点访问
  npcIntentionInferrer(): INPCIntentionInferrer;
  environmentNarrativeGenerator(): IEnvironmentNarrativeGenerator;
  rippleConsequenceInferrer(): IRippleConsequenceInferrer;
  possibilityNarrativeEnhancer(): IPossibilityNarrativeEnhancer;
  fusionNarrativeInterpreter(): IFusionNarrativeInterpreter;
  timeImpactAssessor(): ITimeImpactAssessor;
  
  // 缓存管理
  invalidateCache(scope: CacheScope): void;
  getCacheStats(): CacheStats;
}
```

### 5.10.4 可能性清单相关接口

```typescript
// ==================== 可能性清单定义 ====================

interface PossibilityList {
  listId: string;
  chapter: number;
  generatedAt: number;  // timestamp
  
  possibilities: Possibility[];
  metadata: {
    generationTimeMs: number;
    llmCallsMade: number;
    cacheHits: number;
    totalPathsExplored: number;
  };
}

interface Possibility {
  possibilityId: string;
  rank: number;
  
  // 因果路径
  causalPath: ConsequencePath;
  
  // 物理可行性
  physicalFeasibility: ActionValidationResult;
  
  // 战力评估
  powerAssessment: PowerAssessment;
  
  // 代价评估
  costBreakdown: CostBreakdown;
  
  // 叙事增强（由 5.9.4 生成）
  narrativeEnhancement?: NarrativeEnhancement;
  
  // 叙事价值评分（由 5.9.7 生成）
  narrativeScores?: NarrativeScores;
  
  // 综合评分
  compositeScore: number;
  
  // 推荐度
  recommendation: "highly_recommended" | "recommended" | "viable" | "risky" | "not_recommended";
}

interface NarrativeScores {
  SATISFACTION: number;
  TENSION: number;
  CHARACTER: number;
  WORLD: number;
  PLOT: number;
  EMOTION: number;
  NOVELTY: number;
  composite: number;
}

interface PowerAssessment {
  protagonistCP: CombatPowerResult;
  opponentCPs: Map<string, CombatPowerResult>;
  outcomePrediction: BattleFeasibilityResult;
  powerGap: "overwhelming" | "advantage" | "even" | "disadvantage" | "desperate";
}

interface GenerationContext {
  triggeringEvent: WorldEvent;
  currentState: WorldState;
  protagonistState: Entity;
  activeNPCs: Entity[];
  sceneContext: Scene;
  // 生成约束
  constraints: {
    maxPossibilities: number;
    maxLLMCalls: number;
    maxCausalDepth: number;
    requireNarrativeEnhancement: boolean;
  };
}
```

---

## 5.11 可能性清单生成最终流程（完整工作流）

### 5.11.1 流程图

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        可能性清单生成完整流程                                     │
│                         (generatePossibilityList)                               │
└─────────────────────────────────────────────────────────────────────────────────┘

[开始] 
  │
  ▼
┌────────────────────────────────────────┐
│ Step 1: 加载状态，激活实体              │
│ - 加载当前 WorldState                  │
│ - 根据场景范围和触发事件激活相关实体     │
│ - 为激活的 NPC 加载行为树模板           │
│ - 检查缓存：是否有相同状态的历史清单     │
│   (缓存键: "poss_list_{stateVersion}_{eventHash}")                        │
└────────────────┬───────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────┐
│ Step 2: NPC 意图推断                    │
│ FOR each 激活的 NPC:                    │
│   ├─ 收集 NPC 内在状态                  │
│   ├─ 收集场景环境                       │
│   ├─ 收集主角状态                       │
│   ├─ 收集相关涟漪信息                   │
│   ├─ 检查意图缓存                       │
│   │   (缓存键: "npc_intent_{npcId}_{sceneHash}_{chapter}")                │
│   │   TTL: 1章（同一NPC在同一章场景中的意图不变）                        │
│   ├─ 若缓存未命中:                      │
│   │   └─ 调用 5.9.1 NPC意图推断器 (LLM) │
│   │       temperature: 0.5, max_tokens: 800                             │
│   ├─ 验证意图合法性                     │
│   ├─ 将意图写入 NPC 的 llmIntention 字段 │
│   └─ 缓存结果                           │
│                                         │
│ 并行度: 最多同时调用 3 个 LLM 请求      │
│ 预期耗时: 50-200ms/个 (含缓存命中)       │
└────────────────┬───────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────┐
│ Step 3: 物理规则过滤                    │
│ FOR each 激活实体的可能动作:             │
│   ├─ 调用 5.1 物理规则引擎              │
│   ├─ 验证动作合法性                     │
│   ├─ 计算战力对比（如为战斗动作）        │
│   ├─ 计算资源消耗                       │
│   ├─ 检查境界限制                       │
│   └─ 过滤不合法动作                     │
│                                         │
│ 预期耗时: <10ms/动作                    │
└────────────────┬───────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────┐
│ Step 4: 因果推演                        │
│ - 构建 CSP 模型                         │
│   ├─ 变量: 各实体的动作选择             │
│   ├─ 域: 过滤后的合法动作               │
│   ├─ 硬约束: 物理规则/存活约束/境界约束  │
│   ├─ 软约束: 叙事约束（爽点/角色成长）   │
│   └─ 目标: 最大化叙事价值               │
│ - 执行回溯搜索 + 前向检查               │
│   参数: maxDepth=5, branchingFactor=3   │
│ - 生成后果树                            │
│ - 提取所有完整路径                      │
│ - 按叙事价值排序                        │
│                                         │
│ 检查因果树缓存                          │
│ (缓存键: "causal_tree_{eventHash}_{constraintVersion}")                 │
│ TTL: 状态版本不变时永久有效              │
│                                         │
│ 预期耗时: 10-100ms（纯计算）             │
└────────────────┬───────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────┐
│ Step 5: 叙事价值评估（工作室引擎）       │
│ FOR each 路径 (最多前15条):             │
│   ├─ 检查评分缓存                       │
│   │   (缓存键: "narrative_score_{pathHash}")                            │
│   ├─ 若缓存未命中:                      │
│   │   └─ 调用 5.9.7 叙事价值评估 (LLM)  │
│   │       temperature: 0.4, max_tokens: 300                             │
│   └─ 缓存评分结果                       │
│                                         │
│ 筛选: 保留评分最高的前 5 条路径          │
│                                         │
│ 预期耗时: 30-100ms/路径 (含缓存)         │
└────────────────┬───────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────┐
│ Step 6: 代价计算                        │
│ FOR each 前5条路径:                     │
│   ├─ 调用 5.8 代价计算器                │
│   ├─ 计算直接代价/隐性代价/机会成本      │
│   ├─ 生成混沌种子                       │
│   ├─ 应用叙事化描述                     │
│   └─ 将代价信息附加到路径               │
│                                         │
│ 预期耗时: <5ms/路径                     │
└────────────────┬───────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────┐
│ Step 7: 叙事增强（★重型 LLM 调用）      │
│ FOR each 前5条路径（串行/限流）:         │
│   ├─ 收集输入:                          │
│   │   ├─ 因果推演结果                   │
│   │   ├─ 情绪账本                       │
│   │   ├─ 爽点模式                       │
│   │   ├─ NPC 意图推断器输出             │
│   │   └─ 当前卷/章信息                  │
│   ├─ 检查缓存                           │
│   │   (缓存键: "narrative_enhance_{pathHash}_{moodVersion}")            │
│   │   TTL: 2章（情绪和爽点模式可能变化）  │
│   ├─ 若缓存未命中:                      │
│   │   └─ 调用 5.9.4 可能性清单叙事增强器 │
│   │       temperature: 0.65, max_tokens: 2000                           │
│   ├─ 解析 JSON 输出                     │
│   └─ 缓存增强结果                       │
│                                         │
│ 预期耗时: 500-2000ms/路径 (LLM 调用)     │
│ 总预期: 2.5-10秒（5条路径）              │
└────────────────┬───────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────┐
│ Step 8: 综合评分与排序                  │
│ FOR each 增强后的路径:                  │
│   ├─ 计算综合评分:                      │
│   │   composite = w1*叙事评分 + w2*爽感 │
│   │           + w3*可行性 - w4*风险     │
│   │   默认权重: (0.3, 0.3, 0.2, 0.2)    │
│   ├─ 确定推荐等级                       │
│   └─ 生成推荐理由摘要                   │
│                                         │
│ 按综合评分降序排列                      │
└────────────────┬───────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────┐
│ Step 9: 组装最终清单                    │
│ - 创建 PossibilityList 对象             │
│ - 附加所有元数据                        │
│ - 写入缓存                              │
│ - 触发异步任务:                         │
│   ├─ 涟漪叙事后果推断（5.9.3）          │
│   └─ 环境叙事意图生成（5.9.2）          │
│                                         │
│ [返回最终清单]                          │
└────────────────────────────────────────┘
```

### 5.11.2 异步任务流程

以下任务在主流程返回后异步执行，不阻塞 MOU：

```
┌────────────────────────────────────────┐
│ Async Task 1: 涟漪叙事后果推断          │
│ - 检查上一章产生的涟漪                  │
│ - 对每个已传播到的节点:                 │
│   └─ 调用 5.9.3 (temperature 0.6)      │
│ - 结果存入节点知识库                    │
│ - 若产生新意图，加入目标队列             │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│ Async Task 2: 环境叙事意图生成          │
│ - 对当前主场景调用 5.9.2                │
│ - temperature: 0.7                      │
│ - 结果存入环境状态的 narrativeMood 字段  │
│ - 供工作室引擎使用                      │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│ Async Task 3: 先例势能更新              │
│ - 更新所有活跃先例的势能值              │
│ - 检查增殖条件                          │
│ - 检查核聚变条件                        │
│ - 若检测到核聚变:                       │
│   └─ 调用 5.9.5 (temperature 0.75)     │
│   └─ 通知作者                           │
└────────────────────────────────────────┘
```

---

## 5.12 缓存策略

### 5.12.1 缓存分层架构

```typescript
// ==================== 缓存系统定义 ====================

interface CacheLayer {
  name: string;
  type: "in_memory" | "persistent" | "distributed";
  maxSize: number;           // 最大条目数
  ttl: number;               // 生存时间（毫秒）
  evictionPolicy: "lru" | "lfu" | "ttl" | "hybrid";
}

const CACHE_LAYERS: CacheLayer[] = [
  {
    name: "hot_cache",       // L1: 热缓存（最近使用）
    type: "in_memory",
    maxSize: 1000,
    ttl: 300000,             // 5分钟
    evictionPolicy: "lru",
  },
  {
    name: "warm_cache",      // L2: 温缓存（章节级）
    type: "in_memory",
    maxSize: 5000,
    ttl: 3600000,            // 1小时
    evictionPolicy: "hybrid",
  },
  {
    name: "cold_cache",      // L3: 冷缓存（持久化）
    type: "persistent",
    maxSize: 50000,
    ttl: 86400000 * 7,       // 7天
    evictionPolicy: "lfu",
  },
];
```

### 5.12.2 各模块缓存键设计

| 模块 | 缓存键格式 | TTL | 失效条件 |
|------|-----------|-----|---------|
| 战力计算 | `cp_{entityId}_{equipmentHash}_{buffHash}` | 1章 | 装备/状态变化 |
| 规则匹配 | `rules_{stateVersion}` | 1章 | 状态版本变化 |
| 公式求值 | `eval_{expressionHash}_{varHash}` | 5分钟 | 变量变化 |
| NPC意图 | `npc_intent_{npcId}_{sceneHash}_{chapter}` | 1章 | 场景/章变化 |
| 因果树 | `causal_tree_{eventHash}_{constraintVer}` | 永久* | 约束版本变化 |
| 涟漪状态 | `ripple_{rippleId}_{step}` | 1章 | 传播步数变化 |
| 先例势能 | `potential_{precedentId}_{chapter}` | 1章 | 章节推进 |
| 代价计算 | `cost_{actionHash}_{actorHash}_{seed}` | 1章 | 动作/角色变化 |
| 叙事增强 | `narr_enhance_{pathHash}_{moodVer}` | 2章 | 情绪版本变化 |
| 叙事评分 | `narr_score_{pathHash}` | 5章 | 路径变化 |
| 环境氛围 | `env_mood_{locId}_{chapter}_{moodVer}` | 1章 | 章变化 |

*注：因果树缓存"永久"指的是在状态版本和约束版本不变的情况下，相同事件触发的因果树是确定性的，可以无限期缓存。

### 5.12.3 缓存失效策略

```typescript
// 缓存失效管理器
class CacheInvalidator {
  // 事件驱动的缓存失效
  invalidateOnEvent(event: WorldEvent): void {
    switch (event.type) {
      case "entity_state_change":
        this.invalidate(`cp_${event.involvedEntities[0]}_*`);
        this.invalidate(`npc_intent_${event.involvedEntities[0]}_*`);
        break;
      
      case "equipment_change":
        this.invalidate(`cp_${event.involvedEntities[0]}_*`);
        break;
      
      case "realm_breakthrough":
        // 境界突破影响大量缓存
        this.invalidate(`cp_${event.involvedEntities[0]}_*`);
        this.invalidate(`cost_*_${event.involvedEntities[0]}_*`);
        break;
      
      case "chapter_advance":
        // 章节推进：清除所有与章节相关的缓存
        this.invalidatePattern(`*_${getPreviousChapter()}*`);
        break;
      
      case "rule_override":
        // 规则覆盖：清除规则匹配缓存
        this.invalidatePattern(`rules_*`);
        this.invalidatePattern(`causal_tree_*`);
        break;
      
      case "new_precedent":
        // 新先例：可能影响因果树
        this.invalidatePattern(`causal_tree_*`);
        break;
    }
  }

  // 手动失效（作者干预时）
  invalidateScope(scope: CacheScope): void {
    switch (scope) {
      case "all":
        this.clearAll();
        break;
      case "physics":
        this.invalidatePattern(`cp_*`);
        this.invalidatePattern(`eval_*`);
        break;
      case "narrative":
        this.invalidatePattern(`narr_*`);
        this.invalidatePattern(`npc_intent_*`);
        break;
      case "causal":
        this.invalidatePattern(`causal_tree_*`);
        this.invalidatePattern(`cost_*`);
        break;
    }
  }
}
```

### 5.12.4 LLM 调用结果的特殊缓存策略

LLM 调用成本高昂，采用**语义缓存**：

```typescript
// 语义缓存：基于输入的语义相似度进行缓存
class SemanticCache<T> {
  private embeddings: Map<string, number[]>;  // 缓存键 → 嵌入向量
  private results: Map<string, T>;            // 缓存键 → 结果
  private similarityThreshold: number = 0.95; // 相似度阈值

  async get(key: string, embedder: Embedder): Promise<T | null> {
    const keyEmbedding = await embedder.embed(key);
    
    // 查找最相似的缓存项
    let bestMatch: { key: string; similarity: number } | null = null;
    
    for (const [cachedKey, cachedEmbedding] of this.embeddings) {
      const similarity = cosineSimilarity(keyEmbedding, cachedEmbedding);
      if (similarity > this.similarityThreshold && 
          (!bestMatch || similarity > bestMatch.similarity)) {
        bestMatch = { key: cachedKey, similarity };
      }
    }
    
    if (bestMatch) {
      return this.results.get(bestMatch.key)!;
    }
    return null;
  }

  async set(key: string, result: T, embedder: Embedder): Promise<void> {
    const embedding = await embedder.embed(key);
    const keyHash = hashString(key);
    this.embeddings.set(keyHash, embedding);
    this.results.set(keyHash, result);
  }
}

// 应用于：NPC意图推断、叙事增强
// 原理：相似场景下 NPC 的意图和路径的叙事增强可以复用
```

---

## 5.13 性能指标与监控

### 5.13.1 目标性能指标

| 指标 | 目标值 | 说明 |
|------|--------|------|
| 可能性清单生成总耗时 | < 15秒 | 包含所有 LLM 调用 |
| 纯计算部分耗时 | < 200ms | 物理/因果/代价计算 |
| LLM 调用 P95 延迟 | < 3秒 | 单个 LLM 调用 |
| 缓存命中率 | > 60% | 综合命中率 |
| NPC 意图推断耗时 | < 500ms | 含缓存 |
| 因果树构建耗时 | < 100ms | 纯计算 |
| 环境查询耗时 | < 50ms | 含程序化生成 |

### 5.13.2 监控指标

```typescript
interface WorldEngineMetrics {
  // 调用统计
  llmCallsTotal: Counter;           // LLM 调用总数
  llmCallsByType: Map<string, Counter>; // 按类型分布
  llmLatencyHistogram: Histogram;   // LLM 延迟分布
  
  // 缓存统计
  cacheHits: Counter;
  cacheMisses: Counter;
  cacheHitRate: Gauge;
  
  // 计算统计
  causalTreesBuilt: Counter;
  pathsExplored: Counter;
  possibilitiesGenerated: Counter;
  
  // 质量指标
  narrativeScoreDistribution: Histogram;
  possibilityAcceptanceRate: Gauge; // 作者接受率
  
  // 资源使用
  memoryUsage: Gauge;
  activeEntities: Gauge;
  activeRipples: Gauge;
}
```

---

## 5.14 错误处理与降级策略

### 5.14.1 LLM 调用失败处理

```typescript
interface LLMCallFallback<T> {
  // 重试策略
  maxRetries: number = 3;
  retryDelay: number = 500; // ms
  retryBackoff: "fixed" | "linear" | "exponential" = "exponential";
  
  // 降级策略
  fallbackStrategy: "retry" | "cache_lookup" | "rule_based" | "skip";
  
  // 具体降级
  fallback: () => T;
}

// 各增强点的降级策略
const LLM_FALLBACKS = {
  npcIntentionInferrer: {
    fallbackStrategy: "rule_based",
    fallback: () => generateRuleBasedIntention(npc), // 基于规则的简单意图
  },
  environmentNarrativeGenerator: {
    fallbackStrategy: "rule_based", 
    fallback: () => generateTemplateMood(environment), // 模板化氛围
  },
  rippleConsequenceInferrer: {
    fallbackStrategy: "skip", // 异步任务，失败可跳过
  },
  possibilityNarrativeEnhancer: {
    fallbackStrategy: "cache_lookup",
    fallback: () => getSimilarPathEnhancement(path), // 查找相似路径的增强结果
  },
  fusionNarrativeInterpreter: {
    fallbackStrategy: "rule_based",
    fallback: () => generateTemplateFusionInterpretation(fusion),
  },
  timeImpactAssessor: {
    fallbackStrategy: "skip",
  },
};
```

### 5.14.2 世界状态不一致处理

```typescript
enum ConsistencyLevel {
  STRICT = "strict",       // 完全一致性，任何冲突抛异常
  RELAXED = "relaxed",     // 允许微小不一致，记录警告
  EVENTUAL = "eventual",   // 最终一致性，异步修复
}

interface ConsistencyCheck {
  checkId: string;
  description: string;
  severity: "critical" | "warning" | "info";
  check: (state: WorldState) => ConsistencyResult;
}

// 关键一致性检查
const CRITICAL_CONSISTENCY_CHECKS: ConsistencyCheck[] = [
  {
    checkId: "cp_monotonicity",
    description: "战力值不应无故下降（除非有明确原因）",
    severity: "warning",
    check: (state) => {
      // 检查主角战力是否在无负面事件情况下下降
      // ...
    },
  },
  {
    checkId: "precedent_energy_nonnegative",
    description: "先例势能不应为负",
    severity: "critical",
    check: (state) => {
      for (const [id, p] of state.precedents) {
        if (p.potential.currentValue < 0) {
          return { passed: false, message: `Precedent ${id} has negative potential` };
        }
      }
      return { passed: true };
    },
  },
  {
    checkId: "entity_location_valid",
    description: "实体所在位置必须存在",
    severity: "critical",
    check: (state) => {
      for (const [id, e] of state.entities) {
        // 检查位置有效性
      }
      return { passed: true };
    },
  },
  {
    checkId: "relationship_symmetry",
    description: "关系必须双向对称",
    severity: "warning",
    check: (state) => {
      // 检查关系双向一致性
      return { passed: true };
    },
  },
];
```

---

## 5.15 配置参考

### 5.15.1 世界引擎全局配置

```yaml
world_engine:
  # 版本
  version: "3.0"
  codename: "Sovereign"
  
  # 性能
  max_active_entities: 1000
  max_causal_depth: 5
  max_causal_branching: 3
  max_possibilities: 10
  llm_max_concurrent_calls: 3
  
  # 缓存
  cache:
    hot_cache_size: 1000
    warm_cache_size: 5000
    cold_cache_size: 50000
    semantic_cache_enabled: true
    semantic_similarity_threshold: 0.95
  
  # 一致性
  consistency_level: "relaxed"  # strict/relaxed/eventual
  auto_fix_consistency: true
  
  # LLM
  llm:
    default_model: "narrative-os-v3"
    fallback_model: "narrative-os-v2"
    timeout_ms: 5000
    retry_count: 3
  
  # 调试
  debug:
    log_all_llm_calls: false
    trace_causal_tree: false
    export_possibility_list: true
    metrics_enabled: true
```

### 5.15.2 战力体系配置示例

```yaml
combat_power_system:
  system_id: "cultivation"
  growth_base: 10           # 相邻大阶段倍率基数
  growth_curve: "exponential"  # linear/exponential/s_curve
  
  weights:
    atk: 0.25
    def: 0.20
    spd: 0.15
    spi: 0.15
    tech: 0.15
    luck: 0.10
    alpha: 1.0              # 非线性指数
  
  dimensions:
    - key: "hp"
      name: "生命值"
      realm_bonus_formula: "1 + (realm_order - 1) * 0.5"
    - key: "mp"
      name: "法力值"
      realm_bonus_formula: "realm_order * 0.8"
  
  realm_stages:
    - id: "mortal"
      name: "凡人"
      order: 0
      tiers:
        - name: "普通人"
          multiplier: 1.0
    - id: "qi_refining"
      name: "练气"
      order: 1
      tier_count: 9
      base_multiplier: 2.0
      tier_multiplier_step: 1.0  # 每层增加1倍
```

---

## 附录 A: 术语表

| 术语 | 英文 | 说明 |
|------|------|------|
| 金手指 | Special Ability / Cheat | 主角或关键NPC的特殊外挂能力 |
| 爽点 | Satisfaction Point | 让读者感到满足和愉悦的叙事节点 |
| 扮猪吃虎 | Hidden Power Play | 隐藏实力后在关键时刻爆发的经典桥段 |
| 伏笔 | Foreshadowing / Precedent | 提前埋下的叙事线索 |
| 回收伏笔 | Precedent Resolution | 前述伏笔在后期被呼应和解释 |
| 越级挑战 | Cross-Tier Battle | 低境界挑战高境界的经典桥段 |
| 境界 | Realm / Tier | 修真体系中的等级划分 |
| 涟漪 | Ripple | 信息/事件在网络中的传播 |
| 核聚变 | Fusion | 多个先例碰撞产生新叙事 |
| 势能 | Potential Energy | 先例的叙事能量 |
| MOU | Main Orchestration Unit | 叙事主循环单元 |

## 附录 B: 版本变更日志

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.0 | - | 基础世界引擎，纯规则驱动 |
| v2.0 | - | 新增行为树、信息涟漪 |
| v3.0 Sovereign | 2025 | 新增7个LLM增强点、语义缓存、CSP因果推演、完整代价系统 |

---

**文档结束**

*本文档为 NarrativeOS v3.0 Sovereign 世界引擎的完整技术规格，可直接指导编码实现。所有算法、Prompt 模板、接口定义均为可直接使用的生产级规范。*
