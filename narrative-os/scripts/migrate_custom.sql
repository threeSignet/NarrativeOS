-- ============================================================================
-- migrate.ts 的自定义迁移逻辑（SQL 直译版）
-- 用于手动执行，绕过 Node.js 环境变量传递问题
-- ============================================================================

BEGIN;

-- ── 1. projects 表扩展字段 ──
ALTER TABLE projects ADD COLUMN IF NOT EXISTS subtitle text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS author_pen_name text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS author_real_name text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS author_id_card text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS author_qq text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS author_phone text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS author_email text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS novel_type text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS novel_sub_type text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS core_concept text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS synopsis text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS tags jsonb;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS target_audience text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS platform_name text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS platform_book_id text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS platform_book_url text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS platform_nickname text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS platform_status text DEFAULT 'inactive';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS platform_account text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS platform_password_encrypted text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS platform_password_iv text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS auto_sync boolean DEFAULT false;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS sync_mode text DEFAULT 'manual';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS last_synced_chapter_id uuid;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS last_synced_at timestamp with time zone;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS target_total_words integer;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS target_chapter_count integer;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS target_daily_words integer DEFAULT 2000;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS target_chapter_words integer DEFAULT 3000;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS expected_end_date timestamp with time zone;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS target_volume_count integer;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS words_per_volume integer;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS default_model_id text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS default_writing_style text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS default_pace text DEFAULT 'medium';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS default_content_focus jsonb;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS custom_rules jsonb;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS total_words integer NOT NULL DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS total_chapters integer NOT NULL DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS total_volumes integer NOT NULL DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS latest_chapter_number integer DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS latest_chapter_id uuid;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS latest_volume_id uuid;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS words_today integer DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS words_this_week integer DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS words_this_month integer DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS words_trend jsonb;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS streak_days integer DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS max_streak_days integer DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS last_writing_date timestamp with time zone;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS total_writing_hours text DEFAULT '0';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS cover_image text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS outline_file text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS manuscript_path text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS created_by text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS deleted_reason text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS first_published_at timestamp with time zone;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS last_published_at timestamp with time zone;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS completed_at timestamp with time zone;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS archived_at timestamp with time zone;

-- ── 2. chapters 表 ──
ALTER TABLE chapters ALTER COLUMN volume_id DROP NOT NULL;
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS volume_chapter_number integer;
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS subtitle text;
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS content_summary text;
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS actual_words integer NOT NULL DEFAULT 0;
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS ai_generated_words integer DEFAULT 0;
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS human_written_words integer DEFAULT 0;
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS emotion_overall text;
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS emotion_points jsonb;
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS appearing_characters jsonb;
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS appearing_items jsonb;
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS appearing_locations jsonb;
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS appearing_techniques jsonb;
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS planted_foreshadowings jsonb;
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS resolved_foreshadowings jsonb;
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS referenced_foreshadowings jsonb;
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS writing_style text;
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS content_focus jsonb;
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS custom_rules jsonb;
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS generation_job_id text;
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS last_ai_action text DEFAULT 'none';
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS last_ai_model_id text;
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS chapter_version integer NOT NULL DEFAULT 1;
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS previous_version_id uuid;
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS is_latest_version boolean DEFAULT true;
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS first_written_at timestamp with time zone;
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS frozen_at timestamp with time zone;
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS published_at timestamp with time zone;
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS world_snapshot jsonb;
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS snapshot_taken_at timestamp with time zone;

-- ── 3. volumes 表扩展 ──
ALTER TABLE volumes ADD COLUMN IF NOT EXISTS subtitle text;
ALTER TABLE volumes ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE volumes ADD COLUMN IF NOT EXISTS planned_start_chapter integer;
ALTER TABLE volumes ADD COLUMN IF NOT EXISTS planned_end_chapter integer;
ALTER TABLE volumes ADD COLUMN IF NOT EXISTS planned_chapter_count integer;
ALTER TABLE volumes ADD COLUMN IF NOT EXISTS target_words integer;
ALTER TABLE volumes ADD COLUMN IF NOT EXISTS target_arc text;
ALTER TABLE volumes ADD COLUMN IF NOT EXISTS structure_mode text;
ALTER TABLE volumes ADD COLUMN IF NOT EXISTS structure_acts jsonb;
ALTER TABLE volumes ADD COLUMN IF NOT EXISTS total_chapters integer NOT NULL DEFAULT 0;
ALTER TABLE volumes ADD COLUMN IF NOT EXISTS total_words integer NOT NULL DEFAULT 0;
ALTER TABLE volumes ADD COLUMN IF NOT EXISTS completed_chapters integer NOT NULL DEFAULT 0;
ALTER TABLE volumes ADD COLUMN IF NOT EXISTS frozen_chapters integer NOT NULL DEFAULT 0;
ALTER TABLE volumes ADD COLUMN IF NOT EXISTS started_at timestamp with time zone;
ALTER TABLE volumes ADD COLUMN IF NOT EXISTS completed_at timestamp with time zone;

