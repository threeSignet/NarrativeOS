import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  jsonb,
  index,
  boolean,
  check,
} from "drizzle-orm/pg-core";
import { sql, type SQL } from "drizzle-orm";

// ============================================================================
// 时区策略（统一东八区 UTC+8）
// ============================================================================
// 1. 数据库字段类型：全部使用 `timestamp with time zone`（简称 timestamptz）
//    - 内部存储：永远是 UTC 时间戳，全球统一基准，不怕跨国协作
//    - 写入时：PostgreSQL 自动将带时区的时间戳转为 UTC 存入
//    - 查询时：按当前会话时区 `SET timezone = 'Asia/Shanghai'` 显示为北京时间
// 2. 服务器进程：`.env` 中 `TZ=Asia/Shanghai`，日志/API 返回默认展示北京时间
// 3. API 序列化：返回 ISO 8601 字符串（如 `2026-05-21T07:22:55.863Z`），带 `Z` 表示 UTC
//    - 前端/客户端用 `new Date(utcString)` 自动转本地时区展示
// 4. 为什么不用 `timestamp`（无时区）：
//    - 存 `2026-05-21 15:22:55` 但不知道这是哪个时区的 15:22，跨国协作会乱
//    - `timestamptz` 写入时带时区信息，自动转 UTC；读取时按会话时区显示
// 5. 统一铁律：数据库内部绝对统一（UTC），展示层灵活（按会话/用户时区）
// ============================================================================

// ═══════════════════════════════════════════════════════════════════════════
// CHECK 约束常量（集中管理，避免拼写不一致）
// ═══════════════════════════════════════════════════════════════════════════

const PROJECT_STATUS_VALUES = [
  "hatching", "active", "archived",
  "draft", "worldbuilding", "outlining", "writing",
  "paused", "completed", "revision", "published",
] as const;

const CHAPTER_STATUS_VALUES = [
  "draft", "confirmed", "archived",
  "reviewing", "pending_proposal", "frozen",
  "published", "retcon_pending", "retcon_reviewing",
] as const;

const VOLUME_STATUS_VALUES = [
  "draft", "confirmed", "archived",
  "planned", "writing", "completed", "revision", "published",
] as const;

const OUTLINE_STATUS_VALUES = [
  "draft", "confirmed", "archived",
  "approved", "deprecated", "rejected",
] as const;

const SETTING_STATUS_VALUES = [
  "draft", "confirmed", "archived",
] as const;

const PROPOSAL_STATUS_VALUES = [
  "pending", "approved", "rejected", "superseded", "revision_requested",
] as const;

const MOU_STATUS_VALUES = PROPOSAL_STATUS_VALUES;

const NOTIFICATION_STATUS_VALUES = [
  "unread", "read", "dismissed", "acted",
] as const;

const LLM_LOG_STATUS_VALUES = [
  "success", "error", "timeout",
] as const;

const APPROVAL_MODE_VALUES = [
  "manual", "auto", "threshold",
] as const;

const TARGET_ACTION_VALUES = [
  "insert", "update", "delete",
] as const;

const DISCUSSION_ROLE_VALUES = [
  "user", "assistant",
] as const;

const NOTIFICATION_PRIORITY_VALUES = [
  "p0", "p1", "p2", "p3", "p4",
] as const;

const NOTIFICATION_CATEGORY_VALUES = [
  "conflict", "proposal", "system", "retcon", "preview", "setting",
] as const;

const NOTIFICATION_READ_ACTION_VALUES = [
  "read", "dismissed", "acted",
] as const;

const RELATION_TYPE_VALUES = [
  "hierarchy", "reference", "opposition", "dependency", "geographic", "affiliation", "adjacency", "functional",
] as const;

const NOVEL_TYPE_VALUES = [
  "xianxia", "wuxia", "urban", "scifi", "fantasy",
  "history", "romance", "suspense", "game", "military",
  "supernatural", "fanfic", "light_novel", "other",
] as const;

const PLATFORM_NAME_VALUES = [
  "qidian", "jjwxc", "fanqie", "7k7k", "hongxiu",
  "yunqi", "sfacg", "chuangshi", "bilibili", "webnovel",
  "amazon", "custom",
] as const;

const PLATFORM_STATUS_VALUES = [
  "inactive", "draft", "reviewing", "rejected",
  "signed", "serializing", "completed", "removed",
] as const;

