/**
 * MOU Spectrum Evaluator — MOU 频谱评估器
 *
 * 在提案写入（stageProposals）之前/之后自动评估提案质量，
 * 为 Full Auto 模式的自动审批提供决策依据。
 *
 * 评估维度：
 * 1. Charter Alignment（创作宪章一致性）— 与创作宪章核心设定的匹配度
 * 2. World Consistency（设定冲突检测）— 与已有 confirmed 设定的冲突程度
 * 3. Completeness（提案完整性）— 提案结构是否完整、字段是否齐全
 * 4. Scale Consistency（尺度一致性）— 细化模式下 scale 是否正确
 *
 * 输出频谱带：
 * - green（≥75）：高质量，无冲突，可自动审批
 * - yellow（50-74）：中等质量，有轻微问题，建议人工确认
 * - red（<50）：低质量，有严重冲突，必须人工审批
 *
 * 关键引擎检查点（即使 full_auto 也暂停）：
 * - story-blueprint / outline-generator / volume-outline / chapter-outline / chapter-writer
 */

import { db, settingItems, projects } from "@narrative-os/database";
import { eq, and } from "drizzle-orm";
import type { Proposal, CreationCharter } from "@narrative-os/engines";
import { loadCreationCharter } from "@narrative-os/engines";
import { validateCrossReferences, type CrossRefValidationResult } from "./cross-engine-validator";

/** 频谱评估结果 */
export interface SpectrumEvaluation {
  /** 总分 0-100 */
  overallScore: number;
  /** 频谱带 */
  band: "green" | "yellow" | "red";
  /** 评估维度明细 */
  dimensions: SpectrumDimensions;
  /** 风险评估 */
  riskLevel: "low" | "medium" | "high";
  /** 评估说明 */
  reasoning: string;
  /** 是否触发检查点暂停（关键引擎） */
  checkpointTriggered: boolean;
  /** 检查点引擎名（如触发） */
  checkpointEngine?: string;
}

/** 频谱评估维度 */
export interface SpectrumDimensions {
  /** 创作宪章一致性 0-100 */
  charterAlignment: number;
  /** 设定冲突检测 0-100（100=无冲突） */
  worldConsistency: number;
  /** 提案完整性 0-100 */
  completeness: number;
  /** 尺度一致性 0-100 */
  scaleConsistency: number;
}

/** 关键引擎检查点列表 */
const CRITICAL_ENGINES = new Set([
  "story-blueprint",
  "outline-generator",
  "volume-outline",
  "chapter-outline",
  "chapter-writer",
]);

/**
 * 对一批提案执行 MOU 频谱评估。
 *
 * @param projectId 项目 ID
 * @param proposals 待评估的提案列表
 * @param sourceNode 来源引擎名
 * @returns 每个 proposal 对应一个评估结果
 */
export async function evaluateMouSpectrum(
  projectId: string,
  proposals: Proposal[],
  sourceNode: string
): Promise<Map<string, SpectrumEvaluation>> {
  const results = new Map<string, SpectrumEvaluation>();

  if (proposals.length === 0) return results;

  // 并行加载所需数据
  const [charter, crossRefResults, confirmedItems] = await Promise.all([
    loadCreationCharter(projectId),
    validateCrossReferences(projectId, proposals, sourceNode),
    loadConfirmedItems(projectId),
  ]);

  // 是否触发关键引擎检查点
  const checkpointTriggered = CRITICAL_ENGINES.has(sourceNode);

  for (const proposal of proposals) {
    if (proposal.type === "error") {
      results.set(proposal.title, buildErrorEvaluation(checkpointTriggered, sourceNode));
      continue;
    }

    const crossRef = crossRefResults.find((r) => r.proposalTitle === proposal.title);
    const dims = evaluateDimensions(proposal, charter, crossRef, confirmedItems);
    const overallScore = Math.round(
      dims.charterAlignment * 0.25 +
      dims.worldConsistency * 0.35 +
      dims.completeness * 0.25 +
      dims.scaleConsistency * 0.15
    );

    const band = overallScore >= 75 ? "green" : overallScore >= 50 ? "yellow" : "red";
    const riskLevel = band === "green" ? "low" : band === "yellow" ? "medium" : "high";

    const reasoning = buildReasoning(dims, crossRef, overallScore, band);

    results.set(proposal.title, {
      overallScore,
      band,
      dimensions: dims,
      riskLevel,
      reasoning,
      checkpointTriggered,
      checkpointEngine: checkpointTriggered ? sourceNode : undefined,
    });
  }

  return results;
}

