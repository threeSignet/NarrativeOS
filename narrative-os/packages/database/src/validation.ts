/**
 * Zod Validation Layer for NarrativeOS+ Database
 *
 * All JSON/JSONB fields and API payloads should be validated through these schemas
 * before insertion or after retrieval.
 */

import { z } from "zod";

// ── Reusable primitive schemas ──

export const uuidSchema = z.string().uuid();

export const timestampSchema = z.union([z.date(), z.string().datetime()]);

// ── Project schemas ──

export const projectStatusSchema = z.enum([
  "hatching", "active", "archived",
  "draft", "worldbuilding", "outlining", "writing",
  "paused", "completed", "revision", "published",
]);

export const novelTypeSchema = z.enum([
  "xianxia", "wuxia", "urban", "scifi", "fantasy",
  "history", "romance", "suspense", "game", "military",
  "supernatural", "fanfic", "light_novel", "other",
]);

export const platformNameSchema = z.enum([
  "qidian", "jjwxc", "fanqie", "7k7k", "hongxiu",
  "yunqi", "sfacg", "chuangshi", "bilibili", "webnovel",
  "amazon", "custom",
]);

export const platformStatusSchema = z.enum([
  "inactive", "draft", "reviewing", "rejected",
  "signed", "serializing", "completed", "removed",
]);

export const targetAudienceSchema = z.enum([
  "male", "female", "universal", "shounen", "shoujo", "danmei",
]);

export const writingStyleSchema = z.enum([
  "hardcore_realism", "light_humor", "hot_blooded",
  "delicate_literary", "dark_depressing", "witty_roast",
]);

export const paceSchema = z.enum(["fast", "medium", "slow"]);

export const syncModeSchema = z.enum(["manual", "auto_draft", "auto_publish"]);

export const aiActionSchema = z.enum([
  "none", "outline", "generate", "continue", "polish",
  "dialogue_optimize", "develop", "fix_logic", "expand", "enhance",
]);

export const structureModeSchema = z.enum([
  "five_act", "three_act", "heros_journey",
  "kishotenketsu", "johakyu", "custom",
]);

export const outlineModeSchema = z.enum(["rough", "detailed"]);

// ── Project create/update payload schemas ──

export const projectCreateSchema = z.object({
  title: z.string().min(1).max(200),
  genre: z.string().min(1).max(100),
  style: z.string().max(100).optional(),
  target_words: z.number().int().positive().optional(),
  core_creativity: z.string().max(2000).optional(),
  platform: z.string().max(100).optional(),

  subtitle: z.string().max(200).optional(),
  author_pen_name: z.string().max(100).optional(),
  author_real_name: z.string().max(100).optional(),
  author_id_card: z.string().max(50).optional(),
  author_qq: z.string().max(20).optional(),
  author_phone: z.string().max(20).optional(),
  author_email: z.string().email().max(100).optional(),
  novel_type: novelTypeSchema.optional(),
  novel_sub_type: z.string().max(100).optional(),
  core_concept: z.string().max(2000).optional(),
  synopsis: z.string().max(10000).optional(),
  tags: z.array(z.string()).optional(),
  target_audience: targetAudienceSchema.optional(),

  platform_name: platformNameSchema.optional(),
  platform_book_id: z.string().max(100).optional(),
  platform_book_url: z.string().url().max(500).optional(),
  platform_nickname: z.string().max(100).optional(),
  platform_status: platformStatusSchema.optional(),
  platform_account: z.string().max(100).optional(),
  platform_password_encrypted: z.string().max(500).optional(),
  platform_password_iv: z.string().max(100).optional(),

  auto_sync: z.boolean().optional(),
  sync_mode: syncModeSchema.optional(),
  target_total_words: z.number().int().positive().optional(),
  target_chapter_count: z.number().int().positive().optional(),
  target_daily_words: z.number().int().positive().optional(),
  target_chapter_words: z.number().int().positive().optional(),
  expected_end_date: z.string().datetime().optional(),
  target_volume_count: z.number().int().positive().optional(),
  words_per_volume: z.number().int().positive().optional(),

  default_model_id: z.string().max(100).optional(),
  default_writing_style: writingStyleSchema.optional(),
  default_pace: paceSchema.optional(),
  default_content_focus: z.record(z.string(), z.unknown()).optional(),
  custom_rules: z.record(z.string(), z.unknown()).optional(),

  cover_image: z.string().max(500).optional(),
  outline_file: z.string().max(500).optional(),
  manuscript_path: z.string().max(500).optional(),
  created_by: z.string().max(100).optional(),
});

