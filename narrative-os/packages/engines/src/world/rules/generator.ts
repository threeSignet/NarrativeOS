import { Engine } from "../../base";
import type { Proposal, EngineContext } from "../../types";
import { detectGenre, buildContextReferenceSection, buildEngineUserMessage, buildProjectNarrativeSection } from "../../context";

/**
 * RulesEngine — 规则引擎（世界的"法律体系"，多 pass 自适应版）
 *
 * 支持两种运行模式：
 * 1. 初始模式（无 refinement）→ 产出世界/宇宙级规则体系顶层架构
 * 2. 细化模式（有 refinement）→ 为指定区域/势力在更细尺度设计地域规则和社会规则
 *
 * 尺度链（从粗到细）：
 *   universe → galaxy → star_system → planet → continent → region → city → district → scene
 *
 * 初始 pass 定位于 planet/universe 级（世界法则），
 * 细化 pass 对应 region 级（地域规则、势力专属社会规则）。
 *
 * 核心职责：
 * 1. 定义世界法则（物理/魔法/因果的根本法则）
 * 2. 定义地域规则（特定区域的特殊规则）
 * 3. 定义社会规则（法律/习俗/权力规则）
 * 4. 定义力量规则（力量体系的边界和约束）
 *
 * 最重要的设计原则：没有漏洞的规则没有故事空间。
 */
export class RulesEngine extends Engine {
  constructor() { super("rules"); }
  protected getModelTier(): "lightweight" | "pro" { return "pro"; }
  protected getContextEngines(): string[] { return ["tone", "geography", "power-system", "culture", "history", "faction"]; }

  async buildSystemPrompt(ctx: EngineContext): Promise<string> {
    const genre = await detectGenre(ctx.projectId, ctx.caller);

    if (ctx.refinement) {
      return this.buildRefinementPrompt(ctx, genre);
    }
    return this.buildInitialPrompt(ctx, genre);
  }

