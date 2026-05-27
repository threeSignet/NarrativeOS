/**
 * WebSocket event bus — server-side pub/sub for real-time events.
 *
 * Any part of the server can call `wsBus.push(projectId, event)` and
 * all connected WebSocket clients subscribed to that project will receive it.
 */

export type WSEventType =
  | "new_proposals"
  | "proposals_staged"
  | "proposal_status_changed"
  | "engine_started"
  | "engine_completed"
  | "engine_error"
  | "engine_chunk"
  | "engine_model"
  | "engine_usage"
  | "engine_done"
  | "engine_tool_call"
  | "engine_tool_result"
  | "engine_generation_start"
  | "phase_changed"
  | "error"
  | "project_activated"
  | "chapter_committed"
  | "setting_updated"
  | "setting_items_created"
  | "outline_generated"
  | "volume_created"
  | "chapter_created"
  | "notification"
  | "proactive_triggered"
  | "ping"
  | "pong";

export interface WSEvent {
  type: WSEventType;
  payload: Record<string, unknown>;
  timestamp?: string;
}

type WSClient = { send: (data: string) => void; projectId: string };

const clients = new Set<WSClient>();

export const wsBus = {
  /** Register a new WebSocket client for a project */
  add(client: WSClient) {
    clients.add(client);
  },

  /** Remove a client */
  remove(client: WSClient) {
    clients.delete(client);
  },

  /** Push an event to all clients subscribed to a project */
  push(projectId: string, event: WSEvent) {
    const data = JSON.stringify({
      ...event,
      timestamp: new Date().toISOString(),
    });
    let delivered = 0;
    const zombies: WSClient[] = [];
    for (const client of clients) {
      if (client.projectId === projectId) {
        try {
          client.send(data);
          delivered++;
        } catch {
          zombies.push(client);
        }
      }
    }
    // 清理发送失败的死连接
    for (const z of zombies) clients.delete(z);
    if (delivered > 0) {
      console.log(`[wsBus] ${event.type} → ${projectId} (${delivered} clients)`);
    }
  },

  /** Broadcast to ALL connected clients (use sparingly) */
  broadcast(event: WSEvent) {
    const data = JSON.stringify({
      ...event,
      timestamp: new Date().toISOString(),
    });
    const zombies: WSClient[] = [];
    for (const client of clients) {
      try {
        client.send(data);
      } catch {
        zombies.push(client);
      }
    }
    for (const z of zombies) clients.delete(z);
  },

  /** 启动心跳：每 30 秒 ping 所有客户端，清理断开的连接 */
  startHeartbeat() {
    setInterval(() => {
      const zombies: WSClient[] = [];
      for (const client of clients) {
        try {
          client.send(JSON.stringify({ type: "ping", timestamp: new Date().toISOString() }));
        } catch {
          zombies.push(client);
        }
      }
      for (const z of zombies) {
        clients.delete(z);
      }
      if (zombies.length > 0) {
        console.log(`[wsBus] 心跳清理了 ${zombies.length} 个僵尸连接`);
      }
    }, 30000);
  },

  /** Get count of connected clients for a project */
  connectionCount(projectId?: string): number {
    if (!projectId) return clients.size;
    let count = 0;
    for (const c of clients) {
      if (c.projectId === projectId) count++;
    }
    return count;
  },
};