export type ProjectCreateInput = z.infer<typeof projectCreateSchema>;

export const projectUpdateSchema = projectCreateSchema.partial().extend({
  status: projectStatusSchema.optional(),
});

export type ProjectUpdateInput = z.infer<typeof projectUpdateSchema>;

// ── Chapter schemas ──

export const chapterStatusSchema = z.enum([
  "draft", "confirmed", "archived",
  "reviewing", "pending_proposal", "frozen",
  "published", "retcon_pending", "retcon_reviewing",
]);

export const emotionTypeSchema = z.enum([
  "tense", "joyful", "sad", "angry", "anticipating",
  "horrific", "warm", "satisfying", "neutral",
]);

export const chapterCreateSchema = z.object({
  title: z.string().min(1).max(200),
  summary: z.string().max(2000).optional(),
  outline: z.record(z.string(), z.unknown()).optional(),
  status: chapterStatusSchema.optional(),
  word_count_target: z.number().int().positive().optional(),
  subtitle: z.string().max(200).optional(),
  content_path: z.string().max(500).optional(),
  content_summary: z.string().max(2000).optional(),
  emotion_overall: emotionTypeSchema.optional(),
  emotion_points: z.array(z.record(z.string(), z.unknown())).optional(),
  appearing_characters: z.array(z.string()).optional(),
  appearing_items: z.array(z.string()).optional(),
  appearing_locations: z.array(z.string()).optional(),
  appearing_techniques: z.array(z.string()).optional(),
  planted_foreshadowings: z.array(z.string()).optional(),
  resolved_foreshadowings: z.array(z.string()).optional(),
  referenced_foreshadowings: z.array(z.string()).optional(),
  writing_style: writingStyleSchema.optional(),
  content_focus: z.record(z.string(), z.unknown()).optional(),
  custom_rules: z.record(z.string(), z.unknown()).optional(),
});

export type ChapterCreateInput = z.infer<typeof chapterCreateSchema>;

export const chapterUpdateSchema = chapterCreateSchema.partial();

export type ChapterUpdateInput = z.infer<typeof chapterUpdateSchema>;

// ── Outline schemas ──

export const outlineStatusSchema = z.enum([
  "draft", "confirmed", "archived",
  "approved", "deprecated", "rejected",
]);

export const outlineCreateSchema = z.object({
  title: z.string().min(1).max(200),
  summary: z.string().max(2000).optional(),
  content: z.record(z.string(), z.unknown()),
  status: outlineStatusSchema.optional(),
  outline_mode: outlineModeSchema.optional(),
  structure_mode: structureModeSchema.optional(),
  target_total_words: z.number().int().positive().optional(),
  target_chapter_count: z.number().int().positive().optional(),
  target_volume_count: z.number().int().positive().optional(),
  narrative_pace: paceSchema.optional(),
  content_focus: z.record(z.string(), z.unknown()).optional(),
  custom_requirements: z.string().max(5000).optional(),
});

export type OutlineCreateInput = z.infer<typeof outlineCreateSchema>;

// ── Volume schemas ──

export const volumeStatusSchema = z.enum([
  "draft", "confirmed", "archived",
  "planned", "writing", "completed", "revision", "published",
]);

export const volumeCreateSchema = z.object({
  title: z.string().min(1).max(200),
  summary: z.string().max(2000).optional(),
  outline: z.record(z.string(), z.unknown()).optional(),
  status: volumeStatusSchema.optional(),
  word_count_target: z.number().int().positive().optional(),
  subtitle: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
  target_arc: z.string().max(1000).optional(),
  structure_mode: structureModeSchema.optional(),
});

export type VolumeCreateInput = z.infer<typeof volumeCreateSchema>;

// ── Proposal / MOU schemas ──

export const proposalStatusSchema = z.enum([
  "pending", "approved", "rejected", "superseded", "revision_requested", "executing",
]);

export const approvalModeSchema = z.enum(["manual", "auto", "threshold"]);

export const targetActionSchema = z.enum(["insert", "update", "delete"]);

export const proposalContentSchema = z.object({
  reasoning: z.string(),
  payload: z.record(z.string(), z.unknown()),
});