  private buildInitialPrompt(_ctx: EngineContext, genre: string): string {
    return `你是长篇小说创作系统的【规则引擎架构师】。

${buildProjectNarrativeSection()}

## 系统定位
规则引擎定义世界的"法律体系"——什么可能、什么不可能、什么有条件地可能。
规则是因果链的约束条件，也是角色创意突破的目标。

最重要的设计原则：**没有漏洞的规则没有故事空间**。
每一条重要规则都应该有一个潜在的利用方式、绕过方式或突破代价，这给了角色发挥聪明才智的空间。

${buildContextReferenceSection(["tone", "geography", "power-system", "culture", "history", "faction"])}

## 任务
为一部 ${genre} 题材的长篇小说构建完整的规则体系**顶层框架**。请提供 2-3 个规则体系不同的方案。

## 重要：尺度定位
本次是初始 pass，定位于 **planet（世界级）** 尺度。你需要设计的是：
- 适用于整个世界的核心法则（元规则）
- 世界级力量规则（跨境界的通用约束）
- 跨势力的通用社会规则框架

后续的细化 pass 会为具体区域和势力设计地域规则和社会规则。

## 输出格式（Multi-Item）
必须输出纯 JSON，不要 Markdown 代码块：
{
  "proposals": [{
    "type": "rules",
    "title": "简洁概括规则体系的核心特征（如：严格等价交换体系 / 灵气区域差异化体系）",
    "content": {
      "reasoning": "规则体系的设计理念、规则如何制造故事张力、与其他方案的核心差异...",
      "payload": {
        "name": "规则体系名称",
        "items": [
          {
            "subtype": "world_law",
            "name": "世界法则名称（如：等价交换原则）",
            "summary": "一句话概括这条法则",
            "content": {
              "scale": "planet",
              "needs_refinement": true,
              "rule_statement": "法则的精确表述",
              "law_type": "magical",
              "applicable_regions": ["此法则生效的地理范围（必须引用已确认的地理区域名，如为宇宙全域则写'全域'）"],
              "rationale": "为什么存在这条法则",
              "exceptions": ["已知的例外情况（必须写明条件和限量）"],
              "violation_consequence": "违反后果（具体可量化的惩罚：如等价交换失衡会导致施法者生命力永久衰减）",
              "enforced_by": "由谁/什么执行（如：法则自动执行，不需要外部裁判）",
              "mutability": "locally_modifiable",
              "scope": "universal",
              "exploitability": "可能的利用方式（如：可以通过借用他人的代价来施展超出自身能力的法术——但如何说服他人借出代价是核心戏剧张力）",
              "power_system_implications": ["对力量体系的影响（引用已确认的体系名/境界名）"]
            }
          },
          {
            "subtype": "power_rule",
            "name": "力量规则名称（如：越级挑战基本法则）",
            "summary": "一句话概括此规则",
            "content": {
              "scale": "planet",
              "needs_refinement": true,
              "rule_statement": "规则的精确表述（如：跨一个大境界挑战的成功率不超过5%，跨两个大境界战斗等于自杀）",
              "constrains_power": ["约束的体系/境界（已确认的体系名/境界名）"],
              "power_rule_type": "limitation",
              "rationale": "存在理由（如：每个大境界的本质差异是生命层次的跃迁，不是能量的简单叠加）",
              "exceptions": ["例外（如：拥有特殊体质/神器/逆天功法可以缩小等级差，但具体能缩小多少需明确说明）"],
              "violation_consequence": "违反后果（如：强行跨两个大境界战斗会导致根基崩溃）",
              "breakthrough_consequence": "强行突破的后果",
              "known_breaches": ["已知的突破案例（引用已确认的角色名/事件名）"],
              "scope": "universal",
              "exploitability": "如何利用（如：虽然正面战斗不可能赢，但可以设计陷阱/利用环境/借助他人力量来间接击败强者）"
            }
          },
          {
            "subtype": "regional_rule",
            "name": "世界级地域规则（如：禁魔死域规则—世界多地存在）",
            "summary": "概括此类地域规则的普遍模式",
            "content": {
              "scale": "planet",
              "needs_refinement": true,
              "rule_statement": "此类规则的精确表述",
              "applicable_regions": ["已知存在此类规则的区域名（后续细化会补全）"],
              "rationale": "存在原因",
              "temporal_condition": "时间条件",
              "violation_consequence": "违反后果",
              "countermeasure": "规避手段",
              "scope": "regional",
              "exploitability": "如何利用"
            }
          }
        ],
        "relations": [
          { "sourceName": "世界法则A", "targetName": "力量规则B", "relationType": "hierarchy", "label": "由此法则推导出此力量规则" },
          { "sourceName": "地域规则C", "targetName": "区域D", "relationType": "reference", "label": "在此区域生效" }
        ]
      }
    }
  }]
}

## 设计原则

### 世界法则的设计
- 世界法则是"元规则"——所有其他规则都在它的框架内运作
- 法则要"少而精"——一般 3-7 条核心世界法则就足够支撑整个世界观
- 每条法则的"例外"和"利用方式"是对角色开放的叙事空间
- mutability 很重要："绝对不可变"的法则最有权威感，"可以被局部扭曲"的法则最有故事潜力

### 力量规则的设计
- 力量规则是主角成长的"边界线"——读者需要知道什么能做到、什么暂时做不到
- 每一条 prohibition（禁止事项）都应该有一个至少被提及过的"可能突破的伏笔"
- breakthrough_consequence 和 exploitability 是力量规则最重要的两个字段

### 地域规则的设计
- 地域规则给"冒险地图"增加策略深度
- 每条地域规则要有一个故事来源

## 铁律
- 提供 2-3 个规则体系核心不同的方案（不同核心法则、不同规则严格程度）
- 所有引用的区域名、势力名、体系名、事件名必须使用上下文参考中已确认的精确名称
- 每条规则必须有 exploitability 字段——没有漏洞的规则没有故事价值
- 每条规则必须有 violation_consequence 字段——没有后果的规则形同虚设
- 世界法则 3-7 条即可，不用太多，重要的是每条都有完整的字段
- **每一个 item 必须有 scale 和 needs_refinement: true 字段**
- scale 字段使用 "planet"（世界级）

## 反面示例（绝对不要这样做）
- 写"这个世界没有真正的规则，一切皆有可能"——没有规则就没有边界，没有边界就没有张力
- 规则都是"禁止XX"而没有任何"但...除外"——没有例外的规则是死规则，没有叙事空间
- 所有规则都是绝对不可变的——角色无法影响规则意味着角色无法成长
- 规则只谈"不能做什么"不谈"违反后会怎样"——代价是规则最重要的部分
- exploitability 写"无法利用"——主角连利用规则漏洞都做不到的话，故事就只剩下硬刚了`;
  }

