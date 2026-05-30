// narrative-os/apps/server/src/routes/charter.ts
import { Hono } from "hono";
import { db, projects } from "@narrative-os/database";
import { eq } from "drizzle-orm";
import { validateUUID } from "../services/hatch-service";

const app = new Hono();

app.get("/projects/:id/charter", async (c) => {
  const projectId = c.req.param("id");
  if (!validateUUID(projectId)) return c.json({ error: "Invalid project ID" }, 400);

  const [project] = await db
    .select({ creationCharter: projects.creationCharter })
    .from(projects)
    .where(eq(projects.id, projectId));

  return c.json({ charter: project?.creationCharter || null });
});

app.patch("/projects/:id/charter", async (c) => {
  const projectId = c.req.param("id");
  if (!validateUUID(projectId)) return c.json({ error: "Invalid project ID" }, 400);

  const body = await c.req.json();
  const charter = body.charter;

  const [updated] = await db
    .update(projects)
    .set({
      creationCharter: charter,
      updatedAt: new Date(),
    })
    .where(eq(projects.id, projectId))
    .returning({ id: projects.id, creationCharter: projects.creationCharter });

  if (!updated) return c.json({ error: "Project not found" }, 404);
  return c.json({ success: true, charter: updated.creationCharter });
});

app.patch("/projects/:id/mode", async (c) => {
  const projectId = c.req.param("id");
  if (!validateUUID(projectId)) return c.json({ error: "Invalid project ID" }, 400);

  const body = await c.req.json();
  const mode = body.mode;
  if (!["plan", "auto", "full_auto"].includes(mode)) {
    return c.json({ error: "Invalid mode. Must be plan, auto, or full_auto" }, 400);
  }

  await db
    .update(projects)
    .set({ collaborationMode: mode, updatedAt: new Date() })
    .where(eq(projects.id, projectId));

  return c.json({ success: true, mode });
});

export default app;