const TARGET_AUDIENCE_VALUES = [
  "male", "female", "universal", "shounen", "shoujo", "danmei",
] as const;

const WRITING_STYLE_VALUES = [
  "hardcore_realism", "light_humor", "hot_blooded",
  "delicate_literary", "dark_depressing", "witty_roast",
] as const;

const PACE_VALUES = [
  "fast", "medium", "slow",
] as const;

const EMOTION_TYPE_VALUES = [
  "tense", "joyful", "sad", "angry", "anticipating",
  "horrific", "warm", "satisfying", "neutral",
] as const;

const AI_ACTION_VALUES = [
  "none", "outline", "generate", "continue", "polish",
  "dialogue_optimize", "develop", "fix_logic", "expand", "enhance",
] as const;

const STRUCTURE_MODE_VALUES = [
  "five_act", "three_act", "heros_journey",
  "kishotenketsu", "johakyu", "custom",
] as const;

const OUTLINE_MODE_VALUES = [
  "rough", "detailed",
] as const;

const SYNC_MODE_VALUES = [
  "manual", "auto_draft", "auto_publish",
] as const;

const EXECUTION_STATUS_VALUES = [
  "pending", "linked", "deviated", "completed",
] as const;

const SESSION_TYPE_VALUES = [
  "active", "closed",
] as const;

// Helper to build IN clause for check constraints
function inCheck(column: any, values: readonly string[]): SQL {
  const list = values.map((v) => `'${v.replace(/'/g, "''")}'`).join(", ");
  return sql.raw(`${column.name} IN (${list})`);
}

