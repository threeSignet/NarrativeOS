// narrative-os/apps/server/src/routes/timeline.ts
import { Hono } from "hono";
import { db, settingItemChanges, settingItems } from "@narrative-os/database";
import { eq, desc } from "drizzle-orm";
import { validateUUID } from "../services/hatch-service";

const app = new Hono();

app.get("/settings/items/:id/changes", async (c) => {
  const itemId = c.req.param("id");
  if (!validateUUID(itemId)) return c.json({ error: "Invalid item ID" }, 400);

  const changes = await db
    .select()
    .from(settingItemChanges)
    .where(eq(settingItemChanges.settingItemId, itemId))
    .orderBy(desc(settingItemChanges.createdAt));

  return c.json({ changes });
});

app.get("/projects/:id/timeline", async (c) => {
  const projectId = c.req.param("id");
  if (!validateUUID(projectId)) return c.json({ error: "Invalid project ID" }, 400);

  const changes = await db
    .select()
    .from(settingItemChanges)
    .where(eq(settingItemChanges.projectId, projectId))
    .orderBy(desc(settingItemChanges.createdAt));

  const itemIds = [...new Set(changes.map((ch) => ch.settingItemId))];
  const items =
    itemIds.length > 0
      ? await db
          .select({ id: settingItems.id, name: settingItems.name, type: settingItems.type })
          .from(settingItems)
          .where(eq(settingItems.projectId, projectId))
      : [];
  const itemMap = new Map(items.map((i) => [i.id, i]));

  return c.json({
    changes: changes.map((ch) => ({
      ...ch,
      itemName: itemMap.get(ch.settingItemId)?.name || "未知",
      itemType: itemMap.get(ch.settingItemId)?.type || "unknown",
    })),
  });
});

export default app;
