// ── Engine base & types ──
export { Engine } from "./base";
export type { PipelineSnapshot } from "./base";
export type { Proposal, EngineContext, EngineResult, ItemBlueprint, RelationBlueprint, MultiItemPayload, ToolCallEvent, ToolResultEvent, RefinementContext } from "./types";
export { SCALE_CHAIN, getScaleLabel, getChildScale, VALID_RELATION_TYPES } from "./types";
export type { Scale } from "./types";

// ── Registry ──
export { registerEngine, getEngine, listEngines } from "./registry";

// ── Context ──
export { buildWorldContext, buildProjectMetaContext, buildDependencyNameRegistry, detectGenre, buildProjectNarrativeSection, loadProjectScales, getProjectChildScale, buildScaleContext } from "./context";
export type { WorldContextOpts, ProjectScale } from "./context";

// ── Engine config ──
export { ENGINE_REGISTRY, WORLD_ENGINES, STUDIO_ENGINES, PROACTIVE_ENGINES, HATCH_ENGINES, getEngineDef, areDepsSatisfied, getRunnableEngines, TYPE_TO_ENGINE } from "./engine-config";
export type { EngineDef } from "./engine-config";

// ── Engine map (引擎导航地图) ──
export { buildEngineMap, getEngineMap, getEngineMapEntry, formatEngineMapForPrompt } from "./engine-map";
export type { EngineMap, EngineMapEntry } from "./engine-map";

// ── World data query (统一数据查询) ──
export { queryWorldSetting } from "./query-world-setting";
export type { QueryWorldSettingParams, QueryWorldSettingResult, QueryResultItem, QueryResultRelation } from "./query-world-setting";

// ── Tools (工具定义 + 系统提示) ──
export { buildQueryWorldSettingToolDef, buildEngineMapPrompt, buildToolUsageGuide, buildToolSystemPromptSection } from "./tools";

// ── Tool executor (工具执行调度) ──
export { executeToolCall } from "./engine-tool-executor";
export type { ToolExecutionContext, ToolExecutionResult } from "./engine-tool-executor";

// ── World engines ──
export {
  ToneEngine,
  GeographyEngine,
  PowerSystemEngine,
  FactionEngine,
  RaceEngine,
  CultureEngine,
  HistoryEngine,
  TechniqueEngine,
  EconomyEngine,
  RulesEngine,
  CharacterEngine,
  ConflictEngine,
  CausalityEngine,
  ItemSystemEngine,
  StoryBlueprintEngine,
} from "./world";

// ── Studio engines ──
export { OutlineGeneratorEngine, VolumeOutlineEngine, ChapterOutlineEngine, ForeshadowingEngine, ChapterWriterEngine } from "./studio";

// ── Proactive engines ──
export { MemoryExtractorEngine, CensorCheckerEngine } from "./proactive";

// ── Register all engines ──
import { registerEngine } from "./registry";
import { ToneEngine } from "./world/tone";
import { GeographyEngine } from "./world/geography";
import { PowerSystemEngine } from "./world/power-system";
import { FactionEngine } from "./world/faction";
import { RaceEngine } from "./world/race";
import { CultureEngine } from "./world/culture";
import { HistoryEngine } from "./world/history";
import { TechniqueEngine } from "./world/technique";
import { EconomyEngine } from "./world/economy";
import { RulesEngine } from "./world/rules";
import { CharacterEngine } from "./world/character";
import { ConflictEngine } from "./world/conflict";
import { CausalityEngine } from "./world/causality";
import { ItemSystemEngine } from "./world/item-system";
import { StoryBlueprintEngine } from "./world/story-blueprint";
import { OutlineGeneratorEngine } from "./studio/outline-generator";
import { VolumeOutlineEngine } from "./studio/volume-outline";
import { ChapterOutlineEngine } from "./studio/chapter-outline";
import { ForeshadowingEngine } from "./studio/foreshadowing";
import { ChapterWriterEngine } from "./studio/chapter-writer";
import { MemoryExtractorEngine } from "./proactive/memory-extractor";
import { CensorCheckerEngine } from "./proactive/censor-checker";

registerEngine("tone", ToneEngine);

registerEngine("geography", GeographyEngine);
registerEngine("power-system", PowerSystemEngine);
registerEngine("faction", FactionEngine);
registerEngine("race", RaceEngine);
registerEngine("culture", CultureEngine);
registerEngine("history", HistoryEngine);
registerEngine("technique", TechniqueEngine);
registerEngine("economy", EconomyEngine);
registerEngine("rules", RulesEngine);
registerEngine("character", CharacterEngine);
registerEngine("conflict", ConflictEngine);
registerEngine("causality", CausalityEngine);
registerEngine("item-system", ItemSystemEngine);
registerEngine("story-blueprint", StoryBlueprintEngine);
registerEngine("outline-generator", OutlineGeneratorEngine);
registerEngine("volume-outline", VolumeOutlineEngine);
registerEngine("chapter-outline", ChapterOutlineEngine);
registerEngine("foreshadowing", ForeshadowingEngine);
registerEngine("chapter-writer", ChapterWriterEngine);
registerEngine("memory-extractor", MemoryExtractorEngine);
registerEngine("censor-checker", CensorCheckerEngine);

// ── v4.0 新增模块 ──
export { loadCreationCharter, formatCharterForPrompt } from "./creation-charter";
export type { CreationCharter } from "./types";
export { inferDefaultScale, buildGeoAnchor, injectGeoAnchors } from "./geo-anchor";
export type { GeoAnchor } from "./geo-anchor";
export { buildWorldSnapshot } from "./world-snapshot";
export type { WorldSnapshotData } from "./world-snapshot";