// ============================================================================
// Phase 0 核心表（6 张）+ 扩展字段
// ============================================================================

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),

    // ── 基础信息扩展 ──
    subtitle: text("subtitle"),
    authorPenName: text("author_pen_name"),
    authorRealName: text("author_real_name"),
    authorIdCard: text("author_id_card"),
    authorQq: text("author_qq"),
    authorPhone: text("author_phone"),
    authorEmail: text("author_email"),

    // ── 类型与核心创意 ──
    genre: text("genre").notNull(),
    novelType: text("novel_type"),
    novelSubType: text("novel_sub_type"),
    coreCreativity: text("core_creativity"),
    coreConcept: text("core_concept"),
    synopsis: text("synopsis"),
    tags: jsonb("tags"),
    targetAudience: text("target_audience"),
    style: text("style"),

    // ── 平台信息（单平台） ──
    platform: text("platform"),
    platformName: text("platform_name"),
    platformBookId: text("platform_book_id"),
    platformBookUrl: text("platform_book_url"),
    platformNickname: text("platform_nickname"),
    platformStatus: text("platform_status").default("inactive"),
    platformAccount: text("platform_account"),
    platformPasswordEncrypted: text("platform_password_encrypted"),
    platformPasswordIv: text("platform_password_iv"),

    // ── 同步配置 ──
    autoSync: boolean("auto_sync").default(false),
    syncMode: text("sync_mode").default("manual"),
    lastSyncedChapterId: uuid("last_synced_chapter_id"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),

    // ── 写作目标 ──
    targetWords: integer("target_words"),
    targetTotalWords: integer("target_total_words"),
    targetChapterCount: integer("target_chapter_count"),
    targetDailyWords: integer("target_daily_words").default(2000),
    targetChapterWords: integer("target_chapter_words").default(3000),
    expectedEndDate: timestamp("expected_end_date", { withTimezone: true }),
    targetVolumeCount: integer("target_volume_count"),
    wordsPerVolume: integer("words_per_volume"),

    // ── 项目状态（生命周期） ──
    status: text("status").notNull().default("hatching"),

    // ── AI 写作配置 ──
    defaultModelId: text("default_model_id"),
    defaultWritingStyle: text("default_writing_style"),
    defaultPace: text("default_pace").default("medium"),
    defaultContentFocus: jsonb("default_content_focus"),
    customRules: jsonb("custom_rules"),

    // ── 版本与统计（实时/缓存） ──
    version: integer("version").notNull().default(1),
    totalWords: integer("total_words").notNull().default(0),
    totalChapters: integer("total_chapters").notNull().default(0),
    totalVolumes: integer("total_volumes").notNull().default(0),
    latestChapterNumber: integer("latest_chapter_number").default(0),
    latestChapterId: uuid("latest_chapter_id"),
    latestVolumeId: uuid("latest_volume_id"),

    // ── 写作统计 ──
    wordsToday: integer("words_today").default(0),
    wordsThisWeek: integer("words_this_week").default(0),
    wordsThisMonth: integer("words_this_month").default(0),
    wordsTrend: jsonb("words_trend"),
    streakDays: integer("streak_days").default(0),
    maxStreakDays: integer("max_streak_days").default(0),
    lastWritingDate: timestamp("last_writing_date", { withTimezone: true }),
    totalWritingHours: text("total_writing_hours").default("0"),

    // ── 封面与文件 ──
    coverImage: text("cover_image"),
    outlineFile: text("outline_file"),
    manuscriptPath: text("manuscript_path"),

    // ── 已有字段（向后兼容） ──
    genreContract: jsonb("genre_contract"),
    worldBible: jsonb("world_bible"),

    // ── 审计与软删除 ──
    createdBy: text("created_by"),
    isDeleted: boolean("is_deleted").notNull().default(false),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedReason: text("deleted_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),

    // ── 时间管理 ──
    firstPublishedAt: timestamp("first_published_at", { withTimezone: true }),
    lastPublishedAt: timestamp("last_published_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (table) => ({
    deletedAtIdx: index("projects_deleted_at_idx").on(table.deletedAt),
    statusIdx: index("projects_status_idx").on(table.status),
    novelTypeIdx: index("projects_novel_type_idx").on(table.novelType),
    platformIdx: index("projects_platform_idx").on(table.platformName),
    createdAtIdx: index("projects_created_at_idx").on(table.createdAt),
    updatedAtIdx: index("projects_updated_at_idx").on(table.updatedAt),
    statusCheck: check("projects_status_check", inCheck(table.status, PROJECT_STATUS_VALUES)),
    novelTypeCheck: check("projects_novel_type_check", inCheck(table.novelType, [...NOVEL_TYPE_VALUES, ""])),
    platformNameCheck: check("projects_platform_name_check", inCheck(table.platformName, [...PLATFORM_NAME_VALUES, ""])),
    platformStatusCheck: check("projects_platform_status_check", inCheck(table.platformStatus, PLATFORM_STATUS_VALUES)),
    targetAudienceCheck: check("projects_target_audience_check", inCheck(table.targetAudience, [...TARGET_AUDIENCE_VALUES, ""])),
    defaultWritingStyleCheck: check("projects_writing_style_check", inCheck(table.defaultWritingStyle, [...WRITING_STYLE_VALUES, ""])),
    defaultPaceCheck: check("projects_pace_check", inCheck(table.defaultPace, PACE_VALUES)),
    syncModeCheck: check("projects_sync_mode_check", inCheck(table.syncMode, SYNC_MODE_VALUES)),
  })
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id),
    type: text("type").notNull(),
    title: text("title"),
    status: text("status").notNull().default("active"),
    contextSnapshot: jsonb("context_snapshot"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
  },
  (table) => ({
    projectIdIdx: index("sessions_project_id_idx").on(table.projectId),
    statusCheck: check("sessions_status_check", inCheck(table.status, [...SESSION_TYPE_VALUES, "hatching", "outline", "writing", "setting-update"])),
  })
);

export const discussions = pgTable(
  "discussions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id),
    sessionId: uuid("session_id").notNull().references(() => sessions.id),
    role: text("role", { enum: ["user", "assistant"] }).notNull(),
    content: text("content").notNull(),
    proposalId: uuid("proposal_id").references(() => aiProposals.id),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    sessionIdIdx: index("discussions_session_id_idx").on(table.sessionId),
    projectIdIdx: index("discussions_project_id_idx").on(table.projectId),
    roleCheck: check("discussions_role_check", inCheck(table.role, DISCUSSION_ROLE_VALUES)),
  })
);

