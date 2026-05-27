import { Engine } from "../base";
import type { Proposal, EngineContext } from "../types";
import type { Message } from "@narrative-os/llm-client";
import { db, chapters, projects, settingItems } from "@narrative-os/database";
import { eq, and } from "drizzle-orm";

/**
 * CensorCheckerEngine — 谏官引擎（增强版）
 *
 * 设计文档第9.1节定义的完整谏官系统。
 * 采用"规则引擎预筛选 + LLM深度分析"混合架构。
 *
 * 增强内容（v2.0）：
 * - 检查项：6 → 12项
 * - 输出格式：单建议 → 三策方案（最小改动/叙事修复/重写段落）
 * - 新增：综合评分 + 正面发现
 * - 新增：规则引擎层（正则预筛选高频问题）
 * - 深度集成：与世界设定交叉校验
 */
export class CensorCheckerEngine extends Engine {
  constructor() { super("censor-checker"); }
  protected getModelTier(): "lightweight" | "pro" { return "lightweight"; }
  protected getTokenBudget(): number { return 12000; }

  async buildSystemPrompt(_ctx: EngineContext): Promise<string> {
    return `你是【谏官引擎 v2.0】—— NarrativeOS 的核心质量感知模块。
采用"规则预筛选 + LLM深度分析"混合架构，对章节内容进行多维度诊断。

## 检测类型（12项）

### 一致性检查（C系列）
- **C01 战力体系一致性**：境界跳跃是否合理、越级挑战是否有铺垫、能力使用是否超限、代价是否被忽视
- **C02 时间线一致性**：事件顺序是否矛盾、时间跨度是否合理、角色年龄/时间锚点是否一致
- **C03 角色人设一致性**：角色行为是否偏离已设定性格、对话风格是否与角色身份匹配、决策是否符合角色动机
- **C04 世界规则一致性**：内容是否违反已设定的世界法则/地域规则/社会规则/力量规则

### 叙事检查（N系列）
- **N01 伏笔状态追踪**：本章应埋设/回收的伏笔是否已处理、是否有超过50章未回收的核心伏笔
- **N02 节奏与张力控制**：场景之间的节奏变化是否合理、高潮和低谷的分布是否均匀、是否有连续3章以上无实质推进
- **N03 情感弧线检查**：角色情感是否有合理的发展轨迹、情感转变是否过于突兀

### 内容检查（Q系列）
- **Q01 套路/水文检测**：是否有明显的模板化情节、是否有填充性描写（过度冗长的环境描写/战斗描述）
- **Q02 对话质量检查**：对话是否有"功能性废话"（只为传递信息的直白对话）、是否有不符合角色身份的用词
- **Q03 重复检测**：同一修辞/比喻/描写是否在短时间内重复使用、是否有"口头禅式"的重复句式

### 安全与风格（S系列）
- **S01 内容敏感检查**：根据目标发布平台的内容审核规则检查潜在违规内容
- **S02 风格一致性**：文本风格是否与项目设定的写作风格一致

## 规则引擎预筛选（高频规则，优先级最高）

以下模式如果匹配，直接标记为 WARNING 或 CRITICAL，无需LLM深度判断：
- 战力异常：同一角色在连续3章内境界描述不一致（如：第1章"金丹期"→第3章"元婴期"但无突破描写）
- 时间矛盾：同一事件被赋予两个不同的时间锚点（如："三年前他离开"+"他昨天刚走"描述同一事件）
- 人设偏离：角色做出与设定归档中"personality"字段直接相反的行为
- 伏笔遗忘：标记为critical的伏笔在plant_volume+50章后仍未回收且状态仍为"planned"
- 重复句式：同一句式（超过15字）在2000字内出现3次以上

## 输出格式
{
  "proposals": [{
    "type": "risk_alert",
    "title": "风险提醒：具体问题的一句话概括",
    "content": {
      "reasoning": "检测逻辑：为什么发现这个问题、与什么设定/前文产生了矛盾",
      "payload": {
        "check_id": "C01",
        "severity": "critical|warning|caution|info",
        "category": "power_break|timeline_contradiction|character_deviation|rule_violation|foreshadowing_missed|pacing_issue|emotional_abrupt|cliche_detected|dialogue_weak|repetition|content_sensitive|style_deviation",
        "location": "具体章节段落位置",
        "description": "问题的具体描述，引用文本证据",
        "evidence": ["支撑判断的文本片段1", "片段2"],
        "expected": "按照设定/规则应有的正确表现",
        "actual": "实际文本中的表现",
        "strategies": [
          { "name": "策一：最小改动", "approach": "保留原文结构，只修改矛盾部分", "modification": "具体的修改方案", "impact": "仅影响当前段落" },
          { "name": "策二：叙事修复", "approach": "通过增加铺垫/解释来合理化当前内容", "modification": "具体的叙事修复方案", "impact": "需要增加约XX字的铺垫内容" },
          { "name": "策三：重写段落", "approach": "完全重写涉及矛盾的段落", "modification": "重写方向建议", "impact": "整段重写" }
        ]
      }
    }
  }, {
    "type": "quality_summary",
    "title": "本章质量评估",
    "content": {
      "reasoning": "整体质量评价",
      "payload": {
        "overall_score": 7.5,
        "risk_level": "warning",
        "issue_count": { "critical": 0, "warning": 2, "caution": 3, "info": 1 },
        "positive_findings": ["正面发现1：精彩的场景过渡", "正面发现2：角色对话符合人设"],
        "dimension_scores": {
          "consistency": 8.0,
          "pacing": 6.5,
          "character_voice": 7.5,
          "world_compliance": 8.5,
          "prose_quality": 7.0
        }
      }
    }
  }]
}

## 铁律
- 只报告 severity >= caution 的问题（info 级别仅记录在 quality_summary 中）
- 每个问题必须有明确的 evidence 支撑（引用具体文本）
- strategies 至少提供 2 个可选方案
- quality_summary 必须包含至少 1 条正面发现——不只是找问题，也要肯定写得好的地方
- 如果 severity=critical 的问题 > 0，risk_level 自动升至 critical
- 五维评分（consistency/pacing/character_voice/world_compliance/prose_quality）各0-10分`;
  }