-- ── 4. outlines 表扩展 ──
ALTER TABLE outlines ADD COLUMN IF NOT EXISTS outline_mode text DEFAULT 'rough';
ALTER TABLE outlines ADD COLUMN IF NOT EXISTS structure_mode text;
ALTER TABLE outlines ADD COLUMN IF NOT EXISTS target_total_words integer;
ALTER TABLE outlines ADD COLUMN IF NOT EXISTS target_chapter_count integer;
ALTER TABLE outlines ADD COLUMN IF NOT EXISTS target_volume_count integer;
ALTER TABLE outlines ADD COLUMN IF NOT EXISTS narrative_pace text DEFAULT 'medium';
ALTER TABLE outlines ADD COLUMN IF NOT EXISTS content_focus jsonb;
ALTER TABLE outlines ADD COLUMN IF NOT EXISTS custom_requirements text;
ALTER TABLE outlines ADD COLUMN IF NOT EXISTS generation_model_id text;
ALTER TABLE outlines ADD COLUMN IF NOT EXISTS is_current boolean DEFAULT false;
ALTER TABLE outlines ADD COLUMN IF NOT EXISTS previous_outline_id uuid;
ALTER TABLE outlines ADD COLUMN IF NOT EXISTS source_proposal_id uuid;
ALTER TABLE outlines ADD COLUMN IF NOT EXISTS total_outline_items integer DEFAULT 0;
ALTER TABLE outlines ADD COLUMN IF NOT EXISTS total_planned_words integer DEFAULT 0;
ALTER TABLE outlines ADD COLUMN IF NOT EXISTS approved_at timestamp with time zone;
ALTER TABLE outlines ADD COLUMN IF NOT EXISTS deprecated_at timestamp with time zone;

-- ── 5. setting_item_relations 表 ──
CREATE TABLE IF NOT EXISTS setting_item_relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id),
  source_item_id uuid NOT NULL REFERENCES setting_items(id),
  target_item_id uuid NOT NULL REFERENCES setting_items(id),
  relation_type text NOT NULL,
  label text,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS setting_item_relations_project_idx ON setting_item_relations(project_id);
CREATE INDEX IF NOT EXISTS setting_item_relations_source_idx ON setting_item_relations(source_item_id);
CREATE INDEX IF NOT EXISTS setting_item_relations_target_idx ON setting_item_relations(target_item_id);

-- ── 5b. setting_items 扩展 ──
ALTER TABLE setting_items ADD COLUMN IF NOT EXISTS parent_item_id uuid REFERENCES setting_items(id);
ALTER TABLE setting_items ADD COLUMN IF NOT EXISTS engine_source text;
ALTER TABLE setting_items ADD COLUMN IF NOT EXISTS item_subtype text;
CREATE INDEX IF NOT EXISTS setting_items_parent_item_idx ON setting_items(parent_item_id);
CREATE INDEX IF NOT EXISTS setting_items_engine_source_idx ON setting_items(project_id, engine_source);

-- ── 6. ai_proposals 扩展 ──
ALTER TABLE ai_proposals ADD COLUMN IF NOT EXISTS revision_notes text;

-- ── 7. outline_items 表 ──
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
);
CREATE INDEX IF NOT EXISTS outline_items_outline_idx ON outline_items(outline_id);
CREATE INDEX IF NOT EXISTS outline_items_chapter_idx ON outline_items(outline_id, chapter_number);
CREATE INDEX IF NOT EXISTS outline_items_linked_idx ON outline_items(linked_chapter_id);

-- ── 8. project_daily_stats 表 ──
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
);
CREATE INDEX IF NOT EXISTS project_daily_stats_project_date_idx ON project_daily_stats(project_id, date);
CREATE INDEX IF NOT EXISTS project_daily_stats_date_idx ON project_daily_stats(date);

-- ── 8b. project_scales 表 ──
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
);
CREATE INDEX IF NOT EXISTS project_scales_project_key_idx ON project_scales(project_id, key);
CREATE INDEX IF NOT EXISTS project_scales_parent_idx ON project_scales(project_id, parent_key);

