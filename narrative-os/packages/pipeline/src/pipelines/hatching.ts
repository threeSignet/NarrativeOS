/**
 * 孵化流水线（Hatching Pipeline）
 *
 * 这是孵化阶段的流程编排文件。它不包含任何引擎逻辑，
 * 只定义：哪些引擎、按什么顺序、依赖什么条件来串联执行。
 *
 * 引擎本身在 @narrative-os/engines 中独立维护。
 * 流水线编排在 @narrative-os/pipeline 中。
 *
 * 流程：
 *   tone → geography → power-system → faction → character
 *   → conflict → item-system → story-blueprint
 *   → outline-generator → volume-outline → chapter-outline(×N)
 *
 * 使用方式：
 *   import { hatchingPipeline } from "@narrative-os/pipeline";
 *   const nextEngine = hatchingPipeline.findNext(engines, proposals);
 */

import type { EngineDef } from "@narrative-os/engines";
import { WORLD_ENGINES, STUDIO_ENGINES } from "@narrative-os/engines";

/** All engines that run during the hatching phase, in dependency order */
export const HATCHING_SEQUENCE: { def: EngineDef; repeatable?: boolean }[] = [
  ...WORLD_ENGINES.map(def => ({ def })),
  ...STUDIO_ENGINES.map(def => ({
    def,
    repeatable: def.name === "chapter-outline",
  })),
];

export interface EngineStatus {
  /** The engine's settingType (e.g. "power_system") — matches settingItems.type in DB */
  type: string;
  hasData: boolean;
  hasPending: boolean;
}

export interface PipelineState {
  engines: EngineStatus[];
  /** Approved proposal sourceNode names (e.g. "outline-generator", "power-system") */
  approvedSources: Set<string>;
}

/**
 * Find the next engine that should run in the hatching sequence.
 *
 * IMPORTANT: For world engines, `EngineStatus.type` must be the engine's
 * `settingType` (e.g. "power_system"), NOT the engine `name` (e.g. "power-system").
 * For studio engines, `approvedSources` uses the engine `name` (sourceNode).
 */
export function findNextHatchingEngine(state: PipelineState): string | null {
  const engineMap = Object.fromEntries(state.engines.map(e => [e.type, e]));

  for (const { def, repeatable } of HATCHING_SEQUENCE) {
    if (repeatable) continue; // handled separately (chapter-outline loop)

    if (def.engineGroup === "world") {
      const engine = engineMap[def.settingType];
      if (engine && !engine.hasData && !engine.hasPending) return def.name;
      if (engine?.hasPending) return null; // wait for approval
    } else {
      // Studio engines: check by approved proposal sourceNode
      if (!state.approvedSources.has(def.name)) return def.name;
    }
  }

  return null;
}

/**
 * Check if the hatching phase is complete.
 * World engines must all have data, and one-shot studio engines must all be approved.
 * Chapter-outline completion is checked separately (_checkMoreChaptersNeeded).
 */
export function isHatchingComplete(state: PipelineState): boolean {
  const worldDone = WORLD_ENGINES.every(def => {
    const engine = state.engines.find(e => e.type === def.settingType);
    return engine?.hasData;
  });

  if (!worldDone) return false;

  const oneShotStudio = STUDIO_ENGINES.filter(def => def.name !== "chapter-outline");
  const studioDone = oneShotStudio.every(def => state.approvedSources.has(def.name));

  return studioDone;
}