export const aiProposals = pgTable(
  "ai_proposals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id),
    sessionId: uuid("session_id").notNull().references(() => sessions.id),
    type: text("type").notNull(),
    title: text("title").notNull(),
    content: jsonb("content").notNull(),
    targetTable: text("target_table"),
    targetAction: text("target_action", { enum: ["insert", "update", "delete"] }),
    targetId: uuid("target_id"),
    payload: jsonb("payload"),
    approvalMode: text("approval_mode", { enum: ["manual", "auto", "threshold"] }).notNull().default("manual"),
    impactScore: integer("impact_score"),
    status: text("status", { enum: ["pending", "approved", "rejected", "superseded", "revision_requested", "executing"] }).notNull().default("pending"),
    version: integer("version").notNull().default(1),
    parentId: uuid("parent_id"),
    rejectionNote: text("rejection_note"),
    revisionNotes: text("revision_notes"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    sourceNode: text("source_node").notNull(),
    pipeline: jsonb("pipeline"),
    optionGroup: text("option_group"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    projectStatusIdx: index("ai_proposals_project_status_idx").on(table.projectId, table.status),
    sessionIdIdx: index("ai_proposals_session_id_idx").on(table.sessionId),
    parentIdIdx: index("ai_proposals_parent_id_idx").on(table.parentId),
    optionGroupIdx: index("ai_proposals_option_group_idx").on(table.optionGroup),
    statusCheck: check("ai_proposals_status_check", inCheck(table.status, [...PROPOSAL_STATUS_VALUES, "executing"])),
    approvalModeCheck: check("ai_proposals_approval_mode_check", inCheck(table.approvalMode, APPROVAL_MODE_VALUES)),
    targetActionCheck: check("ai_proposals_target_action_check", inCheck(table.targetAction, [...TARGET_ACTION_VALUES, ""])),
  })
);

// @ts-expect-error — drizzle 自引用表（parentItemId references settingItems.id）导致 TS 循环类型推断，这是 drizzle-orm 的已知限制
export const settingItems = pgTable(
  "setting_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id),
    proposalId: uuid("proposal_id").references(() => aiProposals.id),
    type: text("type").notNull(),
    name: text("name").notNull(),
    summary: text("summary").notNull(),
    content: jsonb("content").notNull(),
    status: text("status", { enum: ["draft", "confirmed", "archived"] }).notNull().default("draft"),
    tags: text("tags").array(),
    // Multi-item world engine: hierarchy + provenance
    // parentItemId 自引用 settingItems 导致 TS 循环类型推断，这是 drizzle-orm 的已知限制
    // @ts-expect-error — drizzle 自引用表循环类型
    parentItemId: uuid("parent_item_id").references(() => settingItems.id),
    engineSource: text("engine_source"),
    itemSubtype: text("item_subtype"),
    /** 此条目状态从哪个章节开始生效（用于追踪世界状态随章节推进的演化） */
    validAtChapter: integer("valid_at_chapter"),
    /** 此条目在哪个章节之后不再生效（null=至今仍有效） */
    supersededAtChapter: integer("superseded_at_chapter"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    projectTypeIdx: index("setting_items_project_type_idx").on(table.projectId, table.type),
    projectStatusIdx: index("setting_items_project_status_idx").on(table.projectId, table.status),
    proposalIdIdx: index("setting_items_proposal_id_idx").on(table.proposalId),
    parentItemIdx: index("setting_items_parent_item_idx").on(table.parentItemId),
    engineSourceIdx: index("setting_items_engine_source_idx").on(table.projectId, table.engineSource),
    statusCheck: check("setting_items_status_check", inCheck(table.status, SETTING_STATUS_VALUES)),
  })
);

// 世界引擎：Item 间关联（跨引擎引用 + 层级关系）
export const settingItemRelations = pgTable(
  "setting_item_relations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id),
    sourceItemId: uuid("source_item_id").notNull().references(() => settingItems.id),
    targetItemId: uuid("target_item_id").notNull().references(() => settingItems.id),
    relationType: text("relation_type", {
      enum: ["hierarchy", "reference", "opposition", "dependency", "geographic", "affiliation", "adjacency", "functional"],
    }).notNull(),
    label: text("label"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    projectIdx: index("setting_item_relations_project_idx").on(table.projectId),
    sourceIdx: index("setting_item_relations_source_idx").on(table.sourceItemId),
    targetIdx: index("setting_item_relations_target_idx").on(table.targetItemId),
    relationTypeCheck: check("setting_item_relations_type_check", inCheck(table.relationType, RELATION_TYPE_VALUES)),
  })
);

