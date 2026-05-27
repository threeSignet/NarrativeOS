// ── Event bus ──
export { bus } from "./event-bus";
export type { DomainEvent, DomainEventMap } from "./event-bus";

// ── Orchestrator (MOU lifecycle) ──
export { Orchestrator } from "./orchestrator";
export type { OnProposalsStaged } from "./orchestrator";

// ── Scheduler (dependency-graph engine execution) ──
export { EngineScheduler, registerEngine } from "./scheduler";
export type { SchedulerEvent, SchedulerEventType, EngineRegistration } from "./scheduler";

// ── Handlers (proposal execution) ──
export { registerHandler, findHandler } from "./handlers";
export type { ProposalHandler, ProposalHandlerContext, HandlerResult, NotificationOpts } from "./handlers";

// ── Pipeline configs ──
export { HATCHING_SEQUENCE, findNextHatchingEngine, isHatchingComplete } from "./pipelines/hatching";
export type { EngineStatus, PipelineState } from "./pipelines/hatching";
