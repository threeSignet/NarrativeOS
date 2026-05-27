// ── Agent Communication Layer ──
// packages/agents — WorldAgent ↔ StudioAgent 通信协议与实现

// ── Types ──
export type {
  WorldAgentRequest,
  WorldAgentResponse,
  WorldAgentQuery,
  WorldAgentUpdate,
  WorldAgentRefine,
  StudioAgentState,
  StudioWorldQuery,
  ConsistencyCheckResult,
  WritingProgress,
  TrackerEvent,
  ImpactAnalysisResult,
} from "./types";

// ── Agents ──
export { WorldAgent } from "./world-agent";
export { StudioAgent } from "./studio-agent";

// ── Tracker ──
export {
  recordChapterSettingReference,
  recordChapterSettingReferences,
  extractSettingReferencesFromContent,
  recordSettingVersion,
  getSettingVersionHistory,
  compareSettingVersions,
  analyzeSettingImpact,
  getReferencingChapters,
  TrackerEventBus,
  trackerBus,
} from "./tracker";

// ── Prompts ──
export {
  buildWorldAgentSystemPrompt,
  buildStudioAgentSystemPrompt,
  buildQueryIntentParsePrompt,
  buildPossibilityEvalPrompt,
  buildConsistencyCheckPrompt,
} from "./prompts";