export const llmLogs = pgTable(
  "llm_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").references(() => projects.id),
    sessionId: uuid("session_id").references(() => sessions.id),
    caller: text("caller").notNull(),
    callerRefId: uuid("caller_ref_id"),
    callerRefType: text("caller_ref_type"),
    model: text("model").notNull(),
    promptTokens: integer("prompt_tokens"),
    completionTokens: integer("completion_tokens"),
    totalTokens: integer("total_tokens"),
    promptCacheHitTokens: integer("prompt_cache_hit_tokens"),
    promptCacheMissTokens: integer("prompt_cache_miss_tokens"),
    costUsd: text("cost_usd"),
    latencyMs: integer("latency_ms"),
    status: text("status", { enum: ["success", "error", "timeout"] }).notNull(),
    errorMessage: text("error_message"),
    promptSnapshot: jsonb("prompt_snapshot"),
    responseSnapshot: jsonb("response_snapshot"),
    storageRef: text("storage_ref"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    projectCreatedIdx: index("llm_logs_project_created_idx").on(table.projectId, table.createdAt),
    statusCheck: check("llm_logs_status_check", inCheck(table.status, LLM_LOG_STATUS_VALUES)),
  })
);

// ============================================================================
// Phase 1 新增表：MOU 状态机 + 项目级配置锁定
// ============================================================================

export const mouStates = pgTable(
  "mou_states",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id),
    proposalId: uuid("proposal_id").notNull().references(() => aiProposals.id),
    status: text("status", { enum: ["pending", "approved", "rejected", "superseded", "revision_requested", "executing"] }).notNull().default("pending"),
    authorDecision: text("author_decision"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    executedAt: timestamp("executed_at", { withTimezone: true }),
    rejectionNote: text("rejection_note"),
    executionResult: jsonb("execution_result"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    projectStatusIdx: index("mou_states_project_status_idx").on(table.projectId, table.status),
    proposalIdIdx: index("mou_states_proposal_id_idx").on(table.proposalId),
    statusCheck: check("mou_states_status_check", inCheck(table.status, [...MOU_STATUS_VALUES, "executing"])),
  })
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id),
    priority: text("priority", { enum: ["p0", "p1", "p2", "p3", "p4"] }).notNull().default("p2"),
    category: text("category", { enum: ["conflict", "proposal", "system", "retcon", "preview", "setting"] }).notNull().default("system"),
    title: text("title").notNull(),
    body: text("body").notNull(),
    sourceNode: text("source_node"),
    relatedEntityType: text("related_entity_type", { enum: ["proposal", "setting", "chapter", "session", "project"] }),
    relatedEntityId: uuid("related_entity_id"),
    status: text("status", { enum: ["unread", "read", "dismissed", "acted"] }).notNull().default("unread"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    projectStatusIdx: index("notifications_project_status_idx").on(table.projectId, table.status),
    priorityCheck: check("notifications_priority_check", inCheck(table.priority, NOTIFICATION_PRIORITY_VALUES)),
    categoryCheck: check("notifications_category_check", inCheck(table.category, NOTIFICATION_CATEGORY_VALUES)),
    statusCheck: check("notifications_status_check", inCheck(table.status, NOTIFICATION_STATUS_VALUES)),
  })
);

export const notificationReads = pgTable(
  "notification_reads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    notificationId: uuid("notification_id").notNull().references(() => notifications.id),
    action: text("action", { enum: ["read", "dismissed", "acted"] }).notNull(),
    actor: text("actor").notNull().default("author"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    notificationIdIdx: index("notification_reads_notification_id_idx").on(table.notificationId),
    actionCheck: check("notification_reads_action_check", inCheck(table.action, NOTIFICATION_READ_ACTION_VALUES)),
  })
);

export const projectSettings = pgTable(
  "project_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id).unique(),
    worldBible: jsonb("world_bible"),
    genreContract: jsonb("genre_contract"),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    hatchSummary: jsonb("hatch_summary"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  }
);

// ============================================================================
// Phase 2 大纲流水线（3 张表 + outline_items）
// ============================================================================