/** 加载项目已确认条目（用于完整性检查） */
async function loadConfirmedItems(projectId: string) {
  return db
    .select({ id: settingItems.id, type: settingItems.type, name: settingItems.name })
    .from(settingItems)
    .where(and(eq(settingItems.projectId, projectId), eq(settingItems.status, "confirmed")));
}

/** 评估各维度分数 */
function evaluateDimensions(
  proposal: Proposal,
  charter: CreationCharter | null,
  crossRef: CrossRefValidationResult | undefined,
  _confirmedItems: Array<{ id: string; type: string; name: string }>
): SpectrumDimensions {
  const payload = (proposal.content?.payload || {}) as Record<string, unknown>;
  const items = (payload?.items || []) as Array<Record<string, unknown>>;

  // 1. 创作宪章一致性（基于文本匹配启发式评分）
  const charterAlignment = evaluateCharterAlignment(proposal, charter);

  // 2. 设定冲突检测（基于 cross-ref 结果）
  const worldConsistency = evaluateWorldConsistency(crossRef);

  // 3. 提案完整性
  const completeness = evaluateCompleteness(items, proposal.type);

  // 4. 尺度一致性
  const scaleConsistency = evaluateScaleConsistency(items);

  return { charterAlignment, worldConsistency, completeness, scaleConsistency };
}

/** 评估创作宪章一致性（启发式文本匹配） */
function evaluateCharterAlignment(proposal: Proposal, charter: CreationCharter | null): number {
  if (!charter) return 80; // 无宪章时给默认分

  let score = 80;
  const proposalText = JSON.stringify(proposal.content).toLowerCase();

  // 检查世界规则关键词
  for (const rule of charter.worldRules || []) {
    const ruleKeywords = extractKeywords(rule.rule);
    const implicationKeywords = (rule.implications || []).flatMap(extractKeywords);
    const allKeywords = [...ruleKeywords, ...implicationKeywords];

    let matched = 0;
    for (const kw of allKeywords) {
      if (proposalText.includes(kw.toLowerCase())) matched++;
    }
    if (allKeywords.length > 0) {
      const ratio = matched / allKeywords.length;
      if (ratio < 0.2) score -= 5; // 大量规则关键词未匹配
    }
  }

  // 检查核心角色名
  for (const char of charter.coreCharacters || []) {
    if (proposalText.includes(char.name.toLowerCase())) {
      score += 2; // 提及核心角色加分
    }
  }

  // 检查叙事风格关键词
  const narrative = charter.narrativeRules;
  if (narrative) {
    const styleKeywords = extractKeywords(narrative.writingStyle + " " + narrative.tone);
    let matched = 0;
    for (const kw of styleKeywords) {
      if (proposalText.includes(kw.toLowerCase())) matched++;
    }
    if (styleKeywords.length > 0 && matched / styleKeywords.length < 0.1) {
      score -= 3;
    }
  }

  return Math.max(0, Math.min(100, score));
}

/** 评估设定冲突（基于 cross-ref 验证结果） */
function evaluateWorldConsistency(crossRef: CrossRefValidationResult | undefined): number {
  if (!crossRef) return 85; // 无验证结果时给默认分
  if (crossRef.valid) return 100; // 完全无冲突

  const brokenCount = crossRef.brokenRefs.length;
  const highConfidenceFixes = crossRef.brokenRefs.filter((br) => br.fixConfidence >= 2).length;

  // 有可自动修复的冲突，扣分较少
  const autoFixableRatio = brokenCount > 0 ? highConfidenceFixes / brokenCount : 0;
  let score = 100 - brokenCount * 8;

  // 如果有大量可自动修复的冲突，额外加分
  if (autoFixableRatio > 0.5) score += 10;

  return Math.max(0, Math.min(100, score));
}

