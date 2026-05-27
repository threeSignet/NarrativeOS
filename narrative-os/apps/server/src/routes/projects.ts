import { Hono } from "hono";
import { db, projects } from "@narrative-os/database";
import { desc, eq, isNull } from "drizzle-orm";
import { validateUUID } from "../validation";

const app = new Hono();

// List projects (exclude soft-deleted)
app.get("/", async (c) => {
  const list = await db
    .select()
    .from(projects)
    .where(isNull(projects.deletedAt))
    .orderBy(desc(projects.createdAt));
  return c.json(list);
});

// Create project
app.post("/", async (c) => {
  const body = await c.req.json();
  const result = await db.insert(projects).values({
    title: body.title,
    genre: body.genre,
    style: body.style,
    targetWords: body.target_words,
    coreCreativity: body.core_creativity,
    platform: body.platform,
    // 新字段
    subtitle: body.subtitle,
    authorPenName: body.author_pen_name,
    authorRealName: body.author_real_name,
    authorIdCard: body.author_id_card,
    authorQq: body.author_qq,
    authorPhone: body.author_phone,
    authorEmail: body.author_email,
    novelType: body.novel_type,
    novelSubType: body.novel_sub_type,
    coreConcept: body.core_concept,
    synopsis: body.synopsis,
    tags: body.tags,
    targetAudience: body.target_audience,
    platformName: body.platform_name,
    platformBookId: body.platform_book_id,
    platformBookUrl: body.platform_book_url,
    platformNickname: body.platform_nickname,
    platformStatus: body.platform_status,
    platformAccount: body.platform_account,
    platformPasswordEncrypted: body.platform_password_encrypted,
    platformPasswordIv: body.platform_password_iv,
    autoSync: body.auto_sync,
    syncMode: body.sync_mode,
    targetTotalWords: body.target_total_words,
    targetChapterCount: body.target_chapter_count,
    targetDailyWords: body.target_daily_words,
    targetChapterWords: body.target_chapter_words,
    expectedEndDate: body.expected_end_date ? new Date(body.expected_end_date) : undefined,
    targetVolumeCount: body.target_volume_count,
    wordsPerVolume: body.words_per_volume,
    defaultModelId: body.default_model_id,
    defaultWritingStyle: body.default_writing_style,
    defaultPace: body.default_pace,
    defaultContentFocus: body.default_content_focus,
    customRules: body.custom_rules,
    coverImage: body.cover_image,
    outlineFile: body.outline_file,
    manuscriptPath: body.manuscript_path,
    createdBy: body.created_by,
  }).returning();
  return c.json(result[0]);
});

// Get single project
app.get("/:id", async (c) => {
  const id = c.req.param("id");
  const uuidErr = validateUUID(id, "projectId");
  if (uuidErr) return c.json({ error: uuidErr }, 400);
  const project = await db.query.projects.findFirst({
    where: (p, { eq }) => eq(p.id, id),
  });
  if (!project) return c.json({ error: "not found" }, 404);
  return c.json(project);
});