-- ── 9. CHECK 约束 ──
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_status_check;
ALTER TABLE projects ADD CONSTRAINT projects_status_check
  CHECK (status IN ('hatching', 'active', 'archived', 'draft', 'worldbuilding', 'outlining', 'writing', 'paused', 'completed', 'revision', 'published'));

ALTER TABLE chapters DROP CONSTRAINT IF EXISTS chapters_status_check;
ALTER TABLE chapters ADD CONSTRAINT chapters_status_check
  CHECK (status IN ('draft', 'confirmed', 'archived', 'reviewing', 'pending_proposal', 'frozen', 'published', 'retcon_pending', 'retcon_reviewing'));

ALTER TABLE volumes DROP CONSTRAINT IF EXISTS volumes_status_check;
ALTER TABLE volumes ADD CONSTRAINT volumes_status_check
  CHECK (status IN ('draft', 'confirmed', 'archived', 'planned', 'writing', 'completed', 'revision', 'published'));

ALTER TABLE outlines DROP CONSTRAINT IF EXISTS outlines_status_check;
ALTER TABLE outlines ADD CONSTRAINT outlines_status_check
  CHECK (status IN ('draft', 'confirmed', 'archived', 'approved', 'deprecated', 'rejected'));

ALTER TABLE setting_items DROP CONSTRAINT IF EXISTS setting_items_status_check;
ALTER TABLE setting_items ADD CONSTRAINT setting_items_status_check
  CHECK (status IN ('draft', 'confirmed', 'archived'));

ALTER TABLE ai_proposals DROP CONSTRAINT IF EXISTS ai_proposals_status_check;
ALTER TABLE ai_proposals ADD CONSTRAINT ai_proposals_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'superseded', 'revision_requested', 'executing'));

ALTER TABLE mou_states DROP CONSTRAINT IF EXISTS mou_states_status_check;
ALTER TABLE mou_states ADD CONSTRAINT mou_states_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'superseded', 'revision_requested', 'executing'));

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_status_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_status_check
  CHECK (status IN ('unread', 'read', 'dismissed', 'acted'));

ALTER TABLE llm_logs DROP CONSTRAINT IF EXISTS llm_logs_status_check;
ALTER TABLE llm_logs ADD CONSTRAINT llm_logs_status_check
  CHECK (status IN ('success', 'error', 'timeout'));

ALTER TABLE discussions DROP CONSTRAINT IF EXISTS discussions_role_check;
ALTER TABLE discussions ADD CONSTRAINT discussions_role_check
  CHECK (role IN ('user', 'assistant'));

ALTER TABLE notification_reads DROP CONSTRAINT IF EXISTS notification_reads_action_check;
ALTER TABLE notification_reads ADD CONSTRAINT notification_reads_action_check
  CHECK (action IN ('read', 'dismissed', 'acted'));

ALTER TABLE setting_item_relations DROP CONSTRAINT IF EXISTS setting_item_relations_type_check;
ALTER TABLE setting_item_relations ADD CONSTRAINT setting_item_relations_type_check
  CHECK (relation_type IN ('hierarchy', 'reference', 'opposition', 'dependency', 'geographic', 'affiliation', 'adjacency', 'functional'));

ALTER TABLE outline_items DROP CONSTRAINT IF EXISTS outline_items_execution_status_check;
ALTER TABLE outline_items ADD CONSTRAINT outline_items_execution_status_check
  CHECK (execution_status IN ('pending', 'linked', 'deviated', 'completed'));

-- ── 10. 索引 ──
CREATE INDEX IF NOT EXISTS projects_status_idx ON projects(status);
CREATE INDEX IF NOT EXISTS projects_novel_type_idx ON projects(novel_type);
CREATE INDEX IF NOT EXISTS projects_platform_idx ON projects(platform_name);
CREATE INDEX IF NOT EXISTS projects_created_at_idx ON projects(created_at);
CREATE INDEX IF NOT EXISTS projects_updated_at_idx ON projects(updated_at);
CREATE INDEX IF NOT EXISTS chapters_status_idx ON chapters(status);
CREATE INDEX IF NOT EXISTS volumes_status_idx ON volumes(status);
CREATE INDEX IF NOT EXISTS outlines_status_idx ON outlines(status);

-- ── 11. project_settings 唯一约束 ──
DELETE FROM project_settings a USING project_settings b
WHERE a.id < b.id AND a.project_id = b.project_id;
ALTER TABLE project_settings DROP CONSTRAINT IF EXISTS project_settings_project_id_unique;
ALTER TABLE project_settings ADD CONSTRAINT project_settings_project_id_unique UNIQUE (project_id);

COMMIT;
