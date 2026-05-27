/**
 * Agent Communication Layer — Shared Types
 *
 * WorldAgent ↔ StudioAgent 的通信协议定义。
 * 所有消息均为结构化数据，支持查询、更新、细化和可能性探索。
 */

import type { QueryResultItem } from "@narrative-os/engines";

// ── WorldAgent 请求 ──

export interface WorldAgentRequest {
  type: "query" | "update" | "refine" | "get_possibilities";
  projectId: string;
  /** 查询参数 —— 用于 query / get_possibilities */
  query?: WorldAgentQuery;
  /** 更新参数 —— 用于 update */
  update?: WorldAgentUpdate;
  /** 细化参数 —— 用于 refine */
  refine?: WorldAgentRefine;
}

export interface WorldAgentQuery {
  /** 查询意图描述（自然语言） */
  what: string;
  /** 查询上下文 */
  context?: {
    chapterId?: string;
    scene?: string;
  };
  /** 结构化筛选（可选，覆盖自然语言解析） */
  filters?: {
    engine?: string;
    type?: string;
    subtype?: string;
    name?: string;
    keyword?: string;
    ids?: string[];
  };
}

export interface WorldAgentUpdate {
  settingItemId: string;
  changes: Record<string, unknown>;
  reason: string;
  /** 发起更新的章节（StudioAgent 反馈时提供） */
  sourceChapterId?: string;
}

export interface WorldAgentRefine {
  parentItemId: string;
}

// ── WorldAgent 响应 ──

export interface WorldAgentResponse {
  type: "data" | "possibilities" | "ack" | "error";
  /** 查询结果数据 */
  data?: QueryResultItem[];
  /** 可能性列表（含置信度和原因） */
  possibilities?: Array<{
    item: QueryResultItem;
    confidence: number;
    reason: string;
  }>;
  /** 受影响的章节 ID 列表（更新后返回） */
  affectedChapters?: string[];
  /** 错误信息 */
  error?: string;
}

// ── StudioAgent 状态 ──

export interface StudioAgentState {
  projectId: string;
  currentOutlineId?: string;
  currentVolumeId?: string;
  currentChapterId?: string;
  writingProgress: WritingProgress;
}

export interface WritingProgress {
  totalChapters: number;
  completedChapters: number;
  currentVolume: number;
  currentChapterNumber: number;
  wordsWritten: number;
  wordsTarget: number;
}

// ── StudioAgent → WorldAgent 的查询请求 ──

export interface StudioWorldQuery {
  /** 查询意图 */
  intent:
    | "character_detail"
    | "location_detail"
    | "power_system_check"
    | "faction_status"
    | "item_lookup"
    | "relationship_map"
    | "consistency_check"
    | "timeline_query"
    | "custom";
  /** 查询目标名称或 ID */
  target?: string;
  /** 额外上下文 */
  context?: {
    chapterId?: string;
    scene?: string;
    characters?: string[];
    locations?: string[];
  };
}

// ── 一致性检查结果 ──

export interface ConsistencyCheckResult {
  /** 是否通过一致性检查 */
  passed: boolean;
  /** 发现的冲突 */
  conflicts: Array<{
    severity: "error" | "warning" | "info";
    settingItemId?: string;
    settingName?: string;
    message: string;
    suggestion?: string;
  }>;
}

// ── Tracker 事件 ──

export interface TrackerEvent {
  type: "reference_recorded" | "version_recorded" | "impact_detected";
  projectId: string;
  chapterId?: string;
  settingItemId?: string;
  version?: number;
  affectedChapters?: string[];
}

// ── 影响分析结果 ──

export interface ImpactAnalysisResult {
  settingItemId: string;
  settingName: string;
  /** 直接引用此设定的章节 */
  directReferences: string[];
  /** 间接引用（通过关系链）的章节 */
  indirectReferences: string[];
  /** 可能受影响的引擎产出 */
  affectedEngineOutputs: Array<{
    engineSource: string;
    itemId: string;
    itemName: string;
  }>;
}