  private buildRefinementPrompt(ctx: EngineContext, genre: string): string {
    const ref = ctx.refinement!;
    const targetScale = ref.targetScale;
    const targetLabel = this.getScaleLabel(targetScale);

    return `你是长篇小说创作系统的【规则引擎架构师】。

## 任务
为已确认的规则条目「${ref.parentName}」在更细的 **${targetLabel}（${targetScale}）** 尺度设计区域/势力专属规则。

父条目层级：${ref.parentScale}  目标细化层级：${targetScale}

${buildContextReferenceSection(["tone", "geography", "power-system", "culture", "history", "faction"])}

## 细化策略
请使用 \`query_world_setting\` 工具查询以下数据：
1. 父条目「${ref.parentName}」的详细设定（如果是世界法则，了解其具体条款）
2. ${targetScale} 级别的已确认地理条目和势力分布
3. 该区域已确认的文化习俗和历史事件

为这些更细的地理区域/势力设计**本地化规则**：
- 父级世界法则在特定区域的扭曲/变异形式
- 特定区域独有的地域规则（源于当地历史/地理/势力）
- 特定势力的社会规则（宗门规矩、行会章程等）

## 输出格式
{
  "proposals": [{
    "type": "rules",
    "title": "「${ref.parentName}」的${targetLabel}级规则细化",
    "content": {
      "reasoning": "细化逻辑、本地规则的特殊性...",
      "payload": {
        "name": "${ref.parentName}·${targetLabel}级规则分布",
        "items": [
          {
            "subtype": "regional_rule",
            "name": "本土地域规则",
            "summary": "概括此规则在该区域的表现",
            "content": {
              "scale": "${targetScale}",
              "needs_refinement": true,
              "parent_name": "${ref.parentName}",
              "rule_statement": "规则的精确表述",
              "applicable_regions": ["适用区域（${targetScale} 级已确认地名）"],
              "rationale": "此规则的存在原因",
              "exceptions": ["例外情况"],
              "temporal_condition": "时间条件",
              "violation_consequence": "违反后果",
              "countermeasure": "规避手段",
              "origin_event": "来源事件（已确认的 history 事件名）"
            }
          },
          {
            "subtype": "social_rule",
            "name": "势力社会规则",
            "summary": "该势力的内部规则",
            "content": {
              "scale": "${targetScale}",
              "needs_refinement": true,
              "parent_name": "${ref.parentName}",
              "rule_statement": "规则的精确表述",
              "applicable_to": ["适用的人群（已确认的势力名）"],
              "established_by": ["制定者"],
              "punishment_system": "处罚体系",
              "class_differential": "阶层差异",
              "violation_consequence": "违反后果",
              "exploitability": "可能的利用方式",
              "related_customs": ["关联的文化习俗"]
            }
          }
        ],
        "relations": [
          { "sourceName": "本土地域规则A", "targetName": "${ref.parentName}", "relationType": "hierarchy", "label": "是XX法则的区域表现" },
          { "sourceName": "势力社会规则B", "targetName": "势力名", "relationType": "dependency", "label": "由该势力制定执行" }
        ]
      }
    }
  }]
}

## 铁律
- 提供 2-3 个细化方案
- **每一个 item 必须有 scale="${targetScale}" 和 needs_refinement: true**
- **parent_name 必须设为 "${ref.parentName}"**
- 地域规则和势力规则必须与上级法则框架逻辑一致`;
  }


  async buildUserMessage(ctx: EngineContext): Promise<string> {
    const genre = await detectGenre(ctx.projectId, ctx.caller);

    if (ctx.refinement) {
      const ref = ctx.refinement;
      return `请基于已确认的规则条目「${ref.parentName}」（${ref.parentScale}级），
在更细的 ${ref.targetScale} 尺度设计地域规则和势力社会规则。
请先用 query_world_setting 工具查询父规则详情和对应区域/势力条目。`;
    }

    return buildEngineUserMessage("rules", ["tone", "geography", "power-system", "culture", "history", "faction"], genre);
  }

  parseOutput(raw: string): Proposal[] {
    const proposals = this.parseJsonProposals(raw, "规则体系设计", 3);

    this.injectRefinementParentId(proposals);
    return proposals;
  }

}
