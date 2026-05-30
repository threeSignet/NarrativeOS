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

const VALID_CHARTER_KEYS = [
  "storySeed",
  "mainLineBlueprint",
  "coreCharacters",
  "worldRules",
  "narrativeRules",
  "version",
  "lastModifiedAt",
];

function isPlainObject(v: any): v is Record<string, any> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function validateCharter(v: any): { ok: boolean; error?: string } {
  if (!isPlainObject(v)) return { ok: false, error: "charter must be an object" };
  const extraKeys = Object.keys(v).filter((k) => !VALID_CHARTER_KEYS.includes(k));
  if (extraKeys.length) return { ok: false, error: `Unexpected keys: ${extraKeys.join(", ")}` };

  if (v.storySeed !== undefined && typeof v.storySeed !== "string")
    return { ok: false, error: "storySeed must be a string" };
  if ((v.storySeed || "").length > 5000)
    return { ok: false, error: "storySeed exceeds 5000 chars" };

  if (v.coreCharacters !== undefined) {
    if (!Array.isArray(v.coreCharacters)) return { ok: false, error: "coreCharacters must be an array" };
    for (const ch of v.coreCharacters) {
      if (!isPlainObject(ch)) return { ok: false, error: "coreCharacters items must be objects" };
      for (const field of ["name", "role", "archetype", "personality", "motivation", "growthArc"]) {
        const val = ch[field];
        if (val !== undefined && typeof val !== "string")
          return { ok: false, error: `coreCharacters.${field} must be a string` };
        if ((val || "").length > 2000)
          return { ok: false, error: `coreCharacters.${field} exceeds 2000 chars` };
      }
    }
  }

  if (v.worldRules !== undefined) {
    if (!Array.isArray(v.worldRules)) return { ok: false, error: "worldRules must be an array" };
    for (const r of v.worldRules) {
      if (!isPlainObject(r)) return { ok: false, error: "worldRules items must be objects" };
      for (const field of ["category", "rule"]) {
        const val = r[field];
        if (val !== undefined && typeof val !== "string")
          return { ok: false, error: `worldRules.${field} must be a string` };
        if ((val || "").length > 2000)
          return { ok: false, error: `worldRules.${field} exceeds 2000 chars` };
      }
      if (r.implications !== undefined && !Array.isArray(r.implications))
        return { ok: false, error: "worldRules.implications must be an array" };
    }
  }

  if (v.narrativeRules !== undefined) {
    if (!isPlainObject(v.narrativeRules)) return { ok: false, error: "narrativeRules must be an object" };
    for (const field of ["writingStyle", "pace", "pov", "tone", "dialogueStyle", "descriptionDensity"]) {
      const val = v.narrativeRules[field];
      if (val !== undefined && typeof val !== "string")
        return { ok: false, error: `narrativeRules.${field} must be a string` };
      if ((val || "").length > 2000)
        return { ok: false, error: `narrativeRules.${field} exceeds 2000 chars` };
    }
  }

  if (v.version !== undefined && typeof v.version !== "number")
    return { ok: false, error: "version must be a number" };

  return { ok: true };
}

app.patch("/projects/:id/charter", async (c) => {
  const projectId = c.req.param("id");
  if (!validateUUID(projectId)) return c.json({ error: "Invalid project ID" }, 400);

  const body = await c.req.json();
  const charter = body.charter;

  const validation = validateCharter(charter);
  if (!validation.ok) {
    return c.json({ error: validation.error }, 400);
  }

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