export const outlines = pgTable(
  "outlines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id),
    title: text("title").notNull(),
    summary: text("summary"),
    content: jsonb("content").notNull(),
    status: text("status", { enum: ["draft", "confirmed", "archived"] }).notNull().default("draft"),
    proposalId: uuid("proposal_id").references(() => aiProposals.id),
    version: integer("version").notNull().default(1),

    // ── 扩展字段 ──
    outlineMode: text("outline_mode").default("rough"),
    structureMode: text("structure_mode"),
    targetTotalWords: integer("target_total_words"),
    targetChapterCount: integer("target_chapter_count"),
    targetVolumeCount: integer("target_volume_count"),
    narrativePace: text("narrative_pace").default("medium"),
    contentFocus: jsonb("content_focus"),
    customRequirements: text("custom_requirements"),
    generationModelId: text("generation_model_id"),
    isCurrent: boolean("is_current").default(false),
    previousOutlineId: uuid("previous_outline_id"),
    sourceProposalId: uuid("source_proposal_id"),
    totalOutlineItems: integer("total_outline_items").default(0),
    totalPlannedWords: integer("total_planned_words").default(0),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    deprecatedAt: timestamp("deprecated_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    projectIdIdx: index("outlines_project_id_idx").on(table.projectId),
    projectStatusIdx: index("outlines_project_status_idx").on(table.projectId, table.status),
    statusCheck: check("outlines_status_check", inCheck(table.status, OUTLINE_STATUS_VALUES)),
    outlineModeCheck: check("outlines_mode_check", inCheck(table.outlineMode, OUTLINE_MODE_VALUES)),
    structureModeCheck: check("outlines_structure_mode_check", inCheck(table.structureMode, [...STRUCTURE_MODE_VALUES, ""])),
    narrativePaceCheck: check("outlines_pace_check", inCheck(table.narrativePace, PACE_VALUES)),
  })
);

export const volumes = pgTable(
  "volumes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id),
    volumeNumber: integer("volume_number").notNull(),
    title: text("title").notNull(),
    summary: text("summary"),
    outline: jsonb("outline"),
    status: text("status", { enum: ["draft", "confirmed", "archived"] }).notNull().default("draft"),
    proposalId: uuid("proposal_id").references(() => aiProposals.id),
    wordCountTarget: integer("word_count_target"),

    // ── 扩展字段 ──
    subtitle: text("subtitle"),
    description: text("description"),
    plannedStartChapter: integer("planned_start_chapter"),
    plannedEndChapter: integer("planned_end_chapter"),
    plannedChapterCount: integer("planned_chapter_count"),
    targetWords: integer("target_words"),
    targetArc: text("target_arc"),
    structureMode: text("structure_mode"),
    structureActs: jsonb("structure_acts"),
    totalChapters: integer("total_chapters").notNull().default(0),
    totalWords: integer("total_words").notNull().default(0),
    completedChapters: integer("completed_chapters").notNull().default(0),
    frozenChapters: integer("frozen_chapters").notNull().default(0),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    projectVolumeIdx: index("volumes_project_volume_idx").on(table.projectId, table.volumeNumber),
    projectStatusIdx: index("volumes_project_status_idx").on(table.projectId, table.status),
    statusCheck: check("volumes_status_check", inCheck(table.status, VOLUME_STATUS_VALUES)),
    structureModeCheck: check("volumes_structure_mode_check", inCheck(table.structureMode, [...STRUCTURE_MODE_VALUES, ""])),
  })
);

export const chapters = pgTable(
  "chapters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id),
    volumeId: uuid("volume_id").references(() => volumes.id),
    chapterNumber: integer("chapter_number").notNull(),
    title: text("title").notNull(),
    summary: text("summary"),
    outline: jsonb("outline"),
    status: text("status", { enum: ["draft", "confirmed", "archived"] }).notNull().default("draft"),
    proposalId: uuid("proposal_id").references(() => aiProposals.id),
    wordCountTarget: integer("word_count_target"),

    // ── 扩展字段 ──
    volumeChapterNumber: integer("volume_chapter_number"),
    subtitle: text("subtitle"),
    contentPath: text("content_path"),
    contentSummary: text("content_summary"),
    actualWords: integer("actual_words").notNull().default(0),
    aiGeneratedWords: integer("ai_generated_words").default(0),
    humanWrittenWords: integer("human_written_words").default(0),
    emotionOverall: text("emotion_overall"),
    emotionPoints: jsonb("emotion_points"),
    appearingCharacters: jsonb("appearing_characters"),
    appearingItems: jsonb("appearing_items"),
    appearingLocations: jsonb("appearing_locations"),
    appearingTechniques: jsonb("appearing_techniques"),
    plantedForeshadowings: jsonb("planted_foreshadowings"),
    resolvedForeshadowings: jsonb("resolved_foreshadowings"),
    referencedForeshadowings: jsonb("referenced_foreshadowings"),
    writingStyle: text("writing_style"),
    contentFocus: jsonb("content_focus"),
    customRules: jsonb("custom_rules"),
    generationJobId: text("generation_job_id"),
    lastAiAction: text("last_ai_action").default("none"),
    lastAiModelId: text("last_ai_model_id"),
    chapterVersion: integer("chapter_version").notNull().default(1),
    previousVersionId: uuid("previous_version_id"),
    isLatestVersion: boolean("is_latest_version").default(true),
    firstWrittenAt: timestamp("first_written_at", { withTimezone: true }),
    frozenAt: timestamp("frozen_at", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),

    // ── 章节世界快照（写作引擎使用冻结数据） ──
    worldSnapshot: jsonb("world_snapshot"),
    snapshotTakenAt: timestamp("snapshot_taken_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    volumeChapterIdx: index("chapters_volume_chapter_idx").on(table.volumeId, table.chapterNumber),
    projectIdIdx: index("chapters_project_id_idx").on(table.projectId),
    statusCheck: check("chapters_status_check", inCheck(table.status, CHAPTER_STATUS_VALUES)),
    emotionOverallCheck: check("chapters_emotion_check", inCheck(table.emotionOverall, [...EMOTION_TYPE_VALUES, ""])),
    writingStyleCheck: check("chapters_writing_style_check", inCheck(table.writingStyle, [...WRITING_STYLE_VALUES, ""])),
    lastAiActionCheck: check("chapters_ai_action_check", inCheck(table.lastAiAction, AI_ACTION_VALUES)),
  })
);