/** 评估提案完整性 */
function evaluateCompleteness(items: Array<Record<string, unknown>>, proposalType: string): number {
  if (!items || items.length === 0) return 20;

  let score = 80;

  // 检查 items 数量是否合理
  if (items.length < 1) score -= 30;
  else if (items.length > 20) score -= 10; // 过多条目可能质量下降

  // 检查每个 item 的必填字段
  for (const item of items) {
    const content = (item.content || {}) as Record<string, unknown>;
    const name = item.name || content.name;
    const summary = item.summary || content.summary;

    if (!name || String(name).trim().length === 0) score -= 5;
    if (!summary || String(summary).trim().length === 0) score -= 3;

    // 检查内容字段是否为空对象
    if (!content || Object.keys(content).length === 0) score -= 5;
  }

  // 特定类型的额外检查
  if (proposalType === "character" && items.length < 2) score -= 10;
  if (proposalType === "geography" && items.length < 2) score -= 10;

  return Math.max(0, Math.min(100, score));
}

/** 评估尺度一致性 */
function evaluateScaleConsistency(items: Array<Record<string, unknown>>): number {
  if (!items || items.length === 0) return 100;

  let score = 100;
  for (const item of items) {
    const content = (item.content || {}) as Record<string, unknown>;
    const scale = content.scale;
    if (scale === undefined || scale === null || scale === "") {
      score -= 10; // 缺少 scale 字段
    }
  }

  return Math.max(0, Math.min(100, score));
}

/** 构建评估说明 */
function buildReasoning(
  dims: SpectrumDimensions,
  crossRef: CrossRefValidationResult | undefined,
  overallScore: number,
  band: string
): string {
  const parts: string[] = [];

  if (band === "green") {
    parts.push("提案质量良好，设定一致性高，建议自动审批。");
  } else if (band === "yellow") {
    parts.push("提案质量中等，存在部分需要关注的问题，建议人工确认。");
  } else {
    parts.push("提案质量较低或存在严重冲突，必须人工审批。");
  }

  parts.push(
    `宪章一致性 ${dims.charterAlignment}分，设定冲突 ${dims.worldConsistency}分，完整性 ${dims.completeness}分，尺度一致 ${dims.scaleConsistency}分。`
  );

  if (crossRef && !crossRef.valid) {
    const fixable = crossRef.brokenRefs.filter((br) => br.fixConfidence >= 2).length;
    parts.push(
      `检测到 ${crossRef.brokenRefs.length} 个跨引擎引用问题` +
      (fixable > 0 ? `（其中 ${fixable} 个可自动修复）。` : `。`)
    );
  }

  return parts.join("");
}

/** error 提案的评估结果 */
function buildErrorEvaluation(checkpointTriggered: boolean, sourceNode: string): SpectrumEvaluation {
  return {
    overallScore: 0,
    band: "red",
    dimensions: {
      charterAlignment: 0,
      worldConsistency: 0,
      completeness: 0,
      scaleConsistency: 0,
    },
    riskLevel: "high",
    reasoning: "提案解析失败，无法评估。",
    checkpointTriggered,
    checkpointEngine: checkpointTriggered ? sourceNode : undefined,
  };
}

/** 提取关键词（简单分词） */
function extractKeywords(text: string): string[] {
  if (!text) return [];
  return text
    .split(/[\s,，.。;；!！?？、]/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 2)
    .filter((w) => !isStopWord(w));
}

/** 简单停用词过滤 */
function isStopWord(word: string): boolean {
  const stops = new Set([
    "的", "了", "在", "是", "我", "有", "和", "就", "不", "人", "都", "一", "一个", "上", "也", "很", "到", "说", "要", "去", "你", "会", "着", "没有", "看", "好", "自己", "这", "那",
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being", "have", "has", "had", "do", "does", "did", "will", "would", "could", "should",
  ]);
  return stops.has(word.toLowerCase());
}

/**
 * 判断提案是否可以通过 Full Auto 自动审批。
 *
 * 条件：
 * 1. 频谱带为 green（overallScore ≥ 75）
 * 2. 未触发关键引擎检查点
 * 3. 风险等级为 low
 */
export function canAutoApprove(evaluation: SpectrumEvaluation): boolean {
  return evaluation.band === "green" && !evaluation.checkpointTriggered && evaluation.riskLevel === "low";
}

/**
 * 获取频谱评估的阈值配置。
 * 未来可从项目设置或全局配置中读取。
 */
export function getSpectrumThresholds(): { green: number; yellow: number } {
  return {
    green: 75,
    yellow: 50,
  };
}
