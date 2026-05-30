// narrative-os/apps/server/src/routes/snapshots.ts
import { Hono } from "hono";
import { db, worldSnapshots } from "@narrative-os/database";
import { eq, desc } from "drizzle-orm";
import { validateUUID } from "../services/hatch-service";

function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (typeof a !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const k of keysA) {
    if (!keysB.includes(k)) return false;
    if (!deepEqual(a[k], b[k])) return false;
  }
  return true;
}

const app = new Hono();

app.get("/projects/:id/snapshots", async (c) => {
  const projectId = c.req.param("id");
  if (!validateUUID(projectId)) return c.json({ error: "Invalid project ID" }, 400);

  const snapshots = await db
    .select()
    .from(worldSnapshots)
    .where(eq(worldSnapshots.projectId, projectId))
    .orderBy(desc(worldSnapshots.createdAt));

  return c.json({ snapshots });
});

app.get("/world/snapshots/:id", async (c) => {
  const snapshotId = c.req.param("id");
  if (!validateUUID(snapshotId)) return c.json({ error: "Invalid snapshot ID" }, 400);

  const [snapshot] = await db.select().from(worldSnapshots).where(eq(worldSnapshots.id, snapshotId));
  if (!snapshot) return c.json({ error: "Snapshot not found" }, 404);

  return c.json({ snapshot });
});

app.post("/world/snapshots/compare", async (c) => {
  const body = await c.req.json();
  const { snapshotIdA, snapshotIdB } = body;

  if (!validateUUID(snapshotIdA) || !validateUUID(snapshotIdB)) {
    return c.json({ error: "Invalid snapshot IDs" }, 400);
  }

  const [snapA] = await db.select().from(worldSnapshots).where(eq(worldSnapshots.id, snapshotIdA));
  const [snapB] = await db.select().from(worldSnapshots).where(eq(worldSnapshots.id, snapshotIdB));

  if (!snapA || !snapB) return c.json({ error: "Snapshot not found" }, 404);

  const dataA = snapA.snapshotData as any;
  const dataB = snapB.snapshotData as any;

  const itemsA = dataA.items || [];
  const itemsB = dataB.items || [];

  const added = itemsB.filter((bi: any) => !itemsA.find((ai: any) => ai.id === bi.id));
  const removed = itemsA.filter((ai: any) => !itemsB.find((bi: any) => bi.id === ai.id));
  const modified: any[] = [];

  for (const bi of itemsB) {
    const ai = itemsA.find((x: any) => x.id === bi.id);
    if (ai && !deepEqual(ai.content, bi.content)) {
      modified.push({ before: ai, after: bi });
    }
  }

  return c.json({ added, removed, modified });
});

app.post("/projects/:id/snapshot", async (c) => {
  const projectId = c.req.param("id");
  if (!validateUUID(projectId)) return c.json({ error: "Invalid project ID" }, 400);

  const { buildWorldSnapshot } = await import("@narrative-os/engines");
  const snapshotData = await buildWorldSnapshot(projectId);

  const [inserted] = await db
    .insert(worldSnapshots)
    .values({
      projectId,
      snapshotType: "manual",
      snapshotData: snapshotData as any,
      itemCount: snapshotData.items.length,
      relationCount: snapshotData.relations.length,
      scaleLevels: [...new Set(snapshotData.items.map((i) => i.scaleLevel))],
      createdBy: "author",
    })
    .returning({ id: worldSnapshots.id });

  return c.json({ success: true, snapshotId: inserted.id });
});

export default app;