// ============================================================================
// Phase 2 新增：outline_items（大纲条目表）
// ============================================================================

export const outlineItems = pgTable(
  "outline_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    outlineId: uuid("outline_id").notNull().references(() => outlines.id),

    // 位置信息
    volumeNumber: integer("volume_number").notNull().default(1),
    chapterNumber: integer("chapter_number").notNull(),
    volumeChapterNumber: integer("volume_chapter_number"),

    // 标题与摘要
    title: text("title").notNull(),
    roughSummary: text("rough_summary"),

    // 详细情节（细纲模式）
    detailedPlot: text("detailed_plot"),
    plotPoints: jsonb("plot_points"),

    // 情绪与节奏
    emotionOverall: text("emotion_overall"),
    emotionPoints: jsonb("emotion_points"),
    narrativePace: text("narrative_pace").default("medium"),

    // 出场与关联
    keyCharacters: jsonb("key_characters"),
    keyLocations: jsonb("key_locations"),
    keyItems: jsonb("key_items"),
    keyEvents: jsonb("key_events"),

    // 伏笔规划
    toPlantForeshadowings: jsonb("to_plant_foreshadowings"),
    toResolveForeshadowings: jsonb("to_resolve_foreshadowings"),
    toReferenceForeshadowings: jsonb("to_reference_foreshadowings"),

    // 字数规划
    targetWords: integer("target_words").default(3000),
    minWords: integer("min_words").default(2000),
    maxWords: integer("max_words").default(5000),

    // 执行状态（大纲 → 章节的映射）
    linkedChapterId: uuid("linked_chapter_id").references(() => chapters.id),
    executionStatus: text("execution_status").default("pending"),

    // 作者备注与AI建议
    authorNotes: text("author_notes"),
    aiSuggestions: jsonb("ai_suggestions"),

    // 排序
    sortOrder: integer("sort_order").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    outlineIdx: index("outline_items_outline_idx").on(table.outlineId),
    outlineChapterIdx: index("outline_items_chapter_idx").on(table.outlineId, table.chapterNumber),
    linkedIdx: index("outline_items_linked_idx").on(table.linkedChapterId),
    executionStatusCheck: check("outline_items_execution_status_check", inCheck(table.executionStatus, EXECUTION_STATUS_VALUES)),
    emotionOverallCheck: check("outline_items_emotion_check", inCheck(table.emotionOverall, [...EMOTION_TYPE_VALUES, ""])),
    narrativePaceCheck: check("outline_items_pace_check", inCheck(table.narrativePace, PACE_VALUES)),
  })
);

// ============================================================================
// Phase 1 新增：project_daily_stats（项目每日统计）
// ============================================================================

