import type { DomainEvent } from "../event-bus";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TransactionLike = any;

export interface NotificationOpts {
  priority: "p0" | "p1" | "p2" | "p3" | "p4";
  category: "conflict" | "proposal" | "system" | "retcon" | "preview" | "setting";
  title: string;
  body: string;
  sourceNode?: string;
  relatedEntityType?: "proposal" | "setting" | "chapter" | "session" | "project";
  relatedEntityId?: string;
}

export interface HandlerResult {
  executed: boolean;
  itemsCreated: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  executionResult: any;
  notification: NotificationOpts | null;
}

export interface ProposalHandlerContext {
  tx: TransactionLike;
  proposal: {
    id: string;
    projectId: string;
    type: string;
    title: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    content: { reasoning: string; payload: any };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    payload: any;
    sourceNode: string | null;
    targetAction: string | null;
    targetId: string | null;
    optionGroup: string | null;
  };
  emit(event: DomainEvent): void;
}

export interface ProposalHandler {
  canHandle(type: string, targetAction?: string | null): boolean;
  execute(ctx: ProposalHandlerContext): Promise<HandlerResult>;
}

const handlers: ProposalHandler[] = [];

export function registerHandler(handler: ProposalHandler) {
  handlers.push(handler);
}

export function findHandler(type: string, targetAction?: string | null): ProposalHandler | undefined {
  return handlers.find((h) => h.canHandle(type, targetAction));
}

export function listHandlers(): string[] {
  return handlers.map((h) => h.constructor.name);
}