export const proposalSchema = z.object({
  type: z.string().min(1),
  title: z.string().min(1).max(300),
  content: proposalContentSchema,
  target_table: z.string().optional(),
  target_action: targetActionSchema.optional(),
  target_id: uuidSchema.optional(),
});

export type ProposalInput = z.infer<typeof proposalSchema>;

// ── Setting Item schemas ──

export const settingStatusSchema = z.enum(["draft", "confirmed", "archived"]);

export const relationTypeSchema = z.enum([
  "hierarchy", "reference", "opposition", "dependency", "geographic", "affiliation", "adjacency", "functional",
]);

export const settingItemCreateSchema = z.object({
  type: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
  summary: z.string().min(1).max(1000),
  content: z.record(z.string(), z.unknown()),
  status: settingStatusSchema.optional(),
  tags: z.array(z.string()).optional(),
  parent_item_id: uuidSchema.optional(),
  engine_source: z.string().max(50).optional(),
  item_subtype: z.string().max(50).optional(),
});

export type SettingItemCreateInput = z.infer<typeof settingItemCreateSchema>;

// ── Outline Item schemas ──

export const executionStatusSchema = z.enum([
  "pending", "linked", "deviated", "completed",
]);

export const outlineItemCreateSchema = z.object({
  outline_id: uuidSchema,
  volume_number: z.number().int().positive().default(1),
  chapter_number: z.number().int().positive(),
  volume_chapter_number: z.number().int().positive().optional(),
  title: z.string().min(1).max(200),
  rough_summary: z.string().max(2000).optional(),
  detailed_plot: z.string().max(10000).optional(),
  plot_points: z.array(z.record(z.string(), z.unknown())).optional(),
  emotion_overall: emotionTypeSchema.optional(),
  emotion_points: z.array(z.record(z.string(), z.unknown())).optional(),
  narrative_pace: paceSchema.optional(),
  key_characters: z.array(z.string()).optional(),
  key_locations: z.array(z.string()).optional(),
  key_items: z.array(z.string()).optional(),
  key_events: z.array(z.string()).optional(),
  to_plant_foreshadowings: z.array(z.string()).optional(),
  to_resolve_foreshadowings: z.array(z.string()).optional(),
  to_reference_foreshadowings: z.array(z.string()).optional(),
  target_words: z.number().int().positive().optional(),
  min_words: z.number().int().positive().optional(),
  max_words: z.number().int().positive().optional(),
  linked_chapter_id: uuidSchema.optional(),
  execution_status: executionStatusSchema.optional(),
  author_notes: z.string().max(2000).optional(),
  ai_suggestions: z.record(z.string(), z.unknown()).optional(),
  sort_order: z.number().int(),
});

export type OutlineItemCreateInput = z.infer<typeof outlineItemCreateSchema>;

// ── Notification schemas ──

export const notificationPrioritySchema = z.enum(["p0", "p1", "p2", "p3", "p4"]);

export const notificationCategorySchema = z.enum([
  "conflict", "proposal", "system", "retcon", "preview", "setting",
]);

export const notificationStatusSchema = z.enum(["unread", "read", "dismissed", "acted"]);

// ── Session schemas ──

export const sessionTypeSchema = z.enum(["active", "closed"]);

// ── Daily Stats schemas ──

export const dailyStatsSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  words_added: z.number().int().min(0).optional(),
  chapters_added: z.number().int().min(0).optional(),
  words_deleted: z.number().int().min(0).optional(),
  words_edited: z.number().int().min(0).optional(),
  writing_minutes: z.number().int().min(0).optional(),
  ai_calls: z.number().int().min(0).optional(),
  proposals_generated: z.number().int().min(0).optional(),
  proposals_approved: z.number().int().min(0).optional(),
  proposals_rejected: z.number().int().min(0).optional(),
  proposals_modified: z.number().int().min(0).optional(),
  total_words_at_eod: z.number().int().min(0).optional(),
  total_chapters_at_eod: z.number().int().min(0).optional(),
});

export type DailyStatsInput = z.infer<typeof dailyStatsSchema>;

// ── Utility: safe parse helper ──

export function safeValidate<T>(schema: z.ZodType<T>, data: unknown): { success: true; data: T } | { success: false; errors: z.ZodIssue[] } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error.issues };
}
