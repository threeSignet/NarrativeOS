import { Pool } from "pg";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    console.log("[migrate] Starting schema migration...");

    // ── 1. projects 表扩展 ──
    console.log("[migrate] Altering projects table...");
    const projectsCols = [
      `subtitle text`,
      `author_pen_name text`,
      `author_real_name text`,
      `author_id_card text`,
      `author_qq text`,
      `author_phone text`,
      `author_email text`,
      `novel_type text`,
      `novel_sub_type text`,
      `core_concept text`,
      `synopsis text`,
      `tags jsonb`,
      `target_audience text`,
      `platform_name text`,
      `platform_book_id text`,
      `platform_book_url text`,
      `platform_nickname text`,
      `platform_status text DEFAULT 'inactive'`,
      `platform_account text`,
      `platform_password_encrypted text`,
      `platform_password_iv text`,
      `auto_sync boolean DEFAULT false`,
      `sync_mode text DEFAULT 'manual'`,
      `last_synced_chapter_id uuid`,
      `last_synced_at timestamp with time zone`,
      `target_total_words integer`,
      `target_chapter_count integer`,
      `target_daily_words integer DEFAULT 2000`,
      `target_chapter_words integer DEFAULT 3000`,
      `expected_end_date timestamp with time zone`,
      `target_volume_count integer`,
      `words_per_volume integer`,
      `default_model_id text`,
      `default_writing_style text`,
      `default_pace text DEFAULT 'medium'`,
      `default_content_focus jsonb`,
      `custom_rules jsonb`,
      `version integer NOT NULL DEFAULT 1`,
      `total_words integer NOT NULL DEFAULT 0`,
      `total_chapters integer NOT NULL DEFAULT 0`,
      `total_volumes integer NOT NULL DEFAULT 0`,
      `latest_chapter_number integer DEFAULT 0`,
      `latest_chapter_id uuid`,
      `latest_volume_id uuid`,
      `words_today integer DEFAULT 0`,
      `words_this_week integer DEFAULT 0`,
      `words_this_month integer DEFAULT 0`,
      `words_trend jsonb`,
      `streak_days integer DEFAULT 0`,
      `max_streak_days integer DEFAULT 0`,
      `last_writing_date timestamp with time zone`,
      `total_writing_hours text DEFAULT '0'`,
      `cover_image text`,
      `outline_file text`,
      `manuscript_path text`,
      `created_by text`,
      `is_deleted boolean NOT NULL DEFAULT false`,
      `deleted_reason text`,
      `first_published_at timestamp with time zone`,
      `last_published_at timestamp with time zone`,
      `completed_at timestamp with time zone`,
      `archived_at timestamp with time zone`,
    ];
    for (const col of projectsCols) {
      const colName = col.split(" ")[0];
      try {
        await client.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS ${col}`);
      } catch (e: any) {
        if (!e.message.includes("already exists")) throw e;
        console.log(`  - ${colName} already exists, skipping`);
      }
    }

    // ── 2. chapters 表扩展 ──
    console.log("[migrate] Altering chapters table...");
    await client.query(`ALTER TABLE chapters ALTER COLUMN volume_id DROP NOT NULL`);
    const chaptersCols = [
      `volume_chapter_number integer`,
      `subtitle text`,
      `content_path text`,
      `content_summary text`,
      `actual_words integer NOT NULL DEFAULT 0`,
      `ai_generated_words integer DEFAULT 0`,
      `human_written_words integer DEFAULT 0`,
      `emotion_overall text`,
      `emotion_points jsonb`,
      `appearing_characters jsonb`,
      `appearing_items jsonb`,
      `appearing_locations jsonb`,
      `appearing_techniques jsonb`,
      `planted_foreshadowings jsonb`,
      `resolved_foreshadowings jsonb`,
      `referenced_foreshadowings jsonb`,
      `writing_style text`,
      `content_focus jsonb`,
      `custom_rules jsonb`,
      `generation_job_id text`,
      `last_ai_action text DEFAULT 'none'`,
      `last_ai_model_id text`,
      `chapter_version integer NOT NULL DEFAULT 1`,
      `previous_version_id uuid`,
      `is_latest_version boolean DEFAULT true`,
      `first_written_at timestamp with time zone`,
      `frozen_at timestamp with time zone`,
      `published_at timestamp with time zone`,
      `world_snapshot jsonb`,
      `snapshot_taken_at timestamp with time zone`,
    ];
    for (const col of chaptersCols) {
      const colName = col.split(" ")[0];
      try {
        await client.query(`ALTER TABLE chapters ADD COLUMN IF NOT EXISTS ${col}`);
      } catch (e: any) {
        if (!e.message.includes("already exists")) throw e;
        console.log(`  - ${colName} already exists, skipping`);
      }
    }

    // ── 3. volumes 表扩展 ──
    console.log("[migrate] Altering volumes table...");
    const volumesCols = [
      `subtitle text`,
      `description text`,
      `planned_start_chapter integer`,
      `planned_end_chapter integer`,
      `planned_chapter_count integer`,
      `target_words integer`,
      `target_arc text`,
      `structure_mode text`,
      `structure_acts jsonb`,
      `total_chapters integer NOT NULL DEFAULT 0`,
      `total_words integer NOT NULL DEFAULT 0`,
      `completed_chapters integer NOT NULL DEFAULT 0`,
      `frozen_chapters integer NOT NULL DEFAULT 0`,
      `started_at timestamp with time zone`,
      `completed_at timestamp with time zone`,
    ];
    for (const col of volumesCols) {
      const colName = col.split(" ")[0];
      try {
        await client.query(`ALTER TABLE volumes ADD COLUMN IF NOT EXISTS ${col}`);
      } catch (e: any) {
        if (!e.message.includes("already exists")) throw e;
        console.log(`  - ${colName} already exists, skipping`);
      }
    }

    // ── 4. outlines 表扩展 ──
    console.log("[migrate] Altering outlines table...");
    const outlinesCols = [
      `outline_mode text DEFAULT 'rough'`,
      `structure_mode text`,
      `target_total_words integer`,
      `target_chapter_count integer`,
      `target_volume_count integer`,
      `narrative_pace text DEFAULT 'medium'`,
      `content_focus jsonb`,
      `custom_requirements text`,
      `generation_model_id text`,
      `is_current boolean DEFAULT false`,
      `previous_outline_id uuid`,
      `source_proposal_id uuid`,
      `total_outline_items integer DEFAULT 0`,
      `total_planned_words integer DEFAULT 0`,
      `approved_at timestamp with time zone`,
      `deprecated_at timestamp with time zone`,
    ];
    for (const col of outlinesCols) {
      const colName = col.split(" ")[0];
      try {
        await client.query(`ALTER TABLE outlines ADD COLUMN IF NOT EXISTS ${col}`);
      } catch (e: any) {
        if (!e.message.includes("already exists")) throw e;
        console.log(`  - ${colName} already exists, skipping`);
      }
    }

    // ── 5. 确保 setting_item_relations 表存在 ──
    console.log("[migrate] Creating setting_item_relations table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS setting_item_relations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id uuid NOT NULL REFERENCES projects(id),
        source_item_id uuid NOT NULL REFERENCES setting_items(id),
        target_item_id uuid NOT NULL REFERENCES setting_items(id),
        relation_type text NOT NULL,
        label text,
        metadata jsonb,
        created_at timestamp with time zone DEFAULT NOW() NOT NULL
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS setting_item_relations_project_idx ON setting_item_relations(project_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS setting_item_relations_source_idx ON setting_item_relations(source_item_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS setting_item_relations_target_idx ON setting_item_relations(target_item_id)`);

    // ── 5b. setting_items 扩展：层级导航 + 引擎来源 + 子类型 ──
    console.log("[migrate] Altering setting_items table...");
    const settingItemCols = [
      `parent_item_id uuid REFERENCES setting_items(id)`,
      `engine_source text`,
      `item_subtype text`,
    ];
    for (const col of settingItemCols) {
      const colName = col.split(" ")[0];
      try {
        await client.query(`ALTER TABLE setting_items ADD COLUMN IF NOT EXISTS ${col}`);
      } catch (e: any) {
        if (!e.message.includes("already exists")) throw e;
        console.log(`  - ${colName} already exists, skipping`);
      }
    }
    await client.query(`CREATE INDEX IF NOT EXISTS setting_items_parent_item_idx ON setting_items(parent_item_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS setting_items_engine_source_idx ON setting_items(project_id, engine_source)`);

    // ── 6. ai_proposals: 确保 revision_notes 存在 ──
    console.log("[migrate] Altering ai_proposals table...");
    try {
      await client.query(`ALTER TABLE ai_proposals ADD COLUMN IF NOT EXISTS revision_notes text`);
    } catch (e: any) {
      if (!e.message.includes("already exists")) throw e;
    }

    // ── 7. 新建 outline_items 表 ──
    console.log("[migrate] Creating outline_items table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS outline_items (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        outline_id uuid NOT NULL REFERENCES outlines(id) ON DELETE CASCADE,
        volume_number integer NOT NULL DEFAULT 1,
        chapter_number integer NOT NULL,
        volume_chapter_number integer,
        title text NOT NULL,
        rough_summary text,
        detailed_plot text,
        plot_points jsonb,
        emotion_overall text,
        emotion_points jsonb,
        narrative_pace text DEFAULT 'medium',
        key_characters jsonb,
        key_locations jsonb,
        key_items jsonb,
        key_events jsonb,
        to_plant_foreshadowings jsonb,
        to_resolve_foreshadowings jsonb,
        to_reference_foreshadowings jsonb,
        target_words integer DEFAULT 3000,
        min_words integer DEFAULT 2000,
        max_words integer DEFAULT 5000,
        linked_chapter_id uuid REFERENCES chapters(id),
        execution_status text DEFAULT 'pending',
        author_notes text,
        ai_suggestions jsonb,
        sort_order integer NOT NULL,
        created_at timestamp with time zone DEFAULT NOW() NOT NULL,
        updated_at timestamp with time zone DEFAULT NOW() NOT NULL
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS outline_items_outline_idx ON outline_items(outline_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS outline_items_chapter_idx ON outline_items(outline_id, chapter_number)`);
    await client.query(`CREATE INDEX IF NOT EXISTS outline_items_linked_idx ON outline_items(linked_chapter_id)`);

    // ── 8. 新建 project_daily_stats 表 ──
    console.log("[migrate] Creating project_daily_stats table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_daily_stats (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id uuid NOT NULL REFERENCES projects(id),
        date text NOT NULL,
        words_added integer DEFAULT 0,
        chapters_added integer DEFAULT 0,
        words_deleted integer DEFAULT 0,
        words_edited integer DEFAULT 0,
        writing_minutes integer DEFAULT 0,
        ai_calls integer DEFAULT 0,
        proposals_generated integer DEFAULT 0,
        proposals_approved integer DEFAULT 0,
        proposals_rejected integer DEFAULT 0,
        proposals_modified integer DEFAULT 0,
        total_words_at_eod integer,
        total_chapters_at_eod integer,
        created_at timestamp with time zone DEFAULT NOW() NOT NULL,
        updated_at timestamp with time zone DEFAULT NOW() NOT NULL
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS project_daily_stats_project_date_idx ON project_daily_stats(project_id, date)`);
    await client.query(`CREATE INDEX IF NOT EXISTS project_daily_stats_date_idx ON project_daily_stats(date)`);

    // ── 8b. 新建 project_scales 表（动态地理尺度体系） ──
    console.log("[migrate] Creating project_scales table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_scales (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id uuid NOT NULL REFERENCES projects(id),
        key text NOT NULL,
        label text NOT NULL,
        parent_key text,
        sort_order integer NOT NULL DEFAULT 0,
        description text,
        is_editable boolean NOT NULL DEFAULT true,
        created_at timestamp with time zone DEFAULT NOW() NOT NULL
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS project_scales_project_key_idx ON project_scales(project_id, key)`);
    await client.query(`CREATE INDEX IF NOT EXISTS project_scales_parent_idx ON project_scales(project_id, parent_key)`);

    // ── 9. 添加 CHECK 约束 ──
    console.log("[migrate] Adding CHECK constraints...");

    // projects status
    await client.query(`
      ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_status_check;
      ALTER TABLE projects ADD CONSTRAINT projects_status_check
        CHECK (status IN ('hatching', 'active', 'archived', 'draft', 'worldbuilding', 'outlining', 'writing', 'paused', 'completed', 'revision', 'published'))
    `);

    // chapters status
    await client.query(`
      ALTER TABLE chapters DROP CONSTRAINT IF EXISTS chapters_status_check;
      ALTER TABLE chapters ADD CONSTRAINT chapters_status_check
        CHECK (status IN ('draft', 'confirmed', 'archived', 'reviewing', 'pending_proposal', 'frozen', 'published', 'retcon_pending', 'retcon_reviewing'))
    `);

    // volumes status
    await client.query(`
      ALTER TABLE volumes DROP CONSTRAINT IF EXISTS volumes_status_check;
      ALTER TABLE volumes ADD CONSTRAINT volumes_status_check
        CHECK (status IN ('draft', 'confirmed', 'archived', 'planned', 'writing', 'completed', 'revision', 'published'))
    `);

    // outlines status
    await client.query(`
      ALTER TABLE outlines DROP CONSTRAINT IF EXISTS outlines_status_check;
      ALTER TABLE outlines ADD CONSTRAINT outlines_status_check
        CHECK (status IN ('draft', 'confirmed', 'archived', 'approved', 'deprecated', 'rejected'))
    `);

    // setting_items status
    await client.query(`
      ALTER TABLE setting_items DROP CONSTRAINT IF EXISTS setting_items_status_check;
      ALTER TABLE setting_items ADD CONSTRAINT setting_items_status_check
        CHECK (status IN ('draft', 'confirmed', 'archived'))
    `);

    // ai_proposals status
    await client.query(`
      ALTER TABLE ai_proposals DROP CONSTRAINT IF EXISTS ai_proposals_status_check;
      ALTER TABLE ai_proposals ADD CONSTRAINT ai_proposals_status_check
        CHECK (status IN ('pending', 'approved', 'rejected', 'superseded', 'revision_requested', 'executing'))
    `);

    // mou_states status
    await client.query(`
      ALTER TABLE mou_states DROP CONSTRAINT IF EXISTS mou_states_status_check;
      ALTER TABLE mou_states ADD CONSTRAINT mou_states_status_check
        CHECK (status IN ('pending', 'approved', 'rejected', 'superseded', 'revision_requested', 'executing'))
    `);

    // notifications status
    await client.query(`
      ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_status_check;
      ALTER TABLE notifications ADD CONSTRAINT notifications_status_check
        CHECK (status IN ('unread', 'read', 'dismissed', 'acted'))
    `);

    // llm_logs status
    await client.query(`
      ALTER TABLE llm_logs DROP CONSTRAINT IF EXISTS llm_logs_status_check;
      ALTER TABLE llm_logs ADD CONSTRAINT llm_logs_status_check
        CHECK (status IN ('success', 'error', 'timeout'))
    `);

    // discussions role
    await client.query(`
      ALTER TABLE discussions DROP CONSTRAINT IF EXISTS discussions_role_check;
      ALTER TABLE discussions ADD CONSTRAINT discussions_role_check
        CHECK (role IN ('user', 'assistant'))
    `);

    // notification_reads action
    await client.query(`
      ALTER TABLE notification_reads DROP CONSTRAINT IF EXISTS notification_reads_action_check;
      ALTER TABLE notification_reads ADD CONSTRAINT notification_reads_action_check
        CHECK (action IN ('read', 'dismissed', 'acted'))
    `);

    // setting_item_relations relation_type
    await client.query(`
      ALTER TABLE setting_item_relations DROP CONSTRAINT IF EXISTS setting_item_relations_type_check;
      ALTER TABLE setting_item_relations ADD CONSTRAINT setting_item_relations_type_check
        CHECK (relation_type IN ('hierarchy', 'reference', 'opposition', 'dependency', 'geographic', 'affiliation', 'adjacency', 'functional'))
    `);

    // outline_items execution_status
    await client.query(`
      ALTER TABLE outline_items DROP CONSTRAINT IF EXISTS outline_items_execution_status_check;
      ALTER TABLE outline_items ADD CONSTRAINT outline_items_execution_status_check
        CHECK (execution_status IN ('pending', 'linked', 'deviated', 'completed'))
    `);

    // ── 10. 添加索引 ──
    console.log("[migrate] Adding indexes...");
    await client.query(`CREATE INDEX IF NOT EXISTS projects_status_idx ON projects(status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS projects_novel_type_idx ON projects(novel_type)`);
    await client.query(`CREATE INDEX IF NOT EXISTS projects_platform_idx ON projects(platform_name)`);
    await client.query(`CREATE INDEX IF NOT EXISTS projects_created_at_idx ON projects(created_at)`);
    await client.query(`CREATE INDEX IF NOT EXISTS projects_updated_at_idx ON projects(updated_at)`);
    await client.query(`CREATE INDEX IF NOT EXISTS chapters_status_idx ON chapters(status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS volumes_status_idx ON volumes(status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS outlines_status_idx ON outlines(status)`);

    // ── 11. 更新 project_settings unique 约束 ──
    console.log("[migrate] Updating project_settings constraints...");
    // 先删除重复数据（保留最新）
    await client.query(`
      DELETE FROM project_settings a USING project_settings b
      WHERE a.id < b.id AND a.project_id = b.project_id
    `);
    await client.query(`
      ALTER TABLE project_settings DROP CONSTRAINT IF EXISTS project_settings_project_id_unique;
      ALTER TABLE project_settings ADD CONSTRAINT project_settings_project_id_unique UNIQUE (project_id)
    `);

    await client.query("COMMIT");
    console.log("[migrate] Migration completed successfully!");
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[migrate] Migration failed:", err.message);
    throw err;
  } finally {
    client.release();
  }
}

migrate()
  .then(() => {
    pool.end();
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    pool.end();
    process.exit(1);
  });
