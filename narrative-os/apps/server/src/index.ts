import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import { sql } from "drizzle-orm";
import { db } from "@narrative-os/database";
import { wsBus } from "./ws-bus";
import { EngineScheduler } from "@narrative-os/pipeline";
import { VectorService } from "@narrative-os/database";
import { EmbeddingPipeline } from "@narrative-os/database";
import { createEmbeddingProvider } from "@narrative-os/llm-client";
import projects from "./routes/projects";
import sessions from "./routes/sessions";
import llmLogs from "./routes/llm-logs";
import hatch, { injectScheduler, orchestrator as hatchOrchestrator } from "./routes/hatch";
import brainstorm from "./routes/brainstorm";
import companion from "./routes/companion";
import outline from "./routes/outline";
import vector from "./routes/vector";
import charterRoutes from "./routes/charter";
import snapshotRoutes from "./routes/snapshots";
import timelineRoutes from "./routes/timeline";

const app = new Hono();
app.use(cors({
  origin: (process.env.CORS_ORIGIN?.split(",") || ["http://localhost:5173", "http://localhost:3000"]).map(s => s.trim()),
  credentials: true,
}));

app.get("/health", async (c) => {
  const result = await db.execute(sql`SELECT 1`);
  return c.json({ ok: true, db: !!result, wsConnections: wsBus.connectionCount() });
});

app.route("/projects", projects);
app.route("/sessions", sessions);
app.route("/llm-logs", llmLogs);
app.route("/", hatch);
app.route("/brainstorm", brainstorm);
app.route("/companion", companion);
app.route("/outline", outline);
app.route("/vector", vector);
app.route("/", charterRoutes);
app.route("/", snapshotRoutes);
app.route("/", timelineRoutes);

// ── WebSocket setup ──
const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

interface WSContext {
  projectId: string;
}

app.get(
  "/ws/:projectId",
  upgradeWebSocket((c) => {
    const projectId = c.req.param("projectId");
    const ctx: WSContext & { send?: (data: string) => void } = { projectId: projectId!, send: undefined };

    return {
      onOpen(_event, ws) {
        ctx.send = (data: string) => ws.send(data);
        wsBus.add(ctx as any);
        console.log(`[ws] client connected to project ${projectId} (${wsBus.connectionCount(projectId)} total)`);
      },
      onClose() {
        wsBus.remove(ctx as any);
        console.log(`[ws] client disconnected from project ${projectId}`);
      },
      onMessage(event, ws) {
        // Client can send ping or request commands
        try {
          const msg = JSON.parse(event.data as string);
          if (msg.type === "ping") {
            ws.send(JSON.stringify({ type: "pong" }));
          }
        } catch { /* ignore malformed */ }
      },
    };
  })
);

// ── Engine Scheduler ──
// 将 hatch 路由的 orchestrator 注入 scheduler，避免双实例导致 WS 通知丢失
// ── 初始化向量服务与嵌入管线 ──
const vectorService = new VectorService(db, createEmbeddingProvider());
EmbeddingPipeline.initialize(vectorService);

const scheduler = new EngineScheduler({
  orchestrator: hatchOrchestrator,
  onProposalsStaged: (projectId, proposalIds) => {
    wsBus.push(projectId, {
      type: "new_proposals",
      payload: { proposalIds, count: proposalIds.length },
    });
  },
  onEvent: (event) => {
    wsBus.push(event.projectId, {
      type: event.type,
      payload: { node: event.node, error: event.error, proposalIds: event.proposalIds, trigger: event.trigger, ...event.payload },
    });
  },
});

// Inject scheduler into hatch route for proposal resolution → next engine trigger
injectScheduler(scheduler);

// Trigger scheduler for a project (called on project entry)
app.post("/scheduler/:projectId/run", async (c) => {
  const projectId = c.req.param("projectId");
  // Run async — don't block the response
  scheduler.runMissingEngines(projectId).catch((err) => {
    console.error(`[scheduler] error for project ${projectId}:`, err.message);
  });
  return c.json({ ok: true, message: "Scheduler started" });
});

const port = Number(process.env.PORT) || 3001;

function startServer(retries = 3) {
  const server = serve({
    fetch: app.fetch,
    port,
  });

  server.on("error", (err: any) => {
    if (err.code === "EADDRINUSE" && retries > 0) {
      console.log(`[server] Port ${port} in use, retrying in 1s... (${retries} retries left)`);
      setTimeout(() => startServer(retries - 1), 1000);
    } else {
      console.error(`[server] Failed to start:`, err.message);
      process.exit(1);
    }
  });

  injectWebSocket(server);
  wsBus.startHeartbeat();

  server.on("listening", () => {
    console.log(`[server] NarrativeOS Phase 1 server running on http://localhost:${port}`);
  });
}

startServer();