// Update project (only hatching status)
app.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const uuidErr = validateUUID(id, "projectId");
  if (uuidErr) return c.json({ error: uuidErr }, 400);
  let body: any = {};
  try { body = await c.req.json(); } catch { /* ignore */ }

  const [existing] = await db.select().from(projects).where(eq(projects.id, id));
  if (!existing) return c.json({ error: "not found" }, 404);
  if (existing.deletedAt) return c.json({ error: "project deleted" }, 410);
  if (existing.status !== "hatching") return c.json({ error: "only hatching projects can be edited" }, 400);

  const updates: Record<string, any> = { updatedAt: new Date() };
  if (body.title !== undefined) updates.title = body.title;
  if (body.genre !== undefined) updates.genre = body.genre;
  if (body.style !== undefined) updates.style = body.style;
  if (body.target_words !== undefined) updates.targetWords = body.target_words;
  if (body.core_creativity !== undefined) updates.coreCreativity = body.core_creativity;
  if (body.platform !== undefined) updates.platform = body.platform;
  // 新字段
  if (body.subtitle !== undefined) updates.subtitle = body.subtitle;
  if (body.author_pen_name !== undefined) updates.authorPenName = body.author_pen_name;
  if (body.author_real_name !== undefined) updates.authorRealName = body.author_real_name;
  if (body.author_id_card !== undefined) updates.authorIdCard = body.author_id_card;
  if (body.author_qq !== undefined) updates.authorQq = body.author_qq;
  if (body.author_phone !== undefined) updates.authorPhone = body.author_phone;
  if (body.author_email !== undefined) updates.authorEmail = body.author_email;
  if (body.novel_type !== undefined) updates.novelType = body.novel_type;
  if (body.novel_sub_type !== undefined) updates.novelSubType = body.novel_sub_type;
  if (body.core_concept !== undefined) updates.coreConcept = body.core_concept;
  if (body.synopsis !== undefined) updates.synopsis = body.synopsis;
  if (body.tags !== undefined) updates.tags = body.tags;
  if (body.target_audience !== undefined) updates.targetAudience = body.target_audience;
  if (body.platform_name !== undefined) updates.platformName = body.platform_name;
  if (body.platform_book_id !== undefined) updates.platformBookId = body.platform_book_id;
  if (body.platform_book_url !== undefined) updates.platformBookUrl = body.platform_book_url;
  if (body.platform_nickname !== undefined) updates.platformNickname = body.platform_nickname;
  if (body.platform_status !== undefined) updates.platformStatus = body.platform_status;
  if (body.platform_account !== undefined) updates.platformAccount = body.platform_account;
  if (body.platform_password_encrypted !== undefined) updates.platformPasswordEncrypted = body.platform_password_encrypted;
  if (body.platform_password_iv !== undefined) updates.platformPasswordIv = body.platform_password_iv;
  if (body.auto_sync !== undefined) updates.autoSync = body.auto_sync;
  if (body.sync_mode !== undefined) updates.syncMode = body.sync_mode;
  if (body.target_total_words !== undefined) updates.targetTotalWords = body.target_total_words;
  if (body.target_chapter_count !== undefined) updates.targetChapterCount = body.target_chapter_count;
  if (body.target_daily_words !== undefined) updates.targetDailyWords = body.target_daily_words;
  if (body.target_chapter_words !== undefined) updates.targetChapterWords = body.target_chapter_words;
  if (body.expected_end_date !== undefined) updates.expectedEndDate = new Date(body.expected_end_date);
  if (body.target_volume_count !== undefined) updates.targetVolumeCount = body.target_volume_count;
  if (body.words_per_volume !== undefined) updates.wordsPerVolume = body.words_per_volume;
  if (body.default_model_id !== undefined) updates.defaultModelId = body.default_model_id;
  if (body.default_writing_style !== undefined) updates.defaultWritingStyle = body.default_writing_style;
  if (body.default_pace !== undefined) updates.defaultPace = body.default_pace;
  if (body.default_content_focus !== undefined) updates.defaultContentFocus = body.default_content_focus;
  if (body.custom_rules !== undefined) updates.customRules = body.custom_rules;
  if (body.cover_image !== undefined) updates.coverImage = body.cover_image;
  if (body.outline_file !== undefined) updates.outlineFile = body.outline_file;
  if (body.manuscript_path !== undefined) updates.manuscriptPath = body.manuscript_path;

  const [updated] = await db
    .update(projects)
    .set(updates)
    .where(eq(projects.id, id))
    .returning();

  return c.json(updated);
});

// Soft delete
app.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const uuidErr = validateUUID(id, "projectId");
  if (uuidErr) return c.json({ error: uuidErr }, 400);
  const [existing] = await db.select().from(projects).where(eq(projects.id, id));
  if (!existing) return c.json({ error: "not found" }, 404);
  if (existing.deletedAt) return c.json({ error: "already deleted" }, 410);

  await db
    .update(projects)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(projects.id, id));

  return c.json({ success: true });
});

// Archive
app.post("/:id/archive", async (c) => {
  const id = c.req.param("id");
  const [existing] = await db.select().from(projects).where(eq(projects.id, id));
  if (!existing) return c.json({ error: "not found" }, 404);

  await db
    .update(projects)
    .set({ status: "archived", updatedAt: new Date() })
    .where(eq(projects.id, id));

  return c.json({ success: true });
});

export default app;
