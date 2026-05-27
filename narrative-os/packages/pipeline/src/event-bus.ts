// Typed event bus for domain events

export interface DomainEventMap {
  "proposals.staged": {
    type: "proposals.staged";
    projectId: string;
    proposalIds: string[];
    sourceNode: string;
  };
  "proposal.approved": {
    type: "proposal.approved";
    projectId: string;
    proposalId: string;
    proposalType: string;
    sourceNode?: string;
  };
  "proposal.revised": {
    type: "proposal.revised";
    projectId: string;
    proposalId: string;
    notes: string;
  };
  "proposal.rejected": {
    type: "proposal.rejected";
    projectId: string;
    proposalId: string;
  };
  "project.activated": {
    type: "project.activated";
    projectId: string;
  };
  "chapter.committed": {
    type: "chapter.committed";
    projectId: string;
    chapterId: string;
  };
  "setting.updated": {
    type: "setting.updated";
    projectId: string;
    settingItemId: string;
  };
  "setting.items_created": {
    type: "setting.items_created";
    projectId: string;
    proposalId: string;
    itemIds: string[];
    relationIds: string[];
  };
  "engine.started": {
    type: "engine.started";
    projectId: string;
    engineName: string;
  };
  "engine.completed": {
    type: "engine.completed";
    projectId: string;
    engineName: string;
    proposalCount: number;
  };
  "engine.error": {
    type: "engine.error";
    projectId: string;
    engineName: string;
    error: string;
  };
  "outline.generated": {
    type: "outline.generated";
    projectId: string;
    outlineId?: string;
    proposalId: string;
  };
  "volume.created": {
    type: "volume.created";
    projectId: string;
    volumeId: string;
    volumeNumber: number;
  };
  "chapter.created": {
    type: "chapter.created";
    projectId: string;
    chapterId: string;
    chapterNumber: number;
  };
  "setting.deleted": {
    type: "setting.deleted";
    projectId: string;
    settingItemId: string;
  };
  "notification.created": {
    type: "notification.created";
    projectId: string;
    notificationId: string;
    priority: string;
    category: string;
  };
}

export type DomainEvent = DomainEventMap[keyof DomainEventMap];

export type EventHandler<T extends keyof DomainEventMap> = (
  event: DomainEventMap[T]
) => void | Promise<void>;

class EventBus {
  private listeners: Map<string, Set<(event: DomainEvent) => void>> = new Map();

  on<T extends keyof DomainEventMap>(
    type: T,
    handler: EventHandler<T>
  ): void {
    const key = type as string;
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key)!.add(handler as (event: DomainEvent) => void);
  }

  off<T extends keyof DomainEventMap>(
    type: T,
    handler: EventHandler<T>
  ): void {
    const key = type as string;
    this.listeners.get(key)?.delete(handler as (event: DomainEvent) => void);
  }

  emit<T extends keyof DomainEventMap>(event: DomainEventMap[T]): void {
    const key = event.type as string;
    const handlers = this.listeners.get(key);
    if (!handlers) return;
    for (const handler of handlers) {
      try {
        // 用 Promise.resolve 包裹以捕获同步和异步 handler 的异常
        void Promise.resolve().then(() => (handler as (e: DomainEvent) => unknown)(event)).catch(
          (err) => console.error(`[EventBus] Handler error for ${key}:`, err)
        );
      } catch (err) {
        console.error(`[EventBus] Handler error for ${key}:`, err);
      }
    }
  }

  /** Emit and log, useful for tracing */
  emitWithLog<T extends keyof DomainEventMap>(event: DomainEventMap[T]): void {
    console.log(`[EventBus] ${event.type}`, event);
    this.emit(event);
  }

  /** Get count of listeners for a given event type */
  listenerCount(type: keyof DomainEventMap): number {
    return this.listeners.get(type as string)?.size || 0;
  }
}

export const bus = new EventBus();
