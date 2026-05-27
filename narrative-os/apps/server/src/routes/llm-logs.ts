import { Hono } from "hono";
import { db, llmLogs } from "@narrative-os/database";
import { eq, desc } from "drizzle-orm";

const app = new Hono();

app.get("/", async (c) => {
  const projectId = c.req.query("project_id");

  let query = db.select().from(llmLogs).orderBy(desc(llmLogs.createdAt)).limit(50);

  if (projectId) {
    query = db.select().from(llmLogs)
      .where(eq(llmLogs.projectId, projectId))
      .orderBy(desc(llmLogs.createdAt))
      .limit(50) as any;
  }

  return c.json(await query);
});

export default app;