export const projectDailyStats = pgTable(
  "project_daily_stats",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id),
    date: text("date").notNull(), // YYYY-MM-DD

    // 写作数据
    wordsAdded: integer("words_added").default(0),
    chaptersAdded: integer("chapters_added").default(0),
    wordsDeleted: integer("words_deleted").default(0),
    wordsEdited: integer("words_edited").default(0),

    // 时间数据
    writingMinutes: integer("writing_minutes").default(0),

    // AI互动数据
    aiCalls: integer("ai_calls").default(0),
    proposalsGenerated: integer("proposals_generated").default(0),
    proposalsApproved: integer("proposals_approved").default(0),
    proposalsRejected: integer("proposals_rejected").default(0),
    proposalsModified: integer("proposals_modified").default(0),

    // 状态快照（日终记录）
    totalWordsAtEod: integer("total_words_at_eod"),
    totalChaptersAtEod: integer("total_chapters_at_eod"),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    projectDateIdx: index("project_daily_stats_project_date_idx").on(table.projectId, table.date),
    dateIdx: index("project_daily_stats_date_idx").on(table.date),
    uniqueProjectDate: index("project_daily_stats_unique_idx").on(table.projectId, table.date),
  })
);

// ============================================================================
// 项目尺度体系 —— 动态地理尺度链，替代硬编码的 SCALE_CHAIN
// ============================================================================
export const projectScales = pgTable(
  "project_scales",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id),
    // 关联到顶层世界/空间域的 setting_item_id，null 表示全局默认尺度链
    worldItemId: uuid("world_item_id").references(() => settingItems.id),
    key: text("key").notNull(),              // 尺度标识符 (e.g. "spirit_realm", "continent")
    label: text("label").notNull(),           // 中文标签 (e.g. "灵界", "大陆")
    parentKey: text("parent_key"),            // 父级尺度的 key，顶级为 null
    sortOrder: integer("sort_order").notNull().default(0),  // 同级排序
    description: text("description"),         // 尺度描述
    isEditable: boolean("is_editable").notNull().default(true),  // 用户是否可编辑
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    projectKeyIdx: index("project_scales_project_key_idx").on(table.projectId, table.key),
    projectParentIdx: index("project_scales_parent_idx").on(table.projectId, table.parentKey),
    worldItemIdx: index("project_scales_world_item_idx").on(table.worldItemId),
  })
);

// ============================================================================
// 章节设定引用追踪 —— 记录每章精确引用了哪些设定条目（通过ID关联）
// ============================================================================
export const chapterSettingReferences = pgTable(
  "chapter_setting_references",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    chapterId: uuid("chapter_id").notNull().references(() => chapters.id),
    settingItemId: uuid("setting_item_id").notNull().references(() => settingItems.id),
    referenceType: text("reference_type", { enum: ["direct", "mentioned", "background"] })
      .notNull()
      .default("direct"),
    contextQuote: text("context_quote"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    chapterIdx: index("csr_chapter_idx").on(table.chapterId),
    settingIdx: index("csr_setting_idx").on(table.settingItemId),
    uniqueRef: index("csr_unique_idx").on(table.chapterId, table.settingItemId),
  })
);

// ============================================================================
// 向量嵌入表 —— 语义检索（按 project_id 分区，Drizzle 做基础 ORM 映射）
// 注意：pgvector 的 vector 类型和分区机制通过 raw SQL 管理，
//       此处仅做类型定义以支持 Drizzle 查询和关系映射。
// ============================================================================
export const embeddings = pgTable(
  "embeddings",
  {
    embeddingId: uuid("embedding_id").notNull().defaultRandom(),
    projectId: uuid("project_id").notNull(),
    sourceType: text("source_type").notNull(),
    sourceId: uuid("source_id").notNull(),
    chunkIndex: integer("chunk_index").notNull().default(0),
    chunkText: text("chunk_text").notNull(),
    chunkLength: integer("chunk_length").notNull().default(0),
    embedding: text("embedding"), // pgvector vector 类型，Drizzle 不支持，存为文本在应用层处理
    metaJsonb: jsonb("meta_jsonb").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    projectSourceIdx: index("embeddings_project_source_idx").on(table.projectId, table.sourceType, table.sourceId),
    projectChunkIdx: index("embeddings_project_chunk_idx").on(table.projectId, table.chunkIndex),
  })
);

// ============================================================================
// 设定条目版本历史 —— 记录每条设定的完整变更历史
// ============================================================================
export const settingItemVersions = pgTable(
  "setting_item_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    settingItemId: uuid("setting_item_id").notNull().references(() => settingItems.id),
    version: integer("version").notNull(),
    content: jsonb("content").notNull(),
    changedBy: text("changed_by"),
    changeReason: text("change_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    itemIdx: index("siv_item_idx").on(table.settingItemId, table.version),
  })
);
