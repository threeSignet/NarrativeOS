import type { PipelineSnapshot } from "./base";

// ── Engine interface ──

export interface EngineContext {
  projectId: string;
  sessionId: string;
  caller: string;
  /** Optional chapter ID for proactive engines (memory-extractor, censor-checker) */
  chapterId?: string;
  /** 写作引擎的章节快照 ID — 工具查询时自动传入 */
  snapshotChapterId?: string;
  /**
   * 细化上下文 — 引擎在细化模式下运行时提供，指定要细化的父条目和目标尺度。
   */
  refinement?: RefinementContext;
  /** v4.0: 创作宪章 */
  creationCharter?: CreationCharter;
  /** v4.0: 当前协作模式（项目级覆盖后的实际模式） */
  collaborationMode?: "plan" | "auto" | "full_auto";
}

/**
 * 细化上下文 — 让引擎以"为某个已确认条目生成下一层子条目"的模式运行
 */
export interface RefinementContext {
  /** 要细化的已确认 setting_item ID */
  parentItemId: string;
  /** 父条目名称 */
  parentName: string;
  /** 父条目的尺度（如 "planet"、"continent"） */
  parentScale: string;
  /** 本次细化的目标尺度（如 "continent"、"region"） */
  targetScale: string;
  /** 细化深度：0=首次自动检测，1=第一次细化，2=第二次细化... */
  depth: number;
}

export interface Proposal {
  type: string;
  title: string;
  content: {
    reasoning: string;
    payload: any;
  };
  targetTable?: string;
  targetAction?: "insert" | "update" | "delete";
  targetId?: string;
}

export interface EngineResult {
  proposals: Proposal[];
  latencyMs?: number;
  pipeline?: PipelineSnapshot;
}

// ── 工具调用事件（多轮工具循环） ──

/** LLM 发起工具调用时产生 */
export interface ToolCallEvent {
  type: "tool_call";
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
}

/** 工具执行完成后产生 */
export interface ToolResultEvent {
  type: "tool_result";
  toolCallId: string;
  summary: string;
}

// ── Multi-Item decomposition (for world engines) ──

export interface ItemBlueprint {
  subtype: string;
  name: string;
  summary: string;
  content: Record<string, unknown>;
  tags?: string[];
}

export interface RelationBlueprint {
  sourceName: string;
  targetName: string;
  relationType: "hierarchy" | "reference" | "opposition" | "dependency" | "geographic" | "affiliation" | "adjacency" | "functional";
  label: string;
  metadata?: Record<string, unknown>;
}

export interface MultiItemPayload {
  name?: string;
  [key: string]: unknown;
  items?: ItemBlueprint[];
  relations?: RelationBlueprint[];
}

// ── 共享常量（跨引擎/Pipeline 使用，避免多处重复定义） ──

/** 尺度链：从宏观到微观的层级序列 */
export const SCALE_CHAIN = [
  "universe", "galaxy", "star_system", "planet",
  "continent", "region", "city", "district", "scene",
] as const;

export type Scale = (typeof SCALE_CHAIN)[number];

/** 获取尺度在链中的中文标签 */
export function getScaleLabel(scale: string): string {
  const labels: Record<string, string> = {
    universe: "宇宙", galaxy: "星系", star_system: "恒星系", planet: "星球",
    continent: "大陆", region: "区域", city: "城市", district: "街区", scene: "场景",
  };
  return labels[scale] || scale;
}

/** 获取某尺度的下一级子尺度 */
export function getChildScale(scale: string): string | undefined {
  const idx = SCALE_CHAIN.indexOf(scale as any);
  return idx >= 0 && idx < SCALE_CHAIN.length - 1 ? SCALE_CHAIN[idx + 1] : undefined;
}

/** 合法的关系类型 */
export const VALID_RELATION_TYPES = [
  "hierarchy", "reference", "opposition", "dependency",
  "geographic", "affiliation", "adjacency", "functional",
  "passage", "barrier", "engulfment", "resonance", "phase_shift", "absence",
] as const;

// ── v4.0 创作宪章类型 ──

export interface CreationCharter {
  storySeed: string;
  mainLineBlueprint: {
    structureMode: string;
    acts: Array<{ actNumber: number; title: string; summary: string; keyEvents: string[] }>;
    totalVolumes: number;
    totalChapters: number;
  };
  coreCharacters: Array<{
    name: string;
    role: "protagonist" | "antagonist" | "supporting" | "mentor";
    archetype: string;
    personality: string;
    motivation: string;
    growthArc: string;
  }>;
  worldRules: Array<{
    category: "physics" | "power_system" | "society" | "economy" | "culture";
    rule: string;
    implications: string[];
  }>;
  narrativeRules: {
    writingStyle: string;
    pace: "fast" | "medium" | "slow";
    pov: "first_person" | "third_person_limited" | "third_person_omniscient";
    tone: string;
    dialogueStyle: string;
    descriptionDensity: "minimal" | "moderate" | "rich";
  };
  version: number;
  lastModifiedAt: string;
}