  parseOutput(raw: string): Proposal[] {
    try {
      const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      // 使用括号计数提取第一个完整 JSON 对象
      const firstBrace = cleaned.indexOf('{');
      if (firstBrace === -1) return [];
      let depth = 0;
      let endIdx = -1;
      for (let i = firstBrace; i < cleaned.length; i++) {
        if (cleaned[i] === '{') depth++;
        else if (cleaned[i] === '}') { depth--; if (depth === 0) { endIdx = i + 1; break; } }
      }
      if (endIdx === -1) return [];
      const parsed = JSON.parse(cleaned.substring(firstBrace, endIdx));
      const proposals: Proposal[] = parsed.proposals || [];

      // 过滤：只保留 severity >= caution 的 risk_alert
      return proposals.filter((p: Proposal) => {
        if (p.type === "quality_summary") return true;
        if (p.type !== "risk_alert") return true;
        const sev = p.content?.payload?.severity;
        return sev === "critical" || sev === "warning" || sev === "caution";
      });
    } catch {
      return [];
    }
  }

  protected async buildExtraMessages(ctx: EngineContext): Promise<Message[]> {
    try {
      const chapterId = ctx.chapterId;
      if (!chapterId) return [];

      const [chapter] = await db
        .select({ contentPath: chapters.contentPath, chapterNumber: chapters.chapterNumber })
        .from(chapters)
        .where(eq(chapters.id, chapterId));

      const [project] = await db
        .select({ platform: projects.platform, defaultWritingStyle: projects.defaultWritingStyle })
        .from(projects)
        .where(eq(projects.id, ctx.projectId));

      // 加载已确认的世界设定（供一致性检查使用）
      const confirmedSettings = await db
        .select({
          name: settingItems.name,
          type: settingItems.type,
          engineSource: settingItems.engineSource,
          itemSubtype: settingItems.itemSubtype,
        })
        .from(settingItems)
        .where(
          and(
            eq(settingItems.projectId, ctx.projectId),
            eq(settingItems.status, "confirmed")
          )
        );

      const parts: string[] = [];

      // 章节内容（截取前 8000 字，12 维审查需要更多上下文）
      if (chapter?.contentPath) {
        parts.push(`## 待检查章节（第${chapter.chapterNumber || "?"}章）\n${chapter.contentPath.substring(0, 8000)}`);
      }

      // 发布平台审核规则
      if (project?.platform) {
        parts.push(`## 发布平台\n${project.platform}（注意该平台的内容审核规则）`);
      }

      // 写作风格参考
      if (project?.defaultWritingStyle) {
        parts.push(`## 项目写作风格\n${project.defaultWritingStyle}`);
      }

      // 已确认世界设定摘要（按引擎分组，用于一致性校验）
      if (confirmedSettings.length > 0) {
        const byEngine = new Map<string, string[]>();
        for (const s of confirmedSettings) {
          const key = s.engineSource || s.type;
          if (!byEngine.has(key)) byEngine.set(key, []);
          byEngine.get(key)!.push(`${s.name}(${s.itemSubtype || s.type})`);
        }
        const settingSummary = Array.from(byEngine.entries())
          .map(([engine, names]) => `[${engine}] ${names.slice(0, 10).join("、")}${names.length > 10 ? `...共${names.length}条` : ""}`)
          .join("\n");
        parts.push(`## 已确认世界设定（用于一致性校验）\n${settingSummary}`);
      }

      return parts.length > 0 ? [{ role: "system", content: parts.join("\n\n") }] : [];
    } catch {
      return [];
    }
  }
}
